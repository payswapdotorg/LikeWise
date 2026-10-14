/* eslint-disable max-lines -- the provider-neutral ecosystem seam consolidates the authored vocabularies (regions/styles/exports/slots), the neutral v1:1 shapes (ProviderMatrixEntry / request / output / adapter), the registry-derived matrix, the integrity validator and the shared fail-closed gate BY DESIGN (mirroring the W8C arenaAdapterSeam consolidation: one seam module per adapter lane), so the per-file line budget is intentionally waived here. */
// Provider-neutral ecosystem adapter seam — the ProviderMatrix ecosystem
// gate (W10C).
//
// Every ecosystem addition (provider, region, style, export class) enters
// through the ProviderMatrix behind fail-closed adapters; unknown matrix
// refs are typed errors — the ECOSYSTEM GATE LAW (docs/you/CONTRACTS.md
// "Wave-10 contract freeze (v10)": YOU_PROVIDER_MATRIX_INVALID). The
// ProviderMatrixEntry registry DERIVES from the technology registry
// (registry authority: the W10C research lane) plus authored row specs
// (region / styles / exports / capability slots) — eligibility is
// registry-derived from license + maintenance facts, never hand-asserted
// (the W8C arenaEvaluation precedent). The neutral matrix shapes are owned
// by you-lab and are structurally aligned with the frozen v10
// ProviderMatrixEntry / CostLatencyBudget / ProductionEligibilityRecord
// shapes; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts.
//
// PRODUCTION ELIGIBILITY LAW (seam-level, fail-closed): a production-mode
// ecosystem request requires a latest eligible ProductionEligibilityRecord
// in the decision ledger for the resolved provider subject — eligibility
// requires rollback evidence and the ledger never mutates a decision (the
// eligibilityLedger module owns the record laws).
//
// BUDGET LAW (seam-level, fail-closed): cost and latency budgets enforce
// BEFORE the effect (the budgetGuard module owns the breaker-class
// vocabulary carried forward from W8C: circuit-breaker / hedged-request /
// exponential-backoff-jitter / token-bucket).
//
// Determinism: matrix ids, capability-class derivation, budget arithmetic
// and digest computations are pure functions of their inputs (no clock, no
// Math.random, no network — seeded derivations only, docs/you/FIXTURES.md).
// Effort/latency/cost are structured fields carrying explicit
// not-measured markers (truth law — never invented numbers). The matrix
// rows themselves are `simulated: true` research-backed fixture rows (the
// W10+ compute-plane boundary holds).

import { createHash } from "node:crypto";

import { canonicalJson, fnv1a32, roundTo, sortedUnique } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  NEUTRAL_BACKOFF_CLASSES,
  type NeutralArenaBackoffClass,
} from "../arena/arenaAdapterSeam.js";
import { enforceCostLatencyBudget, type NeutralCostLatencyBudget, type BudgetGuardDecision } from "./budgetGuardSeam.js";
export type { NeutralCostLatencyBudget, BudgetGuardDecision } from "./budgetGuardSeam.js";
import type { ProductionEligibilityLedger } from "./eligibilityLedger.js";

// ---------------------------------------------------------------------------
// The ecosystem gate vocabulary (authored W10C fixture definition)
// ---------------------------------------------------------------------------

/**
 * The authored region vocabulary of the ecosystem gate. Regions minted ONLY
 * for markets with a verified provider row this pass: global (the
 * open-source rows), cn, kr, in. TRUTH LAW: no jp region is minted — no
 * Japan-market provider could be verified during the 2026-10-14 research
 * pass (disclosed in technology/ecosystemSeedProfiles.ts).
 */
export const ECOSYSTEM_REGIONS = ["global", "cn", "kr", "in"] as const;
export type EcosystemRegion = (typeof ECOSYSTEM_REGIONS)[number] | (string & {});

/**
 * The authored style-class vocabulary of the ecosystem gate (the
 * "additional styles" plane). Style classes are fixture vocabulary backed
 * by the style-pipeline research (diffusers / sd-scripts / ip-adapter /
 * comfyui) — never a claim that any specific style model shipped.
 */
export const ECOSYSTEM_STYLE_CLASSES = [
  "photoreal", "anime-stylized", "illustrated", "sculptural", "voxel",
] as const;
export type EcosystemStyleClass = (typeof ECOSYSTEM_STYLE_CLASSES)[number] | (string & {});

/**
 * The authored export-class vocabulary of the ecosystem gate (the
 * game/VRM/GLB + AR export lanes).
 */
