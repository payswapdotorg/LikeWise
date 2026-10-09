# YOU Task Ledger

Status values:
- READY
- ACTIVE
- BLOCKED
- REVIEW
- DONE

Evidence is mandatory before DONE.

## Wave graph

```
T0 TL baseline + contract freeze
 |
 v
W1A + W1B + W1C   [3-way concurrent]
 |       |       |
 +-------+-------+
         |
      T1 integration/review
         |
W2A + W2B + W2C   [3-way concurrent]
         |
        T2
         |
W3A + W3B + W3C
         |
        T3
         |
W4A + W4B + W4C
         |
        T4
         |
W5A + W5B + W5C
         |
        T5
         |
W6A + W6B + W6C
         |
        T6
         |
W7A + W7B + W7C
         |
        T7
         |
W8A + W8B + W8C
         |
        T8
         |
W9A + W9B + W9C
         |
        T9
         |
W10A + W10B + W10C
         |
        T10 final hardening/release
```

Each wave is internally parallel. The TL can authorize a wave only when dependencies are satisfied.

## Current bootstrap dispatch

- Repository anchor SHA: `8e4c6cf489da92f1a602cccab2b8516f7247ea68`
- Bootstrap head at T0 execution: `5a787eeec9151d5a025e3852f95a898eac6f019a`
- YOU-000: GitHub issue #1 — **T0 EXECUTED** (see T0 record below)
- YOU-101: GitHub issue #2 — W1A MERGED (PR #6, merge 55e4dbd; worker commit 8a5959c)
- YOU-102: GitHub issue #3 — W1B MERGED (PR #7, merge 71269f4; worker commit cff66d4)
- YOU-103: GitHub issue #4 — W1C MERGED (PR #8, merge 3b059e3; worker commit 85b597a) — issue closed
- Status: **W1 COMPLETE (A+B+C landed, station-verified); T1 EXECUTED** (see T1 record)

## T0 — TL baseline and contract freeze (DONE)

Executed by the TL per issue #1 (YOU-000):

- T0.1 baseline/freshness audit: `node scripts/check-workspace-freshness.mjs`
  → baseline fresh, in sync with origin/main (ahead 0 / behind 0).
- T0.2 module context map: `docs/you/REPO_MAP.md` verified against the live
  tree (app-shell/v4 workbench authority, browser-use + artifact surfaces,
  platform abstraction, services layout) and adopted as the wave-1 module
  map.
- T0.3 contract freeze: `packages/shared/src/you/contract.ts` (frozen v1
  machine types, exported through the `@zcode/shared` public entry) +
  `docs/you/CONTRACTS.md` "Wave-1 contract freeze (v1)" section. Covers
  Solution/EditSession/ChangeSet/CapabilityGap/Arena + protocol, events,
  typed errors.
- T0.4 package ownership map (frozen write surfaces): W1A =
  `packages/shared/src/you/**` (except TL-frozen `contract.ts`) +
  `packages/services/src/you/**`; W1B = `packages/ui/src/you/**` +
  disclosed registration-only seams in `app-shell`/`v4`; W1C =
  `packages/you-lab/**` (new isolated package). Pinned in
  `docs/you/WORK_ORDERS.md`.
- T0.5 dependency policy: zero new dependencies in wave 1; workers may not
  touch root manifests/lockfiles; TL serializes root reconciliation at T1
  (root typecheck list registration for `you-lab` included).
- T0.6 deterministic fixture strategy: `docs/you/FIXTURES.md` (added to the
  authority chain).
- T0.7 acceptance suite skeleton: `docs/you/OPERATOR_ACCEPTANCE.md` confirmed
  as the Phase-0 gate spec; each W1 order carries its acceptance slice as
  tests (node:test); the integrated acceptance battery assembles at T1.
- First gate confirmed: **Solution Runtime / Operator Review** (Phase-0 stop
  condition unchanged).

## W1 dispatch record

- Base SHA for W1A/W1B/W1C: `ff26821fec5bf42c506d47ef97d76fc2b6ca1f1b`
  (the T0 merge commit on `main`; branches cut from it by the TL).
- Tests: node:test, executed by the station (`pnpm exec tsx --test`);
  station verification battery: `pnpm typecheck`, `pnpm lint`,
  `pnpm architecture:check -- --changed`, package tests.
