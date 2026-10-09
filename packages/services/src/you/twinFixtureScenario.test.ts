import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import {
  EVIDENCE_SCENARIO_SEED,
  runTwinFixtureScenario,
  serializeTwinScenarioTrace,
  TWIN_SCENARIO_SEED,
  TWIN_SCENARIO_SOLUTION_ID,
  type TwinScenarioTrace,
} from "./twinFixtureScenario.js";

const EXPECTED_STEP_NAMES = [
  "twin-created",
  "capture-session-opened",
  "capture-consent-granted",
  "evidence-recorded-image",
  "evidence-recorded-depth",
  "twin-version-published-v1",
  "twin-version-promoted-v1",
  "reconstruction-job-submitted",
  "reconstruction-job-started",
  "reconstruction-job-completed",
  "twin-version-published-v2",
  "twin-quality-assessed-v2",
  "twin-version-promoted-v2",
  "deficiency-remediation-requested",
  "remediation-capture-opened",
  "remediation-evidence-recorded",
  "reconstruction-round2-completed",
  "twin-version-published-v3",
  "twin-version-promoted-v3",
  "capture-consent-withdrawn",
  "reconstruction-unsupported",
  "ledger-readout",
];

function runScenario(): TwinScenarioTrace {
  return runTwinFixtureScenario();
}

test("the twin scenario runs the full arrow and records every scripted step", () => {
  const trace = runScenario();
  assert.equal(trace.solutionId, TWIN_SCENARIO_SOLUTION_ID);
  assert.deepEqual(
    trace.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  for (let index = 0; index < trace.steps.length; index += 1) {
    assert.equal(trace.steps[index]?.step, index + 1);
  }
});

test("the twin scenario is deterministic: two fresh runs are byte-identical", () => {
  const first = runScenario();
  const second = runScenario();
  assert.equal(serializeTwinScenarioTrace(first), serializeTwinScenarioTrace(second));
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.twinId, second.twinId);
  assert.deepEqual(first.evidenceIds, second.evidenceIds);
  assert.deepEqual(first.versions, second.versions);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.eventCount, second.eventCount);
  assert.equal(first.twinStoreSize, second.twinStoreSize);
  assert.equal(stableStringify(first.steps), stableStringify(second.steps));
});

