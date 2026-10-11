// W4B logic tests — Performance 视图 store 转移（node:test，无 DOM）。
//
// 覆盖：加载生命周期（idle→loading→ready/error）、操作级 typed 错误（inline、表面
// 保持可用）、性能选中/键盘光标视图转移、模板挑选与参数草稿（plain typed record）、
// 时间线草稿生命周期、渲染提交草稿转移、demo 状态机、以及「快照刷新保持选中语义」。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createPerformancePaneStore,
  PERFORMANCE_PANE_INITIAL_STATE,
} from "./performanceStudioStore.js";
import { createSimulatedPerformanceStudioController } from "./performanceSimulatedController.js";
import type { PerformanceStudioSnapshot } from "./performanceController.js";
import {
  selectRenderMethod,
  toggleRenderOutputKind,
} from "./performanceStudioProjection.js";
import {
  addDraftCue,
  createTimelineDraft,
  setDraftCueEnd,
} from "./performanceTimelineDraftModel.js";

async function loadFixtureSnapshot(): Promise<PerformanceStudioSnapshot> {
  const controller = createSimulatedPerformanceStudioController();
  return controller.load({ workspaceKey: "test-workspace" });
}

async function loadFixtureSnapshotWithPerformances(): Promise<PerformanceStudioSnapshot> {
  const controller = createSimulatedPerformanceStudioController();
  await controller.load({ workspaceKey: "test-workspace" });
  await controller.publishPerformanceFromTemplate({
    templateId: "fx-template-001",
    parameters: {},
  });
  await controller.publishPerformanceFromTemplate({
    templateId: "fx-template-002",
    parameters: {},
  });
  return controller.refresh();
}

test("store starts in idle state with timeline panel and empty demo", () => {
  const store = createPerformancePaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.panel, PERFORMANCE_PANE_INITIAL_STATE.panel);
  assert.equal(state.snapshot, null);
  assert.equal(state.selectedPerformanceId, null);
  assert.equal(state.performanceIndex, 0);
  assert.equal(state.selectedTemplateId, null);
  assert.deepEqual(state.templateParameterDraft, {});
  assert.equal(state.timelineDraft, null);
  assert.deepEqual(state.renderDraft, { method: null, outputKinds: [], parameters: {} });
  assert.equal(state.selectedJobId, null);
  assert.equal(state.selectedArtifactId, null);
  assert.equal(state.actionError, null);
  assert.equal(state.demo.active, false);
  assert.equal(state.demo.stepIndex, 0);
  assert.equal(state.demo.finished, false);
  assert.equal(state.demo.outcomes.length, 0);
});

test("load lifecycle: begin -> succeeded applies snapshot (templates default selection)", async () => {
  const store = createPerformancePaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.snapshot, snapshot);
  // 空性能平面：无演出 → 选中回退 null；模板默认第一条且参数草稿带入默认值。
  assert.equal(state.selectedPerformanceId, null);
  assert.equal(state.performanceIndex, 0);
  assert.equal(state.selectedTemplateId, "fx-template-001");
  assert.deepEqual(state.templateParameterDraft, snapshot.templates[0]!.parameters);
  assert.equal(snapshot.simulated, true);
  assert.equal(snapshot.performances.length, 0);
  assert.equal(snapshot.jobs.length, 0);
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createPerformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: performance studio is not loaded");
  const state = store.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "YOU_INVALID_STATE: performance studio is not loaded");
  // 恢复路径：重新 beginLoad 清除错误并回到 loading。
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().errorMessage, null);
});

test("loadSucceeded defaults selection to the latest performance", async () => {
  const store = createPerformancePaneStore();
  const snapshot = await loadFixtureSnapshotWithPerformances();
  assert.equal(snapshot.performances.length, 2);
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  const latest = snapshot.performances.at(-1)!;
  assert.equal(state.selectedPerformanceId, latest.id);
  assert.equal(state.performanceIndex, 1);
});

