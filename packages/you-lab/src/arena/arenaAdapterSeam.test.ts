// Arena adapter seam tests (W8C) — coverage: the fail-closed invocation
// gate (provider/category support, retry-ladder validity, the escalation
// authorization law with presence/identity/expiry), content-addressing
// helpers, and the intended fixture model (strategy ladders, run-status
// determinism, class-dependent recovery bands, result-type table).
import assert from "node:assert/strict";
import test from "node:test";
import {
  ARENA_ADAPTER_UNSUPPORTED_CODE,
  ARENA_AUTHORIZATION_REQUIRED_CODE,
  ARENA_RESULT_TYPES,
  ARENA_STRATEGY_LADDERS,
  InvalidRetryLadderError,
  ArenaAuthorizationRequiredError,
  NEUTRAL_BACKOFF_CLASSES,
  NEUTRAL_CAPABILITY_GAP_CATEGORIES,
  RETRY_LADDER_INVALID_CODE,
  UnsupportedArenaRequestError,
  aggregateContentDigest,
  assertArenaInvocationSupported,
  intendedRecoveryAt,
  intendedResultTypeFor,
  intendedRunStatusAt,
  intendedStrategyAt,
  neutralArenaEvidenceRef,
  neutralArenaRunId,
  notMeasuredArenaEffortFields,
  sha256Hex,
  unsupportedArenaInvocationAspects,
  type ArenaAdapterProfile,
  type NeutralArenaInvocation,
} from "./arenaAdapterSeam.js";
import { ARENA_BENCHMARK_FIXTURES, fixtureScenario } from "./arenaFixtures.js";

function profileFixture(): ArenaAdapterProfile {
  return {
    id: "seam-profile",
    technologyId: null,
    servedCapabilityClasses: ["arena-automation", "gap-category:TOOL_GAP"],
    supportedCategories: ["TOOL_GAP"],
    adapterKind: "mock",
    deterministic: true,
    determinismNote: "fixture",
    productionEligible: null,
    eligibilityBasis: "fixture",
  };
}

function invocationFixture(): NeutralArenaInvocation {
  const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[0]!);
  return {
    requestId: "seam-req-1",
    provider: scenario.provider,
    gap: scenario.gap,
    retryLadder: scenario.retryLadder,
    escalationId: scenario.escalationId,
    authorization: scenario.authorization,
    submittedAt: "2026-10-13T12:00:00Z",
  };
}

test("arena seam: the happy-path invocation passes the fail-closed gate", () => {
  assert.doesNotThrow(() => assertArenaInvocationSupported(profileFixture(), invocationFixture()));
  assert.deepEqual(unsupportedArenaInvocationAspects(profileFixture(), invocationFixture()), []);
});

// The first seeded fixture is a TOOL_GAP scenario whose ladder requires
// authorization — the auth-law tests below lean on that shape.

test("arena seam: unsupported provider/category surface is a typed YOU_ARENA_ADAPTER_UNSUPPORTED refusal", () => {
  const request = invocationFixture();
  const aspects = unsupportedArenaInvocationAspects(profileFixture(), { ...request, gap: { ...request.gap, category: "MODEL_GAP" } });
  assert.equal(aspects.length, 1);
  assert.match(aspects[0]!, /gap category 'MODEL_GAP'/);
  assert.throws(
    () => assertArenaInvocationSupported(profileFixture(), { ...request, gap: { ...request.gap, category: "MODEL_GAP" } }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedArenaRequestError);
      assert.equal(error.code, ARENA_ADAPTER_UNSUPPORTED_CODE);
      assert.match(error.message, /does not support gap category 'MODEL_GAP'/);
      return true;
    },
  );
  // provider capability-class mismatch is also a typed refusal
  assert.throws(
    () =>
      assertArenaInvocationSupported(profileFixture(), {
        ...request,
        provider: { ...request.provider, capabilityClasses: ["unrelated-class"] },
      }),
    (error: unknown) => {
      assert.ok(error instanceof UnsupportedArenaRequestError);
      assert.equal(error.code, ARENA_ADAPTER_UNSUPPORTED_CODE);
      assert.match(error.message, /provider capability classes/);
      return true;
    },
  );
});

