// Render contract seam tests (W4C) — coverage: mapping onto the frozen v4
// performance/render contracts produces valid frozen-contract shapes:
// PerformanceTimeline consumption, RenderJobSpec -> RenderJobResult through
// the provider-neutral adapter, RenderArtifact assembly (content referenced,
// never inlined; payload + fixture fidelity dropped at the seam); honest
// effort markers (the W4A notMeasuredRenderEffortObservations key layout);
// and render modules never touching the frozen contract (only the seam
// does). Type-only imports from the frozen contract are compile-time
// assertions that the constructed shapes ARE the frozen v4 shapes (runtime
// field assertions follow the W2C/W3C convention of not importing contract
// values into you-lab tests).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type {
  PerformanceTimeline,
  RenderJobResult,
  RenderJobSpec,
} from "../../../shared/src/you/contract.js";
import {
  renderThroughAdapter,
  toNeutralRenderRequest,
  toNeutralRenderTimeline,
  toRenderArtifacts,
  toRenderEffortObservations,
  toRenderJobResult,
  type RenderJobCompletion,
} from "../contractSeam.js";
import { createRenderRegistry } from "../technology/renderSeedProfiles.js";
import { createThreejsRasterizationAdapter } from "./threejsRasterizationAdapter.js";
import { createMockRenderAdapter } from "./mockRenderAdapter.js";
import { notMeasuredRenderEffortFields, sha256Hex } from "./renderAdapterSeam.js";

const registry = createRenderRegistry();
const threejsAdapter = createThreejsRasterizationAdapter(registry);
const mockAdapter = createMockRenderAdapter({
  id: "mock-render-seam",
  method: "3d-render",
  fidelityBase: 0.6,
  timelineSensitivity: 0.3,
  artifactDropoutRate: 0,
  fidelityJitter: 0.02,
});

const TIMELINE: PerformanceTimeline = {
  id: "perf-seam-1",
  durationMs: 4000,
  cues: [
    {
      id: "cue-01",
      track: "motion",
      startMs: 0,
      endMs: 1500,
      payloadRef: "content-store://you-lab/perf/seam/cue-01",
      payloadHash: sha256Hex("seam-cue-01"),
    },
    {
      id: "cue-02",
      track: "cue",
      startMs: 1500,
      endMs: 4000,
      payloadRef: "content-store://you-lab/perf/seam/cue-02",
      payloadHash: sha256Hex("seam-cue-02"),
    },
  ],
};

const SPEC: RenderJobSpec = {
  id: "render-job-seam-1",
  performanceId: "perf-seam-1",
  method: "3d-render",
  outputKinds: ["mesh"],
  parameters: { lod: "high" },
  createdAt: "2026-10-11T12:00:00Z",
};

test("render seam: toNeutralRenderTimeline maps the frozen timeline 1:1 (performance timeline consumption)", () => {
  const neutral = toNeutralRenderTimeline(TIMELINE);
  assert.equal(neutral.id, TIMELINE.id);
  assert.equal(neutral.durationMs, TIMELINE.durationMs);
  assert.deepEqual(neutral.cues, TIMELINE.cues as unknown as typeof neutral.cues);
  // Malformed timelines are typed rejections — never silently repaired.
  assert.throws(() => toNeutralRenderTimeline({ ...TIMELINE, durationMs: 9999 }), /must equal the greatest cue endMs/);
  assert.throws(
    () =>
      toNeutralRenderTimeline({
        ...TIMELINE,
        cues: [...TIMELINE.cues.slice(1), TIMELINE.cues[0]!],
      }),
    /cues must be ordered by startMs/,
  );
  assert.throws(
    () =>
      toNeutralRenderTimeline({
        ...TIMELINE,
        cues: [{ ...TIMELINE.cues[0]!, payloadHash: "not-a-hash" }],
      }),
    /payloadHash must be a sha-256 hex digest/,
  );
  assert.throws(
    () =>
      toNeutralRenderTimeline({
        ...TIMELINE,
        cues: [{ ...TIMELINE.cues[0]!, id: "" }],
      }),
    /unique and non-empty/,
  );
});

test("render seam: toNeutralRenderRequest maps the frozen spec 1:1 and refuses empty output kinds", () => {
  const request = toNeutralRenderRequest(SPEC, TIMELINE);
  assert.equal(request.requestId, SPEC.id);
  assert.equal(request.performanceId, SPEC.performanceId);
  assert.equal(request.method, SPEC.method);
  assert.deepEqual(request.outputKinds, SPEC.outputKinds);
  assert.deepEqual(request.parameters, SPEC.parameters);
  assert.equal(request.submittedAt, SPEC.createdAt);
  assert.equal(request.timeline.id, TIMELINE.id, "timeline consumed at the seam");
  assert.throws(
    () => toNeutralRenderRequest({ ...SPEC, outputKinds: [] }, TIMELINE),
    /at least one output kind/,
  );
});

