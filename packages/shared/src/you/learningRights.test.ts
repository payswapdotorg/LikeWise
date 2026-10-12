import assert from "node:assert/strict";
import test from "node:test";
import type { LearningRights } from "./contract.js";
import type { LearningGrantFacts } from "./learningRights.js";
import {
  createLearningRights,
  evaluateLearningRights,
  grantHashMatches,
  INERT_LEARNING_RIGHTS,
  isInertLearningRights,
  isLearningRightUsage,
  learningGrantHash,
  LEARNING_RIGHT_USAGES,
  validateLearningRightsIntake,
} from "./learningRights.js";

const NOW = "2026-01-01T00:00:00.000Z";

function boundRights(overrides: Partial<LearningRights> = {}): LearningRights {
  return {
    usage: ["personalization", "tool-selection"],
    consentRef: "you_consent-policy_0000000000000001",
    consentHash: "a".repeat(64),
    expiresAt: null,
    ...overrides,
  };
}

function grantedFacts(overrides: Partial<LearningGrantFacts> = {}): LearningGrantFacts {
  return {
    policyId: "you_consent-policy_0000000000000001",
    state: "granted",
    scope: "USER",
    purposes: ["learning", "solution-generation"],
    learningReuse: true,
    operationalUse: true,
    ...overrides,
  };
}

test("the six sanctioned usage classes are enumerated exactly once each", () => {
  assert.deepEqual(LEARNING_RIGHT_USAGES, [
    "organization-improvement",
    "tool-selection",
    "editor-selection",
    "pipeline-improvement",
    "capability-gap-analysis",
    "personalization",
  ]);
  for (const usage of LEARNING_RIGHT_USAGES) {
    assert.equal(isLearningRightUsage(usage), true);
  }
  assert.equal(isLearningRightUsage("mind-reading"), false);
  assert.equal(isLearningRightUsage(""), false);
});

test("the inert grant is the ONLY no-rights pairing: empty ref + empty hash + no usage", () => {
  assert.deepEqual(INERT_LEARNING_RIGHTS, { usage: [], consentRef: "", consentHash: "", expiresAt: null });
  assert.ok(Object.isFrozen(INERT_LEARNING_RIGHTS));
  assert.ok(Object.isFrozen(INERT_LEARNING_RIGHTS.usage));
  assert.equal(isInertLearningRights(INERT_LEARNING_RIGHTS), true);
  assert.equal(isInertLearningRights(boundRights()), false);
  // A half-bound grant is NOT inert — it is structurally invalid.
  assert.equal(isInertLearningRights(boundRights({ consentHash: "" })), false);
});

test("stateless intake validation: sanctioned + unique usage classes only", () => {
  assert.deepEqual(validateLearningRightsIntake(boundRights()), { ok: true });
  assert.deepEqual(validateLearningRightsIntake(INERT_LEARNING_RIGHTS), { ok: true });

  const badClass = validateLearningRightsIntake(boundRights({ usage: ["telekinesis" as unknown as "personalization"] }));
  assert.ok(!badClass.ok);
  assert.equal(badClass.code, "invalid-usage-list");

  const duplicate = validateLearningRightsIntake(boundRights({ usage: ["tool-selection", "tool-selection"] }));
  assert.ok(!duplicate.ok);
  assert.equal(duplicate.code, "invalid-usage-list");
});

test("stateless intake validation: consentRef and consentHash are paired, never one without the other", () => {
  const missingHash = validateLearningRightsIntake(boundRights({ consentHash: "" }));
  assert.ok(!missingHash.ok);
  assert.equal(missingHash.code, "invalid-consent-binding");

  const missingRef = validateLearningRightsIntake(boundRights({ consentRef: "" }));
  assert.ok(!missingRef.ok);
  assert.equal(missingRef.code, "invalid-consent-binding");

  const boundButEmpty = validateLearningRightsIntake(boundRights({ usage: [] }));
  assert.ok(!boundButEmpty.ok);
  assert.equal(boundButEmpty.code, "invalid-consent-binding");
});

test("stateless intake validation: expiresAt is null or a non-empty string", () => {
  const bad = validateLearningRightsIntake(boundRights({ expiresAt: "" }));
  assert.ok(!bad.ok);
  assert.equal(bad.code, "invalid-expiry");
  assert.deepEqual(validateLearningRightsIntake(boundRights({ expiresAt: "2099-01-01T00:00:00.000Z" })), { ok: true });
});

test("createLearningRights builds an immutable grant", () => {
  const created = createLearningRights(boundRights());
  assert.ok(created.ok);
  assert.ok(Object.isFrozen(created.rights));
  assert.ok(Object.isFrozen(created.rights.usage));
  assert.deepEqual(created.rights.usage, ["personalization", "tool-selection"]);
  assert.throws(() => {
    (created.rights as { consentRef: string }).consentRef = "x";
  }, TypeError);
});

