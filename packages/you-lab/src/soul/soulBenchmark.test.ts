// Deterministic soul benchmark tests (W7C) — coverage: seeded synthetic
// routed-prompt fixtures replay byte-identically (golden intended-response
// digests), golden candidate fidelity scores, golden report run id, honest
// notes, computed determinism, and the order's candidate classes exercised
// at the seam across both routing profiles.
import assert from "node:assert/strict";
import test from "node:test";
import { createSoulRegistry } from "../technology/soulSeedProfiles.js";
import {
  fixtureScenario,
  GOLDEN_SOUL_REPORT_RUN_ID,
  SOUL_BENCHMARK_FIXTURES,
} from "./soulFixtures.js";
import { SOUL_BENCH_SUBMITTED_AT, runStandardSoulBenchmark } from "./soulRunner.js";
import { createStandardSoulCandidates } from "./soulCandidates.js";
import { createLlamaCppSoulEvaluationAdapter } from "./llamaCppEvaluationAdapter.js";
import { intendedResponseDigest, intendedResponsesForPrompt, SOUL_FIDELITY_WEIGHTS, scoreSoulResponse } from "./soulScorer.js";

const registry = createSoulRegistry();

test("soul benchmark: three seeded fixtures with golden intended-response digests", () => {
  assert.equal(SOUL_BENCHMARK_FIXTURES.length, 3);
  for (const fixture of SOUL_BENCHMARK_FIXTURES) {
    const scenario = fixtureScenario(fixture);
    // scenario laws: binding and prompt share the route; context refs are
    // content-addressed wave-2 refs; every fixture is servable by the whole
    // standard candidate set (the W6C law)
    assert.equal(scenario.binding.routingProfile, scenario.prompt.routingProfile, `${fixture.fixtureId}: one Soul, one route`);
    assert.equal(scenario.prompt.contextRefs.length, fixture.scenarioSpec.contextRefCount);
    for (const contextRef of scenario.prompt.contextRefs) {
      assert.match(contextRef, /^you_content_[0-9a-f]{16}$/, `${fixture.fixtureId}: wave-2 content-addressed context refs`);
    }
    // golden intended-response digest (the canonical route-dependent model over the prompt)
    assert.equal(
      intendedResponseDigest(scenario.prompt),
      fixture.expectedIntendedResponseDigest,
      `${fixture.fixtureId}: golden intended-response digest`,
    );
    // fixtures replay deterministically
    assert.deepEqual(fixtureScenario(fixture), scenario);
  }
  assert.equal(SOUL_BENCHMARK_FIXTURES[0]?.seed, "w7c-fixture-01");
  assert.equal(SOUL_BENCHMARK_FIXTURES[1]?.seed, "w7c-fixture-02");
  assert.equal(SOUL_BENCHMARK_FIXTURES[2]?.seed, "w7c-fixture-03");
  // both frozen v7 routing profiles are exercised (system-one + system-two)
  const routes = new Set(SOUL_BENCHMARK_FIXTURES.map((fixture) => fixture.scenarioSpec.routingProfile));
  assert.deepEqual([...routes].sort(), ["system-one", "system-two"]);
});

test("soul benchmark: golden candidate fidelity scores per fixture (exact fixture objectives)", () => {
  const report = runStandardSoulBenchmark(createStandardSoulCandidates(registry));
  for (const fixture of SOUL_BENCHMARK_FIXTURES) {
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

test("soul benchmark: golden report run id (byte-identical full-report replay)", () => {
  const report = runStandardSoulBenchmark(createStandardSoulCandidates(registry));
  assert.equal(report.runId, GOLDEN_SOUL_REPORT_RUN_ID);
  const rerun = runStandardSoulBenchmark(createStandardSoulCandidates(registry));
  assert.equal(rerun.runId, report.runId, "run id is a deterministic digest of the report");
  assert.deepEqual(rerun.candidateResults, report.candidateResults);
});

test("soul benchmark: overall scores are means; effort stays not-measured; determinism computed", () => {
  const report = runStandardSoulBenchmark(createStandardSoulCandidates(registry));
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
  assert.equal(evaluation?.candidateId, "llama-cpp-soul-eval");
});

test("soul benchmark: honest notes (computed fixture objectives, not measurements)", () => {
  const report = runStandardSoulBenchmark(createStandardSoulCandidates(registry));
  const notes = report.notes.join(" | ");
  assert.ok(notes.includes("not measurements of real LLM/VLM providers"));
  assert.ok(notes.includes("pure mocks"));
  assert.ok(notes.includes("the real llama.cpp runtime was never executed"));
  assert.ok(notes.includes("byte-identical double invocation"));
  assert.ok(notes.includes("no measurement was performed and none is implied"));
  assert.ok(report.fixtureSetVersion.startsWith("w7c-soul-benchmark-fixtures/"));
  assert.ok(report.scorerVersion.startsWith("you-lab-soul-scorer/"));
});

test("soul benchmark: the order's candidate classes and seam surface are exercised", () => {
  const candidates = createStandardSoulCandidates(registry);
  const classes = new Set<string>();
  const routes = new Set<string>();
  for (const candidate of candidates) {
    classes.add(candidate.profile.soulClass);
    for (const route of candidate.profile.supportedRoutingProfiles) routes.add(route);
  }
  // the LLM/VLM provider classes + the state-routing class run through the seam
  for (const soulClass of ["serving-stack", "vlm-family", "state-routing"]) {
    assert.ok(classes.has(soulClass), `candidate class "${soulClass}" covered by the standard candidate set`);
  }
  // the speculative-decode class is registry-researched but deliberately not in the mock set (the W6C precedent)
  assert.equal(classes.has("speculative-decode"), false);
  // both frozen v7 routing profiles are supported across the candidate set
  for (const route of ["system-one", "system-two"]) {
    assert.ok(routes.has(route), `routing profile "${route}" exercised at the seam`);
  }
  // Every adapter ran with the fixed fixture-mode timestamp (no clock).
  assert.equal(SOUL_BENCH_SUBMITTED_AT, "2026-10-12T12:00:00Z");
});

test("soul benchmark: scorer weights are the fixture definition; a perfect soul scores 1", () => {
  assert.deepEqual(SOUL_FIDELITY_WEIGHTS, { contextCoverage: 0.6, responseFaithfulness: 0.2, recordIntegrity: 0.2 });
  const fixture = SOUL_BENCHMARK_FIXTURES[0]!;
  const scenario = fixtureScenario(fixture);
  const request = {
    requestId: `perfect-${fixture.fixtureId}`,
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  } as const;
  // the llama.cpp-class evaluation adapter models an exact-recovery runtime under the requested route
  const adapter = createLlamaCppSoulEvaluationAdapter(registry);
  const output = adapter.invoke(request);
  const parts = scoreSoulResponse(request, output);
  assert.equal(parts.fidelityScore, 1);
  assert.equal(parts.contextCoverage, 1);
  assert.equal(parts.responseFaithfulness, 1);
  assert.equal(parts.recordIntegrity, 1);
  // the intended model is the fixture objective over every context ref under the requested route
  assert.equal(intendedResponsesForPrompt(scenario.prompt).length, scenario.prompt.contextRefs.length);
});
