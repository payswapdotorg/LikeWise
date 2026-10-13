// YOU lab service — the LabEvidenceManifest flow (W9A):
// content-addressed evidence bundles. Publishing stores the artifact
// bytes through the content store (opaque refs + sha-256 bindings),
// derives the manifest's own content address (runId + ordered
// bindings), appends the manifest and re-points the run head's
// evidenceManifestRef through immutable replacement; verification
// recomputes EVERYTHING from the stored bytes and fails closed (a
// mismatch is a typed YOU_LAB_EVIDENCE_MANIFEST_INVALID refusal,
// never a silent pass).

import type { LabEvidenceManifest, LabRun, OpaqueId } from "@zcode/shared";
import type { LabArtifactBinding } from "../../../shared/src/you/labEvidence.js";
import {
  constructLabEvidenceManifest,
  verifyLabEvidenceManifest,
} from "../../../shared/src/you/labEvidence.js";
import { isLabRunTerminal, attachLabRunEvidence } from "../../../shared/src/you/labRunLadder.js";
import { sha256Hex } from "../../../shared/src/you/evidenceStore.js";
import { appendLabEvidencePublished } from "./labLedgerOps.js";
import {
  labFailure,
  requireLabRun,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/**
 * Publishes a content-addressed evidence manifest for a TERMINAL run.
 * The artifact bytes go through the content store (refs + sha-256
 * bindings); the manifest address is DERIVED, never accepted. Emits
 * lab-evidence-published; the run head's evidenceManifestRef moves
 * through immutable replacement (re-publishing appends a new manifest).
 * Refusals: typed YOU_LAB_RUN_NOT_FOUND for unknown runs; typed
 * YOU_LAB_EVIDENCE_MANIFEST_INVALID for non-terminal runs and empty
 * artifact bundles.
 */
export function publishLabEvidenceOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  runId: OpaqueId,
  artifacts: readonly Uint8Array[],
): LabServiceResult<{ readonly manifest: LabEvidenceManifest; readonly bindings: readonly LabArtifactBinding[]; readonly run: LabRun }> {
  const found = requireLabRun(plane, runId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const run = found.run;
  if (!isLabRunTerminal(run.status)) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `evidence may only be published for a terminal run (got "${run.status}")`, {
      reason: "run-not-terminal",
      runId,
      status: run.status,
    });
  }
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "an evidence manifest requires at least one artifact", {
      reason: "artifacts-empty",
      runId,
    });
  }
  const bindings: LabArtifactBinding[] = artifacts.map((bytes) => {
    const stored = deps.store.put(bytes);
    return { contentRef: stored.contentRef, contentHash: stored.contentHash };
  });
  const manifest = constructLabEvidenceManifest(
    { runId, artifacts: bindings },
    { now: () => deps.clock.now(), nextId: deps.ids.next },
  );
  plane.manifests.set(manifest.id, manifest);
  plane.manifestArtifacts.set(manifest.id, bindings);
  const manifestLadder = plane.manifestIdsByRun.get(runId) ?? [];
  manifestLadder.push(manifest.id);
  plane.manifestIdsByRun.set(runId, manifestLadder);
  // The run head's evidence linkage moves (immutable replacement).
  const rebind = attachLabRunEvidence(run, manifest.id);
  plane.runs.set(runId, rebind);
  appendLabEvidencePublished(plane, manifest, bindings);
  return { ok: true, value: { manifest, bindings, run: rebind } };
}

/**
 * Verifies a manifest against its recorded bindings AND the stored
 * bytes (deep verification): every artifact ref must resolve, the
 * stored bytes must hash to the recorded sha-256, and the recomputed
 * bundle address must equal the recorded contentHash EXACTLY. Fails
 * closed with typed YOU_LAB_EVIDENCE_MANIFEST_INVALID on any
 * mismatch. Unknown manifests refuse the same way.
 */
export function verifyLabEvidenceManifestOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  manifestId: OpaqueId,
): LabServiceResult<{ readonly verified: true; readonly contentHash: string }> {
  const manifest = plane.manifests.get(manifestId);
  if (manifest === undefined) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "unknown lab evidence manifest", {
      reason: "unknown-manifest",
      manifestId,
    });
  }
  const bindings = plane.manifestArtifacts.get(manifestId) ?? [];
  // Level 1: the stored bytes must hash to the recorded bindings.
  for (const binding of bindings) {
    const bytes = deps.store.get(binding.contentRef);
    if (bytes === null) {
      return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `artifact content is missing for ref ${binding.contentRef}`, {
        reason: "artifact-content-missing",
        manifestId,
        contentRef: binding.contentRef,
      });
    }
    if (sha256Hex(bytes) !== binding.contentHash) {
      return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `artifact content hash mismatch for ref ${binding.contentRef}`, {
        reason: "artifact-hash-mismatch",
        manifestId,
        contentRef: binding.contentRef,
      });
    }
  }
  // Level 2: the recomputed bundle address must match the record.
  const verification = verifyLabEvidenceManifest(manifest, bindings);
  if (!verification.verified) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `evidence manifest verification failed: ${verification.reason}`, {
      reason: verification.reason,
      manifestId,
    });
  }
  return { ok: true, value: { verified: true, contentHash: verification.contentHash } };
}
