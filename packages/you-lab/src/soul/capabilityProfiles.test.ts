// Soul capability profile tests (W7C) — coverage: the provider/routing/
// realtime capability records derive deterministically from the registry
// (modalities, latency classes, routing profiles supported), the
// binding-capable classes are exactly the LLM/VLM provider classes, and the
// order's three candidate-class groups are all covered.
import assert from "node:assert/strict";
import test from "node:test";
import { createSoulRegistry } from "../technology/soulSeedProfiles.js";
import {
  BINDING_CAPABLE_CLASSES,
  deriveSoulCapabilityProfiles,
  soulCapabilityById,
} from "./capabilityProfiles.js";

const registry = createSoulRegistry();
const capabilities = deriveSoulCapabilityProfiles(registry);

test("soul capability profiles: all fifteen W7C candidates derive a capability record", () => {
  assert.equal(capabilities.length, 15);
  const ids = capabilities.map((profile) => profile.id);
  for (const id of ["vllm", "text-generation-inference", "llama-cpp", "ollama", "qwen3-vl", "llama-3", "routellm", "eagle", "medusa", "livekit", "mediasoup", "janus-gateway", "pion-webrtc", "aiortc", "whip"]) {
    assert.ok(ids.includes(id), `${id} derives a capability profile`);
  }
  // deterministic replay
  assert.deepEqual(deriveSoulCapabilityProfiles(registry), capabilities);
});

test("soul capability profiles: the order's candidate classes are covered", () => {
  const classes = new Set(capabilities.map((profile) => profile.soulClass));
  // LLM/VLM providers
  for (const soulClass of ["serving-stack", "inference-runtime", "vlm-family"]) {
    assert.ok(classes.has(soulClass as never), `provider class "${soulClass}" covered`);
  }
  // state-routing approaches
  for (const soulClass of ["state-routing", "speculative-decode"]) {
    assert.ok(classes.has(soulClass as never), `routing class "${soulClass}" covered`);
  }
  // realtime media stacks
  for (const soulClass of ["sfu-server", "webrtc-transport", "streaming-protocol"]) {
    assert.ok(classes.has(soulClass as never), `realtime class "${soulClass}" covered`);
  }
});

test("soul capability profiles: binding-capable classes are exactly the LLM/VLM provider classes", () => {
  assert.deepEqual([...BINDING_CAPABLE_CLASSES].sort(), ["inference-runtime", "serving-stack", "vlm-family"]);
  const byId = new Map(capabilities.map((profile) => [profile.id, profile]));
  for (const id of ["vllm", "text-generation-inference", "llama-cpp", "ollama", "qwen3-vl", "llama-3"]) {
    assert.equal(byId.get(id)?.bindingCapable, true, `${id} (provider) is binding-capable`);
  }
  for (const id of ["routellm", "eagle", "medusa", "livekit", "mediasoup", "janus-gateway", "pion-webrtc", "aiortc", "whip"]) {
    assert.equal(byId.get(id)?.bindingCapable, false, `${id} (supporting technology) is not binding-capable`);
  }
});

test("soul capability profiles: modalities derive from the registry tags", () => {
  const byId = new Map(capabilities.map((profile) => [profile.id, profile]));
  // providers: text generation + vision input
  for (const id of ["vllm", "llama-cpp", "ollama", "qwen3-vl", "llama-3"]) {
    assert.deepEqual(byId.get(id)?.modalities, ["image", "text"], `${id}: text+image modalities`);
  }
  // TGI: text-only serving (no vision tag on the researched profile)
  assert.deepEqual(byId.get("text-generation-inference")?.modalities, ["text"]);
  // routellm routes text endpoints; speculative decoding accelerates text decoding
  assert.deepEqual(byId.get("routellm")?.modalities, ["text"]);
  assert.deepEqual(byId.get("eagle")?.modalities, ["text"]);
  assert.deepEqual(byId.get("medusa")?.modalities, ["text"]);
  // realtime stacks carry audio/video/data media (whip carries media ingestion only —
  // the WHIP protocol has no data-channel signaling)
  const expectedModalities: Readonly<Record<string, readonly string[]>> = {
    livekit: ["audio", "data", "video"],
    mediasoup: ["audio", "data", "video"],
    "janus-gateway": ["audio", "data", "video"],
    "pion-webrtc": ["audio", "data", "video"],
    aiortc: ["audio", "data", "video"],
    whip: ["audio", "video"],
  };
  for (const [id, expected] of Object.entries(expectedModalities)) {
    assert.deepEqual(byId.get(id)?.modalities, expected, `${id}: transport modalities`);
  }
});

test("soul capability profiles: routing profiles follow the system-one/system-two law", () => {
  const byId = new Map(capabilities.map((profile) => [profile.id, profile]));
  // providers serve open-weight models of any size — both routes
  for (const id of ["vllm", "text-generation-inference", "llama-cpp", "ollama", "qwen3-vl", "llama-3"]) {
    assert.deepEqual(byId.get(id)?.routingProfiles, ["system-one", "system-two"], `${id}: both routing profiles`);
  }
  // a router between strong and weak endpoints exercises both routes by construction
  assert.deepEqual(byId.get("routellm")?.routingProfiles, ["system-one", "system-two"]);
  // speculative decoding accelerates the deliberate route
  assert.deepEqual(byId.get("eagle")?.routingProfiles, ["system-two"]);
  assert.deepEqual(byId.get("medusa")?.routingProfiles, ["system-two"]);
  // realtime transports carry media, they do not route souls
  for (const id of ["livekit", "mediasoup", "janus-gateway", "pion-webrtc", "aiortc", "whip"]) {
    assert.deepEqual(byId.get(id)?.routingProfiles, [], `${id}: no routing profiles`);
  }
});

test("soul capability profiles: latency classes follow the authored vocabulary", () => {
  const byId = new Map(capabilities.map((profile) => [profile.id, profile]));
  for (const id of ["vllm", "text-generation-inference", "llama-cpp", "ollama", "qwen3-vl", "llama-3"]) {
    assert.deepEqual(byId.get(id)?.latencyClasses, ["interactive", "turn-based"], `${id}: LLM serving latency classes`);
  }
  assert.deepEqual(byId.get("routellm")?.latencyClasses, ["interactive", "turn-based"]);
  assert.deepEqual(byId.get("eagle")?.latencyClasses, ["interactive"], "speculative decoding pulls deep turns toward interactive");
  assert.deepEqual(byId.get("medusa")?.latencyClasses, ["interactive"]);
  for (const id of ["livekit", "mediasoup", "janus-gateway", "pion-webrtc", "aiortc", "whip"]) {
    assert.deepEqual(byId.get(id)?.latencyClasses, ["realtime"], `${id}: realtime latency class`);
  }
});

test("soul capability profiles: lookup helper + engineering-assessment provenance", () => {
  assert.ok(soulCapabilityById(capabilities, "llama-cpp"));
  assert.equal(soulCapabilityById(capabilities, "not-a-soul-tech"), null);
  for (const capability of capabilities) {
    assert.equal(capability.bindingCapable, BINDING_CAPABLE_CLASSES.includes(capability.soulClass));
    assert.ok(capability.derivedFrom.startsWith("you-lab soul-capability table/"));
    assert.ok(capability.notes.length > 0);
  }
});
