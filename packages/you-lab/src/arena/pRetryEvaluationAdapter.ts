// Profile-backed production-eligible arena evaluation adapter (W8C).
//
// p-retry-class retry-ladder adapter behind the provider-neutral arena
// seam. HONEST SCOPE: this is an EVALUATION adapter — a deterministic
// simulation of a p-retry-class bounded exponential-backoff-with-jitter
// arena client's ladder behavior (the seam's exponential-backoff-jitter
// class; run ladders follow the intended fixture model exactly — every
// failure-evidence ref addressed, exact recovery values under the requested
// backoff class, authored result types, strategy ladder honored), NOT the
// real p-retry library. Real runtime integration is W9+ compute-plane
// work; every effort/latency/cost field carries an explicit not-measured
// (simulated) marker (truth law — never invented numbers, never a claim
// that the real library ran).
//
// Production eligibility is DERIVED from registry facts at construction
// time (permissive SPDX + maintenance recency + the authored
// ladder-fit ranking, per arena/arenaEvaluation.ts) and the factory FAILS
// CLOSED if 'p-retry' stops deriving as the top production-eligible
// retry/backoff candidate (the W6C vowpal-wabbit / W7C llama-cpp
// precedent: a registry whose derivation shifts refuses construction).

import type { TechnologyRegistry } from "../technology/registry.js";
import {
  aggregateContentDigest,
  assertArenaInvocationSupported,
  encodeArenaExpertResult,
  intendedFindingFor,
  intendedRecoveryAt,
  intendedResultTypeFor,
  intendedRunStatusAt,
  intendedStrategyAt,
  neutralArenaEvidenceRef,
  neutralArenaRunId,
  notMeasuredArenaEffortFields,
  NEUTRAL_CAPABILITY_GAP_CATEGORIES,
  type ArenaAdapter,
  type ArenaAdapterProfile,
  type ArenaExpertResultEntry,
  type NeutralArenaInvocation,
  type NeutralArenaOutput,
  type NeutralArenaRunRecord,
} from "./arenaAdapterSeam.js";
import {
  assessArenaRetryProductionEligibility,
  deriveArenaRetryCandidateProfiles,
  rankArenaRetryProductionEligible,
} from "./arenaEvaluation.js";

const GENERATOR =
  "you-lab-p-retry-arena-evaluation-adapter/1 (simulated p-retry-class exponential-backoff-with-jitter arena ladder; real p-retry not executed)";

export const P_RETRY_EVALUATION_ADAPTER_ID = "p-retry-arena-eval";

/**
 * Simulated behavior of a p-retry-class bounded retry ladder: the run
 * ladder recovers the canonical intended model exactly — full
 * failure-evidence coverage, exact recovery values under the requested
 * backoff class, authored result types, strategy ladder honored (fixture
 * arithmetic — labeled simulated, never a measurement of the real
 * library).
 */
export interface PRetryArenaAdapterFacts {
  /** Registry-derived eligibility basis (cited verbatim from the assessment). */
  readonly eligibilityBasis: string;
  readonly maintenanceAgeDays: number;
  readonly backoffClass: string;
}

