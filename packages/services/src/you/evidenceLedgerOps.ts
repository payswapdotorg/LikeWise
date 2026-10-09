// YOU evidence service — ledger event emission + live projection maps.
//
// Append-only event helpers following the W1A precedent
// (solutionLedgerOps.ts): per-record status facts ride along in event
// payloads because the frozen SolutionEventType set has no per-record
// status events. Payload conventions (folded by
// shared/src/you/evidenceLedger.ts replayEvidenceLedger):
//   consent-recorded          { policyId, consentState, ..., captureSessionId?, sessionStatusAfter? }
//   consent-withdrawn         { policyId, consentState }   // withdrawn | expired
//   capture-session-opened    { captureSessionId, sessionStatusAfter, ... }
//   capture-session-completed { captureSessionId, sessionStatusAfter, ... }
//   evidence-recorded         { evidenceId, retentionPolicy, simulated, ... }
//   evidence-reviewed         { reviewId, evidenceId, reviewStatus, supersedesReviewId?, ... }

import type { ConsentPolicy, EvidenceRecord, EvidenceReview, OpaqueId } from "@zcode/shared";
import type { CaptureSession, ConsentState } from "@zcode/shared";
import type { EvidencePlaneRecord } from "./evidenceServiceTypes.js";

export interface ConsentEventFacts {
  readonly policy: ConsentPolicy;
  readonly consentState: ConsentState;
  /** Session whose status rides along when consent drives a session transition. */
  readonly session?: CaptureSession;
}

/** Appends consent-recorded with the post-state (registration/decision facts). */
export function appendConsentRecorded(plane: EvidencePlaneRecord, facts: ConsentEventFacts): void {
  plane.ledger.append({
    type: "consent-recorded",
    subjectRef: facts.policy.id,
    generator: "user",
    payload: {
      policyId: facts.policy.id,
      consentState: facts.consentState,
      scope: facts.policy.scope,
      purposes: [...facts.policy.purposes].sort().join(","),
      operationalUse: facts.policy.operationalUse,
      learningReuse: facts.policy.learningReuse,
      revocable: facts.policy.revocable,
      retentionPolicy: facts.policy.retention.policy,
      simulated: true,
      ...(facts.session === undefined
        ? {}
        : { captureSessionId: facts.session.id, sessionStatusAfter: facts.session.status }),
    },
  });
}

/** Appends consent-withdrawn (withdrawal or retention-driven expiry). */
export function appendConsentWithdrawn(
  plane: EvidencePlaneRecord,
  policyId: OpaqueId,
  consentState: "withdrawn" | "expired",
  reason: string,
): void {
  plane.ledger.append({
    type: "consent-withdrawn",
    subjectRef: policyId,
    generator: "user",
    payload: { policyId, consentState, reason, simulated: true },
  });
}

/** Appends capture-session-opened (creation facts + settled status). */
export function appendCaptureSessionOpened(plane: EvidencePlaneRecord, session: CaptureSession): void {
  plane.ledger.append({
    type: "capture-session-opened",
    subjectRef: session.id,
    generator: session.provenance.generator,
    payload: {
      captureSessionId: session.id,
      evidenceRequestId: session.evidenceRequestId ?? "",
      sessionStatusAfter: session.status,
      scope: session.scope,
      stepCount: session.guideSteps.length,
      consentPolicyId: session.consent.policyId,
      consentState: session.consent.state,
      simulated: true,
    },
  });
}

export interface CaptureCompletedFacts {
  readonly session: CaptureSession;
  /** Evidence ids whose session-only content was removed at terminality. */
  readonly expiredEvidenceIds: readonly OpaqueId[];
}

/** Appends capture-session-completed (any terminal status rides in statusAfter). */
export function appendCaptureSessionCompleted(plane: EvidencePlaneRecord, facts: CaptureCompletedFacts): void {
  const expired: Record<string, boolean> = {};
  for (const evidenceId of [...facts.expiredEvidenceIds].sort()) {
    expired[`expiredEvidence.${evidenceId}`] = true;
  }
  plane.ledger.append({
    type: "capture-session-completed",
    subjectRef: facts.session.id,
    generator: facts.session.provenance.generator,
    payload: {
      captureSessionId: facts.session.id,
      evidenceRequestId: facts.session.evidenceRequestId ?? "",
      sessionStatusAfter: facts.session.status,
      completedAt: facts.session.completedAt ?? "",
      contentRemoved: facts.expiredEvidenceIds.length > 0,
      simulated: true,
      ...expired,
    },
  });
}

/** Appends evidence-recorded (contentRef + contentHash binding; never content bytes). */
export function appendEvidenceRecorded(plane: EvidencePlaneRecord, record: EvidenceRecord): void {
  plane.ledger.append({
    type: "evidence-recorded",
    subjectRef: record.id,
    generator: record.provenance.generator,
    payload: {
      evidenceId: record.id,
      evidenceRequestId: record.evidenceRequestId ?? "",
      captureSessionId: record.captureSessionId ?? "",
      evidenceType: record.evidenceType,
      modality: record.modality,
      privacyClass: record.privacyClass,
      contentRef: record.contentRef,
      contentHash: record.contentHash,
      retentionPolicy: record.retention.policy,
      retentionDeleteAfter: record.retention.deleteAfter ?? "",
      consentPolicyId: record.consent.policyId,
      consentState: record.consent.state,
      simulated: record.simulated,
    },
  });
}

export interface EvidenceReviewedFacts {
  readonly review: EvidenceReview;
  /** Set when this review supersedes an earlier one (linkage, never an overwrite). */
  readonly supersedesReviewId?: OpaqueId;
  /** True when delete-after-review retention removed the content at review time. */
  readonly contentRemovedAfterReview: boolean;
}

/** Appends evidence-reviewed with flattened quality observations. */
export function appendEvidenceReviewed(plane: EvidencePlaneRecord, facts: EvidenceReviewedFacts): void {
  const quality: Record<string, number> = {};
  for (const [deficiencyClass, score] of Object.entries(facts.review.qualityObservations).sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    quality[`quality.${deficiencyClass}`] = score;
  }
  plane.ledger.append({
    type: "evidence-reviewed",
    subjectRef: facts.review.evidenceId,
    generator: facts.review.reviewerType,
    payload: {
      reviewId: facts.review.id,
      evidenceId: facts.review.evidenceId,
      reviewerType: facts.review.reviewerType,
      reviewStatus: facts.review.status,
      supersedesReviewId: facts.supersedesReviewId ?? "",
      contentRemovedAfterReview: facts.contentRemovedAfterReview,
      notes: facts.review.notes,
      simulated: true,
      ...quality,
    },
  });
}
