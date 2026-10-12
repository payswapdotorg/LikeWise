// YOU W7A embodiment fixture scenario — scripted, deterministic
// orchestration of the full embodiment arrow (docs/you/WORK_ORDERS.md W7A;
// FIXTURES.md):
//
//   body registration (content-addressed appearance) -> soul binding A ->
//   soul binding B -> session open -> full state-ladder walk -> suspend ->
//   resume -> close -> re-possession (session two on the same Body,
//   soul-reassigned A -> B) -> close two -> refusal paths (unknown body,
//   unknown soul, invalid soul intake, off-ladder state, no-op transition,
//   lifecycle-owned unavailable, terminal-locked close, unknown session) ->
//   ledger readout (projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation). Fixture bodies/souls/sessions stay
// `simulated: true` (truth law).

import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createEmbodimentService, EmbodimentService } from "./embodimentService.js";
import {
  EMBODIMENT_SCENARIO_APPEARANCE_SPEC,
  EMBODIMENT_SCENARIO_BODY_CAPABILITIES,
  EMBODIMENT_SCENARIO_BODY_POLICY_REFS,
  EMBODIMENT_SCENARIO_BODY_ROLE,
  EMBODIMENT_SCENARIO_BODY_TOOLS,
  EMBODIMENT_SCENARIO_EVALUATOR_CONTRACT_REF,
  EMBODIMENT_SCENARIO_LADDER_WALK,
  EMBODIMENT_SCENARIO_MEMORY_CONTRACT_REF,
  EMBODIMENT_SCENARIO_SEED,
  EMBODIMENT_SCENARIO_SOLUTION_ID,
  EMBODIMENT_SCENARIO_SOUL_A,
  EMBODIMENT_SCENARIO_SOUL_B,
  outcomeCode,
  type EmbodimentScenarioOptions,
  type EmbodimentScenarioStep,
  type EmbodimentScenarioTrace,
} from "./embodimentFixtureScenarioTypes.js";

export {
  EMBODIMENT_SCENARIO_APPEARANCE_SPEC,
  EMBODIMENT_SCENARIO_BODY_CAPABILITIES,
  EMBODIMENT_SCENARIO_BODY_POLICY_REFS,
  EMBODIMENT_SCENARIO_BODY_ROLE,
  EMBODIMENT_SCENARIO_BODY_TOOLS,
  EMBODIMENT_SCENARIO_EVALUATOR_CONTRACT_REF,
  EMBODIMENT_SCENARIO_LADDER_WALK,
  EMBODIMENT_SCENARIO_MEMORY_CONTRACT_REF,
  EMBODIMENT_SCENARIO_SEED,
  EMBODIMENT_SCENARIO_SOLUTION_ID,
  EMBODIMENT_SCENARIO_SOUL_A,
  EMBODIMENT_SCENARIO_SOUL_B,
} from "./embodimentFixtureScenarioTypes.js";
export type { EmbodimentScenarioOptions, EmbodimentScenarioStep, EmbodimentScenarioTrace } from "./embodimentFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): EmbodimentScenarioStep {
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
 * Runs the full scripted embodiment scenario against a freshly created
 * service. Deterministic: same seed + same options => identical trace.
 */
