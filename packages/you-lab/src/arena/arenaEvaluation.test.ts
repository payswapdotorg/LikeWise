// Arena evaluation tests (W8C) — coverage: retry/backoff + gap-detector
// candidate derivation from registry tags, production-eligibility gates
// (permissive SPDX + maintenance recency — bottleneck and rank-bm25 fail
// deliberately), the authored ranking deriving p-retry as the production
// pick, the per-category detector shortlist, and the fail-closed
// p-retry evaluation adapter refusing construction when the registry
// derivation shifts (the W6C/W7C pattern).
import assert from "node:assert/strict";
import test from "node:test";
import { createRegistry } from "../technology/registry.js";
import { createGapDetectionRegistry } from "../technology/gapDetectionSeedProfiles.js";
import { createRetryBackoffRegistry, RETRY_BACKOFF_SEED_PROFILES } from "../technology/retryBackoffSeedProfiles.js";
import {
  assessArenaGapDetectorProductionEligibility,
  assessArenaRetryProductionEligibility,
  arenaRetryCandidateIdsForClass,
  DEFAULT_MAX_MAINTENANCE_AGE_DAYS,
  deriveArenaGapDetectorProfiles,
  deriveArenaRetryCandidateProfiles,
  gapDetectorShortlistByCategory,
  rankArenaRetryProductionEligible,
} from "./arenaEvaluation.js";
import { createPRetryBackoffArenaEvaluationAdapter, P_RETRY_EVALUATION_ADAPTER_ID } from "./pRetryEvaluationAdapter.js";
import { ARENA_BENCH_SUBMITTED_AT } from "./arenaRunner.js";
import { fixtureScenario, ARENA_BENCHMARK_FIXTURES } from "./arenaFixtures.js";
import { scoreArenaInvocation } from "./arenaScorer.js";

const registry = createRetryBackoffRegistry();

test("arena evaluation: retry candidates derive across all four W8C classes from registry tags", () => {
  const candidates = deriveArenaRetryCandidateProfiles(registry);
  assert.equal(candidates.length, 4);
  for (const backoffClass of ["circuit-breaker", "hedged-request", "exponential-backoff-jitter", "token-bucket"] as const) {
    assert.equal(arenaRetryCandidateIdsForClass(candidates, backoffClass).length, 1, `${backoffClass}: exactly one candidate`);
  }
  assert.deepEqual(
    arenaRetryCandidateIdsForClass(candidates, "exponential-backoff-jitter"),
    ["p-retry"],
  );
  for (const candidate of candidates) {
    assert.equal(candidate.derivedFrom, "you-lab arena-candidate table/1 (engineering assessment)");
    assert.equal(candidate.evaluation.determinism.deterministic, false, "real libraries are not bit-deterministic (honest assessment)");
    assert.equal(candidate.evaluation.determinism.assessmentBasis, "engineering-assessment");
    assert.equal(candidate.evaluation.effort.kind, "not-measured");
    assert.equal(candidate.evaluation.licensing.sourceUrl.startsWith("https://"), true);
  }
  // derivation is deterministic
  assert.deepEqual(deriveArenaRetryCandidateProfiles(registry), candidates);
});

test("arena evaluation: maintenance + license gates derive eligibility honestly", () => {
  const candidates = deriveArenaRetryCandidateProfiles(registry);
  const assessments = assessArenaRetryProductionEligibility(candidates, registry);
  const byId = new Map(assessments.map((assessment) => [assessment.technologyId, assessment]));
  // bottleneck (2019-08-03) fails the maintenance gate deliberately
  const bottleneck = byId.get("bottleneck");
  assert.ok(bottleneck);
  assert.equal(bottleneck.eligible, false);
  assert.ok(bottleneck.basis.includes("maintenance gate failed"), "basis cites the failed gate");
  assert.ok(bottleneck.maintenanceAgeDays > DEFAULT_MAX_MAINTENANCE_AGE_DAYS);
  // the other three pass (permissive SPDX + fresh maintenance)
  for (const technologyId of ["opossum", "grpc-js", "p-retry"]) {
    const assessment = byId.get(technologyId);
    assert.ok(assessment);
    assert.equal(assessment.eligible, true, `${technologyId} eligible`);
    assert.ok(assessment.basis.includes("permissive SPDX set"), `${technologyId}: basis cites the license gate`);
    assert.ok(assessment.basis.includes("W9+ compute-plane work"), `${technologyId}: basis defers real integration honestly`);
  }
});

