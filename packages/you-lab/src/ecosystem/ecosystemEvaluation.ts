// Ecosystem candidate evaluation (W10C) — the registry-derived paper
// evaluation over the stage-10 research profiles.
//
// Derives structured evaluation criteria for the researched W10C ecosystem
// candidates as a deterministic function of the technology registry:
// - ecosystem-class coverage (authored capability tags
//   "ecosystem-class:<slot>" — the eight stage-10 classes);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - determinism (engineering assessment — never a verified claim);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// Production eligibility is DERIVED from registry facts (permissive SPDX +
// verified license + maintenance recency), never hand-asserted — the same
// law the ProviderMatrix derivation enforces (providerMatrixSeam.ts); this
// module exposes the assessment surface for ranking the production pick
// behind the AR evaluation adapter seam. This is a PAPER evaluation for
// candidate shortlisting; the ecosystem benchmark harness separately
// scores deterministic simulated adapters. Neither implies anything
// measured about the real technologies. Real runtime integration is
// post-W10 compute-plane work.

import { daysBetweenIso } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry, TechnologyProfile } from "../technology/registry.js";
import { ECOSYSTEM_RESEARCH_DATE, type EcosystemCapabilitySlot } from "./providerMatrixSeam.js";

const DERIVATION_TABLE = "you-lab ecosystem-candidate table/1 (engineering assessment)";

/** The researched W10C candidate technology ids (the evaluation roster). */
export const W10C_CANDIDATE_TECHNOLOGY_IDS = [
  "idm-vton", "ootdiffusion",
  "babylonjs", "playcanvas", "vrm-specification",
  "model-viewer", "arjs", "webxr-device-api",
  "jitsi-meet", "galene", "mozilla-hubs",
  "llamafile", "localai", "gpt4all", "jan",
  "diffusers", "ip-adapter", "safetensors", "sd-scripts", "comfyui",
  "deepseek-api", "zhipu-bigmodel", "moonshot-platform", "volcengine-doubao",
  "naver-ncloud", "upstage-solar", "sarvam-api",
] as const;

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as
 * W3C..W10C matrix derivation).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

/** Default maintenance-recency gate for eligibility (days). */
export const DEFAULT_MAX_MAINTENANCE_AGE_DAYS = 365;

interface DeterminismAssessment {
  readonly deterministic: boolean;
  readonly basis: string;
}

/**
 * Determinism assessment per technology id. The REAL engines/runtimes are
 * not bit-deterministic systems themselves (GPU scheduling, network
 * timing, live model inference); adapters YOU ship around them must
 * restore determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, DeterminismAssessment>> = {
  "idm-vton": { deterministic: false, basis: "diffusion sampling depends on live compute and stochastic sampling; deterministic only in fixture (evaluation-simulation) mode" },
  ootdiffusion: { deterministic: false, basis: "diffusion sampling depends on live compute and stochastic sampling; deterministic only in fixture mode" },
  babylonjs: { deterministic: false, basis: "engine scene serialization is stable for fixed scenes, but GPU timing and version drift were not audited; deterministic only in fixture mode" },
  playcanvas: { deterministic: false, basis: "engine serialization is stable for fixed scenes, but version drift was not audited; deterministic only in fixture mode" },
  "vrm-specification": { deterministic: true, basis: "a format specification document — parsing a fixed VRM document is pure arithmetic over fixed bytes (engineering assessment)" },
  "model-viewer": { deterministic: false, basis: "web component rendering depends on browser timing and AR runtime availability; deterministic only in fixture mode" },
  arjs: { deterministic: false, basis: "marker tracking depends on live camera frames; deterministic only in fixture mode" },
  "webxr-device-api": { deterministic: true, basis: "a W3C specification document — session semantics are normative text, not a runtime (engineering assessment)" },
  "jitsi-meet": { deterministic: false, basis: "conferencing depends on live network timing and RTP media; deterministic only in fixture mode" },
  galene: { deterministic: false, basis: "SFU packet forwarding depends on live network timing; deterministic only in fixture mode" },
  "mozilla-hubs": { deterministic: false, basis: "realtime rooms depend on live network timing and hosted infrastructure; deterministic only in fixture mode" },
  llamafile: { deterministic: false, basis: "model inference depends on stochastic sampling and local hardware; deterministic only in fixture mode" },
  localai: { deterministic: false, basis: "model inference depends on stochastic sampling; deterministic only in fixture mode" },
  gpt4all: { deterministic: false, basis: "model inference depends on stochastic sampling; deterministic only in fixture mode" },
  jan: { deterministic: false, basis: "model inference depends on stochastic sampling; deterministic only in fixture mode" },
  diffusers: { deterministic: false, basis: "diffusion sampling depends on stochastic schedulers and live compute; seeded generators restore per-run determinism but version drift was not audited; deterministic only in fixture mode" },
  "ip-adapter": { deterministic: false, basis: "adapter inference depends on stochastic sampling and live compute; deterministic only in fixture mode" },
  safetensors: { deterministic: true, basis: "tensor serialization/deserialization is pure arithmetic over fixed bytes (engineering assessment)" },
  "sd-scripts": { deterministic: false, basis: "training runs depend on stochastic sampling and live compute; deterministic only in fixture mode" },
  comfyui: { deterministic: false, basis: "workflow execution depends on stochastic sampling and live compute; deterministic only in fixture mode" },
  "deepseek-api": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service; deterministic only in fixture mode" },
  "zhipu-bigmodel": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service; deterministic only in fixture mode" },
  "moonshot-platform": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service; deterministic only in fixture mode" },
  "volcengine-doubao": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service; deterministic only in fixture mode" },
  "naver-ncloud": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service; deterministic only in fixture mode" },
  "upstage-solar": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service; deterministic only in fixture mode" },
  "sarvam-api": { deterministic: false, basis: "closed hosted API — inference depends on the provider's live service (portal unfetchable on the research date); deterministic only in fixture mode" },
};

export interface EcosystemLicensingCriteria {
  readonly spdxId: string | null;
  readonly productionFriendly: boolean;
  readonly sourceUrl: string;
  readonly note: string;
}

export interface EcosystemEvaluationCriteria {
  readonly determinism: {
    readonly deterministic: boolean;
    readonly basis: string;
    readonly assessmentBasis: "engineering-assessment";
  };
  readonly licensing: EcosystemLicensingCriteria;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface EcosystemCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  /** The stage-10 ecosystem class slot this candidate serves. */
  readonly ecosystemClass: EcosystemCapabilitySlot;
  readonly evaluation: EcosystemEvaluationCriteria;
  readonly derivedFrom: string;
}

