import assert from "node:assert/strict";
import test from "node:test";
import type { OpaqueId, PerformanceTimeline } from "@zcode/shared";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { RENDER_JOB_TRANSITIONS } from "../../../shared/src/you/renderJob.js";
import {
  createPerformanceService,
  PerformanceService,
  type FixtureCueSpec,
} from "./performanceService.js";
import { createFixtureRenderMethodRegistry, type RenderMethodRegistry } from "./performanceServiceTypes.js";

const SOLUTION = "you_w4a_service_test";

function makeService(seed: string): PerformanceService {
  return createPerformanceService({ workspaceIdentity: "ws-w4a-service-test", seed });
}

/** Deterministic valid timeline through the service's own content store. */
function timelineFor(
  service: PerformanceService,
  cueSpecs: readonly FixtureCueSpec[] = [
    { track: "motion", startMs: 0, endMs: 2000 },
    { track: "cue", startMs: 500, endMs: 1500 },
  ],
  seedText = "service-test-timeline",
): PerformanceTimeline {
  const result = service.synthesizePerformanceTimeline(SOLUTION, { cueSpecs, seedText });
  assert.ok(result.ok);
  return result.value.timeline;
}

function publishPerformance(service: PerformanceService, timeline?: PerformanceTimeline) {
  const published = service.publishPerformance(SOLUTION, {
    twinVersionId: "you_twin-version_service_test",
    timeline: timeline ?? timelineFor(service),
  });
  assert.ok(published.ok);
  return published.value.performance;
}

test("unknown performances are typed YOU_PERFORMANCE_NOT_FOUND (read, publish-against, render)", () => {
  const service = makeService("errors");
  const read = service.performanceOf(SOLUTION, "you_performance_missing");
  assert.ok(!read.ok);
  assert.equal(read.error.code, "YOU_PERFORMANCE_NOT_FOUND");
  assert.equal(read.error.details["reason"], "unknown-performance");

  const submitted = service.submitRenderJob(SOLUTION, {
    performanceId: "you_performance_missing",
    method: "image-render",
    outputKinds: ["image"],
  });
  assert.ok(!submitted.ok);
  assert.equal(submitted.error.code, "YOU_PERFORMANCE_NOT_FOUND");
});

test("publication refuses invalid timelines with typed YOU_TIMELINE_INVALID (stateless taxonomy)", () => {
  const service = makeService("timeline-refusals");

  const empty = service.publishPerformance(SOLUTION, {
    twinVersionId: "v",
    timeline: { id: "tl", cues: [], durationMs: 0 },
  });
  assert.ok(!empty.ok);
  assert.equal(empty.error.code, "YOU_TIMELINE_INVALID");
  assert.ok(String(empty.error.details["detail"]).includes("empty-timeline"));

  // Same-track overlap.
  const overlapping = service.synthesizePerformanceTimeline(SOLUTION, {
    cueSpecs: [
      { track: "motion", startMs: 0, endMs: 2000 },
      { track: "motion", startMs: 1000, endMs: 3000 },
    ],
    seedText: "overlap",
  });
  assert.ok(overlapping.ok);
  const overlap = service.publishPerformance(SOLUTION, { twinVersionId: "v", timeline: overlapping.value.timeline });
  assert.ok(!overlap.ok);
  assert.equal(overlap.error.code, "YOU_TIMELINE_INVALID");
  assert.ok(String(overlap.error.details["detail"]).includes("track-overlap"));

  // durationMs inconsistent with the cues.
  const valid = timelineFor(service);
  const mismatch = service.publishPerformance(SOLUTION, {
    twinVersionId: "v",
    timeline: { ...valid, durationMs: valid.durationMs + 1 },
  });
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.error.code, "YOU_TIMELINE_INVALID");
  assert.ok(String(mismatch.error.details["detail"]).includes("duration-mismatch"));

  // Unordered cues (hand-built timeline).
  const twoCues = timelineFor(service, [
    { track: "motion", startMs: 0, endMs: 1000 },
    { track: "cue", startMs: 2000, endMs: 3000 },
  ], "unordered");
  const unordered = service.publishPerformance(SOLUTION, {
    twinVersionId: "v",
    timeline: { ...twoCues, cues: [...twoCues.cues].reverse() },
  });
  assert.ok(!unordered.ok);
  assert.equal(unordered.error.code, "YOU_TIMELINE_INVALID");
  assert.ok(String(unordered.error.details["detail"]).includes("unordered-cues"));
});

