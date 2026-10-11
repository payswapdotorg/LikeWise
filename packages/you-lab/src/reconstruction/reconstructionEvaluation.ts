// Reconstruction candidate profiles + evaluation criteria (W3C).
//
// Derives structured evaluation criteria for the researched reconstruction
// technology candidates as a deterministic function of the technology
// registry:
// - method family + domain coverage (authored assessment tables);
// - determinism (engineering assessment — never a verified claim);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - runtime class (authored assessment table);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// Production eligibility is DERIVED from registry facts (permissive SPDX +
// maintenance recency), never hand-asserted. This is a PAPER evaluation for
// candidate shortlisting; the benchmark harness separately scores
// deterministic simulated adapters. Neither implies anything measured about
// the real technologies. Real runtime integration is W4+ compute-plane work.

import { daysBetweenIso, sortedUnique } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { NeutralHtirDomain, NeutralReconstructionMethod, ReconstructionRuntimeClass } from "./reconstructionAdapterSeam.js";

const DERIVATION_TABLE = "you-lab reconstruction-candidate table/1 (engineering assessment)";

/** Research candidates (registry-backed; the W2C smplx profile is reused for SMPL/SMPL-X). */
export const RECONSTRUCTION_CANDIDATE_IDS = [
  "animatablenerf",
  "colmap",
  "econ",
  "gaussian-splatting",
  "gaussianavatars",
  "icon",
  "instantavatar",
  "open3d",
  "openmvs",
  "pifu",
  "pifuhd",
  "smplx",
] as const;

/** Authored primary method per technology id (assessment, not external claim). */
const RECON_METHOD: Readonly<Record<string, NeutralReconstructionMethod>> = {
  colmap: "explicit-geometry",
  openmvs: "explicit-geometry",
  open3d: "explicit-geometry",
  smplx: "explicit-geometry",
  pifu: "hybrid",
  pifuhd: "hybrid",
  icon: "hybrid",
  econ: "hybrid",
  "gaussian-splatting": "hybrid",
  gaussianavatars: "hybrid",
  instantavatar: "hybrid",
  animatablenerf: "neural-appearance",
};

const ALL_BENCHMARK_DOMAINS: readonly NeutralHtirDomain[] = [
  "appearance-materials",
  "articulation-blendshapes",
  "face-hands",
  "geometry-skeleton",
  "hair",
  "identity-binding",
  "morphology",
  "motion-profile",
  "neural-appearance",
  "style",
];

/** Authored domain coverage per technology id (assessment). */
const DOMAIN_COVERAGE: Readonly<Record<string, readonly NeutralHtirDomain[]>> = {
  colmap: ["appearance-materials", "face-hands", "geometry-skeleton", "identity-binding", "morphology", "motion-profile"],
  openmvs: ["appearance-materials", "geometry-skeleton", "identity-binding", "morphology", "motion-profile"],
  open3d: ["geometry-skeleton", "identity-binding", "morphology", "motion-profile"],
  smplx: ["articulation-blendshapes", "face-hands", "geometry-skeleton", "identity-binding", "morphology", "motion-profile"],
  pifu: ["appearance-materials", "face-hands", "geometry-skeleton", "identity-binding", "morphology"],
  pifuhd: ["appearance-materials", "face-hands", "geometry-skeleton", "identity-binding", "morphology"],
  icon: ["articulation-blendshapes", "face-hands", "geometry-skeleton", "identity-binding", "morphology"],
  econ: ["appearance-materials", "articulation-blendshapes", "face-hands", "geometry-skeleton", "identity-binding", "morphology"],
  "gaussian-splatting": ["appearance-materials", "geometry-skeleton", "identity-binding", "morphology", "neural-appearance", "style"],
  gaussianavatars: ["appearance-materials", "articulation-blendshapes", "face-hands", "geometry-skeleton", "identity-binding", "morphology", "neural-appearance"],
  instantavatar: ["appearance-materials", "articulation-blendshapes", "geometry-skeleton", "identity-binding", "morphology", "motion-profile", "neural-appearance"],
  animatablenerf: ["appearance-materials", "identity-binding", "morphology", "motion-profile", "neural-appearance", "style"],
};

/** Authored runtime class per technology id (assessment). */
const RUNTIME_CLASS: Readonly<Record<string, ReconstructionRuntimeClass>> = {
  colmap: "local-gpu",
  openmvs: "local-gpu",
  open3d: "local-cpu",
  smplx: "local-cpu",
  pifu: "local-gpu",
  pifuhd: "local-gpu",
  icon: "local-gpu",
  econ: "local-gpu",
  "gaussian-splatting": "local-gpu",
  gaussianavatars: "local-gpu",
  instantavatar: "local-gpu",
  animatablenerf: "local-gpu",
};

