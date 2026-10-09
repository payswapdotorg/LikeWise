/* oxlint-disable eslint(max-lines) -- YOU frozen contract machine authority (v1+v2): TL 冻结的单一机器契约入口，拆分会破坏 freeze 的单文件权威（docs/you/CONTRACTS.md）。 */
// YOU frozen contract v1 — wave 1 (T0 TL freeze).
//
// Authority: docs/you/CONTRACTS.md (prose) + this file (machine types).
// Dispatched by: docs/you/WORK_ORDERS.md (W1A / W1B / W1C).
//
// LAW (docs/you/CONTRACTS.md "Wave-1 contract freeze"):
// - Workers MUST NOT modify this file. A worker that needs a contract change
//   stops and requests a TL contract update through its delivery report.
// - Worker A implements runtime/services/fixtures AROUND these types.
// - Worker B consumes these types (import from "@zcode/shared").
// - Immutable records (SolutionVersion, EditSession, ChangeSet, CapabilityGap,
//   ArenaEscalationRef, SolutionEvent) are never mutated in place; updates
//   create new versions or append-only events.
// - All ids are opaque. No PII in identifiers.
// - Timestamps are ISO-8601 strings produced by an injected clock in
//   deterministic fixture mode (docs/you/FIXTURES.md).

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export type YouProtocolVersion = "you-solution/1";

/** Opaque identifier. Never embeds PII. */
export type OpaqueId = string;

export type LearningScope =
  | "GLOBAL"
  | "TENANT"
  | "APPLICATION"
  | "PROJECT"
  | "USER"
  | "TWIN"
  | "ASSET"
  | "TASK";

export type ConsentState =
  | "unknown"
  | "granted"
  | "denied"
  | "expired"
  | "withdrawn";

export type AuthorType = "agent" | "user" | "expert" | "importer" | "fixture";

export interface ProvenanceRecord {
  readonly source: string;
  readonly generator: AuthorType;
  /** ISO-8601; injected clock in fixture mode. */
  readonly createdAt: string;
  /** Ancestors, oldest first. Empty for roots. */
  readonly lineage: readonly OpaqueId[];
}

// ---------------------------------------------------------------------------
// Solution domain
// ---------------------------------------------------------------------------

export interface SolutionIdentity {
  readonly id: OpaqueId;
  readonly workspaceIdentity: string;
  readonly displayName: string;
}

export type SolutionEntityKind =
  | "synthetic-human"
  | "environment"
  | "prop"
  | "light"
  | "camera-marker"
  | (string & {});

export interface SolutionTransform {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
}

