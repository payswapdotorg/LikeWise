/* oxlint-disable eslint(max-lines) -- 视图纯投影是 W11B 五条法则显示面的单一数据模块（review/load/audit/journey/runbook 行 + 步骤状态 + 草稿视图一体；拆分只会按面板撕裂同一投影层）；T11 换绑后随 UI 退役。 */
// YOU Conformance Studio — 视图纯投影（W11B）。
//
// 只做确定性视图数学：security review 行（findings verbatim + acceptance 独立
// 不可变决定的 supersedes 链接——SECURITY REVIEW LAW 的可见面）、load-test 报告
// 行（peak/p99 + simulated-labeled 指示 + regressions verbatim 清单——LOAD
// TEST LAW 的可见面）、conformance audit 行（checks-total / checks-passed
// verbatim——CONFORMANCE LAW 的可见面，绝不 bare pass）、journey run 行（20 点
// 步骤状态 + failed-at 步名 + duration——JOURNEY LAW 的可见面）、runbook 行
//（detection / containment / recovery + exercised / unexercised 状态——RUNBOOK
// LAW 的可见面）、区域 loading/empty 视图模型、键盘转移（与兄弟表面同级的键盘
// 可用性）、各平面草稿视图模型。无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type {
  ConformanceAuditRecord,
  E2eJourneyRecord,
  IncidentRunbookEntry,
  LoadTestReport,
} from "@zcode/shared";
import type {
  ConformanceAcceptanceGateView,
  ConformanceJourneyRunView,
  ConformanceReviewEntry,
  ConformanceRunbookEntryView,
} from "./conformanceController.js";
import {
  storyboardAuditPassState,
  storyboardJourneyStepName,
  storyboardMetricsSourceKind,
} from "./conformanceStoryboardLaws.js";

// ---------------------------------------------------------------------------
// Security review 显示行（SECURITY REVIEW LAW：findings verbatim；acceptance
// 是引用 finding set 的独立不可变新记录）
// ---------------------------------------------------------------------------

export interface ConformanceReviewRow {
  readonly reviewId: string;
  readonly scopeRef: string;
  readonly findingsCount: number;
  readonly kind: "review" | "acceptance";
  readonly accepted: boolean;
  readonly reviewedAt: string;
  /** acceptance → 被接受的 review 记录 id；review → null。 */
  readonly supersedesReviewId: string | null;
  readonly accessibleLabel: string;
}

export function projectConformanceReviewRows(
  entries: readonly ConformanceReviewEntry[],
): readonly ConformanceReviewRow[] {
  return entries.map((entry) => ({
    reviewId: entry.record.id,
    scopeRef: entry.record.scopeRef,
    // SECURITY REVIEW LAW 显示面：findings 计数 verbatim 呈现。
    findingsCount: entry.record.findingsCount,
    kind: entry.kind,
    accepted: entry.record.accepted,
    reviewedAt: entry.record.reviewedAt,
    supersedesReviewId: entry.supersedesReviewId,
    accessibleLabel: `security review ${entry.record.id} on ${entry.record.scopeRef}: ${entry.kind} with ${entry.record.findingsCount} findings verbatim${entry.record.accepted ? ", accepted" : ", not accepted"}${entry.supersedesReviewId !== null ? `, supersedes ${entry.supersedesReviewId}` : ""}, reviewed ${entry.record.reviewedAt}`,
  }));
}

// ---------------------------------------------------------------------------
// Load-test 报告显示行（LOAD TEST LAW：peak/p99 measured 或 simulated-labeled
// —— 绝不 invented；regressions listed verbatim）
// ---------------------------------------------------------------------------

export interface ConformanceLoadReportRow {
  readonly reportId: string;
  readonly scenarioRef: string;
  readonly peakRps: number;
  readonly p99Ms: number;
  readonly regressions: readonly string[];
  /** simulated-labeled 指示器（LOAD TEST LAW 显示面）。 */
  readonly simulatedLabeled: boolean;
  readonly accessibleLabel: string;
}

export function projectConformanceLoadReportRows(
  reports: readonly LoadTestReport[],
): readonly ConformanceLoadReportRow[] {
  return reports.map((report) => ({
    reportId: report.id,
    scenarioRef: report.scenarioRef,
    peakRps: report.peakRps,
    p99Ms: report.p99Ms,
    // regressions listed verbatim——绝不 summarize away。
    regressions: [...report.regressions],
    simulatedLabeled: report.simulated,
    accessibleLabel: `load test report ${report.id} on ${report.scenarioRef}: peak ${report.peakRps} rps, p99 ${report.p99Ms}ms, ${report.simulated ? "simulated-labeled" : "measured"}${report.regressions.length > 0 ? `, regressions: ${report.regressions.join("; ")}` : ", no regressions listed"}`,
  }));
}

