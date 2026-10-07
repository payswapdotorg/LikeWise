import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { SolutionEvent } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { deepFreeze, stableEquals, stableStringify } from "./serialize.js";
import { parseLedgerEvents, replayLedger, SolutionEventLedger } from "./events.js";

function makeLedger(): SolutionEventLedger {
  return new SolutionEventLedger("you_solution_ledger01", {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(21)),
  });
}

test("ledger is append-only: entries accumulate with ids, timestamps, lineage", () => {
  const ledger = makeLedger();
  const first = ledger.append({ type: "solution-created", payload: { simulated: true } });
  const second = ledger.append({ type: "feedback-submitted", subjectRef: "you_feedback_0001", payload: { category: "geometry" } });
  const third = ledger.append({ type: "evidence-requested", payload: {} });
  assert.equal(ledger.size, 3);
  assert.equal(first.id, "you_event_" + first.id.slice("you_event_".length));
  assert.match(first.id, /^you_event_[0-9a-f]{16}$/);
  assert.equal(first.provenance.lineage.length, 0);
  assert.deepEqual(second.provenance.lineage, [first.id]);
  assert.deepEqual(third.provenance.lineage, [first.id, second.id]);
  assert.equal(first.occurredAt, "2026-01-01T00:00:00.000Z");
  assert.equal(second.occurredAt, "2026-01-01T00:00:01.000Z");
  assert.equal(third.occurredAt, "2026-01-01T00:00:02.000Z");
});

test("ledger events are deeply frozen: in-place mutation throws", () => {
  const ledger = makeLedger();
  const event = ledger.append({ type: "solution-created", payload: { simulated: true } });
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.payload));
  assert.throws(() => {
    (event as unknown as { type: string }).type = "tampered";
  }, TypeError);
  assert.throws(() => {
    (event.payload as unknown as { simulated: boolean }).simulated = false;
  }, TypeError);
  const events = ledger.events();
  assert.ok(Object.isFrozen(events));
  assert.throws(() => {
    (events as unknown as unknown[]).push(event);
  }, TypeError);
});

test("ledger persists and reparses through canonical JSON", () => {
  const ledger = makeLedger();
  ledger.append({ type: "solution-created", payload: { simulated: true } });
  ledger.append({ type: "version-published", payload: { versionId: "v1", versionNumber: 1, parentVersionId: "" } });
  const serialized = ledger.serialize();
  const parsed = parseLedgerEvents(serialized);
  assert.ok(parsed !== null);
  assert.equal(parsed.length, 2);
  assert.ok(stableEquals(parsed, ledger.events()));
  assert.ok(parseLedgerEvents("not json") === null);
  assert.ok(parseLedgerEvents("[{}]") === null);
  assert.ok(parseLedgerEvents('["nope"]') === null);
});

test("replaying a scripted ledger reproduces the projection exactly", () => {
  const ledger = makeLedger();
  const append = (input: Parameters<SolutionEventLedger["append"]>[0]): SolutionEvent =>
    ledger.append(input);
  append({ type: "solution-created", payload: { simulated: true } });
  append({
    type: "version-published",
    payload: {
      versionId: "v1",
      versionNumber: 1,
      parentVersionId: "",
      authorType: "fixture",
      "quality.geometry": 0.5249,
      "quality.identity": 0.6723,
    },
  });
  append({ type: "feedback-submitted", payload: { feedbackRequestId: "fb1" } });
  append({ type: "evidence-requested", payload: { evidenceRequestId: "ev1" } });
  append({ type: "evidence-provided", payload: { evidenceRequestId: "ev1" } });
  append({ type: "edit-session-opened", payload: { editSessionId: "es1" } });
  append({ type: "change-proposed", payload: { changeSetId: "cs1" } });
  append({
    type: "change-accepted",
    payload: {
      changeSetId: "cs1",
      resultingVersionId: "v2",
      versionNumber: 2,
      addressesFeedbackId: "fb1",
      feedbackStatusAfter: "addressed",
      addressesEvidenceId: "ev1",
      evidenceStatusAfter: "fulfilled",
    },
  });
  append({
    type: "version-published",
    payload: {
      versionId: "v2",
      versionNumber: 2,
      parentVersionId: "v1",
      authorType: "fixture",
      "quality.geometry": 0.6749,
      "quality.identity": 0.6723,
    },
  });
  append({ type: "edit-session-closed", payload: { editSessionId: "es1" } });
  append({
    type: "capability-gap-detected",
    payload: { capabilityGapId: "gap1", category: "TOOL_GAP", escalationEligibility: "eligible" },
  });
  append({
    type: "arena-escalation-requested",
    payload: { escalationId: "esc1", capabilityGapId: "gap1", escalationStatusAfter: "delivered" },
  });
  append({
    type: "arena-result-applied",
    payload: { escalationId: "esc1", capabilityGapId: "gap1", changeSetId: "cs2", resultingVersionId: "v3" },
  });

  const events = ledger.events();
  const projection = replayLedger(events);
  const reparsed = parseLedgerEvents(ledger.serialize());
  assert.ok(reparsed !== null);
  assert.ok(stableEquals(replayLedger(reparsed), projection));

  assert.equal(projection.solutionId, "you_solution_ledger01");
  assert.equal(projection.currentVersionId, "v2");
  assert.equal(projection.versions.length, 2);
  assert.deepEqual(projection.versions[0], {
    versionId: "v1",
    versionNumber: 1,
    parentVersionId: "",
    authorType: "fixture",
    quality: { geometry: 0.5249, identity: 0.6723 },
  });
  assert.deepEqual(projection.versions[1]?.quality, { geometry: 0.6749, identity: 0.6723 });
  assert.deepEqual(projection.feedback, { fb1: "addressed" });
  assert.deepEqual(projection.evidence, { ev1: "fulfilled" });
  assert.deepEqual(projection.editSessions, { es1: "closed" });
  assert.deepEqual(projection.changeSets, { cs1: "accepted" });
  assert.deepEqual(projection.capabilityGaps, { gap1: "applied" });
  assert.deepEqual(projection.arenaEscalations, { esc1: "applied" });
});

test("replayLedger requires a non-empty event list", () => {
  assert.throws(() => replayLedger([]));
});

test("serialized ledger is byte-stable across identical runs", () => {
  const build = (): string => {
    const ledger = makeLedger();
    ledger.append({ type: "solution-created", payload: { simulated: true } });
    ledger.append({ type: "version-published", payload: { versionId: "v1", versionNumber: 1, parentVersionId: "" } });
    return ledger.serialize();
  };
  assert.equal(build(), build());
  assert.equal(typeof deepFreeze([1, 2]), "object");
  assert.equal(stableStringify([1, 2]), "[1,2]");
});
