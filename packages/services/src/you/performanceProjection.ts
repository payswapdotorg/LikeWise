// YOU performance service — live plane projection builder (W4A).
//
// Builds the authoritative PerformancePlaneProjection from the service's
// live state in EXACTLY the shape replayPerformanceLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in tests
// via stableStringify; any drift between this builder and the fold is a
// bug.
//
// The template LIBRARY is service state, not ledger truth: the frozen
// wave-4 event set has no template event, so templates stay out of the
// replayable projection. Template usage is journaled through
// performance-published (basedOnTemplateId linkage) and therefore IS
// part of the projection.

import type {
  PerformanceLedgerArtifactEntry,
  PerformanceLedgerJobEntry,
  PerformanceLedgerPerformanceEntry,
  PerformancePlaneProjection,
} from "../../../shared/src/you/performanceLedger.js";
import type { PerformancePlaneRecord } from "./performanceServiceTypes.js";
import { sortedIds } from "./performanceServiceTypes.js";

/** Builds the live performance-plane projection (equal to replayPerformanceLedger output). */
export function buildPerformancePlaneProjection(plane: PerformancePlaneRecord): PerformancePlaneProjection {
  const performances: Record<string, PerformanceLedgerPerformanceEntry> = {};
  for (const performanceId of sortedIds(plane.performances)) {
    const performance = plane.performances.get(performanceId);
    if (performance === undefined) {
      continue;
    }
    performances[performanceId] = {
      twinVersionId: performance.twinVersionId,
      basedOnTemplateId: performance.basedOnTemplateId ?? "",
      timelineId: performance.timeline.id,
      cueCount: performance.timeline.cues.length,
      durationMs: performance.timeline.durationMs,
    };
  }

  const renderJobs: Record<string, PerformanceLedgerJobEntry> = {};
  for (const jobId of sortedIds(plane.jobs)) {
    const job = plane.jobs.get(jobId);
    if (job === undefined) {
      continue;
    }
    renderJobs[jobId] = {
      status: job.status,
      method: job.spec.method,
      performanceId: job.spec.performanceId,
      outputKinds: [...job.spec.outputKinds],
      artifactIds: [...(plane.artifactIdsByJob.get(jobId) ?? [])],
    };
  }

  const artifacts: Record<string, PerformanceLedgerArtifactEntry> = {};
  for (const artifactId of sortedIds(plane.artifacts)) {
    const artifact = plane.artifacts.get(artifactId);
    if (artifact === undefined) {
      continue;
    }
    artifacts[artifactId] = {
      jobId: artifact.jobId,
      kind: artifact.kind,
      contentRef: artifact.contentRef,
      contentHash: artifact.contentHash,
      simulated: artifact.simulated,
    };
  }

  const reviews: Record<string, string> = {};
  const currentReviewOfArtifact: Record<string, string> = {};
  for (const reviewId of sortedIds(plane.reviews)) {
    const review = plane.reviews.get(reviewId);
    if (review === undefined) {
      continue;
    }
    reviews[reviewId] = review.status;
  }
  for (const artifactId of sortedIds(plane.reviewIdsByArtifact)) {
    const ids = plane.reviewIdsByArtifact.get(artifactId) ?? [];
    const latest = ids[ids.length - 1];
    if (latest !== undefined) {
      currentReviewOfArtifact[artifactId] = latest;
    }
  }

  const supersededBy: Record<string, string> = {};
  for (const supersededId of sortedIds(plane.supersessionLinks)) {
    const replacement = plane.supersessionLinks.get(supersededId);
    if (replacement !== undefined) {
      supersededBy[supersededId] = replacement;
    }
  }

  return {
    solutionId: plane.solutionId,
    performances,
    renderJobs,
    artifacts,
    reviews,
    currentReviewOfArtifact,
    supersededBy,
  };
}
