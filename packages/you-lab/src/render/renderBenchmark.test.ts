// Deterministic render benchmark tests (W4C) — coverage: seeded synthetic
// performance fixtures replay byte-identically (golden digests), golden
// candidate scores, golden report run id, honest notes, and full coverage of
// the image/video/mesh/animation output kinds across the candidate set.
import assert from "node:assert/strict";
import test from "node:test";
import { createRenderRegistry } from "../technology/renderSeedProfiles.js";
import {
  GOLDEN_RENDER_REPORT_RUN_ID,
  RENDER_BENCHMARK_FIXTURES,
  fixtureTimeline,
  timelineDigest,
} from "./renderFixtures.js";
import { runStandardRenderBenchmark, RENDER_BENCH_SUBMITTED_AT } from "./renderRunner.js";
import { createStandardRenderCandidates } from "./renderCandidates.js";
import { achievableRenderFidelity, RENDER_ARTIFACT_WEIGHTS, scoreRenderArtifacts } from "./renderArtifactScorer.js";
import { sha256Hex } from "./renderAdapterSeam.js";

const registry = createRenderRegistry();

test("render benchmark: three seeded fixtures with golden timeline digests (byte-identical replay)", () => {
  assert.equal(RENDER_BENCHMARK_FIXTURES.length, 3);
  for (const fixture of RENDER_BENCHMARK_FIXTURES) {
    const first = fixtureTimeline(fixture);
    const second = fixtureTimeline(fixture);
    assert.deepEqual(second, first, `${fixture.fixtureId}: timeline replays deterministically`);
    assert.equal(
      timelineDigest(first),
      fixture.expectedTimelineDigest,
      `${fixture.fixtureId}: golden timeline digest`,
    );
    // Timeline laws: cues sorted by startMs, per-track non-overlap, duration = max endMs.
    let previousStartMs: number | null = null;
    const lastEndByTrack = new Map<string, number>();
    for (const cue of first.cues) {
      if (previousStartMs !== null) assert.ok(cue.startMs >= previousStartMs, "cues ordered by startMs");
      previousStartMs = cue.startMs;
      const lastEnd = lastEndByTrack.get(cue.track);
      assert.ok(lastEnd === undefined || cue.startMs >= lastEnd, "no per-track overlap");
      lastEndByTrack.set(cue.track, cue.endMs);
      assert.ok(cue.endMs > cue.startMs);
      assert.ok(/^[0-9a-f]{64}$/.test(cue.payloadHash), "cue payload content-addressed");
    }
    assert.equal(first.durationMs, Math.max(...first.cues.map((cue) => cue.endMs)));
  }
});

test("render benchmark: golden candidate scores per fixture (exact fixture objectives)", () => {
  const report = runStandardRenderBenchmark(registry);
  for (const fixture of RENDER_BENCHMARK_FIXTURES) {
    const expected = fixture.expectedScores;
    const candidateIds = Object.keys(expected).sort();
    assert.ok(candidateIds.length > 0, `${fixture.fixtureId}: golden scores recorded`);
    for (const candidateId of candidateIds) {
      const result = report.candidateResults.find((entry) => entry.candidateId === candidateId);
      assert.ok(result, `${fixture.fixtureId}: candidate ${candidateId} ran`);
      const score = result.fixtureScores.find((entry) => entry.fixtureId === fixture.fixtureId);
      assert.ok(score, `${fixture.fixtureId}: score entry for ${candidateId}`);
      assert.equal(
        score.qualityScore,
        expected[candidateId],
        `${fixture.fixtureId}/${candidateId}: golden quality score`,
      );
    }
  }
});

test("render benchmark: golden report run id (byte-identical full-report replay)", () => {
  const report = runStandardRenderBenchmark(registry);
  assert.equal(report.runId, GOLDEN_RENDER_REPORT_RUN_ID);
  const rerun = runStandardRenderBenchmark(registry);
  assert.equal(rerun.runId, report.runId, "run id is a deterministic digest of the report");
  assert.deepEqual(rerun.candidateResults, report.candidateResults);
});

