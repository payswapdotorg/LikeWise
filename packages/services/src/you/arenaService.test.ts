import assert from "node:assert/strict";
import test from "node:test";
import type { ArenaRun, CapabilityGap, OpaqueId } from "@zcode/shared";
import { ARENA_MINIMUM_CONTEXT } from "../../../shared/src/you/gap.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createArenaService, ArenaService, type ArenaGapIntakeInput } from "./arenaService.js";

const SOLUTION = "you_w8a_service_test";

const PROVIDER_INPUT = {
  providerKind: "synthetic-arena-fixture",
  capabilityClasses: ["TOOL_GAP", "KNOWLEDGE_GAP"],
  endpointRef: null,
};

const POLICY_INPUT = {
  maxAttempts: 2,
  backoffClass: "exponential",
  eligibilityCategories: ["TOOL_GAP", "KNOWLEDGE_GAP"],
  requiresAuthorization: true,
} as const;

const GAP_INPUT: ArenaGapIntakeInput = {
  intentRef: "you_intent_0000000000000001",
  attemptedStrategies: [
    { strategy: "gltf-transform", outcome: "failed", evidenceRef: "you_evidence_0000000000000001" },
    { strategy: "manual-pipeline", outcome: "partial", evidenceRef: null },
  ],
  failureEvidence: ["you_evidence_0000000000000001", "you_evidence_0000000000000002"],
  category: "TOOL_GAP",
  confidence: 0.8,
  suggestedNextAction: "substitute-gltf-pipeline",
};

interface Fixture {
  readonly service: ArenaService;
  readonly gap: CapabilityGap;
}

function createFixture(seed: string, gapInput: ArenaGapIntakeInput = GAP_INPUT): Fixture {
  const service = createArenaService({ workspaceIdentity: "ws-w8a-service-test", seed });
  const gap = service.recordCapabilityGap(SOLUTION, gapInput);
  assert.ok(gap.ok);
  return { service, gap: gap.value.gap };
}

function fixtureWithPolicyAndProvider(seed: string, gapInput: ArenaGapIntakeInput = GAP_INPUT): Fixture {
  const fixture = createFixture(seed, gapInput);
  const provider = fixture.service.registerArenaProvider(SOLUTION, PROVIDER_INPUT);
  assert.ok(provider.ok);
  const policy = fixture.service.registerRetryPolicy(SOLUTION, POLICY_INPUT);
  assert.ok(policy.ok);
  return fixture;
}

function startAndFailRun(service: ArenaService, gapId: OpaqueId, strategy: string): ArenaRun {
  const started = service.startArenaRun(SOLUTION, gapId, { strategy });
  assert.ok(started.ok);
  const failed = service.failArenaRun(SOLUTION, started.value.run.id, { outcomeEvidenceRef: `you_evidence_${strategy}` });
  assert.ok(failed.ok);
  return failed.value.run;
}

function providerIdOf(fixture: Fixture): OpaqueId {
  const providers = fixture.service.arenaProvidersOf(SOLUTION);
  assert.ok(providers.ok);
  return providers.value.providers[0]?.id ?? "";
}

function escalateWithGrant(
  service: ArenaService,
  gapId: OpaqueId,
  options: { readonly scope?: string; readonly expiresAt?: string | null; readonly permission?: "none" | "aggregate" | "full" } = {},
): { readonly gap: CapabilityGap; readonly authorizationId: OpaqueId } {
  const requested = service.requestEscalation(SOLUTION, gapId);
  assert.ok(requested.ok);
  const escalationId = requested.value.gap.arenaEscalationRef?.escalationId ?? "";
  const granted = service.grantAuthorization(SOLUTION, escalationId, {
    authorizedBy: "you_user_0000000000000001",
    scope: options.scope ?? "arena:tool-gap-remediation",
    expiresAt: options.expiresAt ?? null,
    learningPermission: options.permission ?? "aggregate",
  });
  assert.ok(granted.ok);
  return { gap: granted.value.gap, authorizationId: granted.value.authorization.id };
}

