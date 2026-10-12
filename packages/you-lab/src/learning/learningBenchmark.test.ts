// Deterministic learning benchmark tests (W6C) — coverage: seeded synthetic
// takeover-trajectory fixtures replay byte-identically (golden intended
// digests), golden candidate fidelity scores, golden report run id, honest
// notes, computed determinism, and learner-class coverage across the
// candidate set.
import assert from "node:assert/strict";
import test from "node:test";
import { createLearningRegistry } from "../technology/learningSeedProfiles.js";
import {
  fixtureInvocationSignal,
  fixtureTrajectory,
  GOLDEN_LEARNING_REPORT_RUN_ID,
  LEARNING_BENCHMARK_FIXTURES,
} from "./learningFixtures.js";
import { LEARNING_BENCH_SUBMITTED_AT, runStandardLearningBenchmark } from "./learningRunner.js";
import { createStandardLearningCandidates } from "./learningCandidates.js";
import { createVowpalWabbitLearningEvaluationAdapter } from "./vowpalWabbitEvaluationAdapter.js";
import { intendedLearningDigest, intendedLearningForSignal, LEARNING_FIDELITY_WEIGHTS, scoreLearningFidelity } from "./learningScorer.js";

const registry = createLearningRegistry();

test("learning benchmark: three seeded fixtures with golden intended-learning digests", () => {
  assert.equal(LEARNING_BENCHMARK_FIXTURES.length, 3);
  for (const fixture of LEARNING_BENCHMARK_FIXTURES) {
    const trajectory = fixtureTrajectory(fixture);
    const invocation = fixtureInvocationSignal(fixture);
    // trajectory laws: head is the triggering manual takeover; signals carry
    // the spec's evidence count; the invocation signal references the union
    // of the trajectory's evidence (sorted, no duplicates)
    assert.equal(trajectory[0]?.kind, "manual-takeover", `${fixture.fixtureId}: head is the takeover signal`);
    assert.equal(invocation.kind, "manual-takeover");
    assert.equal(invocation.scope, trajectory[0]?.scope);
    assert.equal(
      invocation.evidenceRefs.length,
      fixture.trajectorySpec.signalCount * fixture.trajectorySpec.evidencePerSignal,
      `${fixture.fixtureId}: invocation evidence is the trajectory union`,
    );
    assert.deepEqual(
      invocation.evidenceRefs,
      [...new Set(invocation.evidenceRefs)].sort(),
      `${fixture.fixtureId}: evidence union sorted and duplicate-free`,
    );
    for (const signal of trajectory) {
      assert.equal(signal.simulated, true);
      assert.ok(/^you_content_[0-9a-f]{16}$/.test(signal.evidenceRefs[0] ?? ""), `${signal.id}: wave-2 content-addressed evidence refs`);
    }
    // golden intended-learning digest (the canonical model over the invocation signal)
    assert.equal(
      intendedLearningDigest(invocation),
      fixture.expectedIntendedLearningDigest,
      `${fixture.fixtureId}: golden intended-learning digest`,
    );
    // fixtures replay deterministically
    assert.deepEqual(fixtureTrajectory(fixture), trajectory);
    assert.deepEqual(fixtureInvocationSignal(fixture), invocation);
  }
  assert.equal(LEARNING_BENCHMARK_FIXTURES[0]?.seed, "w6c-fixture-01");
  assert.equal(LEARNING_BENCHMARK_FIXTURES[1]?.seed, "w6c-fixture-02");
  assert.equal(LEARNING_BENCHMARK_FIXTURES[2]?.seed, "w6c-fixture-03");
});

