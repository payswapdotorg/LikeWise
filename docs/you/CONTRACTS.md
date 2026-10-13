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

## Twin / reconstruction (design authority, wave 3)

The twin plane stores HTIR (Human Twin Intermediate Representation) and
immutable TwinVersions. State truth = the twin/reconstruction application
service (Worker A lane); UI and adapters are never authorities.

A TwinVersion is immutable: acceptance promotes a candidate to canonical
and publishes a new version; newer canonical versions supersede older ones
through append-only linkage — never overwrite. HTIR is composed of typed
domain blocks (identity binding, morphology, geometry/skeleton, face/hands,
appearance/materials, hair, articulation/blendshapes, neural appearance,
motion profile, voice, style, plus open domain extensions). Domain blocks
are content-addressed (`contentRef` + `contentHash`), never inlined.

Twin quality is a deterministic projection onto a TwinVersion: domain-keyed
scores plus typed deficiencies with remediation hints. A deficiency may
reference a targeted EvidenceRequest (the wave-2 capture machinery) —
quality improvement flows through evidence capture, never through silent
mutation.

Evidence bindings reference immutable EvidenceRecords by id + contentHash
with their consent references. Derived representations must not outlive
their consent scope: binding-time consent state is recorded and enforced
by the service (withdrawal blocks new bindings and new processing;
already-derived immutable versions keep provenance).

Reconstruction is provider-neutral and method-plural: explicit geometry
and neural appearance are complementary, and no single reconstruction
method is canonical. Reconstruction jobs are typed specs (method, target
domains, evidence bindings) with typed results; effort/latency/cost
observations are structured fields with explicit not-measured markers —
never invented numbers. Fixture reconstructions stay `simulated: true`
and follow the same job machinery as real ones — no parallel mock path.

## Wave-3 contract freeze (v3)

Frozen by the TL at the T2->W3 transition for Work Orders W3A / W3B / W3C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1/v2; the freeze is ADDITIVE — no v1/v2 shape was altered. New:
  HtirDomainKind, HtirDomainBlock, TwinEvidenceBinding, TwinVersionStatus,
  TwinVersion, TwinDeficiencyClass, TwinDeficiency, TwinQualityState,
  ReconstructionMethod, ReconstructionJobSpec, ReconstructionJobStatus,
  ReconstructionJobResult; additive event types twin-version-published /
  twin-quality-assessed / reconstruction-job-submitted /
  reconstruction-job-completed; additive error codes YOU_TWIN_NOT_FOUND /
  YOU_HTIR_DOMAIN_INVALID / YOU_RECONSTRUCTION_UNSUPPORTED).
- Workers MUST NOT modify `contract.ts`. A worker needing a contract change
  stops and requests a TL contract update in its delivery report.
- Wave-3 consumption: Worker A implements the twin/reconstruction
  application services + fixtures on the frozen types (twin versioning,
  quality assessment, deficiency remediation links, reconstruction job
  lifecycle). Worker B imports the frozen types from `@zcode/shared` and
  binds to Worker A's service seams via the W1B/W2B controller pattern
  (simulated controller until T3 binding; no business logic in the UI).
  Worker C researches and registers reconstruction technology candidates
  and implements the production-eligible adapter seam + mock/fixture
  adapters + benchmark inside `packages/you-lab`, mapping onto the frozen
  contract at its existing seam module.
- Twin domain content is never inlined in records or events; `contentRef` +
  `contentHash` only, on the same content-store abstraction as wave-2
  evidence. FIXTURES.md laws apply verbatim (injected clock/rng, no
  ambient nondeterminism, byte-identical replays, `simulated: true`).
- Dependency policy for wave 3: zero new runtime dependencies; no root
  manifest/lockfile edits by workers; TL serializes any root reconciliation
  at T3.

## Performance / render (design authority, wave 4)

