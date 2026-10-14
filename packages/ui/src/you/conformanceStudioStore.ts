// YOU Conformance Studio — Conformance 表面视图状态 store（W11B）。
//
// 边界（docs/you/CONTRACTS.md state ownership）：hardening-verification 的
// canonical truth 属于 Worker A 的 security authority 服务（W11A）与 Worker C 的
// E2E runbook 服务（W11C）；本 store 只持有**投影/视图状态**（面板、各平面挑选
// 与检视、demo 进度）。快照是服务端事实的只读副本，由 useConformanceStudio
// 写入。跟随 W1B–W10B 的本地模式（zustand create + 纯转移函数）。
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { ConformanceStudioSnapshot } from "./conformanceController.js";
import { clampConformanceIndex } from "./conformanceStudioProjection.js";
import type { ConformanceDemoStepOutcome } from "./conformanceStudioDemo.js";

export type ConformancePanelId =
  | "review"
  | "load"
  | "conformance"
  | "journey"
  | "runbook"
  | "demo";

export type ConformanceSurfaceStatus = "idle" | "loading" | "ready" | "error";

/** 操作级 typed 错误（inline 呈现；YOU_SECURITY_REVIEW_INVALID /
 *  YOU_LOAD_TEST_INVALID / YOU_CONFORMANCE_AUDIT_INVALID /
 *  YOU_E2E_JOURNEY_INVALID / YOU_RUNBOOK_INVALID 等 code 驱动专属错误面板
 *  文案）。 */
export interface ConformanceActionError {
  /** YouErrorCode 字面（typed error panel 的分类键）；非 typed 错误为 "UNEXPECTED"。 */
  readonly code: string;
  readonly message: string;
}

export interface ConformanceDemoState {
  readonly active: boolean;
  /** 下一步要执行的步骤索引（0-based）。 */
  readonly stepIndex: number;
  readonly finished: boolean;
  readonly outcomes: readonly ConformanceDemoStepOutcome[];
}

export interface ConformancePaneState {
  readonly status: ConformanceSurfaceStatus;
  readonly errorMessage: string | null;
  readonly actionError: ConformanceActionError | null;
  readonly snapshot: ConformanceStudioSnapshot | null;
  readonly panel: ConformancePanelId;
  /** review record 草稿挑选的 scope id。 */
  readonly reviewDraftScopeId: string;
  /** 当前检视的 review 账本条目 id；null = 未选中（回退末位）。 */
  readonly selectedReviewId: string | null;
  /** load-test 草稿挑选的 scenario id。 */
  readonly loadDraftScenarioId: string;
  /** load-test 草稿的指标来源（measured / simulated / invented——诚实路径）。 */
  readonly loadDraftMetricsSource: "measured" | "simulated" | "invented";
  /** 当前检视的 load test 报告 id；null = 未选中（回退末位）。 */
  readonly selectedLoadReportId: string | null;
  /** audit 草稿挑选的 standard id。 */
  readonly auditDraftStandardId: string;
  /** audit 草稿的结果意图（full / partial）。 */
  readonly auditDraftOutcome: "full" | "partial";
  /** 当前检视的 audit 记录 id；null = 未选中（回退末位）。 */
  readonly selectedAuditId: string | null;
  /** journey 草稿挑选的 journey id。 */
  readonly journeyDraftId: string;
  /** journey 草稿的失败步意图（null = 完整 20 点跑；1..20 = 失败于该步）。 */
  readonly journeyDraftFailAtStep: number | null;
  /** journey 草稿的 run 种类（measured / simulated——诚实路径）。 */
  readonly journeyDraftRunKind: "measured" | "simulated";
  /** journey run 记录键盘光标（0-based；夹紧在 [0, total-1]）。 */
  readonly journeyIndex: number;
  /** 当前检视的 journey run 记录 id；null = 未选中（回退末位）。 */
  readonly selectedJourneyRunId: string | null;
  /** runbook 演练草稿挑选的 incident class id。 */
  readonly runbookDraftIncidentClassId: string;
  /** runbook 演练草稿的路径（failure-injection / exercise-claim——诚实路径）。 */
  readonly runbookDraftVia: "failure-injection" | "exercise-claim";
  /** 当前检视的 runbook 账本条目 id；null = 未选中（回退末位）。 */
  readonly selectedRunbookEntryId: string | null;
  readonly demo: ConformanceDemoState;
}

