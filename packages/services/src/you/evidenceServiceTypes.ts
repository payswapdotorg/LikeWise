// YOU evidence application service — shared internal types and helpers.
//
// The application service (evidenceService.ts) is the single authority
// over evidence/capture/consent truth (docs/you/CONTRACTS.md "State
// ownership": evidence = evidence service). The flow modules
// (evidenceConsentFlow.ts, evidenceCaptureFlow.ts,
// evidenceRecordFlow.ts, evidenceReviewFlow.ts) operate on the
// per-solution plane records it owns, mutating only through immutable
// record replacement + append-only ledger events
// (evidenceLedgerOps.ts). Nothing here is a second authority.

import type {
  CaptureSession,
  ConsentReference,
  EvidenceRecord,
  EvidenceReview,
  OpaqueId,
  YouError,
} from "@zcode/shared";
import type { ConsentRegistry } from "../../../shared/src/you/evidenceConsent.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type EvidenceServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function evidenceFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface EvidenceServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/**
 * One solution's evidence plane: ledger, consent registry, capture
 * sessions, evidence records, reviews and the supersession links. The
 * service is the sole writer; flows receive the record and return new
 * immutable values.
 */
export interface EvidencePlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  readonly consents: ConsentRegistry;
  readonly captureSessions: Map<OpaqueId, CaptureSession>;
  readonly evidenceRecords: Map<OpaqueId, EvidenceRecord>;
  readonly reviews: Map<OpaqueId, EvidenceReview>;
  /** Append-ordered review ids per evidence id, oldest first. */
  readonly reviewsByEvidence: Map<OpaqueId, OpaqueId[]>;
  /** superseded reviewId -> replacing reviewId (linkage, never an overwrite). */
  readonly supersessionLinks: Map<OpaqueId, OpaqueId>;
}

/** Sentinel consent reference for evidence captured without a consent instrument. */
export const NO_CONSENT_POLICY_ID = "you-evidence-no-consent";

export function noConsentReference(): ConsentReference {
  return { policyId: NO_CONSENT_POLICY_ID, state: "unknown", learningPermission: false };
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
