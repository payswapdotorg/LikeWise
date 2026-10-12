// Learning capability + registry tests (W6C) — coverage: registry integrity
// for the researched learning additions (license + source URL on every
// profile, unique ids, verified claims carry sources, unverified claims are
// explicitly listed — never presented as verified; the AGPL candidate
// deliberately exercises the not-production-friendly branch) and the learner
// capability-record derivation (input signal kinds, scopes, output classes)
// from the registry via the authored tables.
import assert from "node:assert/strict";
import test from "node:test";
import { LEARNING_SEED_PROFILES, createLearningRegistry } from "../technology/learningSeedProfiles.js";
import { validateRegistryIntegrity } from "../technology/registry.js";
import { SEED_PROFILES } from "../technology/seedProfiles.js";
import { EDITOR_SEED_PROFILES } from "../technology/editorSeedProfiles.js";
import { deriveLearningCapabilityProfiles, learningCapabilityById } from "./capabilityProfiles.js";

const EXPECTED_IDS = [
  "lightgbm",
  "mabwiser",
  "mord",
  "pm4py",
  "prose",
  "smac",
  "vowpal-wabbit",
  "wittgenstein",
  "xgboost",
];

const registry = createLearningRegistry();
const profiles = deriveLearningCapabilityProfiles(registry);

test("learning registry: integrity rules pass for the W6C researched additions", () => {
  const report = validateRegistryIntegrity(registry);
  assert.deepEqual(report.issues, []);
  assert.equal(report.valid, true);
});

test("learning registry: every W6C profile has a license with name and source URL", () => {
  for (const profile of LEARNING_SEED_PROFILES) {
    assert.ok(profile.license.name.length > 0, `${profile.id}: license name`);
    assert.ok(profile.license.sourceUrl.startsWith("https://"), `${profile.id}: license sourceUrl`);
    assert.ok(profile.maintenance.length > 0, `${profile.id}: maintenance evidence present`);
    for (const signal of profile.maintenance) {
      assert.ok(signal.sourceUrl.startsWith("https://"), `${profile.id}: maintenance sourceUrl`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(signal.date), `${profile.id}: maintenance date is ISO`);
    }
  }
});

test("learning registry: W6C ids are unique and do not collide with the W1C/W5C seeds", () => {
  const ids = LEARNING_SEED_PROFILES.map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  const existing = new Set([...SEED_PROFILES, ...EDITOR_SEED_PROFILES].map((profile) => profile.id));
  for (const id of ids) {
    assert.ok(!existing.has(id), `${id}: collides with a W1C/W5C seed profile`);
  }
});

test("learning registry: exactly the nine researched W6C additions, deterministically ordered", () => {
  const registryIds = registry.profiles.map((profile) => profile.id);
  for (const id of EXPECTED_IDS) {
    assert.ok(registryIds.includes(id), `${id}: registered in the learning registry`);
  }
  assert.equal(LEARNING_SEED_PROFILES.length, 9);
  assert.equal(registry.profiles.length, SEED_PROFILES.length + EDITOR_SEED_PROFILES.length + 9);
});

test("learning registry: all W6C license claims are verified with fetched sources (truth law)", () => {
  for (const profile of LEARNING_SEED_PROFILES) {
    assert.equal(profile.license.verified, true, `${profile.id}: license verified`);
    assert.ok(profile.provenance.sourceUrls.length > 0, `${profile.id}: provenance sourceUrls`);
    assert.equal(profile.provenance.researchDate, "2026-10-12");
    // an unverified claim must never masquerade as verified: every unverified
    // aspect is explicitly listed in provenance.unverifiedClaims
    for (const signal of profile.maintenance) {
      if (!signal.verified) {
        assert.ok(
          profile.provenance.unverifiedClaims.length > 0,
          `${profile.id}: unverified maintenance listed in unverifiedClaims`,
        );
      }
    }
  }
});

test("learning registry: unverified aspects are explicitly listed, never silently verified", () => {
  for (const profile of LEARNING_SEED_PROFILES) {
    for (const claim of profile.provenance.unverifiedClaims) {
      assert.ok(claim.length > 0, `${profile.id}: non-empty unverified claim`);
    }
    assert.equal(profile.compatibility.verified, false, `${profile.id}: compatibility is an assessment`);
  }
});

