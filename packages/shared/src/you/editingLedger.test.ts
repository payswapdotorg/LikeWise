import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { SolutionEventLedger } from "./events.js";
import { replayEditingLedger } from "./editingLedger.js";

const SOLUTION = "you_w5a_ledger_test";

function makeLedger(): SolutionEventLedger {
  return new SolutionEventLedger(SOLUTION, {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0055)),
  });
}

function fullEditingLedger(): SolutionEventLedger {
  const ledger = makeLedger();
  ledger.append({
    type: "edit-session-opened",
    subjectRef: "es1",
    payload: { editingSessionId: "es1", subjectArtifactId: "subj1", editorKind: "external", statusAfter: "open", simulated: true },
  });
  ledger.append({
    type: "change-proposed",
    subjectRef: "cs1",
    payload: {
      editChangeSetId: "cs1",
      editingSessionId: "es1",
      opCount: 2,
      "op.0.id": "op1",
      "op.0.kind": "transform",
      "op.0.payloadRef": "you_content_aaa",
      "op.0.payloadHash": "a".repeat(64),
      "op.1.id": "op2",
      "op.1.kind": "material",
      "op.1.payloadRef": "you_content_bbb",
      "op.1.payloadHash": "b".repeat(64),
      simulated: true,
    },
  });
  ledger.append({
    type: "change-set-applied",
    subjectRef: "cs1",
    payload: { editChangeSetId: "cs1", editingSessionId: "es1", parentVersionId: "subj1", opCount: 2, simulated: true },
  });
  ledger.append({
    type: "candidate-version-proposed",
    subjectRef: "cand1",
    payload: { candidateId: "cand1", editChangeSetId: "cs1", parentVersionId: "subj1", contentRef: "you_content_ccc", contentHash: "c".repeat(64), simulated: true },
  });
  ledger.append({
    type: "candidate-version-proposed",
    subjectRef: "cand2",
    payload: { candidateId: "cand2", editChangeSetId: "cs1", parentVersionId: "cand1", contentRef: "you_content_ddd", contentHash: "d".repeat(64), simulated: true },
  });
  ledger.append({
    type: "change-accepted",
    subjectRef: "cand2",
    payload: { candidateId: "cand2", editChangeSetId: "cs1", editingSessionId: "es1", simulated: true },
  });
  ledger.append({
    type: "import-export-completed",
    subjectRef: "ie1",
    payload: {
      resultId: "ie1",
      direction: "export",
      format: "edit-interchange",
      editingSessionId: "es1",
      status: "succeeded",
      contentRef: "you_content_eee",
      contentHash: "e".repeat(64),
      byteLength: 3736,
      simulated: true,
    },
  });
  ledger.append({
    type: "import-export-completed",
    subjectRef: "ie2",
    payload: {
      resultId: "ie2",
      direction: "import",
      format: "edit-interchange",
      editingSessionId: "",
      status: "failed",
      contentRef: "",
      contentHash: "",
      byteLength: 0,
      simulated: true,
    },
  });
  ledger.append({
    type: "edit-session-closed",
    subjectRef: "es1",
    payload: { editingSessionId: "es1", statusAfter: "committed", simulated: true },
  });
  ledger.append({
    type: "edit-session-opened",
    subjectRef: "es2",
    payload: { editingSessionId: "es2", subjectArtifactId: "subj1", editorKind: "embedded", statusAfter: "open", simulated: true },
  });
  ledger.append({
    type: "change-rejected",
    subjectRef: "cand3",
    payload: { candidateId: "cand3", editChangeSetId: "cs2", editingSessionId: "es2", reason: "fixture-discarded-edit", simulated: true },
  });
  ledger.append({
    type: "edit-session-closed",
    subjectRef: "es2",
    payload: { editingSessionId: "es2", statusAfter: "abandoned", simulated: true },
  });
  return ledger;
}

test("replayEditingLedger requires at least one event", () => {
  assert.throws(() => replayEditingLedger([]));
});

