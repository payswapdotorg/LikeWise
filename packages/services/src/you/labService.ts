// YOU lab application service — the single authority over lab-plane
// truth (docs/you/CONTRACTS.md "Wave-9 contract freeze (v9)";
// WORK_ORDERS.md W9A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one lab plane per solution: the
// append-only SolutionEventLedger, the immutable LabExperiment records
// (service state — the W8A retry-policy/provider precedent: the frozen
// v9 event set has no experiment event), the append-only LabRun ladder
// (submitted -> running -> succeeded | failed | retired, terminals
// locked), the content-addressed LabEvidenceManifest bundles and the
// LabPromotionRecord decision ledger behind the promotion gate. The op
// bodies live in the flow modules (labExperimentFlow / labRunFlow /
// labEvidenceFlow / labPromotionFlow — the W1A/W8A flow precedent);
// this class is the dispatch authority.
//
// LAB PERSISTENCE LAW (enforced here): no record is mutated in place;
// the run ladder is append-only; evidence manifests are
// content-addressed. LAB PROMOTION LAW: a searched arm promotes ONLY
// when it beats the generalist baseline under the recorded objective
// and constraints; reversals are new records. Phase 0 is fully
// deterministic: injected clock + seeded RNG ids; everything simulated
// stays labeled `simulated: true` (truth law). The error-code mapping
// is documented in labServiceTypes.ts.

import type {
  LabArmKind,
  LabEvidenceManifest,
  LabExperiment,
  LabPromotionRecord,
  LabRun,
  OpaqueId,
  SolutionEvent,
} from "@zcode/shared";
import type { YouClock } from "../../../shared/src/you/clock.js";
import { createDeterministicClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import { replayLabLedger, type LabPlaneProjection } from "../../../shared/src/you/labLedger.js";
import { buildLabPlaneProjection } from "./labProjection.js";
import {
  labFailure,
  sortedLabMapKeys,
  type LabFlowDeps,
  type LabPlaneRecord,
  type LabServiceResult,
} from "./labServiceTypes.js";
import { declareLabExperimentOp, type LabExperimentIntakeInput } from "./labExperimentFlow.js";
import { submitLabRunOp, transitionLabRunOp } from "./labRunFlow.js";
import { publishLabEvidenceOp, verifyLabEvidenceOp } from "./labEvidenceFlow.js";
import {
  decideLabPromotionOp,
  reverseLabPromotionOp,
  type LabPromotionDecisionInput,
} from "./labPromotionFlow.js";

export type { LabExperimentIntakeInput, LabPromotionDecisionInput };

export interface LabServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  /** Content store for artifact content addressing (same abstraction as the evidence lane). */
  readonly contentStore?: EvidenceContentStore;
}