/** 指标来源的显示分类（三路：measured / simulated-labeled / invented-refused）。 */
export function projectMetricsSourceKind(
  source: "measured" | "simulated" | "invented",
): "measured" | "simulated-labeled" | "invented-refused" {
  return storyboardMetricsSourceKind(source);
}

// ---------------------------------------------------------------------------
// Conformance audit 显示行（CONFORMANCE LAW：checks-total / checks-passed
// stated verbatim —— 绝不 bare pass）
// ---------------------------------------------------------------------------

export interface ConformanceAuditRow {
  readonly auditId: string;
  readonly standard: string;
  readonly scopeRef: string;
  readonly checksTotal: number;
  readonly checksPassed: number;
  /** counts verbatim 复合（显示面主文案："{passed}/{total}"）。 */
  readonly countsLabel: string;
  /** 派生通过态（次要显示——counts 本身才是 conformance 陈述）。 */
  readonly passState: "all-passed" | "partial" | "none-passed";
  readonly accessibleLabel: string;
}

export function projectConformanceAuditRows(
  audits: readonly ConformanceAuditRecord[],
): readonly ConformanceAuditRow[] {
  return audits.map((audit) => ({
    auditId: audit.id,
    standard: audit.standard,
    scopeRef: audit.scopeRef,
    // CONFORMANCE LAW 显示面：两 counts verbatim 同框——绝不 bare pass。
    checksTotal: audit.checksTotal,
    checksPassed: audit.checksPassed,
    countsLabel: `${audit.checksPassed}/${audit.checksTotal}`,
    passState: storyboardAuditPassState(audit.checksTotal, audit.checksPassed),
    accessibleLabel: `conformance audit ${audit.id} on ${audit.standard} (${audit.scopeRef}): ${audit.checksPassed} of ${audit.checksTotal} checks passed verbatim`,
  }));
}

// ---------------------------------------------------------------------------
// Journey run 显示行 + 步骤状态（JOURNEY LAW：20 点 launch-gate journey 记录
// 每一步 completed 或 failed-at + duration；simulated runs stay labeled）
// ---------------------------------------------------------------------------

export interface ConformanceJourneyRunRow {
  readonly runId: string;
  readonly journeyId: string;
  readonly kind: "golden" | "failure-injection";
  readonly incidentClassRef: string | null;
  readonly stepsCompleted: number;
  readonly failedStep: string | null;
  readonly durationMs: number;
  readonly simulated: boolean;
  /** 20 点步骤状态投影（completed / failed-at / pending）。 */
  readonly steps: readonly ConformanceJourneyStepState[];
  readonly accessibleLabel: string;
}

export interface ConformanceJourneyStepState {
  readonly stepIndex: number;
  readonly stepName: string;
  readonly state: "completed" | "failed" | "pending";
}

/**
 * 单条 run 的 20 点步骤状态投影（纯投影）：前 stepsCompleted 步 completed；
 * failedStep 在场时该步 failed；其余 pending。步骤名来自注册面 20 点表
// （verbatim，绝不猜测）。
 */
export function projectConformanceJourneySteps(
  run: E2eJourneyRecord,
  steps: readonly string[],
): readonly ConformanceJourneyStepState[] {
  return steps.map((stepName, index) => {
    const stepIndex = index + 1;
    let state: ConformanceJourneyStepState["state"] = "pending";
    if (stepIndex <= run.stepsCompleted) {
      state = "completed";
    } else if (run.failedStep !== null && run.failedStep === stepName) {
      state = "failed";
    }
    return { stepIndex, stepName, state };
  });
}

