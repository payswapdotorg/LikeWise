// YOU performance service — artifact review flow (W4A —
// docs/you/CONTRACTS.md wave-4 freeze: "artifact reviews are append-only
// status transitions (pending → accepted | rejected | superseded)"; the
// SAME status discipline as wave-2 evidence reviews).
//
// Reviews are immutable records. A pending review resolves exactly once
// through immutable record replacement (journaled append-only). A re-review
// supersedes a RESOLVED review by creating a NEW review record — the old
// record keeps its status and the linkage (supersededReviewId ->
// replacement) is expressed in the ledger event payload plus the plane's
// supersession map, never an overwrite. A pending review may be
// withdrawn through the pending -> superseded in-record transition.
// Unknown artifacts/reviews are typed YOU_RENDER_ARTIFACT_NOT_FOUND.

import type { OpaqueId, RenderArtifact, RenderArtifactReview } from "@zcode/shared";
import {
  createRenderArtifactReview,
  supersedeRenderArtifactReview,
  transitionRenderArtifactReview,
} from "../../../shared/src/you/renderArtifact.js";
import { appendRenderArtifactReviewed } from "./performanceLedgerOps.js";
import type { PerformancePlaneRecord, PerformanceServiceDeps, PerformanceServiceResult } from "./performanceServiceTypes.js";
import { performanceFailure, requireArtifact } from "./performanceServiceTypes.js";

export interface ReviewArtifactInput {
  /** Opening status: pending, or a directly-resolved accepted/rejected outcome. */
  readonly outcome: "pending" | "accepted" | "rejected";
}

/** The jobId whose artifact is under review (lineage facts in the event). */
function jobIdOfArtifact(plane: PerformancePlaneRecord, artifact: RenderArtifact): OpaqueId {
  return artifact.jobId;
}

/** Opens a review on an artifact (append-only; a new immutable record). */
export function reviewRenderArtifactOp(
  plane: PerformancePlaneRecord,
  deps: PerformanceServiceDeps,
  artifactId: OpaqueId,
  input: ReviewArtifactInput,
): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
  const found = requireArtifact(plane, artifactId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const review = createRenderArtifactReview({ artifactId, status: input.outcome }, deps);
  registerReview(plane, review);
  appendRenderArtifactReviewed(plane, { review, kind: "opened", jobId: jobIdOfArtifact(plane, found.artifact) });
  return { ok: true, value: { review } };
}

function registerReview(plane: PerformancePlaneRecord, review: RenderArtifactReview, supersedes?: OpaqueId): void {
  plane.reviews.set(review.id, review);
  const existing = plane.reviewIdsByArtifact.get(review.artifactId) ?? [];
  plane.reviewIdsByArtifact.set(review.artifactId, [...existing, review.id]);
  if (supersedes !== undefined) {
    plane.supersessionLinks.set(supersedes, review.id);
  }
}

function requireReview(
  plane: PerformancePlaneRecord,
  artifactId: OpaqueId,
  reviewId: OpaqueId,
): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
  const review = plane.reviews.get(reviewId);
  if (review === undefined) {
    return performanceFailure("YOU_RENDER_ARTIFACT_NOT_FOUND", "unknown render artifact review", {
      reason: "unknown-artifact-review",
      reviewId,
      artifactId,
    });
  }
  if (review.artifactId !== artifactId) {
    return performanceFailure("YOU_INVALID_STATE", "review belongs to a different artifact", {
      reason: "review-artifact-mismatch",
      reviewId,
      artifactId,
    });
  }
  return { ok: true, value: { review } };
}

