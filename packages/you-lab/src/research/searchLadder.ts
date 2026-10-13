// Search/RL ladder — append-only exploration under an explicit cumulative
// budget (W9C).
//
// Authority: docs/you/LAB.md "Learning ladder" (deterministic replay ->
// evaluator-backed optimization -> search/bandits -> offline policy
// learning -> bounded RL where justified -> shadow/canary -> production
// promotion) and the SEARCH BUDGET LAW (docs/you/CONTRACTS.md "Wave-9
// contract freeze (v9)"): the search/RL ladder explores under an explicit
// cumulative budget; every step is an appended SearchLadderStep; budget
// exhaustion is a recorded terminal, never a silent stop.
//
// The ladder explores the Pipeline Genome: each step appends mutation
// nodes under the current best lineage (hill-climbing anchor) and records
// the cumulative budget consumed. The step shape is the neutral
// SearchLadderStep aligned 1:1 with the frozen v9 SearchLadderStep
// (mapping onto the frozen contract happens ONLY in src/contractSeam.ts).
//
// HONEST MODEL: node scores are computed fixture objectives supplied by
// the caller's scorer (the world-run machinery) — nothing is measured and
// no real compute plane is invoked (W10+ boundary). Budget units are
// authored fixture accounting (nodeCost per explored node), not wall-clock
// or money. Determinism: step ids, mutation selection and budget
// arithmetic are pure functions of the inputs (rounded IEEE-754 only).

import { roundTo } from "../determinism.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import {
  appendGenomeNode,
  bestGenomeNode,
  genomeChildNodeId,
  genomeLineage,
  nextMutationKind,
  type NeutralPipelineGenomeNode,
  type PipelineGenome,
} from "./pipelineGenome.js";

/** Error code aligned with the frozen v9 typed error literal (you-lab-owned). */
export const SEARCH_LADDER_INVALID_CODE = "YOU_SEARCH_LADDER_INVALID";

/** Typed rejection thrown when a ladder plan or step violates the budget/append laws. */
export class SearchLadderInvalidError extends Error {
  readonly code = SEARCH_LADDER_INVALID_CODE;
  constructor(detail: string) {
    super(`${SEARCH_LADDER_INVALID_CODE}: ${detail}`);
  }
}

/**
 * The LAB.md learning-ladder strategy vocabulary (W9C fixture
 * definition). Stages six and seven (shadow-canary,
 * production-promotion) belong to the promotion path, not the search
 * plane — plans may still name them (the ladder is the full learning
 * ladder), but the standard W9C plan explores the five search/RL stages.
 */
export const SEARCH_LADDER_STRATEGIES = [
  "deterministic-replay",
  "evaluator-backed-optimization",
  "search-bandits",
  "offline-policy-learning",
  "bounded-rl",
  "shadow-canary",
  "production-promotion",
] as const;

export type NeutralSearchStrategy = (typeof SEARCH_LADDER_STRATEGIES)[number] | (string & {});

/** The standard five search/RL stages (LAB.md learning ladder stages 1-5). */
export const STANDARD_SEARCH_STRATEGIES: readonly NeutralSearchStrategy[] = SEARCH_LADDER_STRATEGIES.slice(0, 5);

/** Terminal strategies minted by the ladder executor (never caller-supplied). */
export const SEARCH_LADDER_TERMINAL_STRATEGIES = ["budget-exhausted", "ladder-complete"] as const;

/**
 * Neutral search ladder step — aligned 1:1 with the frozen v9
 * SearchLadderStep (append-only; budget exhaustion is a recorded terminal).
 */
export interface NeutralSearchLadderStep {
  readonly id: string;
  readonly experimentId: string;
  readonly step: number;
  readonly strategy: string;
  readonly exploredNodes: number;
  readonly bestScore: number;
  readonly cumulativeBudget: number;
  readonly simulated: boolean;
}

