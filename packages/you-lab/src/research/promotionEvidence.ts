// Promotion-evidence benchmark harness (W9C) — the stage-9 exit.
//
// Authority: docs/you/LAB.md "Organization comparison" (every serious lab
// experiment compares a generalist baseline, a hand-designed organization
// and a searched organization; the searched organization is only promoted
// when it beats the baseline under the relevant objective and constraints)
// and the LAB PROMOTION LAW (docs/you/CONTRACTS.md "Wave-9 contract freeze
// (v9)"): a searched organization promotes ONLY when it beats the
// generalist baseline under the experiment's recorded objective and
// constraints. docs/you/IMPLEMENTATION_PLAN.md stage 9 exit: HUMAN-REALITY
// benchmark produces reproducible organization/pipeline evidence.
//
// This harness produces that evidence reproducibly inside the research
// plane: seeded fixture worlds (evidenceFixtures.ts), the three comparison
// arms (baseline = the seed pipeline unchanged; hand-designed = an
// authored mutation sequence; searched = the budget-capped search ladder
// over the pipeline genome), one durable neutral LabRun +
// content-addressed LabEvidenceManifest per arm, the Failure Atlas
// observations from the arm runs, and the promotion-decision evidence the
// promotion gate (W9A) consumes. All neutral shapes are aligned 1:1 with
// the frozen v9 contracts; mapping onto the frozen contract happens ONLY
// in src/contractSeam.ts.
//
// TRUTH LAW: every score is a computed deterministic fixture objective
// over SIMULATED lab worlds — not user studies, not live measurements and
// not HUMAN-REALITY evidence; the compute plane stays simulated (W10+
// boundary — no real provider, renderer, organization runtime or search
// engine is invoked); effort/latency/cost are explicit not-measured
// markers. This report is EVIDENCE; the promotion gate decides.

import { canonicalJson, fnv1a32, roundTo } from "../determinism.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import type { MetricField } from "../benchmarks/runner.js";
import { runWorldPipeline, synthesizeLabWorld, type LabWorld, type LabWorldRunOutcome } from "./worlds.js";
import {
  appendGenomeMutation,
  bestGenomeNode,
  createPipelineGenomeFromNode,
  genomeChildNodeId,
  genomeLineage,
  seedGenomeNode,
  type NeutralPipelineGenomeNode,
  type PipelineGenome,
} from "./pipelineGenome.js";
import { exploreSearchLadder, type SearchLadderPlan, type SearchLadderResult, type SearchLadderScorer } from "./searchLadder.js";
import { appendAtlasEntry, buildFailureAtlasEntry, collectFailureObservations, type NeutralFailureAtlasEntry } from "./failureAtlas.js";
import {
  LAB_BENCH_SUBMITTED_AT,
  HAND_DESIGNED_MUTATIONS,
  PROMOTION_EVIDENCE_FIXTURES,
  PROMOTION_EVIDENCE_FIXTURE_SET_VERSION,
  STANDARD_LAB_EXPERIMENT_ID,
  STANDARD_LAB_INTENT_REF,
  STANDARD_LAB_OBJECTIVE,
  STANDARD_SEARCH_LADDER_PLAN,
  type PromotionEvidenceFixture,
} from "./evidenceFixtures.js";

/** Error code aligned with the frozen v9 typed error literal (you-lab-owned). */
export const LAB_EVIDENCE_MANIFEST_INVALID_CODE = "YOU_LAB_EVIDENCE_MANIFEST_INVALID";

/** Typed rejection thrown when an evidence manifest is malformed. */
export class LabEvidenceManifestInvalidError extends Error {
  readonly code = LAB_EVIDENCE_MANIFEST_INVALID_CODE;
  constructor(detail: string) {
    super(`${LAB_EVIDENCE_MANIFEST_INVALID_CODE}: ${detail}`);
  }
}

/** Error code aligned with the frozen v9 typed error literal (you-lab-owned). */
export const LAB_PROMOTION_INVALID_CODE = "YOU_LAB_PROMOTION_INVALID";

/** Typed rejection thrown when the promotion law is violated. */
export class LabPromotionInvalidError extends Error {
  readonly code = LAB_PROMOTION_INVALID_CODE;
  constructor(detail: string) {
    super(`${LAB_PROMOTION_INVALID_CODE}: ${detail}`);
  }
}

/** Neutral lab run status — aligned 1:1 with the frozen v9 LabRunStatus. */
export type NeutralLabRunStatus = "submitted" | "running" | "succeeded" | "failed" | "retired" | (string & {});

