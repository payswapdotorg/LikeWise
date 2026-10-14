// YOU security service — live plane projection builder.
//
// Builds the authoritative SecurityPlaneProjection from the service's
// live state in EXACTLY the shape replaySecurityLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in
// tests via stableStringify; any drift between this builder and the
// fold is a bug.
//
// The builder reads the live records and applies the SAME projection
// rules as the fold:
//   - reviews: one entry per recorded review, BOTH statuses (the
//     lifecycle head from the plane, never stored on the frozen record
//     shape); the acceptance facts come from the separate immutable
//     decision (the latest acceptance per review, the
//     latestReleaseFor precedent);
//   - load tests: one entry per report, the measurement provenance
//     (source + measuredAt) from the stored measurement the report
//     states verbatim.
//
// ThreatModelEntry records are SERVICE STATE (the rate-limit policy
// precedent — the frozen event set has no threat-model event) and
// therefore do not appear in the projection.

import type { OpaqueId } from "@zcode/shared";
import type {
  SecurityLedgerLoadTestEntry,
  SecurityLedgerReviewEntry,
  SecurityPlaneProjection,
} from "../../../shared/src/you/securityLedger.js";
import type { SecurityPlaneRecord } from "./securityServiceTypes.js";
import { sortedMapKeys } from "./securityServiceTypes.js";

/** Builds the live security-plane projection (equal to replaySecurityLedger output). */
export function buildSecurityPlaneProjection(plane: SecurityPlaneRecord): SecurityPlaneProjection {
  const securityReviews: Record<string, SecurityLedgerReviewEntry> = {};
  const loadTests: Record<string, SecurityLedgerLoadTestEntry> = {};

  // -- reviews (both statuses; the lifecycle heads + acceptance facts) -------
  for (const reviewId of sortedMapKeys(plane.reviews)) {
    const record = plane.reviews.get(reviewId);
    if (record === undefined) {
      continue;
    }
    const status = plane.reviewStatuses.get(reviewId) === "accepted" ? "accepted" : "recorded";
    const findings = (plane.reviewFindings.get(reviewId) ?? []).map((finding) => ({
      signature: finding.signature,
      severity: finding.severity,
      description: finding.description,
    }));
    const acceptance = status === "accepted" ? latestAcceptanceFor(plane, reviewId) : null;
    securityReviews[reviewId] = {
      scopeRef: record.scopeRef,
      reviewedAt: record.reviewedAt,
      findingCount: findings.length,
      findings: Object.freeze(findings),
      status,
      acceptanceId: acceptance?.id ?? "",
      acceptedBy: acceptance?.acceptedBy ?? "",
      acceptanceReason: acceptance?.reason ?? "",
      acceptedAt: acceptance?.acceptedAt ?? "",
      findingSetDigest: acceptance?.findingSetDigest ?? "",
      simulated: true,
    };
  }

  // -- load tests (the reports + their measurement provenance) --------------
  for (const reportId of sortedMapKeys(plane.loadTests)) {
    const report = plane.loadTests.get(reportId);
    if (report === undefined) {
      continue;
    }
    const measurement = plane.loadTestMeasurements.get(reportId);
    loadTests[reportId] = {
      scenarioRef: report.scenarioRef,
      peakRps: report.peakRps,
      p99Ms: report.p99Ms,
      source: measurement?.source ?? "simulated",
      measuredAt: measurement?.measuredAt ?? "",
      regressionCount: report.regressions.length,
      regressions: Object.freeze([...report.regressions]),
      simulated: true,
    };
  }

  return {
    solutionId: plane.solutionId,
    securityReviews,
    loadTests,
  };
}

/** The latest acceptance decision for a review (append-only; the last wins). */
function latestAcceptanceFor(
  plane: SecurityPlaneRecord,
  reviewId: OpaqueId,
): { readonly id: OpaqueId; readonly acceptedBy: OpaqueId; readonly reason: string; readonly acceptedAt: string; readonly findingSetDigest: string } | null {
  let latest: { readonly id: OpaqueId; readonly acceptedBy: OpaqueId; readonly reason: string; readonly acceptedAt: string; readonly findingSetDigest: string } | null = null;
  for (const acceptanceId of sortedMapKeys(plane.reviewAcceptances)) {
    const acceptance = plane.reviewAcceptances.get(acceptanceId);
    if (acceptance === undefined || acceptance.reviewId !== reviewId) {
      continue;
    }
    if (latest === null || acceptance.acceptedAt >= latest.acceptedAt) {
      latest = acceptance;
    }
  }
  return latest;
}
