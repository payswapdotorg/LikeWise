// YOU Solution Studio — Solution 表面视图状态 store（W1B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：canonical Solution truth 属于 Solution
// 应用服务；本 store 只持有**投影/视图状态**（selection、compare 目标、模式、相机、
// demo 进度）。快照（snapshot）是服务端事实的只读副本，由 useSolutionSurface 写入。
// 跟随 packages/ui/src/store 的本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { SolutionSelector } from "@zcode/shared";
import type { SolutionSurfaceSnapshot } from "./solutionController.js";
import {
  orbitSolutionCamera,
  panSolutionCamera,
  resetSolutionCamera,
  zoomSolutionCamera,
  type SolutionCameraState,
} from "./solutionProjection.js";
import type { SolutionDemoStepOutcome } from "./solutionDemo.js";

export type SolutionPanelId =
  | "viewport"
  | "inspector"
  | "feedback"
  | "compare"
  | "export"
  | "takeover"
  | "demo";

export type SolutionSurfaceStatus = "idle" | "loading" | "ready" | "error";

export interface SolutionDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly SolutionDemoStepOutcome[];
}

export interface SolutionPaneState {
  readonly status: SolutionSurfaceStatus;
  readonly errorMessage: string | null;
  readonly snapshot: SolutionSurfaceSnapshot | null;
  readonly panel: SolutionPanelId;
  readonly selection: SolutionSelector | null;
  readonly compareVersionId: string | null;
  readonly mode: "view" | "edit";
  readonly camera: SolutionCameraState;
  readonly showRegions: boolean;
  readonly showQuality: boolean;
  readonly demo: SolutionDemoState;
}

export interface SolutionPaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: SolutionSurfaceSnapshot) => void;
  loadFailed: (message: string) => void;
  applySnapshot: (snapshot: SolutionSurfaceSnapshot) => void;
  setPanel: (panel: SolutionPanelId) => void;
  setSelection: (selection: SolutionSelector | null) => void;
  setCompareVersionId: (versionId: string | null) => void;
  setMode: (mode: "view" | "edit") => void;
  orbitCamera: (deltaYaw: number, deltaPitch: number) => void;
  panCamera: (deltaX: number, deltaY: number) => void;
  zoomCamera: (factor: number) => void;
  resetCamera: () => void;
  toggleRegions: () => void;
  toggleQuality: () => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: SolutionDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type SolutionPaneStore = SolutionPaneState & SolutionPaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type SolutionPaneStoreApi = UseBoundStore<StoreApi<SolutionPaneStore>>;

const INITIAL_DEMO_STATE: SolutionDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const SOLUTION_PANE_INITIAL_STATE: SolutionPaneState = {
  status: "idle",
  errorMessage: null,
  snapshot: null,
  panel: "viewport",
  selection: null,
  compareVersionId: null,
  mode: "view",
  camera: resetSolutionCamera(),
  showRegions: false,
  showQuality: true,
  demo: INITIAL_DEMO_STATE,
};

export function createSolutionPaneStore() {
  return create<SolutionPaneStore>()((set) => ({
    ...SOLUTION_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 新会话加载后，compare 默认指向倒数第二个版本（有则选中）。
        compareVersionId: snapshot.versions.length > 1
          ? (snapshot.versions.at(-2)?.id ?? null)
          : null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    applySnapshot: (snapshot) => set((state) => ({ ...state, snapshot })),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    setSelection: (selection) => set((state) => ({ ...state, selection })),
    setCompareVersionId: (versionId) =>
      set((state) => ({ ...state, compareVersionId: versionId })),
    setMode: (mode) => set((state) => ({ ...state, mode })),

    orbitCamera: (deltaYaw, deltaPitch) =>
      set((state) => ({ ...state, camera: orbitSolutionCamera(state.camera, deltaYaw, deltaPitch) })),
    panCamera: (deltaX, deltaY) =>
      set((state) => ({ ...state, camera: panSolutionCamera(state.camera, deltaX, deltaY) })),
    zoomCamera: (factor) =>
      set((state) => ({ ...state, camera: zoomSolutionCamera(state.camera, factor) })),
    resetCamera: () => set((state) => ({ ...state, camera: resetSolutionCamera() })),

    toggleRegions: () => set((state) => ({ ...state, showRegions: !state.showRegions })),
    toggleQuality: () => set((state) => ({ ...state, showQuality: !state.showQuality })),

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
 * 默认全局 store：单 workspace 壳的便捷入口（与其它 ui store 的单例模式一致）。
 * 多 workspace 分屏由 solutionSurfaceRegistry 提供 per-workspace 实例。
 */
export const useSolutionPaneStore = createSolutionPaneStore();
