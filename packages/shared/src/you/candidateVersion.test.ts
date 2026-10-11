import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { sha256Hex } from "./evidenceStore.js";
import { createEditChangeSetOp } from "./editChangeSet.js";
import {
  FIXTURE_CANDIDATE_BYTE_LENGTH,
  fixtureApplyEditChangeSet,
  fixtureCandidateSeedText,
  synthesizeFixtureCandidateBytes,
} from "./candidateVersion.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0053)),
    store: createFixtureEvidenceContentStore(),
  };
}

function makeChangeSet(deps: ReturnType<typeof makeDeps>) {
  const first = createEditChangeSetOp({ kind: "transform", rng: createDeterministicRng(31) }, { ids: deps.ids, store: deps.store });
  const second = createEditChangeSetOp({ kind: "material", rng: createDeterministicRng(32) }, { ids: deps.ids, store: deps.store });
  assert.ok(first.ok && second.ok);
  return {
    id: "you_edit-change-set_0000000100000001",
    sessionId: "you_editing-session_0000000100000002",
    ops: [first.op, second.op],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as const;
}

test("the fixture application produces an immutable content-addressed CandidateVersion", () => {
  const deps = makeDeps();
  const changeSet = makeChangeSet(deps);
  const candidate = fixtureApplyEditChangeSet(
    { changeSet, parentVersionId: "you_editing-subject_root", parentContentHash: "a".repeat(64) },
    deps,
  );
  assert.ok(candidate.id.startsWith("you_candidate-version_"));
  assert.equal(candidate.changeSetId, changeSet.id);
  assert.equal(candidate.parentVersionId, "you_editing-subject_root");
  assert.ok(candidate.contentRef.startsWith("you_content_"));
  assert.equal(candidate.contentHash.length, 64);
  assert.equal(candidate.proposedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(candidate.simulated, true);
  assert.ok(Object.isFrozen(candidate));
  assert.throws(() => {
    (candidate as { simulated: boolean }).simulated = false;
  }, TypeError);

  // The candidate content really is the stored bytes (hash binding).
  const stored = deps.store.get(candidate.contentRef);
  assert.ok(stored !== null);
  assert.equal(sha256Hex(stored), candidate.contentHash);
  assert.equal(stored.byteLength, FIXTURE_CANDIDATE_BYTE_LENGTH);
});

test("the fixture application is deterministic: same lineage => byte-identical candidate content", () => {
  const firstDeps = makeDeps();
  const secondDeps = makeDeps();
  const first = fixtureApplyEditChangeSet({ changeSet: makeChangeSet(firstDeps), parentVersionId: "p", parentContentHash: "b".repeat(64) }, firstDeps);
  const second = fixtureApplyEditChangeSet({ changeSet: makeChangeSet(secondDeps), parentVersionId: "p", parentContentHash: "b".repeat(64) }, secondDeps);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(firstDeps.store.get(first.contentRef), secondDeps.store.get(second.contentRef));
});

test("different lineage inputs change the candidate content hash", () => {
  const deps = makeDeps();
  const changeSet = makeChangeSet(deps);
  const root = fixtureApplyEditChangeSet({ changeSet, parentVersionId: "root", parentContentHash: "c".repeat(64) }, deps);
  const otherParent = fixtureApplyEditChangeSet({ changeSet, parentVersionId: "other", parentContentHash: "c".repeat(64) }, deps);
  const otherHash = fixtureApplyEditChangeSet({ changeSet, parentVersionId: "root", parentContentHash: "d".repeat(64) }, deps);
  assert.notEqual(root.contentHash, otherParent.contentHash);
  assert.notEqual(root.contentHash, otherHash.contentHash);

  // A different op set changes the seed (and therefore the content).
  const singleOp = createEditChangeSetOp({ kind: "transform", rng: createDeterministicRng(31) }, { ids: deps.ids, store: deps.store });
  assert.ok(singleOp.ok);
  const smaller = fixtureApplyEditChangeSet(
    { changeSet: { ...changeSet, ops: [singleOp.op] }, parentVersionId: "root", parentContentHash: "c".repeat(64) },
    deps,
  );
  assert.notEqual(root.contentHash, smaller.contentHash);
});

test("the candidate seed text threads every ordered op (id, kind, payloadHash)", () => {
  const deps = makeDeps();
  const changeSet = makeChangeSet(deps);
  const seed = fixtureCandidateSeedText({
    changeSetId: changeSet.id,
    parentVersionId: "root",
    parentContentHash: "e".repeat(64),
    ops: changeSet.ops,
  });
  assert.ok(seed.startsWith("you-w5a-fixture-candidate:"));
  for (const op of changeSet.ops) {
    assert.ok(seed.includes(`${op.id}:${op.kind}:${op.payloadHash}`));
  }
  // Order matters: a reordered op list produces a different seed.
  const reordered = fixtureCandidateSeedText({
    changeSetId: changeSet.id,
    parentVersionId: "root",
    parentContentHash: "e".repeat(64),
    ops: [...changeSet.ops].reverse(),
  });
  assert.notEqual(seed, reordered);
});

test("candidate byte synthesis is deterministic and of the frozen fixture size", () => {
  assert.equal(FIXTURE_CANDIDATE_BYTE_LENGTH, 2048);
  const first = synthesizeFixtureCandidateBytes(createDeterministicRng(99));
  const second = synthesizeFixtureCandidateBytes(createDeterministicRng(99));
  assert.deepEqual(first, second);
  assert.equal(first.byteLength, FIXTURE_CANDIDATE_BYTE_LENGTH);
  assert.notDeepEqual(first, synthesizeFixtureCandidateBytes(createDeterministicRng(100)));
});
