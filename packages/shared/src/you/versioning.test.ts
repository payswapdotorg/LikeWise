import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { SolutionIdentity } from "./contract.js";
import { buildFixtureSnapshot } from "./fixture.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { applyPatchOperations, SolutionVersionChain, verifyChangeSet } from "./versioning.js";

const SOLUTION: SolutionIdentity = {
  id: "you_solution_test00001",
  workspaceIdentity: "ws-test",
  displayName: "Versioning Test",
};

function makeChain(): { chain: SolutionVersionChain; root: ReturnType<SolutionVersionChain["current"]> } {
  const deps = {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(11)),
  };
  return SolutionVersionChain.createRoot({
    solution: SOLUTION,
    snapshot: buildFixtureSnapshot("versioning-test"),
    provenanceSource: "fixture:versioning-test",
    deps,
  });
}

test("root version is v1 with no parent, fixture-generated and frozen", () => {
  const { chain, root } = makeChain();
  assert.equal(root.version, 1);
  assert.equal(root.parentVersionId, null);
  assert.equal(root.solutionId, SOLUTION.id);
  assert.equal(root.provenance.generator, "fixture");
  assert.equal(root.provenance.lineage.length, 0);
  assert.equal(root.state.simulated, true);
  assert.ok(Object.isFrozen(root));
  assert.ok(Object.isFrozen(root.state));
  assert.equal(chain.versions().length, 1);
});

test("version immutability: mutation attempts throw by construction", () => {
  const { root } = makeChain();
  const before = stableStringify(root);
  assert.throws(() => {
    (root as unknown as { version: number }).version = 99;
  }, TypeError);
  assert.throws(() => {
    (root.state as unknown as { simulated: boolean }).simulated = false;
  }, TypeError);
  assert.throws(() => {
    (root.provenance as unknown as { source: string }).source = "tampered";
  }, TypeError);
  assert.equal(stableStringify(root), before);
});

test("acceptance creates v(n+1) linked to its parent; v1 stays untouched", () => {
  const { chain, root } = makeChain();
  const rootSnapshot = stableStringify(root);
  const changeSet = chain.propose({
    baseVersionId: root.id,
    operations: [{ op: "adjust_quality", deficiencyClass: "geometry", delta: 0.15 }],
    authorType: "fixture",
  });
  assert.equal(changeSet.status, "proposed");
  assert.ok(changeSet.verification?.passed);
  const accepted = chain.accept(changeSet);
  assert.ok(accepted.ok);
  assert.equal(accepted.version.version, 2);
  assert.equal(accepted.version.parentVersionId, root.id);
  assert.equal(accepted.changeSet.status, "accepted");
  assert.equal(accepted.changeSet.resultingVersionId, accepted.version.id);
  assert.equal(chain.versions().length, 2);
  assert.equal(chain.current().id, accepted.version.id);
  assert.equal(stableStringify(root), rootSnapshot);
  assert.deepEqual(accepted.version.provenance.lineage, [root.id]);
  assert.equal(accepted.version.provenance.source, `changeset:${changeSet.id}`);
});

test("versions() exposes a frozen copy: pushing or indexing-writes throw", () => {
  const { chain } = makeChain();
  const versions = chain.versions();
  assert.throws(() => {
    (versions as unknown as unknown[]).push(chain.current());
  }, TypeError);
});

test("acceptance refuses a changeset whose verification failed", () => {
  const { chain, root } = makeChain();
  const changeSet = chain.propose({
    baseVersionId: root.id,
    operations: [
      { op: "adjust_quality", deficiencyClass: "geometry", delta: 0.1 },
      { op: "remove_entity", entityId: "you_entity_doesnotexist" },
    ],
    authorType: "fixture",
  });
  assert.equal(changeSet.verification?.passed, false);
  const accepted = chain.accept(changeSet);
  assert.ok(!accepted.ok);
  assert.equal(accepted.code, "verification-failed");
  assert.equal(chain.versions().length, 1);
});

test("acceptance refuses a stale base and a non-proposed changeset", () => {
  const { chain, root } = makeChain();
  const first = chain.propose({
    baseVersionId: root.id,
    operations: [{ op: "adjust_quality", deficiencyClass: "identity", delta: 0.1 }],
    authorType: "fixture",
  });
  assert.ok(chain.accept(first).ok);
  const stale = chain.propose({
    baseVersionId: root.id,
    operations: [{ op: "adjust_quality", deficiencyClass: "identity", delta: 0.1 }],
    authorType: "fixture",
  });
  const staleResult = chain.accept(stale);
  assert.ok(!staleResult.ok);
  assert.equal(staleResult.code, "base-not-current");
  const rejected = chain.reject(stale);
  assert.equal(rejected.status, "rejected");
  const reaccept = chain.accept(rejected);
  assert.ok(!reaccept.ok);
  assert.equal(reaccept.code, "not-proposed");
  assert.throws(() => chain.reject(rejected));
});

test("verifyChangeSet flags duplicate upsert ids and empty entity ids", () => {
  const { root } = makeChain();
  const entity = root.state.entities[0];
  assert.ok(entity !== undefined);
  const duplicated = verifyChangeSet(root, [
    { op: "upsert_entity", entity },
    { op: "upsert_entity", entity },
  ]);
  assert.equal(duplicated.passed, false);
  assert.ok(duplicated.checks.some((check) => check.name === "upsert-ids-unique" && !check.passed));
  const empty = verifyChangeSet(root, [
    { op: "upsert_entity", entity: { ...entity, id: "" } },
  ]);
  assert.equal(empty.passed, false);
});

test("applyPatchOperations is pure: upsert, remove, environment, quality", () => {
  const { root } = makeChain();
  const state = root.state;
  const human = state.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  const extra = { ...human, id: "you_entity_extra0001", label: "Extra" };
  const next = applyPatchOperations(state, [
    { op: "upsert_entity", entity: extra },
    { op: "remove_entity", entityId: state.entities[0]?.id ?? "" },
    { op: "update_environment", environment: { ambientIntensity: 0.9 } },
    { op: "adjust_quality", deficiencyClass: "geometry", delta: 0.15 },
  ]);
  assert.ok(next.entities.some((entity) => entity.id === "you_entity_extra0001"));
  assert.ok(!next.entities.some((entity) => entity.id === state.entities[0]?.id));
  assert.equal(next.environment.ambientIntensity, 0.9);
  assert.equal(next.environment.background, state.environment.background);
  assert.equal(next.quality.geometry, (state.quality.geometry ?? 0) + 0.15);
  assert.ok(Object.isFrozen(next));
  assert.equal(state.entities.some((entity) => entity.id === "you_entity_extra0001"), false);
  assert.equal(state.environment.ambientIntensity, state.environment.ambientIntensity);
});

test("applyPatchOperations replaces an existing entity on upsert and keeps ids sorted", () => {
  const { root } = makeChain();
  const human = root.state.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  const moved = { ...human, transform: { ...human.transform, position: [1, 2, 3] as const } };
  const next = applyPatchOperations(root.state, [{ op: "upsert_entity", entity: moved }]);
  assert.equal(next.entities.length, root.state.entities.length);
  const updated = next.entities.find((entity) => entity.id === human.id);
  assert.deepEqual(updated?.transform.position, [1, 2, 3]);
  const ids = next.entities.map((entity) => entity.id);
  assert.deepEqual(ids, [...ids].sort());
});
