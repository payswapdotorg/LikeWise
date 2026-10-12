// W7B logic tests — 确定性模拟控制器（node:test）。
//
// 覆盖 W7A 服务语义的 UI 侧镜像（embodiment 权威在 origin/main PR #30；本实现
// 到 T7 换绑为止）：load 幂等 + 注册面投影、字节一致的确定性（同操作序列 ⇒ 同
// 快照）、Body/Soul intake 的 typed 拒绝（reason 与 W7A 逐字对齐）、会话 lifecycle
// 转移表（open/suspend/resume/close/再附身）、阶梯法则（自环/unavailable 归
// lifecycle/越界档位/挂起/终态）、BODY/SOUL SEPARATION LAW（再附身后 Body 记录
// 字节不变）、事件词汇与载荷约定（v7 四事件 + solution-created）、realtime 信道
// 的内容寻址派生、以及「投影 == 重放」（会话头状态可由事件流折叠得出）。
import assert from "node:assert/strict";
import test from "node:test";
import type { AvatarSession, SolutionEvent } from "@zcode/shared";
import { AvatarStudioError } from "./avatarController.js";
import { createSimulatedAvatarStudioController } from "./avatarSimulatedController.js";
import {
  AVATAR_STORYBOARD_BODIES,
  AVATAR_STORYBOARD_CHANNEL_KINDS,
  AVATAR_STORYBOARD_LATENCY_CLASSES,
  AVATAR_STORYBOARD_SOUL_BINDINGS,
} from "./avatarStoryboard.js";

const BODY_1 = AVATAR_STORYBOARD_BODIES[0]!;
const BODY_2 = AVATAR_STORYBOARD_BODIES[1]!;
const SOUL_1 = AVATAR_STORYBOARD_SOUL_BINDINGS[0]!;
const SOUL_2 = AVATAR_STORYBOARD_SOUL_BINDINGS[1]!;

async function openDefaultSession(controller: ReturnType<typeof createSimulatedAvatarStudioController>): Promise<AvatarSession> {
  return controller.openSession({
    bodyId: BODY_1.id,
    soulBindingId: SOUL_1.id,
    initialState: null,
  });
}

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<AvatarStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof AvatarStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("test: expected a typed AvatarStudioError");
}

test("load bootstraps the registries from the storyboard and stays idempotent", async () => {
  const controller = createSimulatedAvatarStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(first.studioId, "fx-avatar-studio-001");
  assert.equal(first.displayName, "Avatar Studio — Aria");
  assert.equal(first.bodies.length, 3);
  assert.equal(first.soulBindings.length, 4);
  assert.equal(first.embodimentStates.length, 9);
  assert.deepEqual(first.routingProfiles, ["system-one", "system-two"]);
  assert.equal(first.simulated, true);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0]!.type, "solution-created");
  assert.equal(first.events[0]!.provenance.source, "you-phase0-avatar-storyboard");
  // 幂等：第二次 load 返回同一平面（不重建、不重复 solution-created）。
  const second = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(second.events.length, 1);
  assert.deepEqual(second.bodies.map((body) => body.id), first.bodies.map((body) => body.id));
});

