import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import {
  createScenarioEvidenceService,
  EVIDENCE_SCENARIO_SOLUTION_ID,
  runEvidenceFixtureScenario,
  serializeScenarioTrace,
  type EvidenceScenarioTrace,
} from "./evidenceFixtureScenario.js";
import { EvidenceService } from "./evidenceService.js";

const EXPECTED_STEP_NAMES = [
  "consent-policy-registered",
  "capture-session-opened",
  "capture-consent-granted",
  "evidence-recorded-image",
  "evidence-recorded-video",
  "evidence-recorded-depth",
  "evidence-recorded-measurement",
  "capture-session-completed",
  "evidence-reviewed",
  "evidence-review-superseded",
  "learning-consent-granted",
  "capture-consent-withdrawn",
  "retention-read-outcomes",
];

function runScenario(): EvidenceScenarioTrace {
  return runEvidenceFixtureScenario(createScenarioEvidenceService());
}

test("the evidence scenario runs and records every scripted step", () => {
  const trace = runScenario();
  assert.deepEqual(
    trace.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  for (let index = 0; index < trace.steps.length; index += 1) {
    assert.equal(trace.steps[index]?.step, index + 1);
  }
});

test("the evidence scenario is deterministic: two fresh runs are byte-identical", () => {
  const first = runScenario();
  const second = runScenario();
  assert.equal(serializeScenarioTrace(first), serializeScenarioTrace(second));
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.solutionId, second.solutionId);
  assert.equal(first.sessionId, second.sessionId);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.eventCount, second.eventCount);
  assert.equal(first.storeSize, second.storeSize);
  assert.equal(stableStringify(first.records), stableStringify(second.records));
});

test("the scenario satisfies the W2A gate facts", () => {
  const trace = runScenario();

  // Capture session completed; session-only image content expired with it.
  const completed = trace.steps.find((step) => step.name === "capture-session-opened");
  assert.ok(completed !== undefined);
  assert.equal(completed.facts.status, "consent-pending");
  assert.equal(completed.facts.stepCount, 4);
  assert.equal(completed.facts.evidenceRequestId, "you_w2a_scenario_request01");

  const terminal = trace.steps.find((step) => step.name === "capture-session-completed");
  assert.ok(terminal !== undefined);
  assert.equal(terminal.facts.status, "completed");
  assert.equal(terminal.facts.sessionOnlyEvidenceExpired, 1);
  assert.equal(terminal.facts.imageReadAfterCompletion, "YOU_RETENTION_EXPIRED");

  // Delete-after-review removed video content at the first resolved review.
  const reviewed = trace.steps.find((step) => step.name === "evidence-reviewed");
  assert.ok(reviewed !== undefined);
  assert.equal(reviewed.facts.status, "accepted");
  assert.equal(reviewed.facts.contentRemovedAfterReview, true);
  assert.equal(reviewed.facts.videoReadAfterReview, "YOU_RETENTION_EXPIRED");

  // Supersession created a new review; the old one kept its status.
  const superseded = trace.steps.find((step) => step.name === "evidence-review-superseded");
  assert.ok(superseded !== undefined);
  assert.equal(superseded.facts.supersedesReviewId, reviewed.facts.reviewId);
  assert.equal(superseded.facts.oldReviewStatus, "accepted");
  assert.equal(superseded.facts.status, "rejected");

  // Learning reuse permitted through a separate explicit permission.
  const learning = trace.steps.find((step) => step.name === "learning-consent-granted");
  assert.ok(learning !== undefined);
  assert.equal(learning.facts.learningAllowed, true);
  assert.equal(learning.facts.learningReason, "learning-permitted");

  // Withdrawal blocks future processing; hash-verified reads stay truthful.
  const withdrawn = trace.steps.find((step) => step.name === "capture-consent-withdrawn");
  assert.ok(withdrawn !== undefined);
  assert.equal(withdrawn.facts.state, "withdrawn");
  assert.equal(withdrawn.facts.processingAllowed, false);
  assert.equal(withdrawn.facts.processingReason, "consent-withdrawn");

  const readouts = trace.steps.find((step) => step.name === "retention-read-outcomes");
  assert.ok(readouts !== undefined);
  assert.equal(readouts.facts.videoRead, "YOU_RETENTION_EXPIRED");
  assert.equal(readouts.facts.imageRead, "YOU_RETENTION_EXPIRED");
  assert.equal(readouts.facts.depthRead, "OK");
  assert.equal(readouts.facts.depthHashVerified, true);
  assert.equal(readouts.facts.measurementRead, "OK");
  assert.equal(readouts.facts.measurementHashVerified, true);

  // Final state + truth law.
  assert.equal(trace.finalSessionStatus, "completed");
  assert.equal(trace.finalCaptureConsentState, "withdrawn");
  assert.equal(trace.finalLearningConsentState, "granted");
  assert.equal(trace.storeSize, 2);
  assert.ok(trace.eventCount >= 13);
  for (const record of Object.values(trace.records)) {
    assert.match(record.contentHash, /^[0-9a-f]{64}$/);
  }
});

test("every recorded scenario payload carries the truth-law simulated label", () => {
  const service = createScenarioEvidenceService();
  const trace = runEvidenceFixtureScenario(service);
  for (const key of ["image", "video", "depth", "measurement"]) {
    const step = trace.steps.find((entry) => entry.name === `evidence-recorded-${key}`);
    assert.ok(step !== undefined, key);
    assert.equal(step.facts.simulated, true, key);
    const record = service.evidenceRecordOf(EVIDENCE_SCENARIO_SOLUTION_ID, String(step.facts.evidenceId));
    assert.ok(record.ok, key);
    assert.equal(record.value.simulated, true, key);
  }
});

test("the scenario ledger replays to the live projection exactly", () => {
  const service = createScenarioEvidenceService();
  const trace = runEvidenceFixtureScenario(service);
  const events = service.ledgerEventsOf(EVIDENCE_SCENARIO_SOLUTION_ID);
  const projection = service.projectionOf(EVIDENCE_SCENARIO_SOLUTION_ID);
  assert.ok(events.ok && projection.ok);
  const replayed = EvidenceService.replay(events.value);
  assert.equal(stableStringify(replayed), stableStringify(projection.value));
  assert.equal(replayed.solutionId, EVIDENCE_SCENARIO_SOLUTION_ID);
  assert.equal(replayed.captureSessions[trace.sessionId], "completed");
  assert.equal(replayed.consents[trace.captureConsentPolicyId], "withdrawn");
  assert.equal(replayed.consents[trace.learningConsentPolicyId], "granted");
  assert.equal(Object.keys(replayed.evidence).length, 4);
});

test("the scenario ledger serialization is byte-stable across runs", () => {
  const serialize = (): string => {
    const service = createScenarioEvidenceService();
    runEvidenceFixtureScenario(service);
    const serialized = service.serializeLedgerOf(EVIDENCE_SCENARIO_SOLUTION_ID);
    assert.ok(serialized.ok);
    return serialized.value;
  };
  assert.equal(serialize(), serialize());
});