test("gap persistence: the v1 shape is recorded, linked and immutable", () => {
  const fixture = createFixture("gap-persistence");
  const found = fixture.service.gapOf(SOLUTION, fixture.gap.id);
  assert.ok(found.ok);
  assert.equal(found.value.gap, fixture.gap);
  assert.equal(found.value.gap.intentRef, "you_intent_0000000000000001");
  assert.equal(found.value.gap.category, "TOOL_GAP");
  assert.equal(found.value.gap.escalationEligibility, "eligible");
  assert.deepEqual(
    found.value.gap.attemptedStrategies.map((strategy) => strategy.outcome),
    ["failed", "partial"],
  );
  assert.equal(found.value.gap.failureEvidence.length, 2);
  assert.ok(Object.isFrozen(fixture.gap));
  const listed = fixture.service.gapsOf(SOLUTION);
  assert.ok(listed.ok);
  assert.equal(listed.value.gaps.length, 1);
  // The gap rides the ledger with the full linkage facts.
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  assert.equal(events.value[0]?.type, "capability-gap-detected");
  assert.equal(events.value[0]?.payload["capabilityGapId"], fixture.gap.id);
  assert.equal(events.value[0]?.payload["intentRef"], "you_intent_0000000000000001");
  assert.equal(events.value[0]?.payload["strategyCount"], 2);
  assert.equal(events.value[0]?.payload["strategyOutcome.1"], "partial");
  assert.equal(events.value[0]?.payload["failureEvidenceCount"], 2);
});

test("gap intake refusals are typed", () => {
  const service = createArenaService({ workspaceIdentity: "ws-w8a-service-test", seed: "gap-refusals" });
  const noStrategies = service.recordCapabilityGap(SOLUTION, { ...GAP_INPUT, attemptedStrategies: [] });
  assert.ok(!noStrategies.ok);
  assert.equal(noStrategies.error.code, "YOU_INVALID_STATE");
  assert.equal(noStrategies.error.details["reason"], "invalid-gap-intake");
  const unknownGap = service.gapOf(SOLUTION, "you_gap_missing");
  assert.ok(!unknownGap.ok);
  assert.equal(unknownGap.error.code, "YOU_INVALID_STATE");
  assert.equal(unknownGap.error.details["reason"], "unknown-gap");
});

test("the run ladder: policy-gated starts, immutable terminal transitions, locked terminals", () => {
  const fixture = fixtureWithPolicyAndProvider("run-ladder");
  const first = fixture.service.startArenaRun(SOLUTION, fixture.gap.id, { strategy: "gltf-transform" });
  assert.ok(first.ok);
  assert.equal(first.value.run.attempt, 1);
  assert.equal(first.value.run.status, "started");
  assert.equal(first.value.run.simulated, true);
  const completed = fixture.service.completeArenaRun(SOLUTION, first.value.run.id, { outcomeEvidenceRef: "you_evidence_run1" });
  assert.ok(completed.ok);
  assert.equal(completed.value.run.status, "completed");
  assert.equal(completed.value.run.completedAt !== null, true);
  assert.equal(completed.value.run.outcomeEvidenceRef, "you_evidence_run1");
  // The original "started" record is untouched (immutable replacement).
  assert.equal(first.value.run.status, "started");
  assert.equal(first.value.run.completedAt, null);
  // Terminals lock (typed refusal with the ladder's stable reason).
  const locked = fixture.service.abortArenaRun(SOLUTION, completed.value.run.id);
  assert.ok(!locked.ok);
  assert.equal(locked.error.code, "YOU_INVALID_STATE");
  assert.equal(locked.error.details["reason"], "run-terminal-locked");
  // A no-op terminal transition also refuses (completed -> completed).
  const noOp = fixture.service.completeArenaRun(SOLUTION, completed.value.run.id);
  assert.ok(!noOp.ok);
  assert.equal(noOp.error.details["reason"], "no-op-transition");
  // Unknown runs are typed YOU_ARENA_RUN_NOT_FOUND across every op.
  for (const result of [
    fixture.service.runOf(SOLUTION, "you_arena-run_missing"),
    fixture.service.completeArenaRun(SOLUTION, "you_arena-run_missing"),
    fixture.service.failArenaRun(SOLUTION, "you_arena-run_missing"),
    fixture.service.abortArenaRun(SOLUTION, "you_arena-run_missing"),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_ARENA_RUN_NOT_FOUND");
    assert.equal(result.error.details["reason"], "unknown-run");
    assert.equal(result.error.simulated, true);
  }
});

test("the run gates: attempt bounds and category eligibility are typed YOU_RETRY_POLICY_INVALID", () => {
  const fixture = fixtureWithPolicyAndProvider("run-gates");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-1");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-2");
  // maxAttempts = 2: the third attempt exceeds the ladder.
  const third = fixture.service.startArenaRun(SOLUTION, fixture.gap.id, { strategy: "attempt-3" });
  assert.ok(!third.ok);
  assert.equal(third.error.code, "YOU_RETRY_POLICY_INVALID");
  assert.equal(third.error.details["reason"], "attempt-exceeds-max");
  assert.equal(third.error.details["attempt"], 3);
  // A gap whose category is not eligible refuses with the category gate.
  const knowledgeGap = fixture.service.recordCapabilityGap(SOLUTION, {
    ...GAP_INPUT,
    category: "KNOWLEDGE_GAP",
    suggestedNextAction: "human-proportion-rules",
  });
  assert.ok(knowledgeGap.ok);
  const eligibleRun = fixture.service.startArenaRun(SOLUTION, knowledgeGap.value.gap.id, { strategy: "rules-lookup" });
  assert.ok(eligibleRun.ok); // KNOWLEDGE_GAP is policy-eligible.
  const editorGap = fixture.service.recordCapabilityGap(SOLUTION, {
    ...GAP_INPUT,
    category: "EDITOR_GAP",
    suggestedNextAction: "editor-substitution",
  });
  assert.ok(editorGap.ok);
  const refused = fixture.service.startArenaRun(SOLUTION, editorGap.value.gap.id, { strategy: "editor-swap" });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_RETRY_POLICY_INVALID");
  assert.equal(refused.error.details["reason"], "category-not-eligible");
  // No policy registered => fail-closed.
  const bare = createFixture("no-policy");
  const noPolicy = bare.service.startArenaRun(SOLUTION, bare.gap.id, { strategy: "search" });
  assert.ok(!noPolicy.ok);
  assert.equal(noPolicy.error.code, "YOU_RETRY_POLICY_INVALID");
  assert.equal(noPolicy.error.details["reason"], "no-active-policy");
});

