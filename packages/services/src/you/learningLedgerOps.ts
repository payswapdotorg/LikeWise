// YOU learning service — ledger event emission helpers (W6A).
//
// Append-only event helpers following the W1A-W5A precedent
// (solutionLedgerOps.ts / evidenceLedgerOps.ts / twinLedgerOps.ts /
// performanceLedgerOps.ts / editingLedgerOps.ts): the learning plane
// appends the wave-6 events (learning-signal-captured /
// learning-record-validated / learning-record-rejected /
// preference-updated) through the existing SolutionEventLedger
// machinery. Payload conventions are folded by
// shared/src/you/learningLedger.ts replayLearningLedger (the namespaced
// keys mirror the frozen wave-6 type names).
//
// Supersession rides along in the successor's learning-record-validated
// payload (supersedesRecordId): the frozen wave-6 event set defines no
// separate supersession event, and the fold reconstructs the
// supersededById linkage append-only.

import type { LearningPreference, LearningRecord, LearningSignal, OpaqueId } from "@zcode/shared";
import type { LearningPlaneRecord } from "./learningServiceTypes.js";

/** Appends learning-signal-captured (ordered evidence refs; content-addressed only). */
export function appendLearningSignalCaptured(plane: LearningPlaneRecord, signal: LearningSignal): void {
  const evidenceFacts: Record<string, string | number | boolean> = {};
  for (let index = 0; index < signal.evidenceRefs.length; index += 1) {
    const ref = signal.evidenceRefs[index];
    if (ref !== undefined) {
      evidenceFacts[`evidenceRef.${index}`] = ref;
    }
  }
  plane.ledger.append({
    type: "learning-signal-captured",
    subjectRef: signal.id,
    generator: "user",
    payload: {
      signalId: signal.id,
      kind: signal.kind,
      scope: signal.scope,
      subjectRef: signal.subjectRef ?? "",
      evidenceCount: signal.evidenceRefs.length,
      ...evidenceFacts,
      capturedAt: signal.capturedAt,
      simulated: signal.simulated,
    },
  });
}

export interface RecordValidatedFacts {
  readonly record: LearningRecord;
  /** The record this validation supersedes ("" when none). */
  readonly supersedesRecordId: OpaqueId | null;
}

/** Appends learning-record-validated (record facts + rights + supersession linkage). */
export function appendLearningRecordValidated(plane: LearningPlaneRecord, facts: RecordValidatedFacts): void {
  const record = facts.record;
  const usageFacts: Record<string, string | number | boolean> = {};
  for (let index = 0; index < record.rights.usage.length; index += 1) {
    const usage = record.rights.usage[index];
    if (usage !== undefined) {
      usageFacts[`usage.${index}`] = usage;
    }
  }
  plane.ledger.append({
    type: "learning-record-validated",
    subjectRef: record.id,
    generator: "agent",
    payload: {
      recordId: record.id,
      signalId: record.signalId,
      scope: record.scope,
      statusAfter: record.status,
      contentRef: record.contentRef,
      contentHash: record.contentHash,
      usageCount: record.rights.usage.length,
      ...usageFacts,
      consentRef: record.rights.consentRef,
      consentHash: record.rights.consentHash,
      rightsExpiresAt: record.rights.expiresAt ?? "",
      supersedesRecordId: facts.supersedesRecordId ?? "",
      validatedAt: record.validatedAt,
      simulated: record.simulated,
    },
  });
}

/** Appends learning-record-rejected (record facts + the refusal reason). */
export function appendLearningRecordRejected(plane: LearningPlaneRecord, record: LearningRecord, reason: string): void {
  plane.ledger.append({
    type: "learning-record-rejected",
    subjectRef: record.id,
    generator: "agent",
    payload: {
      recordId: record.id,
      signalId: record.signalId,
      scope: record.scope,
      statusAfter: record.status,
      contentRef: record.contentRef,
      contentHash: record.contentHash,
      consentRef: record.rights.consentRef,
      consentHash: record.rights.consentHash,
      rightsExpiresAt: record.rights.expiresAt ?? "",
      reason,
      validatedAt: record.validatedAt,
      simulated: record.simulated,
    },
  });
}

/** Appends preference-updated (the projection upsert; never touches record state). */
export function appendPreferenceUpdated(plane: LearningPlaneRecord, preference: LearningPreference): void {
  plane.ledger.append({
    type: "preference-updated",
    subjectRef: preference.id,
    generator: "agent",
    payload: {
      preferenceId: preference.id,
      scope: preference.scope,
      key: preference.key,
      value: preference.value,
      derivedFromRecordId: preference.derivedFromRecordId ?? "",
      updatedAt: preference.updatedAt,
    },
  });
}