test("published performances are immutable, append-only and content-addressed", () => {
  const service = makeService("immutable");
  const performance = publishPerformance(service);
  assert.ok(Object.isFrozen(performance));
  assert.ok(Object.isFrozen(performance.timeline));
  assert.ok(performance.timeline.cues.every((cue) => Object.isFrozen(cue)));
  assert.equal(performance.basedOnTemplateId, null);
  for (const cue of performance.timeline.cues) {
    assert.ok(cue.payloadRef.startsWith("you_content_"));
    assert.equal(cue.payloadHash.length, 64);
  }
  // Mutation attempts throw (deep-frozen).
  assert.throws(() => {
    (performance as { twinVersionId: string }).twinVersionId = "x";
  }, TypeError);

  const second = publishPerformance(service);
  const all = service.performancesOf(SOLUTION);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((entry) => entry.id).sort(), [performance.id, second.id].sort());
});

test("the template library enforces name uniqueness (typed refusal, no state change)", () => {
  const service = makeService("templates");
  const timeline = timelineFor(service);
  const first = service.registerTemplate(SOLUTION, { name: "Greeting", timeline, parameters: { intensity: 0.5 } });
  assert.ok(first.ok);
  const duplicate = service.registerTemplate(SOLUTION, { name: "Greeting", timeline });
  assert.ok(!duplicate.ok);
  assert.equal(duplicate.error.code, "YOU_INVALID_STATE");
  assert.equal(duplicate.error.details["reason"], "duplicate-template-name");
  assert.equal(duplicate.error.details["templateId"], first.value.template.id);

  // A different name still registers.
  const second = service.registerTemplate(SOLUTION, { name: "Farewell", timeline });
  assert.ok(second.ok);
  assert.deepEqual(
    service.templatesOf(SOLUTION).map((template) => template.name),
    ["Farewell", "Greeting"],
  );

  // Invalid template refusals.
  const badName = service.registerTemplate(SOLUTION, { name: "  ", timeline });
  assert.ok(!badName.ok);
  assert.equal(badName.error.details["reason"], "invalid-name");
  const invalidTimeline = service.synthesizePerformanceTimeline(SOLUTION, {
    cueSpecs: [
      { track: "motion", startMs: 0, endMs: 1000 },
      { track: "motion", startMs: 500, endMs: 900 },
    ],
    seedText: "invalid-template",
  });
  assert.ok(invalidTimeline.ok);
  const badTimeline = service.registerTemplate(SOLUTION, { name: "Broken", timeline: invalidTimeline.value.timeline });
  assert.ok(!badTimeline.ok);
  assert.equal(badTimeline.error.code, "YOU_TIMELINE_INVALID");

  const missing = service.templateOf(SOLUTION, "you_performance-template_missing");
  assert.ok(!missing.ok);
  assert.equal(missing.error.details["reason"], "unknown-performance-template");
});

test("template instantiation publishes the timeline VERBATIM with bound parameters", () => {
  const service = makeService("instantiate");
  const template = service.registerTemplate(SOLUTION, {
    name: "Wave",
    timeline: timelineFor(service),
    parameters: { intensity: 0.8, greeting: "Hi", loop: false },
  });
  assert.ok(template.ok);

  const made = service.instantiateTemplate(SOLUTION, template.value.template.id, {
    twinVersionId: "you_twin-version_instantiated",
    parameters: { intensity: 0.4 },
  });
  assert.ok(made.ok);
  assert.equal(made.value.performance.timeline, template.value.template.timeline);
  assert.equal(made.value.performance.basedOnTemplateId, template.value.template.id);
  assert.deepEqual(made.value.parameters, { greeting: "Hi", intensity: 0.4, loop: false });

  // Parameter binding refusals.
  const unknown = service.instantiateTemplate(SOLUTION, template.value.template.id, {
    twinVersionId: "v",
    parameters: { surprise: 1 },
  });
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.details["reason"], "unknown-parameter");
  const mismatched = service.instantiateTemplate(SOLUTION, template.value.template.id, {
    twinVersionId: "v",
    parameters: { intensity: "high" },
  });
  assert.ok(!mismatched.ok);
  assert.equal(mismatched.error.details["reason"], "parameter-type-mismatch");

  const missingTemplate = service.instantiateTemplate(SOLUTION, "you_performance-template_missing", { twinVersionId: "v" });
  assert.ok(!missingTemplate.ok);
  assert.equal(missingTemplate.error.details["reason"], "unknown-performance-template");

  // The instantiated performance is readable and part of the plane.
  const read = service.performanceOf(SOLUTION, made.value.performance.id);
  assert.ok(read.ok);
  assert.equal(read.value.performance.id, made.value.performance.id);
});

