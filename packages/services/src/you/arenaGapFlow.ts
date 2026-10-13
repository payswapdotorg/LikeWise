// YOU arena service — CapabilityGap persistence + escalation request flow
// (W8A). The ops live here; arenaService.ts is the single authority that
// dispatches into them (the W1A/W6A flow precedent). A gap records the
// full v1 linkage (intentRef / attempted strategies / failure evidence);
// the escalation request walks the v1 flow (eligible gap -> immutable
// gap replacement + escalation born on "requested").

import type { CapabilityGap, OpaqueId } from "@zcode/shared";
import { recordCapabilityGap, requestArenaEscalation } from "../../../shared/src/you/gap.js";
import { appendCapabilityGapDetected, appendEscalationStatus } from "./arenaLedgerOps.js";
import {
  arenaFailure,
  requireGap,
  type ArenaFlowDeps,
  type ArenaPlaneRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";

/** Capability-gap intake (the v1 shape — see shared/src/you/gap.ts). */
export interface ArenaGapIntakeInput {
  readonly intentRef?: OpaqueId | null;
  readonly attemptedStrategies: readonly {
    readonly strategy: string;
    readonly outcome: "failed" | "partial" | "rejected";
    readonly evidenceRef?: OpaqueId | null;
  }[];
  readonly failureEvidence?: readonly OpaqueId[];
  readonly category: CapabilityGap["category"];
  readonly confidence: number;
  readonly suggestedNextAction: string;
}

/**
 * Records an immutable CapabilityGap on the append-only ledger with the
 * full v1 linkage. Emits capability-gap-detected. Refusals: typed
 * YOU_INVALID_STATE for intake shape (the v1 helper's thrown guard
 * pre-checked here).
 */
export function recordCapabilityGapOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  input: ArenaGapIntakeInput,
): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
  if (input.attemptedStrategies.length === 0) {
    return arenaFailure("YOU_INVALID_STATE", "a capability gap requires at least one attempted strategy", {
      reason: "invalid-gap-intake",
      refusal: "strategies-empty",
    });
  }
  const gap = recordCapabilityGap(
    {
      intentRef: input.intentRef ?? null,
      attemptedStrategies: input.attemptedStrategies.map((strategy) => ({
        strategy: strategy.strategy,
        outcome: strategy.outcome,
        evidenceRef: strategy.evidenceRef ?? null,
      })),
      failureEvidence: input.failureEvidence ?? [],
      category: input.category,
      confidence: input.confidence,
      suggestedNextAction: input.suggestedNextAction,
    },
    deps,
  );
  plane.gaps.set(gap.id, gap);
  appendCapabilityGapDetected(plane, gap);
  return { ok: true, value: { gap } };
}

/**
 * Requests an Arena escalation for an eligible gap (the v1 flow): the
 * gap record is replaced immutably (escalationEligibility ->
 * "escalated", arenaEscalationRef set) and the escalation is born on
 * the "requested" rung. Emits arena-escalation-requested. Refusals:
 * typed YOU_ESCALATION_STATE_INVALID when the gap already carries an
 * escalation; typed YOU_CAPABILITY_GAP when the gap is not
 * escalation-eligible (the v1 rule).
 */
export function requestEscalationOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  gapId: OpaqueId,
): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
  const found = requireGap(plane, gapId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (found.gap.arenaEscalationRef !== null) {
    return arenaFailure("YOU_ESCALATION_STATE_INVALID", "gap already carries an escalation", {
      reason: "escalation-already-requested",
      gapId,
      escalationId: found.gap.arenaEscalationRef.escalationId,
    });
  }
  if (found.gap.escalationEligibility !== "eligible") {
    return arenaFailure("YOU_CAPABILITY_GAP", "gap is not escalation-eligible", {
      reason: "not-eligible",
      gapId,
    });
  }
  const requested = requestArenaEscalation(found.gap, deps);
  plane.gaps.set(gapId, requested.gap);
  plane.escalationGap.set(requested.escalation.escalationId, gapId);
  appendEscalationStatus(plane, requested.escalation.escalationId, gapId, "", "requested");
  return { ok: true, value: { gap: requested.gap } };
}
