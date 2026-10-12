// YOU embodiment application service — shared internal types and helpers.
//
// The application service (embodimentService.ts) is the single authority
// over agent-embodiment truth (docs/you/CONTRACTS.md "Wave-7 contract
// freeze (v7)"; WORK_ORDERS.md W7A): the Body registry, the Soul binding
// registry and the AvatarSession lifecycle. The BODY/SOUL SEPARATION LAW
// holds by construction: possession and re-possession mutate ONLY the
// session record (immutable replacement) and the append-only ledger —
// never the Body record. The stateless intake validators stay the single
// refusal authority (shared/src/you/soulBinding.ts, bodyRegistry.ts);
// nothing here is a second validator.

import type { AgentBody, AvatarSession, OpaqueId, SoulBinding, YouError } from "@zcode/shared";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type EmbodimentServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function embodimentFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface EmbodimentServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/**
 * One solution's embodiment plane: the append-only ledger, the Body
 * registry, the Soul binding registry and the AvatarSession heads. The
 * service is the sole writer; session records are replaced immutably and
 * every change rides the ledger.
 */
export interface EmbodimentPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** bodyId -> immutable AgentBody record (never mutated after registration). */
  readonly bodies: Map<OpaqueId, AgentBody>;
  /** soulBindingId -> immutable SoulBinding record. */
  readonly soulBindings: Map<OpaqueId, SoulBinding>;
  /** sessionId -> AvatarSession head (the projection head of the ladder). */
  readonly sessions: Map<OpaqueId, AvatarSession>;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The avatar-session lookup helper used by every flow. */
export function requireAvatarSession(
  plane: EmbodimentPlaneRecord,
  sessionId: OpaqueId,
): { readonly session: AvatarSession } | { readonly error: YouError } {
  const session = plane.sessions.get(sessionId);
  if (session === undefined) {
    return {
      error: {
        code: "YOU_AVATAR_SESSION_NOT_FOUND",
        message: "unknown avatar session",
        details: { reason: "unknown-avatar-session", sessionId },
        simulated: true,
      },
    };
  }
  return { session };
}
