// Arena retry/backoff + gap-detector candidate evaluation (W8C).
//
// Derives structured evaluation criteria for the researched W8C technology
// candidates as a deterministic function of the technology registry:
// - retry/backoff class coverage (authored capability tags
//   "backoff-class:<class>" — engineering assessments, never verified
//   external claims);
// - gap-detector category coverage (authored capability tags
//   "gap-category:<CATEGORY>" over the seven frozen v1 categories);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - determinism (engineering assessment — never a verified claim);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// Production eligibility is DERIVED from registry facts (permissive SPDX +
// maintenance recency), never hand-asserted. This is a PAPER evaluation for
// candidate shortlisting; the arena benchmark harness separately scores
// deterministic simulated adapters. Neither implies anything measured about
// the real technologies. Real runtime integration is W9+ compute-plane
// work.

import { daysBetweenIso } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { TechnologyProfile } from "../technology/registry.js";
import { NEUTRAL_BACKOFF_CLASSES, NEUTRAL_CAPABILITY_GAP_CATEGORIES, type NeutralArenaBackoffClass, type NeutralCapabilityGapCategory } from "./arenaAdapterSeam.js";

const DERIVATION_TABLE = "you-lab arena-candidate table/1 (engineering assessment)";

/** Registry date for age arithmetic (the W8C research-seeding date of the arena profiles). */
export const ARENA_RESEARCH_DATE = "2026-10-13";

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as
 * W3C/W4C/W5C/W6C/W7C).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

/** Default maintenance-recency gate for eligibility (days). */
export const DEFAULT_MAX_MAINTENANCE_AGE_DAYS = 365;

interface DeterminismAssessment {
  readonly deterministic: boolean;
  readonly basis: string;
}

