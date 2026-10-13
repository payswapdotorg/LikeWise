// YOU lab service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W8A precedent
// (solutionLedgerOps.ts / arenaLedgerOps.ts): per-record status facts
// ride along in event payloads because the frozen SolutionEventType set
// has no per-record status events — the lab-run-recorded event is the
// run-ladder status carrier (initial submitted record, the running
// start and every terminal), evidence-manifest facts ride on
// lab-evidence-published (which also walks the referenced run head's
// evidence linkage in the fold), and promotion/reversal decision facts
// ride on lab-promotion-decided. Payload conventions are folded by
// shared/src/you/labLedger.ts replayLabLedger.
//
// Truth law: every payload carries simulated: true in fixture mode.

import type { LabEvidenceManifest, LabPromotionRecord, LabRun, OpaqueId } from "@zcode/shared";
import type { LabPlaneRecord } from "./labServiceTypes.js";

/** Appends lab-run-recorded for a run-ladder head (initial or transition). */
export function appendLabRunRecorded(plane: LabPlaneRecord, run: LabRun, statusBefore: string): void {
  plane.ledger.append({
    type: "lab-run-recorded",
    subjectRef: run.id,
    generator: "agent",
    payload: {
      runId: run.id,
      experimentId: run.experimentId,
      arm: run.arm,
      planHash: run.planHash,
      statusBefore,
      statusAfter: run.status,
      submittedAt: run.submittedAt,
      completedAt: run.completedAt ?? "",
      evidenceManifestRef: run.evidenceManifestRef ?? "",
      simulated: true,
    },
  });
}

/** Appends lab-evidence-published for a content-addressed manifest. */
export function appendLabEvidencePublished(plane: LabPlaneRecord, manifest: LabEvidenceManifest, experimentId: OpaqueId): void {
  const payload: Record<string, string | number | boolean> = {
    manifestId: manifest.id,
    runId: manifest.runId,
    experimentId,
    contentHash: manifest.contentHash,
    artifactCount: manifest.artifactRefs.length,
    publishedAt: manifest.publishedAt,
    simulated: true,
  };
  manifest.artifactRefs.forEach((artifactRef, index) => {
    payload[`artifactRef.${index}`] = artifactRef;
  });
  plane.ledger.append({
    type: "lab-evidence-published",
    subjectRef: manifest.id,
    generator: "agent",
    payload,
  });
}

/** Appends lab-promotion-decided for a promotion or a reversal (a new record). */
export function appendLabPromotionDecided(
  plane: LabPlaneRecord,
  promotion: LabPromotionRecord,
  reversalOfPromotionId: OpaqueId | null,
): void {
  plane.ledger.append({
    type: "lab-promotion-decided",
    subjectRef: promotion.id,
    generator: "agent",
    payload: {
      promotionId: promotion.id,
      experimentId: promotion.experimentId,
      winnerArm: promotion.winnerArm,
      objectiveScore: promotion.objectiveScore,
      baselineScore: promotion.baselineScore,
      evidenceManifestRef: promotion.evidenceManifestRef,
      decidedAt: promotion.decidedAt,
      reversalOfPromotionId: reversalOfPromotionId ?? "",
      simulated: true,
    },
  });
}
