/* eslint-disable max-lines -- the single seam to the frozen YOU contract v1+v2+v3+v4+v5+v6+v7+v8+v9+v10+v11 is consolidated BY DESIGN: exactly one module maps every neutral you-lab shape onto the frozen contracts (the only-module law asserted by tests), so the full W1C/W2C/W3C/W4C/W5C/W6C/W7C/W8C/W9C/W10C/W11C mapping surface intentionally lives in this one file. */
// SINGLE seam to the frozen YOU contract v1+v2+v3+v4+v5+v6+v7+v8+v9+v10+v11
// (packages/shared/src/you/contract.ts).
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
// SolutionEntity/SolutionEnvironmentState/SolutionPatchOperation shapes, the
// W2C capture shapes (capture/captureAdapterSeam.ts) are structurally
// aligned with the frozen v2 CaptureModality/EvidenceRecord/EvidenceReview
// shapes, the W3C reconstruction shapes
// (reconstruction/reconstructionAdapterSeam.ts) with the frozen v3
// twin/reconstruction shapes, and the W4C render shapes
// (render/renderAdapterSeam.ts) with the frozen v4
// PerformanceTimeline/RenderJobSpec/RenderJobResult/RenderArtifact shapes,
// so the seam never redeclares or mutates contract semantics.

import type {
  AuthorType,
  CandidateVersion,
  CaptureModality,
  ConsentReference,
  EditChangeSet as FrozenEditChangeSet,
  EditChangeSetOp as FrozenEditChangeSetOp,
  EditorCapabilityProfile as ContractEditorCapabilityProfile,
  EditorRecommendation,
  EditingSession as FrozenEditingSession,
  EditingSessionStatus,
  EvidencePrivacyClass,
  EvidenceRecord,
  EvidenceRetention,
  EvidenceReview,
  EvidenceReviewStatus,
  EvidenceType,
  HtirDomainBlock,
  HtirDomainKind,
  ImportExportFormat,
  ImportExportResult as FrozenImportExportResult,
  ImportExportStatus,
  LearningRecord as FrozenLearningRecord,
  LearningRightUsage,
  LearningRights as FrozenLearningRights,
  LearningScope,
  LearningSignal as FrozenLearningSignal,
  LearningSignalKind,
  PerformanceTimeline,
  ProvenanceRecord,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  ReconstructionJobStatus,
  ReconstructionMethod,
  RenderArtifact,
  RenderJobResult,
  RenderJobSpec,
  RenderJobStatus,
  RoundTripBenchmarkReport as FrozenRoundTripBenchmarkReport,
  TwinDeficiency,
  TwinDeficiencyClass,
  TwinEvidenceBinding,
  TwinQualityState,
  TwinVersion,
  TwinVersionStatus,
  SolutionEntity,
  SolutionPatchOperation,
  SolutionQualityMap,
  AvatarSession as FrozenAvatarSession,
  AvatarSessionStatus,
  EmbodimentState,
  RealtimeChannelDescriptor as FrozenRealtimeChannelDescriptor,
  SoulBinding as FrozenSoulBinding,
  SoulRoutingProfile,
  ArenaExpertResult as FrozenArenaExpertResult,
  ArenaLearningPermission,
  ArenaProviderDescriptor as FrozenArenaProviderDescriptor,
  ArenaRetryPolicy as FrozenArenaRetryPolicy,
  ArenaRun as FrozenArenaRun,
  ArenaRunStatus,
  ArenaEscalationRef as FrozenArenaEscalationRef,
  ArenaEscalationStatus,
  AttemptedStrategy as FrozenAttemptedStrategy,
  CapabilityGap as FrozenCapabilityGap,
  CapabilityGapCategory,
  EscalationAuthorization as FrozenEscalationAuthorization,
  EscalationEligibility as FrozenEscalationEligibility,
  KnowledgeGapProjection as FrozenKnowledgeGapProjection,
  ToolGapProjection as FrozenToolGapProjection,
  FailureAtlasEntry as FrozenFailureAtlasEntry,
  LabArmKind,
  LabEvidenceManifest as FrozenLabEvidenceManifest,
  LabExperiment as FrozenLabExperiment,
  LabPromotionRecord as FrozenLabPromotionRecord,
  LabRun as FrozenLabRun,
  LabRunStatus,
  LabWorldDescriptor as FrozenLabWorldDescriptor,
  PipelineGenomeNode as FrozenPipelineGenomeNode,
  SearchLadderStep as FrozenSearchLadderStep,
  ProviderMatrixEntry as FrozenProviderMatrixEntry,
  CostLatencyBudget as FrozenCostLatencyBudget,
  ProductionEligibilityRecord as FrozenProductionEligibilityRecord,
  E2eJourneyRecord as FrozenE2eJourneyRecord,
  IncidentRunbookEntry as FrozenIncidentRunbookEntry,
  ConformanceAuditRecord as FrozenConformanceAuditRecord,
} from "../../shared/src/you/contract.js";
import type { CandidateOperation, EditorArtifact, NeutralEntity } from "./adapters/editorAdapterSeam.js";
import type { CaptureObservation, NeutralCaptureModality } from "./capture/captureAdapterSeam.js";
import type {
  NeutralDomainBlock,
  NeutralReconstructionEvidence,
  NeutralReconstructionRequest,
  ReconstructionAdapter,
  ReconstructionEffortFields,
  ReconstructionOutput,
} from "./reconstruction/reconstructionAdapterSeam.js";
import type {
  NeutralPerformanceTimeline,
  NeutralRenderArtifact,
  NeutralRenderRequest,
  RenderAdapter,
  RenderEffortFields,
  RenderOutput,
} from "./render/renderAdapterSeam.js";
import type { TechnologyRegistry } from "./technology/registry.js";
import type { EditorCapabilityProfile } from "./technology/editorCapability.js";
import type {
  EditingCapabilityProfile,
  NeutralEditChangeSet,
  NeutralEditingOutput,
  NeutralEditingRequest,
  NeutralEditorKind,
  NeutralImportExportFormat,
} from "./editing/editingAdapterSeam.js";
import type { EditingAdapter } from "./editing/editingAdapterSeam.js";
import type { CandidateRoundTripResult } from "./editing/roundTripRunner.js";
import type {
  LearningAdapter,
  NeutralLearningOutput,
  NeutralLearningRequest,
  NeutralLearningRights,
  NeutralLearningRightUsage,
  NeutralLearningScope,
  NeutralLearningSignalKind,
} from "./learning/learningAdapterSeam.js";
import type { CandidateLearningResult } from "./learning/learningRunner.js";
import type {
  NeutralEmbodimentState,
  NeutralSoulOutput,
  NeutralSoulRequest,
  NeutralSoulResponseRecord,
  NeutralSoulRoutingProfile,
  SoulAdapter,
} from "./soul/soulAdapterSeam.js";
import type { CandidateSoulResult } from "./soul/soulRunner.js";
import type { NeutralRealtimeChannel } from "./realtime/realtimeAdapterSeam.js";
import type {
  ArenaAdapter,
  NeutralArenaAuthorizationContext,
  NeutralArenaBackoffClass,
  NeutralArenaGapRecord,
  NeutralArenaInvocation,
  NeutralArenaLearningPermission,
  NeutralArenaOutput,
  NeutralArenaProviderDescriptor,
  NeutralArenaRetryLadder,
  NeutralArenaRunRecord,
  NeutralArenaRunStatus,
  NeutralCapabilityGapCategory,
  NeutralEscalationEligibility,
} from "./arena/arenaAdapterSeam.js";
import type { CandidateArenaResult } from "./arena/arenaRunner.js";
import type { NeutralKnowledgeGapProjection, NeutralToolGapProjection } from "./arena/gapProjections.js";
import type { NeutralFailureAtlasEntry } from "./research/failureAtlas.js";
import type { NeutralPipelineGenomeNode } from "./research/pipelineGenome.js";
import type { NeutralSearchLadderStep } from "./research/searchLadder.js";
import type {
  NeutralLabArmKind,
  NeutralLabEvidenceManifest,
  NeutralLabExperiment,
  NeutralLabRunRecord,
  NeutralLabRunStatus,
  PromotionDecisionEvidence,
  PromotionEvidenceReport,
} from "./research/promotionEvidence.js";
import type { NeutralLabWorldDescriptor } from "./research/worlds.js";
import type {
  NeutralCostLatencyBudget,
  NeutralProviderMatrixEntry,
  NeutralEcosystemOutput,
  NeutralEcosystemRequest,
  EcosystemAdapter,
  EcosystemRegion,
  ProviderMatrixRegistry,
} from "./ecosystem/providerMatrixSeam.js";
import type { ProductionEligibilityLedger, NeutralProductionEligibilityRecord } from "./ecosystem/eligibilityLedger.js";
import type { CandidateEcosystemResult } from "./ecosystem/ecosystemRunner.js";
import type { NeutralE2eJourneyRecord } from "./e2e/journeyHarness.js";
import type { NeutralIncidentRunbookEntry } from "./e2e/incidentRunbook.js";
import type { NeutralConformanceAuditRecord } from "./e2e/conformanceAudit.js";
import {
  INCIDENT_CLASS_NAMES,
  JOURNEY_STEP_IDS,
  LAUNCH_GATE_JOURNEY_LENGTH,
  journeyStepIndex,
} from "./e2e/journeySteps.js";
import { canonicalJson } from "./determinism.js";
import { sha256Hex } from "./arena/arenaAdapterSeam.js";

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

// ---------------------------------------------------------------------------
// W3C: mapping onto the frozen v3 twin/reconstruction contracts
//
// Reconstruction adapters (you-lab) are provider-neutral and simulated; the
// twin/reconstruction application service (Worker A lane) owns ids, consent,
// retention, status and provenance — never the adapter. The mappings below
// are 1:1 by design: the neutral reconstruction shapes
// (reconstruction/reconstructionAdapterSeam.ts) are structurally aligned
// with the frozen v3 ReconstructionJobSpec / ReconstructionJobResult /
// HtirDomainBlock / TwinVersion shapes, so the seam never redeclares or
// mutates contract semantics. Domain-block content is referenced, never
// inlined: the neutral payload bytes are DROPPED here (contentRef +
// contentHash only). Truth law: adapter outputs are simulated, so every
// constructed v3 shape stays `simulated: true`.
// ---------------------------------------------------------------------------

/**
 * Map a frozen v3 ReconstructionJobSpec onto the neutral adapter request.
 * Every evidence binding must resolve to exactly one evidence descriptor by
 * (id, contentHash) — an unresolved binding or hash mismatch is a typed
 * rejection, never a silent repair.
 */
export function toNeutralReconstructionRequest(
  spec: ReconstructionJobSpec,
  evidence: readonly NeutralReconstructionEvidence[],
): NeutralReconstructionRequest {
  if (spec.targetDomains.length === 0) {
    throw new Error("toNeutralReconstructionRequest: a reconstruction job requires at least one target domain");
  }
  const evidenceById = new Map<string, NeutralReconstructionEvidence>();
  for (const item of evidence) {
    if (evidenceById.has(item.evidenceId)) {
      throw new Error(`toNeutralReconstructionRequest: duplicate resolved evidence id ${item.evidenceId}`);
    }
    evidenceById.set(item.evidenceId, item);
  }
  const resolved: NeutralReconstructionEvidence[] = [];
  for (const binding of spec.evidenceBindings) {
    const match = evidenceById.get(binding.evidenceId);
    if (!match) {
      throw new Error(`toNeutralReconstructionRequest: evidence binding ${binding.evidenceId} has no resolved evidence`);
    }
    if (match.contentHash !== binding.evidenceContentHash) {
      throw new Error(`toNeutralReconstructionRequest: content-hash mismatch for evidence ${binding.evidenceId}`);
    }
    resolved.push(match);
    evidenceById.delete(binding.evidenceId);
  }
  if (evidenceById.size > 0) {
    const leftover = [...evidenceById.keys()].sort();
    throw new Error(`toNeutralReconstructionRequest: unresolved extra evidence: ${leftover.join(", ")}`);
  }
  return {
    requestId: spec.id,
    twinVersionId: spec.twinVersionId,
    method: spec.method as ReconstructionMethod,
    targetDomains: spec.targetDomains,
    evidence: resolved,
    submittedAt: spec.createdAt,
  };
}

/** Provenance context injected by the caller (the twin service owns it — never the adapter). */
export interface ReconstructionBlockContext {
  readonly provenance: ProvenanceRecord;
}

/**
 * Construct frozen v3 HtirDomainBlocks from neutral adapter blocks. The
 * payload bytes are dropped at the seam (content-addressed law: contentRef +
 * contentHash only). Malformed blocks are typed rejections — never silently
 * repaired.
 */
export function toHtirDomainBlocks(
  blocks: readonly NeutralDomainBlock[],
  context: ReconstructionBlockContext,
): readonly HtirDomainBlock[] {
  const out: HtirDomainBlock[] = [];
  for (const block of blocks) {
    if (block.domain.length === 0) {
      throw new Error("toHtirDomainBlocks: empty domain");
    }
    if (block.contentRef.length === 0) {
      throw new Error(`toHtirDomainBlocks: ${block.domain}: contentRef must reference stored content`);
    }
    if (!/^[0-9a-f]{64}$/.test(block.contentHash)) {
      throw new Error(`toHtirDomainBlocks: ${block.domain}: contentHash must be a sha-256 hex digest`);
    }
    if (!Number.isFinite(block.confidence) || block.confidence < 0 || block.confidence > 1) {
      throw new Error(`toHtirDomainBlocks: ${block.domain}: confidence outside [0, 1]`);
    }
    out.push({
      id: block.blockId,
      domain: block.domain as HtirDomainKind,
      contentRef: block.contentRef,
      contentHash: block.contentHash,
      confidence: block.confidence,
      simulated: block.simulated,
      provenance: context.provenance,
    });
  }
  return out;
}

