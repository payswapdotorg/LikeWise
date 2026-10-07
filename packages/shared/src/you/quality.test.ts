import assert from "node:assert/strict";
import test from "node:test";
import {
  applyQualityDelta,
  clampQualityScore,
  computeQualityDeltas,
  deficiencyClassForCategory,
  DETERMINISTIC_IMPROVEMENT_BASE_DELTA,
  FEEDBACK_CATEGORY_TO_DEFICIENCY,
  proposeImprovementOperations,
  roundQualityScore,
} from "./quality.js";
import type { FeedbackCategory } from "./contract.js";

test("roundQualityScore keeps 4 decimal places", () => {
  assert.equal(roundQualityScore(0.123456), 0.1235);
  assert.equal(roundQualityScore(0.5800000000000001), 0.58);
  assert.equal(roundQualityScore(1), 1);
});

test("clampQualityScore bounds to [0, 1]", () => {
  assert.equal(clampQualityScore(-0.5), 0);
  assert.equal(clampQualityScore(1.5), 1);
  assert.equal(clampQualityScore(0.42), 0.42);
});

test("applyQualityDelta returns a new map with the exact clamped result", () => {
  const before = { geometry: 0.42, identity: 0.9 };
  const after = applyQualityDelta(before, "geometry", 0.15);
  assert.equal(after.geometry, 0.57);
  assert.equal(after.identity, 0.9);
  assert.deepEqual(before, { geometry: 0.42, identity: 0.9 });
  assert.equal(after.newClass, undefined);
  const ceiling = applyQualityDelta(after, "geometry", 0.5);
  assert.equal(ceiling.geometry, 1);
  assert.equal(applyQualityDelta({ x: 0.2 }, "x", -0.5).x, 0);
  assert.throws(() => applyQualityDelta({}, "x", Number.NaN));
});

test("computeQualityDeltas reports exact before/after differences", () => {
  const before = { geometry: 0.42, identity: 0.9 };
  const after = { geometry: 0.57, identity: 0.9, appearance: 0.1 };
  assert.deepEqual(computeQualityDeltas(before, after), { appearance: 0.1, geometry: 0.15, identity: 0 });
  assert.deepEqual(computeQualityDeltas(after, before), { appearance: -0.1, geometry: -0.15, identity: 0 });
});

test("every feedback category maps to exactly one deficiency class", () => {
  const categories: FeedbackCategory[] = [
    "identity_mismatch",
    "motion_naturalness",
    "geometry",
    "appearance",
    "style",
    "composition",
    "behavior",
    "usability",
    "other",
  ];
  assert.equal(categories.length, Object.keys(FEEDBACK_CATEGORY_TO_DEFICIENCY).length);
  for (const category of categories) {
    const deficiency = deficiencyClassForCategory(category);
    assert.ok(deficiency.length > 0, `${category} must map to a deficiency class`);
  }
  assert.equal(deficiencyClassForCategory("geometry"), "geometry");
  assert.equal(deficiencyClassForCategory("style"), "appearance");
});

test("proposeImprovementOperations produces the exact base delta", () => {
  const operations = proposeImprovementOperations({ geometry: 0.42 }, "geometry");
  assert.deepEqual(operations, [{ op: "adjust_quality", deficiencyClass: "geometry", delta: 0.15 }]);
  assert.equal(DETERMINISTIC_IMPROVEMENT_BASE_DELTA, 0.15);
});

test("proposeImprovementOperations is empty at the quality ceiling", () => {
  assert.deepEqual(proposeImprovementOperations({ geometry: 1 }, "geometry"), []);
  assert.deepEqual(proposeImprovementOperations({ geometry: 1 }, "geometry", { magnitude: 0.02 }), []);
});

test("proposeImprovementOperations clamps the delta at the ceiling", () => {
  const operations = proposeImprovementOperations({ geometry: 0.95 }, "geometry");
  assert.deepEqual(operations, [{ op: "adjust_quality", deficiencyClass: "geometry", delta: 0.05 }]);
});

test("proposeImprovementOperations scales with evidence weight and validates it", () => {
  const operations = proposeImprovementOperations({ geometry: 0.4 }, "geometry", { evidenceWeight: 0.5 });
  assert.deepEqual(operations, [{ op: "adjust_quality", deficiencyClass: "geometry", delta: 0.075 }]);
  assert.throws(() => proposeImprovementOperations({}, "x", { evidenceWeight: 0 }));
  assert.throws(() => proposeImprovementOperations({}, "x", { evidenceWeight: 1.5 }));
});

test("deterministic improvement delta is measurable before/after (exact numbers)", () => {
  const quality = { geometry: 0.5249 };
  const [operation] = proposeImprovementOperations(quality, "geometry");
  assert.ok(operation !== undefined && operation.op === "adjust_quality");
  const improved = applyQualityDelta(quality, "geometry", operation.op === "adjust_quality" ? operation.delta : 0);
  assert.equal(improved.geometry, 0.6749);
  assert.equal(computeQualityDeltas(quality, improved).geometry, 0.15);
});
