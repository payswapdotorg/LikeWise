// YOU embodiment service — live plane projection builder.
//
// Builds the authoritative EmbodimentPlaneProjection from the service's
// live state in EXACTLY the shape replayEmbodimentLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in tests
// via stableStringify; any drift between this builder and the fold is a
// bug.
//
// Bodies and soul bindings enter the projection only when a session event
// references them (mirroring the W3A rule that a twin enters the ledger
// at its first version publication): the builder walks the ledger events
// for the referenced ids, then pins the live record facts — the same facts
// the ledger ops stamped into the event payloads.

import type { OpaqueId } from "@zcode/shared";
import type {
  EmbodimentLedgerBodyEntry,
  EmbodimentLedgerSessionEntry,
  EmbodimentLedgerSoulEntry,
  EmbodimentPlaneProjection,
} from "../../../shared/src/you/embodimentLedger.js";
import type { EmbodimentPlaneRecord } from "./embodimentServiceTypes.js";
import { sortedMapKeys } from "./embodimentServiceTypes.js";

/** Builds the live embodiment-plane projection (equal to replayEmbodimentLedger output). */
export function buildEmbodimentPlaneProjection(plane: EmbodimentPlaneRecord): EmbodimentPlaneProjection {
  const sessions: Record<string, EmbodimentLedgerSessionEntry> = {};
  const bodies: Record<string, EmbodimentLedgerBodyEntry> = {};
  const soulBindings: Record<string, EmbodimentLedgerSoulEntry> = {};
  const bodyFacts = new Map<OpaqueId, EmbodimentLedgerBodyEntry>();
  const soulFacts = new Map<OpaqueId, EmbodimentLedgerSoulEntry>();
  const transitionCounts = new Map<OpaqueId, number>();
  const reassignmentCounts = new Map<OpaqueId, number>();

  const ensureCounts = (sessionId: OpaqueId): void => {
    if (!transitionCounts.has(sessionId)) {
      transitionCounts.set(sessionId, 0);
    }
    if (!reassignmentCounts.has(sessionId)) {
      reassignmentCounts.set(sessionId, 0);
    }
  };

  const textPayload = (payload: Readonly<Record<string, string | number | boolean>>, key: string): string | null => {
    const value = payload[key];
    return typeof value === "string" ? value : null;
  };

  for (const event of plane.ledger.events()) {
    const sessionId = textPayload(event.payload, "sessionId");
    if (sessionId === null) {
      continue;
    }
    ensureCounts(sessionId);
    switch (event.type) {
      case "avatar-session-opened": {
        const bodyId = textPayload(event.payload, "bodyId") ?? "";
        const soulBindingId = textPayload(event.payload, "soulBindingId") ?? "";
        const body = plane.bodies.get(bodyId);
        if (body !== undefined && !bodyFacts.has(bodyId)) {
          bodyFacts.set(bodyId, {
            role: body.role,
            appearanceRef: body.appearanceRef,
            appearanceHash: body.appearanceHash,
            capabilityCount: body.capabilities.length,
            toolCount: body.tools.length,
            policyRefCount: body.policyRefs.length,
          });
        }
        const soul = plane.soulBindings.get(soulBindingId);
        if (soul !== undefined && !soulFacts.has(soulBindingId)) {
          soulFacts.set(soulBindingId, {
            providerKind: soul.providerKind,
            modelRef: soul.modelRef,
            routingProfile: soul.routingProfile,
            capabilityCount: soul.capabilities.length,
          });
        }
        break;
      }
      case "embodiment-state-changed": {
        transitionCounts.set(sessionId, (transitionCounts.get(sessionId) ?? 0) + 1);
        break;
      }
      case "soul-reassigned": {
        reassignmentCounts.set(sessionId, (reassignmentCounts.get(sessionId) ?? 0) + 1);
        const toSoulBindingId = textPayload(event.payload, "toSoulBindingId") ?? "";
        const soul = plane.soulBindings.get(toSoulBindingId);
        if (soul !== undefined && !soulFacts.has(toSoulBindingId)) {
          soulFacts.set(toSoulBindingId, {
            providerKind: soul.providerKind,
            modelRef: soul.modelRef,
            routingProfile: soul.routingProfile,
            capabilityCount: soul.capabilities.length,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  for (const sessionId of sortedMapKeys(plane.sessions)) {
    const session = plane.sessions.get(sessionId);
    if (session === undefined) {
      continue;
    }
    ensureCounts(sessionId);
    sessions[sessionId] = {
      bodyId: session.bodyId,
      soulBindingId: session.soulBindingId,
      status: session.status,
      state: session.state,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      transitionCount: transitionCounts.get(sessionId) ?? 0,
      reassignmentCount: reassignmentCounts.get(sessionId) ?? 0,
    };
  }
  for (const bodyId of sortedMapKeys(bodyFacts)) {
    const facts = bodyFacts.get(bodyId);
    if (facts !== undefined) {
      bodies[bodyId] = facts;
    }
  }
  for (const soulBindingId of sortedMapKeys(soulFacts)) {
    const facts = soulFacts.get(soulBindingId);
    if (facts !== undefined) {
      soulBindings[soulBindingId] = facts;
    }
  }
  return { solutionId: plane.solutionId, sessions, bodies, soulBindings };
}