test("render job lifecycle: legal ladder, terminals locked, illegal transitions refused with no state change", () => {
  const service = makeService("lifecycle");
  const performance = publishPerformance(service);

  const submitted = service.submitRenderJob(SOLUTION, {
    performanceId: performance.id,
    method: "video-render",
    outputKinds: ["video", "image"],
  });
  assert.ok(submitted.ok);
  const jobId = submitted.value.spec.id;

  // Illegal: queued -> completed.
  const skip = service.completeRenderJob(SOLUTION, jobId);
  assert.ok(!skip.ok);
  assert.equal(skip.error.code, "YOU_INVALID_STATE");
  assert.equal(skip.error.details["reason"], "illegal-render-job-transition");
  assert.equal(skip.error.details["fromStatus"], "queued");
  assert.equal(skip.error.details["toStatus"], "completed");
  // No state change: the job is still queued.
  const stillQueued = service.renderJobOf(SOLUTION, jobId);
  assert.ok(stillQueued.ok);
  assert.equal(stillQueued.value.status, "queued");

  const started = service.startRenderJob(SOLUTION, jobId);
  assert.ok(started.ok);
  assert.equal(started.value.status, "running");

  // Illegal: running -> queued.
  const back = service.startRenderJob(SOLUTION, jobId);
  assert.ok(!back.ok);
  assert.equal(back.error.details["reason"], "illegal-render-job-transition");
  assert.equal(back.error.details["fromStatus"], "running");

  const completed = service.completeRenderJob(SOLUTION, jobId);
  assert.ok(completed.ok);
  assert.equal(completed.value.result.status, "completed");
  assert.equal(completed.value.result.simulated, true);

  // Terminals locked: completed -> anything is refused.
  for (const illegal of [
    service.startRenderJob(SOLUTION, jobId),
    service.completeRenderJob(SOLUTION, jobId),
    service.failRenderJob(SOLUTION, jobId, "late"),
  ]) {
    assert.ok(!illegal.ok, "terminal job must refuse further transitions");
    assert.equal(illegal.error.details["reason"], "illegal-render-job-transition");
  }

  const unknown = service.startRenderJob(SOLUTION, "you_render-job_missing");
  assert.ok(!unknown.ok);
  assert.equal(unknown.error.details["reason"], "unknown-render-job");
});

test("a queued job may fail directly (W3A-precedent table: queued -> failed)", () => {
  const service = makeService("queued-fail");
  const performance = publishPerformance(service);
  const submitted = service.submitRenderJob(SOLUTION, { performanceId: performance.id, method: "image-render", outputKinds: ["image"] });
  assert.ok(submitted.ok);
  const failed = service.failRenderJob(SOLUTION, submitted.value.spec.id, "aborted-before-start");
  assert.ok(failed.ok);
  assert.equal(failed.value.result.status, "failed");
  assert.equal(failed.value.result.effortObservations["failureReason"], "aborted-before-start");
  assert.equal(failed.value.result.artifacts.length, 0);
  // The frozen transition table documents the legality.
  assert.deepEqual(RENDER_JOB_TRANSITIONS.queued, ["running", "failed"]);
});

