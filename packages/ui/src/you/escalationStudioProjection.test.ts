// W8B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：升级状态阶梯投影（current 来自投影头；visited 由事件流派生——含
// delivered/rejected 的投影事实标记；终态标记）、gap 显示行（分类/置信度/策略/
// 证据链接——内容寻址）、专家结果审阅视图（payload 键稳定序；artifact 内容寻址
// 标签提取；applies-as-changeset）、run 行、授权账本行（live/withdrawn/supersedes
// 标记）、learning-permission 显示行（wave-6 权利法显示面）、ToolGap/KnowledgeGap
// 投影行、区域视图模型、授权草稿禁用原因固定序、policy 草稿视图。
import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaExpertResult, ArenaLearningPermission, SolutionEvent } from "@zcode/shared";
import type { EscalationAuthorizationEntry, EscalationView } from "./escalationController.js";
import {
  ladderVisitedCount,
  projectArenaRunRows,
  projectAuthorizationRows,
  projectAuthorizationDraftView,
  projectEscalationLadder,
  projectExpertResultView,
  projectGapEvidenceRows,
  projectGapRows,
  projectGapStrategyRows,
  projectKnowledgeProjectionRows,
  projectLearningPermissionRows,
  projectListRegionView,
  projectToolProjectionRows,
  clampEscalationIndex,
  type AuthorizationExpiryPresetId,
} from "./escalationStudioProjection.js";

function eventFixture(
  type: SolutionEvent["type"],
  escalationId: string,
  occurredAt: string,
): SolutionEvent {
  return {
    id: `fx-event-${type}-${escalationId}`,
    solutionId: "fx-escalation-studio",
    type,
    occurredAt,
    subjectRef: escalationId,
    payload: { escalationId, simulated: true },
    provenance: {
      source: "you-phase0-escalation-storyboard",
      generator: "agent",
      createdAt: occurredAt,
      lineage: [],
    },
  };
}

function escalationFixture(
  status: EscalationView["status"],
  expertResult: ArenaExpertResult | null = null,
): EscalationView {
  return {
    escalationId: "fx-escalation-001",
    gapId: "fx-gap-001",
    status,
    minimumContext: ["intent-reference", "capability-gap-record"],
    expertResult,
    requiredScope: "solution:fx-portrait-001",
    createdAt: "2025-06-02T09:00:00.000Z",
    rejectionReason: null,
  };
}

test("escalation ladder: current from the projection head, visited derived from the event stream", () => {
  const events: readonly SolutionEvent[] = [
    eventFixture("arena-escalation-requested", "fx-escalation-001", "2025-06-02T09:00:01.000Z"),
    eventFixture("escalation-authorized", "fx-escalation-001", "2025-06-02T09:00:02.000Z"),
    eventFixture("arena-run-recorded", "fx-escalation-001", "2025-06-02T09:00:03.000Z"),
    eventFixture("arena-result-applied", "fx-escalation-001", "2025-06-02T09:00:05.000Z"),
    // 其它升级的事件不串档。
    eventFixture("escalation-authorized", "fx-escalation-002", "2025-06-02T09:00:04.000Z"),
  ];
  const ladder = projectEscalationLadder(
    { status: "applied", expertResult: { deliveredAt: "2025-06-02T09:00:04.500Z" } as ArenaExpertResult },
    events,
    "fx-escalation-001",
  );
  assert.equal(ladder.length, 7);
  assert.deepEqual(
    ladder.map((step) => step.status),
    ["requested", "authorized", "in-progress", "delivered", "applied", "rejected", "cancelled"],
  );
  // applied 终态为 current；过程四档 + applied 已过；rejected/cancelled 未过。
  const reached = ladder.filter((step) => step.reached).map((step) => step.status);
  assert.deepEqual(reached, ["requested", "authorized", "in-progress", "delivered", "applied"]);
  assert.equal(ladder.find((step) => step.status === "applied")?.current, true);
  assert.equal(ladder.find((step) => step.status === "applied")?.terminal, true);
  assert.equal(ladder.find((step) => step.status === "requested")?.terminal, false);
  // 事件时间戳落在对应档位（delivered 取专家结果交付时刻）。
  assert.equal(ladder.find((step) => step.status === "requested")?.at, "2025-06-02T09:00:01.000Z");
  assert.equal(ladder.find((step) => step.status === "authorized")?.at, "2025-06-02T09:00:02.000Z");
  assert.equal(ladder.find((step) => step.status === "in-progress")?.at, "2025-06-02T09:00:03.000Z");
  assert.equal(ladder.find((step) => step.status === "delivered")?.at, "2025-06-02T09:00:04.500Z");
  assert.equal(ladder.find((step) => step.status === "applied")?.at, "2025-06-02T09:00:05.000Z");
  assert.equal(ladderVisitedCount(ladder), 5);

  // requested 状态：只有 requested 已过（无授权事件时 authorized 未过）。
  const early = projectEscalationLadder({ status: "requested", expertResult: null }, events.slice(0, 1), "fx-escalation-001");
  assert.deepEqual(
    early.filter((step) => step.reached).map((step) => step.status),
    ["requested"],
  );

  // rejected：无 frozen 事件类型——投影事实标记（披露语义）。事件史止于 run 启动
  //（delivered 由专家结果标记、rejected 由终态标记）。
  const rejected = projectEscalationLadder(
    { status: "rejected", expertResult: { deliveredAt: "2025-06-02T09:00:04.500Z" } as ArenaExpertResult },
    events.slice(0, 3),
    "fx-escalation-001",
  );
  assert.deepEqual(
    rejected.filter((step) => step.reached).map((step) => step.status),
    ["requested", "authorized", "in-progress", "delivered", "rejected"],
  );

  // cancelled：escalation-cancelled 事件标记档位。
  const cancelled = projectEscalationLadder(
    { status: "cancelled", expertResult: null },
    [
      eventFixture("arena-escalation-requested", "fx-escalation-001", "2025-06-02T09:00:01.000Z"),
      { ...eventFixture("escalation-cancelled", "fx-escalation-001", "2025-06-02T09:00:02.000Z"), type: "escalation-cancelled" },
    ],
    "fx-escalation-001",
  );
  assert.deepEqual(
    cancelled.filter((step) => step.reached).map((step) => step.status),
    ["requested", "cancelled"],
  );
});

