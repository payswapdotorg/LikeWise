// YOU Twin Studio — Twin 表面视图状态 store（W3B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：twin/reconstruction 的 canonical
// truth 属于 twin 应用服务（W3A）；本 store 只持有**投影/视图状态**（面板、选中
// 版本、对比目标与模式、demo 进度）。快照是服务端事实的只读副本，由 useTwinStudio
// 写入。跟随 W1B/W2B 的本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { TwinStudioSnapshot } from "./twinController.js";
import { clampVersionIndex } from "./twinStudioProjection.js";
import type { TwinDemoStepOutcome } from "./twinStudioDemo.js";

export type TwinPanelId =
  | "versions"
  | "quality"
  | "compare"
  | "remediation"
  | "reconstruction"
  | "demo";

export type TwinSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 对比模式：side-by-side（并排）或 delta（差值聚焦）。 */
export type TwinCompareMode = "side-by-side" | "delta";

export interface TwinDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly TwinDemoStepOutcome[];
}

export interface TwinPaneState {
  readonly status: TwinSurfaceStatus;
  readonly errorMessage: string | null;
  /** 最近一次操作级错误（inline 呈现；表面整体不被单次操作失败拖垮）。 */
  readonly actionError: string | null;
  readonly snapshot: TwinStudioSnapshot | null;
  readonly panel: TwinPanelId;
  /** 当前检视的版本 id；null = 未选中（版本面板自动回退 canonical/末位）。 */
  readonly selectedVersionId: string | null;
  /** 版本列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly versionIndex: number;
  /** 对比基线版本 id；null = 未选择。 */
  readonly compareBaseVersionId: string | null;
  /** 对比目标版本 id；null = 未选择。 */
  readonly compareTargetVersionId: string | null;
  readonly compareMode: TwinCompareMode;
  readonly demo: TwinDemoState;
}

export interface TwinPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: TwinStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (message: string) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: TwinStudioSnapshot) => void;
  setPanel: (panel: TwinPanelId) => void;
  selectVersion: (versionId: string | null) => void;
  setVersionIndex: (index: number) => void;
  moveVersionIndex: (delta: number) => void;
  setCompareBase: (versionId: string | null) => void;
  setCompareTarget: (versionId: string | null) => void;
  setCompareMode: (mode: TwinCompareMode) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: TwinDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type TwinPaneStore = TwinPaneState & TwinPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type TwinPaneStoreApi = UseBoundStore<StoreApi<TwinPaneStore>>;

const INITIAL_DEMO_STATE: TwinDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const TWIN_PANE_INITIAL_STATE: TwinPaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "versions",
  selectedVersionId: null,
  versionIndex: 0,
  compareBaseVersionId: null,
  compareTargetVersionId: null,
  compareMode: "delta",
  demo: INITIAL_DEMO_STATE,
};

export function createTwinPaneStore() {
  return create<TwinPaneStore>()((set) => ({
    ...TWIN_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新版本（确定性：追加序末位）；对比默认 v1 vs 最新。
        selectedVersionId: snapshot.versions.at(-1)?.id ?? null,
        versionIndex: Math.max(0, snapshot.versions.length - 1),
        compareBaseVersionId: snapshot.versions[0]?.id ?? null,
        compareTargetVersionId: snapshot.versions.at(-1)?.id ?? null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (message) =>
      set((state) => ({ ...state, actionError: message })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新时保持「已选中对象仍存在」的语义；被清除的对象回退到末位。
        const selectedVersionId = snapshot.versions.some(
          (version) => version.id === state.selectedVersionId,
        )
          ? state.selectedVersionId
          : (snapshot.versions.at(-1)?.id ?? null);
        const versionIndex = snapshot.versions.some(
          (version) => version.id === selectedVersionId,
        )
          ? Math.max(
              0,
              snapshot.versions.findIndex((version) => version.id === selectedVersionId),
            )
          : Math.max(0, snapshot.versions.length - 1);
        return {
          ...state,
          snapshot,
          selectedVersionId,
          versionIndex,
          compareBaseVersionId: snapshot.versions.some(
            (version) => version.id === state.compareBaseVersionId,
          )
            ? state.compareBaseVersionId
            : (snapshot.versions[0]?.id ?? null),
          compareTargetVersionId: snapshot.versions.some(
            (version) => version.id === state.compareTargetVersionId,
          )
            ? state.compareTargetVersionId
            : (snapshot.versions.at(-1)?.id ?? null),
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectVersion: (versionId) =>
      set((state) => ({
        ...state,
        selectedVersionId: versionId,
        versionIndex:
          versionId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.versions.findIndex((version) => version.id === versionId) ?? 0,
              ),
      })),
    setVersionIndex: (index) =>
      set((state) => ({
        ...state,
        versionIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedVersionId: state.snapshot?.versions[Math.max(0, index)]?.id ?? null,
      })),
    moveVersionIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.versions.length ?? 0;
        const nextIndex = clampVersionIndex(state.versionIndex + delta, total);
        return {
          ...state,
          versionIndex: nextIndex,
          selectedVersionId: state.snapshot?.versions[nextIndex]?.id ?? null,
        };
      }),
    setCompareBase: (versionId) =>
      set((state) => ({ ...state, compareBaseVersionId: versionId })),
    setCompareTarget: (versionId) =>
      set((state) => ({ ...state, compareTargetVersionId: versionId })),
    setCompareMode: (mode) => set((state) => ({ ...state, compareMode: mode })),

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
      set((state) => ({ ...state, demo: { ...state.demo, active: false, finished: true } })),
    demoReset: () => set((state) => ({ ...state, demo: INITIAL_DEMO_STATE })),
  }));
}

/**
 * 默认全局 store：单 workspace 壳的便捷入口（与 solutionStore 单例模式一致）。
 * 多 workspace 分屏由 twinStudioRegistry 提供 per-workspace 实例。
 */
export const useTwinPaneStore = createTwinPaneStore();
