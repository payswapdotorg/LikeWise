// Contract seam v9 tests (W9C) — coverage: the research-organization
// outputs construct VALID frozen v9 shapes through the single seam module
// (LabWorldDescriptor / SearchLadderStep / FailureAtlasEntry /
// PipelineGenomeNode / LabRun / LabExperiment / LabEvidenceManifest /
// LabPromotionRecord), the run-status/arm-kind mappings are 1:1 at the
// seam, the full promotion-evidence path maps with the identity laws
// enforced (runs thread the experiment, manifests thread runs, atlas
// entries thread worlds/runs, genome parentRefs resolve), and the LAB
// PROMOTION LAW refuses to map non-admissible promotions into records.
import assert from "node:assert/strict";
import test from "node:test";
import {
  labResearchThroughHarness,
  mapLabArmKind,
  mapLabRunStatus,
  toFrozenFailureAtlasEntry,
  toFrozenLabEvidenceManifest,
  toFrozenLabExperiment,
  toFrozenLabPromotionRecord,
  toFrozenLabRun,
  toFrozenLabWorldDescriptor,
  toFrozenPipelineGenomeNode,
  toFrozenSearchLadderStep,
} from "../contractSeam.js";
import {
  GOLDEN_PROMOTION_REPORT_RUN_ID,
  HAND_DESIGNED_MUTATIONS,
  LAB_BENCH_SUBMITTED_AT,
  runStandardPromotionEvidenceBenchmark,
  type NeutralLabEvidenceManifest,
} from "./promotionEvidence.js";
import { synthesizeLabWorld, type LabWorldSpec } from "./worlds.js";
import { bestGenomeNode, createPipelineGenome } from "./pipelineGenome.js";
import { exploreSearchLadder, searchLadderStepId, type NeutralSearchLadderStep } from "./searchLadder.js";
import { canonicalJson } from "../determinism.js";

const report = runStandardPromotionEvidenceBenchmark();

function seamSpec(): LabWorldSpec {
  return {
    seed: "w9c-seam-world-01",
    actorCount: 3,
    cameraCount: 2,
    sensorCount: 1,
    lightingVariants: 1,
    noiseLevel: 0.2,
    occlusionEnabled: false,
    perturbationCount: 1,
  };
}

test("contract seam v9: run-status and arm-kind mappings are 1:1 and validated", () => {
  for (const status of ["submitted", "running", "succeeded", "failed", "retired"]) {
    assert.equal(mapLabRunStatus(status), status);
  }
  for (const arm of ["generalist-baseline", "hand-designed", "searched"]) {
    assert.equal(mapLabArmKind(arm), arm);
  }
  assert.throws(() => mapLabRunStatus("paused" as never), /no frozen v9 mapping/);
  assert.throws(() => mapLabRunStatus("" as never), /no frozen v9 mapping/);
  assert.throws(() => mapLabArmKind("randomized" as never), /no frozen v9 mapping/);
  assert.throws(() => mapLabArmKind("" as never), /no frozen v9 mapping/);
});

test("contract seam v9: toFrozenLabWorldDescriptor maps the seed-deterministic world 1:1", () => {
  const world = synthesizeLabWorld(seamSpec());
  const descriptor = toFrozenLabWorldDescriptor(world.descriptor);
  assert.equal(descriptor.id, world.descriptor.id);
  assert.equal(descriptor.seed, world.descriptor.seed);
  assert.equal(descriptor.actorCount, world.descriptor.actorCount);
  assert.equal(descriptor.groundTruthRef, world.groundTruth.id);
  assert.equal(descriptor.simulated, true);
  assert.throws(() => toFrozenLabWorldDescriptor({ ...world.descriptor, id: "" }), /empty id/);
  assert.throws(() => toFrozenLabWorldDescriptor({ ...world.descriptor, seed: "" }), /empty seed/);
  assert.throws(() => toFrozenLabWorldDescriptor({ ...world.descriptor, actorCount: 0 }), /actorCount/);
});

test("contract seam v9: toFrozenSearchLadderStep maps append-only steps with budget fields validated", () => {
  const step: NeutralSearchLadderStep = {
    id: searchLadderStepId("you_experiment_w9c-seamtest", 1, "search-bandits"),
    experimentId: "you_experiment_w9c-seamtest",
    step: 1,
    strategy: "search-bandits",
    exploredNodes: 3,
    bestScore: 0.75,
    cumulativeBudget: 4.5,
    simulated: true,
  };
  const frozen = toFrozenSearchLadderStep(step);
  assert.deepEqual(frozen, { ...step });
  assert.throws(() => toFrozenSearchLadderStep({ ...step, id: "" }), /empty id/);
  assert.throws(() => toFrozenSearchLadderStep({ ...step, experimentId: "" }), /empty experimentId/);
  assert.throws(() => toFrozenSearchLadderStep({ ...step, step: 0 }), /integer >= 1/);
  assert.throws(() => toFrozenSearchLadderStep({ ...step, strategy: "" }), /empty strategy/);
  assert.throws(() => toFrozenSearchLadderStep({ ...step, exploredNodes: -1 }), /integer >= 0/);
  assert.throws(() => toFrozenSearchLadderStep({ ...step, bestScore: 1.5 }), /outside \[0, 1\]/);
  assert.throws(() => toFrozenSearchLadderStep({ ...step, cumulativeBudget: -1 }), /finite >= 0/);
});

