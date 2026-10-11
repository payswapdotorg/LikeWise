// Registry integrity tests for the W3C reconstruction technology additions —
// coverage area 1: every profile has license + source URL; unique ids across
// the combined W1C+W2C+W3C registry; nothing unverified is presented as
// verified (truth law); honest license blockers are recorded as blockers.
import assert from "node:assert/strict";
import test from "node:test";
import {
  GEOMETRY_RECONSTRUCTION_SEED_PROFILES,
  createReconstructionRegistry,
} from "./reconstructionSeedProfiles.js";
import { NEURAL_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionNeuralSeedProfiles.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { CAPTURE_SEED_PROFILES } from "./captureSeedProfiles.js";
import { createRegistry, validateRegistryIntegrity } from "./registry.js";

const W3C_PROFILES = [...GEOMETRY_RECONSTRUCTION_SEED_PROFILES, ...NEURAL_RECONSTRUCTION_SEED_PROFILES];
const EXPECTED_GEOMETRY_IDS = ["colmap", "open3d", "openmvs"];
const EXPECTED_NEURAL_IDS = [
  "animatablenerf",
  "econ",
  "gaussian-splatting",
  "gaussianavatars",
  "icon",
  "instantavatar",
  "pifu",
  "pifuhd",
];
const EXPECTED_W3C_IDS = [...EXPECTED_GEOMETRY_IDS, ...EXPECTED_NEURAL_IDS].sort();

test("reconstruction registry: integrity rules pass for the combined W1C+W2C+W3C registry", () => {
  const registry = createReconstructionRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.deepEqual(report.issues, []);
  assert.equal(report.valid, true);
});

test("reconstruction registry: every W3C profile has a license with name and source URL", () => {
  for (const profile of W3C_PROFILES) {
    assert.ok(profile.license.name.length > 0, `${profile.id}: license name`);
    assert.ok(profile.license.sourceUrl.startsWith("https://"), `${profile.id}: license sourceUrl`);
    assert.ok(profile.maintenance.length > 0, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.sourceUrl.startsWith("https://"), `${profile.id}: maintenance sourceUrl`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(signal.date), `${profile.id}: maintenance date is ISO`);
    }
    assert.ok(profile.repoUrl.startsWith("https://"), `${profile.id}: repoUrl`);
    assert.ok(profile.provenance.sourceUrls.length > 0, `${profile.id}: provenance sourceUrls`);
    assert.equal(profile.provenance.researchDate, "2026-10-11");
    assert.equal(profile.editorCapable, false, `${profile.id}: reconstruction profiles are not editors`);
  }
});

test("reconstruction registry: ids are unique across the combined registry (no W1C/W2C/W3C collisions)", () => {
  const ids = [...SEED_PROFILES, ...CAPTURE_SEED_PROFILES, ...W3C_PROFILES].map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  const registry = createReconstructionRegistry();
  assert.equal(registry.profiles.length, 29);
  for (const id of EXPECTED_W3C_IDS) {
    assert.ok(registry.byId(id), `${id}: present in the combined registry`);
  }
});

test("reconstruction registry: exactly the eleven researched W3C additions, deterministically ordered", () => {
  const registry = createReconstructionRegistry();
  const w3cIds = registry.ids().filter((id) => EXPECTED_W3C_IDS.includes(id));
  assert.deepEqual(w3cIds, EXPECTED_W3C_IDS);
  assert.equal(GEOMETRY_RECONSTRUCTION_SEED_PROFILES.length, 3);
  assert.equal(NEURAL_RECONSTRUCTION_SEED_PROFILES.length, 8);
});

test("reconstruction registry: all web-sourced license claims are marked verified with sources", () => {
  // Every W3C license was fetched and read during the one-time research; the
  // truth law requires each to carry its source URL and none to be presented
  // as verified without one (also asserted by integrity rules).
  for (const profile of W3C_PROFILES) {
    assert.equal(profile.license.verified, true, `${profile.id}: license verified`);
  }
});

test("reconstruction registry: unverified aspects are explicitly listed, never silently verified", () => {
  for (const profile of W3C_PROFILES) {
    for (const claim of profile.provenance.unverifiedClaims) {
      assert.ok(claim.length > 0, `${profile.id}: non-empty unverified claim`);
    }
    // compatibility summaries are engineering assessments — must not claim verification
    assert.equal(profile.compatibility.verified, false, `${profile.id}: compatibility is an assessment`);
    for (const signal of profile.maintenance) {
      assert.equal(signal.verified, true, `${profile.id}: maintenance signal verified (fetched during research)`);
    }
  }
});

test("reconstruction registry: permissive licenses recorded with SPDX ids (COLMAP, Open3D, PIFu)", () => {
  const colmap = W3C_PROFILES.find((profile) => profile.id === "colmap");
  assert.ok(colmap);
  assert.equal(colmap.license.spdxId, "BSD-3-Clause", "COLMAP new-BSD recorded as BSD-3-Clause");
  assert.ok(colmap.license.note.includes("dependencies"), "COLMAP note discloses the dependency-license caveat");

  const open3d = W3C_PROFILES.find((profile) => profile.id === "open3d");
  assert.ok(open3d);
  assert.equal(open3d.license.spdxId, "MIT", "Open3D recorded as MIT");

  const pifu = W3C_PROFILES.find((profile) => profile.id === "pifu");
  assert.ok(pifu);
  assert.equal(pifu.license.spdxId, "MIT", "PIFu recorded as MIT");
  assert.ok(pifu.license.sourceUrl.includes("LICENSE.txt"), "PIFu license fetched from LICENSE.txt");
});

