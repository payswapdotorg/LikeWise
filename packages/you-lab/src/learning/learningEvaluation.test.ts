// Learning candidate evaluation tests (W6C) — coverage: registry-derived
// candidate profiles with honest licensing/determinism/effort fields,
// production eligibility derived (never hand-asserted), deterministic
// ranking with the vowpal-wabbit pick, and the fail-closed evaluation
// adapter with honest simulated markers.
import assert from "node:assert/strict";
import test from "node:test";
import { createLearningRegistry, LEARNING_SEED_PROFILES } from "../technology/learningSeedProfiles.js";
import { createRegistry } from "../technology/registry.js";
import { EDITOR_SEED_PROFILES } from "../technology/editorSeedProfiles.js";
import { SEED_PROFILES } from "../technology/seedProfiles.js";
import {
  LEARNING_EVALUATION_SCOPES,
  LEARNING_EVALUATION_USAGE_CLASSES,
  LEARNING_RESEARCH_DATE,
  assessLearningProductionEligibility,
  deriveLearningCandidateProfiles,
  learningCandidateIdsForClass,
  rankLearningProductionEligible,
} from "./learnerEvaluation.js";
import {
  createVowpalWabbitLearningEvaluationAdapter,
  VOWPAL_WABBIT_EVALUATION_ADAPTER_ID,
  vowpalWabbitEvaluationGenerator,
} from "./vowpalWabbitEvaluationAdapter.js";
import { LEARNING_BENCH_SUBMITTED_AT } from "./learningRunner.js";
import { fixtureInvocationSignal, LEARNING_BENCHMARK_FIXTURES } from "./learningFixtures.js";

const registry = createLearningRegistry();
const candidates = deriveLearningCandidateProfiles(registry);

test("learning evaluation: candidate criteria cite verified registry license facts", () => {
  for (const candidate of candidates) {
    const technology = registry.byId(candidate.technologyId);
    assert.ok(technology, `${candidate.technologyId}: registry-backed`);
    assert.equal(candidate.evaluation.licensing.spdxId, technology.license.spdxId);
    assert.equal(candidate.evaluation.licensing.sourceUrl, technology.license.sourceUrl);
    assert.equal(candidate.evaluation.licensing.sourceUrl.startsWith("https://"), true);
  }
});

test("learning evaluation: effort/latency/cost carry honest not-measured markers", () => {
  for (const candidate of candidates) {
    for (const field of [candidate.evaluation.effort, candidate.evaluation.latency, candidate.evaluation.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.marker, "not-measured (simulated)");
    }
    assert.equal(candidate.evaluation.determinism.assessmentBasis, "engineering-assessment");
    assert.equal(candidate.evaluation.determinism.deterministic, false, "the real learners are not bit-deterministic");
    assert.ok(candidate.derivedFrom.startsWith("you-lab learning-candidate table/"));
  }
});

test("learning evaluation: permissive SPDX set drives production friendliness", () => {
  const byId = new Map(candidates.map((candidate) => [candidate.technologyId, candidate]));
  assert.equal(byId.get("wittgenstein")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("mord")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("mabwiser")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("vowpal-wabbit")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("lightgbm")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("xgboost")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("smac")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("prose")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("pm4py")?.evaluation.licensing.productionFriendly, false, "AGPL pm4py blocked (the not-production-friendly branch)");
});

test("learning evaluation: production eligibility is derived from license + maintenance recency", () => {
  const assessments = assessLearningProductionEligibility(candidates, registry);
  const byId = new Map(assessments.map((assessment) => [assessment.technologyId, assessment]));
  // vowpal-wabbit: BSD-3-Clause + PyPI upload 15 days before the research date — eligible
  const vw = byId.get("vowpal-wabbit");
  assert.ok(vw);
  assert.equal(vw.eligible, true);
  assert.equal(vw.maintenanceAgeDays, 15);
  assert.ok(vw.basis.includes("BSD-3-Clause"));
  assert.ok(vw.basis.includes("W7+ compute-plane work"), "honest W7+ deferral in the basis");
  // fresh permissive candidates across the classes
  assert.equal(byId.get("smac")?.eligible, true);
  assert.equal(byId.get("smac")?.maintenanceAgeDays, 32);
  assert.equal(byId.get("xgboost")?.eligible, true);
  assert.equal(byId.get("lightgbm")?.eligible, true);
  assert.equal(byId.get("wittgenstein")?.eligible, true);
  assert.equal(byId.get("prose")?.eligible, true, "prose: MIT + commit 327 days before research — inside the gate");
  // pm4py: freshest maintenance of all (3 days) but AGPL — blocked by license
  const pm4py = byId.get("pm4py");
  assert.ok(pm4py);
  assert.equal(pm4py.eligible, false);
  assert.equal(pm4py.maintenanceAgeDays, 3);
  assert.ok(pm4py.basis.includes("not in the permissive SPDX set"));
  // mabwiser + mord: permissive licenses but stale maintenance — gate failed
  const mabwiser = byId.get("mabwiser");
  assert.ok(mabwiser);
  assert.equal(mabwiser.eligible, false);
  assert.equal(mabwiser.maintenanceAgeDays, 767);
  assert.ok(mabwiser.basis.includes("maintenance gate failed"));
  const mord = byId.get("mord");
  assert.ok(mord);
  assert.equal(mord.eligible, false);
  assert.equal(mord.maintenanceAgeDays, 1235);
  assert.ok(mord.basis.includes("maintenance gate failed"));
});

