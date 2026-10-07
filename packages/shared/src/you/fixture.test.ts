import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFixtureSnapshot,
  FIXTURE_DEFICIENCY_CLASSES,
  listFixtureRegions,
  resolveFixtureSeed,
} from "./fixture.js";
import { seedFromString } from "./rng.js";
import { stableContentHash, stableStringify } from "./serialize.js";

const GOLDEN_SEED = "phase0-golden-v1";

test("fixture determinism: same seed => byte-identical snapshot JSON", () => {
  const first = buildFixtureSnapshot(GOLDEN_SEED);
  const second = buildFixtureSnapshot(GOLDEN_SEED);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(JSON.stringify(stableStringify(first)), JSON.stringify(stableStringify(second)));
});

test("fixture determinism: different seed => different snapshot", () => {
  const first = buildFixtureSnapshot("seed-a");
  const second = buildFixtureSnapshot("seed-b");
  assert.notEqual(stableStringify(first), stableStringify(second));
  assert.notEqual(stableContentHash(first), stableContentHash(second));
});

test("fixture determinism: numeric seed and equivalent text seed agree", () => {
  const numeric = buildFixtureSnapshot(seedFromString(GOLDEN_SEED));
  const textual = buildFixtureSnapshot(GOLDEN_SEED);
  assert.equal(stableStringify(numeric), stableStringify(textual));
  assert.equal(resolveFixtureSeed(seedFromString(GOLDEN_SEED)), resolveFixtureSeed(GOLDEN_SEED));
});

test("fixture snapshot is explicitly simulated (truth law)", () => {
  assert.equal(buildFixtureSnapshot(GOLDEN_SEED).simulated, true);
});

test("fixture snapshot contains exactly one synthetic human and sorted entities", () => {
  const snapshot = buildFixtureSnapshot(GOLDEN_SEED);
  const humans = snapshot.entities.filter((entity) => entity.kind === "synthetic-human");
  assert.equal(humans.length, 1);
  assert.equal(humans[0]?.label, "Synthetic Human 01");
  assert.equal(humans[0]?.attributes.regionSet, "standard-humanoid");
  const ids = snapshot.entities.map((entity) => entity.id);
  assert.deepEqual(ids, [...ids].sort());
  assert.ok(snapshot.entities.length >= 4);
});

test("fixture quality map covers all deficiency classes within [0.3, 0.7)", () => {
  const quality = buildFixtureSnapshot(GOLDEN_SEED).quality;
  assert.deepEqual(Object.keys(quality).sort(), [...FIXTURE_DEFICIENCY_CLASSES].sort());
  for (const score of Object.values(quality)) {
    assert.ok(score >= 0.3 && score < 0.7, `score ${score} outside seeded band`);
  }
});

test("fixture environment state is well-formed", () => {
  const environment = buildFixtureSnapshot(GOLDEN_SEED).environment;
  assert.equal(environment.keyLightDirection.length, 3);
  for (const axis of environment.keyLightDirection) {
    assert.ok(Number.isFinite(axis) && axis >= -1 && axis <= 1.01);
  }
  assert.ok(environment.ambientIntensity >= 0.25 && environment.ambientIntensity <= 0.75);
  assert.match(environment.background, /^#[0-9a-f]{6}$/);
});

test("fixture snapshot and all entities are deeply frozen", () => {
  const snapshot = buildFixtureSnapshot(GOLDEN_SEED);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.entities));
  for (const entity of snapshot.entities) {
    assert.ok(Object.isFrozen(entity));
    assert.ok(Object.isFrozen(entity.attributes));
  }
  assert.throws(() => {
    (snapshot as unknown as { simulated: boolean }).simulated = false;
  }, TypeError);
});

test("listFixtureRegions exposes the four humanoid regions, sorted by id", () => {
  const snapshot = buildFixtureSnapshot(GOLDEN_SEED);
  const regions = listFixtureRegions(snapshot);
  const human = snapshot.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  assert.equal(regions.length, 4);
  assert.deepEqual(
    regions.map((region) => region.part),
    ["arms", "head", "legs", "torso"],
  );
  for (const region of regions) {
    assert.equal(region.entityId, human.id);
    assert.ok(region.regionId.startsWith(`${human.id}::`));
  }
});

test("golden fixture expectations v1 (seed phase0-golden-v1) are frozen", () => {
  const snapshot = buildFixtureSnapshot(GOLDEN_SEED);
  const quality = snapshot.quality;
  assert.equal(quality.appearance, 0.6526);
  assert.equal(quality.composition, 0.4486);
  assert.equal(quality.geometry, 0.6258);
  assert.equal(quality.identity, 0.4799);
  assert.equal(quality["motion-naturalness"], 0.489);
  assert.equal(stableContentHash(snapshot), "972f55b4");
  const human = snapshot.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  assert.equal(human.id, "you_entity_91464d492c2c70ca");
  assert.deepEqual(human.attributes, {
    buildIndex: 1,
    hairStyleIndex: 3,
    heightMeters: 1.76,
    regionSet: "standard-humanoid",
    shoulderWidthMeters: 0.47,
    skinToneIndex: 2,
  });
  assert.deepEqual(snapshot.environment.keyLightDirection, [0.5608, 0.4819, 0.6732]);
  assert.equal(snapshot.environment.ambientIntensity, 0.353);
  assert.equal(snapshot.environment.background, "#131920");
});
