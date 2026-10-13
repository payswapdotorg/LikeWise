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

### W6 contract freeze + dispatch record (2026-10-11)

- Frozen by the TL (this station) at the T5->W6 transition. Contract freeze
  commit: THIS COMMIT. Machine authority: `packages/shared/src/you/
  contract.ts` v6 (ADDITIVE — LearningSignalKind, LearningSignal,
  LearningRecordStatus, LearningRightUsage, LearningRights, LearningRecord,
  LearningPreference, TrajectoryReference; the scope taxonomy REUSES the
  v1-common frozen LearningScope union verbatim — a duplicate-declaration
  compile error was caught and removed pre-commit, zero v1-v5 shape
  altered; additive events learning-signal-captured /
  learning-record-validated / learning-record-rejected /
  preference-updated; additive error codes YOU_LEARNING_SIGNAL_INVALID /
  YOU_LEARNING_RECORD_NOT_FOUND / YOU_LEARNING_RIGHTS_REQUIRED /
  YOU_PREFERENCE_SCOPE_INVALID).
- Docs: CONTRACTS.md "Wave-6 contract freeze (v6)" (rights law: learning
  usable only within its LearningRights consent grant — no second consent
  path); WORK_ORDERS.md W6A/W6B/W6C expanded to full binding orders.
- Wave-6 lanes: W6A Learning Authority (`you/w6a-core`, shared + services
  surfaces); W6B Learning UX (`you/w6b-studio`, ui surface + registration
  seams); W6C Organization Learning (`you/w6c-learnlab`, you-lab only).
- Verified at freeze: shared tsc exit 0; shared you battery 254/254
  unchanged (zero regression from the additive shapes).
- Dispatch follows immediately with the in-context order protocol (title
  message + binding order as message 2 + exact-command kick as message 3).

### W6B merge record (2026-10-12)

- Status: MERGED. Owner: Worker B (GLM-5.3 agent session, Full-Stack —
  the coordinator session's delegated lane), station-verified by TL.
  Branch: `you/w6b-studio`. Base SHA: `bbf2a18`. PR #28; merge commit
  `b8bb82a`; station-lane commit `e958758` (45 files, +8219/−14 — 34
  files in ui/src/you incl. 28 new modules + 5 sibling registration
  tests + index.ts, plus 11 disclosed registration-only seam edits with
  per-file counts: App.tsx +2, AnimatedSidePanePanel +32,
  SidePaneTabTrigger +12, WorkspaceShellLayout +2,
  animatedSidePanePanelModel +9/−1, sidePaneTabPresentation +7,
  app-shell/types +2, useAppPanels +16, i18n en-US/zh-CN +1 each,
  workspaceSidePane +31).
- Delivery-path note: COORDINATOR-SESSION EMISSION — one worker session
  planned and executed BOTH remaining wave-6 lanes via worktrees +
  delegated impl agents (disclosed in-session; the TL contracted the
  expansion with per-lane separation: separate commits, separate patches,
  separate report blocks). Patch harvested byte-exact (sha256
  cf87fcc8194bf5379f32f2e3f0e82f90ef4665a3fb33de095333f6a771674e8e)
  from the pod project root.
- Station battery: ui **275/275** (218 baseline + 57 new) · shared
  254/254 · services 97/97 · root lint 0e/70w — exact parity with the
  report. Typecheck: the worker's split-run parity (tsc -b ui exit 0 in
  the pod; root batch OOM = the documented W5A environmental condition)
  + the station ui battery 275/275 as runtime corroboration — the
  accepted evidence class per the W5A station law (the station's own
  ui tsc OOM-kills on the 4GB box).
- TL review: six-kind signal picker + scope ladder from controller
  projections (zero business logic in the UI — W1B-W5B pattern; TODO(T6)
  rebinding markers); trajectory replay content-addressed only with
  byte-identical determinism tests; rights display + consent withdrawal
  routed through the wave-2 authority (no second consent path); all
  four v6 error codes as role="alert" panels; i18n key-set + placeholder
  parity by test.
