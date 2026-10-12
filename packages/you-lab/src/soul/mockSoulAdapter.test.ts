// Deterministic mock soul adapter tests (W7C) — coverage: byte-identical
// replay from the seed, seeded degradation (context dropout, value drift,
// modality folding, visible misrouting), content-addressed record laws
// (hash binds the payload, you_soul id format, content-store refs), typed
// refusals for unsupported routes/modalities, and honest warnings.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { createSoulRegistry } from "../technology/soulSeedProfiles.js";
import {
  assertSoulRequestSupported,
  decodeResponseContent,
  encodeSoulPayload,
  intendedResponseTopicAt,
  intendedResponseValueAt,
  neutralSoulResponseId,
  projectedEmbodimentStateFor,
  sha256Hex,
  SOUL_RESPONSE_DOMAINS,
  SOUL_UNSUPPORTED_CODE,
  UnsupportedSoulRequestError,
  unsupportedSoulRequestAspects,
  type NeutralSoulRequest,
} from "./soulAdapterSeam.js";
import { createMockSoulAdapter, mockSoulGenerator, type MockSoulConfig } from "./mockSoulAdapter.js";
import { fixtureScenario, SOUL_BENCHMARK_FIXTURES } from "./soulFixtures.js";
import { SOUL_BENCH_SUBMITTED_AT } from "./soulRunner.js";
import { scoreSoulResponse } from "./soulScorer.js";

const registry = createSoulRegistry();
void registry;

function scenarioRequest(fixtureIndex: number, candidateId: string): NeutralSoulRequest {
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[fixtureIndex]!);
  return {
    requestId: `mock-${candidateId}`,
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  };
}

