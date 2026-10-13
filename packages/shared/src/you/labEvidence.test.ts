import assert from "node:assert/strict";
import test from "node:test";
import type { LabEvidenceManifest } from "./contract.js";
import { sha256Hex } from "./evidenceStore.js";
import {
  constructLabEvidenceManifest,
  isSha256Hex,
  labManifestContentHash,
  validateLabArtifacts,
  verifyLabEvidenceManifest,
  type LabArtifactBinding,
} from "./labEvidence.js";
import { stableStringify } from "./serialize.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:01.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

const RUN_ID = "you_lab-run_0000000000000001";

function binding(ref: string): LabArtifactBinding {
  return { contentRef: ref, contentHash: sha256Hex(new TextEncoder().encode(`artifact-${ref}`)) };
}

const ARTIFACTS: readonly LabArtifactBinding[] = [binding("you_lab-artifact_0000000000000001"), binding("you_lab-artifact_0000000000000002")];

test("the manifest content address is deterministic and binds run + ordered artifacts", () => {
  const first = labManifestContentHash(RUN_ID, ARTIFACTS);
  const second = labManifestContentHash(RUN_ID, [...ARTIFACTS]);
  assert.equal(first, second);
  assert.ok(isSha256Hex(first));
  // The address is the sha-256 over the canonical bundle serialization.
  assert.equal(
    first,
    sha256Hex(
      new TextEncoder().encode(
        stableStringify({
          runId: RUN_ID,
          artifacts: ARTIFACTS.map((artifact) => ({ contentRef: artifact.contentRef, contentHash: artifact.contentHash })),
        }),
      ),
    ),
  );
  // Different run => different address (the bundle is bound to its run).
  assert.notEqual(first, labManifestContentHash("you_lab-run_0000000000000002", ARTIFACTS));
  // Different artifact order => different address (order is load-bearing).
  assert.notEqual(first, labManifestContentHash(RUN_ID, [...ARTIFACTS].reverse()));
  // Different artifacts => different address.
  assert.notEqual(first, labManifestContentHash(RUN_ID, [binding("you_lab-artifact_0000000000000003")]));
});

test("constructLabEvidenceManifest builds the immutable simulated record with a derived address", () => {
  const manifest: LabEvidenceManifest = constructLabEvidenceManifest({ runId: RUN_ID, artifacts: ARTIFACTS }, DEPS);
  assert.equal(manifest.runId, RUN_ID);
  assert.equal(manifest.contentHash, labManifestContentHash(RUN_ID, ARTIFACTS));
  assert.deepEqual(manifest.artifactRefs, ARTIFACTS.map((artifact) => artifact.contentRef));
  assert.equal(manifest.publishedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(manifest.simulated, true);
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.artifactRefs));
});

test("malformed manifest intake refuses (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [[], "artifacts-empty"],
    [[{ contentRef: "", contentHash: ARTIFACTS[0]?.contentHash ?? "" }], "artifact-ref-empty"],
    [[{ contentRef: "you_lab-artifact_1", contentHash: "deadbeef" }], "artifact-hash-invalid"],
    [[{ contentRef: "you_lab-artifact_1", contentHash: "XYZ" }], "artifact-hash-invalid"],
    [[binding("you_lab-artifact_1"), binding("you_lab-artifact_1")], "artifact-ref-duplicate"],
  ];
  for (const [artifacts, reason] of cases) {
    const refusal = validateLabArtifacts(artifacts as readonly LabArtifactBinding[]);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(() => constructLabEvidenceManifest({ runId: RUN_ID, artifacts: [] }, DEPS), /artifacts-empty/);
  assert.throws(
    () => constructLabEvidenceManifest({ runId: "", artifacts: ARTIFACTS }, DEPS),
    /run-id-empty/,
  );
});

test("verification passes exactly when the recomputed address matches", () => {
  const manifest = constructLabEvidenceManifest({ runId: RUN_ID, artifacts: ARTIFACTS }, DEPS);
  const verified = verifyLabEvidenceManifest(manifest, ARTIFACTS);
  assert.deepEqual(verified, { verified: true, contentHash: manifest.contentHash });
});

test("verification fails closed on every mismatch path", () => {
  const manifest = constructLabEvidenceManifest({ runId: RUN_ID, artifacts: ARTIFACTS }, DEPS);
  // Count mismatch.
  assert.deepEqual(verifyLabEvidenceManifest(manifest, ARTIFACTS.slice(0, 1)), { verified: false, reason: "artifact-count-mismatch" });
  // Positional ref mismatch (swapped artifacts).
  assert.deepEqual(verifyLabEvidenceManifest(manifest, [...ARTIFACTS].reverse()), {
    verified: false,
    reason: "artifact-ref-mismatch",
  });
  // A tampered binding hash (sha-256 shape kept, value changed).
  const tamperedHash: readonly LabArtifactBinding[] = [
    { contentRef: ARTIFACTS[0]?.contentRef ?? "", contentHash: sha256Hex(new TextEncoder().encode("tampered")) },
    ARTIFACTS[1] ?? { contentRef: "", contentHash: "" },
  ];
  assert.deepEqual(verifyLabEvidenceManifest(manifest, tamperedHash), { verified: false, reason: "content-hash-mismatch" });
  // A manifest whose recorded contentHash lies about its own bundle.
  const lyingManifest: LabEvidenceManifest = { ...manifest, contentHash: sha256Hex(new TextEncoder().encode("lie")) };
  assert.deepEqual(verifyLabEvidenceManifest(lyingManifest, ARTIFACTS), { verified: false, reason: "content-hash-mismatch" });
  // A manifest re-bound to a different run (address binds runId).
  const otherRunManifest: LabEvidenceManifest = { ...manifest, runId: "you_lab-run_0000000000000002" };
  assert.deepEqual(verifyLabEvidenceManifest(otherRunManifest, ARTIFACTS), { verified: false, reason: "content-hash-mismatch" });
  // A malformed binding hash refuses during verification too.
  const malformedBindings: readonly LabArtifactBinding[] = [
    { contentRef: ARTIFACTS[0]?.contentRef ?? "", contentHash: "not-a-hash" },
    ARTIFACTS[1] ?? { contentRef: "", contentHash: "" },
  ];
  assert.deepEqual(verifyLabEvidenceManifest(manifest, malformedBindings), { verified: false, reason: "artifact-hash-invalid" });
});
