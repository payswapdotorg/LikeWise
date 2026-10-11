// YOU performance application service — shared internal types and helpers.
//
// The application service (performanceService.ts) is the single authority
// over performance/render truth (docs/you/CONTRACTS.md "State ownership":
// Performance = the performance/render application service, Worker A
// lane). The flow modules (performanceRenderFlow.ts,
// performanceArtifactReviewFlow.ts) operate on the per-solution
// performance-plane records it owns, mutating only through immutable
// record replacement + append-only ledger events (performanceLedgerOps.ts).
//
// Render methods are registered by the adapter lane (W4C) behind the
// RenderMethodRegistry seam; the service never falls back to an
// unregistered or mismatched method (typed YOU_RENDER_UNSUPPORTED). The
// default registry is the frozen fixture support matrix
// (shared/src/you/renderJob.ts FIXTURE_RENDER_SUPPORT).
//
// Cross-plane note: a Performance binds a TwinVersion by opaque id
// (twinVersionId). The wave-4 frozen error set defines no twin-version
// lookup error for this plane, so the binding is recorded as given; twin
// truth stays owned by the wave-3 twin service. Consent for evidence-
// bound render inputs (none exist in the W4A scope) would delegate to
// the frozen wave-2 consent authority — no second consent path here.

import type {
  OpaqueId,
  Performance,
  PerformanceTemplate,
  RenderArtifact,
  RenderArtifactReview,
  RenderJobResult,
  RenderJobSpec,
  RenderJobStatus,
  RenderMethod,
  RenderOutputKind,
  YouError,
} from "@zcode/shared";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import { FIXTURE_RENDER_SUPPORT } from "../../../shared/src/you/renderJob.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type PerformanceServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function performanceFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface PerformanceServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Runtime state of one render job (the spec is immutable). */
export interface RenderJobState {
  readonly spec: RenderJobSpec;
  status: RenderJobStatus;
  result: RenderJobResult | null;
}

/**
 * Registry seam over the render adapter lane (W4C): resolves the support
 * record of a method, or null when the method is not registered.
 */
export interface RenderMethodRegistry {
  resolve(method: RenderMethod): { readonly supportedOutputKinds: readonly RenderOutputKind[] } | null;
}

/** The frozen fixture registry (default): backed by FIXTURE_RENDER_SUPPORT. */
export function createFixtureRenderMethodRegistry(): RenderMethodRegistry {
  return {
    resolve(method: RenderMethod) {
      const supported = FIXTURE_RENDER_SUPPORT[method];
      return supported === undefined ? null : { supportedOutputKinds: supported };
    },
  };
}

/**
 * One solution's performance plane: ledger, performances, the template
 * library, render jobs, artifacts and the artifact-review registry. The
 * service is the sole writer; flows receive the record and return new
 * immutable values. Template library state (names) is service state, not
 * ledger truth — the frozen wave-4 event set has no template event;
 * template USAGE is journaled through performance-published
 * (basedOnTemplateId linkage).
 */
export interface PerformancePlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** performanceId -> immutable Performance (append-only). */
  readonly performances: Map<OpaqueId, Performance>;
  /** templateId -> immutable PerformanceTemplate. */
  readonly templates: Map<OpaqueId, PerformanceTemplate>;
  /** template name -> templateId (name uniqueness authority). */
  readonly templateIdsByName: Map<string, OpaqueId>;
  /** jobId -> render job runtime state. */
  readonly jobs: Map<OpaqueId, RenderJobState>;
  /** artifactId -> immutable RenderArtifact (append-only). */
  readonly artifacts: Map<OpaqueId, RenderArtifact>;
  /** jobId -> artifact ids in completion order (lineage). */
  readonly artifactIdsByJob: Map<OpaqueId, OpaqueId[]>;
  /** reviewId -> immutable RenderArtifactReview (append-only). */
  readonly reviews: Map<OpaqueId, RenderArtifactReview>;
  /** artifactId -> review ids in review order. */
  readonly reviewIdsByArtifact: Map<OpaqueId, OpaqueId[]>;
  /** superseded reviewId -> replacing reviewId (linkage, never an overwrite). */
  readonly supersessionLinks: Map<OpaqueId, OpaqueId>;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedIds<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The performance lookup helper (typed YOU_PERFORMANCE_NOT_FOUND). */
export function requirePerformance(
  plane: PerformancePlaneRecord,
  performanceId: OpaqueId,
): { readonly performance: Performance } | { readonly error: YouError } {
  const performance = plane.performances.get(performanceId);
  if (performance === undefined) {
    return {
      error: {
        code: "YOU_PERFORMANCE_NOT_FOUND",
        message: "unknown performance",
        details: { reason: "unknown-performance", performanceId },
        simulated: true,
      },
    };
  }
  return { performance };
}

/** The artifact lookup helper (typed YOU_RENDER_ARTIFACT_NOT_FOUND). */
export function requireArtifact(
  plane: PerformancePlaneRecord,
  artifactId: OpaqueId,
): { readonly artifact: RenderArtifact } | { readonly error: YouError } {
  const artifact = plane.artifacts.get(artifactId);
  if (artifact === undefined) {
    return {
      error: {
        code: "YOU_RENDER_ARTIFACT_NOT_FOUND",
        message: "unknown render artifact",
        details: { reason: "unknown-render-artifact", artifactId },
        simulated: true,
      },
    };
  }
  return { artifact };
}

/** Shared deps bundle for flows that construct content-addressed records. */
export interface PerformanceContentDeps extends PerformanceServiceDeps {
  readonly store: EvidenceContentStore;
}
