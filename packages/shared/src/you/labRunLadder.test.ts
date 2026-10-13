import assert from "node:assert/strict";
import test from "node:test";
import type { LabRun, LabRunStatus } from "./contract.js";
import {
  applyLabRunTransition,
  bindLabRunEvidenceManifest,
  constructLabRun,
  isLabRunStatus,
  isLabRunTerminal,
  isLegalLabRunTransition,
  LAB_RUN_STATUSES,
  LAB_RUN_TERMINAL_STATUSES,
  labRunStatusIndex,
  labRunTransitionRefusal,
  sortLabRuns,
  validateLabRunInput,
} from "./labRunLadder.js";
import { deepFreeze } from "./serialize.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:01.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

function submittedRun(): LabRun {
  return constructLabRun(
    { experimentId: "you_lab-experiment_0000000000000001", arm: "searched", planHash: "planhash-9a-0001" },
    DEPS,
  );
}

test("the ladder exposes the five frozen rungs and the three locked terminals", () => {
  assert.deepEqual(LAB_RUN_STATUSES, ["submitted", "running", "succeeded", "failed", "retired"]);
  assert.deepEqual(LAB_RUN_TERMINAL_STATUSES, ["succeeded", "failed", "retired"]);
  assert.equal(labRunStatusIndex("submitted"), 0);
  assert.equal(labRunStatusIndex("retired"), 4);
  assert.equal(labRunStatusIndex("paused"), -1);
});

test("membership and terminal predicates", () => {
  for (const status of LAB_RUN_STATUSES) {
    assert.ok(isLabRunStatus(status), status);
  }
  assert.ok(!isLabRunStatus("paused"));
  assert.ok(!isLabRunStatus(42));
  assert.ok(isLabRunTerminal("succeeded"));
  assert.ok(isLabRunTerminal("failed"));
  assert.ok(isLabRunTerminal("retired"));
  assert.ok(!isLabRunTerminal("submitted"));
  assert.ok(!isLabRunTerminal("running"));
});

test("the full transition table: submitted -> running -> exactly the three terminals; terminals lock", () => {
  for (const from of LAB_RUN_STATUSES) {
    for (const to of LAB_RUN_STATUSES) {
      const legal = isLegalLabRunTransition(from, to);
      if (from === "submitted") {
        assert.equal(legal, to === "running", `${from} -> ${to}`);
      } else if (from === "running") {
        assert.equal(legal, isLabRunTerminal(to), `${from} -> ${to}`);
      } else {
        assert.equal(legal, false, `${from} -> ${to} must be locked`);
      }
    }
  }
});

test("refusal reasons are stable strings", () => {
  assert.equal(labRunTransitionRefusal("submitted", "running"), null);
  assert.equal(labRunTransitionRefusal("running", "succeeded"), null);
  assert.equal(labRunTransitionRefusal("running", "failed"), null);
  assert.equal(labRunTransitionRefusal("running", "retired"), null);
  assert.equal(labRunTransitionRefusal("submitted", "submitted"), "no-op-transition");
  assert.equal(labRunTransitionRefusal("running", "running"), "no-op-transition");
  assert.equal(labRunTransitionRefusal("succeeded", "running"), "run-terminal-locked");
  assert.equal(labRunTransitionRefusal("failed", "succeeded"), "run-terminal-locked");
  assert.equal(labRunTransitionRefusal("retired", "failed"), "run-terminal-locked");
  // Off-ladder moves: a run must run before it can finish or retire.
  assert.equal(labRunTransitionRefusal("submitted", "succeeded"), "transition-not-on-ladder");
  assert.equal(labRunTransitionRefusal("submitted", "failed"), "transition-not-on-ladder");
  assert.equal(labRunTransitionRefusal("submitted", "retired"), "transition-not-on-ladder");
  assert.equal(labRunTransitionRefusal("running", "submitted"), "transition-not-on-ladder");
});

