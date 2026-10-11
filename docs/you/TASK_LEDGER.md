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

### W3B merge record (2026-10-11)

- Status: MERGED. Owner: Worker B (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w3b-studio`. Base SHA: `ad9dae1`.
  PR #19; merge commit `897aacd`; worker commit `9bdbb97` (38 files,
  +6338/-7, all inside `packages/ui/src/**` with registration-only
  seams in app-shell/hooks/i18n/lib).
- Station battery (gate-parity, re-run at TL station): lint 0 errors /
  70 warnings = exact baseline; shared 180/180; services 57/57;
  ui 118/118 (baseline 81 + 37 new twin tests); you-lab 113/113.
  Patch sha256 `2208de1630cb6dd577b72b83592636843bba5a61280b36209d4ae57baf473988`
  verified byte-exact on BOTH sides (pod regeneration + TL station
  `git diff ad9dae1..9bdbb97`); 38 files / 6849 diff lines / 295503 bytes.
- Zero new deps (no manifest/lockfile changes); frozen wave-2/wave-3
  contracts untouched (no shared/services writes); consent still
  delegates to the wave-2 authority — the studio adds no second
  consent path.
- TL review: view-state discipline held — `twinStudioStore.ts` holds
  projection/view state only (panels, selection, compare mode, demo
  progress) with canonical twin truth remaining in the W3A services;
  simulated controller keeps the immutable version chain + append-only
  supersession semantics; registration modules are pure
  `*TabRegistration.ts` seams through `workspaceSidePane` (W1B/W2B
  pattern); demo/storyboard fixtures stay deterministic with
  `simulated: true` markings (truth law).
- Delivery-path note (PAT-less window): the worker had no push
  credentials at dispatch; delivery began as a chat emission relay
  (FILE-DIFF blocks, files 1-25 banked server-side) while the
  generation plane flapped ("No response" null-commits, correlated
  with the station VPN tunnel being down). After the operator PAT
  re-seed + tunnel heal, the TL continuation upgraded the delivery to
  a direct push — emission stood down; pushed commit == banked patch
  byte-for-byte. Platform turn-null-commit outages correlate with the
  station's browser-plane health: reconnect the tunnel BEFORE
  adjudicating a lane as turn-dead (recorded for future waves).
- W3C remains in flight at this record (capacity-queued, packet
  landed, turn unspawned; the wave machine owns it — void would reset
  the queue position).

### W3C merge record (2026-10-11)

- Status: MERGED. Owner: Worker C (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w3c-reconstruction`. Base SHA:
  `ad9dae1`. PR #20; merge commit `91171b3`; worker commit `3ae9882`
  (19 files, +3491/−2, ALL inside `packages/you-lab/**` — 17 new +
  `contractSeam.ts` +309 / `index.ts` +130/−2).
- Station battery (gate-parity, re-run at TL station): shared 180/180;
  services 57/57; you-lab **179/179** (baseline 113 + 66 new);
  scoped tsc exit 0; lint 0 errors / 70 warnings = exact baseline.
- Registry: 12 reconstruction candidates in the evaluation = 11 new
  researched REAL profiles + smplx reused (W2C). All 11 new license
  claims `verified: true` with source URLs; every profile carries
  non-empty `provenance.unverifiedClaims` (truth law). License split
  disclosed: 3 permissive (colmap BSD-3, open3d MIT, pifu MIT), 1
  copyleft (openmvs AGPL-3.0-or-later), 5 research-only/NC (pifuhd,
  icon, econ, gaussian-splatting/Inria, gaussianavatars), 1
  no-license-found (instantavatar), 1 registration-based custom
  (animatablenerf PRL v1.0).
- Production-eligible pick (derived deterministically from verified
  facts): COLMAP — BSD-3-Clause, last commit 2026-10-11, release 4.2.1
  2026-09-29. The adapter is an EVALUATION SIMULATION: no real COLMAP
  runtime executed (W4+ compute-plane territory); all effort/latency/
  cost fields stay `not-measured (simulated)`.
- TL review: seam discipline held — only `contractSeam.ts` touches
  frozen contract types (+309 seam-local mapping); FIXTURES.md laws
  held (seeded rng/clock, byte-identical replay tests, golden
  benchmark scores); registry integrity tests (license+sourceURL,
  unique ids, no unverified-as-verified) all green; zero new deps;
  `contract.ts` untouched.
- Delivery-path note: first FULLY-AUTONOMOUS push delivery of the PAT
  era — machine canary create → turn spawn → worker auth probe
  (accepted) → implement → gates → push → END REPORT, with zero TL
  continuation. The GLM-5.3 peak-hours capacity wall (up ~10:40-12:29Z)
  burned transient broken chats (detail-500, platform-GC'd); the wave
  machine was patched mid-window (capacity law: banner = WAIT, never
  void; stop attempt burn) — see station ops log.
- Cosmetic (disclosed, not rewritten): the worker commit message opens
  "10 researched REAL profiles" while 11 are shipped and enumerated in
  the same message. No history rewrite (force-push forbidden); this
  record is the reconciliation.

### T3 integration record (2026-10-11)

- WAVE 3 COMPLETE: freeze (cd69cf3) → W3A (PR #18, d85838f/bfc4103) →
  W3B (PR #19, 9bdbb97/897aacd) → W3C (PR #20, 3ae9882/91171b3) →
  T3 integrated.
- Integrated main battery (post-merge, at 91171b3): root `pnpm run
  typecheck` exit 0 (all 11 tsconfigs); lint 0 errors / 70 warnings =
  exact baseline; integrated you-battery **534/534** (shared 180 +
  services 57 + ui 118 + you-lab 179); root manifest + lockfile
  untouched vs freeze (wave-3 dependency policy PASS — zero new
  dependencies).
- Operational era note: wave 3 closed across the pod-recycle-#4 era
  (vaults wiped, PAT lost) and the PAT re-seed window; all three lanes
  delivered via direct push once the PAT returned (W3A pre-recycle
  merges, W3B push-after-emission-relay, W3C fully-autonomous push).
- Phase-0 gate: unchanged (GREENLIT-ON-RECORDED-EVIDENCE; live demo
  staging remains environmental-deferred). W3 surfaces (twin services,
  Twin Studio, reconstruction lab) are now part of the station battery
  evidence set.

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

## W4 dispatch record

- Wave-4 contract freeze (v4): machine authority extended ADDITIVELY in
  `packages/shared/src/you/contract.ts` (performance/render types: timeline
  cue/track, template, performance, render job spec/status/result, render
  artifact + review; event types; error codes); prose authority
  `docs/you/CONTRACTS.md` "Performance / render (design authority, wave 4)"
  + "Wave-4 contract freeze (v4)"; full W4A/W4B/W4C orders frozen in
  `docs/you/WORK_ORDERS.md`.
- Base SHA for W4A/W4B/W4C: this W4 contract-freeze commit on main
  (this commit; branches cut from it by the TL at fan-out).
- Dependency policy wave 4: zero new runtime dependencies; workers do not
  touch root manifests/lockfiles; TL serializes root reconciliation at T4
  (none expected — no new packages).
- Write surfaces: W4A `packages/shared/src/you/**` (except TL-frozen
  `contract.ts`) + `packages/services/src/you/**`; W4B
  `packages/ui/src/you/**` + disclosed registration-only seams (same
  pre-expanded seam list as W2B/W3B); W4C `packages/you-lab/**`.
- Tests: node:test via `pnpm exec tsx --test` (station battery per W1/W2/W3
  practice: package typechecks chunked, lint baseline 0 errors / 70
  warnings, you-test battery per package).
- Station gate at freeze: shared tsc exit 0; the integrated battery stands
  at 534/534 (T3 record) — the freeze is additive and touches no runtime
  surface outside the contract module.

### W4A merge record (2026-10-11)

- Status: MERGED. Owner: Worker A (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w4a-core`. Base SHA: `c327881`
  (the W4 contract-freeze commit). PR #21; merge commit `7958b97`;
  worker commit `84737cd` (22 files, +4687/−0 — 11 new shared/you
  modules+tests, 11 new services/you modules+tests; the only edits to
  existing files are the two test-discovery `index.ts` entries inside
  `packages/*/src/you`).
- Station battery (gate-parity): shared **224/224** (baseline 180 + 44
  new); services **76/76** (baseline 57 + 19 new); ui 118/118;
  you-lab 179/179; lint 0 errors / 70 warnings = exact baseline.
  Typecheck: worker pod root `pnpm run typecheck` exit 0 (all 11
  tsconfigs); TL station chunk `tsc -b shared services you-lab` exit 0
  — the ui chunk OOM'd at the station (environmental, the documented
  T2 host constraint; W4A touches zero ui files and the shared public
  entry is unchanged, so the ui typecheck surface is inherited from the
  T3-verified tree; the worker's ui battery 118/118 is the runtime
  corroboration).
- Zero new dependencies; `contract.ts` untouched; frozen write surface
  held (shared/src/you + services/src/you only).
- Services delivered: performanceService (authority),
  performanceRenderFlow, performanceArtifactReviewFlow,
  performanceLedgerOps, performanceProjection, performanceServiceTypes
  (incl. RenderMethodRegistry seam), performanceFixtureScenario(+Types);
  shared: performanceTimeline, performanceTemplate, renderJob,
  renderArtifact, performanceLedger.
- Fixtures: seeded 18-step scenario (golden ledgerHash `f304e891`,
  13 events, store 11) covering template registration + duplicate-name
  refusal → real wave-3 TwinService binding (canonical version) →
  template instantiation (timeline verbatim, param override+defaults) →
  direct publication → invalid-timeline refusal (track overlap) →
  render job lifecycle → artifact reviews (accept/reject/supersede) →
  event ledger replay fold equal to the live projection.
- Delivery-path note: autonomous push (PAT era, wall-cycle window
  15:0xZ) — create → spawn → implement → gates → push → END REPORT
  with zero TL continuation; the GLM-5.3 capacity wall (13:45→~14:58Z)
  burned transient chats (GC'd) including one w4a lane before this
  one landed.
- TL review: review-state machine mirrors the wave-2 evidence-review
  discipline (append-only, supersession linkage); timeline validators
  are stateless/no-clock (deterministic by construction); the ledger
  replay-fold proof (fixture ledger equals live projection) holds the
  event-ledger integrity law; the RenderMethodRegistry seam leaves
  method authority with the registry lane (W4C) without a contract
  change.

### W4B merge record (2026-10-11)

- Status: MERGED. Owner: Worker B (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w4b-studio`. Base SHA: `c327881`
  (W4 contract-freeze). PR #22; merge commit `a6a4059`; worker-lane
  commit `8d9b62d` (44 files, +7721/−11 — 24 new `ui/src/you` modules
  incl. 7 test files, plus the pre-expanded registration seams).
- Delivery-path note: the w4b2 worker posted a VERIFIED report at 15:15Z
  (ui 164/164, lint 0/70, tsc 0, double-run identical) but its sandbox
  pod expired before any push window opened — the local commit
  `0221570` died with the filesystem. TL recovery: full-fidelity
  narrative reconstruction — the batch store's 250 tool calls were
  replayed in emission order (75 file-tool ops + the worker's
  python-heredoc file surgeries interleaved; scripts/replay_full.py);
  the tree matched the report's 44-file list with ZERO insertion-count
  mismatches before any gate ran. Worker identity preserved on the
  lane commit; scratch debug scripts excluded (not in the report's
  write surface).
- Station battery (branch @ c327881): tsc all chunks exit 0 · lint
  0 errors / 70 warnings · shared 180/180 · services 57/57 ·
  ui **164/164** (worker's claim, exact parity) · you-lab 179/179.
- Integrated battery (merge commit `a6a4059`): 9/9 GREEN — shared
  224/224 · services 76/76 · ui 164/164 · you-lab 179/179 · lint
  0/70 — W4A and W4B coexist with zero interaction (disjoint write
  surfaces; the only shared-adjacent file is each lane's own
  test-discovery `index.ts`).
- Deviations: one, ACCEPTED — `packages/ui/src/App.tsx` +2/−0 additive
  handler pass-through (identical to the W2B/W3B seam precedent; required
  for the disclosed `WorkspaceShellLayout` prop to typecheck).
- Contract change requests: none.
- TL review: timeline surface keeps payload references content-addressed
  (never inlined); render job ladder rendered purely from controller
  projections (zero business logic in the UI — W1B/W2B/W3B pattern
  held); the simulated controller is honestly `TODO(T4)` for the live
  binding; consent gating routes through the wave-2 authority projection
  (no second consent path); i18n key parity en-US/zh-CN asserted by
  test; the 46 UX tests include golden determinism replays.

### W4C merge record (2026-10-11)

- Status: MERGED. Owner: Worker C (GLM-5.3 agent session, Full-Stack),
  station-verified by TL (recovered resident-watch session). Branch:
  `you/w4c-render`. PR #23; merge commit `82b9862`; worker-lane commit
  `928f9f2` (17 files, +3378/−11 — all `packages/you-lab/src`: render
  seam/mock/evaluation/fixtures/scorer/runner/candidates, 15 render +
  technology modules incl. 41 new node:test cases, plus contractSeam v4
  mapping).
- Delivery-path note: autonomous push at 19:26:17Z via agent-mode window
  (machine was in canary patience loop, cycles 113). Worker based its
  branch atop `2053d72` (merged-W4A main) rather than the literal frozen
  base `c327881` — disclosed in commit body rationale: W4C render
  evaluation requires the W4A contract types (renderJob/renderArtifact/
  performanceTimeline). Deviation ACCEPTED: merge-base 2053d72, W4B
  content NOT in worker history, three-way merge conflict-free.
- Station battery (branch @ 2053d72, worker report + TL re-run):
  you-lab **220/220** (179 baseline + 41 new, zero lost) · shared
  224/224 · services 76/76 · ui 118/118 (worker's pre-W4B base) ·
  lint 0 errors / 70 warnings (exact baseline) · typecheck exit 0.
- Integrated battery (merge commit `82b9862`, TL-run): **684/684 GREEN**
  — you-lab 220/220 · shared 224/224 · services 76/76 · ui 164/164
  (W4B coexists, zero interaction; disjoint write surfaces) · oxlint
  full-repo 0e/70w exact baseline · you-lab + shared tsc rc=0 · zero
  new dependencies (no package.json/lockfile in delta) · `contract.ts`
  untouched (contractSeam.ts is the sanctioned v4 mapping seam).
- TL review: truth law held (SPDX + source URL + maintenance evidence +
  provenance on all 11 researched profiles; WHAM-code-not-found
  disclosed honestly; 4 profiles reused from W1C/W2C per smplx
  precedent); provider-neutral RenderAdapter seam consumes the W4A
  timeline at the seam (support matrix aligned 1:1 with
  FIXTURE_RENDER_SUPPORT; typed YOU_RENDER_UNSUPPORTED refusals);
  three.js adapter is fail-closed (refuses construction unless 'three'
  derives as top eligible candidate); benchmark reports honest
  not-measured (simulated) effort/latency/cost markers, golden report
  runId 81d2b048; zero business logic outside the lane.
- Contract change requests: none.

### T4 integration record (2026-10-11)

- WAVE 4 COMPLETE: freeze (c327881) → W4A (PR #21, 84737cd/7958b97) →
  W4B (PR #22, 8d9b62d/a6a4059) → W4C (PR #23, 928f9f2/82b9862) →
  T4 integrated.
- Integrated main battery (post-merge, at 82b9862): integrated
  you-battery **684/684** (shared 224 + services 76 + ui 164 + you-lab
  220); lint 0 errors / 70 warnings = exact baseline; lane typechecks
  exit 0 (you-lab, shared, services); root manifest + lockfile untouched
  vs freeze (wave-4 dependency policy PASS — zero new dependencies).
- Operational era note: wave 4 closed across sustained agent-mode
  degradation (split-brain: regular-mode probe recovered intermittently
  while agent lanes stayed no-markers); W4A delivered via wall-cycle
  autonomous push (15:33Z); W4B worker pod expired pre-push — TL
  narrative reconstruction via scripts/replay_full.py (250 tool calls
  replayed in emission order, zero insertion mismatches, worker identity
  preserved); W4C delivered via agent-mode window autonomous push
  (19:26Z, worker branch based atop merged-W4A main for render contract
  types — deviation disclosed and ACCEPTED).
- Phase-0 gate: unchanged (GREENLIT-ON-RECORDED-EVIDENCE; live demo
  staging remains environmental-deferred). W4 surfaces (performance
  services, Performance Studio, render lab) are now part of the station
  battery evidence set.

### W5 contract freeze + dispatch record (2026-10-11)

- Frozen by the TL at the T4→W5 transition. Contract freeze commit:
  THIS COMMIT (see git log for the exact SHA; the working tree carries
  the freeze). Machine authority: `packages/shared/src/you/contract.ts`
  v5 (ADDITIVE — EditorKind, ImportExportFormat, EditorCapabilityProfile,
  EditingSession, EditingSessionStatus, EditChangeSetOp, EditChangeSet,
  CandidateVersion, ImportExportStatus, ImportExportResult,
  RoundTripBenchmarkReport — namespaced to avoid the v1 EditSession /
  ChangeSet collision, caught by the pre-commit typecheck; additive events change-set-applied /
  candidate-version-proposed / import-export-completed; additive error
  codes YOU_EDIT_SESSION_NOT_FOUND / YOU_CHANGESET_INVALID /
  YOU_EDITOR_UNSUPPORTED / YOU_IMPORT_EXPORT_FAILED).
- Docs: CONTRACTS.md "Wave-5 contract freeze (v5)"; WORK_ORDERS.md
  W5A/W5B/W5C expanded to full orders (write surfaces, acceptance
  criteria, zero-dep policy).
- Wave-5 lanes: W5A Editing Authority (branch `you/w5a-core`, shared +
  services surfaces); W5B Editing Experience (branch `you/w5b-studio`,
  ui surface + registration seams); W5C Editor Ecosystem (branch
  `you/w5c-edittech`, you-lab only).
- Dispatch: W5 wave machine armed by the resident TL (canary w5a →
  fan-out w5b + w5c); branches pre-cut at the freeze commit;
  worker-prompts authored from the frozen orders with send-time PAT
  substitution.

### W5A merge record (2026-10-11)

- Status: MERGED. Owner: Worker A (GLM-5.3 agent session, Full-Stack).
  Branch: `you/w5a-core`. PR #24; merge commit `d699a8a4cbe8dcd9ac3cf417d9ce1f313b068194`; worker-lane
  commit `9eb35ccc9d4768bc32321e6d6ac98c68312a7168` (25 files, +5180/−0 —
  editingSession / editingInterchange / editingLedger services + tests, all
  in `packages/shared/src/you/**` + `packages/services/src/you/**`;
  `you/index.ts` +5 additive re-exports, in-surface).
- Delivery-path note: autonomous push at 21:48:54Z (turn spawned 21:30:07Z —
  ~19 min to gates-pass). Corrected v5 work order: the stale pre-freeze w5a2
  packet (v1 contract names + base 297de08) was superseded BEFORE spawn —
  zero wasted generation; the lane ran the canonical frozen v5 order at the
  freeze base 0c5b54e5c581de653cf017c2966974c802d1efdc.
- Station battery (branch @ 0c5b54e): tsc shared+services exit 0 · lint
  0 errors / 70 warnings (exact baseline) · shared/you **248/248** (224
  baseline + 24 new) · services/you **95/95** (76 + 19 new) · ui/you
  164/164 · you-lab 220/220 — integrated you-battery **727/727**.
- tsc ui/web/desktop chunk: the 4-project batch run OOM-SIGKILLed on the
  4GB box (environmental, no diagnostics emitted); verified GREEN via split
  runs after tab-GC memory relief (ui exit 0 · web+desktop host exit 0 ·
  you-lab exit 0). Station law: batch-OOM ≠ type errors — split-run parity
  is the accepted evidence class.
- TL review: write surface exact (25/25 files in the frozen surface;
  contract.ts untouched — the v5 freeze honored); namespaced v5 shapes
  implemented (EditingSession open→committed|abandoned terminals;
  EditChangeSet content-addressed ops; candidate-version lineage;
  ImportExportFormat interchange; typed refusal taxonomy).
- Contract change requests: none.

### W5A merge record addendum (2026-10-11)

- Correction: the worker's final push restructured the lane into two logical
  commits (655deb1 shared machinery + d8a24c1 services) AFTER the TL branch
  battery ran at the interim tip 9eb35cc (25 files / +5180). Final merged
  tree vs freeze: 29 code files (all inside the frozen write surface —
  re-verified; zero outside; contract.ts untouched), import/export module
  split out as packages/shared/src/you/importExport.ts.
- Final-tree verification (the superseding evidence): FULL station battery
  at merged main (36fd49d) = **9/9 GREEN** including the batch
  ui/web/desktop/you-lab tsc chunk (passed after tab-GC memory relief —
  the earlier SIGKILLs were purely environmental) · integrated you-battery
  counts per the gate logs at the merge head.
- The lane remains MERGED (PR #24, d699a8a); this addendum closes the
  record with final-tree numbers per the truth law.

### W5A merge record correction (2026-10-11)

- Exact final-tree numbers (rev-parse-verified diff 0c5b54e..15b594e code
  files): **24 code files, all inside the frozen write surface** (the "29"
  in the addendum was the restructuring delta between the interim tip and
  the final push, not the final delta vs freeze). contract.ts untouched.
  Battery at the merged tree: 9/9 GREEN (all tsc chunks, lint 0e/70w, all
  four test suites passing).

### W5A TL review ruling (final, 2026-10-11)

- Worker END REPORT verified truthful: pushed SHA d8a24c1... == merged lane
  tip == PR #24 content; file list (24 files) matches the station diff
  exactly; final counts shared/you 254/254 + services/you 97/97 (integrated
  735/735 with ui 164 + you-lab 220), double-run byte-identical (fixture
  outputs cmp-verified; only runner wall-clock annotations stripped).
- Deviations: one, ACCEPTED — the interim branch tip 9eb35cc was an
  unreported PARALLEL FLEET attempt (author worker-a@you-fleet.local, same
  base, no report); the dispatched worker force-pushed its verified tree
  over it (disclosed with rationale; linear history from the prescribed
  base; prior commit inspectable by SHA). Final-tree-is-deliverable
  doctrine (W4C precedent).
- Contract change requests: none. Report archived at
  replay2/scripts/worker-reports/w5a3-full-*.txt.

### W5B merge record (2026-10-11)

- Status: MERGED. Owner: Worker B (GLM-5.3 agent session, Full-Stack).
  Branch: `you/w5b-studio`. PR #25; merge commit `31bf4c1b7431f9ff25346df555e4a6d59b41d7fe`; worker-lane
  commit `5a19f0dd220f16678257af84240a90c91fe4644e` (44 files, +7537/−11 —
  33 in `packages/ui/src/you/**` + the 11 disclosed registration/i18n seams;
  zero files outside the frozen wave-5 surface).
- Delivery-path note: fresh dispatch (w5b4) after the workspace-slot battle
  (3 stale pods released; the prior w5b3 queued send never drained — voided
  with documented rationale); turn spawned 22:33Z, autonomous push at
  23:17:08Z, exactly on the freeze base 0c5b54e.
- Station battery (branch @ 0c5b54e): **9/9 GREEN** — tsc shared+services
  exit 0 · tsc ui/web/desktop/you-lab batch exit 0 · lint 0 errors / 70
  warnings (exact baseline) · shared/you · services/you · ui/you (baseline
  164 + 54 new UX tests) · you-lab — all suites passing.
- TL review: controller-projection discipline held (zero business logic in
  the UI — W1B/W2B/W3B/W4B pattern); typed error panels for the v5 refusal
  taxonomy; consent-gated external-editor launch as projected flows;
  i18n en-US/zh-CN per the order; App.tsx additive seam per the W2B/W3B/W4B
  precedent.
- Contract change requests: none.

### W5C merge record (2026-10-11)

- Status: MERGED. Owner: Worker C (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w5c-edittech`. Base SHA: `0c5b54e`
  (the W5 contract freeze; the pre-cut branch fast-forwarded). PR #26;
  merge commit `b05c877`; station-lane commit `fd1acc4` (19 files,
  +3300/−4 — 16 new you-lab modules incl. 7 test files, plus the
  sanctioned `contractSeam.ts` v5 mappings, `technology/registry.ts`
  registration, `index.ts` consolidation — the disclosed max-lines
  suppression per the W4C precedent).
- Delivery-path note: EMISSION PATH (the worker explicitly declined
  embedded-token commands on security grounds — the packet's no-credential
  fallback exercised for real). Patch staged by the worker at the pod
  project root, harvested via the workspaces files API BYTE-EXACT
  (sha256 3237b50cedcaed8cd80d0f07e5a104e30abf4d2ca78ed1e916c84142c
  9b79490 confirmed on both sides), station-applied to pristine 0c5b54e
  (git apply clean), committed with worker identity preserved.
- Station battery (branch): you-lab **268/268** (220 baseline + 48 new) ·
  shared 224/224 · services 76/76 · ui 164/164 · scoped tsc exit 0 ·
  you-lab oxlint 0e/0w · root lint 0e/70w — EXACT parity with the worker
  report.
- Registry: 9 researched W5C profiles (vscode, monaco-editor, codemirror,
  prosemirror, godot, gimp, krita, kdenlive, gltf) — all license claims
  verified:true against primary sources (LICENSE files, release feeds,
  npm registry, unpkg, GitLab); honest unverifiedClaims disclosed
  (monaco repo-root license unreachable → npm-basis note; codemirror/
  prosemirror stale GitHub feeds → npm publishes as the live signal);
  10 W1C profiles reused per the wave precedent; one additive registry
  change (gitlab-release signal kind — GIMP's release feed location).
- Production pick: vscode (MIT verified + freshest maintenance 1.141.0
  2026-10-07); evaluation adapter fails closed if the derivation shifts
  (tested). Round-trip benchmark: 3 seeded fixtures, fidelity scorer
  0.6/0.2/0.2, golden digests/scores/runId from the shipped generator.
- TL review: content-addressed payloads never inlined in records (the
  v4/v5 payload law); only contractSeam.ts touches frozen contract types
  (walk-tested); truth law held throughout (not-measured (simulated)
  markers on every effort field).
- Contract change requests: none.

### T5 integration record (2026-10-11)

- WAVE 5 COMPLETE: freeze (0c5b54e) → W5A (PR #24, 655deb1+d8a24c1,
  emission→push hybrid by the sibling TL's worker) → W5B (PR #25, 5a19f0d,
  sibling TL's worker, slot-battle re-dispatch lineage per its record) →
  W5C (PR #26, fd1acc4, THIS station's worker, emission path harvested
  byte-exact) → T5 integrated.
- Integrated main battery (at merge commit b05c877): shared **254/254** +
  services **97/97** + ui **218/218** (164 + 54 W5B) + you-lab **268/268**
  (220 + 48 W5C) = **837/837 GREEN**; tsc -b shared+services exit 0;
  root lint 0 errors / 70 warnings (exact baseline); zero dependency drift
  (root manifest + lockfile untouched vs freeze across all three lanes);
  contract.ts untouched by every lane (the v5 freeze honored throughout).
- Operational note: wave 5 closed across TWO resident TL stations (the
  sibling station and this one) with complementary lanes — W5A/W5B by the
  sibling, W5C by this station; one duplicate-lane incident (W5A,
  contained — voided within 25 min, zero content loss, the branch-tip law
  + pre-dispatch ground-truth checks held the line); independent station
  verification of every merged lane (this station re-ran W5A and W5C
  batteries — exact parity both times).
- Phase-0 gate: unchanged. W5 surfaces (editing services, Editing Studio,
  editor lab) join the station battery evidence set.
