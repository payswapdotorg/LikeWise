// Deterministic E2E journey harness (W11C).
//
// JOURNEY LAW (docs/you/CONTRACTS.md "Wave-11 contract freeze (v11)"):
// the 20-point launch-gate journey records every step (completed or
// failed-at) with measured duration; simulated runs stay labeled.
//
// This module runs the 20-point launch-gate journey (the authored table
// in ./journeySteps.ts) as a deterministic, seed-derived simulation: no
// clock, no Math.random, no network — every step duration and every
// recovery duration is a pure function of (seed, stepId), so replaying
// the same journey spec replays byte-identical step records (asserted by
// the scorer and the conformance audit via double-run comparison).
//
// The final launch-gate point (injected-failure-recovery) is the
// journey's own drill: every non-terminal journey exercises an injected
// failure and its recovery there as step content. An EXPLICIT injection
// spec additionally fails any chosen step — in "recover" mode the step
// fails and then recovers through its runbook recovery path (the journey
// continues; the journey record names the failed-at step); in
// "terminal" mode the failure is not recovered and the journey stops at
// the failed-at step (stepsCompleted records the honest prefix).
//
// durationMs is a seed-derived SIMULATED measurement (never a wall-clock
// claim — the fixture laws ban performance.now and the record carries
// simulated: true, the JOURNEY LAW's simulated-runs-stay-labeled clause).
//
// The neutral E2eJourneyRecord shape is aligned 1:1 with the frozen v11
// E2eJourneyRecord; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts.

import { canonicalJson } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import {
  E2eJourneyInvalidError,
  JOURNEY_STEPS,
  JOURNEY_DRILL_STEP_ID,
  assertKnownJourneyStep,
  incidentClassForStep,
} from "./journeySteps.js";
import { INCIDENT_RUNBOOK_TEXTS } from "./incidentRunbook.js";

/** Fixed fixture-mode run timestamp (FIXTURES.md law: no clock). */
export const JOURNEY_RUN_SUBMITTED_AT = "2026-10-15T12:00:00Z";

/** The W11C journey fixture-set version (golden + injection + terminal fixtures). */
export const JOURNEY_FIXTURE_SET_VERSION = "you-lab-e2e-journey-fixtures/1";

/** Step transition states (the JOURNEY LAW's completed-or-failed-at vocabulary plus recovery). */
export type JourneyStepStatus = "completed" | "failed" | "recovered";

/** One recorded step transition of a journey run. */
export interface JourneyStepRecord {
  /** 1-based position in the frozen launch-gate order. */
  readonly stepIndex: number;
  readonly stepId: string;
  readonly status: JourneyStepStatus;
  /** The incident class naming the failure mode (non-null on failed/recovered transitions, null on plain completions). */
  readonly incidentClass: string | null;
  /** Seed-derived simulated duration of THIS transition in ms (integer, >= 0). */
  readonly durationMs: number;
  /** Deterministic description (authored step text, or the runbook detection/recovery text on failure/recovery). */
  readonly detail: string;
}

/** Failure-injection mode: "recover" fails then recovers the step; "terminal" fails and stops the journey. */
export type JourneyInjectionMode = "recover" | "terminal";

/** An explicit failure injection at one launch-gate step. */
export interface JourneyInjectionSpec {
  readonly stepId: string;
  readonly mode: JourneyInjectionMode;
}

/** One journey run specification — the seed fully determines the run. */
export interface JourneySpec {
  readonly journeyId: string;
  readonly seed: string;
  /** Explicit failure injection (null for the golden reference path — the step-20 drill still runs). */
  readonly injection: JourneyInjectionSpec | null;
}

/** Neutral journey record — aligned 1:1 with the frozen v11 E2eJourneyRecord. */
export interface NeutralE2eJourneyRecord {
  readonly id: string;
  readonly journeyId: string;
  /** Steps that reached a completed state (a recovered step counts as completed through its recovery). */
  readonly stepsCompleted: number;
  /** The step where an injected failure occurred (null on the golden reference path). */
  readonly failedStep: string | null;
  /** Seed-derived simulated total duration in ms (sum of all transition durations). */
  readonly durationMs: number;
  readonly simulated: boolean;
}

