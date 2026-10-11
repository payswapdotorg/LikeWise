// YOU render artifact + review machinery (W4A — docs/you/CONTRACTS.md
// "Performance / render", frozen v4 contracts).
//
// RenderArtifacts are immutable and content-addressed on the wave-2
// content-store abstraction (contentRef + sha-256 contentHash; never
// inlined). Artifact construction happens in renderJob.ts's deterministic
// fixture renderer; this module owns the artifact review state machine.
//
// Review state machine (docs/you/WORK_ORDERS.md W4A: "append-only reviews
// (pending → accepted | rejected | superseded; the SAME status discipline
// as wave-2 evidence reviews; never overwrite)"):
//   pending  -> accepted | rejected | superseded
//   accepted / rejected / superseded are terminal in-record.
//
// Discipline (the wave-2 evidence-review precedent, verbatim):
//   - Reviews are immutable records; a pending review resolves exactly
//     once through IMMUTABLE RECORD REPLACEMENT (a brand-new frozen
//     record under the same id, content identical, only the status
//     moved) — never an in-place mutation, and every transition is
//     journaled append-only in the event ledger.
//   - A re-review supersedes a RESOLVED review by creating a NEW review
//     record; the superseded record keeps its recorded status untouched
//     and the linkage (supersededReviewId -> replacement) is expressed in
//     the ledger event payload plus the plane's supersession map —
//     never an overwrite.
//   - A pending review may be superseded (withdrawn/mooted) through the
//     pending -> superseded in-record transition.

import type { OpaqueId, RenderArtifactReview, RenderArtifactReviewStatus } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";

/** Legal review status transitions (append-only lifecycle; resolutions never un-done). */
export const RENDER_ARTIFACT_REVIEW_TRANSITIONS: Readonly<
  Record<RenderArtifactReviewStatus, readonly RenderArtifactReviewStatus[]>
> = {
  pending: ["accepted", "rejected", "superseded"],
  accepted: [],
  rejected: [],
  superseded: [],
};

export function isLegalRenderArtifactReviewTransition(from: RenderArtifactReviewStatus, to: RenderArtifactReviewStatus): boolean {
  return RENDER_ARTIFACT_REVIEW_TRANSITIONS[from].includes(to);
}

export function isTerminalRenderArtifactReviewStatus(status: RenderArtifactReviewStatus): boolean {
  return RENDER_ARTIFACT_REVIEW_TRANSITIONS[status].length === 0;
}

export interface RenderArtifactReviewIntake {
  readonly artifactId: OpaqueId;
  /** Opening status: pending, or a directly-resolved accepted/rejected outcome. */
  readonly status: "pending" | "accepted" | "rejected";
}

/** Opening statuses: a review starts pending or directly resolved (never superseded). */
const REVIEW_OPENING_STATUSES: readonly RenderArtifactReviewStatus[] = ["pending", "accepted", "rejected"];

/** Creates an immutable, deep-frozen RenderArtifactReview (status as given). */
export function createRenderArtifactReview(
  intake: RenderArtifactReviewIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): RenderArtifactReview {
  if (typeof intake.artifactId !== "string" || intake.artifactId.length === 0) {
    throw new Error("RenderArtifactReview requires an artifactId");
  }
  if (!REVIEW_OPENING_STATUSES.includes(intake.status)) {
    throw new Error(`illegal artifact review opening status ${intake.status}`);
  }
  return deepFreeze({
    id: deps.ids.next("artifact-review"),
    artifactId: intake.artifactId,
    status: intake.status,
    reviewedAt: deps.clock.now(),
  });
}

/** Returns a NEW deep-frozen review with the status transitioned (immutable record replacement). */
export function transitionRenderArtifactReview(
  review: RenderArtifactReview,
  status: RenderArtifactReviewStatus,
): RenderArtifactReview {
  if (!isLegalRenderArtifactReviewTransition(review.status, status)) {
    throw new Error(`illegal artifact review transition ${review.status} -> ${status}`);
  }
  return deepFreeze({ ...review, status });
}

export interface RenderReviewSupersession {
  readonly supersededReviewId: OpaqueId;
  readonly replacement: RenderArtifactReview;
}

/**
 * Re-review: creates a NEW review record superseding `previous` (the
 * wave-2 discipline — the previous record is never overwritten; the
 * linkage is carried by the ledger event + the plane's supersession map).
 * The previous review must already be RESOLVED (accepted/rejected); a
 * pending review must be resolved or withdrawn first.
 */
export function supersedeRenderArtifactReview(
  previous: RenderArtifactReview,
  intake: RenderArtifactReviewIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): RenderReviewSupersession {
  if (previous.status === "pending") {
    throw new Error("a pending review must be resolved or withdrawn before supersession");
  }
  const replacement = createRenderArtifactReview(
    { artifactId: previous.artifactId, status: intake.status },
    deps,
  );
  return { supersededReviewId: previous.id, replacement };
}
