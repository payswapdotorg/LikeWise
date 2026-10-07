# YOU Security and Privacy

## Principles

YOU handles highly sensitive human imagery and potentially biometric material.

Security is part of the domain architecture, not a later feature.

## Data classes

Separate:

1. public metadata;
2. ordinary project artifacts;
3. sensitive media;
4. biometric/identity evidence;
5. medical/clinical material;
6. credentials/secrets;
7. learning artifacts.

Each class has explicit policy.

## Consent

Consent is:

- explicit;
- scoped;
- revocable;
- purpose-specific;
- server-enforced;
- separately recorded for operational use and learning reuse.

No training on user biometric media without separate explicit permission.

## Liveness

Liveness/identity verification is distinct from visual similarity.

A visually similar output is not identity proof.

## Export security

Exports must respect:

- subject ownership;
- consent;
- publication rights;
- retention;
- allowed formats;
- embedded metadata policy.

Sensitive provenance information must not leak into public exports.

## Editor security

External/embedded editors are untrusted capability surfaces.

Rules:

- no automatic execution of imported macros/scripts;
- no arbitrary host filesystem access from web Solution;
- no secret exposure;
- sandbox untrusted generated content;
- validate imported assets;
- restrict network access where practical;
- enforce file size/type/duration limits.

## Arena security

Expert capsules must use minimum sufficient context and explicit redaction/policy controls.

Never provide hidden chain-of-thought.

## API security

Require:

- authenticated tenant/application identity;
- authorization on every mutation;
- typed capability checks;
- idempotency;
- replay resistance where applicable;
- rate limits;
- request tracing;
- signed URLs with short TTL;
- webhook signatures;
- audit events.

## Deepfake/impersonation abuse

Sensitive capabilities need policy controls for:

- unauthorized person use;
- deceptive impersonation;
- bulk synthetic media generation;
- identity-sensitive transformations.

Add kill switches for high-risk capabilities.

## Reliability/security gates

Production requires:

- threat model;
- security test battery;
- tenant isolation test;
- import/export abuse test;
- provider failure test;
- data deletion test;
- backup/restore test;
- audit review;
- no unresolved critical/high security issue.

## Logging

Never log:

- raw biometric media;
- secrets;
- authorization headers;
- complete sensitive prompts/data.

Logs may include structured identifiers, timings, provider, pipeline, version and typed failure code.
