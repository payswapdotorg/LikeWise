// Deterministic reconstruction benchmark fixtures (W3C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a synthetic reconstruction
// evidence spec (seeded synthetic capture payloads from the W2C machinery)
// and golden expectations. Golden expectations are recorded values (computed
// once by the shipped generator/scorer and embedded on 2026-10-11); an
// intentional change to any golden is a NEW fixture version with provenance
// — never an in-place edit.

import type { SyntheticReconstructionEvidenceSpec } from "./reconstructionEvidence.js";
import { deriveReconstructionEvidence } from "./reconstructionEvidence.js";
import { sha256Hex, type NeutralReconstructionEvidence } from "./reconstructionAdapterSeam.js";

export interface ReconstructionBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly spec: SyntheticReconstructionEvidenceSpec;
  /**
   * Golden: digest over the resolved evidence set (byte-identical replay
   * check; sha-256 over the canonical evidence descriptors).
   */
  readonly expectedEvidenceDigest: string;
  /** Golden: candidate id -> per-fixture quality score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

export const RECONSTRUCTION_BENCHMARK_FIXTURES: readonly ReconstructionBenchmarkFixture[] = [
  {
    fixtureId: "fixture-recon-portrait-image",
    seed: "w3c-fixture-01",
    spec: { capture: { frames: 1, width: 24, height: 32, modality: "image", includeProp: true }, viewCount: 1 },
    expectedEvidenceDigest: "5dafb3016931e7f303af81b85fbf0915240bc54abc14225171a95ec63fca16f8",
    expectedScores: {
      "mock-recon-geometry-precise": 0.986,
      "mock-recon-geometry-coarse": 0.936,
      "mock-recon-neural-full": 0.9777,
      "mock-recon-neural-degraded": 0.8128,
      "mock-recon-hybrid-balanced": 0.9345,
      "colmap-photogrammetry-eval": 0.9296,
    },
  },
  {
    fixtureId: "fixture-recon-walk-video",
    seed: "w3c-fixture-02",
    spec: { capture: { frames: 4, width: 16, height: 24, modality: "video", includeProp: false }, viewCount: 4 },
    expectedEvidenceDigest: "283f9a7f265b50f5de9ebad3a2621f0622de4bc818e53e8fb7f88575d7037357",
    expectedScores: {
      "mock-recon-geometry-precise": 0.998,
      "mock-recon-geometry-coarse": 0.9244,
      "mock-recon-neural-full": 0.9862,
      "mock-recon-neural-degraded": 0.9095,
      "mock-recon-hybrid-balanced": 0.9197,
      "colmap-photogrammetry-eval": 0.9555,
    },
  },
  {
    fixtureId: "fixture-recon-multiview-depth",
    seed: "w3c-fixture-03",
    spec: {
      capture: { frames: 2, width: 20, height: 20, modality: "depth", includeProp: true },
      viewCount: 10,
      extraEvidenceSeeds: ["w3c-fixture-03-b"],
    },
    expectedEvidenceDigest: "7b27e87d2e0af7665787f01968a21b2e12e82b5356886c25462d6e78a685f284",
    expectedScores: {
      "mock-recon-geometry-precise": 0.9889,
      "mock-recon-geometry-coarse": 0.8958,
      "mock-recon-neural-full": 0.9985,
      "mock-recon-neural-degraded": 0.7386,
      "mock-recon-hybrid-balanced": 0.8541,
      "colmap-photogrammetry-eval": 0.99,
    },
  },
];

export const RECONSTRUCTION_FIXTURE_SET_VERSION =
  "w3c-reconstruction-benchmark-fixtures/1 (seeded 2026-10-11; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_RECONSTRUCTION_REPORT_RUN_ID = "9f62702d";

/** Resolved evidence descriptors for a fixture (deterministic). */
export function fixtureEvidence(fixture: ReconstructionBenchmarkFixture): readonly NeutralReconstructionEvidence[] {
  return deriveReconstructionEvidence(fixture.seed, fixture.spec).evidence;
}

/** Deterministic digest over a resolved evidence set (sha-256 of canonical descriptors). */
export function evidenceSetDigest(evidence: readonly NeutralReconstructionEvidence[]): string {
  return sha256Hex(
    JSON.stringify(
      evidence.map((item) => ({
        evidenceId: item.evidenceId,
        contentHash: item.contentHash,
        modality: item.modality,
        frames: item.frames,
        width: item.width,
        height: item.height,
        personCoverage: item.personCoverage,
        depthCoverage: item.depthCoverage,
        viewCount: item.viewCount,
      })),
    ),
  );
}
