// Deterministic capture benchmark runner (W2C).
//
// Runs the simulated candidate adapters over the seeded synthetic capture
// fixtures and records results as STRUCTURED FIELDS. Truth law: candidate
// quality scores are computed fixture objectives over simulated observations
// (deterministic arithmetic — labeled computed, not measured, and never a
// claim about real capture technologies); effort/latency/cost are recorded
// as explicit "not-measured (simulated)" markers — never faked numbers. No
// clock, no randomness, no network.

import { canonicalJson, fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { CaptureAdapter, CaptureObservation } from "./captureAdapterSeam.js";
import { generateSyntheticCapture } from "./syntheticPayload.js";
import type { CaptureBenchmarkFixture } from "./captureFixtures.js";
import { scoreSegmentationObservations, scorePoseObservations, SCORER_CAPTURE_VERSION } from "./observationScorer.js";
import { CAPTURE_FIXTURE_SET_VERSION } from "./captureFixtures.js";

export interface FixtureCandidateScore {
  readonly fixtureId: string;
  readonly qualityScore: number;
}

export interface CandidateCaptureResult {
  readonly candidateId: string;
  readonly observationKind: "segmentation" | "pose";
  readonly fixtureScores: readonly FixtureCandidateScore[];
  /** Mean of fixture quality scores (deterministic arithmetic). */
  readonly overallQualityScore: number;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
  /** Adapter-level determinism (mock adapters are deterministic by design). */
  readonly deterministic: boolean;
}

export interface CaptureBenchmarkReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly scorerVersion: string;
  readonly candidateResults: readonly CandidateCaptureResult[];
  readonly notes: readonly string[];
}

export function runCaptureBenchmark(
  fixtures: readonly CaptureBenchmarkFixture[],
  candidates: readonly CaptureAdapter<CaptureObservation>[],
): CaptureBenchmarkReport {
  const candidateResults: CandidateCaptureResult[] = candidates.map((candidate) => {
    const fixtureScores: FixtureCandidateScore[] = fixtures.map((fixture) => {
      const { payload, groundTruth } = generateSyntheticCapture(fixture.seed, fixture.spec);
      const batch = candidate.observe(payload, fixture.seed);
      const qualityScore =
        candidate.observationKind === "segmentation"
          ? scoreSegmentationObservations(
              batch.observations as Extract<CaptureObservation, { kind: "segmentation" }>[],
              groundTruth,
            ).segmentationScore
          : scorePoseObservations(
              batch.observations as Extract<CaptureObservation, { kind: "pose" }>[],
              groundTruth,
            ).poseScore;
      return { fixtureId: fixture.fixtureId, qualityScore };
    });
    const mean =
      fixtureScores.length === 0
        ? 0
        : fixtureScores.reduce((sum, entry) => sum + entry.qualityScore, 0) / fixtureScores.length;
    return {
      candidateId: candidate.profile.id,
      observationKind: candidate.observationKind,
      fixtureScores,
      overallQualityScore: Math.round(mean * 10_000) / 10_000,
      effort: notMeasured(),
      latency: notMeasured(),
      cost: notMeasured(),
      deterministic: candidate.profile.deterministic,
    };
  });
  const notes = [
    "candidate quality scores are computed deterministic fixture objectives over simulated observations (you-lab capture scorer) — not measurements of real capture technologies and not user studies",
    "the scored candidates are pure mock adapters (technologyId: null); their configuration parameters are fixture inputs, not technology assessments",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
    "real capture technology candidates are evaluated separately (captureEvaluation) via registry-backed licensing and authored capability/runtime tables",
  ];
  const reportWithoutId = {
    fixtureSetVersion: CAPTURE_FIXTURE_SET_VERSION,
    scorerVersion: SCORER_CAPTURE_VERSION,
    candidateResults,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