test("unregistered methods and unsupported output kinds are typed YOU_RENDER_UNSUPPORTED", () => {
  const service = makeService("unsupported");
  const performance = publishPerformance(service);

  const unregistered = service.submitRenderJob(SOLUTION, {
    performanceId: performance.id,
    method: "hologram-render",
    outputKinds: ["image"],
  });
  assert.ok(!unregistered.ok);
  assert.equal(unregistered.error.code, "YOU_RENDER_UNSUPPORTED");
  assert.equal(unregistered.error.details["reason"], "unregistered-method");
  assert.equal(unregistered.error.details["method"], "hologram-render");

  const unsupported = service.submitRenderJob(SOLUTION, {
    performanceId: performance.id,
    method: "video-render",
    outputKinds: ["mesh"],
  });
  assert.ok(!unsupported.ok);
  assert.equal(unsupported.error.code, "YOU_RENDER_UNSUPPORTED");
  assert.equal(unsupported.error.details["reason"], "unsupported-output-kinds");
  assert.equal(unsupported.error.details["unsupportedKinds"], "mesh");

  const empty = service.submitRenderJob(SOLUTION, { performanceId: performance.id, method: "video-render", outputKinds: [] });
  assert.ok(!empty.ok);
  assert.equal(empty.error.details["reason"], "empty-output-kinds");

  const badParams = service.submitRenderJob(SOLUTION, {
    performanceId: performance.id,
    method: "video-render",
    outputKinds: ["video"],
    parameters: { bad: Number.NaN },
  });
  assert.ok(!badParams.ok);
  assert.equal(badParams.error.details["reason"], "invalid-parameters");

  // The refusal leaves no job behind.
  const projection = service.projectionOf(SOLUTION);
  assert.ok(projection.ok);
  assert.equal(Object.keys(projection.value.renderJobs).length, 0);
});

test("a custom registry seam governs method support (W4C adapter-lane injection point)", () => {
  const custom: RenderMethodRegistry = {
    resolve(method) {
      if (method === "studio-render") {
        return { supportedOutputKinds: ["image"] };
      }
      return null;
    },
  };
  const service = createPerformanceService({ workspaceIdentity: "ws-w4a-service-test", seed: "registry", methodRegistry: custom });
  const performance = publishPerformance(service);

  const ok = service.submitRenderJob(SOLUTION, { performanceId: performance.id, method: "studio-render", outputKinds: ["image"] });
  assert.ok(ok.ok);

  const fixtureMethod = service.submitRenderJob(SOLUTION, { performanceId: performance.id, method: "video-render", outputKinds: ["video"] });
  assert.ok(!fixtureMethod.ok);
  assert.equal(fixtureMethod.error.details["reason"], "unregistered-method");

  const fixtureRegistry = createFixtureRenderMethodRegistry();
  assert.notEqual(fixtureRegistry.resolve("video-render"), null);
  assert.equal(fixtureRegistry.resolve("hologram-render"), null);
});


test("completed jobs produce content-addressed simulated artifacts with queryable lineage", () => {
  const service = makeService("artifacts");
  const performance = publishPerformance(service);
  const submitted = service.submitRenderJob(SOLUTION, {
    performanceId: performance.id,
    method: "video-render",
    outputKinds: ["video", "image"],
  });
  assert.ok(submitted.ok);
  assert.ok(service.startRenderJob(SOLUTION, submitted.value.spec.id).ok);
  const completed = service.completeRenderJob(SOLUTION, submitted.value.spec.id);
  assert.ok(completed.ok);

  const lineage = service.artifactsOfJob(SOLUTION, submitted.value.spec.id);
  assert.ok(lineage.ok);
  assert.equal(lineage.value.length, 2);
  assert.deepEqual(lineage.value.map((artifact) => artifact.kind), ["image", "video"]);
  for (const artifact of lineage.value) {
    assert.equal(artifact.jobId, submitted.value.spec.id);
    assert.equal(artifact.simulated, true);
    assert.ok(artifact.contentRef.startsWith("you_content_"));
    assert.equal(artifact.contentHash.length, 64);
    assert.ok(Object.isFrozen(artifact));
  }

  // Typed artifact-not-found for reads and reviews.
  const missing = service.artifactOf(SOLUTION, "you_render-artifact_missing");
  assert.ok(!missing.ok);
  assert.equal(missing.error.code, "YOU_RENDER_ARTIFACT_NOT_FOUND");
  const missingReview = service.reviewRenderArtifact(SOLUTION, "you_render-artifact_missing");
  assert.ok(!missingReview.ok);
  assert.equal(missingReview.error.code, "YOU_RENDER_ARTIFACT_NOT_FOUND");

  // Lineage requires a known job.
  const unknownJob = service.artifactsOfJob(SOLUTION, "you_render-job_missing");
  assert.ok(!unknownJob.ok);
  assert.equal(unknownJob.error.details["reason"], "unknown-render-job");
});

