import assert from "node:assert/strict";
import test from "node:test";
import { createConsentReference } from "../../../shared/src/you/feedback.js";
import { parseLedgerEvents, replayLedger } from "../../../shared/src/you/events.js";
import { roundQualityScore } from "../../../shared/src/you/quality.js";
import { stableEquals, stableStringify } from "../../../shared/src/you/serialize.js";
import { createSolutionService } from "./solutionService.js";

function service(seed = "service-test"): ReturnType<typeof createSolutionService> {
  return createSolutionService({ workspaceIdentity: "ws-service-test", seed });
}

function freshSolution(svc: ReturnType<typeof createSolutionService>) {
  const result = svc.intakeIntent({ text: "Create a simulated human twin for operator review" });
  assert.ok(result.ok);
  if (!result.ok) {
    throw new Error("unreachable");
  }
  return result.value;
}

test("intent intake creates the fixture solution with v1 and ledger events", () => {
  const svc = service();
  const result = svc.intakeIntent({ text: "Create a simulated human twin for operator review" });
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  const { solution, version, intent } = result.value;
  assert.match(solution.id, /^you_solution_[0-9a-f]{16}$/);
  assert.equal(solution.workspaceIdentity, "ws-service-test");
  assert.equal(version.version, 1);
  assert.equal(version.state.simulated, true);
  assert.equal(version.provenance.generator, "fixture");
  assert.match(intent.fingerprint, /^[0-9a-f]{8}$/);
  const events = svc.ledgerEventsOf(solution.id);
  assert.ok(events.ok);
  if (events.ok) {
    assert.equal(events.value.length, 2);
    assert.equal(events.value[0]?.type, "solution-created");
    assert.equal(events.value[1]?.type, "version-published");
  }
  assert.equal(result.value.learningApplied, false);
});

test("unknown solution ids produce typed errors", () => {
  const svc = service();
  const feedback = svc.submitFeedback("you_solution_missing01", {
    targetRef: { kind: "quality", deficiencyClass: "geometry" },
    category: "geometry",
    userComment: "x",
    requestedAction: "y",
  });
  assert.ok(!feedback.ok);
  assert.equal(feedback.error.code, "YOU_INVALID_STATE");
  assert.equal(feedback.error.simulated, true);
  const projection = svc.projectionOf("you_solution_missing01");
  assert.ok(!projection.ok);
});

test("feedback -> evidence request -> deterministic improvement end-to-end (exact numbers)", () => {
  const svc = service();
  const { solution, version } = freshSolution(svc);
  const feedback = svc.submitFeedback(solution.id, {
    targetRef: { kind: "quality", deficiencyClass: "geometry" },
    category: "geometry",
    userComment: "The proportions look slightly off.",
    requestedAction: "improve geometry fidelity",
  });
  assert.ok(feedback.ok);
  if (!feedback.ok) {
    return;
  }
  const evidence = svc.requestEvidence(solution.id, feedback.value.feedback.id);
  assert.ok(evidence.ok);
  if (!evidence.ok) {
    return;
  }
  assert.equal(evidence.value.evidence.targetDeficiency, "geometry");
  const provided = svc.provideFixtureEvidence(solution.id, evidence.value.evidence.id);
  assert.ok(provided.ok);
  const improvement = svc.improveFromEvidence(solution.id, feedback.value.feedback.id);
  assert.ok(improvement.ok);
  if (!improvement.ok) {
    return;
  }
  const before = version.state.quality.geometry ?? 0;
  assert.equal(improvement.value.before.geometry, before);
  assert.equal(improvement.value.after.geometry, before + 0.15);
  assert.deepEqual(improvement.value.deltas, { appearance: 0, composition: 0, geometry: 0.15, identity: 0, "motion-naturalness": 0 });
  assert.equal(improvement.value.version.version, 2);
  assert.equal(improvement.value.version.parentVersionId, version.id);
  assert.equal(improvement.value.feedback.status, "addressed");
  assert.equal(improvement.value.evidence.status, "fulfilled");
  assert.equal(improvement.value.changeSet.authorType, "fixture");
  assert.deepEqual(improvement.value.changeSet.evidenceRefs, [evidence.value.evidence.id]);
});

