// W10B logic tests — 视图状态 store（node:test，无 DOM）。
//
// 覆盖：初始态、加载生命周期（begin → succeeded 应用快照 / failure 记录真实错误并
// 可恢复）、action error inline-only（status 保持 ready 且可关闭）、applySnapshot
// 保持仍存在的选中（被清除的回退末位）、enforcement 光标与选中联动、各平面草稿
// 转移（policy / artifact+scanClass / subject+class / snapshot+integrity /
// matrix+evidence+eligible intent）、demo 状态机（started → step recorded →
// finished → reset）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  createHardeningPaneStore,
  HARDENING_PANE_INITIAL_STATE,
} from "./hardeningStudioStore.js";
import type { HardeningStudioSnapshot } from "./hardeningController.js";
import type {
  HardeningDemoStepOutcome,
  HardeningDemoStepId,
} from "./hardeningStudioDemo.js";

function snapshotFixture(
  overrides: Partial<HardeningStudioSnapshot> = {},
): HardeningStudioSnapshot {
  return {
    displayName: "Hardening Studio — Aria",
    studioId: "fx-hardening-studio-001",
    rateLimitActions: ["deny", "defer", "shed"],
    importVerdicts: ["clean", "quarantined", "rejected"],
    consentStates: ["unknown", "granted", "denied", "expired", "withdrawn"],
    policies: [
      {
        id: "policy-render-submit",
        scope: "render.submit",
        windowS: 60,
        burst: 3,
        action: "deny",
        simulated: true,
      },
    ],
    scanClasses: [
      { id: "scan-class-media-upload", scanClass: "media-upload", valid: true },
    ],
    importArtifacts: [
      { id: "import-artifact-portrait", artifactRef: "fx-content-aaa", artifactKey: "portrait" },
    ],
    retentionClasses: [
      { id: "retention-class-evidence-raw", retentionClass: "evidence-raw", windowLabel: "90d" },
    ],
    retentionSubjects: [
      {
        id: "subject-evidence-granted",
        subjectRef: "fx-subject-001",
        consentState: "granted",
        consentProtected: true,
      },
    ],
    drSnapshots: [
      {
        id: "dr-snapshot-primary",
        snapshotRef: "fx-snapshot-001",
        expectedHash: "sha256-fixture-abc",
      },
    ],
    drIntegrities: ["honest", "corrupted"],
    matrixEntries: [
      {
        id: "matrix-render-eu",
        matrixRef: "fx-matrix-render-eu",
        providerKind: "render",
        region: "eu-central",
        capabilityClasses: ["render"],
        eligible: true,
        valid: true,
      },
    ],
    rollbackEvidence: [
      { id: "rollback-drill-render-eu", evidenceRef: "fx-rollback-001", present: true },
      { id: "rollback-evidence-none", evidenceRef: "fx-rollback-none", present: false },
    ],
    enforcements: [
      {
        id: "fx-h-enf-001",
        policyId: "policy-render-submit",
        scope: "render.submit",
        action: "deny",
        windowS: 60,
        burst: 3,
        retryAfterS: 60,
        enforcedAt: "2025-06-02T09:00:10.000Z",
        simulated: true,
      },
      {
        id: "fx-h-enf-002",
        policyId: "policy-render-submit",
        scope: "render.submit",
        action: "deny",
        windowS: 60,
        burst: 3,
        retryAfterS: 59,
        enforcedAt: "2025-06-02T09:00:20.000Z",
        simulated: true,
      },
    ],
    importVerdictRecords: [
      {
        verdict: {
          id: "fx-h-verdict-001",
          artifactRef: "fx-content-aaa",
          scanClass: "media-upload",
          verdict: "clean",
          quarantinedAt: null,
          simulated: true,
        },
        releaseRecordId: null,
        releasedAt: null,
      },
    ],
    importReleases: [],
    retentionRecords: [
      {
        id: "fx-h-retention-001",
        retentionClass: "evidence-raw",
        subjectRef: "fx-subject-002",
        enforcedAt: "2025-06-02T09:01:00.000Z",
        simulated: true,
      },
    ],
    drRestores: [
      {
        record: {
          id: "fx-h-restore-001",
          snapshotRef: "fx-snapshot-001",
          restoredAt: "2025-06-02T09:02:00.000Z",
          verified: true,
          simulated: true,
        },
        verification: "verified",
        checkHash: "sha256-fixture-abc",
      },
    ],
    eligibilityLedger: [
      {
        record: {
          id: "fx-h-eligibility-001",
          subjectRef: "fx-matrix-render-eu",
          eligible: true,
          rollbackEvidenceRef: "fx-rollback-001",
          decidedAt: "2025-06-02T09:03:00.000Z",
          simulated: true,
        },
        kind: "decision",
        supersedesRecordId: null,
      },
    ],
    events: [],
    projectedAt: "2025-06-02T09:04:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("initial state is idle with the defaults of every plane draft", () => {
  const store = createHardeningPaneStore();
  const state = store.getState();
  assert.equal(state.status, "idle");
  assert.equal(state.snapshot, null);
  assert.equal(state.panel, HARDENING_PANE_INITIAL_STATE.panel);
  assert.equal(state.actionError, null);
  assert.equal(state.limitDraftPolicyId, "policy-render-submit");
  assert.equal(state.importDraftArtifactId, "import-artifact-portrait");
  assert.equal(state.importDraftScanClassId, "scan-class-media-upload");
  assert.equal(state.retentionDraftSubjectId, "subject-evidence-granted");
  assert.equal(state.retentionDraftClassId, "retention-class-evidence-raw");
  assert.equal(state.drDraftSnapshotId, "dr-snapshot-primary");
  assert.equal(state.drIntegrity, "honest");
  assert.equal(state.releaseDraftMatrixId, "matrix-render-eu");
  assert.equal(state.releaseDraftEvidenceId, "rollback-evidence-none");
  assert.equal(state.releaseDraftEligible, true);
  assert.deepEqual(state.demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});

test("load lifecycle: begin -> succeeded applies the snapshot and selects the latest records", () => {
  const store = createHardeningPaneStore();
  store.getState().beginLoad();
  assert.equal(store.getState().status, "loading");
  store.getState().loadSucceeded(snapshotFixture());
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.equal(state.errorMessage, null);
  assert.equal(state.snapshot?.studioId, "fx-hardening-studio-001");
  // 加载后默认检视末位记录（确定性）。
  assert.equal(state.selectedEnforcementId, "fx-h-enf-002");
  assert.equal(state.enforcementIndex, 1);
  assert.equal(state.selectedImportVerdictId, "fx-h-verdict-001");
  assert.equal(state.selectedRetentionRecordId, "fx-h-retention-001");
  assert.equal(state.selectedDrRestoreId, "fx-h-restore-001");
  assert.equal(state.selectedEligibilityRecordId, "fx-h-eligibility-001");
});

test("load failure records the truthful message and stays recoverable", () => {
  const store = createHardeningPaneStore();
  store.getState().beginLoad();
  store.getState().loadFailed("YOU_INVALID_STATE: boom");
  const state = store.getState();
  assert.equal(state.status, "error");
  assert.equal(state.errorMessage, "YOU_INVALID_STATE: boom");
  // 恢复：重新加载成功后错误清空。
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().errorMessage, null);
});

