// Deterministic mock arena adapter (W8C).
//
// Implements the provider-neutral arena seam against pure mock candidates.
// The mock transforms the invocation (provider + gap + retry ladder +
// authorization) into an append-only run-record ladder with a
// content-addressed expert-result payload — resultContentHash = sha-256 of
// the canonical payload bytes — with seeded degradation knobs (failure
// evidence dropout, recovery drift, result-type folding, strategy-ladder
// staleness, backoff-class misderivation) so the arena benchmark can score
// different fidelity classes across the order's candidate classes. PURE
// MOCKS (technologyId: null): their parameters are fixture inputs
// exercising the seam, NOT assessments of any real arena provider or retry
// library. No clock, no Math.random, no network — all degradation is
// derived from hash-keyed streams (unitFrom), so every value is a pure
// function of (adapterId, requestId, gapId, attempt, evidenceRef).
//
// The ESCALATION AUTHORIZATION LAW cannot be bypassed here: the shared
// seam gate (assertArenaInvocationSupported) runs before any mock
// behavior. BACKOFF HONESTY: when honorsBackoffClass is false the mock
// derives its recovery values under the token-bucket band — the payload
// carries the class ACTUALLY used, and the misderivation stays visible in
// warnings (truth law — never rewritten into a correct one).

import { roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
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
  type ArenaAdapter,
  type ArenaAdapterProfile,
  type ArenaExpertResultEntry,
  type NeutralArenaBackoffClass,
  type NeutralArenaInvocation,
  type NeutralArenaOutput,
  type NeutralArenaRunRecord,
} from "./arenaAdapterSeam.js";

const GENERATOR = "you-lab-mock-arena-adapter/1";

/** Mock degradation configuration (fixture input, not a technology assessment). */
export interface MockArenaConfig {
  readonly id: string;
  /** Capability classes the mock provider serves (fixture vocabulary). */
  readonly servedCapabilityClasses: readonly string[];
  /** Gap categories the mock can run against (fixture vocabulary). */
  readonly supportedCategories: readonly string[];
  /** Seeded per-evidence-ref ingestion probability (0..1): fraction of the gap's failure evidence actually addressed. */
  readonly evidenceIngestRate: number;
  /** Seeded relative drift applied to expert-result recovery values (0..1). */
  readonly recoveryDrift: number;
  /** Whether distinct result types survive (false: every expert result folds into "guidance"). */
  readonly preservesResultTypes: boolean;
  /** Whether the retry strategy advances along the authored category ladder (false: every attempt reuses the first strategy — visible staleness). */
  readonly followsStrategyLadder: boolean;
  /** Whether recovery derives under the requested backoff class (false: derives under the token-bucket band — visible misderivation). */
  readonly honorsBackoffClass: boolean;
}

export function createMockArenaAdapter(config: MockArenaConfig): ArenaAdapter {
  const profile: ArenaAdapterProfile = {
    id: config.id,
    technologyId: null,
    servedCapabilityClasses: config.servedCapabilityClasses,
    supportedCategories: config.supportedCategories,
    adapterKind: "mock",
    deterministic: true,
    determinismNote: "pure mock: all degradation is seed-derived (unitFrom keyed streams); byte-identical replay from the seed",
    productionEligible: null,
    eligibilityBasis: "pure mock candidate — no registry backing, no eligibility claim",
  };
  return {
    profile,
    invoke(request: NeutralArenaInvocation): NeutralArenaOutput {
      assertArenaInvocationSupported(profile, request);
      const actualClass: NeutralArenaBackoffClass = config.honorsBackoffClass
        ? request.retryLadder.backoffClass
        : "token-bucket";
      const ladder = buildRunLadder(config, request, actualClass);
      const payloads: Record<string, Record<string, unknown>> = {};
      if (ladder.expertEntry && ladder.completedRecordId !== null) {
        payloads[ladder.completedRecordId] = encodeArenaExpertResult(ladder.expertEntry, request, actualClass);
      }
      const warnings: string[] = [];
      if (!config.honorsBackoffClass) {
        warnings.push(
          `backoff misderivation: the requested class '${request.retryLadder.backoffClass}' was derived under '${actualClass}' (visible misderivation — never rewritten)`,
        );
      }
      if (!config.preservesResultTypes) {
        warnings.push("expert-result types folded into a single over-general 'guidance' type (result-type fidelity loss)");
      }
      if (!config.followsStrategyLadder) {
        warnings.push("retry strategy stale: every attempt reuses the first ladder strategy (strategy-ladder staleness)");
      }
      const dropped = request.gap.failureEvidence.length - (ladder.expertEntry?.evidenceRefs.length ?? 0);
      if (ladder.expertEntry && dropped > 0) {
        warnings.push(`${dropped} failure-evidence ref(s) not addressed by the mock arena (seeded coverage loss)`);
      }
      const entryPayload = ladder.completedRecordId === null ? null : (payloads[ladder.completedRecordId] ?? null);
      const resultContentHash = aggregateContentDigest(entryPayload, actualClass);
      return {
        adapterId: config.id,
        requestId: request.requestId,
        runRecords: ladder.records,
        payloads,
        resultContentHash,
        warnings: [...new Set(warnings)].sort(),
        effort: notMeasuredArenaEffortFields(),
        simulated: true,
      };
    },
  };
}

