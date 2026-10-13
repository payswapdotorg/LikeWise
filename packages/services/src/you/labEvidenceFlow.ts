// YOU lab service — the LabEvidenceManifest flow (W9A): content-addressed
// evidence publication for terminal runs and fail-closed verification.
// The manifest is the durability unit (LAB PERSISTENCE LAW): artifact
// bytes are stored through the wave-2 content-store abstraction (opaque
// ref + sha-256 binding, bytes never inlined), the bundle contentHash
// binds the ORDERED artifact digests, and the run head's
// evidenceManifestRef walks through an immutable replacement (never a
// mutation — the W7A/W8A replacement precedent). One manifest per run:
// a second publication for the same run refuses.
//
// Publication gate (frozen W9A): evidence publishes ONLY onto a
// terminal run (succeeded | failed | retired) — a run that has not
// finished has no evidence bundle to publish. Verification recomputes
// the bundle hash from the RESOLVED bytes and fails closed on any
// mismatch (typed YOU_LAB_EVIDENCE_MANIFEST_INVALID).

import type { LabEvidenceManifest, OpaqueId } from "@zcode/shared";
import { sha256Hex } from "../../../shared/src/you/evidenceStore.js";
import {
  constructLabEvidenceManifest,
  verifyLabEvidenceManifest,
} from "../../../shared/src/you/labEvidenceManifest.js";
import { bindLabRunEvidenceManifest, isLabRunTerminal } from "../../../shared/src/you/labRunLadder.js";
import { appendLabEvidencePublished } from "./labLedgerOps.js";
import {
  labFailure,
  requireLabManifest,
  requireLabRun,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/**
 * Publishes the content-addressed evidence manifest for a terminal run.
 * Emits lab-evidence-published. Refusals: typed YOU_LAB_RUN_NOT_FOUND
 * for unknown runs; typed YOU_LAB_EVIDENCE_MANIFEST_INVALID for the
 * publication gates (run not terminal, run already carries a manifest)
 * and malformed artifact intake.
 */
export function publishLabEvidenceOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  runId: OpaqueId,
  input: { readonly artifacts: readonly Uint8Array[] },
): LabServiceResult<{ readonly manifest: LabEvidenceManifest }> {
  const found = requireLabRun(plane, runId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const run = found.run;
  if (!isLabRunTerminal(run.status)) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `evidence publishes only onto a terminal run (run is "${run.status}")`, {
      reason: "run-not-terminal",
      runId,
      status: run.status,
    });
  }
  if (run.evidenceManifestRef !== null) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "run already carries an evidence manifest (one manifest per run)", {
      reason: "run-already-carries-manifest",
      runId,
      evidenceManifestRef: run.evidenceManifestRef,
    });
  }
  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "an evidence manifest requires at least one artifact", {
      reason: "artifacts-empty",
      runId,
    });
  }
  for (const artifact of input.artifacts) {
    if (!(artifact instanceof Uint8Array) || artifact.byteLength === 0) {
      return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "every artifact must be non-empty bytes", {
        reason: "artifact-empty",
        runId,
      });
    }
  }
  // Content addressing: the artifact digests are computed independently
  // of the store's reported bindings, so construction and verification
  // share one hash authority (sha-256 over the artifact bytes).
  const artifacts = input.artifacts.map((artifact) => ({
    contentRef: deps.store.put(artifact).contentRef,
    contentHash: sha256Hex(artifact),
  }));
  const manifest = constructLabEvidenceManifest(
    { runId, artifacts },
    { now: () => deps.clock.now(), nextId: deps.ids.next },
  );
  const boundRun = bindLabRunEvidenceManifest(run, manifest.id);
  plane.runs.set(runId, boundRun);
  plane.manifests.set(manifest.id, manifest);
  plane.manifestsByRun.set(runId, manifest.id);
  // The evidence linkage rides lab-evidence-published (the W1A/W8A
  // ride-along fold: the referenced run head's evidenceManifestRef walks
  // in the fold — the run record itself is not re-emitted).
  appendLabEvidencePublished(plane, manifest, run.experimentId);
  return { ok: true, value: { manifest } };
}

/**
 * Verifies a published manifest: resolves every artifact ref through the
 * content store, recomputes the bundle hash from the resolved bytes and
 * compares. Fails closed with typed YOU_LAB_EVIDENCE_MANIFEST_INVALID
 * (unknown manifest, unresolvable ref, hash mismatch).
 */
export function verifyLabEvidenceOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  manifestId: OpaqueId,
): LabServiceResult<{ readonly verified: true; readonly manifest: LabEvidenceManifest }> {
  const found = requireLabManifest(plane, manifestId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const verification = verifyLabEvidenceManifest(found.manifest, (contentRef) => deps.store.get(contentRef));
  if (!verification.ok) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `evidence manifest verification failed: ${verification.refusal.detail}`, {
      reason: verification.refusal.reason,
      manifestId,
    });
  }
  return { ok: true, value: { verified: true, manifest: found.manifest } };
}
