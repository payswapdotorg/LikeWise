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

Objective:
Implement immutable evidence/capture/consent application services.

## W2B — Capture Studio

Objective:
Implement guided evidence capture/review and targeted evidence requests.

## W2C — Capture Technology

Objective:
Integrate and benchmark capture/segmentation/pose candidates.

## W3A — Twin Authority

Objective:
Implement HTIR, immutable TwinVersion, provenance and quality state.

## W3B — Twin Studio

Objective:
Implement Twin inspection, quality maps, deficiencies and improvement flow.

## W3C — Reconstruction

Objective:
Implement first production-eligible reconstruction adapter plus mock/fixture adapter and benchmark.

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
