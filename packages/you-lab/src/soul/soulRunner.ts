// Deterministic soul benchmark runner (W7C).
//
// Runs the simulated soul candidate adapters over the seeded synthetic
// routed-prompt fixtures, scoring response fidelity and determinism, and
// records results as STRUCTURED FIELDS. Truth law: candidate fidelity
// scores are computed fixture objectives over simulated soul responses
// (deterministic arithmetic — labeled computed, not measured, and never a
// claim about real LLM/VLM providers); effort/latency/cost are recorded as
// explicit "not-measured (simulated)" markers — never faked numbers. No
// clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { SoulAdapter, NeutralSoulRequest } from "./soulAdapterSeam.js";
import {
  SOUL_BENCHMARK_FIXTURES,
  SOUL_FIXTURE_SET_VERSION,
  fixtureScenario,
  type SoulBenchmarkFixture,
} from "./soulFixtures.js";
import { SCORER_SOUL_VERSION, scoreSoulResponse } from "./soulScorer.js";

/** Fixed fixture-mode invocation timestamp (FIXTURES.md law 3: no clock). */
export const SOUL_BENCH_SUBMITTED_AT = "2026-10-12T12:00:00Z";

export interface FixtureSoulScore {
  readonly fixtureId: string;
  readonly fidelityScore: number;
}

export interface CandidateSoulResult {
  readonly candidateId: string;
  readonly soulClass: string;
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureSoulScore[];
  /** Mean of fixture soul-fidelity scores (deterministic arithmetic). */
  readonly overallFidelityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Computed: byte-identical double-invocation replay (not just the profile claim). */
  readonly deterministic: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
}

export interface SoulBenchmarkRunReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateSoulResult[];
  readonly notes: readonly string[];
}

function benchmarkRequest(fixture: SoulBenchmarkFixture, candidateId: string): NeutralSoulRequest {
  const scenario = fixtureScenario(fixture);
  return {
    requestId: `bench-${fixture.fixtureId}-${candidateId}`,
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  };
}

export function runSoulBenchmark(
  fixtures: readonly SoulBenchmarkFixture[],
  candidates: readonly SoulAdapter[],
): SoulBenchmarkRunReport {
  const candidateResults: CandidateSoulResult[] = candidates.map((candidate) => {
    const fixtureScores: FixtureSoulScore[] = fixtures.map((fixture) => {
      const request = benchmarkRequest(fixture, candidate.profile.id);
      const output = candidate.invoke(request);
      const parts = scoreSoulResponse(request, output);
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
      const request = benchmarkRequest(firstFixture, candidate.profile.id);
      const first = candidate.invoke(request);
      const second = candidate.invoke(request);
      deterministic = canonicalJson(first) === canonicalJson(second);
    }
    return {
      candidateId: candidate.profile.id,
      soulClass: candidate.profile.soulClass,
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
    "candidate fidelity scores are computed deterministic fixture objectives over simulated soul responses (you-lab soul scorer) — not measurements of real LLM/VLM providers and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their degradation parameters are fixture inputs, not technology assessments",
    "the llama-cpp-soul-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real llama.cpp runtime was never executed (W8+ compute-plane work)",
    "determinism is computed by byte-identical double invocation, not asserted from adapter profiles",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: SOUL_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_SOUL_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardSoulBenchmark(
  candidates: readonly SoulAdapter[],
  fixtures: readonly SoulBenchmarkFixture[] = SOUL_BENCHMARK_FIXTURES,
): SoulBenchmarkRunReport {
  return runSoulBenchmark(fixtures, candidates);
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
