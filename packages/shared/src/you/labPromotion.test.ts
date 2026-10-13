import assert from "node:assert/strict";
import test from "node:test";
import {
  constructLabPromotionRecord,
  evaluateLabPromotionGate,
  labComparisonWinner,
  validateLabPromotionRecordInput,
} from "./labPromotion.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:09.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

test("THE LAW: the gate allows exactly a searched arm that strictly beats the baseline", () => {
  assert.deepEqual(evaluateLabPromotionGate({ winnerArm: "searched", objectiveScore: 0.87, baselineScore: 0.71 }), {
    allowed: true,
    reason: "searched-beats-baseline",
  });
  // A tie does NOT beat (strict comparison).
  assert.deepEqual(evaluateLabPromotionGate({ winnerArm: "searched", objectiveScore: 0.71, baselineScore: 0.71 }), {
    allowed: false,
    reason: "searched-does-not-beat-baseline",
  });
  assert.deepEqual(evaluateLabPromotionGate({ winnerArm: "searched", objectiveScore: 0.5, baselineScore: 0.71 }), {
    allowed: false,
    reason: "searched-does-not-beat-baseline",
  });
  // Only a searched organization promotes.
  assert.deepEqual(evaluateLabPromotionGate({ winnerArm: "generalist-baseline", objectiveScore: 0.9, baselineScore: 0.71 }), {
    allowed: false,
    reason: "winner-not-searched",
  });
  assert.deepEqual(evaluateLabPromotionGate({ winnerArm: "hand-designed", objectiveScore: 0.9, baselineScore: 0.71 }), {
    allowed: false,
    reason: "winner-not-searched",
  });
  // Non-finite scores never pass.
  for (const scores of [
    { objectiveScore: Number.NaN, baselineScore: 0.71 },
    { objectiveScore: 0.87, baselineScore: Number.NaN },
    { objectiveScore: Number.POSITIVE_INFINITY, baselineScore: 0.71 },
  ]) {
    assert.deepEqual(evaluateLabPromotionGate({ winnerArm: "searched", ...scores }), {
      allowed: false,
      reason: "scores-invalid",
    });
  }
});

test("the comparison winner encodes the reversal outcome truthfully", () => {
  assert.equal(labComparisonWinner(0.87, 0.71), "searched");
  assert.equal(labComparisonWinner(0.71, 0.71), "generalist-baseline");
  assert.equal(labComparisonWinner(0.68, 0.71), "generalist-baseline");
  assert.equal(labComparisonWinner(Number.NaN, 0.71), null);
  assert.equal(labComparisonWinner(0.87, Number.NaN), null);
});

test("constructLabPromotionRecord builds the immutable decision record", () => {
  const record = constructLabPromotionRecord(
    {
      experimentId: "you_lab-experiment_0000000000000001",
      winnerArm: "searched",
      objectiveScore: 0.87,
      baselineScore: 0.71,
      evidenceManifestRef: "you_lab-evidence-manifest_0000000000000001",
    },
    DEPS,
  );
  assert.equal(record.id, "you_lab-promotion_0000000000000001");
  assert.equal(record.experimentId, "you_lab-experiment_0000000000000001");
  assert.equal(record.winnerArm, "searched");
  assert.equal(record.objectiveScore, 0.87);
  assert.equal(record.baselineScore, 0.71);
  assert.equal(record.evidenceManifestRef, "you_lab-evidence-manifest_0000000000000001");
  assert.equal(record.decidedAt, "2026-01-01T00:00:09.000Z");
  assert.equal(record.simulated, true);
  assert.ok(Object.isFrozen(record));
});

test("the record validator refuses malformed intake (never throws)", () => {
  const valid = {
    experimentId: "you_lab-experiment_0000000000000001",
    winnerArm: "searched" as const,
    objectiveScore: 0.87,
    baselineScore: 0.71,
    evidenceManifestRef: "you_lab-evidence-manifest_0000000000000001",
  };
  const cases: readonly [unknown, string][] = [
    [{ ...valid, experimentId: "" }, "experiment-id-empty"],
    [{ ...valid, winnerArm: "tuned" }, "winner-arm-invalid"],
    [{ ...valid, objectiveScore: Number.NaN }, "scores-invalid"],
    [{ ...valid, baselineScore: Number.POSITIVE_INFINITY }, "scores-invalid"],
    [{ ...valid, evidenceManifestRef: "" }, "evidence-manifest-ref-empty"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabPromotionRecordInput(input as typeof valid);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(
    () => constructLabPromotionRecord({ ...valid, evidenceManifestRef: "" }, DEPS),
    /evidence-manifest-ref-empty/,
  );
});
