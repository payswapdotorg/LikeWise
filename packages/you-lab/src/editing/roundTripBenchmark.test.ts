// Deterministic round-trip benchmark tests (W5C) — coverage: seeded
// synthetic subject/edit fixtures replay byte-identically (golden digests),
// golden candidate fidelity scores, golden report run id, honest notes,
// computed determinism, and full kind/format coverage across the candidate
// set.
import assert from "node:assert/strict";
import test from "node:test";
import { createEditorRegistry } from "../technology/editorSeedProfiles.js";
import {
  fixtureEditPlan,
  fixtureSubjectState,
  GOLDEN_ROUND_TRIP_REPORT_RUN_ID,
  neutralStateDigest,
  ROUND_TRIP_BENCHMARK_FIXTURES,
} from "./roundTripFixtures.js";
import { runStandardRoundTripBenchmark, EDITING_BENCH_SUBMITTED_AT } from "./roundTripRunner.js";
import { createStandardEditingCandidates } from "./roundTripCandidates.js";
import { createVscodeEditingEvaluationAdapter } from "./vscodeEvaluationAdapter.js";
import { applyCandidateOperations } from "../adapters/editorAdapterSeam.js";
import { intendedOperationsForPlan, ROUND_TRIP_WEIGHTS, scoreRoundTripFidelity } from "./roundTripScorer.js";

const registry = createEditorRegistry();

test("round-trip benchmark: three seeded fixtures with golden intended-final-state digests", () => {
  assert.equal(ROUND_TRIP_BENCHMARK_FIXTURES.length, 3);
  for (const fixture of ROUND_TRIP_BENCHMARK_FIXTURES) {
    const state = fixtureSubjectState(fixture);
    const plan = fixtureEditPlan(fixture);
    // intended final state = the edit plan applied directly to the subject
    const request = {
      requestId: `golden-${fixture.fixtureId}`,
      editingSessionId: `es-golden-${fixture.fixtureId}`,
      subjectArtifact: {
        artifactId: `art-${fixture.fixtureId}`,
        format: "json",
        contentRef: "content-store://fixture",
        contentHash: "0".repeat(64),
        content: { entities: state.entities, environment: state.environment },
      },
      format: "json",
      editPlan: plan,
      submittedAt: EDITING_BENCH_SUBMITTED_AT,
    } as const;
    const intended = applyCandidateOperations(state, intendedOperationsForPlan(state, request as never));
    assert.equal(
      neutralStateDigest(intended),
      fixture.expectedFinalStateDigest,
      `${fixture.fixtureId}: golden final-state digest`,
    );
    // fixtures replay deterministically
    const again = fixtureSubjectState(fixture);
    assert.deepEqual(again, state);
    assert.deepEqual(fixtureEditPlan(fixture), plan);
    // edit-plan laws: distinct scale ids, sorted added entities, subject ids exist
    for (const id of Object.keys(plan.scaleEdits)) {
      assert.ok(state.entities.some((entity) => entity.id === id), `${fixture.fixtureId}: scale id ${id} in subject`);
    }
    for (const id of plan.removedEntityIds) {
      assert.ok(state.entities.some((entity) => entity.id === id), `${fixture.fixtureId}: removed id ${id} in subject`);
    }
  }
});

test("round-trip benchmark: golden candidate fidelity scores per fixture (exact fixture objectives)", () => {
  const report = runStandardRoundTripBenchmark(createStandardEditingCandidates(registry));
  for (const fixture of ROUND_TRIP_BENCHMARK_FIXTURES) {
    const expected = fixture.expectedScores;
    const candidateIds = Object.keys(expected).sort();
    assert.ok(candidateIds.length > 0, `${fixture.fixtureId}: golden scores recorded`);
    for (const candidateId of candidateIds) {
      const result = report.candidateResults.find((entry) => entry.candidateId === candidateId);
      assert.ok(result, `${fixture.fixtureId}: candidate ${candidateId} ran`);
      const score = result.fixtureScores.find((entry) => entry.fixtureId === fixture.fixtureId);
      assert.ok(score, `${fixture.fixtureId}: score entry for ${candidateId}`);
      assert.equal(
        score.fidelityScore,
        expected[candidateId],
        `${fixture.fixtureId}/${candidateId}: golden fidelity score`,
      );
    }
  }
});

test("round-trip benchmark: golden report run id (byte-identical full-report replay)", () => {
  const report = runStandardRoundTripBenchmark(createStandardEditingCandidates(registry));
  assert.equal(report.runId, GOLDEN_ROUND_TRIP_REPORT_RUN_ID);
  const rerun = runStandardRoundTripBenchmark(createStandardEditingCandidates(registry));
  assert.equal(rerun.runId, report.runId, "run id is a deterministic digest of the report");
  assert.deepEqual(rerun.candidateResults, report.candidateResults);
});

