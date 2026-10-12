// YOU learning-plane ledger replay (W6A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The learning application service appends the wave-6 events
// (learning-signal-captured / learning-record-validated /
// learning-record-rejected / preference-updated) into the W1A
// SolutionEventLedger machinery. Payload conventions (folded here by
// replayLearningLedger):
//   learning-signal-captured   { signalId, kind, scope, subjectRef (""
//                               when null), evidenceCount,
//                               evidenceRef.<i>, capturedAt, simulated }
//   learning-record-validated  { recordId, signalId, scope, statusAfter:
//                               "validated", contentRef, contentHash,
//                               usageCount, usage.<i>, consentRef,
//                               consentHash, rightsExpiresAt ("" when
//                               null), supersedesRecordId ("" when none),
//                               validatedAt, simulated }
//   learning-record-rejected   { recordId, signalId, scope, statusAfter:
//                               "rejected", contentRef, contentHash,
//                               reason, validatedAt, simulated }
//   preference-updated         { preferenceId, scope, key, value,
//                               derivedFromRecordId ("" when null),
//                               updatedAt }
//
// Supersession reconstructs from the successor's payload: when
// learning-record-validated carries supersedesRecordId, the referenced
// record's status becomes "superseded" with supersededById pointing at
// the successor (append-only linkage, never an overwrite).
//
// Candidate records are PRE-VALIDATION SERVICE STATE, not ledger truth
// (the frozen wave-6 event set defines no candidate event — the W4A
// template-library / W5A subject-registry precedent); they materialize
// in the replayable projection at validation/rejection time. The
// trajectory registry is service state for the same reason. Preferences
// key by `${scope}::${key}` (the latest projection wins).
//
// Deterministic: same events => same projection (compare through
// stableStringify).

import type { SolutionEvent } from "./contract.js";

export interface LearningLedgerSignalEntry {
  readonly kind: string;
  readonly scope: string;
  /** "" when the signal carries no subject. */
  readonly subjectRef: string;
  readonly evidenceRefs: readonly string[];
  readonly capturedAt: string;
  readonly simulated: boolean;
}

export interface LearningLedgerRecordEntry {
  readonly signalId: string;
  readonly status: string;
  readonly scope: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly usage: readonly string[];
  readonly consentRef: string;
  readonly consentHash: string;
  /** "" when the rights grant carries no expiry. */
  readonly expiresAt: string;
  readonly supersededById: string;
  readonly validatedAt: string;
  readonly simulated: boolean;
}

export interface LearningLedgerPreferenceEntry {
  readonly id: string;
  readonly scope: string;
  readonly key: string;
  readonly value: string;
  readonly derivedFromRecordId: string;
  readonly updatedAt: string;
}

export interface LearningPlaneProjection {
  readonly solutionId: string;
  /** signalId -> authoritative signal facts. */
  readonly signals: Readonly<Record<string, LearningLedgerSignalEntry>>;
  /** recordId -> authoritative record facts (ledger truth: validated | rejected | superseded). */
  readonly records: Readonly<Record<string, LearningLedgerRecordEntry>>;
  /** `${scope}::${key}` -> the latest preference projection. */
  readonly preferences: Readonly<Record<string, LearningLedgerPreferenceEntry>>;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function booleanPayload(event: SolutionEvent, key: string): boolean {
  const value = event.payload[key];
  return typeof value === "boolean" ? value : true;
}

/**
 * Folds learning-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 */
export function replayLearningLedger(events: readonly SolutionEvent[]): LearningPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayLearningLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const signals: Record<string, LearningLedgerSignalEntry> = {};
  const records: Record<string, LearningLedgerRecordEntry> = {};
  const preferences: Record<string, LearningLedgerPreferenceEntry> = {};

  for (const event of events) {
    switch (event.type) {
      case "learning-signal-captured": {
        const id = textPayload(event, "signalId");
        if (id !== undefined) {
          const evidenceCount = numberPayload(event, "evidenceCount") ?? 0;
          const evidenceRefs: string[] = [];
          for (let index = 0; index < evidenceCount; index += 1) {
            const ref = textPayload(event, `evidenceRef.${index}`);
            if (ref !== undefined) {
              evidenceRefs.push(ref);
            }
          }
          signals[id] = {
            kind: textPayload(event, "kind") ?? "",
            scope: textPayload(event, "scope") ?? "",
            subjectRef: textPayload(event, "subjectRef") ?? "",
            evidenceRefs: Object.freeze(evidenceRefs),
            capturedAt: textPayload(event, "capturedAt") ?? "",
            simulated: booleanPayload(event, "simulated"),
          };
        }
        break;
      }
      case "learning-record-validated": {
        const id = textPayload(event, "recordId");
        if (id !== undefined) {
          const usageCount = numberPayload(event, "usageCount") ?? 0;
          const usage: string[] = [];
          for (let index = 0; index < usageCount; index += 1) {
            const usageClass = textPayload(event, `usage.${index}`);
            if (usageClass !== undefined) {
              usage.push(usageClass);
            }
          }
          records[id] = {
            signalId: textPayload(event, "signalId") ?? "",
            status: textPayload(event, "statusAfter") ?? "validated",
            scope: textPayload(event, "scope") ?? "",
            contentRef: textPayload(event, "contentRef") ?? "",
            contentHash: textPayload(event, "contentHash") ?? "",
            usage: Object.freeze(usage),
            consentRef: textPayload(event, "consentRef") ?? "",
            consentHash: textPayload(event, "consentHash") ?? "",
            expiresAt: textPayload(event, "rightsExpiresAt") ?? "",
            supersededById: "",
            validatedAt: textPayload(event, "validatedAt") ?? "",
            simulated: booleanPayload(event, "simulated"),
          };
          const supersedesRecordId = textPayload(event, "supersedesRecordId") ?? "";
          if (supersedesRecordId.length > 0) {
            const superseded = records[supersedesRecordId];
            if (superseded !== undefined) {
              records[supersedesRecordId] = { ...superseded, status: "superseded", supersededById: id };
            }
          }
        }
        break;
      }
      case "learning-record-rejected": {
        const id = textPayload(event, "recordId");
        if (id !== undefined) {
          records[id] = {
            signalId: textPayload(event, "signalId") ?? "",
            status: textPayload(event, "statusAfter") ?? "rejected",
            scope: textPayload(event, "scope") ?? "",
            contentRef: textPayload(event, "contentRef") ?? "",
            contentHash: textPayload(event, "contentHash") ?? "",
            usage: Object.freeze([]),
            consentRef: textPayload(event, "consentRef") ?? "",
            consentHash: textPayload(event, "consentHash") ?? "",
            expiresAt: textPayload(event, "rightsExpiresAt") ?? "",
            supersededById: "",
            validatedAt: textPayload(event, "validatedAt") ?? "",
            simulated: booleanPayload(event, "simulated"),
          };
        }
        break;
      }
      case "preference-updated": {
        const preferenceId = textPayload(event, "preferenceId");
        const scope = textPayload(event, "scope") ?? "";
        const key = textPayload(event, "key") ?? "";
        if (preferenceId !== undefined) {
          preferences[`${scope}::${key}`] = {
            id: preferenceId,
            scope,
            key,
            value: textPayload(event, "value") ?? "",
            derivedFromRecordId: textPayload(event, "derivedFromRecordId") ?? "",
            updatedAt: textPayload(event, "updatedAt") ?? "",
          };
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    signals,
    records,
    preferences,
  };
}
