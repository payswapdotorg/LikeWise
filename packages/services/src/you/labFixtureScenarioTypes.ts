// YOU W9A lab fixture scenario — shared constants, types and helpers.
//
// The scenario runner (labFixtureScenario.ts) orchestrates the full
// W9A arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const LAB_SCENARIO_SOLUTION_ID = "you_w9a_scenario_solution01";
export const LAB_SCENARIO_SEED = "you-w9a-lab-scenario";

/** The scenario experiment declaration (the LAB.md three-arm law). */
export const LAB_SCENARIO_EXPERIMENT_INPUT = {
  intentRef: "you_intent_0000000000000001",
  constraintsHash: "constraints-hash-w9a-01",
  objective: "minimize-total-cost-under-quality-threshold",
  arms: ["generalist-baseline", "hand-designed", "searched"],
} as const;

/** The per-arm run plan hashes (the compute plans the runs bind). */
export const LAB_SCENARIO_PLAN_HASHES: Readonly<Record<string, string>> = {
  "generalist-baseline": "plan-baseline-v1",
  "hand-designed": "plan-hand-designed-v1",
  searched: "plan-searched-v1",
};

/** The promotion comparison scores (deterministic arithmetic, law 5). */
export const LAB_SCENARIO_SEARCHED_SCORE = 0.87;
export const LAB_SCENARIO_BASELINE_SCORE = 0.62;
export const LAB_SCENARIO_REVERSED_SEARCHED_SCORE = 0.55;
export const LAB_SCENARIO_REPROMOTED_SEARCHED_SCORE = 0.91;

/** Deterministic artifact byte lengths per bundle (fixture definition). */
export const LAB_SCENARIO_ARTIFACT_BYTES = 128;

export interface LabScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface LabScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly experimentId: OpaqueId;
  /** Every run id in ladder append order. */
  readonly runIds: readonly OpaqueId[];
  /** The status walk of every run, concatenated in ladder order. */
  readonly ladderWalk: readonly string[];
  /** The manifest ids in publish order. */
  readonly manifestIds: readonly OpaqueId[];
  /** The promotion decision chain in append order. */
  readonly promotionChain: readonly OpaqueId[];
  /** The decision kinds of the chain, in order. */
  readonly decisionKinds: readonly string[];
  readonly refusalOutcomes: Readonly<Record<string, string>>;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly projectionMatchesReplay: boolean;
  readonly simulated: boolean;
  readonly steps: readonly LabScenarioStep[];
}

export interface LabScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly seed?: string;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}
