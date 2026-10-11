import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import {
  createEditChangeSet,
  createEditChangeSetOp,
  fixtureOpKindByteLength,
  FIXTURE_OP_KIND_BYTE_LENGTHS,
  synthesizeFixtureOpBytes,
  validateEditChangeSet,
  validateEditChangeSetOps,
  validateEditOpKind,
} from "./editChangeSet.js";

const CLOCK = createDeterministicClock();

function makeDeps() {
  return { clock: CLOCK, ids: createRngIdFactory(createDeterministicRng(0x5eed_0051)) };
}

function opDeps() {
  return { ids: createRngIdFactory(createDeterministicRng(0x5eed_0052)), store: createFixtureEvidenceContentStore() };
}

function validOps() {
  const deps = opDeps();
  const first = createEditChangeSetOp({ kind: "transform", rng: createDeterministicRng(11) }, deps);
  const second = createEditChangeSetOp({ kind: "material", rng: createDeterministicRng(12) }, deps);
  assert.ok(first.ok && second.ok);
  return [first.op, second.op];
}

test("the stateless validator refuses empty op lists", () => {
  const refusal = validateEditChangeSetOps([]);
  assert.ok(!refusal.ok);
  assert.equal(refusal.code, "empty-op-list");
  assert.ok(refusal.detail.includes("at least one op"));
});

test("the stateless validator refuses structurally invalid ops (typed refusals with op index)", () => {
  const good = validOps();

  const emptyId = validateEditChangeSetOps([{ ...good[0]!, id: "" }]);
  assert.ok(!emptyId.ok);
  assert.equal(emptyId.code, "invalid-op");
  assert.equal(emptyId.opIndex, 0);

  const emptyKind = validateEditChangeSetOps([{ ...good[0]!, kind: "" }]);
  assert.ok(!emptyKind.ok);
  assert.equal(emptyKind.code, "invalid-op");
  assert.ok(emptyKind.detail.includes("non-empty string"));

  const whitespaceKind = validateEditChangeSetOps([{ ...good[0]!, kind: " transform" }]);
  assert.ok(!whitespaceKind.ok);
  assert.equal(whitespaceKind.code, "invalid-op");

  const emptyRef = validateEditChangeSetOps([{ ...good[0]!, payloadRef: "" }]);
  assert.ok(!emptyRef.ok);
  assert.equal(emptyRef.code, "invalid-op");
  assert.ok(emptyRef.detail.includes("payloadRef"));

  const badHash = validateEditChangeSetOps([{ ...good[0]!, payloadHash: "not-a-hash" }]);
  assert.ok(!badHash.ok);
  assert.equal(badHash.code, "invalid-op");
  assert.ok(badHash.detail.includes("sha-256"));

  const duplicateId = validateEditChangeSetOps([good[0]!, { ...good[1]!, id: good[0]!.id }]);
  assert.ok(!duplicateId.ok);
  assert.equal(duplicateId.code, "invalid-op");
  assert.equal(duplicateId.opIndex, 1);
  assert.ok(duplicateId.detail.includes("duplicate op id"));

  const ok = validateEditChangeSetOps(good);
  assert.ok(ok.ok);
});

test("the stateless validator is clock-free (no deps parameter, pure function)", () => {
  // Structural proof: the validator signature takes only the op list —
  // docs/you/WORK_ORDERS.md W5A "stateless validators; no clock use".
  assert.equal(validateEditChangeSetOps.length, 1);
  assert.equal(validateEditOpKind("transform"), null);
});

test("createEditChangeSet keeps the op ORDER verbatim and freezes the record", () => {
  const deps = makeDeps();
  const ops = validOps();
  const created = createEditChangeSet({ sessionId: "you_editing-session_x", ops }, deps);
  assert.ok(created.ok);
  const changeSet = created.changeSet;
  assert.deepEqual(
    changeSet.ops.map((op) => op.kind),
    ["transform", "material"],
  );
  assert.equal(changeSet.sessionId, "you_editing-session_x");
  assert.equal(changeSet.createdAt, "2026-01-01T00:00:00.000Z");
  assert.ok(changeSet.id.startsWith("you_edit-change-set_"));
  assert.ok(Object.isFrozen(changeSet));
  assert.ok(Object.isFrozen(changeSet.ops));
  assert.throws(() => {
    (changeSet as { sessionId: string }).sessionId = "x";
  }, TypeError);

  // The ops are the same frozen records (no copies, no reorder).
  assert.equal(changeSet.ops[0], ops[0]);
  assert.equal(changeSet.ops[1], ops[1]);
});

