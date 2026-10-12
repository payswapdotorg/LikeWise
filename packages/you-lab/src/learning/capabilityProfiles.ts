// Learning capability profiles derivation (W6C).
//
// Derives the learner capability records as a deterministic function of the
// technology registry: learner class comes from a fixed id-to-class table
// (the W6C taxonomy authored input, mirroring docs/you/WORK_ORDERS.md W6C),
// input signal kinds from a fixed tag-to-signal-kinds table, output classes
// from a fixed tag-to-usage-class table, supported scopes from a fixed
// id-to-scopes table and the notes from a fixed id-to-assessment table
// (authored engineering assessments — never a runtime authority, never a
// verified external claim). Registry technologies outside the authored
// learner table derive NO capability profile (the W5C gating pattern — the
// table, not the profile shape, decides participation).

import { sortedUnique } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type {
  LearningCapabilityProfile,
  NeutralLearnerClass,
  NeutralLearningRightUsage,
  NeutralLearningScope,
  NeutralLearningSignalKind,
} from "./learningAdapterSeam.js";

const DERIVATION_TABLE = "you-lab learning-capability table/1 (engineering assessment)";

/** W6C learner-class taxonomy per technology id (authored input — the order's classes; missing id => no profile). */
const LEARNER_CLASS: Readonly<Record<string, NeutralLearnerClass>> = {
  // organization-improvement methods
  wittgenstein: "rule-induction",
  mord: "preference-learning",
  mabwiser: "bandit-selection",
  "vowpal-wabbit": "bandit-selection",
  // tool/editor-selection learners
  lightgbm: "contextual-ranking",
  xgboost: "contextual-ranking",
  smac: "cost-aware-selection",
  // pipeline-improvement methods
  prose: "program-synthesis",
  pm4py: "workflow-mining",
};

/** Authored tag -> ingested learning signal kinds (deterministic derivation). */
const TAG_SIGNAL_KINDS: Readonly<Record<string, readonly NeutralLearningSignalKind[]>> = {
  "takeover-outcomes": ["manual-takeover", "expert-intervention", "feedback"],
  "preference-feedback": ["feedback", "edit-session", "repeated-intent"],
  "reward-streams": ["manual-takeover", "repeated-intent", "feedback"],
  "context-features": ["manual-takeover", "edit-session", "feedback", "repeated-intent"],
  "cost-observations": ["manual-takeover", "capability-gap", "feedback"],
  "demonstration-streams": ["manual-takeover", "edit-session", "repeated-intent"],
  "event-log-streams": ["edit-session", "manual-takeover", "repeated-intent"],
};

/** Authored tag -> produced learning output classes (frozen v6 LearningRightUsage vocabulary). */
const TAG_OUTPUT_CLASSES: Readonly<Record<string, readonly NeutralLearningRightUsage[]>> = {
  "organization-rules": ["organization-improvement", "capability-gap-analysis"],
  "preference-models": ["personalization", "editor-selection"],
  "selection-policies": ["tool-selection", "editor-selection"],
  "ranked-shortlists": ["tool-selection", "editor-selection"],
  "cost-aware-configurations": ["pipeline-improvement", "organization-improvement"],
  "synthesized-programs": ["pipeline-improvement", "organization-improvement"],
  "mined-workflows": ["pipeline-improvement", "organization-improvement", "capability-gap-analysis"],
  "online-personalization": ["personalization", "organization-improvement"],
};

/** Authored supported-scope assessment per technology id (deterministic). */
const LEARNER_SCOPES: Readonly<Record<string, readonly NeutralLearningScope[]>> = {
  wittgenstein: ["APPLICATION", "PROJECT", "TENANT", "USER"],
  mord: ["PROJECT", "TENANT", "USER"],
  mabwiser: ["GLOBAL", "TENANT", "APPLICATION", "PROJECT", "USER"],
  "vowpal-wabbit": ["GLOBAL", "TENANT", "APPLICATION", "PROJECT", "USER", "TASK"],
  lightgbm: ["TENANT", "APPLICATION", "PROJECT", "USER"],
  xgboost: ["GLOBAL", "TENANT", "APPLICATION", "PROJECT", "USER"],
  smac: ["APPLICATION", "PROJECT", "TASK"],
  prose: ["APPLICATION", "PROJECT", "TASK"],
  pm4py: ["GLOBAL", "TENANT", "APPLICATION", "PROJECT"],
};

/** Authored capability note per technology id (engineering assessment with rationale). */
const LEARNER_NOTES: Readonly<Record<string, string>> = {
  wittgenstein: "RIPPER-class interpretable rule induction: labeled takeover outcomes become ordered IF-THEN rules with precision/recall semantics — auditable organization rules (W6C rule-induction class).",
  mord: "Ordinal-regression preference learning: graded feedback/edit-session signals fit monotone preference models for editor defaults and personalization weights (W6C preference-learning class).",
  mabwiser: "Contextual multi-armed bandit selection: takeover rewards over tool/editor arms learn greedy/thompson/ucb selection policies (W6C bandit/selection class).",
  "vowpal-wabbit": "Online learning with contextual-bandit reductions: streaming takeover/intent signals learn selection policies and personalization weights incrementally (W6C bandit/selection class).",
  lightgbm: "Gradient-boosted learning-to-rank: context features from takeover/edit sessions produce ranked tool/editor shortlists via the ranking objectives (W6C contextual-ranking class).",
  xgboost: "Gradient-boosted ranking objectives (rank:ndcg/rank:pairwise): takeover-context features produce ranked selection shortlists and policies (W6C contextual-ranking class).",
  smac: "Cost-aware Bayesian configuration: observed takeover costs and capability gaps drive cost-aware pipeline/organization configuration (W6C cost-aware-selection class).",
  prose: "Programming-by-example synthesis: takeover demonstrations synthesize pipeline programs and transformation steps (W6C program-synthesis class).",
  pm4py: "Process mining over event logs: edit-session/repeated-intent event streams mine workflow models for pipeline improvement (W6C workflow-mining class).",
};

export function deriveLearningCapabilityProfiles(registry: TechnologyRegistry): readonly LearningCapabilityProfile[] {
  const profiles: LearningCapabilityProfile[] = [];
  for (const technology of registry.profiles) {
    const learnerClass = LEARNER_CLASS[technology.id];
    if (!learnerClass) continue; // registry technology outside the W6C learner taxonomy — no capability profile
    const kinds = sortedUnique(
      technology.capabilityTags.flatMap((tag) => TAG_SIGNAL_KINDS[tag] ?? []),
    ) as readonly NeutralLearningSignalKind[];
    const outputClasses = sortedUnique(
      technology.capabilityTags.flatMap((tag) => TAG_OUTPUT_CLASSES[tag] ?? []),
    ) as readonly NeutralLearningRightUsage[];
    const scopes = sortedUnique(LEARNER_SCOPES[technology.id] ?? []) as readonly NeutralLearningScope[];
    profiles.push({
      id: technology.id,
      learnerClass,
      displayName: technology.name,
      inputSignalKinds: kinds,
      supportedScopes: scopes,
      outputClasses,
      notes:
        LEARNER_NOTES[technology.id] ??
        "Unknown learner integration — conservative capability record until benchmarked.",
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Capability profile lookup by technology id (null when not derived). */
export function learningCapabilityById(
  profiles: readonly LearningCapabilityProfile[],
  technologyId: string,
): LearningCapabilityProfile | null {
  return profiles.find((profile) => profile.id === technologyId) ?? null;
}