test("byte-identical determinism: the same operation sequence replays the same snapshot", async () => {
  const runSequence = async () => {
    const controller = createSimulatedAvatarStudioController();
    await controller.load({ workspaceKey: "ws-determinism" });
    const session = await openDefaultSession(controller);
    await controller.transitionEmbodimentState({ sessionId: session.id, nextState: "listening" });
    await controller.transitionEmbodimentState({ sessionId: session.id, nextState: "typing" });
    await controller.suspendSession({ sessionId: session.id });
    await controller.resumeSession({ sessionId: session.id });
    await controller.reassignSoul({ sessionId: session.id, toSoulBindingId: SOUL_2.id });
    await controller.closeSession({ sessionId: session.id });
    return controller.refresh();
  };
  const first = await runSequence();
  const second = await runSequence();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("soul intake refusals are typed YOU_SOUL_BINDING_INVALID with W7A-aligned reasons", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-soul" });
  const emptyProvider = await expectTypedError(() =>
    controller.registerSoulBinding({
      providerKind: "  ",
      modelRef: "fixture/m",
      routingProfile: "system-one",
      capabilities: [],
    }),
  );
  assert.equal(emptyProvider.youError.code, "YOU_SOUL_BINDING_INVALID");
  assert.equal(emptyProvider.youError.details.reason, "provider-kind-empty");
  const emptyModel = await expectTypedError(() =>
    controller.registerSoulBinding({
      providerKind: "open-weights-llm",
      modelRef: "",
      routingProfile: "system-one",
      capabilities: [],
    }),
  );
  assert.equal(emptyModel.youError.details.reason, "model-ref-empty");
  const offLadderRouting = await expectTypedError(() =>
    controller.registerSoulBinding({
      providerKind: "open-weights-llm",
      modelRef: "fixture/m",
      routingProfile: "system-three",
      capabilities: [],
    }),
  );
  assert.equal(offLadderRouting.youError.details.reason, "routing-profile-invalid");
  const badCapability = await expectTypedError(() =>
    controller.registerSoulBinding({
      providerKind: "open-weights-llm",
      modelRef: "fixture/m",
      routingProfile: "system-one",
      capabilities: ["chat", "  "],
    }),
  );
  assert.equal(badCapability.youError.details.reason, "capability-invalid");
  // 拒绝绝不落账：注册面无新增。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.soulBindings.length, 4);
  assert.equal(snapshot.events.length, 1);
});

test("soul intake canonicalizes capabilities (sorted, deduplicated) and appends immutably", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-soul-ok" });
  const soul = await controller.registerSoulBinding({
    providerKind: "open-weights-llm",
    modelRef: "fixture/registered-soul",
    routingProfile: "system-one",
    capabilities: ["vision", "chat", "tool-use", "chat"],
  });
  // 运行时 id 来自共享计数器（solution-created 事件先取 001）——断言前缀形状。
  assert.match(soul.id, /^fx-avatar-soul-\d{3}$/);
  assert.deepEqual(soul.capabilities, ["chat", "tool-use", "vision"]);
  const snapshot = await controller.refresh();
  assert.equal(snapshot.soulBindings.length, 5);
});

test("body intake refusals are typed YOU_INVALID_STATE with the stateless validator reasons", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-body" });
  const base = {
    capabilities: ["chat"],
    tools: ["tool-x"],
    policyRefs: ["policy:p"],
    memoryContractRef: "contract:memory",
    evaluatorContractRef: "contract:evaluator",
    appearanceSpecText: null,
  };
  const emptyRole = await expectTypedError(() =>
    controller.registerBody({ ...base, role: "   " }),
  );
  assert.equal(emptyRole.youError.code, "YOU_INVALID_STATE");
  assert.equal(emptyRole.youError.details.refusal, "role-empty");
  const emptyMemory = await expectTypedError(() =>
    controller.registerBody({ ...base, role: "r", memoryContractRef: "" }),
  );
  assert.equal(emptyMemory.youError.details.refusal, "memory-contract-ref-empty");
  const emptyEvaluator = await expectTypedError(() =>
    controller.registerBody({ ...base, role: "r", evaluatorContractRef: "" }),
  );
  assert.equal(emptyEvaluator.youError.details.refusal, "evaluator-contract-ref-empty");
  const badTool = await expectTypedError(() =>
    controller.registerBody({ ...base, role: "r", tools: ["tool-x", ""] }),
  );
  assert.equal(badTool.youError.details.refusal, "tool-invalid");
  const badPolicy = await expectTypedError(() =>
    controller.registerBody({ ...base, role: "r", policyRefs: ["p", " "] }),
  );
  assert.equal(badPolicy.youError.details.refusal, "policy-ref-invalid");
  const snapshot = await controller.refresh();
  assert.equal(snapshot.bodies.length, 3);
});

