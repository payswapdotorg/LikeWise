// Registry integrity tests for the W2C capture technology additions —
// coverage area 1: every profile has license + source URL; unique ids;
// nothing unverified is presented as verified (truth law).
import assert from "node:assert/strict";
import test from "node:test";
import { CAPTURE_SEED_PROFILES, createCaptureRegistry } from "./captureSeedProfiles.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { createRegistry, validateRegistryIntegrity } from "./registry.js";

const EXPECTED_CAPTURE_IDS = [
  "depth-anything",
  "mediapipe",
  "mmpose",
  "openpose",
  "segment-anything",
  "smplx",
  "tfjs-pose",
  "yolo-seg",
];

test("capture registry: integrity rules pass for the combined W1C+W2C registry", () => {
  const registry = createCaptureRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.deepEqual(report.issues, []);
  assert.equal(report.valid, true);
});

test("capture registry: every profile has a license with name and source URL", () => {
  for (const profile of CAPTURE_SEED_PROFILES) {
    assert.ok(profile.license.name.length > 0, `${profile.id}: license name`);
    assert.ok(profile.license.sourceUrl.startsWith("https://"), `${profile.id}: license sourceUrl`);
    assert.ok(profile.maintenance.length > 0, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.sourceUrl.startsWith("https://"), `${profile.id}: maintenance sourceUrl`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(signal.date), `${profile.id}: maintenance date is ISO`);
    }
    assert.ok(profile.repoUrl.startsWith("https://"), `${profile.id}: repoUrl`);
    assert.ok(profile.provenance.sourceUrls.length > 0, `${profile.id}: provenance sourceUrls`);
    assert.equal(profile.provenance.researchDate, "2026-10-09");
  }
});

test("capture registry: ids are unique across the combined registry (no W1C/W2C collisions)", () => {
  const ids = [...SEED_PROFILES, ...CAPTURE_SEED_PROFILES].map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  const registry = createCaptureRegistry();
  assert.deepEqual(
    registry.ids(),
    [...SEED_PROFILES.map((profile) => profile.id), ...EXPECTED_CAPTURE_IDS].sort(),
  );
  assert.equal(registry.profiles.length, 18);
});

test("capture registry: exactly the eight researched candidate ids, deterministically ordered", () => {
  const registry = createCaptureRegistry();
  const captureIds = registry.ids().filter((id) => EXPECTED_CAPTURE_IDS.includes(id));
  assert.deepEqual(captureIds, EXPECTED_CAPTURE_IDS);
  assert.equal(CAPTURE_SEED_PROFILES.length, 8);
});

test("capture registry: all web-sourced license claims are marked verified with sources", () => {
  // Every capture license was fetched and read during the one-time W2C
  // research; the truth law requires each to carry its source URL and none
  // to be presented as verified without one (also asserted by integrity rules).
  for (const profile of CAPTURE_SEED_PROFILES) {
    assert.equal(profile.license.verified, true, `${profile.id}: license verified`);
  }
});

test("capture registry: unverified aspects are explicitly listed, never silently verified", () => {
  for (const profile of CAPTURE_SEED_PROFILES) {
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

test("capture registry: research-only and AGPL licenses are honest blockers, not forced into SPDX", () => {
  const openpose = CAPTURE_SEED_PROFILES.find((profile) => profile.id === "openpose");
  assert.ok(openpose);
  assert.equal(openpose.license.spdxId, null, "OpenPose custom academic license is not forced into an SPDX id");
  assert.ok(/noncommercial/i.test(openpose.license.note), "OpenPose license note discloses non-commercial restriction");
  assert.ok(openpose.license.note.includes("Carnegie Mellon"), "OpenPose license note names the licensor");

  const smplx = CAPTURE_SEED_PROFILES.find((profile) => profile.id === "smplx");
  assert.ok(smplx);
  assert.equal(smplx.license.spdxId, null, "SMPL-X research license is not forced into an SPDX id");
  assert.ok(/non-commercial/i.test(smplx.license.note), "SMPL-X license note discloses non-commercial restriction");

  const yoloSeg = CAPTURE_SEED_PROFILES.find((profile) => profile.id === "yolo-seg");
  assert.ok(yoloSeg);
  assert.equal(yoloSeg.license.spdxId, "AGPL-3.0-only", "Ultralytics license recorded as AGPL-3.0-only");
  assert.ok(yoloSeg.license.note.includes("AGPL"), "Ultralytics note discloses AGPL obligations");
});

test("capture registry: SAM/SAM2 profile carries the verified model+code license nuance", () => {
  const sam = CAPTURE_SEED_PROFILES.find((profile) => profile.id === "segment-anything");
  assert.ok(sam);
  assert.equal(sam.license.spdxId, "Apache-2.0");
  assert.ok(sam.license.note.includes("SAM 2"), "note covers SAM 2 checkpoints and code");
  assert.ok(sam.provenance.sourceUrls.some((url) => url.includes("facebookresearch/sam2")), "sam2 repo in provenance");
  const commitSignals = sam.maintenance.filter((signal) => signal.kind === "github-commit");
  assert.equal(commitSignals.length, 2, "SAM + SAM2 last-commit maintenance signals");
});

test("capture registry: integrity rules catch fabricated defects (guard against false positives)", () => {
  const first = CAPTURE_SEED_PROFILES[0];
  const second = CAPTURE_SEED_PROFILES[1];
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
