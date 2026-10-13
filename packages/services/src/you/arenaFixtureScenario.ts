// YOU W8A arena fixture scenario — scripted, deterministic orchestration
// of the full arena arrow (docs/you/WORK_ORDERS.md W8A; FIXTURES.md):
//
//   provider registration -> retry policy registration (+ invalid-policy
//   refusals) -> gap one (TOOL_GAP) detected -> run ladder recorded
//   (fail, fail, attempt-gate refusal) -> escalation requested ->
//   unauthorized-escalation refusal -> authorization granted (scope/
//   no-expiry/aggregate) -> session started -> unknown-provider refusal ->
//   invalid-transition refusals -> result delivered through the client
//   boundary (content-addressed) -> typed payload returned (the boundary
//   law — the caller applies) -> result applied -> learning permission
//   recorded (aggregate -> full, new records on change) -> gap two
//   (KNOWLEDGE_GAP) recorded -> run recorded -> escalation -> short-lived
//   grant -> ticks burned -> expired-authorization refusal -> expiry
//   materialized (new record; escalation cancelled) -> knowledge-gap
//   projection published -> gap three (EXPERT_GAP) recorded -> escalation
//   -> grant -> withdrawal (new record; escalation cancelled) ->
//   tool-gap projection published (+ invalid-projection refusal) ->
//   ledger readout (all five wave-8 events present; projection ==
//   replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation). Fixture gaps/runs/escalations/
// authorizations stay `simulated: true` (truth law).

import type { OpaqueId, SolutionEvent } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createArenaService, ArenaService, type ArenaGapIntakeInput } from "./arenaService.js";
import {
  ARENA_SCENARIO_CHANGE_SET_ID,
  ARENA_SCENARIO_GAP_INPUT,
  ARENA_SCENARIO_GAP_THREE_INPUT,
  ARENA_SCENARIO_GAP_TWO_EXPIRES_AT,
  ARENA_SCENARIO_GAP_TWO_INPUT,
  ARENA_SCENARIO_GRANT_INPUT,
  ARENA_SCENARIO_POLICY_INPUT,
  ARENA_SCENARIO_PROVIDER_INPUT,
  ARENA_SCENARIO_SEED,
  ARENA_SCENARIO_SOLUTION_ID,
  ARENA_SCENARIO_TICKS_TO_BURN,
  outcomeCode,
  type ArenaScenarioOptions,
  type ArenaScenarioStep,
  type ArenaScenarioTrace,
} from "./arenaFixtureScenarioTypes.js";

export {
  ARENA_SCENARIO_CHANGE_SET_ID,
  ARENA_SCENARIO_GAP_INPUT,
  ARENA_SCENARIO_GAP_THREE_INPUT,
  ARENA_SCENARIO_GAP_TWO_EXPIRES_AT,
  ARENA_SCENARIO_GAP_TWO_INPUT,
  ARENA_SCENARIO_GRANT_INPUT,
  ARENA_SCENARIO_POLICY_INPUT,
  ARENA_SCENARIO_PROVIDER_INPUT,
  ARENA_SCENARIO_SEED,
  ARENA_SCENARIO_SOLUTION_ID,
  ARENA_SCENARIO_TICKS_TO_BURN,
} from "./arenaFixtureScenarioTypes.js";
export type { ArenaScenarioOptions, ArenaScenarioStep, ArenaScenarioTrace } from "./arenaFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): ArenaScenarioStep {
  return { step: index, name, facts };
}

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

/**
 * Runs the full scripted arena scenario against a freshly created
 * service. Deterministic: same seed + same options => identical trace.
 */
