// W7B logic tests — Avatar 视图纯投影（node:test）。
//
// 覆盖：九级阶梯投影（current/visited 派生自事件流）、会话行/控制可用性、
// Body/Soul picker 行（内容寻址标签）、Realtime 信道面板行、区域视图模型、
// 键盘转移、配置草稿与再附身草稿禁用原因、阶梯转移按钮可用性、事件尾部。
import assert from "node:assert/strict";
import test from "node:test";
import type { AvatarSession, SolutionEvent } from "@zcode/shared";
import {
  projectBodyOptionRows,
  projectChannelPanelRows,
  projectConfigurationDraftView,
  projectEmbodimentLadder,
  projectLadderTransitionAvailability,
  projectListRegionView,
  projectReassignmentDraftView,
  projectSessionControlAvailability,
  projectSessionEventTail,
  projectSessionRows,
  projectSoulOptionRows,
  ladderVisitedCount,
} from "./avatarStudioProjection.js";
import { AVATAR_STORYBOARD_BODIES, AVATAR_STORYBOARD_SOUL_BINDINGS } from "./avatarStoryboard.js";
import {
  AVATAR_STORYBOARD_EMBODIMENT_STATES,
} from "./avatarStoryboardLaws.js";

function sessionFixture(overrides: Partial<AvatarSession> = {}): AvatarSession {
  return {
    id: "fx-avatar-session-001",
    bodyId: "fx-avatar-body-001",
    soulBindingId: "fx-avatar-soul-001",
    status: "active",
    state: "idle",
    openedAt: "2026-10-12T00:00:00.000Z",
    closedAt: null,
    simulated: true,
    ...overrides,
  };
}

function eventFixture(
  id: string,
  type: SolutionEvent["type"],
  subjectRef: string,
  payload: Record<string, string | number | boolean>,
): SolutionEvent {
  return {
    id,
    solutionId: "fx-avatar-studio",
    type,
    occurredAt: "2026-10-12T00:00:01.000Z",
    subjectRef,
    payload,
    provenance: {
      source: "you-phase0-avatar-storyboard",
      generator: "agent",
      createdAt: "2026-10-12T00:00:01.000Z",
      lineage: [],
    },
  };
}

test("ladder projection: nine rungs in frozen canonical order, none current without a session", () => {
  const ladder = projectEmbodimentLadder(null, []);
  assert.equal(ladder.length, 9);
  assert.deepEqual(
    ladder.map((step) => step.state),
    [...AVATAR_STORYBOARD_EMBODIMENT_STATES],
  );
  assert.ok(ladder.every((step) => !step.current && !step.visited));
});

test("ladder projection: current rung is the projection head; visited derives from the event stream", () => {
  const session = sessionFixture({ state: "tool_use" });
  const events = [
    eventFixture("e1", "avatar-session-opened", session.id, {
      sessionId: session.id,
      statusAfter: "active",
      stateAfter: "idle",
      openedAt: session.openedAt,
      simulated: true,
    }),
    eventFixture("e2", "embodiment-state-changed", session.id, {
      sessionId: session.id,
      stateBefore: "idle",
      stateAfter: "listening",
      reason: "activity",
      simulated: true,
    }),
    eventFixture("e3", "embodiment-state-changed", session.id, {
      sessionId: session.id,
      stateBefore: "listening",
      stateAfter: "tool_use",
      reason: "activity",
      simulated: true,
    }),
  ];
  const ladder = projectEmbodimentLadder(session, events);
  const byState = new Map(ladder.map((step) => [step.state, step]));
  // 投影头 = current。
  assert.equal(byState.get("tool_use")?.current, true);
  assert.equal(byState.get("idle")?.current, false);
  // visited = 事件流出现过的档位（idle/listening/tool_use + current）。
  assert.equal(byState.get("idle")?.visited, true);
  assert.equal(byState.get("listening")?.visited, true);
  assert.equal(byState.get("tool_use")?.visited, true);
  assert.equal(byState.get("thinking")?.visited, false);
  assert.equal(byState.get("unavailable")?.visited, false);
  assert.equal(ladderVisitedCount(ladder), 3);
  // 其它会话的事件不串扰本会话阶梯。
  const foreign = projectEmbodimentLadder(session, [
    eventFixture("e4", "embodiment-state-changed", "fx-avatar-session-999", {
      sessionId: "fx-avatar-session-999",
      stateBefore: "idle",
      stateAfter: "speaking",
      reason: "activity",
      simulated: true,
    }),
  ]);
  assert.equal(
    foreign.find((step) => step.state === "speaking")?.visited,
    false,
  );
});

