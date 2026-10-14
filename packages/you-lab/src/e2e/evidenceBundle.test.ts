// Evidence bundle tests (W12C) — coverage: the content-addressed
// evidence bundle assembles the golden + injection-recovery journey
// records (24, no terminal fixtures) into a bundle whose id is the
// sha256 content address over the canonical versioned record set;
// the same run SET assembles byte-identical bundles regardless of
// input order; content-address verification recomputes and refuses
// tampered contents; assembly is fail-closed (empty sets, duplicate
// journeys, records disagreeing with their own step evidence, and
// unlabelled runs are typed YOU_RELEASE_DECLARATION_INVALID
// rejections).
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { JOURNEY_STEP_IDS } from "./journeySteps.js";
import { runJourney, type NeutralJourneyOutcome } from "./journeyHarness.js";
import { runTerminalJourneys } from "./failureInjection.js";
import {
  GATE_EVIDENCE_BUNDLE_VERSION,
  RELEASE_EVIDENCE_INVALID_CODE,
  ReleaseEvidenceInvalidError,
  assertBundleContentAddressed,
  buildEvidenceBundle,
  buildStandardGateEvidenceBundle,
  bundleRecordIds,
  evidenceBundleId,
  gateEvidenceBundleVersion,
  journeyRecordContentDigest,
  runGateEvidenceJourneys,
} from "./evidenceBundle.js";

test("evidence bundle: the standard gate evidence bundle assembles golden + injection-recovery journeys (24 records, no terminal)", () => {
  const journeys = runGateEvidenceJourneys();
  assert.equal(journeys.length, 24, "4 golden + 20 recover-mode injection journeys");
  const bundle = buildStandardGateEvidenceBundle();
  assert.equal(bundle.journeyRecords.length, 24);
  assert.equal(bundle.manifest.length, 24);
  assert.equal(bundle.bundleVersion, GATE_EVIDENCE_BUNDLE_VERSION);
  assert.equal(bundle.simulated, true, "truth law: the bundle stays labelled simulated");
  assert.match(bundle.id, /^you_evidence_[0-9a-f]{16}$/);
  // the journey ids: the four golden fixtures + one injection per launch-gate step
  const journeyIds = bundle.journeyRecords.map((record) => record.journeyId);
  assert.deepEqual(
    journeyIds,
    ["golden-alpha", "golden-beta", "golden-delta", "golden-gamma", ...JOURNEY_STEP_IDS.map((stepId) => `injection-${stepId}`)].sort(),
    "canonical order (sorted by journeyId) with the exhaustive injection set",
  );
  // the terminal failed-at fixtures are deliberately NOT declaration evidence
  for (const terminal of runTerminalJourneys()) {
    assert.equal(
      bundle.journeyRecords.some((record) => record.journeyId === terminal.spec.journeyId),
      false,
      `terminal journey '${terminal.spec.journeyId}' is the conformance audit's failure demonstration, not bundle evidence`,
    );
  }
  // every record carries the honest journey shape (recovered journeys name their failed step)
  assert.equal(bundle.journeyRecords.filter((record) => record.failedStep === null).length, 4, "the four golden journeys");
  assert.equal(bundle.journeyRecords.filter((record) => record.stepsCompleted === 20).length, 24, "golden + recovered journeys all complete the path");
});

test("evidence bundle: content-addressed — the id recomputes from the record set and every manifest digest recomputes", () => {
  const bundle = buildStandardGateEvidenceBundle();
  assert.equal(bundle.id, evidenceBundleId(bundle.journeyRecords));
  assert.ok(assertBundleContentAddressed(bundle) === undefined, "the standard bundle verifies");
  bundle.manifest.forEach((entry, i) => {
    const record = bundle.journeyRecords[i]!;
    assert.equal(entry.recordId, record.id);
    assert.equal(entry.journeyId, record.journeyId);
    assert.equal(entry.contentDigest, journeyRecordContentDigest(record), `manifest digest ${i + 1} recomputes`);
    assert.match(entry.contentDigest, /^[0-9a-f]{64}$/);
  });
  assert.deepEqual(bundleRecordIds(bundle), bundle.manifest.map((entry) => entry.recordId));
  assert.equal(gateEvidenceBundleVersion().startsWith("you-lab-gate-evidence-bundle/1"), true);
});

test("evidence bundle: byte-identical rebuild from the same run set (canonical JSON), input order never matters", () => {
  const first = buildStandardGateEvidenceBundle();
  const second = buildStandardGateEvidenceBundle();
  assert.equal(canonicalJson(first), canonicalJson(second), "double-build is byte-identical");
  assert.deepEqual(first, second);
  assert.equal(first.id, second.id);
  // the content address is a pure function of the record SET: shuffling the
  // input order assembles the identical bundle
  const journeys = runGateEvidenceJourneys();
  const reversed = buildEvidenceBundle([...journeys].reverse());
  assert.equal(canonicalJson(reversed), canonicalJson(first), "reversed input order assembles the identical bundle");
  const rotated = buildEvidenceBundle([...journeys.slice(12), ...journeys.slice(0, 12)]);
  assert.equal(rotated.id, first.id);
  // a different record set is a DIFFERENT bundle (content addressing)
  const goldenOnly = buildEvidenceBundle(journeys.slice(0, 4));
  assert.notEqual(goldenOnly.id, first.id);
  assert.equal(goldenOnly.journeyRecords.length, 4);
});

