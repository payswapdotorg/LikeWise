// Deterministic lab world tests (W9C) — coverage: seed-derived worlds are
// byte-identical on replay (the LAB DETERMINISM LAW: same seed, same
// world, content-hash equality), the LAB.md world model is present
// (actors, ground truth, cameras, lighting, sensors, perturbations),
// malformed specs are typed YOU_LAB_WORLD_INVALID rejections, and
// world-run outcomes are deterministic computed fixture objectives with
// honest failure observations and evidence refs.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMERA_VIEW_LABELS,
  HUMAN_ACTOR_LABELS,
  LAB_FAILURE_CLASSES,
  LAB_WORLD_INVALID_CODE,
  LabWorldInvalidError,
  PROP_ACTOR_LABELS,
  WORLD_PERTURBATION_KINDS,
  WORLD_SENSOR_KINDS,
  assertWorldReplays,
  labWorldId,
  runWorldPipeline,
  synthesizeLabWorld,
  worldDifficulty,
  type LabWorldSpec,
} from "./worlds.js";
import { canonicalJson } from "../determinism.js";
import { seedGenomeNode } from "./pipelineGenome.js";

function standardSpec(): LabWorldSpec {
  return {
    seed: "w9c-world-test-01",
    actorCount: 6,
    cameraCount: 3,
    sensorCount: 2,
    lightingVariants: 2,
    noiseLevel: 0.3,
    occlusionEnabled: true,
    perturbationCount: 4,
  };
}

test("worlds: same seed synthesizes a byte-identical world (LAB DETERMINISM LAW)", () => {
  const spec = standardSpec();
  const first = synthesizeLabWorld(spec);
  const second = synthesizeLabWorld(spec);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.contentHash, second.contentHash);
  assertWorldReplays(first, spec);
  // the world id is a pure function of the spec (any spec change mints a new world)
  assert.equal(labWorldId(spec), first.descriptor.id);
  const tweaked = { ...spec, noiseLevel: 0.31 };
  assert.notEqual(labWorldId(tweaked), first.descriptor.id);
  assert.notEqual(synthesizeLabWorld(tweaked).contentHash, first.contentHash);
});

test("worlds: different seeds synthesize different worlds", () => {
  const a = synthesizeLabWorld({ ...standardSpec(), seed: "w9c-world-test-alpha" });
  const b = synthesizeLabWorld({ ...standardSpec(), seed: "w9c-world-test-beta" });
  assert.notEqual(a.contentHash, b.contentHash);
  assert.notEqual(a.descriptor.id, b.descriptor.id);
});

test("worlds: the LAB.md world model is present (actors, ground truth, cameras, lighting, sensors, perturbations)", () => {
  const world = synthesizeLabWorld(standardSpec());
  assert.equal(world.actors.length, 6);
  assert.equal(world.cameras.length, 3);
  assert.equal(world.sensors.length, 2);
  assert.equal(world.perturbations.length, 4);
  assert.equal(world.environment.lightingVariants.length, 2);
  for (const actor of world.actors) {
    assert.ok(actor.id.startsWith("you_world-actor_"));
    if (actor.kind === "synthetic-human") {
      assert.ok(HUMAN_ACTOR_LABELS.includes(actor.label as (typeof HUMAN_ACTOR_LABELS)[number]));
      assert.ok(actor.clothingRef !== null && actor.hairRef !== null && actor.motionRef !== null);
    } else {
      assert.equal(actor.kind, "prop");
      assert.ok(PROP_ACTOR_LABELS.includes(actor.label as (typeof PROP_ACTOR_LABELS)[number]));
      assert.equal(actor.clothingRef, null);
    }
    assert.ok(actor.position.every((value) => Number.isFinite(value)));
    assert.ok(actor.heightMeters > 0);
  }
  for (const camera of world.cameras) {
    assert.ok(CAMERA_VIEW_LABELS.includes(camera.viewLabel as (typeof CAMERA_VIEW_LABELS)[number]));
    assert.ok(camera.fovDegrees >= 24 && camera.fovDegrees <= 90);
  }
  for (const sensor of world.sensors) {
    assert.ok(WORLD_SENSOR_KINDS.includes(sensor.kind as (typeof WORLD_SENSOR_KINDS)[number]));
  }
  for (const perturbation of world.perturbations) {
    assert.ok(WORLD_PERTURBATION_KINDS.includes(perturbation.kind as (typeof WORLD_PERTURBATION_KINDS)[number]));
    assert.ok(perturbation.magnitude >= 0.1 && perturbation.magnitude <= 1);
  }
  // ground truth is content-addressed and aligns with the actor set
  assert.equal(world.groundTruth.geometryRefs.length, world.actors.length);
  assert.equal(world.groundTruth.materialRefs.length, world.actors.length);
  const humans = world.actors.filter((actor) => actor.kind === "synthetic-human");
  assert.equal(world.groundTruth.motionRefs.length, humans.length);
  assert.ok(world.groundTruth.id.startsWith("you_ground-truth_"));
  // descriptor threads the world identity
  assert.equal(world.descriptor.actorCount, world.actors.length);
  assert.equal(world.descriptor.groundTruthRef, world.groundTruth.id);
  assert.equal(world.descriptor.simulated, true, "truth law: synthetic worlds stay labeled simulated");
  assert.match(world.descriptor.id, /^you_world_[0-9a-f]{16}$/);
});

