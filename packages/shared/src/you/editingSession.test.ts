import assert from "node:assert/strict";
import test from "node:test";
import type { EditingSessionStatus as Status } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import {
  createEditingSession,
  EDITING_SESSION_TRANSITIONS,
  isLegalEditingSessionTransition,
  isTerminalEditingSessionStatus,
  transitionEditingSession,
  validateEditorKind,
} from "./editingSession.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0050)),
  };
}

test("the legal transition table is open -> committed | abandoned with terminals locked", () => {
  assert.deepEqual(EDITING_SESSION_TRANSITIONS, {
    open: ["committed", "abandoned"],
    committed: [],
    abandoned: [],
  } as const);

  const legal: readonly [Status, Status][] = [
    ["open", "committed"],
    ["open", "abandoned"],
  ];
  for (const [from, to] of legal) {
    assert.ok(isLegalEditingSessionTransition(from, to), `${from} -> ${to}`);
  }

  const illegal: readonly [Status, Status][] = [
    ["open", "open"],
    ["committed", "open"],
    ["committed", "committed"],
    ["committed", "abandoned"],
    ["abandoned", "open"],
    ["abandoned", "committed"],
    ["abandoned", "abandoned"],
  ];
  for (const [from, to] of illegal) {
    assert.ok(!isLegalEditingSessionTransition(from, to), `${from} -> ${to}`);
  }

  assert.ok(!isTerminalEditingSessionStatus("open"));
  assert.ok(isTerminalEditingSessionStatus("committed"));
  assert.ok(isTerminalEditingSessionStatus("abandoned"));
});

test("createEditingSession builds the frozen wave-5 namespaced record (status open)", () => {
  const deps = makeDeps();
  const created = createEditingSession({ subjectArtifactId: "you_render-artifact_x", editorKind: "external" }, deps);
  assert.ok(created.ok);
  const session = created.session;
  assert.equal(session.subjectArtifactId, "you_render-artifact_x");
  assert.equal(session.editorKind, "external");
  assert.equal(session.status, "open");
  assert.equal(session.openedAt, "2026-01-01T00:00:00.000Z");
  assert.ok(session.id.startsWith("you_editing-session_"));
  assert.ok(Object.isFrozen(session));
  assert.throws(() => {
    (session as { status: string }).status = "committed";
  }, TypeError);
});

test("createEditingSession refuses structurally invalid intakes", () => {
  const deps = makeDeps();
  const noSubject = createEditingSession({ subjectArtifactId: "", editorKind: "native" }, deps);
  assert.ok(!noSubject.ok);
  assert.equal(noSubject.code, "invalid-subject-artifact");

  const badKind = createEditingSession({ subjectArtifactId: "s", editorKind: "" }, deps);
  assert.ok(!badKind.ok);
  assert.equal(badKind.code, "invalid-editor-kind");

  const whitespaceKind = createEditingSession({ subjectArtifactId: "s", editorKind: " native " }, deps);
  assert.ok(!whitespaceKind.ok);
  assert.equal(whitespaceKind.code, "invalid-editor-kind");

  assert.equal(validateEditorKind("embedded"), null);
  assert.notEqual(validateEditorKind(""), null);
  assert.notEqual(validateEditorKind(" padded"), null);
});

test("terminal transitions replace the record immutably (same id, only the status moves)", () => {
  const deps = makeDeps();
  const created = createEditingSession({ subjectArtifactId: "subj", editorKind: "native" }, deps);
  assert.ok(created.ok);
  const session = created.session;

  const committed = transitionEditingSession(session, "committed");
  assert.equal(committed.id, session.id);
  assert.equal(committed.status, "committed");
  assert.equal(committed.openedAt, session.openedAt);
  assert.notEqual(committed, session);
  assert.ok(Object.isFrozen(committed));
  assert.equal(session.status, "open");

  assert.throws(() => transitionEditingSession(committed, "abandoned"), /illegal editing session transition committed -> abandoned/);
  assert.throws(() => transitionEditingSession(committed, "committed"), /illegal editing session transition committed -> committed/);
});