function parseEcosystemClass(profile: TechnologyProfile): string | null {
  for (const tag of profile.capabilityTags) {
    if (tag.startsWith("ecosystem-class:")) return tag.slice("ecosystem-class:".length);
  }
  return null;
}

function licensingOf(profile: TechnologyProfile): EcosystemLicensingCriteria {
  return {
    spdxId: profile.license.spdxId,
    productionFriendly: profile.license.verified && profile.license.spdxId !== null && PRODUCTION_FRIENDLY_SPDX.has(profile.license.spdxId),
    sourceUrl: profile.license.sourceUrl,
    note: profile.license.note,
  };
}

function evaluationOf(profile: TechnologyProfile): EcosystemEvaluationCriteria | null {
  const determinism = DETERMINISM[profile.id];
  if (!determinism) {
    // The W7C soul precedent: the determinism table is the authored
    // allowlist — technologies without an assessment do not derive as
    // candidates (never a guessed assessment; the fail-closed adapter
    // catches a missing pick downstream).
    return null;
  }
  return {
    determinism: { ...determinism, assessmentBasis: "engineering-assessment" },
    licensing: licensingOf(profile),
    effort: notMeasured(),
    latency: notMeasured(),
    cost: notMeasured(),
  };
}

/**
 * Derive the stage-10 ecosystem candidate profiles from the W10C roster +
 * registry capability tags (deterministic). Fail-closed: a roster id
 * missing from the registry, or a candidate whose ecosystem-class tag is
 * outside the eight stage-10 classes, refuses the whole derivation (truth
 * law — never a silent drop).
 */
