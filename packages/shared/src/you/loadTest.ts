// YOU LoadTestReport machinery (W11A — docs/you/CONTRACTS.md
// "Wave-11 contract freeze (v11)": "LoadTestReport"; the LOAD TEST LAW:
// peak/p99 are measured or simulated-labeled — never invented;
// regressions are listed, never summarized away
// (YOU_LOAD_TEST_INVALID)).
//
// This module owns the STATELESS validators and the immutable-report
// constructor (WORK_ORDERS.md W11A: "LoadTestReport: measured or
// simulated-labeled peak/p99 — never invented; regressions listed
// verbatim"). Validation is pure: no clock, no rng, no store, no
// registry lookup — the service maps refusals to typed
// YOU_LOAD_TEST_INVALID errors at its seam.
//
// The metrics truth law's teeth live in the LoadTestMeasurement: every
// report is constructed FROM a measurement record (its source label,
// its measuredAt reading and its peak/p99 numbers). The construct
// authority refuses:
//   - "report-without-measurement" — a report can never exist without
//     the measurement it reports (numbers never free-float, never
//     invented);
//   - "measurement-ref-mismatch" — the measurement must be for the same
//     scenario the report claims;
//   - "metrics-mismatch" — the report's peak/p99 must EQUAL the
//     measurement's numbers verbatim (a report can never state numbers
//     other than what was measured/simulated);
//   - "metrics-invented" — the measurement itself must carry finite
//     positive peak/p99 (zero, negative, NaN or Infinity readings are
//     invented numbers, not measurements).
// Regressions ride the report verbatim: a list of non-empty unique
// statements ("regressions listed, never summarized away" — an empty
// regression string is a summarized-away regression).
//
// The source ladder ("measured" | "simulated") is the
// measured-or-simulated-labeled law: in Phase 0 every run carries
// source "simulated" with `simulated: true` (the truth law); the
// "measured" label exists for the future real-harness adapter behind
// the same seam.

import type { LoadTestReport, OpaqueId } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** The measurement source ladder (measured or simulated-labeled — never invented). */
export const LOAD_TEST_SOURCES = ["measured", "simulated"] as const;

export type LoadTestSource = (typeof LOAD_TEST_SOURCES)[number];

const SOURCE_SET: ReadonlySet<string> = new Set(LOAD_TEST_SOURCES);

/** True when the value is one of the two sources. */
export function isLoadTestSource(value: unknown): value is LoadTestSource {
  return typeof value === "string" && SOURCE_SET.has(value);
}

/**
 * One load-test measurement — the metrics evidence every report requires
// (the DR check-evidence precedent). The numbers a report states are
// copied verbatim from here.
 */
export interface LoadTestMeasurement {
  readonly scenarioRef: OpaqueId;
  /** measured | simulated (the labeling law). */
  readonly source: string;
  /** Peak requests-per-second reading. */
  readonly peakRps: number;
  /** p99 latency reading in milliseconds. */
  readonly p99Ms: number;
  /** ISO-8601; the injected clock reading at the measurement. */
  readonly measuredAt: string;
  readonly simulated: boolean;
}

/** A refusal returned by the stateless validators (never an exception). */
export interface LoadTestRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless measurement validator (the single metrics authority):
 * scenarioRef a non-empty opaque id, source one of the two labels,
 * peakRps/p99Ms finite and strictly positive (the metrics truth law:
 * zero, negative, NaN or Infinity are invented numbers, never
 * measurements), measuredAt a non-empty ISO-8601 string.
 */
