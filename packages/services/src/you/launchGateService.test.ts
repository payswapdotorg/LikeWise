import assert from "node:assert/strict";
import test from "node:test";
import type { E2eJourneyRecord, OpaqueId } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { LAUNCH_GATE_POINTS } from "../../../shared/src/you/launchGate.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createLaunchGateService, LaunchGateService } from "./launchGateService.js";

const SOLUTION_ID: OpaqueId = "you_w12a_service_solution01";

interface Harness {
  readonly service: LaunchGateService;
  readonly clock: DeterministicClock;
}

function harness(seed?: string): Harness {
  const clock = createDeterministicClock();
  const service = createLaunchGateService({
    workspaceIdentity: "ws-w12a-service-test",
    seed: seed ?? "you-w12a-launch-gate-service-test",
    clock,
  });
  return { service, clock };
}

/** One golden full-path journey (successful evidence). */
function goldenJourney(index: number): E2eJourneyRecord {
  return {
    id: `you_journey_test-point-${String(index + 1).padStart(2, "0")}_00000001`,
    journeyId: `test-point-${String(index + 1).padStart(2, "0")}`,
    stepsCompleted: 20,
    failedStep: null,
    durationMs: 100 + index,
    simulated: true,
  };
}

function goldenIntake(): (E2eJourneyRecord | null)[] {
  return LAUNCH_GATE_POINTS.map((_, index) => goldenJourney(index));
}

// -- the 20-point gate ---------------------------------------------------------------

test("THE LAUNCH GATE LAW: the 20-point checklist assembled from journey evidence, passes only with successful references", () => {
  const { service } = harness();
  const assembled = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: goldenIntake() });
  assert.ok(assembled.ok);
  if (assembled.ok) {
    const { record } = assembled.value;
    assert.equal(record.points.length, 20);
    assert.equal(assembled.value.passedCount, 20);
    assert.equal(assembled.value.gatePassed, true);
    assert.equal(record.simulated, true);
    assert.ok(Object.isFrozen(record));
    assert.ok(Object.isFrozen(record.points));
    // The canonical order: point N, its frozen description, its journey ref, passed true.
    for (let index = 0; index < 20; index += 1) {
      const point = record.points[index];
      const spec = LAUNCH_GATE_POINTS[index];
      assert.ok(point !== undefined && spec !== undefined);
      assert.equal(point.point, spec.point);
      assert.equal(point.description, spec.description);
      assert.equal(point.journeyEvidenceRef, goldenJourney(index).id);
      assert.equal(point.passed, true);
    }
  }
  // The gate facts readout.
  const status = service.launchGateStatusOf(SOLUTION_ID, assembled.ok ? assembled.value.record.id : "");
  assert.ok(status.ok);
  if (status.ok) {
    assert.equal(status.value.gatePassed, true);
    assert.equal(status.value.passedCount, 20);
    assert.equal(status.value.status, "checked");
  }
});

test("THE LAUNCH GATE LAW (service teeth): passed is derived — unsuccessful or absent evidence never passes a point", () => {
  const { service } = harness();
  const journeys = goldenIntake();
  journeys[4] = { ...goldenJourney(4), failedStep: "feedback" };
  journeys[9] = { ...goldenJourney(9), stepsCompleted: 10, failedStep: "render" };
  journeys[14] = null;
  const assembled = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys });
  assert.ok(assembled.ok);
  if (assembled.ok) {
    const { record } = assembled.value;
    // The failing points keep their evidence refs (honest display); the null point stays null.
    assert.equal(record.points[4]?.passed, false);
    assert.equal(record.points[4]?.journeyEvidenceRef, journeys[4]?.id);
    assert.equal(record.points[9]?.passed, false);
    assert.equal(record.points[9]?.journeyEvidenceRef, journeys[9]?.id);
    assert.equal(record.points[14]?.passed, false);
    assert.equal(record.points[14]?.journeyEvidenceRef, null);
    assert.equal(assembled.value.passedCount, 17);
    assert.equal(assembled.value.gatePassed, false);
  }
});

