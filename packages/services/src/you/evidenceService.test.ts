import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRecord, OpaqueId } from "@zcode/shared";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { deleteAfterReviewRetention, projectRetention, sessionOnlyRetention, tenantRetention } from "../../../shared/src/you/evidenceRetention.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createEvidenceService, EvidenceService, type EvidenceServiceConfig } from "./evidenceService.js";

const SOLUTION = "you_solution_w2atest01";

const CAPTURE_CONSENT = {
  purposes: ["solution-generation", "quality-improvement"] as const,
  operationalUse: true,
  learningReuse: false,
  retention: sessionOnlyRetention("test capture consent"),
  revocable: true,
};

function makeService(overrides: Partial<EvidenceServiceConfig> = {}): EvidenceService {
  return createEvidenceService({ workspaceIdentity: "ws-w2a-test", seed: "you-w2a-service-test", ...overrides });
}

interface SessionHandle {
  readonly sessionId: OpaqueId;
  readonly policyId: OpaqueId;
}

function openGrantedSession(service: EvidenceService, solutionId: OpaqueId = SOLUTION): SessionHandle {
  const opened = service.openCaptureSession(solutionId, {
    evidenceRequest: null,
    scope: "USER",
    consent: { ...CAPTURE_CONSENT },
    guideSpec: { targetDeficiency: "identity", preferredFraming: "test framing", requiredModalities: ["image"] },
  });
  assert.ok(opened.ok);
  const granted = service.grantConsent(solutionId, opened.value.consentPolicyId);
  assert.ok(granted.ok);
  return { sessionId: opened.value.session.id, policyId: opened.value.consentPolicyId };
}

function recordFromSession(
  service: EvidenceService,
  session: SessionHandle,
  overrides: {
    privacyClass?: EvidenceRecord["privacyClass"];
    retention?: EvidenceRecord["retention"];
    modality?: "image" | "video" | "depth" | "measurement";
    sessionBound?: boolean;
    policyId?: OpaqueId | null;
  } = {},
): EvidenceRecord {
  const recorded = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: overrides.sessionBound === false ? null : session.sessionId,
    evidenceType: "fixture",
    modality: overrides.modality ?? "image",
    privacyClass: overrides.privacyClass ?? "sensitive-media",
    retention: overrides.retention ?? projectRetention("2099-01-01T00:00:00.000Z", "test"),
    consentPolicyId: overrides.policyId === undefined ? session.policyId : overrides.policyId,
  });
  assert.ok(recorded.ok, recorded.ok ? "" : recorded.error.message);
  return recorded.value.record;
}

/** Wraps a store so `get` returns tampered bytes (storage corruption). */
function tamperedStore(store: EvidenceContentStore): EvidenceContentStore {
  return {
    put: (bytes) => store.put(bytes),
    get: (contentRef) => {
      const bytes = store.get(contentRef);
      if (bytes === null) {
        return null;
      }
      const corrupted = Uint8Array.from(bytes);
      corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;
      return corrupted;
    },
    has: (contentRef) => store.has(contentRef),
    delete: (contentRef) => store.delete(contentRef),
    get size() {
      return store.size;
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Evidence immutability + append-only ledger
// ---------------------------------------------------------------------------

test("evidence records are immutable: in-place mutation throws; re-recording never overwrites", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const first = recordFromSession(service, session);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.retention));
  assert.ok(Object.isFrozen(first.consent));
  assert.ok(Object.isFrozen(first.provenance));
  assert.throws(() => {
    (first as unknown as { privacyClass: string }).privacyClass = "public-metadata";
  }, TypeError);
  const second = recordFromSession(service, session, { modality: "video" });
  assert.notEqual(second.id, first.id);
  const firstAgain = service.evidenceRecordOf(SOLUTION, first.id);
  assert.ok(firstAgain.ok);
  assert.equal(stableStringify(firstAgain.value), stableStringify(first));
});

test("the evidence ledger is append-only: prior events never change as new events arrive", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const before = service.ledgerEventsOf(SOLUTION);
  assert.ok(before.ok);
  const eventsBefore = before.value;
  const snapshot = stableStringify(eventsBefore);
  recordFromSession(service, session);
  recordFromSession(service, session, { modality: "measurement" });
  const after = service.ledgerEventsOf(SOLUTION);
  assert.ok(after.ok);
  const eventsAfter = after.value;
  assert.ok(eventsAfter.length > eventsBefore.length);
  assert.equal(stableStringify(eventsAfter.slice(0, eventsBefore.length)), snapshot);
  assert.ok(Object.isFrozen(eventsAfter));
  assert.throws(() => {
    (eventsAfter as unknown as unknown[]).push(eventsAfter[0] as unknown);
  }, TypeError);
});

