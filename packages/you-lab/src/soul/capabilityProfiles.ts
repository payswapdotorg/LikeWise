// Soul/realtime capability profiles derivation (W7C).
//
// Derives the provider/routing/realtime capability records as a deterministic
// function of the technology registry: the candidate class comes from a
// fixed id-to-class table (the W7C taxonomy authored input, mirroring
// docs/you/WORK_ORDERS.md W7C), modalities from a fixed tag-to-modalities
// table, routing profiles and latency classes from fixed id-to-tables and
// the notes from a fixed id-to-assessment table (authored engineering
// assessments — never a runtime authority, never a verified external
// claim). Registry technologies outside the authored W7C table derive NO
// capability profile (the W5C/W6C gating pattern — the table, not the
// profile shape, decides participation).
//
// The capability record carries the three dimensions the W7C order names:
// modalities, latency classes and routing profiles supported — plus the
// binding-capable flag (only the LLM/VLM provider classes can back a
// SoulBinding; routing approaches and realtime stacks are supporting
// technologies).

import { sortedUnique } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type {
  NeutralLatencyClass,
  NeutralSoulClass,
  NeutralSoulModality,
  NeutralSoulRoutingProfile,
} from "./soulAdapterSeam.js";

const DERIVATION_TABLE = "you-lab soul-capability table/1 (engineering assessment)";

/** W7C candidate class per technology id (authored input — the order's classes; missing id => no profile). */
const SOUL_CLASS: Readonly<Record<string, NeutralSoulClass>> = {
  // LLM/VLM providers (open-weight serving stacks, inference runtimes, multimodal VLM families)
  vllm: "serving-stack",
  "text-generation-inference": "serving-stack",
  "llama-cpp": "inference-runtime",
  ollama: "inference-runtime",
  "qwen3-vl": "vlm-family",
  "llama-3": "vlm-family",
  // state-routing approaches
  routellm: "state-routing",
  eagle: "speculative-decode",
  medusa: "speculative-decode",
  // realtime media stacks
  livekit: "sfu-server",
  mediasoup: "sfu-server",
  "janus-gateway": "sfu-server",
  "pion-webrtc": "webrtc-transport",
  aiortc: "webrtc-transport",
  whip: "streaming-protocol",
};

/** Candidate classes that can back a SoulBinding (the LLM/VLM provider classes). */
export const BINDING_CAPABLE_CLASSES: readonly NeutralSoulClass[] = [
  "serving-stack",
  "inference-runtime",
  "vlm-family",
];

/** Authored tag -> modalities (deterministic derivation). */
const TAG_MODALITIES: Readonly<Record<string, readonly NeutralSoulModality[]>> = {
  "text-generation": ["text"],
  "vision-input": ["image"],
  "text-endpoints": ["text"],
  "text-decoding": ["text"],
  "audio-video-transport": ["audio", "video"],
  "data-transport": ["data"],
};

/** Authored supported routing profiles per technology id (engineering assessment). */
const ROUTING_PROFILES: Readonly<Record<string, readonly NeutralSoulRoutingProfile[]>> = {
  // providers serve open-weight models of any size — both the fast and the deliberate route
  vllm: ["system-one", "system-two"],
  "text-generation-inference": ["system-one", "system-two"],
  "llama-cpp": ["system-one", "system-two"],
  ollama: ["system-one", "system-two"],
  "qwen3-vl": ["system-one", "system-two"],
  "llama-3": ["system-one", "system-two"],
  // a router between strong and weak endpoints exercises both routes by construction
  routellm: ["system-one", "system-two"],
  // speculative decoding accelerates the deliberate route toward interactive latency
  eagle: ["system-two"],
  medusa: ["system-two"],
  // realtime transports carry media, they do not route souls
  livekit: [],
  mediasoup: [],
  "janus-gateway": [],
  "pion-webrtc": [],
  aiortc: [],
  whip: [],
};

/** Authored latency classes per technology id (engineering assessment). */
const LATENCY_CLASSES: Readonly<Record<string, readonly NeutralLatencyClass[]>> = {
  vllm: ["interactive", "turn-based"],
  "text-generation-inference": ["interactive", "turn-based"],
  "llama-cpp": ["interactive", "turn-based"],
  ollama: ["interactive", "turn-based"],
  "qwen3-vl": ["interactive", "turn-based"],
  "llama-3": ["interactive", "turn-based"],
  routellm: ["interactive", "turn-based"],
  eagle: ["interactive"],
  medusa: ["interactive"],
  livekit: ["realtime"],
  mediasoup: ["realtime"],
  "janus-gateway": ["realtime"],
  "pion-webrtc": ["realtime"],
  aiortc: ["realtime"],
  whip: ["realtime"],
};

