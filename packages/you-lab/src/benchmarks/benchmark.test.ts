// Benchmark runner tests (W1C) — coverage area 6: golden scores for the three
// comparison arms on the seeded fixture set; deterministic across runs.
import assert from "node:assert/strict";
import test from "node:test";
import { runBenchmark } from "./runner.js";
import { BENCHMARK_FIXTURES, GOLDEN_ARM_OVERALL, GOLDEN_REPORT_RUN_ID } from "./fixtures.js";
import { createDefaultRegistry } from "../technology/seedProfiles.js";
import { canonicalJson } from "../determinism.js";

const registry = createDefaultRegistry();

test("benchmark: golden overall scores for the three comparison arms", () => {
  const report = runBenchmark(BENCHMARK_FIXTURES, registry);
  const scores = Object.fromEntries(report.armResults.map((arm) => [arm.arm, arm.overallQualityScore]));
  assert.deepEqual(scores, { ...GOLDEN_ARM_OVERALL });
  assert.equal(report.runId, GOLDEN_REPORT_RUN_ID);
});

test("benchmark: deterministic across runs (byte-identical report replay)", () => {
  const first = runBenchmark(BENCHMARK_FIXTURES, registry);
  const second = runBenchmark(BENCHMARK_FIXTURES, registry);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.runId, second.runId);
  // per-fixture scores are stable as well
  assert.deepEqual(first.armResults[0]?.fixtureScores, second.armResults[0]?.fixtureScores);
});

test("benchmark: searched arm meets the promotion criterion on the fixture objective", () => {
  const report = runBenchmark(BENCHMARK_FIXTURES, registry);
  const overall = Object.fromEntries(report.armResults.map((arm) => [arm.arm, arm.overallQualityScore]));
  const searched = overall["searched"];
  const baseline = overall["generalist-baseline"];
  const handDesigned = overall["hand-designed"];
  assert.ok(typeof searched === "number" && typeof baseline === "number" && typeof handDesigned === "number");
  // docs/you/LAB.md: the searched organization is only promoted when it beats
  // the baseline under the relevant objective.
  assert.ok(searched > baseline, `searched (${searched}) must beat baseline (${baseline})`);
  assert.ok(searched >= handDesigned, `searched (${searched}) must be >= hand-designed (${handDesigned})`);
});

test("benchmark: manual-effort / latency / cost are explicit not-measured markers (never faked)", () => {
  const report = runBenchmark(BENCHMARK_FIXTURES, registry);
  for (const arm of report.armResults) {
    for (const field of [arm.manualEffort, arm.latency, arm.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
    }
    assert.ok(arm.privacy.note.includes("fixture claim"));
  }
  assert.ok(report.notes.some((note) => note.includes("not user studies")));
  assert.ok(report.notes.some((note) => note.includes("not-measured (simulated)")));
});

test("benchmark: quality scores are bounded and per-fixture goldens are stable", () => {
  const first = runBenchmark(BENCHMARK_FIXTURES, registry);
  const second = runBenchmark(BENCHMARK_FIXTURES, registry);
  for (const arm of first.armResults) {
    assert.ok(arm.overallQualityScore >= 0 && arm.overallQualityScore <= 1);
    for (const score of arm.fixtureScores) {
      assert.ok(score.qualityScore >= 0 && score.qualityScore <= 1);
    }
  }
  // determinism at fixture granularity
  for (let i = 0; i < first.armResults.length; i++) {
    const a = first.armResults[i];
    const b = second.armResults[i];
    assert.ok(a && b);
    assert.deepEqual(a.fixtureScores, b.fixtureScores);
  }
});

test("benchmark: arms cover exactly the three LAB.md comparison organizations", () => {
  const report = runBenchmark(BENCHMARK_FIXTURES, registry);
  assert.deepEqual(
    report.armResults.map((arm) => arm.arm),
    ["generalist-baseline", "hand-designed", "searched"],
  );
  assert.equal(report.armResults.length, 3);
});
