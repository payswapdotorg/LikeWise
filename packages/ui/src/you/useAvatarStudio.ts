// YOU Avatar Studio — 表面编排 hook（W7B）。
//
// 职责：把 AvatarStudioController 的异步操作适配到视图 store（加载/刷新/错误态），
// 并驱动 demo 步进。不持有 canonical truth——每次操作后 refresh() 拉取服务端事实。
// 与 W2B–W6B 同款：操作失败记录为 inline actionError（status 保持 ready），仅加载
// 失败才进入表面级 error 态——错误归因到动作更诚实，表面保持可用。actionError 携带
// YouErrorCode 字面（typed error panel 的分类键）。
import { useCallback, useEffect, useRef } from "react";
import { logger } from "@/logger.js";
import {
  AvatarStudioError,
  avatarSessionById,
  type AvatarStudioController,
} from "@/you/avatarController.js";
import {
  runAvatarDemoStep,
  AVATAR_DEMO_STEPS,
  type AvatarDemoStepOutcome,
} from "@/you/avatarStudioDemo.js";
import { acquireAvatarStudio } from "@/you/avatarStudioRegistry.js";
import type { AvatarPaneStoreApi } from "@/you/avatarStudioStore.js";
import type { AvatarActionError, AvatarReassignmentView } from "@/you/avatarStudioStore.js";

function describeError(error: unknown): AvatarActionError {
  if (error instanceof AvatarStudioError) {
    return { code: error.youError.code, message: error.youError.message };
  }
  return {
    code: "UNEXPECTED",
    message: error instanceof Error ? error.message : String(error),
  };
}

export interface UseAvatarStudioBinding {
  readonly controller: AvatarStudioController;
  readonly store: AvatarPaneStoreApi;
  ensureLoaded: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T | null>;
  runDemoStep: () => Promise<AvatarDemoStepOutcome | null>;
  startDemo: () => void;
  resetDemo: () => void;
}

/** 绑定一个 workspace 的 Avatar 表面（controller + store 已由 registry 复用）。 */
export function useAvatarStudioBinding(workspaceKey: string): UseAvatarStudioBinding {
  const instance = acquireAvatarStudio(workspaceKey);
  const loadSeqRef = useRef(0);

  const refreshInto = useCallback(
    async (store: AvatarPaneStoreApi, controller: AvatarStudioController) => {
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
      logger.warn("[you:avatar] avatar surface load failed", {
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
        logger.warn("[you:avatar] avatar surface operation failed", {
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

  const runDemoStep = useCallback(async (): Promise<AvatarDemoStepOutcome | null> => {
    const { store, controller } = instance;
    const demo = store.getState().demo;
    if (demo.finished || demo.stepIndex >= AVATAR_DEMO_STEPS.length) {
      return null;
    }
    const demoStep = AVATAR_DEMO_STEPS[demo.stepIndex];
    if (!demoStep) {
      return null;
    }
    // demo 驱动器自行处理预期 typed error（剧本的诚实错误步骤）；非预期错误上抛。
    const stepOutcome = await runAvatarDemoStep(controller, demoStep);
    store.getState().demoStepRecorded(stepOutcome);
    const state = store.getState();
    // 应用步骤的视图提示（与 W1B–W6B 同款职责）。
    if (stepOutcome.uiHint.selectedBodyId !== undefined) {
      state.selectBody(stepOutcome.uiHint.selectedBodyId);
    }
    if (stepOutcome.uiHint.selectedSoulBindingId !== undefined) {
      state.selectSoulBinding(stepOutcome.uiHint.selectedSoulBindingId);
    }
    if (stepOutcome.uiHint.selectedSessionId !== undefined) {
      state.selectSession(stepOutcome.uiHint.selectedSessionId);
    }
    if (stepOutcome.uiHint.panel) {
      state.setPanel(stepOutcome.uiHint.panel);
    }
    // 投影回流（demo 直接驱动 controller；每步后拉取服务端事实）。
    const snapshot = await controller.refresh();
    state.applySnapshot(snapshot);
    // 再附身步骤后记录操作性视图（from/to Soul + 不变 Body 契约显示源——
    // from/to 事实读自最近一条 soul-reassigned 事件的载荷，绝不猜测）。
    if (stepOutcome.stepId === "soul-reassign") {
      const sessionId = stepOutcome.refs[0] ?? null;
      const reassignEvent = [...snapshot.events]
        .reverse()
        .find(
          (event) =>
            event.type === "soul-reassigned" && event.subjectRef === sessionId,
        );
      const session = avatarSessionById(snapshot, sessionId);
      if (session && reassignEvent) {
        const fromSoulBindingId = reassignEvent.payload.fromSoulBindingId;
        const view: AvatarReassignmentView = {
          sessionId: session.id,
          bodyId: session.bodyId,
          fromSoulBindingId:
            typeof fromSoulBindingId === "string" ? fromSoulBindingId : "",
          toSoulBindingId: session.soulBindingId,
        };
        state.setReassignment(view);
      }
    }
    if (state.demo.stepIndex >= AVATAR_DEMO_STEPS.length) {
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
