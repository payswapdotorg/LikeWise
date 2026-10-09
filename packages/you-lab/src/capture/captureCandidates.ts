// Standard deterministic capture benchmark candidates (W2C).
//
// The candidate set scored by the benchmark harness: three simulated
// segmentation adapters (precise / noisy / coarse) and three simulated pose
// adapters (full / degraded / partial). All are PURE MOCKS (technologyId:
// null) — their configuration parameters are fixture inputs exercising the
// seam, NOT assessments of any real capture technology. Quality scores
// produced from their observations are computed fixture objectives over
// synthetic payloads, never measurements of real providers.

import { createMockSegmentationAdapter, type MockSegmentationConfig } from "./mockSegmentationAdapter.js";
import { createMockPoseAdapter, type MockPoseConfig } from "./mockPoseAdapter.js";
import type { CaptureAdapter, CaptureObservation } from "./captureAdapterSeam.js";

export interface SegmentationCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockSegmentationConfig;
}

export interface PoseCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockPoseConfig;
}

export const SEGMENTATION_CANDIDATES: readonly SegmentationCandidateSpec[] = [
  {
    candidateId: "mock-seg-precise",
    description: "high-threshold detection, minimal dropout — the reference-quality segmentation simulation",
    config: { id: "mock-seg-precise", chromaThreshold: 0.55, keepProbability: 0.98, stride: 1, minRegionBlocks: 4, confidenceBase: 0.94 },
  },
  {
    candidateId: "mock-seg-noisy",
    description: "loose threshold with heavy dropout — a noisy/degraded segmentation simulation",
    config: { id: "mock-seg-noisy", chromaThreshold: 0.4, keepProbability: 0.8, stride: 1, minRegionBlocks: 2, confidenceBase: 0.62 },
  },
  {
    candidateId: "mock-seg-coarse",
    description: "stride-2 grid coarsening — a low-resolution segmentation simulation",
    config: { id: "mock-seg-coarse", chromaThreshold: 0.55, keepProbability: 0.95, stride: 2, minRegionBlocks: 4, confidenceBase: 0.8 },
  },
];

export const POSE_CANDIDATES: readonly PoseCandidateSpec[] = [
  {
    candidateId: "mock-pose-full",
    description: "all 17 neutral landmarks with minimal jitter — the reference-quality pose simulation",
    config: { id: "mock-pose-full", jitterAmplitude: 0.03, dropLandmarkCount: 0, visibilityFloor: 0.9 },
  },
  {
    candidateId: "mock-pose-degraded",
    description: "heavy landmark jitter with attenuated visibility — a degraded pose simulation",
    config: { id: "mock-pose-degraded", jitterAmplitude: 0.18, dropLandmarkCount: 0, visibilityFloor: 0.6 },
  },
  {
    candidateId: "mock-pose-partial",
    description: "light jitter but 5 landmarks dropped — a partial-observation pose simulation",
    config: { id: "mock-pose-partial", jitterAmplitude: 0.06, dropLandmarkCount: 5, visibilityFloor: 0.85 },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardCaptureCandidates(): readonly CaptureAdapter<CaptureObservation>[] {
  return [
    ...SEGMENTATION_CANDIDATES.map((candidate) => createMockSegmentationAdapter(candidate.config)),
    ...POSE_CANDIDATES.map((candidate) => createMockPoseAdapter(candidate.config)),
  ];
}
