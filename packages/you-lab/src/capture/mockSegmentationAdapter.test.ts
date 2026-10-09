// Mock segmentation adapter tests (W2C) — coverage area 2: byte-identical
// replay from seed; seed-derived variation; structural validity; simulated
// labeling (truth law).
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { generateSyntheticCapture } from "./syntheticPayload.js";
import { createMockSegmentationAdapter } from "./mockSegmentationAdapter.js";

const SPEC = { frames: 2, width: 16, height: 20, modality: "image" as const, includeProp: true };
const CONFIG = { id: "mock-seg-test", chromaThreshold: 0.55, keepProbability: 0.9, stride: 1 as const, minRegionBlocks: 4, confidenceBase: 0.9 };

function observeOnce(seed: string): string {
  const adapter = createMockSegmentationAdapter(CONFIG);
  const { payload } = generateSyntheticCapture(seed, SPEC);
  return canonicalJson(adapter.observe(payload, seed));
}

test("mock segmentation adapter: byte-identical replay from the same seed", () => {
  const first = observeOnce("replay-seed");
  const second = observeOnce("replay-seed");
  assert.equal(first, second);
  // a freshly constructed adapter of the same config also replays identically
  const third = observeOnce("replay-seed");
  assert.equal(first, third);
});

test("mock segmentation adapter: output is seed-derived (different seed, different bytes)", () => {
  const first = observeOnce("seed-one");
  const second = observeOnce("seed-two");
  assert.notEqual(first, second);
});

test("mock segmentation adapter: output is payload-driven (different payload, different bytes)", () => {
  const adapter = createMockSegmentationAdapter(CONFIG);
  const a = generateSyntheticCapture("payload-seed-a", SPEC);
  const b = generateSyntheticCapture("payload-seed-b", SPEC);
  assert.notEqual(
    canonicalJson(adapter.observe(a.payload, "shared-seed")),
    canonicalJson(adapter.observe(b.payload, "shared-seed")),
  );
});

test("mock segmentation adapter: batch stays labeled simulated with sorted warnings", () => {
  const adapter = createMockSegmentationAdapter(CONFIG);
  const { payload } = generateSyntheticCapture("label-seed", SPEC);
  const batch = adapter.observe(payload, "label-seed");
  assert.equal(batch.simulated, true);
  assert.equal(batch.adapterId, CONFIG.id);
  assert.equal(batch.payloadId, payload.payloadId);
  const warnings = [...batch.warnings];
  assert.deepEqual(warnings, [...warnings].sort(), "warnings sorted");
  // region ids sorted per observation; block ids sorted per region
  for (const observation of batch.observations) {
    assert.equal(observation.kind, "segmentation");
    const regionIds = observation.regions.map((region) => region.regionId);
    assert.deepEqual(regionIds, [...regionIds].sort());
    for (const region of observation.regions) {
      assert.deepEqual(region.blockIds, [...region.blockIds].sort());
      assert.ok(region.confidence >= 0 && region.confidence <= 1);
      assert.ok(region.areaRatio > 0 && region.areaRatio < 1);
      const [x0, y0, x1, y1] = region.boundingBox;
      assert.ok(x0 < x1 && y0 < y1 && x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1);
    }
  }
});

test("mock segmentation adapter: high-quality config detects the person region", () => {
  const adapter = createMockSegmentationAdapter(CONFIG);
  const { payload, groundTruth } = generateSyntheticCapture("detect-seed", SPEC);
  const batch = adapter.observe(payload, "detect-seed");
  for (const observation of batch.observations) {
    const personRegions = observation.regions.filter((region) => region.label === "person");
    assert.ok(personRegions.length >= 1, `person region detected in ${observation.frameId}`);
    const truth = groundTruth.frames.find((frame) => frame.frameId === observation.frameId);
    assert.ok(truth);
    const truthPerson = truth.regions.find((region) => region.label === "person");
    assert.ok(truthPerson);
    // the detected person region overlaps the ground-truth person blocks
    const predicted = new Set(personRegions.flatMap((region) => region.blockIds));
    const overlap = [...truthPerson.blockIds].filter((id) => predicted.has(id));
    assert.ok(overlap.length > 0, "detected region overlaps ground truth");
  }
});

test("mock segmentation adapter: degraded config scores strictly lower quality", () => {
  const precise = createMockSegmentationAdapter({ ...CONFIG, id: "seg-precise", keepProbability: 0.99 });
  const noisy = createMockSegmentationAdapter({ ...CONFIG, id: "seg-noisy", keepProbability: 0.45 });
  const { payload } = generateSyntheticCapture("quality-seed", SPEC);
  const a = precise.observe(payload, "quality-seed");
  const b = noisy.observe(payload, "quality-seed");
  const area = (regions: readonly { areaRatio: number }[]): number =>
    regions.reduce((sum, region) => sum + region.areaRatio, 0);
  const areaA = a.observations.reduce((sum, obs) => sum + area(obs.regions), 0);
  const areaB = b.observations.reduce((sum, obs) => sum + area(obs.regions), 0);
  assert.ok(areaB < areaA, "dropout degrades detected person area deterministically");
});

test("mock segmentation adapter: stride-2 coarsening reduces emitted blocks", () => {
  const fine = createMockSegmentationAdapter({ ...CONFIG, id: "seg-fine", stride: 1, keepProbability: 0.99 });
  const coarse = createMockSegmentationAdapter({ ...CONFIG, id: "seg-coarse", stride: 2, keepProbability: 0.99 });
  const { payload } = generateSyntheticCapture("stride-seed", SPEC);
  const blocksOf = (batch: ReturnType<typeof fine.observe>): number =>
    batch.observations.reduce((sum, obs) => sum + obs.regions.reduce((n, region) => n + region.blockIds.length, 0), 0);
  const fineBlocks = blocksOf(fine.observe(payload, "stride-seed"));
  const coarseBlocks = blocksOf(coarse.observe(payload, "stride-seed"));
  assert.ok(coarseBlocks < fineBlocks, "coarse detection emits fewer blocks");
});