test("checklist-intake refusals: typed YOU_LAUNCH_GATE_INVALID, never silent", () => {
  const { service } = harness();
  for (const [journeys, reason] of [
    [goldenIntake().slice(0, 19), "checklist-incomplete"],
    [[...goldenIntake(), goldenJourney(0)], "checklist-incomplete"],
    [[], "checklist-incomplete"],
  ] as const) {
    const refused = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: [...journeys] });
    assert.ok(!refused.ok, reason);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_LAUNCH_GATE_INVALID", reason);
      assert.equal(refused.error.details["reason"], reason, reason);
      assert.equal(refused.error.simulated, true);
    }
  }
  for (const [patch, reason] of [
    [{ id: "" }, "journey-record-id-empty"],
    [{ journeyId: "  " }, "journey-id-empty"],
    [{ stepsCompleted: -1 }, "steps-completed-invalid"],
    [{ stepsCompleted: 25 }, "steps-completed-invalid"],
    [{ failedStep: "" }, "failed-step-invalid"],
    [{ durationMs: Number.POSITIVE_INFINITY }, "duration-ms-invalid"],
  ] as const) {
    const refused = service.assembleLaunchGateChecklist(SOLUTION_ID, {
      journeys: goldenIntake().map((journey, index) => (index === 3 ? { ...journey!, ...patch } : journey)),
    });
    assert.ok(!refused.ok, reason);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_LAUNCH_GATE_INVALID", reason);
      assert.equal(refused.error.details["reason"], reason, reason);
    }
  }
  // A runtime-shaped non-object entry is refused too (the validator never guesses).
  const malformed = service.assembleLaunchGateChecklist(SOLUTION_ID, {
    journeys: goldenIntake().map((journey, index) => (index === 0 ? ("not-a-journey" as unknown as E2eJourneyRecord) : journey)),
  });
  assert.ok(!malformed.ok);
  if (!malformed.ok) {
    assert.equal(malformed.error.details["reason"], "journey-evidence-malformed");
  }
  // Readouts: nothing was recorded by the refusals; unknown lookups typed.
  const checklists = service.launchGateChecklistsOf(SOLUTION_ID);
  assert.ok(checklists.ok);
  if (checklists.ok) {
    assert.equal(checklists.value.checklists.length, 0);
  }
  const unknown = service.launchGateChecklistOf(SOLUTION_ID, "you_launch-gate_missing0000000");
  assert.ok(!unknown.ok);
  if (!unknown.ok) {
    assert.equal(unknown.error.code, "YOU_LAUNCH_GATE_INVALID");
    assert.equal(unknown.error.details["reason"], "unknown-checklist");
  }
});

// -- the signoff lifecycle ------------------------------------------------------------

test("the signoff lifecycle: sign the passing gate, immutable, one per checklist; the status head moves", () => {
  const { service } = harness();
  const assembled = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: goldenIntake() });
  assert.ok(assembled.ok);
  const checklistId = assembled.ok ? assembled.value.record.id : "";
  // No signoff while only checked.
  const noSignoff = service.operatorSignoffOfChecklist(SOLUTION_ID, checklistId);
  assert.ok(!noSignoff.ok);
  if (!noSignoff.ok) {
    assert.equal(noSignoff.error.code, "YOU_OPERATOR_SIGNOFF_INVALID");
    assert.equal(noSignoff.error.details["reason"], "no-signoff");
  }
  const signed = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "you_user_0000000000000001" });
  assert.ok(signed.ok);
  if (signed.ok) {
    assert.equal(signed.value.signoff.checklistRef, checklistId);
    assert.equal(signed.value.signoff.signedBy, "you_user_0000000000000001");
    assert.equal(signed.value.signoff.simulated, true);
    assert.ok(Object.isFrozen(signed.value.signoff));
  }
  // The status head moved to signed.
  const status = service.launchGateStatusOf(SOLUTION_ID, checklistId);
  assert.ok(status.ok);
  if (status.ok) {
    assert.equal(status.value.status, "signed");
    assert.equal(status.value.gatePassed, true);
  }
  // The signoff resolves through the checklist.
  const resolved = service.operatorSignoffOfChecklist(SOLUTION_ID, checklistId);
  assert.ok(resolved.ok);
  if (resolved.ok && signed.ok) {
    assert.equal(resolved.value.signoff.id, signed.value.signoff.id);
  }
  // THE LAW's immutability teeth: a re-sign is refused, never a rewrite.
  const again = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "you_user_0000000000000001" });
  assert.ok(!again.ok);
  if (!again.ok) {
    assert.equal(again.error.code, "YOU_OPERATOR_SIGNOFF_INVALID");
    assert.equal(again.error.details["reason"], "already-signed");
  }
  // The signoff never changed.
  const readout = service.operatorSignoffOf(SOLUTION_ID, signed.ok ? signed.value.signoff.id : "");
  assert.ok(readout.ok);
  if (readout.ok && signed.ok) {
    assert.equal(readout.value.signoff.signedAt, signed.value.signoff.signedAt);
  }
});

