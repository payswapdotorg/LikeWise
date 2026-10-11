// W4B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：时间线轨道投影（motion/cue/layer 分类学 + 扩展轨道排序 + 内容寻址 payload
// 标签 + 时长显示 + evidence 派生标记）、渲染作业状态阶梯、作业 spec 行、effort
// 观察（not-measured 标记）、artifact lineage / 评审状态投影（append-only 有效评审）、
// 模板参数行、时间线草稿编辑模型（确定性操作 + 非法草稿不静默修复）、渲染提交草稿。
import assert from "node:assert/strict";
import test from "node:test";
import {
  projectArtifactLineageRows,
  projectArtifactReview,
  projectParameterSummaryEntries,
  projectRenderEffortRows,
  projectRenderJobLadder,
  projectRenderJobSpecRow,
  projectTemplateParameterRows,
  projectTimeline,
  selectRenderMethod,
  setRenderDraftParameter,
  toggleRenderOutputKind,
} from "./performanceStudioProjection.js";
import {
  addDraftCue,
  createTimelineDraft,
  draftToTimeline,
  projectDraftTimeline,
  removeDraftCue,
  setDraftCueEnd,
  shiftDraftCue,
} from "./performanceTimelineDraftModel.js";
import { createSimulatedPerformanceStudioController } from "./performanceSimulatedController.js";
import {
  PERFORMANCE_STORYBOARD_TEMPLATES,
  validateStoryboardTimeline,
} from "./performanceStoryboard.js";
import type { PerformanceStudioSnapshot, RenderJobView } from "./performanceController.js";
import type { PerformanceTimeline } from "@zcode/shared";

const WAVE_TEMPLATE = PERFORMANCE_STORYBOARD_TEMPLATES[0]!;
const TURN_TEMPLATE = PERFORMANCE_STORYBOARD_TEMPLATES[1]!;

test("timeline projection renders the motion/cue/layer taxonomy with stable track order", () => {
  const projection = projectTimeline(WAVE_TEMPLATE.timeline);
  // 模板 1 轨道：cue / layer / motion（canonical 序 motion/cue/layer）。
  assert.deepEqual(
    projection.tracks.map((track) => track.track),
    ["motion", "cue", "layer"],
  );
  assert.equal(projection.totalCues, 4);
  assert.equal(projection.durationMs, 6000);
  assert.equal(projection.durationLabel, "6.00s");
  // cue 行按 startMs 稳定排序。
  assert.deepEqual(
    projection.cueRows.map((cue) => cue.startMs),
    [0, 0, 200, 2400],
  );
  // evidence 派生 cue 计数（greeting-line）。
  assert.equal(projection.evidenceBoundCueCount, 1);
  const greeting = projection.cueRows.find((cue) => cue.id.includes("greeting-line"))!;
  assert.equal(greeting.evidenceBound, true);
  assert.ok(greeting.payloadRef.startsWith("fx-evidence-"));
  // 非 evidence cue。
  const wave = projection.cueRows.find((cue) => cue.id.includes("wave-right-arm"))!;
  assert.equal(wave.evidenceBound, false);
  assert.ok(wave.payloadRef.startsWith("fx-content-"));
  assert.match(wave.accessibleLabel, /motion cue .+ payload fx-content-/);
});

test("timeline projection orders extension tracks after the canonical three", () => {
  // 模板 2 含扩展轨道 camera（开放联合）→ 排在 motion/cue/layer 之后。
  const projection = projectTimeline(TURN_TEMPLATE.timeline);
  assert.deepEqual(
    projection.tracks.map((track) => track.track),
    ["motion", "cue", "layer", "camera"],
  );
  assert.equal(projection.totalCues, 5);
  assert.equal(projection.durationMs, 8000);
  assert.equal(projection.evidenceBoundCueCount, 0);
});

test("timeline projection computes deterministic bar geometry and duration labels", () => {
  const projection = projectTimeline(WAVE_TEMPLATE.timeline);
  const wave = projection.cueRows.find((cue) => cue.id.includes("wave-right-arm"))!;
  assert.equal(wave.startPercent, 0);
  assert.equal(wave.widthPercent, 40); // 2400 / 6000
  const headNod = projection.cueRows.find((cue) => cue.id.includes("head-nod"))!;
  assert.equal(Math.round(headNod.startPercent * 10) / 10, 40); // 2400 / 6000
  assert.equal(Math.round(headNod.widthPercent * 10) / 10, 13.3); // 800 / 6000
  // 空时间线投影的空态。
  const empty = projectTimeline(null);
  assert.equal(empty.totalCues, 0);
  assert.equal(empty.durationLabel, "0.00s");
  assert.deepEqual(empty.tracks, []);
});

