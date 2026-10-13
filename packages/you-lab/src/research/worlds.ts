// Deterministic lab worlds (W9C) — the LAB.md world model.
//
// Authority: docs/you/LAB.md "World" — a lab world can contain actors,
// ground truth, cameras, lighting, clothing, hair, geometry, motion,
// sensors, noise, occlusion and perturbations; synthetic worlds are
// deterministic by seed and explicitly marked simulated; lab truth never
// becomes production human truth. LAB DETERMINISM LAW
// (docs/you/CONTRACTS.md "Wave-9 contract freeze (v9)"): lab worlds and
// benchmark runs are seed-deterministic — same seed, byte-identical
// replay; everything simulated stays labeled simulated: true; real
// compute-plane integration stays W10+.
//
// The world descriptor is the neutral shape aligned 1:1 with the frozen v9
// LabWorldDescriptor (mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts). Every derived value is a pure hash-indexed
// function of (seed, domain, index) — no shared mutable RNG stream, no
// clock, no network (docs/you/FIXTURES.md). The world content hash makes
// byte-identity checkable: same spec => same hash, every run, every
// platform.
//
// World-run outcomes: runWorldPipeline executes a pipeline lineage against
// a world deterministically (a computed fixture objective with an honest
// simulated marker — never a measured benchmark) and produces the outcome
// records the Failure Atlas consumes (failure observations with
// content-addressed evidence refs).

import { canonicalJson, roundTo } from "../determinism.js";
import { unitFrom } from "../capture/deterministicRng.js";
import { sha256Hex } from "../arena/arenaAdapterSeam.js";
import { assertLineageIntegrity, lineageStrength, type NeutralPipelineGenomeNode } from "./pipelineGenome.js";

/** Error code aligned with the frozen v9 typed error literal (you-lab-owned). */
export const LAB_WORLD_INVALID_CODE = "YOU_LAB_WORLD_INVALID";

/** Typed rejection thrown when a world spec or run request is malformed. */
export class LabWorldInvalidError extends Error {
  readonly code = LAB_WORLD_INVALID_CODE;
  constructor(detail: string) {
    super(`${LAB_WORLD_INVALID_CODE}: ${detail}`);
  }
}

/**
 * Neutral lab world descriptor — aligned 1:1 with the frozen v9
 * LabWorldDescriptor (seed-derived; same seed => byte-identical world).
 */
export interface NeutralLabWorldDescriptor {
  readonly id: string;
  readonly seed: string;
  readonly actorCount: number;
  readonly groundTruthRef: string | null;
  readonly simulated: boolean;
}

/** Authored spec of a seeded synthetic world (the W9C fixture definition). */
export interface LabWorldSpec {
  readonly seed: string;
  /** Actors in the world (1..24). */
  readonly actorCount: number;
  /** Cameras covering the world (1..8). */
  readonly cameraCount: number;
  /** Sensors mounted in the world (1..5). */
  readonly sensorCount: number;
  /** Lighting variants rigged in the world (1..4). */
  readonly lightingVariants: number;
  /** Sensor noise level in [0, 1]. */
  readonly noiseLevel: number;
  /** Whether occluders are present in the world. */
  readonly occlusionEnabled: boolean;
  /** Perturbation events scripted into the world (0..16). */
  readonly perturbationCount: number;
}

/** One seed-derived world actor (a synthetic human or a prop — never a real person). */
export interface LabWorldActor {
  readonly id: string;
  readonly kind: "synthetic-human" | "prop";
  readonly label: string;
  readonly position: readonly [number, number, number];
  readonly facingDegrees: number;
  readonly heightMeters: number;
  readonly clothingRef: string | null;
  readonly hairRef: string | null;
  readonly motionRef: string | null;
}

/** One seed-derived world camera (view labels from the LAB.md Capture Scientist evidence list). */
export interface LabWorldCamera {
  readonly id: string;
  readonly viewLabel: string;
  readonly position: readonly [number, number, number];
  readonly aimAt: readonly [number, number, number];
  readonly fovDegrees: number;
}

/** One seed-derived world sensor. */
export interface LabWorldSensor {
  readonly id: string;
  readonly kind: string;
  readonly mountedOn: string;
}

