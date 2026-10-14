// Cost/latency budget guard tests (W10C) — coverage: the budget
// descriptors carry the four W8C breaker classes carried forward,
// enforcement is deterministic (byte-identical decisions from the same
// inputs), over-budget requests are typed YOU_BUDGET_EXCEEDED refusals
// (fail-closed, never silent — the BUDGET LAW), malformed descriptors are
// typed YOU_BUDGET_DESCRIPTOR_INVALID refusals, and the class-dependent
// headroom bands derive deterministically.
import assert from "node:assert/strict";
import test from "node:test";
import { NEUTRAL_BACKOFF_CLASSES } from "../arena/arenaAdapterSeam.js";
import {
  BUDGET_DESCRIPTOR_INVALID_CODE,
  BUDGET_EXCEEDED_CODE,
  BudgetDescriptorInvalidError,
  BudgetExceededError,
  assertValidCostLatencyBudget,
  budgetDecisionId,
  budgetGuardId,
  budgetGuardSeamVersion,
  enforceCostLatencyBudget,
  evaluateCostLatencyBudget,
  intendedBudgetHeadroomAt,
  type NeutralCostLatencyBudget,
} from "./budgetGuardSeam.js";

function budgetFixture(overrides: Partial<NeutralCostLatencyBudget> = {}): NeutralCostLatencyBudget {
  const scope = "test-budget-scope";
  return {
    id: budgetGuardId(scope, "exponential-backoff-jitter"),
    scope,
    costBudget: 100,
    latencyBudgetS: 10,
    breakerClass: "exponential-backoff-jitter",
    simulated: true,
    ...overrides,
  };
}

const CONTEXT = { requestId: "budget-test-req-1", scope: "test-budget-scope", submittedAt: "2026-10-14T12:00:00Z" };

test("budget guard: descriptor validation is fail-closed on malformation", () => {
  assertValidCostLatencyBudget(budgetFixture());
  const cases: readonly [NeutralCostLatencyBudget, RegExp][] = [
    [budgetFixture({ id: "" }), /empty budget id/],
    [budgetFixture({ scope: "" }), /empty scope/],
    [budgetFixture({ costBudget: 0 }), /costBudget 0 must be a finite number > 0/],
    [budgetFixture({ costBudget: Number.POSITIVE_INFINITY }), /costBudget/],
    [budgetFixture({ costBudget: -5 }), /costBudget -5 must be a finite number > 0/],
    [budgetFixture({ latencyBudgetS: 0 }), /latencyBudgetS 0 must be a finite number > 0/],
    [budgetFixture({ latencyBudgetS: Number.NaN }), /latencyBudgetS/],
    [budgetFixture({ breakerClass: "linear-backoff" as never }), /outside the researched W8C breaker vocabulary/],
    [budgetFixture({ breakerClass: "" as never }), /outside the researched W8C breaker vocabulary/],
    [budgetFixture({ simulated: false }), /stay simulated: true/],
  ];
  for (const [budget, pattern] of cases) {
    assert.throws(
      () => assertValidCostLatencyBudget(budget),
      (error: unknown) => error instanceof BudgetDescriptorInvalidError && error.code === BUDGET_DESCRIPTOR_INVALID_CODE && pattern.test(error.message),
      `expected descriptor refusal for ${JSON.stringify({ ...budget })}`,
    );
  }
});

test("budget guard: the breaker classes carried forward from W8C are exactly the four-class table", () => {
  for (const breakerClass of NEUTRAL_BACKOFF_CLASSES) {
    const budget = budgetFixture({ breakerClass, id: budgetGuardId("test-budget-scope", breakerClass) });
    assertValidCostLatencyBudget(budget);
    assert.equal(budget.id, budgetGuardId(budget.scope, breakerClass));
  }
  assert.equal(NEUTRAL_BACKOFF_CLASSES.length, 4);
  assert.deepEqual([...NEUTRAL_BACKOFF_CLASSES], ["circuit-breaker", "hedged-request", "exponential-backoff-jitter", "token-bucket"]);
});

