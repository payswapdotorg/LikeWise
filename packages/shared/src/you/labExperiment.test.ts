import assert from "node:assert/strict";
import test from "node:test";
import type { LabExperiment } from "./contract.js";
import { LAB_ARM_KINDS, canonicalLabArmOrder, isLabArmKind } from "./labArms.js";
import {
  attachLabExperimentPromotion,
  constructLabExperiment,
  validateLabExperimentInput,
  type LabExperimentInput,
} from "./labExperiment.js";

const DEPS = {
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

const INPUT = {
  intentRef: "you_intent_0000000000000001",
  constraintsHash: "constraints-hash-01",
  objective: "minimize-total-cost-under-quality-threshold",
  arms: [...LAB_ARM_KINDS],
};

test("the three LAB.md comparison arms are frozen in canonical order", () => {
  assert.deepEqual(LAB_ARM_KINDS, ["generalist-baseline", "hand-designed", "searched"]);
  assert.ok(isLabArmKind("searched"));
  assert.ok(!isLabArmKind("ensharded"));
  assert.ok(!isLabArmKind(null));
});

test("constructLabExperiment records the immutable declaration in canonical arm order", () => {
  const shuffledInput: LabExperimentInput = { ...INPUT, arms: ["searched", "generalist-baseline", "hand-designed"] };
  const experiment: LabExperiment = constructLabExperiment(shuffledInput, DEPS);
  assert.equal(experiment.intentRef, "you_intent_0000000000000001");
  assert.equal(experiment.constraintsHash, "constraints-hash-01");
  assert.equal(experiment.objective, "minimize-total-cost-under-quality-threshold");
  assert.deepEqual(experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(experiment.promotionRef, null);
  assert.equal(experiment.simulated, true);
  assert.ok(Object.isFrozen(experiment));
  assert.ok(Object.isFrozen(experiment.arms));
});

test("canonicalLabArmOrder sorts into the frozen comparison order", () => {
  assert.deepEqual(canonicalLabArmOrder(["searched", "hand-designed", "generalist-baseline"]), [
    "generalist-baseline",
    "hand-designed",
    "searched",
  ]);
});

test("the three-arm law refuses wrong arm sets (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [{ ...INPUT, arms: ["generalist-baseline", "hand-designed"] }, "arms-count"],
    [
      { ...INPUT, arms: ["generalist-baseline", "hand-designed", "searched", "searched"] },
      "arms-count",
    ],
    [{ ...INPUT, arms: ["generalist-baseline", "hand-designed", "hand-designed"] }, "arms-duplicate"],
    [{ ...INPUT, arms: ["generalist-baseline", "hand-designed", "ensharded"] }, "arms-missing"],
    [{ ...INPUT, arms: [] }, "arms-count"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabExperimentInput(input as typeof INPUT);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
});

test("declaration shape refusals are stable strings", () => {
  assert.equal(validateLabExperimentInput({ ...INPUT, intentRef: "" })?.reason, "intent-ref-empty");
  assert.equal(validateLabExperimentInput({ ...INPUT, constraintsHash: "  " })?.reason, "constraints-hash-empty");
  assert.equal(validateLabExperimentInput({ ...INPUT, objective: "" })?.reason, "objective-empty");
  assert.throws(
    () => constructLabExperiment({ ...INPUT, arms: ["generalist-baseline"] }, DEPS),
    /arms-count/,
  );
});

test("attachLabExperimentPromotion moves the head linkage immutably", () => {
  const experiment = constructLabExperiment(INPUT, DEPS);
  const promoted = attachLabExperimentPromotion(experiment, "you_lab-promotion_0000000000000001");
  assert.equal(promoted.promotionRef, "you_lab-promotion_0000000000000001");
  // The declaration facts are untouched; the original record is untouched.
  assert.deepEqual(promoted.arms, experiment.arms);
  assert.equal(experiment.promotionRef, null);
  assert.ok(Object.isFrozen(promoted));
  // The reversal moves the linkage the same way (a new record, never a mutation).
  const reversed = attachLabExperimentPromotion(promoted, "you_lab-promotion_0000000000000002");
  assert.equal(reversed.promotionRef, "you_lab-promotion_0000000000000002");
  assert.equal(promoted.promotionRef, "you_lab-promotion_0000000000000001");
  assert.throws(() => attachLabExperimentPromotion(experiment, ""), /non-empty promotion ref/);
});
