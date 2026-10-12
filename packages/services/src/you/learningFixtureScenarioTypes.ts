// YOU W6A learning fixture scenario — shared constants, types and helpers.
//
// The scenario runner (learningFixtureScenario.ts) orchestrates the full
// wave-6 arrow; this module carries its frozen fixture definition
// (FIXTURES.md law 2: seeds are stable constants) plus the step/trace
// types and the pure helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const LEARNING_SCENARIO_SOLUTION_ID = "you_w6a_scenario_solution01";
export const LEARNING_SCENARIO_SEED = "you-w6a-learning-scenario";
/** Evidence-plane seed (the scenario wires the REAL wave-2 EvidenceService as the consent authority). */
export const EVIDENCE_WIRING_SEED = "you-w6a-learning-scenario-evidence";

/** The six scenario signals, one per frozen kind (frozen fixture definition). */
export const SCENARIO_SIGNAL_SPECS = [
  { kind: "feedback", scope: "USER", seedText: "w6a-scenario-content-feedback" },
  { kind: "manual-takeover", scope: "USER", seedText: "w6a-scenario-content-takeover" },
  { kind: "edit-session", scope: "PROJECT", seedText: "w6a-scenario-content-edit" },
  { kind: "expert-intervention", scope: "USER", seedText: "w6a-scenario-content-expert" },
  { kind: "repeated-intent", scope: "TENANT", seedText: "w6a-scenario-content-intent" },
  { kind: "capability-gap", scope: "TENANT", seedText: "w6a-scenario-content-gap" },
] as const;

/** The teach-me trajectory's step count (frozen fixture definition). */
export const SCENARIO_TRAJECTORY_STEP_COUNT = 4;

/** The derived preference projection (frozen fixture definition). */
export const SCENARIO_PREFERENCE_KEY = "preferred-editor";
export const SCENARIO_PREFERENCE_VALUE = "fixture-external-editor";

/** The operator-seeded preference projection (frozen fixture definition). */
export const SCENARIO_OPERATOR_PREFERENCE_SCOPE = "GLOBAL";
export const SCENARIO_OPERATOR_PREFERENCE_KEY = "organization-baseline";
export const SCENARIO_OPERATOR_PREFERENCE_VALUE = "fixture-baseline";

export interface LearningScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface LearningScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly learningConsentPolicyId: OpaqueId;
  readonly evidenceRecordId: OpaqueId;
  readonly signalIds: readonly OpaqueId[];
  readonly recordIds: readonly OpaqueId[];
  readonly validatedRecordIds: readonly OpaqueId[];
  readonly rejectedRecordId: OpaqueId;
  readonly supersededRecordId: OpaqueId;
  readonly successorRecordId: OpaqueId;
  readonly inertRecordId: OpaqueId;
  readonly preferenceIds: readonly OpaqueId[];
  readonly trajectoryId: OpaqueId;
  readonly trajectoryReplayHash: string;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly learningStoreSize: number;
  readonly projectionMatchesReplay: boolean;
  readonly steps: readonly LearningScenarioStep[];
}

export interface LearningScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly learningSeed?: string;
  readonly evidenceSeed?: string;
}

/** Builds one recorded scenario step (shared by the wiring + scenario runners). */
export function scenarioStep(index: number, name: string, facts: Record<string, string | number | boolean>): LearningScenarioStep {
  return { step: index, name, facts };
}

/** Unwraps a typed service result or throws with the refusal code (scenario invariant). */
export function scenarioMust<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

export function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}

/** First 8 hex chars of a sha-256 content hash (compact lineage facts). */
export function shortHash(hash: string): string {
  return hash.slice(0, 8);
}

/** The typed refusal reason of a failed service result ("" when ok). */
export function refusalReason(result: { readonly ok: boolean; readonly error?: { readonly details: Readonly<Record<string, string | number | boolean>> } }): string {
  if (result.ok) {
    return "";
  }
  return String(result.error?.details["reason"] ?? "");
}
