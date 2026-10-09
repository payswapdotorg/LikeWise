// YOU evidence service — review flow (docs/you/CONTRACTS.md: "Evidence
// review is a first-class flow: a review records deterministic quality
// observations keyed by deficiency class plus an accept/reject outcome.
// Reviews are immutable; a re-review supersedes (never overwrites)").
//
// Supersession creates a brand-new immutable EvidenceReview; the old
// record keeps its status untouched and the linkage is expressed in the
// evidence-reviewed event payload (supersedesReviewId) plus the plane's
// supersessionLinks map. Delete-after-review retention removes the
// content at the first RESOLVED review (pending reviews do not trigger
// deletion); the record itself stays as immutable provenance.

import type { AuthorType, EvidenceRecord, EvidenceReview, OpaqueId, SolutionQualityMap } from "@zcode/shared";
import type { EvidenceReviewStatus } from "@zcode/shared";
import { FIXTURE_DEFICIENCY_CLASSES } from "../../../shared/src/you/fixture.js";
import {
  createEvidenceReview,
  fixtureQualityObservations,
  supersedeEvidenceReview,
  transitionEvidenceReview,
} from "../../../shared/src/you/evidenceRecord.js";
import { expiresAfterReview } from "../../../shared/src/you/evidenceRetention.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { appendEvidenceReviewed } from "./evidenceLedgerOps.js";
import type { EvidencePlaneRecord, EvidenceServiceDeps, EvidenceServiceResult } from "./evidenceServiceTypes.js";
import { evidenceFailure } from "./evidenceServiceTypes.js";

export interface ReviewEvidenceInput {
  readonly reviewerType: AuthorType;
  readonly outcome: "accepted" | "rejected" | "pending";
  /** Defaults to deterministic fixture observations derived from the content hash. */
  readonly qualityObservations?: SolutionQualityMap;
  readonly notes: string;
  /** Re-review: the id of an earlier resolved review of the same evidence. */
  readonly supersedesReviewId?: OpaqueId;
}

function resolvedStatus(status: EvidenceReviewStatus): boolean {
  return status === "accepted" || status === "rejected";
}

/** Applies delete-after-review retention once a review resolves. */
function applyReviewRetention(
  store: EvidenceContentStore,
  record: EvidenceRecord,
  review: EvidenceReview,
): boolean {
  if (!resolvedStatus(review.status)) {
    return false;
  }
  // Idempotent: if the content was already removed at the first resolved
  // review, store.has is false and nothing further happens.
  return applyDeleteAfterReview(store, record);
}

function registerReview(plane: EvidencePlaneRecord, review: EvidenceReview, supersedes?: OpaqueId): void {
  plane.reviews.set(review.id, review);
  const existing = plane.reviewsByEvidence.get(review.evidenceId) ?? [];
  plane.reviewsByEvidence.set(review.evidenceId, [...existing, review.id]);
  if (supersedes !== undefined) {
    plane.supersessionLinks.set(supersedes, review.id);
  }
}

/**
 * Reviews evidence: creates an immutable review (accept/reject outcome, or
 * a pending review to resolve later). When supersedesReviewId is given,
 * the new review supersedes that earlier review of the same evidence —
 * the old record is never overwritten.
 */
export function reviewEvidenceOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  evidenceId: OpaqueId,
  input: ReviewEvidenceInput,
): EvidenceServiceResult<{ readonly review: EvidenceReview; readonly contentRemovedAfterReview: boolean }> {
  const record = plane.evidenceRecords.get(evidenceId);
  if (record === undefined) {
    return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown evidence record", {
      reason: "unknown-evidence",
      evidenceId,
    });
  }
  const qualityObservations =
    input.qualityObservations ?? fixtureQualityObservations(record.contentHash, FIXTURE_DEFICIENCY_CLASSES);
  let review: EvidenceReview;
  let supersedesReviewId: OpaqueId | undefined;
  if (input.supersedesReviewId === undefined) {
    review = createEvidenceReview(
      {
        evidenceId,
        reviewerType: input.reviewerType,
        status: input.outcome,
        qualityObservations,
        notes: input.notes,
      },
      deps,
    );
  } else {
    const previous = plane.reviews.get(input.supersedesReviewId);
    if (previous === undefined) {
      return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown review to supersede", {
        reason: "unknown-review",
        reviewId: input.supersedesReviewId,
      });
    }
    if (previous.evidenceId !== evidenceId) {
      return evidenceFailure("YOU_INVALID_STATE", "supersession target belongs to different evidence", {
        reason: "review-evidence-mismatch",
        reviewId: input.supersedesReviewId,
        evidenceId,
      });
    }
    if (previous.status === "pending") {
      return evidenceFailure("YOU_INVALID_STATE", "a pending review must be resolved before supersession", {
        reason: "pending-review-not-resolvable",
        reviewId: input.supersedesReviewId,
      });
    }
    const supersession = supersedeEvidenceReview(
      previous,
      {
        reviewerType: input.reviewerType,
        status: input.outcome,
        qualityObservations,
        notes: input.notes,
      },
      deps,
    );
    review = supersession.replacement;
    supersedesReviewId = supersession.supersededReviewId;
  }
  registerReview(plane, review, supersedesReviewId);
  const contentRemovedAfterReview = applyReviewRetention(store, record, review);
  appendEvidenceReviewed(plane, {
    review,
    supersedesReviewId,
    contentRemovedAfterReview,
  });
  return { ok: true, value: { review, contentRemovedAfterReview } };
}

/** Resolves a pending review (accept/reject) — immutable record replacement. */
export function resolveEvidenceReviewOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  evidenceId: OpaqueId,
  reviewId: OpaqueId,
  outcome: "accepted" | "rejected",
): EvidenceServiceResult<{ readonly review: EvidenceReview; readonly contentRemovedAfterReview: boolean }> {
  const review = plane.reviews.get(reviewId);
  if (review === undefined) {
    return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown review", {
      reason: "unknown-review",
      reviewId,
    });
  }
  if (review.evidenceId !== evidenceId) {
    return evidenceFailure("YOU_INVALID_STATE", "review belongs to different evidence", {
      reason: "review-evidence-mismatch",
      reviewId,
      evidenceId,
    });
  }
  const record = plane.evidenceRecords.get(evidenceId);
  if (record === undefined) {
    return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown evidence record", {
      reason: "unknown-evidence",
      evidenceId,
    });
  }
  let resolved: EvidenceReview;
  try {
    resolved = transitionEvidenceReview(review, outcome);
  } catch (error) {
    return evidenceFailure("YOU_INVALID_STATE", "illegal review resolution", {
      reason: "illegal-review-transition",
      reviewId,
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  plane.reviews.set(reviewId, resolved);
  const contentRemovedAfterReview = applyDeleteAfterReview(store, record);
  appendEvidenceReviewed(plane, { review: resolved, contentRemovedAfterReview });
  return { ok: true, value: { review: resolved, contentRemovedAfterReview } };
}

function applyDeleteAfterReview(store: EvidenceContentStore, record: EvidenceRecord): boolean {
  if (expiresAfterReview(record) && store.has(record.contentRef)) {
    store.delete(record.contentRef);
    return true;
  }
  return false;
}