/**
 * Project structured effort MetricFields onto the frozen v3
 * effortObservations record. Honest markers: not-measured fields carry the
 * explicit "not-measured (simulated)" marker; estimates carry simulated
 * markers + basis; only genuinely measured values may claim measured=true
 * (none exist in fixture mode).
 */
export function toEffortObservations(
  fields: ReconstructionEffortFields,
  producedBlockCount: number,
  evidenceBindingCount: number,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    domainBlocksProduced: producedBlockCount,
    evidenceBindingsProcessed: evidenceBindingCount,
    simulated: true,
  };
  appendMetricField(out, "computeEffort", fields.effort);
  appendMetricField(out, "latencyMs", fields.latency);
  appendMetricField(out, "costUnits", fields.cost);
  return out;
}

function appendMetricField(
  out: Record<string, string | number | boolean>,
  key: string,
  field: ReconstructionEffortFields["effort"],
): void {
  if (field.kind === "not-measured") {
    out[`${key}.measured`] = false;
    out[key] = field.marker;
  } else if (field.kind === "estimate") {
    out[`${key}.measured`] = false;
    out[`${key}.estimate`] = field.value;
    out[`${key}.unit`] = field.unit;
    out[`${key}.simulated`] = true;
  } else {
    out[`${key}.measured`] = true;
    out[key] = field.value;
    out[`${key}.unit`] = field.unit;
    out[`${key}.source`] = field.source;
  }
}

/** Inputs for the frozen ReconstructionJobResult construction (service-owned timing/provenance). */
export interface ReconstructionJobCompletion {
  readonly spec: ReconstructionJobSpec;
  readonly output: ReconstructionOutput;
  /** ISO-8601 from the injected clock. */
  readonly completedAt: string;
  readonly blockProvenance: ProvenanceRecord;
}

/**
 * Construct a frozen v3 ReconstructionJobResult from an adapter output.
 * Status maps 1:1 ("completed" | "failed"); failed jobs produce no domain
 * blocks and carry the failure reason in the effort observations.
 */
export function toReconstructionJobResult(completion: ReconstructionJobCompletion): ReconstructionJobResult {
  const { spec, output } = completion;
  if (output.adapterId.length === 0 || output.requestId !== spec.id) {
    throw new Error("toReconstructionJobResult: adapter output does not belong to this job spec");
  }
  const blocks =
    output.status === "completed" ? toHtirDomainBlocks(output.producedBlocks, { provenance: completion.blockProvenance }) : [];
  const observations: Record<string, string | number | boolean> = {
    ...toEffortObservations(output.effort, blocks.length, spec.evidenceBindings.length),
  };
  if (output.status === "failed") {
    observations["failureReason"] = output.failureReason ?? "unspecified";
  }
  return {
    jobId: spec.id,
    status: output.status as ReconstructionJobStatus,
    producedDomainBlocks: blocks,
    effortObservations: observations,
    completedAt: completion.completedAt,
    simulated: output.simulated,
  };
}

/**
 * Convenience: run a frozen v3 ReconstructionJobSpec through a
 * provider-neutral adapter and construct the frozen v3
 * ReconstructionJobResult (spec -> neutral request -> adapter -> frozen
 * result). Pure orchestration — no business logic; the adapter remains the
 * only reconstructor and the service remains the authority.
 */
export function reconstructThroughAdapter(
  spec: ReconstructionJobSpec,
  adapter: ReconstructionAdapter,
  evidence: readonly NeutralReconstructionEvidence[],
  completion: { readonly completedAt: string; readonly blockProvenance: ProvenanceRecord },
): ReconstructionJobResult {
  const request = toNeutralReconstructionRequest(spec, evidence);
  const output = adapter.reconstruct(request);
  return toReconstructionJobResult({ spec, output, ...completion });
}

/** Neutral twin-deficiency construction (mapped 1:1 onto the frozen shape). */
export interface TwinDeficiencyConstruction {
  readonly id: string;
  readonly deficiencyClass: string;
  readonly domain: string;
  readonly severity: number;
  readonly remediationHint: string | null;
  readonly remediationEvidenceRequestId: string | null;
}

/**
 * Construct a frozen v3 TwinQualityState with projected domain scores
 * (sorted keys, values in [0,1]) and typed deficiencies. Out-of-range
 * severities are typed rejections — never silently clamped.
 */
export function toTwinQualityState(
  domainScores: readonly QualityObservationEntry[],
  deficiencies: readonly TwinDeficiencyConstruction[],
  assessedAt: string,
): TwinQualityState {
  const frozen: TwinDeficiency[] = deficiencies.map((entry) => {
    if (entry.id.length === 0 || entry.deficiencyClass.length === 0 || entry.domain.length === 0) {
      throw new Error("toTwinQualityState: deficiency id/class/domain must be non-empty");
    }
    if (!Number.isFinite(entry.severity) || entry.severity < 0 || entry.severity > 1) {
      throw new Error(`toTwinQualityState: severity for "${entry.id}" outside [0, 1]`);
    }
    return {
      id: entry.id,
      deficiencyClass: entry.deficiencyClass as TwinDeficiencyClass,
      domain: entry.domain as HtirDomainKind,
      severity: entry.severity,
      remediationHint: entry.remediationHint,
      remediationEvidenceRequestId: entry.remediationEvidenceRequestId,
    };
  });
  return {
    domainScores: toQualityObservations(domainScores),
    deficiencies: frozen,
    assessedAt,
  };
}

/** Inputs for the frozen TwinVersion assembly (service-owned identity/state). */
export interface TwinAssemblyConstruction {
  readonly twinVersionId: string;
  readonly twinId: string;
  /** Monotonic per twin; immutable once published. */
  readonly version: number;
  readonly status: TwinVersionStatus;
  readonly evidenceBindings: readonly TwinEvidenceBinding[];
  readonly quality: TwinQualityState;
  /** ISO-8601 from the injected clock. */
  readonly createdAt: string;
  readonly provenance: ProvenanceRecord;
  readonly blockProvenance: ProvenanceRecord;
}

/**
 * Assemble a frozen v3 TwinVersion from adapter outputs (neutral domain
 * blocks). The version is immutable by construction (frozen shape); the
 * payload bytes never cross the seam.
 */
export function toTwinVersion(
  construction: TwinAssemblyConstruction,
  blocks: readonly NeutralDomainBlock[],
): TwinVersion {
  if (construction.twinId.length === 0) {
    throw new Error("toTwinVersion: twinId must be non-empty");
  }
  if (!Number.isInteger(construction.version) || construction.version < 1) {
    throw new Error(`toTwinVersion: version must be a positive integer (got ${construction.version})`);
  }
  return {
    id: construction.twinVersionId,
    twinId: construction.twinId,
    version: construction.version,
    status: construction.status,
    domainBlocks: toHtirDomainBlocks(blocks, { provenance: construction.blockProvenance }),
    evidenceBindings: construction.evidenceBindings,
    quality: construction.quality,
    createdAt: construction.createdAt,
    provenance: construction.provenance,
  };
}

// ---------------------------------------------------------------------------
// W4C: mapping onto the frozen v4 performance/render contracts
//
// Render adapters (you-lab) are provider-neutral and simulated; the
// performance/render application service (Worker A lane) owns ids, job
// lifecycle, artifact identity and event journaling — never the adapter.
// The mappings below are 1:1 by design: the neutral render shapes
// (render/renderAdapterSeam.ts) are structurally aligned with the frozen v4
// RenderJobSpec / RenderJobResult / RenderArtifact shapes, so the seam never
// redeclares or mutates contract semantics. The PERFORMANCE TIMELINE is
// consumed at this seam: the frozen PerformanceTimeline maps 1:1 onto the
// neutral timeline the adapter request carries. Artifact content is
// referenced, never inlined: the neutral payload bytes (and the fixture-only
// fidelity field) are DROPPED here (contentRef + contentHash only).
// Truth law: adapter outputs are simulated, so every constructed v4 shape
// stays `simulated: true`.
// ---------------------------------------------------------------------------

/**
 * Map a frozen v4 PerformanceTimeline onto the neutral timeline the render
 * adapter consumes. Malformed timelines (unordered cues, duplicate ids,
 * bad hashes, duration mismatch) are typed rejections — never silently
 * repaired. The frozen validators (shared/you/performanceTimeline) remain
 * the authority; this mirror guard keeps the seam refusal honest.
 */
export function toNeutralRenderTimeline(timeline: PerformanceTimeline): NeutralPerformanceTimeline {
  if (timeline.id.length === 0) {
    throw new Error("toNeutralRenderTimeline: timeline id must be non-empty");
  }
  if (!Number.isInteger(timeline.durationMs) || timeline.durationMs < 0) {
    throw new Error("toNeutralRenderTimeline: durationMs must be a non-negative integer");
  }
  const seen = new Set<string>();
  let previousStartMs: number | null = null;
  let maxEndMs = 0;
  for (let index = 0; index < timeline.cues.length; index++) {
    const cue = timeline.cues[index];
    if (!cue) continue;
    if (cue.id.length === 0 || seen.has(cue.id)) {
      throw new Error(`toNeutralRenderTimeline: cue ${index}: id must be unique and non-empty`);
    }
    seen.add(cue.id);
    if (typeof cue.track !== "string" || cue.track.length === 0) {
      throw new Error(`toNeutralRenderTimeline: cue ${index}: track must be a non-empty string`);
    }
    if (cue.endMs <= cue.startMs) {
      throw new Error(`toNeutralRenderTimeline: cue ${index}: endMs must be greater than startMs`);
    }
    if (cue.payloadRef.length === 0) {
      throw new Error(`toNeutralRenderTimeline: cue ${index}: payloadRef must be non-empty (content-addressed law)`);
    }
    if (!/^[0-9a-f]{64}$/.test(cue.payloadHash)) {
      throw new Error(`toNeutralRenderTimeline: cue ${index}: payloadHash must be a sha-256 hex digest`);
    }
    if (previousStartMs !== null && cue.startMs < previousStartMs) {
      throw new Error(`toNeutralRenderTimeline: cue ${index}: cues must be ordered by startMs`);
    }
    previousStartMs = cue.startMs;
    maxEndMs = Math.max(maxEndMs, cue.endMs);
  }
  if (timeline.durationMs !== maxEndMs) {
    throw new Error(`toNeutralRenderTimeline: durationMs ${timeline.durationMs} must equal the greatest cue endMs ${maxEndMs}`);
  }
  return {
    id: timeline.id,
    durationMs: timeline.durationMs,
    cues: timeline.cues.map((cue) => ({
      id: cue.id,
      track: cue.track,
      startMs: cue.startMs,
      endMs: cue.endMs,
      payloadRef: cue.payloadRef,
      payloadHash: cue.payloadHash,
    })),
  };
}

/**
 * Map a frozen v4 RenderJobSpec + the rendered performance's timeline onto
 * the neutral adapter request. The spec's method/outputKinds/parameters
 * pass through 1:1; the timeline is consumed at the seam. An empty
 * outputKinds set is a typed rejection (the service refuses empty specs
 * upstream; the seam never repairs).
 */
export function toNeutralRenderRequest(
  spec: RenderJobSpec,
  timeline: PerformanceTimeline,
): NeutralRenderRequest {
  if (spec.id.length === 0) {
    throw new Error("toNeutralRenderRequest: spec id must be non-empty");
  }
  if (spec.outputKinds.length === 0) {
    throw new Error("toNeutralRenderRequest: a render job requires at least one output kind");
  }
  return {
    requestId: spec.id,
    performanceId: spec.performanceId,
    method: spec.method,
    outputKinds: spec.outputKinds,
    parameters: spec.parameters,
    timeline: toNeutralRenderTimeline(timeline),
    submittedAt: spec.createdAt,
  };
}

/** Inputs for the frozen RenderArtifact construction (service-owned identity/timing). */
export interface RenderArtifactContext {
  readonly jobId: string;
  /** ISO-8601 from the injected clock. */
  readonly createdAt: string;
}

/**
 * Construct frozen v4 RenderArtifacts from neutral adapter artifacts. The
 * payload bytes AND the fixture-only fidelity field are dropped at the seam
 * (content-addressed law: contentRef + contentHash only). Malformed
 * artifacts are typed rejections — never silently repaired.
 */
export function toRenderArtifacts(
  artifacts: readonly NeutralRenderArtifact[],
  context: RenderArtifactContext,
): readonly RenderArtifact[] {
  if (context.jobId.length === 0) {
    throw new Error("toRenderArtifacts: jobId must be non-empty");
  }
  const out: RenderArtifact[] = [];
  for (const artifact of artifacts) {
    if (artifact.artifactId.length === 0) {
      throw new Error("toRenderArtifacts: artifactId must be non-empty");
    }
    if (artifact.kind.length === 0) {
      throw new Error("toRenderArtifacts: kind must be non-empty");
    }
    if (artifact.contentRef.length === 0) {
      throw new Error("toRenderArtifacts: contentRef must reference stored content (content-addressed law)");
    }
    if (!/^[0-9a-f]{64}$/.test(artifact.contentHash)) {
      throw new Error("toRenderArtifacts: contentHash must be a sha-256 hex digest");
    }
    if (!Number.isFinite(artifact.fidelity) || artifact.fidelity < 0 || artifact.fidelity > 1) {
      throw new Error("toRenderArtifacts: fidelity outside [0, 1] (fixture arithmetic law)");
    }
    out.push({
      id: artifact.artifactId,
      jobId: context.jobId,
      kind: artifact.kind,
      contentRef: artifact.contentRef,
      contentHash: artifact.contentHash,
      createdAt: context.createdAt,
      simulated: artifact.simulated,
    });
  }
  return out;
}

