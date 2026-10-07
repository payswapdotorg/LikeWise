// Contract seam tests (W1C) — coverage area 7: mapping onto the frozen
// @zcode/shared YOU contract v1 produces valid frozen-contract shapes, and
// contractSeam.ts is the ONLY module touching the frozen contract.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { recommendationForArtifact, toEditorRecommendation, toSolutionPatchOperations } from "./contractSeam.js";
import { createMockEditorAdapter } from "./adapters/mockEditorAdapter.js";
import type { CandidateOperation, NeutralEntity } from "./adapters/editorAdapterSeam.js";
import { deriveEditorCapabilityProfiles } from "./technology/editorCapability.js";
import { createDefaultRegistry } from "./technology/seedProfiles.js";

const registry = createDefaultRegistry();
const capabilities = deriveEditorCapabilityProfiles(registry);

test("contract seam: toEditorRecommendation produces a valid frozen EditorRecommendation shape", () => {
  const blender = capabilities.find((profile) => profile.technologyId === "blender");
  assert.ok(blender);
  const recommendation = toEditorRecommendation(blender, registry);
  // frozen contract fields: editorId, editorName, rationale, exportFormat
  assert.equal(typeof recommendation.editorId, "string");
  assert.ok(recommendation.editorId.length > 0);
  assert.equal(recommendation.editorName, "Blender");
  assert.ok(recommendation.rationale.includes("tier 3"));
  assert.ok(recommendation.rationale.includes("GPL"));
  assert.ok(recommendation.rationale.includes("https://"));
  assert.ok(["glb", "gltf"].includes(recommendation.exportFormat));
});

test("contract seam: recommendations are deterministic and cite verified license sources", () => {
  const svgEdit = capabilities.find((profile) => profile.technologyId === "svg-edit");
  assert.ok(svgEdit);
  const a = toEditorRecommendation(svgEdit, registry);
  const b = toEditorRecommendation(svgEdit, registry);
  assert.deepEqual(a, b);
  const technology = registry.byId("svg-edit");
  assert.ok(technology);
  assert.ok(a.rationale.includes(technology.license.sourceUrl));
});

test("contract seam: toSolutionPatchOperations maps candidate operations 1:1 onto frozen ops", () => {
  const entity: NeutralEntity = {
    id: "ent-1",
    kind: "synthetic-human",
    label: "Synthetic Human A",
    transform: { position: [0, 1, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
    attributes: { quality: 0.7, simulated: true },
  };
  const operations: CandidateOperation[] = [
    { op: "upsert_entity", entity },
    { op: "remove_entity", entityId: "ent-2" },
    { op: "update_environment", environment: { ambientIntensity: 0.5 } },
  ];
  const frozen = toSolutionPatchOperations(operations);
  assert.equal(frozen.length, 3);
  assert.ok(frozen[0] && frozen[0].op === "upsert_entity");
  if (frozen[0].op === "upsert_entity") {
    assert.equal(frozen[0].entity.id, "ent-1");
    assert.equal(frozen[0].entity.kind, "synthetic-human");
    assert.deepEqual(frozen[0].entity.transform.position, [0, 1, 2]);
  }
  assert.ok(frozen[1] && frozen[1].op === "remove_entity" && frozen[1].entityId === "ent-2");
  assert.ok(frozen[2] && frozen[2].op === "update_environment");
  if (frozen[2].op === "update_environment") {
    assert.equal(frozen[2].environment.ambientIntensity, 0.5);
  }
});

test("contract seam: recommendationForArtifact resolves through the registry", () => {
  const blenderCapability = capabilities.find((profile) => profile.technologyId === "blender");
  assert.ok(blenderCapability);
  const adapter = createMockEditorAdapter(blenderCapability);
  const artifact = adapter.exportArtifact({
    solutionId: "solution-1",
    versionId: "version-1",
    entities: [],
    environment: { keyLightDirection: [1, 0, 0], ambientIntensity: 0.3, background: "#000000" },
    targetTechnologyId: "blender",
    reason: "agent-edit",
  });
  const recommendation = recommendationForArtifact(artifact, capabilities, registry);
  assert.ok(recommendation);
  assert.equal(recommendation.editorId, "blender");
  const unknown = recommendationForArtifact(
    { ...artifact, technologyId: "not-a-technology" },
    capabilities,
    registry,
  );
  assert.equal(unknown, null);
});

test("contract seam: contractSeam.ts is the ONLY module referencing the frozen contract", () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)));
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "contractSeam.ts") {
        const text = readFileSync(path, "utf8");
        if (text.includes("shared/src/you/contract") || text.includes('from "@zcode/shared"')) {
          offenders.push(path);
        }
      }
    }
  };
  walk(srcDir);
  assert.deepEqual(offenders, [], `frozen contract must only be touched at the seam: ${offenders.join(", ")}`);
});
