import assert from "node:assert/strict";
import test from "node:test";
import type { ConsentState } from "./contract.js";
import {
  RETENTION_CONSENT_PROTECTED_STATES,
  RETENTION_ENFORCEMENT_CLASSES,
  constructRetentionEnforcementRecord,
  isRetentionConsentProtected,
  isRetentionEnforcementClass,
  retentionConsentDecision,
  validateRetentionEnforcementInput,
} from "./retentionEnforcement.js";

const VALID_INPUT = {
  retentionClass: "project-retention",
  subjectRef: "you_retention-subject_fixture01",
};

test("the sanctioned retention classes are the wave-2 RetentionPolicy classes verbatim", () => {
  assert.deepEqual(RETENTION_ENFORCEMENT_CLASSES, [
    "session-only",
    "delete-after-review",
    "project-retention",
    "tenant-retention",
  ]);
  assert.ok(isRetentionEnforcementClass("session-only"));
  assert.ok(!isRetentionEnforcementClass("forever"));
  assert.ok(!isRetentionEnforcementClass(""));
  assert.ok(!isRetentionEnforcementClass("Project-Retention"));
});

test("the pass-intake validator refuses unsanctioned classes and empty subjects", () => {
  assert.equal(validateRetentionEnforcementInput({ ...VALID_INPUT, retentionClass: "forever" })?.reason, "retention-class-invalid");
  assert.equal(validateRetentionEnforcementInput({ ...VALID_INPUT, subjectRef: "" })?.reason, "subject-ref-empty");
  assert.equal(validateRetentionEnforcementInput(VALID_INPUT), null);
  for (const retentionClass of RETENTION_ENFORCEMENT_CLASSES) {
    assert.equal(validateRetentionEnforcementInput({ ...VALID_INPUT, retentionClass }), null, retentionClass);
  }
});

test("constructRetentionEnforcementRecord freezes the immutable auditable pass", () => {
  const result = constructRetentionEnforcementRecord({
    id: "you_retention-pass_0001",
    retentionClass: "project-retention",
    subjectRef: "you_retention-subject_fixture01",
    enforcedAt: "2026-01-01T00:00:01.000Z",
  });
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  assert.equal(result.record.id, "you_retention-pass_0001");
  assert.equal(result.record.retentionClass, "project-retention");
  assert.equal(result.record.subjectRef, "you_retention-subject_fixture01");
  assert.equal(result.record.enforcedAt, "2026-01-01T00:00:01.000Z");
  assert.equal(result.record.simulated, true);
  assert.ok(Object.isFrozen(result.record));
  // Intake and timestamp refusals are returned, never thrown.
  assert.equal(constructRetentionEnforcementRecord({ id: "x", retentionClass: "forever", subjectRef: "s", enforcedAt: "t" }).ok, false);
  assert.equal(
    constructRetentionEnforcementRecord({ id: "x", retentionClass: "project-retention", subjectRef: "s", enforcedAt: "" }).ok,
    false,
  );
});

test("the consent gate: an ACTIVE granted consent outranks every retention class (the RETENTION LAW)", () => {
  assert.deepEqual(RETENTION_CONSENT_PROTECTED_STATES, ["granted"]);
  assert.ok(isRetentionConsentProtected("granted"));
  assert.deepEqual(retentionConsentDecision("granted"), { allowed: false, reason: "consent-protected" });
});

test("the consent gate allows passes when the consent is not active (unknown/denied/expired/withdrawn)", () => {
  for (const consentState of ["unknown", "denied", "expired", "withdrawn"] as const) {
    assert.deepEqual(retentionConsentDecision(consentState), { allowed: true, reason: "consent-not-active" }, consentState);
    assert.ok(!isRetentionConsentProtected(consentState as ConsentState), consentState);
  }
});

test("the consent gate decision is pure and total over the five frozen consent states", () => {
  const states: readonly ConsentState[] = ["unknown", "granted", "denied", "expired", "withdrawn"];
  for (const consentState of states) {
    const decision = retentionConsentDecision(consentState);
    assert.equal(decision.allowed, consentState !== "granted");
    assert.equal(typeof decision.reason, "string");
  }
});
