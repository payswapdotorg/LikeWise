// W11B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：security review 行（findings verbatim + acceptance supersedes 链接）、
// load-test 报告行（peak/p99 + simulated-labeled 指示 + regressions verbatim）、
// conformance audit 行（counts verbatim + 派生通过态）、journey run 行 + 20 点
// 步骤状态投影（completed / failed-at / pending）、runbook 行（exercised /
// unexercised + supersedes）、区域视图模型、键盘转移与光标夹紧、各平面草稿视图。
import assert from "node:assert/strict";
import test from "node:test";
import {
  projectConformanceAcceptanceGate,
  type ConformanceJourneyRunView,
  type ConformanceReviewEntry,
  type ConformanceRunbookEntryView,
} from "./conformanceController.js";
import {
  clampConformanceIndex,
  projectAcceptanceDraftView,
  projectAuditDraftView,
  projectConformanceAuditRows,
  projectConformanceJourneyRunRows,
  projectConformanceJourneySteps,
  projectConformanceListRegionView,
  projectConformanceLoadReportRows,
  projectConformanceReviewRows,
  projectConformanceRunbookRows,
  projectJourneyDraftView,
  projectLoadDraftView,
  projectMetricsSourceKind,
  projectReviewDraftView,
  projectRunbookDraftView,
  projectRunbookLiveExercised,
  resolveConformanceKeyboardTransition,
} from "./conformanceStudioProjection.js";
import {
  CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
  CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
} from "./conformanceStoryboard.js";
import type { ConformanceStudioSnapshot } from "./conformanceController.js";

function reviewEntryFixture(
  overrides: Partial<ConformanceReviewEntry["record"]> & {
    kind?: ConformanceReviewEntry["kind"];
    supersedesReviewId?: string | null;
  } = {},
): ConformanceReviewEntry {
  const record = {
    id: "fx-c-review-001",
    scopeRef: "fx-content-render",
    reviewedAt: "2025-06-02T09:00:01.000Z",
    findingsCount: 3,
    accepted: false,
    simulated: true,
    ...overrides,
  };
  const kind = overrides.kind ?? "review";
  return {
    record,
    kind,
    supersedesReviewId:
      overrides.supersedesReviewId ?? (kind === "acceptance" ? record.id : null),
  };
}