test("arena evaluation: the authored ranking derives p-retry as the production pick behind the seam", () => {
  const candidates = deriveArenaRetryCandidateProfiles(registry);
  const ranked = rankArenaRetryProductionEligible(assessArenaRetryProductionEligibility(candidates, registry));
  const top = ranked[0];
  assert.ok(top);
  assert.equal(top.technologyId, "p-retry");
  assert.equal(top.slot, "backoff-class:exponential-backoff-jitter");
  // ranking is a deterministic total order
  assert.deepEqual(
    rankArenaRetryProductionEligible(assessArenaRetryProductionEligibility(candidates, registry)),
    ranked,
  );
  // the ineligible candidate ranks last
  assert.equal(ranked[ranked.length - 1]?.technologyId, "bottleneck");
});

test("arena evaluation: gap detectors derive across all seven frozen categories; rank-bm25 fails maintenance", () => {
  const detectors = deriveArenaGapDetectorProfiles(createGapDetectionRegistry());
  assert.equal(detectors.length, 7);
  const assessments = assessArenaGapDetectorProductionEligibility(detectors, createGapDetectionRegistry());
  const shortlist = gapDetectorShortlistByCategory(detectors, assessments);
  assert.equal(shortlist.length, 7);
  for (const row of shortlist) {
    assert.equal(row.researched.length, 1, `${row.category}: one researched detector`);
  }
  const knowledge = shortlist.find((row) => row.category === "KNOWLEDGE_GAP");
  assert.ok(knowledge);
  assert.deepEqual(knowledge.researched, ["rank-bm25"]);
  assert.deepEqual(knowledge.eligible, [], "the stale KNOWLEDGE_GAP detector is researched but not eligible (honest finding)");
  const eligibleCount = shortlist.reduce((sum, row) => sum + row.eligible.length, 0);
  assert.equal(eligibleCount, 6, "six of seven categories retain an eligible detector");
  // derivation is deterministic
  assert.deepEqual(
    gapDetectorShortlistByCategory(
      deriveArenaGapDetectorProfiles(createGapDetectionRegistry()),
      assessArenaGapDetectorProductionEligibility(detectors, createGapDetectionRegistry()),
    ),
    shortlist,
  );
});

test("arena evaluation: the p-retry evaluation adapter constructs on the real registry and simulates exactly", () => {
  const adapter = createPRetryBackoffArenaEvaluationAdapter(registry);
  assert.equal(adapter.profile.id, P_RETRY_EVALUATION_ADAPTER_ID);
  assert.equal(adapter.profile.technologyId, "p-retry");
  assert.equal(adapter.profile.adapterKind, "evaluation");
  assert.equal(adapter.profile.productionEligible, true);
  assert.ok(adapter.facts.eligibilityBasis.includes("permissive SPDX set"));
  assert.ok(adapter.facts.maintenanceAgeDays >= 0 && adapter.facts.maintenanceAgeDays <= DEFAULT_MAX_MAINTENANCE_AGE_DAYS);
  assert.equal(adapter.facts.backoffClass, "exponential-backoff-jitter");
  // the simulated ladder is the intended model: perfect fidelity on every fixture
  for (let index = 0; index < ARENA_BENCHMARK_FIXTURES.length; index++) {
    const scenario = fixtureScenario(ARENA_BENCHMARK_FIXTURES[index]!);
    const request = {
      requestId: `eval-${index}`,
      provider: scenario.provider,
      gap: scenario.gap,
      retryLadder: scenario.retryLadder,
      escalationId: scenario.escalationId,
      authorization: scenario.authorization,
      submittedAt: ARENA_BENCH_SUBMITTED_AT,
    };
    const output = adapter.invoke(request);
    const parts = scoreArenaInvocation(request, output);
    assert.equal(parts.fidelityScore, 1, `fixture ${index}: perfect simulated fidelity`);
    assert.equal(output.simulated, true);
    assert.deepEqual(output.warnings, []);
    assert.equal((output.effort.cost as { marker?: string }).marker, "not-measured (simulated)");
  }
});

