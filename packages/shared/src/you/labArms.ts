// YOU Lab arm kinds (W9A — docs/you/LAB.md "Organization comparison":
// "Every serious Lab experiment compares: 1. generalist baseline;
// 2. hand-designed organization; 3. searched organization. The searched
// organization is only promoted when it beats the baseline under the
// relevant objective and constraints."; CONTRACTS.md "Wave-9 contract
// freeze (v9)" LAB PROMOTION LAW).
//
// The three-arm law is the frozen W9A comparison contract: experiment
// intake requires EXACTLY these three arms (each present once) and the
// run ladder validates its arm against the same set.

import type { LabArmKind } from "./contract.js";

/**
 * The three LAB.md comparison arms in canonical order. Also the
 * canonical arm order recorded on every LabExperiment.
 */
export const LAB_ARM_KINDS = ["generalist-baseline", "hand-designed", "searched"] as const;

const ARM_SET: ReadonlySet<string> = new Set(LAB_ARM_KINDS);

/** True when the value is one of the three LAB.md comparison arms. */
export function isLabArmKind(value: unknown): value is LabArmKind {
  return typeof value === "string" && ARM_SET.has(value);
}

/** The canonical order of an experiment's arm list (the intake target). */
export function canonicalLabArmOrder(arms: readonly LabArmKind[]): LabArmKind[] {
  return [...arms].sort((a, b) => {
    const left = (LAB_ARM_KINDS as readonly string[]).indexOf(a);
    const right = (LAB_ARM_KINDS as readonly string[]).indexOf(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
