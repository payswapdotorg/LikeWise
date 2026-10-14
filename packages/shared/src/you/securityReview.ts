// YOU SecurityReviewRecord machinery (W11A — docs/you/CONTRACTS.md
// "Wave-11 contract freeze (v11)": "SecurityReviewRecord"; the SECURITY
// REVIEW LAW: findings are recorded verbatim; acceptance is a separate
// immutable decision referencing the finding set
// (YOU_SECURITY_REVIEW_INVALID)).
//
// This module owns the STATELESS validators, the immutable record
// constructor and the separate immutable acceptance constructor
// (WORK_ORDERS.md W11A: "SecurityReviewRecord: findings recorded
// verbatim; acceptance as a separate immutable decision referencing the
// finding set"). Validation is pure: no clock, no rng, no store, no
// registry lookup — the service maps refusals to typed
// YOU_SECURITY_REVIEW_INVALID errors at its seam.
//
// The frozen SecurityReviewRecord shape carries the review-pass facts
// only (id/scopeRef/reviewedAt/findingsCount/accepted/simulated), exactly
// like the W10A ImportSecurityVerdict carried its scan facts only. The
// lifecycle head (recorded -> accepted) is a PROJECTION over the
// append-only facts: the review birth and the acceptance decision ride
// the frozen `security-review-recorded` event (the wave's only review
// event — the W7A status-carrier precedent: phase "recorded" for the
// birth with findings verbatim, phase "accepted" for the separate
// immutable decision, exactly like import-quarantined carried
// "quarantined"/"released"). The verbatim finding set rides the event
// payloads (finding.i / findingSeverity.i / findingDescription.i) and is
// reconstructed by shared/src/you/securityLedger.ts
// replaySecurityLedger.
//
// THE SECURITY REVIEW LAW's construct-time teeth (mirroring the DR LAW's
// verified-without-evidence):
//   - constructSecurityReviewRecord: accepted true requires a finding set
//     (non-null, non-empty, count-matching) — refusal
//     "accepted-without-findings". An accepted review can NEVER exist
//     without its findings recorded verbatim.
//   - constructSecurityReviewAcceptance: the separate immutable decision
//     requires the finding set it references (non-null, non-empty) and
//     DERIVES its findingCount and findingSetDigest from that set inside
//     the single authority — the reference to the finding set is correct
//     by construction and can never free-float (the digest comes only
//     from securityReviewFindingSetDigest below).

import type { OpaqueId, SecurityReviewRecord } from "./contract.js";
import { deepFreeze, stableContentHash } from "./serialize.js";

/** The three review severities (the reviewer's input ladder). */
export const REVIEW_SEVERITIES = ["low", "medium", "high"] as const;

export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

const SEVERITY_SET: ReadonlySet<string> = new Set(REVIEW_SEVERITIES);

/** True when the value is one of the three severities. */
export function isReviewSeverity(value: unknown): value is ReviewSeverity {
  return typeof value === "string" && SEVERITY_SET.has(value);
}

/**
 * One review finding — the verbatim unit of the SECURITY REVIEW LAW.
 * description is the finding's verbatim text (never summarized away).
 */
export interface SecurityReviewFinding {
  /** Opaque signature token (e.g. "signature:export-metadata-leak"). */
  readonly signature: string;
  readonly severity: ReviewSeverity;
  /** The verbatim finding statement. */
  readonly description: string;
}

/** Review intake (the review-pass facts). */
export interface SecurityReviewIntake {
  /** The reviewed scope (an opaque ref: a subsystem, a release, a threat-model surface). */
  readonly scopeRef: OpaqueId;
  /** The findings of this pass, recorded verbatim (may be empty — a clean pass). */
  readonly findings: readonly SecurityReviewFinding[];
}

/** A refusal returned by the stateless validators (never an exception). */
export interface SecurityReviewRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/**
 * The stateless review-intake validator (the single review authority):
 * scopeRef a non-empty opaque id, findings a list of well-formed
 * {signature, severity, description} triples (unique signatures, one of
 * the three severities, non-empty verbatim descriptions).
 */