export function runArenaFixtureScenario(options: ArenaScenarioOptions = {}): ArenaScenarioTrace {
  const solutionId = options.solutionId ?? ARENA_SCENARIO_SOLUTION_ID;
  // The scenario owns the injected clock (it burns ticks deterministically
  // to walk the gap-two authorization past its expiry).
  const clock: DeterministicClock = createDeterministicClock();
  const service = createArenaService({
    workspaceIdentity: "ws-w8a-scenario-arena",
    seed: options.seed ?? ARENA_SCENARIO_SEED,
    clock,
  });

  const steps: ArenaScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};

  // -- provider + policy registration (+ invalid-policy refusals) ----------

  const provider = must(
    service.registerArenaProvider(solutionId, { ...ARENA_SCENARIO_PROVIDER_INPUT }),
    "registerArenaProvider",
  );
  steps.push(
    step((stepIndex += 1), "provider-registered", {
      providerId: provider.provider.id,
      providerKind: provider.provider.providerKind,
      capabilityClassCount: provider.provider.capabilityClasses.length,
      endpointRefIsNull: provider.provider.endpointRef === null,
    }),
  );

  const policy = must(service.registerRetryPolicy(solutionId, { ...ARENA_SCENARIO_POLICY_INPUT }), "registerRetryPolicy");
  steps.push(
    step((stepIndex += 1), "retry-policy-registered", {
      maxAttempts: policy.policy.maxAttempts,
      backoffClass: policy.policy.backoffClass,
      eligibilityCount: policy.policy.eligibilityCategories.length,
      requiresAuthorization: policy.policy.requiresAuthorization,
    }),
  );

  const invalidPolicyZero = service.registerRetryPolicy(solutionId, {
    ...ARENA_SCENARIO_POLICY_INPUT,
    maxAttempts: 0,
  });
  refusalOutcomes["policy-max-attempts-zero"] = outcomeCode(invalidPolicyZero);
  const invalidPolicyBackoff = service.registerRetryPolicy(solutionId, {
    ...ARENA_SCENARIO_POLICY_INPUT,
    backoffClass: "jittered",
  });
  refusalOutcomes["policy-backoff-invalid"] = outcomeCode(invalidPolicyBackoff);
  const invalidPolicyCategories = service.registerRetryPolicy(solutionId, {
    ...ARENA_SCENARIO_POLICY_INPUT,
    eligibilityCategories: [],
  });
  refusalOutcomes["policy-eligibility-empty"] = outcomeCode(invalidPolicyCategories);
  steps.push(
    step((stepIndex += 1), "invalid-policy-refusals", {
      ...refusalOutcomes,
      refusalCount: 3,
    }),
  );

  // -- gap one detected (the v1 linkage) -----------------------------------

  const gapOne = must(service.recordCapabilityGap(solutionId, ARENA_SCENARIO_GAP_INPUT as ArenaGapIntakeInput), "recordGapOne");
  const gapOneId = gapOne.gap.id;
  steps.push(
    step((stepIndex += 1), "gap-detected", {
      gapId: gapOneId,
      category: gapOne.gap.category,
      confidence: gapOne.gap.confidence,
      escalationEligibility: gapOne.gap.escalationEligibility,
      intentRef: gapOne.gap.intentRef ?? "",
      strategyCount: gapOne.gap.attemptedStrategies.length,
      failureEvidenceCount: gapOne.gap.failureEvidence.length,
    }),
  );

  // -- the run ladder (fail, fail, attempt-gate refusal) --------------------

  const runIds: OpaqueId[] = [];
  const ladderWalk: string[] = [];
  for (const attempt of [1, 2]) {
    const strategy = `fixture-strategy-${attempt}`;
    const started = must(service.startArenaRun(solutionId, gapOneId, { strategy }), `startRun${attempt}`);
    runIds.push(started.run.id);
    ladderWalk.push(started.run.status);
    const failed = must(
      service.failArenaRun(solutionId, started.run.id, { outcomeEvidenceRef: `you_evidence_run${attempt}` }),
      `failRun${attempt}`,
    );
    ladderWalk.push(failed.run.status);
  }
  const attemptRefused = service.startArenaRun(solutionId, gapOneId, { strategy: "fixture-strategy-3" });
  refusalOutcomes["run-attempt-exceeds-max"] = outcomeCode(attemptRefused);
  steps.push(
    step((stepIndex += 1), "run-ladder-recorded", {
      runCount: runIds.length,
      ladderWalk: ladderWalk.join("->"),
      attempt: 3,
      attemptRefused: outcomeCode(attemptRefused),
    }),
  );

  // -- escalation requested + the unauthorized-escalation refusal ----------

  const requestedOne = must(service.requestEscalation(solutionId, gapOneId), "requestEscalationOne");
  const escalationOneId = requestedOne.gap.arenaEscalationRef?.escalationId ?? "";
  ladderWalk.push("requested");
  steps.push(
    step((stepIndex += 1), "escalation-requested", {
      escalationId: escalationOneId,
      gapId: gapOneId,
      status: requestedOne.gap.arenaEscalationRef?.status ?? "",
      escalationEligibility: requestedOne.gap.escalationEligibility,
    }),
  );

  const unauthorized = service.startEscalationSession(solutionId, escalationOneId);
  refusalOutcomes["unauthorized-escalation"] = outcomeCode(unauthorized);

  // -- authorization granted (scope / no expiry / aggregate) ----------------

  const grantedOne = must(
    service.grantAuthorization(solutionId, escalationOneId, { ...ARENA_SCENARIO_GRANT_INPUT }),
    "grantAuthorizationOne",
  );
  const authorizationOneId = grantedOne.authorization.id;
  ladderWalk.push("authorized");
  steps.push(
    step((stepIndex += 1), "authorization-granted", {
      authorizationId: authorizationOneId,
      escalationId: escalationOneId,
      scope: grantedOne.authorization.scope,
      expiresAtIsNull: grantedOne.authorization.expiresAt === null,
      learningPermission: grantedOne.authorization.learningPermission,
      authorizedBy: grantedOne.authorization.authorizedBy,
      unauthorizedRefusal: refusalOutcomes["unauthorized-escalation"] ?? "",
    }),
  );

  // -- session started (the law gate satisfied) + unknown-provider refusal --

  const startedOne = must(service.startEscalationSession(solutionId, escalationOneId), "startEscalationOne");
  ladderWalk.push("in-progress");
  steps.push(
    step((stepIndex += 1), "escalation-started", {
      escalationId: escalationOneId,
      status: startedOne.gap.arenaEscalationRef?.status ?? "",
    }),
  );

  const unknownProvider = service.deliverEscalationResult(solutionId, escalationOneId, {
    providerId: "you_arena-provider_missing00000",
  });
  refusalOutcomes["unknown-provider"] = outcomeCode(unknownProvider);

  // -- invalid transitions before delivery -----------------------------------

  const applyTooEarly = service.markEscalationResultApplied(solutionId, escalationOneId, ARENA_SCENARIO_CHANGE_SET_ID);
  refusalOutcomes["apply-before-delivery"] = outcomeCode(applyTooEarly);

  // -- result delivered through the client boundary (content-addressed) -----

  const delivered = must(
    service.deliverEscalationResult(solutionId, escalationOneId, { providerId: provider.provider.id }),
    "deliverEscalationResultOne",
  );
  ladderWalk.push("delivered");
  steps.push(
    step((stepIndex += 1), "escalation-delivered", {
      escalationId: escalationOneId,
      resultType: delivered.delivery.resultType,
      contentRef: delivered.contentRef,
      contentHashPrefix: delivered.contentHash.slice(0, 16),
      providerId: provider.provider.id,
      unknownProviderRefusal: refusalOutcomes["unknown-provider"] ?? "",
    }),
  );

  // -- the boundary law: the typed payload returns; the caller applies ------

  const payload = must(service.escalationResultPayload(solutionId, escalationOneId), "escalationResultPayload");
  const operations = payload.operations;
  const applied = must(
    service.markEscalationResultApplied(solutionId, escalationOneId, ARENA_SCENARIO_CHANGE_SET_ID),
    "markEscalationResultAppliedOne",
  );
  ladderWalk.push("applied");
  steps.push(
    step((stepIndex += 1), "result-applied", {
      escalationId: escalationOneId,
      changeSetId: ARENA_SCENARIO_CHANGE_SET_ID,
      operationCount: operations.length,
      firstOperation: operations[0]?.op ?? "",
      appliesAsChangeSetId: applied.gap.arenaEscalationRef?.expertResult?.appliesAsChangeSetId ?? "",
    }),
  );

  const overApplied = service.rejectEscalationResult(solutionId, escalationOneId);
  refusalOutcomes["reject-after-applied"] = outcomeCode(overApplied);

  // -- learning permission recorded (aggregate -> full: new records) ---------

  const permissionTrail: string[] = [grantedOne.authorization.learningPermission];
  const permissionChanged = must(
    service.recordLearningPermission(solutionId, escalationOneId, "full"),
    "recordLearningPermissionOne",
  );
  permissionTrail.push(permissionChanged.authorization.learningPermission);
  steps.push(
    step((stepIndex += 1), "learning-permission-recorded", {
      escalationId: escalationOneId,
      permissionBefore: permissionTrail[0] ?? "",
      permissionAfter: permissionTrail[1] ?? "",
      newAuthorizationId: permissionChanged.authorization.id,
      supersededAuthorizationId: authorizationOneId,
    }),
  );

  // -- gap two: the authorization-expiry path ---------------------------------

  const gapTwo = must(service.recordCapabilityGap(solutionId, ARENA_SCENARIO_GAP_TWO_INPUT as ArenaGapIntakeInput), "recordGapTwo");
  const gapTwoId = gapTwo.gap.id;
  const runTwo = must(
    service.startArenaRun(solutionId, gapTwoId, { strategy: "rules-lookup" }),
    "startRunGapTwo",
  );
  runIds.push(runTwo.run.id);
  must(service.failArenaRun(solutionId, runTwo.run.id, {}), "failRunGapTwo");
  const requestedTwo = must(service.requestEscalation(solutionId, gapTwoId), "requestEscalationTwo");
  const escalationTwoId = requestedTwo.gap.arenaEscalationRef?.escalationId ?? "";
  const grantedTwo = must(
    service.grantAuthorization(solutionId, escalationTwoId, {
      authorizedBy: "you_user_0000000000000001",
      scope: "arena:knowledge-patch",
      expiresAt: ARENA_SCENARIO_GAP_TWO_EXPIRES_AT,
      learningPermission: "none",
    }),
    "grantAuthorizationTwo",
  );
  const authorizationTwoId = grantedTwo.authorization.id;
  steps.push(
    step((stepIndex += 1), "gap-two-escalation-granted", {
      gapId: gapTwoId,
      escalationId: escalationTwoId,
      authorizationId: authorizationTwoId,
      expiresAt: ARENA_SCENARIO_GAP_TWO_EXPIRES_AT,
      learningPermission: grantedTwo.authorization.learningPermission,
    }),
  );

  // Burn deterministic clock ticks past the expiry (the scenario owns the clock).
  for (let tick = 0; tick < ARENA_SCENARIO_TICKS_TO_BURN; tick += 1) {
    clock.now();
  }
  const expiredRefusal = service.startEscalationSession(solutionId, escalationTwoId);
  refusalOutcomes["expired-authorization"] = outcomeCode(expiredRefusal);
  const expired = must(service.expireAuthorization(solutionId, escalationTwoId), "expireAuthorizationTwo");
  const chainTwo = must(service.authorizationChainOf(solutionId, escalationTwoId), "authorizationChainTwo");
  const authorizationChainTwoStatuses = chainTwo.entries.map((entry) => entry.status);
  steps.push(
    step((stepIndex += 1), "authorization-expired", {
      escalationId: escalationTwoId,
      authorizationId: authorizationTwoId,
      expiredRefusal: refusalOutcomes["expired-authorization"] ?? "",
      chainLength: chainTwo.entries.length,
      headStatus: expired.entry.status,
      escalationStatusAfter: expired.gap.arenaEscalationRef?.status ?? "",
      grantRecordPreserved: chainTwo.entries[0]?.status === "active",
    }),
  );

  // -- knowledge-gap projection published --------------------------------------

  const knowledgeProjection = must(
    service.publishKnowledgeGapProjection(solutionId, gapTwoId),
    "publishKnowledgeGapProjection",
  );
  steps.push(
    step((stepIndex += 1), "knowledge-gap-projection-published", {
      projectionId: knowledgeProjection.projectionId,
      gapId: gapTwoId,
      domain: knowledgeProjection.projection.domain,
      remediation: knowledgeProjection.projection.remediation,
    }),
  );

  // -- gap three: the withdrawal path -------------------------------------------

  const gapThree = must(service.recordCapabilityGap(solutionId, ARENA_SCENARIO_GAP_THREE_INPUT as ArenaGapIntakeInput), "recordGapThree");
  const gapThreeId = gapThree.gap.id;
  const requestedThree = must(service.requestEscalation(solutionId, gapThreeId), "requestEscalationThree");
  const escalationThreeId = requestedThree.gap.arenaEscalationRef?.escalationId ?? "";
  const grantedThree = must(
    service.grantAuthorization(solutionId, escalationThreeId, {
      authorizedBy: "you_user_0000000000000001",
      scope: "arena:expert-correction",
      expiresAt: null,
      learningPermission: "none",
    }),
    "grantAuthorizationThree",
  );
  const authorizationThreeId = grantedThree.authorization.id;
  const withdrawn = must(
    service.withdrawAuthorization(solutionId, escalationThreeId, "user-withdrew-scenario"),
    "withdrawAuthorizationThree",
  );
  steps.push(
    step((stepIndex += 1), "authorization-withdrawn", {
      gapId: gapThreeId,
      escalationId: escalationThreeId,
      authorizationId: authorizationThreeId,
      headStatus: withdrawn.entry.status,
      escalationStatusAfter: withdrawn.gap.arenaEscalationRef?.status ?? "",
      reason: withdrawn.entry.reason,
    }),
  );

  // -- tool-gap projection + the invalid-projection refusal ---------------------

  const toolProjection = must(service.publishToolGapProjection(solutionId, gapOneId), "publishToolGapProjection");
  const wrongProjection = service.publishKnowledgeGapProjection(solutionId, gapOneId);
  refusalOutcomes["projection-wrong-category"] = outcomeCode(wrongProjection);
  steps.push(
    step((stepIndex += 1), "tool-gap-projection-published", {
      projectionId: toolProjection.projectionId,
      gapId: gapOneId,
      requiredCapability: toolProjection.projection.requiredCapability,
      remediation: toolProjection.projection.remediation,
      wrongProjectionRefusal: refusalOutcomes["projection-wrong-category"] ?? "",
    }),
  );

  // -- unknown run / unknown escalation refusals (error taxonomy) ----------------

  const unknownRun = service.runOf(solutionId, "you_arena-run_missing0000000000");
  refusalOutcomes["unknown-run"] = outcomeCode(unknownRun);
  const unknownEscalation = service.grantAuthorization(solutionId, "you_escalation_missing00000000000", {
    authorizedBy: "you_user_1",
    scope: "arena:x",
    expiresAt: null,
    learningPermission: "none",
  });
  refusalOutcomes["unknown-escalation"] = outcomeCode(unknownEscalation);
  steps.push(
    step((stepIndex += 1), "lookup-refusals", {
      "unknown-run": refusalOutcomes["unknown-run"] ?? "",
      "unknown-escalation": refusalOutcomes["unknown-escalation"] ?? "",
    }),
  );

  // -- ledger readout: all five wave-8 events, projection == replay --------------

  const events: readonly SolutionEvent[] = must(service.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }
  const live = must(service.projectionOf(solutionId), "projectionOf");
  const replay = ArenaService.replay(events);
  const projectionMatchesReplay = stableStringify(live) === stableStringify(replay);
  const ledgerHash = must(service.ledgerHashOf(solutionId), "ledgerHashOf");
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      arenaRunRecorded: eventCounts["arena-run-recorded"] ?? 0,
      escalationAuthorized: eventCounts["escalation-authorized"] ?? 0,
      escalationCancelled: eventCounts["escalation-cancelled"] ?? 0,
      learningPermissionRecorded: eventCounts["learning-permission-recorded"] ?? 0,
      gapProjectionPublished: eventCounts["gap-projection-published"] ?? 0,
    }),
  );

  return {
    solutionId,
    providerId: provider.provider.id,
    gapOneId,
    gapTwoId,
    gapThreeId,
    runIds,
    escalationOneId,
    escalationTwoId,
    escalationThreeId,
    authorizationOneId,
    authorizationTwoId,
    authorizationThreeId,
    ladderWalk,
    authorizationChainTwoStatuses,
    learningPermissionTrail: permissionTrail,
    refusalOutcomes,
    eventCounts,
    projectionCount: 2,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
