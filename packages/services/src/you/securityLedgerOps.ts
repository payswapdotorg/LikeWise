// YOU security service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W7A/W10A precedent
// (solutionLedgerOps.ts / embodimentLedgerOps.ts /
// platformLedgerOps.ts): per-record status facts ride along in event
// payloads because the frozen SolutionEventType set has no per-record
// status events — the frozen `security-review-recorded` event is the
// review lifecycle carrier (phase "recorded" for the review birth with
// findings verbatim, phase "accepted" for the separate immutable
// acceptance decision — the W7A status-carrier precedent, exactly like
// import-quarantined carried "quarantined"/"released"), and
// `load-test-recorded` IS the load-test report carrier (the metrics
// truth facts — source + measuredAt — and the regressions list ride it
// verbatim). Payload conventions are folded by
// shared/src/you/securityLedger.ts replaySecurityLedger. Every record id
// mints from the injected id factory at the flow seam (opaque ids,
// deterministic in fixture mode).
//
// Truth law: every payload carries simulated: true in fixture mode.

import type { LoadTestReport, OpaqueId, SecurityReviewRecord } from "@zcode/shared";
import type { LoadTestMeasurement } from "../../../shared/src/you/loadTest.js";
import type { SecurityReviewAcceptance, SecurityReviewFinding } from "../../../shared/src/you/securityReview.js";
import type { SecurityPlaneRecord } from "./securityServiceTypes.js";

/**
 * Appends security-review-recorded (phase "recorded" — the review birth;
 * findings verbatim). Acceptance fields ride empty at birth.
 */
export function appendSecurityReviewRecorded(
  plane: SecurityPlaneRecord,
  input: {
    readonly phase: "recorded";
    readonly record: SecurityReviewRecord;
    readonly findings: readonly SecurityReviewFinding[];
  },
): void;

/**
 * Appends security-review-recorded (phase "accepted" — the separate
 * immutable acceptance decision referencing the finding set).
 */
export function appendSecurityReviewRecorded(
  plane: SecurityPlaneRecord,
  input: {
    readonly phase: "accepted";
    readonly record: SecurityReviewRecord;
    readonly findings: readonly SecurityReviewFinding[];
    readonly acceptance: SecurityReviewAcceptance;
  },
): void;

export function appendSecurityReviewRecorded(
  plane: SecurityPlaneRecord,
  input: {
    readonly phase: "recorded" | "accepted";
    readonly record: SecurityReviewRecord;
    readonly findings: readonly SecurityReviewFinding[];
    readonly acceptance?: SecurityReviewAcceptance;
  },
): void {
  const payload: Record<string, string | number | boolean> = {
    reviewId: input.record.id,
    scopeRef: input.record.scopeRef,
    reviewedAt: input.record.reviewedAt,
    phase: input.phase,
    findingCount: input.findings.length,
    acceptanceId: "",
    acceptedBy: "",
    acceptanceReason: "",
    acceptedAt: "",
    findingSetDigest: "",
    simulated: true,
  };
  input.findings.forEach((finding, index) => {
    payload[`finding.${index}`] = finding.signature;
    payload[`findingSeverity.${index}`] = finding.severity;
    payload[`findingDescription.${index}`] = finding.description;
  });
  if (input.phase === "accepted" && input.acceptance !== undefined) {
    payload["acceptanceId"] = input.acceptance.id;
    payload["acceptedBy"] = input.acceptance.acceptedBy;
    payload["acceptanceReason"] = input.acceptance.reason;
    payload["acceptedAt"] = input.acceptance.acceptedAt;
    payload["findingSetDigest"] = input.acceptance.findingSetDigest;
  }
  plane.ledger.append({
    type: "security-review-recorded",
    subjectRef: input.record.id,
    generator: "agent",
    payload,
  });
}

/**
 * Appends load-test-recorded — the report with its measurement
 * provenance (source + measuredAt) and the regressions listed verbatim.
 */
export function appendLoadTestRecorded(
  plane: SecurityPlaneRecord,
  report: LoadTestReport,
  measurement: LoadTestMeasurement,
): void {
  const payload: Record<string, string | number | boolean> = {
    reportId: report.id,
    scenarioRef: report.scenarioRef,
    peakRps: report.peakRps,
    p99Ms: report.p99Ms,
    source: measurement.source,
    measuredAt: measurement.measuredAt,
    regressionCount: report.regressions.length,
    simulated: true,
  };
  report.regressions.forEach((regression, index) => {
    payload[`regression.${index}`] = regression;
  });
  plane.ledger.append({
    type: "load-test-recorded",
    subjectRef: report.id,
    generator: "agent",
    payload,
  });
}
