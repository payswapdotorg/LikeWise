// YOU ArenaRetryPolicy machinery (W8A — docs/you/CONTRACTS.md "Wave-8
// contract freeze (v8)": "ArenaRetryPolicy (deterministic retry ladder
// configuration)"; the retry authority over the ArenaRun ladder).
//
// This module owns the STATELESS validators and gates (WORK_ORDERS.md W8A:
// "ArenaRetryPolicy validation: stateless validators (attempt bounds,
// backoff class format, eligibility category gates, requires-authorization
// flag); typed YOU_RETRY_POLICY_INVALID"). Validation is pure: no clock,
// no rng, no store, no registry lookup — the service maps refusals to
// typed YOU_RETRY_POLICY_INVALID / YOU_ESCALATION_AUTHORIZATION_REQUIRED
// errors at its seam.
//
// The requiresAuthorization flag composes with the ESCALATION
// AUTHORIZATION LAW (docs/you/CONTRACTS.md wave-8): an escalation NEVER
// runs without an explicit, in-scope, unexpired EscalationAuthorization.
// A policy with requiresAuthorization: true declares the gate and the
// service refuses unauthorized escalation paths with
// YOU_ESCALATION_AUTHORIZATION_REQUIRED; a policy with false cannot waive
// the law (escalation start remains gated unconditionally — the law
// outranks the policy flag).

