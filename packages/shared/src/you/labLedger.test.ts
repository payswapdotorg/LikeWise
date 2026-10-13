import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import { SolutionEventLedger } from "./events.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { replayLabLedger } from "./labLedger.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(9919)) };

function ledger(): SolutionEventLedger {
  return new SolutionEventLedger("you_w9a_ledger_test", DEPS);
}

/** Builds one lab-run-recorded payload (the W9A ride-along convention). */
function runPayload(input: {
  readonly runId: string;
  readonly experimentId: string;
  readonly statusBefore: string;
  readonly statusAfter: string;
  readonly evidenceManifestRef?: string;
}): Record<string, string | number | boolean> {
  return {
    runId: input.runId,
    experimentId: input.experimentId,
    arm: "searched",
    planHash: "plan-hash-01",
    statusBefore: input.statusBefore,
    statusAfter: input.statusAfter,
    submittedAt: "2026-01-01T00:00:01.000Z",
    completedAt: input.statusAfter === "succeeded" ? "2026-01-01T00:00:03.000Z" : "",
    evidenceManifestRef: input.evidenceManifestRef ?? "",
    experimentIntentRef: "you_intent_0000000000000001",
    experimentConstraintsHash: "constraints-hash-01",
    experimentObjective: "minimize-total-cost-under-quality-threshold",
    experimentArmCount: 3,
    "experimentArm.0": "generalist-baseline",
    "experimentArm.1": "hand-designed",
    "experimentArm.2": "searched",
    simulated: true,
  };
}

test("the fold reconstructs experiments from the run-event declaration facts", () => {
  const book = ledger();
  book.append({ type: "lab-run-recorded", subjectRef: "you_lab-run_0000000000000001", payload: runPayload({ runId: "you_lab-run_0000000000000001", experimentId: "you_lab-experiment_0000000000000001", statusBefore: "", statusAfter: "submitted" }) });
  const projection = replayLabLedger(book.events());
  const experiment = projection.experiments["you_lab-experiment_0000000000000001"];
  assert.ok(experiment !== undefined);
  assert.equal(experiment.intentRef, "you_intent_0000000000000001");
  assert.equal(experiment.constraintsHash, "constraints-hash-01");
  assert.equal(experiment.objective, "minimize-total-cost-under-quality-threshold");
  assert.deepEqual(experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(experiment.promotionRef, "");
  assert.equal(experiment.simulated, true);
});

test("the fold reconstructs the run ladder head per run", () => {
  const book = ledger();
  const runId = "you_lab-run_0000000000000001";
  const experimentId = "you_lab-experiment_0000000000000001";
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "", statusAfter: "submitted" }) });
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "submitted", statusAfter: "running" }) });
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "running", statusAfter: "succeeded" }) });
  const projection = replayLabLedger(book.events());
  const run = projection.runs[runId];
  assert.ok(run !== undefined);
  assert.equal(run.status, "succeeded");
  assert.equal(run.experimentId, experimentId);
  assert.equal(run.arm, "searched");
  assert.equal(run.planHash, "plan-hash-01");
  assert.equal(run.submittedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(run.completedAt, "2026-01-01T00:00:03.000Z");
  assert.equal(run.evidenceManifestRef, "");
  assert.equal(run.simulated, true);
});

test("the fold reconstructs manifests and moves the run's evidence ref", () => {
  const book = ledger();
  const runId = "you_lab-run_0000000000000001";
  const experimentId = "you_lab-experiment_0000000000000001";
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "", statusAfter: "succeeded" }) });
  book.append({
    type: "lab-evidence-published",
    subjectRef: "you_lab-evidence-manifest_0000000000000001",
    payload: {
      manifestId: "you_lab-evidence-manifest_0000000000000001",
      runId,
      contentHash: "a".repeat(64),
      artifactCount: 2,
      "artifactRef.0": "you_lab-artifact_0000000000000001",
      "artifactHash.0": "b".repeat(64),
      "artifactRef.1": "you_lab-artifact_0000000000000002",
      "artifactHash.1": "c".repeat(64),
      publishedAt: "2026-01-01T00:00:04.000Z",
      simulated: true,
    },
  });
  const projection = replayLabLedger(book.events());
  const manifest = projection.manifests["you_lab-evidence-manifest_0000000000000001"];
  assert.ok(manifest !== undefined);
  assert.equal(manifest.runId, runId);
  assert.equal(manifest.contentHash, "a".repeat(64));
  assert.deepEqual(manifest.artifactRefs, ["you_lab-artifact_0000000000000001", "you_lab-artifact_0000000000000002"]);
  assert.deepEqual(manifest.artifactHashes, ["b".repeat(64), "c".repeat(64)]);
  assert.equal(manifest.publishedAt, "2026-01-01T00:00:04.000Z");
  assert.equal(manifest.simulated, true);
  // The publication moved the run head's evidence ref.
  assert.equal(projection.runs[runId]?.evidenceManifestRef, "you_lab-evidence-manifest_0000000000000001");
});

