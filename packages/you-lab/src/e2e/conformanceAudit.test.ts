// Conformance audit tests (W11C) — coverage: CONFORMANCE LAW —
// checksTotal and checksPassed are stated verbatim from the harness
// runs (recounted from the emitted checks, never asserted by the
// caller); the audit over the healthy launch-gate suite passes every
// check; including terminal journeys yields honest FAILING counts
// (never summarized away); the byte-identical determinism replay check
// catches a tampered outcome; malformed inputs and empty run sets are
// typed YOU_CONFORMANCE_AUDIT_INVALID rejections; the audit builds
// deterministically.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFORMANCE_AUDIT_INVALID_CODE,
  ConformanceAuditInvalidError,
  LAUNCH_GATE_CONFORMANCE_STANDARD,
  buildLaunchGateConformanceAudit,
  conformanceAuditRecordId,
} from "./conformanceAudit.js";
import { runGoldenJourneys, runJourney } from "./journeyHarness.js";
import { runInjectionCoverageJourneys, runLaunchGateJourneySuite, runTerminalJourneys } from "./failureInjection.js";
import { buildIncidentRunbook } from "./incidentRunbook.js";

const SUITE = runLaunchGateJourneySuite();
const HEALTHY = [...SUITE.golden, ...SUITE.injection];
const WITH_TERMINAL = [...HEALTHY, ...SUITE.terminal];
const RUNBOOK = buildIncidentRunbook(undefined, WITH_TERMINAL);

test("conformance audit: checks-total/checks-passed are recounted verbatim from the emitted checks", () => {
  const audit = buildLaunchGateConformanceAudit(HEALTHY, { runbookEntries: RUNBOOK });
  const { record, checks } = audit;
  assert.equal(record.checksTotal, checks.length);
  assert.equal(record.checksPassed, checks.filter((check) => check.passed).length);
  assert.equal(record.checksTotal, record.checksPassed, "the healthy suite passes every check");
  assert.ok(record.checksTotal > 0, "never a pass without the counts");
  assert.equal(record.standard, LAUNCH_GATE_CONFORMANCE_STANDARD);
  assert.equal(record.scopeRef, "you-lab-e2e-journey-fixtures/1");
  assert.equal(record.simulated, true);
  assert.match(record.id, /^you_conformance_[0-9a-f]{16}$/);
  // the checks themselves are the verbatim counting units
  const stepChecks = checks.filter((check) => check.checkId.startsWith("step-record:"));
  const recoveryChecks = checks.filter((check) => check.checkId.startsWith("recovery-exercised:"));
  const determinismChecks = checks.filter((check) => check.checkId.startsWith("determinism:"));
  const lawChecks = checks.filter((check) => check.checkId.startsWith("journey-law:"));
  const runbookChecks = checks.filter((check) => check.checkId.startsWith("runbook-law:"));
  const expectedStepRecords = HEALTHY.reduce((sum, outcome) => sum + outcome.steps.length, 0);
  const expectedFailedRecords = HEALTHY.reduce(
    (sum, outcome) => sum + outcome.steps.filter((record) => record.status === "failed").length,
    0,
  );
  assert.equal(stepChecks.length, expectedStepRecords, "one check per recorded step transition, verbatim");
  assert.equal(recoveryChecks.length, expectedFailedRecords, "one recovery check per failed transition");
  assert.equal(determinismChecks.length, HEALTHY.length, "one determinism check per journey");
  assert.equal(lawChecks.length, HEALTHY.length, "one journey-law check per journey");
  assert.equal(runbookChecks.length, 22, "one RUNBOOK LAW check per runbook entry");
});

