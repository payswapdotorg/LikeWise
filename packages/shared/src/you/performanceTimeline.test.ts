import assert from "node:assert/strict";
import test from "node:test";
import type { PerformanceCue, PerformanceTimeline } from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";
import { createDeterministicRng, seedFromString } from "./rng.js";
import { stableStringify } from "./serialize.js";
import {
  createPerformanceCue,
  createPerformanceTimeline,
  fixtureTrackByteLength,
  isSha256Hex,
  sortPerformanceCues,
  synthesizeCuePayloadBytes,
  trackKindsOfCues,
  validatePerformanceTimeline,
} from "./performanceTimeline.js";

const STORE = createFixtureEvidenceContentStore();

function cue(overrides: Partial<PerformanceCue> = {}): PerformanceCue {
  const binding = STORE.put(synthesizeCuePayloadBytes(createDeterministicRng(seedFromString(`cue:${overrides.id ?? "c"}`)), "motion"));
  return {
    id: overrides.id ?? "you_performance-cue_0000000000000001",
    track: overrides.track ?? "motion",
    startMs: overrides.startMs ?? 0,
    endMs: overrides.endMs ?? 1000,
    payloadRef: overrides.payloadRef ?? binding.contentRef,
    payloadHash: overrides.payloadHash ?? binding.contentHash,
  };
}

function timeline(cues: readonly PerformanceCue[], durationMs: number = Number.MAX_SAFE_INTEGER): PerformanceTimeline {
  return {
    id: "you_performance-timeline_0000000000000001",
    cues,
    durationMs: durationMs === Number.MAX_SAFE_INTEGER ? Math.max(...cues.map((entry) => entry.endMs), 0) : durationMs,
  };
}

test("a valid multi-track timeline passes stateless validation", () => {
  const valid = timeline([cue({ id: "c1", track: "motion", startMs: 0, endMs: 2000 }), cue({ id: "c2", track: "cue", startMs: 500, endMs: 1500 }), cue({ id: "c3", track: "layer", startMs: 2000, endMs: 4000 })]);
  assert.deepEqual(validatePerformanceTimeline(valid), { ok: true });
});

test("cues on different tracks may overlap; cues on one track may not", () => {
  // Different-track overlap is legal.
  const crossTrack = timeline([cue({ id: "c1", track: "motion", startMs: 0, endMs: 2000 }), cue({ id: "c2", track: "cue", startMs: 1000, endMs: 3000 })]);
  assert.deepEqual(validatePerformanceTimeline(crossTrack), { ok: true });

  // Same-track overlap is the typed track-overlap refusal.
  const overlap = timeline([cue({ id: "c1", track: "motion", startMs: 0, endMs: 2000 }), cue({ id: "c2", track: "motion", startMs: 1000, endMs: 3000 })]);
  const refused = validatePerformanceTimeline(overlap);
  assert.ok(!refused.ok);
  assert.equal(refused.code, "track-overlap");
  assert.equal(refused.cueIndex, 1);

  // Back-to-back (touching, not overlapping) cues on one track are legal.
  const touching = timeline([cue({ id: "c1", track: "motion", startMs: 0, endMs: 2000 }), cue({ id: "c2", track: "motion", startMs: 2000, endMs: 3000 })]);
  assert.deepEqual(validatePerformanceTimeline(touching), { ok: true });
});

test("an empty timeline is the typed empty-timeline refusal", () => {
  const refused = validatePerformanceTimeline(timeline([], 0));
  assert.ok(!refused.ok);
  assert.equal(refused.code, "empty-timeline");
});

