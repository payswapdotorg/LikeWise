// Deterministic round-trip benchmark runner (W5C).
//
// Runs the simulated editing candidate adapters over the seeded synthetic
// subject artifacts and edit payloads, scoring round-trip fidelity and
// determinism, and records results as STRUCTURED FIELDS. Truth law:
// candidate fidelity scores are computed fixture objectives over simulated
// edit change sets (deterministic arithmetic — labeled computed, not
// measured, and never a claim about real editor technologies);
// effort/latency/cost are recorded as explicit "not-measured (simulated)"
// markers — never faked numbers. No clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import { sha256Hex, type EditingAdapter, type NeutralEditingRequest, type NeutralSubjectArtifact } from "./editingAdapterSeam.js";
import {
  ROUND_TRIP_BENCHMARK_FIXTURES,
  ROUND_TRIP_FIXTURE_SET_VERSION,
  fixtureEditPlan,
  fixtureSubjectState,
  type RoundTripBenchmarkFixture,
} from "./roundTripFixtures.js";
import { scoreRoundTripFidelity, SCORER_ROUND_TRIP_VERSION, subjectStateFromContent } from "./roundTripScorer.js";

/** Fixed fixture-mode invocation timestamp (FIXTURES.md law 3: no clock). */
export const EDITING_BENCH_SUBMITTED_AT = "2026-10-11T12:00:00Z";

export interface FixtureRoundTripScore {
  readonly fixtureId: string;
  readonly fidelityScore: number;
}

export interface CandidateRoundTripResult {
  readonly candidateId: string;
  readonly editorKind: string;
  /** Interchange format exercised at the seam for this candidate. */
  readonly format: string;
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  readonly fixtureScores: readonly FixtureRoundTripScore[];
  /** Mean of fixture fidelity scores (deterministic arithmetic). */
  readonly overallFidelityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Computed: byte-identical double-invocation replay (not just the profile claim). */
  readonly deterministic: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
}

export interface RoundTripBenchmarkRunReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateRoundTripResult[];
  readonly notes: readonly string[];
}

function subjectArtifactFor(fixture: RoundTripBenchmarkFixture): NeutralSubjectArtifact {
  const state = fixtureSubjectState(fixture);
  const content = {
    environment: state.environment,
    entities: state.entities,
  };
  return {
    artifactId: `art-${fixture.fixtureId}`,
    format: "json",
    contentRef: `content-store://you-lab/editing-fixture/${fixture.fixtureId}`,
    contentHash: sha256Hex(canonicalJson(content)),
    content,
  };
}

function benchmarkRequest(
  fixture: RoundTripBenchmarkFixture,
  candidateId: string,
  format: string,
): NeutralEditingRequest {
  return {
    requestId: `bench-${fixture.fixtureId}-${candidateId}`,
    editingSessionId: `es-bench-${fixture.fixtureId}-${candidateId}`,
    subjectArtifact: subjectArtifactFor(fixture),
    format: format as NeutralEditingRequest["format"],
    editPlan: fixtureEditPlan(fixture),
    submittedAt: EDITING_BENCH_SUBMITTED_AT,
  };
}

export function runRoundTripBenchmark(
  fixtures: readonly RoundTripBenchmarkFixture[],
  candidates: readonly EditingAdapter[],
): RoundTripBenchmarkRunReport {
  const candidateResults: CandidateRoundTripResult[] = candidates.map((candidate) => {
    const format = candidate.profile.supportedFormats[0] ?? "json";
    const fixtureScores: FixtureRoundTripScore[] = fixtures.map((fixture) => {
      const request = benchmarkRequest(fixture, candidate.profile.id, format);
      const output = candidate.invoke(request);
      const subjectState = subjectStateFromContent(request.subjectArtifact.content);
      const parts = scoreRoundTripFidelity(subjectState, request, output.changeSet, output.payloads);
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
      const request = benchmarkRequest(firstFixture, candidate.profile.id, format);
      const first = candidate.invoke(request);
      const second = candidate.invoke(request);
      deterministic = canonicalJson(first) === canonicalJson(second);
    }
    return {
      candidateId: candidate.profile.id,
      editorKind: candidate.profile.editorKind,
      format,
      adapterKind: candidate.profile.technologyId === null ? "mock" : "evaluation",
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
    "candidate fidelity scores are computed deterministic fixture objectives over simulated edit change sets (you-lab round-trip scorer) — not measurements of real editor technologies and not user studies",
    "the scored mock candidates are pure mocks (technologyId: null); their degradation parameters are fixture inputs, not technology assessments",
    "the vscode-editing-eval candidate is a profile-backed evaluation adapter: registry-derived eligibility, simulated execution — the real Visual Studio Code editor was never executed (W6+ compute-plane work)",
    "determinism is computed by byte-identical double invocation, not asserted from adapter profiles",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const reportWithoutId = {
    fixtureSetVersion: ROUND_TRIP_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_ROUND_TRIP_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** Convenience: run the standard candidate set over the standard fixtures. */
export function runStandardRoundTripBenchmark(
  candidates: readonly EditingAdapter[],
  fixtures: readonly RoundTripBenchmarkFixture[] = ROUND_TRIP_BENCHMARK_FIXTURES,
): RoundTripBenchmarkRunReport {
  return runRoundTripBenchmark(fixtures, candidates);
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
