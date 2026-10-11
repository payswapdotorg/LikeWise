// Deterministic render benchmark fixtures (W4C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a synthetic performance
// payload spec (a seeded performance timeline: cues on motion/cue/layer
// tracks with content-addressed payloads) and golden expectations. Golden
// expectations are recorded values (computed once by the shipped
// generator/scorer and embedded on 2026-10-11); an intentional change to any
// golden is a NEW fixture version with provenance — never an in-place edit.
//
// Timeline synthesis follows the frozen v4 timeline laws (mirrored here in
// neutral shapes): cues sorted by startMs, no per-track overlap, endMs >
// startMs, durationMs equals the greatest cue endMs, payload content
// addressed by sha-256. No clock, no randomness beyond the seeded rng, no
// network.

import { createDeterministicRng } from "../capture/deterministicRng.js";
import {
  sha256Hex,
  type NeutralPerformanceCue,
  type NeutralPerformanceTimeline,
  type NeutralPerformanceTrackKind,
} from "./renderAdapterSeam.js";

export interface SyntheticPerformanceSpec {
  /** Performance timeline id (stable fixture identity). */
  readonly timelineId: string;
  readonly durationMs: number;
  /** Tracks to lay cues on (subset of the frozen taxonomy: motion/cue/layer). */
  readonly tracks: readonly ("motion" | "cue" | "layer")[];
  /** Cues per track (>= 1; spread across the duration). */
  readonly cuesPerTrack: number;
}

/**
 * Synthesize a deterministic performance timeline for (seed, spec): cue
 * start/end times are drawn from the seeded rng, cue payloads are
 * seed-derived bytes content-addressed by sha-256, and the resulting cue
 * order is sorted by startMs with per-track non-overlap guaranteed by
 * exclusive per-track slot allocation (fixture definition).
 */
