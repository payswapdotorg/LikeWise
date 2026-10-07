// Deterministic Organization Compiler (W1C).
//
// Intent -> capability decomposition -> candidate roles/tools/editors ->
// dependency-ordered OrganizationPlan (docs/you/ARCHITECTURE.md §11,
// docs/you/LAB.md "Compilation").
//
// DETERMINISM LAWS (docs/you/FIXTURES.md): fully deterministic — no
// Date.now/Math.random/performance.now/network anywhere in this path. All
// ordering is explicit (sorted by id/domain); digests use integer FNV-1a
// arithmetic; the only "dates" involved are static research-snapshot strings
// from the registry. Same input => byte-identical plan.
//
// HONESTY: this is a deterministic heuristic compiler — explicitly NOT a
// model call. Every plan is labeled generator="deterministic-heuristic" and
// carries that note.

import { FORMAT_DOMAINS, INTENT_KEYWORDS, OUTPUT_KIND_DOMAINS, QUALITY_DOMAIN, findDomainSpec } from "../capabilityMap.js";
import { canonicalJson, daysBetweenIso, fnv1a32, roundTo } from "../determinism.js";
import { integrationTierFor } from "../technology/editorCapability.js";
import type { TechnologyProfile, TechnologyRegistry } from "../technology/registry.js";
import type { CapabilityRequirement, OrganizationBinding, OrganizationIntent, OrganizationPlan, OrganizationPlanStep } from "./model.js";
import { organizationCompilerVersion } from "./model.js";

/** Static research snapshot date — the only "today" the compiler knows. */
const RESEARCH_DATE = "2026-10-08";
const MAINTENANCE_RECENCY_DAYS = 365;

export function digestIntent(intent: OrganizationIntent): string {
  return fnv1a32(canonicalJson(intent));
}

/** Deterministic intent -> capability requirements decomposition. */
export function decomposeIntent(intent: OrganizationIntent): readonly CapabilityRequirement[] {
  const constraints = intent.constraints;
  const domains = new Set<string>(OUTPUT_KIND_DOMAINS[constraints.outputKind]);
  for (const format of constraints.requiredFormats) {
    const domain = FORMAT_DOMAINS[format];
    if (domain) domains.add(domain);
  }
  if (constraints.qualityTarget >= QUALITY_DOMAIN.threshold) {
    domains.add(QUALITY_DOMAIN.domain);
  }
  const lowered = intent.text.toLowerCase();
  for (const entry of INTENT_KEYWORDS) {
    if (lowered.includes(entry.keyword)) domains.add(entry.domain);
  }
  domains.add("quality-verification"); // every plan ends with evaluation
  const sortedDomains = [...domains].sort();
  return sortedDomains.map((domain, index) => {
    const formats =
      domain === "quality-verification"
        ? []
        : constraints.requiredFormats.filter((format) => FORMAT_DOMAINS[format] === domain);
    return {
      id: `req-${index}-${domain}`,
      domain,
      minimumQuality: roundTo(0.5 + 0.4 * constraints.qualityTarget, 2),
      requiredFormats: [...formats].sort(),
    };
  });
}

export interface CandidateScore {
  readonly technologyId: string;
  readonly score: number;
  readonly tagCoverage: number;
  readonly formatCoverage: number;
  readonly licenseAdjustment: number;
  readonly maintenanceAdjustment: number;
  readonly integrationAdjustment: number;
}

/** Deterministic candidate scoring for one requirement (exported for tests). */
export function scoreCandidate(
  technology: TechnologyProfile,
  requirement: CapabilityRequirement,
  intent: OrganizationIntent,
): CandidateScore {
  const spec = findDomainSpec(requirement.domain);
  const satisfyingTags = spec?.satisfyingTags ?? [];
  const overlap = satisfyingTags.filter((tag) => technology.capabilityTags.includes(tag));
  const tagCoverage = satisfyingTags.length === 0 ? 0 : overlap.length / satisfyingTags.length;
  const formatCoverage =
    requirement.requiredFormats.length === 0
      ? 0
      : requirement.requiredFormats.filter((format) => technology.capabilityTags.includes(format)).length /
        requirement.requiredFormats.length;
  const relevance = tagCoverage > 0 || formatCoverage > 0;

  const latestSignal = technology.maintenance
    .map((signal) => signal.date)
    .sort()
    .at(-1);
  const maintenanceAdjustment =
    latestSignal !== undefined && daysBetweenIso(latestSignal.slice(0, 10), RESEARCH_DATE) <= MAINTENANCE_RECENCY_DAYS ? 0.5 : 0;

  const spdx = technology.license.spdxId;
  const licenseAdjustment = spdx === "MIT" || spdx === "Apache-2.0" ? 0.5 : spdx === null ? 0.1 : 0.25;

  const tier = integrationTierFor(technology.id);
  let integrationAdjustment = 0;
  if (intent.constraints.platform === "web" && tier === 3) integrationAdjustment -= 1.5;
  if (intent.constraints.editorPreference === "prefer-native" && (tier === 1 || tier === 2)) integrationAdjustment += 0.5;
  if (intent.constraints.editorPreference === "prefer-external" && tier === 3) integrationAdjustment += 0.5;

  const score = relevance ? roundTo(2 * tagCoverage + 1.5 * formatCoverage + licenseAdjustment + maintenanceAdjustment + integrationAdjustment, 3) : 0;
  return { technologyId: technology.id, score, tagCoverage, formatCoverage, licenseAdjustment, maintenanceAdjustment, integrationAdjustment };
}

