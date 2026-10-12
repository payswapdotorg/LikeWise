// Contract seam v6 tests (W6C) — coverage: adapter outputs construct VALID
// frozen v6 shapes through the single seam module (LearningSignal /
// LearningRecord / LearningRights), the learning scope/signal-kind/usage
// mappings are 1:1 at the seam, content-addressing laws hold, rights are
// threaded from the injected context (adapters never mint consent), and
// learned content is never inlined in records.
import assert from "node:assert/strict";
import test from "node:test";
import {
  learningThroughAdapter,
  mapLearningRightUsage,
  mapLearningScope,
  mapLearningSignalKind,
  toFrozenLearningRecord,
  toFrozenLearningRights,
  toFrozenLearningSignal,
} from "../contractSeam.js";
import { createLearningRegistry } from "../technology/learningSeedProfiles.js";
import { createVowpalWabbitLearningEvaluationAdapter, VOWPAL_WABBIT_EVALUATION_ADAPTER_ID } from "./vowpalWabbitEvaluationAdapter.js";
import { LEARNING_BENCH_SUBMITTED_AT, runStandardLearningBenchmark } from "./learningRunner.js";
import { createStandardLearningCandidates } from "./learningCandidates.js";
import { fixtureInvocationSignal, LEARNING_BENCHMARK_FIXTURES } from "./learningFixtures.js";
import { sha256Hex, type NeutralLearningRequest, type NeutralLearningRights } from "./learningAdapterSeam.js";

const registry = createLearningRegistry();

function injectedRights(): NeutralLearningRights {
  return {
    usage: ["organization-improvement", "tool-selection"],
    consentRef: "you-lab-seam-test-consent",
    consentHash: sha256Hex("you-lab-seam-test-consent"),
    expiresAt: null,
  };
}

function seamRequest(): NeutralLearningRequest {
  const fixture = LEARNING_BENCHMARK_FIXTURES[0]!;
  const signal = fixtureInvocationSignal(fixture);
  return {
    requestId: "seam-req-1",
    signal,
    scope: signal.scope,
    rights: injectedRights(),
    submittedAt: LEARNING_BENCH_SUBMITTED_AT,
  };
}

test("contract seam v6: learning scope / signal-kind / usage-class mappings are 1:1 and validated", () => {
  for (const scope of ["GLOBAL", "TENANT", "APPLICATION", "PROJECT", "USER", "TWIN", "ASSET", "TASK"]) {
    assert.equal(mapLearningScope(scope), scope);
  }
  for (const kind of ["feedback", "manual-takeover", "edit-session", "expert-intervention", "repeated-intent", "capability-gap"]) {
    assert.equal(mapLearningSignalKind(kind), kind);
  }
  for (const usage of ["organization-improvement", "tool-selection", "editor-selection", "pipeline-improvement", "capability-gap-analysis", "personalization"]) {
    assert.equal(mapLearningRightUsage(usage), usage);
  }
  assert.throws(() => mapLearningScope("ORG" as never), /no frozen v6 mapping/);
  assert.throws(() => mapLearningScope(""), /empty scope/);
  assert.throws(() => mapLearningSignalKind("telepathy" as never), /no frozen v6 mapping/);
  assert.throws(() => mapLearningRightUsage("mind-reading" as never), /no frozen v6 mapping/);
});

