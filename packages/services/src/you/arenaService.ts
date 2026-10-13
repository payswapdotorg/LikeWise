// YOU arena application service — the single authority over arena-plane
// truth (docs/you/CONTRACTS.md "Wave-8 contract freeze (v8)";
// WORK_ORDERS.md W8A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one arena plane per solution: the
// append-only SolutionEventLedger, the immutable CapabilityGap records
// (v1 shape), the append-only ArenaRun ladder, the ArenaRetryPolicy
// validation + gates, the EscalationAuthorization lifecycle and the
// provider-neutral Arena client boundary. The op bodies live in the
// flow modules (arenaGapFlow / arenaRunFlow / arenaEscalationFlow /
// arenaResultFlow / arenaAuthorizationFlow / arenaProjectionFlow — the
// W1A/W6A flow precedent); this class is the dispatch authority.
//
// ARENA BOUNDARY LAW (docs/you/ARCHITECTURE.md §15): this service NEVER
// mutates Solution/Twin/Editing state. Expert results return as typed
// payloads (escalationResultPayload) that the caller applies through
// YOU's own authority; the service only records the outcome on the
// escalation ladder.
//
// Error-code mapping (frozen W8A taxonomy; see arenaServiceTypes.ts for
// the full table). Phase 0 is fully deterministic: injected clock +
// seeded RNG; everything simulated stays labeled `simulated: true`
// (truth law). Retry policies are pre-validation SERVICE STATE (the
// W6A candidate-record precedent — the frozen wave-8 event set has no
// policy event); provider descriptors materialize in the ledger only
// through delivery facts.