/**
 * Determinism assessment per technology id. Real neural/GPU inference is NOT
 * bit-deterministic in general; adapters YOU ship around them must restore
 * determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, { deterministic: boolean; basis: string }>> = {
  colmap: { deterministic: false, basis: "multi-threaded RANSAC/SfM pipelines are not guaranteed bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  openmvs: { deterministic: false, basis: "multi-threaded GPU/CPU refinement is not guaranteed bit-reproducible; deterministic only in fixture (mock) mode" },
  open3d: { deterministic: true, basis: "CPU float arithmetic in single-threaded sections given fixed inputs (assessment; not verified by execution during W3C)" },
  smplx: { deterministic: true, basis: "deterministic linear-blend-skinning math on CPU given fixed inputs (assessment; not verified by execution)" },
  pifu: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  pifuhd: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  icon: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  econ: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  "gaussian-splatting": { deterministic: false, basis: "CUDA optimization loops are not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  gaussianavatars: { deterministic: false, basis: "CUDA optimization loops are not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  instantavatar: { deterministic: false, basis: "CUDA fast-optimization loops are not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
  animatablenerf: { deterministic: false, basis: "GPU float inference/optimization is not bit-reproducible across runs/devices; deterministic only in fixture (mock) mode" },
};

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

export interface ReconstructionEvaluationCriteria {
  readonly method: NeutralReconstructionMethod;
  readonly domainCoverage: readonly { readonly domain: NeutralHtirDomain; readonly covered: boolean }[];
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
  readonly runtimeClass: ReconstructionRuntimeClass;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface ReconstructionCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly evaluation: ReconstructionEvaluationCriteria;
  readonly derivedFrom: string;
}

export function deriveReconstructionCandidateProfiles(
  registry: TechnologyRegistry,
): readonly ReconstructionCandidateProfile[] {
  const profiles: ReconstructionCandidateProfile[] = [];
  for (const technology of registry.profiles) {
    if (!RECONSTRUCTION_CANDIDATE_IDS.includes(technology.id as (typeof RECONSTRUCTION_CANDIDATE_IDS)[number])) {
      continue; // not a reconstruction candidate
    }
    const covered = new Set(DOMAIN_COVERAGE[technology.id] ?? []);
    const determinism = DETERMINISM[technology.id];
    const runtimeClass = RUNTIME_CLASS[technology.id];
    const method = RECON_METHOD[technology.id];
    if (!determinism || !runtimeClass || !method) continue;
    profiles.push({
      technologyId: technology.id,
      name: technology.name,
      evaluation: {
        method,
        domainCoverage: ALL_BENCHMARK_DOMAINS.map((domain) => ({ domain, covered: covered.has(domain) })),
        determinism: { ...determinism, assessmentBasis: "engineering-assessment" },
        licensing: {
          spdxId: technology.license.spdxId,
          productionFriendly: technology.license.spdxId !== null && PRODUCTION_FRIENDLY_SPDX.has(technology.license.spdxId),
          sourceUrl: technology.license.sourceUrl,
          note: technology.license.note,
        },
        runtimeClass,
        effort: notMeasured(),
        latency: notMeasured(),
        cost: notMeasured(),
      },
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/** Candidate ids for a method family (sorted) — registry-backed shortlist helper. */
export function reconstructionCandidateIdsForMethod(
  profiles: readonly ReconstructionCandidateProfile[],
  method: NeutralReconstructionMethod,
): readonly string[] {
  return sortedUnique(profiles.filter((profile) => profile.evaluation.method === method).map((profile) => profile.technologyId));
}

// ---------------------------------------------------------------------------
// Production eligibility (registry-derived; never hand-asserted)
// ---------------------------------------------------------------------------

export interface ProductionEligibilityAssessment {
  readonly technologyId: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic). */
  readonly maintenanceAgeDays: number;
  readonly coveredDomainCount: number;
  /** Honest basis: cites the license + maintenance facts and the W4+ deferral. */
  readonly basis: string;
}

export interface EligibilityOptions {
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

/** Registry date for age arithmetic (the W3C research-seeding date of the reconstruction profiles). */
export const RECONSTRUCTION_RESEARCH_DATE = "2026-10-11";

export function assessProductionEligibility(
  profiles: readonly ReconstructionCandidateProfile[],
  registry: TechnologyRegistry,
  options?: EligibilityOptions,
): readonly ProductionEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? 365;
  const assessments: ProductionEligibilityAssessment[] = [];
  for (const profile of profiles) {
    const latest = latestMaintenanceDate(registry, profile.technologyId);
    const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, RECONSTRUCTION_RESEARCH_DATE);
    const licenseOk = profile.evaluation.licensing.productionFriendly;
    const maintained = ageDays <= maxAge;
    const eligible = licenseOk && maintained;
    const covered = profile.evaluation.domainCoverage.filter((entry) => entry.covered).length;
    const basis = eligible
      ? `license ${profile.evaluation.licensing.spdxId} (verified: ${profile.evaluation.licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${RECONSTRUCTION_RESEARCH_DATE} research date; eligible as a profile-backed evaluation adapter — real runtime integration is W4+ compute-plane work and nothing here measures the real tool`
      : licenseOk
        ? `license ${profile.evaluation.licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
        : `license ${profile.evaluation.licensing.spdxId ?? "(custom/non-SPDX)"} is not in the permissive SPDX set — production use blocked without legal review`;
    assessments.push({
      technologyId: profile.technologyId,
      eligible,
      maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
      coveredDomainCount: covered,
      basis,
    });
  }
  return assessments.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible assessments: maintenance recency first, then covered
 * domain count, then id (total order, deterministic).
 */
export function rankProductionEligible(
  assessments: readonly ProductionEligibilityAssessment[],
): readonly ProductionEligibilityAssessment[] {
  return [...assessments]
    .filter((entry) => entry.eligible)
    .sort((a, b) => {
      if (a.maintenanceAgeDays !== b.maintenanceAgeDays) return a.maintenanceAgeDays - b.maintenanceAgeDays;
      if (a.coveredDomainCount !== b.coveredDomainCount) return b.coveredDomainCount - a.coveredDomainCount;
      return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
    });
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
