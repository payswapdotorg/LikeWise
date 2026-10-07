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

Objective:
Implement the canonical Solution domain/application-service foundation and deterministic fixture.

Write:
`packages/shared/src/you/**`
and TL-approved dedicated core/service paths.

Do not write:
UI, editor integration, Lab implementation.

Acceptance:
- typed Solution protocol;
- immutable versions;
- deterministic state;
- feedback event;
- candidate ChangeSet;
- tests.

## W1B — Solution Studio

Objective:
Make Solution a native ZCode workspace surface with excellent UX.

Read first:
`DESIGN.md`, `packages/ui/src/app-shell/*`, `packages/ui/src/v4/*`, existing Preview/Artifact/Browser surfaces.

Write:
`packages/ui/src/you/**`
and dedicated UX tests.

Acceptance:
- native pane/tab;
- dock/reorder/close/reopen;
- viewport;
- semantic selection;
- feedback;
- version compare;
- export/open-in-editor;
- loading/error states;
- operator demo.

Do not introduce a new global docking library.

## W1C — Technology/Editor/Lab Foundation

Objective:
Create provider-neutral editor and organization capability infrastructure.

Write:
TL-approved C-lane packages under `packages/you-lab/**` plus dedicated fixtures.

Acceptance:
- technology registry;
- editor capability profile;
- editor adapter seam;
- deterministic Organization Compiler;
- mock candidates;
- benchmark structure.

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