export interface ConformancePaneActions {
  beginLoad: () => void;
  loadSucceeded: (snapshot: ConformanceStudioSnapshot) => void;
  loadFailed: (message: string) => void;
  /** 操作级 typed 错误（action 失败 inline 呈现；status 保持 ready）。 */
  actionFailed: (error: ConformanceActionError) => void;
  clearActionError: () => void;
  applySnapshot: (snapshot: ConformanceStudioSnapshot) => void;
  setPanel: (panel: ConformancePanelId) => void;
  setReviewDraftScope: (scopeId: string) => void;
  selectReview: (reviewId: string | null) => void;
  setLoadDraftScenario: (scenarioId: string) => void;
  setLoadDraftMetricsSource: (
    source: "measured" | "simulated" | "invented",
  ) => void;
  selectLoadReport: (reportId: string | null) => void;
  setAuditDraftStandard: (standardId: string) => void;
  setAuditDraftOutcome: (outcome: "full" | "partial") => void;
  selectAudit: (auditId: string | null) => void;
  setJourneyDraft: (journeyId: string) => void;
  setJourneyDraftFailAtStep: (failAtStep: number | null) => void;
  setJourneyDraftRunKind: (runKind: "measured" | "simulated") => void;
  setJourneyIndex: (index: number) => void;
  moveJourneyIndex: (delta: number) => void;
  selectJourneyRun: (runId: string | null) => void;
  setRunbookDraftIncidentClass: (incidentClassId: string) => void;
  setRunbookDraftVia: (
    via: "failure-injection" | "exercise-claim",
  ) => void;
  selectRunbookEntry: (entryId: string | null) => void;
  demoStarted: () => void;
  demoStepRecorded: (outcome: ConformanceDemoStepOutcome) => void;
  demoFinished: () => void;
  demoReset: () => void;
}

export type ConformancePaneStore = ConformancePaneState & ConformancePaneActions;

/** store 实例类型（registry / binding 持有）。 */
export type ConformancePaneStoreApi = UseBoundStore<
  StoreApi<ConformancePaneStore>
>;

const INITIAL_DEMO_STATE: ConformanceDemoState = {
  active: false,
  stepIndex: 0,
  finished: false,
  outcomes: [],
};

export const CONFORMANCE_PANE_INITIAL_STATE: ConformancePaneState = {
  status: "idle",
  errorMessage: null,
  actionError: null,
  snapshot: null,
  panel: "review",
  reviewDraftScopeId: "review-scope-evidence-plane",
  selectedReviewId: null,
  loadDraftScenarioId: "load-scenario-render-peak",
  loadDraftMetricsSource: "simulated",
  selectedLoadReportId: null,
  auditDraftStandardId: "standard-wcag-aa",
  auditDraftOutcome: "partial",
  selectedAuditId: null,
  journeyDraftId: "journey-launch-gate",
  journeyDraftFailAtStep: null,
  journeyDraftRunKind: "simulated",
  journeyIndex: 0,
  selectedJourneyRunId: null,
  runbookDraftIncidentClassId: "incident-render-provider-outage",
  runbookDraftVia: "failure-injection",
  selectedRunbookEntryId: null,
  demo: INITIAL_DEMO_STATE,
};

