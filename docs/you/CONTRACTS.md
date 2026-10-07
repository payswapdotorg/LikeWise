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

