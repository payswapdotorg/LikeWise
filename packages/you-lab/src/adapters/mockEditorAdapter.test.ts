// Editor adapter seam tests (W1C) — coverage area 3: mock export/import
// round-trip determinism.
import assert from "node:assert/strict";
import test from "node:test";
import { createMockEditorAdapter, mockEditArtifact, roundTripState } from "./mockEditorAdapter.js";
import type { NeutralCanonicalState, NeutralEntity } from "./editorAdapterSeam.js";
import { applyCandidateOperations } from "./editorAdapterSeam.js";
import { deriveEditorCapabilityProfiles } from "../technology/editorCapability.js";
import { createDefaultRegistry } from "../technology/seedProfiles.js";

const registry = createDefaultRegistry();
const blenderCapability = deriveEditorCapabilityProfiles(registry).find((p) => p.technologyId === "blender");
assert.ok(blenderCapability, "blender capability required for the mock adapter fixture");
const adapter = createMockEditorAdapter(blenderCapability);

const entities: NeutralEntity[] = [
  {
    id: "ent-1-human",
    kind: "synthetic-human",
    label: "Synthetic Human A",
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    attributes: { quality: 0.7, simulated: true },
  },
  {
    id: "ent-2-prop",
    kind: "prop",
    label: "Reference Cube",
    transform: { position: [1, 2, 3], rotation: [0, 0.5, 0], scale: [1, 1, 1] },
    attributes: { material: "matte", weightKg: 2 },
  },
];

const state: NeutralCanonicalState = {
  entities,
  environment: { keyLightDirection: [0.5, 0.7, 0.5], ambientIntensity: 0.4, background: "#101418" },
};

test("adapter seam: export -> import -> apply round-trips the canonical state exactly", () => {
  const roundTripped = roundTripState(adapter, state, "solution-1", "version-1");
  assert.deepEqual(roundTripped, state);
});

test("adapter seam: export is byte-identical across repeated calls", () => {
  const request = {
    solutionId: "solution-1",
    versionId: "version-1",
    entities: state.entities,
    environment: state.environment,
    targetTechnologyId: "blender",
    reason: "benchmark" as const,
  };
  const a = adapter.exportArtifact(request);
  const b = adapter.exportArtifact(request);
  assert.deepEqual(a, b);
  assert.equal(a.artifactId, b.artifactId);
  assert.equal(a.provenance.createdAt, null, "deterministic mode mints no timestamp");
  assert.equal(a.provenance.generator, "you-lab-mock-editor-adapter/1");
});

test("adapter seam: diff reports exactly the deterministic simulated edit", () => {
  const request = {
    solutionId: "solution-1",
    versionId: "version-1",
    entities: state.entities,
    environment: state.environment,
    targetTechnologyId: "blender",
    reason: "benchmark" as const,
  };
  const base = adapter.exportArtifact(request);
  const edited = mockEditArtifact(base, {
    scaleEdits: { "ent-1-human": 1.5 },
    addedEntities: [
      {
        id: "ent-3-light",
        kind: "light",
        label: "Added Fill Light",
        transform: { position: [2, 3, 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
        attributes: { intensity: 0.8 },
      },
    ],
    removedEntityIds: ["ent-2-prop"],
    environment: { ambientIntensity: 0.6 },
  });
  const diff = adapter.diff(base, edited);
  assert.deepEqual(diff.addedEntityIds, ["ent-3-light"]);
  assert.deepEqual(diff.removedEntityIds, ["ent-2-prop"]);
  assert.deepEqual(diff.changedEntityIds, ["ent-1-human"]);
  assert.equal(diff.environmentChanged, true);
  assert.equal(diff.identical, false);
});

test("adapter seam: diff of identical artifacts reports identical", () => {
  const request = {
    solutionId: "solution-1",
    versionId: "version-1",
    entities: state.entities,
    environment: state.environment,
    targetTechnologyId: "blender",
    reason: "benchmark" as const,
  };
  const a = adapter.exportArtifact(request);
  const diff = adapter.diff(a, a);
  assert.equal(diff.identical, true);
});

test("adapter seam: validate accepts a well-formed artifact and rejects tampering", () => {
  const request = {
    solutionId: "solution-1",
    versionId: "version-1",
    entities: state.entities,
    environment: state.environment,
    targetTechnologyId: "blender",
    reason: "benchmark" as const,
  };
  const artifact = adapter.exportArtifact(request);
  assert.equal(adapter.validate(artifact).valid, true);
  const tampered = {
    ...artifact,
    content: { ...artifact.content, entities: "not-an-array" },
  };
  const report = adapter.validate(tampered);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.includes("content.entities must be an array")));
  assert.deepEqual([...report.issues], [...report.issues].sort());
});

test("adapter seam: import refuses invalid artifacts (truthful failure, no silent fallback)", () => {
  const request = {
    solutionId: "solution-1",
    versionId: "version-1",
    entities: state.entities,
    environment: state.environment,
    targetTechnologyId: "blender",
    reason: "benchmark" as const,
  };
  const artifact = adapter.exportArtifact(request);
  const tampered = {
    ...artifact,
    content: { ...artifact.content, environment: undefined },
  };
  assert.throws(() => adapter.importArtifact(tampered), /refusing invalid artifact/);
});

test("adapter seam: applyCandidateOperations is a pure deterministic patch", () => {
  const patched = applyCandidateOperations(state, [
    { op: "remove_entity", entityId: "ent-2-prop" },
    { op: "update_environment", environment: { ambientIntensity: 0.9 } },
  ]);
  assert.deepEqual(
    patched.entities.map((entity) => entity.id),
    ["ent-1-human"],
  );
  assert.equal(patched.environment.ambientIntensity, 0.9);
  assert.equal(patched.environment.background, "#101418");
  // source state is untouched (purity)
  assert.equal(state.entities.length, 2);
  assert.equal(state.environment.ambientIntensity, 0.4);
});
