// YOU performance application service — the single authority over
// performance/render truth (docs/you/CONTRACTS.md "State ownership":
// Performance = the performance/render application service, W4A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one performance plane per solution
// (append-only SolutionEventLedger + immutable performances + the
// template library + render jobs + content-addressed artifacts + the
// artifact-review registry) and the performance content store. Render
// methods register behind the injected RenderMethodRegistry seam (the
// W4C adapter lane; default = the frozen fixture support matrix). Phase
// 0 is fully deterministic: injected clock + seeded RNG; everything
// simulated stays labeled `simulated: true` (truth law).
//
// Cross-plane bindings stay opaque: a Performance records the
// twinVersionId as given (the wave-3 twin service owns twin truth; the
// frozen wave-4 error set defines no twin-version lookup error for this
// plane). Consent for evidence-bound render inputs (none in W4A scope)
// would delegate to the frozen wave-2 consent authority — no second
// consent path exists here.

import type {
  OpaqueId,
  Performance,
  PerformanceTemplate,
  PerformanceTimeline,
  PerformanceTrackKind,
  RenderArtifact,
  RenderArtifactReview,
  RenderJobResult,
  RenderJobSpec,
  RenderMethod,
  RenderOutputKind,
  SolutionEvent,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { replayPerformanceLedger, type PerformancePlaneProjection } from "../../../shared/src/you/performanceLedger.js";
import {
  createPerformanceCue,
  createPerformanceTimeline,
  validatePerformanceTimeline,
} from "../../../shared/src/you/performanceTimeline.js";
import {
  createPerformanceTemplate,
  instantiatePerformanceTemplate,
  type ParameterRecord,
} from "../../../shared/src/you/performanceTemplate.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash, deepFreeze } from "../../../shared/src/you/serialize.js";
import { appendPerformanceInstantiated, appendPerformancePublished } from "./performanceLedgerOps.js";
import { buildPerformancePlaneProjection } from "./performanceProjection.js";
import {
  artifactsOfJobOp,
  completeRenderJobOp,
  failRenderJobOp,
  startRenderJobOp,
  submitRenderJobOp,
} from "./performanceRenderFlow.js";
import {
  currentReviewOfArtifactOp,
  reReviewRenderArtifactOp,
  resolveRenderArtifactReviewOp,
  reviewRenderArtifactOp,
  reviewsOfArtifactOp,
  supersedePendingRenderArtifactReviewOp,
} from "./performanceArtifactReviewFlow.js";
import type {
  PerformanceContentDeps,
  PerformancePlaneRecord,
  PerformanceServiceResult,
  RenderMethodRegistry,
} from "./performanceServiceTypes.js";
import { createFixtureRenderMethodRegistry, performanceFailure, sortedIds } from "./performanceServiceTypes.js";

export interface PerformanceServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  readonly contentStore?: EvidenceContentStore;
  /** Render-method registry seam (W4C adapter lane); default = frozen fixture matrix. */
  readonly methodRegistry?: RenderMethodRegistry;
}

/** Fixture cue spec for deterministic timeline synthesis. */
export interface FixtureCueSpec {
  readonly track: PerformanceTrackKind;
  readonly startMs: number;
  readonly endMs: number;
}

