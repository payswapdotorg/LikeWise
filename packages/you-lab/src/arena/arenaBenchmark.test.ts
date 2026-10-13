// Deterministic arena benchmark tests (W8C) — coverage: seeded synthetic
// gap scenarios replay byte-identically (golden intended-result digests),
// golden candidate fidelity scores, golden report run id, honest notes,
// computed determinism, and the order's degradation classes exercised at
// the seam across three authorization/backoff shapes.
import assert from "node:assert/strict";
import test from "node:test";
import { createRetryBackoffRegistry } from "../technology/retryBackoffSeedProfiles.js";
import {
  ARENA_BENCHMARK_FIXTURES,
  ARENA_FIXTURE_SET_VERSION,
  fixtureScenario,
  GOLDEN_ARENA_REPORT_RUN_ID,
} from "./arenaFixtures.js";
import { ARENA_BENCH_SUBMITTED_AT, runStandardArenaBenchmark, type CandidateArenaResult, type FixtureArenaScore } from "./arenaRunner.js";
import { createStandardArenaCandidates } from "./arenaCandidates.js";
import { createPRetryBackoffArenaEvaluationAdapter, P_RETRY_EVALUATION_ADAPTER_ID } from "./pRetryEvaluationAdapter.js";
import { ARENA_FIDELITY_WEIGHTS, intendedExpertResultDigest, scoreArenaInvocation } from "./arenaScorer.js";

const registry = createRetryBackoffRegistry();

test("arena benchmark: three seeded fixtures with golden intended-result digests", () => {
  assert.equal(ARENA_BENCHMARK_FIXTURES.length, 3);
  for (const fixture of ARENA_BENCHMARK_FIXTURES) {
    const scenario = fixtureScenario(fixture);
    // scenario laws: the ladder's eligibility covers the gap category; the
    // authorization gate matches the escalation linkage; evidence refs are
    // content-addressed wave-2 refs
    assert.ok(scenario.retryLadder.eligibilityCategories.includes(scenario.gap.category));
    assert.equal(scenario.retryLadder.requiresAuthorization, scenario.authorization !== null);
    assert.equal(scenario.escalationId !== null, scenario.authorization !== null);
    if (scenario.authorization) {
      assert.equal(scenario.authorization.escalationId, scenario.escalationId);
    }
    assert.equal(scenario.gap.failureEvidence.length, fixture.scenarioSpec.evidenceRefCount);
    for (const evidenceRef of scenario.gap.failureEvidence) {
      assert.match(evidenceRef, /^you_content_[0-9a-f]{16}$/, `${fixture.fixtureId}: wave-2 content-addressed evidence refs`);
    }
    // golden intended-result digest (the canonical class-dependent model over the scenario)
    const request = {
      requestId: `golden-${fixture.fixtureId}`,
      provider: scenario.provider,
      gap: scenario.gap,
      retryLadder: scenario.retryLadder,
      escalationId: scenario.escalationId,
      authorization: scenario.authorization,
      submittedAt: ARENA_BENCH_SUBMITTED_AT,
    };
    assert.equal(
      intendedExpertResultDigest(request),
      fixture.expectedIntendedResultDigest,
      `${fixture.fixtureId}: golden intended-result digest`,
    );
    // fixtures replay deterministically
    assert.deepEqual(fixtureScenario(fixture), scenario);
  }
  assert.equal(ARENA_BENCHMARK_FIXTURES[0]?.seed, "w8c-fixture-01");
  assert.equal(ARENA_BENCHMARK_FIXTURES[1]?.seed, "w8c-fixture-02");
  assert.equal(ARENA_BENCHMARK_FIXTURES[2]?.seed, "w8c-fixture-03f");
  // the authorization gate is exercised both ways and three backoff classes
  // appear (exponential-backoff-jitter, circuit-breaker, hedged-request)
  const gates = ARENA_BENCHMARK_FIXTURES.map((fixture) => fixture.scenarioSpec.requiresAuthorization).sort();
  assert.deepEqual(gates, [false, true, true]);
  const classes = new Set(ARENA_BENCHMARK_FIXTURES.map((fixture) => fixture.scenarioSpec.backoffClass));
  assert.deepEqual([...classes].sort(), ["circuit-breaker", "exponential-backoff-jitter", "hedged-request"]);
});

