// W6B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖：记录状态阶梯（candidate/validated/rejected/superseded 终态互斥）、
// scope ladder（GLOBAL→TASK 到达语义）、signal/evidence/kind picker 行、
// ledger 按状态分组、rights 行（usage + consent 链接 + 惰性标记）、偏好行
//（derived-from lineage）、trajectory 步骤行（内容寻址标签 ONLY）、区域视图模型、
// 键盘转移表（与 W1B–W5B 表面同级的键盘可用性）、teach-me 草稿视图模型。
import assert from "node:assert/strict";
import test from "node:test";
import {
  clampSignalIndex,
  projectDraftEvidenceRefs,
  projectEvidenceOptions,
  projectKindOptions,
  projectLedgerRecordRow,
  projectLedgerView,
  projectListRegionView,
  projectPreferenceRows,
  projectRecordLadder,
  projectRightsRows,
  projectScopeLadder,
  projectSignalDraftView,
  projectSignalEvidenceRows,
  projectSignalRows,
  projectTrajectoryRows,
  projectTrajectoryStepRows,
  resolveLearningKeyboardTransition,
} from "./learningStudioProjection.js";
import type {
  LearningRecord,
  LearningSignal,
  TrajectoryReference,
} from "@zcode/shared";
import { LEARNING_SIGNAL_DRAFT_EMPTY } from "./learningStudioStore.js";
import { STORYBOARD_INERT_RIGHTS } from "./learningStoryboardLaws.js";
import {
  LEARNING_STORYBOARD_EVIDENCE,
  LEARNING_STORYBOARD_KIND_REGISTRY,
  storyboardContentBinding,
} from "./learningStoryboard.js";

const INERT_RIGHTS = STORYBOARD_INERT_RIGHTS;
const BOUND_RIGHTS = {
  usage: ["personalization" as const, "tool-selection" as const],
  consentRef: "fx-learning-consent-001",
  consentHash: "sha256-fixture-abcdef1234567890",
  expiresAt: null,
};

function fixtureRecord(overrides: Partial<LearningRecord> = {}): LearningRecord {
  return {
    id: "fx-learnrecord-001",
    signalId: "fx-learnsignal-001",
    status: "validated",
    scope: "USER",
    contentRef: "fx-content-record",
    contentHash: "sha256-fixture-record",
    rights: BOUND_RIGHTS,
    validatedAt: "2026-01-01T00:00:00.000Z",
    supersededById: null,
    simulated: true,
    ...overrides,
  };
}

test("record status ladder: candidate is the process step, terminals are mutually exclusive", () => {
  // candidate：过程步已到达，终态均未到达。
  assert.deepEqual(
    projectRecordLadder("candidate").map((step) => [step.status, step.reached, step.current]),
    [
      ["candidate", true, true],
      ["validated", false, false],
      ["rejected", false, false],
      ["superseded", false, false],
    ],
  );
  // validated：candidate 已过 + validated 当前；rejected/superseded 未到达。
  assert.deepEqual(
    projectRecordLadder("validated").map((step) => [step.status, step.reached, step.current]),
    [
      ["candidate", true, false],
      ["validated", true, true],
      ["rejected", false, false],
      ["superseded", false, false],
    ],
  );
  // rejected / superseded：互斥终态，只有当前态算 reached。
  for (const terminal of ["rejected", "superseded"] as const) {
    const ladder = projectRecordLadder(terminal);
    assert.equal(ladder.find((step) => step.status === terminal)!.current, true);
    assert.equal(ladder.find((step) => step.status === "validated")!.reached, false);
  }
});

test("scope ladder: GLOBAL is always reached; narrower scopes below the effective scope stay out of effect", () => {
  const ladder = projectScopeLadder("PROJECT");
  assert.deepEqual(
    ladder.map((step) => [step.scope, step.reached, step.current]),
    [
      ["GLOBAL", true, false],
      ["TENANT", true, false],
      ["APPLICATION", true, false],
      ["PROJECT", true, true],
      ["USER", false, false],
      ["TWIN", false, false],
      ["ASSET", false, false],
      ["TASK", false, false],
    ],
  );
  // GLOBAL 自身：恒已到达且当前。
  const globalLadder = projectScopeLadder("GLOBAL");
  assert.equal(globalLadder[0]!.current, true);
  assert.equal(globalLadder[7]!.reached, false);
  // TASK（最窄）：全部到达。
  const taskLadder = projectScopeLadder("TASK");
  assert.equal(taskLadder.every((step) => step.reached), true);
});

