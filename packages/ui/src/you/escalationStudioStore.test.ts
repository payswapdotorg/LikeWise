// W8B logic tests — 视图状态 store（node:test，无 DOM）。
//
// 覆盖：初始态、加载生命周期（begin → succeeded 应用快照 / failure 记录真实错误并
// 可恢复）、action error inline-only（status 保持 ready 且可关闭）、applySnapshot
// 保持仍存在的选中（被清除的回退末位）、升级光标与选中联动、授权草稿转移、
// policy 草稿转移、demo 状态机（started → step recorded → finished → reset）。
import assert from "node:assert/strict";
import test from "node:test";
import { createEscalationPaneStore, ESCALATION_PANE_INITIAL_STATE } from "./escalationStudioStore.js";
import type { EscalationStudioSnapshot } from "./escalationController.js";

function snapshotFixture(overrides: Partial<EscalationStudioSnapshot> = {}): EscalationStudioSnapshot {
  return {
    displayName: "Escalation Studio — Aria",
    studioId: "fx-escalation-studio-001",
    categories: ["TOOL_GAP", "EDITOR_GAP"],
    learningPermissions: ["none", "aggregate", "full"],
    scopePresets: ["solution:fx-portrait-001", "workspace:aria-studio"],
    backoffClasses: ["constant", "exponential-jitter"],
    retryPolicy: {
      maxAttempts: 3,
      backoffClass: "exponential-jitter",
      eligibilityCategories: ["TOOL_GAP"],
      requiresAuthorization: true,
    },
    providers: [
      {
        id: "fx-arena-provider-001",
        providerKind: "human-expert-panel",
        capabilityClasses: ["EXPERT_GAP"],
        endpointRef: null,
      },
    ],
    gapSpecs: [
      {
        id: "fx-gapspec-001",
        category: "TOOL_GAP",
        confidence: 0.82,
        suggestedNextAction: "Substitute.",
        strategyCount: 2,
        eligible: true,
      },
    ],
    gaps: [
      {
        id: "fx-gap-001",
        intentRef: null,
        attemptedStrategies: [{ strategy: "native-toolchain", outcome: "failed", evidenceRef: null }],
        failureEvidence: ["fx-content-001"],
        category: "TOOL_GAP",
        confidence: 0.82,
        suggestedNextAction: "Substitute.",
        escalationEligibility: "eligible",
        arenaEscalationRef: null,
      },
    ],
    runs: [],
    escalations: [
      {
        escalationId: "fx-escalation-001",
        gapId: "fx-gap-001",
        status: "requested",
        minimumContext: ["intent-reference"],
        expertResult: null,
        requiredScope: "solution:fx-portrait-001",
        createdAt: "2025-06-02T09:00:00.000Z",
        rejectionReason: null,
      },
    ],
    authorizationLedger: [],
    liveAuthorizations: [
      {
        escalationId: "fx-escalation-001",
        record: null,
        withdrawn: false,
        learningPermission: "none",
      },
    ],
    toolProjections: [],
    knowledgeProjections: [],
    events: [],
    projectedAt: "2025-06-02T09:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("store starts in idle state with gaps panel and empty demo", () => {
  const store = createEscalationPaneStore();
  assert.equal(store.getState().status, "idle");
  assert.equal(store.getState().panel, "gaps");
  assert.equal(store.getState().snapshot, null);
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.outcomes.length, 0);
  // 初始标量字段与导出的初始态字面量一致。
  assert.equal(store.getState().errorMessage, null);
  assert.equal(store.getState().actionError, null);
  assert.equal(store.getState().selectedGapId, null);
  assert.equal(store.getState().selectedEscalationId, null);
  assert.equal(store.getState().authorizationDraft.expiryPresetId, "no-expiry");
  assert.deepEqual(ESCALATION_PANE_INITIAL_STATE.authorizationDraft, {
    scope: null,
    expiryPresetId: "no-expiry",
    learningPermission: null,
  });
});

test("load lifecycle: begin -> succeeded applies snapshot with deterministic defaults", () => {
  const store = createEscalationPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  store.getState().loadSucceeded(snapshotFixture());
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().snapshot?.studioId, "fx-escalation-studio-001");
  // 默认检视末位 gap/升级；规格默认首项。
  assert.equal(store.getState().selectedGapId, "fx-gap-001");
  assert.equal(store.getState().selectedEscalationId, "fx-escalation-001");
  assert.equal(store.getState().selectedGapSpecId, "fx-gapspec-001");
});

test("load lifecycle: failure records a truthful error message and stays recoverable", () => {
  const store = createEscalationPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: escalation studio is not loaded");
  assert.equal(store.getState().status, "error");
  assert.equal(store.getState().errorMessage, "YOU_INVALID_STATE: escalation studio is not loaded");
  // 可恢复：再次 beginLoad 清空错误。
  store.getState().beginLoad();
  assert.equal(store.getState().errorMessage, null);
});

