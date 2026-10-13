// W9B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：run 状态阶梯投影（visited 派生自 lab-run-recorded 事件流——绝非 UI 本地
// 状态）、三臂比较视图（判定 pending/beats/ties/loses——严格不等式）、实验/ run /
// manifest / promotion / 搜索阶梯显示行（内容寻址标签 + accessibleLabel）、
// promotion 门纯投影（九 reason 固定求值序）、声明/run/晋升草稿视图、区域
// loading/empty/ready、键盘转移与光标夹紧。
import assert from "node:assert/strict";
import test from "node:test";
import type { LabRun, SolutionEvent } from "@zcode/shared";
import {
  projectLabPromotionGate,
  type LabManifestView,
  type LabPromotionEntry,
  type LabStudioSnapshot,
} from "./labController.js";
import {
  clampLabIndex,
  labLadderVisitedCount,
  projectExperimentDraftView,
  projectExperimentRows,
  projectLabListRegionView,
  projectLabRunLadder,
  projectLabRunRows,
  projectManifestRows,
  projectPromotionRows,
  projectPromotionDraftView,
  projectRunDraftView,
  projectSearchLadderRows,
  projectThreeArmComparison,
  resolveLabKeyboardTransition,
} from "./labStudioProjection.js";

function runEvent(
  runId: string,
  statusAfter: string,
  occurredAt: string,
): SolutionEvent {
  return {
    id: `fx-event-${runId}-${statusAfter}`,
    solutionId: "fx-lab-studio",
    type: "lab-run-recorded",
    occurredAt,
    subjectRef: runId,
    payload: { runId, statusAfter },
    provenance: { source: "test", generator: "fixture", createdAt: occurredAt, lineage: [] },
  };
}

test("run ladder projects visited rungs from the lab-run-recorded event stream, never UI-local state", () => {
  const events = [
    runEvent("fx-run-001", "submitted", "2025-06-02T09:00:01.000Z"),
    runEvent("fx-run-001", "running", "2025-06-02T09:00:02.000Z"),
    runEvent("fx-run-001", "succeeded", "2025-06-02T09:00:03.000Z"),
    runEvent("fx-run-002", "submitted", "2025-06-02T09:00:04.000Z"),
  ];
  const run = { status: "succeeded" as const };
  const ladder = projectLabRunLadder(run, events, "fx-run-001");
  assert.equal(ladder.length, 5);
  // visited：submitted/running/succeeded 到达（来自事件流），failed/retired 未到达。
  const byStatus = new Map(ladder.map((step) => [step.status, step]));
  assert.equal(byStatus.get("submitted")!.reached, true);
  assert.equal(byStatus.get("running")!.reached, true);
  assert.equal(byStatus.get("succeeded")!.reached, true);
  assert.equal(byStatus.get("succeeded")!.current, true);
  assert.equal(byStatus.get("succeeded")!.terminal, true);
  assert.equal(byStatus.get("failed")!.reached, false);
  assert.equal(byStatus.get("retired")!.reached, false);
  // 时刻以事件 occurredAt 为准。
  assert.equal(byStatus.get("running")!.at, "2025-06-02T09:00:02.000Z");
  assert.equal(labLadderVisitedCount(ladder), 3);

  // 其它 run 的事件不串扰（runId 过滤）。
  const other = projectLabRunLadder({ status: "submitted" as const }, events, "fx-run-002");
  assert.equal(
    other.filter((step) => step.reached).map((step) => step.status).join(","),
    "submitted",
  );

  // retired 路径（submitted -> retired 的优雅移除终态）。
  const retiredEvents = [
    runEvent("fx-run-003", "submitted", "2025-06-02T09:00:05.000Z"),
    runEvent("fx-run-003", "retired", "2025-06-02T09:00:06.000Z"),
  ];
  const retiredLadder = projectLabRunLadder(
    { status: "retired" as const },
    retiredEvents,
    "fx-run-003",
  );
  const retiredBy = new Map(retiredLadder.map((step) => [step.status, step]));
  assert.equal(retiredBy.get("retired")!.reached, true);
  assert.equal(retiredBy.get("retired")!.current, true);
  assert.equal(retiredBy.get("running")!.reached, false);

  // 事件缺失时当前档兜底标记（防御，不猜时间——at 为空串）。
  const bare = projectLabRunLadder({ status: "running" as const }, [], "fx-run-004");
  const bareBy = new Map(bare.map((step) => [step.status, step]));
  assert.equal(bareBy.get("running")!.reached, true);
  assert.equal(bareBy.get("running")!.at, "");
});

