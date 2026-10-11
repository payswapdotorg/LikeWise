import assert from "node:assert/strict";
import test from "node:test";
import type { SolutionEvent } from "./contract.js";
import { createDeterministicClock } from "./clock.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableStringify } from "./serialize.js";
import { SolutionEventLedger } from "./events.js";
import { replayPerformanceLedger } from "./performanceLedger.js";

const SOLUTION = "you_w4a_ledger_test";

function makeLedger(): SolutionEventLedger {
  return new SolutionEventLedger(SOLUTION, {
    clock: createDeterministicClock(),
    ids: createRngIdFactory(createDeterministicRng(0x5eed_0040)),
  });
}

test("replayPerformanceLedger requires at least one event", () => {
  assert.throws(() => replayPerformanceLedger([]));
});

test("the fold reproduces performances, jobs, artifacts, reviews and supersession linkage", () => {
  const ledger = makeLedger();
  ledger.append({
    type: "performance-published",
    subjectRef: "perf1",
    payload: {
      kind: "template-instantiation",
      performanceId: "perf1",
      twinVersionId: "tv1",
      basedOnTemplateId: "tpl1",
      timelineId: "tl1",
      cueCount: 3,
      durationMs: 5000,
      trackKinds: "cue,layer,motion",
      "param.intensity": 0.5,
      "param.greeting": "Hello",
      "param.loop": false,
      simulated: true,
    },
  });
  ledger.append({
    type: "performance-published",
    subjectRef: "perf2",
    payload: {
      kind: "publication",
      performanceId: "perf2",
      twinVersionId: "tv1",
      basedOnTemplateId: "",
      timelineId: "tl2",
      cueCount: 1,
      durationMs: 1000,
      trackKinds: "motion",
      simulated: true,
    },
  });
  ledger.append({
    type: "render-job-submitted",
    subjectRef: "job1",
    payload: { jobId: "job1", performanceId: "perf1", method: "video-render", outputKinds: "image,video", outputKindCount: 2, parameterCount: 0, simulated: true },
  });
  ledger.append({
    type: "render-job-completed",
    subjectRef: "job1",
    payload: {
      jobId: "job1",
      statusAfter: "completed",
      artifactCount: 2,
      "artifact.0.id": "art1",
      "artifact.0.kind": "image",
      "artifact.0.contentRef": "you_content_aaaa",
      "artifact.0.contentHash": "hash-a",
      "artifact.1.id": "art2",
      "artifact.1.kind": "video",
      "artifact.1.contentRef": "you_content_bbbb",
      "artifact.1.contentHash": "hash-b",
      simulated: true,
    },
  });
  ledger.append({
    type: "render-artifact-reviewed",
    subjectRef: "art1",
    payload: { kind: "opened", reviewId: "rev1", artifactId: "art1", jobId: "job1", reviewStatus: "pending", supersedesReviewId: "", simulated: true },
  });
  ledger.append({
    type: "render-artifact-reviewed",
    subjectRef: "art1",
    payload: { kind: "resolved", reviewId: "rev1", artifactId: "art1", jobId: "job1", reviewStatus: "accepted", supersedesReviewId: "", simulated: true },
  });
  ledger.append({
    type: "render-artifact-reviewed",
    subjectRef: "art2",
    payload: { kind: "re-review", reviewId: "rev2", artifactId: "art2", jobId: "job1", reviewStatus: "rejected", supersedesReviewId: "rev1", simulated: true },
  });

  const projection = replayPerformanceLedger(ledger.events());
  assert.equal(projection.solutionId, SOLUTION);
  assert.deepEqual(projection.performances["perf1"], {
    twinVersionId: "tv1",
    basedOnTemplateId: "tpl1",
    timelineId: "tl1",
    cueCount: 3,
    durationMs: 5000,
  });
  assert.equal(projection.performances["perf2"]?.basedOnTemplateId, "");

  assert.deepEqual(projection.renderJobs["job1"], {
    status: "completed",
    method: "video-render",
    performanceId: "perf1",
    outputKinds: ["image", "video"],
    artifactIds: ["art1", "art2"],
  });

  assert.deepEqual(projection.artifacts["art1"], {
    jobId: "job1",
    kind: "image",
    contentRef: "you_content_aaaa",
    contentHash: "hash-a",
    simulated: true,
  });

  assert.deepEqual(projection.reviews, { rev1: "accepted", rev2: "rejected" });
  assert.equal(projection.currentReviewOfArtifact["art1"], "rev1");
  assert.equal(projection.currentReviewOfArtifact["art2"], "rev2");
  assert.deepEqual(projection.supersededBy, { rev1: "rev2" });
});

