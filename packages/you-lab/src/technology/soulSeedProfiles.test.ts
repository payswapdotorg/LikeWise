// Soul/realtime seed profile tests (W7C) — coverage: the fifteen researched
// W7C registry additions pass registry integrity (license + source URL,
// unique ids, no unverified-as-verified), cite verified maintenance
// evidence with source URLs, cover the order's three candidate classes, and
// nothing duplicates an existing profile id from prior waves.
import assert from "node:assert/strict";
import test from "node:test";
import {
  createSoulRegistry,
  SOUL_SEED_PROFILES,
} from "./soulSeedProfiles.js";
import { REALTIME_SEED_PROFILES } from "./realtimeSeedProfiles.js";
import { createRegistry, validateRegistryIntegrity } from "./registry.js";
import { SEED_PROFILES } from "./seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "./editorSeedProfiles.js";
import { LEARNING_SEED_PROFILES } from "./learningSeedProfiles.js";
import { CAPTURE_SEED_PROFILES } from "./captureSeedProfiles.js";
import { GEOMETRY_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionSeedProfiles.js";
import { NEURAL_RECONSTRUCTION_SEED_PROFILES } from "./reconstructionNeuralSeedProfiles.js";
import { RENDER_SEED_PROFILES } from "./renderSeedProfiles.js";
import { RENDER_MOTION_SEED_PROFILES } from "./renderMotionSeedProfiles.js";

const registry = createSoulRegistry();

const W7C_IDS = [
  // LLM/VLM providers (open-weight serving stacks, inference runtimes, multimodal VLM families)
  "vllm",
  "text-generation-inference",
  "llama-cpp",
  "ollama",
  "qwen3-vl",
  "llama-3",
  // state-routing approaches
  "routellm",
  "eagle",
  "medusa",
  // realtime media stacks
  "livekit",
  "mediasoup",
  "janus-gateway",
  "pion-webrtc",
  "aiortc",
  "whip",
];

test("soul seed profiles: fifteen researched W7C additions with unique ids (nine soul-side + six realtime-side)", () => {
  assert.equal(SOUL_SEED_PROFILES.length, 9);
  assert.equal(REALTIME_SEED_PROFILES.length, 6);
  const w7cProfiles = [...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES];
  assert.deepEqual(
    w7cProfiles.map((profile) => profile.id).sort(),
    [...W7C_IDS].sort(),
  );
});

test("soul seed profiles: no id duplicates any prior-wave profile", () => {
  const prior = [
    ...SEED_PROFILES,
    ...EDITOR_SEED_PROFILES,
    ...LEARNING_SEED_PROFILES,
    ...CAPTURE_SEED_PROFILES,
    ...GEOMETRY_RECONSTRUCTION_SEED_PROFILES,
    ...NEURAL_RECONSTRUCTION_SEED_PROFILES,
    ...RENDER_SEED_PROFILES,
    ...RENDER_MOTION_SEED_PROFILES,
  ].map((profile) => profile.id);
  for (const profile of [...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES]) {
    assert.equal(prior.includes(profile.id), false, `${profile.id} must not collide with a prior-wave id`);
  }
});

test("soul seed profiles: the composed soul registry passes integrity validation", () => {
  const report = validateRegistryIntegrity(registry);
  assert.equal(report.valid, true, `integrity issues: ${report.issues.join("; ")}`);
  for (const id of W7C_IDS) {
    assert.ok(registry.byId(id), `${id} present in the composed registry`);
  }
});

test("soul seed profiles: every license claim carries an SPDX id (or a noted custom license) and an https source URL", () => {
  for (const profile of [...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES]) {
    const license = profile.license;
    assert.ok(license.sourceUrl.startsWith("https://"), `${profile.id}: license sourceUrl is https`);
    assert.ok(license.name.length > 0, `${profile.id}: license name present`);
    assert.ok(license.note.length > 0, `${profile.id}: license note present`);
    if (license.spdxId === null) {
      // custom/non-SPDX licenses are deliberate and explained (llama-3 community license, WHIP IETF TLP)
      assert.ok(
        profile.provenance.unverifiedClaims.length > 0 || license.note.includes("not in the you-lab permissive SPDX set") || license.note.includes("no software SPDX id applies"),
        `${profile.id}: non-SPDX license carries an explanatory note`,
      );
    }
  }
});

test("soul seed profiles: verified claims are never unverified-as-verified (truth law)", () => {
  for (const profile of [...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES]) {
    // every profile's unverified aspects are listed in provenance.unverifiedClaims
    assert.ok(profile.provenance.unverifiedClaims.length > 0, `${profile.id}: research-honest unverified-claims list is non-empty (nothing is claimed beyond the fetched evidence)`);
    for (const signal of profile.maintenance) {
      if (signal.verified) {
        assert.ok(signal.sourceUrl.startsWith("https://"), `${profile.id}: verified maintenance ${signal.signal} cites its source`);
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(signal.date), `${profile.id}: maintenance date is ISO YYYY-MM-DD`);
      }
    }
    // compatibility summaries are engineering assessments, never verified external claims
    assert.equal(profile.compatibility.verified, false, `${profile.id}: compatibility is an engineering assessment`);
  }
});