/** One seed-derived scripted perturbation event. */
export interface LabWorldPerturbation {
  readonly id: string;
  readonly kind: string;
  readonly magnitude: number;
  readonly affectsRef: string;
}

/** The world's ground truth — content-addressed geometry/motion/material refs (lab truth, never production human truth). */
export interface LabWorldGroundTruth {
  readonly id: string;
  readonly geometryRefs: readonly string[];
  readonly motionRefs: readonly string[];
  readonly materialRefs: readonly string[];
  readonly contentHash: string;
}

/** The world's lighting rig. */
export interface LabWorldLightingVariant {
  readonly label: string;
  readonly intensity: number;
}

/** The world's environment state. */
export interface LabWorldEnvironment {
  readonly ambientIntensity: number;
  readonly keyLightDirection: readonly [number, number, number];
  readonly background: string;
  readonly lightingVariants: readonly LabWorldLightingVariant[];
}

/** A fully derived deterministic world — byte-identical from the same spec. */
export interface LabWorld {
  readonly descriptor: NeutralLabWorldDescriptor;
  readonly actors: readonly LabWorldActor[];
  readonly cameras: readonly LabWorldCamera[];
  readonly sensors: readonly LabWorldSensor[];
  readonly perturbations: readonly LabWorldPerturbation[];
  readonly groundTruth: LabWorldGroundTruth;
  readonly environment: LabWorldEnvironment;
  /** Computed fixture difficulty in [0, 0.8] — a derived field of the spec (deterministic). */
  readonly difficulty: number;
  /** sha-256 over the canonical JSON of the world without this field — the byte-identity digest. */
  readonly contentHash: string;
}

/** Authored actor label vocabularies (W9C fixture definitions). */
export const HUMAN_ACTOR_LABELS = [
  "Principal Performer",
  "Supporting Performer A",
  "Supporting Performer B",
  "Background Performer",
  "Stand-In Performer",
] as const;

export const PROP_ACTOR_LABELS = ["Calibration Prop", "Reference Object", "Set Dressing Prop"] as const;

/** Authored camera view labels (LAB.md Capture Scientist: front/side/three-quarter evidence). */
export const CAMERA_VIEW_LABELS = ["front", "side", "three-quarter", "close-up", "wide", "overhead"] as const;

/** Authored sensor kinds (W9C fixture vocabulary). */
export const WORLD_SENSOR_KINDS = ["rgb-camera", "depth-camera", "lidar", "imu", "microphone-array"] as const;

/** Authored perturbation kinds (W9C fixture vocabulary). */
export const WORLD_PERTURBATION_KINDS = [
  "light-flicker",
  "background-motion",
  "wind-field",
  "sensor-dropout",
  "crowd-crossing",
] as const;

/** Authored lighting variant labels (W9C fixture vocabulary). */
export const LIGHTING_VARIANT_LABELS = ["key-only", "key-fill", "three-point", "natural-window"] as const;

/**
 * Authored failure-class vocabulary (W9C fixture definition) — the classes a
 * world-run outcome may observe. The Failure Atlas records observations
 * from this closed vocabulary only (fail-closed, never guessed).
 */
export const LAB_FAILURE_CLASSES = [
  "occlusion-dropout",
  "motion-blur",
  "lighting-mismatch",
  "geometry-drift",
  "identity-swap",
  "texture-flicker",
] as const;

const MAX_ACTORS = 24;
const MAX_CAMERAS = 8;
const MAX_SENSORS = 5;
const MAX_LIGHTING_VARIANTS = 4;
const MAX_PERTURBATIONS = 16;

