// YOU LabEvidenceManifest machinery (W9A — docs/you/CONTRACTS.md
// "Wave-9 contract freeze (v9)": "LabEvidenceManifest (content-addressed
// evidence bundle for a lab run. The manifest is the durability unit:
// artifact content hashes make runs replayable and auditable without
// trusting the storage layer)"; WORK_ORDERS.md W9A).
//
// Content addressing: every artifact is stored as opaque bytes behind a
// contentRef with its sha-256 contentHash (the W2A evidence-store
// abstraction); the manifest's own contentHash is the sha-256 over the
// canonical serialization of { runId, artifacts } — binding the bundle
// to its run and to the exact ordered artifact bindings. Verification
// recomputes the address and FAILS CLOSED on any mismatch (a tampered
// or malformed manifest is a typed YOU_LAB_EVIDENCE_MANIFEST_INVALID
// refusal at the service seam, never a silent pass).

import type { LabEvidenceManifest, OpaqueId } from "./contract.js";
import { sha256Hex } from "./evidenceStore.js";
import { deepFreeze, stableStringify } from "./serialize.js";

/** One artifact binding: the opaque store ref plus its sha-256 content hash. */
export interface LabArtifactBinding {
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
}

/** A refusal returned by the stateless manifest validators (never an exception). */
export interface LabEvidenceRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** Lowercase 64-char hex (sha-256 shape). */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** True when the value has the sha-256 hex shape. */
export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

/**
 * The stateless artifact-binding validator: at least one artifact, each
 * with a non-empty opaque ref, a sha-256-shaped content hash, and no
 * duplicate refs (a ref addresses exactly one artifact).
 */
export function validateLabArtifacts(artifacts: readonly LabArtifactBinding[]): LabEvidenceRefusal | null {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return { reason: "artifacts-empty", detail: "an evidence manifest requires at least one artifact binding" };
  }
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    if (typeof artifact?.contentRef !== "string" || artifact.contentRef.length === 0) {
      return { reason: "artifact-ref-empty", detail: "every artifact binding requires a non-empty opaque contentRef" };
    }
    if (!isSha256Hex(artifact.contentHash)) {
      return {
        reason: "artifact-hash-invalid",
        detail: `artifact contentHash must be a lowercase 64-char sha-256 hex (got "${String(artifact.contentHash)}")`,
      };
    }
    if (seen.has(artifact.contentRef)) {
      return { reason: "artifact-ref-duplicate", detail: `duplicate artifact contentRef "${artifact.contentRef}"` };
    }
    seen.add(artifact.contentRef);
  }
  return null;
}

/** Manifest intake (the run whose evidence this bundle addresses). */
export interface LabEvidenceManifestInput {
  readonly runId: OpaqueId;
  readonly artifacts: readonly LabArtifactBinding[];
}

/**
 * The content address of a bundle: sha-256 over the canonical JSON of
 * { runId, artifacts } (stable key order; artifact order is load-
 * bearing and preserved). Deterministic: same inputs => same address.
 */
export function labManifestContentHash(runId: OpaqueId, artifacts: readonly LabArtifactBinding[]): string {
  return sha256Hex(
    new TextEncoder().encode(
      stableStringify({ runId, artifacts: artifacts.map((artifact) => ({ contentRef: artifact.contentRef, contentHash: artifact.contentHash })) }),
    ),
  );
}

/** Deps for manifest construction (injected clock + id factory only). */
export interface LabEvidenceManifestDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/**
 * Constructs the immutable, deep-frozen evidence manifest: the
 * contentHash is COMPUTED from the run binding + ordered artifacts
 * (never accepted from the caller — the address is derived, so it can
 * always be re-derived for verification). Throws on malformed intake.
 */
export function constructLabEvidenceManifest(input: LabEvidenceManifestInput, deps: LabEvidenceManifestDeps): LabEvidenceManifest {
  if (typeof input.runId !== "string" || input.runId.length === 0) {
    throw new Error("constructLabEvidenceManifest refused intake: run-id-empty (runId must be a non-empty opaque id)");
  }
  const refusal = validateLabArtifacts(input.artifacts);
  if (refusal !== null) {
    throw new Error(`constructLabEvidenceManifest refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.nextId("lab-evidence-manifest"),
    runId: input.runId,
    contentHash: labManifestContentHash(input.runId, input.artifacts),
    artifactRefs: Object.freeze(input.artifacts.map((artifact) => artifact.contentRef)),
    publishedAt: deps.now(),
    simulated: true,
  });
}

/** The verification decision: recomputed address vs the recorded one. */
export type LabEvidenceVerification =
  | { readonly verified: true; readonly contentHash: string }
  | { readonly verified: false; readonly reason: string };

/**
 * Verifies a manifest against its artifact bindings (pure; the mismatch
 * authority). FAILS CLOSED: any count/positional-ref/address mismatch
 * refuses — a manifest is only trusted when the recomputed address
 * equals the recorded contentHash exactly.
 */
export function verifyLabEvidenceManifest(
  manifest: LabEvidenceManifest,
  artifacts: readonly LabArtifactBinding[],
): LabEvidenceVerification {
  if (!Array.isArray(artifacts) || artifacts.length !== manifest.artifactRefs.length) {
    return { verified: false, reason: "artifact-count-mismatch" };
  }
  for (let index = 0; index < manifest.artifactRefs.length; index += 1) {
    const recordedRef = manifest.artifactRefs[index];
    const bindingRef = artifacts[index]?.contentRef;
    if (recordedRef !== bindingRef) {
      return { verified: false, reason: "artifact-ref-mismatch" };
    }
    if (!isSha256Hex(artifacts[index]?.contentHash)) {
      return { verified: false, reason: "artifact-hash-invalid" };
    }
  }
  const recomputed = labManifestContentHash(manifest.runId, artifacts);
  if (recomputed !== manifest.contentHash) {
    return { verified: false, reason: "content-hash-mismatch" };
  }
  return { verified: true, contentHash: recomputed };
}
