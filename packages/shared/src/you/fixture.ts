// YOU seeded synthetic-human + environment fixture (docs/you/FIXTURES.md).
//
// The fixture builds a SolutionStateSnapshot purely from a seed:
// no ambient time, no Math.random, no network, no PII. The RNG
// consumption order below is part of the frozen fixture definition —
// changing it changes every golden expectation (new fixture version,
// never an in-place edit).
//
// Consumption order (frozen v1):
//   1. quality score per deficiency class (classes iterated sorted)
//   2. synthetic-human: id, height, shoulder width, build/hair/skin indices
//   3. ground plane: id, palette index
//   4. key light: id, intensity
//   5. camera marker: id, azimuth
//   6. backdrop: id, palette index
//   7. environment: key-light azimuth/elevation, ambient intensity, background

import type {
  SolutionEntity,
  SolutionEnvironmentState,
  SolutionQualityMap,
  SolutionStateSnapshot,
  SolutionTransform,
} from "./contract.js";
import { createRngIdFactory } from "./ids.js";
import { roundQualityScore } from "./quality.js";
import { createDeterministicRng, seedFromString } from "./rng.js";
import { deepFreeze } from "./serialize.js";

/** Fixture deficiency classes (quality map keys). Sorted for iteration. */
export const FIXTURE_DEFICIENCY_CLASSES = [
  "identity",
  "geometry",
  "appearance",
  "motion-naturalness",
  "composition",
] as const;
export type FixtureDeficiencyClass = (typeof FIXTURE_DEFICIENCY_CLASSES)[number];

/** Region parts exposed by the synthetic-human fixture. */
export const FIXTURE_REGION_PARTS = ["arms", "head", "legs", "torso"] as const;
export type FixtureRegionPart = (typeof FIXTURE_REGION_PARTS)[number];

const GROUND_PALETTE = ["#1a1f26", "#22282f", "#2a3138"] as const;
const BACKDROP_PALETTE = ["#0d1117", "#131920", "#191f27"] as const;

function paletteAt(palette: readonly string[], index: number): string {
  const chosen = palette[index];
  if (chosen === undefined) {
    throw new Error("fixture palette index out of range");
  }
  return chosen;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function transform(
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
): SolutionTransform {
  return { position, rotation, scale };
}

/** Resolves a numeric seed from a number or stable text. */
export function resolveFixtureSeed(seed: number | string): number {
  return typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
}

/**
 * Builds the seeded synthetic-human + environment snapshot. Same seed =>
 * byte-identical canonical JSON (entities sorted by id; stable key order
 * enforced by stableStringify at comparison boundaries).
 */
export function buildFixtureSnapshot(seed: number | string): SolutionStateSnapshot {
  const rng = createDeterministicRng(resolveFixtureSeed(seed));
  const ids = createRngIdFactory(rng);

  const quality: Record<string, number> = {};
  for (const deficiencyClass of [...FIXTURE_DEFICIENCY_CLASSES].sort()) {
    quality[deficiencyClass] = roundQualityScore(0.3 + 0.4 * rng.nextFloat());
  }

  const humanId = ids.next("entity");
  const human: SolutionEntity = deepFreeze({
    id: humanId,
    kind: "synthetic-human",
    label: "Synthetic Human 01",
    transform: transform([0, 0, 0]),
    attributes: {
      regionSet: "standard-humanoid",
      heightMeters: round2(rng.floatInRange(1.55, 1.9)),
      shoulderWidthMeters: round2(rng.floatInRange(0.38, 0.52)),
      buildIndex: rng.intInRange(0, 2),
      hairStyleIndex: rng.intInRange(0, 3),
      skinToneIndex: rng.intInRange(0, 3),
    },
  });

  const groundId = ids.next("entity");
  const ground: SolutionEntity = deepFreeze({
    id: groundId,
    kind: "prop",
    label: "Ground Plane",
    transform: transform([0, 0, 0], [0, 0, 0], [10, 1, 10]),
    attributes: {
      material: "matte",
      color: paletteAt(GROUND_PALETTE, rng.intInRange(0, GROUND_PALETTE.length - 1)),
    },
  });

  const lightId = ids.next("entity");
  const keyLightEntity: SolutionEntity = deepFreeze({
    id: lightId,
    kind: "light",
    label: "Key Light",
    transform: transform([2.5, 3, 2]),
    attributes: { intensity: round2(rng.floatInRange(0.8, 1.2)), lightType: "directional" },
  });

  const cameraId = ids.next("entity");
  const cameraAzimuth = rng.floatInRange(0, Math.PI * 2);
  const camera: SolutionEntity = deepFreeze({
    id: cameraId,
    kind: "camera-marker",
    label: "Camera Marker 01",
    transform: transform([round2(Math.cos(cameraAzimuth) * 3.5), 1.6, round2(Math.sin(cameraAzimuth) * 3.5)], [0, 0, 0]),
    attributes: { focalLengthMm: 50, orbitRadius: 3.5 },
  });

  const backdropId = ids.next("entity");
  const backdrop: SolutionEntity = deepFreeze({
    id: backdropId,
    kind: "prop",
    label: "Backdrop",
    transform: transform([0, 1.5, -4], [0, 0, 0], [8, 3, 0.2]),
    attributes: { color: paletteAt(BACKDROP_PALETTE, rng.intInRange(0, BACKDROP_PALETTE.length - 1)) },
  });

  const envAzimuth = rng.floatInRange(0, Math.PI * 2);
  const envElevation = rng.floatInRange(0.35, 1.1);
  const environment: SolutionEnvironmentState = deepFreeze({
    keyLightDirection: [
      round4(Math.cos(envAzimuth) * Math.cos(envElevation)),
      round4(Math.sin(envElevation)),
      round4(Math.sin(envAzimuth) * Math.cos(envElevation)),
    ],
    ambientIntensity: round4(rng.floatInRange(0.25, 0.75)),
    background: paletteAt(BACKDROP_PALETTE, rng.intInRange(0, BACKDROP_PALETTE.length - 1)),
  });

  const entities = [human, ground, keyLightEntity, camera, backdrop].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const qualityMap: SolutionQualityMap = quality;
  return deepFreeze({
    entities,
    environment,
    quality: qualityMap,
    simulated: true,
  });
}

/** A selectable fixture region of the synthetic human. */
export interface FixtureRegion {
  readonly regionId: string;
  readonly entityId: string;
  readonly part: FixtureRegionPart;
  readonly label: string;
}

/**
 * Lists the selectable regions exposed by a snapshot's synthetic-human
 * entities (region id format `<entityId>::<part>`). Deterministic and
 * sorted by regionId.
 */
export function listFixtureRegions(snapshot: SolutionStateSnapshot): readonly FixtureRegion[] {
  const regions: FixtureRegion[] = [];
  for (const entity of snapshot.entities) {
    if (entity.kind !== "synthetic-human" || entity.attributes.regionSet !== "standard-humanoid") {
      continue;
    }
    for (const part of FIXTURE_REGION_PARTS) {
      regions.push({
        regionId: `${entity.id}::${part}`,
        entityId: entity.id,
        part,
        label: `Synthetic Human 01 ${part}`,
      });
    }
  }
  return regions.sort((a, b) => (a.regionId < b.regionId ? -1 : a.regionId > b.regionId ? 1 : 0));
}
