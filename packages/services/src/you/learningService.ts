// YOU learning application service — the single authority over
// learning truth (W6A; docs/you/CONTRACTS.md "State ownership":
// learning candidates = the learning service, Worker A lane — the
// wave-6 learning plane: signal capture, the learning ledger + the
// validation ladder, rights enforcement, preference projections and
// trajectory references).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one learning plane per solution
// (append-only SolutionEventLedger + immutable signals + records +
// the preference projection + the trajectory registry) and the
// learning content store. The wave-2 consent authority stays the ONLY
// consent path: rights issuance + usage enforcement resolve live
// grants through the injected LearningConsentPort seam.
//
// Phase 0 is fully deterministic: injected clock + seeded RNG;
// everything simulated stays labeled `simulated: true` (truth law).
// The projection surface (projectionOf) returns the LEDGER truth (the
// same shape replayLearningLedger folds); candidate records and the
// trajectory registry are pre-validation/registry service state (the
// frozen wave-6 event set defines no candidate/trajectory events — the
// W4A/W5A precedent) and are queryable through their own surfaces.

import type {
  LearningPreference,
  LearningRecord,
  LearningRightUsage,
  LearningRights,
  LearningSignal,
  LearningScope,
  OpaqueId,
  SolutionEvent,
  TrajectoryReference,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import type { LearningPlaneProjection } from "../../../shared/src/you/learningLedger.js";
import { replayLearningLedger } from "../../../shared/src/you/learningLedger.js";
import { preferenceProjectionKey } from "../../../shared/src/you/learningPreference.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import { captureLearningSignalOp, type CaptureLearningSignalInput } from "./learningSignalFlow.js";
import {
  issueLearningRightsOp,
  openCandidateRecordOp,
  rejectLearningRecordOp,
  synthesizeLearningContentOp,
  useLearningRecordOp,
  validateLearningRecordOp,
  type IssueLearningRightsInput,
  type OpenCandidateRecordInput,
  type ValidateLearningRecordInput,
} from "./learningRecordFlow.js";
import { derivePreferenceOp, setOperatorPreferenceOp, type DerivePreferenceInput, type SetOperatorPreferenceInput } from "./learningPreferenceFlow.js";
import {
  recordTrajectoryOp,
  replayTrajectoryOp,
  synthesizeTrajectoryStepsOp,
} from "./learningTrajectoryFlow.js";
import type { LearningConsentPort, LearningPlaneRecord, LearningServiceDeps, LearningServiceResult } from "./learningServiceTypes.js";
import { sortedLearningIds } from "./learningServiceTypes.js";

export interface LearningServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  readonly contentStore?: EvidenceContentStore;
}