test("three-arm comparison derives the strict-inequality verdict from projected scores", () => {
  const armRow = (arm: string, score: number | null) => ({
    experimentId: "fx-experiment-001",
    arm: arm as "generalist-baseline" | "hand-designed" | "searched",
    score,
    runCount: 1,
    succeededCount: score === null ? 0 : 1,
    bestRunId: score === null ? null : "fx-run-001",
    evidenceManifestId: score === null ? null : "fx-manifest-001",
    simulated: true,
  });
  // pending：无 succeeded run。
  assert.equal(
    projectThreeArmComparison([
      armRow("generalist-baseline", null),
      armRow("hand-designed", null),
      armRow("searched", null),
    ]).verdict,
    "pending",
  );
  // beats：0.78 > 0.62。
  const beats = projectThreeArmComparison([
    armRow("generalist-baseline", 0.62),
    armRow("hand-designed", 0.71),
    armRow("searched", 0.78),
  ]);
  assert.equal(beats.verdict, "beats");
  assert.equal(beats.baselineScore, 0.62);
  assert.equal(beats.searchedScore, 0.78);
  assert.equal(beats.arms.length, 3);
  assert.equal(beats.arms[0]!.arm, "generalist-baseline");
  assert.equal(beats.arms[2]!.arm, "searched");
  assert.ok(beats.accessibleLabel.includes("beats"));
  // ties：0.66 === 0.66（严格不等式——持平不晋升）。
  assert.equal(
    projectThreeArmComparison([
      armRow("generalist-baseline", 0.66),
      armRow("hand-designed", 0.72),
      armRow("searched", 0.66),
    ]).verdict,
    "ties",
  );
  // loses：0.74 < 0.80。
  assert.equal(
    projectThreeArmComparison([
      armRow("generalist-baseline", 0.8),
      armRow("hand-designed", 0.75),
      armRow("searched", 0.74),
    ]).verdict,
    "loses",
  );
  // 缺 searched 分数（臂仍在跑）→ pending。
  assert.equal(
    projectThreeArmComparison([
      armRow("generalist-baseline", 0.62),
      armRow("hand-designed", null),
      armRow("searched", null),
    ]).verdict,
    "pending",
  );
});

test("experiment rows project declaration facts plus world/budget context with accessible labels", () => {
  const rows = projectExperimentRows(
    [
      {
        id: "fx-experiment-001",
        intentRef: "fx-intent-001",
        objective: "Maximize realism.",
        constraintsHash: "sha256-fixture-c",
        arms: ["generalist-baseline", "hand-designed", "searched"],
        promotionRef: null,
      },
    ],
    [
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
    ],
    [
      {
        id: "fx-run-001",
        experimentId: "fx-experiment-001",
        arm: "searched",
        planHash: "sha256-fixture-p",
        status: "succeeded",
        submittedAt: "t1",
        completedAt: "t2",
        evidenceManifestRef: "fx-manifest-001",
        simulated: true,
      },
    ],
  );
  assert.equal(rows.length, 1);
  const row = rows[0]!;
  assert.equal(row.experimentId, "fx-experiment-001");
  assert.equal(row.armCount, 3);
  assert.equal(row.worldSeed, "you-w9b-world-alpha");
  assert.equal(row.worldActorCount, 4);
  assert.equal(row.searchBudget, 6);
  assert.equal(row.searchExhausted, false);
  assert.equal(row.runCount, 1);
  assert.equal(row.promotionRef, null);
  assert.ok(row.accessibleLabel.includes("generalist-baseline / hand-designed / searched"));
  assert.ok(row.accessibleLabel.includes("you-w9b-world-alpha"));
  // 缺上下文时的防御投影（空世界/零预算）。
  const bare = projectExperimentRows(
    [
      {
        id: "fx-experiment-002",
        intentRef: "fx-intent-002",
        objective: "o",
        constraintsHash: "c",
        arms: ["searched"],
        promotionRef: "fx-promotion-001",
      },
    ],
    [],
    [],
  );
  assert.equal(bare[0]!.worldSeed, "");
  assert.equal(bare[0]!.searchBudget, 0);
  assert.equal(bare[0]!.promotionRef, "fx-promotion-001");
});

