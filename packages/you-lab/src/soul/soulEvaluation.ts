// Soul/realtime candidate profiles + evaluation criteria (W7C).
//
// Derives structured evaluation criteria for the researched soul/realtime
// technology candidates as a deterministic function of the technology
// registry:
// - candidate class + modality/routing-profile/latency-class coverage
//   (authored capability tables / the capability derivation — engineering
//   assessments, never verified external claims);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - determinism (engineering assessment — never a verified claim);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// Production eligibility is DERIVED from registry facts (permissive SPDX +
// maintenance recency), never hand-asserted. This is a PAPER evaluation for
// candidate shortlisting; the soul benchmark harness separately scores
// deterministic simulated adapters. Neither implies anything measured about
// the real technologies. Real runtime integration is W8+ compute-plane
// work.

import { daysBetweenIso } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import { deriveSoulCapabilityProfiles, type SoulCapabilityProfile } from "./capabilityProfiles.js";
import type {
  NeutralLatencyClass,
  NeutralSoulClass,
  NeutralSoulModality,
  NeutralSoulRoutingProfile,
} from "./soulAdapterSeam.js";

const DERIVATION_TABLE = "you-lab soul-candidate table/1 (engineering assessment)";

/** Registry date for age arithmetic (the W7C research-seeding date of the soul/realtime profiles). */
export const SOUL_RESEARCH_DATE = "2026-10-12";

/**
 * Determinism assessment per technology id. The REAL providers/routers/
 * transports are not bit-deterministic systems themselves (GPU kernels,
 * scheduling, network jitter); adapters YOU ship around them must restore
 * determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, { deterministic: boolean; basis: string }>> = {
  vllm: { deterministic: false, basis: "batching/scheduling and GPU kernel reductions vary by load and hardware; deterministic only in fixture (evaluation-simulation) mode" },
  "text-generation-inference": { deterministic: false, basis: "continuous batching and tensor-parallel reductions vary by build and hardware; deterministic only in fixture mode" },
  "llama-cpp": { deterministic: false, basis: "sampling defaults are stochastic and GPU reductions vary by backend; the runtime offers seed pinning but is not bit-stable across builds; deterministic only in fixture mode" },
  ollama: { deterministic: false, basis: "sampling defaults are stochastic and scheduling varies by host; deterministic only in fixture mode" },
  "qwen3-vl": { deterministic: false, basis: "model sampling is stochastic unless seeded; serving determinism belongs to the serving stack; deterministic only in fixture mode" },
  "llama-3": { deterministic: false, basis: "model sampling is stochastic unless seeded; serving determinism belongs to the serving stack; deterministic only in fixture mode" },
  routellm: { deterministic: false, basis: "router thresholds and learned policies vary by training data and version; deterministic only in fixture mode" },
  eagle: { deterministic: false, basis: "draft-acceptance patterns vary by target model and hardware; deterministic only in fixture mode" },
  medusa: { deterministic: false, basis: "draft-acceptance patterns vary by target model and hardware; deterministic only in fixture mode" },
  livekit: { deterministic: false, basis: "network transport and SFU forwarding are inherently jittered; deterministic only in fixture mode" },
  mediasoup: { deterministic: false, basis: "network transport and SFU forwarding are inherently jittered; deterministic only in fixture mode" },
  "janus-gateway": { deterministic: false, basis: "network transport and SFU forwarding are inherently jittered; deterministic only in fixture mode" },
  "pion-webrtc": { deterministic: false, basis: "ICE/DTLS negotiation and network transport are inherently variable; deterministic only in fixture mode" },
  aiortc: { deterministic: false, basis: "ICE/DTLS negotiation and network transport are inherently variable; deterministic only in fixture mode" },
  whip: { deterministic: false, basis: "an HTTP signaling protocol over live WebRTC — transport behavior is inherently variable; deterministic only in fixture mode" },
};

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as
 * W3C/W4C/W5C/W6C). Note: ISC (mediasoup) is permissive in spirit but
 * outside this authored set — blocked pending a TL set addition, never
 * silently waved through.
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

export interface SoulEvaluationCriteria {
  readonly soulClass: NeutralSoulClass;
  readonly modalityCoverage: readonly { readonly modality: NeutralSoulModality; readonly covered: boolean }[];
  readonly routingProfileCoverage: readonly { readonly profile: NeutralSoulRoutingProfile; readonly covered: boolean }[];
  readonly latencyClassCoverage: readonly { readonly latencyClass: NeutralLatencyClass; readonly covered: boolean }[];
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

export interface SoulCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  /** Whether the technology can back a SoulBinding (the LLM/VLM provider classes). */
  readonly bindingCapable: boolean;
  readonly evaluation: SoulEvaluationCriteria;
  readonly derivedFrom: string;
}

