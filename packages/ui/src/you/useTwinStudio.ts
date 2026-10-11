// YOU Twin Studio — 表面编排 hook（W3B）。
//
// 职责：把 TwinStudioController 的异步操作适配到视图 store（加载/刷新/错误态），
// 并驱动 demo 步进。不持有 canonical truth——每次操作后 refresh() 拉取服务端事实。
// 与 W2B useCaptureStudio 同款：操作失败记录为 inline actionError（status 保持
// ready），仅加载失败才进入表面级 error 态——错误归因到动作更诚实，表面保持可用。
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/logger.js";
import { TwinStudioError, type TwinStudioController } from "@/you/twinController.js";
import {
  runTwinDemoStep,
  TWIN_DEMO_STEPS,
  type TwinDemoStepOutcome,
} from "@/you/twinStudioDemo.js";
import { acquireTwinStudio } from "@/you/twinStudioRegistry.js";
import type { TwinPaneStoreApi } from "@/you/twinStudioStore.js";

function describeError(error: unknown): string {
  if (error instanceof TwinStudioError) {
    return `${error.youError.code}: ${error.youError.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export interface UseTwinStudioBinding {
  readonly controller: TwinStudioController;
  readonly store: TwinPaneStoreApi;
  ensureLoaded: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  runDemoStep: () => Promise<TwinDemoStepOutcome | null>;
  startDemo: () => void;
  resetDemo: () => void;
}

/** 绑定一个 workspace 的 Twin 表面（controller + store 已由 registry 复用）。 */
export function useTwinStudioBinding(workspaceKey: string): UseTwinStudioBinding {
  const instance = acquireTwinStudio(workspaceKey);
  const loadSeqRef = useRef(0);

  const refreshInto = useCallback(
    async (store: TwinPaneStoreApi, controller: TwinStudioController) => {
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
      logger.warn("[you:twin] twin surface load failed", { workspaceKey, error: message });
      store.getState().loadFailed(message);
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
        const message = describeError(error);
        logger.warn("[you:twin] twin surface operation failed", {
          workspaceKey,
          error: message,
        });
        // 操作级错误：inline 呈现（truthful）；表面不整体失败。
        store.getState().actionFailed(message);
        return null;
      }
    },
    [instance, refreshInto, workspaceKey],
  );

  const runDemoStep = useCallback(async (): Promise<TwinDemoStepOutcome | null> => {
    const { store, controller } = instance;
    const demo = store.getState().demo;
    if (demo.finished || demo.stepIndex >= TWIN_DEMO_STEPS.length) {
      return null;
    }
    const step = TWIN_DEMO_STEPS[demo.stepIndex];
    if (!step) {
      return null;
    }
    // demo 驱动器自行处理预期 typed error（剧本的诚实错误步骤）；非预期错误上抛。
    const stepOutcome = await runTwinDemoStep(controller, step);
    store.getState().demoStepRecorded(stepOutcome);
    const state = store.getState();
    // 应用步骤的视图提示（与 W1B/W2B 同款职责）。
    if (stepOutcome.uiHint.selectedVersionId !== undefined) {
      state.selectVersion(stepOutcome.uiHint.selectedVersionId);
    }
    if (stepOutcome.uiHint.compareBaseVersionId !== undefined) {
      state.setCompareBase(stepOutcome.uiHint.compareBaseVersionId);
    }
    if (stepOutcome.uiHint.compareTargetVersionId !== undefined) {
      state.setCompareTarget(stepOutcome.uiHint.compareTargetVersionId);
    }
    if (stepOutcome.uiHint.compareMode) {
      state.setCompareMode(stepOutcome.uiHint.compareMode);
    }
    if (stepOutcome.uiHint.panel) {
      state.setPanel(stepOutcome.uiHint.panel);
    }
    if (state.demo.stepIndex >= TWIN_DEMO_STEPS.length) {
      state.demoFinished();
    }
    return stepOutcome;
  }, [instance]);

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