- No CI workflow exists in this repository yet; the TL station is the
  verification authority for wave 1 (recorded as a deviation; CI
  introduction is a TL-owned follow-up).

## W1 merge records (TL station)

### W1A — Core Solution Authority (MERGED)
- PR #6 -> merge 55e4dbd (worker commit 8a5959c on `you/w1a-core`, base 8902c40).
- Station verification 2026-10-07: install exit 0; tsc -b green (rpc/provider/provider_node/shared + services/client/server/zcode-server-cli chunks; ui/web/desktop base-identical, verified green on tree); lint 0 errors / 70 warnings = exact baseline; tests 112/112.
- Evidence: worker report (in-replay session w1a, chat f6e807ff) archived at the TL station; PR #6 body carries the gate table.
- Deviations accepted: service split (oxlint max-lines), test-discovery index.ts files, cross-package relative imports, Phase-0 local types (candidates for W5A/W6A freeze).

### W1B — Solution Studio (MERGED)
- PR #7 -> merge 71269f4 (worker commit cff66d4 on `you/w1b-studio`, base 8902c40).
- Station verification 2026-10-07: install exit 0; tsc -b green incl. packages/ui; web + desktop host green; lint 0 errors / 70 warnings = exact baseline; tests 30/30.
- Seam arbitration (TL RULING): the 5 disclosed registration files outside app-shell/v4 (lib/workspaceSidePane.ts, hooks/useAppPanels.ts, App.tsx, i18n en-US/zh-CN; 63 additive lines) ACCEPTED — the pane-type union/tab-state/title catalog physically live there; the order's own example implements exactly these lines. Future order authoring pre-expands the seam list.
- Deferred to T1: bind SolutionSurfaceController to solutionService (retire simulated controller), youMessages catalog merge, operator demo UX evidence, office-mode surface policy.

### W1C — Lab Foundation (MERGED)
- PR #8 -> merge 3b059e3 (worker commit 85b597a on `you/w1c-lab`, base 8902c40).
- First dispatch 2026-10-07 06:39Z died (assistant turn never spawned — sandbox-slot
  spawn wall; all 3 slots held by stale chats). Re-dispatched by the successor TL
  2026-10-07 ~18:16Z after releasing stale holders (chat aa89af7f, agents-tab +
  GLM-5.3 + Full-Stack, prompt insert 100% VERIFIED); worker session completed
  ~19:31Z same day.
- Station verification 2026-10-07 (gate parity EXACT with worker report):
  package typecheck clean; tests 43/43 (double-run byte-identical determinism);
  lint 0 errors / 70 warnings = exact baseline (0 from you-lab); install exit 0.
- Write surface compliance verified: 24 files, +3075 lines, all inside
  `packages/you-lab/**`; zero files outside.
- Deviations accepted: typescript ^6.0.2 (sibling-matched), tsconfig rootDir drop
  + composite:false (inert with noEmit; required by prescribed relative seam),
  guarded suite-entry in index.ts (ESM-only package), seedProfiles split
  (oxlint max-lines), research via npm/PyPI/raw.githubusercontent/atom feeds
  (GitHub REST rate-limited from sandbox).
- Research disclosure reviewed: 10 candidate profiles, license/maintenance
  web-verified with source URLs; unverified claims explicitly labeled (truth law).

## T1 — Wave-1 integration (EXECUTED)

Executed by the TL station on main after the W1C merge (3b059e3):

- T1.1 root typecheck registration: `packages/you-lab` appended to the root
  `typecheck` script's `tsc -b` project list (root `package.json`, TL-owned).
- T1.2 lockfile reconciliation: `pnpm install --ignore-scripts` exit 0 (25.4s);
  `pnpm-lock.yaml` carries the you-lab entry (workspace glob `packages/*`
  auto-includes the package; no workspace file edits needed).
- T1.3 integrated battery (station, chunked tsc per 4GB-box practice):
  `tsc -b packages/you-lab` exit 0; chunk1 (rpc/provider/provider-node/shared)
  exit 0; chunk2 (services/client/server/zcode-server-cli) exit 0; lint 0 errors /
  70 warnings = exact baseline; `pnpm architecture:check -- --changed` OK,
  violations 0.
- T1.4 integrated you-test battery: you-lab 43/43, shared/you 97/97,
  services/you 15/15, ui/you 30/30 — **185/185 pass**.