// ---------------------------------------------------------------------------
// 2. Hash binding — mismatch is a typed error, never a silent repair
// ---------------------------------------------------------------------------

test("stored-bytes hash mismatch reads as YOU_CONTENT_HASH_MISMATCH and never repairs", () => {
  const baseStore = createFixtureEvidenceContentStore();
  const service = makeService({ contentStore: tamperedStore(baseStore) });
  const session = openGrantedSession(service);
  const record = recordFromSession(service, session);
  const recordedHash = record.contentHash;

  const read = service.readEvidenceContent(SOLUTION, record.id);
  assert.ok(!read.ok);
  assert.equal(read.error.code, "YOU_CONTENT_HASH_MISMATCH");
  assert.equal(read.error.details.recordedHash, recordedHash);
  assert.notEqual(read.error.details.actualHash, recordedHash);
  assert.equal(read.error.simulated, true);

  const verify = service.verifyEvidenceIntegrity(SOLUTION, record.id);
  assert.ok(!verify.ok);
  assert.equal(verify.error.code, "YOU_CONTENT_HASH_MISMATCH");

  // Truth law: the mismatch is never silently repaired — the record keeps
  // its original hash binding and the store is left as-is.
  const recordAfter = service.evidenceRecordOf(SOLUTION, record.id);
  assert.ok(recordAfter.ok);
  assert.equal(recordAfter.value.contentHash, recordedHash);
});

test("clean stores verify byte-identically against the recorded hash", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const record = recordFromSession(service, session);
  const read = service.readEvidenceContent(SOLUTION, record.id);
  assert.ok(read.ok);
  assert.equal(read.value.contentHash, record.contentHash);
  assert.equal(read.value.bytes.byteLength, 2048);
  assert.equal(read.value.contentRef, record.contentRef);
  const verify = service.verifyEvidenceIntegrity(SOLUTION, record.id);
  assert.ok(verify.ok);
  assert.equal(verify.value.verified, true);
});

// ---------------------------------------------------------------------------
// 3. Consent enforcement matrix at the service boundary
// ---------------------------------------------------------------------------

