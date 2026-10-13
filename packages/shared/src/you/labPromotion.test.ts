import assert from "node:assert/strict";
import test from "node:test";
import type { LabPromotionRecord } from "./contract.js";
import {
  constructLabPromotionRecord,
  evaluateLabPromotionGate,
  validateLabPromotionRecordInput,
  type LabPromotionRecordInput,
} from "./labPromotion.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:01.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

const EXPERIMENT_ID = "you_lab-experiment_0000000000000001";
const MANIFEST_REF = "you_lab-evidence-manifest_0000000000000001";

function promoteInput(overrides: Partial<LabPromotionRecordInput> = {}): LabPromotionRecordInput {
  return {
    experimentId: EXPERIMENT_ID,
    kind: "promote",
    winnerArm: "searched",
    objectiveScore: 0.87,
    baselineScore: 0.62,
    evidenceManifestRef: MANIFEST_REF,
    ...overrides,
  };
}

test("the gate: a searched arm promotes only when it strictly beats the baseline", () => {
  assert.deepEqual(evaluateLabPromotionGate(promoteInput()), { allowed: true, reason: "searched-beats-baseline" });
  // Not beating (equal) refuses.
  assert.deepEqual(evaluateLabPromotionGate(promoteInput({ objectiveScore: 0.62 })), {
    allowed: false,
    reason: "searched-does-not-beat-baseline",
  });
  // Not beating (worse) refuses.
  assert.deepEqual(evaluateLabPromotionGate(promoteInput({ objectiveScore: 0.5 })), {
    allowed: false,
    reason: "searched-does-not-beat-baseline",
  });
  // Only the searched arm can head a promotion.
  assert.deepEqual(evaluateLabPromotionGate(promoteInput({ winnerArm: "generalist-baseline" })), {
    allowed: false,
    reason: "winner-not-searched",
  });
  assert.deepEqual(evaluateLabPromotionGate(promoteInput({ winnerArm: "hand-designed" })), {
    allowed: false,
    reason: "winner-not-searched",
  });
});

test("the gate: a reversal records the standing baseline and refuses while the search still beats", () => {
  const reverseInput = promoteInput({ kind: "reverse", winnerArm: "generalist-baseline", objectiveScore: 0.55 });
  assert.deepEqual(evaluateLabPromotionGate(reverseInput), { allowed: true, reason: "baseline-stands" });
  // Tied scores belong to the baseline (only strictly better promotes).
  assert.deepEqual(evaluateLabPromotionGate({ ...reverseInput, objectiveScore: 0.62 }), {
    allowed: true,
    reason: "baseline-stands",
  });
  // Reversing while the searched arm still beats refuses.
  assert.deepEqual(evaluateLabPromotionGate({ ...reverseInput, objectiveScore: 0.9 }), {
    allowed: false,
    reason: "searched-still-beats-baseline",
  });
  // Only the baseline can head a reversal.
  assert.deepEqual(evaluateLabPromotionGate({ ...reverseInput, winnerArm: "searched" }), {
    allowed: false,
    reason: "reversal-winner-not-baseline",
  });
  assert.deepEqual(evaluateLabPromotionGate({ ...reverseInput, winnerArm: "hand-designed" }), {
    allowed: false,
    reason: "reversal-winner-not-baseline",
  });
});

test("the gate refuses non-finite scores (deterministic check order)", () => {
  assert.deepEqual(evaluateLabPromotionGate(promoteInput({ objectiveScore: Number.NaN })), {
    allowed: false,
    reason: "objective-score-not-finite",
  });
  assert.deepEqual(evaluateLabPromotionGate(promoteInput({ baselineScore: Number.POSITIVE_INFINITY })), {
    allowed: false,
    reason: "baseline-score-not-finite",
  });
});

test("constructLabPromotionRecord builds the immutable simulated record (gate-checked)", () => {
  const record: LabPromotionRecord = constructLabPromotionRecord(promoteInput(), DEPS);
  assert.equal(record.experimentId, EXPERIMENT_ID);
  assert.equal(record.winnerArm, "searched");
  assert.equal(record.objectiveScore, 0.87);
  assert.equal(record.baselineScore, 0.62);
  assert.equal(record.evidenceManifestRef, MANIFEST_REF);
  assert.equal(record.decidedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(record.simulated, true);
  assert.ok(Object.isFrozen(record));
});

test("an illegal promotion can never materialize as a record (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [promoteInput({ objectiveScore: 0.5 }), "searched-does-not-beat-baseline"],
    [promoteInput({ winnerArm: "hand-designed" }), "winner-not-searched"],
    [promoteInput({ experimentId: "" }), "experiment-id-empty"],
    [promoteInput({ evidenceManifestRef: "" }), "evidence-ref-empty"],
    [promoteInput({ kind: "reverse", winnerArm: "generalist-baseline" }), "searched-still-beats-baseline"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabPromotionRecordInput(input as LabPromotionRecordInput);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(() => constructLabPromotionRecord(promoteInput({ objectiveScore: 0.5 }), DEPS), /searched-does-not-beat-baseline/);
});
