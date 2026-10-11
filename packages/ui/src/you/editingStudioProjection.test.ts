// W5B logic tests — Editing 视图纯投影（node:test，无 DOM）。
//
// 覆盖：会话状态阶梯（open/committed/abandoned——终态互斥）、op 行投影（内容寻址
// payload 标签）、候选对比行、root → leaf 谱系链投影、import/export 结果行、
// 键盘转移与导出草稿转移、选择器（sessionById / candidatesOfParent /
// changeSetsOfSession / lastExportDigest / lastImportDigest / projectEditingConsentGate）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateParentOf,
  changeSetsOfSession,
  editingSessionById,
  interchangeFactOf,
  lastExportDigest,
  lastImportDigest,
  lineageChainOfCandidate,
  orderedEditingSessions,
  projectEditingConsentGate,
  sessionSubjectRootId,
  candidatesOfParent,
  type EditingStudioSnapshot,
} from "./editingController.js";
import {
  EXPORT_DRAFT_EMPTY,
  clampSessionIndex,
  projectCandidateCompareRow,
  projectImportExportRows,
  projectLineageRows,
  projectOpRows,
  projectSessionLadder,
  resolveEditingKeyboardTransition,
  setExportDraftFormat,
} from "./editingStudioProjection.js";
import { buildStoryboardEditOp } from "./editingStoryboard.js";

test("session ladder: open is a process step; committed and abandoned are mutually exclusive terminals", () => {
  const openLadder = projectSessionLadder("open");
  assert.deepEqual(
    openLadder.map((step) => [step.status, step.reached, step.current]),
    [
      ["open", true, true],
      ["committed", false, false],
      ["abandoned", false, false],
    ],
  );

  const committedLadder = projectSessionLadder("committed");
  assert.deepEqual(
    committedLadder.map((step) => [step.status, step.reached, step.current]),
    [
      ["open", true, false],
      ["committed", true, true],
      ["abandoned", false, false],
    ],
  );

  const abandonedLadder = projectSessionLadder("abandoned");
  assert.deepEqual(
    abandonedLadder.map((step) => [step.status, step.reached, step.current]),
    [
      ["open", true, false],
      ["committed", false, false],
      ["abandoned", true, true],
    ],
  );
});

test("op rows keep the proposal order and carry content-addressed payload labels (never inlined content)", () => {
  const ops = [
    buildStoryboardEditOp("transform", "t-1"),
    buildStoryboardEditOp("material", "m-1"),
  ];
  const rows = projectOpRows(ops);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.index),
    [0, 1],
  );
  assert.equal(rows[0]!.kind, "transform");
  assert.equal(rows[1]!.kind, "material");
  for (const row of rows) {
    assert.ok(row.payloadRef.startsWith("fx-content-"));
    assert.ok(row.payloadHash.startsWith("sha256-fixture-"));
    // 可访问标签（aria）包含内容寻址标签（非仅颜色）。
    assert.ok(row.accessibleLabel.includes("payload"));
    assert.ok(row.accessibleLabel.includes(row.payloadHash));
  }
  // 空列表 → 空投影。
  assert.deepEqual(projectOpRows([]), []);
});

test("candidate compare row carries parent + candidate content addressing", () => {
  const candidate = {
    id: "fx-editcandidate-001",
    changeSetId: "fx-editchangeset-001",
    parentVersionId: "fx-editsubject-001",
    contentRef: "fx-content-abc",
    contentHash: "sha256-fixture-abc",
    proposedAt: "2026-01-01T00:00:04.000Z",
  };
  const row = projectCandidateCompareRow(candidate, "sha256-fixture-parent");
  assert.equal(row.candidateId, candidate.id);
  assert.equal(row.parentVersionId, candidate.parentVersionId);
  assert.equal(row.parentContentHash, "sha256-fixture-parent");
  assert.equal(row.candidateContentRef, candidate.contentRef);
  assert.equal(row.candidateContentHash, candidate.contentHash);
  assert.ok(row.accessibleLabel.includes("candidate fx-editcandidate-001 from fx-editsubject-001"));
  // 未知 parent 哈希（未知 parent 版本）如实呈现 null。
  const unknownParent = projectCandidateCompareRow(candidate, null);
  assert.equal(unknownParent.parentContentHash, null);
});