test("sensitive evidence cannot be recorded without an active covering consent (service matrix)", () => {
  const service = makeService();
  const session = openGrantedSession(service);

  // granted + covered -> recorded
  const grantedRecord = recordFromSession(service, session);
  assert.match(grantedRecord.id, /^you_evidence_[0-9a-f]{16}$/);
  // sensitive + no instrument at all -> YOU_CONSENT_REQUIRED
  const noInstrument = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "image",
    privacyClass: "sensitive-media",
    retention: projectRetention(null, "test"),
    consentPolicyId: null,
  });
  assert.ok(!noInstrument.ok);
  assert.equal(noInstrument.error.code, "YOU_CONSENT_REQUIRED");
  assert.equal(noInstrument.error.details.reason, "consent-required");

  // sensitive + undecided policy -> denied
  const undecided = service.registerConsentPolicy(SOLUTION, {
    purposes: ["solution-generation"],
    scope: "USER",
    operationalUse: true,
    learningReuse: false,
    retention: projectRetention(null, "test"),
    revocable: true,
  });
  assert.ok(undecided.ok);
  const undecidedRecord = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "image",
    privacyClass: "biometric-evidence",
    retention: projectRetention(null, "test"),
    consentPolicyId: undecided.value.policy.id,
  });
  assert.ok(!undecidedRecord.ok);
  assert.equal(undecidedRecord.error.code, "YOU_CONSENT_REQUIRED");
  assert.equal(undecidedRecord.error.details.reason, "consent-required");

  // denied / withdrawn / expired policies all block sensitive capture
  for (const terminal of ["denied", "withdrawn", "expired"] as const) {
    const svc = makeService();
    openGrantedSession(svc);
    const policy = svc.registerConsentPolicy(SOLUTION, {
      purposes: ["solution-generation"],
      scope: "USER",
      operationalUse: true,
      learningReuse: false,
      retention: projectRetention(null, "test"),
      revocable: true,
    });
    assert.ok(policy.ok);
    if (terminal === "denied") {
      assert.ok(svc.denyConsent(SOLUTION, policy.value.policy.id).ok);
    } else {
      assert.ok(svc.grantConsent(SOLUTION, policy.value.policy.id).ok);
      const ended =
        terminal === "withdrawn"
          ? svc.withdrawConsent(SOLUTION, policy.value.policy.id)
          : svc.expireConsent(SOLUTION, policy.value.policy.id);
      assert.ok(ended.ok);
    }
    const attempt = svc.recordEvidence(SOLUTION, {
      evidenceRequestId: null,
      captureSessionId: null,
      evidenceType: "fixture",
      modality: "image",
      privacyClass: "medical",
      retention: projectRetention(null, "test"),
      consentPolicyId: policy.value.policy.id,
    });
    assert.ok(!attempt.ok, terminal);
    assert.equal(attempt.error.code, "YOU_CONSENT_REQUIRED", terminal);
    assert.equal(attempt.error.details.reason, `consent-${terminal}`, terminal);
  }

  // granted but purpose not covered -> denied
  const svc2 = makeService();
  const notCovered = svc2.registerConsentPolicy(SOLUTION, {
    purposes: ["export"],
    scope: "USER",
    operationalUse: true,
    learningReuse: false,
    retention: projectRetention(null, "test"),
    revocable: true,
  });
  assert.ok(notCovered.ok);
  svc2.grantConsent(SOLUTION, notCovered.value.policy.id);
  const notCoveredRecord = svc2.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "image",
    privacyClass: "sensitive-media",
    retention: projectRetention(null, "test"),
    consentPolicyId: notCovered.value.policy.id,
  });
  assert.ok(!notCoveredRecord.ok);
  assert.equal(notCoveredRecord.error.details.reason, "purpose-not-covered");

  // credential-class material is refused outright
  const credential = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "document",
    privacyClass: "credential",
    retention: projectRetention(null, "test"),
    consentPolicyId: session.policyId,
  });
  assert.ok(!credential.ok);
  assert.equal(credential.error.code, "YOU_INVALID_STATE");
  assert.equal(credential.error.details.reason, "privacy-class-not-processable");

  // non-sensitive evidence without any instrument is allowed
  const publicMeta = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "document",
    privacyClass: "public-metadata",
    retention: projectRetention(null, "test"),
    consentPolicyId: null,
  });
  assert.ok(publicMeta.ok);
});

test("checkProcessing reflects the live consent state for a record", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const record = recordFromSession(service, session);
  const allowed = service.checkProcessing(SOLUTION, record.id, "solution-generation");
  assert.ok(allowed.ok);
  assert.deepEqual(allowed.value.outcome, { allowed: true, reason: "consent-active" });
  const otherPurpose = service.checkProcessing(SOLUTION, record.id, "arena-escalation");
  assert.ok(otherPurpose.ok);
  assert.equal(otherPurpose.value.outcome.reason, "purpose-not-covered");
  const unknown = service.checkProcessing(SOLUTION, "missing", "solution-generation");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_EVIDENCE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// 4. Withdrawal semantics
// ---------------------------------------------------------------------------

test("withdrawal blocks future processing; derived records keep provenance", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const record = recordFromSession(service, session);
  const review = service.reviewEvidence(SOLUTION, record.id, {
    reviewerType: "user",
    outcome: "accepted",
    notes: "pre-withdrawal review",
  });
  assert.ok(review.ok);

  const withdrawn = service.withdrawConsent(SOLUTION, session.policyId);
  assert.ok(withdrawn.ok);
  assert.equal(withdrawn.value.reference.state, "withdrawn");
  assert.equal(service.consentStateOf(SOLUTION, session.policyId), "withdrawn");

  // Future processing is blocked (server-enforced, current state wins).
  const processing = service.checkProcessing(SOLUTION, record.id, "solution-generation");
  assert.ok(processing.ok);
  assert.deepEqual(processing.value.outcome, { allowed: false, reason: "consent-withdrawn" });
  const learning = service.checkLearning(SOLUTION, record.id);
  assert.ok(learning.ok);
  assert.equal(learning.value.reason, "consent-withdrawn");

  // Previously derived immutable records keep their provenance: the record
  // (with its consent snapshot taken at capture time) and the review stay.
  const recordAfter = service.evidenceRecordOf(SOLUTION, record.id);
  assert.ok(recordAfter.ok);
  assert.equal(recordAfter.value.consent.state, "granted");
  assert.equal(recordAfter.value.consent.policyId, session.policyId);
  assert.equal(service.reviewsOfEvidence(SOLUTION, record.id).length, 1);

  // New capture under the withdrawn instrument is refused.
  const retry = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: null,
    evidenceType: "fixture",
    modality: "image",
    privacyClass: "sensitive-media",
    retention: projectRetention(null, "test"),
    consentPolicyId: session.policyId,
  });
  assert.ok(!retry.ok);
  assert.equal(retry.error.code, "YOU_CONSENT_REQUIRED");
  assert.equal(retry.error.details.reason, "consent-withdrawn");

  // Withdrawal is terminal for the policy id; re-grant must be refused.
  const regrant = service.grantConsent(SOLUTION, session.policyId);
  assert.ok(!regrant.ok);
  assert.equal(regrant.error.code, "YOU_INVALID_STATE");
});

