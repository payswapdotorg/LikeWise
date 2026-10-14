// YOU Release Studio — Release 表面视图状态 store（W12B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：launch-gate 的 canonical truth
// 属于 Worker A 的 launch-gate authority 服务（W12A）与 Worker C 的
// gate-evidence 服务（W12C）；本 store 只持有**投影/视图状态**（面板、各平面
// 挑选与检视、demo 进度）。快照是服务端事实的只读副本，由 useReleaseStudio
// 写入。跟随 W1B–W11B 的本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ReleaseStudioSnapshot } from "./releaseController.js";
import { clampReleaseIndex } from "./releaseStudioProjection.js";
import type { ReleaseDemoStepOutcome } from "./releaseStudioDemo.js";

export type ReleasePanelId =
  | "checklist"
  | "signoff"
  | "declaration"
  | "demo";

export type ReleaseSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_LAUNCH_GATE_INVALID /
 *  YOU_OPERATOR_SIGNOFF_INVALID / YOU_RELEASE_DECLARATION_INVALID 等 code 驱动
 *  专属错误面板文案）。 */
export interface ReleaseActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface ReleaseDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly ReleaseDemoStepOutcome[];
}

export interface ReleasePaneState {
  readonly status: ReleaseSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: ReleaseActionError | null;
  readonly snapshot: ReleaseStudioSnapshot | null;
  readonly panel: ReleasePanelId;
  /** launch-gate check 草稿挑选的 journey id。 */
  readonly checklistDraftJourneyId: string;
  /** 当前检视的 checklist 记录 id；null = 未选中（回退末位）。 */
  readonly selectedChecklistId: string | null;
  /** checklist 记录键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly checklistIndex: number;
  /** signoff 草稿挑选的 operator id。 */
  readonly signoffDraftOperatorId: string;
  /** 当前检视的 signoff 记录 id；null = 未选中（回退末位）。 */
  readonly selectedSignoffId: string | null;
  /** declaration 草稿挑选的 evidence bundle id。 */
  readonly declarationDraftEvidenceBundleId: string;
  /** declaration 草稿挑选的 rollback evidence id。 */
  readonly declarationDraftRollbackEvidenceId: string;
  /** 当前检视的 declaration 记录 id；null = 未选中（回退末位）。 */
  readonly selectedDeclarationId: string | null;
  readonly demo: ReleaseDemoState;
}

export interface ReleasePaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: ReleaseStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: ReleaseActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: ReleaseStudioSnapshot) => void;
  setPanel: (panel: ReleasePanelId) => void;
  setChecklistDraftJourney: (journeyId: string) => void;
  selectChecklist: (checklistId: string | null) => void;
  setChecklistIndex: (index: number) => void;
  moveChecklistIndex: (delta: number) => void;
  setSignoffDraftOperator: (operatorId: string) => void;
  selectSignoff: (signoffId: string | null) => void;
  setDeclarationDraftEvidenceBundle: (bundleId: string) => void;
  setDeclarationDraftRollbackEvidence: (rollbackId: string) => void;
  selectDeclaration: (declarationId: string | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: ReleaseDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type ReleasePaneStore = ReleasePaneState & ReleasePaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type ReleasePaneStoreApi = UseBoundStore<
  StoreApi<ReleasePaneStore>
>;

const INITIAL_DEMO_STATE: ReleaseDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const RELEASE_PANE_INITIAL_STATE: ReleasePaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "checklist",
  checklistDraftJourneyId: "journey-gate-golden",
  selectedChecklistId: null,
  checklistIndex: 0,
  signoffDraftOperatorId: "operator-aria",
  selectedSignoffId: null,
  declarationDraftEvidenceBundleId: "bundle-golden-journey-set",
  declarationDraftRollbackEvidenceId: "rollback-dr-verified",
  selectedDeclarationId: null,
  demo: INITIAL_DEMO_STATE,
};

