import assert from "node:assert/strict";
import test from "node:test";
import type { AgentBody, AvatarSession, OpaqueId, SoulBinding } from "@zcode/shared";
import { EMBODIMENT_INTERACTION_STATES } from "../../../shared/src/you/embodimentLadder.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createEmbodimentService, EmbodimentService } from "./embodimentService.js";

const SOLUTION = "you_w7a_service_test";

interface Fixture {
  readonly service: EmbodimentService;
  readonly body: AgentBody;
  readonly soulA: SoulBinding;
  readonly soulB: SoulBinding;
}

const BODY_INPUT = {
  role: "research-companion",
  appearance: { spec: { silhouette: "neutral-humanoid", palette: ["#23313d", "#31465a"] } },
  capabilities: ["conversation", "tool-invocation"],
  tools: ["you_tool_web_search"],
  policyRefs: ["you_policy_embodiment_default"],
  memoryContractRef: "you_memory_contract_session_scoped",
  evaluatorContractRef: "you_evaluator_contract_w7a",
};

const SOUL_A_INPUT = {
  providerKind: "synthetic-llm",
  modelRef: "fixture-loom-1",
  routingProfile: "system-one" as const,
  capabilities: ["fast-reply", "streaming"],
};

const SOUL_B_INPUT = {
  providerKind: "synthetic-vlm",
  modelRef: "fixture-loom-2",
  routingProfile: "system-two" as const,
  capabilities: ["deep-reasoning", "vision"],
};

function createFixture(seed: string): Fixture {
  const service = createEmbodimentService({ workspaceIdentity: "ws-w7a-service-test", seed });
  const body = service.registerBody(SOLUTION, BODY_INPUT);
  assert.ok(body.ok);
  const soulA = service.registerSoulBinding(SOLUTION, SOUL_A_INPUT);
  assert.ok(soulA.ok);
  const soulB = service.registerSoulBinding(SOLUTION, SOUL_B_INPUT);
  assert.ok(soulB.ok);
  return { service, body: body.value.body, soulA: soulA.value.soulBinding, soulB: soulB.value.soulBinding };
}

function openSession(fixture: Fixture, soulBindingId: OpaqueId = fixture.soulA.id): AvatarSession {
  const opened = fixture.service.openAvatarSession(SOLUTION, { bodyId: fixture.body.id, soulBindingId });
  assert.ok(opened.ok);
  return opened.value.session;
}

test("the body registry registers, addresses appearance content, and reads back immutably", () => {
  const fixture = createFixture("registry");
  const found = fixture.service.bodyOf(SOLUTION, fixture.body.id);
  assert.ok(found.ok);
  assert.equal(found.value.body, fixture.body);
  assert.notEqual(fixture.body.appearanceRef, null);
  assert.match(fixture.body.appearanceHash ?? "", /^[0-9a-f]{64}$/);
  const listed = fixture.service.bodiesOf(SOLUTION);
  assert.ok(listed.ok);
  assert.equal(listed.value.bodies.length, 1);
  assert.ok(Object.isFrozen(fixture.body));
});

test("unknown bodies and unknown soul bindings are typed refusals", () => {
  const fixture = createFixture("errors");
  const missingBody = fixture.service.openAvatarSession(SOLUTION, {
    bodyId: "you_agent-body_missing",
    soulBindingId: fixture.soulA.id,
  });
  assert.ok(!missingBody.ok);
  assert.equal(missingBody.error.code, "YOU_BODY_NOT_FOUND");
  assert.equal(missingBody.error.details["reason"], "unknown-body");
  assert.equal(missingBody.error.simulated, true);

  const missingSoul = fixture.service.openAvatarSession(SOLUTION, {
    bodyId: fixture.body.id,
    soulBindingId: "you_soul-binding_missing",
  });
  assert.ok(!missingSoul.ok);
  assert.equal(missingSoul.error.code, "YOU_SOUL_BINDING_INVALID");
  assert.equal(missingSoul.error.details["reason"], "unknown-soul-binding");

  const unknownSoulRead = fixture.service.soulBindingOf(SOLUTION, "you_soul-binding_missing");
  assert.ok(!unknownSoulRead.ok);
  assert.equal(unknownSoulRead.error.code, "YOU_SOUL_BINDING_INVALID");

  const unknownBodyRead = fixture.service.bodyOf(SOLUTION, "you_agent-body_missing");
  assert.ok(!unknownBodyRead.ok);
  assert.equal(unknownBodyRead.error.code, "YOU_BODY_NOT_FOUND");
});

