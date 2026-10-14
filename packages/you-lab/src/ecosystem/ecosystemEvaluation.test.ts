// Ecosystem evaluation tests (W10C) — coverage: the stage-10 research
// roster derives as candidate profiles from the registry (deterministic,
// fail-closed on roster drift), production eligibility derives from
// license + maintenance facts (the honest NC/unverified/GPL/stale findings
// gate as ineligible; nothing hand-asserted), the ranking law picks
// model-viewer for the AR lane, and the shortlist rows cover all eight
// stage-10 ecosystem classes with honest researched-vs-eligible splits.
// Unverified markers stay visible (truth law).
import assert from "node:assert/strict";
import test from "node:test";
import { createStage10EcosystemRegistry } from "../technology/ecosystemSeedProfiles.js";
import {
  DEFAULT_MAX_MAINTENANCE_AGE_DAYS,
  W10C_CANDIDATE_TECHNOLOGY_IDS,
  assessEcosystemProductionEligibility,
  deriveEcosystemCandidateProfiles,
  ecosystemCandidateIdsForSlot,
  ecosystemShortlistBySlot,
  rankEcosystemProductionEligible,
} from "./ecosystemEvaluation.js";

const registry = createStage10EcosystemRegistry();
const profiles = deriveEcosystemCandidateProfiles(registry);
const assessments = assessEcosystemProductionEligibility(profiles, registry);

test("ecosystem evaluation: the research roster derives deterministically from the registry", () => {
  assert.equal(profiles.length, W10C_CANDIDATE_TECHNOLOGY_IDS.length);
  const second = deriveEcosystemCandidateProfiles(registry);
  assert.deepEqual(profiles, second);
  const ids = profiles.map((profile) => profile.technologyId);
  assert.deepEqual(ids, [...ids].sort(), "candidate order is deterministic (sorted by id)");
  // every candidate carries honest not-measured markers (truth law)
  for (const profile of profiles) {
    assert.equal(profile.evaluation.effort.kind, "not-measured");
    assert.ok(profile.evaluation.latency.kind === "not-measured" && profile.evaluation.latency.marker === "not-measured (simulated)");
    assert.equal(profile.evaluation.cost.kind, "not-measured");
    assert.equal(profile.evaluation.determinism.assessmentBasis, "engineering-assessment");
  }
});

test("ecosystem evaluation: the eight stage-10 ecosystem classes are all covered by the roster", () => {
  const slots = new Set(profiles.map((profile) => profile.ecosystemClass));
  assert.deepEqual([...slots].sort(), [
    "ar", "customer-compute", "game-export", "realtime-telepresence",
    "regional-provider", "style-pipeline", "virtual-try-on", "vrm-export",
  ]);
  // per-class researched rosters
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "virtual-try-on"), ["idm-vton", "ootdiffusion"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "game-export"), ["babylonjs", "playcanvas"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "vrm-export"), ["vrm-specification"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "ar"), ["arjs", "model-viewer", "webxr-device-api"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "realtime-telepresence"), ["galene", "jitsi-meet", "mozilla-hubs"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "customer-compute"), ["gpt4all", "jan", "llamafile", "localai"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "style-pipeline"), ["comfyui", "diffusers", "ip-adapter", "safetensors", "sd-scripts"]);
  assert.deepEqual(ecosystemCandidateIdsForSlot(profiles, "regional-provider"), [
    "deepseek-api", "moonshot-platform", "naver-ncloud", "sarvam-api", "upstage-solar", "volcengine-doubao", "zhipu-bigmodel",
  ]);
});

test("ecosystem evaluation: the honest research findings derive as ineligible (registry-derived, never hand-asserted)", () => {
  const byId = new Map(assessments.map((assessment) => [assessment.technologyId, assessment] as const));
  // NC-licensed try-on candidates
  assert.equal(byId.get("idm-vton")?.eligible, false);
  assert.ok(/CC-BY-NC-SA-4\.0/.test(byId.get("idm-vton")?.basis ?? ""), byId.get("idm-vton")?.basis);
  assert.equal(byId.get("ootdiffusion")?.eligible, false);
  // unverified license
  assert.equal(byId.get("vrm-specification")?.eligible, false);
  assert.ok(/unverified/.test(byId.get("vrm-specification")?.basis ?? ""));
  // license-class failures
  assert.equal(byId.get("comfyui")?.eligible, false);
  assert.ok(/GPL-3\.0/.test(byId.get("comfyui")?.basis ?? ""));
  assert.equal(byId.get("mozilla-hubs")?.eligible, false);
  assert.ok(/MPL-2\.0/.test(byId.get("mozilla-hubs")?.basis ?? ""));
  assert.equal(byId.get("webxr-device-api")?.eligible, false);
  // maintenance failures
  assert.equal(byId.get("gpt4all")?.eligible, false);
  assert.ok(/maintenance gate failed/.test(byId.get("gpt4all")?.basis ?? ""));
  assert.ok((byId.get("gpt4all")?.maintenanceAgeDays ?? 0) > DEFAULT_MAX_MAINTENANCE_AGE_DAYS);
  assert.equal(byId.get("ip-adapter")?.eligible, false);
  assert.ok(/maintenance gate failed/.test(byId.get("ip-adapter")?.basis ?? ""));
  // closed regional providers stay ineligible pending API-terms review
  for (const regional of ["deepseek-api", "zhipu-bigmodel", "moonshot-platform", "volcengine-doubao", "naver-ncloud", "upstage-solar", "sarvam-api"]) {
    assert.equal(byId.get(regional)?.eligible, false, `${regional} stays ineligible`);
    assert.ok(/unverified|not in the permissive SPDX set/.test(byId.get(regional)?.basis ?? ""), byId.get(regional)?.basis);
  }
  // the eligible picks (registry facts held)
  for (const eligible of ["model-viewer", "babylonjs", "playcanvas", "jitsi-meet", "galene", "llamafile", "localai", "jan", "diffusers", "safetensors", "sd-scripts", "arjs"]) {
    assert.equal(byId.get(eligible)?.eligible, true, `${eligible} derives eligible`);
    assert.ok(/permissive SPDX set/.test(byId.get(eligible)?.basis ?? ""));
  }
});

