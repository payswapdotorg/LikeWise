// YOU security application service — shared internal types and helpers.
//
// The application service (securityService.ts) is the single authority
// over hardening-verification truth (docs/you/CONTRACTS.md "Wave-11
// contract freeze (v11)"; WORK_ORDERS.md W11A): threat-model entries,
// security review records + their separate acceptance decisions, and
// load-test reports. The plane separation holds by construction: the
// service NEVER mutates evidence/twin/editing/platform state; it records
// hardening-verification facts only. The stateless validators stay the
// single refusal authority (shared/src/you/threatModel.ts,
// securityReview.ts, loadTest.ts); nothing here is a second validator.
//
// Error-code mapping (frozen W11A taxonomy):
//   YOU_SECURITY_REVIEW_INVALID — threat-model intake (class/vector/
//                                 mitigationRef/residual), review intake
//                                 (scope/findings), the acceptance law
//                                 (acceptance-without-findings,
//                                 already-accepted, unknown-review) and
//                                 unknown threat-entry lookups
//   YOU_LOAD_TEST_INVALID        — measurement (source/metrics/measuredAt),
//                                 regressions, report construction
//                                 (report-without-measurement/
//                                 measurement-ref-mismatch/metrics-mismatch)
//                                 and unknown load-test lookups

import type {
  LoadTestReport,
  OpaqueId,
  SecurityReviewRecord,
  ThreatModelEntry,
  YouError,
} from "@zcode/shared";
import type { SecurityReviewAcceptance, SecurityReviewFinding } from "../../../shared/src/you/securityReview.js";
import type { LoadTestMeasurement } from "../../../shared/src/you/loadTest.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type SecurityServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function securityFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

/** The deps every security flow receives (injected clock/ids). */
export interface SecurityFlowDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/**
 * The review lifecycle head (a projection over the append-only facts,
 * never stored on the frozen record shape): recorded -> accepted.
 */
export type SecurityReviewStatus = "recorded" | "accepted";

/**
 * One solution's security plane: the append-only ledger, the immutable
 * threat-model entries, the immutable review records + their verbatim
 * finding sets + lifecycle heads + separate acceptance decisions, and
 * the immutable load-test reports + their measurements. The service is
 * the sole writer; records are immutable and every review birth /
 * acceptance decision / load-test run rides the ledger.
 */
export interface SecurityPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** entryId -> immutable ThreatModelEntry (pre-review service state — the rate-limit policy precedent). */
  readonly threatModel: Map<OpaqueId, ThreatModelEntry>;
  /** reviewId -> immutable SecurityReviewRecord (the birth record; accepted stays false — the acceptance is the separate decision). */
  readonly reviews: Map<OpaqueId, SecurityReviewRecord>;
  /** reviewId -> the verbatim finding set of the review birth (the fold facts ride the events). */
  readonly reviewFindings: Map<OpaqueId, readonly SecurityReviewFinding[]>;
  /** reviewId -> the lifecycle head. */
  readonly reviewStatuses: Map<OpaqueId, SecurityReviewStatus>;
  /** acceptanceId -> immutable SecurityReviewAcceptance (the separate decision). */
  readonly reviewAcceptances: Map<OpaqueId, SecurityReviewAcceptance>;
  /** reportId -> immutable LoadTestReport. */
  readonly loadTests: Map<OpaqueId, LoadTestReport>;
  /** reportId -> the measurement the report states verbatim (the provenance facts ride the events). */
  readonly loadTestMeasurements: Map<OpaqueId, LoadTestMeasurement>;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The threat-entry lookup helper: typed YOU_SECURITY_REVIEW_INVALID. */
export function requireThreatModelEntry(
  plane: SecurityPlaneRecord,
  entryId: OpaqueId,
): { readonly entry: ThreatModelEntry } | { readonly error: YouError } {
  const entry = plane.threatModel.get(entryId);
  if (entry === undefined) {
    return {
      error: {
        code: "YOU_SECURITY_REVIEW_INVALID",
        message: "unknown threat-model entry",
        details: { reason: "unknown-threat-entry", entryId },
        simulated: true,
      },
    };
  }
  return { entry };
}

/** The review lookup helper: typed YOU_SECURITY_REVIEW_INVALID. */
export function requireSecurityReview(
  plane: SecurityPlaneRecord,
  reviewId: OpaqueId,
): { readonly record: SecurityReviewRecord } | { readonly error: YouError } {
  const record = plane.reviews.get(reviewId);
  if (record === undefined) {
    return {
      error: {
        code: "YOU_SECURITY_REVIEW_INVALID",
        message: "unknown security review",
        details: { reason: "unknown-review", reviewId },
        simulated: true,
      },
    };
  }
  return { record };
}

/** The acceptance lookup helper: typed YOU_SECURITY_REVIEW_INVALID. */
export function requireSecurityReviewAcceptance(
  plane: SecurityPlaneRecord,
  reviewId: OpaqueId,
): { readonly acceptance: SecurityReviewAcceptance } | { readonly error: YouError } {
  for (const acceptance of plane.reviewAcceptances.values()) {
    if (acceptance.reviewId === reviewId) {
      return { acceptance };
    }
  }
  return {
    error: {
      code: "YOU_SECURITY_REVIEW_INVALID",
      message: "security review has no acceptance decision",
      details: { reason: "no-acceptance", reviewId },
      simulated: true,
    },
  };
}

/** The load-test lookup helper: typed YOU_LOAD_TEST_INVALID. */
export function requireLoadTestReport(
  plane: SecurityPlaneRecord,
  reportId: OpaqueId,
): { readonly report: LoadTestReport } | { readonly error: YouError } {
  const report = plane.loadTests.get(reportId);
  if (report === undefined) {
    return {
      error: {
        code: "YOU_LOAD_TEST_INVALID",
        message: "unknown load-test report",
        details: { reason: "unknown-load-test", reportId },
        simulated: true,
      },
    };
  }
  return { report };
}
