# YOU Lab

## Mission

Discover the best executable organizations, toolchains and technology combinations for a user's intent.

The Lab is not primarily a model leaderboard.

It is an organization/compiler optimization system.

## Input

```
Intent
Constraints
User preferences
Target artifact
Target quality
Latency budget
Cost budget
Privacy policy
Platform
Available editors
Available providers
Learning policy
```

## Compilation

```
Intent
 -> capability requirements
 -> candidate roles
 -> Agent Body graph
 -> Soul assignments
 -> tools
 -> editors
 -> technologies
 -> execution order
 -> compute plan
 -> evaluator
```

## Organization comparison

Every serious Lab experiment compares:

1. generalist baseline;
2. hand-designed organization;
3. searched organization.

The searched organization is only promoted when it beats the baseline under the relevant objective and constraints.

## World

A Lab world can contain:

- actors;
- ground truth;
- cameras;
- lighting;
- clothing;
- hair;
- geometry;
- motion;
- sensors;
- noise;
- occlusion;
- perturbations.

Synthetic worlds are deterministic by seed and explicitly marked simulated.

Lab truth never becomes production human truth.

## Learning ladder

1. deterministic replay
2. evaluator-backed optimization
3. search/bandits
4. offline policy learning
5. bounded RL where justified
6. shadow/canary
7. production promotion

Deterministic benchmark gates remain authoritative.

## Pipeline Genome

A PipelineCandidate records a graph of:

- adapters and versions;
- parameters;
- models;
- organizations;
- Bodies;
- Souls;
- tools/editors;
- compute;
- evaluator versions.

Mutation creates new candidates; existing candidates remain immutable.

## Failure Atlas

Capture repeatable failures:

- inputs;
- conditions;
- organization;
- pipeline;
- technology versions;
- artifacts;
- suspected causes;
- confidence;
- remediation;
- whether user takeover occurred;
- whether Arena intervention was required.

## Capture Scientist

The Lab can recommend only the additional evidence needed to address a known deficiency.

Examples:

- front/side/three-quarter face;
- short walking clip;
- natural talking clip;
- hand articulation;
- lighting variation.

The system must request minimum sufficient evidence, not maximize data collection.

## User-takeover learning

Manual interventions become high-value trajectories.

Record:

- task;
- starting state;
- user action trajectory where observable;
- before/after;
- changed parameters;
- time;
- editor;
- outcome;
- user feedback;
- learning permission.

The Lab can learn:

- better roles;
- better tool selection;
- better editor selection;
- better pipeline order;
- better parameters;
- user-specific preferences;
- missing capabilities.

## Capability-gap policy

Before Arena escalation:

1. inspect prior successful organizations;
2. retry with a strong alternative;
3. inspect Technology Registry for a missing tool;
4. inspect known user preference;
5. inspect whether more evidence can unblock;
6. only then classify as expert-eligible.

## Tool-gap promotion

```
Expert uses unavailable tool
 -> ToolGapSignal
 -> tool specification
 -> adapter candidate
 -> benchmark
 -> security/license review
 -> organization candidate
 -> promotion/canary
```

## Cost/latency objective

A solution is better when it achieves the user's intent with less:

- human time;
- agent time;
- compute cost;
- latency;
- interaction overhead;

while meeting quality and policy constraints.

## Lab agent bodies

Lab roles are dynamically composed as required.

Possible roles are examples, not a fixed roster:

- intent analyst;
- capture scientist;
- reconstruction scientist;
- geometry specialist;
- face specialist;
- motion specialist;
- rendering specialist;
- editor/tool specialist;
- evaluator;
- adversarial reviewer;
- cost optimizer;
- rights/licensing reviewer;
- integration engineer.

The Organization Compiler chooses roles rather than requiring all roles in every experiment.
