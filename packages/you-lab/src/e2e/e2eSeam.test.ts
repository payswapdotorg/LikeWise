// Contract seam v11 tests (W11C) — coverage: the E2E journey runbook
// shapes construct VALID frozen v11 shapes through the single seam
// module (E2eJourneyRecord / IncidentRunbookEntry /
// ConformanceAuditRecord), mapping 1:1 field-for-field from the neutral
// harness outputs, and the JOURNEY LAW / RUNBOOK LAW / CONFORMANCE LAW
// are enforced fail-closed at the frozen boundary (unknown failed
// steps, silent partial successes, unlabelled runs, unbacked exercise
// flags, zero-check audits and counts beyond the total are all typed
// rejections). Also: the full harness -> frozen mapping path is
// deterministic end-to-end.
import assert from "node:assert/strict";
import test from "node:test";
import {
  toFrozenConformanceAuditRecord,
  toFrozenE2eJourneyRecord,
  toFrozenIncidentRunbookEntry,
} from "../contractSeam.js";
import { runGoldenJourneys, runJourney } from "./journeyHarness.js";
import { runLaunchGateJourneySuite } from "./failureInjection.js";
import { buildIncidentRunbook, type NeutralIncidentRunbookEntry } from "./incidentRunbook.js";
import { buildLaunchGateConformanceAudit, LAUNCH_GATE_CONFORMANCE_STANDARD } from "./conformanceAudit.js";

const SUITE = runLaunchGateJourneySuite();
const ALL_JOURNEYS = [...SUITE.golden, ...SUITE.injection, ...SUITE.terminal];
const RUNBOOK = buildIncidentRunbook(undefined, ALL_JOURNEYS);
const AUDIT = buildLaunchGateConformanceAudit([...SUITE.golden, ...SUITE.injection, ...SUITE.terminal], {
  runbookEntries: RUNBOOK,
});

test("contract seam v11: toFrozenE2eJourneyRecord maps the harness records 1:1 (golden and injected)", () => {
  const golden = runGoldenJourneys()[0]!;
  const frozen = toFrozenE2eJourneyRecord(golden.journeyRecord);
  assert.equal(frozen.id, golden.journeyRecord.id);
  assert.equal(frozen.journeyId, "golden-alpha");
  assert.equal(frozen.stepsCompleted, 20);
  assert.equal(frozen.failedStep, null);
  assert.equal(frozen.durationMs, golden.durationMs);
  assert.equal(frozen.simulated, true, "truth law: simulated runs stay labeled at the frozen boundary");

  const injected = runJourney({
    journeyId: "seam-injection",
    seed: "you-lab-w11c-seam-injection",
    injection: { stepId: "twin", mode: "recover" },
  });
  const frozenInjected = toFrozenE2eJourneyRecord(injected.journeyRecord);
  assert.equal(frozenInjected.stepsCompleted, 20, "a recovered journey completes the path through its recovery");
  assert.equal(frozenInjected.failedStep, "twin", "the failed-at step is recorded (JOURNEY LAW)");
  assert.equal(frozenInjected.durationMs, injected.durationMs);

  const terminal = SUITE.terminal[0]!;
  const frozenTerminal = toFrozenE2eJourneyRecord(terminal.journeyRecord);
  assert.equal(frozenTerminal.stepsCompleted, 5, "the honest prefix");
  assert.equal(frozenTerminal.failedStep, "evidence");
});

test("contract seam v11: toFrozenE2eJourneyRecord enforces the JOURNEY LAW fail-closed", () => {
  const golden = runGoldenJourneys()[0]!;
  const record = golden.journeyRecord;
  assert.throws(() => toFrozenE2eJourneyRecord({ ...record, id: "" }), /empty id/);
  assert.throws(() => toFrozenE2eJourneyRecord({ ...record, journeyId: "" }), /empty journeyId/);
  assert.throws(() => toFrozenE2eJourneyRecord({ ...record, stepsCompleted: 21 }), /stepsCompleted 21/);
  assert.throws(() => toFrozenE2eJourneyRecord({ ...record, stepsCompleted: -1 }), /stepsCompleted -1/);
  // a success that did not complete the 20-point path is a silent partial success — refused
  assert.throws(
    () => toFrozenE2eJourneyRecord({ ...record, stepsCompleted: 19 }),
    /successful journey \(failedStep null\) must complete all 20 points/,
  );
  // an unknown failed step is never mapped
  assert.throws(
    () => toFrozenE2eJourneyRecord({ ...record, failedStep: "not-a-step" }),
    /failedStep 'not-a-step' is outside the frozen 20-point launch-gate vocabulary/,
  );
  // a completed prefix below the failed step's position is a dishonest record — refused
  assert.throws(
    () => toFrozenE2eJourneyRecord({ ...record, failedStep: "intent", stepsCompleted: 0 }),
    /below the failed step's honest prefix/,
  );
  assert.throws(() => toFrozenE2eJourneyRecord({ ...record, durationMs: -1 }), /finite non-negative number/);
  // the truth law: an unlabelled run is a fabrication at this seam
  assert.throws(
    () => toFrozenE2eJourneyRecord({ ...record, simulated: false }),
    /simulated must be true at this seam/,
  );
});