test("the fold reconstructs promotion chains and the experiment promotion head", () => {
  const book = ledger();
  const runId = "you_lab-run_0000000000000001";
  const experimentId = "you_lab-experiment_0000000000000001";
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "", statusAfter: "succeeded" }) });
  const decision = (promotionId: string, kind: string, winnerArm: string, objectiveScore: number, supersedes: string, refBefore: string): Record<string, string | number | boolean> => ({
    promotionId,
    experimentId,
    decisionKind: kind,
    winnerArm,
    objectiveScore,
    baselineScore: 0.62,
    evidenceManifestRef: "you_lab-evidence-manifest_0000000000000001",
    supersedesPromotionId: supersedes,
    experimentPromotionRefBefore: refBefore,
    experimentPromotionRefAfter: promotionId,
    decidedAt: "2026-01-01T00:00:05.000Z",
    simulated: true,
  });
  book.append({ type: "lab-promotion-decided", subjectRef: "you_lab-promotion_0000000000000001", payload: decision("you_lab-promotion_0000000000000001", "promote", "searched", 0.87, "", "") });
  book.append({ type: "lab-promotion-decided", subjectRef: "you_lab-promotion_0000000000000002", payload: decision("you_lab-promotion_0000000000000002", "reverse", "generalist-baseline", 0.55, "you_lab-promotion_0000000000000001", "you_lab-promotion_0000000000000001") });
  const projection = replayLabLedger(book.events());
  assert.deepEqual(projection.promotionChains[experimentId], [
    "you_lab-promotion_0000000000000001",
    "you_lab-promotion_0000000000000002",
  ]);
  // The head linkage follows the latest decision.
  assert.equal(projection.experiments[experimentId]?.promotionRef, "you_lab-promotion_0000000000000002");
  const promoted = projection.promotions["you_lab-promotion_0000000000000001"];
  assert.ok(promoted !== undefined);
  assert.equal(promoted.decisionKind, "promote");
  assert.equal(promoted.winnerArm, "searched");
  assert.equal(promoted.objectiveScore, 0.87);
  assert.equal(promoted.baselineScore, 0.62);
  assert.equal(promoted.supersedesPromotionId, "");
  const reversed = projection.promotions["you_lab-promotion_0000000000000002"];
  assert.ok(reversed !== undefined);
  assert.equal(reversed.decisionKind, "reverse");
  assert.equal(reversed.winnerArm, "generalist-baseline");
  assert.equal(reversed.supersedesPromotionId, "you_lab-promotion_0000000000000001");
});

test("the fold is deterministic and folds unknown refs defensively", () => {
  const book = ledger();
  const runId = "you_lab-run_0000000000000001";
  const experimentId = "you_lab-experiment_0000000000000001";
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "", statusAfter: "submitted" }) });
  // An event referencing an unknown run folds defensively (ignored).
  book.append({
    type: "lab-evidence-published",
    subjectRef: "you_lab-evidence-manifest_00000000000000ff",
    payload: {
      manifestId: "you_lab-evidence-manifest_00000000000000ff",
      runId: "you_lab-run_missing00000000000",
      contentHash: "d".repeat(64),
      artifactCount: 1,
      "artifactRef.0": "you_lab-artifact_0000000000000001",
      "artifactHash.0": "e".repeat(64),
      publishedAt: "2026-01-01T00:00:06.000Z",
      simulated: true,
    },
  });
  // A promotion event for an unknown experiment folds defensively: the
  // promotion record and chain still record, the experiment head does not.
  book.append({
    type: "lab-promotion-decided",
    subjectRef: "you_lab-promotion_00000000000000ff",
    payload: {
      promotionId: "you_lab-promotion_00000000000000ff",
      experimentId: "you_lab-experiment_missing000000",
      decisionKind: "promote",
      winnerArm: "searched",
      objectiveScore: 0.9,
      baselineScore: 0.6,
      evidenceManifestRef: "you_lab-evidence-manifest_00000000000000ff",
      supersedesPromotionId: "",
      experimentPromotionRefBefore: "",
      experimentPromotionRefAfter: "you_lab-promotion_00000000000000ff",
      decidedAt: "2026-01-01T00:00:07.000Z",
      simulated: true,
    },
  });
  const first = replayLabLedger(book.events());
  const second = replayLabLedger([...book.events()]);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.runs["you_lab-run_missing00000000000"], undefined);
  assert.ok(first.manifests["you_lab-evidence-manifest_00000000000000ff"] !== undefined);
  assert.deepEqual(first.promotionChains["you_lab-experiment_missing000000"], ["you_lab-promotion_00000000000000ff"]);
  assert.equal(first.experiments["you_lab-experiment_missing000000"], undefined);
  assert.throws(() => replayLabLedger([]), /at least one event/);
});

test("later run events never clobber the promotion head linkage", () => {
  const book = ledger();
  const runId = "you_lab-run_0000000000000001";
  const experimentId = "you_lab-experiment_0000000000000001";
  book.append({ type: "lab-run-recorded", subjectRef: runId, payload: runPayload({ runId, experimentId, statusBefore: "", statusAfter: "succeeded" }) });
  book.append({
    type: "lab-promotion-decided",
    subjectRef: "you_lab-promotion_0000000000000001",
    payload: {
      promotionId: "you_lab-promotion_0000000000000001",
      experimentId,
      decisionKind: "promote",
      winnerArm: "searched",
      objectiveScore: 0.87,
      baselineScore: 0.62,
      evidenceManifestRef: "you_lab-evidence-manifest_0000000000000001",
      supersedesPromotionId: "",
      experimentPromotionRefBefore: "",
      experimentPromotionRefAfter: "you_lab-promotion_0000000000000001",
      decidedAt: "2026-01-01T00:00:05.000Z",
      simulated: true,
    },
  });
  // A second run recorded AFTER the promotion: its ride-along facts must
  // not reset the experiment's promotionRef.
  book.append({ type: "lab-run-recorded", subjectRef: "you_lab-run_0000000000000002", payload: runPayload({ runId: "you_lab-run_0000000000000002", experimentId, statusBefore: "", statusAfter: "submitted" }) });
  const projection = replayLabLedger(book.events());
  assert.equal(projection.experiments[experimentId]?.promotionRef, "you_lab-promotion_0000000000000001");
});