test("THE OPERATOR SIGNOFF LAW (service teeth): a signoff without a passing gate is refused, never recorded", () => {
  const { service } = harness();
  const journeys = goldenIntake();
  journeys[19] = { ...goldenJourney(19), failedStep: "injected-failure-recovery" };
  const failing = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys });
  assert.ok(failing.ok);
  const checklistId = failing.ok ? failing.value.record.id : "";
  const refused = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "you_user_0000000000000001" });
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.error.code, "YOU_OPERATOR_SIGNOFF_INVALID");
    assert.equal(refused.error.details["reason"], "checklist-not-passing");
  }
  // The failing gate stays "checked" forever.
  const status = service.launchGateStatusOf(SOLUTION_ID, checklistId);
  assert.ok(status.ok);
  if (status.ok) {
    assert.equal(status.value.status, "checked");
    assert.equal(status.value.gatePassed, false);
  }
  // Unknown checklist + empty signer.
  const unknown = service.signOperatorChecklist(SOLUTION_ID, "you_launch-gate_missing0000000", { signedBy: "you_user_0000000000000001" });
  assert.ok(!unknown.ok);
  if (!unknown.ok) {
    assert.equal(unknown.error.details["reason"], "unknown-checklist");
  }
  const empty = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "  " });
  assert.ok(!empty.ok);
  if (!empty.ok) {
    assert.equal(empty.error.details["reason"], "signed-by-empty");
  }
});

// -- the declaration refusals ----------------------------------------------------------

test("THE RELEASE DECLARATION LAW (service teeth): without rollback evidence, without a bundle, over an unknown signoff — all refused", () => {
  const { service } = harness();
  const assembled = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: goldenIntake() });
  assert.ok(assembled.ok);
  const checklistId = assembled.ok ? assembled.value.record.id : "";
  const signed = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "you_user_0000000000000001" });
  assert.ok(signed.ok);
  const signoffId = signed.ok ? signed.value.signoff.id : "";
  // THE LAW: no rollback evidence — refused.
  const noRollback = service.declareRelease(SOLUTION_ID, signoffId, {
    evidenceBundleRef: "you_evidence-bundle_w12a-service01",
    rollbackEvidenceRef: "",
  });
  assert.ok(!noRollback.ok);
  if (!noRollback.ok) {
    assert.equal(noRollback.error.code, "YOU_RELEASE_DECLARATION_INVALID");
    assert.equal(noRollback.error.details["reason"], "rollback-evidence-ref-empty");
    assert.equal(noRollback.error.simulated, true);
  }
  // No evidence bundle — refused.
  const noBundle = service.declareRelease(SOLUTION_ID, signoffId, {
    evidenceBundleRef: "",
    rollbackEvidenceRef: "you_rollback-evidence_w12a-service01",
  });
  assert.ok(!noBundle.ok);
  if (!noBundle.ok) {
    assert.equal(noBundle.error.details["reason"], "evidence-bundle-ref-empty");
  }
  // Unknown signoff — refused.
  const unknownSignoff = service.declareRelease(SOLUTION_ID, "you_operator-signoff_missing00", {
    evidenceBundleRef: "you_evidence-bundle_w12a-service01",
    rollbackEvidenceRef: "you_rollback-evidence_w12a-service01",
  });
  assert.ok(!unknownSignoff.ok);
  if (!unknownSignoff.ok) {
    assert.equal(unknownSignoff.error.details["reason"], "unknown-signoff");
  }
  // No declaration while signed-only.
  const noDeclaration = service.releaseDeclarationOfSignoff(SOLUTION_ID, signoffId);
  assert.ok(!noDeclaration.ok);
  if (!noDeclaration.ok) {
    assert.equal(noDeclaration.error.code, "YOU_RELEASE_DECLARATION_INVALID");
    assert.equal(noDeclaration.error.details["reason"], "no-declaration");
  }
  // Nothing was recorded by the refusals.
  const declarations = service.releaseDeclarationsOf(SOLUTION_ID);
  assert.ok(declarations.ok);
  if (declarations.ok) {
    assert.equal(declarations.value.declarations.length, 0);
  }
});

