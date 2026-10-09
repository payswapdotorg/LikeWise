import assert from "node:assert/strict";
import test from "node:test";
import type { ReconstructionJobSpec, TwinEvidenceBinding } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createFixtureEvidenceContentStore, sha256Hex } from "./evidenceStore.js";
import { createDeterministicRng } from "./rng.js";
import { deepFreeze, stableStringify } from "./serialize.js";
import {
  buildReconstructionJobResult,
  createReconstructionJobSpec,
  fixtureReconstruct,
  FIXTURE_RECONSTRUCTION_SUPPORT,
  isLegalReconstructionJobTransition,
  isTerminalReconstructionJobStatus,
  notMeasuredEffortObservations,
  RECONSTRUCTION_JOB_TRANSITIONS,
  unsupportedReconstructionDomains,
} from "./reconstruction.js";

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0004)),
    store: createFixtureEvidenceContentStore(),
  };
}

function bindingFor(evidenceId: string, hash: string): TwinEvidenceBinding {
  return deepFreeze({ evidenceId, evidenceContentHash: hash, consent: { policyId: `p-${evidenceId}`, state: "granted", learningPermission: false } });
}

function specFixture(deps: ReturnType<typeof makeDeps>, method = "hybrid", domains: string[] = ["face-hands", "geometry-skeleton"]): ReconstructionJobSpec {
  const created = createReconstructionJobSpec(
    { twinVersionId: "you_twin-version_v1", method: method as ReconstructionJobSpec["method"], targetDomains: domains as ReconstructionJobSpec["targetDomains"], evidenceBindings: [bindingFor("e1", "1".repeat(64))], provenanceSource: "test" },
    deps,
  );
  assert.ok(created.ok);
  return created.spec;
}

test("job transition table: queued -> running|failed, running -> completed|failed, terminals locked", () => {
  assert.deepEqual(RECONSTRUCTION_JOB_TRANSITIONS.queued, ["running", "failed"]);
  assert.deepEqual(RECONSTRUCTION_JOB_TRANSITIONS.running, ["completed", "failed"]);
  assert.deepEqual(RECONSTRUCTION_JOB_TRANSITIONS.completed, []);
  assert.deepEqual(RECONSTRUCTION_JOB_TRANSITIONS.failed, []);
  assert.equal(isLegalReconstructionJobTransition("queued", "running"), true);
  assert.equal(isLegalReconstructionJobTransition("queued", "failed"), true);
  assert.equal(isLegalReconstructionJobTransition("queued", "completed"), false);
  assert.equal(isLegalReconstructionJobTransition("running", "completed"), true);
  assert.equal(isLegalReconstructionJobTransition("running", "failed"), true);
  assert.equal(isLegalReconstructionJobTransition("running", "queued"), false);
  assert.equal(isLegalReconstructionJobTransition("running", "running"), false);
  assert.equal(isLegalReconstructionJobTransition("completed", "running"), false);
  assert.equal(isLegalReconstructionJobTransition("completed", "failed"), false);
  assert.equal(isLegalReconstructionJobTransition("failed", "running"), false);
  assert.equal(isTerminalReconstructionJobStatus("completed"), true);
  assert.equal(isTerminalReconstructionJobStatus("failed"), true);
  assert.equal(isTerminalReconstructionJobStatus("queued"), false);
  assert.equal(isTerminalReconstructionJobStatus("running"), false);
});

test("support matrix: unsupported method/domain combinations are exactly identified", () => {
  // Supported combinations produce no unsupported domains.
  assert.deepEqual(unsupportedReconstructionDomains("explicit-geometry", ["geometry-skeleton", "face-hands"]), []);
  assert.deepEqual(unsupportedReconstructionDomains("neural-appearance", ["hair", "style", "neural-appearance"]), []);
  assert.deepEqual(unsupportedReconstructionDomains("hybrid", ["geometry-skeleton", "neural-appearance", "voice" as never].filter((d) => d !== "voice")), []);
  // Voice is audio capture material — no fixture method reconstructs it.
  assert.deepEqual(unsupportedReconstructionDomains("hybrid", ["voice"]), ["voice"]);
  assert.deepEqual(unsupportedReconstructionDomains("explicit-geometry", ["appearance-materials", "voice"]), ["appearance-materials", "voice"]);
  assert.deepEqual(unsupportedReconstructionDomains("neural-appearance", ["geometry-skeleton", "motion-profile"]), ["geometry-skeleton", "motion-profile"]);
  // Unknown (extension) methods are unsupported across the board — never a silent fallback.
  assert.deepEqual(unsupportedReconstructionDomains("photogrammetry-v2", ["geometry-skeleton"]), ["geometry-skeleton"]);
  // The frozen matrix declares the three fixture methods.
  assert.deepEqual(Object.keys(FIXTURE_RECONSTRUCTION_SUPPORT).sort(), ["explicit-geometry", "hybrid", "neural-appearance"]);
});