test("soul binding registration refusals are typed YOU_SOUL_BINDING_INVALID with stable reasons", () => {
  const fixture = createFixture("soul-refusals");
  const cases = [
    [{ ...SOUL_A_INPUT, providerKind: "" }, "provider-kind-empty"],
    [{ ...SOUL_A_INPUT, modelRef: "" }, "model-ref-empty"],
    [{ ...SOUL_A_INPUT, routingProfile: "system-three" as never }, "routing-profile-invalid"],
    [{ ...SOUL_A_INPUT, capabilities: [""] }, "capability-invalid"],
  ] as const;
  for (const [input, reason] of cases) {
    const refused = fixture.service.registerSoulBinding(SOLUTION, input);
    assert.ok(!refused.ok, reason);
    assert.equal(refused.error.code, "YOU_SOUL_BINDING_INVALID");
    assert.equal(refused.error.details["reason"], reason);
    assert.equal(refused.error.simulated, true);
  }
});

test("body registration refusals are typed (invalid intake / hash mismatch)", () => {
  const fixture = createFixture("body-refusals");
  const refused = fixture.service.registerBody(SOLUTION, { ...BODY_INPUT, role: "" });
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_INVALID_STATE");
  assert.equal(refused.error.details["reason"], "invalid-body-intake");
  assert.equal(refused.error.details["refusal"], "role-empty");

  const mismatch = fixture.service.registerBody(SOLUTION, {
    ...BODY_INPUT,
    appearance: { contentRef: "you_content_missing", contentHash: "a".repeat(64) },
  });
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.error.code, "YOU_INVALID_STATE");
  assert.equal(mismatch.error.details["refusal"], "appearance-ref-unresolved");

  const addressed = fixture.body.appearanceRef ?? "";
  const wrongHash = fixture.service.registerBody(SOLUTION, {
    ...BODY_INPUT,
    appearance: { contentRef: addressed, contentHash: "b".repeat(64) },
  });
  assert.ok(!wrongHash.ok);
  assert.equal(wrongHash.error.code, "YOU_CONTENT_HASH_MISMATCH");
  assert.equal(wrongHash.error.details["refusal"], "appearance-hash-mismatch");
});

test("unknown avatar sessions are typed YOU_AVATAR_SESSION_NOT_FOUND across every op", () => {
  const fixture = createFixture("session-errors");
  const missing = "you_avatar-session_missing";
  for (const result of [
    fixture.service.transitionEmbodimentState(SOLUTION, missing, "listening"),
    fixture.service.suspendAvatarSession(SOLUTION, missing),
    fixture.service.resumeAvatarSession(SOLUTION, missing),
    fixture.service.reassignSoul(SOLUTION, missing, fixture.soulA.id),
    fixture.service.closeAvatarSession(SOLUTION, missing),
    fixture.service.sessionOf(SOLUTION, missing),
  ]) {
    assert.ok(!result.ok);
    assert.equal(result.error.code, "YOU_AVATAR_SESSION_NOT_FOUND");
    assert.equal(result.error.details["reason"], "unknown-avatar-session");
  }
});

test("opening refuses off-ladder states and the lifecycle-owned unavailable rung", () => {
  const fixture = createFixture("open-refusals");
  const offLadder = fixture.service.openAvatarSession(SOLUTION, {
    bodyId: fixture.body.id,
    soulBindingId: fixture.soulA.id,
    initialState: "pontificating" as never,
  });
  assert.ok(!offLadder.ok);
  assert.equal(offLadder.error.code, "YOU_EMBODIMENT_STATE_INVALID");
  assert.equal(offLadder.error.details["reason"], "state-not-on-ladder");

  const unavailable = fixture.service.openAvatarSession(SOLUTION, {
    bodyId: fixture.body.id,
    soulBindingId: fixture.soulA.id,
    initialState: "unavailable",
  });
  assert.ok(!unavailable.ok);
  assert.equal(unavailable.error.code, "YOU_EMBODIMENT_STATE_INVALID");
  assert.equal(unavailable.error.details["reason"], "unavailable-is-lifecycle-owned");
});

