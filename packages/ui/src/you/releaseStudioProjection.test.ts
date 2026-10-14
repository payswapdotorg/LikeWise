// W12B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：checklist 行（counts verbatim + 20 点逐点 pass 态与 journey-evidence 链接
// —— LAUNCH GATE LAW 显示面）、signoff 行（signed-by / signed-at / 被引用
// checklist 的 counts 与门态——OPERATOR SIGNOFF LAW 显示面）、declaration 行
//（signoff / bundle / rollback 链接——RELEASE DECLARATION LAW 显示面）、区域
// loading/empty/ready 视图模型、键盘转移与光标夹紧、两门固定求值序
//（fail closed）、各平面草稿视图。
import assert from "node:assert/strict";
import test from "node:test";
import {
  projectReleaseDeclarationGate,
  projectReleaseSignoffGate,
} from "./releaseController.js";
import type { ReleaseStudioSnapshot } from "./releaseController.js";
import {
  clampReleaseIndex,
  projectChecklistDraftView,
  projectDeclarationDraftView,
  projectReleaseChecklistRows,
  projectReleaseDeclarationRows,
  projectReleaseListRegionView,
  projectReleaseSignoffRows,
  projectSignoffDraftView,
  resolveReleaseKeyboardTransition,
} from "./releaseStudioProjection.js";

function point(
  number: number,
  evidence: string | null,
): {
  point: number;
  description: string;
  journeyEvidenceRef: string | null;
  passed: boolean;
} {
  return {
    point: number,
    description: `point-${number} description`,
    journeyEvidenceRef: evidence,
    passed: evidence !== null,
  };
}

/** 20 点全过的 gate-passing checklist（LAUNCH GATE LAW：门仅在 20 点全过时通过）。 */
function passingChecklistFixture(
  id: string,
  checkedAt = "2025-06-02T09:00:01.000Z",
): ReleaseStudioSnapshot["checklists"][number] {
  return {
    id,
    points: Array.from({ length: 20 }, (_, index) =>
      point(index + 1, `fx-content-step-${index + 1}`),
    ),
    checkedAt,
    simulated: true,
  };
}

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
        steps: ["workspace-create", "intent-capture", "solution-open"],
        evidenceSteps: 3,
        valid: true,
      },
      {
        id: "journey-gate-partial",
        journeyId: "launch-gate-partial-016",
        steps: ["workspace-create", "intent-capture", "solution-open"],
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
      {
        id: "bundle-empty",
        bundleRef: "fx-content-bundle-empty",
        journeyCount: 0,
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
          point(1, "fx-content-step-1"),
          point(2, "fx-content-step-2"),
          point(3, null),
        ],
        checkedAt: "2025-06-02T09:00:01.000Z",
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
    declarations: [],
    events: [],
    projectedAt: "2025-06-02T09:00:05.000Z",
    simulated: true,
    ...overrides,
  };
}

test("checklist rows state counts verbatim, per-point pass states and journey-evidence links", () => {
  const snapshot = snapshotFixture();
  const rows = projectReleaseChecklistRows(snapshot, snapshot.checklists);
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  // counts verbatim（2/3——绝不 bare pass）。
  assert.equal(row.pointsTotal, 3);
  assert.equal(row.pointsPassed, 2);
  assert.equal(row.countsLabel, "2/3");
  assert.equal(row.gateState, "incomplete");
  assert.equal(row.checkedAt, "2025-06-02T09:00:01.000Z");
  // 逐点：有证据 → passed + evidence ref verbatim；无证据 → 未通过且 ref 空。
  assert.equal(row.points.length, 3);
  assert.deepEqual(row.points[0], {
    point: 1,
    description: "point-1 description",
    journeyEvidenceRef: "fx-content-step-1",
    passed: true,
  });
  assert.deepEqual(row.points[2], {
    point: 3,
    description: "point-3 description",
    journeyEvidenceRef: null,
    passed: false,
  });
  // accessible label 陈述 counts 与门态。
  assert.ok(row.accessibleLabel.includes("2 of 3 points passed"));
  assert.ok(row.accessibleLabel.includes("gate not passed"));

  // 无 checklist 签署 → signed false；有 → true。
  const unsignedSnapshot = snapshotFixture({ signoffs: [] });
  assert.equal(
    projectReleaseChecklistRows(
      unsignedSnapshot,
      unsignedSnapshot.checklists,
    )[0]!.signed,
    false,
  );
  const signedSnapshot = snapshotFixture();
  assert.equal(
    projectReleaseChecklistRows(signedSnapshot, signedSnapshot.checklists)[0]!
      .signed,
    true,
  );

  // 20 点全过 → all-points-passed 门态（counts 仍同框，绝不 bare pass）。
  const goldenSnapshot = snapshotFixture({
    checklists: [passingChecklistFixture("fx-r-checklist-003")],
  });
  const goldenRow = projectReleaseChecklistRows(
    goldenSnapshot,
    goldenSnapshot.checklists,
  )[0]!;
  assert.equal(goldenRow.gateState, "all-points-passed");
  assert.equal(goldenRow.pointsPassed, 20);
  assert.equal(goldenRow.countsLabel, "20/20");
  assert.ok(goldenRow.accessibleLabel.includes("gate passed"));
});

