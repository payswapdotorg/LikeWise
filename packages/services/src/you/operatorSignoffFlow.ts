// YOU launch-gate service — operator signoff flow (W12A). The ops live
// here; launchGateService.ts is the single authority that dispatches
// into them (the W1A/W8A/W10A/W11A flow precedent).
//
// THE OPERATOR SIGNOFF LAW (docs/you/CONTRACTS.md wave-12): the signoff
// references a COMPLETE passing checklist; it is immutable; one release
// declaration per signoff (YOU_OPERATOR_SIGNOFF_INVALID).
//
// signOperatorChecklistOp constructs the immutable signoff THROUGH the
// single authority (which verifies the referenced checklist is present,
// identical, COMPLETE over the canonical 20 points and PASSING on all
// 20) and appends the `operator-signoff-recorded` event. The stateless
// authority is shared/src/you/operatorSignoff.ts; nothing here is a
// second validator.
//
// Service-level law teeth (beyond the construct-time teeth):
//   - unknown checklist      -> typed refusal (nothing exists to sign);
//   - already signed         -> "already-signed" (the signoff is
//                               immutable; a re-sign is refused, never
//                               a rewrite — the W11A already-accepted
//                               precedent);
//   - checklist-not-passing  -> THE LAW: a signoff without a passing
//                               gate is refused, never recorded (the
//                               failing checklist stays "checked"
//                               forever).

import type { OperatorSignoffRecord } from "@zcode/shared";
import {
  constructOperatorSignoffRecord,
  type OperatorSignoffInput,
} from "../../../shared/src/you/operatorSignoff.js";
import { appendOperatorSignoffRecorded } from "./launchGateLedgerOps.js";
import {
  launchGateFailure,
  type LaunchGateFlowDeps,
  type LaunchGatePlaneRecord,
  type LaunchGateServiceResult,
} from "./launchGateServiceTypes.js";

/**
 * Signs one launch-gate checklist: the immutable signoff is constructed
 * THROUGH the single authority (the referenced checklist must be
 * COMPLETE and PASSING — THE OPERATOR SIGNOFF LAW) and appended as the
 * `operator-signoff-recorded` event. Refusals: typed
 * YOU_OPERATOR_SIGNOFF_INVALID for unknown-checklist, already-signed
 * (the immutability teeth), checklist-not-passing (a signoff without a
 * passing gate) and signed-by-empty.
 */
export function signOperatorChecklistOp(
  plane: LaunchGatePlaneRecord,
  deps: LaunchGateFlowDeps,
  checklistId: OperatorSignoffRecord["checklistRef"],
  input: OperatorSignoffInput,
): LaunchGateServiceResult<{ readonly signoff: OperatorSignoffRecord }> {
  const record = plane.checklists.get(checklistId);
  if (record === undefined) {
    return launchGateFailure("YOU_OPERATOR_SIGNOFF_INVALID", "Operator signoff refused: unknown checklist", {
      reason: "unknown-checklist",
      checklistId,
    });
  }
  const existingSignoffId = plane.signedChecklists.get(checklistId);
  if (existingSignoffId !== undefined) {
    return launchGateFailure(
      "YOU_OPERATOR_SIGNOFF_INVALID",
      "Operator signoff refused: the signoff is immutable (this checklist is already signed)",
      {
        reason: "already-signed",
        checklistId,
        signoffId: existingSignoffId,
      },
    );
  }
  const constructed = constructOperatorSignoffRecord(
    {
      id: deps.ids.next("operator-signoff"),
      checklistRef: checklistId,
      signedBy: input.signedBy,
      signedAt: deps.clock.now(),
    },
    record,
  );
  if (!constructed.ok) {
    return launchGateFailure("YOU_OPERATOR_SIGNOFF_INVALID", `Operator signoff refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      checklistId,
    });
  }
  plane.signoffs.set(constructed.record.id, constructed.record);
  plane.signedChecklists.set(checklistId, constructed.record.id);
  appendOperatorSignoffRecorded(plane, constructed.record);
  return { ok: true, value: { signoff: constructed.record } };
}