/** Fail-closed spec validation — malformed worlds are typed rejections, never clamped. */
export function assertValidWorldSpec(spec: LabWorldSpec): void {
  if (spec.seed.length === 0) {
    throw new LabWorldInvalidError("seed is empty (a world derives from its seed)");
  }
  if (!Number.isInteger(spec.actorCount) || spec.actorCount < 1 || spec.actorCount > MAX_ACTORS) {
    throw new LabWorldInvalidError(`actorCount ${spec.actorCount} is outside [1, ${MAX_ACTORS}]`);
  }
  if (!Number.isInteger(spec.cameraCount) || spec.cameraCount < 1 || spec.cameraCount > MAX_CAMERAS) {
    throw new LabWorldInvalidError(`cameraCount ${spec.cameraCount} is outside [1, ${MAX_CAMERAS}]`);
  }
  if (!Number.isInteger(spec.sensorCount) || spec.sensorCount < 1 || spec.sensorCount > MAX_SENSORS) {
    throw new LabWorldInvalidError(`sensorCount ${spec.sensorCount} is outside [1, ${MAX_SENSORS}]`);
  }
  if (!Number.isInteger(spec.lightingVariants) || spec.lightingVariants < 1 || spec.lightingVariants > MAX_LIGHTING_VARIANTS) {
    throw new LabWorldInvalidError(`lightingVariants ${spec.lightingVariants} is outside [1, ${MAX_LIGHTING_VARIANTS}]`);
  }
  if (typeof spec.noiseLevel !== "number" || !Number.isFinite(spec.noiseLevel) || spec.noiseLevel < 0 || spec.noiseLevel > 1) {
    throw new LabWorldInvalidError(`noiseLevel ${spec.noiseLevel} is outside [0, 1] (never silently clamped)`);
  }
  if (!Number.isInteger(spec.perturbationCount) || spec.perturbationCount < 0 || spec.perturbationCount > MAX_PERTURBATIONS) {
    throw new LabWorldInvalidError(`perturbationCount ${spec.perturbationCount} is outside [0, ${MAX_PERTURBATIONS}]`);
  }
}

/** Deterministic world id for a spec — a pure function of the spec (the whole spec, so any change mints a new world). */
export function labWorldId(spec: LabWorldSpec): string {
  assertValidWorldSpec(spec);
  return `you_world_${sha256Hex(canonicalJson(spec)).slice(0, 16)}`;
}

/** Computed fixture difficulty of a spec (deterministic arithmetic, in [0, 0.8]). */
export function worldDifficulty(spec: LabWorldSpec): number {
  assertValidWorldSpec(spec);
  const raw =
    spec.noiseLevel * 0.45 +
    (spec.occlusionEnabled ? 0.15 : 0) +
    Math.min(spec.perturbationCount * 0.02, 0.2);
  return roundTo(Math.min(raw, 0.8), 4);
}

/**
 * Synthesize the deterministic world for a spec: actors, cameras, sensors,
 * perturbations, ground truth and environment are all seed-derived
 * hash-indexed values (pure functions of (seed, domain, index) — byte
 * identical on every replay). Same spec => same contentHash.
 */
