# YOU ↔ Arena

## Authority

Arena is an external capability escalation platform.

YOU remains authoritative over:

- live Solution state;
- TwinVersions;
- local/application workflow;
- user consent for YOU operations.

Arena owns:

- expert discovery;
- qualification;
- expert session;
- expert payment;
- expert-side intervention lifecycle;
- reusable Arena learning artifacts.

Reference repository: https://github.com/payswapdotorg/Arena

## Escalation trigger

Escalate only after the agent/organization has:

- identified a concrete capability gap;
- recorded attempted approaches;
- determined that retry/search/evidence requests are unlikely to satisfy the intent within constraints;
- confirmed user/application policy permits human escalation;
- prepared the minimum sufficient context capsule.

## Modes

Use Arena-compatible modes:

- SOLVE
- CORRECT
- UNBLOCK
- REVIEW
- TEACH
- TOOL_GAP
- KNOWLEDGE
- EVALUATE

## Environment capsule

Send only the minimum sufficient state:

- task/intent;
- relevant Solution version;
- relevant artifacts;
- approved evidence;
- relevant tool availability;
- constraints;
- privacy/redaction policy;
- permitted actions;
- learning permissions.

Do not expose the entire workspace by default.

## Expert outcome

Arena returns a typed result. YOU validates it and applies it through its own application-service authority.

Arena never silently mutates YOU's live world.

## Expert learning

Subject to explicit rights/permissions, an expert session can generate:

- correction artifact;
- solution artifact;
- workflow/skill candidate;
- ToolGapSignal;
- scoped knowledge patch;
- evaluator;
- benchmark case.

## Privacy

Arena integration must preserve the user's policy.

Separate:

- operational result permission;
- source-data retention;
- reusable learning;
- public publication.

## Failure mode

If Arena is unavailable:

- preserve the capability gap;
- provide the user with the reason;
- offer a safe export or manual path when available;
- never fake success.

## First implementation

Phase 0 uses a deterministic Arena mock adapter.

Real Arena integration is a subsequent gated phase.
