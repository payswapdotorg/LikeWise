// YOU agent embodiment state ladder (W7A — docs/you/CONTRACTS.md "Wave-7
// contract freeze (v7)": "EmbodimentState (the nine-state listening/reading/
// typing/thinking/tool_use/speaking/interrupted/idle/unavailable ladder)").
//
// This module owns the pure ladder machinery: membership validation, the
// frozen W7A transition table, and stable-ordering helpers. The ladder is a
// projection, never an authority (docs/you/CONTRACTS.md BODY/SOUL
// SEPARATION LAW) — every state change is an append-only
// embodiment-state-changed event; nothing here mutates records.
//
// Transition-table decisions (frozen W7A fixture definition):
// - The eight INTERACTION rungs (listening, reading, typing, thinking,
//   tool_use, speaking, interrupted, idle) are fully connected in both
//   directions: an embodied agent may move between any two observable
//   activity states directly (including into and out of "interrupted").
// - Self-transitions are refused: a state change must change the state.
// - The "unavailable" rung is LIFECYCLE-owned: it is entered only by
//   suspend/close and left only by resume (-> idle) through the avatar
//   session lifecycle ops. The generic embodiment-state transition op
//   never enters or leaves it.

import type { EmbodimentState } from "./contract.js";

/** The nine ladder rungs in frozen canonical order. */
export const EMBODIMENT_STATES = [
  "listening",
  "reading",
  "typing",
  "thinking",
  "tool_use",
  "speaking",
  "interrupted",
  "idle",
  "unavailable",
] as const;

/** The eight interaction rungs (every rung except lifecycle-owned "unavailable"). */
export const EMBODIMENT_INTERACTION_STATES = [
  "listening",
  "reading",
  "typing",
  "thinking",
  "tool_use",
  "speaking",
  "interrupted",
  "idle",
] as const;

export type EmbodimentInteractionState = (typeof EMBODIMENT_INTERACTION_STATES)[number];

const STATE_SET: ReadonlySet<string> = new Set(EMBODIMENT_STATES);
const INTERACTION_SET: ReadonlySet<string> = new Set(EMBODIMENT_INTERACTION_STATES);

/** True when the value is one of the nine frozen ladder rungs. */
export function isEmbodimentState(value: unknown): value is EmbodimentState {
  return typeof value === "string" && STATE_SET.has(value);
}

/** True when the value is one of the eight interaction rungs. */
export function isEmbodimentInteractionState(value: unknown): value is EmbodimentInteractionState {
  return typeof value === "string" && INTERACTION_SET.has(value);
}

/** Canonical ladder index of a rung (0-8), or -1 when off-ladder. */
export function embodimentStateIndex(state: string): number {
  return EMBODIMENT_STATES.indexOf(state as EmbodimentState);
}

/** Sorts ladder states into the frozen canonical order (stable, deduplicated). */
export function sortEmbodimentStates(states: readonly string[]): EmbodimentState[] {
  return [...new Set(states.filter((state) => isEmbodimentState(state)))].sort(
    (a, b) => embodimentStateIndex(a) - embodimentStateIndex(b),
  );
}

/**
 * The generic transition-table predicate: may the embodied activity state
 * move from `from` to `to` through the embodiment-state-changed event
 * stream? Lifecycle ownership rules apply (see module header).
 */
export function isLegalEmbodimentTransition(from: EmbodimentState, to: EmbodimentState): boolean {
  return embodimentTransitionRefusal(from, to) === null;
}

/**
 * Why a generic transition is refused, or null when it is legal. Reasons
 * are stable strings (they ride along in typed YOU_EMBODIMENT_STATE_INVALID
 * error details and fixture facts).
 */
export function embodimentTransitionRefusal(from: EmbodimentState, to: EmbodimentState): string | null {
  if (from === to) {
    return "no-op-transition";
  }
  if (to === "unavailable") {
    return "unavailable-is-lifecycle-owned";
  }
  if (from === "unavailable") {
    return "unavailable-is-lifecycle-owned";
  }
  return null;
}

/** The state a suspended session projects (lifecycle-owned rung). */
export const EMBODIMENT_SUSPENDED_STATE: EmbodimentState = "unavailable";

/** The state a resumed session projects (return to rest). */
export const EMBODIMENT_RESUMED_STATE: EmbodimentState = "idle";

/** The default opening state of a freshly possessed Body. */
export const EMBODIMENT_DEFAULT_OPEN_STATE: EmbodimentInteractionState = "idle";
