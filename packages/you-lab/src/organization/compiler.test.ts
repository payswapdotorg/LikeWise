// Organization compiler tests (W1C) — coverage areas 4 and 5: determinism
// (identical input -> byte-identical plan; different intent -> different plan)
// and valid dependency-ordered plans (no cycles, all requirements bound).
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../determinism.js";
import { compileOrganization, decomposeIntent, digestIntent, scoreCandidate } from "./compiler.js";
import { validateOrganizationPlan } from "./model.js";
import { createDefaultRegistry } from "../technology/seedProfiles.js";
import { BENCHMARK_FIXTURES } from "../benchmarks/fixtures.js";

const registry = createDefaultRegistry();

const baseIntent = {
  text: "Create an avatar of my synthetic human and export it for external editing",
  constraints: {
    outputKind: "avatar",
    requiredFormats: ["vrm"],
    qualityTarget: 0.8,
    latencyBudgetUnits: 100,
    costBudgetUnits: 50,
    privacyPolicy: "allow-external-editor",
    platform: "desktop",
    editorPreference: "prefer-external",
  },
} as const;

test("compiler: identical input produces a byte-identical plan (stable serialization)", () => {
  const a = compileOrganization(baseIntent, registry);
  const b = compileOrganization(baseIntent, registry);
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(a.planId, b.planId);
  // digesting the whole plan is stable too
  assert.equal(canonicalJson(a.steps), canonicalJson(b.steps));
});

test("compiler: different intent produces a different plan", () => {
  const a = compileOrganization(baseIntent, registry);
  const variant = compileOrganization(
    {
      text: "Annotate the captured reference with a diagram",
      constraints: { ...baseIntent.constraints, outputKind: "annotation", requiredFormats: ["svg"] },
    },
    registry,
  );
  assert.notEqual(a.planId, variant.planId);
  assert.notEqual(a.intentDigest, variant.intentDigest);
  assert.notEqual(a.requirements, variant.requirements);
});

test("compiler: intent digest is deterministic and input-sensitive", () => {
  assert.equal(digestIntent(baseIntent), digestIntent({ ...baseIntent }));
  assert.notEqual(digestIntent(baseIntent), digestIntent({ ...baseIntent, text: `${baseIntent.text}!` }));
});

test("compiler: plans are valid, dependency-ordered and cycle-free (all fixtures)", () => {
  for (const fixture of BENCHMARK_FIXTURES) {
    const plan = compileOrganization(fixture.intent, registry);
    const validation = validateOrganizationPlan(plan, registry.ids());
    assert.deepEqual(validation.issues, [], `${fixture.fixtureId}: ${validation.issues.join("; ")}`);
    assert.equal(validation.valid, true);
    // topological property: every dependency appears strictly earlier
    const positions = new Map(plan.steps.map((step, index) => [step.stepId, index]));
    for (const step of plan.steps) {
      for (const dep of step.dependsOn) {
        assert.ok((positions.get(dep) ?? -1) < (positions.get(step.stepId) ?? -1), `${fixture.fixtureId}: ${step.stepId} depends on ${dep}`);
      }
    }
    // first step is the decomposition step; no cycles implied by strict ordering
    assert.equal(plan.steps[0]?.stage, "decompose");
  }
});

test("compiler: every plan is labeled as a deterministic heuristic, not a model call", () => {
  const plan = compileOrganization(baseIntent, registry);
  assert.equal(plan.generator, "deterministic-heuristic");
  assert.ok(plan.notes[0]?.includes("deterministic heuristic"));
  assert.ok(plan.notes[0]?.includes("not a model call"));
  assert.ok(plan.notes[0]?.includes("no randomness"));
});

test("compiler: decomposition goldens — fixtures produce the recorded requirement domains", () => {
  for (const fixture of BENCHMARK_FIXTURES) {
    const requirements = decomposeIntent(fixture.intent);
    assert.deepEqual(
      requirements.map((requirement) => requirement.domain),
      fixture.expectedRequirementDomains,
      fixture.fixtureId,
    );
  }
});

