// W12B logic tests — 视图状态 store（node:test，无 DOM）。
//
// 覆盖：初始态、加载生命周期（begin → succeeded 应用快照 / failure 记录真实错误并
// 可恢复）、action error inline-only（status 保持 ready 且可关闭）、applySnapshot
// 保持仍存在的选中（被清除的回退末位）、checklist 光标与选中联动、各平面草稿转移
//（journey / operator / bundle / rollback）、demo 状态机（started → step recorded
// → finished → reset）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createReleasePaneStore,
  RELEASE_PANE_INITIAL_STATE,
} from "./releaseStudioStore.js";
import type { ReleaseStudioSnapshot } from "./releaseController.js";
import type {
  ReleaseDemoStepOutcome,
  ReleaseDemoStepId,
} from "./releaseStudioDemo.js";

function snapshotFixture(
  overrides: Partial<ReleaseStudioSnapshot> = {},
): ReleaseStudioSnapshot {
  return {
    displayName: "Release Studio — Aria",
    studioId: "fx-release-studio-001",
    journeys: [
      {
        id: "journey-gate-golden",
        journeyId: "launch-gate-001",
        steps: [
          "workspace-create",
          "intent-capture",
          "solution-open",
          "solution-inspect",
        ],
        evidenceSteps: 4,
        valid: true,
      },
      {
        id: "journey-gate-partial",
        journeyId: "launch-gate-partial-016",
        steps: [
          "workspace-create",
          "intent-capture",
          "solution-open",
          "solution-inspect",
        ],
        evidenceSteps: 2,
        valid: true,
      },
    ],
    operators: [
      {
        id: "operator-aria",
        operatorRef: "fx-content-operator-aria",
        displayName: "Aria (release operator)",
        valid: true,
      },
    ],
    evidenceBundles: [
      {
        id: "bundle-golden-journey-set",
        bundleRef: "fx-content-bundle-golden",
        journeyCount: 21,
        valid: true,
      },
    ],
    rollbackEvidence: [
      {
        id: "rollback-dr-verified",
        rollbackRef: "fx-content-rollback-dr",
        drill: "DR restore verified from the secondary snapshot",
        valid: true,
      },
    ],
    checklists: [
      {
        id: "fx-r-checklist-001",
        points: [
          {
            point: 1,
            description: "a workspace is created and the journey begins",
            journeyEvidenceRef: "fx-content-step-1",
            passed: true,
          },
          {
            point: 2,
            description: "the user intent is captured with constraints and acceptance criteria",
            journeyEvidenceRef: "fx-content-step-2",
            passed: true,
          },
        ],
        checkedAt: "2025-06-02T09:00:01.000Z",
        simulated: true,
      },
      {
        id: "fx-r-checklist-002",
        points: [
          {
            point: 1,
            description: "a workspace is created and the journey begins",
            journeyEvidenceRef: "fx-content-step-1",
            passed: true,
          },
          {
            point: 2,
            description: "the user intent is captured with constraints and acceptance criteria",
            journeyEvidenceRef: null,
            passed: false,
          },
        ],
        checkedAt: "2025-06-02T09:00:02.000Z",
        simulated: true,
      },
    ],
    signoffs: [
      {
        id: "fx-r-signoff-001",
        checklistRef: "fx-r-checklist-001",
        signedBy: "fx-content-operator-aria",
        signedAt: "2025-06-02T09:00:03.000Z",
        simulated: true,
      },
    ],
    declarations: [
      {
        id: "fx-r-declaration-001",
        signoffRef: "fx-r-signoff-001",
        evidenceBundleRef: "fx-content-bundle-golden",
        rollbackEvidenceRef: "fx-content-rollback-dr",
        declaredAt: "2025-06-02T09:00:04.000Z",
        simulated: true,
      },
    ],
    events: [],
    projectedAt: "2025-06-02T09:00:05.000Z",
    simulated: true,
    ...overrides,
  };
}

function demoOutcomeFixture(
  stepId: ReleaseDemoStepId,
  overrides: Partial<ReleaseDemoStepOutcome> = {},
): ReleaseDemoStepOutcome {
  return {
    stepId,
    summary: `summary-${stepId}`,
    refs: [],
    uiHint: {},
    ...overrides,
  };
}

