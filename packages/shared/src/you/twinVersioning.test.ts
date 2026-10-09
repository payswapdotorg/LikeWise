import assert from "node:assert/strict";
import test from "node:test";
import type { HtirDomainBlock } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createHtirDomainBlock } from "./htirDomain.js";
import { createRngIdFactory } from "./ids.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import {
  createTwinRecord,
  isLegalTwinVersionTransition,
  TWIN_VERSION_TRANSITIONS,
  transitionTwinVersionStatus,
  TwinVersionChain,
} from "./twinVersioning.js";
import { assessTwinQuality } from "./twinQuality.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0002)),
    store: createFixtureEvidenceContentStore(),
  };
}

function blockFor(deps: ReturnType<typeof makeDeps>, domain: string, salt: number): HtirDomainBlock {
  return createHtirDomainBlock(
    { domain: domain as HtirDomainBlock["domain"], bytes: new Uint8Array([salt]), provenanceSource: "test:block", simulated: true },
    deps,
  );
}

function publish(chain: TwinVersionChain, deps: ReturnType<typeof makeDeps>, domains: string[]) {
  const blocks = domains.map((domain, index) => blockFor(deps, domain, index + 1));
  const quality = assessTwinQuality({ domainBlocks: blocks, evidenceBindings: [] }, deps);
  return chain.publish({ domainBlocks: blocks, evidenceBindings: [], quality, provenanceSource: "test:publish" });
}

test("createTwinRecord builds an immutable twin record with provenance", () => {
  const deps = makeDeps();
  const { twin } = createTwinRecord({ workspaceIdentity: "ws-test", displayName: "Twin A", provenanceSource: "test" }, deps);
  assert.match(twin.id, /^you_twin_[0-9a-f]{16}$/);
  assert.equal(twin.workspaceIdentity, "ws-test");
  assert.equal(twin.provenance.generator, "fixture");
  assert.ok(Object.isFrozen(twin));
  assert.throws(() => createTwinRecord({ workspaceIdentity: "ws", displayName: "  ", provenanceSource: "t" }, makeDeps()));
});

test("publication appends monotonic per-twin version numbers starting at 1", () => {
  const deps = makeDeps();
  const chain = TwinVersionChain.open("you_twin_x", deps);
  const first = publish(chain, deps, ["identity-binding"]);
  const second = publish(chain, deps, ["identity-binding", "morphology"]);
  const third = publish(chain, deps, ["geometry-skeleton"]);
  assert.ok(first.ok && second.ok && third.ok);
  assert.equal(first.version.version, 1);
  assert.equal(second.version.version, 2);
  assert.equal(third.version.version, 3);
  assert.equal(chain.latestVersionNumber, 3);
  assert.deepEqual(
    chain.versions().map((version) => version.version),
    [1, 2, 3],
  );
});

test("publication refuses empty block lists and invalid domain blocks without state change", () => {
  const deps = makeDeps();
  const chain = TwinVersionChain.open("you_twin_x", deps);
  const empty = chain.publish({ domainBlocks: [], evidenceBindings: [], quality: assessTwinQuality({ domainBlocks: [], evidenceBindings: [] }, deps), provenanceSource: "t" });
  assert.ok(!empty.ok && empty.code === "empty-version");
  const duplicateBlocks = [blockFor(deps, "morphology", 1), blockFor(deps, "morphology", 2)];
  const duplicate = chain.publish({
    domainBlocks: duplicateBlocks,
    evidenceBindings: [],
    quality: assessTwinQuality({ domainBlocks: duplicateBlocks, evidenceBindings: [] }, deps),
    provenanceSource: "t",
  });
  assert.ok(!duplicate.ok && duplicate.code === "invalid-domain-blocks");
  assert.equal(chain.latestVersionNumber, 0);
});

test("published versions are deep-frozen and carry parent lineage", () => {
  const deps = makeDeps();
  const chain = TwinVersionChain.open("you_twin_x", deps);
  const first = publish(chain, deps, ["identity-binding"]);
  const second = publish(chain, deps, ["identity-binding"]);
  assert.ok(first.ok && second.ok);
  assert.ok(Object.isFrozen(second.version));
  assert.ok(Object.isFrozen(second.version.quality));
  assert.deepEqual([...second.version.provenance.lineage], [first.version.id]);
  assert.throws(() => {
    (second.version as unknown as { status: string }).status = "canonical";
  });
});