test("the fold reproduces sessions, change sets (ordered ops), candidates, lineage and resolutions", () => {
  const ledger = fullEditingLedger();
  const projection = replayEditingLedger(ledger.events());
  assert.equal(projection.solutionId, SOLUTION);

  assert.deepEqual(projection.editingSessions["es1"], {
    subjectArtifactId: "subj1",
    editorKind: "external",
    status: "committed",
  });
  assert.deepEqual(projection.editingSessions["es2"], {
    subjectArtifactId: "subj1",
    editorKind: "embedded",
    status: "abandoned",
  });

  assert.deepEqual(projection.changeSets["cs1"], {
    sessionId: "es1",
    opCount: 2,
    ops: [
      { id: "op1", kind: "transform", payloadRef: "you_content_aaa", payloadHash: "a".repeat(64) },
      { id: "op2", kind: "material", payloadRef: "you_content_bbb", payloadHash: "b".repeat(64) },
    ],
  });

  assert.deepEqual(projection.candidates["cand1"], {
    changeSetId: "cs1",
    parentVersionId: "subj1",
    contentRef: "you_content_ccc",
    contentHash: "c".repeat(64),
    simulated: true,
  });
  assert.deepEqual(projection.candidates["cand2"], {
    changeSetId: "cs1",
    parentVersionId: "cand1",
    contentRef: "you_content_ddd",
    contentHash: "d".repeat(64),
    simulated: true,
  });

  // Lineage: parent -> candidate edges in proposal order.
  assert.deepEqual(projection.candidateIdsByParent["subj1"], ["cand1"]);
  assert.deepEqual(projection.candidateIdsByParent["cand1"], ["cand2"]);

  assert.deepEqual(projection.candidateResolutions, { cand2: "accepted", cand3: "rejected" });

  assert.deepEqual(projection.importExports["ie1"], {
    sessionId: "es1",
    direction: "export",
    format: "edit-interchange",
    status: "succeeded",
    contentRef: "you_content_eee",
    contentHash: "e".repeat(64),
    simulated: true,
  });
  // A failed import/export result carries no content binding ("" in the fold).
  assert.deepEqual(projection.importExports["ie2"], {
    sessionId: "",
    direction: "import",
    format: "edit-interchange",
    status: "failed",
    contentRef: "",
    contentHash: "",
    simulated: true,
  });
});

test("the fold is deterministic: same events => byte-identical projection", () => {
  const ledger = fullEditingLedger();
  const first = replayEditingLedger(ledger.events());
  const second = replayEditingLedger(ledger.events());
  assert.equal(stableStringify(first), stableStringify(second));
});

test("later events win: session status transitions and re-opened lineages fold in event order", () => {
  const ledger = makeLedger();
  ledger.append({
    type: "edit-session-opened",
    subjectRef: "es1",
    payload: { editingSessionId: "es1", subjectArtifactId: "subj", editorKind: "native", statusAfter: "open", simulated: true },
  });
  ledger.append({
    type: "edit-session-closed",
    subjectRef: "es1",
    payload: { editingSessionId: "es1", statusAfter: "abandoned", simulated: true },
  });
  ledger.append({
    type: "edit-session-closed",
    subjectRef: "es1",
    payload: { editingSessionId: "es1", statusAfter: "committed", simulated: true },
  });
  const projection = replayEditingLedger(ledger.events());
  assert.equal(projection.editingSessions["es1"]?.status, "committed");

  // Two candidates under the same parent fold in proposal order.
  const ledger2 = makeLedger();
  for (const candidateId of ["candA", "candB"]) {
    ledger2.append({
      type: "candidate-version-proposed",
      subjectRef: candidateId,
      payload: { candidateId, editChangeSetId: "cs", parentVersionId: "subj", contentRef: "r", contentHash: "h", simulated: true },
    });
  }
  const lineage = replayEditingLedger(ledger2.events());
  assert.deepEqual(lineage.candidateIdsByParent["subj"], ["candA", "candB"]);
});

test("non-editing events are ignored by the editing fold", () => {
  const ledger = makeLedger();
  ledger.append({
    type: "performance-published",
    subjectRef: "perf1",
    payload: { kind: "publication", performanceId: "perf1", twinVersionId: "tv", basedOnTemplateId: "", timelineId: "tl", cueCount: 1, durationMs: 100, trackKinds: "motion", simulated: true },
  });
  ledger.append({
    type: "render-job-submitted",
    subjectRef: "job1",
    payload: { jobId: "job1", performanceId: "perf1", method: "image-render", outputKinds: "image", outputKindCount: 1, parameterCount: 0, simulated: true },
  });
  ledger.append({
    type: "version-published",
    subjectRef: "v1",
    payload: { versionId: "v1", versionNumber: 1, parentVersionId: "", authorType: "agent", "quality.identity": 1, simulated: true },
  });
  const projection = replayEditingLedger(ledger.events());
  assert.equal(projection.solutionId, SOLUTION);
  assert.deepEqual(projection.editingSessions, {});
  assert.deepEqual(projection.changeSets, {});
  assert.deepEqual(projection.candidates, {});
  assert.deepEqual(projection.candidateIdsByParent, {});
  assert.deepEqual(projection.candidateResolutions, {});
  assert.deepEqual(projection.importExports, {});
});
