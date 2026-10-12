import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { SolutionEventLedger } from "./events.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { replayLearningLedger } from "./learningLedger.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6106)) };

function ledger(): SolutionEventLedger {
  return new SolutionEventLedger("you_w6a_ledger_test", DEPS);
}

test("the fold reconstructs signals with their ordered evidence refs", () => {
  const book = ledger();
  book.append({
    type: "learning-signal-captured",
    subjectRef: "you_learning-signal_0000000000000001",
    payload: {
      signalId: "you_learning-signal_0000000000000001",
      kind: "feedback",
      scope: "USER",
      subjectRef: "",
      evidenceCount: 2,
      "evidenceRef.0": "you_content_0000000000000000",
      "evidenceRef.1": "you_content_0000000000000001",
      capturedAt: "2026-01-01T00:00:00.000Z",
      simulated: true,
    },
  });
  const projection = replayLearningLedger(book.events());
  const signal = projection.signals["you_learning-signal_0000000000000001"];
  assert.ok(signal !== undefined);
  assert.equal(signal.kind, "feedback");
  assert.equal(signal.scope, "USER");
  assert.equal(signal.subjectRef, "");
  assert.deepEqual(signal.evidenceRefs, ["you_content_0000000000000000", "you_content_0000000000000001"]);
  assert.equal(signal.simulated, true);
});

test("the fold reconstructs validated records with their rights facts", () => {
  const book = ledger();
  book.append({
    type: "learning-record-validated",
    subjectRef: "you_learning-record_0000000000000001",
    payload: {
      recordId: "you_learning-record_0000000000000001",
      signalId: "you_learning-signal_0000000000000001",
      scope: "USER",
      statusAfter: "validated",
      contentRef: "you_content_0123456789abcdef",
      contentHash: "b".repeat(64),
      usageCount: 2,
      "usage.0": "personalization",
      "usage.1": "tool-selection",
      consentRef: "you_consent-policy_0000000000000001",
      consentHash: "a".repeat(64),
      rightsExpiresAt: "",
      supersedesRecordId: "",
      validatedAt: "2026-01-01T00:00:05.000Z",
      simulated: true,
    },
  });
  const projection = replayLearningLedger(book.events());
  const record = projection.records["you_learning-record_0000000000000001"];
  assert.ok(record !== undefined);
  assert.equal(record.status, "validated");
  assert.equal(record.signalId, "you_learning-signal_0000000000000001");
  assert.deepEqual(record.usage, ["personalization", "tool-selection"]);
  assert.equal(record.consentRef, "you_consent-policy_0000000000000001");
  assert.equal(record.consentHash, "a".repeat(64));
  assert.equal(record.expiresAt, "");
  assert.equal(record.supersededById, "");
  assert.equal(record.simulated, true);
});

test("the fold reconstructs rejected records with their refusal reason", () => {
  const book = ledger();
  book.append({
    type: "learning-record-rejected",
    subjectRef: "you_learning-record_0000000000000002",
    payload: {
      recordId: "you_learning-record_0000000000000002",
      signalId: "you_learning-signal_0000000000000002",
      scope: "PROJECT",
      statusAfter: "rejected",
      contentRef: "you_content_2222222222222222",
      contentHash: "c".repeat(64),
      consentRef: "",
      consentHash: "",
      rightsExpiresAt: "",
      reason: "fixture-rejected-learning",
      validatedAt: "2026-01-01T00:00:07.000Z",
      simulated: true,
    },
  });
  const projection = replayLearningLedger(book.events());
  const record = projection.records["you_learning-record_0000000000000002"];
  assert.ok(record !== undefined);
  assert.equal(record.status, "rejected");
  assert.deepEqual(record.usage, []);
  assert.equal(record.consentRef, "");
});

test("the fold reconstructs supersession from the successor's payload (append-only linkage)", () => {
  const book = ledger();
  const recordFacts = (id: string, signalId: string) => ({
    recordId: id,
    signalId,
    scope: "USER",
    statusAfter: "validated",
    contentRef: `you_content_${id.slice(-16)}`,
    contentHash: "b".repeat(64),
    usageCount: 1,
    "usage.0": "pipeline-improvement",
    consentRef: "you_consent-policy_0000000000000001",
    consentHash: "a".repeat(64),
    rightsExpiresAt: "",
    validatedAt: "2026-01-01T00:00:05.000Z",
    simulated: true,
  });
  book.append({ type: "learning-record-validated", subjectRef: "r1", payload: recordFacts("you_learning-record_0000000000000001", "s1") });
  book.append({
    type: "learning-record-validated",
    subjectRef: "r2",
    payload: { ...recordFacts("you_learning-record_0000000000000002", "s2"), supersedesRecordId: "you_learning-record_0000000000000001" },
  });

  const projection = replayLearningLedger(book.events());
  const superseded = projection.records["you_learning-record_0000000000000001"];
  const successor = projection.records["you_learning-record_0000000000000002"];
  assert.ok(superseded !== undefined && successor !== undefined);
  assert.equal(superseded.status, "superseded");
  assert.equal(superseded.supersededById, "you_learning-record_0000000000000002");
  assert.equal(successor.status, "validated");
  assert.equal(successor.supersededById, "");
});

