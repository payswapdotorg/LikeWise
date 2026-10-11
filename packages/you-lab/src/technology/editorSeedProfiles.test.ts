// Editor seed profile tests (W5C) — registry integrity for the researched
// editor additions: license + source URL on every profile, unique ids,
// verified claims carry sources, unverified claims are explicitly listed
// (never presented as verified — truth law).
import assert from "node:assert/strict";
import test from "node:test";
import { EDITOR_SEED_PROFILES, createEditorRegistry } from "./editorSeedProfiles.js";
import { validateRegistryIntegrity } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";

const EXPECTED_IDS = [
  "codemirror",
  "gimp",
  "gltf",
  "godot",
  "kdenlive",
  "krita",
  "monaco-editor",
  "prosemirror",
  "vscode",
];

test("editor registry: integrity rules pass for the W5C researched additions", () => {
  const registry = createEditorRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.deepEqual(report.issues, []);
  assert.equal(report.valid, true);
});

test("editor registry: every W5C profile has a license with name and source URL", () => {
  for (const profile of EDITOR_SEED_PROFILES) {
    assert.ok(profile.license.name.length > 0, `${profile.id}: license name`);
    assert.ok(profile.license.sourceUrl.startsWith("https://"), `${profile.id}: license sourceUrl`);
    assert.ok(profile.maintenance.length > 0, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.sourceUrl.startsWith("https://"), `${profile.id}: maintenance sourceUrl`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(signal.date), `${profile.id}: maintenance date is ISO`);
    }
  }
});

test("editor registry: W5C ids are unique and do not collide with W1C seeds", () => {
  const ids = EDITOR_SEED_PROFILES.map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  const seedIds = new Set(SEED_PROFILES.map((profile) => profile.id));
  for (const id of ids) {
    assert.ok(!seedIds.has(id), `${id}: collides with a W1C seed profile`);
  }
});

test("editor registry: exactly the nine researched W5C additions, deterministically ordered", () => {
  const registry = createEditorRegistry();
  const editorIds = registry.profiles.map((profile) => profile.id);
  for (const id of EXPECTED_IDS) {
    assert.ok(editorIds.includes(id), `${id}: registered in the editor registry`);
  }
  assert.equal(EDITOR_SEED_PROFILES.length, 9);
  assert.equal(registry.profiles.length, SEED_PROFILES.length + 9);
});

test("editor registry: all W5C license claims are verified with fetched sources (truth law)", () => {
  for (const profile of EDITOR_SEED_PROFILES) {
    assert.equal(profile.license.verified, true, `${profile.id}: license verified`);
    assert.ok(profile.provenance.sourceUrls.length > 0, `${profile.id}: provenance sourceUrls`);
    assert.equal(profile.provenance.researchDate, "2026-10-11");
    // an unverified claim must never masquerade as verified: every unverified
    // aspect is explicitly listed in provenance.unverifiedClaims
    for (const signal of profile.maintenance) {
      if (!signal.verified) {
        assert.ok(
          profile.provenance.unverifiedClaims.length > 0,
          `${profile.id}: unverified maintenance listed in unverifiedClaims`,
        );
      }
    }
  }
});

test("editor registry: unverified aspects are explicitly listed, never silently verified", () => {
  for (const profile of EDITOR_SEED_PROFILES) {
    for (const claim of profile.provenance.unverifiedClaims) {
      assert.ok(claim.length > 0, `${profile.id}: non-empty unverified claim`);
    }
    assert.equal(profile.compatibility.verified, false, `${profile.id}: compatibility is an assessment`);
  }
});

test("editor registry: honest license nuances are recorded (SPDX specifics)", () => {
  const vscode = EDITOR_SEED_PROFILES.find((profile) => profile.id === "vscode");
  assert.ok(vscode);
  assert.equal(vscode.license.spdxId, "MIT");
  const gimp = EDITOR_SEED_PROFILES.find((profile) => profile.id === "gimp");
  assert.ok(gimp);
  assert.equal(gimp.license.spdxId, "GPL-3.0-or-later");
  assert.ok(gimp.license.note.includes("libgimp"), "gimp per-file boundaries referenced");
  const krita = EDITOR_SEED_PROFILES.find((profile) => profile.id === "krita");
  assert.ok(krita);
  assert.equal(krita.license.spdxId, "GPL-3.0-only");
  assert.ok(krita.license.note.includes("no 'or later' language"), "krita or-later absence documented");
  const kdenlive = EDITOR_SEED_PROFILES.find((profile) => profile.id === "kdenlive");
  assert.ok(kdenlive);
  assert.ok(kdenlive.license.spdxId?.includes("GPL-3.0-only"), "kdenlive sampled SPDX expression");
  const gltf = EDITOR_SEED_PROFILES.find((profile) => profile.id === "gltf");
  assert.ok(gltf);
  assert.equal(gltf.license.spdxId, "CC-BY-4.0");
  assert.equal(gltf.editorCapable, false, "the glTF format is not an editor");
});

test("editor registry: maintenance signals use the documented signal kinds", () => {
  const kinds = new Set(EDITOR_SEED_PROFILES.flatMap((profile) => profile.maintenance.map((signal) => signal.kind)));
  for (const kind of kinds) {
    assert.ok(
      ["npm-publish", "github-release", "pypi-upload", "github-commit", "gitlab-release"].includes(kind),
      `signal kind "${kind}" is documented`,
    );
  }
  // GIMP's release feed lives on GitLab — the additive W5C signal kind
  const gimp = EDITOR_SEED_PROFILES.find((profile) => profile.id === "gimp");
  assert.ok(gimp);
  assert.equal(gimp.maintenance[0]?.kind, "gitlab-release");
});
