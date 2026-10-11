// Reconstruction evaluation criteria tests (W3C): derivation structure,
// honest markers, registry-backed licensing, determinism-as-assessment, and
// registry-derived production eligibility (COLMAP ranks first).
import assert from "node:assert/strict";
import test from "node:test";
import { createReconstructionRegistry } from "../technology/reconstructionSeedProfiles.js";
import {
  assessProductionEligibility,
  deriveReconstructionCandidateProfiles,
  rankProductionEligible,
  RECONSTRUCTION_CANDIDATE_IDS,
  RECONSTRUCTION_RESEARCH_DATE,
  reconstructionCandidateIdsForMethod,
  type ProductionEligibilityAssessment,
  type ReconstructionCandidateProfile,
} from "./reconstructionEvaluation.js";

const registry = createReconstructionRegistry();
const profiles = deriveReconstructionCandidateProfiles(registry);

test("evaluation: derives exactly the twelve reconstruction candidates, sorted by technology id", () => {
  assert.deepEqual(
    profiles.map((profile) => profile.technologyId),
    [...RECONSTRUCTION_CANDIDATE_IDS],
  );
});

test("evaluation: every candidate derives licensing straight from the registry (no invented licenses)", () => {
  for (const profile of profiles) {
    const technology = registry.byId(profile.technologyId);
    assert.ok(technology, `${profile.technologyId}: registry entry exists`);
    assert.equal(profile.evaluation.licensing.spdxId, technology.license.spdxId, `${profile.technologyId}: spdx from registry`);
    assert.equal(profile.evaluation.licensing.sourceUrl, technology.license.sourceUrl, `${profile.technologyId}: sourceUrl from registry`);
    assert.equal(profile.evaluation.licensing.note, technology.license.note, `${profile.technologyId}: note from registry`);
  }
});

test("evaluation: production-friendly licensing is exactly the permissive SPDX set", () => {
  const byId = new Map<string, ReconstructionCandidateProfile>(profiles.map((profile) => [profile.technologyId, profile]));
  assert.equal(byId.get("colmap")?.evaluation.licensing.productionFriendly, true, "BSD-3-Clause is permissive");
  assert.equal(byId.get("open3d")?.evaluation.licensing.productionFriendly, true, "MIT is permissive");
  assert.equal(byId.get("pifu")?.evaluation.licensing.productionFriendly, true, "MIT is permissive");
  for (const blocked of [
    "openmvs", // AGPL-3.0-or-later
    "pifuhd", // CC BY-NC 4.0
    "icon", // research-only
    "econ", // research-only
    "gaussian-splatting", // Inria non-commercial
    "gaussianavatars", // CC BY-NC-SA 4.0
    "instantavatar", // no license file
    "animatablenerf", // PRL (registration required, non-SPDX)
    "smplx", // research-only
  ]) {
    assert.equal(byId.get(blocked)?.evaluation.licensing.productionFriendly, false, `${blocked}: not production-friendly`);
  }
});

test("evaluation: method families cover all three frozen method literals", () => {
  assert.deepEqual(reconstructionCandidateIdsForMethod(profiles, "explicit-geometry"), [
    "colmap",
    "open3d",
    "openmvs",
    "smplx",
  ]);
  assert.deepEqual(reconstructionCandidateIdsForMethod(profiles, "neural-appearance"), ["animatablenerf"]);
  assert.deepEqual(reconstructionCandidateIdsForMethod(profiles, "hybrid"), [
    "econ",
    "gaussian-splatting",
    "gaussianavatars",
    "icon",
    "instantavatar",
    "pifu",
    "pifuhd",
  ]);
});

test("evaluation: domain coverage is a sorted non-empty subset of the benchmark domains", () => {
  for (const profile of profiles) {
    const covered = profile.evaluation.domainCoverage.filter((entry) => entry.covered);
    assert.ok(covered.length >= 4, `${profile.technologyId}: covers a meaningful domain set`);
    const domains = profile.evaluation.domainCoverage.map((entry) => entry.domain);
    assert.deepEqual(domains, [...domains].sort(), `${profile.technologyId}: coverage table sorted`);
  }
});

