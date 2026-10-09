// Deterministic RNG tests (W2C).
import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicRng, seedToUint32, unitFrom } from "./deterministicRng.js";

test("rng: same seed produces the identical value sequence", () => {
  const a = createDeterministicRng("seed-alpha");
  const b = createDeterministicRng("seed-alpha");
  const sequenceA: number[] = [];
  const sequenceB: number[] = [];
  for (let i = 0; i < 100; i++) {
    sequenceA.push(a.next());
    sequenceB.push(b.next());
  }
  assert.deepEqual(sequenceA, sequenceB);
});

test("rng: different seeds produce different sequences", () => {
  const a = createDeterministicRng("seed-alpha");
  const b = createDeterministicRng("seed-beta");
  const sequenceA: number[] = [];
  const sequenceB: number[] = [];
  for (let i = 0; i < 100; i++) {
    sequenceA.push(a.next());
    sequenceB.push(b.next());
  }
  assert.notDeepEqual(sequenceA, sequenceB);
});

test("rng: values are uniform floats in [0, 1)", () => {
  const rng = createDeterministicRng("uniform-check");
  for (let i = 0; i < 1000; i++) {
    const value = rng.next();
    assert.ok(value >= 0 && value < 1, `value out of [0,1): ${value}`);
  }
});

test("rng: nextInt stays within the exclusive bound", () => {
  const rng = createDeterministicRng("int-check");
  for (let i = 0; i < 500; i++) {
    const value = rng.nextInt(7);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 7, `nextInt(7) out of range: ${value}`);
  }
});

test("rng: unitFrom is a pure function of its key parts", () => {
  const first = unitFrom("payload", "f-000", "b-000-001");
  const second = unitFrom("payload", "f-000", "b-000-001");
  assert.equal(first, second);
  assert.ok(first >= 0 && first < 1);
  // order of parts matters (join key differs)
  const flipped = unitFrom("b-000-001", "f-000", "payload");
  assert.notEqual(first, flipped);
});

test("rng: seedToUint32 is stable across calls and seeds", () => {
  assert.equal(seedToUint32("k1"), seedToUint32("k1"));
  assert.notEqual(seedToUint32("k1"), seedToUint32("k2"));
  assert.ok(Number.isInteger(seedToUint32("k1")));
});
