// Provider-neutral editing adapter seam (W5C).
//
// External editors are adapters, never domain authorities
// (docs/you/ARCHITECTURE.md §14). This seam defines the neutral W5C editing
// surface: a typed editor invocation over a content-addressed subject
// artifact (the W1C neutral canonical state) that produces an
// EditChangeSet-shaped result — content-addressed op payloads (payloadRef +
// payloadHash) per the frozen v5 contract laws. The neutral shapes are
// owned by you-lab and are structurally aligned with the frozen
// @zcode/shared YOU v5 EditingSession/EditChangeSet/CandidateVersion/
// ImportExportResult/RoundTripBenchmarkReport shapes; mapping onto the
// frozen contract happens ONLY in src/contractSeam.ts.
//
// Determinism: subject artifacts, edit plans, change sets and edited content
// are pure functions of their inputs (no clock, no Math.random, no network —
// seeded derivations only, docs/you/FIXTURES.md). Effort/latency/cost are
// structured fields carrying explicit not-measured markers (truth law —
// never invented numbers).

import { createHash } from "node:crypto";

import { fnv1a32 } from "../determinism.js";
import type { MetricField } from "../benchmarks/runner.js";
import type { NeutralCanonicalState, NeutralEntity, NeutralEnvironment } from "../adapters/editorAdapterSeam.js";
import { applyCandidateOperations, type CandidateOperation } from "../adapters/editorAdapterSeam.js";

/** Neutral editor kind — aligned 1:1 with the frozen v5 EditorKind taxonomy. */
export type NeutralEditorKind = "native" | "embedded" | "external" | (string & {});

/** Neutral interchange format — aligned 1:1 with the frozen v5 ImportExportFormat. */
export type NeutralImportExportFormat = "json" | "edit-interchange" | "scene-package" | (string & {});

/**
 * Neutral editing capability profile — structurally aligned with the frozen
 * v5 EditorCapabilityProfile. Researched data derived from the technology
 * registry (never a runtime authority).
 */
export interface EditingCapabilityProfile {
  readonly id: string;
  readonly editorKind: NeutralEditorKind;
  readonly displayName: string;
  readonly supportsFormats: readonly NeutralImportExportFormat[];
  readonly roundTripSafe: boolean;
  readonly notes: string;
  readonly derivedFrom: string;
}

/**
 * A single content-addressed edit operation inside a neutral edit change
 * set — aligned 1:1 with the frozen v5 EditChangeSetOp. The payload bytes
 * are never inlined in the record; payloadRef addresses the content store
 * and payloadHash (sha-256 hex) binds the payload.
 */
export interface NeutralEditChangeSetOp {
  readonly id: string;
  readonly kind: string;
  readonly payloadRef: string;
  readonly payloadHash: string;
}

/** An ordered, immutable neutral edit change set — aligned 1:1 with v5 EditChangeSet. */
export interface NeutralEditChangeSet {
  readonly id: string;
  readonly sessionId: string;
  readonly ops: readonly NeutralEditChangeSetOp[];
  readonly createdAt: string;
}

/** Content-addressed subject artifact carrying the W1C neutral canonical state. */
export interface NeutralSubjectArtifact {
  readonly artifactId: string;
  readonly format: NeutralImportExportFormat;
  readonly contentRef: string;
  readonly contentHash: string;
  /** Canonical neutral state: { entities, environment, ... } (W1C shapes). */
  readonly content: Readonly<Record<string, unknown>>;
}

/** Seeded synthetic edit plan (fixture-defined intended edits — no randomness here). */
export interface NeutralEditPlan {
  /** entity id -> scale multiplier (applied to all three scale components). */
  readonly scaleEdits: Readonly<Record<string, number>>;
  readonly addedEntities: readonly NeutralEntity[];
  readonly removedEntityIds: readonly string[];
  readonly environment?: Partial<NeutralEnvironment>;
}

/** Typed editor invocation request. */
export interface NeutralEditingRequest {
  readonly requestId: string;
  readonly editingSessionId: string;
  readonly subjectArtifact: NeutralSubjectArtifact;
  /** Interchange format requested at the seam (import/export format mapping). */
  readonly format: NeutralImportExportFormat;
  readonly editPlan: NeutralEditPlan;
  readonly submittedAt: string;
}

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface EditingEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

/** Deterministic output of a typed editor invocation. */
export interface NeutralEditingOutput {
  readonly adapterId: string;
  readonly requestId: string;
  readonly changeSet: NeutralEditChangeSet;
  /**
   * Op payloads for this invocation keyed by op id — the content-store
   * sidecar the caller can resolve payloadRefs against. NEVER inlined in
   * the change set record itself (the v5 content-addressing law holds:
   * records carry payloadRef + payloadHash only); each payload's canonical
   * JSON hashes to its op's payloadHash.
   */
  readonly payloads: Readonly<Record<string, Record<string, unknown>>>;
  /** Canonical-JSON digest of the edited neutral state content. */
  readonly editedContentHash: string;
  readonly warnings: readonly string[];
  readonly effort: EditingEffortFields;
  readonly simulated: boolean;
}

