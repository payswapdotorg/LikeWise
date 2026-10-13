import assert from "node:assert/strict";
import test from "node:test";
import type { LabExperiment, LabPromotionRecord, LabRun, OpaqueId } from "@zcode/shared";
import { sha256Hex } from "../../../shared/src/you/evidenceStore.js";
import { labEvidenceBundleHash } from "../../../shared/src/you/labEvidenceManifest.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createLabService, LabService } from "./labService.js";

const SOLUTION = "you_w9a_service_test";

const EXPERIMENT_INPUT = {
  intentRef: "you_intent_0000000000000009",
  constraintsHash: "e7a1c3f9d2b40668",
  objective: "minimize-compute-cost-at-quality-threshold",
  arms: ["generalist-baseline", "hand-designed", "searched"],
} as const;

const PLAN_HASHES = {
  "generalist-baseline": "planhash-9a-baseline-0001",
  "hand-designed": "planhash-9a-handdesigned-02",
  searched: "planhash-9a-searched-000003",
} as const;

interface Fixture {
  readonly service: LabService;
  readonly experiment: LabExperiment;
}

function createFixture(seed: string): Fixture {
  const service = createLabService({ workspaceIdentity: "ws-w9a-service-test", seed });
  const experiment = service.declareExperiment(SOLUTION, EXPERIMENT_INPUT);
  assert.ok(experiment.ok);
  return { service, experiment: experiment.value.experiment };
}

function runArmToStatus(
  service: LabService,
  experimentId: OpaqueId,
  arm: "generalist-baseline" | "hand-designed" | "searched",
  planHash: string,
): { readonly submitted: LabRun; readonly running: LabRun; readonly terminal: LabRun } {
  const submitted = service.submitLabRun(SOLUTION, experimentId, { arm, planHash });
  assert.ok(submitted.ok);
  const running = service.startLabRun(SOLUTION, submitted.value.run.id);
  assert.ok(running.ok);
  return { submitted: submitted.value.run, running: running.value.run, terminal: running.value.run };
}

function succeedArm(
  service: LabService,
  experimentId: OpaqueId,
  arm: "generalist-baseline" | "hand-designed" | "searched",
  planHash: string,
): { readonly submitted: LabRun; readonly running: LabRun; readonly terminal: LabRun; readonly succeeded: LabRun } {
  const walk = runArmToStatus(service, experimentId, arm, planHash);
  const succeeded = service.succeedLabRun(SOLUTION, walk.submitted.id);
  assert.ok(succeeded.ok);
  return { ...walk, succeeded: succeeded.value.run };
}

function artifactBytes(label: string, index: number): Uint8Array {
  return new TextEncoder().encode(`lab-artifact-${label}-${index}`);
}

function publishArtifacts(service: LabService, runId: OpaqueId, labels: readonly string[]) {
  const published = service.publishLabEvidence(SOLUTION, runId, {
    artifacts: labels.map((label, index) => artifactBytes(label, index)),
  });
  assert.ok(published.ok);
  return published.value.manifest;
}