export function runEmbodimentFixtureScenario(options: EmbodimentScenarioOptions = {}): EmbodimentScenarioTrace {
  const solutionId = options.solutionId ?? EMBODIMENT_SCENARIO_SOLUTION_ID;
  const service: EmbodimentService = createEmbodimentService({
    workspaceIdentity: "ws-w7a-scenario-embodiment",
    seed: options.seed ?? EMBODIMENT_SCENARIO_SEED,
  });

  const steps: EmbodimentScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};

  // -- body registration ---------------------------------------------------

  const registered = must(
    service.registerBody(solutionId, {
      role: EMBODIMENT_SCENARIO_BODY_ROLE,
      appearance: { spec: EMBODIMENT_SCENARIO_APPEARANCE_SPEC },
      capabilities: [...EMBODIMENT_SCENARIO_BODY_CAPABILITIES],
      tools: [...EMBODIMENT_SCENARIO_BODY_TOOLS],
      policyRefs: [...EMBODIMENT_SCENARIO_BODY_POLICY_REFS],
      memoryContractRef: EMBODIMENT_SCENARIO_MEMORY_CONTRACT_REF,
      evaluatorContractRef: EMBODIMENT_SCENARIO_EVALUATOR_CONTRACT_REF,
    }),
    "registerBody",
  );
  const bodyId = registered.body.id;
  const appearanceAddressed = registered.body.appearanceRef !== null && registered.body.appearanceHash !== null;
  steps.push(
    step((stepIndex += 1), "body-registered", {
      bodyId,
      role: registered.body.role,
      appearanceAddressed,
      capabilityCount: registered.body.capabilities.length,
      toolCount: registered.body.tools.length,
      policyRefCount: registered.body.policyRefs.length,
    }),
  );

  // -- soul bindings -------------------------------------------------------

  const soulA = must(service.registerSoulBinding(solutionId, { ...EMBODIMENT_SCENARIO_SOUL_A }), "registerSoulBindingA");
  const soulB = must(service.registerSoulBinding(solutionId, { ...EMBODIMENT_SCENARIO_SOUL_B }), "registerSoulBindingB");
  steps.push(
    step((stepIndex += 1), "soul-bindings-registered", {
      soulBindingAId: soulA.soulBinding.id,
      soulBindingBId: soulB.soulBinding.id,
      routingProfileA: soulA.soulBinding.routingProfile,
      routingProfileB: soulB.soulBinding.routingProfile,
      providerKindA: soulA.soulBinding.providerKind,
      providerKindB: soulB.soulBinding.providerKind,
    }),
  );

  // -- session open + full state-ladder walk -------------------------------

  const opened = must(
    service.openAvatarSession(solutionId, { bodyId, soulBindingId: soulA.soulBinding.id }),
    "openAvatarSession",
  );
  const sessionOneId = opened.session.id;
  steps.push(
    step((stepIndex += 1), "avatar-session-opened", {
      sessionId: sessionOneId,
      bodyId,
      soulBindingId: soulA.soulBinding.id,
      status: opened.session.status,
      state: opened.session.state,
      simulated: opened.session.simulated,
    }),
  );

  const ladderWalkStates: string[] = [];
  for (let index = 1; index < EMBODIMENT_SCENARIO_LADDER_WALK.length; index += 1) {
    const from = EMBODIMENT_SCENARIO_LADDER_WALK[index - 1] ?? "idle";
    const to = EMBODIMENT_SCENARIO_LADDER_WALK[index] ?? "idle";
    const moved = must(service.transitionEmbodimentState(solutionId, sessionOneId, to), "transitionEmbodimentState");
    ladderWalkStates.push(moved.session.state);
    steps.push(
      step((stepIndex += 1), `ladder-walk:${from}->${to}`, {
        sessionId: sessionOneId,
        stateBefore: from,
        stateAfter: moved.session.state,
        status: moved.session.status,
      }),
    );
  }

  // -- suspend / resume ------------------------------------------------------

  const suspended = must(service.suspendAvatarSession(solutionId, sessionOneId), "suspendAvatarSession");
  steps.push(
    step((stepIndex += 1), "avatar-session-suspended", {
      sessionId: sessionOneId,
      status: suspended.session.status,
      state: suspended.session.state,
    }),
  );
  const resumed = must(service.resumeAvatarSession(solutionId, sessionOneId), "resumeAvatarSession");
  steps.push(
    step((stepIndex += 1), "avatar-session-resumed", {
      sessionId: sessionOneId,
      status: resumed.session.status,
      state: resumed.session.state,
    }),
  );

  // -- close session one -----------------------------------------------------

  const closedOne = must(service.closeAvatarSession(solutionId, sessionOneId), "closeAvatarSessionOne");
  steps.push(
    step((stepIndex += 1), "avatar-session-closed", {
      sessionId: sessionOneId,
      status: closedOne.session.status,
      state: closedOne.session.state,
      closedAt: closedOne.session.closedAt ?? "",
    }),
  );

  // -- re-possession: session two on the SAME Body, soul reassigned A -> B --

  const bodyBeforeRepossession = must(service.bodyOf(solutionId, bodyId), "bodyOfBefore");
  const openedTwo = must(
    service.openAvatarSession(solutionId, { bodyId, soulBindingId: soulA.soulBinding.id }),
    "openAvatarSessionTwo",
  );
  const sessionTwoId = openedTwo.session.id;
  steps.push(
    step((stepIndex += 1), "avatar-session-two-opened", {
      sessionId: sessionTwoId,
      bodyId,
      soulBindingId: soulA.soulBinding.id,
      status: openedTwo.session.status,
      state: openedTwo.session.state,
    }),
  );

  const bodyJsonBefore = stableStringify(bodyBeforeRepossession.body);
  const reassigned = must(service.reassignSoul(solutionId, sessionTwoId, soulB.soulBinding.id), "reassignSoul");
  const bodyAfterRepossession = must(service.bodyOf(solutionId, bodyId), "bodyOfAfter");
  const bodyPreserved = bodyJsonBefore === stableStringify(bodyAfterRepossession.body);
  steps.push(
    step((stepIndex += 1), "soul-reassigned", {
      sessionId: sessionTwoId,
      bodyId,
      fromSoulBindingId: soulA.soulBinding.id,
      toSoulBindingId: reassigned.session.soulBindingId,
      status: reassigned.session.status,
      state: reassigned.session.state,
      bodyPreserved,
    }),
  );

  const closedTwo = must(service.closeAvatarSession(solutionId, sessionTwoId), "closeAvatarSessionTwo");
  steps.push(
    step((stepIndex += 1), "avatar-session-two-closed", {
      sessionId: sessionTwoId,
      status: closedTwo.session.status,
      state: closedTwo.session.state,
      closedAt: closedTwo.session.closedAt ?? "",
    }),
  );

  // -- refusal paths (truthful typed errors, never silent skips) ------------

  const unknownBody = service.openAvatarSession(solutionId, {
    bodyId: "you_agent-body_missing0000000000000",
    soulBindingId: soulA.soulBinding.id,
  });
  refusalOutcomes["open-unknown-body"] = outcomeCode(unknownBody);

  const unknownSoul = service.openAvatarSession(solutionId, {
    bodyId,
    soulBindingId: "you_soul-binding_missing00000000000000",
  });
  refusalOutcomes["open-unknown-soul-binding"] = outcomeCode(unknownSoul);

  const invalidSoul = service.registerSoulBinding(solutionId, {
    providerKind: "",
    modelRef: "fixture-loom-x",
    routingProfile: "system-one",
    capabilities: [],
  });
  refusalOutcomes["register-invalid-soul-binding"] = outcomeCode(invalidSoul);

  const openedProbe = must(
    service.openAvatarSession(solutionId, { bodyId, soulBindingId: soulA.soulBinding.id }),
    "openProbeSession",
  );
  const probeSessionId = openedProbe.session.id;

  const offLadder = service.transitionEmbodimentState(solutionId, probeSessionId, "pontificating" as never);
  refusalOutcomes["transition-off-ladder"] = outcomeCode(offLadder);

  const noOp = service.transitionEmbodimentState(solutionId, probeSessionId, "idle");
  refusalOutcomes["transition-no-op"] = outcomeCode(noOp);

  const toUnavailable = service.transitionEmbodimentState(solutionId, probeSessionId, "unavailable");
  refusalOutcomes["transition-to-unavailable"] = outcomeCode(toUnavailable);

  const unknownSession = service.transitionEmbodimentState(solutionId, "you_avatar-session_missing00000000000", "listening");
  refusalOutcomes["transition-unknown-session"] = outcomeCode(unknownSession);

  const terminalLocked = service.transitionEmbodimentState(solutionId, sessionOneId, "listening");
  refusalOutcomes["transition-terminal-locked"] = outcomeCode(terminalLocked);

  const closedAgain = service.closeAvatarSession(solutionId, sessionOneId);
  refusalOutcomes["close-already-closed"] = outcomeCode(closedAgain);

  must(service.closeAvatarSession(solutionId, probeSessionId), "closeProbeSession");

  steps.push(
    step((stepIndex += 1), "refusal-paths", {
      ...refusalOutcomes,
      refusalCount: Object.keys(refusalOutcomes).length,
    }),
  );

  // -- ledger readout (projection == replay) ---------------------------------

  const events = must(service.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const projection = must(service.projectionOf(solutionId), "projectionOf");
  const replay = EmbodimentService.replay(events);
  const projectionMatchesReplay = stableStringify(projection) === stableStringify(replay);
  const ledgerHash = must(service.ledgerHashOf(solutionId), "ledgerHashOf");
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      sessionCount: Object.keys(projection.sessions).length,
    }),
  );

  return {
    solutionId,
    bodyId,
    soulBindingAId: soulA.soulBinding.id,
    soulBindingBId: soulB.soulBinding.id,
    sessionOneId,
    sessionTwoId,
    appearanceAddressed,
    ladderWalkStates,
    sessionOneFinalStatus: closedOne.session.status,
    sessionTwoFinalStatus: closedTwo.session.status,
    bodyPreservedAcrossRepossession: bodyPreserved,
    repossessionSoulBindingId: reassigned.session.soulBindingId,
    refusalOutcomes,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