test("signoff rows carry signed-by / signed-at and the referenced checklist state verbatim", () => {
  const snapshot = snapshotFixture();
  const rows = projectReleaseSignoffRows(snapshot, snapshot.signoffs);
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.signoffId, "fx-r-signoff-001");
  assert.equal(row.signedBy, "fx-content-operator-aria");
  assert.equal(row.signedByDisplayName, "Aria (release operator)");
  assert.equal(row.signedAt, "2025-06-02T09:00:03.000Z");
  assert.equal(row.checklistRef, "fx-r-checklist-001");
  assert.equal(row.checklistCountsLabel, "2/3");
  assert.equal(row.checklistGatePasses, false);
  assert.equal(row.declared, false);
  assert.ok(row.accessibleLabel.includes("signed by fx-content-operator-aria"));
  assert.ok(row.accessibleLabel.includes("2/3 points"));

  // 未知 operator ref → 显示名 null（UI 不猜测）。
  const unknownOperator = snapshotFixture({
    signoffs: [
      {
        id: "fx-r-signoff-001",
        checklistRef: "fx-r-checklist-001",
        signedBy: "fx-content-operator-missing",
        signedAt: "2025-06-02T09:00:03.000Z",
        simulated: true,
      },
    ],
  });
  assert.equal(
    projectReleaseSignoffRows(unknownOperator, unknownOperator.signoffs)[0]!
      .signedByDisplayName,
    null,
  );

  // 被引用 checklist 已声明 → declared true。
  const declaredSnapshot = snapshotFixture({
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
  });
  assert.equal(
    projectReleaseSignoffRows(declaredSnapshot, declaredSnapshot.signoffs)[0]!
      .declared,
    true,
  );
});

test("declaration rows carry the sign-off, evidence-bundle and rollback links verbatim", () => {
  const snapshot = snapshotFixture({
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
  });
  const rows = projectReleaseDeclarationRows(snapshot, snapshot.declarations);
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.declarationId, "fx-r-declaration-001");
  assert.equal(row.signoffRef, "fx-r-signoff-001");
  assert.equal(row.evidenceBundleRef, "fx-content-bundle-golden");
  assert.equal(row.evidenceBundleJourneyCount, 21);
  assert.equal(row.rollbackEvidenceRef, "fx-content-rollback-dr");
  assert.equal(
    row.rollbackDrill,
    "DR restore verified from the secondary snapshot",
  );
  assert.equal(row.declaredAt, "2025-06-02T09:00:04.000Z");
  assert.ok(row.accessibleLabel.includes("21 journey records"));
  assert.ok(row.accessibleLabel.includes("DR restore verified"));

  // 未知 bundle ref → journeyCount null（注册面解析失败显式呈现）。
  const unknownBundle = snapshotFixture({
    declarations: [
      {
        id: "fx-r-declaration-002",
        signoffRef: "fx-r-signoff-001",
        evidenceBundleRef: "fx-content-bundle-missing",
        rollbackEvidenceRef: "fx-content-rollback-dr",
        declaredAt: "2025-06-02T09:00:04.000Z",
        simulated: true,
      },
    ],
  });
  assert.equal(
    projectReleaseDeclarationRows(unknownBundle, unknownBundle.declarations)[0]!
      .evidenceBundleJourneyCount,
    null,
  );
});

