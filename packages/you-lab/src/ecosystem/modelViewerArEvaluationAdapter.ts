// Profile-backed production-eligible ecosystem evaluation adapter (W10C).
//
// model-viewer-class AR ecosystem adapter behind the provider-neutral
// ecosystem seam. HONEST SCOPE: this is an EVALUATION adapter — a
// deterministic simulation of a model-viewer-class AR fulfillment
// pipeline's behavior through the ProviderMatrix (every requested (style ×
// export) pair served with the intended fixture-model fidelity under the
// requested breaker class — no seeded dropout, no drift, no export
// folding), NOT the real @google/model-viewer web component. Real runtime
// integration is post-W10 compute-plane work; every effort/latency/cost
// field carries an explicit not-measured (simulated) marker (truth law —
// never invented numbers, never a claim that the real component ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + verified license + maintenance recency, per
// ecosystem/ecosystemEvaluation.ts) and the factory FAILS CLOSED if
// 'model-viewer' stops deriving as the top production-eligible AR-lane
// candidate (the W6C vowpal-wabbit / W7C llama-cpp / W8C p-retry
// precedent: a registry whose derivation shifts refuses construction).
// The adapter also binds the W10C AR research lane: the matrix row it
// serves must exist and stay registry-eligible, or construction refuses.

import type { TechnologyRegistry } from "../technology/registry.js";
import { roundTo } from "../determinism.js";
import {
  aggregateEcosystemDigest,
  assertEcosystemRequestSupported,
  deriveProviderMatrix,
  encodeEcosystemFulfillment,
  intendedBreakerQualityAt,
  intendedFulfillmentFidelityAt,
  notMeasuredEcosystemEffortFields,
  type EcosystemAdapter,
  type EcosystemAdapterProfile,
  type NeutralEcosystemOutput,
  type NeutralEcosystemRequest,
  type ProviderMatrixRegistry,
} from "./providerMatrixSeam.js";
import { enforceCostLatencyBudget } from "./budgetGuardSeam.js";
import type { ProductionEligibilityLedger } from "./eligibilityLedger.js";
import {
  assessEcosystemProductionEligibility,
  deriveEcosystemCandidateProfiles,
  rankEcosystemProductionEligible,
} from "./ecosystemEvaluation.js";

const GENERATOR =
  "you-lab-model-viewer-ecosystem-evaluation-adapter/1 (simulated model-viewer-class AR fulfillment through the ProviderMatrix; the real @google/model-viewer component was never executed)";

export const MODEL_VIEWER_EVALUATION_ADAPTER_ID = "model-viewer-ar-eval";

/**
 * Simulated behavior of a model-viewer-class AR fulfillment pipeline: the
 * ecosystem gate resolves exactly, every requested (style × export) pair
 * is served with the intended fixture-model fidelity under the REQUESTED
 * breaker class (fixture arithmetic — labeled simulated, never a
 * measurement of the real component).
 */
export interface ModelViewerEcosystemAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
  /** The stage-10 ecosystem class the adapter binds (the AR lane). */
  readonly ecosystemClass: string;
}