test("render job ladder: process steps accumulate, terminals are exclusive", () => {
  const queued = projectRenderJobLadder("queued");
  assert.deepEqual(
    queued.map((step) => [step.status, step.reached, step.current]),
    [
      ["queued", true, true],
      ["running", false, false],
      ["completed", false, false],
      ["failed", false, false],
    ],
  );
  const running = projectRenderJobLadder("running");
  assert.deepEqual(
    running.filter((step) => step.reached).map((step) => step.status),
    ["queued", "running"],
  );
  const completed = projectRenderJobLadder("completed");
  assert.deepEqual(
    completed.filter((step) => step.reached).map((step) => step.status),
    ["queued", "running", "completed"],
  );
  const failed = projectRenderJobLadder("failed");
  // failed 终态不点亮 completed（互斥终态）。
  assert.deepEqual(
    failed.filter((step) => step.reached).map((step) => step.status),
    ["queued", "running", "failed"],
  );
});

function jobViewFixture(): RenderJobView {
  return {
    spec: {
      id: "fx-renderjob-001",
      performanceId: "fx-perf-001",
      method: "image-render",
      outputKinds: ["image"],
      parameters: { quality: 0.9, resolution: "1080p" },
      createdAt: "2025-06-02T09:00:10.000Z",
    },
    status: "completed",
    result: {
      jobId: "fx-renderjob-001",
      status: "completed",
      artifacts: [
        {
          id: "fx-rart-001",
          jobId: "fx-renderjob-001",
          kind: "image",
          contentRef: "fx-content-abc",
          contentHash: "sha256-fixture-abc",
          createdAt: "2025-06-02T09:00:12.000Z",
          simulated: true,
        },
      ],
      effortObservations: {
        "computeEffort.measured": false,
        computeEffort: "not-measured (simulated)",
        latencyMs: "not-measured (simulated)",
        artifactsProduced: 1,
        simulated: true,
      },
      completedAt: "2025-06-02T09:00:12.000Z",
      simulated: true,
    },
  };
}

test("job spec row projects parameters with stable key order", () => {
  const row = projectRenderJobSpecRow(jobViewFixture());
  assert.equal(row.jobId, "fx-renderjob-001");
  assert.equal(row.status, "completed");
  assert.equal(row.method, "image-render");
  assert.deepEqual(row.outputKinds, ["image"]);
  assert.deepEqual(row.parameterEntries, [
    { key: "quality", value: "0.9" },
    { key: "resolution", value: "1080p" },
  ]);
  assert.equal(row.artifactCount, 1);
  assert.equal(row.completedAt, "2025-06-02T09:00:12.000Z");
  assert.equal(row.failureReason, null);
});

test("effort rows keep explicit not-measured markers visible", () => {
  const rows = projectRenderEffortRows(jobViewFixture());
  const byKey = new Map(rows.map((row) => [row.key, row]));
  assert.equal(byKey.get("computeEffort.measured")!.notMeasured, true);
  assert.equal(byKey.get("computeEffort")!.notMeasured, true);
  assert.equal(byKey.get("latencyMs")!.notMeasured, true);
  assert.equal(byKey.get("artifactsProduced")!.notMeasured, false);
  assert.equal(byKey.get("simulated")!.notMeasured, false);
  assert.match(
    byKey.get("computeEffort")!.accessibleLabel,
    /unmeasured — no number invented/,
  );
  // 键按稳定排序（显式字面序断言）。
  assert.deepEqual(
    rows.map((row) => row.key),
    ["artifactsProduced", "computeEffort", "computeEffort.measured", "latencyMs", "simulated"],
  );
  // 无 result → 空行。
  assert.deepEqual(projectRenderEffortRows({ spec: jobViewFixture().spec, status: "queued", result: null }), []);
  assert.deepEqual(projectRenderEffortRows(null), []);
});

