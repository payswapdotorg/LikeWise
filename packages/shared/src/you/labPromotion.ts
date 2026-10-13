// YOU lab promotion gate (W9A — docs/you/CONTRACTS.md "Wave-9 contract
// freeze (v9)": the LAB PROMOTION LAW: "a searched organization promotes
// ONLY when it beats the generalist baseline under the experiment's
// recorded objective and constraints (the LAB.md three-arm comparison
// law). Promotion records are immutable; a reversal is a new record,
// never a mutation.").
//
// This module owns the STATELESS gate and record construction (the W8A
// arenaRetryPolicy precedent): the service maps gate refusals to typed
// YOU_LAB_PROMOTION_INVALID at its seam. Score semantics: the objective
// score is the searched arm's measured value under the experiment's
// recorded objective (higher is better); the baseline score is the
// generalist baseline's value under the same objective and constraints.
// "Beats" is strict: objectiveScore > baselineScore.
//
// Reversals: a reversal is a NEW LabPromotionRecord appended to the
// experiment's promotion ledger — never a mutation of the promoted
// record. Truthfully encoded with the frozen shape, a reversal records
// the comparison flipping back: winnerArm "generalist-baseline" (only a
// searched winner is a promotion; a baseline winner is the reversal).
// The event payload carries reversalOfPromotionId so the ledger stays
// self-describing (which promotion the new record undoes).

import type { LabArmKind, LabPromotionRecord, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The promotion-gate intake (the comparison facts). */
export interface LabPromotionGateInput {
  readonly winnerArm: LabArmKind;
  readonly objectiveScore: number;
  readonly baselineScore: number;
}

/** The typed gate decision with a machine-readable reason. */
export type LabPromotionGateDecision =
  | { readonly allowed: true; readonly reason: "searched-beats-baseline" }
  | { readonly allowed: false; readonly reason: string };

/**
 * The stateless promotion gate — the LAB PROMOTION LAW as a predicate:
 * scores must be finite; the winner must be the searched arm (only a
 * searched organization promotes); the searched arm must strictly beat
 * the generalist baseline under the recorded objective.
 */
export function evaluateLabPromotionGate(input: LabPromotionGateInput): LabPromotionGateDecision {
  if (!Number.isFinite(input.objectiveScore) || !Number.isFinite(input.baselineScore)) {
    return { allowed: false, reason: "scores-invalid" };
  }
  if (input.winnerArm !== "searched") {
    return { allowed: false, reason: "winner-not-searched" };
  }
  if (!(input.objectiveScore > input.baselineScore)) {
    return { allowed: false, reason: "searched-does-not-beat-baseline" };
  }
  return { allowed: true, reason: "searched-beats-baseline" };
}

/**
 * Who wins the comparison under the recorded objective: the searched arm
 * when it strictly beats the baseline, the generalist baseline otherwise
 * (a tie means the searched arm does NOT beat the baseline). Null when
 * the scores are not finite numbers.
 */
export function labComparisonWinner(objectiveScore: number, baselineScore: number): LabArmKind | null {
  if (!Number.isFinite(objectiveScore) || !Number.isFinite(baselineScore)) {
    return null;
  }
  return objectiveScore > baselineScore ? "searched" : "generalist-baseline";
}

/** Promotion-record intake (the decision facts). */
export interface LabPromotionRecordInput {
  readonly experimentId: OpaqueId;
  readonly winnerArm: LabArmKind;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: OpaqueId;
}

/** A refusal returned by the stateless record validator. */
export interface LabPromotionRecordRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless record-intake validator: the experiment id and evidence
 * manifest ref must be non-empty; the winner arm must be a frozen arm
 * kind; the scores must be finite numbers.
 */
export function validateLabPromotionRecordInput(input: LabPromotionRecordInput): LabPromotionRecordRefusal | null {
  if (typeof input.experimentId !== "string" || input.experimentId.length === 0) {
    return { reason: "experiment-id-empty", detail: "promotion experimentId must be a non-empty opaque id" };
  }
  if (input.winnerArm !== "searched" && input.winnerArm !== "hand-designed" && input.winnerArm !== "generalist-baseline") {
    return { reason: "winner-arm-invalid", detail: "promotion winnerArm must be one of the three frozen arm kinds" };
  }
  if (!Number.isFinite(input.objectiveScore) || !Number.isFinite(input.baselineScore)) {
    return { reason: "scores-invalid", detail: "promotion scores must be finite numbers" };
  }
  if (typeof input.evidenceManifestRef !== "string" || input.evidenceManifestRef.length === 0) {
    return { reason: "evidence-manifest-ref-empty", detail: "promotion evidenceManifestRef must be a non-empty opaque id" };
  }
  return null;
}

/** Deps for record construction (injected clock + id factory only). */
export interface LabPromotionDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/** Constructs the immutable, deep-frozen promotion record. */
export function constructLabPromotionRecord(input: LabPromotionRecordInput, deps: LabPromotionDeps): LabPromotionRecord {
  const refusal = validateLabPromotionRecordInput(input);
  if (refusal !== null) {
    throw new Error(`constructLabPromotionRecord refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.nextId("lab-promotion"),
    experimentId: input.experimentId,
    winnerArm: input.winnerArm,
    objectiveScore: input.objectiveScore,
    baselineScore: input.baselineScore,
    evidenceManifestRef: input.evidenceManifestRef,
    decidedAt: deps.now(),
    simulated: true,
  });
}
