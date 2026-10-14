import assert from "node:assert/strict";
import test from "node:test";
import type { RateLimitPolicy } from "./contract.js";
import {
  RATE_LIMIT_ACTIONS,
  RATE_LIMIT_BURST_MAX,
  RATE_LIMIT_BURST_MIN,
  RATE_LIMIT_CANONICAL_SCOPES,
  RATE_LIMIT_WINDOW_S_MAX,
  RATE_LIMIT_WINDOW_S_MIN,
  canonicalPolicyKey,
  constructRateLimitPolicy,
  evaluateRateLimitWindow,
  isRateLimitAction,
  isRateLimitScope,
  validateRateLimitPolicyInput,
} from "./rateLimitPolicy.js";

const VALID_INPUT = {
  scope: "import:scan",
  windowS: 60,
  burst: 2,
  action: "deny" as const,
};

test("the sanctioned actions are the frozen three (deny is fail-closed; defer is queueable; shed drops)", () => {
  assert.deepEqual(RATE_LIMIT_ACTIONS, ["deny", "defer", "shed"]);
  assert.ok(isRateLimitAction("deny"));
  assert.ok(isRateLimitAction("defer"));
  assert.ok(isRateLimitAction("shed"));
  assert.ok(!isRateLimitAction("Deny"));
  assert.ok(!isRateLimitAction(""));
  assert.ok(!isRateLimitAction("throttle"));
  assert.ok(!isRateLimitAction(7));
});

test("the canonical scope format is two-plus lowercase namespace:action segments", () => {
  assert.ok(isRateLimitScope("import:scan"));
  assert.ok(isRateLimitScope("retention:enforce"));
  assert.ok(isRateLimitScope("dr:restore"));
  assert.ok(isRateLimitScope("import:scan:priority"));
  assert.ok(isRateLimitScope("a-b-c:d-e-f"));
  for (const scope of RATE_LIMIT_CANONICAL_SCOPES) {
    assert.ok(isRateLimitScope(scope), scope);
  }
  for (const scope of ["", "import", "IMPORT:SCAN", "import: scan", "import:scan!", "import:", ":scan", "import:scan:"]) {
    assert.ok(!isRateLimitScope(scope), JSON.stringify(scope));
  }
  assert.ok(!isRateLimitScope(42));
});

test("constructRateLimitPolicy freezes the policy and mints the id through the factory", () => {
  let idCounter = 0;
  const nextId = (kind: string): string => {
    idCounter += 1;
    return `you_${kind}_${idCounter.toString().padStart(4, "0")}`;
  };
  const result = constructRateLimitPolicy(VALID_INPUT, nextId);
  assert.ok(result.ok);
  if (!result.ok) {
    return;
  }
  assert.equal(result.policy.id, "you_rate-limit-policy_0001");
  assert.equal(result.policy.scope, "import:scan");
  assert.equal(result.policy.windowS, 60);
  assert.equal(result.policy.burst, 2);
  assert.equal(result.policy.action, "deny");
  assert.equal(result.policy.simulated, true);
  assert.ok(Object.isFrozen(result.policy));
});

test("the stateless validator refuses window/burst bounds with stable reasons", () => {
  const cases: readonly [unknown, string][] = [
    [{ ...VALID_INPUT, windowS: 0 }, "window-below-minimum"],
    [{ ...VALID_INPUT, windowS: -1 }, "window-below-minimum"],
    [{ ...VALID_INPUT, windowS: 0.5 }, "window-below-minimum"],
    [{ ...VALID_INPUT, windowS: Number.NaN }, "window-below-minimum"],
    [{ ...VALID_INPUT, windowS: RATE_LIMIT_WINDOW_S_MAX + 1 }, "window-above-maximum"],
    [{ ...VALID_INPUT, burst: 0 }, "burst-below-minimum"],
    [{ ...VALID_INPUT, burst: -3 }, "burst-below-minimum"],
    [{ ...VALID_INPUT, burst: 1.5 }, "burst-below-minimum"],
    [{ ...VALID_INPUT, burst: RATE_LIMIT_BURST_MAX + 1 }, "burst-above-maximum"],
  ];
  for (const [input, reason] of cases) {
    const refusal = validateRateLimitPolicyInput(input as typeof VALID_INPUT);
    assert.ok(refusal !== null, String(reason));
    assert.equal(refusal?.reason, reason);
  }
  // The bounds themselves are legal edge values.
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, windowS: RATE_LIMIT_WINDOW_S_MIN }), null);
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, windowS: RATE_LIMIT_WINDOW_S_MAX }), null);
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, burst: RATE_LIMIT_BURST_MIN }), null);
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, burst: RATE_LIMIT_BURST_MAX }), null);
});