test("action error is inline only: status stays ready and is dismissible", () => {
  const store = createEscalationPaneStore();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().actionFailed({
    code: "YOU_ESCALATION_AUTHORIZATION_REQUIRED",
    message: "gate refused",
  });
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().actionError?.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("applySnapshot keeps still-existing selections; dropped ones fall back deterministically", () => {
  const store = createEscalationPaneStore();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().selectEscalation("fx-escalation-001");
  store.getState().setAuthorizationDraftScope("solution:fx-portrait-001");
  store.getState().setAuthorizationDraftPermission("aggregate");

  // 仍存在的选中保持；仍合法的草稿挑选保持。
  store.getState().applySnapshot(snapshotFixture());
  assert.equal(store.getState().selectedEscalationId, "fx-escalation-001");
  assert.equal(store.getState().authorizationDraft.scope, "solution:fx-portrait-001");
  assert.equal(store.getState().authorizationDraft.learningPermission, "aggregate");

  // 被清除的对象回退末位；不在注册面的草稿回退空。
  store.getState().applySnapshot(
    snapshotFixture({
      gaps: [],
      escalations: [],
      scopePresets: ["workspace:aria-studio"],
    }),
  );
  assert.equal(store.getState().selectedGapId, null);
  assert.equal(store.getState().selectedEscalationId, null);
  assert.equal(store.getState().authorizationDraft.scope, null);
  assert.equal(store.getState().authorizationDraft.learningPermission, "aggregate");
});

test("escalation cursor and selection move together; index maps to id", () => {
  const store = createEscalationPaneStore();
  const twoEscalations = snapshotFixture({
    escalations: [
      {
        escalationId: "fx-escalation-001",
        gapId: "fx-gap-001",
        status: "requested",
        minimumContext: [],
        expertResult: null,
        requiredScope: "solution:fx-portrait-001",
        createdAt: "2025-06-02T09:00:00.000Z",
        rejectionReason: null,
      },
      {
        escalationId: "fx-escalation-002",
        gapId: "fx-gap-001",
        status: "authorized",
        minimumContext: [],
        expertResult: null,
        requiredScope: "solution:fx-portrait-001",
        createdAt: "2025-06-02T09:00:01.000Z",
        rejectionReason: null,
      },
    ],
  });
  store.getState().loadSucceeded(twoEscalations);
  assert.equal(store.getState().escalationIndex, 1);
  assert.equal(store.getState().selectedEscalationId, "fx-escalation-002");

  store.getState().setEscalationIndex(0);
  assert.equal(store.getState().selectedEscalationId, "fx-escalation-001");
  store.getState().moveEscalationIndex(1);
  assert.equal(store.getState().escalationIndex, 1);
  assert.equal(store.getState().selectedEscalationId, "fx-escalation-002");
  // 夹紧：越界移动停在边界。
  store.getState().moveEscalationIndex(5);
  assert.equal(store.getState().escalationIndex, 1);
  store.getState().moveEscalationIndex(-9);
  assert.equal(store.getState().escalationIndex, 0);
  assert.equal(store.getState().selectedEscalationId, "fx-escalation-001");

  // selectEscalation 同步光标。
  store.getState().selectEscalation("fx-escalation-002");
  assert.equal(store.getState().escalationIndex, 1);
});

test("authorization draft transitions: scope, expiry preset, permission and reset", () => {
  const store = createEscalationPaneStore();
  assert.deepEqual(store.getState().authorizationDraft, {
    scope: null,
    expiryPresetId: "no-expiry",
    learningPermission: null,
  });
  store.getState().setAuthorizationDraftScope("solution:fx-portrait-001");
  store.getState().setAuthorizationDraftExpiry("past");
  store.getState().setAuthorizationDraftPermission("none");
  assert.deepEqual(store.getState().authorizationDraft, {
    scope: "solution:fx-portrait-001",
    expiryPresetId: "past",
    learningPermission: "none",
  });
  store.getState().resetAuthorizationDraft();
  assert.equal(store.getState().authorizationDraft.scope, null);
  assert.equal(store.getState().authorizationDraft.expiryPresetId, "no-expiry");
  assert.equal(store.getState().authorizationDraft.learningPermission, null);
});

test("policy draft transitions update the validator surface state", () => {
  const store = createEscalationPaneStore();
  assert.deepEqual(store.getState().policyDraft, {
    maxAttempts: 3,
    backoffClass: "exponential-jitter",
    requiresAuthorization: true,
  });
  store.getState().setPolicyDraftMaxAttempts(0);
  store.getState().setPolicyDraftBackoffClass("constant");
  store.getState().setPolicyDraftRequiresAuthorization(false);
  assert.deepEqual(store.getState().policyDraft, {
    maxAttempts: 0,
    backoffClass: "constant",
    requiresAuthorization: false,
  });
});

test("demo state machine: started -> step recorded -> finished -> reset", () => {
  const store = createEscalationPaneStore();
  store.getState().demoStarted();
  assert.equal(store.getState().demo.active, true);
  assert.equal(store.getState().demo.stepIndex, 0);
  store.getState().demoStepRecorded({
    stepId: "load",
    summary: "loaded",
    refs: [],
    uiHint: {},
  });
  assert.equal(store.getState().demo.stepIndex, 1);
  assert.equal(store.getState().demo.outcomes.length, 1);
  store.getState().demoFinished();
  assert.equal(store.getState().demo.active, false);
  assert.equal(store.getState().demo.finished, true);
  store.getState().demoReset();
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});

test("setPanel switches across the six W8B panels", () => {
  const store = createEscalationPaneStore();
  for (const panel of ["gaps", "gate", "progress", "results", "permissions", "demo"] as const) {
    store.getState().setPanel(panel);
    assert.equal(store.getState().panel, panel);
  }
});