test("initial state is idle with the W12B default drafts and no selection", () => {
  const store = createReleasePaneStore();
  assert.equal(store.getState().status, "idle");
  assert.equal(store.getState().panel, "checklist");
  assert.equal(store.getState().snapshot, null);
  assert.equal(store.getState().errorMessage, null);
  assert.equal(store.getState().actionError, null);
  assert.equal(store.getState().checklistDraftJourneyId, "journey-gate-golden");
  assert.equal(store.getState().selectedChecklistId, null);
  assert.equal(store.getState().checklistIndex, 0);
  assert.equal(store.getState().signoffDraftOperatorId, "operator-aria");
  assert.equal(store.getState().selectedSignoffId, null);
  assert.equal(
    store.getState().declarationDraftEvidenceBundleId,
    "bundle-golden-journey-set",
  );
  assert.equal(
    store.getState().declarationDraftRollbackEvidenceId,
    "rollback-dr-verified",
  );
  assert.equal(store.getState().selectedDeclarationId, null);
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});

test("load lifecycle: begin → succeeded applies the snapshot and selects the latest records", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");

  const snapshot = snapshotFixture();
  store.getState().loadSucceeded(snapshot);
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().errorMessage, null);
  assert.equal(store.getState().snapshot, snapshot);
  // 默认检视末位记录（确定性：id 升序末位）。
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-002");
  assert.equal(store.getState().checklistIndex, 1);
  assert.equal(store.getState().selectedSignoffId, "fx-r-signoff-001");
  assert.equal(store.getState().selectedDeclarationId, "fx-r-declaration-001");
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: release studio is not loaded");
  assert.equal(store.getState().status, "error");
  assert.equal(
    store.getState().errorMessage,
    "YOU_INVALID_STATE: release studio is not loaded",
  );
  // 恢复路径：再次 beginLoad 清错误并回到 loading。
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  assert.equal(store.getState().errorMessage, null);
});

test("action error is inline only: status stays ready and is dismissible", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().actionFailed({
    code: "YOU_OPERATOR_SIGNOFF_INVALID",
    message: "checklist fx-r-checklist-002 has not passed the gate",
  });
  // inline-only：status 保持 ready（表面不整体失败；truthful 错误呈现）。
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().actionError?.code, "YOU_OPERATOR_SIGNOFF_INVALID");
  assert.equal(
    store.getState().actionError?.message,
    "checklist fx-r-checklist-002 has not passed the gate",
  );
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("applySnapshot keeps still-existing selections; dropped ones fall back deterministically", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  const first = snapshotFixture();
  store.getState().loadSucceeded(first);
  store.getState().selectChecklist("fx-r-checklist-001");
  assert.equal(store.getState().checklistIndex, 0);

  // 选中仍存在：保持。
  const second = snapshotFixture();
  store.getState().applySnapshot(second);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-001");
  assert.equal(store.getState().checklistIndex, 0);
  assert.equal(store.getState().selectedSignoffId, "fx-r-signoff-001");
  assert.equal(store.getState().selectedDeclarationId, "fx-r-declaration-001");

  // 选中被清除：回退末位（确定性）。
  const third = snapshotFixture({
    checklists: first.checklists.slice(0, 1),
    signoffs: [],
    declarations: [],
  });
  store.getState().applySnapshot(third);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-001");
  assert.equal(store.getState().selectedSignoffId, null);
  assert.equal(store.getState().selectedDeclarationId, null);
});

test("checklist cursor and selection move together; index clamps at the list bounds", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  assert.equal(store.getState().checklistIndex, 1);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-002");

  store.getState().moveChecklistIndex(-1);
  assert.equal(store.getState().checklistIndex, 0);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-001");

  store.getState().moveChecklistIndex(-5);
  assert.equal(store.getState().checklistIndex, 0);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-001");

  store.getState().moveChecklistIndex(99);
  assert.equal(store.getState().checklistIndex, 1);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-002");

  store.getState().selectChecklist("fx-r-checklist-001");
  assert.equal(store.getState().checklistIndex, 0);

  store.getState().setChecklistIndex(1);
  assert.equal(store.getState().checklistIndex, 1);
  assert.equal(store.getState().selectedChecklistId, "fx-r-checklist-002");
});

