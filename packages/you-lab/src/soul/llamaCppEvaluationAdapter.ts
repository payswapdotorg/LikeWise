// Profile-backed production-eligible soul evaluation adapter (W7C).
//
// llama.cpp-class inference-runtime adapter behind the provider-neutral soul
// seam. HONEST SCOPE: this is an EVALUATION adapter — a deterministic
// simulation of a llama.cpp-class local inference runtime's soul-serving
// behavior (the seam's inference-runtime class; every context ref addressed
// exactly once, response values recovered exactly under the requested
// route, output modalities preserved), NOT the real llama.cpp runtime. Real
// runtime integration is W8+ compute-plane work; every effort/latency/cost
// field carries an explicit not-measured (simulated) marker (truth law —
// never invented numbers, never a claim that the real runtime ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + maintenance recency, per soul/soulEvaluation.ts)
// and the factory FAILS CLOSED if 'llama-cpp' stops deriving as the top
// binding-capable eligible candidate (the W6C vowpal-wabbit precedent).

import { canonicalJson, roundTo } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  assertSoulRequestSupported,
  encodeSoulPayload,
  intendedResponseTopicAt,
  intendedResponseValueAt,
  neutralSoulContentRef,
  neutralSoulResponseId,
  notMeasuredSoulEffortFields,
  projectedEmbodimentStateFor,
  sha256Hex,
  type NeutralSoulOutput,
  type NeutralSoulRequest,
  type NeutralSoulResponseRecord,
  type NeutralSoulRoutingProfile,
  type ResponseContentEntry,
  type SoulAdapter,
  type SoulAdapterProfile,
} from "./soulAdapterSeam.js";
import { deriveSoulCapabilityProfiles, soulCapabilityById } from "./capabilityProfiles.js";
import {
  assessSoulProductionEligibility,
  deriveSoulCandidateProfiles,
  rankSoulProductionEligible,
} from "./soulEvaluation.js";

const GENERATOR =
  "you-lab-llama-cpp-evaluation-adapter/1 (simulated llama.cpp-class inference-runtime soul serving; real llama.cpp not executed)";

export const LLAMA_CPP_EVALUATION_ADAPTER_ID = "llama-cpp-soul-eval";

/**
 * Simulated behavior of a llama.cpp-class local inference runtime: every
 * context ref of the routed prompt is addressed exactly once and the
 * response values recover the canonical route-dependent model exactly — no
 * ingestion dropout, no value drift and no modality folding in the
 * simulated model (fixture arithmetic — labeled simulated, never a
 * measurement of the real runtime).
 */
export interface LlamaCppAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
}

