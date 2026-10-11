// YOU performance service — ledger event emission helpers (W4A).
//
// Append-only event helpers following the W1A/W2A/W3A precedent
// (solutionLedgerOps.ts / evidenceLedgerOps.ts / twinLedgerOps.ts):
// per-record status facts ride along in event payloads because the frozen
// SolutionEventType set has no per-record status events, and artifacts
// (no dedicated event type in the frozen wave-4 set) ride flattened
// inside render-job-completed. Payload conventions (folded by
// shared/src/you/performanceLedger.ts replayPerformanceLedger):
//   performance-published       kind=publication | template-instantiation
//                               (+ timeline facts + param.<key> overrides)
//   render-job-submitted        job facts (status starts "queued")
//   render-job-completed        statusAfter + artifactCount +
//                               artifact.<i>.id/.kind/.contentRef/.contentHash
//                               + failureReason? (failed jobs)
//   render-artifact-reviewed    kind=opened | resolved | superseded |
//                               re-review (+ supersedesReviewId linkage)

import type { OpaqueId, Performance, RenderArtifact, RenderArtifactReview, RenderJobResult, RenderJobSpec } from "@zcode/shared";
import { trackKindsOfCues } from "../../../shared/src/you/performanceTimeline.js";
import type { ParameterRecord } from "../../../shared/src/you/performanceTemplate.js";
import type { PerformancePlaneRecord } from "./performanceServiceTypes.js";

/** Appends performance-published for a direct publication (no template). */
export function appendPerformancePublished(plane: PerformancePlaneRecord, performance: Performance): void {
  plane.ledger.append({
    type: "performance-published",
    subjectRef: performance.id,
    generator: "agent",
    payload: {
      kind: "publication",
      performanceId: performance.id,
      twinVersionId: performance.twinVersionId,
      basedOnTemplateId: performance.basedOnTemplateId ?? "",
      timelineId: performance.timeline.id,
      cueCount: performance.timeline.cues.length,
      durationMs: performance.timeline.durationMs,
      trackKinds: trackKindsOfCues(performance.timeline.cues).join(","),
      simulated: true,
    },
  });
}

/** Appends performance-published for a template instantiation (bound parameter facts ride along). */
export function appendPerformanceInstantiated(
  plane: PerformancePlaneRecord,
  performance: Performance,
  parameters: ParameterRecord,
): void {
  const paramFacts: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parameters).sort(([a], [b]) => (a < b ? -1 : 1))) {
    paramFacts[`param.${key}`] = value;
  }
  plane.ledger.append({
    type: "performance-published",
    subjectRef: performance.id,
    generator: "agent",
    payload: {
      kind: "template-instantiation",
      performanceId: performance.id,
      twinVersionId: performance.twinVersionId,
      basedOnTemplateId: performance.basedOnTemplateId ?? "",
      timelineId: performance.timeline.id,
      cueCount: performance.timeline.cues.length,
      durationMs: performance.timeline.durationMs,
      trackKinds: trackKindsOfCues(performance.timeline.cues).join(","),
      ...paramFacts,
      simulated: true,
    },
  });
}

/** Appends render-job-submitted (job facts; status starts "queued"). */
export function appendRenderJobSubmitted(plane: PerformancePlaneRecord, spec: RenderJobSpec): void {
  plane.ledger.append({
    type: "render-job-submitted",
    subjectRef: spec.id,
    generator: "agent",
    payload: {
      jobId: spec.id,
      performanceId: spec.performanceId,
      method: spec.method,
      outputKinds: [...spec.outputKinds].sort().join(","),
      outputKindCount: spec.outputKinds.length,
      parameterCount: Object.keys(spec.parameters).length,
      simulated: true,
    },
  });
}

/** Appends render-job-completed (terminal status + flattened artifact facts). */
export function appendRenderJobCompleted(
  plane: PerformancePlaneRecord,
  result: RenderJobResult,
  artifacts: readonly RenderArtifact[],
): void {
  const artifactFacts: Record<string, string | number | boolean> = {};
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index];
    if (artifact === undefined) {
      continue;
    }
    artifactFacts[`artifact.${index}.id`] = artifact.id;
    artifactFacts[`artifact.${index}.kind`] = artifact.kind;
    artifactFacts[`artifact.${index}.contentRef`] = artifact.contentRef;
    artifactFacts[`artifact.${index}.contentHash`] = artifact.contentHash;
  }
  plane.ledger.append({
    type: "render-job-completed",
    subjectRef: result.jobId,
    generator: "agent",
    payload: {
      jobId: result.jobId,
      statusAfter: result.status,
      artifactCount: artifacts.length,
      ...artifactFacts,
      ...(result.status === "failed" && typeof result.effortObservations["failureReason"] === "string"
        ? { failureReason: result.effortObservations["failureReason"] as string }
        : {}),
      simulated: true,
    },
  });
}

export interface RenderArtifactReviewedFacts {
  readonly review: RenderArtifactReview;
  /** opened | resolved | superseded | re-review. */
  readonly kind: "opened" | "resolved" | "superseded" | "re-review";
  /** Set when this review supersedes an earlier one (linkage, never an overwrite). */
  readonly supersedesReviewId?: OpaqueId;
  /** The job the reviewed artifact belongs to (lineage facts). */
  readonly jobId: OpaqueId;
}

/** Appends render-artifact-reviewed (review status + supersession linkage). */
export function appendRenderArtifactReviewed(plane: PerformancePlaneRecord, facts: RenderArtifactReviewedFacts): void {
  plane.ledger.append({
    type: "render-artifact-reviewed",
    subjectRef: facts.review.artifactId,
    generator: "user",
    payload: {
      kind: facts.kind,
      reviewId: facts.review.id,
      artifactId: facts.review.artifactId,
      jobId: facts.jobId,
      reviewStatus: facts.review.status,
      supersedesReviewId: facts.supersedesReviewId ?? "",
      simulated: true,
    },
  });
}
