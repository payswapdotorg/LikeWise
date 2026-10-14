// Deterministic ecosystem benchmark fixtures (W10C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a seeded synthetic
// ecosystem request spec (a registry-eligible provider row resolved
// through the ProviderMatrix — provider/region/style/export refs from the
// authored vocabularies — a cost/latency budget descriptor with one of the
// four W8C breaker classes, and a declared spend inside the budget) and
// golden expectations over the intended fulfillment model. Golden
// expectations are recorded values (computed once by the shipped
// generator/scorer and embedded on 2026-10-14); an intentional change to
// any golden is a NEW fixture version with provenance — never an in-place
// edit. No clock, no randomness beyond the seeded rng, no network.

import { unitFrom } from "../capture/deterministicRng.js";
import type { NeutralArenaBackoffClass } from "../arena/arenaAdapterSeam.js";
import type { NeutralCostLatencyBudget } from "./budgetGuardSeam.js";
import {
  budgetGuardId,
} from "./budgetGuardSeam.js";
import { createProductionEligibilityLedger, createRollbackEvidenceRegistry, type ProductionEligibilityLedger } from "./eligibilityLedger.js";

/** Spec of a seeded synthetic ecosystem request. */
export interface SyntheticEcosystemRequestSpec {
  /** Registry-eligible provider kind the fixture exercises (resolves through the matrix). */
  readonly providerKind: string;
  readonly region: string;
  readonly styleRefs: readonly string[];
  readonly exportRefs: readonly string[];
  /** The budget guard's breaker class (one of the four W8C classes). */
  readonly breakerClass: NeutralArenaBackoffClass;
  /** Total cost budget in fixture units (the declared spend derives inside it). */
  readonly costBudget: number;
  /** Total latency budget in fixture seconds (the declared spend derives inside it). */
  readonly latencyBudgetS: number;
  /** Production-mode requests require a ledger-eligible subject decision. */
  readonly productionMode: boolean;
}

/** A seeded synthetic ecosystem request context (budget descriptor + declared spend), deterministic. */
export interface EcosystemRequestContext {
  readonly requestId: string;
  readonly providerKind: string;
  readonly region: string;
  readonly styleRefs: readonly string[];
  readonly exportRefs: readonly string[];
  readonly budget: NeutralCostLatencyBudget;
  readonly declaredCostUnits: number;
  readonly declaredLatencyS: number;
  readonly productionMode: boolean;
  readonly submittedAt: string;
}

/** Fixed fixture-mode request timestamp (FIXTURES.md law 3: no clock). */
export const ECOSYSTEM_BENCH_SUBMITTED_AT = "2026-10-14T12:00:00Z";

/**
 * Synthesize a deterministic ecosystem request context for (seed, spec):
 * the budget descriptor derives from (scope, breakerClass) with seeded
 * declared spend strictly inside both budget envelopes (seeded arithmetic
 * — fixture accounting, never a measurement), and the request id threads
 * the seed.
 */
export function synthesizeEcosystemRequest(seed: string, spec: SyntheticEcosystemRequestSpec): EcosystemRequestContext {
  if (spec.costBudget <= 0 || !Number.isFinite(spec.costBudget)) throw new Error("synthesizeEcosystemRequest: costBudget must be finite > 0");
  if (spec.latencyBudgetS <= 0 || !Number.isFinite(spec.latencyBudgetS)) throw new Error("synthesizeEcosystemRequest: latencyBudgetS must be finite > 0");
  const scope = `ecosystem-bench:${spec.providerKind}|${spec.region}`;
  const budget: NeutralCostLatencyBudget = {
    id: budgetGuardId(scope, spec.breakerClass),
    scope,
    costBudget: spec.costBudget,
    latencyBudgetS: spec.latencyBudgetS,
    breakerClass: spec.breakerClass,
    simulated: true,
  };
  // Declared spend: seeded in [25%, 95%] of each envelope — strictly
  // inside the budget (the over-budget refusal path is exercised
  // separately by the seam tests, never inside the golden fixtures).
  const costFraction = 0.25 + unitFrom("you-lab-ecosystem-bench", seed, "cost-fraction", "spend") * 0.7;
  const latencyFraction = 0.25 + unitFrom("you-lab-ecosystem-bench", seed, "latency-fraction", "spend") * 0.7;
  const declaredCostUnits = Math.round(budget.costBudget * costFraction * 10_000) / 10_000;
  const declaredLatencyS = Math.round(budget.latencyBudgetS * latencyFraction * 10_000) / 10_000;
  return {
    requestId: `bench-eco-${seed}`,
    providerKind: spec.providerKind,
    region: spec.region,
    styleRefs: [...spec.styleRefs],
    exportRefs: [...spec.exportRefs],
    budget,
    declaredCostUnits,
    declaredLatencyS,
    productionMode: spec.productionMode,
    submittedAt: ECOSYSTEM_BENCH_SUBMITTED_AT,
  };
}

