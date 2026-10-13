// YOU ArenaEscalation ladder machinery (W8A — docs/you/CONTRACTS.md
// "Wave-8 contract freeze (v8)": "The escalation lifecycle stays the v1
// ArenaEscalation ladder (requested -> authorized -> in-progress ->
// delivered -> applied | rejected | cancelled)"; docs/you/ARCHITECTURE.md
// §15).
//
// This module owns the pure v1 ladder machinery: the seven-status
// membership set, the frozen transition table and the terminal locks.
// The escalation record itself lives on the CapabilityGap's immutable
// ArenaEscalationRef (v1 shape); every ladder transition replaces the
// gap record immutably (the v1 deliverFixtureExpertResult replacement
// precedent) and rides the arena-plane ledger. Invalid transitions are
// typed YOU_ESCALATION_STATE_INVALID at the service seam; unknown
// escalations are typed YOU_ESCALATION_NOT_FOUND.
//
// Transition table (frozen v1 ladder, restated by the wave-8 freeze):
//   requested   -> authorized | cancelled
//   authorized  -> in-progress | cancelled
//   in-progress -> delivered | cancelled
//   delivered   -> applied | rejected
//   applied | rejected | cancelled -> terminal locked (refused)
//   self-transitions refused (a status change must change the status).
// Cancellation is legal from every pre-terminal rung (the user may pull
// the plug before the result lands; once delivered, the outcome is the
// applied | rejected review decision).

import type { ArenaEscalationRef, ArenaEscalationStatus, ArenaExpertResult } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The seven ladder rungs in frozen canonical order. */
export const ARENA_ESCALATION_STATUSES = [
  "requested",
  "authorized",
  "in-progress",
  "delivered",
  "applied",
  "rejected",
  "cancelled",
] as const;

/** The three terminal rungs (locked after entry). */
export const ARENA_ESCALATION_TERMINAL_STATUSES = ["applied", "rejected", "cancelled"] as const;

const STATUS_SET: ReadonlySet<string> = new Set(ARENA_ESCALATION_STATUSES);

/** True when the value is one of the seven frozen escalation rungs. */
export function isArenaEscalationStatus(value: unknown): value is ArenaEscalationStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

/** True when the status is one of the three locked terminals. */
export function isArenaEscalationTerminal(status: ArenaEscalationStatus): boolean {
  return (ARENA_ESCALATION_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Canonical ladder index of a rung (0-6), or -1 when off-ladder. */
export function arenaEscalationStatusIndex(status: string): number {
  return ARENA_ESCALATION_STATUSES.indexOf(status as ArenaEscalationStatus);
}

/** The legal successors of each rung (the transition table as a map). */
export const ARENA_ESCALATION_TRANSITIONS: Readonly<Record<ArenaEscalationStatus, readonly ArenaEscalationStatus[]>> = deepFreeze({
  requested: ["authorized", "cancelled"],
  authorized: ["in-progress", "cancelled"],
  "in-progress": ["delivered", "cancelled"],
  delivered: ["applied", "rejected"],
  applied: [],
  rejected: [],
  cancelled: [],
});

/**
 * Why an escalation transition is refused, or null when it is legal.
 * Reasons are stable strings (they ride along in typed
 * YOU_ESCALATION_STATE_INVALID error details and fixture facts).
 */
export function arenaEscalationTransitionRefusal(from: ArenaEscalationStatus, to: ArenaEscalationStatus): string | null {
  if (from === to) {
    return "no-op-transition";
  }
  if (isArenaEscalationTerminal(from)) {
    return "escalation-terminal-locked";
  }
  const successors = ARENA_ESCALATION_TRANSITIONS[from];
  if (successors === undefined || !successors.includes(to)) {
    return "transition-not-on-ladder";
  }
  return null;
}

/** The transition-table predicate: may the escalation move from `from` to `to`? */
export function isLegalArenaEscalationTransition(from: ArenaEscalationStatus, to: ArenaEscalationStatus): boolean {
  return arenaEscalationTransitionRefusal(from, to) === null;
}

/** Deps for escalation construction (injected id factory only). */
export interface ArenaEscalationDeps {
  readonly nextId: (kind: string) => string;
}

/**
 * Constructs the immutable, deep-frozen "requested" escalation ref (the
 * v1 shape: escalationId + status + the ARENA.md minimum-context capsule
 * + a null expert result).
 */
export function constructArenaEscalationRef(minimumContext: readonly string[], deps: ArenaEscalationDeps): ArenaEscalationRef {
  return deepFreeze({
    escalationId: deps.nextId("escalation"),
    status: "requested" as const,
    minimumContext: Object.freeze([...minimumContext]),
    expertResult: null,
  });
}

/**
 * Applies a ladder transition to an escalation ref (immutable
 * replacement — the original record is NEVER mutated). Throws on an
 * illegal transition (the service maps ladder refusals to typed
 * YOU_ESCALATION_STATE_INVALID before calling).
 */
export function applyArenaEscalationTransition(escalation: ArenaEscalationRef, to: ArenaEscalationStatus): ArenaEscalationRef {
  const refusal = arenaEscalationTransitionRefusal(escalation.status, to);
  if (refusal !== null) {
    throw new Error(`applyArenaEscalationTransition refused ${escalation.status} -> ${to}: ${refusal}`);
  }
  return deepFreeze({ ...escalation, status: to });
}

/**
 * Attaches the delivered expert result (immutable replacement). The v1
 * law: an expert result exists only on a "delivered" (or later) rung; the
 * appliesAsChangeSetId binding is stamped at application time.
 */
export function attachArenaExpertResult(escalation: ArenaEscalationRef, result: ArenaExpertResult): ArenaEscalationRef {
  if (escalation.status !== "delivered" && escalation.status !== "applied") {
    throw new Error(`attachArenaExpertResult refused on status ${escalation.status}`);
  }
  return deepFreeze({ ...escalation, expertResult: result });
}

/** Marks the expert result applied through ChangeSet `<changeSetId>` (v1 law). */
export function markArenaExpertResultApplied(escalation: ArenaEscalationRef, changeSetId: string): ArenaEscalationRef {
  if (escalation.status !== "delivered" && escalation.status !== "applied") {
    throw new Error(`markArenaExpertResultApplied refused on status ${escalation.status}`);
  }
  if (escalation.expertResult === null) {
    throw new Error("markArenaExpertResultApplied requires an expert result");
  }
  const appliedResult: ArenaExpertResult = deepFreeze({ ...escalation.expertResult, appliesAsChangeSetId: changeSetId });
  return deepFreeze({ ...escalation, expertResult: appliedResult });
}
