// YOU arena service — the escalation lifecycle flow (W8A): the
// authorization grant, the escalation-session start (THE GATE — the
// ESCALATION AUTHORIZATION LAW) and the delivery through the
// provider-neutral Arena client boundary. The escalation ladder is the
// v1 ArenaEscalationStatus table (enforced with
// YOU_ESCALATION_STATE_INVALID); the gap record is replaced immutably at
// every rung. Delivery results return as typed payloads
// (escalationResultPayload) that the caller applies through YOU's own
// authority (the ARENA BOUNDARY LAW — see arenaResultFlow.ts for the
// application recording).

import type { ArenaExpertResult, ArenaLearningPermission, CapabilityGap, EscalationAuthorization, OpaqueId } from "@zcode/shared";
import { deepFreeze } from "../../../shared/src/you/serialize.js";
import { applyArenaEscalationTransition, attachArenaExpertResult } from "../../../shared/src/you/arenaEscalationLadder.js";
import {
  constructEscalationAuthorization,
  effectiveAuthorizationStatus,
  evaluateEscalationAuthorization,
  grantEntryOf,
  type EscalationAuthorizationInput,
} from "../../../shared/src/you/escalationAuthorization.js";
import { appendEscalationAuthorized, appendEscalationStatus, appendLearningPermissionRecorded } from "./arenaLedgerOps.js";
import {
  activePolicyOf,
  arenaFailure,
  clientForPlane,
  escalationInconsistent,
  requireEscalation,
  type ArenaDeliveryRecord,
  type ArenaFlowDeps,
  type ArenaPlaneRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";

/** Authorization grant intake. */
export interface ArenaAuthorizationGrantInput {
  readonly authorizedBy: OpaqueId;
  readonly scope: string;
  readonly expiresAt?: string | null;
  readonly learningPermission: ArenaLearningPermission;
}

/**
 * Grants the user authorization (scope/expiry/learning permission). The
 * EscalationAuthorization record is immutable; the chain is
 * append-only. Emits escalation-authorized (the escalation walks
 * requested -> authorized, riding along) and
 * learning-permission-recorded (the grant-time recording). Refusals:
 * typed YOU_ESCALATION_NOT_FOUND (unknown escalation); typed
 * YOU_ESCALATION_STATE_INVALID (status not "requested"); typed
 * YOU_INVALID_STATE for intake shape (the validator's stable reason).
 */
export function grantAuthorizationOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  escalationId: OpaqueId,
  input: ArenaAuthorizationGrantInput,
): ArenaServiceResult<{ readonly authorization: EscalationAuthorization; readonly gap: CapabilityGap }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  if (escalation.status !== "requested") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `authorization grants require a requested escalation (got ${escalation.status})`, {
      reason: "grant-requires-requested-status",
      escalationId,
      status: escalation.status,
    });
  }
  const grantInput: EscalationAuthorizationInput = {
    escalationId,
    authorizedBy: input.authorizedBy,
    scope: input.scope,
    expiresAt: input.expiresAt ?? null,
    learningPermission: input.learningPermission,
  };
  const granted = constructEscalationAuthorization(grantInput, {
    now: () => deps.clock.now(),
    nextId: deps.ids.next,
  });
  if (!granted.ok) {
    return arenaFailure("YOU_INVALID_STATE", `authorization intake refused: ${granted.refusal.detail}`, {
      reason: "invalid-authorization-intake",
      refusal: granted.refusal.reason,
      escalationId,
    });
  }
  plane.authorizationChains.set(escalationId, [grantEntryOf(granted.authorization)]);
  plane.permissionRecordings.set(escalationId, {
    authorizationId: granted.authorization.id,
    learningPermission: granted.authorization.learningPermission,
    recordedAt: granted.authorization.grantedAt,
  });
  const walked = applyArenaEscalationTransition(escalation, "authorized");
  const gapAfter: CapabilityGap = deepFreeze({ ...found.gap, arenaEscalationRef: walked });
  plane.gaps.set(found.gap.id, gapAfter);
  appendEscalationAuthorized(plane, gapAfter, granted.authorization, "authorized");
  appendLearningPermissionRecorded(
    plane,
    escalationId,
    granted.authorization.id,
    granted.authorization.learningPermission,
    granted.authorization.grantedAt,
    null,
  );
  return { ok: true, value: { authorization: granted.authorization, gap: gapAfter } };
}

/**
 * Starts the authorized escalation session (authorized -> in-progress).
 * THE GATE (ESCALATION AUTHORIZATION LAW): the chain head must be
 * active, in-scope and unexpired at the injected clock's reading —
 * unauthorized escalation paths are refused with
 * YOU_ESCALATION_AUTHORIZATION_REQUIRED (the active policy's
 * requiresAuthorization flag composes with the law; a false flag cannot
 * waive it). Emits arena-escalation-requested (statusAfter
 * "in-progress", the v1 status-carrier precedent).
 */
