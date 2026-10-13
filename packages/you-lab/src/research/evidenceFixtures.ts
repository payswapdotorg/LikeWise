// Deterministic promotion-evidence fixtures (W9C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant and a seeded synthetic
// world spec (the LAB.md world model); the harness runs the three
// comparison arms (generalist baseline / hand-designed / searched) over
// the fixture set. Golden expectations are recorded values (computed once
// by the shipped generator/scorer and embedded on 2026-10-14); an
// intentional change to any golden is a NEW fixture version with
// provenance — never an in-place edit. No clock, no randomness beyond the
// seeded derivations, no network.
//
// The standard experiment identity, the authored hand-designed mutation
// sequence and the standard search-ladder plan (the five LAB.md search/RL
// stages under an explicit cumulative budget) are fixture definitions of
// this module — the harness (promotionEvidence.ts) consumes them.

import type { LabWorldSpec } from "./worlds.js";
import type { SearchLadderPlan } from "./searchLadder.js";
import { STANDARD_SEARCH_STRATEGIES } from "./searchLadder.js";

/** A seeded world fixture with golden per-arm expectations. */
export interface PromotionEvidenceFixture {
  readonly fixtureId: string;
  readonly worldSpec: LabWorldSpec;
  /** Golden: arm -> per-fixture computed quality (exact match; recorded from the shipped scorer). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

/** Fixed fixture-mode timestamps (FIXTURES.md law: no clock). */
export const LAB_BENCH_SUBMITTED_AT = "2026-10-14T12:00:00Z";

/** The authored hand-designed organization: an explicit mutation sequence on the seed pipeline. */
export const HAND_DESIGNED_MUTATIONS = ["model-swap", "organization-restructure", "tool-bind"] as const;

export const PROMOTION_EVIDENCE_FIXTURE_SET_VERSION =
  "w9c-promotion-evidence-fixtures/1 (seeded 2026-10-14; golden expectations recorded from the shipped generator and scorer)";

// NOTE: expectedScores below are golden values recorded from the shipped
// generator + scorer on 2026-10-14 (the seed constants and specs are
// frozen; the goldens replay byte-identically).

export const PROMOTION_EVIDENCE_FIXTURES: readonly PromotionEvidenceFixture[] = [
  {
    fixtureId: "fixture-lab-world-bustling-street",
    worldSpec: {
      seed: "w9c-fixture-01", actorCount: 8, cameraCount: 4, sensorCount: 3,
      lightingVariants: 3, noiseLevel: 0.35, occlusionEnabled: true, perturbationCount: 6,
    },
    expectedScores: { "generalist-baseline": 0.7093, "hand-designed": 0.7734, searched: 0.8076 },
  },
  {
    fixtureId: "fixture-lab-world-studio-portrait",
    worldSpec: {
      seed: "w9c-fixture-02", actorCount: 2, cameraCount: 3, sensorCount: 2,
      lightingVariants: 2, noiseLevel: 0.15, occlusionEnabled: false, perturbationCount: 2,
    },
    expectedScores: { "generalist-baseline": 0.9269, "hand-designed": 0.943, searched: 0.9516 },
  },
  {
    fixtureId: "fixture-lab-world-live-event",
    worldSpec: {
      seed: "w9c-fixture-03", actorCount: 12, cameraCount: 6, sensorCount: 4,
      lightingVariants: 4, noiseLevel: 0.55, occlusionEnabled: true, perturbationCount: 10,
    },
    expectedScores: { "generalist-baseline": 0.3265, "hand-designed": 0.3758, searched: 0.7311 },
  },
];

/** Golden: overall arm scores on the standard fixture set (recorded 2026-10-14). */
export const GOLDEN_ARM_OVERALL: Readonly<Record<string, number>> = {
  "generalist-baseline": 0.6542,
  "hand-designed": 0.6974,
  searched: 0.8301,
};

/** Golden: full-report digest over the standard fixture set (byte-identical replay). */
export const GOLDEN_PROMOTION_REPORT_RUN_ID = "ae63f7bc";

/** The standard W9C experiment identity. */
export const STANDARD_LAB_EXPERIMENT_ID = "you_experiment_w9c-standard";
export const STANDARD_LAB_INTENT_REF = "you_intent_w9c-standard-fixture";
export const STANDARD_LAB_OBJECTIVE =
  "mean computed fixture quality across the seeded world set (deterministic you-lab scorer; simulated)";

/** The standard search-ladder plan: the five LAB.md search/RL stages under an explicit cumulative budget. */
export const STANDARD_SEARCH_LADDER_PLAN: SearchLadderPlan = {
  experimentId: STANDARD_LAB_EXPERIMENT_ID,
  budgetCap: 18,
  nodeCost: 1.5,
  nodesPerStep: 3,
  strategies: [...STANDARD_SEARCH_STRATEGIES],
};
