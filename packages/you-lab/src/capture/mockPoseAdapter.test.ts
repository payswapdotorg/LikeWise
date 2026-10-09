// Mock pose adapter tests (W2C) — coverage area 2: byte-identical replay from
// seed; seed-derived variation; structural validity; partial/dropout
// semantics; simulated labeling (truth law).
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { generateSyntheticCapture } from "./syntheticPayload.js";
import { createMockPoseAdapter } from "./mockPoseAdapter.js";
import { NEUTRAL_SKELETON_MODEL } from "./captureAdapterSeam.js";

const SPEC = { frames: 2, width: 16, height: 20, modality: "image" as const, includeProp: false };
const CONFIG = { id: "mock-pose-test", jitterAmplitude: 0.05, dropLandmarkCount: 0, visibilityFloor: 0.9 };

function observeOnce(seed: string): string {
  const adapter = createMockPoseAdapter(CONFIG);
  const { payload } = generateSyntheticCapture(seed, SPEC);
  return canonicalJson(adapter.observe(payload, seed));
}

test("mock pose adapter: byte-identical replay from the same seed", () => {
  const first = observeOnce("replay-seed");
  const second = observeOnce("replay-seed");
  assert.equal(first, second);
  const third = observeOnce("replay-seed");
  assert.equal(first, third);
});

test("mock pose adapter: output is seed-derived (different seed, different bytes)", () => {
  const first = observeOnce("seed-one");
  const second = observeOnce("seed-two");
  assert.notEqual(first, second);
});

test("mock pose adapter: output is payload-driven (different payload, different bytes)", () => {
  const adapter = createMockPoseAdapter(CONFIG);
  const a = generateSyntheticCapture("payload-seed-a", SPEC);
  const b = generateSyntheticCapture("payload-seed-b", SPEC);
  assert.notEqual(
    canonicalJson(adapter.observe(a.payload, "shared-seed")),
    canonicalJson(adapter.observe(b.payload, "shared-seed")),
  );
});

test("mock pose adapter: batch stays labeled simulated with neutral skeleton", () => {
  const adapter = createMockPoseAdapter(CONFIG);
  const { payload } = generateSyntheticCapture("label-seed", SPEC);
  const batch = adapter.observe(payload, "label-seed");
  assert.equal(batch.simulated, true);
  assert.equal(batch.adapterId, CONFIG.id);
  for (const observation of batch.observations) {
    assert.equal(observation.kind, "pose");
    assert.equal(observation.skeletonModel, NEUTRAL_SKELETON_MODEL);
    for (const landmark of observation.landmarks) {
      assert.ok(landmark.x >= 0 && landmark.x <= 1, `x out of [0,1]: ${landmark.x}`);
      assert.ok(landmark.y >= 0 && landmark.y <= 1, `y out of [0,1]: ${landmark.y}`);
      assert.ok(landmark.z >= 0 && landmark.z <= 1, `z out of [0,1]: ${landmark.z}`);
      assert.ok(landmark.visibility >= CONFIG.visibilityFloor && landmark.visibility <= 1, "visibility respects floor");
    }
    const ids = observation.landmarks.map((landmark) => landmark.landmarkId);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "landmark ids ordered");
  }
});

test("mock pose adapter: full config predicts all 17 neutral landmarks", () => {
  const adapter = createMockPoseAdapter(CONFIG);
  const { payload } = generateSyntheticCapture("full-seed", SPEC);
  const batch = adapter.observe(payload, "full-seed");
  for (const observation of batch.observations) {
    assert.equal(observation.landmarks.length, 17);
  }
  assert.deepEqual(batch.warnings, []);
});

test("mock pose adapter: partial config drops landmarks deterministically with warnings", () => {
  const dropCount = 5;
  const adapter = createMockPoseAdapter({ ...CONFIG, id: "mock-pose-partial", dropLandmarkCount: dropCount });
  const { payload } = generateSyntheticCapture("partial-seed", SPEC);
  const batch = adapter.observe(payload, "partial-seed");
  for (const observation of batch.observations) {
    assert.equal(observation.landmarks.length, 17 - dropCount);
    // the DROPPED ids are the highest landmark ids (deterministic policy)
    const ids = observation.landmarks.map((landmark) => landmark.landmarkId);
    assert.ok(Math.max(...ids) < 17 - dropCount, "only high-id landmarks dropped");
  }
  assert.equal(batch.warnings.length, SPEC.frames * dropCount, "one warning per dropped landmark per frame");
});

test("mock pose adapter: predictions track the ground-truth structure (small error)", () => {
  const clean = createMockPoseAdapter({ ...CONFIG, id: "mock-pose-clean", jitterAmplitude: 0.01 });
  const { payload, groundTruth } = generateSyntheticCapture("structure-seed", SPEC);
  const batch = clean.observe(payload, "structure-seed");
  for (const observation of batch.observations) {
    const truth = groundTruth.frames.find((frame) => frame.frameId === observation.frameId);
    assert.ok(truth);
    for (const landmark of observation.landmarks) {
      const gt = truth.pose.landmarks.find((entry) => entry.landmarkId === landmark.landmarkId);
      assert.ok(gt);
      const error = Math.hypot(landmark.x - gt.x, landmark.y - gt.y, landmark.z - gt.z);
      assert.ok(error < 0.1, `landmark ${landmark.landmarkId} error too high: ${error}`);
    }
  }
});

test("mock pose adapter: heavier jitter increases mean error deterministically", () => {
  const clean = createMockPoseAdapter({ ...CONFIG, id: "clean", jitterAmplitude: 0.01 });
  const degraded = createMockPoseAdapter({ ...CONFIG, id: "degraded", jitterAmplitude: 0.25 });
  const { payload, groundTruth } = generateSyntheticCapture("jitter-seed", SPEC);
  const meanError = (batch: ReturnType<typeof clean.observe>): number => {
    let total = 0;
    let count = 0;
    for (const observation of batch.observations) {
      const truth = groundTruth.frames.find((frame) => frame.frameId === observation.frameId);
      assert.ok(truth);
      for (const landmark of observation.landmarks) {
        const gt = truth.pose.landmarks.find((entry) => entry.landmarkId === landmark.landmarkId);
        assert.ok(gt);
        total += Math.hypot(landmark.x - gt.x, landmark.y - gt.y, landmark.z - gt.z);
        count += 1;
      }
    }
    return total / count;
  };
  const cleanError = meanError(clean.observe(payload, "jitter-seed"));
  const degradedError = meanError(degraded.observe(payload, "jitter-seed"));
  assert.ok(degradedError > cleanError, `degraded (${degradedError}) > clean (${cleanError})`);
});
