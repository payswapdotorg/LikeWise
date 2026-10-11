// Contract seam v5 tests (W5C) — coverage: adapter outputs construct VALID
// frozen v5 shapes through the single seam module (EditingSession /
// EditChangeSet / CandidateVersion / ImportExportResult /
// RoundTripBenchmarkReport / v5 EditorCapabilityProfile), the import/export
// format mapping is 1:1 at the seam, content-addressing laws hold, and only
// the seam module touches the frozen contract types.
import assert from "node:assert/strict";
import test from "node:test";
import {
  editingThroughAdapter,
  mapEditorKind,
  mapImportExportFormat,
  toFrozenCandidateVersion,
  toFrozenEditingSession,
  toFrozenEditChangeSet,
  toFrozenEditorCapabilityProfile,
  toFrozenImportExportResult,
  toFrozenRoundTripBenchmarkReport,
  toRoundTripEffortObservations,
} from "../contractSeam.js";
import { deriveEditingCapabilityProfiles } from "./capabilityProfiles.js";
import { createEditorRegistry } from "../technology/editorSeedProfiles.js";
import { createVscodeEditingEvaluationAdapter, VSCODE_EVALUATION_ADAPTER_ID } from "./vscodeEvaluationAdapter.js";
import { runStandardRoundTripBenchmark } from "./roundTripRunner.js";
import { createStandardEditingCandidates } from "./roundTripCandidates.js";
import { fixtureEditPlan, fixtureSubjectState, ROUND_TRIP_BENCHMARK_FIXTURES } from "./roundTripFixtures.js";

const registry = createEditorRegistry();
const capabilities = deriveEditingCapabilityProfiles(registry);

function seamRequest() {
  const fixture = ROUND_TRIP_BENCHMARK_FIXTURES[0]!;
  const state = fixtureSubjectState(fixture);
  return {
    requestId: "seam-req-1",
    editingSessionId: "es-seam-1",
    subjectArtifact: {
      artifactId: "art-seam-1",
      format: "json",
      contentRef: "content-store://you-lab/editing-fixture/seam",
      contentHash: "0".repeat(64),
      content: { entities: state.entities, environment: state.environment },
    },
    format: "json",
    editPlan: fixtureEditPlan(fixture),
    submittedAt: "2026-10-11T12:00:00Z",
  } as const;
}

test("contract seam v5: toFrozenEditorCapabilityProfile produces valid v5 capability shapes", () => {
  const vscode = capabilities.find((profile) => profile.id === "vscode");
  assert.ok(vscode);
  const frozen = toFrozenEditorCapabilityProfile(vscode);
  assert.equal(frozen.id, "vscode");
  assert.equal(frozen.editorKind, "native");
  assert.equal(frozen.displayName, "Visual Studio Code");
  assert.deepEqual(frozen.supportsFormats, ["edit-interchange", "json"]);
  assert.equal(frozen.roundTripSafe, true);
  assert.ok(frozen.notes.includes("byte-precise"));
  assert.ok(frozen.notes.includes("derivedFrom"));
  for (const profile of capabilities) {
    const mapped = toFrozenEditorCapabilityProfile(profile);
    assert.ok(["native", "embedded", "external"].includes(mapped.editorKind), `${profile.id}: frozen kind`);
    assert.ok(mapped.supportsFormats.length > 0, `${profile.id}: formats carried`);
  }
});

test("contract seam v5: import/export format and editor-kind mappings are 1:1 and validated", () => {
  assert.equal(mapImportExportFormat("json"), "json");
  assert.equal(mapImportExportFormat("edit-interchange"), "edit-interchange");
  assert.equal(mapImportExportFormat("scene-package"), "scene-package");
  assert.equal(mapImportExportFormat("gltf"), "gltf");
  assert.throws(() => mapImportExportFormat(""), /empty format/);
  assert.equal(mapEditorKind("native"), "native");
  assert.equal(mapEditorKind("embedded"), "embedded");
  assert.equal(mapEditorKind("external"), "external");
  assert.throws(() => mapEditorKind("telepathic" as never), /no frozen v5 mapping/);
});

