// YOU lab application service — shared internal types and helpers.
//
// The application service (labService.ts) is the single authority over
// lab-plane truth (docs/you/CONTRACTS.md "Wave-9 contract freeze (v9)";
// WORK_ORDERS.md W9A): the durable LabExperiment records, the
// append-only LabRun ladder, the content-addressed LabEvidenceManifest
// bundles and the LabPromotionRecord decision ledger (the promotion
// gate). The LAB PERSISTENCE LAW holds by construction: no record is
// mutated in place — ladder transitions and linkage walks replace
// records immutably, and every change rides the append-only ledger.
// The stateless validators stay the single refusal authority
// (shared/src/you/labExperiment.ts, labRunLadder.ts,
// labEvidenceManifest.ts, labPromotion.ts); nothing here is a second
// validator.
//
// Error-code mapping (frozen W9A taxonomy):
//   YOU_LAB_EXPERIMENT_NOT_FOUND      — unknown experiment id (every
//                                        experiment-scoped op)
//   YOU_LAB_RUN_NOT_FOUND             — unknown run id (every run op)
//   YOU_LAB_EVIDENCE_MANIFEST_INVALID — manifest intake shape, unknown
//                                        manifest, publication gates (run
//                                        not terminal, run already carries
//                                        a manifest) and fail-closed hash
//                                        verification
//   YOU_LAB_PROMOTION_INVALID         — the promotion-gate refusals (the
//                                        LAB PROMOTION LAW, run
//                                        shape/binding, reversal gates,
//                                        unknown promotion id) — the
//                                        frozen v9 taxonomy has no
//                                        promotion-not-found code, so the
//                                        lookup refusal rides this code
//                                        with reason "promotion-unknown"
//   YOU_INVALID_STATE                 — experiment/run intake shape (the
//                                        v1 solution-flow precedent) and
//                                        run-ladder violations (stable
//                                        reasons: run-terminal-locked,
//                                        no-op-transition,
//                                        transition-not-on-ladder,
//                                        arm-not-declared)

import type {
  LabEvidenceManifest,
  LabExperiment,
  LabPromotionRecord,
  LabRun,
  OpaqueId,
  YouError,
} from "@zcode/shared";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type LabServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function labFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

/**
 * One solution's lab plane: the append-only ledger, the immutable
 * LabExperiment records (service state — the W8A retry-policy/provider
 * precedent: the frozen v9 event set has no experiment event), the
 * append-only LabRun ladder (immutable head records, per-experiment run
 * lists in append order), the published evidence manifests, and the
 * append-only promotion decision ledgers. The service is the sole
 * writer; records are replaced immutably and every change rides the
 * ledger.
 */
export interface LabPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** experimentId -> immutable LabExperiment head (promotionRef walks). */
  readonly experiments: Map<OpaqueId, LabExperiment>;
  /** runId -> LabRun head (the run-ladder projection head). */
  readonly runs: Map<OpaqueId, LabRun>;
  /** runIds per experiment, in append order (the per-experiment run ladder). */
  readonly runsByExperiment: Map<OpaqueId, OpaqueId[]>;
  /** manifestId -> immutable LabEvidenceManifest. */
  readonly manifests: Map<OpaqueId, LabEvidenceManifest>;
  /** runId -> the manifest bound onto that run (one manifest per run). */
  readonly manifestsByRun: Map<OpaqueId, OpaqueId>;
  /** experimentId -> append-only promotion decision ledger (in order). */
  readonly promotionLedgers: Map<OpaqueId, LabPromotionRecord[]>;
  /** promotionId -> the record (id lookups). */
  readonly promotions: Map<OpaqueId, LabPromotionRecord>;
  /** promotionId -> the promotion id this record reverses (""-free map: only reversals are present). */
  readonly promotionReversals: Map<OpaqueId, OpaqueId>;
}

/** The deps every lab flow receives (injected clock/ids + the content store). */
export interface LabFlowDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedLabMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The experiment lookup helper: typed YOU_LAB_EXPERIMENT_NOT_FOUND. */
export function requireLabExperiment(
  plane: LabPlaneRecord,
  experimentId: OpaqueId,
): { readonly experiment: LabExperiment } | { readonly error: YouError } {
  const experiment = plane.experiments.get(experimentId);
  if (experiment === undefined) {
    return {
      error: {
        code: "YOU_LAB_EXPERIMENT_NOT_FOUND",
        message: "unknown lab experiment",
        details: { reason: "unknown-experiment", experimentId },
        simulated: true,
      },
    };
  }
  return { experiment };
}

/** The run lookup helper: typed YOU_LAB_RUN_NOT_FOUND. */
export function requireLabRun(
  plane: LabPlaneRecord,
  runId: OpaqueId,
): { readonly run: LabRun } | { readonly error: YouError } {
  const run = plane.runs.get(runId);
  if (run === undefined) {
    return {
      error: {
        code: "YOU_LAB_RUN_NOT_FOUND",
        message: "unknown lab run",
        details: { reason: "unknown-run", runId },
        simulated: true,
      },
    };
  }
  return { run };
}

/** The manifest lookup helper: typed YOU_LAB_EVIDENCE_MANIFEST_INVALID (fail-closed reads). */
export function requireLabManifest(
  plane: LabPlaneRecord,
  manifestId: OpaqueId,
): { readonly manifest: LabEvidenceManifest } | { readonly error: YouError } {
  const manifest = plane.manifests.get(manifestId);
  if (manifest === undefined) {
    return {
      error: {
        code: "YOU_LAB_EVIDENCE_MANIFEST_INVALID",
        message: "unknown lab evidence manifest",
        details: { reason: "manifest-unknown", manifestId },
        simulated: true,
      },
    };
  }
  return { manifest };
}
