// Editing capability profile tests (W5C) — coverage: the v5-shaped capability
// derivation covers all three editor kinds with researched formats and
// round-trip safety assessments, is deterministic, derives from the registry
// (never a runtime authority), and maps interchange formats from capability
// tags.
import assert from "node:assert/strict";
import test from "node:test";
import { createEditorRegistry } from "../technology/editorSeedProfiles.js";
import {
  deriveEditingCapabilityProfiles,
  editingCapabilityById,
} from "./capabilityProfiles.js";

const registry = createEditorRegistry();
const profiles = deriveEditingCapabilityProfiles(registry);

test("editing capability: derivation covers all three W5C editor kinds", () => {
  const kinds = new Set(profiles.map((profile) => profile.editorKind));
  assert.deepEqual([...kinds].sort(), ["embedded", "external", "native"]);
});

test("editing capability: the W5C candidate classes derive profiles", () => {
  for (const id of [
    // native class: Tier 1 + VS Code-class
    "three-js",
    "react-three-fiber",
    "vscode",
    // embedded class: Monaco/CodeMirror/ProseMirror + W1C embedded hosts
    "monaco-editor",
    "codemirror",
    "prosemirror",
    "svg-edit",
    "excalidraw",
    "openreel",
    // external class: DCC/scene/image/video pipelines
    "blender",
    "godot",
    "gimp",
    "krita",
    "kdenlive",
  ]) {
    const profile = editingCapabilityById(profiles, id);
    assert.ok(profile, `${id}: capability profile derived`);
    assert.ok(profile.supportsFormats.length > 0, `${id}: supportsFormats non-empty`);
    assert.equal(typeof profile.roundTripSafe, "boolean");
    assert.ok(profile.notes.length > 0, `${id}: notes recorded`);
  }
  assert.equal(profiles.length, 14);
});

test("editing capability: interchange formats are not editors (no capability profile)", () => {
  for (const id of ["gltf", "openusd", "gltf-transform", "opentimelineio", "three-vrm"]) {
    assert.equal(editingCapabilityById(profiles, id), null, `${id}: no capability profile (not editorCapable)`);
  }
});

test("editing capability: format support is derived from researched capability tags", () => {
  const vscode = editingCapabilityById(profiles, "vscode");
  assert.ok(vscode);
  assert.deepEqual(vscode.supportsFormats, ["edit-interchange", "json"]);
  const monaco = editingCapabilityById(profiles, "monaco-editor");
  assert.ok(monaco);
  assert.deepEqual(monaco.supportsFormats, ["edit-interchange", "json"]);
  const gimp = editingCapabilityById(profiles, "gimp");
  assert.ok(gimp);
  assert.deepEqual(gimp.supportsFormats, ["jpeg", "png", "webp"]);
  const kdenlive = editingCapabilityById(profiles, "kdenlive");
  assert.ok(kdenlive);
  assert.deepEqual(kdenlive.supportsFormats, ["mp4", "webm"]);
});

test("editing capability: round-trip safety assessments are the authored table", () => {
  const expectations: readonly [string, boolean][] = [
    ["three-js", true],
    ["react-three-fiber", true],
    ["vscode", true],
    ["monaco-editor", true],
    ["codemirror", true],
    ["prosemirror", true],
    ["svg-edit", true],
    ["gimp", true],
    ["krita", true],
    ["excalidraw", false],
    ["openreel", false],
    ["blender", false],
    ["godot", false],
    ["kdenlive", false],
  ];
  for (const [id, safe] of expectations) {
    const profile = editingCapabilityById(profiles, id);
    assert.ok(profile, `${id}: derived`);
    assert.equal(profile.roundTripSafe, safe, `${id}: roundTripSafe`);
  }
});

test("editing capability: derivation is deterministic and registry-backed", () => {
  const again = deriveEditingCapabilityProfiles(createEditorRegistry());
  assert.deepEqual(again, profiles);
  // every profile id resolves to a registered technology (researched data)
  for (const profile of profiles) {
    const technology = registry.byId(profile.id);
    assert.ok(technology, `${profile.id}: backed by a registry profile`);
    assert.equal(profile.displayName, technology.name);
  }
  assert.ok(profiles.every((profile) => profile.derivedFrom.startsWith("you-lab editing-capability table/")));
});