test("the declaration: declared with evidence bundle + rollback evidence; ONE release per signoff; the chain head moves to released", () => {
  const { service } = harness();
  const assembled = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: goldenIntake() });
  assert.ok(assembled.ok);
  const checklistId = assembled.ok ? assembled.value.record.id : "";
  const signed = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "you_user_0000000000000001" });
  assert.ok(signed.ok);
  const signoffId = signed.ok ? signed.value.signoff.id : "";
  const declared = service.declareRelease(SOLUTION_ID, signoffId, {
    evidenceBundleRef: "you_evidence-bundle_w12a-service01",
    rollbackEvidenceRef: "you_rollback-evidence_w12a-service01",
  });
  assert.ok(declared.ok);
  if (declared.ok) {
    assert.equal(declared.value.declaration.signoffRef, signoffId);
    assert.equal(declared.value.declaration.evidenceBundleRef, "you_evidence-bundle_w12a-service01");
    assert.equal(declared.value.declaration.rollbackEvidenceRef, "you_rollback-evidence_w12a-service01");
    assert.equal(declared.value.declaration.simulated, true);
    assert.ok(Object.isFrozen(declared.value.declaration));
  }
  // ONE RELEASE PER SIGNOFF: the re-declaration is refused, never a rewrite.
  const again = service.declareRelease(SOLUTION_ID, signoffId, {
    evidenceBundleRef: "you_evidence-bundle_w12a-service02",
    rollbackEvidenceRef: "you_rollback-evidence_w12a-service02",
  });
  assert.ok(!again.ok);
  if (!again.ok) {
    assert.equal(again.error.code, "YOU_RELEASE_DECLARATION_INVALID");
    assert.equal(again.error.details["reason"], "already-declared");
  }
  // The declaration never changed; it resolves through the signoff.
  const resolved = service.releaseDeclarationOfSignoff(SOLUTION_ID, signoffId);
  assert.ok(resolved.ok);
  if (resolved.ok && declared.ok) {
    assert.equal(resolved.value.declaration.id, declared.value.declaration.id);
  }
  // The checklist's lifecycle head is "released".
  const status = service.launchGateStatusOf(SOLUTION_ID, checklistId);
  assert.ok(status.ok);
  if (status.ok) {
    assert.equal(status.value.status, "released");
  }
  // Unknown declaration lookups typed.
  const unknown = service.releaseDeclarationOf(SOLUTION_ID, "you_release-declaration_missing");
  assert.ok(!unknown.ok);
  if (!unknown.ok) {
    assert.equal(unknown.error.details["reason"], "unknown-declaration");
  }
});

// -- ledger + projection + determinism ----------------------------------------------------