Objective (frozen from the mission): the YOU twin performs. A performance is
a twin version plus an immutable ordered timeline of content-addressed cues;
templates parameterize timelines for reuse; render jobs turn performances
into reviewed artifacts. The domain is deliberately shaped like the twin/
reconstruction domains so the station's service/adapter/studio split maps
1:1: Worker A owns the performance/render application services, Worker B
binds them into the native studio surface, Worker C researches and registers
provider-neutral render/motion/retargeting technology candidates and the
adapter seam.

Laws (inherited verbatim from v1/v2/v3): immutable records are append-only;
ids stay opaque; timeline cue payloads and render artifact content are never
inlined — `payloadRef`+`payloadHash` / `contentRef`+`contentHash` on the
content-store abstraction; consent for any evidence-bound render input
delegates to the frozen wave-2 consent authority (no second consent path);
artifact reviews are append-only status transitions (pending → accepted |
rejected | superseded); render effort/latency/cost observations carry
explicit not-measured markers (truth law); fixture results stay
`simulated: true`.

## Wave-4 contract freeze (v4)

Frozen by the TL at the T3->W4 transition for Work Orders W4A / W4B / W4C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1/v2/v3; the freeze is ADDITIVE — no v1/v2/v3 shape was altered. New:
  PerformanceTrackKind, PerformanceCue, PerformanceTimeline,
  PerformanceTemplate, Performance, RenderMethod, RenderOutputKind,
  RenderJobSpec, RenderJobStatus, RenderArtifact,
  RenderArtifactReviewStatus, RenderArtifactReview, RenderJobResult;
  additive event types performance-published / render-job-submitted /
  render-job-completed / render-artifact-reviewed; additive error codes
  YOU_PERFORMANCE_NOT_FOUND / YOU_TIMELINE_INVALID /
  YOU_RENDER_UNSUPPORTED / YOU_RENDER_ARTIFACT_NOT_FOUND).
- Workers MUST NOT modify `contract.ts`. A worker needing a contract change
  stops and requests a TL contract update in its delivery report.
- Wave-4 consumption: Worker A implements the performance/render
  application services + fixtures on the frozen types (performance
  publishing, template library, render job lifecycle, artifact lineage,
  artifact review state machine). Worker B imports the frozen types from
  `@zcode/shared` and binds to Worker A's service seams via the W1B/W2B/W3B
  controller pattern (simulated controller until T4 binding; no business
  logic in the UI). Worker C researches and registers motion-extraction /
  retargeting / image / video / 3D render candidates and implements the
  production-eligible adapter seam + mock/fixture adapters + benchmark
  inside `packages/you-lab`, mapping onto the frozen contract at its
  existing seam module (`contractSeam.ts`).
- Performance payload and artifact content are never inlined in records or
  events; `payloadRef` + `payloadHash` / `contentRef` + `contentHash` only.
  FIXTURES.md laws apply verbatim (injected clock/rng, no ambient
  nondeterminism, byte-identical replays, `simulated: true`).
- Dependency policy for wave 4: zero new runtime dependencies; no root
  manifest/lockfile edits by workers; TL serializes any root reconciliation
  at T4.

## Wave-5 contract freeze (v5)

Frozen by the TL at the T4->W5 transition for Work Orders W5A / W5B / W5C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1/v2/v3/v4; the freeze is ADDITIVE — no earlier shape was altered.
  New: EditorKind, ImportExportFormat, EditorCapabilityProfile,
  EditingSessionStatus, EditingSession, EditChangeSetOp, EditChangeSet,
  CandidateVersion, ImportExportStatus, ImportExportResult,
  RoundTripBenchmarkReport (namespaced Editing* / EditChangeSet* — the v1
  EditSession / ChangeSet solution-version patch types keep their names); additive event types change-set-applied /
  candidate-version-proposed / import-export-completed (the v1
  edit-session-opened / edit-session-closed / change-proposed /
  change-accepted / change-rejected events already cover the rest of the
  editing lifecycle); additive error codes YOU_EDIT_SESSION_NOT_FOUND /
  YOU_CHANGESET_INVALID / YOU_EDITOR_UNSUPPORTED /
  YOU_IMPORT_EXPORT_FAILED).
- Workers MUST NOT modify `contract.ts`. A worker needing a contract change
  stops and requests a TL contract update in its delivery report.