test("the artifact review state machine: resolve once, withdraw pending, re-review supersession", () => {
  const service = makeService("reviews");
  const performance = publishPerformance(service);
  const submitted = service.submitRenderJob(SOLUTION, { performanceId: performance.id, method: "image-render", outputKinds: ["image"] });
  assert.ok(submitted.ok);
  assert.ok(service.startRenderJob(SOLUTION, submitted.value.spec.id).ok);
  assert.ok(service.completeRenderJob(SOLUTION, submitted.value.spec.id).ok);
  const lineage = service.artifactsOfJob(SOLUTION, submitted.value.spec.id);
  assert.ok(lineage.ok);
  const artifact = lineage.value[0]!;
  const artifactId: OpaqueId = artifact.id;

  // Open pending -> resolve accepted.
  const opened = service.reviewRenderArtifact(SOLUTION, artifactId);
  assert.ok(opened.ok);
  assert.equal(opened.value.review.status, "pending");
  const accepted = service.resolveRenderArtifactReview(SOLUTION, artifactId, opened.value.review.id, "accepted");
  assert.ok(accepted.ok);
  assert.equal(accepted.value.review.status, "accepted");
  assert.equal(accepted.value.review.id, opened.value.review.id);

  // Resolved reviews never resolve again.
  const replay = service.resolveRenderArtifactReview(SOLUTION, artifactId, opened.value.review.id, "rejected");
  assert.ok(!replay.ok);
  assert.equal(replay.error.details["reason"], "illegal-review-transition");

  // Re-review supersedes the resolved review (new record, linkage).
  const reReview = service.reReviewRenderArtifact(SOLUTION, artifactId, {
    outcome: "rejected",
    supersedesReviewId: opened.value.review.id,
  });
  assert.ok(reReview.ok);
  assert.notEqual(reReview.value.review.id, opened.value.review.id);
  assert.equal(reReview.value.superseded.status, "accepted");
  const current = service.currentReviewOfArtifact(SOLUTION, artifactId);
  assert.equal(current?.id, reReview.value.review.id);

  // The superseded review cannot be superseded again.
  const again = service.reReviewRenderArtifact(SOLUTION, artifactId, {
    outcome: "accepted",
    supersedesReviewId: opened.value.review.id,
  });
  assert.ok(!again.ok);
  assert.equal(again.error.details["reason"], "review-already-superseded");

  // Pending reviews must be resolved or withdrawn before supersession.
  const pending2 = service.reviewRenderArtifact(SOLUTION, artifactId);
  assert.ok(pending2.ok);
  const premature = service.reReviewRenderArtifact(SOLUTION, artifactId, {
    outcome: "accepted",
    supersedesReviewId: pending2.value.review.id,
  });
  assert.ok(!premature.ok);
  assert.equal(premature.error.details["reason"], "pending-review-not-resolvable");

  // Withdraw the pending review (pending -> superseded).
  const withdrawn = service.supersedePendingRenderArtifactReview(SOLUTION, artifactId, pending2.value.review.id);
  assert.ok(withdrawn.ok);
  assert.equal(withdrawn.value.review.status, "superseded");

  // Review history is append-only and ordered.
  const history = service.reviewsOfArtifact(SOLUTION, artifactId);
  assert.deepEqual(
    history.map((review) => review.status),
    ["accepted", "rejected", "superseded"],
  );

  // Review/artifact mismatch and unknown review are typed.
  const mismatch = service.resolveRenderArtifactReview(SOLUTION, artifactId, "you_artifact-review_missing", "accepted");
  assert.ok(!mismatch.ok);
  assert.equal(mismatch.error.details["reason"], "unknown-artifact-review");
});

