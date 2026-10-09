// YOU Capture Studio — Capture 表面视图状态 store（W2B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：evidence/capture/consent 的 canonical
// truth 属于 evidence 应用服务；本 store 只持有**投影/视图状态**（面板、引导步骤光标、
// 选中记录、demo 进度）。快照是服务端事实的只读副本，由 useCaptureStudio 写入。
// 跟随 W1B solutionStore 的本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { CaptureStudioSnapshot } from "./captureController.js";
import { clampGuideStepIndex } from "./captureStudioProjection.js";
import type { CaptureDemoStepOutcome } from "./captureStudioDemo.js";

export type CapturePanelId =
  | "requests"
  | "capture"
  | "review"
  | "consent"
  | "upload"
  | "demo";

export type CaptureSurfaceStatus = "idle" | "loading" | "ready" | "error";

export interface CaptureDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly CaptureDemoStepOutcome[];
}

export interface CapturePaneState {
  readonly status: CaptureSurfaceStatus;
  readonly errorMessage: string | null;
  /** 最近一次操作级错误（inline 呈现；表面整体不被单次操作失败拖垮）。 */
  readonly actionError: string | null;
  readonly snapshot: CaptureStudioSnapshot | null;
  readonly panel: CapturePanelId;
  /** 引导采集当前查看的会话 id；null = 未选中。 */
  readonly activeCaptureSessionId: string | null;
  /** 引导步骤键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly guideStepIndex: number;
  /** 评审面板选中的证据记录 id；null = 未选中。 */
  readonly selectedEvidenceRecordId: string | null;
  readonly demo: CaptureDemoState;
}

export interface CapturePaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: CaptureStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (message: string) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: CaptureStudioSnapshot) => void;
  setPanel: (panel: CapturePanelId) => void;
  setActiveCaptureSession: (sessionId: string | null) => void;
  setGuideStepIndex: (index: number) => void;
  moveGuideStep: (delta: number) => void;
  selectEvidenceRecord: (evidenceId: string | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: CaptureDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type CapturePaneStore = CapturePaneState & CapturePaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type CapturePaneStoreApi = UseBoundStore<StoreApi<CapturePaneStore>>;

const INITIAL_DEMO_STATE: CaptureDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const CAPTURE_PANE_INITIAL_STATE: CapturePaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "requests",
  activeCaptureSessionId: null,
  guideStepIndex: 0,
  selectedEvidenceRecordId: null,
  demo: INITIAL_DEMO_STATE,
};

export function createCapturePaneStore() {
  return create<CapturePaneStore>()((set) => ({
    ...CAPTURE_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 新会话加载后默认选中最新会话/证据（确定性：追加序末位）。
        activeCaptureSessionId: snapshot.captureSessions.at(-1)?.id ?? null,
        selectedEvidenceRecordId: snapshot.evidenceRecords.at(-1)?.id ?? null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (message) =>
      set((state) => ({ ...state, actionError: message })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新时保持「已选中对象仍存在」的语义；被清除的对象回退到末位。
        const activeCaptureSessionId =
          snapshot.captureSessions.some(
            (session) => session.id === state.activeCaptureSessionId,
          )
            ? state.activeCaptureSessionId
            : (snapshot.captureSessions.at(-1)?.id ?? null);
        const selectedEvidenceRecordId = snapshot.evidenceRecords.some(
          (record) => record.id === state.selectedEvidenceRecordId,
        )
          ? state.selectedEvidenceRecordId
          : (snapshot.evidenceRecords.at(-1)?.id ?? null);
        return { ...state, snapshot, activeCaptureSessionId, selectedEvidenceRecordId };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    setActiveCaptureSession: (sessionId) =>
      set((state) => ({
        ...state,
        activeCaptureSessionId: sessionId,
        guideStepIndex: 0,
      })),
    setGuideStepIndex: (index) =>
      set((state) => ({
        ...state,
        guideStepIndex: Math.max(0, index),
      })),
    moveGuideStep: (delta) =>
      set((state) => {
        const session = state.snapshot?.captureSessions.find(
          (candidate) => candidate.id === state.activeCaptureSessionId,
        );
        return {
          ...state,
          guideStepIndex: clampGuideStepIndex(
            state.guideStepIndex + delta,
            session?.guideSteps.length ?? 0,
          ),
        };
      }),
    selectEvidenceRecord: (evidenceId) =>
      set((state) => ({ ...state, selectedEvidenceRecordId: evidenceId })),

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
 * 多 workspace 分屏由 captureStudioRegistry 提供 per-workspace 实例。
 */
export const useCapturePaneStore = createCapturePaneStore();
