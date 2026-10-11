// W4B logic tests — Performance 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖：确定性（两个 fresh 实例逐步重放 → 字节一致的快照）、不可变性能链
//（append-only、模板实例化 timeline 逐字拷贝）、时间线校验（YOU_TIMELINE_INVALID
// 的全部违例类别：无状态、绝不静默修复）、渲染注册面（YOU_RENDER_UNSUPPORTED，
// 绝不静默回退）、作业生命周期（queued → running → completed | failed；终态锁定）、
// 内容寻址 artifacts + 诚实 not-measured effort 观察、append-only 评审状态机
//（accept/reject/supersede；有效评审 = 最新非 superseded；typed
// YOU_RENDER_ARTIFACT_NOT_FOUND）、evidence-bound render 的 binding-time 同意强制
//（无许可 ⇒ YOU_CONSENT_REQUIRED；withdrawal 阻断后续提交）、事件词汇
//（frozen additive wave-4）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedPerformanceStudioController } from "./performanceSimulatedController.js";
import {
  PerformanceStudioError,
  artifactsForJob,
  effectiveReviewForArtifact,
  orderedRenderArtifacts,
  projectRenderConsentGate,
} from "./performanceController.js";
import type { PerformanceTimeline } from "@zcode/shared";

const CONSENT_POLICY_ID = "fx-perf-consent-001";

async function grantAllPurposes(
  controller: ReturnType<typeof createSimulatedPerformanceStudioController>,
) {
  const snapshot = await controller.refresh();
  for (const purpose of snapshot.consent.policy.purposes) {
    await controller.decideConsent({
      policyId: CONSENT_POLICY_ID,
      purpose,
      decision: "grant",
    });
  }
}

function invalidTimelineFixture(cuesOverride?: PerformanceTimeline["cues"]): PerformanceTimeline {
  const base = [
    {
      id: "fx-cue-a",
      track: "motion",
      startMs: 0,
      endMs: 1000,
      payloadRef: "fx-content-aa",
      payloadHash: "sha256-fixture-aa",
    },
    {
      id: "fx-cue-b",
      track: "motion",
      startMs: 1000,
      endMs: 2000,
      payloadRef: "fx-content-bb",
      payloadHash: "sha256-fixture-bb",
    },
  ];
  const cues = cuesOverride ?? base;
  return {
    id: "fx-timeline-invalid",
    cues,
    durationMs: cues.reduce((max, cue) => Math.max(max, cue.endMs), 0),
  };
}

test("load is idempotent and bootstraps a deterministic empty performance plane", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  const second = await controller.load({ workspaceKey: "ws-b" });
  // 幂等：重复 load 不重建状态（结构一致；同一个 performance 平面）。
  assert.deepEqual(first, second);
  // Truth law：快照带 simulated 标记（绝不伪装真实 provider）。
  assert.equal(first.simulated, true);
  assert.equal(first.performances.length, 0);
  assert.equal(first.jobs.length, 0);
  assert.equal(first.reviews.length, 0);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0]!.type, "solution-created");
  // 模板库与注册面投影在场（W4A/W4C authority 的只读镜像）。
  assert.equal(first.templates.length, 2);
  assert.equal(first.renderMethods.length, 5);
  assert.equal(first.twinVersionAnchorId, "fx-twver-anchor-001");
  // 事件账本只在首次 load 引导时创建一次（第二次 load 不追加）。
  const third = await controller.load({ workspaceKey: "ws-c" });
  assert.equal(third.events.length, 1);
  // 「未加载即操作」是诚实错误（truthful error）。
  const cold = createSimulatedPerformanceStudioController();
  await assert.rejects(() => cold.refresh(), (error: unknown) => {
    assert.ok(error instanceof PerformanceStudioError);
    assert.equal(error.youError.code, "YOU_INVALID_STATE");
    return true;
  });
});