test("body intake content-addresses the appearance and never inlines it", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-body-ok" });
  const withAppearance = await controller.registerBody({
    role: "notebook-curator",
    capabilities: ["index"],
    tools: ["tool-notebook"],
    policyRefs: [],
    memoryContractRef: "contract:memory",
    evaluatorContractRef: "contract:evaluator",
    appearanceSpecText: "portrait-neutral-curator",
  });
  assert.match(withAppearance.appearanceRef!, /^fx-content-/);
  assert.match(withAppearance.appearanceHash!, /^sha256-fixture-/);
  assert.ok(!JSON.stringify(withAppearance).includes("portrait-neutral-curator"));
  const withoutAppearance = await controller.registerBody({
    role: "silent-partner",
    capabilities: [],
    tools: [],
    policyRefs: [],
    memoryContractRef: "contract:memory",
    evaluatorContractRef: "contract:evaluator",
    appearanceSpecText: null,
  });
  assert.equal(withoutAppearance.appearanceRef, null);
  assert.equal(withoutAppearance.appearanceHash, null);
});

test("opening a session: unknown body / unknown soul are typed refusals, never guesses", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-open" });
  const unknownBody = await expectTypedError(() =>
    controller.openSession({
      bodyId: "fx-avatar-body-999",
      soulBindingId: SOUL_1.id,
      initialState: null,
    }),
  );
  assert.equal(unknownBody.youError.code, "YOU_BODY_NOT_FOUND");
  assert.equal(unknownBody.youError.details.reason, "unknown-body");
  const unknownSoul = await expectTypedError(() =>
    controller.openSession({
      bodyId: BODY_1.id,
      soulBindingId: "fx-avatar-soul-999",
      initialState: null,
    }),
  );
  assert.equal(unknownSoul.youError.code, "YOU_SOUL_BINDING_INVALID");
  assert.equal(unknownSoul.youError.details.reason, "unknown-soul-binding");
});

test("opening on off-ladder or lifecycle-owned states is a typed YOU_EMBODIMENT_STATE_INVALID", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-open-state" });
  const offLadder = await expectTypedError(() =>
    controller.openSession({
      bodyId: BODY_1.id,
      soulBindingId: SOUL_1.id,
      initialState: "levitating",
    }),
  );
  assert.equal(offLadder.youError.code, "YOU_EMBODIMENT_STATE_INVALID");
  assert.equal(offLadder.youError.details.reason, "state-not-on-ladder");
  const lifecycleOwned = await expectTypedError(() =>
    controller.openSession({
      bodyId: BODY_1.id,
      soulBindingId: SOUL_1.id,
      initialState: "unavailable",
    }),
  );
  assert.equal(lifecycleOwned.youError.details.reason, "unavailable-is-lifecycle-owned");
});

test("a fresh session opens active at the idle rung with two content-addressed channels", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-open-ok" });
  const session = await controller.openSession({
    bodyId: BODY_1.id,
    soulBindingId: SOUL_1.id,
    initialState: null,
  });
  assert.equal(session.status, "active");
  assert.equal(session.state, "idle");
  assert.equal(session.bodyId, BODY_1.id);
  assert.equal(session.soulBindingId, SOUL_1.id);
  assert.equal(session.closedAt, null);
  assert.equal(session.simulated, true);
  const snapshot = await controller.refresh();
  // avatar-session-opened 事件载荷携带 body/soul 事实（W7A ledgerOps 同款约定）。
  const opened = snapshot.events.find((event) => event.type === "avatar-session-opened");
  assert.ok(opened);
  assert.equal(opened.subjectRef, session.id);
  assert.equal(opened.payload.bodyId, BODY_1.id);
  assert.equal(opened.payload.bodyRole, BODY_1.role);
  assert.equal(opened.payload.soulBindingId, SOUL_1.id);
  assert.equal(opened.payload.soulRoutingProfile, SOUL_1.routingProfile);
  assert.equal(opened.payload.statusAfter, "active");
  assert.equal(opened.payload.stateAfter, "idle");
  assert.equal(opened.payload.simulated, true);
  // 信道成对派生（avatar-audio + avatar-video），内容寻址流标签。
  const channels = snapshot.channels;
  assert.equal(channels.length, 2);
  assert.deepEqual(
    channels.map((channel) => channel.kind).sort(),
    [...AVATAR_STORYBOARD_CHANNEL_KINDS].sort(),
  );
  for (const channel of channels) {
    assert.match(channel.streamRef, /^fx-stream-/);
    assert.match(channel.streamHash, /^sha256-fixture-/);
    assert.ok(AVATAR_STORYBOARD_LATENCY_CLASSES.includes(channel.latencyClass));
  }
  // system-one ⇒ realtime latency class（routing profile 驱动显示投影）。
  assert.equal(channels[0]!.latencyClass, "realtime");
  assert.equal(snapshot.sessionChannels.length, 2);
});

