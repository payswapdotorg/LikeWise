// Promotion-evidence benchmark tests (W9C) — coverage: golden per-fixture
// and overall arm scores on the seeded fixture set (byte-identical
// replay), the LAB.md three-arm comparison law, the LAB PROMOTION LAW
// (searched promotes only when it beats the baseline — the evidence, not
// the decision), the SEARCH BUDGET LAW terminal in the searched arm's
// ladder, content-addressed evidence manifests threading run identity,
// the Failure Atlas observations from the arm runs, and the honest
// not-measured / W10+ compute-plane markers (truth law).
import assert from "node:assert/strict";
import test from "node:test";
import {
  GOLDEN_ARM_OVERALL,
  GOLDEN_PROMOTION_REPORT_RUN_ID,
  HAND_DESIGNED_MUTATIONS,
  LAB_BENCH_SUBMITTED_AT,
  LAB_COMPARISON_ARMS,
  LAB_EVIDENCE_MANIFEST_INVALID_CODE,
  LAB_PROMOTION_INVALID_CODE,
  LabEvidenceManifestInvalidError,
  LabPromotionInvalidError,
  PROMOTION_EVIDENCE_FIXTURES,
  PROMOTION_EVIDENCE_FIXTURE_SET_VERSION,
  STANDARD_SEARCH_LADDER_PLAN,
  assertValidEvidenceManifest,
  evaluatePromotionEvidence,
  runPromotionEvidenceBenchmark,
  runStandardPromotionEvidenceBenchmark,
  standardLabExperiment,
  type ArmEvidenceResult,
  type NeutralLabExperiment,
} from "./promotionEvidence.js";
import { canonicalJson } from "../determinism.js";

const report = runStandardPromotionEvidenceBenchmark();

function byArm(arm: string): ArmEvidenceResult {
  const found = report.armResults.find((entry) => entry.arm === arm);
  assert.ok(found, `arm ${arm} present`);
  return found;
}

test("promotion evidence: golden per-fixture arm scores (exact match, recorded values)", () => {
  for (let index = 0; index < PROMOTION_EVIDENCE_FIXTURES.length; index++) {
    const fixture = PROMOTION_EVIDENCE_FIXTURES[index]!;
    for (const arm of report.armResults) {
      const score = arm.fixtureScores[index]!;
      assert.equal(score.fixtureId, fixture.fixtureId);
      assert.equal(
        score.qualityScore,
        fixture.expectedScores[arm.arm],
        `${fixture.fixtureId} / ${arm.arm}: golden per-fixture score`,
      );
    }
  }
});

test("promotion evidence: golden overall arm scores and the golden report digest", () => {
  const overall = Object.fromEntries(report.armResults.map((arm) => [arm.arm, arm.overallQualityScore]));
  assert.deepEqual(overall, { ...GOLDEN_ARM_OVERALL });
  assert.equal(report.runId, GOLDEN_PROMOTION_REPORT_RUN_ID);
  assert.equal(report.fixtureSetVersion, PROMOTION_EVIDENCE_FIXTURE_SET_VERSION);
  // overall is the mean of the per-fixture goldens rounded to 4 decimals (deterministic arithmetic)
  for (const arm of report.armResults) {
    const mean = arm.fixtureScores.reduce((sum, entry) => sum + entry.qualityScore, 0) / arm.fixtureScores.length;
    assert.ok(Math.abs(arm.overallQualityScore - mean) <= 5e-5);
  }
});

test("promotion evidence: byte-identical replay from the same inputs", () => {
  const replay = runStandardPromotionEvidenceBenchmark();
  assert.equal(canonicalJson(replay), canonicalJson(report));
  assert.equal(replay.runId, report.runId);
  // a different ladder seed explores differently and mints a different report
  const other = runStandardPromotionEvidenceBenchmark("w9c-other-ladder-seed");
  assert.notEqual(other.runId, report.runId);
});

test("promotion evidence: the three LAB.md comparison arms, exactly", () => {
  assert.deepEqual(report.armResults.map((arm) => arm.arm), [...LAB_COMPARISON_ARMS]);
  assert.equal(report.armResults.length, 3);
  assert.ok(report.experiment.arms.includes("generalist-baseline"));
  assert.ok(report.experiment.arms.includes("hand-designed"));
  assert.ok(report.experiment.arms.includes("searched"));
  assert.equal(report.experiment.simulated, true);
});

