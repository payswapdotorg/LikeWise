// Deterministic mock segmentation adapter (W2C).
//
// Implements the provider-neutral CaptureAdapter seam for segmentation: a
// pure function of (payload, seed). "Detection" runs over the observable
// synthetic chroma feature with a configurable threshold, per-block seeded
// dropout, optional grid-stride coarsening and a minimum region size; regions
// are connected components over the surviving blocks, labeled by mean chroma.
// It is an explicit SIMULATION of a segmentation provider (labeled
// `simulated: true`); its configuration parameters are fixture inputs, NOT
// assessments of any real technology. No clock, no Math.random, no network.

import { canonicalJson, fnv1a32, roundTo, sortedUnique } from "../determinism.js";
import { unitFrom } from "./deterministicRng.js";
import {
  clamp01,
  labelForMeanChroma,
  type CaptureAdapter,
  type CaptureAdapterProfile,
  type NeutralBlock,
  type NeutralCaptureFrame,
  type NeutralCapturePayload,
  type SegmentationObservation,
  type SegmentedRegion,
} from "./captureAdapterSeam.js";

const GENERATOR = "you-lab-mock-segmentation-adapter/1";

export interface MockSegmentationConfig {
  /** Stable adapter id, e.g. "mock-seg-precise". */
  readonly id: string;
  /** Chroma threshold above which a block is detected (lower = looser). */
  readonly chromaThreshold: number;
  /** Per-block seeded keep probability in [0, 1] (dropout simulation). */
  readonly keepProbability: number;
  /** Grid stride: 2 = detection on every other row AND column (coarse). */
  readonly stride: 1 | 2;
  /** Regions with fewer detected blocks are dropped (with a warning). */
  readonly minRegionBlocks: number;
  /** Base confidence for emitted regions. */
  readonly confidenceBase: number;
}

export function createMockSegmentationAdapter(config: MockSegmentationConfig): CaptureAdapter<SegmentationObservation> {
  const profile: CaptureAdapterProfile = {
    id: config.id,
    technologyId: null,
    capabilities: ["person-segmentation", "object-segmentation"],
    supportedModalities: ["image", "video", "depth"],
    runtimeClass: "local-cpu",
    deterministic: true,
    determinismNote: "pure function of (payload, seed); seeded mulberry32 derivations only",
  };
  return {
    profile,
    observationKind: "segmentation",
    observe(payload: NeutralCapturePayload, seed: string) {
      const observations: SegmentationObservation[] = [];
      const warnings: string[] = [];
      for (const frame of payload.frames) {
        const detected = frame.blocks.filter(
          (block) =>
            block.gx % config.stride === 0 &&
            block.gy % config.stride === 0 &&
            block.chroma >= config.chromaThreshold &&
            unitFrom(seed, payload.payloadId, frame.frameId, block.blockId) < config.keepProbability,
        );
        const components = connectedComponents(frame, detected, config.stride);
        const regions: SegmentedRegion[] = [];
        for (const component of components) {
          if (component.length < config.minRegionBlocks) {
            warnings.push(`${frame.frameId}: dropped region below ${config.minRegionBlocks} blocks`);
            continue;
          }
          const region = buildRegion(frame, component, seed, payload.payloadId, config.confidenceBase);
          if (region.label !== "background") regions.push(region);
        }
        observations.push({
          kind: "segmentation",
          frameId: frame.frameId,
          regions: regions.sort((a, b) => (a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : 0)),
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

/**
 * 4-neighborhood connected components over detected blocks (id order).
 * Neighbor distance equals the grid stride, so a stride-2 (coarse) detection
 * grid connects blocks that were two cells apart in the original grid.
 */
function connectedComponents(
  frame: NeutralCaptureFrame,
  detected: readonly NeutralBlock[],
  stride: 1 | 2,
): readonly (readonly NeutralBlock[])[] {
  const byId = new Map<string, NeutralBlock>();
  for (const block of detected) byId.set(block.blockId, block);
  const visited = new Set<string>();
  const components: (readonly NeutralBlock[])[] = [];
  const ordered = [...detected].sort((a, b) => (a.blockId < b.blockId ? -1 : a.blockId > b.blockId ? 1 : 0));
  for (const start of ordered) {
    if (visited.has(start.blockId)) continue;
    const queue: NeutralBlock[] = [start];
    visited.add(start.blockId);
    const component: NeutralBlock[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);
      for (const neighbor of neighborsOf(frame, current, stride)) {
        if (byId.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(byId.get(neighbor) as NeutralBlock);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function neighborsOf(frame: NeutralCaptureFrame, block: NeutralBlock, stride: 1 | 2): readonly string[] {
  const ids: string[] = [];
  const { gx, gy } = block;
  if (gx - stride >= 0) ids.push(`b-${String(gy).padStart(3, "0")}-${String(gx - stride).padStart(3, "0")}`);
  if (gx + stride < frame.width) ids.push(`b-${String(gy).padStart(3, "0")}-${String(gx + stride).padStart(3, "0")}`);
  if (gy - stride >= 0) ids.push(`b-${String(gy - stride).padStart(3, "0")}-${String(gx).padStart(3, "0")}`);
  if (gy + stride < frame.height) ids.push(`b-${String(gy + stride).padStart(3, "0")}-${String(gx).padStart(3, "0")}`);
  return ids;
}

function buildRegion(
  frame: NeutralCaptureFrame,
  component: readonly NeutralBlock[],
  seed: string,
  payloadId: string,
  confidenceBase: number,
): SegmentedRegion {
  const sortedIds = component.map((block) => block.blockId).sort();
  const meanChroma = component.reduce((sum, block) => sum + block.chroma, 0) / component.length;
  const minGx = Math.min(...component.map((block) => block.gx));
  const maxGx = Math.max(...component.map((block) => block.gx));
  const minGy = Math.min(...component.map((block) => block.gy));
  const maxGy = Math.max(...component.map((block) => block.gy));
  const boundingBox = [
    roundTo(minGx / frame.width, 6),
    roundTo(minGy / frame.height, 6),
    roundTo((maxGx + 1) / frame.width, 6),
    roundTo((maxGy + 1) / frame.height, 6),
  ] as const;
  const label = labelForMeanChroma(roundTo(meanChroma, 6));
  const core = { label, blockCount: sortedIds.length, boundingBox, frameId: frame.frameId };
  const regionId = fnv1a32(canonicalJson(core));
  const jitter = (unitFrom(seed, payloadId, frame.frameId, regionId) - 0.5) * 0.06;
  return {
    regionId,
    label,
    areaRatio: roundTo(sortedIds.length / (frame.width * frame.height), 6),
    boundingBox,
    confidence: clamp01(confidenceBase + jitter),
    blockIds: sortedIds,
  };
}

/** Generator label for provenance wiring (never a real-provider claim). */
export function mockSegmentationGenerator(): string {
  return GENERATOR;
}
