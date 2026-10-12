// YOU Learning Studio — 表面编排 hook（W6B）。
//
// 职责：把 LearningStudioController 的异步操作适配到视图 store（加载/刷新/错误态），
// 并驱动 demo 步进。不持有 canonical truth——每次操作后 refresh() 拉取服务端事实。
// 与 W2B–W5B 同款：操作失败记录为 inline actionError（status 保持 ready），仅加载
// 失败才进入表面级 error 态——错误归因到动作更诚实，表面保持可用。actionError 携带
// YouErrorCode 字面（typed error panel 的分类键）。
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/logger.js";
import {
  LearningStudioError,
  type LearningStudioController,
} from "@/you/learningController.js";
import {
  runLearningDemoStep,
  LEARNING_DEMO_STEPS,
  type LearningDemoStepOutcome,
} from "@/you/learningStudioDemo.js";
import { acquireLearningStudio } from "@/you/learningStudioRegistry.js";
import type { LearningPaneStoreApi } from "@/you/learningStudioStore.js";
import type { LearningActionError } from "@/you/learningStudioStore.js";

function describeError(error: unknown): LearningActionError {
  if (error instanceof LearningStudioError) {
    return { code: error.youError.code, message: error.youError.message };
  }
  return {
    code: "UNEXPECTED",
    message: error instanceof Error ? error.message : String(error),
  };
}

export interface UseLearningStudioBinding {
  readonly controller: LearningStudioController;
  readonly store: LearningPaneStoreApi;
  ensureLoaded: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  runDemoStep: () => Promise<LearningDemoStepOutcome | null>;
  startDemo: () => void;
  resetDemo: () => void;
}

/** 绑定一个 workspace 的 Learning 表面（controller + store 已由 registry 复用）。 */
export function useLearningStudioBinding(workspaceKey: string): UseLearningStudioBinding {
  const instance = acquireLearningStudio(workspaceKey);
  const loadSeqRef = useRef(0);

  const refreshInto = useCallback(
    async (store: LearningPaneStoreApi, controller: LearningStudioController) => {
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
      logger.warn("[you:learning] learning surface load failed", {
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
        logger.warn("[you:learning] learning surface operation failed", {
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

  const runDemoStep = useCallback(async (): Promise<LearningDemoStepOutcome | null> => {
    const { store, controller } = instance;
    const demo = store.getState().demo;
    if (demo.finished || demo.stepIndex >= LEARNING_DEMO_STEPS.length) {
      return null;
    }
    const demoStep = LEARNING_DEMO_STEPS[demo.stepIndex];
    if (!demoStep) {
      return null;
    }
    // demo 驱动器自行处理预期 typed error（剧本的诚实错误步骤）；非预期错误上抛。
    const stepOutcome = await runLearningDemoStep(controller, demoStep);
    store.getState().demoStepRecorded(stepOutcome);
    const state = store.getState();
    // 应用步骤的视图提示（与 W1B–W5B 同款职责）。
    if (stepOutcome.uiHint.selectedSignalId !== undefined) {
      state.selectSignal(stepOutcome.uiHint.selectedSignalId);
    }
    if (stepOutcome.uiHint.selectedRecordId !== undefined) {
      state.selectRecord(stepOutcome.uiHint.selectedRecordId);
    }
    if (stepOutcome.uiHint.selectedTrajectoryId !== undefined) {
      state.selectTrajectory(stepOutcome.uiHint.selectedTrajectoryId);
    }
    if (stepOutcome.uiHint.selectedPreferenceKey !== undefined) {
      state.selectPreference(stepOutcome.uiHint.selectedPreferenceKey);
    }
    if (stepOutcome.uiHint.panel) {
      state.setPanel(stepOutcome.uiHint.panel);
    }
    if (state.demo.stepIndex >= LEARNING_DEMO_STEPS.length) {
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
