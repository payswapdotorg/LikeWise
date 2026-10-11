// Standard deterministic reconstruction benchmark candidates (W3C).
//
// The candidate set scored by the benchmark harness: five simulated mock
// adapters across the three method families (explicit-geometry precise /
// coarse, neural-appearance full / degraded, hybrid balanced) plus the
// COLMAP-backed profile-backed evaluation adapter. The mock configurations
// are PURE MOCKS (technologyId: null) — their parameters are fixture inputs
// exercising the seam, NOT assessments of any real reconstruction
// technology. The evaluation adapter's eligibility is registry-derived and
// its execution is an explicit simulation (nothing measured).

import type { ReconstructionAdapter } from "./reconstructionAdapterSeam.js";
import { createMockReconstructionAdapter, type MockReconstructionConfig } from "./mockReconstructionAdapter.js";
import { createColmapPhotogrammetryAdapter } from "./colmapPhotogrammetryAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface ReconstructionCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockReconstructionConfig;
}

export const MOCK_RECONSTRUCTION_CANDIDATES: readonly ReconstructionCandidateSpec[] = [
  {
    candidateId: "mock-recon-geometry-precise",
    description: "high-fidelity explicit-geometry simulation — tracks evidence quality closely, no dropout",
    config: {
      id: "mock-recon-geometry-precise",
      method: "explicit-geometry",
      confidenceBase: 0.62,
      evidenceSensitivity: 0.33,
      domainDropoutRate: 0,
      confidenceJitter: 0.02,
    },
  },
  {
    candidateId: "mock-recon-geometry-coarse",
    description: "underconfident explicit-geometry simulation — low evidence sensitivity",
    config: {
      id: "mock-recon-geometry-coarse",
      method: "explicit-geometry",
      confidenceBase: 0.45,
      evidenceSensitivity: 0.15,
      domainDropoutRate: 0,
      confidenceJitter: 0.03,
    },
  },
  {
    candidateId: "mock-recon-neural-full",
    description: "high-fidelity neural-appearance simulation — tracks evidence quality closely",
    config: {
      id: "mock-recon-neural-full",
      method: "neural-appearance",
      confidenceBase: 0.6,
      evidenceSensitivity: 0.33,
      domainDropoutRate: 0,
      confidenceJitter: 0.02,
    },
  },
  {
    candidateId: "mock-recon-neural-degraded",
    description: "degraded neural-appearance simulation — heavy seeded domain dropout",
    config: {
      id: "mock-recon-neural-degraded",
      method: "neural-appearance",
      confidenceBase: 0.6,
      evidenceSensitivity: 0.3,
      domainDropoutRate: 0.35,
      confidenceJitter: 0.04,
    },
  },
  {
    candidateId: "mock-recon-hybrid-balanced",
    description: "balanced hybrid simulation — moderate fidelity across both domain families",
    config: {
      id: "mock-recon-hybrid-balanced",
      method: "hybrid",
      confidenceBase: 0.55,
      evidenceSensitivity: 0.27,
      domainDropoutRate: 0.08,
      confidenceJitter: 0.02,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardReconstructionCandidates(
  registry: TechnologyRegistry,
): readonly ReconstructionAdapter[] {
  return [
    ...MOCK_RECONSTRUCTION_CANDIDATES.map((candidate) => createMockReconstructionAdapter(candidate.config)),
    createColmapPhotogrammetryAdapter(registry),
  ];
}
