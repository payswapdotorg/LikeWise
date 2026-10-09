// Deterministic synthetic capture payload generator (W2C).
//
// Generates a seeded synthetic capture payload (grid of neutral block
// descriptors — never real pixels) together with the fixture-held ground
// truth (person/prop regions and neutral-skeleton joints). The payload is the
// ONLY thing handed to capture adapters; the ground truth is kept by the
// fixture and used by the scorer. All values derive from the seed via the
// deterministic rng (docs/you/FIXTURES.md laws: no clock, no Math.random, no
// network; stable ordering; same seed => byte-identical output).

import { canonicalJson, fnv1a32, roundTo } from "../determinism.js";
import { createDeterministicRng } from "./deterministicRng.js";
import {
  NEUTRAL_SKELETON,
  NEUTRAL_SKELETON_MODEL,
  type NeutralBlock,
  type NeutralCaptureFrame,
  type NeutralCaptureModality,
  type NeutralCapturePayload,
  type PoseLandmark,
} from "./captureAdapterSeam.js";

// Feature ranges per ground-truth label (observable synthetic features).
const PERSON_CHROMA_RANGE: readonly [number, number] = [0.72, 0.84];
const PROP_CHROMA_RANGE: readonly [number, number] = [0.56, 0.64];
const BACKGROUND_CHROMA_RANGE: readonly [number, number] = [0.12, 0.22];
const PERSON_LUMA_RANGE: readonly [number, number] = [0.5, 0.7];
const PROP_LUMA_RANGE: readonly [number, number] = [0.45, 0.65];
const BACKGROUND_LUMA_RANGE: readonly [number, number] = [0.2, 0.4];
const PERSON_DEPTH_RANGE: readonly [number, number] = [0.3, 0.36];
const PROP_DEPTH_RANGE: readonly [number, number] = [0.48, 0.58];
const BACKGROUND_DEPTH_RANGE: readonly [number, number] = [0.75, 0.85];

/** Max seeded jitter added to structural joint anchors (normalized units). */
const GROUND_TRUTH_JOINT_JITTER = 0.015;

export interface GroundTruthRegion {
  readonly regionId: string;
  readonly label: "person" | "prop" | "background";
  /** Sorted block ids covered by the region. */
  readonly blockIds: readonly string[];
  readonly areaRatio: number;
  readonly boundingBox: readonly [number, number, number, number];
}

export interface GroundTruthFrame {
  readonly frameId: string;
  readonly regions: readonly GroundTruthRegion[];
  readonly pose: {
    readonly skeletonModel: string;
    readonly landmarks: readonly PoseLandmark[];
  };
}

export interface CaptureGroundTruth {
  readonly payloadId: string;
  readonly frames: readonly GroundTruthFrame[];
}

export interface SyntheticCaptureSpec {
  readonly frames: number;
  readonly width: number;
  readonly height: number;
  readonly modality: NeutralCaptureModality;
  readonly includeProp: boolean;
}

export interface SyntheticCaptureFixture {
  readonly payload: NeutralCapturePayload;
  readonly groundTruth: CaptureGroundTruth;
}

/** Generate a deterministic synthetic capture payload + ground truth. */
export function generateSyntheticCapture(seed: string, spec: SyntheticCaptureSpec): SyntheticCaptureFixture {
  const rng = createDeterministicRng(`payload|${seed}`);
  const frames: NeutralCaptureFrame[] = [];
  const truthFrames: GroundTruthFrame[] = [];
  for (let index = 0; index < spec.frames; index++) {
    const frameId = `f-${String(index).padStart(3, "0")}`;
    const { frame, truth } = generateFrame(rng, frameId, index, spec);
    frames.push(frame);
    truthFrames.push(truth);
  }
  const payloadWithoutId = { modality: spec.modality, simulated: true as const, frames };
  const payloadId = fnv1a32(canonicalJson(payloadWithoutId));
  const payload: NeutralCapturePayload = { payloadId, ...payloadWithoutId };
  const groundTruth: CaptureGroundTruth = { payloadId, frames: truthFrames };
  return { payload, groundTruth };
}