test("artifact lineage rows flatten job -> artifacts with review projections", async () => {
  const controller = createSimulatedPerformanceStudioController();
  const snapshot = await controller.load({ workspaceKey: "ws" });
  // 无作业 → 无产物（空态可测）。
  assert.deepEqual(projectArtifactLineageRows(snapshot), []);
  assert.equal(projectArtifactReview(snapshot, null).status, "pending");

  const performance = await controller.publishPerformanceFromTemplate({
    templateId: "fx-template-002",
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
  const completed: PerformanceStudioSnapshot = await controller.refresh();

  // lineage：两件产物均挂在该作业下；artifact id 稳定排序。
  const rows = projectArtifactLineageRows(completed);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.jobId === spec.id));
  assert.deepEqual(
    rows.map((row) => row.artifact.kind).sort(),
    ["image", "mesh"],
  );
  // 未评审 → pending（状态机隐式起点）。
  assert.ok(rows.every((row) => row.review.status === "pending"));
  assert.ok(rows.every((row) => row.review.reviewCount === 0));

  // 评审后：有效评审投影 + append-only 计数。
  const mesh = rows.find((row) => row.artifact.kind === "mesh")!;
  await controller.reviewArtifact({
    artifactId: mesh.artifact.id,
    decision: "reject",
    notes: "not watertight",
  });
  const afterReject: PerformanceStudioSnapshot = await controller.refresh();
  const meshReview = projectArtifactReview(afterReject, mesh.artifact.id);
  assert.equal(meshReview.status, "rejected");
  assert.equal(meshReview.reviewCount, 1);
  assert.equal(projectArtifactReview(afterReject, "unknown-artifact").status, "pending");
});

test("template parameter rows and summary entries sort by key and type by value", () => {
  const rows = projectTemplateParameterRows({
    caption: "Next topic",
    turnDegrees: 90,
    holdSeconds: 2,
  });
  assert.deepEqual(
    rows.map((row) => [row.key, row.kind, row.value]),
    [
      ["caption", "string", "Next topic"],
      ["holdSeconds", "number", 2],
      ["turnDegrees", "number", 90],
    ],
  );
  const boolRows = projectTemplateParameterRows({ includeHeadNod: true });
  assert.equal(boolRows[0]!.kind, "boolean");
  assert.deepEqual(projectParameterSummaryEntries({ b: 1, a: true }), [
    { key: "a", value: "true" },
    { key: "b", value: "1" },
  ]);
});

test("timeline draft operations are deterministic and never mutate the source", () => {
  const performance = {
    id: "fx-perf-001",
    twinVersionId: "fx-twver-anchor-001",
    timeline: WAVE_TEMPLATE.timeline,
    basedOnTemplateId: "fx-template-001",
    createdAt: "2025-06-02T09:00:05.000Z",
  };
  const before = JSON.stringify(WAVE_TEMPLATE.timeline);
  const draft = createTimelineDraft(performance);
  // head-nod cue（motion 2400–3200）用于平移断言。
  const headNod = draft.cues.find((cue) => cue.id.includes("head-nod"))!;
  const headNodIndex = draft.cues.indexOf(headNod);

  // 平移：start 夹 0 之前先验证正常平移；时长保持。
  const shifted = shiftDraftCue(draft, headNod.id, -500);
  assert.equal(shifted.cues[headNodIndex]!.startMs, 1900);
  assert.equal(shifted.cues[headNodIndex]!.endMs, 2700);
  // 源记录不被改动（不可变语义）。
  assert.equal(JSON.stringify(WAVE_TEMPLATE.timeline), before);
  assert.notEqual(shifted, draft);

  // 平移越界夹 0：wave-right-arm（motion 0–2400）左移 500 → start 夹 0、时长保持。
  const wave = draft.cues.find((cue) => cue.id.includes("wave-right-arm"))!;
  const clamped = shiftDraftCue(draft, wave.id, -500);
  assert.equal(clamped.cues.find((cue) => cue.id === wave.id)!.startMs, 0);
  assert.equal(clamped.cues.find((cue) => cue.id === wave.id)!.endMs, 2400);

  // 末端调整：允许任意 >= 0（非法时长由服务端 typed 拒绝，绝不静默修复）。
  const collapsed = setDraftCueEnd(draft, headNod.id, 0);
  assert.equal(collapsed.cues.find((cue) => cue.id === headNod.id)!.endMs, 0);
  const invalid = draftToTimeline(collapsed, "fx-timeline-draft-1");
  assert.equal(validateStoryboardTimeline(invalid)?.reason, "non-positive-duration");

  // 追加 cue：置于该轨道末端 +1000ms，payload 内容寻址派生。
  const withAdded = addDraftCue(draft, "layer");
  const added = withAdded.cues.at(-1)!;
  assert.equal(added.track, "layer");
  assert.equal(added.startMs, 6000);
  assert.equal(added.endMs, 7000);
  assert.ok(added.payloadRef.startsWith("fx-content-"));
  assert.ok(added.payloadHash.startsWith("sha256-fixture-"));

  // 追加后的时间线合法（durationMs = 最大 endMs 精确一致）。
  const timeline = draftToTimeline(withAdded, "fx-timeline-draft-2");
  assert.equal(validateStoryboardTimeline(timeline), null);
  assert.equal(timeline.durationMs, 7000);

  // 移除：幂等（未知 id 无变化）。
  const removed = removeDraftCue(withAdded, added.id);
  assert.equal(removed.cues.length, draft.cues.length);
  assert.equal(removeDraftCue(removed, "unknown").cues.length, removed.cues.length);

  // 草稿投影复用轨道视图数学。
  const draftProjection = projectDraftTimeline(withAdded);
  assert.equal(draftProjection.totalCues, 5);
  assert.equal(draftProjection.durationLabel, "7.00s");
  assert.deepEqual(projectDraftTimeline(null).tracks, []);
});