test("improvement without provided evidence is a typed error", () => {
  const svc = service();
  const { solution } = freshSolution(svc);
  const feedback = svc.submitFeedback(solution.id, {
    targetRef: { kind: "quality", deficiencyClass: "geometry" },
    category: "geometry",
    userComment: "off",
    requestedAction: "improve",
  });
  assert.ok(feedback.ok);
  if (!feedback.ok) {
    return;
  }
  const denied = svc.improveFromEvidence(solution.id, feedback.value.feedback.id);
  assert.ok(!denied.ok);
  assert.equal(denied.error.code, "YOU_INVALID_STATE");
  assert.equal(denied.error.details.reason, "missing-evidence");
});

test("manual takeover closes into a candidate version with a truthful diff", () => {
  const svc = service();
  const { solution } = freshSolution(svc);
  const takeover = svc.beginTakeover(solution.id, {
    mode: "correct",
    evidenceMode: "observed",
    consent: createConsentReference("granted", true),
  });
  assert.ok(takeover.ok);
  if (!takeover.ok) {
    return;
  }
  const correction = svc.closeTakeoverWithCorrection(solution.id, takeover.value.session.id, {
    operations: [
      { op: "adjust_quality", deficiencyClass: "appearance", delta: 0.08 },
      { op: "update_environment", environment: { ambientIntensity: 0.05 } },
    ],
  });
  assert.ok(correction.ok);
  if (!correction.ok) {
    return;
  }
  assert.equal(correction.value.version.version, 2);
  assert.equal(correction.value.changeSet.authorType, "user");
  assert.equal(correction.value.session.endedAt !== null, true);
  assert.equal(correction.value.session.resultingArtifactId, correction.value.artifact.id);
  assert.deepEqual(correction.value.diff.qualityDeltas, {
    appearance: 0.08,
    composition: 0,
    geometry: 0,
    identity: 0,
    "motion-naturalness": 0,
  });
  assert.deepEqual(correction.value.diff.environmentChanged, ["ambientIntensity"]);
  const stale = svc.closeTakeoverWithCorrection(solution.id, takeover.value.session.id, { operations: [] });
  assert.ok(!stale.ok);
  assert.equal(stale.error.details.reason, "session-closed");
});

test("no learning without permission: denied consent stores nothing and repeats identically", () => {
  const svcA = service("consent-denied");
  const svcB = service("consent-denied");
  const intentText = "Create a simulated human twin for operator review";
  const first = svcA.intakeIntent({ text: intentText });
  assert.ok(first.ok);
  if (!first.ok) {
    return;
  }
  const takeover = svcA.beginTakeover(first.value.solution.id, {
    mode: "correct",
    evidenceMode: "observed",
    consent: createConsentReference("denied", true),
  });
  assert.ok(takeover.ok);
  if (!takeover.ok) {
    return;
  }
  const correction = svcA.closeTakeoverWithCorrection(first.value.solution.id, takeover.value.session.id, {
    operations: [{ op: "adjust_quality", deficiencyClass: "appearance", delta: 0.08 }],
  });
  assert.ok(correction.ok);
  const learning = svcA.deriveLearningFromTakeover(first.value.solution.id, takeover.value.session.id);
  assert.ok(learning.ok);
  if (learning.ok) {
    assert.equal(learning.value.stored, false);
    const outcome = learning.value.outcome;
    assert.ok(!outcome.ok);
    if (!outcome.ok) {
      assert.equal(outcome.code, "consent-not-granted");
    }
  }
  assert.deepEqual(svcA.learningCandidatesOf(), []);
  const repeated = svcA.intakeIntent({ text: intentText });
  assert.ok(repeated.ok);
  if (!repeated.ok) {
    return;
  }
  assert.equal(repeated.value.learningApplied, false);
  const other = svcB.intakeIntent({ text: intentText });
  assert.ok(other.ok);
  if (!other.ok) {
    return;
  }
  assert.equal(
    stableStringify(repeated.value.version.state),
    stableStringify(other.value.version.state),
  );
});

