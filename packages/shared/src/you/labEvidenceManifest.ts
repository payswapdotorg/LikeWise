// YOU LabEvidenceManifest machinery (W9A — docs/you/CONTRACTS.md
// "Wave-9 contract freeze (v9)": "LabEvidenceManifest (content-addressed
// evidence bundle for a lab run)"; LAB PERSISTENCE LAW: "evidence
// manifests are content-addressed (artifact content hashes make runs
// replayable and auditable without trusting the storage layer)").
//
// The manifest is the durability unit: the bundle contentHash binds the
// ORDERED per-artifact sha-256 digests, and each artifact ref resolves
// through the wave-2 content-store abstraction (opaque ref + sha-256
// binding, bytes never inlined). Verification recomputes the bundle hash
// from the RESOLVED bytes — it never trusts the store's reported
// bindings — and fails closed on any mismatch or unresolvable ref. The
// service maps verification refusals to typed
// YOU_LAB_EVIDENCE_MANIFEST_INVALID.

import type { LabEvidenceManifest, OpaqueId } from "./contract.js";
import { sha256Hex } from "./evidenceStore.js";
import { deepFreeze } from "./serialize.js";

/** Shape of a sha-256 hex digest (64 lowercase hex chars). */
export const LAB_EVIDENCE_HASH_PATTERN = /^[0-9a-f]{64}$/;

/**
 * The deterministic bundle hash over the ordered artifact digests
 * (sha-256 over the newline-joined digest list — order is load-bearing:
 * reordered artifacts produce a different bundle hash).
 */
export function labEvidenceBundleHash(artifactHashes: readonly string[]): string {
  return sha256Hex(new TextEncoder().encode(artifactHashes.join("\n")));
}

/** One stored artifact binding (opaque ref + its sha-256 content hash). */
export interface LabEvidenceArtifactBinding {
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
}

/** Manifest intake (the bundle facts, artifacts in bundle order). */
export interface LabEvidenceManifestInput {
  readonly runId: OpaqueId;
  readonly artifacts: readonly LabEvidenceArtifactBinding[];
}

/** A refusal returned by the stateless manifest validator. */
export interface LabEvidenceManifestRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless manifest-intake validator: the run id must be a
 * non-empty opaque id; the artifact list must be non-empty; every
 * artifact ref must be non-empty and every artifact hash a sha-256 hex
 * digest.
 */
export function validateLabEvidenceManifestInput(input: LabEvidenceManifestInput): LabEvidenceManifestRefusal | null {
  if (typeof input.runId !== "string" || input.runId.length === 0) {
    return { reason: "run-id-empty", detail: "manifest runId must be a non-empty opaque id" };
  }
  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) {
    return { reason: "artifacts-empty", detail: "an evidence manifest requires at least one artifact" };
  }
  for (const artifact of input.artifacts) {
    if (typeof artifact?.contentRef !== "string" || artifact.contentRef.length === 0) {
      return { reason: "artifact-ref-empty", detail: "artifact contentRef must be a non-empty opaque id" };
    }
    if (typeof artifact?.contentHash !== "string" || !LAB_EVIDENCE_HASH_PATTERN.test(artifact.contentHash)) {
      return { reason: "artifact-hash-invalid", detail: "artifact contentHash must be a sha-256 hex digest" };
    }
  }
  return null;
}

/** Deps for manifest construction (injected clock + id factory only). */
export interface LabEvidenceManifestDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/**
 * Constructs the immutable, deep-frozen manifest. The bundle contentHash
 * is recomputed from the artifact digests (never copied from a caller
 * field), so a manifest can only ever carry the hash of exactly the
 * artifacts it lists.
 */
export function constructLabEvidenceManifest(
  input: LabEvidenceManifestInput,
  deps: LabEvidenceManifestDeps,
): LabEvidenceManifest {
  const refusal = validateLabEvidenceManifestInput(input);
  if (refusal !== null) {
    throw new Error(`constructLabEvidenceManifest refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.nextId("lab-evidence-manifest"),
    runId: input.runId,
    contentHash: labEvidenceBundleHash(input.artifacts.map((artifact) => artifact.contentHash)),
    artifactRefs: Object.freeze(input.artifacts.map((artifact) => artifact.contentRef)),
    publishedAt: deps.now(),
    simulated: true,
  });
}

/** A fail-closed verification refusal (stable reason strings). */
export interface LabEvidenceVerificationRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** The verification outcome: verified, or a fail-closed refusal. */
export type LabEvidenceVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly refusal: LabEvidenceVerificationRefusal };

/**
 * Verifies a manifest against the artifact bytes a resolver returns:
 * every artifact ref must resolve; every resolved artifact is hashed
 * independently (sha-256 — the store's reported bindings are never
 * trusted); the recomputed bundle hash must equal the manifest's
 * contentHash. Any deviation fails closed.
 */
export function verifyLabEvidenceManifest(
  manifest: LabEvidenceManifest,
  resolveArtifact: (contentRef: OpaqueId) => Uint8Array | null,
): LabEvidenceVerification {
  const artifactHashes: string[] = [];
  for (const contentRef of manifest.artifactRefs) {
    const bytes = resolveArtifact(contentRef);
    if (bytes === null || bytes === undefined) {
      return {
        ok: false,
        refusal: { reason: "artifact-unresolvable", detail: `artifact ref does not resolve: ${contentRef}` },
      };
    }
    artifactHashes.push(sha256Hex(bytes));
  }
  const recomputed = labEvidenceBundleHash(artifactHashes);
  if (recomputed !== manifest.contentHash) {
    return {
      ok: false,
      refusal: {
        reason: "manifest-hash-mismatch",
        detail: `recomputed bundle hash ${recomputed} does not match manifest contentHash ${manifest.contentHash}`,
      },
    };
  }
  return { ok: true };
}
