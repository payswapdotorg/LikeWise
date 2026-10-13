import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaEscalationRef } from "./contract.js";
import {
  ARENA_ESCALATION_STATUSES,
  ARENA_ESCALATION_TERMINAL_STATUSES,
  ARENA_ESCALATION_TRANSITIONS,
  applyArenaEscalationTransition,
  arenaEscalationStatusIndex,
  arenaEscalationTransitionRefusal,
  attachArenaExpertResult,
  constructArenaEscalationRef,
  isArenaEscalationStatus,
  isArenaEscalationTerminal,
  isLegalArenaEscalationTransition,
  markArenaExpertResultApplied,
} from "./arenaEscalationLadder.js";

const DEPS = { nextId: (kind: string): string => `you_${kind}_0000000000000001` };

const CONTEXT = ["intent-reference", "capability-gap-record", "relevant-solution-version", "privacy-policy"];

function requested(): ArenaEscalationRef {
  return constructArenaEscalationRef(CONTEXT, DEPS);
}

test("the ladder exposes the seven v1 rungs and the three locked terminals", () => {
  assert.deepEqual(ARENA_ESCALATION_STATUSES, [
    "requested",
    "authorized",
    "in-progress",
    "delivered",
    "applied",
    "rejected",
    "cancelled",
  ]);
  assert.deepEqual(ARENA_ESCALATION_TERMINAL_STATUSES, ["applied", "rejected", "cancelled"]);
  assert.equal(arenaEscalationStatusIndex("requested"), 0);
  assert.equal(arenaEscalationStatusIndex("cancelled"), 6);
  assert.equal(arenaEscalationStatusIndex("paused"), -1);
  for (const status of ARENA_ESCALATION_STATUSES) {
    assert.ok(isArenaEscalationStatus(status), status);
  }
  assert.ok(!isArenaEscalationStatus("awaiting"));
  assert.ok(!isArenaEscalationStatus(null));
});

test("membership and terminal predicates", () => {
  assert.ok(isArenaEscalationTerminal("applied"));
  assert.ok(isArenaEscalationTerminal("rejected"));
  assert.ok(isArenaEscalationTerminal("cancelled"));
  assert.ok(!isArenaEscalationTerminal("requested"));
  assert.ok(!isArenaEscalationTerminal("in-progress"));
});

test("the transition table matches the frozen v1 ladder exactly", () => {
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS.requested, ["authorized", "cancelled"]);
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS.authorized, ["in-progress", "cancelled"]);
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS["in-progress"], ["delivered", "cancelled"]);
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS.delivered, ["applied", "rejected"]);
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS.applied, []);
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS.rejected, []);
  assert.deepEqual(ARENA_ESCALATION_TRANSITIONS.cancelled, []);
});

test("the full 7x7 transition matrix: only the table's edges are legal", () => {
  const legalEdges = new Set<string>([
    "requested->authorized",
    "requested->cancelled",
    "authorized->in-progress",
    "authorized->cancelled",
    "in-progress->delivered",
    "in-progress->cancelled",
    "delivered->applied",
    "delivered->rejected",
  ]);
  for (const from of ARENA_ESCALATION_STATUSES) {
    for (const to of ARENA_ESCALATION_STATUSES) {
      const legal = isLegalArenaEscalationTransition(from, to);
      assert.equal(legal, legalEdges.has(`${from}->${to}`), `${from} -> ${to}`);
    }
  }
});

test("refusal reasons are stable strings (terminal locks, no-ops, off-ladder)", () => {
  assert.equal(arenaEscalationTransitionRefusal("requested", "authorized"), null);
  assert.equal(arenaEscalationTransitionRefusal("requested", "delivered"), "transition-not-on-ladder");
  assert.equal(arenaEscalationTransitionRefusal("requested", "requested"), "no-op-transition");
  assert.equal(arenaEscalationTransitionRefusal("delivered", "cancelled"), "transition-not-on-ladder");
  assert.equal(arenaEscalationTransitionRefusal("applied", "requested"), "escalation-terminal-locked");
  assert.equal(arenaEscalationTransitionRefusal("rejected", "applied"), "escalation-terminal-locked");
  assert.equal(arenaEscalationTransitionRefusal("cancelled", "authorized"), "escalation-terminal-locked");
  assert.equal(arenaEscalationTransitionRefusal("applied", "applied"), "no-op-transition");
});

test("constructArenaEscalationRef builds the immutable requested ref with the context capsule", () => {
  const escalation = requested();
  assert.equal(escalation.status, "requested");
  assert.equal(escalation.expertResult, null);
  assert.deepEqual(escalation.minimumContext, CONTEXT);
  assert.ok(Object.isFrozen(escalation));
  assert.ok(Object.isFrozen(escalation.minimumContext));
});

test("ladder transitions replace the ref immutably", () => {
  const original = requested();
  const authorized = applyArenaEscalationTransition(original, "authorized");
  assert.equal(authorized.status, "authorized");
  assert.equal(original.status, "requested");
  const inProgress = applyArenaEscalationTransition(authorized, "in-progress");
  assert.equal(inProgress.status, "in-progress");
  const delivered = applyArenaEscalationTransition(inProgress, "delivered");
  assert.equal(delivered.status, "delivered");
  const applied = applyArenaEscalationTransition(delivered, "applied");
  assert.equal(applied.status, "applied");
  // Terminals lock.
  assert.throws(() => applyArenaEscalationTransition(applied, "requested"), /escalation-terminal-locked/);
  // The success path refuses shortcuts.
  assert.throws(() => applyArenaEscalationTransition(original, "applied"), /transition-not-on-ladder/);
  // Cancellation is legal from every pre-terminal rung.
  assert.equal(applyArenaEscalationTransition(requested(), "cancelled").status, "cancelled");
  assert.equal(applyArenaEscalationTransition(authorized, "cancelled").status, "cancelled");
  assert.equal(applyArenaEscalationTransition(inProgress, "cancelled").status, "cancelled");
});

test("expert results attach only on delivered (or applied) rungs", () => {
  const result = {
    deliveredAt: "2026-01-01T00:10:42.000Z",
    resultType: "typed-payload" as const,
    payload: { remediation: "tool-substitution", qualityBoost: 0.12 },
    appliesAsChangeSetId: null,
  };
  assert.throws(() => attachArenaExpertResult(requested(), result), /refused on status requested/);
  const delivered = applyArenaEscalationTransition(applyArenaEscalationTransition(requested(), "authorized"), "in-progress");
  const withResult = attachArenaExpertResult(applyArenaEscalationTransition(delivered, "delivered"), result);
  assert.deepEqual(withResult.expertResult, result);
  assert.throws(
    () => markArenaExpertResultApplied(applyArenaEscalationTransition(requested(), "authorized"), "you_change-set_1"),
    /refused on status authorized/,
  );
  const applied = markArenaExpertResultApplied(withResult, "you_change-set_0000000000000001");
  assert.equal(applied.status, "delivered");
  assert.equal(applied.expertResult?.appliesAsChangeSetId, "you_change-set_0000000000000001");
});
