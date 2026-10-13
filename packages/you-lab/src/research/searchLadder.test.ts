// Search/RL ladder tests (W9C) — coverage: exploration appends
// SearchLadderSteps under the explicit cumulative budget, budget
// exhaustion is a RECORDED terminal step (never a silent stop), the step
// ledger is append-only and contiguous, and malformed plans/steps are
// typed YOU_SEARCH_LADDER_INVALID rejections.
import assert from "node:assert/strict";
import test from "node:test";
import {
  SEARCH_LADDER_INVALID_CODE,
  SEARCH_LADDER_STRATEGIES,
  SEARCH_LADDER_TERMINAL_STRATEGIES,
  SearchLadderInvalidError,
  STANDARD_SEARCH_STRATEGIES,
  appendSearchLadderStep,
  assertValidSearchLadderPlan,
  exploreSearchLadder,
  searchLadderStepId,
  type NeutralSearchLadderStep,
  type SearchLadderPlan,
  type SearchLadderScorer,
} from "./searchLadder.js";
import { createPipelineGenome, bestGenomeNode, MUTATION_KINDS } from "./pipelineGenome.js";
import { canonicalJson } from "../determinism.js";

const EXPERIMENT = "you_experiment_w9c-laddertest";

function plan(overrides: Partial<SearchLadderPlan> = {}): SearchLadderPlan {
  return {
    experimentId: EXPERIMENT,
    budgetCap: 100,
    nodeCost: 1,
    nodesPerStep: 2,
    strategies: [...STANDARD_SEARCH_STRATEGIES],
    ...overrides,
  };
}

/** Deterministic scorer: strength-proportional fixture score (pure function of the lineage). */
const scorer: SearchLadderScorer = {
  scoreCandidate: (candidate, lineage) => {
    const depth = lineage.length;
    return Math.round((0.3 + 0.05 * depth) * 10_000) / 10_000;
  },
};

function baseGenome() {
  return createPipelineGenome(EXPERIMENT, "ladder-test-root", 0.3);
}

test("ladder: a generous budget completes the strategy sequence with a recorded ladder-complete terminal", () => {
  const result = exploreSearchLadder(plan(), "ladder-test-seed", baseGenome(), scorer);
  assert.equal(result.terminal.kind, "ladder-complete");
  assert.equal(result.steps.length, STANDARD_SEARCH_STRATEGIES.length + 1);
  // steps are contiguous 1..n with the terminal last
  assert.deepEqual(result.steps.map((step) => step.step), [1, 2, 3, 4, 5, 6]);
  assert.equal(result.steps[result.steps.length - 1]!.strategy, "ladder-complete");
  assert.equal(result.steps[result.steps.length - 1]!.exploredNodes, 0);
  // every exploration step explored the full node count and never exceeded the cap
  for (let index = 0; index < STANDARD_SEARCH_STRATEGIES.length; index++) {
    const step = result.steps[index]!;
    assert.equal(step.strategy, STANDARD_SEARCH_STRATEGIES[index]);
    assert.equal(step.exploredNodes, 2);
    assert.ok(step.cumulativeBudget <= 100);
  }
  assert.equal(result.terminal.cumulativeBudget, 10);
  // the genome grew by the explored nodes; the best node is in the genome
  assert.equal(result.genome.nodes.length, 1 + 5 * 2);
  assert.ok(result.genome.nodes.some((node) => node.id === result.bestNodeId));
  assert.equal(result.bestScore, bestGenomeNode(result.genome).score);
});

test("ladder: budget exhaustion is a recorded terminal, never a silent stop", () => {
  // budgetCap 4.5 * nodeCost 1.5 * nodesPerStep 3: three full steps consume 13.5, remaining 0.5 < 1.5
  const tight = plan({ budgetCap: 13.5, nodeCost: 1.5, nodesPerStep: 3 });
  const result = exploreSearchLadder(tight, "ladder-test-seed", baseGenome(), scorer);
  assert.equal(result.terminal.kind, "budget-exhausted");
  assert.equal(result.steps.length, 4);
  const terminal = result.steps[3]!;
  assert.equal(terminal.strategy, "budget-exhausted");
  assert.equal(terminal.exploredNodes, 0);
  assert.equal(terminal.step, 4);
  assert.equal(terminal.cumulativeBudget, 13.5);
  assert.match(result.terminal.reason, /never a silent stop/);
  // no step ever exceeded the cap
  for (const step of result.steps) {
    assert.ok(step.cumulativeBudget <= 13.5);
  }
});

