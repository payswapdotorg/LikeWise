// YOU lab service — the promotion gate flow (W9A). The ops live here;
// labService.ts is the single authority that dispatches into them.
//
// THE LAB PROMOTION LAW: a searched organization promotes ONLY when it
// beats the generalist baseline under the experiment's recorded
// objective and constraints (the LAB.md three-arm comparison law).
// Promotion records are immutable; a reversal is a NEW record, never a
// mutation — truthfully encoded, a reversal records the comparison
// flipping back (winnerArm "generalist-baseline"; only a searched
// winner is a promotion) and the event payload carries
// reversalOfPromotionId so the ledger stays self-describing.
//
// Gate shape (frozen W9A): the decision compares two runs of the
// experiment — a succeeded searched run and a succeeded
// generalist-baseline run — under a verified evidence manifest bound to
// the searched run. The gate predicate is the shared stateless
// evaluateLabPromotionGate (labPromotion.ts); the service maps
// refusals to typed YOU_LAB_PROMOTION_INVALID /
// YOU_LAB_EVIDENCE_MANIFEST_INVALID / YOU_LAB_RUN_NOT_FOUND /
// YOU_LAB_EXPERIMENT_NOT_FOUND.

import type { LabPromotionRecord, OpaqueId } from "@zcode/shared";
import { deepFreeze } from "../../../shared/src/you/serialize.js";
import { verifyLabEvidenceManifest } from "../../../shared/src/you/labEvidenceManifest.js";
import {
  constructLabPromotionRecord,
  evaluateLabPromotionGate,
  labComparisonWinner,
} from "../../../shared/src/you/labPromotion.js";
import { appendLabPromotionDecided } from "./labLedgerOps.js";
import {
  labFailure,
  requireLabExperiment,
  requireLabManifest,
  requireLabRun,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";

/** The comparison facts a promotion/reversal decision carries. */
export interface LabPromotionDecisionInput {
  /** The searched-arm run the decision evaluates. */
  readonly searchedRunId: OpaqueId;
  /** The generalist-baseline run the decision compares against. */
  readonly baselineRunId: OpaqueId;
  /** The searched arm's score under the experiment's recorded objective. */
  readonly objectiveScore: number;
  /** The generalist baseline's score under the same objective and constraints. */
  readonly baselineScore: number;
  /** The evidence manifest backing the decision (bound to the searched run). */
  readonly evidenceManifestRef: OpaqueId;
}

/** The validated comparison shared by the decide and reverse flows. */
interface ValidatedComparison {
  readonly experiment: { readonly id: OpaqueId };
  readonly searchedRunId: OpaqueId;
  readonly baselineRunId: OpaqueId;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: OpaqueId;
}

/**
 * The shared comparison validator: experiment exists; both runs exist,
 * belong to the experiment, carry the right arms and succeeded; the
 * evidence manifest exists, is bound to the searched run and verifies
 * (fail-closed hash check). Every refusal is typed with a stable
 * reason.
 */
function validateComparison(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  experimentId: OpaqueId,
  input: LabPromotionDecisionInput,
): LabServiceResult<ValidatedComparison> {
  const found = requireLabExperiment(plane, experimentId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (!Number.isFinite(input.objectiveScore) || !Number.isFinite(input.baselineScore)) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "promotion scores must be finite numbers", {
      reason: "scores-invalid",
      experimentId,
    });
  }
  const searchedRun = requireLabRun(plane, input.searchedRunId);
  if ("error" in searchedRun) {
    return { ok: false, error: searchedRun.error };
  }
  const baselineRun = requireLabRun(plane, input.baselineRunId);
  if ("error" in baselineRun) {
    return { ok: false, error: baselineRun.error };
  }
  if (searchedRun.run.experimentId !== experimentId || baselineRun.run.experimentId !== experimentId) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "both compared runs must belong to the experiment", {
      reason: "run-experiment-mismatch",
      experimentId,
      searchedRunId: input.searchedRunId,
      baselineRunId: input.baselineRunId,
    });
  }
  if (searchedRun.run.arm !== "searched") {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "the promoted run must be the searched arm", {
      reason: "run-arm-mismatch-searched",
      searchedRunId: input.searchedRunId,
      arm: searchedRun.run.arm,
    });
  }
  if (baselineRun.run.arm !== "generalist-baseline") {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "the comparison baseline must be the generalist-baseline arm", {
      reason: "run-arm-mismatch-baseline",
      baselineRunId: input.baselineRunId,
      arm: baselineRun.run.arm,
    });
  }
  if (searchedRun.run.status !== "succeeded" || baselineRun.run.status !== "succeeded") {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "both compared runs must have succeeded", {
      reason: "run-not-succeeded",
      searchedStatus: searchedRun.run.status,
      baselineStatus: baselineRun.run.status,
    });
  }
  const manifest = requireLabManifest(plane, input.evidenceManifestRef);
  if ("error" in manifest) {
    return { ok: false, error: manifest.error };
  }
  if (manifest.manifest.runId !== input.searchedRunId) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "the decision's evidence manifest must be bound to the searched run", {
      reason: "manifest-not-bound-to-searched-run",
      evidenceManifestRef: input.evidenceManifestRef,
      manifestRunId: manifest.manifest.runId,
    });
  }
  const verification = verifyLabEvidenceManifest(manifest.manifest, (contentRef) => deps.store.get(contentRef));
  if (!verification.ok) {
    return labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", `evidence manifest verification failed: ${verification.refusal.detail}`, {
      reason: verification.refusal.reason,
      evidenceManifestRef: input.evidenceManifestRef,
    });
  }
  return {
    ok: true,
    value: {
      experiment: found.experiment,
      searchedRunId: input.searchedRunId,
      baselineRunId: input.baselineRunId,
      objectiveScore: input.objectiveScore,
      baselineScore: input.baselineScore,
      evidenceManifestRef: input.evidenceManifestRef,
    },
  };
}

