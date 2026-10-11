import assert from "node:assert/strict";
import test from "node:test";
import type { Performance, RenderJobStatus, RenderJobStatus as Status } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "./evidenceStore.js";
import { createDeterministicRng, seedFromString } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { createPerformanceCue, createPerformanceTimeline } from "./performanceTimeline.js";
import {
  buildRenderJobResult,
  createRenderJobSpec,
  fixtureRenderArtifacts,
  fixtureRenderKindByteLength,
  FIXTURE_RENDER_SUPPORT,
  isLegalRenderJobTransition,
  isTerminalRenderJobStatus,
  notMeasuredRenderEffortObservations,
  RENDER_JOB_TRANSITIONS,
  unsupportedRenderOutputKinds,
} from "./renderJob.js";

const SUPPORT = { registered: true, supportedOutputKinds: FIXTURE_RENDER_SUPPORT["video-render"] ?? [] };

function makeDeps() {
  return {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0020)),
  };
}

function makePerformance(): Performance {
  const { ids, clock } = makeDeps();
  const store = createFixtureEvidenceContentStore();
  const timeline = createPerformanceTimeline(
    [
      createPerformanceCue({ track: "motion", startMs: 0, endMs: 1000, rng: createDeterministicRng(1) }, { ids, store }),
      createPerformanceCue({ track: "cue", startMs: 1000, endMs: 2000, rng: createDeterministicRng(2) }, { ids, store }),
    ],
    { ids },
  );
  return {
    id: "you_performance_0000000100000002",
    twinVersionId: "you_twin-version_0000000100000003",
    timeline,
    basedOnTemplateId: null,
    createdAt: clock.now(),
  };
}

test("the legal transition table is queued -> running -> completed | failed with terminals locked", () => {
  assert.deepEqual(RENDER_JOB_TRANSITIONS, {
    queued: ["running", "failed"],
    running: ["completed", "failed"],
    completed: [],
    failed: [],
  } as const);

  const legal: readonly [Status, Status][] = [
    ["queued", "running"],
    ["queued", "failed"],
    ["running", "completed"],
    ["running", "failed"],
  ];
  for (const [from, to] of legal) {
    assert.ok(isLegalRenderJobTransition(from, to), `${from} -> ${to}`);
  }

  const illegal: readonly [Status, Status][] = [
    ["queued", "completed"],
    ["queued", "queued"],
    ["running", "running"],
    ["running", "queued"],
    ["completed", "running"],
    ["completed", "failed"],
    ["completed", "queued"],
    ["failed", "running"],
    ["failed", "completed"],
    ["failed", "queued"],
  ];
  for (const [from, to] of illegal) {
    assert.ok(!isLegalRenderJobTransition(from, to), `${from} -> ${to} must be illegal`);
  }

  assert.equal(isTerminalRenderJobStatus("completed"), true);
  assert.equal(isTerminalRenderJobStatus("failed"), true);
  assert.equal(isTerminalRenderJobStatus("queued"), false);
  assert.equal(isTerminalRenderJobStatus("running"), false);
});

test("the fixture support matrix declares the frozen render method set", () => {
  assert.deepEqual({ ...FIXTURE_RENDER_SUPPORT }, {
    "3d-render": ["mesh"],
    "image-render": ["image"],
    "motion-extraction": ["animation"],
    retargeting: ["animation"],
    "video-render": ["video", "image"],
  });
  assert.deepEqual(unsupportedRenderOutputKinds("video-render", ["video", "image"], FIXTURE_RENDER_SUPPORT["video-render"]!), []);
  assert.deepEqual(unsupportedRenderOutputKinds("video-render", ["mesh"], FIXTURE_RENDER_SUPPORT["video-render"]!), ["mesh"]);
});