test("signal rows carry content-addressed evidence counts and accessible labels", () => {
  const signal: LearningSignal = {
    id: "fx-learnsignal-001",
    kind: "feedback",
    scope: "USER",
    subjectRef: "fx-learnevidence-001",
    evidenceRefs: ["fx-content-a", "fx-content-b"],
    capturedAt: "2026-01-01T00:00:00.000Z",
    simulated: true,
  };
  const [row] = projectSignalRows([signal]);
  assert.ok(row);
  assert.equal(row.signalId, signal.id);
  assert.equal(row.evidenceCount, 2);
  assert.match(row.accessibleLabel, /signal fx-learnsignal-001: feedback at USER scope/);

  // 检视信号的 evidence 行：内容寻址标签 ONLY（绝不内联内容）。
  const evidenceRows = projectSignalEvidenceRows(signal.evidenceRefs);
  assert.deepEqual(
    evidenceRows.map((entry) => entry.evidenceRef),
    ["fx-content-a", "fx-content-b"],
  );
  assert.match(evidenceRows[1]!.accessibleLabel, /^evidence 2: fx-content-b$/);
});

test("kind picker options render the six frozen kinds in registry order", () => {
  const options = projectKindOptions(LEARNING_STORYBOARD_KIND_REGISTRY);
  assert.deepEqual(
    options.map((option) => option.kind),
    [
      "feedback",
      "manual-takeover",
      "edit-session",
      "expert-intervention",
      "repeated-intent",
      "capability-gap",
    ],
  );
  for (const option of options) {
    assert.ok(option.displayName.length > 0);
    assert.ok(option.hint.length > 0);
  }
});

test("evidence options carry content-addressed bindings and origin-plane labels", () => {
  const rows = projectEvidenceOptions(LEARNING_STORYBOARD_EVIDENCE);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(row.contentRef.startsWith("fx-content-"));
    assert.ok(row.contentHash.startsWith("sha256-fixture-"));
    assert.match(row.accessibleLabel, new RegExp(`from ${row.originPlane}`));
  }
});

test("ledger view groups records by the status ladder with inert and supersession markers", () => {
  const records: readonly LearningRecord[] = [
    fixtureRecord({ id: "fx-learnrecord-001", status: "candidate", rights: INERT_RIGHTS }),
    fixtureRecord({ id: "fx-learnrecord-002", status: "validated" }),
    fixtureRecord({ id: "fx-learnrecord-003", status: "rejected", rights: INERT_RIGHTS }),
    fixtureRecord({
      id: "fx-learnrecord-004",
      status: "superseded",
      supersededById: "fx-learnrecord-002",
    }),
  ];
  const view = projectLedgerView(records);
  assert.equal(view.total, 4);
  assert.deepEqual(view.candidate.map((row) => row.recordId), ["fx-learnrecord-001"]);
  assert.deepEqual(view.validated.map((row) => row.recordId), ["fx-learnrecord-002"]);
  assert.deepEqual(view.rejected.map((row) => row.recordId), ["fx-learnrecord-003"]);
  assert.deepEqual(view.superseded.map((row) => row.recordId), ["fx-learnrecord-004"]);
  // 惰性标记与 supersession 链接进 accessibleLabel（非仅颜色）。
  assert.equal(view.candidate[0]!.inert, true);
  assert.equal(view.validated[0]!.inert, false);
  assert.equal(view.superseded[0]!.supersededById, "fx-learnrecord-002");
  assert.match(view.superseded[0]!.accessibleLabel, /superseded by fx-learnrecord-002/);
  assert.match(view.candidate[0]!.accessibleLabel, /inert \(no rights\)/);

  // 单行投影同款字段。
  const row = projectLedgerRecordRow(records[1]!);
  assert.equal(row.status, "validated");
  assert.equal(row.scope, "USER");
  assert.equal(row.contentRef, "fx-content-record");
});