/** Authored capability note per technology id (engineering assessment with rationale). */
const SOUL_NOTES: Readonly<Record<string, string>> = {
  vllm: "Open-weight serving stack: paged-attention/continuous-batching server for open-weight LLM/VLM models — serves SoulBindings over both routing profiles (W7C serving-stack class).",
  "text-generation-inference": "Open-weight serving stack: Rust/Python inference server with tensor parallelism — serves SoulBindings over both routing profiles (W7C serving-stack class).",
  "llama-cpp": "Local inference runtime: GGUF open-weight execution on CPU/GPU with vision support — locally-possessed Souls over both routing profiles (W7C inference-runtime class).",
  ollama: "Local inference runtime: bundled open-weight model runner with a local API — locally-possessed Souls over both routing profiles (W7C inference-runtime class).",
  "qwen3-vl": "Multimodal open-weight VLM family spanning small and large variants — multimodal SoulBindings with image understanding (W7C vlm-family class).",
  "llama-3": "Open-weight model family spanning text-only and vision variants, served through any open-weight stack (W7C vlm-family class); custom community license.",
  routellm: "System-one/system-two routing framework: routes queries between strong and weak LLM endpoints by learned router policies (W7C state-routing class).",
  eagle: "Speculative-decode class: draft-model decoding acceleration (EAGLE-3 line) pulling deep system-two turns toward interactive latency (W7C speculative-decode class).",
  medusa: "Speculative-decode class: multi-head decoding acceleration for the deliberate route (W7C speculative-decode class).",
  livekit: "SFU-class realtime media server: scalable WebRTC selective forwarding over audio/video/data tracks — realtime avatar channels (W7C sfu-server class).",
  mediasoup: "SFU-class realtime media library: Node.js/Rust WebRTC SFU at the ORTC layer — embeddable realtime avatar channels (W7C sfu-server class).",
  "janus-gateway": "SFU-class realtime media server with a plugin architecture (W7C sfu-server class); GPL-3.0.",
  "pion-webrtc": "WebRTC-class transport: pure-Go WebRTC stack over audio/video/data tracks — embeddable realtime avatar channels (W7C webrtc-transport class).",
  aiortc: "WebRTC-class transport: Python WebRTC/ORTC stack over audio/video/data tracks — server-side realtime avatar channels (W7C webrtc-transport class).",
  whip: "Streaming protocol: HTTP-based signaling for WebRTC ingestion into streaming services/CDNs — ingest-side realtime channels (W7C streaming-protocol class).",
};

/** A provider/routing/realtime capability record (the order's three dimensions). */
export interface SoulCapabilityProfile {
  readonly id: string;
  readonly soulClass: NeutralSoulClass;
  readonly displayName: string;
  readonly modalities: readonly NeutralSoulModality[];
  readonly latencyClasses: readonly NeutralLatencyClass[];
  readonly routingProfiles: readonly NeutralSoulRoutingProfile[];
  /** Whether the technology can back a SoulBinding (the LLM/VLM provider classes). */
  readonly bindingCapable: boolean;
  readonly notes: string;
  readonly derivedFrom: string;
}

export function deriveSoulCapabilityProfiles(registry: TechnologyRegistry): readonly SoulCapabilityProfile[] {
  const profiles: SoulCapabilityProfile[] = [];
  for (const technology of registry.profiles) {
    const soulClass = SOUL_CLASS[technology.id];
    if (!soulClass) continue; // registry technology outside the W7C taxonomy — no capability profile
    const modalities = sortedUnique(
      technology.capabilityTags.flatMap((tag) => TAG_MODALITIES[tag] ?? []),
    ) as readonly NeutralSoulModality[];
    const routingProfiles = sortedUnique(
      ROUTING_PROFILES[technology.id] ?? [],
    ) as readonly NeutralSoulRoutingProfile[];
    const latencyClasses = sortedUnique(
      LATENCY_CLASSES[technology.id] ?? [],
    ) as readonly NeutralLatencyClass[];
    profiles.push({
      id: technology.id,
      soulClass,
      displayName: technology.name,
      modalities,
      latencyClasses,
      routingProfiles,
      bindingCapable: BINDING_CAPABLE_CLASSES.includes(soulClass),
      notes:
        SOUL_NOTES[technology.id] ??
        "Unknown soul/realtime integration — conservative capability record until benchmarked.",
      derivedFrom: DERIVATION_TABLE,
    });
  }
  return profiles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Capability profile lookup by technology id (null when not derived). */
export function soulCapabilityById(
  profiles: readonly SoulCapabilityProfile[],
  technologyId: string,
): SoulCapabilityProfile | null {
  return profiles.find((profile) => profile.id === technologyId) ?? null;
}
