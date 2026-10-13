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
  | "reconstruction-job-completed"
  | "performance-published"
  | "render-job-submitted"
  | "render-job-completed"
  | "render-artifact-reviewed"
  | "change-set-applied"
  | "candidate-version-proposed"
  | "import-export-completed"
  | "learning-signal-captured"
  | "learning-record-validated"
  | "learning-record-rejected"
  | "preference-updated"
  | "avatar-session-opened"
  | "embodiment-state-changed"
  | "soul-reassigned"
  | "avatar-session-closed"
  | "arena-run-recorded"
  | "escalation-authorized"
  | "escalation-cancelled"
  | "learning-permission-recorded"
  | "gap-projection-published"
  | "lab-run-recorded"
  | "lab-evidence-published"
  | "lab-promotion-decided"
  | "failure-atlas-entry-recorded"
  | "pipeline-genome-node-recorded";

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
  | "YOU_RECONSTRUCTION_UNSUPPORTED"
  | "YOU_PERFORMANCE_NOT_FOUND"
  | "YOU_TIMELINE_INVALID"
  | "YOU_RENDER_UNSUPPORTED"
  | "YOU_RENDER_ARTIFACT_NOT_FOUND"
  | "YOU_EDIT_SESSION_NOT_FOUND"
  | "YOU_CHANGESET_INVALID"
  | "YOU_EDITOR_UNSUPPORTED"
  | "YOU_IMPORT_EXPORT_FAILED"
  | "YOU_LEARNING_SIGNAL_INVALID"
  | "YOU_LEARNING_RECORD_NOT_FOUND"
  | "YOU_LEARNING_RIGHTS_REQUIRED"
  | "YOU_PREFERENCE_SCOPE_INVALID"
  | "YOU_BODY_NOT_FOUND"
  | "YOU_SOUL_BINDING_INVALID"
  | "YOU_AVATAR_SESSION_NOT_FOUND"
  | "YOU_EMBODIMENT_STATE_INVALID"
  | "YOU_ESCALATION_NOT_FOUND"
  | "YOU_ESCALATION_STATE_INVALID"
  | "YOU_ESCALATION_AUTHORIZATION_REQUIRED"
  | "YOU_ARENA_RUN_NOT_FOUND"
  | "YOU_RETRY_POLICY_INVALID"
  | "YOU_ARENA_ADAPTER_UNSUPPORTED"
  | "YOU_GAP_PROJECTION_INVALID"
  | "YOU_LAB_RUN_NOT_FOUND"
  | "YOU_LAB_EXPERIMENT_NOT_FOUND"
  | "YOU_LAB_EVIDENCE_MANIFEST_INVALID"
  | "YOU_LAB_PROMOTION_INVALID"
  | "YOU_LAB_WORLD_INVALID"
  | "YOU_SEARCH_LADDER_INVALID";

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

// ---------------------------------------------------------------------------
// Performance / Render — frozen v4 (wave 4, TL freeze at T3->W4)
//
// Authority: docs/you/CONTRACTS.md "Wave-4 contract freeze (v4)".
// Dispatched by: docs/you/WORK_ORDERS.md (W4A / W4B / W4C).
// Same laws as v1/v2/v3: workers MUST NOT modify this file; the freeze is
// ADDITIVE — no v1/v2/v3 shape is altered. All ids opaque; performance
// payload/content is never inlined in records — contentRef + contentHash on
// the same content-store abstraction as wave-2 evidence; timestamps from the
// injected clock in fixture mode; truth law (fixture results stay
// `simulated: true`; unmeasured effort/latency/cost carries explicit
// not-measured markers).
// ---------------------------------------------------------------------------

/** Provider-neutral performance track kind (timeline track taxonomy). */
export type PerformanceTrackKind =
  | "motion"
  | "cue"
  | "layer"
  | (string & {});

/**
 * A timed cue on a performance timeline. The cue payload is content-addressed
 * (payloadRef + payloadHash) — never inlined in the record or events.
 */
