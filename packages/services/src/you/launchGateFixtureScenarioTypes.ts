// YOU W12A launch-gate fixture scenario — shared constants, types and
// helpers.
//
// The scenario runner (launchGateFixtureScenario.ts) orchestrates the
// full W12A launch-gate arrow (docs/you/WORK_ORDERS.md W12A); this
// module carries its frozen fixture definition (FIXTURES.md law 2:
// seeds are stable constants) plus the step/trace types and the pure
// helpers both modules share.

import type { OpaqueId } from "@zcode/shared";

export const LAUNCH_GATE_SCENARIO_SOLUTION_ID = "you_w12a_scenario_solution01";
export const LAUNCH_GATE_SCENARIO_SEED = "you-w12a-launch-gate-scenario";

/**
 * The golden journey evidence: 20 successful full-path journeys (one
 * per launch-gate point, journeyIds gate-point-01..gate-point-20),
 * seed-derived simulated durations (the W11C journey-harness law:
 * never a wall-clock claim — the fixture rng derives them).
 */
export const LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_BASE_MS = 120;
export const LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_SPAN_MS = 480;

/**
 * The failing journey evidence for the honest-failure checklist: a
 * partial journey that stopped at the edit step (stepsCompleted 11,
 * failedStep "edit") and a recovered journey that names its failed-at
 * step (the step-20 drill, recovered — honest recovery evidence, NOT a
 * clean gate pass).
 */
export const LAUNCH_GATE_SCENARIO_PARTIAL_JOURNEY_STEPS_COMPLETED = 11;
export const LAUNCH_GATE_SCENARIO_PARTIAL_JOURNEY_FAILED_STEP = "edit";
export const LAUNCH_GATE_SCENARIO_RECOVERY_JOURNEY_FAILED_STEP = "injected-failure-recovery";

/** The scenario operator (the signoff's signedBy). */
export const LAUNCH_GATE_SCENARIO_OPERATOR = "you_user_0000000000000002";

/**
 * The scenario release references: the evidence bundle and the
 * rollback evidence (THE RELEASE DECLARATION LAW: both required).
 */
export const LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF = "you_evidence-bundle_w12a-scenario01";
export const LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF = "you_rollback-evidence_w12a-scenario01";

export interface LaunchGateScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface LaunchGateScenarioTrace {
  readonly solutionId: OpaqueId;
  /** All assembled checklist ids (the passing gate first, the failing gate second). */
  readonly checklistIds: readonly OpaqueId[];
  readonly passingChecklistId: OpaqueId;
  readonly failingChecklistId: OpaqueId;
  readonly signoffId: OpaqueId;
  readonly declarationId: OpaqueId;
  /** The 20 golden journey-evidence record ids (point order). */
  readonly goldenJourneyIds: readonly OpaqueId[];
  readonly chainWalk: readonly string[];
  readonly refusalOutcomes: Readonly<Record<string, string>>;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly projectionMatchesReplay: boolean;
  readonly simulated: boolean;
  readonly steps: readonly LaunchGateScenarioStep[];
}

export interface LaunchGateScenarioOptions {
  readonly solutionId?: OpaqueId;
  readonly seed?: string;
}

export function launchGateOutcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}
