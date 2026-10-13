// Contract seam v8 tests (W8C) — coverage: adapter outputs construct VALID
// frozen v8 shapes through the single seam module (ArenaProviderDescriptor
// / CapabilityGap / ArenaRun / ArenaRetryPolicy / EscalationAuthorization
// / ToolGapProjection / KnowledgeGapProjection), the category/eligibility/
// status/learning-permission/backoff-class mappings are 1:1 at the seam,
// the identity law holds on the full path (adapters never mint gap or
// request identity), projections derive from gap records, and effort
// observations carry honest markers.
import assert from "node:assert/strict";
import test from "node:test";
import {
  arenaThroughAdapter,
  mapArenaBackoffClass,
  mapArenaEscalationStatus,
  mapArenaLearningPermission,
  mapArenaRunStatus,
  mapCapabilityGapCategory,
  mapEscalationEligibility,
  toArenaEffortObservations,
  toFrozenArenaProviderDescriptor,
  toFrozenArenaRetryPolicy,
  toFrozenArenaRun,
  toFrozenCapabilityGap,
  toFrozenEscalationAuthorization,
  toFrozenKnowledgeGapProjection,
  toFrozenToolGapProjection,
} from "../contractSeam.js";
import { createRetryBackoffRegistry } from "../technology/retryBackoffSeedProfiles.js";
import { createPRetryBackoffArenaEvaluationAdapter, P_RETRY_EVALUATION_ADAPTER_ID } from "./pRetryEvaluationAdapter.js";
import { ARENA_BENCH_SUBMITTED_AT, runStandardArenaBenchmark } from "./arenaRunner.js";
import { createStandardArenaCandidates } from "./arenaCandidates.js";
import { ARENA_BENCHMARK_FIXTURES, fixtureScenario, synthesizeArenaScenario } from "./arenaFixtures.js";
import { buildKnowledgeGapProjection, buildToolGapProjection } from "./gapProjections.js";
import type { NeutralArenaInvocation } from "./arenaAdapterSeam.js";

const registry = createRetryBackoffRegistry();

function seamInvocation(): NeutralArenaInvocation {
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  return {
    requestId: "seam-arena-req-1",
    provider: scenario.provider,
    gap: scenario.gap,
    retryLadder: scenario.retryLadder,
    escalationId: scenario.escalationId,
    authorization: scenario.authorization,
    submittedAt: ARENA_BENCH_SUBMITTED_AT,
  };
}

test("contract seam v8: category/eligibility/status/permission mappings are 1:1 and validated", () => {
  for (const category of ["TOOL_GAP", "EDITOR_GAP", "MODEL_GAP", "SKILL_GAP", "KNOWLEDGE_GAP", "DATA_GAP", "EXPERT_GAP"]) {
    assert.equal(mapCapabilityGapCategory(category), category);
  }
  for (const eligibility of ["not-eligible", "eligible", "escalated"]) {
    assert.equal(mapEscalationEligibility(eligibility), eligibility);
  }
  for (const status of ["started", "completed", "failed", "aborted"]) {
    assert.equal(mapArenaRunStatus(status), status);
  }
  for (const permission of ["none", "aggregate", "full"]) {
    assert.equal(mapArenaLearningPermission(permission), permission);
  }
  for (const status of ["requested", "authorized", "in-progress", "delivered", "applied", "rejected", "cancelled"]) {
    assert.equal(mapArenaEscalationStatus(status), status);
  }
  assert.throws(() => mapCapabilityGapCategory("SPIRIT_GAP" as never), /no frozen v1\/v8 mapping/);
  assert.throws(() => mapCapabilityGapCategory(""), /empty gap category/);
  assert.throws(() => mapEscalationEligibility("maybe" as never), /no frozen v1 mapping/);
  assert.throws(() => mapArenaRunStatus("paused" as never), /no frozen v8 mapping/);
  assert.throws(() => mapArenaLearningPermission("sometimes" as never), /no frozen v8 mapping/);
  assert.throws(() => mapArenaEscalationStatus("paused"), /seven-state escalation ladder/);
});

test("contract seam v8: the backoff-class vocabulary is the W8C authored four-class table", () => {
  for (const backoffClass of ["circuit-breaker", "hedged-request", "exponential-backoff-jitter", "token-bucket"]) {
    assert.equal(mapArenaBackoffClass(backoffClass), backoffClass);
  }
  assert.throws(() => mapArenaBackoffClass("linear-backoff" as never), /outside the W8C authored backoff vocabulary/);
  assert.throws(() => mapArenaBackoffClass(""), /empty backoff class/);
});

