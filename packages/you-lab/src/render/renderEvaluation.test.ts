// Render candidate evaluation tests (W4C) — coverage: registry-derived
// candidate criteria, production eligibility gates (permissive SPDX +
// maintenance recency), deterministic ranking, and the fail-closed
// construction of the registry-backed three.js evaluation adapter with
// honest not-measured markers.
import assert from "node:assert/strict";
import test from "node:test";
import { createRenderRegistry } from "../technology/renderSeedProfiles.js";
import { createRegistry } from "../technology/registry.js";
import { RENDER_SEED_PROFILES } from "../technology/renderSeedProfiles.js";
import {
  assessRenderProductionEligibility,
  deriveRenderCandidateProfiles,
  rankRenderProductionEligible,
  renderCandidateIdsForMethod,
  RENDER_CANDIDATE_IDS,
  RENDER_RESEARCH_DATE,
} from "./renderEvaluation.js";
import { createThreejsRasterizationAdapter, THREEJS_EVALUATION_ADAPTER_ID } from "./threejsRasterizationAdapter.js";
import { sha256Hex, type NeutralRenderRequest } from "./renderAdapterSeam.js";

const registry = createRenderRegistry();

test("render evaluation: every researched candidate derives a profile with criteria", () => {
  const profiles = deriveRenderCandidateProfiles(registry);
  assert.equal(profiles.length, RENDER_CANDIDATE_IDS.length);
  assert.deepEqual(
    profiles.map((profile) => profile.technologyId),
    [...RENDER_CANDIDATE_IDS].sort(),
  );
  for (const profile of profiles) {
    assert.ok(profile.derivedFrom.startsWith("you-lab render-candidate table/"));
    assert.equal(profile.evaluation.effort.kind, "not-measured");
    assert.equal(
      profile.evaluation.latency.kind === "not-measured" ? profile.evaluation.latency.marker : "",
      "not-measured (simulated)",
    );
    assert.equal(profile.evaluation.cost.kind, "not-measured");
    assert.equal(profile.evaluation.determinism.assessmentBasis, "engineering-assessment");
    assert.ok(profile.evaluation.kindCoverage.some((entry) => entry.covered), `${profile.technologyId}: covers a kind`);
  }
});

test("render evaluation: licensing is registry-derived (SPDX facts, never hand-asserted)", () => {
  const profiles = deriveRenderCandidateProfiles(registry);
  const byId = new Map(profiles.map((profile) => [profile.technologyId, profile]));
  assert.equal(byId.get("three")?.evaluation.licensing.spdxId, "MIT");
  assert.equal(byId.get("three")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("diffusers")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("vibe")?.evaluation.licensing.spdxId, null, "custom non-commercial license");
  assert.equal(byId.get("vibe")?.evaluation.licensing.productionFriendly, false);
  assert.equal(byId.get("blender")?.evaluation.licensing.productionFriendly, false, "GPL is not in the permissive set");
  assert.equal(byId.get("libigl")?.evaluation.licensing.productionFriendly, false, "MPL-2.0 is not in the permissive set");
  assert.equal(byId.get("rokoko-studio")?.evaluation.licensing.productionFriendly, false, "unverified proprietary license");
  const three = byId.get("three");
  assert.ok(three);
  assert.ok(three.evaluation.licensing.sourceUrl.includes("three.js"), "license source URL is the registry fact");
});

test("render evaluation: production eligibility gates (license AND maintenance recency)", () => {
  const profiles = deriveRenderCandidateProfiles(registry);
  const assessments = assessRenderProductionEligibility(profiles, registry);
  const byId = new Map(assessments.map((entry) => [entry.technologyId, entry]));
  // Eligible: permissive SPDX + fresh verified maintenance.
  for (const eligible of ["three", "mediapipe", "diffusers", "gsplat", "rife"]) {
    assert.equal(byId.get(eligible)?.eligible, true, `${eligible} derives eligible`);
  }
  // License gate failures.
  for (const blocked of ["blender", "gvhmr", "openpose", "rigify", "libigl", "vibe", "rokoko-studio"]) {
    const entry = byId.get(blocked);
    assert.ok(entry);
    assert.equal(entry.eligible, false, `${blocked} is blocked`);
    assert.ok(entry.basis.includes("not in the permissive SPDX set"), `${blocked}: license basis cited`);
  }
  // Maintenance gate failures (stale but honest verified signals).
  for (const stale of ["mmpose", "animatediff", "film"]) {
    const entry = byId.get(stale);
    assert.ok(entry);
    assert.equal(entry.eligible, false, `${stale} fails the maintenance gate`);
    assert.ok(entry.maintenanceAgeDays > 365, `${stale}: age ${entry.maintenanceAgeDays} days recorded honestly`);
    assert.ok(entry.basis.includes("maintenance gate failed"), `${stale}: maintenance basis cited`);
  }
  // The maintenance age arithmetic is deterministic calendar math.
  assert.equal(byId.get("three")?.maintenanceAgeDays, 0, "three.js commits landed on the research date");
  assert.equal(byId.get("gsplat")?.maintenanceAgeDays, 22, "gsplat last commit 2026-09-19 -> 22 days");
});

