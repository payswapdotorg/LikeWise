// W8B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：demo 覆盖 W8B 验收全闭环（加载 → gap 记录（七类全覆盖 + 不可升级）→
// ToolGap/Knowledge 投影 + 非法投影拒绝 → policy 校验拒绝 → 升级请求 → 无授权
// 拒绝 → 非法授权拒绝 → 授权 aggregate → run 启动/失败/重试 → 未知 provider 拒绝 →
// typed payload 交付 → 应用 → 第二升级（过期授权拒绝 → 续期新记录 → artifact 交付 →
// 拒绝终态）→ 第三升级（none 许可 → 撤回 → 撤回后拒绝 → 取消 + aborted）→ 未知
// id 双拒绝 → 终态拒绝）、重放字节一致（golden 确定性）、demo 终态的结构断言
//（gap/升级/run/授权账本/事件词汇/投影）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedEscalationStudioController } from "./escalationSimulatedController.js";
import {
  ESCALATION_DEMO_STEPS,
  ESCALATION_DEMO_TOTAL_STEPS,
  runEscalationDemoStep,
} from "./escalationStudioDemo.js";
import type { EscalationStudioController } from "./escalationController.js";

async function runFullDemo(controller: EscalationStudioController) {
  const outcomes = [];
  for (const demoStep of ESCALATION_DEMO_STEPS) {
    outcomes.push(await runEscalationDemoStep(controller, demoStep));
  }
  return outcomes;
}

test("the demo covers the full W8B loop and records every step", async () => {
  const controller = createSimulatedEscalationStudioController();
  const outcomes = await runFullDemo(controller);
  assert.equal(outcomes.length, ESCALATION_DEMO_TOTAL_STEPS);
  assert.equal(ESCALATION_DEMO_TOTAL_STEPS, 32);
  // 步骤 id 顺序与声明一致（golden 序列）。
  assert.deepEqual(
    outcomes.map((outcome) => outcome.stepId),
    [
      "load",
      "gap-open",
      "gap-sweep",
      "gap-ineligible",
      "projection-tool",
      "projection-knowledge",
      "projection-invalid",
      "policy-invalid",
      "escalation-request",
      "unauthorized-run",
      "grant-invalid",
      "grant-aggregate",
      "run-start",
      "run-fail",
      "run-retry",
      "provider-unknown",
      "deliver-typed-payload",
      "apply-result",
      "escalation-request-expert",
      "grant-expired",
      "expired-run",
      "regrant-full",
      "deliver-artifact",
      "reject-result",
      "escalation-request-knowledge",
      "grant-none",
      "run-start-knowledge",
      "permission-withdraw",
      "post-withdrawal-refusal",
      "cancel-escalation",
      "not-found-refusals",
      "terminal-refusal",
    ],
  );
  // 每步都有非空 summary 与 uiHint 对象（展示与视图提示齐备）。
  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 0);
    assert.ok(typeof outcome.uiHint === "object");
  }
  // 十步诚实 typed 错误路径（十一个 typed 拒绝——not-found 步含双 code）以 code
  // 前缀呈现（truth law——不伪装成功）。
  const typedErrorSteps = outcomes
    .filter((outcome) => outcome.summary.includes("YOU_"))
    .map((outcome) => outcome.stepId);
  assert.deepEqual(typedErrorSteps, [
    "gap-ineligible",
    "projection-invalid",
    "policy-invalid",
    "unauthorized-run",
    "grant-invalid",
    "provider-unknown",
    "expired-run",
    "post-withdrawal-refusal",
    "not-found-refusals",
    "terminal-refusal",
  ]);
  // 七个 v8 验收 code 全部被演练（含各自的语义路径）。
  const summaryText = outcomes.map((outcome) => outcome.summary).join("\n");
  for (const code of [
    "YOU_ESCALATION_NOT_FOUND",
    "YOU_ESCALATION_STATE_INVALID",
    "YOU_ESCALATION_AUTHORIZATION_REQUIRED",
    "YOU_ARENA_RUN_NOT_FOUND",
    "YOU_RETRY_POLICY_INVALID",
    "YOU_ARENA_ADAPTER_UNSUPPORTED",
    "YOU_GAP_PROJECTION_INVALID",
  ]) {
    assert.ok(summaryText.includes(code), `demo must exercise ${code}`);
  }
});

