import assert from "node:assert/strict";
import test from "node:test";
import type { E2eJourneyRecord, LaunchGateChecklistRecord } from "./contract.js";
import {
  LAUNCH_GATE_CHECKLIST_LENGTH,
  LAUNCH_GATE_JOURNEY_LENGTH,
  LAUNCH_GATE_POINTS,
  constructLaunchGateChecklistRecord,
  isCompleteLaunchGateChecklist,
  isSuccessfulJourneyRecord,
  launchGatePassedCount,
  launchGatePasses,
  validateJourneyEvidence,
  validateLaunchGateChecklistIntake,
} from "./launchGate.js";

function goldenJourney(index: number): E2eJourneyRecord {
  return {
    id: `you_journey_golden-${String(index + 1).padStart(2, "0")}_0000000000000001`,
    journeyId: `golden-${String(index + 1).padStart(2, "0")}`,
    stepsCompleted: LAUNCH_GATE_JOURNEY_LENGTH,
    failedStep: null,
    durationMs: 120 + index,
    simulated: true,
  };
}

function goldenIntake(): (E2eJourneyRecord | null)[] {
  return Array.from({ length: LAUNCH_GATE_CHECKLIST_LENGTH }, (_, index) => goldenJourney(index));
}

test("the canonical 20-point launch-gate table is frozen in exact order (the W11C journey vocabulary mirrored)", () => {
  assert.equal(LAUNCH_GATE_POINTS.length, 20);
  assert.equal(LAUNCH_GATE_CHECKLIST_LENGTH, 20);
  assert.equal(LAUNCH_GATE_JOURNEY_LENGTH, 20);
  assert.deepEqual(
    LAUNCH_GATE_POINTS.map((spec) => [spec.point, spec.stepId, spec.description]),
    [
      [1, "workspace-creation", "the workspace is created for the journey actor"],
      [2, "intent", "the actor's intent is captured and validated"],
      [3, "solution", "the first Solution version is composed from the intent"],
      [4, "inspect", "the actor inspects the Solution state snapshot"],
      [5, "feedback", "the actor submits a feedback request on the inspected state"],
      [6, "evidence", "evidence is captured for the open feedback request"],
      [7, "twin", "the Twin version is published from the bound evidence"],
      [8, "improve", "the Twin is improved from its recorded deficiencies"],
      [9, "performance", "the Performance timeline is published from the improved Twin"],
      [10, "render", "the render job produces its reviewed artifact"],
      [11, "edit", "the edit session proposes a change set on the rendered state"],
      [12, "import-export", "the editing round-trip import/export completes"],
      [13, "version-accept", "the candidate version is accepted as the new canonical version"],
      [14, "learn-with-permission", "learning records are validated under the recorded learning rights"],
      [15, "repeat", "the improved path is re-run end-to-end (the repeat point)"],
      [16, "capability-gap", "a capability gap is detected and recorded on the repeat path"],
      [17, "arena-escalation", "the recorded gap escalates to the Arena under its authorization"],
      [18, "expert-result", "the Arena expert result is delivered and applied"],
      [19, "provenance-consent", "provenance and consent are verified across the whole journey record"],
      [20, "injected-failure-recovery", "the injected-failure recovery drill (the journey's own recovery exercise)"],
    ],
  );
});

test("a successful journey record: all 20 steps completed, no failed step (the clean golden path)", () => {
  assert.equal(isSuccessfulJourneyRecord(goldenJourney(0)), true);
  // A recovered journey names its failed-at step — honest recovery evidence, NOT a clean pass.
  assert.equal(isSuccessfulJourneyRecord({ ...goldenJourney(0), failedStep: "injected-failure-recovery" }), false);
  // A partial journey stopped early — not a pass.
  assert.equal(isSuccessfulJourneyRecord({ ...goldenJourney(0), stepsCompleted: 11 }), false);
  assert.equal(isSuccessfulJourneyRecord({ ...goldenJourney(0), stepsCompleted: 0, failedStep: "workspace-creation" }), false);
});