test("an initialState intake is honored (second session at listening with its own channels)", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-open-listening" });
  const session = await controller.openSession({
    bodyId: BODY_2.id,
    soulBindingId: SOUL_1.id,
    initialState: "listening",
  });
  assert.equal(session.state, "listening");
  const snapshot = await controller.refresh();
  assert.equal(snapshot.channels.length, 2);
  // 两个会话各自持有信道绑定。
  assert.equal(
    snapshot.sessionChannels.filter((entry) => entry.sessionId === session.id).length,
    2,
  );
});

test("activity transitions append embodiment-state-changed events and replace the head immutably", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-walk" });
  const session = await openDefaultSession(controller);
  const before = (await controller.refresh()).sessions.find((entry) => entry.id === session.id)!;
  const walked = await controller.transitionEmbodimentState({
    sessionId: session.id,
    nextState: "listening",
  });
  assert.equal(walked.state, "listening");
  // 不可变替换：旧头记录不被原地改写。
  assert.equal(before.state, "idle");
  const snapshot = await controller.refresh();
  const change = snapshot.events.find((event) => event.type === "embodiment-state-changed");
  assert.ok(change);
  assert.equal(change.payload.stateBefore, "idle");
  assert.equal(change.payload.stateAfter, "listening");
  assert.equal(change.payload.reason, "activity");
  assert.equal(change.payload.simulated, true);
});

test("the frozen transition table refuses self-loops, lifecycle-owned rungs and off-ladder states", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-table" });
  const session = await openDefaultSession(controller);
  await controller.transitionEmbodimentState({ sessionId: session.id, nextState: "typing" });
  const selfLoop = await expectTypedError(() =>
    controller.transitionEmbodimentState({ sessionId: session.id, nextState: "typing" }),
  );
  assert.equal(selfLoop.youError.code, "YOU_EMBODIMENT_STATE_INVALID");
  assert.equal(selfLoop.youError.details.reason, "no-op-transition");
  const toUnavailable = await expectTypedError(() =>
    controller.transitionEmbodimentState({ sessionId: session.id, nextState: "unavailable" }),
  );
  assert.equal(toUnavailable.youError.details.reason, "unavailable-is-lifecycle-owned");
  const offLadder = await expectTypedError(() =>
    controller.transitionEmbodimentState({ sessionId: session.id, nextState: "levitating" }),
  );
  assert.equal(offLadder.youError.details.reason, "state-not-on-ladder");
});

test("interaction rungs are fully connected in both directions (all 8x8 legal pairs minus self-loops)", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-full" });
  const interaction = [
    "listening",
    "reading",
    "typing",
    "thinking",
    "tool_use",
    "speaking",
    "interrupted",
    "idle",
  ] as const;
  for (const from of interaction) {
    for (const to of interaction) {
      if (from === to) continue;
      const session = await controller.openSession({
        bodyId: BODY_1.id,
        soulBindingId: SOUL_1.id,
        initialState: from,
      });
      const result = await controller.transitionEmbodimentState({
        sessionId: session.id,
        nextState: to,
      });
      assert.equal(result.state, to);
      await controller.closeSession({ sessionId: session.id });
    }
  }
});