function generateFrame(
  rng: ReturnType<typeof createDeterministicRng>,
  frameId: string,
  index: number,
  spec: SyntheticCaptureSpec,
): { frame: NeutralCaptureFrame; truth: GroundTruthFrame } {
  const { width, height } = spec;
  // Person blob: a seeded ellipse inside the frame.
  const cx = 0.3 + rng.next() * 0.4;
  const cy = 0.34 + rng.next() * 0.32;
  const rx = 0.08 + rng.next() * 0.08;
  const ry = 0.16 + rng.next() * 0.12;
  // Prop: a seeded rectangle placed on the opposite horizontal half.
  const propRight = cx < 0.5;
  const propX0 = propRight ? 0.6 + rng.next() * 0.2 : 0.08 + rng.next() * 0.2;
  const propY0 = 0.25 + rng.next() * 0.3;
  const propW = 0.12 + rng.next() * 0.08;
  const propH = 0.15 + rng.next() * 0.15;

  const blocks: NeutralBlock[] = [];
  const personIds: string[] = [];
  const propIds: string[] = [];
  const backgroundIds: string[] = [];
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const nx = (gx + 0.5) / width;
      const ny = (gy + 0.5) / height;
      const blockId = `b-${String(gy).padStart(3, "0")}-${String(gx).padStart(3, "0")}`;
      const inPerson = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2 <= 1;
      const inProp = spec.includeProp && nx >= propX0 && nx <= propX0 + propW && ny >= propY0 && ny <= propY0 + propH;
      let chroma: number;
      let luminance: number;
      let depth: number;
      if (inPerson) {
        chroma = range(rng, PERSON_CHROMA_RANGE);
        luminance = range(rng, PERSON_LUMA_RANGE);
        depth = range(rng, PERSON_DEPTH_RANGE);
        personIds.push(blockId);
      } else if (inProp) {
        chroma = range(rng, PROP_CHROMA_RANGE);
        luminance = range(rng, PROP_LUMA_RANGE);
        depth = range(rng, PROP_DEPTH_RANGE);
        propIds.push(blockId);
      } else {
        chroma = range(rng, BACKGROUND_CHROMA_RANGE);
        luminance = range(rng, BACKGROUND_LUMA_RANGE);
        depth = range(rng, BACKGROUND_DEPTH_RANGE);
        backgroundIds.push(blockId);
      }
      blocks.push({ blockId, gx, gy, chroma: roundTo(chroma, 6), luminance: roundTo(luminance, 6), depth: roundTo(depth, 6) });
    }
  }
  const frame: NeutralCaptureFrame = { frameId, index, width, height, blocks };

  const personRegion = buildRegion("person", personIds, width, height);
  if (personRegion === null) {
    throw new Error(`synthetic payload invariant violated: empty person region in ${frameId} (seeded ellipse too small)`);
  }
  const propRegion = spec.includeProp ? buildRegion("prop", propIds, width, height) : null;
  const regions = [personRegion, propRegion, buildRegion("background", backgroundIds, width, height)].filter(
    (region): region is GroundTruthRegion => region !== null,
  );
  const truth: GroundTruthFrame = {
    frameId,
    regions: regions.sort((a, b) => (a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : 0)),
    pose: {
      skeletonModel: NEUTRAL_SKELETON_MODEL,
      landmarks: groundTruthLandmarks(rng, personRegion.boundingBox),
    },
  };
  return { frame, truth };
}

/** Structural joints from the person bounding box + seeded micro-jitter. */
function groundTruthLandmarks(
  rng: ReturnType<typeof createDeterministicRng>,
  personBox: readonly [number, number, number, number],
): readonly PoseLandmark[] {
  const [x0, y0, x1, y1] = personBox;
  return NEUTRAL_SKELETON.map((joint) => {
    const jitterX = (rng.next() - 0.5) * 2 * GROUND_TRUTH_JOINT_JITTER;
    const jitterY = (rng.next() - 0.5) * 2 * GROUND_TRUTH_JOINT_JITTER;
    const x = clamp(x0 + joint.rx * (x1 - x0) + jitterX);
    const y = clamp(y0 + joint.ry * (y1 - y0) + jitterY);
    const z = clamp(joint.rz + (rng.next() - 0.5) * 0.02);
    const visibility = roundTo(0.96 + rng.next() * 0.04, 6);
    return { landmarkId: joint.landmarkId, name: joint.name, x, y, z, visibility };
  });
}

function clamp(value: number): number {
  return roundTo(Math.min(1, Math.max(0, value)), 6);
}

function range(rng: ReturnType<typeof createDeterministicRng>, bounds: readonly [number, number]): number {
  return bounds[0] + rng.next() * (bounds[1] - bounds[0]);
}

function buildRegion(
  label: GroundTruthRegion["label"],
  blockIds: readonly string[],
  width: number,
  height: number,
): GroundTruthRegion | null {
  if (blockIds.length === 0) return null;
  const sortedIds = [...blockIds].sort();
  const cells = sortedIds.map((id) => parseBlockId(id));
  const minGx = Math.min(...cells.map((cell) => cell.gx));
  const maxGx = Math.max(...cells.map((cell) => cell.gx));
  const minGy = Math.min(...cells.map((cell) => cell.gy));
  const maxGy = Math.max(...cells.map((cell) => cell.gy));
  const boundingBox = [
    roundTo(minGx / width, 6),
    roundTo(minGy / height, 6),
    roundTo((maxGx + 1) / width, 6),
    roundTo((maxGy + 1) / height, 6),
  ] as const;
  const core = { label, blockCount: sortedIds.length, boundingBox };
  return {
    regionId: fnv1a32(canonicalJson(core)),
    label,
    blockIds: sortedIds,
    areaRatio: roundTo(sortedIds.length / (width * height), 6),
    boundingBox,
  };
}

function parseBlockId(blockId: string): { gx: number; gy: number } {
  const parts = blockId.split("-");
  return { gy: Number(parts[1]), gx: Number(parts[2]) };
}