test("spec construction validates the method registration and output kinds (typed refusals)", () => {
  const deps = makeDeps();

  const unregistered = createRenderJobSpec(
    { performanceId: "p", method: "hologram-render", outputKinds: ["image"] },
    deps,
    { registered: false, supportedOutputKinds: [] },
  );
  assert.ok(!unregistered.ok);
  assert.equal(unregistered.code, "unregistered-method");
  assert.equal(unregistered.method, "hologram-render");

  const empty = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: [] }, deps, SUPPORT);
  assert.ok(!empty.ok);
  assert.equal(empty.code, "empty-output-kinds");

  const unsupported = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: ["video", "mesh"] }, deps, SUPPORT);
  assert.ok(!unsupported.ok);
  assert.equal(unsupported.code, "unsupported-output-kinds");
  assert.deepEqual(unsupported.unsupportedKinds, ["mesh"]);

  const badParams = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: ["video"], parameters: { bad: Number.NaN } }, deps, SUPPORT);
  assert.ok(!badParams.ok);
  assert.equal(badParams.code, "invalid-parameters");

  const ok = createRenderJobSpec(
    { performanceId: "p", method: "video-render", outputKinds: ["image", "video"], parameters: { fps: 30 } },
    deps,
    SUPPORT,
  );
  assert.ok(ok.ok);
  assert.ok(ok.spec.id.startsWith("you_render-job_"));
  // outputKinds canonicalize to the sorted unique set.
  assert.deepEqual(ok.spec.outputKinds, ["image", "video"]);
  assert.ok(Object.isFrozen(ok.spec));
  assert.ok(Object.isFrozen(ok.spec.outputKinds));
});

test("fixture render produces one content-addressed simulated artifact per output kind", () => {
  const deps = makeDeps();
  const store: EvidenceContentStore = createFixtureEvidenceContentStore();
  const spec = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: ["video", "image"] }, deps, SUPPORT);
  assert.ok(spec.ok);
  const performance = makePerformance();
  const artifacts = fixtureRenderArtifacts({ spec: spec.spec, performance, clock: deps.clock, ids: deps.ids, store });

  assert.equal(artifacts.length, 2);
  assert.deepEqual(artifacts.map((artifact) => artifact.kind), ["image", "video"]);
  for (const artifact of artifacts) {
    assert.equal(artifact.jobId, spec.spec.id);
    assert.equal(artifact.simulated, true);
    assert.ok(store.has(artifact.contentRef));
    assert.equal(artifact.contentHash.length, 64);
    assert.ok(Object.isFrozen(artifact));
  }
  // Kind-specific byte lengths (frozen fixture definition).
  assert.equal(fixtureRenderKindByteLength("image"), 2048);
  assert.equal(fixtureRenderKindByteLength("video"), 4096);
  assert.equal(fixtureRenderKindByteLength("mesh"), 3072);
  assert.equal(fixtureRenderKindByteLength("animation"), 4096);
});

test("fixture render is deterministic: same inputs produce byte-identical artifacts", () => {
  const run = () => {
    const deps = makeDeps();
    const store = createFixtureEvidenceContentStore();
    const spec = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: ["video", "image"] }, deps, SUPPORT);
    assert.ok(spec.ok);
    return {
      spec: spec.spec,
      performance: makePerformance(),
      artifacts: fixtureRenderArtifacts({ spec: spec.spec, performance: makePerformance(), clock: deps.clock, ids: deps.ids, store }),
      bytes: store,
    };
  };
  const first = run();
  const second = run();
  assert.equal(stableStringify(first.artifacts), stableStringify(second.artifacts));
  assert.equal(first.artifacts[0]?.contentHash, second.artifacts[0]?.contentHash);

  // Different performances (different timeline payload hashes) render
  // different bytes — output is a function of the performed timeline.
  const deps = makeDeps();
  const store = createFixtureEvidenceContentStore();
  const spec = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: ["video"] }, deps, SUPPORT);
  assert.ok(spec.ok);
  const other: Performance = { ...makePerformance(), id: "you_performance_0000000900000009" };
  const firstRender = fixtureRenderArtifacts({ spec: spec.spec, performance: makePerformance(), clock: deps.clock, ids: deps.ids, store });
  const otherRender = fixtureRenderArtifacts({ spec: spec.spec, performance: other, clock: deps.clock, ids: deps.ids, store });
  assert.notEqual(firstRender[0]?.contentHash, otherRender[0]?.contentHash);

  // Different methods render different bytes for the same performance.
  const specA = createRenderJobSpec({ performanceId: "p", method: "image-render", outputKinds: ["image"] }, deps, { registered: true, supportedOutputKinds: ["image"] });
  const specB = createRenderJobSpec({ performanceId: "p", method: "video-render", outputKinds: ["image"] }, deps, { registered: true, supportedOutputKinds: ["image"] });
  assert.ok(specA.ok && specB.ok);
  const renderA = fixtureRenderArtifacts({ spec: specA.spec, performance: makePerformance(), clock: deps.clock, ids: deps.ids, store });
  const renderB = fixtureRenderArtifacts({ spec: specB.spec, performance: makePerformance(), clock: deps.clock, ids: deps.ids, store });
  assert.notEqual(renderA[0]?.contentHash, renderB[0]?.contentHash);
});

