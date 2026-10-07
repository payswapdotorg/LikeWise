// W1B logic tests — 确定性 operator demo 驱动器（node:test）。
//
// 覆盖 FIXTURES.md「Phase-0 loop fixture」：全步骤按序执行、版本链、可度量改进、
// 学习许可门（未授权绝不学习）、append-only 事件账本、以及两条独立驱动的
// 字节一致性重放（determinism）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedSolutionSurfaceController } from "./solutionSimulatedController.js";
import type { SolutionSurfaceController } from "./solutionController.js";
import {
  runSolutionDemoStep,
  SOLUTION_DEMO_STEPS,
  SOLUTION_DEMO_TOTAL_STEPS,
  type SolutionDemoStepOutcome,
} from "./solutionDemo.js";
import { STORYBOARD_INTENT } from "./solutionStoryboard.js";

async function runFullDemo(controller: SolutionSurfaceController): Promise<SolutionDemoStepOutcome[]> {
  const outcomes: SolutionDemoStepOutcome[] = [];
  for (const step of SOLUTION_DEMO_STEPS) {
    outcomes.push(await runSolutionDemoStep(controller, step));
  }
  return outcomes;
}

test("demo script covers the full Phase-0 loop in order", () => {
  assert.equal(SOLUTION_DEMO_TOTAL_STEPS, 17);
  assert.deepEqual(
    SOLUTION_DEMO_STEPS.map((step) => step.id),
    [
      "intent",
      "feedback",
      "evidence-request",
      "evidence-provided",
      "improvement-proposed",
      "improvement-accepted",
      "takeover-open",
      "takeover-correction",
      "takeover-accepted",
      "learning-consent",
      "export",
      "re-import",
      "re-import-accepted",
      "repeated-intent",
      "capability-gap",
      "arena-escalate",
      "arena-apply",
    ],
  );
  // 每步都有标题与描述文案 id。
  for (const step of SOLUTION_DEMO_STEPS) {
    assert.match(step.titleMessageId, /^you\.demo\.step\.[a-z-]+\.title$/);
    assert.match(step.descriptionMessageId, /^you\.demo\.step\.[a-z-]+\.description$/);
  }
});

test("full loop: versions chain v1->v6 with truthful authors and measurable improvement", async () => {
  const controller = createSimulatedSolutionSurfaceController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();

  // 版本链：1 intent(fixture) / 2 agent / 3 user / 4 importer / 5 agent(learned) / 6 expert。
  assert.deepEqual(
    snapshot.versions.map((version) => [version.version, version.provenance.generator]),
    [
      [1, "fixture"],
      [2, "agent"],
      [3, "user"],
      [4, "importer"],
      [5, "agent"],
      [6, "expert"],
    ],
  );
  // 不可变链：每个版本的 parent 指向前一个。
  for (let i = 1; i < snapshot.versions.length; i += 1) {
    assert.equal(snapshot.versions[i]!.parentVersionId, snapshot.versions[i - 1]!.id);
  }

  // 可度量改进：geometry 反馈 → geometry 0.52 -> 0.76（+0.24），
  // 未涉及的 deficiency class 保持不变（truthful：改进步长只作用于反馈目标类）。
  const v1 = snapshot.versions[0]!;
  const v2 = snapshot.versions[1]!;
  assert.equal(v1.state.quality.geometry, 0.52);
  assert.equal(v2.state.quality.geometry, 0.76);
  assert.equal(v2.state.quality.identity, 0.58);
  assert.equal(v2.state.quality.motion_naturalness, 0.47);
  // 头部实体属性同步精化（几何类反馈的可见改进）。
  const v2Head = v2.state.entities.find((entity) => entity.id === "fx-human-head")!;
  assert.equal(v2Head.attributes.meshDetail, "high");
  assert.equal(v2Head.attributes.symmetry, 0.85);
  assert.equal(v1.state.entities.find((entity) => entity.id === "fx-human-head")!.attributes.meshDetail, "medium");

  // 手动接管：右臂旋转到挥手位（observed 纠正进入 v3）。
  const v3 = snapshot.versions[2]!;
  const arm = v3.state.entities.find((entity) => entity.id === "fx-human-arm-right")!;
  assert.equal(arm.transform.rotation[2], -2.2);
  assert.equal(arm.attributes.pose, "rest");

  // Arena 结果经 YOU 权威应用：motion_naturalness 0.47 + 0.15 = 0.62，右手 articulation 精细化。
  const v6 = snapshot.versions[5]!;
  const hand = v6.state.entities.find((entity) => entity.id === "fx-human-hand-right")!;
  assert.equal(hand.attributes.articulation, "fine");
  assert.equal(v6.state.quality.motion_naturalness, 0.62);

  // EditSession 已打开并关闭，学习候选已记录。
  assert.equal(snapshot.editSessions.length, 1);
  assert.notEqual(snapshot.editSessions[0]!.endedAt, null);
  assert.equal(snapshot.editSessions[0]!.mode, "correct");
  assert.equal(snapshot.editSessions[0]!.evidenceMode, "observed");
  assert.ok(snapshot.learningCandidate);
  assert.equal(snapshot.learningCandidate!.scope, "USER");

  // 证据请求完成，反馈被解决。
  assert.equal(snapshot.evidenceRequests[0]!.status, "fulfilled");
  assert.equal(snapshot.feedback[0]!.status, "addressed");
});

