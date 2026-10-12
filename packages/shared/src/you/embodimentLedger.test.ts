import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { SolutionEventLedger } from "./events.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { replayEmbodimentLedger } from "./embodimentLedger.js";

const SOLUTION = "you_w7a_ledger_test";

function ledgerFor(seed: number): SolutionEventLedger {
  return new SolutionEventLedger(SOLUTION, {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(seed)),
  });
}

/** A scripted event stream exercising all four v7 embodiment event types. */
function scriptEvents(seed: number): readonly SolutionEvent[] {
  const ledger = ledgerFor(seed);
  const sessionA = "you_avatar-session_aaaa1111aaaa1111";
  const sessionB = "you_avatar-session_bbbb2222bbbb2222";
  const body = "you_agent-body_cccc3333cccc3333";
  const soulA = "you_soul-binding_dddd4444dddd4444";
  const soulB = "you_soul-binding_eeee5555eeee5555";

  ledger.append({
    type: "avatar-session-opened",
    subjectRef: sessionA,
    payload: {
      sessionId: sessionA,
      bodyId: body,
      bodyRole: "research-companion",
      bodyAppearanceRef: "you_content_0123456789abcdef",
      bodyAppearanceHash: "a".repeat(64),
      bodyCapabilityCount: 3,
      bodyToolCount: 2,
      bodyPolicyRefCount: 1,
      soulBindingId: soulA,
      soulProviderKind: "synthetic-llm",
      soulModelRef: "fixture-loom-1",
      soulRoutingProfile: "system-one",
      soulCapabilityCount: 2,
      statusAfter: "active",
      stateAfter: "idle",
      openedAt: "2026-01-01T00:00:00.000Z",
      simulated: true,
    },
  });
  ledger.append({
    type: "embodiment-state-changed",
    subjectRef: sessionA,
    payload: { sessionId: sessionA, stateBefore: "idle", stateAfter: "thinking", reason: "activity", simulated: true },
  });
  ledger.append({
    type: "embodiment-state-changed",
    subjectRef: sessionA,
    payload: {
      sessionId: sessionA,
      stateBefore: "thinking",
      stateAfter: "unavailable",
      statusAfter: "suspended",
      reason: "suspend",
      simulated: true,
    },
  });
  ledger.append({
    type: "embodiment-state-changed",
    subjectRef: sessionA,
    payload: {
      sessionId: sessionA,
      stateBefore: "unavailable",
      stateAfter: "idle",
      statusAfter: "active",
      reason: "resume",
      simulated: true,
    },
  });
  ledger.append({
    type: "soul-reassigned",
    subjectRef: sessionA,
    payload: {
      sessionId: sessionA,
      bodyId: body,
      fromSoulBindingId: soulA,
      toSoulBindingId: soulB,
      toSoulProviderKind: "synthetic-vlm",
      toSoulModelRef: "fixture-loom-2",
      toSoulRoutingProfile: "system-two",
      toSoulCapabilityCount: 2,
      statusAfter: "active",
      stateAfter: "idle",
      simulated: true,
    },
  });
  ledger.append({
    type: "avatar-session-closed",
    subjectRef: sessionA,
    payload: {
      sessionId: sessionA,
      statusAfter: "closed",
      stateAfter: "unavailable",
      closedAt: "2026-01-01T00:00:09.000Z",
      simulated: true,
    },
  });
  // A second session on the same body (re-possession after release).
  ledger.append({
    type: "avatar-session-opened",
    subjectRef: sessionB,
    payload: {
      sessionId: sessionB,
      bodyId: body,
      bodyRole: "research-companion",
      bodyAppearanceRef: "you_content_0123456789abcdef",
      bodyAppearanceHash: "a".repeat(64),
      bodyCapabilityCount: 3,
      bodyToolCount: 2,
      bodyPolicyRefCount: 1,
      soulBindingId: soulB,
      soulProviderKind: "synthetic-vlm",
      soulModelRef: "fixture-loom-2",
      soulRoutingProfile: "system-two",
      soulCapabilityCount: 2,
      statusAfter: "active",
      stateAfter: "listening",
      openedAt: "2026-01-01T00:00:10.000Z",
      simulated: true,
    },
  });
  return ledger.events();
}