export const ECOSYSTEM_EXPORT_CLASSES = [
  "glb", "gltf", "vrm-1.0", "usdz-ar-quick-look", "webxr-ar-scene",
] as const;
export type EcosystemExportClass = (typeof ECOSYSTEM_EXPORT_CLASSES)[number] | (string & {});

/**
 * The authored capability-slot vocabulary of the ecosystem gate — the eight
 * stage-10 ecosystem classes every matrix row gates (1:1 with the
 * `ecosystem-class:<slot>` capability tags on the W10C research profiles).
 */
export const ECOSYSTEM_CAPABILITY_SLOTS = [
  "virtual-try-on", "game-export", "vrm-export", "ar",
  "realtime-telepresence", "customer-compute", "style-pipeline",
  "regional-provider",
] as const;
export type EcosystemCapabilitySlot = (typeof ECOSYSTEM_CAPABILITY_SLOTS)[number] | (string & {});

/** The capability-class prefixes the matrix rows derive (sorted union on entries). */
export const MATRIX_CLASS_PREFIXES = { style: "style:", export: "export:", slot: "slot:" } as const;

// ---------------------------------------------------------------------------
// Neutral shapes (structurally aligned with the frozen v10 contracts)
// ---------------------------------------------------------------------------

/**
 * Neutral provider-matrix entry — aligned 1:1 with the frozen v10
 * ProviderMatrixEntry (the ecosystem gate row). An immutable registry row:
 * a provider (by opaque providerKind ref) in a region serving capability
 * classes (styles / exports / slots) with registry-derived eligibility.
 */
export interface NeutralProviderMatrixEntry {
  readonly id: string;
  readonly providerKind: string;
  readonly region: EcosystemRegion;
  readonly capabilityClasses: readonly string[];
  readonly eligible: boolean;
  readonly simulated: boolean;
}

/** One authored matrix row spec (research-backed provider × region assignment). */
export interface ProviderMatrixRowSpec {
  /** Technology-registry id — must resolve in the registry (fail-closed). */
  readonly technologyId: string;
  readonly region: EcosystemRegion;
  readonly styleRefs: readonly EcosystemStyleClass[];
  readonly exportRefs: readonly EcosystemExportClass[];
  readonly slotRefs: readonly EcosystemCapabilitySlot[];
}

/** Typed ecosystem request through the gate = refs + budget + declared spend. */
export interface NeutralEcosystemRequest {
  readonly requestId: string;
  readonly providerKind: string;
  readonly region: EcosystemRegion;
  readonly styleRefs: readonly EcosystemStyleClass[];
  readonly exportRefs: readonly EcosystemExportClass[];
  readonly budget: NeutralCostLatencyBudget;
  /** Declared cost for this request in fixture budget units (>= 0, finite). */
  readonly declaredCostUnits: number;
  /** Declared latency for this request in fixture seconds (>= 0, finite). */
  readonly declaredLatencyS: number;
  /** Production-mode requests require a latest eligible ledger decision for the provider subject. */
  readonly productionMode: boolean;
  readonly submittedAt: string;
}

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface EcosystemEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

/**
 * The deterministic output of an ecosystem request through the gate —
 * content-addressed (the canonical JSON of the fulfillment payload map
 * hashes to resultContentHash).
 */
export interface NeutralEcosystemOutput {
  readonly adapterId: string;
  readonly requestId: string;
  /** The resolved matrix entry id (identity threading — adapters never mint matrix rows). */
  readonly matrixEntryId: string;
  /** The styles the adapter actually served (seed-derived fidelity). */
  readonly servedStyles: readonly string[];
  /** The export classes the adapter actually served (seed-derived fidelity). */
  readonly servedExports: readonly string[];
  /** The budget-guard decision appended for this request (immutable record). */
  readonly budgetDecision: BudgetGuardDecision;
  /**
   * Fulfillment payloads keyed by `${styleRef}|${exportRef}` — the
   * content-store sidecar the caller resolves; NEVER inlined in the
   * matrix rows themselves.
   */
  readonly payloads: Readonly<Record<string, Record<string, unknown>>>;
  /** Canonical-JSON digest over the fulfillment payload entries (deterministic). */
  readonly resultContentHash: string;
  readonly warnings: readonly string[];
  readonly effort: EcosystemEffortFields;
  readonly simulated: boolean;
}

