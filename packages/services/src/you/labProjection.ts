// YOU lab service — live plane projection builder (W9A).
//
// Builds the authoritative LabPlaneProjection from the service's live
// state in EXACTLY the shape replayLabLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in
// tests via stableStringify; any drift between this builder and the
// fold is a bug.
//
// The projection rules mirror the fold:
//   - experiments: the declaration facts from the immutable records,
//     promotionRef = the current head linkage ("" before any decision);
//   - runs: the ladder heads (status + completedAt + evidence ref);
//   - manifests: the content-addressed bundle facts + bindings;
//   - promotions: the decision records with their kinds;
//   - promotion chains: the append-only per-experiment decision order.
//
// NOTE (the W6A service-state precedent): experiments materialize in
// the LEDGER through their runs (the frozen wave-9 event set has no
// experiment-declaration event). A declared experiment with zero runs
// exists in the live projection but not in a ledger replay; the
// fixture scenarios always run arms after declaration so the
// projection-equality law holds on every compared state.

import type { OpaqueId } from "@zcode/shared";
import type {
  LabLedgerExperimentEntry,
  LabLedgerManifestEntry,
  LabLedgerPromotionEntry,
  LabLedgerRunEntry,
  LabPlaneProjection,
} from "../../../shared/src/you/labLedger.js";
import type { LabPlaneRecord } from "./labServiceTypes.js";
import { sortedLabMapKeys } from "./labServiceTypes.js";

/** Builds the live lab-plane projection (equal to replayLabLedger output). */
export function buildLabPlaneProjection(plane: LabPlaneRecord): LabPlaneProjection {
  const experiments: Record<string, LabLedgerExperimentEntry> = {};
  const runs: Record<string, LabLedgerRunEntry> = {};
  const manifests: Record<string, LabLedgerManifestEntry> = {};
  const promotions: Record<string, LabLedgerPromotionEntry> = {};
  const promotionChains: Record<string, readonly string[]> = {};

  // -- experiments (the declaration facts + the promotion head linkage) ----
  for (const experimentId of sortedLabMapKeys(plane.experiments)) {
    const experiment = plane.experiments.get(experimentId);
    if (experiment === undefined) {
      continue;
    }
    experiments[experimentId] = {
      intentRef: experiment.intentRef,
      constraintsHash: experiment.constraintsHash,
      objective: experiment.objective,
      arms: Object.freeze([...experiment.arms]),
      promotionRef: experiment.promotionRef ?? "",
      simulated: true,
    };
  }

  // -- runs (the ladder heads) ----------------------------------------------
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

  // -- manifests (the content-addressed bundle facts) ------------------------
  for (const manifestId of sortedLabMapKeys(plane.manifests)) {
    const manifest = plane.manifests.get(manifestId);
    if (manifest === undefined) {
      continue;
    }
    const bindings = plane.manifestArtifacts.get(manifestId) ?? [];
    manifests[manifestId] = {
      runId: manifest.runId,
      contentHash: manifest.contentHash,
      artifactRefs: Object.freeze(bindings.map((binding) => binding.contentRef)),
      artifactHashes: Object.freeze(bindings.map((binding) => binding.contentHash)),
      publishedAt: manifest.publishedAt,
      simulated: true,
    };
  }

  // -- promotions (the decision records with their kinds) --------------------
  for (const promotionId of sortedLabMapKeys(plane.promotions)) {
    const promotion = plane.promotions.get(promotionId);
    if (promotion === undefined) {
      continue;
    }
    const chain = plane.promotionChains.get(promotion.experimentId) ?? [];
    const index = chain.indexOf(promotionId);
    const supersedes = index > 0 ? chain[index - 1] ?? "" : "";
    promotions[promotionId] = {
      experimentId: promotion.experimentId,
      decisionKind: plane.promotionKinds.get(promotionId) ?? "promote",
      winnerArm: promotion.winnerArm,
      objectiveScore: promotion.objectiveScore,
      baselineScore: promotion.baselineScore,
      evidenceManifestRef: promotion.evidenceManifestRef,
      supersedesPromotionId: supersedes,
      decidedAt: promotion.decidedAt,
      simulated: true,
    };
  }

  // -- promotion chains (append-only decision order per experiment) -----------
  for (const experimentId of sortedLabMapKeys(plane.promotionChains)) {
    const chain = plane.promotionChains.get(experimentId);
    if (chain === undefined || chain.length === 0) {
      continue;
    }
    promotionChains[experimentId] = Object.freeze([...chain]);
  }

  return {
    solutionId: plane.solutionId,
    experiments,
    runs,
    manifests,
    promotions,
    promotionChains,
  };
}

/** The manifest ids published for one run, in append order. */
export function manifestIdsOfRun(plane: LabPlaneRecord, runId: OpaqueId): readonly OpaqueId[] {
  return [...(plane.manifestIdsByRun.get(runId) ?? [])];
}
