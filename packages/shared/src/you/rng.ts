// YOU deterministic fixture primitives — seeded RNG (docs/you/FIXTURES.md laws 1-2).
//
// Fixture code never calls Math.random. All randomness flows through an
// injected seeded generator (splitmix32: 32-bit integer state, no
// platform-dependent floating point behaviour in the state transition).

/** Injectable RNG boundary used by every YOU fixture path. */
export interface YouRng {
  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number;
  /** Next float in [0, 1). */
  nextFloat(): number;
  /** Next float in [min, max). */
  floatInRange(min: number, max: number): number;
  /** Next integer in [min, max] (inclusive). */
  intInRange(min: number, max: number): number;
  /** Deterministically picks one item from a non-empty list. */
  pick<T>(items: readonly T[]): T;
}

/** 2^32, expressed as a float for the [0, 1) conversion. */
const TWO_POW_32 = 4294967296;

/**
 * Deterministic splitmix32 generator. The same seed always produces the
 * same sequence on every platform (pure 32-bit integer arithmetic).
 */
export function createDeterministicRng(seed: number): YouRng {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x9e3779b9) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
    mixed = (mixed ^ (mixed >>> 15)) >>> 0;
    return mixed;
  };
  const intInRange = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new Error("DeterministicRng.intInRange requires integers with min <= max");
    }
    return min + (nextUint32() % (max - min + 1));
  };
  return {
    nextUint32,
    nextFloat: () => nextUint32() / TWO_POW_32,
    floatInRange: (min: number, max: number) => min + (max - min) * (nextUint32() / TWO_POW_32),
    intInRange,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("DeterministicRng.pick requires a non-empty list");
      }
      const chosen = items[intInRange(0, items.length - 1)];
      if (chosen === undefined) {
        throw new Error("DeterministicRng.pick failed to resolve an item");
      }
      return chosen;
    },
  };
}

/**
 * FNV-1a 32-bit hash of a string, used to derive numeric fixture seeds
 * from stable text (e.g. intent text). Deterministic across platforms.
 */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Hex representation of a 32-bit unsigned integer, zero-padded to 8 chars. */
export function uint32ToHex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}
