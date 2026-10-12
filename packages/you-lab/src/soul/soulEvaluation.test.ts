// Soul candidate evaluation tests (W7C) — coverage: registry-derived
// candidate profiles with honest licensing/determinism/effort fields,
// production eligibility derived (never hand-asserted), deterministic
// ranking with the llama-cpp pick, and the fail-closed evaluation adapter
// with honest simulated markers.
import assert from "node:assert/strict";
import test from "node:test";
import { createSoulRegistry, SOUL_SEED_PROFILES } from "../technology/soulSeedProfiles.js";
import { REALTIME_SEED_PROFILES } from "../technology/realtimeSeedProfiles.js";
import { createRegistry } from "../technology/registry.js";
import { SEED_PROFILES } from "../technology/seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "../technology/editorSeedProfiles.js";
import { LEARNING_SEED_PROFILES } from "../technology/learningSeedProfiles.js";
import {
  SOUL_EVALUATION_LATENCY_CLASSES,
  SOUL_EVALUATION_MODALITIES,
  SOUL_EVALUATION_ROUTING_PROFILES,
  SOUL_RESEARCH_DATE,
  assessSoulProductionEligibility,
  deriveSoulCandidateProfiles,
  rankSoulProductionEligible,
  soulCandidateIdsForClass,
} from "./soulEvaluation.js";
import {
  createLlamaCppSoulEvaluationAdapter,
  LLAMA_CPP_EVALUATION_ADAPTER_ID,
  llamaCppEvaluationGenerator,
} from "./llamaCppEvaluationAdapter.js";
import { SOUL_BENCH_SUBMITTED_AT } from "./soulRunner.js";
import { fixtureScenario, SOUL_BENCHMARK_FIXTURES } from "./soulFixtures.js";

const registry = createSoulRegistry();
const candidates = deriveSoulCandidateProfiles(registry);

test("soul evaluation: candidate criteria cite verified registry license facts", () => {
  assert.equal(candidates.length, 15);
  for (const candidate of candidates) {
    const technology = registry.byId(candidate.technologyId);
    assert.ok(technology, `${candidate.technologyId}: registry-backed`);
    assert.equal(candidate.evaluation.licensing.spdxId, technology.license.spdxId);
    assert.equal(candidate.evaluation.licensing.sourceUrl, technology.license.sourceUrl);
    assert.equal(candidate.evaluation.licensing.sourceUrl.startsWith("https://"), true);
  }
});

test("soul evaluation: effort/latency/cost carry honest not-measured markers", () => {
  for (const candidate of candidates) {
    for (const field of [candidate.evaluation.effort, candidate.evaluation.latency, candidate.evaluation.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.marker, "not-measured (simulated)");
    }
    assert.equal(candidate.evaluation.determinism.assessmentBasis, "engineering-assessment");
    assert.equal(candidate.evaluation.determinism.deterministic, false, "the real providers/routers/transports are not bit-deterministic");
    assert.ok(candidate.derivedFrom.startsWith("you-lab soul-candidate table/"));
  }
});

test("soul evaluation: permissive SPDX set drives production friendliness", () => {
  const byId = new Map(candidates.map((candidate) => [candidate.technologyId, candidate]));
  assert.equal(byId.get("vllm")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("text-generation-inference")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("llama-cpp")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("ollama")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("qwen3-vl")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("routellm")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("eagle")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("medusa")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("livekit")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("pion-webrtc")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("aiortc")?.evaluation.licensing.productionFriendly, true);
  // the deliberate not-production-friendly branches
  assert.equal(byId.get("llama-3")?.evaluation.licensing.productionFriendly, false, "custom community license (llama-3) blocked");
  assert.equal(byId.get("janus-gateway")?.evaluation.licensing.productionFriendly, false, "GPL-3.0 (janus) blocked");
  assert.equal(byId.get("mediasoup")?.evaluation.licensing.productionFriendly, false, "ISC (mediasoup) outside the authored permissive set — blocked pending TL review");
  assert.equal(byId.get("whip")?.evaluation.licensing.productionFriendly, false, "IETF TLP document copyright (whip) carries no software SPDX id");
});

