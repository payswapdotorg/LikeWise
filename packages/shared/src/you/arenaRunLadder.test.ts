import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaRun, ArenaRunStatus } from "./contract.js";
import {
  applyArenaRunTerminal,
  ARENA_RUN_GAP_CATEGORIES,
  ARENA_RUN_STATUSES,
  ARENA_RUN_TERMINAL_STATUSES,
  arenaRunStatusIndex,
  arenaRunTransitionRefusal,
  constructArenaRun,
  isArenaRunStatus,
  isArenaRunTerminal,
  isLegalArenaRunTransition,
  sortArenaRuns,
  validateArenaRunInput,
} from "./arenaRunLadder.js";
import { deepFreeze } from "./serialize.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:01.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

function startedRun(): ArenaRun {
  return constructArenaRun({ gapId: "you_gap_0000000000000001", strategy: "gltf-transform", attempt: 1 }, DEPS);
}

test("the ladder exposes the four frozen rungs and the three locked terminals", () => {
  assert.deepEqual(ARENA_RUN_STATUSES, ["started", "completed", "failed", "aborted"]);
  assert.deepEqual(ARENA_RUN_TERMINAL_STATUSES, ["completed", "failed", "aborted"]);
  assert.equal(arenaRunStatusIndex("started"), 0);
  assert.equal(arenaRunStatusIndex("aborted"), 3);
  assert.equal(arenaRunStatusIndex("paused"), -1);
});

test("membership and terminal predicates", () => {
  for (const status of ARENA_RUN_STATUSES) {
    assert.ok(isArenaRunStatus(status), status);
  }
  assert.ok(!isArenaRunStatus("paused"));
  assert.ok(!isArenaRunStatus(42));
  assert.ok(isArenaRunTerminal("completed"));
  assert.ok(isArenaRunTerminal("failed"));
  assert.ok(isArenaRunTerminal("aborted"));
  assert.ok(!isArenaRunTerminal("started"));
});

test("the full transition table: started reaches exactly the three terminals; terminals lock", () => {
  for (const from of ARENA_RUN_STATUSES) {
    for (const to of ARENA_RUN_STATUSES) {
      const legal = isLegalArenaRunTransition(from, to);
      if (from === "started") {
        assert.equal(legal, isArenaRunTerminal(to), `${from} -> ${to}`);
      } else {
        assert.equal(legal, false, `${from} -> ${to} must be locked`);
      }
    }
  }
});

test("refusal reasons are stable strings", () => {
  assert.equal(arenaRunTransitionRefusal("started", "completed"), null);
  assert.equal(arenaRunTransitionRefusal("started", "failed"), null);
  assert.equal(arenaRunTransitionRefusal("started", "aborted"), null);
  assert.equal(arenaRunTransitionRefusal("started", "started"), "no-op-transition");
  assert.equal(arenaRunTransitionRefusal("completed", "started"), "run-terminal-locked");
  assert.equal(arenaRunTransitionRefusal("failed", "completed"), "run-terminal-locked");
  assert.equal(arenaRunTransitionRefusal("aborted", "failed"), "run-terminal-locked");
  assert.equal(arenaRunTransitionRefusal("completed", "completed"), "no-op-transition");
});

test("constructArenaRun builds the immutable simulated started record", () => {
  const run = startedRun();
  assert.equal(run.status, "started");
  assert.equal(run.attempt, 1);
  assert.equal(run.strategy, "gltf-transform");
  assert.equal(run.startedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(run.completedAt, null);
  assert.equal(run.outcomeEvidenceRef, null);
  assert.equal(run.simulated, true);
  assert.ok(Object.isFrozen(run));
});

test("constructArenaRun refuses malformed intake (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [{ gapId: "you_gap_1", strategy: "", attempt: 1 }, "strategy-empty"],
    [{ gapId: "you_gap_1", strategy: "  ", attempt: 1 }, "strategy-empty"],
    [{ gapId: "you_gap_1", strategy: "search", attempt: 0 }, "attempt-invalid"],
    [{ gapId: "you_gap_1", strategy: "search", attempt: 1.5 }, "attempt-invalid"],
    [{ gapId: "you_gap_1", strategy: "search", attempt: -1 }, "attempt-invalid"],
    [{ gapId: "", strategy: "search", attempt: 1 }, "gap-id-empty"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateArenaRunInput(input as { gapId: string; strategy: string; attempt: number });
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(
    () => constructArenaRun({ gapId: "you_gap_1", strategy: "", attempt: 1 }, DEPS),
    /strategy-empty/,
  );
});

test("applyArenaRunTerminal replaces the record immutably and locks terminals", () => {
  const original = startedRun();
  const completed = applyArenaRunTerminal(original, "completed", "you_evidence_0000000000000001", "2026-01-01T00:00:02.000Z");
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, "2026-01-01T00:00:02.000Z");
  assert.equal(completed.outcomeEvidenceRef, "you_evidence_0000000000000001");
  assert.equal(completed.id, original.id);
  assert.equal(completed.attempt, original.attempt);
  // The original record is untouched (append-only ladder law).
  assert.equal(original.status, "started");
  assert.equal(original.completedAt, null);
  assert.ok(Object.isFrozen(completed));
  // Terminals refuse further transitions.
  assert.throws(() => applyArenaRunTerminal(completed, "failed", null, "2026-01-01T00:00:03.000Z"), /run-terminal-locked/);
  assert.throws(() => applyArenaRunTerminal(completed, "completed", null, "2026-01-01T00:00:03.000Z"), /no-op-transition/);
});

test("sortArenaRuns orders by id deterministically", () => {
  const runA = deepFreeze({ ...startedRun(), id: "you_arena-run_000000000000000a" });
  const runB = deepFreeze({ ...startedRun(), id: "you_arena-run_000000000000000b" });
  const runC = deepFreeze({ ...startedRun(), id: "you_arena-run_000000000000000c" });
  assert.deepEqual(sortArenaRuns([runC, runA, runB]).map((run) => run.id), [
    "you_arena-run_000000000000000a",
    "you_arena-run_000000000000000b",
    "you_arena-run_000000000000000c",
  ]);
  // The status union is closed under the v1 gap categories.
  assert.equal(ARENA_RUN_GAP_CATEGORIES.length, 7);
  const statuses: readonly ArenaRunStatus[] = ARENA_RUN_STATUSES;
  assert.equal(statuses.length, 4);
});
