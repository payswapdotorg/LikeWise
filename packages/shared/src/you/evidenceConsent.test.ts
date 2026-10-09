import assert from "node:assert/strict";
import test from "node:test";
import type { ConsentPolicy, ConsentState, EvidencePrivacyClass } from "./contract.js";
import {
  canLearn,
  canProcess,
  ConsentRegistry,
  consentReferenceFor,
  createConsentPolicy,
  isLegalConsentTransition,
  isSensitivePrivacyClass,
  SENSITIVE_PRIVACY_CLASSES,
} from "./evidenceConsent.js";
import { projectRetention } from "./evidenceRetention.js";

const BASE_RETENTION = projectRetention(null, "test retention");

function policy(overrides: Partial<Parameters<typeof createConsentPolicy>[1]> = {}): ConsentPolicy {
  return createConsentPolicy("you_consent_policy01", {
    purposes: ["solution-generation", "quality-improvement"],
    scope: "USER",
    operationalUse: true,
    learningReuse: false,
    retention: BASE_RETENTION,
    revocable: true,
    ...overrides,
  });
}

function activeFor(testPolicy: ConsentPolicy, state: ConsentState) {
  return { policy: testPolicy, state };
}

test("sensitive privacy classes are exactly sensitive-media / biometric-evidence / medical", () => {
  assert.deepEqual([...SENSITIVE_PRIVACY_CLASSES], ["sensitive-media", "biometric-evidence", "medical"]);
  assert.equal(isSensitivePrivacyClass("sensitive-media"), true);
  assert.equal(isSensitivePrivacyClass("biometric-evidence"), true);
  assert.equal(isSensitivePrivacyClass("medical"), true);
  assert.equal(isSensitivePrivacyClass("public-metadata"), false);
  assert.equal(isSensitivePrivacyClass("project-artifact"), false);
  assert.equal(isSensitivePrivacyClass("credential"), false);
});

test("GOLDEN consent enforcement matrix: sensitive class x state x purpose", () => {
  const covered = policy({ purposes: ["solution-generation"] });
  const notCovered = policy({ purposes: ["export"] });
  const noOperational = policy({ purposes: ["solution-generation"], operationalUse: false });
  const states: readonly ConsentState[] = ["granted", "denied", "expired", "withdrawn", "unknown"];
  const sensitiveClasses: readonly EvidencePrivacyClass[] = ["sensitive-media", "biometric-evidence", "medical"];
  // Golden table: state -> { allowed, reason } for a purpose-covered policy.
  const golden: Record<ConsentState, { allowed: boolean; reason: string }> = {
    granted: { allowed: true, reason: "consent-active" },
    denied: { allowed: false, reason: "consent-denied" },
    expired: { allowed: false, reason: "consent-expired" },
    withdrawn: { allowed: false, reason: "consent-withdrawn" },
    unknown: { allowed: false, reason: "consent-required" },
  };
  for (const privacyClass of sensitiveClasses) {
    for (const state of states) {
      const expected = golden[state];
      assert.deepEqual(
        canProcess({ privacyClass, purpose: "solution-generation", consent: activeFor(covered, state) }),
        expected,
        `${privacyClass} x ${state}`,
      );
    }
    // granted but purpose not covered / operational use not permitted
    assert.equal(
      canProcess({ privacyClass, purpose: "solution-generation", consent: activeFor(notCovered, "granted") }).reason,
      "purpose-not-covered",
    );
    assert.equal(
      canProcess({ privacyClass, purpose: "solution-generation", consent: activeFor(noOperational, "granted") }).reason,
      "operational-use-not-permitted",
    );
    // no reference at all
    assert.deepEqual(canProcess({ privacyClass, purpose: "solution-generation", consent: null }), {
      allowed: false,
      reason: "consent-required",
    });
    // unregistered policy reference behaves like undecided
    assert.deepEqual(
      canProcess({ privacyClass, purpose: "solution-generation", consent: { policy: null, state: "granted" } }),
      { allowed: false, reason: "consent-required" },
    );
  }
});

test("GOLDEN consent enforcement matrix: non-sensitive classes and credential", () => {
  const covered = policy({ purposes: ["solution-generation"] });
  // No instrument at all: allowed without consent.
  assert.deepEqual(canProcess({ privacyClass: "public-metadata", purpose: "solution-generation", consent: null }), {
    allowed: true,
    reason: "non-sensitive-without-consent",
  });
  // Undecided instrument: allowed (nothing refused yet).
  assert.deepEqual(
    canProcess({ privacyClass: "project-artifact", purpose: "solution-generation", consent: activeFor(covered, "unknown") }),
    { allowed: true, reason: "non-sensitive-consent-undecided" },
  );
  // Explicit refusal/revocation/expiry blocks even non-sensitive classes.
  for (const state of ["denied", "withdrawn", "expired"] as const) {
    assert.deepEqual(
      canProcess({ privacyClass: "public-metadata", purpose: "solution-generation", consent: activeFor(covered, state) }),
      { allowed: false, reason: `consent-${state}` },
    );
  }
  // Granted instrument governs purpose coverage.
  assert.equal(
    canProcess({ privacyClass: "project-artifact", purpose: "export", consent: activeFor(covered, "granted") }).reason,
    "purpose-not-covered",
  );
  // Credential material is never processable.
  for (const state of ["granted", "unknown", "denied"] as const) {
    assert.deepEqual(
      canProcess({ privacyClass: "credential", purpose: "solution-generation", consent: activeFor(covered, state) }),
      { allowed: false, reason: "privacy-class-not-processable" },
    );
  }
  assert.deepEqual(canProcess({ privacyClass: "credential", purpose: "solution-generation", consent: null }), {
    allowed: false,
    reason: "privacy-class-not-processable",
  });
});

