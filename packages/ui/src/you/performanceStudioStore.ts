// YOU Performance Studio — Performance 表面视图状态 store（W4B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：performance/render 的 canonical
// truth 属于 performance/render 应用服务（W4A）；本 store 只持有**投影/视图状态**
// （面板、选中性能/模板/作业/artifact、参数与时间线草稿、渲染提交草稿、demo 进度）。
// 快照是服务端事实的只读副本，由 usePerformanceStudio 写入。跟随 W1B/W2B/W3B 的
// 本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { PerformanceStudioSnapshot } from "./performanceController.js";
import { clampPerformanceIndex } from "./performanceStudioProjection.js";
import type { RenderSubmitDraft } from "./performanceStudioProjection.js";
import type { TimelineDraft } from "./performanceTimelineDraftModel.js";
import type { PerformanceDemoStepOutcome } from "./performanceStudioDemo.js";

export type PerformancePanelId =
  | "timeline"
  | "templates"
  | "jobs"
  | "review"
  | "demo";

export type PerformanceSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_TIMELINE_INVALID / YOU_RENDER_UNSUPPORTED /
 *  YOU_RENDER_ARTIFACT_NOT_FOUND 等 code 驱动专属错误面板文案）。 */
export interface PerformanceActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface PerformanceDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly PerformanceDemoStepOutcome[];
}

export interface PerformancePaneState {
  readonly status: PerformanceSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: PerformanceActionError | null;
  readonly snapshot: PerformanceStudioSnapshot | null;
  readonly panel: PerformancePanelId;
  /** 当前检视的性能 id；null = 未选中（列表自动回退末位）。 */
  readonly selectedPerformanceId: string | null;
  /** 性能列表键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly performanceIndex: number;
  /** 模板挑选（templates 面板）。 */
  readonly selectedTemplateId: string | null;
  /** 模板参数草稿（plain typed record；编辑即写入）。 */
  readonly templateParameterDraft: Readonly<Record<string, string | number | boolean>>;
  /** 时间线草稿（null = 未编辑；编辑经 publishPerformance 提交新不可变性能）。 */
  readonly timelineDraft: TimelineDraft | null;
  /** 渲染提交草稿（method + outputKinds + params）。 */
  readonly renderDraft: RenderSubmitDraft;
  /** 当前检视的作业 id；null = 未选中（回退末位）。 */
  readonly selectedJobId: string | null;
  /** 当前检视的 artifact id；null = 未选中。 */
  readonly selectedArtifactId: string | null;
  readonly demo: PerformanceDemoState;
}

export interface PerformancePaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: PerformanceStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: PerformanceActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: PerformanceStudioSnapshot) => void;
  setPanel: (panel: PerformancePanelId) => void;
  selectPerformance: (performanceId: string | null) => void;
  setPerformanceIndex: (index: number) => void;
  movePerformanceIndex: (delta: number) => void;
  selectTemplate: (templateId: string | null) => void;
  /** 整体重设参数草稿（选模板时带入默认参数）。 */
  setTemplateParameterDraft: (
    draft: Readonly<Record<string, string | number | boolean>>,
  ) => void;
  /** 单键写入（plain typed record 编辑）。 */
  setTemplateParameter: (key: string, value: string | number | boolean) => void;
  startTimelineDraft: (draft: TimelineDraft) => void;
  /** 草稿确定性操作结果整体替换（shift/end/add/remove 纯函数产出）。 */
  replaceTimelineDraft: (draft: TimelineDraft) => void;
  discardTimelineDraft: () => void;
  setRenderDraft: (draft: RenderSubmitDraft) => void;
  selectJob: (jobId: string | null) => void;
  selectArtifact: (artifactId: string | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: PerformanceDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type PerformancePaneStore = PerformancePaneState & PerformancePaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type PerformancePaneStoreApi = UseBoundStore<StoreApi<PerformancePaneStore>>;

const INITIAL_DEMO_STATE: PerformanceDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const PERFORMANCE_PANE_INITIAL_STATE: PerformancePaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "timeline",
  selectedPerformanceId: null,
  performanceIndex: 0,
  selectedTemplateId: null,
  templateParameterDraft: {},
  timelineDraft: null,
  renderDraft: { method: null, outputKinds: [], parameters: {} },
  selectedJobId: null,
  selectedArtifactId: null,
  demo: INITIAL_DEMO_STATE,
};