/** The application-service authority over performance/render truth. */
export class PerformanceService {
  private readonly planes = new Map<OpaqueId, PerformancePlaneRecord>();
  private readonly deps: PerformanceServiceDepsBundle;
  private readonly contentStore: EvidenceContentStore;
  private readonly methodRegistry: RenderMethodRegistry;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
    methodRegistry: RenderMethodRegistry,
  ) {
    this.deps = { clock, ids };
    this.contentStore = contentStore;
    this.methodRegistry = methodRegistry;
  }

  /** Creates a deterministic service (injected clock + seeded ids/content). */
  static create(config: PerformanceServiceConfig): PerformanceService {
    const seed = config.seed ?? "you-w4a-performance-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new PerformanceService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
      config.methodRegistry ?? createFixtureRenderMethodRegistry(),
    );
  }

  // -- templates -----------------------------------------------------------

  /** Registers an immutable PerformanceTemplate (name uniqueness enforced). */
  registerTemplate(
    solutionId: OpaqueId,
    input: { readonly name: string; readonly timeline: PerformanceTimeline; readonly parameters?: ParameterRecord },
  ): PerformanceServiceResult<{ readonly template: PerformanceTemplate }> {
    const plane = this.planeFor(solutionId);
    const name = input.name.trim();
    if (plane.templateIdsByName.has(name)) {
      return performanceFailure("YOU_INVALID_STATE", `a performance template named "${name}" already exists`, {
        reason: "duplicate-template-name",
        templateName: name,
        templateId: plane.templateIdsByName.get(name) ?? "",
      });
    }
    const created = createPerformanceTemplate({ name, timeline: input.timeline, parameters: input.parameters }, this.deps);
    if (!created.ok) {
      if (created.code === "invalid-timeline") {
        return this.timelineInvalid(created.detail, created.refusal);
      }
      return performanceFailure("YOU_INVALID_STATE", created.detail, { reason: created.code, templateName: name });
    }
    plane.templates.set(created.template.id, created.template);
    plane.templateIdsByName.set(created.template.name, created.template.id);
    return { ok: true, value: { template: created.template } };
  }

  /** Deterministic template instantiation (timeline VERBATIM; bound parameters returned). */
  instantiateTemplate(
    solutionId: OpaqueId,
    templateId: OpaqueId,
    input: { readonly twinVersionId: OpaqueId; readonly parameters?: ParameterRecord },
  ): PerformanceServiceResult<{ readonly performance: Performance; readonly parameters: ParameterRecord }> {
    const plane = this.planeFor(solutionId);
    const template = plane.templates.get(templateId);
    if (template === undefined) {
      return performanceFailure("YOU_INVALID_STATE", "unknown performance template", {
        reason: "unknown-performance-template",
        templateId,
      });
    }
    const made = instantiatePerformanceTemplate(template, input, this.deps);
    if (!made.ok) {
      return performanceFailure("YOU_INVALID_STATE", made.detail, {
        reason: made.code,
        templateId,
        parameterKey: made.key,
      });
    }
    plane.performances.set(made.performance.id, made.performance);
    appendPerformanceInstantiated(plane, made.performance, made.parameters);
    return { ok: true, value: { performance: made.performance, parameters: made.parameters } };
  }

  templateOf(solutionId: OpaqueId, templateId: OpaqueId): PerformanceServiceResult<{ readonly template: PerformanceTemplate }> {
    const plane = this.planeFor(solutionId);
    const template = plane.templates.get(templateId);
    return template === undefined
      ? performanceFailure("YOU_INVALID_STATE", "unknown performance template", { reason: "unknown-performance-template", templateId })
      : { ok: true, value: { template } };
  }

  /** All templates, ordered by name (library listing; not ledger truth). */
  templatesOf(solutionId: OpaqueId): readonly PerformanceTemplate[] {
    const plane = this.planeFor(solutionId);
    return [...plane.templates.values()].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  }

  // -- performances ----------------------------------------------------------

  /** Publishes an immutable Performance bound to a twin version (append-only). */
  publishPerformance(
    solutionId: OpaqueId,
    input: {
      readonly twinVersionId: OpaqueId;
      readonly timeline: PerformanceTimeline;
      readonly basedOnTemplateId?: OpaqueId;
    },
  ): PerformanceServiceResult<{ readonly performance: Performance }> {
    const plane = this.planeFor(solutionId);
    const check = validatePerformanceTimeline(input.timeline);
    if (!check.ok) {
      return this.timelineInvalid(`${check.code}: ${check.detail}`, check);
    }
    const performance: Performance = deepFreeze({
      id: this.deps.ids.next("performance"),
      twinVersionId: input.twinVersionId,
      timeline: input.timeline,
      basedOnTemplateId: input.basedOnTemplateId ?? null,
      createdAt: this.deps.clock.now(),
    });
    plane.performances.set(performance.id, performance);
    appendPerformancePublished(plane, performance);
    return { ok: true, value: { performance } };
  }

  performanceOf(solutionId: OpaqueId, performanceId: OpaqueId): PerformanceServiceResult<{ readonly performance: Performance }> {
    const plane = this.planeFor(solutionId);
    const performance = plane.performances.get(performanceId);
    return performance === undefined
      ? performanceFailure("YOU_PERFORMANCE_NOT_FOUND", "unknown performance", { reason: "unknown-performance", performanceId })
      : { ok: true, value: { performance } };
  }

  performancesOf(solutionId: OpaqueId): readonly Performance[] {
    const plane = this.planeFor(solutionId);
    return sortedIds(plane.performances).map((performanceId) => plane.performances.get(performanceId)).filter((performance): performance is Performance => performance !== undefined);
  }

  // -- render jobs -----------------------------------------------------------

  /** Submits a render job (registry-validated; typed YOU_RENDER_UNSUPPORTED). */
  submitRenderJob(
    solutionId: OpaqueId,
    input: {
      readonly performanceId: OpaqueId;
      readonly method: RenderMethod;
      readonly outputKinds: readonly RenderOutputKind[];
      readonly parameters?: ParameterRecord;
    },
  ): PerformanceServiceResult<{ readonly spec: RenderJobSpec }> {
    return submitRenderJobOp(this.planeFor(solutionId), this.contentDeps(), this.methodRegistry, input);
  }

  startRenderJob(solutionId: OpaqueId, jobId: OpaqueId): PerformanceServiceResult<{ readonly status: string }> {
    return startRenderJobOp(this.planeFor(solutionId), jobId);
  }

  completeRenderJob(solutionId: OpaqueId, jobId: OpaqueId): PerformanceServiceResult<{ readonly result: RenderJobResult }> {
    return completeRenderJobOp(this.planeFor(solutionId), this.contentDeps(), jobId);
  }

  failRenderJob(solutionId: OpaqueId, jobId: OpaqueId, reason: string): PerformanceServiceResult<{ readonly result: RenderJobResult }> {
    return failRenderJobOp(this.planeFor(solutionId), this.contentDeps(), jobId, reason);
  }

  renderJobOf(
    solutionId: OpaqueId,
    jobId: OpaqueId,
  ): PerformanceServiceResult<{ readonly spec: RenderJobSpec; readonly status: string; readonly result: RenderJobResult | null }> {
    const job = this.planeFor(solutionId).jobs.get(jobId);
    return job === undefined
      ? performanceFailure("YOU_INVALID_STATE", "unknown render job", { reason: "unknown-render-job", jobId })
      : { ok: true, value: { spec: job.spec, status: job.status, result: job.result } };
  }

  // -- artifacts + reviews ------------------------------------------------------

  /** Job -> artifacts lineage (completion order). */
  artifactsOfJob(solutionId: OpaqueId, jobId: OpaqueId): PerformanceServiceResult<readonly RenderArtifact[]> {
    const plane = this.planeFor(solutionId);
    if (!plane.jobs.has(jobId)) {
      return performanceFailure("YOU_INVALID_STATE", "unknown render job", { reason: "unknown-render-job", jobId });
    }
    return { ok: true, value: artifactsOfJobOp(plane, jobId) };
  }

  artifactOf(solutionId: OpaqueId, artifactId: OpaqueId): PerformanceServiceResult<{ readonly artifact: RenderArtifact }> {
    const plane = this.planeFor(solutionId);
    const artifact = plane.artifacts.get(artifactId);
    return artifact === undefined
      ? performanceFailure("YOU_RENDER_ARTIFACT_NOT_FOUND", "unknown render artifact", { reason: "unknown-render-artifact", artifactId })
      : { ok: true, value: { artifact } };
  }

  /** Opens an artifact review (append-only immutable record). */
  reviewRenderArtifact(
    solutionId: OpaqueId,
    artifactId: OpaqueId,
    input: { readonly outcome: "pending" | "accepted" | "rejected" } = { outcome: "pending" },
  ): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
    return reviewRenderArtifactOp(this.planeFor(solutionId), this.deps, artifactId, input);
  }

  /** Resolves a pending review (pending -> accepted | rejected; record replacement). */
  resolveRenderArtifactReview(
    solutionId: OpaqueId,
    artifactId: OpaqueId,
    reviewId: OpaqueId,
    outcome: "accepted" | "rejected",
  ): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
    return resolveRenderArtifactReviewOp(this.planeFor(solutionId), artifactId, reviewId, outcome);
  }

  /** Withdraws a pending review (pending -> superseded in-record transition). */
  supersedePendingRenderArtifactReview(
    solutionId: OpaqueId,
    artifactId: OpaqueId,
    reviewId: OpaqueId,
  ): PerformanceServiceResult<{ readonly review: RenderArtifactReview }> {
    return supersedePendingRenderArtifactReviewOp(this.planeFor(solutionId), artifactId, reviewId);
  }

  /** Re-review: supersedes a RESOLVED review with a NEW review record (linkage, never overwrite). */
  reReviewRenderArtifact(
    solutionId: OpaqueId,
    artifactId: OpaqueId,
    input: { readonly outcome: "pending" | "accepted" | "rejected"; readonly supersedesReviewId: OpaqueId },
  ): PerformanceServiceResult<{ readonly review: RenderArtifactReview; readonly superseded: RenderArtifactReview }> {
    return reReviewRenderArtifactOp(this.planeFor(solutionId), this.deps, artifactId, input);
  }

  /** All reviews of an artifact, in review order (append-only history). */
  reviewsOfArtifact(solutionId: OpaqueId, artifactId: OpaqueId): readonly RenderArtifactReview[] {
    return reviewsOfArtifactOp(this.planeFor(solutionId), artifactId);
  }

  /** The latest review of an artifact (supersession-aware), or null. */
  currentReviewOfArtifact(solutionId: OpaqueId, artifactId: OpaqueId): RenderArtifactReview | null {
    return currentReviewOfArtifactOp(this.planeFor(solutionId), artifactId);
  }

  // -- fixture content -----------------------------------------------------

  /**
   * Deterministically synthesizes a timeline (fixture mode): one cue per
   * spec (canonical order), payload bytes derived from the seed text,
   * content stored through the performance content store (payloadRef +
   * sha-256 payloadHash), durationMs derived from the cues. Per-cue span
   * violations throw at construction; CROSS-cue violations (same-track
   * overlap, duration inconsistency) intentionally flow through to the
   * publish-time stateless validator — the scenario's invalid-timeline
   * refusal arrow is built on this fixture builder.
   */
  synthesizePerformanceTimeline(
    solutionId: OpaqueId,
    input: { readonly cueSpecs: readonly FixtureCueSpec[]; readonly seedText: string },
  ): PerformanceServiceResult<{ readonly timeline: PerformanceTimeline }> {
    this.planeFor(solutionId);
    if (input.cueSpecs.length === 0) {
      return performanceFailure("YOU_TIMELINE_INVALID", "a performance timeline requires at least one cue", {
        reason: "empty-timeline",
      });
    }
    const cues = [...input.cueSpecs]
      .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
      .map((spec) =>
        createPerformanceCue(
          {
            track: spec.track,
            startMs: spec.startMs,
            endMs: spec.endMs,
            rng: createDeterministicRng(
              seedFromString(`${input.seedText}:${spec.track}:${spec.startMs}:${spec.endMs}`),
            ),
          },
          { ids: this.deps.ids, store: this.contentStore },
        ),
      );
    return { ok: true, value: { timeline: createPerformanceTimeline(cues, { ids: this.deps.ids }) } };
  }

  // -- reads / projection / persistence ------------------------------------

  /** Live authoritative projection (same shape as replayPerformanceLedger output). */
  projectionOf(solutionId: OpaqueId): PerformanceServiceResult<PerformancePlaneProjection> {
    return { ok: true, value: buildPerformancePlaneProjection(this.planeFor(solutionId)) };
  }

  ledgerEventsOf(solutionId: OpaqueId): PerformanceServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): PerformanceServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): PerformanceServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Number of stored performance content refs (fixture observability). */
  contentStoreSize(): number {
    return this.contentStore.size;
  }

  /** Replays a persisted ledger through the shared performance-plane fold. */
  static replay(events: readonly SolutionEvent[]): PerformancePlaneProjection {
    return replayPerformanceLedger(events);
  }

  // -- internals -----------------------------------------------------------

  private contentDeps(): PerformanceContentDeps {
    return { clock: this.deps.clock, ids: this.deps.ids, store: this.contentStore };
  }

  private timelineInvalid(detail: string, refusal: unknown): { readonly ok: false; readonly error: import("@zcode/shared").YouError } {
    return performanceFailure("YOU_TIMELINE_INVALID", `invalid performance timeline: ${detail}`, {
      reason: "timeline-invalid",
      detail,
      refusal: stableContentHash(refusal),
    });
  }

  /** Lazily opens (and caches) the performance plane for one solution. */
  private planeFor(solutionId: OpaqueId): PerformancePlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: PerformancePlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.deps),
      performances: new Map(),
      templates: new Map(),
      templateIdsByName: new Map(),
      jobs: new Map(),
      artifacts: new Map(),
      artifactIdsByJob: new Map(),
      reviews: new Map(),
      reviewIdsByArtifact: new Map(),
      supersessionLinks: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

interface PerformanceServiceDepsBundle {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Creates the deterministic performance application service. */
export function createPerformanceService(config: PerformanceServiceConfig): PerformanceService {
  return PerformanceService.create(config);
}

export type { RenderMethodRegistry };