/** Profile of a registered ecosystem adapter behind the seam. */
export interface EcosystemAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  /** Regions the adapter serves (validated against the request's region ref). */
  readonly servedRegions: readonly string[];
  /** Style classes the adapter serves. */
  readonly servedStyles: readonly string[];
  /** Export classes the adapter serves. */
  readonly servedExports: readonly string[];
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  readonly deterministic: boolean;
  readonly determinismNote: string;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
  readonly eligibilityBasis: string;
}

export interface EcosystemAdapter {
  readonly profile: EcosystemAdapterProfile;
  /** Typed ecosystem request through the gate (deterministic, simulated). */
  fulfill(request: NeutralEcosystemRequest, matrix: ProviderMatrixRegistry, ledger: ProductionEligibilityLedger): NeutralEcosystemOutput;
}

// ---------------------------------------------------------------------------
// Typed errors (fail-closed)
// ---------------------------------------------------------------------------

/** Error code aligned with the frozen v10 typed error literal (the ECOSYSTEM GATE LAW). */
export const PROVIDER_MATRIX_INVALID_CODE = "YOU_PROVIDER_MATRIX_INVALID";

/** Typed refusal thrown when any matrix ref or the gate law fails (fail-closed). */
export class ProviderMatrixInvalidError extends Error {
  readonly code = PROVIDER_MATRIX_INVALID_CODE;
  constructor(detail: string) {
    super(`${PROVIDER_MATRIX_INVALID_CODE}: ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Matrix derivation (registry authority; never hand-asserted eligibility)
// ---------------------------------------------------------------------------

/** Registry date for age arithmetic (the W10C research-seeding date). */
export const ECOSYSTEM_RESEARCH_DATE = "2026-10-14";

/**
 * SPDX ids considered production-friendly without bespoke legal review
 * (engineering assessment: the permissive set — same shortlist as
 * W3C..W8C).
 */
const PRODUCTION_FRIENDLY_SPDX = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]);

/** Default maintenance-recency gate for eligibility (days). */
export const DEFAULT_MAX_MAINTENANCE_AGE_DAYS = 365;

/** The authored matrix row specs (research-backed provider × region assignments). */
export const PROVIDER_MATRIX_ROW_SPECS: readonly ProviderMatrixRowSpec[] = [
  // --- game/VRM/GLB export lane (new W10C research + carried-forward registry rows) ---
  { technologyId: "babylonjs", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated"], exportRefs: ["glb", "gltf", "webxr-ar-scene"], slotRefs: ["game-export", "ar"] },
  { technologyId: "playcanvas", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated"], exportRefs: ["glb"], slotRefs: ["game-export"] },
  { technologyId: "godot", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated", "voxel"], exportRefs: ["glb", "gltf"], slotRefs: ["game-export"] },
  { technologyId: "vrm-specification", region: "global", styleRefs: ["anime-stylized", "photoreal"], exportRefs: ["vrm-1.0"], slotRefs: ["vrm-export"] },
  { technologyId: "three-vrm", region: "global", styleRefs: ["anime-stylized", "photoreal"], exportRefs: ["vrm-1.0"], slotRefs: ["vrm-export"] },
  // --- AR lane ---
  { technologyId: "model-viewer", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated"], exportRefs: ["glb", "usdz-ar-quick-look", "webxr-ar-scene"], slotRefs: ["ar"] },
  { technologyId: "arjs", region: "global", styleRefs: ["illustrated", "photoreal"], exportRefs: ["webxr-ar-scene"], slotRefs: ["ar"] },
  { technologyId: "webxr-device-api", region: "global", styleRefs: [], exportRefs: ["webxr-ar-scene"], slotRefs: ["ar"] },
  // --- realtime telepresence lane ---
  { technologyId: "jitsi-meet", region: "global", styleRefs: [], exportRefs: [], slotRefs: ["realtime-telepresence"] },
  { technologyId: "galene", region: "global", styleRefs: [], exportRefs: [], slotRefs: ["realtime-telepresence"] },
  { technologyId: "mozilla-hubs", region: "global", styleRefs: [], exportRefs: [], slotRefs: ["realtime-telepresence"] },
  // --- customer-owned compute lane ---
  { technologyId: "llamafile", region: "global", styleRefs: ["photoreal"], exportRefs: [], slotRefs: ["customer-compute"] },
  { technologyId: "localai", region: "global", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["customer-compute"] },
  { technologyId: "jan", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated"], exportRefs: [], slotRefs: ["customer-compute"] },
  { technologyId: "gpt4all", region: "global", styleRefs: ["photoreal"], exportRefs: [], slotRefs: ["customer-compute"] },
  // --- virtual try-on lane (NC-licensed research rows — researched-only) ---
  { technologyId: "idm-vton", region: "global", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["virtual-try-on"] },
  { technologyId: "ootdiffusion", region: "global", styleRefs: ["photoreal"], exportRefs: [], slotRefs: ["virtual-try-on"] },
  // --- style-pipeline lane (the "additional styles" plane) ---
  { technologyId: "diffusers", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated", "sculptural", "voxel"], exportRefs: [], slotRefs: ["style-pipeline"] },
  { technologyId: "safetensors", region: "global", styleRefs: [], exportRefs: [], slotRefs: ["style-pipeline"] },
  { technologyId: "sd-scripts", region: "global", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["style-pipeline"] },
  { technologyId: "ip-adapter", region: "global", styleRefs: ["anime-stylized", "illustrated"], exportRefs: [], slotRefs: ["style-pipeline"] },
  { technologyId: "comfyui", region: "global", styleRefs: ["photoreal", "anime-stylized", "illustrated"], exportRefs: [], slotRefs: ["style-pipeline"] },
  // --- regional-provider lane (closed class, docs-only research; ineligible pending terms review) ---
  { technologyId: "deepseek-api", region: "cn", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["regional-provider"] },
  { technologyId: "zhipu-bigmodel", region: "cn", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["regional-provider"] },
  { technologyId: "moonshot-platform", region: "cn", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["regional-provider"] },
  { technologyId: "volcengine-doubao", region: "cn", styleRefs: ["photoreal"], exportRefs: [], slotRefs: ["regional-provider"] },
  { technologyId: "naver-ncloud", region: "kr", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["regional-provider"] },
  { technologyId: "upstage-solar", region: "kr", styleRefs: ["photoreal", "anime-stylized"], exportRefs: [], slotRefs: ["regional-provider"] },
  { technologyId: "sarvam-api", region: "in", styleRefs: ["photoreal"], exportRefs: [], slotRefs: ["regional-provider"] },
];

/** The derived, read-only provider-matrix registry. */
export interface ProviderMatrixRegistry {
  /** All entries, deterministically ordered by id. */
  readonly entries: readonly NeutralProviderMatrixEntry[];
  byId(id: string): NeutralProviderMatrixEntry | null;
  /** Resolve the matrix row for (providerKind, region) — null when absent. */
  resolve(providerKind: string, region: EcosystemRegion): NeutralProviderMatrixEntry | null;
  /** The derivation basis cited per entry id (honest eligibility provenance). */
  basisFor(entryId: string): string;
}

/** sha-256 hex digest of string/bytes input (deterministic, no clock). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Opaque deterministic matrix-entry id for (providerKind, region) — you_matrix_<16hex>. */
export function providerMatrixEntryId(providerKind: string, region: EcosystemRegion): string {
  return `you_matrix_${sha256Hex(`${providerKind}|${region}`).slice(0, 16)}`;
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

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = Date.parse(`${fromIsoDate}T00:00:00Z`);
  const to = Date.parse(`${toIsoDate}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000);
}

function capabilityClassesOf(spec: ProviderMatrixRowSpec): readonly string[] {
  return sortedUnique([
    ...spec.styleRefs.map((style) => `${MATRIX_CLASS_PREFIXES.style}${style}`),
    ...spec.exportRefs.map((exportClass) => `${MATRIX_CLASS_PREFIXES.export}${exportClass}`),
    ...spec.slotRefs.map((slot) => `${MATRIX_CLASS_PREFIXES.slot}${slot}`),
  ]);
}

/**
 * Derive the ProviderMatrix registry from the technology registry + the
 * authored row specs (deterministic; fail-closed on unknown refs —
 * YOU_PROVIDER_MATRIX_INVALID). Eligibility derives from registry facts
 * (permissive SPDX + license verified + maintenance recency), never
 * hand-asserted. The optional rowSpecs parameter lets tests exercise the
 * fail-closed ref validation against broken specs (the shipped default
 * is the authored PROVIDER_MATRIX_ROW_SPECS table).
 */
export function deriveProviderMatrix(
  registry: TechnologyRegistry,
  options?: { readonly maxMaintenanceAgeDays?: number; readonly rowSpecs?: readonly ProviderMatrixRowSpec[] },
): ProviderMatrixRegistry {
  const maxAge = options?.maxMaintenanceAgeDays ?? DEFAULT_MAX_MAINTENANCE_AGE_DAYS;
  const rowSpecs = options?.rowSpecs ?? PROVIDER_MATRIX_ROW_SPECS;
  const entries: NeutralProviderMatrixEntry[] = [];
  const basisById = new Map<string, string>();
  const seenIds = new Set<string>();
  for (const spec of rowSpecs) {
    // Fail-closed ref validation (the ECOSYSTEM GATE LAW applies at
    // derivation too: an unknown ref never derives a row).
    const technology = registry.byId(spec.technologyId);
    if (!technology) {
      throw new ProviderMatrixInvalidError(
        `matrix row for technology '${spec.technologyId}' does not resolve in the technology registry (unknown provider ref)`,
      );
    }
    if (!ECOSYSTEM_REGIONS.includes(spec.region as (typeof ECOSYSTEM_REGIONS)[number])) {
      throw new ProviderMatrixInvalidError(`matrix row for '${spec.technologyId}' names unknown region '${spec.region}' (the authored region vocabulary only)`);
    }
    for (const style of spec.styleRefs) {
      if (!ECOSYSTEM_STYLE_CLASSES.includes(style as (typeof ECOSYSTEM_STYLE_CLASSES)[number])) {
        throw new ProviderMatrixInvalidError(`matrix row for '${spec.technologyId}' names unknown style class '${style}' (the authored style vocabulary only)`);
      }
    }
    for (const exportClass of spec.exportRefs) {
      if (!ECOSYSTEM_EXPORT_CLASSES.includes(exportClass as (typeof ECOSYSTEM_EXPORT_CLASSES)[number])) {
        throw new ProviderMatrixInvalidError(`matrix row for '${spec.technologyId}' names unknown export class '${exportClass}' (the authored export vocabulary only)`);
      }
    }
    for (const slot of spec.slotRefs) {
      if (!ECOSYSTEM_CAPABILITY_SLOTS.includes(slot as (typeof ECOSYSTEM_CAPABILITY_SLOTS)[number])) {
        throw new ProviderMatrixInvalidError(`matrix row for '${spec.technologyId}' names unknown capability slot '${slot}' (the eight stage-10 ecosystem classes only)`);
      }
    }
    // Registry-derived eligibility (license + maintenance gates).
    const licenseOk = technology.license.verified && technology.license.spdxId !== null && PRODUCTION_FRIENDLY_SPDX.has(technology.license.spdxId);
    const latest = latestMaintenanceDate(registry, spec.technologyId);
    const ageDays = latest === null ? Number.POSITIVE_INFINITY : daysBetween(latest, ECOSYSTEM_RESEARCH_DATE);
    const maintained = ageDays <= maxAge;
    const eligible = licenseOk && maintained;
    const id = providerMatrixEntryId(spec.technologyId, spec.region);
    if (seenIds.has(id)) {
      throw new ProviderMatrixInvalidError(`duplicate matrix row derived for (${spec.technologyId}, ${spec.region}) — id ${id}`);
    }
    seenIds.add(id);
    const basis = eligible
      ? `license ${technology.license.spdxId} (verified: ${technology.license.sourceUrl}) is in the permissive SPDX set; latest verified maintenance signal is ${ageDays} day(s) before the ${ECOSYSTEM_RESEARCH_DATE} research date; registry-derived eligible — real runtime integration stays post-W10 compute-plane work and nothing here measures the real technology`
      : licenseOk
        ? `license ${technology.license.spdxId} is permissive but the latest verified maintenance signal is ${Number.isFinite(ageDays) ? `${ageDays} day(s)` : "unknown"} old (limit ${maxAge}) — maintenance gate failed`
        : technology.license.spdxId === null
          ? `license is ${technology.license.verified ? "a non-SPDX custom form" : "unverified"} (${technology.license.name}) — production use blocked (truth law)`
          : `license ${technology.license.spdxId} is not in the permissive SPDX set — production use blocked without legal review`;
    entries.push({
      id,
      providerKind: spec.technologyId,
      region: spec.region,
      capabilityClasses: capabilityClassesOf(spec),
      eligible,
      simulated: true,
    });
    basisById.set(id, basis);
  }
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byIdMap = new Map(sorted.map((entry) => [entry.id, entry] as const));
  const byProviderRegion = new Map(sorted.map((entry) => [`${entry.providerKind}|${entry.region}`, entry] as const));
  return {
    entries: sorted,
    byId(id: string): NeutralProviderMatrixEntry | null {
      return byIdMap.get(id) ?? null;
    },
    resolve(providerKind: string, region: EcosystemRegion): NeutralProviderMatrixEntry | null {
      return byProviderRegion.get(`${providerKind}|${region}`) ?? null;
    },
    basisFor(entryId: string): string {
      const basis = basisById.get(entryId);
      if (basis === undefined) {
        throw new ProviderMatrixInvalidError(`no derivation basis for matrix entry '${entryId}' (the matrix never mints unbacked rows)`);
      }
      return basis;
    },
  };
}

// ---------------------------------------------------------------------------
// Matrix integrity validation
// ---------------------------------------------------------------------------

export interface ProviderMatrixIntegrityReport {
  readonly valid: boolean;
  /** Sorted issue strings (empty when valid). */
  readonly issues: readonly string[];
}

/**
 * Matrix integrity rules (tested):
 * 1. entry ids are unique and id-formatted (you_matrix_<16hex>);
 * 2. providerKind refs resolve in the backing registry;
 * 3. regions are inside the authored vocabulary;
 * 4. capabilityClasses use only the three authored prefixes and their refs
 *    resolve inside the vocabularies;
 * 5. every authored row spec derived exactly one entry (no silent drops);
 * 6. eligibility matches a recomputed registry derivation (never drifted).
 */
export function validateProviderMatrixIntegrity(
  matrix: ProviderMatrixRegistry,
  registry: TechnologyRegistry,
): ProviderMatrixIntegrityReport {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const entry of matrix.entries) {
    if (!/^you_matrix_[0-9a-f]{16}$/.test(entry.id)) issues.push(`${entry.id}: malformed matrix entry id`);
    if (seen.has(entry.id)) issues.push(`${entry.id}: duplicate matrix entry id`);
    seen.add(entry.id);
    if (entry.providerKind.length === 0) issues.push(`${entry.id}: empty providerKind`);
    const technology = registry.byId(entry.providerKind);
    if (!technology) {
      issues.push(`${entry.id}: providerKind '${entry.providerKind}' does not resolve in the registry`);
      continue;
    }
    if (!ECOSYSTEM_REGIONS.includes(entry.region as (typeof ECOSYSTEM_REGIONS)[number])) {
      issues.push(`${entry.id}: region '${entry.region}' outside the authored vocabulary`);
    }
    if (entry.capabilityClasses.length === 0) {
      issues.push(`${entry.id}: empty capabilityClasses (a row gates at least one class or slot)`);
    }
    for (const clazz of entry.capabilityClasses) {
      if (clazz.startsWith(MATRIX_CLASS_PREFIXES.style)) {
        const style = clazz.slice(MATRIX_CLASS_PREFIXES.style.length);
        if (!ECOSYSTEM_STYLE_CLASSES.includes(style as (typeof ECOSYSTEM_STYLE_CLASSES)[number])) {
          issues.push(`${entry.id}: unknown style class '${style}'`);
        }
      } else if (clazz.startsWith(MATRIX_CLASS_PREFIXES.export)) {
        const exportClass = clazz.slice(MATRIX_CLASS_PREFIXES.export.length);
        if (!ECOSYSTEM_EXPORT_CLASSES.includes(exportClass as (typeof ECOSYSTEM_EXPORT_CLASSES)[number])) {
          issues.push(`${entry.id}: unknown export class '${exportClass}'`);
        }
      } else if (clazz.startsWith(MATRIX_CLASS_PREFIXES.slot)) {
        const slot = clazz.slice(MATRIX_CLASS_PREFIXES.slot.length);
        if (!ECOSYSTEM_CAPABILITY_SLOTS.includes(slot as (typeof ECOSYSTEM_CAPABILITY_SLOTS)[number])) {
          issues.push(`${entry.id}: unknown capability slot '${slot}'`);
        }
      } else {
        issues.push(`${entry.id}: capability class '${clazz}' carries no authored prefix (style:/export:/slot:)`);
      }
    }
    if (entry.simulated !== true) {
      issues.push(`${entry.id}: matrix rows must stay simulated: true (the W10+ compute-plane boundary)`);
    }
  }
  // Every authored row spec derived exactly one entry.
  for (const spec of PROVIDER_MATRIX_ROW_SPECS) {
    const id = providerMatrixEntryId(spec.technologyId, spec.region);
    if (!seen.has(id)) {
      issues.push(`${spec.technologyId}|${spec.region}: authored row spec produced no matrix entry (silent drop)`);
    }
  }
  // Eligibility never drifts from a recomputed derivation.
  const recomputed = deriveProviderMatrix(registry);
  for (const entry of matrix.entries) {
    const expected = recomputed.byId(entry.id);
    if (!expected) {
      issues.push(`${entry.id}: entry is not derivable from the registry (unbacked row)`);
    } else if (expected.eligible !== entry.eligible) {
      issues.push(`${entry.id}: eligible=${entry.eligible} drifts from the registry-derived ${expected.eligible}`);
    } else if (canonicalJson(expected.capabilityClasses) !== canonicalJson(entry.capabilityClasses)) {
      issues.push(`${entry.id}: capabilityClasses drift from the registry-derived row`);
    }
  }
  const sortedIssues = [...new Set(issues)].sort();
  return { valid: sortedIssues.length === 0, issues: sortedIssues };
}