- Wave-5 consumption: Worker A implements the editing application services
  + fixtures on the frozen types (EditingSession lifecycle, EditChangeSet
  validation, candidate-version artifact lineage, import/export flows).
  Worker B imports the frozen types from `@zcode/shared` and binds to
  Worker A's service seams via the W1B/W2B/W3B/W4B controller pattern
  (simulated controller until T5 binding; no business logic in the UI).
  Worker C researches and registers native/embedded/external editor
  candidates and implements the production-eligible editor adapter seam +
  mock adapters + round-trip benchmarks inside `packages/you-lab`, mapping
  onto the frozen contract at its existing seam module (`contractSeam.ts`).
- Edit payloads and candidate-version content are never inlined in records
  or events; `payloadRef` + `payloadHash` / `contentRef` + `contentHash`
  only, on the same content-store abstraction as wave-2 evidence.
  EDITING_INTERCHANGE.md laws apply verbatim (injected clock/rng, no
  ambient nondeterminism, byte-identical replays, `simulated: true`).
- Dependency policy for wave 5: zero new runtime dependencies; no root
  manifest/lockfile edits by workers; TL serializes any root
  reconciliation at T5.

## Wave-6 contract freeze (v6)

Frozen by the TL at the T5->W6 transition for Work Orders W6A / W6B /
W6C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1-v5; the freeze is ADDITIVE — no earlier shape was altered. New:
  LearningSignalKind, LearningSignal, LearningRecordStatus,
  LearningRightUsage, LearningRights, LearningRecord, LearningPreference,
  TrajectoryReference; the learning SCOPE taxonomy reuses the v1-common
  frozen `LearningScope` union verbatim (GLOBAL/TENANT/APPLICATION/PROJECT/
  USER/TWIN/ASSET/TASK) — not redeclared; additive event types
  learning-signal-captured / learning-record-validated /
  learning-record-rejected / preference-updated; additive error codes
  YOU_LEARNING_SIGNAL_INVALID / YOU_LEARNING_RECORD_NOT_FOUND /
  YOU_LEARNING_RIGHTS_REQUIRED / YOU_PREFERENCE_SCOPE_INVALID).
- Workers MUST NOT modify `contract.ts`. A worker needing a contract change
  stops and requests a TL contract update in its delivery report.
- Wave-6 consumption: Worker A implements the learning application
  services + fixtures on the frozen types (learning ledger append-only
  machinery, signal capture, the validation ladder, preference
  projections, trajectory references, rights enforcement). Worker B
  imports the frozen types from `@zcode/shared` and builds the
  teach-me/learn-this UX on Worker A's service seams via the W1B-W5B
  controller pattern (simulated controller until T6 binding; no business
  logic in the UI). Worker C researches organization/tool/editor/pipeline
  learning candidates inside `packages/you-lab` (what the Lab can learn
  from manual takeovers) and implements the learning-adapter seam + mock +
  benchmark on the lab foundation, mapping onto the frozen contract at
  `contractSeam.ts`.
- RIGHTS LAW (wave-6 core): a learning record is usable only within its
  LearningRights consent grant (consentRef + consentHash traceable to the
  wave-2 consent authority — there is no second consent path); records
  without rights are inert; usage outside the grant is a typed refusal
  (YOU_LEARNING_RIGHTS_REQUIRED).
- Learning evidence and validated content are never inlined in records or
  events; evidenceRefs (wave-2 evidence abstraction) and
  contentRef + contentHash on the same content-store abstraction.
  FIXTURES.md laws apply verbatim (injected clock/rng, no ambient
  nondeterminism, byte-identical replays, `simulated: true`).
- Dependency policy for wave 6: zero new runtime dependencies; no root
  manifest/lockfile edits by workers; TL serializes any root
  reconciliation at T6.

## Wave-7 contract freeze (v7)

