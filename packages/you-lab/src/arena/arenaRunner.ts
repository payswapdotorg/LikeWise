// Deterministic arena benchmark runner (W8C).
//
// Runs the simulated arena candidate adapters over the seeded synthetic
// gap scenarios, scoring run-ladder fidelity and determinism, and records
// results as STRUCTURED FIELDS. Truth law: candidate fidelity scores are
// computed fixture objectives over simulated arena run ladders
// (deterministic arithmetic — labeled computed, not measured, and never a
// claim about real arena providers or retry libraries); effort/latency/
// cost are recorded as explicit "not-measured (simulated)" markers —
// never faked numbers. No clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { ArenaAdapter, NeutralArenaInvocation } from "./arenaAdapterSeam.js";
import { ARENA_BENCHMARK_FIXTURES, ARENA_FIXTURE_SET_VERSION, fixtureScenario, type ArenaBenchmarkFixture } from "./arenaFixtures.js";
import { SCORER_ARENA_VERSION, scoreArenaInvocation } from "./arenaScorer.js";

/** Fixed fixture-mode invocation timestamp (FIXTURES.md law 3: no clock). */
export const ARENA_BENCH_SUBMITTED_AT = "2026-10-13T12:00:00Z";

export interface FixtureArenaScore {
  readonly fixtureId: string;
  readonly fidelityScore: number;
}

export interface CandidateArenaResult {
  readonly candidateId: string;
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureArenaScore[];
  /** Mean of fixture arena-fidelity scores (deterministic arithmetic). */
  readonly overallFidelityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Computed: byte-identical double-invocation replay (not just the profile claim). */
  readonly deterministic: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
}

export interface ArenaBenchmarkRunReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateArenaResult[];
  readonly notes: readonly string[];
}

function benchmarkInvocation(fixture: ArenaBenchmarkFixture, candidateId: string): NeutralArenaInvocation {
  const scenario = fixtureScenario(fixture);
  return {
    requestId: `bench-${fixture.fixtureId}-${candidateId}`,
    provider: scenario.provider,
    gap: scenario.gap,
    retryLadder: scenario.retryLadder,
    escalationId: scenario.escalationId,
    authorization: scenario.authorization,
    submittedAt: ARENA_BENCH_SUBMITTED_AT,
  };
}

export function runArenaBenchmark(
  fixtures: readonly ArenaBenchmarkFixture[],
  candidates: readonly ArenaAdapter[],
): ArenaBenchmarkRunReport {
  const candidateResults: CandidateArenaResult[] = candidates.map((candidate) => {
    const fixtureScores: FixtureArenaScore[] = fixtures.map((fixture) => {
      const request = benchmarkInvocation(fixture, candidate.profile.id);
      const output = candidate.invoke(request);
      const parts = scoreArenaInvocation(request, output);
      return { fixtureId: fixture.fixtureId, fidelityScore: parts.fidelityScore };
    });
    const mean =
      fixtureScores.length === 0
        ? 0
        : fixtureScores.reduce((sum, entry) => sum + entry.fidelityScore, 0) / fixtureScores.length;
    // Computed determinism: double invocation must replay byte-identically.
    const firstFixture = fixtures[0];
    let deterministic = true;
    if (firstFixture) {
      const request = benchmarkInvocation(firstFixture, candidate.profile.id);
      const first = candidate.invoke(request);
      const second = candidate.invoke(request);
      deterministic = canonicalJson(first) === canonicalJson(second);
    }
    return {
      candidateId: candidate.profile.id,
      adapterKind: candidate.profile.adapterKind,
      fixtureScores,
      overallFidelityScore: Math.round(mean * 10_000) / 10_000,
      effort: notMeasured(),
      latency: notMeasured(),
      cost: notMeasured(),
      deterministic,
      productionEligible: candidate.profile.productionEligible,
    };
  });
  const notes = [
    "candidate fidelity scores are computed deterministic fixture objectives over simulated arena run ladders (you-lab arena scorer) — not measurements of real arena providers or retry libraries and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their degradation parameters are fixture inputs, not technology assessments",
    "the p-retry-arena-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real p-retry library was never executed (W9+ compute-plane work)",
    "determinism is computed by byte-identical double invocation, not asserted from adapter profiles",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: ARENA_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_ARENA_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardArenaBenchmark(
  candidates: readonly ArenaAdapter[],
  fixtures: readonly ArenaBenchmarkFixture[] = ARENA_BENCHMARK_FIXTURES,
): ArenaBenchmarkRunReport {
  return runArenaBenchmark(fixtures, candidates);
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
