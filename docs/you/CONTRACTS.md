# YOU Contracts

## Contract authority

Contracts under `packages/shared` and other existing ZCode protocol authorities remain the machine-level source for cross-package behavior.

YOU domain contracts must be added through controlled, versioned public entrypoints.

Never redeclare an existing ZCode contract locally inside UI or service code.

## Canonical objects

Minimum domain objects:

- Intent
- CapabilityRequirement
- OrganizationPlan
- Solution
- SolutionVersion
- SolutionEvent
- FeedbackRequest
- EvidenceRequest
- EditSession
- ChangeSet
- Artifact
- ArtifactVersion
- EditorAdapterProfile
- CapabilityGap
- Twin
- TwinVersion
- Performance
- RenderJob
- AgentBody
- AgentBodyVersion
- SoulBinding
- TechnologyCandidate
- PipelineCandidate
- LearningCandidate
- ArenaEscalationRef

## Solution protocol

Host -> Solution:

- load_version
- set_selection
- set_compare_version
- patch_projection
- request_snapshot
- request_focus
- request_upload
- dispose

Solution -> Host:

- ready
- rendered
- selection_changed
- feedback_submitted
- evidence_requested
- upload_requested
- editor_requested
- snapshot_ready
- change_proposed
- runtime_error
- capability_gap_detected

Every message has:

- protocol_version;
- message_id;
- correlation_id;
- session/workspace identity;
- timestamp where appropriate;
- typed payload.

## FeedbackRequest

Minimum fields:

- id
- scope
- targetRef
- category
- userComment
- sourceSolutionVersion
- requestedAction
- status
- createdAt
- consent/learning policy

Categories include:

- identity_mismatch
- motion_naturalness
- geometry
- appearance
- style
- composition
- behavior
- usability
- other

## EvidenceRequest

Minimum fields:

- id
- target deficiency
- requested evidence type
- preferred framing/duration/quality
- reason
- privacy requirements
- retention
- status

## EditSession

Minimum fields:

- id
- solutionRef
- inputVersion
- editorRef
- editorVersion
- platform
- mode: correct | edit | teach
- evidenceMode: observed | inferred | hybrid
- start/end
- sourceArtifact
- resultingArtifact
- diffRef
- learningPermission
- provenance

## ChangeSet

Minimum fields:

- id
- intentRef
- targetRef
- inputVersion
- proposedOperations
- evidenceRefs
- executionRef
- verification
- resultingVersion
- authorType: agent | user | expert | importer

## CapabilityGap

Minimum fields:

- id
- intentRef
- attemptedStrategies
- failureEvidence
- category
- confidence
- suggestedNextAction
- escalationEligibility
- arenaEscalationRef

## Artifact identity

Artifacts are immutable/versioned and content-addressed where practical.

An artifact package must preserve:

- source;
- manifest;
- provenance;
- intent;
- consent;
- editor information;
- export format;
- version lineage.

## API/MCP/UI parity

UI, HTTP, SDK and MCP must call the same application-service authority.

No UI-only mutation path is allowed.

## State ownership

The owner of:

- Solution truth = Solution application service
- pane/layout = existing ZCode workbench/pane state
- evidence = evidence service
- TwinVersion = twin service
- EditSession = editing service
- learning candidates = learning service/Lab
- live host workflow = ZCode/application session
- expert escalation = Arena

When boundaries intersect, the originating authority remains the owner.

## Versioning

Immutable records:

- Evidence
- TwinVersion
- SolutionVersion
- ArtifactVersion
- PipelineCandidate
- AgentBodyVersion
- LearningArtifact

Updates create new versions or append-only events.

## Error semantics

Errors must be typed and truthful.

Never:

- report generated content as completed when only a mock ran;
- claim biometric verification from visual similarity;
- claim medical validity from visual reconstruction;
- silently fall back to an unrelated model/editor;
- label a research-only model production eligible.


## Wave-1 contract freeze (v1)

Frozen by the TL at T0 for Work Orders W1A / W1B / W1C.

- The machine authority for the frozen wave-1 contracts is
  `packages/shared/src/you/contract.ts` (exported through the
  `@zcode/shared` public entry). The prose above is the design authority;
  where they disagree, the TL amends both in one change.