test("learning gate: without permission the repeated intent applies no learned correction", async () => {
  const controller = createSimulatedSolutionSurfaceController();
  // 走到 takeover-accepted（未授权），然后直接重复意图。
  for (const stepId of [
    "intent",
    "feedback",
    "evidence-request",
    "evidence-provided",
    "improvement-proposed",
    "improvement-accepted",
    "takeover-open",
    "takeover-correction",
    "takeover-accepted",
  ]) {
    await runSolutionDemoStep(
      controller,
      SOLUTION_DEMO_STEPS.find((step) => step.id === stepId)!,
    );
  }
  const before = await controller.refresh();
  assert.equal(before.learningPermission.learningPermission, false);

  const repeat = await controller.repeatIntent(STORYBOARD_INTENT.id);
  assert.equal(repeat.learningApplied, false);
  assert.match(repeat.summary, /permission has not been granted/);
  const repeatChangeSet = repeat.changeSet;
  assert.equal(repeatChangeSet.proposedOperations.length, 0);
});

test("learning gate: repeated intent after explicit consent applies the user correction", async () => {
  const controller = createSimulatedSolutionSurfaceController();
  for (const stepId of [
    "intent",
    "feedback",
    "evidence-request",
    "evidence-provided",
    "improvement-proposed",
    "improvement-accepted",
    "takeover-open",
    "takeover-correction",
    "takeover-accepted",
    "learning-consent",
  ]) {
    await runSolutionDemoStep(
      controller,
      SOLUTION_DEMO_STEPS.find((step) => step.id === stepId)!,
    );
  }
  const consent = await controller.refresh();
  assert.equal(consent.learningPermission.state, "granted");

  const repeat = await controller.repeatIntent(STORYBOARD_INTENT.id);
  assert.equal(repeat.learningApplied, true);
  assert.equal(repeat.learningScope, "USER");
  // 提议里携带了学习到的挥手位纠正。
  const upsert = repeat.changeSet.proposedOperations.find(
    (operation) => operation.op === "upsert_entity",
  );
  assert.ok(upsert && upsert.op === "upsert_entity");
  assert.equal(upsert.entity.transform.rotation[2], -2.2);
});

test("event ledger is append-only and covers the scripted loop", async () => {
  const controller = createSimulatedSolutionSurfaceController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();
  const types = snapshot.events.map((event) => event.type);

  for (const expected of [
    "solution-created",
    "version-published",
    "feedback-submitted",
    "evidence-requested",
    "evidence-provided",
    "change-proposed",
    "change-accepted",
    "edit-session-opened",
    "edit-session-closed",
    "arena-escalation-requested",
    "arena-result-applied",
    "capability-gap-detected",
  ]) {
    assert.ok(types.includes(expected as (typeof types)[number]), `missing event ${expected}`);
  }
  // 事件 id 唯一且单调（append-only 证据）。
  const ids = snapshot.events.map((event) => event.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("determinism: two fresh controllers replay the loop byte-identically", async () => {
  const first = createSimulatedSolutionSurfaceController();
  const second = createSimulatedSolutionSurfaceController();
  await runFullDemo(first);
  await runFullDemo(second);
  const a = await first.refresh();
  const b = await second.refresh();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("typed errors: invalid state transitions reject with truthful YouError", async () => {
  const controller = createSimulatedSolutionSurfaceController();
  await assert.rejects(
    () => controller.refresh(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      const youError = (error as { youError?: { code: string; simulated: boolean } }).youError;
      assert.equal(youError?.code, "YOU_INVALID_STATE");
      assert.equal(youError?.simulated, true);
      return true;
    },
  );

  const snapshot = await controller.load({ workspaceKey: "ws" });
  const feedback = snapshot.feedback[0];
  assert.equal(feedback, undefined);
  await assert.rejects(
    () => controller.proposeDeterministicImprovement("missing"),
    (error: unknown) => {
      const youError = (error as { youError?: { code: string } }).youError;
      assert.equal(youError?.code, "YOU_VERSION_NOT_FOUND");
      return true;
    },
  );

  // 重复打开 EditSession 被拒绝（单会话约束）。
  await controller.openEditSession({ mode: "correct" });
  await assert.rejects(
    () => controller.openEditSession({ mode: "edit" }),
    (error: unknown) => {
      const youError = (error as { youError?: { code: string } }).youError;
      assert.equal(youError?.code, "YOU_INVALID_STATE");
      return true;
    },
  );
});