/**
 * THE PROMOTION GATE: decides a promotion for the experiment. The
 * searched arm promotes ONLY when it strictly beats the generalist
 * baseline under the recorded objective and constraints — every other
 * outcome refuses with typed YOU_LAB_PROMOTION_INVALID. Emits
 * lab-promotion-decided. Re-decisions append (the promotion ledger is
 * the history; the experiment head walks to the newest record).
 */
export function decideLabPromotionOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  experimentId: OpaqueId,
  input: LabPromotionDecisionInput,
): LabServiceResult<{ readonly promotion: LabPromotionRecord }> {
  const validated = validateComparison(plane, deps, experimentId, input);
  if (!validated.ok) {
    return validated;
  }
  const gate = evaluateLabPromotionGate({
    winnerArm: "searched",
    objectiveScore: validated.value.objectiveScore,
    baselineScore: validated.value.baselineScore,
  });
  if (!gate.allowed) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", `promotion refused by the gate: ${gate.reason}`, {
      reason: gate.reason,
      experimentId,
      objectiveScore: validated.value.objectiveScore,
      baselineScore: validated.value.baselineScore,
    });
  }
  const promotion = constructLabPromotionRecord(
    {
      experimentId,
      winnerArm: "searched",
      objectiveScore: validated.value.objectiveScore,
      baselineScore: validated.value.baselineScore,
      evidenceManifestRef: validated.value.evidenceManifestRef,
    },
    { now: () => deps.clock.now(), nextId: deps.ids.next },
  );
  appendPromotion(plane, promotion, null);
  return { ok: true, value: { promotion } };
}

/**
 * Reverses the experiment's head promotion with a NEW record (never a
 * mutation): the reversal records the comparison flipping back — the
 * searched arm no longer beats the generalist baseline under the
 * recorded objective (a tie loses too). Emits lab-promotion-decided
 * with reversalOfPromotionId. Refusals: typed YOU_LAB_PROMOTION_INVALID
 * when no head promotion exists ("no-promotion-to-reverse") or when
 * the searched arm still beats the baseline
 * ("reversal-requires-baseline-win" — reversing a live win would be a
 * lie, the truth law).
 */
export function reverseLabPromotionOp(
  plane: LabPlaneRecord,
  deps: LabFlowDeps,
  experimentId: OpaqueId,
  input: LabPromotionDecisionInput,
): LabServiceResult<{ readonly promotion: LabPromotionRecord }> {
  const found = requireLabExperiment(plane, experimentId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const ledger = plane.promotionLedgers.get(experimentId) ?? [];
  const head = ledger[ledger.length - 1];
  if (head === undefined) {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "no promotion to reverse for the experiment", {
      reason: "no-promotion-to-reverse",
      experimentId,
    });
  }
  const validated = validateComparison(plane, deps, experimentId, input);
  if (!validated.ok) {
    return validated;
  }
  if (labComparisonWinner(validated.value.objectiveScore, validated.value.baselineScore) !== "generalist-baseline") {
    return labFailure("YOU_LAB_PROMOTION_INVALID", "a reversal must record the baseline winning the comparison (the searched arm no longer beats it)", {
      reason: "reversal-requires-baseline-win",
      experimentId,
      objectiveScore: validated.value.objectiveScore,
      baselineScore: validated.value.baselineScore,
    });
  }
  const reversal = constructLabPromotionRecord(
    {
      experimentId,
      winnerArm: "generalist-baseline",
      objectiveScore: validated.value.objectiveScore,
      baselineScore: validated.value.baselineScore,
      evidenceManifestRef: validated.value.evidenceManifestRef,
    },
    { now: () => deps.clock.now(), nextId: deps.ids.next },
  );
  appendPromotion(plane, reversal, head.id);
  return { ok: true, value: { promotion: reversal } };
}

/**
 * Appends a promotion/reversal record onto the experiment's decision
 * ledger, walks the experiment head immutably (promotionRef -> the new
 * record — the W7A replacement precedent) and emits
 * lab-promotion-decided.
 */
function appendPromotion(
  plane: LabPlaneRecord,
  promotion: LabPromotionRecord,
  reversalOfPromotionId: OpaqueId | null,
): void {
  const ledger = plane.promotionLedgers.get(promotion.experimentId) ?? [];
  ledger.push(promotion);
  plane.promotionLedgers.set(promotion.experimentId, ledger);
  plane.promotions.set(promotion.id, promotion);
  if (reversalOfPromotionId !== null) {
    plane.promotionReversals.set(promotion.id, reversalOfPromotionId);
  }
  const experiment = plane.experiments.get(promotion.experimentId);
  if (experiment !== undefined) {
    // Immutable head walk: the declaration facts never change.
    plane.experiments.set(promotion.experimentId, deepFreeze({ ...experiment, promotionRef: promotion.id }));
  }
  appendLabPromotionDecided(plane, promotion, reversalOfPromotionId);
}
