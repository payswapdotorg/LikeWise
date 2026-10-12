// YOU Learning Studio — Learning 表面视图状态 store（W6B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：learning 的 canonical truth 属于
// learning 应用服务（W6A）；本 store 只持有**投影/视图状态**（面板、选中
// signal/record/trajectory/偏好键、teach-me 草稿、最近重放、demo 进度）。快照是
// 服务端事实的只读副本，由 useLearningStudio 写入。跟随 W1B–W5B 的本地模式
// （zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { LearningStudioSnapshot } from "./learningController.js";
import { clampSignalIndex } from "./learningStudioProjection.js";
import type { LearningDemoStepOutcome } from "./learningStudioDemo.js";

export type LearningPanelId =
  | "signals"
  | "ledger"
  | "rights"
  | "preferences"
  | "replay"
  | "demo";

export type LearningSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_LEARNING_SIGNAL_INVALID /
 *  YOU_LEARNING_RECORD_NOT_FOUND / YOU_LEARNING_RIGHTS_REQUIRED /
 *  YOU_PREFERENCE_SCOPE_INVALID 等 code 驱动专属错误面板文案）。 */
export interface LearningActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface LearningDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly LearningDemoStepOutcome[];
}

/** teach-me/learn-this 确认草稿（kind + scope 挑选；证据引用来自注册面投影）。 */
export interface LearningSignalDraft {
  readonly kind: string | null;
  readonly scope: string | null;
  /** 选中的 evidence 注册面条目 id 列表（内容寻址标签由此派生）。 */
  readonly evidenceIds: readonly string[];
}

export const LEARNING_SIGNAL_DRAFT_EMPTY: LearningSignalDraft = {
  kind: null,
  scope: null,
  evidenceIds: [],
};

/** 最近一次确定性重放的操作性视图值（字节不入库；摘要供回放面板显示）。 */
export interface LearningReplayView {
  readonly trajectoryId: string;
  readonly stepCount: number;
  readonly replayHash: string;
  readonly byteLength: number;
}

export interface LearningPaneState {
  readonly status: LearningSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: LearningActionError | null;
  readonly snapshot: LearningStudioSnapshot | null;
  readonly panel: LearningPanelId;
  /** 当前检视的 signal id；null = 未选中（列表自动回退末位）。 */
  readonly selectedSignalId: string | null;
  /** signal 列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly signalIndex: number;
  /** teach-me 草稿（kind/scope/evidence 挑选）。 */
  readonly signalDraft: LearningSignalDraft;
  /** 当前检视的记录 id（ledger 面板）；null = 未选中（回退末位）。 */
  readonly selectedRecordId: string | null;
  /** 当前检视的 trajectory id（replay 面板）；null = 未选中（回退末位）。 */
  readonly selectedTrajectoryId: string | null;
  /** 当前检视的偏好投影键（`${scope}::${key}`；跨 upsert 稳定）。 */
  readonly selectedPreferenceKey: string | null;
  /** 最近一次确定性重放（replay 面板的摘要显示源）。 */
  readonly lastReplay: LearningReplayView | null;
  readonly demo: LearningDemoState;
}

export interface LearningPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: LearningStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: LearningActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: LearningStudioSnapshot) => void;
  setPanel: (panel: LearningPanelId) => void;
  selectSignal: (signalId: string | null) => void;
  setSignalIndex: (index: number) => void;
  moveSignalIndex: (delta: number) => void;
  setSignalDraftKind: (kind: string | null) => void;
  setSignalDraftScope: (scope: string | null) => void;
  toggleSignalDraftEvidence: (evidenceId: string) => void;
  selectRecord: (recordId: string | null) => void;
  selectTrajectory: (trajectoryId: string | null) => void;
  selectPreference: (preferenceKey: string | null) => void;
  setLastReplay: (replay: LearningReplayView | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: LearningDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type LearningPaneStore = LearningPaneState & LearningPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type LearningPaneStoreApi = UseBoundStore<StoreApi<LearningPaneStore>>;

const INITIAL_DEMO_STATE: LearningDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const LEARNING_PANE_INITIAL_STATE: LearningPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "signals",
  selectedSignalId: null,
  signalIndex: 0,
  signalDraft: LEARNING_SIGNAL_DRAFT_EMPTY,
  selectedRecordId: null,
  selectedTrajectoryId: null,
  selectedPreferenceKey: null,
  lastReplay: null,
  demo: INITIAL_DEMO_STATE,
};

