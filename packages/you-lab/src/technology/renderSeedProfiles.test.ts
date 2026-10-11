// Registry integrity tests for the W4C render technology additions —
// coverage area 1: every profile has license + source URL; unique ids across
// the combined W1C+W2C+W3C+W4C registry; nothing unverified is presented as
// verified (truth law); honest license blockers are recorded as blockers;
// earlier-wave profiles are REUSED for the same real technologies (the W3C
// smplx precedent) — never duplicated.
import assert from "node:assert/strict";
import test from "node:test";
import { RENDER_SEED_PROFILES, createRenderRegistry } from "./renderSeedProfiles.js";
import { RENDER_MOTION_SEED_PROFILES } from "./renderMotionSeedProfiles.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { CAPTURE_SEED_PROFILES } from "./captureSeedProfiles.js";
import {
  GEOMETRY_RECONSTRUCTION_SEED_PROFILES,
} from "./reconstructionSeedProfiles.js";
import { NEURAL_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionNeuralSeedProfiles.js";
import { createRegistry, validateRegistryIntegrity } from "./registry.js";

const W4C_PROFILES = [...RENDER_MOTION_SEED_PROFILES, ...RENDER_SEED_PROFILES];
const EXPECTED_RENDER_ADDITIONS = [
  "animatediff",
  "diffusers",
  "film",
  "gsplat",
  "gvhmr",
  "libigl",
  "rife",
  "rigify",
  "rokoko-studio",
  "three",
  "vibe",
];
/** Reused from earlier waves (same real technologies — no duplicates). */
const REUSED_IDS = ["blender", "mediapipe", "mmpose", "openpose"];

test("render registry: integrity rules pass for the combined W1C+W2C+W3C+W4C registry", () => {
  const registry = createRenderRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.deepEqual(report.issues, []);
  assert.equal(report.valid, true);
});

test("render registry: every W4C profile has a license with name and source URL", () => {
  for (const profile of W4C_PROFILES) {
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
    assert.equal(profile.editorCapable, false, `${profile.id}: render additions are not editors`);
  }
});

test("render registry: ids are unique across the combined registry (no W1C/W2C/W3C/W4C collisions)", () => {
  const ids = [
    ...SEED_PROFILES,
    ...CAPTURE_SEED_PROFILES,
    ...GEOMETRY_RECONSTRUCTION_SEED_PROFILES,
    ...NEURAL_RECONSTRUCTION_SEED_PROFILES,
    ...W4C_PROFILES,
  ].map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  const registry = createRenderRegistry();
  assert.equal(registry.profiles.length, 40);
  for (const id of [...EXPECTED_RENDER_ADDITIONS, ...REUSED_IDS]) {
    assert.ok(registry.byId(id), `${id}: present in the combined registry`);
  }
});

test("render registry: exactly the eleven researched W4C additions, deterministically ordered", () => {
  const registry = createRenderRegistry();
  const w4cIds = registry.ids().filter((id) => EXPECTED_RENDER_ADDITIONS.includes(id));
  assert.deepEqual(w4cIds, [...EXPECTED_RENDER_ADDITIONS].sort());
  assert.equal(RENDER_SEED_PROFILES.length, 9);
  assert.equal(RENDER_MOTION_SEED_PROFILES.length, 2);
});

test("render registry: the earlier-wave profiles are REUSED, never duplicated (smplx precedent)", () => {
  const addedIds = RENDER_SEED_PROFILES.map((profile) => profile.id);
  for (const reused of REUSED_IDS) {
    assert.ok(!addedIds.includes(reused), `${reused} is reused from an earlier wave, not re-registered`);
  }
  // The reused technologies resolve to their original wave profiles.
  const registry = createRenderRegistry();
  assert.equal(registry.byId("blender")?.kind, "editor", "blender keeps its W1C editor profile");
  assert.equal(registry.byId("blender")?.license.spdxId, "GPL-2.0-or-later");
  assert.equal(registry.byId("mediapipe")?.license.spdxId, "Apache-2.0", "mediapipe keeps its W2C capture profile");
  assert.equal(registry.byId("mmpose")?.license.spdxId, "Apache-2.0", "mmpose keeps its W2C capture profile");
  assert.equal(registry.byId("openpose")?.license.spdxId, null, "openpose keeps its W2C non-commercial profile");
});

test("render registry: the five candidate families are each represented by real researched profiles", () => {
  const registry = createRenderRegistry();
  const byFamily: Record<string, string[]> = {
    "motion-extraction": ["gvhmr", "mediapipe", "mmpose", "openpose", "vibe"],
    retargeting: ["rigify", "rokoko-studio", "libigl"],
    "image-render": ["diffusers"],
    "video-render": ["animatediff", "rife", "film"],
    "3d-render": ["blender", "three", "gsplat"],
  };
  for (const [family, ids] of Object.entries(byFamily)) {
    for (const id of ids) {
      assert.ok(registry.byId(id), `${id} (${family}) present in the combined registry`);
    }
  }
  // W4C-added profiles carry their family capability tag.
  const tagged: Record<string, string> = {
    gvhmr: "motion-extraction",
    vibe: "motion-extraction",
    "rokoko-studio": "retargeting",
    rigify: "retargeting",
    libigl: "retargeting",
    diffusers: "image-render",
    animatediff: "video-render",
    rife: "video-render",
    film: "video-render",
    three: "3d-render",
    gsplat: "3d-render",
  };
  for (const [id, family] of Object.entries(tagged)) {
    const profile = W4C_PROFILES.find((entry) => entry.id === id);
    assert.ok(profile, `${id} present`);
    assert.ok(profile.capabilityTags.includes(family), `${id}: capabilityTags include "${family}"`);
  }
});

test("render registry: SPDX licenses are recorded with the license source URL (truth law)", () => {
  const expectedAdditions: Record<string, string | null> = {
    animatediff: "Apache-2.0",
    diffusers: "Apache-2.0",
    film: "Apache-2.0",
    gsplat: "Apache-2.0",
    gvhmr: null,
    libigl: "MPL-2.0",
    rife: "MIT",
    rigify: "GPL-2.0-or-later",
    "rokoko-studio": null,
    three: "MIT",
    vibe: null,
  };
  for (const [id, spdxId] of Object.entries(expectedAdditions)) {
    const profile = W4C_PROFILES.find((entry) => entry.id === id);
    assert.ok(profile, `${id} present`);
    assert.equal(profile.license.spdxId, spdxId, `${id}: spdxId`);
    assert.ok(profile.license.sourceUrl.length > 0, `${id}: license sourceUrl recorded`);
  }
});

test("render registry: unverified claims never masquerade as verified (truth law)", () => {
  const rokoko = W4C_PROFILES.find((entry) => entry.id === "rokoko-studio");
  assert.ok(rokoko);
  assert.equal(rokoko.license.verified, false, "rokoko-studio license stays unverified (EULA not fetched)");
  const flagsLicense = rokoko.provenance.unverifiedClaims.some((claim) => claim.toLowerCase().includes("license"));
  assert.ok(flagsLicense, "rokoko-studio unverified license is listed in provenance.unverifiedClaims");
  const flagsMaintenance = rokoko.provenance.unverifiedClaims.some((claim) => claim.toLowerCase().includes("maintenance"));
  assert.ok(flagsMaintenance, "rokoko-studio plugin-signal caveat is listed in provenance.unverifiedClaims");
  for (const profile of W4C_PROFILES) {
    if (!profile.license.verified) {
      const flagged = profile.provenance.unverifiedClaims.some((claim) => claim.toLowerCase().includes("license"));
      assert.ok(flagged, `${profile.id}: unverified license must be listed`);
    }
    for (const signal of profile.maintenance) {
      if (!signal.verified) {
        const flagged = profile.provenance.unverifiedClaims.some((claim) => claim.toLowerCase().includes("maintenance"));
        assert.ok(flagged, `${profile.id}: unverified maintenance must be listed`);
      }
    }
  }
});

test("render registry: the research record corrects itself honestly (truth law)", () => {
  const registry = createRenderRegistry();
  // OpenPose EXISTS at the correct org path and is REUSED from W2C (the
  // initial W4C 404 was a wrong-org-path error — corrected, not hidden).
  const openpose = registry.byId("openpose");
  assert.ok(openpose, "openpose present (reused W2C profile, correct repo path)");
  assert.equal(openpose.license.spdxId, null, "openpose non-commercial license fact preserved");
  // No profile anywhere claims WHAM (code never found at research time).
  assert.ok(!registry.byId("wham"), "no profile claims WHAM (code not found)");
  // The scene-class family is registered by its real representative GVHMR,
  // with the WHAM basis disclosed on the profile.
  const gvhmr = W4C_PROFILES.find((entry) => entry.id === "gvhmr");
  assert.ok(gvhmr);
  assert.ok(
    gvhmr.compatibility.summary.includes("not found at research time"),
    "gvhmr profile discloses the WHAM-code-not-found basis",
  );
  assert.ok(
    gvhmr.compatibility.summary.includes("scene-class"),
    "gvhmr registers the scene-class family",
  );
  const vibe = W4C_PROFILES.find((entry) => entry.id === "vibe");
  assert.ok(vibe);
  assert.ok(
    vibe.provenance.unverifiedClaims.some((claim) => claim.includes("WHAM code not found")),
    "vibe profile discloses the WHAM-code-not-found basis",
  );
});

test("render registry: empty registry still validates (base-case integrity)", () => {
  const report = validateRegistryIntegrity(createRegistry([]));
  assert.equal(report.valid, true);
});