test("contract seam v8: toFrozenArenaProviderDescriptor + toFrozenArenaRetryPolicy map 1:1", () => {
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  const provider = toFrozenArenaProviderDescriptor(scenario.provider);
  assert.equal(provider.id, scenario.provider.id);
  assert.equal(provider.providerKind, scenario.provider.providerKind);
  assert.deepEqual(provider.capabilityClasses, [...scenario.provider.capabilityClasses]);
  assert.equal(provider.endpointRef, null);
  assert.throws(() => toFrozenArenaProviderDescriptor({ ...scenario.provider, id: "" }), /empty id/);
  assert.throws(() => toFrozenArenaProviderDescriptor({ ...scenario.provider, capabilityClasses: [] }), /empty capabilityClasses/);

  const policy = toFrozenArenaRetryPolicy(scenario.retryLadder);
  assert.equal(policy.maxAttempts, scenario.retryLadder.maxAttempts);
  assert.equal(policy.backoffClass, "exponential-backoff-jitter");
  assert.deepEqual(policy.eligibilityCategories, ["TOOL_GAP"]);
  assert.equal(policy.requiresAuthorization, true);
  assert.throws(() => toFrozenArenaRetryPolicy({ ...scenario.retryLadder, maxAttempts: 0 }), /maxAttempts/);
  assert.throws(() => toFrozenArenaRetryPolicy({ ...scenario.retryLadder, eligibilityCategories: [] }), /eligibilityCategories/);
});

test("contract seam v8: toFrozenCapabilityGap maps the gap 1:1 with the escalation ref injected", () => {
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  const gap = toFrozenCapabilityGap({ gap: scenario.gap, arenaEscalationRef: null });
  assert.equal(gap.id, scenario.gap.id);
  assert.equal(gap.intentRef, scenario.gap.intentRef);
  assert.equal(gap.category, "TOOL_GAP");
  assert.equal(gap.attemptedStrategies.length, scenario.gap.attemptedStrategies.length);
  assert.deepEqual(gap.failureEvidence, [...scenario.gap.failureEvidence]);
  assert.equal(gap.escalationEligibility, "escalated");
  assert.equal(gap.arenaEscalationRef, null);
  // with an escalation ref + expert result
  const withRef = toFrozenCapabilityGap({
    gap: scenario.gap,
    arenaEscalationRef: {
      escalationId: "you_escalation_seamtest",
      status: "delivered",
      minimumContext: ["ctx-1"],
      expertResult: {
        deliveredAt: ARENA_BENCH_SUBMITTED_AT,
        resultType: "typed-payload",
        payload: { recovery: 0.9 },
        appliesAsChangeSetId: null,
      },
    },
  });
  assert.equal(withRef.arenaEscalationRef?.escalationId, "you_escalation_seamtest");
  assert.equal(withRef.arenaEscalationRef?.status, "delivered");
  assert.equal(withRef.arenaEscalationRef?.expertResult?.payload.recovery, 0.9);
  // malformed inputs are typed rejections
  assert.throws(() => toFrozenCapabilityGap({ gap: { ...scenario.gap, id: "" }, arenaEscalationRef: null }), /empty gap id/);
  assert.throws(
    () => toFrozenCapabilityGap({ gap: scenario.gap, arenaEscalationRef: { escalationId: "e", status: "paused", minimumContext: [], expertResult: null } }),
    /seven-state escalation ladder/,
  );
});

test("contract seam v8: toFrozenEscalationAuthorization + toFrozenArenaRun map 1:1", () => {
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  assert.ok(scenario.authorization);
  const authorization = toFrozenEscalationAuthorization(scenario.authorization);
  assert.equal(authorization.id, scenario.authorization.authorizationId);
  assert.equal(authorization.escalationId, scenario.escalationId);
  assert.equal(authorization.learningPermission, "aggregate");
  assert.equal(authorization.expiresAt, null);
  assert.throws(() => toFrozenEscalationAuthorization({ ...scenario.authorization!, scope: "" }), /empty scope/);

  const adapter = createPRetryBackoffArenaEvaluationAdapter(registry);
  const output = adapter.invoke(seamInvocation());
  const runs = output.runRecords.map(toFrozenArenaRun);
  assert.equal(runs.length, output.runRecords.length);
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index]!;
    const record = output.runRecords[index]!;
    assert.equal(run.id, record.id);
    assert.equal(run.gapId, scenario.gap.id);
    assert.equal(run.attempt, index + 1);
    assert.equal(run.status, record.status);
    assert.equal(run.simulated, true, "truth law: fixture arena runs stay labeled simulated");
  }
  assert.throws(() => toFrozenArenaRun({ ...output.runRecords[0]!, attempt: 0 }), /attempt must be an integer >= 1/);
});