export function validateSecurityReviewIntake(input: SecurityReviewIntake): SecurityReviewRefusal | null {
  if (typeof input.scopeRef !== "string" || input.scopeRef.length === 0) {
    return { reason: "scope-ref-empty", detail: "scopeRef must be a non-empty opaque id" };
  }
  if (!Array.isArray(input.findings)) {
    return { reason: "findings-malformed", detail: "findings must be a list of {signature, severity, description} triples" };
  }
  const seen = new Set<string>();
  for (const finding of input.findings) {
    if (finding === null || typeof finding !== "object") {
      return { reason: "findings-malformed", detail: "findings must be a list of {signature, severity, description} triples" };
    }
    if (typeof finding.signature !== "string" || finding.signature.length === 0) {
      return { reason: "finding-signature-empty", detail: "each finding signature must be a non-empty string" };
    }
    if (!isReviewSeverity(finding.severity)) {
      return {
        reason: "finding-severity-invalid",
        detail: `finding severity must be one of: ${REVIEW_SEVERITIES.join(", ")}`,
      };
    }
    if (typeof finding.description !== "string" || finding.description.trim().length === 0) {
      return { reason: "finding-description-empty", detail: "each finding must carry its verbatim description (never summarized away)" };
    }
    if (seen.has(finding.signature)) {
      return { reason: "finding-duplicate", detail: `duplicate finding signature "${finding.signature}"` };
    }
    seen.add(finding.signature);
  }
  return null;
}

/**
 * The deterministic digest over a verbatim finding set (the acceptance's
 * reference to the finding set). Same findings => same digest; the
 * acceptance decision carries this digest, so the finding set it
 * references is reconstructable and tamper-evident.
 */
export function securityReviewFindingSetDigest(findings: readonly SecurityReviewFinding[]): string {
  return stableContentHash(findings.map((finding) => ({ signature: finding.signature, severity: finding.severity, description: finding.description })));
}

/**
 * Constructs the immutable, deep-frozen review record. THE SECURITY
 * REVIEW LAW's teeth: `accepted: true` requires a finding set —
 * non-null, NON-EMPTY, and findingsCount equal to its length (refusal
 * "accepted-without-findings"). A birth record (accepted: false) may
 * carry any well-formed finding list (including empty — a clean pass
 * records its cleanliness honestly).
 */
export function constructSecurityReviewRecord(
  input: {
    readonly id: OpaqueId;
    readonly scopeRef: OpaqueId;
    readonly reviewedAt: string;
    readonly findingsCount: number;
    readonly accepted: boolean;
  },
  findings: readonly SecurityReviewFinding[] | null,
): { readonly ok: true; readonly record: SecurityReviewRecord } | { readonly ok: false; readonly refusal: SecurityReviewRefusal } {
  if (typeof input.scopeRef !== "string" || input.scopeRef.length === 0) {
    return { ok: false, refusal: { reason: "scope-ref-empty", detail: "scopeRef must be a non-empty opaque id" } };
  }
  if (typeof input.reviewedAt !== "string" || input.reviewedAt.length === 0) {
    return { ok: false, refusal: { reason: "reviewed-at-missing", detail: "reviewedAt must be a non-empty ISO-8601 string" } };
  }
  if (!Number.isSafeInteger(input.findingsCount) || input.findingsCount < 0) {
    return { ok: false, refusal: { reason: "findings-count-invalid", detail: "findingsCount must be a non-negative integer" } };
  }
  if (input.accepted) {
    if (findings === null || findings.length === 0) {
      return {
        ok: false,
        refusal: {
          reason: "accepted-without-findings",
          detail: "an accepted review requires its finding set (the SECURITY REVIEW LAW: never accepted without findings)",
        },
      };
    }
    if (input.findingsCount !== findings.length) {
      return {
        ok: false,
        refusal: {
          reason: "accepted-without-findings",
          detail: "the accepted flag requires findingsCount equal to the recorded finding set's length",
        },
      };
    }
  }
  return {
    ok: true,
    record: deepFreeze({
      id: input.id,
      scopeRef: input.scopeRef,
      reviewedAt: input.reviewedAt,
      findingsCount: input.findingsCount,
      accepted: input.accepted,
      simulated: true,
    }),
  };
}