test("learning evaluation: maintenance gate fails when signals age out (deterministic)", () => {
  const stale = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES, ...LEARNING_SEED_PROFILES].map((profile) =>
      profile.id === "vowpal-wabbit"
        ? {
            ...profile,
            maintenance: [
              { ...profile.maintenance[0]!, date: "2020-01-01" },
            ],
          }
        : profile,
    ),
  );
  const staleCandidates = deriveLearningCandidateProfiles(stale);
  const assessments = assessLearningProductionEligibility(staleCandidates, stale, { maxMaintenanceAgeDays: 365 });
  const vw = assessments.find((assessment) => assessment.technologyId === "vowpal-wabbit");
  assert.ok(vw);
  assert.equal(vw.eligible, false);
  assert.ok(vw.basis.includes("maintenance gate failed"));
});

test("learning evaluation: ranking is deterministic — vowpal-wabbit is the top eligible pick", () => {
  const ranked = rankLearningProductionEligible(assessLearningProductionEligibility(candidates, registry));
  assert.equal(ranked[0]?.technologyId, "vowpal-wabbit");
  // deterministic replay
  const reranked = rankLearningProductionEligible(assessLearningProductionEligibility(candidates, registry));
  assert.deepEqual(reranked, ranked);
  // eligible candidates rank before ineligible ones
  const firstIneligible = ranked.findIndex((assessment) => !assessment.eligible);
  assert.ok(firstIneligible > 0);
  for (const assessment of ranked.slice(0, firstIneligible)) {
    assert.equal(assessment.eligible, true);
  }
});

test("learning evaluation: class shortlists cover the W6C classes", () => {
  assert.ok(learningCandidateIdsForClass(candidates, "rule-induction").includes("wittgenstein"));
  assert.ok(learningCandidateIdsForClass(candidates, "preference-learning").includes("mord"));
  assert.deepEqual(learningCandidateIdsForClass(candidates, "bandit-selection"), ["mabwiser", "vowpal-wabbit"]);
  assert.ok(learningCandidateIdsForClass(candidates, "contextual-ranking").includes("lightgbm"));
  assert.ok(learningCandidateIdsForClass(candidates, "contextual-ranking").includes("xgboost"));
  assert.ok(learningCandidateIdsForClass(candidates, "cost-aware-selection").includes("smac"));
  assert.ok(learningCandidateIdsForClass(candidates, "program-synthesis").includes("prose"));
  assert.ok(learningCandidateIdsForClass(candidates, "workflow-mining").includes("pm4py"));
  assert.equal(LEARNING_RESEARCH_DATE, "2026-10-12");
  assert.equal(LEARNING_EVALUATION_SCOPES.length, 8, "all eight frozen learning scopes in the coverage matrix");
  assert.equal(LEARNING_EVALUATION_USAGE_CLASSES.length, 6, "all six frozen usage classes in the coverage matrix");
});

test("learning evaluation: the vowpal-wabbit evaluation adapter fails closed when eligibility shifts", () => {
  const adapter = createVowpalWabbitLearningEvaluationAdapter(registry);
  assert.equal(adapter.profile.id, VOWPAL_WABBIT_EVALUATION_ADAPTER_ID);
  assert.equal(adapter.profile.productionEligible, true);
  assert.equal(adapter.profile.adapterKind, "evaluation");
  assert.ok(adapter.facts.eligibilityBasis.includes("BSD-3-Clause"));
  assert.equal(adapter.facts.maintenanceAgeDays, 15);
  assert.ok(vowpalWabbitEvaluationGenerator().includes("real Vowpal Wabbit not executed"), "honest generator label");
  // fail-closed: a registry where vowpal-wabbit's license is non-permissive refuses construction
  const relicensed = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES, ...LEARNING_SEED_PROFILES].map((profile) =>
      profile.id === "vowpal-wabbit"
        ? { ...profile, license: { ...profile.license, spdxId: "GPL-3.0-only", name: "GNU GPL v3 (fixture relicensing)" } }
        : profile,
    ),
  );
  assert.throws(() => createVowpalWabbitLearningEvaluationAdapter(relicensed), /top production-eligible/i);
  // fail-closed: a registry without the technology at all refuses construction
  const removed = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES, ...LEARNING_SEED_PROFILES].filter((profile) => profile.id !== "vowpal-wabbit"),
  );
  assert.throws(() => createVowpalWabbitLearningEvaluationAdapter(removed), /missing from the registry/);
});

test("learning evaluation: the evaluation adapter carries honest simulated markers on every output", () => {
  const adapter = createVowpalWabbitLearningEvaluationAdapter(registry);
  const fixture = LEARNING_BENCHMARK_FIXTURES[0]!;
  const invocation = fixtureInvocationSignal(fixture);
  const output = adapter.learn({
    requestId: "eval-honesty-1",
    signal: invocation,
    scope: invocation.scope,
    rights: {
      usage: ["tool-selection"],
      consentRef: "you-lab-eval-honesty-consent",
      consentHash: "b".repeat(64),
      expiresAt: null,
    },
    submittedAt: LEARNING_BENCH_SUBMITTED_AT,
  });
  assert.equal(output.simulated, true, "truth law: simulated execution, the real learner never ran");
  assert.equal(output.effort.effort.kind, "not-measured");
  assert.equal(output.effort.latency.kind === "not-measured" ? output.effort.latency.marker : "", "not-measured (simulated)");
  assert.equal(output.effort.cost.kind, "not-measured");
  assert.ok(adapter.profile.determinismNote.includes("not bit-reproducible"), "honest determinism note about the real tool");
});