// ---------------------------------------------------------------------------
// 5. Capture flow state machine
// ---------------------------------------------------------------------------

test("capture flow: open -> consent-pending -> active -> completed with events", () => {
  const service = makeService();
  const opened = service.openCaptureSession(SOLUTION, {
    evidenceRequest: null,
    scope: "USER",
    consent: { ...CAPTURE_CONSENT },
    guideSpec: { targetDeficiency: "geometry", preferredFraming: "framing", requiredModalities: ["image"] },
  });
  assert.ok(opened.ok);
  const sessionId = opened.value.session.id;
  const policyId = opened.value.consentPolicyId;
  assert.equal(opened.value.session.status, "consent-pending");
  assert.equal(opened.value.session.guideSteps.length, 1);
  assert.equal(service.consentStateOf(SOLUTION, policyId), "unknown");

  const granted = service.grantConsent(SOLUTION, policyId);
  assert.ok(granted.ok);
  assert.equal(granted.value.sessionBound, true);
  const active = service.captureSessionOf(SOLUTION, sessionId);
  assert.ok(active.ok);
  assert.equal(active.value.status, "active");

  const completed = service.completeCaptureSession(SOLUTION, sessionId);
  assert.ok(completed.ok);
  assert.equal(completed.value.session.status, "completed");
  assert.ok(completed.value.session.completedAt !== null);
});

test("capture flow: illegal transitions are typed YOU_INVALID_STATE errors", () => {
  const service = makeService();
  // completing a consent-pending session is illegal
  const opened = service.openCaptureSession(SOLUTION, {
    evidenceRequest: null,
    scope: "USER",
    consent: { ...CAPTURE_CONSENT },
  });
  assert.ok(opened.ok);
  const pendingId = opened.value.session.id;
  const earlyComplete = service.completeCaptureSession(SOLUTION, pendingId);
  assert.ok(!earlyComplete.ok);
  assert.equal(earlyComplete.error.code, "YOU_INVALID_STATE");
  assert.equal(earlyComplete.error.details.reason, "illegal-session-transition");

  // deny consent -> session declined (terminal); further transitions refused
  const denied = service.denyConsent(SOLUTION, opened.value.consentPolicyId);
  assert.ok(denied.ok);
  assert.equal(denied.value.sessionBound, true);
  const declined = service.captureSessionOf(SOLUTION, pendingId);
  assert.ok(declined.ok);
  assert.equal(declined.value.status, "declined");
  const afterDecline = service.completeCaptureSession(SOLUTION, pendingId);
  assert.ok(!afterDecline.ok);
  assert.equal(afterDecline.error.details.reason, "illegal-session-transition");
  const grantAfterDecline = service.grantConsent(SOLUTION, opened.value.consentPolicyId);
  assert.ok(!grantAfterDecline.ok);

  // expiry from active is legal; completing an expired session is not
  const service2 = makeService();
  const session2 = openGrantedSession(service2);
  const expired = service2.expireCaptureSession(SOLUTION, session2.sessionId);
  assert.ok(expired.ok);
  assert.equal(expired.value.session.status, "expired");
  const completeExpired = service2.completeCaptureSession(SOLUTION, session2.sessionId);
  assert.ok(!completeExpired.ok);

  // completing twice is illegal
  const service3 = makeService();
  const session3 = openGrantedSession(service3);
  assert.ok(service3.completeCaptureSession(SOLUTION, session3.sessionId).ok);
  const twice = service3.completeCaptureSession(SOLUTION, session3.sessionId);
  assert.ok(!twice.ok);
  assert.equal(twice.error.details.reason, "illegal-session-transition");

  // declining an active session is legal
  const service4 = makeService();
  const session4 = openGrantedSession(service4);
  const declinedActive = service4.declineCaptureSession(SOLUTION, session4.sessionId);
  assert.ok(declinedActive.ok);
  assert.equal(declinedActive.value.session.status, "declined");

  // unknown session ids are typed errors
  const unknown = service4.completeCaptureSession(SOLUTION, "no-such-session");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.details.reason, "unknown-capture-session");
});

