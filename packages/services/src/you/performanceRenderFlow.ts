// YOU performance service — render job lifecycle flow (W4A —
// docs/you/CONTRACTS.md "render jobs turn performances into reviewed
// artifacts"; the job state machine lives in the performance application
// service, adapters are never authorities).
//
// Legal transitions (shared/src/you/renderJob.ts):
//   queued -> running | failed
//   running -> completed | failed
//   completed / failed are terminal.
// Illegal transitions are typed YOU_INVALID_STATE refusals (no state
// change). Submit resolves the method through the registry seam — an
// unregistered method or an unsupported method/outputKinds combination
// is a typed YOU_RENDER_UNSUPPORTED error, never a silent fallback.
// Completion runs the deterministic fixture render (seeded from the spec
// + the performed timeline's cue payload hashes); every produced
// artifact is content-addressed through the wave-2 store abstraction and
// stays `simulated: true`; effortObservations carry explicit
// not-measured markers — no invented numbers.

import type { OpaqueId, RenderArtifact, RenderJobResult, RenderJobSpec, RenderJobStatus, RenderMethod, RenderOutputKind } from "@zcode/shared";
import {
  buildRenderJobResult,
  createRenderJobSpec,
  fixtureRenderArtifacts,
  isLegalRenderJobTransition,
} from "../../../shared/src/you/renderJob.js";
import type { ParameterRecord } from "../../../shared/src/you/performanceTemplate.js";
import { appendRenderJobCompleted, appendRenderJobSubmitted } from "./performanceLedgerOps.js";
import type {
  PerformanceContentDeps,
  PerformancePlaneRecord,
  PerformanceServiceResult,
  RenderJobState,
  RenderMethodRegistry,
} from "./performanceServiceTypes.js";
import { performanceFailure, requirePerformance } from "./performanceServiceTypes.js";

export interface SubmitRenderJobInput {
  readonly performanceId: OpaqueId;
  readonly method: RenderMethod;
  readonly outputKinds: readonly RenderOutputKind[];
  readonly parameters?: ParameterRecord;
}

/**
 * Submits a render job: resolves the performance (typed
 * YOU_PERFORMANCE_NOT_FOUND), validates the method registration and
 * output-kind support through the registry seam (typed
 * YOU_RENDER_UNSUPPORTED), creates the immutable spec and queues it.
 */