test("demo replay is byte-identical across fresh controllers (golden determinism)", async () => {
  const leftController = createSimulatedEscalationStudioController();
  const rightController = createSimulatedEscalationStudioController();
  const left = await runFullDemo(leftController);
  const right = await runFullDemo(rightController);
  assert.deepEqual(left, right);
  // 快照同样字节一致（事件账本 + 全部投影）。
  const leftSnapshot = await leftController.refresh();
  const rightSnapshot = await rightController.refresh();
  assert.equal(JSON.stringify(leftSnapshot), JSON.stringify(rightSnapshot));
});

test("the demo leaves the escalation plane in the expected end state", async () => {
  const controller = createSimulatedEscalationStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();

  // 8 个 gap 记录（七类 + 不可升级规格）。
  assert.equal(snapshot.gaps.length, 8);
  assert.equal(
    new Set(snapshot.gaps.map((gap) => gap.category)).size,
    7,
    "all seven frozen categories are covered",
  );

  // 3 个升级：applied（TOOL 路径）/ rejected（EXPERT 路径）/ cancelled（KNOWLEDGE 路径）。
  assert.equal(snapshot.escalations.length, 3);
  const statuses = snapshot.escalations.map((escalation) => escalation.status);
  assert.deepEqual(
    [...statuses].sort(),
    ["applied", "cancelled", "rejected"],
  );
  // applied 升级的专家结果带 appliesAsChangeSetId；rejected 带拒绝理由。
  const applied = snapshot.escalations.find((escalation) => escalation.status === "applied");
  assert.ok(applied?.expertResult?.appliesAsChangeSetId);
  const rejected = snapshot.escalations.find((escalation) => escalation.status === "rejected");
  assert.equal(rejected?.rejectionReason, "expert correction artifact declined after review");

  // run 阶梯：TOOL 升级 2 次尝试（failed + completed），EXPERT 1 次（completed），
  // KNOWLEDGE 1 次（aborted）——共 4 条。
  assert.equal(snapshot.runs.length, 4);
  const runStatuses = snapshot.runs.map((run) => run.status).sort();
  assert.deepEqual(runStatuses, ["aborted", "completed", "completed", "failed"]);

  // 授权账本：5 条记录（esc-A aggregate grant；esc-B expired grant + full regrant；
  // esc-C none grant + withdrawal）——全部不可变、append-only。
  assert.equal(snapshot.authorizationLedger.length, 5);
  const withdrawalEntries = snapshot.authorizationLedger.filter(
    (entry) => entry.kind === "withdrawal",
  );
  assert.equal(withdrawalEntries.length, 1);
  assert.equal(withdrawalEntries[0]?.record.learningPermission, "none");

  // live 授权：esc-C 撤回后有效许可为 none；esc-B live 为 full。
  const liveC = snapshot.liveAuthorizations.find(
    (entry) => entry.escalationId === snapshot.escalations.find((e) => e.status === "cancelled")?.escalationId,
  );
  assert.equal(liveC?.withdrawn, true);
  assert.equal(liveC?.learningPermission, "none");
  const liveB = snapshot.liveAuthorizations.find(
    (entry) => entry.escalationId === snapshot.escalations.find((e) => e.status === "rejected")?.escalationId,
  );
  assert.equal(liveB?.learningPermission, "full");
  assert.equal(liveB?.withdrawn, false);

  // 投影：1 tool + 1 knowledge。
  assert.equal(snapshot.toolProjections.length, 1);
  assert.equal(snapshot.knowledgeProjections.length, 1);

  // 事件词汇（frozen wave-8 + v1 arena-*）：全部出现。
  const types = new Set(snapshot.events.map((event) => event.type));
  for (const expected of [
    "solution-created",
    "capability-gap-detected",
    "arena-escalation-requested",
    "escalation-authorized",
    "learning-permission-recorded",
    "arena-run-recorded",
    "arena-result-applied",
    "escalation-cancelled",
    "gap-projection-published",
  ] as const) {
    assert.ok(types.has(expected), `missing event ${expected}`);
  }
  // learning-permission-recorded：5 次（3 grant + 1 续期 + 1 撤回）。
  assert.equal(
    snapshot.events.filter((event) => event.type === "learning-permission-recorded").length,
    5,
  );
  // 撤回事件带 withdrawal 标记。
  assert.ok(
    snapshot.events.some(
      (event) =>
        event.type === "learning-permission-recorded" && event.payload.withdrawal === true,
    ),
  );
  // 每条事件 truth law：simulated: true。
  assert.ok(snapshot.events.every((event) => event.payload.simulated === true));
  assert.equal(snapshot.simulated, true);
});