test("journey-evidence validation: typed refusals for malformed records (never guessed into evidence)", () => {
  assert.equal(validateJourneyEvidence(null), null);
  assert.equal(validateJourneyEvidence(goldenJourney(3)), null);
  for (const [patch, reason] of [
    [{ id: "" }, "journey-record-id-empty"],
    [{ id: "  " }, "journey-record-id-empty"],
    [{ journeyId: "" }, "journey-id-empty"],
    [{ journeyId: "   " }, "journey-id-empty"],
    [{ stepsCompleted: -1 }, "steps-completed-invalid"],
    [{ stepsCompleted: 21 }, "steps-completed-invalid"],
    [{ stepsCompleted: 4.5 }, "steps-completed-invalid"],
    [{ failedStep: "" }, "failed-step-invalid"],
    [{ durationMs: -1 }, "duration-ms-invalid"],
    [{ durationMs: Number.NaN }, "duration-ms-invalid"],
  ] as const) {
    const refusal = validateJourneyEvidence({ ...goldenJourney(0), ...patch });
    assert.ok(refusal !== null, reason);
    assert.equal(refusal?.reason, reason, reason);
  }
});

test("checklist-intake validation: the gate is exactly the 20 evidence entries (checklist-incomplete)", () => {
  assert.equal(validateLaunchGateChecklistIntake({ journeys: goldenIntake() }), null);
  // 19 entries — an incomplete checklist.
  const short = validateLaunchGateChecklistIntake({ journeys: goldenIntake().slice(0, 19) });
  assert.ok(short !== null);
  assert.equal(short?.reason, "checklist-incomplete");
  // 21 entries — an extension, not the gate.
  const long = validateLaunchGateChecklistIntake({ journeys: [...goldenIntake(), goldenJourney(0)] });
  assert.ok(long !== null);
  assert.equal(long?.reason, "checklist-incomplete");
  // Zero entries.
  const empty = validateLaunchGateChecklistIntake({ journeys: [] });
  assert.ok(empty !== null);
  assert.equal(empty?.reason, "checklist-incomplete");
  // A malformed entry inside the list.
  const malformed = validateLaunchGateChecklistIntake({ journeys: goldenIntake().map((journey, index) => (index === 7 ? { ...journey!, id: "" } : journey)) });
  assert.ok(malformed !== null);
  assert.equal(malformed?.reason, "journey-record-id-empty");
});

test("THE LAUNCH GATE LAW (construct teeth): passed is DERIVED from journey evidence — never a bare assertion", () => {
  const constructed = constructLaunchGateChecklistRecord({ id: "you_launch-gate_0000000000000001", checkedAt: "2026-01-01T00:00:01.000Z" }, { journeys: goldenIntake() });
  assert.ok(constructed.ok);
  if (constructed.ok) {
    const record = constructed.record;
    assert.equal(record.points.length, 20);
    assert.equal(record.checkedAt, "2026-01-01T00:00:01.000Z");
    assert.equal(record.simulated, true);
    assert.ok(Object.isFrozen(record));
    assert.ok(Object.isFrozen(record.points));
    // Every point: the canonical number + description, the journey ref, passed DERIVED true.
    for (let index = 0; index < 20; index += 1) {
      const point = record.points[index];
      const spec = LAUNCH_GATE_POINTS[index];
      assert.ok(point !== undefined && spec !== undefined);
      assert.equal(point.point, spec.point);
      assert.equal(point.description, spec.description);
      assert.equal(point.journeyEvidenceRef, goldenJourney(index).id);
      assert.equal(point.passed, true);
      assert.ok(Object.isFrozen(point));
    }
    assert.equal(launchGatePassedCount(record), 20);
    assert.equal(launchGatePasses(record), true);
    assert.equal(isCompleteLaunchGateChecklist(record), true);
  }
});

