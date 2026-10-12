// Contract seam v7 tests (W7C) — coverage: adapter outputs construct VALID
// frozen v7 shapes through the single seam module (SoulBinding /
// AvatarSession / RealtimeChannelDescriptor), the routing-profile and
// embodiment-state mappings are 1:1 at the seam, content-addressing laws
// hold, response-record identity is threaded from the request (adapters
// never mint identity), and the session state is an honest projection.
import assert from "node:assert/strict";
import test from "node:test";
import {
  mapEmbodimentState,
  mapSoulRoutingProfile,
  soulThroughAdapter,
  toFrozenAvatarSession,
  toFrozenRealtimeChannelDescriptor,
  toFrozenSoulBinding,
  toSoulEffortObservations,
} from "../contractSeam.js";
import { createSoulRegistry } from "../technology/soulSeedProfiles.js";
import { createLlamaCppSoulEvaluationAdapter, LLAMA_CPP_EVALUATION_ADAPTER_ID } from "./llamaCppEvaluationAdapter.js";
import { SOUL_BENCH_SUBMITTED_AT, runStandardSoulBenchmark } from "./soulRunner.js";
import { createStandardSoulCandidates } from "./soulCandidates.js";
import { fixtureScenario, SOUL_BENCHMARK_FIXTURES } from "./soulFixtures.js";
import { sha256Hex, type NeutralSoulRequest } from "./soulAdapterSeam.js";
import { buildRealtimeChannel } from "../realtime/realtimeAdapterSeam.js";

const registry = createSoulRegistry();

function seamRequest(): NeutralSoulRequest {
  const scenario = fixtureScenario(SOUL_BENCHMARK_FIXTURES[1]!);
  return {
    requestId: "seam-req-1",
    binding: scenario.binding,
    prompt: scenario.prompt,
    submittedAt: SOUL_BENCH_SUBMITTED_AT,
  };
}

test("contract seam v7: routing-profile and embodiment-state mappings are 1:1 and validated", () => {
  for (const profile of ["system-one", "system-two"]) {
    assert.equal(mapSoulRoutingProfile(profile), profile);
  }
  for (const state of ["listening", "reading", "typing", "thinking", "tool_use", "speaking", "interrupted", "idle", "unavailable"]) {
    assert.equal(mapEmbodimentState(state), state);
  }
  assert.throws(() => mapSoulRoutingProfile("turbo" as never), /no frozen v7 mapping/);
  assert.throws(() => mapSoulRoutingProfile(""), /empty routing profile/);
  assert.throws(() => mapEmbodimentState("dreaming" as never), /no frozen v7 mapping/);
  assert.throws(() => mapEmbodimentState(""), /empty embodiment state/);
});

test("contract seam v7: toFrozenSoulBinding produces a valid frozen SoulBinding", () => {
  const binding = toFrozenSoulBinding({
    id: "you_soul-binding_0123456789abcdef",
    providerKind: "llama-cpp",
    modelRef: "gguf:fixture-model",
    routingProfile: "system-two",
    capabilities: ["text-generation", "routed-prompt"],
  });
  assert.equal(binding.id, "you_soul-binding_0123456789abcdef");
  assert.equal(binding.providerKind, "llama-cpp");
  assert.equal(binding.modelRef, "gguf:fixture-model");
  assert.equal(binding.routingProfile, "system-two");
  assert.deepEqual(binding.capabilities, ["text-generation", "routed-prompt"]);
  assert.deepEqual(Object.keys(binding).sort(), ["capabilities", "id", "modelRef", "providerKind", "routingProfile"]);
  // validation laws
  assert.throws(() => toFrozenSoulBinding({ id: "", providerKind: "p", modelRef: "m", routingProfile: "system-one", capabilities: [] }), /empty id/);
  assert.throws(() => toFrozenSoulBinding({ id: "b", providerKind: "", modelRef: "m", routingProfile: "system-one", capabilities: [] }), /empty providerKind/);
  assert.throws(() => toFrozenSoulBinding({ id: "b", providerKind: "p", modelRef: "", routingProfile: "system-one", capabilities: [] }), /empty modelRef/);
  assert.throws(() => toFrozenSoulBinding({ id: "b", providerKind: "p", modelRef: "m", routingProfile: "fast" as never, capabilities: [] }), /no frozen v7 mapping/);
  assert.throws(() => toFrozenSoulBinding({ id: "b", providerKind: "p", modelRef: "m", routingProfile: "system-one", capabilities: [""] }), /empty capability/);
});