test("render artifacts of a failed job: none produced, honest failure observations", () => {
  const service = makeService("failed-job");
  const performance = publishPerformance(service);
  const submitted = service.submitRenderJob(SOLUTION, { performanceId: performance.id, method: "image-render", outputKinds: ["image"] });
  assert.ok(submitted.ok);
  assert.ok(service.startRenderJob(SOLUTION, submitted.value.spec.id).ok);
  const failed = service.failRenderJob(SOLUTION, submitted.value.spec.id, "fixture-injected-failure");
  assert.ok(failed.ok);
  assert.equal(failed.value.result.status, "failed");
  assert.equal(failed.value.result.effortObservations["latencyMs"], "not-measured (simulated)");
  assert.equal(failed.value.result.effortObservations["failureReason"], "fixture-injected-failure");
  assert.equal(failed.value.result.simulated, true);
  const lineage = service.artifactsOfJob(SOLUTION, submitted.value.spec.id);
  assert.ok(lineage.ok);
  assert.equal(lineage.value.length, 0);
});

test("determinism: same seed => identical ids, hashes, ledger and projection", () => {
  const run = () => {
    const service = makeService("determinism");
    const template = service.registerTemplate(SOLUTION, { name: "Wave", timeline: timelineFor(service), parameters: { k: 1 } });
    assert.ok(template.ok);
    const made = service.instantiateTemplate(SOLUTION, template.value.template.id, { twinVersionId: "v" });
    assert.ok(made.ok);
    const submitted = service.submitRenderJob(SOLUTION, { performanceId: made.value.performance.id, method: "video-render", outputKinds: ["video", "image"] });
    assert.ok(submitted.ok);
    assert.ok(service.startRenderJob(SOLUTION, submitted.value.spec.id).ok);
    assert.ok(service.completeRenderJob(SOLUTION, submitted.value.spec.id).ok);
    const lineage = service.artifactsOfJob(SOLUTION, submitted.value.spec.id);
    assert.ok(lineage.ok);
    const artifact = lineage.value[0]!;
    const review = service.reviewRenderArtifact(SOLUTION, artifact.id, { outcome: "accepted" });
    assert.ok(review.ok);
    const ledgerHash = service.ledgerHashOf(SOLUTION);
    assert.ok(ledgerHash.ok);
    const ledger = service.serializeLedgerOf(SOLUTION);
    assert.ok(ledger.ok);
    const projection = service.projectionOf(SOLUTION);
    assert.ok(projection.ok);
    return {
      performanceId: made.value.performance.id,
      artifactHash: artifact.contentHash,
      ledgerHash: ledgerHash.value,
      ledger: ledger.value,
      projection: stableStringify(projection.value),
      storeSize: service.contentStoreSize(),
    };
  };
  const first = run();
  const second = run();
  assert.equal(first.performanceId, second.performanceId);
  assert.equal(first.artifactHash, second.artifactHash);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.ledger, second.ledger);
  assert.equal(first.projection, second.projection);
  assert.equal(first.storeSize, second.storeSize);

  // Different seeds change the ids but keep the machinery deterministic.
  const other = makeService("determinism-alt");
  const otherTimeline = timelineFor(other);
  const otherPublished = other.publishPerformance(SOLUTION, { twinVersionId: "v", timeline: otherTimeline });
  assert.ok(otherPublished.ok);
  assert.notEqual(otherPublished.value.performance.id, first.performanceId);
});

test("the live projection equals the ledger replay (append-only reproduction)", () => {
  const service = makeService("projection");
  const template = service.registerTemplate(SOLUTION, { name: "Wave", timeline: timelineFor(service), parameters: { a: 1 } });
  assert.ok(template.ok);
  const made = service.instantiateTemplate(SOLUTION, template.value.template.id, { twinVersionId: "v", parameters: { a: 2 } });
  assert.ok(made.ok);
  const submitted = service.submitRenderJob(SOLUTION, { performanceId: made.value.performance.id, method: "video-render", outputKinds: ["video", "image"] });
  assert.ok(submitted.ok);
  assert.ok(service.startRenderJob(SOLUTION, submitted.value.spec.id).ok);
  assert.ok(service.completeRenderJob(SOLUTION, submitted.value.spec.id).ok);
  const lineage = service.artifactsOfJob(SOLUTION, submitted.value.spec.id);
  assert.ok(lineage.ok);
  const artifacts = lineage.value;
  const opened = service.reviewRenderArtifact(SOLUTION, artifacts[0]!.id);
  assert.ok(opened.ok);
  const resolved = service.resolveRenderArtifactReview(SOLUTION, artifacts[0]!.id, opened.value.review.id, "accepted");
  assert.ok(resolved.ok);

  const eventsResult = service.ledgerEventsOf(SOLUTION);
  assert.ok(eventsResult.ok);
  const events = eventsResult.value;
  const projectionResult = service.projectionOf(SOLUTION);
  assert.ok(projectionResult.ok);
  const projection = projectionResult.value;
  const replayed = PerformanceService.replay(events);
  assert.equal(stableStringify(projection), stableStringify(replayed));

  // Spot-check projection facts.
  assert.equal(projection.performances[made.value.performance.id]?.basedOnTemplateId, template.value.template.id);
  assert.equal(projection.renderJobs[submitted.value.spec.id]?.status, "completed");
  assert.equal(projection.renderJobs[submitted.value.spec.id]?.artifactIds.length, 2);
  assert.equal(projection.reviews[opened.value.review.id], "accepted");
  assert.equal(projection.currentReviewOfArtifact[artifacts[0]!.id], opened.value.review.id);

  // Empty planes have no events; replay requires at least one.
  const fresh = makeService("projection-empty");
  const freshEvents = fresh.ledgerEventsOf(SOLUTION);
  assert.ok(freshEvents.ok);
  assert.equal(freshEvents.value.length, 0);
  assert.throws(() => PerformanceService.replay([]));
});

