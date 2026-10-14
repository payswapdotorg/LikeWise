// Ecosystem benchmark tests (W10C) — coverage: the deterministic mock
// adapters replay byte-identically from the seed (double invocation), the
// fail-closed evaluation adapter refuses construction when the registry
// derivation shifts, the golden fixture scores match exactly (recorded
// values — byte-identical replay), the golden report runId replays, and
// the honest not-measured markers survive on the benchmark report.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { createStage10EcosystemRegistry, ECOSYSTEM_SEED_PROFILES } from "../technology/ecosystemSeedProfiles.js";
import { createArenaRegistry } from "../technology/retryBackoffSeedProfiles.js";
import { createRegistry, type TechnologyProfile } from "../technology/registry.js";
import { deriveProviderMatrix } from "./providerMatrixSeam.js";
import { createStandardEcosystemLedger, ECOSYSTEM_BENCHMARK_FIXTURES, ECOSYSTEM_FIXTURE_SET_VERSION, fixtureRequest, GOLDEN_ECOSYSTEM_REPORT_RUN_ID } from "./ecosystemFixtures.js";
import { runStandardEcosystemBenchmark } from "./ecosystemRunner.js";
import { createStandardEcosystemCandidates, MOCK_ECOSYSTEM_CANDIDATES } from "./ecosystemCandidates.js";
import { createModelViewerArEvaluationAdapter, MODEL_VIEWER_EVALUATION_ADAPTER_ID } from "./modelViewerArEvaluationAdapter.js";
import { createMockEcosystemAdapter } from "./mockEcosystemAdapter.js";

const registry = createStage10EcosystemRegistry();
const matrix = deriveProviderMatrix(registry);
const ledger = createStandardEcosystemLedger();
const candidates = createStandardEcosystemCandidates(registry);

test("ecosystem benchmark: mock adapters replay byte-identically from the seed (no network, no clock)", () => {
  for (const fixture of ECOSYSTEM_BENCHMARK_FIXTURES) {
    const request = fixtureRequest(fixture);
    for (const candidate of candidates) {
      const first = candidate.fulfill(request, matrix, ledger);
      const second = candidate.fulfill(request, matrix, ledger);
      assert.equal(canonicalJson(first), canonicalJson(second), `${candidate.profile.id} replays byte-identically on ${fixture.fixtureId}`);
      assert.equal(first.simulated, true, "truth law: fixture fulfillments stay simulated");
      assert.equal(first.requestId, request.requestId, "identity law: outputs thread the request identity");
      assert.equal(first.matrixEntryId, matrix.resolve(request.providerKind, request.region)?.id, "identity law: outputs thread the matrix row");
    }
  }
});

test("ecosystem benchmark: the golden report runId replays exactly (recorded 2026-10-14)", () => {
  const report = runStandardEcosystemBenchmark(candidates, matrix, ledger);
  assert.equal(report.runId, GOLDEN_ECOSYSTEM_REPORT_RUN_ID);
  assert.equal(report.fixtureSetVersion, ECOSYSTEM_FIXTURE_SET_VERSION);
  const second = runStandardEcosystemBenchmark(candidates, matrix, ledger);
  assert.equal(report.runId, second.runId);
  // every candidate is deterministic (computed by double invocation, not asserted)
  assert.ok(report.candidateResults.every((result) => result.deterministic));
});