test("ladder: a cap below one node cost records immediate exhaustion at step 1", () => {
  const immediate = plan({ budgetCap: 0.5, nodeCost: 1 });
  const result = exploreSearchLadder(immediate, "ladder-test-seed", baseGenome(), scorer);
  assert.equal(result.terminal.kind, "budget-exhausted");
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0]!.strategy, "budget-exhausted");
  assert.equal(result.steps[0]!.exploredNodes, 0);
  assert.equal(result.steps[0]!.cumulativeBudget, 0);
  assert.equal(result.genome.nodes.length, 1, "nothing was explored");
});

test("ladder: a partial final step explores only what the budget affords", () => {
  // after two full steps 9.0 of 12.0 is consumed; the remaining 3.0 affords exactly 2 of 3 nodes
  const partial = plan({ budgetCap: 12, nodeCost: 1.5, nodesPerStep: 3 });
  const result = exploreSearchLadder(partial, "ladder-test-seed", baseGenome(), scorer);
  const exploration = result.steps.filter((step) => step.exploredNodes > 0);
  assert.equal(exploration.length, 3);
  assert.equal(exploration[0]!.exploredNodes, 3);
  assert.equal(exploration[1]!.exploredNodes, 3);
  assert.equal(exploration[2]!.exploredNodes, 2);
  assert.ok(exploration.every((step) => step.cumulativeBudget <= 12));
  assert.equal(exploration[2]!.cumulativeBudget, 12);
  // the budget is exhausted right after the partial step (recorded terminal)
  assert.equal(result.terminal.kind, "budget-exhausted");
});

test("ladder: steps are append-only, budgets monotone and best scores never regress", () => {
  const result = exploreSearchLadder(plan(), "ladder-test-seed", baseGenome(), scorer);
  let previousBudget = 0;
  let previousBest = 0;
  for (const step of result.steps) {
    assert.ok(step.cumulativeBudget >= previousBudget);
    assert.ok(step.bestScore >= previousBest);
    assert.equal(step.experimentId, EXPERIMENT);
    assert.equal(step.simulated, true, "truth law: fixture ladder steps stay labeled simulated");
    previousBudget = step.cumulativeBudget;
    previousBest = step.bestScore;
  }
  // the terminal is always the final step
  const last = result.steps[result.steps.length - 1]!;
  assert.ok((SEARCH_LADDER_TERMINAL_STRATEGIES as readonly string[]).includes(last.strategy));
});

test("ladder: identical inputs replay byte-identically", () => {
  const first = exploreSearchLadder(plan(), "ladder-test-seed", baseGenome(), scorer);
  const second = exploreSearchLadder(plan(), "ladder-test-seed", baseGenome(), scorer);
  assert.equal(canonicalJson(first), canonicalJson(second));
  // a different seed selects different mutations (different exploration)
  const other = exploreSearchLadder(plan(), "ladder-test-other-seed", baseGenome(), scorer);
  assert.notEqual(canonicalJson(other), canonicalJson(first));
});

test("ladder: malformed plans are typed YOU_SEARCH_LADDER_INVALID rejections", () => {
  const malformed: readonly [string, SearchLadderPlan][] = [
    ["empty experimentId", plan({ experimentId: "" })],
    ["zero budget cap", plan({ budgetCap: 0 })],
    ["negative budget cap", plan({ budgetCap: -5 })],
    ["NaN budget cap", plan({ budgetCap: Number.NaN })],
    ["zero node cost", plan({ nodeCost: 0 })],
    ["negative node cost", plan({ nodeCost: -1 })],
    ["zero nodes per step", plan({ nodesPerStep: 0 })],
    ["fractional nodes per step", plan({ nodesPerStep: 1.5 })],
    ["empty strategies", plan({ strategies: [] })],
    ["unknown strategy", plan({ strategies: ["gradient-ascent"] })],
    ["terminal strategy is not caller-suppliable", plan({ strategies: ["budget-exhausted"] })],
  ];
  for (const [label, bad] of malformed) {
    assert.throws(
      () => assertValidSearchLadderPlan(bad),
      (error: unknown) => {
        assert.ok(error instanceof SearchLadderInvalidError, `${label}: typed error`);
        assert.equal(error.code, SEARCH_LADDER_INVALID_CODE);
        return true;
      },
      label,
    );
  }
  // the seven LAB.md learning-ladder stages are all valid plan strategies
  assert.doesNotThrow(() => assertValidSearchLadderPlan(plan({ strategies: [...SEARCH_LADDER_STRATEGIES] })));
});

