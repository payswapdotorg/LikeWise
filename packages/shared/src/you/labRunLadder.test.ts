import assert from "node:assert/strict";
import test from "node:test";
import type { LabRun } from "./contract.js";
import {
  advanceLabRun,
  attachLabRunEvidence,
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
  type LabRunInput,
} from "./labRunLadder.js";

const DEPS = {
  now: (): string => "2026-01-01T00:00:01.000Z",
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

function submittedRun(): LabRun {
  return constructLabRun(
    { experimentId: "you_lab-experiment_0000000000000001", arm: "searched", planHash: "plan-hash-abc" },
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
  assert.ok(!isLabRunStatus("queued"));
  assert.ok(!isLabRunStatus(42));
  assert.ok(isLabRunTerminal("succeeded"));
  assert.ok(isLabRunTerminal("failed"));
  assert.ok(isLabRunTerminal("retired"));
  assert.ok(!isLabRunTerminal("submitted"));
  assert.ok(!isLabRunTerminal("running"));
});

test("the full 25-cell transition table: submitted -> running -> a terminal; terminals lock", () => {
  const LEGAL: Readonly<Record<string, ReadonlySet<string>>> = {
    submitted: new Set(["running"]),
    running: new Set(["succeeded", "failed", "retired"]),
    succeeded: new Set([]),
    failed: new Set([]),
    retired: new Set([]),
  };
  let legalCount = 0;
  for (const from of LAB_RUN_STATUSES) {
    for (const to of LAB_RUN_STATUSES) {
      const legal = isLegalLabRunTransition(from, to);
      assert.equal(legal, (LEGAL[from] as ReadonlySet<string>).has(to), `${from} -> ${to}`);
      if (legal) {
        legalCount += 1;
      }
    }
  }
  assert.equal(legalCount, 4);
});

test("refusal reasons are stable strings", () => {
  assert.equal(labRunTransitionRefusal("submitted", "running"), null);
  assert.equal(labRunTransitionRefusal("running", "succeeded"), null);
  assert.equal(labRunTransitionRefusal("running", "failed"), null);
  assert.equal(labRunTransitionRefusal("running", "retired"), null);
  assert.equal(labRunTransitionRefusal("submitted", "succeeded"), "transition-not-on-ladder");
  assert.equal(labRunTransitionRefusal("submitted", "retired"), "transition-not-on-ladder");
  assert.equal(labRunTransitionRefusal("running", "submitted"), "transition-not-on-ladder");
  assert.equal(labRunTransitionRefusal("submitted", "submitted"), "no-op-transition");
  assert.equal(labRunTransitionRefusal("running", "running"), "no-op-transition");
  assert.equal(labRunTransitionRefusal("succeeded", "succeeded"), "no-op-transition");
  assert.equal(labRunTransitionRefusal("succeeded", "running"), "run-terminal-locked");
  assert.equal(labRunTransitionRefusal("failed", "succeeded"), "run-terminal-locked");
  assert.equal(labRunTransitionRefusal("retired", "failed"), "run-terminal-locked");
});

test("constructLabRun builds the immutable simulated submitted record", () => {
  const run = submittedRun();
  assert.equal(run.status, "submitted");
  assert.equal(run.arm, "searched");
  assert.equal(run.planHash, "plan-hash-abc");
  assert.equal(run.experimentId, "you_lab-experiment_0000000000000001");
  assert.equal(run.submittedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(run.completedAt, null);
  assert.equal(run.evidenceManifestRef, null);
  assert.equal(run.simulated, true);
  assert.ok(Object.isFrozen(run));
});

test("constructLabRun refuses malformed intake (validator never throws)", () => {
  const cases: readonly [unknown, string][] = [
    [{ experimentId: "", arm: "searched", planHash: "p" }, "experiment-id-empty"],
    [{ experimentId: "you_lab-experiment_1", arm: "champion", planHash: "p" }, "arm-invalid"],
    [{ experimentId: "you_lab-experiment_1", arm: "searched", planHash: "" }, "plan-hash-empty"],
    [{ experimentId: "you_lab-experiment_1", arm: "searched", planHash: "   " }, "plan-hash-empty"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateLabRunInput(input as LabRunInput);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  const wrongArm = { experimentId: "you_lab-experiment_1", arm: "nope", planHash: "p" };
  assert.throws(
    () => constructLabRun(wrongArm as LabRunInput, DEPS),
    /arm-invalid/,
  );
});

test("advanceLabRun walks the ladder with immutable replacement; terminals lock", () => {
  const original = submittedRun();
  const running = advanceLabRun(original, "running", "2026-01-01T00:00:02.000Z");
  assert.equal(running.status, "running");
  assert.equal(running.completedAt, null);
  assert.equal(running.id, original.id);
  // The original record is untouched (immutable replacement law).
  assert.equal(original.status, "submitted");
  assert.ok(Object.isFrozen(running));
  const succeeded = advanceLabRun(running, "succeeded", "2026-01-01T00:00:03.000Z");
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.completedAt, "2026-01-01T00:00:03.000Z");
  assert.equal(running.completedAt, null);
  // Terminals refuse further transitions.
  assert.throws(() => advanceLabRun(succeeded, "failed", "2026-01-01T00:00:04.000Z"), /run-terminal-locked/);
  assert.throws(() => advanceLabRun(succeeded, "succeeded", "2026-01-01T00:00:04.000Z"), /no-op-transition/);
  // Off-ladder moves refuse before they start.
  assert.throws(() => advanceLabRun(original, "retired", "2026-01-01T00:00:04.000Z"), /transition-not-on-ladder/);
});

test("attachLabRunEvidence replaces the run head immutably", () => {
  const run = submittedRun();
  const bound = attachLabRunEvidence(run, "you_lab-evidence-manifest_0000000000000001");
  assert.equal(bound.evidenceManifestRef, "you_lab-evidence-manifest_0000000000000001");
  assert.equal(bound.status, run.status);
  assert.equal(run.evidenceManifestRef, null);
  assert.ok(Object.isFrozen(bound));
  assert.throws(() => attachLabRunEvidence(run, ""), /non-empty evidence manifest ref/);
});

test("sortLabRuns orders by id (stable ordering law)", () => {
  const first = constructLabRun(
    { experimentId: "you_lab-experiment_1", arm: "searched", planHash: "p1" },
    DEPS,
  );
  const second = constructLabRun(
    { experimentId: "you_lab-experiment_1", arm: "searched", planHash: "p2" },
    DEPS,
  );
  const sorted = sortLabRuns([second, first]);
  assert.deepEqual(
    sorted.map((run) => run.id),
    [first.id, second.id],
  );
});
