// YOU platform application service — the single authority over
// platform-hardening truth (docs/you/CONTRACTS.md "Wave-10 contract
// freeze (v10)"; WORK_ORDERS.md W10A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one platform plane per solution: the
// append-only SolutionEventLedger, the rate-limit policy registries +
// fixed-window counters, the import verdict registry + quarantine
// lifecycle + explicit release records, the retention enforcement
// passes and the DR restore records. The op bodies live in the flow
// modules (rateLimitFlow / importSecurityFlow / retentionFlow /
// drRestoreFlow — the W1A/W8A flow precedent); this class is the
// dispatch authority.
//
// Plane separation: this service NEVER mutates evidence/twin/editing
// state. A retention pass records its class becoming due (the content
// effect stays with the evidence authority); a DR restore verifies
// snapshot content through the shared content-store abstraction and
// records the outcome — nothing crosses planes.
//
// THE RATE LIMIT LAW holds by construction: every effect op gates
// through the limiter BEFORE its effect (see rateLimitFlow.ts).
// Error-code mapping: see platformServiceTypes.ts for the frozen W10A
// taxonomy. Phase 0 is fully deterministic: injected clock + seeded
// RNG; everything simulated stays labeled `simulated: true` (truth
// law). Rate-limit policies are pre-validation SERVICE STATE (the
// W6A/W8A candidate-record precedent — the frozen wave-10 event set
// has no policy event); clean/rejected import verdicts are
// pre-admission service state (the arena provider precedent).

import type {
  ConsentState,
  DrRestoreRecord,
  ImportSecurityVerdict,
  OpaqueId,
  RateLimitPolicy,
  RetentionEnforcementRecord,
  SolutionEvent,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import type { RateLimitPolicyInput } from "../../../shared/src/you/rateLimitPolicy.js";
import type { ImportReleaseInput, ImportReleaseRecord, ImportScanInput } from "../../../shared/src/you/importSecurity.js";
import type { DrRestoreCheckEvidence, DrRestoreInput } from "../../../shared/src/you/drRestore.js";
import type { RetentionEnforcementInput } from "../../../shared/src/you/retentionEnforcement.js";
import { replayPlatformLedger, type PlatformPlaneProjection } from "../../../shared/src/you/platformLedger.js";
import { buildPlatformPlaneProjection } from "./platformProjection.js";
import {
  activePolicyForScope,
  platformFailure,
  readImportStatus,
  requireDrRestore,
  requireImportVerdict,
  sortedMapKeys,
  type PlatformFlowDeps,
  type PlatformPlaneRecord,
  type PlatformServiceResult,
} from "./platformServiceTypes.js";
import { gateRateLimitOp, registerRateLimitPolicyOp, type RateLimitGateOutcome } from "./rateLimitFlow.js";
import {
  admitImportOp,
  releaseQuarantinedImportOp,
  scanImportOp,
} from "./importSecurityFlow.js";
import { enforceRetentionOp } from "./retentionFlow.js";
import { restoreSnapshotOp } from "./drRestoreFlow.js";

export interface PlatformServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  /** Content store for DR snapshot verification (same abstraction as the evidence lane). */
  readonly contentStore?: EvidenceContentStore;
}

