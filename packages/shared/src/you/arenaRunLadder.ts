// YOU ArenaRun ladder machinery (W8A — docs/you/CONTRACTS.md "Wave-8
// contract freeze (v8)": "ArenaRun (one automation attempt against a
// CapabilityGap; append-only run ladder)").
//
// The run ladder is a PROJECTION, never an authority: ArenaRun records are
// immutable; a terminal transition (started -> completed | failed |
// aborted) replaces the record immutably and appends an arena-run-recorded
// event (the W7A AvatarSession replacement precedent); the per-gap run
// list is append-only (new attempts append new run records). Terminals
// are LOCKED: every further transition is refused (the ladder's terminal
// law). The retry authority is the ArenaRetryPolicy (arenaRetryPolicy.ts)
// — this module owns only the pure ladder machinery.
//
// Transition table (frozen W8A):
//   started -> completed | failed | aborted   (the three terminals)
//   completed | failed | aborted -> terminal locked (every move refused)
//   self-transitions refused (a status change must change the status).

import type { ArenaRun, ArenaRunStatus, CapabilityGapCategory, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The four ladder rungs in frozen canonical order. */
export const ARENA_RUN_STATUSES = ["started", "completed", "failed", "aborted"] as const;

/** The three terminal rungs (locked after entry). */
export const ARENA_RUN_TERMINAL_STATUSES = ["completed", "failed", "aborted"] as const;

const STATUS_SET: ReadonlySet<string> = new Set(ARENA_RUN_STATUSES);

/** True when the value is one of the four frozen run-ladder rungs. */
export function isArenaRunStatus(value: unknown): value is ArenaRunStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

/** True when the status is one of the three locked terminals. */
export function isArenaRunTerminal(status: ArenaRunStatus): boolean {
  return (ARENA_RUN_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Canonical ladder index of a rung (0-3), or -1 when off-ladder. */
export function arenaRunStatusIndex(status: string): number {
  return ARENA_RUN_STATUSES.indexOf(status as ArenaRunStatus);
}

/**
 * Why a run-ladder transition is refused, or null when it is legal.
 * Reasons are stable strings (they ride along in typed error details and
 * fixture facts).
 */
export function arenaRunTransitionRefusal(from: ArenaRunStatus, to: ArenaRunStatus): string | null {
  if (from === to) {
    return "no-op-transition";
  }
  if (isArenaRunTerminal(from)) {
    return "run-terminal-locked";
  }
  if (!isArenaRunTerminal(to)) {
    // from is "started" and to is not a terminal: illegal by construction.
    return "transition-not-on-ladder";
  }
  return null;
}

/** The transition-table predicate: may a run move from `from` to `to`? */
export function isLegalArenaRunTransition(from: ArenaRunStatus, to: ArenaRunStatus): boolean {
  return arenaRunTransitionRefusal(from, to) === null;
}

/** Sorts runs by id (FIXTURES.md law 4: stable ordering). */
export function sortArenaRuns(runs: readonly ArenaRun[]): ArenaRun[] {
  return [...runs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Run-ladder intake (the automation attempt facts). */
export interface ArenaRunInput {
  readonly gapId: OpaqueId;
  readonly strategy: string;
  readonly attempt: number;
}

/** A refusal returned by the stateless run intake validator. */
export interface ArenaRunIntakeRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless run-intake validator (never an exception): the strategy
 * must be a non-empty string and the attempt a positive integer (attempt
 * 1 is the first try; the policy bounds the maximum — see
 * arenaRetryPolicy.ts).
 */
export function validateArenaRunInput(input: ArenaRunInput): ArenaRunIntakeRefusal | null {
  if (typeof input.strategy !== "string" || input.strategy.trim().length === 0) {
    return { reason: "strategy-empty", detail: "run strategy must be a non-empty string" };
  }
  if (!Number.isInteger(input.attempt) || input.attempt < 1) {
    return { reason: "attempt-invalid", detail: "run attempt must be a positive integer (>= 1)" };
  }
  if (typeof input.gapId !== "string" || input.gapId.length === 0) {
    return { reason: "gap-id-empty", detail: "run gapId must be a non-empty opaque id" };
  }
  return null;
}

/** Deps for run construction (injected clock + id factory only). */
export interface ArenaRunDeps {
  readonly now: () => string;
  readonly nextId: (kind: string) => OpaqueId;
}

/** Constructs the immutable, deep-frozen "started" run record. */
export function constructArenaRun(input: ArenaRunInput, deps: ArenaRunDeps): ArenaRun {
  const refusal = validateArenaRunInput(input);
  if (refusal !== null) {
    throw new Error(`constructArenaRun refused intake: ${refusal.reason} (${refusal.detail})`);
  }
  return deepFreeze({
    id: deps.nextId("arena-run"),
    gapId: input.gapId,
    strategy: input.strategy,
    attempt: input.attempt,
    status: "started" as const,
    startedAt: deps.now(),
    completedAt: null,
    outcomeEvidenceRef: null,
    simulated: true,
  });
}

/**
 * Applies a terminal transition to a run record (immutable replacement —
 * the original record is NEVER mutated). Throws on an illegal transition
 * (the service maps ladder refusals to typed errors before calling).
 */
export function applyArenaRunTerminal(
  run: ArenaRun,
  to: ArenaRunStatus,
  outcomeEvidenceRef: OpaqueId | null,
  completedAt: string,
): ArenaRun {
  const refusal = arenaRunTransitionRefusal(run.status, to);
  if (refusal !== null) {
    throw new Error(`applyArenaRunTerminal refused transition ${run.status} -> ${to}: ${refusal}`);
  }
  return deepFreeze({
    ...run,
    status: to,
    completedAt,
    outcomeEvidenceRef,
  });
}

/** The gap categories a run may target (runtime mirror of the v1 union). */
export const ARENA_RUN_GAP_CATEGORIES: readonly CapabilityGapCategory[] = [
  "TOOL_GAP",
  "EDITOR_GAP",
  "MODEL_GAP",
  "SKILL_GAP",
  "KNOWLEDGE_GAP",
  "DATA_GAP",
  "EXPERT_GAP",
];
