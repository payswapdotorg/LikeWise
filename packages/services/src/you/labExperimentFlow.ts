// YOU lab service — LabExperiment declaration flow (W9A). The ops live
// here; labService.ts is the single authority that dispatches into them
// (the W1A/W6A/W8A flow precedent). The experiment is the durable
// container: one intent + one constraint set, compared across the three
// LAB.md arms. Records are immutable once declared (LAB PERSISTENCE
// LAW).
//
// Experiments are SERVICE STATE (the W8A retry-policy/provider
// precedent): the frozen v9 event set has no experiment event type, so
// declaration emits NOTHING — experiment facts materialize in the
// ledger only through the events that reference them (lab-run-recorded
// / lab-promotion-decided carry experimentId) and stay readable through
// the service seam.

import type { LabArmKind, LabExperiment, OpaqueId } from "@zcode/shared";
import { constructLabExperiment, validateLabExperimentInput } from "../../../shared/src/you/labExperiment.js";
import { labFailure, type LabFlowDeps, type LabPlaneRecord, type LabServiceResult } from "./labServiceTypes.js";

/** Experiment intake (the durable container facts — see shared/src/you/labExperiment.ts). */
export interface LabExperimentIntakeInput {
  readonly intentRef: OpaqueId;
  readonly constraintsHash: string;
  readonly objective: string;
  readonly arms: readonly LabArmKind[];
}

/**
 * Declares an immutable LabExperiment (the three-arm law enforced by the
 * shared validator). No event is emitted (service state — the W8A
 * policy/provider precedent; the frozen v9 event set has no experiment
 * event). Refusals: typed YOU_INVALID_STATE for intake shape with the
 * validator's stable reason.
 */
export function declareLabExperimentOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  input: LabExperimentIntakeInput,
): LabServiceResult<{ readonly experiment: LabExperiment }> {
  const refusal = validateLabExperimentInput({
    intentRef: input.intentRef,
    constraintsHash: input.constraintsHash,
    objective: input.objective,
    arms: input.arms,
  });
  if (refusal !== null) {
    return labFailure("YOU_INVALID_STATE", `lab experiment intake refused: ${refusal.detail}`, {
      reason: "invalid-experiment-intake",
      refusal: refusal.reason,
    });
  }
  const experiment = constructLabExperiment(
    {
      intentRef: input.intentRef,
      constraintsHash: input.constraintsHash,
      objective: input.objective,
      arms: input.arms,
    },
    { nextId: deps.ids.next },
  );
  plane.experiments.set(experiment.id, experiment);
  return { ok: true, value: { experiment } };
}
