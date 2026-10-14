// YOU W11A security fixture scenario — scripted, deterministic
// orchestration of the full hardening-verification arrow
// (docs/you/WORK_ORDERS.md W11A; FIXTURES.md):
//
//   threat T1 modeled (mitigated; residual stated honestly) -> threat
//   T2 modeled (unmitigated: mitigationRef null, residual stated
//   honestly anyway — the honesty law) -> threat-intake refusals
//   (class-invalid / vector-empty / residual-missing /
//   mitigation-ref-invalid) -> review R1 recorded (two findings
//   verbatim, phase "recorded") -> review-intake refusals
//   (scope-empty / finding-duplicate / finding-description-empty) ->
//   clean review R2 recorded (zero findings — for the refusal path) ->
//   ACCEPTANCE WITHOUT FINDINGS refused on R2 (THE SECURITY REVIEW LAW)
//   -> findings accepted on R1 (the separate immutable decision
//   referencing the finding set: count + digest) -> acceptance
//   refusals (already-accepted + unknown-review) -> load test run
//   (simulated-labeled, peak/p99 from the measurement, regressions
//   listed verbatim) -> load-test refusals (invented metrics: zero /
//   negative / NaN; source-invalid; measured-at-missing; malformed
//   report: regression-empty-string / regression-duplicate) -> lookup
//   refusals (unknown entries / reviews / load tests; no-acceptance on
//   the clean review) -> ledger readout (both wave-11 security events
//   present; live projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation). Fixture entries/reviews/acceptances/
// reports stay `simulated: true` (truth law). The scenario owns the
// injected clock (the load-test measurement reads it at the run step).

import type { OpaqueId, SolutionEvent } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createSecurityService, SecurityService } from "./securityService.js";
import {
  SECURITY_SCENARIO_ACCEPTANCE_INPUT,
  SECURITY_SCENARIO_LOAD_TEST,
  SECURITY_SCENARIO_LOAD_TEST_REGRESSIONS,
  SECURITY_SCENARIO_REVIEW_FINDINGS,
  SECURITY_SCENARIO_REVIEW_SCOPE,
  SECURITY_SCENARIO_SEED,
  SECURITY_SCENARIO_SOLUTION_ID,
  SECURITY_SCENARIO_THREAT_ONE,
  SECURITY_SCENARIO_THREAT_TWO,
  outcomeCode,
  type SecurityScenarioOptions,
  type SecurityScenarioStep,
  type SecurityScenarioTrace,
} from "./securityFixtureScenarioTypes.js";

export {
  SECURITY_SCENARIO_ACCEPTANCE_INPUT,
  SECURITY_SCENARIO_LOAD_TEST,
  SECURITY_SCENARIO_LOAD_TEST_REGRESSIONS,
  SECURITY_SCENARIO_REVIEW_FINDINGS,
  SECURITY_SCENARIO_REVIEW_SCOPE,
  SECURITY_SCENARIO_SEED,
  SECURITY_SCENARIO_SOLUTION_ID,
  SECURITY_SCENARIO_THREAT_ONE,
  SECURITY_SCENARIO_THREAT_TWO,
} from "./securityFixtureScenarioTypes.js";
export type { SecurityScenarioOptions, SecurityScenarioStep, SecurityScenarioTrace } from "./securityFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): SecurityScenarioStep {
  return { step: index, name, facts };
}

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

/**
 * Runs the full scripted security-authority scenario against a freshly
 * created service. Deterministic: same seed + same options => identical
 * trace.
 */
