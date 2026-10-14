// YOU security application service — the single authority over
// hardening-verification truth (docs/you/CONTRACTS.md "Wave-11 contract
// freeze (v11)"; WORK_ORDERS.md W11A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one security plane per solution: the
// append-only SolutionEventLedger, the immutable threat-model entries,
// the immutable review records + their verbatim finding sets +
// lifecycle heads + separate acceptance decisions, and the immutable
// load-test reports + their measurements. The op bodies live in the
// flow modules (threatModelFlow / securityReviewFlow / loadTestFlow —
// the W1A/W8A/W10A flow precedent); this class is the dispatch
// authority.
//
// Plane separation: this service NEVER mutates evidence/twin/editing/
// platform state. It records hardening-verification facts only.
//
// THE SECURITY REVIEW LAW and THE LOAD TEST LAW hold by construction
// (see the flow modules). Error-code mapping: see
// securityServiceTypes.ts for the frozen W11A taxonomy. Phase 0 is
// fully deterministic: injected clock + seeded RNG; everything
// simulated stays labeled `simulated: true` (truth law).
// Threat-model entries are pre-review SERVICE STATE (the rate-limit
// policy precedent — the frozen wave-11 event set has no threat-model
// event; entries materialize in the ledger only through their review
// facts).

import type {
  LoadTestReport,
  OpaqueId,
  SecurityReviewRecord,
  SolutionEvent,
  ThreatModelEntry,
} from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import type { ThreatModelInput } from "../../../shared/src/you/threatModel.js";
import type { SecurityReviewAcceptance, SecurityReviewAcceptanceInput, SecurityReviewFinding, SecurityReviewIntake } from "../../../shared/src/you/securityReview.js";
import type { LoadTestMeasurement } from "../../../shared/src/you/loadTest.js";
import { replaySecurityLedger, type SecurityPlaneProjection } from "../../../shared/src/you/securityLedger.js";
import { buildSecurityPlaneProjection } from "./securityProjection.js";
import {
  requireLoadTestReport,
  requireSecurityReview,
  requireSecurityReviewAcceptance,
  requireThreatModelEntry,
  sortedMapKeys,
  type SecurityFlowDeps,
  type SecurityPlaneRecord,
  type SecurityReviewStatus,
  type SecurityServiceResult,
} from "./securityServiceTypes.js";
import { recordThreatModelEntryOp } from "./threatModelFlow.js";
import { acceptSecurityReviewOp, recordSecurityReviewOp } from "./securityReviewFlow.js";
import { runLoadTestOp, type LoadTestRunInput } from "./loadTestFlow.js";

export interface SecurityServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
}

