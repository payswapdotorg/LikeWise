// E2E journey harness tests (W11C) — coverage: JOURNEY LAW — the
// deterministic 20-point launch-gate journey records every step
// (completed or failed-at) with seed-derived simulated duration; golden
// journeys complete all 20 points with failedStep null and the step-20
// drill recorded; replay from the same seed is byte-identical
// (canonical JSON); different seeds derive different durations; the
// journey-record identity is a pure function of the spec; malformed
// specs are typed YOU_E2E_JOURNEY_INVALID rejections.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import {
  E2E_JOURNEY_INVALID_CODE,
  E2eJourneyInvalidError,
  JOURNEY_STEP_IDS,
} from "./journeySteps.js";
import {
  GOLDEN_JOURNEY_FIXTURES,
  JOURNEY_FIXTURE_SET_VERSION,
  JOURNEY_RUN_SUBMITTED_AT,
  journeyRecordId,
  recoveryDurationMs,
  runGoldenJourneys,
  runJourney,
  stepDurationMs,
  toJourneyRunObservations,
  type JourneySpec,
} from "./journeyHarness.js";
import { runTerminalJourneys } from "./failureInjection.js";
import { scoreJourneyRun, SCORER_JOURNEY_VERSION } from "./journeyScorer.js";

const GOLDEN_SPEC: JourneySpec = { journeyId: "golden-alpha", seed: "you-lab-w11c-golden-alpha", injection: null };

test("journey harness: a golden journey records all 20 points with the step-20 drill and failedStep null", () => {
  const outcome = runJourney(GOLDEN_SPEC);
  assert.equal(outcome.stepsCompleted, 20);
  assert.equal(outcome.failedStep, null);
  assert.equal(outcome.simulated, true);
  assert.equal(outcome.journeyRecord.simulated, true, "truth law: the simulated label is carried on the record");
  // every step is recorded in launch-gate order
  const recordedIds = [...new Set(outcome.steps.map((record) => record.stepId))];
  assert.deepEqual(recordedIds, JOURNEY_STEP_IDS);
  // steps 1-19 completed once; step 20 is the drill (failed then recovered)
  const drillRecords = outcome.steps.filter((record) => record.stepId === "injected-failure-recovery");
  assert.equal(drillRecords.length, 2);
  assert.equal(drillRecords[0]?.status, "failed");
  assert.equal(drillRecords[0]?.incidentClass, "recovery-drill-failed");
  assert.equal(drillRecords[1]?.status, "recovered");
  const plain = outcome.steps.filter((record) => record.stepId === "intent");
  assert.equal(plain.length, 1);
  assert.equal(plain[0]?.status, "completed");
  assert.equal(plain[0]?.incidentClass, null);
  // durations: seed-derived, positive integers; total is the exact sum
  for (const record of outcome.steps) {
    assert.ok(Number.isInteger(record.durationMs) && record.durationMs > 0, `${record.stepId}: positive integer duration`);
  }
  assert.equal(outcome.durationMs, outcome.steps.reduce((sum, record) => sum + record.durationMs, 0));
  assert.equal(outcome.journeyRecord.stepsCompleted, 20);
  assert.equal(outcome.journeyRecord.failedStep, null);
  assert.equal(outcome.journeyRecord.durationMs, outcome.durationMs);
  assert.match(outcome.journeyRecord.id, /^you_journey_[0-9a-f]{16}$/);
  // honest notes: simulated durations, never a wall-clock claim
  assert.ok(outcome.notes.some((note) => note.includes("never a wall-clock measurement")));
});

test("journey harness: byte-identical replay from the seed (golden, injected and terminal journeys)", () => {
  for (const outcome of [runJourney(GOLDEN_SPEC), ...runTerminalJourneys()]) {
    const replay = runJourney(outcome.spec);
    assert.equal(canonicalJson(replay), canonicalJson(outcome), `${outcome.spec.journeyId}: canonical JSON byte-identical`);
    assert.deepEqual(replay, outcome);
  }
  const injected = runJourney({
    journeyId: "replay-injection",
    seed: "you-lab-w11c-replay-injection",
    injection: { stepId: "render", mode: "recover" },
  });
  assert.equal(canonicalJson(runJourney(injected.spec)), canonicalJson(injected));
});

test("journey harness: different seeds derive different journeys (the seed actually drives the run)", () => {
  const outcomes = runGoldenJourneys();
  assert.equal(outcomes.length, 4);
  const durations = new Set(outcomes.map((outcome) => outcome.durationMs));
  assert.ok(durations.size > 1, `golden fixtures derive distinct durations (got ${[...durations].join(",")})`);
  const alpha = stepDurationMs("you-lab-w11c-golden-alpha", "intent");
  const beta = stepDurationMs("you-lab-w11c-golden-beta", "intent");
  assert.notEqual(alpha, beta);
  assert.ok(stepDurationMs("s", "intent") >= 120 && stepDurationMs("s", "intent") <= 600);
  assert.ok(recoveryDurationMs("s", "intent") >= 200 && recoveryDurationMs("s", "intent") <= 1000);
  // the duration derivation is a pure function of (seed, step)
  assert.equal(stepDurationMs("k", "render"), stepDurationMs("k", "render"));
});