test("soul evaluation: production eligibility is derived from license + maintenance recency", () => {
  const assessments = assessSoulProductionEligibility(candidates, registry);
  const byId = new Map(assessments.map((assessment) => [assessment.technologyId, assessment]));
  // exact ages from the research log (2026-10-12; never invented)
  const expectedAges: readonly [string, number][] = [
    ["llama-cpp", 1],
    ["ollama", 1],
    ["vllm", 3],
    ["mediasoup", 4],
    ["livekit", 5],
    ["pion-webrtc", 5],
    ["aiortc", 91],
    ["text-generation-inference", 205],
    ["eagle", 234],
    ["qwen3-vl", 255],
    ["llama-3", 367],
    ["routellm", 793],
    ["medusa", 907],
    ["whip", 590],
  ];
  for (const [id, ageDays] of expectedAges) {
    assert.equal(byId.get(id)?.maintenanceAgeDays, ageDays, `${id}: exact maintenance age`);
  }
  // eligible: permissive license + fresh maintenance
  for (const id of ["llama-cpp", "ollama", "vllm", "livekit", "pion-webrtc", "aiortc", "text-generation-inference", "qwen3-vl", "eagle"]) {
    const assessment = byId.get(id);
    assert.ok(assessment, `${id} assessed`);
    assert.equal(assessment.eligible, true, `${id} eligible`);
    assert.ok(assessment.basis.includes("W8+ compute-plane work"), `${id}: honest W8+ deferral in the basis`);
  }
  // license-blocked branches
  for (const id of ["llama-3", "janus-gateway", "mediasoup", "whip"]) {
    const assessment = byId.get(id);
    assert.ok(assessment, `${id} assessed`);
    assert.equal(assessment.eligible, false, `${id} blocked on license`);
    assert.ok(assessment.basis.includes("not in the permissive SPDX set"), `${id}: license basis cited`);
  }
  // maintenance-gate failures (permissive licenses, stale signals)
  for (const id of ["routellm", "medusa"]) {
    const assessment = byId.get(id);
    assert.ok(assessment, `${id} assessed`);
    assert.equal(assessment.eligible, false, `${id} maintenance gate failed`);
    assert.ok(assessment.basis.includes("maintenance gate failed"), `${id}: maintenance basis cited`);
  }
  // llama-3 fails BOTH gates (custom license + 367-day-old signal) — the license reason is primary
  assert.ok(byId.get("llama-3")?.basis.includes("not in the permissive SPDX set"));
});

test("soul evaluation: maintenance gate fails when signals age out (deterministic)", () => {
  const stale = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES, ...LEARNING_SEED_PROFILES, ...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES].map((profile) =>
      profile.id === "llama-cpp"
        ? {
            ...profile,
            maintenance: [
              { ...profile.maintenance[0]!, date: "2020-01-01" },
            ],
          }
        : profile,
    ),
  );
  const staleCandidates = deriveSoulCandidateProfiles(stale);
  const assessments = assessSoulProductionEligibility(staleCandidates, stale, { maxMaintenanceAgeDays: 365 });
  const llamaCpp = assessments.find((assessment) => assessment.technologyId === "llama-cpp");
  assert.ok(llamaCpp);
  assert.equal(llamaCpp.eligible, false);
  assert.ok(llamaCpp.basis.includes("maintenance gate failed"));
});

test("soul evaluation: ranking is deterministic — llama-cpp is the top binding-capable eligible pick", () => {
  const ranked = rankSoulProductionEligible(assessSoulProductionEligibility(candidates, registry));
  // llama-cpp and ollama tie on freshest maintenance (1 day); routing
  // coverage ties (both profiles); the id tiebreak is deterministic
  assert.equal(ranked[0]?.technologyId, "llama-cpp");
  assert.equal(ranked[1]?.technologyId, "ollama");
  // deterministic replay
  const reranked = rankSoulProductionEligible(assessSoulProductionEligibility(candidates, registry));
  assert.deepEqual(reranked, ranked);
  // eligible candidates rank before ineligible ones
  const firstIneligible = ranked.findIndex((assessment) => !assessment.eligible);
  assert.ok(firstIneligible > 0);
  for (const assessment of ranked.slice(0, firstIneligible)) {
    assert.equal(assessment.eligible, true);
  }
  // the top pick is binding-capable (an inference runtime that can back a SoulBinding)
  const top = candidates.find((profile) => profile.technologyId === ranked[0]?.technologyId);
  assert.equal(top?.bindingCapable, true);
});

