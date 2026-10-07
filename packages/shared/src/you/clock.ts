// YOU deterministic fixture primitives — injectable clock (docs/you/FIXTURES.md law 3).
//
// Fixture code never reads ambient time. Timestamps are ISO-8601 strings
// produced from a fixed epoch plus a monotonically increasing tick counter,
// so the same sequence of calls always yields the same timestamps.

/** Injectable clock boundary used by every YOU fixture path. */
export interface YouClock {
  /** Next deterministic ISO-8601 timestamp. */
  now(): string;
}

/**
 * Fixed fixture epoch: 2026-01-01T00:00:00.000Z.
 * Computed from constant arguments only (never from ambient time).
 */
export const FIXTURE_CLOCK_EPOCH_MS: number = Date.UTC(2026, 0, 1, 0, 0, 0, 0);

/** Fixed advance per `now()` call (milliseconds). */
export const FIXTURE_CLOCK_STEP_MS = 1000;

export interface DeterministicClock extends YouClock {
  /** Number of `now()` calls issued so far. */
  readonly ticks: number;
}

export interface DeterministicClockOptions {
  readonly epochMs?: number;
  readonly stepMs?: number;
}

/**
 * Creates a deterministic clock. `epochMs` defaults to
 * `FIXTURE_CLOCK_EPOCH_MS`; `stepMs` defaults to `FIXTURE_CLOCK_STEP_MS`.
 * Both must be finite; `stepMs` must be a non-negative integer.
 */
export function createDeterministicClock(options: DeterministicClockOptions = {}): DeterministicClock {
  const epochMs = options.epochMs ?? FIXTURE_CLOCK_EPOCH_MS;
  const stepMs = options.stepMs ?? FIXTURE_CLOCK_STEP_MS;
  if (!Number.isFinite(epochMs)) {
    throw new Error("DeterministicClock requires a finite epochMs");
  }
  if (!Number.isInteger(stepMs) || stepMs < 0) {
    throw new Error("DeterministicClock requires a non-negative integer stepMs");
  }
  let ticks = 0;
  return {
    now(): string {
      const at = epochMs + ticks * stepMs;
      ticks += 1;
      return new Date(at).toISOString();
    },
    get ticks(): number {
      return ticks;
    },
  };
}
