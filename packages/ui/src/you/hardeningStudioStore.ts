// YOU Hardening Studio — Hardening 表面视图状态 store（W10B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：hardening 的 canonical truth
// 属于 Worker A 的 platform hardening 服务（W10A）与 Worker C 的 ecosystem
// hardening 服务（W10C）；本 store 只持有**投影/视图状态**（面板、各平面挑选与
// 检视、demo 进度）。快照是服务端事实的只读副本，由 useHardeningStudio 写入。
// 跟随 W1B–W9B 的本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { HardeningStudioSnapshot } from "./hardeningController.js";
import { clampHardeningIndex } from "./hardeningStudioProjection.js";
import type { HardeningDemoStepOutcome } from "./hardeningStudioDemo.js";

export type HardeningPanelId =
  | "limits"
  | "imports"
  | "retention"
  | "dr"
  | "release"
  | "demo";

export type HardeningSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_RATE_LIMIT_EXCEEDED /
 *  YOU_IMPORT_QUARANTINED / YOU_RETENTION_ENFORCEMENT_INVALID /
 *  YOU_DR_RESTORE_INVALID / YOU_PROVIDER_MATRIX_INVALID /
 *  YOU_PRODUCTION_ELIGIBILITY_INVALID 等 code 驱动专属错误面板文案）。 */
export interface HardeningActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface HardeningDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly HardeningDemoStepOutcome[];
}

export interface HardeningPaneState {
  readonly status: HardeningSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: HardeningActionError | null;
  readonly snapshot: HardeningStudioSnapshot | null;
  readonly panel: HardeningPanelId;
  /** rate-limit enforce 草稿挑选的 policy id。 */
  readonly limitDraftPolicyId: string;
  /** enforcement 记录键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly enforcementIndex: number;
  /** 当前检视的 enforcement 记录 id；null = 未选中（回退末位）。 */
  readonly selectedEnforcementId: string | null;
  /** import 扫描草稿挑选的 artifact id。 */
  readonly importDraftArtifactId: string;
  /** import 扫描草稿挑选的 scan class id。 */
  readonly importDraftScanClassId: string;
  /** 当前检视的 import verdict id；null = 未选中（回退末位）。 */
  readonly selectedImportVerdictId: string | null;
  /** retention enforce 草稿挑选的 subject id。 */
  readonly retentionDraftSubjectId: string;
  /** retention enforce 草稿挑选的 class id。 */
  readonly retentionDraftClassId: string;
  /** 当前检视的 retention 记录 id；null = 未选中（回退末位）。 */
  readonly selectedRetentionRecordId: string | null;
  /** DR restore 草稿挑选的 snapshot id。 */
  readonly drDraftSnapshotId: string;
  /** DR restore 草稿的 integrity 挑选（honest / corrupted——诚实路径）。 */
  readonly drIntegrity: "honest" | "corrupted";
  /** 当前检视的 DR restore 记录 id；null = 未选中（回退末位）。 */
  readonly selectedDrRestoreId: string | null;
  /** eligibility 决定草稿挑选的 matrix entry id。 */
  readonly releaseDraftMatrixId: string;
  /** eligibility 决定草稿挑选的 rollback evidence id。 */
  readonly releaseDraftEvidenceId: string;
  /** eligibility 决定草稿的意图（eligible / blocked）。 */
  readonly releaseDraftEligible: boolean;
  /** 当前检视的 eligibility 记录 id；null = 未选中（回退末位）。 */
  readonly selectedEligibilityRecordId: string | null;
  readonly demo: HardeningDemoState;
}