export function startEscalationSessionOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  escalationId: OpaqueId,
  options: { readonly requestedScope?: string },
): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  // The authorization law gate (fail-closed, before the ladder gate).
  const chain = plane.authorizationChains.get(escalationId);
  const head = chain !== undefined && chain.length > 0 ? chain[chain.length - 1] : undefined;
  const now = deps.clock.now();
  const requestedScope = options.requestedScope ?? head?.authorization.scope ?? "";
  const decision = evaluateEscalationAuthorization(head ?? null, now, requestedScope);
  if (!decision.allowed) {
    return arenaFailure("YOU_ESCALATION_AUTHORIZATION_REQUIRED", `escalation refused: ${decision.reason}`, {
      reason: decision.reason,
      escalationId,
      authorizationId: head?.authorization.id ?? "",
      status: escalation.status,
    });
  }
  // The policy flag composes with the law (the flag's teeth).
  const policy = activePolicyOf(plane);
  if (policy !== null && policy.requiresAuthorization && head === undefined) {
    return arenaFailure("YOU_ESCALATION_AUTHORIZATION_REQUIRED", "the active retry policy requires an authorization on this escalation path", {
      reason: "policy-requires-authorization",
      escalationId,
    });
  }
  // The ladder gate.
  if (escalation.status !== "authorized") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `an escalation session starts only from authorized (got ${escalation.status})`, {
      reason: "start-requires-authorized-status",
      escalationId,
      status: escalation.status,
    });
  }
  const walked = applyArenaEscalationTransition(escalation, "in-progress");
  const gapAfter: CapabilityGap = deepFreeze({ ...found.gap, arenaEscalationRef: walked });
  plane.gaps.set(found.gap.id, gapAfter);
  appendEscalationStatus(plane, escalationId, found.gap.id, "authorized", "in-progress", {
    authorizationId: head?.authorization.id ?? "",
    reason: "escalation-started",
  });
  return { ok: true, value: { gap: gapAfter } };
}

/**
 * Delivers the expert result through the provider-neutral Arena client
 * boundary (fail-closed on unknown providers and capability
 * mismatches — typed YOU_ARENA_ADAPTER_UNSUPPORTED). The delivery is
 * content-addressed (contentRef + contentHash through the content
 * store); the escalation walks in-progress -> delivered with the typed
 * result attached. Emits arena-escalation-requested (statusAfter
 * "delivered", the v1 solutionEscalationFlow precedent).
 */
export function deliverEscalationResultOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  escalationId: OpaqueId,
  input: { readonly providerId: OpaqueId },
): ArenaServiceResult<{ readonly gap: CapabilityGap; readonly delivery: ArenaExpertResult; readonly contentRef: OpaqueId; readonly contentHash: string }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  if (escalation.status !== "in-progress") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `delivery requires an in-progress escalation (got ${escalation.status})`, {
      reason: "deliver-requires-in-progress-status",
      escalationId,
      status: escalation.status,
    });
  }
  const invoked = clientForPlane(plane, deps).invoke({
    providerId: input.providerId,
    escalationId,
    gapId: found.gap.id,
    category: found.gap.category,
    minimumContext: escalation.minimumContext,
  });
  if (!invoked.ok) {
    return { ok: false, error: invoked.error };
  }
  const delivery = invoked.delivery;
  const record: ArenaDeliveryRecord = deepFreeze({
    providerId: delivery.providerId,
    contentRef: delivery.contentRef,
    contentHash: delivery.contentHash,
    deliveredAt: delivery.deliveredAt,
  });
  plane.deliveries.set(escalationId, record);
  const delivered = applyArenaEscalationTransition(escalation, "delivered");
  const withResult = attachArenaExpertResult(delivered, delivery.expertResult);
  const gapAfter: CapabilityGap = deepFreeze({ ...found.gap, arenaEscalationRef: withResult });
  plane.gaps.set(found.gap.id, gapAfter);
  appendEscalationStatus(plane, escalationId, found.gap.id, "in-progress", "delivered", {
    providerId: delivery.providerId,
    resultType: delivery.expertResult.resultType,
    contentRef: delivery.contentRef,
    contentHash: delivery.contentHash,
    deliveredAt: delivery.deliveredAt,
  });
  return { ok: true, value: { gap: gapAfter, delivery: delivery.expertResult, contentRef: delivery.contentRef, contentHash: delivery.contentHash } };
}

/** The effective status of a chain head at a clock reading (read helper for flows). */
export function headStatusAt(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  now: string,
): string | null {
  const chain = plane.authorizationChains.get(escalationId);
  const head = chain !== undefined && chain.length > 0 ? chain[chain.length - 1] : undefined;
  return head === undefined ? null : effectiveAuthorizationStatus(head, now);
}
