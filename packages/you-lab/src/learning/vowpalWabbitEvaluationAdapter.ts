// Profile-backed production-eligible learning evaluation adapter (W6C).
//
// Vowpal Wabbit-class online-learning adapter behind the provider-neutral
// learning seam. HONEST SCOPE: this is an EVALUATION adapter — a
// deterministic simulation of a Vowpal Wabbit-class online learner's
// takeover-learning behavior (the seam's bandit/selection class; every
// evidence ref ingested exactly once, learned values recovered exactly,
// learning domains preserved), NOT the real Vowpal Wabbit runtime. Real
// runtime integration is W7+ compute-plane work; every effort/latency/cost
// field carries an explicit not-measured (simulated) marker (truth law —
// never invented numbers, never a claim that the real learner ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + maintenance recency, per
// learning/learnerEvaluation.ts) and the factory FAILS CLOSED if
// 'vowpal-wabbit' stops deriving as the top eligible candidate.

import { canonicalJson, roundTo } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import {
  assertLearningRequestSupported,
  encodeLearningPayload,
  intendedLearningKeyAt,
  intendedLearningValueAt,
  neutralLearningCandidateId,
  neutralLearningContentRef,
  notMeasuredLearningEffortFields,
  sha256Hex,
  type LearnedContentEntry,
  type LearningAdapter,
  type LearningAdapterProfile,
  type NeutralLearningCandidate,
  type NeutralLearningOutput,
  type NeutralLearningRequest,
} from "./learningAdapterSeam.js";
import { deriveLearningCapabilityProfiles, learningCapabilityById } from "./capabilityProfiles.js";
import {
  assessLearningProductionEligibility,
  deriveLearningCandidateProfiles,
  rankLearningProductionEligible,
} from "./learnerEvaluation.js";

const GENERATOR = "you-lab-vowpal-wabbit-evaluation-adapter/1 (simulated Vowpal Wabbit-class online learning behavior; real Vowpal Wabbit not executed)";
export const VOWPAL_WABBIT_EVALUATION_ADAPTER_ID = "vowpal-wabbit-learning-eval";

/**
 * Simulated degradation of a Vowpal Wabbit-class online learner: every
 * evidence ref of the invocation signal is ingested exactly once and the
 * learned values recover the canonical model exactly — no ingestion dropout
 * and no value drift in the simulated model (fixture arithmetic — labeled
 * simulated, never a measurement of the real learner).
 */
const SIMULATED_EVIDENCE_DROPOUT_RATE = 0;

export interface VowpalWabbitAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
}

export function createVowpalWabbitLearningEvaluationAdapter(
  registry: TechnologyRegistry,
): LearningAdapter & { readonly facts: VowpalWabbitAdapterFacts } {
  const technology = registry.byId("vowpal-wabbit");
  if (!technology) {
    throw new Error("vowpal-wabbit-learning-eval: technology 'vowpal-wabbit' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveLearningCandidateProfiles(registry);
  const vwProfile = candidateProfiles.find((profile) => profile.technologyId === "vowpal-wabbit");
  if (!vwProfile) {
    throw new Error("vowpal-wabbit-learning-eval: 'vowpal-wabbit' is not a derived learning candidate (truth law — refusing to construct)");
  }
  const ranked = rankLearningProductionEligible(assessLearningProductionEligibility(candidateProfiles, registry));
  const top = ranked[0];
  if (!top || top.technologyId !== "vowpal-wabbit") {
    throw new Error(
      `vowpal-wabbit-learning-eval: 'vowpal-wabbit' no longer derives as the top production-eligible candidate (top: ${top?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  const capability = learningCapabilityById(deriveLearningCapabilityProfiles(registry), "vowpal-wabbit");
  if (!capability) {
    throw new Error("vowpal-wabbit-learning-eval: 'vowpal-wabbit' capability profile missing (truth law — refusing to construct)");
  }
  const profile: LearningAdapterProfile = {
    id: VOWPAL_WABBIT_EVALUATION_ADAPTER_ID,
    technologyId: "vowpal-wabbit",
    learnerClass: "bandit-selection",
    supportedSignalKinds: capability.inputSignalKinds,
    supportedScopes: capability.supportedScopes,
    adapterKind: "evaluation",
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the request (seeded derivations only); the real Vowpal Wabbit online learner is not bit-reproducible across builds and platforms (engineering assessment)",
    productionEligible: true,
    eligibilityBasis: top.basis,
  };
  const facts: VowpalWabbitAdapterFacts = {
    eligibilityBasis: top.basis,
    maintenanceAgeDays: top.maintenanceAgeDays,
  };
  return {
    profile,
    facts,
    learn(request: NeutralLearningRequest): NeutralLearningOutput {
      assertLearningRequestSupported(profile, request);
      const entries = buildVwEntries(request);
      const candidates: NeutralLearningCandidate[] = [];
      const payloads: Record<string, Record<string, unknown>> = {};
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (!entry) continue;
        const payload = encodeLearningPayload(entry, request);
        const payloadHash = sha256Hex(canonicalJson(payload));
        const candidateId = neutralLearningCandidateId(VOWPAL_WABBIT_EVALUATION_ADAPTER_ID, request.requestId, entry.evidenceRef);
        candidates.push({
          id: candidateId,
          signalId: request.signal.id,
          status: "candidate",
          scope: request.scope,
          contentRef: neutralLearningContentRef(VOWPAL_WABBIT_EVALUATION_ADAPTER_ID, request.requestId, index),
          contentHash: payloadHash,
          rights: request.rights, // RIGHTS LAW: threaded from the injected context — never minted
          validatedAt: request.submittedAt,
          supersededById: null,
          simulated: true,
        });
        payloads[candidateId] = payload;
      }
      return {
        adapterId: VOWPAL_WABBIT_EVALUATION_ADAPTER_ID,
        requestId: request.requestId,
        candidates,
        payloads,
        learnedContentHash: sha256Hex(
          canonicalJson(entries.map((entry) => ({ key: entry.key, value: entry.value, evidenceRef: entry.evidenceRef }))),
        ),
        warnings: [],
        effort: notMeasuredLearningEffortFields(),
        simulated: true,
      };
    },
  };
}

/** VW-class simulated learned entries (exact recovery — no dropout, no drift). */
function buildVwEntries(request: NeutralLearningRequest): LearnedContentEntry[] {
  // SIMULATED_EVIDENCE_DROPOUT_RATE is 0 (a VW-class online learner ingests
  // every evidence ref exactly once) — no seeded dropout draw is performed.
  void SIMULATED_EVIDENCE_DROPOUT_RATE;
  const entries: LearnedContentEntry[] = [];
  for (let index = 0; index < request.signal.evidenceRefs.length; index++) {
    const evidenceRef = request.signal.evidenceRefs[index];
    if (!evidenceRef) continue;
    entries.push({
      key: intendedLearningKeyAt(index),
      value: roundTo(intendedLearningValueAt(evidenceRef), 4),
      evidenceRef,
    });
  }
  return entries;
}

/** Generator label for provenance wiring (honest simulated scope). */
export function vowpalWabbitEvaluationGenerator(): string {
  return GENERATOR;
}
