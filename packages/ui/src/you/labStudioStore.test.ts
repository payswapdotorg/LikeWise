// W9B logic tests — 视图状态 store（node:test，无 DOM）。
//
// 覆盖：初始态、加载生命周期（begin → succeeded 应用快照 / failure 记录真实错误并
// 可恢复）、action error inline-only（status 保持 ready 且可关闭）、applySnapshot
// 保持仍存在的选中（被清除的回退末位）、实验光标与选中联动、声明草稿转移
//（spec/世界/预算）、run 草稿臂挑选、manifest 完整性挑选、晋升草稿转移、
// demo 状态机（started → step recorded → finished → reset）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createLabPaneStore,
  LAB_PANE_INITIAL_STATE,
  LAB_PROMOTION_DRAFT_INITIAL,
  LAB_EXPERIMENT_DRAFT_INITIAL,
} from "./labStudioStore.js";
import type { LabStudioSnapshot } from "./labController.js";
import type { LabDemoStepOutcome, LabDemoStepId } from "./labStudioDemo.js";

function snapshotFixture(overrides: Partial<LabStudioSnapshot> = {}): LabStudioSnapshot {
  return {
    displayName: "Lab Studio — Aria",
    studioId: "fx-lab-studio-001",
    armKinds: ["generalist-baseline", "hand-designed", "searched"],
    runStatuses: ["submitted", "running", "succeeded", "failed", "retired"],
    experimentSpecs: [
      {
        id: "fx-labspec-001",
        intentRef: "fx-intent-portrait-001",
        objective: "Maximize the human-realism benchmark score.",
        constraintsHash: "sha256-fixture-abc",
        armScores: [
          { arm: "generalist-baseline", score: 0.62 },
          { arm: "hand-designed", score: 0.71 },
          { arm: "searched", score: 0.78 },
        ],
      },
    ],
    worldPresets: [
      { id: "world-alpha", seed: "you-w9b-world-alpha", actorCount: 4, valid: true },
      { id: "world-empty-seed", seed: "", actorCount: 4, valid: false },
    ],
    budgetPresets: [
      { id: "budget-standard", cumulativeBudget: 6, valid: true },
      { id: "budget-zero", cumulativeBudget: 0, valid: false },
    ],
    manifestIntegrities: ["honest", "tampered"],
    experiments: [
      {
        id: "fx-experiment-001",
        intentRef: "fx-intent-portrait-001",
        constraintsHash: "sha256-fixture-abc",
        objective: "Maximize the human-realism benchmark score.",
        arms: ["generalist-baseline", "hand-designed", "searched"],
        promotionRef: null,
        simulated: true,
      },
      {
        id: "fx-experiment-002",
        intentRef: "fx-intent-motion-001",
        constraintsHash: "sha256-fixture-def",
        objective: "Maximize motion-naturalness.",
        arms: ["generalist-baseline", "hand-designed", "searched"],
        promotionRef: null,
        simulated: true,
      },
    ],
    experimentContexts: [
      {
        experimentId: "fx-experiment-001",
        specId: "fx-labspec-001",
        world: {
          id: "fx-world-1",
          seed: "you-w9b-world-alpha",
          actorCount: 4,
          groundTruthRef: "fx-content-1",
          simulated: true,
        },
        searchBudget: 6,
        searchExhausted: false,
      },
      {
        experimentId: "fx-experiment-002",
        specId: "fx-labspec-001",
        world: {
          id: "fx-world-1",
          seed: "you-w9b-world-alpha",
          actorCount: 4,
          groundTruthRef: "fx-content-1",
          simulated: true,
        },
        searchBudget: 1,
        searchExhausted: true,
      },
    ],
    runs: [
      {
        id: "fx-run-001",
        experimentId: "fx-experiment-001",
        arm: "searched",
        planHash: "sha256-fixture-plan-1",
        status: "succeeded",
        submittedAt: "2025-06-02T09:00:01.000Z",
        completedAt: "2025-06-02T09:00:03.000Z",
        evidenceManifestRef: "fx-manifest-001",
        simulated: true,
      },
      {
        id: "fx-run-002",
        experimentId: "fx-experiment-002",
        arm: "generalist-baseline",
        planHash: "sha256-fixture-plan-2",
        status: "submitted",
        submittedAt: "2025-06-02T09:00:04.000Z",
        completedAt: null,
        evidenceManifestRef: null,
        simulated: true,
      },
    ],
    manifests: [
      {
        manifest: {
          id: "fx-manifest-001",
          runId: "fx-run-001",
          contentHash: "sha256-fixture-manifest-1",
          artifactRefs: ["fx-content-a1", "fx-content-a2"],
          publishedAt: "2025-06-02T09:00:05.000Z",
          simulated: true,
        },
        verification: "verified",
        verifiedAt: "2025-06-02T09:00:06.000Z",
      },
    ],
    promotionLedger: [],
    armScores: [
      {
        experimentId: "fx-experiment-001",
        arm: "searched",
        score: 0.78,
        runCount: 1,
        succeededCount: 1,
        bestRunId: "fx-run-001",
        evidenceManifestId: "fx-manifest-001",
        simulated: true,
      },
    ],
    worlds: [],
    searchLadder: [],
    events: [],
    projectedAt: "2025-06-02T09:00:07.000Z",
    simulated: true,
    ...overrides,
  };
}

