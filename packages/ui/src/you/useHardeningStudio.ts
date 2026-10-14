// YOU Hardening Studio — 表面编排 hook（W10B）。
//
// 职责：把 HardeningStudioController 的异步操作适配到视图 store（加载/刷新/
// 错误态），并驱动 demo 步进。不持有 canonical truth——每次操作后 refresh() 拉取
// 服务端事实。与 W2B–W9B 同款：操作失败记录为 inline actionError（status 保持
// ready），仅加载失败才进入表面级 error 态。actionError 携带 YouErrorCode 字面
//（typed error panel 的分类键）。
// 与 W9B 同款（披露）：run() 在失败路径上也 refresh——W10 的 typed 拒绝可能已改变
// 服务端事实（enforcement 记录、隔离 verdict、mismatch 校验观察），拒绝后立即拉取
// 快照才诚实。
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/logger.js";
import {
  HardeningStudioError,
  type HardeningStudioController,
} from "@/you/hardeningController.js";
import {
  runHardeningDemoStep,
  HARDENING_DEMO_STEPS,
  type HardeningDemoStepOutcome,
} from "@/you/hardeningStudioDemo.js";
import { acquireHardeningStudio } from "@/you/hardeningStudioRegistry.js";
import type { HardeningPaneStoreApi } from "@/you/hardeningStudioStore.js";
import type { HardeningActionError } from "@/you/hardeningStudioStore.js";

function describeError(error: unknown): HardeningActionError {
  if (error instanceof HardeningStudioError) {
    return { code: error.youError.code, message: error.youError.message };
  }
  return {
    code: "UNEXPECTED",
    message: error instanceof Error ? error.message : String(error),
  };
}

export interface UseHardeningStudioBinding {
  readonly controller: HardeningStudioController;
  readonly store: HardeningPaneStoreApi;
  ensureLoaded: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  runDemoStep: () => Promise<HardeningDemoStepOutcome | null>;
  startDemo: () => void;
  resetDemo: () => void;
}

/** 绑定一个 workspace 的 Hardening 表面（controller + store 已由 registry 复用）。 */
export function useHardeningStudioBinding(
  workspaceKey: string,
): UseHardeningStudioBinding {
  const instance = acquireHardeningStudio(workspaceKey);
  const loadSeqRef = useRef(0);

  const refreshInto = useCallback(
    async (store: HardeningPaneStoreApi, controller: HardeningStudioController) => {
      const snapshot = await controller.refresh();
      store.getState().applySnapshot(snapshot);
    },
    [],
  );

  const ensureLoaded = useCallback(async () => {
    const { store, controller } = instance;
    const state = store.getState();
    if (state.status === "ready" || state.status === "loading") {
      if (state.status === "ready") {
        // 幂等：已加载则只补一次快照。
        await refreshInto(store, controller);
      }
      return;
    }
    const seq = ++loadSeqRef.current;
    store.getState().beginLoad();
    try {
      const snapshot = await controller.load({ workspaceKey });
      if (seq !== loadSeqRef.current) return;
      store.getState().loadSucceeded(snapshot);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      const message = describeError(error);
      logger.warn("[you:hardening] hardening surface load failed", {
        workspaceKey,
        error: `${message.code}: ${message.message}`,
      });
      store.getState().loadFailed(`${message.code}: ${message.message}`);
    }
  }, [instance, refreshInto, workspaceKey]);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const run = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T | null> => {
      const { store, controller } = instance;
      try {
        const result = await operation();
        await refreshInto(store, controller);
        store.getState().clearActionError();
        return result;
      } catch (error) {
        const typed = describeError(error);
        logger.warn("[you:hardening] hardening surface operation failed", {
          workspaceKey,
          error: `${typed.code}: ${typed.message}`,
        });
        // 操作级 typed 错误：inline 呈现（truthful）；表面不整体失败。
        store.getState().actionFailed(typed);
        // W10 差异（披露）：typed 拒绝可能已落账服务端事实（enforcement 记录、
        // 隔离 verdict）——失败路径也 refresh，快照如实呈现。
        try {
          await refreshInto(store, controller);
        } catch (refreshError) {
          logger.warn(
            "[you:hardening] hardening surface refresh after failure failed",
            {
              workspaceKey,
              error:
                refreshError instanceof Error
                  ? refreshError.message
                  : String(refreshError),
            },
          );
        }
        return null;
      }
    },
    [instance, refreshInto, workspaceKey],
  );

  const runDemoStep = useCallback(
    async (): Promise<HardeningDemoStepOutcome | null> => {
      const { store } = instance;
      const demo = store.getState().demo;
      if (demo.finished || demo.stepIndex >= HARDENING_DEMO_STEPS.length) {
        return null;
      }
      const demoStep = HARDENING_DEMO_STEPS[demo.stepIndex];
      if (!demoStep) {
        return null;
      }
      // demo 驱动器自行处理预期 typed error（剧本的诚实错误步骤）；非预期错误上抛。
      const stepOutcome = await runHardeningDemoStep(instance.controller, demoStep);
      store.getState().demoStepRecorded(stepOutcome);
      const state = store.getState();
      // 应用步骤的视图提示（与 W1B–W9B 同款职责）。
      if (stepOutcome.uiHint.selectedEnforcementId !== undefined) {
        state.selectEnforcement(stepOutcome.uiHint.selectedEnforcementId);
      }
      if (stepOutcome.uiHint.selectedImportVerdictId !== undefined) {
        state.selectImportVerdict(stepOutcome.uiHint.selectedImportVerdictId);
      }
      if (stepOutcome.uiHint.selectedRetentionRecordId !== undefined) {
        state.selectRetentionRecord(stepOutcome.uiHint.selectedRetentionRecordId);
      }
      if (stepOutcome.uiHint.selectedDrRestoreId !== undefined) {
        state.selectDrRestore(stepOutcome.uiHint.selectedDrRestoreId);
      }
      if (stepOutcome.uiHint.selectedEligibilityRecordId !== undefined) {
        state.selectEligibilityRecord(stepOutcome.uiHint.selectedEligibilityRecordId);
      }
      if (stepOutcome.uiHint.panel) {
        state.setPanel(stepOutcome.uiHint.panel);
      }
      if (state.demo.stepIndex >= HARDENING_DEMO_STEPS.length) {
        state.demoFinished();
      }
      return stepOutcome;
    },
    [instance],
  );

  const startDemo = useCallback(() => {
    instance.store.getState().demoStarted();
  }, [instance]);

  const resetDemo = useCallback(() => {
    instance.store.getState().demoReset();
  }, [instance]);

  return {
    controller: instance.controller,
    store: instance.store,
    ensureLoaded,
    run,
    runDemoStep,
    startDemo,
    resetDemo,
  };
}
