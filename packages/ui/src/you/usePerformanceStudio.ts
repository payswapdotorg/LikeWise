// YOU Performance Studio — 表面编排 hook（W4B）。
//
// 职责：把 PerformanceStudioController 的异步操作适配到视图 store（加载/刷新/错误态），
// 并驱动 demo 步进。不持有 canonical truth——每次操作后 refresh() 拉取服务端事实。
// 与 W2B/W3B 同款：操作失败记录为 inline actionError（status 保持 ready），仅加载失败
// 才进入表面级 error 态——错误归因到动作更诚实，表面保持可用。actionError 携带
// YouErrorCode 字面（typed error panel 的分类键）。
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/logger.js";
import {
  PerformanceStudioError,
  type PerformanceStudioController,
} from "@/you/performanceController.js";
import {
  runPerformanceDemoStep,
  PERFORMANCE_DEMO_STEPS,
  type PerformanceDemoStepOutcome,
} from "@/you/performanceStudioDemo.js";
import { acquirePerformanceStudio } from "@/you/performanceStudioRegistry.js";
import type { PerformancePaneStoreApi } from "@/you/performanceStudioStore.js";
import type { PerformanceActionError } from "@/you/performanceStudioStore.js";

function describeError(error: unknown): PerformanceActionError {
  if (error instanceof PerformanceStudioError) {
    return { code: error.youError.code, message: error.youError.message };
  }
  return {
    code: "UNEXPECTED",
    message: error instanceof Error ? error.message : String(error),
  };
}

export interface UsePerformanceStudioBinding {
  readonly controller: PerformanceStudioController;
  readonly store: PerformancePaneStoreApi;
  ensureLoaded: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  runDemoStep: () => Promise<PerformanceDemoStepOutcome | null>;
  startDemo: () => void;
  resetDemo: () => void;
}

/** 绑定一个 workspace 的 Performance 表面（controller + store 已由 registry 复用）。 */
export function usePerformanceStudioBinding(workspaceKey: string): UsePerformanceStudioBinding {
  const instance = acquirePerformanceStudio(workspaceKey);
  const loadSeqRef = useRef(0);

  const refreshInto = useCallback(
    async (store: PerformancePaneStoreApi, controller: PerformanceStudioController) => {
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
      logger.warn("[you:performance] performance surface load failed", {
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
        logger.warn("[you:performance] performance surface operation failed", {
          workspaceKey,
          error: `${typed.code}: ${typed.message}`,
        });
        // 操作级 typed 错误：inline 呈现（truthful）；表面不整体失败。
        store.getState().actionFailed(typed);
        return null;
      }
    },
    [instance, refreshInto, workspaceKey],
  );

  const runDemoStep = useCallback(async (): Promise<PerformanceDemoStepOutcome | null> => {
    const { store, controller } = instance;
    const demo = store.getState().demo;
    if (demo.finished || demo.stepIndex >= PERFORMANCE_DEMO_STEPS.length) {
      return null;
    }
    const step = PERFORMANCE_DEMO_STEPS[demo.stepIndex];
    if (!step) {
      return null;
    }
    // demo 驱动器自行处理预期 typed error（剧本的诚实错误步骤）；非预期错误上抛。
    const stepOutcome = await runPerformanceDemoStep(controller, step);
    store.getState().demoStepRecorded(stepOutcome);
    const state = store.getState();
    // 应用步骤的视图提示（与 W1B/W2B/W3B 同款职责）。
    if (stepOutcome.uiHint.selectedPerformanceId !== undefined) {
      state.selectPerformance(stepOutcome.uiHint.selectedPerformanceId);
    }
    if (stepOutcome.uiHint.selectedTemplateId !== undefined) {
      state.selectTemplate(stepOutcome.uiHint.selectedTemplateId);
    }
    if (stepOutcome.uiHint.selectedJobId !== undefined) {
      state.selectJob(stepOutcome.uiHint.selectedJobId);
    }
    if (stepOutcome.uiHint.selectedArtifactId !== undefined) {
      state.selectArtifact(stepOutcome.uiHint.selectedArtifactId);
    }
    if (stepOutcome.uiHint.panel) {
      state.setPanel(stepOutcome.uiHint.panel);
    }
    if (state.demo.stepIndex >= PERFORMANCE_DEMO_STEPS.length) {
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
