// YOU W9A lab fixture scenario — shared constants, types and helpers.
//
// The scenario runner (labFixtureScenario.ts) orchestrates the full
// W9A arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const LAB_SCENARIO_SOLUTION_ID = "you_w9a_scenario_solution01";
export const LAB_SCENARIO_SEED = "you-w9a-lab-scenario";

/** The scenario experiment: one intent + one constraint set, three arms (the LAB.md law). */
export const LAB_SCENARIO_EXPERIMENT_INPUT = {
  intentRef: "you_intent_0000000000000009",
  constraintsHash: "e7a1c3f9d2b40668",
  objective: "minimize-compute-cost-at-quality-threshold",
  arms: ["generalist-baseline", "hand-designed", "searched"],
} as const;

/** The plan hashes the three arms run under (content-addressed compute plans). */
export const LAB_SCENARIO_PLAN_HASHES = {
  "generalist-baseline": "planhash-9a-baseline-0001",
  "hand-designed": "planhash-9a-handdesigned-02",
  searched: "planhash-9a-searched-000003",
} as const;

/** The promotion-decision scores: the searched arm beats the baseline under the recorded objective. */
export const LAB_SCENARIO_PROMOTION_SCORES = { objectiveScore: 0.87, baselineScore: 0.71 } as const;

/** The reversal scores: new evidence shows the searched arm no longer beats the baseline. */
export const LAB_SCENARIO_REVERSAL_SCORES = { objectiveScore: 0.68, baselineScore: 0.71 } as const;

export interface LabScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface LabScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly experimentId: OpaqueId;
  readonly baselineRunId: OpaqueId;
  readonly handDesignedRunId: OpaqueId;
  readonly searchedRetiredRunId: OpaqueId;
  readonly searchedRunId: OpaqueId;
  readonly baselineManifestId: OpaqueId;
  readonly searchedManifestId: OpaqueId;
  readonly promotionId: OpaqueId;
  readonly reversalId: OpaqueId;
  readonly ladderWalk: readonly string[];
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
