// Launch-gate checklist tests (W12C) — coverage: the LAUNCH GATE LAW at
// the compute plane — the 20-point checklist derives from the journey
// harness outputs with point N passing ONLY with point-N journey
// evidence (first covering journey, deterministic); terminal-only
// journey sets derive honest red points; recovered steps count as
// covered; the derivation refuses empty run sets and evidence outside
// the referenced bundle; the law check (assertLaunchGateChecklistLaw)
// accepts exactly the derivation and refuses bare assertions, drift,
// wrong tables and unlabelled checklists (typed
// YOU_LAUNCH_GATE_INVALID).
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { JOURNEY_STEPS, JOURNEY_STEP_IDS } from "./journeySteps.js";
import { runJourney } from "./journeyHarness.js";
import { runTerminalJourneys } from "./failureInjection.js";
import { buildEvidenceBundle, runGateEvidenceJourneys, type NeutralEvidenceBundle } from "./evidenceBundle.js";
import {
  LAUNCH_GATE_CHECKED_AT,
  LAUNCH_GATE_INVALID_CODE,
  LaunchGateInvalidError,
  assertLaunchGateChecklistLaw,
  checklistRecordId,
  deriveLaunchGateChecklist,
  gatePasses,
  journeyCoversStep,
  summarizeLaunchGate,
  type NeutralLaunchGateChecklistRecord,
} from "./gateChecklist.js";

const STANDARD_JOURNEYS = runGateEvidenceJourneys();
const STANDARD_BUNDLE: NeutralEvidenceBundle = buildEvidenceBundle(STANDARD_JOURNEYS);

test("gate checklist: derivation from the standard evidence journeys — all 20 points green with bundle-resolving evidence", () => {
  const checklist = deriveLaunchGateChecklist(STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE });
  assert.equal(checklist.points.length, 20);
  assert.equal(checklist.checkedAt, LAUNCH_GATE_CHECKED_AT);
  assert.equal(checklist.simulated, true, "truth law: the derived checklist stays labelled");
  assert.match(checklist.id, /^you_gate_[0-9a-f]{16}$/);
  // the points are the authored 20-step table verbatim, in exact order
  checklist.points.forEach((point, i) => {
    const step = JOURNEY_STEPS[i]!;
    assert.equal(point.point, i + 1);
    assert.equal(point.description, step.description);
    assert.equal(point.passed, true, `point ${point.point} passes with journey evidence`);
    assert.notEqual(point.journeyEvidenceRef, null);
  });
  // every evidence ref resolves inside the referenced bundle
  const recordIds = new Set(STANDARD_BUNDLE.manifest.map((entry) => entry.recordId));
  for (const point of checklist.points) {
    assert.ok(recordIds.has(point.journeyEvidenceRef!), `point ${point.point} cites a bundle record`);
  }
  // the gate passes ONLY when all 20 points pass
  assert.equal(gatePasses(checklist), true);
  const summary = summarizeLaunchGate(checklist);
  assert.deepEqual(summary, { pointsTotal: 20, pointsPassed: 20, pointsFailed: 0, allPointsPassed: true });
  // the id is the content name of the points
  assert.equal(checklist.id, checklistRecordId(checklist.points, checklist.checkedAt));
});

test("gate checklist: point N passes only with point-N journey evidence (terminal-only sets derive honest red points)", () => {
  const [terminalEvidence, terminalDrill] = runTerminalJourneys();
  assert.ok(terminalEvidence && terminalDrill);
  // terminal-evidence stops at step 6: points 1-5 covered, point 6 failed terminally, 7-20 never ran
  const fromEvidence = deriveLaunchGateChecklist([terminalEvidence]);
  assert.equal(fromEvidence.points.filter((point) => point.passed).length, 5);
  assert.equal(fromEvidence.points[5]!.passed, false, "point 6 (the terminally failed step) does not pass");
  assert.equal(fromEvidence.points[5]!.journeyEvidenceRef, null, "no successful evidence for a terminally failed step");
  assert.equal(fromEvidence.points[6]!.passed, false, "point 7 never ran (the journey honestly stopped)");
  assert.equal(fromEvidence.points[19]!.passed, false);
  assert.equal(gatePasses(fromEvidence), false, "a red gate is never a passing gate");
  assert.deepEqual(summarizeLaunchGate(fromEvidence), {
    pointsTotal: 20,
    pointsPassed: 5,
    pointsFailed: 15,
    allPointsPassed: false,
  });
  // terminal-recovery-drill stops at step 20: points 1-19 covered, the drill step itself failed terminally
  const fromDrill = deriveLaunchGateChecklist([terminalDrill]);
  assert.equal(fromDrill.points.filter((point) => point.passed).length, 19);
  assert.equal(fromDrill.points[19]!.passed, false, "point 20 (the drill's own terminal failure) does not pass");
  assert.equal(gatePasses(fromDrill), false);
  // the recovered-injection step counts as covered through its recovery path
  const recovered = runJourney({
    journeyId: "checklist-recovered",
    seed: "you-lab-w12c-checklist-recovered",
    injection: { stepId: "evidence", mode: "recover" },
  });
  assert.equal(journeyCoversStep(recovered, "evidence"), true, "a recovered step is covered");
  assert.equal(journeyCoversStep(terminalEvidence, "evidence"), false, "a terminally failed step is not covered");
  const fromRecovered = deriveLaunchGateChecklist([recovered]);
  assert.equal(fromRecovered.points[5]!.passed, true, "point 6 passes on the recovered journey's evidence");
  assert.equal(fromRecovered.points[5]!.journeyEvidenceRef, recovered.journeyRecord.id);
});