- T1.5 resulting SHA recorded in this commit (see git log).
- Deferred to operator review: the Phase-0 Solution Runtime / Operator Gate
  (OPERATOR_ACCEPTANCE.md) — the operator judges the running application
  (deterministic demo across the W1A+W1B+W1C surfaces) before wave-2 dispatch
  proceeds beyond contract freeze.

## Operator greenlight (W2 authorization)

- 2026-10-07, live operator directive (session
  web-15e70763/chat 0168fd97): "continuous resident watch from here on:
  monitor → harvest → review → approve/require-changes → dispatch next,
  until the roadmap is complete. No early returns. Use the github repo as
  guide for roadmap. always fix the replay."
- Interpretation recorded by the TL: the operator delegates wave
  review/approval authority to the TL station for the resident watch and
  authorizes continuous progression through the roadmap stages
  (repo docs = roadmap authority). Phase-0 gate resolved as
  GREENLIT-ON-RECORDED-EVIDENCE (station battery 185/185, gate-parity
  station verification of all three W1 lanes) — live demo staging
  remains a best-effort retry during worker runtime (host OOM pressure
  noted in the prior session; environmental, not a repo defect). The
  gate stays reopenable: any Phase-0 acceptance regression found at T2
  re-opens it before W3.
- Environment note: the TL station sandbox was reset between T1 and the W2
  freeze (2026-10-08 ~01:2x UTC); the replay stack was redeployed from the
  canonical reset path (deploy.sh, profile durable — login preserved) and
  the likewise clone restored from origin/main 5b91aed. No delivered work
  was affected; the W2 freeze was re-authored station-side before dispatch.

## W2 dispatch record

- Wave-2 contract freeze (v2): machine authority extended ADDITIVELY in
  `packages/shared/src/you/contract.ts` (evidence/capture/consent types,
  event types, error codes); prose authority
  `docs/you/CONTRACTS.md` "Evidence / capture / consent" + "Wave-2
  contract freeze (v2)"; full W2A/W2B/W2C orders frozen in
  `docs/you/WORK_ORDERS.md`.
- Base SHA for W2A/W2B/W2C: the W2 contract-freeze commit on main
  (recorded below at dispatch; branches cut from it by the TL).
- Dependency policy wave 2: zero new runtime dependencies; workers do
  not touch root manifests/lockfiles; TL serializes root reconciliation
  at T2 (none expected — no new packages).
- Write surfaces: W2A `packages/shared/src/you/**` (except TL-frozen
  `contract.ts`) + `packages/services/src/you/**`; W2B
  `packages/ui/src/you/**` + disclosed registration-only seams; W2C
  `packages/you-lab/**`.
- Tests: node:test via `pnpm exec tsx --test` (station battery per W1
  practice: package typechecks chunked, lint baseline 0 errors /
  70 warnings, you-test battery per package).

### W2C merge record (2026-10-09)

- Status: MERGED. Owner: Worker C (GLM-5.3 agent session), station-verified
  by TL. Branch: `you/w2c-capture-tech`. Base SHA: `437e380`.
- PR #12; merge commit `e7484ea`; worker commit `d554e94`
  (26 files, +3178/−15, ALL inside `packages/you-lab/**` — surface PASS).
- Station battery (gate-parity, re-run — not worker-reported):
  `tsc -b packages/you-lab` exit 0; `pnpm lint` 0 errors / 70 warnings =
  exact baseline; `tsx --test packages/you-lab` **113/113** (43 W1C + 70
  new W2C; station double-run identical — determinism confirmed);
  frozen `contract.ts` diff vs base: NONE.
- Delivery report harvested from the worker chat (archived at the station
  replay logs). Honest-research practices verified: real license fetches
  with disclosed AGPL-3.0-only inference; non-attributable npm/PyPI
  entries excluded; benchmark candidates explicitly labeled NOT
  measurements of real technologies; additive `github-commit`
  maintenance-signal kind for release-less projects.
- Disclosed deviations accepted (all in-surface, justified): package-root
  `index.ts` for the station command form; consumer-sim runner-entry
  extension; registry.ts additive union member.
- Environment note: W2 workers were first dispatched 2026-10-08 01:33Z
  into a site-wide generation outage (~23.5h); all three chats rolled.
  Sandbox reset #2 (2026-10-09 ~01:30Z) additionally wiped the station
  replay; both absorbed (replay rebuilt via canonical path, workers
  re-dispatched 02:0xZ from re-authored prompts). W2C delivered ~02:5xZ
  on the re-dispatch.
