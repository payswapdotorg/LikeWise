// YOU lab service — ledger event emission helpers (W9A).
//
// Append-only event helpers following the W1A/W7A/W8A precedent
// (solutionLedgerOps.ts / embodimentLedgerOps.ts / arenaLedgerOps.ts):
// per-record status facts ride along in event payloads because the
// frozen SolutionEventType set has no per-record status events —
// lab-run-recorded is the run-ladder status carrier (initial record
// and every immutable replacement), lab-evidence-published carries the
// manifest facts plus the run-head evidence linkage, and
// lab-promotion-decided carries the decision facts plus the experiment
// head's promotion linkage walk. Payload conventions are folded by
// shared/src/you/labLedger.ts replayLabLedger.
//
// Truth law: every payload carries simulated: true in fixture mode.

import type { LabEvidenceManifest, LabExperiment, LabPromotionRecord, LabRun, OpaqueId } from "@zcode/shared";
import type { LabArtifactBinding } from "../../../shared/src/you/labEvidence.js";
import type { LabPromotionDecisionKind } from "../../../shared/src/you/labPromotion.js";
import type { LabPlaneRecord } from "./labServiceTypes.js";

/**
 * Appends lab-run-recorded for a run-ladder head (initial or advanced).
 * The experiment declaration facts ride along (the frozen wave-9 event
 * set has no experiment-declaration event — the W6A service-state
 * precedent; experiments materialize in the ledger through their runs).
 */
export function appendLabRunRecorded(plane: LabPlaneRecord, run: LabRun, experiment: LabExperiment, statusBefore: string): void {
  const payload: Record<string, string | number | boolean> = {
    runId: run.id,
    experimentId: run.experimentId,
    arm: run.arm,
    planHash: run.planHash,
    statusBefore,
    statusAfter: run.status,
    submittedAt: run.submittedAt,
    completedAt: run.completedAt ?? "",
    evidenceManifestRef: run.evidenceManifestRef ?? "",
    experimentIntentRef: experiment.intentRef,
    experimentConstraintsHash: experiment.constraintsHash,
    experimentObjective: experiment.objective,
    experimentArmCount: experiment.arms.length,
    simulated: true,
  };
  experiment.arms.forEach((arm, index) => {
    payload[`experimentArm.${index}`] = arm;
  });
  plane.ledger.append({
    type: "lab-run-recorded",
    subjectRef: run.id,
    generator: "agent",
    payload,
  });
}

/** Appends lab-evidence-published for a content-addressed manifest. */
export function appendLabEvidencePublished(
  plane: LabPlaneRecord,
  manifest: LabEvidenceManifest,
  artifacts: readonly LabArtifactBinding[],
): void {
  const payload: Record<string, string | number | boolean> = {
    manifestId: manifest.id,
    runId: manifest.runId,
    contentHash: manifest.contentHash,
    artifactCount: artifacts.length,
    publishedAt: manifest.publishedAt,
    simulated: true,
  };
  artifacts.forEach((artifact, index) => {
    payload[`artifactRef.${index}`] = artifact.contentRef;
    payload[`artifactHash.${index}`] = artifact.contentHash;
  });
  plane.ledger.append({
    type: "lab-evidence-published",
    subjectRef: manifest.id,
    generator: "agent",
    payload,
  });
}

/** Appends lab-promotion-decided for a promotion or reversal decision. */
export function appendLabPromotionDecided(
  plane: LabPlaneRecord,
  promotion: LabPromotionRecord,
  kind: LabPromotionDecisionKind,
  supersedesPromotionId: OpaqueId | null,
  experimentPromotionRefBefore: OpaqueId | null,
): void {
  plane.ledger.append({
    type: "lab-promotion-decided",
    subjectRef: promotion.id,
    generator: "agent",
    payload: {
      promotionId: promotion.id,
      experimentId: promotion.experimentId,
      decisionKind: kind,
      winnerArm: promotion.winnerArm,
      objectiveScore: promotion.objectiveScore,
      baselineScore: promotion.baselineScore,
      evidenceManifestRef: promotion.evidenceManifestRef,
      supersedesPromotionId: supersedesPromotionId ?? "",
      experimentPromotionRefBefore: experimentPromotionRefBefore ?? "",
      experimentPromotionRefAfter: promotion.id,
      decidedAt: promotion.decidedAt,
      simulated: true,
    },
  });
}
