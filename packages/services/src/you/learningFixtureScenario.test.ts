import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { LEARNING_SCENARIO_SOLUTION_ID, SCENARIO_SIGNAL_SPECS } from "./learningFixtureScenarioTypes.js";
import { runLearningFixtureScenario, serializeLearningScenarioTrace } from "./learningFixtureScenario.js";

test("the scenario spans the full ladder: six kinds, validate, reject, supersede, rights-refusals, preferences, trajectory", () => {
  const trace = runLearningFixtureScenario();

  // One signal per frozen kind, all captured and journaled.
  assert.equal(trace.signalIds.length, 6);
  const stepNames = trace.steps.map((step) => step.name);
  const signalSteps = trace.steps.filter((step) => step.name === "signal-captured");
  assert.equal(signalSteps.length, 6);
  assert.deepEqual(
    signalSteps.map((step) => step.facts["kind"]),
    SCENARIO_SIGNAL_SPECS.map((spec) => spec.kind),
  );

  // The ladder: signal capture -> candidate -> validated (happy path).
  assert.ok(stepNames.includes("record-validated"));
  assert.ok(stepNames.includes("record-used-within-grant"));

  // The rejected path.
  assert.ok(stepNames.includes("record-rejected"));
  assert.ok(stepNames.includes("rejected-record-unusable"));

  // The superseded path (append-only linkage).
  assert.ok(stepNames.includes("record-superseded"));
  assert.ok(stepNames.includes("superseded-records-unusable"));

  // The rights-refusal paths (outside-grant + inert + post-withdrawal).
  assert.ok(stepNames.includes("usage-outside-grant-refused"));
  assert.ok(stepNames.includes("inert-record-refused"));
  assert.ok(stepNames.includes("post-withdrawal-usage-refused"));

  // The preference derivation + the operator seed.
  assert.ok(stepNames.includes("preference-derived"));
  assert.ok(stepNames.includes("operator-preference-seeded"));

  // The trajectory replay.
  assert.ok(stepNames.includes("trajectory-replayed"));

  // The invalid-signal / unknown-record / preference-scope refusals.
  assert.ok(stepNames.includes("invalid-signals-refused"));
  assert.ok(stepNames.includes("unknown-record-refused"));
  assert.ok(stepNames.includes("preference-scope-refused"));

  // The ledger readout closes the scenario with projection == replay.
  assert.ok(stepNames.includes("ledger-readout"));
  assert.equal(trace.projectionMatchesReplay, true);
  assert.ok(trace.eventCount > 0);
  assert.match(trace.ledgerHash, /^[0-9a-f]{8}$/);
});

test("every refusal step in the scenario carries the typed frozen error code", () => {
  const trace = runLearningFixtureScenario();
  const factsByName = new Map(trace.steps.map((step) => [step.name, step.facts]));

  assert.equal(factsByName.get("invalid-signals-refused")?.["kindOutcome"], "YOU_LEARNING_SIGNAL_INVALID");
  assert.equal(factsByName.get("invalid-signals-refused")?.["scopeOutcome"], "YOU_LEARNING_SIGNAL_INVALID");
  assert.equal(factsByName.get("usage-outside-grant-refused")?.["outcome"], "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(factsByName.get("usage-outside-grant-refused")?.["reason"], "usage-not-granted");
  assert.equal(factsByName.get("inert-record-refused")?.["outcome"], "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(factsByName.get("inert-record-refused")?.["reason"], "rights-inert");
  assert.equal(factsByName.get("rejected-record-unusable")?.["outcome"], "YOU_INVALID_STATE");
  assert.equal(factsByName.get("unknown-record-refused")?.["useOutcome"], "YOU_LEARNING_RECORD_NOT_FOUND");
  assert.equal(factsByName.get("preference-scope-refused")?.["literalOutcome"], "YOU_PREFERENCE_SCOPE_INVALID");
  assert.equal(factsByName.get("preference-scope-refused")?.["mismatchOutcome"], "YOU_PREFERENCE_SCOPE_INVALID");
  assert.equal(factsByName.get("post-withdrawal-usage-refused")?.["useOutcome"], "YOU_LEARNING_RIGHTS_REQUIRED");
  assert.equal(factsByName.get("post-withdrawal-usage-refused")?.["useReason"], "consent-withdrawn");
  assert.equal(factsByName.get("post-withdrawal-usage-refused")?.["derivationOutcome"], "YOU_LEARNING_RIGHTS_REQUIRED");
});

test("the scenario is deterministic: same seeds => byte-identical traces (golden expectation)", () => {
  const first = runLearningFixtureScenario();
  const second = runLearningFixtureScenario();
  assert.equal(serializeLearningScenarioTrace(first), serializeLearningScenarioTrace(second));
  assert.equal(stableStringify(first.steps), stableStringify(second.steps));
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.trajectoryReplayHash, second.trajectoryReplayHash);
  assert.deepEqual(first.signalIds, second.signalIds);
  assert.deepEqual(first.recordIds, second.recordIds);
});

test("scenario seeds are honored: different seeds => different traces", () => {
  const baseline = runLearningFixtureScenario();
  const altered = runLearningFixtureScenario({ learningSeed: "you-w6a-learning-scenario-alt" });
  assert.notEqual(stableStringify(baseline.steps), stableStringify(altered.steps));
});

test("the scenario's trajectory replay hash is the sha-256 of the replay bytes (truth law, not invented)", () => {
  const trace = runLearningFixtureScenario();
  // The replay hash is a real sha-256 hex digest (64 chars).
  assert.match(trace.trajectoryReplayHash, /^[0-9a-f]{64}$/);
  // The recorded facts carry the same compact prefix.
  const trajectoryStep = trace.steps.find((step) => step.name === "trajectory-replayed");
  assert.ok(trajectoryStep !== undefined);
  assert.equal(trajectoryStep.facts["replayByteIdentical"], true);
  assert.equal(String(trajectoryStep.facts["replayHash"]), trace.trajectoryReplayHash.slice(0, 8));
  assert.equal(trajectoryStep.facts["stepCount"], 4);
  assert.equal(trajectoryStep.facts["byteLength"], 4 * 256);
  assert.equal(trajectoryStep.facts["simulated"], true);
});

test("the scenario solution id is the frozen fixture constant", () => {
  const trace = runLearningFixtureScenario();
  assert.equal(trace.solutionId, LEARNING_SCENARIO_SOLUTION_ID);
  assert.equal(trace.validatedRecordIds.length, 4);
  assert.equal(trace.supersededRecordId !== trace.successorRecordId, true);
  assert.equal(trace.inertRecordId !== trace.rejectedRecordId, true);
});
