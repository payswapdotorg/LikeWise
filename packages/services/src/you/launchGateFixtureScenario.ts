// YOU W12A launch-gate fixture scenario — scripted, deterministic
// orchestration of the full launch-gate arrow (docs/you/WORK_ORDERS.md
// W12A; FIXTURES.md):
//
//   journeys run (20 golden full-path journeys, seed-derived) ->
//   checklist-intake refusals (checklist-incomplete short/long,
//   journey-evidence shape: record-id-empty / journey-id-empty /
//   steps-completed-invalid / failed-step-invalid / duration-ms-invalid)
//   -> passing checklist assembled (all 20 points pass with their
//   journey references — THE LAUNCH GATE LAW) -> gate passes (the
//   status readout) -> honest-failure checklist assembled (point 19 a
//   partial journey, point 20 a recovered journey: refs preserved,
//   passed false, 18/20) -> SIGNOFF WITHOUT A PASSING GATE refused on
//   the failing checklist (THE OPERATOR SIGNOFF LAW) -> operator signs
//   the passing gate -> signoff refusals (already-signed /
//   unknown-checklist / signed-by-empty) -> DECLARATION WITHOUT
//   ROLLBACK EVIDENCE refused (THE RELEASE DECLARATION LAW) ->
//   declaration refusals (evidence-bundle-ref-empty /
//   unknown-signoff) -> release declared (evidence bundle + rollback
//   evidence) -> ONE RELEASE PER SIGNOFF refused (the re-declaration)
//   -> lookup refusals (unknown checklist / signoff / declaration;
//   no-signoff on the unsigned failing gate) -> ledger readout (all
//   three wave-12 launch events present; live projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same seed produces byte-identical traces
// (golden expectation). Fixture checklists/signoffs/declarations stay
// `simulated: true` (truth law). The scenario owns the injected clock
// and the journey-evidence rng (seed-derived simulated durations — the
// W11C journey-harness law).

import type { E2eJourneyRecord, OpaqueId, SolutionEvent } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { createRngIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { LAUNCH_GATE_POINTS } from "../../../shared/src/you/launchGate.js";
import { createLaunchGateService, LaunchGateService } from "./launchGateService.js";
import {
  LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF,
  LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_BASE_MS,
  LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_SPAN_MS,
  LAUNCH_GATE_SCENARIO_OPERATOR,
  LAUNCH_GATE_SCENARIO_PARTIAL_JOURNEY_FAILED_STEP,
  LAUNCH_GATE_SCENARIO_PARTIAL_JOURNEY_STEPS_COMPLETED,
  LAUNCH_GATE_SCENARIO_RECOVERY_JOURNEY_FAILED_STEP,
  LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF,
  LAUNCH_GATE_SCENARIO_SEED,
  LAUNCH_GATE_SCENARIO_SOLUTION_ID,
  launchGateOutcomeCode,
  type LaunchGateScenarioOptions,
  type LaunchGateScenarioStep,
  type LaunchGateScenarioTrace,
} from "./launchGateFixtureScenarioTypes.js";

export {
  LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF,
  LAUNCH_GATE_SCENARIO_OPERATOR,
  LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF,
  LAUNCH_GATE_SCENARIO_SEED,
  LAUNCH_GATE_SCENARIO_SOLUTION_ID,
} from "./launchGateFixtureScenarioTypes.js";
export type { LaunchGateScenarioOptions, LaunchGateScenarioStep, LaunchGateScenarioTrace } from "./launchGateFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): LaunchGateScenarioStep {
  return { step: index, name, facts };
}

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

/** Mints one seed-derived golden journey record (the fixture rng owns the duration). */
function goldenJourney(rng: ReturnType<typeof createDeterministicRng>, ids: ReturnType<typeof createRngIdFactory>, pointIndex: number): E2eJourneyRecord {
  const spec = LAUNCH_GATE_POINTS[pointIndex];
  if (spec === undefined) {
    throw new Error(`scenario fixture table inconsistent at point ${pointIndex + 1}`);
  }
  return {
    id: ids.next("journey"),
    journeyId: `gate-point-${String(spec.point).padStart(2, "0")}`,
    stepsCompleted: 20,
    failedStep: null,
    durationMs:
      LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_BASE_MS +
      (rng.nextUint32() % LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_SPAN_MS),
    simulated: true,
  };
}

