// YOU RateLimitPolicy machinery (W10A — docs/you/CONTRACTS.md "Wave-10
// contract freeze (v10)": "RateLimitPolicy (scope/window/burst/action)"; the
// RATE LIMIT LAW: limits enforce BEFORE the effect; every enforcement
// appends an immutable record; throttling is never silent
// (YOU_RATE_LIMIT_EXCEEDED)).
//
// This module owns the STATELESS validators and gates (WORK_ORDERS.md W10A:
// "typed policies (scope/window/burst/action)"). Validation is pure: no
// clock, no rng, no store, no registry lookup — the service maps refusals
// to typed errors at its seam (policy intake refusals carry YOU_INVALID_STATE
// per the arena gap-intake precedent; every EXCEEDED gate decision carries
// the typed YOU_RATE_LIMIT_EXCEEDED — never silent, for deny/defer/shed
// alike; the defer class merely tells the caller the work is queueable).
//
// Window mechanics (fixture definition, deterministic): a fixed window of
// `windowS` seconds keyed by scope; the window state is
// { windowStart, used } and rolls at the first evaluation at or after
// windowStart + windowS. `now` is an explicit ISO-8601 argument (the
// service passes the injected clock's reading — no ambient time). Every
// ALLOWED decision consumes exactly one unit; refused requests consume
// nothing (fail-closed budgets never charge for refused work).
//
// The enforcement record itself is the append-only `rate-limit-enforced`
// ledger event (the frozen wave-10 event set has no separate enforcement
// record shape — per-record facts ride in event payloads per the W1A/W7A
// ride-along precedent; see platformLedger.ts for the payload contract).