/**
 * Project structured render effort MetricFields onto the frozen v4
 * effortObservations record (same honest-marker layout as the W4A
 * notMeasuredRenderEffortObservations keys). Not-measured fields carry the
 * explicit "not-measured (simulated)" marker; estimates carry simulated
 * markers + basis; only genuinely measured values may claim measured=true
 * (none exist in fixture mode).
 */
export function toRenderEffortObservations(
  fields: RenderEffortFields,
  producedArtifactCount: number,
  timelineCueCount: number,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    artifactsProduced: producedArtifactCount,
    timelineCuesProcessed: timelineCueCount,
    simulated: true,
  };
  appendMetricField(out, "computeEffort", fields.effort);
  appendMetricField(out, "latencyMs", fields.latency);
  appendMetricField(out, "costUnits", fields.cost);
  return out;
}

/** Inputs for the frozen RenderJobResult construction (service-owned timing). */
export interface RenderJobCompletion {
  readonly spec: RenderJobSpec;
  readonly output: RenderOutput;
  /** Cue count of the performance timeline the job consumed (service-owned observation). */
  readonly timelineCueCount: number;
  /** ISO-8601 from the injected clock (artifact + completion timestamps). */
  readonly completedAt: string;
}

/**
 * Construct a frozen v4 RenderJobResult from an adapter output. Status maps
 * 1:1 ("completed" | "failed"); failed jobs produce no artifacts and carry
 * the failure reason in the effort observations.
 */
export function toRenderJobResult(completion: RenderJobCompletion): RenderJobResult {
  const { spec, output } = completion;
  if (output.adapterId.length === 0 || output.requestId !== spec.id) {
    throw new Error("toRenderJobResult: adapter output does not belong to this job spec");
  }
  const artifacts =
    output.status === "completed"
      ? toRenderArtifacts(output.producedArtifacts, { jobId: spec.id, createdAt: completion.completedAt })
      : [];
  const observations: Record<string, string | number | boolean> = {
    ...toRenderEffortObservations(output.effort, artifacts.length, completion.timelineCueCount),
  };
  if (output.status === "failed") {
    observations["failureReason"] = output.failureReason ?? "unspecified";
  }
  return {
    jobId: spec.id,
    status: output.status as RenderJobStatus,
    artifacts,
    effortObservations: observations,
    completedAt: completion.completedAt,
    simulated: output.simulated,
  };
}

/**
 * Convenience: run a frozen v4 RenderJobSpec through a provider-neutral
 * render adapter and construct the frozen v4 RenderJobResult (spec ->
 * neutral request -> adapter -> frozen result). Pure orchestration — no
 * business logic; the adapter remains the only renderer and the service
 * remains the authority.
 */
export function renderThroughAdapter(
  spec: RenderJobSpec,
  adapter: RenderAdapter,
  timeline: PerformanceTimeline,
  completion: { readonly completedAt: string },
): RenderJobResult {
  const request = toNeutralRenderRequest(spec, timeline);
  const output = adapter.render(request);
  return toRenderJobResult({ spec, output, timelineCueCount: timeline.cues.length, completedAt: completion.completedAt });
}


// ---------------------------------------------------------------------------
// W5C: seam mapping onto the frozen v5 editing/interchange contracts
// (EditingSession / EditChangeSet / CandidateVersion / ImportExportResult /
// RoundTripBenchmarkReport / v5 EditorCapabilityProfile). The neutral W5C
// shapes in editing/editingAdapterSeam.ts are structurally aligned with the
// frozen v5 shapes, so this mapping is 1:1 and never redeclares or mutates
// contract semantics. The import/export format mapping also happens here —
// the ONLY place neutral formats meet the frozen ImportExportFormat.
// ---------------------------------------------------------------------------

/** Map a neutral interchange format onto the frozen v5 ImportExportFormat (1:1, validated). */
export function mapImportExportFormat(format: NeutralImportExportFormat): ImportExportFormat {
  if (format.length === 0) {
    throw new Error("mapImportExportFormat: empty format (truth law — refusing to map an unaddressed format)");
  }
  return format;
}

/** Map a neutral editor kind onto the frozen v5 EditorKind (1:1, validated). */
export function mapEditorKind(kind: NeutralEditorKind): "native" | "embedded" | "external" {
  if (kind === "native" || kind === "embedded" || kind === "external") {
    // The neutral open union (string & {}) does not narrow through === on
    // its literal members; the guard above guarantees the cast is sound.
    return kind as "native" | "embedded" | "external";
  }
  throw new Error(`mapEditorKind: neutral kind "${kind}" has no frozen v5 mapping (open-union extension requires a TL contract update)`);
}

/**
 * Build a frozen v5 EditorCapabilityProfile from a derived neutral editing
 * capability profile (researched data — never a runtime authority).
 */
export function toFrozenEditorCapabilityProfile(profile: EditingCapabilityProfile): ContractEditorCapabilityProfile {
  return {
    id: profile.id,
    editorKind: mapEditorKind(profile.editorKind),
    displayName: profile.displayName,
    supportsFormats: profile.supportsFormats.map(mapImportExportFormat),
    roundTripSafe: profile.roundTripSafe,
    notes: `${profile.notes} (derivedFrom: ${profile.derivedFrom})`,
  };
}

/** Inputs for frozen v5 EditingSession construction (service-owned identity/timing). */
export interface EditingSessionConstruction {
  readonly sessionId: string;
  readonly subjectArtifactId: string;
  readonly editorKind: NeutralEditorKind;
  readonly openedAt: string;
  readonly status?: EditingSessionStatus;
}

/** Map a neutral editing session construction onto the frozen v5 EditingSession. */
export function toFrozenEditingSession(construction: EditingSessionConstruction): FrozenEditingSession {
  if (construction.sessionId.length === 0) throw new Error("toFrozenEditingSession: empty sessionId");
  if (construction.subjectArtifactId.length === 0) throw new Error("toFrozenEditingSession: empty subjectArtifactId");
  return {
    id: construction.sessionId,
    subjectArtifactId: construction.subjectArtifactId,
    editorKind: mapEditorKind(construction.editorKind),
    openedAt: construction.openedAt,
    status: construction.status ?? "open",
  };
}

/** Map a neutral edit change set onto the frozen v5 EditChangeSet (ops 1:1, hash-validated). */
export function toFrozenEditChangeSet(changeSet: NeutralEditChangeSet): FrozenEditChangeSet {
  if (changeSet.id.length === 0) throw new Error("toFrozenEditChangeSet: empty changeSet id");
  if (changeSet.sessionId.length === 0) throw new Error("toFrozenEditChangeSet: empty sessionId");
  const ops: FrozenEditChangeSetOp[] = changeSet.ops.map((op) => {
    if (op.id.length === 0) throw new Error("toFrozenEditChangeSet: empty op id");
    if (!/^[0-9a-f]{64}$/.test(op.payloadHash)) {
      throw new Error(`toFrozenEditChangeSet: op ${op.id} payloadHash is not sha-256 hex (content-addressing law)`);
    }
    return {
      id: op.id,
      kind: op.kind,
      payloadRef: op.payloadRef,
      payloadHash: op.payloadHash,
    };
  });
  return {
    id: changeSet.id,
    sessionId: changeSet.sessionId,
    ops,
    createdAt: changeSet.createdAt,
  };
}

/** Inputs for frozen v5 CandidateVersion construction (lineage + content addressing). */
export interface CandidateVersionConstruction {
  readonly candidateVersionId: string;
  readonly changeSetId: string;
  readonly parentVersionId: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly proposedAt: string;
}

/** Build a frozen v5 CandidateVersion from the artifact-lineage construction. */
export function toFrozenCandidateVersion(construction: CandidateVersionConstruction): CandidateVersion {
  if (construction.candidateVersionId.length === 0) throw new Error("toFrozenCandidateVersion: empty id");
  if (construction.changeSetId.length === 0) throw new Error("toFrozenCandidateVersion: empty changeSetId");
  if (construction.parentVersionId.length === 0) throw new Error("toFrozenCandidateVersion: empty parentVersionId");
  if (!/^[0-9a-f]{64}$/.test(construction.contentHash)) {
    throw new Error("toFrozenCandidateVersion: contentHash is not sha-256 hex (content-addressing law)");
  }
  return {
    id: construction.candidateVersionId,
    changeSetId: construction.changeSetId,
    parentVersionId: construction.parentVersionId,
    contentRef: construction.contentRef,
    contentHash: construction.contentHash,
    proposedAt: construction.proposedAt,
    simulated: true, // truth law: adapter outputs are simulated round trips
  };
}

/** Inputs for frozen v5 ImportExportResult construction. */
export interface ImportExportConstruction {
  readonly id: string;
  readonly sessionId: string | null;
  readonly format: NeutralImportExportFormat;
  readonly status: ImportExportStatus;
  readonly contentRef: string | null;
  readonly contentHash: string | null;
  readonly completedAt: string;
}

/** Build a frozen v5 ImportExportResult (format interchange outcome). */
export function toFrozenImportExportResult(construction: ImportExportConstruction): FrozenImportExportResult {
  if (construction.id.length === 0) throw new Error("toFrozenImportExportResult: empty id");
  if (construction.contentHash !== null && !/^[0-9a-f]{64}$/.test(construction.contentHash)) {
    throw new Error("toFrozenImportExportResult: contentHash is not sha-256 hex (content-addressing law)");
  }
  if (construction.status === "succeeded" && (construction.contentRef === null || construction.contentHash === null)) {
    throw new Error("toFrozenImportExportResult: succeeded interchange must carry contentRef + contentHash");
  }
  return {
    id: construction.id,
    sessionId: construction.sessionId,
    format: mapImportExportFormat(construction.format),
    status: construction.status,
    contentRef: construction.contentRef,
    contentHash: construction.contentHash,
    completedAt: construction.completedAt,
    simulated: true, // truth law: fixture-mode interchange stays labeled
  };
}

/** Honest effort observations for a round-trip result (structured not-measured markers). */
export function toRoundTripEffortObservations(
  result: CandidateRoundTripResult,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    fixtureCount: result.fixtureScores.length,
    simulated: true,
  };
  appendMetricField(out, "roundTripEffort", result.effort);
  appendMetricField(out, "latencyMs", result.latency);
  appendMetricField(out, "costUnits", result.cost);
  return out;
}

/** Project a benchmark candidate result onto the frozen v5 RoundTripBenchmarkReport. */
export function toFrozenRoundTripBenchmarkReport(result: CandidateRoundTripResult): FrozenRoundTripBenchmarkReport {
  return {
    editorId: result.candidateId,
    format: mapImportExportFormat(result.format as NeutralImportExportFormat),
    fidelityScore: result.overallFidelityScore,
    effortObservations: toRoundTripEffortObservations(result),
    simulated: true, // truth law: computed fixture objectives, never measurements
  };
}

/** Full W5C path: invoke the editing adapter and construct the frozen v5 shapes. */
export function editingThroughAdapter(
  adapter: EditingAdapter,
  request: NeutralEditingRequest,
  completion: {
    readonly subjectArtifactId: string;
    readonly openedAt: string;
    readonly candidateVersionId: string;
    readonly parentVersionId: string;
    readonly proposedAt: string;
  },
): { readonly session: FrozenEditingSession; readonly changeSet: FrozenEditChangeSet; readonly candidateVersion: CandidateVersion; readonly output: NeutralEditingOutput } {
  const output = adapter.invoke(request);
  const session = toFrozenEditingSession({
    sessionId: request.editingSessionId,
    subjectArtifactId: completion.subjectArtifactId,
    editorKind: adapter.profile.editorKind,
    openedAt: completion.openedAt,
    status: "committed",
  });
  const changeSet = toFrozenEditChangeSet(output.changeSet);
  const candidateVersion = toFrozenCandidateVersion({
    candidateVersionId: completion.candidateVersionId,
    changeSetId: changeSet.id,
    parentVersionId: completion.parentVersionId,
    contentRef: `content-store://you-lab/editing/${adapter.profile.id}/${request.requestId}`,
    contentHash: output.editedContentHash,
    proposedAt: completion.proposedAt,
  });
  return { session, changeSet, candidateVersion, output };
}


// ---------------------------------------------------------------------------
// W6C: seam mapping onto the frozen v6 learning contracts (LearningSignal /
// LearningRecord / LearningRights / LearningSignalKind / LearningRightUsage
// and the v1-common LearningScope). The neutral W6C shapes in
// learning/learningAdapterSeam.ts are structurally aligned with the frozen
// v6 shapes, so this mapping is 1:1 and never redeclares or mutates contract
// semantics. The learning scope / signal-kind / usage-class mappings also
// happen here — the ONLY place neutral learning shapes meet the frozen v6
// literals. RIGHTS LAW: learning rights are threaded from the injected
// context (adapters never mint consent — enforced on the full path below);
// records without rights are inert. Adapter outputs are always "candidate"
// records — the validation ladder belongs to the learning service (W6A).
// ---------------------------------------------------------------------------