test("mock soul adapter: byte-identical replay from the seed (determinism)", () => {
  const configs: readonly MockSoulConfig[] = [
    {
      id: "mock-determinism-a",
      soulClass: "serving-stack",
      supportedModalities: ["text", "image"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "interactive",
      contextIngestRate: 0.8,
      responseDrift: 0.1,
      preservesModalities: false,
      honorsRoutingProfile: false,
    },
    {
      id: "mock-determinism-b",
      soulClass: "state-routing",
      supportedModalities: ["text", "image"],
      supportedRoutingProfiles: ["system-one", "system-two"],
      latencyClass: "turn-based",
      contextIngestRate: 1,
      responseDrift: 0,
      preservesModalities: true,
      honorsRoutingProfile: true,
    },
  ];
  for (const config of configs) {
    const adapter = createMockSoulAdapter(config);
    for (const fixtureIndex of [0, 1, 2]) {
      const request = scenarioRequest(fixtureIndex, config.id);
      const first = adapter.invoke(request);
      const second = adapter.invoke(request);
      assert.equal(canonicalJson(first), canonicalJson(second), `${config.id} @ fixture ${fixtureIndex}: byte-identical double invocation`);
    }
  }
  assert.equal(mockSoulGenerator(), "you-lab-mock-soul-adapter/1");
});

test("mock soul adapter: exact-recovery config produces perfect fidelity", () => {
  const adapter = createMockSoulAdapter({
    id: "mock-exact",
    soulClass: "serving-stack",
    supportedModalities: ["text", "image"],
    supportedRoutingProfiles: ["system-one", "system-two"],
    latencyClass: "interactive",
    contextIngestRate: 1,
    responseDrift: 0,
    preservesModalities: true,
    honorsRoutingProfile: true,
  });
  const request = scenarioRequest(1, "mock-exact");
  const output = adapter.invoke(request);
  const parts = scoreSoulResponse(request, output);
  assert.equal(parts.fidelityScore, 1);
  assert.equal(parts.contextCoverage, 1);
  assert.equal(parts.responseFaithfulness, 1);
  assert.equal(parts.recordIntegrity, 1);
  assert.deepEqual(output.warnings, []);
});

test("mock soul adapter: seeded degradation scores below perfect and warns honestly", () => {
  const degraded = createMockSoulAdapter({
    id: "mock-degraded",
    soulClass: "vlm-family",
    supportedModalities: ["text", "image"],
    supportedRoutingProfiles: ["system-one", "system-two"],
    latencyClass: "turn-based",
    contextIngestRate: 0.6,
    responseDrift: 0.2,
    preservesModalities: false,
    honorsRoutingProfile: false,
  });
  const request = scenarioRequest(2, "mock-degraded");
  const output = degraded.invoke(request);
  const parts = scoreSoulResponse(request, output);
  assert.ok(parts.fidelityScore < 1, "degraded config scores below perfect");
  assert.ok(parts.contextCoverage < 1, "seeded dropout loses context coverage");
  const warnings = output.warnings.join(" | ");
  assert.ok(warnings.includes("routing misroute"), "misroute warning");
  assert.ok(warnings.includes("modalities folded"), "modality-folding warning");
  assert.ok(/context ref\(s\) not addressed/.test(warnings), "coverage-loss warning");
  // the misroute stays visible: records carry the flipped route, payloads carry actual + requested
  const misrouted = output.records.filter((record) => record.routingProfile !== request.prompt.routingProfile);
  assert.equal(misrouted.length, output.records.length, "every record honestly carries the flipped route");
  for (const record of output.records) {
    const payload = output.payloads[record.id]!;
    assert.equal(payload.routingProfile, "system-one", "payload carries the ACTUAL route");
    assert.equal(payload.requestedRoutingProfile, request.prompt.routingProfile, "payload carries the REQUESTED route");
  }
});

test("mock soul adapter: response records are content-addressed and never inline content", () => {
  const adapter = createMockSoulAdapter({
    id: "mock-addressed",
    soulClass: "serving-stack",
    supportedModalities: ["text", "image"],
    supportedRoutingProfiles: ["system-one", "system-two"],
    latencyClass: "interactive",
    contextIngestRate: 1,
    responseDrift: 0,
    preservesModalities: true,
    honorsRoutingProfile: true,
  });
  const request = scenarioRequest(0, "mock-addressed");
  const output = adapter.invoke(request);
  assert.ok(output.records.length > 0);
  for (const record of output.records) {
    assert.match(record.id, /^you_soul-response_[0-9a-f]{16}$/, "you_soul-response_<16hex> id format");
    assert.ok(record.contentRef.startsWith("content-store://you-lab/soul/"), "content refs address the you-lab soul store");
    assert.ok(/^[0-9a-f]{64}$/.test(record.contentHash), "contentHash is sha-256 hex");
    const payload = output.payloads[record.id];
    assert.ok(payload, "payload rides the sidecar keyed by record id");
    assert.equal(record.contentHash, sha256Hex(canonicalJson(payload)), "contentHash binds the canonical payload bytes");
    assert.equal(record.simulated, true);
    assert.equal(record.bindingId, request.binding.id, "records thread the request binding identity");
    assert.equal(record.requestId, request.requestId, "records thread the request identity");
    assert.deepEqual(Object.keys(record).sort(), [
      "bindingId",
      "completedAt",
      "contentHash",
      "contentRef",
      "embodimentState",
      "id",
      "modality",
      "requestId",
      "routingProfile",
      "simulated",
    ], "response content is never inlined in the record");
  }
  // deterministic record ids are pure functions of (adapterId, requestId, contextRef)
  const firstRef = request.prompt.contextRefs[0]!;
  assert.equal(output.records[0]?.id, neutralSoulResponseId("mock-addressed", request.requestId, firstRef));
});

test("mock soul adapter: embodiment-state projection follows the authored modality table", () => {
  const adapter = createMockSoulAdapter({
    id: "mock-projection",
    soulClass: "serving-stack",
    supportedModalities: ["text", "image", "audio"],
    supportedRoutingProfiles: ["system-one", "system-two"],
    latencyClass: "interactive",
    contextIngestRate: 1,
    responseDrift: 0,
    preservesModalities: true,
    honorsRoutingProfile: true,
  });
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[1]!); // text+image modalities
  const output = adapter.invoke({
    requestId: "projection-1",
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  });
  for (const record of output.records) {
    assert.equal(record.embodimentState, projectedEmbodimentStateFor(record.modality), "projection is a pure function of the modality");
    if (record.modality === "text") assert.equal(record.embodimentState, "typing");
    if (record.modality === "image") assert.equal(record.embodimentState, "tool_use");
  }
  // the authored table covers the frozen nine-state ladder vocabulary
  assert.equal(projectedEmbodimentStateFor("audio"), "speaking");
  assert.equal(projectedEmbodimentStateFor("video"), "speaking");
  assert.equal(projectedEmbodimentStateFor("data"), "tool_use");
});

