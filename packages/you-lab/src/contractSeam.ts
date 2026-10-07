// SINGLE seam to the frozen YOU contract v1 (packages/shared/src/you/contract.ts).
//
// SEAM NOTE (W1C sandbox): importing "@zcode/shared" from packages/you-lab
// fails here (TS2307) because the workspace lockfile does not include you-lab
// yet — the TL registers the package and reconciles the lockfile at T1. Per
// the W1C work order, this module imports the frozen contract types through
// the relative path "../../shared/src/you/contract.js"; T1 normalizes this to
// the "@zcode/shared" public entry. This is the ONLY module in you-lab that
// touches the frozen contract (asserted by a test).
//
// Mapping is 1:1 by design: the neutral interchange shapes in
// adapters/editorAdapterSeam.ts were structurally aligned with the frozen
// SolutionEntity/SolutionEnvironmentState/SolutionPatchOperation shapes so
// the seam never redeclares or mutates contract semantics.

import type {
  EditorRecommendation,
  SolutionEntity,
  SolutionPatchOperation,
} from "../../shared/src/you/contract.js";
import type { CandidateOperation, EditorArtifact, NeutralEntity } from "./adapters/editorAdapterSeam.js";
import type { TechnologyRegistry } from "./technology/registry.js";
import type { EditorCapabilityProfile } from "./technology/editorCapability.js";

/**
 * Build a frozen-contract EditorRecommendation from a derived capability
 * profile. The rationale cites verified registry facts (license, risk) —
 * deterministic, provider-neutral, no invented claims.
 */
export function toEditorRecommendation(
  capability: EditorCapabilityProfile,
  registry: TechnologyRegistry,
): EditorRecommendation {
  const technology = registry.byId(capability.technologyId);
  const primaryFormat = capability.formatSupport.find((entry) => entry.write)?.format ?? "unknown";
  const licenseName = technology?.license.name ?? "unknown";
  const licenseSource = technology?.license.sourceUrl ?? "unknown";
  const tierWord =
    capability.integrationTier === 1 ? "native" : capability.integrationTier === 2 ? "embedded" : "external";
  const rationale =
    `${tierWord} editor candidate (integration tier ${capability.integrationTier}); editable domains: ` +
    `${capability.editableAttributeDomains.join(", ") || "none"}; round-trip risk ${capability.roundTripRisk}; ` +
    `license: ${licenseName} (source: ${licenseSource}); capability derivation: ${capability.derivedFrom}`;
  return {
    editorId: capability.technologyId,
    editorName: capability.editorName,
    rationale,
    exportFormat: primaryFormat,
  };
}

/** Map neutral candidate operations to frozen SolutionPatchOperation (1:1). */
export function toSolutionPatchOperations(
  operations: readonly CandidateOperation[],
): readonly SolutionPatchOperation[] {
  const out: SolutionPatchOperation[] = [];
  for (const operation of operations) {
    if (operation.op === "upsert_entity") {
      out.push({ op: "upsert_entity", entity: toSolutionEntity(operation.entity) });
    } else if (operation.op === "remove_entity") {
      out.push({ op: "remove_entity", entityId: operation.entityId });
    } else {
      out.push({ op: "update_environment", environment: operation.environment });
    }
  }
  return out;
}

function toSolutionEntity(entity: NeutralEntity): SolutionEntity {
  return {
    id: entity.id,
    kind: entity.kind,
    label: entity.label,
    transform: entity.transform,
    attributes: entity.attributes,
  };
}

/**
 * EditorArtifact -> frozen-contract-facing recommendation helper: a convenience
 * that derives the recommendation for the artifact's technology from its
 * derived capability profile (registry-backed, deterministic).
 */
export function recommendationForArtifact(
  artifact: EditorArtifact,
  capabilities: readonly EditorCapabilityProfile[],
  registry: TechnologyRegistry,
): EditorRecommendation | null {
  const capability = capabilities.find((entry) => entry.technologyId === artifact.technologyId);
  if (!capability) return null;
  return toEditorRecommendation(capability, registry);
}