test("wave-4 events flow through the ledger with the frozen payload conventions", () => {
  const service = makeService("events");
  const template = service.registerTemplate(SOLUTION, { name: "Wave", timeline: timelineFor(service), parameters: { intensity: 0.8, loop: true } });
  assert.ok(template.ok);
  const made = service.instantiateTemplate(SOLUTION, template.value.template.id, { twinVersionId: "v" });
  assert.ok(made.ok);
  const submitted = service.submitRenderJob(SOLUTION, { performanceId: made.value.performance.id, method: "video-render", outputKinds: ["video"] });
  assert.ok(submitted.ok);
  assert.ok(service.startRenderJob(SOLUTION, submitted.value.spec.id).ok);
  assert.ok(service.completeRenderJob(SOLUTION, submitted.value.spec.id).ok);
  const lineage = service.artifactsOfJob(SOLUTION, submitted.value.spec.id);
  assert.ok(lineage.ok);
  const artifacts = lineage.value;
  const opened = service.reviewRenderArtifact(SOLUTION, artifacts[0]!.id);
  assert.ok(opened.ok);
  const resolved = service.resolveRenderArtifactReview(SOLUTION, artifacts[0]!.id, opened.value.review.id, "accepted");
  assert.ok(resolved.ok);
  const reReview = service.reReviewRenderArtifact(SOLUTION, artifacts[0]!.id, { outcome: "accepted", supersedesReviewId: opened.value.review.id });
  assert.ok(reReview.ok);

  const eventsResult = service.ledgerEventsOf(SOLUTION);
  assert.ok(eventsResult.ok);
  const events = eventsResult.value;
  assert.deepEqual(
    events.map((event) => event.type),
    ["performance-published", "render-job-submitted", "render-job-completed", "render-artifact-reviewed", "render-artifact-reviewed", "render-artifact-reviewed"],
  );

  const instantiation = events[0]!;
  assert.equal(instantiation.payload["kind"], "template-instantiation");
  assert.equal(instantiation.payload["basedOnTemplateId"], template.value.template.id);
  assert.equal(instantiation.payload["param.intensity"], 0.8);
  assert.equal(instantiation.payload["param.loop"], true);

  const completion = events.find((event) => event.type === "render-job-completed")!;
  assert.equal(completion.payload["statusAfter"], "completed");
  assert.equal(completion.payload["artifactCount"], 1);
  assert.equal(completion.payload["artifact.0.id"], artifacts[0]!.id);
  assert.equal(completion.payload["artifact.0.contentHash"], artifacts[0]!.contentHash);

  const reviewEvents = events.filter((event) => event.type === "render-artifact-reviewed");
  assert.deepEqual(
    reviewEvents.map((event) => event.payload["kind"]),
    ["opened", "resolved", "re-review"],
  );
  assert.equal(reviewEvents[2]!.payload["supersedesReviewId"], opened.value.review.id);
  for (const event of events) {
    assert.equal(event.payload["simulated"], true);
    assert.equal(event.solutionId, SOLUTION);
  }
});
