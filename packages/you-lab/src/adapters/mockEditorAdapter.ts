// Deterministic mock editor adapter (W1C).
//
// Implements EditorAdapterSeam against a mock candidate: export serializes
// neutral canonical state into a canonical-JSON artifact (sorted entity order,
// deterministic id), import turns an artifact back into candidate operations,
// diff/validate are pure structural functions. mockEditArtifact applies an
// EXPLICIT edit specification (no randomness) so benchmarks and tests can
// simulate an external edit deterministically.

import { canonicalJson, fnv1a32, sortedUnique } from "../determinism.js";
import type {
  CandidateOperation,
  EditorAdapter,
  EditorArtifact,
  EditorDiffReport,
  EditorExportRequest,
  EditorImportResult,
  EditorValidationReport,
  NeutralCanonicalState,
  NeutralEntity,
} from "./editorAdapterSeam.js";
import { applyCandidateOperations } from "./editorAdapterSeam.js";
import type { EditorCapabilityProfile } from "../technology/editorCapability.js";

const GENERATOR = "you-lab-mock-editor-adapter/1";

export function createMockEditorAdapter(capability: EditorCapabilityProfile): EditorAdapter {
  const id = `mock-${capability.technologyId}`;
  const primaryFormat = capability.formatSupport.find((entry) => entry.write)?.format ?? "neutral-json";
  return {
    id,
    technologyId: capability.technologyId,
    capability,
    exportArtifact(request: EditorExportRequest): EditorArtifact {
      const entities = [...request.entities].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const content = {
        environment: request.environment,
        format: primaryFormat,
        reason: request.reason,
        solutionId: request.solutionId,
        sourceVersionId: request.versionId,
        technologyId: request.targetTechnologyId,
        entities: entities.map((entity) => ({
          attributes: entity.attributes,
          id: entity.id,
          kind: entity.kind,
          label: entity.label,
          transform: entity.transform,
        })),
      };
      const artifactId = fnv1a32(canonicalJson(content));
      return {
        artifactId,
        format: primaryFormat,
        technologyId: request.targetTechnologyId,
        sourceVersionId: request.versionId,
        content,
        provenance: { generator: GENERATOR, createdAt: null },
      };
    },
    importArtifact(artifact: EditorArtifact): EditorImportResult {
      const validation = validateArtifactContent(artifact);
      if (!validation.valid) {
        throw new Error(`mock adapter: refusing invalid artifact ${artifact.artifactId}: ${validation.issues.join("; ")}`);
      }
      const content = artifact.content as {
        entities: NeutralEntity[];
        environment: NeutralCanonicalState["environment"];
      };
      const entities = [...content.entities].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const operations: CandidateOperation[] = entities.map((entity) => ({ op: "upsert_entity", entity }));
      operations.push({ op: "update_environment", environment: content.environment });
      return {
        artifactId: artifact.artifactId,
        operations,
        warnings: [],
      };
    },
    diff(base: EditorArtifact, edited: EditorArtifact): EditorDiffReport {
      const baseEntities = readEntities(base);
      const editedEntities = readEntities(edited);
      const baseIds = new Set(baseEntities.map((entity) => entity.id));
      const editedIds = new Set(editedEntities.map((entity) => entity.id));
      const added = sortedUnique([...editedIds].filter((id) => !baseIds.has(id)));
      const removed = sortedUnique([...baseIds].filter((id) => !editedIds.has(id)));
      const changed = sortedUnique(
        [...editedIds].filter((id) => {
          if (!baseIds.has(id)) return false;
          const before = baseEntities.find((entity) => entity.id === id);
          const after = editedEntities.find((entity) => entity.id === id);
          return canonicalJson(before) !== canonicalJson(after);
        }),
      );
      const environmentChanged =
        canonicalJson(readEnvironment(base)) !== canonicalJson(readEnvironment(edited));
      return {
        artifactAId: base.artifactId,
        artifactBId: edited.artifactId,
        addedEntityIds: added,
        removedEntityIds: removed,
        changedEntityIds: changed,
        environmentChanged,
        identical: added.length === 0 && removed.length === 0 && changed.length === 0 && !environmentChanged,
      };
    },
    validate(artifact: EditorArtifact): EditorValidationReport {
      return validateArtifactContent(artifact);
    },
  };
}