test("reconstruction registry: copyleft and non-commercial blockers are honest, not forced into SPDX", () => {
  const openmvs = W3C_PROFILES.find((profile) => profile.id === "openmvs");
  assert.ok(openmvs);
  assert.equal(openmvs.license.spdxId, "AGPL-3.0-or-later", "OpenMVS recorded as AGPL-3.0-or-later");
  assert.ok(openmvs.license.note.includes("legal review"), "OpenMVS note discloses AGPL obligations");

  const pifuhd = W3C_PROFILES.find((profile) => profile.id === "pifuhd");
  assert.ok(pifuhd);
  assert.equal(pifuhd.license.spdxId, null, "PIFuHD CC BY-NC 4.0 is not forced into an SPDX id");
  assert.ok(/non.?commercial/i.test(pifuhd.license.name), "PIFuHD license name discloses NonCommercial");

  const gaussianSplatting = W3C_PROFILES.find((profile) => profile.id === "gaussian-splatting");
  assert.ok(gaussianSplatting);
  assert.equal(gaussianSplatting.license.spdxId, null, "Inria gaussian-splatting license is custom (non-SPDX)");
  assert.ok(/non-commercial/i.test(gaussianSplatting.license.note), "gaussian-splatting note discloses non-commercial restriction");

  const gaussianAvatars = W3C_PROFILES.find((profile) => profile.id === "gaussianavatars");
  assert.ok(gaussianAvatars);
  assert.equal(gaussianAvatars.license.spdxId, null, "GaussianAvatars CC BY-NC-SA 4.0 is not forced into an SPDX id");
  assert.ok(/NonCommercial-ShareAlike/i.test(gaussianAvatars.license.name), "GaussianAvatars name discloses NC-SA");
});

test("reconstruction registry: research-only implicit-method blockers carry their restriction (ICON, ECON)", () => {
  for (const id of ["icon", "econ"]) {
    const profile = W3C_PROFILES.find((entry) => entry.id === id);
    assert.ok(profile, `${id}: profile present`);
    assert.equal(profile.license.spdxId, null, `${id}: research-only license is not forced into an SPDX id`);
    assert.ok(/non-commercial/i.test(profile.license.note), `${id}: note discloses non-commercial restriction`);
    assert.ok(profile.provenance.unverifiedClaims.some((claim) => claim.includes("SMPL-X")), `${id}: SMPL-X chain constraint listed`);
  }
});

test("reconstruction registry: InstantAvatar records the verified absence of a license as a blocker", () => {
  const instantavatar = W3C_PROFILES.find((profile) => profile.id === "instantavatar");
  assert.ok(instantavatar);
  assert.equal(instantavatar.license.spdxId, null, "no SPDX id for a repo with no license file");
  assert.ok(/no license file found/i.test(instantavatar.license.name), "license name states the absence");
  assert.ok(/all rights reserved/i.test(instantavatar.license.note), "note states default copyright applies");
  assert.ok(
    instantavatar.provenance.unverifiedClaims.some((claim) => claim.includes("absence verified")),
    "absence claim scoped to the repository files",
  );
});

test("reconstruction registry: AnimatableNeRF PRL v1.0 discloses the registration obligation", () => {
  const animatable = W3C_PROFILES.find((profile) => profile.id === "animatablenerf");
  assert.ok(animatable);
  assert.equal(animatable.license.spdxId, null, "PRL v1.0 is custom (non-SPDX)");
  assert.ok(/registration/i.test(animatable.license.note), "note discloses the registration requirement");
  assert.ok(animatable.provenance.unverifiedClaims.some((claim) => claim.includes("not an SPDX-listed license")));
});

test("reconstruction registry: SMPL / SMPL-X is covered by the existing W2C smplx profile (no duplicate)", () => {
  const registry = createReconstructionRegistry();
  const smplx = registry.byId("smplx");
  assert.ok(smplx, "smplx profile present from W2C");
  assert.equal(smplx.license.verified, true, "smplx license verified in W2C research");
  const smplLikeIds = registry.ids().filter((id) => id.startsWith("smpl"));
  assert.deepEqual(smplLikeIds, ["smplx"], "no duplicate SMPL-family entry added in W3C");
});

test("reconstruction registry: integrity rules catch fabricated defects (guard against false positives)", () => {
  const first = W3C_PROFILES[0];
  const second = W3C_PROFILES[1];
  assert.ok(first && second);
  const bad = createRegistry([
    {
      ...first,
      license: { ...first.license, verified: false },
      provenance: { ...first.provenance, unverifiedClaims: [] },
    },
    { ...second, id: first.id },
  ]);
  const report = validateRegistryIntegrity(bad);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.includes("unverified license not listed")));
  assert.ok(report.issues.some((issue) => issue.includes("duplicate id")));
});
