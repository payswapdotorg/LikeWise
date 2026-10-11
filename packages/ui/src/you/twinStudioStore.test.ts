// W3B logic tests — Twin 视图 store 转移（node:test，无 DOM）。
//
// 覆盖：加载生命周期（idle→loading→ready/error）、操作级错误（inline、表面保持可用）、
// 版本选中/键盘光标视图转移、对比基线/目标/模式独立性、demo 状态机、以及
// 「快照刷新保持选中语义」。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createTwinPaneStore,
  TWIN_PANE_INITIAL_STATE,
} from "./twinStudioStore.js";
import { createSimulatedTwinStudioController } from "./twinSimulatedController.js";
import type { TwinStudioSnapshot } from "./twinController.js";

async function loadFixtureSnapshot(): Promise<TwinStudioSnapshot> {
  const controller = createSimulatedTwinStudioController();
  return controller.load({ workspaceKey: "test-workspace" });
}

async function loadFixtureSnapshotWithVersion(): Promise<TwinStudioSnapshot> {
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "test-workspace" });
  await controller.publishFixtureVersion({});
  await controller.publishFixtureVersion({});
  return controller.refresh();
}

test("store starts in idle state with versions panel and empty demo", () => {
  const store = createTwinPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.panel, TWIN_PANE_INITIAL_STATE.panel);
  assert.equal(state.snapshot, null);
  assert.equal(state.selectedVersionId, null);
  assert.equal(state.versionIndex, 0);
  assert.equal(state.compareBaseVersionId, null);
  assert.equal(state.compareTargetVersionId, null);
  assert.equal(state.compareMode, "delta");
  assert.equal(state.actionError, null);
  assert.equal(state.demo.active, false);
  assert.equal(state.demo.stepIndex, 0);
  assert.equal(state.demo.finished, false);
  assert.equal(state.demo.outcomes.length, 0);
});

test("load lifecycle: begin -> succeeded applies snapshot (empty twin state)", async () => {
  const store = createTwinPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = await loadFixtureSnapshot();
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.snapshot, snapshot);
  // 空 twin：无版本 → 选中/对比回退 null（空态可测）。
  assert.equal(state.selectedVersionId, null);
  assert.equal(state.versionIndex, 0);
  assert.equal(state.compareBaseVersionId, null);
  assert.equal(state.compareTargetVersionId, null);
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createTwinPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: twin studio is not loaded");
  const state = store.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "YOU_INVALID_STATE: twin studio is not loaded");
  // 恢复路径：重新 beginLoad 清除错误并回到 loading。
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().errorMessage, null);
});

test("loadSucceeded defaults selection to the latest version and compare to first vs latest", async () => {
  const store = createTwinPaneStore();
  const snapshot = await loadFixtureSnapshotWithVersion();
  assert.equal(snapshot.versions.length, 2);
  store.getState().loadSucceeded(snapshot);
  const state = store.getState();
  const latest = snapshot.versions.at(-1)!;
  assert.equal(state.selectedVersionId, latest.id);
  assert.equal(state.versionIndex, 1);
  assert.equal(state.compareBaseVersionId, snapshot.versions[0]!.id);
  assert.equal(state.compareTargetVersionId, latest.id);
});

