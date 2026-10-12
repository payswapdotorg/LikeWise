// Mock learning adapter tests (W6C) — coverage: byte-identical replay from
// the seed (determinism), content-addressed candidate records (contentHash =
// sha-256 of the canonical payload bytes), rights threaded from the injected
// context (never minted), typed signal-kind/scope refusal, seeded and graded
// degradation across the three knobs, and honest simulated markers.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { createLearningRegistry } from "../technology/learningSeedProfiles.js";
import {
  LEARNING_UNSUPPORTED_CODE,
  UnsupportedLearningSignalError,
  assertLearningRequestSupported,
  neutralLearningCandidateId,
  sha256Hex,
  type NeutralLearningRequest,
  type NeutralLearningRights,
} from "./learningAdapterSeam.js";
import { createMockLearningAdapter } from "./mockLearningAdapter.js";
import { createVowpalWabbitLearningEvaluationAdapter } from "./vowpalWabbitEvaluationAdapter.js";
import { createStandardLearningCandidates, MOCK_LEARNING_CANDIDATES } from "./learningCandidates.js";
import { fixtureInvocationSignal, LEARNING_BENCHMARK_FIXTURES } from "./learningFixtures.js";
import { LEARNING_BENCH_SUBMITTED_AT } from "./learningRunner.js";
import { scoreLearningFidelity } from "./learningScorer.js";

const registry = createLearningRegistry();

function injectedRights(): NeutralLearningRights {
  return {
    usage: ["organization-improvement", "personalization", "tool-selection"],
    consentRef: "you-lab-mock-test-consent",
    consentHash: sha256Hex("you-lab-mock-test-consent"),
    expiresAt: null,
  };
}

function request(): NeutralLearningRequest {
  const fixture = LEARNING_BENCHMARK_FIXTURES[0]!;
  const signal = fixtureInvocationSignal(fixture);
  return {
    requestId: "req-test-1",
    signal,
    scope: signal.scope,
    rights: injectedRights(),
    submittedAt: LEARNING_BENCH_SUBMITTED_AT,
  };
}

const orgMock = createMockLearningAdapter({
  id: "mock-learning-org-test",
  learnerClass: "rule-induction",
  supportedSignalKinds: ["expert-intervention", "feedback", "manual-takeover"],
  supportedScopes: ["APPLICATION", "PROJECT", "TENANT", "USER"],
  evidenceIngestRate: 0.2,
  valueDrift: 0.1,
  preservesDomains: true,
});

test("mock learning adapter: byte-identical replay from the seed (determinism)", () => {
  const first = orgMock.learn(request());
  const second = orgMock.learn(request());
  assert.equal(canonicalJson(second), canonicalJson(first));
  // a different request id derives different candidate ids (seed-derived ids)
  const other = orgMock.learn({ ...request(), requestId: "req-test-2" });
  assert.notEqual(other.candidates[0]?.id, first.candidates[0]?.id);
});

test("mock learning adapter: candidates are content-addressed (contentHash = sha-256 of canonical payload bytes)", () => {
  const output = orgMock.learn(request());
  assert.ok(output.candidates.length > 0, "candidates produced");
  for (const candidate of output.candidates) {
    assert.ok(/^[0-9a-f]{64}$/.test(candidate.contentHash), `${candidate.id}: contentHash is sha-256 hex`);
    const payload = output.payloads[candidate.id];
    assert.ok(payload, `${candidate.id}: payload sidecar present`);
    assert.ok(candidate.contentRef.startsWith("content-store://you-lab/learning/"), `${candidate.id}: contentRef addresses the content store`);
    // payload bytes hash to the candidate's contentHash (content-addressing law)
    assert.equal(sha256Hex(canonicalJson(payload)), candidate.contentHash, `${candidate.id}: hash binds the payload`);
    assert.match(candidate.id, /^you_learning-record_[0-9a-f]{16}$/, `${candidate.id}: you_learning-record_<16hex> id`);
  }
  // the seed-derived id function agrees with the adapter's ids
  const first = output.candidates[0]!;
  const payload = output.payloads[first.id]!;
  assert.equal(first.id, neutralLearningCandidateId(orgMock.profile.id, request().requestId, String(payload.evidenceRef)));
});

test("mock learning adapter: rights are threaded from the injected context, never minted", () => {
  const output = orgMock.learn(request());
  for (const candidate of output.candidates) {
    assert.deepEqual(candidate.rights, injectedRights(), `${candidate.id}: rights threaded verbatim`);
  }
  // a different injected grant threads through — the adapter has no grant of its own
  const otherGrant: NeutralLearningRights = {
    usage: ["pipeline-improvement"],
    consentRef: "you-lab-other-consent",
    consentHash: sha256Hex("you-lab-other-consent"),
    expiresAt: "2027-01-01T00:00:00Z",
  };
  const other = orgMock.learn({ ...request(), rights: otherGrant });
  for (const candidate of other.candidates) {
    assert.deepEqual(candidate.rights, otherGrant);
  }
});

test("mock learning adapter: typed refusal for unsupported signal kinds and scopes", () => {
  const unsupportedKind = { ...request(), signal: { ...request().signal, kind: "capability-gap" as const } };
  assert.throws(() => orgMock.learn(unsupportedKind), (error: unknown) => {
    assert.ok(error instanceof UnsupportedLearningSignalError);
    assert.equal(error.code, LEARNING_UNSUPPORTED_CODE);
    assert.ok(error.message.includes("signal kind 'capability-gap'"));
    return true;
  });
  const unsupportedScope = { ...request(), scope: "TWIN" };
  assert.throws(() => orgMock.learn(unsupportedScope), /does not support scope 'TWIN'/);
  assert.throws(() => assertLearningRequestSupported(orgMock.profile, unsupportedScope), /YOU_LEARNING_SIGNAL_INVALID/);
});

