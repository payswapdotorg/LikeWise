// YOU immutable EvidenceRecord + EvidenceReview construction (W2A —
// docs/you/CONTRACTS.md "Evidence / capture / consent", wave-2 freeze).
//
// EvidenceRecords are immutable, content-addressed (`contentRef` +
// sha-256 `contentHash` binding, computed by the content store) and carry
// privacy class, retention, consent snapshot and provenance. Reviews are
// immutable records of deterministic quality observations keyed by
// deficiency class plus an accept/reject outcome; supersession NEVER
// overwrites: a re-review creates a new record and the old record keeps
// its status (the supersession linkage is expressed in the event ledger).

import type {
  AuthorType,
  CaptureModality,
  ConsentReference,
  EvidencePrivacyClass,
  EvidenceRecord,
  EvidenceRetention,
  EvidenceReview,
  EvidenceReviewStatus,
  EvidenceType,
  OpaqueId,
  SolutionQualityMap,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { roundQualityScore } from "./quality.js";
import { deepFreeze } from "./serialize.js";

export interface EvidenceRecordIntake {
  readonly evidenceRequestId: OpaqueId | null;
  readonly captureSessionId: OpaqueId | null;
  readonly evidenceType: EvidenceType;
  readonly modality: CaptureModality;
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  readonly privacyClass: EvidencePrivacyClass;
  readonly retention: EvidenceRetention;
  readonly consent: ConsentReference;
  readonly provenanceSource: string;
  readonly generator?: AuthorType;
  /** Truth law: fixture/synthetic evidence stays labeled. */
  readonly simulated: boolean;
}

/** Creates an immutable, deep-frozen EvidenceRecord. */
export function createEvidenceRecord(
  intake: EvidenceRecordIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): EvidenceRecord {
  if (intake.contentHash.length === 0) {
    throw new Error("EvidenceRecord requires a contentHash");
  }
  const capturedAt = deps.clock.now();
  return deepFreeze({
    id: deps.ids.next("evidence"),
    evidenceRequestId: intake.evidenceRequestId,
    captureSessionId: intake.captureSessionId,
    evidenceType: intake.evidenceType,
    modality: intake.modality,
    contentRef: intake.contentRef,
    contentHash: intake.contentHash,
    privacyClass: intake.privacyClass,
    retention: intake.retention,
    consent: intake.consent,
    capturedAt,
    provenance: deepFreeze({
      source: intake.provenanceSource,
      generator: intake.generator ?? "fixture",
      createdAt: capturedAt,
      lineage: Object.freeze([]),
    }),
    simulated: intake.simulated,
  });
}

export interface EvidenceReviewIntake {
  readonly evidenceId: OpaqueId;
  readonly reviewerType: AuthorType;
  readonly status: EvidenceReviewStatus;
  readonly qualityObservations: SolutionQualityMap;
  readonly notes: string;
}

/** Creates an immutable EvidenceReview (status as given: pending/accepted/rejected). */
export function createEvidenceReview(
  intake: EvidenceReviewIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): EvidenceReview {
  if (intake.evidenceId.length === 0) {
    throw new Error("EvidenceReview requires an evidenceId");
  }
  return deepFreeze({
    id: deps.ids.next("evidence-review"),
    evidenceId: intake.evidenceId,
    reviewerType: intake.reviewerType,
    status: intake.status,
    qualityObservations: deepFreeze({ ...intake.qualityObservations }),
    notes: intake.notes,
    reviewedAt: deps.clock.now(),
  });
}

/** In-record review transitions: a pending review can be resolved once. */
const EVIDENCE_REVIEW_TRANSITIONS: Readonly<Record<EvidenceReviewStatus, readonly EvidenceReviewStatus[]>> = {
  pending: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  superseded: [],
};

export function isLegalEvidenceReviewTransition(from: EvidenceReviewStatus, to: EvidenceReviewStatus): boolean {
  return EVIDENCE_REVIEW_TRANSITIONS[from].includes(to);
}

/** Returns a NEW EvidenceReview with the status transitioned (immutable). */
export function transitionEvidenceReview(review: EvidenceReview, status: EvidenceReviewStatus): EvidenceReview {
  if (!isLegalEvidenceReviewTransition(review.status, status)) {
    throw new Error(`illegal evidence review transition ${review.status} -> ${status}`);
  }
  return deepFreeze({ ...review, status });
}

/**
 * Supersession result: the replacement review (a brand-new immutable
 * record) plus the id of the superseded review. The superseded record is
 * never overwritten and keeps its own status; the linkage lives in the
 * ledger event payload.
 */
export interface ReviewSupersession {
  readonly supersededReviewId: OpaqueId;
  readonly replacement: EvidenceReview;
}

/**
 * Re-review: creates a NEW review record superseding `previous`. The
 * previous record object is untouched (its status stays as recorded); the
 * supersession linkage is carried by the ledger event.
 */
export function supersedeEvidenceReview(
  previous: EvidenceReview,
  intake: Omit<EvidenceReviewIntake, "evidenceId">,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): ReviewSupersession {
  if (previous.status === "pending") {
    throw new Error("a pending review must be resolved before supersession");
  }
  const replacement = createEvidenceReview({ ...intake, evidenceId: previous.evidenceId }, deps);
  return { supersededReviewId: previous.id, replacement };
}

const HASH_WORD_MASK = 0xffffffff;

/**
 * Deterministic fixture quality observations keyed by deficiency class,
 * derived from an evidence record's sha-256 content hash (fixture
 * definition: classes iterated sorted; each score parses 8 hex chars at
 * offset (index * 8) mod 64 of the hash). Scores are in [0, 1] rounded to
 * the fixture 4-decimal precision; they never imply scientific validity.
 */
export function fixtureQualityObservations(
  contentHash: string,
  deficiencyClasses: readonly string[],
): SolutionQualityMap {
  const observations: Record<string, number> = {};
  const classes = [...deficiencyClasses].sort();
  for (let index = 0; index < classes.length; index += 1) {
    const deficiencyClass = classes[index];
    if (deficiencyClass === undefined) {
      continue;
    }
    const offset = (index * 8) % 64;
    const word = Number.parseInt(contentHash.slice(offset, offset + 8), 16);
    const raw = Number.isNaN(word) ? 0 : word / (HASH_WORD_MASK + 1);
    observations[deficiencyClass] = roundQualityScore(raw);
  }
  return observations;
}