test("conformance audit: terminal journeys yield honest failing counts (never summarized away)", () => {
  const audit = buildLaunchGateConformanceAudit(WITH_TERMINAL, { runbookEntries: RUNBOOK });
  const { record, checks } = audit;
  const failing = checks.filter((check) => !check.passed);
  assert.equal(record.checksTotal, checks.length);
  assert.equal(record.checksPassed, record.checksTotal - failing.length);
  // the two terminal failures fail their recovery checks (and only those)
  assert.equal(failing.length, 2);
  assert.deepEqual(
    failing.map((check) => check.checkId).sort(),
    ["recovery-exercised:terminal-evidence:6", "recovery-exercised:terminal-recovery-drill:20"],
  );
  // the runbook stays fully backed over the terminal set too (the DR classes pass as explicitly unexercised)
  const runbookChecks = checks.filter((check) => check.checkId.startsWith("runbook-law:"));
  assert.equal(runbookChecks.every((check) => check.passed), true);
});

test("conformance audit: the determinism replay check catches a tampered outcome (counted, not hidden)", () => {
  const golden = runGoldenJourneys();
  const tampered = {
    ...golden[0]!,
    steps: golden[0]!.steps.map((record, i) => (i === 2 ? { ...record, durationMs: record.durationMs + 1 } : record)),
  };
  const audit = buildLaunchGateConformanceAudit([tampered]);
  const failed = audit.checks.filter((check) => !check.passed);
  assert.ok(failed.length >= 1, "the tampered duration fails checks");
  assert.ok(failed.some((check) => check.checkId === "determinism:golden-alpha"));
  assert.ok(failed.some((check) => check.checkId === "journey-law:golden-alpha"));
  assert.equal(audit.record.checksPassed, audit.record.checksTotal - failed.length);
});

test("conformance audit: malformed inputs are typed YOU_CONFORMANCE_AUDIT_INVALID rejections", () => {
  assert.throws(
    () => buildLaunchGateConformanceAudit([]),
    (error: unknown) =>
      error instanceof ConformanceAuditInvalidError &&
      error.code === CONFORMANCE_AUDIT_INVALID_CODE &&
      /zero journeys to audit.*pass without the counts/.test(error.message),
  );
  assert.throws(
    () => buildLaunchGateConformanceAudit(HEALTHY, { scopeRef: "" }),
    /empty scopeRef/,
  );
  // a forged outcome with an unknown step id is refused before any check is counted
  const forged = runGoldenJourneys()[0]!;
  const unknownStep = { ...forged, steps: [...forged.steps.slice(0, 3), { ...forged.steps[3]!, stepId: "not-a-step" }] };
  assert.throws(
    () => buildLaunchGateConformanceAudit([unknownStep]),
    /outside the frozen 20-point launch-gate vocabulary/,
  );
  // a runbook entry with an unknown incident class is refused
  assert.throws(
    () => buildLaunchGateConformanceAudit(HEALTHY, { runbookEntries: [{ ...RUNBOOK[0]!, incidentClass: "cosmic-ray-flip" }] }),
    /outside the W11C authored vocabulary/,
  );
});

test("conformance audit: the audit builds deterministically and the id binds the counts", () => {
  const first = buildLaunchGateConformanceAudit(WITH_TERMINAL, { runbookEntries: RUNBOOK });
  const second = buildLaunchGateConformanceAudit([...WITH_TERMINAL], { runbookEntries: [...RUNBOOK] });
  assert.deepEqual(first, second);
  assert.equal(
    first.record.id,
    conformanceAuditRecordId(LAUNCH_GATE_CONFORMANCE_STANDARD, first.record.scopeRef, first.record.checksTotal, first.record.checksPassed),
  );
  // a different count derives a different id (counts are part of the identity)
  const other = buildLaunchGateConformanceAudit(HEALTHY, { runbookEntries: RUNBOOK });
  assert.notEqual(first.record.id, other.record.id);
  // the audit without runbook entries emits no runbook checks (honest absence)
  const bare = buildLaunchGateConformanceAudit([runJourney({ journeyId: "one", seed: "s-one", injection: null })]);
  assert.equal(bare.checks.some((check) => check.checkId.startsWith("runbook-law:")), false);
  assert.equal(bare.record.checksTotal, 1 + 1 + 21 + 1, "journey-law + determinism + 21 step records + 1 drill recovery check");
  assert.equal(runInjectionCoverageJourneys().length + runTerminalJourneys().length + runGoldenJourneys().length, 26);
});
