// Provider-neutral realtime channel adapter seam (W7C).
//
// Realtime media stacks (WebRTC-class transports, SFU-class servers,
// streaming protocols) are adapters behind a CONSTRUCTION seam, never domain
// authorities (docs/you/ARCHITECTURE.md). This seam defines the neutral W7C
// realtime surface: typed channel params -> content-addressed neutral
// channel descriptors (streamRef + streamHash = sha-256 of the canonical
// stream-manifest bytes) — structurally aligned with the frozen
// @zcode/shared YOU v7 RealtimeChannelDescriptor; mapping onto the frozen
// contract happens ONLY in src/contractSeam.ts.
//
// CONTENT-ADDRESSING LAW (frozen v7): stream references are content
// addressed — never inlined. The stream manifest (the channel's addressing
// content: session, channel, kind, latency class, backing transport) is
// canonicalized and hashed; the streamRef addresses the you-lab realtime
// content store and the streamHash binds the manifest bytes. Same params ⇒
// byte-identical channel on every run and platform (no clock, no randomness,
// no network — docs/you/FIXTURES.md).

import { canonicalJson } from "../determinism.js";
import { sha256Hex, type NeutralLatencyClass } from "../soul/soulAdapterSeam.js";

/** Neutral realtime channel kind — the media a channel carries (W7C authored vocabulary). */
export type NeutralRealtimeChannelKind = "audio" | "video" | "data" | "audio-video" | (string & {});

/** Typed realtime channel params — the construction input for a channel descriptor. */
export interface NeutralRealtimeChannelParams {
  /** Channel id within the avatar session (opaque, non-empty). */
  readonly channelId: string;
  /** The avatar session the channel serves (opaque, non-empty). */
  readonly avatarSessionId: string;
  /** The media kind the channel carries. */
  readonly kind: NeutralRealtimeChannelKind;
  /** The latency class the channel operates under (W7C authored vocabulary). */
  readonly latencyClass: NeutralLatencyClass;
  /** Backing realtime transport technology (a W7C registry technology id). */
  readonly transportId: string;
}

/** A content-addressed neutral realtime channel — aligned 1:1 with the frozen v7 RealtimeChannelDescriptor. */
export interface NeutralRealtimeChannel {
  readonly id: string;
  readonly kind: NeutralRealtimeChannelKind;
  /** Content-addressed stream reference — never inlined (content-store law). */
  readonly streamRef: string;
  /** sha-256 hex of the canonical stream-manifest bytes (binds the channel content). */
  readonly streamHash: string;
  readonly latencyClass: NeutralLatencyClass;
}

/**
 * The canonical stream manifest of a channel — the addressing content the
 * streamHash binds (deterministic canonical JSON; sorted keys by
 * construction of the canonical serializer).
 */
export function realtimeStreamManifest(params: NeutralRealtimeChannelParams): Record<string, unknown> {
  return {
    channelId: params.channelId,
    avatarSessionId: params.avatarSessionId,
    kind: params.kind,
    latencyClass: params.latencyClass,
    transportId: params.transportId,
  };
}

/** Opaque content-store stream reference for (avatarSessionId, channelId) — content-addressed. */
export function neutralRealtimeStreamRef(avatarSessionId: string, channelId: string): string {
  return `content-store://you-lab/realtime/${avatarSessionId}/${channelId}`;
}

/** Deterministic channel id for (avatarSessionId, channelId) — you_realtime-channel_<16hex>. */
export function neutralRealtimeChannelId(avatarSessionId: string, channelId: string): string {
  return `you_realtime-channel_${sha256Hex(`${avatarSessionId}|${channelId}`).slice(0, 16)}`;
}

/**
 * Construct a content-addressed neutral realtime channel descriptor from
 * channel params (the W7C realtime seam): the streamRef addresses the
 * you-lab realtime content store and the streamHash binds the canonical
 * stream-manifest bytes — same params ⇒ byte-identical channel (the
 * frozen v7 content-addressing law holds; heavy stream content is never
 * inlined in the descriptor).
 */
export function buildRealtimeChannel(params: NeutralRealtimeChannelParams): NeutralRealtimeChannel {
  if (params.channelId.length === 0 || params.channelId.trim() !== params.channelId) {
    throw new Error("buildRealtimeChannel: channelId must be non-empty and carry no surrounding whitespace");
  }
  if (params.avatarSessionId.length === 0 || params.avatarSessionId.trim() !== params.avatarSessionId) {
    throw new Error("buildRealtimeChannel: avatarSessionId must be non-empty and carry no surrounding whitespace");
  }
  if (params.kind.length === 0) {
    throw new Error("buildRealtimeChannel: kind must be non-empty (audio/video/data/audio-video or an open-union value)");
  }
  if (params.latencyClass.length === 0) {
    throw new Error("buildRealtimeChannel: latencyClass must be non-empty (the W7C latency vocabulary: realtime/interactive/turn-based)");
  }
  if (params.transportId.length === 0) {
    throw new Error("buildRealtimeChannel: transportId must be non-empty (a W7C registry realtime technology id)");
  }
  return {
    id: neutralRealtimeChannelId(params.avatarSessionId, params.channelId),
    kind: params.kind,
    streamRef: neutralRealtimeStreamRef(params.avatarSessionId, params.channelId),
    streamHash: sha256Hex(canonicalJson(realtimeStreamManifest(params))),
    latencyClass: params.latencyClass,
  };
}

/** Digest label for the neutral realtime seam (honest provenance wiring). */
export function neutralRealtimeSeamVersion(): string {
  return "you-lab-realtime-seam/1";
}