test("promotion moves candidate -> canonical and supersedes the previous canonical (append-only linkage)", () => {
  const deps = makeDeps();
  const chain = TwinVersionChain.open("you_twin_x", deps);
  const first = publish(chain, deps, ["identity-binding"]);
  const second = publish(chain, deps, ["identity-binding"]);
  assert.ok(first.ok && second.ok);
  const promotedFirst = chain.promote(first.version.id);
  assert.ok(promotedFirst.ok);
  assert.equal(promotedFirst.promoted.status, "canonical");
  assert.equal(promotedFirst.superseded, null);
  const promotedSecond = chain.promote(second.version.id);
  assert.ok(promotedSecond.ok);
  assert.equal(promotedSecond.promoted.status, "canonical");
  assert.ok(promotedSecond.superseded !== null);
  assert.equal(promotedSecond.superseded.id, first.version.id);
  assert.equal(promotedSecond.superseded.status, "superseded");
  // Append-only linkage maps.
  assert.equal(chain.supersededBy(first.version.id), second.version.id);
  assert.equal(chain.supersedes(second.version.id), first.version.id);
  assert.deepEqual(chain.supersessionLinks(), { [first.version.id]: second.version.id });
  assert.equal(chain.currentCanonical()?.id, second.version.id);
});

test("immutability: content is byte-identical across promotion, only the status field differs", () => {
  const deps = makeDeps();
  const chain = TwinVersionChain.open("you_twin_x", deps);
  const published = publish(chain, deps, ["identity-binding", "morphology"]);
  assert.ok(published.ok);
  const before = { ...published.version, status: undefined };
  const promoted = chain.promote(published.version.id);
  assert.ok(promoted.ok);
  const after = { ...chain.get(published.version.id)!, status: undefined };
  assert.equal(stableStringify(before), stableStringify(after));
  assert.equal(chain.get(published.version.id)!.version, published.version.version);
  assert.deepEqual(stableStringify(published.version.domainBlocks), stableStringify(chain.get(published.version.id)!.domainBlocks));
});

test("promotion refuses unknown versions and non-candidates (never a rewrite)", () => {
  const deps = makeDeps();
  const chain = TwinVersionChain.open("you_twin_x", deps);
  const first = publish(chain, deps, ["identity-binding"]);
  assert.ok(first.ok);
  const unknown = chain.promote("you_twin-version_missing");
  assert.ok(!unknown.ok && unknown.code === "not-found");
  const promoted = chain.promote(first.version.id);
  assert.ok(promoted.ok);
  const again = chain.promote(first.version.id);
  assert.ok(!again.ok && again.code === "not-candidate");
  const second = publish(chain, deps, ["identity-binding"]);
  assert.ok(second.ok);
  const promotedSecond = chain.promote(second.version.id);
  assert.ok(promotedSecond.ok);
  // first is now superseded; promoting it again is an immutable violation.
  const resurrect = chain.promote(first.version.id);
  assert.ok(!resurrect.ok && resurrect.code === "not-candidate");
});

test("status transition table: candidate -> canonical|superseded, canonical -> superseded, superseded terminal", () => {
  assert.deepEqual(TWIN_VERSION_TRANSITIONS.candidate, ["canonical", "superseded"]);
  assert.deepEqual(TWIN_VERSION_TRANSITIONS.canonical, ["superseded"]);
  assert.deepEqual(TWIN_VERSION_TRANSITIONS.superseded, []);
  assert.equal(isLegalTwinVersionTransition("candidate", "canonical"), true);
  assert.equal(isLegalTwinVersionTransition("candidate", "candidate"), false);
  assert.equal(isLegalTwinVersionTransition("canonical", "candidate"), false);
  assert.equal(isLegalTwinVersionTransition("superseded", "canonical"), false);
  assert.equal(isLegalTwinVersionTransition("superseded", "superseded"), false);
});

test("transitionTwinVersionStatus returns a NEW frozen record and throws on illegal transitions", () => {
  const deps = makeDeps();
  const published = publish(TwinVersionChain.open("you_twin_x", deps), deps, ["identity-binding"]);
  assert.ok(published.ok);
  const canonical = transitionTwinVersionStatus(published.version, "canonical");
  assert.notEqual(canonical, published.version);
  assert.equal(canonical.status, "canonical");
  assert.ok(Object.isFrozen(canonical));
  assert.equal(published.version.status, "candidate");
  assert.throws(() => transitionTwinVersionStatus(canonical, "candidate"));
  assert.throws(() => transitionTwinVersionStatus(transitionTwinVersionStatus(canonical, "superseded"), "canonical"));
});
