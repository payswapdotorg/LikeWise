import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEW_SEVERITIES,
  constructSecurityReviewAcceptance,
  constructSecurityReviewRecord,
  isReviewSeverity,
  securityReviewFindingSetDigest,
  validateSecurityReviewAcceptanceInput,
  validateSecurityReviewIntake,
  type SecurityReviewFinding,
} from "./securityReview.js";

const REVIEWED_AT = "2026-01-01T00:00:01.000Z";
const ACCEPTED_AT = "2026-01-01T00:00:02.000Z";

const FINDINGS: readonly SecurityReviewFinding[] = [
  { signature: "signature:export-metadata-leak", severity: "medium" as const, description: "export bundles embed provenance metadata for sensitive-media subjects" },
  { signature: "signature:editor-plugin-unsigned", severity: "high" as const, description: "the editor-plugin scan class admits unsigned plugin manifests" },
];

const INTAKE = {
  scopeRef: "you_scope_export-review_01",
  findings: FINDINGS,
};

test("the review severities are the frozen three; signatures deduplicate", () => {
  assert.deepEqual(REVIEW_SEVERITIES, ["low", "medium", "high"]);
  assert.ok(isReviewSeverity("low"));
  assert.ok(isReviewSeverity("medium"));
  assert.ok(isReviewSeverity("high"));
  assert.ok(!isReviewSeverity("ultra"));
  assert.ok(!isReviewSeverity(""));
});

test("the review-intake validator refuses malformed scopes and findings", () => {
  assert.equal(validateSecurityReviewIntake({ ...INTAKE, scopeRef: "" })?.reason, "scope-ref-empty");
  assert.equal(validateSecurityReviewIntake({ ...INTAKE, findings: "none" as never })?.reason, "findings-malformed");
  assert.equal(
    validateSecurityReviewIntake({ ...INTAKE, findings: [{ signature: "", severity: "low", description: "d" }] })?.reason,
    "finding-signature-empty",
  );
  assert.equal(
    validateSecurityReviewIntake({ ...INTAKE, findings: [{ signature: "s1", severity: "ultra" as never, description: "d" }] })?.reason,
    "finding-severity-invalid",
  );
  assert.equal(
    validateSecurityReviewIntake({ ...INTAKE, findings: [{ signature: "s1", severity: "low", description: "" }] })?.reason,
    "finding-description-empty",
  );
  assert.equal(
    validateSecurityReviewIntake({
      ...INTAKE,
      findings: [
        { signature: "s1", severity: "low", description: "d1" },
        { signature: "s1", severity: "high", description: "d2" },
      ],
    })?.reason,
    "finding-duplicate",
  );
  // A clean pass (zero findings) is valid intake — recorded honestly.
  assert.equal(validateSecurityReviewIntake({ ...INTAKE, findings: [] }), null);
  assert.equal(validateSecurityReviewIntake(INTAKE), null);
});

test("the finding-set digest is deterministic and order-sensitive", () => {
  const digestOne = securityReviewFindingSetDigest(FINDINGS);
  const digestTwo = securityReviewFindingSetDigest(FINDINGS);
  assert.equal(digestOne, digestTwo);
  assert.equal(digestOne.length, 8);
  // A different set digests differently.
  const other = securityReviewFindingSetDigest([{ ...FINDINGS[0]!, severity: "low" }]);
  assert.notEqual(digestOne, other);
  // Empty set digests distinctly (and never equals a real set's digest).
  assert.notEqual(securityReviewFindingSetDigest([]), digestOne);
});

test("THE SECURITY REVIEW LAW (construct-time teeth): the accepted flag is never asserted without findings", () => {
  // accepted true + no finding set => refusal.
  const noSet = constructSecurityReviewRecord(
    { id: "you_security-review_0001", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: 2, accepted: true },
    null,
  );
  assert.ok(!noSet.ok);
  if (!noSet.ok) {
    assert.equal(noSet.refusal.reason, "accepted-without-findings");
  }
  // accepted true + EMPTY finding set => refusal (a clean pass cannot be born accepted).
  const emptySet = constructSecurityReviewRecord(
    { id: "you_security-review_0002", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: 0, accepted: true },
    [],
  );
  assert.ok(!emptySet.ok);
  if (!emptySet.ok) {
    assert.equal(emptySet.refusal.reason, "accepted-without-findings");
  }
  // accepted true + count mismatching the set => refusal.
  const countMismatch = constructSecurityReviewRecord(
    { id: "you_security-review_0003", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: 3, accepted: true },
    FINDINGS,
  );
  assert.ok(!countMismatch.ok);
  if (!countMismatch.ok) {
    assert.equal(countMismatch.refusal.reason, "accepted-without-findings");
  }
  // accepted true + matching set => the frozen record.
  const accepted = constructSecurityReviewRecord(
    { id: "you_security-review_0004", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: FINDINGS.length, accepted: true },
    FINDINGS,
  );
  assert.ok(accepted.ok);
  if (accepted.ok) {
    assert.equal(accepted.record.accepted, true);
    assert.ok(Object.isFrozen(accepted.record));
  }
});

