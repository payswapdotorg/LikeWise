// YOU W9A lab fixture scenario — scripted, deterministic orchestration
// of the full lab persistence arrow (docs/you/WORK_ORDERS.md W9A;
// FIXTURES.md):
//
//   experiment declared (+ three-arm-law intake refusals) -> baseline
//   arm run (submitted -> running -> succeeded) -> hand-designed arm
//   run (succeeded) -> searched attempt one retired (running ->
//   retired) -> ladder refusals (terminal locked, off-ladder, no-op)
//   -> searched attempt two succeeded -> evidence published for the
//   baseline run -> evidence published for the searched run (+ the
//   malformed/unknown-manifest and run-not-terminal refusals) ->
//   promotion gate refusals (searched not beating, wrong arm, not
//   succeeded, manifest not bound, no head to reverse, unknown
//   experiment/run) -> promotion decided (searched 0.87 beats baseline
//   0.71 under the recorded objective) -> reversal refused while the
//   searched arm still beats (truth law) -> promotion reversed with new
//   evidence (baseline wins; a NEW record, never a mutation) -> ledger
//   readout (all three wave-9 events present; projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same seed produces byte-identical traces
// (golden expectation). Fixture experiments/runs/manifests/promotions
// stay `simulated: true` (truth law).

import type { SolutionEvent } from "@zcode/shared";
import { createDeterministicClock } from "../../../shared/src/you/clock.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createLabService, LabService } from "./labService.js";
import {
  LAB_SCENARIO_EXPERIMENT_INPUT,
  LAB_SCENARIO_PLAN_HASHES,
  LAB_SCENARIO_PROMOTION_SCORES,
  LAB_SCENARIO_REVERSAL_SCORES,
  LAB_SCENARIO_SEED,
  LAB_SCENARIO_SOLUTION_ID,
  outcomeCode,
  type LabScenarioOptions,
  type LabScenarioStep,
  type LabScenarioTrace,
} from "./labFixtureScenarioTypes.js";