/** Neutral comparison arm — aligned 1:1 with the frozen v9 LabArmKind (the LAB.md three-arm law). */
export type NeutralLabArmKind = "generalist-baseline" | "hand-designed" | "searched" | (string & {});

/** The three LAB.md comparison arms in canonical order. */
export const LAB_COMPARISON_ARMS: readonly NeutralLabArmKind[] = ["generalist-baseline", "hand-designed", "searched"];

/** Neutral durable lab run — aligned 1:1 with the frozen v9 LabRun (immutable; ladder append-only). */
export interface NeutralLabRunRecord {
  readonly id: string;
  readonly experimentId: string;
  readonly arm: NeutralLabArmKind;
  readonly planHash: string;
  readonly status: NeutralLabRunStatus;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly evidenceManifestRef: string | null;
  readonly simulated: boolean;
}

/** Neutral durable experiment container — aligned 1:1 with the frozen v9 LabExperiment (immutable once declared). */
export interface NeutralLabExperiment {
  readonly id: string;
  readonly intentRef: string;
  readonly constraintsHash: string;
  readonly objective: string;
  readonly arms: readonly NeutralLabArmKind[];
  readonly promotionRef: string | null;
  readonly simulated: boolean;
}

/** Neutral content-addressed evidence bundle — aligned 1:1 with the frozen v9 LabEvidenceManifest. */
export interface NeutralLabEvidenceManifest {
  readonly id: string;
  readonly runId: string;
  readonly contentHash: string;
  readonly artifactRefs: readonly string[];
  readonly publishedAt: string;
  readonly simulated: boolean;
}

/** One per-fixture arm score. */
export interface FixtureArmScore {
  readonly fixtureId: string;
  readonly qualityScore: number;
}

/** One comparison arm's evidence: run, manifest, outcomes, genome and (searched only) the ladder. */
export interface ArmEvidenceResult {
  readonly arm: NeutralLabArmKind;
  readonly label: string;
  readonly fixtureScores: readonly FixtureArmScore[];
  readonly overallQualityScore: number;
  readonly outcomes: readonly LabWorldRunOutcome[];
  readonly run: NeutralLabRunRecord;
  readonly manifest: NeutralLabEvidenceManifest;
  readonly genome: PipelineGenome;
  readonly searchLadder: SearchLadderResult | null;
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

/** The promotion-gate input the harness produces (the LAB PROMOTION LAW evidence). */
export interface PromotionDecisionEvidence {
  readonly experimentId: string;
  readonly objective: string;
  readonly searchedArmScore: number;
  readonly baselineScore: number;
  readonly handDesignedScore: number;
  /** searched > baseline under the recorded objective — the gate promotes only when true. */
  readonly promotionAdmissible: boolean;
  readonly evidenceManifestRef: string;
  readonly decidedAt: string;
  readonly simulated: boolean;
}

/** The reproducible promotion-evidence report (golden runId pinned by tests). */
export interface PromotionEvidenceReport {
  readonly runId: string;
  readonly fixtureSetVersion: string;
  readonly experiment: NeutralLabExperiment;
  readonly worlds: readonly LabWorld[];
  readonly armResults: readonly ArmEvidenceResult[];
  readonly failureAtlas: readonly NeutralFailureAtlasEntry[];
  readonly promotion: PromotionDecisionEvidence;
  readonly notes: readonly string[];
}

// Re-export the fixture surface (the W2C-W8C fixtures-module precedent:
// fixtures + goldens live in evidenceFixtures.ts; consumers import them
// from either module).
export {
  GOLDEN_ARM_OVERALL,
  GOLDEN_PROMOTION_REPORT_RUN_ID,
  HAND_DESIGNED_MUTATIONS,
  LAB_BENCH_SUBMITTED_AT,
  PROMOTION_EVIDENCE_FIXTURES,
  PROMOTION_EVIDENCE_FIXTURE_SET_VERSION,
  STANDARD_LAB_EXPERIMENT_ID,
  STANDARD_LAB_INTENT_REF,
  STANDARD_LAB_OBJECTIVE,
  STANDARD_SEARCH_LADDER_PLAN,
  type PromotionEvidenceFixture,
} from "./evidenceFixtures.js";

function notMeasured(): MetricField {
  return { kind: "not-measured", marker: "not-measured (simulated)" };
}

function describeArm(arm: NeutralLabArmKind): string {
  switch (arm) {
    case "generalist-baseline":
      return "generalist baseline: the seed pipeline bound to every world unchanged";
    case "hand-designed":
      return "hand-designed organization: authored mutation sequence on the seed pipeline";
    case "searched":
      return "searched organization: budget-capped ladder exploration over the pipeline genome";
    default:
      return `unknown arm '${arm}'`;
  }
}

function labRunId(experimentId: string, arm: string): string {
  return `you_lab-run_${sha256Hex(`${experimentId}|${arm}`).slice(0, 16)}`;
}

function meanQuality(worlds: readonly LabWorld[], lineage: readonly NeutralPipelineGenomeNode[], probeId: string): number {
  const scores = worlds.map((world) =>
    runWorldPipeline(world, lineage, { runId: probeId, submittedAt: LAB_BENCH_SUBMITTED_AT }).qualityScore,
  );
  return roundTo(scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1), 4);
}

