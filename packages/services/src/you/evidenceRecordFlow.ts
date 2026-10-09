// YOU evidence service — immutable evidence record flow (content-addressed,
// hash-bound; docs/you/CONTRACTS.md "Evidence content is never inlined in
// records or events; contentRef + contentHash only").
//
// Truth law: a stored-bytes hash mismatch is a typed
// YOU_CONTENT_HASH_MISMATCH error — NEVER a silent repair. Retention
// expiry is a typed YOU_RETENTION_EXPIRED error — never a silent miss.
// An unknown record id is a typed YOU_EVIDENCE_NOT_FOUND.

import type {
  CaptureModality,
  ConsentReference,
  EvidencePrivacyClass,
  EvidenceRecord,
  EvidenceType,
  OpaqueId,
} from "@zcode/shared";
import type { EvidenceRetention } from "@zcode/shared";
import { canProcess, consentReferenceFor } from "../../../shared/src/you/evidenceConsent.js";
import { createEvidenceRecord } from "../../../shared/src/you/evidenceRecord.js";
import { isRetentionDue, retentionReadOutcome } from "../../../shared/src/you/evidenceRetention.js";
import { sha256Hex, synthesizeFixtureEvidenceBytes, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import type { YouRng } from "../../../shared/src/you/rng.js";
import { appendEvidenceRecorded } from "./evidenceLedgerOps.js";
import type { EvidencePlaneRecord, EvidenceServiceDeps, EvidenceServiceResult } from "./evidenceServiceTypes.js";
import { evidenceFailure, NO_CONSENT_POLICY_ID, noConsentReference, sortedKeys } from "./evidenceServiceTypes.js";

/** Purpose under which capture/ingestion processing is consent-checked. */
export const EVIDENCE_CAPTURE_PURPOSE = "solution-generation";

export interface RecordEvidenceInput {
  readonly evidenceRequestId: OpaqueId | null;
  readonly captureSessionId: OpaqueId | null;
  readonly evidenceType: EvidenceType;
  readonly modality: CaptureModality;
  readonly privacyClass: EvidencePrivacyClass;
  readonly retention: EvidenceRetention;
  /** Registered consent policy governing this evidence; null = no instrument. */
  readonly consentPolicyId: OpaqueId | null;
  /** Explicit bytes (fixture mode synthesizes seed-derived bytes when omitted). */
  readonly payloadBytes?: Uint8Array;
}

/**
 * Records immutable, content-addressed evidence: synthesizes fixture
 * bytes (or takes explicit ones), stores them, binds the sha-256 hash and
 * appends evidence-recorded. Sensitive classes require an active consent
 * covering capture processing (server-enforced, fail-closed).
 */
export function recordEvidenceOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  rng: YouRng,
  input: RecordEvidenceInput,
): EvidenceServiceResult<{ readonly record: EvidenceRecord }> {
  if (input.captureSessionId !== null) {
    const session = plane.captureSessions.get(input.captureSessionId);
    if (session === undefined) {
      return evidenceFailure("YOU_INVALID_STATE", "unknown capture session", {
        reason: "unknown-capture-session",
        sessionId: input.captureSessionId,
      });
    }
    if (session.status !== "active") {
      return evidenceFailure("YOU_INVALID_STATE", "evidence can only be recorded during an active capture session", {
        reason: "capture-session-not-active",
        sessionId: input.captureSessionId,
        sessionStatus: session.status,
      });
    }
  }
  if (input.privacyClass === "credential") {
    return evidenceFailure("YOU_INVALID_STATE", "credential-class material is not recordable evidence", {
      reason: "privacy-class-not-processable",
      privacyClass: input.privacyClass,
    });
  }
  let consent: ConsentReference;
  if (input.consentPolicyId === null) {
    consent = noConsentReference();
  } else {
    const policy = plane.consents.policyOf(input.consentPolicyId);
    if (policy === null) {
      return evidenceFailure("YOU_INVALID_STATE", "unknown consent policy", {
        reason: "unknown-policy",
        policyId: input.consentPolicyId,
      });
    }
    consent = consentReferenceFor(policy, plane.consents.stateOf(input.consentPolicyId));
  }
  const outcome = canProcess({
    privacyClass: input.privacyClass,
    purpose: EVIDENCE_CAPTURE_PURPOSE,
    consent: input.consentPolicyId === null ? null : plane.consents.active(input.consentPolicyId),
  });
  if (!outcome.allowed) {
    return evidenceFailure("YOU_CONSENT_REQUIRED", `capture denied: ${outcome.reason}`, {
      reason: outcome.reason,
      policyId: input.consentPolicyId ?? NO_CONSENT_POLICY_ID,
      privacyClass: input.privacyClass,
      purpose: EVIDENCE_CAPTURE_PURPOSE,
    });
  }
  const bytes = input.payloadBytes ?? synthesizeFixtureEvidenceBytes(rng, input.modality);
  const binding = store.put(bytes);
  const record = createEvidenceRecord(
    {
      evidenceRequestId: input.evidenceRequestId,
      captureSessionId: input.captureSessionId,
      evidenceType: input.evidenceType,
      modality: input.modality,
      contentRef: binding.contentRef,
      contentHash: binding.contentHash,
      privacyClass: input.privacyClass,
      retention: input.retention,
      consent,
      provenanceSource: "fixture:evidence-content-store",
      generator: "fixture",
      simulated: true,
    },
    deps,
  );
  plane.evidenceRecords.set(record.id, record);
  appendEvidenceRecorded(plane, record);
  return { ok: true, value: { record } };
}

