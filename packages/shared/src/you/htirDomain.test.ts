import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { HtirDomainBlock, HtirDomainKind } from "./contract.js";
import {
  createHtirDomainBlock,
  domainsOfBlocks,
  fixtureDomainConfidence,
  fixtureHtirDomainByteLength,
  isKnownHtirDomain,
  synthesizeHtirDomainBytes,
  validateHtirDomainBlocks,
  validateHtirDomainKind,
  FIXTURE_HTIR_DOMAIN_BYTE_LENGTHS,
} from "./htirDomain.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { sha256Hex, createFixtureEvidenceContentStore } from "./evidenceStore.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0001)),
    store: createFixtureEvidenceContentStore(),
  };
}

test("domain validation accepts known domains and legal extensions, rejects malformed kinds", () => {
  assert.equal(validateHtirDomainKind("geometry-skeleton"), null);
  assert.equal(validateHtirDomainKind("custom-extension-v2"), null);
  assert.notEqual(validateHtirDomainKind(""), null);
  assert.notEqual(validateHtirDomainKind("  "), null);
  assert.notEqual(validateHtirDomainKind(" padded "), null);
  assert.equal(isKnownHtirDomain("voice"), true);
  assert.equal(isKnownHtirDomain("custom-extension-v2"), false);
});

test("fixture domain byte lengths follow the frozen table with a default for extensions", () => {
  assert.equal(fixtureHtirDomainByteLength("identity-binding"), 256);
  assert.equal(fixtureHtirDomainByteLength("neural-appearance"), 4096);
  assert.equal(fixtureHtirDomainByteLength("custom-extension-v2"), 512);
  assert.equal(Object.keys(FIXTURE_HTIR_DOMAIN_BYTE_LENGTHS).length, 11);
});

test("domain byte synthesis is deterministic and domain-sensitive", () => {
  const first = synthesizeHtirDomainBytes(createDeterministicRng(42), "geometry-skeleton");
  const second = synthesizeHtirDomainBytes(createDeterministicRng(42), "geometry-skeleton");
  const other = synthesizeHtirDomainBytes(createDeterministicRng(42), "face-hands");
  assert.deepEqual([...first], [...second]);
  assert.equal(first.byteLength, 2048);
  // Domain sensitivity flows through the frozen per-domain length table.
  assert.equal(other.byteLength, 1536);
  assert.notEqual(first.byteLength, other.byteLength);
  assert.notEqual([...first].length, [...other].length);
  const extension = synthesizeHtirDomainBytes(createDeterministicRng(42), "custom-extension");
  assert.equal(extension.byteLength, 512);
});

test("fixture domain confidence is deterministic, in [0.5, 1) and hash/domain keyed", () => {
  const hash = sha256Hex(new TextEncoder().encode("confidence-fixture"));
  const first = fixtureDomainConfidence(hash, "face-hands");
  const second = fixtureDomainConfidence(hash, "face-hands");
  const otherDomain = fixtureDomainConfidence(hash, "hair");
  assert.equal(first, second);
  assert.notEqual(first, otherDomain);
  assert.ok(first >= 0.5 && first < 1);
  // 4-decimal fixture precision.
  assert.equal(first, Math.round(first * 10000) / 10000);
});

test("createHtirDomainBlock is content-addressed: contentRef + sha-256 hash bind the stored bytes", () => {
  const deps = makeDeps();
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const block = createHtirDomainBlock(
    { domain: "morphology", bytes, provenanceSource: "test:morphology", simulated: true },
    deps,
  );
  assert.match(block.id, /^you_htir-block_[0-9a-f]{16}$/);
  assert.equal(block.domain, "morphology");
  assert.equal(block.contentHash, sha256Hex(bytes));
  assert.ok(deps.store.has(block.contentRef));
  assert.deepEqual([...(deps.store.get(block.contentRef) ?? new Uint8Array())], [...bytes]);
  assert.equal(block.simulated, true);
  assert.equal(block.provenance.generator, "fixture");
  assert.deepEqual([...block.provenance.lineage], []);
  // Same bytes => same content-addressed ref (idempotent addressing).
  const again = createHtirDomainBlock({ domain: "morphology", bytes, provenanceSource: "test:again", simulated: true }, makeDeps());
  assert.equal(again.contentRef, block.contentRef);
});

test("createHtirDomainBlock derives fixture confidence from the content hash when omitted", () => {
  const deps = makeDeps();
  const block = createHtirDomainBlock(
    { domain: "style", rng: createDeterministicRng(7), provenanceSource: "test:style", simulated: true },
    deps,
  );
  assert.equal(block.confidence, fixtureDomainConfidence(block.contentHash, "style"));
});

test("createHtirDomainBlock validates domain, confidence and byte sources", () => {
  const deps = makeDeps();
  assert.throws(() => createHtirDomainBlock({ domain: " ", bytes: new Uint8Array([1]), provenanceSource: "t", simulated: true }, deps));
  assert.throws(() =>
    createHtirDomainBlock({ domain: "style", bytes: new Uint8Array([1]), confidence: 1.5, provenanceSource: "t", simulated: true }, deps),
  );
  assert.throws(() => createHtirDomainBlock({ domain: "style", provenanceSource: "t", simulated: true }, deps));
});

test("published blocks are deep-frozen; in-place mutation throws", () => {
  const deps = makeDeps();
  const block = createHtirDomainBlock(
    { domain: "hair", bytes: new Uint8Array([9]), provenanceSource: "test:hair", simulated: true },
    deps,
  );
  assert.ok(Object.isFrozen(block));
  assert.ok(Object.isFrozen(block.provenance));
  assert.throws(() => {
    (block as unknown as { confidence: number }).confidence = 0.1;
  });
});

test("validateHtirDomainBlocks rejects duplicates and invalid confidences, accepts legal lists", () => {
  const deps = makeDeps();
  const a = createHtirDomainBlock({ domain: "geometry-skeleton", bytes: new Uint8Array([1]), provenanceSource: "t", simulated: true }, deps);
  const b = createHtirDomainBlock({ domain: "geometry-skeleton", bytes: new Uint8Array([2]), provenanceSource: "t", simulated: true }, deps);
  const c = createHtirDomainBlock({ domain: "voice", bytes: new Uint8Array([3]), provenanceSource: "t", simulated: true }, deps);
  assert.equal(validateHtirDomainBlocks([a, c]), null);
  assert.match(validateHtirDomainBlocks([a, b]) ?? "", /duplicate domain/);
  const broken = { ...a, confidence: 2 } as HtirDomainBlock;
  assert.match(validateHtirDomainBlocks([broken]) ?? "", /confidence/);
});

test("domainsOfBlocks returns sorted unique domains", () => {
  const deps = makeDeps();
  const blocks: HtirDomainBlock[] = [
    createHtirDomainBlock({ domain: "style", bytes: new Uint8Array([1]), provenanceSource: "t", simulated: true }, deps),
    createHtirDomainBlock({ domain: "morphology", bytes: new Uint8Array([2]), provenanceSource: "t", simulated: true }, deps),
    createHtirDomainBlock({ domain: "style", bytes: new Uint8Array([3]), provenanceSource: "t", simulated: true }, deps),
  ];
  assert.deepEqual(domainsOfBlocks(blocks), ["morphology", "style"] satisfies HtirDomainKind[]);
});