test("the fold keys preferences by scope::key and keeps the LATEST projection", () => {
  const book = ledger();
  book.append({
    type: "preference-updated",
    subjectRef: "you_learning-preference_0000000000000001",
    payload: {
      preferenceId: "you_learning-preference_0000000000000001",
      scope: "USER",
      key: "preferred-editor",
      value: "fixture-editor-v1",
      derivedFromRecordId: "you_learning-record_0000000000000001",
      updatedAt: "2026-01-01T00:00:09.000Z",
    },
  });
  book.append({
    type: "preference-updated",
    subjectRef: "you_learning-preference_0000000000000002",
    payload: {
      preferenceId: "you_learning-preference_0000000000000002",
      scope: "GLOBAL",
      key: "organization-baseline",
      value: "fixture-baseline",
      derivedFromRecordId: "",
      updatedAt: "2026-01-01T00:00:10.000Z",
    },
  });
  book.append({
    type: "preference-updated",
    subjectRef: "you_learning-preference_0000000000000003",
    payload: {
      preferenceId: "you_learning-preference_0000000000000003",
      scope: "USER",
      key: "preferred-editor",
      value: "fixture-editor-v2",
      derivedFromRecordId: "you_learning-record_0000000000000001",
      updatedAt: "2026-01-01T00:00:11.000Z",
    },
  });

  const projection = replayLearningLedger(book.events());
  assert.equal(Object.keys(projection.preferences).length, 2);
  const latest = projection.preferences["USER::preferred-editor"];
  assert.ok(latest !== undefined);
  assert.equal(latest.id, "you_learning-preference_0000000000000003");
  assert.equal(latest.value, "fixture-editor-v2");
  assert.equal(latest.derivedFromRecordId, "you_learning-record_0000000000000001");
  const seeded = projection.preferences["GLOBAL::organization-baseline"];
  assert.ok(seeded !== undefined);
  assert.equal(seeded.derivedFromRecordId, "");
});

test("the fold is deterministic: same events => byte-identical projection under stableStringify", () => {
  const build = (): readonly SolutionEvent[] => {
    const book = new SolutionEventLedger("you_w6a_ledger_determinism", {
      clock: createDeterministicClock(),
      ids: createRngIdFactory(createDeterministicRng(6107)),
    });
    book.append({
      type: "learning-signal-captured",
      subjectRef: "s",
      payload: { signalId: "s1", kind: "capability-gap", scope: "TASK", subjectRef: "t1", evidenceCount: 1, "evidenceRef.0": "you_content_1", capturedAt: "2026-01-01T00:00:00.000Z", simulated: true },
    });
    book.append({
      type: "learning-record-validated",
      subjectRef: "r",
      payload: { recordId: "r1", signalId: "s1", scope: "TASK", statusAfter: "validated", contentRef: "you_content_2", contentHash: "d".repeat(64), usageCount: 1, "usage.0": "capability-gap-analysis", consentRef: "p1", consentHash: "e".repeat(64), rightsExpiresAt: "", supersedesRecordId: "", validatedAt: "2026-01-01T00:00:01.000Z", simulated: true },
    });
    return book.events();
  };
  const left = replayLearningLedger(build());
  const right = replayLearningLedger(build());
  assert.equal(JSON.stringify(left), JSON.stringify(right));
});

test("replayLearningLedger refuses an empty ledger (nothing to fold)", () => {
  assert.throws(() => replayLearningLedger([]), /requires at least one event/);
});

test("the fold ignores non-learning events (forward compatibility with the shared ledger)", () => {
  const book = ledger();
  book.append({ type: "version-published", subjectRef: "v", payload: { versionId: "v1" } });
  book.append({
    type: "learning-signal-captured",
    subjectRef: "s",
    payload: { signalId: "s1", kind: "feedback", scope: "USER", subjectRef: "", evidenceCount: 1, "evidenceRef.0": "you_content_1", capturedAt: "2026-01-01T00:00:00.000Z", simulated: true },
  });
  const projection = replayLearningLedger(book.events());
  assert.equal(projection.solutionId, "you_w6a_ledger_test");
  assert.equal(Object.keys(projection.records).length, 0);
  assert.ok(projection.signals["s1"] !== undefined);
});