export function projectConformanceJourneyRunRows(
  runs: readonly ConformanceJourneyRunView[],
  steps: readonly string[],
): readonly ConformanceJourneyRunRow[] {
  return runs.map((run) => ({
    runId: run.record.id,
    journeyId: run.record.journeyId,
    kind: run.kind,
    incidentClassRef: run.incidentClassRef,
    stepsCompleted: run.record.stepsCompleted,
    failedStep: run.record.failedStep,
    durationMs: run.record.durationMs,
    simulated: run.record.simulated,
    steps: projectConformanceJourneySteps(run.record, steps),
    accessibleLabel: `journey run ${run.record.id} (${run.record.journeyId}, ${run.kind}${run.incidentClassRef !== null ? ` on ${run.incidentClassRef}` : ""}): ${run.record.stepsCompleted} steps completed${run.record.failedStep !== null ? `, failed at ${run.record.failedStep}` : ", full run"} in ${run.record.durationMs}ms${run.record.simulated ? ", simulated-labeled" : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// Runbook 显示行（RUNBOOK LAW：每个 entry 被 ≥1 条 failure-injection journey
// 演练，或显式标注 unexercised）
// ---------------------------------------------------------------------------

export interface ConformanceRunbookRow {
  readonly entryId: string;
  readonly incidentClass: string;
  readonly detection: string;
  readonly containment: string;
  readonly recovery: string;
  readonly exercised: boolean;
  readonly kind: "registration" | "exercise";
  /** exercise → 被演练的 registration 记录 id；registration → null。 */
  readonly supersedesEntryId: string | null;
  readonly accessibleLabel: string;
}

export function projectConformanceRunbookRows(
  entries: readonly ConformanceRunbookEntryView[],
): readonly ConformanceRunbookRow[] {
  return entries.map((entry) => ({
    entryId: entry.record.id,
    incidentClass: entry.record.incidentClass,
    detection: entry.record.detection,
    containment: entry.record.containment,
    recovery: entry.record.recovery,
    // RUNBOOK LAW 显示面：exercised / unexercised 显式呈现。
    exercised: entry.record.exercised,
    kind: entry.kind,
    supersedesEntryId: entry.supersedesEntryId,
    accessibleLabel: `runbook ${entry.record.id} (${entry.record.incidentClass}, ${entry.kind}${entry.supersedesEntryId !== null ? `, supersedes ${entry.supersedesEntryId}` : ""}): ${entry.record.exercised ? "exercised by a failure-injection journey" : "explicitly marked unexercised"} — detection: ${entry.record.detection}; containment: ${entry.record.containment}; recovery: ${entry.record.recovery}`,
  }));
}

/** runbook 链的 live exercised 状态（追加序末位条目口径——RUNBOOK LAW 显示面）。 */
export function projectRunbookLiveExercised(
  entries: readonly { readonly record: IncidentRunbookEntry }[],
  incidentClass: string,
): boolean {
  const chain = entries.filter(
    (entry) => entry.record.incidentClass === incidentClass,
  );
  return chain.at(-1)?.record.exercised ?? false;
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type ConformanceRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectConformanceListRegionView(
  hasSnapshot: boolean,
  count: number,
): ConformanceRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/…/Hardening 表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type ConformanceListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * journey run 记录列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前记录（检视详情）；
 * - 其余键 no-op。
 */
export function resolveConformanceKeyboardTransition(
  key: string,
  state: { readonly totalJourneyRuns: number },
): ConformanceListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalJourneyRuns };
    case "End":
      return { kind: "move", delta: state.totalJourneyRuns };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** journey 光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampConformanceIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 草稿视图（各平面挑选的纯视图模型）
// ---------------------------------------------------------------------------

export interface ReviewDraftView {
  readonly scopeId: string;
  /** record 按钮禁用原因（null = 可执行）。 */
  readonly disabledReason: "unknown-scope" | null;
  readonly findingsCount: number | null;
  readonly scopeRef: string | null;
}

/** scope 草稿 + 注册面 → record 确认区视图模型。 */
export function projectReviewDraftView(
  draft: { readonly scopeId: string },
  scopes: readonly {
    readonly id: string;
    readonly findingsCount: number;
    readonly scopeRef: string;
  }[],
): ReviewDraftView {
  const scope = scopes.find((entry) => entry.id === draft.scopeId);
  if (!scope) {
    return {
      scopeId: draft.scopeId,
      disabledReason: "unknown-scope",
      findingsCount: null,
      scopeRef: null,
    };
  }
  return {
    scopeId: scope.id,
    disabledReason: null,
    findingsCount: scope.findingsCount,
    scopeRef: scope.scopeRef,
  };
}

export interface LoadDraftView {
  readonly scenarioId: string;
  readonly metricsSource: "measured" | "simulated" | "invented";
  /** run 按钮禁用原因（null = 可执行——invented/measured 是诚实 typed 拒绝
   *  路径，非 UI 禁用：让法则路径可见可测）。 */
  readonly disabledReason: "unknown-scenario" | null;
  readonly peakRps: number | null;
  readonly p99Ms: number | null;
  readonly regressionCount: number | null;
}

/** load-test 草稿 + 注册面 → run 确认区视图模型。 */
export function projectLoadDraftView(
  draft: {
    readonly scenarioId: string;
    readonly metricsSource: "measured" | "simulated" | "invented";
  },
  scenarios: readonly {
    readonly id: string;
    readonly peakRps: number;
    readonly p99Ms: number;
    readonly regressions: readonly string[];
    readonly valid: boolean;
  }[],
): LoadDraftView {
  const scenario = scenarios.find((entry) => entry.id === draft.scenarioId);
  if (!scenario || !scenario.valid) {
    return {
      ...draft,
      disabledReason: "unknown-scenario",
      peakRps: null,
      p99Ms: null,
      regressionCount: null,
    };
  }
  return {
    ...draft,
    disabledReason: null,
    peakRps: scenario.peakRps,
    p99Ms: scenario.p99Ms,
    regressionCount: scenario.regressions.length,
  };
}

export interface AuditDraftView {
  readonly standardId: string;
  readonly outcome: "full" | "partial";
  /** audit 按钮禁用原因（null = 可执行——零检查标准是诚实 typed 拒绝路径，
   *  非 UI 禁用）。 */
  readonly disabledReason: "unknown-standard" | null;
  readonly checksTotal: number | null;
  /** outcome 意图下的确定性 checks-passed（零检查标准为 0）。 */
  readonly projectedChecksPassed: number | null;
}

/** audit 草稿 + 注册面 → run 确认区视图模型。 */
export function projectAuditDraftView(
  draft: {
    readonly standardId: string;
    readonly outcome: "full" | "partial";
  },
  standards: readonly {
    readonly id: string;
    readonly checksTotal: number;
    readonly partialChecksPassed: number;
  }[],
): AuditDraftView {
  const standard = standards.find((entry) => entry.id === draft.standardId);
  if (!standard) {
    return {
      ...draft,
      disabledReason: "unknown-standard",
      checksTotal: null,
      projectedChecksPassed: null,
    };
  }
  return {
    ...draft,
    disabledReason: null,
    checksTotal: standard.checksTotal,
    projectedChecksPassed:
      draft.outcome === "full"
        ? standard.checksTotal
        : standard.partialChecksPassed,
  };
}

export interface JourneyDraftView {
  readonly journeyId: string;
  readonly failAtStep: number | null;
  readonly runKind: "measured" | "simulated";
  /** run 按钮禁用原因（null = 可执行——measured 与越界失败步是诚实 typed
   *  拒绝路径，非 UI 禁用）。 */
  readonly disabledReason: "unknown-journey" | null;
  readonly totalSteps: number | null;
  /** 失败步意图的步骤名解析（null = 完整跑或未知步）。 */
  readonly failStepName: string | null;
}

/** journey 草稿 + 注册面 → run 确认区视图模型。 */
export function projectJourneyDraftView(
  draft: {
    readonly journeyId: string;
    readonly failAtStep: number | null;
    readonly runKind: "measured" | "simulated";
  },
  journeys: readonly {
    readonly id: string;
    readonly steps: readonly string[];
    readonly valid: boolean;
  }[],
): JourneyDraftView {
  const journey = journeys.find((entry) => entry.id === draft.journeyId);
  if (!journey || !journey.valid) {
    return {
      ...draft,
      disabledReason: "unknown-journey",
      totalSteps: null,
      failStepName: null,
    };
  }
  return {
    ...draft,
    disabledReason: null,
    totalSteps: journey.steps.length,
    failStepName:
      draft.failAtStep === null
        ? null
        : storyboardJourneyStepName(draft.failAtStep, journey.steps),
  };
}

export interface RunbookDraftView {
  readonly incidentClassId: string;
  readonly via: "failure-injection" | "exercise-claim";
  /** exercise 按钮禁用原因（null = 可执行——exercise-claim 是诚实 typed 拒绝
   *  路径，非 UI 禁用）。 */
  readonly disabledReason: "unknown-incident-class" | null;
  readonly boundStepIndex: number | null;
  readonly boundStepName: string | null;
}

/** runbook 草稿 + 注册面 → exercise 确认区视图模型。 */
export function projectRunbookDraftView(
  draft: {
    readonly incidentClassId: string;
    readonly via: "failure-injection" | "exercise-claim";
  },
  incidentClasses: readonly {
    readonly id: string;
    readonly boundStepIndex: number;
    readonly steps: readonly string[];
    readonly valid: boolean;
  }[],
): RunbookDraftView {
  const incidentClass = incidentClasses.find(
    (entry) => entry.id === draft.incidentClassId,
  );
  if (!incidentClass || !incidentClass.valid) {
    return {
      ...draft,
      disabledReason: "unknown-incident-class",
      boundStepIndex: null,
      boundStepName: null,
    };
  }
  return {
    ...draft,
    disabledReason: null,
    boundStepIndex: incidentClass.boundStepIndex,
    boundStepName: storyboardJourneyStepName(
      incidentClass.boundStepIndex,
      incidentClass.steps,
    ),
  };
}

/** review 接受门草稿视图（门显示独立呈现——服务端独立强制）。 */
export interface AcceptanceDraftView {
  readonly reviewId: string | null;
  /** 门显示（projectConformanceAcceptanceGate 的投影面）。 */
  readonly gate: ConformanceAcceptanceGateView;
}

/** acceptance 草稿 → accept 确认区视图模型。 */
export function projectAcceptanceDraftView(
  draft: { readonly reviewId: string | null },
  gate: ConformanceAcceptanceGateView,
): AcceptanceDraftView {
  return { ...draft, gate };
}