/** The application-service authority over lab truth. */
export class LabService {
  private readonly planes = new Map<OpaqueId, LabPlaneRecord>();
  private readonly flowDeps: LabFlowDeps;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
  ) {
    this.flowDeps = { clock, ids, store: contentStore };
  }

  /** Creates a deterministic service (injected clock + seeded ids/artifact content). */
  static create(config: LabServiceConfig): LabService {
    const seed = config.seed ?? "you-w9a-lab-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new LabService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
    );
  }

  // -- LabExperiment persistence (service state; immutable records) ------------

  /** Declares an immutable three-arm LabExperiment. Emits nothing (the W8A policy/provider precedent). */
  declareExperiment(solutionId: OpaqueId, input: LabExperimentIntakeInput): LabServiceResult<{ readonly experiment: LabExperiment }> {
    return declareLabExperimentOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /** The declared experiment, or typed YOU_LAB_EXPERIMENT_NOT_FOUND. */
  experimentOf(solutionId: OpaqueId, experimentId: OpaqueId): LabServiceResult<{ readonly experiment: LabExperiment }> {
    const experiment = this.planeFor(solutionId).experiments.get(experimentId);
    return experiment === undefined
      ? labFailure("YOU_LAB_EXPERIMENT_NOT_FOUND", "unknown lab experiment", { reason: "unknown-experiment", experimentId })
      : { ok: true, value: { experiment } };
  }

  /** All declared experiments, sorted by id. */
  experimentsOf(solutionId: OpaqueId): LabServiceResult<{ readonly experiments: readonly LabExperiment[] }> {
    const plane = this.planeFor(solutionId);
    const experiments = sortedLabMapKeys(plane.experiments)
      .map((experimentId) => plane.experiments.get(experimentId))
      .filter((experiment): experiment is LabExperiment => experiment !== undefined);
    return { ok: true, value: { experiments } };
  }

  // -- the LabRun ladder (append-only; terminals locked) ------------------------

  /** Submits a new run of an experiment arm (born "submitted"). Emits lab-run-recorded. */
  submitLabRun(
    solutionId: OpaqueId,
    experimentId: OpaqueId,
    input: { readonly arm: LabArmKind; readonly planHash: string },
  ): LabServiceResult<{ readonly run: LabRun }> {
    return submitLabRunOp(this.planeFor(solutionId), this.flowDeps, experimentId, input);
  }

  /** Starts a submitted run (submitted -> running). */
  startLabRun(solutionId: OpaqueId, runId: OpaqueId): LabServiceResult<{ readonly run: LabRun }> {
    return transitionLabRunOp(this.planeFor(solutionId), this.flowDeps, runId, "running");
  }

  /** Completes a running run (terminal). */
  succeedLabRun(solutionId: OpaqueId, runId: OpaqueId): LabServiceResult<{ readonly run: LabRun }> {
    return transitionLabRunOp(this.planeFor(solutionId), this.flowDeps, runId, "succeeded");
  }

  /** Fails a running run (terminal). */
  failLabRun(solutionId: OpaqueId, runId: OpaqueId): LabServiceResult<{ readonly run: LabRun }> {
    return transitionLabRunOp(this.planeFor(solutionId), this.flowDeps, runId, "failed");
  }

  /** Retires a running run (terminal — the arm's attempt is discarded). */
  retireLabRun(solutionId: OpaqueId, runId: OpaqueId): LabServiceResult<{ readonly run: LabRun }> {
    return transitionLabRunOp(this.planeFor(solutionId), this.flowDeps, runId, "retired");
  }

  /** The run head, or typed YOU_LAB_RUN_NOT_FOUND. */
  runOf(solutionId: OpaqueId, runId: OpaqueId): LabServiceResult<{ readonly run: LabRun }> {
    const run = this.planeFor(solutionId).runs.get(runId);
    return run === undefined
      ? labFailure("YOU_LAB_RUN_NOT_FOUND", "unknown lab run", { reason: "unknown-run", runId })
      : { ok: true, value: { run } };
  }

  /** All runs across experiments, sorted by id. */
  runsOf(solutionId: OpaqueId): LabServiceResult<{ readonly runs: readonly LabRun[] }> {
    const plane = this.planeFor(solutionId);
    const runs = sortedLabMapKeys(plane.runs)
      .map((runId) => plane.runs.get(runId))
      .filter((run): run is LabRun => run !== undefined);
    return { ok: true, value: { runs } };
  }

  /** The per-experiment run ladder, in append order. */
  runsOfExperiment(solutionId: OpaqueId, experimentId: OpaqueId): LabServiceResult<{ readonly runs: readonly LabRun[] }> {
    const plane = this.planeFor(solutionId);
    const runs = (plane.runsByExperiment.get(experimentId) ?? [])
      .map((runId) => plane.runs.get(runId))
      .filter((run): run is LabRun => run !== undefined);
    return { ok: true, value: { runs } };
  }

  // -- LabEvidenceManifest (content-addressed; fail-closed verification) --------

  /** Publishes the evidence manifest for a terminal run. Emits lab-evidence-published. */
  publishLabEvidence(
    solutionId: OpaqueId,
    runId: OpaqueId,
    input: { readonly artifacts: readonly Uint8Array[] },
  ): LabServiceResult<{ readonly manifest: LabEvidenceManifest }> {
    return publishLabEvidenceOp(this.planeFor(solutionId), this.flowDeps, runId, input);
  }

  /** The published manifest, or typed YOU_LAB_EVIDENCE_MANIFEST_INVALID (fail-closed reads). */
  manifestOf(solutionId: OpaqueId, manifestId: OpaqueId): LabServiceResult<{ readonly manifest: LabEvidenceManifest }> {
    const manifest = this.planeFor(solutionId).manifests.get(manifestId);
    return manifest === undefined
      ? labFailure("YOU_LAB_EVIDENCE_MANIFEST_INVALID", "unknown lab evidence manifest", { reason: "manifest-unknown", manifestId })
      : { ok: true, value: { manifest } };
  }

  /** All published manifests, sorted by id. */
  manifestsOf(solutionId: OpaqueId): LabServiceResult<{ readonly manifests: readonly LabEvidenceManifest[] }> {
    const plane = this.planeFor(solutionId);
    const manifests = sortedLabMapKeys(plane.manifests)
      .map((manifestId) => plane.manifests.get(manifestId))
      .filter((manifest): manifest is LabEvidenceManifest => manifest !== undefined);
    return { ok: true, value: { manifests } };
  }

  /** Verifies a published manifest (hash mismatch fails closed). */
  verifyLabEvidence(
    solutionId: OpaqueId,
    manifestId: OpaqueId,
  ): LabServiceResult<{ readonly verified: true; readonly manifest: LabEvidenceManifest }> {
    return verifyLabEvidenceOp(this.planeFor(solutionId), this.flowDeps, manifestId);
  }

  // -- the promotion gate (the LAB PROMOTION LAW) --------------------------------

  /** Decides a promotion: the searched arm promotes ONLY when it beats the baseline. Emits lab-promotion-decided. */
  decidePromotion(
    solutionId: OpaqueId,
    experimentId: OpaqueId,
    input: LabPromotionDecisionInput,
  ): LabServiceResult<{ readonly promotion: LabPromotionRecord }> {
    return decideLabPromotionOp(this.planeFor(solutionId), this.flowDeps, experimentId, input);
  }

  /** Reverses the head promotion with a NEW record (never a mutation). Emits lab-promotion-decided. */
  reversePromotion(
    solutionId: OpaqueId,
    experimentId: OpaqueId,
    input: LabPromotionDecisionInput,
  ): LabServiceResult<{ readonly promotion: LabPromotionRecord }> {
    return reverseLabPromotionOp(this.planeFor(solutionId), this.flowDeps, experimentId, input);
  }

  /** The promotion/reversal record, or typed YOU_LAB_PROMOTION_INVALID (reason "promotion-unknown"). */
  promotionOf(solutionId: OpaqueId, promotionId: OpaqueId): LabServiceResult<{ readonly promotion: LabPromotionRecord }> {
    const promotion = this.planeFor(solutionId).promotions.get(promotionId);
    return promotion === undefined
      ? labFailure("YOU_LAB_PROMOTION_INVALID", "unknown lab promotion record", { reason: "promotion-unknown", promotionId })
      : { ok: true, value: { promotion } };
  }

  /** The append-only promotion decision ledger of an experiment, in order. */
  promotionLedgerOf(
    solutionId: OpaqueId,
    experimentId: OpaqueId,
  ): LabServiceResult<{ readonly ledger: readonly LabPromotionRecord[] }> {
    const plane = this.planeFor(solutionId);
    const found = plane.experiments.get(experimentId);
    if (found === undefined) {
      return labFailure("YOU_LAB_EXPERIMENT_NOT_FOUND", "unknown lab experiment", { reason: "unknown-experiment", experimentId });
    }
    return { ok: true, value: { ledger: plane.promotionLedgers.get(experimentId) ?? [] } };
  }

  // -- reads / projection / persistence ------------------------------------------

  ledgerEventsOf(solutionId: OpaqueId): LabServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): LabServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): LabServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Live authoritative projection (same shape as replayLabLedger output). */
  projectionOf(solutionId: OpaqueId): LabServiceResult<LabPlaneProjection> {
    return { ok: true, value: buildLabPlaneProjection(this.planeFor(solutionId)) };
  }

  /** Number of stored artifact content refs (fixture observability). */
  contentStoreSize(): number {
    return this.flowDeps.store.size;
  }

  /** Replays a persisted ledger through the shared lab-plane fold. */
  static replay(events: readonly SolutionEvent[]): LabPlaneProjection {
    return replayLabLedger(events);
  }

  // -- internals -------------------------------------------------------------------

  /** Lazily opens (and caches) the lab plane for one solution. */
  private planeFor(solutionId: OpaqueId): LabPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: LabPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.flowDeps),
      experiments: new Map(),
      runs: new Map(),
      runsByExperiment: new Map(),
      manifests: new Map(),
      manifestsByRun: new Map(),
      promotionLedgers: new Map(),
      promotions: new Map(),
      promotionReversals: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** Creates the deterministic lab application service. */
export function createLabService(config: LabServiceConfig): LabService {
  return LabService.create(config);
}
