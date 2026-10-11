// Standard deterministic render benchmark candidates (W4C).
//
// The candidate set scored by the benchmark harness: six simulated mock
// adapters across the five method families (image-render precise / coarse,
// video-render full / degraded, motion-extraction balanced, retargeting
// balanced, 3d-render coarse) plus the three.js-backed profile-backed
// evaluation adapter. The mock configurations are PURE MOCKS
// (technologyId: null) — their parameters are fixture inputs exercising the
// seam, NOT assessments of any real render technology. The evaluation
// adapter's eligibility is registry-derived and its execution is an explicit
// simulation (nothing measured).

import type { RenderAdapter } from "./renderAdapterSeam.js";
import { createMockRenderAdapter, type MockRenderConfig } from "./mockRenderAdapter.js";
import { createThreejsRasterizationAdapter } from "./threejsRasterizationAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface RenderCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockRenderConfig;
}

export const MOCK_RENDER_CANDIDATES: readonly RenderCandidateSpec[] = [
  {
    candidateId: "mock-render-image-precise",
    description: "high-fidelity image-render simulation — tracks timeline quality closely, no dropout",
    config: {
      id: "mock-render-image-precise",
      method: "image-render",
      fidelityBase: 0.62,
      timelineSensitivity: 0.33,
      artifactDropoutRate: 0,
      fidelityJitter: 0.02,
    },
  },
  {
    candidateId: "mock-render-image-coarse",
    description: "underconfident image-render simulation — low timeline sensitivity",
    config: {
      id: "mock-render-image-coarse",
      method: "image-render",
      fidelityBase: 0.45,
      timelineSensitivity: 0.15,
      artifactDropoutRate: 0,
      fidelityJitter: 0.03,
    },
  },
  {
    candidateId: "mock-render-video-full",
    description: "high-fidelity video-render simulation — tracks timeline quality closely",
    config: {
      id: "mock-render-video-full",
      method: "video-render",
      fidelityBase: 0.6,
      timelineSensitivity: 0.33,
      artifactDropoutRate: 0,
      fidelityJitter: 0.02,
    },
  },
  {
    candidateId: "mock-render-video-degraded",
    description: "degraded video-render simulation — heavy seeded artifact dropout",
    config: {
      id: "mock-render-video-degraded",
      method: "video-render",
      fidelityBase: 0.6,
      timelineSensitivity: 0.3,
      artifactDropoutRate: 0.35,
      fidelityJitter: 0.04,
    },
  },
  {
    candidateId: "mock-render-motion-balanced",
    description: "balanced motion-extraction simulation — moderate fidelity across timelines",
    config: {
      id: "mock-render-motion-balanced",
      method: "motion-extraction",
      fidelityBase: 0.55,
      timelineSensitivity: 0.27,
      artifactDropoutRate: 0.08,
      fidelityJitter: 0.02,
    },
  },
  {
    candidateId: "mock-render-retarget-balanced",
    description: "balanced retargeting simulation — moderate fidelity across timelines",
    config: {
      id: "mock-render-retarget-balanced",
      method: "retargeting",
      fidelityBase: 0.55,
      timelineSensitivity: 0.27,
      artifactDropoutRate: 0.08,
      fidelityJitter: 0.02,
    },
  },
  {
    candidateId: "mock-render-3d-coarse",
    description: "coarse 3d-render simulation — high base fidelity, low timeline sensitivity",
    config: {
      id: "mock-render-3d-coarse",
      method: "3d-render",
      fidelityBase: 0.72,
      timelineSensitivity: 0.12,
      artifactDropoutRate: 0,
      fidelityJitter: 0.03,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardRenderCandidates(registry: TechnologyRegistry): readonly RenderAdapter[] {
  return [
    ...MOCK_RENDER_CANDIDATES.map((candidate) => createMockRenderAdapter(candidate.config)),
    createThreejsRasterizationAdapter(registry),
  ];
}
