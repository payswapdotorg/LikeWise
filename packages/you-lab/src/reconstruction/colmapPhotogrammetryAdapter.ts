// Profile-backed production-eligible reconstruction evaluation adapter (W3C).
//
// COLMAP-backed adapter behind the provider-neutral ReconstructionAdapter
// seam. HONEST SCOPE: this is an EVALUATION adapter — a deterministic
// simulation of classic-photogrammetry behavior over synthetic evidence
// (multi-view coverage driven), NOT the real COLMAP runtime. Real runtime
// integration is W4+ compute-plane work; every effort/latency/cost field
// carries an explicit not-measured (simulated) marker (truth law — never
// invented numbers, never a claim that the real tool ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + maintenance recency, per
// reconstruction/reconstructionEvaluation.ts) and the factory FAILS CLOSED
// if COLMAP stops deriving as the top eligible candidate.

import { sortedUnique } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  assertRequestSupported,
  clampConfidence,
  neutralDomainBlockId,
  neutralDomainContentRef,
  NEUTRAL_RECONSTRUCTION_SUPPORT,
  notMeasuredEffortFields,
  sha256Hex,
  synthesizeNeutralDomainBytes,
  type NeutralDomainBlock,
  type NeutralHtirDomain,
  type NeutralReconstructionRequest,
  type ReconstructionAdapter,
  type ReconstructionAdapterProfile,
  type ReconstructionOutput,
} from "./reconstructionAdapterSeam.js";
import {
  assessProductionEligibility,
  deriveReconstructionCandidateProfiles,
  rankProductionEligible,
} from "./reconstructionEvaluation.js";

const GENERATOR = "you-lab-colmap-evaluation-adapter/1 (simulated classic-photogrammetry behavior; real COLMAP not executed)";
const ADAPTER_ID = "colmap-photogrammetry-eval";

export interface ColmapAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
}

export function createColmapPhotogrammetryAdapter(
  registry: TechnologyRegistry,
): ReconstructionAdapter & { readonly facts: ColmapAdapterFacts } {
  const technology = registry.byId("colmap");
  if (!technology) {
    throw new Error("colmap-photogrammetry-eval: technology 'colmap' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveReconstructionCandidateProfiles(registry);
  const colmapProfile = candidateProfiles.find((profile) => profile.technologyId === "colmap");
  if (!colmapProfile) {
    throw new Error("colmap-photogrammetry-eval: 'colmap' is not a derived reconstruction candidate (truth law — refusing to construct)");
  }
  const ranked = rankProductionEligible(assessProductionEligibility(candidateProfiles, registry));
  const top = ranked[0];
  if (!top || top.technologyId !== "colmap") {
    throw new Error(
      `colmap-photogrammetry-eval: 'colmap' no longer derives as the top production-eligible candidate (top: ${top?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  const profile: ReconstructionAdapterProfile = {
    id: ADAPTER_ID,
    technologyId: "colmap",
    methods: ["explicit-geometry"],
    supportedDomains: NEUTRAL_RECONSTRUCTION_SUPPORT["explicit-geometry"] ?? [],
    runtimeClass: "local-gpu",
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the request (seeded derivations only); the real COLMAP runtime is multi-threaded SfM/MVS and not guaranteed bit-reproducible (engineering assessment)",
    productionEligible: true,
    eligibilityBasis: top.basis,
  };
  const facts: ColmapAdapterFacts = {
    eligibilityBasis: top.basis,
    maintenanceAgeDays: top.maintenanceAgeDays,
  };
  return {
    profile,
    facts,
    reconstruct(request: NeutralReconstructionRequest): ReconstructionOutput {
      assertRequestSupported(profile, request);
      const blocks = [...request.targetDomains]
        .sort()
        .map((domain) => buildBlock(request, domain));
      return {
        adapterId: ADAPTER_ID,
        requestId: request.requestId,
        status: "completed",
        failureReason: null,
        producedBlocks: blocks,
        warnings: sortedUnique([]),
        effort: notMeasuredEffortFields(),
        simulated: true,
      };
    },
  };
}

/**
 * Simulated classic-photogrammetry confidence: strongly multi-view driven
 * (view-starved input -> clearly weaker geometry), lifted by person coverage
 * and depth clarity. Deterministic fixture arithmetic over the evidence
 * descriptors — labeled simulated, never a measurement of real COLMAP.
 */
function photogrammetryConfidence(request: NeutralReconstructionRequest): number {
  if (request.evidence.length === 0) return 0;
  let sum = 0;
  for (const item of request.evidence) {
    const viewFactor = Math.min(1, item.viewCount / 8);
    const coverageFactor = Math.min(1, item.personCoverage / 0.15);
    sum += 0.3 + 0.48 * viewFactor + 0.12 * coverageFactor + 0.06 * item.depthCoverage;
  }
  return clampConfidence(sum / request.evidence.length);
}

function buildBlock(request: NeutralReconstructionRequest, domain: NeutralHtirDomain): NeutralDomainBlock {
  const payload = synthesizeNeutralDomainBytes(ADAPTER_ID, request.requestId, domain);
  return {
    blockId: neutralDomainBlockId(ADAPTER_ID, request.requestId, domain),
    domain,
    contentRef: neutralDomainContentRef(ADAPTER_ID, request.requestId, domain),
    contentHash: sha256Hex(payload),
    confidence: photogrammetryConfidence(request),
    simulated: true,
    generator: GENERATOR,
    payload,
  };
}

/** Adapter id constant (stable, benchmark-referenced). */
export const COLMAP_EVALUATION_ADAPTER_ID = ADAPTER_ID;

/** Generator label for provenance wiring (never a real-provider claim). */
export function colmapEvaluationGenerator(): string {
  return GENERATOR;
}