/** An explicit cumulative exploration budget plan. */
export interface SearchLadderPlan {
  readonly experimentId: string;
  /** Total exploration budget (> 0, finite — the explicit cap). */
  readonly budgetCap: number;
  /** Budget units consumed per explored node (> 0, finite). */
  readonly nodeCost: number;
  /** Nodes explored per strategy step (integer >= 1). */
  readonly nodesPerStep: number;
  /** Strategy sequence (each from the LAB.md learning-ladder vocabulary). */
  readonly strategies: readonly string[];
}

/** The recorded terminal of a ladder run (never a silent stop). */
export interface SearchLadderTerminal {
  readonly kind: "budget-exhausted" | "ladder-complete";
  readonly reason: string;
  readonly finalStep: number;
  readonly cumulativeBudget: number;
}

/** The result of one ladder run: the append-only steps, the terminal, the extended genome. */
export interface SearchLadderResult {
  readonly experimentId: string;
  readonly steps: readonly NeutralSearchLadderStep[];
  readonly terminal: SearchLadderTerminal;
  readonly genome: PipelineGenome;
  readonly bestNodeId: string;
  readonly bestScore: number;
}

/**
 * The caller's deterministic candidate scorer: scores a hypothetical
 * mutation node against its root -> candidate lineage (the world-run
 * machinery in the promotion-evidence harness). Pure function — the same
 * (candidate, lineage) must always score identically.
 */
export interface SearchLadderScorer {
  readonly scoreCandidate: (candidate: NeutralPipelineGenomeNode, lineage: readonly NeutralPipelineGenomeNode[]) => number;
}

const STEP_ID_PREFIX = "you_ladder-step_";

/** Deterministic ladder-step id for (experimentId, step number, strategy). */
export function searchLadderStepId(experimentId: string, step: number, strategy: string): string {
  return `${STEP_ID_PREFIX}${sha256Hex(`${experimentId}|${step}|${strategy}`).slice(0, 16)}`;
}

function isKnownStrategy(strategy: string): boolean {
  return (
    (SEARCH_LADDER_STRATEGIES as readonly string[]).includes(strategy) ||
    (SEARCH_LADDER_TERMINAL_STRATEGIES as readonly string[]).includes(strategy)
  );
}

function assertValidStepFields(step: NeutralSearchLadderStep, context: string): void {
  if (!step.id.startsWith(STEP_ID_PREFIX)) {
    throw new SearchLadderInvalidError(`${context}: step id '${step.id}' does not carry the '${STEP_ID_PREFIX}' prefix`);
  }
  if (step.experimentId.length === 0) {
    throw new SearchLadderInvalidError(`${context}: experimentId is empty (a step names its experiment)`);
  }
  if (!Number.isInteger(step.step) || step.step < 1) {
    throw new SearchLadderInvalidError(`${context}: step number ${step.step} must be an integer >= 1`);
  }
  if (!isKnownStrategy(step.strategy)) {
    throw new SearchLadderInvalidError(`${context}: strategy '${step.strategy}' is outside the LAB.md learning-ladder vocabulary`);
  }
  if (!Number.isInteger(step.exploredNodes) || step.exploredNodes < 0) {
    throw new SearchLadderInvalidError(`${context}: exploredNodes ${step.exploredNodes} must be an integer >= 0`);
  }
  if (typeof step.bestScore !== "number" || !Number.isFinite(step.bestScore) || step.bestScore < 0 || step.bestScore > 1) {
    throw new SearchLadderInvalidError(`${context}: bestScore ${step.bestScore} is outside [0, 1] (never silently clamped)`);
  }
  if (typeof step.cumulativeBudget !== "number" || !Number.isFinite(step.cumulativeBudget) || step.cumulativeBudget < 0) {
    throw new SearchLadderInvalidError(`${context}: cumulativeBudget ${step.cumulativeBudget} must be a finite number >= 0`);
  }
}

