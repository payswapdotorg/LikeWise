// Benchmark comparison arms (W1C) — docs/you/LAB.md "Organization comparison":
// every serious Lab experiment compares (1) a generalist baseline,
// (2) a hand-designed organization and (3) a searched organization.
// The searched organization is only promoted when it beats the baseline
// under the relevant objective (asserted in benchmark tests).

import { findDomainSpec } from "../capabilityMap.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { CapabilityRequirement, OrganizationBinding, OrganizationIntent } from "../organization/model.js";
import { scoreCandidate } from "../organization/compiler.js";
import { scoreOrganization } from "./scorer.js";

export type ArmKind = "generalist-baseline" | "hand-designed" | "searched";

export interface OrganizationCandidate {
  readonly arm: ArmKind;
  readonly label: string;
  /** One binding per requirement (deterministic order = requirement order). */
  readonly bindings: readonly OrganizationBinding[];
  /** Deterministic fixture objective score (computed, not measured). */
  readonly qualityScore: number;
}

/** Domains where a binding must be technology-bound (excludes role-only). */
function technologyRequirements(requirements: readonly CapabilityRequirement[]): readonly CapabilityRequirement[] {
  return requirements.filter((requirement) => !findDomainSpec(requirement.domain)?.roleOnly);
}

function roleBinding(requirement: CapabilityRequirement): OrganizationBinding {
  return {
    requirementId: requirement.id,
    kind: "role",
    technologyId: null,
    roleName: findDomainSpec(requirement.domain)?.role ?? "integration engineer",
    rationale: "role-owned capability — no technology binding required",
  };
}

function gapBinding(requirement: CapabilityRequirement): OrganizationBinding {
  return {
    requirementId: requirement.id,
    kind: "role",
    technologyId: null,
    roleName: findDomainSpec(requirement.domain)?.role ?? "integration engineer",
    rationale: `no registry candidate covers domain "${requirement.domain}" — capability-gap candidate`,
  };
}

/** Arm 1: one generalist technology bound to every requirement (baseline). */
export function generalistBaselineArm(
  intent: OrganizationIntent,
  requirements: readonly CapabilityRequirement[],
  registry: TechnologyRegistry,
): OrganizationCandidate {
  const techReqs = technologyRequirements(requirements);
  // The generalist is the single technology satisfying the most domains
  // (ties broken by id) — a deterministic "one tool for everything" choice.
  const domainCounts = new Map<string, number>();
  for (const requirement of techReqs) {
    const satisfying = findDomainSpec(requirement.domain)?.satisfyingTags ?? [];
    for (const technology of registry.profiles) {
      if (satisfying.some((tag) => technology.capabilityTags.includes(tag))) {
        domainCounts.set(technology.id, (domainCounts.get(technology.id) ?? 0) + 1);
      }
    }
  }
  let generalist: string | null = null;
  let bestCount = 0;
  for (const technology of registry.profiles) {
    const count = domainCounts.get(technology.id) ?? 0;
    if (count > bestCount || (count === bestCount && count > 0 && generalist !== null && technology.id < generalist)) {
      if (count > 0) {
        generalist = technology.id;
        bestCount = count;
      }
    }
  }
  const bindings = requirements.map((requirement) => {
    const spec = findDomainSpec(requirement.domain);
    if (spec?.roleOnly) return roleBinding(requirement);
    if (generalist === null) return gapBinding(requirement);
    return {
      requirementId: requirement.id,
      kind: (registry.byId(generalist)?.editorCapable ? "editor" : "tool") as OrganizationBinding["kind"],
      technologyId: generalist,
      roleName: spec?.role ?? "integration engineer",
      rationale: `generalist baseline: single technology "${generalist}" bound to every requirement`,
    };
  });
  return {
    arm: "generalist-baseline",
    label: `generalist baseline (one technology for everything; outputKind=${intent.constraints.outputKind})`,
    bindings,
    qualityScore: scoreOrganization(bindings, requirements, registry).qualityScore,
  };
}

/**
 * Arm 2: hand-designed organization — an authored static domain-to-technology
 * mapping (engineering judgment, disclosed as hand-designed; not searched).
 */
const HAND_DESIGN: Readonly<Record<string, string | null>> = {
  "scene-render": "three-js",
  "scene-construction": "react-three-fiber",
  "asset-optimization": "gltf-transform",
  "avatar-rig": "three-vrm",
  "avatar-expression": "three-vrm",
  motion: "three-vrm",
  "facial-expression": "three-vrm",
  "image-composition": "three-js",
  "environment-staging": "three-js",
  lighting: "three-js",
  "gltf-interchange": "gltf-transform",
  "vrm-avatar-output": "three-vrm",
  "svg-output": "svg-edit",
  "rendered-media-output": "openreel",
  "vector-2d-composition": "svg-edit",
  "annotation-edit": "excalidraw",
  "editorial-timeline": "openreel",
  "media-composition": "openreel",
  "timeline-interchange": "opentimelineio",
  "usd-interchange": "openusd",
  "obj-interchange": null,
};

