// YOU lab service — the LabRun ladder flow (W9A): experiment-gated run
// submissions (the arm must be one of the experiment's declared arms —
// the three-arm law) and immutable ladder transitions (submitted ->
// running -> succeeded | failed | retired, terminals locked). Every
// transition appends lab-run-recorded; the run record is replaced
// immutably, never mutated (the W7A/W8A replacement precedent); the
// per-experiment run list is append-only (LAB PERSISTENCE LAW).

import type { LabArmKind, LabRun, LabRunStatus, OpaqueId } from "@zcode/shared";
import {
  applyLabRunTransition,
  constructLabRun,
  labRunTransitionRefusal,
  validateLabRunInput,
} from "../../../shared/src/you/labRunLadder.js";
import { appendLabRunRecorded } from "./labLedgerOps.js";
import {
  labFailure,
  requireLabExperiment,
  requireLabRun,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/**
 * Submits a new run of an experiment arm (born "submitted"). Gates: the
 * experiment must exist (typed YOU_LAB_EXPERIMENT_NOT_FOUND); the arm
 * must be one of the experiment's declared arms (typed YOU_INVALID_STATE
 * "arm-not-declared"); intake shape (typed YOU_INVALID_STATE with the
 * validator's reason). Emits lab-run-recorded (statusAfter "submitted").
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
  if (!found.experiment.arms.includes(input.arm)) {
    return labFailure("YOU_INVALID_STATE", "run arm is not among the experiment's declared arms", {
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
  const ladder = plane.runsByExperiment.get(experimentId) ?? [];
  ladder.push(run.id);
  plane.runsByExperiment.set(experimentId, ladder);
  appendLabRunRecorded(plane, run, "");
  return { ok: true, value: { run } };
}

/**
 * Applies a ladder transition to a run (immutable record replacement).
 * Emits lab-run-recorded. Refusals: typed YOU_LAB_RUN_NOT_FOUND for
 * unknown runs; typed YOU_INVALID_STATE with the ladder's stable reason
 * for locked terminals, no-ops and off-ladder moves.
 */
export function transitionLabRunOp(
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
  const after = applyLabRunTransition(current, to, deps.clock.now());
  plane.runs.set(runId, after);
  appendLabRunRecorded(plane, after, current.status);
  return { ok: true, value: { run: after } };
}