test("recording into a non-active capture session is refused", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  assert.ok(service.completeCaptureSession(SOLUTION, session.sessionId).ok);
  const late = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: session.sessionId,
    evidenceType: "fixture",
    modality: "image",
    privacyClass: "sensitive-media",
    retention: projectRetention(null, "test"),
    consentPolicyId: session.policyId,
  });
  assert.ok(!late.ok);
  assert.equal(late.error.code, "YOU_INVALID_STATE");
  assert.equal(late.error.details.reason, "capture-session-not-active");
  const ghost = service.recordEvidence(SOLUTION, {
    evidenceRequestId: null,
    captureSessionId: "no-such-session",
    evidenceType: "fixture",
    modality: "image",
    privacyClass: "public-metadata",
    retention: projectRetention(null, "test"),
    consentPolicyId: null,
  });
  assert.ok(!ghost.ok);
  assert.equal(ghost.error.details.reason, "unknown-capture-session");
});

// ---------------------------------------------------------------------------
// 6. Review supersession — never an overwrite
// ---------------------------------------------------------------------------

test("review supersession creates a new record; the old review is never overwritten", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const record = recordFromSession(service, session, { retention: projectRetention("2099-01-01T00:00:00.000Z", "keep") });
  const first = service.reviewEvidence(SOLUTION, record.id, {
    reviewerType: "user",
    outcome: "accepted",
    notes: "first review",
  });
  assert.ok(first.ok);
  const firstId = first.value.review.id;
  const firstSnapshot = stableStringify(first.value.review);

  const superseded = service.reviewEvidence(SOLUTION, record.id, {
    reviewerType: "user",
    outcome: "rejected",
    notes: "re-review changes the outcome",
    supersedesReviewId: firstId,
  });
  assert.ok(superseded.ok);
  assert.notEqual(superseded.value.review.id, firstId);
  assert.equal(superseded.value.review.status, "rejected");

  // The old review keeps its recorded status and content.
  const history = service.reviewsOfEvidence(SOLUTION, record.id);
  assert.equal(history.length, 2);
  assert.equal(history[0]?.status, "accepted");
  assert.equal(history[0]?.notes, "first review");
  assert.equal(stableStringify(history[0]), firstSnapshot);

  // The projection expresses the supersession linkage.
  const projection = service.projectionOf(SOLUTION);
  assert.ok(projection.ok);
  assert.equal(projection.value.supersededBy[firstId], superseded.value.review.id);
  assert.equal(projection.value.currentReviewOfEvidence[record.id], superseded.value.review.id);

  // Superseding a review of other evidence, or a pending review, is refused.
  const other = recordFromSession(service, session, { modality: "video" });
  const crossEvidence = service.reviewEvidence(SOLUTION, other.id, {
    reviewerType: "user",
    outcome: "accepted",
    notes: "bad supersession target",
    supersedesReviewId: firstId,
  });
  assert.ok(!crossEvidence.ok);
  assert.equal(crossEvidence.error.details.reason, "review-evidence-mismatch");

  const pending = service.reviewEvidence(SOLUTION, other.id, {
    reviewerType: "user",
    outcome: "pending",
    notes: "pending review",
  });
  assert.ok(pending.ok);
  const supersedePending = service.reviewEvidence(SOLUTION, other.id, {
    reviewerType: "user",
    outcome: "accepted",
    notes: "cannot supersede pending",
    supersedesReviewId: pending.value.review.id,
  });
  assert.ok(!supersedePending.ok);
  assert.equal(supersedePending.error.details.reason, "pending-review-not-resolvable");
  const resolved = service.resolveEvidenceReview(SOLUTION, other.id, pending.value.review.id, "accepted");
  assert.ok(resolved.ok);
  assert.equal(resolved.value.review.status, "accepted");
});