- Frozen in this wave: the canonical object field sets
  (Solution/SolutionVersion/SolutionStateSnapshot, Solution protocol
  messages, FeedbackRequest, EvidenceRequest, EditSession, ChangeSet,
  CapabilityGap, ArenaEscalationRef, SolutionEvent, typed YouError),
  state ownership, versioning and error semantics.
- Workers MUST NOT modify `packages/shared/src/you/contract.ts`. A worker
  that needs a contract change stops and requests a TL contract update in
  its delivery report; the TL amends the freeze and re-dispatches.
- Wave-1 consumption: Worker B imports contract types from `@zcode/shared`.
  Worker A implements runtime/services/fixtures around them. Worker C keeps
  provider-neutral shapes inside `packages/you-lab` and maps onto the frozen
  contract at the seam.
- Identifiers stay opaque; immutable records are never overwritten; events
  are append-only; deterministic fixture mode follows `FIXTURES.md`.

## Evidence / capture / consent (design authority, wave 2)

The evidence plane stores immutable capture/evidence references, consent
references, quality observations and provenance. State truth = the evidence
application service (Worker A lane); UI and adapters are never authorities.

Evidence records are immutable, content-addressed and retained per an
explicit retention policy. Uploads bind a content hash to the stored bytes;
a mismatch is a typed error, never a silent repair.

Consent is explicit, scoped, revocable, purpose-specific, server-enforced,
and recorded separately for operational use and learning reuse. No
processing of sensitive evidence without an active consent reference; no
learning reuse without separate permission. Withdrawal stops future use and
is recorded append-only; already-derived immutable records keep their
provenance but must not be re-used for new purposes.

Evidence review is a first-class flow: a review records deterministic
quality observations keyed by deficiency class plus an accept/reject
outcome. Reviews are immutable; a re-review supersedes (never overwrites).

Fixture evidence is synthetic (seed-generated bytes), labeled
`simulated: true`, and follows the same retention/consent machinery as
real evidence — no parallel mock path.

## Wave-2 contract freeze (v2)

Frozen by the TL at the T1->W2 transition for Work Orders W2A / W2B / W2C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1; the freeze is ADDITIVE — no v1 shape was altered. New: CaptureModality,
  EvidencePrivacyClass, RetentionPolicy, EvidenceRetention, ConsentPurpose,
  ConsentPolicy, CaptureSessionStatus, CaptureGuideStep, CaptureSession,
  EvidenceRecord, EvidenceReview, EvidenceReviewStatus; additive event types
  capture-session-opened / capture-session-completed / evidence-recorded /
  evidence-reviewed / consent-recorded / consent-withdrawn; additive error
  codes YOU_EVIDENCE_NOT_FOUND / YOU_RETENTION_EXPIRED /
  YOU_CONTENT_HASH_MISMATCH).
- The v1 Solution protocol is UNCHANGED in wave 2: capture UX flows through
  the existing `evidence_requested` / `upload_requested` events and the
  application-service authority. UI-only mutation paths remain forbidden.
- Workers MUST NOT modify `contract.ts`. A worker needing a contract change
  stops and requests a TL contract update in its delivery report.
- Wave-2 consumption: Worker A implements the evidence/capture/consent
  services + fixtures + content store around the frozen types. Worker B
  imports the frozen types from `@zcode/shared` and binds to Worker A's
  service seams via the same controller/service pattern proven in W1B
  (simulated controller until T2 binding; the seam must be a pure
  injection point, no business logic in the UI). Worker C keeps
  provider-neutral capture-technology shapes inside `packages/you-lab` and
  maps onto the frozen contract at its existing seam module.
- Evidence content is never inlined in records or events; `contentRef` +
  `contentHash` only. Fixture store implementations are deterministic and
  seed-derived (FIXTURES.md laws apply verbatim: injected clock/rng, no
  ambient nondeterminism, byte-identical replays).
- Dependency policy for wave 2: zero new runtime dependencies; no root
  manifest/lockfile edits by workers; TL serializes any root reconciliation
  at T2.
