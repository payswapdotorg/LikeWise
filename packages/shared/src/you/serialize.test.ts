import assert from "node:assert/strict";
import test from "node:test";
import { deepFreeze, stableContentHash, stableEquals, stableStringify } from "./serialize.js";

test("stableStringify sorts object keys recursively", () => {
  const value = { b: 1, a: { d: 2, c: 3 } };
  assert.equal(stableStringify(value), '{"a":{"c":3,"d":2},"b":1}');
});

test("stableStringify keeps array order and skips undefined values", () => {
  assert.equal(stableStringify({ b: ["x", 1, true], a: undefined }), '{"b":["x",1,true]}');
  assert.equal(stableStringify([3, 1, 2]), "[3,1,2]");
  assert.equal(stableStringify(null), "null");
  assert.equal(stableStringify("s"), '"s"');
});

test("stableEquals compares structurally regardless of key order", () => {
  assert.ok(stableEquals({ x: 1, y: { b: 2, a: 3 } }, { y: { a: 3, b: 2 }, x: 1 }));
  assert.ok(!stableEquals({ x: 1 }, { x: 2 }));
});

test("stableContentHash is an 8-char hex digest of the canonical form", () => {
  assert.equal(stableContentHash({ a: 1, b: 2 }), stableContentHash({ b: 2, a: 1 }));
  assert.notEqual(stableContentHash({ a: 1 }), stableContentHash({ a: 2 }));
  assert.match(stableContentHash({ a: 1 }), /^[0-9a-f]{8}$/);
});

test("deepFreeze makes nested mutation throw (immutable by construction)", () => {
  const frozen = deepFreeze({ outer: { inner: [1, 2, { x: 1 }] }, list: [{ id: "a" }] });
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.outer));
  assert.ok(Object.isFrozen(frozen.outer.inner));
  assert.ok(Object.isFrozen(frozen.list));
  assert.throws(() => {
    (frozen.outer as unknown as { inner: number[] }).inner = [];
  }, TypeError);
  assert.throws(() => {
    (frozen.outer.inner[2] as unknown as { x: number }).x = 99;
  }, TypeError);
  assert.throws(() => {
    (frozen.list as unknown as Array<unknown>).push("nope");
  }, TypeError);
});

test("deepFreeze passes primitives through unchanged", () => {
  assert.equal(deepFreeze(5), 5);
  assert.equal(deepFreeze("text"), "text");
  assert.equal(deepFreeze(null), null);
});
