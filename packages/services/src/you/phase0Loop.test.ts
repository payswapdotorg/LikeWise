import assert from "node:assert/strict";
import test from "node:test";
import { runPhase0LoopScenario } from "./phase0Loop.js";
import { createSolutionService, SolutionService } from "./solutionService.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";

const EXPECTED_STEP_NAMES = [
  "intent-intake",
  "feedback-submitted",
  "evidence-requested",
  "evidence-provided",
  "deterministic-improvement",
  "takeover-opened",
  "takeover-correction-accepted",
  "learning-derived",
  "editor-recommended",
  "artifact-exported",
  "external-edit-reimported",
  "repeated-intent",
  "capability-gap-recorded",
  "arena-escalation-delivered",
  "arena-result-applied",
];

test("the full Phase-0 loop runs and records every scripted step", () => {
  const service = createSolutionService({ workspaceIdentity: "ws-phase0", seed: "you-phase0-loop" });
  const trace = runPhase0LoopScenario(service);
  assert.deepEqual(
    trace.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  assert.equal(trace.steps.length, 15);
  for (let index = 0; index < trace.steps.length; index += 1) {
    assert.equal(trace.steps[index]?.step, index + 1);
  }
});

test("the Phase-0 loop is deterministic: two runs produce byte-identical traces", () => {
  const first = runPhase0LoopScenario(
    createSolutionService({ workspaceIdentity: "ws-phase0", seed: "you-phase0-loop" }),
  );
  const second = runPhase0LoopScenario(
    createSolutionService({ workspaceIdentity: "ws-phase0", seed: "you-phase0-loop" }),
  );
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.solutionId, second.solutionId);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.eventCount, second.eventCount);
});

test("the Phase-0 loop satisfies the gate facts: learning, gap, arena, versions", () => {
  const service = createSolutionService({ workspaceIdentity: "ws-phase0", seed: "you-phase0-loop" });
  const trace = runPhase0LoopScenario(service);
  assert.equal(trace.learningAppliedOnRepeat, true);
  assert.equal(trace.escalationStatus, "applied");
  assert.equal(trace.finalVersionNumber, 5);
  assert.ok(trace.eventCount >= 15);
  assert.ok(trace.finalQuality.geometry !== undefined);

  const improvement = trace.steps.find((step) => step.name === "deterministic-improvement");
  assert.ok(improvement !== undefined);
  assert.equal(improvement.facts.delta, 0.15);
  assert.equal(improvement.facts.feedbackStatus, "addressed");
  assert.equal(improvement.facts.evidenceStatus, "fulfilled");
  const geometryBefore = Number(improvement.facts.before);
  const geometryAfter = Number(improvement.facts.after);
  assert.equal(Math.round((geometryAfter - geometryBefore) * 10000) / 10000, 0.15);

  const takeover = trace.steps.find((step) => step.name === "takeover-opened");
  assert.ok(takeover !== undefined);
  assert.equal(takeover.facts.mode, "correct");
  assert.equal(takeover.facts.learningPermission, true);

  const learning = trace.steps.find((step) => step.name === "learning-derived");
  assert.ok(learning !== undefined);
  assert.equal(learning.facts.stored, true);
  assert.equal(learning.facts.scope, "USER");

  const repeated = trace.steps.find((step) => step.name === "repeated-intent");
  assert.ok(repeated !== undefined);
  assert.equal(repeated.facts.learningApplied, true);
  assert.equal(repeated.facts.versionNumber, 2);

  const gap = trace.steps.find((step) => step.name === "capability-gap-recorded");
  assert.ok(gap !== undefined);
  assert.equal(gap.facts.category, "TOOL_GAP");
  assert.equal(gap.facts.escalationEligibility, "eligible");
  assert.equal(gap.facts.simulated, true);

  const delivered = trace.steps.find((step) => step.name === "arena-escalation-delivered");
  assert.ok(delivered !== undefined);
  assert.equal(delivered.facts.resultType, "typed-payload");
  assert.equal(delivered.facts.simulated, true);

  const applied = trace.steps.find((step) => step.name === "arena-result-applied");
  assert.ok(applied !== undefined);
  assert.equal(applied.facts.escalationStatus, "applied");
  assert.equal(applied.facts.authorType, "expert");
});

test("custom intent text changes the fingerprint but keeps the loop shape", () => {
  const service = createSolutionService({ workspaceIdentity: "ws-phase0", seed: "you-phase0-loop" });
  const trace = runPhase0LoopScenario(service, { intentText: "a different deterministic intent" });
  assert.notEqual(trace.intentFingerprint, runPhase0LoopScenario(service).intentFingerprint);
  assert.equal(trace.steps.length, 15);
});

test("the loop's ledger replay matches the live projection", () => {
  const service = createSolutionService({ workspaceIdentity: "ws-phase0", seed: "you-phase0-loop" });
  const trace = runPhase0LoopScenario(service);
  const events = service.ledgerEventsOf(trace.solutionId);
  assert.ok(events.ok);
  const projection = service.projectionOf(trace.solutionId);
  assert.ok(projection.ok);
  if (!events.ok || !projection.ok) {
    return;
  }
  const replayed = SolutionService.replay(events.value);
  assert.equal(stableStringify(replayed), stableStringify(projection.value));
});
