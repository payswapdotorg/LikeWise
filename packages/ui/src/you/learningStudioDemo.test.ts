// W6B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：demo 覆盖 W6B 验收全闭环（scope/kind 挑选/信号捕获（六种 kind）/
// 内容合成/rights 门/同意授予/签发/候选/验证/使用/偏好派生/惰性/拒绝/顶替/
// 授予外/操作员偏好/清除/派生清除拒绝/范围错误/trajectory 记录/重放/未知记录/
// 撤回/撤回后拒绝）、重放字节一致（golden 确定性）、demo 终态的结构断言
//（信号/记录/偏好/trajectory/事件词汇/同意终态）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedLearningStudioController } from "./learningSimulatedController.js";
import {
  LEARNING_DEMO_STEPS,
  LEARNING_DEMO_TOTAL_STEPS,
  runLearningDemoStep,
} from "./learningStudioDemo.js";
import type { LearningStudioController } from "./learningController.js";
import type { SolutionEventType } from "@zcode/shared";

async function runFullDemo(controller: LearningStudioController) {
  const outcomes = [];
  for (const demoStep of LEARNING_DEMO_STEPS) {
    outcomes.push(await runLearningDemoStep(controller, demoStep));
  }
  return outcomes;
}

test("the demo covers the full W6B loop and records every step", async () => {
  const controller = createSimulatedLearningStudioController();
  const outcomes = await runFullDemo(controller);
  assert.equal(outcomes.length, LEARNING_DEMO_TOTAL_STEPS);
  // 步骤 id 顺序与声明一致（golden 序列）。
  assert.deepEqual(
    outcomes.map((outcome) => outcome.stepId),
    [
      "scope-pick",
      "kind-pick",
      "signal-invalid",
      "signal-feedback",
      "signal-sweep",
      "content-synthesize",
      "rights-gate",
      "consent-grant",
      "rights-issue",
      "record-candidates",
      "record-validate",
      "record-use",
      "preference-derive",
      "inert-validate",
      "inert-refusal",
      "record-reject",
      "rejected-unusable",
      "record-supersede",
      "superseded-unusable",
      "usage-outside-grant",
      "operator-preference",
      "preference-clear",
      "derived-clear-refused",
      "preference-scope-invalid",
      "trajectory-record",
      "trajectory-replay",
      "record-not-found",
      "consent-withdraw",
      "post-withdrawal-refusal",
    ],
  );
  // 每步都有非空 summary 与 uiHint 对象（展示与视图提示齐备）。
  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 0);
    assert.ok(typeof outcome.uiHint === "object");
  }
  // 十条诚实 typed 错误路径以 code 前缀呈现（truth law——不伪装成功）。
  const typedErrorSteps = outcomes
    .filter((outcome) => outcome.summary.includes("YOU_"))
    .map((outcome) => outcome.stepId);
  assert.deepEqual(typedErrorSteps, [
    "signal-invalid",
    "rights-gate",
    "inert-refusal",
    "rejected-unusable",
    "superseded-unusable",
    "usage-outside-grant",
    "derived-clear-refused",
    "preference-scope-invalid",
    "record-not-found",
    "post-withdrawal-refusal",
  ]);
});