export interface SolutionEntity {
  readonly id: OpaqueId;
  readonly kind: SolutionEntityKind;
  readonly label: string;
  readonly transform: SolutionTransform;
  /**
   * Deterministic, JSON-serializable attributes. In fixture mode the values
   * are produced only by the deterministic fixture strategy
   * (docs/you/FIXTURES.md).
   */
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface SolutionEnvironmentState {
  /** Key light direction (unit vector). */
  readonly keyLightDirection: readonly [number, number, number];
  readonly ambientIntensity: number;
  readonly background: string;
}

/**
 * Deterministic quality observations keyed by deficiency class.
 * Values are fixture-defined scores in [0, 1]; they never imply scientific
 * validity (docs/you/CONTRACTS.md error semantics).
 */
export type SolutionQualityMap = Readonly<Record<string, number>>;

/** Canonical Solution state referenced (by hash/id) from a SolutionVersion. */
export interface SolutionStateSnapshot {
  readonly entities: readonly SolutionEntity[];
  readonly environment: SolutionEnvironmentState;
  readonly quality: SolutionQualityMap;
  /** True when produced by the deterministic simulated pipeline. */
  readonly simulated: boolean;
}

/** Immutable. Acceptance of a candidate ChangeSet creates the next one. */
export interface SolutionVersion {
  readonly id: OpaqueId;
  readonly solutionId: OpaqueId;
  readonly version: number;
  readonly parentVersionId: OpaqueId | null;
  readonly state: SolutionStateSnapshot;
  readonly provenance: ProvenanceRecord;
}

// ---------------------------------------------------------------------------
// Solution protocol (host <-> solution runtime)
// ---------------------------------------------------------------------------

export interface SolutionProtocolEnvelope {
  readonly protocolVersion: YouProtocolVersion;
  readonly messageId: OpaqueId;
  readonly correlationId: OpaqueId | null;
  readonly solutionId: OpaqueId;
  readonly workspaceIdentity: string;
  readonly timestamp: string | null;
}

export type SolutionSelector =
  | { readonly kind: "entity"; readonly entityId: OpaqueId }
  | { readonly kind: "region"; readonly regionId: OpaqueId }
  | { readonly kind: "quality"; readonly deficiencyClass: string };

/** Host -> Solution commands. */
export type SolutionHostCommand =
  | {
      readonly type: "load_version";
      readonly versionId: OpaqueId;
    }
  | {
      readonly type: "set_selection";
      readonly selection: SolutionSelector | null;
    }
  | {
      readonly type: "set_compare_version";
      readonly versionId: OpaqueId | null;
    }
  | {
      readonly type: "patch_projection";
      readonly patch: SolutionStatePatch;
    }
  | {
      readonly type: "request_snapshot";
      readonly purpose: "agent-observation" | "user-comparison" | "export";
    }
  | {
      readonly type: "request_focus";
      readonly selector: SolutionSelector;
    }
  | {
      readonly type: "request_upload";
      readonly artifactId: OpaqueId;
    }
  | { readonly type: "dispose" };

/** Solution -> Host events. */
export type SolutionRuntimeEvent =
  | { readonly type: "ready" }
  | {
      readonly type: "rendered";
      readonly frameStats: { readonly drawn: boolean };
    }
  | {
      readonly type: "selection_changed";
      readonly selection: SolutionSelector | null;
    }
  | {
      readonly type: "feedback_submitted";
      readonly feedbackRequestId: OpaqueId;
    }
  | {
      readonly type: "evidence_requested";
      readonly evidenceRequestId: OpaqueId;
    }
  | {
      readonly type: "upload_requested";
      readonly artifactId: OpaqueId;
    }
  | {
      readonly type: "editor_requested";
      readonly recommendation: EditorRecommendation;
    }
  | {
      readonly type: "snapshot_ready";
      readonly snapshotId: OpaqueId;
    }
  | {
      readonly type: "change_proposed";
      readonly changeSetId: OpaqueId;
    }
  | {
      readonly type: "runtime_error";
      readonly error: YouError;
    }
  | {
      readonly type: "capability_gap_detected";
      readonly capabilityGapId: OpaqueId;
    };

export type SolutionMessage =
  | (SolutionProtocolEnvelope & { readonly direction: "host-to-solution"; readonly command: SolutionHostCommand })
  | (SolutionProtocolEnvelope & { readonly direction: "solution-to-host"; readonly event: SolutionRuntimeEvent });

/** A minimal, typed patch over canonical state (agent-applied). */
export type SolutionStatePatch = {
  readonly baseVersionId: OpaqueId;
  readonly operations: readonly SolutionPatchOperation[];
};

export type SolutionPatchOperation =
  | {
      readonly op: "upsert_entity";
      readonly entity: SolutionEntity;
    }
  | {
      readonly op: "remove_entity";
      readonly entityId: OpaqueId;
    }
  | {
      readonly op: "update_environment";
      readonly environment: Partial<SolutionEnvironmentState>;
    }
  | {
      readonly op: "adjust_quality";
      readonly deficiencyClass: string;
      readonly delta: number;
    };

// ---------------------------------------------------------------------------
// Feedback / evidence
// ---------------------------------------------------------------------------

export type FeedbackCategory =
  | "identity_mismatch"
  | "motion_naturalness"
  | "geometry"
  | "appearance"
  | "style"
  | "composition"
  | "behavior"
  | "usability"
  | "other";

export type FeedbackStatus = "open" | "addressed" | "superseded" | "rejected";

export interface FeedbackRequest {
  readonly id: OpaqueId;
  readonly scope: LearningScope;
  readonly targetRef: SolutionSelector;
  readonly category: FeedbackCategory;
  readonly userComment: string;
  readonly sourceSolutionVersionId: OpaqueId;
  readonly requestedAction: string;
  readonly status: FeedbackStatus;
  readonly createdAt: string;
  readonly consent: ConsentReference;
}

export interface ConsentReference {
  readonly policyId: OpaqueId;
  readonly state: ConsentState;
  readonly learningPermission: boolean;
}

export type EvidenceType =
  | "reference-image"
  | "reference-video"
  | "measurement"
  | "document"
  | "fixture"
  | (string & {});

export type EvidenceRequestStatus =
  | "requested"
  | "provided"
  | "declined"
  | "fulfilled"
  | "cancelled";

export interface EvidenceRequest {
  readonly id: OpaqueId;
  /** The deficiency this evidence is meant to resolve. */
  readonly targetDeficiency: string;
  readonly evidenceType: EvidenceType;
  readonly preferredFraming: string | null;
  readonly reason: string;
  readonly privacyRequirements: string;
  readonly retention: string;
  readonly status: EvidenceRequestStatus;
}

// ---------------------------------------------------------------------------
// EditSession / ChangeSet
// ---------------------------------------------------------------------------

export type EditMode = "correct" | "edit" | "teach";
export type EditEvidenceMode = "observed" | "inferred" | "hybrid";

export interface EditSession {
  readonly id: OpaqueId;
  readonly solutionId: OpaqueId;
  readonly inputVersionId: OpaqueId;
  readonly editorRef: string;
  readonly editorVersion: string;
  readonly platform: string;
  readonly mode: EditMode;
  readonly evidenceMode: EditEvidenceMode;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly sourceArtifactId: OpaqueId | null;
  readonly resultingArtifactId: OpaqueId | null;
  readonly diffRef: OpaqueId | null;
  readonly learningPermission: ConsentReference;
  readonly provenance: ProvenanceRecord;
}

export type ChangeSetStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "reverted";

export interface ChangeSet {
  readonly id: OpaqueId;
  readonly intentRef: OpaqueId | null;
  readonly targetRef: SolutionSelector | null;
  readonly inputVersionId: OpaqueId;
  readonly proposedOperations: readonly SolutionPatchOperation[];
  readonly evidenceRefs: readonly OpaqueId[];
  readonly executionRef: OpaqueId | null;
  readonly verification: ChangeSetVerification | null;
  readonly resultingVersionId: OpaqueId | null;
  readonly status: ChangeSetStatus;
  readonly authorType: AuthorType;
}

export interface ChangeSetVerification {
  readonly checks: readonly VerificationCheck[];
  readonly passed: boolean;
}

export interface VerificationCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

// ---------------------------------------------------------------------------
// Capability gap / Arena
// ---------------------------------------------------------------------------

export type CapabilityGapCategory =
  | "TOOL_GAP"
  | "EDITOR_GAP"
  | "MODEL_GAP"
  | "SKILL_GAP"
  | "KNOWLEDGE_GAP"
  | "DATA_GAP"
  | "EXPERT_GAP";

export type EscalationEligibility = "not-eligible" | "eligible" | "escalated";

export interface CapabilityGap {
  readonly id: OpaqueId;
  readonly intentRef: OpaqueId | null;
  readonly attemptedStrategies: readonly AttemptedStrategy[];
  readonly failureEvidence: readonly OpaqueId[];
  readonly category: CapabilityGapCategory;
  readonly confidence: number;
  readonly suggestedNextAction: string;
  readonly escalationEligibility: EscalationEligibility;
  readonly arenaEscalationRef: ArenaEscalationRef | null;
}

export interface AttemptedStrategy {
  readonly strategy: string;
  readonly outcome: "failed" | "partial" | "rejected";
  readonly evidenceRef: OpaqueId | null;
}

export type ArenaEscalationStatus =
  | "requested"
  | "authorized"
  | "in-progress"
  | "delivered"
  | "applied"
  | "rejected"
  | "cancelled";

/**
 * Arena boundary (docs/you/ARCHITECTURE.md §15): Arena never silently
 * mutates YOU state; results return as typed payloads applied through
 * YOU's own authority.
 */
export interface ArenaEscalationRef {
  readonly escalationId: OpaqueId;
  readonly status: ArenaEscalationStatus;
  readonly minimumContext: readonly string[];
  readonly expertResult: ArenaExpertResult | null;
}

export interface ArenaExpertResult {
  readonly deliveredAt: string;
  readonly resultType: "typed-payload" | "artifact" | "guidance";
  readonly payload: Readonly<Record<string, string | number | boolean>>;
  readonly appliesAsChangeSetId: OpaqueId | null;
}

// ---------------------------------------------------------------------------
// Editor recommendation (external editors are adapters, never authorities)
// ---------------------------------------------------------------------------

export interface EditorRecommendation {
  readonly editorId: string;
  readonly editorName: string;
  readonly rationale: string;
  readonly exportFormat: string;
}

// ---------------------------------------------------------------------------
// Event ledger (append-only)
// ---------------------------------------------------------------------------

export type SolutionEventType =
  | "solution-created"
  | "version-published"
  | "feedback-submitted"
  | "evidence-requested"
  | "evidence-provided"
  | "capture-session-opened"
  | "capture-session-completed"
  | "evidence-recorded"
  | "evidence-reviewed"
  | "consent-recorded"
  | "consent-withdrawn"
  | "edit-session-opened"
  | "edit-session-closed"
  | "change-proposed"
  | "change-accepted"
  | "change-rejected"
  | "capability-gap-detected"
  | "arena-escalation-requested"
  | "arena-result-applied"
  | "twin-version-published"
  | "twin-quality-assessed"
  | "reconstruction-job-submitted"
  | "reconstruction-job-completed";

export interface SolutionEvent {
  readonly id: OpaqueId;
  readonly solutionId: OpaqueId;
  readonly type: SolutionEventType;
  readonly occurredAt: string;
  readonly subjectRef: OpaqueId | null;
  readonly payload: Readonly<Record<string, string | number | boolean>>;
  readonly provenance: ProvenanceRecord;
}

// ---------------------------------------------------------------------------
// Typed errors (truthful — docs/you/CONTRACTS.md error semantics)
// ---------------------------------------------------------------------------

export type YouErrorCode =
  | "YOU_PROTOCOL_VIOLATION"
  | "YOU_VERSION_NOT_FOUND"
  | "YOU_IMMUTABLE_VIOLATION"
  | "YOU_CONSENT_REQUIRED"
  | "YOU_CAPABILITY_GAP"
  | "YOU_FIXTURE_DETERMINISM"
  | "YOU_INVALID_STATE"
  | "YOU_EVIDENCE_NOT_FOUND"
  | "YOU_RETENTION_EXPIRED"
  | "YOU_CONTENT_HASH_MISMATCH"
  | "YOU_TWIN_NOT_FOUND"
  | "YOU_HTIR_DOMAIN_INVALID"
  | "YOU_RECONSTRUCTION_UNSUPPORTED";

// ---------------------------------------------------------------------------
// Evidence / Capture / Consent — frozen v2 (wave 2, TL freeze at T1->W2)
//
// Authority: docs/you/CONTRACTS.md "Wave-2 contract freeze (v2)".
// Dispatched by: docs/you/WORK_ORDERS.md (W2A / W2B / W2C).
// Same laws as v1: workers MUST NOT modify this file; immutable records are
// never overwritten; all ids opaque; timestamps from the injected clock in
// fixture mode; truth law (fixture evidence stays `simulated: true`).
// ---------------------------------------------------------------------------

/** Raw capture modality (provider-neutral). */
export type CaptureModality =
  | "image"
  | "video"
  | "depth"
  | "audio"
  | "measurement"
  | "document"
  | (string & {});

/** Data classes (docs/you/SECURITY.md "Data classes"). */
export type EvidencePrivacyClass =
  | "public-metadata"
  | "project-artifact"
  | "sensitive-media"
  | "biometric-evidence"
  | "medical"
  | "credential"
  | "learning-artifact";

export type RetentionPolicy =
  | "session-only"
  | "delete-after-review"
  | "project-retention"
  | "tenant-retention";

export interface EvidenceRetention {
  readonly policy: RetentionPolicy;
  /** ISO-8601 (injected clock in fixture mode); null when not applicable. */
  readonly deleteAfter: string | null;
  readonly reason: string;
}

export type ConsentPurpose =
  | "solution-generation"
  | "quality-improvement"
  | "learning"
  | "export"
  | "arena-escalation"
  | (string & {});

/**
 * Server-enforced consent policy (docs/you/SECURITY.md "Consent"):
 * explicit, scoped, revocable, purpose-specific; operational use and
 * learning reuse are consented separately.
 */
export interface ConsentPolicy {
  readonly id: OpaqueId;
  readonly purposes: readonly ConsentPurpose[];
  readonly scope: LearningScope;
  readonly operationalUse: boolean;
  readonly learningReuse: boolean;
  readonly retention: EvidenceRetention;
  readonly revocable: boolean;
}

export type CaptureSessionStatus =
  | "requested"
  | "consent-pending"
  | "active"
  | "completed"
  | "declined"
  | "expired";

/** One guided-capture instruction (targeted EvidenceRequest UX). */
export interface CaptureGuideStep {
  readonly id: OpaqueId;
  readonly instruction: string;
  readonly targetDeficiency: string | null;
  readonly preferredFraming: string | null;
  readonly requiredModality: CaptureModality | null;
}

/**
 * A guided capture flow bound to an EvidenceRequest (or spontaneous).
 * State truth = evidence application service (Worker A).
 */
export interface CaptureSession {
  readonly id: OpaqueId;
  readonly evidenceRequestId: OpaqueId | null;
  readonly scope: LearningScope;
  readonly guideSteps: readonly CaptureGuideStep[];
  readonly status: CaptureSessionStatus;
  readonly consent: ConsentReference;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly provenance: ProvenanceRecord;
}

/**
 * Immutable evidence record. Content is referenced, never inlined:
 * `contentRef` is an opaque store key; `contentHash` binds the record to
 * the stored bytes (sha-256 hex; deterministic fixture hash allowed only
 * in fixture mode and then `simulated: true`).
 */
export interface EvidenceRecord {
  readonly id: OpaqueId;
  readonly evidenceRequestId: OpaqueId | null;
  readonly captureSessionId: OpaqueId | null;
  readonly evidenceType: EvidenceType;
  readonly modality: CaptureModality;
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  readonly privacyClass: EvidencePrivacyClass;
  readonly retention: EvidenceRetention;
  readonly consent: ConsentReference;
  readonly capturedAt: string;
  readonly provenance: ProvenanceRecord;
  /** Truth law: fixture/synthetic evidence stays labeled. */
  readonly simulated: boolean;
}

export type EvidenceReviewStatus = "pending" | "accepted" | "rejected" | "superseded";

/** Human/agent review outcome over an EvidenceRecord. */
export interface EvidenceReview {
  readonly id: OpaqueId;
  readonly evidenceId: OpaqueId;
  readonly reviewerType: AuthorType;
  readonly status: EvidenceReviewStatus;
  /** Deterministic observations keyed by deficiency class (fixture-defined). */
  readonly qualityObservations: SolutionQualityMap;
  readonly notes: string;
  readonly reviewedAt: string;
}

export interface YouError {
  readonly code: YouErrorCode;
  readonly message: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
  /** Never report a mock as completed (truth law). */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// Twin / Reconstruction — frozen v3 (wave 3, TL freeze at T2->W3)
//
// Authority: docs/you/CONTRACTS.md "Twin / reconstruction (design authority,
// wave 3)" + "Wave-3 contract freeze (v3)".
// Dispatched by: docs/you/WORK_ORDERS.md (W3A / W3B / W3C).
// Same laws as v1/v2: workers MUST NOT modify this file; TwinVersions are
// immutable and never overwritten; all ids opaque; timestamps from the
// injected clock in fixture mode; truth law (fixture twins/reconstructions
// stay `simulated: true`); evidence referenced by immutable id + contentHash,
// never inlined; no single reconstruction method is canonical (open unions).
// ---------------------------------------------------------------------------

/**
 * HTIR domain (docs/you/ARCHITECTURE.md §4). Open union: domain extensions
 * are legal without contract changes; providers are adapters, never
 * authorities.
 */
export type HtirDomainKind =
  | "identity-binding"
  | "morphology"
  | "geometry-skeleton"
  | "face-hands"
  | "appearance-materials"
  | "hair"
  | "articulation-blendshapes"
  | "neural-appearance"
  | "motion-profile"
  | "voice"
  | "style"
  | (string & {});

/**
 * One typed HTIR domain block. Content is referenced, never inlined:
 * `contentRef` is an opaque store key; `contentHash` binds the block to
 * the stored bytes (sha-256 hex; same content-store abstraction as wave-2
 * evidence).
 */
export interface HtirDomainBlock {
  readonly id: OpaqueId;
  readonly domain: HtirDomainKind;
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  /** Deterministic 0..1 confidence (fixture-defined in fixture mode). */
  readonly confidence: number;
  /** Truth law: fixture/synthetic blocks stay labeled. */
  readonly simulated: boolean;
  readonly provenance: ProvenanceRecord;
}

/** Immutable evidence binding: an EvidenceRecord id + its contentHash. */
export interface TwinEvidenceBinding {
  readonly evidenceId: OpaqueId;
  readonly evidenceContentHash: string;
  readonly consent: ConsentReference;
}

export type TwinVersionStatus = "candidate" | "canonical" | "superseded";

/**
 * Immutable twin version (docs/you/ARCHITECTURE.md "Twin plane"). A
 * TwinVersion is never mutated; acceptance promotes candidate -> canonical
 * and publishes a new version; a newer canonical supersedes older ones
 * (append-only linkage, never overwrite).
 */
export interface TwinVersion {
  readonly id: OpaqueId;
  readonly twinId: OpaqueId;
  /** Monotonic per twin; immutable once published. */
  readonly version: number;
  readonly status: TwinVersionStatus;
  readonly domainBlocks: readonly HtirDomainBlock[];
  readonly evidenceBindings: readonly TwinEvidenceBinding[];
  readonly quality: TwinQualityState;
  readonly createdAt: string;
  readonly provenance: ProvenanceRecord;
}

/** Deficiency classes for twin quality (open union, extendable). */
export type TwinDeficiencyClass =
  | "coverage-gap"
  | "geometric-error"
  | "appearance-error"
  | "articulation-error"
  | "temporal-inconsistency"
  | "provenance-missing"
  | (string & {});

/** A typed twin deficiency with remediation path into the W2 machinery. */
export interface TwinDeficiency {
  readonly id: OpaqueId;
  readonly deficiencyClass: TwinDeficiencyClass;
  readonly domain: HtirDomainKind;
  /** Deterministic 0..1 severity (fixture-defined in fixture mode). */
  readonly severity: number;
  readonly remediationHint: string | null;
  /** Targeted EvidenceRequest that would remediate (W2 seam), or null. */
  readonly remediationEvidenceRequestId: OpaqueId | null;
}

/** Deterministic quality state projected onto an immutable TwinVersion. */
export interface TwinQualityState {
  /** Domain-keyed 0..1 scores (deterministic in fixture mode). */
  readonly domainScores: SolutionQualityMap;
  readonly deficiencies: readonly TwinDeficiency[];
  readonly assessedAt: string;
}

/**
 * Reconstruction method (docs/you/ARCHITECTURE.md §4: explicit geometry and
 * neural appearance are complementary; no single method is canonical).
 */
export type ReconstructionMethod =
  | "explicit-geometry"
  | "neural-appearance"
  | "hybrid"
  | (string & {});

/**
 * Provider-neutral reconstruction job spec. State truth = the twin/recon
 * application service (Worker A lane); adapters (Worker C lane) are
 * replaceable and never authorities.
 */
export interface ReconstructionJobSpec {
  readonly id: OpaqueId;
  readonly twinVersionId: OpaqueId;
  readonly method: ReconstructionMethod;
  readonly targetDomains: readonly HtirDomainKind[];
  readonly evidenceBindings: readonly TwinEvidenceBinding[];
  readonly createdAt: string;
}

export type ReconstructionJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

/**
 * Reconstruction job outcome. Honest markers: effort/latency/cost are
 * structured fields with explicit not-measured labels when unmeasured
 * (truth law); fixture results stay `simulated: true`.
 */
export interface ReconstructionJobResult {
  readonly jobId: OpaqueId;
  readonly status: ReconstructionJobStatus;
  readonly producedDomainBlocks: readonly HtirDomainBlock[];
  /**
   * Structured effort/latency/cost observations; unmeasured values carry
   * explicit markers (e.g. `{ measured: false }`) — never invented numbers.
   */
  readonly effortObservations: Readonly<Record<string, string | number | boolean>>;
  readonly completedAt: string | null;
  readonly simulated: boolean;
}