- W2A/W2B remain in flight at this record.

### W2A merge record (2026-10-09)

- Status: MERGED. Owner: Worker A (GLM-5.3 agent session), station-verified
  by TL. Branch: `you/w2a-core`. Base SHA: `437e380`. PR #13; merge
  commit `b1e3770`; worker commit `3267917` (24 files, +4459, ALL inside
  `packages/shared/src/you/**` + `packages/services/src/you/**`).
- Station battery (gate-parity, re-run): `tsc -b shared services` exit 0;
  lint 0 errors / 70 warnings = exact baseline; shared/you **135/135**
  (113 W1A + 22 new); services/you **39/39** (19 W1A + 20 new); frozen
  `contract.ts` untouched.
- All 9 order-required coverage areas verified (immutability, typed hash
  mismatch, consent golden matrix, withdrawal semantics, capture state
  machine, review supersession, retention paths, byte-identical replay,
  ledger replay === live projection). No CONTRACT-CHANGE-REQUEST.
- Delivery report archived station-side. Session marked DONE (slot freed).

### W2B merge record (2026-10-09)

- Status: MERGED. Owner: Worker B (GLM-5.3 agent session), station-verified
  by TL. Branch: `you/w2b-studio`. Base SHA: `437e380`. PR #14; merge
  commit `f3e73e7`; worker commit `2e6d0bf` (37 files = 24 new in
  `packages/ui/src/you/**` + 13 authorized seam files; +5756/−6).
- Station battery (gate-parity, re-run): `tsc -b packages/ui` exit 0
  (station re-run after memory freed — host 4GB OOM constraint handled
  per T1 chunking practice); lint 0 errors / 70 warnings = exact baseline;
  ui/you **81/81** (46 W1B + 35 new); frozen `contract.ts` untouched.
- Coverage verified: store/selector logic, consent-state projection
  (no-permission⇒no-processing matrix), storyboard/demo determinism,
  registration wiring + keyboard parity, controller state machine,
  enforcement, review supersession, retention expiry/purge, hash
  mismatch, append-only ledger, loading/error/empty states. No
  CONTRACT-CHANGE-REQUEST.
- Delivery report archived station-side. Session marked DONE (slot freed).

### T2 integration record (2026-10-09)