test("journey harness: the golden fixture set is pinned and its records are deterministic", () => {
  assert.equal(GOLDEN_JOURNEY_FIXTURES.length, 4);
  assert.equal(JOURNEY_FIXTURE_SET_VERSION, "you-lab-e2e-journey-fixtures/1");
  assert.equal(JOURNEY_RUN_SUBMITTED_AT, "2026-10-15T12:00:00Z");
  const first = runGoldenJourneys();
  const second = runGoldenJourneys();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(first.map((outcome) => outcome.spec.journeyId), ["golden-alpha", "golden-beta", "golden-gamma", "golden-delta"]);
  // the record id is a pure function of the spec
  for (const outcome of first) {
    assert.equal(outcome.journeyRecord.id, journeyRecordId(outcome.spec));
  }
  assert.notEqual(journeyRecordId(GOLDEN_SPEC), journeyRecordId({ ...GOLDEN_SPEC, journeyId: "golden-beta" }));
});

test("journey harness: the terminal mode records the honest prefix and stops at the failed-at step (JOURNEY LAW)", () => {
  const terminal = runJourney({
    journeyId: "terminal-evidence",
    seed: "you-lab-w11c-terminal-evidence",
    injection: { stepId: "evidence", mode: "terminal" },
  });
  assert.equal(terminal.stepsCompleted, 5, "the honest prefix is 5 completed steps before the failed-at step 6");
  assert.equal(terminal.failedStep, "evidence");
  assert.equal(terminal.journeyRecord.stepsCompleted, 5);
  assert.equal(terminal.journeyRecord.failedStep, "evidence");
  // the journey stopped: no records after the failed step
  const last = terminal.steps[terminal.steps.length - 1];
  assert.equal(last?.stepId, "evidence");
  assert.equal(last?.status, "failed");
  assert.equal(last?.incidentClass, "evidence-capture-failed");
  assert.ok(last?.detail.includes("terminal injection"));
  // the drill at step 20 never ran (the journey honestly stopped)
  assert.equal(terminal.steps.some((record) => record.stepId === "injected-failure-recovery"), false);
});

test("journey harness: malformed specs are typed YOU_E2E_JOURNEY_INVALID rejections", () => {
  assert.throws(
    () => runJourney({ journeyId: "", seed: "s", injection: null }),
    (error: unknown) => error instanceof E2eJourneyInvalidError && error.code === E2E_JOURNEY_INVALID_CODE && /journeyId is empty/.test(error.message),
  );
  assert.throws(
    () => runJourney({ journeyId: "j", seed: "", injection: null }),
    /seed is empty/,
  );
  assert.throws(
    () => runJourney({ journeyId: "j", seed: "s", injection: { stepId: "not-a-step", mode: "recover" } }),
    /unknown journey step 'not-a-step'/,
  );
  assert.throws(
    () => runJourney({ journeyId: "j", seed: "s", injection: { stepId: "intent", mode: "sometimes" as never } }),
    /injection mode 'sometimes' is invalid/,
  );
});

test("journey harness: run observations carry the honest not-measured markers", () => {
  const observations = toJourneyRunObservations(runJourney(GOLDEN_SPEC));
  assert.equal(observations.simulated, true);
  assert.equal(observations["durationMs.measured"], false);
  assert.equal(observations["durationMs.simulated"], true);
  assert.equal(observations.stepsCompleted, 20);
  assert.equal(observations.journeyId, "golden-alpha");
  assert.equal(observations.failedStep, "none");
  assert.ok(typeof observations.stepRecords === "number" && observations.stepRecords === 21);
});

// ---------------------------------------------------------------------------
// Golden journey scores (the deterministic record-fidelity scorer)
// ---------------------------------------------------------------------------

test("journey scorer: golden and recovered journeys score a perfect 1.0; terminal journeys honestly score lower", () => {
  assert.match(SCORER_JOURNEY_VERSION, /^you-lab-journey-scorer\/1/);
  for (const golden of runGoldenJourneys()) {
    const parts = scoreJourneyRun(golden);
    assert.equal(parts.stepsRecorded, 1);
    assert.equal(parts.orderingCorrect, 1);
    assert.equal(parts.durationsPresent, 1);
    assert.equal(parts.journeyLawFields, 1);
    assert.equal(parts.recoveryPathsExercised, 1);
    assert.equal(parts.fidelityScore, 1, `golden ${golden.spec.journeyId} scores 1.0`);
  }
  const recovered = runJourney({
    journeyId: "score-recovered",
    seed: "you-lab-w11c-score-recovered",
    injection: { stepId: "performance", mode: "recover" },
  });
  assert.equal(scoreJourneyRun(recovered).fidelityScore, 1, "a recovered injection journey is a complete record");
  // a terminal journey honestly fails the recovery part (0.8 — the failure is shown, never hidden)
  const [terminal] = runTerminalJourneys();
  assert.ok(terminal);
  const terminalParts = scoreJourneyRun(terminal);
  assert.equal(terminalParts.stepsRecorded, 1, "the honest prefix through the failed-at step is fully recorded");
  assert.equal(terminalParts.orderingCorrect, 1);
  assert.equal(terminalParts.durationsPresent, 1);
  assert.equal(terminalParts.journeyLawFields, 1);
  assert.equal(terminalParts.recoveryPathsExercised, 0, "the terminal failure was NOT recovered — the score shows it");
  assert.equal(terminalParts.fidelityScore, 0.8);
  // scores are deterministic (double-run equality)
  for (const outcome of [...runGoldenJourneys(), ...runTerminalJourneys()]) {
    assert.deepEqual(scoreJourneyRun(outcome), scoreJourneyRun(outcome));
  }
});
