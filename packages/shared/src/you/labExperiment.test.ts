import assert from "node:assert/strict";
import test from "node:test";
import {
  constructLabExperiment,
  isLabArmKind,
  LAB_ARM_KINDS,
  validateLabExperimentInput,
} from "./labExperiment.js";

const DEPS = {
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

const VALID_INPUT = {
  intentRef: "you_intent_0000000000000009",
  constraintsHash: "e7a1c3f9d2b40668",
  objective: "minimize-compute-cost-at-quality-threshold",
  arms: ["generalist-baseline", "hand-designed", "searched"] as const,
};

test("the three frozen comparison arms (the LAB.md law)", () => {
  assert.deepEqual(LAB_ARM_KINDS, ["generalist-baseline", "hand-designed", "searched"]);
  for (const arm of LAB_ARM_KINDS) {
    assert.ok(isLabArmKind(arm), arm);
  }
  assert.ok(!isLabArmKind("tuned"));
  assert.ok(!isLabArmKind(""));
  assert.ok(!isLabArmKind(7));
});

test("constructLabExperiment builds the immutable three-arm container", () => {
  const experiment = constructLabExperiment(VALID_INPUT, DEPS);
  assert.equal(experiment.id, "you_lab-experiment_0000000000000001");
  assert.equal(experiment.intentRef, "you_intent_0000000000000009");
  assert.equal(experiment.constraintsHash, "e7a1c3f9d2b40668");
  assert.equal(experiment.objective, "minimize-compute-cost-at-quality-threshold");
  assert.deepEqual(experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(experiment.promotionRef, null);
  assert.equal(experiment.simulated, true);
  assert.ok(Object.isFrozen(experiment));
  assert.ok(Object.isFrozen(experiment.arms));
});

test("declared arms canonicalize into the frozen order", () => {
  const shuffled = constructLabExperiment(
    { ...VALID_INPUT, arms: ["searched", "generalist-baseline", "hand-designed"] },
    DEPS,
  );
  assert.deepEqual(shuffled.arms, ["generalist-baseline", "hand-designed", "searched"]);
});

test("the three-arm law refuses every deviation (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [{ ...VALID_INPUT, arms: [] }, "arms-empty"],
    [{ ...VALID_INPUT, arms: ["generalist-baseline", "searched"] }, "arms-not-three-arm-law"],
    // A four-arm list must contain a duplicate — the per-arm duplicate
    // gate fires before the completeness check (fixed validator order).
    [
      { ...VALID_INPUT, arms: ["generalist-baseline", "hand-designed", "searched", "searched"] },
      "arms-duplicate",
    ],
    [{ ...VALID_INPUT, arms: ["generalist-baseline", "hand-designed", "tuned"] }, "arm-invalid"],
    [{ ...VALID_INPUT, arms: ["searched", "searched", "hand-designed"] }, "arms-duplicate"],
    [{ ...VALID_INPUT, intentRef: "" }, "intent-ref-empty"],
    [{ ...VALID_INPUT, constraintsHash: "" }, "constraints-hash-empty"],
    [{ ...VALID_INPUT, constraintsHash: "   " }, "constraints-hash-empty"],
    [{ ...VALID_INPUT, objective: "" }, "objective-empty"],
    [{ ...VALID_INPUT, objective: "  " }, "objective-empty"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabExperimentInput(input as typeof VALID_INPUT);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(
    () => constructLabExperiment({ ...VALID_INPUT, arms: ["generalist-baseline", "searched"] }, DEPS),
    /arms-not-three-arm-law/,
  );
});
