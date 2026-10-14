// YOU launch-gate application service — the single authority over
// launch-gate truth (docs/you/CONTRACTS.md "Wave-12 contract freeze
// (v12)"; WORK_ORDERS.md W12A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one launch-gate plane per solution:
// the append-only SolutionEventLedger, the immutable 20-point
// checklists assembled from E2eJourneyRecord evidence, the immutable
// operator signoffs and the immutable release declarations. The op
// bodies live in the flow modules (launchGateChecklistFlow /
// operatorSignoffFlow / releaseDeclarationFlow — the W1A/W8A/W10A/W11A
// flow precedent); this class is the dispatch authority.
//
// Plane separation: this service NEVER mutates evidence/twin/editing/
// platform/security state. It records launch-gate facts only.
//
// THE LAUNCH GATE LAW, THE OPERATOR SIGNOFF LAW and THE RELEASE
// DECLARATION LAW hold by construction (see the flow modules and the
// shared stateless authorities). Error-code mapping: see
// launchGateServiceTypes.ts for the frozen W12A taxonomy. Phase 0 is
// fully deterministic: injected clock + seeded RNG; everything
// simulated stays labeled `simulated: true` (truth law).

import type {
  LaunchGateChecklistRecord,
  OpaqueId,
  OperatorSignoffRecord,
  ReleaseDeclarationRecord,
  SolutionEvent,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import type { LaunchGateChecklistIntake } from "../../../shared/src/you/launchGate.js";
import { launchGatePassedCount, launchGatePasses } from "../../../shared/src/you/launchGate.js";
import type { OperatorSignoffInput } from "../../../shared/src/you/operatorSignoff.js";
import type { ReleaseDeclarationInput } from "../../../shared/src/you/releaseDeclaration.js";
import { replayLaunchGateLedger, type LaunchGatePlaneProjection } from "../../../shared/src/you/launchGateLedger.js";
import { buildLaunchGatePlaneProjection } from "./launchGateProjection.js";
import {
  requireLaunchGateChecklist,
  requireOperatorSignoff,
  requireReleaseDeclaration,
  sortedLaunchGateMapKeys,
  type LaunchGateChecklistStatus,
  type LaunchGateFlowDeps,
  type LaunchGatePlaneRecord,
  type LaunchGateServiceResult,
} from "./launchGateServiceTypes.js";
import { assembleLaunchGateChecklistOp } from "./launchGateChecklistFlow.js";
import { signOperatorChecklistOp } from "./operatorSignoffFlow.js";
import { declareReleaseOp } from "./releaseDeclarationFlow.js";

export interface LaunchGateServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
}