test("ecosystem benchmark: the golden per-fixture scores match exactly (recorded values)", () => {
  const report = runStandardEcosystemBenchmark(candidates, matrix, ledger);
  for (const fixture of ECOSYSTEM_BENCHMARK_FIXTURES) {
    for (const [candidateId, expectedScore] of Object.entries(fixture.expectedScores)) {
      const result = report.candidateResults.find((entry) => entry.candidateId === candidateId);
      assert.ok(result, `candidate ${candidateId} present on ${fixture.fixtureId}`);
      const fixtureScore = result.fixtureScores.find((entry) => entry.fixtureId === fixture.fixtureId);
      assert.ok(fixtureScore);
      assert.equal(fixtureScore.fidelityScore, expectedScore, `${candidateId} on ${fixture.fixtureId}`);
    }
  }
  // the precise mock and the evaluation adapter score the full 1.0 fidelity
  for (const perfectCandidate of ["mock-ecosystem-precise", MODEL_VIEWER_EVALUATION_ADAPTER_ID]) {
    const result = report.candidateResults.find((entry) => entry.candidateId === perfectCandidate);
    assert.ok(result);
    assert.ok(result.fixtureScores.every((entry) => entry.fidelityScore === 1), `${perfectCandidate} scores 1.0 on every fixture`);
    assert.equal(result.overallFidelityScore, 1);
  }
  // the minimal mock scores strictly below the precise mock on every fixture
  const minimal = report.candidateResults.find((entry) => entry.candidateId === "mock-ecosystem-minimal")!;
  const precise = report.candidateResults.find((entry) => entry.candidateId === "mock-ecosystem-precise")!;
  for (let index = 0; index < minimal.fixtureScores.length; index++) {
    assert.ok(
      minimal.fixtureScores[index]!.fidelityScore < precise.fixtureScores[index]!.fidelityScore,
      "degradation classes are ordered on every fixture",
    );
  }
});

test("ecosystem benchmark: the intended payload digests replay exactly (the golden objectives)", async () => {
  const { fixtureIntendedPayloadDigest } = await import("./ecosystemRunner.js");
  for (const fixture of ECOSYSTEM_BENCHMARK_FIXTURES) {
    const digest = fixtureIntendedPayloadDigest(fixture, matrix);
    assert.equal(digest, fixture.expectedIntendedPayloadDigest, `${fixture.fixtureId} intended payload digest`);
    assert.equal(digest, fixtureIntendedPayloadDigest(fixture, matrix), "digest derivation is deterministic");
  }
});

test("ecosystem benchmark: honest markers survive on the report (truth law)", () => {
  const report = runStandardEcosystemBenchmark(candidates, matrix, ledger);
  for (const result of report.candidateResults) {
    assert.equal(result.effort.kind, "not-measured");
    assert.ok(result.latency.kind === "not-measured" && result.latency.marker === "not-measured (simulated)");
    assert.equal(result.cost.kind, "not-measured");
  }
  const evaluation = report.candidateResults.find((entry) => entry.candidateId === MODEL_VIEWER_EVALUATION_ADAPTER_ID);
  assert.ok(evaluation);
  assert.equal(evaluation.adapterKind, "evaluation");
  assert.equal(evaluation.productionEligible, true);
  for (const mock of report.candidateResults.filter((entry) => entry.adapterKind === "mock")) {
    assert.equal(mock.productionEligible, null, "pure mocks carry no eligibility claim");
  }
  assert.ok(report.notes.some((note) => note.includes("not measurements of real ecosystem technologies")));
  assert.ok(report.notes.some((note) => note.includes("the real @google/model-viewer component was never executed")));
});

test("ecosystem benchmark: the mock candidate set covers the order's degradation classes", () => {
  assert.equal(MOCK_ECOSYSTEM_CANDIDATES.length, 6);
  const ids = MOCK_ECOSYSTEM_CANDIDATES.map((candidate) => candidate.candidateId);
  assert.deepEqual(ids, [
    "mock-ecosystem-precise", "mock-ecosystem-coarse", "mock-ecosystem-lossy",
    "mock-ecosystem-stale-export", "mock-ecosystem-misbreaker", "mock-ecosystem-minimal",
  ]);
  // the misbreaker mock's misderivation stays visible in its warnings (never rewritten)
  const misbreaker = createMockEcosystemAdapter(MOCK_ECOSYSTEM_CANDIDATES[4]!.config);
  const request = fixtureRequest(ECOSYSTEM_BENCHMARK_FIXTURES[0]!);
  const output = misbreaker.fulfill(request, matrix, ledger);
  assert.ok(output.warnings.some((warning) => warning.startsWith("breaker misderivation")), output.warnings.join("; "));
  const firstPayload = Object.values(output.payloads)[0];
  assert.ok(firstPayload);
  assert.equal(firstPayload.breakerClass, "token-bucket");
  assert.equal(firstPayload.requestedBreakerClass, request.budget.breakerClass);
});