test("render evaluation: eligibility bases are honest (W5+ deferral, no measurement implied)", () => {
  const profiles = deriveRenderCandidateProfiles(registry);
  const assessments = assessRenderProductionEligibility(profiles, registry);
  for (const entry of assessments.filter((item) => item.eligible)) {
    assert.ok(entry.basis.includes("permissive SPDX set"), "license fact cited");
    assert.ok(entry.basis.includes(RENDER_RESEARCH_DATE), "research date cited");
    assert.ok(entry.basis.includes("W5+ compute-plane work"), "real-runtime deferral disclosed");
    assert.ok(entry.basis.includes("nothing here measures the real tool"), "no-measurement marker");
  }
});

test("render evaluation: ranking is a deterministic total order with three.js on top", () => {
  const profiles = deriveRenderCandidateProfiles(registry);
  const ranked = rankRenderProductionEligible(assessRenderProductionEligibility(profiles, registry));
  assert.ok(ranked.length > 0);
  assert.equal(ranked[0]?.technologyId, "three", "three.js derives as the top eligible candidate");
  assert.equal(ranked[0]?.eligible, true);
  // Eligible candidates sort ahead of ineligible ones; ages ascending within.
  const firstIneligible = ranked.findIndex((entry) => !entry.eligible);
  if (firstIneligible !== -1) {
    for (const entry of ranked.slice(firstIneligible)) {
      assert.equal(entry.eligible, false);
    }
  }
  const rerun = rankRenderProductionEligible(assessRenderProductionEligibility(profiles, registry));
  assert.deepEqual(rerun.map((entry) => entry.technologyId), ranked.map((entry) => entry.technologyId));
});

test("render evaluation: method-family shortlists are registry-backed and sorted", () => {
  const profiles = deriveRenderCandidateProfiles(registry);
  assert.deepEqual(renderCandidateIdsForMethod(profiles, "motion-extraction"), [
    "gvhmr",
    "mediapipe",
    "mmpose",
    "openpose",
    "vibe",
  ]);
  assert.deepEqual(renderCandidateIdsForMethod(profiles, "retargeting"), ["libigl", "rigify", "rokoko-studio"]);
  assert.deepEqual(renderCandidateIdsForMethod(profiles, "image-render"), ["diffusers"]);
  assert.deepEqual(renderCandidateIdsForMethod(profiles, "video-render"), ["animatediff", "film", "rife"]);
  assert.deepEqual(renderCandidateIdsForMethod(profiles, "3d-render"), ["blender", "gsplat", "three"]);
});

test("render evaluation adapter: constructs from registry facts, fail-closed, deterministic", () => {
  const adapter = createThreejsRasterizationAdapter(registry);
  assert.equal(adapter.profile.id, THREEJS_EVALUATION_ADAPTER_ID);
  assert.equal(adapter.profile.technologyId, "three");
  assert.equal(adapter.profile.productionEligible, true);
  assert.deepEqual(adapter.profile.methods, ["3d-render"]);
  assert.ok(adapter.facts.eligibilityBasis.includes("MIT"), "eligibility basis cites the MIT license fact");
  assert.ok(adapter.facts.eligibilityBasis.includes("W5+"), "eligibility basis defers real runtime integration");
  assert.equal(adapter.facts.maintenanceAgeDays, 0);

  const request: NeutralRenderRequest = {
    requestId: "req-eval-1",
    performanceId: "perf-eval-1",
    method: "3d-render",
    outputKinds: ["mesh"],
    parameters: {},
    timeline: {
      id: "perf-eval-1",
      durationMs: 3000,
      cues: [
        {
          id: "cue-01",
          track: "motion",
          startMs: 0,
          endMs: 3000,
          payloadRef: "content-store://you-lab/perf/eval/cue-01",
          payloadHash: sha256Hex("eval-cue-01"),
        },
      ],
    },
    submittedAt: "2026-10-11T12:00:00Z",
  };
  const first = adapter.render(request);
  const second = adapter.render(request);
  assert.deepEqual(second, first, "evaluation adapter replays byte-identically");
  assert.equal(first.status, "completed");
  assert.equal(first.producedArtifacts.length, 1);
  assert.equal(first.producedArtifacts[0]?.kind, "mesh");
  assert.equal(first.producedArtifacts[0]?.contentHash, sha256Hex(first.producedArtifacts[0]?.payload ?? new Uint8Array()));
  assert.equal(first.simulated, true, "truth law: evaluation adapter output stays simulated");
  assert.equal(first.effort.latency.kind, "not-measured");
  assert.ok(first.producedArtifacts[0]?.generator.includes("real three.js not executed"), "honest generator label");
});

test("render evaluation adapter: fails closed when registry facts stop deriving", () => {
  const emptyRegistry = createRegistry([]);
  assert.throws(
    () => createThreejsRasterizationAdapter(emptyRegistry),
    /technology 'three' missing from the registry/,
  );
  const registryWithoutThree = createRegistry(RENDER_SEED_PROFILES.filter((profile) => profile.id !== "three"));
  assert.throws(
    () => createThreejsRasterizationAdapter(registryWithoutThree),
    /missing from the registry/,
  );
  const eligibleTopPatched = createRegistry(
    RENDER_SEED_PROFILES.map((profile) =>
      profile.id === "three"
        ? {
            ...profile,
            maintenance: profile.maintenance.map((signal) => ({ ...signal, date: "2020-01-01" })),
          }
        : profile,
    ),
  );
  assert.throws(
    () => createThreejsRasterizationAdapter(eligibleTopPatched),
    /no longer derives as the top production-eligible candidate/,
    "stale three.js maintenance must break eligibility and fail the factory closed",
  );
});