test("template instantiation publishes an immutable performance with a verbatim timeline", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const snapshot = await controller.load({ workspaceKey: "ws" });
  const template = snapshot.templates[0]!;

  // 确定性预览：纯投影（无副作用）——同参数恒同 digest。
  const previewA = await controller.previewTemplateInstantiation({
    templateId: template.id,
    parameters: { intensity: 0.9 },
  });
  const previewB = await controller.previewTemplateInstantiation({
    templateId: template.id,
    parameters: { intensity: 0.9 },
  });
  assert.equal(previewA.previewDigest, previewB.previewDigest);
  assert.equal(previewA.evidenceBoundCueCount, 1);
  // 参数不同 ⇒ digest 不同（内容派生）。
  const previewC = await controller.previewTemplateInstantiation({
    templateId: template.id,
    parameters: { intensity: 0.5 },
  });
  assert.notEqual(previewA.previewDigest, previewC.previewDigest);
  // 预览不产生记录。
  assert.equal((await controller.refresh()).performances.length, 0);

  // 实例化发布：timeline 逐字拷贝（W4A 语义）。
  const performance = await controller.publishPerformanceFromTemplate({
    templateId: template.id,
    parameters: { intensity: 0.9 },
  });
  assert.equal(performance.basedOnTemplateId, template.id);
  assert.equal(performance.twinVersionId, snapshot.twinVersionAnchorId);
  assert.deepEqual(performance.timeline.cues, template.timeline.cues);
  assert.equal(performance.timeline.durationMs, template.timeline.durationMs);

  // 未知模板是诚实错误。
  await assert.rejects(
    () =>
      controller.publishPerformanceFromTemplate({
        templateId: "fx-template-999",
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_PERFORMANCE_NOT_FOUND");
      return true;
    },
  );
  // 事件词汇（frozen additive wave-4）。
  const after = await controller.refresh();
  assert.equal(
    after.events.some((event) => event.type === "performance-published"),
    true,
  );
});

test("timeline validation refuses every violation class with YOU_TIMELINE_INVALID", async () => {
  const controller = createSimulatedPerformanceStudioController();
  await controller.load({ workspaceKey: "ws" });

  // 合法时间线可以发布（手编路径）。
  const valid = invalidTimelineFixture();
  const performance = await controller.publishPerformance({ timeline: valid });
  assert.equal(performance.basedOnTemplateId, null);
  assert.equal(performance.timeline.cues.length, 2);

  // 同轨重叠。
  const overlapping = invalidTimelineFixture([
    {
      id: "fx-cue-a",
      track: "motion",
      startMs: 0,
      endMs: 1500,
      payloadRef: "fx-content-aa",
      payloadHash: "sha256-fixture-aa",
    },
    {
      id: "fx-cue-b",
      track: "motion",
      startMs: 1000,
      endMs: 2000,
      payloadRef: "fx-content-bb",
      payloadHash: "sha256-fixture-bb",
    },
  ]);
  await assert.rejects(
    () => controller.publishPerformance({ timeline: overlapping }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_TIMELINE_INVALID");
      assert.equal(error.youError.details["reason"], "track-overlap");
      return true;
    },
  );

  // 乱序。
  const outOfOrder = invalidTimelineFixture([
    {
      id: "fx-cue-b",
      track: "motion",
      startMs: 1000,
      endMs: 2000,
      payloadRef: "fx-content-bb",
      payloadHash: "sha256-fixture-bb",
    },
    {
      id: "fx-cue-a",
      track: "motion",
      startMs: 0,
      endMs: 1000,
      payloadRef: "fx-content-aa",
      payloadHash: "sha256-fixture-aa",
    },
  ]);
  await assert.rejects(
    () => controller.publishPerformance({ timeline: outOfOrder }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_TIMELINE_INVALID");
      assert.equal(error.youError.details["reason"], "cues-out-of-order");
      return true;
    },
  );

  // 非正时长。
  const nonPositive = invalidTimelineFixture([
    {
      id: "fx-cue-a",
      track: "motion",
      startMs: 500,
      endMs: 500,
      payloadRef: "fx-content-aa",
      payloadHash: "sha256-fixture-aa",
    },
  ]);
  await assert.rejects(
    () => controller.publishPerformance({ timeline: nonPositive }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_TIMELINE_INVALID");
      assert.equal(error.youError.details["reason"], "non-positive-duration");
      return true;
    },
  );

  // 缺 payload 寻址（内容绝不内联——引用必须显式在场）。
  const missingAddress = invalidTimelineFixture([
    {
      id: "fx-cue-a",
      track: "motion",
      startMs: 0,
      endMs: 1000,
      payloadRef: "",
      payloadHash: "sha256-fixture-aa",
    },
  ]);
  await assert.rejects(
    () => controller.publishPerformance({ timeline: missingAddress }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_TIMELINE_INVALID");
      assert.equal(error.youError.details["reason"], "missing-payload-addressing");
      return true;
    },
  );

  // durationMs 不一致。
  const inconsistent: PerformanceTimeline = {
    id: "fx-timeline-invalid",
    cues: invalidTimelineFixture().cues,
    durationMs: 2500,
  };
  await assert.rejects(
    () => controller.publishPerformance({ timeline: inconsistent }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_TIMELINE_INVALID");
      assert.equal(error.youError.details["reason"], "duration-inconsistent");
      return true;
    },
  );

  // 拒绝不产生记录（追加序不受失败影响——诚实失败不污染状态）。
  const after = await controller.refresh();
  assert.equal(after.performances.length, 1);
});