/** The application-service authority over learning truth (W6A). */
export class LearningService {
  private readonly planes = new Map<OpaqueId, LearningPlaneRecord>();
  private readonly deps: LearningServiceDeps;
  private readonly contentStore: EvidenceContentStore;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
  ) {
    this.deps = { clock, ids };
    this.contentStore = contentStore;
  }

  /** Creates a deterministic service (injected clock + seeded ids/content). */
  static create(config: LearningServiceConfig): LearningService {
    const seed = config.seed ?? "you-w6a-learning-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new LearningService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
    );
  }

  // -- signals -------------------------------------------------------------

  /** Captures a learning signal (append-only; typed YOU_LEARNING_SIGNAL_INVALID refusals). */
  captureSignal(solutionId: OpaqueId, input: CaptureLearningSignalInput): LearningServiceResult<{ readonly signal: LearningSignal }> {
    return captureLearningSignalOp(this.planeFor(solutionId), this.deps, input);
  }

  signalOf(solutionId: OpaqueId, signalId: OpaqueId): LearningServiceResult<{ readonly signal: LearningSignal }> {
    const plane = this.planeFor(solutionId);
    const signal = plane.signals.get(signalId);
    return signal === undefined
      ? {
          ok: false,
          error: {
            code: "YOU_INVALID_STATE",
            message: "unknown learning signal",
            details: { reason: "unknown-signal", signalId },
            simulated: true,
          },
        }
      : { ok: true, value: { signal } };
  }

  /** All captured signals, sorted by id (listing). */
  signalsOf(solutionId: OpaqueId): readonly LearningSignal[] {
    const plane = this.planeFor(solutionId);
    return sortedLearningIds(plane.signals)
      .map((signalId) => plane.signals.get(signalId))
      .filter((signal): signal is LearningSignal => signal !== undefined);
  }

  // -- content + rights ------------------------------------------------------

  /** Deterministically synthesizes + stores the validated-learning content (fixture mode). */
  synthesizeLearningContent(
    solutionId: OpaqueId,
    input: { readonly seedText: string },
  ): LearningServiceResult<{ readonly contentRef: string; readonly contentHash: string }> {
    this.planeFor(solutionId);
    return synthesizeLearningContentOp({ ...this.deps, store: this.contentStore }, input);
  }

  /**
   * Issues a LearningRights grant bound to a LIVE wave-2 consent grant
   * (consentRef + consentHash; typed YOU_LEARNING_RIGHTS_REQUIRED
   * refusals — there is no second consent path).
   */
  issueRights(port: LearningConsentPort, input: IssueLearningRightsInput): LearningServiceResult<{ readonly rights: LearningRights }> {
    return issueLearningRightsOp(port, input);
  }

  // -- records (the validation ladder) ---------------------------------------

  /** Opens a candidate learning record over a captured signal (rights optional; inert without). */
  openCandidateRecord(solutionId: OpaqueId, input: OpenCandidateRecordInput): LearningServiceResult<{ readonly record: LearningRecord }> {
    return openCandidateRecordOp(this.planeFor(solutionId), this.deps, input);
  }

  recordOf(solutionId: OpaqueId, recordId: OpaqueId): LearningServiceResult<{ readonly record: LearningRecord }> {
    const plane = this.planeFor(solutionId);
    const record = plane.records.get(recordId);
    return record === undefined
      ? {
          ok: false,
          error: {
            code: "YOU_LEARNING_RECORD_NOT_FOUND",
            message: "unknown learning record",
            details: { reason: "unknown-learning-record", recordId },
            simulated: true,
          },
        }
      : { ok: true, value: { record } };
  }

  /** All learning records (candidates + resolved), sorted by id (listing). */
  recordsOf(solutionId: OpaqueId): readonly LearningRecord[] {
    const plane = this.planeFor(solutionId);
    return sortedLearningIds(plane.records)
      .map((recordId) => plane.records.get(recordId))
      .filter((record): record is LearningRecord => record !== undefined);
  }

  /** Validates a candidate (candidate -> validated; optional append-only supersession linkage). */
  validateRecord(solutionId: OpaqueId, input: ValidateLearningRecordInput): LearningServiceResult<{ readonly record: LearningRecord; readonly superseded: LearningRecord | null }> {
    return validateLearningRecordOp(this.planeFor(solutionId), this.deps, input);
  }

  /** Rejects a candidate (candidate -> rejected; terminal, append-only). */
  rejectRecord(solutionId: OpaqueId, input: { readonly recordId: OpaqueId; readonly reason: string }): LearningServiceResult<{ readonly record: LearningRecord }> {
    return rejectLearningRecordOp(this.planeFor(solutionId), this.deps, input);
  }

  /**
   * The usage gate (the RIGHTS LAW): a learning record is usable only
   * within its LearningRights grant — typed YOU_LEARNING_RIGHTS_REQUIRED
   * refusals; records without rights are inert.
   */
  useRecord(
    solutionId: OpaqueId,
    port: LearningConsentPort,
    input: { readonly recordId: OpaqueId; readonly usage: LearningRightUsage },
  ): LearningServiceResult<{ readonly record: LearningRecord; readonly usage: LearningRightUsage }> {
    return useLearningRecordOp(this.planeFor(solutionId), port, this.deps.clock.now(), input);
  }

  // -- preferences (projections; never mutate the ledger) ---------------------

  /** Derives a preference projection from a validated record (rights-gated; lineage-carrying). */
  derivePreference(
    solutionId: OpaqueId,
    port: LearningConsentPort,
    input: DerivePreferenceInput,
  ): LearningServiceResult<{ readonly preference: LearningPreference; readonly previous: LearningPreference | null }> {
    return derivePreferenceOp(this.planeFor(solutionId), this.deps, port, this.deps.clock.now(), input);
  }

  /** Upserts an operator-seeded preference (null lineage). */
  setOperatorPreference(
    solutionId: OpaqueId,
    input: SetOperatorPreferenceInput,
  ): LearningServiceResult<{ readonly preference: LearningPreference; readonly previous: LearningPreference | null }> {
    return setOperatorPreferenceOp(this.planeFor(solutionId), this.deps, input);
  }

  preferenceOf(solutionId: OpaqueId, scope: LearningScope, key: string): LearningPreference | null {
    return this.planeFor(solutionId).preferences.get(preferenceProjectionKey(scope, key)) ?? null;
  }

  /** All live preference projections, sorted by projection key (stable ordering). */
  preferencesOf(solutionId: OpaqueId): readonly LearningPreference[] {
    const plane = this.planeFor(solutionId);
    return [...plane.preferences.keys()]
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      .map((projectionKey) => plane.preferences.get(projectionKey))
      .filter((preference): preference is LearningPreference => preference !== undefined);
  }

  // -- trajectories ------------------------------------------------------------

  /** Deterministically synthesizes ordered trajectory steps (fixture mode; content-addressed). */
  synthesizeTrajectorySteps(
    solutionId: OpaqueId,
    input: { readonly seedText: string; readonly stepCount: number },
  ): LearningServiceResult<{ readonly stepRefs: readonly string[] }> {
    this.planeFor(solutionId);
    return synthesizeTrajectoryStepsOp({ ...this.deps, store: this.contentStore }, input);
  }

  /** Records a trajectory reference over ordered content-addressed step refs (append-only registry). */
  recordTrajectory(
    solutionId: OpaqueId,
    input: { readonly scope: LearningScope; readonly stepRefs: readonly string[] },
  ): LearningServiceResult<{ readonly trajectory: TrajectoryReference }> {
    return recordTrajectoryOp(this.planeFor(solutionId), this.deps, input);
  }

  trajectoryOf(solutionId: OpaqueId, trajectoryId: OpaqueId): LearningServiceResult<{ readonly trajectory: TrajectoryReference }> {
    const plane = this.planeFor(solutionId);
    const trajectory = plane.trajectories.get(trajectoryId);
    return trajectory === undefined
      ? {
          ok: false,
          error: {
            code: "YOU_INVALID_STATE",
            message: "unknown trajectory reference",
            details: { reason: "unknown-trajectory", trajectoryId },
            simulated: true,
          },
        }
      : { ok: true, value: { trajectory } };
  }

  /** All recorded trajectories, sorted by id (listing). */
  trajectoriesOf(solutionId: OpaqueId): readonly TrajectoryReference[] {
    const plane = this.planeFor(solutionId);
    return sortedLearningIds(plane.trajectories)
      .map((trajectoryId) => plane.trajectories.get(trajectoryId))
      .filter((trajectory): trajectory is TrajectoryReference => trajectory !== undefined);
  }

  /** Replays a recorded trajectory (byte-identical from seed; typed refusals on content violations). */
  replayTrajectory(
    solutionId: OpaqueId,
    trajectoryId: OpaqueId,
  ): LearningServiceResult<{ readonly trajectory: TrajectoryReference; readonly bytes: Uint8Array; readonly replayHash: string; readonly stepCount: number }> {
    return replayTrajectoryOp(this.planeFor(solutionId), this.contentStore, trajectoryId);
  }

  // -- reads / projection / persistence ----------------------------------------

  /** Live authoritative LEDGER projection (same shape as replayLearningLedger output). */
  projectionOf(solutionId: OpaqueId): LearningServiceResult<LearningPlaneProjection> {
    const plane = this.planeFor(solutionId);
    const signals: Record<string, LearningPlaneProjection["signals"][string]> = {};
    for (const signalId of sortedLearningIds(plane.signals)) {
      const signal = plane.signals.get(signalId);
      if (signal === undefined) {
        continue;
      }
      signals[signalId] = {
        kind: signal.kind,
        scope: signal.scope,
        subjectRef: signal.subjectRef ?? "",
        evidenceRefs: [...signal.evidenceRefs],
        capturedAt: signal.capturedAt,
        simulated: signal.simulated,
      };
    }
    const records: Record<string, LearningPlaneProjection["records"][string]> = {};
    for (const recordId of sortedLearningIds(plane.records)) {
      const record = plane.records.get(recordId);
      if (record === undefined || record.status === "candidate") {
        continue;
      }
      records[recordId] = {
        signalId: record.signalId,
        status: record.status,
        scope: record.scope,
        contentRef: record.contentRef,
        contentHash: record.contentHash,
        usage: [...record.rights.usage],
        consentRef: record.rights.consentRef,
        consentHash: record.rights.consentHash,
        expiresAt: record.rights.expiresAt ?? "",
        supersededById: record.supersededById ?? "",
        validatedAt: record.validatedAt,
        simulated: record.simulated,
      };
    }
    const preferences: Record<string, LearningPlaneProjection["preferences"][string]> = {};
    for (const projectionKey of [...plane.preferences.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
      const preference = plane.preferences.get(projectionKey);
      if (preference === undefined) {
        continue;
      }
      preferences[projectionKey] = {
        id: preference.id,
        scope: preference.scope,
        key: preference.key,
        value: preference.value,
        derivedFromRecordId: preference.derivedFromRecordId ?? "",
        updatedAt: preference.updatedAt,
      };
    }
    return { ok: true, value: { solutionId, signals, records, preferences } };
  }

  ledgerEventsOf(solutionId: OpaqueId): LearningServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): LearningServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): LearningServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Number of stored learning content refs (fixture observability). */
  contentStoreSize(): number {
    return this.contentStore.size;
  }

  /** Replays a persisted ledger through the shared learning-plane fold. */
  static replay(events: readonly SolutionEvent[]): LearningPlaneProjection {
    return replayLearningLedger(events);
  }

  // -- internals -----------------------------------------------------------

  /** Lazily opens (and caches) the learning plane for one solution. */
  private planeFor(solutionId: OpaqueId): LearningPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: LearningPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.deps),
      signals: new Map(),
      signalIds: [],
      records: new Map(),
      recordIds: [],
      preferences: new Map(),
      trajectories: new Map(),
      trajectoryIds: [],
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** Creates the deterministic learning application service. */
export function createLearningService(config: LearningServiceConfig): LearningService {
  return LearningService.create(config);
}
