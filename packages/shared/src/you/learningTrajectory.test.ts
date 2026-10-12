import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng, seedFromString } from "./rng.js";
import { sha256Hex } from "./evidenceStore.js";
import {
  createTrajectoryReference,
  FIXTURE_TRAJECTORY_STEP_BYTE_LENGTH,
  replayTrajectoryReference,
  synthesizeFixtureTrajectoryStepBytes,
  trajectoryStepRefFor,
  validateTrajectoryStepRefs,
} from "./learningTrajectory.js";

const DEPS = { clock: createDeterministicClock(), ids: createRngIdFactory(createDeterministicRng(6105)) };

function stepRefsFor(store: ReturnType<typeof createFixtureEvidenceContentStore>, seed: string, count: number): string[] {
  const refs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const bytes = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString(`${seed}:${index}`)));
    refs.push(store.put(bytes).contentRef);
  }
  return refs;
}

test("fixture trajectory steps are seed-derived and fixed-length (no ambient nondeterminism)", () => {
  const a = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("w6a-step")));
  const b = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("w6a-step")));
  assert.equal(a.byteLength, FIXTURE_TRAJECTORY_STEP_BYTE_LENGTH);
  assert.deepEqual(a, b);
  const other = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("w6a-other")));
  assert.notDeepEqual(a, other);
  // A custom length is honored (still deterministic).
  const short = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("w6a-step")), 16);
  assert.equal(short.byteLength, 16);
});

test("step-ref validation is stateless: empty lists and malformed refs are typed refusals", () => {
  assert.deepEqual(validateTrajectoryStepRefs(["you_content_0000000000000000"]), { ok: true });

  const empty = validateTrajectoryStepRefs([]);
  assert.ok(!empty.ok);
  assert.equal(empty.code, "empty-step-refs");

  const malformed = validateTrajectoryStepRefs(["ok", ""]);
  assert.ok(!malformed.ok);
  assert.equal(malformed.code, "invalid-step-ref");
  assert.equal(malformed.refIndex, 1);

  const padded = validateTrajectoryStepRefs([" you_content_0000000000000000"]);
  assert.ok(!padded.ok);
  assert.equal(padded.code, "invalid-step-ref");

  // Duplicates are legal: an ordered trajectory may repeat a step.
  assert.deepEqual(validateTrajectoryStepRefs(["you_content_0000000000000000", "you_content_0000000000000000"]), { ok: true });
});

test("createTrajectoryReference builds an immutable, simulated-labeled ordered reference", () => {
  const created = createTrajectoryReference(
    { scope: "USER", stepRefs: ["you_content_0000000000000000", "you_content_0000000000000001"], simulated: true },
    DEPS,
  );
  assert.ok(created.ok);
  const trajectory = created.trajectory;
  assert.equal(trajectory.scope, "USER");
  assert.equal(trajectory.simulated, true);
  assert.equal(trajectory.createdAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(trajectory.stepRefs, ["you_content_0000000000000000", "you_content_0000000000000001"]);
  assert.ok(Object.isFrozen(trajectory));
  assert.ok(Object.isFrozen(trajectory.stepRefs));
  assert.throws(() => {
    (trajectory.stepRefs as unknown as string[]).push("you_content_ffffffffffffffff");
  }, TypeError);

  const badScope = createTrajectoryReference(
    { scope: "user" as unknown as "USER", stepRefs: ["you_content_0000000000000000"], simulated: true },
    DEPS,
  );
  assert.ok(!badScope.ok);
  assert.equal(badScope.code, "invalid-scope");
});

test("replay concatenates the ordered step bytes and verifies the content addressing (byte-identical from seed)", () => {
  const store = createFixtureEvidenceContentStore();
  const refs = stepRefsFor(store, "w6a-replay", 3);
  const created = createTrajectoryReference({ scope: "USER", stepRefs: refs, simulated: true }, DEPS);
  assert.ok(created.ok);

  const replayed = replayTrajectoryReference(created.trajectory, store);
  assert.ok(replayed.ok);
  assert.equal(replayed.replay.stepCount, 3);
  assert.equal(replayed.replay.bytes.byteLength, 3 * FIXTURE_TRAJECTORY_STEP_BYTE_LENGTH);
  assert.equal(replayed.replay.replayHash, sha256Hex(replayed.replay.bytes));

  // Byte-identical replay: the same seed resynthesizes the same steps.
  const expectedParts: Uint8Array[] = [];
  for (let index = 0; index < 3; index += 1) {
    expectedParts.push(synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString(`w6a-replay:${index}`))));
  }
  const expected = Buffer.concat(expectedParts);
  assert.deepEqual(Buffer.from(replayed.replay.bytes), expected);

  // Replaying twice yields identical bytes + hash.
  const again = replayTrajectoryReference(created.trajectory, store);
  assert.ok(again.ok);
  assert.deepEqual(again.replay.bytes, replayed.replay.bytes);
  assert.equal(again.replay.replayHash, replayed.replay.replayHash);

  // A different seed produces a different replay (ordering matters).
  const otherRefs = stepRefsFor(store, "w6a-other", 3);
  const other = createTrajectoryReference({ scope: "USER", stepRefs: [otherRefs[0] as string], simulated: true }, DEPS);
  assert.ok(other.ok);
  const otherReplay = replayTrajectoryReference(other.trajectory, store);
  assert.ok(otherReplay.ok);
  assert.notEqual(otherReplay.replay.replayHash, replayed.replay.replayHash);
});