test("action error is inline and typed: status stays ready and is dismissible", async () => {
  const store = createPerformancePaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("boom");
  store.getState().beginLoad();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  // typed 错误携带 code（typed error panel 的分类键）。
  store.getState().actionFailed({
    code: "YOU_TIMELINE_INVALID",
    message: "invalid performance timeline: track-overlap (cue x, track motion)",
  });
  let state = store.getState();
  assert.equal(state.status, "ready");
  assert.deepEqual(state.actionError, {
    code: "YOU_TIMELINE_INVALID",
    message: "invalid performance timeline: track-overlap (cue x, track motion)",
  });
  // 错误可关闭；表面状态不受影响。
  store.getState().clearActionError();
  state = store.getState();
  assert.equal(state.actionError, null);
  assert.equal(state.status, "ready");
});

test("performance selection and keyboard cursor move together", async () => {
  const store = createPerformancePaneStore();
  const snapshot = await loadFixtureSnapshotWithPerformances();
  store.getState().loadSucceeded(snapshot);

  store.getState().selectPerformance(snapshot.performances[0]!.id);
  assert.equal(store.getState().selectedPerformanceId, snapshot.performances[0]!.id);
  assert.equal(store.getState().performanceIndex, 0);

  store.getState().movePerformanceIndex(1);
  assert.equal(store.getState().selectedPerformanceId, snapshot.performances[1]!.id);
  assert.equal(store.getState().performanceIndex, 1);

  // 越界夹紧：向上两次回到 0（不出现 -1）。
  store.getState().movePerformanceIndex(-5);
  assert.equal(store.getState().performanceIndex, 0);
  assert.equal(store.getState().selectedPerformanceId, snapshot.performances[0]!.id);

  // setPerformanceIndex 即检视（光标移动 = 一等交互路径）。
  store.getState().setPerformanceIndex(1);
  assert.equal(store.getState().selectedPerformanceId, snapshot.performances[1]!.id);

  // null 选中归零光标。
  store.getState().selectPerformance(null);
  assert.equal(store.getState().selectedPerformanceId, null);
  assert.equal(store.getState().performanceIndex, 0);
});

test("applySnapshot keeps existing selections when the records still exist", async () => {
  const store = createPerformancePaneStore();
  const snapshot = await loadFixtureSnapshotWithPerformances();
  store.getState().loadSucceeded(snapshot);
  store.getState().selectPerformance(snapshot.performances[0]!.id);

  // 刷新后既有选中仍存在 → 保持。
  store.getState().applySnapshot(snapshot);
  assert.equal(store.getState().selectedPerformanceId, snapshot.performances[0]!.id);
  assert.equal(store.getState().performanceIndex, 0);

  // 刷新后选中对象消失 → 回退末位（确定性回退，不猜测）。
  const reduced: PerformanceStudioSnapshot = {
    ...snapshot,
    performances: snapshot.performances.slice(0, 1),
  };
  store.getState().selectPerformance(snapshot.performances[1]!.id);
  store.getState().applySnapshot(reduced);
  assert.equal(store.getState().selectedPerformanceId, snapshot.performances[0]!.id);
});

test("template selection seeds the parameter draft from template defaults", async () => {
  const store = createPerformancePaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().selectTemplate("fx-template-002");
  assert.equal(store.getState().selectedTemplateId, "fx-template-002");
  assert.deepEqual(store.getState().templateParameterDraft, {
    turnDegrees: 90,
    holdSeconds: 2,
    caption: "Next topic",
  });

  // 单键写入（plain typed record 编辑；kind 保持）。
  store.getState().setTemplateParameter("turnDegrees", 120);
  assert.equal(store.getState().templateParameterDraft["turnDegrees"], 120);
  store.getState().setTemplateParameter("caption", "Edited topic");
  assert.equal(store.getState().templateParameterDraft["caption"], "Edited topic");
  store.getState().setTemplateParameter("holdSeconds", 3);
  assert.equal(store.getState().templateParameterDraft["holdSeconds"], 3);

  // 未知模板：选中置位但参数草稿为空（诚实空态）。
  store.getState().selectTemplate("fx-template-999");
  assert.equal(store.getState().selectedTemplateId, "fx-template-999");
  assert.deepEqual(store.getState().templateParameterDraft, {});

  // 整体重设（模板重选时带入默认参数）。
  store.getState().setTemplateParameterDraft({ intensity: 0.5 });
  assert.deepEqual(store.getState().templateParameterDraft, { intensity: 0.5 });
});