test("the lifecycle transition table: open -> active, suspend/resume, close terminal", () => {
  const fixture = createFixture("lifecycle");
  const session = openSession(fixture);
  assert.equal(session.status, "active");
  assert.equal(session.state, "idle");
  assert.equal(session.simulated, true);
  assert.equal(session.closedAt, null);

  const suspended = fixture.service.suspendAvatarSession(SOLUTION, session.id);
  assert.ok(suspended.ok);
  assert.equal(suspended.value.session.status, "suspended");
  assert.equal(suspended.value.session.state, "unavailable");

  // Double-suspend is refused.
  const doubleSuspend = fixture.service.suspendAvatarSession(SOLUTION, session.id);
  assert.ok(!doubleSuspend.ok);
  assert.equal(doubleSuspend.error.code, "YOU_EMBODIMENT_STATE_INVALID");
  assert.equal(doubleSuspend.error.details["reason"], "already-suspended");

  // Activity transitions are refused while suspended.
  const whileSuspended = fixture.service.transitionEmbodimentState(SOLUTION, session.id, "listening");
  assert.ok(!whileSuspended.ok);
  assert.equal(whileSuspended.error.details["reason"], "session-suspended");

  const resumed = fixture.service.resumeAvatarSession(SOLUTION, session.id);
  assert.ok(resumed.ok);
  assert.equal(resumed.value.session.status, "active");
  assert.equal(resumed.value.session.state, "idle");

  // Resume of an active session is refused.
  const resumeActive = fixture.service.resumeAvatarSession(SOLUTION, session.id);
  assert.ok(!resumeActive.ok);
  assert.equal(resumeActive.error.details["reason"], "not-suspended");

  const closed = fixture.service.closeAvatarSession(SOLUTION, session.id);
  assert.ok(closed.ok);
  assert.equal(closed.value.session.status, "closed");
  assert.equal(closed.value.session.state, "unavailable");
  assert.notEqual(closed.value.session.closedAt, null);

  // Terminals are locked: every further mutation refuses.
  const alreadyClosed = fixture.service.closeAvatarSession(SOLUTION, session.id);
  assert.ok(!alreadyClosed.ok);
  assert.equal(alreadyClosed.error.details["reason"], "already-closed");
  for (const terminal of [
    fixture.service.transitionEmbodimentState(SOLUTION, session.id, "listening"),
    fixture.service.suspendAvatarSession(SOLUTION, session.id),
    fixture.service.resumeAvatarSession(SOLUTION, session.id),
    fixture.service.reassignSoul(SOLUTION, session.id, fixture.soulB.id),
  ]) {
    assert.ok(!terminal.ok, "terminal op must refuse");
    assert.equal(terminal.error.code, "YOU_EMBODIMENT_STATE_INVALID");
    assert.equal(terminal.error.details["reason"], "session-closed");
  }
});

