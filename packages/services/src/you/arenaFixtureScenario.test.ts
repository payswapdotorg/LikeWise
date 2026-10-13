import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { runArenaFixtureScenario } from "./arenaFixtureScenario.js";

test("the scenario walks the full W8A chain (gap -> runs -> authorization -> lifecycle -> applied -> permission)", () => {
  const trace = runArenaFixtureScenario();
  // The run ladder: fail -> fail, then the attempt gate refuses.
  assert.deepEqual(trace.ladderWalk, [
    "started",
    "failed",
    "started",
    "failed",
    "requested",
    "authorized",
    "in-progress",
    "delivered",
    "applied",
  ]);
  assert.equal(trace.runIds.length, 3);
  // The authorization lifecycle on gap two: grant (active) -> materialized expiry.
  assert.deepEqual(trace.authorizationChainTwoStatuses, ["active", "expired"]);
  // The learning permission trail: aggregate -> full (new records on change).
  assert.deepEqual(trace.learningPermissionTrail, ["aggregate", "full"]);
  // Both projections published.
  assert.equal(trace.projectionCount, 2);
  assert.equal(trace.simulated, true);
});

test("every refusal path is a typed error (never a silent skip)", () => {
  const trace = runArenaFixtureScenario();
  const expected: readonly (readonly [string, string])[] = [
    ["policy-max-attempts-zero", "YOU_RETRY_POLICY_INVALID"],
    ["policy-backoff-invalid", "YOU_RETRY_POLICY_INVALID"],
    ["policy-eligibility-empty", "YOU_RETRY_POLICY_INVALID"],
    ["run-attempt-exceeds-max", "YOU_RETRY_POLICY_INVALID"],
    ["unauthorized-escalation", "YOU_ESCALATION_AUTHORIZATION_REQUIRED"],
    ["unknown-provider", "YOU_ARENA_ADAPTER_UNSUPPORTED"],
    ["apply-before-delivery", "YOU_ESCALATION_STATE_INVALID"],
    ["reject-after-applied", "YOU_ESCALATION_STATE_INVALID"],
    ["expired-authorization", "YOU_ESCALATION_AUTHORIZATION_REQUIRED"],
    ["projection-wrong-category", "YOU_GAP_PROJECTION_INVALID"],
    ["unknown-run", "YOU_ARENA_RUN_NOT_FOUND"],
    ["unknown-escalation", "YOU_ESCALATION_NOT_FOUND"],
  ];
  for (const [key, code] of expected) {
    assert.equal(trace.refusalOutcomes[key], code, key);
  }
  assert.equal(Object.keys(trace.refusalOutcomes).length, expected.length);
});

test("all five wave-8 events ride the ledger (plus the v1 escalation events)", () => {
  const trace = runArenaFixtureScenario();
  assert.equal((trace.eventCounts["arena-run-recorded"] ?? 0) >= 3, true);
  assert.equal((trace.eventCounts["escalation-authorized"] ?? 0) >= 3, true);
  assert.equal((trace.eventCounts["escalation-cancelled"] ?? 0) >= 2, true);
  assert.equal((trace.eventCounts["learning-permission-recorded"] ?? 0) >= 2, true);
  assert.equal((trace.eventCounts["gap-projection-published"] ?? 0) >= 2, true);
  assert.equal((trace.eventCounts["capability-gap-detected"] ?? 0) >= 3, true);
  assert.equal((trace.eventCounts["arena-escalation-requested"] ?? 0) >= 3, true);
  assert.equal((trace.eventCounts["arena-result-applied"] ?? 0) >= 1, true);
});

test("the live projection equals the ledger replay exactly", () => {
  const trace = runArenaFixtureScenario();
  assert.equal(trace.projectionMatchesReplay, true);
});

test("byte-identical replay: the same seed produces the identical trace (x2)", () => {
  const first = runArenaFixtureScenario();
  const second = runArenaFixtureScenario();
  assert.equal(stableStringify(first), stableStringify(second));
  const third = runArenaFixtureScenario({ seed: "you-w8a-arena-scenario" });
  assert.equal(stableStringify(first), stableStringify(third));
  // A different seed diverges (the seed is load-bearing).
  const other = runArenaFixtureScenario({ seed: "you-w8a-arena-scenario-alt" });
  assert.notEqual(stableStringify(first), stableStringify(other));
});

test("every step fact set stays simulated (truth law)", () => {
  const trace = runArenaFixtureScenario();
  for (const scenarioStep of trace.steps) {
    const simulated = scenarioStep.facts["simulated"];
    if (simulated !== undefined) {
      assert.equal(simulated, true, scenarioStep.name);
    }
  }
  assert.equal(trace.simulated, true);
});
