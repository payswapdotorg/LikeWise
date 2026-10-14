// Deterministic ecosystem benchmark runner (W10C).
//
// Runs the simulated ecosystem candidate adapters over the seeded synthetic
// request fixtures, scoring fulfillment fidelity and determinism, and
// records results as STRUCTURED FIELDS. Truth law: candidate fidelity
// scores are computed fixture objectives over simulated ecosystem
// fulfillments (deterministic arithmetic — labeled computed, not measured,
// and never a claim about real ecosystem technologies); effort/latency/
// cost are recorded as explicit "not-measured (simulated)" markers —
// never faked numbers. No clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { EcosystemAdapter, ProviderMatrixRegistry } from "./providerMatrixSeam.js";
import type { ProductionEligibilityLedger } from "./eligibilityLedger.js";
import { ECOSYSTEM_BENCHMARK_FIXTURES, ECOSYSTEM_FIXTURE_SET_VERSION, fixtureRequest, type EcosystemBenchmarkFixture } from "./ecosystemFixtures.js";
import { SCORER_ECOSYSTEM_VERSION, intendedPayloadDigestFor, scoreEcosystemFulfillment } from "./ecosystemScorer.js";

export interface FixtureEcosystemScore {
  readonly fixtureId: string;
  readonly fidelityScore: number;
}

export interface CandidateEcosystemResult {
  readonly candidateId: string;
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureEcosystemScore[];
  /** Mean of fixture ecosystem-fidelity scores (deterministic arithmetic). */
  readonly overallFidelityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Computed: byte-identical double-invocation replay (not just the profile claim). */
  readonly deterministic: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
}

export interface EcosystemBenchmarkRunReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateEcosystemResult[];
  readonly notes: readonly string[];
}

/**
 * Run the ecosystem benchmark: each candidate fulfills every fixture's
 * request through the fail-closed gate (matrix + ledger), the scorer
 * compares against the intended model, and determinism is COMPUTED by a
 * byte-identical double invocation.
 */
export function runEcosystemBenchmark(
  fixtures: readonly EcosystemBenchmarkFixture[],
  candidates: readonly EcosystemAdapter[],
  matrix: ProviderMatrixRegistry,
  ledger: ProductionEligibilityLedger,
): EcosystemBenchmarkRunReport {
  const candidateResults: CandidateEcosystemResult[] = candidates.map((candidate) => {
    const fixtureScores: FixtureEcosystemScore[] = fixtures.map((fixture) => {
      const request = fixtureRequest(fixture);
      const output = candidate.fulfill(request, matrix, ledger);
      const parts = scoreEcosystemFulfillment(matrix, request, output);
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
      const request = fixtureRequest(firstFixture);
      const first = candidate.fulfill(request, matrix, ledger);
      const second = candidate.fulfill(request, matrix, ledger);
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
    "candidate fidelity scores are computed deterministic fixture objectives over simulated ecosystem fulfillments (you-lab ecosystem scorer) — not measurements of real ecosystem technologies and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their degradation parameters are fixture inputs, not technology assessments",
    "the model-viewer-ar-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real @google/model-viewer component was never executed (post-W10 compute-plane work)",
    "determinism is computed by byte-identical double invocation, not asserted from adapter profiles",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: ECOSYSTEM_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_ECOSYSTEM_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardEcosystemBenchmark(
  candidates: readonly EcosystemAdapter[],
  matrix: ProviderMatrixRegistry,
  ledger: ProductionEligibilityLedger,
  fixtures: readonly EcosystemBenchmarkFixture[] = ECOSYSTEM_BENCHMARK_FIXTURES,
): EcosystemBenchmarkRunReport {
  return runEcosystemBenchmark(fixtures, candidates, matrix, ledger);
}

/** The intended payload digest for a fixture (the golden objective check helper). */
export function fixtureIntendedPayloadDigest(
  fixture: EcosystemBenchmarkFixture,
  matrix: ProviderMatrixRegistry,
): string {
  const request = fixtureRequest(fixture);
  const entry = matrix.resolve(request.providerKind, request.region);
  if (!entry) {
    throw new Error(`fixtureIntendedPayloadDigest: fixture '${fixture.fixtureId}' resolves no matrix row (the fixtures gate through eligible rows only)`);
  }
  return intendedPayloadDigestFor(entry, request);
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