test("budget guard: enforcement is deterministic — byte-identical decisions from the same inputs", () => {
  const first = enforceCostLatencyBudget(budgetFixture(), 40, 4, CONTEXT);
  const second = enforceCostLatencyBudget(budgetFixture(), 40, 4, CONTEXT);
  assert.deepEqual(first, second);
  assert.equal(first.allowed, true);
  assert.equal(first.simulated, true);
  assert.equal(first.breakerClass, "exponential-backoff-jitter");
  assert.equal(first.costUtilization, 0.4);
  assert.equal(first.latencyUtilization, 0.4);
  assert.equal(first.id, budgetDecisionId(first.budgetId, CONTEXT.requestId));
  assert.match(first.id, /^you_budget-decision_[0-9a-f]{16}$/);
  // utilization arithmetic is rounded to 4 decimals
  const odd = enforceCostLatencyBudget(budgetFixture(), 33.33333, 3.33333, CONTEXT);
  assert.equal(odd.costUtilization, 0.3333);
  assert.equal(odd.latencyUtilization, 0.3333);
  // a different request id derives a different decision id
  const other = enforceCostLatencyBudget(budgetFixture(), 40, 4, { ...CONTEXT, requestId: "budget-test-req-2" });
  assert.notEqual(other.id, first.id);
});

test("budget guard: over-budget requests are typed refusals — never silent (the BUDGET LAW)", () => {
  const costOver = budgetFixture();
  assert.throws(
    () => enforceCostLatencyBudget(costOver, 101, 5, CONTEXT),
    (error: unknown) => error instanceof BudgetExceededError &&
      error.code === BUDGET_EXCEEDED_CODE &&
      /cost 101\/100 units and latency 5\/10s/.test(error.message) &&
      /enforces BEFORE the effect/.test(error.message),
  );
  const latencyOver = budgetFixture();
  assert.throws(
    () => enforceCostLatencyBudget(latencyOver, 50, 10.5, CONTEXT),
    /latency 10\.5\/10s/,
  );
  // exactly-at-budget passes (the envelope is inclusive)
  const atLimit = enforceCostLatencyBudget(budgetFixture(), 100, 10, CONTEXT);
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.costUtilization, 1);
  assert.equal(atLimit.latencyUtilization, 1);
  // malformed declared spend refuses too
  assert.throws(() => enforceCostLatencyBudget(budgetFixture(), -1, 5, CONTEXT), /declaredCostUnits -1 must be a finite number >= 0/);
  assert.throws(() => enforceCostLatencyBudget(budgetFixture(), 5, Number.NaN, CONTEXT), /declaredLatencyS/);
  assert.throws(
    () => enforceCostLatencyBudget(budgetFixture(), 5, 5, { ...CONTEXT, requestId: "" }),
    /empty requestId on the enforcement context/,
  );
});

test("budget guard: the pure evaluation path records an over-budget decision without enforcing (negative control)", () => {
  const under = evaluateCostLatencyBudget(budgetFixture(), 40, 4, CONTEXT);
  assert.equal(under.allowed, true);
  const over = evaluateCostLatencyBudget(budgetFixture(), 140, 4, CONTEXT);
  assert.equal(over.allowed, false);
  assert.equal(over.costUtilization, 1.4);
  // the observation record is deterministic and distinct from the enforcing path only in use, never in shape
  assert.deepEqual(evaluateCostLatencyBudget(budgetFixture(), 140, 4, CONTEXT), over);
  assert.equal(over.id, budgetDecisionId(over.budgetId, over.requestId));
});

test("budget guard: class-dependent headroom bands derive deterministically", () => {
  for (const breakerClass of NEUTRAL_BACKOFF_CLASSES) {
    const headroom = intendedBudgetHeadroomAt("scope-a", breakerClass);
    assert.equal(headroom, intendedBudgetHeadroomAt("scope-a", breakerClass));
    assert.ok(headroom > 0 && headroom <= 1.1, `headroom band sane for ${breakerClass}: ${headroom}`);
  }
  assert.ok(
    intendedBudgetHeadroomAt("scope-a", "exponential-backoff-jitter") > intendedBudgetHeadroomAt("scope-a", "token-bucket"),
    "well-behaved breaker classes derive higher headroom bands",
  );
  assert.throws(() => intendedBudgetHeadroomAt("scope-a", "linear-backoff" as never), /four W8C classes only/);
  assert.match(budgetGuardSeamVersion(), /you-lab-budget-guard-seam\/1/);
});