export interface EcosystemBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly requestSpec: SyntheticEcosystemRequestSpec;
  /**
   * Golden: digest over the intended fulfillment payload map under the
   * scenario's requested breaker class (byte-identical replay check).
   */
  readonly expectedIntendedPayloadDigest: string;
  /** Golden: candidate id -> per-fixture ecosystem-fidelity score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

// NOTE: expectedIntendedPayloadDigest / expectedScores below are golden
// values recorded from the shipped generator + scorer on 2026-10-14 (the
// seed constants and specs are frozen; the goldens replay byte-identically).

export const ECOSYSTEM_BENCHMARK_FIXTURES: readonly EcosystemBenchmarkFixture[] = [
  {
    fixtureId: "fixture-ecosystem-ar-multistyle",
    seed: "w10c-fixture-01",
    requestSpec: {
      providerKind: "model-viewer",
      region: "global",
      styleRefs: ["photoreal", "anime-stylized"],
      exportRefs: ["glb", "usdz-ar-quick-look"],
      breakerClass: "exponential-backoff-jitter",
      costBudget: 100,
      latencyBudgetS: 10,
      productionMode: false,
    },
    expectedIntendedPayloadDigest: "6d37d93cfc15920a383ede34d21e33ef548d943b912618ccb2e517b073b730a4",
    expectedScores: {
      "mock-ecosystem-precise": 1,
      "mock-ecosystem-coarse": 0.75,
      "mock-ecosystem-lossy": 0.3833,
      "mock-ecosystem-stale-export": 0.5667,
      "mock-ecosystem-misbreaker": 0.8667,
      "mock-ecosystem-minimal": 0.2,
      "model-viewer-ar-eval": 1,
    },
  },
  {
    fixtureId: "fixture-ecosystem-game-export",
    seed: "w10c-fixture-02",
    requestSpec: {
      providerKind: "babylonjs",
      region: "global",
      styleRefs: ["photoreal", "anime-stylized", "illustrated"],
      exportRefs: ["glb", "gltf"],
      breakerClass: "circuit-breaker",
      costBudget: 250,
      latencyBudgetS: 30,
      productionMode: false,
    },
    expectedIntendedPayloadDigest: "93ba80692f5bbce57859eebeb0666664646c1dddbc2dd9900a995c6ee50e9e65",
    expectedScores: {
      "mock-ecosystem-precise": 1,
      "mock-ecosystem-coarse": 0.6889,
      "mock-ecosystem-lossy": 0.5667,
      "mock-ecosystem-stale-export": 0.5667,
      "mock-ecosystem-misbreaker": 0.8667,
      "mock-ecosystem-minimal": 0.5333,
      "model-viewer-ar-eval": 1,
    },
  },
  {
    fixtureId: "fixture-ecosystem-style-pipeline",
    seed: "w10c-fixture-03f",
    requestSpec: {
      providerKind: "diffusers",
      region: "global",
      styleRefs: ["photoreal", "anime-stylized", "illustrated", "sculptural", "voxel"],
      exportRefs: [],
      breakerClass: "hedged-request",
      costBudget: 500,
      latencyBudgetS: 60,
      productionMode: false,
    },
    expectedIntendedPayloadDigest: "35273dd841a4b82c25fb48e48ed24b214896e8abda9b291646a1f7a552e0adf1",
    expectedScores: {
      "mock-ecosystem-precise": 1,
      "mock-ecosystem-coarse": 0.7867,
      "mock-ecosystem-lossy": 0.64,
      "mock-ecosystem-stale-export": 0.9333,
      "mock-ecosystem-misbreaker": 0.8667,
      "mock-ecosystem-minimal": 0.4667,
      "model-viewer-ar-eval": 1,
    },
  },
];

export const ECOSYSTEM_FIXTURE_SET_VERSION =
  "w10c-ecosystem-benchmark-fixtures/1 (seeded 2026-10-14; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_ECOSYSTEM_REPORT_RUN_ID = "96e9ebe4";

/** Resolved request context for a fixture (deterministic). */
export function fixtureRequest(fixture: EcosystemBenchmarkFixture): EcosystemRequestContext {
  return synthesizeEcosystemRequest(fixture.seed, fixture.requestSpec);
}

// ---------------------------------------------------------------------------
// The standard benchmark ledger (the PRODUCTION ELIGIBILITY LAW harness)
// ---------------------------------------------------------------------------

/**
 * The fixture rollback-evidence refs for the benchmark subjects —
 * content-addressed fixture artifacts (the evidence a rollback exists:
 * deterministic fixture accounting, never a claim about a real rollback).
 */
export const ECOSYSTEM_BENCH_EVIDENCE_REFS: readonly string[] = [
  "content-store://you-lab/ecosystem/rollback/model-viewer-ar-lane",
  "content-store://you-lab/ecosystem/rollback/babylonjs-game-export-lane",
  "content-store://you-lab/ecosystem/rollback/diffusers-style-pipeline-lane",
];

/**
 * The standard benchmark ledger: one eligible decision per benchmark
 * subject (provider kind), each backed by its rollback evidence ref. The
 * decisions are immutable records; a benchmark arm that needs a reversal
 * appends a NEW record through the ledger's own decide() — never a
 * mutation (the PRODUCTION ELIGIBILITY LAW).
 */
export function createStandardEcosystemLedger(): ProductionEligibilityLedger {
  const evidence = createRollbackEvidenceRegistry(ECOSYSTEM_BENCH_EVIDENCE_REFS);
  return createProductionEligibilityLedger(evidence, [
    {
      subjectRef: "model-viewer",
      eligible: true,
      rollbackEvidenceRef: "content-store://you-lab/ecosystem/rollback/model-viewer-ar-lane",
      decidedAt: ECOSYSTEM_BENCH_SUBMITTED_AT,
    },
    {
      subjectRef: "babylonjs",
      eligible: true,
      rollbackEvidenceRef: "content-store://you-lab/ecosystem/rollback/babylonjs-game-export-lane",
      decidedAt: ECOSYSTEM_BENCH_SUBMITTED_AT,
    },
    {
      subjectRef: "diffusers",
      eligible: true,
      rollbackEvidenceRef: "content-store://you-lab/ecosystem/rollback/diffusers-style-pipeline-lane",
      decidedAt: ECOSYSTEM_BENCH_SUBMITTED_AT,
    },
  ]);
}
