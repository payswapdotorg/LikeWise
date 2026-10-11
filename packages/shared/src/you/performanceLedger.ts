// YOU performance-plane ledger replay (W4A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The performance application service appends the four wave-4 events
// (performance-published / render-job-submitted / render-job-completed /
// render-artifact-reviewed) into the W1A SolutionEventLedger machinery.
// Payload conventions follow the W1A/W2A/W3A precedent: per-record
// status facts ride along in event payloads because the frozen
// SolutionEventType set has no per-record status events, and artifacts
// (which have no dedicated event type) ride flattened inside
// render-job-completed:
//   performance-published       { kind: "publication" | "template-instantiation",
//                                 performanceId, twinVersionId,
//                                 basedOnTemplateId ("" when none),
//                                 timelineId, cueCount, durationMs,
//                                 trackKinds (sorted, comma), param.<key>=value,
//                                 simulated }
//   render-job-submitted        { jobId, performanceId, method,
//                                 outputKinds (sorted, comma),
//                                 outputKindCount, parameterCount, simulated }
//   render-job-completed        { jobId, statusAfter, artifactCount,
//                                 artifact.<i>.id / .kind / .contentRef /
//                                 .contentHash, failureReason?, simulated }
//   render-artifact-reviewed    { kind: "opened" | "resolved" | "superseded" |
//                                 "re-review", reviewId, artifactId, jobId,
//                                 reviewStatus, supersedesReviewId ("" when
//                                 none), simulated }
//
// replayPerformanceLedger folds those events into the authoritative
// performance-plane projection. Deterministic: same events => same
// projection (compare through stableStringify).

import type { SolutionEvent } from "./contract.js";

export interface PerformanceLedgerPerformanceEntry {
  readonly twinVersionId: string;
  /** "" when the performance was published without a template. */
  readonly basedOnTemplateId: string;
  readonly timelineId: string;
  readonly cueCount: number;
  readonly durationMs: number;
}

export interface PerformanceLedgerJobEntry {
  readonly status: string;
  readonly method: string;
  readonly performanceId: string;
  readonly outputKinds: string[];
  readonly artifactIds: string[];
}

export interface PerformanceLedgerArtifactEntry {
  readonly jobId: string;
  readonly kind: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly simulated: boolean;
}

export interface PerformancePlaneProjection {
  readonly solutionId: string;
  /** performanceId -> authoritative performance facts. */
  readonly performances: Readonly<Record<string, PerformanceLedgerPerformanceEntry>>;
  /** jobId -> render job facts. */
  readonly renderJobs: Readonly<Record<string, PerformanceLedgerJobEntry>>;
  /** artifactId -> artifact facts (content-addressed; never inlined content). */
  readonly artifacts: Readonly<Record<string, PerformanceLedgerArtifactEntry>>;
  /** reviewId -> review status (last transition wins). */
  readonly reviews: Readonly<Record<string, string>>;
  /** artifactId -> latest reviewId (supersession-aware). */
  readonly currentReviewOfArtifact: Readonly<Record<string, string>>;
  /** superseded reviewId -> replacing reviewId (linkage, never an overwrite). */
  readonly supersededBy: Readonly<Record<string, string>>;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Folds performance-plane ledger events into the authoritative
 * projection. Same events => same projection (byte-identical under
 * stableStringify).
 */
export function replayPerformanceLedger(events: readonly SolutionEvent[]): PerformancePlaneProjection {
  if (events.length === 0) {
    throw new Error("replayPerformanceLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const performances: Record<string, PerformanceLedgerPerformanceEntry> = {};
  const renderJobs: Record<string, PerformanceLedgerJobEntry> = {};
  const artifacts: Record<string, PerformanceLedgerArtifactEntry> = {};
  const reviews: Record<string, string> = {};
  const currentReviewOfArtifact: Record<string, string> = {};
  const supersededBy: Record<string, string> = {};

  for (const event of events) {
    switch (event.type) {
      case "performance-published": {
        const performanceId = textPayload(event, "performanceId");
        if (performanceId !== undefined) {
          performances[performanceId] = {
            twinVersionId: textPayload(event, "twinVersionId") ?? "",
            basedOnTemplateId: textPayload(event, "basedOnTemplateId") ?? "",
            timelineId: textPayload(event, "timelineId") ?? "",
            cueCount: numberPayload(event, "cueCount") ?? 0,
            durationMs: numberPayload(event, "durationMs") ?? 0,
          };
        }
        break;
      }
      case "render-job-submitted": {
        const jobId = textPayload(event, "jobId");
        if (jobId !== undefined) {
          renderJobs[jobId] = {
            status: "queued",
            method: textPayload(event, "method") ?? "",
            performanceId: textPayload(event, "performanceId") ?? "",
            outputKinds: (textPayload(event, "outputKinds") ?? "").split(",").filter((kind) => kind !== ""),
            artifactIds: [],
          };
        }
        break;
      }
      case "render-job-completed": {
        const jobId = textPayload(event, "jobId");
        if (jobId !== undefined) {
          const existing = renderJobs[jobId];
          const artifactCount = numberPayload(event, "artifactCount") ?? 0;
          const artifactIds: string[] = existing?.artifactIds ?? [];
          for (let index = 0; index < artifactCount; index += 1) {
            const artifactId = textPayload(event, `artifact.${index}.id`);
            const kind = textPayload(event, `artifact.${index}.kind`);
            const contentRef = textPayload(event, `artifact.${index}.contentRef`);
            const contentHash = textPayload(event, `artifact.${index}.contentHash`);
            if (artifactId === undefined || kind === undefined || contentRef === undefined || contentHash === undefined) {
              continue;
            }
            artifacts[artifactId] = { jobId, kind, contentRef, contentHash, simulated: true };
            artifactIds.push(artifactId);
          }
          renderJobs[jobId] = {
            status: textPayload(event, "statusAfter") ?? existing?.status ?? "failed",
            method: existing?.method ?? "",
            performanceId: existing?.performanceId ?? "",
            outputKinds: existing?.outputKinds ?? [],
            artifactIds,
          };
        }
        break;
      }
      case "render-artifact-reviewed": {
        const reviewId = textPayload(event, "reviewId");
        const artifactId = textPayload(event, "artifactId");
        const reviewStatus = textPayload(event, "reviewStatus");
        if (reviewId !== undefined && reviewStatus !== undefined) {
          reviews[reviewId] = reviewStatus;
        }
        if (reviewId !== undefined && artifactId !== undefined) {
          currentReviewOfArtifact[artifactId] = reviewId;
        }
        const superseded = textPayload(event, "supersedesReviewId");
        if (superseded !== undefined && superseded !== "" && reviewId !== undefined) {
          supersededBy[superseded] = reviewId;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    performances,
    renderJobs,
    artifacts,
    reviews,
    currentReviewOfArtifact,
    supersededBy,
  };
}