/**
 * Runs the full scripted launch-gate scenario against a freshly created
 * service. Deterministic: same seed + same options => identical trace.
 */
export function runLaunchGateFixtureScenario(options: LaunchGateScenarioOptions = {}): LaunchGateScenarioTrace {
  const solutionId = options.solutionId ?? LAUNCH_GATE_SCENARIO_SOLUTION_ID;
  const seed = options.seed ?? LAUNCH_GATE_SCENARIO_SEED;
  // The scenario owns the injected clock (deterministic timestamps).
  const clock: DeterministicClock = createDeterministicClock();
  const service = createLaunchGateService({
    workspaceIdentity: "ws-w12a-scenario-launch-gate",
    seed,
    clock,
  });
  // The scenario owns the journey-evidence rng (seed-derived simulated
  // durations + journey ids — the W11C journey-harness law).
  const journeyRng = createDeterministicRng(seedFromString(seed));
  const journeyIds = createRngIdFactory(journeyRng);

  const steps: LaunchGateScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};
  const chainWalk: string[] = [];
  const checklistIds: OpaqueId[] = [];
  const goldenJourneyIds: OpaqueId[] = [];

  // -- journeys run (20 golden full-path journeys, seed-derived) ---------------------

  const goldenJourneys: E2eJourneyRecord[] = [];
  for (let index = 0; index < LAUNCH_GATE_POINTS.length; index += 1) {
    const journey = goldenJourney(journeyRng, journeyIds, index);
    goldenJourneys.push(journey);
    goldenJourneyIds.push(journey.id);
  }
  // The failing evidence: a partial journey (stopped at edit) and a recovered journey.
  const partialJourney: E2eJourneyRecord = {
    id: journeyIds.next("journey"),
    journeyId: "gate-point-19-partial",
    stepsCompleted: LAUNCH_GATE_SCENARIO_PARTIAL_JOURNEY_STEPS_COMPLETED,
    failedStep: LAUNCH_GATE_SCENARIO_PARTIAL_JOURNEY_FAILED_STEP,
    durationMs:
      LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_BASE_MS +
      (journeyRng.nextUint32() % LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_SPAN_MS),
    simulated: true,
  };
  const recoveryJourney: E2eJourneyRecord = {
    id: journeyIds.next("journey"),
    journeyId: "gate-point-20-recovery-drill",
    stepsCompleted: 20,
    failedStep: LAUNCH_GATE_SCENARIO_RECOVERY_JOURNEY_FAILED_STEP,
    durationMs:
      LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_BASE_MS +
      (journeyRng.nextUint32() % LAUNCH_GATE_SCENARIO_JOURNEY_DURATION_SPAN_MS),
    simulated: true,
  };
  chainWalk.push("journeys-run");
  steps.push(
    step((stepIndex += 1), "journeys-run", {
      goldenJourneyCount: goldenJourneys.length,
      allSuccessful: goldenJourneys.every((journey) => journey.failedStep === null && journey.stepsCompleted === 20),
      firstJourneyId: goldenJourneyIds[0] ?? "",
      lastJourneyId: goldenJourneyIds[goldenJourneyIds.length - 1] ?? "",
      partialJourneyStepsCompleted: partialJourney.stepsCompleted,
      recoveryJourneyFailedStep: recoveryJourney.failedStep ?? "",
      simulated: true,
    }),
  );

  // -- checklist-intake refusals (typed, never silent) ---------------------------------

  const shortChecklist = service.assembleLaunchGateChecklist(solutionId, { journeys: goldenJourneys.slice(0, 19) });
  refusalOutcomes["checklist-incomplete-short"] = launchGateOutcomeCode(shortChecklist);
  const longChecklist = service.assembleLaunchGateChecklist(solutionId, { journeys: [...goldenJourneys, goldenJourneys[0]!] });
  refusalOutcomes["checklist-incomplete-long"] = launchGateOutcomeCode(longChecklist);
  const badRecordId = service.assembleLaunchGateChecklist(solutionId, {
    journeys: goldenJourneys.map((journey, index) => (index === 0 ? { ...journey, id: "" } : journey)),
  });
  refusalOutcomes["checklist-journey-record-id-empty"] = launchGateOutcomeCode(badRecordId);
  const badJourneyId = service.assembleLaunchGateChecklist(solutionId, {
    journeys: goldenJourneys.map((journey, index) => (index === 1 ? { ...journey, journeyId: "" } : journey)),
  });
  refusalOutcomes["checklist-journey-id-empty"] = launchGateOutcomeCode(badJourneyId);
  const badStepsCompleted = service.assembleLaunchGateChecklist(solutionId, {
    journeys: goldenJourneys.map((journey, index) => (index === 2 ? { ...journey, stepsCompleted: 21 } : journey)),
  });
  refusalOutcomes["checklist-steps-completed-invalid"] = launchGateOutcomeCode(badStepsCompleted);
  const badFailedStep = service.assembleLaunchGateChecklist(solutionId, {
    journeys: goldenJourneys.map((journey, index) => (index === 3 ? { ...journey, failedStep: "" } : journey)),
  });
  refusalOutcomes["checklist-failed-step-invalid"] = launchGateOutcomeCode(badFailedStep);
  const badDuration = service.assembleLaunchGateChecklist(solutionId, {
    journeys: goldenJourneys.map((journey, index) => (index === 4 ? { ...journey, durationMs: -1 } : journey)),
  });
  refusalOutcomes["checklist-duration-ms-invalid"] = launchGateOutcomeCode(badDuration);
  steps.push(
    step((stepIndex += 1), "checklist-intake-refusals", {
      "checklist-incomplete-short": refusalOutcomes["checklist-incomplete-short"] ?? "",
      "checklist-incomplete-long": refusalOutcomes["checklist-incomplete-long"] ?? "",
      "checklist-journey-record-id-empty": refusalOutcomes["checklist-journey-record-id-empty"] ?? "",
      "checklist-journey-id-empty": refusalOutcomes["checklist-journey-id-empty"] ?? "",
      "checklist-steps-completed-invalid": refusalOutcomes["checklist-steps-completed-invalid"] ?? "",
      "checklist-failed-step-invalid": refusalOutcomes["checklist-failed-step-invalid"] ?? "",
      "checklist-duration-ms-invalid": refusalOutcomes["checklist-duration-ms-invalid"] ?? "",
    }),
  );

  // -- passing checklist assembled (all 20 points pass with journey evidence) ---------

  const passing = must(
    service.assembleLaunchGateChecklist(solutionId, { journeys: [...goldenJourneys] }),
    "assemblePassingChecklist",
  );
  checklistIds.push(passing.record.id);
  chainWalk.push("checklist-assembled");
  steps.push(
    step((stepIndex += 1), "gate-checklist-assembled", {
      checklistId: passing.record.id,
      pointCount: passing.record.points.length,
      passedCount: passing.passedCount,
      gatePassed: passing.gatePassed,
      pointOneDescription: passing.record.points[0]?.description ?? "",
      pointTwentyJourneyRef: passing.record.points[19]?.journeyEvidenceRef ?? "",
      simulated: passing.record.simulated,
    }),
  );

  // -- gate passes (the status readout) --------------------------------------------------

  const gateStatus = must(service.launchGateStatusOf(solutionId, passing.record.id), "gateStatusOf");
  chainWalk.push("gate-passed");
  steps.push(
    step((stepIndex += 1), "gate-passes", {
      checklistId: passing.record.id,
      gatePassed: gateStatus.gatePassed,
      passedCount: gateStatus.passedCount,
      status: gateStatus.status,
    }),
  );

  // -- honest-failure checklist assembled (18/20, refs preserved) ------------------------

  const failingIntake = goldenJourneys.map((journey, index) =>
    index === 18 ? partialJourney : index === 19 ? recoveryJourney : journey,
  );
  const failing = must(
    service.assembleLaunchGateChecklist(solutionId, { journeys: failingIntake }),
    "assembleFailingChecklist",
  );
  checklistIds.push(failing.record.id);
  steps.push(
    step((stepIndex += 1), "failing-gate-assembled", {
      checklistId: failing.record.id,
      pointCount: failing.record.points.length,
      passedCount: failing.passedCount,
      gatePassed: failing.gatePassed,
      pointNineteenJourneyRef: failing.record.points[18]?.journeyEvidenceRef ?? "",
      pointNineteenPassed: failing.record.points[18]?.passed ?? false,
      pointTwentyJourneyRef: failing.record.points[19]?.journeyEvidenceRef ?? "",
      pointTwentyPassed: failing.record.points[19]?.passed ?? false,
      pointEighteenPassed: failing.record.points[17]?.passed ?? false,
      simulated: failing.record.simulated,
    }),
  );

  // -- SIGNOFF WITHOUT A PASSING GATE refused (THE OPERATOR SIGNOFF LAW) -----------------

  const signFailing = service.signOperatorChecklist(solutionId, failing.record.id, { signedBy: LAUNCH_GATE_SCENARIO_OPERATOR });
  refusalOutcomes["signoff-checklist-not-passing"] = launchGateOutcomeCode(signFailing);
  const failingStatusAfterRefusal = must(service.launchGateStatusOf(solutionId, failing.record.id), "failingStatusAfterRefusal");
  steps.push(
    step((stepIndex += 1), "signoff-without-passing-gate", {
      checklistId: failing.record.id,
      refusal: refusalOutcomes["signoff-checklist-not-passing"] ?? "",
      failingChecklistStillChecked: failingStatusAfterRefusal.status === "checked",
    }),
  );

  // -- operator signs the passing gate ----------------------------------------------------

  const signoff = must(
    service.signOperatorChecklist(solutionId, passing.record.id, { signedBy: LAUNCH_GATE_SCENARIO_OPERATOR }),
    "signOperatorChecklist",
  );
  chainWalk.push("operator-signed");
  steps.push(
    step((stepIndex += 1), "operator-signs", {
      signoffId: signoff.signoff.id,
      checklistRef: signoff.signoff.checklistRef,
      signedBy: signoff.signoff.signedBy,
      signedAt: signoff.signoff.signedAt,
      simulated: signoff.signoff.simulated,
    }),
  );

  // -- signoff refusals (immutability + unknown + intake) ---------------------------------

  const reSign = service.signOperatorChecklist(solutionId, passing.record.id, { signedBy: LAUNCH_GATE_SCENARIO_OPERATOR });
  refusalOutcomes["signoff-already-signed"] = launchGateOutcomeCode(reSign);
  const signUnknown = service.signOperatorChecklist(solutionId, "you_launch-gate_missing0000000", { signedBy: LAUNCH_GATE_SCENARIO_OPERATOR });
  refusalOutcomes["signoff-unknown-checklist"] = launchGateOutcomeCode(signUnknown);
  const signEmpty = service.signOperatorChecklist(solutionId, passing.record.id, { signedBy: "" });
  refusalOutcomes["signoff-signed-by-empty"] = launchGateOutcomeCode(signEmpty);
  steps.push(
    step((stepIndex += 1), "signoff-refusals", {
      "signoff-already-signed": refusalOutcomes["signoff-already-signed"] ?? "",
      "signoff-unknown-checklist": refusalOutcomes["signoff-unknown-checklist"] ?? "",
      "signoff-signed-by-empty": refusalOutcomes["signoff-signed-by-empty"] ?? "",
    }),
  );

  // -- DECLARATION WITHOUT ROLLBACK EVIDENCE refused (THE RELEASE DECLARATION LAW) --------

  const noRollback = service.declareRelease(solutionId, signoff.signoff.id, {
    evidenceBundleRef: LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF,
    rollbackEvidenceRef: "",
  });
  refusalOutcomes["declaration-rollback-evidence-missing"] = launchGateOutcomeCode(noRollback);
  const noBundle = service.declareRelease(solutionId, signoff.signoff.id, {
    evidenceBundleRef: "",
    rollbackEvidenceRef: LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF,
  });
  refusalOutcomes["declaration-evidence-bundle-missing"] = launchGateOutcomeCode(noBundle);
  const declareUnknown = service.declareRelease(solutionId, "you_operator-signoff_missing00", {
    evidenceBundleRef: LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF,
    rollbackEvidenceRef: LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF,
  });
  refusalOutcomes["declaration-unknown-signoff"] = launchGateOutcomeCode(declareUnknown);
  steps.push(
    step((stepIndex += 1), "declaration-refusals", {
      "declaration-rollback-evidence-missing": refusalOutcomes["declaration-rollback-evidence-missing"] ?? "",
      "declaration-evidence-bundle-missing": refusalOutcomes["declaration-evidence-bundle-missing"] ?? "",
      "declaration-unknown-signoff": refusalOutcomes["declaration-unknown-signoff"] ?? "",
    }),
  );

  // -- release declared (evidence bundle + rollback evidence) ------------------------------

  const declaration = must(
    service.declareRelease(solutionId, signoff.signoff.id, {
      evidenceBundleRef: LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF,
      rollbackEvidenceRef: LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF,
    }),
    "declareRelease",
  );
  chainWalk.push("release-declared");
  steps.push(
    step((stepIndex += 1), "release-declared", {
      declarationId: declaration.declaration.id,
      signoffRef: declaration.declaration.signoffRef,
      evidenceBundleRef: declaration.declaration.evidenceBundleRef,
      rollbackEvidenceRef: declaration.declaration.rollbackEvidenceRef,
      declaredAt: declaration.declaration.declaredAt,
      simulated: declaration.declaration.simulated,
    }),
  );

  // -- ONE RELEASE PER SIGNOFF refused (the re-declaration) --------------------------------

  const reDeclare = service.declareRelease(solutionId, signoff.signoff.id, {
    evidenceBundleRef: LAUNCH_GATE_SCENARIO_EVIDENCE_BUNDLE_REF,
    rollbackEvidenceRef: LAUNCH_GATE_SCENARIO_ROLLBACK_EVIDENCE_REF,
  });
  refusalOutcomes["declaration-already-declared"] = launchGateOutcomeCode(reDeclare);
  const releasedStatus = must(service.launchGateStatusOf(solutionId, passing.record.id), "releasedStatus");
  steps.push(
    step((stepIndex += 1), "one-release-per-signoff", {
      signoffId: signoff.signoff.id,
      refusal: refusalOutcomes["declaration-already-declared"] ?? "",
      checklistStatusReleased: releasedStatus.status === "released",
    }),
  );

  // -- lookup refusals (error taxonomy) ------------------------------------------------------

  const unknownChecklist = service.launchGateChecklistOf(solutionId, "you_launch-gate_missing0000000");
  refusalOutcomes["lookup-unknown-checklist"] = launchGateOutcomeCode(unknownChecklist);
  const unknownSignoff = service.operatorSignoffOf(solutionId, "you_operator-signoff_missing00");
  refusalOutcomes["lookup-unknown-signoff"] = launchGateOutcomeCode(unknownSignoff);
  const noSignoff = service.operatorSignoffOfChecklist(solutionId, failing.record.id);
  refusalOutcomes["lookup-no-signoff"] = launchGateOutcomeCode(noSignoff);
  const unknownDeclaration = service.releaseDeclarationOf(solutionId, "you_release-declaration_missing");
  refusalOutcomes["lookup-unknown-declaration"] = launchGateOutcomeCode(unknownDeclaration);
  steps.push(
    step((stepIndex += 1), "lookup-refusals", {
      "lookup-unknown-checklist": refusalOutcomes["lookup-unknown-checklist"] ?? "",
      "lookup-unknown-signoff": refusalOutcomes["lookup-unknown-signoff"] ?? "",
      "lookup-no-signoff": refusalOutcomes["lookup-no-signoff"] ?? "",
      "lookup-unknown-declaration": refusalOutcomes["lookup-unknown-declaration"] ?? "",
    }),
  );

  // -- ledger readout: all three wave-12 launch events, projection == replay -----------------

  const events: readonly SolutionEvent[] = must(service.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }
  const live = must(service.projectionOf(solutionId), "projectionOf");
  const replay = LaunchGateService.replay(events);
  const projectionMatchesReplay = stableStringify(live) === stableStringify(replay);
  const ledgerHash = must(service.ledgerHashOf(solutionId), "ledgerHashOf");
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      launchGateChecked: eventCounts["launch-gate-checked"] ?? 0,
      operatorSignoffRecorded: eventCounts["operator-signoff-recorded"] ?? 0,
      releaseDeclared: eventCounts["release-declared"] ?? 0,
    }),
  );

  return {
    solutionId,
    checklistIds,
    passingChecklistId: passing.record.id,
    failingChecklistId: failing.record.id,
    signoffId: signoff.signoff.id,
    declarationId: declaration.declaration.id,
    goldenJourneyIds,
    chainWalk,
    refusalOutcomes,
    eventCounts,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
