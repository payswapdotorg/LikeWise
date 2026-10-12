// Deterministic learning benchmark fixtures (W6C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a seeded synthetic
// takeover-trajectory spec (an ordered sequence of captured learning
// signals — the head is the triggering manual-takeover signal, the trailing
// signals are the takeover context) and golden expectations over the
// intended learned content. The learning invocation's signal is the
// trajectory head carrying the union of the trajectory's content-addressed
// evidence refs (evidence is never inlined — the refs address the wave-2
// content store). Golden expectations are recorded values (computed once by
// the shipped generator/scorer and embedded on 2026-10-12); an intentional
// change to any golden is a NEW fixture version with provenance — never an
// in-place edit. No clock, no randomness beyond the seeded rng, no network.

import { createDeterministicRng } from "../capture/deterministicRng.js";
import { fnv1a32, sortedUnique } from "../determinism.js";
import { sha256Hex, type NeutralLearningSignal, type NeutralLearningScope, type NeutralLearningSignalKind } from "./learningAdapterSeam.js";

/** Spec of a seeded synthetic takeover trajectory. */
export interface SyntheticTrajectorySpec {
  /** Number of signals in the trajectory (>= 2; signal 0 is the triggering manual-takeover head). */
  readonly signalCount: number;
  /** Kinds cycled across the trailing trajectory signals (the takeover context). */
  readonly trailingKinds: readonly NeutralLearningSignalKind[];
  /** Scopes cycled across the trajectory signals (signal 0's scope is the candidate scope of the run). */
  readonly scopes: readonly NeutralLearningScope[];
  /** Content-addressed evidence refs synthesized per trajectory signal. */
  readonly evidencePerSignal: number;
}

/** One captured signal inside a seeded synthetic takeover trajectory. */
export interface TrajectorySignal {
  readonly id: string;
  readonly kind: NeutralLearningSignalKind;
  readonly scope: NeutralLearningScope;
  readonly subjectRef: string | null;
  readonly evidenceRefs: readonly string[];
  readonly capturedAt: string;
  readonly simulated: true;
}

/**
 * Synthesize a deterministic takeover trajectory for (seed, spec): the head
 * signal is the triggering manual takeover; trailing signal kinds are drawn
 * from the spec's kind pool by the salted rng stream (`takeover|${seed}`);
 * scopes cycle the spec's scopes; every signal carries the spec's count of
 * content-addressed evidence refs (you_content_<16hex>, the wave-2 ref
 * format) and a deterministic capturedAt minute slot.
 */
export function synthesizeTakeoverTrajectory(
  seed: string,
  spec: SyntheticTrajectorySpec,
): readonly TrajectorySignal[] {
  if (spec.signalCount < 2) throw new Error("synthesizeTakeoverTrajectory: signalCount must be >= 2");
  if (spec.evidencePerSignal < 1) throw new Error("synthesizeTakeoverTrajectory: evidencePerSignal must be >= 1");
  const rng = createDeterministicRng(`takeover|${seed}`);
  const subjectRef = `art-takeover-${fnv1a32(seed)}`;
  const signals: TrajectorySignal[] = [];
  for (let index = 0; index < spec.signalCount; index++) {
    const kind: NeutralLearningSignalKind =
      index === 0
        ? "manual-takeover"
        : (spec.trailingKinds[Math.floor(rng.next() * spec.trailingKinds.length)] ?? "feedback");
    const scope = spec.scopes[index % spec.scopes.length] ?? "USER";
    const evidenceRefs: string[] = [];
    for (let evidence = 0; evidence < spec.evidencePerSignal; evidence++) {
      // Content-addressed evidence ref (the wave-2 you_content_<16hex>
      // format) — a pure function of (seed, signal index, evidence index).
      evidenceRefs.push(
        `you_content_${sha256Hex(`learning-evidence|${seed}|${index}|${evidence}`).slice(0, 16)}`,
      );
    }
    signals.push({
      id: `sig-${String(index).padStart(2, "0")}`,
      kind,
      scope,
      subjectRef,
      evidenceRefs,
      capturedAt: trajectoryTimestamp(index),
      simulated: true,
    });
  }
  return signals;
}