test("evaluation: determinism is an engineering assessment, never a verified claim", () => {
  for (const profile of profiles) {
    assert.equal(profile.evaluation.determinism.assessmentBasis, "engineering-assessment", `${profile.technologyId}: labeled assessment`);
    assert.ok(profile.evaluation.determinism.basis.length > 0, `${profile.technologyId}: basis non-empty`);
  }
  // Neural/GPU methods are honestly non-deterministic; CPU math methods assessed deterministic
  const byId = new Map<string, ReconstructionCandidateProfile>(profiles.map((profile) => [profile.technologyId, profile]));
  assert.equal(byId.get("smplx")?.evaluation.determinism.deterministic, true, "smplx CPU math");
  assert.equal(byId.get("open3d")?.evaluation.determinism.deterministic, true, "open3d CPU math");
  assert.equal(byId.get("colmap")?.evaluation.determinism.deterministic, false, "colmap multi-threaded SfM");
  assert.equal(byId.get("animatablenerf")?.evaluation.determinism.deterministic, false, "GPU NeRF");
});

test("evaluation: effort / latency / cost are not-measured markers (never faked)", () => {
  for (const profile of profiles) {
    for (const field of [profile.evaluation.effort, profile.evaluation.latency, profile.evaluation.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.kind === "not-measured" ? field.marker : "", "not-measured (simulated)");
    }
  }
});

test("evaluation: production eligibility derives from registry facts (permissive license + fresh maintenance)", () => {
  const assessments = assessProductionEligibility(profiles, registry);
  const byId = new Map<string, ProductionEligibilityAssessment>(assessments.map((entry) => [entry.technologyId, entry]));
  // eligible: colmap (BSD-3, 0 days) + open3d (MIT, 12 days); pifu is permissive but frozen since 2022
  assert.equal(byId.get("colmap")?.eligible, true, "colmap eligible");
  assert.equal(byId.get("open3d")?.eligible, true, "open3d eligible");
  assert.equal(byId.get("pifu")?.eligible, false, "pifu fails the maintenance gate (last commit 2022)");
  for (const blocked of ["openmvs", "pifuhd", "icon", "econ", "gaussian-splatting", "gaussianavatars", "instantavatar", "animatablenerf", "smplx"]) {
    assert.equal(byId.get(blocked)?.eligible, false, `${blocked}: not eligible`);
  }
  // maintenance ages are deterministic calendar arithmetic against the research date
  assert.equal(byId.get("colmap")?.maintenanceAgeDays, 0, "colmap latest signal 2026-10-11 = 0 days");
  assert.equal(byId.get("open3d")?.maintenanceAgeDays, 12, "open3d latest signal 2026-09-29 = 12 days");
  assert.equal(RECONSTRUCTION_RESEARCH_DATE, "2026-10-11");
});

test("evaluation: eligibility bases cite license + maintenance honestly and defer real integration to W4+", () => {
  const assessments = assessProductionEligibility(profiles, registry);
  const colmap = assessments.find((entry) => entry.technologyId === "colmap");
  assert.ok(colmap);
  assert.ok(colmap.basis.includes("BSD-3-Clause"), "cites the SPDX id");
  assert.ok(colmap.basis.includes("https://"), "cites the license source URL");
  assert.ok(colmap.basis.includes("W4+ compute-plane"), "discloses the deferral");
  const instantavatar = assessments.find((entry) => entry.technologyId === "instantavatar");
  assert.ok(instantavatar);
  assert.ok(instantavatar.basis.includes("not in the permissive SPDX set"), "no-license blocker stated");
});

test("evaluation: ranking is deterministic — COLMAP first, then Open3D (recency, coverage, id)", () => {
  const ranked = rankProductionEligible(assessProductionEligibility(profiles, registry));
  assert.deepEqual(
    ranked.map((entry) => entry.technologyId),
    ["colmap", "open3d"],
  );
  assert.ok(ranked[0] && ranked[1]);
  assert.ok(ranked[0].maintenanceAgeDays <= ranked[1].maintenanceAgeDays, "recency dominates");
});

test("evaluation: maintenance gate is configurable and fail-closed (tighter window drops open3d)", () => {
  const tight = assessProductionEligibility(profiles, registry, { maxMaintenanceAgeDays: 7 });
  const ranked = rankProductionEligible(tight);
  assert.deepEqual(
    ranked.map((entry) => entry.technologyId),
    ["colmap"],
    "only colmap passes a 7-day window",
  );
});
