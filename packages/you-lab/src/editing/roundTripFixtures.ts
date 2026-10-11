// Deterministic round-trip benchmark fixtures (W5C) — docs/you/FIXTURES.md.
//
// Every fixture declares a stable seed constant, a synthetic subject
// artifact (seeded neutral canonical state: entities with transforms and
// attributes over a fixed environment) and a seeded synthetic edit payload
// spec (scale edits, added entities, removed entities, environment edits).
// Golden expectations are recorded values (computed once by the shipped
// generator/scorer and embedded on 2026-10-11); an intentional change to
// any golden is a NEW fixture version with provenance — never an in-place
// edit. No clock, no randomness beyond the seeded rng, no network.

import { createDeterministicRng } from "../capture/deterministicRng.js";
import type { NeutralEntity, NeutralEnvironment } from "../adapters/editorAdapterSeam.js";
import { sha256Hex, type NeutralEditPlan } from "./editingAdapterSeam.js";

/** Spec of a synthetic subject artifact (seeded neutral canonical state). */
export interface SyntheticSubjectSpec {
  /** Number of entities in the subject state (>= 2). */
  readonly entityCount: number;
  /** Entity kinds cycled deterministically. */
  readonly entityKinds: readonly string[];
}

/** Spec of a seeded synthetic edit payload applied on top of the subject. */
export interface SyntheticEditSpec {
  /** Number of scale edits (distinct entities, seeded). */
  readonly scaleEditCount: number;
  /** Number of added entities (seeded). */
  readonly addedEntityCount: number;
  /** Number of removed entities (seeded). */
  readonly removedEntityCount: number;
  /** Whether an environment edit is part of the payload. */
  readonly environmentEdit: boolean;
}

/**
 * Synthesize a deterministic subject artifact content for (seed, spec):
 * entity ids/labels/transforms/attributes are drawn from the seeded rng;
 * the canonical state shape is the W1C neutral shape (entities sorted by id,
 * fixed environment).
 */
