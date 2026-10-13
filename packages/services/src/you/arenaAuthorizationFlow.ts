// YOU arena service — the EscalationAuthorization lifecycle flow (W8A):
// withdrawal, expiry materialization and learning-permission changes.
// Every lifecycle change appends NEW immutable records (entries wrap the
// frozen grant facts with the new status; a permission change appends a
// whole new grant record whose predecessor projects as "superseded") —
// nothing is mutated in place (the W6A supersession precedent).

import type { ArenaLearningPermission, CapabilityGap, EscalationAuthorization, OpaqueId } from "@zcode/shared";
import { deepFreeze } from "../../../shared/src/you/serialize.js";
import { applyArenaEscalationTransition, arenaEscalationTransitionRefusal } from "../../../shared/src/you/arenaEscalationLadder.js";
import {
  constructEscalationAuthorization,
  effectiveAuthorizationStatus,
  expireEntryAt,
  grantEntryOf,
  isArenaLearningPermission,
  isEscalationAuthorizationDue,
  withdrawEntryAt,
  type EscalationAuthorizationEntry,
} from "../../../shared/src/you/escalationAuthorization.js";
import { appendEscalationCancelled, appendLearningPermissionRecorded } from "./arenaLedgerOps.js";
import {
  arenaFailure,
  escalationInconsistent,
  requireAuthorizationChain,
  requireEscalation,
  type ArenaFlowDeps,
  type ArenaPlaneRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";

/**
 * Withdraws the chain-head authorization: a NEW immutable entry (status
 * "withdrawn") is appended — the grant record is never mutated — and a
 * non-terminal escalation walks to "cancelled". Emits
 * escalation-cancelled. Refusals: typed YOU_ESCALATION_NOT_FOUND
 * (unknown escalation/authorization); typed YOU_ESCALATION_STATE_INVALID
 * (head not active; the ladder cannot cancel the current status).
 */
export function withdrawAuthorizationOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  escalationId: OpaqueId,
  reason: string,
): ArenaServiceResult<{ readonly entry: EscalationAuthorizationEntry; readonly gap: CapabilityGap }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const chain = requireAuthorizationChain(plane, escalationId);
  if ("error" in chain) {
    return { ok: false, error: chain.error };
  }
  const head = chain.chain[chain.chain.length - 1];
  if (head === undefined) {
    return escalationInconsistent(escalationId);
  }
  const now = deps.clock.now();
  const effectiveStatus = effectiveAuthorizationStatus(head, now);
  if (effectiveStatus !== "active") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `withdrawal requires an active authorization (head is ${effectiveStatus})`, {
      reason: "authorization-not-active",
      escalationId,
      authorizationId: head.authorization.id,
    });
  }
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  const ladderRefusal = arenaEscalationTransitionRefusal(escalation.status, "cancelled");
  if (ladderRefusal !== null) {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `withdrawal cannot cancel a ${escalation.status} escalation: ${ladderRefusal}`, {
      reason: ladderRefusal,
      escalationId,
      status: escalation.status,
    });
  }
  const walked = applyArenaEscalationTransition(escalation, "cancelled");
  const entry = withdrawEntryAt(head, now, reason);
  plane.authorizationChains.set(escalationId, [...chain.chain, entry]);
  const gapAfter: CapabilityGap = deepFreeze({ ...found.gap, arenaEscalationRef: walked });
  plane.gaps.set(found.gap.id, gapAfter);
  appendEscalationCancelled(plane, escalationId, found.gap.id, head.authorization.id, "withdrawn", "cancelled", reason, now);
  return { ok: true, value: { entry, gap: gapAfter } };
}

/**
 * Materializes the (derivable) expiry of the chain-head grant as a NEW
 * immutable entry (status "expired" — the lazy predicate stays the
 * enforcement authority; this is the ledger trail). A stalled
 * escalation (requested/authorized/in-progress) walks to "cancelled"
 * (fail-closed: an escalation never runs on a lapsed authorization); a
 * delivered/terminal escalation keeps its status. Emits
 * escalation-cancelled (authorizationStatusAfter "expired"). Refusals:
 * typed YOU_ESCALATION_STATE_INVALID (head not active or not due).
 */
