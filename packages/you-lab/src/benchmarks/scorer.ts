// Deterministic benchmark scorer (W1C).
//
// The quality score is a COMPUTED fixture objective (deterministic arithmetic
// over registry facts and the capability map) — it is explicitly not a user
// study, not a live measurement, and not a scientific claim. Latency, cost
// and manual effort are recorded by the runner as "not-measured (simulated)"
// markers; they are never faked here.

import { findDomainSpec } from "../capabilityMap.js";
import { roundTo } from "../determinism.js";
import type { TechnologyRegistry } from "../technology/registry.js";
import type { CapabilityRequirement, OrganizationBinding } from "../organization/model.js";

export interface OrganizationScoreParts {
  /** Fraction of technology-bound requirements covered by satisfying tags. */
  readonly coverage: number;
  /** Fraction of required formats covered by bound technology tags. */
  readonly formatCoverage: number;
  /** Fraction of bound technologies with production-friendly licenses. */
  readonly licenseFriendly: number;
  readonly qualityScore: number;
}

export function scoreOrganization(
  bindings: readonly OrganizationBinding[],
  requirements: readonly CapabilityRequirement[],
  registry: TechnologyRegistry,
): OrganizationScoreParts {
  const bindingByRequirement = new Map<string, OrganizationBinding>();
  for (const binding of bindings) bindingByRequirement.set(binding.requirementId, binding);

  const techRequirements = requirements.filter((requirement) => !findDomainSpec(requirement.domain)?.roleOnly);
  let covered = 0;
  let bound = 0;
  let licenseOk = 0;
  let licenseTotal = 0;
  const requiredFormats: string[] = [];
  const coveredFormats = new Set<string>();
  for (const requirement of techRequirements) {
    const binding = bindingByRequirement.get(requirement.id);
    const technology = binding?.technologyId ? registry.byId(binding.technologyId) : null;
    requiredFormats.push(...requirement.requiredFormats);
    if (technology === null) continue;
    bound += 1;
    const satisfying = findDomainSpec(requirement.domain)?.satisfyingTags ?? [];
    if (satisfying.some((tag) => technology.capabilityTags.includes(tag))) covered += 1;
    const spdx = technology.license.spdxId;
    licenseTotal += 1;
    if (spdx === "MIT" || spdx === "Apache-2.0") licenseOk += 1;
    for (const format of requirement.requiredFormats) {
      if (technology.capabilityTags.includes(format)) coveredFormats.add(format);
    }
  }
  const coverage = techRequirements.length === 0 ? 1 : covered / techRequirements.length;
  const formatCoverage = requiredFormats.length === 0 ? 1 : coveredFormats.size / requiredFormats.length;
  const licenseFriendly = licenseTotal === 0 ? 1 : licenseOk / licenseTotal;
  return {
    coverage: roundTo(coverage, 4),
    formatCoverage: roundTo(formatCoverage, 4),
    licenseFriendly: roundTo(licenseFriendly, 4),
    qualityScore: roundTo(0.6 * coverage + 0.3 * formatCoverage + 0.1 * licenseFriendly, 4),
  };
}

export const SCORER_VERSION = "you-lab-benchmark-scorer/1 (deterministic fixture objective — computed, not measured)";
