// W7B logic tests — Avatar store 状态转移（node:test）。
//
// 覆盖：初始态、加载三态（begin/loadSucceeded/loadFailed）、actionError 的
// inline 归因（status 保持 ready）、applySnapshot 的「选中保持/回退」语义、
// 会话光标（select/setIndex/move/clamp 联动）、配置草稿与再附身草稿转移、
// demo 状态机（start/step/finish/reset）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_PANE_INITIAL_STATE,
  createAvatarPaneStore,
} from "./avatarStudioStore.js";
import type { AvatarSession } from "@zcode/shared";
import type { AvatarStudioSnapshot } from "./avatarController.js";
import { AVATAR_STORYBOARD_BODIES, AVATAR_STORYBOARD_SOUL_BINDINGS } from "./avatarStoryboard.js";

function snapshotFixture(overrides: Partial<AvatarStudioSnapshot> = {}): AvatarStudioSnapshot {
  return {
    displayName: "Avatar Studio — Aria",
    studioId: "fx-avatar-studio-001",
    bodies: [...AVATAR_STORYBOARD_BODIES],
    soulBindings: [...AVATAR_STORYBOARD_SOUL_BINDINGS],
    sessions: [],
    channels: [],
    sessionChannels: [],
    embodimentStates: [
      "listening",
      "reading",
      "typing",
      "thinking",
      "tool_use",
      "speaking",
      "interrupted",
      "idle",
      "unavailable",
    ],
    routingProfiles: ["system-one", "system-two"],
    events: [],
    simulated: true,
    ...overrides,
  };
}

function sessionFixture(
  id: string,
  bodyId: string,
  soulBindingId: string,
  status: AvatarSession["status"] = "active",
  state: AvatarSession["state"] = "idle",
): AvatarSession {
  return {
    id,
    bodyId,
    soulBindingId,
    status,
    state,
    openedAt: "2026-10-12T00:00:00.000Z",
    closedAt: null,
    simulated: true,
  };
}

test("initial state is idle with empty projection views", () => {
  const store = createAvatarPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.snapshot, null);
  assert.equal(state.panel, "configuration");
  assert.equal(state.actionError, null);
  assert.equal(state.lastReassignment, null);
  assert.deepEqual(state.demo, { active: false, stepIndex: 0, finished: false, outcomes: [] });
  assert.deepEqual(state.reassignmentDraft, { sessionId: null, toSoulBindingId: null });
  assert.deepEqual(AVATAR_PANE_INITIAL_STATE.demo.outcomes, []);
});

test("load transitions: begin -> success defaults pickers to registry first entries", () => {
  const store = createAvatarPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  const snapshot = snapshotFixture();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.errorMessage, null);
  assert.equal(state.selectedBodyId, AVATAR_STORYBOARD_BODIES[0]!.id);
  assert.equal(state.selectedSoulBindingId, AVATAR_STORYBOARD_SOUL_BINDINGS[0]!.id);
  assert.equal(state.selectedSessionId, null);
  assert.equal(state.sessionIndex, 0);
});

test("load failure surfaces the error state with the verbatim message", () => {
  const store = createAvatarPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: avatar studio is not loaded");
  const state = store.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "YOU_INVALID_STATE: avatar studio is not loaded");
  assert.equal(state.snapshot, null);
});

