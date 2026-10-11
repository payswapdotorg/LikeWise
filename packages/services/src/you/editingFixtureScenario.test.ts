import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import {
  EDITING_SCENARIO_SEED,
  EDITING_SCENARIO_SOLUTION_ID,
  runEditingFixtureScenario,
  serializeEditingScenarioTrace,
  type EditingScenarioTrace,
} from "./editingFixtureScenario.js";

const EXPECTED_STEP_NAMES = [
  "twin-created",
  "twin-version-canonical",
  "performance-published",
  "render-job-completed",
  "subject-registered",
  "edit-session-opened",
  "editor-kind-unsupported",
  "edit-ops-synthesized",
  "edit-change-set-proposed",
  "edit-change-set-validated",
  "edit-change-set-applied",
  "candidate-version-proposed",
  "candidate-lineage-queried",
  "interchange-exported",
  "import-refused",
  "interchange-imported",
  "second-change-set-applied",
  "candidate-lineage-deepened",
  "candidate-accepted",
  "edit-session-committed",
  "rejected-candidate-proposed",
  "candidate-rejected",
  "invalid-changeset-refused",
  "edit-session-abandoned",
  "ledger-readout",
];

function runScenario(): EditingScenarioTrace {
  return runEditingFixtureScenario();
}

function stepOf(trace: EditingScenarioTrace, name: string) {
  const found = trace.steps.find((step) => step.name === name);
  assert.ok(found !== undefined, `missing step ${name}`);
  return found.facts;
}

test("the editing scenario runs the full wave-5 arrow and records every scripted step", () => {
  const trace = runScenario();
  assert.equal(trace.solutionId, EDITING_SCENARIO_SOLUTION_ID);
  assert.deepEqual(
    trace.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  for (let index = 0; index < trace.steps.length; index += 1) {
    assert.equal(trace.steps[index]?.step, index + 1);
  }
});

test("the editing scenario is deterministic: two fresh runs are byte-identical", () => {
  const first = runScenario();
  const second = runScenario();
  assert.equal(serializeEditingScenarioTrace(first), serializeEditingScenarioTrace(second));
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.subjectId, second.subjectId);
  assert.equal(first.committedSessionId, second.committedSessionId);
  assert.deepEqual(first.changeSetIds, second.changeSetIds);
  assert.deepEqual(first.candidateIds, second.candidateIds);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.eventCount, second.eventCount);
  assert.equal(first.editingStoreSize, second.editingStoreSize);
  assert.equal(stableStringify(first.steps), stableStringify(second.steps));
});