/** Map a neutral learning scope onto the frozen v1/v6 LearningScope (1:1, validated). */
export function mapLearningScope(scope: NeutralLearningScope): LearningScope {
  if (scope.length === 0) {
    throw new Error("mapLearningScope: empty scope (truth law — refusing to map an unaddressed scope)");
  }
  if (
    scope === "GLOBAL" || scope === "TENANT" || scope === "APPLICATION" || scope === "PROJECT" ||
    scope === "USER" || scope === "TWIN" || scope === "ASSET" || scope === "TASK"
  ) {
    // The neutral open union (string & {}) does not narrow through === on
    // its literal members; the guard above guarantees the cast is sound.
    return scope as LearningScope;
  }
  throw new Error(`mapLearningScope: neutral scope "${scope}" has no frozen v6 mapping (open-union extension requires a TL contract update)`);
}

/** Map a neutral learning signal kind onto the frozen v6 LearningSignalKind (1:1, validated). */
export function mapLearningSignalKind(kind: NeutralLearningSignalKind): LearningSignalKind {
  if (kind.length === 0) {
    throw new Error("mapLearningSignalKind: empty kind (truth law — refusing to map an unaddressed kind)");
  }
  if (
    kind === "feedback" || kind === "manual-takeover" || kind === "edit-session" ||
    kind === "expert-intervention" || kind === "repeated-intent" || kind === "capability-gap"
  ) {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return kind as LearningSignalKind;
  }
  throw new Error(`mapLearningSignalKind: neutral kind "${kind}" has no frozen v6 mapping (open-union extension requires a TL contract update)`);
}

/** Map a neutral learning usage class onto the frozen v6 LearningRightUsage (1:1, validated). */
export function mapLearningRightUsage(usage: NeutralLearningRightUsage): LearningRightUsage {
  if (usage.length === 0) {
    throw new Error("mapLearningRightUsage: empty usage class (truth law — refusing to map an unaddressed usage)");
  }
  if (
    usage === "organization-improvement" || usage === "tool-selection" || usage === "editor-selection" ||
    usage === "pipeline-improvement" || usage === "capability-gap-analysis" || usage === "personalization"
  ) {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return usage as LearningRightUsage;
  }
  throw new Error(`mapLearningRightUsage: neutral usage "${usage}" has no frozen v6 mapping (open-union extension requires a TL contract update)`);
}

/** Map injected neutral learning rights onto the frozen v6 LearningRights (threaded, never minted). */
export function toFrozenLearningRights(rights: NeutralLearningRights): FrozenLearningRights {
  const usage = rights.usage.map(mapLearningRightUsage);
  const paired = (rights.consentRef.length > 0) === (rights.consentHash.length > 0);
  if (!paired) {
    throw new Error("toFrozenLearningRights: unpaired consent binding — consentRef and consentHash must be carried together (inert grants carry both empty; the wave-2 consent authority has no half-bound grants)");
  }
  if (rights.consentRef.length > 0 && usage.length === 0) {
    throw new Error("toFrozenLearningRights: bound rights grant without usage classes (a consent-bound grant must sanction at least one usage class)");
  }
  return {
    usage,
    consentRef: rights.consentRef,
    consentHash: rights.consentHash,
    expiresAt: rights.expiresAt,
  };
}

/** Inputs for frozen v6 LearningSignal construction (service-owned identity/timing). */
export interface LearningSignalConstruction {
  readonly id: string;
  readonly kind: NeutralLearningSignalKind;
  readonly scope: NeutralLearningScope;
  readonly subjectRef: string | null;
  /** Content-addressed evidence refs — never inlined, never empty, no duplicates, no whitespace padding. */
  readonly evidenceRefs: readonly string[];
  readonly capturedAt: string;
}

/** Build a frozen v6 LearningSignal from the construction (evidence never inlined). */
export function toFrozenLearningSignal(construction: LearningSignalConstruction): FrozenLearningSignal {
  if (construction.id.length === 0) throw new Error("toFrozenLearningSignal: empty id");
  if (construction.evidenceRefs.length === 0) {
    throw new Error("toFrozenLearningSignal: empty evidenceRefs (a learning signal carries at least one content-addressed evidence ref)");
  }
  const seen = new Set<string>();
  for (const ref of construction.evidenceRefs) {
    if (ref.length === 0 || ref.trim() !== ref) {
      throw new Error("toFrozenLearningSignal: evidence refs must be non-empty and carry no surrounding whitespace");
    }
    if (seen.has(ref)) {
      throw new Error(`toFrozenLearningSignal: duplicate evidence ref ${ref}`);
    }
    seen.add(ref);
  }
  return {
    id: construction.id,
    kind: mapLearningSignalKind(construction.kind),
    scope: mapLearningScope(construction.scope),
    subjectRef: construction.subjectRef,
    evidenceRefs: [...construction.evidenceRefs],
    capturedAt: construction.capturedAt,
    simulated: true, // truth law: fixture learning stays labeled simulated
  };
}

/** Inputs for frozen v6 LearningRecord construction (content addressing + threaded rights). */
export interface LearningRecordConstruction {
  readonly recordId: string;
  readonly signalId: string;
  readonly scope: NeutralLearningScope;
  readonly contentRef: string;
  readonly contentHash: string;
  /** Injected rights context — threaded verbatim, never minted here. */
  readonly rights: NeutralLearningRights;
  readonly validatedAt: string;
}

/** Build a frozen v6 LearningRecord candidate from the construction (sha-256 law, status "candidate"). */
export function toFrozenLearningRecord(construction: LearningRecordConstruction): FrozenLearningRecord {
  if (construction.recordId.length === 0) throw new Error("toFrozenLearningRecord: empty recordId");
  if (construction.signalId.length === 0) throw new Error("toFrozenLearningRecord: empty signalId");
  if (construction.contentRef.length === 0) throw new Error("toFrozenLearningRecord: empty contentRef");
  if (!/^[0-9a-f]{64}$/.test(construction.contentHash)) {
    throw new Error("toFrozenLearningRecord: contentHash is not sha-256 hex (content-addressing law)");
  }
  return {
    id: construction.recordId,
    signalId: construction.signalId,
    status: "candidate", // adapter outputs are candidates — the validation ladder belongs to the learning service
    scope: mapLearningScope(construction.scope),
    contentRef: construction.contentRef,
    contentHash: construction.contentHash,
    rights: toFrozenLearningRights(construction.rights),
    validatedAt: construction.validatedAt,
    supersededById: null, // supersession linkage is service-owned append-only state
    simulated: true, // truth law: adapter outputs are simulated learning
  };
}

/** Honest effort observations for a learning benchmark result (structured not-measured markers). */
export function toLearningEffortObservations(
  result: CandidateLearningResult,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    fixtureCount: result.fixtureScores.length,
    simulated: true,
  };
  appendMetricField(out, "learningEffort", result.effort);
  appendMetricField(out, "latencyMs", result.latency);
  appendMetricField(out, "costUnits", result.cost);
  return out;
}

/**
 * Full W6C path: invoke the learning adapter and construct the frozen v6
 * shapes (neutral signal + candidate scope -> adapter.learn() -> frozen
 * LearningSignal + LearningRecord candidates). Rights are threaded from the
 * injected request context and adapter-minted rights are refused; candidate
 * records inherit the signal scope (the v6/W6A law). Pure orchestration —
 * no business logic; the adapter remains the only learner and the service
 * remains the authority.
 */
export function learningThroughAdapter(
  adapter: LearningAdapter,
  request: NeutralLearningRequest,
  completion: {
    /** Service-owned signal capture timestamp (injected clock). */
    readonly capturedAt: string;
    /** Service-owned candidate creation moment (validatedAt while candidate). */
    readonly validatedAt: string;
  },
): { readonly signal: FrozenLearningSignal; readonly records: readonly FrozenLearningRecord[]; readonly output: NeutralLearningOutput } {
  const output = adapter.learn(request);
  const signal = toFrozenLearningSignal({
    id: request.signal.id,
    kind: request.signal.kind,
    scope: request.signal.scope,
    subjectRef: request.signal.subjectRef,
    evidenceRefs: request.signal.evidenceRefs,
    capturedAt: completion.capturedAt,
  });
  const records: FrozenLearningRecord[] = [];
  for (const candidate of output.candidates) {
    if (candidate.scope !== request.signal.scope) {
      throw new Error(`learningThroughAdapter: candidate ${candidate.id} scope "${candidate.scope}" diverges from the signal scope (v6 law: learning records inherit the signal scope)`);
    }
    if (canonicalJson(candidate.rights) !== canonicalJson(request.rights)) {
      throw new Error(`learningThroughAdapter: candidate ${candidate.id} rights diverge from the injected context (rights law — adapters never mint consent)`);
    }
    records.push(
      toFrozenLearningRecord({
        recordId: candidate.id,
        signalId: signal.id,
        scope: signal.scope,
        contentRef: candidate.contentRef,
        contentHash: candidate.contentHash,
        rights: request.rights,
        validatedAt: completion.validatedAt,
      }),
    );
  }
  return { signal, records, output };
}

// ---------------------------------------------------------------------------
// W7C: seam mapping onto the frozen v7 embodiment contracts (SoulBinding /
// SoulRoutingProfile / EmbodimentState / AvatarSession /
// RealtimeChannelDescriptor). The neutral W7C shapes in
// soul/soulAdapterSeam.ts and realtime/realtimeAdapterSeam.ts are
// structurally aligned with the frozen v7 shapes, so this mapping is 1:1
// and never redeclares or mutates contract semantics. The routing-profile
// and embodiment-state mappings also happen here — the ONLY place neutral
// soul shapes meet the frozen v7 literals. IDENTITY LAW: response records
// thread the request's binding/request identity (adapters never mint
// identity — enforced on the full path below). PROJECTION LAW: the
// embodiment-state ladder is a projection, never an authority (the frozen
// v7 law) — the session state below is derived from the adapter's
// projected response states. TRUTH LAW: fixture avatar sessions stay
// `simulated: true`.
// ---------------------------------------------------------------------------

/** Map a neutral routing profile onto the frozen v7 SoulRoutingProfile (1:1, validated). */
export function mapSoulRoutingProfile(profile: NeutralSoulRoutingProfile): SoulRoutingProfile {
  if (profile.length === 0) {
    throw new Error("mapSoulRoutingProfile: empty routing profile (truth law — refusing to map an unaddressed route)");
  }
  if (profile === "system-one" || profile === "system-two") {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return profile as SoulRoutingProfile;
  }
  throw new Error(`mapSoulRoutingProfile: neutral profile "${profile}" has no frozen v7 mapping (routing profiles are system-one/system-two; extension requires a TL contract update)`);
}

/** Map a neutral embodiment state onto the frozen v7 EmbodimentState (1:1 across the nine-state ladder, validated). */
export function mapEmbodimentState(state: NeutralEmbodimentState): EmbodimentState {
  if (state.length === 0) {
    throw new Error("mapEmbodimentState: empty embodiment state (truth law — refusing to map an unaddressed state)");
  }
  if (
    state === "listening" || state === "reading" || state === "typing" || state === "thinking" ||
    state === "tool_use" || state === "speaking" || state === "interrupted" || state === "idle" ||
    state === "unavailable"
  ) {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return state as EmbodimentState;
  }
  throw new Error(`mapEmbodimentState: neutral state "${state}" has no frozen v7 mapping (the nine-state ladder is frozen; extension requires a TL contract update)`);
}

/** Inputs for frozen v7 SoulBinding construction (provider-neutral; model refs opaque). */
export interface SoulBindingConstruction {
  readonly id: string;
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: NeutralSoulRoutingProfile;
  readonly capabilities: readonly string[];
}

/** Build a frozen v7 SoulBinding from the construction (validated 1:1 mapping). */
export function toFrozenSoulBinding(construction: SoulBindingConstruction): FrozenSoulBinding {
  if (construction.id.length === 0) throw new Error("toFrozenSoulBinding: empty id");
  if (construction.providerKind.length === 0) throw new Error("toFrozenSoulBinding: empty providerKind (the binding names its provider kind)");
  if (construction.modelRef.length === 0) throw new Error("toFrozenSoulBinding: empty modelRef (model references are opaque but never empty)");
  for (const capability of construction.capabilities) {
    if (capability.length === 0) throw new Error("toFrozenSoulBinding: empty capability entry");
  }
  return {
    id: construction.id,
    providerKind: construction.providerKind,
    modelRef: construction.modelRef,
    routingProfile: mapSoulRoutingProfile(construction.routingProfile),
    capabilities: [...construction.capabilities],
  };
}

/** Inputs for frozen v7 AvatarSession construction (service-owned identity/timing). */
export interface AvatarSessionConstruction {
  readonly sessionId: string;
  readonly bodyId: string;
  readonly soulBindingId: string;
  readonly status: AvatarSessionStatus;
  readonly state: NeutralEmbodimentState;
  readonly openedAt: string;
  /** null while the session is open; required when status is "closed". */
  readonly closedAt: string | null;
}

/** Build a frozen v7 AvatarSession from the construction (truth law: simulated stays labeled). */
export function toFrozenAvatarSession(construction: AvatarSessionConstruction): FrozenAvatarSession {
  if (construction.sessionId.length === 0) throw new Error("toFrozenAvatarSession: empty sessionId");
  if (construction.bodyId.length === 0) throw new Error("toFrozenAvatarSession: empty bodyId (a Body possesses the session)");
  if (construction.soulBindingId.length === 0) throw new Error("toFrozenAvatarSession: empty soulBindingId (a Soul possesses the Body)");
  if (construction.status !== "active" && construction.status !== "suspended" && construction.status !== "closed") {
    throw new Error(`toFrozenAvatarSession: unknown status "${construction.status}" (active/suspended/closed)`);
  }
  if (construction.status === "closed" && (construction.closedAt === null || construction.closedAt.length === 0)) {
    throw new Error("toFrozenAvatarSession: a closed session carries a non-empty closedAt");
  }
  if (construction.status !== "closed" && construction.closedAt !== null) {
    throw new Error("toFrozenAvatarSession: an open/suspended session carries closedAt null (closing is service-owned append-only state)");
  }
  if (construction.openedAt.length === 0) throw new Error("toFrozenAvatarSession: empty openedAt");
  return {
    id: construction.sessionId,
    bodyId: construction.bodyId,
    soulBindingId: construction.soulBindingId,
    status: construction.status,
    state: mapEmbodimentState(construction.state),
    openedAt: construction.openedAt,
    closedAt: construction.closedAt,
    simulated: true, // truth law: fixture avatar sessions stay labeled simulated
  };
}