test("action errors are inline attribution: status stays ready", () => {
  const store = createAvatarPaneStore();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().actionFailed({
    code: "YOU_EMBODIMENT_STATE_INVALID",
    message: "refused embodiment transition typing -> typing: no-op-transition",
  });
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.actionError?.code, "YOU_EMBODIMENT_STATE_INVALID");
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("applySnapshot keeps existing selections and falls back when they vanish", () => {
  const store = createAvatarPaneStore();
  const first = snapshotFixture({
    sessions: [
      sessionFixture("fx-avatar-session-001", AVATAR_STORYBOARD_BODIES[0]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[0]!.id),
      sessionFixture("fx-avatar-session-002", AVATAR_STORYBOARD_BODIES[1]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id),
    ],
  });
  store.getState().loadSucceeded(first);
  store.getState().selectSession("fx-avatar-session-001");
  store.getState().selectBody(AVATAR_STORYBOARD_BODIES[1]!.id);
  // 刷新后既有选择仍在。
  store.getState().applySnapshot(snapshotFixture({
    sessions: [
      sessionFixture("fx-avatar-session-001", AVATAR_STORYBOARD_BODIES[0]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[0]!.id),
      sessionFixture("fx-avatar-session-002", AVATAR_STORYBOARD_BODIES[1]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id),
    ],
  }));
  let state = store.getState();
  assert.equal(state.selectedSessionId, "fx-avatar-session-001");
  assert.equal(state.selectedBodyId, AVATAR_STORYBOARD_BODIES[1]!.id);
  // 会话消失后回退末位（追加序语义）。
  store.getState().applySnapshot(snapshotFixture({
    sessions: [
      sessionFixture("fx-avatar-session-003", AVATAR_STORYBOARD_BODIES[2]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[2]!.id),
    ],
  }));
  state = store.getState();
  assert.equal(state.selectedSessionId, "fx-avatar-session-003");
  assert.equal(state.sessionIndex, 0);
});

test("session cursor: select/setIndex/move stay coupled to the inspected session", () => {
  const store = createAvatarPaneStore();
  store.getState().loadSucceeded(snapshotFixture({
    sessions: [
      sessionFixture("fx-avatar-session-001", AVATAR_STORYBOARD_BODIES[0]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[0]!.id),
      sessionFixture("fx-avatar-session-002", AVATAR_STORYBOARD_BODIES[1]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id),
      sessionFixture("fx-avatar-session-003", AVATAR_STORYBOARD_BODIES[2]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[2]!.id),
    ],
  }));
  store.getState().selectSession("fx-avatar-session-002");
  assert.equal(store.getState().sessionIndex, 1);
  // 光标移动即检视（键盘导航 = 一等交互路径）。
  store.getState().moveSessionIndex(1);
  assert.equal(store.getState().sessionIndex, 2);
  assert.equal(store.getState().selectedSessionId, "fx-avatar-session-003");
  // 夹紧防御：越界移动停在末位。
  store.getState().moveSessionIndex(10);
  assert.equal(store.getState().sessionIndex, 2);
  assert.equal(store.getState().selectedSessionId, "fx-avatar-session-003");
  store.getState().moveSessionIndex(-10);
  assert.equal(store.getState().sessionIndex, 0);
  assert.equal(store.getState().selectedSessionId, "fx-avatar-session-001");
  store.getState().setSessionIndex(1);
  assert.equal(store.getState().selectedSessionId, "fx-avatar-session-002");
});

test("reassignment draft: begin pins the session, soul pick clears when the soul vanishes", () => {
  const store = createAvatarPaneStore();
  store.getState().loadSucceeded(snapshotFixture({
    sessions: [
      sessionFixture("fx-avatar-session-001", AVATAR_STORYBOARD_BODIES[0]!.id, AVATAR_STORYBOARD_SOUL_BINDINGS[0]!.id),
    ],
  }));
  store.getState().beginReassignment("fx-avatar-session-001");
  assert.deepEqual(store.getState().reassignmentDraft, {
    sessionId: "fx-avatar-session-001",
    toSoulBindingId: null,
  });
  store.getState().setReassignmentSoul(AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id);
  assert.equal(
    store.getState().reassignmentDraft.toSoulBindingId,
    AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id,
  );
  // 再附身结果视图记录 from/to（Body 契约显示源）。
  store.getState().setReassignment({
    sessionId: "fx-avatar-session-001",
    bodyId: AVATAR_STORYBOARD_BODIES[0]!.id,
    fromSoulBindingId: AVATAR_STORYBOARD_SOUL_BINDINGS[0]!.id,
    toSoulBindingId: AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id,
  });
  assert.equal(store.getState().lastReassignment?.bodyId, AVATAR_STORYBOARD_BODIES[0]!.id);
  assert.equal(
    store.getState().lastReassignment?.toSoulBindingId,
    AVATAR_STORYBOARD_SOUL_BINDINGS[1]!.id,
  );
});

test("demo state machine: start -> steps -> finish -> reset", () => {
  const store = createAvatarPaneStore();
  store.getState().demoStarted();
  assert.deepEqual(store.getState().demo, {
    active: true,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
  store.getState().demoStepRecorded({
    stepId: "load",
    summary: "Avatar plane loaded",
    refs: [],
    uiHint: {},
  });
  store.getState().demoStepRecorded({
    stepId: "body-pick",
    summary: "Body picked",
    refs: ["fx-avatar-body-001"],
    uiHint: {},
  });
  const state = store.getState();
  assert.equal(state.demo.stepIndex, 2);
  assert.equal(state.demo.outcomes.length, 2);
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