test("compiler: plan digest goldens — fixtures produce the recorded plan ids", () => {
  for (const fixture of BENCHMARK_FIXTURES) {
    const plan = compileOrganization(fixture.intent, registry);
    assert.equal(plan.planId, fixture.expectedPlanDigest, fixture.fixtureId);
  }
});

test("compiler: keyword-driven decomposition is deterministic and additive", () => {
  const quiet = decomposeIntent({
    text: "A plain scene",
    constraints: { ...baseIntent.constraints, outputKind: "3d-scene", requiredFormats: [] },
  });
  const withKeywords = decomposeIntent({
    text: "A scene with walking motion, facial expression and lighting",
    constraints: { ...baseIntent.constraints, outputKind: "3d-scene", requiredFormats: [] },
  });
  const quietDomains = quiet.map((requirement) => requirement.domain);
  const keywordDomains = withKeywords.map((requirement) => requirement.domain);
  for (const domain of quietDomains) {
    assert.ok(keywordDomains.includes(domain), `keyword decomposition must be additive: ${domain}`);
  }
  assert.ok(keywordDomains.includes("motion"));
  assert.ok(keywordDomains.includes("facial-expression"));
  assert.ok(keywordDomains.includes("lighting"));
});

test("compiler: an uncovered domain yields an honest capability-gap binding, never a fake one", () => {
  const plan = compileOrganization(
    {
      text: "Export the scene mesh to OBJ for a legacy toolchain",
      constraints: {
        outputKind: "3d-scene",
        requiredFormats: ["obj"],
        qualityTarget: 0.6,
        latencyBudgetUnits: 60,
        costBudgetUnits: 20,
        privacyPolicy: "local-only",
        platform: "desktop",
        editorPreference: "none",
      },
    },
    registry,
  );
  const gapBindings = plan.steps.flatMap((step) => step.bindings).filter((binding) => binding.technologyId === null);
  assert.ok(gapBindings.some((binding) => binding.rationale.includes("no registry candidate")));
  assert.ok(plan.notes.some((note) => note.includes("capability-gap candidate")));
  // validation still passes: the gap is explicit, the requirement IS bound (to a role)
  const validation = validateOrganizationPlan(plan, registry.ids());
  assert.equal(validation.valid, true);
});

test("compiler: platform constraint changes the binding deterministically (web penalizes tier-3)", () => {
  const constraints = {
    outputKind: "3d-scene",
    requiredFormats: [],
    qualityTarget: 0.8,
    latencyBudgetUnits: 100,
    costBudgetUnits: 50,
    privacyPolicy: "allow-external-editor",
    editorPreference: "prefer-external",
  } as const;
  const desktop = compileOrganization({ text: "Model a mesh", constraints: { ...constraints, platform: "desktop" } }, registry);
  const web = compileOrganization({ text: "Model a mesh", constraints: { ...constraints, platform: "web" } }, registry);
  assert.notEqual(desktop.planId, web.planId, "platform is part of the deterministic decision");
  const bindingFor = (plan: typeof desktop, domain: string) =>
    plan.steps
      .flatMap((step) => step.bindings)
      .find((binding) => binding.requirementId.endsWith(`-${domain}`));
  // tier-3 (external desktop app) wins scene-construction on desktop...
  assert.equal(bindingFor(desktop, "scene-construction")?.technologyId, "blender");
  // ...and the web penalty deterministically flips the binding to a web-capable tier
  assert.equal(bindingFor(web, "scene-construction")?.technologyId, "react-three-fiber");
  // the penalty itself is visible in candidate scoring
  const requirement = desktop.requirements.find((req) => req.domain === "scene-construction");
  assert.ok(requirement);
  const blender = registry.byId("blender");
  assert.ok(blender);
  const desktopScore = scoreCandidate(blender, requirement, { text: "Model a mesh", constraints: { ...constraints, platform: "desktop" } });
  const webScore = scoreCandidate(blender, requirement, { text: "Model a mesh", constraints: { ...constraints, platform: "web" } });
  assert.equal(webScore.integrationAdjustment, desktopScore.integrationAdjustment - 1.5);
});