test("policy registration refusals are typed YOU_RETRY_POLICY_INVALID with stable reasons", () => {
  const service = createArenaService({ workspaceIdentity: "ws-w8a-service-test", seed: "policy-refusals" });
  const cases: readonly [Record<string, unknown>, string][] = [
    [{ ...POLICY_INPUT, maxAttempts: 0 }, "max-attempts-below-minimum"],
    [{ ...POLICY_INPUT, maxAttempts: 17 }, "max-attempts-above-limit"],
    [{ ...POLICY_INPUT, backoffClass: "jittered" }, "backoff-class-invalid"],
    [{ ...POLICY_INPUT, eligibilityCategories: [] }, "eligibility-empty"],
    [{ ...POLICY_INPUT, eligibilityCategories: ["TOOL_GAP", "TOOL_GAP"] }, "eligibility-duplicate"],
    [{ ...POLICY_INPUT, eligibilityCategories: ["BUDGET_GAP"] }, "eligibility-category-invalid"],
  ];
  for (const [input, reason] of cases) {
    const refused = service.registerRetryPolicy(SOLUTION, input as typeof POLICY_INPUT);
    assert.ok(!refused.ok, reason);
    assert.equal(refused.error.code, "YOU_RETRY_POLICY_INVALID");
    assert.equal(refused.error.details["reason"], reason);
    assert.equal(refused.error.simulated, true);
  }
  const registered = service.registerRetryPolicy(SOLUTION, POLICY_INPUT);
  assert.ok(registered.ok);
  const head = service.activePolicyOf(SOLUTION);
  assert.ok(head.ok);
  assert.equal(head.value.policy.maxAttempts, 2);
});

test("the full escalation lifecycle walks the v1 ladder end-to-end", () => {
  const fixture = fixtureWithPolicyAndProvider("lifecycle");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-1");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-2");
  const requested = fixture.service.requestEscalation(SOLUTION, fixture.gap.id);
  assert.ok(requested.ok);
  const escalationId = requested.value.gap.arenaEscalationRef?.escalationId ?? "";
  assert.equal(requested.value.gap.arenaEscalationRef?.status, "requested");
  assert.equal(requested.value.gap.escalationEligibility, "escalated");
  assert.deepEqual(requested.value.gap.arenaEscalationRef?.minimumContext, ARENA_MINIMUM_CONTEXT);
  const granted = fixture.service.grantAuthorization(SOLUTION, escalationId, {
    authorizedBy: "you_user_0000000000000001",
    scope: "arena:tool-gap-remediation",
    expiresAt: null,
    learningPermission: "aggregate",
  });
  assert.ok(granted.ok);
  assert.equal(granted.value.gap.arenaEscalationRef?.status, "authorized");
  const started = fixture.service.startEscalationSession(SOLUTION, escalationId);
  assert.ok(started.ok);
  assert.equal(started.value.gap.arenaEscalationRef?.status, "in-progress");
  const provider = fixture.service.arenaProvidersOf(SOLUTION);
  assert.ok(provider.ok);
  const providerId = provider.value.providers[0]?.id ?? "";
  const delivered = fixture.service.deliverEscalationResult(SOLUTION, escalationId, { providerId });
  assert.ok(delivered.ok);
  assert.equal(delivered.value.gap.arenaEscalationRef?.status, "delivered");
  assert.equal(delivered.value.gap.arenaEscalationRef?.expertResult?.resultType, "typed-payload");
  assert.match(delivered.value.contentHash, /^[0-9a-f]{64}$/);
  // ARENA BOUNDARY LAW: the result returns as a typed payload (operations
  // included); the service never applies it itself.
  const payload = fixture.service.escalationResultPayload(SOLUTION, escalationId);
  assert.ok(payload.ok);
  assert.equal(payload.value.operations.length, 1);
  assert.equal(payload.value.operations[0]?.op, "adjust_quality");
  const marked = fixture.service.markEscalationResultApplied(SOLUTION, escalationId, "you_change-set_0000000000000001");
  assert.ok(marked.ok);
  assert.equal(marked.value.gap.arenaEscalationRef?.status, "applied");
  assert.equal(marked.value.gap.arenaEscalationRef?.expertResult?.appliesAsChangeSetId, "you_change-set_0000000000000001");
  // Terminals lock: further lifecycle moves are typed refusals.
  const overApplied = fixture.service.markEscalationResultApplied(SOLUTION, escalationId, "you_change-set_2");
  assert.ok(!overApplied.ok);
  assert.equal(overApplied.error.code, "YOU_ESCALATION_STATE_INVALID");
  const rejectedAfterApplied = fixture.service.rejectEscalationResult(SOLUTION, escalationId);
  assert.ok(!rejectedAfterApplied.ok);
  assert.equal(rejectedAfterApplied.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(rejectedAfterApplied.error.details["reason"], "reject-requires-delivered-status");
});