test("contract seam v5: toFrozenEditingSession produces a valid frozen EditingSession", () => {
  const session = toFrozenEditingSession({
    sessionId: "es-1",
    subjectArtifactId: "art-1",
    editorKind: "native",
    openedAt: "2026-10-11T12:00:00Z",
  });
  assert.equal(session.id, "es-1");
  assert.equal(session.subjectArtifactId, "art-1");
  assert.equal(session.editorKind, "native");
  assert.equal(session.openedAt, "2026-10-11T12:00:00Z");
  assert.equal(session.status, "open");
  assert.equal(toFrozenEditingSession({ sessionId: "es-2", subjectArtifactId: "art-1", editorKind: "external", openedAt: "t", status: "abandoned" }).status, "abandoned");
  assert.throws(() => toFrozenEditingSession({ sessionId: "", subjectArtifactId: "a", editorKind: "native", openedAt: "t" }), /empty sessionId/);
});

test("contract seam v5: toFrozenEditChangeSet maps adapter change sets 1:1 with content addressing", () => {
  const adapter = createVscodeEditingEvaluationAdapter(registry);
  const output = adapter.invoke(seamRequest() as never);
  const frozen = toFrozenEditChangeSet(output.changeSet);
  assert.equal(frozen.id, output.changeSet.id);
  assert.equal(frozen.sessionId, output.changeSet.sessionId);
  assert.equal(frozen.createdAt, output.changeSet.createdAt);
  assert.equal(frozen.ops.length, output.changeSet.ops.length);
  for (let index = 0; index < frozen.ops.length; index++) {
    const frozenOp = frozen.ops[index];
    const neutralOp = output.changeSet.ops[index];
    assert.ok(frozenOp && neutralOp);
    assert.equal(frozenOp.id, neutralOp.id);
    assert.equal(frozenOp.kind, neutralOp.kind);
    assert.equal(frozenOp.payloadRef, neutralOp.payloadRef);
    assert.equal(frozenOp.payloadHash, neutralOp.payloadHash);
    // v5 law: payloads are NEVER inlined — the op record carries ref + hash only
    assert.deepEqual(Object.keys(frozenOp).sort(), ["id", "kind", "payloadHash", "payloadRef"]);
  }
  // invalid hash refuses mapping (content-addressing law enforced at the seam)
  assert.throws(
    () =>
      toFrozenEditChangeSet({
        ...output.changeSet,
        ops: [{ ...output.changeSet.ops[0]!, payloadHash: "not-a-hash" }],
      }),
    /not sha-256 hex/,
  );
});

test("contract seam v5: toFrozenCandidateVersion builds the artifact-lineage node (simulated)", () => {
  const version = toFrozenCandidateVersion({
    candidateVersionId: "cv-1",
    changeSetId: "ecs-1",
    parentVersionId: "parent-1",
    contentRef: "content-store://you-lab/editing/x/y",
    contentHash: "a".repeat(64),
    proposedAt: "2026-10-11T12:05:00Z",
  });
  assert.equal(version.id, "cv-1");
  assert.equal(version.changeSetId, "ecs-1");
  assert.equal(version.parentVersionId, "parent-1");
  assert.equal(version.contentRef, "content-store://you-lab/editing/x/y");
  assert.equal(version.contentHash, "a".repeat(64));
  assert.equal(version.simulated, true, "truth law: simulated round trips stay labeled");
  assert.throws(
    () => toFrozenCandidateVersion({ candidateVersionId: "cv-2", changeSetId: "ecs-1", parentVersionId: "p", contentRef: "c", contentHash: "short", proposedAt: "t" }),
    /not sha-256 hex/,
  );
});

