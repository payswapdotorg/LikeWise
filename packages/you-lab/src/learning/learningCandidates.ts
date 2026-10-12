// Standard deterministic learning benchmark candidates (W6C).
//
// The candidate set scored by the learning benchmark harness: six simulated
// mock adapters across the order's three candidate classes
// (organization-improvement: org precise/coarse; tool/editor-selection:
// selection balanced/lossy; pipeline-improvement: pipeline faithful/lossy)
// plus the Vowpal Wabbit-class profile-backed evaluation adapter. The mock
// configurations are PURE MOCKS (technologyId: null) — their parameters are
// fixture inputs exercising the seam, NOT assessments of any real learning
// technology. The evaluation adapter's eligibility is registry-derived and
// its execution is an explicit simulation (nothing measured).

import type { LearningAdapter } from "./learningAdapterSeam.js";
import { createMockLearningAdapter, type MockLearningConfig } from "./mockLearningAdapter.js";
import { createVowpalWabbitLearningEvaluationAdapter } from "./vowpalWabbitEvaluationAdapter.js";
import type { TechnologyRegistry } from "../technology/registry.js";

export interface LearningCandidateSpec {
  readonly candidateId: string;
  readonly description: string;
  readonly config: MockLearningConfig;
}

export const MOCK_LEARNING_CANDIDATES: readonly LearningCandidateSpec[] = [
  {
    candidateId: "mock-learning-org-precise",
    description: "exact-recovery rule-induction simulation — full evidence ingestion, no drift, domains preserved",
    config: {
      id: "mock-learning-org-precise",
      learnerClass: "rule-induction",
      supportedSignalKinds: ["expert-intervention", "feedback", "manual-takeover"],
      supportedScopes: ["APPLICATION", "PROJECT", "TENANT", "USER"],
      evidenceIngestRate: 1,
      valueDrift: 0,
      preservesDomains: true,
    },
  },
  {
    candidateId: "mock-learning-org-coarse",
    description: "coarse preference-learning simulation — moderate seeded evidence dropout and value drift",
    config: {
      id: "mock-learning-org-coarse",
      learnerClass: "preference-learning",
      supportedSignalKinds: ["edit-session", "feedback", "manual-takeover", "repeated-intent"],
      supportedScopes: ["APPLICATION", "PROJECT", "TENANT", "USER"],
      evidenceIngestRate: 0.75,
      valueDrift: 0.1,
      preservesDomains: true,
    },
  },
  {
    candidateId: "mock-learning-selection-balanced",
    description: "balanced bandit-selection simulation — small seeded dropout and drift",
    config: {
      id: "mock-learning-selection-balanced",
      learnerClass: "bandit-selection",
      supportedSignalKinds: ["edit-session", "feedback", "manual-takeover", "repeated-intent"],
      supportedScopes: ["GLOBAL", "APPLICATION", "PROJECT", "TASK", "TENANT", "USER"],
      evidenceIngestRate: 0.9,
      valueDrift: 0.05,
      preservesDomains: true,
    },
  },
  {
    candidateId: "mock-learning-selection-lossy",
    description: "lossy contextual-ranking simulation — seeded dropout, drift and domain folding",
    config: {
      id: "mock-learning-selection-lossy",
      learnerClass: "contextual-ranking",
      supportedSignalKinds: ["edit-session", "feedback", "manual-takeover", "repeated-intent"],
      supportedScopes: ["GLOBAL", "APPLICATION", "PROJECT", "TENANT", "USER"],
      evidenceIngestRate: 0.7,
      valueDrift: 0.08,
      preservesDomains: false,
    },
  },
  {
    candidateId: "mock-learning-pipeline-faithful",
    description: "faithful program-synthesis simulation — moderate seeded dropout",
    config: {
      id: "mock-learning-pipeline-faithful",
      learnerClass: "program-synthesis",
      supportedSignalKinds: ["edit-session", "manual-takeover", "repeated-intent"],
      supportedScopes: ["APPLICATION", "GLOBAL", "PROJECT", "TENANT", "USER"],
      evidenceIngestRate: 0.85,
      valueDrift: 0.05,
      preservesDomains: true,
    },
  },
  {
    candidateId: "mock-learning-pipeline-lossy",
    description: "lossy workflow-mining simulation — heavy seeded dropout, drift and domain folding",
    config: {
      id: "mock-learning-pipeline-lossy",
      learnerClass: "workflow-mining",
      supportedSignalKinds: ["capability-gap", "edit-session", "manual-takeover", "repeated-intent"],
      supportedScopes: ["APPLICATION", "GLOBAL", "PROJECT", "TENANT", "USER"],
      evidenceIngestRate: 0.6,
      valueDrift: 0.15,
      preservesDomains: false,
    },
  },
];

/** Build the standard candidate adapter set (deterministic construction). */
export function createStandardLearningCandidates(registry: TechnologyRegistry): readonly LearningAdapter[] {
  return [
    ...MOCK_LEARNING_CANDIDATES.map((candidate) => createMockLearningAdapter(candidate.config)),
    createVowpalWabbitLearningEvaluationAdapter(registry),
  ];
}
