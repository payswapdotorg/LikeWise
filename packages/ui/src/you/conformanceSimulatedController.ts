/* oxlint-disable eslint(max-lines) -- 模拟控制器按 ConformanceStudioController 端口逐方法实现（Phase-0 剧本状态机：security review 记录与 acceptance 新记录（findings-verbatim 门）+ load-test 指标来源门（measured/simulated/invented 三路）+ conformance audit counts 门（零检查拒绝）+ journey run 门（失败步范围 + measured 拒绝）+ runbook 演练门（failure-injection / exercise-claim 两路））；T11 换绑 Worker A/C 的 hardening-verification 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Conformance Studio — 确定性模拟控制器（W11B，Phase 0）。
//
// 这是 `ConformanceStudioController` 端口的确定性剧本实现（W11A 的 security
// authority 服务与 W11C 的 E2E runbook 服务在并行 wave 合入；本实现只到 T11
// 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自
//   StoryboardClock（统一经 tick() 包装——消费计数使快照 projectedAt 锚定确定性，
//   绝不 Date.now）；
// - SECURITY REVIEW LAW：findings recorded verbatim（scope 预设的 finding set
//   计数原样落账）；acceptance 是引用同一 finding set 的独立不可变新记录
//   （accepted: true + supersedes 链接）；零 findings 的 acceptance ⇒ typed
//   YOU_SECURITY_REVIEW_INVALID（acceptance without findings）；
// - LOAD TEST LAW：simulated 来源的报告 simulated: true（simulated-labeled
//   指示）+ regressions verbatim 清单；invented 来源 ⇒ typed 拒绝（绝不
//   invented）；measured 来源在 fixture 支撑面 ⇒ typed 拒绝（绝不伪造 measured
//   数值——T11 换绑后由真实服务产生 measured 报告）；
// - CONFORMANCE LAW：checks-total / checks-passed verbatim 落账（两 counts
//   永远同时在场——绝不 bare pass）；零检查标准 ⇒ typed 拒绝；
// - JOURNEY LAW：20 点 launch-gate journey 记录每一步（completed 或
//   failed-at 步名 verbatim）+ 确定性 duration；measured runKind 在 fixture
//   支撑面 ⇒ typed 拒绝（simulated runs stay labeled）；越界失败步 ⇒ typed
//   拒绝；
// - RUNBOOK LAW：bootstrap 时每条 incident class 落一条 unexercised
//   registration 记录（显式标注 unexercised）；演练经 failure-injection
//   journey（先落失败于绑定步的 journey run，再 append exercised 新记录）；
//   exercise-claim（无 journey 的演练断言）⇒ typed YOU_RUNBOOK_INVALID；
// - 未注册 scope / scenario / standard / journey / class 皆 typed 拒绝
//   （fail closed，绝不猜测补全）；未知 id ⇒ YOU_INVALID_STATE 保守类或专属
//   code（frozen v11 词汇下与 W9B/W10B 同款披露）；
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
  SolutionEventType,
  YouError,
} from "@zcode/shared";
import {
  ConformanceStudioError,
  conformanceReviewIsAccepted,
  type AcceptSecurityReviewInput,
  type ConformanceJourneyRunView,
  type ConformanceReviewEntry,
  type ConformanceRunbookEntryView,
  type ConformanceStudioController,
  type ConformanceStudioLoadRequest,
  type ConformanceStudioSnapshot,
  type ExerciseRunbookInput,
  type RecordJourneyRunInput,
  type RecordSecurityReviewInput,
  type RunConformanceAuditInput,
  type RunLoadTestInput,
} from "./conformanceController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  storyboardAcceptanceRequiresFindings,
  storyboardAuditChecksSupportOutcome,
  storyboardExerciseViaIsLawful,
  storyboardJourneyFailStepInRange,
  storyboardJourneyStepName,
  storyboardMetricsSourceLandsReport,
  storyboardRunKindLandsRecord,
} from "./conformanceStoryboardLaws.js";
import {
  storyboardJourneyDurationMs,
} from "./conformanceStoryboard.js";
import {
  CONFORMANCE_STORYBOARD_AUDIT_OUTCOMES,
  CONFORMANCE_STORYBOARD_DISPLAY_NAME,
  CONFORMANCE_STORYBOARD_INCIDENT_CLASSES,
  CONFORMANCE_STORYBOARD_JOURNEYS,
  CONFORMANCE_STORYBOARD_LOAD_SCENARIOS,
  CONFORMANCE_STORYBOARD_METRICS_SOURCES,
  CONFORMANCE_STORYBOARD_REVIEW_SCOPES,
  CONFORMANCE_STORYBOARD_RUN_KINDS,
  CONFORMANCE_STORYBOARD_SOLUTION_ID,
  CONFORMANCE_STORYBOARD_STANDARDS,
  compareConformanceStoryboardId,
  conformanceContentBinding,
  storyboardIncidentClassById,
  storyboardJourneyById,
  storyboardLoadScenarioById,
  storyboardReviewScopeById,
  storyboardStandardById,
} from "./conformanceStoryboard.js";

interface SimulatedConformanceState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  reviews: ConformanceReviewEntry[];
  loadReports: LoadTestReport[];
  audits: ConformanceAuditRecord[];
  journeyRuns: ConformanceJourneyRunView[];
  runbook: ConformanceRunbookEntryView[];
  events: SolutionEvent[];
}

/** 与 solutionStoryboard.ts 私有纪元一致的镜像字面量（时钟锚）。 */
const STORYBOARD_EPOCH_MS = Date.UTC(2025, 5, 2, 9, 0, 0, 0);

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): ConformanceStudioError {
  return new ConformanceStudioError({ code, message, details, simulated: true });
}