test("ecosystem benchmark: the evaluation adapter refuses construction when the registry derivation shifts", () => {
  // The W8C registry (no W10C additions) has no 'model-viewer' — construction fails closed.
  assert.throws(
    () => createModelViewerArEvaluationAdapter(createArenaRegistry()),
    /technology 'model-viewer' missing from the registry \(truth law — refusing to construct\)/,
  );
  // A registry whose model-viewer row loses eligibility (a fabricated stale
  // maintenance signal) refuses construction too — the fail-closed W6C/W7C/W8C pattern.
  const fabricatedProfile: TechnologyProfile = {
    id: "model-viewer",
    name: "model-viewer",
    kind: "library",
    capabilityTags: ["ecosystem-class:ar", "web-ar-viewer", "ar-quick-look", "scene-viewer", "gltf-viewing"],
    license: {
      spdxId: "Apache-2.0",
      name: "Apache License 2.0",
      sourceUrl: "https://registry.npmjs.org/@google/model-viewer",
      verified: true,
      note: "fabricated negative-control profile (test only)",
    },
    maintenance: [
      // stale on purpose: 2024-01-01 is ~652 days before the 2026-10-14 research date
      { kind: "npm-publish", signal: "@google/model-viewer@0.0.0", date: "2024-01-01", sourceUrl: "https://registry.npmjs.org/@google/model-viewer", verified: true },
    ],
    repoUrl: "https://github.com/google/model-viewer",
    compatibility: { summary: "negative control", verified: false },
    provenance: {
      researchDate: "2026-10-14",
      sourceUrls: [],
      claimBasis: "negative control profile (test only)",
      unverifiedClaims: ["license: fabricated negative-control profile"],
    },
    editorCapable: false,
  };
  const shiftedRegistry = createRegistry([
    ...ECOSYSTEM_SEED_PROFILES.filter((profile) => profile.id !== "model-viewer"),
    fabricatedProfile,
  ]);
  assert.throws(
    () => createModelViewerArEvaluationAdapter(shiftedRegistry),
    /no longer derives as the top production-eligible ar-lane ecosystem candidate.*refusing to construct \(truth law\)/,
  );
  // A registry whose model-viewer profile carries the wrong ecosystem class also refuses.
  const wrongClassRegistry = createRegistry([
    ...ECOSYSTEM_SEED_PROFILES.filter((profile) => profile.id !== "model-viewer"),
    {
      ...fabricatedProfile,
      maintenance: [{ kind: "npm-publish", signal: "@google/model-viewer@4.4.0", date: "2026-10-09", sourceUrl: "https://registry.npmjs.org/@google/model-viewer", verified: true }],
      capabilityTags: ["ecosystem-class:style-pipeline"],
    },
  ]);
  assert.throws(
    () => createModelViewerArEvaluationAdapter(wrongClassRegistry),
    /no longer derives in the ar ecosystem class \(got 'style-pipeline'\)/,
  );
});

test("ecosystem benchmark: the evaluation adapter facts cite the registry-derived basis", () => {
  const adapter = createModelViewerArEvaluationAdapter(registry);
  assert.ok(adapter.facts.eligibilityBasis.includes("Apache-2.0"));
  assert.ok(adapter.facts.eligibilityBasis.includes("registry.npmjs.org"));
  assert.equal(adapter.facts.maintenanceAgeDays, 5);
  assert.equal(adapter.facts.ecosystemClass, "ar");
  assert.equal(adapter.profile.technologyId, "model-viewer");
  assert.equal(adapter.profile.adapterKind, "evaluation");
  assert.equal(adapter.profile.deterministic, true);
});