test("createEditChangeSet refuses empty op lists and empty session ids", () => {
  const deps = makeDeps();
  const empty = createEditChangeSet({ sessionId: "s", ops: [] }, deps);
  assert.ok(!empty.ok);
  assert.equal(empty.code, "empty-op-list");

  const noSession = createEditChangeSet({ sessionId: "", ops: validOps() }, deps);
  assert.ok(!noSession.ok);
  assert.equal(noSession.code, "invalid-session-id");
});

test("validateEditChangeSet covers the built record (session id + ops)", () => {
  const deps = makeDeps();
  const created = createEditChangeSet({ sessionId: "s", ops: validOps() }, deps);
  assert.ok(created.ok);
  const changeSet = created.changeSet;
  assert.ok(validateEditChangeSet(changeSet).ok);

  const emptySession = validateEditChangeSet({ ...changeSet, sessionId: "" });
  assert.ok(!emptySession.ok);
  assert.equal(emptySession.code, "invalid-session-id");

  const emptyOps = validateEditChangeSet({ ...changeSet, ops: [] });
  assert.ok(!emptyOps.ok);
  assert.equal(emptyOps.code, "empty-op-list");
});

test("createEditChangeSetOp content-addresses payload bytes through the wave-2 store", () => {
  const deps = opDeps();
  const created = createEditChangeSetOp({ kind: "annotation", rng: createDeterministicRng(21) }, deps);
  assert.ok(created.ok);
  const op = created.op;
  assert.ok(op.id.startsWith("you_edit-op_"));
  assert.equal(op.kind, "annotation");
  assert.ok(op.payloadRef.startsWith("you_content_"));
  assert.equal(op.payloadHash.length, 64);
  const stored = deps.store.get(op.payloadRef);
  assert.ok(stored !== null);
  assert.equal(stored.byteLength, fixtureOpKindByteLength("annotation"));
  assert.ok(Object.isFrozen(op));
});

test("createEditChangeSetOp refuses invalid kinds and missing payload sources", () => {
  const deps = opDeps();
  const badKind = createEditChangeSetOp({ kind: "", rng: createDeterministicRng(1) }, deps);
  assert.ok(!badKind.ok);
  assert.equal(badKind.code, "invalid-op-kind");

  const noPayload = createEditChangeSetOp({ kind: "transform" }, deps);
  assert.ok(!noPayload.ok);
  assert.equal(noPayload.code, "invalid-payload-binding");

  const badBinding = createEditChangeSetOp({ kind: "transform", payloadRef: "ref", payloadHash: "zz" }, deps);
  assert.ok(!badBinding.ok);
  assert.equal(badBinding.code, "invalid-payload-binding");

  const explicit = createEditChangeSetOp({ kind: "transform", payloadRef: "you_content_abc", payloadHash: "a".repeat(64) }, deps);
  assert.ok(explicit.ok);
  assert.equal(explicit.op.payloadRef, "you_content_abc");
});

test("fixture op bytes are deterministic and size-keyed by op kind (frozen fixture definition)", () => {
  assert.deepEqual(FIXTURE_OP_KIND_BYTE_LENGTHS, {
    annotation: 256,
    material: 1024,
    metadata: 128,
    transform: 512,
  });
  assert.equal(fixtureOpKindByteLength("unknown-kind"), 256);

  const first = synthesizeFixtureOpBytes(createDeterministicRng(7), "material");
  const second = synthesizeFixtureOpBytes(createDeterministicRng(7), "material");
  assert.deepEqual(first, second);
  assert.equal(first.byteLength, 1024);
  const other = synthesizeFixtureOpBytes(createDeterministicRng(8), "material");
  assert.notDeepEqual(first, other);
});