/**
 * The separate immutable acceptance decision — the ONLY path to an
 * accepted review head (the ImportReleaseRecord precedent: the explicit
 * release record was the only path out of quarantine). It references the
 * finding set through its count AND its digest; both must match the
 * verbatim set (refusal "finding-set-mismatch"), and the set must exist
 * and be non-empty (refusal "acceptance-without-findings" — THE
 * SECURITY REVIEW LAW: a clean pass cannot be "accepted"; it simply
 * stands as recorded).
 */
export interface SecurityReviewAcceptance {
  readonly id: OpaqueId;
  /** The review this decision accepts. */
  readonly reviewId: OpaqueId;
  readonly scopeRef: OpaqueId;
  /** The referenced finding set's length (must equal the set). */
  readonly findingCount: number;
  /** The referenced finding set's digest (must equal the set's digest). */
  readonly findingSetDigest: string;
  readonly acceptedBy: OpaqueId;
  /** The verbatim acceptance rationale. */
  readonly reason: string;
  readonly acceptedAt: string;
  readonly simulated: boolean;
}

/** Acceptance intake (the decision facts). */
export interface SecurityReviewAcceptanceInput {
  readonly acceptedBy: OpaqueId;
  readonly reason: string;
}

/** The stateless acceptance-intake validator. */
export function validateSecurityReviewAcceptanceInput(input: SecurityReviewAcceptanceInput): SecurityReviewRefusal | null {
  if (typeof input.acceptedBy !== "string" || input.acceptedBy.length === 0) {
    return { reason: "accepted-by-empty", detail: "acceptedBy must be a non-empty opaque id" };
  }
  if (typeof input.reason !== "string" || input.reason.trim().length === 0) {
    return { reason: "acceptance-reason-empty", detail: "acceptance reason must be a non-empty string" };
  }
  return null;
}

/** Constructs the immutable, deep-frozen acceptance record. */
export function constructSecurityReviewAcceptance(
  input: {
    readonly id: OpaqueId;
    readonly reviewId: OpaqueId;
    readonly scopeRef: OpaqueId;
    readonly acceptedBy: OpaqueId;
    readonly reason: string;
    readonly acceptedAt: string;
  },
  findings: readonly SecurityReviewFinding[] | null,
): { readonly ok: true; readonly acceptance: SecurityReviewAcceptance } | { readonly ok: false; readonly refusal: SecurityReviewRefusal } {
  if (typeof input.reviewId !== "string" || input.reviewId.length === 0) {
    return { ok: false, refusal: { reason: "review-id-empty", detail: "reviewId must be a non-empty opaque id" } };
  }
  if (typeof input.scopeRef !== "string" || input.scopeRef.length === 0) {
    return { ok: false, refusal: { reason: "scope-ref-empty", detail: "scopeRef must be a non-empty opaque id" } };
  }
  const intake = validateSecurityReviewAcceptanceInput({ acceptedBy: input.acceptedBy, reason: input.reason });
  if (intake !== null) {
    return { ok: false, refusal: intake };
  }
  if (typeof input.acceptedAt !== "string" || input.acceptedAt.length === 0) {
    return { ok: false, refusal: { reason: "accepted-at-missing", detail: "acceptedAt must be a non-empty ISO-8601 string" } };
  }
  if (findings === null || findings.length === 0) {
    return {
      ok: false,
      refusal: {
        reason: "acceptance-without-findings",
        detail: "an acceptance decision requires the finding set it references (the SECURITY REVIEW LAW)",
      },
    };
  }
  const findingCount = findings.length;
  const findingSetDigest = securityReviewFindingSetDigest(findings);
  return {
    ok: true,
    acceptance: deepFreeze({
      id: input.id,
      reviewId: input.reviewId,
      scopeRef: input.scopeRef,
      findingCount,
      findingSetDigest,
      acceptedBy: input.acceptedBy,
      reason: input.reason,
      acceptedAt: input.acceptedAt,
      simulated: true,
    }),
  };
}
