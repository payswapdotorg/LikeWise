// YOU arena application service — shared internal types and helpers.
//
// The application service (arenaService.ts) is the single authority over
// arena-plane truth (docs/you/CONTRACTS.md "Wave-8 contract freeze (v8)";
// WORK_ORDERS.md W8A): the CapabilityGap persistence, the append-only
// ArenaRun ladder, the ArenaRetryPolicy validation, the
// EscalationAuthorization lifecycle and the provider-neutral Arena
// client boundary. The ARENA BOUNDARY LAW holds by construction: the
// service NEVER applies results into Solution state — expert results
// return as typed payloads the caller applies through YOU's own
// authority. The stateless validators stay the single refusal authority
// (shared/src/you/arenaRetryPolicy.ts, escalationAuthorization.ts,
// arenaClient.ts, gapProjections.ts); nothing here is a second
// validator.
//
// Error-code mapping (frozen W8A taxonomy):
//   YOU_ARENA_RUN_NOT_FOUND            — unknown run id (every run op)
//   YOU_RETRY_POLICY_INVALID           — policy intake + run gates
//   YOU_ESCALATION_NOT_FOUND           — unknown escalation / authorization
//   YOU_ESCALATION_STATE_INVALID       — v1 ladder violations, terminal
//                                        locks, non-active authorization
//                                        lifecycle states
//   YOU_ESCALATION_AUTHORIZATION_REQUIRED — the authorization law (plus
//                                        the policy's requiresAuthorization
//                                        flag on escalation paths)
//   YOU_ARENA_ADAPTER_UNSUPPORTED      — fail-closed client boundary
//   YOU_GAP_PROJECTION_INVALID         — projection category/shape gates
//   YOU_INVALID_STATE                  — gap/run intake shape (the v1
//                                        solution-flow precedent); run
//                                        ladder violations carry stable
//                                        reasons on this code

import type {
  ArenaProviderDescriptor,
  ArenaRetryPolicy,
  ArenaRun,
  CapabilityGap,
  OpaqueId,
  ToolGapProjection,
  KnowledgeGapProjection,
  YouError,
} from "@zcode/shared";
import type { EscalationAuthorizationEntry } from "../../../shared/src/you/escalationAuthorization.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import type { ArenaClient } from "../../../shared/src/you/arenaClient.js";
import { createFixtureArenaClient } from "../../../shared/src/you/arenaClient.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type ArenaServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function arenaFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface ArenaServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** The content-addressed delivery facts recorded per escalation. */
export interface ArenaDeliveryRecord {
  readonly providerId: OpaqueId;
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
  readonly deliveredAt: string;
}

/** The latest learning-permission recording per escalation. */
export interface ArenaPermissionRecording {
  readonly authorizationId: OpaqueId;
  readonly learningPermission: string;
  readonly recordedAt: string;
}

/** One published gap projection (either kind). */
export interface ArenaProjectionRecord {
  readonly id: OpaqueId;
  readonly projection: ToolGapProjection | KnowledgeGapProjection;
  readonly kind: "tool-gap" | "knowledge-gap";
}

/**
 * One solution's arena plane: the append-only ledger, the CapabilityGap
 * records (immutable heads), the ArenaRun ladder (append-only per-gap
 * run lists, immutable head records), the authorization chains, the
 * delivery bindings, the policy registry and the provider registry.
 * The service is the sole writer; records are replaced immutably and
 * every change rides the ledger.
 */
export interface ArenaPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** gapId -> immutable CapabilityGap head (the v1 record set). */
  readonly gaps: Map<OpaqueId, CapabilityGap>;
  /** runId -> ArenaRun head (the run-ladder projection head). */
  readonly runs: Map<OpaqueId, ArenaRun>;
  /** runIds per gap, in append order (the per-gap run ladder). */
  readonly runsByGap: Map<OpaqueId, OpaqueId[]>;
  /** escalationId -> gapId (escalations live on the gap records). */
  readonly escalationGap: Map<OpaqueId, OpaqueId>;
  /** escalationId -> append-only authorization chain (entries in order). */
  readonly authorizationChains: Map<OpaqueId, EscalationAuthorizationEntry[]>;
  /** escalationId -> content-addressed delivery facts. */
  readonly deliveries: Map<OpaqueId, ArenaDeliveryRecord>;
  /** escalationId -> the latest learning-permission recording. */
  readonly permissionRecordings: Map<OpaqueId, ArenaPermissionRecording>;
  /** Retry policies in registration order; the HEAD is active (service state, the W6A candidate precedent). */
  readonly policies: ArenaRetryPolicy[];
  /** providerId -> immutable ArenaProviderDescriptor. */
  readonly providers: Map<OpaqueId, ArenaProviderDescriptor>;
  /** projectionId -> published projection record (append-only). */
  readonly projections: Map<OpaqueId, ArenaProjectionRecord>;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The gap lookup helper used by every flow. */
