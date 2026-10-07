# YOU Architecture Decisions

## ADR-001 — ZCode remains the host

Decision:
Build YOU by extending the ZCode workbench rather than creating a separate application shell.

Reason:
ZCode already owns workspace lifecycle, panes, Browser, Agent/session, artifact surfaces, platform abstraction and desktop/web parity.

Status: accepted.

## ADR-002 — Solution is a first-class surface

Decision:
Solution joins Browser/Artifact/Workflow/etc. as a native workspace surface.

Reason:
The user must be able to keep an AI-created environment visible, docked, reordered and persistent.

Status: accepted.

## ADR-003 — No second global docking framework

Decision:
Do not introduce Dockview/FlexLayout/etc. for the global YOU workspace.

Reason:
ZCode already has the global pane/workbench authority. A second docking engine would create duplicate state and drift.

Status: accepted.

## ADR-004 — Solution is a runtime, not merely HTML

Decision:
Model Solution as a versioned environment plus renderer.

Reason:
The environment must support semantic selection, feedback, editing, provenance, versioning and agent actions.

Status: accepted.

## ADR-005 — Human takeover is a first-class learning event

Decision:
Manual editing creates an EditSession and optional learning candidate.

Reason:
Repeated user intervention is direct evidence of a capability, tool-selection or preference gap.

Status: accepted.

## ADR-006 — External editors remain adapters

Decision:
Professional editors such as Blender are integrated through an adapter and/or platform launcher, not treated as domain authorities.

Reason:
Users may need software with capabilities that should not be reimplemented or embedded.

Status: accepted.

## ADR-007 — Intent routes organizations

Decision:
The Lab searches organizations/toolchains for intent rather than selecting a model directly.

Reason:
The optimum may be a specialist team, editor, model, tool or hybrid organization.

Status: accepted.

## ADR-008 — Arena is the capability escape hatch

Decision:
Arena is called after evidence-backed automated alternatives are inadequate.

Reason:
Human expertise is a programmable capability boundary and can produce immediate and reusable value.

Status: accepted.

## ADR-009 — Deterministic Phase 0

Decision:
Operator review starts with a synthetic deterministic environment.

Reason:
It proves the interaction architecture without blocking on GPU/model availability.

Status: accepted.

## ADR-010 — Free-tier services are accelerators

Decision:
Vercel, Neon, R2, Upstash and similar providers are adapters/optional accelerators, not semantic authorities.

Reason:
Free-tier limits and provider terms can change.

Status: accepted.
