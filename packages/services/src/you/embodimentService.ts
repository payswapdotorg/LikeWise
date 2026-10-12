// YOU embodiment application service — the single authority over
// agent-embodiment truth (docs/you/CONTRACTS.md "Wave-7 contract freeze
// (v7)"; WORK_ORDERS.md W7A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one embodiment plane per solution: the
// append-only SolutionEventLedger, the Body registry, the Soul binding
// registry and the AvatarSession heads. The BODY/SOUL SEPARATION LAW
// (wave-7 core) holds by construction: possession, re-possession
// (soul-reassigned) and release NEVER touch the Body record — only the
// session record is replaced (immutably) and the ledger is appended. The
// embodiment-state ladder is a projection: every transition appends an
// embodiment-state-changed event and the session record's state field is
// the projection head. Phase 0 is fully deterministic: injected clock +
// seeded RNG; everything simulated stays labeled `simulated: true`
// (truth law).
//
// Lifecycle transition table (frozen W7A):
//   open    -> active (state: an interaction rung, default idle)
//   active  -> suspended (suspend op; state -> unavailable)
//   suspended -> active (resume op; state -> idle)
//   active | suspended -> closed (close op; terminal, state -> unavailable)
//   closed  -> terminal locked: every further mutation is a typed refusal.
//   active  -> active   (soul reassignment; status and state unchanged)

import type { AgentBody, AvatarSession, EmbodimentState, OpaqueId, SolutionEvent, SoulBinding } from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import {
  EMBODIMENT_DEFAULT_OPEN_STATE,
  EMBODIMENT_RESUMED_STATE,
  EMBODIMENT_SUSPENDED_STATE,
  embodimentTransitionRefusal,
  isEmbodimentInteractionState,
  isEmbodimentState,
} from "../../../shared/src/you/embodimentLadder.js";
import {
  replayEmbodimentLedger,
  type EmbodimentPlaneProjection,
} from "../../../shared/src/you/embodimentLedger.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory, type YouIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import { deepFreeze, stableContentHash } from "../../../shared/src/you/serialize.js";
import {
  addressAgentBodyAppearance,
  constructAgentBody,
  sortAgentBodies,
  validateAgentBodyInput,
  type AgentBodyAppearanceInput,
  type AgentBodyInput,
} from "../../../shared/src/you/bodyRegistry.js";
import {
  constructSoulBinding,
  sortSoulBindings,
  validateSoulBindingInput,
  type SoulBindingInput,
} from "../../../shared/src/you/soulBinding.js";
import {
  appendAvatarSessionClosed,
  appendAvatarSessionOpened,
  appendEmbodimentLifecycleTransition,
  appendEmbodimentStateChanged,
  appendSoulReassigned,
} from "./embodimentLedgerOps.js";
import { buildEmbodimentPlaneProjection } from "./embodimentProjection.js";
import {
  embodimentFailure,
  requireAvatarSession,
  type EmbodimentPlaneRecord,
  type EmbodimentServiceDeps,
  type EmbodimentServiceResult,
} from "./embodimentServiceTypes.js";

export interface EmbodimentServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  /** Content store for appearance addressing (same abstraction as the evidence lane). */
  readonly contentStore?: EvidenceContentStore;
}

/** The application-service authority over agent-embodiment truth. */
export class EmbodimentService {
  private readonly planes = new Map<OpaqueId, EmbodimentPlaneRecord>();
  private readonly deps: EmbodimentServiceDeps;
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

