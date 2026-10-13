import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { runLabFixtureScenario } from "./labFixtureScenario.js";

test("the scenario walks the full W9A chain (experiment -> three arms -> evidence -> promotion -> reversal)", () => {
  const trace = runLabFixtureScenario();
  // The run ladder: baseline (submitted -> running -> succeeded),
  // hand-designed (succeeded), searched attempt one (retired), searched
  // attempt two (succeeded) — refused moves never walk.
  assert.deepEqual(trace.ladderWalk, [
    "submitted",
    "running",
    "succeeded",
    "submitted",
    "running",
    "succeeded",
    "submitted",
    "running",
    "retired",
    "submitted",
    "running",
    "succeeded",
  ]);
  assert.equal(trace.simulated, true);
});

test("every refusal path is a typed error (never a silent skip)", () => {
  const trace = runLabFixtureScenario();
  const expected: readonly (readonly [string, string])[] = [
    ["experiment-arms-missing", "YOU_INVALID_STATE"],
    ["experiment-arms-duplicate", "YOU_INVALID_STATE"],
    ["evidence-run-not-terminal", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["run-off-ladder", "YOU_INVALID_STATE"],
    ["run-no-op-transition", "YOU_INVALID_STATE"],
    ["run-terminal-locked", "YOU_INVALID_STATE"],
    ["manifest-artifacts-empty", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["manifest-run-already-carries", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["manifest-unknown", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
    ["promotion-searched-does-not-beat-baseline", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-run-arm-mismatch-baseline", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-run-not-succeeded", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-manifest-not-bound-to-searched-run", "YOU_LAB_PROMOTION_INVALID"],
    ["reversal-no-promotion-to-reverse", "YOU_LAB_PROMOTION_INVALID"],
    ["promotion-unknown-experiment", "YOU_LAB_EXPERIMENT_NOT_FOUND"],
    ["promotion-unknown-run", "YOU_LAB_RUN_NOT_FOUND"],
    ["reversal-requires-baseline-win", "YOU_LAB_PROMOTION_INVALID"],
  ];
  for (const [key, code] of expected) {
    assert.equal(trace.refusalOutcomes[key], code, key);
  }
  assert.equal(Object.keys(trace.refusalOutcomes).length, expected.length);
});

test("all three wave-9 events ride the ledger in the expected counts", () => {
  const trace = runLabFixtureScenario();
  // 4 runs x 3 transitions (submitted, running, terminal) = 12 run events;
  // 2 manifests published; 1 promotion + 1 reversal decided.
  assert.equal(trace.eventCounts["lab-run-recorded"], 12);
  assert.equal(trace.eventCounts["lab-evidence-published"], 2);
  assert.equal(trace.eventCounts["lab-promotion-decided"], 2);
  assert.equal(Object.keys(trace.eventCounts).length, 3);
  assert.equal(trace.eventCount, 16);
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
