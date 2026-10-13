// YOU lab application service — shared internal types and helpers
// (W9A — docs/you/CONTRACTS.md "Wave-9 contract freeze (v9)";
// WORK_ORDERS.md W9A).
//
// The application service (labService.ts) is the single authority over
// lab-plane truth: durable LabExperiment records, the append-only
// LabRun ladder, content-addressed LabEvidenceManifest bundles and the
// promotion gate (LabPromotionRecord chains). The LAB PERSISTENCE LAW
// holds by construction: every record is deep-frozen; the run ladder
// appends; heads advance only through immutable replacement; reversals
// are new records. The stateless validators stay the single refusal
// authority (shared/src/you/labExperiment.ts, labRunLadder.ts,
// labEvidence.ts, labPromotion.ts); nothing here is a second
// validator.
//
// Error-code mapping (frozen W9A taxonomy):
//   YOU_LAB_EXPERIMENT_NOT_FOUND      — unknown experiment id (every
//                                        experiment-scoped op)
//   YOU_LAB_RUN_NOT_FOUND             — unknown run id (every run op)
//   YOU_LAB_EVIDENCE_MANIFEST_INVALID — malformed manifest intake,
//                                        unknown manifest refs, evidence
//                                        on non-terminal runs,
//                                        verification failures (the
//                                        fail-closed mismatch law)
//   YOU_LAB_PROMOTION_INVALID         — the promotion gate (the LAB
//                                        PROMOTION LAW), reversal
//                                        preconditions, unknown
//                                        promotion reads
//   YOU_INVALID_STATE                 — experiment/run intake shape
//                                        (the v1 solution-flow
//                                        precedent); run-ladder
//                                        violations carry the ladder's
//                                        stable reasons on this code

import type {
  LabArmKind,
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
import type { LabArtifactBinding } from "../../../shared/src/you/labEvidence.js";
import type { LabPromotionDecisionKind } from "../../../shared/src/you/labPromotion.js";

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

/** The deps every lab flow receives (injected clock/ids + the content store). */
export interface LabFlowDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/**
 * One solution's lab plane: the append-only ledger, the immutable
 * LabExperiment heads, the append-only LabRun ladder (immutable head
 * records per run), the content-addressed evidence manifests (with
 * their artifact bindings — the verification inputs), and the
 * append-only promotion decision chains per experiment. The service is
 * the sole writer; records are replaced immutably and every change
 * rides the ledger.
 */
export interface LabPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** experimentId -> immutable LabExperiment head. */
  readonly experiments: Map<OpaqueId, LabExperiment>;
  /** runId -> LabRun head (the run-ladder projection head). */
  readonly runs: Map<OpaqueId, LabRun>;
  /** runIds per experiment, in append order (the per-experiment run ladder). */
  readonly runIdsByExperiment: Map<OpaqueId, OpaqueId[]>;
  /** manifestId -> immutable LabEvidenceManifest. */
  readonly manifests: Map<OpaqueId, LabEvidenceManifest>;
  /** manifestId -> ordered artifact bindings (the verification inputs). */
  readonly manifestArtifacts: Map<OpaqueId, LabArtifactBinding[]>;
  /** manifestIds per run, in append order (re-publishes append). */
  readonly manifestIdsByRun: Map<OpaqueId, OpaqueId[]>;
  /** promotionId -> immutable LabPromotionRecord. */
  readonly promotions: Map<OpaqueId, LabPromotionRecord>;
  /** promotionIds per experiment, in append order (the decision chain). */
  readonly promotionChains: Map<OpaqueId, OpaqueId[]>;
  /** promotionId -> the decision kind (service state; rides the event payload). */
  readonly promotionKinds: Map<OpaqueId, LabPromotionDecisionKind>;
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

/**
 * The manifest lookup helper: typed YOU_LAB_EVIDENCE_MANIFEST_INVALID
 * (fail-closed manifest error class — an unknown ref is invalid).
 */
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
        details: { reason: "unknown-manifest", manifestId },
        simulated: true,
      },
    };
  }
  return { manifest };
}

/** The arm membership gate: the run's arm must be a declared experiment arm. */
export function isDeclaredArm(experiment: LabExperiment, arm: LabArmKind): boolean {
  return experiment.arms.includes(arm);
}
