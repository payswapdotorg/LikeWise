// SINGLE seam to the frozen YOU contract v1+v2 (packages/shared/src/you/contract.ts).
//
// SEAM NOTE (W1C sandbox): importing "@zcode/shared" from packages/you-lab
// fails here (TS2307) because the workspace lockfile does not include you-lab
// yet — the TL registers the package and reconciles the lockfile at T1. Per
// the W1C work order, this module imports the frozen contract types through
// the relative path "../../shared/src/you/contract.js"; T1 normalizes this to
// the "@zcode/shared" public entry. This is the ONLY module in you-lab that
// touches the frozen contract (asserted by a test).
//
// Mapping is 1:1 by design: the neutral interchange shapes in
// adapters/editorAdapterSeam.ts were structurally aligned with the frozen
// SolutionEntity/SolutionEnvironmentState/SolutionPatchOperation shapes, and
// the W2C capture shapes (capture/captureAdapterSeam.ts) are structurally
// aligned with the frozen v2 CaptureModality/EvidenceRecord/EvidenceReview
// shapes, so the seam never redeclares or mutates contract semantics.

import type {
  AuthorType,
  CaptureModality,
  ConsentReference,
  EditorRecommendation,
  EvidencePrivacyClass,
  EvidenceRecord,
  EvidenceRetention,
  EvidenceReview,
  EvidenceReviewStatus,
  EvidenceType,
  ProvenanceRecord,
  SolutionEntity,
  SolutionPatchOperation,
  SolutionQualityMap,
} from "../../shared/src/you/contract.js";
import type { CandidateOperation, EditorArtifact, NeutralEntity } from "./adapters/editorAdapterSeam.js";
import type { CaptureObservation, NeutralCaptureModality } from "./capture/captureAdapterSeam.js";
import type { TechnologyRegistry } from "./technology/registry.js";
import type { EditorCapabilityProfile } from "./technology/editorCapability.js";

/**
 * Build a frozen-contract EditorRecommendation from a derived capability
 * profile. The rationale cites verified registry facts (license, risk) —
 * deterministic, provider-neutral, no invented claims.
 */
export function toEditorRecommendation(
  capability: EditorCapabilityProfile,
  registry: TechnologyRegistry,
): EditorRecommendation {
  const technology = registry.byId(capability.technologyId);
  const primaryFormat = capability.formatSupport.find((entry) => entry.write)?.format ?? "unknown";
  const licenseName = technology?.license.name ?? "unknown";
  const licenseSource = technology?.license.sourceUrl ?? "unknown";
  const tierWord =
    capability.integrationTier === 1 ? "native" : capability.integrationTier === 2 ? "embedded" : "external";
  const rationale =
    `${tierWord} editor candidate (integration tier ${capability.integrationTier}); editable domains: ` +
    `${capability.editableAttributeDomains.join(", ") || "none"}; round-trip risk ${capability.roundTripRisk}; ` +
    `license: ${licenseName} (source: ${licenseSource}); capability derivation: ${capability.derivedFrom}`;
  return {
    editorId: capability.technologyId,
    editorName: capability.editorName,
    rationale,
    exportFormat: primaryFormat,
  };
}

/** Map neutral candidate operations to frozen SolutionPatchOperation (1:1). */
export function toSolutionPatchOperations(
  operations: readonly CandidateOperation[],
): readonly SolutionPatchOperation[] {
  const out: SolutionPatchOperation[] = [];
  for (const operation of operations) {
    if (operation.op === "upsert_entity") {
      out.push({ op: "upsert_entity", entity: toSolutionEntity(operation.entity) });
    } else if (operation.op === "remove_entity") {
      out.push({ op: "remove_entity", entityId: operation.entityId });
    } else {
      out.push({ op: "update_environment", environment: operation.environment });
    }
  }
  return out;
}

function toSolutionEntity(entity: NeutralEntity): SolutionEntity {
  return {
    id: entity.id,
    kind: entity.kind,
    label: entity.label,
    transform: entity.transform,
    attributes: entity.attributes,
  };
}

/**
 * EditorArtifact -> frozen-contract-facing recommendation helper: a convenience
 * that derives the recommendation for the artifact's technology from its
 * derived capability profile (registry-backed, deterministic).
 */
export function recommendationForArtifact(
  artifact: EditorArtifact,
  capabilities: readonly EditorCapabilityProfile[],
  registry: TechnologyRegistry,
): EditorRecommendation | null {
  const capability = capabilities.find((entry) => entry.technologyId === artifact.technologyId);
  if (!capability) return null;
  return toEditorRecommendation(capability, registry);
}

// ---------------------------------------------------------------------------
// W2C: mapping onto the frozen v2 evidence/capture/consent contracts
//
// Adapter observations (provider-neutral, simulated) construct frozen
// EvidenceRecords and project deterministic qualityObservations onto the
// frozen SolutionQualityMap carried by EvidenceReview. The evidence service
// (Worker A lane) owns ids/consent/retention/state; this seam only maps 1:1.
// ---------------------------------------------------------------------------