function demoOutcomeFixture(stepId: LabDemoStepId): LabDemoStepOutcome {
  return { stepId, summary: `summary ${stepId}`, refs: [], uiHint: {} };
}

test("initial state is idle with empty drafts and no action error", () => {
  const store = createLabPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.snapshot, null);
  assert.equal(state.errorMessage, null);
  assert.equal(state.actionError, null);
  assert.equal(state.panel, "experiments");
  assert.equal(state.selectedExperimentId, null);
  assert.equal(state.experimentIndex, 0);
  assert.equal(state.selectedSpecId, null);
  assert.equal(state.worldPresetDraftId, LAB_EXPERIMENT_DRAFT_INITIAL.worldPresetId);
  assert.equal(state.budgetPresetDraftId, LAB_EXPERIMENT_DRAFT_INITIAL.budgetPresetId);
  assert.deepEqual(state.promotionDraft, LAB_PROMOTION_DRAFT_INITIAL);
  assert.deepEqual(state.demo, { active: false, stepIndex: 0, finished: false, outcomes: [] });
});

test("load lifecycle: begin → succeeded applies the snapshot and selects the latest records", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  store.getState().loadSucceeded(snapshotFixture());
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.errorMessage, null);
  // 默认检视追加序末位：最新实验 / 最新 run / 最新 manifest。
  assert.equal(state.selectedExperimentId, "fx-experiment-002");
  assert.equal(state.experimentIndex, 1);
  assert.equal(state.selectedRunId, "fx-run-002");
  assert.equal(state.selectedManifestId, "fx-manifest-001");
  assert.equal(state.selectedSpecId, "fx-labspec-001");
  assert.equal(state.promotionDraft.evidenceManifestId, "fx-manifest-001");
});

test("load failure records the truthful message and recovers on retry", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: lab studio is not loaded");
  const failed = store.getState();
  assert.equal(failed.status, "error");
  assert.equal(failed.errorMessage, "YOU_INVALID_STATE: lab studio is not loaded");
  // 恢复：重试成功后回到 ready 并清空错误。
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().errorMessage, null);
});

test("action errors are inline-only: status stays ready and can be dismissed", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().actionFailed({ code: "YOU_LAB_PROMOTION_INVALID", message: "no-improvement" });
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.deepEqual(state.actionError, {
    code: "YOU_LAB_PROMOTION_INVALID",
    message: "no-improvement",
  });
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("applySnapshot keeps still-existing selections and falls back to the latest otherwise", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().selectExperiment("fx-experiment-001");
  store.getState().selectRun("fx-run-001");

  // 快照仍含既有选择 → 保持。
  const next = snapshotFixture();
  store.getState().applySnapshot(next);
  assert.equal(store.getState().selectedExperimentId, "fx-experiment-001");
  assert.equal(store.getState().selectedRunId, "fx-run-001");

  // 选择被清除 → 回退末位。
  const shrunk = snapshotFixture({
    experiments: next.experiments.slice(0, 1),
    experimentContexts: next.experimentContexts.slice(0, 1),
    runs: next.runs.slice(0, 1),
    manifests: [],
    armScores: [],
  });
  store.getState().applySnapshot(shrunk);
  assert.equal(store.getState().selectedExperimentId, "fx-experiment-001");
  assert.equal(store.getState().selectedRunId, "fx-run-001");
  assert.equal(store.getState().selectedManifestId, null);
  assert.equal(store.getState().promotionDraft.evidenceManifestId, null);

  // 预设草稿不在注册面 → 回退初始预设。
  const presetShrunk = snapshotFixture({
    worldPresets: [{ id: "world-beta", seed: "s", actorCount: 2, valid: true }],
    budgetPresets: [{ id: "budget-tight", cumulativeBudget: 1, valid: true }],
  });
  store.getState().applySnapshot(presetShrunk);
  assert.equal(store.getState().worldPresetDraftId, LAB_EXPERIMENT_DRAFT_INITIAL.worldPresetId);
  assert.equal(store.getState().budgetPresetDraftId, LAB_EXPERIMENT_DRAFT_INITIAL.budgetPresetId);
});

