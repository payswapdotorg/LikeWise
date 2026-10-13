// YOU LabRun ladder machinery (W9A — docs/you/CONTRACTS.md "Wave-9
// contract freeze (v9)": "LabRun (one durable run of an experiment arm;
// append-only run ladder)"; WORK_ORDERS.md W9A).
//
// The LAB PERSISTENCE LAW: LabRun records are immutable; the run ladder
// is append-only (new attempts append new run records); within one run
// the status walks the ladder through IMMUTABLE RECORD REPLACEMENT (the
// W7A AvatarSession replacement precedent — the original record object
// is never touched), each step appending a lab-run-recorded event. A
// terminal transition sets completedAt; the submitted -> running step
// changes only the status rung.
//
// Transition table (frozen W9A):
//   submitted -> running                      (the only non-terminal step)
//   running   -> succeeded | failed | retired (the three terminals)
//   succeeded | failed | retired -> terminal locked (every move refused)
//   self-transitions refused (a status change must change the status);
//   every other cell (submitted -> terminal, running -> submitted) is
//   off-ladder.

import type { LabRun, LabRunStatus, OpaqueId } from "./contract.js";
import { isLabArmKind } from "./labArms.js";
import { deepFreeze } from "./serialize.js";

/** The five ladder rungs in frozen canonical order. */
export const LAB_RUN_STATUSES = ["submitted", "running", "succeeded", "failed", "retired"] as const;

/** The three terminal rungs (locked after entry). */
export const LAB_RUN_TERMINAL_STATUSES = ["succeeded", "failed", "retired"] as const;

const STATUS_SET: ReadonlySet<string> = new Set(LAB_RUN_STATUSES);

/** True when the value is one of the five frozen run-ladder rungs. */
export function isLabRunStatus(value: unknown): value is LabRunStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

/** True when the status is one of the three locked terminals. */
export function isLabRunTerminal(status: LabRunStatus): boolean {
  return (LAB_RUN_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Canonical ladder index of a rung (0-4), or -1 when off-ladder. */
export function labRunStatusIndex(status: string): number {
  return LAB_RUN_STATUSES.indexOf(status as LabRunStatus);
}

/**
 * Why a run-ladder transition is refused, or null when it is legal.
 * Reasons are stable strings (they ride along in typed error details and
 * fixture facts).
 */
export function labRunTransitionRefusal(from: LabRunStatus, to: LabRunStatus): string | null {
  if (from === to) {
    return "no-op-transition";
  }
  if (isLabRunTerminal(from)) {
    return "run-terminal-locked";
  }
  if (from === "submitted") {
    return to === "running" ? null : "transition-not-on-ladder";
  }
  // from === "running": only the three terminals are reachable.
  return isLabRunTerminal(to) ? null : "transition-not-on-ladder";
}

/** The transition-table predicate: may a run move from `from` to `to`? */
export function isLegalLabRunTransition(from: LabRunStatus, to: LabRunStatus): boolean {
  return labRunTransitionRefusal(from, to) === null;
}

/** Sorts runs by id (FIXTURES.md law 4: stable ordering). */
export function sortLabRuns(runs: readonly LabRun[]): LabRun[] {
  return [...runs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Run-ladder intake (the durable attempt facts). */
export interface LabRunInput {
  readonly experimentId: OpaqueId;
  readonly arm: LabRun["arm"];
  readonly planHash: string;
}

/** A refusal returned by the stateless run intake validator. */
export interface LabRunIntakeRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless run-intake validator (never an exception): the arm must
 * be one of the three LAB.md comparison arms and the planHash a
 * non-empty string (the run binds its compute plan by hash — the
 * content-addressing lives with the plan authority).
 */
export function validateLabRunInput(input: LabRunInput): LabRunIntakeRefusal | null {
  if (typeof input.experimentId !== "string" || input.experimentId.length === 0) {
    return { reason: "experiment-id-empty", detail: "run experimentId must be a non-empty opaque id" };
  }
  if (typeof input.arm !== "string" || !isLabArmKind(input.arm)) {
    return { reason: "arm-invalid", detail: `run arm must be one of the three LAB.md arms (got ${String(input.arm)})` };
  }
  if (typeof input.planHash !== "string" || input.planHash.trim().length === 0) {
    return { reason: "plan-hash-empty", detail: "run planHash must be a non-empty string" };
  }
  return null;
}

/** Deps for run construction (injected clock + id factory only). */
export interface LabRunDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/** Constructs the immutable, deep-frozen "submitted" run record. */
export function constructLabRun(input: LabRunInput, deps: LabRunDeps): LabRun {
  const refusal = validateLabRunInput(input);
  if (refusal !== null) {
    throw new Error(`constructLabRun refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.nextId("lab-run"),
    experimentId: input.experimentId,
    arm: input.arm,
    planHash: input.planHash,
    status: "submitted" as const,
    submittedAt: deps.now(),
    completedAt: null,
    evidenceManifestRef: null,
    simulated: true,
  });
}

/**
 * Applies a legal ladder step to a run record (immutable replacement —
 * the original record is NEVER mutated). Terminals stamp completedAt;
 * the submitted -> running step leaves completedAt null. Throws on an
 * illegal transition (the service maps ladder refusals to typed errors
 * before calling).
 */
export function advanceLabRun(run: LabRun, to: LabRunStatus, now: string): LabRun {
  const refusal = labRunTransitionRefusal(run.status, to);
  if (refusal !== null) {
    throw new Error(`advanceLabRun refused transition ${run.status} -> ${to}: ${refusal}`);
  }
  return deepFreeze({
    ...run,
    status: to,
    completedAt: isLabRunTerminal(to) ? now : null,
  });
}

/**
 * Binds a published evidence manifest onto the run head (immutable
 * replacement; the manifest itself records runId). Re-publishing moves
 * the head ref — the manifest list per run stays append-only.
 */
export function attachLabRunEvidence(run: LabRun, evidenceManifestRef: OpaqueId): LabRun {
  if (typeof evidenceManifestRef !== "string" || evidenceManifestRef.length === 0) {
    throw new Error("attachLabRunEvidence requires a non-empty evidence manifest ref");
  }
  return deepFreeze({ ...run, evidenceManifestRef });
}
