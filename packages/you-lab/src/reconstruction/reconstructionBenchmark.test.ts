// Reconstruction benchmark tests (W3C) — coverage area 3: golden benchmark
// scores; the runner output matches the golden expectations exactly
// (byte-identical replay; run-id digest; not-measured markers; honest
// colmap-eval labeling; static no-nondeterminism scan).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { createReconstructionRegistry } from "../technology/reconstructionSeedProfiles.js";
import {
  evidenceSetDigest,
  fixtureEvidence,
  GOLDEN_RECONSTRUCTION_REPORT_RUN_ID,
  RECONSTRUCTION_BENCHMARK_FIXTURES,
} from "./reconstructionFixtures.js";
import { runStandardReconstructionBenchmark } from "./reconstructionRunner.js";
import { createStandardReconstructionCandidates } from "./reconstructionCandidates.js";
import { deriveReconstructionEvidence } from "./reconstructionEvidence.js";

const registry = createReconstructionRegistry();

function runOnce() {
  return runStandardReconstructionBenchmark(registry);
}

test("reconstruction benchmark: golden evidence digests for the seeded synthetic evidence sets", () => {
  for (const fixture of RECONSTRUCTION_BENCHMARK_FIXTURES) {
    const digest = evidenceSetDigest(fixtureEvidence(fixture));
    assert.equal(digest, fixture.expectedEvidenceDigest, `${fixture.fixtureId}: evidence digest golden`);
    // digest stability across repeated derivation
    const again = evidenceSetDigest(deriveReconstructionEvidence(fixture.seed, fixture.spec).evidence);
    assert.equal(again, digest, `${fixture.fixtureId}: derivation is deterministic`);
  }
});

test("reconstruction benchmark: evidence is derived from the W2C synthetic capture machinery (payloadId match)", () => {
  const fixture = RECONSTRUCTION_BENCHMARK_FIXTURES[0];
  assert.ok(fixture);
  const evidence = fixtureEvidence(fixture);
  assert.ok(evidence.length >= 1);
  // modality/frames flow 1:1 from the W2C capture spec
  assert.equal(evidence[0]?.modality, fixture.spec.capture.modality);
  assert.equal(evidence[0]?.frames, fixture.spec.capture.frames);
  assert.equal(evidence[0]?.width, fixture.spec.capture.width);
  assert.equal(evidence[0]?.height, fixture.spec.capture.height);
  assert.equal(evidence[0]?.viewCount, fixture.spec.viewCount);
  // the multiview fixture binds two evidence descriptors
  const multiview = RECONSTRUCTION_BENCHMARK_FIXTURES.find((entry) => entry.fixtureId === "fixture-recon-multiview-depth");
  assert.ok(multiview);
  assert.equal(fixtureEvidence(multiview).length, 2, "extra evidence seed bound");
});

test("reconstruction benchmark: golden per-fixture quality scores match exactly for every candidate", () => {
  const report = runOnce();
  for (const fixture of RECONSTRUCTION_BENCHMARK_FIXTURES) {
    for (const result of report.candidateResults) {
      const score = result.fixtureScores.find((entry) => entry.fixtureId === fixture.fixtureId);
      assert.ok(score, `${fixture.fixtureId}/${result.candidateId}: score present`);
      const expected = fixture.expectedScores[result.candidateId];
      assert.ok(expected !== undefined, `${fixture.fixtureId}/${result.candidateId}: golden recorded`);
      assert.equal(score.qualityScore, expected, `${fixture.fixtureId}/${result.candidateId}: golden score`);
    }
  }
});

test("reconstruction benchmark: golden report run id (full-report digest, byte-identical replay)", () => {
  const first = runOnce();
  const second = runOnce();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.runId, second.runId);
  assert.equal(first.runId, GOLDEN_RECONSTRUCTION_REPORT_RUN_ID);
});

test("reconstruction benchmark: every fixture+candidate pair has a golden expectation (no silent gaps)", () => {
  const report = runOnce();
  const candidateIds = report.candidateResults.map((result) => result.candidateId);
  assert.equal(candidateIds.length, 6);
  for (const fixture of RECONSTRUCTION_BENCHMARK_FIXTURES) {
    assert.deepEqual(
      Object.keys(fixture.expectedScores).sort(),
      [...candidateIds].sort(),
      `${fixture.fixtureId}: goldens cover every candidate`,
    );
  }
});

