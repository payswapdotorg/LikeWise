// YOU Lab Studio — Lab 表面视图状态 store（W9B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：lab 的 canonical truth 属于
// Worker A 的 lab 持久化服务（W9A）；本 store 只持有**投影/视图状态**（面板、
// 选中实验/run/manifest/promotion、声明草稿、run 草稿、晋升草稿、demo 进度）。
// 快照是服务端事实的只读副本，由 useLabStudio 写入。跟随 W1B–W8B 的本地模式
// （zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { LabArmKind } from "@zcode/shared";
import type { LabStudioSnapshot } from "./labController.js";
import { clampLabIndex } from "./labStudioProjection.js";
import type { LabDemoStepOutcome } from "./labStudioDemo.js";

export type LabPanelId =
  | "experiments"
  | "runs"
  | "evidence"
  | "promotion"
  | "demo";

export type LabSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_LAB_RUN_NOT_FOUND /
 *  YOU_LAB_EXPERIMENT_NOT_FOUND / YOU_LAB_EVIDENCE_MANIFEST_INVALID /
 *  YOU_LAB_PROMOTION_INVALID / YOU_LAB_WORLD_INVALID /
 *  YOU_SEARCH_LADDER_INVALID 等 code 驱动专属错误面板文案）。 */
export interface LabActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface LabDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly LabDemoStepOutcome[];
}

/** 实验声明草稿（spec + 世界预设 + 预算预设挑选的展开形态——store 级纯视图状态）。 */
export interface LabExperimentDraft {
  readonly specId: string | null;
  readonly worldPresetId: string;
  readonly budgetPresetId: string;
}

export const LAB_EXPERIMENT_DRAFT_INITIAL: LabExperimentDraft = {
  specId: null,
  worldPresetId: "world-alpha",
  budgetPresetId: "budget-standard",
};

/** run 提交草稿（臂挑选；实验取当前选中实验）。 */
export interface LabRunDraft {
  readonly arm: LabArmKind;
}

/** 晋升草稿（候选臂 + 证据 manifest 挑选）。 */
export interface LabPromotionDraft {
  readonly candidateArm: LabArmKind | null;
  readonly evidenceManifestId: string | null;
}

export const LAB_PROMOTION_DRAFT_INITIAL: LabPromotionDraft = {
  candidateArm: "searched",
  evidenceManifestId: null,
};

export interface LabPaneState {
  readonly status: LabSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: LabActionError | null;
  readonly snapshot: LabStudioSnapshot | null;
  readonly panel: LabPanelId;
  /** 当前检视的实验 id；null = 未选中（列表自动回退末位）。 */
  readonly selectedExperimentId: string | null;
  /** 实验列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly experimentIndex: number;
  /** 声明草稿挑选的规格 id；null = 未挑选。 */
  readonly selectedSpecId: string | null;
  /** 声明草稿的世界预设挑选。 */
  readonly worldPresetDraftId: string;
  /** 声明草稿的预算预设挑选。 */
  readonly budgetPresetDraftId: string;
  /** 当前检视的 run id（runs 面板）；null = 未选中（回退末位）。 */
  readonly selectedRunId: string | null;
  /** run 提交草稿的臂挑选。 */
  readonly runDraftArm: LabArmKind;
  /** manifest 完整性挑选（honest / tampered——与 W8B 过期预设同款诚实路径）。 */
  readonly manifestIntegrity: "honest" | "tampered";
  /** 当前检视的 manifest id；null = 未选中（回退末位）。 */
  readonly selectedManifestId: string | null;
  /** 晋升草稿。 */
  readonly promotionDraft: LabPromotionDraft;
  readonly demo: LabDemoState;
}

export interface LabPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: LabStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: LabActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: LabStudioSnapshot) => void;
  setPanel: (panel: LabPanelId) => void;
  selectExperiment: (experimentId: string | null) => void;
  setExperimentIndex: (index: number) => void;
  moveExperimentIndex: (delta: number) => void;
  selectSpec: (specId: string | null) => void;
  setDraftWorldPreset: (presetId: string) => void;
  setDraftBudgetPreset: (presetId: string) => void;
  resetExperimentDraft: () => void;
  selectRun: (runId: string | null) => void;
  setRunDraftArm: (arm: LabArmKind) => void;
  setManifestIntegrity: (integrity: "honest" | "tampered") => void;
  selectManifest: (manifestId: string | null) => void;
  setPromotionCandidateArm: (arm: LabArmKind | null) => void;
  setPromotionEvidence: (manifestId: string | null) => void;
  resetPromotionDraft: () => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: LabDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type LabPaneStore = LabPaneState & LabPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type LabPaneStoreApi = UseBoundStore<StoreApi<LabPaneStore>>;

const INITIAL_DEMO_STATE: LabDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

const INITIAL_RUN_DRAFT: LabRunDraft = {
  arm: "searched",
};

export const LAB_PANE_INITIAL_STATE: LabPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "experiments",
  selectedExperimentId: null,
  experimentIndex: 0,
  selectedSpecId: null,
  worldPresetDraftId: "world-alpha",
  budgetPresetDraftId: "budget-standard",
  runDraftArm: INITIAL_RUN_DRAFT.arm,
  manifestIntegrity: "honest",
  selectedManifestId: null,
  selectedRunId: null,
  promotionDraft: LAB_PROMOTION_DRAFT_INITIAL,
  demo: INITIAL_DEMO_STATE,
};

