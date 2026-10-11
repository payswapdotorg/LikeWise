import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import {
  PERFORMANCE_SCENARIO_SEED,
  PERFORMANCE_SCENARIO_SOLUTION_ID,
  runPerformanceFixtureScenario,
  serializePerformanceScenarioTrace,
  type PerformanceScenarioTrace,
} from "./performanceFixtureScenario.js";

const EXPECTED_STEP_NAMES = [
  "twin-created",
  "twin-version-canonical",
  "template-registered",
  "template-duplicate-name-refused",
  "performance-instantiated",
  "performance-published-direct",
  "invalid-timeline-refused",
  "render-job-submitted",
  "render-job-started",
  "render-job-completed",
  "render-artifacts-registered",
  "artifact-review-superseded",
  "artifact-review-rejected",
  "artifact-review-accepted",
  "artifact-re-review-superseding",
  "render-job-failed",
  "render-method-unsupported",
  "ledger-readout",
];

function runScenario(): PerformanceScenarioTrace {
  return runPerformanceFixtureScenario();
}

function stepOf(trace: PerformanceScenarioTrace, name: string) {
  const found = trace.steps.find((step) => step.name === name);
  assert.ok(found !== undefined, `missing step ${name}`);
  return found.facts;
}

test("the performance scenario runs the full wave-4 arrow and records every scripted step", () => {
  const trace = runScenario();
  assert.equal(trace.solutionId, PERFORMANCE_SCENARIO_SOLUTION_ID);
  assert.deepEqual(
    trace.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  for (let index = 0; index < trace.steps.length; index += 1) {
    assert.equal(trace.steps[index]?.step, index + 1);
  }
});

test("the performance scenario is deterministic: two fresh runs are byte-identical", () => {
  const first = runScenario();
  const second = runScenario();
  assert.equal(serializePerformanceScenarioTrace(first), serializePerformanceScenarioTrace(second));
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.templateId, second.templateId);
  assert.equal(first.instantiatedPerformanceId, second.instantiatedPerformanceId);
  assert.equal(first.renderJobId, second.renderJobId);
  assert.deepEqual(first.artifactIds, second.artifactIds);
  assert.equal(first.ledgerHash, second.ledgerHash);
  assert.equal(first.eventCount, second.eventCount);
  assert.equal(first.performanceStoreSize, second.performanceStoreSize);
  assert.equal(stableStringify(first.steps), stableStringify(second.steps));
});

