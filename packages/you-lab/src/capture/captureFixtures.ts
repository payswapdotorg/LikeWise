// Deterministic capture benchmark fixtures (W2C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a synthetic capture payload
// spec and golden expectations. Golden expectations are recorded values
// (computed once by the shipped generator/scorer and embedded on 2026-10-09);
// an intentional change to any golden is a NEW fixture version with
// provenance — never an in-place edit.

import type { SyntheticCaptureSpec } from "./syntheticPayload.js";

export interface CaptureBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly spec: SyntheticCaptureSpec;
  /** Golden: synthetic payload digest (byte-identical replay check). */
  readonly expectedPayloadDigest: string;
  /** Golden: candidate id -> per-fixture quality score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

export const CAPTURE_BENCHMARK_FIXTURES: readonly CaptureBenchmarkFixture[] = [
  {
    fixtureId: "fixture-capture-portrait-image",
    seed: "w2c-fixture-01",
    spec: { frames: 1, width: 24, height: 32, modality: "image", includeProp: true },
    expectedPayloadDigest: "9c4934d4",
    expectedScores: {
      "mock-seg-precise": 0.9754,
      "mock-seg-noisy": 0.7262,
      "mock-seg-coarse": 0.3722,
      "mock-pose-full": 0.9331,
      "mock-pose-degraded": 0.6346,
      "mock-pose-partial": 0.7914,
    },
  },
  {
    fixtureId: "fixture-capture-walk-video",
    seed: "w2c-fixture-02",
    spec: { frames: 4, width: 16, height: 24, modality: "video", includeProp: false },
    expectedPayloadDigest: "eb2b7c9d",
    expectedScores: {
      "mock-seg-precise": 0.9835,
      "mock-seg-noisy": 0.711,
      "mock-seg-coarse": 0.5466,
      "mock-pose-full": 0.925,
      "mock-pose-degraded": 0.6083,
      "mock-pose-partial": 0.7751,
    },
  },
  {
    fixtureId: "fixture-capture-depth-scan",
    seed: "w2c-fixture-03",
    spec: { frames: 2, width: 20, height: 20, modality: "depth", includeProp: true },
    expectedPayloadDigest: "5a062bf9",
    expectedScores: {
      "mock-seg-precise": 0.9833,
      "mock-seg-noisy": 0.8392,
      "mock-seg-coarse": 0.3383,
      "mock-pose-full": 0.9269,
      "mock-pose-degraded": 0.6069,
      "mock-pose-partial": 0.7748,
    },
  },
];

export const CAPTURE_FIXTURE_SET_VERSION =
  "w2c-capture-benchmark-fixtures/1 (seeded 2026-10-09; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_CAPTURE_REPORT_RUN_ID = "aadfcb78";