test("experiment cursor moves in lockstep with the selection (keyboard is a first-class path)", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().setExperimentIndex(0);
  assert.equal(store.getState().selectedExperimentId, "fx-experiment-001");
  store.getState().moveExperimentIndex(1);
  assert.equal(store.getState().experimentIndex, 1);
  assert.equal(store.getState().selectedExperimentId, "fx-experiment-002");
  // 越界夹紧（clamp 在 [0, total-1]）。
  store.getState().moveExperimentIndex(99);
  assert.equal(store.getState().experimentIndex, 1);
  assert.equal(store.getState().selectedExperimentId, "fx-experiment-002");
  store.getState().moveExperimentIndex(-99);
  assert.equal(store.getState().experimentIndex, 0);
  assert.equal(store.getState().selectedExperimentId, "fx-experiment-001");
  // 直接选中同步光标。
  store.getState().selectExperiment("fx-experiment-002");
  assert.equal(store.getState().experimentIndex, 1);
  // null 选中归零光标（列表为空的防御语义）。
  store.getState().selectExperiment(null);
  assert.equal(store.getState().experimentIndex, 0);
  assert.equal(store.getState().selectedExperimentId, null);
});

test("declaration draft transfers: spec, world preset, budget preset and reset", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().selectSpec("fx-labspec-001");
  store.getState().setDraftWorldPreset("world-empty-seed");
  store.getState().setDraftBudgetPreset("budget-zero");
  assert.equal(store.getState().selectedSpecId, "fx-labspec-001");
  assert.equal(store.getState().worldPresetDraftId, "world-empty-seed");
  assert.equal(store.getState().budgetPresetDraftId, "budget-zero");
  store.getState().resetExperimentDraft();
  assert.equal(store.getState().worldPresetDraftId, "world-alpha");
  assert.equal(store.getState().budgetPresetDraftId, "budget-standard");
  assert.equal(store.getState().selectedSpecId, "fx-labspec-001");
});

test("run draft, manifest integrity and promotion draft transfer", () => {
  const store = createLabPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().setRunDraftArm("generalist-baseline");
  assert.equal(store.getState().runDraftArm, "generalist-baseline");
  store.getState().setManifestIntegrity("tampered");
  assert.equal(store.getState().manifestIntegrity, "tampered");
  store.getState().setPromotionCandidateArm("generalist-baseline");
  store.getState().setPromotionEvidence("fx-manifest-001");
  assert.deepEqual(store.getState().promotionDraft, {
    candidateArm: "generalist-baseline",
    evidenceManifestId: "fx-manifest-001",
  });
  store.getState().resetPromotionDraft();
  // 重置回 searched + 最新 manifest。
  assert.deepEqual(store.getState().promotionDraft, {
    candidateArm: "searched",
    evidenceManifestId: "fx-manifest-001",
  });
});

test("demo state machine: started → step recorded → finished → reset", () => {
  const store = createLabPaneStore();
  store.getState().demoStarted();
  assert.deepEqual(store.getState().demo, {
    active: true,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
  store.getState().demoStepRecorded(demoOutcomeFixture("load"));
  store.getState().demoStepRecorded(demoOutcomeFixture("world-invalid"));
  const mid = store.getState().demo;
  assert.equal(mid.stepIndex, 2);
  assert.equal(mid.outcomes.length, 2);
  assert.ok(mid.active);
  store.getState().demoFinished();
  const finished = store.getState().demo;
  assert.equal(finished.active, false);
  assert.equal(finished.finished, true);
  assert.equal(finished.outcomes.length, 2);
  store.getState().demoReset();
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});

test("initial state matches the frozen shape exported for parity checks", () => {
  const store = createLabPaneStore();
  for (const [key, value] of Object.entries(LAB_PANE_INITIAL_STATE)) {
    assert.deepEqual(
      (store.getState() as unknown as Record<string, unknown>)[key],
      value,
      `initial state drift at key ${key}`,
    );
  }
});
