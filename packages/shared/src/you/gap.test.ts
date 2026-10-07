import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { AttemptedStrategy } from "./contract.js";
import { buildFixtureSnapshot } from "./fixture.js";
import {
  ARENA_FIXTURE_DELIVERED_AT,
  ARENA_MINIMUM_CONTEXT,
  ARENA_MOCK_EXPERT_RESULTS,
  arenaResultToOperations,
  computeEscalationEligibility,
  deliverFixtureExpertResult,
  markArenaResultApplied,
  recordCapabilityGap,
  requestArenaEscalation,
} from "./gap.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { roundQualityScore } from "./quality.js";
import { SolutionVersionChain } from "./versioning.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(81)) };
const STRATEGIES: readonly AttemptedStrategy[] = [
  { strategy: "fixture-tool-attempt", outcome: "failed", evidenceRef: null },
  { strategy: "quality-delta-fallback", outcome: "partial", evidenceRef: null },
];

test("escalation eligibility requires attempts and confidence", () => {
  assert.equal(computeEscalationEligibility({ attemptedStrategies: STRATEGIES, confidence: 0.9 }), "eligible");
  assert.equal(computeEscalationEligibility({ attemptedStrategies: [], confidence: 0.9 }), "not-eligible");
  assert.equal(computeEscalationEligibility({ attemptedStrategies: STRATEGIES, confidence: 0.3 }), "not-eligible");
});

test("recordCapabilityGap captures attempted strategies and immutable state", () => {
  const gap = recordCapabilityGap(
    { attemptedStrategies: STRATEGIES, category: "TOOL_GAP", confidence: 0.9, suggestedNextAction: "escalate-to-arena", intentRef: "you_intent_gap00000001" },
    DEPS,
  );
  assert.match(gap.id, /^you_gap_[0-9a-f]{16}$/);
  assert.equal(gap.category, "TOOL_GAP");
  assert.equal(gap.confidence, 0.9);
  assert.deepEqual(gap.attemptedStrategies, STRATEGIES);
  assert.equal(gap.escalationEligibility, "eligible");
  assert.equal(gap.arenaEscalationRef, null);
  assert.ok(Object.isFrozen(gap));
  assert.throws(() =>
    recordCapabilityGap({ attemptedStrategies: [], category: "TOOL_GAP", confidence: 0.9, suggestedNextAction: "x" }, DEPS),
  );
});

test("requestArenaEscalation moves an eligible gap to escalated with a context capsule", () => {
  const gap = recordCapabilityGap(
    { attemptedStrategies: STRATEGIES, category: "SKILL_GAP", confidence: 0.8, suggestedNextAction: "escalate" },
    DEPS,
  );
  const { gap: escalated, escalation } = requestArenaEscalation(gap, DEPS);
  assert.equal(escalated.escalationEligibility, "escalated");
  assert.equal(escalation.status, "requested");
  assert.equal(escalation.expertResult, null);
  assert.deepEqual(escalation.minimumContext, ARENA_MINIMUM_CONTEXT);
  assert.equal(gap.escalationEligibility, "eligible");
  assert.throws(() => requestArenaEscalation(escalated, DEPS));
  const weak = recordCapabilityGap(
    { attemptedStrategies: STRATEGIES, category: "TOOL_GAP", confidence: 0.2, suggestedNextAction: "x" },
    DEPS,
  );
  assert.throws(() => requestArenaEscalation(weak, DEPS));
});

test("the Arena mock returns a typed expert result per category from the fixture table", () => {
  const recorded = recordCapabilityGap(
    { attemptedStrategies: STRATEGIES, category: "TOOL_GAP", confidence: 0.9, suggestedNextAction: "x" },
    DEPS,
  );
  const requested = requestArenaEscalation(recorded, DEPS);
  const delivered = deliverFixtureExpertResult(requested.gap);
  assert.equal(delivered.gap.arenaEscalationRef?.status, "delivered");
  assert.equal(delivered.result.deliveredAt, ARENA_FIXTURE_DELIVERED_AT);
  assert.equal(delivered.result.resultType, "typed-payload");
  assert.deepEqual(delivered.result.payload, { remediation: "tool-substitution", replacementTool: "gltf-transform", qualityBoost: 0.12 });
  assert.equal(delivered.result.appliesAsChangeSetId, null);
  for (const [category, result] of Object.entries(ARENA_MOCK_EXPERT_RESULTS)) {
    assert.equal(result.deliveredAt, ARENA_FIXTURE_DELIVERED_AT);
    assert.ok(category.length > 0);
  }
});

test("arenaResultToOperations expresses the typed result as deterministic operations", () => {
  const recorded = recordCapabilityGap(
    { attemptedStrategies: STRATEGIES, category: "TOOL_GAP", confidence: 0.9, suggestedNextAction: "x" },
    DEPS,
  );
  const requested = requestArenaEscalation(recorded, DEPS);
  const delivered = deliverFixtureExpertResult(requested.gap);
  assert.deepEqual(arenaResultToOperations(delivered.gap, delivered.result), [
    { op: "adjust_quality", deficiencyClass: "geometry", delta: 0.12 },
  ]);
});

test("CapabilityGap -> Arena mock -> typed result -> applied through YOU's own ChangeSet authority", () => {
  const chainDeps = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(82)) };
  const created = SolutionVersionChain.createRoot({
    solution: { id: "you_solution_gaptest01", workspaceIdentity: "ws-gap", displayName: "Gap Test" },
    snapshot: buildFixtureSnapshot("gap-test"),
    provenanceSource: "fixture:gap-test",
    deps: chainDeps,
  });
  const recorded = recordCapabilityGap(
    { attemptedStrategies: STRATEGIES, category: "TOOL_GAP", confidence: 0.9, suggestedNextAction: "escalate-to-arena" },
    DEPS,
  );
  const escalated = requestArenaEscalation(recorded, DEPS).gap;
  const delivered = deliverFixtureExpertResult(escalated);
  const operations = arenaResultToOperations(delivered.gap, delivered.result);
  const changeSet = created.chain.propose({
    baseVersionId: created.chain.current().id,
    operations,
    authorType: "expert",
    intentRef: "you_intent_gap00000001",
  });
  const accepted = created.chain.accept(changeSet);
  assert.ok(accepted.ok);
  assert.equal(accepted.changeSet.authorType, "expert");
  assert.equal(accepted.version.version, 2);
  const applied = markArenaResultApplied(delivered.gap, accepted.changeSet.id);
  assert.equal(applied.arenaEscalationRef?.status, "applied");
  assert.equal(applied.arenaEscalationRef?.expertResult?.appliesAsChangeSetId, accepted.changeSet.id);
  assert.equal(
    accepted.version.state.quality.geometry,
    roundQualityScore((created.root.state.quality.geometry ?? 0) + 0.12),
  );
  assert.throws(() => markArenaResultApplied(recorded, accepted.changeSet.id));
});