// ---------------------------------------------------------------------------
// 7. Retention — delete-after-review, session-only, sweep, not-found
// ---------------------------------------------------------------------------

test("delete-after-review: content removed at first resolved review; reads become YOU_RETENTION_EXPIRED", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const record = recordFromSession(service, session, { retention: deleteAfterReviewRetention("test") });
  const before = service.readEvidenceContent(SOLUTION, record.id);
  assert.ok(before.ok);

  const review = service.reviewEvidence(SOLUTION, record.id, {
    reviewerType: "user",
    outcome: "accepted",
    notes: "resolved review",
  });
  assert.ok(review.ok);
  assert.equal(review.value.contentRemovedAfterReview, true);

  const after = service.readEvidenceContent(SOLUTION, record.id);
  assert.ok(!after.ok);
  assert.equal(after.error.code, "YOU_RETENTION_EXPIRED");
  assert.equal(after.error.details.reason, "retention-content-removed");
  // The immutable record itself stays (provenance), only content is gone.
  const recordStillThere = service.evidenceRecordOf(SOLUTION, record.id);
  assert.ok(recordStillThere.ok);
});

test("session-only retention: content is removed when the capture session terminates", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const sessionOnly = recordFromSession(service, session, { retention: sessionOnlyRetention("test") });
  const kept = recordFromSession(service, session, { retention: projectRetention("2099-01-01T00:00:00.000Z", "keep") });

  const completed = service.completeCaptureSession(SOLUTION, session.sessionId);
  assert.ok(completed.ok);
  assert.deepEqual(completed.value.expiredEvidenceIds, [sessionOnly.id]);

  const expiredRead = service.readEvidenceContent(SOLUTION, sessionOnly.id);
  assert.ok(!expiredRead.ok);
  assert.equal(expiredRead.error.code, "YOU_RETENTION_EXPIRED");
  const keptRead = service.readEvidenceContent(SOLUTION, kept.id);
  assert.ok(keptRead.ok);

  // Expiry from active also removes session-only content.
  const service2 = makeService();
  const session2 = openGrantedSession(service2);
  const bound = recordFromSession(service2, session2, { retention: sessionOnlyRetention("test") });
  const expired = service2.expireCaptureSession(SOLUTION, session2.sessionId);
  assert.ok(expired.ok);
  assert.deepEqual(expired.value.expiredEvidenceIds, [bound.id]);
  const read = service2.readEvidenceContent(SOLUTION, bound.id);
  assert.ok(!read.ok);
  assert.equal(read.error.code, "YOU_RETENTION_EXPIRED");
});

test("time-based retention: sweep removes due content; reads are YOU_RETENTION_EXPIRED", () => {
  const service = makeService();
  const session = openGrantedSession(service);
  const due = recordFromSession(service, session, { retention: projectRetention("2026-01-01T00:00:00.000Z", "immediately due") });
  const notDue = recordFromSession(service, session, { retention: tenantRetention("2099-01-01T00:00:00.000Z", "far future") });
  // A read of time-due content is already the typed error (lazy materialization).
  const lazyRead = service.readEvidenceContent(SOLUTION, due.id);
  assert.ok(!lazyRead.ok);
  assert.equal(lazyRead.error.code, "YOU_RETENTION_EXPIRED");
  assert.equal(lazyRead.error.details.reason, "retention-delete-after-due");
  const sweep = service.sweepRetention(SOLUTION);
  assert.ok(sweep.ok);
  assert.deepEqual(sweep.value.expiredEvidenceIds, [due.id]);
  const afterSweep = service.readEvidenceContent(SOLUTION, notDue.id);
  assert.ok(afterSweep.ok);
});

test("unknown evidence ids read as YOU_EVIDENCE_NOT_FOUND (never silent)", () => {
  const service = makeService();
  const read = service.readEvidenceContent(SOLUTION, "no-such-evidence");
  assert.ok(!read.ok);
  assert.equal(read.error.code, "YOU_EVIDENCE_NOT_FOUND");
  const record = service.evidenceRecordOf(SOLUTION, "no-such-evidence");
  assert.ok(!record.ok);
  assert.equal(record.error.code, "YOU_EVIDENCE_NOT_FOUND");
});