Frozen by the TL at the T6->W7 transition for Work Orders W7A / W7B /
W7C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1-v6; the freeze is ADDITIVE — no earlier shape was altered. New:
  EmbodimentState (the nine-state listening/reading/typing/thinking/
  tool_use/speaking/interrupted/idle/unavailable ladder), SoulRoutingProfile
  (system-one/system-two — ROUTING PROFILES, not fixed model identities),
  SoulBinding (provider-neutral LLM/VLM/runtime binding), AgentBody
  (appearance/role/capabilities/tools/policies/memory + evaluator
  contracts, content-addressed appearance), AvatarSessionStatus,
  AvatarSession (a Body possessed by a Soul; append-only embodiment-state
  events), RealtimeChannelDescriptor; additive event types
  avatar-session-opened / embodiment-state-changed / soul-reassigned /
  avatar-session-closed; additive error codes YOU_BODY_NOT_FOUND /
  YOU_SOUL_BINDING_INVALID / YOU_AVATAR_SESSION_NOT_FOUND /
  YOU_EMBODIMENT_STATE_INVALID).
- Workers MUST NOT modify `contract.ts`. A worker needing a contract change
  stops and requests a TL contract update in its delivery report.
- Wave-7 consumption: Worker A implements the embodiment authority
  services (Body registry, Soul binding validation, AvatarSession
  lifecycle with append-only state transitions, policy enforcement).
  Worker B builds the Avatar Studio UX on Worker A's seams (the W1B-W6B
  controller pattern; simulated controller until T7 binding). Worker C
  researches LLM/VLM providers, state-routing approaches and realtime
  media stacks inside `packages/you-lab` and implements the
  soul/realtime adapter seam + mock + benchmark, mapping onto the frozen
  contract at `contractSeam.ts`.
- BODY/SOUL SEPARATION LAW (wave-7 core): a Body can be possessed by
  another Soul without changing the Body contract; re-possession is the
  soul-reassigned event, never an in-place mutation. The embodiment-state
  ladder is a projection, never an authority.
- Appearance and heavy spec content are never inlined in records;
  contentRef + contentHash on the same content-store abstraction.
  FIXTURES.md laws apply verbatim (injected clock/rng, byte-identical
  replays, `simulated: true`).
- Dependency policy for wave 7: zero new runtime dependencies; no root
  manifest/lockfile edits by workers; TL serializes any root
  reconciliation at T7.

## Wave-8 contract freeze (v8)

Frozen by the TL at the T7->W8 transition for Work Orders W8A / W8B /
W8C.

- Machine authority: `packages/shared/src/you/contract.ts` (the same file
  as v1-v7; the freeze is ADDITIVE — no earlier shape was altered. New:
  ArenaRunStatus, ArenaRun (one automation attempt against a
  CapabilityGap; append-only run ladder), ArenaRetryPolicy
  (deterministic retry ladder configuration), ArenaLearningPermission
  (none/aggregate/full — what the learning machine may derive from an
  escalation), EscalationAuthorization (the user authorization gate),
  ArenaProviderDescriptor (provider-neutral arena client boundary),
  ToolGapProjection / KnowledgeGapProjection (projections, never
  authorities); additive event types arena-run-recorded /
  escalation-authorized / escalation-cancelled /
  learning-permission-recorded / gap-projection-published; additive
  error codes YOU_ESCALATION_NOT_FOUND / YOU_ESCALATION_STATE_INVALID /
  YOU_ESCALATION_AUTHORIZATION_REQUIRED / YOU_ARENA_RUN_NOT_FOUND /
  YOU_RETRY_POLICY_INVALID / YOU_ARENA_ADAPTER_UNSUPPORTED /
  YOU_GAP_PROJECTION_INVALID).
- Workers MUST NOT modify `contract.ts`. A worker needing a contract
  change stops and requests a TL contract update in its delivery
  report.
- Wave-8 consumption: Worker A implements the arena authority services
  (CapabilityGap persistence + the append-only run ladder,
  ArenaRetryPolicy validation, EscalationAuthorization lifecycle, the
  provider-neutral Arena client boundary). Worker B builds the
  Escalation UX on Worker A's seams (the W1B-W7B controller pattern;
  simulated controller until T8 binding): authorization, progress,
  expert-result review, learning permission. Worker C researches gap
  detection + retry/backoff approaches and implements the Arena adapter
  seam + mock + benchmark + ToolGap/Knowledge projections inside
  `packages/you-lab`.
