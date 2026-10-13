// YOU LabPromotionRecord machinery — the promotion gate (W9A —
// docs/you/CONTRACTS.md "Wave-9 contract freeze (v9)": LAB PROMOTION
// LAW: "a searched organization promotes ONLY when it beats the
// generalist baseline under the experiment's recorded objective and
// constraints (the LAB.md three-arm comparison law). Promotion records
// are immutable; a reversal is a new record, never a mutation. The
// service refuses invalid promotions with YOU_LAB_PROMOTION_INVALID";
// docs/you/LAB.md "Organization comparison").
//
// The gate is the single stateless law authority:
//   - a PROMOTION requires winnerArm "searched" and the searched arm's
//     objectiveScore STRICTLY greater than the baseline score (beats =
//     strictly better under the recorded objective);
//   - a REVERSAL (the searched arm no longer beats the baseline under
//     new evidence) records the generalist baseline as the standing
//     winner: winnerArm "generalist-baseline" with objectiveScore <=
//     baselineScore. A reversal is a NEW LabPromotionRecord appended to
//     the experiment's decision chain — the chain is append-only, the
//     head linkage moves through immutable experiment replacement.
// The scores ride the record (objectiveScore = the searched arm's
// score, baselineScore = the generalist baseline's score) so the
// decision is auditable against the recorded objective and constraints.

import type { LabPromotionRecord, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The two decision kinds on the append-only promotion chain. */
export type LabPromotionDecisionKind = "promote" | "reverse";

/** The gate input (the comparison facts the law consumes). */
export interface LabPromotionGateInput {
  readonly kind: LabPromotionDecisionKind;
  readonly winnerArm: LabPromotionRecord["winnerArm"];
  readonly objectiveScore: number;
  readonly baselineScore: number;
}

/** The typed gate decision with a machine-readable reason. */
export type LabPromotionGateDecision =
  | { readonly allowed: true; readonly reason: "searched-beats-baseline" | "baseline-stands" }
  | { readonly allowed: false; readonly reason: string };

/**
 * The stateless promotion gate (the LAB PROMOTION LAW). Check order is
 * fixed so the refusal reason is deterministic: score shape first,
 * then the winner-arm law, then the beats-baseline law.
 */
export function evaluateLabPromotionGate(input: LabPromotionGateInput): LabPromotionGateDecision {
  if (typeof input.objectiveScore !== "number" || !Number.isFinite(input.objectiveScore)) {
    return { allowed: false, reason: "objective-score-not-finite" };
  }
  if (typeof input.baselineScore !== "number" || !Number.isFinite(input.baselineScore)) {
    return { allowed: false, reason: "baseline-score-not-finite" };
  }
  if (input.kind === "promote") {
    if (input.winnerArm !== "searched") {
      return { allowed: false, reason: "winner-not-searched" };
    }
    if (!(input.objectiveScore > input.baselineScore)) {
      return { allowed: false, reason: "searched-does-not-beat-baseline" };
    }
    return { allowed: true, reason: "searched-beats-baseline" };
  }
  // kind === "reverse": the baseline stands.
  if (input.winnerArm !== "generalist-baseline") {
    return { allowed: false, reason: "reversal-winner-not-baseline" };
  }
  if (!(input.objectiveScore <= input.baselineScore)) {
    return { allowed: false, reason: "searched-still-beats-baseline" };
  }
  return { allowed: true, reason: "baseline-stands" };
}

/** Promotion-record intake (the decision facts). */
export interface LabPromotionRecordInput {
  readonly experimentId: OpaqueId;
  readonly kind: LabPromotionDecisionKind;
  readonly winnerArm: LabPromotionRecord["winnerArm"];
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: OpaqueId;
}

/** A refusal returned by the stateless record validator (never an exception). */
export interface LabPromotionRefusal {
  /** Stable reason string (rides along in typed YOU_LAB_PROMOTION_INVALID details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless record-intake validator: linkage shape first (non-empty
 * experimentId + evidenceManifestRef), then the promotion gate itself.
 */
export function validateLabPromotionRecordInput(input: LabPromotionRecordInput): LabPromotionRefusal | null {
  if (typeof input.experimentId !== "string" || input.experimentId.length === 0) {
    return { reason: "experiment-id-empty", detail: "promotion experimentId must be a non-empty opaque id" };
  }
  if (typeof input.evidenceManifestRef !== "string" || input.evidenceManifestRef.length === 0) {
    return { reason: "evidence-ref-empty", detail: "promotion evidenceManifestRef must be a non-empty opaque id" };
  }
  const gate = evaluateLabPromotionGate({
    kind: input.kind,
    winnerArm: input.winnerArm,
    objectiveScore: input.objectiveScore,
    baselineScore: input.baselineScore,
  });
  if (!gate.allowed) {
    return { reason: gate.reason, detail: `the promotion gate refused the ${input.kind} decision` };
  }
  return null;
}

/** Deps for record construction (injected clock + id factory only). */
export interface LabPromotionRecordDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/**
 * Constructs the immutable, deep-frozen promotion record (gate-checked:
 * an illegal promotion can never materialize as a record). The decision
 * kind rides the event payloads (decisionKind / supersedesPromotionId)
 * — the frozen record shape carries the comparison facts.
 */
export function constructLabPromotionRecord(input: LabPromotionRecordInput, deps: LabPromotionRecordDeps): LabPromotionRecord {
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