// ---------------------------------------------------------------------------
// The shared fail-closed gate every adapter invokes first
// ---------------------------------------------------------------------------

/**
 * Fail-closed seam gate EVERY ecosystem adapter invokes first: matrix-ref
 * resolution (YOU_PROVIDER_MATRIX_INVALID on unknown provider/region/style/
 * export refs or an ineligible row), capability-class coverage, budget
 * validity and enforcement BEFORE the effect, and the production
 * eligibility law for production-mode requests. No adapter can bypass the
 * gate — it is shared, not advisory.
 */
export function assertEcosystemRequestSupported(
  profile: EcosystemAdapterProfile,
  request: NeutralEcosystemRequest,
  matrix: ProviderMatrixRegistry,
  ledger: ProductionEligibilityLedger,
): NeutralProviderMatrixEntry {
  if (request.requestId.length === 0) {
    throw new ProviderMatrixInvalidError("empty requestId (a request names its identity)");
  }
  const entry = matrix.resolve(request.providerKind, request.region);
  if (!entry) {
    throw new ProviderMatrixInvalidError(
      `no matrix row for provider '${request.providerKind}' in region '${request.region}' (unknown matrix ref — the ecosystem gate is fail-closed)`,
    );
  }
  for (const style of request.styleRefs) {
    if (!ECOSYSTEM_STYLE_CLASSES.includes(style as (typeof ECOSYSTEM_STYLE_CLASSES)[number])) {
      throw new ProviderMatrixInvalidError(`request style ref '${style}' is outside the authored style vocabulary (unknown matrix ref)`);
    }
    if (!entry.capabilityClasses.includes(`${MATRIX_CLASS_PREFIXES.style}${style}`)) {
      throw new ProviderMatrixInvalidError(
        `matrix row ${entry.id} (provider '${entry.providerKind}', region '${entry.region}') does not gate style '${style}' (unknown ref for this row)`,
      );
    }
  }
  for (const exportClass of request.exportRefs) {
    if (!ECOSYSTEM_EXPORT_CLASSES.includes(exportClass as (typeof ECOSYSTEM_EXPORT_CLASSES)[number])) {
      throw new ProviderMatrixInvalidError(`request export ref '${exportClass}' is outside the authored export vocabulary (unknown matrix ref)`);
    }
    if (!entry.capabilityClasses.includes(`${MATRIX_CLASS_PREFIXES.export}${exportClass}`)) {
      throw new ProviderMatrixInvalidError(
        `matrix row ${entry.id} (provider '${entry.providerKind}', region '${entry.region}') does not gate export '${exportClass}' (unknown ref for this row)`,
      );
    }
  }
  if (!profile.servedRegions.includes(request.region)) {
    throw new ProviderMatrixInvalidError(
      `adapter '${profile.id}' does not serve region '${request.region}' (served: ${profile.servedRegions.join(", ") || "none"})`,
    );
  }
  if (!entry.eligible) {
    throw new ProviderMatrixInvalidError(
      `matrix row ${entry.id} (provider '${entry.providerKind}', region '${entry.region}') is not registry-eligible — ${matrix.basisFor(entry.id)}`,
    );
  }
  // Budget guard: enforce BEFORE the effect (fail-closed; typed refusal).
  enforceCostLatencyBudget(request.budget, request.declaredCostUnits, request.declaredLatencyS, {
    requestId: request.requestId,
    scope: request.budget.scope,
    submittedAt: request.submittedAt,
  });
  // PRODUCTION ELIGIBILITY LAW: production-mode requests require a latest
  // eligible decision (with rollback evidence) in the ledger.
  if (request.productionMode) {
    const latest = ledger.latestDecisionFor(entry.providerKind);
    if (!latest || !latest.eligible) {
      throw new ProviderMatrixInvalidError(
        `production-mode request '${request.requestId}' for provider '${entry.providerKind}' has no latest eligible ProductionEligibilityRecord in the ledger (the PRODUCTION ELIGIBILITY LAW requires an eligible decision backed by rollback evidence)`,
      );
    }
  }
  return entry;
}