test("gap rows: category, confidence, strategies, evidence links and escalation ref", () => {
  const rows = projectGapRows([
    {
      id: "fx-gap-001",
      intentRef: "fx-intent-001",
      attemptedStrategies: [
        { strategy: "native-toolchain", outcome: "failed", evidenceRef: "fx-content-aaa" },
        { strategy: "editor-roundtrip", outcome: "partial", evidenceRef: null },
      ],
      failureEvidence: ["fx-content-aaa", "fx-content-bbb"],
      category: "TOOL_GAP",
      confidence: 0.82,
      suggestedNextAction: "Substitute the toolchain.",
      escalationEligibility: "escalated",
      arenaEscalationRef: {
        escalationId: "fx-escalation-001",
        status: "applied",
        minimumContext: [],
        expertResult: null,
      },
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.gapId, "fx-gap-001");
  assert.equal(rows[0]!.category, "TOOL_GAP");
  assert.equal(rows[0]!.confidence, 0.82);
  assert.equal(rows[0]!.strategyCount, 2);
  assert.equal(rows[0]!.evidenceCount, 2);
  assert.equal(rows[0]!.eligibility, "escalated");
  assert.equal(rows[0]!.escalationId, "fx-escalation-001");
  assert.equal(rows[0]!.escalationStatus, "applied");
  assert.ok(rows[0]!.accessibleLabel.includes("TOOL_GAP"));

  // 策略行 + 证据链接行（内容寻址标签，绝不内联）。
  const strategyRows = projectGapStrategyRows(rows[0] ? [
    { strategy: "native-toolchain", outcome: "failed", evidenceRef: "fx-content-aaa" },
    { strategy: "editor-roundtrip", outcome: "partial", evidenceRef: null },
  ] : []);
  assert.equal(strategyRows.length, 2);
  assert.equal(strategyRows[0]!.evidenceRef, "fx-content-aaa");
  assert.equal(strategyRows[1]!.evidenceRef, null);
  const evidenceRows = projectGapEvidenceRows(["fx-content-aaa", "fx-content-bbb"]);
  assert.deepEqual(
    evidenceRows.map((row) => row.evidenceRef),
    ["fx-content-aaa", "fx-content-bbb"],
  );
});

test("expert result view: payload rows sorted, artifact labels extracted, applies-as-changeset", () => {
  const delivered: EscalationView = escalationFixture("delivered", {
    deliveredAt: "2025-06-02T09:00:04.000Z",
    resultType: "artifact",
    payload: {
      remediation: "expert-correction-artifact",
      artifactRef: "fx-content-artifact",
      artifactHash: "sha256-fixture-artifact",
      artifactKind: "corrected-geometry",
    },
    appliesAsChangeSetId: null,
  });
  const view = projectExpertResultView(delivered)!;
  assert.equal(view.resultType, "artifact");
  assert.equal(view.artifactRef, "fx-content-artifact");
  assert.equal(view.artifactHash, "sha256-fixture-artifact");
  // payload 键稳定升序。
  assert.deepEqual(
    view.payloadRows.map((row) => row.key),
    ["artifactHash", "artifactKind", "artifactRef", "remediation"],
  );
  assert.equal(view.appliesAsChangeSetId, null);

  const applied: EscalationView = escalationFixture("applied", {
    deliveredAt: "2025-06-02T09:00:04.000Z",
    resultType: "guidance",
    payload: { remediation: "model-profile-update", qualityBoost: 0.08 },
    appliesAsChangeSetId: "fx-changeset-001",
  });
  const appliedView = projectExpertResultView(applied)!;
  assert.equal(appliedView.resultType, "guidance");
  assert.equal(appliedView.artifactRef, null);
  assert.equal(appliedView.appliesAsChangeSetId, "fx-changeset-001");

  // 未交付 ⇒ null（空态区域走 empty 视图）。
  assert.equal(projectExpertResultView(escalationFixture("requested")), null);
});

test("arena run rows: attempt, status, timestamps and outcome evidence labels", () => {
  const rows = projectArenaRunRows([
    {
      id: "fx-run-001",
      gapId: "fx-gap-001",
      strategy: "native-toolchain",
      attempt: 1,
      status: "failed",
      startedAt: "2025-06-02T09:00:03.000Z",
      completedAt: "2025-06-02T09:00:04.000Z",
      outcomeEvidenceRef: null,
      simulated: true,
    },
    {
      id: "fx-run-002",
      gapId: "fx-gap-001",
      strategy: "native-toolchain",
      attempt: 2,
      status: "completed",
      startedAt: "2025-06-02T09:00:05.000Z",
      completedAt: "2025-06-02T09:00:06.000Z",
      outcomeEvidenceRef: "fx-content-outcome",
      simulated: true,
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.status, "failed");
  assert.equal(rows[1]!.attempt, 2);
  assert.equal(rows[1]!.outcomeEvidenceRef, "fx-content-outcome");
  assert.ok(rows[1]!.accessibleLabel.includes("attempt 2"));
});

test("authorization rows: live/withdrawn markers and supersedes linkage", () => {
  const ledger: readonly EscalationAuthorizationEntry[] = [
    {
      record: {
        id: "fx-auth-001",
        escalationId: "fx-escalation-001",
        authorizedBy: "fx-user-aria-001",
        scope: "solution:fx-portrait-001",
        grantedAt: "2025-06-02T09:00:02.000Z",
        expiresAt: null,
        learningPermission: "aggregate",
      },
      kind: "grant",
      supersedesRecordId: null,
    },
    {
      record: {
        id: "fx-auth-002",
        escalationId: "fx-escalation-001",
        authorizedBy: "fx-user-aria-001",
        scope: "solution:fx-portrait-001",
        grantedAt: "2025-06-02T09:00:07.000Z",
        expiresAt: null,
        learningPermission: "none",
      },
      kind: "withdrawal",
      supersedesRecordId: "fx-auth-001",
    },
  ];
  const rows = projectAuthorizationRows(ledger, {
    escalationId: "fx-escalation-001",
    record: ledger[0]!.record,
    withdrawn: true,
    learningPermission: "none",
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.kind, "grant");
  assert.equal(rows[0]!.withdrawn, true);
  assert.equal(rows[0]!.live, false);
  assert.equal(rows[1]!.kind, "withdrawal");
  assert.equal(rows[1]!.supersedesRecordId, "fx-auth-001");

  // live grant（未被撤回的最新 grant）标记 live；被顶替的历史 grant 保持 withdrawn。
  const regrant: EscalationAuthorizationEntry = {
    record: {
      id: "fx-auth-003",
      escalationId: "fx-escalation-001",
      authorizedBy: "fx-user-aria-001",
      scope: "solution:fx-portrait-001",
      grantedAt: "2025-06-02T09:00:09.000Z",
      expiresAt: null,
      learningPermission: "full",
    },
    kind: "grant",
    supersedesRecordId: null,
  };
  const liveRows = projectAuthorizationRows([ledger[0]!, ledger[1]!, regrant], {
    escalationId: "fx-escalation-001",
    record: regrant.record,
    withdrawn: false,
    learningPermission: "full",
  });
  assert.equal(liveRows.length, 3);
  assert.equal(liveRows[2]!.kind, "grant");
  assert.equal(liveRows[2]!.live, true);
  assert.equal(liveRows[2]!.withdrawn, false);
  assert.equal(liveRows[0]!.live, false);
  assert.equal(liveRows[0]!.withdrawn, true);
});

test("learning permission rows: effective permission, withdrawal and no-authorization display", () => {
  const escalations: readonly EscalationView[] = [
    escalationFixture("authorized"),
    { ...escalationFixture("in-progress"), escalationId: "fx-escalation-002" },
    { ...escalationFixture("cancelled"), escalationId: "fx-escalation-003" },
  ];
  const rows = projectLearningPermissionRows(escalations, [
    {
      escalationId: "fx-escalation-001",
      record: {
        id: "fx-auth-001",
        escalationId: "fx-escalation-001",
        authorizedBy: "fx-user-aria-001",
        scope: "solution:fx-portrait-001",
        grantedAt: "2025-06-02T09:00:02.000Z",
        expiresAt: null,
        learningPermission: "full",
      },
      withdrawn: false,
      learningPermission: "full",
    },
    {
      escalationId: "fx-escalation-002",
      record: {
        id: "fx-auth-002",
        escalationId: "fx-escalation-002",
        authorizedBy: "fx-user-aria-001",
        scope: "task:retarget-001",
        grantedAt: "2025-06-02T09:00:05.000Z",
        expiresAt: null,
        learningPermission: "aggregate",
      },
      withdrawn: true,
      learningPermission: "none",
    },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.livePermission, "full");
  assert.equal(rows[0]!.withdrawn, false);
  assert.equal(rows[1]!.livePermission, "none");
  assert.equal(rows[1]!.withdrawn, true);
  assert.equal(rows[2]!.livePermission, "none");
  assert.equal(rows[2]!.recordId, null);
  assert.ok(rows[2]!.accessibleLabel.includes("no authorization"));
});

test("tool and knowledge projection rows carry content-addressed labels only", () => {
  const toolRows = projectToolProjectionRows([
    {
      gapId: "fx-gap-001",
      toolId: "fx-content-tool",
      requiredCapability: "Substitute the toolchain.",
      remediation: "toolchain: Substitute the toolchain.",
    },
  ]);
  assert.equal(toolRows[0]!.toolId, "fx-content-tool");
  assert.equal(toolRows[0]!.requiredCapability, "Substitute the toolchain.");

  const knowledgeRows = projectKnowledgeProjectionRows([
    {
      gapId: "fx-gap-005",
      domain: "human-proportions",
      missingKnowledgeRef: "fx-content-knowledge",
      remediation: "human-proportions: Patch the planner.",
    },
  ]);
  assert.equal(knowledgeRows[0]!.domain, "human-proportions");
  assert.equal(knowledgeRows[0]!.missingKnowledgeRef, "fx-content-knowledge");

  // toolId 缺失（null）时显示空串（投影行不猜测）。
  const nullToolRows = projectToolProjectionRows([
    { gapId: "fx-gap-009", toolId: null, requiredCapability: "x", remediation: "y" },
  ]);
  assert.equal(nullToolRows[0]!.toolId, "");
});

test("region view model: loading without snapshot, empty without data, ready otherwise", () => {
  assert.equal(projectListRegionView(false, 0), "loading");
  assert.equal(projectListRegionView(true, 0), "empty");
  assert.equal(projectListRegionView(true, 3), "ready");
  assert.equal(projectListRegionView(false, 3), "loading");
});

test("authorization draft view: disabled reasons resolve in the fixed order", () => {
  const draft: {
    readonly scope: string | null;
    readonly expiryPresetId: AuthorizationExpiryPresetId;
    readonly learningPermission: ArenaLearningPermission | null;
  } = {
    scope: null,
    expiryPresetId: "no-expiry",
    learningPermission: null,
  };
  // 无升级 → no-escalation 最先。
  assert.equal(projectAuthorizationDraftView(draft, null).disabledReason, "no-escalation");
  // 终态/已交付升级 → escalation-closed。
  for (const status of ["delivered", "applied", "rejected", "cancelled"] as const) {
    assert.equal(
      projectAuthorizationDraftView(draft, { status }).disabledReason,
      "escalation-closed",
    );
  }
  // 开放升级：scope → permission 顺序。
  assert.equal(
    projectAuthorizationDraftView(draft, { status: "requested" }).disabledReason,
    "no-scope",
  );
  assert.equal(
    projectAuthorizationDraftView({ ...draft, scope: "solution:fx-portrait-001" }, { status: "requested" }).disabledReason,
    "no-permission",
  );
  assert.equal(
    projectAuthorizationDraftView(
      { ...draft, scope: "solution:fx-portrait-001", learningPermission: "aggregate" },
      { status: "requested" },
    ).disabledReason,
    null,
  );
});

test("cursor clamping keeps keyboard navigation in bounds", () => {
  assert.equal(clampEscalationIndex(-1, 4), 0);
  assert.equal(clampEscalationIndex(99, 4), 3);
  assert.equal(clampEscalationIndex(2, 4), 2);
  assert.equal(clampEscalationIndex(0, 0), 0);
});
