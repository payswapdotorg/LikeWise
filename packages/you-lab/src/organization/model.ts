// Provider-neutral organization model (W1C).
//
// These shapes carry no provider-specific semantics: technologies appear only
// as opaque registry ids, roles come from the docs/you/LAB.md role vocabulary
// and intent selects organizations/toolchains, not models
// (docs/you/ARCHITECTURE.md §11). Mapping onto the frozen @zcode/shared YOU
// contract happens only at src/contractSeam.ts.

import type { PlanStage } from "../capabilityMap.js";

export type OutputKind =
  | "3d-scene"
  | "avatar"
  | "image"
  | "video"
  | "diagram"
  | "annotation"
  | "timeline-edit";

export type PrivacyPolicy = "local-only" | "allow-external-editor" | "allow-remote-compute";
export type EditorPreference = "none" | "prefer-native" | "prefer-external";

export interface OrganizationConstraints {
  readonly outputKind: OutputKind;
  readonly requiredFormats: readonly string[];
  /** Target quality in [0, 1] (fixture-defined, never a scientific claim). */
  readonly qualityTarget: number;
  /** Abstract budget units — consumed only by explicitly-simulated estimates. */
  readonly latencyBudgetUnits: number;
  readonly costBudgetUnits: number;
  readonly privacyPolicy: PrivacyPolicy;
  readonly platform: "web" | "desktop";
  readonly editorPreference: EditorPreference;
}

export interface OrganizationIntent {
  readonly text: string;
  readonly constraints: OrganizationConstraints;
}

export interface CapabilityRequirement {
  readonly id: string;
  /** Capability domain id from src/capabilityMap.ts. */
  readonly domain: string;
  /** Deterministic minimum quality in [0, 1] derived from the intent. */
  readonly minimumQuality: number;
  readonly requiredFormats: readonly string[];
}

export type BindingKind = "role" | "tool" | "editor";

export interface OrganizationBinding {
  readonly requirementId: string;
  readonly kind: BindingKind;
  /** Registry technology id, or null when the requirement is unbound (gap). */
  readonly technologyId: string | null;
  /** Lab role from the docs/you/LAB.md role vocabulary. */
  readonly roleName: string;
  readonly rationale: string;
}

export interface OrganizationPlanStep {
  readonly stepId: string;
  readonly stage: PlanStage;
  readonly requirementIds: readonly string[];
  readonly bindings: readonly OrganizationBinding[];
  /** Step ids this step depends on (all appear earlier in the plan). */
  readonly dependsOn: readonly string[];
}

export interface OrganizationPlan {
  /** Deterministic digest id: fnv1a32 of the canonical plan serialization. */
  readonly planId: string;
  readonly compilerVersion: string;
  /** Honest label: a deterministic heuristic, explicitly not a model call. */
  readonly generator: "deterministic-heuristic";
  readonly intentDigest: string;
  readonly requirements: readonly CapabilityRequirement[];
  readonly steps: readonly OrganizationPlanStep[];
  readonly notes: readonly string[];
}

export interface PlanValidation {
  readonly valid: boolean;
  /** Sorted issue strings; empty when valid. */
  readonly issues: readonly string[];
}

const ORG_COMPILER_VERSION = "you-lab-organization-compiler/1";

export function organizationCompilerVersion(): string {
  return ORG_COMPILER_VERSION;
}

/**
 * Plan validity (tested): no duplicate step ids; dependsOn references exist;
 * no dependency cycles (Kahn); every step's dependencies appear EARLIER
 * (dependency-ordered output); every requirement is bound by at least one
 * binding (possibly an explicit unbound gap binding); bound technology ids
 * exist in the registry.
 */
export function validateOrganizationPlan(
  plan: OrganizationPlan,
  knownTechnologyIds: readonly string[],
): PlanValidation {
  const issues: string[] = [];
  const known = new Set(knownTechnologyIds);
  const stepIds = new Set<string>();
  for (const step of plan.steps) {
    if (stepIds.has(step.stepId)) issues.push(`duplicate stepId ${step.stepId}`);
    stepIds.add(step.stepId);
  }
  const position = new Map<string, number>();
  plan.steps.forEach((step, index) => position.set(step.stepId, index));
  for (const step of plan.steps) {
    for (const dep of step.dependsOn) {
      if (!stepIds.has(dep)) issues.push(`${step.stepId}: unknown dependency ${dep}`);
      const depIndex = position.get(dep);
      if (depIndex !== undefined && depIndex >= (position.get(step.stepId) ?? 0)) {
        issues.push(`${step.stepId}: dependency ${dep} does not appear earlier`);
      }
    }
  }
  // Cycle check (Kahn) over the step graph.
  const indegree = new Map<string, number>();
  const edges = new Map<string, string[]>();
  for (const step of plan.steps) {
    indegree.set(step.stepId, step.dependsOn.length);
    for (const dep of step.dependsOn) {
      edges.set(dep, [...(edges.get(dep) ?? []), step.stepId]);
    }
  }
  const queue = plan.steps.filter((step) => (indegree.get(step.stepId) ?? 0) === 0).map((step) => step.stepId);
  let processed = 0;
  const pending = [...queue];
  while (pending.length > 0) {
    const current = pending.shift() as string;
    processed += 1;
    for (const next of edges.get(current) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) pending.push(next);
    }
  }
  if (processed !== plan.steps.length) issues.push("dependency cycle detected among steps");
  // Requirement binding coverage.
  const boundRequirements = new Set<string>();
  for (const step of plan.steps) {
    for (const binding of step.bindings) {
      boundRequirements.add(binding.requirementId);
      if (binding.technologyId !== null && !known.has(binding.technologyId)) {
        issues.push(`binding references unknown technology ${binding.technologyId}`);
      }
      if (binding.roleName.length === 0) issues.push(`binding for ${binding.requirementId} has no role`);
    }
  }
  for (const requirement of plan.requirements) {
    if (!boundRequirements.has(requirement.id)) {
      issues.push(`requirement ${requirement.id} (${requirement.domain}) is not bound`);
    }
  }
  const requirementIds = new Set(plan.requirements.map((requirement) => requirement.id));
  for (const id of boundRequirements) {
    if (!requirementIds.has(id)) issues.push(`binding references unknown requirement ${id}`);
  }
  if (plan.generator !== "deterministic-heuristic") issues.push("plan generator label missing");
  if (plan.compilerVersion !== ORG_COMPILER_VERSION) issues.push("plan compilerVersion mismatch");
  const sorted = [...new Set(issues)].sort();
  return { valid: sorted.length === 0, issues: sorted };
}