test("the fold reproduces the session head: status, ladder state, counts, closedAt", () => {
  const projection = replayEmbodimentLedger(scriptEvents(1));
  const sessionA = projection.sessions["you_avatar-session_aaaa1111aaaa1111"];
  assert.notEqual(sessionA, undefined);
  assert.equal(sessionA?.bodyId, "you_agent-body_cccc3333cccc3333");
  assert.equal(sessionA?.soulBindingId, "you_soul-binding_eeee5555eeee5555");
  assert.equal(sessionA?.status, "closed");
  assert.equal(sessionA?.state, "unavailable");
  assert.equal(sessionA?.closedAt, "2026-01-01T00:00:09.000Z");
  assert.equal(sessionA?.transitionCount, 3);
  assert.equal(sessionA?.reassignmentCount, 1);

  const sessionB = projection.sessions["you_avatar-session_bbbb2222bbbb2222"];
  assert.notEqual(sessionB, undefined);
  assert.equal(sessionB?.status, "active");
  assert.equal(sessionB?.state, "listening");
  assert.equal(sessionB?.soulBindingId, "you_soul-binding_eeee5555eeee5555");
  assert.equal(sessionB?.closedAt, null);
});

test("the fold reconstructs body facts and both soul bindings from event payloads", () => {
  const projection = replayEmbodimentLedger(scriptEvents(2));
  const body = projection.bodies["you_agent-body_cccc3333cccc3333"];
  assert.notEqual(body, undefined);
  assert.equal(body?.role, "research-companion");
  assert.equal(body?.appearanceRef, "you_content_0123456789abcdef");
  assert.equal(body?.appearanceHash, "a".repeat(64));
  assert.equal(body?.capabilityCount, 3);
  assert.equal(body?.toolCount, 2);
  assert.equal(body?.policyRefCount, 1);

  assert.equal(projection.soulBindings["you_soul-binding_dddd4444dddd4444"]?.providerKind, "synthetic-llm");
  assert.equal(projection.soulBindings["you_soul-binding_dddd4444dddd4444"]?.routingProfile, "system-one");
  assert.equal(projection.soulBindings["you_soul-binding_eeee5555eeee5555"]?.providerKind, "synthetic-vlm");
  assert.equal(projection.soulBindings["you_soul-binding_eeee5555eeee5555"]?.routingProfile, "system-two");
});

test("replay is deterministic: same events => byte-identical projection", () => {
  const left = replayEmbodimentLedger(scriptEvents(3));
  const right = replayEmbodimentLedger(scriptEvents(3));
  assert.equal(stableStringify(left), stableStringify(right));
  // The ledger ids differ across seeds but the projection is keyed by the
  // payload session ids, so identical payload scripts still fold equal.
  const otherSeed = replayEmbodimentLedger(scriptEvents(4));
  assert.equal(stableStringify(otherSeed), stableStringify(right));
});

test("an empty ledger is refused (never an invented projection)", () => {
  assert.throws(() => replayEmbodimentLedger([]), /requires at least one event/);
});

test("events referencing unknown sessions are folded defensively (total fold)", () => {
  const ledger = ledgerFor(5);
  ledger.append({
    type: "avatar-session-opened",
    subjectRef: "s1",
    payload: { sessionId: "s1", bodyId: "b1", soulBindingId: "k1", statusAfter: "active", stateAfter: "idle", simulated: true },
  });
  ledger.append({
    type: "embodiment-state-changed",
    subjectRef: "ghost",
    payload: { sessionId: "ghost", stateBefore: "idle", stateAfter: "speaking", reason: "activity", simulated: true },
  });
  ledger.append({
    type: "avatar-session-closed",
    subjectRef: "ghost",
    payload: { sessionId: "ghost", statusAfter: "closed", stateAfter: "unavailable", closedAt: "t", simulated: true },
  });
  const projection = replayEmbodimentLedger(ledger.events());
  assert.equal(projection.sessions["s1"]?.state, "idle");
  assert.equal(projection.sessions["s1"]?.status, "active");
  assert.equal(projection.sessions["ghost"], undefined);
});
