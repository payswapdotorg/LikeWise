// W7B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：demo 覆盖 W7B 验收全闭环（挑选 → 诚实 intake 拒绝 → 未知 Body → 会话
// 打开 → 阶梯行走 → 阶梯法则拒绝（自环/unavailable/越界）→ 挂起 → 挂起拒绝 →
// 恢复 → 再附身（Body 契约不变）→ realtime 信道 → 关闭 → 终态拒绝 → 未知会话 →
// 第二会话 → 注册面扩展）、重放字节一致（golden 确定性）、demo 终态的结构断言
//（会话/注册面/事件词汇/信道）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedAvatarStudioController } from "./avatarSimulatedController.js";
import {
  AVATAR_DEMO_STEPS,
  AVATAR_DEMO_TOTAL_STEPS,
  runAvatarDemoStep,
} from "./avatarStudioDemo.js";
import type { AvatarStudioController } from "./avatarController.js";
import type { SolutionEventType } from "@zcode/shared";

async function runFullDemo(controller: AvatarStudioController) {
  const outcomes = [];
  for (const demoStep of AVATAR_DEMO_STEPS) {
    outcomes.push(await runAvatarDemoStep(controller, demoStep));
  }
  return outcomes;
}

test("the demo covers the full W7B loop and records every step", async () => {
  const controller = createSimulatedAvatarStudioController();
  const outcomes = await runFullDemo(controller);
  assert.equal(outcomes.length, AVATAR_DEMO_TOTAL_STEPS);
  assert.equal(AVATAR_DEMO_TOTAL_STEPS, 22);
  // 步骤 id 顺序与声明一致（golden 序列）。
  assert.deepEqual(
    outcomes.map((outcome) => outcome.stepId),
    [
      "load",
      "body-pick",
      "soul-pick",
      "soul-intake-invalid",
      "body-intake-invalid",
      "body-not-found",
      "session-open",
      "ladder-walk",
      "self-loop-refused",
      "unavailable-refused",
      "unknown-state-refused",
      "session-suspend",
      "suspended-refused",
      "session-resume",
      "soul-reassign",
      "realtime-channels",
      "session-close",
      "closed-terminal",
      "session-not-found",
      "second-session",
      "body-register",
      "soul-register",
    ],
  );
  // 每步都有非空 summary 与 uiHint 对象（展示与视图提示齐备）。
  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 0);
    assert.ok(typeof outcome.uiHint === "object");
  }
  // 九条诚实 typed 错误路径以 code 前缀呈现（truth law——不伪装成功）。
  const typedErrorSteps = outcomes
    .filter((outcome) => outcome.summary.includes("YOU_"))
    .map((outcome) => outcome.stepId);
  assert.deepEqual(typedErrorSteps, [
    "soul-intake-invalid",
    "body-intake-invalid",
    "body-not-found",
    "self-loop-refused",
    "unavailable-refused",
    "unknown-state-refused",
    "suspended-refused",
    "closed-terminal",
    "session-not-found",
  ]);
  // 四个 v7 验收 code 全部被演练（含各自的语义路径）。
  const codesPresent = new Set(
    outcomes
      .filter((outcome) => outcome.summary.includes("YOU_"))
      .map((outcome) => outcome.summary.split(":")[0]),
  );
  assert.ok(codesPresent.has("YOU_SOUL_BINDING_INVALID"));
  assert.ok(codesPresent.has("YOU_BODY_NOT_FOUND"));
  assert.ok(codesPresent.has("YOU_EMBODIMENT_STATE_INVALID"));
  assert.ok(codesPresent.has("YOU_AVATAR_SESSION_NOT_FOUND"));
});

test("the demo is byte-identical across independent runs (golden determinism)", async () => {
  const first = await runFullDemo(createSimulatedAvatarStudioController());
  const second = await runFullDemo(createSimulatedAvatarStudioController());
  assert.deepEqual(first.map((outcome) => outcome.summary), second.map((outcome) => outcome.summary));
  assert.deepEqual(
    first.map((outcome) => outcome.refs),
    second.map((outcome) => outcome.refs),
  );
});

