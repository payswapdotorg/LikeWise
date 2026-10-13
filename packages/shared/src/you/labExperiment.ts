// YOU LabExperiment machinery (W9A — docs/you/CONTRACTS.md "Wave-9
// contract freeze (v9)": "LabExperiment (the durable experiment
// container: one intent + one constraint set, compared across arms)";
// WORK_ORDERS.md W9A: "LabExperiment persistence: immutable experiment
// records (intentRef, constraintsHash, objective, arms per the LAB.md
// three-arm law)").
//
// The LAB PERSISTENCE LAW: a LabExperiment record is immutable once
// declared. The ONLY post-declaration change is the promotion linkage
// (promotionRef): the promotion gate decides/reverses through immutable
// record replacement (the W7A AvatarSession replacement precedent) —
// the declaration facts (intentRef / constraintsHash / objective / arms)
// never change. Arms are validated against the LAB.md three-arm law
// (exactly the three comparison arms, each present once) and recorded
// in canonical order.

import type { LabExperiment, OpaqueId } from "./contract.js";
import { canonicalLabArmOrder, LAB_ARM_KINDS } from "./labArms.js";
import { deepFreeze } from "./serialize.js";

/** Experiment intake (the declaration facts). */
export interface LabExperimentInput {
  readonly intentRef: OpaqueId;
  readonly constraintsHash: string;
  readonly objective: string;
  readonly arms: readonly LabExperiment["arms"][number][];
}

/** A refusal returned by the stateless experiment validator (never an exception). */
export interface LabExperimentRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless three-arm-law validator: the arms must list EXACTLY the
 * three LAB.md comparison arms (generalist baseline, hand-designed,
 * searched), each present exactly once, in any input order. Plus the
 * declaration shape gates: non-empty intentRef, constraintsHash and
 * objective.
 */
export function validateLabExperimentInput(input: LabExperimentInput): LabExperimentRefusal | null {
  if (typeof input.intentRef !== "string" || input.intentRef.length === 0) {
    return { reason: "intent-ref-empty", detail: "experiment intentRef must be a non-empty opaque id" };
  }
  if (typeof input.constraintsHash !== "string" || input.constraintsHash.trim().length === 0) {
    return { reason: "constraints-hash-empty", detail: "experiment constraintsHash must be a non-empty string" };
  }
  if (typeof input.objective !== "string" || input.objective.trim().length === 0) {
    return { reason: "objective-empty", detail: "experiment objective must be a non-empty string" };
  }
  if (!Array.isArray(input.arms) || input.arms.length !== LAB_ARM_KINDS.length) {
    return {
      reason: "arms-count",
      detail: `the LAB.md three-arm law requires exactly ${LAB_ARM_KINDS.length} arms (got ${Array.isArray(input.arms) ? input.arms.length : "none"})`,
    };
  }
  const seen = new Set<string>();
  for (const arm of input.arms) {
    if (typeof arm !== "string" || !(LAB_ARM_KINDS as readonly string[]).includes(arm)) {
      return {
        reason: "arms-missing",
        detail: `arm "${String(arm)}" is not one of the three LAB.md comparison arms`,
      };
    }
    if (seen.has(arm)) {
      return { reason: "arms-duplicate", detail: `duplicate experiment arm "${arm}"` };
    }
    seen.add(arm);
  }
  for (const arm of LAB_ARM_KINDS) {
    if (!seen.has(arm)) {
      return { reason: "arms-missing", detail: `the LAB.md three-arm law requires the "${arm}" arm` };
    }
  }
  return null;
}

/** Deps for experiment construction (injected clock + id factory only). */
export interface LabExperimentDeps {
  readonly nextId: (kind: string) => OpaqueId;
}

/**
 * Constructs the immutable, deep-frozen experiment record. Arms are
 * recorded in canonical three-arm order regardless of input order (the
 * recorded order is part of the durable comparison contract).
 */
export function constructLabExperiment(input: LabExperimentInput, deps: LabExperimentDeps): LabExperiment {
  const refusal = validateLabExperimentInput(input);
  if (refusal !== null) {
    throw new Error(`constructLabExperiment refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.nextId("lab-experiment"),
    intentRef: input.intentRef,
    constraintsHash: input.constraintsHash,
    objective: input.objective,
    arms: Object.freeze(canonicalLabArmOrder(input.arms)),
    promotionRef: null,
    simulated: true,
  });
}

/**
 * Points the experiment head at a promotion decision record (immutable
 * replacement — the declaration facts are copied untouched; a reversal
 * or re-promotion moves the head the same way). The promotion chain per
 * experiment stays append-only; this replacement only moves the head
 * linkage.
 */
export function attachLabExperimentPromotion(experiment: LabExperiment, promotionRef: OpaqueId): LabExperiment {
  if (typeof promotionRef !== "string" || promotionRef.length === 0) {
    throw new Error("attachLabExperimentPromotion requires a non-empty promotion ref");
  }
  return deepFreeze({ ...experiment, promotionRef });
}
