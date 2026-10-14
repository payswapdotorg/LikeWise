import assert from "node:assert/strict";
import test from "node:test";
import type { LaunchGateChecklistRecord } from "./contract.js";
import {
  LAUNCH_GATE_CHECKLIST_LENGTH,
  LAUNCH_GATE_POINTS,
  constructLaunchGateChecklistRecord,
} from "./launchGate.js";
import { constructOperatorSignoffRecord, validateOperatorSignoffInput } from "./operatorSignoff.js";
import type { E2eJourneyRecord } from "./contract.js";

function goldenJourney(index: number): E2eJourneyRecord {
  return {
    id: `you_journey_golden-${String(index + 1).padStart(2, "0")}_0000000000000001`,
    journeyId: `golden-${String(index + 1).padStart(2, "0")}`,
    stepsCompleted: 20,
    failedStep: null,
    durationMs: 120 + index,
    simulated: true,
  };
}

function passingChecklist(id: string): LaunchGateChecklistRecord {
  const constructed = constructLaunchGateChecklistRecord(
    { id, checkedAt: "2026-01-01T00:00:01.000Z" },
    { journeys: Array.from({ length: LAUNCH_GATE_CHECKLIST_LENGTH }, (_, index) => goldenJourney(index)) },
  );
  if (!constructed.ok) {
    throw new Error(`fixture checklist construction failed: ${constructed.refusal.reason}`);
  }
  return constructed.record;
}

test("the signoff constructs against a COMPLETE passing checklist (immutable, simulated, frozen)", () => {
  const checklist = passingChecklist("you_launch-gate_0000000000000001");
  const constructed = constructOperatorSignoffRecord(
    {
      id: "you_operator-signoff_000000000001",
      checklistRef: checklist.id,
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
    },
    checklist,
  );
  assert.ok(constructed.ok);
  if (constructed.ok) {
    assert.equal(constructed.record.checklistRef, checklist.id);
    assert.equal(constructed.record.signedBy, "you_user_0000000000000001");
    assert.equal(constructed.record.signedAt, "2026-01-01T00:00:02.000Z");
    assert.equal(constructed.record.simulated, true);
    assert.ok(Object.isFrozen(constructed.record));
  }
});

test("THE OPERATOR SIGNOFF LAW (construct teeth): no checklist, no signoff", () => {
  const checklist = passingChecklist("you_launch-gate_0000000000000002");
  const without = constructOperatorSignoffRecord(
    {
      id: "you_operator-signoff_000000000002",
      checklistRef: checklist.id,
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
    },
    null,
  );
  assert.ok(!without.ok);
  if (!without.ok) {
    assert.equal(without.refusal.reason, "signoff-without-checklist");
  }
});

test("THE OPERATOR SIGNOFF LAW (construct teeth): the reference must be the checklist it was constructed with", () => {
  const checklist = passingChecklist("you_launch-gate_0000000000000003");
  const mismatch = constructOperatorSignoffRecord(
    {
      id: "you_operator-signoff_000000000003",
      checklistRef: "you_launch-gate_someotherchecklis",
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
    },
    checklist,
  );
  assert.ok(!mismatch.ok);
  if (!mismatch.ok) {
    assert.equal(mismatch.refusal.reason, "checklist-ref-mismatch");
  }
});

test("THE OPERATOR SIGNOFF LAW (construct teeth): an INCOMPLETE checklist is refused (never a signoff over a partial gate)", () => {
  const complete = passingChecklist("you_launch-gate_0000000000000004");
  const incomplete: LaunchGateChecklistRecord = { ...complete, points: complete.points.slice(0, 19) };
  const refused = constructOperatorSignoffRecord(
    {
      id: "you_operator-signoff_000000000004",
      checklistRef: incomplete.id,
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
    },
    incomplete,
  );
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.refusal.reason, "checklist-incomplete");
  }
});

test("THE OPERATOR SIGNOFF LAW (construct teeth): a signoff without a PASSING gate is refused (never recorded)", () => {
  const complete = passingChecklist("you_launch-gate_0000000000000005");
  // Hand-forge a complete-but-failing record: point 20 carries its failing evidence reference, passed false.
  const failing: LaunchGateChecklistRecord = {
    ...complete,
    points: complete.points.map((point, index) =>
      index === LAUNCH_GATE_CHECKLIST_LENGTH - 1 ? { ...point, passed: false } : point,
    ),
  };
  const refused = constructOperatorSignoffRecord(
    {
      id: "you_operator-signoff_000000000005",
      checklistRef: failing.id,
      signedBy: "you_user_0000000000000001",
      signedAt: "2026-01-01T00:00:02.000Z",
    },
    failing,
  );
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.refusal.reason, "checklist-not-passing");
  }
});

test("signoff intake refusals: typed, never silent", () => {
  const checklist = passingChecklist("you_launch-gate_0000000000000006");
  for (const [input, reason] of [
    [{ signedBy: "" }, "signed-by-empty"],
    [{ signedBy: "   " }, "signed-by-empty"],
  ] as const) {
    const refusal = validateOperatorSignoffInput(input);
    assert.ok(refusal !== null, reason);
    assert.equal(refusal?.reason, reason, reason);
  }
  const emptyRef = constructOperatorSignoffRecord(
    { id: "x", checklistRef: "", signedBy: "you_user_0000000000000001", signedAt: "2026-01-01T00:00:02.000Z" },
    checklist,
  );
  assert.ok(!emptyRef.ok);
  if (!emptyRef.ok) {
    assert.equal(emptyRef.refusal.reason, "checklist-ref-empty");
  }
  const noSigner = constructOperatorSignoffRecord(
    { id: "x", checklistRef: checklist.id, signedBy: "", signedAt: "2026-01-01T00:00:02.000Z" },
    checklist,
  );
  assert.ok(!noSigner.ok);
  if (!noSigner.ok) {
    assert.equal(noSigner.refusal.reason, "signed-by-empty");
  }
  const noTimestamp = constructOperatorSignoffRecord(
    { id: "x", checklistRef: checklist.id, signedBy: "you_user_0000000000000001", signedAt: "" },
    checklist,
  );
  assert.ok(!noTimestamp.ok);
  if (!noTimestamp.ok) {
    assert.equal(noTimestamp.refusal.reason, "signed-at-missing");
  }
});

test("the canonical table is importable for alignment consumers (W12C seam)", () => {
  // The signoff authority delegates completeness/passing to the launch-gate
  // authority; the canonical vocabulary stays the single table.
  assert.equal(LAUNCH_GATE_POINTS.length, LAUNCH_GATE_CHECKLIST_LENGTH);
});