test("gate checklist: the evidence journey selection is deterministic — the first covering journey in input order", () => {
  // golden-beta covers every point; an injection journey placed FIRST wins the citation
  const injectionRender = runJourney({
    journeyId: "injection-render",
    seed: "you-lab-w11c-injection-render",
    injection: { stepId: "render", mode: "recover" },
  });
  const goldenBeta = runJourney({ journeyId: "golden-beta", seed: "you-lab-w11c-golden-beta", injection: null });
  const firstOrder = deriveLaunchGateChecklist([injectionRender, goldenBeta]);
  for (const point of firstOrder.points) {
    assert.equal(point.journeyEvidenceRef, injectionRender.journeyRecord.id, "the first covering journey is cited");
  }
  // reversing the input order deterministically changes the citation (both are honest derivations)
  const reversedOrder = deriveLaunchGateChecklist([goldenBeta, injectionRender]);
  for (const point of reversedOrder.points) {
    assert.equal(point.journeyEvidenceRef, goldenBeta.journeyRecord.id);
  }
  // double derivation is byte-identical (determinism)
  assert.equal(
    canonicalJson(deriveLaunchGateChecklist(STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE })),
    canonicalJson(deriveLaunchGateChecklist(STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE })),
  );
});

test("gate checklist: refusal paths — empty run sets and evidence outside the referenced bundle", () => {
  assert.throws(
    () => deriveLaunchGateChecklist([]),
    (error: unknown) =>
      error instanceof LaunchGateInvalidError &&
      error.code === LAUNCH_GATE_INVALID_CODE &&
      /zero journeys to check/.test(error.message),
  );
  // a checklist whose evidence lives outside the referenced bundle is refused
  const goldenAlpha = runJourney({ journeyId: "golden-alpha", seed: "you-lab-w11c-golden-alpha", injection: null });
  const foreignBundle = buildEvidenceBundle([
    runJourney({ journeyId: "golden-beta", seed: "you-lab-w11c-golden-beta", injection: null }),
  ]);
  assert.throws(
    () => deriveLaunchGateChecklist([goldenAlpha], { bundle: foreignBundle }),
    /outside the referenced bundle/,
  );
  // a tampered bundle is refused before any point derives
  const tampered = {
    ...STANDARD_BUNDLE,
    journeyRecords: Object.freeze([
      { ...STANDARD_BUNDLE.journeyRecords[0]!, durationMs: STANDARD_BUNDLE.journeyRecords[0]!.durationMs + 1 },
      ...STANDARD_BUNDLE.journeyRecords.slice(1),
    ]),
  };
  assert.throws(() => deriveLaunchGateChecklist(STANDARD_JOURNEYS, { bundle: tampered }), /fails its content address/);
  // malformed outcomes are never derived from
  assert.throws(
    () =>
      deriveLaunchGateChecklist([
        {
          ...goldenAlpha,
          steps: [{ ...goldenAlpha.steps[0]!, stepId: "not-a-step" }, ...goldenAlpha.steps.slice(1)],
        },
      ]),
    /outside the frozen 20-point launch-gate vocabulary/,
  );
  assert.throws(() => deriveLaunchGateChecklist([{ ...goldenAlpha, steps: [] }]), /zero step records/);
  assert.throws(() => deriveLaunchGateChecklist(STANDARD_JOURNEYS, { checkedAt: "" }), /empty checkedAt/);
});

