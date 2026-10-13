// YOU LabExperiment machinery (W9A — docs/you/CONTRACTS.md "Wave-9
// contract freeze (v9)": "LabExperiment (the durable experiment
// container: one intent + one constraint set, compared across arms)").
//
// THE THREE-ARM LAW (docs/you/LAB.md "Organization comparison"): every
// serious lab experiment compares (1) a generalist baseline, (2) a
// hand-designed organization, (3) a searched organization. Intake
// enforces the full three-arm set — an experiment missing any arm is
// refused; duplicates are refused. The declared arms are canonicalized
// into the frozen order.
//
// LAB PERSISTENCE LAW: the experiment record is immutable once declared;
// runs and promotion decisions append around it. The promotionRef walk
// (a decided promotion / reversal points the head at the new record)
// replaces the head record immutably at the service seam — the original
// declaration bytes never change.
//
// Experiments are SERVICE STATE on the W9A service (the W8A
// retry-policy/provider precedent: the frozen v9 event set has no
// experiment event type) — their facts materialize in the ledger only
// through the events that reference them (lab-run-recorded carries
// experimentId; lab-promotion-decided carries experimentId).

import type { LabArmKind, LabExperiment, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The three frozen comparison arms, in canonical order (the LAB.md law). */
export const LAB_ARM_KINDS = ["generalist-baseline", "hand-designed", "searched"] as const;

const ARM_SET: ReadonlySet<string> = new Set(LAB_ARM_KINDS);

/** True when the value is one of the three frozen arm kinds. */
export function isLabArmKind(value: unknown): value is LabArmKind {
  return typeof value === "string" && ARM_SET.has(value);
}

/** Experiment intake (the durable container facts). */
export interface LabExperimentInput {
  readonly intentRef: OpaqueId;
  readonly constraintsHash: string;
  readonly objective: string;
  readonly arms: readonly LabArmKind[];
}

/** A refusal returned by the stateless experiment validator. */
export interface LabExperimentIntakeRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless experiment-intake validator (the single three-arm
 * authority): intentRef, constraintsHash and objective must be non-empty
 * strings; arms must be exactly the three LAB.md comparison arms —
 * non-empty, all valid arm kinds, no duplicates, full set.
 */
export function validateLabExperimentInput(input: LabExperimentInput): LabExperimentIntakeRefusal | null {
  if (typeof input.intentRef !== "string" || input.intentRef.length === 0) {
    return { reason: "intent-ref-empty", detail: "experiment intentRef must be a non-empty opaque id" };
  }
  if (typeof input.constraintsHash !== "string" || input.constraintsHash.trim().length === 0) {
    return { reason: "constraints-hash-empty", detail: "experiment constraintsHash must be a non-empty string" };
  }
  if (typeof input.objective !== "string" || input.objective.trim().length === 0) {
    return { reason: "objective-empty", detail: "experiment objective must be a non-empty string" };
  }
  if (!Array.isArray(input.arms) || input.arms.length === 0) {
    return { reason: "arms-empty", detail: "experiment arms must list the three LAB.md comparison arms" };
  }
  const seen = new Set<string>();
  for (const arm of input.arms) {
    if (!isLabArmKind(arm)) {
      return { reason: "arm-invalid", detail: `experiment arm "${String(arm)}" is not one of the three frozen arm kinds` };
    }
    if (seen.has(arm)) {
      return { reason: "arms-duplicate", detail: `duplicate experiment arm "${arm}"` };
    }
    seen.add(arm);
  }
  if (input.arms.length !== LAB_ARM_KINDS.length) {
    return {
      reason: "arms-not-three-arm-law",
      detail: "the LAB.md three-arm law requires exactly the generalist baseline, hand-designed and searched arms",
    };
  }
  return null;
}

/** Deps for experiment construction (injected id factory only). */
export interface LabExperimentDeps {
  readonly nextId: (kind: string) => OpaqueId;
}

/**
 * Constructs the immutable, deep-frozen experiment record. The declared
 * arms are canonicalized into the frozen three-arm order; promotionRef
 * starts null (no promotion decided yet).
 */
export function constructLabExperiment(input: LabExperimentInput, deps: LabExperimentDeps): LabExperiment {
  const refusal = validateLabExperimentInput(input);
  if (refusal !== null) {
    throw new Error(`constructLabExperiment refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  const declared = new Set<string>(input.arms);
  return deepFreeze({
    id: deps.nextId("lab-experiment"),
    intentRef: input.intentRef,
    constraintsHash: input.constraintsHash,
    objective: input.objective,
    arms: Object.freeze(LAB_ARM_KINDS.filter((arm) => declared.has(arm))),
    promotionRef: null,
    simulated: true,
  });
}
