// YOU ThreatModelEntry machinery (W11A — docs/you/CONTRACTS.md
// "Wave-11 contract freeze (v11)": "ThreatModelEntry"; the honesty law:
// residual risk is stated honestly on every entry, never zeroed by
// assertion (typed YOU_SECURITY_REVIEW_INVALID at the service seam — the
// wave-11 code set routes threat-model refusals through the security
// review code, the frozen set has no threat-specific code).
//
// This module owns the STATELESS validators and the immutable-entry
// constructor (WORK_ORDERS.md W11A: "ThreatModelEntry persistence:
// immutable entries (threatClass, vector, mitigationRef, residual stated
// honestly — never zeroed by assertion)"). Validation is pure: no clock,
// no rng, no store, no registry lookup — the service maps refusals to
// typed YOU_SECURITY_REVIEW_INVALID errors at its seam.
//
// The honesty teeth live in constructThreatModelEntry: an entry can NEVER
// exist without a stated residual (refusal "residual-missing" — there is
// no code path that could zero it by assertion; the residual is a
// mandatory non-empty statement even when the threat is unmitigated
// (mitigationRef null — recorded honestly, never fabricated into a
// mitigation ref)). Threat classes are the sanctioned fixture set below
// (mirroring docs/you/SECURITY.md surfaces — the IMPORT_SCAN_CLASSES
// precedent: fail-closed on unknown classes).
//
// Threat-model entries are pre-review SERVICE STATE (the rate-limit
// policy precedent — the frozen wave-11 event set has no threat-model
// event; entries materialize in the ledger only through their review
// facts) and therefore do not appear in the security fold.

import type { OpaqueId, ThreatModelEntry } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/**
 * The sanctioned threat classes (the frozen fixture contract, mirroring
 * docs/you/SECURITY.md surfaces: data classes, consent, liveness, export,
 * editor, arena, api, deepfake abuse, reliability gates).
 */
export const THREAT_CLASSES = [
  "data-class-leakage",
  "consent-bypass",
  "liveness-spoof",
  "export-leak",
  "editor-escape",
  "arena-context-overreach",
  "api-abuse",
  "deepfake-impersonation",
  "provider-failure",
] as const;

export type ThreatClass = (typeof THREAT_CLASSES)[number];

const THREAT_CLASS_SET: ReadonlySet<string> = new Set(THREAT_CLASSES);

/** True when the value is one of the sanctioned threat classes. */
export function isThreatClass(value: unknown): value is ThreatClass {
  return typeof value === "string" && THREAT_CLASS_SET.has(value);
}

/** Threat-model intake (the entry facts). */
export interface ThreatModelInput {
  readonly threatClass: string;
  /** The concrete attack vector (verbatim, non-empty). */
  readonly vector: string;
  /** The mitigation record this entry is mitigated by; null = unmitigated (honest). */
  readonly mitigationRef: OpaqueId | null;
  /** The residual risk statement — MANDATORY and never zeroed by assertion. */
  readonly residual: string;
}

/** A refusal returned by the stateless validators (never an exception). */
export interface ThreatModelRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless threat-model intake validator (the single intake
 * authority): threatClass one of the sanctioned classes, vector a
 * non-empty statement, mitigationRef null or a non-empty opaque id
 * (never a fabricated ref), residual a non-empty statement (the honesty
 * law — an entry without a stated residual cannot exist).
 */
export function validateThreatModelInput(input: ThreatModelInput): ThreatModelRefusal | null {
  if (!isThreatClass(input.threatClass)) {
    return {
      reason: "threat-class-invalid",
      detail: `threatClass must be one of: ${THREAT_CLASSES.join(", ")}`,
    };
  }
  if (typeof input.vector !== "string" || input.vector.trim().length === 0) {
    return { reason: "vector-empty", detail: "vector must be a non-empty attack-vector statement" };
  }
  if (input.mitigationRef !== null && (typeof input.mitigationRef !== "string" || input.mitigationRef.length === 0)) {
    return {
      reason: "mitigation-ref-invalid",
      detail: "mitigationRef must be null (unmitigated, honest) or a non-empty opaque id",
    };
  }
  if (typeof input.residual !== "string" || input.residual.trim().length === 0) {
    return {
      reason: "residual-missing",
      detail: "residual risk must be stated honestly on every entry (never zeroed by assertion)",
    };
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen threat-model entry. The honesty
 * law's teeth: intake refuses a missing residual statement, and the
 * unmitigated case records mitigationRef null with the residual still
 * stated — never a zeroed or fabricated residual.
 */
export function constructThreatModelEntry(
  input: ThreatModelInput & { readonly id: OpaqueId },
): { readonly ok: true; readonly entry: ThreatModelEntry } | { readonly ok: false; readonly refusal: ThreatModelRefusal } {
  const refusal = validateThreatModelInput(input);
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  return {
    ok: true,
    entry: deepFreeze({
      id: input.id,
      threatClass: input.threatClass,
      vector: input.vector,
      mitigationRef: input.mitigationRef,
      residual: input.residual,
      simulated: true,
    }),
  };
}
