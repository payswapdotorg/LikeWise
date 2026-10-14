// YOU DrRestoreRecord machinery (W10A — docs/you/CONTRACTS.md
// "Wave-10 contract freeze (v10)": "DrRestoreRecord (content-hash
// verification before activation)"; the DR LAW: a restore verifies
// content hashes BEFORE activation; the verified flag is never asserted
// without check evidence (YOU_DR_RESTORE_INVALID)).
//
// This module owns the STATELESS validators and the verification gate
// (WORK_ORDERS.md W10A: "DrRestoreRecord: content-hash verification
// BEFORE activation"). Verification is pure over its inputs: the bytes
// come from the injected content store (the wave-2 evidence content
// store abstraction — snapshot content is content-addressed by its
// sha-256 hash, exactly like evidence and arena delivery content); no
// ambient state.
//
// The frozen DrRestoreRecord shape carries the restore facts only
// (id/snapshotRef/restoredAt/verified/simulated — no check-evidence
// field), exactly like the W7A AvatarSession carried its status
// in-contract. The check evidence therefore rides the append-only
// `dr-restore-recorded` ledger event (see platformLedger.ts for the
// payload contract) AND must be present at construction time: the law's
// teeth live in constructDrRestoreRecord — a verified flag can NEVER be
// asserted without check evidence (expectedHash === actualHash over
// bytes that actually resolved), refusal reason
// "verified-without-evidence". A failed restore records verified: false
// with its refusal reason; activation is a separate projection fact (a
// failed or unverifiable restore never activates).
//
// DR snapshots use the same store abstraction as evidence content: a
// snapshot is stored by ref with its sha-256 binding; the expected hash
// comes from the snapshot manifest facts the caller recorded at backup
// time (Phase 0: the caller supplies the binding's hash; the restore
// verifies it against the bytes it actually reads).

import type { DrRestoreRecord, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";
import { sha256Hex, type EvidenceContentStore } from "./evidenceStore.js";

/** A refusal returned by the stateless validators (never an exception). */
export interface DrRestoreRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The check evidence for one restore verification (the DR LAW's
// requirement: the verified flag is never asserted without it). Built
 * ONLY by verifyDrSnapshotContent — the single verification authority.
 */
export interface DrRestoreCheckEvidence {
  readonly snapshotRef: OpaqueId;
  /** The hash the snapshot manifest recorded at backup time. */
  readonly expectedContentHash: string;
  /** The sha-256 over the bytes actually read at restore time. */
  readonly actualContentHash: string;
  /** Byte length of the verified snapshot content. */
  readonly byteLength: number;
  /** ISO-8601; the injected clock reading at the check. */
  readonly verifiedAt: string;
  readonly simulated: boolean;
}

/** Restore intake (the restore attempt facts). */
export interface DrRestoreInput {
  readonly snapshotRef: OpaqueId;
  /** The snapshot manifest's recorded content hash (sha-256 hex). */
  readonly expectedContentHash: string;
}

/** The stateless restore-intake validator. */
export function validateDrRestoreInput(input: DrRestoreInput): DrRestoreRefusal | null {
  if (typeof input.snapshotRef !== "string" || input.snapshotRef.length === 0) {
    return { reason: "snapshot-ref-empty", detail: "snapshotRef must be a non-empty opaque id" };
  }
  if (typeof input.expectedContentHash !== "string" || input.expectedContentHash.length === 0) {
    return { reason: "expected-hash-empty", detail: "expectedContentHash must be a non-empty sha-256 hex string" };
  }
  return null;
}

/**
 * The single verification authority (the DR LAW's core): reads the
 * snapshot bytes from the injected store and compares the sha-256 over
 * those bytes against the manifest's expected hash — BEFORE any
 * activation. Fail-closed refusals: "snapshot-missing" (the ref resolves
 * to nothing — unverifiable) and "hash-mismatch" (the bytes do not
 * match the recorded hash — corrupted or stale content).
 */
export function verifyDrSnapshotContent(
  store: EvidenceContentStore,
  input: DrRestoreInput,
  verifiedAt: string,
): { readonly ok: true; readonly evidence: DrRestoreCheckEvidence } | { readonly ok: false; readonly refusal: DrRestoreRefusal } {
  const intake = validateDrRestoreInput(input);
  if (intake !== null) {
    return { ok: false, refusal: intake };
  }
  const bytes = store.get(input.snapshotRef);
  if (bytes === null) {
    return {
      ok: false,
      refusal: { reason: "snapshot-missing", detail: "the snapshot ref resolves to no content (unverifiable restore)" },
    };
  }
  const actualContentHash = sha256Hex(bytes);
  if (actualContentHash !== input.expectedContentHash) {
    return {
      ok: false,
      refusal: {
        reason: "hash-mismatch",
        detail: "the snapshot content hash does not match the recorded manifest hash (refusing activation)",
      },
    };
  }
  return {
    ok: true,
    evidence: deepFreeze({
      snapshotRef: input.snapshotRef,
      expectedContentHash: input.expectedContentHash,
      actualContentHash,
      byteLength: bytes.byteLength,
      verifiedAt,
      simulated: true,
    }),
  };
}

/**
 * Constructs the immutable, deep-frozen restore record — the DR LAW's
 * teeth: `verified: true` requires check evidence whose hashes match
 * (the evidence is only ever produced by verifyDrSnapshotContent over
 * bytes that actually resolved); anything else refuses with
 * "verified-without-evidence". `verified: false` records a failed or
 * unverifiable attempt (never activated; the refusal reason rides the
 * ledger event).
 */
export function constructDrRestoreRecord(
  input: {
    readonly id: OpaqueId;
    readonly snapshotRef: OpaqueId;
    readonly restoredAt: string;
    readonly verified: boolean;
  },
  checkEvidence: DrRestoreCheckEvidence | null,
): { readonly ok: true; readonly record: DrRestoreRecord } | { readonly ok: false; refusal: DrRestoreRefusal } {
  if (typeof input.snapshotRef !== "string" || input.snapshotRef.length === 0) {
    return { ok: false, refusal: { reason: "snapshot-ref-empty", detail: "snapshotRef must be a non-empty opaque id" } };
  }
  if (typeof input.restoredAt !== "string" || input.restoredAt.length === 0) {
    return { ok: false, refusal: { reason: "restored-at-missing", detail: "restoredAt must be a non-empty ISO-8601 string" } };
  }
  if (input.verified) {
    if (checkEvidence === null) {
      return {
        ok: false,
        refusal: {
          reason: "verified-without-evidence",
          detail: "the verified flag is never asserted without check evidence (the DR LAW)",
        },
      };
    }
    if (checkEvidence.snapshotRef !== input.snapshotRef) {
      return {
        ok: false,
        refusal: { reason: "evidence-ref-mismatch", detail: "check evidence must reference the same snapshot" },
      };
    }
    if (checkEvidence.expectedContentHash !== checkEvidence.actualContentHash) {
      return {
        ok: false,
        refusal: {
          reason: "verified-without-evidence",
          detail: "check evidence with mismatched hashes cannot support the verified flag (the DR LAW)",
        },
      };
    }
  }
  return {
    ok: true,
    record: deepFreeze({
      id: input.id,
      snapshotRef: input.snapshotRef,
      restoredAt: input.restoredAt,
      verified: input.verified,
      simulated: true,
    }),
  };
}

/** True when the record is an activated (verified) restore head. */
export function isVerifiedDrRestore(record: DrRestoreRecord): boolean {
  return record.verified;
}