export function synthesizeLabWorld(spec: LabWorldSpec): LabWorld {
  assertValidWorldSpec(spec);
  const id = labWorldId(spec);
  const actors: LabWorldActor[] = [];
  for (let index = 0; index < spec.actorCount; index++) {
    const isHuman = unitFrom(spec.seed, "actor-kind", String(index)) < 0.75;
    actors.push({
      id: `you_world-actor_${sha256Hex(`${spec.seed}|actor|${index}`).slice(0, 16)}`,
      kind: isHuman ? "synthetic-human" : "prop",
      label: isHuman
        ? HUMAN_ACTOR_LABELS[index % HUMAN_ACTOR_LABELS.length]!
        : PROP_ACTOR_LABELS[index % PROP_ACTOR_LABELS.length]!,
      position: [
        roundTo(unitFrom(spec.seed, "actor-x", String(index)) * 10 - 5, 3),
        0,
        roundTo(unitFrom(spec.seed, "actor-z", String(index)) * 10 - 5, 3),
      ],
      facingDegrees: roundTo(unitFrom(spec.seed, "actor-facing", String(index)) * 360, 2),
      heightMeters: isHuman
        ? roundTo(1.45 + unitFrom(spec.seed, "actor-height", String(index)) * 0.4, 3)
        : roundTo(0.2 + unitFrom(spec.seed, "actor-height", String(index)) * 0.6, 3),
      clothingRef: isHuman ? `content-store://you-lab/world/clothing/${sha256Hex(`${spec.seed}|clothing|${index}`).slice(0, 16)}` : null,
      hairRef: isHuman ? `content-store://you-lab/world/hair/${sha256Hex(`${spec.seed}|hair|${index}`).slice(0, 16)}` : null,
      motionRef: isHuman ? `content-store://you-lab/world/motion/${sha256Hex(`${spec.seed}|motion|${index}`).slice(0, 16)}` : null,
    });
  }
  const cameras: LabWorldCamera[] = [];
  for (let index = 0; index < spec.cameraCount; index++) {
    cameras.push({
      id: `you_world-camera_${sha256Hex(`${spec.seed}|camera|${index}`).slice(0, 16)}`,
      viewLabel: CAMERA_VIEW_LABELS[index % CAMERA_VIEW_LABELS.length]!,
      position: [
        roundTo(unitFrom(spec.seed, "camera-x", String(index)) * 6 - 3, 3),
        roundTo(1 + unitFrom(spec.seed, "camera-y", String(index)) * 2, 3),
        roundTo(unitFrom(spec.seed, "camera-z", String(index)) * 6 - 3, 3),
      ],
      aimAt: [
        roundTo(unitFrom(spec.seed, "aim-x", String(index)) * 2 - 1, 3),
        roundTo(0.5 + unitFrom(spec.seed, "aim-y", String(index)) * 1.5, 3),
        roundTo(unitFrom(spec.seed, "aim-z", String(index)) * 2 - 1, 3),
      ],
      fovDegrees: roundTo(24 + unitFrom(spec.seed, "camera-fov", String(index)) * 66, 2),
    });
  }
  const sensors: LabWorldSensor[] = [];
  for (let index = 0; index < spec.sensorCount; index++) {
    sensors.push({
      id: `you_world-sensor_${sha256Hex(`${spec.seed}|sensor|${index}`).slice(0, 16)}`,
      kind: WORLD_SENSOR_KINDS[index % WORLD_SENSOR_KINDS.length]!,
      mountedOn: unitFrom(spec.seed, "sensor-mount", String(index)) < 0.5
        ? "environment"
        : actors[index % actors.length]!.id,
    });
  }
  const perturbations: LabWorldPerturbation[] = [];
  for (let index = 0; index < spec.perturbationCount; index++) {
    perturbations.push({
      id: `you_world-perturbation_${sha256Hex(`${spec.seed}|perturbation|${index}`).slice(0, 16)}`,
      kind: WORLD_PERTURBATION_KINDS[index % WORLD_PERTURBATION_KINDS.length]!,
      magnitude: roundTo(0.1 + unitFrom(spec.seed, "perturbation-magnitude", String(index)) * 0.9, 3),
      affectsRef: actors[index % actors.length]!.id,
    });
  }
  const groundTruthPayload = {
    geometryRefs: actors.map((actor) => `content-store://you-lab/world/geometry/${sha256Hex(`${spec.seed}|geometry|${actor.id}`).slice(0, 16)}`),
    motionRefs: actors.filter((actor) => actor.motionRef !== null).map((actor) => actor.motionRef!),
    materialRefs: actors.map((actor) => `content-store://you-lab/world/material/${sha256Hex(`${spec.seed}|material|${actor.id}`).slice(0, 16)}`),
  };
  const groundTruth: LabWorldGroundTruth = {
    id: `you_ground-truth_${sha256Hex(canonicalJson(groundTruthPayload)).slice(0, 16)}`,
    ...groundTruthPayload,
    contentHash: sha256Hex(canonicalJson(groundTruthPayload)),
  };
  const environment: LabWorldEnvironment = {
    ambientIntensity: roundTo(0.2 + unitFrom(spec.seed, "ambient") * 0.6, 3),
    keyLightDirection: [
      roundTo(unitFrom(spec.seed, "key-x") * 2 - 1, 3),
      roundTo(0.2 + unitFrom(spec.seed, "key-y") * 0.8, 3),
      roundTo(unitFrom(spec.seed, "key-z") * 2 - 1, 3),
    ],
    background: `#${sha256Hex(`${spec.seed}|background`).slice(0, 6)}`,
    lightingVariants: Array.from({ length: spec.lightingVariants }, (_, index) => ({
      label: LIGHTING_VARIANT_LABELS[index % LIGHTING_VARIANT_LABELS.length]!,
      intensity: roundTo(0.4 + unitFrom(spec.seed, "light-variant", String(index)) * 0.6, 3),
    })),
  };
  const worldWithoutHash = {
    descriptor: {
      id,
      seed: spec.seed,
      actorCount: spec.actorCount,
      groundTruthRef: groundTruth.id,
      simulated: true,
    },
    actors,
    cameras,
    sensors,
    perturbations,
    groundTruth,
    environment,
    difficulty: worldDifficulty(spec),
  };
  return { ...worldWithoutHash, contentHash: sha256Hex(canonicalJson(worldWithoutHash)) };
}