/**
 * Append-only step ledger enforcement: the next step must be numbered
 * exactly last+1, thread the same experiment, carry a monotone cumulative
 * budget and never regress the recorded best score below... (the best
 * score is a running max by construction; the ledger validates the
 * mechanical fields). Returns a NEW array — the input is untouched.
 */
export function appendSearchLadderStep(
  steps: readonly NeutralSearchLadderStep[],
  step: NeutralSearchLadderStep,
): readonly NeutralSearchLadderStep[] {
  assertValidStepFields(step, "appendSearchLadderStep");
  const last = steps[steps.length - 1];
  if (last) {
    if (step.step !== last.step + 1) {
      throw new SearchLadderInvalidError(
        `appendSearchLadderStep: step number ${step.step} != last step ${last.step} + 1 (the ladder is append-only and contiguous)`,
      );
    }
    if (step.experimentId !== last.experimentId) {
      throw new SearchLadderInvalidError(
        `appendSearchLadderStep: experimentId '${step.experimentId}' != ladder experiment '${last.experimentId}'`,
      );
    }
    if (step.cumulativeBudget < last.cumulativeBudget) {
      throw new SearchLadderInvalidError(
        `appendSearchLadderStep: cumulativeBudget ${step.cumulativeBudget} < previous ${last.cumulativeBudget} (budget accounting is monotone)`,
      );
    }
    if (step.bestScore < last.bestScore) {
      throw new SearchLadderInvalidError(
        `appendSearchLadderStep: bestScore ${step.bestScore} < previous ${last.bestScore} (the recorded best never regresses)`,
      );
    }
  } else if (step.step !== 1) {
    throw new SearchLadderInvalidError(`appendSearchLadderStep: the first step must be number 1 (got ${step.step})`);
  }
  return [...steps, { ...step }];
}

/** Fail-closed plan validation (typed YOU_SEARCH_LADDER_INVALID rejections). */
export function assertValidSearchLadderPlan(plan: SearchLadderPlan): void {
  if (plan.experimentId.length === 0) {
    throw new SearchLadderInvalidError("experimentId is empty (a ladder names its experiment)");
  }
  if (typeof plan.budgetCap !== "number" || !Number.isFinite(plan.budgetCap) || plan.budgetCap <= 0) {
    throw new SearchLadderInvalidError(`budgetCap ${plan.budgetCap} must be a finite number > 0 (the explicit cumulative budget)`);
  }
  if (typeof plan.nodeCost !== "number" || !Number.isFinite(plan.nodeCost) || plan.nodeCost <= 0) {
    throw new SearchLadderInvalidError(`nodeCost ${plan.nodeCost} must be a finite number > 0`);
  }
  if (!Number.isInteger(plan.nodesPerStep) || plan.nodesPerStep < 1) {
    throw new SearchLadderInvalidError(`nodesPerStep ${plan.nodesPerStep} must be an integer >= 1`);
  }
  if (plan.strategies.length === 0) {
    throw new SearchLadderInvalidError("strategies is empty (the ladder names at least one strategy)");
  }
  for (const strategy of plan.strategies) {
    if (!(SEARCH_LADDER_STRATEGIES as readonly string[]).includes(strategy)) {
      throw new SearchLadderInvalidError(
        `strategy '${strategy}' is outside the LAB.md learning-ladder vocabulary (terminal strategies are minted by the executor, never supplied)`,
      );
    }
  }
}

/**
 * Explore the search/RL ladder under the plan's explicit cumulative
 * budget: each strategy step appends mutation nodes under the current
 * best lineage (scoring every candidate through the caller's deterministic
 * scorer) and records the cumulative budget. When the remaining budget
 * cannot afford a single node, a "budget-exhausted" TERMINAL STEP is
 * appended (never a silent stop); when the strategy sequence completes
 * within budget, a "ladder-complete" terminal is appended. The final step
 * of every result is a terminal; no step ever exceeds the cap.
 */
