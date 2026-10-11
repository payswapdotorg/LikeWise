// Editing candidate profiles + evaluation criteria (W5C).
//
// Derives structured evaluation criteria for the researched editor
// technology candidates as a deterministic function of the technology
// registry:
// - editor kind + format coverage + round-trip safety (authored assessment
//   tables / the capability derivation — engineering assessments, never
//   verified external claims);
// - licensing (registry-backed: the researched SPDX + source URL facts);
// - determinism (engineering assessment — never a verified claim);
// - effort / latency / cost: explicit "not-measured (simulated)" markers —
//   no measurement was performed and none is implied (truth law).
//
// Production eligibility is DERIVED from registry facts (permissive SPDX +
// maintenance recency), never hand-asserted. This is a PAPER evaluation for
// candidate shortlisting; the round-trip benchmark harness separately scores
// deterministic simulated adapters. Neither implies anything measured about
// the real technologies. Real runtime integration is W6+ compute-plane work.

import { daysBetweenIso } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  deriveEditingCapabilityProfiles,
} from "./capabilityProfiles.js";
import type { EditingCapabilityProfile } from "./editingAdapterSeam.js";
import type { NeutralEditorKind, NeutralImportExportFormat } from "./editingAdapterSeam.js";

const DERIVATION_TABLE = "you-lab editing-candidate table/1 (engineering assessment)";

/** Registry date for age arithmetic (the W5C research-seeding date of the editor profiles). */
export const EDITING_RESEARCH_DATE = "2026-10-11";

/**
 * Determinism assessment per technology id. The REAL editors are not
 * bit-deterministic surfaces themselves; adapters YOU ship around them must
 * restore determinism at the seam (fixture mode) or disclose it.
 */
const DETERMINISM: Readonly<Record<string, { deterministic: boolean; basis: string }>> = {
  "three-js": { deterministic: false, basis: "WebGL rasterization output is GPU/driver-dependent; deterministic only in fixture (native in-runtime editing) mode" },
  "react-three-fiber": { deterministic: false, basis: "WebGL rasterization output is GPU/driver-dependent; deterministic only in fixture mode" },
  vscode: { deterministic: false, basis: "desktop editor state, extensions and keymaps are user-configurable; deterministic only in fixture (evaluation-simulation) mode" },
  "monaco-editor": { deterministic: false, basis: "embedded editor state depends on host configuration and worker scheduling; deterministic only in fixture mode" },
  codemirror: { deterministic: false, basis: "embedded editor behavior depends on host-composed extensions; deterministic only in fixture mode" },
  prosemirror: { deterministic: false, basis: "document transforms are pure given fixed schemas, but plugin behavior is host-defined; deterministic only in fixture mode" },
  "svg-edit": { deterministic: false, basis: "browser editor state and extension surface; deterministic only in fixture mode" },
  excalidraw: { deterministic: false, basis: "browser canvas editor state; deterministic only in fixture mode" },
  openreel: { deterministic: false, basis: "browser/desktop video pipeline with encode variability; deterministic only in fixture mode" },
  blender: { deterministic: false, basis: "Cycles/Eevee rendering and operator state across GPU drivers is not guaranteed bit-reproducible; deterministic only in fixture mode" },
  godot: { deterministic: false, basis: "engine editor state and re-import pipelines vary by version/platform; deterministic only in fixture mode" },
  gimp: { deterministic: false, basis: "desktop application with user configuration and plugin filters; deterministic only in fixture mode" },
  krita: { deterministic: false, basis: "desktop application with user configuration and plugin brushes; deterministic only in fixture mode" },
  kdenlive: { deterministic: false, basis: "timeline render output depends on MLT encode paths; deterministic only in fixture mode" },
};

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as W3C/W4C).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

