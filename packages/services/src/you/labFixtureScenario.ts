// YOU W9A lab fixture scenario — scripted, deterministic orchestration
// of the full lab persistence arrow (docs/you/WORK_ORDERS.md W9A;
// FIXTURES.md):
//
//   experiment declared (three-arm law + invalid-intake refusals) ->
//   three arms submitted (baseline / hand-designed / searched; the
//   hand-designed arm fails once and re-runs — the append-only ladder;
//   + unknown-experiment / arm-not-declared / plan-hash refusals) ->
//   run ladder advanced (submitted -> running -> terminals; + no-op /
//   terminal-locked / off-ladder / unknown-run refusals) -> evidence
//   published (content-addressed manifests for the baseline and
//   searched runs; + non-terminal-run / empty-artifacts / unknown-run
//   refusals; an extra run stays "running" as the open head) ->
//   manifests verified (deep store-backed verification; + unknown-
//   manifest refusal and the shared-level tampered-address fail-closed
//   fact) -> promotion refusals (nothing to reverse, searched does not
//   beat, unknown manifest, unknown experiment) -> promotion decided
//   (searched 0.87 beats baseline 0.62) -> reversal (searched 0.55 no
//   longer beats — a NEW record; + still-beats refusal) -> evidence
//   re-published (a second manifest appends for the searched run) ->
//   re-promotion (searched 0.91; the chain walks promote -> reverse ->
//   promote) -> ledger readout (all three wave-9 events present;
//   projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation). Fixture experiments/runs/manifests/
// promotions stay `simulated: true` (truth law).

import type { LabArmKind, OpaqueId, SolutionEvent } from "@zcode/shared";
import { createDeterministicClock } from "../../../shared/src/you/clock.js";
import { createDeterministicRng, seedFromString, type YouRng } from "../../../shared/src/you/rng.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { verifyLabEvidenceManifest } from "../../../shared/src/you/labEvidence.js";
import { createLabService, LabService } from "./labService.js";
import {
  LAB_SCENARIO_ARTIFACT_BYTES,
  LAB_SCENARIO_BASELINE_SCORE,
  LAB_SCENARIO_EXPERIMENT_INPUT,
  LAB_SCENARIO_PLAN_HASHES,
  LAB_SCENARIO_REPROMOTED_SEARCHED_SCORE,
  LAB_SCENARIO_REVERSED_SEARCHED_SCORE,
  LAB_SCENARIO_SEARCHED_SCORE,
  LAB_SCENARIO_SEED,
  LAB_SCENARIO_SOLUTION_ID,
  outcomeCode,
  type LabScenarioOptions,
  type LabScenarioStep,
  type LabScenarioTrace,
} from "./labFixtureScenarioTypes.js";

export {
  LAB_SCENARIO_ARTIFACT_BYTES,
  LAB_SCENARIO_BASELINE_SCORE,
  LAB_SCENARIO_EXPERIMENT_INPUT,
  LAB_SCENARIO_PLAN_HASHES,
  LAB_SCENARIO_REPROMOTED_SEARCHED_SCORE,
  LAB_SCENARIO_REVERSED_SEARCHED_SCORE,
  LAB_SCENARIO_SEARCHED_SCORE,
  LAB_SCENARIO_SEED,
  LAB_SCENARIO_SOLUTION_ID,
} from "./labFixtureScenarioTypes.js";
export type { LabScenarioOptions, LabScenarioStep, LabScenarioTrace } from "./labFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): LabScenarioStep {
  return { step: index, name, facts };
}

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

/** Deterministic artifact bytes from the scenario RNG (frozen consumption order: 4 bytes per word, little-endian). */
function artifactBytes(rng: YouRng, count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  for (let offset = 0; offset + 4 <= count; offset += 4) {
    const word = rng.nextUint32();
    bytes[offset] = word & 0xff;
    bytes[offset + 1] = (word >>> 8) & 0xff;
    bytes[offset + 2] = (word >>> 16) & 0xff;
    bytes[offset + 3] = (word >>> 24) & 0xff;
  }
  for (let offset = count - (count % 4); offset < count; offset += 1) {
    bytes[offset] = rng.nextUint32() & 0xff;
  }
  return bytes;
}

/**
 * Runs the full scripted lab scenario against a freshly created
 * service. Deterministic: same seed + same options => identical trace.
 */