test("mock soul adapter: typed refusals for unsupported routes and modalities", () => {
  const adapter = createMockSoulAdapter({
    id: "mock-strict",
    soulClass: "inference-runtime",
    supportedModalities: ["text"],
    supportedRoutingProfiles: ["system-two"],
    latencyClass: "turn-based",
    contextIngestRate: 1,
    responseDrift: 0,
    preservesModalities: true,
    honorsRoutingProfile: true,
  });
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[2]!); // system-two route
  const base = {
    requestId: "refusal-1",
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  };
  // the base scenario is supported (system-two + text/image requested, but the adapter supports only text)
  assert.throws(() => adapter.invoke(base), new RegExp(`${SOUL_UNSUPPORTED_CODE}.*modality 'image'`));
  // unsupported route
  const systemOne = fixtureScenario(SOUL_BENCHMARK_FIXTURES[0]!); // system-one route
  assert.throws(
    () =>
      adapter.invoke({
        requestId: "refusal-2",
        binding: systemOne.binding,
        prompt: systemOne.prompt,
        submittedAt: SOUL_BENCH_SUBMITTED_AT,
      }),
    new RegExp(`${SOUL_UNSUPPORTED_CODE}.*routing profile 'system-one'`),
  );
  // binding/prompt route divergence (one Soul, one route per invocation)
  const diverged = {
    ...base,
    binding: { ...base.binding, routingProfile: "system-two" as const },
    prompt: { ...base.prompt, routingProfile: "system-one" as const },
  };
  const aspects = unsupportedSoulRequestAspects(adapter.profile, diverged);
  assert.ok(aspects.some((aspect) => aspect.includes("divergence")));
  assert.throws(() => assertSoulRequestSupported(adapter.profile, diverged), UnsupportedSoulRequestError);
  // the error is a typed refusal with the frozen v7 error code and the supported surface
  try {
    adapter.invoke(base);
    assert.fail("unreachable");
  } catch (error) {
    assert.ok(error instanceof UnsupportedSoulRequestError);
    assert.equal(error.code, SOUL_UNSUPPORTED_CODE);
    assert.ok(error.message.includes("modality:text"), "supported modalities listed");
    assert.ok(error.message.includes("route:system-two"), "supported routes listed");
  }
});

test("mock soul adapter: the synthetic response model is route-dependent (system-one vs system-two values)", () => {
  // the fixture model derives different canonical values per route — the
  // honest basis for the misrouting penalty (computed fixture arithmetic,
  // never a claim about real providers)
  for (const contextRef of ["you_content_0123456789abcdef", "you_content_fedcba9876543210", "you_content_0011223344556677"]) {
    const quick = intendedResponseValueAt(contextRef, "system-one");
    const deep = intendedResponseValueAt(contextRef, "system-two");
    assert.ok(quick >= 0.5 && quick <= 0.8, `system-one value in [0.5, 0.8]: ${quick}`);
    assert.ok(deep >= 0.7 && deep <= 1.0, `system-two value in [0.7, 1.0]: ${deep}`);
  }
  // topic domains cycle deterministically
  assert.equal(intendedResponseTopicAt(0), SOUL_RESPONSE_DOMAINS[0]);
  assert.equal(intendedResponseTopicAt(SOUL_RESPONSE_DOMAINS.length), SOUL_RESPONSE_DOMAINS[0]);
  // payload encode/decode round-trips
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[0]!);
  const request = {
    requestId: "roundtrip-1",
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  };
  const entry = { topic: "answer", value: 0.75, contextRef: request.prompt.contextRefs[0]!, modality: "text" as const };
  const payload = encodeSoulPayload(entry, request, "system-one");
  assert.deepEqual(decodeResponseContent(payload), entry);
});