- WAVE 2 COMPLETE: freeze (437e380) → W2A (PR #13, b1e3770) → W2C
  (PR #12, e7484ea) → W2B (PR #14, f3e73e7) → T2 integrated.
- Integrated main battery: typecheck chunked (shared+services+you-lab / ui
  / rpc+provider+provider-node / client+server+zcode-server-cli) ALL
  exit 0; lint 0 errors / 70 warnings = exact baseline; integrated
  you-battery **368/368** (shared 135 + services 39 + ui 81 + you-lab
  113); root manifest + lockfile untouched vs freeze (wave-2 dependency
  policy PASS — zero new dependencies).
- Phase-0 gate: remains GREENLIT-ON-RECORDED-EVIDENCE; live demo staging
  still environmental-deferred (host OOM). W2 surfaces are now part of
  the station battery evidence set.

## W3 dispatch record

- Wave-3 contract freeze (v3): machine authority extended ADDITIVELY in
  `packages/shared/src/you/contract.ts` (HTIR/twin/reconstruction types,
  event types, error codes); prose authority `docs/you/CONTRACTS.md`
  "Twin / reconstruction (design authority, wave 3)" + "Wave-3 contract
  freeze (v3)"; full W3A/W3B/W3C orders frozen in `docs/you/WORK_ORDERS.md`.
- Base SHA for W3A/W3B/W3C: the W3 contract-freeze commit on main
  (recorded below at dispatch; branches cut from it by the TL).
- Dependency policy wave 3: zero new runtime dependencies; workers do
  not touch root manifests/lockfiles; TL serializes root reconciliation
  at T3 (none expected — no new packages).
- Write surfaces: W3A `packages/shared/src/you/**` (except TL-frozen
  `contract.ts`) + `packages/services/src/you/**`; W3B
  `packages/ui/src/you/**` + disclosed registration-only seams (same
  pre-expanded seam list as W2B); W3C `packages/you-lab/**`.
- Tests: node:test via `pnpm exec tsx --test` (station battery per W1/W2
  practice: package typechecks chunked, lint baseline 0 errors /
  70 warnings, you-test battery per package).

### W3A merge record (2026-10-09)

- Status: MERGED. Owner: Worker A (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w3a-core`. Base SHA: `cd69cf3`.
  PR #18; merge commit `bfc4103`; worker commit `d85838f` (25 files,
  +4835, ALL inside `packages/shared/src/you/**` +
  `packages/services/src/you/**`).
- Station battery (gate-parity, re-run): `tsc -b shared services`
  exit 0; lint 0 errors / 70 warnings = exact baseline; shared/you
  **180/180** (135 W2-era + 45 new); services/you **57/57** (39 W2-era
  + 18 new); frozen `contract.ts` untouched; no lockfile/manifest
  changes (zero-new-deps law).
- TL review: TwinVersion immutability = frozen record replacement +
  append-only transition journal (candidate->canonical->superseded
  legal table, monotonic version numbers never reused); consent
  enforcement delegates to the frozen wave-2 `canProcess` predicate via
  the evidence-authority seam (no second consent authority);
  reconstruction job lifecycle = legal transition table + terminal
  statuses; deterministic fixture scenario spans the full arrow
  (capture -> evidence -> binding -> reconstruction -> quality ->
  remediation -> round-2 -> promotion/supersession -> consent
  withdrawal -> unsupported method -> ledger readout) with fixtures
  `simulated: true` (truth law).
- Operational note: the agent backend flapped closed mid-wave after
  dispatch (~13:00Z); the worker still completed and pushed from its
  sandbox. Turn/chat surface appeared static during sandbox-side work —
  body-liveness heuristics must not be read as turn death while a
  sandbox is attached (recorded for future waves).
- W3B/W3C remain in flight at this record (re-armed canary loop owns
  their re-dispatch; see station ops log).

## W1 — Solution Runtime / Operator Gate

### W1A Core/API
- domain contracts
- Solution service
- deterministic state
- Solution protocol
- event ledger
- tests

Write surfaces:
`packages/shared/src/you/**`, designated services/core authority only after TL freeze.

### W1B Studio/UX
- native Solution tab
- Solution viewport
- inspector
- feedback
- version compare
- export/open-in-editor entrypoints
- responsive/accessible UI
- operator demo

Write surfaces:
`packages/ui/src/you/**` plus its dedicated tests/docs.

### W1C Labs/Technology
- Technology Registry additions
- EditorCapabilityProfile
- adapter interfaces
- deterministic Organization Compiler
- mock editor adapters
- fixture benchmarks

Write surfaces:
`packages/you-lab/**` or the exact C-lane paths selected by TL.

## W2 — Evidence/Capture

A: evidence service and consent.
B: capture/review UX.
C: capture technology and evaluation adapters.

## W3 — Twin/Reconstruction

A: HTIR/TwinVersion services.
B: Twin Studio.
C: reconstruction adapters/benchmark harness.

## W4 — Performance/Rendering

A: performance/render job authority.
B: Performance Studio/output review.
C: motion/render providers.

## W5 — Editing Ecosystem

A: EditSession/ChangeSet/artifact lineage.
B: embedded/external editor UX.
C: editor adapters and round-trip benchmarks.

## W6 — Takeover Learning

A: learning ledger/preferences.
B: learning UX/replay.
C: organization/tool/editor selection learning.

## W7 — Agent Embodiment

A: Body/Soul APIs.
B: Agent Avatar Studio.
C: Soul routing/realtime/performance.

## W8 — Arena

A: Arena API boundary.
B: escalation UX.
C: gap detection and Arena adapter.

## W9 — Labs

A: durable experiments.
B: Lab Solution UX.
C: synthetic worlds/search/evaluators/promotion.

## W10 — Ecosystem + hardening

A: production security/reliability/integration.
B: product E2E/accessibility/responsive/launch UX.
C: production provider matrix/cost/latency/research gates.

## Ledger rules

The TL updates this file after each merge wave with:

- status;
- owner;
- exact branch;
- exact base SHA;
- PR number;
- commit SHA;
- tests;
- browser evidence;
- contract impact;
- security/license evidence;
- cost/latency evidence;
- deviations;
- blockers.

Workers never mark their own work DONE; they submit evidence to TL.