test("learning registry: honest license nuances and the AGPL not-production-friendly branch", () => {
  const byId = new Map(LEARNING_SEED_PROFILES.map((profile) => [profile.id, profile]));
  // organization-improvement class licenses
  assert.equal(byId.get("wittgenstein")?.license.spdxId, "MIT");
  assert.equal(byId.get("mord")?.license.spdxId, "BSD-3-Clause");
  assert.ok(byId.get("mord")?.license.note.includes("GitHub's automated license detection"), "mord detection nuance documented");
  assert.equal(byId.get("mabwiser")?.license.spdxId, "Apache-2.0");
  assert.equal(byId.get("vowpal-wabbit")?.license.spdxId, "BSD-3-Clause");
  // tool/editor-selection class licenses
  assert.equal(byId.get("lightgbm")?.license.spdxId, "MIT");
  assert.equal(byId.get("xgboost")?.license.spdxId, "Apache-2.0");
  assert.equal(byId.get("smac")?.license.spdxId, "BSD-3-Clause");
  // pipeline-improvement class licenses
  assert.equal(byId.get("prose")?.license.spdxId, "MIT");
  const pm4py = byId.get("pm4py");
  assert.ok(pm4py);
  assert.equal(pm4py.license.spdxId, "AGPL-3.0");
  assert.ok(pm4py.license.note.includes("NOT in the you-lab permissive SPDX set"), "pm4py AGPL deliberately exercises the not-production-friendly branch");
});

test("learning registry: maintenance signals use the documented signal kinds", () => {
  const kinds = new Set(LEARNING_SEED_PROFILES.flatMap((profile) => profile.maintenance.map((signal) => signal.kind)));
  for (const kind of kinds) {
    assert.ok(
      ["npm-publish", "github-release", "pypi-upload", "github-commit", "gitlab-release"].includes(kind),
      `signal kind "${kind}" is documented`,
    );
  }
  // MABWiser's release lives on GitHub releases; PROSE publishes no releases
  // at all (the W2C github-commit precedent for release-less repositories).
  const mabwiser = LEARNING_SEED_PROFILES.find((profile) => profile.id === "mabwiser");
  assert.ok(mabwiser);
  assert.equal(mabwiser.maintenance[0]?.kind, "github-release");
  const prose = LEARNING_SEED_PROFILES.find((profile) => profile.id === "prose");
  assert.ok(prose);
  assert.equal(prose.maintenance[0]?.kind, "github-commit");
});

test("learning capability: derivation covers all seven W6C learner classes", () => {
  const classes = new Set(profiles.map((profile) => profile.learnerClass));
  assert.deepEqual([...classes].sort(), [
    "bandit-selection",
    "contextual-ranking",
    "cost-aware-selection",
    "preference-learning",
    "program-synthesis",
    "rule-induction",
    "workflow-mining",
  ]);
});

test("learning capability: the W6C candidate classes derive capability records", () => {
  for (const id of EXPECTED_IDS) {
    const profile = learningCapabilityById(profiles, id);
    assert.ok(profile, `${id}: capability record derived`);
    assert.ok(profile.inputSignalKinds.length > 0, `${id}: inputSignalKinds non-empty`);
    assert.ok(profile.supportedScopes.length > 0, `${id}: supportedScopes non-empty`);
    assert.ok(profile.outputClasses.length > 0, `${id}: outputClasses non-empty`);
    assert.ok(profile.notes.length > 0, `${id}: notes recorded`);
    assert.ok(profile.displayName.length > 0, `${id}: displayName carried`);
  }
  assert.equal(profiles.length, 9);
});

test("learning capability: registry technologies outside the learning taxonomy derive no record", () => {
  for (const id of ["blender", "vscode", "three-js", "gltf", "codemirror", "opentimelineio"]) {
    assert.equal(learningCapabilityById(profiles, id), null, `${id}: no capability record (outside the authored learner table)`);
  }
});

test("learning capability: signal diets and output classes are derived from researched capability tags", () => {
  const vw = learningCapabilityById(profiles, "vowpal-wabbit");
  assert.ok(vw);
  assert.deepEqual(vw.inputSignalKinds, ["edit-session", "feedback", "manual-takeover", "repeated-intent"]);
  assert.deepEqual(vw.outputClasses, ["editor-selection", "organization-improvement", "personalization", "tool-selection"]);
  const wittgenstein = learningCapabilityById(profiles, "wittgenstein");
  assert.ok(wittgenstein);
  assert.deepEqual(wittgenstein.inputSignalKinds, ["expert-intervention", "feedback", "manual-takeover"]);
  assert.deepEqual(wittgenstein.outputClasses, ["capability-gap-analysis", "organization-improvement"]);
  const smac = learningCapabilityById(profiles, "smac");
  assert.ok(smac);
  assert.deepEqual(smac.inputSignalKinds, ["capability-gap", "feedback", "manual-takeover"]);
  assert.ok(smac.outputClasses.includes("pipeline-improvement"), "smac cost-aware configurations target pipelines");
  const pm4py = learningCapabilityById(profiles, "pm4py");
  assert.ok(pm4py);
  assert.ok(pm4py.outputClasses.includes("pipeline-improvement"), "pm4py mined workflows target pipelines");
});

test("learning capability: derivation is deterministic and registry-backed", () => {
  const again = deriveLearningCapabilityProfiles(createLearningRegistry());
  assert.deepEqual(again, profiles);
  for (const profile of profiles) {
    assert.ok(registry.byId(profile.id), `${profile.id}: resolves in the registry`);
    assert.ok(profile.derivedFrom.startsWith("you-lab learning-capability table/"), `${profile.id}: derivedFrom label`);
  }
});