test("promotion evidence: the LAB PROMOTION LAW — searched beats the baseline on the golden run", () => {
  const searched = byArm("searched").overallQualityScore;
  const baseline = byArm("generalist-baseline").overallQualityScore;
  const handDesigned = byArm("hand-designed").overallQualityScore;
  assert.ok(searched > baseline, `searched (${searched}) must beat baseline (${baseline})`);
  assert.ok(searched > handDesigned, `searched (${searched}) must beat hand-designed (${handDesigned})`);
  assert.ok(handDesigned > baseline, "the golden ordering is baseline < hand-designed < searched");
  assert.equal(report.promotion.promotionAdmissible, true);
  assert.equal(report.promotion.searchedArmScore, searched);
  assert.equal(report.promotion.baselineScore, baseline);
  assert.equal(report.promotion.evidenceManifestRef, byArm("searched").manifest.id);
  assert.equal(report.promotion.simulated, true);
});

test("promotion evidence: a searched arm that does NOT beat the baseline is not admissible (the law, both ways)", () => {
  // a doctored core where the searched arm loses: the evidence must report
  // non-admissible (the gate would refuse the promotion)
  const doctoredArms = report.armResults.map((arm) =>
    arm.arm === "searched"
      ? { ...arm, overallQualityScore: 0.1, fixtureScores: arm.fixtureScores.map((entry) => ({ ...entry, qualityScore: 0.1 })) }
      : arm,
  );
  const doctored = evaluatePromotionEvidence({ experiment: report.experiment, armResults: doctoredArms });
  assert.equal(doctored.promotionAdmissible, false);
  // and a missing arm is a typed YOU_LAB_PROMOTION_INVALID rejection
  assert.throws(
    () => evaluatePromotionEvidence({ experiment: report.experiment, armResults: doctoredArms.slice(0, 2) }),
    (error: unknown) => {
      assert.ok(error instanceof LabPromotionInvalidError);
      assert.equal(error.code, LAB_PROMOTION_INVALID_CODE);
      return true;
    },
  );
});

test("promotion evidence: the searched arm's ladder runs under budget with a recorded terminal (SEARCH BUDGET LAW)", () => {
  const searched = byArm("searched");
  assert.ok(searched.searchLadder);
  const ladder = searched.searchLadder;
  assert.equal(ladder.terminal.kind, "budget-exhausted");
  assert.match(ladder.terminal.reason, /never a silent stop/);
  assert.equal(ladder.terminal.cumulativeBudget, STANDARD_SEARCH_LADDER_PLAN.budgetCap);
  for (const step of ladder.steps) {
    assert.ok(step.cumulativeBudget <= STANDARD_SEARCH_LADDER_PLAN.budgetCap, "no step exceeds the cap");
    assert.equal(step.experimentId, report.experiment.id);
    assert.equal(step.simulated, true);
  }
  // the terminal is the final step of the append-only ledger
  const last = ladder.steps[ladder.steps.length - 1]!;
  assert.equal(last.strategy, "budget-exhausted");
  assert.equal(last.step, ladder.steps.length);
  // the searched run's lineage node exists in the ladder's genome
  assert.ok(ladder.genome.nodes.some((node) => node.id === ladder.bestNodeId));
  assert.equal(searched.run.planHash.length, 8);
});

test("promotion evidence: the hand-designed arm is the authored mutation sequence", () => {
  const hand = byArm("hand-designed");
  assert.equal(hand.searchLadder, null);
  assert.equal(hand.genome.nodes.length, 1 + HAND_DESIGNED_MUTATIONS.length);
  assert.deepEqual(
    hand.genome.nodes.slice(1).map((node) => node.mutationKind),
    [...HAND_DESIGNED_MUTATIONS],
  );
});

test("promotion evidence: evidence manifests are content-addressed and thread run identity", () => {
  for (const arm of report.armResults) {
    assert.equal(arm.manifest.runId, arm.run.id);
    assert.equal(arm.run.evidenceManifestRef, arm.manifest.id);
    assert.equal(arm.run.experimentId, report.experiment.id);
    assert.equal(arm.run.status, "succeeded");
    assert.equal(arm.run.completedAt, LAB_BENCH_SUBMITTED_AT);
    assert.equal(arm.run.simulated, true);
    assert.equal(arm.manifest.publishedAt, LAB_BENCH_SUBMITTED_AT);
    assert.equal(arm.manifest.simulated, true);
    assert.match(arm.manifest.id, /^you_evidence_[0-9a-f]{16}$/);
    assert.equal(arm.manifest.artifactRefs.length, arm.outcomes.length);
    // every artifact ref resolves to an outcome evidence ref
    for (let index = 0; index < arm.outcomes.length; index++) {
      assert.equal(arm.manifest.artifactRefs[index], arm.outcomes[index]!.evidenceRef);
    }
    // manifest ids are unique per arm
  }
  const manifestIds = new Set(report.armResults.map((arm) => arm.manifest.id));
  assert.equal(manifestIds.size, report.armResults.length);
  // malformed manifests are typed YOU_LAB_EVIDENCE_MANIFEST_INVALID rejections
  const good = report.armResults[0]!.manifest;
  const malformed = [
    { ...good, id: "" },
    { ...good, runId: "" },
    { ...good, contentHash: "" },
    { ...good, publishedAt: "not-a-date" },
    { ...good, artifactRefs: [...good.artifactRefs, ""] },
  ];
  for (const bad of malformed) {
    assert.throws(
      () => assertValidEvidenceManifest(bad),
      (error: unknown) => {
        assert.ok(error instanceof LabEvidenceManifestInvalidError);
        assert.equal(error.code, LAB_EVIDENCE_MANIFEST_INVALID_CODE);
        return true;
      },
    );
  }
});

