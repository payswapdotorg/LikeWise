// YOU performance timeline machinery (W4A — docs/you/CONTRACTS.md
// "Performance / render", frozen v4 contracts).
//
// A performance is a twin version plus an immutable ordered timeline of
// content-addressed cues. Cue payloads are NEVER inlined in records or
// events: every cue carries an opaque `payloadRef` plus a sha-256
// `payloadHash` binding on the same content-store abstraction as wave-2
// evidence (payloadRef + payloadHash only).
//
// Validation is STATELESS (docs/you/WORK_ORDERS.md W4A: "stateless
// validators, no clock use") and covers, per the frozen acceptance list:
//   - cues content-addressed (payloadRef + sha-256 payloadHash);
//   - ordered by startMs (non-decreasing across the whole cue list);
//   - non-overlapping per track (cues on DIFFERENT tracks may overlap;
//     cues on the SAME track must satisfy previous.endMs <= next.startMs);
//   - endMs > startMs (positive, integral, non-negative millisecond spans);
//   - durationMs consistency (durationMs === the greatest cue endMs).
//
// Every refusal is a typed PerformanceTimelineRefusal; the performance
// application service maps it to the frozen YOU_TIMELINE_INVALID error.
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: cue payload bytes
// are synthesized only from an injected DeterministicRng; the same seed
// produces byte-identical content on every run and platform.

import type { OpaqueId, PerformanceCue, PerformanceTimeline, PerformanceTrackKind } from "./contract.js";
import type { YouIdFactory } from "./ids.js";
import type { YouRng } from "./rng.js";
import { deepFreeze } from "./serialize.js";
import type { EvidenceContentStore } from "./evidenceStore.js";

/** sha-256 hex digest length (64 lowercase hex chars). */
export const SHA256_HEX_LENGTH = 64;

/** True for a well-formed sha-256 hex digest (payloadHash discipline). */
export function isSha256Hex(value: string): boolean {
  return value.length === SHA256_HEX_LENGTH && /^[0-9a-f]+$/.test(value);
}

/** Returns a validation reason for an illegal track kind, or null when legal. */
export function validatePerformanceTrackKind(track: PerformanceTrackKind): string | null {
  if (typeof track !== "string" || track.trim().length === 0) {
    return "track kind must be a non-empty string";
  }
  if (track !== track.trim()) {
    return "track kind must not carry surrounding whitespace";
  }
  return null;
}

/** Returns a validation reason for an illegal millisecond span, or null when legal. */
function validateTimeSpan(startMs: number, endMs: number): string | null {
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs)) {
    return "cue times must be integers (milliseconds)";
  }
  if (startMs < 0 || endMs < 0) {
    return "cue times must be non-negative";
  }
  if (endMs <= startMs) {
    return "endMs must be greater than startMs";
  }
  return null;
}

/** Typed timeline refusal codes (mapped to YOU_TIMELINE_INVALID by the service). */
export type PerformanceTimelineRefusalCode =
  | "empty-timeline"
  | "invalid-cue"
  | "unordered-cues"
  | "track-overlap"
  | "duration-mismatch";

