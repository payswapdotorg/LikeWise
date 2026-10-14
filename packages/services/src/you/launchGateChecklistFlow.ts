// YOU launch-gate service — checklist assembly flow (W12A). The ops
// live here; launchGateService.ts is the single authority that
// dispatches into them (the W1A/W8A/W10A/W11A flow precedent).
//
// THE LAUNCH GATE LAW (docs/you/CONTRACTS.md wave-12): a checklist
// point passes ONLY with a successful E2eJourneyRecord reference —
// never a bare assertion; the gate passes ONLY when all 20 points pass
// (YOU_LAUNCH_GATE_INVALID).
//
// assembleLaunchGateChecklistOp takes the journey evidence (one
// E2eJourneyRecord or null per point, in point order), constructs the
// immutable checklist THROUGH the single authority (which derives every
// point's pass state from its evidence — the caller cannot assert a
// pass) and appends the `launch-gate-checked` event with the 20 points
// verbatim. The stateless authority is shared/src/you/launchGate.ts;
// nothing here is a second validator.
//
// A checklist with unsuccessful or absent evidence records honestly
// (its failing points carry their refs, passed: false) — the refusal
// teeth live at the SIGNOFF seam, never at the recording seam (an
// honest failing gate is a valid recorded fact).

import type { LaunchGateChecklistRecord } from "@zcode/shared";
import {
  constructLaunchGateChecklistRecord,
  launchGatePassedCount,
  launchGatePasses,
  validateLaunchGateChecklistIntake,
  type LaunchGateChecklistIntake,
  type LaunchGateRefusal,
} from "../../../shared/src/you/launchGate.js";
import { appendLaunchGateChecked } from "./launchGateLedgerOps.js";
import {
  launchGateFailure,
  type LaunchGateFlowDeps,
  type LaunchGatePlaneRecord,
  type LaunchGateServiceResult,
} from "./launchGateServiceTypes.js";

/** Maps a stateless checklist refusal to the typed service error. */
function checklistRefusal(refusal: LaunchGateRefusal): { readonly ok: false; readonly error: ReturnType<typeof launchGateFailure>["error"] } {
  return launchGateFailure("YOU_LAUNCH_GATE_INVALID", `Launch-gate checklist refused: ${refusal.detail}`, {
    reason: refusal.reason,
  });
}

/**
 * Assembles one launch-gate checklist from journey evidence: the
 * immutable record is constructed THROUGH the single authority (point
 * numbers and descriptions from the frozen canonical table; `passed`
 * DERIVED from each point's evidence — never a bare assertion) and
 * appended as the `launch-gate-checked` event. Refusals: typed
 * YOU_LAUNCH_GATE_INVALID for checklist-incomplete (wrong evidence
 * count) and journey-evidence shape.
 */
export function assembleLaunchGateChecklistOp(
  plane: LaunchGatePlaneRecord,
  deps: LaunchGateFlowDeps,
  intake: LaunchGateChecklistIntake,
): LaunchGateServiceResult<{
  readonly record: LaunchGateChecklistRecord;
  readonly passedCount: number;
  readonly gatePassed: boolean;
}> {
  // The stateless intake authority gates the seam FIRST (the
  // recordSecurityReviewOp precedent): exactly 20 well-formed evidence
  // entries.
  const validated = validateLaunchGateChecklistIntake(intake);
  if (validated !== null) {
    return checklistRefusal(validated);
  }
  const constructed = constructLaunchGateChecklistRecord(
    {
      id: deps.ids.next("launch-gate"),
      checkedAt: deps.clock.now(),
    },
    intake,
  );
  if (!constructed.ok) {
    return checklistRefusal(constructed.refusal);
  }
  const record = constructed.record;
  plane.checklists.set(record.id, record);
  appendLaunchGateChecked(plane, record);
  return {
    ok: true,
    value: {
      record,
      passedCount: launchGatePassedCount(record),
      gatePassed: launchGatePasses(record),
    },
  };
}