test("THE LAW: an escalation never runs without an active, in-scope, unexpired authorization", () => {
  const fixture = fixtureWithPolicyAndProvider("the-law");
  const requested = fixture.service.requestEscalation(SOLUTION, fixture.gap.id);
  assert.ok(requested.ok);
  const escalationId = requested.value.gap.arenaEscalationRef?.escalationId ?? "";
  // Unauthorized escalation path (no grant): typed refusal.
  const unauthorized = fixture.service.startEscalationSession(SOLUTION, escalationId);
  assert.ok(!unauthorized.ok);
  assert.equal(unauthorized.error.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(unauthorized.error.details["reason"], "authorization-required");
  assert.equal(unauthorized.error.simulated, true);
  // The same refusal fires under a policy with requiresAuthorization: false —
  // the law outranks the flag (a false flag cannot waive the law).
  const lenient = createFixture("the-law-lenient");
  const lenientPolicy = lenient.service.registerRetryPolicy(SOLUTION, { ...POLICY_INPUT, requiresAuthorization: false });
  assert.ok(lenientPolicy.ok);
  const lenientRequested = lenient.service.requestEscalation(SOLUTION, lenient.gap.id);
  assert.ok(lenientRequested.ok);
  const lenientEscalationId = lenientRequested.value.gap.arenaEscalationRef?.escalationId ?? "";
  const lenientUnauthorized = lenient.service.startEscalationSession(SOLUTION, lenientEscalationId);
  assert.ok(!lenientUnauthorized.ok);
  assert.equal(lenientUnauthorized.error.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  // A scope mismatch refuses with the same typed code.
  const granted = fixture.service.grantAuthorization(SOLUTION, escalationId, {
    authorizedBy: "you_user_0000000000000001",
    scope: "arena:tool-gap-remediation",
    expiresAt: null,
    learningPermission: "none",
  });
  assert.ok(granted.ok);
  const outOfScope = fixture.service.startEscalationSession(SOLUTION, escalationId, { requestedScope: "arena:other-scope" });
  assert.ok(!outOfScope.ok);
  assert.equal(outOfScope.error.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(outOfScope.error.details["reason"], "authorization-scope-mismatch");
  // In-scope start succeeds.
  const started = fixture.service.startEscalationSession(SOLUTION, escalationId, { requestedScope: "arena:tool-gap-remediation" });
  assert.ok(started.ok);
});

test("expired authorization refuses the escalation path; expiry materializes a new record", () => {
  const fixture = fixtureWithPolicyAndProvider("expiry");
  // expiresAt at a fixed future tick: the deterministic clock advances 1s per
  // read, so a grant expiring at +5s covers a handful of reads.
  const granted = escalateWithGrant(fixture.service, fixture.gap.id, {
    expiresAt: "2026-01-01T00:00:05.000Z",
    permission: "aggregate",
  });
  const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
  // Burn clock ticks until the grant is due (each service read consumes one
  // 1000ms step; the clock epoch is 2026-01-01T00:00:00.000Z).
  for (let tick = 0; tick < 8; tick += 1) {
    fixture.service.ledgerEventsOf(SOLUTION);
  }
  const refused = fixture.service.startEscalationSession(SOLUTION, escalationId);
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_ESCALATION_AUTHORIZATION_REQUIRED");
  assert.equal(refused.error.details["reason"], "authorization-expired");
  // Materializing expiry appends a NEW entry and cancels the stalled escalation.
  const chainBefore = fixture.service.authorizationChainOf(SOLUTION, escalationId);
  assert.ok(chainBefore.ok);
  const grantRecordBefore = chainBefore.value.entries[0]?.authorization;
  const expired = fixture.service.expireAuthorization(SOLUTION, escalationId);
  assert.ok(expired.ok);
  assert.equal(expired.value.entry.status, "expired");
  assert.equal(expired.value.gap.arenaEscalationRef?.status, "cancelled");
  // The original grant record is byte-identical (immutable; new records on change).
  const chainAfter = fixture.service.authorizationChainOf(SOLUTION, escalationId);
  assert.ok(chainAfter.ok);
  assert.equal(chainAfter.value.entries.length, 2);
  assert.equal(stableStringify(chainAfter.value.entries[0]?.authorization), stableStringify(grantRecordBefore));
  assert.equal(chainAfter.value.entries[0]?.status, "active"); // as recorded
  // Expiry is not idempotent: the head is no longer active.
  const again = fixture.service.expireAuthorization(SOLUTION, escalationId);
  assert.ok(!again.ok);
  assert.equal(again.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(again.error.details["reason"], "authorization-not-active");
  // A not-yet-due authorization refuses materialization.
  const fresh = fixtureWithPolicyAndProvider("expiry-not-due");
  const freshGrant = escalateWithGrant(fresh.service, fresh.gap.id, { expiresAt: "2026-01-01T00:10:00.000Z" });
  const notDue = fresh.service.expireAuthorization(SOLUTION, freshGrant.gap.arenaEscalationRef?.escalationId ?? "");
  assert.ok(!notDue.ok);
  assert.equal(notDue.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(notDue.error.details["reason"], "authorization-not-due");
});

test("withdrawal appends a new record and cancels the escalation; nothing mutates in place", () => {
  const fixture = fixtureWithPolicyAndProvider("withdrawal");
  const granted = escalateWithGrant(fixture.service, fixture.gap.id, { permission: "aggregate" });
  const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
  const chainBefore = fixture.service.authorizationChainOf(SOLUTION, escalationId);
  assert.ok(chainBefore.ok);
  const grantJson = stableStringify(chainBefore.value.entries[0]?.authorization);
  const withdrawn = fixture.service.withdrawAuthorization(SOLUTION, escalationId, "user-changed-mind");
  assert.ok(withdrawn.ok);
  assert.equal(withdrawn.value.entry.status, "withdrawn");
  assert.equal(withdrawn.value.entry.reason, "user-changed-mind");
  assert.equal(withdrawn.value.gap.arenaEscalationRef?.status, "cancelled");
  // The chain grew by a new entry; the grant record is byte-identical.
  const chainAfter = fixture.service.authorizationChainOf(SOLUTION, escalationId);
  assert.ok(chainAfter.ok);
  assert.equal(chainAfter.value.entries.length, 2);
  assert.equal(stableStringify(chainAfter.value.entries[0]?.authorization), grantJson);
  // The cancelled escalation is terminal: withdrawal again refuses.
  const again = fixture.service.withdrawAuthorization(SOLUTION, escalationId);
  assert.ok(!again.ok);
  assert.equal(again.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(again.error.details["reason"], "authorization-not-active");
});

test("unknown escalations and authorizations are typed YOU_ESCALATION_NOT_FOUND", () => {
  const fixture = createFixture("not-found");
  const missing = "you_escalation_missing";
  for (const result of [
    fixture.service.grantAuthorization(SOLUTION, missing, {
      authorizedBy: "you_user_1",
      scope: "arena:x",
      expiresAt: null,
      learningPermission: "none",
    }),
    fixture.service.startEscalationSession(SOLUTION, missing),
    fixture.service.deliverEscalationResult(SOLUTION, missing, { providerId: "you_arena-provider_x" }),
    fixture.service.escalationResultPayload(SOLUTION, missing),
    fixture.service.markEscalationResultApplied(SOLUTION, missing, "you_change-set_1"),
    fixture.service.rejectEscalationResult(SOLUTION, missing),
    fixture.service.withdrawAuthorization(SOLUTION, missing),
    fixture.service.expireAuthorization(SOLUTION, missing),
    fixture.service.recordLearningPermission(SOLUTION, missing, "full"),
    fixture.service.escalationOf(SOLUTION, missing),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_ESCALATION_NOT_FOUND");
    assert.equal(result.error.details["reason"], "unknown-escalation");
    assert.equal(result.error.simulated, true);
  }
  // An escalation that exists but carries no authorization chain.
  const requested = fixture.service.requestEscalation(SOLUTION, fixture.gap.id);
  assert.ok(requested.ok);
  const escalationId = requested.value.gap.arenaEscalationRef?.escalationId ?? "";
  const noChain = fixture.service.withdrawAuthorization(SOLUTION, escalationId);
  assert.ok(!noChain.ok);
  assert.equal(noChain.error.code, "YOU_ESCALATION_NOT_FOUND");
  assert.equal(noChain.error.details["reason"], "unknown-authorization");
});

test("escalation ladder violations are typed YOU_ESCALATION_STATE_INVALID with stable reasons", () => {
  const fixture = fixtureWithPolicyAndProvider("ladder-refusals");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-1");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-2");
  const requested = fixture.service.requestEscalation(SOLUTION, fixture.gap.id);
  assert.ok(requested.ok);
  const escalationId = requested.value.gap.arenaEscalationRef?.escalationId ?? "";
  // Double request refuses.
  const twice = fixture.service.requestEscalation(SOLUTION, fixture.gap.id);
  assert.ok(!twice.ok);
  assert.equal(twice.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(twice.error.details["reason"], "escalation-already-requested");
  // Delivery on "requested" (no authorization, not in-progress) refuses.
  const earlyDelivery = fixture.service.deliverEscalationResult(SOLUTION, escalationId, { providerId: "you_arena-provider_x" });
  assert.ok(!earlyDelivery.ok);
  assert.equal(earlyDelivery.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(earlyDelivery.error.details["reason"], "deliver-requires-in-progress-status");
  // Grant on an already-authorized escalation refuses.
  const granted = fixture.service.grantAuthorization(SOLUTION, escalationId, {
    authorizedBy: "you_user_1",
    scope: "arena:x",
    expiresAt: null,
    learningPermission: "none",
  });
  assert.ok(granted.ok);
  const regrant = fixture.service.grantAuthorization(SOLUTION, escalationId, {
    authorizedBy: "you_user_1",
    scope: "arena:x",
    expiresAt: null,
    learningPermission: "none",
  });
  assert.ok(!regrant.ok);
  assert.equal(regrant.error.code, "YOU_ESCALATION_STATE_INVALID");
  assert.equal(regrant.error.details["reason"], "grant-requires-requested-status");
  // Authorization intake refusals are typed YOU_INVALID_STATE with the validator's reason
  // (a fresh requested escalation carries the intake to the validator).
  const intakeGap = fixture.service.recordCapabilityGap(SOLUTION, {
    ...GAP_INPUT,
    suggestedNextAction: "intake-gap",
  });
  assert.ok(intakeGap.ok);
  const intakeRequested = fixture.service.requestEscalation(SOLUTION, intakeGap.value.gap.id);
  assert.ok(intakeRequested.ok);
  const intakeEscalationId = intakeRequested.value.gap.arenaEscalationRef?.escalationId ?? "";
  const badGrant = fixture.service.grantAuthorization(SOLUTION, intakeEscalationId, {
    authorizedBy: "you_user_1",
    scope: "",
    expiresAt: null,
    learningPermission: "none",
  });
  assert.ok(!badGrant.ok);
  assert.equal(badGrant.error.code, "YOU_INVALID_STATE");
  assert.equal(badGrant.error.details["reason"], "invalid-authorization-intake");
  assert.equal(badGrant.error.details["refusal"], "scope-empty");
  // A not-eligible gap refuses escalation (the v1 rule).
  const weakGap = fixture.service.recordCapabilityGap(SOLUTION, {
    ...GAP_INPUT,
    confidence: 0.1,
    attemptedStrategies: [{ strategy: "search", outcome: "failed" }],
  });
  assert.ok(weakGap.ok);
  assert.equal(weakGap.value.gap.escalationEligibility, "not-eligible");
  const notEligible = fixture.service.requestEscalation(SOLUTION, weakGap.value.gap.id);
  assert.ok(!notEligible.ok);
  assert.equal(notEligible.error.code, "YOU_CAPABILITY_GAP");
  assert.equal(notEligible.error.details["reason"], "not-eligible");
});

test("learning permission changes append new grant records (never mutation)", () => {
  const fixture = fixtureWithPolicyAndProvider("permission-change");
  const granted = escalateWithGrant(fixture.service, fixture.gap.id, { permission: "aggregate" });
  const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
  const changed = fixture.service.recordLearningPermission(SOLUTION, escalationId, "full");
  assert.ok(changed.ok);
  assert.equal(changed.value.authorization.learningPermission, "full");
  assert.notEqual(changed.value.authorization.id, granted.authorizationId);
  const chain = fixture.service.authorizationChainOf(SOLUTION, escalationId);
  assert.ok(chain.ok);
  assert.equal(chain.value.entries.length, 2);
  // The head carries the new permission; the superseded entry keeps the old.
  const head = fixture.service.activeAuthorizationOf(SOLUTION, escalationId);
  assert.ok(head.ok);
  assert.equal(head.value.entry.authorization.learningPermission, "full");
  assert.equal(head.value.effectiveStatus, "active");
  // An unsanctioned permission refuses intake.
  const invalid = fixture.service.recordLearningPermission(SOLUTION, escalationId, "partial" as never);
  assert.ok(!invalid.ok);
  assert.equal(invalid.error.code, "YOU_INVALID_STATE");
  assert.equal(invalid.error.details["reason"], "learning-permission-invalid");
  // The learning-permission events ride the ledger.
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const permissionEvents = events.value.filter((event) => event.type === "learning-permission-recorded");
  assert.equal(permissionEvents.length, 2);
  assert.equal(permissionEvents[0]?.payload["supersededAuthorizationId"], "");
  assert.equal(permissionEvents[1]?.payload["supersededAuthorizationId"], granted.authorizationId);
  assert.equal(permissionEvents[1]?.payload["learningPermission"], "full");
});

test("the client boundary fails closed on unknown providers (typed YOU_ARENA_ADAPTER_UNSUPPORTED)", () => {
  const fixture = fixtureWithPolicyAndProvider("provider-fail-closed");
  const granted = escalateWithGrant(fixture.service, fixture.gap.id, { permission: "aggregate" });
  const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
  const started = fixture.service.startEscalationSession(SOLUTION, escalationId);
  assert.ok(started.ok);
  const refused = fixture.service.deliverEscalationResult(SOLUTION, escalationId, {
    providerId: "you_arena-provider_missing00000",
  });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  assert.equal(refused.error.details["reason"], "provider-unknown");
  assert.equal(refused.error.details["providerId"], "you_arena-provider_missing00000");
  assert.equal(refused.error.simulated, true);
  // Provider reads fail closed with the same typed code.
  const unknownRead = fixture.service.arenaProviderOf(SOLUTION, "you_arena-provider_missing00000");
  assert.ok(!unknownRead.ok);
  assert.equal(unknownRead.error.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  // A capability mismatch also refuses (the fixture provider serves TOOL_GAP +
  // KNOWLEDGE_GAP; an EDITOR_GAP escalation is out of its classes).
  const editorGap = fixture.service.recordCapabilityGap(SOLUTION, {
    ...GAP_INPUT,
    category: "EDITOR_GAP",
    suggestedNextAction: "editor-substitution",
  });
  assert.ok(editorGap.ok);
  const editorGrant = escalateWithGrant(fixture.service, editorGap.value.gap.id, { permission: "none" });
  const editorEscalationId = editorGrant.gap.arenaEscalationRef?.escalationId ?? "";
  const editorStarted = fixture.service.startEscalationSession(SOLUTION, editorEscalationId);
  assert.ok(editorStarted.ok);
  const providerId = providerIdOf(fixture);
  const mismatched = fixture.service.deliverEscalationResult(SOLUTION, editorEscalationId, { providerId });
  assert.ok(!mismatched.ok);
  assert.equal(mismatched.error.code, "YOU_ARENA_ADAPTER_UNSUPPORTED");
  assert.equal(mismatched.error.details["reason"], "provider-capability-mismatch");
});

test("gap projections publish with category gates (typed YOU_GAP_PROJECTION_INVALID)", () => {
  const fixture = createFixture("projections");
  const tool = fixture.service.publishToolGapProjection(SOLUTION, fixture.gap.id);
  assert.ok(tool.ok);
  assert.equal(tool.value.projection.requiredCapability, "substitute-gltf-pipeline");
  assert.equal(tool.value.projection.toolId, null);
  const knowledgeGap = fixture.service.recordCapabilityGap(SOLUTION, {
    ...GAP_INPUT,
    category: "KNOWLEDGE_GAP",
    suggestedNextAction: "human-proportion-rules",
  });
  assert.ok(knowledgeGap.ok);
  const knowledge = fixture.service.publishKnowledgeGapProjection(SOLUTION, knowledgeGap.value.gap.id);
  assert.ok(knowledge.ok);
  assert.equal(knowledge.value.projection.domain, "human-proportion-rules");
  assert.equal(knowledge.value.projection.missingKnowledgeRef, null);
  // Category gates refuse the wrong kind.
  const wrongKind = fixture.service.publishKnowledgeGapProjection(SOLUTION, fixture.gap.id);
  assert.ok(!wrongKind.ok);
  assert.equal(wrongKind.error.code, "YOU_GAP_PROJECTION_INVALID");
  assert.equal(wrongKind.error.details["reason"], "category-not-knowledge-gap");
  const wrongTool = fixture.service.publishToolGapProjection(SOLUTION, knowledgeGap.value.gap.id);
  assert.ok(!wrongTool.ok);
  assert.equal(wrongTool.error.code, "YOU_GAP_PROJECTION_INVALID");
  assert.equal(wrongTool.error.details["reason"], "category-not-tool-gap");
  const unknownGap = fixture.service.publishToolGapProjection(SOLUTION, "you_gap_missing");
  assert.ok(!unknownGap.ok);
  assert.equal(unknownGap.error.code, "YOU_INVALID_STATE");
  // Both projection events ride the ledger.
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const published = events.value.filter((event) => event.type === "gap-projection-published");
  assert.equal(published.length, 2);
});

test("the live projection equals the ledger replay exactly (append-only state reproduction)", () => {
  const fixture = fixtureWithPolicyAndProvider("projection-equality");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-1");
  startAndFailRun(fixture.service, fixture.gap.id, "attempt-2");
  const granted = escalateWithGrant(fixture.service, fixture.gap.id, { expiresAt: "2026-01-01T00:10:00.000Z", permission: "aggregate" });
  const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
  const started = fixture.service.startEscalationSession(SOLUTION, escalationId);
  assert.ok(started.ok);
  const providerId = providerIdOf(fixture);
  const delivered = fixture.service.deliverEscalationResult(SOLUTION, escalationId, { providerId });
  assert.ok(delivered.ok);
  const marked = fixture.service.markEscalationResultApplied(SOLUTION, escalationId, "you_change-set_0000000000000001");
  assert.ok(marked.ok);
  const permissionChange = fixture.service.recordLearningPermission(SOLUTION, escalationId, "full");
  assert.ok(permissionChange.ok);
  const toolProjection = fixture.service.publishToolGapProjection(SOLUTION, fixture.gap.id);
  assert.ok(toolProjection.ok);
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const live = fixture.service.projectionOf(SOLUTION);
  assert.ok(live.ok);
  const replay = ArenaService.replay(events.value);
  assert.equal(stableStringify(live.value), stableStringify(replay));
  // The wave-8 events are all present in the ledger.
  const types = new Set<string>(events.value.map((event) => event.type));
  for (const expected of [
    "capability-gap-detected",
    "arena-run-recorded",
    "arena-escalation-requested",
    "escalation-authorized",
    "learning-permission-recorded",
    "arena-result-applied",
    "gap-projection-published",
  ]) {
    assert.ok(types.has(expected), expected);
  }
  // The replayed escalation head reflects the applied terminal.
  assert.equal(replay.escalations[escalationId]?.status, "applied");
  assert.equal(replay.escalations[escalationId]?.authorizationId, permissionChange.value.authorization.id);
});

test("rejection walks delivered -> rejected with a typed reason on the ledger", () => {
  const fixture = fixtureWithPolicyAndProvider("rejection");
  const granted = escalateWithGrant(fixture.service, fixture.gap.id, { permission: "aggregate" });
  const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
  const started = fixture.service.startEscalationSession(SOLUTION, escalationId);
  assert.ok(started.ok);
  const providerId = providerIdOf(fixture);
  const delivered = fixture.service.deliverEscalationResult(SOLUTION, escalationId, { providerId });
  assert.ok(delivered.ok);
  const rejected = fixture.service.rejectEscalationResult(SOLUTION, escalationId, "quality-insufficient");
  assert.ok(rejected.ok);
  assert.equal(rejected.value.gap.arenaEscalationRef?.status, "rejected");
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const rejection = events.value.find((event) => event.type === "arena-result-applied" && event.payload["escalationStatusAfter"] === "rejected");
  assert.ok(rejection !== undefined);
  assert.equal(rejection.payload["reason"], "quality-insufficient");
  assert.equal(rejection.payload["changeSetId"], "");
});

test("determinism: the same seed produces a byte-identical ledger", () => {
  const run = (seed: string): string => {
    const fixture = fixtureWithPolicyAndProvider(seed);
    startAndFailRun(fixture.service, fixture.gap.id, "attempt-1");
    startAndFailRun(fixture.service, fixture.gap.id, "attempt-2");
    const granted = escalateWithGrant(fixture.service, fixture.gap.id, { permission: "aggregate" });
    const escalationId = granted.gap.arenaEscalationRef?.escalationId ?? "";
    const started = fixture.service.startEscalationSession(SOLUTION, escalationId);
    assert.ok(started.ok);
    const providerId = providerIdOf(fixture);
    const delivered = fixture.service.deliverEscalationResult(SOLUTION, escalationId, { providerId });
    assert.ok(delivered.ok);
    const marked = fixture.service.markEscalationResultApplied(SOLUTION, escalationId, "you_change-set_0000000000000001");
    assert.ok(marked.ok);
    const hash = fixture.service.ledgerHashOf(SOLUTION);
    assert.ok(hash.ok);
    return hash.value;
  };
  assert.equal(run("determinism-seed"), run("determinism-seed"));
  assert.notEqual(run("determinism-seed"), run("determinism-other"));
});