/** The application-service authority over hardening-verification truth. */
export class SecurityService {
  private readonly planes = new Map<OpaqueId, SecurityPlaneRecord>();
  private readonly flowDeps: SecurityFlowDeps;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
  ) {
    this.flowDeps = { clock, ids };
  }

  /** Creates a deterministic service (injected clock + seeded ids). */
  static create(config: SecurityServiceConfig): SecurityService {
    const seed = config.seed ?? "you-w11a-security-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new SecurityService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
    );
  }

  // -- threat model ---------------------------------------------------------------

  /**
   * Records one immutable threat-model entry (the honesty law: residual
   * stated on every entry, never zeroed by assertion; mitigationRef null
   * recorded honestly when unmitigated). Refusals: typed
   * YOU_SECURITY_REVIEW_INVALID for intake shape.
   */
  recordThreatModelEntry(
    solutionId: OpaqueId,
    input: ThreatModelInput,
  ): SecurityServiceResult<{ readonly entry: ThreatModelEntry }> {
    return recordThreatModelEntryOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /** All recorded threat-model entries, sorted by id. */
  threatModelOfSolution(
    solutionId: OpaqueId,
  ): SecurityServiceResult<{ readonly entries: readonly ThreatModelEntry[] }> {
    const plane = this.planeFor(solutionId);
    const entries = sortedMapKeys(plane.threatModel)
      .map((entryId) => plane.threatModel.get(entryId))
      .filter((entry): entry is ThreatModelEntry => entry !== undefined);
    return { ok: true, value: { entries } };
  }

  /** The recorded entry, or typed YOU_SECURITY_REVIEW_INVALID. */
  threatModelOf(solutionId: OpaqueId, entryId: OpaqueId): SecurityServiceResult<{ readonly entry: ThreatModelEntry }> {
    const found = requireThreatModelEntry(this.planeFor(solutionId), entryId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { entry: found.entry } };
  }

  // -- security reviews ------------------------------------------------------------

  /**
   * Records one security review pass: the immutable birth record (accepted:
   * false) with its findings stored verbatim. Emits
   * `security-review-recorded` (phase "recorded"). Refusals: typed
   * YOU_SECURITY_REVIEW_INVALID for intake shape.
   */
  recordSecurityReview(
    solutionId: OpaqueId,
    input: SecurityReviewIntake,
  ): SecurityServiceResult<{ readonly record: SecurityReviewRecord; readonly findings: readonly SecurityReviewFinding[] }> {
    return recordSecurityReviewOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /**
   * Accepts a recorded review through the separate immutable decision
   * referencing the finding set (count + digest). Emits
   * `security-review-recorded` (phase "accepted"). THE SECURITY REVIEW
   * LAW: an empty finding set cannot be accepted
   * ("acceptance-without-findings"); an accepted review cannot be
   * re-accepted ("already-accepted").
   */
  acceptSecurityReview(
    solutionId: OpaqueId,
    reviewId: OpaqueId,
    input: SecurityReviewAcceptanceInput,
  ): SecurityServiceResult<{ readonly acceptance: SecurityReviewAcceptance }> {
    return acceptSecurityReviewOp(this.planeFor(solutionId), this.flowDeps, reviewId, input);
  }

  /** All recorded reviews, sorted by id (both statuses). */
  securityReviewsOf(
    solutionId: OpaqueId,
  ): SecurityServiceResult<{ readonly reviews: readonly SecurityReviewRecord[] }> {
    const plane = this.planeFor(solutionId);
    const reviews = sortedMapKeys(plane.reviews)
      .map((reviewId) => plane.reviews.get(reviewId))
      .filter((record): record is SecurityReviewRecord => record !== undefined);
    return { ok: true, value: { reviews } };
  }

  /** The recorded review, or typed YOU_SECURITY_REVIEW_INVALID. */
  securityReviewOf(solutionId: OpaqueId, reviewId: OpaqueId): SecurityServiceResult<{ readonly record: SecurityReviewRecord }> {
    const found = requireSecurityReview(this.planeFor(solutionId), reviewId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { record: found.record } };
  }

  /** The lifecycle head of a review (recorded | accepted), or typed refusal. */
  securityReviewStatusOf(solutionId: OpaqueId, reviewId: OpaqueId): SecurityServiceResult<{ readonly status: SecurityReviewStatus }> {
    const plane = this.planeFor(solutionId);
    const found = requireSecurityReview(plane, reviewId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    return { ok: true, value: { status: plane.reviewStatuses.get(reviewId) === "accepted" ? "accepted" : "recorded" } };
  }

  /** The verbatim finding set of a review (""-empty for a clean pass), or typed refusal. */
  securityReviewFindingsOf(
    solutionId: OpaqueId,
    reviewId: OpaqueId,
  ): SecurityServiceResult<{ readonly findings: readonly SecurityReviewFinding[] }> {
    const plane = this.planeFor(solutionId);
    const found = requireSecurityReview(plane, reviewId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    return { ok: true, value: { findings: plane.reviewFindings.get(reviewId) ?? [] } };
  }

  /** The acceptance decision of a review, or typed refusal (no-acceptance while recorded). */
  securityReviewAcceptanceOf(
    solutionId: OpaqueId,
    reviewId: OpaqueId,
  ): SecurityServiceResult<{ readonly acceptance: SecurityReviewAcceptance }> {
    const found = requireSecurityReviewAcceptance(this.planeFor(solutionId), reviewId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { acceptance: found.acceptance } };
  }

  // -- load tests -------------------------------------------------------------------

  /**
   * Runs one load test: the immutable report constructed FROM the
   * measurement (peak/p99 verbatim — never invented; measured or
   * simulated-labeled) with the regressions listed verbatim. Emits
   * `load-test-recorded`. Refusals: typed YOU_LOAD_TEST_INVALID for
   * invented metrics and malformed reports.
   */
  runLoadTest(
    solutionId: OpaqueId,
    input: LoadTestRunInput,
  ): SecurityServiceResult<{ readonly report: LoadTestReport; readonly measurement: LoadTestMeasurement }> {
    return runLoadTestOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /** All recorded load-test reports, sorted by id. */
  loadTestsOf(solutionId: OpaqueId): SecurityServiceResult<{ readonly reports: readonly LoadTestReport[] }> {
    const plane = this.planeFor(solutionId);
    const reports = sortedMapKeys(plane.loadTests)
      .map((reportId) => plane.loadTests.get(reportId))
      .filter((report): report is LoadTestReport => report !== undefined);
    return { ok: true, value: { reports } };
  }

  /** The recorded report, or typed YOU_LOAD_TEST_INVALID. */
  loadTestOf(solutionId: OpaqueId, reportId: OpaqueId): SecurityServiceResult<{ readonly report: LoadTestReport }> {
    const found = requireLoadTestReport(this.planeFor(solutionId), reportId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { report: found.report } };
  }

  /** The measurement the report states verbatim, or typed YOU_LOAD_TEST_INVALID. */
  loadTestMeasurementOf(
    solutionId: OpaqueId,
    reportId: OpaqueId,
  ): SecurityServiceResult<{ readonly measurement: LoadTestMeasurement }> {
    const plane = this.planeFor(solutionId);
    const found = requireLoadTestReport(plane, reportId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const measurement = plane.loadTestMeasurements.get(reportId);
    if (measurement === undefined) {
      return {
        ok: false,
        error: {
          code: "YOU_LOAD_TEST_INVALID",
          message: "unknown load-test measurement",
          details: { reason: "unknown-load-test", reportId },
          simulated: true,
        },
      };
    }
    return { ok: true, value: { measurement } };
  }

  // -- reads / projection / persistence -------------------------------------------

  ledgerEventsOf(solutionId: OpaqueId): SecurityServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): SecurityServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): SecurityServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Live authoritative projection (same shape as replaySecurityLedger output). */
  projectionOf(solutionId: OpaqueId): SecurityServiceResult<SecurityPlaneProjection> {
    return { ok: true, value: buildSecurityPlaneProjection(this.planeFor(solutionId)) };
  }

  /** Replays a persisted ledger through the shared security-plane fold. */
  static replay(events: readonly SolutionEvent[]): SecurityPlaneProjection {
    return replaySecurityLedger(events);
  }

  // -- internals -------------------------------------------------------------------

  /** Lazily opens (and caches) the security plane for one solution. */
  private planeFor(solutionId: OpaqueId): SecurityPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: SecurityPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.flowDeps),
      threatModel: new Map(),
      reviews: new Map(),
      reviewFindings: new Map(),
      reviewStatuses: new Map(),
      reviewAcceptances: new Map(),
      loadTests: new Map(),
      loadTestMeasurements: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** Creates the deterministic security application service. */
export function createSecurityService(config: SecurityServiceConfig): SecurityService {
  return SecurityService.create(config);
}