test("the scenario satisfies the W3A golden facts (frozen fixture definition)", () => {
  const trace = runScenario();

  // Binding: v1 carries both consent-clean evidence bindings, recorded granted.
  const v1Step = trace.steps.find((step) => step.name === "twin-version-published-v1");
  assert.ok(v1Step !== undefined);
  assert.equal(v1Step.facts["versionNumber"], 1);
  assert.equal(v1Step.facts["status"], "candidate");
  assert.equal(v1Step.facts["domainBlockCount"], 5);
  assert.equal(v1Step.facts["evidenceBindingCount"], 2);

  // Reconstruction round 1: honest not-measured markers, simulated output.
  const jobStep = trace.steps.find((step) => step.name === "reconstruction-job-completed");
  assert.ok(jobStep !== undefined);
  assert.equal(jobStep.facts["status"], "completed");
  assert.equal(jobStep.facts["producedBlockCount"], 3);
  assert.equal(jobStep.facts["latencyNotMeasured"], true);
  assert.equal(jobStep.facts["latencyMarker"], "not-measured (simulated)");
  assert.equal(jobStep.facts["simulated"], true);

  // Golden quality story: v2 face-hands deficient, remediation, v3 resolved.
  const v2Step = trace.steps.find((step) => step.name === "twin-version-published-v2");
  assert.ok(v2Step !== undefined);
  assert.equal(v2Step.facts["faceHandsScore"], 0.6946);
  assert.equal(v2Step.facts["deficiencyCount"], 2);
  const v3Step = trace.steps.find((step) => step.name === "twin-version-published-v3");
  assert.ok(v3Step !== undefined);
  assert.equal(v3Step.facts["faceHandsScore"], 0.9446);
  assert.equal(v3Step.facts["faceHandsScoreImproved"], true);
  assert.equal(v3Step.facts["deficiencyCount"], 0);
  assert.equal(v3Step.facts["faceHandsRemediationRequestId"], "");
  assert.equal(trace.v1FaceHandsScore, 0.8765);
  assert.equal(trace.v3FaceHandsScore, 0.9446);
  assert.equal(trace.faceHandsRemediationLinkedOnV3, false);

  // Deficiency -> targeted EvidenceRequest remediation link (W2 seam).
  const remediationStep = trace.steps.find((step) => step.name === "deficiency-remediation-requested");
  assert.ok(remediationStep !== undefined);
  assert.equal(remediationStep.facts["deficiencyClass"], "geometric-error");
  assert.equal(remediationStep.facts["domain"], "face-hands");
  assert.equal(remediationStep.facts["severity"], 0.3054);
  assert.equal(remediationStep.facts["targetDeficiency"], "geometric-error:face-hands");
  assert.equal(remediationStep.facts["alreadyLinked"], false);
  // The remediation capture session is bound to the request.
  const remediationCapture = trace.steps.find((step) => step.name === "remediation-capture-opened");
  assert.ok(remediationCapture !== undefined);
  assert.equal(remediationCapture.facts["evidenceRequestId"], trace.remediationRequestId);
  const remediationEvidence = trace.steps.find((step) => step.name === "remediation-evidence-recorded");
  assert.ok(remediationEvidence !== undefined);
  assert.equal(remediationEvidence.facts["evidenceRequestId"], trace.remediationRequestId);

  // Version lifecycle: monotonic numbers, append-only supersession, v3 canonical.
  assert.equal(trace.versions["v1"]?.status, "superseded");
  assert.equal(trace.versions["v2"]?.status, "superseded");
  assert.equal(trace.versions["v3"]?.status, "canonical");
  assert.equal(trace.versions["v1"]?.version, 1);
  assert.equal(trace.versions["v2"]?.version, 2);
  assert.equal(trace.versions["v3"]?.version, 3);
  assert.equal(trace.finalCanonicalVersionId, trace.versions["v3"]?.id);
  assert.equal(trace.finalSupersededBy[trace.versions["v1"]?.id ?? ""], trace.versions["v2"]?.id);
  assert.equal(trace.finalSupersededBy[trace.versions["v2"]?.id ?? ""], trace.versions["v3"]?.id);
  // Old versions keep their evidence bindings (provenance) after supersession.
  const promotedV2 = trace.steps.find((step) => step.name === "twin-version-promoted-v2");
  assert.ok(promotedV2 !== undefined);
  assert.equal(promotedV2.facts["supersededVersionId"], trace.versions["v1"]?.id);
  assert.equal(promotedV2.facts["v1StatusAfter"], "superseded");

  // Consent withdrawal blocks NEW bindings; the typed reason is carried.
  const withdrawn = trace.steps.find((step) => step.name === "capture-consent-withdrawn");
  assert.ok(withdrawn !== undefined);
  assert.equal(withdrawn.facts["state"], "withdrawn");
  assert.equal(withdrawn.facts["bindingAfterWithdrawal"], "YOU_CONSENT_REQUIRED");
  assert.equal(withdrawn.facts["blockedReason"], "consent-withdrawn");

  // Unsupported method/domain combination is the typed refusal.
  const unsupported = trace.steps.find((step) => step.name === "reconstruction-unsupported");
  assert.ok(unsupported !== undefined);
  assert.equal(unsupported.facts["outcome"], "YOU_RECONSTRUCTION_UNSUPPORTED");
  assert.equal(unsupported.facts["unsupportedDomains"], "voice");

  // Ledger readout: append-only, replayable, golden hash.
  const readout = trace.steps.find((step) => step.name === "ledger-readout");
  assert.ok(readout !== undefined);
  assert.equal(readout.facts["eventCount"], 15);
  assert.equal(readout.facts["ledgerHash"], "a7e89222");
  assert.equal(readout.facts["projectionMatchesReplay"], true);
  assert.equal(readout.facts["supersededCount"], 2);
  assert.equal(readout.facts["twinStoreSize"], 11);
  assert.equal(trace.eventCount, 15);
  assert.equal(trace.ledgerHash, "a7e89222");
  assert.equal(trace.projectionMatchesReplay, true);
});

test("different seeds change the ids and hashes but keep the machinery deterministic", () => {
  const base = runScenario();
  const variant = runTwinFixtureScenario({ twinSeed: `${TWIN_SCENARIO_SEED}-alt`, evidenceSeed: `${EVIDENCE_SCENARIO_SEED}-alt` });
  assert.notEqual(base.twinId, variant.twinId);
  assert.notEqual(base.ledgerHash, variant.ledgerHash);
  assert.equal(variant.projectionMatchesReplay, true);
  // Step machinery (names + count) is seed-independent.
  assert.deepEqual(
    variant.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  const rerun = runTwinFixtureScenario({ twinSeed: `${TWIN_SCENARIO_SEED}-alt`, evidenceSeed: `${EVIDENCE_SCENARIO_SEED}-alt` });
  assert.equal(serializeTwinScenarioTrace(variant), serializeTwinScenarioTrace(rerun));
});