function buildBinding(
  requirement: CapabilityRequirement,
  registry: TechnologyRegistry,
  intent: OrganizationIntent,
): OrganizationBinding {
  const spec = findDomainSpec(requirement.domain);
  const role = spec?.role ?? "integration engineer";
  if (spec?.roleOnly) {
    return {
      requirementId: requirement.id,
      kind: "role",
      technologyId: null,
      roleName: role,
      rationale: "role-owned capability — no technology binding required",
    };
  }
  const scored = registry.profiles
    .map((technology) => scoreCandidate(technology, requirement, intent))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => (a.score !== b.score ? b.score - a.score : a.technologyId < b.technologyId ? -1 : 1));
  const best = scored.at(0);
  if (best === undefined) {
    return {
      requirementId: requirement.id,
      kind: "role",
      technologyId: null,
      roleName: role,
      rationale: `no registry candidate covers domain "${requirement.domain}" — recorded as a capability-gap candidate`,
    };
  }
  const technology = registry.byId(best.technologyId);
  const kind = technology?.editorCapable ? "editor" : "tool";
  return {
    requirementId: requirement.id,
    kind,
    technologyId: best.technologyId,
    roleName: role,
    rationale: `score=${best.score} tagCoverage=${roundTo(best.tagCoverage, 3)} formatCoverage=${roundTo(best.formatCoverage, 3)} license=${technology?.license.spdxId ?? "custom"} (${technology?.license.name ?? "unknown"})`,
  };
}

/** Compile an intent into a deterministic, dependency-ordered OrganizationPlan. */
export function compileOrganization(intent: OrganizationIntent, registry: TechnologyRegistry): OrganizationPlan {
  const requirements = decomposeIntent(intent);
  const intentDigest = digestIntent(intent);
  const bindingsByRequirement = new Map<string, OrganizationBinding>();
  for (const requirement of requirements) {
    bindingsByRequirement.set(requirement.id, buildBinding(requirement, registry, intent));
  }

  const stages: readonly ("construct" | "edit" | "review")[] = ["construct", "edit", "review"];
  const stageRequirements = new Map<string, CapabilityRequirement[]>();
  for (const stage of stages) stageRequirements.set(stage, []);
  for (const requirement of requirements) {
    const spec = findDomainSpec(requirement.domain);
    const stage = spec?.stage ?? "construct";
    const bucket = stageRequirements.get(stage);
    if (bucket) bucket.push(requirement);
  }

  const steps: OrganizationPlanStep[] = [];
  const addStep = (stage: OrganizationPlanStep["stage"], reqs: readonly CapabilityRequirement[], dependsOn: string[]): string => {
    const stepId = `step-${steps.length + 1}-${stage}`;
    steps.push({
      stepId,
      stage,
      requirementIds: reqs.map((requirement) => requirement.id),
      bindings: reqs
        .map((requirement) => bindingsByRequirement.get(requirement.id))
        .filter((binding): binding is OrganizationBinding => binding !== undefined),
      dependsOn,
    });
    return stepId;
  };

  const decomposeStepId = addStep("decompose", requirements, []);
  let previous = decomposeStepId;
  for (const stage of stages) {
    const reqs = stageRequirements.get(stage) ?? [];
    if (reqs.length === 0) continue;
    const sortedReqs = [...reqs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    previous = addStep(stage, sortedReqs, [previous]);
  }

  const notes = [
    "compiled by the deterministic heuristic Organization Compiler — explicitly not a model call; no randomness, clock or network is used",
    "technology ids reference the provider-neutral you-lab technology registry; providers are replaceable adapters, never authorities",
  ];
  const gapRequirements = requirements.filter((requirement) => {
    const binding = bindingsByRequirement.get(requirement.id);
    return binding?.technologyId === null && !findDomainSpec(requirement.domain)?.roleOnly;
  });
  for (const requirement of gapRequirements) {
    notes.push(`capability-gap candidate: domain "${requirement.domain}" (${requirement.id}) has no registry candidate`);
  }

  const planWithoutId: Omit<OrganizationPlan, "planId"> = {
    compilerVersion: organizationCompilerVersion(),
    generator: "deterministic-heuristic",
    intentDigest,
    requirements,
    steps,
    notes,
  };
  return { planId: fnv1a32(canonicalJson(planWithoutId)), ...planWithoutId };
}