/** Build a frozen v7 RealtimeChannelDescriptor from a neutral channel (content-addressing law). */
export function toFrozenRealtimeChannelDescriptor(channel: NeutralRealtimeChannel): FrozenRealtimeChannelDescriptor {
  if (channel.id.length === 0) throw new Error("toFrozenRealtimeChannelDescriptor: empty id");
  if (channel.kind.length === 0) throw new Error("toFrozenRealtimeChannelDescriptor: empty kind");
  if (channel.streamRef.length === 0) throw new Error("toFrozenRealtimeChannelDescriptor: empty streamRef (stream references are content-addressed, never inlined)");
  if (!/^[0-9a-f]{64}$/.test(channel.streamHash)) {
    throw new Error("toFrozenRealtimeChannelDescriptor: streamHash is not sha-256 hex (content-addressing law)");
  }
  if (channel.latencyClass.length === 0) throw new Error("toFrozenRealtimeChannelDescriptor: empty latencyClass");
  return {
    id: channel.id,
    kind: channel.kind,
    streamRef: channel.streamRef,
    streamHash: channel.streamHash,
    latencyClass: channel.latencyClass,
  };
}

/** Honest effort observations for a soul benchmark result (structured not-measured markers). */
export function toSoulEffortObservations(
  result: CandidateSoulResult,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    fixtureCount: result.fixtureScores.length,
    simulated: true,
  };
  appendMetricField(out, "soulEffort", result.effort);
  appendMetricField(out, "latencyMs", result.latency);
  appendMetricField(out, "costUnits", result.cost);
  return out;
}

/**
 * Full W7C path: invoke the soul adapter and construct the frozen v7 shapes
 * (neutral binding + routed prompt -> adapter.invoke() -> frozen SoulBinding
 * + AvatarSession + content-addressed response records). IDENTITY LAW:
 * response records must thread the request's binding/request identity — an
 * adapter minting records for another binding is refused. PROJECTION LAW:
 * the session state is the projected embodiment state of the last response
 * record (a projection, never an authority; no response records project to
 * "idle"). Pure orchestration — no business logic; the adapter remains the
 * only soul and the embodiment service remains the authority (W7A).
 */
export function soulThroughAdapter(
  adapter: SoulAdapter,
  request: NeutralSoulRequest,
  session: {
    /** Service-owned avatar session identity (injected). */
    readonly sessionId: string;
    /** The Body possessed by the Soul (injected). */
    readonly bodyId: string;
    /** Service-owned session-open moment (injected clock). */
    readonly openedAt: string;
  },
): {
  readonly binding: FrozenSoulBinding;
  readonly avatarSession: FrozenAvatarSession;
  readonly records: readonly NeutralSoulResponseRecord[];
  readonly output: NeutralSoulOutput;
} {
  const output = adapter.invoke(request);
  const binding = toFrozenSoulBinding({
    id: request.binding.id,
    providerKind: request.binding.providerKind,
    modelRef: request.binding.modelRef,
    routingProfile: request.binding.routingProfile,
    capabilities: request.binding.capabilities,
  });
  for (const record of output.records) {
    if (record.bindingId !== request.binding.id) {
      throw new Error(`soulThroughAdapter: record ${record.id} bindingId "${record.bindingId}" diverges from the request binding (identity law — adapters never mint binding identity)`);
    }
    if (record.requestId !== request.requestId) {
      throw new Error(`soulThroughAdapter: record ${record.id} requestId "${record.requestId}" diverges from the request (identity law — adapters never mint request identity)`);
    }
    // every record's routing profile must be a valid frozen v7 literal
    mapSoulRoutingProfile(record.routingProfile);
    // every record's projected embodiment state must be a valid frozen v7 literal
    mapEmbodimentState(record.embodimentState);
  }
  const lastRecord = output.records[output.records.length - 1];
  const avatarSession = toFrozenAvatarSession({
    sessionId: session.sessionId,
    bodyId: session.bodyId,
    soulBindingId: binding.id,
    status: "active",
    state: lastRecord?.embodimentState ?? "idle",
    openedAt: session.openedAt,
    closedAt: null,
  });
  return { binding, avatarSession, records: output.records, output };
}

// ---------------------------------------------------------------------------
// W8C: seam mapping onto the frozen v8 arena contracts (CapabilityGap /
// ArenaRun / ArenaRetryPolicy / EscalationAuthorization /
// ArenaProviderDescriptor / ToolGapProjection / KnowledgeGapProjection).
// The neutral W8C shapes in arena/arenaAdapterSeam.ts and
// arena/gapProjections.ts are structurally aligned with the frozen v8
// shapes, so this mapping is 1:1 and never redeclares or mutates contract
// semantics. The category/eligibility/status/learning-permission/backoff
// mappings also happen here — the ONLY place neutral arena shapes meet the
// frozen v8 literals. IDENTITY LAW: run records thread the invocation's
// gap identity and the output's request identity (adapters never mint
// identity — enforced on the full path below). GAP PERSISTENCE LAW: the
// gap is an immutable input; run records map append-only; projections are
// derived, never authoritative. TRUTH LAW: fixture arena runs stay
// `simulated: true`.
// ---------------------------------------------------------------------------

/** Map a neutral gap category onto the frozen v1/v8 CapabilityGapCategory (1:1 across the seven literals, validated). */
export function mapCapabilityGapCategory(category: NeutralCapabilityGapCategory): CapabilityGapCategory {
  if (category.length === 0) {
    throw new Error("mapCapabilityGapCategory: empty gap category (truth law — refusing to map an unaddressed category)");
  }
  if (
    category === "TOOL_GAP" || category === "EDITOR_GAP" || category === "MODEL_GAP" || category === "SKILL_GAP" ||
    category === "KNOWLEDGE_GAP" || category === "DATA_GAP" || category === "EXPERT_GAP"
  ) {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return category as CapabilityGapCategory;
  }
  throw new Error(`mapCapabilityGapCategory: neutral category "${category}" has no frozen v1/v8 mapping (the seven categories are frozen; extension requires a TL contract update)`);
}

/** Map a neutral escalation eligibility onto the frozen v1 EscalationEligibility (1:1, validated). */
export function mapEscalationEligibility(eligibility: NeutralEscalationEligibility): FrozenEscalationEligibility {
  if (eligibility === "not-eligible" || eligibility === "eligible" || eligibility === "escalated") {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return eligibility as FrozenEscalationEligibility;
  }
  throw new Error(`mapEscalationEligibility: neutral eligibility "${eligibility}" has no frozen v1 mapping (not-eligible/eligible/escalated)`);
}

/** Map a neutral arena run status onto the frozen v8 ArenaRunStatus (1:1 across the four literals, validated). */
export function mapArenaRunStatus(status: NeutralArenaRunStatus): ArenaRunStatus {
  if (status === "started" || status === "completed" || status === "failed" || status === "aborted") {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return status as ArenaRunStatus;
  }
  throw new Error(`mapArenaRunStatus: neutral status "${status}" has no frozen v8 mapping (started/completed/failed/aborted)`);
}

/** Map a neutral arena learning permission onto the frozen v8 ArenaLearningPermission (1:1, validated). */
export function mapArenaLearningPermission(permission: NeutralArenaLearningPermission): ArenaLearningPermission {
  if (permission === "none" || permission === "aggregate" || permission === "full") {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return permission as ArenaLearningPermission;
  }
  throw new Error(`mapArenaLearningPermission: neutral permission "${permission}" has no frozen v8 mapping (none/aggregate/full)`);
}

/**
 * Map a neutral backoff class onto the frozen v8 ArenaRetryPolicy
 * .backoffClass (an opaque string whose registry authority is the W8C
 * lane — the authored four-class vocabulary is validated here, the ONLY
 * gate; extension requires a W8C registry update plus this seam table).
 */
export function mapArenaBackoffClass(backoffClass: NeutralArenaBackoffClass): string {
  if (backoffClass.length === 0) {
    throw new Error("mapArenaBackoffClass: empty backoff class (truth law — refusing to map an unaddressed class)");
  }
  if (
    backoffClass === "circuit-breaker" || backoffClass === "hedged-request" ||
    backoffClass === "exponential-backoff-jitter" || backoffClass === "token-bucket"
  ) {
    return backoffClass;
  }
  throw new Error(`mapArenaBackoffClass: neutral class "${backoffClass}" is outside the W8C authored backoff vocabulary (circuit-breaker/hedged-request/exponential-backoff-jitter/token-bucket)`);
}

/** Map a neutral arena escalation status onto the frozen v1 ArenaEscalationStatus (1:1 across the seven-state ladder, validated). */
export function mapArenaEscalationStatus(status: string): ArenaEscalationStatus {
  if (
    status === "requested" || status === "authorized" || status === "in-progress" || status === "delivered" ||
    status === "applied" || status === "rejected" || status === "cancelled"
  ) {
    return status;
  }
  throw new Error(`mapArenaEscalationStatus: status "${status}" has no frozen v1 mapping (the seven-state escalation ladder is frozen)`);
}

/** Inputs for frozen v1 CapabilityGap construction (the escalation link is service-owned identity, injected here). */
export interface CapabilityGapConstruction {
  readonly gap: NeutralArenaGapRecord;
  readonly arenaEscalationRef: {
    readonly escalationId: string;
    readonly status: string;
    readonly minimumContext: readonly string[];
    readonly expertResult: {
      readonly deliveredAt: string;
      readonly resultType: "typed-payload" | "artifact" | "guidance";
      readonly payload: Readonly<Record<string, string | number | boolean>>;
      readonly appliesAsChangeSetId: string | null;
    } | null;
  } | null;
}

/** Build a frozen v1 CapabilityGap from the construction (validated 1:1 mapping; the gap stays immutable). */
export function toFrozenCapabilityGap(construction: CapabilityGapConstruction): FrozenCapabilityGap {
  const gap = construction.gap;
  if (gap.id.length === 0) throw new Error("toFrozenCapabilityGap: empty gap id");
  const attemptedStrategies: FrozenAttemptedStrategy[] = [];
  for (const strategy of gap.attemptedStrategies) {
    if (strategy.strategy.length === 0) throw new Error("toFrozenCapabilityGap: empty attempted-strategy string");
    if (strategy.outcome !== "failed" && strategy.outcome !== "partial" && strategy.outcome !== "rejected") {
      throw new Error(`toFrozenCapabilityGap: invalid strategy outcome '${strategy.outcome}'`);
    }
    attemptedStrategies.push({ strategy: strategy.strategy, outcome: strategy.outcome, evidenceRef: strategy.evidenceRef });
  }
  let arenaEscalationRef: FrozenArenaEscalationRef | null = null;
  const ref = construction.arenaEscalationRef;
  if (ref !== null) {
    if (ref.escalationId.length === 0) throw new Error("toFrozenCapabilityGap: empty escalationId on the escalation ref");
    let expertResult: FrozenArenaExpertResult | null = null;
    if (ref.expertResult !== null) {
      if (ref.expertResult.deliveredAt.length === 0) throw new Error("toFrozenCapabilityGap: empty deliveredAt on the expert result");
      expertResult = { ...ref.expertResult, payload: { ...ref.expertResult.payload } };
    }
    arenaEscalationRef = {
      escalationId: ref.escalationId,
      status: mapArenaEscalationStatus(ref.status),
      minimumContext: [...ref.minimumContext],
      expertResult,
    };
  }
  return {
    id: gap.id,
    intentRef: gap.intentRef,
    attemptedStrategies,
    failureEvidence: [...gap.failureEvidence],
    category: mapCapabilityGapCategory(gap.category),
    confidence: gap.confidence,
    suggestedNextAction: gap.suggestedNextAction,
    escalationEligibility: mapEscalationEligibility(gap.escalationEligibility),
    arenaEscalationRef,
  };
}

/** Build a frozen v8 ArenaRun from a neutral run record (append-only ladder entry; identity threaded). */
export function toFrozenArenaRun(record: NeutralArenaRunRecord): FrozenArenaRun {
  if (record.id.length === 0) throw new Error("toFrozenArenaRun: empty run id");
  if (record.gapId.length === 0) throw new Error("toFrozenArenaRun: empty gapId (a run names its gap)");
  if (record.strategy.length === 0) throw new Error("toFrozenArenaRun: empty strategy");
  if (!Number.isInteger(record.attempt) || record.attempt < 1) throw new Error(`toFrozenArenaRun: attempt must be an integer >= 1 (got ${record.attempt})`);
  return {
    id: record.id,
    gapId: record.gapId,
    strategy: record.strategy,
    attempt: record.attempt,
    status: mapArenaRunStatus(record.status),
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    outcomeEvidenceRef: record.outcomeEvidenceRef,
    simulated: record.simulated,
  };
}

