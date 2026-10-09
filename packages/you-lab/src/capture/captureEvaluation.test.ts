// Capture evaluation criteria tests (W2C): derivation structure, honest
// markers, registry-backed licensing, determinism-as-assessment.
import assert from "node:assert/strict";
import test from "node:test";
import { createCaptureRegistry } from "../technology/captureSeedProfiles.js";
import {
  captureCandidateIdsForFamily,
  deriveCaptureCandidateProfiles,
  type CaptureCandidateProfile,
} from "./captureEvaluation.js";

const registry = createCaptureRegistry();
const profiles = deriveCaptureCandidateProfiles(registry);

const EXPECTED_IDS = [
  "depth-anything",
  "mediapipe",
  "mmpose",
  "openpose",
  "segment-anything",
  "smplx",
  "tfjs-pose",
  "yolo-seg",
];

test("evaluation: derives exactly the eight capture candidates, sorted by technology id", () => {
  assert.deepEqual(
    profiles.map((profile) => profile.technologyId),
    EXPECTED_IDS,
  );
});

test("evaluation: derivation is a deterministic pure function of the registry", () => {
  const again = deriveCaptureCandidateProfiles(createCaptureRegistry());
  assert.deepEqual(profiles, again);
});

test("evaluation: capability and modality coverage are structured, complete and sorted", () => {
  for (const profile of profiles) {
    const capabilities = profile.evaluation.capabilityCoverage.map((entry) => entry.capability);
    assert.equal(capabilities.length, 7, "all neutral capabilities covered by the table");
    assert.deepEqual(capabilities, [...capabilities].sort());
    assert.equal(new Set(capabilities).size, capabilities.length, "no duplicate capability entries");
    const modalities = profile.evaluation.modalityCoverage.map((entry) => entry.modality);
    assert.deepEqual(modalities, ["depth", "image", "video"], "modality table covers the fixture modalities");
    // at least one capability covered per candidate
    assert.ok(
      profile.evaluation.capabilityCoverage.some((entry) => entry.covered),
      `${profile.technologyId}: covers at least one capability`,
    );
  }
});

test("evaluation: licensing facts come from the researched registry (spdx + source url)", () => {
  for (const profile of profiles) {
    const technology = registry.byId(profile.technologyId);
    assert.ok(technology, `${profile.technologyId}: in registry`);
    assert.equal(profile.evaluation.licensing.spdxId, technology.license.spdxId);
    assert.equal(profile.evaluation.licensing.sourceUrl, technology.license.sourceUrl);
    assert.equal(profile.evaluation.licensing.note, technology.license.note);
  }
});

test("evaluation: production-friendly is true only for MIT/Apache licenses", () => {
  const byId = (id: string): CaptureCandidateProfile => {
    const profile = profiles.find((entry) => entry.technologyId === id);
    assert.ok(profile, `profile ${id}`);
    return profile;
  };
  assert.equal(byId("mediapipe").evaluation.licensing.productionFriendly, true);
  assert.equal(byId("segment-anything").evaluation.licensing.productionFriendly, true);
  assert.equal(byId("mmpose").evaluation.licensing.productionFriendly, true);
  assert.equal(byId("depth-anything").evaluation.licensing.productionFriendly, true);
  assert.equal(byId("tfjs-pose").evaluation.licensing.productionFriendly, true);
  assert.equal(byId("yolo-seg").evaluation.licensing.productionFriendly, false, "AGPL-3.0-only is not production-friendly");
  assert.equal(byId("openpose").evaluation.licensing.productionFriendly, false, "research-only license blocks production");
  assert.equal(byId("smplx").evaluation.licensing.productionFriendly, false, "research-only license blocks production");
});

test("evaluation: determinism is labeled as an engineering assessment, never verified", () => {
  for (const profile of profiles) {
    assert.equal(profile.evaluation.determinism.assessmentBasis, "engineering-assessment");
    assert.ok(profile.evaluation.determinism.basis.length > 0, "determinism basis documented");
  }
  // real inference candidates are honestly marked nondeterministic
  for (const id of ["mediapipe", "openpose", "yolo-seg", "mmpose"]) {
    const profile = profiles.find((entry) => entry.technologyId === id);
    assert.ok(profile);
    assert.equal(profile.evaluation.determinism.deterministic, false, `${id}: real inference is not bit-deterministic`);
  }
});

test("evaluation: effort / latency / cost are explicit not-measured (simulated) markers", () => {
  for (const profile of profiles) {
    for (const field of [profile.evaluation.effort, profile.evaluation.latency, profile.evaluation.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
    }
  }
});

test("evaluation: runtime classes match the authored table for every candidate", () => {
  const expected: Record<string, string> = {
    mediapipe: "browser-js",
    openpose: "local-gpu",
    "tfjs-pose": "browser-js",
    "yolo-seg": "local-gpu",
    "segment-anything": "local-gpu",
    "depth-anything": "local-gpu",
    smplx: "local-cpu",
    mmpose: "local-gpu",
  };
  for (const profile of profiles) {
    assert.equal(profile.evaluation.runtimeClass, expected[profile.technologyId], profile.technologyId);
  }
});

test("evaluation: family shortlists are sorted and complete", () => {
  assert.deepEqual(captureCandidateIdsForFamily(profiles, "segmentation"), ["segment-anything", "yolo-seg"]);
  assert.deepEqual(captureCandidateIdsForFamily(profiles, "pose"), ["mediapipe", "mmpose", "openpose", "tfjs-pose"]);
  assert.deepEqual(captureCandidateIdsForFamily(profiles, "reconstruction"), ["depth-anything", "smplx"]);
});

test("evaluation: derivation discloses its authored table basis", () => {
  for (const profile of profiles) {
    assert.ok(profile.derivedFrom.startsWith("you-lab capture-candidate table/"), profile.derivedFrom);
  }
});
