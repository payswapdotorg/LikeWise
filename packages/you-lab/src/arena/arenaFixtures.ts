// Deterministic arena benchmark fixtures (W8C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a seeded synthetic gap
// scenario spec (a frozen gap category, an authored retry ladder —
// maxAttempts + backoff class + the escalation authorization gate — and a
// count of content-addressed failure-evidence refs) and golden
// expectations over the intended run-ladder model. The arena invocation
// is the provider + gap + ladder + authorization. Golden expectations are
// recorded values (computed once by the shipped generator/scorer and
// embedded on 2026-10-13); an intentional change to any golden is a NEW
// fixture version with provenance — never an in-place edit. No clock, no
// randomness beyond the seeded rng, no network.

import { roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import {
  sha256Hex,
  NEUTRAL_CAPABILITY_GAP_CATEGORIES,
  type NeutralArenaAuthorizationContext,
  type NeutralArenaBackoffClass,
  type NeutralArenaGapRecord,
  type NeutralArenaProviderDescriptor,
  type NeutralArenaRetryLadder,
  type NeutralAttemptedStrategy,
  type NeutralCapabilityGapCategory,
} from "./arenaAdapterSeam.js";

/** Spec of a seeded synthetic gap scenario. */
export interface SyntheticArenaGapSpec {
  /** The frozen v1 gap category this scenario exercises. */
  readonly category: (typeof NEUTRAL_CAPABILITY_GAP_CATEGORIES)[number];
  /** Attempted-strategy entries recorded on the gap (>= 1). */
  readonly attemptedStrategyCount: number;
  /** Content-addressed failure-evidence refs synthesized for the scenario (>= 1). */
  readonly evidenceRefCount: number;
  /** The retry ladder's max attempts (>= 1). */
  readonly maxAttempts: number;
  /** The retry ladder's backoff class (one of the four W8C classes). */
  readonly backoffClass: NeutralArenaBackoffClass;
  /** Whether the ladder requires an explicit escalation authorization (the wave-8 gate). */
  readonly requiresAuthorization: boolean;
}

/** A seeded synthetic arena scenario (provider + gap + ladder + authorization), deterministic. */
export interface ArenaScenario {
  readonly gap: NeutralArenaGapRecord;
  readonly provider: NeutralArenaProviderDescriptor;
  readonly retryLadder: NeutralArenaRetryLadder;
  readonly escalationId: string | null;
  readonly authorization: NeutralArenaAuthorizationContext | null;
}

/** The seven outcome states cycled across attempted strategies (deterministic). */
const STRATEGY_OUTCOMES = ["failed", "partial", "rejected"] as const;

/**
 * Synthesize a deterministic arena scenario for (seed, spec): the gap is
 * seed-derived (you_gap_<16hex>, a frozen-category record with
 * content-addressed failure evidence — the wave-2 ref format); the
 * provider descriptor is seed-derived (you_arena-provider_<16hex>,
 * provider-neutral); the retry ladder carries the spec's class and
 * authorization gate; the authorization context is a fixed immutable grant
 * (grantedAt/expiresAt constants — no clock) when the gate requires one.
 */
export function synthesizeArenaScenario(seed: string, spec: SyntheticArenaGapSpec): ArenaScenario {
  if (spec.attemptedStrategyCount < 1) throw new Error("synthesizeArenaScenario: attemptedStrategyCount must be >= 1");
  if (spec.evidenceRefCount < 1) throw new Error("synthesizeArenaScenario: evidenceRefCount must be >= 1");
  if (spec.maxAttempts < 1) throw new Error("synthesizeArenaScenario: maxAttempts must be >= 1");
  const gapId = `you_gap_${sha256Hex(`arena-gap|${seed}`).slice(0, 16)}`;
  const intentRef = `you_intent_${sha256Hex(`arena-intent|${seed}`).slice(0, 16)}`;
  const evidenceRefs: string[] = [];
  for (let index = 0; index < spec.evidenceRefCount; index++) {
    evidenceRefs.push(`you_content_${sha256Hex(`arena-evidence|${seed}|${index}`).slice(0, 16)}`);
  }
  const attemptedStrategies: NeutralAttemptedStrategy[] = [];
  for (let index = 0; index < spec.attemptedStrategyCount; index++) {
    attemptedStrategies.push({
      strategy: `attempted-strategy-${index}-${seed}`,
      outcome: STRATEGY_OUTCOMES[index % STRATEGY_OUTCOMES.length]!,
      evidenceRef: evidenceRefs[index % evidenceRefs.length] ?? null,
    });
  }
  const gap: NeutralArenaGapRecord = {
    id: gapId,
    intentRef,
    attemptedStrategies,
    failureEvidence: evidenceRefs,
    category: spec.category,
    confidence: roundTo(0.55 + unitFrom(seed, "confidence") * 0.35, 4),
    suggestedNextAction: `Resolve the ${spec.category} blocking intent ${intentRef} (fixture seed ${seed})`,
    escalationEligibility: spec.requiresAuthorization ? "escalated" : "eligible",
  };
  const provider: NeutralArenaProviderDescriptor = {
    id: `you_arena-provider_${sha256Hex(`arena-provider|${seed}`).slice(0, 16)}`,
    providerKind: "you-lab-fixture-arena",
    capabilityClasses: [`gap-category:${spec.category}`, "arena-automation"],
    endpointRef: null,
  };
  const retryLadder: NeutralArenaRetryLadder = {
    maxAttempts: spec.maxAttempts,
    backoffClass: spec.backoffClass,
    eligibilityCategories: [spec.category],
    requiresAuthorization: spec.requiresAuthorization,
  };
  const escalationId = spec.requiresAuthorization
    ? `you_escalation_${sha256Hex(`arena-escalation|${seed}`).slice(0, 16)}`
    : null;
  const authorization = spec.requiresAuthorization && escalationId !== null
    ? {
        authorizationId: `you_authz_${sha256Hex(`arena-authz|${seed}`).slice(0, 16)}`,
        escalationId,
        authorizedBy: `you_user_${sha256Hex(`arena-user|${seed}`).slice(0, 16)}`,
        scope: `arena-run:${gapId}`,
        grantedAt: "2026-10-13T09:00:00Z",
        expiresAt: null,
        learningPermission: "aggregate" as const,
      }
    : null;
  return { gap, provider, retryLadder, escalationId, authorization };
}

export interface ArenaBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly scenarioSpec: SyntheticArenaGapSpec;
  /**
   * Golden: digest over the intended expert result under the scenario's
   * requested backoff class (byte-identical replay check).
   */
  readonly expectedIntendedResultDigest: string;
  /** Golden: candidate id -> per-fixture arena-fidelity score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

// NOTE: expectedIntendedResultDigest / expectedScores below are golden
// values recorded from the shipped generator + scorer on 2026-10-13 (the
// seed constants and specs are frozen; the goldens replay byte-identically).

export const ARENA_BENCHMARK_FIXTURES: readonly ArenaBenchmarkFixture[] = [
  {
    fixtureId: "fixture-arena-tool-retry",
    seed: "w8c-fixture-01",
    scenarioSpec: {
      category: "TOOL_GAP",
      attemptedStrategyCount: 3,
      evidenceRefCount: 4,
      maxAttempts: 3,
      backoffClass: "exponential-backoff-jitter",
      requiresAuthorization: true,
    },
    expectedIntendedResultDigest: "08260c19ec52e335f536a810d1f094bd87b65fd2a416db8269e4fb77e2dc80f2",
    expectedScores: {
      "mock-arena-precise": 1,
      "mock-arena-coarse": 0.9333,
      "mock-arena-lossy": 0.5667,
      "mock-arena-stale-strategy": 0.9333,
      "mock-arena-misbackoff": 0.9333,
      "mock-arena-minimal": 0.4167,
      "p-retry-arena-eval": 1,
    },
  },
  {
    fixtureId: "fixture-arena-knowledge-retrieve",
    seed: "w8c-fixture-02",
    scenarioSpec: {
      category: "KNOWLEDGE_GAP",
      attemptedStrategyCount: 2,
      evidenceRefCount: 6,
      maxAttempts: 2,
      backoffClass: "circuit-breaker",
      requiresAuthorization: false,
    },
    expectedIntendedResultDigest: "f6564d69e9c82a9a49396008a98570ef903cce4d0f4a695da338a268ff2f4c56",
    expectedScores: {
      "mock-arena-precise": 1,
      "mock-arena-coarse": 0.9333,
      "mock-arena-lossy": 0.5667,
      "mock-arena-stale-strategy": 0.8667,
      "mock-arena-misbackoff": 0.8333,
      "mock-arena-minimal": 0.4,
      "p-retry-arena-eval": 1,
    },
  },
  {
    fixtureId: "fixture-arena-expert-escalation",
    seed: "w8c-fixture-03f",
    scenarioSpec: {
      category: "EXPERT_GAP",
      attemptedStrategyCount: 4,
      evidenceRefCount: 8,
      maxAttempts: 4,
      backoffClass: "hedged-request",
      requiresAuthorization: true,
    },
    expectedIntendedResultDigest: "0db081f91a02352605a6f0c1ebf50c982fbd8848269106234437e86a8cbfa69e",
    expectedScores: {
      "mock-arena-precise": 1,
      "mock-arena-coarse": 0.7833,
      "mock-arena-lossy": 0.6333,
      "mock-arena-stale-strategy": 0.9333,
      "mock-arena-misbackoff": 0.8583,
      "mock-arena-minimal": 0.7083,
      "p-retry-arena-eval": 1,
    },
  },
];

export const ARENA_FIXTURE_SET_VERSION =
  "w8c-arena-benchmark-fixtures/1 (seeded 2026-10-13; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_ARENA_REPORT_RUN_ID = "546e9bed";

/** Resolved arena scenario for a fixture (deterministic). */
export function fixtureScenario(fixture: ArenaBenchmarkFixture): ArenaScenario {
  return synthesizeArenaScenario(fixture.seed, fixture.scenarioSpec);
}

/** Resolved gap category of a fixture (typing helper for tests). */
export function fixtureCategory(fixture: ArenaBenchmarkFixture): NeutralCapabilityGapCategory {
  return fixture.scenarioSpec.category;
}
