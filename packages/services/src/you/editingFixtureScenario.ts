// YOU W5A editing fixture scenario — scripted, deterministic orchestration
// of the full wave-5 arrow (docs/you/WORK_ORDERS.md W5A; FIXTURES.md):
//
//   twin wiring (real wave-3 TwinService provides the bound version) ->
//   performance wiring (real wave-4 PerformanceService render job turns
//   the performed timeline into a reviewed artifact) -> subject
//   registration (the render artifact binds into the editing plane by
//   content ref on the SHARED wave-2 store) -> open session (tier-3
//   external editor) -> unregistered-editor-kind refusal -> propose edit
//   change set (ordered ops) -> stateless validation -> apply to the
//   subject root -> candidate version -> parent->candidate lineage query
//   -> deterministic interchange export (edit-interchange) -> failed
//   import (tampered content: typed refusal + honest failed record) ->
//   round-trip import identity check -> second change set applied to the
//   first candidate (deep lineage) -> candidate accepted (change-accepted)
//   -> session committed (edit-session-closed) -> abandoned-session path
//   (second session: change set -> candidate -> rejected (change-rejected)
//   -> abandoned) -> invalid-changeset refusal (empty op list) -> ledger
//   readout (projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seeds produces byte-identical
// traces (golden expectation). Fixture sessions/change sets/candidates/
// interchange results stay `simulated: true` (truth law).

import { stableStringify } from "../../../shared/src/you/serialize.js";
import { EditingService, type FixtureEditOpSpec } from "./editingService.js";
import { wireEditingSubject } from "./editingFixtureWiring.js";
import {
  EDITING_SCENARIO_SEED,
  EDITING_SCENARIO_SOLUTION_ID,
  outcomeCode as outcome,
  SCENARIO_OP_SPECS_1,
  SCENARIO_OP_SPECS_2,
  SCENARIO_OP_SPECS_3,
  SCENARIO_RENDER_CUE_SPECS,
  scenarioMust as must,
  scenarioStep as step,
  shortHash,
  tamperInterchangeContent,
  type EditingScenarioOptions,
  type EditingScenarioStep,
  type EditingScenarioTrace,
} from "./editingFixtureScenarioTypes.js";

export {
  EDITING_SCENARIO_SEED,
  EDITING_SCENARIO_SOLUTION_ID,
  SCENARIO_OP_SPECS_1,
  SCENARIO_OP_SPECS_2,
  SCENARIO_OP_SPECS_3,
  SCENARIO_RENDER_CUE_SPECS,
} from "./editingFixtureScenarioTypes.js";
export type { EditingScenarioOptions, EditingScenarioStep, EditingScenarioTrace } from "./editingFixtureScenarioTypes.js";

/**
 * Runs the full scripted editing scenario against freshly created
 * services. Deterministic: same seeds + same options => identical trace.
 */