export function expireAuthorizationOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  escalationId: OpaqueId,
): ArenaServiceResult<{ readonly entry: EscalationAuthorizationEntry; readonly gap: CapabilityGap }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const chain = requireAuthorizationChain(plane, escalationId);
  if ("error" in chain) {
    return { ok: false, error: chain.error };
  }
  const head = chain.chain[chain.chain.length - 1];
  if (head === undefined) {
    return escalationInconsistent(escalationId);
  }
  const now = deps.clock.now();
  if (head.status !== "active") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `expiry materialization requires an active authorization (head is ${head.status})`, {
      reason: "authorization-not-active",
      escalationId,
      authorizationId: head.authorization.id,
    });
  }
  if (!isEscalationAuthorizationDue(head, now)) {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", "the authorization is not due for expiry at the current clock reading", {
      reason: "authorization-not-due",
      escalationId,
      authorizationId: head.authorization.id,
    });
  }
  const entry = expireEntryAt(head, now);
  plane.authorizationChains.set(escalationId, [...chain.chain, entry]);
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  let gapAfter = found.gap;
  let escalationStatusAfter = escalation.status;
  if (escalation.status === "requested" || escalation.status === "authorized" || escalation.status === "in-progress") {
    escalationStatusAfter = "cancelled";
    gapAfter = deepFreeze({ ...found.gap, arenaEscalationRef: applyArenaEscalationTransition(escalation, "cancelled") });
    plane.gaps.set(found.gap.id, gapAfter);
  }
  appendEscalationCancelled(
    plane,
    escalationId,
    found.gap.id,
    head.authorization.id,
    "expired",
    escalationStatusAfter,
    "authorization-expired",
    now,
  );
  return { ok: true, value: { entry, gap: gapAfter } };
}

/**
 * Records a learning-permission change: a NEW immutable grant record
 * (same authorizedBy/scope/expiry, the new permission) is appended —
 * the previous grant projects as "superseded", never mutated. Emits
 * learning-permission-recorded. Refusals: typed
 * YOU_ESCALATION_STATE_INVALID (head not active); typed
 * YOU_INVALID_STATE for an unsanctioned permission.
 */
export function recordLearningPermissionOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  escalationId: OpaqueId,
  learningPermission: ArenaLearningPermission,
): ArenaServiceResult<{ readonly authorization: EscalationAuthorization }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const chain = requireAuthorizationChain(plane, escalationId);
  if ("error" in chain) {
    return { ok: false, error: chain.error };
  }
  const head = chain.chain[chain.chain.length - 1];
  if (head === undefined) {
    return escalationInconsistent(escalationId);
  }
  const now = deps.clock.now();
  const effectiveStatus = effectiveAuthorizationStatus(head, now);
  if (effectiveStatus !== "active") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `a permission change requires an active authorization (head is ${effectiveStatus})`, {
      reason: "authorization-not-active",
      escalationId,
      authorizationId: head.authorization.id,
    });
  }
  if (!isArenaLearningPermission(learningPermission)) {
    return arenaFailure("YOU_INVALID_STATE", `learning permission "${String(learningPermission)}" is not one of none/aggregate/full`, {
      reason: "learning-permission-invalid",
      escalationId,
    });
  }
  const granted = constructEscalationAuthorization(
    {
      escalationId,
      authorizedBy: head.authorization.authorizedBy,
      scope: head.authorization.scope,
      expiresAt: head.authorization.expiresAt,
      learningPermission,
    },
    { now: () => now, nextId: deps.ids.next },
  );
  if (!granted.ok) {
    return arenaFailure("YOU_INVALID_STATE", `authorization intake refused: ${granted.refusal.detail}`, {
      reason: "invalid-authorization-intake",
      refusal: granted.refusal.reason,
      escalationId,
    });
  }
  plane.authorizationChains.set(escalationId, [...chain.chain, grantEntryOf(granted.authorization)]);
  plane.permissionRecordings.set(escalationId, {
    authorizationId: granted.authorization.id,
    learningPermission,
    recordedAt: granted.authorization.grantedAt,
  });
  appendLearningPermissionRecorded(
    plane,
    escalationId,
    granted.authorization.id,
    learningPermission,
    granted.authorization.grantedAt,
    head.authorization.id,
  );
  return { ok: true, value: { authorization: granted.authorization } };
}
