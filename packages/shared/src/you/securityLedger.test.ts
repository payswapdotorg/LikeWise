import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { replaySecurityLedger } from "./securityLedger.js";
import { stableStringify } from "./serialize.js";

const SOLUTION_ID = "you_w11a_fold_solution01";

function event(type: SolutionEvent["type"], payload: Record<string, string | number | boolean>): SolutionEvent {
  return {
    id: `you_event_${type}-${Object.keys(payload).length}`,
    solutionId: SOLUTION_ID,
    type,
    occurredAt: "2026-01-01T00:00:01.000Z",
    subjectRef: null,
    payload,
    provenance: { source: "solution-event-ledger", generator: "agent", createdAt: "2026-01-01T00:00:01.000Z", lineage: [] },
  };
}

test("replaySecurityLedger requires at least one event (the W1A fold precedent)", () => {
  assert.throws(() => replaySecurityLedger([]), /requires at least one event/);
});

test("the fold reconstructs the review lifecycle: birth with findings verbatim, then the separate acceptance", () => {
  const events: SolutionEvent[] = [
    event("security-review-recorded", {
      reviewId: "review-1",
      scopeRef: "you_scope_export-review_01",
      reviewedAt: "2026-01-01T00:00:01.000Z",
      phase: "recorded",
      findingCount: 2,
      "finding.0": "signature:export-metadata-leak",
      "findingSeverity.0": "medium",
      "findingDescription.0": "export bundles embed provenance metadata for sensitive-media subjects",
      "finding.1": "signature:editor-plugin-unsigned",
      "findingSeverity.1": "high",
      "findingDescription.1": "the editor-plugin scan class admits unsigned plugin manifests",
      acceptanceId: "",
      acceptedBy: "",
      acceptanceReason: "",
      acceptedAt: "",
      findingSetDigest: "",
      simulated: true,
    }),
    event("security-review-recorded", {
      reviewId: "review-1",
      scopeRef: "you_scope_export-review_01",
      reviewedAt: "2026-01-01T00:00:01.000Z",
      phase: "accepted",
      findingCount: 2,
      "finding.0": "signature:export-metadata-leak",
      "findingSeverity.0": "medium",
      "findingDescription.0": "export bundles embed provenance metadata for sensitive-media subjects",
      "finding.1": "signature:editor-plugin-unsigned",
      "findingSeverity.1": "high",
      "findingDescription.1": "the editor-plugin scan class admits unsigned plugin manifests",
      acceptanceId: "acceptance-1",
      acceptedBy: "you_user_0000000000000001",
      acceptanceReason: "fixture-acceptance-reviewed",
      acceptedAt: "2026-01-01T00:00:02.000Z",
      findingSetDigest: "1a2b3c4d",
      simulated: true,
    }),
  ];
  const projection = replaySecurityLedger(events);
  assert.equal(projection.solutionId, SOLUTION_ID);
  const review = projection.securityReviews["review-1"];
  assert.ok(review !== undefined);
  // The latest event wins: the head is the accepted state with its decision facts.
  assert.equal(review.status, "accepted");
  assert.equal(review.scopeRef, "you_scope_export-review_01");
  assert.equal(review.findingCount, 2);
  assert.deepEqual(review.findings, [
    { signature: "signature:export-metadata-leak", severity: "medium", description: "export bundles embed provenance metadata for sensitive-media subjects" },
    { signature: "signature:editor-plugin-unsigned", severity: "high", description: "the editor-plugin scan class admits unsigned plugin manifests" },
  ]);
  assert.equal(review.acceptanceId, "acceptance-1");
  assert.equal(review.acceptedBy, "you_user_0000000000000001");
  assert.equal(review.acceptanceReason, "fixture-acceptance-reviewed");
  assert.equal(review.acceptedAt, "2026-01-01T00:00:02.000Z");
  assert.equal(review.findingSetDigest, "1a2b3c4d");
  assert.equal(review.simulated, true);
});

