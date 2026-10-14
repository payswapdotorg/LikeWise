// YOU security service — security review flow (W11A). The ops live
// here; securityService.ts is the single authority that dispatches into
// them (the W1A/W8A/W10A flow precedent).
//
// THE SECURITY REVIEW LAW (docs/you/CONTRACTS.md wave-11): findings are
// recorded verbatim; acceptance is a separate immutable decision
// referencing the finding set (YOU_SECURITY_REVIEW_INVALID).
//
// The lifecycle (the import-quarantine precedent, one phase carrier
// event): recordSecurityReviewOp appends the `security-review-recorded`
// birth (phase "recorded", findings verbatim, the immutable record with
// accepted: false); acceptSecurityReviewOp appends the separate
// immutable acceptance decision (phase "accepted") referencing the
// finding set through its count + digest. The stateless authorities are
// shared/src/you/securityReview.ts (validateSecurityReviewIntake /
// constructSecurityReviewRecord / constructSecurityReviewAcceptance);
// nothing here is a second validator.
//
// Service-level law teeth (beyond the construct-time teeth):
//   - unknown review           -> typed refusal (nothing exists to audit);
//   - empty finding set         -> "acceptance-without-findings" (THE
//                                  LAW: a clean pass cannot be accepted —
//                                  there is no finding set to reference);
//   - already accepted          -> "already-accepted" (the decision is
//                                  immutable; a re-acceptance is refused,
//                                  never a rewrite).

import type { SecurityReviewRecord } from "@zcode/shared";
import {
  constructSecurityReviewAcceptance,
  constructSecurityReviewRecord,
  validateSecurityReviewIntake,
  type SecurityReviewAcceptance,
  type SecurityReviewAcceptanceInput,
  type SecurityReviewFinding,
  type SecurityReviewIntake,
  type SecurityReviewRefusal,
} from "../../../shared/src/you/securityReview.js";
import { appendSecurityReviewRecorded } from "./securityLedgerOps.js";
import {
  securityFailure,
  type SecurityFlowDeps,
  type SecurityPlaneRecord,
  type SecurityServiceResult,
} from "./securityServiceTypes.js";

/** Maps a stateless review refusal to the typed service error. */
function reviewRefusal(refusal: SecurityReviewRefusal): { readonly ok: false; readonly error: ReturnType<typeof securityFailure>["error"] } {
  return securityFailure("YOU_SECURITY_REVIEW_INVALID", `Security review refused: ${refusal.detail}`, {
    reason: refusal.reason,
  });
}

/**
 * Records one security review pass: the immutable birth record (accepted:
 * false) with its findings stored verbatim, appended as the
 * `security-review-recorded` event (phase "recorded"). A clean pass
 * (zero findings) records its cleanliness honestly.
 */
export function recordSecurityReviewOp(
  plane: SecurityPlaneRecord,
  deps: SecurityFlowDeps,
  input: SecurityReviewIntake,
): SecurityServiceResult<{ readonly record: SecurityReviewRecord; readonly findings: readonly SecurityReviewFinding[] }> {
  // The stateless intake authority gates the seam FIRST (the scanImportOp
  // precedent): scope shape, findings well-formedness, no duplicates.
  const intake = validateSecurityReviewIntake(input);
  if (intake !== null) {
    return reviewRefusal(intake);
  }
  const constructed = constructSecurityReviewRecord(
    {
      id: deps.ids.next("security-review"),
      scopeRef: input.scopeRef,
      reviewedAt: deps.clock.now(),
      findingsCount: input.findings.length,
      accepted: false,
    },
    input.findings,
  );
  if (!constructed.ok) {
    return reviewRefusal(constructed.refusal);
  }
  const findings = Object.freeze([...input.findings]);
  plane.reviews.set(constructed.record.id, constructed.record);
  plane.reviewFindings.set(constructed.record.id, findings);
  plane.reviewStatuses.set(constructed.record.id, "recorded");
  appendSecurityReviewRecorded(plane, { phase: "recorded", record: constructed.record, findings });
  return { ok: true, value: { record: constructed.record, findings } };
}

/**
 * Accepts a recorded review through the separate immutable decision (the
 * ONLY path to an accepted head): constructs the SecurityReviewAcceptance
 * referencing the finding set (count + digest derived by the single
// authority from the stored verbatim set) and appends the
 * `security-review-recorded` event (phase "accepted"). THE LAW's
 * service-level teeth: a review with an empty finding set cannot be
 * accepted ("acceptance-without-findings"); an already-accepted review
 * cannot be re-accepted ("already-accepted" — the decision is immutable).
 */
export function acceptSecurityReviewOp(
  plane: SecurityPlaneRecord,
  deps: SecurityFlowDeps,
  reviewId: SecurityReviewRecord["id"],
  input: SecurityReviewAcceptanceInput,
): SecurityServiceResult<{ readonly acceptance: SecurityReviewAcceptance }> {
  const record = plane.reviews.get(reviewId);
  if (record === undefined) {
    return securityFailure("YOU_SECURITY_REVIEW_INVALID", "Security review refused: unknown review", {
      reason: "unknown-review",
      reviewId,
    });
  }
  const status = plane.reviewStatuses.get(reviewId);
  if (status === "accepted") {
    return securityFailure("YOU_SECURITY_REVIEW_INVALID", "Security review refused: the acceptance decision is immutable (already accepted)", {
      reason: "already-accepted",
      reviewId,
    });
  }
  const findings = plane.reviewFindings.get(reviewId) ?? [];
  if (findings.length === 0) {
    return securityFailure("YOU_SECURITY_REVIEW_INVALID", "Security review refused: an acceptance decision requires the finding set it references (the SECURITY REVIEW LAW)", {
      reason: "acceptance-without-findings",
      reviewId,
      findingCount: 0,
    });
  }
  const constructed = constructSecurityReviewAcceptance(
    {
      id: deps.ids.next("review-acceptance"),
      reviewId,
      scopeRef: record.scopeRef,
      acceptedBy: input.acceptedBy,
      reason: input.reason,
      acceptedAt: deps.clock.now(),
    },
    findings,
  );
  if (!constructed.ok) {
    return reviewRefusal(constructed.refusal);
  }
  plane.reviewAcceptances.set(constructed.acceptance.id, constructed.acceptance);
  plane.reviewStatuses.set(reviewId, "accepted");
  appendSecurityReviewRecorded(plane, { phase: "accepted", record, findings, acceptance: constructed.acceptance });
  return { ok: true, value: { acceptance: constructed.acceptance } };
}
