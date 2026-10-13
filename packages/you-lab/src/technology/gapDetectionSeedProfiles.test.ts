// Gap-detection seed profile tests (W8C) — coverage: the W8C
// gap-detection registry passes registry integrity (truth law: licenses
// carry verified sources, maintenance evidence is real, unverified aspects
// are disclosed), all seven frozen v1 CapabilityGapCategory classes are
// researched exactly once, the deliberate stale finding (rank-bm25) is
// pinned to its observed research snapshot, and construction is
// deterministic.
import assert from "node:assert/strict";
import test from "node:test";
import { validateRegistryIntegrity } from "./registry.js";
import {
  GAP_DETECTION_SEED_PROFILES,
  createGapDetectionRegistry,
} from "./gapDetectionSeedProfiles.js";
import { NEUTRAL_CAPABILITY_GAP_CATEGORIES } from "../arena/arenaAdapterSeam.js";

test("gap-detection seed profiles: registry integrity holds (truth law)", () => {
  const registry = createGapDetectionRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.equal(report.valid, true, `issues: ${report.issues.join("; ")}`);
});

test("gap-detection seed profiles: all seven frozen gap categories researched exactly once", () => {
  const categories = GAP_DETECTION_SEED_PROFILES.map((profile) => {
    const tag = profile.capabilityTags.find((entry) => entry.startsWith("gap-category:"));
    assert.ok(tag, `${profile.id}: carries a gap-category tag`);
    return tag!.slice("gap-category:".length);
  }).sort();
  assert.deepEqual(categories, [...NEUTRAL_CAPABILITY_GAP_CATEGORIES].sort());
  assert.equal(GAP_DETECTION_SEED_PROFILES.length, 7);
});

test("gap-detection seed profiles: every profile carries verified license + maintenance evidence with source URLs", () => {
  for (const profile of GAP_DETECTION_SEED_PROFILES) {
    assert.ok(profile.license.verified, `${profile.id}: license claim is verified`);
    assert.match(profile.license.sourceUrl, /^https:\/\//, `${profile.id}: license source URL`);
    assert.ok(profile.maintenance.length >= 1, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.verified, `${profile.id}: maintenance signal ${signal.signal} is verified`);
      assert.match(signal.sourceUrl, /^https:\/\//, `${profile.id}: maintenance source URL`);
    }
    assert.equal(profile.editorCapable, false, `${profile.id}: gap detectors are not editor-capable`);
    assert.equal(profile.provenance.researchDate, "2026-10-13");
  }
});

test("gap-detection seed profiles: the rank-bm25 stale finding is pinned to the observed research snapshot", () => {
  const profile = createGapDetectionRegistry().byId("rank-bm25");
  assert.ok(profile);
  assert.equal(profile.maintenance[0]?.signal, "rank-bm25@0.2.2");
  assert.equal(profile.maintenance[0]?.date, "2022-02-16");
  assert.ok(
    profile.compatibility.summary.includes("maintenance recency gate"),
    "the deliberate stale finding is disclosed in the compatibility note",
  );
  // the observed snapshot is ~4.5 years before the research date — the
  // eligibility gate in arenaEvaluation fails it (asserted there)
  assert.ok(profile.maintenance[0]!.date < "2023-01-01");
});

test("gap-detection seed profiles: registry construction is deterministic", () => {
  const first = createGapDetectionRegistry();
  const second = createGapDetectionRegistry();
  assert.deepEqual(first.profiles, second.profiles);
  assert.deepEqual(first.ids(), second.ids());
  assert.equal(first.byId("ajv")?.name, "ajv");
  assert.equal(first.byId("open-policy-agent")?.license.spdxId, "Apache-2.0");
});