test("THE LAUNCH GATE LAW (honest failures): unsuccessful or absent evidence records passed: false with its ref preserved", () => {
  const journeys = goldenIntake();
  // Point 19: a partial journey (stopped early) — ref preserved, passed false.
  journeys[18] = { ...goldenJourney(18), stepsCompleted: 11, failedStep: "edit" };
  // Point 20: a recovered journey (names its failed-at step) — ref preserved, passed false.
  journeys[19] = { ...goldenJourney(19), failedStep: "injected-failure-recovery" };
  // Point 7: no evidence at all — null ref, passed false.
  journeys[6] = null;
  const constructed = constructLaunchGateChecklistRecord({ id: "you_launch-gate_0000000000000002", checkedAt: "2026-01-01T00:00:02.000Z" }, { journeys });
  assert.ok(constructed.ok);
  if (constructed.ok) {
    const record = constructed.record;
    assert.equal(record.points[18]?.passed, false);
    assert.equal(record.points[18]?.journeyEvidenceRef, journeys[18]?.id);
    assert.equal(record.points[19]?.passed, false);
    assert.equal(record.points[19]?.journeyEvidenceRef, journeys[19]?.id);
    assert.equal(record.points[6]?.passed, false);
    assert.equal(record.points[6]?.journeyEvidenceRef, null);
    // 17 passed; the gate does NOT pass; the checklist is still complete (all 20 points present).
    assert.equal(launchGatePassedCount(record), 17);
    assert.equal(launchGatePasses(record), false);
    assert.equal(isCompleteLaunchGateChecklist(record), true);
  }
});

test("checklist construction refusals: typed, never silent (YOU_LAUNCH_GATE_INVALID mapping at the seam)", () => {
  // Missing checkedAt.
  const noTimestamp = constructLaunchGateChecklistRecord({ id: "x", checkedAt: "" }, { journeys: goldenIntake() });
  assert.ok(!noTimestamp.ok);
  if (!noTimestamp.ok) {
    assert.equal(noTimestamp.refusal.reason, "checked-at-missing");
  }
  // Wrong count (19).
  const short = constructLaunchGateChecklistRecord({ id: "x", checkedAt: "2026-01-01T00:00:01.000Z" }, { journeys: goldenIntake().slice(0, 19) });
  assert.ok(!short.ok);
  if (!short.ok) {
    assert.equal(short.refusal.reason, "checklist-incomplete");
  }
  // Malformed evidence inside the list.
  const malformed = constructLaunchGateChecklistRecord({ id: "x", checkedAt: "2026-01-01T00:00:01.000Z" }, { journeys: goldenIntake().map((journey, index) => (index === 2 ? { ...journey!, durationMs: -5 } : journey)) });
  assert.ok(!malformed.ok);
  if (!malformed.ok) {
    assert.equal(malformed.refusal.reason, "duration-ms-invalid");
  }
});

test("completeness is a shape fact: hand-forged records are detected (the OPERATOR SIGNOFF LAW's complete-checklist gate)", () => {
  const good = constructLaunchGateChecklistRecord({ id: "you_launch-gate_0000000000000003", checkedAt: "2026-01-01T00:00:03.000Z" }, { journeys: goldenIntake() });
  assert.ok(good.ok);
  const base: LaunchGateChecklistRecord = good.ok ? good.record : { id: "x", points: [], checkedAt: "", simulated: true };
  // 19 points — incomplete.
  assert.equal(isCompleteLaunchGateChecklist({ ...base, points: base.points.slice(0, 19) }), false);
  // Out-of-order numbering — incomplete.
  const swapped = [...base.points];
  const first = swapped[0];
  const second = swapped[1];
  if (first !== undefined && second !== undefined) {
    swapped[0] = { ...second, point: second.point };
    swapped[1] = { ...first, point: first.point };
  }
  assert.equal(isCompleteLaunchGateChecklist({ ...base, points: swapped }), false);
  // Null / malformed records.
  assert.equal(isCompleteLaunchGateChecklist(null), false);
  assert.equal(isCompleteLaunchGateChecklist({ ...base, points: [] }), false);
});

test("construction is deterministic: same input => byte-identical records", () => {
  const first = constructLaunchGateChecklistRecord({ id: "you_launch-gate_0000000000000004", checkedAt: "2026-01-01T00:00:04.000Z" }, { journeys: goldenIntake() });
  const second = constructLaunchGateChecklistRecord({ id: "you_launch-gate_0000000000000004", checkedAt: "2026-01-01T00:00:04.000Z" }, { journeys: goldenIntake() });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
