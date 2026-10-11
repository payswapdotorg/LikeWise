// Editing candidate evaluation tests (W5C) — coverage: registry-derived
// candidate profiles with honest licensing/determinism/effort fields,
// production eligibility derived (never hand-asserted), deterministic
// ranking with the vscode pick, and the fail-closed evaluation adapter.
import assert from "node:assert/strict";
import test from "node:test";
import { createEditorRegistry, EDITOR_SEED_PROFILES } from "../technology/editorSeedProfiles.js";
import { createRegistry } from "../technology/registry.js";
import { SEED_PROFILES } from "../technology/seedProfiles.js";
import {
  EDITING_EVALUATION_FORMATS,
  EDITING_RESEARCH_DATE,
  assessEditingProductionEligibility,
  deriveEditingCandidateProfiles,
  editingCandidateIdsForKind,
  rankEditingProductionEligible,
} from "./editorEvaluation.js";
import { createVscodeEditingEvaluationAdapter, VSCODE_EVALUATION_ADAPTER_ID } from "./vscodeEvaluationAdapter.js";

const registry = createEditorRegistry();
const candidates = deriveEditingCandidateProfiles(registry);

test("editing evaluation: candidate criteria cite verified registry license facts", () => {
  for (const candidate of candidates) {
    const technology = registry.byId(candidate.technologyId);
    assert.ok(technology, `${candidate.technologyId}: registry-backed`);
    assert.equal(candidate.evaluation.licensing.spdxId, technology.license.spdxId);
    assert.equal(candidate.evaluation.licensing.sourceUrl, technology.license.sourceUrl);
    assert.equal(candidate.evaluation.licensing.sourceUrl.startsWith("https://"), true);
  }
});

test("editing evaluation: effort/latency/cost carry honest not-measured markers", () => {
  for (const candidate of candidates) {
    for (const field of [candidate.evaluation.effort, candidate.evaluation.latency, candidate.evaluation.cost]) {
      assert.equal(field.kind, "not-measured");
      assert.equal(field.marker, "not-measured (simulated)");
    }
    assert.equal(candidate.evaluation.determinism.assessmentBasis, "engineering-assessment");
    assert.ok(candidate.derivedFrom.startsWith("you-lab editing-candidate table/"));
  }
});

test("editing evaluation: permissive SPDX set drives production friendliness", () => {
  const byId = new Map(candidates.map((candidate) => [candidate.technologyId, candidate]));
  assert.equal(byId.get("vscode")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("monaco-editor")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("godot")?.evaluation.licensing.productionFriendly, true);
  assert.equal(byId.get("blender")?.evaluation.licensing.productionFriendly, false, "GPL blender blocked");
  assert.equal(byId.get("gimp")?.evaluation.licensing.productionFriendly, false, "GPL gimp blocked");
  assert.equal(byId.get("krita")?.evaluation.licensing.productionFriendly, false, "GPL krita blocked");
  assert.equal(byId.get("kdenlive")?.evaluation.licensing.productionFriendly, false, "GPL kdenlive blocked");
});

test("editing evaluation: production eligibility is derived from license + maintenance recency", () => {
  const assessments = assessEditingProductionEligibility(candidates, registry);
  const byId = new Map(assessments.map((assessment) => [assessment.technologyId, assessment]));
  // vscode: MIT + release 4 days before the research date — eligible
  const vscode = byId.get("vscode");
  assert.ok(vscode);
  assert.equal(vscode.eligible, true);
  assert.equal(vscode.maintenanceAgeDays, 4);
  assert.ok(vscode.basis.includes("MIT"));
  assert.ok(vscode.basis.includes("W6+ compute-plane work"), "honest W6+ deferral in the basis");
  // prosemirror: MIT + npm publish ~353 days before the research date — eligible
  assert.equal(byId.get("prosemirror")?.eligible, true);
  // blender: maintained but GPL — blocked by license
  const blender = byId.get("blender");
  assert.ok(blender);
  assert.equal(blender.eligible, false);
  assert.ok(blender.basis.includes("not in the permissive SPDX set"));
});

test("editing evaluation: maintenance gate fails when signals age out (deterministic)", () => {
  const stale = createRegistry(
    SEED_PROFILES.map((profile) =>
      profile.id === "three-js"
        ? {
            ...profile,
            maintenance: [
              { ...profile.maintenance[0]!, date: "2020-01-01" },
            ],
          }
        : profile,
    ),
  );
  const threeCandidates = deriveEditingCandidateProfiles(stale);
  const assessments = assessEditingProductionEligibility(threeCandidates, stale, { maxMaintenanceAgeDays: 365 });
  const three = assessments.find((assessment) => assessment.technologyId === "three-js");
  assert.ok(three);
  assert.equal(three.eligible, false);
  assert.ok(three.basis.includes("maintenance gate failed"));
});

test("editing evaluation: ranking is deterministic — vscode is the top eligible pick", () => {
  const ranked = rankEditingProductionEligible(assessEditingProductionEligibility(candidates, registry));
  assert.equal(ranked[0]?.technologyId, "vscode");
  // deterministic replay
  const reranked = rankEditingProductionEligible(assessEditingProductionEligibility(candidates, registry));
  assert.deepEqual(reranked, ranked);
  // eligible candidates rank before ineligible ones
  const firstIneligible = ranked.findIndex((assessment) => !assessment.eligible);
  assert.ok(firstIneligible > 0);
  for (const assessment of ranked.slice(0, firstIneligible)) {
    assert.equal(assessment.eligible, true);
  }
});

test("editing evaluation: kind shortlists cover the W5C classes", () => {
  assert.ok(editingCandidateIdsForKind(candidates, "native").includes("vscode"));
  assert.ok(editingCandidateIdsForKind(candidates, "embedded").includes("monaco-editor"));
  assert.ok(editingCandidateIdsForKind(candidates, "embedded").includes("codemirror"));
  assert.ok(editingCandidateIdsForKind(candidates, "embedded").includes("prosemirror"));
  assert.ok(editingCandidateIdsForKind(candidates, "external").includes("godot"));
  assert.ok(editingCandidateIdsForKind(candidates, "external").includes("gimp"));
  assert.equal(EDITING_RESEARCH_DATE, "2026-10-11");
  for (const format of ["json", "edit-interchange", "gltf", "glb"]) {
    assert.ok(EDITING_EVALUATION_FORMATS.includes(format as never), `format ${format} in the evaluation matrix`);
  }
});

test("editing evaluation: the vscode evaluation adapter fails closed when eligibility shifts", () => {
  const adapter = createVscodeEditingEvaluationAdapter(registry);
  assert.equal(adapter.profile.id, VSCODE_EVALUATION_ADAPTER_ID);
  assert.equal(adapter.profile.productionEligible, true);
  assert.ok(adapter.facts.eligibilityBasis.includes("MIT"));
  assert.equal(adapter.facts.maintenanceAgeDays, 4);
  // fail-closed: a registry where vscode's license is non-permissive refuses construction
  const relicensed = createRegistry(
    [...SEED_PROFILES, ...EDITOR_SEED_PROFILES].map((profile) =>
      profile.id === "vscode"
        ? { ...profile, license: { ...profile.license, spdxId: "GPL-3.0-only", name: "GNU GPL v3 (fixture relicensing)" } }
        : profile,
    ),
  );
  assert.throws(() => createVscodeEditingEvaluationAdapter(relicensed), /top production-eligible/i);
});