test("arena seam: malformed or ineligible retry ladders are typed YOU_RETRY_POLICY_INVALID refusals", () => {
  const profile = { ...profileFixture(), supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES], servedCapabilityClasses: ["arena-automation"] };
  const base = invocationFixture();
  const cases: readonly [string, NeutralArenaInvocation][] = [
    ["maxAttempts zero", { ...base, retryLadder: { ...base.retryLadder, maxAttempts: 0 } }],
    ["maxAttempts fractional", { ...base, retryLadder: { ...base.retryLadder, maxAttempts: 1.5 } }],
    ["empty backoff class", { ...base, retryLadder: { ...base.retryLadder, backoffClass: "" } }],
    ["empty eligibility", { ...base, retryLadder: { ...base.retryLadder, eligibilityCategories: [] } }],
    ["category not eligible", { ...base, retryLadder: { ...base.retryLadder, eligibilityCategories: ["DATA_GAP"] } }],
  ];
  for (const [label, request] of cases) {
    assert.throws(
      () => assertArenaInvocationSupported(profile, request),
      (error: unknown) => {
        assert.ok(error instanceof InvalidRetryLadderError, `${label}: typed error`);
        assert.equal(error.code, RETRY_LADDER_INVALID_CODE);
        return true;
      },
      label,
    );
  }
});

test("arena seam: the escalation authorization law refuses missing, mislinked and expired grants", () => {
  const profile = { ...profileFixture(), supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES], servedCapabilityClasses: ["arena-automation"] };
  const base = invocationFixture();
  const requiresAuth = (request: NeutralArenaInvocation): NeutralArenaInvocation => ({
    ...request,
    retryLadder: { ...request.retryLadder, requiresAuthorization: true },
  });
  // missing authorization
  assert.throws(
    () => assertArenaInvocationSupported(profile, requiresAuth({ ...base, authorization: null })),
    (error: unknown) => {
      assert.ok(error instanceof ArenaAuthorizationRequiredError);
      assert.equal(error.code, ARENA_AUTHORIZATION_REQUIRED_CODE);
      assert.match(error.message, /requires an explicit EscalationAuthorization/);
      return true;
    },
  );
  // authorization linked to another escalation (identity linkage refused)
  assert.throws(
    () =>
      assertArenaInvocationSupported(
        profile,
        requiresAuth({ ...base, authorization: { ...base.authorization!, escalationId: "you_escalation_other" } }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ArenaAuthorizationRequiredError);
      assert.match(error.message, /identity linkage refused/);
      return true;
    },
  );
  // invocation names no escalation to link the grant to
  assert.throws(
    () => assertArenaInvocationSupported(profile, requiresAuth({ ...base, escalationId: null })),
    (error: unknown) => {
      assert.ok(error instanceof ArenaAuthorizationRequiredError);
      assert.match(error.message, /names no escalation/);
      return true;
    },
  );
  // expired grant (expiry before submission) never runs
  assert.throws(
    () =>
      assertArenaInvocationSupported(
        profile,
        requiresAuth({ ...base, authorization: { ...base.authorization!, expiresAt: "2026-10-13T10:00:00Z" } }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof ArenaAuthorizationRequiredError);
      assert.match(error.message, /expired grants never run/);
      return true;
    },
  );
  // unparseable expiry is fail-closed too
  assert.throws(
    () =>
      assertArenaInvocationSupported(
        profile,
        requiresAuth({ ...base, authorization: { ...base.authorization!, expiresAt: "not-a-date" } }),
      ),
    /ArenaAuthorizationRequiredError|expires at/,
  );
  // expiry exactly at submission is still valid (>=, not >)
  assert.doesNotThrow(() =>
    assertArenaInvocationSupported(
      profile,
      requiresAuth({ ...base, authorization: { ...base.authorization!, expiresAt: "2026-10-13T12:00:00Z" } }),
    ),
  );
  // a ladder that does not require authorization runs without a grant (automation-only path)
  assert.doesNotThrow(() =>
    assertArenaInvocationSupported(profile, { ...base, authorization: null, escalationId: null, retryLadder: { ...base.retryLadder, requiresAuthorization: false } }),
  );
});

