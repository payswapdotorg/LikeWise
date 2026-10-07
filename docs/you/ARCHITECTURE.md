# YOU Architecture

## 1. System boundary

ZCode supplies the operating shell: workspace, Agent/session runtime, Browser, Terminal, Git, shared UI primitives, desktop/web platform abstractions, persistence patterns, artifact infrastructure and existing pane/workbench mechanisms.

YOU supplies the human-reality domain and turns Solution into a first-class workspace surface.

Do not create a second application-wide docking/layout framework.

## 2. Core conceptual model

```
Workspace
  |
  +-- Chat / Agent
  +-- Browser
  +-- Terminal
  +-- Git / Code
  +-- Artifacts
  +-- Solution   <--- first-class peer
        |
        +-- viewport
        +-- inspector
        +-- evidence
        +-- timeline
        +-- editor
        +-- feedback
        +-- compare
```

Solution is a workspace surface, not a modal and not merely an HTML export.

## 3. Canonical planes

### Workspace plane
ZCode owns panes, focus, drag/drop, persistence, workspace identity, remote/local topology and platform lifecycle.

### Intent plane
Stores user objective, constraints, preferences, target outputs and acceptance criteria.

### Evidence plane
Stores immutable capture/evidence references, consent references, quality observations and provenance.

### Twin plane
Stores HTIR and immutable TwinVersions.

### Performance plane
Stores pose, gaze, facial expression, voice, timing and interaction state independently from identity.

### Technology plane
Stores technology/provider/editor candidates, adapter versions, capability profiles, benchmark evidence, provenance and licensing.

### Organization plane
Stores executable agent organizations: roles, bodies, souls, tools, dependencies, policies and verification strategy.

### Compute plane
Routes jobs through provider-neutral adapters and records cost, latency, quota and reliability observations.

### Reality/Render plane
Compiles intent + twin + performance + environment into images, video, 3D, AR or realtime experiences.

### Solution plane
Projects canonical state into an interactive, versioned, inspectable environment.

### Learning plane
Captures feedback, manual takeover, edit sessions, expert intervention, preferences, tool gaps, knowledge gaps and validated learning artifacts.

### Escalation plane
Calls Arena only when the capability gap cannot be acceptably resolved through available automation, and only through the provider-neutral Arena boundary.

## 4. HTIR

HTIR = Human Twin Intermediate Representation.

Domains:

- identity binding using opaque identifiers and consent references;
- morphology and anthropometry;
- geometry, skeleton, face and hands;
- appearance, materials and hair;
- articulation and blendshapes;
- neural appearance;
- motion/performance profile;
- optional voice;
- style;
- confidence;
- provenance;
- domain extensions.

Explicit geometry and neural appearance are complementary. No single reconstruction method is canonical.

Raw evidence is immutable. Derived representations reference evidence by immutable version/hash.

## 5. Solution model

A Solution consists of:

- SolutionIdentity;
- SolutionVersion;
- scene/environment state;
- canonical entity graph;
- renderer;
- viewport state;
- user interaction capabilities;
- feedback targets;
- evidence requests;
- editor integrations;
- artifact references;
- provenance;
- consent state.

A SolutionVersion is immutable. Live editing creates a candidate ChangeSet; acceptance creates a new canonical version.

## 6. Runtime architecture

```
ZCode Host
   |
Solution Surface
   |
SolutionRuntimeHost
   |
typed SolutionBridge
   |
Native Solution Runtime
   |
canonical Solution state

future:
SolutionRuntimeHost
   |
sandboxed runtime
```

The host bridge is explicit and capability-limited.

Native first-party Solutions use React + Three.js/React Three Fiber where suitable.

Generated/untrusted Solutions must not receive arbitrary host privileges.

## 7. Observation hierarchy

Agents may observe the Solution through:

1. semantic state;
2. visual snapshot;
3. historical/versioned state.

Semantic observations are preferred for reliable action planning. Visual observation supplements semantic state.

## 8. Agent action model

Agents never directly mutate DOM/canvas/scene internals.

```
Agent
 -> typed application command
 -> application service
 -> canonical state transition
 -> version/change-set
 -> Solution projection
 -> verification
```

## 9. EditSession

A manual intervention is first-class:

```
Agent result
 -> user takeover
 -> EditSession
 -> observed actions or inferred outcome
 -> artifact diff
 -> validation
 -> accepted version
 -> learning candidate
```

Observed action evidence and outcome-inferred evidence are distinct.

## 10. Capability gap

Canonical categories:

- TOOL_GAP
- EDITOR_GAP
- MODEL_GAP
- SKILL_GAP
- KNOWLEDGE_GAP
- DATA_GAP
- EXPERT_GAP

A gap records attempted approaches and evidence before recommending escalation.

## 11. Organization compiler

Intent does not select a model directly.

```
Intent
 -> capability decomposition
 -> candidate roles
 -> Agent Bodies
 -> Soul assignments
 -> tools/editors/providers
 -> dependency graph
 -> compute plan
 -> execution
 -> evaluation
```

The Lab optimizes the organization/toolchain, not merely individual models.

## 12. Learning scope

Learning can be scoped:

GLOBAL
TENANT
APPLICATION
PROJECT
USER
TWIN
ASSET
TASK

A user preference must never silently become a universal reconstruction rule.

## 13. AI-provider embodiment

Agent Body and Soul are separate.

Agent Body:
- appearance;
- role;
- capabilities;
- tools;
- policies;
- memory contract;
- evaluator contract.

Soul:
- LLM/VLM/runtime binding.

A Body can be possessed by another Soul without changing the Body contract.

Agent embodiment states:

- listening
- reading
- typing
- thinking
- tool_use
- speaking
- interrupted
- idle
- unavailable

System-one/system-two are routing profiles, not fixed model identities.

## 14. Export and editor principle

The user should be able to stay inside YOU as long as possible.

When native editing is insufficient:

```
Solution
 -> recommended editor
 -> EditSession
 -> edited artifact
 -> diff/validate
 -> candidate version
 -> user acceptance
 -> canonical version
```

External editors are adapters, never domain authorities.

## 15. Arena

Arena is the human capability escape hatch.

```
CapabilityGap
 -> automated retry/search
 -> if unacceptable
 -> Arena EscalationRequest
 -> bounded ExpertSession
 -> validated result
 -> immediate application
 -> optional learning/tool/skill/knowledge artifact
```

YOU remains authoritative over its own live state. Arena does not silently mutate it.

## 16. Security

Identity/liveness evidence is distinct from visual similarity.

Medical/biometric data is policy-controlled.

Large media belongs in object storage; relational persistence stores metadata/hashes/references.

No hidden chain-of-thought is captured or exposed.

## 17. Reliability

Every long-running operation has one durable owner and a durable state machine.

Required properties:

- idempotency;
- resumability;
- cancellation;
- bounded retries;
- provider circuit breakers;
- observability;
- deterministic fixture mode;
- reproducible pipeline manifests.

## 18. First implementation boundary

Phase 0 implements a deterministic synthetic human and complete Solution/feedback/takeover loop.

Real reconstruction is a later adapter.

