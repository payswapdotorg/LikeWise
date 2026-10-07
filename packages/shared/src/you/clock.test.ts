import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock, FIXTURE_CLOCK_EPOCH_MS } from "./clock.js";

test("DeterministicClock advances ISO-8601 timestamps from the fixed epoch", () => {
  const clock = createDeterministicClock();
  assert.equal(clock.now(), "2026-01-01T00:00:00.000Z");
  assert.equal(clock.now(), "2026-01-01T00:00:01.000Z");
  assert.equal(clock.now(), "2026-01-01T00:00:02.000Z");
  assert.equal(clock.ticks, 3);
});

test("DeterministicClock sequences are reproducible across instances", () => {
  const first = createDeterministicClock();
  const second = createDeterministicClock();
  const sequenceA = [first.now(), first.now(), first.now(), first.now()];
  const sequenceB = [second.now(), second.now(), second.now(), second.now()];
  assert.deepEqual(sequenceA, sequenceB);
});

test("DeterministicClock honors custom epoch and step", () => {
  const clock = createDeterministicClock({ epochMs: Date.UTC(2026, 5, 1), stepMs: 60000 });
  assert.equal(clock.now(), "2026-06-01T00:00:00.000Z");
  assert.equal(clock.now(), "2026-06-01T00:01:00.000Z");
});

test("DeterministicClock rejects invalid options", () => {
  assert.throws(() => createDeterministicClock({ stepMs: -1 }));
  assert.throws(() => createDeterministicClock({ stepMs: 1.5 }));
  assert.throws(() => createDeterministicClock({ epochMs: Number.NaN }));
});

test("FIXTURE_CLOCK_EPOCH_MS is the documented 2026-01-01T00:00:00.000Z epoch", () => {
  assert.equal(new Date(FIXTURE_CLOCK_EPOCH_MS).toISOString(), "2026-01-01T00:00:00.000Z");
});