export interface HardeningPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: HardeningStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: HardeningActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: HardeningStudioSnapshot) => void;
  setPanel: (panel: HardeningPanelId) => void;
  setLimitDraftPolicy: (policyId: string) => void;
  setEnforcementIndex: (index: number) => void;
  moveEnforcementIndex: (delta: number) => void;
  selectEnforcement: (enforcementId: string | null) => void;
  setImportDraftArtifact: (artifactId: string) => void;
  setImportDraftScanClass: (scanClassId: string) => void;
  selectImportVerdict: (verdictId: string | null) => void;
  setRetentionDraftSubject: (subjectId: string) => void;
  setRetentionDraftClass: (classId: string) => void;
  selectRetentionRecord: (recordId: string | null) => void;
  setDrDraftSnapshot: (snapshotId: string) => void;
  setDrIntegrity: (integrity: "honest" | "corrupted") => void;
  selectDrRestore: (restoreId: string | null) => void;
  setReleaseDraftMatrix: (matrixEntryId: string) => void;
  setReleaseDraftEvidence: (evidenceId: string) => void;
  setReleaseDraftEligible: (eligible: boolean) => void;
  selectEligibilityRecord: (recordId: string | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: HardeningDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type HardeningPaneStore = HardeningPaneState & HardeningPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type HardeningPaneStoreApi = UseBoundStore<StoreApi<HardeningPaneStore>>;

const INITIAL_DEMO_STATE: HardeningDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const HARDENING_PANE_INITIAL_STATE: HardeningPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "limits",
  limitDraftPolicyId: "policy-render-submit",
  enforcementIndex: 0,
  selectedEnforcementId: null,
  importDraftArtifactId: "import-artifact-portrait",
  importDraftScanClassId: "scan-class-media-upload",
  selectedImportVerdictId: null,
  retentionDraftSubjectId: "subject-evidence-granted",
  retentionDraftClassId: "retention-class-evidence-raw",
  selectedRetentionRecordId: null,
  drDraftSnapshotId: "dr-snapshot-primary",
  drIntegrity: "honest",
  selectedDrRestoreId: null,
  releaseDraftMatrixId: "matrix-render-eu",
  releaseDraftEvidenceId: "rollback-evidence-none",
  releaseDraftEligible: true,
  selectedEligibilityRecordId: null,
  demo: INITIAL_DEMO_STATE,
};