export function createLlamaCppSoulEvaluationAdapter(
  registry: TechnologyRegistry,
): SoulAdapter & { readonly facts: LlamaCppAdapterFacts } {
  const technology = registry.byId("llama-cpp");
  if (!technology) {
    throw new Error("llama-cpp-soul-eval: technology 'llama-cpp' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveSoulCandidateProfiles(registry);
  const llamaCppProfile = candidateProfiles.find((profile) => profile.technologyId === "llama-cpp");
  if (!llamaCppProfile) {
    throw new Error("llama-cpp-soul-eval: 'llama-cpp' is not a derived soul candidate (truth law — refusing to construct)");
  }
  if (!llamaCppProfile.bindingCapable) {
    throw new Error("llama-cpp-soul-eval: 'llama-cpp' does not derive as binding-capable (truth law — refusing to construct)");
  }
  const ranked = rankSoulProductionEligible(assessSoulProductionEligibility(candidateProfiles, registry));
  const topBindingCapable = ranked.find((assessment) => {
    const candidate = candidateProfiles.find((profile) => profile.technologyId === assessment.technologyId);
    return candidate?.bindingCapable === true;
  });
  if (!topBindingCapable || topBindingCapable.technologyId !== "llama-cpp") {
    throw new Error(
      `llama-cpp-soul-eval: 'llama-cpp' no longer derives as the top production-eligible binding-capable candidate (top: ${topBindingCapable?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  const capability = soulCapabilityById(deriveSoulCapabilityProfiles(registry), "llama-cpp");
  if (!capability) {
    throw new Error("llama-cpp-soul-eval: 'llama-cpp' capability profile missing (truth law — refusing to construct)");
  }
  const profile: SoulAdapterProfile = {
    id: LLAMA_CPP_EVALUATION_ADAPTER_ID,
    technologyId: "llama-cpp",
    soulClass: "inference-runtime",
    supportedModalities: capability.modalities,
    supportedRoutingProfiles: capability.routingProfiles,
    latencyClass: capability.latencyClasses[0] ?? "interactive",
    adapterKind: "evaluation",
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the request (seeded derivations only); the real llama.cpp runtime offers seed pinning but is not bit-stable across builds and platforms (engineering assessment)",
    productionEligible: true,
    eligibilityBasis: topBindingCapable.basis,
  };
  const facts: LlamaCppAdapterFacts = {
    eligibilityBasis: topBindingCapable.basis,
    maintenanceAgeDays: topBindingCapable.maintenanceAgeDays,
  };
  return {
    profile,
    facts,
    invoke(request: NeutralSoulRequest): NeutralSoulOutput {
      assertSoulRequestSupported(profile, request);
      const entries = buildLlamaCppEntries(request);
      const records: NeutralSoulResponseRecord[] = [];
      const payloads: Record<string, Record<string, unknown>> = {};
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (!entry) continue;
        const payload = encodeSoulPayload(entry, request, request.prompt.routingProfile);
        const payloadHash = sha256Hex(canonicalJson(payload));
        const recordId = neutralSoulResponseId(LLAMA_CPP_EVALUATION_ADAPTER_ID, request.requestId, entry.contextRef);
        records.push({
          id: recordId,
          bindingId: request.binding.id,
          requestId: request.requestId,
          routingProfile: request.prompt.routingProfile,
          modality: entry.modality,
          embodimentState: projectedEmbodimentStateFor(entry.modality),
          contentRef: neutralSoulContentRef(LLAMA_CPP_EVALUATION_ADAPTER_ID, request.requestId, index),
          contentHash: payloadHash,
          completedAt: request.submittedAt,
          simulated: true,
        });
        payloads[recordId] = payload;
      }
      return {
        adapterId: LLAMA_CPP_EVALUATION_ADAPTER_ID,
        requestId: request.requestId,
        records,
        payloads,
        responseContentHash: sha256Hex(
          canonicalJson(
            entries.map((entry) => ({
              topic: entry.topic,
              value: entry.value,
              contextRef: entry.contextRef,
              modality: entry.modality,
              route: request.prompt.routingProfile as NeutralSoulRoutingProfile,
            })),
          ),
        ),
        warnings: [],
        effort: notMeasuredSoulEffortFields(),
        simulated: true,
      };
    },
  };
}

/** llama.cpp-class simulated response entries (exact recovery under the requested route — no dropout, no drift, no folding). */
function buildLlamaCppEntries(request: NeutralSoulRequest): ResponseContentEntry[] {
  const requested = request.prompt.requestedModalities;
  const entries: ResponseContentEntry[] = [];
  for (let index = 0; index < request.prompt.contextRefs.length; index++) {
    const contextRef = request.prompt.contextRefs[index];
    if (!contextRef) continue;
    entries.push({
      topic: intendedResponseTopicAt(index),
      value: roundTo(intendedResponseValueAt(contextRef, request.prompt.routingProfile), 4),
      contextRef,
      modality: (requested[index % requested.length] ?? requested[0])!,
    });
  }
  return entries;
}

/** Generator label for provenance wiring (honest simulated scope). */
export function llamaCppEvaluationGenerator(): string {
  return GENERATOR;
}