test("suspend projects suspended/unavailable with the status riding the event; resume returns to active/idle", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-suspend" });
  const session = await openDefaultSession(controller);
  const suspended = await controller.suspendSession({ sessionId: session.id });
  assert.equal(suspended.status, "suspended");
  assert.equal(suspended.state, "unavailable");
  let snapshot = await controller.refresh();
  const suspendEvent = [...snapshot.events]
    .reverse()
    .find((event) => event.type === "embodiment-state-changed")!;
  assert.equal(suspendEvent.payload.reason, "suspend");
  assert.equal(suspendEvent.payload.statusAfter, "suspended");
  assert.equal(suspendEvent.payload.stateAfter, "unavailable");
  // 挂起期间活动转移被 typed 拒绝。
  const refused = await expectTypedError(() =>
    controller.transitionEmbodimentState({ sessionId: session.id, nextState: "speaking" }),
  );
  assert.equal(refused.youError.details.reason, "session-suspended");
  // 重复挂起被拒绝。
  const doubleSuspend = await expectTypedError(() =>
    controller.suspendSession({ sessionId: session.id }),
  );
  assert.equal(doubleSuspend.youError.details.reason, "already-suspended");
  const resumed = await controller.resumeSession({ sessionId: session.id });
  assert.equal(resumed.status, "active");
  assert.equal(resumed.state, "idle");
  snapshot = await controller.refresh();
  const resumeEvent = [...snapshot.events]
    .reverse()
    .find((event) => event.type === "embodiment-state-changed")!;
  assert.equal(resumeEvent.payload.reason, "resume");
  assert.equal(resumeEvent.payload.statusAfter, "active");
  // 活跃会话恢复被拒绝。
  const notSuspended = await expectTypedError(() =>
    controller.resumeSession({ sessionId: session.id }),
  );
  assert.equal(notSuspended.youError.details.reason, "not-suspended");
});

test("re-possession swaps only the soul binding: the Body record stays byte-identical (separation law)", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-reassign" });
  const session = await openDefaultSession(controller);
  const snapshotBefore = await controller.refresh();
  const bodyBefore = snapshotBefore.bodies.find((body) => body.id === session.bodyId)!;
  const reassigned = await controller.reassignSoul({
    sessionId: session.id,
    toSoulBindingId: SOUL_2.id,
  });
  assert.equal(reassigned.soulBindingId, SOUL_2.id);
  assert.equal(reassigned.bodyId, session.bodyId);
  assert.equal(reassigned.status, session.status);
  assert.equal(reassigned.state, session.state);
  const snapshotAfter = await controller.refresh();
  const bodyAfter = snapshotAfter.bodies.find((body) => body.id === session.bodyId)!;
  assert.equal(JSON.stringify(bodyBefore), JSON.stringify(bodyAfter));
  // soul-reassigned 事件载荷：from/to + 头事实（bodyId 保持）。
  const event = snapshotAfter.events.find((event) => event.type === "soul-reassigned");
  assert.ok(event);
  assert.equal(event.payload.bodyId, session.bodyId);
  assert.equal(event.payload.fromSoulBindingId, SOUL_1.id);
  assert.equal(event.payload.toSoulBindingId, SOUL_2.id);
  assert.equal(event.payload.toSoulRoutingProfile, SOUL_2.routingProfile);
  assert.equal(event.payload.simulated, true);
  // 未知目标 Soul ⇒ YOU_SOUL_BINDING_INVALID。
  const unknown = await expectTypedError(() =>
    controller.reassignSoul({ sessionId: session.id, toSoulBindingId: "fx-avatar-soul-999" }),
  );
  assert.equal(unknown.youError.details.reason, "unknown-soul-binding");
});

test("close is terminal: status closed, closedAt stamped, every further mutation refused typed", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-close" });
  const session = await openDefaultSession(controller);
  const closed = await controller.closeSession({ sessionId: session.id });
  assert.equal(closed.status, "closed");
  assert.equal(closed.state, "unavailable");
  assert.ok(closed.closedAt !== null);
  const snapshot = await controller.refresh();
  const closeEvent = snapshot.events.find((event) => event.type === "avatar-session-closed");
  assert.ok(closeEvent);
  assert.equal(closeEvent.payload.statusAfter, "closed");
  assert.equal(closeEvent.payload.closedAt, closed.closedAt);
  const alreadyClosed = await expectTypedError(() =>
    controller.closeSession({ sessionId: session.id }),
  );
  assert.equal(alreadyClosed.youError.details.reason, "already-closed");
  const closedTransition = await expectTypedError(() =>
    controller.transitionEmbodimentState({ sessionId: session.id, nextState: "idle" }),
  );
  assert.equal(closedTransition.youError.details.reason, "session-closed");
  const closedSuspend = await expectTypedError(() =>
    controller.suspendSession({ sessionId: session.id }),
  );
  assert.equal(closedSuspend.youError.details.reason, "session-closed");
  const closedReassign = await expectTypedError(() =>
    controller.reassignSoul({ sessionId: session.id, toSoulBindingId: SOUL_2.id }),
  );
  assert.equal(closedReassign.youError.details.reason, "session-closed");
});