function invalidState(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): ConformanceStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 conformanceStudioRegistry）；
 * `load` 幂等：状态存在即复用（conformance 平面是持久 workspace 表面）。
 */
export function createSimulatedConformanceStudioController(): ConformanceStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let consumedTicks = 0;
  let state: SimulatedConformanceState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  /** 全部时间戳统一入口（消费计数 → projectedAt 锚定确定性）。 */
  const tick = (): string => {
    consumedTicks += 1;
    return clock.next();
  };

  /** 确定性「当前时刻」＝下一次 tick 的值（纪元 + 已消费 tick 秒；非 Date.now）。 */
  const clockNow = (): string =>
    new Date(STORYBOARD_EPOCH_MS + consumedTicks * 1000).toISOString();

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean>,
    generator: "agent" | "user" | "fixture" = "agent",
  ): void => {
    if (!state) return;
    state.events = [
      ...state.events,
      {
        id: nextId("fx-c-event"),
        solutionId: CONFORMANCE_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: tick(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-conformance-storyboard",
          generator,
          createdAt: tick(),
          lineage: [],
        },
      },
    ];
  };

  // -------------------------------------------------------------------------
  // 快照
  // -------------------------------------------------------------------------

  const snapshot = (): ConformanceStudioSnapshot => {
    if (!state) {
      throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
    }
    const reviewScopes = CONFORMANCE_STORYBOARD_REVIEW_SCOPES.map((entry) => ({
      id: entry.id,
      scopeRef: conformanceContentBinding(`scope:${entry.scopeKey}`).contentRef,
      findingsCount: entry.findingsCount,
    }));
    const loadScenarios = CONFORMANCE_STORYBOARD_LOAD_SCENARIOS.map((entry) => ({
      id: entry.id,
      scenarioRef: conformanceContentBinding(`scenario:${entry.scenarioKey}`).contentRef,
      peakRps: entry.peakRps,
      p99Ms: entry.p99Ms,
      regressions: [...entry.regressions],
      valid: entry.valid,
    }));
    const standards = CONFORMANCE_STORYBOARD_STANDARDS.map((entry) => ({
      id: entry.id,
      standard: entry.standard,
      scopeRef: conformanceContentBinding(`standard:${entry.scopeKey}`).contentRef,
      checksTotal: entry.checksTotal,
      partialChecksPassed: entry.partialChecksPassed,
    }));
    const journeys = CONFORMANCE_STORYBOARD_JOURNEYS.map((entry) => ({
      id: entry.id,
      journeyId: entry.journeyId,
      steps: [...entry.steps],
      valid: entry.valid,
    }));
    const incidentClasses = CONFORMANCE_STORYBOARD_INCIDENT_CLASSES.map((entry) => ({
      id: entry.id,
      incidentClass: entry.incidentClass,
      detection: entry.detection,
      containment: entry.containment,
      recovery: entry.recovery,
      boundStepIndex: entry.boundStepIndex,
      valid: entry.valid,
    }));
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      metricsSources: [...CONFORMANCE_STORYBOARD_METRICS_SOURCES],
      auditOutcomes: [...CONFORMANCE_STORYBOARD_AUDIT_OUTCOMES],
      runKinds: [...CONFORMANCE_STORYBOARD_RUN_KINDS],
      reviewScopes,
      loadScenarios,
      standards,
      journeys,
      incidentClasses,
      reviews: state.reviews.map((entry) => ({
        record: { ...entry.record },
        kind: entry.kind,
        supersedesReviewId: entry.supersedesReviewId,
      })),
      loadReports: [...state.loadReports]
        .sort((a, b) => compareConformanceStoryboardId(a.id, b.id))
        .map((entry) => ({ ...entry })),
      audits: [...state.audits]
        .sort((a, b) => compareConformanceStoryboardId(a.id, b.id))
        .map((entry) => ({ ...entry })),
      journeyRuns: [...state.journeyRuns]
        .sort((a, b) => compareConformanceStoryboardId(a.record.id, b.record.id))
        .map((entry) => ({
          record: { ...entry.record },
          kind: entry.kind,
          incidentClassRef: entry.incidentClassRef,
        })),
      runbook: state.runbook.map((entry) => ({
        record: { ...entry.record },
        kind: entry.kind,
        supersedesEntryId: entry.supersedesEntryId,
      })),
      events: state.events,
      projectedAt: clockNow(),
      simulated: true,
    };
  };

  const bootstrap = (request: ConformanceStudioLoadRequest): void => {
    state = {
      studioId: "fx-conformance-studio-001",
      displayName: CONFORMANCE_STORYBOARD_DISPLAY_NAME,
      reviews: [],
      loadReports: [],
      audits: [],
      journeyRuns: [],
      runbook: [],
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "conformance-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      reviewScopeCount: CONFORMANCE_STORYBOARD_REVIEW_SCOPES.length,
      loadScenarioCount: CONFORMANCE_STORYBOARD_LOAD_SCENARIOS.length,
      standardCount: CONFORMANCE_STORYBOARD_STANDARDS.length,
      incidentClassCount: CONFORMANCE_STORYBOARD_INCIDENT_CLASSES.length,
      simulated: true,
    });
    // RUNBOOK LAW 显示面：每条 incident class 落一条 unexercised registration
    // 记录（显式标注 unexercised——诚实态；演练后追加 exercised 新记录）。
    for (const incidentClass of CONFORMANCE_STORYBOARD_INCIDENT_CLASSES) {
      if (!incidentClass.valid) continue;
      const record: IncidentRunbookEntry = {
        id: nextId("fx-c-runbook"),
        incidentClass: incidentClass.incidentClass,
        detection: incidentClass.detection,
        containment: incidentClass.containment,
        recovery: incidentClass.recovery,
        exercised: false,
        simulated: true,
      };
      const entry: ConformanceRunbookEntryView = {
        record,
        kind: "registration",
        supersedesEntryId: null,
      };
      state.runbook = [...state.runbook, entry];
      appendEvent(
        "runbook-entry-recorded",
        record.id,
        {
          entryId: record.id,
          incidentClass: record.incidentClass,
          exercised: false,
          kind: "registration",
          supersedes: "",
          simulated: true,
        },
        "fixture",
      );
    }
  };

  // -------------------------------------------------------------------------
  // 内部子程序：落一条 journey run（golden 或 failure-injection 共用）
  // -------------------------------------------------------------------------

  const appendJourneyRun = (
    input: {
      readonly journeyId: string;
      readonly failAtStep: number | null;
      readonly kind: "golden" | "failure-injection";
      readonly incidentClassRef: string | null;
    },
  ): ConformanceJourneyRunView => {
    if (!state) {
      throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
    }
    const journey = storyboardJourneyById(input.journeyId);
    if (!journey || !journey.valid) {
      throw youError(
        "YOU_E2E_JOURNEY_INVALID",
        `journey ${input.journeyId} not found — every journey run references a registered journey (fail closed)`,
        { reason: "unknown-journey", journeyId: input.journeyId },
      );
    }
    const steps = journey.steps;
    const totalSteps = steps.length;
    if (!storyboardJourneyFailStepInRange(input.failAtStep, totalSteps)) {
      throw youError(
        "YOU_E2E_JOURNEY_INVALID",
        `journey ${journey.journeyId} fail-at step ${input.failAtStep} is out of range (1..${totalSteps}, or null for the full run)`,
        {
          reason: "fail-step-out-of-range",
          journeyId: journey.journeyId,
          failAtStep: input.failAtStep ?? -1,
          totalSteps,
        },
      );
    }
    const failed = input.failAtStep !== null;
    const failedStepName = failed
      ? storyboardJourneyStepName(input.failAtStep ?? 0, steps)
      : null;
    if (failed && failedStepName === null) {
      throw invalidState(
        "journey-step-resolution-failed",
        `journey ${journey.journeyId} failed to resolve the step name for index ${input.failAtStep}`,
      );
    }
    const stepsCompleted = failed ? (input.failAtStep ?? 0) - 1 : totalSteps;
    const record: E2eJourneyRecord = {
      id: nextId("fx-c-journey"),
      journeyId: journey.journeyId,
      stepsCompleted,
      failedStep: failedStepName,
      durationMs: storyboardJourneyDurationMs(stepsCompleted, failed),
      simulated: true,
    };
    const view: ConformanceJourneyRunView = {
      record,
      kind: input.kind,
      incidentClassRef: input.incidentClassRef,
    };
    state.journeyRuns = [...state.journeyRuns, view];
    appendEvent("e2e-journey-recorded", record.id, {
      runId: record.id,
      journeyId: record.journeyId,
      stepsCompleted: record.stepsCompleted,
      failedStep: record.failedStep ?? "",
      durationMs: record.durationMs,
      failureInjection: input.kind === "failure-injection",
      incidentClassRef: input.incidentClassRef ?? "",
      simulated: true,
    });
    return { record: { ...record }, kind: view.kind, incidentClassRef: view.incidentClassRef };
  };

  const controller: ConformanceStudioController = {
    backing: "fixture-simulated",

    async load(
      request: ConformanceStudioLoadRequest,
    ): Promise<ConformanceStudioSnapshot> {
      if (!state) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh(): Promise<ConformanceStudioSnapshot> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      return snapshot();
    },

    async recordSecurityReview(
      input: RecordSecurityReviewInput,
    ): Promise<ConformanceReviewEntry> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      const scope = storyboardReviewScopeById(input.scopeId);
      if (!scope) {
        throw youError(
          "YOU_SECURITY_REVIEW_INVALID",
          `review scope ${input.scopeId} not found — every review references a registered scope (fail closed)`,
          { reason: "unknown-scope", scopeId: input.scopeId },
        );
      }
      const record: SecurityReviewRecord = {
        id: nextId("fx-c-review"),
        scopeRef: conformanceContentBinding(`scope:${scope.scopeKey}`).contentRef,
        reviewedAt: clockNow(),
        // SECURITY REVIEW LAW：findings recorded verbatim（scope 预设的 finding
        // set 计数原样落账——绝不 summarize / round / 修饰）。
        findingsCount: scope.findingsCount,
        accepted: false,
        simulated: true,
      };
      const entry: ConformanceReviewEntry = {
        record,
        kind: "review",
        supersedesReviewId: null,
      };
      state.reviews = [...state.reviews, entry];
      appendEvent("security-review-recorded", record.id, {
        reviewId: record.id,
        scopeRef: record.scopeRef,
        findingsCount: record.findingsCount,
        accepted: false,
        kind: "review",
        supersedes: "",
        reviewedAt: record.reviewedAt,
        simulated: true,
      });
      return { record: { ...record }, kind: entry.kind, supersedesReviewId: null };
    },

    async acceptSecurityReview(
      input: AcceptSecurityReviewInput,
    ): Promise<ConformanceReviewEntry> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      const entry = state.reviews.find(
        (candidate) => candidate.record.id === input.reviewId,
      );
      if (!entry) {
        throw youError(
          "YOU_SECURITY_REVIEW_INVALID",
          `security review ${input.reviewId} not found`,
          { reason: "unknown-review", reviewId: input.reviewId },
        );
      }
      if (entry.kind !== "review") {
        throw youError(
          "YOU_SECURITY_REVIEW_INVALID",
          `security review ${input.reviewId} is an acceptance decision, not a review — an acceptance is never itself accepted`,
          { reason: "acceptance-not-acceptable", reviewId: input.reviewId },
        );
      }
      if (conformanceReviewIsAccepted(snapshot(), entry.record.id)) {
        throw youError(
          "YOU_SECURITY_REVIEW_INVALID",
          `security review ${entry.record.id} is already accepted — an acceptance is a separate immutable decision, never repeated`,
          { reason: "already-accepted", reviewId: entry.record.id },
        );
      }
      // SECURITY REVIEW LAW：acceptance 引用非空 finding set（acceptance
      // without findings 是 typed 拒绝路径）。
      if (!storyboardAcceptanceRequiresFindings(entry.record.findingsCount)) {
        throw youError(
          "YOU_SECURITY_REVIEW_INVALID",
          `security review ${entry.record.id} carries no findings — acceptance references a non-empty finding set (findings are recorded verbatim, never zeroed by assertion)`,
          { reason: "acceptance-without-findings", reviewId: entry.record.id },
        );
      }
      // acceptance = 独立不可变新记录（accepted: true + 同 finding set + supersedes
      // 链接；原 review 记录保持 accepted: false 不可变）。
      const record: SecurityReviewRecord = {
        id: nextId("fx-c-review"),
        scopeRef: entry.record.scopeRef,
        reviewedAt: clockNow(),
        findingsCount: entry.record.findingsCount,
        accepted: true,
        simulated: true,
      };
      const acceptance: ConformanceReviewEntry = {
        record,
        kind: "acceptance",
        supersedesReviewId: entry.record.id,
      };
      state.reviews = [...state.reviews, acceptance];
      appendEvent("security-review-recorded", record.id, {
        reviewId: record.id,
        scopeRef: record.scopeRef,
        findingsCount: record.findingsCount,
        accepted: true,
        kind: "acceptance",
        supersedes: entry.record.id,
        reviewedAt: record.reviewedAt,
        simulated: true,
      });
      return {
        record: { ...record },
        kind: acceptance.kind,
        supersedesReviewId: entry.record.id,
      };
    },

    async runLoadTest(input: RunLoadTestInput): Promise<LoadTestReport> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      const scenario = storyboardLoadScenarioById(input.scenarioId);
      if (!scenario || !scenario.valid) {
        throw youError(
          "YOU_LOAD_TEST_INVALID",
          `load scenario ${input.scenarioId} not found — every report references a registered scenario (fail closed)`,
          { reason: "unknown-scenario", scenarioId: input.scenarioId },
        );
      }
      // LOAD TEST LAW 三路门：invented ⇒ 绝不落账；measured 在 fixture 支撑面 ⇒
      // 绝不伪造（T11 换绑后由真实服务产生 measured 报告）；simulated ⇒ 落账
      // 并全程 simulated-labeled。
      if (!storyboardMetricsSourceLandsReport(
        input.metricsSource,
        controller.backing === "fixture-simulated",
      )) {
        if (input.metricsSource === "invented") {
          throw youError(
            "YOU_LOAD_TEST_INVALID",
            `load test on ${scenario.scenarioKey} refused: peak/p99 are measured or simulated-labeled — never invented`,
            { reason: "invented-metrics", scenarioId: scenario.id },
          );
        }
        throw youError(
          "YOU_LOAD_TEST_INVALID",
          `load test on ${scenario.scenarioKey} refused: a fixture-simulated controller never fabricates measured numbers — simulated runs stay labeled (measured reports arrive with the T11 service binding)`,
          { reason: "fixture-backing-cannot-measure", scenarioId: scenario.id },
        );
      }
      const report: LoadTestReport = {
        id: nextId("fx-c-load"),
        scenarioRef: conformanceContentBinding(`scenario:${scenario.scenarioKey}`).contentRef,
        peakRps: scenario.peakRps,
        p99Ms: scenario.p99Ms,
        // regressions listed verbatim（绝不 summarize away）。
        regressions: [...scenario.regressions],
        simulated: true,
      };
      state.loadReports = [...state.loadReports, report];
      appendEvent("load-test-recorded", report.id, {
        reportId: report.id,
        scenarioRef: report.scenarioRef,
        peakRps: report.peakRps,
        p99Ms: report.p99Ms,
        regressionCount: report.regressions.length,
        regressions: report.regressions.join("; "),
        simulated: true,
      });
      return { ...report, regressions: [...report.regressions] };
    },

    async runConformanceAudit(
      input: RunConformanceAuditInput,
    ): Promise<ConformanceAuditRecord> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      const standard = storyboardStandardById(input.standardId);
      if (!standard) {
        throw youError(
          "YOU_CONFORMANCE_AUDIT_INVALID",
          `conformance standard ${input.standardId} not found — every audit references a registered standard (fail closed)`,
          { reason: "unknown-standard", standardId: input.standardId },
        );
      }
      // CONFORMANCE LAW：counts 即 conformance 陈述本身——零检查标准的任何
      // 结果都是 typed 拒绝（bare pass 绝不落账）。
      if (!storyboardAuditChecksSupportOutcome(standard.checksTotal)) {
        throw youError(
          "YOU_CONFORMANCE_AUDIT_INVALID",
          `conformance audit on ${standard.standard} refused: the standard carries 0 checks — checks-total and checks-passed are stated verbatim and a pass without checks never lands`,
          { reason: "zero-checks-standard", standardId: standard.id },
        );
      }
      const checksPassed =
        input.outcome === "full"
          ? standard.checksTotal
          : standard.partialChecksPassed;
      const record: ConformanceAuditRecord = {
        id: nextId("fx-c-audit"),
        standard: standard.standard,
        scopeRef: conformanceContentBinding(`standard:${standard.scopeKey}`).contentRef,
        // CONFORMANCE LAW：两 counts verbatim 落账（full = 30/30、partial =
        // 27/30 —— 绝不 bare pass）。
        checksTotal: standard.checksTotal,
        checksPassed,
        simulated: true,
      };
      state.audits = [...state.audits, record];
      appendEvent("conformance-audited", record.id, {
        auditId: record.id,
        standard: record.standard,
        scopeRef: record.scopeRef,
        checksTotal: record.checksTotal,
        checksPassed: record.checksPassed,
        simulated: true,
      });
      return { ...record };
    },

    async recordJourneyRun(
      input: RecordJourneyRunInput,
    ): Promise<ConformanceJourneyRunView> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      // JOURNEY LAW：simulated runs stay labeled——fixture 支撑面绝不伪造
      // measured duration（T11 换绑后由真实 harness 产生 measured runs）。
      if (
        !storyboardRunKindLandsRecord(
          input.runKind,
          controller.backing === "fixture-simulated",
        )
      ) {
        const journey = storyboardJourneyById(input.journeyId);
        throw youError(
          "YOU_E2E_JOURNEY_INVALID",
          `journey run on ${journey?.journeyId ?? input.journeyId} refused: a fixture-simulated harness never fabricates measured durations — simulated runs stay labeled (measured runs arrive with the T11 service binding)`,
          { reason: "fixture-backing-cannot-measure", journeyId: input.journeyId },
        );
      }
      return appendJourneyRun({
        journeyId: input.journeyId,
        failAtStep: input.failAtStep,
        kind: "golden",
        incidentClassRef: null,
      });
    },

    async exerciseRunbook(
      input: ExerciseRunbookInput,
    ): Promise<ConformanceRunbookEntryView> {
      if (!state) {
        throw invalidState("conformance-not-loaded", "conformance studio is not loaded");
      }
      const incidentClass = storyboardIncidentClassById(input.incidentClassId);
      if (!incidentClass || !incidentClass.valid) {
        throw youError(
          "YOU_RUNBOOK_INVALID",
          `incident class ${input.incidentClassId} not found — every runbook entry references a registered incident class (fail closed)`,
          { reason: "unknown-incident-class", incidentClassId: input.incidentClassId },
        );
      }
      // RUNBOOK LAW：exercised 由 ≥1 条 failure-injection journey 支撑——无
      // journey 的演练断言是 typed 拒绝（诚实态是显式标注 unexercised）。
      if (!storyboardExerciseViaIsLawful(input.via)) {
        throw youError(
          "YOU_RUNBOOK_INVALID",
          `runbook exercise on ${incidentClass.incidentClass} refused: an exercise claim without a failure-injection journey is a typed refusal — every entry is exercised by at least one failure-injection journey or explicitly marked unexercised`,
          { reason: "exercise-claim-without-journey", incidentClassId: incidentClass.id },
        );
      }
      // 步骤 1：failure-injection journey（失败于绑定步——JOURNEY LAW 记录
      // completed 步数 + failed-at 步名 + duration）。
      const journeyRun = appendJourneyRun({
        journeyId: "journey-launch-gate",
        failAtStep: incidentClass.boundStepIndex,
        kind: "failure-injection",
        incidentClassRef: incidentClass.incidentClass,
      });
      // 步骤 2：append exercised 新账本记录（registration → exercise 链；原
      // unexercised registration 记录保持不可变）。
      const registration = state.runbook
        .filter(
          (entry) =>
            entry.record.incidentClass === incidentClass.incidentClass &&
            entry.kind === "registration",
        )
        .at(-1);
      const record: IncidentRunbookEntry = {
        id: nextId("fx-c-runbook"),
        incidentClass: incidentClass.incidentClass,
        detection: incidentClass.detection,
        containment: incidentClass.containment,
        recovery: incidentClass.recovery,
        exercised: true,
        simulated: true,
      };
      const exercise: ConformanceRunbookEntryView = {
        record,
        kind: "exercise",
        supersedesEntryId: registration?.record.id ?? null,
      };
      state.runbook = [...state.runbook, exercise];
      appendEvent("runbook-entry-recorded", record.id, {
        entryId: record.id,
        incidentClass: record.incidentClass,
        exercised: true,
        kind: "exercise",
        supersedes: exercise.supersedesEntryId ?? "",
        journeyRunId: journeyRun.record.id,
        simulated: true,
      });
      return {
        record: { ...record },
        kind: exercise.kind,
        supersedesEntryId: exercise.supersedesEntryId,
      };
    },
  };

  return controller;
}
