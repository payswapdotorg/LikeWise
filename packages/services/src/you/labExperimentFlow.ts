// YOU lab service — LabExperiment declaration flow (W9A): the durable
// experiment container. Intake runs the three-arm-law validator and
// maps refusals to typed errors BEFORE the throwing constructor (the
// W8A arenaGapFlow precedent); the record is immutable once declared;
// the ONLY later change is the promotion head linkage (immutable
// replacement — see labPromotionFlow.ts). The declaration itself
// appends no ledger event (the frozen wave-9 event set has no
// experiment-declaration event): experiments materialize in the
// ledger through their runs (the W6A service-state precedent), with
// the declaration facts riding every lab-run-recorded payload.

import type { LabExperiment } from "@zcode/shared";
import {
  constructLabExperiment,
  validateLabExperimentInput,
  type LabExperimentInput,
} from "../../../shared/src/you/labExperiment.js";
import {
  labFailure,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/**
 * Declares an immutable LabExperiment (three-arm law enforced). The
 * record lands as durable service state; the ledger sees it through
 * the experiment's runs. Refusals: typed YOU_INVALID_STATE for intake
 * shape (the three-arm law and the declaration gates).
 */
export function declareLabExperimentOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  input: LabExperimentInput,
): LabServiceResult<{ readonly experiment: LabExperiment }> {
  const refusal = validateLabExperimentInput(input);
  if (refusal !== null) {
    return labFailure("YOU_INVALID_STATE", `lab experiment intake refused: ${refusal.detail}`, {
      reason: "invalid-experiment-intake",
      refusal: refusal.reason,
    });
  }
  const experiment = constructLabExperiment(input, {
    nextId: (kind: string) => deps.ids.next(kind),
  });
  plane.experiments.set(experiment.id, experiment);
  return { ok: true, value: { experiment } };
}

/** Re-applies an immutable experiment head (the promotion linkage walk). */
export function storeLabExperimentHead(plane: LabPlaneRecord, experiment: LabExperiment): void {
  plane.experiments.set(experiment.id, experiment);
}