export function exploreSearchLadder(
  plan: SearchLadderPlan,
  ladderSeed: string,
  genome: PipelineGenome,
  scorer: SearchLadderScorer,
): SearchLadderResult {
  assertValidSearchLadderPlan(plan);
  if (genome.experimentId !== plan.experimentId) {
    throw new SearchLadderInvalidError(
      `genome experiment '${genome.experimentId}' != plan experiment '${plan.experimentId}' (identity law — the ladder explores its own experiment's genome)`,
    );
  }
  if (ladderSeed.length === 0) {
    throw new SearchLadderInvalidError("ladderSeed is empty (mutation selection derives from it)");
  }
  let steps: readonly NeutralSearchLadderStep[] = [];
  let working = genome;
  let consumed = 0;
  let globalOrdinal = 0;
  let terminal: SearchLadderTerminal | null = null;
  for (const strategy of plan.strategies) {
    const remaining = roundTo(plan.budgetCap - consumed, 6);
    if (remaining < plan.nodeCost) {
      const reason =
        `budget exhausted: ${consumed} of ${plan.budgetCap} units consumed; the next node costs ${plan.nodeCost} and strategy '${strategy}' cannot start (recorded terminal, never a silent stop)`;
      terminal = { kind: "budget-exhausted", reason, finalStep: steps.length + 1, cumulativeBudget: consumed };
      steps = appendSearchLadderStep(steps, {
        id: searchLadderStepId(plan.experimentId, steps.length + 1, "budget-exhausted"),
        experimentId: plan.experimentId,
        step: steps.length + 1,
        strategy: "budget-exhausted",
        exploredNodes: 0,
        bestScore: bestGenomeNode(working).score,
        cumulativeBudget: consumed,
        simulated: true,
      });
      break;
    }
    const affordable = Math.min(plan.nodesPerStep, Math.floor(roundTo(remaining / plan.nodeCost, 6)));
    for (let index = 0; index < affordable; index++) {
      const anchor = bestGenomeNode(working);
      const mutationKind = nextMutationKind(ladderSeed, plan.experimentId, globalOrdinal++);
      const candidate: NeutralPipelineGenomeNode = {
        id: genomeChildNodeId(working, anchor.id, mutationKind),
        parentRef: anchor.id,
        mutationKind,
        score: 0,
        generation: anchor.generation + 1,
        simulated: true,
      };
      const score = scorer.scoreCandidate(candidate, [...genomeLineage(working, anchor.id), candidate]);
      working = appendGenomeNode(working, { ...candidate, score });
    }
    consumed = roundTo(consumed + affordable * plan.nodeCost, 6);
    steps = appendSearchLadderStep(steps, {
      id: searchLadderStepId(plan.experimentId, steps.length + 1, strategy),
      experimentId: plan.experimentId,
      step: steps.length + 1,
      strategy,
      exploredNodes: affordable,
      bestScore: bestGenomeNode(working).score,
      cumulativeBudget: consumed,
      simulated: true,
    });
  }
  if (terminal === null) {
    const explorationSteps = plan.strategies.length;
    const reason =
      `strategy sequence complete within budget: ${consumed} of ${plan.budgetCap} units consumed across ${explorationSteps} exploration step${explorationSteps === 1 ? "" : "s"}`;
    terminal = { kind: "ladder-complete", reason, finalStep: steps.length + 1, cumulativeBudget: consumed };
    steps = appendSearchLadderStep(steps, {
      id: searchLadderStepId(plan.experimentId, steps.length + 1, "ladder-complete"),
      experimentId: plan.experimentId,
      step: steps.length + 1,
      strategy: "ladder-complete",
      exploredNodes: 0,
      bestScore: bestGenomeNode(working).score,
      cumulativeBudget: consumed,
      simulated: true,
    });
  }
  const best = bestGenomeNode(working);
  return {
    experimentId: plan.experimentId,
    steps,
    terminal: terminal,
    genome: working,
    bestNodeId: best.id,
    bestScore: best.score,
  };
}