test("contract seam v11: toFrozenIncidentRunbookEntry maps the runbook 1:1 and enforces the vocabulary", () => {
  const exercisedEntry = RUNBOOK.find((entry) => entry.incidentClass === "render-job-failed");
  assert.ok(exercisedEntry);
  const frozen = toFrozenIncidentRunbookEntry(exercisedEntry);
  assert.equal(frozen.id, exercisedEntry.id);
  assert.equal(frozen.incidentClass, "render-job-failed");
  assert.equal(frozen.detection, exercisedEntry.detection);
  assert.equal(frozen.containment, exercisedEntry.containment);
  assert.equal(frozen.recovery, exercisedEntry.recovery);
  assert.equal(frozen.exercised, true, "exercised-by-injection (the RUNBOOK LAW)");
  assert.equal(frozen.simulated, true);

  const unexercisedEntry = RUNBOOK.find((entry) => entry.incidentClass === "provider-region-outage");
  assert.ok(unexercisedEntry);
  assert.equal(toFrozenIncidentRunbookEntry(unexercisedEntry).exercised, false, "explicitly marked unexercised");

  // malformed entries are typed rejections
  assert.throws(() => toFrozenIncidentRunbookEntry({ ...exercisedEntry, id: "" }), /empty id/);
  assert.throws(() => toFrozenIncidentRunbookEntry({ ...exercisedEntry, incidentClass: "" }), /empty incidentClass/);
  assert.throws(
    () => toFrozenIncidentRunbookEntry({ ...exercisedEntry, incidentClass: "cosmic-ray-flip" }),
    /outside the W11C authored incident vocabulary/,
  );
  assert.throws(() => toFrozenIncidentRunbookEntry({ ...exercisedEntry, detection: "" }), /empty detection text/);
  assert.throws(() => toFrozenIncidentRunbookEntry({ ...exercisedEntry, containment: "" }), /empty containment text/);
  assert.throws(() => toFrozenIncidentRunbookEntry({ ...exercisedEntry, recovery: "" }), /empty recovery text/);
  assert.throws(
    () => toFrozenIncidentRunbookEntry({ ...exercisedEntry, simulated: false }),
    /simulated must be true at this seam/,
  );
});

test("contract seam v11: toFrozenConformanceAuditRecord maps the audit 1:1 and enforces the counts law", () => {
  const frozen = toFrozenConformanceAuditRecord(AUDIT.record);
  assert.equal(frozen.id, AUDIT.record.id);
  assert.equal(frozen.standard, LAUNCH_GATE_CONFORMANCE_STANDARD);
  assert.equal(frozen.scopeRef, AUDIT.record.scopeRef);
  assert.equal(frozen.checksTotal, AUDIT.record.checksTotal);
  assert.equal(frozen.checksPassed, AUDIT.record.checksPassed);
  assert.equal(frozen.simulated, true);
  assert.ok(frozen.checksTotal > frozen.checksPassed, "the audited set includes terminal failures (honest failing counts)");
  assert.ok(frozen.checksPassed > 0);

  // the CONFORMANCE LAW fail-closed paths
  assert.throws(() => toFrozenConformanceAuditRecord({ ...AUDIT.record, id: "" }), /empty id/);
  assert.throws(() => toFrozenConformanceAuditRecord({ ...AUDIT.record, standard: "" }), /empty standard/);
  assert.throws(() => toFrozenConformanceAuditRecord({ ...AUDIT.record, scopeRef: "" }), /empty scopeRef/);
  // zero checks is a pass without the counts — refused
  assert.throws(() => toFrozenConformanceAuditRecord({ ...AUDIT.record, checksTotal: 0 }), /positive integer/);
  // counts beyond the total are a summary, never counts — refused
  assert.throws(
    () => toFrozenConformanceAuditRecord({ ...AUDIT.record, checksPassed: AUDIT.record.checksTotal + 1 }),
    /must be an integer in \[0, checksTotal=/,
  );
  assert.throws(
    () => toFrozenConformanceAuditRecord({ ...AUDIT.record, checksPassed: -1 }),
    /must be an integer in \[0, checksTotal=/,
  );
  assert.throws(
    () => toFrozenConformanceAuditRecord({ ...AUDIT.record, simulated: false }),
    /simulated must be true at this seam/,
  );
});

test("contract seam v11: the full harness -> frozen mapping path is deterministic end-to-end", () => {
  const first = {
    journeys: ALL_JOURNEYS.map((outcome) => toFrozenE2eJourneyRecord(outcome.journeyRecord)),
    runbook: RUNBOOK.map((entry: NeutralIncidentRunbookEntry) => toFrozenIncidentRunbookEntry(entry)),
    audit: toFrozenConformanceAuditRecord(AUDIT.record),
  };
  const suite2 = runLaunchGateJourneySuite();
  const all2 = [...suite2.golden, ...suite2.injection, ...suite2.terminal];
  const runbook2 = buildIncidentRunbook(undefined, all2);
  const audit2 = buildLaunchGateConformanceAudit(all2, { runbookEntries: runbook2 });
  const second = {
    journeys: all2.map((outcome) => toFrozenE2eJourneyRecord(outcome.journeyRecord)),
    runbook: runbook2.map((entry) => toFrozenIncidentRunbookEntry(entry)),
    audit: toFrozenConformanceAuditRecord(audit2.record),
  };
  assert.deepEqual(first, second);
  // the mapped journey records keep the JOURNEY LAW shape across all modes
  assert.equal(first.journeys.length, 26);
  assert.equal(first.journeys.filter((record) => record.failedStep === null).length, 4, "the four golden journeys");
  assert.equal(first.journeys.filter((record) => record.stepsCompleted === 20).length, 24, "golden + recovered journeys");
  assert.equal(first.journeys.filter((record) => record.stepsCompleted < 20).length, 2, "the two terminal journeys");
});