test("constructLabRun builds the immutable simulated submitted record", () => {
  const run = submittedRun();
  assert.equal(run.status, "submitted");
  assert.equal(run.experimentId, "you_lab-experiment_0000000000000001");
  assert.equal(run.arm, "searched");
  assert.equal(run.planHash, "planhash-9a-0001");
  assert.equal(run.submittedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(run.completedAt, null);
  assert.equal(run.evidenceManifestRef, null);
  assert.equal(run.simulated, true);
  assert.ok(Object.isFrozen(run));
});

test("constructLabRun refuses malformed intake (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [{ experimentId: "", arm: "searched", planHash: "h" }, "experiment-id-empty"],
    [{ experimentId: "you_lab-experiment_1", arm: "mystery", planHash: "h" }, "arm-invalid"],
    [{ experimentId: "you_lab-experiment_1", arm: "searched", planHash: "" }, "plan-hash-empty"],
    [{ experimentId: "you_lab-experiment_1", arm: "searched", planHash: "  " }, "plan-hash-empty"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabRunInput(input as { experimentId: string; arm: "searched"; planHash: string });
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  assert.throws(
    () => constructLabRun({ experimentId: "you_lab-experiment_1", arm: "searched", planHash: "" }, DEPS),
    /plan-hash-empty/,
  );
});

test("applyLabRunTransition walks the ladder with immutable replacements; terminals lock", () => {
  const original = submittedRun();
  const running = applyLabRunTransition(original, "running", "2026-01-01T00:00:02.000Z");
  assert.equal(running.status, "running");
  assert.equal(running.completedAt, null);
  assert.equal(running.id, original.id);
  // The original record is untouched (append-only ladder law).
  assert.equal(original.status, "submitted");
  assert.ok(Object.isFrozen(running));
  const succeeded = applyLabRunTransition(running, "succeeded", "2026-01-01T00:00:03.000Z");
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.completedAt, "2026-01-01T00:00:03.000Z");
  // Terminal lock: every further move refuses with the stable reason.
  assert.throws(() => applyLabRunTransition(succeeded, "failed", "2026-01-01T00:00:04.000Z"), /run-terminal-locked/);
  assert.throws(() => applyLabRunTransition(succeeded, "succeeded", "2026-01-01T00:00:04.000Z"), /no-op-transition/);
  assert.throws(() => applyLabRunTransition(running, "running", "2026-01-01T00:00:04.000Z"), /no-op-transition/);
  assert.throws(() => applyLabRunTransition(original, "succeeded", "2026-01-01T00:00:04.000Z"), /transition-not-on-ladder/);
});

test("bindLabRunEvidenceManifest replaces the head immutably without a ladder move", () => {
  const terminal = applyLabRunTransition(
    applyLabRunTransition(submittedRun(), "running", "2026-01-01T00:00:02.000Z"),
    "succeeded",
    "2026-01-01T00:00:03.000Z",
  );
  const bound = bindLabRunEvidenceManifest(terminal, "you_lab-evidence-manifest_0000000000000001");
  assert.equal(bound.evidenceManifestRef, "you_lab-evidence-manifest_0000000000000001");
  assert.equal(bound.status, "succeeded");
  assert.equal(bound.completedAt, "2026-01-01T00:00:03.000Z");
  assert.equal(bound.id, terminal.id);
  assert.equal(terminal.evidenceManifestRef, null);
  assert.ok(Object.isFrozen(bound));
});

test("sortLabRuns orders by id deterministically", () => {
  const runA = deepFreeze({ ...submittedRun(), id: "you_lab-run_000000000000000a" });
  const runB = deepFreeze({ ...submittedRun(), id: "you_lab-run_000000000000000b" });
  const runC = deepFreeze({ ...submittedRun(), id: "you_lab-run_000000000000000c" });
  assert.deepEqual(sortLabRuns([runC, runA, runB]).map((run) => run.id), [
    "you_lab-run_000000000000000a",
    "you_lab-run_000000000000000b",
    "you_lab-run_000000000000000c",
  ]);
  const statuses: readonly LabRunStatus[] = LAB_RUN_STATUSES;
  assert.equal(statuses.length, 5);
});