test("the nine-state ladder: every legal interaction pair transitions; illegal pairs refuse", () => {
  const fixture = createFixture("ladder");
  for (const from of EMBODIMENT_INTERACTION_STATES) {
    for (const to of EMBODIMENT_INTERACTION_STATES) {
      // Every interaction rung is a legal opening state, so open directly
      // on `from` for each pair (fresh session per pair keeps the table
      // assertion exact).
      const opened = fixture.service.openAvatarSession(SOLUTION, {
        bodyId: fixture.body.id,
        soulBindingId: fixture.soulA.id,
        initialState: from,
      });
      assert.ok(opened.ok, from);
      assert.equal(opened.value.session.state, from);

      const result = fixture.service.transitionEmbodimentState(SOLUTION, opened.value.session.id, to);
      if (from === to) {
        assert.ok(!result.ok, `${from} -> ${to} must refuse`);
        assert.equal(result.error.code, "YOU_EMBODIMENT_STATE_INVALID");
        assert.equal(result.error.details["reason"], "no-op-transition");
      } else {
        assert.ok(result.ok, `${from} -> ${to} must pass`);
        assert.equal(result.value.session.state, to);
      }
      const toUnavailable = fixture.service.transitionEmbodimentState(SOLUTION, opened.value.session.id, "unavailable");
      assert.ok(!toUnavailable.ok);
      assert.equal(toUnavailable.error.details["reason"], "unavailable-is-lifecycle-owned");
      assert.ok(fixture.service.closeAvatarSession(SOLUTION, opened.value.session.id).ok);
    }
  }
});

test("off-ladder states are typed YOU_EMBODIMENT_STATE_INVALID refusals", () => {
  const fixture = createFixture("off-ladder");
  const session = openSession(fixture);
  const refused = fixture.service.transitionEmbodimentState(SOLUTION, session.id, "pontificating" as never);
  assert.ok(!refused.ok);
  assert.equal(refused.error.code, "YOU_EMBODIMENT_STATE_INVALID");
  assert.equal(refused.error.details["reason"], "state-not-on-ladder");
  assert.equal(refused.error.details["state"], "pontificating");
});

test("BODY/SOUL SEPARATION LAW: soul reassignment never mutates the Body record", () => {
  const fixture = createFixture("separation");
  const session = openSession(fixture);
  const bodyJsonBefore = stableStringify(fixture.body);

  const reassigned = fixture.service.reassignSoul(SOLUTION, session.id, fixture.soulB.id);
  assert.ok(reassigned.ok);
  assert.equal(reassigned.value.session.soulBindingId, fixture.soulB.id);
  assert.equal(reassigned.value.session.status, "active");
  assert.equal(reassigned.value.session.state, session.state);
  assert.notEqual(reassigned.value.session.soulBindingId, session.soulBindingId);

  // The Body record is the SAME frozen object and byte-identical.
  const bodyAfter = fixture.service.bodyOf(SOLUTION, fixture.body.id);
  assert.ok(bodyAfter.ok);
  assert.equal(bodyAfter.value.body, fixture.body);
  assert.equal(stableStringify(bodyAfter.value.body), bodyJsonBefore);

  // Reassignment to an unknown soul is a typed refusal.
  const unknown = fixture.service.reassignSoul(SOLUTION, session.id, "you_soul-binding_missing");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.code, "YOU_SOUL_BINDING_INVALID");

  // The ledger carries the soul-reassigned event.
  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  assert.equal(events.value.filter((event) => event.type === "soul-reassigned").length, 1);
});

test("a released Body can be re-possessed by a new session (open -> reassign -> close)", () => {
  const fixture = createFixture("repossession");
  const first = openSession(fixture);
  assert.ok(fixture.service.closeAvatarSession(SOLUTION, first.id).ok);

  const second = openSession(fixture, fixture.soulA.id);
  const reassigned = fixture.service.reassignSoul(SOLUTION, second.id, fixture.soulB.id);
  assert.ok(reassigned.ok);
  assert.equal(reassigned.value.session.bodyId, fixture.body.id);
  assert.ok(fixture.service.closeAvatarSession(SOLUTION, second.id).ok);

  // The Body is still byte-identical after the whole re-possession cycle.
  const body = fixture.service.bodyOf(SOLUTION, fixture.body.id);
  assert.ok(body.ok);
  assert.equal(body.value.body, fixture.body);
});

test("session records are immutable: prior heads stay untouched after later transitions", () => {
  const fixture = createFixture("immutability");
  const opened = openSession(fixture);
  const first = fixture.service.transitionEmbodimentState(SOLUTION, opened.id, "thinking");
  assert.ok(first.ok);
  const second = fixture.service.transitionEmbodimentState(SOLUTION, opened.id, "speaking");
  assert.ok(second.ok);
  assert.equal(opened.state, "idle");
  assert.equal(first.value.session.state, "thinking");
  assert.equal(second.value.session.state, "speaking");
  assert.ok(Object.isFrozen(opened));
  assert.ok(Object.isFrozen(second.value.session));
  assert.throws(() => {
    (second.value.session as { state: string }).state = "listening";
  }, /Cannot assign to read only property|not extensible/);
});