test("ladder: exploreSearchLadder enforces experiment identity and a non-empty seed", () => {
  const foreign = createPipelineGenome("you_experiment_other", "root", 0.3);
  assert.throws(
    () => exploreSearchLadder(plan(), "ladder-test-seed", foreign, scorer),
    (error: unknown) => {
      assert.ok(error instanceof SearchLadderInvalidError);
      assert.match(error.message, /identity law/);
      return true;
    },
  );
  assert.throws(() => exploreSearchLadder(plan(), "", baseGenome(), scorer), SearchLadderInvalidError);
});

function step(number: number, strategy: string, budget: number, best = 0.5): NeutralSearchLadderStep {
  return {
    id: searchLadderStepId(EXPERIMENT, number, strategy),
    experimentId: EXPERIMENT,
    step: number,
    strategy,
    exploredNodes: strategy === "budget-exhausted" ? 0 : 2,
    bestScore: best,
    cumulativeBudget: budget,
    simulated: true,
  };
}

test("ladder: appendSearchLadderStep enforces the append-only ledger laws", () => {
  const first = step(1, "deterministic-replay", 2, 0.4);
  const second = step(2, "search-bandits", 4, 0.5);
  const ledger = appendSearchLadderStep(appendSearchLadderStep([], first), second);
  assert.equal(ledger.length, 2);
  assert.deepEqual(ledger[0], first);
  const rejected: readonly [string, NeutralSearchLadderStep][] = [
    ["out-of-order step number", step(4, "search-bandits", 6)],
    ["experiment mismatch", { ...step(3, "search-bandits", 6), experimentId: "you_experiment_other" }],
    ["budget regression", step(3, "search-bandits", 3)],
    ["best-score regression", step(3, "search-bandits", 6, 0.2)],
    ["unknown strategy", step(3, "gradient-ascent", 6)],
    ["bad id prefix", { ...step(3, "search-bandits", 6), id: "not-a-ladder-step" }],
    ["zero step number", step(0, "search-bandits", 6)],
    ["fractional step number", { ...step(3, "search-bandits", 6), step: 3.5 }],
    ["negative explored nodes", { ...step(3, "search-bandits", 6), exploredNodes: -1 }],
    ["bestScore above 1", { ...step(3, "search-bandits", 6), bestScore: 1.2 }],
    ["negative cumulative budget", { ...step(3, "search-bandits", 6), cumulativeBudget: -1 }],
  ];
  for (const [label, bad] of rejected) {
    assert.throws(
      () => appendSearchLadderStep(ledger, bad),
      (error: unknown) => {
        assert.ok(error instanceof SearchLadderInvalidError, `${label}: typed error`);
        assert.equal(error.code, SEARCH_LADDER_INVALID_CODE);
        return true;
      },
      label,
    );
  }
  // the first step must be number 1
  assert.throws(() => appendSearchLadderStep([], step(2, "search-bandits", 2)), SearchLadderInvalidError);
  // the input ledger is untouched (append-only)
  assert.equal(ledger.length, 2);
});

test("ladder: the step id is a pure function of (experiment, number, strategy)", () => {
  const a = searchLadderStepId(EXPERIMENT, 1, "search-bandits");
  assert.match(a, /^you_ladder-step_[0-9a-f]{16}$/);
  assert.equal(a, searchLadderStepId(EXPERIMENT, 1, "search-bandits"));
  assert.notEqual(a, searchLadderStepId(EXPERIMENT, 2, "search-bandits"));
  assert.notEqual(a, searchLadderStepId("you_experiment_other", 1, "search-bandits"));
});

test("ladder: exploration appends scored mutations under the current best (hill-climb anchor)", () => {
  const result = exploreSearchLadder(plan({ nodesPerStep: 1, strategies: ["deterministic-replay"] }), "ladder-test-seed", baseGenome(), scorer);
  assert.equal(result.genome.nodes.length, 2);
  const child = result.genome.nodes[1]!;
  assert.equal(child.parentRef, result.genome.nodes[0]!.id);
  assert.equal(child.score, 0.4, "the candidate carries the scorer's objective, not a placeholder");
  assert.ok((MUTATION_KINDS as readonly string[]).includes(child.mutationKind));
});
