// YOU embodiment service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W3A precedent
// (solutionLedgerOps.ts / twinLedgerOps.ts): per-record status facts ride
// along in event payloads because the frozen SolutionEventType set has no
// per-record status events — suspend/resume carry statusAfter on
// embodiment-state-changed, and close is its own terminal event. Payload
// conventions (folded by shared/src/you/embodimentLedger.ts
// replayEmbodimentLedger):
//   avatar-session-opened    session + body + soul facts (status active)
//   embodiment-state-changed stateBefore/stateAfter (+statusAfter when the
//                            transition accompanies suspend/resume)
//   soul-reassigned          from/to binding facts + head facts
//   avatar-session-closed    terminal status + closedAt + stateAfter
//
// Truth law: every payload carries simulated: true in fixture mode.

import type { AgentBody, AvatarSession, OpaqueId, SoulBinding } from "@zcode/shared";
import type { EmbodimentPlaneRecord } from "./embodimentServiceTypes.js";

/** Appends avatar-session-opened for a freshly possessed Body. */
export function appendAvatarSessionOpened(
  plane: EmbodimentPlaneRecord,
  session: AvatarSession,
  body: AgentBody,
  soul: SoulBinding,
): void {
  plane.ledger.append({
    type: "avatar-session-opened",
    subjectRef: session.id,
    generator: "agent",
    payload: {
      sessionId: session.id,
      bodyId: body.id,
      bodyRole: body.role,
      ...(body.appearanceRef === null ? {} : { bodyAppearanceRef: body.appearanceRef }),
      ...(body.appearanceHash === null ? {} : { bodyAppearanceHash: body.appearanceHash }),
      bodyCapabilityCount: body.capabilities.length,
      bodyToolCount: body.tools.length,
      bodyPolicyRefCount: body.policyRefs.length,
      soulBindingId: soul.id,
      soulProviderKind: soul.providerKind,
      soulModelRef: soul.modelRef,
      soulRoutingProfile: soul.routingProfile,
      soulCapabilityCount: soul.capabilities.length,
      statusAfter: session.status,
      stateAfter: session.state,
      openedAt: session.openedAt,
      simulated: true,
    },
  });
}

/** Appends embodiment-state-changed for an activity transition (status unchanged). */
export function appendEmbodimentStateChanged(
  plane: EmbodimentPlaneRecord,
  sessionId: OpaqueId,
  stateBefore: string,
  sessionAfter: AvatarSession,
): void {
  plane.ledger.append({
    type: "embodiment-state-changed",
    subjectRef: sessionId,
    generator: "agent",
    payload: {
      sessionId,
      stateBefore,
      stateAfter: sessionAfter.state,
      reason: "activity",
      simulated: true,
    },
  });
}

/** Appends embodiment-state-changed with the status fact riding along (suspend/resume). */
export function appendEmbodimentLifecycleTransition(
  plane: EmbodimentPlaneRecord,
  sessionId: OpaqueId,
  stateBefore: string,
  sessionAfter: AvatarSession,
  reason: "suspend" | "resume",
): void {
  plane.ledger.append({
    type: "embodiment-state-changed",
    subjectRef: sessionId,
    generator: "user",
    payload: {
      sessionId,
      stateBefore,
      stateAfter: sessionAfter.state,
      statusAfter: sessionAfter.status,
      reason,
      simulated: true,
    },
  });
}

/** Appends soul-reassigned for a re-possessed Body (BODY/SOUL SEPARATION LAW). */
export function appendSoulReassigned(
  plane: EmbodimentPlaneRecord,
  sessionAfter: AvatarSession,
  fromSoulBindingId: OpaqueId,
  toSoul: SoulBinding,
): void {
  plane.ledger.append({
    type: "soul-reassigned",
    subjectRef: sessionAfter.id,
    generator: "user",
    payload: {
      sessionId: sessionAfter.id,
      bodyId: sessionAfter.bodyId,
      fromSoulBindingId,
      toSoulBindingId: toSoul.id,
      toSoulProviderKind: toSoul.providerKind,
      toSoulModelRef: toSoul.modelRef,
      toSoulRoutingProfile: toSoul.routingProfile,
      toSoulCapabilityCount: toSoul.capabilities.length,
      statusAfter: sessionAfter.status,
      stateAfter: sessionAfter.state,
      simulated: true,
    },
  });
}

/** Appends avatar-session-closed for a terminal close. */
export function appendAvatarSessionClosed(plane: EmbodimentPlaneRecord, sessionAfter: AvatarSession): void {
  plane.ledger.append({
    type: "avatar-session-closed",
    subjectRef: sessionAfter.id,
    generator: "user",
    payload: {
      sessionId: sessionAfter.id,
      statusAfter: sessionAfter.status,
      stateAfter: sessionAfter.state,
      closedAt: sessionAfter.closedAt ?? "",
      simulated: true,
    },
  });
}
