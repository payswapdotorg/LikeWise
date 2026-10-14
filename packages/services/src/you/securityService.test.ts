import assert from "node:assert/strict";
import test from "node:test";
import type { OpaqueId } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import type { SecurityReviewFinding } from "../../../shared/src/you/securityReview.js";
import { createSecurityService, SecurityService } from "./securityService.js";

const SOLUTION_ID: OpaqueId = "you_w11a_service_solution01";

interface Harness {
  readonly service: SecurityService;
  readonly clock: DeterministicClock;
}

function harness(seed?: string): Harness {
  const clock = createDeterministicClock();
  const service = createSecurityService({
    workspaceIdentity: "ws-w11a-service-test",
    seed: seed ?? "you-w11a-security-service-test",
    clock,
  });
  return { service, clock };
}

const THREAT_MITIGATED = {
  threatClass: "export-leak",
  vector: "export bundles embed provenance metadata for sensitive-media subjects",
  mitigationRef: "you_mitigation_export-md_00000001",
  residual: "provenance stripping covers known exporters; novel exporters remain unreviewed until W12",
} as const;

const THREAT_UNMITIGATED = {
  threatClass: "provider-failure",
  vector: "a provider outage stalls every render job mid-flight with no drain",
  mitigationRef: null,
  residual: "no circuit breaker is wired yet; jobs stall until the provider recovers or an operator intervenes",
} as const;

const REVIEW_FINDINGS: readonly SecurityReviewFinding[] = [
  { signature: "signature:export-metadata-leak", severity: "medium", description: "export bundles embed provenance metadata for sensitive-media subjects" },
  { signature: "signature:editor-plugin-unsigned", severity: "high", description: "the editor-plugin scan class admits unsigned plugin manifests" },
];

const REVIEW_SCOPE = "you_scope_export-review_01";

function measurement(clock: DeterministicClock, overrides: Record<string, unknown> = {}) {
  return {
    scenarioRef: "you_scenario_peak-render_01",
    source: "simulated",
    peakRps: 240.5,
    p99Ms: 180.25,
    measuredAt: clock.now(),
    simulated: true,
    ...overrides,
  };
}

// -- threat-model machinery -----------------------------------------------------

test("threat entries: immutable, honest residual, typed refusals (YOU_SECURITY_REVIEW_INVALID)", () => {
  const { service } = harness();
  const mitigated = service.recordThreatModelEntry(SOLUTION_ID, { ...THREAT_MITIGATED });
  assert.ok(mitigated.ok);
  if (mitigated.ok) {
    assert.equal(mitigated.value.entry.threatClass, "export-leak");
    assert.equal(mitigated.value.entry.mitigationRef, THREAT_MITIGATED.mitigationRef);
    assert.equal(mitigated.value.entry.residual, THREAT_MITIGATED.residual);
    assert.equal(mitigated.value.entry.simulated, true);
    assert.ok(Object.isFrozen(mitigated.value.entry));
  }
  // The unmitigated case records mitigationRef null with the residual still stated.
  const unmitigated = service.recordThreatModelEntry(SOLUTION_ID, { ...THREAT_UNMITIGATED });
  assert.ok(unmitigated.ok);
  if (unmitigated.ok) {
    assert.equal(unmitigated.value.entry.mitigationRef, null);
    assert.equal(unmitigated.value.entry.residual.length > 0, true);
  }
  // Typed intake refusals (never silent).
  // An empty mitigationRef string is a lie (null is the honest form) — typed refusal.
  for (const [patch, reason] of [
    [{ threatClass: "physical-theft" }, "threat-class-invalid"],
    [{ vector: "  " }, "vector-empty"],
    [{ residual: "" }, "residual-missing"],
    [{ mitigationRef: "" }, "mitigation-ref-invalid"],
  ] as const) {
    const refused = service.recordThreatModelEntry(SOLUTION_ID, { ...THREAT_MITIGATED, ...patch });
    assert.ok(!refused.ok, reason);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_SECURITY_REVIEW_INVALID", reason);
      assert.equal(refused.error.details["reason"], reason, reason);
      assert.equal(refused.error.simulated, true);
    }
  }
  // Readouts: sorted list + unknown lookup.
  const entries = service.threatModelOfSolution(SOLUTION_ID);
  assert.ok(entries.ok);
  if (entries.ok) {
    assert.equal(entries.value.entries.length, 2);
  }
  const unknown = service.threatModelOf(SOLUTION_ID, "you_threat-model_missing000000");
  assert.ok(!unknown.ok);
  if (!unknown.ok) {
    assert.equal(unknown.error.code, "YOU_SECURITY_REVIEW_INVALID");
    assert.equal(unknown.error.details["reason"], "unknown-threat-entry");
  }
});

// -- review lifecycle machinery --------------------------------------------------

