// E2E journey vocabulary tests (W11C) — coverage: the authored 20-point
// launch-gate step table matches the work order's 20 points EXACTLY (in
// order, by id), the ids are unique, the final point is the
// injected-failure-recovery drill, the incident-class vocabulary maps
// 1:1 onto the steps plus the two honestly-unexercisable DR-plane
// classes, and unknown steps/classes are typed YOU_E2E_JOURNEY_INVALID
// rejections.
import assert from "node:assert/strict";
import test from "node:test";
import {
  E2E_JOURNEY_INVALID_CODE,
  E2eJourneyInvalidError,
  INCIDENT_CLASSES,
  INCIDENT_CLASS_NAMES,
  JOURNEY_DRILL_STEP_ID,
  JOURNEY_STEPS,
  JOURNEY_STEP_IDS,
  LAUNCH_GATE_JOURNEY_LENGTH,
  UNEXERCISABLE_INCIDENT_CLASSES,
  assertKnownJourneyStep,
  incidentClassForStep,
  incidentClassSpec,
  journeyStepById,
  journeyStepIndex,
} from "./journeySteps.js";

test("journey steps: the authored table is the work order's 20-point launch-gate journey in exact order", () => {
  assert.equal(JOURNEY_STEPS.length, 20);
  assert.equal(LAUNCH_GATE_JOURNEY_LENGTH, 20);
  assert.deepEqual(JOURNEY_STEP_IDS, [
    "workspace-creation",
    "intent",
    "solution",
    "inspect",
    "feedback",
    "evidence",
    "twin",
    "improve",
    "performance",
    "render",
    "edit",
    "import-export",
    "version-accept",
    "learn-with-permission",
    "repeat",
    "capability-gap",
    "arena-escalation",
    "expert-result",
    "provenance-consent",
    "injected-failure-recovery",
  ]);
  for (const step of JOURNEY_STEPS) {
    assert.equal(step.stepIndex, JOURNEY_STEPS.indexOf(step) + 1, `${step.stepId} carries its 1-based position`);
    assert.ok(step.description.length > 0, `${step.stepId} has a description`);
  }
  assert.equal(new Set(JOURNEY_STEP_IDS).size, 20, "step ids are unique");
  assert.equal(JOURNEY_STEPS[19]?.stepId, JOURNEY_DRILL_STEP_ID, "the 20th point is the injected-failure-recovery drill");
});

test("journey steps: lookups and the fail-closed unknown-step rejection", () => {
  assert.equal(journeyStepById("evidence")?.stepIndex, 6);
  assert.equal(journeyStepById("not-a-step"), null);
  assert.equal(journeyStepIndex("provenance-consent"), 19);
  assert.equal(journeyStepIndex("not-a-step"), 0);
  assert.deepEqual(assertKnownJourneyStep("twin"), journeyStepById("twin"));
  assert.throws(
    () => assertKnownJourneyStep("spirit-journey"),
    (error: unknown) =>
      error instanceof E2eJourneyInvalidError &&
      error.code === E2E_JOURNEY_INVALID_CODE &&
      /unknown journey step 'spirit-journey'/.test(error.message),
  );
});

test("journey steps: every launch-gate step has exactly one incident class, and the vocabulary is closed", () => {
  assert.equal(INCIDENT_CLASSES.length, 22);
  assert.equal(new Set(INCIDENT_CLASS_NAMES).size, 22, "incident classes are unique");
  const stepClasses = INCIDENT_CLASSES.filter((entry) => entry.stepId !== null);
  assert.equal(stepClasses.length, 20, "one failure class per launch-gate step");
  for (const stepId of JOURNEY_STEP_IDS) {
    assert.ok(incidentClassForStep(stepId), `step '${stepId}' has an incident class`);
  }
  // the two non-suffixed names are honest: the drill's own failure and the gap-detection class
  assert.equal(incidentClassForStep("injected-failure-recovery"), "recovery-drill-failed");
  assert.equal(incidentClassForStep("capability-gap"), "capability-gap-detected");
  for (const entry of stepClasses) {
    assert.equal(incidentClassForStep(entry.stepId!), entry.incidentClass, "the step mapping is 1:1");
  }
  assert.equal(incidentClassSpec("provider-region-outage")?.stepId, null);
  assert.equal(incidentClassSpec("not-a-class"), null);
  assert.deepEqual(UNEXERCISABLE_INCIDENT_CLASSES, ["provider-region-outage", "retention-expiry-breach"]);
});

test("journey steps: the runbook text table covers every incident class (no empty legs)", async () => {
  // re-imported here to keep the vocabulary test self-contained
  const { INCIDENT_RUNBOOK_TEXTS } = await import("./incidentRunbook.js");
  for (const incidentClass of INCIDENT_CLASS_NAMES) {
    const texts = INCIDENT_RUNBOOK_TEXTS[incidentClass];
    assert.ok(texts, `class '${incidentClass}' has runbook texts`);
    assert.ok(texts.detection.length > 0, `${incidentClass}: detection text non-empty`);
    assert.ok(texts.containment.length > 0, `${incidentClass}: containment text non-empty`);
    assert.ok(texts.recovery.length > 0, `${incidentClass}: recovery text non-empty`);
  }
  assert.equal(Object.keys(INCIDENT_RUNBOOK_TEXTS).length, INCIDENT_CLASS_NAMES.length, "no stray text entries");
});