export function synthesizePerformanceTimeline(
  seed: string,
  spec: SyntheticPerformanceSpec,
): NeutralPerformanceTimeline {
  if (spec.tracks.length === 0) throw new Error("synthesizePerformanceTimeline: at least one track is required");
  if (spec.cuesPerTrack < 1) throw new Error("synthesizePerformanceTimeline: cuesPerTrack must be >= 1");
  const rng = createDeterministicRng(`perf-timeline|${seed}|${spec.timelineId}`);
  const cues: NeutralPerformanceCue[] = [];
  let cueIndex = 0;
  for (const track of [...spec.tracks].sort()) {
    const slotMs = Math.floor(spec.durationMs / spec.cuesPerTrack);
    if (slotMs <= 1) throw new Error("synthesizePerformanceTimeline: durationMs too small for cuesPerTrack");
    for (let slot = 0; slot < spec.cuesPerTrack; slot++) {
      const slotStart = slot * slotMs;
      const slotEnd = (slot + 1) * slotMs;
      const jitter = Math.floor(rng.next() * Math.max(1, Math.floor(slotMs / 4)));
      const spanMs = Math.max(1, Math.floor(rng.next() * Math.max(1, slotMs - jitter - 1)) + 1);
      const startMs = Math.min(slotStart + jitter, slotEnd - 1);
      const endMs = Math.min(startMs + spanMs, slotEnd);
      cueIndex += 1;
      const cueId = `cue-${spec.timelineId}-${String(cueIndex).padStart(2, "0")}`;
      const payloadBytes = synthesizeCueBytes(seed, spec.timelineId, cueId, track);
      cues.push({
        id: cueId,
        track: track as NeutralPerformanceTrackKind,
        startMs,
        endMs: Math.max(startMs + 1, endMs),
        payloadRef: `content-store://you-lab/performance-fixture/${spec.timelineId}/${cueId}`,
        payloadHash: sha256Hex(payloadBytes),
      });
    }
  }
  cues.sort((a, b) => (a.startMs !== b.startMs ? a.startMs - b.startMs : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const durationMs = cues.reduce((max, cue) => Math.max(max, cue.endMs), 0);
  return { id: spec.timelineId, durationMs, cues };
}

/** Deterministic cue payload bytes (pure function of seed + cue identity). */
function synthesizeCueBytes(seed: string, timelineId: string, cueId: string, track: string): Uint8Array {
  const rng = createDeterministicRng(`cue-payload|${seed}|${timelineId}|${cueId}|${track}`);
  const bytes = new Uint8Array(64);
  for (let offset = 0; offset < bytes.length; offset++) {
    bytes[offset] = Math.floor(rng.next() * 256);
  }
  return bytes;
}

export interface RenderBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly spec: SyntheticPerformanceSpec;
  /**
   * Golden: digest over the resolved timeline (byte-identical replay check;
   * sha-256 over the canonical timeline descriptors).
   */
  readonly expectedTimelineDigest: string;
  /** Golden: candidate id -> per-fixture quality score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

// NOTE: expectedTimelineDigest / expectedScores below are golden values
// recorded from the shipped generator + scorer on 2026-10-11 (the seed
// constants and specs are frozen; the goldens replay byte-identically).

export const RENDER_BENCHMARK_FIXTURES: readonly RenderBenchmarkFixture[] = [
  {
    fixtureId: "fixture-render-portrait-cue",
    seed: "w4c-fixture-01",
    spec: { timelineId: "perf-portrait-cue", durationMs: 4000, tracks: ["cue"], cuesPerTrack: 2 },
    expectedTimelineDigest: "eecae7352de7a75f39b2c08055819e6652cd373a03b1d8cacd1b681847630005",
    expectedScores: {
      "mock-render-3d-coarse": 0.9636,
      "mock-render-image-coarse": 0.9548,
      "mock-render-image-precise": 0.9693,
      "mock-render-motion-balanced": 0.9941,
      "mock-render-retarget-balanced": 0.996,
      "mock-render-video-degraded": 0.7346,
      "mock-render-video-full": 0.9818,
      "threejs-rasterization-eval": 0.9553,
    },
  },
  {
    fixtureId: "fixture-render-performance-dense",
    seed: "w4c-fixture-02",
    spec: { timelineId: "perf-dense", durationMs: 9000, tracks: ["motion", "cue", "layer"], cuesPerTrack: 3 },
    expectedTimelineDigest: "5ee17d8674b6f6af473452cdf8e316edf4c8654e7f27295d029b95fc168a0f4c",
    expectedScores: {
      "mock-render-3d-coarse": 0.9602,
      "mock-render-image-coarse": 0.9301,
      "mock-render-image-precise": 0.9714,
      "mock-render-motion-balanced": 0.9965,
      "mock-render-retarget-balanced": 0.9914,
      "mock-render-video-degraded": 0.7251,
      "mock-render-video-full": 0.9761,
      "threejs-rasterization-eval": 1,
    },
  },
  {
    fixtureId: "fixture-render-motion-sparse",
    seed: "w4c-fixture-03",
    spec: { timelineId: "perf-motion-sparse", durationMs: 6000, tracks: ["motion"], cuesPerTrack: 1 },
    expectedTimelineDigest: "f08d359c52d977158e567f583f38c8b882a2bc8da0867d912ad6bcb7c12eaa2c",
    expectedScores: {
      "mock-render-3d-coarse": 0.9661,
      "mock-render-image-coarse": 0.9537,
      "mock-render-image-precise": 0.9774,
      "mock-render-motion-balanced": 0.9894,
      "mock-render-retarget-balanced": 0.1037,
      "mock-render-video-degraded": 0.9954,
      "mock-render-video-full": 0.9829,
      "threejs-rasterization-eval": 0.9527,
    },
  },
];

export const RENDER_FIXTURE_SET_VERSION =
  "w4c-render-benchmark-fixtures/1 (seeded 2026-10-11; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_RENDER_REPORT_RUN_ID = "81d2b048";

/** Resolved performance timeline for a fixture (deterministic). */
export function fixtureTimeline(fixture: RenderBenchmarkFixture): NeutralPerformanceTimeline {
  return synthesizePerformanceTimeline(fixture.seed, fixture.spec);
}

/** Deterministic digest over a resolved timeline (sha-256 of canonical descriptors). */
export function timelineDigest(timeline: NeutralPerformanceTimeline): string {
  return sha256Hex(
    JSON.stringify(
      timeline.cues.map((cue) => ({
        id: cue.id,
        track: cue.track,
        startMs: cue.startMs,
        endMs: cue.endMs,
        payloadRef: cue.payloadRef,
        payloadHash: cue.payloadHash,
      })) as unknown as Record<string, unknown>[],
    ) + `|${timeline.id}|${timeline.durationMs}`,
  );
}
