import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { runLaunchGateFixtureScenario } from "./launchGateFixtureScenario.js";

test("the scenario walks the full W12A chain (journeys run -> checklist assembled -> gate passes -> operator signs -> release declared)", () => {
  const trace = runLaunchGateFixtureScenario();
  // The chain walk: the work-order arrow, in order.
  assert.deepEqual(trace.chainWalk, ["journeys-run", "checklist-assembled", "gate-passed", "operator-signed", "release-declared"]);
  // 20 golden journeys; two checklists (the passing gate + the honest-failure gate); one signoff; one declaration.
  assert.equal(trace.goldenJourneyIds.length, 20);
  assert.equal(trace.checklistIds.length, 2);
  assert.equal(trace.passingChecklistId.length > 0, true);
  assert.equal(trace.failingChecklistId.length > 0, true);
  assert.equal(trace.signoffId.length > 0, true);
  assert.equal(trace.declarationId.length > 0, true);
  assert.equal(trace.simulated, true);
});

test("every refusal path is a typed error (never a silent skip)", () => {
  const trace = runLaunchGateFixtureScenario();
  const expected: readonly (readonly [string, string])[] = [
    ["checklist-incomplete-short", "YOU_LAUNCH_GATE_INVALID"],
    ["checklist-incomplete-long", "YOU_LAUNCH_GATE_INVALID"],
    ["checklist-journey-record-id-empty", "YOU_LAUNCH_GATE_INVALID"],
    ["checklist-journey-id-empty", "YOU_LAUNCH_GATE_INVALID"],
    ["checklist-steps-completed-invalid", "YOU_LAUNCH_GATE_INVALID"],
    ["checklist-failed-step-invalid", "YOU_LAUNCH_GATE_INVALID"],
    ["checklist-duration-ms-invalid", "YOU_LAUNCH_GATE_INVALID"],
    ["signoff-checklist-not-passing", "YOU_OPERATOR_SIGNOFF_INVALID"],
    ["signoff-already-signed", "YOU_OPERATOR_SIGNOFF_INVALID"],
    ["signoff-unknown-checklist", "YOU_OPERATOR_SIGNOFF_INVALID"],
    ["signoff-signed-by-empty", "YOU_OPERATOR_SIGNOFF_INVALID"],
    ["declaration-rollback-evidence-missing", "YOU_RELEASE_DECLARATION_INVALID"],
    ["declaration-evidence-bundle-missing", "YOU_RELEASE_DECLARATION_INVALID"],
    ["declaration-unknown-signoff", "YOU_RELEASE_DECLARATION_INVALID"],
    ["declaration-already-declared", "YOU_RELEASE_DECLARATION_INVALID"],
    ["lookup-unknown-checklist", "YOU_LAUNCH_GATE_INVALID"],
    ["lookup-unknown-signoff", "YOU_OPERATOR_SIGNOFF_INVALID"],
    ["lookup-no-signoff", "YOU_OPERATOR_SIGNOFF_INVALID"],
    ["lookup-unknown-declaration", "YOU_RELEASE_DECLARATION_INVALID"],
  ];
  for (const [key, code] of expected) {
    assert.equal(trace.refusalOutcomes[key], code, key);
  }
  assert.equal(Object.keys(trace.refusalOutcomes).length, expected.length);
});

test("all three wave-12 launch events ride the ledger with exact deterministic counts", () => {
  const trace = runLaunchGateFixtureScenario();
  assert.equal(trace.eventCounts["launch-gate-checked"], 2);
  assert.equal(trace.eventCounts["operator-signoff-recorded"], 1);
  assert.equal(trace.eventCounts["release-declared"], 1);
  assert.equal(trace.eventCount, 4);
});

test("THE LAUNCH GATE LAW holds on the trace: the passing gate has 20/20 journey-evidenced passes; the failing gate is honest", () => {
  const trace = runLaunchGateFixtureScenario();
  const assembled = trace.steps.find((scenarioStep) => scenarioStep.name === "gate-checklist-assembled");
  assert.ok(assembled !== undefined);
  assert.equal(assembled?.facts["pointCount"], 20);
  assert.equal(assembled?.facts["passedCount"], 20);
  assert.equal(assembled?.facts["gatePassed"], true);
  assert.equal(assembled?.facts["pointOneDescription"], "the workspace is created for the journey actor");
  assert.equal(assembled?.facts["pointTwentyJourneyRef"], trace.goldenJourneyIds[19]);
  // The honest-failure gate: 18/20, the failing points carry their evidence refs, passed false.
  const failing = trace.steps.find((scenarioStep) => scenarioStep.name === "failing-gate-assembled");
  assert.ok(failing !== undefined);
  assert.equal(failing?.facts["passedCount"], 18);
  assert.equal(failing?.facts["gatePassed"], false);
  assert.equal(failing?.facts["pointNineteenPassed"], false);
  assert.equal(typeof failing?.facts["pointNineteenJourneyRef"], "string");
  assert.equal((failing?.facts["pointNineteenJourneyRef"] as string).length > 0, true);
  assert.equal(failing?.facts["pointTwentyPassed"], false);
  assert.equal(failing?.facts["pointEighteenPassed"], true);
  // The gate-passes readout.
  const passes = trace.steps.find((scenarioStep) => scenarioStep.name === "gate-passes");
  assert.ok(passes !== undefined);
  assert.equal(passes?.facts["gatePassed"], true);
  assert.equal(passes?.facts["status"], "checked");
});

