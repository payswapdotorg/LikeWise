import assert from "node:assert/strict";
import test from "node:test";
import type { LabExperiment, LabRun, OpaqueId } from "@zcode/shared";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createLabService, LabService, type LabExperimentInput } from "./labService.js";

const SOLUTION = "you_w9a_service_test";

const EXPERIMENT_INPUT: LabExperimentInput = {
  intentRef: "you_intent_0000000000000001",
  constraintsHash: "constraints-hash-w9a-01",
  objective: "minimize-total-cost-under-quality-threshold",
  arms: ["generalist-baseline", "hand-designed", "searched"],
};

function artifactBytes(seed: string, count: number): Uint8Array {
  const rng = createDeterministicRng(seedFromString(seed));
  const bytes = new Uint8Array(count);
  for (let offset = 0; offset + 4 <= count; offset += 4) {
    const word = rng.nextUint32();
    bytes[offset] = word & 0xff;
    bytes[offset + 1] = (word >>> 8) & 0xff;
    bytes[offset + 2] = (word >>> 16) & 0xff;
    bytes[offset + 3] = (word >>> 24) & 0xff;
  }
  return bytes;
}

interface Fixture {
  readonly service: LabService;
  readonly experiment: LabExperiment;
}

function createFixture(seed: string, experimentInput: LabExperimentInput = EXPERIMENT_INPUT): Fixture {
  const service = createLabService({ workspaceIdentity: "ws-w9a-service-test", seed });
  const experiment = service.declareLabExperiment(SOLUTION, experimentInput);
  assert.ok(experiment.ok);
  return { service, experiment: experiment.value.experiment };
}

/** Submits and walks one arm run to "succeeded" (the standard happy-path run). */
function succeededRun(service: LabService, experimentId: OpaqueId, arm: "generalist-baseline" | "hand-designed" | "searched", planHash: string): LabRun {
  const submitted = service.submitLabRun(SOLUTION, experimentId, { arm, planHash });
  assert.ok(submitted.ok);
  const started = service.startLabRun(SOLUTION, submitted.value.run.id);
  assert.ok(started.ok);
  const succeeded = service.succeedLabRun(SOLUTION, submitted.value.run.id);
  assert.ok(succeeded.ok);
  return succeeded.value.run;
}

