// Observation scorer tests (W2C): deterministic quality scoring of typed
// observations against fixture-held ground truth; bounds; perfect and
// degraded cases.
import assert from "node:assert/strict";
import test from "node:test";
import { generateSyntheticCapture } from "./syntheticPayload.js";
import {
  poseQualityEntries,
  scorePoseObservations,
  scoreSegmentationObservations,
  segmentationQualityEntries,
} from "./observationScorer.js";
import { createMockSegmentationAdapter } from "./mockSegmentationAdapter.js";
import { createMockPoseAdapter } from "./mockPoseAdapter.js";
import type { SegmentationObservation, PoseObservation } from "./captureAdapterSeam.js";

const SPEC = { frames: 2, width: 16, height: 20, modality: "image" as const, includeProp: true };

test("scorer: perfect segmentation observation (ground truth itself) scores 1", () => {
  const { groundTruth } = generateSyntheticCapture("perfect-seg", SPEC);
  const observations: SegmentationObservation[] = groundTruth.frames.map((frame) => ({
    kind: "segmentation",
    frameId: frame.frameId,
    regions: frame.regions.map((region) => ({
      regionId: region.regionId,
      label: region.label,
      areaRatio: region.areaRatio,
      boundingBox: region.boundingBox,
      confidence: 1,
      blockIds: region.blockIds,
    })),
  }));
  const parts = scoreSegmentationObservations(observations, groundTruth);
  assert.equal(parts.personIoU, 1);
  assert.equal(parts.propIoU, 1);
  assert.equal(parts.regionCountAccuracy, 1);
  assert.equal(parts.segmentationScore, 1);
});

test("scorer: empty observation scores zero person coverage", () => {
  const { groundTruth } = generateSyntheticCapture("empty-seg", SPEC);
  const observations: SegmentationObservation[] = groundTruth.frames.map((frame) => ({
    kind: "segmentation",
    frameId: frame.frameId,
    regions: [],
  }));
  const parts = scoreSegmentationObservations(observations, groundTruth);
  assert.equal(parts.personIoU, 0);
  assert.equal(parts.regionCountAccuracy, 0);
  assert.ok(parts.segmentationScore < 0.5);
});

test("scorer: perfect pose observation (ground truth joints) scores 1", () => {
  const { groundTruth } = generateSyntheticCapture("perfect-pose", SPEC);
  const observations: PoseObservation[] = groundTruth.frames.map((frame) => ({
    kind: "pose",
    frameId: frame.frameId,
    skeletonModel: frame.pose.skeletonModel,
    landmarks: frame.pose.landmarks,
  }));
  const parts = scorePoseObservations(observations, groundTruth);
  assert.equal(parts.meanLandmarkError, 0);
  assert.equal(parts.landmarkRecall, 1);
  assert.equal(parts.poseScore, 1);
});

test("scorer: partial pose observation lowers recall deterministically", () => {
  const { groundTruth } = generateSyntheticCapture("partial-pose", SPEC);
  const observations: PoseObservation[] = groundTruth.frames.map((frame) => ({
    kind: "pose",
    frameId: frame.frameId,
    skeletonModel: frame.pose.skeletonModel,
    landmarks: frame.pose.landmarks.slice(0, 10),
  }));
  const parts = scorePoseObservations(observations, groundTruth);
  const expectedRecall = 10 / 17;
  assert.equal(parts.landmarkRecall, Math.round((expectedRecall * 10000)) / 10000);
  assert.ok(parts.poseScore < 1 && parts.poseScore > 0.3);
});

