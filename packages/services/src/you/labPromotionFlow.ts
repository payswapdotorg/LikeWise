// YOU lab service — the promotion gate flow (W9A): the LAB PROMOTION
// LAW authority. A searched arm promotes ONLY when it beats the
// generalist baseline under the experiment's recorded objective and
// constraints, with the decision grounded in a verified evidence
// manifest of the experiment's own runs. Promotion records are
// immutable; a reversal (the searched arm no longer beats under new
// evidence) is a NEW record appended to the experiment's decision
// chain — the head linkage moves through immutable experiment
// replacement, never a mutation.

import type { LabExperiment, LabPromotionRecord, OpaqueId } from "@zcode/shared";
import { attachLabExperimentPromotion } from "../../../shared/src/you/labExperiment.js";
import {
  constructLabPromotionRecord,
  evaluateLabPromotionGate,
  type LabPromotionDecisionKind,
} from "../../../shared/src/you/labPromotion.js";
import { appendLabPromotionDecided } from "./labLedgerOps.js";
import {
  labFailure,
  requireLabExperiment,
  requireLabManifest,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/** Promotion decision input (the comparison facts the law consumes). */
export interface LabPromotionDecisionInput {
  /** The searched arm's score under the recorded objective. */
  readonly objectiveScore: number;
  /** The generalist baseline's score under the recorded objective. */
  readonly baselineScore: number;
  /** The evidence manifest grounding the decision. */
  readonly evidenceManifestRef: OpaqueId;
}

/**
 * The winner arm baked per decision kind (the gate enforces it): a
 * promotion records the searched arm as winner; a reversal records the
 * standing generalist baseline.
 */
function winnerArmForKind(kind: LabPromotionDecisionKind): LabPromotionRecord["winnerArm"] {
  return kind === "promote" ? "searched" : "generalist-baseline";
}

/**
 * Decides a promotion or a reversal for an experiment (the gate law).
 * Gates in order: the experiment must exist (typed
 * YOU_LAB_EXPERIMENT_NOT_FOUND); the evidence manifest must exist
 * (typed YOU_LAB_EVIDENCE_MANIFEST_INVALID, "unknown-manifest") and
 * belong to a run of THIS experiment ("manifest-experiment-mismatch");
 * a reversal requires an existing decision to reverse (typed
 * YOU_LAB_PROMOTION_INVALID, "no-promotion-to-reverse"); the gate
 * itself refuses with the LAB PROMOTION LAW's stable reasons (typed
 * YOU_LAB_PROMOTION_INVALID). Emits lab-promotion-decided; the
 * experiment head's promotionRef walks to the new record.
 */
export function decideLabPromotionOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  experimentId: OpaqueId,
  kind: LabPromotionDecisionKind,
  input: LabPromotionDecisionInput,
): LabServiceResult<{ readonly promotion: LabPromotionRecord; readonly experiment: LabExperiment }> {
  const found = requireLabExperiment(plane, experimentId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const experiment = found.experiment;
  const manifestFound = requireLabManifest(plane, input.evidenceManifestRef);
  if ("error" in manifestFound) {
    return { ok: false, error: manifestFound.error };
  }
  const manifest = manifestFound.manifest;
  const manifestRun = plane.runs.get(manifest.runId);
  if (manifestRun === undefined || manifestRun.experimentId !== experimentId) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "the promotion evidence manifest does not belong to this experiment", {
      reason: "manifest-experiment-mismatch",
      experimentId,
      manifestId: manifest.id,
    });
  }
  const chain = plane.promotionChains.get(experimentId) ?? [];
  if (kind === "reverse" && chain.length === 0) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "no promotion decision exists to reverse", {
      reason: "no-promotion-to-reverse",
      experimentId,
    });
  }
  const winnerArm = winnerArmForKind(kind);
  const gate = evaluateLabPromotionGate({
    kind,
    winnerArm,
    objectiveScore: input.objectiveScore,
    baselineScore: input.baselineScore,
  });
  if (!gate.allowed) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", `the promotion gate refused the ${kind} decision: ${gate.reason}`, {
      reason: gate.reason,
      experimentId,
      objectiveScore: input.objectiveScore,
      baselineScore: input.baselineScore,
    });
  }
  const promotion = constructLabPromotionRecord(
    {
      experimentId,
      kind,
      winnerArm,
      objectiveScore: input.objectiveScore,
      baselineScore: input.baselineScore,
      evidenceManifestRef: manifest.id,
    },
    { now: () => deps.clock.now(), nextId: deps.ids.next },
  );
  plane.promotions.set(promotion.id, promotion);
  plane.promotionKinds.set(promotion.id, kind);
  const nextChain = [...chain, promotion.id];
  plane.promotionChains.set(experimentId, nextChain);
  // The experiment head's promotion linkage walks (immutable replacement).
  const reheaded = attachLabExperimentPromotion(experiment, promotion.id);
  plane.experiments.set(experimentId, reheaded);
  appendLabPromotionDecided(
    plane,
    promotion,
    kind,
    chain.length > 0 ? chain[chain.length - 1] ?? null : null,
    experiment.promotionRef,
  );
  return { ok: true, value: { promotion, experiment: reheaded } };
}
