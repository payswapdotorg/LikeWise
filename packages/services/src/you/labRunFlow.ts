// YOU lab service — the LabRun ladder flow (W9A): experiment-gated run
// submission (the arm must be one of the experiment's declared
// three-arm-law arms) and immutable ladder advancement (submitted ->
// running -> succeeded | failed | retired, terminals locked). Every
// transition appends lab-run-recorded; the run record is replaced
// immutably, never mutated (the W7A AvatarSession replacement
// precedent); the per-experiment run list is append-only.

import type { LabArmKind, LabRun, LabRunStatus, OpaqueId } from "@zcode/shared";
import {
  advanceLabRun,
  constructLabRun,
  labRunTransitionRefusal,
  validateLabRunInput,
} from "../../../shared/src/you/labRunLadder.js";
import { appendLabRunRecorded } from "./labLedgerOps.js";
import {
  isDeclaredArm,
  labFailure,
  requireLabExperiment,
  requireLabRun,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/**
 * Submits a new run of an experiment arm (the append-only ladder).
 * Gates: the experiment must exist (typed
 * YOU_LAB_EXPERIMENT_NOT_FOUND); the arm must be one of the
 * experiment's declared arms (typed YOU_INVALID_STATE,
 * "arm-not-declared"); the intake shape (typed YOU_INVALID_STATE with
 * the validator's stable refusal). Emits lab-run-recorded
 * (statusAfter "submitted", declaration facts ride along).
 */
export function submitLabRunOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  experimentId: OpaqueId,
  input: { readonly arm: LabArmKind; readonly planHash: string },
): LabServiceResult<{ readonly run: LabRun }> {
  const found = requireLabExperiment(plane, experimentId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const experiment = found.experiment;
  if (!isDeclaredArm(experiment, input.arm)) {
    return labFailure("YOU_INVALID_STATE", `arm "${input.arm}" is not declared on the experiment`, {
      reason: "arm-not-declared",
      experimentId,
      arm: input.arm,
    });
  }
  const intake = { experimentId, arm: input.arm, planHash: input.planHash };
  const refusal = validateLabRunInput(intake);
  if (refusal !== null) {
    return labFailure("YOU_INVALID_STATE", `lab run intake refused: ${refusal.detail}`, {
      reason: "invalid-run-intake",
      refusal: refusal.reason,
    });
  }
  const run = constructLabRun(intake, { now: () => deps.clock.now(), nextId: deps.ids.next });
  plane.runs.set(run.id, run);
  const ladder = plane.runIdsByExperiment.get(experimentId) ?? [];
  ladder.push(run.id);
  plane.runIdsByExperiment.set(experimentId, ladder);
  appendLabRunRecorded(plane, run, experiment, "");
  return { ok: true, value: { run } };
}

/**
 * Applies a legal ladder step to a run (immutable record replacement).
 * Emits lab-run-recorded. Refusals: typed YOU_LAB_RUN_NOT_FOUND for
 * unknown runs; typed YOU_INVALID_STATE with the ladder's stable
 * reason for locked terminals, no-ops and off-ladder moves.
 */
export function advanceLabRunOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  runId: OpaqueId,
  to: LabRunStatus,
): LabServiceResult<{ readonly run: LabRun }> {
  const found = requireLabRun(plane, runId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const current = found.run;
  const refusal = labRunTransitionRefusal(current.status, to);
  if (refusal !== null) {
    return labFailure("YOU_INVALID_STATE", `lab run transition ${current.status} -> ${to} refused: ${refusal}`, {
      reason: refusal,
      runId,
      status: current.status,
    });
  }
  const experiment = plane.experiments.get(current.experimentId);
  if (experiment === undefined) {
    return labFailure("YOU_LAB_EXPERIMENT_NOT_FOUND", "lab run references an unknown experiment", {
      reason: "unknown-experiment",
      experimentId: current.experimentId,
      runId,
    });
  }
  const after = advanceLabRun(current, to, deps.clock.now());
  plane.runs.set(runId, after);
  appendLabRunRecorded(plane, after, experiment, current.status);
  return { ok: true, value: { run: after } };
}
