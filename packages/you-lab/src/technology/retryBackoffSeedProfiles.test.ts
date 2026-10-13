// Retry/backoff seed profile tests (W8C) — coverage: the W8C retry/backoff
// registry passes registry integrity (truth law), all four order classes
// (circuit-breaker, hedged-request, exponential-backoff-jitter,
// token-bucket) are researched exactly once, the deliberate stale finding
// (bottleneck) is pinned to its observed research snapshot, the p-retry
// jitter documentation claim is pinned to the README evidence, and
// construction is deterministic.
import assert from "node:assert/strict";
import test from "node:test";
import { validateRegistryIntegrity } from "./registry.js";
import {
  RETRY_BACKOFF_SEED_PROFILES,
  createArenaRegistry,
  createRetryBackoffRegistry,
} from "./retryBackoffSeedProfiles.js";
import { NEUTRAL_BACKOFF_CLASSES } from "../arena/arenaAdapterSeam.js";

test("retry/backoff seed profiles: registry integrity holds (truth law)", () => {
  const registry = createRetryBackoffRegistry();
  const report = validateRegistryIntegrity(registry);
  assert.equal(report.valid, true, `issues: ${report.issues.join("; ")}`);
});

test("retry/backoff seed profiles: all four W8C backoff classes researched exactly once", () => {
  const classes = RETRY_BACKOFF_SEED_PROFILES.map((profile) => {
    const tag = profile.capabilityTags.find((entry) => entry.startsWith("backoff-class:"));
    assert.ok(tag, `${profile.id}: carries a backoff-class tag`);
    return tag!.slice("backoff-class:".length);
  }).sort();
  assert.deepEqual(classes, [...NEUTRAL_BACKOFF_CLASSES].sort());
  assert.equal(RETRY_BACKOFF_SEED_PROFILES.length, 4);
});

test("retry/backoff seed profiles: every profile carries verified license + maintenance evidence with source URLs", () => {
  for (const profile of RETRY_BACKOFF_SEED_PROFILES) {
    assert.ok(profile.license.verified, `${profile.id}: license claim is verified`);
    assert.match(profile.license.sourceUrl, /^https:\/\//, `${profile.id}: license source URL`);
    assert.ok(profile.maintenance.length >= 1, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.verified, `${profile.id}: maintenance signal ${signal.signal} is verified`);
      assert.match(signal.sourceUrl, /^https:\/\//, `${profile.id}: maintenance source URL`);
    }
    assert.equal(profile.editorCapable, false, `${profile.id}: retry libraries are not editor-capable`);
    assert.equal(profile.provenance.researchDate, "2026-10-13");
  }
});

test("retry/backoff seed profiles: the bottleneck stale finding is pinned to the observed research snapshot", () => {
  const profile = createRetryBackoffRegistry().byId("bottleneck");
  assert.ok(profile);
  assert.equal(profile.maintenance[0]?.signal, "bottleneck@2.19.5");
  assert.equal(profile.maintenance[0]?.date, "2019-08-03");
  assert.ok(
    profile.compatibility.summary.includes("maintenance recency gate"),
    "the deliberate stale finding is disclosed in the compatibility note",
  );
  // the token-bucket class assignment is an engineering assessment over
  // reservoir semantics — disclosed as unverified (truth law)
  assert.ok(
    profile.provenance.unverifiedClaims.some((claim) => claim.includes("token-bucket class assignment is an engineering assessment")),
    "bottleneck token-bucket class assignment is disclosed as an engineering assessment",
  );
});

test("retry/backoff seed profiles: the p-retry jitter claim is pinned to the README evidence", () => {
  const profile = createRetryBackoffRegistry().byId("p-retry");
  assert.ok(profile);
  assert.equal(profile.maintenance[0]?.signal, "p-retry@8.0.1");
  assert.equal(profile.maintenance[0]?.date, "2026-09-01");
  assert.ok(
    profile.compatibility.summary.includes("randomize"),
    "the jitter claim cites the README-documented randomize option",
  );
  assert.ok(
    profile.provenance.sourceUrls.includes("https://raw.githubusercontent.com/sindresorhus/p-retry/main/readme.md"),
    "the README is part of the recorded provenance",
  );
  // grpc-js hedging is an engineering assessment — disclosed as unverified
  const grpc = createRetryBackoffRegistry().byId("grpc-js");
  assert.ok(grpc);
  assert.ok(
    grpc.provenance.unverifiedClaims.some((claim) => claim.includes("gRFC A6") && claim.includes("engineering assessment")),
    "grpc-js hedging class assignment is disclosed as an engineering assessment",
  );
});

test("retry/backoff seed profiles: registry construction is deterministic and composes the full stack", () => {
  const first = createRetryBackoffRegistry();
  const second = createArenaRegistry();
  assert.deepEqual(first.profiles, second.profiles);
  assert.deepEqual(first.ids(), second.ids());
  assert.ok(first.byId("opossum"));
  assert.ok(first.byId("blender"), "the W1C base stack is composed in");
  assert.ok(first.byId("ajv"), "the W8C gap-detection additions are composed in");
});