interface MockRunLadder {
  readonly records: readonly NeutralArenaRunRecord[];
  readonly expertEntry: ArenaExpertResultEntry | null;
  readonly completedRecordId: string | null;
}

/** Build the degraded run ladder for (config, request, actualClass) — append-only, never mutated. */
function buildRunLadder(
  config: MockArenaConfig,
  request: NeutralArenaInvocation,
  actualClass: NeutralArenaBackoffClass,
): MockRunLadder {
  const gap = request.gap;
  const records: NeutralArenaRunRecord[] = [];
  let expertEntry: ArenaExpertResultEntry | null = null;
  let completedRecordId: string | null = null;
  for (let attempt = 1; attempt <= request.retryLadder.maxAttempts; attempt++) {
    const status = intendedRunStatusAt(gap.id, attempt);
    const strategy = config.followsStrategyLadder
      ? intendedStrategyAt(gap.category, attempt)
      : intendedStrategyAt(gap.category, 1);
    const recordId = neutralArenaRunId(config.id, request.requestId, attempt);
    records.push({
      id: recordId,
      gapId: gap.id,
      strategy,
      attempt,
      status,
      startedAt: request.submittedAt,
      completedAt: request.submittedAt,
      outcomeEvidenceRef: status === "completed" ? neutralArenaEvidenceRef(config.id, request.requestId, attempt) : null,
      simulated: true,
    });
    if (status === "completed") {
      expertEntry = buildExpertEntry(config, request, strategy, attempt, actualClass);
      completedRecordId = recordId;
      break;
    }
  }
  return { records, expertEntry, completedRecordId };
}

/** Build the degraded expert-result entry for the completed attempt (seeded degradation). */
function buildExpertEntry(
  config: MockArenaConfig,
  request: NeutralArenaInvocation,
  strategy: string,
  attempt: number,
  actualClass: NeutralArenaBackoffClass,
): ArenaExpertResultEntry {
  const gap = request.gap;
  const evidenceRefs: string[] = [];
  for (const evidenceRef of gap.failureEvidence) {
    const ingested = unitFrom(config.id, request.requestId, evidenceRef, "ingest") < config.evidenceIngestRate;
    if (ingested) evidenceRefs.push(evidenceRef);
  }
  const drift = 1 + (unitFrom(config.id, request.requestId, gap.id, "drift") * 2 - 1) * config.recoveryDrift;
  const intendedType = intendedResultTypeFor(gap.category);
  const resultType: ArenaExpertResultEntry["resultType"] = config.preservesResultTypes
    ? intendedType
    : "guidance";
  return {
    resultType,
    finding: intendedFindingFor(gap, strategy),
    recovery: roundTo(intendedRecoveryAt(gap.id, actualClass) * drift, 4),
    evidenceRefs,
    strategy,
    attempt,
    deliveredAt: request.submittedAt,
  };
}

/** Generator label for provenance wiring (honest mock scope). */
export function mockArenaGenerator(): string {
  return GENERATOR;
}