test("THE OPERATOR SIGNOFF LAW holds on the trace: signoff over the passing gate only; the failing gate stays checked", () => {
  const trace = runLaunchGateFixtureScenario();
  const refused = trace.steps.find((scenarioStep) => scenarioStep.name === "signoff-without-passing-gate");
  assert.ok(refused !== undefined);
  assert.equal(refused?.facts["refusal"], "YOU_OPERATOR_SIGNOFF_INVALID");
  assert.equal(refused?.facts["failingChecklistStillChecked"], true);
  const signed = trace.steps.find((scenarioStep) => scenarioStep.name === "operator-signs");
  assert.ok(signed !== undefined);
  assert.equal(signed?.facts["checklistRef"], trace.passingChecklistId);
  assert.equal(signed?.facts["signedBy"], "you_user_0000000000000002");
  assert.equal(typeof signed?.facts["signedAt"], "string");
});

test("THE RELEASE DECLARATION LAW holds on the trace: evidence bundle + rollback evidence; one release per signoff", () => {
  const trace = runLaunchGateFixtureScenario();
  const declared = trace.steps.find((scenarioStep) => scenarioStep.name === "release-declared");
  assert.ok(declared !== undefined);
  assert.equal(declared?.facts["signoffRef"], trace.signoffId);
  assert.equal(declared?.facts["evidenceBundleRef"], "you_evidence-bundle_w12a-scenario01");
  assert.equal(declared?.facts["rollbackEvidenceRef"], "you_rollback-evidence_w12a-scenario01");
  assert.equal(typeof declared?.facts["declaredAt"], "string");
  // The re-declaration is refused; the checklist's lifecycle head is "released".
  const oneRelease = trace.steps.find((scenarioStep) => scenarioStep.name === "one-release-per-signoff");
  assert.ok(oneRelease !== undefined);
  assert.equal(oneRelease?.facts["refusal"], "YOU_RELEASE_DECLARATION_INVALID");
  assert.equal(oneRelease?.facts["checklistStatusReleased"], true);
});

test("the live projection equals the ledger replay exactly", () => {
  const trace = runLaunchGateFixtureScenario();
  assert.equal(trace.projectionMatchesReplay, true);
});

test("byte-identical replay: the same seed produces the identical trace (x2)", () => {
  const first = runLaunchGateFixtureScenario();
  const second = runLaunchGateFixtureScenario();
  assert.equal(stableStringify(first), stableStringify(second));
  const third = runLaunchGateFixtureScenario({ seed: "you-w12a-launch-gate-scenario" });
  assert.equal(stableStringify(first), stableStringify(third));
  // A different seed diverges (the seed is load-bearing — it derives the journey evidence too).
  const other = runLaunchGateFixtureScenario({ seed: "you-w12a-launch-gate-scenario-alt" });
  assert.notEqual(stableStringify(first), stableStringify(other));
});

test("every step fact set stays simulated (truth law)", () => {
  const trace = runLaunchGateFixtureScenario();
  for (const scenarioStep of trace.steps) {
    const simulated = scenarioStep.facts["simulated"];
    if (simulated !== undefined) {
      assert.equal(simulated, true, scenarioStep.name);
    }
  }
  assert.equal(trace.simulated, true);
});

test("the scenario steps appear in the scripted W12A order", () => {
  const trace = runLaunchGateFixtureScenario();
  assert.deepEqual(
    trace.steps.map((scenarioStep) => scenarioStep.name),
    [
      "journeys-run",
      "checklist-intake-refusals",
      "gate-checklist-assembled",
      "gate-passes",
      "failing-gate-assembled",
      "signoff-without-passing-gate",
      "operator-signs",
      "signoff-refusals",
      "declaration-refusals",
      "release-declared",
      "one-release-per-signoff",
      "lookup-refusals",
      "ledger-readout",
    ],
  );
});
