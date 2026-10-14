// YOU RetentionEnforcementRecord machinery (W10A — docs/you/CONTRACTS.md
// "Wave-10 contract freeze (v10)": "RetentionEnforcementRecord (immutable
// auditable passes)"; the RETENTION LAW: enforcement records are
// immutable and auditable; a retention class NEVER overrides an active
// consent (the wave-2 consent laws hold; YOU_RETENTION_ENFORCEMENT_INVALID)).
//
// This module owns the STATELESS validators and gates (WORK_ORDERS.md
// W10A: "RetentionEnforcementRecord: immutable auditable passes;
// retention NEVER overrides an active consent"). Validation is pure: no
// clock, no rng, no store, no registry lookup — the service maps
// refusals to typed YOU_RETENTION_ENFORCEMENT_INVALID errors at its
// seam.
//
// The consent gate composes with the wave-2 consent authority — there is
// no second consent path: the caller resolves the subject's effective
// ConsentState through the wave-2 machinery (evidenceConsent.ts /
// the evidence service) and passes it in; this gate only refuses when
// that consent is ACTIVE ("granted"). A granted consent outranks every
// retention class — the pass is refused (fail-closed, never silent);
// denied / withdrawn / expired / unknown consents do not block a
// retention pass (the consent's own retention snapshot governs those
// subjects; a withdrawn consent cannot resurrect content past its
// retention class).
//
// The enforcement pass itself is the append-only `retention-enforced`
// ledger event (the frozen wave-10 event set's retention carrier; see
// platformLedger.ts for the payload contract). Each pass is an
// immutable, auditable record; the pass records the retention class
// becoming due for a subject — the content effect itself stays with the
// evidence authority (the plane separation: this service never mutates
// evidence-plane state).

import type { ConsentState, OpaqueId, RetentionEnforcementRecord } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/**
 * The sanctioned retention classes — the wave-2 RetentionPolicy classes
 * VERBATIM (reuse, never redeclare: docs/you/CONTRACTS.md wave-2
// "Retention application rules"). A platform retention pass applies one
 * of these classes; any other class string is a typed intake refusal.
 */
export const RETENTION_ENFORCEMENT_CLASSES = [
  "session-only",
  "delete-after-review",
  "project-retention",
  "tenant-retention",
] as const;

export type RetentionEnforcementClass = (typeof RETENTION_ENFORCEMENT_CLASSES)[number];

const CLASS_SET: ReadonlySet<string> = new Set(RETENTION_ENFORCEMENT_CLASSES);

/** The consent states that protect a subject from a retention pass (the active consent). */
export const RETENTION_CONSENT_PROTECTED_STATES: readonly ConsentState[] = ["granted"];

/** True when the value is one of the sanctioned retention classes. */
export function isRetentionEnforcementClass(value: unknown): value is RetentionEnforcementClass {
  return typeof value === "string" && CLASS_SET.has(value);
}

/** True when the consent state is an active (granted) consent. */
export function isRetentionConsentProtected(consentState: ConsentState): boolean {
  return (RETENTION_CONSENT_PROTECTED_STATES as readonly string[]).includes(consentState);
}

/** Pass intake (the enforcement pass facts). */
export interface RetentionEnforcementInput {
  readonly retentionClass: string;
  readonly subjectRef: OpaqueId;
}

/** A refusal returned by the stateless validators (never an exception). */
export interface RetentionEnforcementRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** The stateless pass-intake validator (the single intake authority). */
export function validateRetentionEnforcementInput(input: RetentionEnforcementInput): RetentionEnforcementRefusal | null {
  if (!isRetentionEnforcementClass(input.retentionClass)) {
    return {
      reason: "retention-class-invalid",
      detail: `retentionClass must be one of: ${RETENTION_ENFORCEMENT_CLASSES.join(", ")}`,
    };
  }
  if (typeof input.subjectRef !== "string" || input.subjectRef.length === 0) {
    return { reason: "subject-ref-empty", detail: "subjectRef must be a non-empty opaque id" };
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen enforcement pass record. The
 * enforcedAt timestamp is the injected clock reading (the service passes
 * it in; no ambient time here).
 */
export function constructRetentionEnforcementRecord(
  input: {
    readonly id: OpaqueId;
    readonly retentionClass: string;
    readonly subjectRef: OpaqueId;
    readonly enforcedAt: string;
  },
): { readonly ok: true; readonly record: RetentionEnforcementRecord } | { readonly ok: false; readonly refusal: RetentionEnforcementRefusal } {
  const refusal = validateRetentionEnforcementInput({ retentionClass: input.retentionClass, subjectRef: input.subjectRef });
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  if (typeof input.enforcedAt !== "string" || input.enforcedAt.length === 0) {
    return { ok: false, refusal: { reason: "enforced-at-missing", detail: "enforcedAt must be a non-empty ISO-8601 string" } };
  }
  return {
    ok: true,
    record: deepFreeze({
      id: input.id,
      retentionClass: input.retentionClass,
      subjectRef: input.subjectRef,
      enforcedAt: input.enforcedAt,
      simulated: true,
    }),
  };
}

/** The consent-gate decision (the RETENTION LAW's teeth). */
export type RetentionConsentDecision =
  | { readonly allowed: true; readonly reason: "consent-not-active" }
  | { readonly allowed: false; readonly reason: "consent-protected" };

/**
 * The stateless consent gate: a retention class NEVER overrides an
 * active consent. `granted` refuses the pass (consent-protected);
 * unknown / denied / expired / withdrawn allow it (the consent no
 * longer protects the subject).
 */
export function retentionConsentDecision(consentState: ConsentState): RetentionConsentDecision {
  return isRetentionConsentProtected(consentState)
    ? { allowed: false, reason: "consent-protected" }
    : { allowed: true, reason: "consent-not-active" };
}