test("contract seam v6: toFrozenLearningSignal produces a valid frozen LearningSignal", () => {
  const signal = toFrozenLearningSignal({
    id: "sig-seam-1",
    kind: "manual-takeover",
    scope: "USER",
    subjectRef: "art-1",
    evidenceRefs: ["you_content_0123456789abcdef", "you_content-fedcba9876543210"],
    capturedAt: "2026-10-12T09:00:00Z",
  });
  assert.equal(signal.id, "sig-seam-1");
  assert.equal(signal.kind, "manual-takeover");
  assert.equal(signal.scope, "USER");
  assert.equal(signal.subjectRef, "art-1");
  assert.deepEqual(signal.evidenceRefs, ["you_content_0123456789abcdef", "you_content-fedcba9876543210"]);
  assert.equal(signal.capturedAt, "2026-10-12T09:00:00Z");
  assert.equal(signal.simulated, true, "truth law: fixture learning stays labeled");
  // evidence laws: non-empty, no duplicates, no whitespace padding
  assert.throws(() => toFrozenLearningSignal({ id: "s", kind: "feedback", scope: "USER", subjectRef: null, evidenceRefs: [], capturedAt: "t" }), /empty evidenceRefs/);
  assert.throws(
    () => toFrozenLearningSignal({ id: "s", kind: "feedback", scope: "USER", subjectRef: null, evidenceRefs: ["a", "a"], capturedAt: "t" }),
    /duplicate evidence ref/,
  );
  assert.throws(
    () => toFrozenLearningSignal({ id: "s", kind: "feedback", scope: "USER", subjectRef: null, evidenceRefs: [" a"], capturedAt: "t" }),
    /no surrounding whitespace/,
  );
  assert.throws(() => toFrozenLearningSignal({ id: "", kind: "feedback", scope: "USER", subjectRef: null, evidenceRefs: ["a"], capturedAt: "t" }), /empty id/);
});

test("contract seam v6: toFrozenLearningRights threads the injected grant and refuses unpaired consent", () => {
  const rights = toFrozenLearningRights(injectedRights());
  assert.deepEqual(rights.usage, ["organization-improvement", "tool-selection"]);
  assert.equal(rights.consentRef, "you-lab-seam-test-consent");
  assert.equal(rights.consentHash, sha256Hex("you-lab-seam-test-consent"));
  assert.equal(rights.expiresAt, null);
  // inert grant (records without rights are inert — both empty)
  const inert = toFrozenLearningRights({ usage: [], consentRef: "", consentHash: "", expiresAt: null });
  assert.deepEqual(inert.usage, []);
  // half-bound grants never exist at the wave-2 consent authority
  assert.throws(
    () => toFrozenLearningRights({ usage: ["personalization"], consentRef: "ref", consentHash: "", expiresAt: null }),
    /unpaired consent binding/,
  );
  assert.throws(
    () => toFrozenLearningRights({ usage: [], consentRef: "ref", consentHash: "hash", expiresAt: null }),
    /without usage classes/,
  );
});

test("contract seam v6: toFrozenLearningRecord builds candidate records (sha-256 law, status candidate)", () => {
  const record = toFrozenLearningRecord({
    recordId: "you_learning-record_0123456789abcdef",
    signalId: "sig-seam-1",
    scope: "USER",
    contentRef: "content-store://you-lab/learning/x/y/candidate-0",
    contentHash: "a".repeat(64),
    rights: injectedRights(),
    validatedAt: "2026-10-12T12:00:00Z",
  });
  assert.equal(record.status, "candidate", "adapter outputs are candidates — the ladder belongs to the service");
  assert.equal(record.supersededById, null, "supersession linkage is service-owned");
  assert.equal(record.simulated, true);
  assert.equal(record.scope, "USER");
  assert.deepEqual(Object.keys(record).sort(), [
    "contentHash",
    "contentRef",
    "id",
    "rights",
    "scope",
    "signalId",
    "simulated",
    "status",
    "supersededById",
    "validatedAt",
  ]);
  assert.throws(
    () => toFrozenLearningRecord({ recordId: "r", signalId: "s", scope: "USER", contentRef: "c", contentHash: "short", rights: injectedRights(), validatedAt: "t" }),
    /not sha-256 hex/,
  );
  assert.throws(
    () => toFrozenLearningRecord({ recordId: "", signalId: "s", scope: "USER", contentRef: "c", contentHash: "a".repeat(64), rights: injectedRights(), validatedAt: "t" }),
    /empty recordId/,
  );
});

