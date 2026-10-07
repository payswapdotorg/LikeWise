import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicRng, seedFromString, uint32ToHex8 } from "./rng.js";

test("same seed produces identical sequences", () => {
  const a = createDeterministicRng(0xc0ffee);
  const b = createDeterministicRng(0xc0ffee);
  const sequenceA = [a.nextUint32(), a.nextUint32(), a.nextUint32(), a.nextUint32(), a.nextUint32()];
  const sequenceB = [b.nextUint32(), b.nextUint32(), b.nextUint32(), b.nextUint32(), b.nextUint32()];
  assert.deepEqual(sequenceA, sequenceB);
});

test("different seeds produce different sequences", () => {
  const a = createDeterministicRng(1);
  const b = createDeterministicRng(2);
  const sequenceA = [a.nextUint32(), a.nextUint32(), a.nextUint32()];
  const sequenceB = [b.nextUint32(), b.nextUint32(), b.nextUint32()];
  assert.notDeepEqual(sequenceA, sequenceB);
});

test("nextUint32 stays in uint32 range and nextFloat stays in [0, 1)", () => {
  const rng = createDeterministicRng(42);
  for (let index = 0; index < 1000; index += 1) {
    const value = rng.nextUint32();
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value <= 0xffffffff);
    const float = rng.nextFloat();
    assert.ok(float >= 0 && float < 1);
  }
});

test("intInRange is inclusive and deterministic", () => {
  const rng = createDeterministicRng(7);
  for (let index = 0; index < 200; index += 1) {
    const value = rng.intInRange(2, 5);
    assert.ok(value >= 2 && value <= 5);
  }
  const first = createDeterministicRng(7);
  const second = createDeterministicRng(7);
  for (let index = 0; index < 50; index += 1) {
    first.intInRange(2, 5);
    second.intInRange(2, 5);
  }
  assert.equal(first.intInRange(0, 100), second.intInRange(0, 100));
  assert.throws(() => rng.intInRange(5, 2));
  assert.throws(() => rng.intInRange(0.5, 2));
});

test("pick is deterministic and rejects empty lists", () => {
  const a = createDeterministicRng(99);
  const b = createDeterministicRng(99);
  const items = ["alpha", "beta", "gamma"] as const;
  assert.equal(a.pick(items), b.pick(items));
  assert.throws(() => a.pick([]));
});

test("floatInRange stays within bounds", () => {
  const rng = createDeterministicRng(1234);
  for (let index = 0; index < 500; index += 1) {
    const value = rng.floatInRange(1.55, 1.9);
    assert.ok(value >= 1.55 && value < 1.9);
  }
});

test("seedFromString is stable and discriminating", () => {
  assert.equal(seedFromString("you-phase0"), seedFromString("you-phase0"));
  assert.notEqual(seedFromString("you-phase0"), seedFromString("you-phase1"));
  assert.ok(seedFromString("") === 0x811c9dc5);
});

test("uint32ToHex8 zero-pads to 8 hex chars", () => {
  assert.equal(uint32ToHex8(0), "00000000");
  assert.equal(uint32ToHex8(0xdeadbeef), "deadbeef");
  assert.equal(uint32ToHex8(1), "00000001");
});