test("contract seam v9: toFrozenFailureAtlasEntry + toFrozenPipelineGenomeNode validate the observation/lineage laws", () => {
  const entry = report.failureAtlas[0]!;
  const frozenEntry = toFrozenFailureAtlasEntry(entry);
  assert.deepEqual(frozenEntry, { ...entry });
  assert.throws(() => toFrozenFailureAtlasEntry({ ...entry, id: "" }), /empty id/);
  assert.throws(() => toFrozenFailureAtlasEntry({ ...entry, evidenceRef: "" }), /FAILURE ATLAS LAW/);

  const node = bestGenomeNode(report.armResults.find((arm) => arm.arm === "searched")!.genome);
  const frozenNode = toFrozenPipelineGenomeNode(node);
  assert.deepEqual(frozenNode, { ...node });
  assert.throws(() => toFrozenPipelineGenomeNode({ ...node, id: "" }), /empty id/);
  assert.throws(() => toFrozenPipelineGenomeNode({ ...node, mutationKind: "" }), /empty mutationKind/);
  assert.throws(() => toFrozenPipelineGenomeNode({ ...node, score: 2 }), /outside \[0, 1\]/);
  assert.throws(() => toFrozenPipelineGenomeNode({ ...node, generation: -1 }), /integer >= 0/);
  assert.throws(() => toFrozenPipelineGenomeNode({ ...node, parentRef: "" }), /empty parentRef/);
});

test("contract seam v9: toFrozenLabRun / toFrozenLabExperiment / toFrozenLabEvidenceManifest map 1:1", () => {
  const arm = report.armResults[0]!;
  const run = toFrozenLabRun(arm.run);
  assert.equal(run.id, arm.run.id);
  assert.equal(run.experimentId, report.experiment.id);
  assert.equal(run.arm, "generalist-baseline");
  assert.equal(run.status, "succeeded");
  assert.equal(run.evidenceManifestRef, arm.manifest.id);
  assert.throws(() => toFrozenLabRun({ ...arm.run, id: "" }), /empty id/);
  assert.throws(() => toFrozenLabRun({ ...arm.run, planHash: "" }), /empty planHash/);
  assert.throws(() => toFrozenLabRun({ ...arm.run, status: "paused" as never }), /no frozen v9 mapping/);
  assert.throws(() => toFrozenLabRun({ ...arm.run, arm: "randomized" as never }), /no frozen v9 mapping/);

  const experiment = toFrozenLabExperiment(report.experiment);
  assert.deepEqual(experiment.arms, ["generalist-baseline", "hand-designed", "searched"]);
  assert.equal(experiment.objective, report.experiment.objective);
  assert.throws(() => toFrozenLabExperiment({ ...report.experiment, id: "" }), /empty id/);
  assert.throws(() => toFrozenLabExperiment({ ...report.experiment, arms: [] }), /arms is empty/);

  const manifest = toFrozenLabEvidenceManifest(arm.manifest);
  assert.equal(manifest.runId, arm.run.id);
  assert.deepEqual(manifest.artifactRefs, [...arm.manifest.artifactRefs]);
  assert.throws(() => toFrozenLabEvidenceManifest({ ...arm.manifest, id: "" }), /empty id/);
  assert.throws(() => toFrozenLabEvidenceManifest({ ...arm.manifest, contentHash: "" }), /content-addressed/);
  const emptyRefManifest: NeutralLabEvidenceManifest = { ...arm.manifest, artifactRefs: [""] };
  assert.throws(() => toFrozenLabEvidenceManifest(emptyRefManifest), /empty artifactRef/);
});

test("contract seam v9: toFrozenLabPromotionRecord enforces the LAB PROMOTION LAW (fail-closed)", () => {
  const record = toFrozenLabPromotionRecord({ id: "you_promotion_seamtest0001", evidence: report.promotion });
  assert.equal(record.id, "you_promotion_seamtest0001");
  assert.equal(record.experimentId, report.experiment.id);
  assert.equal(record.winnerArm, "searched");
  assert.equal(record.objectiveScore, report.promotion.searchedArmScore);
  assert.equal(record.baselineScore, report.promotion.baselineScore);
  assert.equal(record.evidenceManifestRef, report.promotion.evidenceManifestRef);
  assert.equal(record.decidedAt, LAB_BENCH_SUBMITTED_AT);
  assert.equal(record.simulated, true);
  // a non-admissible promotion never mints a record
  assert.throws(
    () => toFrozenLabPromotionRecord({ id: "you_promotion_seamtest0001", evidence: { ...report.promotion, promotionAdmissible: false } }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /YOU_LAB_PROMOTION_INVALID/);
      return true;
    },
  );
  assert.throws(() => toFrozenLabPromotionRecord({ id: "", evidence: report.promotion }), /empty id/);
});

