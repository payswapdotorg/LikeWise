// W2B logic tests — Capture 视图 store 转移（node:test，无 DOM）。
//
// 覆盖：加载生命周期（idle→loading→ready/error）、操作级错误（inline、表面保持可用）、
// 会话/步骤光标/证据选择的视图转移、demo 状态机、以及「快照刷新保持选中语义」。
import assert from "node:assert/strict";
import test from "node:test";
import { createCapturePaneStore, CAPTURE_PANE_INITIAL_STATE } from "./captureStudioStore.js";
import type { CaptureStudioSnapshot } from "./captureController.js";
import { createSimulatedCaptureStudioController } from "./captureSimulatedController.js";

async function loadFixtureSnapshot(): Promise<CaptureStudioSnapshot> {
  const controller = createSimulatedCaptureStudioController();
  return controller.load({ workspaceKey: "test-workspace" });
}

test("store starts in idle state with requests panel and empty demo", () => {
  const store = createCapturePaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.panel, CAPTURE_PANE_INITIAL_STATE.panel);
  assert.equal(state.snapshot, null);
  assert.equal(state.activeCaptureSessionId, null);
  assert.equal(state.guideStepIndex, 0);
  assert.equal(state.selectedEvidenceRecordId, null);
  assert.equal(state.actionError, null);
  assert.equal(state.demo.active, false);
  assert.equal(state.demo.stepIndex, 0);
  assert.equal(state.demo.finished, false);
  assert.equal(state.demo.outcomes.length, 0);
});

test("load lifecycle: begin -> succeeded applies snapshot (empty studio state)", async () => {
  const store = createCapturePaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.snapshot, snapshot);
  // 空 studio：无会话/记录 → 默认选中为 null（空态可测）。
  assert.equal(state.activeCaptureSessionId, null);
  assert.equal(state.selectedEvidenceRecordId, null);
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createCapturePaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: capture studio is not loaded");
  const failed = store.getState();
  assert.equal(failed.status, "error");
  assert.equal(failed.errorMessage, "YOU_INVALID_STATE: capture studio is not loaded");

  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().errorMessage, null);
});

test("action errors are inline: surface stays ready and can be dismissed", async () => {
  const store = createCapturePaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().actionFailed("YOU_CONSENT_REQUIRED: processing requires consent");
  let state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.actionError, "YOU_CONSENT_REQUIRED: processing requires consent");
  assert.equal(state.errorMessage, null);

  store.getState().clearActionError();
  state = store.getState();
  assert.equal(state.actionError, null);
  assert.equal(state.status, "ready");
});

test("view state transitions: panel, session selection, guide cursor and evidence selection", async () => {
  const store = createCapturePaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().setPanel("consent");
  assert.equal(store.getState().panel, "consent");

  store.getState().setActiveCaptureSession("fx-capsess-001");
  assert.equal(store.getState().activeCaptureSessionId, "fx-capsess-001");
  // 切换会话时步骤光标归零。
  store.getState().setGuideStepIndex(2);
  store.getState().setActiveCaptureSession("fx-capsess-002");
  assert.equal(store.getState().guideStepIndex, 0);

  store.getState().setGuideStepIndex(5);
  assert.equal(store.getState().guideStepIndex, 5);

  store.getState().selectEvidenceRecord("fx-evd-009");
  assert.equal(store.getState().selectedEvidenceRecordId, "fx-evd-009");
  store.getState().selectEvidenceRecord(null);
  assert.equal(store.getState().selectedEvidenceRecordId, null);
});

test("guide cursor movement is clamped to the active session's step count", () => {
  const store = createCapturePaneStore();
  // 无快照（空态）：total=0 ⇒ 光标钳制在 0。
  store.getState().moveGuideStep(3);
  assert.equal(store.getState().guideStepIndex, 0);
  store.getState().moveGuideStep(-3);
  assert.equal(store.getState().guideStepIndex, 0);
});

test("applySnapshot keeps selections that still exist and falls back to the latest", async () => {
  const store = createCapturePaneStore();
  const controller = createSimulatedCaptureStudioController();
  const first = await controller.load({ workspaceKey: "ws" });
  store.getState().loadSucceeded(first);

  // 制造服务端事实：请求 + 会话 + 证据。
  const request = await controller.requestTargetedEvidence({
    targetDeficiency: "geometry",
    reason: "test reason",
  });
  const session = await controller.openCaptureSession({ evidenceRequestId: request.id });
  await controller.decideConsent({
    policyId: first.consent.policy.id,
    purpose: "solution-generation",
    decision: "grant",
  });
  await controller.decideConsent({
    policyId: first.consent.policy.id,
    purpose: "quality-improvement",
    decision: "grant",
  });
  const record = await controller.captureGuideStep({
    sessionId: session.id,
    stepId: "fx-guide-front",
  });
  const second = await controller.refresh();

  store.getState().applySnapshot(second);
  let state = store.getState();
  assert.equal(state.activeCaptureSessionId, session.id);
  assert.equal(state.selectedEvidenceRecordId, record.id);

  // 选中对象被清除（会话不存在）→ 回退到末位。
  store.getState().setActiveCaptureSession("missing-session");
  const third = await controller.refresh();
  store.getState().applySnapshot(third);
  state = store.getState();
  assert.equal(state.activeCaptureSessionId, session.id);
});

test("demo transitions: started -> step recorded -> finished -> reset", () => {
  const store = createCapturePaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);

  store.getState().demoStepRecorded({
    stepId: "evidence-request",
    summary: "s1",
    refs: [],
    uiHint: {},
  });
  store.getState().demoStepRecorded({
    stepId: "capture-open",
    summary: "s2",
    refs: [],
    uiHint: {},
  });
  let demo = store.getState().demo;
  assert.equal(demo.stepIndex, 2);
  assert.equal(demo.outcomes.length, 2);
  assert.equal(demo.outcomes[1]?.summary, "s2");

  store.getState().demoFinished();
  demo = store.getState().demo;
  assert.equal(demo.active, false);
  assert.equal(demo.finished, true);
  assert.equal(demo.stepIndex, 2);

  store.getState().demoReset();
  demo = store.getState().demo;
  assert.equal(demo.active, false);
  assert.equal(demo.finished, false);
  assert.equal(demo.stepIndex, 0);
  assert.equal(demo.outcomes.length, 0);
});
