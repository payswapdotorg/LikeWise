// Synthetic payload generator tests (W2C): determinism (byte-identical
// replay), ground-truth invariants and value bounds.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { generateSyntheticCapture } from "./syntheticPayload.js";
import { NEUTRAL_SKELETON_MODEL } from "./captureAdapterSeam.js";

const SPEC = { frames: 3, width: 16, height: 20, modality: "image" as const, includeProp: true };

test("payload: generation is byte-identical across runs from the same seed", () => {
  const a = generateSyntheticCapture("w2c-payload-a", SPEC);
  const b = generateSyntheticCapture("w2c-payload-a", SPEC);
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(a.payload.payloadId, b.payload.payloadId);
});

test("payload: different seeds produce different payloads", () => {
  const a = generateSyntheticCapture("w2c-payload-a", SPEC);
  const b = generateSyntheticCapture("w2c-payload-b", SPEC);
  assert.notEqual(a.payload.payloadId, b.payload.payloadId);
  assert.notDeepEqual(a.groundTruth.frames, b.groundTruth.frames);
});

test("payload: frame/grid structure and feature bounds", () => {
  const { payload } = generateSyntheticCapture("bounds-check", SPEC);
  assert.equal(payload.simulated, true, "truth law: synthetic payload stays labeled");
  assert.equal(payload.frames.length, SPEC.frames);
  for (const frame of payload.frames) {
    assert.equal(frame.blocks.length, SPEC.width * SPEC.height);
    for (const block of frame.blocks) {
      assert.ok(block.chroma >= 0 && block.chroma <= 1, `chroma out of [0,1]: ${block.chroma}`);
      assert.ok(block.luminance >= 0 && block.luminance <= 1, `luminance out of [0,1]: ${block.luminance}`);
      assert.ok(block.depth >= 0 && block.depth <= 1, `depth out of [0,1]: ${block.depth}`);
    }
  }
});

test("payload: ground-truth regions partition the frame blocks per frame", () => {
  const { payload, groundTruth } = generateSyntheticCapture("partition-check", SPEC);
  for (const frame of payload.frames) {
    const truth = groundTruth.frames.find((entry) => entry.frameId === frame.frameId);
    assert.ok(truth, `ground truth for ${frame.frameId}`);
    const regionBlocks = truth.regions.flatMap((region) => region.blockIds);
    assert.equal(regionBlocks.length, frame.blocks.length, "regions cover every block exactly once");
    assert.equal(new Set(regionBlocks).size, frame.blocks.length, "no block appears in two regions");
  }
});

test("payload: person region exists and carries a sensible area ratio and bbox", () => {
  const { groundTruth } = generateSyntheticCapture("person-check", SPEC);
  for (const frame of groundTruth.frames) {
    const person = frame.regions.find((region) => region.label === "person");
    assert.ok(person, "person region present");
    assert.ok(person.areaRatio > 0 && person.areaRatio < 1);
    const [x0, y0, x1, y1] = person.boundingBox;
    assert.ok(x0 < x1 && y0 < y1, "bbox is non-degenerate");
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1, "bbox within [0,1]");
  }
});

test("payload: ground-truth pose uses the neutral skeleton and stays in bounds", () => {
  const { groundTruth } = generateSyntheticCapture("pose-check", SPEC);
  for (const frame of groundTruth.frames) {
    assert.equal(frame.pose.skeletonModel, NEUTRAL_SKELETON_MODEL);
    assert.equal(frame.pose.landmarks.length, 17);
    const ids = frame.pose.landmarks.map((landmark) => landmark.landmarkId);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "landmark ids ordered");
    for (const landmark of frame.pose.landmarks) {
      assert.ok(landmark.x >= 0 && landmark.x <= 1, `x out of [0,1]: ${landmark.x}`);
      assert.ok(landmark.y >= 0 && landmark.y <= 1, `y out of [0,1]: ${landmark.y}`);
      assert.ok(landmark.z >= 0 && landmark.z <= 1, `z out of [0,1]: ${landmark.z}`);
      assert.ok(landmark.visibility > 0 && landmark.visibility <= 1);
    }
  }
});

test("payload: ground-truth joints lie inside the person region bbox (structure holds)", () => {
  const { groundTruth } = generateSyntheticCapture("joint-structure-check", SPEC);
  for (const frame of groundTruth.frames) {
    const person = frame.regions.find((region) => region.label === "person");
    assert.ok(person);
    const [x0, y0, x1, y1] = person.boundingBox;
    for (const landmark of frame.pose.landmarks) {
      assert.ok(
        landmark.x >= x0 - 0.02 && landmark.x <= x1 + 0.02,
        `landmark ${landmark.landmarkId} x outside person bbox`,
      );
      assert.ok(
        landmark.y >= y0 - 0.02 && landmark.y <= y1 + 0.02,
        `landmark ${landmark.landmarkId} y outside person bbox`,
      );
    }
  }
});