test("region view model: loading without a snapshot, empty with no rows, ready with rows", () => {
  assert.equal(projectReleaseListRegionView(false, 0), "loading");
  assert.equal(projectReleaseListRegionView(true, 0), "empty");
  assert.equal(projectReleaseListRegionView(true, 3), "ready");
  // 无快照但计数非零：仍 loading（快照缺失优先——诚实态）。
  assert.equal(projectReleaseListRegionView(false, 3), "loading");
});

test("keyboard transitions mirror the sibling surfaces and the cursor clamps at bounds", () => {
  const state = { totalChecklists: 5 };
  assert.deepEqual(resolveReleaseKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveReleaseKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveReleaseKeyboardTransition("Home", state), {
    kind: "move",
    delta: -5,
  });
  assert.deepEqual(resolveReleaseKeyboardTransition("End", state), {
    kind: "move",
    delta: 5,
  });
  assert.deepEqual(resolveReleaseKeyboardTransition("Enter", state), {
    kind: "select",
  });
  assert.deepEqual(resolveReleaseKeyboardTransition("x", state), {
    kind: "none",
  });

  assert.equal(clampReleaseIndex(-1, 5), 0);
  assert.equal(clampReleaseIndex(3, 5), 3);
  assert.equal(clampReleaseIndex(9, 5), 4);
  assert.equal(clampReleaseIndex(2, 0), 0);
});

test("signoff gate evaluates the OPERATOR SIGNOFF LAW order fail-closed", () => {
  const passingChecklist = snapshotFixture({
    checklists: [passingChecklistFixture("fx-r-checklist-001")],
    signoffs: [],
  });

  // 无 checklist → no-checklist。
  assert.deepEqual(
    projectReleaseSignoffGate(snapshotFixture({ checklists: [] }), "operator-aria"),
    { allowed: false, reason: "no-checklist" },
  );

  // 最新 checklist 未过门 → gate-not-passing。
  assert.deepEqual(
    projectReleaseSignoffGate(snapshotFixture(), "operator-aria"),
    { allowed: false, reason: "gate-not-passing" },
  );

  // 已签署 → checklist-already-signed（一次性最终决定）。
  const signedSnapshot = snapshotFixture({
    checklists: [passingChecklistFixture("fx-r-checklist-001")],
    signoffs: [
      {
        id: "fx-r-signoff-001",
        checklistRef: "fx-r-checklist-001",
        signedBy: "fx-content-operator-aria",
        signedAt: "2025-06-02T09:00:03.000Z",
        simulated: true,
      },
    ],
  });
  assert.deepEqual(
    projectReleaseSignoffGate(signedSnapshot, "operator-aria"),
    { allowed: false, reason: "checklist-already-signed" },
  );

  // 未知 operator → unknown-operator（在过门且未签署的 checklist 上仍 fail closed）。
  assert.deepEqual(
    projectReleaseSignoffGate(passingChecklist, "operator-unknown-legacy"),
    { allowed: false, reason: "unknown-operator" },
  );
  assert.deepEqual(
    projectReleaseSignoffGate(passingChecklist, null),
    { allowed: false, reason: "unknown-operator" },
  );
  assert.deepEqual(projectReleaseSignoffGate(null, "operator-aria"), {
    allowed: false,
    reason: "unknown-operator",
  });

  // 完整过门 + 在册 operator → granted。
  assert.deepEqual(
    projectReleaseSignoffGate(passingChecklist, "operator-aria"),
    { allowed: true, reason: "granted" },
  );
});