test("the review lifecycle: birth records findings verbatim; the acceptance is a separate immutable decision", () => {
  const { service } = harness();
  const birth = service.recordSecurityReview(SOLUTION_ID, { scopeRef: REVIEW_SCOPE, findings: [...REVIEW_FINDINGS] });
  assert.ok(birth.ok);
  if (birth.ok) {
    assert.equal(birth.value.record.accepted, false);
    assert.equal(birth.value.record.findingsCount, 2);
    assert.deepEqual(birth.value.findings, REVIEW_FINDINGS);
    assert.equal(birth.value.record.simulated, true);
    assert.ok(Object.isFrozen(birth.value.record));
    assert.ok(Object.isFrozen(birth.value.findings));
  }
  const statusRecorded = service.securityReviewStatusOf(SOLUTION_ID, birth.ok ? birth.value.record.id : "");
  assert.ok(statusRecorded.ok);
  if (statusRecorded.ok) {
    assert.equal(statusRecorded.value.status, "recorded");
  }
  // No acceptance while only recorded.
  const noAcceptance = service.securityReviewAcceptanceOf(SOLUTION_ID, birth.ok ? birth.value.record.id : "");
  assert.ok(!noAcceptance.ok);
  if (!noAcceptance.ok) {
    assert.equal(noAcceptance.error.code, "YOU_SECURITY_REVIEW_INVALID");
    assert.equal(noAcceptance.error.details["reason"], "no-acceptance");
  }
  // THE SEPARATE DECISION.
  const accepted = service.acceptSecurityReview(SOLUTION_ID, birth.ok ? birth.value.record.id : "", {
    acceptedBy: "you_user_0000000000000001",
    reason: "service-test-acceptance",
  });
  assert.ok(accepted.ok);
  if (accepted.ok) {
    assert.equal(accepted.value.acceptance.findingCount, 2);
    assert.equal(accepted.value.acceptance.reviewId, birth.ok ? birth.value.record.id : "");
    assert.equal(accepted.value.acceptance.simulated, true);
    assert.ok(Object.isFrozen(accepted.value.acceptance));
  }
  const statusAccepted = service.securityReviewStatusOf(SOLUTION_ID, birth.ok ? birth.value.record.id : "");
  assert.ok(statusAccepted.ok);
  if (statusAccepted.ok) {
    assert.equal(statusAccepted.value.status, "accepted");
  }
  // The birth record stays immutable — the decision never rewrites it.
  const birthAgain = service.securityReviewOf(SOLUTION_ID, birth.ok ? birth.value.record.id : "");
  assert.ok(birthAgain.ok);
  if (birthAgain.ok) {
    assert.equal(birthAgain.value.record.accepted, false);
  }
});

test("THE SECURITY REVIEW LAW (service teeth): acceptance without findings, already-accepted, unknown review", () => {
  const { service } = harness();
  // A clean pass records honestly, then cannot be accepted.
  const clean = service.recordSecurityReview(SOLUTION_ID, { scopeRef: REVIEW_SCOPE, findings: [] });
  assert.ok(clean.ok);
  if (clean.ok) {
    assert.equal(clean.value.record.findingsCount, 0);
    const refused = service.acceptSecurityReview(SOLUTION_ID, clean.value.record.id, {
      acceptedBy: "you_user_0000000000000001",
      reason: "attempted-acceptance",
    });
    assert.ok(!refused.ok);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_SECURITY_REVIEW_INVALID");
      assert.equal(refused.error.details["reason"], "acceptance-without-findings");
    }
    // The refusal never moved the lifecycle head.
    const status = service.securityReviewStatusOf(SOLUTION_ID, clean.value.record.id);
    assert.ok(status.ok);
    if (status.ok) {
      assert.equal(status.value.status, "recorded");
    }
  }
  // An accepted review cannot be re-accepted (the decision is immutable).
  const review = service.recordSecurityReview(SOLUTION_ID, { scopeRef: REVIEW_SCOPE, findings: [...REVIEW_FINDINGS] });
  assert.ok(review.ok);
  if (review.ok) {
    const first = service.acceptSecurityReview(SOLUTION_ID, review.value.record.id, {
      acceptedBy: "you_user_0000000000000001",
      reason: "service-test-acceptance",
    });
    assert.ok(first.ok);
    const again = service.acceptSecurityReview(SOLUTION_ID, review.value.record.id, {
      acceptedBy: "you_user_0000000000000001",
      reason: "service-test-acceptance-again",
    });
    assert.ok(!again.ok);
    if (!again.ok) {
      assert.equal(again.error.code, "YOU_SECURITY_REVIEW_INVALID");
      assert.equal(again.error.details["reason"], "already-accepted");
    }
  }
  // Unknown review acceptance + lookups.
  const unknownAccept = service.acceptSecurityReview(SOLUTION_ID, "you_security-review_missing00000", {
    acceptedBy: "you_user_0000000000000001",
    reason: "r",
  });
  assert.ok(!unknownAccept.ok);
  if (!unknownAccept.ok) {
    assert.equal(unknownAccept.error.details["reason"], "unknown-review");
  }
  // Review-intake refusals (typed, honest types — the runtime validator refuses).
  const emptyScope = service.recordSecurityReview(SOLUTION_ID, { scopeRef: "", findings: [] });
  assert.ok(!emptyScope.ok);
  if (!emptyScope.ok) {
    assert.equal(emptyScope.error.details["reason"], "scope-ref-empty");
  }
  const duplicate = service.recordSecurityReview(SOLUTION_ID, {
    scopeRef: REVIEW_SCOPE,
    findings: [REVIEW_FINDINGS[0]!, { ...REVIEW_FINDINGS[0]!, severity: "high" }],
  });
  assert.ok(!duplicate.ok);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.details["reason"], "finding-duplicate");
  }
  const blankDescription = service.recordSecurityReview(SOLUTION_ID, {
    scopeRef: REVIEW_SCOPE,
    findings: [{ signature: "signature:x", severity: "low", description: " " }],
  });
  assert.ok(!blankDescription.ok);
  if (!blankDescription.ok) {
    assert.equal(blankDescription.error.details["reason"], "finding-description-empty");
  }
});