export function runSecurityFixtureScenario(options: SecurityScenarioOptions = {}): SecurityScenarioTrace {
  const solutionId = options.solutionId ?? SECURITY_SCENARIO_SOLUTION_ID;
  // The scenario owns the injected clock (the load-test measurement
  // reads it at the run step — deterministic timestamps).
  const clock: DeterministicClock = createDeterministicClock();
  const service = createSecurityService({
    workspaceIdentity: "ws-w11a-scenario-security",
    seed: options.seed ?? SECURITY_SCENARIO_SEED,
    clock,
  });

  const steps: SecurityScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};
  const chainWalk: string[] = [];
  const threatEntryIds: OpaqueId[] = [];
  const reviewIds: OpaqueId[] = [];

  // -- threat T1 modeled (mitigated; residual stated honestly) ------------------

  const threatOne = must(
    service.recordThreatModelEntry(solutionId, { ...SECURITY_SCENARIO_THREAT_ONE }),
    "recordThreatOne",
  );
  threatEntryIds.push(threatOne.entry.id);
  chainWalk.push("threat-modeled");
  steps.push(
    step((stepIndex += 1), "threat-modeled-mitigated", {
      entryId: threatOne.entry.id,
      threatClass: threatOne.entry.threatClass,
      vector: threatOne.entry.vector,
      mitigationRef: threatOne.entry.mitigationRef ?? "",
      residualStated: threatOne.entry.residual.length > 0,
      simulated: threatOne.entry.simulated,
    }),
  );

  // -- threat T2 modeled (unmitigated: mitigationRef null, residual honest) -----

  const threatTwo = must(
    service.recordThreatModelEntry(solutionId, { ...SECURITY_SCENARIO_THREAT_TWO }),
    "recordThreatTwo",
  );
  threatEntryIds.push(threatTwo.entry.id);
  steps.push(
    step((stepIndex += 1), "threat-modeled-unmitigated", {
      entryId: threatTwo.entry.id,
      threatClass: threatTwo.entry.threatClass,
      mitigationRefIsNull: threatTwo.entry.mitigationRef === null,
      residualStated: threatTwo.entry.residual.length > 0,
      residualNeverZeroed: threatTwo.entry.residual.trim().length > 0,
      simulated: threatTwo.entry.simulated,
    }),
  );

  // -- threat-intake refusals (typed, never silent) -------------------------------

  const badClass = service.recordThreatModelEntry(solutionId, { ...SECURITY_SCENARIO_THREAT_ONE, threatClass: "physical-theft" });
  refusalOutcomes["threat-class-invalid"] = outcomeCode(badClass);
  const badVector = service.recordThreatModelEntry(solutionId, { ...SECURITY_SCENARIO_THREAT_ONE, vector: "   " });
  refusalOutcomes["threat-vector-empty"] = outcomeCode(badVector);
  const badResidual = service.recordThreatModelEntry(solutionId, { ...SECURITY_SCENARIO_THREAT_ONE, residual: "" });
  refusalOutcomes["threat-residual-missing"] = outcomeCode(badResidual);
  const badMitigation = service.recordThreatModelEntry(solutionId, { ...SECURITY_SCENARIO_THREAT_ONE, mitigationRef: "" });
  refusalOutcomes["threat-mitigation-ref-invalid"] = outcomeCode(badMitigation);
  steps.push(
    step((stepIndex += 1), "threat-intake-refusals", {
      "threat-class-invalid": refusalOutcomes["threat-class-invalid"] ?? "",
      "threat-vector-empty": refusalOutcomes["threat-vector-empty"] ?? "",
      "threat-residual-missing": refusalOutcomes["threat-residual-missing"] ?? "",
      "threat-mitigation-ref-invalid": refusalOutcomes["threat-mitigation-ref-invalid"] ?? "",
    }),
  );

  // -- review R1 recorded (two findings verbatim, phase "recorded") ---------------

  const reviewOne = must(
    service.recordSecurityReview(solutionId, {
      scopeRef: SECURITY_SCENARIO_REVIEW_SCOPE,
      findings: [...SECURITY_SCENARIO_REVIEW_FINDINGS],
    }),
    "recordReviewOne",
  );
  reviewIds.push(reviewOne.record.id);
  chainWalk.push("review-recorded");
  steps.push(
    step((stepIndex += 1), "review-recorded", {
      reviewId: reviewOne.record.id,
      scopeRef: reviewOne.record.scopeRef,
      reviewedAt: reviewOne.record.reviewedAt,
      findingsCount: reviewOne.record.findingsCount,
      findingZero: reviewOne.findings[0]?.signature ?? "",
      findingOne: reviewOne.findings[1]?.signature ?? "",
      accepted: reviewOne.record.accepted,
      simulated: reviewOne.record.simulated,
    }),
  );

  // -- review-intake refusals ------------------------------------------------------

  const badScope = service.recordSecurityReview(solutionId, { scopeRef: "", findings: [] });
  refusalOutcomes["review-scope-empty"] = outcomeCode(badScope);
  const duplicateFinding = service.recordSecurityReview(solutionId, {
    scopeRef: SECURITY_SCENARIO_REVIEW_SCOPE,
    findings: [SECURITY_SCENARIO_REVIEW_FINDINGS[0]!, { ...SECURITY_SCENARIO_REVIEW_FINDINGS[0]!, severity: "high" }],
  });
  refusalOutcomes["review-finding-duplicate"] = outcomeCode(duplicateFinding);
  const emptyDescription = service.recordSecurityReview(solutionId, {
    scopeRef: SECURITY_SCENARIO_REVIEW_SCOPE,
    findings: [{ signature: "signature:x", severity: "low", description: "  " }],
  });
  refusalOutcomes["review-finding-description-empty"] = outcomeCode(emptyDescription);
  steps.push(
    step((stepIndex += 1), "review-intake-refusals", {
      "review-scope-empty": refusalOutcomes["review-scope-empty"] ?? "",
      "review-finding-duplicate": refusalOutcomes["review-finding-duplicate"] ?? "",
      "review-finding-description-empty": refusalOutcomes["review-finding-description-empty"] ?? "",
    }),
  );

  // -- clean review R2 recorded (zero findings — the refusal-path carrier) --------

  const reviewTwo = must(
    service.recordSecurityReview(solutionId, { scopeRef: SECURITY_SCENARIO_REVIEW_SCOPE, findings: [] }),
    "recordReviewTwo",
  );
  reviewIds.push(reviewTwo.record.id);
  steps.push(
    step((stepIndex += 1), "clean-review-recorded", {
      reviewId: reviewTwo.record.id,
      findingsCount: reviewTwo.record.findingsCount,
      findingsCountIsZero: reviewTwo.record.findingsCount === 0,
      accepted: reviewTwo.record.accepted,
    }),
  );

  // -- ACCEPTANCE WITHOUT FINDINGS refused on R2 (THE SECURITY REVIEW LAW) --------

  const acceptClean = service.acceptSecurityReview(solutionId, reviewTwo.record.id, { ...SECURITY_SCENARIO_ACCEPTANCE_INPUT });
  refusalOutcomes["acceptance-without-findings"] = outcomeCode(acceptClean);
  steps.push(
    step((stepIndex += 1), "acceptance-without-findings", {
      reviewId: reviewTwo.record.id,
      refusal: refusalOutcomes["acceptance-without-findings"] ?? "",
      cleanReviewStillRecorded: must(service.securityReviewStatusOf(solutionId, reviewTwo.record.id), "statusAfterRefusal").status === "recorded",
    }),
  );

  // -- findings accepted on R1 (the separate immutable decision) ------------------

  const acceptance = must(
    service.acceptSecurityReview(solutionId, reviewOne.record.id, { ...SECURITY_SCENARIO_ACCEPTANCE_INPUT }),
    "acceptReviewOne",
  );
  chainWalk.push("findings-accepted");
  steps.push(
    step((stepIndex += 1), "findings-accepted", {
      reviewId: reviewOne.record.id,
      acceptanceId: acceptance.acceptance.id,
      findingCount: acceptance.acceptance.findingCount,
      findingSetDigest: acceptance.acceptance.findingSetDigest,
      acceptedBy: acceptance.acceptance.acceptedBy,
      reason: acceptance.acceptance.reason,
      acceptedAt: acceptance.acceptance.acceptedAt,
      digestMatchesFindings: acceptance.acceptance.findingCount === reviewOne.findings.length,
      statusAccepted: must(service.securityReviewStatusOf(solutionId, reviewOne.record.id), "statusAfterAccept").status === "accepted",
    }),
  );

  // -- acceptance refusals (already-accepted + unknown-review) ---------------------

  const reAccept = service.acceptSecurityReview(solutionId, reviewOne.record.id, { ...SECURITY_SCENARIO_ACCEPTANCE_INPUT });
  refusalOutcomes["acceptance-already-accepted"] = outcomeCode(reAccept);
  const acceptUnknown = service.acceptSecurityReview(solutionId, "you_security-review_missing00000", { ...SECURITY_SCENARIO_ACCEPTANCE_INPUT });
  refusalOutcomes["acceptance-unknown-review"] = outcomeCode(acceptUnknown);
  steps.push(
    step((stepIndex += 1), "acceptance-refusals", {
      "acceptance-already-accepted": refusalOutcomes["acceptance-already-accepted"] ?? "",
      "acceptance-unknown-review": refusalOutcomes["acceptance-unknown-review"] ?? "",
    }),
  );

  // -- load test run (simulated-labeled; regressions listed verbatim) -------------

  const measuredAt = clock.now();
  const loadTest = must(
    service.runLoadTest(solutionId, {
      measurement: {
        scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef,
        source: SECURITY_SCENARIO_LOAD_TEST.source,
        peakRps: SECURITY_SCENARIO_LOAD_TEST.peakRps,
        p99Ms: SECURITY_SCENARIO_LOAD_TEST.p99Ms,
        measuredAt,
        simulated: true,
      },
      regressions: [...SECURITY_SCENARIO_LOAD_TEST_REGRESSIONS],
    }),
    "runLoadTest",
  );
  chainWalk.push("load-test-recorded");
  steps.push(
    step((stepIndex += 1), "load-test-run", {
      reportId: loadTest.report.id,
      scenarioRef: loadTest.report.scenarioRef,
      source: loadTest.measurement.source,
      sourceIsSimulated: loadTest.measurement.source === "simulated",
      peakRps: loadTest.report.peakRps,
      p99Ms: loadTest.report.p99Ms,
      measuredAt: loadTest.measurement.measuredAt,
      regressionCount: loadTest.report.regressions.length,
      regressionZero: loadTest.report.regressions[0] ?? "",
      regressionOne: loadTest.report.regressions[1] ?? "",
      regressionsVerbatim: loadTest.report.regressions.length === SECURITY_SCENARIO_LOAD_TEST_REGRESSIONS.length,
      simulated: loadTest.report.simulated,
    }),
  );

  // -- load-test refusals: invented metrics + malformed report ---------------------

  const inventedZero = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "simulated", peakRps: 0, p99Ms: 180.25, measuredAt: clock.now(), simulated: true },
    regressions: [],
  });
  refusalOutcomes["loadtest-metrics-invented-zero"] = outcomeCode(inventedZero);
  const inventedNegative = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "simulated", peakRps: 240.5, p99Ms: -1, measuredAt: clock.now(), simulated: true },
    regressions: [],
  });
  refusalOutcomes["loadtest-metrics-invented-negative"] = outcomeCode(inventedNegative);
  const inventedNan = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "simulated", peakRps: Number.NaN, p99Ms: 180.25, measuredAt: clock.now(), simulated: true },
    regressions: [],
  });
  refusalOutcomes["loadtest-metrics-invented-nan"] = outcomeCode(inventedNan);
  const badSource = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "estimated", peakRps: 240.5, p99Ms: 180.25, measuredAt: clock.now(), simulated: true },
    regressions: [],
  });
  refusalOutcomes["loadtest-source-invalid"] = outcomeCode(badSource);
  const missingMeasuredAt = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "simulated", peakRps: 240.5, p99Ms: 180.25, measuredAt: "", simulated: true },
    regressions: [],
  });
  refusalOutcomes["loadtest-measured-at-missing"] = outcomeCode(missingMeasuredAt);
  const emptyRegression = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "simulated", peakRps: 240.5, p99Ms: 180.25, measuredAt: clock.now(), simulated: true },
    regressions: ["p99 regressed", ""],
  });
  refusalOutcomes["loadtest-regression-empty-string"] = outcomeCode(emptyRegression);
  const duplicateRegression = service.runLoadTest(solutionId, {
    measurement: { scenarioRef: SECURITY_SCENARIO_LOAD_TEST.scenarioRef, source: "simulated", peakRps: 240.5, p99Ms: 180.25, measuredAt: clock.now(), simulated: true },
    regressions: ["p99 regressed", "p99 regressed"],
  });
  refusalOutcomes["loadtest-regression-duplicate"] = outcomeCode(duplicateRegression);
  steps.push(
    step((stepIndex += 1), "load-test-refusals", {
      "loadtest-metrics-invented-zero": refusalOutcomes["loadtest-metrics-invented-zero"] ?? "",
      "loadtest-metrics-invented-negative": refusalOutcomes["loadtest-metrics-invented-negative"] ?? "",
      "loadtest-metrics-invented-nan": refusalOutcomes["loadtest-metrics-invented-nan"] ?? "",
      "loadtest-source-invalid": refusalOutcomes["loadtest-source-invalid"] ?? "",
      "loadtest-measured-at-missing": refusalOutcomes["loadtest-measured-at-missing"] ?? "",
      "loadtest-regression-empty-string": refusalOutcomes["loadtest-regression-empty-string"] ?? "",
      "loadtest-regression-duplicate": refusalOutcomes["loadtest-regression-duplicate"] ?? "",
    }),
  );

  // -- lookup refusals (error taxonomy) ----------------------------------------------

  const unknownThreat = service.threatModelOf(solutionId, "you_threat-model_missing000000");
  refusalOutcomes["lookup-unknown-threat-entry"] = outcomeCode(unknownThreat);
  const unknownReview = service.securityReviewOf(solutionId, "you_security-review_missing00000");
  refusalOutcomes["lookup-unknown-review"] = outcomeCode(unknownReview);
  const noAcceptance = service.securityReviewAcceptanceOf(solutionId, reviewTwo.record.id);
  refusalOutcomes["lookup-no-acceptance"] = outcomeCode(noAcceptance);
  const unknownLoadTest = service.loadTestOf(solutionId, "you_load-test_missing000000000");
  refusalOutcomes["lookup-unknown-load-test"] = outcomeCode(unknownLoadTest);
  steps.push(
    step((stepIndex += 1), "lookup-refusals", {
      "lookup-unknown-threat-entry": refusalOutcomes["lookup-unknown-threat-entry"] ?? "",
      "lookup-unknown-review": refusalOutcomes["lookup-unknown-review"] ?? "",
      "lookup-no-acceptance": refusalOutcomes["lookup-no-acceptance"] ?? "",
      "lookup-unknown-load-test": refusalOutcomes["lookup-unknown-load-test"] ?? "",
    }),
  );

  // -- ledger readout: both wave-11 security events, projection == replay ----------

  const events: readonly SolutionEvent[] = must(service.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }
  const live = must(service.projectionOf(solutionId), "projectionOf");
  const replay = SecurityService.replay(events);
  const projectionMatchesReplay = stableStringify(live) === stableStringify(replay);
  const ledgerHash = must(service.ledgerHashOf(solutionId), "ledgerHashOf");
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      securityReviewRecorded: eventCounts["security-review-recorded"] ?? 0,
      loadTestRecorded: eventCounts["load-test-recorded"] ?? 0,
    }),
  );

  return {
    solutionId,
    threatEntryIds,
    reviewIds,
    acceptedReviewId: reviewOne.record.id,
    acceptanceId: acceptance.acceptance.id,
    cleanReviewId: reviewTwo.record.id,
    loadTestReportId: loadTest.report.id,
    chainWalk,
    refusalOutcomes,
    eventCounts,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