export interface PerformanceCue {
  readonly id: OpaqueId;
  readonly track: PerformanceTrackKind;
  readonly startMs: number;
  readonly endMs: number;
  readonly payloadRef: string;
  readonly payloadHash: string;
}

/** Ordered performance timeline (cues sorted by startMs; immutable). */
export interface PerformanceTimeline {
  readonly id: OpaqueId;
  readonly cues: readonly PerformanceCue[];
  readonly durationMs: number;
}

/** Reusable parameterized performance recipe (template authority = W4A). */
export interface PerformanceTemplate {
  readonly id: OpaqueId;
  readonly name: string;
  readonly timeline: PerformanceTimeline;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
}

/** A concrete performance bound to a twin version. */
export interface Performance {
  readonly id: OpaqueId;
  readonly twinVersionId: OpaqueId;
  readonly timeline: PerformanceTimeline;
  readonly basedOnTemplateId: OpaqueId | null;
  readonly createdAt: string;
}

/** Provider-neutral render method (adapter taxonomy, W4C lane). */
export type RenderMethod =
  | "motion-extraction"
  | "retargeting"
  | "image-render"
  | "video-render"
  | "3d-render"
  | (string & {});

/** Provider-neutral render output artifact kind. */
export type RenderOutputKind =
  | "image"
  | "video"
  | "mesh"
  | "animation"
  | (string & {});

/**
 * Provider-neutral render job spec. State truth = the performance/render
 * application service (Worker A lane); adapters (Worker C lane) are
 * replaceable and never authorities.
 */
export interface RenderJobSpec {
  readonly id: OpaqueId;
  readonly performanceId: OpaqueId;
  readonly method: RenderMethod;
  readonly outputKinds: readonly RenderOutputKind[];
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly createdAt: string;
}

export type RenderJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

/**
 * Immutable render output artifact. Content-addressed on the same
 * content-store abstraction as wave-2 evidence (contentRef + contentHash;
 * never inlined).
 */
export interface RenderArtifact {
  readonly id: OpaqueId;
  readonly jobId: OpaqueId;
  readonly kind: RenderOutputKind;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly simulated: boolean;
}

export type RenderArtifactReviewStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "superseded";

/** Output review record (W4B review flow; append-only, never overwritten). */
export interface RenderArtifactReview {
  readonly id: OpaqueId;
  readonly artifactId: OpaqueId;
  readonly status: RenderArtifactReviewStatus;
  readonly reviewedAt: string;
}

/**
 * Render job outcome. Honest markers: effort/latency/cost are structured
 * fields with explicit not-measured labels when unmeasured (truth law);
 * fixture results stay `simulated: true`.
 */
