import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { LearningRecord } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { INERT_LEARNING_RIGHTS } from "./learningRights.js";
import { transitionLearningRecord } from "./learningRecord.js";
import {
  createLearningPreference,
  deriveLearningPreferenceFromRecord,
  preferenceProjectionKey,
  validateLearningPreferenceIntake,
  validatePreferenceScopeLiteral,
} from "./learningPreference.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6104)) };

function record(status: LearningRecord["status"]): LearningRecord {
  const base: LearningRecord = {
    id: "you_learning-record_0000000000000001",
    signalId: "you_learning-signal_0000000000000001",
    status,
    scope: "USER",
    contentRef: "you_content_0123456789abcdef",
    contentHash: "b".repeat(64),
    rights: INERT_LEARNING_RIGHTS,
    validatedAt: "2026-01-01T00:00:00.000Z",
    supersededById: null,
    simulated: true,
  };
  return base;
}

test("preference scope literals reuse the v1 union: bad literals are typed invalid-scope refusals", () => {
  assert.equal(validatePreferenceScopeLiteral("USER"), null);
  assert.equal(validatePreferenceScopeLiteral("GLOBAL"), null);
  const lower = validatePreferenceScopeLiteral("user");
  assert.ok(lower !== null);
  assert.equal(lower.code, "invalid-scope");
  const unknown = validatePreferenceScopeLiteral("GALAXY");
  assert.ok(unknown !== null);
  assert.equal(unknown.code, "invalid-scope");
});

test("preference intake validation: key and value are non-empty; keys carry no whitespace padding", () => {
  assert.deepEqual(validateLearningPreferenceIntake({ scope: "USER", key: "preferred-editor", value: "fixture-editor", derivedFromRecordId: null }), { ok: true });

  const badKey = validateLearningPreferenceIntake({ scope: "USER", key: " leading", value: "v", derivedFromRecordId: null });
  assert.ok(!badKey.ok);
  assert.equal(badKey.code, "invalid-key");

  const emptyKey = validateLearningPreferenceIntake({ scope: "USER", key: "", value: "v", derivedFromRecordId: null });
  assert.ok(!emptyKey.ok);
  assert.equal(emptyKey.code, "invalid-key");

  const badValue = validateLearningPreferenceIntake({ scope: "USER", key: "k", value: "", derivedFromRecordId: null });
  assert.ok(!badValue.ok);
  assert.equal(badValue.code, "invalid-value");

  const badScope = validateLearningPreferenceIntake({ scope: "org" as unknown as "USER", key: "k", value: "v", derivedFromRecordId: null });
  assert.ok(!badScope.ok);
  assert.equal(badScope.code, "invalid-scope");
});

test("createLearningPreference builds an immutable operator-seeded projection (null lineage)", () => {
  const created = createLearningPreference(
    { scope: "GLOBAL", key: "organization-baseline", value: "fixture-baseline", derivedFromRecordId: null },
    DEPS,
  );
  assert.ok(created.ok);
  const preference = created.preference;
  assert.equal(preference.scope, "GLOBAL");
  assert.equal(preference.key, "organization-baseline");
  assert.equal(preference.value, "fixture-baseline");
  assert.equal(preference.derivedFromRecordId, null);
  assert.equal(preference.updatedAt, "2026-01-01T00:00:00.000Z");
  assert.ok(Object.isFrozen(preference));
  assert.throws(() => {
    (preference as { value: string }).value = "mutated";
  }, TypeError);
});

test("only VALIDATED records project preferences: candidate, rejected and superseded refuse with record-not-validated", () => {
  const candidate = record("candidate");
  const rejected = record("rejected");
  const superseded = transitionLearningRecord(record("validated"), {
    to: "superseded",
    supersededById: "you_learning-record_0000000000000002",
    at: "2026-01-01T00:00:00.000Z",
  });

  for (const source of [candidate, rejected, superseded]) {
    const outcome = deriveLearningPreferenceFromRecord(source, { key: "preferred-editor", value: "fixture-editor", scope: "USER" }, DEPS);
    assert.ok(!outcome.ok);
    assert.equal(outcome.code, "record-not-validated");
    assert.match(outcome.detail, new RegExp(source.status));
  }
});

test("derived preferences keep the source record's scope: mismatches refuse with scope-mismatch", () => {
  const validated = record("validated");
  const widened = deriveLearningPreferenceFromRecord(validated, { key: "preferred-editor", value: "x", scope: "GLOBAL" }, DEPS);
  assert.ok(!widened.ok);
  assert.equal(widened.code, "scope-mismatch");

  const narrowed = deriveLearningPreferenceFromRecord(validated, { key: "preferred-editor", value: "x", scope: "TWIN" }, DEPS);
  assert.ok(!narrowed.ok);
  assert.equal(narrowed.code, "scope-mismatch");
});

test("a validated record derives an immutable preference with derivedFromRecordId lineage", () => {
  const validated = record("validated");
  const outcome = deriveLearningPreferenceFromRecord(validated, { key: "preferred-editor", value: "fixture-editor", scope: "USER" }, DEPS);
  assert.ok(outcome.ok);
  assert.equal(outcome.preference.derivedFromRecordId, validated.id);
  assert.equal(outcome.preference.scope, "USER");
  assert.equal(outcome.preference.key, "preferred-editor");
  assert.ok(Object.isFrozen(outcome.preference));
});

test("structural refusals flow through derivation unchanged", () => {
  const validated = record("validated");
  const badKey = deriveLearningPreferenceFromRecord(validated, { key: "", value: "v", scope: "USER" }, DEPS);
  assert.ok(!badKey.ok);
  assert.equal(badKey.code, "invalid-key");
  const badValue = deriveLearningPreferenceFromRecord(validated, { key: "k", value: "", scope: "USER" }, DEPS);
  assert.ok(!badValue.ok);
  assert.equal(badValue.code, "invalid-value");
});

test("the preference projection key is stable: scope + key with a :: separator", () => {
  assert.equal(preferenceProjectionKey("USER", "preferred-editor"), "USER::preferred-editor");
  assert.equal(preferenceProjectionKey("GLOBAL", "a"), "GLOBAL::a");
  assert.notEqual(preferenceProjectionKey("USER", "a"), preferenceProjectionKey("TWIN", "a"));
});