test("run rows, manifest rows and promotion rows carry content-addressed labels and supersedes links", () => {
  const runRows = projectLabRunRows([
    {
      id: "fx-run-001",
      experimentId: "fx-experiment-001",
      arm: "searched",
      planHash: "sha256-fixture-plan",
      status: "succeeded",
      submittedAt: "t1",
      completedAt: "t2",
      evidenceManifestRef: "fx-manifest-001",
      simulated: true,
    } satisfies LabRun,
  ]);
  assert.ok(runRows[0]!.accessibleLabel.includes("sha256-fixture-plan"));
  assert.ok(runRows[0]!.accessibleLabel.includes("fx-manifest-001"));

  const manifestView: LabManifestView = {
    manifest: {
      id: "fx-manifest-001",
      runId: "fx-run-001",
      contentHash: "sha256-fixture-manifest",
      artifactRefs: ["fx-content-a1", "fx-content-a2"],
      publishedAt: "t3",
      simulated: true,
    },
    verification: "verified",
    verifiedAt: "t4",
  };
  const manifestRows = projectManifestRows([manifestView]);
  assert.equal(manifestRows[0]!.verification, "verified");
  assert.equal(manifestRows[0]!.artifactRows.length, 2);
  assert.ok(manifestRows[0]!.artifactRows[0]!.accessibleLabel.includes("fx-content-a1"));
  assert.ok(manifestRows[0]!.accessibleLabel.includes("sha256-fixture-manifest"));

  const entries: LabPromotionEntry[] = [
    {
      record: {
        id: "fx-promotion-001",
        experimentId: "fx-experiment-001",
        winnerArm: "searched",
        objectiveScore: 0.78,
        baselineScore: 0.62,
        evidenceManifestRef: "fx-manifest-001",
        decidedAt: "t5",
        simulated: true,
      },
      kind: "promotion",
      supersedesRecordId: null,
    },
    {
      record: {
        id: "fx-promotion-002",
        experimentId: "fx-experiment-001",
        winnerArm: "searched",
        objectiveScore: 0.78,
        baselineScore: 0.62,
        evidenceManifestRef: "fx-manifest-001",
        decidedAt: "t6",
        simulated: true,
      },
      kind: "reversal",
      supersedesRecordId: "fx-promotion-001",
    },
  ];
  const promotionRows = projectPromotionRows(entries);
  assert.equal(promotionRows[1]!.kind, "reversal");
  assert.equal(promotionRows[1]!.supersedesRecordId, "fx-promotion-001");
  assert.ok(promotionRows[1]!.accessibleLabel.includes("supersedes fx-promotion-001"));

  const searchRows = projectSearchLadderRows([
    {
      id: "fx-ladder-step-001",
      step: 1,
      strategy: "beam-search",
      exploredNodes: 1,
      bestScore: 0.78,
      cumulativeBudget: 6,
    },
    {
      id: "fx-ladder-step-002",
      step: 2,
      strategy: "budget-exhausted",
      exploredNodes: 0,
      bestScore: 0.78,
      cumulativeBudget: 1,
    },
  ]);
  assert.equal(searchRows[0]!.exhaustedTerminal, false);
  assert.equal(searchRows[1]!.exhaustedTerminal, true);
  assert.ok(searchRows[1]!.accessibleLabel.includes("recorded exhaustion terminal"));
});