test("learning benchmark: golden candidate fidelity scores per fixture (exact fixture objectives)", () => {
  const report = runStandardLearningBenchmark(createStandardLearningCandidates(registry));
  for (const fixture of LEARNING_BENCHMARK_FIXTURES) {
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

test("learning benchmark: golden report run id (byte-identical full-report replay)", () => {
  const report = runStandardLearningBenchmark(createStandardLearningCandidates(registry));
  assert.equal(report.runId, GOLDEN_LEARNING_REPORT_RUN_ID);
  const rerun = runStandardLearningBenchmark(createStandardLearningCandidates(registry));
  assert.equal(rerun.runId, report.runId, "run id is a deterministic digest of the report");
  assert.deepEqual(rerun.candidateResults, report.candidateResults);
});

test("learning benchmark: overall scores are means; effort stays not-measured; determinism computed", () => {
  const report = runStandardLearningBenchmark(createStandardLearningCandidates(registry));
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
  assert.equal(evaluation?.candidateId, "vowpal-wabbit-learning-eval");
});

test("learning benchmark: honest notes (computed fixture objectives, not measurements)", () => {
  const report = runStandardLearningBenchmark(createStandardLearningCandidates(registry));
  const notes = report.notes.join(" | ");
  assert.ok(notes.includes("not measurements of real learning technologies"));
  assert.ok(notes.includes("pure mocks"));
  assert.ok(notes.includes("the real Vowpal Wabbit learner was never executed"));
  assert.ok(notes.includes("byte-identical double invocation"));
  assert.ok(notes.includes("no measurement was performed and none is implied"));
  assert.ok(report.fixtureSetVersion.startsWith("w6c-learning-benchmark-fixtures/"));
  assert.ok(report.scorerVersion.startsWith("you-lab-learning-scorer/"));
});

test("learning benchmark: the order's learner classes and seam surface are exercised", () => {
  const candidates = createStandardLearningCandidates(registry);
  const classes = new Set<string>();
  const kinds = new Set<string>();
  const scopes = new Set<string>();
  for (const candidate of candidates) {
    classes.add(candidate.profile.learnerClass);
    for (const kind of candidate.profile.supportedSignalKinds) kinds.add(kind);
    for (const scope of candidate.profile.supportedScopes) scopes.add(scope);
  }
  for (const learnerClass of ["rule-induction", "preference-learning", "bandit-selection", "contextual-ranking", "program-synthesis", "workflow-mining"]) {
    assert.ok(classes.has(learnerClass), `learner class "${learnerClass}" covered by the standard candidate set`);
  }
  assert.equal(classes.has("cost-aware-selection"), false, "the cost-aware class is registry-researched (smac) but not part of the mock candidate set");
  for (const kind of ["manual-takeover", "edit-session", "feedback", "repeated-intent", "capability-gap", "expert-intervention"]) {
    assert.ok(kinds.has(kind), `signal kind "${kind}" exercised at the seam`);
  }
  for (const scope of ["USER", "TENANT", "APPLICATION"]) {
    assert.ok(scopes.has(scope), `fixture head scope "${scope}" supported across the candidate set`);
  }
  // Every adapter ran with the fixed fixture-mode timestamp (no clock).
  assert.equal(LEARNING_BENCH_SUBMITTED_AT, "2026-10-12T12:00:00Z");
});

test("learning benchmark: scorer weights are the fixture definition; a perfect learner scores 1", () => {
  assert.deepEqual(LEARNING_FIDELITY_WEIGHTS, { signalCoverage: 0.6, preferenceFaithfulness: 0.2, recordIntegrity: 0.2 });
  const fixture = LEARNING_BENCHMARK_FIXTURES[0]!;
  const invocation = fixtureInvocationSignal(fixture);
  const request = {
    requestId: `perfect-${fixture.fixtureId}`,
    signal: invocation,
    scope: invocation.scope,
    rights: {
      usage: ["organization-improvement", "tool-selection"],
      consentRef: "you-lab-perfect-consent",
      consentHash: "a".repeat(64),
      expiresAt: null,
    },
    submittedAt: LEARNING_BENCH_SUBMITTED_AT,
  } as const;
  // the VW-class evaluation adapter models an exact-recovery online learner
  const adapter = createVowpalWabbitLearningEvaluationAdapter(registry);
  const output = adapter.learn(request);
  const parts = scoreLearningFidelity(request, output);
  assert.equal(parts.fidelityScore, 1);
  assert.equal(parts.signalCoverage, 1);
  assert.equal(parts.preferenceFaithfulness, 1);
  assert.equal(parts.recordIntegrity, 1);
  // the intended model is the fixture objective over every evidence ref
  assert.equal(intendedLearningForSignal(invocation).length, invocation.evidenceRefs.length);
});
