// Learning candidate profiles + evaluation criteria (W6C).
//
// Derives structured evaluation criteria for the researched learning
// technology candidates as a deterministic function of the technology
// registry:
// - learner class + signal-kind/scope/output-class coverage (authored
//   capability tables / the capability derivation — engineering
//   assessments, never verified external claims);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - determinism (engineering assessment — never a verified claim);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// Production eligibility is DERIVED from registry facts (permissive SPDX +
// maintenance recency), never hand-asserted. This is a PAPER evaluation for
// candidate shortlisting; the learning benchmark harness separately scores
// deterministic simulated adapters. Neither implies anything measured about
// the real technologies. Real runtime integration is W7+ compute-plane
// work.

import { daysBetweenIso } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import { deriveLearningCapabilityProfiles } from "./capabilityProfiles.js";
import type {
  LearningCapabilityProfile,
  NeutralLearnerClass,
  NeutralLearningRightUsage,
  NeutralLearningScope,
  NeutralLearningSignalKind,
} from "./learningAdapterSeam.js";

const DERIVATION_TABLE = "you-lab learning-candidate table/1 (engineering assessment)";

/** Registry date for age arithmetic (the W6C research-seeding date of the learning profiles). */
export const LEARNING_RESEARCH_DATE = "2026-10-12";

/**
 * Determinism assessment per technology id. The REAL learners are not
 * bit-deterministic systems themselves; adapters YOU ship around them must
 * restore determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, { deterministic: boolean; basis: string }>> = {
  wittgenstein: { deterministic: false, basis: "rule-set growth and pruning depend on data order and library version; deterministic only in fixture (evaluation-simulation) mode" },
  mord: { deterministic: false, basis: "solver paths and numeric convergence vary by build; deterministic only in fixture mode" },
  mabwiser: { deterministic: false, basis: "bandit exploration draws and parallel fit paths are seeded per-run in the library but not bit-stable across builds; deterministic only in fixture mode" },
  "vowpal-wabbit": { deterministic: false, basis: "online learning over streaming data with native-code reductions; not bit-reproducible across builds and platforms (engineering assessment); deterministic only in fixture mode" },
  lightgbm: { deterministic: false, basis: "histogram construction and multi-threaded boosting are not bit-stable across hardware; deterministic only in fixture mode" },
  xgboost: { deterministic: false, basis: "distributed/parallel gradient boosting reductions vary by build and hardware; deterministic only in fixture mode" },
  smac: { deterministic: false, basis: "Bayesian surrogate fitting and acquisition optimization vary by numeric library versions; deterministic only in fixture mode" },
  prose: { deterministic: false, basis: "program-synthesis search order depends on SDK version and witness data; deterministic only in fixture mode" },
  pm4py: { deterministic: false, basis: "mining algorithm outputs depend on library version and log ordering; deterministic only in fixture mode" },
};

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as W3C/W4C/W5C).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

export interface LearningEvaluationCriteria {
  readonly learnerClass: NeutralLearnerClass;
  readonly signalKindCoverage: readonly { readonly kind: NeutralLearningSignalKind; readonly covered: boolean }[];
  readonly scopeCoverage: readonly { readonly scope: NeutralLearningScope; readonly covered: boolean }[];
  readonly outputClassCoverage: readonly { readonly usage: NeutralLearningRightUsage; readonly covered: boolean }[];
  readonly determinism: {
    readonly deterministic: boolean;
    readonly basis: string;
    readonly assessmentBasis: "engineering-assessment";
  };
  readonly licensing: {
    readonly spdxId: string | null;
    readonly productionFriendly: boolean;
    readonly sourceUrl: string;
    readonly note: string;
  };
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface LearningCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly evaluation: LearningEvaluationCriteria;
  readonly derivedFrom: string;
}

const ALL_BENCHMARK_SIGNAL_KINDS: readonly NeutralLearningSignalKind[] = [
  "feedback",
  "manual-takeover",
  "edit-session",
  "expert-intervention",
  "repeated-intent",
  "capability-gap",
];

/** All eight frozen v1/v6 learning scopes (the scope-coverage matrix basis). */
export const LEARNING_EVALUATION_SCOPES: readonly NeutralLearningScope[] = [
  "GLOBAL",
  "TENANT",
  "APPLICATION",
  "PROJECT",
  "USER",
  "TWIN",
  "ASSET",
  "TASK",
];

/** All six frozen v6 sanctioned usage classes (the output-class coverage matrix basis). */
export const LEARNING_EVALUATION_USAGE_CLASSES: readonly NeutralLearningRightUsage[] = [
  "organization-improvement",
  "tool-selection",
  "editor-selection",
  "pipeline-improvement",
  "capability-gap-analysis",
  "personalization",
];

