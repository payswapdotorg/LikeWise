// YOU security service — load-test flow (W11A). The ops live here;
// securityService.ts is the single authority that dispatches into them
// (the W1A/W8A/W10A flow precedent).
//
// THE LOAD TEST LAW (docs/you/CONTRACTS.md wave-11): peak/p99 are
// measured or simulated-labeled — never invented; regressions are
// listed, never summarized away (YOU_LOAD_TEST_INVALID).
//
// runLoadTestOp takes a LoadTestMeasurement (the metrics evidence: its
// source label, its measuredAt reading, its peak/p99 numbers) plus the
// regressions list, constructs the immutable report FROM the
// measurement (the construct authority refuses
// report-without-measurement / measurement-ref-mismatch /
// metrics-mismatch / metrics-invented / malformed regressions) and
// appends the `load-test-recorded` event with the measurement
// provenance and the regressions verbatim. The stateless authority is
// shared/src/you/loadTest.ts; nothing here is a second validator.
//
// Phase 0: every run carries source "simulated" with `simulated: true`
// (the truth law); the "measured" label exists for the future
// real-harness adapter behind the same seam.

import type { LoadTestReport } from "@zcode/shared";
import {
  constructLoadTestReport,
  type LoadTestMeasurement,
  type LoadTestRefusal,
} from "../../../shared/src/you/loadTest.js";
import { appendLoadTestRecorded } from "./securityLedgerOps.js";
import {
  securityFailure,
  type SecurityFlowDeps,
  type SecurityPlaneRecord,
  type SecurityServiceResult,
} from "./securityServiceTypes.js";

/** The load-test run intake (the measurement + the regressions list). */
export interface LoadTestRunInput {
  readonly measurement: LoadTestMeasurement;
  readonly regressions: readonly string[];
}

/** Maps a stateless load-test refusal to the typed service error. */
function loadTestRefusal(refusal: LoadTestRefusal): { readonly ok: false; readonly error: ReturnType<typeof securityFailure>["error"] } {
  return securityFailure("YOU_LOAD_TEST_INVALID", `Load test refused: ${refusal.detail}`, {
    reason: refusal.reason,
  });
}

/**
 * Runs one load test: the immutable report is constructed FROM the
 * supplied measurement (peak/p99 verbatim, never invented) with the
 * regressions listed verbatim, and appended as the
 * `load-test-recorded` event (measurement provenance rides the payload).
 * Refusals: typed YOU_LOAD_TEST_INVALID for invented metrics
 * (metrics-invented), malformed reports (regressions-malformed /
 * regression-empty-string / regression-duplicate) and measurement shape
 * (source-invalid / scenario-ref-empty / measured-at-missing).
 */
export function runLoadTestOp(
  plane: SecurityPlaneRecord,
  deps: SecurityFlowDeps,
  input: LoadTestRunInput,
): SecurityServiceResult<{ readonly report: LoadTestReport; readonly measurement: LoadTestMeasurement }> {
  const constructed = constructLoadTestReport(
    {
      id: deps.ids.next("load-test"),
      scenarioRef: input.measurement.scenarioRef,
      peakRps: input.measurement.peakRps,
      p99Ms: input.measurement.p99Ms,
      regressions: [...input.regressions],
    },
    input.measurement,
  );
  if (!constructed.ok) {
    return loadTestRefusal(constructed.refusal);
  }
  const measurement: LoadTestMeasurement = input.measurement;
  plane.loadTests.set(constructed.report.id, constructed.report);
  plane.loadTestMeasurements.set(constructed.report.id, measurement);
  appendLoadTestRecorded(plane, constructed.report, measurement);
  return { ok: true, value: { report: constructed.report, measurement } };
}
