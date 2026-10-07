import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { ChangeSet, EditSession } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { createConsentReference } from "./feedback.js";
import { deriveLearningCandidate } from "./learning.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(61)) };

function session(consent = createConsentReference("granted", true), closed = true): EditSession {
  const opened = {
    solutionId: "you_solution_learning01",
    inputVersionId: "you_version_input0001",
    editorRef: "you-native-editor",
    editorVersion: "phase0",
    platform: "zcode-workspace",
    mode: "correct" as const,
    evidenceMode: "observed" as const,
    learningPermission: consent,
  };
  const base = { ...opened, id: "you_edit-session_0000000000000001", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null as string | null, resultingArtifactId: null, diffRef: null, sourceArtifactId: null, provenance: { source: "manual-takeover", generator: "user" as const, createdAt: "2026-01-01T00:00:00.000Z", lineage: [] } };
  if (!closed) {
    return base;
  }
  return { ...base, endedAt: "2026-01-01T00:00:05.000Z" };
}

function acceptedChangeSet(): ChangeSet {
  return {
    id: "you_changeset_accepted001",
    intentRef: null,
    targetRef: null,
    inputVersionId: "you_version_input0001",
    proposedOperations: [{ op: "adjust_quality", deficiencyClass: "appearance", delta: 0.08 }],
    evidenceRefs: [],
    executionRef: null,
    verification: { checks: [], passed: true },
    resultingVersionId: "you_version_result0001",
    status: "accepted",
    authorType: "user",
  };
}

test("no learning without permission: learningPermission=false is denied", () => {
  const outcome = deriveLearningCandidate(
    { session: session(createConsentReference("granted", false)), changeSet: acceptedChangeSet(), intentFingerprint: "abcd1234" },
    DEPS,
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "learning-not-permitted");
});

test("no learning without consent: state != granted is denied", () => {
  const outcome = deriveLearningCandidate(
    { session: session(createConsentReference("denied", true)), changeSet: acceptedChangeSet(), intentFingerprint: "abcd1234" },
    DEPS,
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "consent-not-granted");
});

test("an open session cannot produce learning yet", () => {
  const outcome = deriveLearningCandidate(
    { session: session(undefined, false), changeSet: acceptedChangeSet(), intentFingerprint: "abcd1234" },
    DEPS,
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "session-open");
});

test("only an accepted changeset can feed learning", () => {
  const proposed = { ...acceptedChangeSet(), status: "proposed" as const, resultingVersionId: null };
  const outcome = deriveLearningCandidate(
    { session: session(), changeSet: proposed, intentFingerprint: "abcd1234" },
    DEPS,
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "changeset-not-accepted");
});

test("granted permission + closed session + accepted correction yields a candidate", () => {
  const changeSet = acceptedChangeSet();
  const outcome = deriveLearningCandidate(
    { session: session(), changeSet, intentFingerprint: "abcd1234", intentRef: "you_intent_000000000000001" },
    DEPS,
  );
  assert.ok(outcome.ok);
  assert.equal(outcome.candidate.scope, "USER");
  assert.equal(outcome.candidate.intentFingerprint, "abcd1234");
  assert.equal(outcome.candidate.intentRef, "you_intent_000000000000001");
  assert.equal(outcome.candidate.sourceEditSessionId, session().id);
  assert.equal(outcome.candidate.sourceChangeSetId, changeSet.id);
  assert.deepEqual(outcome.candidate.operations, changeSet.proposedOperations);
  assert.match(outcome.candidate.id, /^you_learning-candidate_[0-9a-f]{16}$/);
  assert.ok(Object.isFrozen(outcome.candidate));
});

test("candidate scope is explicit and defaults to USER (never a universal rule)", () => {
  const outcome = deriveLearningCandidate(
    { session: session(), changeSet: acceptedChangeSet(), intentFingerprint: "abcd1234", scope: "TWIN" },
    DEPS,
  );
  assert.ok(outcome.ok);
  assert.equal(outcome.candidate.scope, "TWIN");
  const defaulted = deriveLearningCandidate(
    { session: session(), changeSet: acceptedChangeSet(), intentFingerprint: "abcd1234" },
    DEPS,
  );
  assert.ok(defaulted.ok);
  assert.equal(defaulted.candidate.scope, "USER");
});

test("gate order is deterministic: session-open is reported before consent", () => {
  const outcome = deriveLearningCandidate(
    { session: session(createConsentReference("denied", false), false), changeSet: acceptedChangeSet(), intentFingerprint: "abcd1234" },
    DEPS,
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "session-open");
});
