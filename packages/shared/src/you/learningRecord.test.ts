import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { LearningRecord } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { INERT_LEARNING_RIGHTS } from "./learningRights.js";
import {
  createLearningCandidateRecord,
  isLegalLearningRecordTransition,
  isTerminalLearningRecordStatus,
  LEARNING_RECORD_TRANSITIONS,
  transitionLearningRecord,
  validateLearningRecordIntake,
} from "./learningRecord.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6103)) };
const NOW = "2026-01-01T00:00:00.000Z";

const RIGHTS = {
  usage: ["personalization"],
  consentRef: "you_consent-policy_0000000000000001",
  consentHash: "a".repeat(64),
  expiresAt: null,
} as const;

function intake(overrides: Partial<Parameters<typeof createLearningCandidateRecord>[0]> = {}) {
  return {
    signalId: "you_learning-signal_0000000000000001",
    scope: "USER" as const,
    contentRef: "you_content_0123456789abcdef",
    contentHash: "b".repeat(64),
    rights: RIGHTS,
    simulated: true,
    ...overrides,
  };
}

test("the validation ladder transition table is exactly candidate -> validated | rejected; validated -> superseded; terminals locked", () => {
  assert.deepEqual(LEARNING_RECORD_TRANSITIONS, {
    candidate: ["validated", "rejected"],
    validated: ["superseded"],
    rejected: [],
    superseded: [],
  });

  // The full legal/illegal matrix.
  const expected: Readonly<Record<string, readonly string[]>> = {
    candidate: ["validated", "rejected"],
    validated: ["superseded"],
    rejected: [],
    superseded: [],
  };
  for (const from of Object.keys(expected) as (keyof typeof LEARNING_RECORD_TRANSITIONS)[]) {
    for (const to of Object.keys(expected) as (keyof typeof LEARNING_RECORD_TRANSITIONS)[]) {
      assert.equal(
        isLegalLearningRecordTransition(from, to),
        (expected[from] as readonly string[]).includes(to),
        `${from} -> ${to}`,
      );
    }
  }

  assert.equal(isTerminalLearningRecordStatus("candidate"), false);
  assert.equal(isTerminalLearningRecordStatus("validated"), false);
  assert.equal(isTerminalLearningRecordStatus("rejected"), true);
  assert.equal(isTerminalLearningRecordStatus("superseded"), true);
});

test("createLearningCandidateRecord builds an immutable candidate with the ladder timestamp and inert-rights support", () => {
  const created = createLearningCandidateRecord(intake(), DEPS);
  assert.ok(created.ok);
  const record: LearningRecord = created.record;
  assert.equal(record.status, "candidate");
  assert.equal(record.signalId, "you_learning-signal_0000000000000001");
  assert.equal(record.scope, "USER");
  assert.equal(record.contentRef, "you_content_0123456789abcdef");
  assert.equal(record.contentHash, "b".repeat(64));
  assert.equal(record.supersededById, null);
  assert.equal(record.simulated, true);
  assert.equal(record.validatedAt, "2026-01-01T00:00:00.000Z");
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.rights));
  assert.ok(Object.isFrozen(record.rights.usage));

  const inert = createLearningCandidateRecord(intake({ rights: INERT_LEARNING_RIGHTS }), DEPS);
  assert.ok(inert.ok);
  assert.equal(inert.record.status, "candidate");
});

test("stateless record-intake validation: signal id, scope, content binding, rights shape", () => {
  assert.deepEqual(validateLearningRecordIntake(intake()), { ok: true });

  const noSignal = validateLearningRecordIntake(intake({ signalId: "" }));
  assert.ok(!noSignal.ok);
  assert.equal(noSignal.code, "invalid-signal-id");

  const badScope = validateLearningRecordIntake(intake({ scope: "user" as unknown as "USER" }));
  assert.ok(!badScope.ok);
  assert.equal(badScope.code, "invalid-scope");

  const noRef = validateLearningRecordIntake(intake({ contentRef: "" }));
  assert.ok(!noRef.ok);
  assert.equal(noRef.code, "invalid-content-binding");

  const badHash = validateLearningRecordIntake(intake({ contentHash: "not-a-hash" }));
  assert.ok(!badHash.ok);
  assert.equal(badHash.code, "invalid-content-binding");

  const badRights = validateLearningRecordIntake(
    intake({ rights: { usage: [], consentRef: "x", consentHash: "", expiresAt: null } }),
  );
  assert.ok(!badRights.ok);
  assert.equal(badRights.code, "invalid-rights");

  const refused = createLearningCandidateRecord(intake({ signalId: "" }), DEPS);
  assert.ok(!refused.ok);
  assert.equal(refused.code, "invalid-signal-id");
});