export function runLabFixtureScenario(options: LabScenarioOptions = {}): LabScenarioTrace {
  const solutionId = options.solutionId ?? LAB_SCENARIO_SOLUTION_ID;
  // The scenario owns the injected clock and its own artifact RNG (both
  // derived from the stable scenario seed — FIXTURES.md laws 1-3).
  const clock = createDeterministicClock();
  const seed = options.seed ?? LAB_SCENARIO_SEED;
  const artifactRng = createDeterministicRng(seedFromString(seed));
  const service = createLabService({
    workspaceIdentity: "ws-w9a-scenario-lab",
    seed,
    clock,
  });

  const steps: LabScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};
  const runIds: OpaqueId[] = [];
  const ladderWalk: string[] = [];
  const manifestIds: OpaqueId[] = [];
  const promotionChain: OpaqueId[] = [];
  const decisionKinds: string[] = [];

  // -- experiment declared (the three-arm law) + intake refusals ----------------

  const experiment = must(
    service.declareLabExperiment(solutionId, { ...LAB_SCENARIO_EXPERIMENT_INPUT }),
    "declareLabExperiment",
  );
  const experimentId = experiment.experiment.id;
  const invalidArmsCount = service.declareLabExperiment(solutionId, {
    ...LAB_SCENARIO_EXPERIMENT_INPUT,
    arms: ["generalist-baseline", "hand-designed"],
  });
  refusalOutcomes["experiment-arms-count"] = outcomeCode(invalidArmsCount);
  const invalidArmsDuplicate = service.declareLabExperiment(solutionId, {
    ...LAB_SCENARIO_EXPERIMENT_INPUT,
    arms: ["generalist-baseline", "hand-designed", "hand-designed"],
  });
  refusalOutcomes["experiment-arms-duplicate"] = outcomeCode(invalidArmsDuplicate);
  const invalidObjective = service.declareLabExperiment(solutionId, {
    ...LAB_SCENARIO_EXPERIMENT_INPUT,
    objective: "  ",
  });
  refusalOutcomes["experiment-objective-empty"] = outcomeCode(invalidObjective);
  steps.push(
    step((stepIndex += 1), "experiment-declared", {
      experimentId,
      intentRef: experiment.experiment.intentRef,
      constraintsHash: experiment.experiment.constraintsHash,
      objective: experiment.experiment.objective,
      armCount: experiment.experiment.arms.length,
      promotionRefIsNull: experiment.experiment.promotionRef === null,
    }),
  );

  // -- three arms submitted (the comparison law) + submission refusals ----------

  const submittedRuns: Record<string, OpaqueId> = {};
  for (const arm of ["generalist-baseline", "hand-designed", "searched"] as const) {
    const submitted = must(
      service.submitLabRun(solutionId, experimentId, { arm, planHash: LAB_SCENARIO_PLAN_HASHES[arm] ?? "plan-x" }),
      `submitLabRun-${arm}`,
    );
    submittedRuns[arm] = submitted.run.id;
    runIds.push(submitted.run.id);
    ladderWalk.push(submitted.run.status);
  }
  const unknownExperimentRun = service.submitLabRun(solutionId, "you_lab-experiment_missing000000", {
    arm: "searched",
    planHash: "plan-x",
  });
  refusalOutcomes["run-unknown-experiment"] = outcomeCode(unknownExperimentRun);
  const undeclaredArmInput = { arm: "searched-hand-designed-hybrid", planHash: "plan-x" };
  const undeclaredArm = service.submitLabRun(solutionId, experimentId, undeclaredArmInput as { arm: LabArmKind; planHash: string });
  refusalOutcomes["run-arm-not-declared"] = outcomeCode(undeclaredArm);
  const emptyPlanHash = service.submitLabRun(solutionId, experimentId, { arm: "searched", planHash: "  " });
  refusalOutcomes["run-plan-hash-empty"] = outcomeCode(emptyPlanHash);
  steps.push(
    step((stepIndex += 1), "three-arms-submitted", {
      experimentId,
      runCount: runIds.length,
      baselineRunId: submittedRuns["generalist-baseline"] ?? "",
      handDesignedRunId: submittedRuns["hand-designed"] ?? "",
      searchedRunId: submittedRuns["searched"] ?? "",
      planHashes: Object.values(LAB_SCENARIO_PLAN_HASHES).join("|"),
    }),
  );

  // -- the run ladder advanced (append-only; terminals locked) ------------------

  const advance = (runId: OpaqueId, action: "startLabRun" | "succeedLabRun" | "failLabRun" | "retireLabRun"): string => {
    const result = must(service[action](solutionId, runId), `${action}:${runId}`);
    ladderWalk.push(result.run.status);
    return result.run.status;
  };
  advance(submittedRuns["generalist-baseline"] ?? "", "startLabRun");
  advance(submittedRuns["generalist-baseline"] ?? "", "succeedLabRun");
  advance(submittedRuns["hand-designed"] ?? "", "startLabRun");
  advance(submittedRuns["hand-designed"] ?? "", "failLabRun");
  // The hand-designed arm re-runs (the append-only ladder).
  const handDesignedRetry = must(
    service.submitLabRun(solutionId, experimentId, { arm: "hand-designed", planHash: "plan-hand-designed-v2" }),
    "submitLabRun-hand-designed-retry",
  );
  runIds.push(handDesignedRetry.run.id);
  ladderWalk.push(handDesignedRetry.run.status);
  advance(handDesignedRetry.run.id, "startLabRun");
  advance(handDesignedRetry.run.id, "succeedLabRun");
  advance(submittedRuns["searched"] ?? "", "startLabRun");
  advance(submittedRuns["searched"] ?? "", "succeedLabRun");

  // An extra run stays open on the ladder: born "submitted" (the
  // off-ladder refusal fires there), then advanced to "running" (the
  // open head used by the evidence refusals below).
  const openRun = must(
    service.submitLabRun(solutionId, experimentId, { arm: "generalist-baseline", planHash: "plan-baseline-v1-open" }),
    "submitLabRun-open",
  );
  runIds.push(openRun.run.id);
  ladderWalk.push(openRun.run.status);
  const offLadder = service.retireLabRun(solutionId, openRun.run.id);
  refusalOutcomes["run-off-ladder"] = outcomeCode(offLadder);
  advance(openRun.run.id, "startLabRun");

  const unknownRunAdvance = service.startLabRun(solutionId, "you_lab-run_missing00000000000");
  refusalOutcomes["run-unknown"] = outcomeCode(unknownRunAdvance);
  const noOpAdvance = service.succeedLabRun(solutionId, submittedRuns["generalist-baseline"] ?? "");
  refusalOutcomes["run-no-op-transition"] = outcomeCode(noOpAdvance);
  const lockedAdvance = service.startLabRun(solutionId, submittedRuns["generalist-baseline"] ?? "");
  refusalOutcomes["run-terminal-locked"] = outcomeCode(lockedAdvance);
  steps.push(
    step((stepIndex += 1), "run-ladder-advanced", {
      runCount: runIds.length,
      ladderWalk: ladderWalk.join("->"),
      openRunId: openRun.run.id,
      handDesignedRetryId: handDesignedRetry.run.id,
    }),
  );

  // -- evidence published (content-addressed) + publication refusals ------------

  const baselineArtifact = artifactBytes(artifactRng, LAB_SCENARIO_ARTIFACT_BYTES);
  const baselineEvidence = must(
    service.publishLabEvidence(solutionId, submittedRuns["generalist-baseline"] ?? "", [baselineArtifact]),
    "publishLabEvidence-baseline",
  );
  manifestIds.push(baselineEvidence.manifest.id);
  const searchedArtifacts = [
    artifactBytes(artifactRng, LAB_SCENARIO_ARTIFACT_BYTES),
    artifactBytes(artifactRng, LAB_SCENARIO_ARTIFACT_BYTES),
  ];
  const searchedEvidence = must(
    service.publishLabEvidence(solutionId, submittedRuns["searched"] ?? "", searchedArtifacts),
    "publishLabEvidence-searched",
  );
  manifestIds.push(searchedEvidence.manifest.id);

  const evidenceNotTerminal = service.publishLabEvidence(solutionId, openRun.run.id, [artifactBytes(artifactRng, 16)]);
  refusalOutcomes["evidence-run-not-terminal"] = outcomeCode(evidenceNotTerminal);
  const evidenceEmpty = service.publishLabEvidence(solutionId, submittedRuns["searched"] ?? "", []);
  refusalOutcomes["evidence-artifacts-empty"] = outcomeCode(evidenceEmpty);
  const evidenceUnknownRun = service.publishLabEvidence(solutionId, "you_lab-run_missing00000000000", [baselineArtifact]);
  refusalOutcomes["evidence-unknown-run"] = outcomeCode(evidenceUnknownRun);
  steps.push(
    step((stepIndex += 1), "evidence-published", {
      manifestCount: manifestIds.length,
      baselineManifestId: baselineEvidence.manifest.id,
      searchedManifestId: searchedEvidence.manifest.id,
      baselineContentHash: baselineEvidence.manifest.contentHash,
      searchedContentHash: searchedEvidence.manifest.contentHash,
      searchedArtifactCount: searchedEvidence.bindings.length,
      searchedRunEvidenceRef: searchedEvidence.run.evidenceManifestRef ?? "",
      contentStoreSize: service.contentStoreSize(),
    }),
  );

  // -- manifests verified (fail-closed) -------------------------------------------

  const verifiedBaseline = must(service.verifyLabEvidenceManifest(solutionId, baselineEvidence.manifest.id), "verify-baseline");
  const verifiedSearched = must(service.verifyLabEvidenceManifest(solutionId, searchedEvidence.manifest.id), "verify-searched");
  const verifyUnknown = service.verifyLabEvidenceManifest(solutionId, "you_lab-evidence-manifest_missing");
  refusalOutcomes["manifest-verify-unknown"] = outcomeCode(verifyUnknown);
  // The shared-level tamper law: a manifest whose recorded address lies
  // about its own bundle fails closed (the pure verification authority).
  const tampered = verifyLabEvidenceManifest(
    { ...searchedEvidence.manifest, contentHash: "0".repeat(64) },
    searchedEvidence.bindings,
  );
  steps.push(
    step((stepIndex += 1), "manifests-verified", {
      baselineVerified: verifiedBaseline.verified,
      searchedVerified: verifiedSearched.verified,
      searchedHashMatches: verifiedSearched.contentHash === searchedEvidence.manifest.contentHash,
      tamperRefusal: tampered.verified ? "UNEXPECTED-PASS" : tampered.reason,
    }),
  );

  // -- promotion refusals (the gate law) -------------------------------------------

  const reverseTooEarly = service.reverseLabPromotion(solutionId, experimentId, {
    objectiveScore: LAB_SCENARIO_REVERSED_SEARCHED_SCORE,
    baselineScore: LAB_SCENARIO_BASELINE_SCORE,
    evidenceManifestRef: searchedEvidence.manifest.id,
  });
  refusalOutcomes["promotion-nothing-to-reverse"] = outcomeCode(reverseTooEarly);
  const promoteNotBeating = service.promoteLabExperiment(solutionId, experimentId, {
    objectiveScore: LAB_SCENARIO_BASELINE_SCORE,
    baselineScore: LAB_SCENARIO_BASELINE_SCORE,
    evidenceManifestRef: searchedEvidence.manifest.id,
  });
  refusalOutcomes["promotion-searched-does-not-beat"] = outcomeCode(promoteNotBeating);
  const promoteUnknownManifest = service.promoteLabExperiment(solutionId, experimentId, {
    objectiveScore: LAB_SCENARIO_SEARCHED_SCORE,
    baselineScore: LAB_SCENARIO_BASELINE_SCORE,
    evidenceManifestRef: "you_lab-evidence-manifest_missing",
  });
  refusalOutcomes["promotion-unknown-manifest"] = outcomeCode(promoteUnknownManifest);
  const promoteUnknownExperiment = service.promoteLabExperiment(solutionId, "you_lab-experiment_missing000000", {
    objectiveScore: LAB_SCENARIO_SEARCHED_SCORE,
    baselineScore: LAB_SCENARIO_BASELINE_SCORE,
    evidenceManifestRef: searchedEvidence.manifest.id,
  });
  refusalOutcomes["promotion-unknown-experiment"] = outcomeCode(promoteUnknownExperiment);
  steps.push(
    step((stepIndex += 1), "promotion-refusals", {
      experimentId,
      refusalCount: 4,
    }),
  );

  // -- promotion decided (the searched arm beats the baseline) ---------------------

  const promoted = must(
    service.promoteLabExperiment(solutionId, experimentId, {
      objectiveScore: LAB_SCENARIO_SEARCHED_SCORE,
      baselineScore: LAB_SCENARIO_BASELINE_SCORE,
      evidenceManifestRef: searchedEvidence.manifest.id,
    }),
    "promoteLabExperiment",
  );
  promotionChain.push(promoted.promotion.id);
  decisionKinds.push("promote");
  steps.push(
    step((stepIndex += 1), "promotion-decided", {
      promotionId: promoted.promotion.id,
      experimentId,
      winnerArm: promoted.promotion.winnerArm,
      objectiveScore: promoted.promotion.objectiveScore,
      baselineScore: promoted.promotion.baselineScore,
      experimentPromotionRef: promoted.experiment.promotionRef ?? "",
    }),
  );

  // -- reversal (new evidence: the searched arm no longer beats) -------------------

  const reverseStillBeats = service.reverseLabPromotion(solutionId, experimentId, {
    objectiveScore: LAB_SCENARIO_SEARCHED_SCORE,
    baselineScore: LAB_SCENARIO_BASELINE_SCORE,
    evidenceManifestRef: searchedEvidence.manifest.id,
  });
  refusalOutcomes["reversal-still-beats"] = outcomeCode(reverseStillBeats);
  const reversed = must(
    service.reverseLabPromotion(solutionId, experimentId, {
      objectiveScore: LAB_SCENARIO_REVERSED_SEARCHED_SCORE,
      baselineScore: LAB_SCENARIO_BASELINE_SCORE,
      evidenceManifestRef: searchedEvidence.manifest.id,
    }),
    "reverseLabPromotion",
  );
  promotionChain.push(reversed.promotion.id);
  decisionKinds.push("reverse");
  steps.push(
    step((stepIndex += 1), "promotion-reversed", {
      promotionId: reversed.promotion.id,
      experimentId,
      winnerArm: reversed.promotion.winnerArm,
      objectiveScore: reversed.promotion.objectiveScore,
      baselineScore: reversed.promotion.baselineScore,
      experimentPromotionRef: reversed.experiment.promotionRef ?? "",
      chainLength: promotionChain.length,
    }),
  );

  // -- evidence re-published (a second manifest appends for the searched run) ------

  const reEvidence = must(
    service.publishLabEvidence(solutionId, submittedRuns["searched"] ?? "", [artifactBytes(artifactRng, LAB_SCENARIO_ARTIFACT_BYTES)]),
    "publishLabEvidence-searched-again",
  );
  manifestIds.push(reEvidence.manifest.id);
  steps.push(
    step((stepIndex += 1), "evidence-republished", {
      manifestCount: manifestIds.length,
      newManifestId: reEvidence.manifest.id,
      searchedRunEvidenceRef: reEvidence.run.evidenceManifestRef ?? "",
      manifestCountForSearchedRun: 2,
    }),
  );

  // -- re-promotion (the chain walks promote -> reverse -> promote) ------------------

  const repromoted = must(
    service.promoteLabExperiment(solutionId, experimentId, {
      objectiveScore: LAB_SCENARIO_REPROMOTED_SEARCHED_SCORE,
      baselineScore: LAB_SCENARIO_BASELINE_SCORE,
      evidenceManifestRef: reEvidence.manifest.id,
    }),
    "promoteLabExperiment-again",
  );
  promotionChain.push(repromoted.promotion.id);
  decisionKinds.push("promote");
  const unknownPromotionRead = service.promotionOf(solutionId, "you_lab-promotion_missing00000000");
  refusalOutcomes["promotion-unknown-read"] = outcomeCode(unknownPromotionRead);
  steps.push(
    step((stepIndex += 1), "promotion-repromoted", {
      promotionId: repromoted.promotion.id,
      experimentId,
      winnerArm: repromoted.promotion.winnerArm,
      objectiveScore: repromoted.promotion.objectiveScore,
      baselineScore: repromoted.promotion.baselineScore,
      experimentPromotionRef: repromoted.experiment.promotionRef ?? "",
      chainLength: promotionChain.length,
      decisionKinds: decisionKinds.join("->"),
    }),
  );

  // -- ledger readout: all three wave-9 events, projection == replay ----------------

  const events: readonly SolutionEvent[] = must(service.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }
  const live = must(service.projectionOf(solutionId), "projectionOf");
  const replay = LabService.replay(events);
  const projectionMatchesReplay = stableStringify(live) === stableStringify(replay);
  const ledgerHash = must(service.ledgerHashOf(solutionId), "ledgerHashOf");
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      labRunRecorded: eventCounts["lab-run-recorded"] ?? 0,
      labEvidencePublished: eventCounts["lab-evidence-published"] ?? 0,
      labPromotionDecided: eventCounts["lab-promotion-decided"] ?? 0,
    }),
  );

  return {
    solutionId,
    experimentId,
    runIds,
    ladderWalk,
    manifestIds,
    promotionChain,
    decisionKinds,
    refusalOutcomes,
    eventCounts,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
