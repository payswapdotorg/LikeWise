// YOU embodiment-plane ledger replay (W7A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The embodiment application service appends embodiment-plane events
// (avatar-session-opened / embodiment-state-changed / soul-reassigned /
// avatar-session-closed) into the W1A SolutionEventLedger machinery.
// Payload conventions follow the W1A/W3A precedent: per-record status
// facts ride along in event payloads because the frozen SolutionEventType
// set has no per-record status events (suspend/resume carry statusAfter on
// embodiment-state-changed), and bodies / soul bindings enter the
// replayable projection only when a session event references them
// (mirroring the W3A rule that a twin enters the ledger at its first
// version publication):
//   avatar-session-opened    { sessionId, bodyId, bodyRole,
//                              bodyAppearanceRef, bodyAppearanceHash,
//                              soulBindingId, soulProviderKind,
//                              soulModelRef, soulRoutingProfile,
//                              statusAfter: "active", stateAfter, openedAt,
//                              simulated }
//   embodiment-state-changed { sessionId, stateBefore, stateAfter,
//                              statusAfter?: "active" | "suspended"
//                              (suspend/resume rides along), reason,
//                              simulated }
//   soul-reassigned          { sessionId, bodyId, fromSoulBindingId,
//                              toSoulBindingId, toSoulProviderKind,
//                              toSoulModelRef, toSoulRoutingProfile,
//                              statusAfter, stateAfter, simulated }
//   avatar-session-closed    { sessionId, statusAfter: "closed",
//                              stateAfter: "unavailable", closedAt,
//                              simulated }
//
// replayEmbodimentLedger folds those events into the authoritative
// embodiment-plane projection. Deterministic: same events => same
// projection (compare through stableStringify).

import type { SolutionEvent } from "./contract.js";

/** Session facts as reconstructable from ledger payloads (projection head). */
export interface EmbodimentLedgerSessionEntry {
  readonly bodyId: string;
  /** Current soul binding (head after soul-reassigned folds). */
  readonly soulBindingId: string;
  /** active | suspended | closed (last transition wins). */
  readonly status: string;
  /** The embodiment-state ladder head (projection, never authority). */
  readonly state: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  /** Number of embodiment-state-changed events folded for the session. */
  readonly transitionCount: number;
  /** Number of soul-reassigned events folded for the session. */
  readonly reassignmentCount: number;
}

/** Body facts as referenced by session events. */
export interface EmbodimentLedgerBodyEntry {
  readonly role: string;
  readonly appearanceRef: string | null;
  readonly appearanceHash: string | null;
  readonly capabilityCount: number;
  readonly toolCount: number;
  readonly policyRefCount: number;
}

/** Soul binding facts as referenced by session events. */
export interface EmbodimentLedgerSoulEntry {
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: string;
  readonly capabilityCount: number;
}

export interface EmbodimentPlaneProjection {
  readonly solutionId: string;
  /** sessionId -> authoritative session head facts. */
  readonly sessions: Readonly<Record<string, EmbodimentLedgerSessionEntry>>;
  /** bodyId -> body facts (present once a session references the body). */
  readonly bodies: Readonly<Record<string, EmbodimentLedgerBodyEntry>>;
  /** soulBindingId -> soul facts (present once a session references the soul). */
  readonly soulBindings: Readonly<Record<string, EmbodimentLedgerSoulEntry>>;
}