test("render seam: toRenderArtifacts drops payload + fidelity, keeps content addressing (never inlined)", () => {
  const output = mockAdapter.render(toNeutralRenderRequest(SPEC, TIMELINE));
  const artifacts = toRenderArtifacts(output.producedArtifacts, {
    jobId: SPEC.id,
    createdAt: "2026-10-11T12:01:00Z",
  });
  assert.equal(artifacts.length, 1);
  const artifact = artifacts[0]!;
  assert.equal(artifact.jobId, SPEC.id);
  assert.equal(artifact.kind, "mesh");
  assert.equal(artifact.createdAt, "2026-10-11T12:01:00Z");
  assert.equal(artifact.simulated, true);
  assert.ok(artifact.contentRef.startsWith("content-store://"));
  assert.ok(/^[0-9a-f]{64}$/.test(artifact.contentHash));
  assert.ok(!("payload" in artifact), "payload bytes never cross the seam");
  assert.ok(!("fidelity" in artifact), "fixture-only fidelity never crosses the seam");
  assert.ok(!("generator" in artifact), "generator label never crosses the seam");
  assert.throws(
    () =>
      toRenderArtifacts(
        [
          {
            artifactId: "bad",
            kind: "mesh",
            contentRef: "",
            contentHash: sha256Hex("x"),
            fidelity: 0.5,
            simulated: true,
            generator: "test",
            payload: new Uint8Array(1),
          },
        ],
        { jobId: "j", createdAt: "now" },
      ),
    /contentRef must reference stored content/,
  );
});

test("render seam: effort observations carry the honest W4A key layout", () => {
  const fields = notMeasuredRenderEffortFields();
  const observations = toRenderEffortObservations(fields, 2, 5);
  assert.deepEqual(observations, {
    artifactsProduced: 2,
    timelineCuesProcessed: 5,
    simulated: true,
    "computeEffort.measured": false,
    computeEffort: "not-measured (simulated)",
    "latencyMs.measured": false,
    latencyMs: "not-measured (simulated)",
    "costUnits.measured": false,
    costUnits: "not-measured (simulated)",
  });
});

test("render seam: toRenderJobResult constructs a valid frozen v4 shape (completed)", () => {
  const request = toNeutralRenderRequest(SPEC, TIMELINE);
  const output = threejsAdapter.render(request);
  const completion: RenderJobCompletion = {
    spec: SPEC,
    output,
    timelineCueCount: TIMELINE.cues.length,
    completedAt: "2026-10-11T12:01:00Z",
  };
  const result: RenderJobResult = toRenderJobResult(completion);
  assert.equal(result.jobId, SPEC.id);
  assert.equal(result.status, "completed");
  assert.equal(result.completedAt, "2026-10-11T12:01:00Z");
  assert.equal(result.simulated, true);
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.effortObservations["artifactsProduced"], 1);
  assert.equal(result.effortObservations["timelineCuesProcessed"], 2);
  assert.equal(result.effortObservations["computeEffort"], "not-measured (simulated)");
  assert.equal(result.effortObservations["simulated"], true);
  // Adapter outputs must belong to the spec they are folded into.
  assert.throws(
    () =>
      toRenderJobResult({
        ...completion,
        output: { ...output, requestId: "other-job" },
      }),
    /does not belong to this job spec/,
  );
});

test("render seam: failed adapter outputs produce no artifacts and journal the failure reason", () => {
  const failedOutput = {
    adapterId: "mock-render-seam",
    requestId: SPEC.id,
    status: "failed" as const,
    failureReason: "fixture-simulated renderer fault",
    producedArtifacts: [],
    warnings: [],
    effort: notMeasuredRenderEffortFields(),
    simulated: true as const,
  };
  const result = toRenderJobResult({
    spec: SPEC,
    output: failedOutput,
    timelineCueCount: TIMELINE.cues.length,
    completedAt: "2026-10-11T12:01:00Z",
  });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.artifacts, []);
  assert.equal(result.effortObservations["failureReason"], "fixture-simulated renderer fault");
});

test("render seam: renderThroughAdapter runs the full v4 path end-to-end (spec -> adapter -> frozen result)", () => {
  const first = renderThroughAdapter(SPEC, threejsAdapter, TIMELINE, { completedAt: "2026-10-11T12:01:00Z" });
  const second = renderThroughAdapter(SPEC, threejsAdapter, TIMELINE, { completedAt: "2026-10-11T12:01:00Z" });
  assert.deepEqual(second, first, "the full path replays deterministically");
  assert.equal(first.jobId, SPEC.id);
  assert.equal(first.status, "completed");
  assert.equal(first.artifacts[0]?.kind, "mesh");
  assert.ok((first.artifacts[0]?.id ?? "").startsWith("render-artifact-"), "frozen artifact id from the neutral id");
  // The mock and the evaluation adapter produce distinct content (seed derivation).
  const mockResult = renderThroughAdapter(SPEC, mockAdapter, TIMELINE, { completedAt: "2026-10-11T12:01:00Z" });
  assert.notEqual(mockResult.artifacts[0]?.contentHash, first.artifacts[0]?.contentHash);
});

test("render seam: only contractSeam.ts touches the frozen contract — render modules never reference it", () => {
  const renderDir = join(dirname(fileURLToPath(import.meta.url)));
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
        const text = readFileSync(path, "utf8");
        if (text.includes("shared/src/you/contract") || text.includes('from "@zcode/shared"')) {
          offenders.push(path);
        }
      }
    }
  };
  walk(renderDir);
  assert.deepEqual(offenders, [], `render modules must not touch the frozen contract: ${offenders.join(", ")}`);
});