test("render benchmark: overall scores are means of fixture scores; effort stays not-measured", () => {
  const report = runStandardRenderBenchmark(registry);
  for (const result of report.candidateResults) {
    assert.equal(result.fixtureScores.length, 3);
    const mean = result.fixtureScores.reduce((sum, entry) => sum + entry.qualityScore, 0) / 3;
    assert.equal(result.overallQualityScore, Math.round(mean * 10_000) / 10_000);
    assert.equal(result.effort.kind, "not-measured");
    assert.equal(result.latency.kind === "not-measured" ? result.latency.marker : "", "not-measured (simulated)");
    assert.equal(result.cost.kind, "not-measured");
    assert.equal(result.deterministic, true);
  }
  const mock = report.candidateResults.find((entry) => entry.adapterKind === "mock");
  const evaluation = report.candidateResults.find((entry) => entry.adapterKind === "evaluation");
  assert.ok(mock && mock.productionEligible === null, "mocks carry no eligibility claim");
  assert.ok(evaluation && evaluation.productionEligible === true, "evaluation adapter is registry-eligible");
});

test("render benchmark: honest notes (computed fixture objectives, not measurements)", () => {
  const report = runStandardRenderBenchmark(registry);
  const notes = report.notes.join(" | ");
  assert.ok(notes.includes("not measurements of real render technologies"));
  assert.ok(notes.includes("pure mocks"));
  assert.ok(notes.includes("the real three.js runtime was never executed"));
  assert.ok(notes.includes("no measurement was performed and none is implied"));
  assert.ok(report.fixtureSetVersion.startsWith("w4c-render-benchmark-fixtures/"));
  assert.ok(report.scorerVersion.startsWith("you-lab-render-artifact-scorer/"));
});

test("render benchmark: all four output kinds are exercised across the candidate set", () => {
  const candidates = createStandardRenderCandidates(registry);
  const kindsRequested = new Set<string>();
  for (const candidate of candidates) {
    for (const kind of candidate.profile.supportedOutputKinds) {
      kindsRequested.add(kind);
    }
  }
  for (const kind of ["animation", "image", "mesh", "video"]) {
    assert.ok(kindsRequested.has(kind), `kind "${kind}" covered by the standard candidate set`);
  }
  // Every adapter ran with the fixed fixture-mode timestamp (no clock).
  assert.equal(RENDER_BENCH_SUBMITTED_AT, "2026-10-11T12:00:00Z");
});

test("render benchmark: scorer weights and achievable ceiling are the fixture definition", () => {
  assert.deepEqual(RENDER_ARTIFACT_WEIGHTS, { outputCoverage: 0.5, fidelityCalibration: 0.3, contentAddressing: 0.2 });
  const dense = fixtureTimeline(RENDER_BENCHMARK_FIXTURES[1]!);
  const sparse = fixtureTimeline(RENDER_BENCHMARK_FIXTURES[2]!);
  assert.ok(achievableRenderFidelity(dense, "3d-render") > achievableRenderFidelity(sparse, "3d-render"));
  assert.ok(achievableRenderFidelity(dense, "3d-render") > achievableRenderFidelity(dense, "motion-extraction"));
  // A perfectly-calibrated, fully-covering, validly-addressed output scores 1.
  const parts = scoreRenderArtifacts(
    [
      {
        artifactId: "a1",
        kind: "mesh",
        contentRef: "content-store://you-lab/render/x/y/mesh",
        contentHash: sha256Hex(new Uint8Array([1, 2, 3])),
        fidelity: achievableRenderFidelity(dense, "3d-render"),
        simulated: true,
        generator: "test",
        payload: new Uint8Array([1, 2, 3]),
      },
    ],
    ["mesh"],
    dense,
    "3d-render",
  );
  assert.equal(parts.artifactQualityScore, 1);
});
