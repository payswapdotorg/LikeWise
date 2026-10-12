// W6B logic tests — Learning 视图 store 转移（node:test，无 DOM）。
//
// 覆盖：加载生命周期（idle→loading→ready/error）、操作级 typed 错误（inline、表面
// 保持可用）、signal 选中/键盘光标视图转移、teach-me 草稿（kind/scope/evidence）
// 转移、记录/trajectory/偏好选中、最近重放视图值、demo 状态机、以及
// 「快照刷新保持选中语义」。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createLearningPaneStore,
  LEARNING_PANE_INITIAL_STATE,
  LEARNING_SIGNAL_DRAFT_EMPTY,
} from "./learningStudioStore.js";
import { createSimulatedLearningStudioController } from "./learningSimulatedController.js";
import type { LearningStudioSnapshot } from "./learningController.js";

async function loadFixtureSnapshot(): Promise<LearningStudioSnapshot> {
  const controller = createSimulatedLearningStudioController();
  return controller.load({ workspaceKey: "test-workspace" });
}

async function loadFixtureSnapshotWithSignal(): Promise<LearningStudioSnapshot> {
  const controller = createSimulatedLearningStudioController();
  await controller.load({ workspaceKey: "test-workspace" });
  await controller.captureSignal({
    kind: "feedback",
    scope: "USER",
    subjectRef: null,
    evidenceRefs: ["fx-content-a"],
  });
  await controller.captureSignal({
    kind: "capability-gap",
    scope: "TENANT",
    subjectRef: null,
    evidenceRefs: ["fx-content-b"],
  });
  return controller.refresh();
}

test("store starts in idle state with signals panel and empty demo", () => {
  const store = createLearningPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.panel, LEARNING_PANE_INITIAL_STATE.panel);
  assert.equal(state.snapshot, null);
  assert.equal(state.selectedSignalId, null);
  assert.equal(state.signalIndex, 0);
  assert.deepEqual(state.signalDraft, LEARNING_SIGNAL_DRAFT_EMPTY);
  assert.equal(state.selectedRecordId, null);
  assert.equal(state.selectedTrajectoryId, null);
  assert.equal(state.selectedPreferenceKey, null);
  assert.equal(state.lastReplay, null);
  assert.equal(state.actionError, null);
  assert.equal(state.demo.active, false);
  assert.equal(state.demo.stepIndex, 0);
  assert.equal(state.demo.finished, false);
  assert.equal(state.demo.outcomes.length, 0);
});

test("load lifecycle: begin -> succeeded applies snapshot (kind/scope/evidence defaults)", async () => {
  const store = createLearningPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.snapshot, snapshot);
  // 空平面：无信号 → 选中回退 null；kind 默认注册面首项；scope 默认 USER；
  // evidence 默认注册面首条。
  assert.equal(state.selectedSignalId, null);
  assert.equal(state.signalIndex, 0);
  assert.equal(state.signalDraft.kind, "feedback");
  assert.equal(state.signalDraft.scope, "USER");
  assert.deepEqual(state.signalDraft.evidenceIds, ["fx-learnevidence-001"]);
  assert.equal(snapshot.simulated, true);
  assert.equal(snapshot.signals.length, 0);
});

test("load failure enters error state with the truthful message", () => {
  const store = createLearningPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: learning studio is not loaded");
  const state = store.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "YOU_INVALID_STATE: learning studio is not loaded");
});