test("a failed job folds with its failure reason and zero artifacts", () => {
  const ledger = makeLedger();
  ledger.append({
    type: "render-job-submitted",
    subjectRef: "job9",
    payload: { jobId: "job9", performanceId: "perf9", method: "image-render", outputKinds: "image", outputKindCount: 1, parameterCount: 0, simulated: true },
  });
  ledger.append({
    type: "render-job-completed",
    subjectRef: "job9",
    payload: { jobId: "job9", statusAfter: "failed", artifactCount: 0, failureReason: "fixture-injected-failure", simulated: true },
  });
  const projection = replayPerformanceLedger(ledger.events());
  assert.equal(projection.renderJobs["job9"]?.status, "failed");
  assert.deepEqual(projection.renderJobs["job9"]?.artifactIds, []);
  assert.deepEqual(projection.artifacts, {});
});

test("later events win: re-reviews update review status and current-review linkage", () => {
  const ledger = makeLedger();
  for (const payload of [
    { kind: "opened", reviewId: "r1", artifactId: "a1", jobId: "j1", reviewStatus: "pending", supersedesReviewId: "" },
    { kind: "resolved", reviewId: "r1", artifactId: "a1", jobId: "j1", reviewStatus: "accepted", supersedesReviewId: "" },
    { kind: "re-review", reviewId: "r2", artifactId: "a1", jobId: "j1", reviewStatus: "accepted", supersedesReviewId: "r1" },
  ]) {
    ledger.append({ type: "render-artifact-reviewed", subjectRef: payload.artifactId, payload: { ...payload, simulated: true } });
  }
  const projection = replayPerformanceLedger(ledger.events());
  assert.deepEqual(projection.reviews, { r1: "accepted", r2: "accepted" });
  assert.equal(projection.currentReviewOfArtifact["a1"], "r2");
  assert.deepEqual(projection.supersededBy, { r1: "r2" });
});

test("the fold is deterministic: same events => byte-identical projection", () => {
  const build = (): readonly SolutionEvent[] => {
    const ledger = makeLedger();
    ledger.append({ type: "performance-published", subjectRef: "p", payload: { kind: "publication", performanceId: "p", twinVersionId: "tv", basedOnTemplateId: "", timelineId: "tl", cueCount: 1, durationMs: 10, trackKinds: "motion", simulated: true } });
    return ledger.events();
  };
  assert.equal(stableStringify(replayPerformanceLedger(build())), stableStringify(replayPerformanceLedger(build())));
});

test("non-performance events are ignored by the performance fold", () => {
  const ledger = makeLedger();
  ledger.append({ type: "performance-published", subjectRef: "p", payload: { performanceId: "p", twinVersionId: "tv", basedOnTemplateId: "", timelineId: "tl", cueCount: 1, durationMs: 10, trackKinds: "motion", simulated: true } });
  ledger.append({ type: "twin-version-published", subjectRef: "tv", payload: { kind: "publication" } });
  ledger.append({ type: "evidence-recorded", subjectRef: "e", payload: { evidenceId: "e" } });
  const projection = replayPerformanceLedger(ledger.events());
  assert.equal(Object.keys(projection.performances).length, 1);
  assert.deepEqual(projection.renderJobs, {});
  assert.deepEqual(projection.reviews, {});
});
