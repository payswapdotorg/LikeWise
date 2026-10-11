// W4B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：demo 覆盖 W4B 验收全闭环（模板挑选/实例化发布/时间线检视与编辑/非法时间线
// 拒绝/evidence-bound 同意门/作业生命周期/双产物作业/accept-reject-supersede 评审/
// 诚实失败路径/不支持组合拒绝/同意撤回阻断）、重放字节一致（golden 确定性）、
// demo 终态的结构断言（性能链/作业/评审账本/事件词汇）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedPerformanceStudioController } from "./performanceSimulatedController.js";
import {
  PERFORMANCE_DEMO_STEPS,
  PERFORMANCE_DEMO_TOTAL_STEPS,
  runPerformanceDemoStep,
} from "./performanceStudioDemo.js";
import {
  effectiveReviewForArtifact,
  orderedRenderArtifacts,
  type PerformanceStudioController,
} from "./performanceController.js";

async function runFullDemo(controller: PerformanceStudioController) {
  const outcomes = [];
  for (const step of PERFORMANCE_DEMO_STEPS) {
    outcomes.push(await runPerformanceDemoStep(controller, step));
  }
  return outcomes;
}

test("the demo covers the full W4B loop and records every step", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const outcomes = await runFullDemo(controller);
  assert.equal(outcomes.length, PERFORMANCE_DEMO_TOTAL_STEPS);
  // 步骤 id 顺序与声明一致（golden 序列）。
  assert.deepEqual(
    outcomes.map((outcome) => outcome.stepId),
    [
      "template-pick",
      "performance-publish",
      "timeline-inspect",
      "timeline-edit",
      "timeline-invalid",
      "render-consent-gate",
      "consent-grant",
      "render-submit",
      "render-run",
      "render-complete",
      "render-submit-2",
      "render-complete-2",
      "artifact-accept",
      "artifact-reject",
      "artifact-supersede",
      "render-fail",
      "render-unsupported",
      "consent-withdraw",
    ],
  );
  // 每步都有非空 summary 与 uiHint 对象（展示与视图提示齐备）。
  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 0);
    assert.ok(typeof outcome.uiHint === "object");
  }
  // 三条诚实 typed 错误路径以 code 前缀呈现（truth law——不伪装成功）。
  const typedErrorSummaries = outcomes
    .filter((outcome) => outcome.summary.includes("YOU_"))
    .map((outcome) => outcome.stepId);
  assert.deepEqual(typedErrorSummaries, [
    "timeline-invalid",
    "render-consent-gate",
    "render-unsupported",
    "consent-withdraw",
  ]);
  assert.ok(
    outcomes.find((outcome) => outcome.stepId === "timeline-invalid")!.summary.includes(
      "YOU_TIMELINE_INVALID",
    ),
  );
  assert.ok(
    outcomes.find((outcome) => outcome.stepId === "render-unsupported")!.summary.includes(
      "YOU_RENDER_UNSUPPORTED",
    ),
  );
});

test("scripted flow: template -> publish -> edit -> invalid -> consent -> jobs -> reviews -> withdraw", async () => {
  const controller = createSimulatedPerformanceStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();

  // 性能链：模板实例化 + 手编编辑 + 第二模板实例化 = 3 条不可变记录。
  assert.equal(snapshot.performances.length, 3);
  assert.equal(snapshot.performances[0]!.basedOnTemplateId, "fx-template-001");
  assert.equal(snapshot.performances[1]!.basedOnTemplateId, null);
  assert.equal(snapshot.performances[2]!.basedOnTemplateId, "fx-template-002");
  // 手编性能时长：cue 拉伸 +400ms 与 layer 追加 1000ms ⇒ 7000ms。
  assert.equal(snapshot.performances[1]!.timeline.durationMs, 7000);
  assert.equal(snapshot.performances[1]!.timeline.cues.length, 5);

  // 作业：完成 x2 + 失败 x1 + 撤回后拒绝（不落账）= 3 条。
  assert.equal(snapshot.jobs.length, 3);
  assert.deepEqual(
    snapshot.jobs.map((job) => job.status),
    ["completed", "completed", "failed"],
  );
  // 作业 1（image-render）1 件产物；作业 2（3d-render）2 件；失败作业 0 件。
  assert.equal(snapshot.jobs[0]!.result!.artifacts.length, 1);
  assert.equal(snapshot.jobs[1]!.result!.artifacts.length, 2);
  assert.equal(snapshot.jobs[2]!.result!.artifacts.length, 0);
  assert.equal(snapshot.jobs[2]!.result!.effortObservations["failureReason"], "fixture: operator invoked the honest failure path");
  // 全部产物 simulated: true（truth law）。
  assert.ok(orderedRenderArtifacts(snapshot).every((artifact) => artifact.simulated));

  // 评审账本：accept + reject + supersede = 3 条 append-only 记录。
  assert.equal(snapshot.reviews.length, 3);
  const artifacts = orderedRenderArtifacts(snapshot);
  // 作业 1 静帧（accepted 后被 superseded）：有效评审 superseded。
  const still = artifacts.find((artifact) => artifact.jobId === snapshot.jobs[0]!.spec.id)!;
  assert.equal(effectiveReviewForArtifact(snapshot, still.id)!.status, "superseded");
  // 作业 2 mesh：有效评审 rejected。
  const mesh = artifacts.find((artifact) => artifact.kind === "mesh")!;
  assert.equal(effectiveReviewForArtifact(snapshot, mesh.id)!.status, "rejected");

  // 同意撤回：门阻断（withdrawn）。
  assert.equal(snapshot.consent.reference.state, "withdrawn");

  // 事件词汇（frozen additive wave-4 + consent 事件）。
  const types = new Set(snapshot.events.map((event) => event.type));
  assert.equal(types.has("performance-published"), true);
  assert.equal(types.has("render-job-submitted"), true);
  assert.equal(types.has("render-job-completed"), true);
  assert.equal(types.has("render-artifact-reviewed"), true);
  assert.equal(types.has("consent-recorded"), true);
  assert.equal(types.has("consent-withdrawn"), true);
});

test("demo replay is byte-identical across fresh controllers (golden determinism)", async () => {
  const run = async () => {
    const controller = createSimulatedPerformanceStudioController();
    const outcomes = await runFullDemo(controller);
    const snapshot = await controller.refresh();
    return { outcomes, snapshot };
  };
  const [a, b] = await Promise.all([run(), run()]);
  assert.deepEqual(a.outcomes, b.outcomes);
  assert.deepEqual(a.snapshot, b.snapshot);
});

test("the demo leaves the performance plane in the expected end state", async () => {
  const controller = createSimulatedPerformanceStudioController();
  await runFullDemo(controller);
  const snapshot = await controller.refresh();
  // 终态快照的确定性金断言（id 序列 + 计数）。
  assert.equal(snapshot.simulated, true);
  assert.equal(snapshot.performances.length, 3);
  assert.equal(snapshot.jobs.length, 3);
  assert.equal(snapshot.reviews.length, 3);
  assert.equal(orderedRenderArtifacts(snapshot).length, 3);
  // 模板库与注册面投影不受 demo 影响（只读镜像）。
  assert.equal(snapshot.templates.length, 2);
  assert.equal(snapshot.renderMethods.length, 5);
});