/** Resolves a pending review (accept/reject) — immutable record replacement, journaled. */
export function resolveRenderArtifactReviewOp(
  plane: PerformancePlaneRecord,
  artifactId: OpaqueId,
  reviewId: OpaqueId,
  outcome: "accepted" | "rejected",
): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
  const found = requireReview(plane, artifactId, reviewId);
  if (!found.ok) {
    return found;
  }
  const artifact = requireArtifact(plane, artifactId);
  if ("error" in artifact) {
    return { ok: false, error: artifact.error };
  }
  let resolved: RenderArtifactReview;
  try {
    resolved = transitionRenderArtifactReview(found.value.review, outcome);
  } catch (error) {
    return performanceFailure("YOU_INVALID_STATE", "illegal artifact review resolution", {
      reason: "illegal-review-transition",
      reviewId,
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  plane.reviews.set(reviewId, resolved);
  appendRenderArtifactReviewed(plane, { review: resolved, kind: "resolved", jobId: jobIdOfArtifact(plane, artifact.artifact) });
  return { ok: true, value: { review: resolved } };
}

/** Withdraws a pending review (pending -> superseded in-record transition, journaled). */
export function supersedePendingRenderArtifactReviewOp(
  plane: PerformancePlaneRecord,
  artifactId: OpaqueId,
  reviewId: OpaqueId,
): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
  const found = requireReview(plane, artifactId, reviewId);
  if (!found.ok) {
    return found;
  }
  const artifact = requireArtifact(plane, artifactId);
  if ("error" in artifact) {
    return { ok: false, error: artifact.error };
  }
  let superseded: RenderArtifactReview;
  try {
    superseded = transitionRenderArtifactReview(found.value.review, "superseded");
  } catch (error) {
    return performanceFailure("YOU_INVALID_STATE", "illegal artifact review supersession", {
      reason: "illegal-review-transition",
      reviewId,
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  plane.reviews.set(reviewId, superseded);
  appendRenderArtifactReviewed(plane, { review: superseded, kind: "superseded", jobId: jobIdOfArtifact(plane, artifact.artifact) });
  return { ok: true, value: { review: superseded } };
}

export interface ReReviewArtifactInput {
  /** The new review's opening status: pending, or directly resolved. */
  readonly outcome: "pending" | "accepted" | "rejected";
  /** The id of the earlier RESOLVED review this re-review supersedes. */
  readonly supersedesReviewId: OpaqueId;
}

/**
 * Re-review: supersedes an earlier RESOLVED review of the same artifact by
 * creating a NEW immutable review — the old record keeps its status and
 * the linkage rides in the ledger event + the plane's supersession map.
 */
export function reReviewRenderArtifactOp(
  plane: PerformancePlaneRecord,
  deps: PerformanceServiceDeps,
  artifactId: OpaqueId,
  input: ReReviewArtifactInput,
): PerformanceServiceResult<{ readonly review: RenderArtifactReview; readonly superseded: RenderArtifactReview }> {
  const found = requireReview(plane, artifactId, input.supersedesReviewId);
  if (!found.ok) {
    return found;
  }
  const artifact = requireArtifact(plane, artifactId);
  if ("error" in artifact) {
    return { ok: false, error: artifact.error };
  }
  const previous = found.value.review;
  if (previous.status === "pending") {
    return performanceFailure("YOU_INVALID_STATE", "a pending review must be resolved or withdrawn before supersession", {
      reason: "pending-review-not-resolvable",
      reviewId: previous.id,
    });
  }
  if (previous.status === "superseded" || plane.supersessionLinks.has(previous.id)) {
    return performanceFailure("YOU_INVALID_STATE", "an already superseded review cannot be superseded again", {
      reason: "review-already-superseded",
      reviewId: previous.id,
    });
  }
  const supersession = supersedeRenderArtifactReview(previous, { artifactId, status: input.outcome }, deps);
  registerReview(plane, supersession.replacement, supersession.supersededReviewId);
  appendRenderArtifactReviewed(plane, {
    review: supersession.replacement,
    kind: "re-review",
    supersedesReviewId: supersession.supersededReviewId,
    jobId: jobIdOfArtifact(plane, artifact.artifact),
  });
  return { ok: true, value: { review: supersession.replacement, superseded: previous } };
}

/** All reviews of an artifact, in review order (append-only history). */
export function reviewsOfArtifactOp(plane: PerformancePlaneRecord, artifactId: OpaqueId): readonly RenderArtifactReview[] {
  const ids = plane.reviewIdsByArtifact.get(artifactId) ?? [];
  return ids.map((reviewId) => plane.reviews.get(reviewId)).filter((review): review is RenderArtifactReview => review !== undefined);
}

/** The latest review of an artifact (supersession-aware), or null when unreviewed. */
export function currentReviewOfArtifactOp(plane: PerformancePlaneRecord, artifactId: OpaqueId): RenderArtifactReview | null {
  const ids = plane.reviewIdsByArtifact.get(artifactId) ?? [];
  const latest = ids[ids.length - 1];
  return latest === undefined ? null : (plane.reviews.get(latest) ?? null);
}
