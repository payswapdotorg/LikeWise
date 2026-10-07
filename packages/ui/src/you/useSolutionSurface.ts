// YOU Solution Studio — 表面编排 hook（W1B）。
//
// 职责：把 SolutionSurfaceController 的异步操作适配到视图 store（加载/刷新/错误态），
// 并驱动 demo 步进。不持有 canonical truth——每次操作后 refresh() 拉取服务端事实。
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/logger.js";
import {
  SolutionSurfaceError,
  type SolutionSurfaceController,
} from "@/you/solutionController.js";
import {
  runSolutionDemoStep,
  SOLUTION_DEMO_STEPS,
  type SolutionDemoStepOutcome,
} from "@/you/solutionDemo.js";
import { acquireSolutionSurface } from "./solutionSurfaceRegistry.js";
import type { SolutionPaneStoreApi } from "./solutionStore.js";

function describeError(error: unknown): string {
  if (error instanceof SolutionSurfaceError) {
    return `${error.youError.code}: ${error.youError.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export interface UseSolutionSurfaceBinding {
  readonly controller: SolutionSurfaceController;
  readonly store: SolutionPaneStoreApi;
  ensureLoaded: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  runDemoStep: () => Promise<SolutionDemoStepOutcome | null>;
  startDemo: () => void;
  resetDemo: () => void;
}

/** 绑定一个 workspace 的 Solution 表面（controller + store 已由 registry 复用）。 */
export function useSolutionSurfaceBinding(workspaceKey: string): UseSolutionSurfaceBinding {
  const instance = acquireSolutionSurface(workspaceKey);
  const loadSeqRef = useRef(0);

  const refreshInto = useCallback(
    async (store: SolutionPaneStoreApi, controller: SolutionSurfaceController) => {
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
      logger.warn("[you:solution] solution surface load failed", { workspaceKey, error: message });
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
        return result;
      } catch (error) {
        const message = describeError(error);
        logger.warn("[you:solution] solution surface operation failed", {
          workspaceKey,
          error: message,
        });
        store.getState().loadFailed(message);
        return null;
      }
    },
    [instance, refreshInto, workspaceKey],
  );

  const runDemoStep = useCallback(async (): Promise<SolutionDemoStepOutcome | null> => {
    const { store, controller } = instance;
    const demo = store.getState().demo;
    if (demo.finished || demo.stepIndex >= SOLUTION_DEMO_STEPS.length) {
      return null;
    }
    const step = SOLUTION_DEMO_STEPS[demo.stepIndex];
    if (!step) {
      return null;
    }
    const outcome = await run(() => runSolutionDemoStep(controller, step));
    if (!outcome) {
      return null;
    }
    const state = store.getState();
    state.demoStepRecorded(outcome);
    if ("selection" in outcome.uiHint && outcome.uiHint.selection !== undefined) {
      state.setSelection(outcome.uiHint.selection ?? null);
    }
    if (outcome.uiHint.panel) {
      state.setPanel(outcome.uiHint.panel);
    }
    if (outcome.uiHint.mode) {
      state.setMode(outcome.uiHint.mode);
    }
    if (state.demo.stepIndex >= SOLUTION_DEMO_STEPS.length) {
      state.demoFinished();
    }
    return outcome;
  }, [instance, run]);

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
