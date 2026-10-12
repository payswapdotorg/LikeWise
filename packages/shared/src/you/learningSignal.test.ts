import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { LearningSignal } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng, seedFromString } from "./rng.js";
import { LEARNING_SCOPES, isLearningScopeLiteral } from "./learningScope.js";
import {
  createLearningSignal,
  isLearningSignalKind,
  LEARNING_SIGNAL_KINDS,
  validateLearningSignalIntake,
} from "./learningSignal.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6101)) };

function intake(overrides: Partial<Parameters<typeof createLearningSignal>[0]> = {}) {
  return {
    kind: "feedback" as const,
    scope: "USER" as const,
    subjectRef: null,
    evidenceRefs: ["you_content_0123456789abcdef"],
    simulated: true,
    ...overrides,
  };
}

test("the six frozen learning signal kinds are enumerated exactly once each", () => {
  assert.deepEqual(LEARNING_SIGNAL_KINDS, [
    "feedback",
    "manual-takeover",
    "edit-session",
    "expert-intervention",
    "repeated-intent",
    "capability-gap",
  ]);
  for (const kind of LEARNING_SIGNAL_KINDS) {
    assert.equal(isLearningSignalKind(kind), true);
  }
  assert.equal(isLearningSignalKind("feedback "), false);
  assert.equal(isLearningSignalKind("telepathy"), false);
  assert.equal(isLearningSignalKind(""), false);
});

test("the v1 LearningScope union is reused verbatim (eight UPPERCASE literals)", () => {
  assert.deepEqual(LEARNING_SCOPES, ["GLOBAL", "TENANT", "APPLICATION", "PROJECT", "USER", "TWIN", "ASSET", "TASK"]);
  for (const scope of LEARNING_SCOPES) {
    assert.equal(isLearningScopeLiteral(scope), true);
  }
  assert.equal(isLearningScopeLiteral("user"), false);
  assert.equal(isLearningScopeLiteral("ORG"), false);
  assert.equal(isLearningScopeLiteral(""), false);
});

test("stateless intake validation accepts all six kinds with content-addressed evidence refs", () => {
  for (const kind of LEARNING_SIGNAL_KINDS) {
    const outcome = validateLearningSignalIntake(intake({ kind }));
    assert.deepEqual(outcome, { ok: true });
  }
});

test("stateless intake validation refuses an unknown kind with the typed invalid-kind refusal", () => {
  const outcome = validateLearningSignalIntake(intake({ kind: "telepathy" as unknown as "feedback" }));
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "invalid-kind");
  assert.match(outcome.detail, /six frozen kinds/);
});

test("stateless intake validation refuses a non-v1 scope with the typed invalid-scope refusal", () => {
  const lower = validateLearningSignalIntake(intake({ scope: "user" as unknown as "USER" }));
  assert.ok(!lower.ok);
  assert.equal(lower.code, "invalid-scope");

  const unknown = validateLearningSignalIntake(intake({ scope: "PLANET" as unknown as "USER" }));
  assert.ok(!unknown.ok);
  assert.equal(unknown.code, "invalid-scope");
});

test("stateless intake validation refuses malformed subject refs", () => {
  const outcome = validateLearningSignalIntake(intake({ subjectRef: "" }));
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "invalid-subject-ref");
});

test("stateless intake validation refuses empty evidence ref lists", () => {
  const outcome = validateLearningSignalIntake(intake({ evidenceRefs: [] }));
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "empty-evidence-refs");
  assert.match(outcome.detail, /at least one/);
});

test("stateless intake validation refuses malformed and duplicate evidence refs with the ref index", () => {
  const empty = validateLearningSignalIntake(intake({ evidenceRefs: ["you_content_0123456789abcdef", ""] }));
  assert.ok(!empty.ok);
  assert.equal(empty.code, "invalid-evidence-ref");
  assert.equal(empty.refIndex, 1);

  const padded = validateLearningSignalIntake(intake({ evidenceRefs: [" you_content_0123456789abcdef"] }));
  assert.ok(!padded.ok);
  assert.equal(padded.code, "invalid-evidence-ref");
  assert.equal(padded.refIndex, 0);

  const duplicate = validateLearningSignalIntake(
    intake({ evidenceRefs: ["you_content_0123456789abcdef", "you_content_0123456789abcdef"] }),
  );
  assert.ok(!duplicate.ok);
  assert.equal(duplicate.code, "invalid-evidence-ref");
  assert.equal(duplicate.refIndex, 1);
});

test("createLearningSignal builds an immutable, simulated-labeled record with an injected-clock timestamp", () => {
  const created = createLearningSignal(intake({ subjectRef: "you_solution_subject01" }), DEPS);
  assert.ok(created.ok);
  const signal: LearningSignal = created.signal;
  assert.equal(signal.kind, "feedback");
  assert.equal(signal.scope, "USER");
  assert.equal(signal.subjectRef, "you_solution_subject01");
  assert.deepEqual(signal.evidenceRefs, ["you_content_0123456789abcdef"]);
  assert.equal(signal.simulated, true);
  assert.equal(signal.capturedAt, "2026-01-01T00:00:00.000Z");
  assert.match(signal.id, /^you_learning-signal_[0-9a-f]{16}$/);

  assert.ok(Object.isFrozen(signal));
  assert.ok(Object.isFrozen(signal.evidenceRefs));
  assert.throws(() => {
    (signal as { kind: string }).kind = "manual-takeover";
  }, TypeError);
  assert.throws(() => {
    (signal.evidenceRefs as unknown as string[]).push("you_content_ffffffffffffffff");
  }, TypeError);
});

test("createLearningSignal maps stateless refusals through unchanged (no clock use on refusal)", () => {
  const ticksBefore = (DEPS.clock as { ticks: number }).ticks;
  const outcome = createLearningSignal(intake({ kind: "dream" as unknown as "feedback" }), DEPS);
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "invalid-kind");
  // The refusal path consumed no clock ticks (stateless validators, no clock).
  const ticksAfter = (DEPS.clock as { ticks: number }).ticks;
  assert.equal(ticksAfter, ticksBefore);
});

test("signals are deterministic for a fixed seed: same rng seed => same id sequence", () => {
  const depsA = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(seedFromString("w6a-signal"))) };
  const depsB = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(seedFromString("w6a-signal"))) };
  const a = createLearningSignal(intake(), depsA);
  const b = createLearningSignal(intake(), depsB);
  assert.ok(a.ok && b.ok);
  assert.equal(a.signal.id, b.signal.id);
  assert.equal(a.signal.capturedAt, b.signal.capturedAt);
});