test("ladder projection: suspend/resume lifecycle events surface the unavailable rung as visited", () => {
  const suspended = sessionFixture({ status: "suspended", state: "unavailable" });
  const events = [
    eventFixture("e1", "embodiment-state-changed", suspended.id, {
      sessionId: suspended.id,
      stateBefore: "idle",
      stateAfter: "unavailable",
      statusAfter: "suspended",
      reason: "suspend",
      simulated: true,
    }),
  ];
  const ladder = projectEmbodimentLadder(suspended, events);
  const byState = new Map(ladder.map((step) => [step.state, step]));
  assert.equal(byState.get("unavailable")?.current, true);
  assert.equal(byState.get("unavailable")?.visited, true);
  assert.equal(byState.get("idle")?.visited, true);
});

test("session rows carry lifecycle facts and accessible labels", () => {
  const rows = projectSessionRows([
    sessionFixture(),
    sessionFixture({
      id: "fx-avatar-session-002",
      status: "closed",
      state: "unavailable",
      closedAt: "2026-10-12T00:05:00.000Z",
    }),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.status, "active");
  assert.equal(rows[0]!.state, "idle");
  assert.equal(rows[1]!.closedAt, "2026-10-12T00:05:00.000Z");
  assert.match(rows[0]!.accessibleLabel, /session fx-avatar-session-001: active idle/);
  assert.match(rows[1]!.accessibleLabel, /closed unavailable/);
});

test("session control availability mirrors the frozen lifecycle table (display only; the service refuses independently)", () => {
  assert.deepEqual(projectSessionControlAvailability(null), {
    canSuspend: false,
    canResume: false,
    canClose: false,
    canReassign: false,
  });
  const active = projectSessionControlAvailability(sessionFixture({ status: "active" }));
  assert.deepEqual(active, { canSuspend: true, canResume: false, canClose: true, canReassign: true });
  const suspended = projectSessionControlAvailability(sessionFixture({ status: "suspended", state: "unavailable" }));
  assert.deepEqual(suspended, { canSuspend: false, canResume: true, canClose: true, canReassign: true });
  const closed = projectSessionControlAvailability(sessionFixture({ status: "closed", state: "unavailable" }));
  assert.deepEqual(closed, { canSuspend: false, canResume: false, canClose: false, canReassign: false });
});

test("body option rows keep content-addressed appearance labels and never inline content", () => {
  const rows = projectBodyOptionRows(AVATAR_STORYBOARD_BODIES);
  assert.equal(rows.length, 3);
  const withAppearance = rows[0]!;
  assert.equal(withAppearance.bodyId, "fx-avatar-body-001");
  assert.match(withAppearance.appearanceRef!, /^fx-content-/);
  assert.match(withAppearance.appearanceHash!, /^sha256-fixture-/);
  assert.equal(withAppearance.capabilities.length, 3);
  assert.equal(withAppearance.tools.length, 2);
  // fx-avatar-body-003 诚实地无外观。
  const withoutAppearance = rows[2]!;
  assert.equal(withoutAppearance.appearanceRef, null);
  assert.equal(withoutAppearance.appearanceHash, null);
  assert.match(withoutAppearance.accessibleLabel, /no stored appearance/);
});

test("soul option rows render providerKind/modelRef/routingProfile facts", () => {
  const rows = projectSoulOptionRows(AVATAR_STORYBOARD_SOUL_BINDINGS);
  assert.equal(rows.length, 4);
  assert.equal(rows[0]!.providerKind, "open-weights-llm");
  assert.equal(rows[0]!.routingProfile, "system-one");
  assert.equal(rows[1]!.routingProfile, "system-two");
  assert.equal(rows[2]!.providerKind, "vision-language-model");
  assert.match(rows[0]!.accessibleLabel, /soul fx-avatar-soul-001: open-weights-llm/);
});

test("channel panel rows keep content-addressed stream labels and the latency class", () => {
  const rows = projectChannelPanelRows([
    {
      id: "fx-avatar-channel-001",
      kind: "avatar-audio",
      streamRef: "fx-stream-abc",
      streamHash: "sha256-fixture-abc",
      latencyClass: "realtime",
    },
    {
      id: "fx-avatar-channel-002",
      kind: "avatar-video",
      streamRef: "fx-stream-def",
      streamHash: "sha256-fixture-def",
      latencyClass: "near-realtime",
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.latencyClass, "realtime");
  assert.match(rows[0]!.accessibleLabel, /stream fx-stream-abc \(sha256-fixture-abc\)/);
  assert.equal(rows[1]!.kind, "avatar-video");
});

test("region view model: loading without a snapshot, empty with no data, ready otherwise", () => {
  assert.equal(projectListRegionView(false, 0), "loading");
  assert.equal(projectListRegionView(true, 0), "empty");
  assert.equal(projectListRegionView(true, 3), "ready");
  assert.equal(projectListRegionView(false, 3), "loading");
});

test("configuration draft disables in deterministic order: body then soul", () => {
  assert.deepEqual(
    projectConfigurationDraftView({ bodyId: null, soulBindingId: null }).disabledReason,
    "no-body",
  );
  assert.deepEqual(
    projectConfigurationDraftView({ bodyId: "b1", soulBindingId: null }).disabledReason,
    "no-soul",
  );
  assert.deepEqual(
    projectConfigurationDraftView({ bodyId: "b1", soulBindingId: "s1" }).disabledReason,
    null,
  );
});

test("reassignment draft disables in deterministic order: session, soul, then same-soul guard", () => {
  assert.deepEqual(
    projectReassignmentDraftView({ sessionId: null, toSoulBindingId: null }, null).disabledReason,
    "no-session",
  );
  assert.deepEqual(
    projectReassignmentDraftView({ sessionId: "s1", toSoulBindingId: null }, "soul-a").disabledReason,
    "no-soul",
  );
  assert.deepEqual(
    projectReassignmentDraftView({ sessionId: "s1", toSoulBindingId: "soul-a" }, "soul-a").disabledReason,
    "same-soul",
  );
  assert.deepEqual(
    projectReassignmentDraftView({ sessionId: "s1", toSoulBindingId: "soul-b" }, "soul-a").disabledReason,
    null,
  );
});

test("ladder transition availability: eight interaction rungs offered; current and non-active sessions disabled", () => {
  const availability = projectLadderTransitionAvailability(sessionFixture({ state: "typing" }));
  assert.equal(availability.length, 8);
  assert.ok(availability.every((entry) => entry.offered));
  // 自环（当前档）禁用。
  assert.equal(availability.find((entry) => entry.state === "typing")?.disabled, true);
  assert.equal(availability.find((entry) => entry.state === "listening")?.disabled, false);
  // unavailable 不在 offered 集合中（lifecycle 所有）。
  assert.ok(!availability.some((entry) => entry.state === "unavailable"));
  // 挂起/关闭/无会话时全部禁用。
  const suspended = projectLadderTransitionAvailability(
    sessionFixture({ status: "suspended", state: "unavailable" }),
  );
  assert.ok(suspended.every((entry) => entry.disabled));
  const closed = projectLadderTransitionAvailability(
    sessionFixture({ status: "closed", state: "unavailable" }),
  );
  assert.ok(closed.every((entry) => entry.disabled));
  assert.ok(projectLadderTransitionAvailability(null).every((entry) => entry.disabled));
});

test("session event tail: latest-first, session-scoped, capped", () => {
  const events = [
    eventFixture("e1", "avatar-session-opened", "fx-avatar-session-001", { simulated: true }),
    eventFixture("e2", "embodiment-state-changed", "fx-avatar-session-001", { simulated: true }),
    eventFixture("e3", "embodiment-state-changed", "fx-avatar-session-002", { simulated: true }),
    eventFixture("e4", "soul-reassigned", "fx-avatar-session-001", { simulated: true }),
    eventFixture("e5", "avatar-session-closed", "fx-avatar-session-001", { simulated: true }),
  ];
  const tail = projectSessionEventTail(events, "fx-avatar-session-001", 3);
  assert.deepEqual(
    tail.map((event) => event.id),
    ["e5", "e4", "e2"],
  );
  assert.deepEqual(projectSessionEventTail(events, null, 3), []);
});
