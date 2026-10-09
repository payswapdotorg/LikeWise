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

Objective:
Performance/RenderJob/Artifact services.

## W4B — Performance Studio

Objective:
Timeline/template/performance/output review.

## W4C — Performance/Render Technologies

Objective:
Motion extraction, retargeting and image/video/3D render adapters.

## W5A — Editing Authority

Objective:
EditSession, ChangeSet, artifact lineage and import/export services.

## W5B — Editing Experience

Objective:
Native/embedded/external editor orchestration, takeover UX, compare/revert.

## W5C — Editor Ecosystem

Objective:
Technology registry profiles, adapters and round-trip benchmarks for editors.

## W6A — Learning Authority

Objective:
Learning ledger, preference scopes, trajectory references and rights.

## W6B — Learning UX

Objective:
Teach-me/learn-this confirmation, replay, transparency and user controls.

## W6C — Organization Learning

Objective:
Learn better organizations, tools, editors and pipelines from manual takeovers.

## W7A — Agent Embodiment Authority

Objective:
Body/Soul/Avatar Session APIs and policy.

## W7B — Agent Avatar Studio

Objective:
Avatar configuration and embodied-state UX.

## W7C — Soul/Realtime

Objective:
LLM/VLM adapters, state routing and realtime media research.

## W8A — Arena Authority

Objective:
CapabilityGap persistence and provider-neutral Arena API/client boundary.

## W8B — Escalation UX

Objective:
User authorization, progress, expert-result review and learning permission.

## W8C — Arena Automation

Objective:
Gap detection, retry policy, Arena adapter, ToolGap/Knowledge projections.

## W9A — Lab Persistence

Objective:
Durable experiment/run/evidence manifests.

## W9B — Lab Studio

Objective:
Lab and benchmark Solution experiences.

## W9C — Research Organization

Objective:
worlds, search, RL ladder, Failure Atlas, Pipeline Genome, promotion.

## W10A — Platform Hardening

Objective:
security, reliability, rate limits, import security, data retention, DR.

## W10B — Product Hardening

Objective:
full E2E, accessibility, responsive behavior, release UX.

## W10C — Ecosystem Hardening

Objective:
provider matrix, cost/latency, production eligibility and rollback evidence.