/** Fail-closed manifest validation (the content-addressing law: the hash binds the artifact refs). */
export function assertValidEvidenceManifest(manifest: NeutralLabEvidenceManifest): void {
  if (manifest.id.length === 0) {
    throw new LabEvidenceManifestInvalidError("manifest id is empty");
  }
  if (manifest.runId.length === 0) {
    throw new LabEvidenceManifestInvalidError(`manifest ${manifest.id}: runId is empty (a manifest names its run)`);
  }
  if (manifest.contentHash.length === 0) {
    throw new LabEvidenceManifestInvalidError(`manifest ${manifest.id}: contentHash is empty (evidence is content-addressed)`);
  }
  for (const ref of manifest.artifactRefs) {
    if (ref.length === 0) {
      throw new LabEvidenceManifestInvalidError(`manifest ${manifest.id}: empty artifactRef (refs are content addresses)`);
    }
  }
  if (manifest.publishedAt.length === 0 || Number.isNaN(Date.parse(manifest.publishedAt))) {
    throw new LabEvidenceManifestInvalidError(`manifest ${manifest.id}: publishedAt is not a parseable ISO timestamp`);
  }
}

function buildManifest(
  arm: string,
  runId: string,
  outcomes: readonly LabWorldRunOutcome[],
  fixtureSetVersion: string,
): NeutralLabEvidenceManifest {
  const payload = { arm, fixtureSetVersion, outcomes };
  const contentHash = sha256Hex(canonicalJson(payload));
  const manifest: NeutralLabEvidenceManifest = {
    id: `you_evidence_${sha256Hex(`${runId}|${contentHash}`).slice(0, 16)}`,
    runId,
    contentHash,
    artifactRefs: outcomes.map((outcome) => outcome.evidenceRef),
    publishedAt: LAB_BENCH_SUBMITTED_AT,
    simulated: true,
  };
  assertValidEvidenceManifest(manifest);
  return manifest;
}

/**
 * Evaluate the promotion law over an experiment's arm results (pure): the
 * searched arm is promotion-admissible ONLY when it beats the generalist
 * baseline under the recorded objective. This is EVIDENCE for the
 * promotion gate — never a promotion decision.
 */
export function evaluatePromotionEvidence(core: {
  readonly experiment: NeutralLabExperiment;
  readonly armResults: readonly ArmEvidenceResult[];
}): PromotionDecisionEvidence {
  const byArm = new Map(core.armResults.map((arm) => [arm.arm, arm]));
  const searched = byArm.get("searched");
  const baseline = byArm.get("generalist-baseline");
  const handDesigned = byArm.get("hand-designed");
  if (!searched || !baseline || !handDesigned) {
    throw new LabPromotionInvalidError(
      "the three-arm comparison law requires generalist-baseline, hand-designed and searched arm results",
    );
  }
  return {
    experimentId: core.experiment.id,
    objective: core.experiment.objective,
    searchedArmScore: searched.overallQualityScore,
    baselineScore: baseline.overallQualityScore,
    handDesignedScore: handDesigned.overallQualityScore,
    promotionAdmissible: searched.overallQualityScore > baseline.overallQualityScore,
    evidenceManifestRef: searched.manifest.id,
    decidedAt: LAB_BENCH_SUBMITTED_AT,
    simulated: true,
  };
}

