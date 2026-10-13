import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaRetryPolicy, CapabilityGapCategory } from "./contract.js";
import {
  ARENA_BACKOFF_CLASSES,
  ARENA_RETRY_MAX_ATTEMPTS_LIMIT,
  ARENA_RETRY_MIN_ATTEMPTS,
  canonicalPolicyKey,
  constructArenaRetryPolicy,
  evaluateArenaRetryGate,
  isArenaBackoffClass,
  policyRequiresAuthorizationOnPath,
  validateArenaRetryPolicyInput,
} from "./arenaRetryPolicy.js";

const VALID_INPUT = {
  maxAttempts: 3,
  backoffClass: "exponential",
  eligibilityCategories: ["TOOL_GAP", "KNOWLEDGE_GAP"] as const,
  requiresAuthorization: true,
};

test("the sanctioned backoff classes are the frozen four", () => {
  assert.deepEqual(ARENA_BACKOFF_CLASSES, ["none", "fixed", "linear", "exponential"]);
  assert.ok(isArenaBackoffClass("fixed"));
  assert.ok(!isArenaBackoffClass("Fixed"));
  assert.ok(!isArenaBackoffClass(""));
  assert.ok(!isArenaBackoffClass("jittered"));
  assert.ok(!isArenaBackoffClass(7));
});

test("constructArenaRetryPolicy canonicalizes and freezes the policy", () => {
  const result = constructArenaRetryPolicy(VALID_INPUT);
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  assert.equal(result.policy.maxAttempts, 3);
  assert.equal(result.policy.backoffClass, "exponential");
  assert.deepEqual(result.policy.eligibilityCategories, ["KNOWLEDGE_GAP", "TOOL_GAP"]);
  assert.equal(result.policy.requiresAuthorization, true);
  assert.ok(Object.isFrozen(result.policy));
  assert.ok(Object.isFrozen(result.policy.eligibilityCategories));
});

