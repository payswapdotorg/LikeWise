// YOU W8A arena fixture scenario — shared constants, types and helpers.
//
// The scenario runner (arenaFixtureScenario.ts) orchestrates the full
// W8A arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const ARENA_SCENARIO_SOLUTION_ID = "you_w8a_scenario_solution01";
export const ARENA_SCENARIO_SEED = "you-w8a-arena-scenario";

/** The scenario provider (opaque refs; fixture provider, no endpoint). */
export const ARENA_SCENARIO_PROVIDER_INPUT = {
  providerKind: "synthetic-arena-fixture",
  capabilityClasses: ["TOOL_GAP", "KNOWLEDGE_GAP"],
  endpointRef: null,
} as const;

/** The scenario retry policy: two attempts, exponential backoff, authorization required. */
export const ARENA_SCENARIO_POLICY_INPUT = {
  maxAttempts: 2,
  backoffClass: "exponential",
  eligibilityCategories: ["TOOL_GAP", "KNOWLEDGE_GAP"],
  requiresAuthorization: true,
} as const;

/** Primary gap (TOOL_GAP — the full lifecycle chain). */
export const ARENA_SCENARIO_GAP_INPUT = {
  intentRef: "you_intent_0000000000000001",
  attemptedStrategies: [
    { strategy: "gltf-transform", outcome: "failed" as const, evidenceRef: "you_evidence_0000000000000001" },
    { strategy: "manual-pipeline", outcome: "partial" as const, evidenceRef: null },
  ],
  failureEvidence: ["you_evidence_0000000000000001", "you_evidence_0000000000000002"],
  category: "TOOL_GAP" as const,
  confidence: 0.8,
  suggestedNextAction: "substitute-gltf-pipeline",
};

/** Secondary gap (KNOWLEDGE_GAP — the authorization-expiry path + knowledge projection). */
export const ARENA_SCENARIO_GAP_TWO_INPUT = {
  attemptedStrategies: [{ strategy: "proportion-rules-lookup", outcome: "partial" as const, evidenceRef: null }],
  category: "KNOWLEDGE_GAP" as const,
  confidence: 0.7,
  suggestedNextAction: "human-proportion-rules",
};

/** Tertiary gap (EXPERT_GAP — the withdrawal path). */
export const ARENA_SCENARIO_GAP_THREE_INPUT = {
  attemptedStrategies: [{ strategy: "geometry-correction", outcome: "rejected" as const, evidenceRef: null }],
  category: "EXPERT_GAP" as const,
  confidence: 0.9,
  suggestedNextAction: "expert-correction",
};

/** The authorization grant facts on the primary escalation (no expiry). */
export const ARENA_SCENARIO_GRANT_INPUT = {
  authorizedBy: "you_user_0000000000000001",
  scope: "arena:tool-gap-remediation",
  expiresAt: null,
  learningPermission: "aggregate" as const,
};

/**
 * The gap-two grant expiry: fixed at clock tick 100 (the injected clock
 * steps 1000ms from the 2026-01-01T00:00:00.000Z epoch; the grant lands
 * well before tick 100 and the scenario burns 200 ticks past it).
 */
export const ARENA_SCENARIO_GAP_TWO_EXPIRES_AT = "2026-01-01T00:01:40.000Z";
export const ARENA_SCENARIO_TICKS_TO_BURN = 200;

/** The caller-side ChangeSet id the scenario reports back as applied (the boundary law). */
export const ARENA_SCENARIO_CHANGE_SET_ID = "you_change-set_w8a_scenario_0001";

export interface ArenaScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface ArenaScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly providerId: OpaqueId;
  readonly gapOneId: OpaqueId;
  readonly gapTwoId: OpaqueId;
  readonly gapThreeId: OpaqueId;
  readonly runIds: readonly OpaqueId[];
  readonly escalationOneId: OpaqueId;
  readonly escalationTwoId: OpaqueId;
  readonly escalationThreeId: OpaqueId;
  readonly authorizationOneId: OpaqueId;
  readonly authorizationTwoId: OpaqueId;
  readonly authorizationThreeId: OpaqueId;
  readonly ladderWalk: readonly string[];
  readonly authorizationChainTwoStatuses: readonly string[];
  readonly learningPermissionTrail: readonly string[];
  readonly refusalOutcomes: Readonly<Record<string, string>>;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly projectionCount: number;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly projectionMatchesReplay: boolean;
  readonly simulated: boolean;
  readonly steps: readonly ArenaScenarioStep[];
}

export interface ArenaScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly seed?: string;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}