function decidedFixture(seed: string): {
  readonly service: LabService;
  readonly experiment: LabExperiment;
  readonly baselineRunId: OpaqueId;
  readonly searchedRunId: OpaqueId;
  readonly searchedManifestId: OpaqueId;
  readonly promotion: LabPromotionRecord;
} {
  const fixture = createFixture(seed);
  const baseline = succeedArm(fixture.service, fixture.experiment.id, "generalist-baseline", PLAN_HASHES["generalist-baseline"]);
  const searched = succeedArm(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const manifest = publishArtifacts(fixture.service, searched.succeeded.id, ["searched-a", "searched-b"]);
  const promotion = fixture.service.decidePromotion(SOLUTION, fixture.experiment.id, {
    searchedRunId: searched.succeeded.id,
    baselineRunId: baseline.succeeded.id,
    objectiveScore: 0.87,
    baselineScore: 0.71,
    evidenceManifestRef: manifest.id,
  });
  assert.ok(promotion.ok);
  return {
    service: fixture.service,
    experiment: fixture.experiment,
    baselineRunId: baseline.succeeded.id,
    searchedRunId: searched.succeeded.id,
    searchedManifestId: manifest.id,
    promotion: promotion.value.promotion,
  };
}

test("experiment persistence: immutable three-arm records; typed YOU_LAB_EXPERIMENT_NOT_FOUND", () => {
  const fixture = createFixture("experiment-persistence");
  assert.equal(fixture.experiment.intentRef, "you_intent_0000000000000009");
  assert.equal(fixture.experiment.constraintsHash, "e7a1c3f9d2b40668");
  assert.equal(fixture.experiment.objective, "minimize-compute-cost-at-quality-threshold");
  assert.deepEqual(fixture.experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(fixture.experiment.promotionRef, null);
  assert.equal(fixture.experiment.simulated, true);
  assert.ok(Object.isFrozen(fixture.experiment));
  // Declared arms canonicalize into the frozen order.
  const shuffled = fixture.service.declareExperiment(SOLUTION, {
    ...EXPERIMENT_INPUT,
    arms: ["searched", "generalist-baseline", "hand-designed"],
  });
  assert.ok(shuffled.ok);
  assert.deepEqual(shuffled.value.experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  const found = fixture.service.experimentOf(SOLUTION, fixture.experiment.id);
  assert.ok(found.ok);
  assert.equal(found.value.experiment, fixture.experiment);
  const listed = fixture.service.experimentsOf(SOLUTION);
  assert.ok(listed.ok);
  assert.equal(listed.value.experiments.length, 2);
  // Unknown experiments are typed across every experiment-scoped op.
  for (const result of [
    fixture.service.experimentOf(SOLUTION, "you_lab-experiment_missing"),
    fixture.service.submitLabRun(SOLUTION, "you_lab-experiment_missing", { arm: "searched", planHash: "h" }),
    fixture.service.decidePromotion(SOLUTION, "you_lab-experiment_missing", {
      searchedRunId: "you_lab-run_1",
      baselineRunId: "you_lab-run_2",
      objectiveScore: 1,
      baselineScore: 0,
      evidenceManifestRef: "you_lab-evidence-manifest_1",
    }),
    fixture.service.promotionLedgerOf(SOLUTION, "you_lab-experiment_missing"),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_LAB_EXPERIMENT_NOT_FOUND");
    assert.equal(result.error.details["reason"], "unknown-experiment");
    assert.equal(result.error.simulated, true);
  }
  // A declared-but-undecided experiment has an empty promotion ledger.
  const empty = fixture.service.promotionLedgerOf(SOLUTION, fixture.experiment.id);
  assert.ok(empty.ok);
  assert.deepEqual(empty.value.ledger, []);
});

test("experiment intake refusals are typed YOU_INVALID_STATE with the validator's reasons", () => {
  const service = createLabService({ workspaceIdentity: "ws-w9a-service-test", seed: "experiment-refusals" });
  const cases: readonly [Record<string, unknown>, string][] = [
    [{ ...EXPERIMENT_INPUT, arms: ["generalist-baseline", "searched"] }, "arms-not-three-arm-law"],
    [{ ...EXPERIMENT_INPUT, arms: ["searched", "searched", "hand-designed"] }, "arms-duplicate"],
    [{ ...EXPERIMENT_INPUT, arms: ["generalist-baseline", "hand-designed", "tuned"] }, "arm-invalid"],
    [{ ...EXPERIMENT_INPUT, arms: [] }, "arms-empty"],
    [{ ...EXPERIMENT_INPUT, intentRef: "" }, "intent-ref-empty"],
    [{ ...EXPERIMENT_INPUT, constraintsHash: "" }, "constraints-hash-empty"],
    [{ ...EXPERIMENT_INPUT, objective: "" }, "objective-empty"],
  ];
  for (const [input, reason] of cases) {
    const refused = service.declareExperiment(SOLUTION, input as typeof EXPERIMENT_INPUT);
    assert.ok(!refused.ok, reason);
    assert.equal(refused.error.code, "YOU_INVALID_STATE");
    assert.equal(refused.error.details["reason"], "invalid-experiment-intake");
    assert.equal(refused.error.details["refusal"], reason);
    assert.equal(refused.error.simulated, true);
  }
});

test("the run ladder: experiment-gated submissions, immutable transitions, append-only lists", () => {
  const fixture = createFixture("run-ladder");
  const walk = runArmToStatus(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  assert.equal(walk.submitted.status, "submitted");
  assert.equal(walk.submitted.experimentId, fixture.experiment.id);
  assert.equal(walk.submitted.arm, "searched");
  assert.equal(walk.submitted.planHash, PLAN_HASHES.searched);
  assert.equal(walk.submitted.completedAt, null);
  assert.equal(walk.submitted.simulated, true);
  assert.ok(Object.isFrozen(walk.submitted));
  const succeeded = fixture.service.succeedLabRun(SOLUTION, walk.submitted.id);
  assert.ok(succeeded.ok);
  assert.equal(succeeded.value.run.status, "succeeded");
  assert.notEqual(succeeded.value.run.completedAt, null);
  // The earlier records are untouched (immutable replacement).
  assert.equal(walk.submitted.status, "submitted");
  assert.equal(walk.running.status, "running");
  // The per-experiment list is append-only, in submit order.
  const second = fixture.service.submitLabRun(SOLUTION, fixture.experiment.id, { arm: "searched", planHash: "planhash-9a-searched-000004" });
  assert.ok(second.ok);
  const ladder = fixture.service.runsOfExperiment(SOLUTION, fixture.experiment.id);
  assert.ok(ladder.ok);
  assert.deepEqual(
    ladder.value.runs.map((run) => run.id),
    [walk.submitted.id, second.value.run.id],
  );
  const all = fixture.service.runsOf(SOLUTION);
  assert.ok(all.ok);
  assert.equal(all.value.runs.length, 2);
});

test("run submission gates: undeclared arm and malformed intake are typed YOU_INVALID_STATE", () => {
  const fixture = createFixture("run-gates");
  const undeclared = fixture.service.submitLabRun(SOLUTION, fixture.experiment.id, {
    arm: "tuned" as "searched",
    planHash: "h",
  });
  assert.ok(!undeclared.ok);
  assert.equal(undeclared.error.code, "YOU_INVALID_STATE");
  assert.equal(undeclared.error.details["reason"], "arm-not-declared");
  const emptyPlan = fixture.service.submitLabRun(SOLUTION, fixture.experiment.id, { arm: "searched", planHash: "" });
  assert.ok(!emptyPlan.ok);
  assert.equal(emptyPlan.error.code, "YOU_INVALID_STATE");
  assert.equal(emptyPlan.error.details["reason"], "invalid-run-intake");
  assert.equal(emptyPlan.error.details["refusal"], "plan-hash-empty");
});

test("the run-ladder transition table at the service seam: locked terminals, no-ops, off-ladder", () => {
  const fixture = createFixture("ladder-refusals");
  const walk = runArmToStatus(fixture.service, fixture.experiment.id, "hand-designed", PLAN_HASHES["hand-designed"]);
  // Off-ladder: submitted -> succeeded refuses (a run must run first).
  const freshSubmit = fixture.service.submitLabRun(SOLUTION, fixture.experiment.id, { arm: "searched", planHash: PLAN_HASHES.searched });
  assert.ok(freshSubmit.ok);
  const offLadder = fixture.service.succeedLabRun(SOLUTION, freshSubmit.value.run.id);
  assert.ok(!offLadder.ok);
  assert.equal(offLadder.error.code, "YOU_INVALID_STATE");
  assert.equal(offLadder.error.details["reason"], "transition-not-on-ladder");
  // No-op: running -> running refuses.
  const noOp = fixture.service.startLabRun(SOLUTION, walk.running.id);
  assert.ok(!noOp.ok);
  assert.equal(noOp.error.code, "YOU_INVALID_STATE");
  assert.equal(noOp.error.details["reason"], "no-op-transition");
  // Backwards: running -> submitted is off-ladder (already covered by no-op path shape).
  const terminal = fixture.service.retireLabRun(SOLUTION, walk.running.id);
  assert.ok(terminal.ok);
  assert.equal(terminal.value.run.status, "retired");
  // Terminals lock: every further move refuses (a self-transition on a
  // terminal is the no-op refusal — the W8A arena semantics).
  for (const result of [
    fixture.service.startLabRun(SOLUTION, walk.running.id),
    fixture.service.succeedLabRun(SOLUTION, walk.running.id),
    fixture.service.failLabRun(SOLUTION, walk.running.id),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_INVALID_STATE");
    assert.equal(result.error.details["reason"], "run-terminal-locked");
    assert.equal(result.error.details["status"], "retired");
  }
  const retiredNoOp = fixture.service.retireLabRun(SOLUTION, walk.running.id);
  assert.ok(!retiredNoOp.ok);
  assert.equal(retiredNoOp.error.code, "YOU_INVALID_STATE");
  assert.equal(retiredNoOp.error.details["reason"], "no-op-transition");
  // The failed terminal walks the same ladder.
  const failWalk = runArmToStatus(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const failed = fixture.service.failLabRun(SOLUTION, failWalk.submitted.id);
  assert.ok(failed.ok);
  assert.equal(failed.value.run.status, "failed");
  // Unknown runs are typed YOU_LAB_RUN_NOT_FOUND across every run op.
  for (const result of [
    fixture.service.runOf(SOLUTION, "you_lab-run_missing"),
    fixture.service.startLabRun(SOLUTION, "you_lab-run_missing"),
    fixture.service.succeedLabRun(SOLUTION, "you_lab-run_missing"),
    fixture.service.failLabRun(SOLUTION, "you_lab-run_missing"),
    fixture.service.retireLabRun(SOLUTION, "you_lab-run_missing"),
    fixture.service.publishLabEvidence(SOLUTION, "you_lab-run_missing", { artifacts: [artifactBytes("x", 0)] }),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_LAB_RUN_NOT_FOUND");
    assert.equal(result.error.details["reason"], "unknown-run");
    assert.equal(result.error.simulated, true);
  }
});

test("evidence manifests: content-addressed publication, run-head linkage, verification", () => {
  const fixture = createFixture("evidence");
  const baseline = succeedArm(fixture.service, fixture.experiment.id, "generalist-baseline", PLAN_HASHES["generalist-baseline"]);
  const manifest = publishArtifacts(fixture.service, baseline.succeeded.id, ["baseline-a", "baseline-b"]);
  assert.match(manifest.contentHash, /^[0-9a-f]{64}$/);
  assert.equal(
    manifest.contentHash,
    labEvidenceBundleHash([sha256Hex(artifactBytes("baseline-a", 0)), sha256Hex(artifactBytes("baseline-b", 1))]),
  );
  assert.equal(manifest.runId, baseline.succeeded.id);
  assert.equal(manifest.artifactRefs.length, 2);
  assert.equal(manifest.simulated, true);
  assert.ok(Object.isFrozen(manifest));
  // Content addressing: the same artifacts hash identically on another run.
  const searched = succeedArm(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const handDesigned = succeedArm(fixture.service, fixture.experiment.id, "hand-designed", PLAN_HASHES["hand-designed"]);
  const sameBytes = publishArtifacts(fixture.service, searched.succeeded.id, ["baseline-a", "baseline-b"]);
  assert.equal(sameBytes.contentHash, manifest.contentHash);
  const otherBytes = publishArtifacts(fixture.service, handDesigned.succeeded.id, ["searched-a"]);
  assert.notEqual(otherBytes.contentHash, manifest.contentHash);
  // The run head's evidence linkage walked immutably.
  const runHead = fixture.service.runOf(SOLUTION, baseline.succeeded.id);
  assert.ok(runHead.ok);
  assert.equal(runHead.value.run.evidenceManifestRef, manifest.id);
  assert.equal(runHead.value.run.status, "succeeded");
  assert.equal(baseline.succeeded.evidenceManifestRef, null);
  // Reads and verification.
  const found = fixture.service.manifestOf(SOLUTION, manifest.id);
  assert.ok(found.ok);
  assert.equal(found.value.manifest, manifest);
  const listed = fixture.service.manifestsOf(SOLUTION);
  assert.ok(listed.ok);
  assert.equal(listed.value.manifests.length, 3);
  const verified = fixture.service.verifyLabEvidence(SOLUTION, manifest.id);
  assert.ok(verified.ok);
  assert.equal(verified.value.verified, true);
  assert.equal(verified.value.manifest.id, manifest.id);
  // Artifacts landed in the content store (content-addressed).
  assert.ok(fixture.service.contentStoreSize() >= 3);
});

test("evidence publication gates and malformed intake are typed YOU_LAB_EVIDENCE_MANIFEST_INVALID", () => {
  const fixture = createFixture("evidence-refusals");
  const walk = runArmToStatus(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const notTerminal = fixture.service.publishLabEvidence(SOLUTION, walk.submitted.id, { artifacts: [artifactBytes("x", 0)] });
  assert.ok(!notTerminal.ok);
  assert.equal(notTerminal.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(notTerminal.error.details["reason"], "run-not-terminal");
  const succeeded = fixture.service.succeedLabRun(SOLUTION, walk.submitted.id);
  assert.ok(succeeded.ok);
  const empty = fixture.service.publishLabEvidence(SOLUTION, walk.submitted.id, { artifacts: [] });
  assert.ok(!empty.ok);
  assert.equal(empty.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(empty.error.details["reason"], "artifacts-empty");
  const emptyBytes = fixture.service.publishLabEvidence(SOLUTION, walk.submitted.id, { artifacts: [new Uint8Array()] });
  assert.ok(!emptyBytes.ok);
  assert.equal(emptyBytes.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(emptyBytes.error.details["reason"], "artifact-empty");
  publishArtifacts(fixture.service, walk.submitted.id, ["searched-a"]);
  const again = fixture.service.publishLabEvidence(SOLUTION, walk.submitted.id, { artifacts: [artifactBytes("more", 0)] });
  assert.ok(!again.ok);
  assert.equal(again.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(again.error.details["reason"], "run-already-carries-manifest");
  // Unknown manifests fail closed on every read.
  for (const result of [
    fixture.service.manifestOf(SOLUTION, "you_lab-evidence-manifest_missing"),
    fixture.service.verifyLabEvidence(SOLUTION, "you_lab-evidence-manifest_missing"),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
    assert.equal(result.error.details["reason"], "manifest-unknown");
    assert.equal(result.error.simulated, true);
  }
});

test("THE PROMOTION LAW: the searched arm promotes only when it beats the baseline", () => {
  const decided = decidedFixture("promotion-law");
  assert.equal(decided.promotion.winnerArm, "searched");
  assert.equal(decided.promotion.objectiveScore, 0.87);
  assert.equal(decided.promotion.baselineScore, 0.71);
  assert.equal(decided.promotion.evidenceManifestRef, decided.searchedManifestId);
  assert.equal(decided.promotion.experimentId, decided.experiment.id);
  assert.equal(decided.promotion.simulated, true);
  assert.ok(Object.isFrozen(decided.promotion));
  // The experiment head walked immutably to the promotion record.
  const experiment = decided.service.experimentOf(SOLUTION, decided.experiment.id);
  assert.ok(experiment.ok);
  assert.equal(experiment.value.experiment.promotionRef, decided.promotion.id);
  assert.equal(decided.experiment.promotionRef, null);
  // The decision ledger holds the record.
  const ledger = decided.service.promotionLedgerOf(SOLUTION, decided.experiment.id);
  assert.ok(ledger.ok);
  assert.equal(ledger.value.ledger.length, 1);
  assert.equal(ledger.value.ledger[0]?.id, decided.promotion.id);
  const found = decided.service.promotionOf(SOLUTION, decided.promotion.id);
  assert.ok(found.ok);
  assert.equal(found.value.promotion, decided.promotion);
});

test("the promotion gate refusal paths are typed YOU_LAB_PROMOTION_INVALID with stable reasons", () => {
  const fixture = createFixture("promotion-refusals");
  const baseline = succeedArm(fixture.service, fixture.experiment.id, "generalist-baseline", PLAN_HASHES["generalist-baseline"]);
  const handDesigned = succeedArm(fixture.service, fixture.experiment.id, "hand-designed", PLAN_HASHES["hand-designed"]);
  const retiredWalk = runArmToStatus(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const retired = fixture.service.retireLabRun(SOLUTION, retiredWalk.submitted.id);
  assert.ok(retired.ok);
  // A retired generalist-baseline run (the not-succeeded baseline side of the gate).
  const retiredBaselineWalk = runArmToStatus(fixture.service, fixture.experiment.id, "generalist-baseline", PLAN_HASHES["generalist-baseline"]);
  const retiredBaseline = fixture.service.retireLabRun(SOLUTION, retiredBaselineWalk.submitted.id);
  assert.ok(retiredBaseline.ok);
  const searched = succeedArm(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const baselineManifest = publishArtifacts(fixture.service, baseline.succeeded.id, ["baseline-a"]);
  const searchedManifest = publishArtifacts(fixture.service, searched.succeeded.id, ["searched-a"]);
  const input = {
    searchedRunId: searched.succeeded.id,
    baselineRunId: baseline.succeeded.id,
    objectiveScore: 0.87,
    baselineScore: 0.71,
    evidenceManifestRef: searchedManifest.id,
  };
  const cases: readonly [Record<string, unknown>, string][] = [
    [{ ...input, objectiveScore: 0.71 }, "searched-does-not-beat-baseline"],
    [{ ...input, objectiveScore: 0.5 }, "searched-does-not-beat-baseline"],
    [{ ...input, baselineRunId: handDesigned.succeeded.id }, "run-arm-mismatch-baseline"],
    [{ ...input, searchedRunId: baseline.succeeded.id }, "run-arm-mismatch-searched"],
    [{ ...input, searchedRunId: retired.value.run.id }, "run-not-succeeded"],
    [{ ...input, baselineRunId: retiredBaseline.value.run.id }, "run-not-succeeded"],
    [{ ...input, evidenceManifestRef: baselineManifest.id }, "manifest-not-bound-to-searched-run"],
    [{ ...input, objectiveScore: Number.NaN }, "scores-invalid"],
  ];
  for (const [override, reason] of cases) {
    const refused = fixture.service.decidePromotion(SOLUTION, fixture.experiment.id, override as typeof input);
    assert.ok(!refused.ok, reason);
    assert.equal(refused.error.code, "YOU_LAB_PROMOTION_INVALID");
    assert.equal(refused.error.details["reason"], reason);
    assert.equal(refused.error.simulated, true);
  }
  // A searched run of ANOTHER experiment does not compare (declared second experiment).
  const other = fixture.service.declareExperiment(SOLUTION, { ...EXPERIMENT_INPUT, intentRef: "you_intent_0000000000000010" });
  assert.ok(other.ok);
  const otherSearched = succeedArm(fixture.service, other.value.experiment.id, "searched", PLAN_HASHES.searched);
  const otherManifest = publishArtifacts(fixture.service, otherSearched.succeeded.id, ["other-a"]);
  const crossExperiment = fixture.service.decidePromotion(SOLUTION, fixture.experiment.id, {
    ...input,
    searchedRunId: otherSearched.succeeded.id,
    evidenceManifestRef: otherManifest.id,
  });
  assert.ok(!crossExperiment.ok);
  assert.equal(crossExperiment.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(crossExperiment.error.details["reason"], "run-experiment-mismatch");
  // An unknown manifest on the promotion path fails closed with the manifest code.
  const unknownManifest = fixture.service.decidePromotion(SOLUTION, fixture.experiment.id, {
    ...input,
    evidenceManifestRef: "you_lab-evidence-manifest_missing",
  });
  assert.ok(!unknownManifest.ok);
  assert.equal(unknownManifest.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  // An unknown promotion record reads as YOU_LAB_PROMOTION_INVALID (the frozen taxonomy has no promotion-not-found code).
  const unknownPromotion = fixture.service.promotionOf(SOLUTION, "you_lab-promotion_missing");
  assert.ok(!unknownPromotion.ok);
  assert.equal(unknownPromotion.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(unknownPromotion.error.details["reason"], "promotion-unknown");
});

test("reversals append new records; the promoted record stays byte-identical", () => {
  const decided = decidedFixture("reversal");
  const input = {
    searchedRunId: decided.searchedRunId,
    baselineRunId: decided.baselineRunId,
    objectiveScore: 0.68,
    baselineScore: 0.71,
    evidenceManifestRef: decided.searchedManifestId,
  };
  // A reversal while the searched arm still beats the baseline refuses (the truth law).
  const premature = decided.service.reversePromotion(SOLUTION, decided.experiment.id, { ...input, objectiveScore: 0.9 });
  assert.ok(!premature.ok);
  assert.equal(premature.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(premature.error.details["reason"], "reversal-requires-baseline-win");
  const promotionJson = stableStringify(decided.promotion);
  const reversed = decided.service.reversePromotion(SOLUTION, decided.experiment.id, input);
  assert.ok(reversed.ok);
  assert.equal(reversed.value.promotion.winnerArm, "generalist-baseline");
  assert.equal(reversed.value.promotion.objectiveScore, 0.68);
  assert.notEqual(reversed.value.promotion.id, decided.promotion.id);
  // The ledger grew; the promoted record is byte-identical (immutable; new records on change).
  const ledger = decided.service.promotionLedgerOf(SOLUTION, decided.experiment.id);
  assert.ok(ledger.ok);
  assert.equal(ledger.value.ledger.length, 2);
  assert.equal(stableStringify(ledger.value.ledger[0]), promotionJson);
  // The experiment head walked to the reversal.
  const experiment = decided.service.experimentOf(SOLUTION, decided.experiment.id);
  assert.ok(experiment.ok);
  assert.equal(experiment.value.experiment.promotionRef, reversed.value.promotion.id);
  // The reversal linkage rides the ledger (lab-promotion-decided payload).
  const events = decided.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const reversalEvent = events.value.find(
    (event) => event.type === "lab-promotion-decided" && event.payload["promotionId"] === reversed.value.promotion.id,
  );
  assert.ok(reversalEvent !== undefined);
  assert.equal(reversalEvent.payload["reversalOfPromotionId"], decided.promotion.id);
  // Re-promotion after a reversal appends again (the ledger is the history).
  const rePromoted = decided.service.decidePromotion(SOLUTION, decided.experiment.id, {
    ...input,
    objectiveScore: 0.95,
  });
  assert.ok(rePromoted.ok);
  const ledgerAfter = decided.service.promotionLedgerOf(SOLUTION, decided.experiment.id);
  assert.ok(ledgerAfter.ok);
  assert.equal(ledgerAfter.value.ledger.length, 3);
});

test("reversal without a head promotion refuses (no-promotion-to-reverse)", () => {
  const fixture = createFixture("reversal-no-head");
  const baseline = succeedArm(fixture.service, fixture.experiment.id, "generalist-baseline", PLAN_HASHES["generalist-baseline"]);
  const searched = succeedArm(fixture.service, fixture.experiment.id, "searched", PLAN_HASHES.searched);
  const manifest = publishArtifacts(fixture.service, searched.succeeded.id, ["searched-a"]);
  const refused = fixture.service.reversePromotion(SOLUTION, fixture.experiment.id, {
    searchedRunId: searched.succeeded.id,
    baselineRunId: baseline.succeeded.id,
    objectiveScore: 0.4,
    baselineScore: 0.71,
    evidenceManifestRef: manifest.id,
  });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(refused.error.details["reason"], "no-promotion-to-reverse");
});

test("the lab events ride the ledger with the frozen payload conventions", () => {
  const decided = decidedFixture("ledger-payloads");
  const events = decided.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const runEvent = events.value.find(
    (event) =>
      event.type === "lab-run-recorded" && event.payload["runId"] === decided.searchedRunId && event.payload["statusAfter"] === "submitted",
  );
  assert.ok(runEvent !== undefined);
  assert.equal(runEvent.payload["experimentId"], decided.experiment.id);
  assert.equal(runEvent.payload["arm"], "searched");
  assert.equal(runEvent.payload["planHash"], PLAN_HASHES.searched);
  assert.equal(runEvent.payload["statusBefore"], "");
  assert.equal(runEvent.payload["completedAt"], "");
  assert.equal(runEvent.payload["evidenceManifestRef"], "");
  assert.equal(runEvent.payload["simulated"], true);
  const manifestEvent = events.value.find((event) => event.type === "lab-evidence-published");
  assert.ok(manifestEvent !== undefined);
  assert.equal(manifestEvent.payload["manifestId"], decided.searchedManifestId);
  assert.equal(manifestEvent.payload["runId"], decided.searchedRunId);
  assert.equal(manifestEvent.payload["experimentId"], decided.experiment.id);
  assert.equal(manifestEvent.payload["artifactCount"], 2);
  assert.equal(typeof manifestEvent.payload["artifactRef.0"], "string");
  const promotionEvent = events.value.find((event) => event.type === "lab-promotion-decided");
  assert.ok(promotionEvent !== undefined);
  assert.equal(promotionEvent.payload["promotionId"], decided.promotion.id);
  assert.equal(promotionEvent.payload["winnerArm"], "searched");
  assert.equal(promotionEvent.payload["objectiveScore"], 0.87);
  assert.equal(promotionEvent.payload["baselineScore"], 0.71);
  assert.equal(promotionEvent.payload["reversalOfPromotionId"], "");
  // Terminal run events carry the walked status.
  const terminalEvent = events.value.find((event) => event.type === "lab-run-recorded" && event.payload["statusAfter"] === "succeeded");
  assert.ok(terminalEvent !== undefined);
  assert.equal(terminalEvent.payload["statusBefore"], "running");
  assert.notEqual(terminalEvent.payload["completedAt"], "");
});

test("the live projection equals the ledger replay exactly (append-only state reproduction)", () => {
  const decided = decidedFixture("projection-equality");
  const reversed = decided.service.reversePromotion(SOLUTION, decided.experiment.id, {
    searchedRunId: decided.searchedRunId,
    baselineRunId: decided.baselineRunId,
    objectiveScore: 0.68,
    baselineScore: 0.71,
    evidenceManifestRef: decided.searchedManifestId,
  });
  assert.ok(reversed.ok);
  const events = decided.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const live = decided.service.projectionOf(SOLUTION);
  assert.ok(live.ok);
  const replay = LabService.replay(events.value);
  assert.equal(stableStringify(live.value), stableStringify(replay));
  // The replayed run head carries the evidence linkage (the ride-along fold).
  assert.equal(replay.runs[decided.searchedRunId]?.evidenceManifestRef, decided.searchedManifestId);
  assert.equal(replay.runs[decided.searchedRunId]?.status, "succeeded");
  // The replayed promotion head walked to the reversal.
  assert.equal(replay.promotionHeads[decided.experiment.id], reversed.value.promotion.id);
  assert.equal(replay.promotions[reversed.value.promotion.id]?.winnerArm, "generalist-baseline");
  assert.equal(replay.promotions[reversed.value.promotion.id]?.reversalOfPromotionId, decided.promotion.id);
});

test("determinism: the same seed produces a byte-identical ledger", () => {
  const run = (seed: string): string => {
    const decided = decidedFixture(seed);
    const reversed = decided.service.reversePromotion(SOLUTION, decided.experiment.id, {
      searchedRunId: decided.searchedRunId,
      baselineRunId: decided.baselineRunId,
      objectiveScore: 0.68,
      baselineScore: 0.71,
      evidenceManifestRef: decided.searchedManifestId,
    });
    assert.ok(reversed.ok);
    const hash = decided.service.ledgerHashOf(SOLUTION);
    assert.ok(hash.ok);
    return hash.value;
  };
  assert.equal(run("determinism-seed"), run("determinism-seed"));
  assert.notEqual(run("determinism-seed"), run("determinism-other"));
});
