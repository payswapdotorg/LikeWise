import assert from "node:assert/strict";
import test from "node:test";
import {
  LOAD_TEST_SOURCES,
  constructLoadTestReport,
  isLoadTestSource,
  validateLoadTestMeasurement,
  validateLoadTestRegressions,
  type LoadTestMeasurement,
} from "./loadTest.js";

const MEASURED_AT = "2026-01-01T00:00:03.000Z";

const MEASUREMENT: LoadTestMeasurement = {
  scenarioRef: "you_scenario_peak-render_01",
  source: "simulated",
  peakRps: 240.5,
  p99Ms: 180.25,
  measuredAt: MEASURED_AT,
  simulated: true,
};

test("the source ladder is the frozen two (measured or simulated-labeled)", () => {
  assert.deepEqual(LOAD_TEST_SOURCES, ["measured", "simulated"]);
  assert.ok(isLoadTestSource("measured"));
  assert.ok(isLoadTestSource("simulated"));
  assert.ok(!isLoadTestSource("Simulated"));
  assert.ok(!isLoadTestSource(""));
  assert.ok(!isLoadTestSource("estimated"));
});

test("THE METRICS TRUTH LAW: the measurement validator refuses invented metrics", () => {
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, scenarioRef: "" })?.reason, "scenario-ref-empty");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, source: "estimated" })?.reason, "source-invalid");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, peakRps: 0 })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, peakRps: -12 })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, peakRps: Number.NaN })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, peakRps: Number.POSITIVE_INFINITY })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, p99Ms: 0 })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, p99Ms: -1 })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, p99Ms: Number.NaN })?.reason, "metrics-invented");
  assert.equal(validateLoadTestMeasurement({ ...MEASUREMENT, measuredAt: "" })?.reason, "measured-at-missing");
  assert.equal(validateLoadTestMeasurement(MEASUREMENT), null);
});

test("the regressions validator refuses malformed and summarized-away lists", () => {
  assert.equal(validateLoadTestRegressions("none" as never)?.reason, "regressions-malformed");
  assert.equal(validateLoadTestRegressions(["p99 regressed", ""])?.reason, "regression-empty-string");
  assert.equal(validateLoadTestRegressions(["p99 regressed", "  "])?.reason, "regression-empty-string");
  assert.equal(validateLoadTestRegressions(["p99 regressed", "p99 regressed"])?.reason, "regression-duplicate");
  assert.equal(validateLoadTestRegressions([]), null);
  assert.equal(validateLoadTestRegressions(["p99 regressed at peak rps", "export throughput flat at 200 rps"]), null);
});

test("THE LOAD TEST LAW (construct-time teeth): a report can never exist without its measurement", () => {
  const noMeasurement = constructLoadTestReport(
    {
      id: "you_load-test_0001",
      scenarioRef: MEASUREMENT.scenarioRef,
      peakRps: MEASUREMENT.peakRps,
      p99Ms: MEASUREMENT.p99Ms,
      regressions: ["p99 regressed at peak rps"],
    },
    null,
  );
  assert.ok(!noMeasurement.ok);
  if (!noMeasurement.ok) {
    assert.equal(noMeasurement.refusal.reason, "report-without-measurement");
  }
  // An invented measurement poisons the report too (the validator gates the construct).
  const invented = constructLoadTestReport(
    {
      id: "you_load-test_0002",
      scenarioRef: MEASUREMENT.scenarioRef,
      peakRps: 0,
      p99Ms: 0,
      regressions: [],
    },
    { ...MEASUREMENT, peakRps: 0, p99Ms: 0 },
  );
  assert.ok(!invented.ok);
  if (!invented.ok) {
    assert.equal(invented.refusal.reason, "metrics-invented");
  }
});

test("THE LOAD TEST LAW (construct-time teeth): the report's numbers must equal the measurement verbatim", () => {
  // Scenario mismatch: the measurement is for a different scenario.
  const refMismatch = constructLoadTestReport(
    {
      id: "you_load-test_0003",
      scenarioRef: "you_scenario_other_02",
      peakRps: MEASUREMENT.peakRps,
      p99Ms: MEASUREMENT.p99Ms,
      regressions: [],
    },
    MEASUREMENT,
  );
  assert.ok(!refMismatch.ok);
  if (!refMismatch.ok) {
    assert.equal(refMismatch.refusal.reason, "measurement-ref-mismatch");
  }
  // Invented restatement: the report claims numbers the measurement never read.
  const metricsMismatch = constructLoadTestReport(
    {
      id: "you_load-test_0004",
      scenarioRef: MEASUREMENT.scenarioRef,
      peakRps: MEASUREMENT.peakRps * 2,
      p99Ms: MEASUREMENT.p99Ms,
      regressions: [],
    },
    MEASUREMENT,
  );
  assert.ok(!metricsMismatch.ok);
  if (!metricsMismatch.ok) {
    assert.equal(metricsMismatch.refusal.reason, "metrics-mismatch");
  }
  // Malformed regressions poison the report.
  const malformed = constructLoadTestReport(
    {
      id: "you_load-test_0005",
      scenarioRef: MEASUREMENT.scenarioRef,
      peakRps: MEASUREMENT.peakRps,
      p99Ms: MEASUREMENT.p99Ms,
      regressions: ["p99 regressed", ""],
    },
    MEASUREMENT,
  );
  assert.ok(!malformed.ok);
  if (!malformed.ok) {
    assert.equal(malformed.refusal.reason, "regression-empty-string");
  }
});

test("constructLoadTestReport freezes the report with regressions listed verbatim", () => {
  const regressions = ["p99 regressed at peak rps", "export throughput flat at 200 rps"];
  const report = constructLoadTestReport(
    {
      id: "you_load-test_0006",
      scenarioRef: MEASUREMENT.scenarioRef,
      peakRps: MEASUREMENT.peakRps,
      p99Ms: MEASUREMENT.p99Ms,
      regressions,
    },
    MEASUREMENT,
  );
  assert.ok(report.ok);
  if (report.ok) {
    assert.equal(report.report.scenarioRef, MEASUREMENT.scenarioRef);
    assert.equal(report.report.peakRps, MEASUREMENT.peakRps);
    assert.equal(report.report.p99Ms, MEASUREMENT.p99Ms);
    assert.deepEqual(report.report.regressions, regressions);
    assert.equal(report.report.regressions.length, 2);
    assert.equal(report.report.simulated, true);
    assert.ok(Object.isFrozen(report.report));
    assert.ok(Object.isFrozen(report.report.regressions));
    // The regressions list is a copy: mutating the source cannot rewrite history.
    regressions.push("a late mutation");
    assert.equal(report.report.regressions.length, 2);
  }
});
