// YOU launch-gate service — live plane projection builder.
//
// Builds the authoritative LaunchGatePlaneProjection from the service's
// live state in EXACTLY the shape replayLaunchGateLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in
// tests via stableStringify; any drift between this builder and the
// fold is a bug.
//
// The builder reads the live records and applies the SAME projection
// rules as the fold:
//   - checklists: one entry per assembled checklist with its 20 points
//     (the honest null journey-evidence ref projects as "", exactly
//     like the payload convention), the passed count and the
//     gate-passes projection (all 20 points passed);
//   - signoffs / declarations: one entry per record with the law's
//     reference facts verbatim;
//   - the two lifecycle heads: signedChecklists (one signoff per
//     checklist — enforced by the service's already-signed refusal) and
//     declaredSignoffs (one release per signoff — enforced by the
//     service's already-declared refusal).

import type {
  LaunchGateLedgerChecklistEntry,
  LaunchGateLedgerDeclarationEntry,
  LaunchGateLedgerSignoffEntry,
  LaunchGatePlaneProjection,
} from "../../../shared/src/you/launchGateLedger.js";
import { launchGatePassedCount, launchGatePasses } from "../../../shared/src/you/launchGate.js";
import type { LaunchGatePlaneRecord } from "./launchGateServiceTypes.js";
import { sortedLaunchGateMapKeys } from "./launchGateServiceTypes.js";

/** Builds the live launch-gate-plane projection (equal to replayLaunchGateLedger output). */
export function buildLaunchGatePlaneProjection(plane: LaunchGatePlaneRecord): LaunchGatePlaneProjection {
  const checklists: Record<string, LaunchGateLedgerChecklistEntry> = {};
  const signoffs: Record<string, LaunchGateLedgerSignoffEntry> = {};
  const declarations: Record<string, LaunchGateLedgerDeclarationEntry> = {};
  const signedChecklists: Record<string, string> = {};
  const declaredSignoffs: Record<string, string> = {};

  // -- checklists (the 20 points + the gate-pass projection) ----------------------
  for (const checklistId of sortedLaunchGateMapKeys(plane.checklists)) {
    const record = plane.checklists.get(checklistId);
    if (record === undefined) {
      continue;
    }
    checklists[checklistId] = {
      checkedAt: record.checkedAt,
      points: Object.freeze(
        record.points.map((point) => ({
          point: point.point,
          description: point.description,
          journeyEvidenceRef: point.journeyEvidenceRef ?? "",
          passed: point.passed,
        })),
      ),
      passedCount: launchGatePassedCount(record),
      gatePassed: launchGatePasses(record),
      simulated: true,
    };
  }

  // -- signoffs (the law's reference facts verbatim) -------------------------------
  for (const signoffId of sortedLaunchGateMapKeys(plane.signoffs)) {
    const signoff = plane.signoffs.get(signoffId);
    if (signoff === undefined) {
      continue;
    }
    signoffs[signoffId] = {
      checklistRef: signoff.checklistRef,
      signedBy: signoff.signedBy,
      signedAt: signoff.signedAt,
      simulated: true,
    };
  }

  // -- declarations (evidence bundle + rollback evidence verbatim) ------------------
  for (const declarationId of sortedLaunchGateMapKeys(plane.declarations)) {
    const declaration = plane.declarations.get(declarationId);
    if (declaration === undefined) {
      continue;
    }
    declarations[declarationId] = {
      signoffRef: declaration.signoffRef,
      evidenceBundleRef: declaration.evidenceBundleRef,
      rollbackEvidenceRef: declaration.rollbackEvidenceRef,
      declaredAt: declaration.declaredAt,
      simulated: true,
    };
  }

  // -- the lifecycle heads (one signoff per checklist; one release per signoff) -----
  for (const checklistId of sortedLaunchGateMapKeys(plane.signedChecklists)) {
    const signoffId = plane.signedChecklists.get(checklistId);
    if (signoffId !== undefined) {
      signedChecklists[checklistId] = signoffId;
    }
  }
  for (const signoffId of sortedLaunchGateMapKeys(plane.declaredSignoffs)) {
    const declarationId = plane.declaredSignoffs.get(signoffId);
    if (declarationId !== undefined) {
      declaredSignoffs[signoffId] = declarationId;
    }
  }

  return {
    solutionId: plane.solutionId,
    checklists,
    signoffs,
    declarations,
    signedChecklists,
    declaredSignoffs,
  };
}
