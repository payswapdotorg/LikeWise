// Provider-neutral soul adapter seam (W7C).
//
// External LLM/VLM serving stacks, inference runtimes and model families are
// adapters, never domain authorities (docs/you/ARCHITECTURE.md). This seam
// defines the neutral W7C soul surface: a typed soul invocation (a
// SoulBinding-shaped neutral binding + a routed prompt context) that produces
// content-addressed response records per the frozen v7 contract laws. The
// neutral shapes are owned by you-lab and are structurally aligned with the
// frozen @zcode/shared YOU v7 SoulBinding/SoulRoutingProfile/EmbodimentState
// shapes; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts.
//
// ROUTING LAW: system-one (fast/reactive) and system-two (deep/deliberate)
// are ROUTING PROFILES, not fixed model identities (the frozen v7 law). The
// routed prompt context carries the profile of the invocation; the adapter
// responds under that route (a misrouted response is visible in its record
// routingProfile — honest, never rewritten).
//
// PROJECTION LAW: the embodiment-state ladder is a projection, never an
// authority (the frozen v7 law). Response records carry the projected
// embodiment state of the response act; the session-level state is derived
// downstream (the state ladder belongs to the avatar session, W7A).
//
// Determinism: response content, records and digests are pure functions of
// their inputs (no clock, no Math.random, no network — seeded derivations
// only, docs/you/FIXTURES.md). Effort/latency/cost are structured fields
// carrying explicit not-measured markers (truth law — never invented
// numbers).

import { createHash } from "node:crypto";

import { fnv1a32, roundTo, sortedUnique } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import type { MetricField } from "../benchmarks/runner.js";

/** Neutral routing profile — aligned 1:1 with the frozen v7 SoulRoutingProfile. */
export type NeutralSoulRoutingProfile = "system-one" | "system-two" | (string & {});

/** Neutral modality — the soul's input/output modality surface (W7C authored vocabulary). */
export type NeutralSoulModality = "text" | "image" | "audio" | "video" | "data" | (string & {});

/**
 * Neutral latency class — the W7C authored latency vocabulary (the frozen v7
 * RealtimeChannelDescriptor.latencyClass is an opaque string; the W7C lane
 * is its research authority per the contract comment).
 */
export type NeutralLatencyClass = "realtime" | "interactive" | "turn-based" | (string & {});

/**
 * Neutral embodiment state — aligned 1:1 with the frozen v7 EmbodimentState
 * nine-state ladder (listening/reading/typing/thinking/tool_use/speaking/
 * interrupted/idle/unavailable).
 */
export type NeutralEmbodimentState =
  | "listening" | "reading" | "typing" | "thinking" | "tool_use" | "speaking"
  | "interrupted" | "idle" | "unavailable"
  | (string & {});

/** Neutral W7C candidate classes — the order's provider/routing/realtime taxonomy. */
export type NeutralSoulClass =
  | "serving-stack" | "inference-runtime" | "vlm-family"      // LLM/VLM providers (binding-capable)
  | "state-routing" | "speculative-decode"                     // state-routing approaches
  | "sfu-server" | "webrtc-transport" | "streaming-protocol"   // realtime media stacks
  | (string & {});

/**
 * Neutral soul binding — aligned 1:1 with the frozen v7 SoulBinding
 * (provider-neutral LLM/VLM/runtime binding; model references are opaque
 * strings, registry authority = the W7C lane).
 */
export interface NeutralSoulBinding {
  readonly id: string;
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: NeutralSoulRoutingProfile;
  readonly capabilities: readonly string[];
}

/**
 * Routed prompt context — the invocation's route and content-addressed
 * context. The directive and task prompt are invocation inputs (not
 * records); context is referenced, never inlined.
 */
export interface NeutralRoutedPromptContext {
  readonly id: string;
  /** The route this invocation takes (system-one fast / system-two deep). */
  readonly routingProfile: NeutralSoulRoutingProfile;
  readonly systemDirective: string;
  /** Content-addressed context refs (wave-2 content store; never inlined). */
  readonly contextRefs: readonly string[];
  readonly taskPrompt: string;
  readonly requestedModalities: readonly NeutralSoulModality[];
}

/** Typed soul invocation request = binding + routed prompt context. */
export interface NeutralSoulRequest {
  readonly requestId: string;
  readonly binding: NeutralSoulBinding;
  readonly prompt: NeutralRoutedPromptContext;
  readonly submittedAt: string;
}

/**
 * A content-addressed soul response record — the response to one addressed
 * context ref. Response content is never inlined in the record
 * (contentRef + contentHash only); the record carries the route the response
 * was actually generated under and the projected embodiment state of the
 * response act (projection, never authority).
 */