test("render submit draft transitions are pure record/set math", () => {
  const profile = {
    supportedOutputKinds: ["image", "mesh"] as const,
    defaultParameters: { resolution: "1080p" },
  };
  const seeded = selectRenderMethod(
    { method: null, outputKinds: [], parameters: {} },
    "retargeting",
    profile,
  );
  assert.equal(seeded.method, "retargeting");
  assert.deepEqual(seeded.outputKinds, ["image", "mesh"]);
  assert.deepEqual(seeded.parameters, { resolution: "1080p" });

  // 勾选切换：去选 mesh → 只剩 image；再选回 → 排序稳定。
  const toggled = toggleRenderOutputKind(seeded, "mesh");
  assert.deepEqual(toggled.outputKinds, ["image"]);
  const toggledBack = toggleRenderOutputKind(toggled, "mesh");
  assert.deepEqual(toggledBack.outputKinds, ["image", "mesh"]);

  // 参数写入（plain typed record）。
  const withParam = setRenderDraftParameter(toggledBack, "resolution", "720p");
  assert.equal(withParam.parameters["resolution"], "720p");
  assert.equal(toggledBack.parameters["resolution"], "1080p");

  // 未知方法 profile → 仅记录 method。
  const unknown = selectRenderMethod(seeded, "hologram-magic", null);
  assert.equal(unknown.method, "hologram-magic");
  assert.deepEqual(unknown.parameters, seeded.parameters);
});

test("storyboard templates satisfy the frozen timeline invariants", () => {
  // 模板库自身的时间线必须通过 v4 校验（内容寻址、有序、同轨不重叠、时长一致）。
  for (const template of PERFORMANCE_STORYBOARD_TEMPLATES) {
    const violation = validateStoryboardTimeline(template.timeline);
    assert.equal(
      violation,
      null,
      `template ${template.id} violates the frozen timeline invariants: ${JSON.stringify(violation)}`,
    );
  }
  // 模板 name 唯一性（W4A template library 同语义）。
  const names = PERFORMANCE_STORYBOARD_TEMPLATES.map((template) => template.name);
  assert.equal(new Set(names).size, names.length);
  // 空时间线：durationMs 必须为 0。
  const emptyTimeline: PerformanceTimeline = { id: "fx-empty", cues: [], durationMs: 0 };
  assert.equal(validateStoryboardTimeline(emptyTimeline), null);
  const inconsistentEmpty: PerformanceTimeline = { id: "fx-empty", cues: [], durationMs: 10 };
  assert.equal(validateStoryboardTimeline(inconsistentEmpty)?.reason, "duration-inconsistent");
});