import type { OpaqueId, RateLimitAction, RateLimitPolicy } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The three frozen actions (the contract's RateLimitAction verbatim). */
export const RATE_LIMIT_ACTIONS = ["deny", "defer", "shed"] as const;

const ACTION_SET: ReadonlySet<string> = new Set(RATE_LIMIT_ACTIONS);

/** Upper bound on windowS (one day keeps fixture windows sane). */
export const RATE_LIMIT_WINDOW_S_MAX = 86400;

/** Lower bound on windowS (a window of 0 could never admit anything). */
export const RATE_LIMIT_WINDOW_S_MIN = 1;

/** Lower bound on burst (at least one request per window). */
export const RATE_LIMIT_BURST_MIN = 1;

/** Upper bound on burst (fixture-scale budgets). */
export const RATE_LIMIT_BURST_MAX = 1000;

/**
 * The canonical service gate scopes (the enforcement-before-effect seams
 * the platform flows gate through). Scope format: two or more lowercase
 * `namespace:action` segments over [a-z0-9-].
 */
export const RATE_LIMIT_CANONICAL_SCOPES = [
  "import:scan",
  "import:admit",
  "import:release",
  "retention:enforce",
  "dr:restore",
] as const;

/** True when the value is one of the three frozen actions. */
export function isRateLimitAction(value: unknown): value is RateLimitAction {
  return typeof value === "string" && ACTION_SET.has(value);
}

/** True when the scope matches the canonical `namespace:action` format. */
export function isRateLimitScope(scope: unknown): scope is string {
  if (typeof scope !== "string" || scope.length === 0) {
    return false;
  }
  const segments = scope.split(":");
  if (segments.length < 2) {
    return false;
  }
  return segments.every((segment) => /^[a-z0-9-]+$/.test(segment));
}

/** Policy intake (the typed policy facts). */
export interface RateLimitPolicyInput {
  readonly scope: string;
  readonly windowS: number;
  readonly burst: number;
  readonly action: RateLimitAction;
}

/** A refusal returned by the stateless policy validator (never an exception). */
export interface RateLimitPolicyRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless policy validator (the single intake authority):
 *   1. scope must match the canonical namespace:action format;
 *   2. windowS must be an integer within [1, 86400];
 *   3. burst must be an integer within [1, 1000];
 *   4. action must be one of the three frozen actions.
 */
export function validateRateLimitPolicyInput(input: RateLimitPolicyInput): RateLimitPolicyRefusal | null {
  if (!isRateLimitScope(input.scope)) {
    return {
      reason: "scope-invalid",
      detail: "scope must be two or more lowercase namespace:action segments over [a-z0-9-]",
    };
  }
  if (!Number.isInteger(input.windowS) || input.windowS < RATE_LIMIT_WINDOW_S_MIN) {
    return {
      reason: "window-below-minimum",
      detail: `windowS must be an integer >= ${RATE_LIMIT_WINDOW_S_MIN}`,
    };
  }
  if (input.windowS > RATE_LIMIT_WINDOW_S_MAX) {
    return {
      reason: "window-above-maximum",
      detail: `windowS must not exceed ${RATE_LIMIT_WINDOW_S_MAX}`,
    };
  }
  if (!Number.isInteger(input.burst) || input.burst < RATE_LIMIT_BURST_MIN) {
    return {
      reason: "burst-below-minimum",
      detail: `burst must be an integer >= ${RATE_LIMIT_BURST_MIN}`,
    };
  }
  if (input.burst > RATE_LIMIT_BURST_MAX) {
    return {
      reason: "burst-above-maximum",
      detail: `burst must not exceed ${RATE_LIMIT_BURST_MAX}`,
    };
  }
  if (!isRateLimitAction(input.action)) {
    return {
      reason: "action-invalid",
      detail: `action must be one of: ${RATE_LIMIT_ACTIONS.join(", ")}`,
    };
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen policy. The id is opaque
 * (the injected id factory at the service seam).
 */
export function constructRateLimitPolicy(
  input: RateLimitPolicyInput,
  nextId: (kind: string) => OpaqueId,
): { readonly ok: true; readonly policy: RateLimitPolicy } | { readonly ok: false; readonly refusal: RateLimitPolicyRefusal } {
  const refusal = validateRateLimitPolicyInput(input);
  if (refusal !== null) {
    return { ok: false, refusal };
  }
  return {
    ok: true,
    policy: deepFreeze({
      id: nextId("rate-limit-policy"),
      scope: input.scope,
      windowS: input.windowS,
      burst: input.burst,
      action: input.action,
      simulated: true,
    }),
  };
}

/** The fixed-window counter state the service keeps per scope. */
export interface RateLimitWindowState {
  /** ISO-8601 window start (the clock reading at the window's first evaluation). */
  readonly windowStart: string;
  /** Units consumed by ALLOWED decisions in the current window. */
  readonly used: number;
}

/**
 * The stateless window/burst gate decision (the RATE LIMIT LAW's teeth).
 * Check order is fixed so the reason is deterministic:
 *   1. window roll — at/after windowStart + windowS the window resets
 *      (used 0, windowStart = now, rolled = true);
 *   2. burst — used < burst allows (consuming exactly one unit),
 *      otherwise the budget is exhausted (the enforcement outcome).
 */
export interface RateLimitDecision {
  /** True when the request may proceed to its effect. */
  readonly allowed: boolean;
  /** "within-burst" on allow; "burst-exhausted" on refusal. */
  readonly reason: "within-burst" | "burst-exhausted";
  /** The effective window start after this decision. */
  readonly windowStart: string;
  /** The usage count after this decision (allowed consumed one unit). */
  readonly used: number;
  /** True when this evaluation rolled the window. */
  readonly rolled: boolean;
}

/**
 * Evaluates the fixed-window gate for one request at `now` (ISO-8601).
 * Pure: the caller (the service) stores the returned window facts; the
 * same (policy, window, now) triple always yields the same decision.
 */
export function evaluateRateLimitWindow(
  policy: RateLimitPolicy,
  now: string,
  window: RateLimitWindowState | null,
): RateLimitDecision {
  const nowMs = Date.parse(now);
  let windowStart = window?.windowStart ?? now;
  let used = window?.used ?? 0;
  let rolled = window === null;
  if (window !== null) {
    const elapsedMs = nowMs - Date.parse(window.windowStart);
    if (elapsedMs >= policy.windowS * 1000) {
      windowStart = now;
      used = 0;
      rolled = true;
    }
  }
  if (used < policy.burst) {
    return { allowed: true, reason: "within-burst", windowStart, used: used + 1, rolled };
  }
  return { allowed: false, reason: "burst-exhausted", windowStart, used, rolled };
}

/** Sorts policies deterministically by their canonical key (stable ordering). */
export function canonicalPolicyKey(policy: RateLimitPolicy): string {
  return [policy.scope, policy.windowS, policy.burst, policy.action].join("::");
}
