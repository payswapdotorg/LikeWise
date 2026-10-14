// Journey fidelity scorer (W11C).
//
// Deterministic scoring of one journey outcome's RECORD FIDELITY — how
// completely and honestly the run records the JOURNEY LAW's demands —
// computed fixture objectives over the harness output (the same style as
// the arena/render scorers: deterministic arithmetic, labeled computed,
// never a user study and never a claim about the real product). The five
// parts:
//
// 1. stepsRecorded — the recorded step set matches the authored
//    expectation exactly (all 20 points, or the honest prefix through
//    the failed-at step for terminal runs);
// 2. orderingCorrect — the step records appear in the frozen
//    launch-gate order (nondecreasing stepIndex, no gaps);
// 3. durationsPresent — every transition carries a finite non-negative
//    integer duration and the total is the exact sum;
// 4. journeyLawFields — stepsCompleted/failedStep agree with the
//    records (a null failedStep implies all 20 completed; a non-null
//    failedStep names a real failed transition);
// 5. recoveryPathsExercised — every failed transition is followed by
//    its recovery for the same step (the terminal-mode last record is
//    the one honest exception) and the step-20 drill ran in every
//    non-terminal journey.
//
// Golden and recover-mode journeys score 1.0; a terminal journey scores
// 0.8 (its recovery path is honestly NOT exercised — the score shows
// it, never hides it).

import { JOURNEY_DRILL_STEP_ID, JOURNEY_STEP_IDS } from "./journeySteps.js";
import type { JourneyStepRecord, NeutralJourneyOutcome } from "./journeyHarness.js";

/** Scorer version label (honest provenance wiring). */
export const SCORER_JOURNEY_VERSION = "you-lab-journey-scorer/1";

/** The five fidelity parts (each 0 or 1) plus the computed mean. */
export interface JourneyFidelityParts {
  readonly stepsRecorded: number;
  readonly orderingCorrect: number;
  readonly durationsPresent: number;
  readonly journeyLawFields: number;
  readonly recoveryPathsExercised: number;
  /** Mean of the five parts (deterministic arithmetic, rounded to 4 decimals). */
  readonly fidelityScore: number;
}

/** The expected recorded step sequence for an outcome (prefix through the terminal failed-at step). */
function expectedStepSequence(outcome: NeutralJourneyOutcome): readonly string[] {
  if (outcome.spec.injection !== null && outcome.spec.injection.mode === "terminal") {
    const failedIndex = JOURNEY_STEP_IDS.indexOf(outcome.spec.injection.stepId);
    return JOURNEY_STEP_IDS.slice(0, failedIndex + 1);
  }
  return JOURNEY_STEP_IDS;
}

/** The set of distinct steps whose last record is completed or recovered. */
function completedStepIds(records: readonly JourneyStepRecord[]): readonly string[] {
  const lastStatus = new Map<string, JourneyStepRecord["status"]>();
  for (const record of records) {
    lastStatus.set(record.stepId, record.status);
  }
  return [...lastStatus.entries()]
    .filter(([, status]) => status === "completed" || status === "recovered")
    .map(([stepId]) => stepId)
    .sort();
}

/**
 * Score one journey outcome's record fidelity (deterministic computed
 * fixture objective — see the module docs for the five parts).
 */
export function scoreJourneyRun(outcome: NeutralJourneyOutcome): JourneyFidelityParts {
  const expected = expectedStepSequence(outcome);
  const recordedIds = [...new Set(outcome.steps.map((record) => record.stepId))].sort();
  const expectedSorted = [...expected].sort();
  const stepsRecorded =
    recordedIds.length === expectedSorted.length && recordedIds.every((id, i) => id === expectedSorted[i]) ? 1 : 0;

  const orderedNondecreasing = outcome.steps.every(
    (record, i) => i === 0 || record.stepIndex >= (outcome.steps[i - 1]?.stepIndex ?? 0),
  );
  const expectedOrder = expected.join("|");
  const recordedOrder = [...new Set(outcome.steps.map((record) => record.stepId))].join("|");
  const orderingCorrect = orderedNondecreasing && expectedOrder === recordedOrder ? 1 : 0;

  const durationsValid = outcome.steps.every(
    (record) => Number.isFinite(record.durationMs) && Number.isInteger(record.durationMs) && record.durationMs >= 0,
  );
  const sum = outcome.steps.reduce((total, record) => total + record.durationMs, 0);
  const durationsPresent = durationsValid && sum === outcome.durationMs ? 1 : 0;

  const completed = completedStepIds(outcome.steps);
  const failedRecords = outcome.steps.filter((record) => record.status === "failed");
  const lawFields =
    completed.length === outcome.stepsCompleted &&
    outcome.failedStep === (outcome.spec.injection?.stepId ?? null) &&
    (outcome.failedStep === null
      ? outcome.stepsCompleted === JOURNEY_STEP_IDS.length
      : failedRecords.some((record) => record.stepId === outcome.failedStep))
      ? 1
      : 0;

  const isTerminal = outcome.spec.injection !== null && outcome.spec.injection.mode === "terminal";
  const recoveriesFollow = outcome.steps.every((record, i) => {
    if (record.status !== "failed") {
      return true;
    }
    const next = outcome.steps[i + 1];
    return next !== undefined && next.status === "recovered" && next.stepId === record.stepId;
  });
  const drillPresent =
    outcome.steps.some((record) => record.stepId === JOURNEY_DRILL_STEP_ID && record.status === "failed") &&
    outcome.steps.some((record) => record.stepId === JOURNEY_DRILL_STEP_ID && record.status === "recovered");
  // A terminal journey honestly fails this part: its recovery path was NOT
  // exercised (the failed-at branch records the stop, not a recovery).
  const recoveryPathsExercised = !isTerminal && recoveriesFollow && drillPresent ? 1 : 0;

  const parts = [stepsRecorded, orderingCorrect, durationsPresent, lawFields, recoveryPathsExercised];
  const score = Math.round((parts.reduce((total, part) => total + part, 0) / parts.length) * 10_000) / 10_000;
  return {
    stepsRecorded,
    orderingCorrect,
    durationsPresent,
    journeyLawFields: lawFields,
    recoveryPathsExercised,
    fidelityScore: score,
  };
}