test("action error is inline only: status stays ready and is dismissible", () => {
  const store = createTwinPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("boom");
  store.getState().beginLoad();
  store.getState().loadSucceeded({
    displayName: "Twin Studio — Aria",
    twinId: "fx-twin-001",
    versions: [],
    canonicalVersionId: null,
    supersededBy: {},
    evidenceRequests: [],
    consent: {
      policy: {
        id: "fx-twin-consent-001",
        purposes: ["solution-generation"],
        scope: "USER",
        operationalUse: false,
        learningReuse: false,
        retention: { policy: "delete-after-review", deleteAfter: null, reason: "fixture" },
        revocable: true,
      },
      purposeStates: [{ purpose: "solution-generation", state: "unknown" }],
      reference: { policyId: "fx-twin-consent-001", state: "unknown", learningPermission: false },
    },
    jobs: [],
    events: [],
    simulated: true,
  });
  store.getState().actionFailed("YOU_RECONSTRUCTION_UNSUPPORTED: unsupported combination");
  const failed = store.getState();
  assert.equal(failed.status, "ready");
  assert.equal(failed.actionError, "YOU_RECONSTRUCTION_UNSUPPORTED: unsupported combination");
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("version selection and keyboard cursor move together; Enter selection maps index -> id", async () => {
  const store = createTwinPaneStore();
  const snapshot = await loadFixtureSnapshotWithVersion();
  store.getState().loadSucceeded(snapshot);
  const [v1, v2] = snapshot.versions;

  // 光标移动即检视（键盘导航 = 一等交互路径）。
  store.getState().moveVersionIndex(-5);
  assert.equal(store.getState().versionIndex, 0);
  assert.equal(store.getState().selectedVersionId, v1!.id);
  store.getState().moveVersionIndex(1);
  assert.equal(store.getState().versionIndex, 1);
  assert.equal(store.getState().selectedVersionId, v2!.id);

  // 显式选中同步光标。
  store.getState().selectVersion(v1!.id);
  assert.equal(store.getState().versionIndex, 0);
  assert.equal(store.getState().selectedVersionId, v1!.id);
  store.getState().selectVersion(null);
  assert.equal(store.getState().selectedVersionId, null);
  assert.equal(store.getState().versionIndex, 0);
});

test("applySnapshot keeps still-existing selections; dropped ones fall back deterministically", async () => {
  const store = createTwinPaneStore();
  const controller = createSimulatedTwinStudioController();
  await controller.load({ workspaceKey: "ws" });
  await controller.publishFixtureVersion({});
  const first = await controller.refresh();
  store.getState().loadSucceeded(first);
  const v1 = first.versions[0]!;

  await controller.publishFixtureVersion({});
  const second = await controller.refresh();
  const v2 = second.versions.at(-1)!;

  // 选中 v1 仍然存在 → 保持（与 W2B capture store 同款语义：存在即保持）。
  store.getState().applySnapshot(second);
  assert.equal(store.getState().selectedVersionId, v1.id);
  assert.equal(store.getState().compareBaseVersionId, v1.id);
  assert.equal(store.getState().compareTargetVersionId, v1.id);

  // 伪造已消失的选中/对比对象 → 确定性回退：检视与对比目标回末位，基线回首版。
  store.getState().selectVersion("fx-twver-999");
  store.getState().setCompareBase("fx-twver-999");
  store.getState().setCompareTarget("fx-twver-999");
  store.getState().applySnapshot(second);
  assert.equal(store.getState().selectedVersionId, v2.id);
  assert.equal(store.getState().compareTargetVersionId, v2.id);
  assert.equal(store.getState().compareBaseVersionId, v1.id);
  assert.equal(store.getState().versionIndex, second.versions.length - 1);
});

test("compare base/target/mode transitions are independent view state", () => {
  const store = createTwinPaneStore();
  store.getState().setCompareBase("v-a");
  assert.equal(store.getState().compareBaseVersionId, "v-a");
  assert.equal(store.getState().compareTargetVersionId, null);
  store.getState().setCompareTarget("v-b");
  assert.equal(store.getState().compareTargetVersionId, "v-b");
  assert.equal(store.getState().compareBaseVersionId, "v-a");
  store.getState().setCompareMode("side-by-side");
  assert.equal(store.getState().compareMode, "side-by-side");
  store.getState().setCompareMode("delta");
  assert.equal(store.getState().compareMode, "delta");
  // setPanel 独立。
  store.getState().setPanel("quality");
  assert.equal(store.getState().panel, "quality");
});

test("demo state machine: started -> step recorded -> finished -> reset", () => {
  const store = createTwinPaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);

  const outcome = {
    stepId: "version-publish" as const,
    summary: "Candidate TwinVersion fx-twver-001 published",
    refs: ["fx-twver-001"],
    uiHint: { panel: "versions" as const },
  };
  store.getState().demoStepRecorded(outcome);
  const demo = store.getState().demo;
  assert.equal(demo.stepIndex, 1);
  assert.equal(demo.outcomes.length, 1);
  assert.deepEqual(demo.outcomes[0]!.refs, ["fx-twver-001"]);

  store.getState().demoFinished();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, true);
  assert.equal(store.getState().demo.outcomes.length, 1);

  store.getState().demoReset();
  const reset = store.getState().demo;
  assert.equal(reset.active, false);
  assert.equal(reset.stepIndex, 0);
  assert.equal(reset.finished, false);
  assert.equal(reset.outcomes.length, 0);
});
