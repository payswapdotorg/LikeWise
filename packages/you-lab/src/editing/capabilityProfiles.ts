// Editing capability profiles derivation (W5C).
//
// Derives the v5-shaped (neutral) capability profile set as a deterministic
// function of the editor technology registry: editor kind comes from a fixed
// id-to-kind table (the W5C taxonomy authored input, mirroring
// docs/you/WORK_ORDERS.md W5C and docs/you/EDITING_INTERCHANGE.md), format
// support from a fixed tag-to-format table, round-trip safety from a fixed
// id-to-assessment table (authored engineering assessment with rationale
// strings — never a runtime authority, never a verified external claim).
// Only profiles marked editorCapable participate; interchange formats
// (gltf/openusd/...) are NOT editors and participate only through the seam
// format-mapping tables, not as capability profiles.

import { sortedUnique } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { EditingCapabilityProfile, NeutralEditorKind, NeutralImportExportFormat } from "./editingAdapterSeam.js";

const DERIVATION_TABLE = "you-lab editing-capability table/1 (engineering assessment)";

/** W5C editor-kind taxonomy per technology id (authored input — the order's classes). */
const EDITOR_KIND: Readonly<Record<string, NeutralEditorKind>> = {
  // native class: Tier 1 runtime editors + VS Code-class extensible editors
  "three-js": "native",
  "react-three-fiber": "native",
  vscode: "native",
  // embedded class: browser-embedded editor hosts
  "monaco-editor": "embedded",
  codemirror: "embedded",
  prosemirror: "embedded",
  "svg-edit": "embedded",
  excalidraw: "embedded",
  openreel: "embedded",
  // external class: external application pipelines
  blender: "external",
  godot: "external",
  gimp: "external",
  krita: "external",
  kdenlive: "external",
};

/** Authored tag -> supported interchange formats (deterministic derivation). */
const TAG_FORMATS: Readonly<Record<string, readonly NeutralImportExportFormat[]>> = {
  "edit-interchange": ["edit-interchange"],
  gltf: ["gltf", "glb"],
  json: ["json"],
  jpeg: ["jpeg"],
  mp4: ["mp4"],
  png: ["png"],
  svg: ["svg"],
  webm: ["webm"],
  webp: ["webp"],
};

/**
 * Authored round-trip safety assessment per technology id. roundTripSafe:
 * whether an edit round-trip through the editor preserves the subject
 * artifact's canonical content within its supported formats. Engineering
 * assessment (researched, labeled) — never a runtime authority.
 */
const ROUND_TRIP: Readonly<Record<string, { safe: boolean; notes: string }>> = {
  "three-js": { safe: true, notes: "Tier 1 native: edits apply directly to the canonical runtime state; no interchange boundary (docs/you/EDITING_INTERCHANGE.md tier 1)." },
  "react-three-fiber": { safe: true, notes: "Tier 1 native: declarative edits map onto canonical state; no interchange boundary." },
  vscode: { safe: true, notes: "VS Code-class extensible editor: text/JSON artifact edits are byte-precise; structural validation happens at the seam on import." },
  "monaco-editor": { safe: true, notes: "Monaco-class embedded web editor: text/JSON artifact edits are byte-precise; validation at the seam on import." },
  codemirror: { safe: true, notes: "CodeMirror-class embedded editor toolkit: text/JSON artifact edits are byte-precise; validation at the seam on import." },
  prosemirror: { safe: true, notes: "ProseMirror-class embedded rich-text surface: schema-validated structured document JSON round-trips through its own model; markdown interchange depends on the separate prosemirror-markdown package." },
  "svg-edit": { safe: true, notes: "Edits SVG source directly (its supported interchange format); canonical 3D state still needs the projected 2D boundary (W1C tier 2 risk note)." },
  excalidraw: { safe: false, notes: "Internal-model conversion: the faithful format is the .excalidraw JSON document; SVG export is lossy for editability semantics." },
  openreel: { safe: false, notes: "Tier 2 embedded video: edits apply to rendered media; re-encode round-trip is lossy and canonical state requires re-render to compare." },
  blender: { safe: false, notes: "Tier 3 external DCC: glTF interchange covers geometry/materials/rig but some semantics are lossy across the boundary (W1C medium risk)." },
  godot: { safe: false, notes: "Godot-class external scene editor: glTF import/export interchange is lossy for engine-specific scene semantics." },
  gimp: { safe: true, notes: "External raster image editor: pixel-level round-trip via PNG is lossless within supported formats; layered/semantic state is flattened (XCF is native, not interchange)." },
  krita: { safe: true, notes: "External raster/painting editor: pixel-level round-trip via PNG is lossless within supported formats; layered state is flattened (KRA is native, not interchange)." },
  kdenlive: { safe: false, notes: "External video editor: rendered-media round-trip is a lossy re-encode; editorial timeline interchange is the separately registered OpenTimelineIO candidate." },
};

export function deriveEditingCapabilityProfiles(registry: TechnologyRegistry): readonly EditingCapabilityProfile[] {
  const profiles: EditingCapabilityProfile[] = [];
  for (const technology of registry.profiles) {
    if (!technology.editorCapable) continue;
    const kind = EDITOR_KIND[technology.id];
    if (!kind) continue; // editor-capable but outside the W5C taxonomy — no capability profile
    const formats = sortedUnique(
      technology.capabilityTags.flatMap((tag) => TAG_FORMATS[tag] ?? []),
    ) as readonly NeutralImportExportFormat[];
    const assessment = ROUND_TRIP[technology.id] ?? {
      safe: false,
      notes: "Unknown integration — conservative not-round-trip-safe until benchmarked.",
    };
    profiles.push({
      id: technology.id,
      editorKind: kind,
      displayName: technology.name,
      supportsFormats: formats,
      roundTripSafe: assessment.safe,
      notes: assessment.notes,
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Capability profile lookup by technology id (null when not derived). */
export function editingCapabilityById(
  profiles: readonly EditingCapabilityProfile[],
  technologyId: string,
): EditingCapabilityProfile | null {
  return profiles.find((profile) => profile.id === technologyId) ?? null;
}
