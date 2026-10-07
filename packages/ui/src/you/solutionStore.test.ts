// W1B logic tests — Solution 视图 store 转移（node:test，无 DOM）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSolutionPaneStore, SOLUTION_PANE_INITIAL_STATE } from "./solutionStore.js";
import {
  SOLUTION_CAMERA_DEFAULT,
  SOLUTION_CAMERA_MAX_ZOOM,
  SOLUTION_CAMERA_MIN_ZOOM,
} from "./solutionProjection.js";
import type { SolutionSurfaceSnapshot } from "./solutionController.js";
import { createSimulatedSolutionSurfaceController } from "./solutionSimulatedController.js";

async function loadFixtureSnapshot(): Promise<SolutionSurfaceSnapshot> {
  const controller = createSimulatedSolutionSurfaceController();
  return controller.load({ workspaceKey: "test-workspace" });
}

test("store starts in idle state with default camera and empty demo", () => {
  const store = createSolutionPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.panel, SOLUTION_PANE_INITIAL_STATE.panel);
  assert.equal(state.selection, null);
  assert.equal(state.compareVersionId, null);
  assert.equal(state.mode, "view");
  assert.deepEqual(state.camera, SOLUTION_CAMERA_DEFAULT);
  assert.equal(state.demo.active, false);
  assert.equal(state.demo.stepIndex, 0);
  assert.equal(state.demo.finished, false);
  assert.equal(state.demo.outcomes.length, 0);
});

test("load lifecycle: begin -> succeeded applies snapshot and picks previous version as compare target", async () => {
  const store = createSolutionPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.snapshot, snapshot);
  // 单版本会话：无历史版本可对比。
  assert.equal(state.compareVersionId, null);
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createSolutionPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: boom");
  const failed = store.getState();
  assert.equal(failed.status, "error");
  assert.equal(failed.errorMessage, "YOU_INVALID_STATE: boom");

  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().errorMessage, null);
});

test("view state transitions: panel, selection, compare target and mode are independent", async () => {
  const store = createSolutionPaneStore();
  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);

  store.getState().setPanel("compare");
  store.getState().setSelection({ kind: "region", regionId: "region.face" });
  store.getState().setCompareVersionId("fx-version-001");
  store.getState().setMode("edit");

  const state = store.getState();
  assert.equal(state.panel, "compare");
  assert.deepEqual(state.selection, { kind: "region", regionId: "region.face" });
  assert.equal(state.compareVersionId, "fx-version-001");
  assert.equal(state.mode, "edit");

  store.getState().setSelection(null);
  assert.equal(store.getState().selection, null);
});

test("camera transitions: orbit, pan, zoom clamp and reset", () => {
  const store = createSolutionPaneStore();

  store.getState().orbitCamera(0.5, 0.5);
  let camera = store.getState().camera;
  assert.equal(camera.yaw, SOLUTION_CAMERA_DEFAULT.yaw + 0.5);
  assert.equal(camera.pitch, SOLUTION_CAMERA_DEFAULT.pitch + 0.5);

  // pitch 越界被夹紧。
  store.getState().orbitCamera(0, 10);
  camera = store.getState().camera;
  assert.equal(camera.pitch > 1.35, false);

  store.getState().panCamera(12, -8);
  camera = store.getState().camera;
  assert.equal(camera.panX, 12);
  assert.equal(camera.panY, -8);

  // zoom 被夹在 [0.5, 2.5]。
  for (let i = 0; i < 40; i += 1) {
    store.getState().zoomCamera(1.5);
  }
  assert.equal(store.getState().camera.zoom, SOLUTION_CAMERA_MAX_ZOOM);
  for (let i = 0; i < 60; i += 1) {
    store.getState().zoomCamera(1 / 1.5);
  }
  assert.equal(store.getState().camera.zoom, SOLUTION_CAMERA_MIN_ZOOM);

  store.getState().resetCamera();
  assert.deepEqual(store.getState().camera, SOLUTION_CAMERA_DEFAULT);
});

test("overlay toggles flip once per call", () => {
  const store = createSolutionPaneStore();
  assert.equal(store.getState().showRegions, false);
  store.getState().toggleRegions();
  assert.equal(store.getState().showRegions, true);
  assert.equal(store.getState().showQuality, true);
  store.getState().toggleQuality();
  assert.equal(store.getState().showQuality, false);
});

test("demo transitions: started -> step recorded -> finished -> reset", () => {
  const store = createSolutionPaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);

  store.getState().demoStepRecorded({
    stepId: "intent",
    summary: "s1",
    refs: [],
    uiHint: {},
  });
  store.getState().demoStepRecorded({
    stepId: "feedback",
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
