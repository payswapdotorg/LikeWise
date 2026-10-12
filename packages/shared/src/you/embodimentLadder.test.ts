import assert from "node:assert/strict";
import test from "node:test";
import type { EmbodimentState } from "./contract.js";
import {
  EMBODIMENT_DEFAULT_OPEN_STATE,
  EMBODIMENT_INTERACTION_STATES,
  EMBODIMENT_RESUMED_STATE,
  EMBODIMENT_STATES,
  EMBODIMENT_SUSPENDED_STATE,
  embodimentStateIndex,
  embodimentTransitionRefusal,
  isEmbodimentInteractionState,
  isEmbodimentState,
  isLegalEmbodimentTransition,
  sortEmbodimentStates,
} from "./embodimentLadder.js";

test("the ladder exposes exactly the nine frozen v7 rungs in canonical order", () => {
  assert.deepEqual(EMBODIMENT_STATES, [
    "listening",
    "reading",
    "typing",
    "thinking",
    "tool_use",
    "speaking",
    "interrupted",
    "idle",
    "unavailable",
  ]);
  assert.equal(EMBODIMENT_STATES.length, 9);
});

test("isEmbodimentState accepts the nine rungs and refuses everything else", () => {
  for (const state of EMBODIMENT_STATES) {
    assert.equal(isEmbodimentState(state), true, state);
  }
  for (const junk of ["Listening", "PONTIFICATING", "", "tool-use", "tooluse ", "unavailable\n", null, 7, undefined]) {
    assert.equal(isEmbodimentState(junk), false, String(junk));
  }
});

test("isEmbodimentInteractionState covers the eight interaction rungs, excluding unavailable", () => {
  for (const state of EMBODIMENT_INTERACTION_STATES) {
    assert.equal(isEmbodimentInteractionState(state), true, state);
  }
  assert.equal(isEmbodimentInteractionState("unavailable"), false);
  assert.equal(EMBODIMENT_INTERACTION_STATES.length, 8);
});

test("embodimentStateIndex is the canonical ladder position; -1 off-ladder", () => {
  assert.equal(embodimentStateIndex("listening"), 0);
  assert.equal(embodimentStateIndex("unavailable"), 8);
  assert.equal(embodimentStateIndex("pontificating"), -1);
});

test("sortEmbodimentStates deduplicates and orders by ladder position", () => {
  const sorted = sortEmbodimentStates(["idle", "speaking", "idle", "listening", "tool_use", "listening"]);
  assert.deepEqual(sorted, ["listening", "tool_use", "speaking", "idle"]);
  assert.deepEqual(sortEmbodimentStates(["junk", "typing", "reading"]), ["reading", "typing"]);
});

test("the transition table is fully connected across the eight interaction rungs (no self-loops)", () => {
  for (const from of EMBODIMENT_INTERACTION_STATES) {
    for (const to of EMBODIMENT_INTERACTION_STATES) {
      const legal = isLegalEmbodimentTransition(from, to);
      assert.equal(legal, from !== to, `${from} -> ${to}`);
    }
    // The unavailable rung is lifecycle-owned: never entered or left generically.
    assert.equal(isLegalEmbodimentTransition(from, "unavailable"), false, `${from} -> unavailable`);
    assert.equal(isLegalEmbodimentTransition("unavailable", from), false, `unavailable -> ${from}`);
  }
});

test("self-transitions are refused with the no-op reason", () => {
  for (const state of EMBODIMENT_STATES) {
    assert.equal(embodimentTransitionRefusal(state, state), "no-op-transition", state);
  }
});

test("the unavailable rung refuses generic transitions in both directions with a stable reason", () => {
  for (const from of EMBODIMENT_INTERACTION_STATES) {
    assert.equal(embodimentTransitionRefusal(from, "unavailable"), "unavailable-is-lifecycle-owned");
  }
  for (const to of EMBODIMENT_INTERACTION_STATES) {
    assert.equal(embodimentTransitionRefusal("unavailable", to), "unavailable-is-lifecycle-owned");
  }
});

test("lifecycle constants pin the frozen W7A mapping (open/suspend/resume)", () => {
  const openState: EmbodimentState = EMBODIMENT_DEFAULT_OPEN_STATE;
  const suspendedState: EmbodimentState = EMBODIMENT_SUSPENDED_STATE;
  const resumedState: EmbodimentState = EMBODIMENT_RESUMED_STATE;
  assert.equal(openState, "idle");
  assert.equal(suspendedState, "unavailable");
  assert.equal(resumedState, "idle");
});
