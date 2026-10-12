// Deterministic learning benchmark runner (W6C).
//
// Runs the simulated learning candidate adapters over the seeded synthetic
// takeover-trajectory fixtures, scoring learning fidelity and determinism,
// and records results as STRUCTURED FIELDS. Truth law: candidate fidelity
// scores are computed fixture objectives over simulated learning records
// (deterministic arithmetic — labeled computed, not measured, and never a
// claim about real learning technologies); effort/latency/cost are recorded
// as explicit "not-measured (simulated)" markers — never faked numbers. No
// clock, no randomness, no network.
//
// RIGHTS LAW: the benchmark threads a synthetic fixture-mode rights grant
// into every learning invocation. Adapters never mint consent — the grant
// is injected here (a real grant is minted by the wave-2 consent authority;
// this fixture grant is an explicitly simulated stand-in, clearly labeled).

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import {
  sha256Hex,
  type LearningAdapter,
  type NeutralLearningRequest,
  type NeutralLearningRights,
} from "./learningAdapterSeam.js";
import { LEARNING_EVALUATION_USAGE_CLASSES } from "./learnerEvaluation.js";
import {
  LEARNING_BENCHMARK_FIXTURES,
  LEARNING_FIXTURE_SET_VERSION,
  fixtureInvocationSignal,
  type LearningBenchmarkFixture,
} from "./learningFixtures.js";
import { SCORER_LEARNING_VERSION, scoreLearningFidelity } from "./learningScorer.js";

/** Fixed fixture-mode invocation timestamp (FIXTURES.md law 3: no clock). */
export const LEARNING_BENCH_SUBMITTED_AT = "2026-10-12T12:00:00Z";

export interface FixtureLearningScore {
  readonly fixtureId: string;
  readonly fidelityScore: number;
}

export interface CandidateLearningResult {
  readonly candidateId: string;
  readonly learnerClass: string;
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureLearningScore[];
  /** Mean of fixture learning-fidelity scores (deterministic arithmetic). */
  readonly overallFidelityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Computed: byte-identical double-invocation replay (not just the profile claim). */
  readonly deterministic: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
}

export interface LearningBenchmarkRunReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateLearningResult[];
  readonly notes: readonly string[];
}

/**
 * Synthetic fixture-mode learning rights grant (simulated stand-in — the
 * wave-2 consent authority mints real grants; adapters only ever receive
 * rights through this injected context and never mint consent).
 */
function fixtureLearningRights(): NeutralLearningRights {
  return {
    usage: [...LEARNING_EVALUATION_USAGE_CLASSES],
    consentRef: "you-lab-fixture-learning-consent",
    consentHash: sha256Hex("you-lab-fixture-learning-consent|w6c"),
    expiresAt: null,
  };
}

function benchmarkRequest(fixture: LearningBenchmarkFixture, candidateId: string): NeutralLearningRequest {
  const signal = fixtureInvocationSignal(fixture);
  return {
    requestId: `bench-${fixture.fixtureId}-${candidateId}`,
    signal,
    scope: signal.scope,
    rights: fixtureLearningRights(),
    submittedAt: LEARNING_BENCH_SUBMITTED_AT,
  };
}

export function runLearningBenchmark(
  fixtures: readonly LearningBenchmarkFixture[],
  candidates: readonly LearningAdapter[],
): LearningBenchmarkRunReport {
  const candidateResults: CandidateLearningResult[] = candidates.map((candidate) => {
    const fixtureScores: FixtureLearningScore[] = fixtures.map((fixture) => {
      const request = benchmarkRequest(fixture, candidate.profile.id);
      const output = candidate.learn(request);
      const parts = scoreLearningFidelity(request, output);
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
      const first = candidate.learn(request);
      const second = candidate.learn(request);
      deterministic = canonicalJson(first) === canonicalJson(second);
    }
    return {
      candidateId: candidate.profile.id,
      learnerClass: candidate.profile.learnerClass,
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
    "candidate fidelity scores are computed deterministic fixture objectives over simulated learning records (you-lab learning scorer) — not measurements of real learning technologies and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their degradation parameters are fixture inputs, not technology assessments",
    "the vowpal-wabbit-learning-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real Vowpal Wabbit learner was never executed (W7+ compute-plane work)",
    "determinism is computed by byte-identical double invocation, not asserted from adapter profiles",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: LEARNING_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_LEARNING_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardLearningBenchmark(
  candidates: readonly LearningAdapter[],
  fixtures: readonly LearningBenchmarkFixture[] = LEARNING_BENCHMARK_FIXTURES,
): LearningBenchmarkRunReport {
  return runLearningBenchmark(fixtures, candidates);
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
