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
- YOU-101: GitHub issue #2 — W1A dispatched (branch `you/w1a-core`)
- YOU-102: GitHub issue #3 — W1B dispatched (branch `you/w1b-studio`)
- YOU-103: GitHub issue #4 — W1C dispatched (branch `you/w1c-lab`)
- Status: W1 ACTIVE (3-way concurrent, disjoint frozen surfaces)

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
