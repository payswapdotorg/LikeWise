// YOU Avatar Studio — Avatar 表面视图状态 store（W7B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：embodiment 的 canonical truth 属于
// W7A 的 EmbodimentService；本 store 只持有**投影/视图状态**（面板、选中
// body/soul/session、再附身草稿、demo 进度）。快照是服务端事实的只读副本，由
// useAvatarStudio 写入。跟随 W1B–W6B 的本地模式（zustand create + 纯转移函数）。
// 具身状态绝不落 UI 本地状态——一切状态变化都经 controller 投影回流。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { AvatarStudioSnapshot } from "./avatarController.js";
import { clampSessionIndex } from "./avatarStudioProjection.js";
import type { AvatarDemoStepOutcome } from "./avatarStudioDemo.js";

export type AvatarPanelId =
  | "configuration"
  | "embodiment"
  | "session"
  | "realtime"
  | "demo";

export type AvatarSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_BODY_NOT_FOUND /
 *  YOU_SOUL_BINDING_INVALID / YOU_AVATAR_SESSION_NOT_FOUND /
 *  YOU_EMBODIMENT_STATE_INVALID 等 code 驱动专属错误面板文案）。 */
export interface AvatarActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface AvatarDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly AvatarDemoStepOutcome[];
}

/** Body/Soul 挑选草稿（配置面板；数据源是注册面投影）。 */
export interface AvatarConfigurationDraft {
  readonly bodyId: string | null;
  readonly soulBindingId: string | null;
}

export const AVATAR_CONFIGURATION_DRAFT_EMPTY: AvatarConfigurationDraft = {
  bodyId: null,
  soulBindingId: null,
};

/** 再附身（re-possession）草稿：目标会话 + 目标 Soul。 */
export interface AvatarReassignmentDraft {
  readonly sessionId: string | null;
  readonly toSoulBindingId: string | null;
}

export const AVATAR_REASSIGNMENT_DRAFT_EMPTY: AvatarReassignmentDraft = {
  sessionId: null,
  toSoulBindingId: null,
};

/** 最近一次再附身的操作性视图（from/to Soul + 不变的 Body 契约显示源）。 */
export interface AvatarReassignmentView {
  readonly sessionId: string;
  readonly bodyId: string;
  readonly fromSoulBindingId: string;
  readonly toSoulBindingId: string;
}

export interface AvatarPaneState {
  readonly status: AvatarSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: AvatarActionError | null;
  readonly snapshot: AvatarStudioSnapshot | null;
  readonly panel: AvatarPanelId;
  /** 配置草稿：Body picker 选中项；null = 未选中（回退注册面首项）。 */
  readonly selectedBodyId: string | null;
  /** 配置草稿：Soul picker 选中项；null = 未选中（回退注册面首项）。 */
  readonly selectedSoulBindingId: string | null;
  /** 当前检视的会话 id；null = 未选中（列表自动回退末位）。 */
  readonly selectedSessionId: string | null;
  /** 会话列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly sessionIndex: number;
  /** 再附身草稿（session 面板的 re-possession 流）。 */
  readonly reassignmentDraft: AvatarReassignmentDraft;
  /** 最近一次再附身结果（Body 契约保持显示的对照源）。 */
  readonly lastReassignment: AvatarReassignmentView | null;
  readonly demo: AvatarDemoState;
}

export interface AvatarPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: AvatarStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: AvatarActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: AvatarStudioSnapshot) => void;
  setPanel: (panel: AvatarPanelId) => void;
  selectBody: (bodyId: string | null) => void;
  selectSoulBinding: (soulBindingId: string | null) => void;
  selectSession: (sessionId: string | null) => void;
  setSessionIndex: (index: number) => void;
  moveSessionIndex: (delta: number) => void;
  setReassignmentSoul: (soulBindingId: string | null) => void;
  /** 以当前检视会话为再附身草稿目标（保持 Body 契约显示）。 */
  beginReassignment: (sessionId: string | null) => void;
  setReassignment: (reassignment: AvatarReassignmentView | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: AvatarDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type AvatarPaneStore = AvatarPaneState & AvatarPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type AvatarPaneStoreApi = UseBoundStore<StoreApi<AvatarPaneStore>>;

const INITIAL_DEMO_STATE: AvatarDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const AVATAR_PANE_INITIAL_STATE: AvatarPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "configuration",
  selectedBodyId: null,
  selectedSoulBindingId: null,
  selectedSessionId: null,
  sessionIndex: 0,
  reassignmentDraft: AVATAR_REASSIGNMENT_DRAFT_EMPTY,
  lastReassignment: null,
  demo: INITIAL_DEMO_STATE,
};