export interface NeutralSoulResponseRecord {
  readonly id: string;
  readonly bindingId: string;
  readonly requestId: string;
  /** The routing profile the response was actually generated under. */
  readonly routingProfile: NeutralSoulRoutingProfile;
  /** The output modality of this response record. */
  readonly modality: NeutralSoulModality;
  /** Projected embodiment state of the response act (projection, never authority). */
  readonly embodimentState: NeutralEmbodimentState;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly completedAt: string;
  readonly simulated: boolean;
}

/** Structured effort/latency/cost fields with honest markers (truth law). */
export interface SoulEffortFields {
  readonly effort: MetricField;
  readonly latency: MetricField;
  readonly cost: MetricField;
}

/** Deterministic output of a typed soul invocation. */
export interface NeutralSoulOutput {
  readonly adapterId: string;
  readonly requestId: string;
  readonly records: readonly NeutralSoulResponseRecord[];
  /**
   * Response-content payloads for this invocation keyed by record id — the
   * content-store sidecar the caller can resolve contentRefs against.
   * NEVER inlined in the response records themselves (the v7
   * content-addressing law holds: records carry contentRef + contentHash
   * only); each payload's canonical JSON hashes to its record's contentHash.
   */
  readonly payloads: Readonly<Record<string, Record<string, unknown>>>;
  /** Canonical-JSON digest over the response content entries (deterministic). */
  readonly responseContentHash: string;
  readonly warnings: readonly string[];
  readonly effort: SoulEffortFields;
  readonly simulated: boolean;
}

/** Profile of a registered soul adapter behind the seam. */
export interface SoulAdapterProfile {
  readonly id: string;
  /** Backing registry technology id, or null for pure mock candidates. */
  readonly technologyId: string | null;
  readonly soulClass: NeutralSoulClass;
  readonly supportedModalities: readonly NeutralSoulModality[];
  readonly supportedRoutingProfiles: readonly NeutralSoulRoutingProfile[];
  /** The latency class the adapter's responses fall into (authored vocabulary). */
  readonly latencyClass: NeutralLatencyClass;
  /** "mock" for pure mocks; "evaluation" for registry-backed evaluation adapters. */
  readonly adapterKind: "mock" | "evaluation";
  /** Whether the adapter implementation itself is bit-deterministic. */
  readonly deterministic: boolean;
  readonly determinismNote: string;
  /** Registry-derived production eligibility (null for pure mocks). */
  readonly productionEligible: boolean | null;
  readonly eligibilityBasis: string;
}

export interface SoulAdapter {
  readonly profile: SoulAdapterProfile;
  /** Typed soul invocation over the binding + routed prompt context (deterministic, simulated). */
  invoke(request: NeutralSoulRequest): NeutralSoulOutput;
}

/** Error code aligned with the frozen v7 typed error literal (you-lab-owned). */
export const SOUL_UNSUPPORTED_CODE = "YOU_SOUL_BINDING_INVALID";

/** Typed refusal thrown when an adapter is invoked with an unsupported binding/route/modality. */
export class UnsupportedSoulRequestError extends Error {
  readonly code = SOUL_UNSUPPORTED_CODE;
  constructor(adapterId: string, detail: string, supported: readonly string[]) {
    super(
      `${SOUL_UNSUPPORTED_CODE}: adapter '${adapterId}' does not support ${detail} (supported: ${supported.join(", ") || "none"})`,
    );
  }
}

/** Unsupported aspects of a request for an adapter ([] when fully supported). */
export function unsupportedSoulRequestAspects(
  profile: SoulAdapterProfile,
  request: NeutralSoulRequest,
): readonly string[] {
  const aspects: string[] = [];
  if (!profile.supportedRoutingProfiles.includes(request.binding.routingProfile)) {
    aspects.push(`binding routing profile '${request.binding.routingProfile}'`);
  }
  if (!profile.supportedRoutingProfiles.includes(request.prompt.routingProfile)) {
    aspects.push(`prompt routing profile '${request.prompt.routingProfile}'`);
  }
  if (request.binding.routingProfile !== request.prompt.routingProfile) {
    aspects.push("binding/prompt routing profile divergence (one Soul, one route per invocation)");
  }
  for (const modality of request.prompt.requestedModalities) {
    if (!profile.supportedModalities.includes(modality)) {
      aspects.push(`requested modality '${modality}'`);
    }
  }
  return aspects;
}

/** Typed refusal helper: throws when the request binding/route/modality is not supported. */
export function assertSoulRequestSupported(
  profile: SoulAdapterProfile,
  request: NeutralSoulRequest,
): void {
  const unsupported = unsupportedSoulRequestAspects(profile, request);
  const first = unsupported[0];
  if (unsupported.length > 0 && first !== undefined) {
    throw new UnsupportedSoulRequestError(
      profile.id,
      first,
      sortedUnique([
        ...profile.supportedRoutingProfiles.map((route) => `route:${route}`),
        ...profile.supportedModalities.map((modality) => `modality:${modality}`),
      ]),
    );
  }
}