test("arena benchmark: golden candidate fidelity scores per fixture (exact fixture objectives)", () => {
  const report = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  for (const fixture of ARENA_BENCHMARK_FIXTURES) {
    const expected = fixture.expectedScores;
    const candidateIds = Object.keys(expected).sort();
    assert.equal(candidateIds.length, 7, `${fixture.fixtureId}: golden scores recorded for all seven candidates`);
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

test("arena benchmark: golden report run id (byte-identical full-report replay)", () => {
  const report = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  assert.equal(report.runId, GOLDEN_ARENA_REPORT_RUN_ID);
  const rerun = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  assert.equal(rerun.runId, report.runId, "run id is a deterministic digest of the report");
  assert.deepEqual(rerun.candidateResults, report.candidateResults);
  assert.equal(report.fixtureSetVersion, ARENA_FIXTURE_SET_VERSION);
});

test("arena benchmark: overall scores are means; effort stays not-measured; determinism computed", () => {
  const report = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  for (const result of report.candidateResults) {
    const mean =
      result.fixtureScores.reduce((sum, entry) => sum + entry.fidelityScore, 0) / result.fixtureScores.length;
    assert.equal(result.overallFidelityScore, Math.round(mean * 10_000) / 10_000);
    assert.equal(result.effort.kind, "not-measured");
    assert.equal(result.latency.kind, "not-measured");
    assert.equal(result.cost.kind, "not-measured");
    assert.equal(result.deterministic, true, "byte-identical double invocation");
    if (result.candidateId === P_RETRY_EVALUATION_ADAPTER_ID) {
      assert.equal(result.adapterKind, "evaluation");
      assert.equal(result.productionEligible, true);
    } else {
      assert.equal(result.adapterKind, "mock");
      assert.equal(result.productionEligible, null);
    }
  }
  // the precise mock and the eval adapter score a perfect 1; the degraded
  // candidates score strictly below (the fixture objective discriminates)
  const byId = new Map(report.candidateResults.map((result) => [result.candidateId, result]));
  assert.equal(byId.get("mock-arena-precise")?.overallFidelityScore, 1);
  assert.equal(byId.get(P_RETRY_EVALUATION_ADAPTER_ID)?.overallFidelityScore, 1);
  for (const degradedId of ["mock-arena-coarse", "mock-arena-lossy", "mock-arena-stale-strategy", "mock-arena-misbackoff", "mock-arena-minimal"]) {
    const score = byId.get(degradedId)?.overallFidelityScore;
    assert.ok(score !== undefined && score < 1, `${degradedId}: strictly below perfect`);
  }
  // scorer weights are the authored 0.6/0.2/0.2 shape
  assert.deepEqual(ARENA_FIDELITY_WEIGHTS, { evidenceCoverage: 0.6, outcomeFaithfulness: 0.2, recordIntegrity: 0.2 });
});

test("arena benchmark: honest notes — fixtures are the source, never real-technology measurements", () => {
  const report = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  const joined = report.notes.join(" | ");
  assert.ok(joined.includes("computed deterministic fixture objectives"));
  assert.ok(joined.includes("pure mocks"));
  assert.ok(joined.includes("the real p-retry library was never executed"));
  assert.ok(joined.includes("byte-identical double invocation"));
  assert.ok(joined.includes("not-measured (simulated)"));
});

test("arena benchmark: the eval adapter scores are recomputed identically through the standalone adapter", () => {
  const adapter = createPRetryBackoffArenaEvaluationAdapter(registry);
  const report = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  const evalResult: CandidateArenaResult | undefined = report.candidateResults.find(
    (entry) => entry.candidateId === P_RETRY_EVALUATION_ADAPTER_ID,
  );
  assert.ok(evalResult);
  for (const fixture of ARENA_BENCHMARK_FIXTURES) {
    const scenario = fixtureScenario(fixture);
    const request: import("./arenaAdapterSeam.js").NeutralArenaInvocation = {
      requestId: `bench-${fixture.fixtureId}-${P_RETRY_EVALUATION_ADAPTER_ID}`,
      provider: scenario.provider,
      gap: scenario.gap,
      retryLadder: scenario.retryLadder,
      escalationId: scenario.escalationId,
      authorization: scenario.authorization,
      submittedAt: ARENA_BENCH_SUBMITTED_AT,
    };
    const parts = scoreArenaInvocation(request, adapter.invoke(request));
    const scored: FixtureArenaScore | undefined = evalResult.fixtureScores.find(
      (entry) => entry.fixtureId === fixture.fixtureId,
    );
    assert.ok(scored);
    assert.equal(scored.fidelityScore, parts.fidelityScore, `${fixture.fixtureId}: standalone recomputation matches`);
  }
});