  /** Creates a deterministic service (injected clock + seeded ids/appearance content). */
  static create(config: EmbodimentServiceConfig): EmbodimentService {
    const seed = config.seed ?? "you-w7a-embodiment-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new EmbodimentService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
    );
  }

  // -- body registry -------------------------------------------------------

  /**
   * Registers an immutable AgentBody. Heavy appearance content is
   * content-addressed through the store (never inlined); refusals are the
   * stateless validator's stable reasons (typed YOU_INVALID_STATE for
   * intake shape, YOU_CONTENT_HASH_MISMATCH for a broken pre-addressed
   * appearance).
   */
  registerBody(
    solutionId: OpaqueId,
    input: AgentBodyInput,
  ): EmbodimentServiceResult<{ readonly body: AgentBody }> {
    const plane = this.planeFor(solutionId);
    const refusal = validateAgentBodyInput(input);
    if (refusal !== null) {
      return embodimentFailure("YOU_INVALID_STATE", `invalid agent body intake: ${refusal.detail}`, {
        reason: "invalid-body-intake",
        refusal: refusal.reason,
      });
    }
    const appearance: AgentBodyAppearanceInput = input.appearance ?? null;
    const addressed = addressAgentBodyAppearance(appearance, this.contentStore);
    if ("refusal" in addressed) {
      const code = addressed.refusal.reason === "appearance-hash-mismatch" ? "YOU_CONTENT_HASH_MISMATCH" : "YOU_INVALID_STATE";
      return embodimentFailure(code, `agent body appearance refused: ${addressed.refusal.detail}`, {
        reason: "invalid-body-intake",
        refusal: addressed.refusal.reason,
      });
    }
    const body = constructAgentBody(
      {
        ...input,
        appearance:
          addressed.appearanceRef === null || addressed.appearanceHash === null
            ? null
            : { contentRef: addressed.appearanceRef, contentHash: addressed.appearanceHash },
      },
      { ids: this.deps.ids, store: this.contentStore },
    );
    plane.bodies.set(body.id, body);
    return { ok: true, value: { body } };
  }

  /** The registered body, or typed YOU_BODY_NOT_FOUND. */
  bodyOf(solutionId: OpaqueId, bodyId: OpaqueId): EmbodimentServiceResult<{ readonly body: AgentBody }> {
    const body = this.planeFor(solutionId).bodies.get(bodyId);
    return body === undefined ? unknownBody(bodyId) : { ok: true, value: { body } };
  }

  /** All registered bodies, sorted by id. */
  bodiesOf(solutionId: OpaqueId): EmbodimentServiceResult<{ readonly bodies: readonly AgentBody[] }> {
    const plane = this.planeFor(solutionId);
    return { ok: true, value: { bodies: sortAgentBodies([...plane.bodies.values()]) } };
  }

  // -- soul binding registry -------------------------------------------------

  /**
   * Registers an immutable SoulBinding after the stateless provider-neutral
   * validation. Refusals are typed YOU_SOUL_BINDING_INVALID with the
   * validator's stable reason.
   */
  registerSoulBinding(
    solutionId: OpaqueId,
    input: SoulBindingInput,
  ): EmbodimentServiceResult<{ readonly soulBinding: SoulBinding }> {
    this.planeFor(solutionId);
    const refusal = validateSoulBindingInput(input);
    if (refusal !== null) {
      return embodimentFailure("YOU_SOUL_BINDING_INVALID", `soul binding refused: ${refusal.detail}`, {
        reason: refusal.reason,
      });
    }
    const soulBinding = constructSoulBinding(input, { ids: this.deps.ids });
    this.planeFor(solutionId).soulBindings.set(soulBinding.id, soulBinding);
    return { ok: true, value: { soulBinding } };
  }

  /** The registered soul binding, or typed YOU_SOUL_BINDING_INVALID (unknown binding). */
  soulBindingOf(solutionId: OpaqueId, soulBindingId: OpaqueId): EmbodimentServiceResult<{ readonly soulBinding: SoulBinding }> {
    const soulBinding = this.planeFor(solutionId).soulBindings.get(soulBindingId);
    return soulBinding === undefined ? unknownSoulBinding(soulBindingId) : { ok: true, value: { soulBinding } };
  }

  /** All registered soul bindings, sorted by id. */
  soulBindingsOf(solutionId: OpaqueId): EmbodimentServiceResult<{ readonly soulBindings: readonly SoulBinding[] }> {
    const plane = this.planeFor(solutionId);
    return { ok: true, value: { soulBindings: sortSoulBindings([...plane.soulBindings.values()]) } };
  }

  // -- avatar session lifecycle ----------------------------------------------

  /**
   * Opens an avatar session: a Body possessed by a Soul. The session starts
   * active with the given opening ladder state (an interaction rung;
   * default idle — the "unavailable" rung is lifecycle-owned and cannot
   * open a session). Emits avatar-session-opened.
   */
  openAvatarSession(
    solutionId: OpaqueId,
    input: {
      readonly bodyId: OpaqueId;
      readonly soulBindingId: OpaqueId;
      readonly initialState?: EmbodimentState;
    },
  ): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const body = plane.bodies.get(input.bodyId);
    if (body === undefined) {
      return unknownBody(input.bodyId);
    }
    const soul = plane.soulBindings.get(input.soulBindingId);
    if (soul === undefined) {
      return unknownSoulBinding(input.soulBindingId);
    }
    const initialState = input.initialState ?? EMBODIMENT_DEFAULT_OPEN_STATE;
    if (!isEmbodimentState(initialState)) {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", `unknown embodiment state: ${String(initialState)}`, {
        reason: "state-not-on-ladder",
        state: String(initialState),
      });
    }
    if (!isEmbodimentInteractionState(initialState)) {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", "a session cannot open on the lifecycle-owned unavailable rung", {
        reason: "unavailable-is-lifecycle-owned",
        state: initialState,
      });
    }
    const session: AvatarSession = deepFreeze({
      id: this.deps.ids.next("avatar-session"),
      bodyId: body.id,
      soulBindingId: soul.id,
      status: "active",
      state: initialState,
      openedAt: this.deps.clock.now(),
      closedAt: null,
      simulated: true,
    });
    plane.sessions.set(session.id, session);
    appendAvatarSessionOpened(plane, session, body, soul);
    return { ok: true, value: { session } };
  }

  /**
   * Projects the next embodiment state (append-only). Legal moves are the
   * frozen W7A transition table: the eight interaction rungs are fully
   * connected (no self-loops); the unavailable rung is lifecycle-owned.
   * Suspended sessions refuse activity transitions; closed sessions are
   * terminal. Emits embodiment-state-changed.
   */
  transitionEmbodimentState(
    solutionId: OpaqueId,
    sessionId: OpaqueId,
    nextState: EmbodimentState,
  ): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const found = requireAvatarSession(plane, sessionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const current = found.session;
    if (current.status === "closed") {
      return terminalRefusal(current, "session-closed");
    }
    if (current.status === "suspended") {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", "a suspended avatar session refuses activity transitions", {
        reason: "session-suspended",
        sessionId,
        state: current.state,
      });
    }
    if (!isEmbodimentState(nextState)) {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", `unknown embodiment state: ${String(nextState)}`, {
        reason: "state-not-on-ladder",
        sessionId,
        state: String(nextState),
      });
    }
    const refusal = embodimentTransitionRefusal(current.state, nextState);
    if (refusal !== null) {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", `refused embodiment transition ${current.state} -> ${nextState}: ${refusal}`, {
        reason: refusal,
        sessionId,
        stateBefore: current.state,
        stateAfter: nextState,
      });
    }
    const sessionAfter: AvatarSession = deepFreeze({ ...current, state: nextState });
    plane.sessions.set(sessionId, sessionAfter);
    appendEmbodimentStateChanged(plane, sessionId, current.state, sessionAfter);
    return { ok: true, value: { session: sessionAfter } };
  }

  /** Suspends an active session (state -> unavailable). Emits embodiment-state-changed (status rides along). */
  suspendAvatarSession(solutionId: OpaqueId, sessionId: OpaqueId): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const found = requireAvatarSession(plane, sessionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const current = found.session;
    if (current.status === "closed") {
      return terminalRefusal(current, "session-closed");
    }
    if (current.status === "suspended") {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", "avatar session is already suspended", {
        reason: "already-suspended",
        sessionId,
        state: current.state,
      });
    }
    const sessionAfter: AvatarSession = deepFreeze({
      ...current,
      status: "suspended",
      state: EMBODIMENT_SUSPENDED_STATE,
    });
    plane.sessions.set(sessionId, sessionAfter);
    appendEmbodimentLifecycleTransition(plane, sessionId, current.state, sessionAfter, "suspend");
    return { ok: true, value: { session: sessionAfter } };
  }

  /** Resumes a suspended session (state -> idle). Emits embodiment-state-changed (status rides along). */
  resumeAvatarSession(solutionId: OpaqueId, sessionId: OpaqueId): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const found = requireAvatarSession(plane, sessionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const current = found.session;
    if (current.status === "closed") {
      return terminalRefusal(current, "session-closed");
    }
    if (current.status === "active") {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", "avatar session is not suspended", {
        reason: "not-suspended",
        sessionId,
        state: current.state,
      });
    }
    const sessionAfter: AvatarSession = deepFreeze({
      ...current,
      status: "active",
      state: EMBODIMENT_RESUMED_STATE,
    });
    plane.sessions.set(sessionId, sessionAfter);
    appendEmbodimentLifecycleTransition(plane, sessionId, current.state, sessionAfter, "resume");
    return { ok: true, value: { session: sessionAfter } };
  }

  /**
   * Re-possesses the session's Body with another Soul (BODY/SOUL
   * SEPARATION LAW): the session record is immutably replaced with the new
   * soulBindingId; the Body record is NEVER mutated. The new binding must
   * be registered (typed YOU_SOUL_BINDING_INVALID otherwise). Emits
   * soul-reassigned.
   */
  reassignSoul(
    solutionId: OpaqueId,
    sessionId: OpaqueId,
    toSoulBindingId: OpaqueId,
  ): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const found = requireAvatarSession(plane, sessionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const current = found.session;
    if (current.status === "closed") {
      return terminalRefusal(current, "session-closed");
    }
    const toSoul = plane.soulBindings.get(toSoulBindingId);
    if (toSoul === undefined) {
      return unknownSoulBinding(toSoulBindingId);
    }
    const fromSoulBindingId = current.soulBindingId;
    const sessionAfter: AvatarSession = deepFreeze({ ...current, soulBindingId: toSoul.id });
    plane.sessions.set(sessionId, sessionAfter);
    appendSoulReassigned(plane, sessionAfter, fromSoulBindingId, toSoul);
    return { ok: true, value: { session: sessionAfter } };
  }

  /** Closes a session (terminal; state -> unavailable). Emits avatar-session-closed. */
  closeAvatarSession(solutionId: OpaqueId, sessionId: OpaqueId): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const found = requireAvatarSession(plane, sessionId);
    if ("error" in found) {
      return { ok: false, error: found.error };
    }
    const current = found.session;
    if (current.status === "closed") {
      return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", "avatar session is already closed (terminal)", {
        reason: "already-closed",
        sessionId,
        state: current.state,
      });
    }
    const sessionAfter: AvatarSession = deepFreeze({
      ...current,
      status: "closed",
      state: EMBODIMENT_SUSPENDED_STATE,
      closedAt: this.deps.clock.now(),
    });
    plane.sessions.set(sessionId, sessionAfter);
    appendAvatarSessionClosed(plane, sessionAfter);
    return { ok: true, value: { session: sessionAfter } };
  }

  // -- reads / projection / persistence ------------------------------------

  sessionOf(solutionId: OpaqueId, sessionId: OpaqueId): EmbodimentServiceResult<{ readonly session: AvatarSession }> {
    const plane = this.planeFor(solutionId);
    const found = requireAvatarSession(plane, sessionId);
    return "error" in found ? { ok: false, error: found.error } : { ok: true, value: { session: found.session } };
  }

  sessionsOf(solutionId: OpaqueId): EmbodimentServiceResult<{ readonly sessions: readonly AvatarSession[] }> {
    const plane = this.planeFor(solutionId);
    const sessions = [...plane.sessions.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ok: true, value: { sessions } };
  }

  /** Live authoritative projection (same shape as replayEmbodimentLedger output). */
  projectionOf(solutionId: OpaqueId): EmbodimentServiceResult<EmbodimentPlaneProjection> {
    return { ok: true, value: buildEmbodimentPlaneProjection(this.planeFor(solutionId)) };
  }

  ledgerEventsOf(solutionId: OpaqueId): EmbodimentServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): EmbodimentServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  /** Deterministic ledger content hash (golden comparisons). */
  ledgerHashOf(solutionId: OpaqueId): EmbodimentServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Number of stored appearance content refs (fixture observability). */
  contentStoreSize(): number {
    return this.contentStore.size;
  }

  /** Replays a persisted ledger through the shared embodiment-plane fold. */
  static replay(events: readonly SolutionEvent[]): EmbodimentPlaneProjection {
    return replayEmbodimentLedger(events);
  }

  // -- internals -----------------------------------------------------------

  /** Lazily opens (and caches) the embodiment plane for one solution. */
  private planeFor(solutionId: OpaqueId): EmbodimentPlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: EmbodimentPlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.deps),
      bodies: new Map(),
      soulBindings: new Map(),
      sessions: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

function unknownBody<T>(bodyId: OpaqueId): EmbodimentServiceResult<T> {
  return embodimentFailure("YOU_BODY_NOT_FOUND", "unknown agent body", { reason: "unknown-body", bodyId });
}

function unknownSoulBinding<T>(soulBindingId: OpaqueId): EmbodimentServiceResult<T> {
  return embodimentFailure("YOU_SOUL_BINDING_INVALID", "unknown soul binding", {
    reason: "unknown-soul-binding",
    soulBindingId,
  });
}

function terminalRefusal<T>(session: AvatarSession, reason: string): EmbodimentServiceResult<T> {
  return embodimentFailure("YOU_EMBODIMENT_STATE_INVALID", `avatar session is closed (terminal): ${session.id}`, {
    reason,
    sessionId: session.id,
    status: session.status,
  });
}

/** Creates the deterministic embodiment application service. */
export function createEmbodimentService(config: EmbodimentServiceConfig): EmbodimentService {
  return EmbodimentService.create(config);
}