test("promotion gate pure projection walks the fixed evaluation order fail-closed", () => {
  const verifiedManifest: LabManifestView = {
    manifest: {
      id: "fx-manifest-001",
      runId: "fx-run-001",
      contentHash: "h",
      artifactRefs: ["a"],
      publishedAt: "t",
      simulated: true,
    },
    verification: "verified",
    verifiedAt: null,
  };
  const snapshot = {
    experiments: [
      {
        id: "fx-experiment-001",
        intentRef: "i",
        constraintsHash: "c",
        objective: "o",
        arms: ["generalist-baseline", "hand-designed", "searched" as const],
        promotionRef: null,
        simulated: true,
      },
    ],
    armScores: [
      {
        experimentId: "fx-experiment-001",
        arm: "searched" as const,
        score: 0.78,
        runCount: 1,
        succeededCount: 1,
        bestRunId: "fx-run-001",
        evidenceManifestId: "fx-manifest-001",
        simulated: true,
      },
      {
        experimentId: "fx-experiment-001",
        arm: "generalist-baseline" as const,
        score: 0.62,
        runCount: 1,
        succeededCount: 1,
        bestRunId: "fx-run-000",
        evidenceManifestId: null,
        simulated: true,
      },
    ],
    manifests: [verifiedManifest],
    promotionLedger: [],
  } as unknown as LabStudioSnapshot;

  // granted：全条件满足。
  assert.deepEqual(
    projectLabPromotionGate(snapshot, "fx-experiment-001", "searched", "fx-manifest-001"),
    { allowed: true, reason: "granted" },
  );
  // 未知实验。
  assert.deepEqual(
    projectLabPromotionGate(snapshot, "fx-experiment-999", "searched", "fx-manifest-001"),
    { allowed: false, reason: "unknown-experiment" },
  );
  // null 快照 → unknown-experiment。
  assert.deepEqual(
    projectLabPromotionGate(null, null, null, null),
    { allowed: false, reason: "unknown-experiment" },
  );
  // 非 searched winner。
  assert.deepEqual(
    projectLabPromotionGate(snapshot, "fx-experiment-001", "generalist-baseline", "fx-manifest-001"),
    { allowed: false, reason: "non-searched-winner" },
  );
  // 未知证据。
  assert.deepEqual(
    projectLabPromotionGate(snapshot, "fx-experiment-001", "searched", "fx-manifest-999"),
    { allowed: false, reason: "unknown-evidence-manifest" },
  );
  // 未校验证据。
  const unverifiedSnapshot = {
    ...snapshot,
    manifests: [{ ...verifiedManifest, verification: "unverified" }],
  } as unknown as LabStudioSnapshot;
  assert.deepEqual(
    projectLabPromotionGate(unverifiedSnapshot, "fx-experiment-001", "searched", "fx-manifest-001"),
    { allowed: false, reason: "evidence-unverified" },
  );
  // no-improvement：searched 0.62 <= baseline 0.62。
  const tieSnapshot = {
    ...snapshot,
    armScores: snapshot.armScores.map((entry) =>
      entry.arm === "searched" ? { ...entry, score: 0.62 } : entry,
    ),
  } as unknown as LabStudioSnapshot;
  assert.deepEqual(
    projectLabPromotionGate(tieSnapshot, "fx-experiment-001", "searched", "fx-manifest-001"),
    { allowed: false, reason: "no-improvement" },
  );
  // already-decided：live promotionRef 存在。
  const decidedSnapshot = {
    ...snapshot,
    experiments: [
      { ...snapshot.experiments[0]!, promotionRef: "fx-promotion-001" },
    ],
    promotionLedger: [
      {
        record: {
          id: "fx-promotion-001",
          experimentId: "fx-experiment-001",
          winnerArm: "searched" as const,
          objectiveScore: 0.78,
          baselineScore: 0.62,
          evidenceManifestRef: "fx-manifest-001",
          decidedAt: "t",
          simulated: true,
        },
        kind: "promotion" as const,
        supersedesRecordId: null,
      },
    ],
  } as unknown as LabStudioSnapshot;
  assert.deepEqual(
    projectLabPromotionGate(decidedSnapshot, "fx-experiment-001", "searched", "fx-manifest-001"),
    { allowed: false, reason: "already-decided" },
  );
  // reversal 后门重新打开：promotionRef 指向 reversal 记录（kind ≠ promotion）。
  const reversedSnapshot = {
    ...decidedSnapshot,
    experiments: [
      { ...snapshot.experiments[0]!, promotionRef: "fx-promotion-002" },
    ],
    promotionLedger: [
      ...decidedSnapshot.promotionLedger,
      {
        record: {
          id: "fx-promotion-002",
          experimentId: "fx-experiment-001",
          winnerArm: "searched" as const,
          objectiveScore: 0.78,
          baselineScore: 0.62,
          evidenceManifestRef: "fx-manifest-001",
          decidedAt: "t2",
          simulated: true,
        },
        kind: "reversal" as const,
        supersedesRecordId: "fx-promotion-001",
      },
    ],
  } as unknown as LabStudioSnapshot;
  assert.deepEqual(
    projectLabPromotionGate(reversedSnapshot, "fx-experiment-001", "searched", "fx-manifest-001"),
    { allowed: true, reason: "granted" },
  );
  // no-benchmark-evidence：searched 分数缺失。
  const noEvidenceSnapshot = {
    ...snapshot,
    armScores: snapshot.armScores.map((entry) =>
      entry.arm === "searched" ? { ...entry, score: null } : entry,
    ),
  } as unknown as LabStudioSnapshot;
  assert.deepEqual(
    projectLabPromotionGate(noEvidenceSnapshot, "fx-experiment-001", "searched", "fx-manifest-001"),
    { allowed: false, reason: "no-benchmark-evidence" },
  );
});