/** The application-service authority over launch-gate truth. */
export class LaunchGateService {
  private readonly planes = new Map<OpaqueId, LaunchGatePlaneRecord>();
  private readonly flowDeps: LaunchGateFlowDeps;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
  ) {
    this.flowDeps = { clock, ids };
  }

  /** Creates a deterministic service (injected clock + seeded ids). */
  static create(config: LaunchGateServiceConfig): LaunchGateService {
    const seed = config.seed ?? "you-w12a-launch-gate-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new LaunchGateService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
    );
  }

  // -- launch-gate checklists --------------------------------------------------------

  /**
   * Assembles one launch-gate checklist from journey evidence (one
   * E2eJourneyRecord or null per point, in point order). THE LAUNCH
   * GATE LAW: a point passes ONLY with a successful journey reference —
   * passed is DERIVED inside the single authority, never asserted by
   * the caller; the gate passes ONLY when all 20 points pass. Emits
   * `launch-gate-checked`. Refusals: typed YOU_LAUNCH_GATE_INVALID for
   * checklist-incomplete (wrong evidence count) and journey-evidence
   * shape.
   */
  assembleLaunchGateChecklist(
    solutionId: OpaqueId,
    intake: LaunchGateChecklistIntake,
  ): LaunchGateServiceResult<{
    readonly record: LaunchGateChecklistRecord;
    readonly passedCount: number;
    readonly gatePassed: boolean;
  }> {
    return assembleLaunchGateChecklistOp(this.planeFor(solutionId), this.flowDeps, intake);
  }

  /** All assembled checklists, sorted by id. */
  launchGateChecklistsOf(
    solutionId: OpaqueId,
  ): LaunchGateServiceResult<{ readonly checklists: readonly LaunchGateChecklistRecord[] }> {
    const plane = this.planeFor(solutionId);
    const checklists = sortedLaunchGateMapKeys(plane.checklists)
      .map((checklistId) => plane.checklists.get(checklistId))
      .filter((record): record is LaunchGateChecklistRecord => record !== undefined);
    return { ok: true, value: { checklists } };
  }

  /** The assembled checklist, or typed YOU_LAUNCH_GATE_INVALID. */
  launchGateChecklistOf(solutionId: OpaqueId, checklistId: OpaqueId): LaunchGateServiceResult<{ readonly record: LaunchGateChecklistRecord }> {
    const found = requireLaunchGateChecklist(this.planeFor(solutionId), checklistId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { record: found.record } };
  }

  /**
   * The checklist's gate facts and lifecycle head (checked -> signed ->
   * released; a failing gate stays "checked" forever — it can never be
   * signed), or typed YOU_LAUNCH_GATE_INVALID.
   */
  launchGateStatusOf(
    solutionId: OpaqueId,
    checklistId: OpaqueId,
  ): LaunchGateServiceResult<{
    readonly status: LaunchGateChecklistStatus;
    readonly passedCount: number;
    readonly gatePassed: boolean;
  }> {
    const plane = this.planeFor(solutionId);
    const found = requireLaunchGateChecklist(plane, checklistId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const signoffId = plane.signedChecklists.get(checklistId);
    const status: LaunchGateChecklistStatus =
      signoffId === undefined ? "checked" : plane.declaredSignoffs.has(signoffId) ? "released" : "signed";
    return {
      ok: true,
      value: {
        status,
        passedCount: launchGatePassedCount(found.record),
        gatePassed: launchGatePasses(found.record),
      },
    };
  }

  // -- operator signoffs ---------------------------------------------------------------

  /**
   * Signs one launch-gate checklist. THE OPERATOR SIGNOFF LAW: the
   * signoff references a COMPLETE passing checklist; it is immutable
   * (a re-sign is refused — "already-signed"); one release declaration
   * per signoff. Emits `operator-signoff-recorded`. Refusals: typed
   * YOU_OPERATOR_SIGNOFF_INVALID for unknown-checklist,
   * checklist-not-passing (a signoff without a passing gate),
   * already-signed and signed-by-empty.
   */
  signOperatorChecklist(
    solutionId: OpaqueId,
    checklistId: OpaqueId,
    input: OperatorSignoffInput,
  ): LaunchGateServiceResult<{ readonly signoff: OperatorSignoffRecord }> {
    return signOperatorChecklistOp(this.planeFor(solutionId), this.flowDeps, checklistId, input);
  }

  /** All recorded signoffs, sorted by id. */
  operatorSignoffsOf(solutionId: OpaqueId): LaunchGateServiceResult<{ readonly signoffs: readonly OperatorSignoffRecord[] }> {
    const plane = this.planeFor(solutionId);
    const signoffs = sortedLaunchGateMapKeys(plane.signoffs)
      .map((signoffId) => plane.signoffs.get(signoffId))
      .filter((signoff): signoff is OperatorSignoffRecord => signoff !== undefined);
    return { ok: true, value: { signoffs } };
  }

  /** The recorded signoff, or typed YOU_OPERATOR_SIGNOFF_INVALID. */
  operatorSignoffOf(solutionId: OpaqueId, signoffId: OpaqueId): LaunchGateServiceResult<{ readonly signoff: OperatorSignoffRecord }> {
    const found = requireOperatorSignoff(this.planeFor(solutionId), signoffId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { signoff: found.signoff } };
  }

  /** The signoff that signed a checklist, or typed refusal (no-signoff while unchecked). */
  operatorSignoffOfChecklist(
    solutionId: OpaqueId,
    checklistId: OpaqueId,
  ): LaunchGateServiceResult<{ readonly signoff: OperatorSignoffRecord }> {
    const plane = this.planeFor(solutionId);
    const signoffId = plane.signedChecklists.get(checklistId);
    if (signoffId === undefined) {
      return {
        ok: false,
        error: {
          code: "YOU_OPERATOR_SIGNOFF_INVALID",
          message: "checklist has no operator signoff",
          details: { reason: "no-signoff", checklistId },
          simulated: true,
        },
      };
    }
    return this.operatorSignoffOf(solutionId, signoffId);
  }

  // -- release declarations -------------------------------------------------------------

  /**
   * Declares one release over an operator signoff. THE RELEASE
   * DECLARATION LAW: the declaration carries the full evidence bundle
   * reference AND rollback evidence (the production-eligibility law
   * carried to the release); one release declaration per signoff (a
   * re-declaration is refused — "already-declared"). Emits
   * `release-declared`. Refusals: typed YOU_RELEASE_DECLARATION_INVALID
   * for rollback-evidence-ref-empty, evidence-bundle-ref-empty,
   * unknown-signoff and already-declared.
   */
  declareRelease(
    solutionId: OpaqueId,
    signoffId: OpaqueId,
    input: ReleaseDeclarationInput,
  ): LaunchGateServiceResult<{ readonly declaration: ReleaseDeclarationRecord }> {
    return declareReleaseOp(this.planeFor(solutionId), this.flowDeps, signoffId, input);
  }

  /** All recorded declarations, sorted by id. */
  releaseDeclarationsOf(solutionId: OpaqueId): LaunchGateServiceResult<{ readonly declarations: readonly ReleaseDeclarationRecord[] }> {
    const plane = this.planeFor(solutionId);
    const declarations = sortedLaunchGateMapKeys(plane.declarations)
      .map((declarationId) => plane.declarations.get(declarationId))
      .filter((declaration): declaration is ReleaseDeclarationRecord => declaration !== undefined);
    return { ok: true, value: { declarations } };
  }

  /** The recorded declaration, or typed YOU_RELEASE_DECLARATION_INVALID. */
  releaseDeclarationOf(solutionId: OpaqueId, declarationId: OpaqueId): LaunchGateServiceResult<{ readonly declaration: ReleaseDeclarationRecord }> {
    const found = requireReleaseDeclaration(this.planeFor(solutionId), declarationId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { declaration: found.declaration } };
  }

  /** The declaration declared over a signoff, or typed refusal (no-declaration while signed-only). */
  releaseDeclarationOfSignoff(
    solutionId: OpaqueId,
    signoffId: OpaqueId,
  ): LaunchGateServiceResult<{ readonly declaration: ReleaseDeclarationRecord }> {
    const plane = this.planeFor(solutionId);
    const declarationId = plane.declaredSignoffs.get(signoffId);
    if (declarationId === undefined) {
      return {
        ok: false,
        error: {
          code: "YOU_RELEASE_DECLARATION_INVALID",
          message: "signoff has no release declaration",
          details: { reason: "no-declaration", signoffId },
          simulated: true,
        },
      };
    }
    return this.releaseDeclarationOf(solutionId, declarationId);
  }

  // -- reads / projection / persistence ------------------------------------------------

  ledgerEventsOf(solutionId: OpaqueId): LaunchGateServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): LaunchGateServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): LaunchGateServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Live authoritative projection (same shape as replayLaunchGateLedger output). */
  projectionOf(solutionId: OpaqueId): LaunchGateServiceResult<LaunchGatePlaneProjection> {
    return { ok: true, value: buildLaunchGatePlaneProjection(this.planeFor(solutionId)) };
  }

  /** Replays a persisted ledger through the shared launch-gate-plane fold. */
  static replay(events: readonly SolutionEvent[]): LaunchGatePlaneProjection {
    return replayLaunchGateLedger(events);
  }

  // -- internals -------------------------------------------------------------------------

  /** Lazily opens (and caches) the launch-gate plane for one solution. */
  private planeFor(solutionId: OpaqueId): LaunchGatePlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: LaunchGatePlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.flowDeps),
      checklists: new Map(),
      signoffs: new Map(),
      declarations: new Map(),
      signedChecklists: new Map(),
      declaredSignoffs: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** Creates the deterministic launch-gate application service. */
export function createLaunchGateService(config: LaunchGateServiceConfig): LaunchGateService {
  return LaunchGateService.create(config);
}
