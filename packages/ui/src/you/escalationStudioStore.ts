// YOU Escalation Studio — Escalation 表面视图状态 store（W8B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：arena 的 canonical truth 属于
// Worker A 的 arena 权威服务（W8A）；本 store 只持有**投影/视图状态**（面板、
// 选中 gap/escalation/run/授权、授权草稿、policy 草稿、demo 进度）。快照是服务端
// 事实的只读副本，由 useEscalationStudio 写入。跟随 W1B–W7B 的本地模式
// （zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ArenaLearningPermission } from "@zcode/shared";
import type { EscalationStudioSnapshot } from "./escalationController.js";
import {
  clampEscalationIndex,
  type AuthorizationExpiryPresetId,
} from "./escalationStudioProjection.js";
import type { EscalationDemoStepOutcome } from "./escalationStudioDemo.js";

export type EscalationPanelId =
  | "gaps"
  | "gate"
  | "progress"
  | "results"
  | "permissions"
  | "demo";

export type EscalationSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_ESCALATION_NOT_FOUND /
 *  YOU_ESCALATION_STATE_INVALID / YOU_ESCALATION_AUTHORIZATION_REQUIRED /
 *  YOU_ARENA_RUN_NOT_FOUND / YOU_RETRY_POLICY_INVALID /
 *  YOU_ARENA_ADAPTER_UNSUPPORTED / YOU_GAP_PROJECTION_INVALID 等 code 驱动专属
 *  错误面板文案）。 */
export interface EscalationActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface EscalationDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly EscalationDemoStepOutcome[];
}

/** 授权门草稿（scope + expiry 预设 + learning permission 挑选）。 */
export interface EscalationAuthorizationDraft {
  readonly scope: string | null;
  readonly expiryPresetId: AuthorizationExpiryPresetId;
  readonly learningPermission: ArenaLearningPermission | null;
}

export const ESCALATION_AUTHORIZATION_DRAFT_EMPTY: EscalationAuthorizationDraft = {
  scope: null,
  expiryPresetId: "no-expiry",
  learningPermission: null,
};

/** policy 校验草稿（W8A stateless validator 的挑选面）。 */
export interface EscalationPolicyDraft {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly requiresAuthorization: boolean;
}

export interface EscalationPaneState {
  readonly status: EscalationSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: EscalationActionError | null;
  readonly snapshot: EscalationStudioSnapshot | null;
  readonly panel: EscalationPanelId;
  /** 当前检视的 gap id；null = 未选中（列表自动回退末位）。 */
  readonly selectedGapId: string | null;
  /** 当前检视的升级 id；null = 未选中（回退末位）。 */
  readonly selectedEscalationId: string | null;
  /** 升级列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly escalationIndex: number;
  /** record-gap fixture 动作挑选的规格 id；null = 未挑选。 */
  readonly selectedGapSpecId: string | null;
  /** 当前检视的 run id（progress 面板）；null = 未选中（回退末位）。 */
  readonly selectedRunId: string | null;
  /** 授权门草稿。 */
  readonly authorizationDraft: EscalationAuthorizationDraft;
  /** policy 校验草稿。 */
  readonly policyDraft: EscalationPolicyDraft;
  readonly demo: EscalationDemoState;
}

export interface EscalationPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: EscalationStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: EscalationActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: EscalationStudioSnapshot) => void;
  setPanel: (panel: EscalationPanelId) => void;
  selectGap: (gapId: string | null) => void;
  selectEscalation: (escalationId: string | null) => void;
  setEscalationIndex: (index: number) => void;
  moveEscalationIndex: (delta: number) => void;
  selectGapSpec: (specId: string | null) => void;
  selectRun: (runId: string | null) => void;
  setAuthorizationDraftScope: (scope: string | null) => void;
  setAuthorizationDraftExpiry: (presetId: AuthorizationExpiryPresetId) => void;
  setAuthorizationDraftPermission: (
    permission: ArenaLearningPermission | null,
  ) => void;
  resetAuthorizationDraft: () => void;
  setPolicyDraftMaxAttempts: (maxAttempts: number) => void;
  setPolicyDraftBackoffClass: (backoffClass: string) => void;
  setPolicyDraftRequiresAuthorization: (requiresAuthorization: boolean) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: EscalationDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type EscalationPaneStore = EscalationPaneState & EscalationPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type EscalationPaneStoreApi = UseBoundStore<StoreApi<EscalationPaneStore>>;

const INITIAL_DEMO_STATE: EscalationDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

const INITIAL_POLICY_DRAFT: EscalationPolicyDraft = {
  maxAttempts: 3,
  backoffClass: "exponential-jitter",
  requiresAuthorization: true,
};

export const ESCALATION_PANE_INITIAL_STATE: EscalationPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "gaps",
  selectedGapId: null,
  selectedEscalationId: null,
  escalationIndex: 0,
  selectedGapSpecId: null,
  selectedRunId: null,
  authorizationDraft: ESCALATION_AUTHORIZATION_DRAFT_EMPTY,
  policyDraft: INITIAL_POLICY_DRAFT,
  demo: INITIAL_DEMO_STATE,
};

