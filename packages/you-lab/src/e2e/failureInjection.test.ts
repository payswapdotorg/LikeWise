// Failure injection tests (W11C) — coverage: deterministic injected
// failures at EACH of the 20 launch-gate steps (the exhaustive fixture
// set); every injected failure is followed by its recovery (the
// recovery paths exercised); every journey record carries failedStep +
// the measured (seed-derived, simulated-labeled) durationMs (the
// JOURNEY LAW); the coverage summary is derived verbatim; terminal
// fixtures stop honestly; injected journeys replay byte-identically.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { JOURNEY_STEP_IDS } from "./journeySteps.js";
import {
  INJECTION_JOURNEY_FIXTURES,
  TERMINAL_JOURNEY_FIXTURES,
  runInjectionCoverageJourneys,
  runLaunchGateJourneySuite,
  runTerminalJourneys,
  summarizeInjectionCoverage,
} from "./failureInjection.js";
import { runJourney } from "./journeyHarness.js";

test("failure injection: the fixture set injects one recover-mode failure per launch-gate step (exhaustive)", () => {
  assert.equal(INJECTION_JOURNEY_FIXTURES.length, 20);
  const injectedSteps = INJECTION_JOURNEY_FIXTURES.map((fixture) => fixture.injection?.stepId);
  assert.deepEqual([...injectedSteps].sort(), [...JOURNEY_STEP_IDS].sort());
  for (const fixture of INJECTION_JOURNEY_FIXTURES) {
    assert.equal(fixture.injection?.mode, "recover");
  }
});

test("failure injection: every step's injected failure is followed by its recovery, and the journey completes", () => {
  const outcomes = runInjectionCoverageJourneys();
  assert.equal(outcomes.length, 20);
  for (const outcome of outcomes) {
    const injectedStep = outcome.spec.injection?.stepId;
    assert.ok(injectedStep);
    // JOURNEY LAW: the record names the failed-at step and carries the duration
    assert.equal(outcome.failedStep, injectedStep);
    assert.equal(outcome.journeyRecord.failedStep, injectedStep);
    assert.ok(outcome.durationMs > 0 && Number.isInteger(outcome.durationMs));
    assert.equal(outcome.journeyRecord.durationMs, outcome.durationMs);
    // the recovery path was exercised: failed -> recovered at the injected step
    const atStep = outcome.steps.filter((record) => record.stepId === injectedStep);
    assert.equal(atStep.length, 2, `${injectedStep}: one failed and one recovered record`);
    assert.equal(atStep[0]?.status, "failed");
    assert.equal(atStep[1]?.status, "recovered");
    assert.ok(atStep[0]?.detail.startsWith("detection:"), `${injectedStep}: the failed record carries the runbook detection text`);
    assert.ok(atStep[1]?.detail.startsWith("recovery:"), `${injectedStep}: the recovered record carries the runbook recovery text`);
    // the journey completed THROUGH the recovery (all 20 points; the drill still ran)
    assert.equal(outcome.stepsCompleted, 20);
    assert.equal(outcome.journeyRecord.stepsCompleted, 20);
  }
});

test("failure injection: the coverage summary is derived verbatim (all steps covered, all recoveries landed)", () => {
  const outcomes = runInjectionCoverageJourneys();
  const summary = summarizeInjectionCoverage(outcomes);
  assert.equal(summary.stepsCovered, 20);
  assert.deepEqual(summary.uncoveredSteps, []);
  assert.equal(summary.allInjectionsRecovered, true);
  assert.equal(summary.failedStepsRecorded, true);
  assert.equal(summary.exercisedIncidentClasses.length, 20, "one incident class per step exercised");
  // the summary is a derived projection: replaying derives the identical summary
  assert.deepEqual(summarizeInjectionCoverage(runInjectionCoverageJourneys()), summary);
});

test("failure injection: terminal fixtures stop honestly (failed-at recorded, prefix < 20)", () => {
  const [midJourney, drillTerminal] = runTerminalJourneys();
  assert.ok(midJourney && drillTerminal);
  assert.equal(TERMINAL_JOURNEY_FIXTURES.length, 2);
  // mid-journey terminal at step 6: 5 completed, journey stopped
  assert.equal(midJourney.stepsCompleted, 5);
  assert.equal(midJourney.failedStep, "evidence");
  assert.equal(midJourney.journeyRecord.stepsCompleted, 5);
  // terminal AT the drill step: 19 completed, the drill failed terminally
  assert.equal(drillTerminal.stepsCompleted, 19);
  assert.equal(drillTerminal.failedStep, "injected-failure-recovery");
  const last = drillTerminal.steps[drillTerminal.steps.length - 1];
  assert.equal(last?.status, "failed");
  // terminal failures are counted as NOT recovered in the coverage summary
  const summary = summarizeInjectionCoverage([midJourney, drillTerminal]);
  assert.equal(summary.allInjectionsRecovered, false);
  assert.equal(summary.failedStepsRecorded, true);
});

test("failure injection: injected journeys replay byte-identically from their seeds", () => {
  const outcomes = runInjectionCoverageJourneys();
  for (const outcome of outcomes) {
    assert.equal(canonicalJson(runJourney(outcome.spec)), canonicalJson(outcome));
  }
});

test("failure injection: the full launch-gate suite composes golden + injection + terminal with derived coverage", () => {
  const suite = runLaunchGateJourneySuite();
  assert.equal(suite.golden.length, 4);
  assert.equal(suite.injection.length, 20);
  assert.equal(suite.terminal.length, 2);
  assert.equal(suite.coverage.stepsCovered, 20);
  assert.deepEqual(suite.coverage.uncoveredSteps, []);
  const ids = [...suite.golden, ...suite.injection, ...suite.terminal].map((outcome) => outcome.spec.journeyId);
  assert.equal(new Set(ids).size, ids.length, "journey ids are unique across the suite");
});
