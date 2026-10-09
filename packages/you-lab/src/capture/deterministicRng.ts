// Deterministic RNG primitives for the W2C capture path.
//
// Laws (docs/you/FIXTURES.md): no Math.random / Date.now / performance.now /
// network anywhere in the capture path. This module provides a seeded
// mulberry32 stream (integer arithmetic only, platform-independent) plus a
// hash-derived scalar used for per-item derivations (e.g. per-block dropout in
// the mock adapters), so every value is a pure function of its key.

import { fnv1a32 } from "../determinism.js";

/** String seed -> 32-bit unsigned int (FNV-1a numeric core, integer ops only). */
export function seedToUint32(seed: string): number {
  return parseInt(fnv1a32(seed), 16);
}

/** Seeded RNG (mulberry32; same seed => identical sequence everywhere). */
export interface DeterministicRng {
  /** Next uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Create a seeded deterministic RNG. */
export function createDeterministicRng(seed: string): DeterministicRng {
  let state = seedToUint32(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}

/**
 * Hash-derived uniform in [0, 1): a pure function of the joined key parts.
 * Used for per-item derivations (block dropout, landmark jitter) so results
 * never depend on iteration order or shared mutable stream state.
 */
export function unitFrom(...parts: readonly string[]): number {
  const rng = createDeterministicRng(parts.join("|"));
  return rng.next();
}