/** Build a frozen v8 ArenaRetryPolicy from a neutral retry ladder (validated 1:1 mapping). */
export function toFrozenArenaRetryPolicy(ladder: NeutralArenaRetryLadder): FrozenArenaRetryPolicy {
  if (!Number.isInteger(ladder.maxAttempts) || ladder.maxAttempts < 1) {
    throw new Error(`toFrozenArenaRetryPolicy: maxAttempts must be an integer >= 1 (got ${ladder.maxAttempts})`);
  }
  if (ladder.eligibilityCategories.length === 0) {
    throw new Error("toFrozenArenaRetryPolicy: eligibilityCategories is empty");
  }
  return {
    maxAttempts: ladder.maxAttempts,
    backoffClass: mapArenaBackoffClass(ladder.backoffClass),
    eligibilityCategories: ladder.eligibilityCategories.map(mapCapabilityGapCategory),
    requiresAuthorization: ladder.requiresAuthorization,
  };
}

/** Build a frozen v8 EscalationAuthorization from a neutral authorization context (validated 1:1 mapping). */
export function toFrozenEscalationAuthorization(authorization: NeutralArenaAuthorizationContext): FrozenEscalationAuthorization {
  if (authorization.authorizationId.length === 0) throw new Error("toFrozenEscalationAuthorization: empty authorizationId");
  if (authorization.escalationId.length === 0) throw new Error("toFrozenEscalationAuthorization: empty escalationId");
  if (authorization.authorizedBy.length === 0) throw new Error("toFrozenEscalationAuthorization: empty authorizedBy");
  if (authorization.scope.length === 0) throw new Error("toFrozenEscalationAuthorization: empty scope");
  if (authorization.grantedAt.length === 0) throw new Error("toFrozenEscalationAuthorization: empty grantedAt");
  return {
    id: authorization.authorizationId,
    escalationId: authorization.escalationId,
    authorizedBy: authorization.authorizedBy,
    scope: authorization.scope,
    grantedAt: authorization.grantedAt,
    expiresAt: authorization.expiresAt,
    learningPermission: mapArenaLearningPermission(authorization.learningPermission),
  };
}

/** Build a frozen v8 ArenaProviderDescriptor from a neutral provider descriptor (1:1; provider references opaque). */
export function toFrozenArenaProviderDescriptor(provider: NeutralArenaProviderDescriptor): FrozenArenaProviderDescriptor {
  if (provider.id.length === 0) throw new Error("toFrozenArenaProviderDescriptor: empty id");
  if (provider.providerKind.length === 0) throw new Error("toFrozenArenaProviderDescriptor: empty providerKind");
  if (provider.capabilityClasses.length === 0) throw new Error("toFrozenArenaProviderDescriptor: empty capabilityClasses");
  return {
    id: provider.id,
    providerKind: provider.providerKind,
    capabilityClasses: [...provider.capabilityClasses],
    endpointRef: provider.endpointRef,
  };
}

/** Build a frozen v8 ToolGapProjection from a neutral tool projection (derived, never authoritative). */
export function toFrozenToolGapProjection(projection: NeutralToolGapProjection): FrozenToolGapProjection {
  if (projection.gapId.length === 0) throw new Error("toFrozenToolGapProjection: empty gapId");
  if (projection.requiredCapability.length === 0) throw new Error("toFrozenToolGapProjection: empty requiredCapability");
  if (projection.remediation.length === 0) throw new Error("toFrozenToolGapProjection: empty remediation");
  return {
    gapId: projection.gapId,
    toolId: projection.toolId,
    requiredCapability: projection.requiredCapability,
    remediation: projection.remediation,
  };
}

/** Build a frozen v8 KnowledgeGapProjection from a neutral knowledge projection (derived, never authoritative). */
export function toFrozenKnowledgeGapProjection(projection: NeutralKnowledgeGapProjection): FrozenKnowledgeGapProjection {
  if (projection.gapId.length === 0) throw new Error("toFrozenKnowledgeGapProjection: empty gapId");
  if (projection.domain.length === 0) throw new Error("toFrozenKnowledgeGapProjection: empty domain");
  if (projection.remediation.length === 0) throw new Error("toFrozenKnowledgeGapProjection: empty remediation");
  return {
    gapId: projection.gapId,
    domain: projection.domain,
    missingKnowledgeRef: projection.missingKnowledgeRef,
    remediation: projection.remediation,
  };
}

/** Honest effort observations for an arena benchmark result (structured not-measured markers). */
export function toArenaEffortObservations(
  result: CandidateArenaResult,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    fixtureCount: result.fixtureScores.length,
    simulated: true,
  };
  appendMetricField(out, "arenaEffort", result.effort);
  appendMetricField(out, "latencyMs", result.latency);
  appendMetricField(out, "costUnits", result.cost);
  return out;
}

/**
 * Full W8C path: invoke the arena adapter and construct the frozen v8
 * shapes (neutral provider + gap + ladder -> adapter.invoke() -> frozen
 * ArenaProviderDescriptor + CapabilityGap + append-only ArenaRun ladder).
 * IDENTITY LAW: every run record must thread the invocation's gap identity
 * and the output must thread the request identity — an adapter minting
 * records for another gap/request is refused. Pure orchestration — no
 * business logic; the adapter remains the only arena provider and the
 * arena authority service (W8A) remains the authority.
 */
export function arenaThroughAdapter(
  adapter: ArenaAdapter,
  invocation: NeutralArenaInvocation,
  escalationRef: CapabilityGapConstruction["arenaEscalationRef"],
): {
  readonly provider: FrozenArenaProviderDescriptor;
  readonly gap: FrozenCapabilityGap;
  readonly runs: readonly FrozenArenaRun[];
  readonly output: NeutralArenaOutput;
} {
  const output = adapter.invoke(invocation);
  if (output.requestId !== invocation.requestId) {
    throw new Error(`arenaThroughAdapter: output requestId "${output.requestId}" diverges from the invocation (identity law — adapters never mint request identity)`);
  }
  for (const record of output.runRecords) {
    if (record.gapId !== invocation.gap.id) {
      throw new Error(`arenaThroughAdapter: run record ${record.id} gapId "${record.gapId}" diverges from the invocation gap (identity law — adapters never mint gap identity)`);
    }
    // every record's status must be a valid frozen v8 literal
    mapArenaRunStatus(record.status);
  }
  const provider = toFrozenArenaProviderDescriptor(invocation.provider);
  const gap = toFrozenCapabilityGap({ gap: invocation.gap, arenaEscalationRef: escalationRef });
  const runs = output.runRecords.map(toFrozenArenaRun);
  return { provider, gap, runs, output };
}

// ---------------------------------------------------------------------------
// W9C: seam mapping onto the frozen v9 lab persistence / research
// organization contracts (LabRun / LabExperiment / LabEvidenceManifest /
// LabPromotionRecord / LabWorldDescriptor / FailureAtlasEntry /
// PipelineGenomeNode / SearchLadderStep). The neutral W9C shapes in
// research/worlds.ts, research/pipelineGenome.ts, research/searchLadder.ts,
// research/failureAtlas.ts and research/promotionEvidence.ts are
// structurally aligned with the frozen v9 shapes, so this mapping is 1:1
// and never redeclares or mutates contract semantics. The run-status and
// arm-kind mappings also happen here — the ONLY place neutral lab shapes
// meet the frozen v9 literals. LAB PROMOTION LAW: the promotion record
// construction refuses non-admissible promotions (a searched arm that does
// not beat the baseline never mints a record — the gate decides, this seam
// maps). IDENTITY LAWS: runs thread the experiment identity, manifests
// thread the run identity, atlas entries thread world/run identities,
// ladder steps thread the experiment identity, genome parentRefs resolve
// (enforced on the full path below). TRUTH LAW: fixture lab research stays
// `simulated: true` (W10+ compute-plane boundary).
// ---------------------------------------------------------------------------

/** Map a neutral lab run status onto the frozen v9 LabRunStatus (1:1 across the five literals, validated). */
export function mapLabRunStatus(status: NeutralLabRunStatus): LabRunStatus {
  if (status === "submitted" || status === "running" || status === "succeeded" || status === "failed" || status === "retired") {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return status as LabRunStatus;
  }
  throw new Error(`mapLabRunStatus: neutral status "${status}" has no frozen v9 mapping (submitted/running/succeeded/failed/retired)`);
}

/** Map a neutral comparison arm onto the frozen v9 LabArmKind (1:1 across the three LAB.md arms, validated). */
export function mapLabArmKind(kind: NeutralLabArmKind): LabArmKind {
  if (kind === "generalist-baseline" || kind === "hand-designed" || kind === "searched") {
    // Open-union guard — the cast is sound (see mapLearningScope).
    return kind as LabArmKind;
  }
  throw new Error(`mapLabArmKind: neutral arm "${kind}" has no frozen v9 mapping (the LAB.md three-arm comparison only)`);
}

/** Build a frozen v9 LabWorldDescriptor from a neutral world descriptor (seed-deterministic world identity). */
export function toFrozenLabWorldDescriptor(descriptor: NeutralLabWorldDescriptor): FrozenLabWorldDescriptor {
  if (descriptor.id.length === 0) throw new Error("toFrozenLabWorldDescriptor: empty id");
  if (descriptor.seed.length === 0) throw new Error("toFrozenLabWorldDescriptor: empty seed (a world derives from its seed)");
  if (!Number.isInteger(descriptor.actorCount) || descriptor.actorCount < 1) {
    throw new Error(`toFrozenLabWorldDescriptor: actorCount ${descriptor.actorCount} must be an integer >= 1`);
  }
  return {
    id: descriptor.id,
    seed: descriptor.seed,
    actorCount: descriptor.actorCount,
    groundTruthRef: descriptor.groundTruthRef,
    simulated: descriptor.simulated,
  };
}

/** Build a frozen v9 SearchLadderStep from a neutral ladder step (append-only; budget law fields validated). */
export function toFrozenSearchLadderStep(step: NeutralSearchLadderStep): FrozenSearchLadderStep {
  if (step.id.length === 0) throw new Error("toFrozenSearchLadderStep: empty id");
  if (step.experimentId.length === 0) throw new Error("toFrozenSearchLadderStep: empty experimentId");
  if (!Number.isInteger(step.step) || step.step < 1) {
    throw new Error(`toFrozenSearchLadderStep: step ${step.step} must be an integer >= 1`);
  }
  if (step.strategy.length === 0) throw new Error("toFrozenSearchLadderStep: empty strategy");
  if (!Number.isInteger(step.exploredNodes) || step.exploredNodes < 0) {
    throw new Error(`toFrozenSearchLadderStep: exploredNodes ${step.exploredNodes} must be an integer >= 0`);
  }
  if (!Number.isFinite(step.bestScore) || step.bestScore < 0 || step.bestScore > 1) {
    throw new Error(`toFrozenSearchLadderStep: bestScore ${step.bestScore} is outside [0, 1]`);
  }
  if (!Number.isFinite(step.cumulativeBudget) || step.cumulativeBudget < 0) {
    throw new Error(`toFrozenSearchLadderStep: cumulativeBudget ${step.cumulativeBudget} must be finite >= 0`);
  }
  return {
    id: step.id,
    experimentId: step.experimentId,
    step: step.step,
    strategy: step.strategy,
    exploredNodes: step.exploredNodes,
    bestScore: step.bestScore,
    cumulativeBudget: step.cumulativeBudget,
    simulated: step.simulated,
  };
}

/** Build a frozen v9 FailureAtlasEntry from a neutral atlas entry (immutable observation, evidence ref required). */
export function toFrozenFailureAtlasEntry(entry: NeutralFailureAtlasEntry): FrozenFailureAtlasEntry {
  if (entry.id.length === 0) throw new Error("toFrozenFailureAtlasEntry: empty id");
  if (entry.worldRef.length === 0) throw new Error("toFrozenFailureAtlasEntry: empty worldRef");
  if (entry.runRef.length === 0) throw new Error("toFrozenFailureAtlasEntry: empty runRef");
  if (entry.failureClass.length === 0) throw new Error("toFrozenFailureAtlasEntry: empty failureClass");
  if (entry.evidenceRef.length === 0) {
    throw new Error("toFrozenFailureAtlasEntry: empty evidenceRef (the FAILURE ATLAS LAW requires an evidence ref)");
  }
  if (entry.firstObservedAt.length === 0) throw new Error("toFrozenFailureAtlasEntry: empty firstObservedAt");
  return {
    id: entry.id,
    worldRef: entry.worldRef,
    runRef: entry.runRef,
    failureClass: entry.failureClass,
    evidenceRef: entry.evidenceRef,
    firstObservedAt: entry.firstObservedAt,
    simulated: entry.simulated,
  };
}

/** Build a frozen v9 PipelineGenomeNode from a neutral lineage node (append-only lineage fields validated). */
export function toFrozenPipelineGenomeNode(node: NeutralPipelineGenomeNode): FrozenPipelineGenomeNode {
  if (node.id.length === 0) throw new Error("toFrozenPipelineGenomeNode: empty id");
  if (node.parentRef !== null && node.parentRef.length === 0) {
    throw new Error(`toFrozenPipelineGenomeNode: node ${node.id} carries an empty parentRef (null or a resolvable ref)`);
  }
  if (node.mutationKind.length === 0) throw new Error(`toFrozenPipelineGenomeNode: node ${node.id} carries an empty mutationKind`);
  if (!Number.isFinite(node.score) || node.score < 0 || node.score > 1) {
    throw new Error(`toFrozenPipelineGenomeNode: node ${node.id} score ${node.score} is outside [0, 1]`);
  }
  if (!Number.isInteger(node.generation) || node.generation < 0) {
    throw new Error(`toFrozenPipelineGenomeNode: node ${node.id} generation ${node.generation} must be an integer >= 0`);
  }
  return {
    id: node.id,
    parentRef: node.parentRef,
    mutationKind: node.mutationKind,
    score: node.score,
    generation: node.generation,
    simulated: node.simulated,
  };
}

