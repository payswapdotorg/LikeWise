import assert from "node:assert/strict";
import test from "node:test";
import {
  createFixtureEvidenceContentStore,
  fixtureModalityByteLength,
  sha256Hex,
  synthesizeFixtureEvidenceBytes,
} from "./evidenceStore.js";
import { createDeterministicRng } from "./rng.js";

// Golden sha-256 vectors (independent of this codebase — FIPS 180-4 test values).
const SHA256_OF_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SHA256_OF_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

test("sha256Hex matches golden FIPS 180-4 vectors", () => {
  assert.equal(sha256Hex(new Uint8Array([])), SHA256_OF_EMPTY);
  assert.equal(sha256Hex(new TextEncoder().encode("abc")), SHA256_OF_ABC);
});

test("fixture store is content-addressed: same bytes -> same ref, different bytes -> different ref", () => {
  const store = createFixtureEvidenceContentStore();
  const bytesA = new Uint8Array([1, 2, 3]);
  const bytesB = new Uint8Array([4, 5, 6]);
  const first = store.put(bytesA);
  const second = store.put(Uint8Array.from(bytesA));
  const third = store.put(bytesB);
  assert.equal(first.contentRef, second.contentRef);
  assert.equal(first.contentHash, second.contentHash);
  assert.notEqual(first.contentRef, third.contentRef);
  assert.match(first.contentRef, /^you_content_[0-9a-f]{16}$/);
  assert.equal(first.contentHash.length, 64);
  assert.equal(first.byteLength, 3);
  assert.equal(store.size, 2);
});

test("fixture store get returns defensive copies; stored bytes cannot be mutated through the copy", () => {
  const store = createFixtureEvidenceContentStore();
  const binding = store.put(new Uint8Array([9, 8, 7]));
  const copy = store.get(binding.contentRef);
  assert.ok(copy !== null);
  copy?.set([0, 0, 0], 0);
  const again = store.get(binding.contentRef);
  assert.deepEqual([...(again ?? [])], [9, 8, 7]);
  assert.equal(sha256Hex(again ?? new Uint8Array()), binding.contentHash);
});

test("fixture store delete removes content; has/get reflect removal", () => {
  const store = createFixtureEvidenceContentStore();
  const binding = store.put(new Uint8Array([1]));
  assert.equal(store.delete(binding.contentRef), true);
  assert.equal(store.has(binding.contentRef), false);
  assert.equal(store.get(binding.contentRef), null);
  assert.equal(store.delete(binding.contentRef), false);
});

test("synthetic evidence bytes are deterministic per seed and sized per modality", () => {
  const first = synthesizeFixtureEvidenceBytes(createDeterministicRng(7), "image");
  const second = synthesizeFixtureEvidenceBytes(createDeterministicRng(7), "image");
  const other = synthesizeFixtureEvidenceBytes(createDeterministicRng(8), "image");
  assert.equal(first.byteLength, 2048);
  assert.deepEqual([...first], [...second]);
  assert.notDeepEqual([...first], [...other]);
  assert.equal(fixtureModalityByteLength("video"), 4096);
  assert.equal(fixtureModalityByteLength("depth"), 1536);
  assert.equal(fixtureModalityByteLength("measurement"), 256);
  assert.equal(fixtureModalityByteLength("document"), 1024);
  assert.equal(fixtureModalityByteLength("audio"), 3072);
  assert.equal(fixtureModalityByteLength("custom-modality"), 512);
});

test("synthetic evidence bytes differ across modalities for the same seed", () => {
  const rng = createDeterministicRng(21);
  const image = synthesizeFixtureEvidenceBytes(rng, "image");
  const video = synthesizeFixtureEvidenceBytes(rng, "video");
  assert.equal(image.byteLength, 2048);
  assert.equal(video.byteLength, 4096);
  assert.notEqual(sha256Hex(image), sha256Hex(video));
});

test("identical rng sequences yield byte-identical stored content across two stores", () => {
  const run = (): { ref: string; hash: string; bytes: number[] } => {
    const store = createFixtureEvidenceContentStore();
    const rng = createDeterministicRng(1234);
    const binding = store.put(synthesizeFixtureEvidenceBytes(rng, "depth"));
    return { ref: binding.contentRef, hash: binding.contentHash, bytes: [...(store.get(binding.contentRef) ?? [])] };
  };
  const first = run();
  const second = run();
  assert.deepEqual(first, second);
});