import type {
  ArenaLearningPermission,
  ArenaProviderDescriptor,
  ArenaRetryPolicy,
  ArenaRun,
  CapabilityGap,
  KnowledgeGapProjection,
  OpaqueId,
  SolutionEvent,
  ToolGapProjection,
} from "@zcode/shared";
import type { YouClock } from "../../../shared/src/you/clock.js";
import { createDeterministicClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import {
  constructArenaRetryPolicy,
  type ArenaRetryPolicyInput,
} from "../../../shared/src/you/arenaRetryPolicy.js";
import { constructArenaProviderDescriptor, type ArenaProviderInput } from "../../../shared/src/you/arenaClient.js";
import { effectiveAuthorizationStatus } from "../../../shared/src/you/escalationAuthorization.js";
import type { EscalationAuthorizationEntry } from "../../../shared/src/you/escalationAuthorization.js";
import { replayArenaLedger, type ArenaPlaneProjection } from "../../../shared/src/you/arenaLedger.js";
import type { KnowledgeGapProjectionInput, ToolGapProjectionInput } from "../../../shared/src/you/gapProjections.js";
import { buildArenaPlaneProjection } from "./arenaProjection.js";
import {
  arenaFailure,
  escalationInconsistent,
  requireAuthorizationChain,
  requireEscalation,
  sortedMapKeys,
  type ArenaApplicationPayload,
  type ArenaFlowDeps,
  type ArenaPlaneRecord,
  type ArenaProjectionRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";
import { recordCapabilityGapOp, requestEscalationOp, type ArenaGapIntakeInput } from "./arenaGapFlow.js";
import { startArenaRunOp, terminalArenaRunOp } from "./arenaRunFlow.js";
import {
  grantAuthorizationOp,
  startEscalationSessionOp,
  deliverEscalationResultOp,
  type ArenaAuthorizationGrantInput,
} from "./arenaEscalationFlow.js";
import {
  escalationResultPayloadOp,
  markEscalationResultAppliedOp,
  rejectEscalationResultOp,
} from "./arenaResultFlow.js";
import { expireAuthorizationOp, recordLearningPermissionOp, withdrawAuthorizationOp } from "./arenaAuthorizationFlow.js";
import { publishKnowledgeGapProjectionOp, publishToolGapProjectionOp } from "./arenaProjectionFlow.js";

export type { ArenaGapIntakeInput, ArenaAuthorizationGrantInput };

export interface ArenaServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  /** Content store for delivery content addressing (same abstraction as the evidence lane). */
  readonly contentStore?: EvidenceContentStore;
}

/** The application-service authority over arena truth. */
export class ArenaService {
  private readonly planes = new Map<OpaqueId, ArenaPlaneRecord>();
  private readonly flowDeps: ArenaFlowDeps;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
  ) {
    this.flowDeps = { clock, ids, store: contentStore };
  }

  /** Creates a deterministic service (injected clock + seeded ids/delivery content). */
  static create(config: ArenaServiceConfig): ArenaService {
    const seed = config.seed ?? "you-w8a-arena-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new ArenaService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
    );
  }

  // -- provider registry (opaque provider refs) ------------------------------

  /** Registers an immutable ArenaProviderDescriptor (typed YOU_INVALID_STATE for intake shape). */
  registerArenaProvider(
    solutionId: OpaqueId,
    input: ArenaProviderInput,
  ): ArenaServiceResult<{ readonly provider: ArenaProviderDescriptor }> {
    const addressed = constructArenaProviderDescriptor(input, { nextId: this.flowDeps.ids.next });
    if (!addressed.ok) {
      return arenaFailure("YOU_INVALID_STATE", `arena provider intake refused: ${addressed.refusal.detail}`, {
        reason: "invalid-provider-intake",
        refusal: addressed.refusal.reason,
      });
    }
    this.planeFor(solutionId).providers.set(addressed.descriptor.id, addressed.descriptor);
    return { ok: true, value: { provider: addressed.descriptor } };
  }

  /** The registered provider, or typed YOU_ARENA_ADAPTER_UNSUPPORTED (fail-closed reads). */
  arenaProviderOf(solutionId: OpaqueId, providerId: OpaqueId): ArenaServiceResult<{ readonly provider: ArenaProviderDescriptor }> {
    const provider = this.planeFor(solutionId).providers.get(providerId);
    return provider === undefined
      ? arenaFailure("YOU_ARENA_ADAPTER_UNSUPPORTED", "unknown arena provider", {
          reason: "provider-unknown",
          providerId,
        })
      : { ok: true, value: { provider } };
  }

  /** All registered providers, sorted by id. */
  arenaProvidersOf(solutionId: OpaqueId): ArenaServiceResult<{ readonly providers: readonly ArenaProviderDescriptor[] }> {
    const plane = this.planeFor(solutionId);
    const providers = [...plane.providers.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ok: true, value: { providers } };
  }

  // -- retry policy -----------------------------------------------------------

  /** Registers a retry policy (the head becomes active); typed YOU_RETRY_POLICY_INVALID on refusal. */
  registerRetryPolicy(
    solutionId: OpaqueId,
    input: ArenaRetryPolicyInput,
  ): ArenaServiceResult<{ readonly policy: ArenaRetryPolicy }> {
    const plane = this.planeFor(solutionId);
    const constructed = constructArenaRetryPolicy(input);
    if (!constructed.ok) {
      return arenaFailure("YOU_RETRY_POLICY_INVALID", `retry policy refused: ${constructed.refusal.detail}`, {
        reason: constructed.refusal.reason,
      });
    }
    plane.policies.push(constructed.policy);
    return { ok: true, value: { policy: constructed.policy } };
  }

  /** The active (head) policy, or typed YOU_RETRY_POLICY_INVALID when none is registered. */
  activePolicyOf(solutionId: OpaqueId): ArenaServiceResult<{ readonly policy: ArenaRetryPolicy }> {
    const head = this.planeFor(solutionId).policies[this.planeFor(solutionId).policies.length - 1];
    if (head === undefined) {
      return arenaFailure("YOU_RETRY_POLICY_INVALID", "no active retry policy registered", {
        reason: "no-active-policy",
      });
    }
    return { ok: true, value: { policy: head } };
  }

  // -- CapabilityGap persistence (the v1 shape) --------------------------------

  /** Records an immutable CapabilityGap with the full v1 linkage. Emits capability-gap-detected. */
  recordCapabilityGap(solutionId: OpaqueId, input: ArenaGapIntakeInput): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    return recordCapabilityGapOp(this.planeFor(solutionId), this.flowDeps, input);
  }

  /** The recorded gap, or typed YOU_INVALID_STATE (the v1 solution-flow precedent). */
  gapOf(solutionId: OpaqueId, gapId: OpaqueId): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    const found = this.planeFor(solutionId).gaps.get(gapId);
    return found === undefined
      ? arenaFailure("YOU_INVALID_STATE", "unknown capability gap", { reason: "unknown-gap", gapId })
      : { ok: true, value: { gap: found } };
  }

  /** All recorded gaps, sorted by id. */
  gapsOf(solutionId: OpaqueId): ArenaServiceResult<{ readonly gaps: readonly CapabilityGap[] }> {
    const plane = this.planeFor(solutionId);
    const gaps = sortedMapKeys(plane.gaps)
      .map((gapId) => plane.gaps.get(gapId))
      .filter((gap): gap is CapabilityGap => gap !== undefined);
    return { ok: true, value: { gaps } };
  }

  // -- the ArenaRun ladder (append-only; terminals locked) ---------------------

  /** Starts the next automation attempt (policy gates; typed refusals). Emits arena-run-recorded. */
  startArenaRun(solutionId: OpaqueId, gapId: OpaqueId, input: { readonly strategy: string }): ArenaServiceResult<{ readonly run: ArenaRun }> {
    return startArenaRunOp(this.planeFor(solutionId), this.flowDeps, gapId, input);
  }

  /** Completes a started run (terminal; immutable replacement). */
  completeArenaRun(
    solutionId: OpaqueId,
    runId: OpaqueId,
    options: { readonly outcomeEvidenceRef?: OpaqueId | null } = {},
  ): ArenaServiceResult<{ readonly run: ArenaRun }> {
    return terminalArenaRunOp(this.planeFor(solutionId), this.flowDeps, runId, "completed", options.outcomeEvidenceRef ?? null);
  }

  /** Fails a started run (terminal). */
  failArenaRun(
    solutionId: OpaqueId,
    runId: OpaqueId,
    options: { readonly outcomeEvidenceRef?: OpaqueId | null } = {},
  ): ArenaServiceResult<{ readonly run: ArenaRun }> {
    return terminalArenaRunOp(this.planeFor(solutionId), this.flowDeps, runId, "failed", options.outcomeEvidenceRef ?? null);
  }

  /** Aborts a started run (terminal). */
  abortArenaRun(solutionId: OpaqueId, runId: OpaqueId): ArenaServiceResult<{ readonly run: ArenaRun }> {
    return terminalArenaRunOp(this.planeFor(solutionId), this.flowDeps, runId, "aborted", null);
  }

  /** The run head, or typed YOU_ARENA_RUN_NOT_FOUND. */
  runOf(solutionId: OpaqueId, runId: OpaqueId): ArenaServiceResult<{ readonly run: ArenaRun }> {
    const run = this.planeFor(solutionId).runs.get(runId);
    return run === undefined
      ? arenaFailure("YOU_ARENA_RUN_NOT_FOUND", "unknown arena run", { reason: "unknown-run", runId })
      : { ok: true, value: { run } };
  }

  /** All runs across gaps, sorted by id. */
  runsOf(solutionId: OpaqueId): ArenaServiceResult<{ readonly runs: readonly ArenaRun[] }> {
    const plane = this.planeFor(solutionId);
    const runs = sortedMapKeys(plane.runs)
      .map((runId) => plane.runs.get(runId))
      .filter((run): run is ArenaRun => run !== undefined);
    return { ok: true, value: { runs } };
  }

  /** The per-gap run ladder, in append order. */
  runsOfGap(solutionId: OpaqueId, gapId: OpaqueId): ArenaServiceResult<{ readonly runs: readonly ArenaRun[] }> {
    const plane = this.planeFor(solutionId);
    const runs = (plane.runsByGap.get(gapId) ?? [])
      .map((runId) => plane.runs.get(runId))
      .filter((run): run is ArenaRun => run !== undefined);
    return { ok: true, value: { runs } };
  }

  // -- the escalation lifecycle (v1 ladder) -------------------------------------

  /** Requests an Arena escalation for an eligible gap (the v1 flow). Emits arena-escalation-requested. */
  requestEscalation(solutionId: OpaqueId, gapId: OpaqueId): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    return requestEscalationOp(this.planeFor(solutionId), this.flowDeps, gapId);
  }

  /** Grants the user authorization (immutable record; append-only chain). Emits escalation-authorized + learning-permission-recorded. */
  grantAuthorization(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    input: ArenaAuthorizationGrantInput,
  ): ArenaServiceResult<{ readonly authorization: import("@zcode/shared").EscalationAuthorization; readonly gap: CapabilityGap }> {
    return grantAuthorizationOp(this.planeFor(solutionId), this.flowDeps, escalationId, input);
  }

  /** Starts the authorized session — THE GATE (the authorization law). Emits arena-escalation-requested. */
  startEscalationSession(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    options: { readonly requestedScope?: string } = {},
  ): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    return startEscalationSessionOp(this.planeFor(solutionId), this.flowDeps, escalationId, options);
  }

  /** Delivers the expert result through the client boundary (fail-closed; content-addressed). */
  deliverEscalationResult(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    input: { readonly providerId: OpaqueId },
  ): ArenaServiceResult<{ readonly gap: CapabilityGap; readonly delivery: import("@zcode/shared").ArenaExpertResult; readonly contentRef: OpaqueId; readonly contentHash: string }> {
    return deliverEscalationResultOp(this.planeFor(solutionId), this.flowDeps, escalationId, input);
  }

  /** The ARENA BOUNDARY LAW surface: the typed payload for the caller to apply through YOU's own authority. */
  escalationResultPayload(solutionId: OpaqueId, escalationId: OpaqueId): ArenaServiceResult<ArenaApplicationPayload> {
    return escalationResultPayloadOp(this.planeFor(solutionId), escalationId);
  }

  /** Records that the caller applied the result as ChangeSet `<changeSetId>`. Emits arena-result-applied. */
  markEscalationResultApplied(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    changeSetId: OpaqueId,
  ): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    return markEscalationResultAppliedOp(this.planeFor(solutionId), escalationId, changeSetId);
  }

  /** Records that the user rejected the delivered result (terminal). */
  rejectEscalationResult(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    reason = "result-rejected-by-user",
  ): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    return rejectEscalationResultOp(this.planeFor(solutionId), escalationId, reason);
  }

  // -- the authorization lifecycle (grant / expiry / withdrawal) ----------------

  /** Withdraws the chain-head authorization (new record; cancels a non-terminal escalation). */
  withdrawAuthorization(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    reason = "user-withdrew-authorization",
  ): ArenaServiceResult<{ readonly entry: EscalationAuthorizationEntry; readonly gap: CapabilityGap }> {
    return withdrawAuthorizationOp(this.planeFor(solutionId), this.flowDeps, escalationId, reason);
  }

  /** Materializes the head grant's expiry (new record; fail-closed cancellation of stalled escalations). */
  expireAuthorization(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
  ): ArenaServiceResult<{ readonly entry: EscalationAuthorizationEntry; readonly gap: CapabilityGap }> {
    return expireAuthorizationOp(this.planeFor(solutionId), this.flowDeps, escalationId);
  }

  /** Records a learning-permission change (new grant record; the predecessor projects superseded). */
  recordLearningPermission(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
    learningPermission: ArenaLearningPermission,
  ): ArenaServiceResult<{ readonly authorization: import("@zcode/shared").EscalationAuthorization }> {
    return recordLearningPermissionOp(this.planeFor(solutionId), this.flowDeps, escalationId, learningPermission);
  }

  /** The raw authorization chain (immutable entries, in order). */
  authorizationChainOf(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
  ): ArenaServiceResult<{ readonly entries: readonly EscalationAuthorizationEntry[] }> {
    const chain = requireAuthorizationChain(this.planeFor(solutionId), escalationId);
    return "error" in chain ? { ok: false, error: chain.error } : { ok: true, value: { entries: chain.chain } };
  }

  /** The chain-head authorization with its effective status at the current clock reading. */
  activeAuthorizationOf(
    solutionId: OpaqueId,
    escalationId: OpaqueId,
  ): ArenaServiceResult<{ readonly entry: EscalationAuthorizationEntry; readonly effectiveStatus: string }> {
    const chain = requireAuthorizationChain(this.planeFor(solutionId), escalationId);
    if ("error" in chain) {
      return { ok: false, error: chain.error };
    }
    const head = chain.chain[chain.chain.length - 1];
    if (head === undefined) {
      return escalationInconsistent(escalationId);
    }
    return { ok: true, value: { entry: head, effectiveStatus: effectiveAuthorizationStatus(head, this.flowDeps.clock.now()) } };
  }

  // -- gap projections (derived, never authoritative) ---------------------------

  /** Publishes a ToolGap projection (typed YOU_GAP_PROJECTION_INVALID on category/shape gates). */
  publishToolGapProjection(
    solutionId: OpaqueId,
    gapId: OpaqueId,
    input: ToolGapProjectionInput = {},
  ): ArenaServiceResult<{ readonly projectionId: OpaqueId; readonly projection: ToolGapProjection }> {
    return publishToolGapProjectionOp(this.planeFor(solutionId), this.flowDeps, gapId, input);
  }

  /** Publishes a KnowledgeGap projection. */
  publishKnowledgeGapProjection(
    solutionId: OpaqueId,
    gapId: OpaqueId,
    input: KnowledgeGapProjectionInput = {},
  ): ArenaServiceResult<{ readonly projectionId: OpaqueId; readonly projection: KnowledgeGapProjection }> {
    return publishKnowledgeGapProjectionOp(this.planeFor(solutionId), this.flowDeps, gapId, input);
  }

  /** All published projections, sorted by id. */
  projectionsOf(solutionId: OpaqueId): ArenaServiceResult<{ readonly projections: readonly ArenaProjectionRecord[] }> {
    const plane = this.planeFor(solutionId);
    const projections = sortedMapKeys(plane.projections)
      .map((projectionId) => plane.projections.get(projectionId))
      .filter((record): record is ArenaProjectionRecord => record !== undefined);
    return { ok: true, value: { projections } };
  }

  // -- reads / projection / persistence ---------------------------------------

  /** The gap carrying the escalation, or typed YOU_ESCALATION_NOT_FOUND. */
  escalationOf(solutionId: OpaqueId, escalationId: OpaqueId): ArenaServiceResult<{ readonly gap: CapabilityGap }> {
    const found = requireEscalation(this.planeFor(solutionId), escalationId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { gap: found.gap } };
  }

  ledgerEventsOf(solutionId: OpaqueId): ArenaServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): ArenaServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): ArenaServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Live authoritative projection (same shape as replayArenaLedger output). */
  projectionOf(solutionId: OpaqueId): ArenaServiceResult<ArenaPlaneProjection> {
    return { ok: true, value: buildArenaPlaneProjection(this.planeFor(solutionId)) };
  }

  /** Number of stored delivery content refs (fixture observability). */
  contentStoreSize(): number {
    return this.flowDeps.store.size;
  }

  /** Replays a persisted ledger through the shared arena-plane fold. */
  static replay(events: readonly SolutionEvent[]): ArenaPlaneProjection {
    return replayArenaLedger(events);
  }

  // -- internals ---------------------------------------------------------------

  /** Lazily opens (and caches) the arena plane for one solution. */
  private planeFor(solutionId: OpaqueId): ArenaPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: ArenaPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.flowDeps),
      gaps: new Map(),
      runs: new Map(),
      runsByGap: new Map(),
      escalationGap: new Map(),
      authorizationChains: new Map(),
      deliveries: new Map(),
      permissionRecordings: new Map(),
      policies: [],
      providers: new Map(),
      projections: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** Creates the deterministic arena application service. */
export function createArenaService(config: ArenaServiceConfig): ArenaService {
  return ArenaService.create(config);
}