export function validateLoadTestMeasurement(measurement: LoadTestMeasurement): LoadTestRefusal | null {
  if (typeof measurement.scenarioRef !== "string" || measurement.scenarioRef.length === 0) {
    return { reason: "scenario-ref-empty", detail: "scenarioRef must be a non-empty opaque id" };
  }
  if (!isLoadTestSource(measurement.source)) {
    return {
      reason: "source-invalid",
      detail: `source must be one of: ${LOAD_TEST_SOURCES.join(", ")} (measured or simulated-labeled — never invented)`,
    };
  }
  if (!Number.isFinite(measurement.peakRps) || measurement.peakRps <= 0) {
    return {
      reason: "metrics-invented",
      detail: "peakRps must be a finite positive number (a zero, negative or non-finite reading is an invented metric)",
    };
  }
  if (!Number.isFinite(measurement.p99Ms) || measurement.p99Ms <= 0) {
    return {
      reason: "metrics-invented",
      detail: "p99Ms must be a finite positive number (a zero, negative or non-finite reading is an invented metric)",
    };
  }
  if (typeof measurement.measuredAt !== "string" || measurement.measuredAt.length === 0) {
    return { reason: "measured-at-missing", detail: "measuredAt must be a non-empty ISO-8601 string" };
  }
  return null;
}

/**
 * The stateless regressions validator: a list of non-empty unique
 * statements. Regressions are listed verbatim — an empty string is a
// summarized-away regression, a duplicate is a malformed list.
 */
export function validateLoadTestRegressions(regressions: readonly unknown[]): LoadTestRefusal | null {
  if (!Array.isArray(regressions)) {
    return { reason: "regressions-malformed", detail: "regressions must be a list of non-empty strings" };
  }
  const seen = new Set<string>();
  for (const regression of regressions) {
    if (typeof regression !== "string" || regression.trim().length === 0) {
      return {
        reason: "regression-empty-string",
        detail: "each regression must be a non-empty statement (regressions are listed, never summarized away)",
      };
    }
    if (seen.has(regression)) {
      return { reason: "regression-duplicate", detail: `duplicate regression statement "${regression}"` };
    }
    seen.add(regression);
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen load-test report. The metrics
 * truth law's teeth: the report's peak/p99 must EQUAL the supplied
 * measurement's numbers verbatim, the measurement must reference the
 * same scenario, and the regressions list must be well-formed. The
 * frozen shape carries the report facts (id/scenarioRef/peakRps/p99Ms/
 * regressions/simulated); the measurement provenance (source/measuredAt)
 * rides the `load-test-recorded` event and is reconstructed by
 * shared/src/you/securityLedger.ts replaySecurityLedger.
 */
export function constructLoadTestReport(
  input: {
    readonly id: OpaqueId;
    readonly scenarioRef: OpaqueId;
    readonly peakRps: number;
    readonly p99Ms: number;
    readonly regressions: readonly string[];
  },
  measurement: LoadTestMeasurement | null,
): { readonly ok: true; readonly report: LoadTestReport } | { readonly ok: false; readonly refusal: LoadTestRefusal } {
  if (measurement === null) {
    return {
      ok: false,
      refusal: {
        reason: "report-without-measurement",
        detail: "a load-test report requires its measurement (peak/p99 are never invented — the LOAD TEST LAW)",
      },
    };
  }
  const measurementRefusal = validateLoadTestMeasurement(measurement);
  if (measurementRefusal !== null) {
    return { ok: false, refusal: measurementRefusal };
  }
  if (measurement.scenarioRef !== input.scenarioRef) {
    return {
      ok: false,
      refusal: { reason: "measurement-ref-mismatch", detail: "the measurement must reference the same scenario the report claims" },
    };
  }
  if (measurement.peakRps !== input.peakRps || measurement.p99Ms !== input.p99Ms) {
    return {
      ok: false,
      refusal: {
        reason: "metrics-mismatch",
        detail: "the report's peak/p99 must equal the measurement's numbers verbatim (never restated, never invented)",
      },
    };
  }
  const regressionsRefusal = validateLoadTestRegressions(input.regressions);
  if (regressionsRefusal !== null) {
    return { ok: false, refusal: regressionsRefusal };
  }
  return {
    ok: true,
    report: deepFreeze({
      id: input.id,
      scenarioRef: input.scenarioRef,
      peakRps: input.peakRps,
      p99Ms: input.p99Ms,
      regressions: Object.freeze([...input.regressions]),
      simulated: true,
    }),
  };
}
