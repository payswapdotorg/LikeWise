// Deterministic reconstruction-evidence derivation (W3C).
//
// Derives resolved synthetic evidence descriptors for the reconstruction
// adapter seam from the W2C synthetic capture machinery: the seeded capture
// payload (payloadId + blocks) is generated exactly as in W2C, its observable
// person-coverage/depth features are summarized from the ground truth, and
// the evidence content hash binds the descriptor to the synthetic payload
// bytes (sha-256 of the canonical payload JSON). Deterministic pure function
// of (seed, spec) — no clock, no randomness, no network (FIXTURES.md laws).
// Truth law: evidence stays synthetic; nothing here claims real capture.

import { canonicalJson } from "../determinism.js";
import { fnv1a32, roundTo } from "../determinism.js";
import { generateSyntheticCapture, type SyntheticCaptureSpec } from "../capture/syntheticPayload.js";
import {
  sha256Hex,
  type NeutralReconstructionEvidence,
} from "./reconstructionAdapterSeam.js";

export interface SyntheticReconstructionEvidenceSpec {
  /** The W2C synthetic capture payload spec (seeded machinery, verbatim). */
  readonly capture: SyntheticCaptureSpec;
  /** Synthetic multi-view count observed for this evidence (>= capture.frames). */
  readonly viewCount: number;
  /** Additional seeded captures bound as extra evidence (the fixture seed itself is always bound first). */
  readonly extraEvidenceSeeds?: readonly string[];
}

export interface ReconstructionEvidenceFixture {
  /** Sorted evidence descriptors (one per bound capture). */
  readonly evidence: readonly NeutralReconstructionEvidence[];
}

/** Generate the deterministic resolved-evidence set for (seed, spec). */
export function deriveReconstructionEvidence(
  seed: string,
  spec: SyntheticReconstructionEvidenceSpec,
): ReconstructionEvidenceFixture {
  const seeds = [seed, ...(spec.extraEvidenceSeeds ?? [])];
  const evidence = seeds.map((captureSeed) => deriveOne(captureSeed, spec));
  return {
    evidence: evidence.sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0)),
  };
}

function deriveOne(captureSeed: string, spec: SyntheticReconstructionEvidenceSpec): NeutralReconstructionEvidence {
  const { payload, groundTruth } = generateSyntheticCapture(captureSeed, spec.capture);
  // Observable person features from the fixture-held ground truth regions.
  const personAreaRatios: number[] = [];
  const personDepthMeans: number[] = [];
  for (const frame of groundTruth.frames) {
    const personRegion = frame.regions.find((region) => region.label === "person");
    if (!personRegion) continue;
    personAreaRatios.push(personRegion.areaRatio);
    const framePayload = payload.frames.find((entry) => entry.frameId === frame.frameId);
    if (!framePayload) continue;
    const personIds = new Set(personRegion.blockIds);
    const personBlocks = framePayload.blocks.filter((block) => personIds.has(block.blockId));
    if (personBlocks.length === 0) continue;
    personDepthMeans.push(personBlocks.reduce((sum, block) => sum + block.depth, 0) / personBlocks.length);
  }
  const personCoverage = meanOr(personAreaRatios, 0);
  const personDepthMean = meanOr(personDepthMeans, 1);
  return {
    evidenceId: `ev-recon-${fnv1a32(captureSeed)}`,
    contentHash: sha256Hex(canonicalJson(payload)),
    modality: payload.modality,
    frames: payload.frames.length,
    width: spec.capture.width,
    height: spec.capture.height,
    personCoverage: roundTo(personCoverage, 6),
    depthCoverage: roundTo(1 - personDepthMean, 6),
    viewCount: spec.viewCount,
  };
}

function meanOr(values: readonly number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