export function submitRenderJobOp(
  plane: PerformancePlaneRecord,
  deps: PerformanceContentDeps,
  registry: RenderMethodRegistry,
  input: SubmitRenderJobInput,
): PerformanceServiceResult<{ readonly spec: RenderJobSpec }> {
  const found = requirePerformance(plane, input.performanceId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const support = registry.resolve(input.method);
  const created = createRenderJobSpec(
    {
      performanceId: input.performanceId,
      method: input.method,
      outputKinds: input.outputKinds,
      parameters: input.parameters,
    },
    deps,
    { registered: support !== null, supportedOutputKinds: support?.supportedOutputKinds ?? [] },
  );
  if (!created.ok) {
    if (created.code === "unregistered-method" || created.code === "unsupported-output-kinds") {
      return performanceFailure("YOU_RENDER_UNSUPPORTED", `unsupported render method/output combination: ${created.detail}`, {
        reason: created.code,
        method: input.method,
        ...(created.code === "unsupported-output-kinds" ? { unsupportedKinds: created.unsupportedKinds.join(",") } : {}),
        detail: created.detail,
      });
    }
    return performanceFailure("YOU_INVALID_STATE", created.detail, {
      reason: created.code,
      method: input.method,
    });
  }
  const state: RenderJobState = { spec: created.spec, status: "queued", result: null };
  plane.jobs.set(created.spec.id, state);
  appendRenderJobSubmitted(plane, created.spec);
  return { ok: true, value: { spec: created.spec } };
}

function requireJob(plane: PerformancePlaneRecord, jobId: OpaqueId): PerformanceServiceResult<RenderJobState> {
  const state = plane.jobs.get(jobId);
  return state === undefined
    ? performanceFailure("YOU_INVALID_STATE", "unknown render job", { reason: "unknown-render-job", jobId })
    : { ok: true, value: state };
}

function transitionJob(
  plane: PerformancePlaneRecord,
  jobId: OpaqueId,
  to: RenderJobStatus,
): PerformanceServiceResult<RenderJobState> {
  const found = requireJob(plane, jobId);
  if (!found.ok) {
    return found;
  }
  const state = found.value;
  if (!isLegalRenderJobTransition(state.status, to)) {
    return performanceFailure("YOU_INVALID_STATE", `illegal render job transition ${state.status} -> ${to}`, {
      reason: "illegal-render-job-transition",
      jobId,
      fromStatus: state.status,
      toStatus: to,
    });
  }
  state.status = to;
  return { ok: true, value: state };
}

/** Starts a queued job (queued -> running). */
export function startRenderJobOp(
  plane: PerformancePlaneRecord,
  jobId: OpaqueId,
): PerformanceServiceResult<{ readonly status: RenderJobStatus }> {
  const transitioned = transitionJob(plane, jobId, "running");
  if (!transitioned.ok) {
    return transitioned;
  }
  return { ok: true, value: { status: transitioned.value.status } };
}

function registerArtifacts(plane: PerformancePlaneRecord, jobId: OpaqueId, artifacts: readonly RenderArtifact[]): void {
  plane.artifactIdsByJob.set(jobId, []);
  for (const artifact of artifacts) {
    plane.artifacts.set(artifact.id, artifact);
    const existing = plane.artifactIdsByJob.get(jobId) ?? [];
    plane.artifactIdsByJob.set(jobId, [...existing, artifact.id]);
  }
}

/**
 * Completes a running job (running -> completed): runs the deterministic
 * fixture render against the performed timeline, registers the immutable
 * artifacts (job -> artifacts lineage), builds the honest result and
 * appends render-job-completed.
 */
export function completeRenderJobOp(
  plane: PerformancePlaneRecord,
  deps: PerformanceContentDeps,
  jobId: OpaqueId,
): PerformanceServiceResult<{ readonly result: RenderJobResult }> {
  const transitioned = transitionJob(plane, jobId, "completed");
  if (!transitioned.ok) {
    return transitioned;
  }
  const state = transitioned.value;
  const performance = plane.performances.get(state.spec.performanceId);
  if (performance === undefined) {
    return performanceFailure("YOU_PERFORMANCE_NOT_FOUND", "unknown performance", {
      reason: "unknown-performance",
      performanceId: state.spec.performanceId,
    });
  }
  const artifacts = fixtureRenderArtifacts({
    spec: state.spec,
    performance,
    clock: deps.clock,
    ids: deps.ids,
    store: deps.store,
  });
  const result = buildRenderJobResult({
    spec: state.spec,
    status: "completed",
    artifacts,
    timelineCueCount: performance.timeline.cues.length,
    completedAt: deps.clock.now(),
  });
  state.result = result;
  registerArtifacts(plane, jobId, artifacts);
  appendRenderJobCompleted(plane, result, artifacts);
  return { ok: true, value: { result } };
}

/** Fails a queued/running job (typed reason; no artifacts). */
export function failRenderJobOp(
  plane: PerformancePlaneRecord,
  deps: PerformanceContentDeps,
  jobId: OpaqueId,
  reason: string,
): PerformanceServiceResult<{ readonly result: RenderJobResult }> {
  const transitioned = transitionJob(plane, jobId, "failed");
  if (!transitioned.ok) {
    return transitioned;
  }
  const state = transitioned.value;
  const cueCount = plane.performances.get(state.spec.performanceId)?.timeline.cues.length ?? 0;
  const result = buildRenderJobResult({
    spec: state.spec,
    status: "failed",
    artifacts: [],
    timelineCueCount: cueCount,
    failureReason: reason,
    completedAt: deps.clock.now(),
  });
  state.result = result;
  appendRenderJobCompleted(plane, result, []);
  return { ok: true, value: { result } };
}

/** The artifacts a job produced, in completion order (lineage query). */
export function artifactsOfJobOp(plane: PerformancePlaneRecord, jobId: OpaqueId): readonly RenderArtifact[] {
  const ids = plane.artifactIdsByJob.get(jobId) ?? [];
  return ids.map((artifactId) => plane.artifacts.get(artifactId)).filter((artifact): artifact is RenderArtifact => artifact !== undefined);
}