test("action errors are inline-only: status stays ready and dismissible", () => {
  const store = createHardeningPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().actionFailed({
    code: "YOU_RATE_LIMIT_EXCEEDED",
    message: "rate limit exceeded on render.submit",
  });
  const state = store.getState();
  assert.equal(state.status, "ready");
  assert.deepEqual(state.actionError, {
    code: "YOU_RATE_LIMIT_EXCEEDED",
    message: "rate limit exceeded on render.submit",
  });
  store.getState().clearActionError();
  assert.equal(store.getState().actionError, null);
});

test("applySnapshot keeps live selections and falls back to the tail for vanished ones", () => {
  const store = createHardeningPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().selectEnforcement("fx-h-enf-001");
  store.getState().selectImportVerdict("fx-h-verdict-001");
  // 快照刷新：enforcement 001 消失 → 回退末位；其余保持。
  const refreshed = snapshotFixture({
    enforcements: [
      {
        id: "fx-h-enf-003",
        policyId: "policy-render-submit",
        scope: "render.submit",
        action: "shed",
        windowS: 30,
        burst: 1,
        retryAfterS: 30,
        enforcedAt: "2025-06-02T09:05:00.000Z",
        simulated: true,
      },
    ],
  });
  store.getState().applySnapshot(refreshed);
  const state = store.getState();
  assert.equal(state.selectedEnforcementId, "fx-h-enf-003");
  assert.equal(state.enforcementIndex, 0);
  assert.equal(state.selectedImportVerdictId, "fx-h-verdict-001");
  // 草稿挑选保持仍合法的值；注册面消失时回退初始。
  store.getState().setLimitDraftPolicy("policy-import-scan");
  store.getState().applySnapshot(
    snapshotFixture({
      policies: [
        {
          id: "policy-import-scan",
          scope: "import.scan",
          windowS: 300,
          burst: 2,
          action: "defer",
          simulated: true,
        },
      ],
    }),
  );
  assert.equal(store.getState().limitDraftPolicyId, "policy-import-scan");
  store.getState().applySnapshot(snapshotFixture());
  assert.equal(store.getState().limitDraftPolicyId, "policy-render-submit");
});