export function createAvatarPaneStore() {
  return create<AvatarPaneStore>()((set) => ({
    ...AVATAR_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认挑选注册面首项（确定性）；检视最新会话（追加序末位）。
        selectedBodyId: snapshot.bodies[0]?.id ?? null,
        selectedSoulBindingId: snapshot.soulBindings[0]?.id ?? null,
        selectedSessionId: snapshot.sessions.at(-1)?.id ?? null,
        sessionIndex: Math.max(0, snapshot.sessions.length - 1),
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) =>
      set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位/首项。
        const selectedBodyId = snapshot.bodies.some(
          (body) => body.id === state.selectedBodyId,
        )
          ? state.selectedBodyId
          : (snapshot.bodies[0]?.id ?? null);
        const selectedSoulBindingId = snapshot.soulBindings.some(
          (soul) => soul.id === state.selectedSoulBindingId,
        )
          ? state.selectedSoulBindingId
          : (snapshot.soulBindings[0]?.id ?? null);
        const selectedSessionId = snapshot.sessions.some(
          (session) => session.id === state.selectedSessionId,
        )
          ? state.selectedSessionId
          : (snapshot.sessions.at(-1)?.id ?? null);
        const sessionIndex = snapshot.sessions.some(
          (session) => session.id === selectedSessionId,
        )
          ? Math.max(
              0,
              snapshot.sessions.findIndex(
                (session) => session.id === selectedSessionId,
              ),
            )
          : Math.max(0, snapshot.sessions.length - 1);
        const reassignmentDraft = {
          sessionId:
            state.reassignmentDraft.sessionId !== null &&
            snapshot.sessions.some(
              (session) => session.id === state.reassignmentDraft.sessionId,
            )
              ? state.reassignmentDraft.sessionId
              : null,
          toSoulBindingId: snapshot.soulBindings.some(
            (soul) => soul.id === state.reassignmentDraft.toSoulBindingId,
          )
            ? state.reassignmentDraft.toSoulBindingId
            : null,
        };
        return {
          ...state,
          snapshot,
          selectedBodyId,
          selectedSoulBindingId,
          selectedSessionId,
          sessionIndex,
          reassignmentDraft,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectBody: (bodyId) =>
      set((state) => ({ ...state, selectedBodyId: bodyId })),
    selectSoulBinding: (soulBindingId) =>
      set((state) => ({ ...state, selectedSoulBindingId: soulBindingId })),
    selectSession: (sessionId) =>
      set((state) => ({
        ...state,
        selectedSessionId: sessionId,
        sessionIndex:
          sessionId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.sessions.findIndex(
                  (session) => session.id === sessionId,
                ) ?? 0,
              ),
      })),
    setSessionIndex: (index) =>
      set((state) => ({
        ...state,
        sessionIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedSessionId:
          state.snapshot?.sessions[Math.max(0, index)]?.id ?? null,
      })),
    moveSessionIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.sessions.length ?? 0;
        const nextIndex = clampSessionIndex(state.sessionIndex + delta, total);
        return {
          ...state,
          sessionIndex: nextIndex,
          selectedSessionId:
            state.snapshot?.sessions[nextIndex]?.id ?? null,
        };
      }),
    setReassignmentSoul: (soulBindingId) =>
      set((state) => ({
        ...state,
        reassignmentDraft: {
          ...state.reassignmentDraft,
          toSoulBindingId: soulBindingId,
        },
      })),
    beginReassignment: (sessionId) =>
      set((state) => ({
        ...state,
        reassignmentDraft: { sessionId, toSoulBindingId: null },
      })),
    setReassignment: (reassignment) =>
      set((state) => ({ ...state, lastReassignment: reassignment })),

    demoStarted: () =>
      set((state) => ({
        ...state,
        demo: { active: true, stepIndex: 0, finished: false, outcomes: [] },
      })),
    demoStepRecorded: (outcome) =>
      set((state) => ({
        ...state,
        demo: {
          ...state.demo,
          stepIndex: state.demo.stepIndex + 1,
          outcomes: [...state.demo.outcomes, outcome],
        },
      })),
    demoFinished: () =>
      set((state) => ({
        ...state,
        demo: { ...state.demo, active: false, finished: true },
      })),
    demoReset: () => set((state) => ({ ...state, demo: INITIAL_DEMO_STATE })),
  }));
}

/**
 * 默认全局 store：单 workspace 壳的便捷入口（与 solutionStore 单例模式一致）。
 * 多 workspace 分屏由 avatarStudioRegistry 提供 per-workspace 实例。
 */
export const useAvatarPaneStore = createAvatarPaneStore();