export interface EditingEvaluationCriteria {
  readonly editorKind: NeutralEditorKind;
  readonly kindCoverage: readonly { readonly kind: NeutralEditorKind; readonly covered: boolean }[];
  readonly formatCoverage: readonly { readonly format: string; readonly covered: boolean }[];
  readonly roundTripSafe: boolean;
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

export interface EditingCandidateProfile {
  readonly technologyId: string;
  readonly name: string;
  readonly evaluation: EditingEvaluationCriteria;
  readonly derivedFrom: string;
}

const ALL_BENCHMARK_KINDS: readonly NeutralEditorKind[] = ["native", "embedded", "external"];

/** All interchange formats the W5C seam maps (format-coverage matrix basis). */
export const EDITING_EVALUATION_FORMATS: readonly NeutralImportExportFormat[] = [
  "edit-interchange",
  "gltf",
  "glb",
  "jpeg",
  "json",
  "mp4",
  "png",
  "svg",
  "webm",
  "webp",
];

export function deriveEditingCandidateProfiles(
  registry: TechnologyRegistry,
  capabilities: readonly EditingCapabilityProfile[] = deriveEditingCapabilityProfiles(registry),
): readonly EditingCandidateProfile[] {
  const profiles: EditingCandidateProfile[] = [];
  for (const capability of capabilities) {
    const technology = registry.byId(capability.id);
    if (!technology) continue;
    const determinism = DETERMINISM[capability.id];
    if (!determinism) continue;
    const covered = new Set(capability.supportsFormats);
    profiles.push({
      technologyId: capability.id,
      name: capability.displayName,
      evaluation: {
        editorKind: capability.editorKind,
        kindCoverage: ALL_BENCHMARK_KINDS.map((kind) => ({ kind, covered: kind === capability.editorKind })),
        formatCoverage: EDITING_EVALUATION_FORMATS.map((format) => ({ format, covered: covered.has(format) })),
        roundTripSafe: capability.roundTripSafe,
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

export interface EditingProductionEligibilityAssessment {
  readonly technologyId: string;
  readonly eligible: boolean;
  /** Days between the latest verified maintenance signal and the research date (deterministic calendar arithmetic). */
  readonly maintenanceAgeDays: number;
  readonly coveredFormatCount: number;
  /** Honest basis: cites the license + maintenance facts and the W6+ deferral. */
  readonly basis: string;
}

export interface EditingEligibilityOptions {
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

export function assessEditingProductionEligibility(
  profiles: readonly EditingCandidateProfile[],
  registry: TechnologyRegistry,
  options?: EditingEligibilityOptions,
): readonly EditingProductionEligibilityAssessment[] {
  const maxAge = options?.maxMaintenanceAgeDays ?? 365;
  const assessments: EditingProductionEligibilityAssessment[] = [];
  for (const profile of profiles) {
    const latest = latestMaintenanceDate(registry, profile.technologyId);
    const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetweenIso(latest, EDITING_RESEARCH_DATE);
    const licenseOk = profile.evaluation.licensing.productionFriendly;
    const maintained = ageDays <= maxAge;
    const eligible = licenseOk && maintained;
    const covered = profile.evaluation.formatCoverage.filter((entry) => entry.covered).length;
    const basis = eligible
      ? `license ${profile.evaluation.licensing.spdxId} (verified: ${profile.evaluation.licensing.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${EDITING_RESEARCH_DATE} research date; eligible as a profile-backed evaluation adapter — real runtime integration is W6+ compute-plane work and nothing here measures the real tool`
      : licenseOk
        ? `license ${profile.evaluation.licensing.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
        : `license ${profile.evaluation.licensing.spdxId ?? "(custom/non-SPDX or unverified)"} is not in the permissive SPDX set — production use blocked without legal review`;
    assessments.push({
      technologyId: profile.technologyId,
      eligible,
      maintenanceAgeDays: Number.isFinite(ageDays) ? ageDays : -1,
      coveredFormatCount: covered,
      basis,
    });
  }
  return assessments.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

/**
 * Rank the eligible assessments for the production-eligible evaluation
 * adapter: best license/maintenance first (eligible, then freshest
 * maintenance), then broadest format coverage, then id (deterministic
 * total order — the W4C ranking precedent).
 */
export function rankEditingProductionEligible(
  assessments: readonly EditingProductionEligibilityAssessment[],
): readonly EditingProductionEligibilityAssessment[] {
  return [...assessments].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const ageA = a.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : a.maintenanceAgeDays;
    const ageB = b.maintenanceAgeDays < 0 ? Number.MAX_SAFE_INTEGER : b.maintenanceAgeDays;
    if (ageA !== ageB) return ageA - ageB;
    if (a.coveredFormatCount !== b.coveredFormatCount) return b.coveredFormatCount - a.coveredFormatCount;
    return a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0;
  });
}

/** Candidate ids for an editor kind (sorted) — registry-backed shortlist helper. */
export function editingCandidateIdsForKind(
  profiles: readonly EditingCandidateProfile[],
  kind: NeutralEditorKind,
): readonly string[] {
  return [...new Set(profiles.filter((profile) => profile.evaluation.editorKind === kind).map((profile) => profile.technologyId))].sort();
}

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}
