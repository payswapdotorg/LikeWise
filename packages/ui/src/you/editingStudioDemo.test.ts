// W5B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：demo 覆盖 W5B 验收全闭环（subject 挑选/会话开启/op 组合/候选预览/提议/应用/
// 接受/嵌套谱系/拒绝回退/非法变更集/未注册编辑器/未知会话/external 会话/同意门/
// 投射启动/导出/round-trip/损坏导入/接管门/接管确认/终态锁定/放弃）、重放字节一致
//（golden 确定性）、demo 终态的结构断言（会话/候选/交换/接管账本/事件词汇）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedEditingStudioController } from "./editingSimulatedController.js";
import {
  EDITING_DEMO_STEPS,
  EDITING_DEMO_TOTAL_STEPS,
  runEditingDemoStep,
} from "./editingStudioDemo.js";
import type { EditingStudioController } from "./editingController.js";
import type { SolutionEventType } from "@zcode/shared";

async function runFullDemo(controller: EditingStudioController) {
  const outcomes = [];
  for (const demoStep of EDITING_DEMO_STEPS) {
    outcomes.push(await runEditingDemoStep(controller, demoStep));
  }
  return outcomes;
}

test("the demo covers the full W5B loop and records every step", async () => {
  const controller = createSimulatedEditingStudioController();
  const outcomes = await runFullDemo(controller);
  assert.equal(outcomes.length, EDITING_DEMO_TOTAL_STEPS);
  // 步骤 id 顺序与声明一致（golden 序列）。
  assert.deepEqual(
    outcomes.map((outcome) => outcome.stepId),
    [
      "subject-pick",
      "session-open",
      "ops-compose",
      "changeset-preview",
      "changeset-propose",
      "changeset-apply",
      "candidate-accept",
      "changeset-2",
      "candidate-reject",
      "changeset-invalid",
      "editor-unsupported",
      "session-not-found",
      "external-session",
      "launch-gate",
      "consent-grant",
      "external-launch",
      "export",
      "import-roundtrip",
      "import-invalid",
      "takeover-gate",
      "takeover-confirm",
      "session-commit",
      "session-terminal-locked",
      "session-abandon",
    ],
  );
  // 每步都有非空 summary 与 uiHint 对象（展示与视图提示齐备）。
  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 0);
    assert.ok(typeof outcome.uiHint === "object");
  }
  // 七条诚实 typed 错误路径以 code 前缀呈现（truth law——不伪装成功）。
  const typedErrorSteps = outcomes
    .filter((outcome) => outcome.summary.includes("YOU_"))
    .map((outcome) => outcome.stepId);
  assert.deepEqual(typedErrorSteps, [
    "changeset-invalid",
    "editor-unsupported",
    "session-not-found",
    "launch-gate",
    "import-invalid",
    "takeover-gate",
    "session-terminal-locked",
  ]);
});

test("demo replay is byte-identical across fresh controllers (golden determinism)", async () => {
  const first = await runFullDemo(createSimulatedEditingStudioController());
  const second = await runFullDemo(createSimulatedEditingStudioController());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("scripted flow: session -> change set -> candidate -> accept/reject -> errors -> interchange -> takeover -> terminals", async () => {
  const controller = createSimulatedEditingStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();

  // 终态收束：一个 committed（native 会话）+ 一个 abandoned（external 会话）。
  assert.deepEqual(
    snapshot.sessions.map((session) => [session.editorKind, session.status]),
    [
      ["native", "committed"],
      ["external", "abandoned"],
    ],
  );

  // 变更集账本：两条（A 与 B），op 顺序保持提议序。
  assert.equal(snapshot.changeSets.length, 2);
  assert.deepEqual(
    snapshot.changeSets[0]!.ops.map((op) => op.kind),
    ["transform", "material", "annotation"],
  );
  assert.deepEqual(
    snapshot.changeSets[1]!.ops.map((op) => op.kind),
    ["geometry"],
  );

  // 候选谱系：候选 1（accepted）← subject 根；候选 2（rejected）← 候选 1（嵌套）。
  assert.equal(snapshot.candidates.length, 2);
  assert.equal(snapshot.candidates[0]!.parentVersionId, snapshot.subjects[0]!.id);
  assert.equal(snapshot.candidates[1]!.parentVersionId, snapshot.candidates[0]!.id);
  assert.deepEqual(
    snapshot.candidateResolutions.map((view) => view.outcome),
    ["accepted", "rejected"],
  );

  // 交换账本：导出 ×3（launch 携带 1 + export 步 1 + round-trip 重放 1）+ 成功导入 1 +
  // 失败导入 1（损坏字节诚实入账）。
  const succeededExports = snapshot.interchangeFacts.filter(
    (fact) => fact.direction === "export" && fact.status === "succeeded",
  );
  const succeededImports = snapshot.interchangeFacts.filter(
    (fact) => fact.direction === "import" && fact.status === "succeeded",
  );
  const failedImports = snapshot.interchangeFacts.filter(
    (fact) => fact.direction === "import" && fact.status === "failed",
  );
  assert.equal(succeededExports.length, 3);
  assert.equal(succeededImports.length, 1);
  assert.equal(failedImports.length, 1);
  // round-trip 恒等：成功导入的摘要 = 最近一次成功导出的摘要（可校验的恒等）。
  assert.equal(
    succeededImports[0]!.packageDigest,
    succeededExports.at(-1)!.packageDigest,
  );

  // 投射意图与接管确认各恰一条（append-only）。
  assert.equal(snapshot.externalLaunches.length, 1);
  assert.equal(snapshot.takeovers.length, 1);
  assert.equal(snapshot.externalLaunches[0]!.editorKind, "external");
  assert.equal(snapshot.takeovers[0]!.sessionId, snapshot.sessions[0]!.id);

  // 同意终态：撤回未发生（demo 以 grant 收束，无 withdraw 步）。
  assert.equal(snapshot.consent.purposeStates.length, 2);

  // 事件词汇覆盖 frozen editing 全集。
  const types = new Set(snapshot.events.map((event) => event.type));
  const expectedTypes: readonly string[] = [
    "edit-session-opened",
    "edit-session-closed",
    "change-proposed",
    "change-accepted",
    "change-rejected",
    "change-set-applied",
    "candidate-version-proposed",
    "import-export-completed",
    "consent-recorded",
  ];
  for (const expected of expectedTypes) {
    assert.ok(types.has(expected as SolutionEventType), `missing event type ${expected}`);
  }
});

test("the demo leaves the editing plane in the expected end state (structural invariants)", async () => {
  const controller = createSimulatedEditingStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();
  // Truth law：全程 simulated。
  assert.equal(snapshot.simulated, true);
  for (const candidate of snapshot.candidates) {
    assert.equal(candidate.simulated, true);
    assert.ok(candidate.contentRef.startsWith("fx-content-"));
    assert.ok(candidate.contentHash.startsWith("sha256-fixture-"));
  }
  for (const changeSet of snapshot.changeSets) {
    // op payload 一律内容寻址（payloadRef + payloadHash；绝不内联）。
    for (const op of changeSet.ops) {
      assert.ok(op.payloadRef.startsWith("fx-content-"));
      assert.ok(op.payloadHash.startsWith("sha256-fixture-"));
      assert.ok(op.kind.length > 0);
    }
  }
  for (const result of snapshot.importExports) {
    if (result.status === "succeeded") {
      assert.ok(result.contentRef!.startsWith("fx-content-"));
      assert.ok(result.contentHash!.startsWith("sha256-fixture-"));
    } else {
      assert.equal(result.contentRef, null);
      assert.equal(result.contentHash, null);
    }
  }
});