/** Profile of a registered editing adapter behind the seam. */
export interface EditingAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  readonly editorKind: NeutralEditorKind;
  readonly supportedFormats: readonly NeutralImportExportFormat[];
  /** Whether the adapter implementation itself is bit-deterministic. */
  readonly deterministic: boolean;
  readonly determinismNote: string;
  /** Capability-carried round-trip safety (researched assessment). */
  readonly roundTripSafe: boolean;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
  readonly eligibilityBasis: string;
}

export interface EditingAdapter {
  readonly profile: EditingAdapterProfile;
  /** Invoke the editor over the subject artifact (deterministic, simulated). */
  invoke(request: NeutralEditingRequest): NeutralEditingOutput;
}

/** Error code aligned with the frozen v5 typed error literal (you-lab-owned). */
export const EDITING_UNSUPPORTED_CODE = "YOU_EDITOR_UNSUPPORTED";

/** Typed refusal thrown when an adapter is invoked with an unsupported format. */
export class UnsupportedEditingFormatError extends Error {
  readonly code = EDITING_UNSUPPORTED_CODE;
  constructor(adapterId: string, format: string, supported: readonly string[]) {
    super(
      `${EDITING_UNSUPPORTED_CODE}: adapter '${adapterId}' does not support format '${format}' (supported: ${supported.join(", ") || "none"})`,
    );
  }
}

/** Returns the unsupported formats of an adapter for a requested format ([] when supported). */
export function unsupportedEditingFormats(
  profile: EditingAdapterProfile,
  format: NeutralImportExportFormat,
): readonly string[] {
  return profile.supportedFormats.includes(format) ? [] : [format];
}

/** Typed refusal helper: throws when the request format is not supported. */
export function assertEditingRequestSupported(
  profile: EditingAdapterProfile,
  request: NeutralEditingRequest,
): void {
  const unsupported = unsupportedEditingFormats(profile, request.format);
  const first = unsupported[0];
  if (unsupported.length > 0 && first !== undefined) {
    throw new UnsupportedEditingFormatError(profile.id, first, profile.supportedFormats);
  }
}

/** sha-256 hex digest of string/bytes input (deterministic, no clock). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Opaque deterministic change-set id for (adapterId, requestId). */
export function neutralEditChangeSetId(adapterId: string, requestId: string): string {
  return `ecs-${fnv1a32(`${adapterId}|${requestId}`)}`;
}

/** Opaque content-store payload reference for one op of (adapterId, requestId, index). */
export function neutralEditOpPayloadRef(adapterId: string, requestId: string, index: number): string {
  return `content-store://you-lab/editing/${adapterId}/${requestId}/op-${index}`;
}

/** Decode a neutral change-set op payload back into its candidate operation. */
export function decodeEditOpPayload(
  op: NeutralEditChangeSetOp,
  payload: Record<string, unknown>,
): CandidateOperation {
  if (op.kind === "upsert_entity") {
    return { op: "upsert_entity", entity: payload.entity as NeutralEntity };
  }
  if (op.kind === "remove_entity") {
    return { op: "remove_entity", entityId: String(payload.entityId) };
  }
  return { op: "update_environment", environment: payload.environment as Partial<NeutralEnvironment> };
}

/**
 * Encode a candidate operation as a content-addressed op payload record.
 * The payload bytes are the canonical JSON of the returned record; the hash
 * of those bytes is the op's payloadHash (content-addressing law).
 */
export function encodeEditOpPayload(operation: CandidateOperation): Record<string, unknown> {
  if (operation.op === "upsert_entity") return { entity: operation.entity };
  if (operation.op === "remove_entity") return { entityId: operation.entityId };
  return { environment: operation.environment };
}

/** Apply a neutral change set to subject content (pure; used by tests/benchmarks). */
export function applyNeutralChangeSet(
  content: Readonly<Record<string, unknown>>,
  changeSet: NeutralEditChangeSet,
  payloadById: Readonly<Record<string, Record<string, unknown>>>,
): NeutralCanonicalState {
  const operations: CandidateOperation[] = [];
  for (const op of changeSet.ops) {
    const payload = payloadById[op.id];
    if (!payload) continue;
    operations.push(decodeEditOpPayload(op, payload));
  }
  const state: NeutralCanonicalState = {
    entities: (content.entities as readonly NeutralEntity[] | undefined) ?? [],
    environment: (content.environment as NeutralEnvironment | undefined) ?? {
      keyLightDirection: [0, 0, 0],
      ambientIntensity: 0,
      background: "",
    },
  };
  return applyCandidateOperations(state, operations);
}

/** Honest not-measured effort fields for simulated editing adapters. */
export function notMeasuredEditingEffortFields(): EditingEffortFields {
  return {
    effort: { kind: "not-measured", marker: "not-measured (simulated)" },
    latency: { kind: "not-measured", marker: "not-measured (simulated)" },
    cost: { kind: "not-measured", marker: "not-measured (simulated)" },
  };
}
