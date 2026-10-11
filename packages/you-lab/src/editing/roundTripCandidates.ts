// Standard deterministic round-trip benchmark candidates (W5C).
//
// The candidate set scored by the round-trip benchmark harness: six
// simulated mock adapters across the three W5C editor kinds (native
// precise/coarse, embedded balanced/lossy, external faithful/lossy) plus
// the VS Code-class profile-backed evaluation adapter. The mock
// configurations are PURE MOCKS (technologyId: null) — their parameters are
// fixture inputs exercising the seam, NOT assessments of any real editor
// technology. The evaluation adapter's eligibility is registry-derived and
// its execution is an explicit simulation (nothing measured).

import type { EditingAdapter } from "./editingAdapterSeam.js";
import { createMockEditingAdapter, type MockEditingConfig } from "./mockEditingAdapter.js";
import { createVscodeEditingEvaluationAdapter } from "./vscodeEvaluationAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface RoundTripCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockEditingConfig;
}

export const MOCK_EDITING_CANDIDATES: readonly RoundTripCandidateSpec[] = [
  {
    candidateId: "mock-editing-native-precise",
    description: "byte-precise native editing simulation — no dropout, no drift",
    config: {
      id: "mock-editing-native-precise",
      editorKind: "native",
      supportedFormats: ["json", "edit-interchange"],
      opDropoutRate: 0,
      transformJitter: 0,
      environmentSurvives: true,
    },
  },
  {
    candidateId: "mock-editing-native-coarse",
    description: "coarse native editing simulation — moderate seeded op dropout",
    config: {
      id: "mock-editing-native-coarse",
      editorKind: "native",
      supportedFormats: ["json"],
      opDropoutRate: 0.25,
      transformJitter: 0.1,
      environmentSurvives: true,
    },
  },
  {
    candidateId: "mock-editing-embedded-balanced",
    description: "balanced embedded editing simulation — small seeded dropout and drift",
    config: {
      id: "mock-editing-embedded-balanced",
      editorKind: "embedded",
      supportedFormats: ["json", "edit-interchange"],
      opDropoutRate: 0.1,
      transformJitter: 0.05,
      environmentSurvives: true,
    },
  },
  {
    candidateId: "mock-editing-embedded-lossy",
    description: "lossy embedded editing simulation — format conversion drops environment edits",
    config: {
      id: "mock-editing-embedded-lossy",
      editorKind: "embedded",
      supportedFormats: ["json"],
      opDropoutRate: 0.3,
      transformJitter: 0.08,
      environmentSurvives: false,
    },
  },
  {
    candidateId: "mock-editing-external-faithful",
    description: "faithful external pipeline simulation — moderate seeded dropout",
    config: {
      id: "mock-editing-external-faithful",
      editorKind: "external",
      supportedFormats: ["gltf", "glb"],
      opDropoutRate: 0.15,
      transformJitter: 0.05,
      environmentSurvives: true,
    },
  },
  {
    candidateId: "mock-editing-external-lossy",
    description: "lossy external pipeline simulation — heavy seeded dropout, environment lost",
    config: {
      id: "mock-editing-external-lossy",
      editorKind: "external",
      supportedFormats: ["gltf"],
      opDropoutRate: 0.4,
      transformJitter: 0.15,
      environmentSurvives: false,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardEditingCandidates(registry: TechnologyRegistry): readonly EditingAdapter[] {
  return [
    ...MOCK_EDITING_CANDIDATES.map((candidate) => createMockEditingAdapter(candidate.config)),
    createVscodeEditingEvaluationAdapter(registry),
  ];
}
