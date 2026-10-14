// W10B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：enforcement 行（deny/defer/shed + window + retry 指引 + retry 档位）、
// import verdict 行（scan class + verdict + release 链接）、retention 行、
// DR restore 的 verification 从事件流 check evidence 派生（无证据 ⇒ unverified
// ——DR LAW 显示面）、eligibility 账本行（supersedes + rollback evidence 链接 +
// present 判定）、区域视图模型、键盘转移与光标夹紧、各平面草稿视图。
import assert from "node:assert/strict";
import test from "node:test";
import type { DrRestoreRecord, SolutionEvent } from "@zcode/shared";
import {
  clampHardeningIndex,
  projectDrDraftView,
  projectDrRestoreRows,
  projectDrRestoreVerification,
  projectEligibilityRows,
  projectEnforcementRows,
  projectHardeningListRegionView,
  projectImportDraftView,
  projectImportReleaseRows,
  projectImportVerdictRows,
  projectLimitDraftView,
  projectRetentionDraftView,
  projectRetentionRecordRows,
  projectRetryGuidanceKind,
  resolveHardeningKeyboardTransition,
  rollbackEvidenceIsPresent,
} from "./hardeningStudioProjection.js";
import type {
  DrRestoreView,
  EligibilityEntry,
  HardeningEnforcementRecordView,
  ImportReleaseRecordView,
} from "./hardeningController.js";

function enforcementFixture(
  overrides: Partial<HardeningEnforcementRecordView> = {},
): HardeningEnforcementRecordView {
  return {
    id: "fx-h-enf-001",
    policyId: "policy-render-submit",
    scope: "render.submit",
    action: "deny",
    windowS: 60,
    burst: 3,
    retryAfterS: 60,
    enforcedAt: "2025-06-02T09:00:10.000Z",
    simulated: true,
    ...overrides,
  };
}

function drEvent(
  restoreId: string,
  payload: Record<string, string | number | boolean>,
): SolutionEvent {
  return {
    id: `fx-h-event-${restoreId}`,
    solutionId: "fx-hardening-studio",
    type: "dr-restore-recorded",
    occurredAt: "2025-06-02T09:02:00.000Z",
    subjectRef: restoreId,
    payload,
    provenance: {
      source: "you-phase0-hardening-storyboard",
      generator: "agent",
      createdAt: "2025-06-02T09:02:00.000Z",
      lineage: [],
    },
  };
}

function drRecordFixture(
  overrides: Partial<DrRestoreRecord> = {},
): DrRestoreRecord {
  return {
    id: "fx-h-restore-001",
    snapshotRef: "fx-snapshot-001",
    restoredAt: "2025-06-02T09:02:00.000Z",
    verified: true,
    simulated: true,
    ...overrides,
  };
}

test("enforcement rows carry the deny/defer/shed action with window and retry guidance", () => {
  const rows = projectEnforcementRows([
    enforcementFixture({ action: "deny", retryAfterS: 60 }),
    enforcementFixture({
      id: "fx-h-enf-002",
      policyId: "policy-import-scan",
      scope: "import.scan",
      action: "defer",
      windowS: 300,
      retryAfterS: 300,
      enforcedAt: "2025-06-02T09:00:20.000Z",
    }),
    enforcementFixture({
      id: "fx-h-enf-003",
      policyId: "policy-export-peak",
      scope: "export.render",
      action: "shed",
      windowS: 30,
      burst: 1,
      retryAfterS: 30,
      enforcedAt: "2025-06-02T09:00:30.000Z",
    }),
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.action),
    ["deny", "defer", "shed"],
  );
  assert.equal(rows[0]!.retryAfterS, 60);
  assert.equal(rows[1]!.windowS, 300);
  assert.equal(rows[2]!.scope, "export.render");
  // retry 指引档位：0 ⇒ immediate；> 0 ⇒ windowed。
  assert.equal(projectRetryGuidanceKind(0), "immediate");
  assert.equal(projectRetryGuidanceKind(45), "windowed");
  // 可访问标签包含法则要素（action + window + retry）。
  assert.ok(rows[0]!.accessibleLabel.includes("deny"));
  assert.ok(rows[0]!.accessibleLabel.includes("retry after 60s"));
});

test("import verdict rows expose scan classes, verdicts and release links", () => {
  const rows = projectImportVerdictRows([
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
    {
      verdict: {
        id: "fx-h-verdict-002",
        artifactRef: "fx-content-bbb",
        scanClass: "package-bundle",
        verdict: "quarantined",
        quarantinedAt: "2025-06-02T09:00:40.000Z",
        simulated: true,
      },
      releaseRecordId: "fx-h-release-001",
      releasedAt: "2025-06-02T09:00:50.000Z",
    },
    {
      verdict: {
        id: "fx-h-verdict-003",
        artifactRef: "fx-content-ccc",
        scanClass: "model-weights",
        verdict: "rejected",
        quarantinedAt: null,
        simulated: true,
      },
      releaseRecordId: null,
      releasedAt: null,
    },
  ]);
  assert.deepEqual(
    rows.map((row) => row.verdict),
    ["clean", "quarantined", "rejected"],
  );
  assert.deepEqual(
    rows.map((row) => row.scanClass),
    ["media-upload", "package-bundle", "model-weights"],
  );
  assert.equal(rows[0]!.releaseRecordId, null);
  assert.equal(rows[1]!.releaseRecordId, "fx-h-release-001");
  assert.equal(rows[1]!.releasedAt, "2025-06-02T09:00:50.000Z");
  assert.equal(rows[2]!.quarantinedAt, null);
  assert.ok(rows[1]!.accessibleLabel.includes("released by fx-h-release-001"));
});