test("honest effort observations carry explicit not-measured markers (truth law)", () => {
  const observations = notMeasuredRenderEffortObservations(2, 5);
  assert.equal(observations["computeEffort.measured"], false);
  assert.equal(observations["computeEffort"], "not-measured (simulated)");
  assert.equal(observations["latencyMs.measured"], false);
  assert.equal(observations["latencyMs"], "not-measured (simulated)");
  assert.equal(observations["costUnits.measured"], false);
  assert.equal(observations["costUnits"], "not-measured (simulated)");
  assert.equal(observations["artifactsProduced"], 2);
  assert.equal(observations["timelineCuesProcessed"], 5);
  assert.equal(observations["simulated"], true);
  assert.ok(Object.isFrozen(observations));
});

test("buildRenderJobResult assembles completed and failed terminal results", () => {
  const deps = makeDeps();
  const store = createFixtureEvidenceContentStore();
  const spec = createRenderJobSpec({ performanceId: "p", method: "image-render", outputKinds: ["image"] }, deps, { registered: true, supportedOutputKinds: ["image"] });
  assert.ok(spec.ok);
  const performance = makePerformance();
  const artifacts = fixtureRenderArtifacts({ spec: spec.spec, performance, clock: deps.clock, ids: deps.ids, store });

  const completed = buildRenderJobResult({ spec: spec.spec, status: "completed", artifacts, timelineCueCount: performance.timeline.cues.length, completedAt: deps.clock.now() });
  assert.equal(completed.status, "completed");
  assert.equal(completed.simulated, true);
  assert.deepEqual(completed.artifacts, artifacts);
  assert.equal(completed.effortObservations["artifactsProduced"], 1);
  assert.equal(completed.effortObservations["failureReason"], undefined);
  assert.ok(Object.isFrozen(completed));

  const failed = buildRenderJobResult({ spec: spec.spec, status: "failed", artifacts: [], timelineCueCount: 2, failureReason: "fixture-injected-failure", completedAt: deps.clock.now() });
  assert.equal(failed.status, "failed");
  assert.equal(failed.effortObservations["failureReason"], "fixture-injected-failure");
  assert.equal(failed.artifacts.length, 0);

  const unspecified = buildRenderJobResult({ spec: spec.spec, status: "failed", artifacts: [], timelineCueCount: 2, completedAt: deps.clock.now() });
  assert.equal(unspecified.effortObservations["failureReason"], "unspecified");
});

test("spec records serialize deterministically", () => {
  const run = () => createRenderJobSpec({ performanceId: "p", method: "retargeting", outputKinds: ["animation"] }, makeDeps(), { registered: true, supportedOutputKinds: ["animation"] });
  const first = run();
  const second = run();
  assert.ok(first.ok && second.ok);
  assert.equal(stableStringify(first.spec), stableStringify(second.spec));
  // The status type covers exactly the four frozen states.
  const statuses: readonly RenderJobStatus[] = ["queued", "running", "completed", "failed"];
  assert.equal(new Set(statuses).size, 4);
  assert.equal(seedFromString("determinism-probe") > 0, true);
});