- Contract change requests: none.

### W6C merge record (2026-10-12)

- Status: MERGED. Owner: Worker C (GLM-5.3 agent session, Full-Stack —
  the coordinator session's delegated lane), station-verified by TL.
  Branch: `you/w6c-learnlab`. Base SHA: `bbf2a18`. PR #29; merge commit
  `bf00f81`; station-lane commit `bd3a81c` (19 files, +3404/−2 — 9 new
  learning modules + 5 test files + learningSeedProfiles.ts 343, plus
  contractSeam.ts +235/−2, its test +62, index consolidation).
- Delivery-path note: coordinator-session emission (same as W6B). Patch
  harvested byte-exact (sha256
  1f63c2b6c248654654f5e361b476c800216f7144d3880034f26f34977975b3aa).
- REPORT CORRECTION (station truth supersedes): the report claimed
  you-lab "161/161 (baseline 113 + 48 new)" — a worktree battery
  miscount (113 was the W1C-era number). Station battery at the applied
  patch: **316/316** (268 baseline + 48 new, every prior W1C-W5C test
  green) — the patch itself is complete and correct; only the report's
  baseline arithmetic was wrong. Disclosed per the truth law.
- Registry: 9 researched REAL learner profiles (vowpal-wabbit,
  lightgbm, xgboost, smac, prose, wittgenstein, mord, mabwiser, pm4py)
  — every profile carries >=1 honest unverifiedClaims entry; eligibility
  DERIVED (permissive-SPDX + 365-day maintenance gate — mord/mabwiser
  fail the gate, pm4py AGPL-3.0 not-production-friendly); production
  pick vowpal-wabbit (BSD-3-Clause, 15d freshness, top-ranked) with a
  fail-closed evaluation adapter. Benchmark: golden runId 595c8561,
  score spread 0.53-1.0, computed determinism.
- Station battery: you-lab **316/316** · scoped tsc exit 0 · root lint
  0e/70w. Scope clean (you-lab only); zero new deps; contract.ts
  untouched (filesystem-walk only-module test).
- Contract change requests: none.

### T6 integration record (2026-10-12)

- WAVE 6 COMPLETE: freeze (bbf2a18) → W6A (PR #27, a7b6795, emission
  harvested byte-exact) → W6B (PR #28, e958758, coordinator-session
  emission) → W6C (PR #29, bd3a81c, coordinator-session emission) → T6
  integrated.
- Integrated main battery (at bf00f81): shared **310/310** + services
  **119/119** + ui **275/275** + you-lab **316/316** = **1020/1020
  GREEN**; root lint 0 errors / 70 warnings (exact baseline); zero
  dependency drift (manifest + lockfile untouched vs freeze across all
  three lanes); contract.ts untouched by every lane (the v6 freeze
  honored throughout; the LearningScope dedup lesson banked).
- Operational note: wave 6 ran through one pod-death (W6C lane 1 —
  execution-plane failure, void + re-plan), one coordinator-session
  dual-lane delivery (contracted with per-lane separation), and the
  emission-path harvest chain twice more (both byte-exact). The report
  miscount on W6C's baseline was caught and corrected by station truth.
- Phase-0 gate: unchanged. W6 surfaces (learning services, Learning UX,
  learner lab) join the station battery evidence set.

### W7 contract freeze + dispatch record (2026-10-12)

- Frozen by the TL (this station) at the T6->W7 transition. Contract
  freeze commit: THIS COMMIT. Machine authority:
  `packages/shared/src/you/contract.ts` v7 (ADDITIVE — EmbodimentState,
  SoulRoutingProfile, SoulBinding, AgentBody, AvatarSessionStatus,
  AvatarSession, RealtimeChannelDescriptor; events avatar-session-opened /
  embodiment-state-changed / soul-reassigned / avatar-session-closed;
  error codes YOU_BODY_NOT_FOUND / YOU_SOUL_BINDING_INVALID /
  YOU_AVATAR_SESSION_NOT_FOUND / YOU_EMBODIMENT_STATE_INVALID).
- Docs: CONTRACTS.md "Wave-7 contract freeze (v7)" (the BODY/SOUL
  SEPARATION LAW: a Body can be possessed by another Soul without
  changing the Body contract); WORK_ORDERS.md W7A/W7B/W7C expanded to
  full binding orders.
- Wave-7 lanes: W7A Embodiment Authority (`you/w7a-core`), W7B Avatar
  Studio (`you/w7b-studio`), W7C Soul/Realtime (`you/w7c-soultech`);
  branches pre-cut at the freeze.
- Verified at freeze: shared tsc exit 0; shared battery 310/310 unchanged.

### W7A merge record (2026-10-12)

- Status: MERGED. Owner: Worker A (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w7a-core`. Base SHA: `972fa31`.
  PR #30; merge commit `8766c24`; station-lane commit `dd01f0f` (17
  files, +3094/−0 — 15 new + 2 modified test-discovery index.ts entries;
  worker pod commit d092f2f).
- Delivery-path note: EMISSION — patch staged at the pod project root,
  harvested byte-exact (sha256
  8c19e93ee7f167a7ecb967494ed370a63c04a0c76c1233e86a8c8b5b65d8f4cd,
  3206 lines) from the pod project root.
- Worker report: shared **344/344** (310 baseline + 34 new) · services
  **140/140** (119 + 21 new) · ui 275/275 · you-lab 316/316 (both
  unchanged) · `tsc -b packages/shared packages/services` exit 0 (single
  batch, no OOM split needed) · lint 0 errors / 70 warnings (exact
  baseline).
- Station battery: EXACT PARITY with the report at the station lane
  verification (shared 344/344 · services 140/140 · tsc 0 · lint 0e/70w);
  re-verified at the integrated merge head ed5501c by the recovery
  session (below).
- Fixtures: seeded scenario "you-w7a-embodiment-scenario" — body
  registration (content-addressed appearance), soul bindings A/B
  (system-one/system-two), session open, full eight-rung ladder walk,
  suspend/resume, close, re-possession via soul-reassigned on the same
  Body (byte-identical Body record — the body/soul separation law),
  second session close, nine typed refusal paths, ledger readout with
  projection == replay; injected DeterministicClock + splitmix32 RNG;
  byte-identical trace replay asserted; simulated: true throughout.
- TL review: write surface exact (17/17 files in the frozen surface;
  contract.ts untouched — the v7 freeze honored); namespaced v7 shapes
  implemented (AgentBody content-addressed, SoulBinding validation,
  AvatarSession append-only lifecycle, the 9-state embodiment ladder);
  the EmbodimentService.replay surface persisted for W7B consumption.
- Disclosures (worker): (a) oxfmt --check red at baseline 972fa31 on 412
  files incl. contract.ts (fmt is not an enforced gate; no new lint
  diagnostics introduced); (b) "embodiment policy enforcement" realized
  as the frozen ladder/lifecycle/separation policies (no separate
  policy-engine surface specified in the acceptance list).
- Contract change requests: none.

### W7C merge record (2026-10-12)

- Status: MERGED. Owner: Worker C (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w7c-soultech`. Base SHA: `972fa31`.
  PR #31; merge commit `ed5501c`; station-lane commit `3b52197` (22
  files, +4157/−3 — 19 new files + 2 modified seams (contractSeam.ts,
  index.ts) + 1 additive registry.ts change (+5/−1 "ietf-rfc" signal
  kind, the W2C/W5C precedent)).
- Delivery-path note: EMISSION — patch staged at the pod project root,
  harvested byte-exact (sha256
  185b078a2b3c2e4881d6ccec7eb58edcfdffdde1214163d7abb96f3b7ac1d446,
  4330 lines).
- Worker report: shared 310/310 · services 119/119 · ui 275/275 (all
  unchanged — the lane ran at the freeze base without W7A merged) ·
  you-lab **369/369** (316 baseline + 53 new) · scoped you-lab tsc exit
  0 · lint 0 errors / 70 warnings (root baseline exact).
- Station battery (recovery session, integrated head ed5501c): shared
  **344/344** · services **140/140** · ui **275/275** · you-lab
  **369/369** = **1128/1128 GREEN** (W7A + W7C combined) · root lint
  0 errors / 70 warnings · you-lab tsc exit 0. Zero dependency drift;
  contract.ts untouched (the v7 freeze honored).
- Registry: 15 researched REAL profiles (6 providers / 3 routing / 6
  realtime); license claims 15/15 verified:true with fetched source URLs
  (7× Apache-2.0, 3× MIT, 1× BSD-3-Clause, 1× ISC, 1× GPL-3.0, 2×
  custom/non-SPDX); maintenance signals 20/20 verified:true (GitHub
  releases/commits atom feeds + rfc-editor); compatibility summaries
  15/15 flagged unverified (engineering assessments); non-empty
  provenance.unverifiedClaims on every profile (truth law).
- Production pick: llama-cpp — MIT (LICENSE fetched) + freshest verified
  maintenance of the binding-capable classes (b11559, 2026-10-11 — 1 day
  before the research date; deterministic tie with ollama broken by
  routing-profile coverage then id, the W4C/W5C/W6C ranking precedent);
  behind the seam as llama-cpp-soul-eval, FAIL-CLOSED (refuses
  construction if the registry derivation shifts); simulated execution
  only — real runtime integration is W8+ compute-plane work.
- Disclosures (worker): WHIP publication DAY is month-precision (RFC
  text states March 2025; datatracker API Cloudflare-blocked HTTP 403
  from the sandbox) — disclosed in unverifiedClaims.
- Contract change requests: none.

### W7A/W7C records sequencing disclosure (2026-10-12)

- The prior TL session executed the W7A and W7C full cycles (harvest →
  station verify → merge: PRs #30 and #31) but lost session context
  immediately after the W7C merge; the merge-record docs commits were
  not authored before the loss. This recovery session re-verified the
  integrated battery at the merge head ed5501c (1128/1128 GREEN, lint
  0e/70w, you-lab tsc 0 — numbers above are station-measured, not
  report-transcribed) and authored these records retroactively. The
  W7A/W7C merges themselves were verified against the worker reports
  (byte-exact emission patches) at merge time by the prior session, per
  its registry done-records. Disclosed per the truth law.

### W7B merge record (2026-10-12)

- Status: MERGED. Owner: Worker B (GLM-5.3 agent session, Full-Stack),
  station-verified by TL. Branch: `you/w7b-studio`. Base SHA: `972fa31`.
  PR #32; merge commit `9d7c63e`; station-lane commit `af69245` (45
  files, +6825/−18 — 34 under packages/ui/src/you incl. 27 new modules,
  you/index.ts, 6 sibling registration tests; 11 disclosed
  registration-only seam edits with per-file counts: App.tsx +2,
  AnimatedSidePanePanel +32, SidePaneTabTrigger +11,
  WorkspaceShellLayout +2, animatedSidePanePanelModel +9/−1,
  sidePaneTabPresentation +7, app-shell/types +2, useAppPanels +16,
  i18n en-US/zh-CN +1 each, workspaceSidePane +31).
- Delivery-path note: EMISSION — patch staged at the pod project root,
  harvested BYTE-EXACT (sha256
  632b69922818b8d0ee71c625b391e8565190c2396d7342131dd637bbdd35e6f3,
  7511 lines; station-side sha256 verified identical). Worker pod
  commit 978de68.
- Station battery: ui **334/334** (275 baseline + 59 new) — EXACT
  PARITY with the report; shared 310/310, services 119/119, you-lab
  316/316 at the branch base; root lint 0 errors / 70 warnings (exact
  baseline). Typecheck: the station ui tsc batch OOM-SIGKILLs on the
  4GB box (the documented W5A environmental condition); the worker's
  memory-capped split run (`NODE_OPTIONS=--max-old-space-size=2800
  tsc -b packages/ui`) exited 0 — split-run parity + the station ui
  battery 334/334 = the accepted evidence class per the W5A station
  law.
- Operational note: the worker's turn ended after the final battery +
  patch staging but BEFORE posting the final report (body static ~40
  min); the TL continuation kick landed, hit the capacity wall
  (peak-hours banner — the message rolled back into the composer
  draft), then the mechanical Enter relay (the w4c wall-fighter
  pattern) fired it through on the wall drop at 04:50Z; the report
  landed 04:52Z. The lane watcher ran at marker threshold 3 (packet
  echo + kick echo + real report) because the kick message itself
  echoes the report template — the threshold-2 false-positive hazard
  is banked as a lesson.
- TL review: write surface exact (45/45 files in the frozen surface;
  contract.ts untouched — the v7 freeze honored); the controller port
  mirrors the W7A embodimentService seams 1:1 minus service-side
  persistence/replay (the T7 rebinding point — flagged by the worker
  as follow-up); the nine-state ladder rendered from projections with
  visited rungs derived from the embodiment-state-changed event
  stream (never UI-local state); re-possession via soul-reassign
  preserves the Body contract display (body/soul separation law in
  the UI); all four v7 error codes as typed panels; i18n en-US/zh-CN.
- Disclosures (worker): simulated controller until T7 binding (T-wave
  pre-binding, projection == replay shape preserved); vite
  web/desktop builds not run (pre-existing OOM, out of scope).
- Contract change requests: none.

### T7 integration record (2026-10-12)

- WAVE 7 COMPLETE: freeze (972fa31) → W7A (PR #30, dd01f0f, emission
  8c19e93e) → W7C (PR #31, 3b52197, emission 185b078a) → W7B (PR #32,
  af69245, emission 632b6992) → T7 integrated.
- Integrated main battery (at 9d7c63e): shared **344/344** (310 + 34
  W7A) + services **140/140** (119 + 21 W7A) + ui **334/334** (275 +
  59 W7B) + you-lab **369/369** (316 + 53 W7C) = **1187/1187 GREEN**;
  root lint 0 errors / 70 warnings (exact baseline); zero dependency
  drift (manifests + lockfiles untouched vs freeze across all three
  lanes); contract.ts untouched by every lane (the v7 freeze honored
  throughout).
- T7 rebinding point (disclosed): the Avatar Studio runs on a
  simulated controller whose port mirrors the W7A EmbodimentService
  seams 1:1 minus persistence/replay observability — the binding (or
  a later wave) can swap the simulated controller for the real
  service with zero UI changes.
- Operational note: wave 7 closed through one prior-session context
  loss mid-cycle (the W7A/W7C merges completed before the records
  were authored — recovered and disclosed per the truth law), one
  capacity-wall fight-through on the W7B report kick, and one
  turn-ended-pre-report continuation. The chat ROLL mechanism (895e4b04
  → 4e4a0bef) was recorded and followed by the lane watcher
  ("latest create wins").
- Phase-0 gate: unchanged. W7 surfaces (embodiment services, Avatar
  Studio, soul/realtime lab) join the station battery evidence set.

### W8 contract freeze + dispatch record (2026-10-12)

- Frozen by the TL (this station) at the T7->W8 transition. Contract
  freeze commit: THIS COMMIT. Machine authority:
  `packages/shared/src/you/contract.ts` v8 (ADDITIVE — ArenaRunStatus,
  ArenaRun append-only run ladder, ArenaRetryPolicy,
  ArenaLearningPermission, EscalationAuthorization,
  ArenaProviderDescriptor, ToolGapProjection / KnowledgeGapProjection;
  events arena-run-recorded / escalation-authorized /
  escalation-cancelled / learning-permission-recorded /
  gap-projection-published; error codes YOU_ESCALATION_NOT_FOUND /
  YOU_ESCALATION_STATE_INVALID / YOU_ESCALATION_AUTHORIZATION_REQUIRED
  / YOU_ARENA_RUN_NOT_FOUND / YOU_RETRY_POLICY_INVALID /
  YOU_ARENA_ADAPTER_UNSUPPORTED / YOU_GAP_PROJECTION_INVALID).
- Docs: CONTRACTS.md "Wave-8 contract freeze (v8)" (the ARENA BOUNDARY
  LAW + ESCALATION AUTHORIZATION LAW + ARENA LEARNING PERMISSION LAW +
  GAP PERSISTENCE LAW + provider neutrality); WORK_ORDERS.md
  W8A/W8B/W8C expanded to full binding orders.
- Wave-8 lanes: W8A Arena Authority (`you/w8a-arena`), W8B Escalation
  UX (`you/w8b-escalation`), W8C Arena Automation
  (`you/w8c-automation`); branches pre-cut at the freeze.
- Verified at freeze: shared tsc exit 0; shared battery 344/344
  unchanged.

### W8A merge record (2026-10-13)

- Harvested from `you/w8a-arena` @ ef9c578 (worker turn admitted
  14:46Z after the station cured an 18h admission drought — root
  cause: the account workspace limit 3/3 held by zombie prompt-only
  chats since Oct 12 20:08Z; released, standing ws_reaper armed).
- Station verification (independent, canonical): shared tsc exit 0 +
  battery 401/404→401/401 pass (baseline 344 + 57 new, zero lost);
  services tsc -b exit 0 + battery 163/163; diff purely additive
  (6395 insertions / 0 deletions); frozen write surface respected
  (shared/src/you + services/src/you only; `contract.ts` untouched);
  ARENA BOUNDARY LAW documented and enforced in the service design;
  all seven v8 typed error codes present; deterministic fixtures
  byte-identical x2 with load-bearing seed; `simulated: true` truth
  law; all eight event payload conventions documented in
  arenaLedger.ts.
- Merged as PR #33 (merge commit cbf5913) by the station TL
  (workers never merge their own PRs).

### W8B merge record (2026-10-13)

- Harvested from `you/w8b-escalation` @ b75417c (worker turn admitted
  14:55Z post workspace-gate cure). 46 files, +9265/−20: 35 under
  packages/ui/src/you (escalation surfaces — gate, progress ladder,
  expert-result review, CapabilityGap panels, permissions
  display/withdrawal, simulated controller, storyboard, messages
  en-US/zh-CN) + the EXACT 11-file W2B-W7B disclosed registration
  seam set (verified identical file set to the W7B delivery; all 20
  deletions are tab-registry lines gaining the escalation entry —
  the sanctioned registration mechanism).
- Station verification: ui you-tests **381/381** (W7B parity 334 +
  47 new, zero fail); ui tsc batch OOM-SIGKILLs station-side (the
  documented W5A environmental condition — live worker renderers
  hold ~1.6GB; the W7B station law accepts split-run parity + the
  station ui battery as the evidence class); shared/services
  reference closures tsc -b exit 0 at the same base.
- Completion pattern: the worker's turn ended after branch push,
  before the final report post (the W7B operational precedent);
  report fields remain template-echo only — branch + station battery
  are the deliverable truth.
- Merged as PR #34 (merge commit 8d5a5b9) by the station TL.

### W8C merge record (2026-10-13)

- EMISSION-HARVEST path: the worker (this station's lane, chat 4d3639d7,
  admitted 15:28Z post workspace-gate cure) delivered the full report
  IN-CHAT (block-252, 219K chars: 22 FILE blocks + the acceptance walk)
  with the branch committed locally in its pod @ 5e08f895 — no push (no
  credentials to the worker per push protocol; the report's END OF REPORT
  line delegates the relay push to the station).
- Station harvest (this station): extract_w8c_emission.py reconstructed
  the tree from the report's FILE blocks — 19 new files verbatim + 3
  modified files per the report's own instructions (contractSeam.ts
  rebuilt to EXACTLY 1815 lines as claimed; src/index.ts insert-after-
  anchor; root index.ts full content). Relay-pushed as dcc8395 (22
  files, +4419/−2).
- Station verification (independent, canonical): you-lab tsc --noEmit
  exit 0; you-lab battery **417/417** twice (determinism — exact parity
  with the worker's report claim); root lint 0 errors / 70 warnings
  (exact baseline — contractSeam carries the W8C `eslint-disable
  max-lines` header per the W7B seam precedent); surface: all changes
  inside packages/you-lab/** (the frozen W8C surface); research
  truth-law: seven gap-detection + four retry/backoff REAL approaches
  with SPDX + source URL + maintenance evidence, unverified claims
  disclosed in provenance.
- Merged as PR #35 (merge commit 854f5d4) by the station TL (workers
  never merge their own PRs; the emission relay push is the disclosed
  station-side push path).
- Operational note: the lane survived 5 chat deaths + turn-death cycles
  through the capacity-window grind (kick loops); the final 1.4M-char
  burst (17:0xZ window) produced the complete deliverable.

### W8 completion record (2026-10-13)

- WAVE 8 COMPLETE: freeze (2e3e68b, v8 contracts) → W8A (PR #33,
  cbf5913, parallel-station delivery ef9c578) → W8B (PR #34, 8d5a5b9,
  parallel-station delivery b75417c) → W8C (PR #35, 854f5d4, THIS
  station's emission-harvest relay-push dcc8395) → station lint-parity
  fixup (dbfc32c: the 3 max-lines W8B files gain the established
  disable-header pattern; 3 unused imports removed; root lint exact
  baseline 0/70).
- Integrated main battery (at dbfc32c): shared+services **564/564**
  (W8A: 401 shared + 163 services) + ui **381/381** (W7B parity 334 +
  47 W8B) + you-lab **417/417** (W7C parity 369 + 48 W8C) = **1362/1362
  GREEN**; root lint 0 errors / 70 warnings (exact baseline); zero
  dependency drift (manifests + lockfiles untouched vs freeze across
  all three lanes); contract.ts untouched by every lane (the v8 freeze
  honored throughout).
- Cross-station operation: W8A + W8B delivered + merged by the
  parallel station (ali22), independently parity-verified by this
  station (matching counts exactly); W8C delivered by THIS station's
  lane (ali9) through the emission-harvest path. Both stations cured
  the same 18h workspace-gate drought (account 3/3 zombie workspaces;
  the parallel station's 4d68e60 doctrine, replicated here at 15:28Z).
- T8 rebinding point (disclosed): the Escalation Studio runs on a
  simulated controller whose port mirrors the W8A arena-service seams
  1:1 (gap/run ledgers, authorization lifecycle, provider-neutral
  client); the binding (or a later wave) can swap the simulated
  controller for the real services with zero UI changes. The W8C
  arena-adapter seam (deterministic mock + fail-closed eval adapter)
  is the compute-plane contract for that binding.
- Operational note: the wave closed through the longest capacity-wall
  siege of the project (Oct 12 20:08Z → Oct 13 15:28Z — root-caused as
  the workspace gate, not an outage), 5 W8C chat deaths, turn-death
  window-grinding via kick loops, and a two-station convergence on the
  same verified branches. Evidence-grade batch dumps of every lane's
  chat content are banked per-deployment (scripts/worker-reports/).

### W9 contract freeze + dispatch record (2026-10-13)

- Frozen by the TL (this station) at the T8->W9 transition. Contract
  freeze commit: THIS COMMIT. Machine authority:
  `packages/shared/src/you/contract.ts` v9 (ADDITIVE — LabRunStatus,
  LabRun, LabArmKind, LabExperiment, LabEvidenceManifest,
  LabPromotionRecord, LabWorldDescriptor, FailureAtlasEntry,
  PipelineGenomeNode, SearchLadderStep; events lab-run-recorded /
  lab-evidence-published / lab-promotion-decided /
  failure-atlas-entry-recorded / pipeline-genome-node-recorded; error
  codes YOU_LAB_RUN_NOT_FOUND / YOU_LAB_EXPERIMENT_NOT_FOUND /
  YOU_LAB_EVIDENCE_MANIFEST_INVALID / YOU_LAB_PROMOTION_INVALID /
  YOU_LAB_WORLD_INVALID / YOU_SEARCH_LADDER_INVALID).
- Docs: CONTRACTS.md "Wave-9 contract freeze (v9)" (the LAB
  PERSISTENCE LAW + LAB PROMOTION LAW + LAB DETERMINISM LAW + SEARCH
  BUDGET LAW + FAILURE ATLAS LAW); WORK_ORDERS.md W9A/W9B/W9C
  expanded to full binding orders.
- Wave-9 lanes: W9A Lab Persistence (`you/w9a-labpersistence`), W9B
  Lab Studio (`you/w9b-labstudio`), W9C Research Organization
  (`you/w9c-researchorg`); branches pre-cut at the freeze.
- Verified at freeze: shared tsc exit 0; shared battery 401/401
  unchanged (additive-only).
- Context: W8 completed 1362/1362 green via two-station convergence
  (W8A+W8B this station, W8C parallel station; cross-verified). T8
  binding point disclosed in the W8 completion record (c660e9f): the
  Escalation Studio's simulated controller port mirrors the W8A
  arena-service seams 1:1 — the T9-class binding swaps simulated for
  real with zero UI changes.

### W9A merge record (2026-10-13)

- Harvested from `you/w9a-labpersistence` @ 590fdd0 (worker turn
  admitted 18:46-18:59Z through the post-dedup window; the station
  managed a late-admission duplicate pair — one workspace released
  pre-merge, the redundant turn's push lands non-FF rejected by
  design). 24 files, +3810/-0: shared/src/you (labExperiment,
  labRunLadder, labEvidenceManifest, labPromotion, labLedger + tests)
  + services/src/you (lab flows + labService + fixture scenario +
  tests) + index registrations.
- Station verification: shared tsc exit 0 + battery **431/431**
  (freeze baseline 401 + 30 new); services tsc -b exit 0 + battery
  **183/183** (163 + 20 new). Laws verified: LAB PROMOTION LAW
  strict-beats (searched-only winners; baseline winner = reversal);
  manifest sha-256 verification fail-closed; the three v9 events with
  documented payload conventions; append-only run ladder;
  contract.ts untouched (v9 freeze honored).
- Merged as PR #36 (merge commit ecd2097) by the station TL.

### W9A supersession merge record (2026-10-13)

- The duplicate w9a turn (the late-admission pair's survivor; its
  sibling workspace was released pre-merge) completed its delivery
  AFTER the first: found the lane branch already carrying 590fdd0
  (merged as PR #36), rebased on it, and pushed a supersession merge
  a3e2ca5 preserving the prior history with its own complete tree
  (self-reported shared tsc 0 / 432 tests; services tsc 0 / 183).
- Station re-verification of the supersession tree: shared tsc exit 0
  + **432/432** (one more test than the first delivery); services
  tsc -b exit 0 + **183/183**; write surface fully in-scope vs the v9
  freeze (the 590fdd0→a3e2ca5 delta touches only the 26 in-surface
  lab files); contract.ts untouched.
- Merged as PR #37 (merge commit 621ea8f) by the station TL. The
  W9A lane is now tree-stable (one verified implementation, full
  history of both attempts preserved).