test("gate checklist: assertLaunchGateChecklistLaw accepts the honest derivation and refuses every drift (fail-closed)", () => {
  const checklist = deriveLaunchGateChecklist(STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE });
  // the honest derivation passes its own law check (recompute + compare)
  assert.ok(
    assertLaunchGateChecklistLaw(checklist, STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE }) === undefined,
  );
  // a bare assertion — a passed point with no evidence — is the law's core refusal
  const bareAssertion: NeutralLaunchGateChecklistRecord = {
    ...checklist,
    points: Object.freeze([
      ...checklist.points.slice(0, 5),
      Object.freeze({ ...checklist.points[5]!, journeyEvidenceRef: null, passed: true }),
      ...checklist.points.slice(6),
    ]),
  };
  assert.throws(
    () => assertLaunchGateChecklistLaw(bareAssertion, STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE }),
    (error: unknown) =>
      error instanceof LaunchGateInvalidError && /passes with no journey evidence — never a bare assertion/.test(error.message),
  );
  // a drifted checklist (a red point swapped in, content-named so the drift
  // compare — not the id check — is what catches it) diverges from the derivation
  const driftedPoints = [
    ...checklist.points.slice(0, 9),
    Object.freeze({ ...checklist.points[9]!, journeyEvidenceRef: null, passed: false }),
    ...checklist.points.slice(10),
  ];
  const drifted: NeutralLaunchGateChecklistRecord = {
    ...checklist,
    id: checklistRecordId(driftedPoints, checklist.checkedAt),
    points: Object.freeze(driftedPoints),
  };
  assert.throws(() => assertLaunchGateChecklistLaw(drifted, STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE }), /diverges from the journey evidence/);
  // a swapped evidence ref (another bundle record that also covers the point) is STILL drift —
  // the checklist must equal the derivation exactly
  const swappedPoints = [
    Object.freeze({ ...checklist.points[0]!, journeyEvidenceRef: STANDARD_BUNDLE.journeyRecords[1]!.id }),
    ...checklist.points.slice(1),
  ];
  const swapped: NeutralLaunchGateChecklistRecord = {
    ...checklist,
    id: checklistRecordId(swappedPoints, checklist.checkedAt),
    points: Object.freeze(swappedPoints),
  };
  assert.throws(() => assertLaunchGateChecklistLaw(swapped, STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE }), /diverges from the journey evidence/);
  // structural refusals: wrong table size, wrong order, unauthored descriptions, unlabelled, misnamed id
  assert.throws(
    () => assertLaunchGateChecklistLaw({ ...checklist, points: Object.freeze(checklist.points.slice(0, 19)) }, STANDARD_JOURNEYS),
    /the launch gate is the 20-point checklist \(got 19\)/,
  );
  const reordered: NeutralLaunchGateChecklistRecord = {
    ...checklist,
    points: Object.freeze([...checklist.points.slice(1), checklist.points[0]!]),
  };
  assert.throws(() => assertLaunchGateChecklistLaw(reordered, STANDARD_JOURNEYS), /point at position 1 carries number 2/);
  const unauthored: NeutralLaunchGateChecklistRecord = {
    ...checklist,
    points: Object.freeze([
      Object.freeze({ ...checklist.points[0]!, description: "an invented description" }),
      ...checklist.points.slice(1),
    ]),
  };
  assert.throws(() => assertLaunchGateChecklistLaw(unauthored, STANDARD_JOURNEYS), /not the authored step description/);
  assert.throws(
    () => assertLaunchGateChecklistLaw({ ...checklist, simulated: false }, STANDARD_JOURNEYS),
    /simulated must be true/,
  );
  assert.throws(
    () => assertLaunchGateChecklistLaw({ ...checklist, id: "you_gate_0000000000000000" }, STANDARD_JOURNEYS),
    /fails its content name/,
  );
  assert.throws(() => assertLaunchGateChecklistLaw({ ...checklist, id: "" }, STANDARD_JOURNEYS), /empty checklist id/);
  // a failed point that cites evidence is not the derivation's shape either
  const citedFailure: NeutralLaunchGateChecklistRecord = {
    ...deriveLaunchGateChecklist([runTerminalJourneys()[0]!]),
    points: Object.freeze([
      ...deriveLaunchGateChecklist([runTerminalJourneys()[0]!]).points.slice(0, 5),
      Object.freeze({
        ...deriveLaunchGateChecklist([runTerminalJourneys()[0]!]).points[5]!,
        journeyEvidenceRef: deriveLaunchGateChecklist([runTerminalJourneys()[0]!]).points[0]!.journeyEvidenceRef,
      }),
      ...deriveLaunchGateChecklist([runTerminalJourneys()[0]!]).points.slice(6),
    ]),
  };
  assert.throws(
    () => assertLaunchGateChecklistLaw(citedFailure, [runTerminalJourneys()[0]!]),
    /cites journey evidence.*but does not pass on it/,
  );
  // the law check over a DIFFERENT journey set than the checklist was derived from is drift
  assert.throws(
    () => assertLaunchGateChecklistLaw(checklist, [runTerminalJourneys()[0]!]),
    /diverges from the journey evidence/,
  );
});

test("gate checklist: the standard derivation cites the first golden journey for every point (deterministic fixture fact)", () => {
  const checklist = deriveLaunchGateChecklist(STANDARD_JOURNEYS, { bundle: STANDARD_BUNDLE });
  const goldenAlpha = runJourney({ journeyId: "golden-alpha", seed: "you-lab-w11c-golden-alpha", injection: null });
  // the standard set orders golden journeys first; golden-alpha covers all 20 points
  for (const point of checklist.points) {
    assert.equal(point.journeyEvidenceRef, goldenAlpha.journeyRecord.id);
  }
  // the full 20-point vocabulary is represented in order
  assert.deepEqual(
    checklist.points.map((point) => point.point),
    JOURNEY_STEP_IDS.map((_, i) => i + 1),
  );
});