test("contract seam v8: arenaThroughAdapter constructs the full frozen v8 path with the identity law", () => {
  const adapter = createPRetryBackoffArenaEvaluationAdapter(registry);
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  const path = arenaThroughAdapter(adapter, seamInvocation(), {
    escalationId: scenario.escalationId!,
    status: "in-progress",
    minimumContext: ["gap-record", "retry-ladder"],
    expertResult: null,
  });
  assert.equal(path.provider.id, scenario.provider.id);
  assert.equal(path.gap.id, scenario.gap.id);
  assert.equal(path.gap.arenaEscalationRef?.escalationId, scenario.escalationId);
  assert.ok(path.runs.length >= 1);
  assert.ok(path.runs.every((run) => run.gapId === scenario.gap.id));
  assert.ok(path.runs.every((run) => run.simulated === true));
  assert.equal(path.output.requestId, "seam-arena-req-1");
  // identity law: an adapter minting records for another gap is refused
  const minter = {
    profile: adapter.profile,
    invoke(request: NeutralArenaInvocation) {
      const output = adapter.invoke(request);
      return {
        ...output,
        runRecords: output.runRecords.map((record) => ({ ...record, gapId: "you_gap_someoneelse" })),
      };
    },
  };
  assert.throws(
    () => arenaThroughAdapter(minter as never, seamInvocation(), null),
    /identity law — adapters never mint gap identity/,
  );
});

test("contract seam v8: ToolGap/Knowledge projections map onto the frozen v8 projection shapes", () => {
  const toolScenario = synthesizeArenaScenario("seam-tool-projection", {
    category: "TOOL_GAP",
    attemptedStrategyCount: 2,
    evidenceRefCount: 3,
    maxAttempts: 2,
    backoffClass: "exponential-backoff-jitter",
    requiresAuthorization: false,
  });
  const toolProjection = toFrozenToolGapProjection(buildToolGapProjection(toolScenario.gap));
  assert.equal(toolProjection.gapId, toolScenario.gap.id);
  assert.equal(toolProjection.toolId, null);
  assert.ok(toolProjection.requiredCapability.length > 0);
  assert.ok(toolProjection.remediation.includes("projection, never an authority"));

  const knowledgeScenario = synthesizeArenaScenario("seam-knowledge-projection", {
    category: "KNOWLEDGE_GAP",
    attemptedStrategyCount: 1,
    evidenceRefCount: 2,
    maxAttempts: 1,
    backoffClass: "circuit-breaker",
    requiresAuthorization: false,
  });
  const knowledgeProjection = toFrozenKnowledgeGapProjection(buildKnowledgeGapProjection(knowledgeScenario.gap));
  assert.equal(knowledgeProjection.gapId, knowledgeScenario.gap.id);
  assert.equal(knowledgeProjection.missingKnowledgeRef, null);
  assert.ok(knowledgeProjection.domain.length > 0);
  assert.throws(() => toFrozenToolGapProjection({ gapId: "", toolId: null, requiredCapability: "c", remediation: "r" }), /empty gapId/);
});

test("contract seam v8: toArenaEffortObservations carries honest not-measured markers", () => {
  const report = runStandardArenaBenchmark(createStandardArenaCandidates(registry));
  const evaluation = report.candidateResults.find((entry) => entry.candidateId === P_RETRY_EVALUATION_ADAPTER_ID);
  assert.ok(evaluation);
  const observations = toArenaEffortObservations(evaluation);
  assert.equal(observations.simulated, true);
  assert.equal(observations.fixtureCount, 3);
  assert.equal(observations.arenaEffort, "not-measured (simulated)");
  assert.equal(observations["latencyMs.measured"], false);
  assert.equal(observations["costUnits.measured"], false);
});