test("scorer: scoring is deterministic across runs", () => {
  const seed = "scorer-determinism";
  const { payload, groundTruth } = generateSyntheticCapture(seed, SPEC);
  const seg = createMockSegmentationAdapter({
    id: "seg-d",
    chromaThreshold: 0.5,
    keepProbability: 0.9,
    stride: 1,
    minRegionBlocks: 3,
    confidenceBase: 0.8,
  });
  const pose = createMockPoseAdapter({ id: "pose-d", jitterAmplitude: 0.08, dropLandmarkCount: 2, visibilityFloor: 0.8 });
  const firstSeg = scoreSegmentationObservations(seg.observe(payload, seed).observations, groundTruth);
  const secondSeg = scoreSegmentationObservations(seg.observe(payload, seed).observations, groundTruth);
  assert.deepEqual(firstSeg, secondSeg);
  const firstPose = scorePoseObservations(pose.observe(payload, seed).observations, groundTruth);
  const secondPose = scorePoseObservations(pose.observe(payload, seed).observations, groundTruth);
  assert.deepEqual(firstPose, secondPose);
});

test("scorer: all composite scores and parts stay within [0, 1]", () => {
  const seed = "bounds-seed";
  const { payload, groundTruth } = generateSyntheticCapture(seed, SPEC);
  const seg = createMockSegmentationAdapter({
    id: "seg-b",
    chromaThreshold: 0.4,
    keepProbability: 0.5,
    stride: 1,
    minRegionBlocks: 2,
    confidenceBase: 0.5,
  });
  const pose = createMockPoseAdapter({ id: "pose-b", jitterAmplitude: 0.2, dropLandmarkCount: 4, visibilityFloor: 0.5 });
  const segParts = scoreSegmentationObservations(seg.observe(payload, seed).observations, groundTruth);
  const poseParts = scorePoseObservations(pose.observe(payload, seed).observations, groundTruth);
  for (const value of [segParts.personIoU, segParts.propIoU, segParts.regionCountAccuracy, segParts.segmentationScore]) {
    assert.ok(value >= 0 && value <= 1, `segmentation part out of [0,1]: ${value}`);
  }
  for (const value of [poseParts.positionalQuality, poseParts.landmarkRecall, poseParts.poseScore]) {
    assert.ok(value >= 0 && value <= 1, `pose part out of [0,1]: ${value}`);
  }
});

test("scorer: quality entries carry deficiency-class keys and bounded values", () => {
  const seed = "entries-seed";
  const { payload, groundTruth } = generateSyntheticCapture(seed, SPEC);
  const seg = createMockSegmentationAdapter({
    id: "seg-e",
    chromaThreshold: 0.55,
    keepProbability: 0.95,
    stride: 1,
    minRegionBlocks: 4,
    confidenceBase: 0.9,
  });
  const pose = createMockPoseAdapter({ id: "pose-e", jitterAmplitude: 0.04, dropLandmarkCount: 0, visibilityFloor: 0.9 });
  const segEntries = segmentationQualityEntries(scoreSegmentationObservations(seg.observe(payload, seed).observations, groundTruth));
  const poseEntries = poseQualityEntries(scorePoseObservations(pose.observe(payload, seed).observations, groundTruth));
  for (const entry of [...segEntries, ...poseEntries]) {
    assert.ok(entry.key.startsWith("capture."), `deficiency-class key: ${entry.key}`);
    assert.ok(entry.value >= 0 && entry.value <= 1, `entry value out of [0,1]: ${entry.key}=${entry.value}`);
  }
  assert.equal(segEntries.length, 4);
  assert.equal(poseEntries.length, 3);
});

test("scorer: ground-truth-only helper (no observation) is vacuously perfect on absent labels", () => {
  const specNoProp = { ...SPEC, includeProp: false };
  const { groundTruth } = generateSyntheticCapture("no-prop", specNoProp);
  const observations: SegmentationObservation[] = groundTruth.frames.map((frame) => ({
    kind: "segmentation",
    frameId: frame.frameId,
    regions: [],
  }));
  const parts = scoreSegmentationObservations(observations, groundTruth);
  assert.equal(parts.propIoU, 1, "no prop ground truth — vacuous prop IoU is 1");
});
