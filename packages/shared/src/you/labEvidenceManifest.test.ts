import assert from "node:assert/strict";
import test from "node:test";
import type { LabEvidenceManifest } from "./contract.js";
import { sha256Hex } from "./evidenceStore.js";
import {
  constructLabEvidenceManifest,
  labEvidenceBundleHash,
  validateLabEvidenceManifestInput,
  verifyLabEvidenceManifest,
} from "./labEvidenceManifest.js";
import { stableStringify } from "./serialize.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:01.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

const ARTIFACT_BYTES = [
  new TextEncoder().encode("lab-artifact-baseline-metrics"),
  new TextEncoder().encode("lab-artifact-organization-graph"),
  new TextEncoder().encode("lab-artifact-evaluator-transcript"),
];

function bindingsOf(bytes: readonly Uint8Array[]): { contentRef: string; contentHash: string }[] {
  return bytes.map((artifact) => {
    const contentHash = sha256Hex(artifact);
    return { contentRef: `you_content_${contentHash.slice(0, 16)}`, contentHash };
  });
}

test("the bundle hash is deterministic and order-sensitive", () => {
  const hashes = ARTIFACT_BYTES.map((bytes) => sha256Hex(bytes));
  const bundle = labEvidenceBundleHash(hashes);
  assert.equal(bundle, labEvidenceBundleHash([...hashes]));
  assert.match(bundle, /^[0-9a-f]{64}$/);
  // Reordered artifacts produce a different bundle (order is load-bearing).
  assert.notEqual(bundle, labEvidenceBundleHash([hashes[1] ?? "", hashes[0] ?? "", hashes[2] ?? ""]));
  // The bundle is a pure function of the digest list.
  assert.notEqual(bundle, labEvidenceBundleHash(hashes.slice(0, 2)));
});

test("constructLabEvidenceManifest builds the immutable content-addressed bundle", () => {
  const bindings = bindingsOf(ARTIFACT_BYTES);
  const manifest = constructLabEvidenceManifest(
    { runId: "you_lab-run_0000000000000001", artifacts: bindings },
    DEPS,
  );
  assert.equal(manifest.id, "you_lab-evidence-manifest_0000000000000001");
  assert.equal(manifest.runId, "you_lab-run_0000000000000001");
  assert.equal(manifest.contentHash, labEvidenceBundleHash(bindings.map((binding) => binding.contentHash)));
  assert.deepEqual(manifest.artifactRefs, bindings.map((binding) => binding.contentRef));
  assert.equal(manifest.publishedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(manifest.simulated, true);
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.artifactRefs));
  // Identical artifacts produce the identical manifest bytes (content addressing).
  const twin = constructLabEvidenceManifest({ runId: "you_lab-run_0000000000000001", artifacts: bindingsOf(ARTIFACT_BYTES) }, DEPS);
  assert.equal(stableStringify({ ...twin, id: manifest.id }), stableStringify(manifest));
});

test("the manifest validator refuses malformed bundles (never throws)", () => {
  const bindings = bindingsOf(ARTIFACT_BYTES);
  const cases: readonly [unknown, string][] = [
    [{ runId: "", artifacts: bindings }, "run-id-empty"],
    [{ runId: "you_lab-run_1", artifacts: [] }, "artifacts-empty"],
    [{ runId: "you_lab-run_1", artifacts: [{ contentRef: "", contentHash: bindings[0]?.contentHash ?? "" }] }, "artifact-ref-empty"],
    [{ runId: "you_lab-run_1", artifacts: [{ contentRef: "you_content_x", contentHash: "deadbeef" }] }, "artifact-hash-invalid"],
    [
      { runId: "you_lab-run_1", artifacts: [{ contentRef: "you_content_x", contentHash: "not-a-sha-256-digest-value" }] },
      "artifact-hash-invalid",
    ],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabEvidenceManifestInput(input as { runId: string; artifacts: { contentRef: string; contentHash: string }[] });
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(
    () => constructLabEvidenceManifest({ runId: "you_lab-run_1", artifacts: [] }, DEPS),
    /artifacts-empty/,
  );
});

test("verification passes when the resolved bytes match the bundle", () => {
  const bindings = bindingsOf(ARTIFACT_BYTES);
  const manifest = constructLabEvidenceManifest({ runId: "you_lab-run_0000000000000001", artifacts: bindings }, DEPS);
  const stored = new Map(bindings.map((binding, index) => [binding.contentRef, ARTIFACT_BYTES[index] ?? new Uint8Array()]));
  const outcome = verifyLabEvidenceManifest(manifest, (ref) => stored.get(ref) ?? null);
  assert.deepEqual(outcome, { ok: true });
});

test("verification fails closed on tampered bytes (hash mismatch)", () => {
  const bindings = bindingsOf(ARTIFACT_BYTES);
  const manifest = constructLabEvidenceManifest({ runId: "you_lab-run_0000000000000001", artifacts: bindings }, DEPS);
  const tampered = new Map(
    bindings.map((binding, index) => [
      binding.contentRef,
      index === 1
        ? new TextEncoder().encode("lab-artifact-organization-graph-TAMPERED")
        : ARTIFACT_BYTES[index] ?? new Uint8Array(),
    ]),
  );
  const outcome = verifyLabEvidenceManifest(manifest, (ref) => tampered.get(ref) ?? null);
  assert.ok(!outcome.ok);
  assert.equal(outcome.refusal.reason, "manifest-hash-mismatch");
});

test("verification fails closed on unresolvable artifact refs", () => {
  const bindings = bindingsOf(ARTIFACT_BYTES);
  const manifest = constructLabEvidenceManifest({ runId: "you_lab-run_0000000000000001", artifacts: bindings }, DEPS);
  const outcome = verifyLabEvidenceManifest(manifest, () => null);
  assert.ok(!outcome.ok);
  assert.equal(outcome.refusal.reason, "artifact-unresolvable");
});

test("a manifest carrying a wrong content hash fails verification (never trusts the label)", () => {
  const bindings = bindingsOf(ARTIFACT_BYTES);
  const honest = constructLabEvidenceManifest({ runId: "you_lab-run_0000000000000001", artifacts: bindings }, DEPS);
  const forged: LabEvidenceManifest = {
    ...honest,
    contentHash: labEvidenceBundleHash(bindingsOf([new TextEncoder().encode("other-bytes")]).map((b) => b.contentHash)),
  };
  const stored = new Map(bindings.map((binding, index) => [binding.contentRef, ARTIFACT_BYTES[index] ?? new Uint8Array()]));
  const outcome = verifyLabEvidenceManifest(forged, (ref) => stored.get(ref) ?? null);
  assert.ok(!outcome.ok);
  assert.equal(outcome.refusal.reason, "manifest-hash-mismatch");
});