test("learning with permission influences the repeated intent", () => {
  const svc = service("consent-granted");
  const intentText = "Create a simulated human twin for operator review";
  const first = svc.intakeIntent({ text: intentText });
  assert.ok(first.ok);
  if (!first.ok) {
    return;
  }
  const takeover = svc.beginTakeover(first.value.solution.id, {
    mode: "teach",
    evidenceMode: "observed",
    consent: createConsentReference("granted", true),
  });
  assert.ok(takeover.ok);
  if (!takeover.ok) {
    return;
  }
  const correction = svc.closeTakeoverWithCorrection(first.value.solution.id, takeover.value.session.id, {
    operations: [{ op: "adjust_quality", deficiencyClass: "appearance", delta: 0.08 }],
  });
  assert.ok(correction.ok);
  const learning = svc.deriveLearningFromTakeover(first.value.solution.id, takeover.value.session.id);
  assert.ok(learning.ok);
  if (learning.ok) {
    assert.equal(learning.value.stored, true);
    assert.equal(learning.value.outcome.ok, true);
  }
  assert.equal(svc.learningCandidatesOf().length, 1);
  const repeated = svc.intakeIntent({ text: intentText });
  assert.ok(repeated.ok);
  if (!repeated.ok) {
    return;
  }
  assert.equal(repeated.value.learningApplied, true);
  assert.equal(repeated.value.version.version, 2);
  const baseline = service("consent-granted").intakeIntent({ text: intentText });
  assert.ok(baseline.ok);
  if (baseline.ok) {
    assert.equal(baseline.value.version.version, 1);
    assert.equal(
      roundQualityScore(
        (repeated.value.version.state.quality.appearance ?? 0) - (baseline.value.version.state.quality.appearance ?? 0),
      ),
      0.08,
    );
  }
});

test("persist + replay: the serialized ledger reproduces the live projection exactly", () => {
  const svc = service("replay-test");
  const { solution } = freshSolution(svc);
  const feedback = svc.submitFeedback(solution.id, {
    targetRef: { kind: "quality", deficiencyClass: "geometry" },
    category: "geometry",
    userComment: "off",
    requestedAction: "improve",
  });
  assert.ok(feedback.ok);
  if (!feedback.ok) {
    return;
  }
  const evidence = svc.requestEvidence(solution.id, feedback.value.feedback.id);
  assert.ok(evidence.ok);
  if (!evidence.ok) {
    return;
  }
  assert.ok(svc.provideFixtureEvidence(solution.id, evidence.value.evidence.id).ok);
  assert.ok(svc.improveFromEvidence(solution.id, feedback.value.feedback.id).ok);
  const takeover = svc.beginTakeover(solution.id, { mode: "edit", evidenceMode: "inferred" });
  assert.ok(takeover.ok);
  if (!takeover.ok) {
    return;
  }
  assert.ok(
    svc.closeTakeoverWithCorrection(solution.id, takeover.value.session.id, {
      operations: [{ op: "adjust_quality", deficiencyClass: "identity", delta: 0.05 }],
    }).ok,
  );
  const gap = svc.recordFixtureCapabilityGap(solution.id, {
    category: "TOOL_GAP",
    confidence: 0.9,
    attemptedStrategies: [{ strategy: "fixture-tool-attempt", outcome: "failed", evidenceRef: null }],
  });
  assert.ok(gap.ok);
  if (!gap.ok) {
    return;
  }
  assert.ok(svc.escalateGapToArenaMock(solution.id, gap.value.gap.id).ok);
  assert.ok(svc.applyArenaResult(solution.id, gap.value.gap.id).ok);

  const serialized = svc.serializeLedgerOf(solution.id);
  assert.ok(serialized.ok);
  const live = svc.projectionOf(solution.id);
  assert.ok(live.ok);
  if (!serialized.ok || !live.ok) {
    return;
  }
  const parsed = parseLedgerEvents(serialized.value);
  assert.ok(parsed !== null);
  if (parsed === null) {
    return;
  }
  assert.ok(stableEquals(replayLedger(parsed), live.value));
  assert.equal(live.value.versions.length, 4);
  assert.equal(live.value.currentVersionId, live.value.versions[3]?.versionId);
  const serializedAgain = svc.serializeLedgerOf(solution.id);
  assert.ok(serializedAgain.ok);
  if (serializedAgain.ok) {
    assert.equal(serializedAgain.value, serialized.value);
  }
});