export interface RenderJobResult {
  readonly jobId: OpaqueId;
  readonly status: RenderJobStatus;
  readonly artifacts: readonly RenderArtifact[];
  readonly effortObservations: Readonly<Record<string, string | number | boolean>>;
  readonly completedAt: string | null;
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// Editing / Interchange — frozen v5 (wave 5, TL freeze at T4->W5)
//
// Authority: docs/you/CONTRACTS.md "Wave-5 contract freeze (v5)".
// Dispatched by: docs/you/WORK_ORDERS.md (W5A / W5B / W5C).
// Same laws as v1/v2/v3/v4: workers MUST NOT modify this file; the freeze is
// ADDITIVE — no v1/v2/v3/v4 shape is altered. NOTE: the v1 EditSession /
// ChangeSet types (solution-version patch flow) keep their names; the wave-5
// artifact-editing shapes are namespaced EditingSession / EditChangeSet to
// stay additive without collision. All ids opaque; edit payloads are never
// inlined in records or events — payloadRef + payloadHash /
// contentRef + contentHash on the same content-store abstraction as wave-2
// evidence; timestamps from the injected clock in fixture mode; truth law
// (fixture results stay `simulated: true`; unmeasured round-trip effort
// carries explicit not-measured markers).
// ---------------------------------------------------------------------------

/** Provider-neutral editor kind (W5C taxonomy). */
export type EditorKind =
  | "native"
  | "embedded"
  | "external"
  | (string & {});

/**
 * Provider-neutral interchange format for import/export flows. The
 * `edit-interchange` family is defined by docs/you/EDITING_INTERCHANGE.md.
 */
export type ImportExportFormat =
  | "json"
  | "edit-interchange"
  | "scene-package"
  | (string & {});

/**
 * A registered editor's capability profile (registry authority = W5C lane;
 * the profile is researched data, never a runtime authority).
 */
export interface EditorCapabilityProfile {
  readonly id: OpaqueId;
  readonly editorKind: EditorKind;
  readonly displayName: string;
  readonly supportsFormats: readonly ImportExportFormat[];
  readonly roundTripSafe: boolean;
  readonly notes: string;
}

export type EditingSessionStatus =
  | "open"
  | "committed"
  | "abandoned";

/**
 * An artifact editing session over a subject artifact (render artifact or
 * another editable content-addressed record). Session state authority = W5A
 * lane. (Namespaced EditingSession — the v1 EditSession is the distinct
 * solution-version patch flow and keeps its name.)
 */
export interface EditingSession {
  readonly id: OpaqueId;
  readonly subjectArtifactId: OpaqueId;
  readonly editorKind: EditorKind;
  readonly openedAt: string;
  readonly status: EditingSessionStatus;
}

/**
 * A single edit operation inside an edit change set. The operation payload is
 * content-addressed (payloadRef + payloadHash) — never inlined.
 */
export interface EditChangeSetOp {
  readonly id: OpaqueId;
  readonly kind: string;
  readonly payloadRef: string;
  readonly payloadHash: string;
}

/** An ordered, immutable edit change set produced by an editing session. */
export interface EditChangeSet {
  readonly id: OpaqueId;
  readonly sessionId: OpaqueId;
  readonly ops: readonly EditChangeSetOp[];
  readonly createdAt: string;
}

/**
 * A candidate version proposed by applying an edit change set (the
 * artifact-lineage node: parentVersionId -> candidate). Content-addressed;
 * `simulated: true` in fixture mode.
 */
export interface CandidateVersion {
  readonly id: OpaqueId;
  readonly changeSetId: OpaqueId;
  readonly parentVersionId: OpaqueId;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly proposedAt: string;
  readonly simulated: boolean;
}

export type ImportExportStatus =
  | "succeeded"
  | "failed";

/**
 * Import/export outcome (format interchange). Content-addressed result when
 * succeeded; typed failure when not.
 */
export interface ImportExportResult {
  readonly id: OpaqueId;
  readonly sessionId: OpaqueId | null;
  readonly format: ImportExportFormat;
  readonly status: ImportExportStatus;
  readonly contentRef: string | null;
  readonly contentHash: string | null;
  readonly completedAt: string;
  readonly simulated: boolean;
}

/**
 * Round-trip benchmark report (W5C lane). Honest markers: effort observations
 * are structured fields with explicit not-measured labels when unmeasured
 * (truth law); fixture reports stay `simulated: true`.
 */
export interface RoundTripBenchmarkReport {
  readonly editorId: OpaqueId;
  readonly format: ImportExportFormat;
  readonly fidelityScore: number;
  readonly effortObservations: Readonly<Record<string, string | number | boolean>>;
  readonly simulated: boolean;
}


// ---------------------------------------------------------------------------
// Learning — frozen v6 (wave 6, TL freeze at T5->W6)
//
// Authority: docs/you/CONTRACTS.md "Wave-6 contract freeze (v6)".
// Dispatched by: docs/you/WORK_ORDERS.md (W6A / W6B / W6C).
// Same laws as v1/v2/v3/v4/v5: workers MUST NOT modify this file; the freeze
// is ADDITIVE — no earlier shape is altered. All ids opaque; learning
// evidence and validated content are never inlined in records — evidenceRefs
// (wave-2 evidence abstraction) and contentRef + contentHash on the same
// content-store abstraction; timestamps from the injected clock in fixture
// mode; truth law (fixture learning stays `simulated: true`). RIGHTS LAW:
// a learning record is usable only within its LearningRights consent grant
// (consentRef + consentHash, the wave-2 consent authority — there is no
// second consent path); records without rights are inert.
// ---------------------------------------------------------------------------

/**
 * Learning scope taxonomy: the v1-common frozen `LearningScope` union
 * (GLOBAL/TENANT/APPLICATION/PROJECT/USER/TWIN/ASSET/TASK —
 * docs/you/ARCHITECTURE.md section 12). Reused verbatim by the v6 learning
 * shapes; not redeclared (additive law).
 */

/**
 * Provider-neutral kind of captured learning signal (the learning plane:
 * feedback, manual takeover, edit sessions, expert intervention, repeated
 * intent, capability gaps).
 */
export type LearningSignalKind =
  | "feedback"
  | "manual-takeover"
  | "edit-session"
  | "expert-intervention"
  | "repeated-intent"
  | "capability-gap";

/**
 * A captured learning signal (append-only; the raw input to the learning
 * ladder). Evidence is content-addressed — never inlined.
 */
export interface LearningSignal {
  readonly id: OpaqueId;
  readonly kind: LearningSignalKind;
  readonly scope: LearningScope;
  readonly subjectRef: OpaqueId | null;
  readonly evidenceRefs: readonly string[];
  readonly capturedAt: string;
  readonly simulated: boolean;
}

export type LearningRecordStatus =
  | "candidate"
  | "validated"
  | "rejected"
  | "superseded";

/**
 * Sanctioned usage classes for a validated learning record (the rights
 * law: usage outside the grant is a typed refusal).
 */
export type LearningRightUsage =
  | "organization-improvement"
  | "tool-selection"
  | "editor-selection"
  | "pipeline-improvement"
  | "capability-gap-analysis"
  | "personalization";

/**
 * The rights grant bound to a learning record. Consent is content-addressed
 * and traceable to the wave-2 consent authority (consentRef + consentHash).
 */
export interface LearningRights {
  readonly usage: readonly LearningRightUsage[];
  readonly consentRef: string;
  readonly consentHash: string;
  readonly expiresAt: string | null;
}

/**
 * A validated learning artifact (the learning-ledger node). The validation
 * ladder: candidate -> validated | rejected; supersession is append-only
 * linkage, never in-place mutation. Content-addressed; `simulated: true` in
 * fixture mode.
 */
export interface LearningRecord {
  readonly id: OpaqueId;
  readonly signalId: OpaqueId;
  readonly status: LearningRecordStatus;
  readonly scope: LearningScope;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly rights: LearningRights;
  readonly validatedAt: string;
  readonly supersededById: OpaqueId | null;
  readonly simulated: boolean;
}

/**
 * A scoped preference derived from validated learning (or seeded by the
 * operator). Preferences are projections, never authorities — the record
 * remains the source of truth.
 */
export interface LearningPreference {
  readonly id: OpaqueId;
  readonly scope: LearningScope;
  readonly key: string;
  readonly value: string;
  readonly derivedFromRecordId: OpaqueId | null;
  readonly updatedAt: string;
}

/**
 * A content-addressed trajectory reference (the replay substrate for
 * teach-me/learn-this flows). Steps are ordered refs; never inlined.
 */
export interface TrajectoryReference {
  readonly id: OpaqueId;
  readonly scope: LearningScope;
  readonly stepRefs: readonly string[];
  readonly createdAt: string;
  readonly simulated: boolean;
}


// ---------------------------------------------------------------------------
// Agent Embodiment — frozen v7 (wave 7, TL freeze at T6->W7)
//
// Authority: docs/you/CONTRACTS.md "Wave-7 contract freeze (v7)".
// Dispatched by: docs/you/WORK_ORDERS.md (W7A / W7B / W7C).
// Same laws as v1-v6: workers MUST NOT modify this file; the freeze is
// ADDITIVE — no earlier shape is altered. Body and Soul are separate: a
// Body can be possessed by another Soul without changing the Body contract
// (docs/you/ARCHITECTURE.md section 13). All ids opaque; appearance and
// heavy spec content are never inlined in records — contentRef + contentHash
// on the same content-store abstraction; timestamps from the injected clock
// in fixture mode; truth law (fixture sessions stay `simulated: true`).
// ---------------------------------------------------------------------------

/**
 * Agent embodiment state taxonomy (the observable activity states of a
 * possessed Body). The state ladder is a projection, never an authority.
 */
export type EmbodimentState =
  | "listening"
  | "reading"
  | "typing"
  | "thinking"
  | "tool_use"
  | "speaking"
  | "interrupted"
  | "idle"
  | "unavailable";

/**
 * Soul routing profile: system-one (fast/reactive) and system-two
// (deep/deliberate) are ROUTING PROFILES, not fixed model identities.
 */
export type SoulRoutingProfile =
  | "system-one"
  | "system-two";

/**
 * A Soul binding: the LLM/VLM/runtime binding that possesses a Body.
 * Provider-neutral; model references are opaque strings (registry
// authority = the W7C lane). A Body can be re-possessed by another Soul
 * without changing the Body contract (soul-reassigned event).
 */
export interface SoulBinding {
  readonly id: OpaqueId;
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: SoulRoutingProfile;
  readonly capabilities: readonly string[];
}

/**
 * An Agent Body specification (appearance, role, capabilities, tools,
 * policies, memory contract, evaluator contract). Heavy appearance/spec
 * content is content-addressed — never inlined.
 */
export interface AgentBody {
  readonly id: OpaqueId;
  readonly role: string;
  readonly appearanceRef: string | null;
  readonly appearanceHash: string | null;
  readonly capabilities: readonly string[];
  readonly tools: readonly OpaqueId[];
  readonly policyRefs: readonly string[];
  readonly memoryContractRef: string;
  readonly evaluatorContractRef: string;
}

export type AvatarSessionStatus =
  | "active"
  | "suspended"
  | "closed";

/**
 * An avatar session: a Body possessed by a Soul for a span of embodied
 * interaction. The session owns the embodiment-state ladder (projection);
// state transitions are append-only events (embodiment-state-changed), the
 * record itself is immutable with append-only linkage.
 */
export interface AvatarSession {
  readonly id: OpaqueId;
  readonly bodyId: OpaqueId;
  readonly soulBindingId: OpaqueId;
  readonly status: AvatarSessionStatus;
  readonly state: EmbodimentState;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly simulated: boolean;
}

/**
 * Realtime media channel descriptor (provider-neutral; research authority
 * = the W7C lane). Content-addressed stream references — never inlined.
 */
export interface RealtimeChannelDescriptor {
  readonly id: OpaqueId;
  readonly kind: string;
  readonly streamRef: string;
  readonly streamHash: string;
  readonly latencyClass: string;
}

// ---------------------------------------------------------------------------
// Arena machine — frozen v8 (wave 8, TL freeze at T7->W8)
//
// Authority: docs/you/CONTRACTS.md "Wave-8 contract freeze (v8)".
// Dispatched by: docs/you/WORK_ORDERS.md (W8A / W8B / W8C).
// Same laws as v1-v7: workers MUST NOT modify this file; the freeze is
// ADDITIVE — no earlier shape is altered. The Arena never silently
// mutates YOU state (docs/you/ARCHITECTURE.md §15): every result returns
// as a typed payload applied through YOU's own authority. Escalations
// are USER-AUTHORIZED (never auto-run; the rights-law extension); the
// escalation lifecycle is the v1 ArenaEscalationStatus ladder. Learning
// from escalations requires an explicit ArenaLearningPermission. All
// ids opaque; timestamps from the injected clock in fixture mode; truth
// law (fixture arena runs stay `simulated: true`).
// ---------------------------------------------------------------------------

export type ArenaRunStatus =
  | "started"
  | "completed"
  | "failed"
  | "aborted";

/**
 * One automation attempt against a CapabilityGap. The run ladder is
 * append-only (a projection of attempts, never mutated in place);
 * the retry authority is the ArenaRetryPolicy.
 */
export interface ArenaRun {
  readonly id: OpaqueId;
  readonly gapId: OpaqueId;
  readonly strategy: string;
  readonly attempt: number;
  readonly status: ArenaRunStatus;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly outcomeEvidenceRef: OpaqueId | null;
  readonly simulated: boolean;
}

/**
 * Deterministic retry ladder configuration. Authority = the arena
 * service (W8A); research/registry authority = the W8C lane.
 */
export interface ArenaRetryPolicy {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly eligibilityCategories: readonly CapabilityGapCategory[];
  readonly requiresAuthorization: boolean;
}

/**
 * What the user permits the learning machine to derive from an
 * escalation (the W6 rights law extended to the arena boundary).
 */
export type ArenaLearningPermission =
  | "none"
  | "aggregate"
  | "full";

/**
 * The user authorization gate on an escalation. An escalation NEVER
 * runs without one (the ESCALATION AUTHORIZATION LAW). Grants are
 * immutable records; expiry and withdrawal are new records, never
 * mutations.
 */
export interface EscalationAuthorization {
  readonly id: OpaqueId;
  readonly escalationId: OpaqueId;
  readonly authorizedBy: OpaqueId;
  readonly scope: string;
  readonly grantedAt: string;
  readonly expiresAt: string | null;
  readonly learningPermission: ArenaLearningPermission;
}

/**
 * Provider-neutral arena client boundary. Provider references are
 * opaque (registry authority = the W8C lane); real runtime integration
 * stays behind the adapter seam.
 */
export interface ArenaProviderDescriptor {
  readonly id: OpaqueId;
  readonly providerKind: string;
  readonly capabilityClasses: readonly string[];
  readonly endpointRef: string | null;
}

/**
 * ToolGap projection onto the tool inventory. A projection, never an
 * authority: derived from CapabilityGap records, consumed for display
 * and remediation planning.
 */
export interface ToolGapProjection {
  readonly gapId: OpaqueId;
  readonly toolId: OpaqueId | null;
  readonly requiredCapability: string;
  readonly remediation: string;
}

/**
 * KnowledgeGap projection onto knowledge domains. A projection, never
 * an authority.
 */
export interface KnowledgeGapProjection {
  readonly gapId: OpaqueId;
  readonly domain: string;
  readonly missingKnowledgeRef: string | null;
  readonly remediation: string;
}

// ---------------------------------------------------------------------------
// Lab Persistence / Research Organization — frozen v9 (wave 9, TL freeze at
// T8->W9)
//
// Authority: docs/you/CONTRACTS.md "Wave-9 contract freeze (v9)".
// Dispatched by: docs/you/WORK_ORDERS.md (W9A / W9B / W9C).
// Additive only: no existing shape changes (the no-drift rule).
// ---------------------------------------------------------------------------

/**
 * The lab run ladder. Append-only: a projection of attempts over an
 * experiment arm, never mutated in place.
 */
export type LabRunStatus =
  | "submitted"
  | "running"
  | "succeeded"
  | "failed"
  | "retired";

/**
 * The LAB.md comparison law: every serious lab experiment compares a
 * generalist baseline, a hand-designed organization, and a searched
 * organization. Only a searched arm that beats the baseline under the
 * recorded objective and constraints can promote.
 */
export type LabArmKind =
  | "generalist-baseline"
  | "hand-designed"
  | "searched";

/**
 * One durable run of an experiment arm. Authority = the lab
 * persistence service (W9A). Records are immutable; lifecycle is the
 * append-only LabRun ladder.
 */
export interface LabRun {
  readonly id: OpaqueId;
  readonly experimentId: OpaqueId;
  readonly arm: LabArmKind;
  readonly planHash: string;
  readonly status: LabRunStatus;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly evidenceManifestRef: OpaqueId | null;
  readonly simulated: boolean;
}

/**
 * The durable experiment container: one intent + one constraint set,
 * compared across arms. Immutable once declared; runs and promotion
 * decisions append around it.
 */
export interface LabExperiment {
  readonly id: OpaqueId;
  readonly intentRef: OpaqueId;
  readonly constraintsHash: string;
  readonly objective: string;
  readonly arms: readonly LabArmKind[];
  readonly promotionRef: OpaqueId | null;
  readonly simulated: boolean;
}

/**
 * Content-addressed evidence bundle for a lab run. The manifest is
 * the durability unit: artifact content hashes make runs replayable
 * and auditable without trusting the storage layer.
 */
export interface LabEvidenceManifest {
  readonly id: OpaqueId;
  readonly runId: OpaqueId;
  readonly contentHash: string;
  readonly artifactRefs: readonly OpaqueId[];
  readonly publishedAt: string;
  readonly simulated: boolean;
}

/**
 * The promotion gate outcome. LAB PROMOTION LAW: a searched arm
 * promotes ONLY when it beats the generalist baseline under the
 * experiment's recorded objective and constraints. Immutable; a
 * reversal is a new record, never a mutation.
 */
export interface LabPromotionRecord {
  readonly id: OpaqueId;
  readonly experimentId: OpaqueId;
  readonly winnerArm: LabArmKind;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: OpaqueId;
  readonly decidedAt: string;
  readonly simulated: boolean;
}

/**
 * A deterministic lab world: seed-derived actors, ground truth and
 * cameras. Same seed -> byte-identical world (the LAB DETERMINISM
 * LAW). Real-world integration stays behind the compute plane.
 */
export interface LabWorldDescriptor {
  readonly id: OpaqueId;
  readonly seed: string;
  readonly actorCount: number;
  readonly groundTruthRef: string | null;
  readonly simulated: boolean;
}

/**
 * One Failure Atlas observation: a failure class seen in a world run,
 * with evidence. Entries are immutable observations, never
 * authoritative conclusions (the FAILURE ATLAS LAW).
 */
export interface FailureAtlasEntry {
  readonly id: OpaqueId;
  readonly worldRef: OpaqueId;
  readonly runRef: OpaqueId;
  readonly failureClass: string;
  readonly evidenceRef: OpaqueId;
  readonly firstObservedAt: string;
  readonly simulated: boolean;
}

/**
 * One Pipeline Genome lineage node: a candidate pipeline configuration
 * with its parent lineage and recorded score. The genome is
 * append-only lineage, never mutated.
 */
export interface PipelineGenomeNode {
  readonly id: OpaqueId;
  readonly parentRef: OpaqueId | null;
  readonly mutationKind: string;
  readonly score: number;
  readonly generation: number;
  readonly simulated: boolean;
}

/**
 * One search/RL ladder step over an experiment. SEARCH BUDGET LAW:
 * exploration under an explicit cumulative budget; steps append-only;
 * budget exhaustion is a recorded terminal, never a silent stop.
 */
export interface SearchLadderStep {
  readonly id: OpaqueId;
  readonly experimentId: OpaqueId;
  readonly step: number;
  readonly strategy: string;
  readonly exploredNodes: number;
  readonly bestScore: number;
  readonly cumulativeBudget: number;
  readonly simulated: boolean;
}
