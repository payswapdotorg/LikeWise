// YOU W4A performance fixture scenario — scripted, deterministic
// orchestration of the full wave-4 arrow (docs/you/WORK_ORDERS.md W4A;
// FIXTURES.md):
//
//   template registration (+ duplicate-name refusal) -> twin wiring
//   (real wave-3 TwinService provides the bound version) -> template
//   instantiation (timeline VERBATIM, bound parameters) -> direct
//   publication (no template) -> invalid-timeline refusal -> render job
//   (video-render: video + image) queued -> running -> completed with
//   artifacts -> artifact reviews (pending -> accepted; pending ->
//   rejected; pending -> superseded withdrawal; re-review supersession
//   linkage) -> failed-job path (image-render: running -> failed) ->
//   unsupported-method refusal (unregistered "hologram-render") ->
//   ledger readout (projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seeds produces byte-identical
// traces (golden expectation). Fixture performances/renders stay
// `simulated: true` (truth law).

import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createPerformanceService, PerformanceService } from "./performanceService.js";
import { createTwinService, type TwinService } from "./twinService.js";
import {
  artifactLineageSummary,
  outcomeCode,
  PERFORMANCE_SCENARIO_SEED,
  PERFORMANCE_SCENARIO_SOLUTION_ID,
  renderResultFacts,
  SCENARIO_TEMPLATE_CUE_SPECS,
  SCENARIO_TEMPLATE_PARAMETERS,
  TWIN_WIRING_SEED,
  type PerformanceScenarioOptions,
  type PerformanceScenarioStep,
  type PerformanceScenarioTrace,
} from "./performanceFixtureScenarioTypes.js";

export {
  PERFORMANCE_SCENARIO_SEED,
  PERFORMANCE_SCENARIO_SOLUTION_ID,
  SCENARIO_TEMPLATE_CUE_SPECS,
  SCENARIO_TEMPLATE_PARAMETERS,
  TWIN_WIRING_SEED,
} from "./performanceFixtureScenarioTypes.js";
export type { PerformanceScenarioOptions, PerformanceScenarioStep, PerformanceScenarioTrace } from "./performanceFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): PerformanceScenarioStep {
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

/**
 * Runs the full scripted performance scenario against freshly created
 * services. Deterministic: same seeds + same options => identical trace.
 */