export function runEditingFixtureScenario(options: EditingScenarioOptions = {}): EditingScenarioTrace {
  const solutionId = options.solutionId ?? EDITING_SCENARIO_SOLUTION_ID;

  // -- wiring: the real wave-3/wave-4 services provide the editing subject (steps 1-5) --

  const wiring = wireEditingSubject(options, solutionId);
  const editing: EditingService = wiring.editing;
  const subjectId = wiring.subjectId;

  const steps: EditingScenarioStep[] = [...wiring.steps];
  let stepIndex = steps.length;

  // -- open session (tier-3 external editor over the subject artifact) --

  const opened = must(
    editing.openEditingSession(solutionId, { subjectArtifactId: subjectId, editorKind: "external" }),
    "openEditingSession",
  );
  const sessionId = opened.session.id;
  steps.push(
    step((stepIndex += 1), "edit-session-opened", {
      editingSessionId: sessionId,
      subjectArtifactId: opened.session.subjectArtifactId,
      editorKind: opened.session.editorKind,
      status: opened.session.status,
      openedAt: opened.session.openedAt,
      editorProfileId: opened.profile.id,
      roundTripSafe: opened.profile.roundTripSafe,
    }),
  );

  // -- unregistered-editor-kind refusal (typed YOU_EDITOR_UNSUPPORTED) --

  const unsupportedEditor = editing.openEditingSession(solutionId, { subjectArtifactId: subjectId, editorKind: "quantum-editor" });
  steps.push(
    step((stepIndex += 1), "editor-kind-unsupported", {
      editorKind: "quantum-editor",
      outcome: outcome(unsupportedEditor),
      reason: unsupportedEditor.ok ? "" : (unsupportedEditor.error.details["reason"] ?? ""),
    }),
  );

  // -- propose edit change set (ordered ops) + stateless validation --

  const ops1 = must(
    editing.synthesizeEditOps(solutionId, { opSpecs: [...SCENARIO_OP_SPECS_1] as readonly FixtureEditOpSpec[], seedText: "w5a-scenario-edit-1" }),
    "synthesizeEditOps1",
  ).ops;
  steps.push(
    step((stepIndex += 1), "edit-ops-synthesized", {
      opCount: ops1.length,
      opKinds: ops1.map((op) => op.kind).join(","),
      opHashes: ops1.map((op) => shortHash(op.payloadHash)).join(","),
    }),
  );

  const changeSet1 = must(
    editing.proposeEditChangeSet(solutionId, { sessionId, ops: ops1 }),
    "proposeEditChangeSet1",
  ).changeSet;
  steps.push(
    step((stepIndex += 1), "edit-change-set-proposed", {
      editChangeSetId: changeSet1.id,
      editingSessionId: changeSet1.sessionId,
      opCount: changeSet1.ops.length,
      createdAt: changeSet1.createdAt,
    }),
  );

  const validation = editing.validateEditChangeSet(changeSet1);
  steps.push(
    step((stepIndex += 1), "edit-change-set-validated", {
      outcome: outcome(validation),
      opCount: validation.ok ? validation.value.opCount : 0,
    }),
  );

  // -- apply to the subject root -> candidate version -> lineage query --

  const candidate1 = must(
    editing.applyEditChangeSet(solutionId, { changeSetId: changeSet1.id, parentVersionId: subjectId }),
    "applyEditChangeSet1",
  ).candidate;
  steps.push(
    step((stepIndex += 1), "edit-change-set-applied", {
      editChangeSetId: changeSet1.id,
      parentVersionId: subjectId,
      candidateId: candidate1.id,
      simulated: candidate1.simulated,
    }),
  );
  steps.push(
    step((stepIndex += 1), "candidate-version-proposed", {
      candidateId: candidate1.id,
      editChangeSetId: candidate1.changeSetId,
      parentVersionId: candidate1.parentVersionId,
      contentRef: candidate1.contentRef,
      contentHash: shortHash(candidate1.contentHash),
      proposedAt: candidate1.proposedAt,
      simulated: candidate1.simulated,
    }),
  );

  const lineage1 = must(editing.candidatesOfParent(solutionId, subjectId), "candidatesOfParent1");
  const ancestry1 = must(editing.ancestryOfCandidate(solutionId, candidate1.id), "ancestryOfCandidate1");
  steps.push(
    step((stepIndex += 1), "candidate-lineage-queried", {
      parentVersionId: subjectId,
      candidateCount: lineage1.length,
      rootSubjectId: ancestry1.subject.id,
      chainLength: ancestry1.candidates.length,
      chainHead: ancestry1.candidates[ancestry1.candidates.length - 1]?.id ?? "",
    }),
  );

  // -- deterministic interchange export (edit-interchange, tier-4) --

  const exported = must(
    editing.exportFromSession(solutionId, { sessionId, format: "edit-interchange" }),
    "exportFromSession",
  );
  steps.push(
    step((stepIndex += 1), "interchange-exported", {
      resultId: exported.result.id,
      sessionId: exported.result.sessionId ?? "",
      format: exported.result.format,
      status: exported.result.status,
      contentRef: exported.result.contentRef ?? "",
      contentHash: shortHash(exported.result.contentHash ?? ""),
      packageByteLength: exported.packageBytes.byteLength,
      simulated: exported.result.simulated,
    }),
  );

  // -- failed import path: tampered content -> typed refusal + honest failed record --

  const failedImport = editing.importEditPackage(solutionId, {
    sessionId,
    format: "edit-interchange",
    packageBytes: tamperInterchangeContent(exported.packageBytes),
  });
  const failedImportResultId = failedImport.ok ? "" : String(failedImport.error.details["resultId"] ?? "");
  const failedImportRecord = failedImportResultId === "" ? null : must(editing.importExportResultOf(solutionId, failedImportResultId), "failedImportResultOf").result;
  steps.push(
    step((stepIndex += 1), "import-refused", {
      outcome: outcome(failedImport),
      reason: failedImport.ok ? "" : (failedImport.error.details["reason"] ?? ""),
      resultId: failedImportResultId,
      recordedStatus: failedImportRecord?.status ?? "",
      recordedContentRef: failedImportRecord?.contentRef ?? "",
      simulated: failedImportRecord?.simulated ?? false,
    }),
  );

  // -- round-trip export -> import identity check --

  const imported = must(
    editing.importEditPackage(solutionId, { sessionId, format: "edit-interchange", packageBytes: exported.packageBytes }),
    "importEditPackage",
  ).result;
  const roundTripIdentical = imported.status === "succeeded" && imported.contentHash === exported.result.contentHash;
  steps.push(
    step((stepIndex += 1), "interchange-imported", {
      resultId: imported.id,
      sessionId: imported.sessionId ?? "",
      format: imported.format,
      status: imported.status,
      contentHash: shortHash(imported.contentHash ?? ""),
      roundTripIdentical,
      simulated: imported.simulated,
    }),
  );

  // -- second change set (the imported edit) applied to the first candidate: deep lineage --

  const ops2 = must(
    editing.synthesizeEditOps(solutionId, { opSpecs: [...SCENARIO_OP_SPECS_2] as readonly FixtureEditOpSpec[], seedText: "w5a-scenario-edit-2" }),
    "synthesizeEditOps2",
  ).ops;
  const changeSet2 = must(
    editing.proposeEditChangeSet(solutionId, { sessionId, ops: ops2 }),
    "proposeEditChangeSet2",
  ).changeSet;
  const candidate2 = must(
    editing.applyEditChangeSet(solutionId, { changeSetId: changeSet2.id, parentVersionId: candidate1.id }),
    "applyEditChangeSet2",
  ).candidate;
  steps.push(
    step((stepIndex += 1), "second-change-set-applied", {
      editChangeSetId: changeSet2.id,
      parentVersionId: candidate1.id,
      candidateId: candidate2.id,
      opCount: changeSet2.ops.length,
      contentHash: shortHash(candidate2.contentHash),
    }),
  );

  const lineageOfCandidate1 = must(editing.candidatesOfParent(solutionId, candidate1.id), "candidatesOfParent2");
  const ancestry2 = must(editing.ancestryOfCandidate(solutionId, candidate2.id), "ancestryOfCandidate2");
  steps.push(
    step((stepIndex += 1), "candidate-lineage-deepened", {
      parentVersionId: candidate1.id,
      candidateCount: lineageOfCandidate1.length,
      chainLength: ancestry2.candidates.length,
      rootSubjectId: ancestry2.subject.id,
      chainHashes: ancestry2.candidates.map((candidate) => shortHash(candidate.contentHash)).join(","),
    }),
  );

  // -- candidate accepted (v1 change-accepted) -> session committed --

  const accepted = must(editing.resolveCandidateVersion(solutionId, { candidateId: candidate2.id, outcome: "accepted" }), "resolveCandidateAccepted");
  steps.push(
    step((stepIndex += 1), "candidate-accepted", {
      candidateId: accepted.candidate.id,
      editChangeSetId: accepted.candidate.changeSetId,
      resolution: accepted.resolution,
    }),
  );

  const committed = must(editing.commitEditingSession(solutionId, sessionId), "commitEditingSession");
  steps.push(
    step((stepIndex += 1), "edit-session-committed", {
      editingSessionId: committed.session.id,
      statusAfter: committed.session.status,
      openedAt: committed.session.openedAt,
    }),
  );

  // -- abandoned-session path: second session -> candidate rejected -> abandoned --

  const opened2 = must(
    editing.openEditingSession(solutionId, { subjectArtifactId: subjectId, editorKind: "embedded" }),
    "openEditingSession2",
  );
  const sessionId2 = opened2.session.id;
  const ops3 = must(
    editing.synthesizeEditOps(solutionId, { opSpecs: [...SCENARIO_OP_SPECS_3] as readonly FixtureEditOpSpec[], seedText: "w5a-scenario-edit-3" }),
    "synthesizeEditOps3",
  ).ops;
  const changeSet3 = must(
    editing.proposeEditChangeSet(solutionId, { sessionId: sessionId2, ops: ops3 }),
    "proposeEditChangeSet3",
  ).changeSet;
  const candidate3 = must(
    editing.applyEditChangeSet(solutionId, { changeSetId: changeSet3.id, parentVersionId: subjectId }),
    "applyEditChangeSet3",
  ).candidate;
  steps.push(
    step((stepIndex += 1), "rejected-candidate-proposed", {
      editingSessionId: sessionId2,
      editorKind: opened2.session.editorKind,
      editChangeSetId: changeSet3.id,
      candidateId: candidate3.id,
      parentVersionId: candidate3.parentVersionId,
    }),
  );

  const rejected = must(
    editing.resolveCandidateVersion(solutionId, { candidateId: candidate3.id, outcome: "rejected", reason: "fixture-discarded-edit" }),
    "resolveCandidateRejected",
  );
  steps.push(
    step((stepIndex += 1), "candidate-rejected", {
      candidateId: rejected.candidate.id,
      editChangeSetId: rejected.candidate.changeSetId,
      resolution: rejected.resolution,
    }),
  );

  // -- invalid-changeset refusal (empty op list, against the still-open session) --

  const invalidChangeSet = editing.proposeEditChangeSet(solutionId, { sessionId: sessionId2, ops: [] });
  steps.push(
    step((stepIndex += 1), "invalid-changeset-refused", {
      outcome: outcome(invalidChangeSet),
      reason: invalidChangeSet.ok ? "" : (invalidChangeSet.error.details["reason"] ?? ""),
      detail: invalidChangeSet.ok ? "" : (invalidChangeSet.error.details["detail"] ?? ""),
    }),
  );

  const abandoned = must(editing.abandonEditingSession(solutionId, sessionId2), "abandonEditingSession");
  steps.push(
    step((stepIndex += 1), "edit-session-abandoned", {
      editingSessionId: abandoned.session.id,
      statusAfter: abandoned.session.status,
    }),
  );

  // -- ledger readout: projection == replay --

  const events = must(editing.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const ledgerHash = must(editing.ledgerHashOf(solutionId), "ledgerHashOf");
  const projection = must(editing.projectionOf(solutionId), "projectionOf");
  const replayed = EditingService.replay(events);
  const projectionMatchesReplay = stableStringify(projection) === stableStringify(replayed);
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      sessionCount: Object.keys(projection.editingSessions).length,
      changeSetCount: Object.keys(projection.changeSets).length,
      candidateCount: Object.keys(projection.candidates).length,
      resolvedCandidateCount: Object.keys(projection.candidateResolutions).length,
      importExportCount: Object.keys(projection.importExports).length,
      editingStoreSize: editing.contentStoreSize(),
    }),
  );

  return {
    solutionId,
    twinId: wiring.twinId,
    twinVersionId: wiring.twinVersionId,
    performanceId: wiring.performanceId,
    renderJobId: wiring.renderJobId,
    renderArtifactId: wiring.renderArtifactId,
    subjectId,
    committedSessionId: sessionId,
    abandonedSessionId: sessionId2,
    changeSetIds: [changeSet1.id, changeSet2.id, changeSet3.id],
    candidateIds: [candidate1.id, candidate2.id, candidate3.id],
    exportResultId: exported.result.id,
    failedImportResultId,
    importResultId: imported.id,
    eventCount: events.length,
    ledgerHash,
    editingStoreSize: editing.contentStoreSize(),
    projectionMatchesReplay,
    steps,
  };
}

/** Canonical serialization of a trace (golden comparisons). */
export function serializeEditingScenarioTrace(trace: EditingScenarioTrace): string {
  return stableStringify(trace);
}
