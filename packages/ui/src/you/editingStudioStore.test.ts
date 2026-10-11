// W5B logic tests — Editing 视图 store 转移（node:test，无 DOM）。
//
// 覆盖：加载生命周期（idle→loading→ready/error）、操作级 typed 错误（inline、表面
// 保持可用）、会话选中/键盘光标视图转移、subject/editorKind 挑选与 parent 同步、
// op 草稿替换、导出剪贴板、demo 状态机、以及「快照刷新保持选中语义」。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createEditingPaneStore,
  EDITING_PANE_INITIAL_STATE,
} from "./editingStudioStore.js";
import { createSimulatedEditingStudioController } from "./editingSimulatedController.js";
import type { EditingStudioSnapshot } from "./editingController.js";
import { OP_DRAFT_EMPTY, setPendingOpKind, appendDraftOp } from "./editingOpDraftModel.js";

async function loadFixtureSnapshot(): Promise<EditingStudioSnapshot> {
  const controller = createSimulatedEditingStudioController();
  return controller.load({ workspaceKey: "test-workspace" });
}

async function loadFixtureSnapshotWithSession(): Promise<EditingStudioSnapshot> {
  const controller = createSimulatedEditingStudioController();
  const snapshot = await controller.load({ workspaceKey: "test-workspace" });
  void snapshot;
  await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  await controller.openSession({
    subjectArtifactId: snapshot.subjects[1]!.id,
    editorKind: "embedded",
  });
  return controller.refresh();
}

test("store starts in idle state with sessions panel and empty demo", () => {
  const store = createEditingPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.panel, EDITING_PANE_INITIAL_STATE.panel);
  assert.equal(state.snapshot, null);
  assert.equal(state.selectedSessionId, null);
  assert.equal(state.sessionIndex, 0);
  assert.equal(state.selectedSubjectId, null);
  assert.equal(state.selectedEditorKind, null);
  assert.deepEqual(state.opDraft, OP_DRAFT_EMPTY);
  assert.equal(state.parentVersionId, null);
  assert.deepEqual(state.exportDraft, { format: null });
  assert.equal(state.lastExport, null);
  assert.equal(state.selectedChangeSetId, null);
  assert.equal(state.selectedCandidateId, null);
  assert.equal(state.actionError, null);
  assert.equal(state.demo.active, false);
  assert.equal(state.demo.stepIndex, 0);
  assert.equal(state.demo.finished, false);
  assert.equal(state.demo.outcomes.length, 0);
});

test("load lifecycle: begin -> succeeded applies snapshot (subject/editor defaults)", async () => {
  const store = createEditingPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.snapshot, snapshot);
  // 空会话平面：无会话 → 选中回退 null；subject 默认第一条；editor 默认 native。
  assert.equal(state.selectedSessionId, null);
  assert.equal(state.sessionIndex, 0);
  assert.equal(state.selectedSubjectId, "fx-editsubject-001");
  assert.equal(state.selectedEditorKind, "native");
  assert.equal(state.parentVersionId, "fx-editsubject-001");
  assert.equal(state.exportDraft.format, "edit-interchange");
  assert.equal(snapshot.simulated, true);
  assert.equal(snapshot.sessions.length, 0);
});

test("load failure enters error state with the truthful message", () => {
  const store = createEditingPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: editing studio is not loaded");
  const state = store.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "YOU_INVALID_STATE: editing studio is not loaded");
});

