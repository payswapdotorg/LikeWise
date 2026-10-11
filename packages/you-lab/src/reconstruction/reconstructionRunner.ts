// Deterministic reconstruction benchmark runner (W3C).
//
// Runs the simulated candidate adapters over the seeded synthetic
// reconstruction fixtures and records results as STRUCTURED FIELDS. Truth
// law: candidate quality scores are computed fixture objectives over
// simulated domain blocks (deterministic arithmetic — labeled computed, not
// measured, and never a claim about real reconstruction technologies);
// effort/latency/cost are recorded as explicit "not-measured (simulated)"
// markers — never faked numbers. No clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  RECONSTRUCTION_BENCHMARK_DOMAINS,
  type NeutralReconstructionRequest,
  type ReconstructionAdapter,
} from "./reconstructionAdapterSeam.js";
import { createStandardReconstructionCandidates } from "./reconstructionCandidates.js";
import { fixtureEvidence, RECONSTRUCTION_BENCHMARK_FIXTURES, RECONSTRUCTION_FIXTURE_SET_VERSION, type ReconstructionBenchmarkFixture } from "./reconstructionFixtures.js";
import { scoreDomainBlocks, SCORER_RECONSTRUCTION_VERSION } from "./domainBlockScorer.js";

/** Fixed fixture-mode submission timestamp (FIXTURES.md law 3: no clock). */
export const RECONSTRUCTION_BENCH_SUBMITTED_AT = "2026-10-11T12:00:00Z";

export interface FixtureReconstructionScore {
  readonly fixtureId: string;
  readonly qualityScore: number;
}

export interface CandidateReconstructionResult {
  readonly candidateId: string;
  readonly method: string;
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureReconstructionScore[];
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

export interface ReconstructionBenchmarkReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateReconstructionResult[];
  readonly notes: readonly string[];
}

function benchmarkRequest(
  fixture: ReconstructionBenchmarkFixture,
  candidateId: string,
  method: string,
): NeutralReconstructionRequest {
  return {
    requestId: `bench-${fixture.fixtureId}-${candidateId}`,
    twinVersionId: "twin-bench-fixture",
    method,
    targetDomains: RECONSTRUCTION_BENCHMARK_DOMAINS[method] ?? [],
    evidence: fixtureEvidence(fixture),
    submittedAt: RECONSTRUCTION_BENCH_SUBMITTED_AT,
  };
}

export function runReconstructionBenchmark(
  fixtures: readonly ReconstructionBenchmarkFixture[],
  candidates: readonly ReconstructionAdapter[],
): ReconstructionBenchmarkReport {
  const candidateResults: CandidateReconstructionResult[] = candidates.map((candidate) => {
    const method = candidate.profile.methods[0] ?? "";
    const fixtureScores: FixtureReconstructionScore[] = fixtures.map((fixture) => {
      const request = benchmarkRequest(fixture, candidate.profile.id, method);
      const output = candidate.reconstruct(request);
      const parts = scoreDomainBlocks(output.producedBlocks, request.targetDomains, request.evidence, method);
      return { fixtureId: fixture.fixtureId, qualityScore: parts.blockQualityScore };
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
    "candidate quality scores are computed deterministic fixture objectives over simulated domain blocks (you-lab reconstruction scorer) — not measurements of real reconstruction technologies and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their configuration parameters are fixture inputs, not technology assessments",
    "the colmap-photogrammetry-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real COLMAP runtime was never executed (W4+ compute-plane work)",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: RECONSTRUCTION_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_RECONSTRUCTION_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardReconstructionBenchmark(
  registry: TechnologyRegistry,
  fixtures: readonly ReconstructionBenchmarkFixture[] = RECONSTRUCTION_BENCHMARK_FIXTURES,
): ReconstructionBenchmarkReport {
  return runReconstructionBenchmark(fixtures, createStandardReconstructionCandidates(registry));
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
