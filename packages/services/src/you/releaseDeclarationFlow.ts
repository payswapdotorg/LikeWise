// YOU launch-gate service — release declaration flow (W12A). The ops
// live here; launchGateService.ts is the single authority that
// dispatches into them (the W1A/W8A/W10A/W11A flow precedent).
//
// THE RELEASE DECLARATION LAW (docs/you/CONTRACTS.md wave-12): the
// declaration carries the full evidence bundle reference AND rollback
// evidence — the production-eligibility law carried to the release
// (YOU_RELEASE_DECLARATION_INVALID).
//
// declareReleaseOp constructs the immutable declaration THROUGH the
// single authority (which requires the evidence bundle ref AND the
// rollback evidence ref, and re-verifies the full gate -> signoff ->
// release chain) and appends the `release-declared` event. The
// stateless authority is shared/src/you/releaseDeclaration.ts; nothing
// here is a second validator.
//
// Service-level law teeth (beyond the construct-time teeth):
//   - unknown signoff    -> typed refusal (nothing exists to declare
//                           over);
//   - already declared   -> "already-declared" (ONE release declaration
//                           per signoff — the OPERATOR SIGNOFF LAW's
//                           one-release clause; a re-declaration is
//                           refused, never a rewrite).

import type { ReleaseDeclarationRecord } from "@zcode/shared";
import {
  constructReleaseDeclarationRecord,
  type ReleaseDeclarationInput,
} from "../../../shared/src/you/releaseDeclaration.js";
import { appendReleaseDeclared } from "./launchGateLedgerOps.js";
import {
  launchGateFailure,
  type LaunchGateFlowDeps,
  type LaunchGatePlaneRecord,
  type LaunchGateServiceResult,
} from "./launchGateServiceTypes.js";

/**
 * Declares one release over an operator signoff: the immutable
 * declaration is constructed THROUGH the single authority (the evidence
 * bundle ref AND the rollback evidence ref are required; the full
 * gate -> signoff chain is verified by construction) and appended as
 * the `release-declared` event. Refusals: typed
 * YOU_RELEASE_DECLARATION_INVALID for unknown-signoff, already-declared
 * (one release per signoff), rollback-evidence-ref-empty (THE RELEASE
 * DECLARATION LAW) and evidence-bundle-ref-empty.
 */
export function declareReleaseOp(
  plane: LaunchGatePlaneRecord,
  deps: LaunchGateFlowDeps,
  signoffId: ReleaseDeclarationRecord["signoffRef"],
  input: ReleaseDeclarationInput,
): LaunchGateServiceResult<{ readonly declaration: ReleaseDeclarationRecord }> {
  const signoff = plane.signoffs.get(signoffId);
  if (signoff === undefined) {
    return launchGateFailure("YOU_RELEASE_DECLARATION_INVALID", "Release declaration refused: unknown signoff", {
      reason: "unknown-signoff",
      signoffId,
    });
  }
  const existingDeclarationId = plane.declaredSignoffs.get(signoffId);
  if (existingDeclarationId !== undefined) {
    return launchGateFailure(
      "YOU_RELEASE_DECLARATION_INVALID",
      "Release declaration refused: one release declaration per signoff (this signoff is already declared)",
      {
        reason: "already-declared",
        signoffId,
        declarationId: existingDeclarationId,
      },
    );
  }
  const checklist = plane.checklists.get(signoff.checklistRef) ?? null;
  const constructed = constructReleaseDeclarationRecord(
    {
      id: deps.ids.next("release-declaration"),
      signoffRef: signoffId,
      evidenceBundleRef: input.evidenceBundleRef,
      rollbackEvidenceRef: input.rollbackEvidenceRef,
      declaredAt: deps.clock.now(),
    },
    signoff,
    checklist,
  );
  if (!constructed.ok) {
    return launchGateFailure("YOU_RELEASE_DECLARATION_INVALID", `Release declaration refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      signoffId,
    });
  }
  plane.declarations.set(constructed.record.id, constructed.record);
  plane.declaredSignoffs.set(signoffId, constructed.record.id);
  appendReleaseDeclared(plane, constructed.record);
  return { ok: true, value: { declaration: constructed.record } };
}
