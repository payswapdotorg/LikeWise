// W11B logic tests — 视图状态 store（node:test，无 DOM）。
//
// 覆盖：初始态、加载生命周期（begin → succeeded 应用快照 / failure 记录真实错误并
// 可恢复）、action error inline-only（status 保持 ready 且可关闭）、applySnapshot
// 保持仍存在的选中（被清除的回退末位）、journey 光标与选中联动、各平面草稿转移
//（scope / scenario+metricsSource / standard+outcome / journey+failAt+runKind /
// incidentClass+via）、demo 状态机（started → step recorded → finished → reset）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createConformancePaneStore,
  CONFORMANCE_PANE_INITIAL_STATE,
} from "./conformanceStudioStore.js";
import type { ConformanceStudioSnapshot } from "./conformanceController.js";
import type {
  ConformanceDemoStepOutcome,
  ConformanceDemoStepId,
} from "./conformanceStudioDemo.js";

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
      {
        id: "review-scope-evidence-plane",
        scopeRef: "fx-content-evidence",
        findingsCount: 3,
      },
      {
        id: "review-scope-render-pipeline",
        scopeRef: "fx-content-render",
        findingsCount: 1,
      },
    ],
    loadScenarios: [
      {
        id: "load-scenario-render-peak",
        scenarioRef: "fx-content-render-peak",
        peakRps: 240,
        p99Ms: 420,
        regressions: ["export.render p99 +80ms vs baseline"],
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
        steps: [
          "workspace-create",
          "intent-capture",
          "solution-open",
          "solution-inspect",
        ],
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
        boundStepIndex: 2,
        valid: true,
      },
    ],
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
          scopeRef: "fx-content-render",
          reviewedAt: "2025-06-02T09:00:02.000Z",
          findingsCount: 1,
          accepted: true,
          simulated: true,
        },
        kind: "acceptance",
        supersedesReviewId: "fx-c-review-001",
      },
    ],
    loadReports: [
      {
        id: "fx-c-load-001",
        scenarioRef: "fx-content-render-peak",
        peakRps: 240,
        p99Ms: 420,
        regressions: ["export.render p99 +80ms vs baseline"],
        simulated: true,
      },
    ],
    audits: [
      {
        id: "fx-c-audit-001",
        standard: "WCAG 2.2 AA",
        scopeRef: "fx-content-wcag",
        checksTotal: 30,
        checksPassed: 27,
        simulated: true,
      },
    ],
    journeyRuns: [
      {
        record: {
          id: "fx-c-journey-001",
          journeyId: "launch-gate-001",
          stepsCompleted: 4,
          failedStep: null,
          durationMs: 4600,
          simulated: true,
        },
        kind: "golden",
        incidentClassRef: null,
      },
      {
        record: {
          id: "fx-c-journey-002",
          journeyId: "launch-gate-001",
          stepsCompleted: 1,
          failedStep: "intent-capture",
          durationMs: 2450,
          simulated: true,
        },
        kind: "failure-injection",
        incidentClassRef: "render-provider-outage",
      },
    ],
    runbook: [
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
    ],
    events: [],
    projectedAt: "2025-06-02T09:00:05.000Z",
    simulated: true,
    ...overrides,
  };
}

function demoOutcomeFixture(
  stepId: ConformanceDemoStepId,
  overrides: Partial<ConformanceDemoStepOutcome> = {},
): ConformanceDemoStepOutcome {
  return {
    stepId,
    summary: `summary-${stepId}`,
    refs: [],
    uiHint: {},
    ...overrides,
  };
}

test("initial state is idle with the W11B default drafts and no selection", () => {
  const store = createConformancePaneStore();
  assert.equal(store.getState().status, "idle");
  assert.equal(store.getState().panel, "review");
  assert.equal(store.getState().snapshot, null);
  assert.equal(store.getState().errorMessage, null);
  assert.equal(store.getState().actionError, null);
  assert.equal(store.getState().reviewDraftScopeId, "review-scope-evidence-plane");
  assert.equal(store.getState().loadDraftScenarioId, "load-scenario-render-peak");
  assert.equal(store.getState().loadDraftMetricsSource, "simulated");
  assert.equal(store.getState().auditDraftStandardId, "standard-wcag-aa");
  assert.equal(store.getState().auditDraftOutcome, "partial");
  assert.equal(store.getState().journeyDraftId, "journey-launch-gate");
  assert.equal(store.getState().journeyDraftFailAtStep, null);
  assert.equal(store.getState().journeyDraftRunKind, "simulated");
  assert.equal(store.getState().runbookDraftIncidentClassId, "incident-render-provider-outage");
  assert.equal(store.getState().runbookDraftVia, "failure-injection");
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});