/**
 * Re-derive and verify a world's content hash (the byte-identity law made
 * checkable): throws YOU_LAB_WORLD_INVALID when the world does not replay
 * byte-identically from its own spec.
 */
export function assertWorldReplays(world: LabWorld, spec: LabWorldSpec): void {
  const replay = synthesizeLabWorld(spec);
  if (replay.contentHash !== world.contentHash || canonicalJson(replay) !== canonicalJson(world)) {
    throw new LabWorldInvalidError(
      `world ${world.descriptor.id} does not replay byte-identically from its seed (LAB DETERMINISM LAW violation)`,
    );
  }
}

/** A world-run request (fixture mode: fixed timestamps, no clock). */
export interface LabWorldRunRequest {
  readonly runId: string;
  readonly submittedAt: string;
}

/**
 * A deterministic world-run outcome: the computed fixture objective of a
 * pipeline lineage against a world, with a content-addressed evidence ref
 * and — when the run hit a seeded failure — the observed failure class.
 */
export interface LabWorldRunOutcome {
  readonly runId: string;
  readonly worldId: string;
  readonly pipelineNodeId: string;
  readonly qualityScore: number;
  readonly failureClass: string | null;
  readonly evidenceRef: string;
  readonly completedAt: string;
  readonly simulated: true;
}

/**
 * Execute a pipeline lineage against a world (deterministic, simulated).
 *
 * HONEST MODEL (truth law): the quality score is computed fixture
 * arithmetic — 1 minus the world difficulty times the pipeline's residual
 * weakness — with a seeded failure roll that may halve the score and mint
 * a failure observation. Nothing is measured, no real compute plane is
 * invoked (W10+ boundary), and the outcome stays labeled simulated.
 */
export function runWorldPipeline(
  world: LabWorld,
  lineage: readonly NeutralPipelineGenomeNode[],
  request: LabWorldRunRequest,
): LabWorldRunOutcome {
  if (request.runId.length === 0) {
    throw new LabWorldInvalidError("runId is empty (a world-run outcome names its run)");
  }
  if (request.submittedAt.length === 0 || Number.isNaN(Date.parse(request.submittedAt))) {
    throw new LabWorldInvalidError(`submittedAt '${request.submittedAt}' is not a parseable ISO timestamp (injected clock only)`);
  }
  assertLineageIntegrity(lineage);
  const node = lineage[lineage.length - 1]!;
  const strength = lineageStrength(lineage);
  const quality = roundTo(Math.max(0, Math.min(1 - world.difficulty * (1 - strength), 1)), 4);
  const failureProbability = Math.min(world.difficulty * (1 - strength) * 1.2, 0.95);
  const evidenceRef =
    `content-store://you-lab/world-run/${request.runId}/${world.descriptor.id}/${node.id}/outcome-${sha256Hex(`${request.runId}|${world.descriptor.id}|${node.id}`).slice(0, 16)}`;
  if (unitFrom(world.contentHash, node.id, "failure") < failureProbability) {
    const classIndex = Math.min(
      Math.floor(unitFrom(node.id, world.contentHash, "failure-class") * LAB_FAILURE_CLASSES.length),
      LAB_FAILURE_CLASSES.length - 1,
    );
    return {
      runId: request.runId,
      worldId: world.descriptor.id,
      pipelineNodeId: node.id,
      qualityScore: roundTo(quality * 0.55, 4),
      failureClass: LAB_FAILURE_CLASSES[classIndex]!,
      evidenceRef,
      completedAt: request.submittedAt,
      simulated: true,
    };
  }
  return {
    runId: request.runId,
    worldId: world.descriptor.id,
    pipelineNodeId: node.id,
    qualityScore: quality,
    failureClass: null,
    evidenceRef,
    completedAt: request.submittedAt,
    simulated: true,
  };
}