export function requireGap(
  plane: ArenaPlaneRecord,
  gapId: OpaqueId,
): { readonly gap: CapabilityGap } | { readonly error: YouError } {
  const gap = plane.gaps.get(gapId);
  if (gap === undefined) {
    return {
      error: {
        code: "YOU_INVALID_STATE",
        message: "unknown capability gap",
        details: { reason: "unknown-gap", gapId },
        simulated: true,
      },
    };
  }
  return { gap };
}

/** The run lookup helper: typed YOU_ARENA_RUN_NOT_FOUND. */
export function requireRun(
  plane: ArenaPlaneRecord,
  runId: OpaqueId,
): { readonly run: ArenaRun } | { readonly error: YouError } {
  const run = plane.runs.get(runId);
  if (run === undefined) {
    return {
      error: {
        code: "YOU_ARENA_RUN_NOT_FOUND",
        message: "unknown arena run",
        details: { reason: "unknown-run", runId },
        simulated: true,
      },
    };
  }
  return { run };
}

/** The escalation lookup helper: typed YOU_ESCALATION_NOT_FOUND. */
export function requireEscalation(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
): { readonly gap: CapabilityGap; readonly escalationId: OpaqueId } | { readonly error: YouError } {
  const gapId = plane.escalationGap.get(escalationId);
  if (gapId === undefined) {
    return {
      error: {
        code: "YOU_ESCALATION_NOT_FOUND",
        message: "unknown arena escalation",
        details: { reason: "unknown-escalation", escalationId },
        simulated: true,
      },
    };
  }
  const gap = plane.gaps.get(gapId);
  if (gap === undefined || gap.arenaEscalationRef === null || gap.arenaEscalationRef.escalationId !== escalationId) {
    return {
      error: {
        code: "YOU_ESCALATION_NOT_FOUND",
        message: "arena escalation record is inconsistent with its gap",
        details: { reason: "escalation-gap-mismatch", escalationId },
        simulated: true,
      },
    };
  }
  return { gap, escalationId };
}

/** The authorization chain lookup: typed YOU_ESCALATION_NOT_FOUND when no chain exists. */
export function requireAuthorizationChain(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
): { readonly chain: readonly EscalationAuthorizationEntry[] } | { readonly error: YouError } {
  const chain = plane.authorizationChains.get(escalationId);
  if (chain === undefined || chain.length === 0) {
    return {
      error: {
        code: "YOU_ESCALATION_NOT_FOUND",
        message: "unknown escalation authorization",
        details: { reason: "unknown-authorization", escalationId },
        simulated: true,
      },
    };
  }
  return { chain };
}

/** The typed payload returned to the caller for application through YOU's own authority. */
export interface ArenaApplicationPayload {
  readonly gap: CapabilityGap;
  readonly escalationId: OpaqueId;
  readonly expertResult: import("@zcode/shared").ArenaExpertResult;
  /** ChangeSet operations expressing the result (the v1 deterministic mapping). */
  readonly operations: readonly import("@zcode/shared").SolutionPatchOperation[];
  readonly contentRef: OpaqueId;
  readonly contentHash: string;
}

/** The deps every arena flow receives (injected clock/ids + the content store). */
export interface ArenaFlowDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/** The chain-head policy of a plane, or null when none is registered (fail-closed by the caller). */
export function activePolicyOf(plane: ArenaPlaneRecord): ArenaRetryPolicy | null {
  const head = plane.policies[plane.policies.length - 1];
  return head ?? null;
}

/** The per-plane fixture Arena client (provider lookup over the plane registry). */
export function clientForPlane(plane: ArenaPlaneRecord, deps: ArenaFlowDeps): ArenaClient {
  const cached = planeClients.get(plane);
  if (cached !== undefined) {
    return cached;
  }
  const client = createFixtureArenaClient(
    { descriptorOf: (providerId: OpaqueId): ArenaProviderDescriptor | null => plane.providers.get(providerId) ?? null },
    { clock: deps.clock, ids: deps.ids, store: deps.store },
  );
  planeClients.set(plane, client);
  return client;
}

/** Per-plane client cache (WeakMap — the plane is the cache key). */
const planeClients = new WeakMap<ArenaPlaneRecord, ArenaClient>();

/** The typed inconsistent-escalation refusal shared by every flow. */
export function escalationInconsistent(escalationId: OpaqueId): { readonly ok: false; readonly error: YouError } {
  return arenaFailure("YOU_ESCALATION_STATE_INVALID", "arena escalation record is inconsistent with its gap", {
    reason: "escalation-gap-mismatch",
    escalationId,
  });
}