export function synthesizeSubjectState(
  seed: string,
  spec: SyntheticSubjectSpec,
): { entities: NeutralEntity[]; environment: NeutralEnvironment } {
  if (spec.entityCount < 2) throw new Error("synthesizeSubjectState: entityCount must be >= 2");
  const rng = createDeterministicRng(`subject|${seed}`);
  const entities: NeutralEntity[] = [];
  for (let index = 0; index < spec.entityCount; index++) {
    const kind = spec.entityKinds[index % spec.entityKinds.length] ?? "prop";
    entities.push({
      id: `ent-${String(index).padStart(2, "0")}`,
      kind,
      label: `Fixture ${kind} ${index}`,
      transform: {
        position: [round2(rng.next() * 4 - 2), round2(rng.next() * 4 - 2), round2(rng.next() * 4 - 2)],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      attributes: { fixture: true, seeded: true },
    });
  }
  return {
    entities,
    environment: { keyLightDirection: [0.5, -1, 0.25], ambientIntensity: 0.4, background: "#101418" },
  };
}

/**
 * Synthesize a deterministic edit payload for (seed, spec, entities): scale
 * multipliers, added entities, removed entity ids and an optional
 * environment edit — all drawn from the seeded rng over the subject ids.
 */
export function synthesizeEditPlan(
  seed: string,
  spec: SyntheticEditSpec,
  entities: readonly NeutralEntity[],
): NeutralEditPlan {
  const rng = createDeterministicRng(`edit-plan|${seed}`);
  const ids = [...entities].sort((a, b) => (a.id < b.id ? -1 : 1)).map((entity) => entity.id);
  const scaleIds = pickDistinct(ids, spec.scaleEditCount, rng);
  const scaleEdits: Record<string, number> = {};
  for (const id of scaleIds) {
    scaleEdits[id] = round2(0.5 + rng.next() * 1.5);
  }
  const remaining = ids.filter((id) => !scaleIds.includes(id));
  const removedIds = pickDistinct(remaining, spec.removedEntityCount, rng);
  const addedEntities: NeutralEntity[] = [];
  for (let index = 0; index < spec.addedEntityCount; index++) {
    addedEntities.push({
      id: `ent-added-${String(index).padStart(2, "0")}`,
      kind: "prop",
      label: `Fixture added prop ${index}`,
      transform: {
        position: [round2(rng.next() * 4 - 2), round2(rng.next() * 4 - 2), round2(rng.next() * 4 - 2)],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      attributes: { fixture: true, added: true },
    });
  }
  const environment: Partial<NeutralEnvironment> | undefined = spec.environmentEdit
    ? { ambientIntensity: 0.6, background: "#1a2028" }
    : undefined;
  return {
    scaleEdits,
    addedEntities,
    removedEntityIds: removedIds,
    ...(environment === undefined ? {} : { environment }),
  };
}

function pickDistinct(ids: readonly string[], count: number, rng: { next(): number }): string[] {
  const pool = [...ids];
  const picked: string[] = [];
  for (let index = 0; index < count && pool.length > 0; index++) {
    const position = Math.floor(rng.next() * pool.length);
    const id = pool.splice(position, 1)[0];
    if (id !== undefined) picked.push(id);
  }
  return picked.sort();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface RoundTripBenchmarkFixture {
  readonly fixtureId: string;
  readonly seed: string;
  readonly subjectSpec: SyntheticSubjectSpec;
  readonly editSpec: SyntheticEditSpec;
  /**
   * Golden: digest over the intended final neutral state (byte-identical
   * replay check; sha-256 over the canonical final-state descriptors).
   */
  readonly expectedFinalStateDigest: string;
  /** Golden: candidate id -> per-fixture fidelity score (exact match). */
  readonly expectedScores: Readonly<Record<string, number>>;
}

// NOTE: expectedFinalStateDigest / expectedScores below are golden values
// recorded from the shipped generator + scorer on 2026-10-11 (the seed
// constants and specs are frozen; the goldens replay byte-identically).

export const ROUND_TRIP_BENCHMARK_FIXTURES: readonly RoundTripBenchmarkFixture[] = [
  {
    fixtureId: "fixture-edit-portrait-minimal",
    seed: "w5c-fixture-01",
    subjectSpec: { entityCount: 4, entityKinds: ["synthetic-human", "prop"] },
    editSpec: { scaleEditCount: 1, addedEntityCount: 1, removedEntityCount: 1, environmentEdit: true },
    expectedFinalStateDigest: "2a8b2f9b40f497393e71b83f5fca3c97b59b0e5a62bebaaa85867c7ebcc3da0c",
    expectedScores: {
      "mock-editing-native-precise": 1,
      "mock-editing-native-coarse": 0.85,
      "mock-editing-embedded-balanced": 0.85,
      "mock-editing-embedded-lossy": 0.6667,
      "mock-editing-external-faithful": 0.66,
      "mock-editing-external-lossy": 0.6167,
      "vscode-editing-eval": 1,
    },
  },
  {
    fixtureId: "fixture-edit-scene-mixed",
    seed: "w5c-fixture-02",
    subjectSpec: { entityCount: 8, entityKinds: ["synthetic-human", "prop", "environment", "light"] },
    editSpec: { scaleEditCount: 3, addedEntityCount: 2, removedEntityCount: 2, environmentEdit: true },
    expectedFinalStateDigest: "4e5bdbff64a49a710f995e813e92b64230df8d94514d6a879905c6f6ee19d1b7",
    expectedScores: {
      "mock-editing-native-precise": 1,
      "mock-editing-native-coarse": 0.6833,
      "mock-editing-embedded-balanced": 0.775,
      "mock-editing-embedded-lossy": 0.4067,
      "mock-editing-external-faithful": 0.55,
      "mock-editing-external-lossy": 0.4333,
      "vscode-editing-eval": 1,
    },
  },
  {
    fixtureId: "fixture-edit-timeline-heavy",
    seed: "w5c-fixture-03",
    subjectSpec: { entityCount: 12, entityKinds: ["prop", "environment", "camera-marker"] },
    editSpec: { scaleEditCount: 5, addedEntityCount: 3, removedEntityCount: 4, environmentEdit: false },
    expectedFinalStateDigest: "55d27f7158f9a5b6d3e9d13581d2d62775e8e252dc9f7cf7ac1a58d3674ba026",
    expectedScores: {
      "mock-editing-native-precise": 1,
      "mock-editing-native-coarse": 0.6667,
      "mock-editing-embedded-balanced": 0.7273,
      "mock-editing-embedded-lossy": 0.6394,
      "mock-editing-external-faithful": 0.6394,
      "mock-editing-external-lossy": 0.5,
      "vscode-editing-eval": 1,
    },
  },
];

export const ROUND_TRIP_FIXTURE_SET_VERSION =
  "w5c-editing-round-trip-benchmark-fixtures/1 (seeded 2026-10-11; golden expectations recorded from the shipped generator and scorer)";

/** Golden: full-report digest over the seeded fixture set (byte-identical replay). */
export const GOLDEN_ROUND_TRIP_REPORT_RUN_ID = "e80d9f58";

/** Resolved subject state for a fixture (deterministic). */
export function fixtureSubjectState(
  fixture: RoundTripBenchmarkFixture,
): { entities: NeutralEntity[]; environment: NeutralEnvironment } {
  return synthesizeSubjectState(fixture.seed, fixture.subjectSpec);
}

/** Resolved edit payload for a fixture (deterministic). */
export function fixtureEditPlan(fixture: RoundTripBenchmarkFixture): NeutralEditPlan {
  return synthesizeEditPlan(fixture.seed, fixture.editSpec, fixtureSubjectState(fixture).entities);
}

/** Deterministic digest over a resolved final neutral state (sha-256 of canonical descriptors). */
export function neutralStateDigest(state: {
  readonly entities: readonly NeutralEntity[];
  readonly environment: NeutralEnvironment;
}): string {
  return sha256Hex(
    JSON.stringify(
      state.entities.map((entity) => ({
        id: entity.id,
        kind: entity.kind,
        label: entity.label,
        transform: entity.transform,
        attributes: entity.attributes,
      })) as unknown as Record<string, unknown>[],
    ) + `|${JSON.stringify(state.environment)}`,
  );
}