import type { ArenaRetryPolicy, CapabilityGapCategory, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";
import { ARENA_RUN_GAP_CATEGORIES } from "./arenaRunLadder.js";

/**
 * The sanctioned backoff classes (the frozen W8A "backoff class format"):
 * lowercase tokens over [a-z0-9-]. The list is the fixture contract — a
 * policy backoffClass outside the set is a typed intake refusal.
 */
export const ARENA_BACKOFF_CLASSES = ["none", "fixed", "linear", "exponential"] as const;

export type ArenaBackoffClass = (typeof ARENA_BACKOFF_CLASSES)[number];

const BACKOFF_SET: ReadonlySet<string> = new Set(ARENA_BACKOFF_CLASSES);
const CATEGORY_SET: ReadonlySet<string> = new Set(ARENA_RUN_GAP_CATEGORIES);

/** Upper bound on maxAttempts (the deterministic ladder stays small). */
export const ARENA_RETRY_MAX_ATTEMPTS_LIMIT = 16;

/** Lower bound on maxAttempts (at least one attempt must be sanctioned). */
export const ARENA_RETRY_MIN_ATTEMPTS = 1;

/** True when the value is one of the sanctioned backoff classes. */
export function isArenaBackoffClass(value: unknown): value is ArenaBackoffClass {
  return typeof value === "string" && BACKOFF_SET.has(value);
}

/** Policy intake (the retry-ladder configuration facts). */
export interface ArenaRetryPolicyInput {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly eligibilityCategories: readonly CapabilityGapCategory[];
  readonly requiresAuthorization: boolean;
}

/** A refusal returned by the stateless policy validator (never an exception). */
export interface ArenaRetryPolicyRefusal {
  /** Stable reason string (rides along in typed YOU_RETRY_POLICY_INVALID details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless retry-policy validator (the single intake authority):
 *   1. maxAttempts must be an integer within [1, 16] (attempt bounds);
 *   2. backoffClass must be one of the sanctioned classes (format gate);
 *   3. eligibilityCategories must be sanctioned, unique and non-empty
 *      (eligibility category gates);
 *   4. requiresAuthorization must be an actual boolean (flag gate).
 */
export function validateArenaRetryPolicyInput(input: ArenaRetryPolicyInput): ArenaRetryPolicyRefusal | null {
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < ARENA_RETRY_MIN_ATTEMPTS) {
    return {
      reason: "max-attempts-below-minimum",
      detail: `maxAttempts must be an integer >= ${ARENA_RETRY_MIN_ATTEMPTS}`,
    };
  }
  if (input.maxAttempts > ARENA_RETRY_MAX_ATTEMPTS_LIMIT) {
    return {
      reason: "max-attempts-above-limit",
      detail: `maxAttempts must not exceed ${ARENA_RETRY_MAX_ATTEMPTS_LIMIT}`,
    };
  }
  if (!isArenaBackoffClass(input.backoffClass)) {
    return {
      reason: "backoff-class-invalid",
      detail: `backoffClass must be one of: ${ARENA_BACKOFF_CLASSES.join(", ")}`,
    };
  }
  if (!Array.isArray(input.eligibilityCategories) || input.eligibilityCategories.length === 0) {
    return {
      reason: "eligibility-empty",
      detail: "eligibilityCategories must list at least one capability-gap category",
    };
  }
  const seen = new Set<string>();
  for (const category of input.eligibilityCategories) {
    if (typeof category !== "string" || !CATEGORY_SET.has(category)) {
      return {
        reason: "eligibility-category-invalid",
        detail: `eligibility category "${String(category)}" is not one of the seven v1 categories`,
      };
    }
    if (seen.has(category)) {
      return { reason: "eligibility-duplicate", detail: `duplicate eligibility category "${category}"` };
    }
    seen.add(category);
  }
  if (typeof input.requiresAuthorization !== "boolean") {
    return {
      reason: "requires-authorization-invalid",
      detail: "requiresAuthorization must be a boolean",
    };
  }
  return null;
}

/** Constructs the immutable, deep-frozen policy (canonical category order). */
export function constructArenaRetryPolicy(input: ArenaRetryPolicyInput): { readonly ok: true; readonly policy: ArenaRetryPolicy } | { readonly ok: false; readonly refusal: ArenaRetryPolicyRefusal } {
  const refusal = validateArenaRetryPolicyInput(input);
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  return {
    ok: true,
    policy: deepFreeze({
      maxAttempts: input.maxAttempts,
      backoffClass: input.backoffClass,
      eligibilityCategories: Object.freeze([...input.eligibilityCategories].sort()),
      requiresAuthorization: input.requiresAuthorization,
    }),
  };
}

/** The typed retry-gate decision with a machine-readable reason. */
export type ArenaRetryGateDecision =
  | { readonly allowed: true; readonly reason: "run-within-policy" }
  | { readonly allowed: false; readonly reason: string };

/**
 * The stateless run gate: may attempt number `attempt` against a gap of
 * `category` start under this policy? Checks the eligibility category
 * gate, then the attempt bounds. The check order is fixed so the refusal
 * reason is deterministic.
 */
export function evaluateArenaRetryGate(
  policy: ArenaRetryPolicy,
  attempt: number,
  category: CapabilityGapCategory,
): ArenaRetryGateDecision {
  if (!policy.eligibilityCategories.includes(category)) {
    return { allowed: false, reason: "category-not-eligible" };
  }
  if (!Number.isInteger(attempt) || attempt < ARENA_RETRY_MIN_ATTEMPTS) {
    return { allowed: false, reason: "attempt-below-minimum" };
  }
  if (attempt > policy.maxAttempts) {
    return { allowed: false, reason: "attempt-exceeds-max" };
  }
  return { allowed: true, reason: "run-within-policy" };
}

/**
 * The stateless escalation-path gate (the requiresAuthorization flag's
 * teeth): when the policy requires authorization and no authorization id
 * is present on the escalation path, the gate refuses — the service maps
 * this to YOU_ESCALATION_AUTHORIZATION_REQUIRED. When the policy does not
 * require it, the gate allows the REQUEST path (the law still gates the
 * escalation start itself — see escalationAuthorization.ts).
 */
export function policyRequiresAuthorizationOnPath(
  policy: ArenaRetryPolicy,
  authorizationId: OpaqueId | null,
): boolean {
  return policy.requiresAuthorization && (authorizationId === null || authorizationId.length === 0);
}

/** Sorts policies deterministically by their canonical serialization (stable ordering). */
export function canonicalPolicyKey(policy: ArenaRetryPolicy): string {
  return [policy.maxAttempts, policy.backoffClass, [...policy.eligibilityCategories].sort().join("|"), policy.requiresAuthorization ? "1" : "0"].join("::");
}
