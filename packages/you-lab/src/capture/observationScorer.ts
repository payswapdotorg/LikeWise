// Deterministic observation-quality scorer (W2C).
//
// Scores typed capture observations against the fixture-held ground truth
// (region block sets, ground-truth joints). All arithmetic is deterministic
// and explicitly a FIXTURE OBJECTIVE — computed, not measured; not a user
// study and not a claim about any real capture technology
// (docs/you/CONTRACTS.md error semantics, docs/you/LAB.md "Deterministic
// benchmark gates remain authoritative").

import { roundTo } from "../determinism.js";
import type { SegmentationObservation, PoseLandmark, PoseObservation } from "./captureAdapterSeam.js";
import type { CaptureGroundTruth, GroundTruthFrame } from "./syntheticPayload.js";

// Composite weights (fixture objective definition — authored, versioned).
export const SEGMENTATION_WEIGHTS = { personIoU: 0.6, propIoU: 0.2, regionCountAccuracy: 0.2 } as const;
export const POSE_WEIGHTS = { positionalQuality: 0.7, landmarkRecall: 0.3 } as const;
/** Mean landmark error (normalized units) mapped to 0 quality at this magnitude. */
export const POSE_ERROR_SCALE = 4;

export const SCORER_CAPTURE_VERSION = "you-lab-capture-observation-scorer/1 (deterministic fixture objective — computed, not measured)";

export interface SegmentationQualityParts {
  readonly personIoU: number;
  readonly propIoU: number;
  readonly regionCountAccuracy: number;
  readonly segmentationScore: number;
}

export interface PoseQualityParts {
  readonly meanLandmarkError: number;
  readonly positionalQuality: number;
  readonly landmarkRecall: number;
  readonly poseScore: number;
}

/** Score segmentation observations against ground-truth regions per frame. */
export function scoreSegmentationObservations(
  observations: readonly SegmentationObservation[],
  groundTruth: CaptureGroundTruth,
): SegmentationQualityParts {
  const personIoUs: number[] = [];
  const propIoUs: number[] = [];
  const countAccuracies: number[] = [];
  for (const truthFrame of groundTruth.frames) {
    const observation = observations.find((entry) => entry.frameId === truthFrame.frameId) ?? null;
    personIoUs.push(regionIoU(truthFrame, observation, "person"));
    propIoUs.push(regionIoU(truthFrame, observation, "prop"));
    countAccuracies.push(regionCountAccuracyForFrame(truthFrame, observation));
  }
  const personIoU = mean(personIoUs);
  const propIoU = mean(propIoUs);
  const countAccuracy = mean(countAccuracies);
  return {
    personIoU,
    propIoU,
    regionCountAccuracy: countAccuracy,
    segmentationScore: roundTo(
      SEGMENTATION_WEIGHTS.personIoU * personIoU +
        SEGMENTATION_WEIGHTS.propIoU * propIoU +
        SEGMENTATION_WEIGHTS.regionCountAccuracy * countAccuracy,
      4,
    ),
  };
}

/** Score pose observations against ground-truth joints per frame. */
export function scorePoseObservations(
  observations: readonly PoseObservation[],
  groundTruth: CaptureGroundTruth,
): PoseQualityParts {
  const meanErrors: number[] = [];
  const recalls: number[] = [];
  for (const truthFrame of groundTruth.frames) {
    const observation = observations.find((entry) => entry.frameId === truthFrame.frameId) ?? null;
    const truthLandmarks = truthFrame.pose.landmarks;
    if (truthLandmarks.length === 0) continue;
    const predicted = observation?.landmarks ?? [];
    const predictedById = new Map<number, PoseLandmark>();
    for (const landmark of predicted) predictedById.set(landmark.landmarkId, landmark);
    let errorSum = 0;
    let matched = 0;
    for (const truth of truthLandmarks) {
      const prediction = predictedById.get(truth.landmarkId);
      if (!prediction) continue;
      matched += 1;
      errorSum += Math.sqrt((prediction.x - truth.x) ** 2 + (prediction.y - truth.y) ** 2 + (prediction.z - truth.z) ** 2);
    }
    const meanError = matched === 0 ? 1 : errorSum / matched;
    meanErrors.push(roundTo(meanError, 6));
    recalls.push(roundTo(matched / truthLandmarks.length, 6));
  }
  const meanLandmarkError = mean(meanErrors);
  const landmarkRecall = mean(recalls);
  const positionalQuality = roundTo(Math.max(0, 1 - POSE_ERROR_SCALE * meanLandmarkError), 4);
  return {
    meanLandmarkError,
    positionalQuality,
    landmarkRecall,
    poseScore: roundTo(POSE_WEIGHTS.positionalQuality * positionalQuality + POSE_WEIGHTS.landmarkRecall * landmarkRecall, 4),
  };
}

/** Deterministic quality entries (sorted keys, values in [0,1]) for the seam. */
export function segmentationQualityEntries(parts: SegmentationQualityParts): readonly { key: string; value: number }[] {
  return [
    { key: "capture.segmentation.person-iou", value: parts.personIoU },
    { key: "capture.segmentation.prop-iou", value: parts.propIoU },
    { key: "capture.segmentation.region-count-accuracy", value: parts.regionCountAccuracy },
    { key: "capture.segmentation.score", value: parts.segmentationScore },
  ];
}

/** Deterministic quality entries (sorted keys, values in [0,1]) for the seam. */
export function poseQualityEntries(parts: PoseQualityParts): readonly { key: string; value: number }[] {
  return [
    { key: "capture.pose.landmark-recall", value: parts.landmarkRecall },
    { key: "capture.pose.positional-quality", value: parts.positionalQuality },
    { key: "capture.pose.score", value: parts.poseScore },
  ];
}

function regionIoU(truthFrame: GroundTruthFrame, observation: SegmentationObservation | null, label: "person" | "prop"): number {
  const truthRegion = truthFrame.regions.find((region) => region.label === label);
  if (!truthRegion) return 1; // no ground truth of this label — vacuously perfect
  const truthIds = new Set(truthRegion.blockIds);
  const predictedIds = new Set<string>();
  for (const region of observation?.regions ?? []) {
    if (region.label !== label) continue;
    for (const id of region.blockIds) predictedIds.add(id);
  }
  let intersection = 0;
  for (const id of predictedIds) {
    if (truthIds.has(id)) intersection += 1;
  }
  const union = truthIds.size + predictedIds.size - intersection;
  if (union === 0) return 1;
  return roundTo(intersection / union, 4);
}

function regionCountAccuracyForFrame(
  truthFrame: GroundTruthFrame,
  observation: SegmentationObservation | null,
): number {
  const truthCount = truthFrame.regions.filter((region) => region.label !== "background").length;
  const predictedCount = (observation?.regions ?? []).filter((region) => region.label !== "background").length;
  if (truthCount === 0) return predictedCount === 0 ? 1 : 0;
  return roundTo(Math.max(0, 1 - Math.abs(predictedCount - truthCount) / truthCount), 4);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 1;
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 4);
}
