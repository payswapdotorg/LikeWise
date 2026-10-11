// Render candidate profiles + evaluation criteria (W4C).
//
// Derives structured evaluation criteria for the researched render technology
// candidates as a deterministic function of the technology registry:
// - method family + output-kind coverage (authored assessment tables);
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
// the real technologies. Real runtime integration is W5+ compute-plane work.

import { daysBetweenIso, sortedUnique } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { NeutralRenderMethod, NeutralRenderOutputKind, RenderRuntimeClass } from "./renderAdapterSeam.js";

const DERIVATION_TABLE = "you-lab render-candidate table/1 (engineering assessment)";

/** Research candidates (registry-backed W4C render additions). */
export const RENDER_CANDIDATE_IDS = [
  "animatediff",
  "blender",
  "diffusers",
  "film",
  "gsplat",
  "gvhmr",
  "libigl",
  "mediapipe",
  "mmpose",
  "openpose",
  "rife",
  "rigify",
  "rokoko-studio",
  "three",
  "vibe",
] as const;

/** Authored primary method per technology id (assessment, not external claim). */
const RENDER_METHOD: Readonly<Record<string, NeutralRenderMethod>> = {
  gvhmr: "motion-extraction",
  mediapipe: "motion-extraction",
  mmpose: "motion-extraction",
  openpose: "motion-extraction",
  vibe: "motion-extraction",
  "rokoko-studio": "retargeting",
  rigify: "retargeting",
  libigl: "retargeting",
  diffusers: "image-render",
  animatediff: "video-render",
  rife: "video-render",
  film: "video-render",
  blender: "3d-render",
  three: "3d-render",
  gsplat: "3d-render",
};

const ALL_BENCHMARK_KINDS: readonly NeutralRenderOutputKind[] = ["animation", "image", "mesh", "video"];

/**
 * Authored output-kind coverage per technology id (assessment): which of the
 * four benchmark output kinds the technology's family can genuinely produce.
 */
const KIND_COVERAGE: Readonly<Record<string, readonly NeutralRenderOutputKind[]>> = {
  gvhmr: ["animation"],
  mediapipe: ["animation"],
  mmpose: ["animation"],
  openpose: ["animation"],
  vibe: ["animation"],
  "rokoko-studio": ["animation"],
  rigify: ["animation"],
  libigl: ["animation", "mesh"],
  diffusers: ["image"],
  animatediff: ["video"],
  rife: ["video"],
  film: ["video"],
  blender: ["animation", "image", "mesh", "video"],
  three: ["image", "mesh"],
  gsplat: ["image", "video"],
};

/** Authored runtime class per technology id (assessment). */
const RUNTIME_CLASS: Readonly<Record<string, RenderRuntimeClass>> = {
  gvhmr: "local-gpu",
  mediapipe: "browser-js",
  mmpose: "local-gpu",
  openpose: "local-gpu",
  vibe: "local-gpu",
  "rokoko-studio": "desktop-native",
  rigify: "desktop-native",
  libigl: "local-cpu",
  diffusers: "local-gpu",
  animatediff: "local-gpu",
  rife: "local-gpu",
  film: "local-gpu",
  blender: "desktop-native",
  three: "browser-js",
  gsplat: "local-gpu",
};