test("promotion evidence: the Failure Atlas records the observed failures with evidence refs (FAILURE ATLAS LAW)", () => {
  // the golden run: the baseline and hand-designed arms fail on the live-event world
  assert.ok(report.failureAtlas.length >= 1, "the golden run observes at least one failure");
  const worldIds = new Set(report.worlds.map((world) => world.descriptor.id));
  const runIds = new Set(report.armResults.map((arm) => arm.run.id));
  for (const entry of report.failureAtlas) {
    assert.ok(worldIds.has(entry.worldRef));
    assert.ok(runIds.has(entry.runRef));
    assert.ok(entry.evidenceRef.startsWith("content-store://you-lab/world-run/"));
    assert.equal(entry.simulated, true);
  }
  // the searched arm's own runs observed no failures on the golden run (the search escaped the failure band)
  assert.ok(byArm("searched").outcomes.every((outcome) => outcome.failureClass === null));
  // every entry traces to an actual failing outcome
  const failingOutcomes = report.armResults.flatMap((arm) => arm.outcomes.filter((outcome) => outcome.failureClass !== null));
  assert.equal(report.failureAtlas.length, failingOutcomes.length);
});

test("promotion evidence: honest markers — not-measured effort/latency/cost, W10+ compute-plane boundary, computed scores", () => {
  for (const arm of report.armResults) {
    for (const field of [arm.effort, arm.latency, arm.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
    }
  }
  assert.ok(report.notes.some((note) => note.includes("not user studies")));
  assert.ok(report.notes.some((note) => note.includes("not HUMAN-REALITY evidence")));
  assert.ok(report.notes.some((note) => note.includes("W10+ boundary")));
  assert.ok(report.notes.some((note) => note.includes("promotion gate decides")));
  assert.ok(report.notes.some((note) => note.includes("never a silent stop")));
  for (const arm of report.armResults) {
    for (const outcome of arm.outcomes) {
      assert.equal(outcome.simulated, true);
      assert.ok(outcome.qualityScore >= 0 && outcome.qualityScore <= 1);
    }
  }
  // the worlds in the report are the fixture worlds, seed-deterministic
  assert.equal(report.worlds.length, PROMOTION_EVIDENCE_FIXTURES.length);
});

test("promotion evidence: harness inputs are validated fail-closed", () => {
  const experiment: NeutralLabExperiment = standardLabExperiment(STANDARD_SEARCH_LADDER_PLAN);
  const run = () => runPromotionEvidenceBenchmark(experiment, PROMOTION_EVIDENCE_FIXTURES, STANDARD_SEARCH_LADDER_PLAN, "seed");
  assert.doesNotThrow(run);
  assert.throws(
    () => runPromotionEvidenceBenchmark({ ...experiment, id: "" }, PROMOTION_EVIDENCE_FIXTURES, STANDARD_SEARCH_LADDER_PLAN, "s"),
    /experiment id is empty/,
  );
  assert.throws(
    () => runPromotionEvidenceBenchmark(experiment, [], STANDARD_SEARCH_LADDER_PLAN, "s"),
    /fixture set is empty/,
  );
  assert.throws(
    () => runPromotionEvidenceBenchmark(experiment, [...PROMOTION_EVIDENCE_FIXTURES, PROMOTION_EVIDENCE_FIXTURES[0]!], STANDARD_SEARCH_LADDER_PLAN, "s"),
    /duplicate fixtureId/,
  );
  assert.throws(
    () =>
      runPromotionEvidenceBenchmark(
        experiment,
        [...PROMOTION_EVIDENCE_FIXTURES, { ...PROMOTION_EVIDENCE_FIXTURES[0]!, fixtureId: "another-fixture" }],
        STANDARD_SEARCH_LADDER_PLAN,
        "s",
      ),
    /duplicate world seed/,
  );
  assert.throws(
    () =>
      runPromotionEvidenceBenchmark(
        experiment,
        PROMOTION_EVIDENCE_FIXTURES,
        { ...STANDARD_SEARCH_LADDER_PLAN, experimentId: "you_experiment_other" },
        "s",
      ),
    /identity law/,
  );
});