/** sha-256 hex digest of string/bytes input (deterministic, no clock). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Opaque deterministic response record id for (adapterId, requestId, contextRef) — you_soul-response_<16hex>. */
export function neutralSoulResponseId(adapterId: string, requestId: string, contextRef: string): string {
  return `you_soul-response_${sha256Hex(`${adapterId}|${requestId}|${contextRef}`).slice(0, 16)}`;
}

/** Opaque content-store response-content reference for one record of (adapterId, requestId, index). */
export function neutralSoulContentRef(adapterId: string, requestId: string, index: number): string {
  return `content-store://you-lab/soul/${adapterId}/${requestId}/response-${index}`;
}

/** Honest not-measured effort fields for simulated soul adapters. */
export function notMeasuredSoulEffortFields(): SoulEffortFields {
  return {
    effort: { kind: "not-measured", marker: "not-measured (simulated)" },
    latency: { kind: "not-measured", marker: "not-measured (simulated)" },
    cost: { kind: "not-measured", marker: "not-measured (simulated)" },
  };
}

/**
 * Response topic domains of the synthetic soul model — the fixture
 * objective's vocabulary (W7C authored fixture definition — computed, not
 * measured, and never a claim about real provider behavior).
 */
export const SOUL_RESPONSE_DOMAINS = [
  "answer",
  "summary",
  "reflection",
  "plan",
  "tool-plan",
  "correction",
] as const;

/** Canonical response topic for a context index (domain cycling, deterministic). */
export function intendedResponseTopicAt(index: number): string {
  return SOUL_RESPONSE_DOMAINS[index % SOUL_RESPONSE_DOMAINS.length] ?? SOUL_RESPONSE_DOMAINS[0]!;
}

/**
 * Canonical response value for (contextRef, routingProfile) — hash-derived,
 * route-dependent, rounded to 4 decimals. The route dependence models the
 * system-one/system-two split honestly inside the fixture model: quick
 * routes derive in [0.5, 0.8] (shallow recovery), deliberate routes in
 * [0.7, 1.0] (deep recovery). A misrouted adapter (answering a system-two
 * request on the quick route) derives different values and loses fidelity —
 * the shared synthetic model behind simulated adapters and the fixture
 * objective (never a measurement of a real provider).
 */
export function intendedResponseValueAt(contextRef: string, routingProfile: NeutralSoulRoutingProfile): number {
  const base = unitFrom("you-lab-soul-model", contextRef, "value");
  return roundTo(routingProfile === "system-two" ? 0.7 + base * 0.3 : 0.5 + base * 0.3, 4);
}

/**
 * Projected embodiment state for a response modality (authored projection
 * table — the response ACT's observable state; the ladder is a projection,
 * never an authority, per the frozen v7 law).
 */
export function projectedEmbodimentStateFor(modality: NeutralSoulModality): NeutralEmbodimentState {
  switch (modality) {
    case "text":
      return "typing";
    case "audio":
    case "video":
      return "speaking";
    case "image":
    case "data":
      return "tool_use";
    default:
      return "thinking";
  }
}

/** One response-content entry inside a response record payload. */
export interface ResponseContentEntry {
  /** Response topic domain (e.g. "answer"). */
  readonly topic: string;
  /** Response value (deterministic fixture model — simulated, not measured). */
  readonly value: number;
  /** The context ref the entry responds to (content-addressed). */
  readonly contextRef: string;
  /** The output modality of the response record. */
  readonly modality: NeutralSoulModality;
}

/**
 * Encode a response-content entry as a content-addressed response payload
 * record. The payload bytes are the canonical JSON of the returned record;
 * the hash of those bytes is the response record's contentHash
 * (content-addressing law). The payload carries BOTH the route the response
 * was actually generated under (routingProfile) and the route that was
 * requested (requestedRoutingProfile) — for a routing-honoring adapter these
 * are equal; for a misrouting adapter they differ and the misroute stays
 * visible (truth law — a misroute is never rewritten into a correct one).
 */
export function encodeSoulPayload(
  entry: ResponseContentEntry,
  request: NeutralSoulRequest,
  actualRoutingProfile: NeutralSoulRoutingProfile,
): Record<string, unknown> {
  return {
    topic: entry.topic,
    value: entry.value,
    contextRef: entry.contextRef,
    modality: entry.modality,
    routingProfile: actualRoutingProfile,
    requestedRoutingProfile: request.prompt.routingProfile,
    respondedAt: request.submittedAt,
  };
}

/** Decode a response payload back into its response-content entry. */
export function decodeResponseContent(payload: Record<string, unknown>): ResponseContentEntry {
  return {
    topic: String(payload.topic ?? ""),
    value: Number(payload.value ?? 0),
    contextRef: String(payload.contextRef ?? ""),
    modality: String(payload.modality ?? "") as NeutralSoulModality,
  };
}

/** Digest label for the neutral soul seam (honest provenance wiring). */
export function neutralSoulSeamVersion(): string {
  return `you-lab-soul-seam/1 (fnv1a32 core ${fnv1a32("you-lab-soul-seam/1")})`;
}
