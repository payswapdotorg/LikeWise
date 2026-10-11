// Deterministic mock reconstruction adapter (W3C).
//
// Implements the provider-neutral ReconstructionAdapter seam as an explicit
// SIMULATION of a reconstruction provider: a pure function of the request.
// Per target domain it synthesizes seed-derived payload bytes (content
// addressed by sha-256), computes a deterministic confidence from its
// configuration plus the observable evidence features, and applies seeded
// per-domain dropout. Its configuration parameters are fixture inputs
// exercising the seam — NOT assessments of any real reconstruction
// technology (truth law; labeled `simulated: true`). No clock, no
// Math.random, no network.

import { sortedUnique } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import {
  assertRequestSupported,
  clampConfidence,
  isSha256Hex,
  neutralDomainBlockId,
  neutralDomainContentRef,
  NEUTRAL_RECONSTRUCTION_SUPPORT,
  notMeasuredEffortFields,
  sha256Hex,
  synthesizeNeutralDomainBytes,
  type NeutralDomainBlock,
  type NeutralHtirDomain,
  type NeutralReconstructionMethod,
  type NeutralReconstructionRequest,
  type ReconstructionAdapter,
  type ReconstructionAdapterProfile,
  type ReconstructionOutput,
} from "./reconstructionAdapterSeam.js";

const GENERATOR = "you-lab-mock-reconstruction-adapter/1";

export interface MockReconstructionConfig {
  /** Stable adapter id, e.g. "mock-recon-geometry-precise". */
  readonly id: string;
  /** The method family this mock simulates. */
  readonly method: NeutralReconstructionMethod;
  /** Base confidence at zero observable evidence quality. */
  readonly confidenceBase: number;
  /** How strongly observable evidence quality lifts confidence (0..1). */
  readonly evidenceSensitivity: number;
  /** Per-domain seeded dropout probability in [0, 1]. */
  readonly domainDropoutRate: number;
  /** Seeded per-domain confidence micro-jitter amplitude (0..1). */
  readonly confidenceJitter: number;
}

export function createMockReconstructionAdapter(config: MockReconstructionConfig): ReconstructionAdapter {
  const profile: ReconstructionAdapterProfile = {
    id: config.id,
    technologyId: null,
    methods: [config.method],
    supportedDomains: NEUTRAL_RECONSTRUCTION_SUPPORT[config.method] ?? [],
    runtimeClass: "local-cpu",
    deterministic: true,
    determinismNote: "pure function of the request; seeded mulberry32/hash derivations only",
    productionEligible: null,
    eligibilityBasis: "pure mock (technologyId: null) — fixture input, never a technology assessment",
  };
  return {
    profile,
    reconstruct(request: NeutralReconstructionRequest): ReconstructionOutput {
      assertRequestSupported(profile, request);
      const warnings: string[] = [];
      const blocks: NeutralDomainBlock[] = [];
      for (const domain of [...request.targetDomains].sort()) {
        if (unitFrom(config.id, request.requestId, domain) < config.domainDropoutRate) {
          warnings.push(`${domain}: seeded dropout — domain block not produced`);
          continue;
        }
        blocks.push(buildBlock(config, request, domain));
      }
      return {
        adapterId: config.id,
        requestId: request.requestId,
        status: "completed",
        failureReason: null,
        producedBlocks: blocks,
        warnings: sortedUnique(warnings),
        effort: notMeasuredEffortFields(),
        simulated: true,
      };
    },
  };
}

function buildBlock(
  config: MockReconstructionConfig,
  request: NeutralReconstructionRequest,
  domain: NeutralHtirDomain,
): NeutralDomainBlock {
  const payload = synthesizeNeutralDomainBytes(config.id, request.requestId, domain);
  const contentHash = sha256Hex(payload);
  const lift = evidenceLift(request);
  const jitter = (unitFrom("confidence", config.id, request.requestId, domain) - 0.5) * 2 * config.confidenceJitter;
  const confidence = clampConfidence(config.confidenceBase + config.evidenceSensitivity * lift + jitter);
  return {
    blockId: neutralDomainBlockId(config.id, request.requestId, domain),
    domain,
    contentRef: neutralDomainContentRef(config.id, request.requestId, domain),
    contentHash,
    confidence,
    simulated: true,
    generator: GENERATOR,
    payload,
  };
}

/**
 * Observable evidence quality lift in [0, 1]: view coverage, person coverage
 * and depth clarity, equally weighted across bound evidence (deterministic
 * arithmetic over the descriptors; never a scientific claim).
 */
function evidenceLift(request: NeutralReconstructionRequest): number {
  if (request.evidence.length === 0) return 0;
  let sum = 0;
  for (const item of request.evidence) {
    const viewFactor = Math.min(1, item.viewCount / 8);
    const coverageFactor = Math.min(1, item.personCoverage / 0.15);
    sum += 0.5 * viewFactor + 0.3 * coverageFactor + 0.2 * item.depthCoverage;
  }
  return sum / request.evidence.length;
}

/** Generator label for provenance wiring (never a real-provider claim). */
export function mockReconstructionGenerator(): string {
  return GENERATOR;
}

/** Re-exported for convenience in tests asserting hash well-formedness. */
export { isSha256Hex };
