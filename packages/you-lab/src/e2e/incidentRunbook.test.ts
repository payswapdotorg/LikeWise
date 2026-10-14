// Incident runbook tests (W11C) — coverage: RUNBOOK LAW — every entry is
// exercised by at least one failure-injection journey or explicitly
// marked unexercised; the exercised flag is DERIVED from journey
// evidence (never asserted); the standard runbook over the launch-gate
// suite exercises the 20 step classes and leaves the two DR-plane
// classes explicitly unexercised; unbacked exercise claims are typed
// YOU_RUNBOOK_INVALID rejections; entry ids derive deterministically;
// entries are immutable.
import assert from "node:assert/strict";
import test from "node:test";
import {
  RUNBOOK_INVALID_CODE,
  RunbookInvalidError,
  assertExerciseClaimBacked,
  buildIncidentRunbook,
  buildIncidentRunbookEntry,
  incidentRunbookEntryId,
  incidentRunbookVersion,
  runbookExerciseEvidence,
  summarizeRunbookLaw,
} from "./incidentRunbook.js";
import { runGoldenJourneys, runJourney } from "./journeyHarness.js";
import { runLaunchGateJourneySuite } from "./failureInjection.js";

const SUITE = runLaunchGateJourneySuite();
const ALL_JOURNEYS = [...SUITE.golden, ...SUITE.injection, ...SUITE.terminal];

test("runbook: the standard runbook exercises the 20 step classes and explicitly marks the 2 DR-plane classes", () => {
  const runbook = buildIncidentRunbook(undefined, ALL_JOURNEYS);
  assert.equal(runbook.length, 22);
  const exercised = runbook.filter((entry) => entry.exercised);
  const unexercised = runbook.filter((entry) => !entry.exercised);
  assert.equal(exercised.length, 20, "every launch-gate incident class is exercised by an injected failure");
  assert.equal(unexercised.length, 2);
  assert.deepEqual(
    unexercised.map((entry) => entry.incidentClass).sort(),
    ["provider-region-outage", "retention-expiry-breach"],
    "the DR-plane classes are the honestly-unexercised entries",
  );
  // the unexercised entries say so IN their containment text (explicit marking, not silence)
  for (const entry of unexercised) {
    assert.ok(entry.containment.includes("unexercised"), `${entry.incidentClass}: the containment text marks it unexercised`);
  }
  // entries carry the authored texts 1:1
  for (const entry of runbook) {
    assert.ok(entry.detection.length > 0 && entry.containment.length > 0 && entry.recovery.length > 0);
    assert.equal(entry.simulated, true, "truth law: fixture runbook entries stay simulated");
    assert.match(entry.id, /^you_runbook_[0-9a-f]{16}$/);
  }
});

test("runbook: the RUNBOOK LAW summary reports exercised/unexercised counts verbatim", () => {
  const runbook = buildIncidentRunbook(undefined, ALL_JOURNEYS);
  const summary = summarizeRunbookLaw(runbook);
  assert.equal(summary.totalEntries, 22);
  assert.equal(summary.exercisedCount, 20);
  assert.equal(summary.unexercisedCount, 2);
  assert.deepEqual(summary.unexercisedClasses, ["provider-region-outage", "retention-expiry-breach"]);
  assert.deepEqual(summary.unexercisedStepClasses, [], "no launch-gate step class is left unexercised (no coverage gap)");
  // over ONLY golden journeys the drill class is exercised (the built-in drill), the rest are honestly unexercised
  const goldenOnly = summarizeRunbookLaw(buildIncidentRunbook(undefined, runGoldenJourneys()));
  assert.equal(goldenOnly.exercisedCount, 1);
  assert.equal(goldenOnly.unexercisedStepClasses.length, 19, "the golden set alone leaves 19 step classes unexercised (honest)");
});

test("runbook: exercised flags derive from journey evidence (drill journeys count; empty sets exercise nothing)", () => {
  const evidence = runbookExerciseEvidence(ALL_JOURNEYS);
  assert.deepEqual(evidence.get("evidence-capture-failed"), ["injection-evidence", "terminal-evidence"]);
  assert.ok(evidence.get("recovery-drill-failed")?.includes("golden-alpha"));
  assert.ok(evidence.get("recovery-drill-failed")?.includes("injection-injected-failure-recovery"));
  // with no journeys nothing is exercised (fail-closed default — never a free claim)
  const emptyRunbook = buildIncidentRunbookEntry("workspace-creation-failed", []);
  assert.equal(emptyRunbook.exercised, false);
  // the derivation is replayable
  assert.deepEqual(runbookExerciseEvidence(ALL_JOURNEYS), evidence);
});

test("runbook: unbacked exercise claims are typed YOU_RUNBOOK_INVALID rejections (never a silent pass)", () => {
  const honestEntry = buildIncidentRunbookEntry("provider-region-outage", ALL_JOURNEYS);
  assert.equal(honestEntry.exercised, false);
  assert.doesNotThrow(() => assertExerciseClaimBacked(honestEntry, ALL_JOURNEYS));
  const forged = { ...honestEntry, exercised: true };
  assert.throws(
    () => assertExerciseClaimBacked(forged, ALL_JOURNEYS),
    (error: unknown) =>
      error instanceof RunbookInvalidError &&
      error.code === RUNBOOK_INVALID_CODE &&
      /no backing failed-step record/.test(error.message),
  );
  // a backed claim passes the check
  const backed = buildIncidentRunbookEntry("render-job-failed", ALL_JOURNEYS);
  assert.equal(backed.exercised, true);
  assert.doesNotThrow(() => assertExerciseClaimBacked(backed, ALL_JOURNEYS));
});

test("runbook: malformed inputs are typed YOU_RUNBOOK_INVALID rejections", () => {
  assert.throws(
    () => buildIncidentRunbookEntry("", ALL_JOURNEYS),
    (error: unknown) => error instanceof RunbookInvalidError && error.code === RUNBOOK_INVALID_CODE && /empty incidentClass/.test(error.message),
  );
  assert.throws(
    () => buildIncidentRunbookEntry("cosmic-ray-flip", ALL_JOURNEYS),
    /outside the W11C authored vocabulary/,
  );
  assert.throws(
    () => buildIncidentRunbook(["render-job-failed", "render-job-failed"], ALL_JOURNEYS),
    /duplicate incident class 'render-job-failed'/,
  );
  // frozen entries: mutation attempts fail closed (Object.freeze semantics)
  const entry = buildIncidentRunbookEntry("render-job-failed", ALL_JOURNEYS);
  assert.throws(() => {
    (entry as { exercised: boolean }).exercised = false;
  }, /Cannot assign to read only property/);
});

test("runbook: entry ids derive deterministically and the build replays identically", () => {
  assert.equal(incidentRunbookEntryId("render-job-failed"), incidentRunbookEntryId("render-job-failed"));
  assert.match(incidentRunbookVersion(), /^you-lab-incident-runbook\/1/);
  const first = buildIncidentRunbook(undefined, ALL_JOURNEYS);
  const second = buildIncidentRunbook(undefined, [...runLaunchGateJourneySuite().injection]);
  assert.deepEqual(first, second, "the runbook build is deterministic over the same journey evidence");
  // a single injected journey exercises exactly its class
  const one = runJourney({
    journeyId: "runbook-single",
    seed: "you-lab-w11c-runbook-single",
    injection: { stepId: "edit", mode: "recover" },
  });
  assert.equal(buildIncidentRunbookEntry("edit-session-failed", [one]).exercised, true);
  assert.equal(buildIncidentRunbookEntry("render-job-failed", [one]).exercised, false);
});