test("unknown session ids are typed YOU_AVATAR_SESSION_NOT_FOUND on every control path", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-unknown" });
  for (const operation of [
    () => controller.transitionEmbodimentState({ sessionId: "fx-avatar-session-999", nextState: "idle" }),
    () => controller.suspendSession({ sessionId: "fx-avatar-session-999" }),
    () => controller.resumeSession({ sessionId: "fx-avatar-session-999" }),
    () => controller.closeSession({ sessionId: "fx-avatar-session-999" }),
    () => controller.reassignSoul({ sessionId: "fx-avatar-session-999", toSoulBindingId: SOUL_1.id }),
  ]) {
    const error = await expectTypedError(operation);
    assert.equal(error.youError.code, "YOU_AVATAR_SESSION_NOT_FOUND");
    assert.equal(error.youError.details.reason, "unknown-avatar-session");
  }
});

test("the event vocabulary is exactly the frozen v7 set plus solution-created, append-only", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-vocab" });
  const session = await openDefaultSession(controller);
  await controller.transitionEmbodimentState({ sessionId: session.id, nextState: "speaking" });
  await controller.suspendSession({ sessionId: session.id });
  await controller.resumeSession({ sessionId: session.id });
  await controller.reassignSoul({ sessionId: session.id, toSoulBindingId: SOUL_2.id });
  await controller.closeSession({ sessionId: session.id });
  const snapshot = await controller.refresh();
  const allowed = new Set<SolutionEvent["type"]>([
    "solution-created",
    "avatar-session-opened",
    "embodiment-state-changed",
    "soul-reassigned",
    "avatar-session-closed",
  ]);
  assert.ok(snapshot.events.every((event) => allowed.has(event.type)));
  // 顺序：created → opened → changed(activity) → changed(suspend) → changed(resume) → reassigned → closed。
  assert.deepEqual(
    snapshot.events.map((event) => event.type),
    [
      "solution-created",
      "avatar-session-opened",
      "embodiment-state-changed",
      "embodiment-state-changed",
      "embodiment-state-changed",
      "soul-reassigned",
      "avatar-session-closed",
    ],
  );
  // append-only：早期事件在后续操作后原样保留（id/occurredAt 稳定）。
  const openedBefore = snapshot.events[1]!;
  await controller.openSession({ bodyId: BODY_2.id, soulBindingId: SOUL_1.id, initialState: null });
  const refreshed = await controller.refresh();
  const openedAfter = refreshed.events[1]!;
  assert.deepEqual(openedBefore, openedAfter);
});

test("projection == replay: session heads fold deterministically from the event stream", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-replay" });
  const session = await openDefaultSession(controller);
  await controller.transitionEmbodimentState({ sessionId: session.id, nextState: "reading" });
  await controller.suspendSession({ sessionId: session.id });
  await controller.resumeSession({ sessionId: session.id });
  const snapshot = await controller.refresh();
  // 折叠：最后一次作用于该会话的 stateAfter 即投影头。
  const lastForSession = [...snapshot.events]
    .filter((event) => event.subjectRef === session.id)
    .at(-1)!;
  const head = snapshot.sessions.find((entry) => entry.id === session.id)!;
  assert.equal(lastForSession.payload.stateAfter, head.state);
  assert.equal(lastForSession.payload.statusAfter, head.status);
});

test("snapshot lists are id-ascending and sessions resolve via controller selectors", async () => {
  const controller = createSimulatedAvatarStudioController();
  await controller.load({ workspaceKey: "ws-order" });
  const first = await openDefaultSession(controller);
  const second = await controller.openSession({
    bodyId: BODY_2.id,
    soulBindingId: SOUL_2.id,
    initialState: null,
  });
  const snapshot = await controller.refresh();
  assert.deepEqual(
    snapshot.sessions.map((session) => session.id),
    [first.id, second.id].sort(),
  );
  // 信道按会话隔离：各自一对。
  for (const session of snapshot.sessions) {
    const channelIds = snapshot.sessionChannels
      .filter((entry) => entry.sessionId === session.id)
      .map((entry) => entry.channelId);
    assert.equal(channelIds.length, 2);
  }
});