test("soul seed profiles: maintenance evidence observed on the research date window (2026-10-12 research seeding)", () => {
  const byId = new Map([...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES].map((profile) => [profile.id, profile]));
  // exact observed signals (research log 2026-10-12; never invented)
  const expectedSignals: readonly [string, string, string][] = [
    ["vllm", "v0.31.0", "2026-10-06"],
    ["llama-cpp", "b11559", "2026-10-11"],
    ["ollama", "v0.40.3", "2026-10-11"],
    ["qwen3-vl", "commits/main (latest observed: 'Merge pull request #1971 from 2003jiahang/patch-1')", "2026-01-30"],
    ["livekit", "v1.13.9", "2026-10-07"],
    ["mediasoup", "3.29.0", "2026-10-08"],
    ["janus-gateway", "v1.4.2", "2026-09-23"],
    ["pion-webrtc", "v4.2.23", "2026-10-07"],
    ["aiortc", "1.15.0", "2026-07-13"],
    ["whip", "RFC 9725 (WHIP)", "2025-03-01"],
  ];
  for (const [id, signal, date] of expectedSignals) {
    const profile = byId.get(id);
    assert.ok(profile, `${id} present`);
    const observed = profile.maintenance.find((entry) => entry.signal === signal && entry.date === date);
    assert.ok(observed, `${id}: maintenance signal "${signal}" @ ${date} recorded verbatim from the research log`);
  }
  // the WHIP signal is month precision — the exact day stays unverified (never invented)
  const whip = byId.get("whip")!;
  assert.ok(
    whip.provenance.unverifiedClaims.some((claim) => claim.includes("publication DAY is not verified")),
    "whip: month-precision disclosure stays in unverifiedClaims",
  );
});

test("soul seed profiles: the deliberate not-production-friendly branches exist", () => {
  const byId = new Map([...SOUL_SEED_PROFILES, ...REALTIME_SEED_PROFILES].map((profile) => [profile.id, profile]));
  // llama-3: custom LLAMA 3.1 Community License (non-SPDX)
  assert.equal(byId.get("llama-3")?.license.spdxId, null);
  assert.ok(byId.get("llama-3")?.license.name.includes("Community License"));
  // janus-gateway: GPL-3.0
  assert.equal(byId.get("janus-gateway")?.license.spdxId, "GPL-3.0");
  // mediasoup: ISC — permissive in spirit but outside the authored permissive set (disclosed, blocked pending TL review)
  assert.equal(byId.get("mediasoup")?.license.spdxId, "ISC");
  assert.ok(byId.get("mediasoup")?.license.note.includes("OUTSIDE the authored you-lab permissive SPDX set"));
  // whip: IETF TLP document copyright (no software SPDX id)
  assert.equal(byId.get("whip")?.license.spdxId, null);
});

test("soul seed profiles: registry integrity catches a fabricated unverified license (negative control)", () => {
  const fabricated = createRegistry([
    ...SOUL_SEED_PROFILES,
    ...REALTIME_SEED_PROFILES,
    {
      ...SOUL_SEED_PROFILES[0]!,
      id: "fabricated-soul-tech",
      license: { ...SOUL_SEED_PROFILES[0]!.license, spdxId: null, name: "Made-Up License", verified: false, note: "" },
    },
  ]);
  const report = validateRegistryIntegrity(fabricated);
  assert.equal(report.valid, false, "the integrity gate catches the fabricated entry");
  assert.ok(report.issues.some((issue) => issue.includes("fabricated-soul-tech")));
});
