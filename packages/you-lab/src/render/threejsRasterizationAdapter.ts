// Profile-backed production-eligible render evaluation adapter (W4C).
//
// three.js-backed adapter behind the provider-neutral RenderAdapter seam.
// HONEST SCOPE: this is an EVALUATION adapter — a deterministic simulation
// of rasterization-pipeline behavior over the consumed performance timeline
// (cue-density driven), NOT the real three.js runtime. Real runtime
// integration is W5+ compute-plane work; every effort/latency/cost field
// carries an explicit not-measured (simulated) marker (truth law — never
// invented numbers, never a claim that the real library ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + maintenance recency, per
// render/renderEvaluation.ts) and the factory FAILS CLOSED if three.js
// stops deriving as the top eligible candidate.

import { sortedUnique } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  assertRenderRequestSupported,
  clampFidelity,
  neutralRenderArtifactId,
  neutralRenderContentRef,
  NEUTRAL_RENDER_SUPPORT,
  notMeasuredRenderEffortFields,
  sha256Hex,
  synthesizeNeutralRenderBytes,
  type NeutralRenderOutputKind,
  type NeutralRenderRequest,
  type RenderAdapter,
  type RenderAdapterProfile,
  type RenderOutput,
} from "./renderAdapterSeam.js";
import {
  assessRenderProductionEligibility,
  deriveRenderCandidateProfiles,
  rankRenderProductionEligible,
} from "./renderEvaluation.js";

const GENERATOR = "you-lab-threejs-evaluation-adapter/1 (simulated rasterization behavior; real three.js not executed)";
export const THREEJS_EVALUATION_ADAPTER_ID = "threejs-rasterization-eval";

export interface ThreejsAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
}

export function createThreejsRasterizationAdapter(
  registry: TechnologyRegistry,
): RenderAdapter & { readonly facts: ThreejsAdapterFacts } {
  const technology = registry.byId("three");
  if (!technology) {
    throw new Error("threejs-rasterization-eval: technology 'three' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveRenderCandidateProfiles(registry);
  const threeProfile = candidateProfiles.find((profile) => profile.technologyId === "three");
  if (!threeProfile) {
    throw new Error("threejs-rasterization-eval: 'three' is not a derived render candidate (truth law — refusing to construct)");
  }
  const ranked = rankRenderProductionEligible(assessRenderProductionEligibility(candidateProfiles, registry));
  const top = ranked[0];
  if (!top || top.technologyId !== "three") {
    throw new Error(
      `threejs-rasterization-eval: 'three' no longer derives as the top production-eligible candidate (top: ${top?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  const profile: RenderAdapterProfile = {
    id: THREEJS_EVALUATION_ADAPTER_ID,
    technologyId: "three",
    methods: ["3d-render"],
    supportedOutputKinds: NEUTRAL_RENDER_SUPPORT["3d-render"] ?? [],
    runtimeClass: "browser-js",
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the request (seeded derivations only); the real three.js WebGL rasterizer is GPU/driver-dependent and not guaranteed bit-reproducible (engineering assessment)",
    productionEligible: true,
    eligibilityBasis: top.basis,
  };
  const facts: ThreejsAdapterFacts = {
    eligibilityBasis: top.basis,
    maintenanceAgeDays: top.maintenanceAgeDays,
  };
  return {
    profile,
    facts,
    render(request: NeutralRenderRequest): RenderOutput {
      assertRenderRequestSupported(profile, request);
      const artifacts = [...request.outputKinds]
        .sort()
        .map((kind) => buildArtifact(request, kind));
      return {
        adapterId: THREEJS_EVALUATION_ADAPTER_ID,
        requestId: request.requestId,
        status: "completed",
        failureReason: null,
        producedArtifacts: artifacts,
        warnings: sortedUnique([]),
        effort: notMeasuredRenderEffortFields(),
        simulated: true,
      };
    },
  };
}

/**
 * Simulated rasterization fidelity: richer performance material (cue
 * density, track variety, span coverage) lifts the render fidelity with a
 * high base — a rasterization pipeline consumes whatever timeline it is
 * given. Deterministic fixture arithmetic over the consumed timeline —
 * labeled simulated, never a measurement of real three.js.
 */
function rasterizationFidelity(request: NeutralRenderRequest): number {
  const { cues, durationMs } = request.timeline;
  if (cues.length === 0 || durationMs <= 0) return 0;
  const density = Math.min(1, cues.length / 9);
  const tracks = new Set(cues.map((cue) => cue.track));
  const variety = Math.min(1, tracks.size / 3);
  const lastEndMs = cues[cues.length - 1]?.endMs ?? 0;
  const coverage = Math.min(1, lastEndMs / durationMs);
  return clampFidelity(0.58 + 0.24 * density + 0.12 * variety + 0.08 * coverage);
}

function buildArtifact(request: NeutralRenderRequest, kind: NeutralRenderOutputKind) {
  const payload = synthesizeNeutralRenderBytes(THREEJS_EVALUATION_ADAPTER_ID, request.requestId, kind);
  return {
    artifactId: neutralRenderArtifactId(THREEJS_EVALUATION_ADAPTER_ID, request.requestId, kind),
    kind,
    contentRef: neutralRenderContentRef(THREEJS_EVALUATION_ADAPTER_ID, request.requestId, kind),
    contentHash: sha256Hex(payload),
    fidelity: rasterizationFidelity(request),
    simulated: true as const,
    generator: GENERATOR,
    payload,
  };
}

/** Generator label for provenance wiring (honest simulated scope). */
export function threejsEvaluationGenerator(): string {
  return GENERATOR;
}
