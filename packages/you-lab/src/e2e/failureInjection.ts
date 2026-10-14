// Failure injection (W11C).
//
// Deterministic injected failures at each launch-gate journey step — the
// recovery paths exercised (docs/you/WORK_ORDERS.md W11C acceptance:
// "failure injection: deterministic injected failures at each journey
// step (the recovery paths exercised); journey records with failedStep +
// measured durationMs (the JOURNEY LAW)").
//
// The injection fixture set is EXHAUSTIVE: one recover-mode journey per
// launch-gate step (all 20 points), so every step's incident class has
// an injected-failure journey exercising its detection -> containment ->
// recovery path (the RUNBOOK LAW's exercise evidence). The terminal
// fixture pair demonstrates the JOURNEY LAW's failed-at branch: a
// terminal failure stops the journey and the record honestly reports the
// completed prefix (< 20) with the failed step named.
//
// All journeys are seed-derived simulations (no clock, no randomness, no
// network); the coverage summary is a derived counting projection.

import { JOURNEY_STEP_IDS } from "./journeySteps.js";
import {
  type JourneyFixture,
  type JourneyInjectionSpec,
  type NeutralJourneyOutcome,
  runGoldenJourneys,
  runJourney,
} from "./journeyHarness.js";

/**
 * The exhaustive recover-mode injection fixtures — one journey per
 * launch-gate step (20 journeys; every step's recovery path is
 * exercised). Seed-derived; byte-identical replay.
 */
export const INJECTION_JOURNEY_FIXTURES: readonly JourneyFixture[] = JOURNEY_STEP_IDS.map((stepId) => ({
  journeyId: `injection-${stepId}`,
  seed: `you-lab-w11c-injection-${stepId}`,
  injection: { stepId, mode: "recover" } satisfies JourneyInjectionSpec,
}));

/**
 * The terminal-mode fixtures — the JOURNEY LAW's failed-at branch (the
 * journey stops at the injected step; the record reports the honest
 * prefix). One mid-journey terminal (evidence, step 6) and one at the
 * drill step itself (injected-failure-recovery, step 20).
 */
export const TERMINAL_JOURNEY_FIXTURES: readonly JourneyFixture[] = [
  { journeyId: "terminal-evidence", seed: "you-lab-w11c-terminal-evidence", injection: { stepId: "evidence", mode: "terminal" } },
  { journeyId: "terminal-recovery-drill", seed: "you-lab-w11c-terminal-drill", injection: { stepId: "injected-failure-recovery", mode: "terminal" } },
];

/** Run the exhaustive recover-mode injection coverage journeys (one per step). */
export function runInjectionCoverageJourneys(): readonly NeutralJourneyOutcome[] {
  return INJECTION_JOURNEY_FIXTURES.map((fixture) =>
    runJourney({ journeyId: fixture.journeyId, seed: fixture.seed, injection: fixture.injection }),
  );
}

/** Run the terminal-mode journeys (the failed-at branch fixtures). */
export function runTerminalJourneys(): readonly NeutralJourneyOutcome[] {
  return TERMINAL_JOURNEY_FIXTURES.map((fixture) =>
    runJourney({ journeyId: fixture.journeyId, seed: fixture.seed, injection: fixture.injection }),
  );
}

/** Derived injection-coverage summary — counting only (informs, never decides). */
export interface InjectionCoverageSummary {
  /** Distinct launch-gate steps with an injected recover-mode failure that recovered. */
  readonly stepsCovered: number;
  /** Steps with NO recovered injection (honest gap listing — expected empty for the standard set). */
  readonly uncoveredSteps: readonly string[];
  /** Incident classes exercised by an injected failure (the RUNBOOK LAW evidence). */
  readonly exercisedIncidentClasses: readonly string[];
  /** True when every injected failure was followed by its recovery. */
  readonly allInjectionsRecovered: boolean;
  /** True when every journey record carries a non-null failedStep (the failed-at recording). */
  readonly failedStepsRecorded: boolean;
}

/** Summarize injection coverage over a set of injected-failure journeys (derived projection). */
export function summarizeInjectionCoverage(
  outcomes: readonly NeutralJourneyOutcome[],
): InjectionCoverageSummary {
  const covered = new Set<string>();
  const exercisedClasses = new Set<string>();
  let allRecovered = true;
  let failedStepsRecorded = true;
  for (const outcome of outcomes) {
    if (outcome.spec.injection === null) {
      continue; // golden journeys are not part of injection coverage (selection, not silence)
    }
    if (outcome.failedStep !== outcome.spec.injection.stepId) {
      failedStepsRecorded = false;
    }
    const failedIndexes = new Set<number>();
    const recoveredIndexes = new Set<number>();
    for (const record of outcome.steps) {
      if (record.status === "failed" && record.stepId === outcome.spec.injection.stepId) {
        failedIndexes.add(record.stepIndex);
        if (record.incidentClass !== null) {
          exercisedClasses.add(record.incidentClass);
        }
      }
      if (record.status === "recovered" && record.stepId === outcome.spec.injection.stepId) {
        recoveredIndexes.add(record.stepIndex);
      }
    }
    const injectedStepRecovered = [...failedIndexes].every((index) => recoveredIndexes.has(index));
    if (!injectedStepRecovered) {
      allRecovered = false;
    } else if (outcome.spec.injection.mode === "recover") {
      covered.add(outcome.spec.injection.stepId);
    }
  }
  return {
    stepsCovered: covered.size,
    uncoveredSteps: JOURNEY_STEP_IDS.filter((stepId) => !covered.has(stepId)),
    exercisedIncidentClasses: [...exercisedClasses].sort(),
    allInjectionsRecovered: allRecovered,
    failedStepsRecorded,
  };
}

/**
 * The full W11C launch-gate journey suite: golden reference journeys +
 * the exhaustive recover-mode injection coverage + the terminal
 * failed-at fixtures, with the derived coverage summary.
 */
export interface LaunchGateJourneySuite {
  readonly golden: readonly NeutralJourneyOutcome[];
  readonly injection: readonly NeutralJourneyOutcome[];
  readonly terminal: readonly NeutralJourneyOutcome[];
  readonly coverage: InjectionCoverageSummary;
}

/** Run the full launch-gate journey suite (golden + injection + terminal). */
export function runLaunchGateJourneySuite(): LaunchGateJourneySuite {
  const golden = runGoldenJourneys();
  const injection = runInjectionCoverageJourneys();
  const terminal = runTerminalJourneys();
  return { golden, injection, terminal, coverage: summarizeInjectionCoverage(injection) };
}