- ARENA BOUNDARY LAW (v1 §15 restated as the wave-8 core): the Arena
  never silently mutates YOU state. Every arena result returns as a
  typed payload (ArenaExpertResult) applied through YOU's own
  authority. The escalation lifecycle stays the v1 ArenaEscalation
  ladder (requested -> authorized -> in-progress -> delivered ->
  applied | rejected | cancelled).
- ESCALATION AUTHORIZATION LAW: an escalation NEVER runs without an
  explicit, in-scope, unexpired EscalationAuthorization granted by the
  user. Authorization grants are immutable records; expiry and
  withdrawal create new records — nothing is mutated in place. The
  services refuse unauthorized escalation paths with
  YOU_ESCALATION_AUTHORIZATION_REQUIRED.
- ARENA LEARNING PERMISSION LAW: escalation-derived signals never enter
  the learning machine without an explicit ArenaLearningPermission
  (none/aggregate/full) recorded on the authorization (the wave-6
  rights law extended to the arena boundary).
- GAP PERSISTENCE LAW: CapabilityGap records are immutable; the run
  ladder (ArenaRun) is append-only; projections (ToolGap /
  KnowledgeGap) are derived, never authoritative.
- PROVIDER NEUTRALITY: arena providers are adapters behind a
  fail-closed seam (the W4C/W6C/W7C precedent). Provider references
  are opaque; real runtime integration stays W9+ compute-plane work.

## Wave-9 contract freeze (v9)

- Frozen by the TL at the T8->W9 transition (the W8 completion record
  c660e9f disclosed the T8 binding point; this freeze opens wave 9).
  Machine authority: `packages/shared/src/you/contract.ts` v9
  (ADDITIVE — LabRunStatus, LabRun, LabArmKind, LabExperiment,
  LabEvidenceManifest, LabPromotionRecord, LabWorldDescriptor,
  FailureAtlasEntry, PipelineGenomeNode, SearchLadderStep; events
  lab-run-recorded / lab-evidence-published / lab-promotion-decided /
  failure-atlas-entry-recorded / pipeline-genome-node-recorded; error
  codes YOU_LAB_RUN_NOT_FOUND / YOU_LAB_EXPERIMENT_NOT_FOUND /
  YOU_LAB_EVIDENCE_MANIFEST_INVALID / YOU_LAB_PROMOTION_INVALID /
  YOU_LAB_WORLD_INVALID / YOU_SEARCH_LADDER_INVALID).
- Wave-9 lanes: W9A Lab Persistence (`you/w9a-labpersistence`), W9B
  Lab Studio (`you/w9b-labstudio`), W9C Research Organization
  (`you/w9c-researchorg`); branches pre-cut at the freeze.
- Wave-9 consumption: Worker A implements the lab persistence
  authority (durable LabExperiment/LabRun records, content-addressed
  evidence manifests, the promotion gate). Worker B builds the Lab
  Studio UX on Worker A's seams (the W1B-W8B controller pattern;
  simulated controller until T9 binding). Worker C implements the
  research organization machinery inside `packages/you-lab`
  (deterministic worlds, the search/RL ladder, Failure Atlas,
  Pipeline Genome, promotion evidence).
- LAB PERSISTENCE LAW: LabExperiment, LabRun, LabEvidenceManifest and
  LabPromotionRecord records are immutable; the run ladder is
  append-only; evidence manifests are content-addressed (artifact
  content hashes make runs replayable and auditable without trusting
  the storage layer).
- LAB PROMOTION LAW: a searched organization promotes ONLY when it
  beats the generalist baseline under the experiment's recorded
  objective and constraints (the LAB.md three-arm comparison law).
  Promotion records are immutable; a reversal is a new record, never
  a mutation. The service refuses invalid promotions with
  YOU_LAB_PROMOTION_INVALID.
