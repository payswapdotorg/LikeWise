# YOU Work Orders

## Common worker contract

Every Work Order must be executed from the exact base SHA dispatched by the TL.

Worker must:

1. read authority documents;
2. run workspace freshness check;
3. inspect assigned module context;
4. remain inside frozen write surface;
5. add/update tests for changed behavior;
6. provide exact commands and outputs;
7. disclose license/provenance;
8. disclose latency/cost if applicable;
9. never modify governance state in flight;
10. never merge own PR.

## Concurrency contract

Maximum 3 workers.

No concurrent Work Orders may share:

- source files;
- package manifests;
- root lockfiles;
- generated contract outputs;
- governance files.

TL serializes root dependency/lockfile reconciliation.

If a shared contract needs modification, stop and request a TL contract update rather than silently changing it.

## W1A — Core Solution Authority

Branch: `you/w1a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the T0 merge).

Objective:
Implement the canonical Solution domain/application-service foundation and deterministic fixture.

Frozen write surface (wave 1):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen
  (implement around it; request a TL contract update if a change is needed);
- `packages/services/src/you/**` (new subtree only).

Zero edits to any other existing file. In particular: no edits to
`packages/shared/src/index.ts` (the you entrypoint re-export is already
wired by T0), no edits to `zcode-protocol`, no package manifest or root
lockfile changes, no new dependencies.

Do not write:
UI, editor integration, Lab implementation.

Acceptance:
- typed Solution protocol runtime (host-command / runtime-event handling
  per `contract.ts`);
- immutable SolutionVersion chain (acceptance of a ChangeSet creates the
  next version; no in-place mutation);
- deterministic fixture state per `docs/you/FIXTURES.md` (injected clock +
  rng, seeded synthetic human, measurable quality deltas);
- FeedbackRequest / EvidenceRequest flow;
- candidate ChangeSet proposal + verification;
- append-only SolutionEvent ledger;
- tests (node:test; station runs `pnpm exec tsx --test`) covering:
  protocol round-trips, version immutability, fixture determinism
  (byte-identical replay), event-ledger append-only, feedback/evidence
  flow, and the deterministic-improvement delta.

## W1B — Solution Studio

Branch: `you/w1b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the T0 merge).

Objective:
Make Solution a native ZCode workspace surface with excellent UX.

Read first:
`DESIGN.md`, `packages/ui/src/app-shell/*`, `packages/ui/src/v4/*`, existing Preview/Artifact/Browser surfaces.

Frozen write surface (wave 1):
- `packages/ui/src/you/**` (free);
- minimal registration-only seams in `packages/ui/src/app-shell/**` and
  `packages/ui/src/v4/**` — allowed ONLY where strictly required to
  register the native Solution pane/tab; no behavior changes to existing
  panes; every seam edit is disclosed per-file in the delivery report;
- dedicated UX tests under the you subtree.

Contract imports: types from `@zcode/shared` (frozen `you/contract.ts`).
Do not redeclare contract types locally; do not modify `contract.ts`.

Acceptance:
- native pane/tab;
- dock/reorder/close/reopen;
- viewport;
- semantic selection;
- feedback;
- version compare;
- export/open-in-editor;
- loading/error states;
- operator demo (deterministic, explicitly labeled simulated).

Do not introduce a new global docking library.
Do not modify Worker A or C implementation surfaces. Do not change root
lockfiles or add dependencies without a TL contract update request.

## W1C — Technology/Editor/Lab Foundation

Branch: `you/w1c-lab`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the T0 merge).

Objective:
Create provider-neutral editor and organization capability infrastructure.

Frozen write surface (wave 1):
- `packages/you-lab/**` — a NEW isolated package `@zcode/you-lab`
  (structure mirrors `packages/model-option-map`: `package.json` +
  `tsconfig.json` + `src`). Zero runtime dependencies; devDependencies
  limited to `typescript`. The package carries its own
  `typecheck` script (`tsc -p tsconfig.json --noEmit`). The TL registers it
  in the root typecheck project list and reconciles the lockfile at T1.

Zero edits to any file outside `packages/you-lab/**`. No root manifest,
lockfile or workspace changes. Map onto the frozen
`@zcode/shared` you contract at the adapter seam (import types from
`@zcode/shared`; do not redeclare or modify them).

Acceptance:
- technology registry (provider-neutral profiles with
  license/maintenance/compatibility evidence for the candidate set:
  Three.js/R3F, glTF-Transform, three-vrm, SVG-Edit, Excalidraw, OpenReel,
  OpenTimelineIO, Blender, OpenUSD);
- editor capability profile;
- editor adapter seam;
- deterministic Organization Compiler (intent -> capability decomposition
  -> candidate organization; deterministic given the fixture inputs);
- mock editor candidates;
- benchmark structure (deterministic fixtures, golden expectations,
  node:test).

## W2A — Evidence Authority

Branch: `you/w2a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W2 contract-freeze commit on main).

Objective:
Implement immutable evidence/capture/consent application services on the
frozen v2 contracts.

Frozen write surface (wave 2):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen
  (implement around it; request a TL contract update if a change is needed);
- `packages/services/src/you/**` (the you services subtree Worker A owns
  since W1A).

Zero edits to any other existing file: no UI, no you-lab, no root
manifest/lockfile, no new dependencies, no `packages/shared/src/index.ts`
changes (the v2 types already re-export through the public entry).

Acceptance:
- evidence application service: record immutable `EvidenceRecord`s
  (content-addressed: `contentRef` + `contentHash` binding, typed
  `YOU_CONTENT_HASH_MISMATCH` on mismatch), append-only events
  (`evidence-recorded`, `evidence-reviewed`);
- content store abstraction + deterministic in-memory/fixture
  implementation (seed-derived synthetic evidence bytes; hash via
  node:crypto sha-256 — a builtin, not a new dependency);
- consent/policy service: `ConsentPolicy` records, grant/deny/withdraw
  flows, server-style enforcement checks (no processing of sensitive
evidence classes without an active consent reference; no learning reuse
  without separate permission; withdrawal blocks future use),
  `consent-recorded` / `consent-withdrawn` events;
- capture session flow: open/complete/decline a guided `CaptureSession`
  bound to an `EvidenceRequest`, `capture-session-*` events;
- evidence review flow: `EvidenceReview` accept/reject/supersede with
  deterministic `qualityObservations` keyed by deficiency class;
- retention: policy application incl. delete-after-review path and typed
  `YOU_RETENTION_EXPIRED` / `YOU_EVIDENCE_NOT_FOUND` errors;
- deterministic fixtures per `FIXTURES.md` (injected clock/rng; synthetic
  evidence labeled `simulated: true`; byte-identical replay);
- tests (node:test; station runs `pnpm exec tsx --test`) covering:
  immutability, hash binding + mismatch error, consent enforcement matrix,
  withdrawal semantics, capture flow state machine, review supersession,
  retention expiry, fixture determinism (byte-identical replay), event
  ledger append-only + replay reproduction.

## W2B — Capture Studio

Branch: `you/w2b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W2 contract-freeze commit on main).

Objective:
Make evidence capture/review/consent a native guided workspace experience.

Read first:
`DESIGN.md`, the W1B surfaces (`packages/ui/src/you/**` — Solution pane
pattern, controller seam, i18n catalog), `docs/you/CONTRACTS.md` wave-2
freeze, `docs/you/SECURITY.md` (consent UX duties),
`docs/you/OPERATOR_ACCEPTANCE.md` (Feedback loop + Trust sections).

Frozen write surface (wave 2):
- `packages/ui/src/you/**` (free);
- minimal registration-only seams in `packages/ui/src/app-shell/**` and
  `packages/ui/src/v4/**` ONLY where strictly required to register the
  Capture/Evidence pane or surface entry points — no behavior changes to
  existing panes; every seam edit disclosed per-file in the delivery
  report (pre-expand the seam list from the W1B arbitration record);
- dedicated UX tests under the you subtree.

Contract imports: frozen v2 types from `@zcode/shared`. Do not redeclare
contract types locally; do not modify `contract.ts`. Bind to Worker A's
service seams through a controller injection point in the W1B pattern
(simulated controller acceptable until T2; business logic stays in
services, never in the UI).

Acceptance:
- capture UX: guided capture surface rendering `CaptureSession` +
  `CaptureGuideStep`s with progress, per-step preferred framing, and
  explicit synthetic/fixture labeling;
- evidence review UX: review an `EvidenceRecord` (quality observations,
  notes, accept/reject) with honest loading/error states;
- targeted EvidenceRequest UX: render an `EvidenceRequest` with its
  reason, privacy requirements and retention policy prominently and
  plainly (operator must understand what is asked and why);
- consent UX: explicit grant/deny per purpose, separate learning-reuse
  permission, withdrawal control, and a state that makes "no permission
  ⇒ no processing" visible;
- upload UX bound to `upload_requested` / evidence flows (deterministic
  fixture content only in the demo);
- keyboard navigation, focus and close/reopen parity with the Solution
  pane; i18n strings via the you catalog pattern (en-US + zh-CN);
- tests (node:test) covering store/selector logic, storyboard/demo
  scripting determinism, registration wiring, and consent-state
  projection; loading/error/empty states exercised.

## W2C — Capture Technology

Branch: `you/w2c-capture-tech`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W2 contract-freeze commit on main).

Objective:
Integrate and benchmark provider-neutral capture/segmentation/pose
reconstruction candidates on the W1C lab foundation.

Frozen write surface (wave 2):
- `packages/you-lab/**` only. Zero edits outside; import frozen contract
types from `@zcode/shared` at the existing seam module
(`src/contractSeam.ts`).

Acceptance:
- capture technology registry additions: researched real profiles for
  candidate set — MediaPipe (Holistic/Landmarker), OpenPose, MoveNet /
  BlazePose (TF.js), YOLO-seg family / Segment Anything (SAM/SAM2),
  Depth-Anything, SMPL/X family, OpenMMLab (MMPose) — license (SPDX +
  source URL), maintenance evidence, compatibility notes, provenance;
  `unverified: true` where not verified (truth law — never invent);
- provider-neutral `CaptureAdapter` seam: input modality -> typed capture
  observations/candidates; deterministic `mockSegmentationAdapter` +
  `mockPoseAdapter` (seed-derived, no network);
- segmentation/pose/reconstruction candidate profiles + evaluation
  criteria (capability coverage vs modality, determinism, licensing,
  runtime class — structured fields, explicit `not-measured (simulated)`
  markers where unmeasured);
- benchmark harness: deterministic fixtures (seeded synthetic capture
  payloads + golden expectations), runner scoring candidates on quality
  of typed observations (deterministic), recording effort/latency/cost as
  structured fields with honest markers;
- seam mapping onto frozen v2 contracts (e.g. `EvidenceRecord`
  construction from adapter observations, `qualityObservations`
  projection);
- tests (node:test) covering registry integrity (license + source URL,
  unique ids, no unverified-as-verified), adapter determinism,
  golden benchmark scores, seam mapping validity.

## W3A — Twin Authority

Branch: `you/w3a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W3 contract-freeze commit on main).

Objective:
Implement HTIR domain services, immutable TwinVersion lifecycle, provenance
and quality state on the frozen v3 contracts.

Frozen write surface (wave 3):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen
  (implement around it; request a TL contract update if a change is needed);
- `packages/services/src/you/**` (the you services subtree Worker A owns
  since W1A).

Zero edits to any other existing file: no UI, no you-lab, no root
manifest/lockfile, no new dependencies, no `packages/shared/src/index.ts`
changes (the v3 types already re-export through the public entry).

Acceptance:
- HTIR domain module: typed domain-block construction (content-addressed
  via the wave-2 content-store abstraction: `contentRef` + sha-256
  `contentHash`), confidence + provenance + `simulated` labeling;
- twin versioning service: create a twin; publish immutable TwinVersions
  (candidate → canonical promotion; supersession via append-only linkage —
  never overwrite; monotonic version numbers; typed `YOU_TWIN_NOT_FOUND` /
  `YOU_IMMUTABLE_VIOLATION` errors);
- evidence binding: TwinVersion construction from EvidenceRecords
  (id + contentHash + consent references, wave-2 machinery); binding-time
  consent enforcement (withdrawn consent blocks NEW bindings/processing;
  already-published versions keep provenance);
- quality assessment: deterministic domain-keyed scores + typed
  deficiencies with remediation hints; a deficiency may reference a
  targeted EvidenceRequest (remediation flows through capture, never
  silent mutation);
- reconstruction job lifecycle: submit typed `ReconstructionJobSpec`s
  (queued → running → completed/failed), deterministic fixture
  reconstruction producing `HtirDomainBlock`s, typed
  `YOU_RECONSTRUCTION_UNSUPPORTED` for unsupported method/domain
  combinations, honest effortObservations with not-measured markers;
- event ledger integration: `twin-version-published`,
  `twin-quality-assessed`, `reconstruction-job-submitted`,
  `reconstruction-job-completed` appended through the existing
  SolutionEvent machinery;
- deterministic fixtures per `FIXTURES.md` (seeded synthetic twin
  scenarios end-to-end: capture → evidence → binding → reconstruction →
  quality assessment; byte-identical replay);
- tests (node:test; station runs `pnpm exec tsx --test`) covering:
  TwinVersion immutability + supersession semantics, monotonic versions,
  binding-time consent enforcement (incl. withdrawal), deterministic
  quality projection, deficiency → EvidenceRequest remediation links,
  reconstruction job state machine (legal + illegal transitions),
  unsupported-method typed errors, fixture determinism (byte-identical
  replay), ledger append-only + replay reproduction.

## W3B — Twin Studio

Branch: `you/w3b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W3 contract-freeze commit on main).

Objective:
Make twin inspection, quality maps, deficiencies and the improvement flow
a native workspace experience.

Read first:
`DESIGN.md`, the W1B/W2B surfaces (`packages/ui/src/you/**` — Solution
pane + Capture Studio patterns, controller seam, i18n catalog),
`docs/you/CONTRACTS.md` wave-3 freeze, `docs/you/OPERATOR_ACCEPTANCE.md`.

Frozen write surface (wave 3):
- `packages/ui/src/you/**` (free);
- minimal registration-only seams in `packages/ui/src/app-shell/**` and
  `packages/ui/src/v4/**` ONLY where strictly required to register the
  Twin pane or surface entry points — no behavior changes to existing
  panes; every seam edit disclosed per-file in the delivery report
  (pre-expanded seam list: `lib/workspaceSidePane.ts`,
  `hooks/useAppPanels.ts`, `App.tsx`, i18n en-US/zh-CN catalogs);
- dedicated UX tests under the you subtree.

Contract imports: frozen v3 types from `@zcode/shared`. Do not redeclare
contract types locally; do not modify `contract.ts`. Bind to Worker A's
service seams through a controller injection point in the W1B/W2B pattern
(simulated controller acceptable until T3; business logic stays in
services, never in the UI).

Acceptance:
- twin inspection UX: view a TwinVersion's domain blocks (typed,
  content-addressed, simulated-labeled), provenance and version lineage
  (candidate/canonical/superseded, monotonic versions);
- version compare UX: side-by-side or delta view of two TwinVersions
  (domain scores, deficiencies, provenance);
- quality map UX: domain-keyed scores rendered accessibly (not color-only)
  with deficiency list (class, severity, remediation hint);
- improvement flow UX: a deficiency's remediation path renders its
  targeted EvidenceRequest (reason, privacy requirements, retention —
  wave-2 consent UX duties apply verbatim) and links into the capture
  flow; "no permission ⇒ no processing" stays visible;
- reconstruction job UX: job list with status, method, target domains,
  honest effortObservations (not-measured markers rendered as such,
  never invented numbers);
- keyboard navigation, focus and close/reopen parity with the Solution
  and Capture panes; i18n strings via the you catalog pattern
  (en-US + zh-CN);
- tests (node:test) covering store/selector logic, storyboard/demo
  scripting determinism, registration wiring, quality/deficiency
  projection, version compare projection, consent-state visibility;
  loading/error/empty states exercised.

## W3C — Reconstruction

Branch: `you/w3c-reconstruction`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W3 contract-freeze commit on main).

Objective:
Integrate and benchmark provider-neutral reconstruction candidates on the
W1C/W2C lab foundation; implement the first production-eligible
reconstruction adapter seam plus mock/fixture adapters and benchmark.

Frozen write surface (wave 3):
- `packages/you-lab/**` only. Zero edits outside; import frozen contract
  types from `@zcode/shared` at the existing seam module
  (`src/contractSeam.ts`).

Acceptance:
- reconstruction technology registry additions: researched REAL profiles
  for the candidate set — SMPL / SMPL-X (mesh), PIFu / PIFuHD, ICON /
  ECON (implicit), Gaussian-splatting avatar approaches,
  InstantAvatar-class fast-optimization methods, NeRF-human-class
  approaches, classic photogrammetry (COLMAP/OpenMVS), depth-sensor
  pipelines — license (SPDX + source URL), maintenance evidence,
  compatibility notes, provenance; `unverified: true` where not verified
  (truth law — never invent);
- provider-neutral `ReconstructionAdapter` seam: typed job spec → typed
  domain-block results (HtirDomainBlock construction per the frozen v3
  contract); deterministic `mockReconstructionAdapter` (seed-derived,
  no network) covering explicit-geometry / neural-appearance / hybrid
  methods;
- production-eligible adapter: the best-license/maintenance candidate
  integrated behind the seam as a profile-backed evaluation adapter
  (real runtime integration is W4+ compute-plane territory; honest
  markers required — `not-measured (simulated)` where unmeasured);
- benchmark harness: deterministic fixtures (seeded synthetic capture
  payloads from the W2C machinery or fresh seeds), runner scoring
  candidates on quality of typed domain blocks (deterministic), recording
  effort/latency/cost as structured fields with honest markers;
- seam mapping onto frozen v3 contracts (ReconstructionJobSpec →
  ReconstructionJobResult; HtirDomainBlock construction; TwinVersion
  assembly from adapter outputs at the seam);
- tests (node:test) covering registry integrity (license + source URL,
  unique ids, no unverified-as-verified), adapter determinism
  (byte-identical replay from seed), golden benchmark scores, seam
  mapping validity (adapter outputs construct valid v3 shapes; only the
  seam module touches contract types).

## W4A — Performance Authority

Branch: `you/w4a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W4 contract-freeze commit on main).

Objective:
Implement performance/render application services, artifact lineage and
the artifact review state machine on the frozen v4 contracts.

Frozen write surface (wave 4):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen
  (implement around it; request a TL contract update if a change is needed);
- `packages/services/src/you/**` (the you services subtree Worker A owns
  since W1A).

Zero edits to any other existing file: no UI, no you-lab, no root
manifest/lockfile, no new dependencies, no `packages/shared/src/index.ts`
changes (the v4 types already re-export through the public entry).

Acceptance:
- performance service: publish immutable Performances bound to TwinVersions
  (append-only; `basedOnTemplateId` linkage; typed
  `YOU_PERFORMANCE_NOT_FOUND` errors);
- timeline validation: cues content-addressed (`payloadRef` + sha-256
  `payloadHash`), ordered by `startMs`, non-overlapping per track,
  `endMs > startMs`, `durationMs` consistency — typed
  `YOU_TIMELINE_INVALID` refusals (stateless validators; no clock use);
- template library: parameterized PerformanceTemplates (name uniqueness,
  parameter schema as plain records; deterministic instantiation producing
  a Performance whose timeline is the template timeline verbatim);
- render job lifecycle: legal transition table queued → running →
  completed | failed (terminals locked; illegal transitions typed
  refusals); RenderJobSpec validation (method/outputKinds); typed
  `YOU_RENDER_UNSUPPORTED` for methods the registry lane has not
  registered;
- artifact lineage: immutable RenderArtifacts content-addressed on the
  wave-2 content-store abstraction; job→artifacts lineage queryable;
  `simulated` flags threaded from fixtures;
- artifact review state machine: append-only reviews
  (pending → accepted | rejected | superseded; the SAME status discipline
  as wave-2 evidence reviews; never overwrite; typed
  `YOU_RENDER_ARTIFACT_NOT_FOUND`);
- deterministic fixtures: seeded performance/template/job scenarios
  spanning the full arrow (template → instantiate performance → submit
  render job → running → completed with artifacts → review accepted /
  rejected / superseded; a failed-job path; an invalid-timeline refusal;
  an unsupported-method refusal) — injected clock/rng, byte-identical
  replay, `simulated: true`;
- event ledger integration: performance-published / render-job-submitted /
  render-job-completed / render-artifact-reviewed events through the
  existing ledger machinery;
- tests (node:test) covering the transition tables, validators,
  immutability, lineage, determinism and error taxonomy.

## W4B — Performance Studio

Branch: `you/w4b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Native Performance Studio surface — timeline/template editing, render job
control and artifact review UX on the W4A service seams.

Frozen write surface (wave 4):
- `packages/ui/src/you/**` + the disclosed registration-only seams (same
  pre-expanded seam list as W2B/W3B: `lib/workspaceSidePane`,
  `app-shell/animatedSidePanePanelModel`, `AnimatedSidePanePanel`,
  `SidePaneTabTrigger`, `sidePaneTabPresentation`, `WorkspaceShellLayout`,
  `app-shell/types`, `hooks/useAppPanels`, `you/index.ts`, i18n
  `en-US`/`zh-CN`).

Zero edits to any other existing file: no services, no you-lab, no root
manifest/lockfile, no new dependencies.

Acceptance:
- performance timeline surface: cue track visualization (motion/cue/layer
  taxonomy), duration display, per-cue payload references (content-addressed
  labels, never inlined content);
- template picker + instantiation flow (parameter editing as plain typed
  records; deterministic preview of the instantiated timeline);
- render job control: submit render job (method + outputKinds + params),
  job status ladder (queued/running/completed/failed) rendered from
  controller projections — zero business logic in the UI (W1B/W2B/W3B
  controller pattern; simulated controller until T4 binding);
- artifact review flow: artifact list with lineage (job → artifacts),
  content-addressed artifact cards, review actions (accept/reject/supersede)
  projected through the review state machine; consent-gated inputs
  rendered from consent-state projections (no second consent path);
- loading/error/empty states for every region; `YOU_TIMELINE_INVALID` /
  `YOU_RENDER_UNSUPPORTED` / `YOU_RENDER_ARTIFACT_NOT_FOUND` surfaces as
  typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (registration wiring, panel
  projection, review flow, error surfaces; node:test).

## W4C — Performance/Render Technologies

Branch: `you/w4c-render`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Research, register and benchmark provider-neutral motion-extraction,
retargeting and image/video/3D render technology candidates on the lab
foundation; implement the production-eligible adapter seam plus mock and
fixture adapters.

Frozen write surface (wave 4):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- render technology registry additions: researched REAL profiles for the
  candidate set — motion extraction (e.g. MediaPipe Holistic-class,
  OpenPose-class, WHAM/scene-class 3D motion methods), retargeting
  (Rokoko-class, Auto-Rig-class, mesh-deformation toolkits), image render
  (diffusion-class image pipelines), video render (animated-diffusion /
  frame-interpolation chains), 3D render (Blender-class toolchains,
  three.js-class rasterization, Gaussian-splatting renderers) — license
  (SPDX + source URL), maintenance evidence, compatibility notes,
  provenance; `unverified: true` where not verified (truth law — never
  invent);
- provider-neutral `RenderAdapter` seam: typed RenderJobSpec → typed
  RenderArtifact results (content-addressed artifact construction per the
  frozen v4 contract); deterministic `mockRenderAdapter` (seed-derived,
  no network) covering image / video / mesh / animation output kinds;
- production-eligible adapter: the best-license/maintenance candidate
  integrated behind the seam as a profile-backed evaluation adapter (real
  runtime integration is W5+ compute-plane territory; honest markers
  required — `not-measured (simulated)` where unmeasured);
- benchmark harness: deterministic fixtures (seeded synthetic performance
  payloads), runner scoring candidates on artifact validity and determinism,
  recording effort/latency/cost as structured fields with honest markers;
- seam mapping onto frozen v4 contracts (RenderJobSpec → RenderJobResult;
  RenderArtifact assembly; performance timeline consumption at the seam);
- tests (node:test) covering registry integrity (license + source URL,
  unique ids, no unverified-as-verified), adapter determinism
  (byte-identical replay from seed), golden benchmark scores, seam mapping
  validity (adapter outputs construct valid v4 shapes; only the seam
  module touches contract types).

## W5A — Editing Authority

Branch: `you/w5a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W5 contract-freeze commit on main).

Objective:
Implement EditingSession, EditChangeSet, candidate-version artifact lineage
and import/export application services on the frozen v5 contracts.

Frozen write surface (wave 5):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen
  (implement around it; request a TL contract update if a change is needed);
- `packages/services/src/you/**` (the you services subtree Worker A owns
  since W1A).

Zero edits to any other existing file: no UI, no you-lab, no root
manifest/lockfile, no new dependencies, no `packages/shared/src/index.ts`
changes (the v5 types already re-export through the public entry).

Acceptance:
- edit session service: open sessions over subject artifacts (render
  artifacts or other content-addressed records); append-only session
  lifecycle open → committed | abandoned (terminals locked; illegal
  transitions typed refusals); typed `YOU_EDIT_SESSION_NOT_FOUND`; the
  EditingSession record is the wave-5 namespaced shape (the v1
  EditSession solution-patch flow is untouched);
- edit change set validation: ordered ops with content-addressed payloads
  (`payloadRef` + sha-256 `payloadHash`), no empty op lists, op kinds
  non-empty strings — typed `YOU_CHANGESET_INVALID` refusals (stateless
  validators; no clock use);
- candidate-version lineage: applying a validated EditChangeSet to a
  parent version produces an immutable CandidateVersion (content-addressed
  `contentRef` + `contentHash` on the wave-2 content-store abstraction);
  parent → candidate lineage queryable; `simulated` flags threaded from
  fixtures;
- import/export flows: format-typed interchange (ImportExportFormat) with
  deterministic export assembly and validated import; typed
  `YOU_IMPORT_EXPORT_FAILED` on invalid payloads; results
  content-addressed when succeeded;
- deterministic fixtures: seeded scenarios spanning the full arrow
  (open session → propose edit change set → validate → apply → candidate
  version → lineage query; a committed-session path; an abandoned-session
  path; an invalid-changeset refusal; a failed import path; a round-trip
  export→import identity check) — injected clock/rng, byte-identical
  replay, `simulated: true`;
- event ledger integration: edit-session-opened / change-set-applied /
  candidate-version-proposed / import-export-completed (plus the v1
  change-accepted / change-rejected where the flow calls for them) through
  the existing ledger machinery;
- tests (node:test) covering the transition tables, validators,
  immutability, lineage, interchange determinism and error taxonomy.

## W5B — Editing Experience

Branch: `you/w5b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Native/embedded/external editor orchestration surface — edit session
control, change-set proposal/review, compare/revert UX and manual takeover
flows on the W5A service seams.

Frozen write surface (wave 5):
- `packages/ui/src/you/**` + the disclosed registration-only seams (same
  pre-expanded seam list as W2B/W3B/W4B: `lib/workspaceSidePane`,
  `app-shell/animatedSidePanePanelModel`, `AnimatedSidePanePanel`,
  `SidePaneTabTrigger`, `sidePaneTabPresentation`, `WorkspaceShellLayout`,
  `app-shell/types`, `hooks/useAppPanels`, `you/index.ts`, i18n
  `en-US`/`zh-CN`).

Zero edits to any other existing file: no services, no you-lab, no root
manifest/lockfile, no new dependencies.

Acceptance:
- edit session surface: subject-artifact picker, session status ladder
  (open/committed/abandoned) rendered from controller projections — zero
  business logic in the UI (W1B/W2B/W3B/W4B controller pattern; simulated
  controller until T5 binding);
- edit change-set proposal flow: op list with content-addressed payload
  labels (never inlined content), deterministic preview of the candidate
  version against its parent;
- compare/revert UX: candidate vs parent lineage view; accept/reject
  change projections routed through the v1 change-accepted /
  change-rejected event discipline (append-only; no second authority
  path);
- editor orchestration: native / embedded / external editor kind picker
  (EditorKind taxonomy); external editor launch UX as consent-gated,
  projected flows (no ambient process control in the UI — the launch is
  a projected intent through the controller seam);
- manual takeover UX: takeover confirmation rendered from consent-state
  projections (the wave-2 consent authority; no second consent path);
- loading/error/empty states for every region; `YOU_EDIT_SESSION_NOT_FOUND`
  / `YOU_CHANGESET_INVALID` / `YOU_EDITOR_UNSUPPORTED` /
  `YOU_IMPORT_EXPORT_FAILED` surfaces as typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (registration wiring, panel
  projection, change-set flow, compare/revert, error surfaces; node:test).

## W5C — Editor Ecosystem

Branch: `you/w5c-edittech`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Research, register and benchmark provider-neutral native/embedded/external
editor technology candidates on the lab foundation; implement the
production-eligible editor adapter seam plus mock and fixture adapters, and
round-trip capability benchmarks.

Frozen write surface (wave 5):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- editor technology registry additions: researched REAL profiles for the
  candidate set — native editors (VS Code-class extensible editors,
  Monaco-class embedded editors), embedded hosts (CodeMirror-class,
  ProseMirror-class rich-text surfaces, Monaco web hosts), external
  pipelines (Blender-class DCC editing, Godot-class scene editing,
  image/video editors with round-trip format support), interchange
  toolchains (glTF-class scene interchange, USD-class scene
  composition) — license (SPDX + source URL), maintenance evidence,
  compatibility notes, provenance; `unverified: true` where not verified
  (truth law — never invent);
- capability profiles: EditorCapabilityProfile records derived from the
  registry (supportsFormats, roundTripSafe) — researched data, never a
  runtime authority;
- provider-neutral editor adapter seam: typed editor invocation →
  EditChangeSet-shaped results (content-addressed op payloads per the
  frozen v5 contract); deterministic `mockEditorAdapter` (seed-derived,
  no network) covering native/embedded/external kinds;
- production-eligible adapter: the best-license/maintenance candidate
  integrated behind the seam as a profile-backed evaluation adapter (real
  runtime integration is W6+ compute-plane territory; honest markers
  required — `not-measured (simulated)` where unmeasured);
- round-trip benchmark harness: deterministic fixtures (seeded synthetic
  edit payloads), runner scoring candidates on round-trip fidelity and
  determinism, recording effort as structured fields with honest markers;
  RoundTripBenchmarkReport assembly (fidelityScore 0..1 deterministic);
- seam mapping onto frozen v5 contracts (EditingSession/EditChangeSet/
  CandidateVersion shapes; import/export format mapping at the seam);
- tests (node:test) covering registry integrity (license + source URL,
  unique ids, no unverified-as-verified), adapter determinism
  (byte-identical replay from seed), golden round-trip scores, seam
  mapping validity (adapter outputs construct valid v5 shapes; only the
  seam module touches contract types).

## W6A — Learning Authority

Branch: `you/w6a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W6 contract-freeze commit on main).

Objective:
Implement the learning ledger, signal capture, the validation ladder,
preference projections, trajectory references and rights enforcement
application services on the frozen v6 contracts.

Frozen write surface (wave 6):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen
  (implement around it; request a TL contract update if a change is needed);
- `packages/services/src/you/**` (the you services subtree Worker A owns
  since W1A).

Zero edits to any other existing file: no UI, no you-lab, no root
manifest/lockfile, no new dependencies, no `packages/shared/src/index.ts`
changes (the v6 types already re-export through the public entry).

Acceptance:
- learning signal capture: append-only LearningSignal records across all
  six kinds (feedback / manual-takeover / edit-session /
  expert-intervention / repeated-intent / capability-gap) with
  content-addressed evidenceRefs, typed `YOU_LEARNING_SIGNAL_INVALID`
  refusals (stateless validators, no clock);
- learning ledger + validation ladder: candidate -> validated | rejected
  transitions (append-only; supersession via supersededById linkage, never
  in-place mutation); typed `YOU_LEARNING_RECORD_NOT_FOUND`;
- rights enforcement: LearningRecord usable only within its LearningRights
  grant (consentRef + consentHash traceable to the wave-2 consent
  authority; no second consent path); usage outside the grant is a typed
  `YOU_LEARNING_RIGHTS_REQUIRED` refusal; records without rights are inert;
- preference projections: LearningPreference records scoped by the v1
  LearningScope union, derived from validated records (derivedFromRecordId
  lineage), typed `YOU_PREFERENCE_SCOPE_INVALID` refusals; projections
  never mutate the ledger;
- trajectory references: content-addressed ordered stepRefs, byte-identical
  replay from seed;
- deterministic fixtures: seeded scenarios spanning the full ladder
  (signal capture -> candidate -> validated; a rejected path; a superseded
  path; a rights-refusal path; a preference derivation; a trajectory
  replay) — injected clock/rng, `simulated: true`;
- event ledger integration: learning-signal-captured /
  learning-record-validated / learning-record-rejected /
  preference-updated through the existing ledger machinery;
- tests (node:test) covering the validation ladder transition table,
  rights enforcement, immutability, preference lineage, trajectory replay,
  error taxonomy.

## W6B — Learning UX

Branch: `you/w6b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Teach-me/learn-this confirmation flows, learning replay, transparency
surfaces and user controls on the W6A service seams.

Frozen write surface (wave 6):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W5B).

Zero edits to any other existing file: no services, no you-lab, no root
manifest/lockfile, no new dependencies.

Acceptance:
- teach-me/learn-this confirmation UX: learning-signal kind picker,
  scope ladder rendered from controller projections — zero business logic
  in the UI (W1B-W5B controller pattern; simulated controller until T6
  binding);
- learning replay surface: TrajectoryReference step list (content-addressed
  labels, never inlined content) with deterministic replay projection;
- transparency surfaces: learning ledger view (status ladder
  candidate/validated/rejected/superseded), rights display (usage classes
  + consent linkage), preference list with derived-from lineage;
- user controls: consent withdrawal projection routed through the wave-2
  consent authority (no second consent path); preference clear/adjust as
  projected intents;
- loading/error/empty states for every region; the v6 typed error codes
  (`YOU_LEARNING_SIGNAL_INVALID` / `YOU_LEARNING_RECORD_NOT_FOUND` /
  `YOU_LEARNING_RIGHTS_REQUIRED` / `YOU_PREFERENCE_SCOPE_INVALID`) as
  typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (registration wiring, panel
  projections, teach-me flow, replay view, transparency surfaces, error
  surfaces; node:test).

## W6C — Organization Learning

Branch: `you/w6c-learnlab`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Research, register and benchmark what the Lab can learn from manual
takeovers — provider-neutral organization/tool/editor/pipeline learning
candidates and the learning-adapter seam with mock and fixture adapters.

Frozen write surface (wave 6):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- learning technology registry additions: researched REAL profiles for
  the candidate set — organization-improvement methods (rule-induction
  class, preference-learning class, bandit/selection class), tool/
  editor-selection learners (contextual ranking class, cost-aware
  selection class), pipeline-improvement methods (program-synthesis
  class, workflow-mining class) — license (SPDX + source URL),
  maintenance evidence, compatibility notes, provenance; `unverified:
  true` where not verified (truth law — never invent);
- capability profiles: learner capability records derived from the
  registry (input signal kinds, scopes supported, output classes);
- provider-neutral learning adapter seam: typed learning invocation
  (LearningSignal + candidate scope) -> LearningRecord-shaped candidate
  results (content-addressed per the frozen v6 contract); deterministic
  `mockLearningAdapter` (seed-derived, no network);
- production-eligible adapter: the best-license/maintenance candidate
  integrated behind the seam as a profile-backed evaluation adapter (real
  runtime integration is W7+ compute-plane territory; honest markers —
  `not-measured (simulated)`);
- benchmark harness: deterministic fixtures (seeded synthetic takeover
  trajectories), runner scoring candidates on learning fidelity and
  determinism, recording effort as structured fields with honest markers;
- seam mapping onto frozen v6 contracts (LearningSignal ->
  LearningRecord candidate construction; rights threading; only the seam
  module touches contract types);
- tests (node:test) covering registry integrity (license + source URL,
  unique ids, no unverified-as-verified), adapter determinism
  (byte-identical replay from seed), golden benchmark scores, seam mapping
  validity (adapter outputs construct valid v6 shapes).

## W7A — Agent Embodiment Authority

Branch: `you/w7a-core`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W7 contract-freeze commit on main).

Objective:
Implement Body registry, Soul binding validation, AvatarSession lifecycle
with append-only embodiment-state transitions, and embodiment policy
enforcement on the frozen v7 contracts.

Frozen write surface (wave 7):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen;
- `packages/services/src/you/**`.

Zero edits to any other existing file; no new dependencies.

Acceptance:
- Body registry: AgentBody records (content-addressed appearance,
  role/capabilities/tools/policy/memory/evaluator contract refs); typed
  `YOU_BODY_NOT_FOUND`;
- Soul binding validation: SoulBinding records with provider-neutral
  providerKind/modelRef, routing profiles (system-one/system-two), typed
  `YOU_SOUL_BINDING_INVALID` refusals (stateless validators);
- AvatarSession lifecycle: open -> active -> suspended | closed (terminals
  locked; append-only embodiment-state transitions via the
  embodiment-state-changed event — the record's state field is the
  projection head); typed `YOU_AVATAR_SESSION_NOT_FOUND` and
  `YOU_EMBODIMENT_STATE_INVALID` (the nine-state ladder enforced);
- BODY/SOUL SEPARATION LAW: soul-reassigned transitions re-possess a Body
  without mutating the Body record;
- deterministic fixtures: seeded scenarios (body registration, soul
  binding, session open, full state-ladder walk, suspend/resume, close,
  re-possession via soul-reassigned; refusal paths) — injected clock/rng,
  byte-identical replay, `simulated: true`;
- event ledger integration: avatar-session-opened /
  embodiment-state-changed / soul-reassigned / avatar-session-closed;
- tests (node:test) covering the lifecycle transition table, the state
  ladder, immutability, re-possession, error taxonomy.

## W7B — Agent Avatar Studio

Branch: `you/w7b-studio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Avatar configuration and embodied-state UX on the W7A service seams.

Frozen write surface (wave 7):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W6B).

Zero edits to any other existing file; no new dependencies.

Acceptance:
- avatar configuration surface: Body picker (role/capabilities/tools),
  Soul binding picker (providerKind/modelRef/routing profile) from
  controller projections — zero business logic in the UI (W1B-W6B
  controller pattern; simulated controller until T7 binding);
- embodied-state surface: the nine-state ladder rendered from projections
  (state changes are projected events, never UI-local state);
- session control: open/suspend/resume/close projected intents;
  re-possession (soul-reassign) flow preserving the Body contract display;
- realtime channel display: RealtimeChannelDescriptor panels
  (content-addressed stream labels, latency class);
- loading/error/empty states for every region; the v7 typed error codes
  as typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (node:test).

## W7C — Soul/Realtime

Branch: `you/w7c-soultech`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Research, register and benchmark provider-neutral LLM/VLM providers,
state-routing approaches and realtime media stacks; implement the
soul/realtime adapter seam plus mock and fixture adapters.

Frozen write surface (wave 7):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- soul/realtime technology registry additions: researched REAL profiles
  for the candidate set — LLM/VLM providers (open-weight serving stacks,
  inference runtimes, multimodal VLM families), state-routing approaches
  (system-one/system-two routing implementations, speculative-decode
  class), realtime media stacks (WebRTC-class transports, SFU-class
  servers, streaming protocols) — license (SPDX + source URL),
  maintenance evidence, compatibility notes, provenance; `unverified:
  true` where not verified (truth law — never invent);
- capability profiles: provider/routing/realtime capability records
  derived from the registry (modalities, latency classes, routing
  profiles supported);
- provider-neutral SoulAdapter seam: typed soul invocation (binding +
  routed prompt context) -> typed response records (content-addressed);
  deterministic `mockSoulAdapter` (seed-derived, no network);
- realtime adapter seam: RealtimeChannelDescriptor construction from
  channel params (content-addressed stream refs);
- production-eligible adapter: the best-license/maintenance candidate
  behind the seam as a profile-backed evaluation adapter (real runtime
  integration is W8+ compute-plane territory; honest markers —
  `not-measured (simulated)`);
- benchmark harness: deterministic fixtures, runner scoring candidates on
  response validity and determinism, structured effort fields with honest
  markers;
- seam mapping onto frozen v7 contracts (SoulBinding/AvatarSession shapes;
  only the seam module touches contract types);
- tests (node:test) covering registry integrity, adapter determinism
  (byte-identical replay from seed), golden benchmark scores, seam mapping
  validity.

## W8A — Arena Authority

Branch: `you/w8a-arena`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W8 contract-freeze commit on main).

Objective:
CapabilityGap persistence (the append-only gap + run ledgers), the
ArenaRetryPolicy validation, the EscalationAuthorization lifecycle, and
the provider-neutral Arena API/client boundary on the frozen v8
contracts.

Frozen write surface (wave 8):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen;
- `packages/services/src/you/**`.

Zero edits to any other existing file; no new dependencies.

Acceptance:
- CapabilityGap persistence: gap records persisted on the append-only
  ledger (gap-opened linkage to intent/strategies/failure evidence per
  the v1 shape); the ArenaRun ladder append-only (started -> completed |
  failed | aborted terminals locked); typed `YOU_ARENA_RUN_NOT_FOUND`;
- ArenaRetryPolicy validation: stateless validators (attempt bounds,
  backoff class format, eligibility category gates,
  requires-authorization flag); typed `YOU_RETRY_POLICY_INVALID`;
  policies that require authorization refuse unauthorized escalation
  paths with `YOU_ESCALATION_AUTHORIZATION_REQUIRED`;
- EscalationAuthorization lifecycle: grant (scope/expiry/learning
  permission), expiry, withdrawal — immutable records, new records on
  change, never mutation; typed `YOU_ESCALATION_NOT_FOUND` and
  `YOU_ESCALATION_STATE_INVALID` (the v1 ArenaEscalation ladder
  enforced);
- provider-neutral Arena client boundary: an ArenaClient seam whose
  typed invocations return typed payloads (ArenaExpertResult shapes;
  content-addressed artifacts; fail-closed on unknown providers —
  typed `YOU_ARENA_ADAPTER_UNSUPPORTED`); ArenaProviderDescriptor
  registry services (opaque provider refs);
- ARENA BOUNDARY LAW: no arena service mutates YOU state — results
  return as typed payloads applied through YOU's own authority;
- deterministic fixtures: seeded scenarios (gap detected -> run ladder
  recorded -> authorization granted -> escalation lifecycle walked ->
  result applied -> learning permission recorded; refusal paths:
  unauthorized escalation, expired authorization, invalid transition,
  invalid policy, unknown provider) — injected clock/rng,
  byte-identical replay, `simulated: true`;
- event ledger integration: arena-run-recorded / escalation-authorized
  / escalation-cancelled / learning-permission-recorded /
  gap-projection-published;
- tests (node:test) covering the run-ladder transition table, the
  authorization lifecycle, the policy validators, error taxonomy.

## W8B — Escalation UX

Branch: `you/w8b-escalation`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
User authorization, escalation progress, expert-result review and
learning-permission UX on the W8A service seams.

Frozen write surface (wave 8):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W7B).

Zero edits to any other existing file; no new dependencies.

Acceptance:
- authorization surface: the escalation gate (scope, expiry, learning
  permission picker none/aggregate/full) from controller projections —
  zero business logic in the UI (W1B-W7B controller pattern; simulated
  controller until T8 binding);
- progress surface: the escalation status ladder (requested ->
  authorized -> in-progress -> delivered -> applied | rejected |
  cancelled) rendered from projected events — never UI-local state;
- expert-result review: ArenaExpertResult panels (typed-payload /
  artifact / guidance; content-addressed artifact labels;
  applies-as-changeset actions as projected intents);
- gap display: CapabilityGap panels (category, confidence, attempted
  strategies, failure-evidence links) from projections;
- learning-permission display + withdrawal projection (the wave-6
  rights-law display pattern);
- loading/error/empty states for every region; the v8 typed error codes
  (YOU_ESCALATION_NOT_FOUND / YOU_ESCALATION_STATE_INVALID /
  YOU_ESCALATION_AUTHORIZATION_REQUIRED / YOU_ARENA_RUN_NOT_FOUND /
  YOU_RETRY_POLICY_INVALID / YOU_ARENA_ADAPTER_UNSUPPORTED /
  YOU_GAP_PROJECTION_INVALID) as typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (node:test).

## W8C — Arena Automation

Branch: `you/w8c-automation`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Research, register and benchmark gap-detection and retry/backoff
approaches; implement the Arena adapter seam plus deterministic mock
and the ToolGap/Knowledge projections.

Frozen write surface (wave 8):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- gap-detection research: deterministic detector approaches for the v1
  CapabilityGapCategory classes (tool/editor/model/skill/knowledge/
  data/expert) — researched REAL approaches with license (SPDX + source
  URL), maintenance evidence, compatibility notes, provenance;
  `unverified: true` where not verified (truth law — never invent);
- retry/backoff registry: researched REAL retry/backoff approaches
  (circuit-breaker class, hedged-request class, exponential backoff
  with jitter class, token-bucket class) — license, maintenance
  evidence, provenance; production-eligible pick behind the seam;
- Arena adapter seam: typed provider-neutral adapter (the
  ArenaProviderDescriptor boundary; invocation -> typed result
  records, content-addressed); deterministic `mockArenaAdapter`
  (seed-derived, no network); fail-closed evaluation adapter (refuses
  construction if the registry derivation shifts — the W6C/W7C
  pattern);
- ToolGap/Knowledge projections: projection builders from CapabilityGap
  records (ToolGapProjection / KnowledgeGapProjection shapes; derived
  remediation strings; typed `YOU_GAP_PROJECTION_INVALID` on
  malformed gap records);
- benchmark harness: deterministic fixtures, runner scoring detectors
  and adapters on validity + determinism, structured effort fields with
  honest markers (real runtime integration is W9+ compute-plane work);
- seam mapping onto frozen v8 contracts (the contractSeam.ts
  consolidation; only the seam module touches contract types);
- tests (node:test) covering registry integrity, adapter determinism
  (byte-identical replay from seed), golden benchmark scores, seam
  mapping validity, projection builders.

## W9A — Lab Persistence

Branch: `you/w9a-labpersistence`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W9 contract-freeze commit on main).

Objective:
Durable LabExperiment/LabRun records, content-addressed evidence
manifests, the promotion gate, and the lab event integration on the
frozen v9 contracts.

Frozen write surface (wave 9):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen;
- `packages/services/src/you/**`.

Zero edits to any other existing file; no new dependencies.

Acceptance:
- LabExperiment persistence: immutable experiment records (intentRef,
  constraintsHash, objective, arms per the LAB.md three-arm law);
  typed `YOU_LAB_EXPERIMENT_NOT_FOUND`;
- LabRun ladder: append-only run records (submitted -> running ->
  succeeded | failed | retired terminals locked); typed
  `YOU_LAB_RUN_NOT_FOUND`;
- LabEvidenceManifest: content-addressed bundles (runId, contentHash,
  artifactRefs); manifest verification (hash mismatch fails closed);
  typed `YOU_LAB_EVIDENCE_MANIFEST_INVALID`;
- LabPromotionRecord: the promotion gate (a searched arm promotes ONLY
  when it beats the generalist baseline under the recorded objective
  and constraints — the LAB PROMOTION LAW); immutable records,
  reversals as new records; typed `YOU_LAB_PROMOTION_INVALID`;
- LAB PERSISTENCE LAW enforced: no record mutated in place; the run
  ladder append-only;
- deterministic fixtures: seeded scenarios (experiment declared ->
  three arms run -> evidence published -> promotion decided; refusal
  paths: invalid promotion, unknown experiment/run, malformed
  manifest) — injected clock/rng, byte-identical replay,
  `simulated: true`;
- event ledger integration: lab-run-recorded / lab-evidence-published
  / lab-promotion-decided;
- tests (node:test) covering the run-ladder transition table, the
  promotion gate refusal paths, manifest verification, error taxonomy.

## W9B — Lab Studio

Branch: `you/w9b-labstudio`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Lab and benchmark Solution experiences on the W9A service seams.

Frozen write surface (wave 9):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W8B).

Zero edits to any other existing file; no new dependencies.

Acceptance:
- experiment surface: the LabExperiment declaration + three-arm
  comparison display (generalist baseline / hand-designed / searched)
  from controller projections — zero business logic in the UI
  (W1B-W8B controller pattern; simulated controller until T9 binding);
- run surface: the LabRun status ladder (submitted -> running ->
  succeeded | failed | retired) rendered from projected events — never
  UI-local state;
- evidence surface: LabEvidenceManifest panels (content-addressed
  artifact labels, verification status);
- promotion surface: LabPromotionRecord display (winner arm, objective
  vs baseline scores, evidence links) + the promotion gate refusal
  states;
- loading/error/empty states for every region; the v9 typed error codes
  (YOU_LAB_RUN_NOT_FOUND / YOU_LAB_EXPERIMENT_NOT_FOUND /
  YOU_LAB_EVIDENCE_MANIFEST_INVALID / YOU_LAB_PROMOTION_INVALID /
  YOU_LAB_WORLD_INVALID / YOU_SEARCH_LADDER_INVALID) as typed error
  panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (node:test).

## W9C — Research Organization

Branch: `you/w9c-researchorg`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Deterministic worlds, the search/RL ladder, Failure Atlas, Pipeline
Genome, and promotion evidence inside the lab research plane.

Frozen write surface (wave 9):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- LabWorldDescriptor machinery: seed-derived deterministic worlds
  (actors, ground truth, cameras — the LAB.md world model); same seed
  -> byte-identical world; typed `YOU_LAB_WORLD_INVALID`;
- search/RL ladder: SearchLadderStep append-only exploration under an
  explicit cumulative budget (the SEARCH BUDGET LAW); budget
  exhaustion is a recorded terminal; typed `YOU_SEARCH_LADDER_INVALID`;
- Failure Atlas: FailureAtlasEntry builders from world-run outcomes
  (immutable observations with evidence refs — the FAILURE ATLAS LAW);
- Pipeline Genome: append-only lineage nodes (parentRef, mutationKind,
  score, generation) with determinism from seed;
- promotion evidence: benchmark harness producing the reproducible
  organization/pipeline evidence the promotion gate consumes (the
  stage-9 exit: HUMAN-REALITY benchmark produces reproducible
  organization/pipeline evidence);
- seam mapping onto frozen v9 contracts (the contractSeam.ts
  consolidation; only the seam module touches contract types);
- tests (node:test) covering world determinism (byte-identical replay
  from seed), ladder budget terminals, atlas entry builders, genome
  lineage integrity, golden benchmark scores, seam mapping validity.

## W10A — Platform Hardening

Branch: `you/w10a-platform`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W10 contract-freeze commit on main).

Objective:
The platform hardening authority: rate-limit policies + enforcement
records, import security verdicts + quarantine, retention
enforcement, DR restore verification on the frozen v10 contracts.

Frozen write surface (wave 10):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen;
- `packages/services/src/you/**`.

Zero edits to any other existing file; no new dependencies.

Acceptance:
- RateLimitPolicy machinery: typed policies (scope/window/burst/
  action); enforcement BEFORE effect; append-only enforcement records;
  typed `YOU_RATE_LIMIT_EXCEEDED`; never-silent throttling (the RATE
  LIMIT LAW);
- ImportSecurityVerdict: scan classes, clean/quarantined/rejected
  verdicts; fail-closed quarantine, release only via explicit records
  (the IMPORT SECURITY LAW); typed `YOU_IMPORT_QUARANTINED`;
- RetentionEnforcementRecord: immutable auditable passes; retention
  NEVER overrides an active consent (the wave-2 consent laws);
  typed `YOU_RETENTION_ENFORCEMENT_INVALID`;
- DrRestoreRecord: content-hash verification BEFORE activation; the
  verified flag never asserted without check evidence (the DR LAW);
  typed `YOU_DR_RESTORE_INVALID`;
- deterministic fixtures: seeded scenarios (policy enforced -> import
  scanned -> quarantine -> release -> retention pass -> DR restore
  verified; refusal paths: limit exceeded, unscanned import,
  consent-protected retention, unverifiable restore) — injected
  clock/rng, byte-identical replay, `simulated: true`;
- event ledger integration: rate-limit-enforced / import-quarantined /
  retention-enforced / dr-restore-recorded;
- tests (node:test) covering the enforcement gates, the quarantine
  lifecycle, retention-vs-consent, restore verification, error
  taxonomy.

## W10B — Product Hardening

Branch: `you/w10b-product`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
The hardening UX on the W10A service seams: limit notices, import
statuses, retention controls, DR status, release readiness.

Frozen write surface (wave 10):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W9B).

Zero edits to any other existing file; no new dependencies.

Acceptance:
- limit-notice surface: rate-limit states (deny/defer/shed with window
  and retry guidance) from controller projections — zero business
  logic in the UI (W1B-W9B controller pattern; simulated controller
  until T10 binding);
- import-status surface: scan classes and verdicts (clean / quarantined
  with release actions as projected intents / rejected);
- retention-control surface: retention classes with consent-protected
  indicators (the consent laws displayed);
- DR status surface: restore records with verification states;
- release-readiness surface: ProductionEligibilityRecord panels
  (eligible/blocked, rollback evidence links);
- loading/error/empty states for every region; the v10 typed error
  codes (YOU_RATE_LIMIT_EXCEEDED / YOU_IMPORT_QUARANTINED /
  YOU_RETENTION_ENFORCEMENT_INVALID / YOU_DR_RESTORE_INVALID /
  YOU_PROVIDER_MATRIX_INVALID / YOU_PRODUCTION_ELIGIBILITY_INVALID)
  as typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (node:test).

## W10C — Ecosystem Hardening

Branch: `you/w10c-ecosystem`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
The ecosystem hardening plane: provider matrix registry, cost/latency
budget guards, production eligibility + rollback evidence, and the
stage-10 ecosystem additions researched behind fail-closed adapter
seams.

Frozen write surface (wave 10):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- ProviderMatrixEntry registry: the ecosystem gate (providers,
  regions, styles, export classes); fail-closed on unknown refs;
  typed `YOU_PROVIDER_MATRIX_INVALID` (the ECOSYSTEM GATE LAW);
- CostLatencyBudget guards: budget descriptors with breaker classes
  (the researched circuit-breaker/hedged/jittered/token-bucket classes
  from W8C carried forward); fail-closed enforcement;
- ProductionEligibilityRecord: eligibility decisions requiring
  rollback evidence; immutable records, reversals as new records (the
  PRODUCTION ELIGIBILITY LAW); typed
  `YOU_PRODUCTION_ELIGIBILITY_INVALID`;
- stage-10 ecosystem research: REAL approaches with license (SPDX +
  source URL), maintenance evidence, compatibility notes, provenance
  for the ecosystem classes (virtual try-on, game/VRM/GLB exports,
  AR, realtime telepresence, customer-owned compute, additional
  regional providers, additional styles); `unverified: true` where not
  verified (truth law — never invent);
- deterministic mock adapters behind the seams (seed-derived, no
  network); fail-closed evaluation adapters (refuse construction when
  the registry derivation shifts — the W6C/W7C/W8C pattern);
- seam mapping onto frozen v10 contracts (the contractSeam.ts
  consolidation; only the seam module touches contract types);
- tests (node:test) covering matrix integrity, budget determinism,
  eligibility refusal paths, adapter determinism (byte-identical
  replay from seed), golden scores, seam mapping validity.

## W11A — Security Authority

Branch: `you/w11a-security`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W11 contract-freeze commit on main).

Objective:
The hardening-verification authority: threat-model entries, security
review records, load-test reports on the frozen v11 contracts.

Frozen write surface (wave 11):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen;
- `packages/services/src/you/**`.

Zero edits to any other existing file; no new dependencies.

Acceptance:
- ThreatModelEntry persistence: immutable entries (threatClass,
  vector, mitigationRef, residual stated honestly — never zeroed by
  assertion); typed `YOU_SECURITY_REVIEW_INVALID`;
- SecurityReviewRecord: findings recorded verbatim; acceptance as a
  separate immutable decision referencing the finding set (the
  SECURITY REVIEW LAW);
- LoadTestReport: measured or simulated-labeled peak/p99 — never
  invented; regressions listed verbatim (the LOAD TEST LAW); typed
  `YOU_LOAD_TEST_INVALID`;
- deterministic fixtures: seeded scenarios (threat modeled -> review
  recorded -> findings accepted -> load test run -> regression listed;
  refusal paths: acceptance without findings, invented metrics,
  malformed report) — injected clock/rng, byte-identical replay,
  `simulated: true`;
- event ledger integration: security-review-recorded /
  load-test-recorded;
- tests (node:test) covering the review lifecycle, the metrics truth
  law, error taxonomy.

## W11B — Conformance UX

Branch: `you/w11b-conformance`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
The conformance surfaces on the W11A service seams: security review
status, load test reports, conformance audits, journey reports, the
incident runbook display.

Frozen write surface (wave 11):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W10B).

Zero edits to any other existing file; no new dependencies.

Acceptance:
- review surface: security review records (findings, acceptance state)
  from controller projections — zero business logic in the UI
  (W1B-W10B controller pattern; simulated controller until T11
  binding);
- load-test surface: reports with peak/p99 and regression lists
  (simulated-labeled indicators);
- conformance surface: audits with checks-total/checks-passed verbatim
  (the CONFORMANCE LAW displayed — never a bare pass);
- journey surface: E2E journey records (steps completed, failed step,
  duration) — the launch-gate 20-point journey display;
- runbook surface: incident entries with detection/containment/
  recovery + exercised/unexercised states;
- loading/error/empty states for every region; the v11 typed error
  codes as typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (node:test).

## W11C — E2E Runbook

Branch: `you/w11c-e2e`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
The deterministic E2E journey harness and the incident runbook
machinery: golden journeys, failure injection, runbook exercising.

Frozen write surface (wave 11):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- E2E journey harness: deterministic golden journeys (seed-derived,
  no network) covering the 20-point launch-gate journey (workspace
  creation -> intent -> Solution -> inspect -> feedback -> evidence ->
  Twin -> improve -> Performance -> render -> edit -> import/export ->
  version accept -> learn with permission -> repeat -> capability gap
  -> Arena escalation -> expert result -> provenance/consent ->
  injected-failure recovery); typed `YOU_E2E_JOURNEY_INVALID`;
- failure injection: deterministic injected failures at each journey
  step (the recovery paths exercised); journey records with failedStep
  + measured durationMs (the JOURNEY LAW);
- IncidentRunbookEntry machinery: detection/containment/recovery per
  incident class; every entry exercised by at least one injected-
  failure journey or explicitly marked unexercised (the RUNBOOK LAW);
  typed `YOU_RUNBOOK_INVALID`;
- conformance audit builders: checks-total/checks-passed verbatim from
  the harness runs (the CONFORMANCE LAW); typed
  `YOU_CONFORMANCE_AUDIT_INVALID`;
- seam mapping onto frozen v11 contracts (the contractSeam.ts
  consolidation; only the seam module touches contract types);
- tests (node:test) covering journey determinism (byte-identical
  replay from seed), failure-injection coverage (every step has a
  recovery path), runbook exercising, golden journey scores, seam
  mapping validity.

## W12A — Launch Gate Authority

Branch: `you/w12a-gate`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch (the W12 contract-freeze commit on main).

Objective:
The launch-gate authority: the 20-point checklist, the operator
sign-off, the release declaration on the frozen v12 contracts.

Frozen write surface (wave 12):
- `packages/shared/src/you/**` — EXCEPT `you/contract.ts` is TL-frozen;
- `packages/services/src/you/**`.

Zero edits to any other existing file; no new dependencies.

Acceptance:
- LaunchGateChecklistRecord: the 20-point checklist built from
  E2eJourneyRecord evidence (a point passes ONLY with a successful
  journey reference — the LAUNCH GATE LAW); typed
  `YOU_LAUNCH_GATE_INVALID`;
- OperatorSignoffRecord: references a COMPLETE passing checklist;
  immutable; one release per signoff (the OPERATOR SIGNOFF LAW); typed
  `YOU_OPERATOR_SIGNOFF_INVALID`;
- ReleaseDeclarationRecord: evidence bundle + rollback evidence
  required (the RELEASE DECLARATION LAW); typed
  `YOU_RELEASE_DECLARATION_INVALID`;
- deterministic fixtures: seeded scenarios (journeys run -> checklist
  assembled -> gate passes -> operator signs -> release declared;
  refusal paths: incomplete checklist, signoff without a passing gate,
  declaration without rollback evidence) — injected clock/rng,
  byte-identical replay, `simulated: true`;
- event ledger integration: launch-gate-checked /
  operator-signoff-recorded / release-declared;
- tests (node:test) covering the 20-point gate, the signoff lifecycle,
  the declaration refusals, error taxonomy.

## W12B — Release UX

Branch: `you/w12b-release`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
The launch-gate surfaces on the W12A service seams: the 20-point
checklist display, the sign-off state, the release declaration.

Frozen write surface (wave 12):
- `packages/ui/src/you/**` + the disclosed registration-only seams (the
  same pre-expanded seam list as W2B-W11B).

Zero edits to any other existing file; no new dependencies.

Acceptance:
- checklist surface: the 20 points with journey-evidence links and
  pass states from controller projections — zero business logic in the
  UI (W1B-W11B controller pattern; simulated controller until T12
  binding);
- signoff surface: the operator sign-off state (signed-by, signed-at,
  the referenced checklist);
- declaration surface: the release declaration (evidence bundle +
  rollback links);
- loading/error/empty states for every region; the v12 typed error
  codes as typed error panels;
- i18n: en-US + zh-CN strings for every visible label;
- dedicated UX tests under the you subtree (node:test).

## W12C — Gate Evidence

Branch: `you/w12c-evidence`. Base SHA: recorded by the TL in
`TASK_LEDGER.md` at dispatch.

Objective:
Binding the W11C journey harness outputs to the launch gate: the
evidence bundle builder, the gate checklist derivation, the golden
gate run.

Frozen write surface (wave 12):
- `packages/you-lab/**` ONLY. Zero edits outside.

Acceptance:
- evidence bundle builder: assembles the E2eJourneyRecord set (the
  20-point golden journey + the failure-injection recovery runs) into
  the content-addressed evidence bundle the declaration references;
- gate checklist derivation: LaunchGateChecklistPoint derivation from
  the journey harness outputs (point N passes only with point-N
  journey evidence — the LAUNCH GATE LAW at the compute plane);
- golden gate run: the deterministic full-gate scenario (all 20 points
  green, signoff, declaration) — byte-identical replay from seed;
- rollback evidence: the declaration's rollback reference derives from
  the W10C production-eligibility machinery (carried forward);
- seam mapping onto frozen v12 contracts (the contractSeam.ts
  consolidation; only the seam module touches contract types);
- tests (node:test) covering bundle determinism, checklist derivation
  refusal paths, the golden gate run, seam mapping validity.
