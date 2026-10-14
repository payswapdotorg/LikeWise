// YOU launch-gate service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W7A/W10A/W11A precedent
// (solutionLedgerOps.ts / embodimentLedgerOps.ts / platformLedgerOps.ts
// / securityLedgerOps.ts): the three frozen wave-12 events are the
// launch-gate lifecycle carriers — `launch-gate-checked` carries the
// 20 canonical points with their journey-evidence references and their
// authority-DERIVED pass states (THE LAUNCH GATE LAW carrier),
// `operator-signoff-recorded` carries the signoff referencing its
// COMPLETE passing checklist (THE OPERATOR SIGNOFF LAW carrier), and
// `release-declared` carries the evidence bundle AND the rollback
// evidence verbatim (THE RELEASE DECLARATION LAW carrier). Payload
// conventions are folded by shared/src/you/launchGateLedger.ts
// replayLaunchGateLedger. Every record id mints from the injected id
// factory at the flow seam (opaque ids, deterministic in fixture
// mode).
//
// Truth law: every payload carries simulated: true in fixture mode.

import type { LaunchGateChecklistRecord, OperatorSignoffRecord, ReleaseDeclarationRecord } from "@zcode/shared";
import { launchGatePassedCount, launchGatePasses } from "../../../shared/src/you/launchGate.js";
import type { LaunchGatePlaneRecord } from "./launchGateServiceTypes.js";

/**
 * Appends launch-gate-checked — the checklist with its 20 canonical
 * points (descriptions verbatim from the frozen table, journey-evidence
 * refs with "" for the honest null, authority-derived pass states) and
 * the gate-pass projection facts.
 */
export function appendLaunchGateChecked(
  plane: LaunchGatePlaneRecord,
  record: LaunchGateChecklistRecord,
): void {
  const payload: Record<string, string | number | boolean> = {
    checklistId: record.id,
    checkedAt: record.checkedAt,
    pointCount: record.points.length,
    passedCount: launchGatePassedCount(record),
    gatePassed: launchGatePasses(record),
    simulated: true,
  };
  record.points.forEach((point, index) => {
    payload[`pointDescription.${index}`] = point.description;
    payload[`pointJourneyRef.${index}`] = point.journeyEvidenceRef ?? "";
    payload[`pointPassed.${index}`] = point.passed;
  });
  plane.ledger.append({
    type: "launch-gate-checked",
    subjectRef: record.id,
    generator: "agent",
    payload,
  });
}

/**
 * Appends operator-signoff-recorded — the signoff referencing its
 * COMPLETE passing checklist.
 */
export function appendOperatorSignoffRecorded(
  plane: LaunchGatePlaneRecord,
  signoff: OperatorSignoffRecord,
): void {
  plane.ledger.append({
    type: "operator-signoff-recorded",
    subjectRef: signoff.id,
    generator: "agent",
    payload: {
      signoffId: signoff.id,
      checklistRef: signoff.checklistRef,
      signedBy: signoff.signedBy,
      signedAt: signoff.signedAt,
      simulated: true,
    },
  });
}

/**
 * Appends release-declared — the declaration with its evidence bundle
 * AND its rollback evidence verbatim (the production-eligibility law
 * carried to the release).
 */
export function appendReleaseDeclared(
  plane: LaunchGatePlaneRecord,
  declaration: ReleaseDeclarationRecord,
): void {
  plane.ledger.append({
    type: "release-declared",
    subjectRef: declaration.id,
    generator: "agent",
    payload: {
      declarationId: declaration.id,
      signoffRef: declaration.signoffRef,
      evidenceBundleRef: declaration.evidenceBundleRef,
      rollbackEvidenceRef: declaration.rollbackEvidenceRef,
      declaredAt: declaration.declaredAt,
      simulated: true,
    },
  });
}