test("the scenario satisfies the W5A golden facts (frozen fixture definition)", () => {
  const trace = runScenario();

  // Twin wiring: a real canonical TwinVersion provides the binding.
  const twinVersion = stepOf(trace, "twin-version-canonical");
  assert.equal(twinVersion["status"], "canonical");
  assert.equal(twinVersion["versionNumber"], 1);
  assert.equal(twinVersion["domainBlockCount"], 3);
  assert.equal(trace.twinVersionId, twinVersion["twinVersionId"]);

  // Performance wiring: the real wave-4 render job produces the subject artifact.
  const render = stepOf(trace, "render-job-completed");
  assert.equal(render["status"], "completed");
  assert.equal(render["artifactCount"], 1);
  assert.equal(render["artifactKind"], "image");
  assert.equal(render["artifactContentHash"], "94f240f6");
  assert.equal(render["simulated"], true);

  // Subject registration: the render artifact binds by content ref.
  const subject = stepOf(trace, "subject-registered");
  assert.equal(subject["contentHash"], "94f240f6");
  assert.equal(subject["contentRef"], "you_content_94f240f656afeee0");
  assert.equal(subject["simulated"], true);
  assert.equal(trace.subjectId, subject["subjectId"]);

  // Session: tier-3 external editor over the subject artifact.
  const opened = stepOf(trace, "edit-session-opened");
  assert.equal(opened["editorKind"], "external");
  assert.equal(opened["status"], "open");
  assert.equal(opened["editorProfileId"], "you-fixture-editor-external");
  assert.equal(opened["roundTripSafe"], true);
  assert.equal(opened["subjectArtifactId"], trace.subjectId);
  assert.equal(trace.committedSessionId, opened["editingSessionId"]);

  // Unregistered editor kind: the typed refusal.
  const unsupported = stepOf(trace, "editor-kind-unsupported");
  assert.equal(unsupported["outcome"], "YOU_EDITOR_UNSUPPORTED");
  assert.equal(unsupported["reason"], "unregistered-editor-kind");

  // Ordered ops: three fixture kinds with golden payload hashes.
  const ops = stepOf(trace, "edit-ops-synthesized");
  assert.equal(ops["opCount"], 3);
  assert.equal(ops["opKinds"], "transform,material,annotation");
  assert.equal(ops["opHashes"], "3adf76e4,c80f0ff6,0171c1d6");

  // Proposal + validation arrows.
  const proposed = stepOf(trace, "edit-change-set-proposed");
  assert.equal(proposed["opCount"], 3);
  assert.equal(proposed["editingSessionId"], trace.committedSessionId);
  const validated = stepOf(trace, "edit-change-set-validated");
  assert.equal(validated["outcome"], "OK");
  assert.equal(validated["opCount"], 3);

  // Application: subject root -> candidate 1 (golden content hash).
  const applied = stepOf(trace, "edit-change-set-applied");
  assert.equal(applied["parentVersionId"], trace.subjectId);
  assert.equal(applied["simulated"], true);
  const candidate1 = stepOf(trace, "candidate-version-proposed");
  assert.equal(candidate1["contentHash"], "0f546418");
  assert.equal(candidate1["contentRef"], "you_content_0f546418cc6fb46e");
  assert.equal(candidate1["parentVersionId"], trace.subjectId);
  assert.equal(candidate1["simulated"], true);
  assert.equal(trace.candidateIds[0], candidate1["candidateId"]);

  // Lineage query: parent -> candidate, root -> leaf.
  const lineage = stepOf(trace, "candidate-lineage-queried");
  assert.equal(lineage["candidateCount"], 1);
  assert.equal(lineage["chainLength"], 1);
  assert.equal(lineage["rootSubjectId"], trace.subjectId);
  assert.equal(lineage["chainHead"], trace.candidateIds[0]);

  // Deterministic interchange export (golden package hash).
  const exported = stepOf(trace, "interchange-exported");
  assert.equal(exported["format"], "edit-interchange");
  assert.equal(exported["status"], "succeeded");
  assert.equal(exported["contentHash"], "ddbf8149");
  assert.equal(exported["contentRef"], "you_content_ddbf8149e6716dad");
  assert.equal(exported["packageByteLength"], 3736);
  assert.equal(exported["simulated"], true);
  assert.equal(trace.exportResultId, exported["resultId"]);

  // Failed import path: tampered content, typed refusal + honest failed record.
  const refused = stepOf(trace, "import-refused");
  assert.equal(refused["outcome"], "YOU_IMPORT_EXPORT_FAILED");
  assert.equal(refused["reason"], "content-hash-mismatch");
  assert.equal(refused["recordedStatus"], "failed");
  assert.equal(refused["recordedContentRef"], "");
  assert.equal(refused["simulated"], true);
  assert.equal(trace.failedImportResultId, refused["resultId"]);

  // Round-trip identity: the imported package IS the exported package.
  const imported = stepOf(trace, "interchange-imported");
  assert.equal(imported["status"], "succeeded");
  assert.equal(imported["contentHash"], "ddbf8149");
  assert.equal(imported["roundTripIdentical"], true);
  assert.equal(imported["sessionId"], trace.committedSessionId);
  assert.equal(trace.importResultId, imported["resultId"]);

  // Deep lineage: candidate 1 -> candidate 2.
  const deep = stepOf(trace, "second-change-set-applied");
  assert.equal(deep["parentVersionId"], trace.candidateIds[0]);
  assert.equal(deep["opCount"], 2);
  assert.equal(deep["contentHash"], "011e7935");
  assert.equal(trace.candidateIds[1], deep["candidateId"]);
  const deepened = stepOf(trace, "candidate-lineage-deepened");
  assert.equal(deepened["candidateCount"], 1);
  assert.equal(deepened["chainLength"], 2);
  assert.equal(deepened["rootSubjectId"], trace.subjectId);
  assert.equal(deepened["chainHashes"], "0f546418,011e7935");

  // Candidate accepted (v1 change-accepted) -> session committed.
  const accepted = stepOf(trace, "candidate-accepted");
  assert.equal(accepted["candidateId"], trace.candidateIds[1]);
  assert.equal(accepted["resolution"], "accepted");
  const committed = stepOf(trace, "edit-session-committed");
  assert.equal(committed["statusAfter"], "committed");
  assert.equal(committed["editingSessionId"], trace.committedSessionId);

  // Abandoned-session path: second session, candidate rejected, session abandoned.
  const rejectedProposed = stepOf(trace, "rejected-candidate-proposed");
  assert.equal(rejectedProposed["editorKind"], "embedded");
  assert.equal(rejectedProposed["parentVersionId"], trace.subjectId);
  assert.equal(trace.abandonedSessionId, rejectedProposed["editingSessionId"]);
  assert.equal(trace.candidateIds[2], rejectedProposed["candidateId"]);
  const rejected = stepOf(trace, "candidate-rejected");
  assert.equal(rejected["resolution"], "rejected");
  assert.equal(rejected["candidateId"], trace.candidateIds[2]);
  const abandoned = stepOf(trace, "edit-session-abandoned");
  assert.equal(abandoned["statusAfter"], "abandoned");
  assert.equal(abandoned["editingSessionId"], trace.abandonedSessionId);

  // Invalid-changeset refusal: the typed YOU_CHANGESET_INVALID refusal.
  const invalid = stepOf(trace, "invalid-changeset-refused");
  assert.equal(invalid["outcome"], "YOU_CHANGESET_INVALID");
  assert.equal(invalid["reason"], "empty-op-list");
  assert.ok(String(invalid["detail"]).includes("at least one op"));

  // Ledger readout: append-only, replayable, golden hash.
  const readout = stepOf(trace, "ledger-readout");
  assert.equal(readout["eventCount"], 18);
  assert.equal(readout["ledgerHash"], "6deefdc0");
  assert.equal(readout["projectionMatchesReplay"], true);
  assert.equal(readout["sessionCount"], 2);
  assert.equal(readout["changeSetCount"], 3);
  assert.equal(readout["candidateCount"], 3);
  assert.equal(readout["resolvedCandidateCount"], 2);
  assert.equal(readout["importExportCount"], 3);
  assert.equal(readout["editingStoreSize"], 13);
  assert.equal(trace.eventCount, 18);
  assert.equal(trace.ledgerHash, "6deefdc0");
  assert.equal(trace.projectionMatchesReplay, true);
  assert.equal(trace.editingStoreSize, 13);
});

test("different seeds change the ids and hashes but keep the machinery deterministic", () => {
  const base = runScenario();
  const variant = runEditingFixtureScenario({
    editingSeed: `${EDITING_SCENARIO_SEED}-alt`,
    twinSeed: `${EDITING_SCENARIO_SEED}-alt`,
    performanceSeed: `${EDITING_SCENARIO_SEED}-alt`,
  });
  assert.notEqual(base.subjectId, variant.subjectId);
  assert.notEqual(base.ledgerHash, variant.ledgerHash);
  assert.equal(variant.projectionMatchesReplay, true);
  // Step machinery (names + count) is seed-independent.
  assert.deepEqual(
    variant.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  const rerun = runEditingFixtureScenario({
    editingSeed: `${EDITING_SCENARIO_SEED}-alt`,
    twinSeed: `${EDITING_SCENARIO_SEED}-alt`,
    performanceSeed: `${EDITING_SCENARIO_SEED}-alt`,
  });
  assert.equal(serializeEditingScenarioTrace(variant), serializeEditingScenarioTrace(rerun));
});
