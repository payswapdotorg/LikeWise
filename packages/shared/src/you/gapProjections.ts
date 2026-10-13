// YOU ToolGap / KnowledgeGap projection machinery (W8A —
// docs/you/CONTRACTS.md "Wave-8 contract freeze (v8)": "ToolGapProjection
// / KnowledgeGapProjection (projections, never authorities)"; GAP
// PERSISTENCE LAW: projections are derived, never authoritative).
//
// A projection is DERIVED from an immutable CapabilityGap record and
// consumed for display and remediation planning; it never feeds back
// into arena authority. The stateless projectors validate the
// category gate (TOOL_GAP -> ToolGapProjection, KNOWLEDGE_GAP ->
// KnowledgeGapProjection — anything else is a typed
// YOU_GAP_PROJECTION_INVALID refusal at the service seam) and the
// non-empty shape of the derived facts. Default facts derive
// deterministically from the gap record itself (the v1 category ->
// deficiency mapping); explicit inputs override them.

import type { CapabilityGap, KnowledgeGapProjection, ToolGapProjection } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/** A refusal returned by the stateless projectors (never an exception). */
export interface GapProjectionRefusal {
  /** Stable reason string (rides along in typed YOU_GAP_PROJECTION_INVALID details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** The two projection kinds. */
export type GapProjectionKind = "tool-gap" | "knowledge-gap";

/** Deterministic default remediation text per projecting category. */
export const GAP_PROJECTION_DEFAULT_REMEDIATION: Readonly<Record<"TOOL_GAP" | "KNOWLEDGE_GAP", string>> = deepFreeze({
  TOOL_GAP: "tool-substitution",
  KNOWLEDGE_GAP: "knowledge-patch",
});

/** Tool-gap projection input (all fields optional; defaults derive from the gap). */
export interface ToolGapProjectionInput {
  readonly toolId?: string | null;
  readonly requiredCapability?: string;
  readonly remediation?: string;
}

/**
 * Projects a TOOL_GAP-category CapabilityGap onto the tool inventory.
 * Refuses (stable reason) when the gap category is not TOOL_GAP or the
 * derived facts are empty. The tool inventory authority is the W8C lane
 * — toolId stays null unless explicitly supplied.
 */
export function projectToolGap(
  gap: CapabilityGap,
  input: ToolGapProjectionInput = {},
): { readonly ok: true; readonly projection: ToolGapProjection } | { readonly ok: false; readonly refusal: GapProjectionRefusal } {
  if (gap.category !== "TOOL_GAP") {
    return {
      ok: false,
      refusal: {
        reason: "category-not-tool-gap",
        detail: `a tool-gap projection requires a TOOL_GAP record (got ${gap.category})`,
      },
    };
  }
  const requiredCapability = input.requiredCapability ?? defaultRequiredCapability(gap);
  if (requiredCapability.trim().length === 0) {
    return {
      ok: false,
      refusal: { reason: "required-capability-empty", detail: "the projected requiredCapability must be a non-empty string" },
    };
  }
  const remediation = input.remediation ?? GAP_PROJECTION_DEFAULT_REMEDIATION.TOOL_GAP;
  if (remediation.trim().length === 0) {
    return {
      ok: false,
      refusal: { reason: "remediation-empty", detail: "the projected remediation must be a non-empty string" },
    };
  }
  return {
    ok: true,
    projection: deepFreeze({
      gapId: gap.id,
      toolId: input.toolId ?? null,
      requiredCapability,
      remediation,
    }),
  };
}

/** Knowledge-gap projection input (all fields optional; defaults derive from the gap). */
export interface KnowledgeGapProjectionInput {
  readonly domain?: string;
  readonly missingKnowledgeRef?: string | null;
  readonly remediation?: string;
}

/**
 * Projects a KNOWLEDGE_GAP-category CapabilityGap onto knowledge
 * domains. Refuses (stable reason) when the gap category is not
 * KNOWLEDGE_GAP or the derived facts are empty.
 */
export function projectKnowledgeGap(
  gap: CapabilityGap,
  input: KnowledgeGapProjectionInput = {},
): { readonly ok: true; readonly projection: KnowledgeGapProjection } | { readonly ok: false; readonly refusal: GapProjectionRefusal } {
  if (gap.category !== "KNOWLEDGE_GAP") {
    return {
      ok: false,
      refusal: {
        reason: "category-not-knowledge-gap",
        detail: `a knowledge-gap projection requires a KNOWLEDGE_GAP record (got ${gap.category})`,
      },
    };
  }
  const domain = input.domain ?? defaultRequiredCapability(gap);
  if (domain.trim().length === 0) {
    return {
      ok: false,
      refusal: { reason: "domain-empty", detail: "the projected domain must be a non-empty string" },
    };
  }
  const remediation = input.remediation ?? GAP_PROJECTION_DEFAULT_REMEDIATION.KNOWLEDGE_GAP;
  if (remediation.trim().length === 0) {
    return {
      ok: false,
      refusal: { reason: "remediation-empty", detail: "the projected remediation must be a non-empty string" },
    };
  }
  return {
    ok: true,
    projection: deepFreeze({
      gapId: gap.id,
      domain,
      missingKnowledgeRef: input.missingKnowledgeRef ?? null,
      remediation,
    }),
  };
}

/**
 * The deterministic default required-capability/domain derivation: the
 * gap's suggestedNextAction trimmed of whitespace, falling back to the
 * category token. Pure function of the immutable record.
 */
export function defaultRequiredCapability(gap: CapabilityGap): string {
  const trimmed = gap.suggestedNextAction.trim();
  return trimmed.length > 0 ? trimmed : gap.category.toLowerCase();
}