test("mock learning adapter: degradation is seed-derived and graded across the knobs", () => {
  const precise = createMockLearningAdapter({
    id: "mock-learning-precise-test",
    learnerClass: "rule-induction",
    supportedSignalKinds: ["manual-takeover"],
    supportedScopes: ["USER"],
    evidenceIngestRate: 1,
    valueDrift: 0,
    preservesDomains: true,
  });
  const lossy = createMockLearningAdapter({
    id: "mock-learning-lossy-test",
    learnerClass: "workflow-mining",
    supportedSignalKinds: ["manual-takeover"],
    supportedScopes: ["USER"],
    evidenceIngestRate: 0.25,
    valueDrift: 0.2,
    preservesDomains: false,
  });
  const preciseParts = scoreLearningFidelity(request(), precise.learn(request()));
  assert.equal(preciseParts.signalCoverage, 1);
  assert.equal(preciseParts.preferenceFaithfulness, 1);
  assert.equal(preciseParts.recordIntegrity, 1);
  assert.equal(preciseParts.fidelityScore, 1, "the exact-recovery mock scores 1");
  const lossyOutput = lossy.learn(request());
  const lossyParts = scoreLearningFidelity(request(), lossyOutput);
  assert.ok(lossyParts.signalCoverage < 1, "seeded ingestion dropout lowers signal coverage");
  assert.ok(lossyParts.fidelityScore < preciseParts.fidelityScore, "degradation is graded");
  for (const candidate of lossyOutput.candidates) {
    const payload = lossyOutput.payloads[candidate.id]!;
    assert.equal(payload.key, "organization-baseline", "domain folding collapses the learning keys");
  }
  assert.ok(lossyOutput.warnings.includes("learning key domains folded into a single organization baseline (over-generalization)"));
});

test("mock learning adapter: honest simulated markers and warnings", () => {
  const output = orgMock.learn(request());
  assert.equal(output.simulated, true);
  assert.equal(output.effort.effort.kind, "not-measured");
  assert.equal(output.effort.latency.kind === "not-measured" ? output.effort.latency.marker : "", "not-measured (simulated)");
  assert.equal(output.effort.cost.kind, "not-measured");
  assert.equal(orgMock.profile.technologyId, null, "pure mock carries no registry backing");
  assert.equal(orgMock.profile.productionEligible, null, "pure mock makes no eligibility claim");
  assert.equal(orgMock.profile.adapterKind, "mock");
  assert.ok(output.warnings.length > 0, "coverage loss is warned about");
  assert.deepEqual(output.warnings, [...new Set(output.warnings)].sort(), "warnings are sorted and unique");
});

test("mock learning adapter: empty evidence yields no candidates with a valid digest", () => {
  const emptySignal = { ...request(), signal: { ...request().signal, evidenceRefs: [] } };
  const output = orgMock.learn(emptySignal);
  assert.equal(output.candidates.length, 0);
  assert.equal(output.payloads && Object.keys(output.payloads).length, 0);
  assert.equal(output.learnedContentHash, sha256Hex("[]"));
  assert.equal(output.simulated, true);
});

test("mock learning adapter: standard candidate set covers the order's three learner-class groups", () => {
  const candidates = createStandardLearningCandidates(registry);
  assert.equal(candidates.length, 7);
  const classes = new Set(candidates.map((candidate) => candidate.profile.learnerClass));
  // organization-improvement methods
  assert.ok(classes.has("rule-induction") && classes.has("preference-learning") && classes.has("bandit-selection"));
  // tool/editor-selection learners
  assert.ok(classes.has("contextual-ranking"));
  // pipeline-improvement methods
  assert.ok(classes.has("program-synthesis") && classes.has("workflow-mining"));
  for (const candidate of candidates) {
    assert.equal(candidate.profile.deterministic, true, `${candidate.profile.id}: deterministic profile`);
  }
  // every degraded mock keeps candidate hashes consistent with its payloads
  const degraded = candidates.filter((candidate) => candidate.profile.id === "mock-learning-org-coarse")[0]!;
  const degradedOutput = degraded.learn(request());
  for (const candidate of degradedOutput.candidates) {
    assert.equal(
      sha256Hex(canonicalJson(degradedOutput.payloads[candidate.id]!)),
      candidate.contentHash,
      `${candidate.id}: degraded mock keeps every record hash-consistent with its payload`,
    );
  }
  assert.equal(MOCK_LEARNING_CANDIDATES.length, 6, "six pure mocks + one evaluation adapter");
});

test("mock learning adapter: the vw evaluation adapter stays deterministic, simulated, and honest about scope", () => {
  const adapter = createVowpalWabbitLearningEvaluationAdapter(registry);
  const first = adapter.learn(request());
  const second = adapter.learn(request());
  assert.equal(canonicalJson(second), canonicalJson(first));
  assert.equal(first.simulated, true);
  assert.equal(first.warnings.length, 0);
  assert.equal(first.effort.effort.kind, "not-measured");
  assert.equal(adapter.profile.adapterKind, "evaluation");
});