test("load lifecycle: begin → succeeded applies the snapshot and selects the latest records", () => {
  const store = createConformancePaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = snapshotFixture();
  store.getState().loadSucceeded(snapshot);
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().errorMessage, null);
  assert.equal(store.getState().snapshot, snapshot);
  // 默认检视末位记录（确定性）。
  assert.equal(store.getState().selectedReviewId, "fx-c-review-002");
  assert.equal(store.getState().selectedLoadReportId, "fx-c-load-001");
  assert.equal(store.getState().selectedAuditId, "fx-c-audit-001");
  assert.equal(store.getState().selectedJourneyRunId, "fx-c-journey-002");
  assert.equal(store.getState().journeyIndex, 1);
  assert.equal(store.getState().selectedRunbookEntryId, "fx-c-runbook-002");
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createConformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: conformance studio is not loaded");
  assert.equal(store.getState().status, "error");
  assert.equal(
    store.getState().errorMessage,
    "YOU_INVALID_STATE: conformance studio is not loaded",
  );
  // 恢复路径：再次 beginLoad 清错误并回到 loading。
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().errorMessage, null);
});

test("action error is inline only: status stays ready and is dismissible", () => {
  const store = createConformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().actionFailed({
    code: "YOU_LOAD_TEST_INVALID",
    message: "invented metrics refused",
  });
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().actionError?.code, "YOU_LOAD_TEST_INVALID");
  assert.equal(store.getState().actionError?.message, "invented metrics refused");
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("applySnapshot keeps still-existing selections; dropped ones fall back deterministically", () => {
  const store = createConformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().selectReview("fx-c-review-001");
  store.getState().selectJourneyRun("fx-c-journey-001");
  assert.equal(store.getState().journeyIndex, 0);

  // 保留仍存在的选中。
  const kept = snapshotFixture();
  store.getState().applySnapshot(kept);
  assert.equal(store.getState().selectedReviewId, "fx-c-review-001");
  assert.equal(store.getState().selectedJourneyRunId, "fx-c-journey-001");
  assert.equal(store.getState().journeyIndex, 0);

  // 被清除的选中回退末位。
  const shrunk = snapshotFixture({
    reviews: kept.reviews.slice(0, 1),
    journeyRuns: [kept.journeyRuns[1]!],
  });
  store.getState().applySnapshot(shrunk);
  assert.equal(store.getState().selectedReviewId, "fx-c-review-001");
  assert.equal(store.getState().selectedJourneyRunId, "fx-c-journey-002");
  assert.equal(store.getState().journeyIndex, 0);
});

test("journey cursor and selection move together; index clamps at the list bounds", () => {
  const store = createConformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());

  store.getState().moveJourneyIndex(-1);
  assert.equal(store.getState().journeyIndex, 0);
  assert.equal(store.getState().selectedJourneyRunId, "fx-c-journey-001");
  store.getState().moveJourneyIndex(1);
  assert.equal(store.getState().journeyIndex, 1);
  assert.equal(store.getState().selectedJourneyRunId, "fx-c-journey-002");
  store.getState().moveJourneyIndex(5);
  assert.equal(store.getState().journeyIndex, 1);

  store.getState().setJourneyIndex(0);
  assert.equal(store.getState().selectedJourneyRunId, "fx-c-journey-001");
  store.getState().selectJourneyRun("fx-c-journey-002");
  assert.equal(store.getState().journeyIndex, 1);
  store.getState().selectJourneyRun(null);
  assert.equal(store.getState().journeyIndex, 0);
  assert.equal(store.getState().selectedJourneyRunId, null);
});

