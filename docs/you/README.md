# YOU — Repository Source of Truth

This directory is the authoritative product, architecture, implementation, governance and handoff source for turning this repository into YOU.

## Authority

When implementing YOU, use this order:

1. `AGENTS.md`
2. `docs/you/README.md`
3. `docs/you/ARCHITECTURE.md`
4. `docs/you/CONTRACTS.md`
5. `docs/you/FIXTURES.md`
6. `docs/you/SECURITY.md`
7. `docs/you/EDITING_INTERCHANGE.md`
8. `docs/you/LAB.md`
9. `docs/you/ARENA.md`
10. `docs/you/PROVIDER_ECOSYSTEM.md`
11. `docs/you/IMPLEMENTATION_PLAN.md`
12. `docs/you/TASK_LEDGER.md`
13. `docs/you/WORK_ORDERS.md`
14. `docs/you/OPERATOR_ACCEPTANCE.md`
15. `docs/you/REPO_MAP.md`
16. `docs/you/DECISIONS.md`
17. tests and live code evidence
18. live GitHub branch/PR/CI state

Conversation history is not an implementation dependency.

## Product name

Product: **YOU**

Repository: `payswapdotorg/LikeWise`

The repository began from the ZCode codebase. ZCode remains the host/workbench foundation; product semantics in this directory define the transformation into YOU.

## Core thesis

YOU is a human-reality and agent-embodiment workbench.

The user expresses intent. An agent plans and executes. A Solution is the live navigable environment in which the result can be inspected, edited, exported, and improved. When the user takes over, YOU captures the resulting learning signal. When automation reaches a real capability boundary, YOU can escalate to Arena.

Canonical loop:

intent -> capability decomposition -> organization/toolchain -> execution -> Solution -> feedback/takeover -> learning -> improved organization/toolchain -> capability gap -> Arena -> human expert -> reusable capability.

## Non-negotiable rule

Every implementation claim must be recoverable from this repository or from live GitHub/CI evidence. If a decision is not recorded here, it is not an implementation requirement.

## Repository change protocol

For any new behavior:

1. update the applicable spec first;
2. identify the sole state owner;
3. identify contract and event boundaries;
4. define acceptance scenarios;
5. implement inside the assigned lane;
6. run required verification;
7. update the task ledger and evidence;
8. only then merge.

Architecture changes require an ADR under `docs/you/adr/`.

## Worker concurrency

Maximum concurrent implementation workers: **3**.

The three permanent lanes are:

- Worker A — Core/API/Domain
- Worker B — Studio/UX/Editors
- Worker C — Labs/AI/Technology

The TL owns contracts, integration, security, architecture changes, dependency/lockfile reconciliation, promotion and release gates.

Concurrent Work Orders must have pairwise-disjoint write surfaces. Workers may read any repository content but may only write their assigned surfaces.

## Current initial gate

The first product gate is **Solution Runtime / Operator Review**.

Do not begin real human reconstruction, GPU provisioning or production model integration until the operator-approved Solution surface demonstrates:

- native ZCode docking parity;
- navigable virtual environment;
- intent -> agent -> Solution interaction;
- spatial feedback;
- deterministic simulated improvement;
- manual takeover;
- EditSession capture;
- before/after comparison;
- export/open-in-editor flow;
- learning consent;
- repeated-intent learning;
- simulated capability gap -> Arena escalation loop.

See `OPERATOR_ACCEPTANCE.md`.
