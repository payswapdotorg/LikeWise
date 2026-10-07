// YOU export / external-edit / re-import interchange
// (docs/you/EDITING_INTERCHANGE.md, ARCHITECTURE.md §14).
//
// External editors are adapters, never domain authorities. An export is
// an immutable, content-addressed package carrying the full manifest
// lineage; a simulated external edit produces a NEW package; re-import
// computes a truthful diff and expresses it as ChangeSet operations that
// must go through YOU's own versioning authority.

import type {
  EditorRecommendation,
  OpaqueId,
  SolutionPatchOperation,
  SolutionStateSnapshot,
  SolutionVersion,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { computeQualityDeltas } from "./quality.js";
import { deepFreeze, stableContentHash, stableEquals, stableStringify } from "./serialize.js";
import { applyPatchOperations } from "./versioning.js";

/**
 * Phase-0 fixture editor recommendation table. The synthetic-human scene
 * recommends Blender (GLB round-trip); flat scenes recommend Excalidraw
 * (SVG annotation). Real editor adapters arrive with W5C.
 */
export const FIXTURE_EDITOR_RECOMMENDATIONS: readonly EditorRecommendation[] = [
  {
    editorId: "blender",
    editorName: "Blender",
    rationale: "external 3D correction of the synthetic-human scene; GLB round-trip supported",
    exportFormat: "glb",
  },
  {
    editorId: "excalidraw",
    editorName: "Excalidraw",
    rationale: "lightweight 2D annotation of flat scenes; SVG round-trip supported",
    exportFormat: "svg",
  },
];

/** Deterministic editor recommendation for a snapshot. */
export function recommendEditorForSnapshot(snapshot: SolutionStateSnapshot): EditorRecommendation {
  const hasHuman = snapshot.entities.some((entity) => entity.kind === "synthetic-human");
  const table = FIXTURE_EDITOR_RECOMMENDATIONS;
  const chosen = hasHuman ? table[0] : table[1];
  if (chosen === undefined) {
    throw new Error("editor recommendation table is empty");
  }
  return chosen;
}

export interface ArtifactManifest {
  readonly source: string;
  readonly generator: string;
  readonly editorId: string;
  readonly exportFormat: string;
  readonly lineage: readonly string[];
  readonly simulated: boolean;
}

/**
 * Content-addressed editable package for one Solution version. The state
 * snapshot travels inside the package so the Phase-0 round-trip is fully
 * deterministic; real large media would live in object storage with
 * hashes only (docs/you/ARCHITECTURE.md §16).
 */
export interface SolutionArtifactPackage {
  readonly id: OpaqueId;
  readonly contentHash: string;
  readonly solutionId: OpaqueId;
  readonly versionId: OpaqueId;
  readonly format: string;
  readonly createdAt: string;
  readonly state: SolutionStateSnapshot;
  readonly manifest: ArtifactManifest;
}

export interface ArtifactDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Builds the export package for a version (content-addressed id). */
export function buildArtifactPackage(
  version: SolutionVersion,
  editor: EditorRecommendation,
  deps: ArtifactDeps,
): SolutionArtifactPackage {
  const contentHash = stableContentHash(version.state);
  return deepFreeze({
    id: `you_artifact_${contentHash}`,
    contentHash,
    solutionId: version.solutionId,
    versionId: version.id,
    format: editor.exportFormat,
    createdAt: deps.clock.now(),
    state: version.state,
    manifest: deepFreeze({
      source: `solution-version:${version.id}`,
      generator: version.provenance.generator,
      editorId: editor.editorId,
      exportFormat: editor.exportFormat,
      lineage: [version.provenance.source, ...version.provenance.lineage],
      simulated: version.state.simulated,
    }),
  });
}

/**
 * Simulates the external editor applying operations to an exported
 * package. Produces a NEW content-addressed package derived from the
 * original (lineage extended). Fixture-only (Phase 0).
 */
export function simulateExternalEdit(
  pkg: SolutionArtifactPackage,
  operations: readonly SolutionPatchOperation[],
  deps: ArtifactDeps,
): SolutionArtifactPackage {
  const editedState = applyPatchOperations(pkg.state, operations);
  const contentHash = stableContentHash(editedState);
  return deepFreeze({
    id: `you_artifact_${contentHash}`,
    contentHash,
    solutionId: pkg.solutionId,
    versionId: pkg.versionId,
    format: pkg.format,
    createdAt: deps.clock.now(),
    state: editedState,
    manifest: deepFreeze({
      source: `external-edit:${pkg.id}`,
      generator: "importer",
      editorId: pkg.manifest.editorId,
      exportFormat: pkg.manifest.exportFormat,
      lineage: [pkg.id, ...pkg.manifest.lineage],
      simulated: true,
    }),
  });
}

/** Truthful structural diff between two snapshots. */
export interface SolutionStateDiff {
  readonly entitiesAdded: readonly string[];
  readonly entitiesRemoved: readonly string[];
  readonly entitiesChanged: readonly { readonly entityId: string; readonly fields: readonly string[] }[];
  readonly environmentChanged: readonly string[];
  readonly qualityDeltas: Readonly<Record<string, number>>;
}

function changedEntityFields(
  before: SolutionStateSnapshot["entities"][number],
  after: SolutionStateSnapshot["entities"][number],
): readonly string[] {
  const fields: string[] = [];
  if (before.label !== after.label || before.kind !== after.kind) {
    fields.push("label-kind");
  }
  if (!stableEquals(before.transform, after.transform)) {
    fields.push("transform");
  }
  if (!stableEquals(before.attributes, after.attributes)) {
    fields.push("attributes");
  }
  return fields;
}

/** Computes the exact structural diff (sorted, deterministic). */
export function diffSolutionStates(before: SolutionStateSnapshot, after: SolutionStateSnapshot): SolutionStateDiff {
  const beforeIds = new Set(before.entities.map((entity) => entity.id));
  const afterIds = new Set(after.entities.map((entity) => entity.id));
  const added = [...afterIds].filter((id) => !beforeIds.has(id)).sort();
  const removed = [...beforeIds].filter((id) => !afterIds.has(id)).sort();
  const changed: { entityId: string; fields: readonly string[] }[] = [];
  for (const afterEntity of after.entities) {
    const beforeEntity = before.entities.find((entity) => entity.id === afterEntity.id);
    if (beforeEntity === undefined) {
      continue;
    }
    const fields = changedEntityFields(beforeEntity, afterEntity);
    if (fields.length > 0) {
      changed.push({ entityId: afterEntity.id, fields });
    }
  }
  changed.sort((a, b) => (a.entityId < b.entityId ? -1 : 1));
  const environmentChanged: string[] = [];
  if (!stableEquals(before.environment, after.environment)) {
    for (const key of ["keyLightDirection", "ambientIntensity", "background"]) {
      if (!stableEquals(before.environment[key as keyof typeof before.environment], after.environment[key as keyof typeof after.environment])) {
        environmentChanged.push(key);
      }
    }
  }
  return deepFreeze({
    entitiesAdded: added,
    entitiesRemoved: removed,
    entitiesChanged: changed,
    environmentChanged,
    qualityDeltas: computeQualityDeltas(before.quality, after.quality),
  });
}

export interface ReImportResult {
  readonly diff: SolutionStateDiff;
  readonly operations: readonly SolutionPatchOperation[];
}

/**
 * Re-imports an (externally edited) package against a base version:
 * computes the truthful diff and expresses it as deterministic ChangeSet
 * operations. Acceptance stays with YOU's versioning authority.
 */
export function reImportArtifactPackage(
  pkg: SolutionArtifactPackage,
  baseVersion: SolutionVersion,
): ReImportResult {
  if (pkg.solutionId !== baseVersion.solutionId) {
    throw new Error("artifact package does not belong to this solution");
  }
  const diff = diffSolutionStates(baseVersion.state, pkg.state);
  const operations: SolutionPatchOperation[] = [];
  const changedIds = new Set<string>([...diff.entitiesAdded, ...diff.entitiesChanged.map((entry) => entry.entityId)]);
  const pkgEntities = [...pkg.state.entities].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const entity of pkgEntities) {
    if (changedIds.has(entity.id)) {
      operations.push({ op: "upsert_entity", entity });
    }
  }
  for (const entityId of diff.entitiesRemoved) {
    operations.push({ op: "remove_entity", entityId });
  }
  if (diff.environmentChanged.length > 0) {
    operations.push({ op: "update_environment", environment: pkg.state.environment });
  }
  for (const [deficiencyClass, delta] of Object.entries(diff.qualityDeltas)) {
    if (delta !== 0) {
      operations.push({ op: "adjust_quality", deficiencyClass, delta });
    }
  }
  return { diff, operations: Object.freeze(operations) };
}

/** Canonical JSON of a package (golden comparisons). */
export function serializeArtifactPackage(pkg: SolutionArtifactPackage): string {
  return stableStringify(pkg);
}