test("worlds: difficulty derives deterministically from the spec", () => {
  const spec = standardSpec();
  assert.equal(worldDifficulty(spec), 0.365);
  assert.equal(worldDifficulty({ ...spec, occlusionEnabled: false }), 0.215);
  assert.equal(worldDifficulty({ ...spec, noiseLevel: 1, perturbationCount: 16 }), 0.8);
});

test("worlds: malformed specs are typed YOU_LAB_WORLD_INVALID rejections", () => {
  const spec = standardSpec();
  const malformed: readonly [string, LabWorldSpec][] = [
    ["empty seed", { ...spec, seed: "" }],
    ["zero actors", { ...spec, actorCount: 0 }],
    ["too many actors", { ...spec, actorCount: 25 }],
    ["fractional actors", { ...spec, actorCount: 2.5 }],
    ["zero cameras", { ...spec, cameraCount: 0 }],
    ["too many cameras", { ...spec, cameraCount: 9 }],
    ["zero sensors", { ...spec, sensorCount: 0 }],
    ["too many sensors", { ...spec, sensorCount: 6 }],
    ["zero lighting variants", { ...spec, lightingVariants: 0 }],
    ["too many lighting variants", { ...spec, lightingVariants: 5 }],
    ["noise below 0", { ...spec, noiseLevel: -0.01 }],
    ["noise above 1", { ...spec, noiseLevel: 1.01 }],
    ["noise NaN", { ...spec, noiseLevel: Number.NaN }],
    ["negative perturbations", { ...spec, perturbationCount: -1 }],
    ["too many perturbations", { ...spec, perturbationCount: 17 }],
  ];
  for (const [label, bad] of malformed) {
    assert.throws(
      () => synthesizeLabWorld(bad),
      (error: unknown) => {
        assert.ok(error instanceof LabWorldInvalidError, `${label}: typed error`);
        assert.equal(error.code, LAB_WORLD_INVALID_CODE);
        return true;
      },
      label,
    );
    assert.throws(() => labWorldId(bad), LabWorldInvalidError, `${label}: id derivation validates too`);
    assert.throws(() => worldDifficulty(bad), LabWorldInvalidError, `${label}: difficulty validates too`);
  }
});

test("worlds: runWorldPipeline produces deterministic computed outcomes with honest markers", () => {
  const world = synthesizeLabWorld(standardSpec());
  const root = seedGenomeNode("you_experiment_w9c-worldtest", "world-test-root-seed");
  const request = { runId: "you_lab-run_worldtest", submittedAt: "2026-10-14T12:00:00Z" };
  const first = runWorldPipeline(world, [root], request);
  const second = runWorldPipeline(world, [root], request);
  assert.deepEqual(first, second);
  assert.equal(first.runId, request.runId);
  assert.equal(first.worldId, world.descriptor.id);
  assert.equal(first.pipelineNodeId, root.id);
  assert.ok(first.qualityScore >= 0 && first.qualityScore <= 1);
  assert.equal(first.simulated, true, "truth law: world runs stay labeled simulated");
  assert.ok(first.evidenceRef.startsWith(`content-store://you-lab/world-run/${request.runId}/`));
  assert.equal(first.completedAt, request.submittedAt);
  if (first.failureClass !== null) {
    assert.ok(LAB_FAILURE_CLASSES.includes(first.failureClass as (typeof LAB_FAILURE_CLASSES)[number]));
    assert.ok(first.qualityScore <= 0.6, "a seeded failure observation halves the computed score");
  }
  // different pipelines may roll different outcomes on the same world
  const otherRoot = seedGenomeNode("you_experiment_w9c-worldtest", "world-test-other-seed");
  const other = runWorldPipeline(world, [otherRoot], request);
  assert.equal(other.pipelineNodeId, otherRoot.id);
});

test("worlds: runWorldPipeline rejects malformed requests and broken lineages", () => {
  const world = synthesizeLabWorld(standardSpec());
  const root = seedGenomeNode("you_experiment_w9c-worldtest", "world-test-root-seed");
  assert.throws(
    () => runWorldPipeline(world, [root], { runId: "", submittedAt: "2026-10-14T12:00:00Z" }),
    (error: unknown) => {
      assert.ok(error instanceof LabWorldInvalidError);
      assert.equal(error.code, LAB_WORLD_INVALID_CODE);
      return true;
    },
  );
  assert.throws(() => runWorldPipeline(world, [root], { runId: "r", submittedAt: "not-a-date" }), LabWorldInvalidError);
  // a broken lineage (parentless non-root) is refused before any scoring
  const orphan = { ...root, id: "you_genome-node_orphan0000000000", parentRef: "you_genome-node_missing000000" };
  assert.throws(() => runWorldPipeline(world, [orphan], { runId: "r", submittedAt: "2026-10-14T12:00:00Z" }), Error);
});

test("worlds: assertWorldReplays catches a doctored world (byte-identity is enforced, not assumed)", () => {
  const spec = standardSpec();
  const world = synthesizeLabWorld(spec);
  assertWorldReplays(world, spec);
  const doctored = { ...world, actors: world.actors.slice(0, -1) };
  assert.throws(() => assertWorldReplays(doctored, spec), LabWorldInvalidError);
});
