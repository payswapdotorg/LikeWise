// Deterministic mock arena adapter tests (W8C) — coverage: byte-identical
// replay from the seed, seeded degradation (evidence dropout, recovery
// drift, result-type folding, strategy staleness, visible backoff
// misderivation), run-ladder laws (append-only, attempt numbering,
// terminal completion, content addressing), and the authorization law
// holding at the seam regardless of mock configuration.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import {
  ARENA_AUTHORIZATION_REQUIRED_CODE,
  ARENA_RESULT_TYPES,
  decodeArenaExpertResult,
  intendedRecoveryAt,
  intendedResultTypeFor,
  intendedRunStatusAt,
  intendedStrategyAt,
  neutralArenaRunId,
  type NeutralArenaInvocation,
} from "./arenaAdapterSeam.js";
import { createMockArenaAdapter, mockArenaGenerator, type MockArenaConfig } from "./mockArenaAdapter.js";
import { ARENA_BENCHMARK_FIXTURES, fixtureScenario } from "./arenaFixtures.js";
import { ARENA_BENCH_SUBMITTED_AT } from "./arenaRunner.js";
import { scoreArenaInvocation } from "./arenaScorer.js";

function benchmarkInvocation(fixtureIndex: number, candidateId: string): NeutralArenaInvocation {
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[fixtureIndex]!);
  return {
    requestId: `mock-${candidateId}`,
    provider: scenario.provider,
    gap: scenario.gap,
    retryLadder: scenario.retryLadder,
    escalationId: scenario.escalationId,
    authorization: scenario.authorization,
    submittedAt: ARENA_BENCH_SUBMITTED_AT,
  };
}

const ALL_CATEGORIES = Object.keys(ARENA_RESULT_TYPES);
const BASE_MOCK: MockArenaConfig = {
  id: "mock-under-test",
  servedCapabilityClasses: ["arena-automation", ...ALL_CATEGORIES.map((category) => `gap-category:${category}`)],
  supportedCategories: ALL_CATEGORIES,
  evidenceIngestRate: 1,
  recoveryDrift: 0,
  preservesResultTypes: true,
  followsStrategyLadder: true,
  honorsBackoffClass: true,
};

test("mock arena adapter: byte-identical replay from the seed (determinism)", () => {
  const configs: readonly MockArenaConfig[] = [
    BASE_MOCK,
    { ...BASE_MOCK, id: "mock-degraded-a", evidenceIngestRate: 0.6, recoveryDrift: 0.15 },
    { ...BASE_MOCK, id: "mock-degraded-b", evidenceIngestRate: 0.45, recoveryDrift: 0.25, preservesResultTypes: false, followsStrategyLadder: false, honorsBackoffClass: false },
  ];
  for (const config of configs) {
    const adapter = createMockArenaAdapter(config);
    for (let fixtureIndex = 0; fixtureIndex < ARENA_BENCHMARK_FIXTURES.length; fixtureIndex++) {
      const request = benchmarkInvocation(fixtureIndex, config.id);
      const first = adapter.invoke(request);
      const second = adapter.invoke(request);
      assert.equal(canonicalJson(first), canonicalJson(second), `${config.id}/fixture-${fixtureIndex}: byte-identical replay`);
      assert.equal(first.simulated, true);
      assert.equal((first.effort.latency as { marker?: string }).marker, "not-measured (simulated)");
    }
  }
  assert.equal(mockArenaGenerator(), "you-lab-mock-arena-adapter/1");
});

test("mock arena adapter: the run ladder follows the intended statuses and terminates at the first completion", () => {
  const adapter = createMockArenaAdapter(BASE_MOCK);
  for (let fixtureIndex = 0; fixtureIndex < ARENA_BENCHMARK_FIXTURES.length; fixtureIndex++) {
    const request = benchmarkInvocation(fixtureIndex, "mock-under-test");
    const output = adapter.invoke(request);
    const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[fixtureIndex]!);
    // ladder shape: attempts 1..N, statuses from the intended model, stop at first completed
    let expectedAttempt = 1;
    for (const record of output.runRecords) {
      assert.equal(record.attempt, expectedAttempt, `attempt numbering at ${expectedAttempt}`);
      assert.equal(record.gapId, scenario.gap.id, "gap identity threading");
      assert.equal(record.status, intendedRunStatusAt(scenario.gap.id, expectedAttempt), `status from the intended model at attempt ${expectedAttempt}`);
      assert.equal(record.id, neutralArenaRunId(configId(BASE_MOCK), request.requestId, expectedAttempt), "record id derivation");
      assert.equal(record.simulated, true);
      expectedAttempt += 1;
    }
    const completed = output.runRecords.filter((record) => record.status === "completed");
    assert.equal(completed.length <= 1, true, "at most one completed (terminal) record");
    if (completed.length === 1) {
      assert.equal(output.runRecords[output.runRecords.length - 1]?.status, "completed", "the completed record is last");
    }
    // the fixtures are authored to complete within their ladders
    assert.equal(completed.length, 1, `fixture ${fixtureIndex} completes within maxAttempts`);
  }
});

function configId(config: MockArenaConfig): string {
  return config.id;
}

