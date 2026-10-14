// YOU Conformance Studio — ConformanceStudioController 端口（W11B）。
//
// 边界（docs/you/WORK_ORDERS.md W11B / docs/you/CONTRACTS.md "Wave-11 contract
// freeze (v11)"）：
// - 本文件只定义 UI 消费的服务端口；hardening-verification 的 canonical truth
//   属于 Worker A 的 security authority 服务（W11A：threat-model entries、
//   security review records、load-test reports）与 Worker C 的 E2E runbook
//   服务（W11C：20 点 launch-gate journey harness、failure injection、
//   runbook exercising、conformance audit builders）。UI 不实现领域逻辑。
// - 端口形状镜像 W11A/W11C 服务接缝 1:1（review record 与 accept / load-test
//   run / audit run / journey run 与 failure-injection exercise —— T11 换绑时
//   逐方法对位，W8B-W10B 先例同款）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v11 `you/contract.ts`），禁止
//   本地重声明。
// - Phase 0 的实现是 `conformanceSimulatedController.ts` 的确定性剧本；
//   TODO(T11): bind to Worker A/C 的 hardening-verification 服务（TL 在 T11
//   换绑本端口）。
// - SECURITY REVIEW LAW：findings recorded verbatim；acceptance 是引用同一
//   finding set 的独立不可变决定（新记录——kind/supersedes 链接；非空 finding
//   set 是 acceptance 的前置；YOU_SECURITY_REVIEW_INVALID）。
// - LOAD TEST LAW：peak/p99 measured 或 simulated-labeled——绝不 invented；
//   regressions listed verbatim，绝不 summarize away（YOU_LOAD_TEST_INVALID）。
// - CONFORMANCE LAW：checks-total 与 checks-passed stated verbatim——绝不
//   bare pass；counts 即 conformance 陈述本身（YOU_CONFORMANCE_AUDIT_INVALID）。
// - JOURNEY LAW：20 点 launch-gate journey 记录每一步（completed 或
//   failed-at）+ measured duration；simulated runs stay labeled
//   （YOU_E2E_JOURNEY_INVALID）。
// - RUNBOOK LAW：每个 incident runbook entry 被 ≥1 条 failure-injection
//   journey 演练，或显式标注 unexercised（YOU_RUNBOOK_INVALID）。
// - 事件词汇（frozen additive wave-11）：security-review-recorded /
//   load-test-recorded / conformance-audited / e2e-journey-recorded /
//   runbook-entry-recorded + solution-created。
import type {
  ConformanceAuditRecord,
  E2eJourneyRecord,
  IncidentRunbookEntry,
  LoadTestReport,
  OpaqueId,
  SecurityReviewRecord,
  SolutionEvent,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 记录）
// ---------------------------------------------------------------------------

export interface ConformanceStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 记录一次 security review（scope 的 finding set 以注册面为准）。 */
export interface RecordSecurityReviewInput {
  readonly scopeId: string;
}

/** 接受一个 review（acceptance = 引用 finding set 的独立不可变新记录）。 */
export interface AcceptSecurityReviewInput {
  readonly reviewId: OpaqueId;
}

/** 运行一次 load test（指标来源声明：measured / simulated / invented）。 */
export interface RunLoadTestInput {
  readonly scenarioId: string;
  readonly metricsSource: "measured" | "simulated" | "invented";
}

/** 运行一次 conformance audit（结果意图：full / partial）。 */
export interface RunConformanceAuditInput {
  readonly standardId: string;
  readonly outcome: "full" | "partial";
}

/** 记录一次 journey run（failAtStep null = 完整 20 点；1..20 = 失败于该步）。 */
export interface RecordJourneyRunInput {
  readonly journeyId: string;
  readonly failAtStep: number | null;
  readonly runKind: "measured" | "simulated";
}

/**
 * 演练一个 runbook entry（RUNBOOK LAW）：via failure-injection = 合法路径
 * （先落一条失败于绑定步的 journey，再 append exercised 新记录）；
 * via exercise-claim = 诚实 typed 拒绝路径（无 journey 的演练断言）。
 */
export interface ExerciseRunbookInput {
  readonly incidentClassId: string;
  readonly via: "failure-injection" | "exercise-claim";
}

// ---------------------------------------------------------------------------
// 注册面视图（W11A/W11C 服务接缝的声明侧镜像；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** security review scope 注册面视图（内容寻址标签 + 确定性 finding set 计数）。 */
export interface ConformanceReviewScopeView {
  readonly id: string;
  readonly scopeRef: string;
  readonly findingsCount: number;
}

/** load test scenario 注册面视图（确定性指标预设 + 回归清单）。 */
export interface ConformanceLoadScenarioView {
  readonly id: string;
  readonly scenarioRef: string;
  readonly peakRps: number;
  readonly p99Ms: number;
  readonly regressions: readonly string[];
  /** 形状合法（未注册 scenario = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** conformance standard 注册面视图（checks-total 权威来源）。 */
export interface ConformanceStandardView {
  readonly id: string;
  readonly standard: string;
  readonly scopeRef: string;
  readonly checksTotal: number;
  /** partial 结果的确定性通过数（full = checksTotal）。 */
  readonly partialChecksPassed: number;
}

/** E2E journey 注册面视图（20 点 launch-gate 步骤表）。 */
export interface ConformanceJourneyView {
  readonly id: string;
  readonly journeyId: string;
  readonly steps: readonly string[];
  /** 形状合法（未注册 journey = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** incident class 注册面视图（detection / containment / recovery + 绑定步）。 */
export interface ConformanceIncidentClassView {
  readonly id: string;
  readonly incidentClass: string;
  readonly detection: string;
  readonly containment: string;
  readonly recovery: string;
  /** failure-injection 绑定的步骤序（1-based）。 */
  readonly boundStepIndex: number;
  /** 形状合法（未注册 class = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

// ---------------------------------------------------------------------------
// 快照记录视图（frozen v11 形状不动；ledger 语义为端口级包装）
// ---------------------------------------------------------------------------

/**
 * Security review 账本条目（append-only：review 与 acceptance 都是新记录——
 * SECURITY REVIEW LAW「acceptance 是独立不可变决定」的端口级呈现；frozen
 * SecurityReviewRecord 形状不动；kind/supersedes 链接是账本语义（W10B
 * EligibilityEntry 同款先例）。
 */
export interface ConformanceReviewEntry {
  readonly record: SecurityReviewRecord;
  readonly kind: "review" | "acceptance";
  /** acceptance → 被接受的 review 记录 id；review → null。 */
  readonly supersedesReviewId: string | null;
}

/**
 * journey run 视图（frozen E2eJourneyRecord 形状不动；kind/failure-injection
 * 标记与 incidentClassRef 链接是端口级语义——RUNBOOK LAW 演练链的显示面）。
 */
export interface ConformanceJourneyRunView {
  readonly record: E2eJourneyRecord;
  readonly kind: "golden" | "failure-injection";
  /** failure-injection run 绑定的 incident class（golden → null）。 */
  readonly incidentClassRef: string | null;
}

/**
 * runbook 账本条目（append-only：registration 与 exercise 都是新记录——
 * RUNBOOK LAW「exercised 或显式 unexercised」的端口级呈现；frozen
 * IncidentRunbookEntry 形状不动）。
 */
export interface ConformanceRunbookEntryView {
  readonly record: IncidentRunbookEntry;
  readonly kind: "registration" | "exercise";
  /** exercise → 被演练的 registration 记录 id；registration → null。 */
  readonly supersedesEntryId: string | null;
}

export interface ConformanceStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 conformance 表面）。 */
  readonly studioId: OpaqueId;
  /** load-test 指标来源分类学（端口级全集：measured / simulated / invented）。 */
  readonly metricsSources: readonly ("measured" | "simulated" | "invented")[];
  /** conformance audit 结果意图分类学（full / partial）。 */
  readonly auditOutcomes: readonly ("full" | "partial")[];
  /** journey run 种类分类学（measured / simulated——fixture 面只落 simulated）。 */
  readonly runKinds: readonly ("measured" | "simulated")[];
  /** security review scope 注册面（record 动作的数据源）。 */
  readonly reviewScopes: readonly ConformanceReviewScopeView[];
  /** load test scenario 注册面。 */
  readonly loadScenarios: readonly ConformanceLoadScenarioView[];
  /** conformance standard 注册面（audit 动作的数据源）。 */
  readonly standards: readonly ConformanceStandardView[];
  /** E2E journey 注册面（run 动作的数据源）。 */
  readonly journeys: readonly ConformanceJourneyView[];
  /** incident class 注册面（exercise 动作的数据源）。 */
  readonly incidentClasses: readonly ConformanceIncidentClassView[];
  /** security review 账本（append-only；追加序）。 */
  readonly reviews: readonly ConformanceReviewEntry[];
  /** load test 报告（不可变；id 升序）。 */
  readonly loadReports: readonly LoadTestReport[];
  /** conformance audit 记录（不可变；id 升序）。 */
  readonly audits: readonly ConformanceAuditRecord[];
  /** journey run 记录（不可变；id 升序）。 */
  readonly journeyRuns: readonly ConformanceJourneyRunView[];
  /** runbook 账本（append-only；追加序）。 */
  readonly runbook: readonly ConformanceRunbookEntryView[];
  /** append-only 事件账本投影（v11 hardening-verification 事件）。 */
  readonly events: readonly SolutionEvent[];
  /** 服务端投影时刻（确定性——非 UI 本地时钟）。 */
  readonly projectedAt: string;
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class ConformanceStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "ConformanceStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Conformance Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T11 换绑
 * Worker A/C 的 hardening-verification 服务。方法走应用服务权威（UI/HTTP/SDK/
 * MCP 同一权威）。
 */
export interface ConformanceStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实验证。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：conformance 平面已存在时返回当前快照，不重建。 */
  load(request: ConformanceStudioLoadRequest): Promise<ConformanceStudioSnapshot>;
  refresh(): Promise<ConformanceStudioSnapshot>;

  // -- security review 平面（SECURITY REVIEW LAW） --
  /**
   * 记录一次 review：scope 的 finding set 以注册面为准（findings verbatim 计数
   * 落账）；未注册 scope ⇒ typed YOU_SECURITY_REVIEW_INVALID 拒绝（fail closed）。
   * 记录 accepted: false；security-review-recorded 事件。
   */
  recordSecurityReview(
    input: RecordSecurityReviewInput,
  ): Promise<ConformanceReviewEntry>;
  /**
   * 接受一个 review（acceptance = 引用同一 finding set 的独立不可变新记录，
   * accepted: true + supersedes 链接）：零 findings ⇒ typed 拒绝（acceptance
   * without findings）；已接受 / 未知 id / acceptance 记录本身 ⇒ typed 拒绝。
   */
  acceptSecurityReview(
    input: AcceptSecurityReviewInput,
  ): Promise<ConformanceReviewEntry>;

  // -- load test 平面（LOAD TEST LAW） --
  /**
   * 运行一次 load test：simulated 来源 ⇒ 报告 simulated: true（simulated-
   * labeled 指示）+ regressions verbatim 清单 + load-test-recorded 事件；
   * invented 来源 ⇒ typed YOU_LOAD_TEST_INVALID（绝不 invented）；
   * measured 来源在 fixture 支撑面 ⇒ typed 拒绝（绝不伪造 measured 数值——
   * T11 换绑后由真实服务产生 measured 报告）；未注册 scenario ⇒ typed 拒绝。
   */
  runLoadTest(input: RunLoadTestInput): Promise<LoadTestReport>;

  // -- conformance audit 平面（CONFORMANCE LAW） --
  /**
   * 运行一次 audit：checks-total / checks-passed verbatim 落账（full = 全过、
   * partial = 预设通过数）+ conformance-audited 事件；零检查标准的任何结果 ⇒
   * typed YOU_CONFORMANCE_AUDIT_INVALID（bare pass 绝不落账）；未注册 standard
   * ⇒ typed 拒绝。
   */
  runConformanceAudit(
    input: RunConformanceAuditInput,
  ): Promise<ConformanceAuditRecord>;

  // -- journey 平面（JOURNEY LAW） --
  /**
   * 记录一次 journey run：failAtStep null ⇒ 20 点全过（failedStep null）；
   * 1..20 ⇒ 失败于该步（stepsCompleted = failAtStep - 1 + failedStep 步名）；
   * 越界 / 未注册 journey ⇒ typed YOU_E2E_JOURNEY_INVALID；measured runKind 在
   * fixture 支撑面 ⇒ typed 拒绝（simulated runs stay labeled——绝不伪造
   * measured duration）；e2e-journey-recorded 事件。
   */
  recordJourneyRun(input: RecordJourneyRunInput): Promise<ConformanceJourneyRunView>;

  // -- runbook 平面（RUNBOOK LAW） --
  /**
   * 演练一个 runbook entry：via failure-injection ⇒ 先落一条失败于绑定步的
   * journey run，再 append exercised 新账本记录（runbook-entry-recorded +
   * e2e-journey-recorded 事件）；via exercise-claim ⇒ typed YOU_RUNBOOK_INVALID
   * （无 journey 的演练断言——显式标注 unexercised 才是诚实态）；未注册 class ⇒
   * typed 拒绝。
   */
  exerciseRunbook(input: ExerciseRunbookInput): Promise<ConformanceRunbookEntryView>;
}

// ---------------------------------------------------------------------------
// Acceptance 决定门纯投影（「findings-verbatim + acceptance-requires-findings」
// 必须可见且可测；UI 显示面——服务端独立强制）
// ---------------------------------------------------------------------------

export interface ConformanceAcceptanceGateView {
  readonly allowed: boolean;
  readonly reason:
    | "granted"
    | "acceptance-without-findings"
    | "unknown-review"
    | "already-accepted"
    | "acceptance-not-acceptable"
    | "review-not-selected";
}

/**
 * 快照事实 + 草稿 → 门视图（求值固定序；fail closed；投影只显示，服务端独立
 * 强制）。acceptance 引用非空 finding set 是 SECURITY REVIEW LAW 的显示面。
 */
export function projectConformanceAcceptanceGate(
  snapshot: ConformanceStudioSnapshot | null,
  reviewId: string | null,
): ConformanceAcceptanceGateView {
  if (!snapshot || reviewId === null) {
    return { allowed: false, reason: "review-not-selected" };
  }
  const entry = snapshot.reviews.find(
    (candidate) => candidate.record.id === reviewId,
  );
  if (!entry) {
    return { allowed: false, reason: "unknown-review" };
  }
  if (entry.kind !== "review") {
    return { allowed: false, reason: "acceptance-not-acceptable" };
  }
  if (conformanceReviewIsAccepted(snapshot, entry.record.id)) {
    return { allowed: false, reason: "already-accepted" };
  }
  if (entry.record.findingsCount <= 0) {
    return { allowed: false, reason: "acceptance-without-findings" };
  }
  return { allowed: true, reason: "granted" };
}

/** review 的 live 接受态是否已落账（acceptance 账本事实）。 */
export function conformanceReviewIsAccepted(
  snapshot: ConformanceStudioSnapshot,
  reviewId: string,
): boolean {
  return snapshot.reviews.some(
    (entry) =>
      entry.kind === "acceptance" && entry.supersedesReviewId === reviewId,
  );
}

/** scope 的 live review 记录（最新未被接受的 review；无 → null）。 */
export function liveReviewOfScope(
  snapshot: ConformanceStudioSnapshot | null,
  scopeRef: string | null,
): SecurityReviewRecord | null {
  if (!snapshot || scopeRef === null) return null;
  const entries = snapshot.reviews.filter(
    (entry) =>
      entry.record.scopeRef === scopeRef && entry.kind === "review",
  );
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (!conformanceReviewIsAccepted(snapshot, entry.record.id)) {
      return entry.record;
    }
  }
  return null;
}

/** scope 的 live acceptance 记录（无 → null）。 */
export function liveAcceptanceOfScope(
  snapshot: ConformanceStudioSnapshot | null,
  scopeRef: string | null,
): SecurityReviewRecord | null {
  if (!snapshot || scopeRef === null) return null;
  const entries = snapshot.reviews.filter(
    (entry) =>
      entry.record.scopeRef === scopeRef && entry.kind === "acceptance",
  );
  return entries.at(-1)?.record ?? null;
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B–W10B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** security review 账本（追加序；ledger read 语义）。 */
export function orderedConformanceReviews(
  snapshot: ConformanceStudioSnapshot | null,
): readonly ConformanceReviewEntry[] {
  if (!snapshot) return [];
  return snapshot.reviews;
}

/** 按 id 解析 review 账本条目（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function conformanceReviewById(
  snapshot: ConformanceStudioSnapshot | null,
  reviewId: string | null,
): ConformanceReviewEntry | null {
  if (!snapshot || reviewId === null) return null;
  return (
    snapshot.reviews.find((entry) => entry.record.id === reviewId) ?? null
  );
}

/** load test 报告列表（id 升序）。 */
export function orderedLoadReports(
  snapshot: ConformanceStudioSnapshot | null,
): readonly LoadTestReport[] {
  if (!snapshot) return [];
  return snapshot.loadReports;
}

/** 按 id 解析 load test 报告（未知 id → null）。 */
export function loadReportById(
  snapshot: ConformanceStudioSnapshot | null,
  reportId: string | null,
): LoadTestReport | null {
  if (!snapshot || reportId === null) return null;
  return snapshot.loadReports.find((entry) => entry.id === reportId) ?? null;
}

/** conformance audit 记录列表（id 升序）。 */
export function orderedConformanceAudits(
  snapshot: ConformanceStudioSnapshot | null,
): readonly ConformanceAuditRecord[] {
  if (!snapshot) return [];
  return snapshot.audits;
}

/** 按 id 解析 audit 记录（未知 id → null）。 */
export function conformanceAuditById(
  snapshot: ConformanceStudioSnapshot | null,
  auditId: string | null,
): ConformanceAuditRecord | null {
  if (!snapshot || auditId === null) return null;
  return snapshot.audits.find((entry) => entry.id === auditId) ?? null;
}

/** journey run 记录列表（id 升序）。 */
export function orderedJourneyRuns(
  snapshot: ConformanceStudioSnapshot | null,
): readonly ConformanceJourneyRunView[] {
  if (!snapshot) return [];
  return snapshot.journeyRuns;
}

/** 按 id 解析 journey run 视图（未知 id → null）。 */
export function journeyRunById(
  snapshot: ConformanceStudioSnapshot | null,
  runId: string | null,
): ConformanceJourneyRunView | null {
  if (!snapshot || runId === null) return null;
  return (
    snapshot.journeyRuns.find((entry) => entry.record.id === runId) ?? null
  );
}

/** runbook 账本（追加序）。 */
export function orderedRunbook(
  snapshot: ConformanceStudioSnapshot | null,
): readonly ConformanceRunbookEntryView[] {
  if (!snapshot) return [];
  return snapshot.runbook;
}

/** 按 id 解析 runbook 账本条目（未知 id → null）。 */
export function runbookEntryById(
  snapshot: ConformanceStudioSnapshot | null,
  entryId: string | null,
): ConformanceRunbookEntryView | null {
  if (!snapshot || entryId === null) return null;
  return (
    snapshot.runbook.find((entry) => entry.record.id === entryId) ?? null
  );
}

/** incident class 的 live runbook 条目（账本末位；无 → null）。 */
export function liveRunbookEntryOfClass(
  snapshot: ConformanceStudioSnapshot | null,
  incidentClass: string | null,
): IncidentRunbookEntry | null {
  if (!snapshot || incidentClass === null) return null;
  const entries = snapshot.runbook.filter(
    (entry) => entry.record.incidentClass === incidentClass,
  );
  return entries.at(-1)?.record ?? null;
}

/** incident class 链是否已演练（RUNBOOK LAW 显示面：exercised / unexercised）。 */
export function incidentClassIsExercised(
  snapshot: ConformanceStudioSnapshot | null,
  incidentClass: string | null,
): boolean {
  const live = liveRunbookEntryOfClass(snapshot, incidentClass);
  return live?.exercised ?? false;
}