test("import release rows link the verdict and the artifact", () => {
  const releases: ImportReleaseRecordView[] = [
    {
      id: "fx-h-release-001",
      verdictId: "fx-h-verdict-002",
      artifactRef: "fx-content-bbb",
      releasedAt: "2025-06-02T09:00:50.000Z",
      simulated: true,
    },
  ];
  const rows = projectImportReleaseRows(releases);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.verdictId, "fx-h-verdict-002");
  assert.ok(rows[0]!.accessibleLabel.includes("explicit release record"));
});

test("retention record rows project class + subject + timestamp", () => {
  const rows = projectRetentionRecordRows([
    {
      id: "fx-h-retention-001",
      retentionClass: "evidence-raw",
      subjectRef: "fx-subject-002",
      enforcedAt: "2025-06-02T09:01:00.000Z",
    },
  ]);
  assert.equal(rows[0]!.retentionClass, "evidence-raw");
  assert.equal(rows[0]!.subjectRef, "fx-subject-002");
  assert.ok(rows[0]!.accessibleLabel.includes("immutable") === false);
  assert.ok(rows[0]!.accessibleLabel.includes("enforced at"));
});

test("DR verification derives from the event-stream check evidence, never the bare flag (DR LAW display side)", () => {
  const record = drRecordFixture();
  // 无事件 ⇒ verified flag 不显示为 verified（无 check evidence）。
  assert.deepEqual(projectDrRestoreVerification(record, []), {
    verification: "unverified",
    checkHash: null,
  });
  // 有 checkHash 证据 ⇒ verified。
  const withEvidence = [
    drEvent(record.id, { restoreId: record.id, checkHash: "sha256-fixture-abc", verified: true }),
  ];
  assert.deepEqual(projectDrRestoreVerification(record, withEvidence), {
    verification: "verified",
    checkHash: "sha256-fixture-abc",
  });
  // 事件存在但 checkHash 为空字符串 ⇒ 仍不显示为 verified。
  const emptyHash = [
    drEvent(record.id, { restoreId: record.id, checkHash: "", verified: true }),
  ];
  assert.deepEqual(projectDrRestoreVerification(record, emptyHash), {
    verification: "unverified",
    checkHash: null,
  });
  // flag 本身为 false ⇒ unverified（绝不越权断言）。
  assert.deepEqual(
    projectDrRestoreVerification(drRecordFixture({ verified: false }), withEvidence),
    { verification: "unverified", checkHash: null },
  );
  // 其它 restore 的事件不影响本记录。
  const otherOnly = [drEvent("fx-h-restore-999", { restoreId: "fx-h-restore-999", checkHash: "x", verified: true })];
  assert.deepEqual(projectDrRestoreVerification(record, otherOnly), {
    verification: "unverified",
    checkHash: null,
  });
});

test("DR restore rows carry the derived verification and the check hash", () => {
  const restores: DrRestoreView[] = [
    {
      record: drRecordFixture(),
      verification: "verified",
      checkHash: "sha256-fixture-abc",
    },
  ];
  const events = [
    drEvent("fx-h-restore-001", {
      restoreId: "fx-h-restore-001",
      checkHash: "sha256-fixture-abc",
      verified: true,
    }),
  ];
  const rows = projectDrRestoreRows(restores, events);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.verification, "verified");
  assert.equal(rows[0]!.checkHash, "sha256-fixture-abc");
  assert.ok(rows[0]!.accessibleLabel.includes("verified"));
});

test("eligibility rows expose kind, eligible/blocked, rollback evidence and supersedes links", () => {
  const ledger: EligibilityEntry[] = [
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
    {
      record: {
        id: "fx-h-eligibility-002",
        subjectRef: "fx-matrix-render-eu",
        eligible: false,
        rollbackEvidenceRef: "fx-rollback-001",
        decidedAt: "2025-06-02T09:03:10.000Z",
        simulated: true,
      },
      kind: "reversal",
      supersedesRecordId: "fx-h-eligibility-001",
    },
  ];
  const rows = projectEligibilityRows(ledger);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.kind, "decision");
  assert.equal(rows[0]!.eligible, true);
  assert.equal(rows[1]!.kind, "reversal");
  assert.equal(rows[1]!.supersedesRecordId, "fx-h-eligibility-001");
  assert.ok(rows[1]!.accessibleLabel.includes("supersedes fx-h-eligibility-001"));
  // rollback evidence presence 判定。
  assert.equal(rollbackEvidenceIsPresent("fx-rollback-001"), true);
  assert.equal(rollbackEvidenceIsPresent("fx-rollback-none"), false);
  assert.equal(rollbackEvidenceIsPresent(""), false);
});

