import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { runLabFixtureScenario } from "./labFixtureScenario.js";

test("the scenario walks the full W9A chain (declare -> three arms -> evidence -> promote -> reverse -> re-promote)", () => {
  const trace = runLabFixtureScenario();
  // The three-arm comparison: five runs (baseline, hand-designed fail,
  // hand-designed retry, searched, one open baseline run).
  assert.equal(trace.runIds.length, 5);
  assert.deepEqual(trace.ladderWalk, [
    "submitted",
    "submitted",
    "submitted",
    "running",
    "succeeded",
    "running",
    "failed",
    "submitted",
    "running",
    "succeeded",
    "running",
    "succeeded",
    "submitted",
    "running",
  ]);
  // Three manifests: baseline bundle, searched bundle, searched re-publish.
  assert.equal(trace.manifestIds.length, 3);
  // The promotion chain: promote -> reverse -> promote (reversals are new records).
  assert.deepEqual(trace.decisionKinds, ["promote", "reverse", "promote"]);
  assert.equal(trace.promotionChain.length, 3);
  assert.equal(trace.simulated, true);
});

test("every refusal path is a typed error (never a silent skip)", () => {
  const trace = runLabFixtureScenario();
  const expected: readonly (readonly [string, string])[] = [
    ["experiment-arms-count", "YOU_INVALID_STATE"],
    ["experiment-arms-duplicate", "YOU_INVALID_STATE"],
    ["experiment-objective-empty", "YOU_INVALID_STATE"],
    ["run-unknown-experiment", "YOU_LAB_EXPERIMENT_NOT_FOUND"],
    ["run-arm-not-declared", "YOU_INVALID_STATE"],
    ["run-plan-hash-empty", "YOU_INVALID_STATE"],
    ["run-off-ladder", "YOU_INVALID_STATE"],
    ["run-unknown", "YOU_LAB_RUN_NOT_FOUND"],
    ["run-no-op-transition", "YOU_INVALID_STATE"],
    ["run-terminal-locked", "YOU_INVALID_STATE"],
    ["evidence-run-not-terminal", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["evidence-artifacts-empty", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["evidence-unknown-run", "YOU_LAB_RUN_NOT_FOUND"],
    ["manifest-verify-unknown", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["promotion-nothing-to-reverse", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-searched-does-not-beat", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-unknown-manifest", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["promotion-unknown-experiment", "YOU_LAB_EXPERIMENT_NOT_FOUND"],
    ["reversal-still-beats", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-unknown-read", "YOU_LAB_PROMOTION_INVALID"],
  ];
  for (const [key, code] of expected) {
    assert.equal(trace.refusalOutcomes[key], code, key);
  }
  assert.equal(Object.keys(trace.refusalOutcomes).length, expected.length);
});

test("all three wave-9 events ride the ledger with the exact scripted counts", () => {
  const trace = runLabFixtureScenario();
  assert.equal(trace.eventCounts["lab-run-recorded"] ?? 0, 14);
  assert.equal(trace.eventCounts["lab-evidence-published"] ?? 0, 3);
  assert.equal(trace.eventCounts["lab-promotion-decided"] ?? 0, 3);
  assert.equal(trace.eventCount, 20);
});

test("the tampered-manifest verification fails closed (the shared mismatch authority)", () => {
  const trace = runLabFixtureScenario();
  const verified = trace.steps.find((scenarioStep) => scenarioStep.name === "manifests-verified");
  assert.ok(verified !== undefined);
  assert.equal(verified.facts["tamperRefusal"], "content-hash-mismatch");
  assert.equal(verified.facts["baselineVerified"], true);
  assert.equal(verified.facts["searchedVerified"], true);
});

test("the live projection equals the ledger replay exactly", () => {
  const trace = runLabFixtureScenario();
  assert.equal(trace.projectionMatchesReplay, true);
});

test("byte-identical replay: the same seed produces the identical trace (x2)", () => {
  const first = runLabFixtureScenario();
  const second = runLabFixtureScenario();
  assert.equal(stableStringify(first), stableStringify(second));
  const third = runLabFixtureScenario({ seed: "you-w9a-lab-scenario" });
  assert.equal(stableStringify(first), stableStringify(third));
  // A different seed diverges (the seed is load-bearing).
  const other = runLabFixtureScenario({ seed: "you-w9a-lab-scenario-alt" });
  assert.notEqual(stableStringify(first), stableStringify(other));
});

test("every step fact set stays simulated (truth law)", () => {
  const trace = runLabFixtureScenario();
  for (const scenarioStep of trace.steps) {
    const simulated = scenarioStep.facts["simulated"];
    if (simulated !== undefined) {
      assert.equal(simulated, true, scenarioStep.name);
    }
  }
  assert.equal(trace.simulated, true);
});
