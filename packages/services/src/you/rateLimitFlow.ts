// YOU platform service — rate-limit policy registration + the
// enforcement gate flow (W10A). The ops live here; platformService.ts is
// the single authority that dispatches into them (the W1A/W8A flow
// precedent).
//
// THE RATE LIMIT LAW (docs/you/CONTRACTS.md wave-10): limits enforce
// BEFORE the effect; every enforcement appends an immutable record;
// throttling is never silent (YOU_RATE_LIMIT_EXCEEDED).
//
// Enforcement-before-effect holds by construction: `gateRateLimitOp` is
// the pure gate every effect op calls FIRST (scanImport / admitImport /
// releaseQuarantinedImport / enforceRetention / restoreSnapshot all gate
// through their canonical scope before any effect runs — an exceeded
// budget returns the typed error and the effect NEVER executes). The
// gate appends one `rate-limit-enforced` event per evaluation (the
// immutable enforcement record — allowed and exceeded alike; the fold
// reconstructs the per-scope usage heads, making the ledger
// authoritative for the limiter state). A scope without a registered
// policy is unlimited (no enforcement happens, no record is written —
// there is nothing to enforce; the policy registry is service state per
// the W6A/W8A candidate-record precedent).
//
// The never-silent law: an exceeded budget returns the typed
// YOU_RATE_LIMIT_EXCEEDED for ALL three action classes — deny
// (fail-closed refusal), defer (queueable; the refusal still surfaces
// so the caller knows the work was NOT performed), shed (load shed;
// likewise surfaced). The action rides in the error details.

import type { OpaqueId, RateLimitPolicy } from "@zcode/shared";
import {
  constructRateLimitPolicy,
  evaluateRateLimitWindow,
  type RateLimitPolicyInput,
} from "../../../shared/src/you/rateLimitPolicy.js";
import { appendRateLimitEnforced } from "./platformLedgerOps.js";
import {
  activePolicyForScope,
  platformFailure,
  type PlatformFlowDeps,
  type PlatformPlaneRecord,
  type PlatformServiceResult,
} from "./platformServiceTypes.js";

/** The enforcement facts of a gated decision (the audit-facing readout). */
export interface RateLimitGateFacts {
  readonly policyId: OpaqueId;
  readonly scope: string;
  readonly action: RateLimitPolicy["action"];
  readonly outcome: "allowed" | "exceeded";
  readonly reason: string;
  readonly subject: OpaqueId;
  readonly windowStart: string;
  readonly used: number;
  readonly burst: number;
  readonly windowS: number;
}

/** The gate outcome: unlimited scopes carry no enforcement facts (nothing to enforce). */
export type RateLimitGateOutcome = { readonly unlimited: true; readonly scope: string; readonly subject: OpaqueId } | ({ readonly unlimited: false } & RateLimitGateFacts);

/**
 * Registers a rate-limit policy for a scope (the head becomes active;
// earlier registrations project as superseded service state — append-only
 * registry, never an in-place mutation). Refusals: typed YOU_INVALID_STATE
 * for intake shape (the arena gap-intake precedent).
 */
export function registerRateLimitPolicyOp(
  plane: PlatformPlaneRecord,
  input: RateLimitPolicyInput,
  nextId: (kind: string) => OpaqueId,
): PlatformServiceResult<{ readonly policy: RateLimitPolicy }> {
  const constructed = constructRateLimitPolicy(input, nextId);
  if (!constructed.ok) {
    return platformFailure("YOU_INVALID_STATE", `rate limit policy refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      scope: input.scope,
    });
  }
  const chain = plane.policies.get(constructed.policy.scope) ?? [];
  chain.push(constructed.policy);
  plane.policies.set(constructed.policy.scope, chain);
  return { ok: true, value: { policy: constructed.policy } };
}

/**
 * THE GATE: evaluates the active policy for a scope at the injected
 * clock's reading, records the enforcement, and returns the decision.
 * Allowed -> ok (the caller may proceed to its effect). Exceeded ->
 * typed YOU_RATE_LIMIT_EXCEEDED (never silent; the action and window
 * facts ride the details). No policy for the scope -> unlimited (ok,
 * no record — nothing to enforce).
 */
export function gateRateLimitOp(
  plane: PlatformPlaneRecord,
  deps: PlatformFlowDeps,
  scope: string,
  subject: OpaqueId,
): PlatformServiceResult<RateLimitGateOutcome> {
  const policy = activePolicyForScope(plane, scope);
  if (policy === null) {
    return { ok: true, value: { unlimited: true, scope, subject } };
  }
  const now = deps.clock.now();
  const previous = plane.rateLimitUsage.get(scope) ?? null;
  const decision = evaluateRateLimitWindow(policy, now, previous);
  plane.rateLimitUsage.set(scope, { windowStart: decision.windowStart, used: decision.used });
  const facts: RateLimitGateFacts = {
    policyId: policy.id,
    scope,
    action: policy.action,
    outcome: decision.allowed ? "allowed" : "exceeded",
    reason: decision.reason,
    subject,
    windowStart: decision.windowStart,
    used: decision.used,
    burst: policy.burst,
    windowS: policy.windowS,
  };
  const enforcementId = deps.ids.next("rate-limit-enforcement");
  appendRateLimitEnforced(plane, enforcementId, { ...facts, checkedAt: now });
  if (!decision.allowed) {
    return platformFailure("YOU_RATE_LIMIT_EXCEEDED", `rate limit exceeded for scope ${scope} (${policy.action})`, {
      reason: decision.reason,
      scope,
      action: policy.action,
      policyId: policy.id,
      subject,
      used: decision.used,
      burst: policy.burst,
      windowS: policy.windowS,
      windowStart: decision.windowStart,
    });
  }
  return { ok: true, value: { unlimited: false, ...facts } };
}