/** Aggregate content-addressing digest over the fulfillment payload map (deterministic). An empty map has a class-less envelope (the W8C aggregateContentDigest precedent — the class binds payload bytes, never the other way around). */
export function aggregateEcosystemDigest(
  payloads: Readonly<Record<string, Record<string, unknown>>>,
  breakerClass: NeutralArenaBackoffClass,
): string {
  const keys = Object.keys(payloads).sort();
  if (keys.length === 0) {
    return sha256Hex(canonicalJson({ entries: [] }));
  }
  const entries = keys.map((key) => ({ key, payload: payloads[key] }));
  return sha256Hex(canonicalJson({ entries, breakerClass }));
}

/** Honest not-measured effort fields for simulated ecosystem adapters. */
export function notMeasuredEcosystemEffortFields(): EcosystemEffortFields {
  return {
    effort: { kind: "not-measured", marker: "not-measured (simulated)" },
    latency: { kind: "not-measured", marker: "not-measured (simulated)" },
    cost: { kind: "not-measured", marker: "not-measured (simulated)" },
  };
}

/**
 * Canonical fulfillment payload for (entry, request, styleRef, exportRef)
 * — the seeded fixture model's intended shape. BREAKER HONESTY: the payload
 * carries BOTH the breaker class the budget ACTUALLY enforced under and
 * the class the request declared — a misderiving adapter answers under a
 * different class and the misderivation stays visible (truth law).
 */
