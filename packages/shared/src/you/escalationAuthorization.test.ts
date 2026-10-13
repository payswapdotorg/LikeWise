import assert from "node:assert/strict";
import test from "node:test";
import type { EscalationAuthorization } from "./contract.js";
import type { EscalationAuthorizationEntry } from "./escalationAuthorization.js";
import {
  ARENA_LEARNING_PERMISSIONS,
  effectiveAuthorizationStatus,
  evaluateEscalationAuthorization,
  expireEntryAt,
  grantEntryOf,
  isArenaLearningPermission,
  isEscalationAuthorizationBlocking,
  isEscalationAuthorizationDue,
  scopeCovers,
  validateEscalationAuthorizationInput,
  constructEscalationAuthorization,
  withdrawEntryAt,
} from "./escalationAuthorization.js";

const GRANTED_AT = "2026-01-01T00:01:00.000Z";
const EXPIRES_AT = "2026-01-01T00:05:00.000Z";

const DEPS = {
  now: (): string => GRANTED_AT,
  nextId: (kind: string): string => `you_${kind}_0000000000000001`,
};

const VALID_INPUT = {
  escalationId: "you_escalation_0000000000000001",
  authorizedBy: "you_user_0000000000000001",
  scope: "arena:tool-gap-remediation",
  expiresAt: EXPIRES_AT,
  learningPermission: "aggregate" as const,
};

function grantedGrant(): EscalationAuthorization {
  const result = constructEscalationAuthorization(VALID_INPUT, DEPS);
  assert.ok(result.ok);
  return result.ok ? result.authorization : (undefined as never);
}

function activeEntry(): EscalationAuthorizationEntry {
  return grantEntryOf(grantedGrant());
}

test("the three frozen learning permissions (none/aggregate/full)", () => {
  assert.deepEqual(ARENA_LEARNING_PERMISSIONS, ["none", "aggregate", "full"]);
  for (const permission of ARENA_LEARNING_PERMISSIONS) {
    assert.ok(isArenaLearningPermission(permission), permission);
  }
  assert.ok(!isArenaLearningPermission("partial"));
  assert.ok(!isArenaLearningPermission(1));
});

test("constructEscalationAuthorization builds the immutable grant", () => {
  const authorization = grantedGrant();
  assert.equal(authorization.escalationId, VALID_INPUT.escalationId);
  assert.equal(authorization.authorizedBy, VALID_INPUT.authorizedBy);
  assert.equal(authorization.scope, VALID_INPUT.scope);
  assert.equal(authorization.grantedAt, GRANTED_AT);
  assert.equal(authorization.expiresAt, EXPIRES_AT);
  assert.equal(authorization.learningPermission, "aggregate");
  assert.ok(Object.isFrozen(authorization));
});

