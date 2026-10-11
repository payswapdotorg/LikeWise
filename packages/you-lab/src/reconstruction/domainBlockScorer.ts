// Deterministic domain-block quality scorer (W3C).
//
// Scores typed reconstruction domain blocks against the fixture-held ground
// truth (requested domains; the evidence-achievable confidence ceiling).
// All arithmetic is deterministic and explicitly a FIXTURE OBJECTIVE —
// computed, not measured; not a user study and not a claim about any real
// reconstruction technology (docs/you/CONTRACTS.md error semantics,
// docs/you/LAB.md "Deterministic benchmark gates remain authoritative").

import { roundTo } from "../determinism.js";
import {
  isSha256Hex,
  sha256Hex,
  type NeutralDomainBlock,
  type NeutralHtirDomain,
  type NeutralReconstructionEvidence,
  type NeutralReconstructionMethod,
} from "./reconstructionAdapterSeam.js";

// Composite weights (fixture objective definition — authored, versioned).
export const DOMAIN_BLOCK_WEIGHTS = { domainCoverage: 0.5, confidenceFidelity: 0.3, contentAddressing: 0.2 } as const;

export const SCORER_RECONSTRUCTION_VERSION =
  "you-lab-reconstruction-domain-block-scorer/1 (deterministic fixture objective — computed, not measured)";

export interface DomainBlockQualityParts {
  /** |produced ∩ requested| / |requested| (1 when all requested domains produced). */
  readonly domainCoverage: number;
  /** 1 - |meanConfidence - achievable| (clamped at 0) — rewards tracking the evidence ceiling. */
  readonly confidenceFidelity: number;
  /** Fraction of blocks that are validly content-addressed (sha-256 hex, hash matches payload bytes, non-empty contentRef). */
  readonly contentAddressing: number;
  readonly blockQualityScore: number;
}

/**
 * Fixture ground truth: the achievable confidence ceiling for
 * (evidence, method) — deterministic arithmetic over the observable evidence
 * features; never a scientific claim. Depth clarity helps geometry more than
 * appearance; view coverage lifts every method.
 */
export function achievableConfidence(
  evidence: readonly NeutralReconstructionEvidence[],
  method: NeutralReconstructionMethod,
): number {
  if (evidence.length === 0) return 0;
  const base = method === "neural-appearance" ? 0.52 : 0.55;
  const depthWeight = method === "neural-appearance" ? 0.04 : 0.08;
  let sum = 0;
  for (const item of evidence) {
    const viewFactor = Math.min(1, item.viewCount / 8);
    const coverageFactor = Math.min(1, item.personCoverage / 0.15);
    sum += base + 0.25 * viewFactor + 0.12 * coverageFactor + depthWeight * item.depthCoverage;
  }
  return roundTo(Math.min(1, sum / evidence.length), 6);
}

/** Score produced domain blocks against the requested domains + evidence ceiling. */
export function scoreDomainBlocks(
  blocks: readonly NeutralDomainBlock[],
  requestedDomains: readonly NeutralHtirDomain[],
  evidence: readonly NeutralReconstructionEvidence[],
  method: NeutralReconstructionMethod,
): DomainBlockQualityParts {
  const requested = [...requestedDomains].sort();
  const produced = new Set(blocks.map((block) => block.domain));
  const covered = requested.filter((domain) => produced.has(domain));
  const domainCoverage = requested.length === 0 ? 0 : roundTo(covered.length / requested.length, 4);

  const achievable = achievableConfidence(evidence, method);
  const meanConfidence = blocks.length === 0 ? 0 : roundTo(blocks.reduce((sum, block) => sum + block.confidence, 0) / blocks.length, 6);
  const confidenceFidelity = roundTo(Math.max(0, 1 - Math.abs(meanConfidence - achievable)), 4);

  const valid = blocks.filter((block) => isValidlyAddressed(block));
  const contentAddressing = blocks.length === 0 ? 0 : roundTo(valid.length / blocks.length, 4);

  return {
    domainCoverage,
    confidenceFidelity,
    contentAddressing,
    blockQualityScore: roundTo(
      DOMAIN_BLOCK_WEIGHTS.domainCoverage * domainCoverage +
        DOMAIN_BLOCK_WEIGHTS.confidenceFidelity * confidenceFidelity +
        DOMAIN_BLOCK_WEIGHTS.contentAddressing * contentAddressing,
      4,
    ),
  };
}

/** A block is validly addressed when its hash is well-formed AND binds the payload bytes. */
function isValidlyAddressed(block: NeutralDomainBlock): boolean {
  if (block.contentRef.length === 0) return false;
  if (!isSha256Hex(block.contentHash)) return false;
  return sha256Hex(block.payload) === block.contentHash;
}

/** Deterministic quality entries (sorted keys, values in [0,1]) for the seam. */
export function reconstructionQualityEntries(parts: DomainBlockQualityParts): readonly { key: string; value: number }[] {
  return [
    { key: "reconstruction.blocks.confidence-fidelity", value: parts.confidenceFidelity },
    { key: "reconstruction.blocks.content-addressing", value: parts.contentAddressing },
    { key: "reconstruction.blocks.domain-coverage", value: parts.domainCoverage },
    { key: "reconstruction.blocks.score", value: parts.blockQualityScore },
  ];
}