test("timeline draft lifecycle: start, deterministic ops, discard", async () => {
  const store = createPerformancePaneStore();
  const snapshot = await loadFixtureSnapshotWithPerformances();
  store.getState().loadSucceeded(snapshot);
  const source = snapshot.performances[0]!;

  const draft = createTimelineDraft(source);
  store.getState().startTimelineDraft(draft);
  assert.equal(store.getState().timelineDraft, draft);

  // 确定性操作经纯函数产出后整体替换。
  const shifted = setDraftCueEnd(draft, draft.cues[0]!.id, draft.cues[0]!.endMs + 100);
  store.getState().replaceTimelineDraft(shifted);
  assert.equal(store.getState().timelineDraft, shifted);
  assert.notEqual(store.getState().timelineDraft, draft);

  const withAdded = addDraftCue(shifted, "motion");
  store.getState().replaceTimelineDraft(withAdded);
  assert.equal(store.getState().timelineDraft!.cues.length, source.timeline.cues.length + 1);

  // 放弃草稿回到检视态。
  store.getState().discardTimelineDraft();
  assert.equal(store.getState().timelineDraft, null);
});

test("render submit draft transitions: method profile seeding and kind toggles", async () => {
  const store = createPerformancePaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  // 选中方法：带入注册面默认参数与全部支持 outputKind。
  const profile = snapshot.renderMethods.find((entry) => entry.method === "image-render")!;
  const seeded = selectRenderMethod(
    { method: null, outputKinds: [], parameters: {} },
    "image-render",
    profile,
  );
  store.getState().setRenderDraft(seeded);
  let draft = store.getState().renderDraft;
  assert.equal(draft.method, "image-render");
  assert.deepEqual(draft.outputKinds, ["image"]);
  assert.deepEqual(draft.parameters, { resolution: "1080p", quality: 0.9 });

  // outputKind 勾选切换（image-render 只支持 image → 空集切换）。
  store.getState().setRenderDraft(toggleRenderOutputKind(draft, "image"));
  draft = store.getState().renderDraft;
  assert.deepEqual(draft.outputKinds, []);

  // 换方法（3d-render 支持 4 种输出）。
  const profile3d = snapshot.renderMethods.find((entry) => entry.method === "3d-render")!;
  store.getState().setRenderDraft(
    selectRenderMethod(draft, "3d-render", profile3d),
  );
  draft = store.getState().renderDraft;
  assert.deepEqual(draft.outputKinds, ["image", "video", "mesh", "animation"]);

  // 未知方法 profile → 仅记录 method（提交会被注册面 typed 拒绝）。
  store.getState().setRenderDraft(selectRenderMethod(draft, "hologram-magic", null));
  assert.equal(store.getState().renderDraft.method, "hologram-magic");
});

test("demo state machine: start -> step -> finished -> reset", () => {
  const store = createPerformancePaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);

  store.getState().demoStepRecorded({
    stepId: "template-pick",
    summary: "ok",
    refs: [],
    uiHint: {},
  });
  assert.equal(store.getState().demo.stepIndex, 1);
  assert.equal(store.getState().demo.outcomes.length, 1);

  store.getState().demoFinished();
  assert.equal(store.getState().demo.finished, true);
  assert.equal(store.getState().demo.active, false);

  store.getState().demoReset();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.stepIndex, 0);
  assert.equal(store.getState().demo.finished, false);
  assert.equal(store.getState().demo.outcomes.length, 0);
});