export function createHardeningPaneStore() {
  return create<HardeningPaneStore>()((set) => ({
    ...HARDENING_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新 enforcement（确定性：追加序末位）。
        enforcementIndex: Math.max(0, snapshot.enforcements.length - 1),
        selectedEnforcementId: snapshot.enforcements.at(-1)?.id ?? null,
        selectedImportVerdictId:
          snapshot.importVerdictRecords.at(-1)?.verdict.id ?? null,
        selectedRetentionRecordId: snapshot.retentionRecords.at(-1)?.id ?? null,
        selectedDrRestoreId: snapshot.drRestores.at(-1)?.record.id ?? null,
        selectedEligibilityRecordId:
          snapshot.eligibilityLedger.at(-1)?.record.id ?? null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) => set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedEnforcementId = snapshot.enforcements.some(
          (entry) => entry.id === state.selectedEnforcementId,
        )
          ? state.selectedEnforcementId
          : (snapshot.enforcements.at(-1)?.id ?? null);
        const enforcementIndex = snapshot.enforcements.some(
          (entry) => entry.id === selectedEnforcementId,
        )
          ? Math.max(
              0,
              snapshot.enforcements.findIndex(
                (entry) => entry.id === selectedEnforcementId,
              ),
            )
          : Math.max(0, snapshot.enforcements.length - 1);
        const selectedImportVerdictId = snapshot.importVerdictRecords.some(
          (entry) => entry.verdict.id === state.selectedImportVerdictId,
        )
          ? state.selectedImportVerdictId
          : (snapshot.importVerdictRecords.at(-1)?.verdict.id ?? null);
        const selectedRetentionRecordId = snapshot.retentionRecords.some(
          (entry) => entry.id === state.selectedRetentionRecordId,
        )
          ? state.selectedRetentionRecordId
          : (snapshot.retentionRecords.at(-1)?.id ?? null);
        const selectedDrRestoreId = snapshot.drRestores.some(
          (entry) => entry.record.id === state.selectedDrRestoreId,
        )
          ? state.selectedDrRestoreId
          : (snapshot.drRestores.at(-1)?.record.id ?? null);
        const selectedEligibilityRecordId = snapshot.eligibilityLedger.some(
          (entry) => entry.record.id === state.selectedEligibilityRecordId,
        )
          ? state.selectedEligibilityRecordId
          : (snapshot.eligibilityLedger.at(-1)?.record.id ?? null);
        // 草稿保持仍合法的挑选（注册面缺失时回退初始）。
        const limitDraftPolicyId = snapshot.policies.some(
          (entry) => entry.id === state.limitDraftPolicyId,
        )
          ? state.limitDraftPolicyId
          : HARDENING_PANE_INITIAL_STATE.limitDraftPolicyId;
        const importDraftArtifactId = snapshot.importArtifacts.some(
          (entry) => entry.id === state.importDraftArtifactId,
        )
          ? state.importDraftArtifactId
          : HARDENING_PANE_INITIAL_STATE.importDraftArtifactId;
        const importDraftScanClassId = snapshot.scanClasses.some(
          (entry) => entry.id === state.importDraftScanClassId,
        )
          ? state.importDraftScanClassId
          : HARDENING_PANE_INITIAL_STATE.importDraftScanClassId;
        const retentionDraftSubjectId = snapshot.retentionSubjects.some(
          (entry) => entry.id === state.retentionDraftSubjectId,
        )
          ? state.retentionDraftSubjectId
          : HARDENING_PANE_INITIAL_STATE.retentionDraftSubjectId;
        const retentionDraftClassId = snapshot.retentionClasses.some(
          (entry) => entry.id === state.retentionDraftClassId,
        )
          ? state.retentionDraftClassId
          : HARDENING_PANE_INITIAL_STATE.retentionDraftClassId;
        const drDraftSnapshotId = snapshot.drSnapshots.some(
          (entry) => entry.id === state.drDraftSnapshotId,
        )
          ? state.drDraftSnapshotId
          : HARDENING_PANE_INITIAL_STATE.drDraftSnapshotId;
        const releaseDraftMatrixId = snapshot.matrixEntries.some(
          (entry) => entry.id === state.releaseDraftMatrixId,
        )
          ? state.releaseDraftMatrixId
          : HARDENING_PANE_INITIAL_STATE.releaseDraftMatrixId;
        const releaseDraftEvidenceId = snapshot.rollbackEvidence.some(
          (entry) => entry.id === state.releaseDraftEvidenceId,
        )
          ? state.releaseDraftEvidenceId
          : HARDENING_PANE_INITIAL_STATE.releaseDraftEvidenceId;
        return {
          ...state,
          snapshot,
          selectedEnforcementId,
          enforcementIndex,
          selectedImportVerdictId,
          selectedRetentionRecordId,
          selectedDrRestoreId,
          selectedEligibilityRecordId,
          limitDraftPolicyId,
          importDraftArtifactId,
          importDraftScanClassId,
          retentionDraftSubjectId,
          retentionDraftClassId,
          drDraftSnapshotId,
          releaseDraftMatrixId,
          releaseDraftEvidenceId,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    setLimitDraftPolicy: (policyId) =>
      set((state) => ({ ...state, limitDraftPolicyId: policyId })),
    setEnforcementIndex: (index) =>
      set((state) => ({
        ...state,
        enforcementIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedEnforcementId:
          state.snapshot?.enforcements[Math.max(0, index)]?.id ?? null,
      })),
    moveEnforcementIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.enforcements.length ?? 0;
        const nextIndex = clampHardeningIndex(
          state.enforcementIndex + delta,
          total,
        );
        return {
          ...state,
          enforcementIndex: nextIndex,
          selectedEnforcementId:
            state.snapshot?.enforcements[nextIndex]?.id ?? null,
        };
      }),
    selectEnforcement: (enforcementId) =>
      set((state) => ({
        ...state,
        selectedEnforcementId: enforcementId,
        enforcementIndex:
          enforcementId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.enforcements.findIndex(
                  (entry) => entry.id === enforcementId,
                ) ?? 0,
              ),
      })),
    setImportDraftArtifact: (artifactId) =>
      set((state) => ({ ...state, importDraftArtifactId: artifactId })),
    setImportDraftScanClass: (scanClassId) =>
      set((state) => ({ ...state, importDraftScanClassId: scanClassId })),
    selectImportVerdict: (verdictId) =>
      set((state) => ({ ...state, selectedImportVerdictId: verdictId })),
    setRetentionDraftSubject: (subjectId) =>
      set((state) => ({ ...state, retentionDraftSubjectId: subjectId })),
    setRetentionDraftClass: (classId) =>
      set((state) => ({ ...state, retentionDraftClassId: classId })),
    selectRetentionRecord: (recordId) =>
      set((state) => ({ ...state, selectedRetentionRecordId: recordId })),
    setDrDraftSnapshot: (snapshotId) =>
      set((state) => ({ ...state, drDraftSnapshotId: snapshotId })),
    setDrIntegrity: (integrity) =>
      set((state) => ({ ...state, drIntegrity: integrity })),
    selectDrRestore: (restoreId) =>
      set((state) => ({ ...state, selectedDrRestoreId: restoreId })),
    setReleaseDraftMatrix: (matrixEntryId) =>
      set((state) => ({ ...state, releaseDraftMatrixId: matrixEntryId })),
    setReleaseDraftEvidence: (evidenceId) =>
      set((state) => ({ ...state, releaseDraftEvidenceId: evidenceId })),
    setReleaseDraftEligible: (eligible) =>
      set((state) => ({ ...state, releaseDraftEligible: eligible })),
    selectEligibilityRecord: (recordId) =>
      set((state) => ({ ...state, selectedEligibilityRecordId: recordId })),

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
 * 多 workspace 分屏由 hardeningStudioRegistry 提供 per-workspace 实例。
 */
export const useHardeningPaneStore = createHardeningPaneStore();
