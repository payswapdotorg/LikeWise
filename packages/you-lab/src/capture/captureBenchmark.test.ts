// Capture benchmark tests (W2C) — coverage area 3: golden benchmark scores;
// the runner output matches the golden expectations exactly (byte-identical
// replay; run-id digest; not-measured markers; static no-nondeterminism scan).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { CAPTURE_BENCHMARK_FIXTURES, GOLDEN_CAPTURE_REPORT_RUN_ID } from "./captureFixtures.js";
import { runCaptureBenchmark } from "./captureRunner.js";
import { createStandardCaptureCandidates } from "./captureCandidates.js";
import { generateSyntheticCapture } from "./syntheticPayload.js";

const candidates = createStandardCaptureCandidates();

function runOnce() {
  return runCaptureBenchmark(CAPTURE_BENCHMARK_FIXTURES, candidates);
}

test("benchmark: golden payload digests for the seeded synthetic capture fixtures", () => {
  for (const fixture of CAPTURE_BENCHMARK_FIXTURES) {
    const { payload } = generateSyntheticCapture(fixture.seed, fixture.spec);
    assert.equal(payload.payloadId, fixture.expectedPayloadDigest, `${fixture.fixtureId}: payload digest golden`);
  }
});

test("benchmark: golden per-fixture quality scores match exactly for every candidate", () => {
  const report = runOnce();
  for (const fixture of CAPTURE_BENCHMARK_FIXTURES) {
    for (const result of report.candidateResults) {
      const score = result.fixtureScores.find((entry) => entry.fixtureId === fixture.fixtureId);
      assert.ok(score, `${fixture.fixtureId}/${result.candidateId}: score present`);
      const expected = fixture.expectedScores[result.candidateId];
      assert.ok(expected !== undefined, `${fixture.fixtureId}/${result.candidateId}: golden recorded`);
      assert.equal(score.qualityScore, expected, `${fixture.fixtureId}/${result.candidateId}: golden score`);
    }
  }
});

test("benchmark: golden report run id (full-report digest, byte-identical replay)", () => {
  const first = runOnce();
  const second = runOnce();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.runId, second.runId);
  assert.equal(first.runId, GOLDEN_CAPTURE_REPORT_RUN_ID);
});

test("benchmark: every fixture+candidate pair has a golden expectation (no silent gaps)", () => {
  const report = runOnce();
  const candidateIds = report.candidateResults.map((result) => result.candidateId);
  assert.equal(candidateIds.length, 6);
  for (const fixture of CAPTURE_BENCHMARK_FIXTURES) {
    assert.deepEqual(
      Object.keys(fixture.expectedScores).sort(),
      [...candidateIds].sort(),
      `${fixture.fixtureId}: goldens cover every candidate`,
    );
  }
});

test("benchmark: quality scores are bounded in [0, 1]", () => {
  const report = runOnce();
  for (const result of report.candidateResults) {
    assert.ok(result.overallQualityScore >= 0 && result.overallQualityScore <= 1);
    for (const score of result.fixtureScores) {
      assert.ok(score.qualityScore >= 0 && score.qualityScore <= 1);
    }
  }
});

test("benchmark: effort / latency / cost are explicit not-measured markers (never faked)", () => {
  const report = runOnce();
  for (const result of report.candidateResults) {
    for (const field of [result.effort, result.latency, result.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
    }
    assert.equal(result.deterministic, true, "mock candidates are deterministic");
  }
  assert.ok(report.notes.some((note) => note.includes("not measurements of real capture technologies")));
  assert.ok(report.notes.some((note) => note.includes("not-measured (simulated)")));
});

test("benchmark: the precise segmentation and full-pose simulations lead their families", () => {
  // Fixture-objective sanity (NOT a technology claim): the reference-quality
  // mock configurations must out-score the degraded ones under the scorer.
  const report = runOnce();
  const overall = new Map<string, number>(report.candidateResults.map((result) => [result.candidateId, result.overallQualityScore]));
  const scoreOf = (id: string): number => {
    const value = overall.get(id);
    assert.ok(value !== undefined, `candidate ${id} present in report`);
    return value;
  };
  assert.ok(scoreOf("mock-seg-precise") > scoreOf("mock-seg-noisy"), "precise > noisy (fixture objective)");
  assert.ok(scoreOf("mock-seg-precise") > scoreOf("mock-seg-coarse"), "precise > coarse (fixture objective)");
  assert.ok(scoreOf("mock-pose-full") > scoreOf("mock-pose-degraded"), "full > degraded (fixture objective)");
  assert.ok(scoreOf("mock-pose-full") > scoreOf("mock-pose-partial"), "full > partial (fixture objective)");
});

test("benchmark: no ambient nondeterminism in the capture source (static scan)", () => {
  const captureDir = join(dirname(fileURLToPath(import.meta.url)));
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
        const text = readFileSync(path, "utf8");
        for (const forbidden of ["Date.now(", "Math.random(", "performance.now("]) {
          if (text.includes(forbidden)) offenders.push(`${path}: ${forbidden}`);
        }
      }
    }
  };
  walk(captureDir);
  assert.deepEqual(offenders, [], `forbidden nondeterminism tokens: ${offenders.join(", ")}`);
});