test("review rows state findings verbatim and link acceptances to their reviews", () => {
  const rows = projectConformanceReviewRows([
    reviewEntryFixture(),
    reviewEntryFixture({
      id: "fx-c-review-002",
      accepted: true,
      kind: "acceptance",
      supersedesReviewId: "fx-c-review-001",
    }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.findingsCount, 3);
  assert.equal(rows[0]!.kind, "review");
  assert.equal(rows[0]!.accepted, false);
  assert.equal(rows[0]!.supersedesReviewId, null);
  assert.ok(rows[0]!.accessibleLabel.includes("3 findings verbatim"));
  assert.equal(rows[1]!.kind, "acceptance");
  assert.equal(rows[1]!.accepted, true);
  assert.equal(rows[1]!.supersedesReviewId, "fx-c-review-001");
  assert.ok(rows[1]!.accessibleLabel.includes("supersedes fx-c-review-001"));
});

test("load report rows carry peak/p99 verbatim, the simulated label and the verbatim regression list", () => {
  const rows = projectConformanceLoadReportRows([
    {
      id: "fx-c-load-001",
      scenarioRef: "fx-content-render-peak",
      peakRps: 240,
      p99Ms: 420,
      regressions: ["export.render p99 +80ms vs baseline", "render.queue depth 2.1x baseline"],
      simulated: true,
    },
    {
      id: "fx-c-load-002",
      scenarioRef: "fx-content-import-burst",
      peakRps: 95,
      p99Ms: 210,
      regressions: [],
      simulated: true,
    },
  ]);
  assert.equal(rows[0]!.peakRps, 240);
  assert.equal(rows[0]!.p99Ms, 420);
  assert.equal(rows[0]!.simulatedLabeled, true);
  assert.deepEqual(rows[0]!.regressions, [
    "export.render p99 +80ms vs baseline",
    "render.queue depth 2.1x baseline",
  ]);
  assert.ok(rows[0]!.accessibleLabel.includes("simulated-labeled"));
  assert.ok(rows[0]!.accessibleLabel.includes("export.render p99 +80ms"));
  assert.equal(rows[1]!.regressions.length, 0);
  assert.ok(rows[1]!.accessibleLabel.includes("no regressions listed"));
  // 指标来源显示分类（LOAD TEST LAW 三路）。
  assert.equal(projectMetricsSourceKind("measured"), "measured");
  assert.equal(projectMetricsSourceKind("simulated"), "simulated-labeled");
  assert.equal(projectMetricsSourceKind("invented"), "invented-refused");
});

test("audit rows state checks-total and checks-passed verbatim — never a bare pass", () => {
  const rows = projectConformanceAuditRows([
    {
      id: "fx-c-audit-001",
      standard: "WCAG 2.2 AA",
      scopeRef: "fx-content-wcag",
      checksTotal: 30,
      checksPassed: 27,
      simulated: true,
    },
    {
      id: "fx-c-audit-002",
      standard: "responsive-320px",
      scopeRef: "fx-content-viewport",
      checksTotal: 12,
      checksPassed: 12,
      simulated: true,
    },
  ]);
  assert.equal(rows[0]!.countsLabel, "27/30");
  assert.equal(rows[0]!.passState, "partial");
  assert.ok(rows[0]!.accessibleLabel.includes("27 of 30"));
  // 全过也带 counts（绝不 bare pass）。
  assert.equal(rows[1]!.countsLabel, "12/12");
  assert.equal(rows[1]!.passState, "all-passed");
  assert.ok(rows[1]!.accessibleLabel.includes("12 of 12"));
});

test("journey step projection marks completed steps, the failed step and pending steps over the 20-point table", () => {
  // 20 点表投影：completed 前 n 步，failedStep 标记失败步，其余 pending。
  const fullRun = {
    id: "fx-c-journey-001",
    journeyId: "launch-gate-001",
    stepsCompleted: CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
    failedStep: null,
    durationMs: 18200,
    simulated: true,
  };
  const fullStates = projectConformanceJourneySteps(
    fullRun,
    CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
  );
  assert.equal(fullStates.length, 20);
  assert.ok(fullStates.every((step) => step.state === "completed"));
  assert.equal(fullStates[9]!.stepName, "render-submit");

  const failedRun = {
    id: "fx-c-journey-002",
    journeyId: "launch-gate-001",
    stepsCompleted: 9,
    failedStep: "render-submit",
    durationMs: 9250,
    simulated: true,
  };
  const failedStates = projectConformanceJourneySteps(
    failedRun,
    CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
  );
  assert.equal(failedStates[8]!.state, "completed");
  assert.equal(failedStates[9]!.state, "failed");
  assert.equal(failedStates[9]!.stepName, "render-submit");
  assert.equal(failedStates[19]!.state, "pending");
  assert.equal(failedStates[19]!.stepName, "injected-failure-recovery");
  assert.ok(failedStates.slice(0, 9).every((step) => step.state === "completed"));
  assert.ok(failedStates.slice(10).every((step) => step.state === "pending"));
});

test("journey run rows carry kind, incident class link, duration and the accessible label", () => {
  const runs: readonly ConformanceJourneyRunView[] = [
    {
      record: {
        id: "fx-c-journey-001",
        journeyId: "launch-gate-001",
        stepsCompleted: 20,
        failedStep: null,
        durationMs: 18200,
        simulated: true,
      },
      kind: "golden",
      incidentClassRef: null,
    },
    {
      record: {
        id: "fx-c-journey-002",
        journeyId: "launch-gate-001",
        stepsCompleted: 19,
        failedStep: "injected-failure-recovery",
        durationMs: 17850,
        simulated: true,
      },
      kind: "failure-injection",
      incidentClassRef: "recovery-verification-failure",
    },
  ];
  const rows = projectConformanceJourneyRunRows(
    runs,
    CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
  );
  assert.equal(rows[0]!.kind, "golden");
  assert.equal(rows[0]!.stepsCompleted, 20);
  assert.equal(rows[0]!.failedStep, null);
  assert.equal(rows[0]!.steps.length, 20);
  assert.ok(rows[0]!.accessibleLabel.includes("full run"));
  assert.ok(rows[0]!.accessibleLabel.includes("simulated-labeled"));
  assert.equal(rows[1]!.kind, "failure-injection");
  assert.equal(rows[1]!.incidentClassRef, "recovery-verification-failure");
  assert.equal(rows[1]!.failedStep, "injected-failure-recovery");
  assert.ok(rows[1]!.accessibleLabel.includes("failed at injected-failure-recovery"));
  assert.ok(rows[1]!.accessibleLabel.includes("on recovery-verification-failure"));
});

test("runbook rows display detection / containment / recovery with exercised or explicitly-unexercised states", () => {
  const entries: readonly ConformanceRunbookEntryView[] = [
    {
      record: {
        id: "fx-c-runbook-001",
        incidentClass: "render-provider-outage",
        detection: "heartbeat loss",
        containment: "fail over",
        recovery: "re-submit queue",
        exercised: false,
        simulated: true,
      },
      kind: "registration",
      supersedesEntryId: null,
    },
    {
      record: {
        id: "fx-c-runbook-002",
        incidentClass: "render-provider-outage",
        detection: "heartbeat loss",
        containment: "fail over",
        recovery: "re-submit queue",
        exercised: true,
        simulated: true,
      },
      kind: "exercise",
      supersedesEntryId: "fx-c-runbook-001",
    },
  ];
  const rows = projectConformanceRunbookRows(entries);
  assert.equal(rows[0]!.exercised, false);
  assert.equal(rows[0]!.kind, "registration");
  assert.ok(rows[0]!.accessibleLabel.includes("explicitly marked unexercised"));
  assert.ok(rows[0]!.accessibleLabel.includes("detection: heartbeat loss"));
  assert.ok(rows[0]!.accessibleLabel.includes("containment: fail over"));
  assert.ok(rows[0]!.accessibleLabel.includes("recovery: re-submit queue"));
  assert.equal(rows[1]!.exercised, true);
  assert.equal(rows[1]!.supersedesEntryId, "fx-c-runbook-001");
  assert.ok(rows[1]!.accessibleLabel.includes("exercised by a failure-injection journey"));
  // live exercised 状态（追加序末位条目口径）。
  assert.equal(projectRunbookLiveExercised(entries, "render-provider-outage"), true);
  assert.equal(projectRunbookLiveExercised(entries.slice(0, 1), "render-provider-outage"), false);
  assert.equal(projectRunbookLiveExercised([], "render-provider-outage"), false);
});

test("region view model: loading without a snapshot, empty with no rows, ready with rows", () => {
  assert.equal(projectConformanceListRegionView(false, 0), "loading");
  assert.equal(projectConformanceListRegionView(true, 0), "empty");
  assert.equal(projectConformanceListRegionView(true, 3), "ready");
  assert.equal(projectConformanceListRegionView(false, 3), "loading");
});

test("keyboard transitions mirror the sibling surfaces and the cursor clamps at bounds", () => {
  const state = { totalJourneyRuns: 5 };
  assert.deepEqual(resolveConformanceKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("Home", state), {
    kind: "move",
    delta: -5,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("End", state), {
    kind: "move",
    delta: 5,
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("Enter", state), {
    kind: "select",
  });
  assert.deepEqual(resolveConformanceKeyboardTransition("Tab", state), { kind: "none" });
  assert.equal(clampConformanceIndex(-1, 5), 0);
  assert.equal(clampConformanceIndex(3, 5), 3);
  assert.equal(clampConformanceIndex(7, 5), 4);
  assert.equal(clampConformanceIndex(0, 0), 0);
});

function snapshotFixture(
  overrides: Partial<ConformanceStudioSnapshot> = {},
): ConformanceStudioSnapshot {
  return {
    displayName: "Conformance Studio — Aria",
    studioId: "fx-conformance-studio-001",
    metricsSources: ["measured", "simulated", "invented"],
    auditOutcomes: ["full", "partial"],
    runKinds: ["measured", "simulated"],
    reviewScopes: [
      { id: "review-scope-evidence-plane", scopeRef: "fx-content-evidence", findingsCount: 3 },
      { id: "review-scope-render-pipeline", scopeRef: "fx-content-render", findingsCount: 1 },
    ],
    loadScenarios: [
      {
        id: "load-scenario-render-peak",
        scenarioRef: "fx-content-render-peak",
        peakRps: 240,
        p99Ms: 420,
        regressions: [],
        valid: true,
      },
    ],
    standards: [
      {
        id: "standard-wcag-aa",
        standard: "WCAG 2.2 AA",
        scopeRef: "fx-content-wcag",
        checksTotal: 30,
        partialChecksPassed: 27,
      },
    ],
    journeys: [
      {
        id: "journey-launch-gate",
        journeyId: "launch-gate-001",
        steps: [...CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS],
        valid: true,
      },
    ],
    incidentClasses: [
      {
        id: "incident-render-provider-outage",
        incidentClass: "render-provider-outage",
        detection: "heartbeat loss",
        containment: "fail over",
        recovery: "re-submit queue",
        boundStepIndex: 10,
        valid: true,
      },
    ],
    reviews: [],
    loadReports: [],
    audits: [],
    journeyRuns: [],
    runbook: [],
    events: [],
    projectedAt: "2025-06-02T09:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("acceptance gate evaluates the SECURITY REVIEW LAW order fail-closed", () => {
  const snapshot = snapshotFixture({
    reviews: [
      {
        record: {
          id: "fx-c-review-001",
          scopeRef: "fx-content-render",
          reviewedAt: "2025-06-02T09:00:01.000Z",
          findingsCount: 1,
          accepted: false,
          simulated: true,
        },
        kind: "review",
        supersedesReviewId: null,
      },
      {
        record: {
          id: "fx-c-review-002",
          scopeRef: "fx-content-empty",
          reviewedAt: "2025-06-02T09:00:02.000Z",
          findingsCount: 0,
          accepted: false,
          simulated: true,
        },
        kind: "review",
        supersedesReviewId: null,
      },
      {
        record: {
          id: "fx-c-review-003",
          scopeRef: "fx-content-render",
          reviewedAt: "2025-06-02T09:00:03.000Z",
          findingsCount: 1,
          accepted: true,
          simulated: true,
        },
        kind: "acceptance",
        supersedesReviewId: "fx-c-review-001",
      },
    ],
  });
  // 未选择。
  assert.deepEqual(projectConformanceAcceptanceGate(null, null), {
    allowed: false,
    reason: "review-not-selected",
  });
  assert.deepEqual(projectConformanceAcceptanceGate(snapshot, null), {
    allowed: false,
    reason: "review-not-selected",
  });
  // 未知 review。
  assert.deepEqual(projectConformanceAcceptanceGate(snapshot, "fx-c-review-999"), {
    allowed: false,
    reason: "unknown-review",
  });
  // acceptance 记录本身不可再接受。
  assert.deepEqual(projectConformanceAcceptanceGate(snapshot, "fx-c-review-003"), {
    allowed: false,
    reason: "acceptance-not-acceptable",
  });
  // 已接受（fx-c-review-001 已有 acceptance 003）。
  assert.deepEqual(projectConformanceAcceptanceGate(snapshot, "fx-c-review-001"), {
    allowed: false,
    reason: "already-accepted",
  });
  // acceptance without findings（fx-c-review-002 携 0 findings）。
  assert.deepEqual(projectConformanceAcceptanceGate(snapshot, "fx-c-review-002"), {
    allowed: false,
    reason: "acceptance-without-findings",
  });
  // granted：一条未被接受且 findings 非零的 review。
  const withPending = snapshotFixture({
    reviews: [
      ...snapshot.reviews,
      {
        record: {
          id: "fx-c-review-004",
          scopeRef: "fx-content-evidence",
          reviewedAt: "2025-06-02T09:00:04.000Z",
          findingsCount: 3,
          accepted: false,
          simulated: true,
        },
        kind: "review",
        supersedesReviewId: null,
      },
    ],
  });
  assert.deepEqual(projectConformanceAcceptanceGate(withPending, "fx-c-review-004"), {
    allowed: true,
    reason: "granted",
  });
});

test("per-plane draft views resolve disabled reasons and projected facts deterministically", () => {
  // review 草稿。
  const scopes = [
    { id: "review-scope-evidence-plane", scopeRef: "fx-content-evidence", findingsCount: 3 },
    { id: "review-scope-render-pipeline", scopeRef: "fx-content-render", findingsCount: 1 },
  ];
  assert.deepEqual(
    projectReviewDraftView({ scopeId: "review-scope-render-pipeline" }, scopes),
    {
      scopeId: "review-scope-render-pipeline",
      disabledReason: null,
      findingsCount: 1,
      scopeRef: "fx-content-render",
    },
  );
  assert.deepEqual(projectReviewDraftView({ scopeId: "missing-scope" }, scopes), {
    scopeId: "missing-scope",
    disabledReason: "unknown-scope",
    findingsCount: null,
    scopeRef: null,
  });

  // load-test 草稿（invented / measured 是 typed 拒绝路径，非 UI 禁用）。
  const scenarios = [
    {
      id: "load-scenario-render-peak",
      peakRps: 240,
      p99Ms: 420,
      regressions: ["a", "b"],
      valid: true,
    },
    {
      id: "load-scenario-unregistered",
      peakRps: 0,
      p99Ms: 0,
      regressions: [],
      valid: false,
    },
  ];
  const loadDraft = projectLoadDraftView(
    { scenarioId: "load-scenario-render-peak", metricsSource: "invented" },
    scenarios,
  );
  assert.equal(loadDraft.disabledReason, null);
  assert.equal(loadDraft.peakRps, 240);
  assert.equal(loadDraft.regressionCount, 2);
  assert.equal(
    projectLoadDraftView(
      { scenarioId: "load-scenario-unregistered", metricsSource: "simulated" },
      scenarios,
    ).disabledReason,
    "unknown-scenario",
  );

  // audit 草稿（counts 投影；零检查标准不禁用——typed 拒绝路径）。
  const standards = [
    { id: "standard-wcag-aa", checksTotal: 30, partialChecksPassed: 27 },
    { id: "standard-zero-checks", checksTotal: 0, partialChecksPassed: 0 },
  ];
  const partialDraft = projectAuditDraftView(
    { standardId: "standard-wcag-aa", outcome: "partial" },
    standards,
  );
  assert.equal(partialDraft.projectedChecksPassed, 27);
  assert.equal(partialDraft.checksTotal, 30);
  const fullDraft = projectAuditDraftView(
    { standardId: "standard-wcag-aa", outcome: "full" },
    standards,
  );
  assert.equal(fullDraft.projectedChecksPassed, 30);
  const zeroDraft = projectAuditDraftView(
    { standardId: "standard-zero-checks", outcome: "full" },
    standards,
  );
  assert.equal(zeroDraft.disabledReason, null);
  assert.equal(zeroDraft.projectedChecksPassed, 0);
  assert.equal(
    projectAuditDraftView({ standardId: "missing", outcome: "full" }, standards)
      .disabledReason,
    "unknown-standard",
  );

  // journey 草稿（失败步名解析；越界步返回 null——绝不猜测）。
  const journeys = [
    { id: "journey-launch-gate", steps: [...CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS], valid: true },
  ];
  const journeyDraft = projectJourneyDraftView(
    { journeyId: "journey-launch-gate", failAtStep: 10, runKind: "simulated" },
    journeys,
  );
  assert.equal(journeyDraft.disabledReason, null);
  assert.equal(journeyDraft.totalSteps, 20);
  assert.equal(journeyDraft.failStepName, "render-submit");
  const fullJourneyDraft = projectJourneyDraftView(
    { journeyId: "journey-launch-gate", failAtStep: null, runKind: "measured" },
    journeys,
  );
  assert.equal(fullJourneyDraft.failStepName, null);
  const outOfRange = projectJourneyDraftView(
    { journeyId: "journey-launch-gate", failAtStep: 21, runKind: "simulated" },
    journeys,
  );
  assert.equal(outOfRange.failStepName, null);

  // runbook 草稿（绑定步解析）。
  const incidentClasses = [
    {
      id: "incident-render-provider-outage",
      boundStepIndex: 10,
      steps: [...CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS],
      valid: true,
    },
  ];
  const runbookDraft = projectRunbookDraftView(
    { incidentClassId: "incident-render-provider-outage", via: "exercise-claim" },
    incidentClasses,
  );
  assert.equal(runbookDraft.disabledReason, null);
  assert.equal(runbookDraft.boundStepIndex, 10);
  assert.equal(runbookDraft.boundStepName, "render-submit");

  // acceptance 草稿门视图（门显示独立呈现）。
  const gate = projectConformanceAcceptanceGate(null, null);
  const acceptanceDraft = projectAcceptanceDraftView({ reviewId: null }, gate);
  assert.equal(acceptanceDraft.reviewId, null);
  assert.equal(acceptanceDraft.gate.reason, "review-not-selected");
});