test("action-level typed errors stay inline (surface stays ready)", () => {
  const store = createEditingPaneStore();
  store.getState().actionFailed({ code: "YOU_CHANGESET_INVALID", message: "invalid" });
  assert.equal(store.getState().status, "idle");
  assert.deepEqual(store.getState().actionError, {
    code: "YOU_CHANGESET_INVALID",
    message: "invalid",
  });
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("snapshot refresh keeps selection when the object still exists (fallback to latest otherwise)", async () => {
  const store = createEditingPaneStore();
  const snapshot = await loadFixtureSnapshotWithSession();
  store.getState().loadSucceeded(snapshot);
  const firstSessionId = snapshot.sessions[0]!.id;
  store.getState().selectSession(firstSessionId);
  assert.equal(store.getState().selectedSessionId, firstSessionId);

  // 选中对象仍存在 → 保持。
  const refreshed = await loadFixtureSnapshotWithSession();
  store.getState().applySnapshot(refreshed);
  assert.equal(store.getState().selectedSessionId, firstSessionId);

  // 选中对象消失 → 回退末位（确定性）。
  const trimmed: EditingStudioSnapshot = {
    ...refreshed,
    sessions: [refreshed.sessions[1]!],
  };
  store.getState().applySnapshot(trimmed);
  assert.equal(store.getState().selectedSessionId, refreshed.sessions[1]!.id);
});

test("keyboard cursor moves the selection (cursor = inspected session)", async () => {
  const store = createEditingPaneStore();
  const snapshot = await loadFixtureSnapshotWithSession();
  store.getState().loadSucceeded(snapshot);

  store.getState().moveSessionIndex(-1);
  assert.equal(store.getState().sessionIndex, 0);
  assert.equal(store.getState().selectedSessionId, snapshot.sessions[0]!.id);

  store.getState().moveSessionIndex(1);
  assert.equal(store.getState().sessionIndex, 1);
  assert.equal(store.getState().selectedSessionId, snapshot.sessions[1]!.id);

  store.getState().moveSessionIndex(5);
  assert.equal(store.getState().sessionIndex, 1);
  assert.equal(store.getState().selectedSessionId, snapshot.sessions[1]!.id);

  store.getState().setSessionIndex(0);
  assert.equal(store.getState().sessionIndex, 0);
  assert.equal(store.getState().selectedSessionId, snapshot.sessions[0]!.id);
});

test("selecting a subject syncs the proposal parent to the subject root", async () => {
  const store = createEditingPaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().selectSubject("fx-editsubject-002");
  assert.equal(store.getState().selectedSubjectId, "fx-editsubject-002");
  assert.equal(store.getState().parentVersionId, "fx-editsubject-002");

  store.getState().setParentVersionId("fx-editsubject-001");
  assert.equal(store.getState().parentVersionId, "fx-editsubject-001");

  store.getState().selectSubject(null);
  assert.equal(store.getState().selectedSubjectId, null);
  assert.equal(store.getState().parentVersionId, null);
});

test("op draft is replaced as a whole (pure view model transitions)", () => {
  const store = createEditingPaneStore();
  const draft = appendDraftOp(setPendingOpKind(OP_DRAFT_EMPTY, "transform"));
  store.getState().replaceOpDraft(draft);
  assert.equal(store.getState().opDraft.ops.length, 1);
  assert.equal(store.getState().opDraft.ops[0]!.kind, "transform");
  assert.ok(store.getState().opDraft.ops[0]!.payloadRef.startsWith("fx-content-"));
  assert.ok(store.getState().opDraft.ops[0]!.payloadHash.startsWith("sha256-fixture-"));

  store.getState().replaceOpDraft(OP_DRAFT_EMPTY);
  assert.deepEqual(store.getState().opDraft, OP_DRAFT_EMPTY);
});

test("export clipboard holds the operational package bytes (records stay ref/hash-only)", async () => {
  const store = createEditingPaneStore();
  const controller = createSimulatedEditingStudioController();
  const snapshot = await controller.load({ workspaceKey: "test-workspace" });
  store.getState().loadSucceeded(snapshot);

  const session = await controller.openSession({
    subjectArtifactId: snapshot.subjects[0]!.id,
    editorKind: "native",
  });
  const exportOutcome = await controller.exportFromSession({
    sessionId: session.id,
    format: "json",
  });
  store.getState().setLastExport({
    resultId: exportOutcome.result.id,
    format: String(exportOutcome.result.format),
    packageBytes: exportOutcome.packageBytes,
    packageDigest: exportOutcome.packageDigest,
  });
  const clipboard = store.getState().lastExport;
  assert.ok(clipboard);
  assert.equal(clipboard.resultId, exportOutcome.result.id);
  assert.ok(clipboard.packageBytes.length > 0);
  assert.equal(clipboard.packageDigest, exportOutcome.packageDigest);

  store.getState().setLastExport(null);
  assert.equal(store.getState().lastExport, null);
});

test("demo state machine: start -> step recorded -> finished -> reset", () => {
  const store = createEditingPaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);

  store.getState().demoStepRecorded({
    stepId: "subject-pick",
    summary: "ok",
    refs: [],
    uiHint: {},
  });
  assert.equal(store.getState().demo.stepIndex, 1);
  assert.equal(store.getState().demo.outcomes.length, 1);

  store.getState().demoFinished();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, true);
  assert.equal(store.getState().demo.outcomes.length, 1);

  store.getState().demoReset();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, false);
  assert.equal(store.getState().demo.stepIndex, 0);
  assert.equal(store.getState().demo.outcomes.length, 0);
});
