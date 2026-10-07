// EditorCapabilityProfile derivation (W1C).
//
// Derivation is a deterministic function of registry entries: only profiles
// marked editorCapable participate; editable attribute domains come from a
// fixed tag-to-domain table; entity kinds from a fixed domain-to-kind table;
// format support from a fixed tag-to-format table; integration tiers and
// round-trip risk from fixed tables keyed by technology id (the tier list is
// the one authored input, mirroring docs/you/EDITING_INTERCHANGE.md). The
// result is an engineering assessment (derivedFrom carries the table version),
// not an external claim.

import { sortedUnique } from "../determinism.js";
import type { TechnologyRegistry } from "./registry.js";

export type IntegrationTier = 1 | 2 | 3 | 4;
export type RoundTripRisk = "low" | "medium" | "high";

export interface FormatSupportEntry {
  readonly format: string;
  readonly read: boolean;
  readonly write: boolean;
  readonly fidelity: "full" | "partial" | "unknown";
}

export interface EditorCapabilityProfile {
  readonly technologyId: string;
  readonly editorName: string;
  readonly integrationTier: IntegrationTier;
  readonly editableEntityKinds: readonly string[];
  readonly editableAttributeDomains: readonly string[];
  readonly formatSupport: readonly FormatSupportEntry[];
  readonly roundTripRisk: RoundTripRisk;
  readonly roundTripRationale: string;
  readonly derivedFrom: string;
}

const DERIVATION_TABLE = "you-lab editor-capability table/1 (engineering assessment)";

/** Integration tiers per docs/you/EDITING_INTERCHANGE.md (authored input). */
const TIER_BY_TECHNOLOGY: Readonly<Record<string, IntegrationTier>> = {
  "three-js": 1,
  "react-three-fiber": 1,
  "svg-edit": 2,
  excalidraw: 2,
  openreel: 2,
  blender: 3,
};

/** Round-trip risk per tier + domain shape (authored rationale strings). */
const RISK_BY_TECHNOLOGY: Readonly<Record<string, { risk: RoundTripRisk; rationale: string }>> = {
  "three-js": { risk: "low", rationale: "Tier 1 native: edits apply to the canonical runtime state directly; no interchange loss." },
  "react-three-fiber": { risk: "low", rationale: "Tier 1 native: declarative edits map to canonical state; no interchange loss." },
  "svg-edit": { risk: "high", rationale: "Tier 2 embedded 2D: edits apply to a projected SVG artifact; canonical 3D state round-trip is lossy." },
  excalidraw: { risk: "high", rationale: "Tier 2 embedded 2D: annotation/diagram edits target an overlay artifact, not canonical 3D state." },
  openreel: { risk: "high", rationale: "Tier 2 embedded video: edits apply to rendered media; canonical state requires re-render to compare." },
  blender: { risk: "medium", rationale: "Tier 3 external: glTF interchange covers geometry/materials/rig but some semantics are lossy across the boundary." },
};

/** Integration tier for a technology id (4 = no editor integration path). */
export function integrationTierFor(technologyId: string): IntegrationTier {
  return TIER_BY_TECHNOLOGY[technologyId] ?? 4;
}

const TAG_DOMAINS: Readonly<Record<string, readonly string[]>> = {
  "3d-render": ["transform", "material"],
  "scene-graph": ["transform", "material"],
  "react-integration": ["transform", "material"],
  "3d-modeling": ["geometry", "material", "rig"],
  "mesh-edit": ["geometry"],
  sculpting: ["geometry"],
  rigging: ["rig", "animation"],
  animation: ["animation"],
  "vector-2d": ["vector-2d"],
  svg: ["vector-2d"],
  "svg-edit": ["vector-2d"],
  diagram: ["annotation"],
  annotation: ["annotation"],
  "canvas-2d": ["annotation"],
  "video-editing": ["timeline"],
  timeline: ["timeline"],
};

const DOMAIN_ENTITY_KINDS: Readonly<Record<string, readonly string[]>> = {
  geometry: ["synthetic-human", "prop", "environment"],
  material: ["synthetic-human", "prop", "environment"],
  rig: ["synthetic-human"],
  animation: ["synthetic-human"],
  transform: ["synthetic-human", "prop", "environment", "light", "camera-marker"],
  "vector-2d": ["prop"],
  annotation: ["prop"],
  timeline: [],
};

const TAG_FORMATS: Readonly<Record<string, readonly FormatSupportEntry[]>> = {
  gltf: [
    { format: "gltf", read: true, write: true, fidelity: "partial" },
    { format: "glb", read: true, write: true, fidelity: "partial" },
  ],
  svg: [{ format: "svg", read: true, write: true, fidelity: "full" }],
  mp4: [{ format: "mp4", read: true, write: true, fidelity: "partial" }],
  webm: [{ format: "webm", read: true, write: true, fidelity: "partial" }],
};

export function deriveEditorCapabilityProfiles(registry: TechnologyRegistry): readonly EditorCapabilityProfile[] {
  const profiles: EditorCapabilityProfile[] = [];
  for (const technology of registry.profiles) {
    if (!technology.editorCapable) continue;
    const tier = TIER_BY_TECHNOLOGY[technology.id] ?? 4;
    if (tier === 4) continue; // no integration path derived

    const domains = sortedUnique(
      technology.capabilityTags.flatMap((tag) => TAG_DOMAINS[tag] ?? []),
    );
    const entityKinds = sortedUnique(
      domains.flatMap((domain) => DOMAIN_ENTITY_KINDS[domain] ?? []),
    );
    const formatSupport = dedupeFormats(
      technology.capabilityTags.flatMap((tag) => TAG_FORMATS[tag] ?? []),
    );
    const risk = RISK_BY_TECHNOLOGY[technology.id] ?? {
      risk: "high",
      rationale: "Unknown integration — conservative high risk until benchmarked.",
    };
    profiles.push({
      technologyId: technology.id,
      editorName: technology.name,
      integrationTier: tier,
      editableEntityKinds: entityKinds,
      editableAttributeDomains: domains,
      formatSupport,
      roundTripRisk: risk.risk,
      roundTripRationale: risk.rationale,
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.technologyId < b.technologyId ? -1 : a.technologyId > b.technologyId ? 1 : 0));
}

function dedupeFormats(entries: readonly FormatSupportEntry[]): readonly FormatSupportEntry[] {
  const byFormat = new Map<string, FormatSupportEntry>();
  for (const entry of entries) {
    const existing = byFormat.get(entry.format);
    if (!existing) {
      byFormat.set(entry.format, entry);
      continue;
    }
    byFormat.set(entry.format, {
      format: entry.format,
      read: existing.read || entry.read,
      write: existing.write || entry.write,
      fidelity: existing.fidelity === "full" && entry.fidelity === "full" ? "full" : "partial",
    });
  }
  return [...byFormat.values()].sort((a, b) => (a.format < b.format ? -1 : a.format > b.format ? 1 : 0));
}