export interface EvidenceContentRead {
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  readonly bytes: Uint8Array;
}

/**
 * Reads evidence content with full truth-law enforcement: unknown record
 * -> YOU_EVIDENCE_NOT_FOUND; retention-removed or time-expired content ->
 * YOU_RETENTION_EXPIRED (never silent); stored bytes that do not hash to
 * the recorded contentHash -> YOU_CONTENT_HASH_MISMATCH (never a repair).
 */
export function readEvidenceContentOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  evidenceId: OpaqueId,
): EvidenceServiceResult<EvidenceContentRead> {
  const record = plane.evidenceRecords.get(evidenceId);
  if (record === undefined) {
    return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown evidence record", {
      reason: "unknown-evidence",
      evidenceId,
    });
  }
  const now = deps.clock.now();
  const outcome = retentionReadOutcome(record, now, store.has(record.contentRef));
  if (outcome !== "readable") {
    if (outcome === "time-expired") {
      store.delete(record.contentRef);
    }
    return evidenceFailure("YOU_RETENTION_EXPIRED", "evidence content is no longer retained", {
      reason: outcome === "time-expired" ? "retention-delete-after-due" : "retention-content-removed",
      evidenceId,
      retentionPolicy: record.retention.policy,
    });
  }
  const bytes = store.get(record.contentRef);
  if (bytes === null) {
    return evidenceFailure("YOU_RETENTION_EXPIRED", "evidence content is no longer retained", {
      reason: "retention-content-removed",
      evidenceId,
      retentionPolicy: record.retention.policy,
    });
  }
  const actualHash = sha256Hex(bytes);
  if (actualHash !== record.contentHash) {
    return evidenceFailure("YOU_CONTENT_HASH_MISMATCH", "stored evidence bytes do not match the recorded content hash", {
      reason: "content-hash-mismatch",
      evidenceId,
      recordedHash: record.contentHash,
      actualHash,
    });
  }
  return { ok: true, value: { contentRef: record.contentRef, contentHash: record.contentHash, bytes } };
}

/** Verifies the content-hash binding of one record (typed mismatch error). */
export function verifyEvidenceIntegrityOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  evidenceId: OpaqueId,
): EvidenceServiceResult<{ readonly verified: true; readonly contentHash: string }> {
  const read = readEvidenceContentOp(plane, deps, store, evidenceId);
  if (!read.ok) {
    return read;
  }
  return { ok: true, value: { verified: true, contentHash: read.value.contentHash } };
}

/** Time-based retention sweep: reports every due record, removing content where still present. */
export function sweepRetentionOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
): EvidenceServiceResult<{ readonly expiredEvidenceIds: readonly OpaqueId[] }> {
  const now = deps.clock.now();
  const expiredEvidenceIds: OpaqueId[] = [];
  for (const evidenceId of sortedKeys(plane.evidenceRecords)) {
    const record = plane.evidenceRecords.get(evidenceId);
    if (record === undefined) {
      continue;
    }
    if (isRetentionDue(record.retention, now)) {
      // Due regardless of whether content is still present (a lazy read may
      // already have materialized the deletion); remove what remains.
      store.delete(record.contentRef);
      expiredEvidenceIds.push(evidenceId);
    }
  }
  return { ok: true, value: { expiredEvidenceIds: [...expiredEvidenceIds].sort() } };
}