/** Mutable fold-accumulator session entry (frozen into the projection at the end). */
interface MutableSessionEntry {
  bodyId: string;
  soulBindingId: string;
  status: string;
  state: string;
  openedAt: string;
  closedAt: string | null;
  transitionCount: number;
  reassignmentCount: number;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function nullableTextPayload(event: SolutionEvent, key: string): string | null {
  const value = event.payload[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Folds embodiment-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 * Events referencing unknown sessions are folded defensively (ignored),
 * mirroring the W1A/W3A total-fold precedent.
 */
export function replayEmbodimentLedger(events: readonly SolutionEvent[]): EmbodimentPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayEmbodimentLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const sessions: Record<string, MutableSessionEntry> = {};
  const bodies: Record<string, EmbodimentLedgerBodyEntry> = {};
  const soulBindings: Record<string, EmbodimentLedgerSoulEntry> = {};

  const recordBody = (event: SolutionEvent, bodyId: string): void => {
    if (bodyId === "" || bodies[bodyId] !== undefined) {
      return;
    }
    bodies[bodyId] = {
      role: textPayload(event, "bodyRole") ?? "",
      appearanceRef: nullableTextPayload(event, "bodyAppearanceRef"),
      appearanceHash: nullableTextPayload(event, "bodyAppearanceHash"),
      capabilityCount: numberPayload(event, "bodyCapabilityCount") ?? 0,
      toolCount: numberPayload(event, "bodyToolCount") ?? 0,
      policyRefCount: numberPayload(event, "bodyPolicyRefCount") ?? 0,
    };
  };

  const recordSoul = (event: SolutionEvent, soulBindingId: string, prefix: string): void => {
    if (soulBindingId === "" || soulBindings[soulBindingId] !== undefined) {
      return;
    }
    soulBindings[soulBindingId] = {
      providerKind: textPayload(event, `${prefix}ProviderKind`) ?? "",
      modelRef: textPayload(event, `${prefix}ModelRef`) ?? "",
      routingProfile: textPayload(event, `${prefix}RoutingProfile`) ?? "",
      capabilityCount: numberPayload(event, `${prefix}CapabilityCount`) ?? 0,
    };
  };

  for (const event of events) {
    switch (event.type) {
      case "avatar-session-opened": {
        const sessionId = textPayload(event, "sessionId") ?? "";
        if (sessionId === "") {
          break;
        }
        const bodyId = textPayload(event, "bodyId") ?? "";
        const soulBindingId = textPayload(event, "soulBindingId") ?? "";
        sessions[sessionId] = {
          bodyId,
          soulBindingId,
          status: textPayload(event, "statusAfter") ?? "active",
          state: textPayload(event, "stateAfter") ?? "idle",
          openedAt: textPayload(event, "openedAt") ?? event.occurredAt,
          closedAt: null,
          transitionCount: 0,
          reassignmentCount: 0,
        };
        recordBody(event, bodyId);
        recordSoul(event, soulBindingId, "soul");
        break;
      }
      case "embodiment-state-changed": {
        const sessionId = textPayload(event, "sessionId") ?? "";
        const session = sessions[sessionId];
        if (session === undefined) {
          break;
        }
        const stateAfter = textPayload(event, "stateAfter");
        if (stateAfter !== undefined) {
          session.state = stateAfter;
        }
        const statusAfter = textPayload(event, "statusAfter");
        if (statusAfter !== undefined) {
          session.status = statusAfter;
        }
        session.transitionCount += 1;
        break;
      }
      case "soul-reassigned": {
        const sessionId = textPayload(event, "sessionId") ?? "";
        const session = sessions[sessionId];
        if (session === undefined) {
          break;
        }
        const toSoulBindingId = textPayload(event, "toSoulBindingId") ?? "";
        session.soulBindingId = toSoulBindingId;
        session.reassignmentCount += 1;
        const statusAfter = textPayload(event, "statusAfter");
        if (statusAfter !== undefined) {
          session.status = statusAfter;
        }
        const stateAfter = textPayload(event, "stateAfter");
        if (stateAfter !== undefined) {
          session.state = stateAfter;
        }
        recordSoul(event, toSoulBindingId, "toSoul");
        break;
      }
      case "avatar-session-closed": {
        const sessionId = textPayload(event, "sessionId") ?? "";
        const session = sessions[sessionId];
        if (session === undefined) {
          break;
        }
        session.status = textPayload(event, "statusAfter") ?? "closed";
        session.closedAt = textPayload(event, "closedAt") ?? event.occurredAt;
        const stateAfter = textPayload(event, "stateAfter");
        if (stateAfter !== undefined) {
          session.state = stateAfter;
        }
        break;
      }
      default:
        break;
    }
  }

  const frozenSessions: Record<string, EmbodimentLedgerSessionEntry> = {};
  for (const sessionId of Object.keys(sessions).sort()) {
    const session = sessions[sessionId];
    if (session !== undefined) {
      frozenSessions[sessionId] = { ...session };
    }
  }

  return {
    solutionId,
    sessions: frozenSessions,
    bodies,
    soulBindings,
  };
}