test("the scenario satisfies the W4A golden facts (frozen fixture definition)", () => {
  const trace = runScenario();

  // Twin wiring: a real canonical TwinVersion provides the binding.
  const twinVersion = stepOf(trace, "twin-version-canonical");
  assert.equal(twinVersion["status"], "canonical");
  assert.equal(twinVersion["versionNumber"], 1);
  assert.equal(twinVersion["domainBlockCount"], 3);
  assert.equal(trace.twinVersionId, twinVersion["twinVersionId"]);

  // Template: three tracks, five cues, 5000ms, three declared parameters.
  const template = stepOf(trace, "template-registered");
  assert.equal(template["cueCount"], 5);
  assert.equal(template["durationMs"], 5000);
  assert.equal(template["parameterCount"], 3);
  assert.equal(trace.templateId, template["templateId"]);

  // Name uniqueness: the duplicate registration is the typed refusal.
  const duplicate = stepOf(trace, "template-duplicate-name-refused");
  assert.equal(duplicate["outcome"], "YOU_INVALID_STATE");
  assert.equal(duplicate["reason"], "duplicate-template-name");

  // Instantiation: timeline VERBATIM, overrides + defaults bound.
  const instantiated = stepOf(trace, "performance-instantiated");
  assert.equal(instantiated["timelineVerbatim"], true);
  assert.equal(instantiated["basedOnTemplateId"], trace.templateId);
  assert.equal(instantiated["twinVersionId"], trace.twinVersionId);
  assert.equal(instantiated["cueCount"], 5);
  assert.equal(instantiated["durationMs"], 5000);
  assert.equal(instantiated["boundIntensity"], 0.5);
  assert.equal(instantiated["boundGreeting"], "Hello from the scenario twin");
  assert.equal(instantiated["boundLoopDefault"], false);
  assert.equal(trace.instantiatedPerformanceId, instantiated["performanceId"]);

  // Direct publication carries no template linkage.
  const direct = stepOf(trace, "performance-published-direct");
  assert.equal(direct["basedOnTemplateId"], "");
  assert.equal(direct["cueCount"], 2);
  assert.equal(direct["durationMs"], 2500);

  // Invalid timeline: same-track overlap is the typed refusal.
  const invalid = stepOf(trace, "invalid-timeline-refused");
  assert.equal(invalid["outcome"], "YOU_TIMELINE_INVALID");
  assert.equal(invalid["reason"], "timeline-invalid");
  assert.ok(String(invalid["detail"]).includes("track-overlap"));

  // Render job: queued -> running -> completed with two artifacts.
  const submitted = stepOf(trace, "render-job-submitted");
  assert.equal(submitted["method"], "video-render");
  assert.equal(submitted["outputKinds"], "image,video");
  assert.equal(trace.renderJobId, submitted["jobId"]);
  const started = stepOf(trace, "render-job-started");
  assert.equal(started["statusAfter"], "running");
  const completed = stepOf(trace, "render-job-completed");
  assert.equal(completed["status"], "completed");
  assert.equal(completed["artifactCount"], 2);
  assert.equal(completed["latencyNotMeasured"], true);
  assert.equal(completed["latencyMarker"], "not-measured (simulated)");
  assert.equal(completed["simulated"], true);

  // Artifacts: content-addressed lineage (golden hashes — fixture definition).
  const artifacts = stepOf(trace, "render-artifacts-registered");
  assert.equal(artifacts["artifact1Kind"], "image");
  assert.equal(artifacts["artifact1Hash"], "e8418cc8");
  assert.equal(artifacts["artifact2Kind"], "video");
  assert.equal(artifacts["artifact2Hash"], "e18e6928");
  assert.deepEqual(trace.artifactIds, [artifacts["artifact1Id"], artifacts["artifact2Id"]]);

  // Reviews: superseded (withdrawal), rejected, accepted, re-review linkage.
  const superseded = stepOf(trace, "artifact-review-superseded");
  assert.equal(superseded["status"], "superseded");
  assert.equal(superseded["artifactKind"], "video");
  assert.equal(trace.withdrawnReviewId, superseded["reviewId"]);
  const rejected = stepOf(trace, "artifact-review-rejected");
  assert.equal(rejected["status"], "rejected");
  assert.equal(trace.rejectedReviewId, rejected["reviewId"]);
  const accepted = stepOf(trace, "artifact-review-accepted");
  assert.equal(accepted["status"], "accepted");
  assert.equal(trace.acceptedReviewId, accepted["reviewId"]);
  const reReview = stepOf(trace, "artifact-re-review-superseding");
  assert.equal(reReview["supersedesReviewId"], trace.acceptedReviewId);
  assert.equal(reReview["supersededKeepsStatus"], "accepted");
  assert.equal(reReview["newStatus"], "accepted");
  assert.equal(reReview["currentReviewId"], trace.reReviewId);

  // Failed-job path: honest markers, typed failure reason, no artifacts.
  const failed = stepOf(trace, "render-job-failed");
  assert.equal(failed["status"], "failed");
  assert.equal(failed["artifactCount"], 0);
  assert.equal(failed["failureReason"], "fixture-injected-failure");
  assert.equal(failed["latencyNotMeasured"], true);
  assert.equal(failed["simulated"], true);
  assert.equal(trace.failedJobId, failed["jobId"]);

  // Unsupported method: unregistered hologram-render is the typed refusal.
  const unsupported = stepOf(trace, "render-method-unsupported");
  assert.equal(unsupported["method"], "hologram-render");
  assert.equal(unsupported["outcome"], "YOU_RENDER_UNSUPPORTED");
  assert.equal(unsupported["reason"], "unregistered-method");

  // Ledger readout: append-only, replayable, golden hash.
  const readout = stepOf(trace, "ledger-readout");
  assert.equal(readout["eventCount"], 13);
  assert.equal(readout["ledgerHash"], "f304e891");
  assert.equal(readout["projectionMatchesReplay"], true);
  assert.equal(readout["performanceCount"], 2);
  assert.equal(readout["renderJobCount"], 2);
  assert.equal(readout["artifactCount"], 2);
  assert.equal(readout["reviewCount"], 4);
  assert.equal(readout["supersededReviewCount"], 1);
  assert.equal(readout["performanceStoreSize"], 11);
  assert.equal(trace.eventCount, 13);
  assert.equal(trace.ledgerHash, "f304e891");
  assert.equal(trace.projectionMatchesReplay, true);
  assert.equal(trace.performanceStoreSize, 11);
});

test("different seeds change the ids and hashes but keep the machinery deterministic", () => {
  const base = runScenario();
  const variant = runPerformanceFixtureScenario({
    performanceSeed: `${PERFORMANCE_SCENARIO_SEED}-alt`,
    twinSeed: `${PERFORMANCE_SCENARIO_SEED}-alt`,
  });
  assert.notEqual(base.templateId, variant.templateId);
  assert.notEqual(base.ledgerHash, variant.ledgerHash);
  assert.equal(variant.projectionMatchesReplay, true);
  // Step machinery (names + count) is seed-independent.
  assert.deepEqual(
    variant.steps.map((step) => step.name),
    EXPECTED_STEP_NAMES,
  );
  const rerun = runPerformanceFixtureScenario({
    performanceSeed: `${PERFORMANCE_SCENARIO_SEED}-alt`,
    twinSeed: `${PERFORMANCE_SCENARIO_SEED}-alt`,
  });
  assert.equal(serializePerformanceScenarioTrace(variant), serializePerformanceScenarioTrace(rerun));
});