test("experiment persistence: the three-arm declaration is recorded, immutable and readable", () => {
  const fixture = createFixture("experiment-persistence");
  const found = fixture.service.experimentOf(SOLUTION, fixture.experiment.id);
  assert.ok(found.ok);
  assert.equal(found.value.experiment, fixture.experiment);
  assert.deepEqual(found.value.experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(found.value.experiment.promotionRef, null);
  assert.equal(found.value.experiment.simulated, true);
  assert.ok(Object.isFrozen(fixture.experiment));
  const listed = fixture.service.experimentsOf(SOLUTION);
  assert.ok(listed.ok);
  assert.equal(listed.value.experiments.length, 1);
});

test("experiment intake refusals are typed (the three-arm law)", () => {
  const service = createLabService({ workspaceIdentity: "ws-w9a-service-test", seed: "experiment-refusals" });
  const cases: readonly (readonly [unknown, string])[] = [
    [{ ...EXPERIMENT_INPUT, arms: ["generalist-baseline", "hand-designed"] }, "arms-count"],
    [{ ...EXPERIMENT_INPUT, arms: ["generalist-baseline", "hand-designed", "hand-designed"] }, "arms-duplicate"],
    [{ ...EXPERIMENT_INPUT, arms: ["generalist-baseline", "hand-designed", "ensharded"] }, "arms-missing"],
    [{ ...EXPERIMENT_INPUT, objective: "" }, "objective-empty"],
    [{ ...EXPERIMENT_INPUT, constraintsHash: "  " }, "constraints-hash-empty"],
    [{ ...EXPERIMENT_INPUT, intentRef: "" }, "intent-ref-empty"],
  ];
  for (const [input, refusal] of cases) {
    const result = service.declareLabExperiment(SOLUTION, input as LabExperimentInput);
    assert.ok(!result.ok, refusal);
    assert.equal(result.error.code, "YOU_INVALID_STATE");
    assert.equal(result.error.details["reason"], "invalid-experiment-intake");
    assert.equal(result.error.details["refusal"], refusal);
  }
  const unknown = service.experimentOf(SOLUTION, "you_lab-experiment_missing000000");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_LAB_EXPERIMENT_NOT_FOUND");
  assert.equal(unknown.error.details["reason"], "unknown-experiment");
});

test("the run ladder: arm-gated submission, immutable advancement, locked terminals", () => {
  const fixture = createFixture("run-ladder");
  const experimentId = fixture.experiment.id;
  const submitted = fixture.service.submitLabRun(SOLUTION, experimentId, { arm: "searched", planHash: "plan-searched-v1" });
  assert.ok(submitted.ok);
  assert.equal(submitted.value.run.status, "submitted");
  assert.equal(submitted.value.run.arm, "searched");
  assert.equal(submitted.value.run.simulated, true);
  assert.ok(Object.isFrozen(submitted.value.run));
  const started = fixture.service.startLabRun(SOLUTION, submitted.value.run.id);
  assert.ok(started.ok);
  assert.equal(started.value.run.status, "running");
  assert.equal(started.value.run.completedAt, null);
  // Immutable replacement: the earlier record objects are untouched.
  assert.equal(submitted.value.run.status, "submitted");
  const succeeded = fixture.service.succeedLabRun(SOLUTION, submitted.value.run.id);
  assert.ok(succeeded.ok);
  assert.equal(succeeded.value.run.status, "succeeded");
  assert.ok(succeeded.value.run.completedAt !== null);
  assert.equal(started.value.run.status, "running");
  // Terminals lock (typed refusal with the ladder's stable reason).
  const locked = fixture.service.retireLabRun(SOLUTION, succeeded.value.run.id);
  assert.ok(!locked.ok);
  assert.equal(locked.error.code, "YOU_INVALID_STATE");
  assert.equal(locked.error.details["reason"], "run-terminal-locked");
  // No-ops and off-ladder moves refuse.
  const noOp = fixture.service.succeedLabRun(SOLUTION, succeeded.value.run.id);
  assert.ok(!noOp.ok);
  assert.equal(noOp.error.details["reason"], "no-op-transition");
  const second = fixture.service.submitLabRun(SOLUTION, experimentId, { arm: "searched", planHash: "plan-searched-v2" });
  assert.ok(second.ok);
  const offLadder = fixture.service.failLabRun(SOLUTION, second.value.run.id);
  assert.ok(!offLadder.ok);
  assert.equal(offLadder.error.details["reason"], "transition-not-on-ladder");
  // Unknown runs refuse typed.
  const unknown = fixture.service.startLabRun(SOLUTION, "you_lab-run_missing00000000000");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_LAB_RUN_NOT_FOUND");
  assert.equal(unknown.error.details["reason"], "unknown-run");
  // The per-experiment ladder is append-only, in append order.
  const ladder = fixture.service.runsOfExperiment(SOLUTION, experimentId);
  assert.ok(ladder.ok);
  assert.deepEqual(
    ladder.value.runs.map((run) => run.id),
    [submitted.value.run.id, second.value.run.id],
  );
});

test("run submission gates: unknown experiment, undeclared arm, empty plan hash", () => {
  const fixture = createFixture("run-gates");
  const experimentId = fixture.experiment.id;
  const unknownExperiment = fixture.service.submitLabRun(SOLUTION, "you_lab-experiment_missing000000", { arm: "searched", planHash: "p" });
  assert.ok(!unknownExperiment.ok);
  assert.equal(unknownExperiment.error.code, "YOU_LAB_EXPERIMENT_NOT_FOUND");
  const undeclaredArmInput = { arm: "generalist-baseline-elite", planHash: "p" };
  const undeclared = fixture.service.submitLabRun(SOLUTION, experimentId, undeclaredArmInput as { arm: "searched"; planHash: string });
  assert.ok(!undeclared.ok);
  assert.equal(undeclared.error.code, "YOU_INVALID_STATE");
  assert.equal(undeclared.error.details["reason"], "arm-not-declared");
  const emptyPlan = fixture.service.submitLabRun(SOLUTION, experimentId, { arm: "searched", planHash: "" });
  assert.ok(!emptyPlan.ok);
  assert.equal(emptyPlan.error.details["refusal"], "plan-hash-empty");
});

test("evidence manifests: content-addressed publication, run-head rebinding, append-only re-publish", () => {
  const fixture = createFixture("evidence");
  const run = succeededRun(fixture.service, fixture.experiment.id, "searched", "plan-searched-v1");
  const artifacts = [artifactBytes("evidence-a1", 128), artifactBytes("evidence-a2", 128)];
  const published = fixture.service.publishLabEvidence(SOLUTION, run.id, artifacts);
  assert.ok(published.ok);
  const manifest = published.value.manifest;
  assert.equal(manifest.runId, run.id);
  assert.equal(manifest.artifactRefs.length, 2);
  assert.equal(manifest.simulated, true);
  assert.ok(Object.isFrozen(manifest));
  // The run head rebinds to the manifest (immutable replacement).
  assert.equal(published.value.run.evidenceManifestRef, manifest.id);
  const runHead = fixture.service.runOf(SOLUTION, run.id);
  assert.ok(runHead.ok);
  assert.equal(runHead.value.run.evidenceManifestRef, manifest.id);
  // Re-publishing appends a second manifest and moves the head ref.
  const republished = fixture.service.publishLabEvidence(SOLUTION, run.id, [artifactBytes("evidence-a3", 64)]);
  assert.ok(republished.ok);
  const all = fixture.service.manifestsOf(SOLUTION);
  assert.ok(all.ok);
  assert.equal(all.value.manifests.length, 2);
  const head = fixture.service.runOf(SOLUTION, run.id);
  assert.ok(head.ok);
  assert.equal(head.value.run.evidenceManifestRef, republished.value.manifest.id);
});

test("evidence publication gates: non-terminal run, empty bundle, unknown run", () => {
  const fixture = createFixture("evidence-gates");
  const experimentId = fixture.experiment.id;
  const submitted = fixture.service.submitLabRun(SOLUTION, experimentId, { arm: "searched", planHash: "p" });
  assert.ok(submitted.ok);
  const notTerminal = fixture.service.publishLabEvidence(SOLUTION, submitted.value.run.id, [artifactBytes("gate-a", 32)]);
  assert.ok(!notTerminal.ok);
  assert.equal(notTerminal.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(notTerminal.error.details["reason"], "run-not-terminal");
  const run = succeededRun(fixture.service, experimentId, "searched", "plan-searched-v1");
  const empty = fixture.service.publishLabEvidence(SOLUTION, run.id, []);
  assert.ok(!empty.ok);
  assert.equal(empty.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(empty.error.details["reason"], "artifacts-empty");
  const unknownRun = fixture.service.publishLabEvidence(SOLUTION, "you_lab-run_missing00000000000", [artifactBytes("gate-b", 32)]);
  assert.ok(!unknownRun.ok);
  assert.equal(unknownRun.error.code, "YOU_LAB_RUN_NOT_FOUND");
});

test("manifest verification: deep store-backed pass; unknown manifest fails closed", () => {
  const fixture = createFixture("verification");
  const run = succeededRun(fixture.service, fixture.experiment.id, "searched", "plan-searched-v1");
  const published = fixture.service.publishLabEvidence(SOLUTION, run.id, [artifactBytes("verify-a", 256)]);
  assert.ok(published.ok);
  const verified = fixture.service.verifyLabEvidenceManifest(SOLUTION, published.value.manifest.id);
  assert.ok(verified.ok);
  assert.equal(verified.value.verified, true);
  assert.equal(verified.value.contentHash, published.value.manifest.contentHash);
  const unknown = fixture.service.verifyLabEvidenceManifest(SOLUTION, "you_lab-evidence-manifest_missing");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(unknown.error.details["reason"], "unknown-manifest");
});

test("the promotion gate: a searched arm promotes only when it beats the baseline", () => {
  const fixture = createFixture("promotion");
  const experimentId = fixture.experiment.id;
  const run = succeededRun(fixture.service, experimentId, "searched", "plan-searched-v1");
  const published = fixture.service.publishLabEvidence(SOLUTION, run.id, [artifactBytes("promo-a", 128)]);
  assert.ok(published.ok);
  const manifestId = published.value.manifest.id;
  // Not beating refuses with the law's stable reason.
  const notBeating = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.62,
    baselineScore: 0.62,
    evidenceManifestRef: manifestId,
  });
  assert.ok(!notBeating.ok);
  assert.equal(notBeating.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(notBeating.error.details["reason"], "searched-does-not-beat-baseline");
  // Unknown manifest / unknown experiment refuse typed.
  const unknownManifest = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.9,
    baselineScore: 0.6,
    evidenceManifestRef: "you_lab-evidence-manifest_missing",
  });
  assert.ok(!unknownManifest.ok);
  assert.equal(unknownManifest.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  const unknownExperiment = fixture.service.promoteLabExperiment(SOLUTION, "you_lab-experiment_missing000000", {
    objectiveScore: 0.9,
    baselineScore: 0.6,
    evidenceManifestRef: manifestId,
  });
  assert.ok(!unknownExperiment.ok);
  assert.equal(unknownExperiment.error.code, "YOU_LAB_EXPERIMENT_NOT_FOUND");
  // The winning promotion.
  const promoted = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.87,
    baselineScore: 0.62,
    evidenceManifestRef: manifestId,
  });
  assert.ok(promoted.ok);
  assert.equal(promoted.value.promotion.winnerArm, "searched");
  assert.equal(promoted.value.promotion.objectiveScore, 0.87);
  assert.equal(promoted.value.experiment.promotionRef, promoted.value.promotion.id);
  assert.ok(Object.isFrozen(promoted.value.promotion));
  const originalExperiment = fixture.experiment;
  assert.equal(originalExperiment.promotionRef, null);
});