export function createLearningPaneStore() {
  return create<LearningPaneStore>()((set) => ({
    ...LEARNING_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新 signal（确定性：追加序末位）；kind/scope 默认注册面首项。
        selectedSignalId: snapshot.signals.at(-1)?.id ?? null,
        signalIndex: Math.max(0, snapshot.signals.length - 1),
        signalDraft: {
          kind: snapshot.kindRegistry[0]?.kind ?? null,
          scope: "USER",
          evidenceIds: snapshot.evidence.slice(0, 1).map((entry) => entry.id),
        },
        selectedRecordId: snapshot.records.at(-1)?.id ?? null,
        selectedTrajectoryId: snapshot.trajectories.at(-1)?.id ?? null,
        selectedPreferenceKey: snapshot.preferences.at(-1)
          ? `${snapshot.preferences.at(-1)!.scope}::${snapshot.preferences.at(-1)!.key}`
          : null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) =>
      set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedSignalId = snapshot.signals.some(
          (signal) => signal.id === state.selectedSignalId,
        )
          ? state.selectedSignalId
          : (snapshot.signals.at(-1)?.id ?? null);
        const signalIndex = snapshot.signals.some(
          (signal) => signal.id === selectedSignalId,
        )
          ? Math.max(
              0,
              snapshot.signals.findIndex((signal) => signal.id === selectedSignalId),
            )
          : Math.max(0, snapshot.signals.length - 1);
        const signalDraft = {
          ...state.signalDraft,
          kind: snapshot.kindRegistry.some(
            (entry) => entry.kind === state.signalDraft.kind,
          )
            ? state.signalDraft.kind
            : (snapshot.kindRegistry[0]?.kind ?? null),
          scope:
            state.signalDraft.scope !== null &&
            (snapshot.scopes as readonly string[]).includes(state.signalDraft.scope)
              ? state.signalDraft.scope
              : "USER",
          evidenceIds: state.signalDraft.evidenceIds.filter((evidenceId) =>
            snapshot.evidence.some((entry) => entry.id === evidenceId),
          ),
        };
        const selectedRecordId = snapshot.records.some(
          (record) => record.id === state.selectedRecordId,
        )
          ? state.selectedRecordId
          : (snapshot.records.at(-1)?.id ?? null);
        const selectedTrajectoryId = snapshot.trajectories.some(
          (trajectory) => trajectory.id === state.selectedTrajectoryId,
        )
          ? state.selectedTrajectoryId
          : (snapshot.trajectories.at(-1)?.id ?? null);
        const selectedPreferenceKey = snapshot.preferences.some(
          (preference) =>
            `${preference.scope}::${preference.key}` === state.selectedPreferenceKey,
        )
          ? state.selectedPreferenceKey
          : (snapshot.preferences.at(-1)
              ? `${snapshot.preferences.at(-1)!.scope}::${snapshot.preferences.at(-1)!.key}`
              : null);
        return {
          ...state,
          snapshot,
          selectedSignalId,
          signalIndex,
          signalDraft,
          selectedRecordId,
          selectedTrajectoryId,
          selectedPreferenceKey,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectSignal: (signalId) =>
      set((state) => ({
        ...state,
        selectedSignalId: signalId,
        signalIndex:
          signalId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.signals.findIndex(
                  (signal) => signal.id === signalId,
                ) ?? 0,
              ),
      })),
    setSignalIndex: (index) =>
      set((state) => ({
        ...state,
        signalIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedSignalId:
          state.snapshot?.signals[Math.max(0, index)]?.id ?? null,
      })),
    moveSignalIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.signals.length ?? 0;
        const nextIndex = clampSignalIndex(state.signalIndex + delta, total);
        return {
          ...state,
          signalIndex: nextIndex,
          selectedSignalId:
            state.snapshot?.signals[nextIndex]?.id ?? null,
        };
      }),
    setSignalDraftKind: (kind) =>
      set((state) => ({
        ...state,
        signalDraft: { ...state.signalDraft, kind },
      })),
    setSignalDraftScope: (scope) =>
      set((state) => ({
        ...state,
        signalDraft: { ...state.signalDraft, scope },
      })),
    toggleSignalDraftEvidence: (evidenceId) =>
      set((state) => ({
        ...state,
        signalDraft: {
          ...state.signalDraft,
          evidenceIds: state.signalDraft.evidenceIds.includes(evidenceId)
            ? state.signalDraft.evidenceIds.filter((entry) => entry !== evidenceId)
            : [...state.signalDraft.evidenceIds, evidenceId],
        },
      })),
    selectRecord: (recordId) =>
      set((state) => ({ ...state, selectedRecordId: recordId })),
    selectTrajectory: (trajectoryId) =>
      set((state) => ({ ...state, selectedTrajectoryId: trajectoryId })),
    selectPreference: (preferenceKey) =>
      set((state) => ({ ...state, selectedPreferenceKey: preferenceKey })),
    setLastReplay: (replay) =>
      set((state) => ({ ...state, lastReplay: replay })),

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
 * 多 workspace 分屏由 learningStudioRegistry 提供 per-workspace 实例。
 */
export const useLearningPaneStore = createLearningPaneStore();
