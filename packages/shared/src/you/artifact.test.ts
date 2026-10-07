import assert from "node:assert/strict";
import test from "node:test";
import { createDeterministicClock } from "./clock.js";
import type { SolutionIdentity } from "./contract.js";
import { buildFixtureSnapshot } from "./fixture.js";
import { createRngIdFactory } from "./ids.js";
import { createDeterministicRng } from "./rng.js";
import { stableContentHash } from "./serialize.js";
import { SolutionVersionChain } from "./versioning.js";
import {
  buildArtifactPackage,
  diffSolutionStates,
  FIXTURE_EDITOR_RECOMMENDATIONS,
  recommendEditorForSnapshot,
  reImportArtifactPackage,
  serializeArtifactPackage,
  simulateExternalEdit,
} from "./artifact.js";

const SOLUTION: SolutionIdentity = {
  id: "you_solution_artifact1",
  workspaceIdentity: "ws-artifact",
  displayName: "Artifact Test",
};

function makeVersion() {
  // Zero-step clock: repeated builds of the same version must serialize
  // byte-identically (content addressing is independent of build time).
  const deps = { clock: createDeterministicClock({ stepMs: 0 }), ids: createRngIdFactory(createDeterministicRng(71)) };
  const created = SolutionVersionChain.createRoot({
    solution: SOLUTION,
    snapshot: buildFixtureSnapshot("artifact-test"),
    provenanceSource: "fixture:artifact-test",
    deps,
  });
  const changeSet = created.chain.propose({
    baseVersionId: created.root.id,
    operations: [{ op: "adjust_quality", deficiencyClass: "geometry", delta: 0.15 }],
    authorType: "fixture",
  });
  const accepted = created.chain.accept(changeSet);
  assert.ok(accepted.ok);
  return { deps, version: accepted.version, root: created.root };
}

test("the synthetic-human scene recommends Blender (GLB round-trip)", () => {
  const { root } = makeVersion();
  const recommendation = recommendEditorForSnapshot(root.state);
  assert.equal(recommendation.editorId, "blender");
  assert.equal(recommendation.exportFormat, "glb");
  assert.ok(FIXTURE_EDITOR_RECOMMENDATIONS.length >= 2);
});

test("buildArtifactPackage is content-addressed and immutable", () => {
  const { deps, root } = makeVersion();
  const editor = recommendEditorForSnapshot(root.state);
  const first = buildArtifactPackage(root, editor, deps);
  const second = buildArtifactPackage(root, editor, deps);
  assert.equal(first.id, `you_artifact_${stableContentHash(root.state)}`);
  assert.equal(first.id, second.id);
  assert.equal(first.contentHash, stableContentHash(root.state));
  assert.equal(first.versionId, root.id);
  assert.equal(first.format, "glb");
  assert.equal(first.manifest.editorId, "blender");
  assert.equal(first.manifest.simulated, true);
  assert.ok(first.manifest.lineage.includes("fixture:artifact-test"));
  assert.ok(Object.isFrozen(first));
  assert.equal(serializeArtifactPackage(first), serializeArtifactPackage(second));
});

test("simulateExternalEdit produces a new derived package with extended lineage", () => {
  const { deps, root } = makeVersion();
  const editor = recommendEditorForSnapshot(root.state);
  const exported = buildArtifactPackage(root, editor, deps);
  const edited = simulateExternalEdit(
    exported,
    [{ op: "adjust_quality", deficiencyClass: "composition", delta: 0.05 }],
    deps,
  );
  assert.notEqual(edited.id, exported.id);
  assert.equal(edited.manifest.generator, "importer");
  assert.equal(edited.manifest.source, `external-edit:${exported.id}`);
  assert.ok(edited.manifest.lineage.includes(exported.id));
  assert.ok(edited.state.quality.composition !== root.state.quality.composition);
  assert.ok(Object.isFrozen(edited));
});

test("diffSolutionStates reports an exact, truthful diff", () => {
  const { root } = makeVersion();
  const state = root.state;
  const human = state.entities.find((entity) => entity.kind === "synthetic-human");
  assert.ok(human !== undefined);
  const after = {
    ...state,
    entities: [
      ...state.entities.filter((entity) => entity.id !== human.id),
      { ...human, label: "Edited Human", transform: { ...human.transform, position: [1, 0, 0] as const } },
    ],
    environment: { ...state.environment, ambientIntensity: 0.9 },
    quality: { ...state.quality, geometry: (state.quality.geometry ?? 0) + 0.15 },
  };
  const diff = diffSolutionStates(state, after);
  assert.deepEqual(diff.entitiesAdded, []);
  assert.deepEqual(diff.entitiesRemoved, []);
  assert.equal(diff.entitiesChanged.length, 1);
  assert.deepEqual(diff.entitiesChanged[0]?.fields, ["label-kind", "transform"]);
  assert.deepEqual(diff.environmentChanged, ["ambientIntensity"]);
  assert.deepEqual(diff.qualityDeltas, {
    appearance: 0,
    composition: 0,
    geometry: 0.15,
    identity: 0,
    "motion-naturalness": 0,
  });
});

test("reImportArtifactPackage expresses the diff as deterministic ChangeSet operations", () => {
  const { deps, root } = makeVersion();
  const editor = recommendEditorForSnapshot(root.state);
  const exported = buildArtifactPackage(root, editor, deps);
  const edited = simulateExternalEdit(
    exported,
    [
      { op: "adjust_quality", deficiencyClass: "composition", delta: 0.05 },
      { op: "update_environment", environment: { ambientIntensity: 0.9 } },
    ],
    deps,
  );
  const reImported = reImportArtifactPackage(edited, root);
  assert.deepEqual(reImported.diff.qualityDeltas, {
    appearance: 0,
    composition: 0.05,
    geometry: 0,
    identity: 0,
    "motion-naturalness": 0,
  });
  assert.deepEqual(reImported.diff.environmentChanged, ["ambientIntensity"]);
  assert.equal(reImported.diff.entitiesAdded.length, 0);
  const adjustOps = reImported.operations.filter((operation) => operation.op === "adjust_quality");
  assert.equal(adjustOps.length, 1);
  assert.deepEqual(adjustOps[0], { op: "adjust_quality", deficiencyClass: "composition", delta: 0.05 });
  const envOps = reImported.operations.filter((operation) => operation.op === "update_environment");
  assert.equal(envOps.length, 1);
  assert.throws(() => reImportArtifactPackage(edited, { ...root, solutionId: "you_solution_other0001" }));
});