export function encodeEcosystemFulfillment(
  entry: NeutralProviderMatrixEntry,
  request: NeutralEcosystemRequest,
  styleRef: string,
  exportRef: string,
  actualBreakerClass: NeutralArenaBackoffClass,
  fidelity: number,
): Record<string, unknown> {
  return {
    matrixEntryId: entry.id,
    providerKind: entry.providerKind,
    region: entry.region,
    style: styleRef,
    export: exportRef,
    fidelity: roundTo(fidelity, 4),
    breakerClass: actualBreakerClass,
    requestedBreakerClass: request.budget.breakerClass,
    submittedAt: request.submittedAt,
  };
}

/**
 * Canonical seeded fidelity value for (providerKind, styleRef, exportRef)
 * — hash-derived fixture arithmetic in [0.5, 1.0] rounded to 4 decimals
 * (computed, not measured, never a claim about real providers).
 */
export function intendedFulfillmentFidelityAt(providerKind: string, styleRef: string, exportRef: string): number {
  const base = unitFrom("you-lab-ecosystem-model", providerKind, `${styleRef}|${exportRef}`, "fidelity");
  return roundTo(0.5 + base * 0.5, 4);
}

/**
 * Canonical seeded breaker-quality multiplier for (providerKind,
 * breakerClass) — hash-derived, class-dependent, rounded to 4 decimals (the
 * W8C intendedRecoveryAt precedent carried forward: well-behaved breaker
 * classes derive higher multipliers; computed, never measured).
 */
export function intendedBreakerQualityAt(providerKind: string, breakerClass: NeutralArenaBackoffClass): number {
  const base = unitFrom("you-lab-ecosystem-model", providerKind, "breaker-quality");
  switch (breakerClass) {
    case "exponential-backoff-jitter":
      return roundTo(0.8 + base * 0.2, 4);
    case "hedged-request":
      return roundTo(0.75 + base * 0.25, 4);
    case "circuit-breaker":
      return roundTo(0.7 + base * 0.3, 4);
    case "token-bucket":
      return roundTo(0.6 + base * 0.4, 4);
    default:
      throw new ProviderMatrixInvalidError(
        `intendedBreakerQualityAt: no authored quality band for breaker class "${breakerClass}" (the four W8C classes only)`,
      );
  }
}

/** The breaker-class vocabulary carried forward from W8C (re-exported for the seam's fail-closed validation). */
export const ECOSYSTEM_BREAKER_CLASSES = NEUTRAL_BACKOFF_CLASSES;

/** Digest label for the neutral ecosystem seam (honest provenance wiring). */
export function neutralEcosystemSeamVersion(): string {
  return `you-lab-ecosystem-seam/1 (fnv1a32 core ${fnv1a32("you-lab-ecosystem-seam/1")})`;
}