test("the stateless grant validator refuses malformed intake with stable reasons", () => {
  const cases: readonly [Record<string, unknown>, string][] = [
    [{ ...VALID_INPUT, escalationId: "" }, "escalation-id-empty"],
    [{ ...VALID_INPUT, authorizedBy: "  " }, "authorized-by-empty"],
    [{ ...VALID_INPUT, scope: "" }, "scope-empty"],
    [{ ...VALID_INPUT, expiresAt: "" }, "expiry-malformed"],
    [{ ...VALID_INPUT, expiresAt: GRANTED_AT }, "expiry-not-after-grant"],
    [{ ...VALID_INPUT, expiresAt: "2026-01-01T00:00:59.000Z" }, "expiry-not-after-grant"],
    [{ ...VALID_INPUT, learningPermission: "partial" }, "learning-permission-invalid"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateEscalationAuthorizationInput(input as typeof VALID_INPUT, GRANTED_AT);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  // No-expiry grants and every sanctioned permission validate.
  assert.equal(validateEscalationAuthorizationInput({ ...VALID_INPUT, expiresAt: null }, GRANTED_AT), null);
  for (const permission of ARENA_LEARNING_PERMISSIONS) {
    assert.equal(
      validateEscalationAuthorizationInput({ ...VALID_INPUT, learningPermission: permission }, GRANTED_AT),
      null,
      permission,
    );
  }
});

test("constructEscalationAuthorization returns the refusal instead of throwing", () => {
  const refused = constructEscalationAuthorization({ ...VALID_INPUT, scope: "" }, DEPS);
  assert.ok(!refused.ok);
  if (refused.ok) {
    return;
  }
  assert.equal(refused.refusal.reason, "scope-empty");
});

test("lifecycle entries are new records: expiry and withdrawal never mutate the grant", () => {
  const entry = activeEntry();
  assert.equal(entry.status, "active");
  assert.equal(entry.reason, "");
  assert.equal(entry.recordedAt, GRANTED_AT);

  const expired = expireEntryAt(entry, "2026-01-01T00:05:01.000Z");
  assert.equal(expired.status, "expired");
  assert.equal(expired.reason, "authorization-expired");
  assert.equal(expired.authorization, entry.authorization);
  // The original entry is untouched.
  assert.equal(entry.status, "active");

  const withdrawn = withdrawEntryAt(entry, "2026-01-01T00:02:00.000Z", "user-changed-mind");
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.reason, "user-changed-mind");
  assert.equal(withdrawn.authorization, entry.authorization);
  const defaultReason = withdrawEntryAt(entry, "2026-01-01T00:02:00.000Z", "");
  assert.equal(defaultReason.reason, "user-withdrew-authorization");
});

test("blocking statuses: expired and withdrawn block; active and superseded do not", () => {
  assert.ok(isEscalationAuthorizationBlocking("expired"));
  assert.ok(isEscalationAuthorizationBlocking("withdrawn"));
  assert.ok(!isEscalationAuthorizationBlocking("active"));
  assert.ok(!isEscalationAuthorizationBlocking("superseded"));
});

test("expiry is due at and after expiresAt (ISO-8601 string comparison)", () => {
  const entry = activeEntry();
  assert.ok(!isEscalationAuthorizationDue(entry, "2026-01-01T00:04:59.999Z"));
  assert.ok(isEscalationAuthorizationDue(entry, EXPIRES_AT));
  assert.ok(isEscalationAuthorizationDue(entry, "2026-01-01T00:06:00.000Z"));
  const noExpiry = grantEntryOf({ ...grantedGrant(), expiresAt: null });
  assert.ok(!isEscalationAuthorizationDue(noExpiry, "2030-01-01T00:00:00.000Z"));
});

test("effective status: an active-but-due head projects as expired (lazy expiry)", () => {
  const entry = activeEntry();
  assert.equal(effectiveAuthorizationStatus(entry, "2026-01-01T00:04:00.000Z"), "active");
  assert.equal(effectiveAuthorizationStatus(entry, EXPIRES_AT), "expired");
  assert.equal(effectiveAuthorizationStatus(entry, "2026-01-01T09:00:00.000Z"), "expired");
  const withdrawnEntry = withdrawEntryAt(entry, "2026-01-01T00:02:00.000Z", "user-withdrew");
  assert.equal(effectiveAuthorizationStatus(withdrawnEntry, "2026-01-01T00:01:30.000Z"), "withdrawn");
});

test("scopeCovers: exact matches and prefix wildcard grants", () => {
  assert.ok(scopeCovers("arena:tool-gap-remediation", "arena:tool-gap-remediation"));
  assert.ok(scopeCovers("arena:*", "arena:solve"));
  assert.ok(scopeCovers("arena:*", "arena:tool-gap-remediation"));
  assert.ok(!scopeCovers("arena:tool-gap-remediation", "arena:solve"));
  assert.ok(!scopeCovers("arena:solve", "arena:tool-gap-remediation"));
  // A bare wildcard covers everything (global arena grant).
  assert.ok(scopeCovers("*", "arena:solve"));
});

test("evaluateEscalationAuthorization: the LAW predicate refuses fail-closed with deterministic reasons", () => {
  // 1. A missing authorization refuses.
  assert.deepEqual(evaluateEscalationAuthorization(null, "2026-01-01T00:02:00.000Z", "arena:tool-gap-remediation"), {
    allowed: false,
    reason: "authorization-required",
  });
  // 2. A withdrawn authorization refuses.
  const withdrawn = withdrawEntryAt(activeEntry(), "2026-01-01T00:02:00.000Z", "user-withdrew");
  assert.deepEqual(
    evaluateEscalationAuthorization(withdrawn, "2026-01-01T00:02:30.000Z", "arena:tool-gap-remediation"),
    { allowed: false, reason: "authorization-withdrawn" },
  );
  // 3. An expired authorization refuses (materialized and lazy alike).
  const materialized = expireEntryAt(activeEntry(), "2026-01-01T00:05:01.000Z");
  assert.deepEqual(
    evaluateEscalationAuthorization(materialized, "2026-01-01T00:05:02.000Z", "arena:tool-gap-remediation"),
    { allowed: false, reason: "authorization-expired" },
  );
  assert.deepEqual(
    evaluateEscalationAuthorization(activeEntry(), EXPIRES_AT, "arena:tool-gap-remediation"),
    { allowed: false, reason: "authorization-expired" },
  );
  // 4. A scope mismatch refuses.
  assert.deepEqual(
    evaluateEscalationAuthorization(activeEntry(), "2026-01-01T00:02:00.000Z", "arena:other-scope"),
    { allowed: false, reason: "authorization-scope-mismatch" },
  );
  // 5. An in-scope, unexpired grant allows.
  assert.deepEqual(
    evaluateEscalationAuthorization(activeEntry(), "2026-01-01T00:02:00.000Z", "arena:tool-gap-remediation"),
    { allowed: true, reason: "authorization-within-grant" },
  );
  // 6. A wildcard grant covers narrower scopes.
  const wildcard = grantEntryOf({
    ...grantedGrant(),
    scope: "arena:*",
  });
  assert.deepEqual(
    evaluateEscalationAuthorization(wildcard, "2026-01-01T00:02:00.000Z", "arena:solve"),
    { allowed: true, reason: "authorization-within-grant" },
  );
});

test("a superseded entry is not blocking (the successor governs)", () => {
  const entry: EscalationAuthorizationEntry = { ...activeEntry(), status: "superseded", reason: "superseded-by-successor" };
  assert.deepEqual(
    evaluateEscalationAuthorization(entry, "2026-01-01T00:02:00.000Z", "arena:tool-gap-remediation"),
    { allowed: false, reason: "authorization-superseded" },
  );
});
