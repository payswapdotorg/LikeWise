// Cost/latency budget guards — the W10C budget plane (fail-closed).
//
// BUDGET LAW (docs/you/CONTRACTS.md "Wave-10 contract freeze (v10)"): cost
// and latency budgets enforce BEFORE the effect; every enforcement appends
// an immutable decision record; an exhausted budget is never a silent stop
// (a typed refusal). The breaker classes carried forward from W8C
// (circuit-breaker / hedged-request / exponential-backoff-jitter /
// token-bucket — NEUTRAL_BACKOFF_CLASSES) name the researched guard class
// of each budget descriptor.
//
// The neutral CostLatencyBudget shape is owned by you-lab and is
// structurally aligned 1:1 with the frozen v10 CostLatencyBudget (id,
// scope, costBudget, latencyBudgetS, breakerClass, simulated); mapping
// onto the frozen contract happens ONLY in src/contractSeam.ts.
//
// Typed errors: budget exhaustion is a you-lab-owned typed code —
// YOU_BUDGET_EXCEEDED — because the frozen v10 error union carries no
// ecosystem-lane budget literal (YOU_RATE_LIMIT_EXCEEDED belongs to the
// W10A platform rate-limit authority; this module never masquerades as
// it). Descriptor malformation is YOU_BUDGET_DESCRIPTOR_INVALID (the W9C
// you-lab-owned-code precedent: PIPELINE_GENOME/FAILURE_ATLAS).
//
// HONEST MODEL: budget units are authored fixture accounting (declared
// cost units / declared seconds supplied by the caller), not wall-clock
// and not money. Determinism: enforcement arithmetic is a pure function
// of (budget, declaredCost, declaredLatency) — no clock, no Math.random,
// no network. Effort/latency/cost fields on outputs carry explicit
// not-measured markers (truth law — never invented numbers).

import { roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import { NEUTRAL_BACKOFF_CLASSES, sha256Hex, type NeutralArenaBackoffClass } from "../arena/arenaAdapterSeam.js";

/** You-lab-owned typed error code for budget exhaustion (no frozen v10 literal — disclosed above). */
export const BUDGET_EXCEEDED_CODE = "YOU_BUDGET_EXCEEDED";

/** You-lab-owned typed error code for a malformed budget descriptor. */
export const BUDGET_DESCRIPTOR_INVALID_CODE = "YOU_BUDGET_DESCRIPTOR_INVALID";

/** Typed refusal thrown when a declared spend exceeds the budget (fail-closed, never silent). */
export class BudgetExceededError extends Error {
  readonly code = BUDGET_EXCEEDED_CODE;
  constructor(detail: string) {
    super(`${BUDGET_EXCEEDED_CODE}: ${detail}`);
  }
}

/** Typed refusal thrown when a budget descriptor is malformed. */
export class BudgetDescriptorInvalidError extends Error {
  readonly code = BUDGET_DESCRIPTOR_INVALID_CODE;
  constructor(detail: string) {
    super(`${BUDGET_DESCRIPTOR_INVALID_CODE}: ${detail}`);
  }
}

/**
 * Neutral cost/latency budget descriptor — aligned 1:1 with the frozen v10
 * CostLatencyBudget. Immutable by construction: guards are described, never
 * mutated in place.
 */
export interface NeutralCostLatencyBudget {
  readonly id: string;
  readonly scope: string;
  readonly costBudget: number;
  readonly latencyBudgetS: number;
  /** The researched breaker class (one of the four W8C classes carried forward). */
  readonly breakerClass: NeutralArenaBackoffClass;
  readonly simulated: boolean;
}

/**
 * The immutable budget-guard decision appended for one enforcement pass
 * (BUDGET LAW: every enforcement appends an immutable record; the record is
 * a projection of the guard, never mutated).
 */
export interface BudgetGuardDecision {
  readonly id: string;
  readonly budgetId: string;
  readonly requestId: string;
  readonly scope: string;
  readonly allowed: boolean;
  readonly costUtilization: number;
  readonly latencyUtilization: number;
  readonly breakerClass: NeutralArenaBackoffClass;
  readonly enforcedAt: string;
  readonly simulated: boolean;
}

/** The context one enforcement pass threads (request identity + clock-free timestamp). */
export interface BudgetEnforcementContext {
  readonly requestId: string;
  readonly scope: string;
  readonly submittedAt: string;
}

/** Opaque deterministic budget id for (scope, breakerClass) — you_budget_<16hex>. */
export function budgetGuardId(scope: string, breakerClass: NeutralArenaBackoffClass): string {
  return `you_budget_${sha256Hex(`${scope}|${breakerClass}`).slice(0, 16)}`;
}

/** Opaque deterministic decision id for (budgetId, requestId) — you_budget-decision_<16hex>. */
export function budgetDecisionId(budgetId: string, requestId: string): string {
  return `you_budget-decision_${sha256Hex(`${budgetId}|${requestId}`).slice(0, 16)}`;
}

/**
 * Validate a budget descriptor (fail-closed): non-empty id/scope, finite
 * positive budgets, a breaker class inside the four W8C classes, and the
 * truth-law simulated marker. Throws YOU_BUDGET_DESCRIPTOR_INVALID.
 */
export function assertValidCostLatencyBudget(budget: NeutralCostLatencyBudget): void {
  if (budget.id.length === 0) throw new BudgetDescriptorInvalidError("empty budget id");
  if (budget.scope.length === 0) throw new BudgetDescriptorInvalidError("empty scope (a budget names its scope)");
  if (typeof budget.costBudget !== "number" || !Number.isFinite(budget.costBudget) || budget.costBudget <= 0) {
    throw new BudgetDescriptorInvalidError(`costBudget ${budget.costBudget} must be a finite number > 0`);
  }
  if (typeof budget.latencyBudgetS !== "number" || !Number.isFinite(budget.latencyBudgetS) || budget.latencyBudgetS <= 0) {
    throw new BudgetDescriptorInvalidError(`latencyBudgetS ${budget.latencyBudgetS} must be a finite number > 0`);
  }
  if (!NEUTRAL_BACKOFF_CLASSES.includes(budget.breakerClass as (typeof NEUTRAL_BACKOFF_CLASSES)[number])) {
    throw new BudgetDescriptorInvalidError(
      `breakerClass '${budget.breakerClass}' is outside the researched W8C breaker vocabulary (circuit-breaker/hedged-request/exponential-backoff-jitter/token-bucket)`,
    );
  }
  if (budget.simulated !== true) {
    throw new BudgetDescriptorInvalidError("budget descriptors stay simulated: true (the W10+ compute-plane boundary — a real budget would be measured)");
  }
}

/**
 * Enforce a cost/latency budget BEFORE the effect (BUDGET LAW): the
 * declared cost/latency are checked against the descriptor fail-closed and
 * the pass appends an immutable decision record. Over-budget requests are
 * a typed YOU_BUDGET_EXCEEDED refusal — throttling is never silent. Pure
 * deterministic arithmetic: utilization ratios are rounded to 4 decimals.
 */
export function enforceCostLatencyBudget(
  budget: NeutralCostLatencyBudget,
  declaredCostUnits: number,
  declaredLatencyS: number,
  context: BudgetEnforcementContext,
): BudgetGuardDecision {
  assertValidCostLatencyBudget(budget);
  if (context.requestId.length === 0) {
    throw new BudgetDescriptorInvalidError("empty requestId on the enforcement context (a decision threads its request)");
  }
  if (typeof declaredCostUnits !== "number" || !Number.isFinite(declaredCostUnits) || declaredCostUnits < 0) {
    throw new BudgetDescriptorInvalidError(`declaredCostUnits ${declaredCostUnits} must be a finite number >= 0`);
  }
  if (typeof declaredLatencyS !== "number" || !Number.isFinite(declaredLatencyS) || declaredLatencyS < 0) {
    throw new BudgetDescriptorInvalidError(`declaredLatencyS ${declaredLatencyS} must be a finite number >= 0`);
  }
  const costUtilization = roundTo(declaredCostUnits / budget.costBudget, 4);
  const latencyUtilization = roundTo(declaredLatencyS / budget.latencyBudgetS, 4);
  const allowed = declaredCostUnits <= budget.costBudget && declaredLatencyS <= budget.latencyBudgetS;
  if (!allowed) {
    throw new BudgetExceededError(
      `request '${context.requestId}' under budget '${budget.id}' (scope '${budget.scope}', breaker class '${budget.breakerClass}') declares cost ${declaredCostUnits}/${budget.costBudget} units and latency ${declaredLatencyS}/${budget.latencyBudgetS}s — the guard enforces BEFORE the effect (fail-closed, never silent)`,
    );
  }
  return {
    id: budgetDecisionId(budget.id, context.requestId),
    budgetId: budget.id,
    requestId: context.requestId,
    scope: context.scope.length === 0 ? budget.scope : context.scope,
    allowed: true,
    costUtilization,
    latencyUtilization,
    breakerClass: budget.breakerClass,
    enforcedAt: context.submittedAt,
    simulated: true,
  };
}

/**
 * Pure (non-throwing) evaluation of a budget pass — the record shape an
 * honest harness records when it must OBSERVE an over-budget request
 * without enforcing (the benchmark's negative-control path); the enforcing
 * entry point is enforceCostLatencyBudget above.
 */
export function evaluateCostLatencyBudget(
  budget: NeutralCostLatencyBudget,
  declaredCostUnits: number,
  declaredLatencyS: number,
  context: BudgetEnforcementContext,
): BudgetGuardDecision {
  assertValidCostLatencyBudget(budget);
  const costUtilization = roundTo(declaredCostUnits / budget.costBudget, 4);
  const latencyUtilization = roundTo(declaredLatencyS / budget.latencyBudgetS, 4);
  const allowed = declaredCostUnits <= budget.costBudget && declaredLatencyS <= budget.latencyBudgetS;
  return {
    id: budgetDecisionId(budget.id, context.requestId),
    budgetId: budget.id,
    requestId: context.requestId,
    scope: context.scope.length === 0 ? budget.scope : context.scope,
    allowed,
    costUtilization,
    latencyUtilization,
    breakerClass: budget.breakerClass,
    enforcedAt: context.submittedAt,
    simulated: true,
  };
}

/**
 * Canonical seeded budget headroom multiplier for (scope, breakerClass) —
 * hash-derived, class-dependent, rounded to 4 decimals (the W8C class-band
 * precedent applied to budget headroom; computed, never measured).
 */
export function intendedBudgetHeadroomAt(scope: string, breakerClass: NeutralArenaBackoffClass): number {
  const base = unitFrom("you-lab-budget-guard", scope, breakerClass, "headroom");
  switch (breakerClass) {
    case "exponential-backoff-jitter":
      return roundTo(0.8 + base * 0.2, 4);
    case "hedged-request":
      return roundTo(0.75 + base * 0.25, 4);
    case "circuit-breaker":
      return roundTo(0.7 + base * 0.3, 4);
    case "token-bucket":
      return roundTo(0.6 + base * 0.4, 4);
    default:
      throw new BudgetDescriptorInvalidError(
        `intendedBudgetHeadroomAt: no authored headroom band for breaker class "${breakerClass}" (the four W8C classes only)`,
      );
  }
}

/** Digest label for the neutral budget-guard seam (honest provenance wiring). */
export function budgetGuardSeamVersion(): string {
  return "you-lab-budget-guard-seam/1 (deterministic fixture accounting — computed, not measured)";
}
