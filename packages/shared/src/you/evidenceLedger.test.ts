import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent, SolutionEventType } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { SolutionEventLedger } from "./events.js";
import { replayEvidenceLedger } from "./evidenceLedger.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";

type Append = Parameters<SolutionEventLedger["append"]>[0];

function makeLedger(): SolutionEventLedger {
  return new SolutionEventLedger("you_solution_evidence01", {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(31)),
  });
}

function scriptedEvidenceLedger(): readonly SolutionEvent[] {
  const ledger = makeLedger();
  const append = (input: Append): void => {
    ledger.append(input);
  };
  append({
    type: "consent-recorded",
    payload: { policyId: "policy-1", consentState: "unknown", scope: "USER", purposes: "solution-generation", operationalUse: true, learningReuse: false, revocable: true, retentionPolicy: "session-only", simulated: true },
  });
  append({
    type: "capture-session-opened",
    payload: { captureSessionId: "session-1", evidenceRequestId: "request-1", sessionStatusAfter: "requested", scope: "USER", stepCount: 2, consentPolicyId: "policy-1", consentState: "unknown", simulated: true },
  });
  append({
    type: "consent-recorded",
    payload: { policyId: "policy-1", consentState: "unknown", captureSessionId: "session-1", sessionStatusAfter: "consent-pending", simulated: true },
  });
  append({
    type: "consent-recorded",
    payload: { policyId: "policy-1", consentState: "granted", captureSessionId: "session-1", sessionStatusAfter: "active", simulated: true },
  });
  append({
    type: "consent-recorded",
    payload: { policyId: "policy-2", consentState: "granted", purposes: "learning,solution-generation", learningReuse: true, simulated: true },
  });
  append({
    type: "evidence-recorded",
    payload: { evidenceId: "evidence-1", captureSessionId: "session-1", evidenceType: "fixture", modality: "image", privacyClass: "sensitive-media", contentRef: "you_content_aaaa", contentHash: "a".repeat(64), retentionPolicy: "session-only", retentionDeleteAfter: "", consentPolicyId: "policy-1", consentState: "granted", simulated: true },
  });
  append({
    type: "evidence-recorded",
    payload: { evidenceId: "evidence-2", captureSessionId: "session-1", evidenceType: "fixture", modality: "video", privacyClass: "sensitive-media", contentRef: "you_content_bbbb", contentHash: "b".repeat(64), retentionPolicy: "delete-after-review", retentionDeleteAfter: "", consentPolicyId: "policy-1", consentState: "granted", simulated: true },
  });
  append({
    type: "capture-session-completed",
    payload: { captureSessionId: "session-1", sessionStatusAfter: "completed", completedAt: "2026-01-01T00:00:07.000Z", contentRemoved: true, "expiredEvidence.evidence-1": true, simulated: true },
  });
  append({
    type: "evidence-reviewed",
    payload: { reviewId: "review-1", evidenceId: "evidence-2", reviewerType: "user", reviewStatus: "accepted", supersedesReviewId: "", contentRemovedAfterReview: true, "quality.geometry": 0.5, simulated: true },
  });
  append({
    type: "evidence-reviewed",
    payload: { reviewId: "review-2", evidenceId: "evidence-2", reviewerType: "user", reviewStatus: "rejected", supersedesReviewId: "review-1", contentRemovedAfterReview: false, simulated: true },
  });
  append({
    type: "consent-withdrawn",
    payload: { policyId: "policy-1", consentState: "withdrawn", reason: "user-revocation", simulated: true },
  });
  return ledger.events();
}