export type PerformanceTimelineRefusal =
  | { readonly ok: false; readonly code: "empty-timeline"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-cue"; readonly detail: string; readonly cueIndex: number }
  | { readonly ok: false; readonly code: "unordered-cues"; readonly detail: string; readonly cueIndex: number }
  | { readonly ok: false; readonly code: "track-overlap"; readonly detail: string; readonly cueIndex: number }
  | { readonly ok: false; readonly code: "duration-mismatch"; readonly detail: string };

/**
 * Stateless structural validation of a performance timeline (no clock, no
 * store, no ambient state). Returns ok, or the FIRST typed refusal in a
 * deterministic single pass: cue shape -> duplicate ids -> global startMs
 * ordering -> per-track overlap -> durationMs consistency.
 */
export function validatePerformanceTimeline(timeline: PerformanceTimeline): { readonly ok: true } | PerformanceTimelineRefusal {
  if (timeline.cues.length === 0) {
    return { ok: false, code: "empty-timeline", detail: "a performance timeline requires at least one cue" };
  }
  const seenIds = new Set<OpaqueId>();
  const lastEndByTrack = new Map<PerformanceTrackKind, number>();
  let previousStartMs: number | null = null;
  let maxEndMs = 0;
  for (let index = 0; index < timeline.cues.length; index += 1) {
    const cue = timeline.cues[index];
    if (cue === undefined) {
      continue;
    }
    if (typeof cue.id !== "string" || cue.id.length === 0) {
      return { ok: false, code: "invalid-cue", detail: `cue ${index}: id must be a non-empty string`, cueIndex: index };
    }
    if (seenIds.has(cue.id)) {
      return { ok: false, code: "invalid-cue", detail: `cue ${index}: duplicate cue id "${cue.id}"`, cueIndex: index };
    }
    seenIds.add(cue.id);
    const trackReason = validatePerformanceTrackKind(cue.track);
    if (trackReason !== null) {
      return { ok: false, code: "invalid-cue", detail: `cue ${index}: ${trackReason}`, cueIndex: index };
    }
    const spanReason = validateTimeSpan(cue.startMs, cue.endMs);
    if (spanReason !== null) {
      return { ok: false, code: "invalid-cue", detail: `cue ${index}: ${spanReason}`, cueIndex: index };
    }
    if (typeof cue.payloadRef !== "string" || cue.payloadRef.length === 0) {
      return { ok: false, code: "invalid-cue", detail: `cue ${index}: payloadRef must be a non-empty string`, cueIndex: index };
    }
    if (!isSha256Hex(cue.payloadHash)) {
      return { ok: false, code: "invalid-cue", detail: `cue ${index}: payloadHash must be a sha-256 hex digest`, cueIndex: index };
    }
    if (previousStartMs !== null && cue.startMs < previousStartMs) {
      return {
        ok: false,
        code: "unordered-cues",
        detail: `cue ${index}: startMs ${cue.startMs} sorts before the previous cue startMs ${previousStartMs}`,
        cueIndex: index,
      };
    }
    previousStartMs = cue.startMs;
    const lastEnd = lastEndByTrack.get(cue.track);
    if (lastEnd !== undefined && cue.startMs < lastEnd) {
      return {
        ok: false,
        code: "track-overlap",
        detail: `cue ${index}: overlaps the previous "${cue.track}" cue (startMs ${cue.startMs} < previous endMs ${lastEnd})`,
        cueIndex: index,
      };
    }
    lastEndByTrack.set(cue.track, cue.endMs);
    maxEndMs = Math.max(maxEndMs, cue.endMs);
  }
  if (!Number.isInteger(timeline.durationMs) || timeline.durationMs < 0) {
    return { ok: false, code: "duration-mismatch", detail: "durationMs must be a non-negative integer" };
  }
  if (timeline.durationMs !== maxEndMs) {
    return {
      ok: false,
      code: "duration-mismatch",
      detail: `durationMs ${timeline.durationMs} must equal the greatest cue endMs ${maxEndMs}`,
    };
  }
  return { ok: true };
}

/** Deterministic canonical cue order: startMs, then endMs, then id. */
export function sortPerformanceCues(cues: readonly PerformanceCue[]): PerformanceCue[] {
  return [...cues].sort((left, right) => {
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }
    if (left.endMs !== right.endMs) {
      return left.endMs - right.endMs;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/**
 * Builds the immutable timeline record from cues: canonical startMs order,
 * durationMs = the greatest cue endMs, deep-frozen. The record is frozen
 * so it can be shared verbatim between a template and instantiated
 * performances (template instantiation copies the timeline VERBATIM).
 */
export function createPerformanceTimeline(
  cues: readonly PerformanceCue[],
  deps: { readonly ids: YouIdFactory },
): PerformanceTimeline {
  const sorted = sortPerformanceCues(cues);
  if (sorted.length === 0) {
    throw new Error("a performance timeline requires at least one cue");
  }
  let durationMs = 0;
  for (const cue of sorted) {
    durationMs = Math.max(durationMs, cue.endMs);
  }
  return deepFreeze({
    id: deps.ids.next("performance-timeline"),
    cues: Object.freeze(sorted),
    durationMs,
  });
}

/**
 * Fixed synthetic cue payload sizes per known track kind (fixture
 * definition — part of the frozen fixture contract; changing any size
 * changes every golden expectation and requires a new fixture version,
 * never an in-place edit).
 */
export const FIXTURE_TRACK_BYTE_LENGTHS: Readonly<Record<string, number>> = {
  cue: 1024,
  layer: 1536,
  motion: 3072,
};

/** Default size for track-kind extensions (fixture definition). */
export const FIXTURE_TRACK_DEFAULT_BYTE_LENGTH = 512;

export function fixtureTrackByteLength(track: PerformanceTrackKind): number {
  return FIXTURE_TRACK_BYTE_LENGTHS[track] ?? FIXTURE_TRACK_DEFAULT_BYTE_LENGTH;
}

/**
 * Deterministic synthetic cue payload bytes (FIXTURES.md laws 1-2, 7:
 * seed-derived only; no PII, no biometric data — synthetic bytes from the
 * injected RNG). The RNG consumption order (4 bytes per nextUint32,
 * little-endian) is part of the frozen fixture definition and mirrors the
 * wave-2 evidence / wave-3 HTIR synthesizers.
 */
export function synthesizeCuePayloadBytes(rng: YouRng, track: PerformanceTrackKind): Uint8Array {
  const length = fixtureTrackByteLength(track);
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += 4) {
    const word = rng.nextUint32();
    const remaining = Math.min(4, length - offset);
    for (let byteIndex = 0; byteIndex < remaining; byteIndex += 1) {
      bytes[offset + byteIndex] = (word >>> (byteIndex * 8)) & 0xff;
    }
  }
  return bytes;
}

export interface PerformanceCueIntake {
  readonly track: PerformanceTrackKind;
  readonly startMs: number;
  readonly endMs: number;
  /**
   * Explicit payload bytes. When omitted, deterministic fixture bytes are
   * synthesized from the injected rng (fixture mode).
   */
  readonly bytes?: Uint8Array;
  /** Injected rng for fixture byte synthesis (required when bytes are omitted). */
  readonly rng?: YouRng;
}

export interface PerformanceCueDeps {
  readonly ids: YouIdFactory;
  /** Wave-2 content-store abstraction: payloadRef + sha-256 payloadHash. */
  readonly store: EvidenceContentStore;
}

/**
 * Constructs one immutable, deep-frozen PerformanceCue. The payload is
 * stored through the wave-2 content store (never inlined); the cue records
 * the opaque `payloadRef` plus the sha-256 `payloadHash` binding.
 */
export function createPerformanceCue(intake: PerformanceCueIntake, deps: PerformanceCueDeps): PerformanceCue {
  const trackReason = validatePerformanceTrackKind(intake.track);
  if (trackReason !== null) {
    throw new Error(`invalid performance track kind: ${trackReason}`);
  }
  const spanReason = validateTimeSpan(intake.startMs, intake.endMs);
  if (spanReason !== null) {
    throw new Error(`invalid performance cue span: ${spanReason}`);
  }
  const bytes =
    intake.bytes ?? (intake.rng !== undefined ? synthesizeCuePayloadBytes(intake.rng, intake.track) : null);
  if (bytes === null) {
    throw new Error("performance cue requires explicit bytes or an injected rng");
  }
  const binding = deps.store.put(bytes);
  return deepFreeze({
    id: deps.ids.next("performance-cue"),
    track: intake.track,
    startMs: intake.startMs,
    endMs: intake.endMs,
    payloadRef: binding.contentRef,
    payloadHash: binding.contentHash,
  });
}

/** Sorted unique track kinds of a cue list (FIXTURES.md law 4: stable ordering). */
export function trackKindsOfCues(cues: readonly PerformanceCue[]): PerformanceTrackKind[] {
  return [...new Set(cues.map((cue) => cue.track))].sort();
}