/** Build a frozen v9 LabRun from a neutral durable run record (identity + status/arm mappings validated). */
export function toFrozenLabRun(record: NeutralLabRunRecord): FrozenLabRun {
  if (record.id.length === 0) throw new Error("toFrozenLabRun: empty id");
  if (record.experimentId.length === 0) throw new Error("toFrozenLabRun: empty experimentId (a run threads its experiment)");
  if (record.planHash.length === 0) throw new Error("toFrozenLabRun: empty planHash (a run names its plan)");
  if (record.submittedAt.length === 0) throw new Error("toFrozenLabRun: empty submittedAt");
  return {
    id: record.id,
    experimentId: record.experimentId,
    arm: mapLabArmKind(record.arm),
    planHash: record.planHash,
    status: mapLabRunStatus(record.status),
    submittedAt: record.submittedAt,
    completedAt: record.completedAt,
    evidenceManifestRef: record.evidenceManifestRef,
    simulated: record.simulated,
  };
}

/** Build a frozen v9 LabExperiment from a neutral experiment container (the three-arm law validated). */
export function toFrozenLabExperiment(experiment: NeutralLabExperiment): FrozenLabExperiment {
  if (experiment.id.length === 0) throw new Error("toFrozenLabExperiment: empty id");
  if (experiment.intentRef.length === 0) throw new Error("toFrozenLabExperiment: empty intentRef");
  if (experiment.constraintsHash.length === 0) throw new Error("toFrozenLabExperiment: empty constraintsHash");
  if (experiment.objective.length === 0) throw new Error("toFrozenLabExperiment: empty objective");
  if (experiment.arms.length === 0) throw new Error("toFrozenLabExperiment: arms is empty (the LAB.md three-arm comparison)");
  return {
    id: experiment.id,
    intentRef: experiment.intentRef,
    constraintsHash: experiment.constraintsHash,
    objective: experiment.objective,
    arms: experiment.arms.map(mapLabArmKind),
    promotionRef: experiment.promotionRef,
    simulated: experiment.simulated,
  };
}

/** Build a frozen v9 LabEvidenceManifest from a neutral manifest (content-addressing law validated). */
export function toFrozenLabEvidenceManifest(manifest: NeutralLabEvidenceManifest): FrozenLabEvidenceManifest {
  if (manifest.id.length === 0) throw new Error("toFrozenLabEvidenceManifest: empty id");
  if (manifest.runId.length === 0) throw new Error("toFrozenLabEvidenceManifest: empty runId (a manifest threads its run)");
  if (manifest.contentHash.length === 0) {
    throw new Error("toFrozenLabEvidenceManifest: empty contentHash (evidence is content-addressed)");
  }
  if (manifest.publishedAt.length === 0) throw new Error("toFrozenLabEvidenceManifest: empty publishedAt");
  for (const ref of manifest.artifactRefs) {
    if (ref.length === 0) throw new Error(`toFrozenLabEvidenceManifest: empty artifactRef on manifest ${manifest.id}`);
  }
  return {
    id: manifest.id,
    runId: manifest.runId,
    contentHash: manifest.contentHash,
    artifactRefs: [...manifest.artifactRefs],
    publishedAt: manifest.publishedAt,
    simulated: manifest.simulated,
  };
}

/** Construction for the frozen v9 LabPromotionRecord: the gate-minted id + the harness's decision evidence. */
export interface LabPromotionRecordConstruction {
  readonly id: string;
  readonly evidence: PromotionDecisionEvidence;
}

/**
 * Build a frozen v9 LabPromotionRecord from the promotion-decision
 * evidence. LAB PROMOTION LAW (fail-closed): a record is constructible
 * ONLY when the searched arm beat the generalist baseline under the
 * recorded objective — non-admissible evidence never mints a promotion
 * record (the promotion gate decides; this seam refuses to map a
 * non-promotion into a record).
 */
export function toFrozenLabPromotionRecord(construction: LabPromotionRecordConstruction): FrozenLabPromotionRecord {
  const evidence = construction.evidence;
  if (construction.id.length === 0) throw new Error("toFrozenLabPromotionRecord: empty id (the gate mints the record id)");
  if (evidence.experimentId.length === 0) throw new Error("toFrozenLabPromotionRecord: empty experimentId");
  if (evidence.evidenceManifestRef.length === 0) throw new Error("toFrozenLabPromotionRecord: empty evidenceManifestRef");
  if (evidence.decidedAt.length === 0) throw new Error("toFrozenLabPromotionRecord: empty decidedAt");
  if (!evidence.promotionAdmissible) {
    throw new Error(
      "toFrozenLabPromotionRecord: the searched arm does not beat the generalist baseline under the recorded objective — YOU_LAB_PROMOTION_INVALID (the promotion gate records only admissible promotions)",
    );
  }
  return {
    id: construction.id,
    experimentId: evidence.experimentId,
    winnerArm: "searched",
    objectiveScore: evidence.searchedArmScore,
    baselineScore: evidence.baselineScore,
    evidenceManifestRef: evidence.evidenceManifestRef,
    decidedAt: evidence.decidedAt,
    simulated: evidence.simulated,
  };
}

/** The full frozen v9 mapping of one promotion-evidence report (identity laws enforced). */
export interface FrozenLabResearchPath {
  readonly experiment: FrozenLabExperiment;
  readonly worlds: readonly FrozenLabWorldDescriptor[];
  readonly runs: readonly FrozenLabRun[];
  readonly manifests: readonly FrozenLabEvidenceManifest[];
  readonly ladderSteps: readonly FrozenSearchLadderStep[];
  readonly genomeNodes: readonly FrozenPipelineGenomeNode[];
  readonly atlasEntries: readonly FrozenFailureAtlasEntry[];
  readonly promotion: FrozenLabPromotionRecord | null;
}

/**
 * Full W9C path: map a promotion-evidence report onto the complete frozen
 * v9 shape set (experiment + world descriptors + runs + evidence manifests
 * + search-ladder steps + genome lineage + atlas entries + the promotion
 * record when admissible). IDENTITY LAWS (fail-closed): runs thread the
 * experiment identity; manifests thread run identity; every run's
 * evidenceManifestRef resolves; atlas entries reference present worlds and
 * runs; ladder steps thread the experiment identity; genome parentRefs
 * resolve within the deduplicated node set (the three arms share the seed
 * root). Pure orchestration — no business logic; the harness remains the
 * evidence producer and the promotion gate (W9A) remains the authority.
 */
export function labResearchThroughHarness(report: PromotionEvidenceReport): FrozenLabResearchPath {
  const experiment = toFrozenLabExperiment(report.experiment);
  const worlds = report.worlds.map((world) => toFrozenLabWorldDescriptor(world.descriptor));
  const worldIds = new Set(worlds.map((world) => world.id));
  const runs = report.armResults.map((arm) => toFrozenLabRun(arm.run));
  const runIds = new Set(runs.map((run) => run.id));
  const manifests = report.armResults.map((arm) => toFrozenLabEvidenceManifest(arm.manifest));
  const manifestIds = new Set(manifests.map((manifest) => manifest.id));
  for (const run of runs) {
    if (run.experimentId !== experiment.id) {
      throw new Error(`labResearchThroughHarness: run ${run.id} threads experiment '${run.experimentId}' != '${experiment.id}' (identity law)`);
    }
    if (run.evidenceManifestRef !== null && !manifestIds.has(run.evidenceManifestRef)) {
      throw new Error(`labResearchThroughHarness: run ${run.id} evidenceManifestRef '${run.evidenceManifestRef}' does not resolve (identity law)`);
    }
  }
  for (const manifest of manifests) {
    if (!runIds.has(manifest.runId)) {
      throw new Error(`labResearchThroughHarness: manifest ${manifest.id} threads run '${manifest.runId}' which is not present (identity law)`);
    }
  }
  const searchedArm = report.armResults.find((arm) => arm.arm === "searched");
  const ladderSteps = searchedArm?.searchLadder === null || searchedArm?.searchLadder === undefined
    ? []
    : searchedArm.searchLadder.steps.map(toFrozenSearchLadderStep);
  for (const step of ladderSteps) {
    if (step.experimentId !== experiment.id) {
      throw new Error(`labResearchThroughHarness: ladder step ${step.id} threads experiment '${step.experimentId}' != '${experiment.id}' (identity law)`);
    }
  }
  const genomeNodesById = new Map<string, NeutralPipelineGenomeNode>();
  for (const arm of report.armResults) {
    for (const node of arm.genome.nodes) {
      const existing = genomeNodesById.get(node.id);
      if (existing !== undefined && canonicalJson(existing) !== canonicalJson(node)) {
        throw new Error(`labResearchThroughHarness: genome node '${node.id}' appears with divergent content across arms (identity law)`);
      }
      genomeNodesById.set(node.id, node);
    }
  }
  for (const node of genomeNodesById.values()) {
    if (node.parentRef !== null && !genomeNodesById.has(node.parentRef)) {
      throw new Error(`labResearchThroughHarness: genome node ${node.id} parentRef '${node.parentRef}' does not resolve (lineage integrity)`);
    }
  }
  const genomeNodes = [...genomeNodesById.values()].map(toFrozenPipelineGenomeNode);
  const atlasEntries = report.failureAtlas.map(toFrozenFailureAtlasEntry);
  for (const entry of atlasEntries) {
    if (!worldIds.has(entry.worldRef)) {
      throw new Error(`labResearchThroughHarness: atlas entry ${entry.id} references world '${entry.worldRef}' which is not present (identity law)`);
    }
    if (!runIds.has(entry.runRef)) {
      throw new Error(`labResearchThroughHarness: atlas entry ${entry.id} references run '${entry.runRef}' which is not present (identity law)`);
    }
  }
  const promotion = report.promotion.promotionAdmissible
    ? toFrozenLabPromotionRecord({
        id: `you_promotion_${sha256Hex(`${report.promotion.experimentId}|${report.promotion.evidenceManifestRef}|${report.promotion.decidedAt}`).slice(0, 16)}`,
        evidence: report.promotion,
      })
    : null;
  return { experiment, worlds, runs, manifests, ladderSteps, genomeNodes, atlasEntries, promotion };
}

// ---------------------------------------------------------------------------
// W10C: seam mapping onto the frozen v10 ecosystem hardening contracts
// (ProviderMatrixEntry / CostLatencyBudget /
// ProductionEligibilityRecord). The neutral W10C shapes in
// ecosystem/providerMatrixSeam.ts, ecosystem/budgetGuardSeam.ts and
// ecosystem/eligibilityLedger.ts are structurally aligned with the frozen
// v10 shapes, so this mapping is 1:1 and never redeclares or mutates
// contract semantics. The region/breaker-class mappings also happen here —
// the ONLY place neutral ecosystem shapes meet the frozen v10 literals.
// ECOSYSTEM GATE LAW: the matrix entry construction validates the authored
// region vocabulary and non-empty capability classes (an unknown ref never
// maps — the neutral seam already refused it; this seam refuses to map a
// malformed row). PRODUCTION ELIGIBILITY LAW: the eligibility record
// construction refuses an empty rollbackEvidenceRef (the law's rollback
// evidence requirement enforced at the frozen boundary too). TRUTH LAW:
// fixture ecosystem rows, budgets and decisions stay `simulated: true`
// (the W10+ compute-plane boundary).
// ---------------------------------------------------------------------------

/**
 * Map a neutral ecosystem region onto the frozen v10
 * ProviderMatrixEntry.region (an opaque string whose registry authority is
 * the W10C lane — the authored vocabulary is validated here, the ONLY
 * gate; extension requires a W10C registry update plus this seam table).
 */
export function mapEcosystemRegion(region: EcosystemRegion): string {
  if (region.length === 0) {
    throw new Error("mapEcosystemRegion: empty region (truth law — refusing to map an unaddressed region)");
  }
  if (region === "global" || region === "cn" || region === "kr" || region === "in") {
    return region;
  }
  throw new Error(`mapEcosystemRegion: neutral region "${region}" is outside the W10C authored region vocabulary (global/cn/kr/in — no jp region is minted: no Japan-market provider was verified in the 2026-10-14 research pass)`);
}

/** Build a frozen v10 ProviderMatrixEntry from a neutral matrix row (validated 1:1 mapping). */
export function toFrozenProviderMatrixEntry(entry: NeutralProviderMatrixEntry): FrozenProviderMatrixEntry {
  if (entry.id.length === 0) throw new Error("toFrozenProviderMatrixEntry: empty id");
  if (entry.providerKind.length === 0) throw new Error("toFrozenProviderMatrixEntry: empty providerKind (a row names its provider)");
  const region = mapEcosystemRegion(entry.region);
  if (entry.capabilityClasses.length === 0) {
    throw new Error("toFrozenProviderMatrixEntry: empty capabilityClasses (a row gates at least one class or slot)");
  }
  for (const clazz of entry.capabilityClasses) {
    if (clazz.length === 0) {
      throw new Error(`toFrozenProviderMatrixEntry: empty capability class on row ${entry.id}`);
    }
  }
  return {
    id: entry.id,
    providerKind: entry.providerKind,
    region,
    capabilityClasses: [...entry.capabilityClasses],
    eligible: entry.eligible,
    simulated: entry.simulated,
  };
}

