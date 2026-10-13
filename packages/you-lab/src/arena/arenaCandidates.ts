// Standard deterministic arena benchmark candidates (W8C).
//
// The candidate set scored by the arena benchmark harness: six simulated
// mock adapters across the order's degradation classes (full-fidelity,
// coarse, lossy, stale-strategy, misbackoff, minimal) plus the p-retry-
// class profile-backed evaluation adapter. The mock configurations are
// PURE MOCKS (technologyId: null) — their parameters are fixture inputs
// exercising the seam, NOT assessments of any real arena provider or
// retry library. The evaluation adapter's eligibility is registry-derived
// and its execution is an explicit simulation (nothing measured). The
// token-bucket class is registry-researched (bottleneck — maintenance-
// gate-failing) and deliberately exercised only through the misbackoff
// mock's derivation band, never as a production pick.

import { NEUTRAL_CAPABILITY_GAP_CATEGORIES, type ArenaAdapter } from "./arenaAdapterSeam.js";
import { createMockArenaAdapter, type MockArenaConfig } from "./mockArenaAdapter.js";
import { createPRetryBackoffArenaEvaluationAdapter } from "./pRetryEvaluationAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface ArenaCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockArenaConfig;
}

/** Capability-class surface every standard mock serves (the W6C whole-set-servable law). */
const SERVED_CLASSES = ["arena-automation", ...NEUTRAL_CAPABILITY_GAP_CATEGORIES.map((category) => `gap-category:${category}`)];

export const MOCK_ARENA_CANDIDATES: readonly ArenaCandidateSpec[] = [
  {
    candidateId: "mock-arena-precise",
    description: "exact-recovery arena simulation — full evidence coverage, no drift, result types preserved, strategy ladder and backoff class honored",
    config: {
      id: "mock-arena-precise",
      servedCapabilityClasses: SERVED_CLASSES,
      supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
      evidenceIngestRate: 1,
      recoveryDrift: 0,
      preservesResultTypes: true,
      followsStrategyLadder: true,
      honorsBackoffClass: true,
    },
  },
  {
    candidateId: "mock-arena-coarse",
    description: "coarse arena simulation — moderate seeded evidence dropout and recovery drift",
    config: {
      id: "mock-arena-coarse",
      servedCapabilityClasses: SERVED_CLASSES,
      supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
      evidenceIngestRate: 0.75,
      recoveryDrift: 0.1,
      preservesResultTypes: true,
      followsStrategyLadder: true,
      honorsBackoffClass: true,
    },
  },
  {
    candidateId: "mock-arena-lossy",
    description: "lossy arena simulation — seeded evidence dropout, drift and result-type folding",
    config: {
      id: "mock-arena-lossy",
      servedCapabilityClasses: SERVED_CLASSES,
      supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
      evidenceIngestRate: 0.55,
      recoveryDrift: 0.2,
      preservesResultTypes: false,
      followsStrategyLadder: true,
      honorsBackoffClass: true,
    },
  },
  {
    candidateId: "mock-arena-stale-strategy",
    description: "strategy-stale arena simulation — every attempt reuses the first ladder strategy (visible staleness)",
    config: {
      id: "mock-arena-stale-strategy",
      servedCapabilityClasses: SERVED_CLASSES,
      supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
      evidenceIngestRate: 0.9,
      recoveryDrift: 0.05,
      preservesResultTypes: true,
      followsStrategyLadder: false,
      honorsBackoffClass: true,
    },
  },
  {
    candidateId: "mock-arena-misbackoff",
    description: "backoff-misderiving arena simulation — derives recovery under the token-bucket band (visible misderivation)",
    config: {
      id: "mock-arena-misbackoff",
      servedCapabilityClasses: SERVED_CLASSES,
      supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
      evidenceIngestRate: 0.9,
      recoveryDrift: 0,
      preservesResultTypes: true,
      followsStrategyLadder: true,
      honorsBackoffClass: false,
    },
  },
  {
    candidateId: "mock-arena-minimal",
    description: "minimal arena simulation — heavy dropout, drift, type folding, stale strategies and misderived backoff",
    config: {
      id: "mock-arena-minimal",
      servedCapabilityClasses: SERVED_CLASSES,
      supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
      evidenceIngestRate: 0.4,
      recoveryDrift: 0.3,
      preservesResultTypes: false,
      followsStrategyLadder: false,
      honorsBackoffClass: false,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardArenaCandidates(registry: TechnologyRegistry): readonly ArenaAdapter[] {
  return [
    ...MOCK_ARENA_CANDIDATES.map((candidate) => createMockArenaAdapter(candidate.config)),
    createPRetryBackoffArenaEvaluationAdapter(registry),
  ];
}