test("render jobs: registry validation, lifecycle, honest effort, content-addressed artifacts", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const snapshot = await controller.load({ workspaceKey: "ws" });
  const template = snapshot.templates[1]!; // 合成时间线（不触发同意门）
  const performance = await controller.publishPerformanceFromTemplate({
    templateId: template.id,
    parameters: {},
  });

  // 注册面校验：空 outputKinds 拒绝。
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: performance.id,
        method: "image-render",
        outputKinds: [],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_RENDER_UNSUPPORTED");
      assert.equal(error.youError.details["reason"], "empty-output-kinds");
      return true;
    },
  );
  // 不支持的 method/output 组合拒绝（绝不静默改道）。
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: performance.id,
        method: "image-render",
        outputKinds: ["video"],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_RENDER_UNSUPPORTED");
      assert.equal(error.youError.details["reason"], "unsupported-method-output-combination");
      assert.equal(error.youError.details["unsupportedKinds"], "video");
      return true;
    },
  );
  // 未知方法（开放联合的诚实边界）。
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: performance.id,
        method: "hologram-magic" as never,
        outputKinds: ["holo" as never],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_RENDER_UNSUPPORTED");
      return true;
    },
  );
  // 未知性能拒绝。
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: "fx-perf-999",
        method: "image-render",
        outputKinds: ["image"],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_PERFORMANCE_NOT_FOUND");
      return true;
    },
  );

  // 正常生命周期：queued → running → completed（每 outputKind 一件 artifact）。
  const spec = await controller.submitRenderJob({
    performanceId: performance.id,
    method: "3d-render",
    outputKinds: ["mesh", "image"],
    parameters: { resolution: "1080p", samples: 128 },
  });
  assert.equal(spec.method, "3d-render");
  assert.deepEqual(spec.outputKinds, ["image", "mesh"]); // 排序稳定
  assert.equal(spec.performanceId, performance.id);

  let after = await controller.refresh();
  assert.equal(after.jobs[0]!.status, "queued");

  // 越级完成被拒绝（必须先 running——终态前的合法迁移表）。
  await assert.rejects(
    () => controller.completeRenderJob({ jobId: spec.id }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );

  await controller.startRenderJob({ jobId: spec.id });
  after = await controller.refresh();
  assert.equal(after.jobs[0]!.status, "running");

  const result = await controller.completeRenderJob({ jobId: spec.id });
  assert.equal(result.status, "completed");
  assert.equal(result.simulated, true);
  assert.equal(result.artifacts.length, 2);
  // 内容寻址 artifacts（contentRef + contentHash；simulated: true）。
  for (const artifact of result.artifacts) {
    assert.ok(artifact.contentRef.startsWith("fx-content-"));
    assert.ok(artifact.contentHash.startsWith("sha256-fixture-"));
    assert.equal(artifact.simulated, true);
    assert.equal(artifact.jobId, spec.id);
  }
  // 诚实 effort 观察：not-measured 标记原样在场。
  assert.equal(result.effortObservations["computeEffort.measured"], false);
  assert.equal(result.effortObservations["computeEffort"], "not-measured (simulated)");
  assert.equal(result.effortObservations["latencyMs.measured"], false);
  assert.equal(result.effortObservations["artifactsProduced"], 2);

  // 终态锁定：completed 不能再迁移。
  await assert.rejects(
    () => controller.startRenderJob({ jobId: spec.id }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
  await assert.rejects(
    () => controller.failRenderJob({ jobId: spec.id, reason: "nope" }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );

  // 失败路径：诚实 typed 终态 + failureReason；不产出 artifacts。
  const spec2 = await controller.submitRenderJob({
    performanceId: performance.id,
    method: "image-render",
    outputKinds: ["image"],
    parameters: {},
  });
  await controller.startRenderJob({ jobId: spec2.id });
  const failed = await controller.failRenderJob({
    jobId: spec2.id,
    reason: "fixture: operator invoked the honest failure path",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.artifacts.length, 0);
  assert.equal(
    failed.effortObservations["failureReason"],
    "fixture: operator invoked the honest failure path",
  );

  // 未知作业是诚实错误。
  await assert.rejects(
    () => controller.startRenderJob({ jobId: "fx-renderjob-999" }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );

  // 事件词汇：render-job-submitted / render-job-completed。
  after = await controller.refresh();
  const types = after.events.map((event) => event.type);
  assert.equal(types.includes("render-job-submitted"), true);
  assert.equal(types.includes("render-job-completed"), true);
});

test("artifact review state machine: append-only, supersede never overwrites", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const snapshot = await controller.load({ workspaceKey: "ws" });
  const template = snapshot.templates[1]!;
  const performance = await controller.publishPerformanceFromTemplate({
    templateId: template.id,
    parameters: {},
  });
  const spec = await controller.submitRenderJob({
    performanceId: performance.id,
    method: "3d-render",
    outputKinds: ["image", "mesh"],
    parameters: {},
  });
  await controller.startRenderJob({ jobId: spec.id });
  await controller.completeRenderJob({ jobId: spec.id });

  const after = await controller.refresh();
  const artifacts = orderedRenderArtifacts(after);
  assert.equal(artifacts.length, 2);
  assert.deepEqual(
    artifactsForJob(after, spec.id).map((artifact) => artifact.kind).sort(),
    ["image", "mesh"],
  );
  // lineage 查询：未知作业 → 空。
  assert.deepEqual(artifactsForJob(after, "fx-renderjob-999"), []);

  // 未知 artifact ⇒ typed YOU_RENDER_ARTIFACT_NOT_FOUND。
  await assert.rejects(
    () =>
      controller.reviewArtifact({
        artifactId: "fx-rart-999",
        decision: "accept",
        notes: "",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_RENDER_ARTIFACT_NOT_FOUND");
      return true;
    },
  );

  const image = artifacts.find((artifact) => artifact.kind === "image")!;
  const mesh = artifacts.find((artifact) => artifact.kind === "mesh")!;

  // 无评审 → 状态机隐式 pending。
  assert.equal(effectiveReviewForArtifact(after, image.id), null);

  // accept：pending → accepted。
  const accepted = await controller.reviewArtifact({
    artifactId: image.id,
    decision: "accept",
    notes: "good",
  });
  assert.equal(accepted.status, "accepted");
  let current = await controller.refresh();
  assert.equal(effectiveReviewForArtifact(current, image.id)!.status, "accepted");

  // re-review（reject）：先前有效评审被取代——记录替换，账本 append-only。
  const rejected = await controller.reviewArtifact({
    artifactId: image.id,
    decision: "reject",
    notes: "on second thought",
  });
  assert.equal(rejected.status, "rejected");
  current = await controller.refresh();
  assert.equal(effectiveReviewForArtifact(current, image.id)!.status, "rejected");
  assert.equal(current.reviews.length, 2);
  // 先前 accepted 评审记录仍可追溯（superseded 状态）。
  assert.equal(current.reviews[0]!.status, "superseded");
  assert.equal(current.reviews[0]!.id, accepted.id);

  // supersede 动作：当前有效评审转为 superseded。
  const superseded = await controller.reviewArtifact({
    artifactId: image.id,
    decision: "supersede",
    notes: "better artifact elsewhere",
  });
  assert.equal(superseded.status, "superseded");
  current = await controller.refresh();
  assert.equal(effectiveReviewForArtifact(current, image.id)!.status, "superseded");
  assert.equal(current.reviews.length, 3);

  // 另一 artifact 独立评审（互不影响）。
  const meshRejected = await controller.reviewArtifact({
    artifactId: mesh.id,
    decision: "reject",
    notes: "not watertight",
  });
  assert.equal(meshRejected.status, "rejected");
  current = await controller.refresh();
  assert.equal(effectiveReviewForArtifact(current, mesh.id)!.status, "rejected");

  // 事件词汇：render-artifact-reviewed。
  assert.equal(
    current.events.filter((event) => event.type === "render-artifact-reviewed").length,
    4,
  );
});

test("binding-time consent enforcement for evidence-bound renders", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const snapshot = await controller.load({ workspaceKey: "ws" });
  // 模板 1 的时间线含 evidence 派生 cue ⇒ render 该性能需要同意。
  const evidenceBound = await controller.publishPerformanceFromTemplate({
    templateId: snapshot.templates[0]!.id,
    parameters: {},
  });
  // 模板 2 的时间线全合成 ⇒ 不触发同意门。
  const synthetic = await controller.publishPerformanceFromTemplate({
    templateId: snapshot.templates[1]!.id,
    parameters: {},
  });

  // 门可见性：初始 unknown ⇒ 不允许（快照投影可测）。
  let current = await controller.refresh();
  assert.equal(projectRenderConsentGate(current.consent).allowed, false);

  // evidence-bound render 在未同意时被服务端拒绝（UI 禁用只是投影）。
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: evidenceBound.id,
        method: "video-render",
        outputKinds: ["video"],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_CONSENT_REQUIRED");
      assert.ok(error.youError.message.includes("solution-generation"));
      return true;
    },
  );

  // 合成性能不受影响（无许可 ⇒ 不处理，只约束证据派生内容）。
  const syntheticSpec = await controller.submitRenderJob({
    performanceId: synthetic.id,
    method: "image-render",
    outputKinds: ["image"],
    parameters: {},
  });
  assert.ok(syntheticSpec.id);

  // 部分同意（一个用途）仍拒绝。
  await controller.decideConsent({
    policyId: CONSENT_POLICY_ID,
    purpose: "solution-generation",
    decision: "grant",
  });
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: evidenceBound.id,
        method: "video-render",
        outputKinds: ["video"],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );

  // 全部授予后：门允许且 evidence-bound render 成功。
  await grantAllPurposes(controller);
  current = await controller.refresh();
  assert.equal(projectRenderConsentGate(current.consent).allowed, true);
  const evidenceSpec = await controller.submitRenderJob({
    performanceId: evidenceBound.id,
    method: "video-render",
    outputKinds: ["video"],
    parameters: {},
  });
  assert.ok(evidenceSpec.id);

  // 撤回：阻断后续 evidence-bound 提交；已提交作业不受影响（已入队的照常完成）。
  await controller.withdrawConsent({ policyId: CONSENT_POLICY_ID });
  current = await controller.refresh();
  const gate = projectRenderConsentGate(current.consent);
  assert.equal(gate.allowed, false);
  assert.equal(gate.state, "withdrawn");
  await assert.rejects(
    () =>
      controller.submitRenderJob({
        performanceId: evidenceBound.id,
        method: "video-render",
        outputKinds: ["video"],
        parameters: {},
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );
  await controller.startRenderJob({ jobId: evidenceSpec.id });
  const finished = await controller.completeRenderJob({ jobId: evidenceSpec.id });
  assert.equal(finished.status, "completed");

  // 未知政策 / 未知用途是诚实错误。
  await assert.rejects(
    () =>
      controller.decideConsent({
        policyId: "fx-perf-consent-999",
        purpose: "solution-generation",
        decision: "grant",
      }),
    (error: unknown) => {
      assert.ok(error instanceof PerformanceStudioError);
      assert.equal(error.youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
});

test("published performances are immutable and append-only", async () => {
  const controller = createSimulatedPerformanceStudioController();
  await controller.load({ workspaceKey: "ws" });
  const first = await controller.publishPerformanceFromTemplate({
    templateId: "fx-template-001",
    parameters: {},
  });
  const second = await controller.publishPerformanceFromTemplate({
    templateId: "fx-template-002",
    parameters: {},
  });
  // 不可变：先前记录不被后续发布改动（内容字段字节一致）。
  const current = await controller.refresh();
  const rereadFirst = current.performances.find(
    (performance) => performance.id === first.id,
  )!;
  assert.deepEqual(rereadFirst.timeline.cues, first.timeline.cues);
  assert.equal(rereadFirst.createdAt, first.createdAt);
  // 追加序 = 发布序。
  assert.deepEqual(
    current.performances.map((performance) => performance.id),
    [first.id, second.id],
  );
});

test("determinism: two fresh controllers replayed through the same operations produce identical snapshots", async () => {
  const run = async () => {
    const controller = createSimulatedPerformanceStudioController();
    await controller.load({ workspaceKey: "ws-determinism" });
    const performance = await controller.publishPerformanceFromTemplate({
      templateId: "fx-template-001",
      parameters: { intensity: 0.9 },
    });
    await grantAllPurposes(controller);
    const spec = await controller.submitRenderJob({
      performanceId: performance.id,
      method: "3d-render",
      outputKinds: ["image", "mesh"],
      parameters: { resolution: "1080p" },
    });
    await controller.startRenderJob({ jobId: spec.id });
    await controller.completeRenderJob({ jobId: spec.id });
    const artifacts = orderedRenderArtifacts(await controller.refresh());
    await controller.reviewArtifact({
      artifactId: artifacts[0]!.id,
      decision: "accept",
      notes: "determinism",
    });
    await controller.withdrawConsent({ policyId: CONSENT_POLICY_ID });
    return controller.refresh();
  };
  const [a, b] = await Promise.all([run(), run()]);
  assert.deepEqual(a, b);
});

test("per-workspace registry instances are independent", async () => {
  // 两个 controller 实例互不串状态（registry 的 per-workspace 语义）。
  const first = createSimulatedPerformanceStudioController();
  const second = createSimulatedPerformanceStudioController();
  await first.load({ workspaceKey: "ws-1" });
  await first.publishPerformanceFromTemplate({
    templateId: "fx-template-001",
    parameters: {},
  });
  const secondSnapshot = await second.load({ workspaceKey: "ws-2" });
  assert.equal(secondSnapshot.performances.length, 0);
  const firstSnapshot = await first.refresh();
  assert.equal(firstSnapshot.performances.length, 1);
});