test("draft views expose deterministic disabled reasons", () => {
  // 声明草稿：no-spec → invalid-world → invalid-budget 固定序。
  const registry = {
    worldPresets: [
      { id: "world-alpha", valid: true },
      { id: "world-empty-seed", valid: false },
    ],
    budgetPresets: [
      { id: "budget-standard", valid: true },
      { id: "budget-zero", valid: false },
    ],
  };
  assert.equal(
    projectExperimentDraftView(
      { specId: null, worldPresetId: "world-alpha", budgetPresetId: "budget-standard" },
      registry,
    ).disabledReason,
    "no-spec",
  );
  assert.equal(
    projectExperimentDraftView(
      { specId: "fx-labspec-001", worldPresetId: "world-empty-seed", budgetPresetId: "budget-standard" },
      registry,
    ).disabledReason,
    "invalid-world",
  );
  assert.equal(
    projectExperimentDraftView(
      { specId: "fx-labspec-001", worldPresetId: "world-alpha", budgetPresetId: "budget-zero" },
      registry,
    ).disabledReason,
    "invalid-budget",
  );
  assert.equal(
    projectExperimentDraftView(
      { specId: "fx-labspec-001", worldPresetId: "world-alpha", budgetPresetId: "budget-standard" },
      registry,
    ).disabledReason,
    null,
  );
  // 未知预设视为非法（缺省回退语义）。
  assert.equal(
    projectExperimentDraftView(
      { specId: "s", worldPresetId: "world-unknown", budgetPresetId: "budget-standard" },
      registry,
    ).disabledReason,
    "invalid-world",
  );

  // run 草稿：no-experiment / arm-not-in-experiment。
  assert.equal(projectRunDraftView("searched", null).disabledReason, "no-experiment");
  assert.equal(
    projectRunDraftView("searched", { arms: ["generalist-baseline"] }).disabledReason,
    "arm-not-in-experiment",
  );
  assert.equal(
    projectRunDraftView("searched", { arms: ["generalist-baseline", "searched"] }).disabledReason,
    null,
  );

  // 晋升草稿视图只是候选/证据/门的纯载体。
  const draft = projectPromotionDraftView("searched", "m1", {
    allowed: false,
    reason: "evidence-unverified",
  });
  assert.equal(draft.candidateArm, "searched");
  assert.equal(draft.evidenceManifestId, "m1");
  assert.equal(draft.gate.reason, "evidence-unverified");
});

test("region views: no snapshot -> loading, snapshot without rows -> empty, rows -> ready", () => {
  assert.equal(projectLabListRegionView(false, 0), "loading");
  assert.equal(projectLabListRegionView(true, 0), "empty");
  assert.equal(projectLabListRegionView(true, 3), "ready");
  assert.equal(projectLabListRegionView(false, 3), "loading");
});

test("keyboard transitions and cursor clamping mirror the sibling surfaces", () => {
  const state = { totalExperiments: 4 };
  assert.deepEqual(resolveLabKeyboardTransition("ArrowUp", state), { kind: "move", delta: -1 });
  assert.deepEqual(resolveLabKeyboardTransition("ArrowDown", state), { kind: "move", delta: 1 });
  assert.deepEqual(resolveLabKeyboardTransition("Home", state), { kind: "move", delta: -4 });
  assert.deepEqual(resolveLabKeyboardTransition("End", state), { kind: "move", delta: 4 });
  assert.deepEqual(resolveLabKeyboardTransition("Enter", state), { kind: "select" });
  assert.deepEqual(resolveLabKeyboardTransition("PageDown", state), { kind: "none" });
  assert.equal(clampLabIndex(-3, 4), 0);
  assert.equal(clampLabIndex(99, 4), 3);
  assert.equal(clampLabIndex(2, 4), 2);
  assert.equal(clampLabIndex(0, 0), 0);
});