test("replaying a scripted evidence ledger reproduces the projection exactly", () => {
  const events = scriptedEvidenceLedger();
  const projection = replayEvidenceLedger(events);
  assert.equal(projection.solutionId, "you_solution_evidence01");
  assert.deepEqual(projection.consents, { "policy-1": "withdrawn", "policy-2": "granted" });
  assert.deepEqual(projection.captureSessions, { "session-1": "completed" });
  assert.deepEqual(projection.evidence, { "evidence-1": "recorded", "evidence-2": "recorded" });
  assert.deepEqual(projection.evidenceRetention, { "evidence-1": "session-only", "evidence-2": "delete-after-review" });
  assert.deepEqual(projection.evidenceSimulated, { "evidence-1": true, "evidence-2": true });
  assert.deepEqual(projection.reviews, { "review-1": "accepted", "review-2": "rejected" });
  assert.deepEqual(projection.currentReviewOfEvidence, { "evidence-2": "review-2" });
  assert.deepEqual(projection.supersededBy, { "review-1": "review-2" });
  // Re-serialize -> re-parse -> re-fold is byte-stable.
  const reparsed = JSON.parse(stableStringify(events)) as SolutionEvent[];
  assert.equal(stableStringify(replayEvidenceLedger(reparsed)), stableStringify(projection));
});

test("session status rides on consent events: mid-flight statuses are reproduced", () => {
  const ledger = makeLedger();
  ledger.append({ type: "capture-session-opened", payload: { captureSessionId: "s1", sessionStatusAfter: "requested" } });
  ledger.append({ type: "consent-recorded", payload: { policyId: "p1", consentState: "unknown", captureSessionId: "s1", sessionStatusAfter: "consent-pending" } });
  const midFlight = replayEvidenceLedger(ledger.events());
  assert.deepEqual(midFlight.captureSessions, { s1: "consent-pending" });
  assert.deepEqual(midFlight.consents, { p1: "unknown" });
  ledger.append({ type: "consent-recorded", payload: { policyId: "p1", consentState: "granted", captureSessionId: "s1", sessionStatusAfter: "active" } });
  const active = replayEvidenceLedger(ledger.events());
  assert.deepEqual(active.captureSessions, { s1: "active" });
  assert.deepEqual(active.consents, { p1: "granted" });
  ledger.append({ type: "capture-session-completed", payload: { captureSessionId: "s1", sessionStatusAfter: "declined" } });
  const terminal = replayEvidenceLedger(ledger.events());
  assert.deepEqual(terminal.captureSessions, { s1: "declined" });
});

test("replayEvidenceLedger requires a non-empty event list and ignores foreign events", () => {
  assert.throws(() => replayEvidenceLedger([]));
  const ledger = makeLedger();
  ledger.append({ type: "solution-created", payload: { simulated: true } });
  ledger.append({ type: "version-published", payload: { versionId: "v1" } });
  const projection = replayEvidenceLedger(ledger.events());
  assert.deepEqual(projection.consents, {});
  assert.deepEqual(projection.captureSessions, {});
  assert.deepEqual(projection.evidence, {});
  assert.deepEqual(projection.reviews, {});
});

test("missing payload keys never corrupt the fold (defensive defaults)", () => {
  const ledger = makeLedger();
  ledger.append({ type: "evidence-recorded", payload: { evidenceId: "e1" } });
  ledger.append({ type: "evidence-reviewed", payload: {} });
  const projection = replayEvidenceLedger(ledger.events());
  assert.deepEqual(projection.evidence, { e1: "recorded" });
  assert.equal(projection.evidenceRetention.e1, "");
  assert.equal(projection.evidenceSimulated.e1, true);
  assert.deepEqual(projection.reviews, {});
  assert.deepEqual(projection.currentReviewOfEvidence, {});
  assert.deepEqual(projection.supersededBy, {});
});

test("evidence-plane events pass through the W1A ledger machinery append-only", () => {
  const ledger = makeLedger();
  const first = ledger.append({ type: "consent-recorded", payload: { policyId: "p1", consentState: "unknown" } });
  const second = ledger.append({ type: "evidence-recorded", payload: { evidenceId: "e1" } });
  const events = ledger.events();
  assert.equal(events.length, 2);
  assert.deepEqual(second.provenance.lineage, [first.id]);
  assert.ok(Object.isFrozen(events));
  const evidenceTypes: SolutionEventType[] = ["capture-session-opened", "capture-session-completed", "evidence-recorded", "evidence-reviewed", "consent-recorded", "consent-withdrawn"];
  for (const type of evidenceTypes) {
    ledger.append({ type, payload: {} });
  }
  assert.equal(ledger.events().length, 8);
  assert.equal(ledger.events()[0]?.id, first.id);
});