function validateHarnessInputs(
  experiment: NeutralLabExperiment,
  fixtures: readonly PromotionEvidenceFixture[],
  ladderPlan: SearchLadderPlan,
): void {
  if (experiment.id.length === 0) throw new Error("runPromotionEvidenceBenchmark: experiment id is empty");
  if (experiment.intentRef.length === 0) throw new Error("runPromotionEvidenceBenchmark: intentRef is empty");
  if (experiment.objective.length === 0) throw new Error("runPromotionEvidenceBenchmark: objective is empty");
  if (fixtures.length === 0) throw new Error("runPromotionEvidenceBenchmark: the fixture set is empty");
  const fixtureIds = new Set<string>();
  const worldSeeds = new Set<string>();
  for (const fixture of fixtures) {
    if (fixture.fixtureId.length === 0) throw new Error("runPromotionEvidenceBenchmark: empty fixtureId");
    if (fixtureIds.has(fixture.fixtureId)) {
      throw new Error(`runPromotionEvidenceBenchmark: duplicate fixtureId '${fixture.fixtureId}'`);
    }
    fixtureIds.add(fixture.fixtureId);
    if (worldSeeds.has(fixture.worldSpec.seed)) {
      throw new Error(`runPromotionEvidenceBenchmark: duplicate world seed '${fixture.worldSpec.seed}' (worlds must be distinct)`);
    }
    worldSeeds.add(fixture.worldSpec.seed);
  }
  if (ladderPlan.experimentId !== experiment.id) {
    throw new Error(
      `runPromotionEvidenceBenchmark: ladder plan experiment '${ladderPlan.experimentId}' != experiment '${experiment.id}' (identity law)`,
    );
  }
}

/**
 * Run the three-arm promotion-evidence benchmark: seeded worlds, baseline
 * vs hand-designed vs searched (ladder under budget), durable runs +
 * content-addressed manifests, the Failure Atlas observations and the
 * promotion-decision evidence. Deterministic: the same inputs replay
 * byte-identically (golden runId).
 */