test("contract seam v6: learningThroughAdapter constructs the full frozen v6 path from a learning adapter", () => {
  const adapter = createVowpalWabbitLearningEvaluationAdapter(registry);
  const request = seamRequest();
  const completion = { capturedAt: "2026-10-12T09:00:00Z", validatedAt: "2026-10-12T12:05:00Z" };
  const { signal, records, output } = learningThroughAdapter(adapter, request, completion);
  assert.equal(signal.id, request.signal.id);
  assert.equal(signal.kind, "manual-takeover");
  assert.equal(signal.capturedAt, "2026-10-12T09:00:00Z", "service-owned capture timing (injected clock)");
  assert.equal(records.length, output.candidates.length);
  assert.ok(records.length > 0, "candidates produced");
  for (const record of records) {
    assert.equal(record.signalId, signal.id);
    assert.equal(record.scope, signal.scope, "v6 law: learning records inherit the signal scope");
    assert.equal(record.status, "candidate");
    assert.equal(record.simulated, true);
    assert.ok(/^[0-9a-f]{64}$/.test(record.contentHash), "contentHash is sha-256 hex");
    assert.ok(record.contentRef.startsWith("content-store://you-lab/learning/"), "content refs address the you-lab learning store");
    assert.equal(record.rights.consentRef, request.rights.consentRef, "rights threaded from the injected context");
    assert.deepEqual(record.rights.usage, [...request.rights.usage]);
    // learned content is never inlined — records carry contentRef + contentHash only
    const payload = output.payloads[record.id];
    assert.ok(payload, "payload rides the sidecar keyed by record id");
    assert.equal(record.contentHash, sha256Hex(JSON.stringify(sortKeys(payload))), "contentHash binds the payload bytes");
  }
  // deterministic replay: the full path is byte-stable
  const replay = learningThroughAdapter(adapter, seamRequest(), completion);
  assert.deepEqual(replay.signal, signal);
  assert.deepEqual(replay.records, records);
  assert.deepEqual(replay.output, output);
});

test("contract seam v6: learningThroughAdapter refuses adapter-minted rights (rights law)", () => {
  const rogue = createVowpalWabbitLearningEvaluationAdapter(registry);
  const request = seamRequest();
  const minted = rogue.learn(request);
  const minter = {
    profile: rogue.profile,
    learn() {
      const first = minted.candidates[0]!;
      return {
        ...minted,
        candidates: minted.candidates.map((candidate) =>
          candidate === first
            ? { ...candidate, rights: { ...candidate.rights, consentRef: "adapter-minted-consent" } }
            : candidate,
        ),
      };
    },
  };
  assert.throws(
    () => learningThroughAdapter(minter, request, { capturedAt: "t1", validatedAt: "t2" }),
    /adapters never mint consent/,
  );
});

test("contract seam v6: adapter candidate records carry the you_learning id format and no inlined content", () => {
  const adapter = createVowpalWabbitLearningEvaluationAdapter(registry);
  const output = adapter.learn(seamRequest());
  assert.ok(output.candidates.length > 0);
  for (const candidate of output.candidates) {
    assert.match(candidate.id, /^you_learning-record_[0-9a-f]{16}$/, "you_learning-record_<16hex> id format");
    assert.equal(candidate.status, "candidate");
    assert.equal(candidate.supersededById, null);
    assert.equal(candidate.simulated, true);
    assert.deepEqual(Object.keys(candidate).sort(), [
      "contentHash",
      "contentRef",
      "id",
      "rights",
      "scope",
      "signalId",
      "simulated",
      "status",
      "supersededById",
      "validatedAt",
    ], "learned content is never inlined in the record");
  }
});

// local canonical-JSON key sort (test-side check of the payload binding)
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry !== undefined) out[key] = sortKeys(entry);
    }
    return out;
  }
  return value;
}

test("contract seam v6: the evaluation candidate derives eligibility and scores through the standard benchmark", () => {
  const report = runStandardLearningBenchmark(createStandardLearningCandidates(registry));
  const evaluation = report.candidateResults.find((entry) => entry.candidateId === VOWPAL_WABBIT_EVALUATION_ADAPTER_ID);
  assert.ok(evaluation);
  assert.equal(evaluation.adapterKind, "evaluation");
  assert.equal(evaluation.productionEligible, true);
  assert.equal(evaluation.overallFidelityScore, 1, "the simulated exact-recovery learner scores 1");
});
