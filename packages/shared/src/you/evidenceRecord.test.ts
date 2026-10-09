import assert from "node:assert/strict";
import test from "node:test";
import { createConsentReference } from "./feedback.js";
import { FIXTURE_DEFICIENCY_CLASSES } from "./fixture.js";
import {
  createEvidenceRecord,
  createEvidenceReview,
  fixtureQualityObservations,
  isLegalEvidenceReviewTransition,
  supersedeEvidenceReview,
  transitionEvidenceReview,
} from "./evidenceRecord.js";
import { deleteAfterReviewRetention } from "./evidenceRetention.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";

function makeDeps() {
  return { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(77)) };
}

function makeRecordDeps() {
  return makeDeps();
}

const INTAKE = {
  evidenceRequestId: "you_evidence_request01",
  captureSessionId: "you_capture-session_0001",
  evidenceType: "reference-image" as const,
  modality: "image" as const,
  contentRef: "you_content_abcdef0123456789",
  contentHash: "a".repeat(64),
  privacyClass: "sensitive-media" as const,
  retention: deleteAfterReviewRetention("test"),
  consent: createConsentReference("granted", false),
  provenanceSource: "test:evidence",
  simulated: true,
};

test("createEvidenceRecord builds an immutable, hash-bound record", () => {
  const deps = makeRecordDeps();
  const record = createEvidenceRecord(INTAKE, deps);
  assert.match(record.id, /^you_evidence_[0-9a-f]{16}$/);
  assert.equal(record.capturedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(record.contentRef, INTAKE.contentRef);
  assert.equal(record.contentHash, "a".repeat(64));
  assert.equal(record.privacyClass, "sensitive-media");
  assert.equal(record.simulated, true);
  assert.equal(record.provenance.generator, "fixture");
  assert.equal(record.provenance.source, "test:evidence");
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.retention));
  assert.ok(Object.isFrozen(record.consent));
  assert.throws(() => {
    (record as unknown as { privacyClass: string }).privacyClass = "public-metadata";
  }, TypeError);
  assert.throws(() => createEvidenceRecord({ ...INTAKE, contentHash: "" }, deps), /contentHash/);
});

test("createEvidenceReview builds an immutable review with deterministic observations", () => {
  const deps = makeDeps();
  const review = createEvidenceReview(
    {
      evidenceId: "you_evidence_0001",
      reviewerType: "user",
      status: "accepted",
      qualityObservations: { geometry: 0.5, identity: 0.75 },
      notes: "looks deterministic",
    },
    deps,
  );
  assert.match(review.id, /^you_evidence-review_[0-9a-f]{16}$/);
  assert.equal(review.status, "accepted");
  assert.equal(review.reviewedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(review.qualityObservations, { geometry: 0.5, identity: 0.75 });
  assert.ok(Object.isFrozen(review));
  assert.ok(Object.isFrozen(review.qualityObservations));
  assert.throws(() => createEvidenceReview({ evidenceId: "", reviewerType: "user", status: "accepted", qualityObservations: {}, notes: "" }, deps), /evidenceId/);
});

test("review transitions: pending -> accepted/rejected only", () => {
  const deps = makeDeps();
  const pending = createEvidenceReview(
    { evidenceId: "you_evidence_0001", reviewerType: "agent", status: "pending", qualityObservations: {}, notes: "" },
    deps,
  );
  assert.equal(isLegalEvidenceReviewTransition("pending", "accepted"), true);
  assert.equal(isLegalEvidenceReviewTransition("pending", "rejected"), true);
  assert.equal(isLegalEvidenceReviewTransition("pending", "superseded"), false);
  assert.equal(isLegalEvidenceReviewTransition("accepted", "rejected"), false);
  assert.equal(isLegalEvidenceReviewTransition("rejected", "accepted"), false);
  assert.equal(isLegalEvidenceReviewTransition("superseded", "accepted"), false);
  const accepted = transitionEvidenceReview(pending, "accepted");
  assert.equal(accepted.status, "accepted");
  assert.notEqual(accepted, pending);
  assert.equal(pending.status, "pending");
  assert.throws(() => transitionEvidenceReview(accepted, "rejected"), /illegal evidence review transition/);
});

test("supersession creates a new record and never touches the old one", () => {
  const deps = makeDeps();
  const first = createEvidenceReview(
    { evidenceId: "you_evidence_0001", reviewerType: "user", status: "accepted", qualityObservations: { geometry: 0.4 }, notes: "first" },
    deps,
  );
  const supersession = supersedeEvidenceReview(
    first,
    { reviewerType: "user", status: "rejected", qualityObservations: { geometry: 0.2 }, notes: "re-review" },
    deps,
  );
  assert.equal(supersession.supersededReviewId, first.id);
  assert.notEqual(supersession.replacement.id, first.id);
  assert.equal(supersession.replacement.evidenceId, first.evidenceId);
  assert.equal(supersession.replacement.status, "rejected");
  // The old record keeps its status untouched.
  assert.equal(first.status, "accepted");
  assert.equal(first.notes, "first");
  // A pending review cannot be superseded directly.
  const pending = createEvidenceReview(
    { evidenceId: "you_evidence_0001", reviewerType: "user", status: "pending", qualityObservations: {}, notes: "" },
    deps,
  );
  assert.throws(
    () => supersedeEvidenceReview(pending, { reviewerType: "user", status: "accepted", qualityObservations: {}, notes: "" }, deps),
    /pending review must be resolved/,
  );
});

test("fixtureQualityObservations is deterministic and bounded; golden edge values", () => {
  const zeros = "0".repeat(64);
  const ones = "f".repeat(64);
  // Golden edges: all-zero hash words -> score 0; all-f hash word -> 1 after rounding.
  assert.deepEqual(fixtureQualityObservations(zeros, FIXTURE_DEFICIENCY_CLASSES), {
    appearance: 0,
    composition: 0,
    geometry: 0,
    identity: 0,
    "motion-naturalness": 0,
  });
  assert.equal(fixtureQualityObservations(ones, ["identity"])[`identity`], 1);
  // Determinism + class sortedness + bounds.
  const hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const first = fixtureQualityObservations(hash, FIXTURE_DEFICIENCY_CLASSES);
  const second = fixtureQualityObservations(hash, [...FIXTURE_DEFICIENCY_CLASSES].reverse());
  assert.deepEqual(first, second);
  for (const score of Object.values(first)) {
    assert.ok(score >= 0 && score <= 1);
    assert.equal(score, Math.round(score * 10000) / 10000);
  }
  // Different hash -> different observation vector (statistically certain for this pair).
  const other = fixtureQualityObservations("ffffffffffffffff0000000000000000ffffffffffffffff0000000000000000", FIXTURE_DEFICIENCY_CLASSES);
  assert.notDeepEqual(first, other);
});

test("fixtureQualityObservations parses distinct hash windows per class index", () => {
  // 64-char hash: window[0..8)=zeros, window[8..16)=all-f, window[16..24)=zeros.
  const hash = `00000000ffffffff${"0".repeat(48)}`;
  const observations = fixtureQualityObservations(hash, ["a", "b", "c"]);
  // Class "a" (index 0) reads the all-zero window; "b" (index 1) reads the all-f window.
  assert.equal(observations.a, 0);
  assert.equal(observations.b, 1);
  // Class "c" (index 2) reads the following zero window.
  assert.equal(observations.c, 0);
});