/** The full outcome of one journey run (the step records ARE the JOURNEY LAW evidence). */
export interface NeutralJourneyOutcome {
  readonly spec: JourneySpec;
  readonly steps: readonly JourneyStepRecord[];
  readonly stepsCompleted: number;
  readonly failedStep: string | null;
  readonly durationMs: number;
  readonly journeyRecord: NeutralE2eJourneyRecord;
  readonly notes: readonly string[];
  readonly simulated: boolean;
}

const STEP_BASE_DURATION_MS = 120;
const STEP_DURATION_SPAN_MS = 480;
const RECOVERY_BASE_DURATION_MS = 200;
const RECOVERY_DURATION_SPAN_MS = 800;

/** Seed-derived simulated step duration (integer ms — pure function of seed and step). */
export function stepDurationMs(seed: string, stepId: string): number {
  return STEP_BASE_DURATION_MS + Math.round(unitFrom(seed, stepId, "duration") * STEP_DURATION_SPAN_MS);
}

/** Seed-derived simulated recovery duration (integer ms — pure function of seed and step). */
export function recoveryDurationMs(seed: string, stepId: string): number {
  return RECOVERY_BASE_DURATION_MS + Math.round(unitFrom(seed, stepId, "recovery") * RECOVERY_DURATION_SPAN_MS);
}

/** Deterministic journey-record id for a spec — you_journey_<16hex>. */
export function journeyRecordId(spec: JourneySpec): string {
  return `you_journey_${sha256Hex(`${spec.journeyId}|${canonicalJson(spec)}`).slice(0, 16)}`;
}

/** Fail-closed journey-spec validation (JOURNEY LAW — malformed specs are never guessed into a run). */
function assertValidJourneySpec(spec: JourneySpec): void {
  if (spec.journeyId.length === 0) {
    throw new E2eJourneyInvalidError("journeyId is empty (a journey names itself)");
  }
  if (spec.seed.length === 0) {
    throw new E2eJourneyInvalidError(`journey '${spec.journeyId}': seed is empty (the run is seed-derived — no seed, no run)`);
  }
  if (spec.injection !== null) {
    assertKnownJourneyStep(spec.injection.stepId);
    if (spec.injection.mode !== "recover" && spec.injection.mode !== "terminal") {
      throw new E2eJourneyInvalidError(
        `journey '${spec.journeyId}': injection mode '${String(spec.injection.mode)}' is invalid (recover or terminal)`,
      );
    }
  }
}

/**
 * Run one journey from its spec — the deterministic 20-point
 * launch-gate simulation. Every step is recorded (completed, or
 * failed-at followed by its recovery, or failed-at terminally); the
 * step-20 drill (injected-failure-recovery) runs as journey content in
 * every non-terminal journey. Byte-identical replay from the same spec.
 */
