// Editor capability derivation tests (W1C) — coverage area 2.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveEditorCapabilityProfiles } from "./editorCapability.js";
import { createDefaultRegistry } from "./seedProfiles.js";

const registry = createDefaultRegistry();

test("editorCapability: only editor-capable registry entries derive profiles", () => {
  const profiles = deriveEditorCapabilityProfiles(registry);
  const ids = profiles.map((profile) => profile.technologyId);
  assert.deepEqual(ids, ["blender", "excalidraw", "openreel", "react-three-fiber", "svg-edit", "three-js"]);
  // non-editors (gltf-transform, three-vrm, opentimelineio, openusd) never appear
  for (const excluded of ["gltf-transform", "three-vrm", "opentimelineio", "openusd"]) {
    assert.ok(!ids.includes(excluded), `${excluded} must not derive an editor capability profile`);
  }
});

test("editorCapability: Blender (tier 3) edits 3D geometry/rig domains with glTF support", () => {
  const blender = deriveEditorCapabilityProfiles(registry).find((p) => p.technologyId === "blender");
  assert.ok(blender);
  assert.equal(blender.integrationTier, 3);
  assert.ok(blender.editableAttributeDomains.includes("geometry"));
  assert.ok(blender.editableAttributeDomains.includes("rig"));
  assert.ok(blender.editableAttributeDomains.includes("animation"));
  assert.deepEqual(blender.editableEntityKinds, ["camera-marker", "environment", "light", "prop", "synthetic-human"]);
  const glb = blender.formatSupport.find((entry) => entry.format === "glb");
  assert.ok(glb?.read && glb?.write);
  assert.equal(blender.roundTripRisk, "medium");
});

test("editorCapability: SVG-Edit (tier 2) is 2D-only with high round-trip risk", () => {
  const svgEdit = deriveEditorCapabilityProfiles(registry).find((p) => p.technologyId === "svg-edit");
  assert.ok(svgEdit);
  assert.equal(svgEdit.integrationTier, 2);
  assert.deepEqual(svgEdit.editableAttributeDomains, ["annotation", "vector-2d"]);
  const svg = svgEdit.formatSupport.find((entry) => entry.format === "svg");
  assert.ok(svg?.read && svg?.write && svg?.fidelity === "full");
  assert.equal(svgEdit.roundTripRisk, "high");
});

test("editorCapability: native tier 1 technologies carry low round-trip risk", () => {
  const profiles = deriveEditorCapabilityProfiles(registry);
  const three = profiles.find((p) => p.technologyId === "three-js");
  const r3f = profiles.find((p) => p.technologyId === "react-three-fiber");
  assert.ok(three && r3f);
  assert.equal(three.integrationTier, 1);
  assert.equal(r3f.integrationTier, 1);
  assert.equal(three.roundTripRisk, "low");
  assert.equal(r3f.roundTripRisk, "low");
});

test("editorCapability: OpenReel (tier 2) edits timelines, no entity kinds", () => {
  const openreel = deriveEditorCapabilityProfiles(registry).find((p) => p.technologyId === "openreel");
  assert.ok(openreel);
  assert.deepEqual(openreel.editableAttributeDomains, ["timeline"]);
  assert.deepEqual(openreel.editableEntityKinds, []);
  assert.equal(openreel.roundTripRisk, "high");
});

test("editorCapability: derivation is deterministic and stable-ordered", () => {
  const first = deriveEditorCapabilityProfiles(registry);
  const second = deriveEditorCapabilityProfiles(registry);
  assert.deepEqual(first, second);
  const sorted = [...first].map((p) => p.technologyId).sort();
  assert.deepEqual(first.map((p) => p.technologyId), sorted);
  for (const profile of first) {
    // every derived field is deterministically sorted and non-empty
    assert.deepEqual(profile.editableAttributeDomains, profile.editableAttributeDomains.slice().sort());
    const formats = profile.formatSupport.map((entry) => entry.format);
    assert.deepEqual(formats, formats.slice().sort());
    assert.ok(profile.roundTripRationale.length > 0);
    assert.ok(profile.derivedFrom.length > 0);
  }
});