test("ecosystem evaluation: the ranking law picks model-viewer for the AR lane (fail-closed adapter pick)", () => {
  const ranked = rankEcosystemProductionEligible(assessments, "ar");
  const top = ranked[0]!;
  assert.equal(top.technologyId, "model-viewer");
  assert.equal(top.eligible, true);
  assert.equal(top.slot, "ecosystem-class:ar");
  // lane-fit precedes freshness among eligible candidates: every ar-lane
  // eligible candidate ranks before any eligible non-ar candidate
  const eligibleRanks = ranked.filter((assessment) => assessment.eligible);
  const firstNonArIndex = eligibleRanks.findIndex((assessment) => assessment.slot !== "ecosystem-class:ar");
  const lastArIndex = eligibleRanks.reduce((last, assessment, index) =>
    assessment.slot === "ecosystem-class:ar" ? index : last, -1);
  assert.ok(lastArIndex >= 0, "at least one eligible ar candidate exists");
  if (firstNonArIndex >= 0) {
    assert.ok(lastArIndex < firstNonArIndex, "eligible ar-lane candidates rank before eligible non-ar candidates");
  }
  // the ranking is deterministic
  const second = rankEcosystemProductionEligible(assessments, "ar");
  assert.deepEqual(ranked, second);
});

test("ecosystem evaluation: the shortlist rows separate researched from eligible honestly", () => {
  const shortlist = ecosystemShortlistBySlot(profiles, assessments);
  assert.equal(shortlist.length, 8);
  const bySlot = new Map(shortlist.map((row) => [row.slot, row] as const));
  // the try-on class: researched 2, eligible 0 (the honest NC finding)
  const tryOn = bySlot.get("virtual-try-on")!;
  assert.deepEqual(tryOn.researched, ["idm-vton", "ootdiffusion"]);
  assert.deepEqual(tryOn.eligible, []);
  // the AR class: researched 3, eligible 2 (model-viewer + arjs)
  const ar = bySlot.get("ar")!;
  assert.deepEqual(ar.researched, ["arjs", "model-viewer", "webxr-device-api"]);
  assert.deepEqual(ar.eligible, ["arjs", "model-viewer"]);
  // the regional-provider class: researched 7, eligible 0 (closed class)
  const regional = bySlot.get("regional-provider")!;
  assert.equal(regional.researched.length, 7);
  assert.deepEqual(regional.eligible, []);
  // the maintenance-failure classes carry their stale candidates in researched but not eligible
  const compute = bySlot.get("customer-compute")!;
  assert.ok(compute.researched.includes("gpt4all"));
  assert.ok(!compute.eligible.includes("gpt4all"));
  const styles = bySlot.get("style-pipeline")!;
  assert.ok(styles.researched.includes("ip-adapter"));
  assert.ok(!styles.eligible.includes("ip-adapter"));
  assert.ok(styles.researched.includes("comfyui"));
  assert.ok(!styles.eligible.includes("comfyui"));
});

test("ecosystem evaluation: maintenance age arithmetic is deterministic calendar math", () => {
  const byId = new Map(assessments.map((assessment) => [assessment.technologyId, assessment] as const));
  // research date 2026-10-14; model-viewer npm publish 2026-10-09 -> 5 days
  assert.equal(byId.get("model-viewer")?.maintenanceAgeDays, 5);
  // jitsi release 2026-10-14 -> 0 days
  assert.equal(byId.get("jitsi-meet")?.maintenanceAgeDays, 0);
  // gpt4all release 2025-02-25 -> 596 days
  assert.equal(byId.get("gpt4all")?.maintenanceAgeDays, 596);
  // the assessments order is deterministic
  const second = assessEcosystemProductionEligibility(profiles, registry);
  assert.deepEqual(assessments, second);
});

test("ecosystem evaluation: roster drift fails closed (a missing technology refuses the derivation)", async () => {
  // A registry without the W10C additions cannot derive the roster.
  const { createArenaRegistry } = await import("../technology/retryBackoffSeedProfiles.js");
  const w8cRegistry = createArenaRegistry();
  assert.throws(
    () => deriveEcosystemCandidateProfiles(w8cRegistry),
    (error: unknown) => error instanceof Error && /roster technology 'idm-vton' missing from the registry/.test(error.message),
  );
});

test("ecosystem evaluation: the maintenance gate is configurable and monotone", () => {
  const strict = assessEcosystemProductionEligibility(profiles, registry, { maxMaintenanceAgeDays: 3 });
  const byId = new Map(strict.map((assessment) => [assessment.technologyId, assessment] as const));
  // model-viewer (5 days) fails a 3-day gate; jitsi (0 days) passes
  assert.equal(byId.get("model-viewer")?.eligible, false);
  assert.equal(byId.get("jitsi-meet")?.eligible, true);
  // a wider gate never removes eligibility
  const wide = assessEcosystemProductionEligibility(profiles, registry, { maxMaintenanceAgeDays: 3000 });
  const wideById = new Map(wide.map((assessment) => [assessment.technologyId, assessment] as const));
  assert.equal(wideById.get("gpt4all")?.eligible, true, "gpt4all license is permissive; only maintenance gated it");
  assert.equal(wideById.get("idm-vton")?.eligible, false, "the NC license still blocks (a wider maintenance gate never overrides the license gate)");
});