test("action-level typed errors stay inline (surface stays ready)", async () => {
  const store = createLearningPaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  store.getState().actionFailed({ code: "YOU_LEARNING_SIGNAL_INVALID", message: "invalid" });
  assert.equal(store.getState().status, "ready");
  assert.deepEqual(store.getState().actionError, {
    code: "YOU_LEARNING_SIGNAL_INVALID",
    message: "invalid",
  });
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("signal selection and keyboard cursor move together (selection follows the cursor)", async () => {
  const store = createLearningPaneStore();
  const snapshot = await loadFixtureSnapshotWithSignal();
  store.getState().loadSucceeded(snapshot);
  const [first, second] = snapshot.signals;

  store.getState().selectSignal(first!.id);
  assert.equal(store.getState().selectedSignalId, first!.id);
  assert.equal(store.getState().signalIndex, 0);

  store.getState().moveSignalIndex(1);
  assert.equal(store.getState().selectedSignalId, second!.id);
  assert.equal(store.getState().signalIndex, 1);

  // 夹紧：越界移动停在末位（clamp 语义）。
  store.getState().moveSignalIndex(99);
  assert.equal(store.getState().signalIndex, 1);
  assert.equal(store.getState().selectedSignalId, second!.id);

  store.getState().setSignalIndex(0);
  assert.equal(store.getState().selectedSignalId, first!.id);
});

test("teach-me draft transitions: kind/scope pick and evidence toggle", async () => {
  const store = createLearningPaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().setSignalDraftKind("capability-gap");
  assert.equal(store.getState().signalDraft.kind, "capability-gap");
  store.getState().setSignalDraftScope("TENANT");
  assert.equal(store.getState().signalDraft.scope, "TENANT");

  store.getState().toggleSignalDraftEvidence("fx-learnevidence-002");
  assert.deepEqual(store.getState().signalDraft.evidenceIds, [
    "fx-learnevidence-001",
    "fx-learnevidence-002",
  ]);
  store.getState().toggleSignalDraftEvidence("fx-learnevidence-001");
  assert.deepEqual(store.getState().signalDraft.evidenceIds, ["fx-learnevidence-002"]);
  store.getState().toggleSignalDraftEvidence("fx-learnevidence-002");
  assert.deepEqual(store.getState().signalDraft.evidenceIds, []);
});

test("snapshot refresh keeps selection when the object still exists (fallback to latest otherwise)", async () => {
  const store = createLearningPaneStore();
  const snapshot = await loadFixtureSnapshotWithSignal();
  store.getState().loadSucceeded(snapshot);
  const firstSignalId = snapshot.signals[0]!.id;
  store.getState().selectSignal(firstSignalId);
  assert.equal(store.getState().selectedSignalId, firstSignalId);

  // 选中对象仍存在 → 保持。
  const refreshed = await loadFixtureSnapshotWithSignal();
  store.getState().applySnapshot(refreshed);
  assert.equal(store.getState().selectedSignalId, firstSignalId);

  // 选中对象消失 → 回退末位（确定性）。
  const trimmed: LearningStudioSnapshot = {
    ...refreshed,
    signals: [refreshed.signals[1]!],
  };
  store.getState().applySnapshot(trimmed);
  assert.equal(store.getState().selectedSignalId, refreshed.signals[1]!.id);

  // 草稿的 evidence 挑选在刷新时被裁剪到仍存在的条目。
  store.getState().toggleSignalDraftEvidence("fx-learnevidence-999");
  const shrunk: LearningStudioSnapshot = {
    ...refreshed,
    evidence: refreshed.evidence.slice(0, 1),
  };
  store.getState().applySnapshot(shrunk);
  assert.deepEqual(store.getState().signalDraft.evidenceIds, ["fx-learnevidence-001"]);

  // 草稿 kind 消失 → 回退注册面首项。
  const kindless: LearningStudioSnapshot = {
    ...refreshed,
    kindRegistry: refreshed.kindRegistry.filter((entry) => entry.kind !== "capability-gap"),
  };
  store.getState().setSignalDraftKind("capability-gap");
  store.getState().applySnapshot(kindless);
  assert.equal(store.getState().signalDraft.kind, "feedback");
});

test("record / trajectory / preference selection and the last-replay view value", async () => {
  const store = createLearningPaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().selectRecord("fx-learnrecord-001");
  assert.equal(store.getState().selectedRecordId, "fx-learnrecord-001");
  store.getState().selectTrajectory("fx-traj-001");
  assert.equal(store.getState().selectedTrajectoryId, "fx-traj-001");
  store.getState().selectPreference("USER::preferred-editor");
  assert.equal(store.getState().selectedPreferenceKey, "USER::preferred-editor");

  store.getState().setLastReplay({
    trajectoryId: "fx-traj-001",
    stepCount: 4,
    replayHash: "sha256-fixture-abc",
    byteLength: 256,
  });
  assert.deepEqual(store.getState().lastReplay, {
    trajectoryId: "fx-traj-001",
    stepCount: 4,
    replayHash: "sha256-fixture-abc",
    byteLength: 256,
  });
  store.getState().setLastReplay(null);
  assert.equal(store.getState().lastReplay, null);
});

test("demo state machine: started -> step recorded -> finished -> reset", async () => {
  const store = createLearningPaneStore();
  store.getState().demoStarted();
  assert.deepEqual(store.getState().demo, {
    active: true,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });

  const outcome = {
    stepId: "scope-pick" as const,
    summary: "loaded",
    refs: [],
    uiHint: {},
  };
  store.getState().demoStepRecorded(outcome);
  const demo = store.getState().demo;
  assert.equal(demo.stepIndex, 1);
  assert.equal(demo.outcomes.length, 1);
  assert.equal(demo.outcomes[0]!.stepId, "scope-pick");

  store.getState().demoFinished();
  assert.equal(store.getState().demo.finished, true);
  assert.equal(store.getState().demo.active, false);

  store.getState().demoReset();
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});