test("contract seam v7: toFrozenAvatarSession produces a valid frozen AvatarSession", () => {
  const session = toFrozenAvatarSession({
    sessionId: "you_avatar-session_0123456789abcdef",
    bodyId: "you_body-fedcba9876543210",
    soulBindingId: "you_soul-binding_0123456789abcdef",
    status: "active",
    state: "typing",
    openedAt: "2026-10-12T09:00:00Z",
    closedAt: null,
  });
  assert.equal(session.status, "active");
  assert.equal(session.state, "typing");
  assert.equal(session.closedAt, null);
  assert.equal(session.simulated, true, "truth law: fixture avatar sessions stay labeled simulated");
  assert.deepEqual(Object.keys(session).sort(), [
    "bodyId",
    "closedAt",
    "id",
    "openedAt",
    "simulated",
    "soulBindingId",
    "state",
    "status",
  ]);
  // a closed session carries closedAt; an open session carries null
  const closed = toFrozenAvatarSession({
    sessionId: "s2",
    bodyId: "b2",
    soulBindingId: "sb2",
    status: "closed",
    state: "unavailable",
    openedAt: "2026-10-12T09:00:00Z",
    closedAt: "2026-10-12T11:00:00Z",
  });
  assert.equal(closed.status, "closed");
  assert.equal(closed.closedAt, "2026-10-12T11:00:00Z");
  assert.throws(
    () => toFrozenAvatarSession({ sessionId: "s3", bodyId: "b3", soulBindingId: "sb3", status: "closed", state: "idle", openedAt: "t", closedAt: null }),
    /non-empty closedAt/,
  );
  assert.throws(
    () => toFrozenAvatarSession({ sessionId: "s4", bodyId: "b4", soulBindingId: "sb4", status: "active", state: "idle", openedAt: "t", closedAt: "t2" }),
    /closedAt null/,
  );
  assert.throws(
    () => toFrozenAvatarSession({ sessionId: "s5", bodyId: "b5", soulBindingId: "sb5", status: "paused" as never, state: "idle", openedAt: "t", closedAt: null }),
    /unknown status/,
  );
  assert.throws(
    () => toFrozenAvatarSession({ sessionId: "s6", bodyId: "b6", soulBindingId: "sb6", status: "active", state: "sleeping" as never, openedAt: "t", closedAt: null }),
    /no frozen v7 mapping/,
  );
});

test("contract seam v7: toFrozenRealtimeChannelDescriptor maps the neutral channel 1:1 (sha-256 law)", () => {
  const channel = buildRealtimeChannel({
    channelId: "voice",
    avatarSessionId: "you_avatar-session_0123456789abcdef",
    kind: "audio",
    latencyClass: "realtime",
    transportId: "livekit",
  });
  const descriptor = toFrozenRealtimeChannelDescriptor(channel);
  assert.equal(descriptor.id, channel.id);
  assert.equal(descriptor.kind, "audio");
  assert.equal(descriptor.streamRef, channel.streamRef);
  assert.equal(descriptor.streamHash, channel.streamHash);
  assert.equal(descriptor.latencyClass, "realtime");
  assert.deepEqual(Object.keys(descriptor).sort(), ["id", "kind", "latencyClass", "streamHash", "streamRef"]);
  // stream refs are content-addressed, never inlined; the hash binds the manifest bytes
  assert.ok(descriptor.streamRef.startsWith("content-store://you-lab/realtime/"));
  assert.ok(/^[0-9a-f]{64}$/.test(descriptor.streamHash));
  // validation laws
  assert.throws(() => toFrozenRealtimeChannelDescriptor({ ...channel, streamHash: "short" }), /not sha-256 hex/);
  assert.throws(() => toFrozenRealtimeChannelDescriptor({ ...channel, streamRef: "" }), /empty streamRef/);
  assert.throws(() => toFrozenRealtimeChannelDescriptor({ ...channel, kind: "" }), /empty kind/);
  assert.throws(() => toFrozenRealtimeChannelDescriptor({ ...channel, latencyClass: "" }), /empty latencyClass/);
});