/** The application-service authority over platform-hardening truth. */
export class PlatformService {
  private readonly planes = new Map<OpaqueId, PlatformPlaneRecord>();
  private readonly flowDeps: PlatformFlowDeps;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
  ) {
    this.flowDeps = { clock, ids, store: contentStore };
  }

  /** Creates a deterministic service (injected clock + seeded ids/DR snapshot content). */
  static create(config: PlatformServiceConfig): PlatformService {
    const seed = config.seed ?? "you-w10a-platform-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new PlatformService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
    );
  }

  // -- rate-limit policies ------------------------------------------------------

  /**
   * Registers a rate-limit policy for a scope (the head becomes active).
   * Refusals: typed YOU_INVALID_STATE for intake shape (the arena
   * gap-intake precedent — the wave-10 code set reserves
   * YOU_RATE_LIMIT_EXCEEDED for enforcement).
   */
  registerRateLimitPolicy(
    solutionId: OpaqueId,
    input: RateLimitPolicyInput,
  ): PlatformServiceResult<{ readonly policy: RateLimitPolicy }> {
    return registerRateLimitPolicyOp(this.planeFor(solutionId), input, this.flowDeps.ids.next.bind(this.flowDeps.ids));
  }

  /** The active (head) policy for a scope, or typed YOU_INVALID_STATE when none is registered. */
  activeRateLimitPolicyOf(
    solutionId: OpaqueId,
    scope: string,
  ): PlatformServiceResult<{ readonly policy: RateLimitPolicy }> {
    const policy = activePolicyForScope(this.planeFor(solutionId), scope);
    if (policy === null) {
      return platformFailure("YOU_INVALID_STATE", "no active rate limit policy registered for the scope", {
        reason: "no-active-policy",
        scope,
      });
    }
    return { ok: true, value: { policy } };
  }

  /**
   * THE GATE (the RATE LIMIT LAW's exposed surface): evaluates the active
   * policy for a scope, records the enforcement and returns the decision.
   * Exceeded -> typed YOU_RATE_LIMIT_EXCEEDED (never silent). Unlimited
   * scope (no policy) -> allowed, no record.
   */
  checkRateLimit(
    solutionId: OpaqueId,
    scope: string,
    subject: OpaqueId,
  ): PlatformServiceResult<RateLimitGateOutcome> {
    return gateRateLimitOp(this.planeFor(solutionId), this.flowDeps, scope, subject);
  }

  /** The live fixed-window usage head per scope (observability). */
  rateLimitUsageOf(
    solutionId: OpaqueId,
  ): PlatformServiceResult<{ readonly usage: Readonly<Record<string, { readonly windowStart: string; readonly used: number }>> }> {
    const plane = this.planeFor(solutionId);
    const usage: Record<string, { windowStart: string; used: number }> = {};
    for (const scope of [...plane.rateLimitUsage.keys()].sort()) {
      const state = plane.rateLimitUsage.get(scope);
      if (state !== undefined) {
        usage[scope] = { windowStart: state.windowStart, used: state.used };
      }
    }
    return { ok: true, value: { usage } };
  }

  // -- import security ----------------------------------------------------------

  /**
   * Scans an import (the deterministic verdict rule; the RATE LIMIT LAW
   * gates before the effect). A quarantined verdict emits the
   * fail-closed `import-quarantined` event.
   */
  scanImport(solutionId: OpaqueId, input: ImportScanInput): PlatformServiceResult<{ readonly verdict: ImportSecurityVerdict }> {
    return scanImportOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /** The recorded verdict for an artifact, or typed YOU_IMPORT_QUARANTINED (unscanned). */
  importVerdictOf(
    solutionId: OpaqueId,
    artifactRef: OpaqueId,
  ): PlatformServiceResult<{ readonly verdict: ImportSecurityVerdict }> {
    const found = requireImportVerdict(this.planeFor(solutionId), artifactRef);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { verdict: found.verdict } };
  }

  /** The quarantine lifecycle head of an artifact (null when unscanned). */
  importStatusOf(solutionId: OpaqueId, artifactRef: OpaqueId): ImportQuarantineStatusRead {
    return readImportStatus(this.planeFor(solutionId), artifactRef);
  }

  /**
   * Releases a QUARANTINED import through an explicit release record (the
   * ONLY path out of quarantine). Emits the `import-quarantined` event
   * with phase "released". Refusals: typed YOU_IMPORT_QUARANTINED for
   * lifecycle violations.
   */
  releaseQuarantinedImport(
    solutionId: OpaqueId,
    artifactRef: OpaqueId,
    input: ImportReleaseInput,
  ): PlatformServiceResult<{ readonly release: ImportReleaseRecord }> {
    return releaseQuarantinedImportOp(this.planeFor(solutionId), this.flowDeps, artifactRef, input);
  }

  /**
   * The admission gate (the IMPORT SECURITY LAW): unscanned/quarantined/
   * rejected imports never enter evidence — typed YOU_IMPORT_QUARANTINED.
   */
  admitImport(
    solutionId: OpaqueId,
    artifactRef: OpaqueId,
  ): PlatformServiceResult<{ readonly verdict: ImportSecurityVerdict; readonly admissionReason: string }> {
    return admitImportOp(this.planeFor(solutionId), this.flowDeps, artifactRef);
  }

  // -- retention enforcement ----------------------------------------------------

  /**
   * Records one retention enforcement pass (immutable, auditable). The
   * subject's effective consent state is resolved by the caller through
   * the wave-2 consent authority; a granted consent refuses the pass
   * (consent-protected — a retention class NEVER overrides an active
   * consent; typed YOU_RETENTION_ENFORCEMENT_INVALID). Emits
   * retention-enforced.
   */
  enforceRetention(
    solutionId: OpaqueId,
    input: RetentionEnforcementInput,
    consentState: ConsentState,
  ): PlatformServiceResult<{ readonly record: RetentionEnforcementRecord; readonly consentState: ConsentState }> {
    return enforceRetentionOp(this.planeFor(solutionId), this.flowDeps, input, consentState);
  }

  /** All recorded retention passes, sorted by id. */
  retentionPassesOf(
    solutionId: OpaqueId,
  ): PlatformServiceResult<{ readonly passes: readonly RetentionEnforcementRecord[] }> {
    const plane = this.planeFor(solutionId);
    const passes = sortedMapKeys(plane.retentionPasses)
      .map((recordId) => plane.retentionPasses.get(recordId))
      .filter((record): record is RetentionEnforcementRecord => record !== undefined);
    return { ok: true, value: { passes } };
  }

  // -- DR restore ---------------------------------------------------------------

  /**
   * Restores a DR snapshot: content-hash verification BEFORE activation
   * (the DR LAW). Verified -> the record activates (the plane's restore
   * head) with check evidence riding the `dr-restore-recorded` event.
   * Hash mismatch -> the failed attempt is recorded (verified: false,
   * never activated) and refused with typed YOU_DR_RESTORE_INVALID.
   * Missing snapshot ref -> typed refusal (nothing exists to audit).
   */
  restoreSnapshot(
    solutionId: OpaqueId,
    input: DrRestoreInput,
  ): PlatformServiceResult<{ readonly record: DrRestoreRecord; readonly evidence: DrRestoreCheckEvidence }> {
    return restoreSnapshotOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /** All recorded DR restore attempts, sorted by id (verified and failed alike). */
  drRestoresOf(solutionId: OpaqueId): PlatformServiceResult<{ readonly restores: readonly DrRestoreRecord[] }> {
    const plane = this.planeFor(solutionId);
    const restores = sortedMapKeys(plane.drRestores)
      .map((restoreId) => plane.drRestores.get(restoreId))
      .filter((record): record is DrRestoreRecord => record !== undefined);
    return { ok: true, value: { restores } };
  }

  /** The recorded restore, or typed YOU_DR_RESTORE_INVALID. */
  restoreOf(solutionId: OpaqueId, restoreId: OpaqueId): PlatformServiceResult<{ readonly record: DrRestoreRecord }> {
    const found = requireDrRestore(this.planeFor(solutionId), restoreId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { record: found.record } };
  }

  /** The activated restore head (the latest verified restore; null until one exists). */
  activeDrRestoreOf(solutionId: OpaqueId): PlatformServiceResult<{ readonly record: DrRestoreRecord | null }> {
    const plane = this.planeFor(solutionId);
    const head = plane.activeRestoreId === null ? null : plane.drRestores.get(plane.activeRestoreId) ?? null;
    return { ok: true, value: { record: head } };
  }

  // -- reads / projection / persistence ---------------------------------------

  ledgerEventsOf(solutionId: OpaqueId): PlatformServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): PlatformServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): PlatformServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Live authoritative projection (same shape as replayPlatformLedger output). */
  projectionOf(solutionId: OpaqueId): PlatformServiceResult<PlatformPlaneProjection> {
    return { ok: true, value: buildPlatformPlaneProjection(this.planeFor(solutionId)) };
  }

  /** Number of stored DR snapshot content refs (fixture observability). */
  contentStoreSize(): number {
    return this.flowDeps.store.size;
  }

  /** Replays a persisted ledger through the shared platform-plane fold. */
  static replay(events: readonly SolutionEvent[]): PlatformPlaneProjection {
    return replayPlatformLedger(events);
  }

  // -- internals ---------------------------------------------------------------

  /** Lazily opens (and caches) the platform plane for one solution. */
  private planeFor(solutionId: OpaqueId): PlatformPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: PlatformPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.flowDeps),
      policies: new Map(),
      rateLimitUsage: new Map(),
      importVerdicts: new Map(),
      importFindings: new Map(),
      importStatuses: new Map(),
      importReleases: new Map(),
      retentionPasses: new Map(),
      drRestores: new Map(),
      activeRestoreId: null,
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** The quarantine lifecycle readout (null when the artifact is unscanned). */
export type ImportQuarantineStatusRead = import("../../../shared/src/you/importSecurity.js").ImportQuarantineStatus | null;

/** Creates the deterministic platform application service. */
export function createPlatformService(config: PlatformServiceConfig): PlatformService {
  return PlatformService.create(config);
}