export function runPromotionEvidenceBenchmark(
  experiment: NeutralLabExperiment,
  fixtures: readonly PromotionEvidenceFixture[],
  ladderPlan: SearchLadderPlan,
  ladderSeed: string,
): PromotionEvidenceReport {
  validateHarnessInputs(experiment, fixtures, ladderPlan);
  const worlds = fixtures.map((fixture) => synthesizeLabWorld(fixture.worldSpec));
  const fixtureIds = fixtures.map((fixture) => fixture.fixtureId);
  const scorer: SearchLadderScorer = {
    scoreCandidate: (candidate, lineage) => meanQuality(worlds, lineage, `ladder-probe|${candidate.id}`),
  };
  const root = seedGenomeNode(experiment.id, ladderSeed);
  const rootScore = meanQuality(worlds, [root], `root-probe|${root.id}`);
  const runArm = (
    arm: NeutralLabArmKind,
    genome: PipelineGenome,
    nodeId: string,
    searchLadder: SearchLadderResult | null,
    planDetail: Readonly<Record<string, unknown>>,
  ): ArmEvidenceResult => {
    const lineage = genomeLineage(genome, nodeId);
    const runId = labRunId(experiment.id, arm);
    const outcomes = worlds.map((world) =>
      runWorldPipeline(world, lineage, { runId, submittedAt: LAB_BENCH_SUBMITTED_AT }),
    );
    const fixtureScores: FixtureArmScore[] = outcomes.map((outcome, index) => ({
      fixtureId: fixtureIds[index]!,
      qualityScore: outcome.qualityScore,
    }));
    const overall = roundTo(
      fixtureScores.reduce((sum, entry) => sum + entry.qualityScore, 0) / Math.max(fixtureScores.length, 1),
      4,
    );
    const manifest = buildManifest(arm, runId, outcomes, PROMOTION_EVIDENCE_FIXTURE_SET_VERSION);
    const planPayload = { arm, rootId: root.id, bestNodeId: nodeId, ...planDetail };
    const run: NeutralLabRunRecord = {
      id: runId,
      experimentId: experiment.id,
      arm,
      planHash: fnv1a32(canonicalJson(planPayload)),
      status: "succeeded",
      submittedAt: LAB_BENCH_SUBMITTED_AT,
      completedAt: LAB_BENCH_SUBMITTED_AT,
      evidenceManifestRef: manifest.id,
      simulated: true,
    };
    return {
      arm,
      label: describeArm(arm),
      fixtureScores,
      overallQualityScore: overall,
      outcomes,
      run,
      manifest,
      genome,
      searchLadder,
      effort: notMeasured(),
      latency: notMeasured(),
      cost: notMeasured(),
    };
  };
  const baselineGenome = createPipelineGenomeFromNode(experiment.id, { ...root, score: rootScore });
  const baselineArm = runArm("generalist-baseline", baselineGenome, root.id, null, {});
  let handDesignedGenome = createPipelineGenomeFromNode(experiment.id, { ...root, score: rootScore });
  let handDesignedNodeId = root.id;
  for (const mutation of HAND_DESIGNED_MUTATIONS) {
    const childId = genomeChildNodeId(handDesignedGenome, handDesignedNodeId, mutation);
    const parentLineage = genomeLineage(handDesignedGenome, handDesignedNodeId);
    const candidate: NeutralPipelineGenomeNode = {
      id: childId,
      parentRef: handDesignedNodeId,
      mutationKind: mutation,
      score: 0,
      generation: parentLineage.length,
      simulated: true,
    };
    const scored = meanQuality(worlds, [...parentLineage, candidate], `hand-designed-probe|${childId}`);
    handDesignedGenome = appendGenomeMutation(handDesignedGenome, handDesignedNodeId, mutation, scored);
    handDesignedNodeId = childId;
  }
  const handDesignedArm = runArm("hand-designed", handDesignedGenome, handDesignedNodeId, null, {
    mutations: [...HAND_DESIGNED_MUTATIONS],
  });
  const searchedLadder = exploreSearchLadder(ladderPlan, ladderSeed, baselineGenome, scorer);
  const searchedBest = bestGenomeNode(searchedLadder.genome);
  const searchedArm = runArm("searched", searchedLadder.genome, searchedBest.id, searchedLadder, {
    terminal: searchedLadder.terminal,
    steps: searchedLadder.steps.length,
  });
  const armResults = [baselineArm, handDesignedArm, searchedArm];
  let failureAtlas: readonly NeutralFailureAtlasEntry[] = [];
  for (const arm of armResults) {
    for (const outcome of collectFailureObservations(arm.outcomes)) {
      failureAtlas = appendAtlasEntry(failureAtlas, buildFailureAtlasEntry(outcome, LAB_BENCH_SUBMITTED_AT));
    }
  }
  const notes = [
    "quality scores are computed deterministic fixture objectives over simulated lab worlds (you-lab promotion-evidence scorer) — not user studies, not live measurements and not HUMAN-REALITY evidence",
    "the entire compute plane is simulated (W10+ boundary): no real provider, renderer, organization runtime or search engine was invoked",
    "search-ladder budget exhaustion is a recorded terminal, never a silent stop (SEARCH BUDGET LAW)",
    "the searched arm promotes only when it beats the generalist baseline under the recorded objective (LAB PROMOTION LAW) — this report is evidence; the promotion gate decides",
    "effort, latency and cost are not-measured (simulated) markers; no measurement was performed and none is implied",
  ];
  const promotion = evaluatePromotionEvidence({ experiment, armResults });
  const reportWithoutId = {
    fixtureSetVersion: PROMOTION_EVIDENCE_FIXTURE_SET_VERSION,
    experiment,
    worlds,
    armResults,
    failureAtlas,
    promotion,
    notes,
  };
  return { runId: fnv1a32(canonicalJson(reportWithoutId)), ...reportWithoutId };
}

/** The standard experiment container (constraints derived from the fixture set + ladder plan). */
export function standardLabExperiment(ladderPlan: SearchLadderPlan): NeutralLabExperiment {
  return {
    id: STANDARD_LAB_EXPERIMENT_ID,
    intentRef: STANDARD_LAB_INTENT_REF,
    constraintsHash: fnv1a32(canonicalJson({ fixtureSetVersion: PROMOTION_EVIDENCE_FIXTURE_SET_VERSION, ladderPlan })),
    objective: STANDARD_LAB_OBJECTIVE,
    arms: [...LAB_COMPARISON_ARMS],
    promotionRef: null,
    simulated: true,
  };
}

/** Convenience: the standard W9C benchmark (the golden-pinned evidence run). */
export function runStandardPromotionEvidenceBenchmark(
  ladderSeed = "w9c-standard-ladder-seed",
): PromotionEvidenceReport {
  return runPromotionEvidenceBenchmark(
    standardLabExperiment(STANDARD_SEARCH_LADDER_PLAN),
    PROMOTION_EVIDENCE_FIXTURES,
    STANDARD_SEARCH_LADDER_PLAN,
    ladderSeed,
  );
}