test("cue shape violations are typed invalid-cue refusals", () => {
  const cases: readonly { readonly name: string; readonly cue: PerformanceCue; readonly detail: string }[] = [
    { name: "empty id", cue: cue({ id: "" }), detail: "id" },
    { name: "empty track", cue: cue({ track: "" }), detail: "track" },
    { name: "whitespace track", cue: cue({ track: " motion " }), detail: "whitespace" },
    { name: "endMs equals startMs", cue: cue({ startMs: 100, endMs: 100 }), detail: "greater" },
    { name: "endMs before startMs", cue: cue({ startMs: 200, endMs: 100 }), detail: "greater" },
    { name: "negative startMs", cue: cue({ startMs: -1, endMs: 100 }), detail: "non-negative" },
    { name: "non-integer times", cue: cue({ startMs: 0.5, endMs: 100 }), detail: "integers" },
    { name: "empty payloadRef", cue: cue({ payloadRef: "" }), detail: "payloadRef" },
    { name: "short payloadHash", cue: cue({ payloadHash: "abcd" }), detail: "sha-256" },
    { name: "non-hex payloadHash", cue: cue({ payloadHash: "z".repeat(64) }), detail: "sha-256" },
  ];
  for (const entry of cases) {
    const refused = validatePerformanceTimeline(timeline([entry.cue]));
    assert.ok(!refused.ok, entry.name);
    assert.equal(refused.code, "invalid-cue", entry.name);
    assert.ok(refused.detail.includes(entry.detail), `${entry.name}: ${refused.detail}`);
  }

  const duplicate = validatePerformanceTimeline(timeline([cue({ id: "same" }), cue({ id: "same", startMs: 2000, endMs: 3000 })]));
  assert.ok(!duplicate.ok);
  assert.equal(duplicate.code, "invalid-cue");
  assert.ok(duplicate.detail.includes("duplicate"));
});

test("cue ids are unique across the whole timeline, not per track", () => {
  const refused = validatePerformanceTimeline(timeline([cue({ id: "same", track: "motion" }), cue({ id: "same", track: "layer", startMs: 2000, endMs: 3000 })]));
  assert.ok(!refused.ok);
  assert.equal(refused.code, "invalid-cue");
});

test("cues must be ordered by startMs (unordered-cues refusal)", () => {
  const unordered = timeline([cue({ id: "c2", startMs: 2000, endMs: 3000 }), cue({ id: "c1", startMs: 0, endMs: 1000 })]);
  const refused = validatePerformanceTimeline(unordered);
  assert.ok(!refused.ok);
  assert.equal(refused.code, "unordered-cues");
  assert.equal(refused.cueIndex, 1);

  // Equal startMs is allowed (non-decreasing); different tracks keep it legal.
  const equalStart = timeline([cue({ id: "c1", track: "motion", startMs: 0, endMs: 1000 }), cue({ id: "c2", track: "cue", startMs: 0, endMs: 500 })]);
  assert.deepEqual(validatePerformanceTimeline(equalStart), { ok: true });
});

test("durationMs must equal the greatest cue endMs (duration-mismatch refusal)", () => {
  const tooShort = validatePerformanceTimeline(timeline([cue({ startMs: 0, endMs: 2000 })], 1000));
  assert.ok(!tooShort.ok);
  assert.equal(tooShort.code, "duration-mismatch");

  const tooLong = validatePerformanceTimeline(timeline([cue({ startMs: 0, endMs: 2000 })], 2500));
  assert.ok(!tooLong.ok);
  assert.equal(tooLong.code, "duration-mismatch");

  const nonInteger = validatePerformanceTimeline(timeline([cue({ startMs: 0, endMs: 2000 })], 2000.5));
  assert.ok(!nonInteger.ok);
  assert.equal(nonInteger.code, "duration-mismatch");
});

test("validators are stateless: no clock or store is touched (pure functions)", () => {
  // A hand-built timeline with fabricated refs validates purely; nothing
  // resolves against any store and no timestamp is produced.
  const handBuilt = timeline([{ id: "c1", track: "extension-track", startMs: 0, endMs: 10, payloadRef: "ref", payloadHash: "a".repeat(64) }], 10);
  assert.deepEqual(validatePerformanceTimeline(handBuilt), { ok: true });
});

test("createPerformanceTimeline orders cues canonically and derives durationMs", () => {
  const ids = createRngIdFactory(createDeterministicRng(0x5eed_0001));
  const store = createFixtureEvidenceContentStore();
  const built = createPerformanceTimeline(
    [
      createPerformanceCue({ track: "layer", startMs: 4000, endMs: 5000, rng: createDeterministicRng(1) }, { ids, store }),
      createPerformanceCue({ track: "motion", startMs: 0, endMs: 2000, rng: createDeterministicRng(2) }, { ids, store }),
      createPerformanceCue({ track: "cue", startMs: 2000, endMs: 4000, rng: createDeterministicRng(3) }, { ids, store }),
    ],
    { ids },
  );
  assert.deepEqual(
    built.cues.map((entry) => entry.track),
    ["motion", "cue", "layer"],
  );
  assert.equal(built.durationMs, 5000);
  assert.deepEqual(validatePerformanceTimeline(built), { ok: true });
  assert.ok(Object.isFrozen(built));
  assert.ok(Object.isFrozen(built.cues));
  assert.ok(built.cues.every((entry) => Object.isFrozen(entry)));

  assert.throws(() => createPerformanceTimeline([], { ids }), /at least one cue/);
});