test("replay is order-sensitive: the same steps in a different order replay differently", () => {
  const store = createFixtureEvidenceContentStore();
  const refs = stepRefsFor(store, "w6a-order", 2);
  const forward = createTrajectoryReference({ scope: "TASK", stepRefs: refs, simulated: true }, DEPS);
  const backward = createTrajectoryReference({ scope: "TASK", stepRefs: [...refs].reverse(), simulated: true }, DEPS);
  assert.ok(forward.ok && backward.ok);
  const f = replayTrajectoryReference(forward.trajectory, store);
  const b = replayTrajectoryReference(backward.trajectory, store);
  assert.ok(f.ok && b.ok);
  assert.notEqual(f.replay.replayHash, b.replay.replayHash);
});

test("replay refuses a dangling step ref with the typed step-ref-unresolved refusal", () => {
  const store = createFixtureEvidenceContentStore();
  const created = createTrajectoryReference(
    { scope: "USER", stepRefs: ["you_content_000000000000dead"], simulated: true },
    DEPS,
  );
  assert.ok(created.ok);
  const outcome = replayTrajectoryReference(created.trajectory, store);
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "step-ref-unresolved");
  assert.equal(outcome.refIndex, 0);
});

test("replay refuses a ref whose stored bytes do not match the content address (never a silent repair)", () => {
  const store = createFixtureEvidenceContentStore();
  // A ref that LOOKS like a content ref but was never produced by this store's put().
  const forgedRef = trajectoryStepRefFor(synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("forged"))));
  const created = createTrajectoryReference({ scope: "USER", stepRefs: [forgedRef], simulated: true }, DEPS);
  assert.ok(created.ok);
  const outcome = replayTrajectoryReference(created.trajectory, store);
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, "step-ref-unresolved");

  // Content mismatch: put DIFFERENT bytes under the ref's store slot is
  // impossible by construction (content addressing), so simulate the
  // mismatch through a store wrapper that serves other bytes for a real ref.
  const realBytes = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("real")));
  const realRef = store.put(realBytes).contentRef;
  const tamperingStore = {
    get: (ref: string) => (ref === realRef ? synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString("tampered"))) : null),
    has: (ref: string) => ref === realRef,
    put: (bytes: Uint8Array) => store.put(bytes),
    delete: (ref: string) => store.delete(ref),
    get size() {
      return store.size;
    },
  };
  const trajectory = createTrajectoryReference({ scope: "USER", stepRefs: [realRef], simulated: true }, DEPS);
  assert.ok(trajectory.ok);
  const mismatch = replayTrajectoryReference(trajectory.trajectory, tamperingStore);
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.code, "step-content-mismatch");
  assert.equal(mismatch.refIndex, 0);
});