export function createReleasePaneStore() {
  return create<ReleasePaneStore>()((set) => ({
    ...RELEASE_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新记录（确定性：id 升序末位）。
        selectedChecklistId: snapshot.checklists.at(-1)?.id ?? null,
        checklistIndex: Math.max(0, snapshot.checklists.length - 1),
        selectedSignoffId: snapshot.signoffs.at(-1)?.id ?? null,
        selectedDeclarationId: snapshot.declarations.at(-1)?.id ?? null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) => set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedChecklistId = snapshot.checklists.some(
          (entry) => entry.id === state.selectedChecklistId,
        )
          ? state.selectedChecklistId
          : (snapshot.checklists.at(-1)?.id ?? null);
        const checklistIndex = snapshot.checklists.some(
          (entry) => entry.id === selectedChecklistId,
        )
          ? Math.max(
              0,
              snapshot.checklists.findIndex(
                (entry) => entry.id === selectedChecklistId,
              ),
            )
          : Math.max(0, snapshot.checklists.length - 1);
        const selectedSignoffId = snapshot.signoffs.some(
          (entry) => entry.id === state.selectedSignoffId,
        )
          ? state.selectedSignoffId
          : (snapshot.signoffs.at(-1)?.id ?? null);
        const selectedDeclarationId = snapshot.declarations.some(
          (entry) => entry.id === state.selectedDeclarationId,
        )
          ? state.selectedDeclarationId
          : (snapshot.declarations.at(-1)?.id ?? null);
        // 草稿保持仍合法的挑选（注册面缺失时回退初始）。
        const checklistDraftJourneyId = snapshot.journeys.some(
          (entry) => entry.id === state.checklistDraftJourneyId,
        )
          ? state.checklistDraftJourneyId
          : RELEASE_PANE_INITIAL_STATE.checklistDraftJourneyId;
        const signoffDraftOperatorId = snapshot.operators.some(
          (entry) => entry.id === state.signoffDraftOperatorId,
        )
          ? state.signoffDraftOperatorId
          : RELEASE_PANE_INITIAL_STATE.signoffDraftOperatorId;
        const declarationDraftEvidenceBundleId =
          snapshot.evidenceBundles.some(
            (entry) => entry.id === state.declarationDraftEvidenceBundleId,
          )
            ? state.declarationDraftEvidenceBundleId
            : RELEASE_PANE_INITIAL_STATE.declarationDraftEvidenceBundleId;
        const declarationDraftRollbackEvidenceId =
          snapshot.rollbackEvidence.some(
            (entry) => entry.id === state.declarationDraftRollbackEvidenceId,
          )
            ? state.declarationDraftRollbackEvidenceId
            : RELEASE_PANE_INITIAL_STATE.declarationDraftRollbackEvidenceId;
        return {
          ...state,
          snapshot,
          selectedChecklistId,
          checklistIndex,
          selectedSignoffId,
          selectedDeclarationId,
          checklistDraftJourneyId,
          signoffDraftOperatorId,
          declarationDraftEvidenceBundleId,
          declarationDraftRollbackEvidenceId,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    setChecklistDraftJourney: (journeyId) =>
      set((state) => ({ ...state, checklistDraftJourneyId: journeyId })),
    selectChecklist: (checklistId) =>
      set((state) => ({
        ...state,
        selectedChecklistId: checklistId,
        checklistIndex:
          checklistId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.checklists.findIndex(
                  (entry) => entry.id === checklistId,
                ) ?? 0,
              ),
      })),
    setChecklistIndex: (index) =>
      set((state) => ({
        ...state,
        checklistIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedChecklistId:
          state.snapshot?.checklists[Math.max(0, index)]?.id ?? null,
      })),
    moveChecklistIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.checklists.length ?? 0;
        const nextIndex = clampReleaseIndex(
          state.checklistIndex + delta,
          total,
        );
        return {
          ...state,
          checklistIndex: nextIndex,
          selectedChecklistId:
            state.snapshot?.checklists[nextIndex]?.id ?? null,
        };
      }),
    setSignoffDraftOperator: (operatorId) =>
      set((state) => ({ ...state, signoffDraftOperatorId: operatorId })),
    selectSignoff: (signoffId) =>
      set((state) => ({ ...state, selectedSignoffId: signoffId })),
    setDeclarationDraftEvidenceBundle: (bundleId) =>
      set((state) => ({
        ...state,
        declarationDraftEvidenceBundleId: bundleId,
      })),
    setDeclarationDraftRollbackEvidence: (rollbackId) =>
      set((state) => ({
        ...state,
        declarationDraftRollbackEvidenceId: rollbackId,
      })),
    selectDeclaration: (declarationId) =>
      set((state) => ({ ...state, selectedDeclarationId: declarationId })),

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
    demoReset: () =>
      set((state) => ({ ...state, demo: INITIAL_DEMO_STATE })),
  }));
}

/**
 * 默认全局 store：单 workspace 壳的便捷入口（与 solutionStore 单例模式一致）。
 * 多 workspace 分屏由 releaseStudioRegistry 提供 per-workspace 实例。
 */
export const useReleasePaneStore = createReleasePaneStore();
