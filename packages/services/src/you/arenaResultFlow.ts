// YOU arena service — the escalation result flow (W8A): the ARENA
// BOUNDARY LAW surface. The typed payload (expert result +
// deterministic ChangeSet operations + the content binding) returns to
// the CALLER, who applies it through YOU's own application-service
// authority; this service only records the applied/rejected outcome on
// the escalation ladder (arena-result-applied — the v1 ride-along
// precedent: the frozen event set has no separate rejection event, so
// rejections carry escalationStatusAfter "rejected").

import type { CapabilityGap, OpaqueId } from "@zcode/shared";
import { arenaResultToOperations } from "../../../shared/src/you/gap.js";
import { deepFreeze } from "../../../shared/src/you/serialize.js";
import { applyArenaEscalationTransition, markArenaExpertResultApplied } from "../../../shared/src/you/arenaEscalationLadder.js";
import { appendArenaResultProcessed } from "./arenaLedgerOps.js";
import {
  arenaFailure,
  escalationInconsistent,
  requireEscalation,
  type ArenaApplicationPayload,
  type ArenaPlaneRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";

/**
 * The ARENA BOUNDARY LAW surface: the typed payload the CALLER applies
 * through YOU's own authority. This service never applies anything
 * itself. Refusals: typed YOU_ESCALATION_NOT_FOUND (unknown
 * escalation); typed YOU_ESCALATION_STATE_INVALID when no delivered
 * expert result exists.
 */
export function escalationResultPayloadOp(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
): ArenaServiceResult<ArenaApplicationPayload> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const escalation = found.gap.arenaEscalationRef;
  const result = escalation?.expertResult ?? null;
  if (escalation === null || result === null || (escalation.status !== "delivered" && escalation.status !== "applied")) {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", "no delivered expert result to apply", {
      reason: "no-delivered-result",
      escalationId,
      status: escalation?.status ?? "none",
    });
  }
  const delivery = plane.deliveries.get(escalationId);
  return {
    ok: true,
    value: {
      gap: found.gap,
      escalationId,
      expertResult: result,
      operations: arenaResultToOperations(found.gap, result),
      contentRef: delivery?.contentRef ?? "",
      contentHash: delivery?.contentHash ?? "",
    },
  };
}

/**
 * Records that the CALLER applied the delivered result through YOU's
 * own authority as ChangeSet `<changeSetId>`. The escalation walks
 * delivered -> applied. Emits arena-result-applied. Refusals: typed
 * YOU_ESCALATION_STATE_INVALID (status not "delivered"); typed
 * YOU_INVALID_STATE for an empty changeSetId.
 */
export function markEscalationResultAppliedOp(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  changeSetId: OpaqueId,
): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  if (escalation.status !== "delivered") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `application requires a delivered escalation (got ${escalation.status})`, {
      reason: "apply-requires-delivered-status",
      escalationId,
      status: escalation.status,
    });
  }
  if (typeof changeSetId !== "string" || changeSetId.length === 0) {
    return arenaFailure("YOU_INVALID_STATE", "the applied changeSetId must be a non-empty opaque id", {
      reason: "change-set-id-empty",
      escalationId,
    });
  }
  const stamped = markArenaExpertResultApplied(escalation, changeSetId);
  const walked = applyArenaEscalationTransition(stamped, "applied");
  const gapAfter: CapabilityGap = deepFreeze({ ...found.gap, arenaEscalationRef: walked });
  plane.gaps.set(found.gap.id, gapAfter);
  appendArenaResultProcessed(plane, escalationId, found.gap.id, "applied", changeSetId, "");
  return { ok: true, value: { gap: gapAfter } };
}

/**
 * Records that the user rejected the delivered result. The escalation
 * walks delivered -> rejected (a terminal). Emits arena-result-applied
 * (statusAfter "rejected"). Refusals: typed
 * YOU_ESCALATION_STATE_INVALID (status not "delivered").
 */
export function rejectEscalationResultOp(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  reason: string,
): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
  const found = requireEscalation(plane, escalationId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const escalation = found.gap.arenaEscalationRef;
  if (escalation === null) {
    return escalationInconsistent(escalationId);
  }
  if (escalation.status !== "delivered") {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", `rejection requires a delivered escalation (got ${escalation.status})`, {
      reason: "reject-requires-delivered-status",
      escalationId,
      status: escalation.status,
    });
  }
  const walked = applyArenaEscalationTransition(escalation, "rejected");
  const gapAfter: CapabilityGap = deepFreeze({ ...found.gap, arenaEscalationRef: walked });
  plane.gaps.set(found.gap.id, gapAfter);
  appendArenaResultProcessed(plane, escalationId, found.gap.id, "rejected", null, reason);
  return { ok: true, value: { gap: gapAfter } };
}