/** Deterministic capturedAt slot for a trajectory signal (base 09:00 UTC + 5 minutes per signal, integer arithmetic only). */
function trajectoryTimestamp(index: number): string {
  const totalMinutes = index * 5;
  const hour = 9 + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `2026-10-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;
}

/**
 * The learning-invocation signal of a trajectory: the head takeover signal
 * carrying the union of the whole trajectory's evidence refs (sorted —
 * stable ordering; evidence is referenced, never inlined).
 */
export function trajectoryInvocationSignal(trajectory: readonly TrajectorySignal[]): NeutralLearningSignal {
  const head = trajectory[0];
  if (!head) throw new Error("trajectoryInvocationSignal: trajectory is empty");
  return {
    ...head,
    evidenceRefs: sortedUnique(trajectory.flatMap((signal) => signal.evidenceRefs)),
  };
}

export interface LearningBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly trajectorySpec: SyntheticTrajectorySpec;
  /**
   * Golden: digest over the intended learned content (byte-identical
   * replay check; sha-256 over the canonical intended entries).
   */
  readonly expectedIntendedLearningDigest: string;
  /** Golden: candidate id -> per-fixture learning-fidelity score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

// NOTE: expectedIntendedLearningDigest / expectedScores below are golden
// values recorded from the shipped generator + scorer on 2026-10-12 (the
// seed constants and specs are frozen; the goldens replay byte-identically).

export const LEARNING_BENCHMARK_FIXTURES: readonly LearningBenchmarkFixture[] = [
  {
    fixtureId: "fixture-learn-takeover-minimal",
    seed: "w6c-fixture-01",
    trajectorySpec: {
      signalCount: 4,
      trailingKinds: ["feedback", "edit-session", "repeated-intent"],
      scopes: ["USER", "PROJECT", "TENANT", "USER"],
      evidencePerSignal: 2,
    },
    expectedIntendedLearningDigest: "55db411b07bef5f7fc065dd1f788731b6755b911cc8aa7c67e9084fb766e30c3",
    expectedScores: {
      "mock-learning-org-precise": 1,
      "mock-learning-org-coarse": 0.825,
      "mock-learning-selection-balanced": 0.9,
      "mock-learning-selection-lossy": 0.575,
      "mock-learning-pipeline-faithful": 0.825,
      "mock-learning-pipeline-lossy": 0.575,
      "vowpal-wabbit-learning-eval": 1,
    },
  },
  {
    fixtureId: "fixture-learn-org-mixed",
    seed: "w6c-fixture-02",
    trajectorySpec: {
      signalCount: 7,
      trailingKinds: ["feedback", "expert-intervention", "repeated-intent", "capability-gap", "edit-session", "edit-session"],
      scopes: ["TENANT", "PROJECT", "USER", "TENANT", "PROJECT", "USER", "TENANT"],
      evidencePerSignal: 3,
    },
    expectedIntendedLearningDigest: "e913743e921b2097af882a8001056e94e6f43f553bfe42c0978aed6bff044274",
    expectedScores: {
      "mock-learning-org-precise": 1,
      "mock-learning-org-coarse": 0.6429,
      "mock-learning-selection-balanced": 0.8714,
      "mock-learning-selection-lossy": 0.6286,
      "mock-learning-pipeline-faithful": 0.8429,
      "mock-learning-pipeline-lossy": 0.5714,
      "vowpal-wabbit-learning-eval": 1,
    },
  },
  {
    fixtureId: "fixture-learn-pipeline-heavy",
    seed: "w6c-fixture-03",
    trajectorySpec: {
      signalCount: 10,
      trailingKinds: ["edit-session", "repeated-intent", "capability-gap"],
      scopes: ["APPLICATION", "PROJECT", "TENANT", "USER", "TASK", "APPLICATION", "PROJECT", "TENANT", "USER", "TASK"],
      evidencePerSignal: 4,
    },
    expectedIntendedLearningDigest: "807c7a5815fafd601b95b435af8f2063d7542208bd883878c3b4f4bab4cdda25",
    expectedScores: {
      "mock-learning-org-precise": 1,
      "mock-learning-org-coarse": 0.75,
      "mock-learning-selection-balanced": 0.84,
      "mock-learning-selection-lossy": 0.5938,
      "mock-learning-pipeline-faithful": 0.795,
      "mock-learning-pipeline-lossy": 0.53,
      "vowpal-wabbit-learning-eval": 1,
    },
  },
];

export const LEARNING_FIXTURE_SET_VERSION =
  "w6c-learning-benchmark-fixtures/1 (seeded 2026-10-12; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_LEARNING_REPORT_RUN_ID = "595c8561";

/** Resolved takeover trajectory for a fixture (deterministic). */
export function fixtureTrajectory(
  fixture: LearningBenchmarkFixture,
): readonly TrajectorySignal[] {
  return synthesizeTakeoverTrajectory(fixture.seed, fixture.trajectorySpec);
}

/** Resolved learning-invocation signal for a fixture (deterministic). */
export function fixtureInvocationSignal(fixture: LearningBenchmarkFixture): NeutralLearningSignal {
  return trajectoryInvocationSignal(fixtureTrajectory(fixture));
}
