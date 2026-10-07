# YOU — Final TL Handoff

## Mission

Turn this ZCode-based repository into YOU using only repository state.

Do not consult conversation history for implementation requirements.

## First action

Read:

1. `AGENTS.md`
2. `docs/you/README.md`
3. `docs/you/ARCHITECTURE.md`
4. `docs/you/CONTRACTS.md`
5. `docs/you/SECURITY.md`
6. `docs/you/EDITING_INTERCHANGE.md`
7. `docs/you/LAB.md`
8. `docs/you/ARENA.md`
9. `docs/you/PROVIDER_ECOSYSTEM.md`
10. `docs/you/IMPLEMENTATION_PLAN.md`
11. `docs/you/TASK_LEDGER.md`
12. `docs/you/WORK_ORDERS.md`
13. `docs/you/OPERATOR_ACCEPTANCE.md`
14. `docs/you/REPO_MAP.md`
15. `docs/you/DECISIONS.md`
16. `DESIGN.md`
17. `CONTEXT.md`

Then run the normal repository freshness/architecture checks required by `AGENTS.md`.

## Architecture to protect

- ZCode is the host.
- Solution is a first-class native workspace surface.
- No second global docking framework.
- Solution is a versioned runtime.
- HTIR is technology-neutral.
- Evidence is immutable.
- TwinVersions are immutable.
- Agent Body and Soul are separate.
- Intent routes organizations/toolchains.
- User takeover is a first-class learning event.
- Editors are adapters.
- Arena is the human capability escape hatch.
- UI/HTTP/SDK/MCP share application-service authority.
- Free-tier infrastructure is optional/replaceable.

## First implementation gate

Do ONLY the Solution/operator gate first.

The synthetic demo must prove:

intent
 -> agent
 -> Solution
 -> feedback
 -> targeted evidence request
 -> deterministic improvement
 -> manual takeover
 -> EditSession
 -> export/open editor
 -> re-import/diff
 -> learning permission
 -> repeat intent
 -> simulated CapabilityGap
 -> simulated Arena intervention

The operator must be able to judge all of this in the running application.

Do not introduce real reconstruction complexity until this gate passes.

## Concurrency

Use all three workers whenever the dependency graph permits.

### Worker A
Core/API/Domain.

### Worker B
Studio/UX/Editors.

### Worker C
Labs/AI/Technology.

The TL performs the contract freeze before dispatching workers.

Every worker receives:

- Work Order ID;
- exact base SHA;
- branch name;
- frozen write surface;
- acceptance criteria;
- required tests;
- explicit exclusions.

No worker waits on another worker when it can create independent work, fixtures, tests, documentation, adapters or mock infrastructure on its own lane.

### Lockfile/dependency policy

Workers may modify only their package-local manifests within their lane.

TL owns root lockfile reconciliation.

### Integration cadence

At the end of each wave:

1. inspect PRs and changed paths;
2. verify ownership compliance;
3. run clean integration battery;
4. run relevant E2E;
5. reconcile docs/ledger;
6. merge;
7. record exact resulting SHA;
8. dispatch next wave.

## Quality gate

A worker claiming completion without reproducible evidence is not complete.

Required evidence:

- changed paths;
- tests;
- exact commands;
- screenshots/video for UI;
- browser/desktop evidence where relevant;
- license/provenance;
- security;
- cost/latency;
- limitations;
- rollback.

## Production roadmap

Follow `IMPLEMENTATION_PLAN.md` stages 2–12 after Phase 0.

## Human capture

The product owner is not required to be the capture subject.

Use an explicitly authorized QA participant for F1 later.

## Infrastructure

When infrastructure is needed, prefer adapters around free/credit-backed services where currently suitable:

- Vercel;
- Cloudflare Workers;
- Cloudflare R2;
- Neon;
- Upstash;
- suitable GPU providers with free/credit-backed capacity.

Verify current terms at provisioning time. Never encode provider details into semantic contracts.

## Final release

Do not declare production readiness until `OPERATOR_ACCEPTANCE.md` plus the production gates in `IMPLEMENTATION_PLAN.md` have recorded evidence.

The repository itself is the handoff.
