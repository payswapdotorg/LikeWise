import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { runPlatformFixtureScenario } from "./platformFixtureScenario.js";

test("the scenario walks the full W10A chain (policy -> scan -> quarantine -> release -> retention -> DR verified)", () => {
  const trace = runPlatformFixtureScenario();
  // The scan walk: clean -> quarantined -> released (the release fold) -> rejected.
  assert.deepEqual(trace.scanWalk, ["clean", "quarantined", "released", "rejected"]);
  // Three imports scanned (A clean, B quarantined->released, D rejected).
  assert.equal(trace.importVerdictIds.length, 3);
  // The retention pass recorded.
  assert.ok(trace.retentionRecordId.length > 0);
  // Two DR restore attempts: one verified, one hash-mismatch; the verified one is the head.
  assert.equal(trace.drRestoreIds.length, 2);
  const verifiedStep = trace.steps.find((scenarioStep) => scenarioStep.name === "dr-restore-verified");
  assert.ok(verifiedStep !== undefined);
  const verifiedRestoreId = verifiedStep?.facts["restoreId"];
  assert.equal(typeof verifiedRestoreId, "string");
  assert.equal(trace.activeDrRestoreId, verifiedRestoreId);
  assert.equal(trace.simulated, true);
});

test("every refusal path is a typed error (never a silent skip)", () => {
  const trace = runPlatformFixtureScenario();
  const expected: readonly (readonly [string, string])[] = [
    ["policy-scope-invalid", "YOU_INVALID_STATE"],
    ["policy-window-zero", "YOU_INVALID_STATE"],
    ["policy-burst-zero", "YOU_INVALID_STATE"],
    ["policy-action-invalid", "YOU_INVALID_STATE"],
    ["scan-limit-exceeded", "YOU_RATE_LIMIT_EXCEEDED"],
    ["admission-quarantined", "YOU_IMPORT_QUARANTINED"],
    ["admission-unscanned", "YOU_IMPORT_QUARANTINED"],
    ["release-not-quarantined", "YOU_IMPORT_QUARANTINED"],
    ["release-clean-import", "YOU_IMPORT_QUARANTINED"],
    ["release-rejected-terminal", "YOU_IMPORT_QUARANTINED"],
    ["admission-rejected", "YOU_IMPORT_QUARANTINED"],
    ["rescan-already-scanned", "YOU_INVALID_STATE"],
    ["retention-consent-protected", "YOU_RETENTION_ENFORCEMENT_INVALID"],
    ["retention-class-invalid", "YOU_RETENTION_ENFORCEMENT_INVALID"],
    ["retention-subject-empty", "YOU_RETENTION_ENFORCEMENT_INVALID"],
    ["dr-hash-mismatch", "YOU_DR_RESTORE_INVALID"],
    ["dr-snapshot-missing", "YOU_DR_RESTORE_INVALID"],
    ["dr-unknown-restore", "YOU_DR_RESTORE_INVALID"],
    ["import-unknown-verdict", "YOU_IMPORT_QUARANTINED"],
  ];
  for (const [key, code] of expected) {
    assert.equal(trace.refusalOutcomes[key], code, key);
  }
  assert.equal(Object.keys(trace.refusalOutcomes).length, expected.length);
});

test("all four wave-10 events ride the ledger with exact deterministic counts", () => {
  const trace = runPlatformFixtureScenario();
  assert.equal(trace.eventCounts["rate-limit-enforced"], 5);
  assert.equal(trace.eventCounts["import-quarantined"], 2);
  assert.equal(trace.eventCounts["retention-enforced"], 1);
  assert.equal(trace.eventCounts["dr-restore-recorded"], 2);
  assert.equal(trace.eventCount, 10);
});

test("the scan-limit-exceeded step proves enforcement BEFORE effect (the scan never ran)", () => {
  const trace = runPlatformFixtureScenario();
  const refusedStep = trace.steps.find((scenarioStep) => scenarioStep.name === "scan-limit-exceeded");
  assert.ok(refusedStep !== undefined);
  assert.equal(refusedStep?.facts["scanNeverRan"], true);
  assert.equal(refusedStep?.facts["importStatusUnset"], true);
});

test("the live projection equals the ledger replay exactly", () => {
  const trace = runPlatformFixtureScenario();
  assert.equal(trace.projectionMatchesReplay, true);
});

test("byte-identical replay: the same seed produces the identical trace (x2)", () => {
  const first = runPlatformFixtureScenario();
  const second = runPlatformFixtureScenario();
  assert.equal(stableStringify(first), stableStringify(second));
  const third = runPlatformFixtureScenario({ seed: "you-w10a-platform-scenario" });
  assert.equal(stableStringify(first), stableStringify(third));
  // A different seed diverges (the seed is load-bearing).
  const other = runPlatformFixtureScenario({ seed: "you-w10a-platform-scenario-alt" });
  assert.notEqual(stableStringify(first), stableStringify(other));
});

test("every step fact set stays simulated (truth law)", () => {
  const trace = runPlatformFixtureScenario();
  for (const scenarioStep of trace.steps) {
    const simulated = scenarioStep.facts["simulated"];
    if (simulated !== undefined) {
      assert.equal(simulated, true, scenarioStep.name);
    }
  }
  assert.equal(trace.simulated, true);
});

test("the scenario steps appear in the scripted W10A order", () => {
  const trace = runPlatformFixtureScenario();
  assert.deepEqual(
    trace.steps.map((scenarioStep) => scenarioStep.name),
    [
      "scan-policy-registered",
      "invalid-policy-refusals",
      "import-scanned-clean",
      "import-admitted",
      "import-quarantined",
      "admission-refusals",
      "import-released",
      "import-admitted-after-release",
      "release-refusals",
      "scan-limit-exceeded",
      "import-scanned-rejected",
      "rejected-import-refusals",
      "rescan-refusal",
      "retention-pass-recorded",
      "retention-refusals",
      "dr-restore-verified",
      "dr-restore-hash-mismatch",
      "dr-snapshot-missing",
      "lookup-refusals",
      "ledger-readout",
    ],
  );
});