test("demo replay is byte-identical across fresh controllers (golden determinism)", async () => {
  const first = await runFullDemo(createSimulatedLearningStudioController());
  const second = await runFullDemo(createSimulatedLearningStudioController());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("scripted flow: six kinds captured, ladder covered, rights law visible, preferences projected, replay deterministic", async () => {
  const controller = createSimulatedLearningStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();

  // 六种 frozen kind 全覆盖（每种一条信号）。
  assert.deepEqual(
    snapshot.signals.map((signal) => signal.kind),
    [
      "feedback",
      "manual-takeover",
      "edit-session",
      "expert-intervention",
      "repeated-intent",
      "capability-gap",
    ],
  );
  // 信号 evidence 内容寻址标签（绝不内联）。
  for (const signal of snapshot.signals) {
    assert.equal(signal.simulated, true);
    assert.ok(signal.evidenceRefs.length >= 1);
    for (const ref of signal.evidenceRefs) {
      assert.ok(ref.startsWith("fx-content-"));
    }
  }

  // 记录终态收束：feedback validated / edit validated（惰性）/ expert rejected /
  // intent superseded / gap validated（supersessor）。
  const byStatus = (status: string) =>
    snapshot.records.filter((record) => record.status === status);
  assert.equal(snapshot.records.length, 5);
  assert.equal(byStatus("validated").length, 3);
  assert.equal(byStatus("rejected").length, 1);
  assert.equal(byStatus("superseded").length, 1);
  // supersession 链接：superseded 记录的 supersededById 指向后继者。
  const superseded = byStatus("superseded")[0]!;
  assert.ok(superseded.supersededById);
  const successor = snapshot.records.find(
    (record) => record.id === superseded.supersededById,
  );
  assert.ok(successor);
  assert.equal(successor.status, "validated");
  // 后继者来自 capability-gap 信号（gap 验证时顶替 repeated-intent 记录）。
  const gapSignal = snapshot.signals.find((signal) => signal.kind === "capability-gap");
  assert.ok(gapSignal);
  assert.equal(successor.signalId, gapSignal.id);
  // 惰性记录：rights 空（rights-inert 的可见面）。
  const inertRecord = snapshot.records.find(
    (record) =>
      record.rights.consentRef === "" && record.rights.usage.length === 0,
  );
  assert.ok(inertRecord);
  assert.equal(inertRecord.status, "validated");

  // 记录内容寻址（contentRef + contentHash；绝不内联）。
  for (const record of snapshot.records) {
    assert.ok(record.contentRef.startsWith("fx-content-"));
    assert.ok(record.contentHash.startsWith("sha256-fixture-"));
    assert.equal(record.simulated, true);
  }

  // 偏好终态：清除后只剩派生偏好（USER::preferred-editor——derived lineage）。
  assert.deepEqual(
    snapshot.preferences.map(
      (preference) => `${preference.scope}::${preference.key}=${preference.value}`,
    ),
    ["USER::preferred-editor=fixture-external-editor"],
  );
  assert.equal(snapshot.preferences[0]!.derivedFromRecordId, byStatus("validated")[0]!.id);

  // trajectory 注册面：恰一条，步骤内容寻址。
  assert.equal(snapshot.trajectories.length, 1);
  const trajectory = snapshot.trajectories[0]!;
  assert.equal(trajectory.stepRefs.length, 4);
  for (const ref of trajectory.stepRefs) {
    assert.ok(ref.startsWith("fx-content-"));
  }

  // 事件词汇覆盖 frozen wave-6 learning 四事件 + consent。
  const types = new Set(snapshot.events.map((event) => event.type));
  const expectedTypes: readonly string[] = [
    "solution-created",
    "learning-signal-captured",
    "learning-record-validated",
    "learning-record-rejected",
    "preference-updated",
    "consent-recorded",
    "consent-withdrawn",
  ];
  for (const expected of expectedTypes) {
    assert.ok(types.has(expected as SolutionEventType), `missing event type ${expected}`);
  }

  // 同意终态：learning 用途 withdrawn（demo 以撤回收束）。
  const learningState = snapshot.consent.purposeStates.find(
    (entry) => entry.purpose === "learning",
  );
  assert.equal(learningState?.state, "withdrawn");
});

test("the demo leaves the learning plane in the expected end state (structural invariants)", async () => {
  const controller = createSimulatedLearningStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();
  // Truth law：全程 simulated。
  assert.equal(snapshot.simulated, true);
  // 账本视图分组覆盖全部四个状态桶（透明性：candidate 不在 demo 终态，因全部已收敛）。
  for (const signal of snapshot.signals) {
    assert.equal(signal.simulated, true);
  }
  for (const record of snapshot.records) {
    // rights 绑定记录的 usage 全部来自 sanctioned 分类学。
    for (const usage of record.rights.usage) {
      assert.ok(
        (
          [
            "organization-improvement",
            "tool-selection",
            "editor-selection",
            "pipeline-improvement",
            "capability-gap-analysis",
            "personalization",
          ] as readonly string[]
        ).includes(usage),
      );
    }
    if (record.rights.consentRef !== "") {
      assert.ok(record.rights.consentHash.startsWith("sha256-fixture-"));
    }
  }
  // 惰性记录可见（inert 通知的数据源）。
  assert.ok(
    snapshot.records.some(
      (record) => record.rights.consentRef === "" && record.rights.usage.length === 0,
    ),
  );
});

test("replay determinism: the demo's replay hash is stable and seed-derived", async () => {
  const controller = createSimulatedLearningStudioController();
  const outcomes = await runFullDemo(controller);
  const replayOutcome = outcomes.find((outcome) => outcome.stepId === "trajectory-replay");
  assert.ok(replayOutcome);
  assert.match(replayOutcome.summary, /byte-identical \(true\)/);
  assert.match(replayOutcome.summary, /sha256-fixture-/);

  // 同一控制器的重放与摘要可复现（重放投影确定性）。
  const snapshot = await controller.refresh();
  const trajectory = snapshot.trajectories[0]!;
  const first = await controller.replayTrajectory({ trajectoryId: trajectory.id });
  const second = await controller.replayTrajectory({ trajectoryId: trajectory.id });
  assert.equal(first.replayHash, second.replayHash);
  assert.equal(first.bytes.length, second.bytes.length);
  assert.ok(first.bytes.every((byte, index) => byte === second.bytes[index]));
  assert.equal(first.stepCount, 4);
  assert.ok(first.bytes.length > 0);
});