export function runPerformanceFixtureScenario(options: PerformanceScenarioOptions = {}): PerformanceScenarioTrace {
  const solutionId = options.solutionId ?? PERFORMANCE_SCENARIO_SOLUTION_ID;
  const twin: TwinService = createTwinService({
    workspaceIdentity: "ws-w4a-scenario-twin",
    seed: options.twinSeed ?? TWIN_WIRING_SEED,
  });
  const performance: PerformanceService = createPerformanceService({
    workspaceIdentity: "ws-w4a-scenario-performance",
    seed: options.performanceSeed ?? PERFORMANCE_SCENARIO_SEED,
  });

  const steps: PerformanceScenarioStep[] = [];
  let stepIndex = 0;

  // -- twin wiring: the bound TwinVersion comes from the real wave-3 service --

  const createdTwin = must(twin.createTwin(solutionId, { displayName: "Scenario Performance Twin" }), "createTwin");
  const twinId = createdTwin.twin.id;
  steps.push(step((stepIndex += 1), "twin-created", { twinId, displayName: createdTwin.twin.displayName }));

  const twinBlocks = must(
    twin.synthesizeDomainBlocks(solutionId, {
      domains: ["identity-binding", "morphology", "geometry-skeleton"],
      seedText: "w4a-scenario-twin-v1",
      provenanceSource: "fixture:w4a-scenario",
    }),
    "synthesizeDomainBlocks",
  );
  const twinVersion = must(
    twin.publishTwinVersion(solutionId, twinId, {
      domainBlocks: twinBlocks.blocks,
      provenanceSource: "fixture:w4a-scenario",
    }),
    "publishTwinVersion",
  ).version;
  const promoted = must(twin.promoteTwinVersion(solutionId, twinId, twinVersion.id), "promoteTwinVersion");
  const twinVersionId = promoted.version.id;
  steps.push(
    step((stepIndex += 1), "twin-version-canonical", {
      twinVersionId,
      versionNumber: promoted.version.version,
      status: promoted.version.status,
      domainBlockCount: promoted.version.domainBlocks.length,
    }),
  );

  // -- template registration (+ duplicate-name refusal) ----------------------

  const templateTimeline = must(
    performance.synthesizePerformanceTimeline(solutionId, {
      cueSpecs: [...SCENARIO_TEMPLATE_CUE_SPECS],
      seedText: "w4a-scenario-template",
    }),
    "synthesizeTemplateTimeline",
  ).timeline;
  const registered = must(
    performance.registerTemplate(solutionId, {
      name: "Scenario Greeting Wave",
      timeline: templateTimeline,
      parameters: { ...SCENARIO_TEMPLATE_PARAMETERS },
    }),
    "registerTemplate",
  );
  const templateId = registered.template.id;
  steps.push(
    step((stepIndex += 1), "template-registered", {
      templateId,
      name: registered.template.name,
      cueCount: registered.template.timeline.cues.length,
      durationMs: registered.template.timeline.durationMs,
      parameterCount: Object.keys(registered.template.parameters).length,
    }),
  );

  const duplicate = performance.registerTemplate(solutionId, {
    name: "Scenario Greeting Wave",
    timeline: templateTimeline,
  });
  steps.push(
    step((stepIndex += 1), "template-duplicate-name-refused", {
      outcome: outcomeCode(duplicate),
      reason: duplicate.ok ? "" : (duplicate.error.details["reason"] ?? ""),
    }),
  );

  // -- template instantiation (timeline VERBATIM) ----------------------------

  const instantiated = must(
    performance.instantiateTemplate(solutionId, templateId, {
      twinVersionId,
      parameters: { intensity: 0.5 },
    }),
    "instantiateTemplate",
  );
  const instantiatedPerformance = instantiated.performance;
  const boundParameters = instantiated.parameters;
  steps.push(
    step((stepIndex += 1), "performance-instantiated", {
      performanceId: instantiatedPerformance.id,
      twinVersionId: instantiatedPerformance.twinVersionId,
      basedOnTemplateId: instantiatedPerformance.basedOnTemplateId ?? "",
      timelineVerbatim: instantiatedPerformance.timeline === registered.template.timeline,
      timelineId: instantiatedPerformance.timeline.id,
      cueCount: instantiatedPerformance.timeline.cues.length,
      durationMs: instantiatedPerformance.timeline.durationMs,
      boundIntensity: boundParameters["intensity"] as number,
      boundGreeting: boundParameters["greeting"] as string,
      boundLoopDefault: boundParameters["loop"] as boolean,
      createdAt: instantiatedPerformance.createdAt,
    }),
  );

  // -- direct publication (no template linkage) ------------------------------

  const directTimeline = must(
    performance.synthesizePerformanceTimeline(solutionId, {
      cueSpecs: [
        { track: "motion", startMs: 0, endMs: 1500 },
        { track: "cue", startMs: 1500, endMs: 2500 },
      ],
      seedText: "w4a-scenario-direct",
    }),
    "synthesizeDirectTimeline",
  ).timeline;
  const direct = must(
    performance.publishPerformance(solutionId, { twinVersionId, timeline: directTimeline }),
    "publishDirectPerformance",
  );
  steps.push(
    step((stepIndex += 1), "performance-published-direct", {
      performanceId: direct.performance.id,
      basedOnTemplateId: direct.performance.basedOnTemplateId ?? "",
      cueCount: direct.performance.timeline.cues.length,
      durationMs: direct.performance.timeline.durationMs,
    }),
  );

  // -- invalid-timeline refusal (same-track overlap) --------------------------

  const invalidTimeline = must(
    performance.synthesizePerformanceTimeline(solutionId, {
      cueSpecs: [
        { track: "motion", startMs: 0, endMs: 2000 },
        { track: "motion", startMs: 1000, endMs: 3000 },
      ],
      seedText: "w4a-scenario-invalid",
    }),
    "synthesizeInvalidTimeline",
  ).timeline;
  const invalid = performance.publishPerformance(solutionId, { twinVersionId, timeline: invalidTimeline });
  steps.push(
    step((stepIndex += 1), "invalid-timeline-refused", {
      outcome: outcomeCode(invalid),
      reason: invalid.ok ? "" : (invalid.error.details["reason"] ?? ""),
      detail: invalid.ok ? "" : (invalid.error.details["detail"] ?? ""),
    }),
  );

  // -- render job: queued -> running -> completed with artifacts --------------

  const submitted = must(
    performance.submitRenderJob(solutionId, {
      performanceId: instantiatedPerformance.id,
      method: "video-render",
      outputKinds: ["video", "image"],
      parameters: { fps: 30 },
    }),
    "submitRenderJob",
  ).spec;
  steps.push(
    step((stepIndex += 1), "render-job-submitted", {
      jobId: submitted.id,
      performanceId: submitted.performanceId,
      method: submitted.method,
      outputKinds: submitted.outputKinds.join(","),
      parameterCount: Object.keys(submitted.parameters).length,
    }),
  );

  const started = must(performance.startRenderJob(solutionId, submitted.id), "startRenderJob");
  steps.push(step((stepIndex += 1), "render-job-started", { jobId: submitted.id, statusAfter: started.status }));

  const completed = must(performance.completeRenderJob(solutionId, submitted.id), "completeRenderJob").result;
  const artifacts = must(performance.artifactsOfJob(solutionId, submitted.id), "artifactsOfJob");
  steps.push(step((stepIndex += 1), "render-job-completed", renderResultFacts(completed)));

  const imageArtifact = artifacts.find((artifact) => artifact.kind === "image");
  const videoArtifact = artifacts.find((artifact) => artifact.kind === "video");
  if (imageArtifact === undefined || videoArtifact === undefined) {
    throw new Error("scenario expected the completed job to carry one image and one video artifact");
  }
  steps.push(
    step((stepIndex += 1), "render-artifacts-registered", {
      jobId: submitted.id,
      artifactCount: artifacts.length,
      ...artifactLineageSummary(artifacts),
    }),
  );

  // -- artifact reviews: accepted / rejected / superseded ----------------------

  // Video artifact: pending -> superseded (withdrawal), then a fresh
  // pending review -> rejected.
  const withdrawnOpened = must(performance.reviewRenderArtifact(solutionId, videoArtifact.id), "reviewVideoPending");
  const withdrawn = must(
    performance.supersedePendingRenderArtifactReview(solutionId, videoArtifact.id, withdrawnOpened.review.id),
    "supersedePendingVideoReview",
  );
  steps.push(
    step((stepIndex += 1), "artifact-review-superseded", {
      reviewId: withdrawn.review.id,
      artifactId: withdrawn.review.artifactId,
      status: withdrawn.review.status,
      artifactKind: videoArtifact.kind,
    }),
  );

  const rejectedOpened = must(performance.reviewRenderArtifact(solutionId, videoArtifact.id), "reviewVideoPending2");
  const rejected = must(
    performance.resolveRenderArtifactReview(solutionId, videoArtifact.id, rejectedOpened.review.id, "rejected"),
    "resolveVideoRejected",
  );
  steps.push(
    step((stepIndex += 1), "artifact-review-rejected", {
      reviewId: rejected.review.id,
      artifactId: rejected.review.artifactId,
      status: rejected.review.status,
      artifactKind: videoArtifact.kind,
    }),
  );

  // Image artifact: pending -> accepted, then a re-review supersedes the
  // accepted review (new record; linkage, never overwrite).
  const acceptedOpened = must(performance.reviewRenderArtifact(solutionId, imageArtifact.id), "reviewImagePending");
  const accepted = must(
    performance.resolveRenderArtifactReview(solutionId, imageArtifact.id, acceptedOpened.review.id, "accepted"),
    "resolveImageAccepted",
  );
  steps.push(
    step((stepIndex += 1), "artifact-review-accepted", {
      reviewId: accepted.review.id,
      artifactId: accepted.review.artifactId,
      status: accepted.review.status,
      artifactKind: imageArtifact.kind,
    }),
  );

  const reReview = must(
    performance.reReviewRenderArtifact(solutionId, imageArtifact.id, {
      outcome: "accepted",
      supersedesReviewId: accepted.review.id,
    }),
    "reReviewImage",
  );
  const currentImageReview = performance.currentReviewOfArtifact(solutionId, imageArtifact.id);
  steps.push(
    step((stepIndex += 1), "artifact-re-review-superseding", {
      reviewId: reReview.review.id,
      supersedesReviewId: reReview.superseded.id,
      supersededKeepsStatus: reReview.superseded.status,
      newStatus: reReview.review.status,
      currentReviewId: currentImageReview?.id ?? "",
      artifactKind: imageArtifact.kind,
    }),
  );

  // -- failed-job path (running -> failed) -------------------------------------

  const failedSubmitted = must(
    performance.submitRenderJob(solutionId, {
      performanceId: direct.performance.id,
      method: "image-render",
      outputKinds: ["image"],
    }),
    "submitFailedJob",
  ).spec;
  must(performance.startRenderJob(solutionId, failedSubmitted.id), "startFailedJob");
  const failed = must(
    performance.failRenderJob(solutionId, failedSubmitted.id, "fixture-injected-failure"),
    "failRenderJob",
  ).result;
  steps.push(
    step((stepIndex += 1), "render-job-failed", {
      ...renderResultFacts(failed),
      failureReason: String(failed.effortObservations["failureReason"] ?? ""),
    }),
  );

  // -- unsupported-method refusal ----------------------------------------------

  const unsupported = performance.submitRenderJob(solutionId, {
    performanceId: instantiatedPerformance.id,
    method: "hologram-render",
    outputKinds: ["image"],
  });
  steps.push(
    step((stepIndex += 1), "render-method-unsupported", {
      method: "hologram-render",
      outcome: outcomeCode(unsupported),
      reason: unsupported.ok ? "" : (unsupported.error.details["reason"] ?? ""),
    }),
  );

  // -- ledger readout: projection == replay --------------------------------------

  const events = must(performance.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const ledgerHash = must(performance.ledgerHashOf(solutionId), "ledgerHashOf");
  const projection = must(performance.projectionOf(solutionId), "projectionOf");
  const replayed = PerformanceService.replay(events);
  const projectionMatchesReplay = stableStringify(projection) === stableStringify(replayed);
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      performanceCount: Object.keys(projection.performances).length,
      renderJobCount: Object.keys(projection.renderJobs).length,
      artifactCount: Object.keys(projection.artifacts).length,
      reviewCount: Object.keys(projection.reviews).length,
      supersededReviewCount: Object.keys(projection.supersededBy).length,
      performanceStoreSize: performance.contentStoreSize(),
    }),
  );

  return {
    solutionId,
    twinId,
    twinVersionId,
    templateId,
    instantiatedPerformanceId: instantiatedPerformance.id,
    directPerformanceId: direct.performance.id,
    renderJobId: submitted.id,
    failedJobId: failedSubmitted.id,
    artifactIds: artifacts.map((artifact) => artifact.id),
    acceptedReviewId: accepted.review.id,
    rejectedReviewId: rejected.review.id,
    withdrawnReviewId: withdrawn.review.id,
    reReviewId: reReview.review.id,
    eventCount: events.length,
    ledgerHash,
    performanceStoreSize: performance.contentStoreSize(),
    projectionMatchesReplay,
    steps,
  };
}

/** Canonical serialization of a trace (golden comparisons). */
export function serializePerformanceScenarioTrace(trace: PerformanceScenarioTrace): string {
  return stableStringify(trace);
}