// ---------------------------------------------------------------------------
// 8/9. Ledger replay reproduces service state exactly
// ---------------------------------------------------------------------------

test("replaying the evidence ledger reproduces the live projection exactly", () => {
  const service = makeService();
  const opened = service.openCaptureSession(SOLUTION, {
    evidenceRequest: null,
    scope: "USER",
    consent: { ...CAPTURE_CONSENT },
    guideSpec: { targetDeficiency: "identity", preferredFraming: "framing", requiredModalities: ["image", "video"] },
  });
  assert.ok(opened.ok);
  const policyId = opened.value.consentPolicyId;
  assert.ok(service.grantConsent(SOLUTION, policyId).ok);
  const recordA = recordFromSession(service, { sessionId: opened.value.session.id, policyId }, { retention: deleteAfterReviewRetention("test") });
  const recordB = recordFromSession(service, { sessionId: opened.value.session.id, policyId }, { modality: "video", retention: sessionOnlyRetention("test") });
  const learning = service.registerConsentPolicy(SOLUTION, {
    purposes: ["solution-generation", "learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: projectRetention(null, "test"),
    revocable: true,
  });
  assert.ok(learning.ok);
  assert.ok(service.grantConsent(SOLUTION, learning.value.policy.id).ok);
  const recordC = recordFromSession(service, { sessionId: opened.value.session.id, policyId }, {
    modality: "measurement",
    retention: tenantRetention(null, "test"),
    policyId: learning.value.policy.id,
    privacyClass: "project-artifact",
  });
  assert.ok(service.completeCaptureSession(SOLUTION, opened.value.session.id).ok);
  const reviewA = service.reviewEvidence(SOLUTION, recordA.id, { reviewerType: "user", outcome: "accepted", notes: "first" });
  assert.ok(reviewA.ok);
  const reviewB = service.reviewEvidence(SOLUTION, recordA.id, {
    reviewerType: "user",
    outcome: "rejected",
    notes: "supersede",
    supersedesReviewId: reviewA.value.review.id,
  });
  assert.ok(reviewB.ok);
  assert.ok(service.withdrawConsent(SOLUTION, policyId).ok);

  const events = service.ledgerEventsOf(SOLUTION);
  const projection = service.projectionOf(SOLUTION);
  assert.ok(events.ok && projection.ok);
  const replayed = EvidenceService.replay(events.value);
  assert.equal(stableStringify(replayed), stableStringify(projection.value));
  assert.equal(replayed.consents[policyId], "withdrawn");
  assert.equal(replayed.captureSessions[opened.value.session.id], "completed");
  assert.equal(replayed.evidence[recordB.id], "recorded");
  assert.equal(replayed.evidenceRetention[recordB.id], "session-only");
  assert.equal(replayed.evidenceSimulated[recordC.id], true);
  assert.equal(replayed.reviews[reviewA.value.review.id], "accepted");
  assert.equal(replayed.supersededBy[reviewA.value.review.id], reviewB.value.review.id);
  // Append-only: the replayed prefix stays stable after further appends.
  const prefix = stableStringify(events.value);
  assert.ok(service.withdrawConsent(SOLUTION, learning.value.policy.id).ok);
  const eventsAfter = service.ledgerEventsOf(SOLUTION);
  assert.ok(eventsAfter.ok);
  assert.equal(stableStringify(eventsAfter.value.slice(0, events.value.length)), prefix);
});

test("two services with the same seed produce byte-identical evidence content", () => {
  const run = (): { contentHash: string; ledgerHash: string } => {
    const service = makeService();
    const session = openGrantedSession(service);
    const record = recordFromSession(service, session);
    const ledgerHash = service.ledgerHashOf(SOLUTION);
    assert.ok(ledgerHash.ok);
    return { contentHash: record.contentHash, ledgerHash: ledgerHash.value };
  };
  const first = run();
  const second = run();
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.ledgerHash, second.ledgerHash);
});

test("captureSessionOf returns typed errors for unknown sessions", () => {
  const service = makeService();
  const result = service.captureSessionOf(SOLUTION, "no-such-session");
  assert.ok(!result.ok);
  assert.equal(result.error.code, "YOU_INVALID_STATE");
});