test("arena seam: content-addressing helpers derive the documented id/ref formats", () => {
  const runId = neutralArenaRunId("adapter-a", "request-1", 2);
  assert.match(runId, /^you_arena-run_[0-9a-f]{16}$/);
  assert.equal(runId, neutralArenaRunId("adapter-a", "request-1", 2), "deterministic");
  assert.notEqual(runId, neutralArenaRunId("adapter-a", "request-1", 3), "attempt-sensitive");
  const evidenceRef = neutralArenaEvidenceRef("adapter-a", "request-1", 2);
  assert.equal(evidenceRef, "content-store://you-lab/arena/adapter-a/request-1/attempt-2");
  assert.match(sha256Hex("arena"), /^[0-9a-f]{64}$/);
  // the aggregate digest binds the payload bytes; the empty ladder has a class-less envelope
  const payload = { resultType: "typed-payload", recovery: 0.9 };
  const digest = aggregateContentDigest(payload, "exponential-backoff-jitter");
  assert.equal(digest, aggregateContentDigest({ recovery: 0.9, resultType: "typed-payload" }, "exponential-backoff-jitter"), "canonical key order");
  assert.notEqual(digest, aggregateContentDigest(payload, "circuit-breaker"), "class-sensitive envelope");
  assert.equal(aggregateContentDigest(null, "circuit-breaker"), aggregateContentDigest(null, "token-bucket"), "empty envelope is class-less");
});

test("arena seam: the intended fixture model is deterministic and vocabulary-bounded", () => {
  // strategy ladders cover the seven frozen categories and cycle by attempt
  assert.deepEqual(Object.keys(ARENA_STRATEGY_LADDERS).sort(), [...NEUTRAL_CAPABILITY_GAP_CATEGORIES].sort());
  assert.equal(intendedStrategyAt("TOOL_GAP", 1), "tool-reattach");
  assert.equal(intendedStrategyAt("TOOL_GAP", 4), "tool-reattach", "ladder cycles");
  assert.equal(intendedStrategyAt("EXPERT_GAP", 2), "expert-review");
  assert.throws(() => intendedStrategyAt("NOT_A_CATEGORY", 1), /no authored strategy ladder/);
  assert.throws(() => intendedStrategyAt("TOOL_GAP", 0), /attempt must be an integer >= 1/);
  // run statuses are pure functions of (gapId, attempt)
  for (const gapId of ["gap-a", "gap-b", "you_gap_0123456789abcdef"]) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      assert.equal(intendedRunStatusAt(gapId, attempt), intendedRunStatusAt(gapId, attempt));
    }
  }
  // recovery bands are class-dependent and bounded in [0.5, 1]
  for (const backoffClass of NEUTRAL_BACKOFF_CLASSES) {
    for (const gapId of ["gap-a", "gap-b", "gap-c"]) {
      const value = intendedRecoveryAt(gapId, backoffClass);
      assert.ok(value >= 0.5 && value <= 1, `${backoffClass}/${gapId}: ${value} in [0.5, 1]`);
    }
  }
  assert.notEqual(
    intendedRecoveryAt("gap-a", "exponential-backoff-jitter"),
    intendedRecoveryAt("gap-a", "token-bucket"),
    "class-dependent bands differ",
  );
  assert.throws(() => intendedRecoveryAt("gap-a", "not-a-class"), /no authored recovery band/);
  // result types cover the seven frozen categories
  assert.deepEqual(Object.keys(ARENA_RESULT_TYPES).sort(), [...NEUTRAL_CAPABILITY_GAP_CATEGORIES].sort());
  assert.equal(intendedResultTypeFor("EDITOR_GAP"), "artifact");
  assert.equal(intendedResultTypeFor("SKILL_GAP"), "guidance");
  assert.throws(() => intendedResultTypeFor("NOT_A_CATEGORY"), /no authored result type/);
  // effort fields carry honest not-measured markers
  const effort = notMeasuredArenaEffortFields();
  assert.equal(effort.effort.kind, "not-measured");
  assert.equal((effort.latency as { marker?: string }).marker, "not-measured (simulated)");
  assert.equal(effort.cost.kind, "not-measured");
});