test("soul evaluation: class shortlists cover the W7C classes", () => {
  assert.deepEqual(soulCandidateIdsForClass(candidates, "serving-stack"), ["text-generation-inference", "vllm"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "inference-runtime"), ["llama-cpp", "ollama"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "vlm-family"), ["llama-3", "qwen3-vl"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "state-routing"), ["routellm"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "speculative-decode"), ["eagle", "medusa"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "sfu-server"), ["janus-gateway", "livekit", "mediasoup"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "webrtc-transport"), ["aiortc", "pion-webrtc"]);
  assert.deepEqual(soulCandidateIdsForClass(candidates, "streaming-protocol"), ["whip"]);
  assert.equal(SOUL_RESEARCH_DATE, "2026-10-12");
  assert.equal(SOUL_EVALUATION_MODALITIES.length, 5, "the authored modality vocabulary in the coverage matrix");
  assert.equal(SOUL_EVALUATION_ROUTING_PROFILES.length, 2, "both frozen v7 routing profiles in the coverage matrix");
  assert.equal(SOUL_EVALUATION_LATENCY_CLASSES.length, 3, "the authored latency vocabulary in the coverage matrix");
});

test("soul evaluation: the llama-cpp evaluation adapter fails closed when eligibility shifts", () => {
  const adapter = createLlamaCppSoulEvaluationAdapter(registry);
  assert.equal(adapter.profile.id, LLAMA_CPP_EVALUATION_ADAPTER_ID);
  assert.equal(adapter.profile.productionEligible, true);
  assert.equal(adapter.profile.adapterKind, "evaluation");
  assert.equal(adapter.profile.technologyId, "llama-cpp");
  assert.equal(adapter.profile.soulClass, "inference-runtime");
  assert.ok(adapter.facts.eligibilityBasis.includes("MIT"));
  assert.equal(adapter.facts.maintenanceAgeDays, 1);
  assert.ok(llamaCppEvaluationGenerator().includes("real llama.cpp not executed"), "honest generator label");
  // fail-closed: a registry where llama-cpp's license is non-permissive refuses construction
  const relicensed = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES, ...LEARNING_SEED_PROFILES, ...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES].map((profile) =>
      profile.id === "llama-cpp"
        ? { ...profile, license: { ...profile.license, spdxId: "GPL-3.0-only", name: "GNU GPL v3 (fixture relicensing)" } }
        : profile,
    ),
  );
  assert.throws(() => createLlamaCppSoulEvaluationAdapter(relicensed), /top production-eligible binding-capable/i);
  // fail-closed: a registry without the technology at all refuses construction
  const removed = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES, ...LEARNING_SEED_PROFILES, ...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES].filter((profile) => profile.id !== "llama-cpp"),
  );
  assert.throws(() => createLlamaCppSoulEvaluationAdapter(removed), /missing from the registry/);
});

test("soul evaluation: the evaluation adapter carries honest simulated markers on every output", () => {
  const adapter = createLlamaCppSoulEvaluationAdapter(registry);
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[0]!);
  const output = adapter.invoke({
    requestId: "eval-honesty-1",
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  });
  assert.equal(output.simulated, true, "truth law: simulated execution, the real runtime never ran");
  assert.equal(output.effort.effort.kind, "not-measured");
  assert.equal(output.effort.latency.kind === "not-measured" ? output.effort.latency.marker : "", "not-measured (simulated)");
  assert.equal(output.effort.cost.kind, "not-measured");
  assert.ok(adapter.profile.determinismNote.includes("not bit-stable"), "honest determinism note about the real runtime");
});

test("soul evaluation: the adapter profile derives from registry capability facts", () => {
  const adapter = createLlamaCppSoulEvaluationAdapter(registry);
  // supported modalities/routes come from the capability derivation (text+image, both routes)
  assert.deepEqual([...adapter.profile.supportedModalities].sort(), ["image", "text"]);
  assert.deepEqual([...adapter.profile.supportedRoutingProfiles].sort(), ["system-one", "system-two"]);
  // an audio request is refused (llama.cpp carries no audio modality in the authored capability table)
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[0]!);
  assert.throws(
    () =>
      adapter.invoke({
        requestId: "eval-refusal-1",
        binding: scenario.binding,
        prompt: { ...scenario.prompt, requestedModalities: ["audio"] },
        submittedAt: SOUL_BENCH_SUBMITTED_AT,
      }),
    /YOU_SOUL_BINDING_INVALID.*modality 'audio'/,
  );
});