test("declaration gate evaluates the RELEASE DECLARATION LAW order fail-closed", () => {
  const withSignoff = snapshotFixture({
    signoffs: [
      {
        id: "fx-r-signoff-001",
        checklistRef: "fx-r-checklist-001",
        signedBy: "fx-content-operator-aria",
        signedAt: "2025-06-02T09:00:03.000Z",
        simulated: true,
      },
    ],
  });

  // 无 signoff → no-signoff。
  assert.deepEqual(
    projectReleaseDeclarationGate(
      snapshotFixture({ signoffs: [] }),
      "bundle-golden-journey-set",
      "rollback-dr-verified",
    ),
    { allowed: false, reason: "no-signoff" },
  );
  assert.deepEqual(
    projectReleaseDeclarationGate(
      null,
      "bundle-golden-journey-set",
      "rollback-dr-verified",
    ),
    { allowed: false, reason: "no-signoff" },
  );

  // signoff 已声明 → signoff-already-declared（one release per signoff）。
  const declaredSnapshot = snapshotFixture({
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
  });
  assert.deepEqual(
    projectReleaseDeclarationGate(
      declaredSnapshot,
      "bundle-golden-journey-set",
      "rollback-dr-verified",
    ),
    { allowed: false, reason: "signoff-already-declared" },
  );

  // 未知 bundle → unknown-evidence-bundle。
  assert.deepEqual(
    projectReleaseDeclarationGate(
      withSignoff,
      "bundle-unregistered",
      "rollback-dr-verified",
    ),
    { allowed: false, reason: "unknown-evidence-bundle" },
  );

  // 空 bundle → empty-evidence-bundle（FULL evidence bundle 法则）。
  assert.deepEqual(
    projectReleaseDeclarationGate(
      withSignoff,
      "bundle-empty",
      "rollback-dr-verified",
    ),
    { allowed: false, reason: "empty-evidence-bundle" },
  );

  // 缺 rollback → missing-rollback-evidence。
  assert.deepEqual(
    projectReleaseDeclarationGate(
      withSignoff,
      "bundle-golden-journey-set",
      "rollback-unregistered",
    ),
    { allowed: false, reason: "missing-rollback-evidence" },
  );
  assert.deepEqual(
    projectReleaseDeclarationGate(
      withSignoff,
      "bundle-golden-journey-set",
      null,
    ),
    { allowed: false, reason: "missing-rollback-evidence" },
  );

  // bundle 齐全 + rollback 在场 → granted。
  assert.deepEqual(
    projectReleaseDeclarationGate(
      withSignoff,
      "bundle-golden-journey-set",
      "rollback-dr-verified",
    ),
    { allowed: true, reason: "granted" },
  );
});

test("per-plane draft views resolve disabled reasons and projected facts deterministically", () => {
  const journeys = snapshotFixture().journeys;
  // golden journey：无禁用 + 证据覆盖投影。
  assert.deepEqual(
    projectChecklistDraftView(
      { journeyId: "journey-gate-golden" },
      journeys,
    ),
    {
      journeyId: "journey-gate-golden",
      disabledReason: null,
      totalSteps: 3,
      evidenceSteps: 3,
    },
  );
  // partial journey：合法（诚实 incomplete 落账路径——非 UI 禁用）。
  assert.deepEqual(
    projectChecklistDraftView(
      { journeyId: "journey-gate-partial" },
      journeys,
    ),
    {
      journeyId: "journey-gate-partial",
      disabledReason: null,
      totalSteps: 3,
      evidenceSteps: 2,
    },
  );
  // 未注册 journey → 禁用（fail closed）。
  assert.deepEqual(
    projectChecklistDraftView(
      { journeyId: "journey-unknown-legacy" },
      journeys,
    ),
    {
      journeyId: "journey-unknown-legacy",
      disabledReason: "unknown-journey",
      totalSteps: null,
      evidenceSteps: null,
    },
  );

  // signoff 草稿视图透传门投影。
  const gate = projectReleaseSignoffGate(snapshotFixture(), "operator-aria");
  assert.deepEqual(
    projectSignoffDraftView({ operatorId: "operator-aria" }, gate),
    { operatorId: "operator-aria", gate },
  );

  // declaration 草稿视图透传门投影。
  const declarationGate = projectReleaseDeclarationGate(
    snapshotFixture(),
    "bundle-golden-journey-set",
    "rollback-dr-verified",
  );
  assert.deepEqual(
    projectDeclarationDraftView(
      {
        evidenceBundleId: "bundle-golden-journey-set",
        rollbackEvidenceId: "rollback-dr-verified",
      },
      declarationGate,
    ),
    {
      evidenceBundleId: "bundle-golden-journey-set",
      rollbackEvidenceId: "rollback-dr-verified",
      gate: declarationGate,
    },
  );
});