test("reconstruction benchmark: quality scores are bounded in [0, 1]", () => {
  const report = runOnce();
  for (const result of report.candidateResults) {
    assert.ok(result.overallQualityScore >= 0 && result.overallQualityScore <= 1);
    for (const score of result.fixtureScores) {
      assert.ok(score.qualityScore >= 0 && score.qualityScore <= 1);
    }
  }
});

test("reconstruction benchmark: effort / latency / cost are explicit not-measured markers (never faked)", () => {
  const report = runOnce();
  for (const result of report.candidateResults) {
    for (const field of [result.effort, result.latency, result.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
    }
    assert.equal(result.deterministic, true, "simulated candidates are deterministic");
  }
  assert.ok(report.notes.some((note) => note.includes("not measurements of real reconstruction technologies")));
  assert.ok(report.notes.some((note) => note.includes("not-measured (simulated)")));
});

test("reconstruction benchmark: the colmap evaluation candidate is honestly labeled (registry-backed, simulated execution)", () => {
  const report = runOnce();
  const colmap = report.candidateResults.find((result) => result.candidateId === "colmap-photogrammetry-eval");
  assert.ok(colmap, "colmap-photogrammetry-eval present");
  assert.equal(colmap.adapterKind, "evaluation");
  assert.equal(colmap.productionEligible, true, "registry-derived eligibility");
  for (const result of report.candidateResults.filter((entry) => entry.candidateId !== "colmap-photogrammetry-eval")) {
    assert.equal(result.adapterKind, "mock", `${result.candidateId}: pure mock`);
    assert.equal(result.productionEligible, null);
  }
  assert.ok(
    report.notes.some((note) => note.includes("the real COLMAP runtime was never executed")),
    "report notes disclose the W4+ deferral",
  );
});

test("reconstruction benchmark: fixture-objective sanity — reference-quality mocks beat degraded ones", () => {
  // Fixture-objective sanity (NOT a technology claim): the reference-quality
  // mock configurations must out-score the degraded ones under the scorer.
  const report = runOnce();
  const overall = new Map<string, number>(report.candidateResults.map((result) => [result.candidateId, result.overallQualityScore]));
  const scoreOf = (id: string): number => {
    const value = overall.get(id);
    assert.ok(value !== undefined, `candidate ${id} present in report`);
    return value;
  };
  assert.ok(scoreOf("mock-recon-geometry-precise") > scoreOf("mock-recon-geometry-coarse"), "precise > coarse (fixture objective)");
  assert.ok(scoreOf("mock-recon-neural-full") > scoreOf("mock-recon-neural-degraded"), "full > degraded (fixture objective)");
});

test("reconstruction benchmark: simulated photogrammetry is view-driven (view-starved weaker than multiview)", () => {
  // Fixture-objective sanity (NOT a technology claim): the simulated
  // classic-photogrammetry behavior must be weaker on the single-view fixture
  // than on the multiview fixture — the defining behavioral signature of the
  // photogrammetry approach class.
  const report = runOnce();
  const colmap = report.candidateResults.find((result) => result.candidateId === "colmap-photogrammetry-eval");
  assert.ok(colmap);
  const portrait = colmap.fixtureScores.find((entry) => entry.fixtureId === "fixture-recon-portrait-image")?.qualityScore ?? 0;
  const multiview = colmap.fixtureScores.find((entry) => entry.fixtureId === "fixture-recon-multiview-depth")?.qualityScore ?? 0;
  assert.ok(multiview > portrait, `multiview (${multiview}) > view-starved (${portrait}) — photogrammetry is view-driven`);
});

test("reconstruction benchmark: no ambient nondeterminism in the reconstruction source (static scan)", () => {
  const reconstructionDir = join(dirname(fileURLToPath(import.meta.url)));
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
  walk(reconstructionDir);
  assert.deepEqual(offenders, [], `forbidden nondeterminism tokens: ${offenders.join(", ")}`);
});

test("reconstruction benchmark: candidate construction is deterministic across rebuilds", () => {
  const first = createStandardReconstructionCandidates(registry);
  const second = createStandardReconstructionCandidates(registry);
  assert.deepEqual(
    first.map((adapter) => adapter.profile),
    second.map((adapter) => adapter.profile),
    "profiles rebuild identically",
  );
});