test("evidence bundle: content-address verification refuses tampered bundles (fail-closed)", () => {
  const bundle = buildStandardGateEvidenceBundle();
  // an edited record under the same id fails the content address
  const tamperedRecord = {
    ...bundle.journeyRecords[0]!,
    durationMs: bundle.journeyRecords[0]!.durationMs + 1,
  };
  const tampered = { ...bundle, journeyRecords: Object.freeze([tamperedRecord, ...bundle.journeyRecords.slice(1)]) };
  assert.throws(
    () => assertBundleContentAddressed(tampered),
    (error: unknown) =>
      error instanceof ReleaseEvidenceInvalidError &&
      error.code === RELEASE_EVIDENCE_INVALID_CODE &&
      /fails its content address/.test(error.message),
  );
  // a tampered manifest digest fails its per-record digest check
  const tamperedManifest = bundle.manifest.map((entry, i) =>
    i === 0 ? { ...entry, contentDigest: "0".repeat(64) } : entry,
  );
  const tamperedEntryBundle = { ...bundle, manifest: Object.freeze(tamperedManifest) };
  assert.throws(
    () => assertBundleContentAddressed(tamperedEntryBundle),
    /fails its manifest digest/,
  );
  // a manifest that does not index the record set is refused
  assert.throws(
    () => assertBundleContentAddressed({ ...bundle, manifest: Object.freeze([...bundle.manifest.slice(1), bundle.manifest[0]!]) }),
    /does not index record/,
  );
  // structural refusals
  assert.throws(() => assertBundleContentAddressed({ ...bundle, id: "" }), /empty bundle id/);
  assert.throws(
    () => assertBundleContentAddressed({ ...bundle, bundleVersion: "you-lab-gate-evidence-bundle/2" }),
    /a version change is a different bundle/,
  );
  assert.throws(
    () => assertBundleContentAddressed({ ...bundle, manifest: Object.freeze(bundle.manifest.slice(0, 23)) }),
    /the manifest lists 23 entries/,
  );
  assert.throws(
    () => assertBundleContentAddressed({ ...bundle, journeyRecords: Object.freeze([]), manifest: Object.freeze([]) }),
    /zero journey records/,
  );
});

test("evidence bundle: assembly refusals — empty set, duplicate journeys, record/step disagreement, unlabelled runs", () => {
  const journeys = runGateEvidenceJourneys();
  // an empty run set is a declaration without evidence — refused
  assert.throws(
    () => buildEvidenceBundle([]),
    (error: unknown) =>
      error instanceof ReleaseEvidenceInvalidError &&
      error.code === RELEASE_EVIDENCE_INVALID_CODE &&
      /zero journeys to bundle/.test(error.message),
  );
  // a duplicated journey appears once — refused
  assert.throws(
    () => buildEvidenceBundle([journeys[0]!, runJourney(journeys[0]!.spec)]),
    /duplicate journey 'golden-alpha'/,
  );
  // a record that disagrees with its own step evidence is never assembled
  const doctoredStepsCompleted: NeutralJourneyOutcome = {
    ...journeys[0]!,
    journeyRecord: { ...journeys[0]!.journeyRecord, stepsCompleted: 3 },
  };
  assert.throws(
    () => buildEvidenceBundle([doctoredStepsCompleted]),
    /disagrees with its own evidence/,
  );
  const doctoredDuration: NeutralJourneyOutcome = {
    ...journeys[0]!,
    journeyRecord: { ...journeys[0]!.journeyRecord, durationMs: journeys[0]!.journeyRecord.durationMs + 7 },
  };
  assert.throws(() => buildEvidenceBundle([doctoredDuration]), /step durations sum to/);
  // an unlabelled run is a truth-law fabrication — never carried
  const unlabelled: NeutralJourneyOutcome = {
    ...journeys[0]!,
    journeyRecord: { ...journeys[0]!.journeyRecord, simulated: false },
  };
  assert.throws(() => buildEvidenceBundle([unlabelled]), /simulated must be true/);
  // a failed step outside the frozen vocabulary is never carried
  const foreignFailedStep: NeutralJourneyOutcome = {
    ...journeys[1]!,
    journeyRecord: { ...journeys[1]!.journeyRecord, failedStep: "not-a-step" },
  };
  assert.throws(() => buildEvidenceBundle([foreignFailedStep]), /outside the frozen 20-point launch-gate vocabulary/);
  // an empty journey identity is refused
  assert.throws(
    () => buildEvidenceBundle([{ ...journeys[0]!, spec: { ...journeys[0]!.spec, journeyId: "" } }]),
    /identity fields are empty/,
  );
});
