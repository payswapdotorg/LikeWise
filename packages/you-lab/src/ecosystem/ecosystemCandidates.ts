// Standard deterministic ecosystem benchmark candidates (W10C).
//
// The candidate set scored by the ecosystem benchmark harness: six
// simulated mock adapters across the order's degradation classes
// (full-fidelity, coarse, lossy, export-folding, misbreaker, minimal)
// plus the model-viewer-class profile-backed evaluation adapter. The mock
// configurations are PURE MOCKS (technologyId: null) — their parameters
// are fixture inputs exercising the seam, NOT assessments of any real
// ecosystem technology. The evaluation adapter's eligibility is
// registry-derived and its execution is an explicit simulation (nothing
// measured).

import { ECOSYSTEM_REGIONS, type EcosystemAdapter } from "./providerMatrixSeam.js";
import { createMockEcosystemAdapter, type MockEcosystemConfig } from "./mockEcosystemAdapter.js";
import { createModelViewerArEvaluationAdapter } from "./modelViewerArEvaluationAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface EcosystemCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockEcosystemConfig;
}

/** Style/export surface every standard mock serves (the whole-vocabulary-servable law). */
const SERVED_STYLES = ["photoreal", "anime-stylized", "illustrated", "sculptural", "voxel"] as const;
const SERVED_EXPORTS = ["glb", "gltf", "vrm-1.0", "usdz-ar-quick-look", "webxr-ar-scene"] as const;

export const MOCK_ECOSYSTEM_CANDIDATES: readonly EcosystemCandidateSpec[] = [
  {
    candidateId: "mock-ecosystem-precise",
    description: "exact-fidelity ecosystem simulation — full (style × export) coverage, no drift, export classes preserved, breaker class honored",
    config: {
      id: "mock-ecosystem-precise",
      servedRegions: [...ECOSYSTEM_REGIONS],
      servedStyles: [...SERVED_STYLES],
      servedExports: [...SERVED_EXPORTS],
      fulfillmentRate: 1,
      fidelityDrift: 0,
      preservesExportClasses: true,
      honorsBreakerClass: true,
    },
  },
  {
    candidateId: "mock-ecosystem-coarse",
    description: "coarse ecosystem simulation — moderate seeded fulfillment dropout and fidelity drift",
    config: {
      id: "mock-ecosystem-coarse",
      servedRegions: [...ECOSYSTEM_REGIONS],
      servedStyles: [...SERVED_STYLES],
      servedExports: [...SERVED_EXPORTS],
      fulfillmentRate: 0.85,
      fidelityDrift: 0.1,
      preservesExportClasses: true,
      honorsBreakerClass: true,
    },
  },
  {
    candidateId: "mock-ecosystem-lossy",
    description: "lossy ecosystem simulation — seeded fulfillment dropout, drift and export-class folding",
    config: {
      id: "mock-ecosystem-lossy",
      servedRegions: [...ECOSYSTEM_REGIONS],
      servedStyles: [...SERVED_STYLES],
      servedExports: [...SERVED_EXPORTS],
      fulfillmentRate: 0.6,
      fidelityDrift: 0.25,
      preservesExportClasses: false,
      honorsBreakerClass: true,
    },
  },
  {
    candidateId: "mock-ecosystem-stale-export",
    description: "export-stale ecosystem simulation — every fulfillment folds into the first requested export (visible staleness)",
    config: {
      id: "mock-ecosystem-stale-export",
      servedRegions: [...ECOSYSTEM_REGIONS],
      servedStyles: [...SERVED_STYLES],
      servedExports: [...SERVED_EXPORTS],
      fulfillmentRate: 0.9,
      fidelityDrift: 0.05,
      preservesExportClasses: false,
      honorsBreakerClass: true,
    },
  },
  {
    candidateId: "mock-ecosystem-misbreaker",
    description: "breaker-misderiving ecosystem simulation — derives fidelity under the token-bucket band (visible misderivation)",
    config: {
      id: "mock-ecosystem-misbreaker",
      servedRegions: [...ECOSYSTEM_REGIONS],
      servedStyles: [...SERVED_STYLES],
      servedExports: [...SERVED_EXPORTS],
      fulfillmentRate: 0.9,
      fidelityDrift: 0,
      preservesExportClasses: true,
      honorsBreakerClass: false,
    },
  },
  {
    candidateId: "mock-ecosystem-minimal",
    description: "minimal ecosystem simulation — heavy dropout, drift, export folding and misderived breaker class",
    config: {
      id: "mock-ecosystem-minimal",
      servedRegions: [...ECOSYSTEM_REGIONS],
      servedStyles: [...SERVED_STYLES],
      servedExports: [...SERVED_EXPORTS],
      fulfillmentRate: 0.4,
      fidelityDrift: 0.3,
      preservesExportClasses: false,
      honorsBreakerClass: false,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardEcosystemCandidates(registry: TechnologyRegistry): readonly EcosystemAdapter[] {
  return [
    ...MOCK_ECOSYSTEM_CANDIDATES.map((candidate) => createMockEcosystemAdapter(candidate.config)),
    createModelViewerArEvaluationAdapter(registry),
  ];
}
