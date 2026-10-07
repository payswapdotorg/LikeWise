# YOU Full Implementation Plan

## Execution law

The TL freezes contracts, dispatches disjoint work orders, reconciles evidence, and owns final integration.

Maximum three concurrent workers.

Workers may read the whole repo but write only their assigned surfaces.

Root lockfile/dependency reconciliation is serialized by TL.

## Stage 0 — Repository adoption and contract freeze

TL:

1. verify repository baseline;
2. preserve ZCode platform architecture;
3. establish YOU branding without breaking package identities prematurely;
4. read `AGENTS.md`, `DESIGN.md`, `CONTEXT.md`, architecture-governance skill and controlled module context;
5. add/freeze YOU contracts;
6. establish Solution as a first-class surface;
7. create task/ownership ledger;
8. create deterministic fixture strategy;
9. document acceptance.

Exit:
- repository source of truth is complete;
- contracts are frozen;
- concurrent surfaces are assigned.

## Stage 1 — Solution Runtime / Operator Gate

Worker A:
- Solution protocol;
- shared domain objects;
- application services;
- deterministic fixture state;
- persistence/replay plumbing.

Worker B:
- native Solution pane;
- ZCode docking parity;
- Solution viewport;
- inspector;
- feedback UX;
- compare/version UX;
- export/open-in-editor UX;
- Stripe-inspired information architecture without copying branding/assets.

Worker C:
- Technology Registry/editor capability model;
- editor adapter skeletons;
- deterministic organization compiler;
- mock editor capabilities;
- Lab fixture for intent -> organization.

Exit:
Operator can complete every Phase-0 acceptance scenario.

NO real reconstruction dependency.

## Stage 2 — Evidence/Capture

A:
- capture/evidence service;
- immutable evidence records;
- consent/policy;
- upload/persistence.

B:
- capture UX;
- evidence review;
- targeted EvidenceRequest UX;
- consent UX.

C:
- capture technology adapters;
- segmentation/pose/reconstruction candidates;
- benchmark harness.

Exit:
authorized sample -> evidence -> reviewable input.

## Stage 3 — Reconstruction / HTIR

A:
- Twin/HTIR services;
- immutable TwinVersion;
- provenance;
- quality/dependency events.

B:
- Twin Studio;
- quality map;
- deficiency review;
- additional-evidence loop.

C:
- first production-eligible open pipeline;
- hosted/mock adapters;
- reconstruction evaluation;
- Pipeline Genome candidate.

Exit:
authorized sample -> real reconstruction adapter -> persisted HTIR/TwinVersion -> reviewable Solution.

## Stage 4 — Performance / rendering

A:
- Performance contract/service;
- RenderJob;
- artifact lineage.

B:
- Performance Studio;
- template ingestion;
- timeline;
- compare;
- output review.

C:
- pose/face/motion extraction;
- retargeting;
- image/video/3D render adapters.

Exit:
Twin + Performance + Template -> artifact.

## Stage 5 — Editing ecosystem

A:
- EditSession;
- ChangeSet;
- import/export APIs;
- artifact lineage.

B:
- native editors;
- embedded editor hosts;
- external editor launch UX;
- manual takeover UX.

C:
- editor adapters;
- round-trip benchmarks;
- capability profiles.

Exit:
user can edit inside YOU or through a suitable external editor and return a validated candidate version.

## Stage 6 — Learning from takeover

A:
- learning event ledger;
- scoped preference persistence;
- trajectory/evidence links.

B:
- “Should I learn this?” UX;
- edit-session replay;
- preference controls;
- learning transparency.

C:
- organization learning;
- editor/tool selection learning;
- manual-effort objective;
- candidate ranking.

Exit:
repeated intent benefits from accepted prior manual intervention.

## Stage 7 — AI-provider avatars

A:
- Agent Body/Soul APIs;
- tenant policy;
- avatar-session events.

B:
- Agent Avatar Studio;
- communication/performance state UI.

C:
- Soul adapters;
- realtime state machine;
- provider routing;
- WebRTC research.

Exit:
external LLM can drive a YOU body without becoming canonical state.

## Stage 8 — Arena

A:
- capability gap persistence;
- Arena SDK/API boundary;
- event/webhook integration.

B:
- escalation UX;
- expert progress;
- result review;
- learning-permission UX.

C:
- capability-gap detection;
- automatic retry/search policy;
- Arena adapter;
- ToolGap/Knowledge learning projections.

Exit:
capability gap -> authorized Arena expert -> typed result -> YOU applies result -> optional learning artifact.

## Stage 9 — Labs productionization

A:
- durable Lab runs/manifests;
- benchmark persistence.

B:
- Lab/experiment Solution surfaces.

C:
- deterministic worlds;
- Organization Compiler;
- search/RL ladder;
- Failure Atlas;
- Pipeline Genome;
- promotion gates.

Exit:
HUMAN-REALITY benchmark produces reproducible organization/pipeline evidence.

## Stage 10 — Product ecosystem

Add behind adapters and gates:

- virtual try-on;
- game/VRM/GLB exports;
- AR;
- realtime telepresence;
- customer-owned compute;
- additional regional providers;
- additional styles.

## Stage 11 — production hardening

Required:

- security review;
- threat model;
- load testing;
- cost guards;
- provider circuit breakers;
- rate limiting;
- malware scanning/quarantine;
- data retention/deletion;
- audit;
- backup/restore;
- deployment/rollback;
- accessibility;
- responsive behavior;
- product E2E;
- incident runbook.

## Stage 12 — launch gate

Fresh developer must be able to:

1. create a workspace/account;
2. express an intent;
3. obtain an initial Solution;
4. inspect it;
5. provide feedback;
6. supply evidence;
7. generate a Twin;
8. improve it;
9. apply Performance;
10. render outputs;
11. edit manually;
12. import/export;
13. accept a new version;
14. let the agent learn with permission;
15. repeat the task;
16. encounter a capability gap;
17. escalate to Arena;
18. review the expert result;
19. inspect provenance/consent;
20. recover from injected failure.

## No-drift rule

No feature expansion during a red blocking gate.

Fix-only mode begins at final acceptance.

Every phase ends with:
- merged PRs;
- green CI;
- updated ledger;
- evidence bundle;
- architecture review;
- exact next-wave base SHA.