test("the promotion gate refuses evidence that belongs to another experiment", () => {
  const fixture = createFixture("promotion-mismatch");
  const other = fixture.service.declareLabExperiment(SOLUTION, {
    ...EXPERIMENT_INPUT,
    intentRef: "you_intent_0000000000000002",
    constraintsHash: "constraints-hash-w9a-02",
  });
  assert.ok(other.ok);
  const otherRun = succeededRun(fixture.service, other.value.experiment.id, "searched", "plan-other-v1");
  const otherEvidence = fixture.service.publishLabEvidence(SOLUTION, otherRun.id, [artifactBytes("mismatch-a", 128)]);
  assert.ok(otherEvidence.ok);
  const refused = fixture.service.promoteLabExperiment(SOLUTION, fixture.experiment.id, {
    objectiveScore: 0.9,
    baselineScore: 0.6,
    evidenceManifestRef: otherEvidence.value.manifest.id,
  });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_LAB_EVIDENCE_MANIFEST_INVALID");
  assert.equal(refused.error.details["reason"], "manifest-experiment-mismatch");
});

test("reversals are new records on the append-only decision chain; the head linkage walks", () => {
  const fixture = createFixture("reversal");
  const experimentId = fixture.experiment.id;
  const run = succeededRun(fixture.service, experimentId, "searched", "plan-searched-v1");
  const published = fixture.service.publishLabEvidence(SOLUTION, run.id, [artifactBytes("reverse-a", 128)]);
  assert.ok(published.ok);
  // Nothing to reverse yet.
  const tooEarly = fixture.service.reverseLabPromotion(SOLUTION, experimentId, {
    objectiveScore: 0.55,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(!tooEarly.ok);
  assert.equal(tooEarly.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(tooEarly.error.details["reason"], "no-promotion-to-reverse");
  // Promote, then reverse, then re-promote.
  const promoted = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.87,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(promoted.ok);
  const stillBeats = fixture.service.reverseLabPromotion(SOLUTION, experimentId, {
    objectiveScore: 0.9,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(!stillBeats.ok);
  assert.equal(stillBeats.error.details["reason"], "searched-still-beats-baseline");
  const reversed = fixture.service.reverseLabPromotion(SOLUTION, experimentId, {
    objectiveScore: 0.55,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(reversed.ok);
  assert.equal(reversed.value.promotion.winnerArm, "generalist-baseline");
  assert.equal(reversed.value.experiment.promotionRef, reversed.value.promotion.id);
  const repromoted = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.91,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(repromoted.ok);
  // The chain preserves every immutable record in order.
  const chain = fixture.service.promotionsOfExperiment(SOLUTION, experimentId);
  assert.ok(chain.ok);
  assert.deepEqual(
    chain.value.promotions.map((promotion) => promotion.id),
    [promoted.value.promotion.id, reversed.value.promotion.id, repromoted.value.promotion.id],
  );
  assert.deepEqual(
    chain.value.promotions.map((promotion) => promotion.winnerArm),
    ["searched", "generalist-baseline", "searched"],
  );
  // The earlier records are untouched (immutable chain law).
  assert.equal(promoted.value.promotion.winnerArm, "searched");
  const head = fixture.service.experimentOf(SOLUTION, experimentId);
  assert.ok(head.ok);
  assert.equal(head.value.experiment.promotionRef, repromoted.value.promotion.id);
  // Unknown promotion reads refuse typed.
  const unknown = fixture.service.promotionOf(SOLUTION, "you_lab-promotion_missing00000000");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_LAB_PROMOTION_INVALID");
  assert.equal(unknown.error.details["reason"], "unknown-promotion");
});

test("the three wave-9 events ride the ledger with the documented payload conventions", () => {
  const fixture = createFixture("ledger");
  const experimentId = fixture.experiment.id;
  const run = succeededRun(fixture.service, experimentId, "searched", "plan-searched-v1");
  const published = fixture.service.publishLabEvidence(SOLUTION, run.id, [artifactBytes("ledger-a", 128)]);
  assert.ok(published.ok);
  const promoted = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.87,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(promoted.ok);
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const runEvents = events.value.filter((event) => event.type === "lab-run-recorded");
  assert.equal(runEvents.length, 3);
  assert.equal(runEvents[0]?.payload["statusBefore"], "");
  assert.equal(runEvents[0]?.payload["statusAfter"], "submitted");
  assert.equal(runEvents[0]?.payload["arm"], "searched");
  assert.equal(runEvents[0]?.payload["planHash"], "plan-searched-v1");
  // The declaration facts ride along on every run event.
  assert.equal(runEvents[0]?.payload["experimentIntentRef"], "you_intent_0000000000000001");
  assert.equal(runEvents[0]?.payload["experimentConstraintsHash"], "constraints-hash-w9a-01");
  assert.equal(runEvents[0]?.payload["experimentObjective"], "minimize-total-cost-under-quality-threshold");
  assert.equal(runEvents[0]?.payload["experimentArmCount"], 3);
  assert.equal(runEvents[0]?.payload["experimentArm.0"], "generalist-baseline");
  assert.equal(runEvents[0]?.payload["experimentArm.2"], "searched");
  assert.equal(runEvents[1]?.payload["statusBefore"], "submitted");
  assert.equal(runEvents[1]?.payload["statusAfter"], "running");
  assert.equal(runEvents[2]?.payload["statusAfter"], "succeeded");
  const evidenceEvents = events.value.filter((event) => event.type === "lab-evidence-published");
  assert.equal(evidenceEvents.length, 1);
  assert.equal(evidenceEvents[0]?.payload["manifestId"], published.value.manifest.id);
  assert.equal(evidenceEvents[0]?.payload["runId"], run.id);
  assert.equal(evidenceEvents[0]?.payload["contentHash"], published.value.manifest.contentHash);
  assert.equal(evidenceEvents[0]?.payload["artifactCount"], 1);
  assert.equal(evidenceEvents[0]?.payload["artifactRef.0"], published.value.bindings[0]?.contentRef);
  const promotionEvents = events.value.filter((event) => event.type === "lab-promotion-decided");
  assert.equal(promotionEvents.length, 1);
  assert.equal(promotionEvents[0]?.payload["decisionKind"], "promote");
  assert.equal(promotionEvents[0]?.payload["winnerArm"], "searched");
  assert.equal(promotionEvents[0]?.payload["objectiveScore"], 0.87);
  assert.equal(promotionEvents[0]?.payload["experimentPromotionRefBefore"], "");
  assert.equal(promotionEvents[0]?.payload["experimentPromotionRefAfter"], promoted.value.promotion.id);
  // Truth law: every payload carries simulated: true.
  for (const event of events.value) {
    assert.equal(event.payload["simulated"], true, event.type);
  }
});

test("the live projection equals the ledger replay exactly (append-only state reproduction)", () => {
  const fixture = createFixture("projection");
  const experimentId = fixture.experiment.id;
  const baselineRun = succeededRun(fixture.service, experimentId, "generalist-baseline", "plan-baseline-v1");
  const searchedRun = succeededRun(fixture.service, experimentId, "searched", "plan-searched-v1");
  const published = fixture.service.publishLabEvidence(SOLUTION, searchedRun.id, [artifactBytes("proj-a", 128)]);
  assert.ok(published.ok);
  const promoted = fixture.service.promoteLabExperiment(SOLUTION, experimentId, {
    objectiveScore: 0.87,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(promoted.ok);
  const reversed = fixture.service.reverseLabPromotion(SOLUTION, experimentId, {
    objectiveScore: 0.55,
    baselineScore: 0.62,
    evidenceManifestRef: published.value.manifest.id,
  });
  assert.ok(reversed.ok);
  void baselineRun;
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const live = fixture.service.projectionOf(SOLUTION);
  assert.ok(live.ok);
  const replay = LabService.replay(events.value);
  assert.equal(stableStringify(live.value), stableStringify(replay));
  // Spot checks on the shared projection shape.
  assert.equal(replay.experiments[experimentId]?.promotionRef, reversed.value.promotion.id);
  assert.equal(replay.runs[searchedRun.id]?.status, "succeeded");
  assert.equal(replay.runs[searchedRun.id]?.evidenceManifestRef, published.value.manifest.id);
  assert.deepEqual(replay.promotionChains[experimentId], [promoted.value.promotion.id, reversed.value.promotion.id]);
});

test("determinism: the same seed reproduces the identical ledger; a different seed diverges", () => {
  const buildHash = (seed: string): string => {
    const fixture = createFixture(`determinism-${seed}`);
    const run = succeededRun(fixture.service, fixture.experiment.id, "searched", "plan-searched-v1");
    const published = fixture.service.publishLabEvidence(SOLUTION, run.id, [artifactBytes(`determinism-${seed}`, 128)]);
    assert.ok(published.ok);
    const promoted = fixture.service.promoteLabExperiment(SOLUTION, fixture.experiment.id, {
      objectiveScore: 0.87,
      baselineScore: 0.62,
      evidenceManifestRef: published.value.manifest.id,
    });
    assert.ok(promoted.ok);
    const hash = fixture.service.ledgerHashOf(SOLUTION);
    assert.ok(hash.ok);
    return hash.value;
  };
  const first = buildHash("alpha");
  const second = buildHash("alpha");
  assert.equal(first, second);
  const other = buildHash("beta");
  assert.notEqual(first, other);
});