test("arena evaluation: the p-retry evaluation adapter fails closed when the registry derivation shifts", () => {
  // registry without p-retry at all
  const withoutPRetry = createRegistry(RETRY_BACKOFF_SEED_PROFILES.filter((profile) => profile.id !== "p-retry"));
  assert.throws(
    () => createPRetryBackoffArenaEvaluationAdapter(withoutPRetry),
    /technology 'p-retry' missing from the registry/,
  );
  // tag drift: p-retry loses its backoff-class tag and no longer derives as a retry candidate
  const tagDrift = RETRY_BACKOFF_SEED_PROFILES.map((profile) =>
    profile.id === "p-retry"
      ? { ...profile, capabilityTags: profile.capabilityTags.filter((tag) => tag !== "backoff-class:exponential-backoff-jitter") }
      : profile,
  );
  assert.throws(
    () => createPRetryBackoffArenaEvaluationAdapter(createRegistry(tagDrift)),
    /is not a derived retry\/backoff candidate/,
  );
  // class drift: p-retry derives in a different class
  const classDrift = RETRY_BACKOFF_SEED_PROFILES.map((profile) =>
    profile.id === "p-retry"
      ? { ...profile, capabilityTags: profile.capabilityTags.map((tag) => (tag === "backoff-class:exponential-backoff-jitter" ? "backoff-class:token-bucket" : tag)) }
      : profile,
  );
  assert.throws(
    () => createPRetryBackoffArenaEvaluationAdapter(createRegistry(classDrift)),
    /no longer derives in the exponential-backoff-jitter class/,
  );
  // p-retry license no longer permissive: the pick shifts (top becomes grpc-js — fresher of the remaining eligible) — refuse
  const gplPRetry = RETRY_BACKOFF_SEED_PROFILES.map((profile) =>
    profile.id === "p-retry"
      ? { ...profile, license: { ...profile.license, spdxId: "GPL-3.0", name: "GNU General Public License v3.0" } }
      : profile,
  );
  assert.throws(
    () => createPRetryBackoffArenaEvaluationAdapter(createRegistry(gplPRetry)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /no longer derives as the top production-eligible/);
      assert.match(error.message, /top: grpc-js/);
      return true;
    },
  );
  // p-retry maintenance stale: the pick shifts — refuse
  const stalePRetry = RETRY_BACKOFF_SEED_PROFILES.map((profile) =>
    profile.id === "p-retry"
      ? {
          ...profile,
          maintenance: [
            { kind: "npm-publish" as const, signal: "p-retry@8.0.0", date: "2020-01-01", sourceUrl: "https://registry.npmjs.org/p-retry", verified: true },
          ],
        }
      : profile,
  );
  assert.throws(
    () => createPRetryBackoffArenaEvaluationAdapter(createRegistry(stalePRetry)),
    /no longer derives as the top production-eligible/,
  );
});

test("arena evaluation: a fresher jitter-class rival outranks p-retry (the ranking mechanism behind the fail-closed gate)", () => {
  // prove at the evaluation level what the adapter gate enforces: if the
  // registry ever gains an eligible exponential-backoff-jitter candidate
  // with fresher maintenance, it derives as the top pick and the adapter
  // would refuse construction (the fail-closed law)
  const candidates = deriveArenaRetryCandidateProfiles(registry);
  const assessments = assessArenaRetryProductionEligibility(candidates, registry);
  const rivalAssessment = {
    technologyId: "rival-jitter",
    slot: "backoff-class:exponential-backoff-jitter",
    eligible: true,
    maintenanceAgeDays: 1,
    basis: "fixture rival assessment (test-only)",
  };
  const ranked = rankArenaRetryProductionEligible([...assessments, rivalAssessment]);
  assert.equal(ranked[0]?.technologyId, "rival-jitter");
  const pRetry = ranked.find((assessment) => assessment.technologyId === "p-retry");
  assert.ok(pRetry);
  assert.ok(ranked.indexOf(rivalAssessment) < ranked.indexOf(pRetry), "the fresher jitter-class rival outranks p-retry");
  // without the rival, p-retry stays top (the shipped registry state)
  assert.equal(rankArenaRetryProductionEligible(assessments)[0]?.technologyId, "p-retry");
});