/**
 * Determinism assessment per technology id. The REAL detectors/retry
 * libraries are not bit-deterministic systems themselves (live failure
 * timing, scheduling, network jitter); adapters YOU ship around them must
 * restore determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, DeterminismAssessment>> = {
  ajv: { deterministic: false, basis: "validation is a pure function of schema+instance in common use, but async/stream modes and version drift were not audited; deterministic only in fixture (evaluation-simulation) mode" },
  "editorconfig-checker": { deterministic: false, basis: "config conformance runs are stable for fixed inputs, but filesystem traversal and version drift were not audited; deterministic only in fixture mode" },
  "lm-evaluation-harness": { deterministic: false, basis: "model evaluation depends on stochastic sampling, live compute and harness version; deterministic only in fixture mode" },
  spacy: { deterministic: false, basis: "pipeline outputs are stable for fixed model versions, but model loading and version drift were not audited; deterministic only in fixture mode" },
  "rank-bm25": { deterministic: false, basis: "BM25 scoring is arithmetic over fixed corpora, but tokenizer/version drift was not audited; deterministic only in fixture mode" },
  pandera: { deterministic: false, basis: "validation is a pure function of dataframe+schema in common use, but execution engines and version drift were not audited; deterministic only in fixture mode" },
  "open-policy-agent": { deterministic: false, basis: "policy evaluation is deterministic for fixed inputs+version, but live service mode and version drift were not audited; deterministic only in fixture mode" },
  opossum: { deterministic: false, basis: "breaker state transitions depend on live call outcomes and timing windows; deterministic only in fixture mode" },
  "grpc-js": { deterministic: false, basis: "hedged/retry scheduling depends on live RPC outcomes and network timing; deterministic only in fixture mode" },
  "p-retry": { deterministic: false, basis: "retry delays depend on live failure timing; the delay ladder parameters are deterministic given attempts (engineering assessment); deterministic only in fixture mode" },
  bottleneck: { deterministic: false, basis: "rate scheduling depends on live request timing and reservoir state; deterministic only in fixture mode" },
};

export interface ArenaLicensingCriteria {
  readonly spdxId: string | null;
  readonly productionFriendly: boolean;
  readonly sourceUrl: string;
  readonly note: string;
}

export interface ArenaEvaluationCriteria {
  readonly determinism: {
    readonly deterministic: boolean;
    readonly basis: string;
    readonly assessmentBasis: "engineering-assessment";
  };
  readonly licensing: ArenaLicensingCriteria;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

export interface ArenaRetryCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly backoffClass: NeutralArenaBackoffClass;
  readonly evaluation: ArenaEvaluationCriteria;
  readonly derivedFrom: string;
}

export interface ArenaGapDetectorCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly category: NeutralCapabilityGapCategory;
  readonly evaluation: ArenaEvaluationCriteria;
  readonly derivedFrom: string;
}

function parseTagPrefix(profile: TechnologyProfile, prefix: string): string | null {
  for (const tag of profile.capabilityTags) {
    if (tag.startsWith(prefix)) return tag.slice(prefix.length);
  }
  return null;
}

function licensingOf(profile: TechnologyProfile): ArenaLicensingCriteria {
  return {
    spdxId: profile.license.spdxId,
    productionFriendly: profile.license.spdxId !== null && PRODUCTION_FRIENDLY_SPDX.has(profile.license.spdxId),
    sourceUrl: profile.license.sourceUrl,
    note: profile.license.note,
  };
}

function evaluationOf(profile: TechnologyProfile): ArenaEvaluationCriteria | null {
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

/** Derive the retry/backoff candidate profiles from registry capability tags (deterministic). */
export function deriveArenaRetryCandidateProfiles(
  registry: TechnologyRegistry,
): readonly ArenaRetryCandidateProfile[] {
  const profiles: ArenaRetryCandidateProfile[] = [];
  for (const technology of registry.profiles) {
    const backoffClass = parseTagPrefix(technology, "backoff-class:");
    if (backoffClass === null) continue;
    if (!NEUTRAL_BACKOFF_CLASSES.includes(backoffClass as (typeof NEUTRAL_BACKOFF_CLASSES)[number])) {
      throw new Error(`deriveArenaRetryCandidateProfiles: tag 'backoff-class:${backoffClass}' on '${technology.id}' is outside the four W8C authored classes (truth law — refusing to derive)`);
    }
    const evaluation = evaluationOf(technology);
    if (evaluation === null) continue;
    profiles.push({
      technologyId: technology.id,
      name: technology.name,
      backoffClass,
      evaluation,
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/** Derive the gap-detector candidate profiles from registry capability tags (deterministic). */
export function deriveArenaGapDetectorProfiles(
  registry: TechnologyRegistry,
): readonly ArenaGapDetectorCandidateProfile[] {
  const profiles: ArenaGapDetectorCandidateProfile[] = [];
  for (const technology of registry.profiles) {
    const category = parseTagPrefix(technology, "gap-category:");
    if (category === null) continue;
    if (!NEUTRAL_CAPABILITY_GAP_CATEGORIES.includes(category as (typeof NEUTRAL_CAPABILITY_GAP_CATEGORIES)[number])) {
      throw new Error(`deriveArenaGapDetectorProfiles: tag 'gap-category:${category}' on '${technology.id}' is outside the seven frozen v1 categories (truth law — refusing to derive)`);
    }
    const evaluation = evaluationOf(technology);
    if (evaluation === null) continue;
    profiles.push({
      technologyId: technology.id,
      name: technology.name,
      category,
      evaluation,
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Production eligibility (registry-derived; never hand-asserted)
// ---------------------------------------------------------------------------

export interface ArenaCandidateEligibilityAssessment {
  readonly technologyId: string;
  /** The derived candidate's class/category slot. */
  readonly slot: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic; -1 when unknown). */
  readonly maintenanceAgeDays: number;
  /** Honest basis: cites the license + maintenance facts and the W9+ deferral. */
  readonly basis: string;
}

export interface ArenaEligibilityOptions {
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
  licensing: ArenaLicensingCriteria,
  registry: TechnologyRegistry,
  maxAge: number,
): ArenaCandidateEligibilityAssessment {
  const latest = latestMaintenanceDate(registry, technologyId);
  const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, ARENA_RESEARCH_DATE);
  const licenseOk = licensing.productionFriendly;
  const maintained = ageDays <= maxAge;
  const eligible = licenseOk && maintained;
  const basis = eligible
    ? `license ${licensing.spdxId} (verified: ${licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${ARENA_RESEARCH_DATE} research date; eligible as a profile-backed evaluation candidate — real runtime integration is W9+ compute-plane work and nothing here measures the real tool`
    : licenseOk
      ? `license ${licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
      : `license ${licensing.spdxId ?? "(custom/non-SPDX)"} is not in the permissive SPDX set — production use blocked without legal review`;
  return {
    technologyId,
    slot,
    eligible,
    maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
    basis,
  };
}

/** Assess production eligibility of the derived retry/backoff candidates. */
export function assessArenaRetryProductionEligibility(
  profiles: readonly ArenaRetryCandidateProfile[],
  registry: TechnologyRegistry,
  options?: ArenaEligibilityOptions,
): readonly ArenaCandidateEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? DEFAULT_MAX_MAINTENANCE_AGE_DAYS;
  return profiles
    .map((profile) =>
      assessCandidate(profile.technologyId, `backoff-class:${profile.backoffClass}`, profile.evaluation.licensing, registry, maxAge),
    )
    .sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/** Assess production eligibility of the derived gap-detector candidates. */
export function assessArenaGapDetectorProductionEligibility(
  profiles: readonly ArenaGapDetectorCandidateProfile[],
  registry: TechnologyRegistry,
  options?: ArenaEligibilityOptions,
): readonly ArenaCandidateEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? DEFAULT_MAX_MAINTENANCE_AGE_DAYS;
  return profiles
    .map((profile) =>
      assessCandidate(profile.technologyId, `gap-category:${profile.category}`, profile.evaluation.licensing, registry, maxAge),
    )
    .sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible retry assessments for the production-eligible pick
 * behind the arena adapter seam: eligible first, then LADDER-FIT (the
 * exponential-backoff-jitter class — the frozen v8 ArenaRetryPolicy shape
 * is a bounded maxAttempts+backoffClass ladder, which that class models
 * most directly — an authored engineering preference), then freshest
 * maintenance, then id (deterministic total order — the W4C..W7C ranking
 * precedent).
 */
export function rankArenaRetryProductionEligible(
  assessments: readonly ArenaCandidateEligibilityAssessment[],
): readonly ArenaCandidateEligibilityAssessment[] {
  return [...assessments].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const fitA = a.slot === "backoff-class:exponential-backoff-jitter" ? 0 : 1;
    const fitB = b.slot === "backoff-class:exponential-backoff-jitter" ? 0 : 1;
    if (fitA !== fitB) return fitA - fitB;
    const ageA = a.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : a.maintenanceAgeDays;
    const ageB = b.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : b.maintenanceAgeDays;
    if (ageA !== ageB) return ageA - ageB;
    return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
  });
}

/** Candidate ids for a backoff class (sorted) — registry-backed shortlist helper. */
export function arenaRetryCandidateIdsForClass(
  profiles: readonly ArenaRetryCandidateProfile[],
  backoffClass: NeutralArenaBackoffClass,
): readonly string[] {
  return [...new Set(profiles.filter((profile) => profile.backoffClass === backoffClass).map((profile) => profile.technologyId))].sort();
}

/** One gap-category shortlist row: researched vs maintenance/license-eligible detector ids. */
export interface ArenaGapDetectorShortlistRow {
  readonly category: NeutralCapabilityGapCategory;
  readonly researched: readonly string[];
  readonly eligible: readonly string[];
}

/** Shortlist the gap detectors per frozen category (researched vs eligible; deterministic order). */
export function gapDetectorShortlistByCategory(
  profiles: readonly ArenaGapDetectorCandidateProfile[],
  assessments: readonly ArenaCandidateEligibilityAssessment[],
): readonly ArenaGapDetectorShortlistRow[] {
  const eligibleById = new Map(assessments.map((assessment) => [assessment.technologyId, assessment.eligible]));
  return NEUTRAL_CAPABILITY_GAP_CATEGORIES.map((category) => {
    const researched = profiles.filter((profile) => profile.category === category).map((profile) => profile.technologyId).sort();
    const eligible = researched.filter((technologyId) => eligibleById.get(technologyId) === true);
    return { category, researched, eligible };
  });
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