- LAB DETERMINISM LAW: lab worlds and benchmark runs are
  seed-deterministic — same seed, byte-identical replay; injected
  clock/rng; everything simulated stays labeled `simulated: true`
  (the truth law). Real compute-plane integration stays W10+.
- SEARCH BUDGET LAW: the search/RL ladder explores under an explicit
  cumulative budget; every step is an appended SearchLadderStep;
  budget exhaustion is a recorded terminal, never a silent stop.
- FAILURE ATLAS LAW: FailureAtlasEntry records are immutable
  observations with evidence refs — never authoritative conclusions;
  the atlas informs, the promotion gate decides.
- PROVIDER NEUTRALITY (carried): the lab compute plane stays behind
  adapter seams (the W4C/W6C/W7C/W8C precedent); no lab service
  mutates YOU state outside its own authority.

## Wave-10 contract freeze (v10)

- Frozen by the TL at the T9->W10 transition (the W9 completion record
  3014fb3 disclosed the T9 binding point; this freeze opens wave 10).
  Machine authority: `packages/shared/src/you/contract.ts` v10
  (ADDITIVE — RateLimitAction, RateLimitPolicy, ImportSecurityVerdict,
  RetentionEnforcementRecord, DrRestoreRecord, ProviderMatrixEntry,
  CostLatencyBudget, ProductionEligibilityRecord; events
  rate-limit-enforced / import-quarantined / retention-enforced /
  dr-restore-recorded / production-eligibility-decided; error codes
  YOU_RATE_LIMIT_EXCEEDED / YOU_IMPORT_QUARANTINED /
  YOU_RETENTION_ENFORCEMENT_INVALID / YOU_DR_RESTORE_INVALID /
  YOU_PROVIDER_MATRIX_INVALID / YOU_PRODUCTION_ELIGIBILITY_INVALID).
- Wave-10 lanes: W10A Platform Hardening (`you/w10a-platform`), W10B
  Product Hardening (`you/w10b-product`), W10C Ecosystem Hardening
  (`you/w10c-ecosystem`); branches pre-cut at the freeze.
- Wave-10 consumption: Worker A implements the platform hardening
  authority (rate-limit policies + enforcement records, import
  security verdicts + quarantine, retention enforcement, DR restore
  verification). Worker B builds the hardening UX on Worker A's seams
  (limit notices, import statuses, retention controls, DR status, the
  release readiness surfaces; the W1B-W9B controller pattern;
  simulated controller until T10 binding). Worker C hardens the
  ecosystem plane inside `packages/you-lab` (provider matrix registry,
  cost/latency budget guards with breaker classes, production
  eligibility + rollback evidence, the stage-10 ecosystem additions —
  try-on / VRM-GLB / AR / telepresence / customer compute / regional
  providers / styles — researched REAL approaches behind fail-closed
  adapter seams).
- RATE LIMIT LAW: limits enforce BEFORE the effect; every enforcement
  appends an immutable record; throttling is never silent
  (YOU_RATE_LIMIT_EXCEEDED).
- IMPORT SECURITY LAW: unscanned imports never enter evidence;
  quarantine is fail-closed and reversible only through an explicit
  release record (YOU_IMPORT_QUARANTINED).
- RETENTION LAW: enforcement records are immutable and auditable; a
  retention class NEVER overrides an active consent (the wave-2
  consent laws hold; YOU_RETENTION_ENFORCEMENT_INVALID).
- DR LAW: a restore verifies content hashes BEFORE activation; the
  verified flag is never asserted without check evidence
  (YOU_DR_RESTORE_INVALID).
- ECOSYSTEM GATE LAW: every ecosystem addition (provider, region,
  style, export class) enters through the ProviderMatrix behind
  fail-closed adapters; unknown matrix refs are typed errors
  (YOU_PROVIDER_MATRIX_INVALID).
- PRODUCTION ELIGIBILITY LAW: eligibility requires rollback evidence;
  decisions are immutable; a reversal is a new record
  (YOU_PRODUCTION_ELIGIBILITY_INVALID).