test("the ledger journals the launch-gate lifecycle; the live projection equals the replay fold", () => {
  const { service } = harness();
  const assembled = service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: goldenIntake() });
  assert.ok(assembled.ok);
  const checklistId = assembled.ok ? assembled.value.record.id : "";
  const signed = service.signOperatorChecklist(SOLUTION_ID, checklistId, { signedBy: "you_user_0000000000000001" });
  assert.ok(signed.ok);
  const declared = service.declareRelease(
    SOLUTION_ID,
    signed.ok ? signed.value.signoff.id : "",
    { evidenceBundleRef: "you_evidence-bundle_w12a-service01", rollbackEvidenceRef: "you_rollback-evidence_w12a-service01" },
  );
  assert.ok(declared.ok);
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const checklistEvents = events.value.filter((event) => event.type === "launch-gate-checked");
    assert.equal(checklistEvents.length, 1);
    assert.equal(checklistEvents[0]?.payload["pointCount"], 20);
    assert.equal(checklistEvents[0]?.payload["passedCount"], 20);
    assert.equal(checklistEvents[0]?.payload["gatePassed"], true);
    assert.equal(checklistEvents[0]?.payload["pointJourneyRef.0"], goldenJourney(0).id);
    assert.equal(checklistEvents[0]?.payload["pointPassed.19"], true);
    assert.equal(checklistEvents[0]?.payload["pointDescription.19"], LAUNCH_GATE_POINTS[19]?.description);
    const signoffEvents = events.value.filter((event) => event.type === "operator-signoff-recorded");
    assert.equal(signoffEvents.length, 1);
    assert.equal(signoffEvents[0]?.payload["checklistRef"], checklistId);
    assert.equal(signoffEvents[0]?.payload["signedBy"], "you_user_0000000000000001");
    const declarationEvents = events.value.filter((event) => event.type === "release-declared");
    assert.equal(declarationEvents.length, 1);
    assert.equal(declarationEvents[0]?.payload["evidenceBundleRef"], "you_evidence-bundle_w12a-service01");
    assert.equal(declarationEvents[0]?.payload["rollbackEvidenceRef"], "you_rollback-evidence_w12a-service01");
  }
  const live = service.projectionOf(SOLUTION_ID);
  assert.ok(live.ok);
  if (live.ok && events.ok) {
    const replay = LaunchGateService.replay(events.value);
    assert.equal(stableStringify(live.value), stableStringify(replay));
    // The fold reconstructs the checklist, the signoff, the declaration and the two heads.
    const checklistEntry = replay.checklists[checklistId];
    assert.ok(checklistEntry !== undefined);
    assert.equal(checklistEntry.gatePassed, true);
    assert.equal(checklistEntry.points[19]?.journeyEvidenceRef, goldenJourney(19).id);
    assert.equal(replay.signedChecklists[checklistId] !== undefined, true);
    assert.equal(replay.declaredSignoffs[(signed as { value: { signoff: { id: string } } }).value.signoff.id] !== undefined, true);
  }
});

test("the full service is deterministic: same seed => byte-identical ledgers and records; a different seed diverges", () => {
  const first = harness("you-w12a-determinism-seed");
  const second = harness("you-w12a-determinism-seed");
  for (const h of [first, second]) {
    serviceScenario(h);
  }
  const firstEvents = first.service.ledgerEventsOf(SOLUTION_ID);
  const secondEvents = second.service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(firstEvents.ok && secondEvents.ok);
  if (firstEvents.ok && secondEvents.ok) {
    assert.equal(stableStringify(firstEvents.value), stableStringify(secondEvents.value));
  }
  const firstHash = first.service.ledgerHashOf(SOLUTION_ID);
  const secondHash = second.service.ledgerHashOf(SOLUTION_ID);
  assert.ok(firstHash.ok && secondHash.ok);
  if (firstHash.ok && secondHash.ok) {
    assert.equal(firstHash.value, secondHash.value);
  }
  // A different seed diverges (the seed is load-bearing).
  const other = harness("you-w12a-determinism-other");
  serviceScenario(other);
  const otherEvents = other.service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(otherEvents.ok && firstEvents.ok);
  if (otherEvents.ok && firstEvents.ok) {
    assert.notEqual(stableStringify(otherEvents.value), stableStringify(firstEvents.value));
  }
});

function serviceScenario(h: Harness): void {
  const assembled = h.service.assembleLaunchGateChecklist(SOLUTION_ID, { journeys: goldenIntake() });
  if (assembled.ok) {
    const signed = h.service.signOperatorChecklist(SOLUTION_ID, assembled.value.record.id, { signedBy: "you_user_0000000000000001" });
    if (signed.ok) {
      h.service.declareRelease(SOLUTION_ID, signed.value.signoff.id, {
        evidenceBundleRef: "you_evidence-bundle_w12a-service01",
        rollbackEvidenceRef: "you_rollback-evidence_w12a-service01",
      });
    }
  }
}