export function createPerformancePaneStore() {
  return create<PerformancePaneStore>()((set) => ({
    ...PERFORMANCE_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新性能（确定性：追加序末位）；模板默认第一条。
        selectedPerformanceId: snapshot.performances.at(-1)?.id ?? null,
        performanceIndex: Math.max(0, snapshot.performances.length - 1),
        selectedTemplateId: snapshot.templates[0]?.id ?? null,
        templateParameterDraft: { ...snapshot.templates[0]?.parameters },
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) =>
      set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedPerformanceId = snapshot.performances.some(
          (performance) => performance.id === state.selectedPerformanceId,
        )
          ? state.selectedPerformanceId
          : (snapshot.performances.at(-1)?.id ?? null);
        const performanceIndex = snapshot.performances.some(
          (performance) => performance.id === selectedPerformanceId,
        )
          ? Math.max(
              0,
              snapshot.performances.findIndex(
                (performance) => performance.id === selectedPerformanceId,
              ),
            )
          : Math.max(0, snapshot.performances.length - 1);
        const selectedTemplateId = snapshot.templates.some(
          (template) => template.id === state.selectedTemplateId,
        )
          ? state.selectedTemplateId
          : (snapshot.templates[0]?.id ?? null);
        const selectedJobId = snapshot.jobs.some((job) => job.spec.id === state.selectedJobId)
          ? state.selectedJobId
          : (snapshot.jobs.at(-1)?.spec.id ?? null);
        return {
          ...state,
          snapshot,
          selectedPerformanceId,
          performanceIndex,
          selectedTemplateId,
          selectedJobId,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    selectPerformance: (performanceId) =>
      set((state) => ({
        ...state,
        selectedPerformanceId: performanceId,
        performanceIndex:
          performanceId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.performances.findIndex(
                  (performance) => performance.id === performanceId,
                ) ?? 0,
              ),
      })),
    setPerformanceIndex: (index) =>
      set((state) => ({
        ...state,
        performanceIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedPerformanceId:
          state.snapshot?.performances[Math.max(0, index)]?.id ?? null,
      })),
    movePerformanceIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.performances.length ?? 0;
        const nextIndex = clampPerformanceIndex(state.performanceIndex + delta, total);
        return {
          ...state,
          performanceIndex: nextIndex,
          selectedPerformanceId:
            state.snapshot?.performances[nextIndex]?.id ?? null,
        };
      }),

    selectTemplate: (templateId) =>
      set((state) => {
        const template = state.snapshot?.templates.find(
          (candidate) => candidate.id === templateId,
        );
        return {
          ...state,
          selectedTemplateId: templateId,
          // 挑选模板即带入默认参数（plain typed record 拷贝）。
          templateParameterDraft: { ...template?.parameters },
        };
      }),
    setTemplateParameterDraft: (draft) =>
      set((state) => ({ ...state, templateParameterDraft: { ...draft } })),
    setTemplateParameter: (key, value) =>
      set((state) => ({
        ...state,
        templateParameterDraft: { ...state.templateParameterDraft, [key]: value },
      })),

    startTimelineDraft: (draft) => set((state) => ({ ...state, timelineDraft: draft })),
    replaceTimelineDraft: (draft) =>
      set((state) => ({ ...state, timelineDraft: draft })),
    discardTimelineDraft: () =>
      set((state) => ({ ...state, timelineDraft: null })),

    setRenderDraft: (draft) => set((state) => ({ ...state, renderDraft: draft })),

    selectJob: (jobId) => set((state) => ({ ...state, selectedJobId: jobId })),
    selectArtifact: (artifactId) =>
      set((state) => ({ ...state, selectedArtifactId: artifactId })),

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
 * 多 workspace 分屏由 performanceStudioRegistry 提供 per-workspace 实例。
 */
export const usePerformancePaneStore = createPerformancePaneStore();
