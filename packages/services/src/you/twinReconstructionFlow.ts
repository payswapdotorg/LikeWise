// YOU twin service — reconstruction job lifecycle flow (W3A —
// docs/you/CONTRACTS.md "Reconstruction is provider-neutral and
// method-plural"; the job state machine lives in the twin application
// service, adapters are never authorities).
//
// Legal transitions (shared/src/you/reconstruction.ts):
//   queued -> running | failed
//   running -> completed | failed
//   completed / failed are terminal.
// Illegal transitions are typed YOU_INVALID_STATE refusals (no state
// change). Submit validates the method/domain combination against the
// fixture support matrix — unsupported combinations are typed
// YOU_RECONSTRUCTION_UNSUPPORTED errors, never a silent method fallback.
// Fixture reconstruction is deterministic (seeded from the spec + bound
// evidence hashes) and every produced block stays `simulated: true`;
// effortObservations carry explicit not-measured markers — no invented
// numbers.

import type { HtirDomainBlock, HtirDomainKind, OpaqueId, ReconstructionJobResult, ReconstructionJobSpec, ReconstructionMethod, TwinEvidenceBinding, TwinVersion } from "@zcode/shared";
import {
  buildReconstructionJobResult,
  createReconstructionJobSpec,
  fixtureReconstruct,
  isLegalReconstructionJobTransition,
} from "../../../shared/src/you/reconstruction.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { appendReconstructionJobCompleted, appendReconstructionJobSubmitted } from "./twinLedgerOps.js";
import type { ReconstructionJobState, TwinPlaneRecord, TwinServiceDeps, TwinServiceResult } from "./twinServiceTypes.js";
import { twinFailure } from "./twinServiceTypes.js";

export interface SubmitReconstructionJobInput {
  readonly twinVersionId: OpaqueId;
  readonly method: ReconstructionMethod;
  readonly targetDomains: readonly HtirDomainKind[];
  /** Evidence bindings carried by the job (consent-enforced upstream). */
  readonly evidenceBindings: readonly TwinEvidenceBinding[];
  readonly provenanceSource?: string;
}

/** Submits a reconstruction job: validates support, creates the immutable spec, queues it. */
export function submitReconstructionJobOp(
  plane: TwinPlaneRecord,
  deps: TwinServiceDeps,
  input: SubmitReconstructionJobInput,
): TwinServiceResult<{ readonly spec: ReconstructionJobSpec }> {
  const created = createReconstructionJobSpec(
    {
      twinVersionId: input.twinVersionId,
      method: input.method,
      targetDomains: input.targetDomains,
      evidenceBindings: input.evidenceBindings,
      provenanceSource: input.provenanceSource ?? "fixture:reconstruction-request",
    },
    deps,
  );
  if (!created.ok) {
    if (created.code === "unsupported-combination") {
      return twinFailure("YOU_RECONSTRUCTION_UNSUPPORTED", `unsupported reconstruction method/domain combination: ${created.detail}`, {
        reason: "unsupported-method-domain-combination",
        method: input.method,
        unsupportedDomains: created.unsupportedDomains.join(","),
        detail: created.detail,
      });
    }
    return twinFailure("YOU_INVALID_STATE", created.detail, {
      reason: created.code,
      method: input.method,
    });
  }
  const state: ReconstructionJobState = { spec: created.spec, status: "queued", result: null };
  plane.jobs.set(created.spec.id, state);
  appendReconstructionJobSubmitted(plane, created.spec);
  return { ok: true, value: { spec: created.spec } };
}

function requireJob(plane: TwinPlaneRecord, jobId: OpaqueId): TwinServiceResult<ReconstructionJobState> {
  const state = plane.jobs.get(jobId);
  return state === undefined
    ? twinFailure("YOU_INVALID_STATE", "unknown reconstruction job", { reason: "unknown-reconstruction-job", jobId })
    : { ok: true, value: state };
}

function transitionJob(
  plane: TwinPlaneRecord,
  jobId: OpaqueId,
  to: ReconstructionJobState["status"],
): TwinServiceResult<ReconstructionJobState> {
  const found = requireJob(plane, jobId);
  if (!found.ok) {
    return found;
  }
  const state = found.value;
  if (!isLegalReconstructionJobTransition(state.status, to)) {
    return twinFailure("YOU_INVALID_STATE", `illegal reconstruction job transition ${state.status} -> ${to}`, {
      reason: "illegal-reconstruction-job-transition",
      jobId,
      fromStatus: state.status,
      toStatus: to,
    });
  }
  state.status = to;
  return { ok: true, value: state };
}

/** Starts a queued job (queued -> running). */
export function startReconstructionJobOp(
  plane: TwinPlaneRecord,
  jobId: OpaqueId,
): TwinServiceResult<{ readonly status: ReconstructionJobState["status"] }> {
  const transitioned = transitionJob(plane, jobId, "running");
  if (!transitioned.ok) {
    return transitioned;
  }
  return { ok: true, value: { status: transitioned.value.status } };
}

/**
 * Completes a running job (running -> completed): runs the deterministic
 * fixture reconstruction, builds the honest result and appends
 * reconstruction-job-completed.
 */
export function completeReconstructionJobOp(
  plane: TwinPlaneRecord,
  deps: TwinServiceDeps,
  store: EvidenceContentStore,
  jobId: OpaqueId,
): TwinServiceResult<{ readonly result: ReconstructionJobResult }> {
  const transitioned = transitionJob(plane, jobId, "completed");
  if (!transitioned.ok) {
    return transitioned;
  }
  const state = transitioned.value;
  const blocks = fixtureReconstruct({ spec: state.spec, clock: deps.clock, ids: deps.ids, store });
  const result = buildReconstructionJobResult({
    spec: state.spec,
    status: "completed",
    producedDomainBlocks: blocks,
    completedAt: deps.clock.now(),
  });
  state.result = result;
  appendReconstructionJobCompleted(plane, result);
  return { ok: true, value: { result } };
}

/** Fails a queued/running job (typed reason; no produced blocks). */
export function failReconstructionJobOp(
  plane: TwinPlaneRecord,
  deps: TwinServiceDeps,
  jobId: OpaqueId,
  reason: string,
): TwinServiceResult<{ readonly result: ReconstructionJobResult }> {
  const transitioned = transitionJob(plane, jobId, "failed");
  if (!transitioned.ok) {
    return transitioned;
  }
  const state = transitioned.value;
  const result = buildReconstructionJobResult({
    spec: state.spec,
    status: "failed",
    producedDomainBlocks: [],
    failureReason: reason,
    completedAt: deps.clock.now(),
  });
  state.result = result;
  appendReconstructionJobCompleted(plane, result);
  return { ok: true, value: { result } };
}

/** The job's produced blocks (empty until a completed result exists). */
export function producedBlocksOf(state: ReconstructionJobState): readonly HtirDomainBlock[] {
  return state.result?.producedDomainBlocks ?? [];
}

/** The input version a job was submitted against (for publish-from-job flows). */
export function jobTargetVersion(state: ReconstructionJobState, versions: readonly TwinVersion[]): TwinVersion | null {
  return versions.find((version) => version.id === state.spec.twinVersionId) ?? null;
}