/**
 * Determinism assessment per technology id. Real GPU inference/rasterization
 * is NOT bit-deterministic in general; adapters YOU ship around them must
 * restore determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, { deterministic: boolean; basis: string }>> = {
  gvhmr: { deterministic: false, basis: "GPU float inference/optimization is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  mediapipe: { deterministic: false, basis: "floating-point inference with optional GPU delegates is not guaranteed bit-reproducible across devices; deterministic only in fixture (mock/evaluation-simulation) mode" },
  mmpose: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  openpose: { deterministic: false, basis: "C++/CUDA multi-person inference is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  vibe: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  "rokoko-studio": { deterministic: false, basis: "closed-source service; determinism not verifiable — deterministic only in fixture mode" },
  rigify: { deterministic: true, basis: "deterministic rigging math on CPU given fixed inputs (assessment; not verified by execution during W4C)" },
  libigl: { deterministic: true, basis: "CPU linear-algebra/optimization solvers on fixed inputs (assessment; not verified by execution during W4C)" },
  diffusers: { deterministic: false, basis: "GPU float inference with stochastic samplers is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  animatediff: { deterministic: false, basis: "GPU float inference with stochastic samplers is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  rife: { deterministic: false, basis: "GPU float inference (CUDA/MPS) is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  film: { deterministic: false, basis: "GPU float inference is not bit-reproducible across runs/devices; deterministic only in fixture mode" },
  blender: { deterministic: false, basis: "Cycles/Eevee rendering across GPU drivers is not guaranteed bit-reproducible; deterministic only in fixture mode" },
  three: { deterministic: false, basis: "WebGL rasterization output is GPU/driver-dependent (not guaranteed bit-identical across devices); deterministic only in fixture (evaluation-simulation) mode" },
  gsplat: { deterministic: false, basis: "CUDA rasterization/optimization is not bit-reproducible across GPU vendors; deterministic only in fixture mode" },
};

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as W3C).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

export interface RenderEvaluationCriteria {
  readonly method: NeutralRenderMethod;
  readonly kindCoverage: readonly { readonly kind: NeutralRenderOutputKind; readonly covered: boolean }[];
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
  readonly runtimeClass: RenderRuntimeClass;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface RenderCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly evaluation: RenderEvaluationCriteria;
  readonly derivedFrom: string;
}

export function deriveRenderCandidateProfiles(registry: TechnologyRegistry): readonly RenderCandidateProfile[] {
  const profiles: RenderCandidateProfile[] = [];
  for (const technology of registry.profiles) {
    if (!RENDER_CANDIDATE_IDS.includes(technology.id as (typeof RENDER_CANDIDATE_IDS)[number])) {
      continue; // not a render candidate
    }
    const covered = new Set(KIND_COVERAGE[technology.id] ?? []);
    const determinism = DETERMINISM[technology.id];
    const runtimeClass = RUNTIME_CLASS[technology.id];
    const method = RENDER_METHOD[technology.id];
    if (!determinism || !runtimeClass || !method) continue;
    profiles.push({
      technologyId: technology.id,
      name: technology.name,
      evaluation: {
        method,
        kindCoverage: ALL_BENCHMARK_KINDS.map((kind) => ({ kind, covered: covered.has(kind) })),
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
export function renderCandidateIdsForMethod(
  profiles: readonly RenderCandidateProfile[],
  method: NeutralRenderMethod,
): readonly string[] {
  return sortedUnique(profiles.filter((profile) => profile.evaluation.method === method).map((profile) => profile.technologyId));
}

// ---------------------------------------------------------------------------
// Production eligibility (registry-derived; never hand-asserted)
// ---------------------------------------------------------------------------

export interface RenderProductionEligibilityAssessment {
  readonly technologyId: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic). */
  readonly maintenanceAgeDays: number;
  readonly coveredKindCount: number;
  /** Honest basis: cites the license + maintenance facts and the W5+ deferral. */
  readonly basis: string;
}

export interface RenderEligibilityOptions {
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

/** Registry date for age arithmetic (the W4C research-seeding date of the render profiles). */
export const RENDER_RESEARCH_DATE = "2026-10-11";

export function assessRenderProductionEligibility(
  profiles: readonly RenderCandidateProfile[],
  registry: TechnologyRegistry,
  options?: RenderEligibilityOptions,
): readonly RenderProductionEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? 365;
  const assessments: RenderProductionEligibilityAssessment[] = [];
  for (const profile of profiles) {
    const latest = latestMaintenanceDate(registry, profile.technologyId);
    const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, RENDER_RESEARCH_DATE);
    const licenseOk = profile.evaluation.licensing.productionFriendly;
    const maintained = ageDays <= maxAge;
    const eligible = licenseOk && maintained;
    const covered = profile.evaluation.kindCoverage.filter((entry) => entry.covered).length;
    const basis = eligible
      ? `license ${profile.evaluation.licensing.spdxId} (verified: ${profile.evaluation.licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${RENDER_RESEARCH_DATE} research date; eligible as a profile-backed evaluation adapter — real runtime integration is W5+ compute-plane work and nothing here measures the real tool`
      : licenseOk
        ? `license ${profile.evaluation.licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
        : `license ${profile.evaluation.licensing.spdxId ?? "(custom/non-SPDX or unverified)"} is not in the permissive SPDX set — production use blocked without legal review`;
    assessments.push({
      technologyId: profile.technologyId,
      eligible,
      maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
      coveredKindCount: covered,
      basis,
    });
  }
  return assessments.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible assessments for the production-eligible evaluation
 * adapter: best license (eligible first), then freshest maintenance, then
 * broadest output-kind coverage, then id (deterministic total order).
 */
export function rankRenderProductionEligible(
  assessments: readonly RenderProductionEligibilityAssessment[],
): readonly RenderProductionEligibilityAssessment[] {
  return [...assessments].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const ageA = a.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : a.maintenanceAgeDays;
    const ageB = b.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : b.maintenanceAgeDays;
    if (ageA !== ageB) return ageA - ageB;
    if (a.coveredKindCount !== b.coveredKindCount) return b.coveredKindCount - a.coveredKindCount;
    return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
  });
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