export function createEscalationPaneStore() {
  return create<EscalationPaneStore>()((set) => ({
    ...ESCALATION_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新 gap/升级（确定性：追加序末位）；规格默认注册面首项。
        selectedGapId: snapshot.gaps.at(-1)?.id ?? null,
        selectedEscalationId: snapshot.escalations.at(-1)?.escalationId ?? null,
        escalationIndex: Math.max(0, snapshot.escalations.length - 1),
        selectedGapSpecId: snapshot.gapSpecs[0]?.id ?? null,
        selectedRunId: snapshot.runs.at(-1)?.id ?? null,
        authorizationDraft: ESCALATION_AUTHORIZATION_DRAFT_EMPTY,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) => set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedGapId = snapshot.gaps.some((gap) => gap.id === state.selectedGapId)
          ? state.selectedGapId
          : (snapshot.gaps.at(-1)?.id ?? null);
        const selectedEscalationId = snapshot.escalations.some(
          (escalation) => escalation.escalationId === state.selectedEscalationId,
        )
          ? state.selectedEscalationId
          : (snapshot.escalations.at(-1)?.escalationId ?? null);
        const escalationIndex = snapshot.escalations.some(
          (escalation) => escalation.escalationId === selectedEscalationId,
        )
          ? Math.max(
              0,
              snapshot.escalations.findIndex(
                (escalation) => escalation.escalationId === selectedEscalationId,
              ),
            )
          : Math.max(0, snapshot.escalations.length - 1);
        const selectedGapSpecId = snapshot.gapSpecs.some(
          (spec) => spec.id === state.selectedGapSpecId,
        )
          ? state.selectedGapSpecId
          : (snapshot.gapSpecs[0]?.id ?? null);
        const selectedRunId = snapshot.runs.some((run) => run.id === state.selectedRunId)
          ? state.selectedRunId
          : (snapshot.runs.at(-1)?.id ?? null);
        // 授权草稿保持仍合法的挑选（scope/permission 不在注册面时回退空）。
        const authorizationDraft = {
          ...state.authorizationDraft,
          scope: snapshot.scopePresets.includes(state.authorizationDraft.scope ?? "")
            ? state.authorizationDraft.scope
            : null,
          learningPermission: snapshot.learningPermissions.includes(
            state.authorizationDraft.learningPermission ?? ("none" as const),
          )
            ? state.authorizationDraft.learningPermission
            : null,
        };
        return {
          ...state,
          snapshot,
          selectedGapId,
          selectedEscalationId,
          escalationIndex,
          selectedGapSpecId,
          selectedRunId,
          authorizationDraft,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectGap: (gapId) => set((state) => ({ ...state, selectedGapId: gapId })),
    selectEscalation: (escalationId) =>
      set((state) => ({
        ...state,
        selectedEscalationId: escalationId,
        escalationIndex:
          escalationId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.escalations.findIndex(
                  (escalation) => escalation.escalationId === escalationId,
                ) ?? 0,
              ),
      })),
    setEscalationIndex: (index) =>
      set((state) => ({
        ...state,
        escalationIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedEscalationId:
          state.snapshot?.escalations[Math.max(0, index)]?.escalationId ?? null,
      })),
    moveEscalationIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.escalations.length ?? 0;
        const nextIndex = clampEscalationIndex(state.escalationIndex + delta, total);
        return {
          ...state,
          escalationIndex: nextIndex,
          selectedEscalationId:
            state.snapshot?.escalations[nextIndex]?.escalationId ?? null,
        };
      }),
    selectGapSpec: (specId) => set((state) => ({ ...state, selectedGapSpecId: specId })),
    selectRun: (runId) => set((state) => ({ ...state, selectedRunId: runId })),
    setAuthorizationDraftScope: (scope) =>
      set((state) => ({
        ...state,
        authorizationDraft: { ...state.authorizationDraft, scope },
      })),
    setAuthorizationDraftExpiry: (presetId) =>
      set((state) => ({
        ...state,
        authorizationDraft: { ...state.authorizationDraft, expiryPresetId: presetId },
      })),
    setAuthorizationDraftPermission: (permission) =>
      set((state) => ({
        ...state,
        authorizationDraft: { ...state.authorizationDraft, learningPermission: permission },
      })),
    resetAuthorizationDraft: () =>
      set((state) => ({ ...state, authorizationDraft: ESCALATION_AUTHORIZATION_DRAFT_EMPTY })),
    setPolicyDraftMaxAttempts: (maxAttempts) =>
      set((state) => ({
        ...state,
        policyDraft: { ...state.policyDraft, maxAttempts },
      })),
    setPolicyDraftBackoffClass: (backoffClass) =>
      set((state) => ({
        ...state,
        policyDraft: { ...state.policyDraft, backoffClass },
      })),
    setPolicyDraftRequiresAuthorization: (requiresAuthorization) =>
      set((state) => ({
        ...state,
        policyDraft: { ...state.policyDraft, requiresAuthorization },
      })),

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
 * 多 workspace 分屏由 escalationStudioRegistry 提供 per-workspace 实例。
 */
export const useEscalationPaneStore = createEscalationPaneStore();