test("contract seam v7: soulThroughAdapter constructs the full frozen v7 path from a soul adapter", () => {
  const adapter = createLlamaCppSoulEvaluationAdapter(registry);
  const request = seamRequest();
  const session = { sessionId: "you_avatar-session_0123456789abcdef", bodyId: "you_body-fedcba9876543210", openedAt: "2026-10-12T09:00:00Z" };
  const { binding, avatarSession, records, output } = soulThroughAdapter(adapter, request, session);
  assert.equal(binding.id, request.binding.id);
  assert.equal(binding.routingProfile, request.prompt.routingProfile, "one Soul, one route per invocation");
  assert.equal(avatarSession.id, session.sessionId);
  assert.equal(avatarSession.bodyId, session.bodyId);
  assert.equal(avatarSession.soulBindingId, binding.id, "the session binds the Soul to the Body");
  assert.equal(avatarSession.status, "active");
  assert.equal(avatarSession.openedAt, "2026-10-12T09:00:00Z", "service-owned session timing (injected clock)");
  assert.equal(avatarSession.simulated, true, "truth law: fixture sessions stay simulated");
  assert.equal(records.length, output.records.length);
  assert.ok(records.length > 0, "response records produced");
  // the session state is the projected state of the last response record (projection, never authority)
  const lastRecord = records[records.length - 1]!;
  assert.equal(avatarSession.state, lastRecord.embodimentState);
  for (const record of records) {
    assert.equal(record.bindingId, request.binding.id, "identity law: records thread the request binding");
    assert.equal(record.requestId, request.requestId, "identity law: records thread the request identity");
    assert.ok(record.contentRef.startsWith("content-store://you-lab/soul/"), "content refs address the you-lab soul store");
    assert.ok(/^[0-9a-f]{64}$/.test(record.contentHash), "contentHash is sha-256 hex");
    // response content is never inlined — the payload rides the sidecar and the hash binds it
    const payload = output.payloads[record.id];
    assert.ok(payload, "payload rides the sidecar keyed by record id");
    assert.equal(record.contentHash, sha256Hex(JSON.stringify(sortKeys(payload))), "contentHash binds the payload bytes");
  }
  // deterministic replay: the full path is byte-stable
  const replay = soulThroughAdapter(adapter, seamRequest(), session);
  assert.deepEqual(replay.binding, binding);
  assert.deepEqual(replay.avatarSession, avatarSession);
  assert.deepEqual(replay.records, records);
  assert.deepEqual(replay.output, output);
});

test("contract seam v7: soulThroughAdapter refuses adapter-minted identity (identity law)", () => {
  const rogue = createLlamaCppSoulEvaluationAdapter(registry);
  const request = seamRequest();
  const minted = rogue.invoke(request);
  const minter = {
    profile: rogue.profile,
    invoke() {
      const first = minted.records[0]!;
      return {
        ...minted,
        records: minted.records.map((record) =>
          record === first
            ? { ...record, bindingId: "you_soul-binding_adapterminted" }
            : record,
        ),
      };
    },
  };
  assert.throws(
    () => soulThroughAdapter(minter, request, { sessionId: "s", bodyId: "b", openedAt: "t" }),
    /adapters never mint binding identity/,
  );
  const requestMinter = {
    profile: rogue.profile,
    invoke() {
      return { ...minted, records: minted.records.map((record) => ({ ...record, requestId: "adapter-minted-request" })) };
    },
  };
  assert.throws(
    () => soulThroughAdapter(requestMinter, request, { sessionId: "s", bodyId: "b", openedAt: "t" }),
    /adapters never mint request identity/,
  );
});

test("contract seam v7: adapter response records carry the you_soul id format and no inlined content", () => {
  const adapter = createLlamaCppSoulEvaluationAdapter(registry);
  const output = adapter.invoke(seamRequest());
  assert.ok(output.records.length > 0);
  for (const record of output.records) {
    assert.match(record.id, /^you_soul-response_[0-9a-f]{16}$/, "you_soul-response_<16hex> id format");
    assert.equal(record.simulated, true);
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
});

test("contract seam v7: honest effort observations for soul benchmark results", () => {
  const report = runStandardSoulBenchmark(createStandardSoulCandidates(registry));
  const evaluation = report.candidateResults.find((entry) => entry.candidateId === LLAMA_CPP_EVALUATION_ADAPTER_ID);
  assert.ok(evaluation);
  const observations = toSoulEffortObservations(evaluation);
  assert.equal(observations.fixtureCount, 3);
  assert.equal(observations.simulated, true);
  assert.equal(observations.soulEffort, "not-measured (simulated)");
  assert.equal(observations.latencyMs, "not-measured (simulated)");
  assert.equal(observations.costUnits, "not-measured (simulated)");
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