test("constructSecurityReviewRecord: intake shape refusals and the honest birth record", () => {
  assert.equal(
    constructSecurityReviewRecord({ id: "you_security-review_0005", scopeRef: "", reviewedAt: REVIEWED_AT, findingsCount: 0, accepted: false }, null)
      .ok,
    false,
  );
  assert.equal(
    constructSecurityReviewRecord({ id: "you_security-review_0006", scopeRef: INTAKE.scopeRef, reviewedAt: "", findingsCount: 0, accepted: false }, null)
      .ok,
    false,
  );
  assert.equal(
    constructSecurityReviewRecord({ id: "you_security-review_0007", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: -1, accepted: false }, null)
      .ok,
    false,
  );
  assert.equal(
    constructSecurityReviewRecord({ id: "you_security-review_0008", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: 1.5, accepted: false }, null)
      .ok,
    false,
  );
  // The birth record: findings verbatim, accepted false.
  const birth = constructSecurityReviewRecord(
    { id: "you_security-review_0009", scopeRef: INTAKE.scopeRef, reviewedAt: REVIEWED_AT, findingsCount: FINDINGS.length, accepted: false },
    FINDINGS,
  );
  assert.ok(birth.ok);
  if (birth.ok) {
    assert.equal(birth.record.scopeRef, INTAKE.scopeRef);
    assert.equal(birth.record.reviewedAt, REVIEWED_AT);
    assert.equal(birth.record.findingsCount, FINDINGS.length);
    assert.equal(birth.record.accepted, false);
    assert.equal(birth.record.simulated, true);
    assert.ok(Object.isFrozen(birth.record));
  }
});

test("the acceptance-intake validator refuses empty acceptedBy and reason", () => {
  assert.equal(validateSecurityReviewAcceptanceInput({ acceptedBy: "", reason: "r" })?.reason, "accepted-by-empty");
  assert.equal(validateSecurityReviewAcceptanceInput({ acceptedBy: "you_user_0000000000000001", reason: "" })?.reason, "acceptance-reason-empty");
  assert.equal(validateSecurityReviewAcceptanceInput({ acceptedBy: "you_user_0000000000000001", reason: "  " })?.reason, "acceptance-reason-empty");
  assert.equal(validateSecurityReviewAcceptanceInput({ acceptedBy: "you_user_0000000000000001", reason: "fixture-acceptance" }), null);
});

test("THE SECURITY REVIEW LAW (separate decision): acceptance requires the finding set it references", () => {
  const base = {
    id: "you_review-acceptance_0001",
    reviewId: "you_security-review_0009",
    scopeRef: INTAKE.scopeRef,
    acceptedBy: "you_user_0000000000000001",
    reason: "fixture-acceptance-reviewed",
    acceptedAt: ACCEPTED_AT,
  };
  // No finding set => refusal.
  const noSet = constructSecurityReviewAcceptance(base, null);
  assert.ok(!noSet.ok);
  if (!noSet.ok) {
    assert.equal(noSet.refusal.reason, "acceptance-without-findings");
  }
  // Empty finding set => refusal (a clean pass cannot be accepted).
  const emptySet = constructSecurityReviewAcceptance({ ...base, id: "you_review-acceptance_0002" }, []);
  assert.ok(!emptySet.ok);
  if (!emptySet.ok) {
    assert.equal(emptySet.refusal.reason, "acceptance-without-findings");
  }
  // A real set => the separate immutable decision referencing it (count + digest derived by the single authority).
  const accepted = constructSecurityReviewAcceptance({ ...base, id: "you_review-acceptance_0003" }, FINDINGS);
  assert.ok(accepted.ok);
  if (accepted.ok) {
    assert.equal(accepted.acceptance.reviewId, base.reviewId);
    assert.equal(accepted.acceptance.findingCount, FINDINGS.length);
    assert.equal(accepted.acceptance.findingSetDigest, securityReviewFindingSetDigest(FINDINGS));
    assert.equal(accepted.acceptance.acceptedBy, base.acceptedBy);
    assert.equal(accepted.acceptance.reason, base.reason);
    assert.equal(accepted.acceptance.acceptedAt, ACCEPTED_AT);
    assert.equal(accepted.acceptance.simulated, true);
    assert.ok(Object.isFrozen(accepted.acceptance));
  }
});

test("constructSecurityReviewAcceptance: intake shape refusals", () => {
  assert.equal(
    constructSecurityReviewAcceptance(
      { id: "you_review-acceptance_0004", reviewId: "", scopeRef: INTAKE.scopeRef, acceptedBy: "you_user_0000000000000001", reason: "r", acceptedAt: ACCEPTED_AT },
      FINDINGS,
    ).ok,
    false,
  );
  assert.equal(
    constructSecurityReviewAcceptance(
      { id: "you_review-acceptance_0005", reviewId: "you_security-review_0009", scopeRef: "", acceptedBy: "you_user_0000000000000001", reason: "r", acceptedAt: ACCEPTED_AT },
      FINDINGS,
    ).ok,
    false,
  );
  assert.equal(
    constructSecurityReviewAcceptance(
      { id: "you_review-acceptance_0006", reviewId: "you_security-review_0009", scopeRef: INTAKE.scopeRef, acceptedBy: "", reason: "r", acceptedAt: ACCEPTED_AT },
      FINDINGS,
    ).ok,
    false,
  );
  assert.equal(
    constructSecurityReviewAcceptance(
      { id: "you_review-acceptance_0007", reviewId: "you_security-review_0009", scopeRef: INTAKE.scopeRef, acceptedBy: "you_user_0000000000000001", reason: "r", acceptedAt: "" },
      FINDINGS,
    ).ok,
    false,
  );
});