export function createLabPaneStore() {
  return create<LabPaneStore>()((set) => ({
    ...LAB_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新实验（确定性：追加序末位）；规格默认注册面首项。
        selectedExperimentId: snapshot.experiments.at(-1)?.id ?? null,
        experimentIndex: Math.max(0, snapshot.experiments.length - 1),
        selectedSpecId: snapshot.experimentSpecs[0]?.id ?? null,
        selectedRunId: snapshot.runs.at(-1)?.id ?? null,
        selectedManifestId: snapshot.manifests.at(-1)?.manifest.id ?? null,
        promotionDraft: {
          ...state.promotionDraft,
          evidenceManifestId: snapshot.manifests.at(-1)?.manifest.id ?? null,
        },
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) => set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedExperimentId = snapshot.experiments.some(
          (experiment) => experiment.id === state.selectedExperimentId,
        )
          ? state.selectedExperimentId
          : (snapshot.experiments.at(-1)?.id ?? null);
        const experimentIndex = snapshot.experiments.some(
          (experiment) => experiment.id === selectedExperimentId,
        )
          ? Math.max(
              0,
              snapshot.experiments.findIndex(
                (experiment) => experiment.id === selectedExperimentId,
              ),
            )
          : Math.max(0, snapshot.experiments.length - 1);
        const selectedSpecId = snapshot.experimentSpecs.some(
          (spec) => spec.id === state.selectedSpecId,
        )
          ? state.selectedSpecId
          : (snapshot.experimentSpecs[0]?.id ?? null);
        const worldPresetDraftId = snapshot.worldPresets.some(
          (preset) => preset.id === state.worldPresetDraftId,
        )
          ? state.worldPresetDraftId
          : LAB_EXPERIMENT_DRAFT_INITIAL.worldPresetId;
        const budgetPresetDraftId = snapshot.budgetPresets.some(
          (preset) => preset.id === state.budgetPresetDraftId,
        )
          ? state.budgetPresetDraftId
          : LAB_EXPERIMENT_DRAFT_INITIAL.budgetPresetId;
        const selectedRunId = snapshot.runs.some((run) => run.id === state.selectedRunId)
          ? state.selectedRunId
          : (snapshot.runs.at(-1)?.id ?? null);
        const selectedManifestId = snapshot.manifests.some(
          (entry) => entry.manifest.id === state.selectedManifestId,
        )
          ? state.selectedManifestId
          : (snapshot.manifests.at(-1)?.manifest.id ?? null);
        // 草稿保持仍合法的挑选（预设不在注册面时回退初始）。
        const promotionDraft = {
          ...state.promotionDraft,
          evidenceManifestId: snapshot.manifests.some(
            (entry) => entry.manifest.id === state.promotionDraft.evidenceManifestId,
          )
            ? state.promotionDraft.evidenceManifestId
            : (snapshot.manifests.at(-1)?.manifest.id ?? null),
        };
        return {
          ...state,
          snapshot,
          selectedExperimentId,
          experimentIndex,
          selectedSpecId,
          worldPresetDraftId,
          budgetPresetDraftId,
          selectedRunId,
          selectedManifestId,
          promotionDraft,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectExperiment: (experimentId) =>
      set((state) => ({
        ...state,
        selectedExperimentId: experimentId,
        experimentIndex:
          experimentId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.experiments.findIndex(
                  (experiment) => experiment.id === experimentId,
                ) ?? 0,
              ),
      })),
    setExperimentIndex: (index) =>
      set((state) => ({
        ...state,
        experimentIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedExperimentId:
          state.snapshot?.experiments[Math.max(0, index)]?.id ?? null,
      })),
    moveExperimentIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.experiments.length ?? 0;
        const nextIndex = clampLabIndex(state.experimentIndex + delta, total);
        return {
          ...state,
          experimentIndex: nextIndex,
          selectedExperimentId:
            state.snapshot?.experiments[nextIndex]?.id ?? null,
        };
      }),
    selectSpec: (specId) => set((state) => ({ ...state, selectedSpecId: specId })),
    setDraftWorldPreset: (presetId) =>
      set((state) => ({ ...state, worldPresetDraftId: presetId })),
    setDraftBudgetPreset: (presetId) =>
      set((state) => ({ ...state, budgetPresetDraftId: presetId })),
    resetExperimentDraft: () =>
      set((state) => ({
        ...state,
        selectedSpecId: state.snapshot?.experimentSpecs[0]?.id ?? null,
        worldPresetDraftId: LAB_EXPERIMENT_DRAFT_INITIAL.worldPresetId,
        budgetPresetDraftId: LAB_EXPERIMENT_DRAFT_INITIAL.budgetPresetId,
      })),
    selectRun: (runId) => set((state) => ({ ...state, selectedRunId: runId })),
    setRunDraftArm: (arm) => set((state) => ({ ...state, runDraftArm: arm })),
    setManifestIntegrity: (integrity) =>
      set((state) => ({ ...state, manifestIntegrity: integrity })),
    selectManifest: (manifestId) =>
      set((state) => ({ ...state, selectedManifestId: manifestId })),
    setPromotionCandidateArm: (arm) =>
      set((state) => ({
        ...state,
        promotionDraft: { ...state.promotionDraft, candidateArm: arm },
      })),
    setPromotionEvidence: (manifestId) =>
      set((state) => ({
        ...state,
        promotionDraft: { ...state.promotionDraft, evidenceManifestId: manifestId },
      })),
    resetPromotionDraft: () =>
      set((state) => ({
        ...state,
        promotionDraft: {
          ...LAB_PROMOTION_DRAFT_INITIAL,
          evidenceManifestId: state.snapshot?.manifests.at(-1)?.manifest.id ?? null,
        },
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
 * 多 workspace 分屏由 labStudioRegistry 提供 per-workspace 实例。
 */
export const useLabPaneStore = createLabPaneStore();
