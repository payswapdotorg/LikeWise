// Standard deterministic soul benchmark candidates (W7C).
//
// The candidate set scored by the soul benchmark harness: six simulated
// mock adapters across the order's soul candidate classes (LLM/VLM
// providers: serving precise/coarse, vlm balanced/lossy; state-routing
// approaches: routing faithful/lossy) plus the llama.cpp-class
// profile-backed evaluation adapter. The mock configurations are PURE MOCKS
// (technologyId: null) — their parameters are fixture inputs exercising the
// seam, NOT assessments of any real soul technology. The evaluation
// adapter's eligibility is registry-derived and its execution is an
// explicit simulation (nothing measured). The speculative-decode class is
// registry-researched (eagle, medusa) but deliberately NOT part of the mock
// candidate set (the W6C cost-aware-selection precedent: the class table,
// not the mock set, is the research surface).

import type { SoulAdapter } from "./soulAdapterSeam.js";
import { createMockSoulAdapter, type MockSoulConfig } from "./mockSoulAdapter.js";
import { createLlamaCppSoulEvaluationAdapter } from "./llamaCppEvaluationAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface SoulCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockSoulConfig;
}

export const MOCK_SOUL_CANDIDATES: readonly SoulCandidateSpec[] = [
  {
    candidateId: "mock-soul-serving-precise",
    description: "exact-recovery serving-stack simulation — full context coverage, no drift, modalities preserved, routing honored",
    config: {
      id: "mock-soul-serving-precise",
      soulClass: "serving-stack",
      supportedModalities: ["text", "image", "audio"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "interactive",
      contextIngestRate: 1,
      responseDrift: 0,
      preservesModalities: true,
      honorsRoutingProfile: true,
    },
  },
  {
    candidateId: "mock-soul-serving-coarse",
    description: "coarse serving-stack simulation — moderate seeded context dropout and response drift",
    config: {
      id: "mock-soul-serving-coarse",
      soulClass: "serving-stack",
      supportedModalities: ["text", "image", "audio"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "turn-based",
      contextIngestRate: 0.75,
      responseDrift: 0.1,
      preservesModalities: true,
      honorsRoutingProfile: true,
    },
  },
  {
    candidateId: "mock-soul-vlm-balanced",
    description: "balanced vlm-family simulation — small seeded dropout and drift, modalities preserved",
    config: {
      id: "mock-soul-vlm-balanced",
      soulClass: "vlm-family",
      supportedModalities: ["text", "image", "audio"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "interactive",
      contextIngestRate: 0.9,
      responseDrift: 0.05,
      preservesModalities: true,
      honorsRoutingProfile: true,
    },
  },
  {
    candidateId: "mock-soul-vlm-lossy",
    description: "lossy vlm-family simulation — seeded dropout, drift and modality folding",
    config: {
      id: "mock-soul-vlm-lossy",
      soulClass: "vlm-family",
      supportedModalities: ["text", "image", "audio"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "turn-based",
      contextIngestRate: 0.7,
      responseDrift: 0.08,
      preservesModalities: false,
      honorsRoutingProfile: true,
    },
  },
  {
    candidateId: "mock-soul-routing-faithful",
    description: "faithful state-routing simulation — full context coverage under the requested route, no drift",
    config: {
      id: "mock-soul-routing-faithful",
      soulClass: "state-routing",
      supportedModalities: ["text", "image", "audio"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "interactive",
      contextIngestRate: 1,
      responseDrift: 0,
      preservesModalities: true,
      honorsRoutingProfile: true,
    },
  },
  {
    candidateId: "mock-soul-routing-lossy",
    description: "misrouting state-routing simulation — answers on the flipped route (visible misroute) with moderate dropout",
    config: {
      id: "mock-soul-routing-lossy",
      soulClass: "state-routing",
      supportedModalities: ["text", "image", "audio"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "interactive",
      contextIngestRate: 0.85,
      responseDrift: 0,
      preservesModalities: true,
      honorsRoutingProfile: false,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardSoulCandidates(registry: TechnologyRegistry): readonly SoulAdapter[] {
  return [
    ...MOCK_SOUL_CANDIDATES.map((candidate) => createMockSoulAdapter(candidate.config)),
    createLlamaCppSoulEvaluationAdapter(registry),
  ];
}