test("capability gap -> Arena mock -> typed result applied through the service authority", () => {
  const svc = service("arena-test");
  const { solution, version } = freshSolution(svc);
  const gap = svc.recordFixtureCapabilityGap(solution.id, {
    category: "TOOL_GAP",
    confidence: 0.9,
    attemptedStrategies: [
      { strategy: "fixture-tool-attempt", outcome: "failed", evidenceRef: null },
      { strategy: "quality-delta-fallback", outcome: "partial", evidenceRef: null },
    ],
  });
  assert.ok(gap.ok);
  if (!gap.ok) {
    return;
  }
  assert.equal(gap.value.gap.escalationEligibility, "eligible");
  const escalation = svc.escalateGapToArenaMock(solution.id, gap.value.gap.id);
  assert.ok(escalation.ok);
  if (!escalation.ok) {
    return;
  }
  assert.equal(escalation.value.gap.arenaEscalationRef?.status, "delivered");
  assert.equal(escalation.value.gap.arenaEscalationRef?.expertResult?.payload.replacementTool, "gltf-transform");
  const applied = svc.applyArenaResult(solution.id, gap.value.gap.id);
  assert.ok(applied.ok);
  if (!applied.ok) {
    return;
  }
  assert.equal(applied.value.version.version, 2);
  assert.equal(applied.value.changeSet.authorType, "expert");
  assert.equal(applied.value.gap.arenaEscalationRef?.status, "applied");
  assert.equal(applied.value.gap.arenaEscalationRef?.expertResult?.appliesAsChangeSetId, applied.value.changeSet.id);
  assert.equal(applied.value.version.state.quality.geometry, roundQualityScore((version.state.quality.geometry ?? 0) + 0.12));
  const projection = svc.projectionOf(solution.id);
  assert.ok(projection.ok);
  if (projection.ok) {
    assert.deepEqual(projection.value.capabilityGaps[gap.value.gap.id], "applied");
  }
  const ineligible = svc.recordFixtureCapabilityGap(solution.id, {
    category: "DATA_GAP",
    confidence: 0.2,
    attemptedStrategies: [{ strategy: "retry", outcome: "failed", evidenceRef: null }],
  });
  assert.ok(ineligible.ok);
  if (ineligible.ok) {
    const refused = svc.escalateGapToArenaMock(solution.id, ineligible.value.gap.id);
    assert.ok(!refused.ok);
    assert.equal(refused.error.code, "YOU_CAPABILITY_GAP");
  }
});

test("export -> simulated external edit -> re-import/diff -> candidate version", () => {
  const svc = service("interchange-test");
  const { solution } = freshSolution(svc);
  const editor = svc.recommendEditor(solution.id);
  assert.ok(editor.ok);
  if (!editor.ok) {
    return;
  }
  assert.equal(editor.value.editorId, "blender");
  const exported = svc.exportSolution(solution.id);
  assert.ok(exported.ok);
  if (!exported.ok) {
    return;
  }
  assert.equal(exported.value.artifact.manifest.simulated, true);
  const reImported = svc.simulateExternalEditAndReImport(solution.id, exported.value.artifact.id, {
    operations: [{ op: "adjust_quality", deficiencyClass: "composition", delta: 0.05 }],
  });
  assert.ok(reImported.ok);
  if (!reImported.ok) {
    return;
  }
  assert.equal(reImported.value.changeSet.authorType, "importer");
  assert.equal(reImported.value.version.version, 2);
  assert.deepEqual(reImported.value.diff.qualityDeltas, {
    appearance: 0,
    composition: 0.05,
    geometry: 0,
    identity: 0,
    "motion-naturalness": 0,
  });
  assert.notEqual(reImported.value.editedArtifact.id, exported.value.artifact.id);
  const missing = svc.simulateExternalEditAndReImport(solution.id, "you_artifact_missing01", { operations: [] });
  assert.ok(!missing.ok);
});
