// YOU arena service — the gap-projection flow (W8A): ToolGap /
// KnowledgeGap projections are DERIVED from immutable CapabilityGap
// records and published for display and remediation planning (GAP
// PERSISTENCE LAW: projections, never authorities). Category/shape
// violations are typed YOU_GAP_PROJECTION_INVALID. Emits
// gap-projection-published.

import type { KnowledgeGapProjection, OpaqueId, ToolGapProjection } from "@zcode/shared";
import { deepFreeze } from "../../../shared/src/you/serialize.js";
import { projectKnowledgeGap, projectToolGap, type KnowledgeGapProjectionInput, type ToolGapProjectionInput } from "../../../shared/src/you/gapProjections.js";
import { appendGapProjectionPublished } from "./arenaLedgerOps.js";
import {
  arenaFailure,
  requireGap,
  type ArenaFlowDeps,
  type ArenaPlaneRecord,
  type ArenaProjectionRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";

/**
 * Publishes a ToolGap projection for a TOOL_GAP record. Refusals: typed
 * YOU_GAP_PROJECTION_INVALID (category/shape gates); typed
 * YOU_INVALID_STATE for an unknown gap. Emits gap-projection-published.
 */
export function publishToolGapProjectionOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  gapId: OpaqueId,
  input: ToolGapProjectionInput,
): ArenaServiceResult<{ readonly projectionId: OpaqueId; readonly projection: ToolGapProjection }> {
  const found = requireGap(plane, gapId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const projected = projectToolGap(found.gap, input);
  if (!projected.ok) {
    return arenaFailure("YOU_GAP_PROJECTION_INVALID", `gap projection refused: ${projected.refusal.detail}`, {
      reason: projected.refusal.reason,
      gapId,
    });
  }
  return recordProjection(plane, deps, projected.projection, "tool-gap");
}

/**
 * Publishes a KnowledgeGap projection for a KNOWLEDGE_GAP record.
 * Refusals and emission as above.
 */
export function publishKnowledgeGapProjectionOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  gapId: OpaqueId,
  input: KnowledgeGapProjectionInput,
): ArenaServiceResult<{ readonly projectionId: OpaqueId; readonly projection: KnowledgeGapProjection }> {
  const found = requireGap(plane, gapId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const projected = projectKnowledgeGap(found.gap, input);
  if (!projected.ok) {
    return arenaFailure("YOU_GAP_PROJECTION_INVALID", `gap projection refused: ${projected.refusal.detail}`, {
      reason: projected.refusal.reason,
      gapId,
    });
  }
  return recordProjection(plane, deps, projected.projection, "knowledge-gap");
}

/** Records and emits one published projection (the shared tail of both flows). */
function recordProjection<P extends ToolGapProjection | KnowledgeGapProjection>(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  projection: P,
  kind: "tool-gap" | "knowledge-gap",
): ArenaServiceResult<{ readonly projectionId: OpaqueId; readonly projection: P }> {
  const record: ArenaProjectionRecord = deepFreeze({
    id: deps.ids.next("gap-projection"),
    projection,
    kind,
  });
  plane.projections.set(record.id, record);
  appendGapProjectionPublished(plane, record);
  return { ok: true, value: { projectionId: record.id, projection } };
}