test("createPerformanceCue stores payload bytes and records the content-addressed binding", () => {
  const ids = createRngIdFactory(createDeterministicRng(0x5eed_0002));
  const store = createFixtureEvidenceContentStore();
  const rng = createDeterministicRng(seedFromString("timeline-cue-test"));
  const made = createPerformanceCue({ track: "motion", startMs: 0, endMs: 500, rng }, { ids, store });
  assert.ok(made.id.startsWith("you_performance-cue_"));
  assert.ok(store.has(made.payloadRef));
  assert.equal(made.payloadHash.length, 64);
  assert.ok(isSha256Hex(made.payloadHash));
  assert.ok(Object.isFrozen(made));

  assert.throws(() => createPerformanceCue({ track: "motion", startMs: 100, endMs: 100, rng }, { ids, store }), /greater than startMs/);
  assert.throws(() => createPerformanceCue({ track: " ", startMs: 0, endMs: 100, rng }, { ids, store }), /track kind/);
  assert.throws(() => createPerformanceCue({ track: "motion", startMs: 0, endMs: 100 }, { ids, store }), /explicit bytes or an injected rng/);
});

test("fixture cue payload synthesis is deterministic and track-sized", () => {
  const first = synthesizeCuePayloadBytes(createDeterministicRng(seedFromString("cue-bytes")), "motion");
  const second = synthesizeCuePayloadBytes(createDeterministicRng(seedFromString("cue-bytes")), "motion");
  assert.deepEqual(first, second);
  assert.equal(first.byteLength, fixtureTrackByteLength("motion"));
  assert.equal(fixtureTrackByteLength("motion"), 3072);
  assert.equal(fixtureTrackByteLength("cue"), 1024);
  assert.equal(fixtureTrackByteLength("layer"), 1536);
  assert.equal(fixtureTrackByteLength("extension-track"), 512);
  const different = synthesizeCuePayloadBytes(createDeterministicRng(seedFromString("cue-bytes-other")), "motion");
  assert.notDeepEqual(first, different);
});

test("sortPerformanceCues is the canonical (startMs, endMs, id) order", () => {
  const a = cue({ id: "a", startMs: 0, endMs: 100 });
  const b = cue({ id: "b", startMs: 0, endMs: 50 });
  const c = cue({ id: "c", startMs: 50, endMs: 60 });
  assert.deepEqual(
    sortPerformanceCues([c, a, b]).map((entry) => entry.id),
    ["b", "a", "c"],
  );
  // Stable for fully-tied cues (id decides).
  assert.deepEqual(
    sortPerformanceCues([cue({ id: "z", startMs: 0, endMs: 1 }), cue({ id: "y", startMs: 0, endMs: 1 })]).map((entry) => entry.id),
    ["y", "z"],
  );
});

test("trackKindsOfCues returns the sorted unique track set", () => {
  const kinds = trackKindsOfCues([cue({ track: "layer" }), cue({ track: "motion" }), cue({ track: "layer", startMs: 2000, endMs: 3000 })]);
  assert.deepEqual(kinds, ["layer", "motion"]);
});

test("timeline records serialize deterministically (stable canonical form)", () => {
  const build = () => {
    const ids = createRngIdFactory(createDeterministicRng(0x5eed_0003));
    const store = createFixtureEvidenceContentStore();
    return createPerformanceTimeline(
      [
        createPerformanceCue({ track: "motion", startMs: 0, endMs: 1000, rng: createDeterministicRng(7) }, { ids, store }),
        createPerformanceCue({ track: "cue", startMs: 1000, endMs: 2000, rng: createDeterministicRng(8) }, { ids, store }),
      ],
      { ids },
    );
  };
  assert.equal(stableStringify(build()), stableStringify(build()));
});
