// YOU W7A embodiment fixture scenario — shared constants, types and helpers.
//
// The scenario runner (embodimentFixtureScenario.ts) orchestrates the full
// W7A arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const EMBODIMENT_SCENARIO_SOLUTION_ID = "you_w7a_scenario_solution01";
export const EMBODIMENT_SCENARIO_SEED = "you-w7a-embodiment-scenario";

/** The scenario Body's role. */
export const EMBODIMENT_SCENARIO_BODY_ROLE = "research-companion";

/** The scenario Body's appearance spec (content-addressed at registration). */
export const EMBODIMENT_SCENARIO_APPEARANCE_SPEC = {
  silhouette: "neutral-humanoid",
  palette: ["#23313d", "#31465a"],
  restingPose: "station-standby",
} as const;

/** The scenario Body's capabilities / tools / policy + contract refs. */
export const EMBODIMENT_SCENARIO_BODY_CAPABILITIES = ["conversation", "screen-reading", "tool-invocation"] as const;
export const EMBODIMENT_SCENARIO_BODY_TOOLS = ["you_tool_file_read", "you_tool_web_search"] as const;
export const EMBODIMENT_SCENARIO_BODY_POLICY_REFS = ["you_policy_embodiment_default"] as const;
export const EMBODIMENT_SCENARIO_MEMORY_CONTRACT_REF = "you_memory_contract_session_scoped";
export const EMBODIMENT_SCENARIO_EVALUATOR_CONTRACT_REF = "you_evaluator_contract_w7a";

/** The first Soul (system-one routing: fast/reactive). */
export const EMBODIMENT_SCENARIO_SOUL_A = {
  providerKind: "synthetic-llm",
  modelRef: "fixture-loom-1",
  routingProfile: "system-one",
  capabilities: ["fast-reply", "streaming"],
} as const;

/** The second Soul (system-two routing: deep/deliberate) — the re-possessor. */
export const EMBODIMENT_SCENARIO_SOUL_B = {
  providerKind: "synthetic-vlm",
  modelRef: "fixture-loom-2",
  routingProfile: "system-two",
  capabilities: ["deep-reasoning", "vision"],
} as const;

/**
 * The scripted full state-ladder walk: every rung of the eight interaction
 * rungs in frozen order (idle -> listening -> reading -> typing ->
 * thinking -> tool_use -> speaking -> interrupted -> idle). Each hop is a
 * legal transition under the frozen W7A table.
 */
export const EMBODIMENT_SCENARIO_LADDER_WALK = [
  "idle",
  "listening",
  "reading",
  "typing",
  "thinking",
  "tool_use",
  "speaking",
  "interrupted",
  "idle",
] as const;

export interface EmbodimentScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface EmbodimentScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly bodyId: OpaqueId;
  readonly soulBindingAId: OpaqueId;
  readonly soulBindingBId: OpaqueId;
  readonly sessionOneId: OpaqueId;
  readonly sessionTwoId: OpaqueId;
  readonly appearanceAddressed: boolean;
  readonly ladderWalkStates: readonly string[];
  readonly sessionOneFinalStatus: string;
  readonly sessionTwoFinalStatus: string;
  /** The Body record is byte-identical before/after re-possession (separation law). */
  readonly bodyPreservedAcrossRepossession: boolean;
  readonly repossessionSoulBindingId: OpaqueId;
  readonly refusalOutcomes: Readonly<Record<string, string>>;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly projectionMatchesReplay: boolean;
  readonly simulated: boolean;
  readonly steps: readonly EmbodimentScenarioStep[];
}

export interface EmbodimentScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly seed?: string;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}