test("mock arena adapter: seeded degradation is visible and honest (dropout, drift, folding, staleness, misbackoff)", () => {
  // evidence dropout + recovery drift: the precise mock covers everything exactly
  const precise = createMockArenaAdapter(BASE_MOCK).invoke(benchmarkInvocation(0, "mock-under-test"));
  const preciseParts = scoreArenaInvocation(benchmarkInvocation(0, "mock-under-test"), precise);
  assert.equal(preciseParts.evidenceCoverage, 1);
  assert.equal(preciseParts.outcomeFaithfulness, 1);
  assert.equal(preciseParts.recordIntegrity, 1);
  assert.equal(preciseParts.fidelityScore, 1);
  assert.deepEqual(precise.warnings, []);

  // degraded mock: partial coverage, drifted recovery, folded types
  const degradedConfig: MockArenaConfig = {
    ...BASE_MOCK,
    id: "mock-degraded",
    evidenceIngestRate: 0.5,
    recoveryDrift: 0.2,
    preservesResultTypes: false,
  };
  const degraded = createMockArenaAdapter(degradedConfig).invoke(benchmarkInvocation(0, "mock-degraded"));
  const degradedParts = scoreArenaInvocation(benchmarkInvocation(0, "mock-degraded"), degraded);
  assert.ok(degradedParts.evidenceCoverage < 1, "seeded dropout loses coverage");
  assert.ok(degradedParts.outcomeFaithfulness < 1, "drift + folding lose faithfulness");
  assert.equal(degradedParts.recordIntegrity, 1, "degradation never breaks structural integrity");
  const degradedPayload = degraded.runRecords.find((r) => r.status === "completed");
  assert.ok(degradedPayload);
  const decoded = decodeArenaExpertResult(degraded.payloads[degradedPayload.id] ?? {});
  assert.equal(decoded.resultType, "guidance", "types fold to guidance");
  assert.ok(degraded.warnings.some((w) => w.includes("result-type fidelity loss")));

  // stale strategy: every attempt reuses the first strategy (visible)
  const staleConfig: MockArenaConfig = { ...BASE_MOCK, id: "mock-stale", evidenceIngestRate: 1, followsStrategyLadder: false };
  const stale = createMockArenaAdapter(staleConfig).invoke(benchmarkInvocation(0, "mock-stale"));
  const staleScenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  for (const record of stale.runRecords) {
    assert.equal(record.strategy, intendedStrategyAt(staleScenario.gap.category, 1), "stale strategy is the first ladder entry");
  }
  assert.ok(stale.warnings.some((w) => w.includes("strategy-ladder staleness")));

  // misbackoff: derives under the token-bucket band, visible in the payload + warnings
  const misbackoffConfig: MockArenaConfig = { ...BASE_MOCK, id: "mock-misbackoff", honorsBackoffClass: false };
  const misbackoff = createMockArenaAdapter(misbackoffConfig).invoke(benchmarkInvocation(0, "mock-misbackoff"));
  const completed = misbackoff.runRecords.find((r) => r.status === "completed");
  assert.ok(completed);
  const payload = misbackoff.payloads[completed.id] ?? {};
  assert.equal(payload.backoffClass, "token-bucket", "the ACTUAL class is carried");
  assert.equal(payload.requestedBackoffClass, "exponential-backoff-jitter", "the REQUESTED class is carried");
  assert.notEqual(
    decodeArenaExpertResult(payload).recovery,
    intendedRecoveryAt(staleScenario.gap.id, "exponential-backoff-jitter"),
    "misderived recovery differs from the requested band",
  );
  assert.ok(misbackoff.warnings.some((w) => w.includes("backoff misderivation")));
  // the misderivation never breaks the hash binding (visible, not corrupt)
  const misbackoffParts = scoreArenaInvocation(benchmarkInvocation(0, "mock-misbackoff"), misbackoff);
  assert.equal(misbackoffParts.recordIntegrity, 1);
});

test("mock arena adapter: the authorization law holds regardless of mock configuration", () => {
  // even the most degraded mock cannot bypass the escalation gate
  const lawless: MockArenaConfig = {
    ...BASE_MOCK,
    id: "mock-lawless",
    evidenceIngestRate: 0.1,
    recoveryDrift: 0.4,
    preservesResultTypes: false,
    followsStrategyLadder: false,
    honorsBackoffClass: false,
  };
  const adapter = createMockArenaAdapter(lawless);
  const request = benchmarkInvocation(0, "mock-lawless");
  assert.throws(
    () => adapter.invoke({ ...request, authorization: null }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal((error as { code?: string }).code, ARENA_AUTHORIZATION_REQUIRED_CODE);
      return true;
    },
  );
  // precise mock with an expired grant is refused equally
  const preciseAdapter = createMockArenaAdapter(BASE_MOCK);
  assert.throws(
    () =>
      preciseAdapter.invoke({
        ...request,
        authorization: { ...request.authorization!, expiresAt: "2026-10-13T08:00:00Z" },
      }),
    /expired grants never run/,
  );
});

test("mock arena adapter: the precise mock reproduces the intended expert result exactly", () => {
  const request = benchmarkInvocation(1, "mock-under-test");
  const output = createMockArenaAdapter(BASE_MOCK).invoke(request);
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[1]!);
  const completed = output.runRecords.find((r) => r.status === "completed");
  assert.ok(completed);
  const decoded = decodeArenaExpertResult(output.payloads[completed.id] ?? {});
  assert.equal(decoded.resultType, intendedResultTypeFor(scenario.gap.category));
  assert.equal(decoded.recovery, intendedRecoveryAt(scenario.gap.id, scenario.retryLadder.backoffClass));
  assert.deepEqual([...decoded.evidenceRefs], [...scenario.gap.failureEvidence]);
  assert.equal(decoded.strategy, intendedStrategyAt(scenario.gap.category, decoded.attempt));
  assert.ok(decoded.finding.includes(scenario.gap.suggestedNextAction));
});
