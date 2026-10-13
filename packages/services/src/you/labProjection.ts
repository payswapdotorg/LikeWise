// YOU lab service — live plane projection builder.
//
// Builds the authoritative LabPlaneProjection from the service's live
// state in EXACTLY the shape replayLabLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in
// tests via stableStringify; any drift between this builder and the
// fold is a bug.
//
// The builder reads the live records (runs / manifests / promotion
// ledgers) and applies the SAME projection rules as the fold:
//   - run heads: the immutable LabRun records (evidenceManifestRef as
//     bound by the publication flow);
//   - promotion heads: the newest record per experiment's decision
//     ledger (reversals included — the ledger is the history);
//   - reversal linkage: plane.promotionReversals carries which
//     promotion a record reverses ("" when none).
//
// LabExperiment records are SERVICE STATE (the W8A retry-policy
// precedent — the frozen v9 event set has no experiment event) and
// therefore do not appear in the projection; they stay readable
// through the service seam.

import type { OpaqueId } from "@zcode/shared";
import type {
  LabLedgerManifestEntry,
  LabLedgerPromotionEntry,
  LabLedgerRunEntry,
  LabPlaneProjection,
} from "../../../shared/src/you/labLedger.js";
import type { LabPlaneRecord } from "./labServiceTypes.js";
import { sortedLabMapKeys } from "./labServiceTypes.js";

/** Builds the live lab-plane projection (equal to replayLabLedger output). */
export function buildLabPlaneProjection(plane: LabPlaneRecord): LabPlaneProjection {
  const runs: Record<string, LabLedgerRunEntry> = {};
  const manifests: Record<string, LabLedgerManifestEntry> = {};
  const promotions: Record<string, LabLedgerPromotionEntry> = {};
  const promotionHeads: Record<string, string> = {};

  // -- runs (the ladder heads) ------------------------------------------------
  for (const runId of sortedLabMapKeys(plane.runs)) {
    const run = plane.runs.get(runId);
    if (run === undefined) {
      continue;
    }
    runs[runId] = {
      experimentId: run.experimentId,
      arm: run.arm,
      planHash: run.planHash,
      status: run.status,
      submittedAt: run.submittedAt,
      completedAt: run.completedAt ?? "",
      evidenceManifestRef: run.evidenceManifestRef ?? "",
      simulated: true,
    };
  }

  // -- manifests (content-addressed bundles) ----------------------------------
  for (const manifestId of sortedLabMapKeys(plane.manifests)) {
    const manifest = plane.manifests.get(manifestId);
    if (manifest === undefined) {
      continue;
    }
    manifests[manifestId] = {
      runId: manifest.runId,
      experimentId: experimentIdOfRun(plane, manifest.runId),
      contentHash: manifest.contentHash,
      artifactRefs: Object.freeze([...manifest.artifactRefs]),
      publishedAt: manifest.publishedAt,
      simulated: true,
    };
  }

  // -- promotions (the append-only decision ledgers) ---------------------------
  for (const experimentId of sortedLabMapKeys(plane.promotionLedgers)) {
    const ledger = plane.promotionLedgers.get(experimentId);
    if (ledger === undefined || ledger.length === 0) {
      continue;
    }
    for (const promotion of ledger) {
      promotions[promotion.id] = {
        experimentId: promotion.experimentId,
        winnerArm: promotion.winnerArm,
        objectiveScore: promotion.objectiveScore,
        baselineScore: promotion.baselineScore,
        evidenceManifestRef: promotion.evidenceManifestRef,
        decidedAt: promotion.decidedAt,
        reversalOfPromotionId: plane.promotionReversals.get(promotion.id) ?? "",
        simulated: true,
      };
    }
    const head = ledger[ledger.length - 1];
    if (head !== undefined) {
      promotionHeads[experimentId] = head.id;
    }
  }

  return {
    solutionId: plane.solutionId,
    runs,
    manifests,
    promotions,
    promotionHeads,
  };
}

/** The experiment a run belongs to ("" when the run is unknown — defensive). */
function experimentIdOfRun(plane: LabPlaneRecord, runId: OpaqueId): string {
  return plane.runs.get(runId)?.experimentId ?? "";
}
