// Deterministic mock render adapter tests (W4C) — coverage: byte-identical
// replay from seed, content-addressed artifact construction, coverage of the
// image/video/mesh/animation output kinds across the method families, typed
// refusals (YOU_RENDER_UNSUPPORTED), seeded dropout warnings and profile
// honesty (pure mock — technologyId null, never a technology assessment).
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRenderRequestSupported,
  isSha256Hex,
  NEUTRAL_RENDER_SUPPORT,
  RENDER_UNSUPPORTED_CODE,
  sha256Hex,
  UnimplementedRenderMethodError,
  UnsupportedRenderOutputKindsError,
  unsupportedRenderOutputKinds,
  type NeutralRenderRequest,
} from "./renderAdapterSeam.js";
import { createMockRenderAdapter, timelineLift } from "./mockRenderAdapter.js";
import { MOCK_RENDER_CANDIDATES } from "./renderCandidates.js";

function makeTimeline(): NeutralRenderRequest["timeline"] {
  return {
    id: "perf-mock-test",
    durationMs: 4000,
    cues: [
      {
        id: "cue-01",
        track: "motion",
        startMs: 0,
        endMs: 1500,
        payloadRef: "content-store://you-lab/performance-fixture/perf-mock-test/cue-01",
        payloadHash: sha256Hex("cue-01"),
      },
      {
        id: "cue-02",
        track: "cue",
        startMs: 1500,
        endMs: 4000,
        payloadRef: "content-store://you-lab/performance-fixture/perf-mock-test/cue-02",
        payloadHash: sha256Hex("cue-02"),
      },
    ],
  };
}

function makeRequest(overrides?: Partial<NeutralRenderRequest>): NeutralRenderRequest {
  return {
    requestId: "req-mock-1",
    performanceId: "perf-mock-test",
    method: "image-render",
    outputKinds: ["image"],
    parameters: { quality: "high" },
    timeline: makeTimeline(),
    submittedAt: "2026-10-11T12:00:00Z",
    ...overrides,
  };
}

const PRECISE_IMAGE = {
  id: "mock-render-image-precise",
  method: "image-render" as const,
  fidelityBase: 0.62,
  timelineSensitivity: 0.33,
  artifactDropoutRate: 0,
  fidelityJitter: 0.02,
};

test("mock render adapter: byte-identical replay from the same request (determinism law)", () => {
  const adapter = createMockRenderAdapter(PRECISE_IMAGE);
  const first = adapter.render(makeRequest());
  const second = adapter.render(makeRequest());
  assert.deepEqual(second, first);
  assert.deepEqual(
    first.producedArtifacts.map((artifact) => Array.from(artifact.payload)),
    second.producedArtifacts.map((artifact) => Array.from(artifact.payload)),
    "payload bytes replay byte-identically",
  );
});

test("mock render adapter: artifacts are validly content-addressed (sha-256 binds the payload bytes)", () => {
  const adapter = createMockRenderAdapter(PRECISE_IMAGE);
  const output = adapter.render(makeRequest());
  assert.equal(output.status, "completed");
  assert.equal(output.producedArtifacts.length, 1);
  for (const artifact of output.producedArtifacts) {
    assert.ok(artifact.artifactId.length > 0, "artifactId non-empty");
    assert.ok(artifact.contentRef.startsWith("content-store://you-lab/render/"), "contentRef namespace");
    assert.ok(isSha256Hex(artifact.contentHash), "contentHash is sha-256 hex");
    assert.equal(artifact.contentHash, sha256Hex(artifact.payload), "contentHash binds the payload bytes");
    assert.equal(artifact.simulated, true, "truth law: simulated stays true");
    assert.ok(artifact.fidelity >= 0 && artifact.fidelity <= 1, "fidelity in [0, 1]");
    assert.ok(artifact.generator.startsWith("you-lab-mock-render-adapter/"), "generator label");
  }
});

test("mock render adapter: image / video / mesh / animation output kinds are all covered across the families", () => {
  const producedKinds = new Set<string>();
  for (const candidate of MOCK_RENDER_CANDIDATES) {
    const adapter = createMockRenderAdapter(candidate.config);
    const kinds = NEUTRAL_RENDER_SUPPORT[candidate.config.method] ?? [];
    const output = adapter.render(makeRequest({ method: candidate.config.method, outputKinds: kinds }));
    for (const artifact of output.producedArtifacts) {
      producedKinds.add(artifact.kind);
    }
  }
  for (const kind of ["animation", "image", "mesh", "video"]) {
    assert.ok(producedKinds.has(kind), `output kind "${kind}" produced by the mock family set`);
  }
});