export function runJourney(spec: JourneySpec): NeutralJourneyOutcome {
  assertValidJourneySpec(spec);
  const records: JourneyStepRecord[] = [];
  for (const step of JOURNEY_STEPS) {
    const incidentClass = incidentClassForStep(step.stepId);
    if (incidentClass === null) {
      throw new E2eJourneyInvalidError(
        `journey '${spec.journeyId}': step '${step.stepId}' has no authored incident class (the vocabulary table is inconsistent)`,
      );
    }
    const texts = INCIDENT_RUNBOOK_TEXTS[incidentClass];
    if (!texts) {
      throw new E2eJourneyInvalidError(
        `journey '${spec.journeyId}': incident class '${incidentClass}' has no authored runbook texts (the runbook table is inconsistent)`,
      );
    }
    const injection = spec.injection;
    const explicitlyInjected = injection !== null && injection.stepId === step.stepId;
    const isDrill = step.stepId === JOURNEY_DRILL_STEP_ID;
    if (explicitlyInjected && injection !== null && injection.mode === "terminal") {
      records.push({
        stepIndex: step.stepIndex,
        stepId: step.stepId,
        status: "failed",
        incidentClass,
        durationMs: stepDurationMs(spec.seed, step.stepId),
        detail: `detection: ${texts.detection} (terminal injection — the journey stops at this step)`,
      });
      break;
    }
    if (explicitlyInjected || isDrill) {
      const label = explicitlyInjected ? "injected failure" : "drill";
      records.push({
        stepIndex: step.stepIndex,
        stepId: step.stepId,
        status: "failed",
        incidentClass,
        durationMs: stepDurationMs(spec.seed, step.stepId),
        detail: `detection: ${texts.detection} (${label} at step ${step.stepIndex})`,
      });
      records.push({
        stepIndex: step.stepIndex,
        stepId: step.stepId,
        status: "recovered",
        incidentClass,
        durationMs: recoveryDurationMs(spec.seed, step.stepId),
        detail: `recovery: ${texts.recovery} (${label} recovered at step ${step.stepIndex})`,
      });
    } else {
      records.push({
        stepIndex: step.stepIndex,
        stepId: step.stepId,
        status: "completed",
        incidentClass: null,
        durationMs: stepDurationMs(spec.seed, step.stepId),
        detail: `${step.description} (completed at step ${step.stepIndex})`,
      });
    }
  }
  // stepsCompleted: steps whose LAST record is completed or recovered (the
  // terminal failed-at step is honestly NOT completed).
  const lastStatusByStep = new Map<string, JourneyStepStatus>();
  for (const record of records) {
    lastStatusByStep.set(record.stepId, record.status);
  }
  let stepsCompleted = 0;
  for (const status of lastStatusByStep.values()) {
    if (status === "completed" || status === "recovered") {
      stepsCompleted += 1;
    }
  }
  const failedStep = spec.injection === null ? null : spec.injection.stepId;
  const durationMs = records.reduce((sum, record) => sum + record.durationMs, 0);
  const journeyRecord: NeutralE2eJourneyRecord = {
    id: journeyRecordId(spec),
    journeyId: spec.journeyId,
    stepsCompleted,
    failedStep,
    durationMs,
    simulated: true,
  };
  const notes = [
    "journey steps, the step-20 drill and every recovery are deterministic seed-derived simulations (fixture law: no clock, no Math.random, no network)",
    "durationMs is a seed-derived simulated measurement, never a wall-clock measurement (the record's simulated: true label marks it — the JOURNEY LAW's simulated-runs-stay-labeled clause)",
    "the final launch-gate point (injected-failure-recovery) is a built-in drill: every non-terminal journey exercises an injected failure and its recovery there as step content",
    "an explicit injection records the failed-at step on the journey record (failedStep); the built-in drill does not (it is the reference path's own content)",
  ];
  return {
    spec,
    steps: records,
    stepsCompleted,
    failedStep,
    durationMs,
    journeyRecord,
    notes,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Golden journey fixtures — the reference path (seed-derived, no network)
// ---------------------------------------------------------------------------

/** One journey fixture (a spec template for the standard runs). */
export interface JourneyFixture {
  readonly journeyId: string;
  readonly seed: string;
  readonly injection: JourneyInjectionSpec | null;
}

/** The golden reference journeys: the 20-point path with no explicit injection (the drill still runs). */
export const GOLDEN_JOURNEY_FIXTURES: readonly JourneyFixture[] = [
  { journeyId: "golden-alpha", seed: "you-lab-w11c-golden-alpha", injection: null },
  { journeyId: "golden-beta", seed: "you-lab-w11c-golden-beta", injection: null },
  { journeyId: "golden-gamma", seed: "you-lab-w11c-gamma-seed", injection: null },
  { journeyId: "golden-delta", seed: "you-lab-w11c-delta-seed", injection: null },
];

/** Run the golden reference journeys (byte-identical replay from their seeds). */
export function runGoldenJourneys(): readonly NeutralJourneyOutcome[] {
  return GOLDEN_JOURNEY_FIXTURES.map((fixture) =>
    runJourney({ journeyId: fixture.journeyId, seed: fixture.seed, injection: fixture.injection }),
  );
}

/** Honest journey-run observations (structured not-measured markers for the seam). */
export function toJourneyRunObservations(
  outcome: NeutralJourneyOutcome,
): Readonly<Record<string, string | number | boolean>> {
  return {
    journeyId: outcome.spec.journeyId,
    stepRecords: outcome.steps.length,
    stepsCompleted: outcome.stepsCompleted,
    failedStep: outcome.failedStep ?? "none",
    durationMs: outcome.durationMs,
    "durationMs.measured": false,
    "durationMs.simulated": true,
    simulated: true,
  };
}