test("enforcement cursor and selection move together (keyboard is first-class)", () => {
  const store = createHardeningPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().moveEnforcementIndex(-1);
  assert.equal(store.getState().enforcementIndex, 0);
  assert.equal(store.getState().selectedEnforcementId, "fx-h-enf-001");
  store.getState().moveEnforcementIndex(1);
  assert.equal(store.getState().enforcementIndex, 1);
  assert.equal(store.getState().selectedEnforcementId, "fx-h-enf-002");
  // 越界夹紧。
  store.getState().moveEnforcementIndex(5);
  assert.equal(store.getState().enforcementIndex, 1);
  store.getState().setEnforcementIndex(0);
  assert.equal(store.getState().selectedEnforcementId, "fx-h-enf-001");
});

test("every plane draft transition is a pure setter round-trip", () => {
  const store = createHardeningPaneStore();
  store.getState().beginLoad();
  store.getState().loadSucceeded(snapshotFixture());
  store.getState().setImportDraftArtifact("import-artifact-portrait");
  store.getState().setImportDraftScanClass("scan-class-media-upload");
  store.getState().selectImportVerdict("fx-h-verdict-001");
  store.getState().setRetentionDraftSubject("subject-evidence-granted");
  store.getState().setRetentionDraftClass("retention-class-evidence-raw");
  store.getState().selectRetentionRecord("fx-h-retention-001");
  store.getState().setDrDraftSnapshot("dr-snapshot-primary");
  store.getState().setDrIntegrity("corrupted");
  store.getState().selectDrRestore("fx-h-restore-001");
  store.getState().setReleaseDraftMatrix("matrix-render-eu");
  store.getState().setReleaseDraftEvidence("rollback-drill-render-eu");
  store.getState().setReleaseDraftEligible(false);
  store.getState().selectEligibilityRecord("fx-h-eligibility-001");
  store.getState().setPanel("release");
  const state = store.getState();
  assert.equal(state.importDraftScanClassId, "scan-class-media-upload");
  assert.equal(state.drIntegrity, "corrupted");
  assert.equal(state.releaseDraftEligible, false);
  assert.equal(state.releaseDraftEvidenceId, "rollback-drill-render-eu");
  assert.equal(state.panel, "release");
});

test("demo state machine: started -> step recorded -> finished -> reset", () => {
  const store = createHardeningPaneStore();
  store.getState().demoStarted();
  assert.deepEqual(store.getState().demo, {
    active: true,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
  const first: HardeningDemoStepOutcome = {
    stepId: "load" as HardeningDemoStepId,
    summary: "Hardening plane loaded",
    refs: [],
    uiHint: { panel: "limits" },
  };
  store.getState().demoStepRecorded(first);
  const state = store.getState();
  assert.equal(state.demo.stepIndex, 1);
  assert.equal(state.demo.outcomes.length, 1);
  assert.equal(state.demo.active, true);
  store.getState().demoFinished();
  assert.equal(store.getState().demo.finished, true);
  assert.equal(store.getState().demo.active, false);
  store.getState().demoReset();
  assert.deepEqual(store.getState().demo, {
    active: false,
    stepIndex: 0,
    finished: false,
    outcomes: [],
  });
});