test("round-trip benchmark: overall scores are means; effort stays not-measured; determinism computed", () => {
  const report = runStandardRoundTripBenchmark(createStandardEditingCandidates(registry));
  for (const result of report.candidateResults) {
    assert.equal(result.fixtureScores.length, 3);
    const mean = result.fixtureScores.reduce((sum, entry) => sum + entry.fidelityScore, 0) / 3;
    assert.equal(result.overallFidelityScore, Math.round(mean * 10_000) / 10_000);
    assert.equal(result.effort.kind, "not-measured");
    assert.equal(result.latency.kind === "not-measured" ? result.latency.marker : "", "not-measured (simulated)");
    assert.equal(result.cost.kind, "not-measured");
    // determinism is COMPUTED by byte-identical double invocation
    assert.equal(result.deterministic, true);
  }
  const mock = report.candidateResults.find((entry) => entry.adapterKind === "mock");
  const evaluation = report.candidateResults.find((entry) => entry.adapterKind === "evaluation");
  assert.ok(mock && mock.productionEligible === null, "mocks carry no eligibility claim");
  assert.ok(evaluation && evaluation.productionEligible === true, "evaluation adapter is registry-eligible");
  assert.equal(evaluation?.candidateId, "vscode-editing-eval");
});

test("round-trip benchmark: honest notes (computed fixture objectives, not measurements)", () => {
  const report = runStandardRoundTripBenchmark(createStandardEditingCandidates(registry));
  const notes = report.notes.join(" | ");
  assert.ok(notes.includes("not measurements of real editor technologies"));
  assert.ok(notes.includes("pure mocks"));
  assert.ok(notes.includes("the real Visual Studio Code editor was never executed"));
  assert.ok(notes.includes("byte-identical double invocation"));
  assert.ok(notes.includes("no measurement was performed and none is implied"));
  assert.ok(report.fixtureSetVersion.startsWith("w5c-editing-round-trip-benchmark-fixtures/"));
  assert.ok(report.scorerVersion.startsWith("you-lab-round-trip-scorer/"));
});

test("round-trip benchmark: all three editor kinds and seam formats are exercised", () => {
  const candidates = createStandardEditingCandidates(registry);
  const kinds = new Set<string>();
  const formats = new Set<string>();
  for (const candidate of candidates) {
    kinds.add(candidate.profile.editorKind);
    for (const format of candidate.profile.supportedFormats) formats.add(format);
  }
  for (const kind of ["embedded", "external", "native"]) {
    assert.ok(kinds.has(kind), `kind "${kind}" covered by the standard candidate set`);
  }
  for (const format of ["edit-interchange", "gltf", "json"]) {
    assert.ok(formats.has(format), `format "${format}" exercised at the seam`);
  }
  // Every adapter ran with the fixed fixture-mode timestamp (no clock).
  assert.equal(EDITING_BENCH_SUBMITTED_AT, "2026-10-11T12:00:00Z");
});

test("round-trip benchmark: scorer weights are the fixture definition; a perfect round trip scores 1", () => {
  assert.deepEqual(ROUND_TRIP_WEIGHTS, { entityFidelity: 0.6, environmentFidelity: 0.2, opFaithfulness: 0.2 });
  const fixture = ROUND_TRIP_BENCHMARK_FIXTURES[0]!;
  const state = fixtureSubjectState(fixture);
  const request = {
    requestId: "perfect-req",
    editingSessionId: "es-perfect",
    subjectArtifact: {
      artifactId: "art-perfect",
      format: "json",
      contentRef: "content-store://fixture",
      contentHash: "0".repeat(64),
      content: { entities: state.entities, environment: state.environment },
    },
    format: "json",
    editPlan: fixtureEditPlan(fixture),
    submittedAt: EDITING_BENCH_SUBMITTED_AT,
  } as const;
  // the VS Code-class evaluation adapter models a byte-precise round trip
  const adapter = createVscodeEditingEvaluationAdapter(registry);
  const output = adapter.invoke(request as never);
  const parts = scoreRoundTripFidelity(state, request as never, output.changeSet, output.payloads);
  assert.equal(parts.fidelityScore, 1);
  assert.equal(parts.entityFidelity, 1);
  assert.equal(parts.environmentFidelity, 1);
  assert.equal(parts.opFaithfulness, 1);
});