test("region views: no snapshot -> loading, snapshot without rows -> empty, rows -> ready", () => {
  assert.equal(projectHardeningListRegionView(false, 0), "loading");
  assert.equal(projectHardeningListRegionView(true, 0), "empty");
  assert.equal(projectHardeningListRegionView(true, 3), "ready");
});

test("draft views expose deterministic disabled reasons", () => {
  // limit 草稿。
  const policies = [
    { id: "policy-render-submit", action: "deny" as const, windowS: 60, burst: 3 },
  ];
  assert.deepEqual(projectLimitDraftView({ policyId: "policy-render-submit" }, policies), {
    policyId: "policy-render-submit",
    disabledReason: null,
    action: "deny",
    windowS: 60,
    burst: 3,
  });
  assert.deepEqual(projectLimitDraftView({ policyId: "policy-unknown" }, policies), {
    policyId: "policy-unknown",
    disabledReason: "unknown-policy",
    action: null,
    windowS: null,
    burst: null,
  });
  // import 草稿（固定序：unknown-artifact 先于 unregistered-scan-class）。
  const registry = {
    artifacts: [{ id: "import-artifact-portrait" }],
    scanClasses: [
      { id: "scan-class-media-upload", valid: true },
      { id: "scan-class-unregistered", valid: false },
    ],
  };
  assert.equal(
    projectLimitDraftView({ policyId: "x" }, []).disabledReason,
    "unknown-policy",
  );
  assert.equal(
    projectImportDraftView(
      { artifactId: "import-artifact-portrait", scanClassId: "scan-class-media-upload" },
      registry,
    ).disabledReason,
    null,
  );
  assert.equal(
    projectImportDraftView(
      { artifactId: "import-artifact-portrait", scanClassId: "scan-class-unregistered" },
      registry,
    ).disabledReason,
    "unregistered-scan-class",
  );
  assert.equal(
    projectImportDraftView(
      { artifactId: "import-artifact-unknown", scanClassId: "scan-class-unregistered" },
      registry,
    ).disabledReason,
    "unknown-artifact",
  );
});

test("retention / DR draft views project protection indicators and honest refusal paths (not UI disabling)", () => {
  const retentionRegistry = {
    subjects: [
      { id: "subject-evidence-granted", consentProtected: true, consentState: "granted" },
      { id: "subject-evidence-withdrawn", consentProtected: false, consentState: "withdrawn" },
    ],
    classes: [{ id: "retention-class-evidence-raw" }],
  };
  // consent-protected 是显示指示器（typed 拒绝路径），非禁用原因。
  const protectedView = projectRetentionDraftView(
    { subjectId: "subject-evidence-granted", retentionClassId: "retention-class-evidence-raw" },
    retentionRegistry,
  );
  assert.equal(protectedView.disabledReason, null);
  assert.equal(protectedView.consentProtected, true);
  assert.equal(protectedView.consentState, "granted");
  const withdrawnView = projectRetentionDraftView(
    { subjectId: "subject-evidence-withdrawn", retentionClassId: "retention-class-evidence-raw" },
    retentionRegistry,
  );
  assert.equal(withdrawnView.consentProtected, false);
  assert.equal(
    projectRetentionDraftView(
      { subjectId: "subject-unknown", retentionClassId: "retention-class-evidence-raw" },
      retentionRegistry,
    ).disabledReason,
    "unknown-subject",
  );
  // DR 草稿：corrupted 是诚实 typed 拒绝路径，非禁用。
  const snapshots = [{ id: "dr-snapshot-primary" }];
  const honestView = projectDrDraftView(
    { snapshotId: "dr-snapshot-primary", integrity: "honest" },
    snapshots,
  );
  assert.equal(honestView.disabledReason, null);
  const corruptedView = projectDrDraftView(
    { snapshotId: "dr-snapshot-primary", integrity: "corrupted" },
    snapshots,
  );
  assert.equal(corruptedView.disabledReason, null);
  assert.equal(
    projectDrDraftView({ snapshotId: "dr-snapshot-unknown", integrity: "honest" }, snapshots)
      .disabledReason,
    "unknown-snapshot",
  );
});

test("keyboard transitions and cursor clamping mirror the sibling surfaces", () => {
  const state = { totalEnforcements: 3 };
  assert.deepEqual(resolveHardeningKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("ArrowRight", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("Home", state), {
    kind: "move",
    delta: -3,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("End", state), {
    kind: "move",
    delta: 3,
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("Enter", state), {
    kind: "select",
  });
  assert.deepEqual(resolveHardeningKeyboardTransition("x", state), { kind: "none" });
  assert.equal(clampHardeningIndex(-1, 3), 0);
  assert.equal(clampHardeningIndex(99, 3), 2);
  assert.equal(clampHardeningIndex(0, 0), 0);
});