/** Build a frozen v10 CostLatencyBudget from a neutral budget descriptor (validated 1:1 mapping). */
export function toFrozenCostLatencyBudget(budget: NeutralCostLatencyBudget): FrozenCostLatencyBudget {
  if (budget.id.length === 0) throw new Error("toFrozenCostLatencyBudget: empty id");
  if (budget.scope.length === 0) throw new Error("toFrozenCostLatencyBudget: empty scope (a budget names its scope)");
  if (!Number.isFinite(budget.costBudget) || budget.costBudget <= 0) {
    throw new Error(`toFrozenCostLatencyBudget: costBudget ${budget.costBudget} must be a finite number > 0`);
  }
  if (!Number.isFinite(budget.latencyBudgetS) || budget.latencyBudgetS <= 0) {
    throw new Error(`toFrozenCostLatencyBudget: latencyBudgetS ${budget.latencyBudgetS} must be a finite number > 0`);
  }
  return {
    id: budget.id,
    scope: budget.scope,
    costBudget: budget.costBudget,
    latencyBudgetS: budget.latencyBudgetS,
    breakerClass: mapArenaBackoffClass(budget.breakerClass),
    simulated: budget.simulated,
  };
}

/**
 * Build a frozen v10 ProductionEligibilityRecord from a neutral ledger
 * record (validated 1:1 mapping). PRODUCTION ELIGIBILITY LAW at the
 * frozen boundary: an empty rollbackEvidenceRef is refused — eligibility
 * NEVER maps without rollback evidence.
 */
export function toFrozenProductionEligibilityRecord(record: NeutralProductionEligibilityRecord): FrozenProductionEligibilityRecord {
  if (record.id.length === 0) throw new Error("toFrozenProductionEligibilityRecord: empty id");
  if (record.subjectRef.length === 0) throw new Error("toFrozenProductionEligibilityRecord: empty subjectRef (a decision names its subject)");
  if (record.rollbackEvidenceRef.length === 0) {
    throw new Error("toFrozenProductionEligibilityRecord: empty rollbackEvidenceRef — YOU_PRODUCTION_ELIGIBILITY_INVALID (the PRODUCTION ELIGIBILITY LAW requires rollback evidence on every decision)");
  }
  if (record.decidedAt.length === 0) throw new Error("toFrozenProductionEligibilityRecord: empty decidedAt");
  return {
    id: record.id,
    subjectRef: record.subjectRef,
    eligible: record.eligible,
    rollbackEvidenceRef: record.rollbackEvidenceRef,
    decidedAt: record.decidedAt,
    simulated: record.simulated,
  };
}

/** The full frozen v10 mapping of one ecosystem path through an adapter. */
export interface FrozenEcosystemPath {
  readonly matrixEntry: FrozenProviderMatrixEntry;
  readonly budget: FrozenCostLatencyBudget;
  /** The latest ledger decision for the resolved provider subject (null when none was decided). */
  readonly eligibility: FrozenProductionEligibilityRecord | null;
  readonly output: NeutralEcosystemOutput;
}

/**
 * Full W10C path: fulfill the ecosystem request through the adapter and
 * construct the frozen v10 shapes (neutral refs + budget -> adapter
 * .fulfill() through the fail-closed gate -> frozen ProviderMatrixEntry +
 * CostLatencyBudget + the subject's latest ProductionEligibilityRecord).
 * IDENTITY LAW: the output must thread the request identity and the
 * resolved matrix row identity — an adapter minting fulfillments for
 * another request/row is refused. Pure orchestration — no business logic;
 * the adapter remains the only ecosystem provider and the matrix
 * derivation (registry authority) remains the gate.
 */
export function ecosystemThroughAdapter(
  adapter: EcosystemAdapter,
  request: NeutralEcosystemRequest,
  matrix: ProviderMatrixRegistry,
  ledger: ProductionEligibilityLedger,
): FrozenEcosystemPath {
  const entry = matrix.resolve(request.providerKind, request.region);
  if (!entry) {
    throw new Error(`ecosystemThroughAdapter: no matrix row for provider '${request.providerKind}' in region '${request.region}' (the ecosystem gate refuses unknown refs before the adapter runs)`);
  }
  const output = adapter.fulfill(request, matrix, ledger);
  if (output.requestId !== request.requestId) {
    throw new Error(`ecosystemThroughAdapter: output requestId "${output.requestId}" diverges from the request (identity law — adapters never mint request identity)`);
  }
  if (output.matrixEntryId !== entry.id) {
    throw new Error(`ecosystemThroughAdapter: output matrixEntryId "${output.matrixEntryId}" diverges from the resolved row (identity law — adapters never mint matrix rows)`);
  }
  const latestDecision = ledger.latestDecisionFor(entry.providerKind);
  return {
    matrixEntry: toFrozenProviderMatrixEntry(entry),
    budget: toFrozenCostLatencyBudget(request.budget),
    eligibility: latestDecision === null ? null : toFrozenProductionEligibilityRecord(latestDecision),
    output,
  };
}

/** Honest effort observations for an ecosystem benchmark result (structured not-measured markers). */
export function toEcosystemEffortObservations(
  result: CandidateEcosystemResult,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {
    fixtureCount: result.fixtureScores.length,
    simulated: true,
  };
  appendMetricField(out, "ecosystemEffort", result.effort);
  appendMetricField(out, "latencyMs", result.latency);
  appendMetricField(out, "costUnits", result.cost);
  return out;
}

/** Matrix-summary observations over a derived provider matrix (honest registry-derived provenance). */
export function toProviderMatrixObservations(
  matrix: ProviderMatrixRegistry,
): Readonly<Record<string, string | number | boolean>> {
  const entries = matrix.entries;
  const byRegion = new Map<string, number>();
  let eligible = 0;
  for (const entry of entries) {
    byRegion.set(entry.region, (byRegion.get(entry.region) ?? 0) + 1);
    if (entry.eligible) eligible += 1;
  }
  const out: Record<string, string | number | boolean> = {
    entryCount: entries.length,
    eligibleCount: eligible,
    ineligibleCount: entries.length - eligible,
    simulated: true,
  };
  for (const region of [...byRegion.keys()].sort()) {
    out[`region.${region}.entries`] = byRegion.get(region) ?? 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// W11C: frozen v11 E2E journey / incident runbook / conformance audit
// mappings (the JOURNEY LAW / RUNBOOK LAW / CONFORMANCE LAW enforced
// fail-closed at the frozen boundary)
// ---------------------------------------------------------------------------

/**
 * Build a frozen v11 E2eJourneyRecord from a neutral harness record
 * (validated 1:1 mapping). JOURNEY LAW fail-closed at the frozen
 * boundary: the record must name a KNOWN failed step when non-null; a
 * successful journey (failedStep null) must complete all 20 points —
 * never a silent partial success; the completed prefix must reach the
 * failed step's position; and the you-lab harness is fixture-mode only,
 * so simulated must be true (an unlabelled run is a truth-law
 * fabrication at this seam).
 */
export function toFrozenE2eJourneyRecord(record: NeutralE2eJourneyRecord): FrozenE2eJourneyRecord {
  if (record.id.length === 0) throw new Error("toFrozenE2eJourneyRecord: empty id");
  if (record.journeyId.length === 0) throw new Error("toFrozenE2eJourneyRecord: empty journeyId");
  if (
    !Number.isInteger(record.stepsCompleted) ||
    record.stepsCompleted < 0 ||
    record.stepsCompleted > LAUNCH_GATE_JOURNEY_LENGTH
  ) {
    throw new Error(
      `toFrozenE2eJourneyRecord: stepsCompleted ${record.stepsCompleted} must be an integer in [0, ${LAUNCH_GATE_JOURNEY_LENGTH}] (the 20-point launch-gate path)`,
    );
  }
  if (record.failedStep !== null) {
    if (record.failedStep.length === 0) {
      throw new Error("toFrozenE2eJourneyRecord: failedStep is an empty string (null when the journey succeeded)");
    }
    if (!JOURNEY_STEP_IDS.includes(record.failedStep)) {
      throw new Error(
        `toFrozenE2eJourneyRecord: failedStep '${record.failedStep}' is outside the frozen 20-point launch-gate vocabulary (the harness never emits it)`,
      );
    }
    const failedIndex = journeyStepIndex(record.failedStep);
    if (record.stepsCompleted < failedIndex - 1) {
      throw new Error(
        `toFrozenE2eJourneyRecord: stepsCompleted ${record.stepsCompleted} is below the failed step's honest prefix (${failedIndex - 1} steps precede '${record.failedStep}')`,
      );
    }
  } else if (record.stepsCompleted !== LAUNCH_GATE_JOURNEY_LENGTH) {
    throw new Error(
      `toFrozenE2eJourneyRecord: a successful journey (failedStep null) must complete all ${LAUNCH_GATE_JOURNEY_LENGTH} points (got ${record.stepsCompleted}) — never a silent partial success`,
    );
  }
  if (!Number.isFinite(record.durationMs) || record.durationMs < 0) {
    throw new Error(
      `toFrozenE2eJourneyRecord: durationMs ${record.durationMs} must be a finite non-negative number (the measured-duration clause)`,
    );
  }
  if (record.simulated !== true) {
    throw new Error(
      "toFrozenE2eJourneyRecord: simulated must be true at this seam (the you-lab journey harness is fixture-mode only; an unlabelled run is a truth-law violation — the JOURNEY LAW's simulated-runs-stay-labeled clause)",
    );
  }
  return {
    id: record.id,
    journeyId: record.journeyId,
    stepsCompleted: record.stepsCompleted,
    failedStep: record.failedStep,
    durationMs: record.durationMs,
    simulated: record.simulated,
  };
}

/**
 * Build a frozen v11 IncidentRunbookEntry from a neutral entry
 * (validated 1:1 mapping). RUNBOOK LAW fail-closed at the frozen
 * boundary: the incident class must be inside the W11C authored
 * vocabulary, every detection/containment/recovery text must be
 * non-empty, and simulated must be true (the exercise flag itself is
 * derived from journey evidence in you-lab, never asserted here).
 */
export function toFrozenIncidentRunbookEntry(entry: NeutralIncidentRunbookEntry): FrozenIncidentRunbookEntry {
  if (entry.id.length === 0) throw new Error("toFrozenIncidentRunbookEntry: empty id");
  if (entry.incidentClass.length === 0) {
    throw new Error("toFrozenIncidentRunbookEntry: empty incidentClass (a runbook entry names its incident class)");
  }
  if (!INCIDENT_CLASS_NAMES.includes(entry.incidentClass)) {
    throw new Error(
      `toFrozenIncidentRunbookEntry: incidentClass '${entry.incidentClass}' is outside the W11C authored incident vocabulary (extension requires a W11C table update)`,
    );
  }
  if (entry.detection.length === 0) throw new Error(`toFrozenIncidentRunbookEntry: entry '${entry.id}': empty detection text`);
  if (entry.containment.length === 0) throw new Error(`toFrozenIncidentRunbookEntry: entry '${entry.id}': empty containment text`);
  if (entry.recovery.length === 0) throw new Error(`toFrozenIncidentRunbookEntry: entry '${entry.id}': empty recovery text`);
  if (entry.simulated !== true) {
    throw new Error(
      "toFrozenIncidentRunbookEntry: simulated must be true at this seam (the you-lab runbook is fixture-mode only; an unlabelled entry is a truth-law violation)",
    );
  }
  return {
    id: entry.id,
    incidentClass: entry.incidentClass,
    detection: entry.detection,
    containment: entry.containment,
    recovery: entry.recovery,
    exercised: entry.exercised,
    simulated: entry.simulated,
  };
}

/**
 * Build a frozen v11 ConformanceAuditRecord from a neutral audit record
 * (validated 1:1 mapping). CONFORMANCE LAW fail-closed at the frozen
 * boundary: checksTotal must be a positive integer (an audit with zero
 * checks is a pass without the counts — refused), checksPassed must be
 * an integer in [0, checksTotal] (verbatim counts, never a summary
 * beyond the total), and simulated must be true.
 */
export function toFrozenConformanceAuditRecord(record: NeutralConformanceAuditRecord): FrozenConformanceAuditRecord {
  if (record.id.length === 0) throw new Error("toFrozenConformanceAuditRecord: empty id");
  if (record.standard.length === 0) throw new Error("toFrozenConformanceAuditRecord: empty standard (an audit names its standard)");
  if (record.scopeRef.length === 0) throw new Error("toFrozenConformanceAuditRecord: empty scopeRef (an audit names its scope)");
  if (!Number.isInteger(record.checksTotal) || record.checksTotal <= 0) {
    throw new Error(
      `toFrozenConformanceAuditRecord: checksTotal ${record.checksTotal} must be a positive integer — the CONFORMANCE LAW refuses a pass without the counts`,
    );
  }
  if (!Number.isInteger(record.checksPassed) || record.checksPassed < 0 || record.checksPassed > record.checksTotal) {
    throw new Error(
      `toFrozenConformanceAuditRecord: checksPassed ${record.checksPassed} must be an integer in [0, checksTotal=${record.checksTotal}] (verbatim counts, never a summary beyond the total)`,
    );
  }
  if (record.simulated !== true) {
    throw new Error(
      "toFrozenConformanceAuditRecord: simulated must be true at this seam (the you-lab audit builders are fixture-mode only; an unlabelled audit is a truth-law violation)",
    );
  }
  return {
    id: record.id,
    standard: record.standard,
    scopeRef: record.scopeRef,
    checksTotal: record.checksTotal,
    checksPassed: record.checksPassed,
    simulated: record.simulated,
  };
}