export function createConformancePaneStore() {
  return create<ConformancePaneStore>()((set) => ({
    ...CONFORMANCE_PANE_INITIAL_STATE,

    beginLoad: () =>
      set((state) => ({ ...state, status: "loading", errorMessage: null })),
    loadSucceeded: (snapshot) =>
      set((state) => ({
        ...state,
        status: "ready",
        errorMessage: null,
        snapshot,
        // 加载后默认检视最新记录（确定性：追加序 / id 升序末位）。
        selectedReviewId: snapshot.reviews.at(-1)?.record.id ?? null,
        selectedLoadReportId: snapshot.loadReports.at(-1)?.id ?? null,
        selectedAuditId: snapshot.audits.at(-1)?.id ?? null,
        journeyIndex: Math.max(0, snapshot.journeyRuns.length - 1),
        selectedJourneyRunId: snapshot.journeyRuns.at(-1)?.record.id ?? null,
        selectedRunbookEntryId: snapshot.runbook.at(-1)?.record.id ?? null,
      })),
    loadFailed: (message) =>
      set((state) => ({ ...state, status: "error", errorMessage: message })),
    actionFailed: (error) => set((state) => ({ ...state, actionError: error })),
    clearActionError: () => set((state) => ({ ...state, actionError: null })),
    applySnapshot: (snapshot) =>
      set((state) => {
        // 快照刷新保持「已选中对象仍存在」的语义；被清除的对象回退末位。
        const selectedReviewId = snapshot.reviews.some(
          (entry) => entry.record.id === state.selectedReviewId,
        )
          ? state.selectedReviewId
          : (snapshot.reviews.at(-1)?.record.id ?? null);
        const selectedLoadReportId = snapshot.loadReports.some(
          (entry) => entry.id === state.selectedLoadReportId,
        )
          ? state.selectedLoadReportId
          : (snapshot.loadReports.at(-1)?.id ?? null);
        const selectedAuditId = snapshot.audits.some(
          (entry) => entry.id === state.selectedAuditId,
        )
          ? state.selectedAuditId
          : (snapshot.audits.at(-1)?.id ?? null);
        const selectedJourneyRunId = snapshot.journeyRuns.some(
          (entry) => entry.record.id === state.selectedJourneyRunId,
        )
          ? state.selectedJourneyRunId
          : (snapshot.journeyRuns.at(-1)?.record.id ?? null);
        const journeyIndex = snapshot.journeyRuns.some(
          (entry) => entry.record.id === selectedJourneyRunId,
        )
          ? Math.max(
              0,
              snapshot.journeyRuns.findIndex(
                (entry) => entry.record.id === selectedJourneyRunId,
              ),
            )
          : Math.max(0, snapshot.journeyRuns.length - 1);
        const selectedRunbookEntryId = snapshot.runbook.some(
          (entry) => entry.record.id === state.selectedRunbookEntryId,
        )
          ? state.selectedRunbookEntryId
          : (snapshot.runbook.at(-1)?.record.id ?? null);
        // 草稿保持仍合法的挑选（注册面缺失时回退初始）。
        const reviewDraftScopeId = snapshot.reviewScopes.some(
          (entry) => entry.id === state.reviewDraftScopeId,
        )
          ? state.reviewDraftScopeId
          : CONFORMANCE_PANE_INITIAL_STATE.reviewDraftScopeId;
        const loadDraftScenarioId = snapshot.loadScenarios.some(
          (entry) => entry.id === state.loadDraftScenarioId,
        )
          ? state.loadDraftScenarioId
          : CONFORMANCE_PANE_INITIAL_STATE.loadDraftScenarioId;
        const auditDraftStandardId = snapshot.standards.some(
          (entry) => entry.id === state.auditDraftStandardId,
        )
          ? state.auditDraftStandardId
          : CONFORMANCE_PANE_INITIAL_STATE.auditDraftStandardId;
        const journeyDraftId = snapshot.journeys.some(
          (entry) => entry.id === state.journeyDraftId,
        )
          ? state.journeyDraftId
          : CONFORMANCE_PANE_INITIAL_STATE.journeyDraftId;
        const runbookDraftIncidentClassId = snapshot.incidentClasses.some(
          (entry) => entry.id === state.runbookDraftIncidentClassId,
        )
          ? state.runbookDraftIncidentClassId
          : CONFORMANCE_PANE_INITIAL_STATE.runbookDraftIncidentClassId;
        return {
          ...state,
          snapshot,
          selectedReviewId,
          selectedLoadReportId,
          selectedAuditId,
          selectedJourneyRunId,
          journeyIndex,
          selectedRunbookEntryId,
          reviewDraftScopeId,
          loadDraftScenarioId,
          auditDraftStandardId,
          journeyDraftId,
          runbookDraftIncidentClassId,
        };
      }),

    setPanel: (panel) => set((state) => ({ ...state, panel })),
    setReviewDraftScope: (scopeId) =>
      set((state) => ({ ...state, reviewDraftScopeId: scopeId })),
    selectReview: (reviewId) =>
      set((state) => ({ ...state, selectedReviewId: reviewId })),
    setLoadDraftScenario: (scenarioId) =>
      set((state) => ({ ...state, loadDraftScenarioId: scenarioId })),
    setLoadDraftMetricsSource: (source) =>
      set((state) => ({ ...state, loadDraftMetricsSource: source })),
    selectLoadReport: (reportId) =>
      set((state) => ({ ...state, selectedLoadReportId: reportId })),
    setAuditDraftStandard: (standardId) =>
      set((state) => ({ ...state, auditDraftStandardId: standardId })),
    setAuditDraftOutcome: (outcome) =>
      set((state) => ({ ...state, auditDraftOutcome: outcome })),
    selectAudit: (auditId) =>
      set((state) => ({ ...state, selectedAuditId: auditId })),
    setJourneyDraft: (journeyId) =>
      set((state) => ({ ...state, journeyDraftId: journeyId })),
    setJourneyDraftFailAtStep: (failAtStep) =>
      set((state) => ({ ...state, journeyDraftFailAtStep: failAtStep })),
    setJourneyDraftRunKind: (runKind) =>
      set((state) => ({ ...state, journeyDraftRunKind: runKind })),
    setJourneyIndex: (index) =>
      set((state) => ({
        ...state,
        journeyIndex: Math.max(0, index),
        // 光标移动即检视（键盘导航 = 一等交互路径）。
        selectedJourneyRunId:
          state.snapshot?.journeyRuns[Math.max(0, index)]?.record.id ?? null,
      })),
    moveJourneyIndex: (delta) =>
      set((state) => {
        const total = state.snapshot?.journeyRuns.length ?? 0;
        const nextIndex = clampConformanceIndex(
          state.journeyIndex + delta,
          total,
        );
        return {
          ...state,
          journeyIndex: nextIndex,
          selectedJourneyRunId:
            state.snapshot?.journeyRuns[nextIndex]?.record.id ?? null,
        };
      }),
    selectJourneyRun: (runId) =>
      set((state) => ({
        ...state,
        selectedJourneyRunId: runId,
        journeyIndex:
          runId === null
            ? 0
            : Math.max(
                0,
                state.snapshot?.journeyRuns.findIndex(
                  (entry) => entry.record.id === runId,
                ) ?? 0,
              ),
      })),
    setRunbookDraftIncidentClass: (incidentClassId) =>
      set((state) => ({ ...state, runbookDraftIncidentClassId: incidentClassId })),
    setRunbookDraftVia: (via) =>
      set((state) => ({ ...state, runbookDraftVia: via })),
    selectRunbookEntry: (entryId) =>
      set((state) => ({ ...state, selectedRunbookEntryId: entryId })),

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
 * 多 workspace 分屏由 conformanceStudioRegistry 提供 per-workspace 实例。
 */
export const useConformancePaneStore = createConformancePaneStore();
