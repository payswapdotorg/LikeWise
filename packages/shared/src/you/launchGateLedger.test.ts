import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { replayLaunchGateLedger } from "./launchGateLedger.js";
import { stableStringify } from "./serialize.js";

const SOLUTION_ID = "you_w12a_fold_solution01";

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

test("replayLaunchGateLedger requires at least one event (the W1A fold precedent)", () => {
  assert.throws(() => replayLaunchGateLedger([]), /requires at least one event/);
});

test("the fold reconstructs the checklist with its 20 points, evidence refs and derived pass states", () => {
  const points: Record<string, string | number | boolean> = {};
  for (let index = 0; index < 20; index += 1) {
    points[`pointDescription.${index}`] = `point ${index + 1} description`;
    points[`pointJourneyRef.${index}`] = index === 6 ? "" : `you_journey_evidence-${index}`;
    points[`pointPassed.${index}`] = index !== 6;
  }
  const events: SolutionEvent[] = [
    event("launch-gate-checked", {
      checklistId: "checklist-1",
      checkedAt: "2026-01-01T00:00:01.000Z",
      pointCount: 20,
      passedCount: 19,
      gatePassed: false,
      ...points,
      simulated: true,
    }),
  ];
  const projection = replayLaunchGateLedger(events);
  assert.equal(projection.solutionId, SOLUTION_ID);
  const checklist = projection.checklists["checklist-1"];
  assert.ok(checklist !== undefined);
  assert.equal(checklist.checkedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(checklist.points.length, 20);
  assert.equal(checklist.points[0]?.point, 1);
  assert.equal(checklist.points[0]?.description, "point 1 description");
  assert.equal(checklist.points[0]?.journeyEvidenceRef, "you_journey_evidence-0");
  assert.equal(checklist.points[0]?.passed, true);
  // Point 7: no evidence — the honest null folds as "".
  assert.equal(checklist.points[6]?.journeyEvidenceRef, "");
  assert.equal(checklist.points[6]?.passed, false);
  assert.equal(checklist.points[19]?.point, 20);
  assert.equal(checklist.passedCount, 19);
  assert.equal(checklist.gatePassed, false);
  assert.equal(checklist.simulated, true);
  assert.ok(Object.isFrozen(checklist.points));
});

test("the fold reconstructs the signoff and declaration with the law's reference facts", () => {
  const events: SolutionEvent[] = [
    event("operator-signoff-recorded", {
      signoffId: "signoff-1",
      checklistRef: "checklist-1",
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
      simulated: true,
    }),
    event("release-declared", {
      declarationId: "declaration-1",
      signoffRef: "signoff-1",
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
      simulated: true,
    }),
  ];
  const projection = replayLaunchGateLedger(events);
  const signoff = projection.signoffs["signoff-1"];
  assert.ok(signoff !== undefined);
  assert.equal(signoff.checklistRef, "checklist-1");
  assert.equal(signoff.signedBy, "you_user_0000000000000001");
  assert.equal(signoff.signedAt, "2026-01-01T00:00:02.000Z");
  assert.equal(signoff.simulated, true);
  const declaration = projection.declarations["declaration-1"];
  assert.ok(declaration !== undefined);
  assert.equal(declaration.signoffRef, "signoff-1");
  assert.equal(declaration.evidenceBundleRef, "you_evidence-bundle_w12a-fixture01");
  assert.equal(declaration.rollbackEvidenceRef, "you_rollback-evidence_w12a-fixture01");
  assert.equal(declaration.declaredAt, "2026-01-01T00:00:03.000Z");
  assert.equal(declaration.simulated, true);
  // The lifecycle heads: the checklist is signed; the signoff is declared.
  assert.equal(projection.signedChecklists["checklist-1"], "signoff-1");
  assert.equal(projection.declaredSignoffs["signoff-1"], "declaration-1");
});

test("the latest event per record id wins (the platformLedger imports rule)", () => {
  const events: SolutionEvent[] = [
    event("launch-gate-checked", {
      checklistId: "checklist-1",
      checkedAt: "2026-01-01T00:00:01.000Z",
      pointCount: 1,
      passedCount: 0,
      gatePassed: false,
      "pointDescription.0": "first check",
      "pointJourneyRef.0": "",
      "pointPassed.0": false,
      simulated: true,
    }),
    event("launch-gate-checked", {
      checklistId: "checklist-1",
      checkedAt: "2026-01-01T00:00:09.000Z",
      pointCount: 1,
      passedCount: 1,
      gatePassed: true,
      "pointDescription.0": "second check",
      "pointJourneyRef.0": "you_journey_evidence-0",
      "pointPassed.0": true,
      simulated: true,
    }),
  ];
  const projection = replayLaunchGateLedger(events);
  const checklist = projection.checklists["checklist-1"];
  assert.ok(checklist !== undefined);
  assert.equal(checklist.checkedAt, "2026-01-01T00:00:09.000Z");
  assert.equal(checklist.points[0]?.description, "second check");
  assert.equal(checklist.gatePassed, true);
  assert.equal(Object.keys(projection.checklists).length, 1);
});

test("events referencing unknown ids fold defensively (the total-fold precedent)", () => {
  const events: SolutionEvent[] = [
    // A checklist event without a checklistId key folds to nothing.
    event("launch-gate-checked", { checkedAt: "2026-01-01T00:00:01.000Z", pointCount: 0, passedCount: 0, gatePassed: false, simulated: true }),
    // A signoff event without a signoffId key folds to nothing.
    event("operator-signoff-recorded", { checklistRef: "checklist-1", signedBy: "you_user_0000000000000001", signedAt: "2026-01-01T00:00:02.000Z", simulated: true }),
    // A declaration event without a declarationId key folds to nothing.
    event("release-declared", { signoffRef: "signoff-1", evidenceBundleRef: "b", rollbackEvidenceRef: "r", declaredAt: "2026-01-01T00:00:03.000Z", simulated: true }),
    // Foreign plane events are ignored by the default case.
    event("security-review-recorded", { reviewId: "review-1", phase: "recorded", findingCount: 0, simulated: true }),
    event("load-test-recorded", { reportId: "loadtest-1", peakRps: 240.5, p99Ms: 180.25, simulated: true }),
  ];
  const projection = replayLaunchGateLedger(events);
  assert.equal(Object.keys(projection.checklists).length, 0);
  assert.equal(Object.keys(projection.signoffs).length, 0);
  assert.equal(Object.keys(projection.declarations).length, 0);
  assert.equal(Object.keys(projection.signedChecklists).length, 0);
  assert.equal(Object.keys(projection.declaredSignoffs).length, 0);
});

test("a signoff for an empty checklistRef rides but does not create a signed head (defensive)", () => {
  const events: SolutionEvent[] = [
    event("operator-signoff-recorded", {
      signoffId: "signoff-1",
      checklistRef: "",
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
      simulated: true,
    }),
  ];
  const projection = replayLaunchGateLedger(events);
  assert.ok(projection.signoffs["signoff-1"] !== undefined);
  assert.equal(Object.keys(projection.signedChecklists).length, 0);
});

test("same events => same projection (byte-identical under stableStringify)", () => {
  const events: SolutionEvent[] = [
    event("launch-gate-checked", {
      checklistId: "checklist-1",
      checkedAt: "2026-01-01T00:00:01.000Z",
      pointCount: 2,
      passedCount: 2,
      gatePassed: true,
      "pointDescription.0": "a",
      "pointJourneyRef.0": "you_journey_a",
      "pointPassed.0": true,
      "pointDescription.1": "b",
      "pointJourneyRef.1": "you_journey_b",
      "pointPassed.1": true,
      simulated: true,
    }),
    event("operator-signoff-recorded", {
      signoffId: "signoff-1",
      checklistRef: "checklist-1",
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
      simulated: true,
    }),
    event("release-declared", {
      declarationId: "declaration-1",
      signoffRef: "signoff-1",
      evidenceBundleRef: "you_evidence-bundle_w12a-fixture01",
      rollbackEvidenceRef: "you_rollback-evidence_w12a-fixture01",
      declaredAt: "2026-01-01T00:00:03.000Z",
      simulated: true,
    }),
  ];
  const first = replayLaunchGateLedger(events);
  const second = replayLaunchGateLedger([...events]);
  assert.equal(stableStringify(first), stableStringify(second));
});
