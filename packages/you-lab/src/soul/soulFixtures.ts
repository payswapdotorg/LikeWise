// Deterministic soul benchmark fixtures (W7C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a seeded synthetic routed
// prompt scenario spec (a routing profile — system-one fast or system-two
// deep — a requested-modality set and a count of content-addressed context
// refs) and golden expectations over the intended response content. The
// soul invocation is the binding (seed-derived) + the routed prompt context.
// Golden expectations are recorded values (computed once by the shipped
// generator/scorer and embedded on 2026-10-12); an intentional change to any
// golden is a NEW fixture version with provenance — never an in-place edit.
// No clock, no randomness beyond the seeded rng, no network.

import { fnv1a32 } from "../determinism.js";
import {
  sha256Hex,
  type NeutralSoulBinding,
  type NeutralSoulModality,
  type NeutralSoulRoutingProfile,
} from "./soulAdapterSeam.js";

/** Spec of a seeded synthetic routed prompt scenario. */
export interface SyntheticSoulScenarioSpec {
  /** The route this invocation takes (system-one fast / system-two deep). */
  readonly routingProfile: NeutralSoulRoutingProfile;
  /** The output modalities the invocation requests (cycled across context refs). */
  readonly requestedModalities: readonly NeutralSoulModality[];
  /** Content-addressed context refs synthesized for the scenario (>= 1). */
  readonly contextRefCount: number;
}

/** A seeded synthetic routed prompt scenario (binding + prompt context, deterministic). */
export interface SoulScenario {
  readonly binding: NeutralSoulBinding;
  readonly prompt: {
    readonly id: string;
    readonly routingProfile: NeutralSoulRoutingProfile;
    readonly systemDirective: string;
    readonly contextRefs: readonly string[];
    readonly taskPrompt: string;
    readonly requestedModalities: readonly NeutralSoulModality[];
  };
}

/**
 * Synthesize a deterministic routed prompt scenario for (seed, spec): the
 * binding is seed-derived (you_soul-binding_<16hex>, provider-neutral
 * binding with the scenario route and a seed-derived model ref); every
 * context ref is content-addressed (you_content_<16hex>, the wave-2 ref
 * format) — a pure function of (seed, context index).
 */
export function synthesizeSoulScenario(seed: string, spec: SyntheticSoulScenarioSpec): SoulScenario {
  if (spec.contextRefCount < 1) throw new Error("synthesizeSoulScenario: contextRefCount must be >= 1");
  if (spec.requestedModalities.length === 0) throw new Error("synthesizeSoulScenario: requestedModalities must be non-empty");
  const bindingId = `you_soul-binding_${sha256Hex(`soul-binding|${seed}`).slice(0, 16)}`;
  const contextRefs: string[] = [];
  for (let index = 0; index < spec.contextRefCount; index++) {
    contextRefs.push(`you_content_${sha256Hex(`soul-context|${seed}|${index}`).slice(0, 16)}`);
  }
  return {
    binding: {
      id: bindingId,
      providerKind: "you-lab-fixture-provider",
      modelRef: `fixture-model-${fnv1a32(seed)}`,
      routingProfile: spec.routingProfile,
      capabilities: ["text-generation", "routed-prompt"],
    },
    prompt: {
      id: `prompt-${fnv1a32(`prompt|${seed}`)}`,
      routingProfile: spec.routingProfile,
      systemDirective: "You are a fixture-mode soul under a routed prompt (deterministic scenario).",
      contextRefs,
      taskPrompt: `Address every context ref of scenario ${seed} under the ${spec.routingProfile} route.`,
      requestedModalities: spec.requestedModalities,
    },
  };
}

export interface SoulBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly scenarioSpec: SyntheticSoulScenarioSpec;
  /**
   * Golden: digest over the intended response content (byte-identical
   * replay check; sha-256 over the canonical intended entries under the
   * scenario route).
   */
  readonly expectedIntendedResponseDigest: string;
  /** Golden: candidate id -> per-fixture soul-fidelity score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

// NOTE: expectedIntendedResponseDigest / expectedScores below are golden
// values recorded from the shipped generator + scorer on 2026-10-12 (the
// seed constants and specs are frozen; the goldens replay byte-identically).

export const SOUL_BENCHMARK_FIXTURES: readonly SoulBenchmarkFixture[] = [
  {
    fixtureId: "fixture-soul-quick-reply",
    seed: "w7c-fixture-01",
    scenarioSpec: {
      routingProfile: "system-one",
      requestedModalities: ["text"],
      contextRefCount: 4,
    },
    expectedIntendedResponseDigest: "7de1c3870a17feb34f8eb3cb005da1bdedc1498ce0bb729bc86edd5e8aecaa6a",
    expectedScores: {
      "mock-soul-serving-precise": 1,
      "mock-soul-serving-coarse": 0.7833,
      "mock-soul-vlm-balanced": 0.9333,
      "mock-soul-vlm-lossy": 0.9333,
      "mock-soul-routing-faithful": 1,
      "mock-soul-routing-lossy": 0.9333,
      "llama-cpp-soul-eval": 1,
    },
  },
  {
    fixtureId: "fixture-soul-deep-analysis",
    seed: "w7c-fixture-02",
    scenarioSpec: {
      routingProfile: "system-two",
      requestedModalities: ["text", "image"],
      contextRefCount: 7,
    },
    expectedIntendedResponseDigest: "b3996332959a3e3ed639b99de1bfc30b186299067b939c7a9ea0b33df14e053f",
    expectedScores: {
      "mock-soul-serving-precise": 1,
      "mock-soul-serving-coarse": 0.7619,
      "mock-soul-vlm-balanced": 0.9333,
      "mock-soul-vlm-lossy": 0.8254,
      "mock-soul-routing-faithful": 1,
      "mock-soul-routing-lossy": 0.7619,
      "llama-cpp-soul-eval": 1,
    },
  },
  {
    fixtureId: "fixture-soul-multimodal-session",
    seed: "w7c-fixture-03",
    scenarioSpec: {
      routingProfile: "system-two",
      requestedModalities: ["text", "image"],
      contextRefCount: 10,
    },
    expectedIntendedResponseDigest: "1a63b7f6504a22d336658db1f9935f027ab874037eb4d7ef44899b879fb002b6",
    expectedScores: {
      "mock-soul-serving-precise": 1,
      "mock-soul-serving-coarse": 0.6333,
      "mock-soul-vlm-balanced": 0.8733,
      "mock-soul-vlm-lossy": 0.7717,
      "mock-soul-routing-faithful": 1,
      "mock-soul-routing-lossy": 0.8133,
      "llama-cpp-soul-eval": 1,
    },
  },
];

export const SOUL_FIXTURE_SET_VERSION =
  "w7c-soul-benchmark-fixtures/1 (seeded 2026-10-12; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_SOUL_REPORT_RUN_ID = "4976b516";

/** Resolved routed prompt scenario for a fixture (deterministic). */
export function fixtureScenario(fixture: SoulBenchmarkFixture): SoulScenario {
  return synthesizeSoulScenario(fixture.seed, fixture.scenarioSpec);
}