test("the demo's structural end state: sessions, registries, channels and the event vocabulary", async () => {
  const controller = createSimulatedAvatarStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();
  // 两个会话（第一个 closed 终态；第二个 active at listening）。
  assert.equal(snapshot.sessions.length, 2);
  const firstSession = snapshot.sessions[0]!;
  const secondSession = snapshot.sessions[1]!;
  assert.equal(firstSession.status, "closed");
  assert.equal(firstSession.state, "unavailable");
  assert.ok(firstSession.closedAt !== null);
  assert.equal(secondSession.status, "active");
  assert.equal(secondSession.state, "listening");
  // 注册面经投射意图扩展：4 body + 5 soul。
  assert.equal(snapshot.bodies.length, 4);
  assert.equal(snapshot.soulBindings.length, 5);
  // 4 信道（每会话一对），内容寻址标签。
  assert.equal(snapshot.channels.length, 4);
  for (const channel of snapshot.channels) {
    assert.match(channel.streamRef, /^fx-stream-/);
    assert.match(channel.streamHash, /^sha256-fixture-/);
  }
  // 事件词汇严格在 v7 冻结集 + solution-created 内。
  const allowed = new Set<SolutionEventType>([
    "solution-created",
    "avatar-session-opened",
    "embodiment-state-changed",
    "soul-reassigned",
    "avatar-session-closed",
  ]);
  assert.ok(snapshot.events.every((event) => allowed.has(event.type)));
  assert.ok(snapshot.events.some((event) => event.type === "soul-reassigned"));
  assert.ok(snapshot.events.some((event) => event.type === "avatar-session-closed"));
  // 再附身后第一个会话的 soul 是 soul-002（Body 不变——分离法则由控制器测试覆盖）。
  assert.equal(firstSession.soulBindingId, "fx-avatar-soul-002");
  assert.equal(firstSession.bodyId, "fx-avatar-body-001");
});

test("demo ui hints steer the panel and pickers deterministically", async () => {
  const controller = createSimulatedAvatarStudioController();
  const outcomes = await runFullDemo(controller);
  const byId = new Map(outcomes.map((outcome) => [outcome.stepId, outcome]));
  assert.deepEqual(byId.get("load")!.uiHint, { panel: "configuration" });
  assert.deepEqual(byId.get("session-open")!.uiHint, {
    panel: "embodiment",
    selectedSessionId: byId.get("session-open")!.refs[0],
  });
  assert.deepEqual(byId.get("soul-reassign")!.uiHint, {
    panel: "session",
    selectedSessionId: byId.get("soul-reassign")!.refs[0],
  });
  assert.deepEqual(byId.get("realtime-channels")!.uiHint, {
    panel: "realtime",
    selectedSessionId: byId.get("realtime-channels")!.refs[0],
  });
  assert.equal(byId.get("body-register")!.uiHint.panel, "configuration");
  assert.equal(byId.get("body-register")!.uiHint.selectedBodyId, byId.get("body-register")!.refs[0]);
  assert.equal(byId.get("soul-register")!.uiHint.selectedSoulBindingId, byId.get("soul-register")!.refs[0]);
});

test("the re-possession step proves the Body contract display stays identical", async () => {
  const controller = createSimulatedAvatarStudioController();
  const outcomes = await runFullDemo(controller);
  const reassignOutcome = outcomes.find((outcome) => outcome.stepId === "soul-reassign")!;
  // summary 携带分离法则的可断言事实。
  assert.match(reassignOutcome.summary, /body\/soul separation law/);
  assert.match(reassignOutcome.summary, /byte-identical/);
  // refs：[sessionId, toSoulBindingId]。
  assert.equal(reassignOutcome.refs.length, 2);
  const snapshot = await controller.refresh();
  const session = snapshot.sessions[0]!;
  assert.equal(session.soulBindingId, reassignOutcome.refs[1]);
});