test("panel and per-plane draft transitions are independent view state", () => {
  const store = createConformancePaneStore();
  store.getState().setPanel("journey");
  assert.equal(store.getState().panel, "journey");

  store.getState().setReviewDraftScope("review-scope-render-pipeline");
  assert.equal(store.getState().reviewDraftScopeId, "review-scope-render-pipeline");
  store.getState().setLoadDraftScenario("load-scenario-import-burst");
  assert.equal(store.getState().loadDraftScenarioId, "load-scenario-import-burst");
  store.getState().setLoadDraftMetricsSource("measured");
  assert.equal(store.getState().loadDraftMetricsSource, "measured");
  store.getState().setAuditDraftStandard("standard-viewport-320");
  assert.equal(store.getState().auditDraftStandardId, "standard-viewport-320");
  store.getState().setAuditDraftOutcome("full");
  assert.equal(store.getState().auditDraftOutcome, "full");
  store.getState().setJourneyDraft("journey-unknown-legacy");
  assert.equal(store.getState().journeyDraftId, "journey-unknown-legacy");
  store.getState().setJourneyDraftFailAtStep(10);
  assert.equal(store.getState().journeyDraftFailAtStep, 10);
  store.getState().setJourneyDraftRunKind("measured");
  assert.equal(store.getState().journeyDraftRunKind, "measured");
  store.getState().setRunbookDraftIncidentClass("incident-consent-revocation-lag");
  assert.equal(
    store.getState().runbookDraftIncidentClassId,
    "incident-consent-revocation-lag",
  );
  store.getState().setRunbookDraftVia("exercise-claim");
  assert.equal(store.getState().runbookDraftVia, "exercise-claim");
  // 其它视图状态不受草稿转移影响。
  assert.equal(store.getState().panel, "journey");
  assert.equal(store.getState().status, "idle");
});

test("drafts fall back to initial defaults when the registry drops them in a snapshot", () => {
  const store = createConformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().setReviewDraftScope("review-scope-render-pipeline");
  store.getState().setLoadDraftScenario("load-scenario-render-peak");
  store.getState().setAuditDraftStandard("standard-wcag-aa");
  store.getState().setJourneyDraft("journey-launch-gate");
  store.getState().setRunbookDraftIncidentClass("incident-render-provider-outage");

  // 注册面为空的快照：草稿回退初始默认值。
  const emptied = snapshotFixture({
    reviewScopes: [],
    loadScenarios: [],
    standards: [],
    journeys: [],
    incidentClasses: [],
  });
  store.getState().applySnapshot(emptied);
  assert.equal(
    store.getState().reviewDraftScopeId,
    CONFORMANCE_PANE_INITIAL_STATE.reviewDraftScopeId,
  );
  assert.equal(
    store.getState().loadDraftScenarioId,
    CONFORMANCE_PANE_INITIAL_STATE.loadDraftScenarioId,
  );
  assert.equal(
    store.getState().auditDraftStandardId,
    CONFORMANCE_PANE_INITIAL_STATE.auditDraftStandardId,
  );
  assert.equal(
    store.getState().journeyDraftId,
    CONFORMANCE_PANE_INITIAL_STATE.journeyDraftId,
  );
  assert.equal(
    store.getState().runbookDraftIncidentClassId,
    CONFORMANCE_PANE_INITIAL_STATE.runbookDraftIncidentClassId,
  );
});

test("demo state machine: started -> step recorded -> finished -> reset", () => {
  const store = createConformancePaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);

  store.getState().demoStepRecorded(demoOutcomeFixture("load"));
  store.getState().demoStepRecorded(
    demoOutcomeFixture("review-record-findings", { refs: ["fx-c-review-001"] }),
  );
  assert.equal(store.getState().demo.stepIndex, 2);
  assert.equal(store.getState().demo.outcomes.length, 2);
  assert.equal(store.getState().demo.outcomes[0]!.stepId, "load");
  assert.equal(store.getState().demo.outcomes[1]!.refs[0], "fx-c-review-001");

  store.getState().demoFinished();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, true);
  assert.equal(store.getState().demo.outcomes.length, 2);

  store.getState().demoReset();
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});