export function deriveLearningCandidateProfiles(
  registry: TechnologyRegistry,
  capabilities: readonly LearningCapabilityProfile[] = deriveLearningCapabilityProfiles(registry),
): readonly LearningCandidateProfile[] {
  const profiles: LearningCandidateProfile[] = [];
  for (const capability of capabilities) {
    const technology = registry.byId(capability.id);
    if (!technology) continue;
    const determinism = DETERMINISM[capability.id];
    if (!determinism) continue;
    const coveredKinds = new Set(capability.inputSignalKinds);
    const coveredScopes = new Set(capability.supportedScopes);
    const coveredClasses = new Set(capability.outputClasses);
    profiles.push({
      technologyId: capability.id,
      name: capability.displayName,
      evaluation: {
        learnerClass: capability.learnerClass,
        signalKindCoverage: ALL_BENCHMARK_SIGNAL_KINDS.map((kind) => ({ kind, covered: coveredKinds.has(kind) })),
        scopeCoverage: LEARNING_EVALUATION_SCOPES.map((scope) => ({ scope, covered: coveredScopes.has(scope) })),
        outputClassCoverage: LEARNING_EVALUATION_USAGE_CLASSES.map((usage) => ({ usage, covered: coveredClasses.has(usage) })),
        determinism: { ...determinism, assessmentBasis: "engineering-assessment" },
        licensing: {
          spdxId: technology.license.spdxId,
          productionFriendly:
            technology.license.spdxId !== null && PRODUCTION_FRIENDLY_SPDX.has(technology.license.spdxId),
          sourceUrl: technology.license.sourceUrl,
          note: technology.license.note,
        },
        effort: notMeasured(),
        latency: notMeasured(),
        cost: notMeasured(),
      },
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Production eligibility (registry-derived; never hand-asserted)
// ---------------------------------------------------------------------------

export interface LearningProductionEligibilityAssessment {
  readonly technologyId: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic). */
  readonly maintenanceAgeDays: number;
  readonly coveredOutputClassCount: number;
  /** Honest basis: cites the license + maintenance facts and the W7+ deferral. */
  readonly basis: string;
}

export interface LearningEligibilityOptions {
  /** Maximum age of the latest maintenance signal to count as maintained (default 365). */
  readonly maxMaintenanceAgeDays?: number;
}

/** Latest verified maintenance-signal date per technology (ISO date or null). */
function latestMaintenanceDate(registry: TechnologyRegistry, technologyId: string): string | null {
  const technology = registry.byId(technologyId);
  if (!technology) return null;
  let latest: string | null = null;
  for (const signal of technology.maintenance) {
    if (!signal.verified) continue;
    if (latest === null || signal.date > latest) latest = signal.date;
  }
  return latest;
}

export function assessLearningProductionEligibility(
  profiles: readonly LearningCandidateProfile[],
  registry: TechnologyRegistry,
  options?: LearningEligibilityOptions,
): readonly LearningProductionEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? 365;
  const assessments: LearningProductionEligibilityAssessment[] = [];
  for (const profile of profiles) {
    const latest = latestMaintenanceDate(registry, profile.technologyId);
    const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, LEARNING_RESEARCH_DATE);
    const licenseOk = profile.evaluation.licensing.productionFriendly;
    const maintained = ageDays <= maxAge;
    const eligible = licenseOk && maintained;
    const covered = profile.evaluation.outputClassCoverage.filter((entry) => entry.covered).length;
    const basis = eligible
      ? `license ${profile.evaluation.licensing.spdxId} (verified: ${profile.evaluation.licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${LEARNING_RESEARCH_DATE} research date; eligible as a profile-backed evaluation adapter — real runtime integration is W7+ compute-plane work and nothing here measures the real tool`
      : licenseOk
        ? `license ${profile.evaluation.licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
        : `license ${profile.evaluation.licensing.spdxId ?? "(custom/non-SPDX or unverified)"} is not in the permissive SPDX set — production use blocked without legal review`;
    assessments.push({
      technologyId: profile.technologyId,
      eligible,
      maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
      coveredOutputClassCount: covered,
      basis,
    });
  }
  return assessments.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible assessments for the production-eligible evaluation
 * adapter: best license/maintenance first (eligible, then freshest
 * maintenance), then broadest output-class coverage, then id
 * (deterministic total order — the W4C/W5C ranking precedent).
 */
export function rankLearningProductionEligible(
  assessments: readonly LearningProductionEligibilityAssessment[],
): readonly LearningProductionEligibilityAssessment[] {
  return [...assessments].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const ageA = a.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : a.maintenanceAgeDays;
    const ageB = b.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : b.maintenanceAgeDays;
    if (ageA !== ageB) return ageA - ageB;
    if (a.coveredOutputClassCount !== b.coveredOutputClassCount) return b.coveredOutputClassCount - a.coveredOutputClassCount;
    return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
  });
}

/** Candidate ids for a learner class (sorted) — registry-backed shortlist helper. */
export function learningCandidateIdsForClass(
  profiles: readonly LearningCandidateProfile[],
  learnerClass: NeutralLearnerClass,
): readonly string[] {
  return [...new Set(profiles.filter((profile) => profile.evaluation.learnerClass === learnerClass).map((profile) => profile.technologyId))].sort();
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