export {
  LAB_SCENARIO_EXPERIMENT_INPUT,
  LAB_SCENARIO_PLAN_HASHES,
  LAB_SCENARIO_PROMOTION_SCORES,
  LAB_SCENARIO_REVERSAL_SCORES,
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

/** Deterministic artifact bytes (FIXTURES.md law 1: no ambient nondeterminism). */
function artifactBytes(label: string, index: number): Uint8Array {
  return new TextEncoder().encode(`lab-artifact-${label}-${index}`);
}

/**
 * Runs the full scripted lab scenario against a freshly created
 * service. Deterministic: same seed + same options => identical trace.
 */
export function runLabFixtureScenario(options: LabScenarioOptions = {}): LabScenarioTrace {
  const solutionId = options.solutionId ?? LAB_SCENARIO_SOLUTION_ID;
  const service = createLabService({
    workspaceIdentity: "ws-w9a-scenario-lab",
    seed: options.seed ?? LAB_SCENARIO_SEED,
    clock: createDeterministicClock(),
  });

  const steps: LabScenarioStep[] = [];
  let stepIndex = 0;
  const refusalOutcomes: Record<string, string> = {};
  const ladderWalk: string[] = [];

  // -- experiment declared (+ the three-arm-law intake refusals) ---------------

  const experiment = must(
    service.declareExperiment(solutionId, LAB_SCENARIO_EXPERIMENT_INPUT),
    "declareExperiment",
  );
  const experimentId = experiment.experiment.id;
  const missingArm = service.declareExperiment(solutionId, {
    ...LAB_SCENARIO_EXPERIMENT_INPUT,
    arms: ["generalist-baseline", "searched"],
  });
  refusalOutcomes["experiment-arms-missing"] = outcomeCode(missingArm);
  const duplicateArm = service.declareExperiment(solutionId, {
    ...LAB_SCENARIO_EXPERIMENT_INPUT,
    arms: ["searched", "searched", "hand-designed"],
  });
  refusalOutcomes["experiment-arms-duplicate"] = outcomeCode(duplicateArm);
  steps.push(
    step((stepIndex += 1), "experiment-declared", {
      experimentId,
      intentRef: experiment.experiment.intentRef,
      constraintsHash: experiment.experiment.constraintsHash,
      objective: experiment.experiment.objective,
      armCount: experiment.experiment.arms.length,
      promotionRefIsNull: experiment.experiment.promotionRef === null,
      simulated: experiment.experiment.simulated,
    }),
  );

  // -- the baseline arm run (submitted -> running -> succeeded) -----------------

  const baselineRun = must(
    service.submitLabRun(solutionId, experimentId, {
      arm: "generalist-baseline",
      planHash: LAB_SCENARIO_PLAN_HASHES["generalist-baseline"],
    }),
    "submitBaselineRun",
  );
  const baselineRunId = baselineRun.run.id;
  ladderWalk.push(baselineRun.run.status);
  must(service.startLabRun(solutionId, baselineRunId), "startBaselineRun");
  ladderWalk.push("running");
  const baselineSucceeded = must(service.succeedLabRun(solutionId, baselineRunId), "succeedBaselineRun");
  ladderWalk.push(baselineSucceeded.run.status);

  // -- the hand-designed arm run (succeeded) -------------------------------------

  const handDesignedRun = must(
    service.submitLabRun(solutionId, experimentId, {
      arm: "hand-designed",
      planHash: LAB_SCENARIO_PLAN_HASHES["hand-designed"],
    }),
    "submitHandDesignedRun",
  );
  const handDesignedRunId = handDesignedRun.run.id;
  ladderWalk.push(handDesignedRun.run.status);
  must(service.startLabRun(solutionId, handDesignedRunId), "startHandDesignedRun");
  ladderWalk.push("running");
  const handDesignedSucceeded = must(service.succeedLabRun(solutionId, handDesignedRunId), "succeedHandDesignedRun");
  ladderWalk.push(handDesignedSucceeded.run.status);
  steps.push(
    step((stepIndex += 1), "baseline-and-hand-designed-runs-succeeded", {
      baselineRunId,
      handDesignedRunId,
      baselineStatus: baselineSucceeded.run.status,
      handDesignedStatus: handDesignedSucceeded.run.status,
      runCount: 2,
    }),
  );

  // -- the searched arm: attempt one retired, attempt two succeeded --------------

  const searchedRetired = must(
    service.submitLabRun(solutionId, experimentId, {
      arm: "searched",
      planHash: LAB_SCENARIO_PLAN_HASHES.searched,
    }),
    "submitSearchedRunOne",
  );
  const searchedRetiredRunId = searchedRetired.run.id;
  ladderWalk.push(searchedRetired.run.status);
  const searchedRunning = must(service.startLabRun(solutionId, searchedRetiredRunId), "startSearchedRunOne");
  ladderWalk.push(searchedRunning.run.status);
  // The run-not-terminal evidence refusal (a running run has no bundle).
  const earlyEvidence = service.publishLabEvidence(solutionId, searchedRetiredRunId, { artifacts: [artifactBytes("early", 0)] });
  refusalOutcomes["evidence-run-not-terminal"] = outcomeCode(earlyEvidence);
  const searchedRetiredTerminal = must(service.retireLabRun(solutionId, searchedRetiredRunId), "retireSearchedRunOne");
  ladderWalk.push(searchedRetiredTerminal.run.status);

  const searchedRun = must(
    service.submitLabRun(solutionId, experimentId, {
      arm: "searched",
      planHash: LAB_SCENARIO_PLAN_HASHES.searched,
    }),
    "submitSearchedRunTwo",
  );
  const searchedRunId = searchedRun.run.id;
  ladderWalk.push(searchedRun.run.status);
  const offLadder = service.succeedLabRun(solutionId, searchedRunId);
  refusalOutcomes["run-off-ladder"] = outcomeCode(offLadder);
  must(service.startLabRun(solutionId, searchedRunId), "startSearchedRunTwo");
  ladderWalk.push("running");
  const noOp = service.startLabRun(solutionId, searchedRunId);
  refusalOutcomes["run-no-op-transition"] = outcomeCode(noOp);
  const searchedSucceeded = must(service.succeedLabRun(solutionId, searchedRunId), "succeedSearchedRunTwo");
  ladderWalk.push(searchedSucceeded.run.status);
  // Terminals lock (typed refusal with the ladder's stable reason).
  const locked = service.retireLabRun(solutionId, searchedRunId);
  refusalOutcomes["run-terminal-locked"] = outcomeCode(locked);
  steps.push(
    step((stepIndex += 1), "searched-arm-runs-recorded", {
      searchedRetiredRunId,
      searchedRunId,
      retiredStatus: searchedRetiredTerminal.run.status,
      succeededStatus: searchedSucceeded.run.status,
      runCount: 4,
    }),
  );

  // -- evidence published (baseline + searched; content-addressed) ----------------

  const baselineManifest = must(
    service.publishLabEvidence(solutionId, baselineRunId, {
      artifacts: [artifactBytes("baseline", 0), artifactBytes("baseline", 1)],
    }),
    "publishBaselineEvidence",
  );
  const baselineManifestId = baselineManifest.manifest.id;
  const emptyArtifacts = service.publishLabEvidence(solutionId, searchedRunId, { artifacts: [] });
  refusalOutcomes["manifest-artifacts-empty"] = outcomeCode(emptyArtifacts);
  const searchedManifest = must(
    service.publishLabEvidence(solutionId, searchedRunId, {
      artifacts: [artifactBytes("searched", 0), artifactBytes("searched", 1), artifactBytes("searched", 2)],
    }),
    "publishSearchedEvidence",
  );
  const searchedManifestId = searchedManifest.manifest.id;
  const rePublish = service.publishLabEvidence(solutionId, searchedRunId, { artifacts: [artifactBytes("searched", 9)] });
  refusalOutcomes["manifest-run-already-carries"] = outcomeCode(rePublish);
  const unknownManifest = service.verifyLabEvidence(solutionId, "you_lab-evidence-manifest_missing00000");
  refusalOutcomes["manifest-unknown"] = outcomeCode(unknownManifest);
  const baselineVerified = must(service.verifyLabEvidence(solutionId, baselineManifestId), "verifyBaselineEvidence");
  const searchedVerified = must(service.verifyLabEvidence(solutionId, searchedManifestId), "verifySearchedEvidence");
  const baselineRunHead = must(service.runOf(solutionId, baselineRunId), "baselineRunHead");
  const searchedRunHead = must(service.runOf(solutionId, searchedRunId), "searchedRunHead");
  steps.push(
    step((stepIndex += 1), "evidence-published", {
      baselineManifestId,
      searchedManifestId,
      baselineArtifactCount: baselineVerified.manifest.artifactRefs.length,
      searchedArtifactCount: searchedVerified.manifest.artifactRefs.length,
      searchedContentHashPrefix: searchedManifest.manifest.contentHash.slice(0, 16),
      bothVerified: baselineVerified.verified && searchedVerified.verified,
      baselineRunLinked: baselineRunHead.run.evidenceManifestRef === baselineManifestId,
      searchedRunLinked: searchedRunHead.run.evidenceManifestRef === searchedManifestId,
      simulated: searchedManifest.manifest.simulated,
    }),
  );

  // -- the promotion gate: refusals, then the lawful promotion --------------------

  const promotionInput = {
    searchedRunId,
    baselineRunId,
    evidenceManifestRef: searchedManifestId,
    ...LAB_SCENARIO_PROMOTION_SCORES,
  };
  const notBeating = service.decidePromotion(solutionId, experimentId, {
    ...promotionInput,
    objectiveScore: 0.5,
  });
  refusalOutcomes["promotion-searched-does-not-beat-baseline"] = outcomeCode(notBeating);
  const wrongArm = service.decidePromotion(solutionId, experimentId, {
    ...promotionInput,
    baselineRunId: handDesignedRunId,
  });
  refusalOutcomes["promotion-run-arm-mismatch-baseline"] = outcomeCode(wrongArm);
  const notSucceeded = service.decidePromotion(solutionId, experimentId, {
    ...promotionInput,
    searchedRunId: searchedRetiredRunId,
  });
  refusalOutcomes["promotion-run-not-succeeded"] = outcomeCode(notSucceeded);
  const wrongManifest = service.decidePromotion(solutionId, experimentId, {
    ...promotionInput,
    evidenceManifestRef: baselineManifestId,
  });
  refusalOutcomes["promotion-manifest-not-bound-to-searched-run"] = outcomeCode(wrongManifest);
  const noHead = service.reversePromotion(solutionId, experimentId, { ...promotionInput, ...LAB_SCENARIO_REVERSAL_SCORES });
  refusalOutcomes["reversal-no-promotion-to-reverse"] = outcomeCode(noHead);
  const unknownExperiment = service.decidePromotion(solutionId, "you_lab-experiment_missing000000", promotionInput);
  refusalOutcomes["promotion-unknown-experiment"] = outcomeCode(unknownExperiment);
  const unknownRun = service.decidePromotion(solutionId, experimentId, { ...promotionInput, searchedRunId: "you_lab-run_missing00000000000" });
  refusalOutcomes["promotion-unknown-run"] = outcomeCode(unknownRun);
  const promoted = must(service.decidePromotion(solutionId, experimentId, promotionInput), "decidePromotion");
  const promotionId = promoted.promotion.id;
  const experimentAfterPromotion = must(service.experimentOf(solutionId, experimentId), "experimentAfterPromotion");
  steps.push(
    step((stepIndex += 1), "promotion-decided", {
      promotionId,
      experimentId,
      winnerArm: promoted.promotion.winnerArm,
      objectiveScore: promoted.promotion.objectiveScore,
      baselineScore: promoted.promotion.baselineScore,
      evidenceManifestRef: promoted.promotion.evidenceManifestRef,
      experimentPromotionRef: experimentAfterPromotion.experiment.promotionRef ?? "",
      simulated: promoted.promotion.simulated,
    }),
  );

  // -- the reversal: refused while the searched arm still beats, then recorded ----

  const prematureReversal = service.reversePromotion(solutionId, experimentId, promotionInput);
  refusalOutcomes["reversal-requires-baseline-win"] = outcomeCode(prematureReversal);
  const reversed = must(
    service.reversePromotion(solutionId, experimentId, {
      searchedRunId,
      baselineRunId,
      evidenceManifestRef: searchedManifestId,
      ...LAB_SCENARIO_REVERSAL_SCORES,
    }),
    "reversePromotion",
  );
  const reversalId = reversed.promotion.id;
  const ledgerAfterReversal = must(service.promotionLedgerOf(solutionId, experimentId), "promotionLedgerOf");
  const experimentAfterReversal = must(service.experimentOf(solutionId, experimentId), "experimentAfterReversal");
  steps.push(
    step((stepIndex += 1), "promotion-reversed", {
      reversalId,
      experimentId,
      reversalOfPromotionId: promotionId,
      winnerArm: reversed.promotion.winnerArm,
      objectiveScore: reversed.promotion.objectiveScore,
      baselineScore: reversed.promotion.baselineScore,
      ledgerLength: ledgerAfterReversal.ledger.length,
      firstRecordUntouched: ledgerAfterReversal.ledger[0]?.winnerArm === "searched",
      experimentPromotionRef: experimentAfterReversal.experiment.promotionRef ?? "",
      simulated: reversed.promotion.simulated,
    }),
  );

  // -- ledger readout: all three wave-9 events, projection == replay ---------------

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
    baselineRunId,
    handDesignedRunId,
    searchedRetiredRunId,
    searchedRunId,
    baselineManifestId,
    searchedManifestId,
    promotionId,
    reversalId,
    ladderWalk,
    refusalOutcomes,
    eventCounts,
    eventCount: events.length,
    ledgerHash,
    projectionMatchesReplay,
    simulated: true,
    steps,
  };
}
