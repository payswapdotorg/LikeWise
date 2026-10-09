// YOU evidence retention policies (W2A — docs/you/CONTRACTS.md
// "Evidence / capture / consent", docs/you/SECURITY.md data classes).
//
// Retention application rules (fixture definition, deterministic):
//   - session-only: content is bound to the capture session and is
//     removed when that session reaches a terminal status. Records not
//     bound to a session behave like delete-after-review (the review is
//     the session's use).
//   - delete-after-review: content is removed once the record receives
//     its first resolved review (accepted/rejected). The RECORD stays
//     (immutable provenance); the contentRef becomes non-resolvable and
//     reading it is the typed YOU_RETENTION_EXPIRED error — never silent.
//   - project-retention / tenant-retention: content is kept until the
//     policy's deleteAfter timestamp; a sweep removes it once due.
//
// Expiry is a deletion, never a record rewrite: the EvidenceRecord object
// is immutable and keeps its original retention snapshot.

import type { EvidenceRecord, EvidenceRetention } from "./contract.js";

export function sessionOnlyRetention(reason: string): EvidenceRetention {
  return { policy: "session-only", deleteAfter: null, reason };
}

export function deleteAfterReviewRetention(reason: string): EvidenceRetention {
  return { policy: "delete-after-review", deleteAfter: null, reason };
}

export function projectRetention(deleteAfter: string | null, reason: string): EvidenceRetention {
  return { policy: "project-retention", deleteAfter, reason };
}

export function tenantRetention(deleteAfter: string | null, reason: string): EvidenceRetention {
  return { policy: "tenant-retention", deleteAfter, reason };
}

/** True when the retention's deleteAfter is set and due at `now` (ISO-8601 comparison). */
export function isRetentionDue(retention: EvidenceRetention, now: string): boolean {
  return retention.deleteAfter !== null && retention.deleteAfter <= now;
}

/** True when the record's content expires with its capture session. */
export function expiresWithCaptureSession(record: EvidenceRecord): boolean {
  return record.retention.policy === "session-only" && record.captureSessionId !== null;
}

/**
 * True when the record's content is removed after its first resolved
 * review: delete-after-review, or session-only records with no capture
 * session (the review is the use).
 */
export function expiresAfterReview(record: EvidenceRecord): boolean {
  if (record.retention.policy === "delete-after-review") {
    return true;
  }
  return record.retention.policy === "session-only" && record.captureSessionId === null;
}

/**
 * Retention checks for a read: whether content must exist for this record
 * right now. Time-based policies (project/tenant retention with a due
 * deleteAfter) read as expired; removal-based policies (session-only /
 * delete-after-review) read as expired only once the store actually no
 * longer resolves the contentRef.
 */
export function retentionReadOutcome(
  record: EvidenceRecord,
  now: string,
  contentResolvable: boolean,
): "readable" | "time-expired" | "removed" {
  if (record.retention.policy === "project-retention" || record.retention.policy === "tenant-retention") {
    if (isRetentionDue(record.retention, now)) {
      return "time-expired";
    }
  }
  return contentResolvable ? "readable" : "removed";
}
