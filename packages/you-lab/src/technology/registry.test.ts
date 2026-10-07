// Registry integrity tests (W1C) — coverage area 1.
import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultRegistry, SEED_PROFILES } from "./seedProfiles.js";
import { createRegistry, validateRegistryIntegrity } from "./registry.js";

const EXPECTED_IDS = [
  "blender",
  "excalidraw",
  "gltf-transform",
  "openreel",
  "opentimelineio",
  "openusd",
  "react-three-fiber",
  "svg-edit",
  "three-js",
  "three-vrm",
];

test("registry: integrity rules pass for the researched seed set", () => {
  const registry = createDefaultRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.deepEqual(report.issues, []);
  assert.equal(report.valid, true);
});

test("registry: every profile has a license with name and source URL", () => {
  for (const profile of SEED_PROFILES) {
    assert.ok(profile.license.name.length > 0, `${profile.id}: license name`);
    assert.ok(profile.license.sourceUrl.startsWith("https://"), `${profile.id}: license sourceUrl`);
    assert.ok(profile.maintenance.length > 0, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.sourceUrl.startsWith("https://"), `${profile.id}: maintenance sourceUrl`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(signal.date), `${profile.id}: maintenance date is ISO`);
    }
  }
});

test("registry: ids are unique across all profiles", () => {
  const ids = SEED_PROFILES.map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("registry: all web-sourced license claims are marked verified with sources", () => {
  // Every seed license was fetched and read during the one-time research; the
  // truth law requires each to carry its source URL (asserted above) and none
  // to be presented as verified without one (asserted by integrity rules).
  for (const profile of SEED_PROFILES) {
    assert.equal(profile.license.verified, true, `${profile.id}: license verified`);
    assert.ok(profile.provenance.sourceUrls.length > 0, `${profile.id}: provenance sourceUrls`);
    assert.equal(profile.provenance.researchDate, "2026-10-08");
  }
});

test("registry: unverified aspects are explicitly listed, never silently verified", () => {
  for (const profile of SEED_PROFILES) {
    for (const claim of profile.provenance.unverifiedClaims) {
      assert.ok(claim.length > 0, `${profile.id}: non-empty unverified claim`);
    }
    // compatibility summaries are engineering assessments — must not claim verification
    assert.equal(profile.compatibility.verified, false, `${profile.id}: compatibility is an assessment`);
  }
  const openusd = SEED_PROFILES.find((profile) => profile.id === "openusd");
  assert.ok(openusd);
  assert.equal(openusd.license.spdxId, null, "OpenUSD custom license is not forced into an SPDX id");
  assert.ok(openusd.license.note.includes("non-SPDX"), "OpenUSD license note explains custom license");
});

test("registry: honest license nuances are recorded", () => {
  const svgEdit = SEED_PROFILES.find((profile) => profile.id === "svg-edit");
  assert.ok(svgEdit);
  assert.ok(svgEdit.license.spdxId?.includes("MIT"), "svgedit aggregate includes MIT");
  assert.ok(svgEdit.license.note.includes("licenseInfo.json"), "svgedit per-file map referenced");
  const blender = SEED_PROFILES.find((profile) => profile.id === "blender");
  assert.ok(blender);
  assert.equal(blender.license.spdxId, "GPL-2.0-or-later");
});

test("registry: exactly the ten researched candidate ids, deterministically ordered", () => {
  const registry = createDefaultRegistry();
  assert.deepEqual(registry.ids(), EXPECTED_IDS);
  assert.equal(SEED_PROFILES.length, 10);
});

test("registry: integrity rules catch fabricated defects (guard against false positives)", () => {
  const first = SEED_PROFILES[0];
  const second = SEED_PROFILES[1];
  assert.ok(first && second);
  const bad = createRegistry([
    {
      ...first,
      license: { ...first.license, sourceUrl: "" },
    },
    { ...second, id: first.id },
  ]);
  const report = validateRegistryIntegrity(bad);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.includes("license sourceUrl missing")));
  assert.ok(report.issues.some((issue) => issue.includes("duplicate id")));
});
