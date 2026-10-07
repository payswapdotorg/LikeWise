import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { ChangeSet, EditSession } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { closeEditSession, isEditSessionOpen, openEditSession } from "./editSession.js";
import { createConsentReference } from "./feedback.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(51)) };

function openSession(consent = createConsentReference("granted", true)): EditSession {
  return openEditSession(
    {
      solutionId: "you_solution_editssn01",
      inputVersionId: "you_version_input0001",
      editorRef: "you-native-editor",
      editorVersion: "phase0",
      platform: "zcode-workspace",
      mode: "correct",
      evidenceMode: "observed",
      learningPermission: consent,
    },
    DEPS,
  );
}

test("openEditSession records the full lifecycle baseline, immutable", () => {
  const session = openSession();
  assert.match(session.id, /^you_edit-session_[0-9a-f]{16}$/);
  assert.equal(session.solutionId, "you_solution_editssn01");
  assert.equal(session.inputVersionId, "you_version_input0001");
  assert.equal(session.editorRef, "you-native-editor");
  assert.equal(session.mode, "correct");
  assert.equal(session.evidenceMode, "observed");
  assert.equal(session.startedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(session.endedAt, null);
  assert.equal(session.resultingArtifactId, null);
  assert.equal(session.diffRef, null);
  assert.deepEqual(session.learningPermission, { policyId: "you-phase0-consent-policy", state: "granted", learningPermission: true });
  assert.equal(session.provenance.generator, "user");
  assert.ok(Object.isFrozen(session));
  assert.ok(isEditSessionOpen(session));
  assert.throws(() => {
    (session as unknown as { mode: string }).mode = "teach";
  }, TypeError);
  assert.throws(() =>
    openEditSession(
      {
        solutionId: "you_solution_editssn01",
        inputVersionId: "you_version_input0001",
        editorRef: "",
        editorVersion: "phase0",
        platform: "zcode-workspace",
        mode: "edit",
        evidenceMode: "inferred",
        learningPermission: createConsentReference("unknown", false),
      },
      DEPS,
    ),
  );
});

test("closeEditSession returns a NEW closed record; the original stays open", () => {
  const session = openSession();
  const closed = closeEditSession(session, DEPS, {
    resultingArtifactId: "you_artifact_closed01",
    diffRef: "you_diff_closed000001",
  });
  assert.equal(closed.id, session.id);
  assert.ok(closed.endedAt !== null && closed.endedAt > session.startedAt);
  assert.equal(closed.resultingArtifactId, "you_artifact_closed01");
  assert.equal(closed.diffRef, "you_diff_closed000001");
  assert.equal(session.endedAt, null);
  assert.equal(session.resultingArtifactId, null);
  assert.equal(isEditSessionOpen(session), true);
  assert.equal(isEditSessionOpen(closed), false);
  assert.ok(Object.isFrozen(closed));
  assert.throws(() => closeEditSession(closed, DEPS, {}));
});

test("edit modes and evidence modes round-trip through the record", () => {
  const teach = openSession();
  assert.equal(teach.mode, "correct");
  const custom = openEditSession(
    {
      solutionId: "you_solution_editssn01",
      inputVersionId: "you_version_input0001",
      editorRef: "blender",
      editorVersion: "4.2",
      platform: "zcode-desktop-launch",
      mode: "teach",
      evidenceMode: "hybrid",
      learningPermission: createConsentReference("unknown", false),
      sourceArtifactId: "you_artifact_source01",
    },
    DEPS,
  );
  assert.equal(custom.mode, "teach");
  assert.equal(custom.evidenceMode, "hybrid");
  assert.equal(custom.sourceArtifactId, "you_artifact_source01");
  assert.equal(custom.editorRef, "blender");
});

test("a closed session feeds learning derivation only with permission (shared-level gate)", () => {
  // The full consent matrix is exercised in learning.test.ts; here we pin
  // the session-side facts the gate depends on.
  const denied = closeEditSession(openSession(createConsentReference("denied", true)), DEPS, {});
  assert.equal(denied.learningPermission.learningPermission, true);
  assert.equal(denied.learningPermission.state, "denied");
  const notPermitted = closeEditSession(openSession(createConsentReference("granted", false)), DEPS, {});
  assert.equal(notPermitted.learningPermission.learningPermission, false);
  const full = closeEditSession(openSession(), DEPS, {});
  assert.equal(full.learningPermission.state, "granted");
  assert.equal(full.learningPermission.learningPermission, true);
  assert.ok(full.endedAt !== null);
  const placeholder: ChangeSet = {
    id: "you_changeset_placeholder",
    intentRef: null,
    targetRef: null,
    inputVersionId: full.inputVersionId,
    proposedOperations: [],
    evidenceRefs: [],
    executionRef: null,
    verification: null,
    resultingVersionId: null,
    status: "proposed",
    authorType: "user",
  };
  assert.equal(placeholder.status, "proposed");
});