test("the stateless validator refuses attempt bounds violations with stable reasons", () => {
  const cases: readonly [unknown, string][] = [
    [{ ...VALID_INPUT, maxAttempts: 0 }, "max-attempts-below-minimum"],
    [{ ...VALID_INPUT, maxAttempts: -1 }, "max-attempts-below-minimum"],
    [{ ...VALID_INPUT, maxAttempts: 1.5 }, "max-attempts-below-minimum"],
    [{ ...VALID_INPUT, maxAttempts: ARENA_RETRY_MAX_ATTEMPTS_LIMIT + 1 }, "max-attempts-above-limit"],
    [{ ...VALID_INPUT, maxAttempts: Number.NaN }, "max-attempts-below-minimum"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateArenaRetryPolicyInput(input as typeof VALID_INPUT);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  // The bounds themselves are legal edge values.
  assert.equal(validateArenaRetryPolicyInput({ ...VALID_INPUT, maxAttempts: ARENA_RETRY_MIN_ATTEMPTS }), null);
  assert.equal(validateArenaRetryPolicyInput({ ...VALID_INPUT, maxAttempts: ARENA_RETRY_MAX_ATTEMPTS_LIMIT }), null);
});

test("the validator refuses malformed backoff classes (format gate)", () => {
  for (const backoffClass of ["", "Fibonacci", "expo nential", "backoff/v2", "linear-jitter"]) {
    const refusal = validateArenaRetryPolicyInput({ ...VALID_INPUT, backoffClass });
    assert.ok(refusal !== null, backoffClass);
    assert.equal(refusal?.reason, "backoff-class-invalid");
  }
  for (const backoffClass of ARENA_BACKOFF_CLASSES) {
    assert.equal(validateArenaRetryPolicyInput({ ...VALID_INPUT, backoffClass }), null, backoffClass);
  }
});

test("the validator refuses eligibility category gates violations", () => {
  const empty = validateArenaRetryPolicyInput({ ...VALID_INPUT, eligibilityCategories: [] });
  assert.equal(empty?.reason, "eligibility-empty");
  const invalid = validateArenaRetryPolicyInput({
    ...VALID_INPUT,
    eligibilityCategories: ["TOOL_GAP", "BUDGET_GAP" as CapabilityGapCategory],
  });
  assert.equal(invalid?.reason, "eligibility-category-invalid");
  const duplicate = validateArenaRetryPolicyInput({
    ...VALID_INPUT,
    eligibilityCategories: ["TOOL_GAP", "TOOL_GAP"],
  });
  assert.equal(duplicate?.reason, "eligibility-duplicate");
});

test("the validator refuses a non-boolean requiresAuthorization flag", () => {
  const refusal = validateArenaRetryPolicyInput({
    ...VALID_INPUT,
    requiresAuthorization: "yes" as unknown as boolean,
  });
  assert.equal(refusal?.reason, "requires-authorization-invalid");
  const flagTrue = validateArenaRetryPolicyInput({ ...VALID_INPUT, requiresAuthorization: true });
  assert.equal(flagTrue, null);
  const flagFalse = validateArenaRetryPolicyInput({ ...VALID_INPUT, requiresAuthorization: false });
  assert.equal(flagFalse, null);
});

test("constructArenaRetryPolicy returns the refusal instead of throwing", () => {
  const refused = constructArenaRetryPolicy({ ...VALID_INPUT, maxAttempts: 0 });
  assert.ok(!refused.ok);
  if (refused.ok) {
    return;
  }
  assert.equal(refused.refusal.reason, "max-attempts-below-minimum");
});

test("evaluateArenaRetryGate: eligibility category gate then attempt bounds, deterministically", () => {
  const policy: ArenaRetryPolicy = {
    maxAttempts: 2,
    backoffClass: "linear",
    eligibilityCategories: ["TOOL_GAP"],
    requiresAuthorization: true,
  };
  assert.deepEqual(evaluateArenaRetryGate(policy, 1, "TOOL_GAP"), { allowed: true, reason: "run-within-policy" });
  assert.deepEqual(evaluateArenaRetryGate(policy, 2, "TOOL_GAP"), { allowed: true, reason: "run-within-policy" });
  assert.deepEqual(evaluateArenaRetryGate(policy, 3, "TOOL_GAP"), { allowed: false, reason: "attempt-exceeds-max" });
  assert.deepEqual(evaluateArenaRetryGate(policy, 0, "TOOL_GAP"), { allowed: false, reason: "attempt-below-minimum" });
  assert.deepEqual(evaluateArenaRetryGate(policy, 1, "KNOWLEDGE_GAP"), { allowed: false, reason: "category-not-eligible" });
  // The category gate fires before the attempt gate (fixed order).
  assert.deepEqual(evaluateArenaRetryGate(policy, 99, "KNOWLEDGE_GAP"), { allowed: false, reason: "category-not-eligible" });
});

test("policyRequiresAuthorizationOnPath flags only flag-true policies without an authorization", () => {
  const requiring: ArenaRetryPolicy = {
    maxAttempts: 2,
    backoffClass: "fixed",
    eligibilityCategories: ["TOOL_GAP"],
    requiresAuthorization: true,
  };
  const notRequiring: ArenaRetryPolicy = { ...requiring, requiresAuthorization: false };
  assert.equal(policyRequiresAuthorizationOnPath(requiring, null), true);
  assert.equal(policyRequiresAuthorizationOnPath(requiring, ""), true);
  assert.equal(policyRequiresAuthorizationOnPath(requiring, "you_escalation-authorization_1"), false);
  assert.equal(policyRequiresAuthorizationOnPath(notRequiring, null), false);
});

test("canonicalPolicyKey is stable and order-sensitive", () => {
  const a: ArenaRetryPolicy = {
    maxAttempts: 2,
    backoffClass: "fixed",
    eligibilityCategories: ["TOOL_GAP", "KNOWLEDGE_GAP"],
    requiresAuthorization: true,
  };
  const b: ArenaRetryPolicy = {
    maxAttempts: 3,
    backoffClass: "fixed",
    eligibilityCategories: ["KNOWLEDGE_GAP", "TOOL_GAP"],
    requiresAuthorization: true,
  };
  assert.equal(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, eligibilityCategories: ["KNOWLEDGE_GAP", "TOOL_GAP"] }));
  assert.notEqual(canonicalPolicyKey(a), canonicalPolicyKey(b));
  assert.notEqual(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, requiresAuthorization: false }));
});