export function deriveEcosystemCandidateProfiles(
  registry: TechnologyRegistry,
): readonly EcosystemCandidateProfile[] {
  const profiles: EcosystemCandidateProfile[] = [];
  for (const technologyId of W10C_CANDIDATE_TECHNOLOGY_IDS) {
    const technology = registry.byId(technologyId);
    if (!technology) {
      throw new Error(`deriveEcosystemCandidateProfiles: roster technology '${technologyId}' missing from the registry (truth law — refusing to derive)`);
    }
    const ecosystemClass = parseEcosystemClass(technology);
    if (ecosystemClass === null) {
      throw new Error(`deriveEcosystemCandidateProfiles: technology '${technologyId}' carries no ecosystem-class tag (truth law — refusing to derive)`);
    }
    const evaluation = evaluationOf(technology);
    if (evaluation === null) continue;
    profiles.push({
      technologyId: technology.id,
      name: technology.name,
      ecosystemClass,
      evaluation,
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Production eligibility (registry-derived; never hand-asserted)
// ---------------------------------------------------------------------------

export interface EcosystemCandidateEligibilityAssessment {
  readonly technologyId: string;
  /** The derived candidate's ecosystem class slot. */
  readonly slot: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic; -1 when unknown). */
  readonly maintenanceAgeDays: number;
  /** Honest basis: cites the license + maintenance facts and the post-W10 deferral. */
  readonly basis: string;
}

export interface EcosystemEligibilityOptions {
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

function assessCandidate(
  technologyId: string,
  slot: string,
  licensing: EcosystemLicensingCriteria,
  registry: TechnologyRegistry,
  maxAge: number,
): EcosystemCandidateEligibilityAssessment {
  const latest = latestMaintenanceDate(registry, technologyId);
  const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, ECOSYSTEM_RESEARCH_DATE);
  const licenseOk = licensing.productionFriendly;
  const maintained = ageDays <= maxAge;
  const eligible = licenseOk && maintained;
  const basis = eligible
    ? `license ${licensing.spdxId} (verified: ${licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${ECOSYSTEM_RESEARCH_DATE} research date; eligible as a profile-backed evaluation candidate — real runtime integration is post-W10 compute-plane work and nothing here measures the real technology`
    : licenseOk
      ? `license ${licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
      : licensing.spdxId === null
        ? `license is ${licensing.note.includes("not reviewed") || licensing.note.includes("unverified") ? "unverified/pending review" : "a non-SPDX custom form"} (${licensing.spdxId ?? licensing.note}) — production use blocked (truth law)`
        : `license ${licensing.spdxId} is not in the permissive SPDX set — production use blocked without legal review`;
  return {
    technologyId,
    slot,
    eligible,
    maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
    basis,
  };
}

/** Assess production eligibility of the derived ecosystem candidates. */
export function assessEcosystemProductionEligibility(
  profiles: readonly EcosystemCandidateProfile[],
  registry: TechnologyRegistry,
  options?: EcosystemEligibilityOptions,
): readonly EcosystemCandidateEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? DEFAULT_MAX_MAINTENANCE_AGE_DAYS;
  return profiles
    .map((profile) =>
      assessCandidate(profile.technologyId, `ecosystem-class:${profile.ecosystemClass}`, profile.evaluation.licensing, registry, maxAge),
    )
    .sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible assessments for the production pick behind an
 * evaluation adapter seam: eligible first, then LANE-FIT (the slot the
 * adapter binds — e.g. the AR lane's model-viewer), then freshest
 * maintenance, then id (deterministic total order — the W4C..W8C ranking
 * precedent).
 */
export function rankEcosystemProductionEligible(
  assessments: readonly EcosystemCandidateEligibilityAssessment[],
  laneSlot: string,
): readonly EcosystemCandidateEligibilityAssessment[] {
  return [...assessments].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const fitA = a.slot === `ecosystem-class:${laneSlot}` ? 0 : 1;
    const fitB = b.slot === `ecosystem-class:${laneSlot}` ? 0 : 1;
    if (fitA !== fitB) return fitA - fitB;
    const ageA = a.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : a.maintenanceAgeDays;
    const ageB = b.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : b.maintenanceAgeDays;
    if (ageA !== ageB) return ageA - ageB;
    return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
  });
}

/** Candidate ids for an ecosystem class slot (sorted) — registry-backed shortlist helper. */
export function ecosystemCandidateIdsForSlot(
  profiles: readonly EcosystemCandidateProfile[],
  slot: EcosystemCapabilitySlot,
): readonly string[] {
  return [...new Set(profiles.filter((profile) => profile.ecosystemClass === slot).map((profile) => profile.technologyId))].sort();
}

/** One ecosystem-class shortlist row: researched vs license/maintenance-eligible candidate ids. */
export interface EcosystemClassShortlistRow {
  readonly slot: EcosystemCapabilitySlot;
  readonly researched: readonly string[];
  readonly eligible: readonly string[];
}

/** Shortlist the candidates per stage-10 ecosystem class (researched vs eligible; deterministic order). */
export function ecosystemShortlistBySlot(
  profiles: readonly EcosystemCandidateProfile[],
  assessments: readonly EcosystemCandidateEligibilityAssessment[],
): readonly EcosystemClassShortlistRow[] {
  const eligibleById = new Map(assessments.map((assessment) => [assessment.technologyId, assessment.eligible]));
  const slots = [...new Set(profiles.map((profile) => profile.ecosystemClass))].sort();
  return slots.map((slot) => {
    const researched = profiles.filter((profile) => profile.ecosystemClass === slot).map((profile) => profile.technologyId).sort();
    const eligible = researched.filter((technologyId) => eligibleById.get(technologyId) === true);
    return { slot, researched, eligible };
  });
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
