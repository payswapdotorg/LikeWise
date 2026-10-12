// Realtime channel adapter seam tests (W7C) — coverage: channel descriptor
// construction is deterministic and content-addressed (the streamHash binds
// the canonical stream manifest; different params produce different
// hashes), validation refuses malformed params, and the realtime
// transports' capability records back the channel vocabulary.
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { createSoulRegistry } from "../technology/soulSeedProfiles.js";
import { deriveSoulCapabilityProfiles } from "../soul/capabilityProfiles.js";
import { sha256Hex } from "../soul/soulAdapterSeam.js";
import {
  buildRealtimeChannel,
  neutralRealtimeChannelId,
  neutralRealtimeSeamVersion,
  neutralRealtimeStreamRef,
  realtimeStreamManifest,
  type NeutralRealtimeChannelParams,
} from "./realtimeAdapterSeam.js";

const registry = createSoulRegistry();
const capabilities = deriveSoulCapabilityProfiles(registry);

const VOICE_PARAMS: NeutralRealtimeChannelParams = {
  channelId: "voice",
  avatarSessionId: "you_avatar-session_0123456789abcdef",
  kind: "audio",
  latencyClass: "realtime",
  transportId: "livekit",
};

test("realtime seam: channel construction is deterministic (byte-identical replay)", () => {
  const first = buildRealtimeChannel(VOICE_PARAMS);
  const second = buildRealtimeChannel(VOICE_PARAMS);
  assert.deepEqual(first, second);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(neutralRealtimeSeamVersion(), "you-lab-realtime-seam/1");
});

test("realtime seam: stream refs are content-addressed and the streamHash binds the manifest bytes", () => {
  const channel = buildRealtimeChannel(VOICE_PARAMS);
  // streamRef addresses the you-lab realtime content store
  assert.equal(channel.streamRef, neutralRealtimeStreamRef(VOICE_PARAMS.avatarSessionId, VOICE_PARAMS.channelId));
  assert.ok(channel.streamRef.startsWith("content-store://you-lab/realtime/"));
  // streamHash = sha-256 over the canonical stream manifest (content-addressing law)
  assert.equal(channel.streamHash, sha256Hex(canonicalJson(realtimeStreamManifest(VOICE_PARAMS))));
  assert.ok(/^[0-9a-f]{64}$/.test(channel.streamHash));
  // the channel id is a deterministic digest of (session, channel)
  assert.equal(channel.id, neutralRealtimeChannelId(VOICE_PARAMS.avatarSessionId, VOICE_PARAMS.channelId));
  assert.match(channel.id, /^you_realtime-channel_[0-9a-f]{16}$/);
  // heavy stream content is never inlined in the descriptor
  assert.deepEqual(Object.keys(channel).sort(), ["id", "kind", "latencyClass", "streamHash", "streamRef"]);
});

test("realtime seam: different params produce different hashes (content addressing binds)", () => {
  const base = buildRealtimeChannel(VOICE_PARAMS);
  const variants: readonly NeutralRealtimeChannelParams[] = [
    { ...VOICE_PARAMS, channelId: "video" },
    { ...VOICE_PARAMS, avatarSessionId: "you_avatar-session-fedcba9876543210" },
    { ...VOICE_PARAMS, kind: "video" },
    { ...VOICE_PARAMS, latencyClass: "interactive" },
    { ...VOICE_PARAMS, transportId: "mediasoup" },
  ];
  for (const variant of variants) {
    const channel = buildRealtimeChannel(variant);
    assert.notEqual(channel.streamHash, base.streamHash, `${variant.channelId}/${variant.kind}/${variant.transportId}: distinct manifest => distinct hash`);
  }
});

test("realtime seam: validation refuses malformed channel params", () => {
  assert.throws(() => buildRealtimeChannel({ ...VOICE_PARAMS, channelId: "" }), /channelId must be non-empty/);
  assert.throws(() => buildRealtimeChannel({ ...VOICE_PARAMS, channelId: " spaced " }), /no surrounding whitespace/);
  assert.throws(() => buildRealtimeChannel({ ...VOICE_PARAMS, avatarSessionId: "" }), /avatarSessionId must be non-empty/);
  assert.throws(() => buildRealtimeChannel({ ...VOICE_PARAMS, kind: "" }), /kind must be non-empty/);
  assert.throws(() => buildRealtimeChannel({ ...VOICE_PARAMS, latencyClass: "" }), /latencyClass must be non-empty/);
  assert.throws(() => buildRealtimeChannel({ ...VOICE_PARAMS, transportId: "" }), /transportId must be non-empty/);
});

test("realtime seam: the channel vocabulary covers the avatar media kinds", () => {
  // an avatar session's channel set: voice + video + data over a realtime transport
  const channels = (["audio", "video", "data"] as const).map((kind) =>
    buildRealtimeChannel({
      channelId: `channel-${kind}`,
      avatarSessionId: "you_avatar-session_0123456789abcdef",
      kind,
      latencyClass: "realtime",
      transportId: "livekit",
    }),
  );
  assert.deepEqual(channels.map((channel) => channel.kind), ["audio", "video", "data"]);
  for (const channel of channels) {
    assert.equal(channel.latencyClass, "realtime");
    assert.ok(channel.streamHash.length === 64);
  }
  // combined audio-video channels carry the authored combined kind
  const av = buildRealtimeChannel({ ...VOICE_PARAMS, kind: "audio-video" });
  assert.equal(av.kind, "audio-video");
});

test("realtime seam: the realtime transports' capability records back the channel vocabulary", () => {
  const byId = new Map(capabilities.map((profile) => [profile.id, profile]));
  // every W7C realtime transport carries the realtime latency class; the media
  // stacks carry audio/video/data (whip carries media ingestion only — no data
  // channels in the WHIP protocol)
  const expectedModalities: Readonly<Record<string, readonly string[]>> = {
    livekit: ["audio", "data", "video"],
    mediasoup: ["audio", "data", "video"],
    "janus-gateway": ["audio", "data", "video"],
    "pion-webrtc": ["audio", "data", "video"],
    aiortc: ["audio", "data", "video"],
    whip: ["audio", "video"],
  };
  for (const [id, expected] of Object.entries(expectedModalities)) {
    const capability = byId.get(id);
    assert.ok(capability, `${id} derives a capability record`);
    assert.deepEqual(capability.latencyClasses, ["realtime"], `${id}: realtime latency class`);
    assert.deepEqual(capability.modalities, expected, `${id}: transport media kinds`);
    assert.equal(capability.bindingCapable, false, `${id}: transports are not SoulBinding backends`);
  }
  // every realtime transport id in the registry can back a channel construction
  for (const id of ["livekit", "mediasoup", "janus-gateway", "pion-webrtc", "aiortc", "whip"]) {
    const channel = buildRealtimeChannel({ ...VOICE_PARAMS, transportId: id });
    assert.ok(channel.streamHash, `${id}: channel construction over the transport`);
  }
});
