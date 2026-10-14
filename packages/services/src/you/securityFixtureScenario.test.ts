import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { runSecurityFixtureScenario } from "./securityFixtureScenario.js";

test("the scenario walks the full W11A chain (threat modeled -> review recorded -> findings accepted -> load test run)", () => {
  const trace = runSecurityFixtureScenario();
  // The chain walk: the work-order arrow, in order.
  assert.deepEqual(trace.chainWalk, ["threat-modeled", "review-recorded", "findings-accepted", "load-test-recorded"]);
  // Two threat entries: one mitigated, one unmitigated-honest.
  assert.equal(trace.threatEntryIds.length, 2);
  // Two reviews: the findings review (accepted) + the clean review (the refusal-path carrier).
  assert.equal(trace.reviewIds.length, 2);
  assert.equal(trace.acceptedReviewId.length > 0, true);
  assert.equal(trace.acceptanceId.length > 0, true);
  assert.equal(trace.cleanReviewId.length > 0, true);
  assert.equal(trace.loadTestReportId.length > 0, true);
  assert.equal(trace.simulated, true);
});

test("every refusal path is a typed error (never a silent skip)", () => {
  const trace = runSecurityFixtureScenario();
  const expected: readonly (readonly [string, string])[] = [
    ["threat-class-invalid", "YOU_SECURITY_REVIEW_INVALID"],
    ["threat-vector-empty", "YOU_SECURITY_REVIEW_INVALID"],
    ["threat-residual-missing", "YOU_SECURITY_REVIEW_INVALID"],
    ["threat-mitigation-ref-invalid", "YOU_SECURITY_REVIEW_INVALID"],
    ["review-scope-empty", "YOU_SECURITY_REVIEW_INVALID"],
    ["review-finding-duplicate", "YOU_SECURITY_REVIEW_INVALID"],
    ["review-finding-description-empty", "YOU_SECURITY_REVIEW_INVALID"],
    ["acceptance-without-findings", "YOU_SECURITY_REVIEW_INVALID"],
    ["acceptance-already-accepted", "YOU_SECURITY_REVIEW_INVALID"],
    ["acceptance-unknown-review", "YOU_SECURITY_REVIEW_INVALID"],
    ["loadtest-metrics-invented-zero", "YOU_LOAD_TEST_INVALID"],
    ["loadtest-metrics-invented-negative", "YOU_LOAD_TEST_INVALID"],
    ["loadtest-metrics-invented-nan", "YOU_LOAD_TEST_INVALID"],
    ["loadtest-source-invalid", "YOU_LOAD_TEST_INVALID"],
    ["loadtest-measured-at-missing", "YOU_LOAD_TEST_INVALID"],
    ["loadtest-regression-empty-string", "YOU_LOAD_TEST_INVALID"],
    ["loadtest-regression-duplicate", "YOU_LOAD_TEST_INVALID"],
    ["lookup-unknown-threat-entry", "YOU_SECURITY_REVIEW_INVALID"],
    ["lookup-unknown-review", "YOU_SECURITY_REVIEW_INVALID"],
    ["lookup-no-acceptance", "YOU_SECURITY_REVIEW_INVALID"],
    ["lookup-unknown-load-test", "YOU_LOAD_TEST_INVALID"],
  ];
  for (const [key, code] of expected) {
    assert.equal(trace.refusalOutcomes[key], code, key);
  }
  assert.equal(Object.keys(trace.refusalOutcomes).length, expected.length);
});

test("both wave-11 security events ride the ledger with exact deterministic counts", () => {
  const trace = runSecurityFixtureScenario();
  assert.equal(trace.eventCounts["security-review-recorded"], 3);
  assert.equal(trace.eventCounts["load-test-recorded"], 1);
  assert.equal(trace.eventCount, 4);
});

test("the honesty law holds on the record: unmitigated residual stated, never zeroed", () => {
  const trace = runSecurityFixtureScenario();
  const unmitigated = trace.steps.find((scenarioStep) => scenarioStep.name === "threat-modeled-unmitigated");
  assert.ok(unmitigated !== undefined);
  assert.equal(unmitigated?.facts["mitigationRefIsNull"], true);
  assert.equal(unmitigated?.facts["residualStated"], true);
  assert.equal(unmitigated?.facts["residualNeverZeroed"], true);
  // The LOAD TEST LAW: simulated-labeled metrics + regressions verbatim.
  const loadTest = trace.steps.find((scenarioStep) => scenarioStep.name === "load-test-run");
  assert.ok(loadTest !== undefined);
  assert.equal(loadTest?.facts["sourceIsSimulated"], true);
  assert.equal(loadTest?.facts["peakRps"], 240.5);
  assert.equal(loadTest?.facts["p99Ms"], 180.25);
  assert.equal(loadTest?.facts["regressionCount"], 2);
  assert.equal(loadTest?.facts["regressionsVerbatim"], true);
});

test("the acceptance references the finding set (count + digest) as a separate immutable decision", () => {
  const trace = runSecurityFixtureScenario();
  const accepted = trace.steps.find((scenarioStep) => scenarioStep.name === "findings-accepted");
  assert.ok(accepted !== undefined);
  assert.equal(accepted?.facts["findingCount"], 2);
  assert.equal(typeof accepted?.facts["findingSetDigest"], "string");
  assert.equal((accepted?.facts["findingSetDigest"] as string).length, 8);
  assert.equal(accepted?.facts["digestMatchesFindings"], true);
  assert.equal(accepted?.facts["statusAccepted"], true);
  // The clean review stayed recorded after its refusal.
  const refused = trace.steps.find((scenarioStep) => scenarioStep.name === "acceptance-without-findings");
  assert.ok(refused !== undefined);
  assert.equal(refused?.facts["cleanReviewStillRecorded"], true);
});

test("the live projection equals the ledger replay exactly", () => {
  const trace = runSecurityFixtureScenario();
  assert.equal(trace.projectionMatchesReplay, true);
});

test("byte-identical replay: the same seed produces the identical trace (x2)", () => {
  const first = runSecurityFixtureScenario();
  const second = runSecurityFixtureScenario();
  assert.equal(stableStringify(first), stableStringify(second));
  const third = runSecurityFixtureScenario({ seed: "you-w11a-security-scenario" });
  assert.equal(stableStringify(first), stableStringify(third));
  // A different seed diverges (the seed is load-bearing).
  const other = runSecurityFixtureScenario({ seed: "you-w11a-security-scenario-alt" });
  assert.notEqual(stableStringify(first), stableStringify(other));
});

test("every step fact set stays simulated (truth law)", () => {
  const trace = runSecurityFixtureScenario();
  for (const scenarioStep of trace.steps) {
    const simulated = scenarioStep.facts["simulated"];
    if (simulated !== undefined) {
      assert.equal(simulated, true, scenarioStep.name);
    }
  }
  assert.equal(trace.simulated, true);
});

test("the scenario steps appear in the scripted W11A order", () => {
  const trace = runSecurityFixtureScenario();
  assert.deepEqual(
    trace.steps.map((scenarioStep) => scenarioStep.name),
    [
      "threat-modeled-mitigated",
      "threat-modeled-unmitigated",
      "threat-intake-refusals",
      "review-recorded",
      "review-intake-refusals",
      "clean-review-recorded",
      "acceptance-without-findings",
      "findings-accepted",
      "acceptance-refusals",
      "load-test-run",
      "load-test-refusals",
      "lookup-refusals",
      "ledger-readout",
    ],
  );
});