test("createReconstructionJobSpec sorts target domains, freezes the spec and refuses empty targets", () => {
  const deps = makeDeps();
  const spec = specFixture(deps, "hybrid", ["geometry-skeleton", "appearance-materials", "face-hands"]);
  assert.deepEqual([...spec.targetDomains], ["appearance-materials", "face-hands", "geometry-skeleton"]);
  assert.match(spec.id, /^you_recon-job_[0-9a-f]{16}$/);
  assert.ok(Object.isFrozen(spec));
  assert.throws(() => {
    (spec as unknown as { method: string }).method = "neural-appearance";
  });
  const empty = createReconstructionJobSpec(
    { twinVersionId: "you_twin-version_v1", method: "hybrid", targetDomains: [], evidenceBindings: [], provenanceSource: "t" },
    deps,
  );
  assert.ok(!empty.ok && empty.code === "empty-target-domains");
});

test("createReconstructionJobSpec refuses unsupported combinations with the offending domains", () => {
  const deps = makeDeps();
  const refused = createReconstructionJobSpec(
    { twinVersionId: "you_twin-version_v1", method: "explicit-geometry", targetDomains: ["voice", "geometry-skeleton"], evidenceBindings: [], provenanceSource: "t" },
    deps,
  );
  assert.ok(!refused.ok && refused.code === "unsupported-combination");
  if (!refused.ok && refused.code === "unsupported-combination") {
    assert.deepEqual(refused.unsupportedDomains, ["voice"]);
    assert.match(refused.detail, /voice/);
  }
});

test("fixture reconstruction is deterministic and evidence-sensitive", () => {
  const depsA = makeDeps();
  const depsB = makeDeps();
  const specA = specFixture(depsA);
  const runA = fixtureReconstruct({ spec: specA, clock: depsA.clock, ids: depsA.ids, store: depsA.store });
  const runB = fixtureReconstruct({ spec: specFixture(depsB), clock: depsB.clock, ids: depsB.ids, store: depsB.store });
  assert.equal(stableStringify(runA), stableStringify(runB));
  // One block per target domain, sorted; every block simulated + hash-bound.
  assert.deepEqual(
    runA.map((block) => block.domain),
    ["face-hands", "geometry-skeleton"],
  );
  for (const block of runA) {
    assert.equal(block.simulated, true);
    assert.ok(depsA.store.has(block.contentRef));
    assert.equal(block.contentHash, sha256Hex(depsA.store.get(block.contentRef)!));
    assert.deepEqual([...block.provenance.lineage], [specA.id, specA.twinVersionId]);
    assert.match(block.provenance.source, /^fixture:reconstruction:/);
  }
  // Different evidence bindings => different reconstruction output.
  const specDifferentEvidence = { ...specA, evidenceBindings: [bindingFor("e1", "f".repeat(64))] } as ReconstructionJobSpec;
  const runDifferent = fixtureReconstruct({ spec: specDifferentEvidence, clock: depsA.clock, ids: depsA.ids, store: depsA.store });
  assert.notEqual(runA[0]!.contentHash, runDifferent[0]!.contentHash);
});

test("effort observations carry explicit not-measured markers — never invented numbers", () => {
  const observations = notMeasuredEffortObservations(3, 2);
  assert.equal(observations["computeEffort.measured"], false);
  assert.equal(observations["computeEffort"], "not-measured (simulated)");
  assert.equal(observations["latencyMs.measured"], false);
  assert.equal(observations["latencyMs"], "not-measured (simulated)");
  assert.equal(observations["costUnits.measured"], false);
  assert.equal(observations["costUnits"], "not-measured (simulated)");
  assert.equal(observations["domainBlocksProduced"], 3);
  assert.equal(observations["evidenceBindingsProcessed"], 2);
  assert.equal(observations["simulated"], true);
  for (const value of Object.values(observations)) {
    assert.ok(["string", "number", "boolean"].includes(typeof value));
  }
});

test("buildReconstructionJobResult completes and fails truthfully", () => {
  const deps = makeDeps();
  const spec = specFixture(deps);
  const completed = buildReconstructionJobResult({
    spec,
    status: "completed",
    producedDomainBlocks: fixtureReconstruct({ spec, clock: deps.clock, ids: deps.ids, store: deps.store }),
    completedAt: "2026-01-01T00:00:01.000Z",
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.jobId, spec.id);
  assert.equal(completed.simulated, true);
  assert.equal(completed.producedDomainBlocks.length, 2);
  assert.equal(completed.effortObservations["failureReason"], undefined);

  const failed = buildReconstructionJobResult({
    spec,
    status: "failed",
    producedDomainBlocks: [],
    failureReason: "fixture adapter failure",
    completedAt: "2026-01-01T00:00:02.000Z",
  });
  assert.equal(failed.status, "failed");
  assert.deepEqual([...failed.producedDomainBlocks], []);
  assert.equal(failed.effortObservations["failureReason"], "fixture adapter failure");
  assert.ok(Object.isFrozen(failed));
});
