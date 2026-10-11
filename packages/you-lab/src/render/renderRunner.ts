// Deterministic render benchmark runner (W4C).
//
// Runs the simulated candidate adapters over the seeded synthetic
// performance fixtures and records results as STRUCTURED FIELDS. Truth
// law: candidate quality scores are computed fixture objectives over
// simulated artifacts (deterministic arithmetic — labeled computed, not
// measured, and never a claim about real render technologies);
// effort/latency/cost are recorded as explicit "not-measured (simulated)"
// markers — never faked numbers. No clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  RENDER_BENCHMARK_OUTPUT_KINDS,
  type NeutralRenderRequest,
  type RenderAdapter,
} from "./renderAdapterSeam.js";
import { createStandardRenderCandidates } from "./renderCandidates.js";
import {
  fixtureTimeline,
  RENDER_BENCHMARK_FIXTURES,
  RENDER_FIXTURE_SET_VERSION,
  type RenderBenchmarkFixture,
} from "./renderFixtures.js";
import { scoreRenderArtifacts, SCORER_RENDER_VERSION } from "./renderArtifactScorer.js";

/** Fixed fixture-mode submission timestamp (FIXTURES.md law 3: no clock). */
export const RENDER_BENCH_SUBMITTED_AT = "2026-10-11T12:00:00Z";

export interface FixtureRenderScore {
  readonly fixtureId: string;
  readonly qualityScore: number;
}

export interface CandidateRenderResult {
  readonly candidateId: string;
  readonly method: string;
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureRenderScore[];
  /** Mean of fixture quality scores (deterministic arithmetic). */
  readonly overallQualityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Adapter-level determinism (simulated adapters are deterministic by design). */
  readonly deterministic: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
}

export interface RenderBenchmarkReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateRenderResult[];
  readonly notes: readonly string[];
}

function benchmarkRequest(
  fixture: RenderBenchmarkFixture,
  candidateId: string,
  method: string,
): NeutralRenderRequest {
  return {
    requestId: `bench-${fixture.fixtureId}-${candidateId}`,
    performanceId: `perf-bench-${fixture.fixtureId}`,
    method: method as NeutralRenderRequest["method"],
    outputKinds: RENDER_BENCHMARK_OUTPUT_KINDS[method] ?? [],
    parameters: {},
    timeline: fixtureTimeline(fixture),
    submittedAt: RENDER_BENCH_SUBMITTED_AT,
  };
}

export function runRenderBenchmark(
  fixtures: readonly RenderBenchmarkFixture[],
  candidates: readonly RenderAdapter[],
): RenderBenchmarkReport {
  const candidateResults: CandidateRenderResult[] = candidates.map((candidate) => {
    const method = candidate.profile.methods[0] ?? "";
    const fixtureScores: FixtureRenderScore[] = fixtures.map((fixture) => {
      const request = benchmarkRequest(fixture, candidate.profile.id, method);
      const output = candidate.render(request);
      const parts = scoreRenderArtifacts(output.producedArtifacts, request.outputKinds, request.timeline, method);
      return { fixtureId: fixture.fixtureId, qualityScore: parts.artifactQualityScore };
    });
    const mean =
      fixtureScores.length === 0
        ? 0
        : fixtureScores.reduce((sum, entry) => sum + entry.qualityScore, 0) / fixtureScores.length;
    return {
      candidateId: candidate.profile.id,
      method,
      adapterKind: candidate.profile.technologyId === null ? "mock" : "evaluation",
      fixtureScores,
      overallQualityScore: Math.round(mean * 10_000) / 10_000,
      effort: notMeasured(),
      latency: notMeasured(),
      cost: notMeasured(),
      deterministic: candidate.profile.deterministic,
      productionEligible: candidate.profile.productionEligible,
    };
  });
  const notes = [
    "candidate quality scores are computed deterministic fixture objectives over simulated render artifacts (you-lab render scorer) — not measurements of real render technologies and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their configuration parameters are fixture inputs, not technology assessments",
    "the threejs-rasterization-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real three.js runtime was never executed (W5+ compute-plane work)",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: RENDER_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_RENDER_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardRenderBenchmark(
  registry: TechnologyRegistry,
  fixtures: readonly RenderBenchmarkFixture[] = RENDER_BENCHMARK_FIXTURES,
): RenderBenchmarkReport {
  return runRenderBenchmark(fixtures, createStandardRenderCandidates(registry));
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