test("contract seam v9: labResearchThroughHarness maps the full frozen v9 path with identity laws", () => {
  const path = labResearchThroughHarness(report);
  assert.equal(path.experiment.id, report.experiment.id);
  assert.equal(path.worlds.length, report.worlds.length);
  assert.equal(path.runs.length, 3);
  assert.equal(path.manifests.length, 3);
  for (const run of path.runs) {
    assert.equal(run.experimentId, path.experiment.id);
    assert.ok(path.manifests.some((manifest) => manifest.id === run.evidenceManifestRef));
  }
  for (const manifest of path.manifests) {
    assert.ok(path.runs.some((run) => run.id === manifest.runId));
  }
  const searched = report.armResults.find((arm) => arm.arm === "searched")!;
  assert.equal(path.ladderSteps.length, searched.searchLadder!.steps.length);
  for (const step of path.ladderSteps) {
    assert.equal(step.experimentId, path.experiment.id);
  }
  // the genome node set is the deduplicated union across arms (the shared seed root appears once)
  const rootNode = searched.genome.nodes[0]!;
  assert.equal(path.genomeNodes.filter((node) => node.id === rootNode.id).length, 1);
  const nodeIds = new Set(path.genomeNodes.map((node) => node.id));
  for (const node of path.genomeNodes) {
    assert.ok(node.parentRef === null || nodeIds.has(node.parentRef), "lineage integrity: parentRefs resolve");
  }
  assert.ok(path.genomeNodes.length >= 1 + HAND_DESIGNED_MUTATIONS.length + searched.searchLadder!.genome.nodes.length - 1);
  assert.equal(path.atlasEntries.length, report.failureAtlas.length);
  for (const entry of path.atlasEntries) {
    assert.ok(path.worlds.some((world) => world.id === entry.worldRef));
    assert.ok(path.runs.some((run) => run.id === entry.runRef));
  }
  assert.ok(path.promotion);
  assert.equal(path.promotion!.winnerArm, "searched");
  assert.equal(path.promotion!.objectiveScore, report.promotion.searchedArmScore);
  // determinism: the mapped path replays byte-identically
  const replay = labResearchThroughHarness(runStandardPromotionEvidenceBenchmark());
  assert.equal(canonicalJson(replay), canonicalJson(path));
  assert.equal(report.runId, GOLDEN_PROMOTION_REPORT_RUN_ID);
});

test("contract seam v9: a non-admissible report maps to a null promotion (no record, no exception)", () => {
  const doctoredArms = report.armResults.map((arm) =>
    arm.arm === "searched"
      ? { ...arm, overallQualityScore: 0.1, fixtureScores: arm.fixtureScores.map((entry) => ({ ...entry, qualityScore: 0.1 })) }
      : arm,
  );
  const doctored = { ...report, armResults: doctoredArms, promotion: { ...report.promotion, promotionAdmissible: false, searchedArmScore: 0.1 } };
  const path = labResearchThroughHarness(doctored);
  assert.equal(path.promotion, null);
});

test("contract seam v9: identity-law violations on the full path are refused", () => {
  // a run threading a foreign experiment is refused
  const foreignRun = report.armResults.map((arm) =>
    arm === report.armResults[0] ? { ...arm, run: { ...arm.run, experimentId: "you_experiment_other" } } : arm,
  );
  assert.throws(
    () => labResearchThroughHarness({ ...report, armResults: foreignRun }),
    /identity law/,
  );
  // a manifest threading a foreign run is refused
  const foreignManifest = report.armResults.map((arm) =>
    arm === report.armResults[0] ? { ...arm, manifest: { ...arm.manifest, runId: "you_lab-run_missing00000" } } : arm,
  );
  assert.throws(
    () => labResearchThroughHarness({ ...report, armResults: foreignManifest }),
    /identity law/,
  );
  // an atlas entry referencing a missing world is refused
  const foreignAtlas = [{ ...report.failureAtlas[0]!, worldRef: "you_world_missing0000000" }];
  assert.throws(
    () => labResearchThroughHarness({ ...report, failureAtlas: foreignAtlas }),
    /identity law/,
  );
});

test("contract seam v9: an independent ladder maps onto frozen steps 1:1", () => {
  const experimentId = "you_experiment_w9c-seamtest";
  const genome = createPipelineGenome(experimentId, "seam-ladder-root", 0.4);
  const result = exploreSearchLadder(
    { experimentId, budgetCap: 6, nodeCost: 1, nodesPerStep: 2, strategies: ["deterministic-replay", "search-bandits"] },
    "seam-ladder-seed",
    genome,
    { scoreCandidate: () => 0.5 },
  );
  const frozenSteps = result.steps.map(toFrozenSearchLadderStep);
  assert.equal(frozenSteps.length, result.steps.length);
  for (let index = 0; index < frozenSteps.length; index++) {
    assert.equal(frozenSteps[index]!.id, result.steps[index]!.id);
    assert.equal(frozenSteps[index]!.simulated, true);
  }
});