export function handDesignedArm(
  intent: OrganizationIntent,
  requirements: readonly CapabilityRequirement[],
  registry: TechnologyRegistry,
): OrganizationCandidate {
  const bindings = requirements.map((requirement) => {
    const spec = findDomainSpec(requirement.domain);
    if (spec?.roleOnly) return roleBinding(requirement);
    const technologyId = HAND_DESIGN[requirement.domain] ?? null;
    if (technologyId === null) return gapBinding(requirement);
    return {
      requirementId: requirement.id,
      kind: (registry.byId(technologyId)?.editorCapable ? "editor" : "tool") as OrganizationBinding["kind"],
      technologyId,
      roleName: spec?.role ?? "integration engineer",
      rationale: `hand-designed binding: domain "${requirement.domain}" -> ${technologyId} (authored mapping)`,
    };
  });
  return {
    arm: "hand-designed",
    label: `hand-designed organization (authored mapping; outputKind=${intent.constraints.outputKind})`,
    bindings,
    qualityScore: scoreOrganization(bindings, requirements, registry).qualityScore,
  };
}

/**
 * Arm 3: deterministic exhaustive search over the small fixture space.
 * Candidates per requirement are registry technologies with positive compiler
 * relevance; the full cartesian product is enumerated in a stable order and
 * scored with the same deterministic objective. Guard: if the product would
 * exceed 4096 combinations, only the top-2 candidates per requirement (score
 * desc, id asc) are searched and the truncation is disclosed in the label.
 */
const SEARCH_LIMIT = 4096;

export function searchedArm(
  intent: OrganizationIntent,
  requirements: readonly CapabilityRequirement[],
  registry: TechnologyRegistry,
): OrganizationCandidate {
  const techReqs = technologyRequirements(requirements);
  const candidatesPerRequirement = techReqs.map((requirement) => {
    const scored = registry.profiles
      .map((technology) => scoreCandidate(technology, requirement, intent))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => (a.score !== b.score ? b.score - a.score : a.technologyId < b.technologyId ? -1 : 1));
    return { requirement, candidates: scored.map((candidate) => candidate.technologyId) };
  });
  let product = 1;
  let truncated = false;
  for (const entry of candidatesPerRequirement) {
    product *= Math.max(entry.candidates.length, 1);
  }
  const effective = candidatesPerRequirement.map((entry) => {
    const candidates = entry.candidates.length > 0 ? entry.candidates : [null];
    return { requirement: entry.requirement, candidates: candidates as readonly (string | null)[] };
  });
  if (product > SEARCH_LIMIT) {
    truncated = true;
    for (const entry of effective) {
      entry.candidates = entry.candidates.slice(0, 2);
    }
  }

  let best: { bindings: OrganizationBinding[]; score: number; sequence: string } | null = null;
  const combination: (string | null)[] = effective.map((): string | null => null);
  const visit = (index: number): void => {
    if (index === effective.length) {
      const bindings = requirements.map((requirement) => {
        const spec = findDomainSpec(requirement.domain);
        if (spec?.roleOnly) return roleBinding(requirement);
        const slot = effective.findIndex((entry) => entry.requirement.id === requirement.id);
        const technologyId = slot >= 0 ? (combination[slot] ?? null) : null;
        if (technologyId === null) return gapBinding(requirement);
        return {
          requirementId: requirement.id,
          kind: (registry.byId(technologyId)?.editorCapable ? "editor" : "tool") as OrganizationBinding["kind"],
          technologyId,
          roleName: spec?.role ?? "integration engineer",
          rationale: `searched binding: domain "${requirement.domain}" -> ${technologyId}`,
        };
      });
      const score = scoreOrganization(bindings, requirements, registry).qualityScore;
      const sequence = bindings.map((binding) => binding.technologyId ?? "-").join("|");
      if (best === null || score > best.score) {
        best = { bindings, score, sequence };
      }
      return;
    }
    const entry = effective[index];
    if (!entry) return;
    for (const candidate of entry.candidates) {
      combination[index] = candidate;
      visit(index + 1);
    }
  };
  visit(0);
  const winner = best ?? { bindings: requirements.map((requirement) => (findDomainSpec(requirement.domain)?.roleOnly ? roleBinding(requirement) : gapBinding(requirement))), score: 0, sequence: "" };
  return {
    arm: "searched",
    label: truncated
      ? "searched organization (deterministic exhaustive search, truncated to top-2 candidates per requirement)"
      : "searched organization (deterministic exhaustive search)",
    bindings: winner.bindings,
    qualityScore: winner.score,
  };
}