test("the validator refuses malformed scopes and actions", () => {
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, scope: "Import Scan" })?.reason, "scope-invalid");
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, scope: "import" })?.reason, "scope-invalid");
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, action: "throttle" as never })?.reason, "action-invalid");
  assert.equal(validateRateLimitPolicyInput({ ...VALID_INPUT, action: "" as never })?.reason, "action-invalid");
});

test("constructRateLimitPolicy returns the refusal instead of throwing", () => {
  const refused = constructRateLimitPolicy({ ...VALID_INPUT, windowS: 0 }, (kind) => `you_${kind}_x`);
  assert.ok(!refused.ok);
  if (refused.ok) {
    return;
  }
  assert.equal(refused.refusal.reason, "window-below-minimum");
});

test("evaluateRateLimitWindow: a fresh window admits up to burst, then exhausts (fixed order reasons)", () => {
  const policy: RateLimitPolicy = {
    id: "you_rate-limit-policy_fixture",
    scope: "import:scan",
    windowS: 60,
    burst: 2,
    action: "deny",
    simulated: true,
  };
  const now = "2026-01-01T00:00:10.000Z";
  const first = evaluateRateLimitWindow(policy, now, null);
  assert.deepEqual(first, { allowed: true, reason: "within-burst", windowStart: now, used: 1, rolled: true });
  const second = evaluateRateLimitWindow(policy, now, { windowStart: now, used: 1 });
  assert.deepEqual(second, { allowed: true, reason: "within-burst", windowStart: now, used: 2, rolled: false });
  const third = evaluateRateLimitWindow(policy, now, { windowStart: now, used: 2 });
  assert.deepEqual(third, { allowed: false, reason: "burst-exhausted", windowStart: now, used: 2, rolled: false });
  // Refused requests consume nothing: the usage stays 2.
  const fourth = evaluateRateLimitWindow(policy, now, { windowStart: now, used: 2 });
  assert.equal(fourth.used, 2);
});

test("evaluateRateLimitWindow: the window rolls at/after windowStart + windowS and admits again", () => {
  const policy: RateLimitPolicy = {
    id: "you_rate-limit-policy_fixture",
    scope: "import:scan",
    windowS: 2,
    burst: 1,
    action: "deny",
    simulated: true,
  };
  const start = "2026-01-01T00:00:00.000Z";
  const first = evaluateRateLimitWindow(policy, start, null);
  assert.equal(first.allowed, true);
  assert.equal(first.used, 1);
  // One second later: same window, budget exhausted.
  const atOneS = evaluateRateLimitWindow(policy, "2026-01-01T00:00:01.000Z", { windowStart: start, used: 1 });
  assert.deepEqual(atOneS, { allowed: false, reason: "burst-exhausted", windowStart: start, used: 1, rolled: false });
  // Two seconds later (>= windowS): the window rolls and the budget resets.
  const atTwoS = evaluateRateLimitWindow(policy, "2026-01-01T00:00:02.000Z", { windowStart: start, used: 1 });
  assert.deepEqual(atTwoS, {
    allowed: true,
    reason: "within-burst",
    windowStart: "2026-01-01T00:00:02.000Z",
    used: 1,
    rolled: true,
  });
});

test("evaluateRateLimitWindow is pure: the same triple always yields the same decision", () => {
  const policy: RateLimitPolicy = {
    id: "you_rate-limit-policy_fixture",
    scope: "retention:enforce",
    windowS: 10,
    burst: 3,
    action: "defer",
    simulated: true,
  };
  const now = "2026-01-01T00:00:05.000Z";
  const window = { windowStart: "2026-01-01T00:00:01.000Z", used: 2 };
  assert.deepEqual(evaluateRateLimitWindow(policy, now, window), evaluateRateLimitWindow(policy, now, window));
});

test("canonicalPolicyKey is stable and order-sensitive", () => {
  const a: RateLimitPolicy = { id: "p1", scope: "import:scan", windowS: 60, burst: 2, action: "deny", simulated: true };
  assert.equal(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, id: "p2" }));
  assert.notEqual(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, windowS: 61 }));
  assert.notEqual(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, burst: 3 }));
  assert.notEqual(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, action: "defer" }));
  assert.notEqual(canonicalPolicyKey(a), canonicalPolicyKey({ ...a, scope: "import:admit" }));
});
