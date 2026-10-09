import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRecord } from "./contract.js";
import { createConsentReference } from "./feedback.js";
import {
  deleteAfterReviewRetention,
  expiresAfterReview,
  expiresWithCaptureSession,
  isRetentionDue,
  projectRetention,
  retentionReadOutcome,
  sessionOnlyRetention,
  tenantRetention,
} from "./evidenceRetention.js";
import { createEvidenceRecord } from "./evidenceRecord.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";

const NOW = "2026-01-01T00:10:00.000Z";

function recordWith(retention: EvidenceRecord["retention"], captureSessionId: string | null): EvidenceRecord {
  return createEvidenceRecord(
    {
      evidenceRequestId: null,
      captureSessionId,
      evidenceType: "fixture",
      modality: "image",
      contentRef: "you_content_0000000000000000",
      contentHash: "0".repeat(64),
      privacyClass: "project-artifact",
      retention,
      consent: createConsentReference("unknown", false),
      provenanceSource: "test",
      simulated: true,
    },
    { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(5)) },
  );
}

test("retention builders produce the frozen policy shapes", () => {
  assert.deepEqual(sessionOnlyRetention("session reason"), { policy: "session-only", deleteAfter: null, reason: "session reason" });
  assert.deepEqual(deleteAfterReviewRetention("review reason"), { policy: "delete-after-review", deleteAfter: null, reason: "review reason" });
  assert.deepEqual(projectRetention("2030-01-01T00:00:00.000Z", "project reason"), {
    policy: "project-retention",
    deleteAfter: "2030-01-01T00:00:00.000Z",
    reason: "project reason",
  });
  assert.deepEqual(tenantRetention(null, "tenant reason"), { policy: "tenant-retention", deleteAfter: null, reason: "tenant reason" });
});

test("isRetentionDue: ISO-8601 comparison, inclusive boundary, null never due", () => {
  assert.equal(isRetentionDue(projectRetention("2026-01-01T00:10:00.000Z", "r"), NOW), true);
  assert.equal(isRetentionDue(projectRetention("2026-01-01T00:09:59.999Z", "r"), NOW), true);
  assert.equal(isRetentionDue(projectRetention("2026-01-01T00:10:00.001Z", "r"), NOW), false);
  assert.equal(isRetentionDue(projectRetention(null, "r"), NOW), false);
  assert.equal(isRetentionDue(sessionOnlyRetention("r"), NOW), false);
  assert.equal(isRetentionDue(deleteAfterReviewRetention("r"), NOW), false);
});

test("session-only expiry binds to the capture session; unbound session-only expires after review", () => {
  const sessionOnly = sessionOnlyRetention("r");
  assert.equal(expiresWithCaptureSession(recordWith(sessionOnly, "you_capture-session_0001")), true);
  assert.equal(expiresWithCaptureSession(recordWith(sessionOnly, null)), false);
  assert.equal(expiresWithCaptureSession(recordWith(deleteAfterReviewRetention("r"), "you_capture-session_0001")), false);
  assert.equal(expiresWithCaptureSession(recordWith(projectRetention(null, "r"), "you_capture-session_0001")), false);

  assert.equal(expiresAfterReview(recordWith(deleteAfterReviewRetention("r"), null)), true);
  assert.equal(expiresAfterReview(recordWith(deleteAfterReviewRetention("r"), "you_capture-session_0001")), true);
  assert.equal(expiresAfterReview(recordWith(sessionOnly, null)), true);
  assert.equal(expiresAfterReview(recordWith(sessionOnly, "you_capture-session_0001")), false);
  assert.equal(expiresAfterReview(recordWith(projectRetention(null, "r"), null)), false);
  assert.equal(expiresAfterReview(recordWith(tenantRetention(null, "r"), null)), false);
});

test("retentionReadOutcome: time-expired, removed and readable outcomes", () => {
  // Time-based policies read as expired once deleteAfter is due, regardless of store state.
  assert.equal(retentionReadOutcome(recordWith(projectRetention("2026-01-01T00:00:00.000Z", "r"), null), NOW, true), "time-expired");
  assert.equal(retentionReadOutcome(recordWith(tenantRetention("2026-01-01T00:00:00.000Z", "r"), null), NOW, true), "time-expired");
  assert.equal(retentionReadOutcome(recordWith(projectRetention("2099-01-01T00:00:00.000Z", "r"), null), NOW, true), "readable");
  // Removal-based policies read as expired only once the content is actually gone.
  assert.equal(retentionReadOutcome(recordWith(sessionOnlyRetention("r"), "you_capture-session_0001"), NOW, false), "removed");
  assert.equal(retentionReadOutcome(recordWith(deleteAfterReviewRetention("r"), null), NOW, false), "removed");
  assert.equal(retentionReadOutcome(recordWith(deleteAfterReviewRetention("r"), null), NOW, true), "readable");
  // A store miss on a time-based policy still reports time-expired first.
  assert.equal(retentionReadOutcome(recordWith(projectRetention("2026-01-01T00:00:00.000Z", "r"), null), NOW, false), "time-expired");
});