function fixtureSnapshot(): EditingStudioSnapshot {
  return {
    displayName: "Editing Studio — fixture",
    studioId: "fx-editing-studio-001",
    subjects: [
      {
        id: "fx-editsubject-001",
        displayName: "Rendered still — fixture",
        contentRef: "fx-content-subj1",
        contentHash: "sha256-fixture-subj1",
        originPlane: "performance/render",
        simulated: true,
      },
    ],
    editorProfiles: [],
    supportedFormats: ["edit-interchange"],
    sessions: [
      {
        id: "fx-editsession-001",
        subjectArtifactId: "fx-editsubject-001",
        editorKind: "native",
        openedAt: "2026-01-01T00:00:01.000Z",
        status: "open",
      },
    ],
    changeSets: [],
    candidates: [
      {
        id: "fx-editcandidate-001",
        changeSetId: "fx-editchangeset-001",
        parentVersionId: "fx-editsubject-001",
        contentRef: "fx-content-c1",
        contentHash: "sha256-fixture-c1",
        proposedAt: "2026-01-01T00:00:02.000Z",
        simulated: true,
      },
      {
        id: "fx-editcandidate-002",
        changeSetId: "fx-editchangeset-002",
        parentVersionId: "fx-editcandidate-001",
        contentRef: "fx-content-c2",
        contentHash: "sha256-fixture-c2",
        proposedAt: "2026-01-01T00:00:03.000Z",
        simulated: true,
      },
    ],
    candidateResolutions: [],
    importExports: [],
    externalLaunches: [],
    takeovers: [],
    interchangeFacts: [],
    consent: {
      policy: {
        id: "fx-editing-consent-001",
        purposes: ["export", "manual-takeover"],
        scope: "USER",
        operationalUse: false,
        learningReuse: false,
        retention: {
          policy: "delete-after-review",
          deleteAfter: null,
          reason: "fixture",
        },
        revocable: true,
      },
      purposeStates: [
        { purpose: "export", state: "granted" },
        { purpose: "manual-takeover", state: "unknown" },
      ],
      reference: {
        policyId: "fx-editing-consent-001",
        state: "granted",
        learningPermission: false,
      },
    },
    events: [],
    simulated: true,
  };
}

test("lineage chain: root first, leaf last, candidates chained through parents", () => {
  const snapshot = fixtureSnapshot();
  assert.deepEqual(lineageChainOfCandidate(snapshot, "fx-editcandidate-002"), [
    "fx-editsubject-001",
    "fx-editcandidate-001",
    "fx-editcandidate-002",
  ]);
  assert.deepEqual(lineageChainOfCandidate(snapshot, "fx-editcandidate-001"), [
    "fx-editsubject-001",
    "fx-editcandidate-001",
  ]);
  // 未知候选 / null → []（显式未知态，不猜测）。
  assert.deepEqual(lineageChainOfCandidate(snapshot, "fx-editcandidate-999"), []);
  assert.deepEqual(lineageChainOfCandidate(snapshot, null), []);
  assert.deepEqual(lineageChainOfCandidate(null, "fx-editcandidate-001"), []);
});

test("lineage rows label the subject root and candidates with depth", () => {
  const snapshot = fixtureSnapshot();
  const chain = lineageChainOfCandidate(snapshot, "fx-editcandidate-002");
  const rows = projectLineageRows(snapshot, chain);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.depth]),
    [
      ["subject-root", 0],
      ["candidate", 1],
      ["candidate", 2],
    ],
  );
  assert.equal(rows[0]!.contentHash, "sha256-fixture-subj1");
  assert.equal(rows[1]!.contentHash, "sha256-fixture-c1");
  assert.equal(rows[2]!.contentHash, "sha256-fixture-c2");
  // 空 chain → 空投影。
  assert.deepEqual(projectLineageRows(snapshot, []), []);
  assert.deepEqual(projectLineageRows(null, chain), []);
});