/**
 * Evidence-identity context injected by the caller (the evidence application
 * service owns ids, consent, retention and provenance — never the adapter).
 * Content is referenced, never inlined: `contentRef` is an opaque store key
 * and `contentHash` binds the record to the stored bytes.
 */
export interface CaptureEvidenceContext {
  readonly evidenceId: string;
  readonly evidenceRequestId: string | null;
  readonly captureSessionId: string | null;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly privacyClass: EvidencePrivacyClass;
  readonly retention: EvidenceRetention;
  readonly consent: ConsentReference;
  /** ISO-8601 from the injected clock (fixture mode per FIXTURES.md). */
  readonly capturedAt: string;
  readonly provenance: ProvenanceRecord;
}

/**
 * Authored neutral-modality -> frozen EvidenceType mapping (1:1, fixed
 * table). Open members of the frozen EvidenceType union (e.g.
 * "reference-audio") are used where the frozen literals do not cover a
 * modality; values remain valid per the frozen union.
 */
const EVIDENCE_TYPE_BY_MODALITY: Readonly<Record<NeutralCaptureModality, EvidenceType>> = {
  image: "reference-image",
  video: "reference-video",
  depth: "measurement",
  audio: "reference-audio",
  measurement: "measurement",
  document: "document",
};

/**
 * Construct a frozen v2 EvidenceRecord from adapter observations. The record
 * describes the captured evidence the observations were derived FROM: the
 * modality and evidence type come from the observed payload, every identity
 * field comes from the injected context. Truth law: adapter observations are
 * simulated, so the constructed record stays `simulated: true` (the batch
 * type enforces this literally; a non-simulated path can never reach here).
 */
export function toEvidenceRecord(
  context: CaptureEvidenceContext,
  observations: readonly CaptureObservation[],
  modality: NeutralCaptureModality,
): EvidenceRecord {
  if (observations.length === 0) {
    throw new Error("toEvidenceRecord: refusing to construct an EvidenceRecord from zero observations");
  }
  if (context.contentRef.length === 0) {
    throw new Error("toEvidenceRecord: contentRef must reference stored content (content-addressed law)");
  }
  if (context.contentHash.length === 0) {
    throw new Error("toEvidenceRecord: contentHash must bind the record to the stored bytes");
  }
  return {
    id: context.evidenceId,
    evidenceRequestId: context.evidenceRequestId,
    captureSessionId: context.captureSessionId,
    evidenceType: EVIDENCE_TYPE_BY_MODALITY[modality],
    modality: modality as CaptureModality,
    contentRef: context.contentRef,
    contentHash: context.contentHash,
    privacyClass: context.privacyClass,
    retention: context.retention,
    consent: context.consent,
    capturedAt: context.capturedAt,
    provenance: context.provenance,
    simulated: true,
  };
}

/** Deterministic quality entry produced by the observation scorer. */
export interface QualityObservationEntry {
  /** Deficiency-class key, e.g. "capture.segmentation.person-iou". */
  readonly key: string;
  /** Fixture-defined score in [0, 1] (never a scientific claim). */
  readonly value: number;
}

/**
 * Project deterministic quality entries onto the frozen
 * SolutionQualityMap (the `qualityObservations` field of EvidenceReview).
 * Keys are emitted in sorted order (FIXTURES.md stable-ordering law); values
 * outside [0, 1] are rejected — never silently clamped.
 */
export function toQualityObservations(entries: readonly QualityObservationEntry[]): SolutionQualityMap {
  const out: Record<string, number> = {};
  for (const entry of [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    if (entry.key.length === 0) {
      throw new Error("toQualityObservations: empty quality key");
    }
    if (!Number.isFinite(entry.value) || entry.value < 0 || entry.value > 1) {
      throw new Error(`toQualityObservations: value for "${entry.key}" outside [0, 1]: ${entry.value}`);
    }
    out[entry.key] = entry.value;
  }
  return out;
}

/** Inputs for the frozen EvidenceReview construction (reviewer-owned). */
export interface EvidenceReviewConstruction {
  readonly id: string;
  readonly evidenceId: string;
  readonly reviewerType: AuthorType;
  readonly status: EvidenceReviewStatus;
  readonly notes: string;
  /** ISO-8601 from the injected clock. */
  readonly reviewedAt: string;
}

/**
 * Construct a frozen v2 EvidenceReview with projected qualityObservations
 * (deterministic, keyed by deficiency class; fixture-defined scores).
 */
export function toEvidenceReview(
  construction: EvidenceReviewConstruction,
  qualityEntries: readonly QualityObservationEntry[],
): EvidenceReview {
  return {
    id: construction.id,
    evidenceId: construction.evidenceId,
    reviewerType: construction.reviewerType,
    status: construction.status,
    qualityObservations: toQualityObservations(qualityEntries),
    notes: construction.notes,
    reviewedAt: construction.reviewedAt,
  };
}