test("learningGrantHash is content-addressed: stable for equal facts, different for changed facts", () => {
  const facts = grantedFacts();
  const hash = learningGrantHash(facts);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(learningGrantHash(grantedFacts()), hash);
  // Purpose order does not matter (canonical sorted serialization).
  assert.equal(learningGrantHash(grantedFacts({ purposes: ["solution-generation", "learning"] })), hash);
  // Any fact change re-addresses the grant.
  assert.notEqual(learningGrantHash(grantedFacts({ state: "withdrawn" })), hash);
  assert.notEqual(learningGrantHash(grantedFacts({ learningReuse: false })), hash);
  assert.notEqual(learningGrantHash(grantedFacts({ policyId: "you_consent-policy_0000000000000002" })), hash);
  assert.notEqual(learningGrantHash(grantedFacts({ scope: "TENANT" })), hash);
  assert.notEqual(learningGrantHash(grantedFacts({ purposes: ["learning"] })), hash);
  assert.notEqual(learningGrantHash(grantedFacts({ operationalUse: false })), hash);
});

test("grantHashMatches binds rights to the exact live grant facts", () => {
  const facts = grantedFacts();
  const rights = boundRights({ consentHash: learningGrantHash(facts) });
  assert.equal(grantHashMatches(rights, facts), true);
  assert.equal(grantHashMatches(rights, grantedFacts({ learningReuse: false })), false);
});

test("rights enforcement matrix: the inert grant always denies (records without rights are inert)", () => {
  const outcome = evaluateLearningRights(INERT_LEARNING_RIGHTS, "tool-selection", grantedFacts(), NOW);
  assert.deepEqual(outcome, { allowed: false, reason: "rights-inert" });
  // Inert denies even without any live grant.
  assert.deepEqual(evaluateLearningRights(INERT_LEARNING_RIGHTS, "personalization", null, NOW), {
    allowed: false,
    reason: "rights-inert",
  });
});

test("rights enforcement matrix: usage outside the grant denies with usage-not-granted", () => {
  const rights = boundRights({ consentHash: learningGrantHash(grantedFacts()) });
  const outcome = evaluateLearningRights(rights, "pipeline-improvement", grantedFacts(), NOW);
  assert.deepEqual(outcome, { allowed: false, reason: "usage-not-granted" });
});

test("rights enforcement matrix: an unresolvable consent ref denies (fail closed)", () => {
  const rights = boundRights({ consentHash: learningGrantHash(grantedFacts()) });
  assert.deepEqual(evaluateLearningRights(rights, "personalization", null, NOW), {
    allowed: false,
    reason: "consent-unresolvable",
  });
});

test("rights enforcement matrix: a non-granted live state denies with consent-<state>", () => {
  const rights = boundRights({ consentHash: learningGrantHash(grantedFacts()) });
  for (const state of ["unknown", "denied", "withdrawn", "expired"] as const) {
    const outcome = evaluateLearningRights(rights, "personalization", grantedFacts({ state }), NOW);
    assert.deepEqual(outcome, { allowed: false, reason: `consent-${state}` });
  }
});

test("rights enforcement matrix: learning reuse must be permitted and the learning purpose covered", () => {
  const rights = boundRights({ consentHash: learningGrantHash(grantedFacts()) });
  assert.deepEqual(evaluateLearningRights(rights, "personalization", grantedFacts({ learningReuse: false }), NOW), {
    allowed: false,
    reason: "learning-reuse-not-permitted",
  });
  assert.deepEqual(evaluateLearningRights(rights, "personalization", grantedFacts({ purposes: ["export"] }), NOW), {
    allowed: false,
    reason: "purpose-not-covered",
  });
});

test("rights enforcement matrix: a changed grant (hash mismatch) denies — the rights bind the issuance facts", () => {
  const rights = boundRights({ consentHash: learningGrantHash(grantedFacts()) });
  // The live policy was re-registered with different purposes under the same id.
  const changed = grantedFacts({ purposes: ["learning", "export", "solution-generation"] });
  assert.deepEqual(evaluateLearningRights(rights, "personalization", changed, NOW), {
    allowed: false,
    reason: "consent-hash-mismatch",
  });
});

test("rights enforcement matrix: an expired grant denies with rights-expired; future expiry allows", () => {
  const rights = boundRights({
    consentHash: learningGrantHash(grantedFacts()),
    expiresAt: "2025-12-31T23:59:59.999Z",
  });
  assert.deepEqual(evaluateLearningRights(rights, "personalization", grantedFacts(), NOW), {
    allowed: false,
    reason: "rights-expired",
  });

  const future = boundRights({
    consentHash: learningGrantHash(grantedFacts()),
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  assert.deepEqual(evaluateLearningRights(future, "personalization", grantedFacts(), NOW), {
    allowed: true,
    reason: "rights-within-grant",
  });
});

test("rights enforcement matrix: the happy path allows exactly the granted usage under the live grant", () => {
  const rights = boundRights({ consentHash: learningGrantHash(grantedFacts()) });
  assert.deepEqual(evaluateLearningRights(rights, "personalization", grantedFacts(), NOW), {
    allowed: true,
    reason: "rights-within-grant",
  });
  assert.deepEqual(evaluateLearningRights(rights, "tool-selection", grantedFacts(), NOW), {
    allowed: true,
    reason: "rights-within-grant",
  });
});