/** Deterministic simulated external edit, driven by an explicit spec. */
export interface MockEditSpec {
  /** entity id → scale multiplier (applied to all three scale components). */
  readonly scaleEdits: Readonly<Record<string, number>>;
  readonly addedEntities: readonly NeutralEntity[];
  readonly removedEntityIds: readonly string[];
  readonly environment?: Partial<NeutralCanonicalState["environment"]>;
}

export function mockEditArtifact(artifact: EditorArtifact, spec: MockEditSpec): EditorArtifact {
  const content = artifact.content as { entities: NeutralEntity[]; environment: NeutralCanonicalState["environment"] } & Record<string, unknown>;
  const entities = content.entities
    .filter((entity) => !spec.removedEntityIds.includes(entity.id))
    .map((entity) => {
      const factor = spec.scaleEdits[entity.id];
      if (factor === undefined) return entity;
      return {
        ...entity,
        transform: {
          ...entity.transform,
          scale: [
            entity.transform.scale[0] * factor,
            entity.transform.scale[1] * factor,
            entity.transform.scale[2] * factor,
          ] as const,
        },
      };
    });
  for (const added of spec.addedEntities) {
    entities.push(added);
  }
  const editedContent = {
    ...content,
    entities: [...entities].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    environment: { ...content.environment, ...spec.environment },
  };
  return {
    ...artifact,
    artifactId: fnv1a32(canonicalJson(editedContent)),
    content: editedContent,
  };
}

function readEntities(artifact: EditorArtifact): NeutralEntity[] {
  const raw = (artifact.content as { entities?: unknown }).entities;
  return Array.isArray(raw) ? (raw as NeutralEntity[]) : [];
}

function readEnvironment(artifact: EditorArtifact): NeutralCanonicalState["environment"] | null {
  const raw = (artifact.content as { environment?: unknown }).environment;
  if (raw === null || raw === undefined) return null;
  return raw as NeutralCanonicalState["environment"];
}

function validateArtifactContent(artifact: EditorArtifact): EditorValidationReport {
  const issues: string[] = [];
  if (artifact.artifactId.length === 0) issues.push("artifactId missing");
  if (artifact.format.length === 0) issues.push("format missing");
  const content = artifact.content as { entities?: unknown; environment?: unknown };
  if (!Array.isArray(content.entities)) {
    issues.push("content.entities must be an array");
  } else {
    const ids = new Set<string>();
    for (const entity of content.entities as NeutralEntity[]) {
      if (typeof entity?.id !== "string" || entity.id.length === 0) issues.push("entity id missing");
      if (ids.has(entity.id)) issues.push(`duplicate entity id ${entity.id}`);
      ids.add(entity.id);
      if (typeof entity?.kind !== "string") issues.push(`entity ${entity.id}: kind missing`);
      if (typeof entity?.label !== "string") issues.push(`entity ${entity.id}: label missing`);
      for (const axis of ["position", "rotation", "scale"] as const) {
        const vector = entity?.transform?.[axis];
        if (!Array.isArray(vector) || vector.length !== 3 || vector.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
          issues.push(`entity ${entity.id}: transform.${axis} must be 3 finite numbers`);
        }
      }
    }
  }
  const environment = content.environment as Partial<NeutralCanonicalState["environment"]> | undefined;
  if (environment === undefined || environment === null) {
    issues.push("content.environment missing");
  } else {
    if (typeof environment.ambientIntensity !== "number") issues.push("environment.ambientIntensity must be a number");
    if (typeof environment.background !== "string") issues.push("environment.background must be a string");
    const light = environment.keyLightDirection;
    if (!Array.isArray(light) || light.length !== 3) issues.push("environment.keyLightDirection must be 3 numbers");
  }
  const sorted = [...new Set(issues)].sort();
  return { valid: sorted.length === 0, issues: sorted };
}

/** Export → import → apply round-trip on neutral state (deterministic). */
export function roundTripState(adapter: EditorAdapter, state: NeutralCanonicalState, solutionId: string, versionId: string): NeutralCanonicalState {
  const artifact = adapter.exportArtifact({
    solutionId,
    versionId,
    entities: state.entities,
    environment: state.environment,
    targetTechnologyId: adapter.technologyId,
    reason: "benchmark",
  });
  const imported = adapter.importArtifact(artifact);
  return applyCandidateOperations(state, imported.operations);
}