export function createModelViewerArEvaluationAdapter(
  registry: TechnologyRegistry,
): EcosystemAdapter & { readonly facts: ModelViewerEcosystemAdapterFacts } {
  const technology = registry.byId("model-viewer");
  if (!technology) {
    throw new Error("model-viewer-ar-eval: technology 'model-viewer' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveEcosystemCandidateProfiles(registry);
  const modelViewerProfile = candidateProfiles.find((profile) => profile.technologyId === "model-viewer");
  if (!modelViewerProfile) {
    throw new Error("model-viewer-ar-eval: 'model-viewer' is not a derived stage-10 ecosystem candidate (truth law — refusing to construct)");
  }
  if (modelViewerProfile.ecosystemClass !== "ar") {
    throw new Error(
      `model-viewer-ar-eval: 'model-viewer' no longer derives in the ar ecosystem class (got '${modelViewerProfile.ecosystemClass}') — refusing to construct (truth law)`,
    );
  }
  const ranked = rankEcosystemProductionEligible(
    assessEcosystemProductionEligibility(candidateProfiles, registry),
    "ar",
  );
  const top = ranked[0];
  if (!top || top.technologyId !== "model-viewer" || !top.eligible) {
    throw new Error(
      `model-viewer-ar-eval: 'model-viewer' no longer derives as the top production-eligible ar-lane ecosystem candidate (top: ${top?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  // The adapter binds the matrix row too: the derivation must carry the
  // eligible model-viewer row the gate resolves against.
  const matrix = deriveProviderMatrix(registry);
  const row = matrix.resolve("model-viewer", "global");
  if (!row || !row.eligible) {
    throw new Error(
      "model-viewer-ar-eval: the ProviderMatrix carries no registry-eligible 'model-viewer' row in region 'global' — refusing to construct (the ECOSYSTEM GATE LAW binds the adapter to a gated row)",
    );
  }
  const profile: EcosystemAdapterProfile = {
    id: MODEL_VIEWER_EVALUATION_ADAPTER_ID,
    technologyId: "model-viewer",
    servedRegions: ["global"],
    servedStyles: ["photoreal", "anime-stylized", "illustrated"],
    servedExports: ["glb", "usdz-ar-quick-look", "webxr-ar-scene"],
    adapterKind: "evaluation",
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the request (seeded derivations only); the real model-viewer web component restores determinism only for fixed scenes and fixed browser runtime (engineering assessment)",
    productionEligible: true,
    eligibilityBasis: top.basis,
  };
  const facts: ModelViewerEcosystemAdapterFacts = {
    eligibilityBasis: top.basis,
    maintenanceAgeDays: top.maintenanceAgeDays,
    ecosystemClass: modelViewerProfile.ecosystemClass,
  };
  return {
    profile,
    facts,
    fulfill(request: NeutralEcosystemRequest, requestMatrix: ProviderMatrixRegistry, ledger: ProductionEligibilityLedger): NeutralEcosystemOutput {
      const entry = assertEcosystemRequestSupported(profile, request, requestMatrix, ledger);
      const payloads: Record<string, Record<string, unknown>> = {};
      const servedStyles: string[] = [];
      const servedExports: string[] = [];
      // A styles-only request (no export refs) serves one "no-export"
      // fulfillment pair per style (the uniform (style × export) surface).
      const effectiveExportRefs = request.exportRefs.length > 0 ? request.exportRefs : [""];
      for (const styleRef of request.styleRefs) {
        for (const exportRef of effectiveExportRefs) {
          const quality = intendedBreakerQualityAt(entry.providerKind, request.budget.breakerClass);
          const fidelity = roundTo(intendedFulfillmentFidelityAt(entry.providerKind, styleRef, exportRef) * quality, 4);
          payloads[`${styleRef}|${exportRef}`] = encodeEcosystemFulfillment(entry, request, styleRef, exportRef, request.budget.breakerClass, fidelity);
          if (!servedStyles.includes(styleRef)) servedStyles.push(styleRef);
          if (!servedExports.includes(exportRef)) servedExports.push(exportRef);
        }
      }
      const budgetDecision = enforceCostLatencyBudget(request.budget, request.declaredCostUnits, request.declaredLatencyS, {
        requestId: request.requestId,
        scope: request.budget.scope,
        submittedAt: request.submittedAt,
      });
      return {
        adapterId: MODEL_VIEWER_EVALUATION_ADAPTER_ID,
        requestId: request.requestId,
        matrixEntryId: entry.id,
        servedStyles: [...servedStyles].sort(),
        servedExports: [...servedExports].sort(),
        budgetDecision,
        payloads,
        resultContentHash: aggregateEcosystemDigest(payloads, request.budget.breakerClass),
        warnings: [],
        effort: notMeasuredEcosystemEffortFields(),
        simulated: true,
      };
    },
  };
}

/** Generator label for provenance wiring (honest simulated scope). */
export function modelViewerEvaluationGenerator(): string {
  return GENERATOR;
}