test("import/export rows surface succeeded/failed status and content bindings truthfully", () => {
  const rows = projectImportExportRows([
    {
      id: "fx-importexport-001",
      sessionId: "fx-editsession-001",
      format: "edit-interchange",
      status: "succeeded",
      contentRef: "fx-content-export1",
      contentHash: "sha256-fixture-export1",
      completedAt: "2026-01-01T00:00:05.000Z",
      simulated: true,
    },
    {
      id: "fx-importexport-002",
      sessionId: null,
      format: "json",
      status: "failed",
      contentRef: null,
      contentHash: null,
      completedAt: "2026-01-01T00:00:06.000Z",
      simulated: true,
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.status, "succeeded");
  assert.equal(rows[0]!.contentRef, "fx-content-export1");
  assert.equal(rows[1]!.status, "failed");
  assert.equal(rows[1]!.contentRef, null);
  assert.ok(rows[1]!.accessibleLabel.includes("no content binding"));
});

test("snapshot selectors: sessions, session by id, subject root, parents, change sets", () => {
  const snapshot = fixtureSnapshot();
  assert.equal(orderedEditingSessions(snapshot).length, 1);
  assert.equal(editingSessionById(snapshot, "fx-editsession-001")?.status, "open");
  assert.equal(editingSessionById(snapshot, "fx-editsession-999"), null);
  assert.equal(editingSessionById(snapshot, null), null);
  assert.equal(sessionSubjectRootId(snapshot, "fx-editsession-001"), "fx-editsubject-001");
  assert.equal(sessionSubjectRootId(snapshot, null), null);
  assert.equal(candidateParentOf(snapshot, "fx-editcandidate-002"), "fx-editcandidate-001");
  assert.equal(candidateParentOf(snapshot, null), null);
  assert.equal(candidatesOfParent(snapshot, "fx-editsubject-001").length, 1);
  assert.equal(candidatesOfParent(snapshot, null).length, 0);
  assert.deepEqual(changeSetsOfSession(snapshot, "fx-editsession-001"), []);
  assert.deepEqual(changeSetsOfSession(snapshot, null), []);
});

test("interchange digest selectors: latest succeeded export/import digests (round-trip check inputs)", () => {
  const snapshot: EditingStudioSnapshot = {
    ...fixtureSnapshot(),
    interchangeFacts: [
      { resultId: "r1", direction: "export", format: "edit-interchange", status: "succeeded", packageDigest: "digest-1" },
      { resultId: "r2", direction: "import", format: "edit-interchange", status: "failed", packageDigest: null },
      { resultId: "r3", direction: "import", format: "edit-interchange", status: "succeeded", packageDigest: "digest-1" },
      { resultId: "r4", direction: "export", format: "json", status: "succeeded", packageDigest: "digest-2" },
    ],
  };
  // 「最近一次」取追加序末位（r4 的 digest-2——即使 r1 也是 succeeded export）。
  assert.equal(lastExportDigest(snapshot), "digest-2");
  assert.equal(lastImportDigest(snapshot), "digest-1");
  assert.equal(interchangeFactOf(snapshot, "r2")?.status, "failed");
  assert.equal(interchangeFactOf(snapshot, "r2")?.packageDigest, null);
  assert.equal(interchangeFactOf(snapshot, "r-unknown"), null);
  assert.equal(lastExportDigest(null), null);
  assert.equal(lastImportDigest(null), null);
});

test("consent gate projection: only explicit granted allows (no permission ⇒ no processing)", () => {
  const snapshot = fixtureSnapshot();
  // export granted → allowed。
  const exportGate = projectEditingConsentGate(snapshot.consent, "export");
  assert.equal(exportGate.allowed, true);
  assert.equal(exportGate.state, "granted");
  assert.equal(exportGate.reason, "granted");
  // manual-takeover unknown → blocked。
  const takeoverGate = projectEditingConsentGate(snapshot.consent, "manual-takeover");
  assert.equal(takeoverGate.allowed, false);
  assert.equal(takeoverGate.state, "unknown");
  assert.equal(takeoverGate.reason, "unknown");
  // 政策外用途 → unknown（显式未知态，不猜测）。
  const unknownPurpose = projectEditingConsentGate(snapshot.consent, "learning");
  assert.equal(unknownPurpose.allowed, false);
  assert.equal(unknownPurpose.state, "unknown");
});

test("export draft and keyboard transitions stay pure view math", () => {
  assert.deepEqual(EXPORT_DRAFT_EMPTY, { format: null });
  const draft = setExportDraftFormat(EXPORT_DRAFT_EMPTY, "json");
  assert.deepEqual(draft, { format: "json" });
  // 原草稿不变（纯转移）。
  assert.deepEqual(EXPORT_DRAFT_EMPTY, { format: null });

  assert.deepEqual(resolveEditingKeyboardTransition("Enter", { totalSessions: 2 }), {
    kind: "select",
  });
  assert.deepEqual(resolveEditingKeyboardTransition("Escape", { totalSessions: 2 }), {
    kind: "none",
  });
  assert.equal(clampSessionIndex(7, 3), 2);
});