test("ladder transitions are immutable record replacements: same id, only status + linkage + timestamp move", () => {
  const deps = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6131)) };
  const built = createLearningCandidateRecord(intake(), deps);
  assert.ok(built.ok);
  const candidate = built.record;
  const validated = transitionLearningRecord(candidate, { to: "validated", at: "2026-01-01T00:00:09.000Z" });

  assert.notEqual(validated, candidate);
  assert.equal(validated.id, candidate.id);
  assert.equal(validated.status, "validated");
  assert.equal(validated.validatedAt, "2026-01-01T00:00:09.000Z");
  assert.equal(validated.supersededById, null);
  assert.equal(validated.contentHash, candidate.contentHash);
  assert.equal(validated.rights, candidate.rights);
  // The original candidate instance is untouched (never in-place mutation).
  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.validatedAt, "2026-01-01T00:00:00.000Z");

  const superseded = transitionLearningRecord(validated, {
    to: "superseded",
    supersededById: "you_learning-record_0000000000000009",
    at: "2026-01-01T00:00:19.000Z",
  });
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.supersededById, "you_learning-record_0000000000000009");
  // A superseded record keeps its validation moment (only status + linkage move).
  assert.equal(superseded.validatedAt, "2026-01-01T00:00:09.000Z");
  assert.equal(validated.status, "validated");
  assert.equal(validated.supersededById, null);

  const rejected = transitionLearningRecord(candidate, { to: "rejected", at: "2026-01-01T00:00:29.000Z" });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.supersededById, null);
  assert.equal(candidate.status, "candidate");
});

test("illegal ladder transitions throw in the machinery (the service maps them to typed refusals)", () => {
  const deps = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6132)) };
  const built = createLearningCandidateRecord(intake(), deps);
  assert.ok(built.ok);
  const candidate = built.record;
  const validated = transitionLearningRecord(candidate, { to: "validated", at: "2026-01-01T00:00:02.000Z" });
  const rejected = transitionLearningRecord(candidate, { to: "rejected", at: "2026-01-01T00:00:03.000Z" });
  const superseded = transitionLearningRecord(validated, { to: "superseded", supersededById: "you_x", at: "2026-01-01T00:00:04.000Z" });

  assert.throws(() => transitionLearningRecord(candidate, { to: "candidate", at: NOW }), /illegal learning record transition candidate -> candidate/);
  assert.throws(() => transitionLearningRecord(validated, { to: "validated", at: NOW }), /illegal learning record transition validated -> validated/);
  assert.throws(() => transitionLearningRecord(validated, { to: "rejected", at: NOW }), /illegal learning record transition validated -> rejected/);
  assert.throws(() => transitionLearningRecord(rejected, { to: "validated", at: NOW }), /illegal learning record transition rejected -> validated/);
  assert.throws(() => transitionLearningRecord(superseded, { to: "validated", at: NOW }), /illegal learning record transition superseded -> validated/);

  // Supersession requires the successor linkage; the linkage is illegal elsewhere.
  assert.throws(() => transitionLearningRecord(validated, { to: "superseded", at: NOW }), /supersession requires the successor record id/);
  assert.throws(
    () => transitionLearningRecord(candidate, { to: "validated", supersededById: "you_x", at: NOW }),
    /supersededById linkage is only legal on supersession/,
  );
});

test("transitioned records are deep-frozen (immutability law)", () => {
  const deps = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6133)) };
  const built = createLearningCandidateRecord(intake(), deps);
  assert.ok(built.ok);
  const candidate = built.record;
  const validated = transitionLearningRecord(candidate, { to: "validated", at: "2026-01-01T00:00:02.000Z" });
  assert.ok(Object.isFrozen(validated));
  assert.throws(() => {
    (validated as { status: string }).status = "rejected";
  }, TypeError);
});