// -- load-test machinery -----------------------------------------------------------

test("THE LOAD TEST LAW (service teeth): invented metrics and malformed reports are typed YOU_LOAD_TEST_INVALID", () => {
  const { service, clock } = harness();
  const run = service.runLoadTest(SOLUTION_ID, {
    measurement: measurement(clock),
    regressions: ["p99 regressed at peak rps", "export throughput flat at 200 rps"],
  });
  assert.ok(run.ok);
  if (run.ok) {
    assert.equal(run.value.report.peakRps, 240.5);
    assert.equal(run.value.report.p99Ms, 180.25);
    assert.deepEqual(run.value.report.regressions, ["p99 regressed at peak rps", "export throughput flat at 200 rps"]);
    assert.equal(run.value.measurement.source, "simulated");
    assert.equal(run.value.report.simulated, true);
    assert.ok(Object.isFrozen(run.value.report));
    assert.ok(Object.isFrozen(run.value.report.regressions));
  }
  for (const [patch, reason] of [
    [{ peakRps: 0 }, "metrics-invented"],
    [{ peakRps: -12 }, "metrics-invented"],
    [{ peakRps: Number.NaN }, "metrics-invented"],
    [{ p99Ms: 0 }, "metrics-invented"],
    [{ p99Ms: Number.NEGATIVE_INFINITY }, "metrics-invented"],
    [{ source: "estimated" }, "source-invalid"],
    [{ measuredAt: "" }, "measured-at-missing"],
    [{ scenarioRef: "" }, "scenario-ref-empty"],
  ] as const) {
    const refused = service.runLoadTest(SOLUTION_ID, { measurement: measurement(clock, patch), regressions: [] });
    assert.ok(!refused.ok, reason);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_LOAD_TEST_INVALID", reason);
      assert.equal(refused.error.details["reason"], reason, reason);
      assert.equal(refused.error.simulated, true);
    }
  }
  for (const [regressions, reason] of [
    [["ok", ""], "regression-empty-string"],
    [["ok", "ok"], "regression-duplicate"],
    [["ok", "  "], "regression-empty-string"],
  ] as const) {
    const refused = service.runLoadTest(SOLUTION_ID, { measurement: measurement(clock), regressions: [...regressions] });
    assert.ok(!refused.ok, reason);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_LOAD_TEST_INVALID", reason);
      assert.equal(refused.error.details["reason"], reason, reason);
    }
  }
  // Readouts: the report states the measurement verbatim; unknown lookups.
  const reports = service.loadTestsOf(SOLUTION_ID);
  assert.ok(reports.ok);
  if (reports.ok) {
    assert.equal(reports.value.reports.length, 1);
  }
  const unknownReport = service.loadTestOf(SOLUTION_ID, "you_load-test_missing000000000");
  assert.ok(!unknownReport.ok);
  if (!unknownReport.ok) {
    assert.equal(unknownReport.error.details["reason"], "unknown-load-test");
  }
  const unknownMeasurement = service.loadTestMeasurementOf(SOLUTION_ID, "you_load-test_missing000000000");
  assert.ok(!unknownMeasurement.ok);
  if (!unknownMeasurement.ok) {
    assert.equal(unknownMeasurement.error.details["reason"], "unknown-load-test");
  }
});

// -- ledger + projection + determinism ----------------------------------------------