test("canLearn golden matrix: requires granted + learningReuse + learning purpose", () => {
  const learner = policy({ purposes: ["learning"], learningReuse: true });
  const noReuse = policy({ purposes: ["learning"], learningReuse: false });
  const noPurpose = policy({ purposes: ["solution-generation"], learningReuse: true });
  assert.deepEqual(canLearn(activeFor(learner, "granted")), { allowed: true, reason: "learning-permitted" });
  for (const state of ["denied", "expired", "withdrawn", "unknown"] as const) {
    assert.deepEqual(canLearn(activeFor(learner, state)), { allowed: false, reason: `consent-${state}` });
  }
  assert.deepEqual(canLearn(activeFor(noReuse, "granted")), { allowed: false, reason: "learning-reuse-not-permitted" });
  assert.deepEqual(canLearn(activeFor(noPurpose, "granted")), { allowed: false, reason: "purpose-not-covered" });
  assert.deepEqual(canLearn(null), { allowed: false, reason: "consent-required" });
  assert.deepEqual(canLearn({ policy: null, state: "granted" }), { allowed: false, reason: "consent-required" });
});

test("consent state machine: only unknown->granted/denied and granted->withdrawn/expired are legal", () => {
  assert.equal(isLegalConsentTransition("unknown", "granted"), true);
  assert.equal(isLegalConsentTransition("unknown", "denied"), true);
  assert.equal(isLegalConsentTransition("granted", "withdrawn"), true);
  assert.equal(isLegalConsentTransition("granted", "expired"), true);
  assert.equal(isLegalConsentTransition("unknown", "withdrawn"), false);
  assert.equal(isLegalConsentTransition("unknown", "expired"), false);
  assert.equal(isLegalConsentTransition("granted", "granted"), false);
  assert.equal(isLegalConsentTransition("granted", "denied"), false);
  assert.equal(isLegalConsentTransition("denied", "granted"), false);
  assert.equal(isLegalConsentTransition("withdrawn", "granted"), false);
  assert.equal(isLegalConsentTransition("expired", "granted"), false);
});

test("registry: register, decide, withdraw, expire with duplicate and illegal guards", () => {
  const registry = new ConsentRegistry();
  const granted = policy();
  registry.registerPolicy(granted);
  assert.equal(registry.stateOf(granted.id), "unknown");
  assert.throws(() => registry.registerPolicy(granted), /already registered/);
  assert.equal(registry.recordDecision(granted.id, "granted").state, "granted");
  assert.throws(() => registry.recordDecision(granted.id, "denied"), /illegal consent transition/);
  assert.equal(registry.withdraw(granted.id).state, "withdrawn");
  // Terminal: no further transitions on this policy id.
  assert.throws(() => registry.withdraw(granted.id), /illegal consent withdrawal/);
  assert.throws(() => registry.expire(granted.id), /illegal consent expiry/);
  assert.throws(() => registry.recordDecision(granted.id, "granted"), /illegal consent transition/);

  const irrevocable = createConsentPolicy("you_consent_policy02", {
    purposes: ["solution-generation"],
    scope: "USER",
    operationalUse: true,
    learningReuse: false,
    retention: BASE_RETENTION,
    revocable: false,
  });
  registry.registerPolicy(irrevocable);
  registry.recordDecision(irrevocable.id, "granted");
  assert.throws(() => registry.withdraw(irrevocable.id), /not revocable/);
  assert.equal(registry.expire(irrevocable.id).state, "expired");

  assert.throws(() => registry.recordDecision("missing", "granted"), /unknown consent policy/);
  assert.equal(registry.stateOf("missing"), "unknown");
  assert.equal(registry.policyOf("missing"), null);
});

test("registry enforcement helpers agree with the pure predicates", () => {
  const registry = new ConsentRegistry();
  const learner = policy({ purposes: ["solution-generation", "learning"], learningReuse: true });
  registry.registerPolicy(learner);
  assert.equal(registry.canProcessFor(learner.id, "sensitive-media", "solution-generation").allowed, false);
  registry.recordDecision(learner.id, "granted");
  assert.equal(registry.canProcessFor(learner.id, "sensitive-media", "solution-generation").allowed, true);
  assert.equal(registry.canLearnFrom(learner.id).allowed, true);
  registry.withdraw(learner.id);
  assert.equal(registry.canProcessFor(learner.id, "sensitive-media", "solution-generation").reason, "consent-withdrawn");
  assert.equal(registry.canLearnFrom(learner.id).reason, "consent-withdrawn");
});

test("consentReferenceFor snapshots policyId, state and learningPermission", () => {
  const learner = policy({ learningReuse: true });
  const reference = consentReferenceFor(learner, "granted");
  assert.deepEqual(reference, { policyId: learner.id, state: "granted", learningPermission: true });
  assert.ok(Object.isFrozen(reference));
});

test("createConsentPolicy validates id and purposes", () => {
  assert.throws(() => createConsentPolicy("", { purposes: ["learning"], scope: "USER", operationalUse: true, learningReuse: true, retention: BASE_RETENTION, revocable: true }), /non-empty id/);
  assert.throws(() => policy({ purposes: [] }), /at least one purpose/);
  assert.ok(Object.isFrozen(policy()));
});