test("panel and per-plane draft transitions are independent view state", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());

  store.getState().setPanel("signoff");
  assert.equal(store.getState().panel, "signoff");
  assert.equal(store.getState().checklistDraftJourneyId, "journey-gate-golden");

  store.getState().setChecklistDraftJourney("journey-gate-partial");
  assert.equal(store.getState().checklistDraftJourneyId, "journey-gate-partial");
  assert.equal(store.getState().signoffDraftOperatorId, "operator-aria");

  store.getState().setSignoffDraftOperator("operator-unknown-legacy");
  assert.equal(store.getState().signoffDraftOperatorId, "operator-unknown-legacy");

  store.getState().setDeclarationDraftEvidenceBundle("bundle-empty");
  assert.equal(store.getState().declarationDraftEvidenceBundleId, "bundle-empty");
  assert.equal(
    store.getState().declarationDraftRollbackEvidenceId,
    "rollback-dr-verified",
  );

  store.getState().setDeclarationDraftRollbackEvidence("rollback-unregistered");
  assert.equal(
    store.getState().declarationDraftRollbackEvidenceId,
    "rollback-unregistered",
  );

  store.getState().selectSignoff("fx-r-signoff-001");
  assert.equal(store.getState().selectedSignoffId, "fx-r-signoff-001");
  store.getState().selectDeclaration("fx-r-declaration-001");
  assert.equal(store.getState().selectedDeclarationId, "fx-r-declaration-001");
  store.getState().selectChecklist(null);
  assert.equal(store.getState().selectedChecklistId, null);
  assert.equal(store.getState().checklistIndex, 0);
});

test("drafts fall back to initial defaults when the registry drops them in a snapshot", () => {
  const store = createReleasePaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().setChecklistDraftJourney("journey-gate-partial");
  store.getState().setSignoffDraftOperator("operator-unknown-legacy");
  store.getState().setDeclarationDraftEvidenceBundle("bundle-empty");
  store.getState().setDeclarationDraftRollbackEvidence("rollback-unregistered");

  // 注册面缺失全部草稿项：回退初始缺省（注册面事实驱动，不猜测）。
  const trimmed = snapshotFixture({
    journeys: snapshotFixture().journeys.slice(0, 1),
    operators: [],
    evidenceBundles: [],
    rollbackEvidence: [],
  });
  store.getState().applySnapshot(trimmed);
  assert.equal(store.getState().checklistDraftJourneyId, "journey-gate-golden");
  assert.equal(store.getState().signoffDraftOperatorId, "operator-aria");
  assert.equal(
    store.getState().declarationDraftEvidenceBundleId,
    "bundle-golden-journey-set",
  );
  assert.equal(
    store.getState().declarationDraftRollbackEvidenceId,
    "rollback-dr-verified",
  );
});

test("demo state machine: started -> step recorded -> finished -> reset", () => {
  const store = createReleasePaneStore();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, false);

  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);
  assert.equal(store.getState().demo.outcomes.length, 0);

  store.getState().demoStepRecorded(
    demoOutcomeFixture("load", { summary: "step-1" }),
  );
  assert.equal(store.getState().demo.stepIndex, 1);
  assert.deepEqual(
    store.getState().demo.outcomes.map((outcome) => outcome.stepId),
    ["load"],
  );

  store.getState().demoStepRecorded(
    demoOutcomeFixture("checklist-partial", { summary: "step-2" }),
  );
  assert.equal(store.getState().demo.stepIndex, 2);

  store.getState().demoFinished();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, true);
  // finished 后 outcomes 保留（终态复盘显示面）。
  assert.equal(store.getState().demo.outcomes.length, 2);

  store.getState().demoReset();
  assert.deepEqual(store.getState().demo, RELEASE_PANE_INITIAL_STATE.demo);
});
