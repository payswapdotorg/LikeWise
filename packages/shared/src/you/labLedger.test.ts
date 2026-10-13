import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import { SolutionEventLedger } from "./events.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { replayLabLedger } from "./labLedger.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(7919)) };

function ledger(): SolutionEventLedger {
  return new SolutionEventLedger("you_w9a_ledger_test", DEPS);
}

test("the fold reconstructs the run-ladder head per run (last event wins)", () => {
  const book = ledger();
  book.append({
    type: "lab-run-recorded",
    subjectRef: "you_lab-run_0000000000000001",
    payload: {
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      arm: "searched",
      planHash: "planhash-9a-0001",
      statusBefore: "",
      statusAfter: "submitted",
      submittedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "",
      evidenceManifestRef: "",
      simulated: true,
    },
  });
  book.append({
    type: "lab-run-recorded",
    subjectRef: "you_lab-run_0000000000000001",
    payload: {
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      arm: "searched",
      planHash: "planhash-9a-0001",
      statusBefore: "submitted",
      statusAfter: "running",
      submittedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "",
      evidenceManifestRef: "",
      simulated: true,
    },
  });
  book.append({
    type: "lab-run-recorded",
    subjectRef: "you_lab-run_0000000000000001",
    payload: {
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      arm: "searched",
      planHash: "planhash-9a-0001",
      statusBefore: "running",
      statusAfter: "succeeded",
      submittedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "2026-01-01T00:00:03.000Z",
      evidenceManifestRef: "",
      simulated: true,
    },
  });
  const projection = replayLabLedger(book.events());
  const run = projection.runs["you_lab-run_0000000000000001"];
  assert.ok(run !== undefined);
  assert.equal(run.experimentId, "you_lab-experiment_0000000000000001");
  assert.equal(run.arm, "searched");
  assert.equal(run.planHash, "planhash-9a-0001");
  assert.equal(run.status, "succeeded");
  assert.equal(run.submittedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(run.completedAt, "2026-01-01T00:00:03.000Z");
  assert.equal(run.evidenceManifestRef, "");
  assert.equal(run.simulated, true);
});

test("the fold reconstructs manifests and walks the run head's evidence linkage", () => {
  const book = ledger();
  book.append({
    type: "lab-run-recorded",
    subjectRef: "you_lab-run_0000000000000001",
    payload: {
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      arm: "searched",
      planHash: "planhash-9a-0001",
      statusBefore: "running",
      statusAfter: "succeeded",
      submittedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "2026-01-01T00:00:03.000Z",
      evidenceManifestRef: "",
      simulated: true,
    },
  });
  book.append({
    type: "lab-evidence-published",
    subjectRef: "you_lab-evidence-manifest_0000000000000001",
    payload: {
      manifestId: "you_lab-evidence-manifest_0000000000000001",
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      contentHash: "a".repeat(64),
      artifactCount: 3,
      "artifactRef.0": "you_content_000000000000000a",
      "artifactRef.1": "you_content_000000000000000b",
      "artifactRef.2": "you_content_000000000000000c",
      publishedAt: "2026-01-01T00:00:04.000Z",
      simulated: true,
    },
  });
  const projection = replayLabLedger(book.events());
  const manifest = projection.manifests["you_lab-evidence-manifest_0000000000000001"];
  assert.ok(manifest !== undefined);
  assert.equal(manifest.runId, "you_lab-run_0000000000000001");
  assert.equal(manifest.experimentId, "you_lab-experiment_0000000000000001");
  assert.equal(manifest.contentHash, "a".repeat(64));
  assert.deepEqual(manifest.artifactRefs, [
    "you_content_000000000000000a",
    "you_content_000000000000000b",
    "you_content_000000000000000c",
  ]);
  assert.equal(manifest.publishedAt, "2026-01-01T00:00:04.000Z");
  // The run head's evidence linkage walked (the W1A ride-along fold).
  assert.equal(projection.runs["you_lab-run_0000000000000001"]?.evidenceManifestRef, "you_lab-evidence-manifest_0000000000000001");
});

test("the fold reconstructs promotions and walks the per-experiment head", () => {
  const book = ledger();
  const decision = (
    promotionId: string,
    winnerArm: string,
    objectiveScore: number,
    baselineScore: number,
    reversalOfPromotionId: string,
  ): Record<string, string | number | boolean> => ({
    promotionId,
    experimentId: "you_lab-experiment_0000000000000001",
    winnerArm,
    objectiveScore,
    baselineScore,
    evidenceManifestRef: "you_lab-evidence-manifest_0000000000000001",
    decidedAt: "2026-01-01T00:00:05.000Z",
    reversalOfPromotionId,
    simulated: true,
  });
  book.append({ type: "lab-promotion-decided", subjectRef: "you_lab-promotion_0000000000000001", payload: decision("you_lab-promotion_0000000000000001", "searched", 0.87, 0.71, "") });
  book.append({ type: "lab-promotion-decided", subjectRef: "you_lab-promotion_0000000000000002", payload: decision("you_lab-promotion_0000000000000002", "generalist-baseline", 0.68, 0.71, "you_lab-promotion_0000000000000001") });
  const projection = replayLabLedger(book.events());
  const promotion = projection.promotions["you_lab-promotion_0000000000000001"];
  assert.ok(promotion !== undefined);
  assert.equal(promotion.winnerArm, "searched");
  assert.equal(promotion.objectiveScore, 0.87);
  assert.equal(promotion.baselineScore, 0.71);
  assert.equal(promotion.reversalOfPromotionId, "");
  const reversal = projection.promotions["you_lab-promotion_0000000000000002"];
  assert.ok(reversal !== undefined);
  assert.equal(reversal.winnerArm, "generalist-baseline");
  assert.equal(reversal.reversalOfPromotionId, "you_lab-promotion_0000000000000001");
  // The head walked to the newest decision (append-only ledger).
  assert.equal(projection.promotionHeads["you_lab-experiment_0000000000000001"], "you_lab-promotion_0000000000000002");
});

test("the fold is defensive: malformed events fold as no-ops, never crashes", () => {
  const book = ledger();
  book.append({ type: "lab-run-recorded", subjectRef: null, payload: { simulated: true } });
  book.append({ type: "lab-evidence-published", subjectRef: null, payload: { runId: "you_lab-run_missing" } });
  book.append({ type: "lab-promotion-decided", subjectRef: null, payload: {} });
  const projection = replayLabLedger(book.events());
  assert.deepEqual(projection.runs, {});
  assert.deepEqual(projection.manifests, {});
  assert.deepEqual(projection.promotions, {});
  assert.deepEqual(projection.promotionHeads, {});
});

test("the fold is deterministic: same events => byte-identical projection", () => {
  const first = ledger();
  first.append({
    type: "lab-run-recorded",
    subjectRef: "you_lab-run_0000000000000001",
    payload: {
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      arm: "generalist-baseline",
      planHash: "planhash-9a-0000",
      statusBefore: "",
      statusAfter: "submitted",
      submittedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "",
      evidenceManifestRef: "",
      simulated: true,
    },
  });
  const second = ledger();
  second.append({
    type: "lab-run-recorded",
    subjectRef: "you_lab-run_0000000000000001",
    payload: {
      runId: "you_lab-run_0000000000000001",
      experimentId: "you_lab-experiment_0000000000000001",
      arm: "generalist-baseline",
      planHash: "planhash-9a-0000",
      statusBefore: "",
      statusAfter: "submitted",
      submittedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "",
      evidenceManifestRef: "",
      simulated: true,
    },
  });
  assert.equal(stableStringify(replayLabLedger(first.events())), stableStringify(replayLabLedger(second.events())));
});

test("replaying an empty ledger refuses (the W1A/W8A fold precedent)", () => {
  assert.throws(() => replayLabLedger([]), /requires at least one event/);
});
