// Provider-neutral editor adapter seam (W1C).
//
// External editors are adapters, never domain authorities
// (docs/you/ARCHITECTURE.md §14). This seam defines the neutral interchange
// surface: export canonical (neutral) state to an external editor artifact,
// import an edited artifact back as candidate operations, plus deterministic
// diff/validate hooks. The neutral shapes are owned by you-lab; mapping onto
// the frozen @zcode/shared YOU contract happens ONLY in src/contractSeam.ts.
//
// Determinism: artifacts, diffs and validations are pure functions of their
// inputs (no clock, no randomness, no network). Timestamps are never minted
// here; an optional injected clock can label provenance externally.

import type { EditorCapabilityProfile } from "../technology/editorCapability.js";

/** Neutral entity — structurally aligned with the frozen SolutionEntity shape. */
export interface NeutralEntity {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly transform: {
    readonly position: readonly [number, number, number];
    readonly rotation: readonly [number, number, number];
    readonly scale: readonly [number, number, number];
  };
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/** Neutral environment — structurally aligned with SolutionEnvironmentState. */
export interface NeutralEnvironment {
  readonly keyLightDirection: readonly [number, number, number];
  readonly ambientIntensity: number;
  readonly background: string;
}

export interface EditorExportRequest {
  readonly solutionId: string;
  readonly versionId: string;
  readonly entities: readonly NeutralEntity[];
  readonly environment: NeutralEnvironment;
  readonly targetTechnologyId: string;
  readonly reason: "user-edit" | "agent-edit" | "benchmark";
}

export interface EditorArtifact {
  readonly artifactId: string;
  readonly format: string;
  readonly technologyId: string;
  readonly sourceVersionId: string;
  /** Deterministic, JSON-serializable artifact content. */
  readonly content: Readonly<Record<string, unknown>>;
  readonly provenance: {
    readonly generator: string;
    /** Null in deterministic mode (no wall clock); labels otherwise injected. */
    readonly createdAt: string | null;
  };
}

/** Candidate operations proposed when an edited artifact is imported. */
export type CandidateOperation =
  | { readonly op: "upsert_entity"; readonly entity: NeutralEntity }
  | { readonly op: "remove_entity"; readonly entityId: string }
  | { readonly op: "update_environment"; readonly environment: Partial<NeutralEnvironment> };

export interface EditorImportResult {
  readonly artifactId: string;
  readonly operations: readonly CandidateOperation[];
  /** Sorted, human-readable warnings (e.g. dropped unknown entity kinds). */
  readonly warnings: readonly string[];
}

export interface EditorDiffReport {
  readonly artifactAId: string;
  readonly artifactBId: string;
  readonly addedEntityIds: readonly string[];
  readonly removedEntityIds: readonly string[];
  readonly changedEntityIds: readonly string[];
  readonly environmentChanged: boolean;
  readonly identical: boolean;
}

export interface EditorValidationReport {
  readonly valid: boolean;
  /** Sorted issue descriptions; empty when valid. */
  readonly issues: readonly string[];
}

export interface EditorAdapter {
  /** Stable adapter id, e.g. "mock-svg-edit". */
  readonly id: string;
  readonly technologyId: string;
  readonly capability: EditorCapabilityProfile;
  /** Export neutral canonical state to an external editor artifact. */
  exportArtifact(request: EditorExportRequest): EditorArtifact;
  /** Import an (edited) artifact as candidate operations on canonical state. */
  importArtifact(artifact: EditorArtifact): EditorImportResult;
  /** Deterministic structural + semantic diff between two artifacts. */
  diff(base: EditorArtifact, edited: EditorArtifact): EditorDiffReport;
  /** Deterministic shape validation of an artifact. */
  validate(artifact: EditorArtifact): EditorValidationReport;
}

/** Neutral canonical state used for round-trip evaluation. */
export interface NeutralCanonicalState {
  readonly entities: readonly NeutralEntity[];
  readonly environment: NeutralEnvironment;
}

/** Apply candidate operations to neutral state (pure; used by tests/benchmarks). */
export function applyCandidateOperations(
  state: NeutralCanonicalState,
  operations: readonly CandidateOperation[],
): NeutralCanonicalState {
  let entities = [...state.entities];
  let environment = state.environment;
  for (const operation of operations) {
    if (operation.op === "upsert_entity") {
      entities = entities.filter((entity) => entity.id !== operation.entity.id);
      entities = [...entities, operation.entity];
    } else if (operation.op === "remove_entity") {
      entities = entities.filter((entity) => entity.id !== operation.entityId);
    } else {
      environment = { ...environment, ...operation.environment };
    }
  }
  return {
    entities: [...entities].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    environment,
  };
}