test("the fold reconstructs load tests with the metrics truth facts (source + measuredAt provenance)", () => {
  const events: SolutionEvent[] = [
    event("load-test-recorded", {
      reportId: "loadtest-1",
      scenarioRef: "you_scenario_peak-render_01",
      peakRps: 240.5,
      p99Ms: 180.25,
      source: "simulated",
      measuredAt: "2026-01-01T00:00:03.000Z",
      regressionCount: 2,
      "regression.0": "p99 regressed at peak rps",
      "regression.1": "export throughput flat at 200 rps",
      simulated: true,
    }),
  ];
  const projection = replaySecurityLedger(events);
  const loadTest = projection.loadTests["loadtest-1"];
  assert.ok(loadTest !== undefined);
  assert.equal(loadTest.scenarioRef, "you_scenario_peak-render_01");
  assert.equal(loadTest.peakRps, 240.5);
  assert.equal(loadTest.p99Ms, 180.25);
  assert.equal(loadTest.source, "simulated");
  assert.equal(loadTest.measuredAt, "2026-01-01T00:00:03.000Z");
  assert.deepEqual(loadTest.regressions, ["p99 regressed at peak rps", "export throughput flat at 200 rps"]);
  assert.equal(loadTest.regressionCount, 2);
  assert.equal(loadTest.simulated, true);
});

test("events referencing unknown ids fold defensively (the total-fold precedent)", () => {
  const events: SolutionEvent[] = [
    event("security-review-recorded", {
      reviewId: "review-1",
      scopeRef: "you_scope_export-review_01",
      reviewedAt: "2026-01-01T00:00:01.000Z",
      phase: "recorded",
      findingCount: 0,
      simulated: true,
    }),
    // A review event without a reviewId key folds to nothing.
    event("security-review-recorded", {
      scopeRef: "you_scope_export-review_01",
      phase: "recorded",
      findingCount: 0,
      simulated: true,
    }),
    // A load-test event without a reportId key folds to nothing.
    event("load-test-recorded", {
      scenarioRef: "you_scenario_peak-render_01",
      peakRps: 240.5,
      p99Ms: 180.25,
      source: "simulated",
      regressionCount: 0,
      simulated: true,
    }),
    // Foreign plane events are ignored by the default case.
    event("conformance-audited", { standard: "wcag-21", checksTotal: 12, checksPassed: 12, simulated: true }),
    event("runbook-entry-recorded", { incidentClass: "provider-outage", simulated: true }),
  ];
  const projection = replaySecurityLedger(events);
  // The zero-findings birth folds as a recorded (clean) review.
  const review = projection.securityReviews["review-1"];
  assert.ok(review !== undefined);
  assert.equal(review.status, "recorded");
  assert.equal(review.findingCount, 0);
  assert.deepEqual(review.findings, []);
  assert.equal(review.acceptanceId, "");
  assert.equal(Object.keys(projection.securityReviews).length, 1);
  assert.equal(Object.keys(projection.loadTests).length, 0);
});

test("same events => same projection (byte-identical under stableStringify)", () => {
  const events: SolutionEvent[] = [
    event("security-review-recorded", {
      reviewId: "review-1",
      scopeRef: "you_scope_export-review_01",
      reviewedAt: "2026-01-01T00:00:01.000Z",
      phase: "recorded",
      findingCount: 1,
      "finding.0": "signature:export-metadata-leak",
      "findingSeverity.0": "medium",
      "findingDescription.0": "export bundles embed provenance metadata",
      simulated: true,
    }),
    event("security-review-recorded", {
      reviewId: "review-1",
      scopeRef: "you_scope_export-review_01",
      reviewedAt: "2026-01-01T00:00:01.000Z",
      phase: "accepted",
      findingCount: 1,
      "finding.0": "signature:export-metadata-leak",
      "findingSeverity.0": "medium",
      "findingDescription.0": "export bundles embed provenance metadata",
      acceptanceId: "acceptance-1",
      acceptedBy: "you_user_0000000000000001",
      acceptanceReason: "fixture-acceptance-reviewed",
      acceptedAt: "2026-01-01T00:00:02.000Z",
      findingSetDigest: "1a2b3c4d",
      simulated: true,
    }),
    event("load-test-recorded", {
      reportId: "loadtest-1",
      scenarioRef: "you_scenario_peak-render_01",
      peakRps: 240.5,
      p99Ms: 180.25,
      source: "simulated",
      measuredAt: "2026-01-01T00:00:03.000Z",
      regressionCount: 1,
      "regression.0": "p99 regressed at peak rps",
      simulated: true,
    }),
  ];
  const first = replaySecurityLedger(events);
  const second = replaySecurityLedger([...events]);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.ok(Object.isFrozen(first.securityReviews["review-1"]?.findings));
  assert.ok(Object.isFrozen(first.loadTests["loadtest-1"]?.regressions));
});