export function createPRetryBackoffArenaEvaluationAdapter(
  registry: TechnologyRegistry,
): ArenaAdapter & { readonly facts: PRetryArenaAdapterFacts } {
  const technology = registry.byId("p-retry");
  if (!technology) {
    throw new Error("p-retry-arena-eval: technology 'p-retry' missing from the registry (truth law — refusing to construct)");
  }
  const candidateProfiles = deriveArenaRetryCandidateProfiles(registry);
  const pRetryProfile = candidateProfiles.find((profile) => profile.technologyId === "p-retry");
  if (!pRetryProfile) {
    throw new Error("p-retry-arena-eval: 'p-retry' is not a derived retry/backoff candidate (truth law — refusing to construct)");
  }
  if (pRetryProfile.backoffClass !== "exponential-backoff-jitter") {
    throw new Error(
      `p-retry-arena-eval: 'p-retry' no longer derives in the exponential-backoff-jitter class (got '${pRetryProfile.backoffClass}') — refusing to construct (truth law)`,
    );
  }
  const ranked = rankArenaRetryProductionEligible(
    assessArenaRetryProductionEligibility(candidateProfiles, registry),
  );
  const top = ranked[0];
  if (!top || top.technologyId !== "p-retry" || !top.eligible) {
    throw new Error(
      `p-retry-arena-eval: 'p-retry' no longer derives as the top production-eligible retry/backoff candidate (top: ${top?.technologyId ?? "none"}) — refusing to construct (truth law)`,
    );
  }
  const profile: ArenaAdapterProfile = {
    id: P_RETRY_EVALUATION_ADAPTER_ID,
    technologyId: "p-retry",
    servedCapabilityClasses: ["arena-automation", ...NEUTRAL_CAPABILITY_GAP_CATEGORIES.map((category) => `gap-category:${category}`)],
    supportedCategories: [...NEUTRAL_CAPABILITY_GAP_CATEGORIES],
    adapterKind: "evaluation",
    deterministic: true,
    determinismNote:
      "the evaluation adapter is a pure function of the invocation (seeded derivations only); the real p-retry library restores determinism only for fixed ladder parameters and fixed failure timing (engineering assessment)",
    productionEligible: true,
    eligibilityBasis: top.basis,
  };
  const facts: PRetryArenaAdapterFacts = {
    eligibilityBasis: top.basis,
    maintenanceAgeDays: top.maintenanceAgeDays,
    backoffClass: pRetryProfile.backoffClass,
  };
  return {
    profile,
    facts,
    invoke(request: NeutralArenaInvocation): NeutralArenaOutput {
      assertArenaInvocationSupported(profile, request);
      const records: NeutralArenaRunRecord[] = [];
      let expertEntry: ArenaExpertResultEntry | null = null;
      let completedRecordId: string | null = null;
      for (let attempt = 1; attempt <= request.retryLadder.maxAttempts; attempt++) {
        const status = intendedRunStatusAt(request.gap.id, attempt);
        const strategy = intendedStrategyAt(request.gap.category, attempt);
        const recordId = neutralArenaRunId(P_RETRY_EVALUATION_ADAPTER_ID, request.requestId, attempt);
        records.push({
          id: recordId,
          gapId: request.gap.id,
          strategy,
          attempt,
          status,
          startedAt: request.submittedAt,
          completedAt: request.submittedAt,
          outcomeEvidenceRef: status === "completed" ? neutralArenaEvidenceRef(P_RETRY_EVALUATION_ADAPTER_ID, request.requestId, attempt) : null,
          simulated: true,
        });
        if (status === "completed") {
          expertEntry = {
            resultType: intendedResultTypeFor(request.gap.category),
            finding: intendedFindingFor(request.gap, strategy),
            recovery: intendedRecoveryAt(request.gap.id, request.retryLadder.backoffClass),
            evidenceRefs: [...request.gap.failureEvidence],
            strategy,
            attempt,
            deliveredAt: request.submittedAt,
          };
          completedRecordId = recordId;
          break;
        }
      }
      const payloads: Record<string, Record<string, unknown>> = {};
      if (expertEntry && completedRecordId !== null) {
        payloads[completedRecordId] = encodeArenaExpertResult(expertEntry, request, request.retryLadder.backoffClass);
      }
      const entryPayload = completedRecordId === null ? null : (payloads[completedRecordId] ?? null);
      return {
        adapterId: P_RETRY_EVALUATION_ADAPTER_ID,
        requestId: request.requestId,
        runRecords: records,
        payloads,
        resultContentHash: aggregateContentDigest(entryPayload, request.retryLadder.backoffClass),
        warnings: [],
        effort: notMeasuredArenaEffortFields(),
        simulated: true,
      };
    },
  };
}

/** Generator label for provenance wiring (honest simulated scope). */
export function pRetryEvaluationGenerator(): string {
  return GENERATOR;
}
