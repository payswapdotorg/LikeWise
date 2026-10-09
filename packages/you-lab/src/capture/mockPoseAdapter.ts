// Deterministic mock pose adapter (W2C).
//
// Implements the provider-neutral CaptureAdapter seam for pose estimation: a
// pure function of (payload, seed). The adapter first localizes the person
// blob from observable chroma (threshold), reconstructs neutral-skeleton
// landmarks from the blob's structural geometry, and degrades them with
// seeded jitter + optional deterministic landmark dropout + visibility
// attenuation. It is an explicit SIMULATION of a pose provider (labeled
// `simulated: true`); configuration parameters are fixture inputs, NOT
// assessments of any real technology. No clock, no Math.random, no network.

import { roundTo, sortedUnique } from "../determinism.js";
import { unitFrom } from "./deterministicRng.js";
import {
  clamp01,
  NEUTRAL_SKELETON,
  NEUTRAL_SKELETON_MODEL,
  type CaptureAdapter,
  type CaptureAdapterProfile,
  type NeutralCapturePayload,
  type PoseLandmark,
  type PoseObservation,
} from "./captureAdapterSeam.js";

const GENERATOR = "you-lab-mock-pose-adapter/1";

/** Chroma above which a block counts toward the person blob (neutral rule). */
const PERSON_BLOB_CHROMA_THRESHOLD = 0.7;

export interface MockPoseConfig {
  /** Stable adapter id, e.g. "mock-pose-full". */
  readonly id: string;
  /** Per-landmark seeded jitter amplitude in normalized units (0 = clean). */
  readonly jitterAmplitude: number;
  /** Number of landmarks deterministically dropped (highest landmark ids). */
  readonly dropLandmarkCount: number;
  /** Visibility floor: predicted visibility never drops below this. */
  readonly visibilityFloor: number;
}

export function createMockPoseAdapter(config: MockPoseConfig): CaptureAdapter<PoseObservation> {
  const profile: CaptureAdapterProfile = {
    id: config.id,
    technologyId: null,
    capabilities: ["pose-estimation"],
    supportedModalities: ["image", "video", "depth"],
    runtimeClass: "local-cpu",
    deterministic: true,
    determinismNote: "pure function of (payload, seed); seeded mulberry32 derivations only",
  };
  return {
    profile,
    observationKind: "pose",
    observe(payload: NeutralCapturePayload, seed: string) {
      const observations: PoseObservation[] = [];
      const warnings: string[] = [];
      for (const frame of payload.frames) {
        const personBlocks = frame.blocks.filter((block) => block.chroma >= PERSON_BLOB_CHROMA_THRESHOLD);
        if (personBlocks.length === 0) {
          warnings.push(`${frame.frameId}: no person blob detected — empty pose`);
          observations.push({ kind: "pose", frameId: frame.frameId, skeletonModel: NEUTRAL_SKELETON_MODEL, landmarks: [] });
          continue;
        }
        const x0 = Math.min(...personBlocks.map((block) => block.gx)) / frame.width;
        const x1 = (Math.max(...personBlocks.map((block) => block.gx)) + 1) / frame.width;
        const y0 = Math.min(...personBlocks.map((block) => block.gy)) / frame.height;
        const y1 = (Math.max(...personBlocks.map((block) => block.gy)) + 1) / frame.height;
        const landmarks: PoseLandmark[] = [];
        for (const joint of NEUTRAL_SKELETON) {
          if (joint.landmarkId >= NEUTRAL_SKELETON.length - config.dropLandmarkCount) {
            warnings.push(`${frame.frameId}: landmark ${joint.landmarkId} (${joint.name}) dropped`);
            continue;
          }
          const baseX = x0 + joint.rx * (x1 - x0);
          const baseY = y0 + joint.ry * (y1 - y0);
          const jitterX = (unitFrom(seed, payload.payloadId, frame.frameId, `lm-${joint.landmarkId}`, "x") - 0.5) * 2 * config.jitterAmplitude;
          const jitterY = (unitFrom(seed, payload.payloadId, frame.frameId, `lm-${joint.landmarkId}`, "y") - 0.5) * 2 * config.jitterAmplitude;
          const jitterZ = (unitFrom(seed, payload.payloadId, frame.frameId, `lm-${joint.landmarkId}`, "z") - 0.5) * 0.02;
          const visibilityPenalty = config.jitterAmplitude * unitFrom(seed, payload.payloadId, frame.frameId, `lm-${joint.landmarkId}`, "v");
          landmarks.push({
            landmarkId: joint.landmarkId,
            name: joint.name,
            x: clamp01(roundTo(baseX + jitterX, 6)),
            y: clamp01(roundTo(baseY + jitterY, 6)),
            z: clamp01(roundTo(joint.rz + jitterZ, 6)),
            visibility: clamp01(roundTo(Math.max(config.visibilityFloor, 1 - visibilityPenalty), 6)),
          });
        }
        observations.push({
          kind: "pose",
          frameId: frame.frameId,
          skeletonModel: NEUTRAL_SKELETON_MODEL,
          landmarks,
        });
      }
      return {
        adapterId: config.id,
        payloadId: payload.payloadId,
        observations,
        warnings: sortedUnique(warnings),
        simulated: true,
      };
    },
  };
}

/** Generator label for provenance wiring (never a real-provider claim). */
export function mockPoseGenerator(): string {
  return GENERATOR;
}