/** All modalities in the W7C coverage matrix (the authored modality vocabulary). */
export const SOUL_EVALUATION_MODALITIES: readonly NeutralSoulModality[] = ["text", "image", "audio", "video", "data"];

/** Both frozen v7 routing profiles (the routing coverage matrix basis). */
export const SOUL_EVALUATION_ROUTING_PROFILES: readonly NeutralSoulRoutingProfile[] = ["system-one", "system-two"];

/** All latency classes in the W7C coverage matrix (the authored latency vocabulary). */
export const SOUL_EVALUATION_LATENCY_CLASSES: readonly NeutralLatencyClass[] = ["realtime", "interactive", "turn-based"];

export function deriveSoulCandidateProfiles(
  registry: TechnologyRegistry,
  capabilities: readonly SoulCapabilityProfile[] = deriveSoulCapabilityProfiles(registry),
): readonly SoulCandidateProfile[] {
  const profiles: SoulCandidateProfile[] = [];
  for (const capability of capabilities) {
    const technology = registry.byId(capability.id);
    if (!technology) continue;
    const determinism = DETERMINISM[capability.id];
    if (!determinism) continue;
    const coveredModalities = new Set(capability.modalities);
    const coveredProfiles = new Set(capability.routingProfiles);
    const coveredLatency = new Set(capability.latencyClasses);
    profiles.push({
      technologyId: capability.id,
      name: capability.displayName,
      bindingCapable: capability.bindingCapable,
      evaluation: {
        soulClass: capability.soulClass,
        modalityCoverage: SOUL_EVALUATION_MODALITIES.map((modality) => ({ modality, covered: coveredModalities.has(modality) })),
        routingProfileCoverage: SOUL_EVALUATION_ROUTING_PROFILES.map((profile) => ({ profile, covered: coveredProfiles.has(profile) })),
        latencyClassCoverage: SOUL_EVALUATION_LATENCY_CLASSES.map((latencyClass) => ({ latencyClass, covered: coveredLatency.has(latencyClass) })),
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

export interface SoulProductionEligibilityAssessment {
  readonly technologyId: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic; -1 when unknown). */
  readonly maintenanceAgeDays: number;
  readonly coveredRoutingProfileCount: number;
  /** Honest basis: cites the license + maintenance facts and the W8+ deferral. */
  readonly basis: string;
}

export interface SoulEligibilityOptions {
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

export function assessSoulProductionEligibility(
  profiles: readonly SoulCandidateProfile[],
  registry: TechnologyRegistry,
  options?: SoulEligibilityOptions,
): readonly SoulProductionEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? 365;
  const assessments: SoulProductionEligibilityAssessment[] = [];
  for (const profile of profiles) {
    const latest = latestMaintenanceDate(registry, profile.technologyId);
    const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, SOUL_RESEARCH_DATE);
    const licenseOk = profile.evaluation.licensing.productionFriendly;
    const maintained = ageDays <= maxAge;
    const eligible = licenseOk && maintained;
    const covered = profile.evaluation.routingProfileCoverage.filter((entry) => entry.covered).length;
    const basis = eligible
      ? `license ${profile.evaluation.licensing.spdxId} (verified: ${profile.evaluation.licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${SOUL_RESEARCH_DATE} research date; eligible as a profile-backed evaluation adapter — real runtime integration is W8+ compute-plane work and nothing here measures the real tool`
      : licenseOk
        ? `license ${profile.evaluation.licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
        : `license ${profile.evaluation.licensing.spdxId ?? "(custom/non-SPDX)"} is not in the permissive SPDX set — production use blocked without legal review`;
    assessments.push({
      technologyId: profile.technologyId,
      eligible,
      maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
      coveredRoutingProfileCount: covered,
      basis,
    });
  }
  return assessments.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible assessments for the production-eligible evaluation
 * adapter: best license/maintenance first (eligible, then freshest
 * maintenance), then broadest routing-profile coverage, then id
 * (deterministic total order — the W4C/W5C/W6C ranking precedent).
 */
export function rankSoulProductionEligible(
  assessments: readonly SoulProductionEligibilityAssessment[],
): readonly SoulProductionEligibilityAssessment[] {
  return [...assessments].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const ageA = a.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : a.maintenanceAgeDays;
    const ageB = b.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : b.maintenanceAgeDays;
    if (ageA !== ageB) return ageA - ageB;
    if (a.coveredRoutingProfileCount !== b.coveredRoutingProfileCount) return b.coveredRoutingProfileCount - a.coveredRoutingProfileCount;
    return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
  });
}

/** Candidate ids for a soul class (sorted) — registry-backed shortlist helper. */
export function soulCandidateIdsForClass(
  profiles: readonly SoulCandidateProfile[],
  soulClass: NeutralSoulClass,
): readonly string[] {
  return [...new Set(profiles.filter((profile) => profile.evaluation.soulClass === soulClass).map((profile) => profile.technologyId))].sort();
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