test("mock render adapter: video-render emits video + poster image (support matrix law)", () => {
  const adapter = createMockRenderAdapter({
    id: "mock-render-video-full",
    method: "video-render",
    fidelityBase: 0.6,
    timelineSensitivity: 0.33,
    artifactDropoutRate: 0,
    fidelityJitter: 0.02,
  });
  const output = adapter.render(makeRequest({ method: "video-render", outputKinds: ["video", "image"] }));
  assert.deepEqual(
    output.producedArtifacts.map((artifact) => artifact.kind),
    ["image", "video"],
    "poster image + video (sorted kind order)",
  );
});

test("mock render adapter: unsupported method/output-kind combinations are typed refusals", () => {
  const adapter = createMockRenderAdapter(PRECISE_IMAGE);
  assert.throws(
    () => adapter.render(makeRequest({ method: "3d-render", outputKinds: ["mesh"] })),
    (error: unknown) => error instanceof UnimplementedRenderMethodError && error.code === RENDER_UNSUPPORTED_CODE,
  );
  assert.throws(
    () => adapter.render(makeRequest({ method: "image-render", outputKinds: ["image", "mesh"] })),
    (error: unknown) =>
      error instanceof UnsupportedRenderOutputKindsError &&
      error.code === RENDER_UNSUPPORTED_CODE &&
      error.unsupportedKinds.join(",") === "mesh",
  );
  const unregistered = unsupportedRenderOutputKinds("hologram-render" as never, ["image"]);
  assert.deepEqual(unregistered, ["image"], "unknown methods refuse every kind");
  assert.doesNotThrow(() =>
    assertRenderRequestSupported(
      { ...adapter.profile, methods: ["image-render"] },
      makeRequest({ method: "image-render", outputKinds: ["image"] }),
    ),
  );
});

test("mock render adapter: seeded per-kind dropout is deterministic and warned", () => {
  const degraded = createMockRenderAdapter({
    id: "mock-render-video-degraded",
    method: "video-render",
    fidelityBase: 0.6,
    timelineSensitivity: 0.3,
    artifactDropoutRate: 0.9,
    fidelityJitter: 0.04,
  });
  const request = makeRequest({ method: "video-render", outputKinds: ["video", "image"] });
  const first = degraded.render(request);
  const second = degraded.render(request);
  assert.deepEqual(first, second, "dropout replay is deterministic");
  assert.ok(first.warnings.length > 0, "dropped kinds produce sorted warnings");
  for (const warning of first.warnings) {
    assert.ok(warning.endsWith(": seeded dropout — artifact not produced"), `warning shape: ${warning}`);
  }
  const produced = new Set(first.producedArtifacts.map((artifact) => artifact.kind));
  for (const warning of first.warnings) {
    assert.ok(!produced.has(warning.split(":")[0] ?? ""), "warned kinds are never produced");
  }
});

test("mock render adapter: profile honesty — pure mock, never a technology assessment", () => {
  const adapter = createMockRenderAdapter(PRECISE_IMAGE);
  assert.equal(adapter.profile.technologyId, null);
  assert.equal(adapter.profile.productionEligible, null);
  assert.ok(adapter.profile.eligibilityBasis.includes("pure mock"));
  assert.equal(adapter.profile.deterministic, true);
  const output = adapter.render(makeRequest());
  assert.equal(output.simulated, true);
  assert.equal(output.effort.effort.kind, "not-measured");
  assert.equal(output.effort.effort.marker, "not-measured (simulated)");
});

test("mock render adapter: timeline lift is deterministic fixture arithmetic over the consumed timeline", () => {
  const dense = makeRequest({
    timeline: {
      id: "perf-dense",
      durationMs: 9000,
      cues: Array.from({ length: 9 }, (_, index) => ({
        id: `cue-${index}`,
        track: ["motion", "cue", "layer"][index % 3]!,
        startMs: index * 1000,
        endMs: index * 1000 + 900,
        payloadRef: `content-store://you-lab/perf/dense/cue-${index}`,
        payloadHash: sha256Hex(`dense-${index}`),
      })),
    },
  });
  const sparse = makeRequest({
    timeline: {
      id: "perf-sparse",
      durationMs: 4000,
      cues: [
        {
          id: "cue-01",
          track: "motion",
          startMs: 0,
          endMs: 1000,
          payloadRef: "content-store://you-lab/perf/sparse/cue-01",
          payloadHash: sha256Hex("sparse-01"),
        },
      ],
    },
  });
  const denseLift = timelineLift(dense);
  const sparseLift = timelineLift(sparse);
  assert.ok(denseLift > sparseLift, "denser timelines lift fidelity more");
  assert.ok(denseLift <= 1 && sparseLift >= 0, "lift stays in [0, 1]");
  assert.equal(timelineLift(dense), denseLift, "lift is a pure function of the request");
  const empty = makeRequest({
    timeline: { id: "perf-empty", durationMs: 0, cues: [] },
  });
  assert.equal(timelineLift(empty), 0, "empty timelines lift nothing");
});