test("contract seam v5: toFrozenImportExportResult maps the interchange outcome", () => {
  const succeeded = toFrozenImportExportResult({
    id: "ie-1",
    sessionId: "es-1",
    format: "edit-interchange",
    status: "succeeded",
    contentRef: "content-store://you-lab/editing/ie/1",
    contentHash: "b".repeat(64),
    completedAt: "2026-10-11T12:10:00Z",
  });
  assert.equal(succeeded.format, "edit-interchange");
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.contentRef, "content-store://you-lab/editing/ie/1");
  assert.equal(succeeded.simulated, true);
  assert.equal(toFrozenImportExportResult({ id: "ie-2", sessionId: null, format: "json", status: "failed", contentRef: null, contentHash: null, completedAt: "t" }).status, "failed");
  assert.throws(
    () => toFrozenImportExportResult({ id: "ie-3", sessionId: null, format: "json", status: "succeeded", contentRef: null, contentHash: null, completedAt: "t" }),
    /contentRef \+ contentHash/,
  );
});

test("contract seam v5: benchmark results project onto RoundTripBenchmarkReport with honest markers", () => {
  const report = runStandardRoundTripBenchmark(createStandardEditingCandidates(registry));
  const evalResult = report.candidateResults.find((entry) => entry.candidateId === VSCODE_EVALUATION_ADAPTER_ID);
  assert.ok(evalResult);
  const frozen = toFrozenRoundTripBenchmarkReport(evalResult);
  assert.equal(frozen.editorId, VSCODE_EVALUATION_ADAPTER_ID);
  assert.equal(frozen.format, "json");
  assert.ok(frozen.fidelityScore >= 0 && frozen.fidelityScore <= 1);
  assert.equal(frozen.simulated, true);
  assert.equal(frozen.effortObservations.simulated, true);
  assert.equal(frozen.effortObservations.roundTripEffort, "not-measured (simulated)");
  assert.equal(frozen.effortObservations["roundTripEffort.measured"], false);
  assert.equal(frozen.effortObservations.fixtureCount, 3);
  // every candidate projects with honest not-measured effort markers
  for (const result of report.candidateResults) {
    const observations = toRoundTripEffortObservations(result);
    assert.equal(observations["latencyMs.measured"], false);
    assert.equal(observations["costUnits.measured"], false);
    assert.equal(observations.simulated, true);
  }
});

test("contract seam v5: editingThroughAdapter constructs the full frozen v5 path from an adapter", () => {
  const adapter = createVscodeEditingEvaluationAdapter(registry);
  const { session, changeSet, candidateVersion, output } = editingThroughAdapter(adapter, seamRequest() as never, {
    subjectArtifactId: "art-seam-1",
    openedAt: "2026-10-11T12:00:00Z",
    candidateVersionId: "cv-seam-1",
    parentVersionId: "parent-seam-1",
    proposedAt: "2026-10-11T12:05:00Z",
  });
  assert.equal(session.id, "es-seam-1");
  assert.equal(session.subjectArtifactId, "art-seam-1");
  assert.equal(session.editorKind, "native");
  assert.equal(session.status, "committed");
  assert.equal(changeSet.sessionId, session.id);
  assert.equal(candidateVersion.changeSetId, changeSet.id);
  assert.equal(candidateVersion.parentVersionId, "parent-seam-1");
  // candidate content is content-addressed to the adapter's edited content
  assert.equal(candidateVersion.contentHash, output.editedContentHash);
  assert.ok(/^[0-9a-f]{64}$/.test(candidateVersion.contentHash));
  assert.ok(candidateVersion.contentRef.startsWith(`content-store://you-lab/editing/${VSCODE_EVALUATION_ADAPTER_ID}/`));
  assert.equal(candidateVersion.simulated, true);
  // deterministic replay: the full path is byte-stable
  const replay = editingThroughAdapter(adapter, seamRequest() as never, {
    subjectArtifactId: "art-seam-1",
    openedAt: "2026-10-11T12:00:00Z",
    candidateVersionId: "cv-seam-1",
    parentVersionId: "parent-seam-1",
    proposedAt: "2026-10-11T12:05:00Z",
  });
  assert.deepEqual(replay.session, session);
  assert.deepEqual(replay.changeSet, changeSet);
  assert.deepEqual(replay.candidateVersion, candidateVersion);
});