test("rights rows expose usage classes, consent linkage, expiry and the inert flag", () => {
  const rows = projectRightsRows([
    fixtureRecord({ id: "fx-learnrecord-001", status: "validated" }),
    fixtureRecord({ id: "fx-learnrecord-002", status: "validated", rights: INERT_RIGHTS }),
    fixtureRecord({
      id: "fx-learnrecord-003",
      status: "validated",
      rights: { ...BOUND_RIGHTS, expiresAt: "2026-06-01T00:00:00.000Z" },
    }),
  ]);
  assert.deepEqual(rows[0]!.usage, ["personalization", "tool-selection"]);
  assert.equal(rows[0]!.consentRef, "fx-learning-consent-001");
  assert.equal(rows[0]!.consentHash, "sha256-fixture-abcdef1234567890");
  assert.equal(rows[0]!.expiresAt, null);
  assert.equal(rows[0]!.inert, false);
  assert.match(rows[0]!.accessibleLabel, /usage personalization, tool-selection under consent/);

  assert.equal(rows[1]!.inert, true);
  assert.equal(rows[1]!.usage.length, 0);
  assert.match(rows[1]!.accessibleLabel, /inert \(no rights grant/);

  assert.equal(rows[2]!.expiresAt, "2026-06-01T00:00:00.000Z");
  assert.match(rows[2]!.accessibleLabel, /expires 2026-06-01/);
});

test("preference rows expose the derived-from lineage (operator seed = null lineage)", () => {
  const rows = projectPreferenceRows([
    {
      id: "fx-learnpref-001",
      scope: "USER",
      key: "preferred-editor",
      value: "fixture-external-editor",
      derivedFromRecordId: "fx-learnrecord-002",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "fx-learnpref-002",
      scope: "GLOBAL",
      key: "organization-baseline",
      value: "fixture-baseline",
      derivedFromRecordId: null,
      updatedAt: "2026-01-01T00:00:01.000Z",
    },
  ]);
  assert.equal(rows[0]!.derivedFromRecordId, "fx-learnrecord-002");
  assert.match(rows[0]!.accessibleLabel, /derived from record fx-learnrecord-002/);
  assert.equal(rows[1]!.derivedFromRecordId, null);
  assert.match(rows[1]!.accessibleLabel, /operator seed/);
});

test("trajectory rows and step rows are content-addressed labels only", () => {
  const trajectory: TrajectoryReference = {
    id: "fx-traj-001",
    scope: "USER",
    stepRefs: ["fx-content-step-a", "fx-content-step-b"],
    createdAt: "2026-01-01T00:00:00.000Z",
    simulated: true,
  };
  const [row] = projectTrajectoryRows([trajectory]);
  assert.ok(row);
  assert.equal(row.trajectoryId, "fx-traj-001");
  assert.equal(row.stepCount, 2);
  assert.match(row.accessibleLabel, /2 content-addressed steps/);

  const stepRows = projectTrajectoryStepRows(trajectory.stepRefs);
  assert.deepEqual(
    stepRows.map((entry) => [entry.index, entry.stepRef]),
    [
      [0, "fx-content-step-a"],
      [1, "fx-content-step-b"],
    ],
  );
  // 步骤行只有标签——没有内容字段可投影（绝不内联）。
  assert.deepEqual(Object.keys(stepRows[0]!), ["index", "stepRef", "accessibleLabel"]);
});

test("list region view model: loading without a snapshot, empty with no data, ready otherwise", () => {
  assert.equal(projectListRegionView(false, 0), "loading");
  assert.equal(projectListRegionView(true, 0), "empty");
  assert.equal(projectListRegionView(true, 3), "ready");
  assert.equal(projectListRegionView(false, 3), "loading");
});

test("keyboard parity with the sibling surfaces: signal list is fully keyboard-navigable", () => {
  const state = { totalSignals: 3 };
  assert.deepEqual(resolveLearningKeyboardTransition("ArrowUp", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveLearningKeyboardTransition("ArrowDown", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveLearningKeyboardTransition("ArrowLeft", state), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveLearningKeyboardTransition("ArrowRight", state), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveLearningKeyboardTransition("Home", state), {
    kind: "move",
    delta: -3,
  });
  assert.deepEqual(resolveLearningKeyboardTransition("End", state), {
    kind: "move",
    delta: 3,
  });
  assert.deepEqual(resolveLearningKeyboardTransition("Enter", state), { kind: "select" });
  assert.deepEqual(resolveLearningKeyboardTransition("Escape", state), { kind: "none" });

  // 光标夹紧保证键盘导航不会越界。
  assert.equal(clampSignalIndex(-1, 3), 0);
  assert.equal(clampSignalIndex(99, 3), 2);
  assert.equal(clampSignalIndex(0, 0), 0);
});

test("teach-me draft view model: deterministic disabled reason (kind -> scope -> evidence)", () => {
  assert.deepEqual(
    projectSignalDraftView(LEARNING_SIGNAL_DRAFT_EMPTY).disabledReason,
    "no-kind",
  );
  assert.deepEqual(
    projectSignalDraftView({ kind: "feedback", scope: null, evidenceIds: [] }).disabledReason,
    "no-scope",
  );
  assert.deepEqual(
    projectSignalDraftView({
      kind: "feedback",
      scope: "USER",
      evidenceIds: [],
    }).disabledReason,
    "no-evidence",
  );
  assert.deepEqual(
    projectSignalDraftView({
      kind: "feedback",
      scope: "USER",
      evidenceIds: ["fx-learnevidence-001"],
    }).disabledReason,
    null,
  );
});

test("draft evidence refs resolve through the snapshot registry (content-addressed labels)", () => {
  const snapshot = {
    evidence: LEARNING_STORYBOARD_EVIDENCE,
  } as unknown as Parameters<typeof projectDraftEvidenceRefs>[0];
  const refs = projectDraftEvidenceRefs(snapshot, [
    "fx-learnevidence-002",
    "fx-learnevidence-999",
  ]);
  assert.deepEqual(refs, [LEARNING_STORYBOARD_EVIDENCE[1]!.contentRef]);
  assert.ok(refs[0]!.startsWith("fx-content-"));
  assert.deepEqual(projectDraftEvidenceRefs(null, ["fx-learnevidence-001"]), []);
  void storyboardContentBinding;
});