test("the ledger is append-only: earlier events never change as the session evolves", () => {
  const fixture = createFixture("append-only");
  const session = openSession(fixture);
  const before = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(before.ok);
  const beforeJson = stableStringify(before.value);
  assert.ok(fixture.service.transitionEmbodimentState(SOLUTION, session.id, "thinking").ok);
  assert.ok(fixture.service.suspendAvatarSession(SOLUTION, session.id).ok);
  assert.ok(fixture.service.resumeAvatarSession(SOLUTION, session.id).ok);
  assert.ok(fixture.service.closeAvatarSession(SOLUTION, session.id).ok);
  const after = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(after.ok);
  assert.equal(after.value.length, before.value.length + 4);
  assert.equal(stableStringify(after.value.slice(0, before.value.length)), beforeJson);
});

test("the live projection equals the ledger replay exactly (append-only state reproduction)", () => {
  const fixture = createFixture("parity");
  const session = openSession(fixture);
  assert.ok(fixture.service.transitionEmbodimentState(SOLUTION, session.id, "reading").ok);
  assert.ok(fixture.service.suspendAvatarSession(SOLUTION, session.id).ok);
  assert.ok(fixture.service.resumeAvatarSession(SOLUTION, session.id).ok);
  assert.ok(fixture.service.reassignSoul(SOLUTION, session.id, fixture.soulB.id).ok);
  const second = openSession(fixture, fixture.soulB.id);
  assert.ok(fixture.service.transitionEmbodimentState(SOLUTION, second.id, "tool_use").ok);
  assert.ok(fixture.service.closeAvatarSession(SOLUTION, second.id).ok);

  const events = fixture.service.ledgerEventsOf(SOLUTION);
  assert.ok(events.ok);
  const projection = fixture.service.projectionOf(SOLUTION);
  assert.ok(projection.ok);
  const replay = EmbodimentService.replay(events.value);
  assert.equal(stableStringify(projection.value), stableStringify(replay));

  const sessionHead = replay.sessions[session.id];
  assert.equal(sessionHead?.status, "active");
  assert.equal(sessionHead?.state, "idle");
  assert.equal(sessionHead?.soulBindingId, fixture.soulB.id);
  assert.equal(sessionHead?.reassignmentCount, 1);
});

test("determinism: same seed + same op script => byte-identical ledgers and hashes", () => {
  const script = (service: EmbodimentService): string => {
    const body = service.registerBody(SOLUTION, BODY_INPUT);
    assert.ok(body.ok);
    const soulA = service.registerSoulBinding(SOLUTION, SOUL_A_INPUT);
    assert.ok(soulA.ok);
    const opened = service.openAvatarSession(SOLUTION, { bodyId: body.value.body.id, soulBindingId: soulA.value.soulBinding.id });
    assert.ok(opened.ok);
    assert.ok(service.transitionEmbodimentState(SOLUTION, opened.value.session.id, "thinking").ok);
    assert.ok(service.suspendAvatarSession(SOLUTION, opened.value.session.id).ok);
    assert.ok(service.resumeAvatarSession(SOLUTION, opened.value.session.id).ok);
    assert.ok(service.closeAvatarSession(SOLUTION, opened.value.session.id).ok);
    const hash = service.ledgerHashOf(SOLUTION);
    assert.ok(hash.ok);
    const serialized = service.serializeLedgerOf(SOLUTION);
    assert.ok(serialized.ok);
    return `${hash.value}:${serialized.value}`;
  };
  const left = script(createEmbodimentService({ workspaceIdentity: "ws-w7a-determinism", seed: "determinism-seed" }));
  const right = script(createEmbodimentService({ workspaceIdentity: "ws-w7a-determinism", seed: "determinism-seed" }));
  assert.equal(left, right);
});