test("the ledger journals the security lifecycle; the live projection equals the replay fold", () => {
  const { service, clock } = harness();
  service.recordThreatModelEntry(SOLUTION_ID, { ...THREAT_MITIGATED });
  const review = service.recordSecurityReview(SOLUTION_ID, { scopeRef: REVIEW_SCOPE, findings: [...REVIEW_FINDINGS] });
  assert.ok(review.ok);
  if (review.ok) {
    const accepted = service.acceptSecurityReview(SOLUTION_ID, review.value.record.id, {
      acceptedBy: "you_user_0000000000000001",
      reason: "service-test-acceptance",
    });
    assert.ok(accepted.ok);
  }
  service.runLoadTest(SOLUTION_ID, { measurement: measurement(clock), regressions: ["p99 regressed at peak rps"] });
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const reviewEvents = events.value.filter((event) => event.type === "security-review-recorded");
    assert.equal(reviewEvents.length, 2);
    assert.equal(reviewEvents[0]?.payload["phase"], "recorded");
    assert.equal(reviewEvents[0]?.payload["findingCount"], 2);
    assert.equal(reviewEvents[0]?.payload["findingDescription.1"], REVIEW_FINDINGS[1]?.description);
    assert.equal(reviewEvents[1]?.payload["phase"], "accepted");
    assert.equal(reviewEvents[1]?.payload["findingSetDigest"] !== "", true);
    const loadTestEvents = events.value.filter((event) => event.type === "load-test-recorded");
    assert.equal(loadTestEvents.length, 1);
    assert.equal(loadTestEvents[0]?.payload["source"], "simulated");
    assert.equal(loadTestEvents[0]?.payload["regression.0"], "p99 regressed at peak rps");
  }
  const live = service.projectionOf(SOLUTION_ID);
  assert.ok(live.ok);
  if (live.ok && events.ok) {
    const replay = SecurityService.replay(events.value);
    assert.equal(stableStringify(live.value), stableStringify(replay));
    // The fold reconstructs the accepted head with its decision facts.
    const acceptedEntry = replay.securityReviews[(review as { value: { record: { id: string } } }).value.record.id];
    assert.ok(acceptedEntry !== undefined);
    assert.equal(acceptedEntry.status, "accepted");
    assert.equal(acceptedEntry.findingCount, 2);
    assert.equal(acceptedEntry.findings[1]?.description, REVIEW_FINDINGS[1]?.description);
    assert.equal(acceptedEntry.findingSetDigest !== "", true);
    const loadTestEntry = replay.loadTests;
    assert.equal(Object.keys(loadTestEntry).length, 1);
  }
});

test("the full service is deterministic: same seed => byte-identical ledgers and records; a different seed diverges", () => {
  const first = harness("you-w11a-determinism-seed");
  const second = harness("you-w11a-determinism-seed");
  for (const h of [first, second]) {
    serviceScenario(h);
  }
  const firstEvents = first.service.ledgerEventsOf(SOLUTION_ID);
  const secondEvents = second.service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(firstEvents.ok && secondEvents.ok);
  if (firstEvents.ok && secondEvents.ok) {
    assert.equal(stableStringify(firstEvents.value), stableStringify(secondEvents.value));
  }
  const firstHash = first.service.ledgerHashOf(SOLUTION_ID);
  const secondHash = second.service.ledgerHashOf(SOLUTION_ID);
  assert.ok(firstHash.ok && secondHash.ok);
  if (firstHash.ok && secondHash.ok) {
    assert.equal(firstHash.value, secondHash.value);
  }
  // A different seed diverges (the seed is load-bearing).
  const other = harness("you-w11a-determinism-other");
  serviceScenario(other);
  const otherEvents = other.service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(otherEvents.ok && firstEvents.ok);
  if (otherEvents.ok && firstEvents.ok) {
    assert.notEqual(stableStringify(otherEvents.value), stableStringify(firstEvents.value));
  }
});

function serviceScenario(h: Harness): void {
  const review = h.service.recordSecurityReview(SOLUTION_ID, { scopeRef: REVIEW_SCOPE, findings: [...REVIEW_FINDINGS] });
  if (review.ok) {
    h.service.acceptSecurityReview(SOLUTION_ID, review.value.record.id, {
      acceptedBy: "you_user_0000000000000001",
      reason: "determinism-acceptance",
    });
  }
  h.service.recordThreatModelEntry(SOLUTION_ID, { ...THREAT_MITIGATED });
  h.service.runLoadTest(SOLUTION_ID, {
    measurement: { scenarioRef: "you_scenario_peak-render_01", source: "simulated", peakRps: 240.5, p99Ms: 180.25, measuredAt: h.clock.now(), simulated: true },
    regressions: ["p99 regressed at peak rps"],
  });
}
