// ToolGap / KnowledgeGap projection builders (W8C).
//
// GAP PERSISTENCE LAW (docs/you/CONTRACTS.md "Wave-8 contract freeze
// (v8)"): CapabilityGap records are immutable and projections are DERIVED,
// never authoritative. These builders derive neutral ToolGapProjection /
// KnowledgeGapProjection shapes (structurally aligned with the frozen v8
// projections; mapping onto the frozen contract happens ONLY in
// src/contractSeam.ts) from neutral CapabilityGap-shaped records.
//
// HONEST DERIVATION: the you-lab owns NO tool inventory and NO knowledge
// authority — toolId / missingKnowledgeRef derive as null (the service
// side resolves them against the real authorities), and the derived
// capability / domain strings come from AUTHORED fixture vocabularies
// indexed deterministically by the gap id (computed, never a claim about
// any real inventory). Malformed gap records are typed rejections
// (YOU_GAP_PROJECTION_INVALID) — never silently clamped, never guessed.
//
// Determinism: pure functions of the gap record (no clock, no randomness,
// no network — hash-indexed vocabulary selection only).

import { fnv1a32 } from "../determinism.js";
import type { NeutralArenaGapRecord } from "./arenaAdapterSeam.js";

/** Error code aligned with the frozen v8 typed error literal (you-lab-owned). */
export const GAP_PROJECTION_INVALID_CODE = "YOU_GAP_PROJECTION_INVALID";

/** Typed rejection thrown when a gap record is malformed for a projection. */
export class GapProjectionInvalidError extends Error {
  readonly code = GAP_PROJECTION_INVALID_CODE;
  constructor(detail: string) {
    super(`${GAP_PROJECTION_INVALID_CODE}: ${detail}`);
  }
}

/** Neutral ToolGap projection — aligned 1:1 with the frozen v8 ToolGapProjection. */
export interface NeutralToolGapProjection {
  readonly gapId: string;
  readonly toolId: string | null;
  readonly requiredCapability: string;
  readonly remediation: string;
}

/** Neutral KnowledgeGap projection — aligned 1:1 with the frozen v8 KnowledgeGapProjection. */
export interface NeutralKnowledgeGapProjection {
  readonly gapId: string;
  readonly domain: string;
  readonly missingKnowledgeRef: string | null;
  readonly remediation: string;
}

/**
 * Authored tool-capability vocabulary for the requiredCapability
 * derivation (W8C fixture definition — deterministic hash-indexed
 * selection, never a claim about any real tool inventory).
 */
export const ARENA_TOOL_CAPABILITIES = [
  "mesh-boolean-operations",
  "uv-unwrapping",
  "rig-retargeting",
  "volumetric-capture",
  "pbr-texture-authoring",
  "motion-trace-cleanup",
] as const;

/**
 * Authored knowledge-domain vocabulary for the domain derivation (W8C
 * fixture definition — deterministic hash-indexed selection, never a claim
 * about any real knowledge authority).
 */
export const ARENA_KNOWLEDGE_DOMAINS = [
  "material-science",
  "historical-costume",
  "biomechanics",
  "photogrammetry",
  "topology-optimization",
  "anatomy-for-rigging",
] as const;

/** Deterministic hash-indexed selection from an authored vocabulary. */
function vocabularyAt(vocabulary: readonly string[], gapId: string): string {
  const index = parseInt(fnv1a32(gapId), 16) % vocabulary.length;
  return vocabulary[index] ?? vocabulary[0]!;
}

/** Fail-closed gap-record validation (shared by both projection builders). */
function assertWellFormedGapRecord(gap: NeutralArenaGapRecord): void {
  if (gap.id.length === 0) {
    throw new GapProjectionInvalidError("gap record id is empty (a projection names its gap)");
  }
  if (gap.category.length === 0) {
    throw new GapProjectionInvalidError(`gap ${gap.id}: category is empty`);
  }
  if (typeof gap.confidence !== "number" || !Number.isFinite(gap.confidence) || gap.confidence < 0 || gap.confidence > 1) {
    throw new GapProjectionInvalidError(`gap ${gap.id}: confidence ${gap.confidence} is outside [0, 1] (never silently clamped)`);
  }
  if (gap.suggestedNextAction.length === 0) {
    throw new GapProjectionInvalidError(`gap ${gap.id}: suggestedNextAction is empty (a projection derives its remediation from it)`);
  }
  for (const strategy of gap.attemptedStrategies) {
    if (strategy.strategy.length === 0) {
      throw new GapProjectionInvalidError(`gap ${gap.id}: attempted strategy entry with empty strategy string`);
    }
    if (strategy.outcome !== "failed" && strategy.outcome !== "partial" && strategy.outcome !== "rejected") {
      throw new GapProjectionInvalidError(`gap ${gap.id}: attempted strategy '${strategy.strategy}' has invalid outcome '${strategy.outcome}' (failed/partial/rejected)`);
    }
  }
}

/**
 * Build the neutral ToolGap projection from a neutral CapabilityGap-shaped
 * record (derived, never authoritative). toolId stays null — the you-lab
 * owns no tool inventory (the service side resolves it against the real
 * authority); requiredCapability is the deterministic hash-indexed
 * authored-vocabulary derivation.
 */
export function buildToolGapProjection(gap: NeutralArenaGapRecord): NeutralToolGapProjection {
  assertWellFormedGapRecord(gap);
  if (gap.category !== "TOOL_GAP") {
    throw new GapProjectionInvalidError(
      `tool projection requires category TOOL_GAP (gap ${gap.id} carries '${gap.category}')`,
    );
  }
  const requiredCapability = vocabularyAt(ARENA_TOOL_CAPABILITIES, gap.id);
  const remediation =
    `Register or bind a tool providing "${requiredCapability}" (${gap.attemptedStrategies.length} attempted strateg${gap.attemptedStrategies.length === 1 ? "y" : "ies"} recorded; ` +
    `confidence ${gap.confidence}; suggested action: ${gap.suggestedNextAction}) — projection, never an authority`;
  return {
    gapId: gap.id,
    toolId: null,
    requiredCapability,
    remediation,
  };
}

/**
 * Build the neutral KnowledgeGap projection from a neutral
 * CapabilityGap-shaped record (derived, never authoritative).
 * missingKnowledgeRef stays null — the you-lab owns no knowledge store;
 * domain is the deterministic hash-indexed authored-vocabulary derivation.
 */
export function buildKnowledgeGapProjection(gap: NeutralArenaGapRecord): NeutralKnowledgeGapProjection {
  assertWellFormedGapRecord(gap);
  if (gap.category !== "KNOWLEDGE_GAP") {
    throw new GapProjectionInvalidError(
      `knowledge projection requires category KNOWLEDGE_GAP (gap ${gap.id} carries '${gap.category}')`,
    );
  }
  const domain = vocabularyAt(ARENA_KNOWLEDGE_DOMAINS, gap.id);
  const remediation =
    `Ingest or retrieve knowledge in the "${domain}" domain (confidence ${gap.confidence}; ` +
    `suggested action: ${gap.suggestedNextAction}) — projection, never an authority`;
  return {
    gapId: gap.id,
    domain,
    missingKnowledgeRef: null,
    remediation,
  };
}
