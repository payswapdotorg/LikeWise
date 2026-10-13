// YOU arena service — live plane projection builder.
//
// Builds the authoritative ArenaPlaneProjection from the service's live
// state in EXACTLY the shape replayArenaLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in
// tests via stableStringify; any drift between this builder and the
// fold is a bug.
//
// The builder reads the live records (gaps / runs / chains / deliveries
// / projections) and applies the SAME projection rules as the fold:
//   - authorization chains: the last entry per authorization id wins;
//     a later grant supersedes every earlier still-active grant of the
//     same escalation (supersededById points at the successor);
//   - escalation heads: the gap's immutable arenaEscalationRef status
//     plus the recorded delivery binding and the chain head id;
//   - learning permissions: the latest recording per escalation (grant
//     time or permission change — never restamped by expiry/withdrawal).
//
// Retry policies are SERVICE STATE (the W6A candidate-record precedent:
// the frozen wave-8 event set has no policy event) and therefore do
// not appear in the projection; provider descriptors likewise
// materialize only through delivery facts.

import type { OpaqueId } from "@zcode/shared";
import type {
  ArenaLedgerAuthorizationEntry,
  ArenaLedgerEscalationEntry,
  ArenaLedgerGapEntry,
  ArenaLedgerPermissionEntry,
  ArenaLedgerProjectionEntry,
  ArenaLedgerRunEntry,
  ArenaPlaneProjection,
} from "../../../shared/src/you/arenaLedger.js";
import type { EscalationAuthorizationEntry } from "../../../shared/src/you/escalationAuthorization.js";
import type { ArenaPlaneRecord } from "./arenaServiceTypes.js";
import { sortedMapKeys } from "./arenaServiceTypes.js";

/** Builds the live arena-plane projection (equal to replayArenaLedger output). */
export function buildArenaPlaneProjection(plane: ArenaPlaneRecord): ArenaPlaneProjection {
  const gaps: Record<string, ArenaLedgerGapEntry> = {};
  const runs: Record<string, ArenaLedgerRunEntry> = {};
  const escalations: Record<string, ArenaLedgerEscalationEntry> = {};
  const authorizations: Record<string, ArenaLedgerAuthorizationEntry> = {};
  const learningPermissions: Record<string, ArenaLedgerPermissionEntry> = {};
  const projections: Record<string, ArenaLedgerProjectionEntry> = {};

  // -- gaps (the v1 linkage facts from the immutable records) ----------------
  for (const gapId of sortedMapKeys(plane.gaps)) {
    const gap = plane.gaps.get(gapId);
    if (gap === undefined) {
      continue;
    }
    gaps[gapId] = {
      category: gap.category,
      confidence: gap.confidence,
      escalationEligibility: gap.escalationEligibility,
      intentRef: gap.intentRef ?? "",
      suggestedNextAction: gap.suggestedNextAction,
      strategies: Object.freeze(
        gap.attemptedStrategies.map((strategy) => ({ strategy: strategy.strategy, outcome: strategy.outcome })),
      ),
      failureEvidenceRefs: Object.freeze([...gap.failureEvidence]),
      simulated: true,
    };
  }

  // -- runs (the ladder heads) ----------------------------------------------
  for (const runId of sortedMapKeys(plane.runs)) {
    const run = plane.runs.get(runId);
    if (run === undefined) {
      continue;
    }
    runs[runId] = {
      gapId: run.gapId,
      strategy: run.strategy,
      attempt: run.attempt,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? "",
      outcomeEvidenceRef: run.outcomeEvidenceRef ?? "",
      simulated: true,
    };
  }

  // -- escalations (gap refs + delivery bindings + chain heads) -------------
  for (const escalationId of sortedMapKeys(plane.escalationGap)) {
    const gapId = plane.escalationGap.get(escalationId);
    if (gapId === undefined) {
      continue;
    }
    const gap = plane.gaps.get(gapId);
    if (gap === undefined) {
      continue;
    }
    const ref = gap.arenaEscalationRef;
    if (ref === null || ref.escalationId !== escalationId) {
      continue;
    }
    const delivery = plane.deliveries.get(escalationId);
    const chain = plane.authorizationChains.get(escalationId);
    const headId = chain !== undefined && chain.length > 0 ? chain[chain.length - 1]?.authorization.id ?? "" : "";
    const resultType = ref.expertResult?.resultType ?? "";
    escalations[escalationId] = {
      gapId,
      status: ref.status,
      providerId: delivery?.providerId ?? "",
      resultType,
      contentRef: delivery?.contentRef ?? "",
      contentHash: delivery?.contentHash ?? "",
      deliveredAt: delivery?.deliveredAt ?? "",
      authorizationId: headId,
      simulated: true,
    };
  }

  // -- authorization chains (the supersession projection) --------------------
  for (const escalationId of sortedMapKeys(plane.authorizationChains)) {
    const chain = plane.authorizationChains.get(escalationId);
    if (chain === undefined || chain.length === 0) {
      continue;
    }
    projectChain(chain, authorizations);
  }

  // -- learning permissions (the latest recording per escalation) ------------
  for (const escalationId of sortedMapKeys(plane.permissionRecordings)) {
    const recording = plane.permissionRecordings.get(escalationId);
    if (recording === undefined) {
      continue;
    }
    learningPermissions[escalationId] = {
      authorizationId: recording.authorizationId,
      learningPermission: recording.learningPermission,
      recordedAt: recording.recordedAt,
    };
  }

  // -- gap projections --------------------------------------------------------
  for (const projectionId of sortedMapKeys(plane.projections)) {
    const record = plane.projections.get(projectionId);
    if (record === undefined) {
      continue;
    }
    const entry: ArenaLedgerProjectionEntry = {
      gapId: record.projection.gapId,
      kind: record.kind,
      toolId: "",
      requiredCapability: "",
      domain: "",
      missingKnowledgeRef: "",
      remediation: "",
      simulated: true,
    };
    if (record.kind === "tool-gap") {
      const tool = record.projection as { readonly toolId: OpaqueId | null; readonly requiredCapability: string; readonly remediation: string };
      projections[projectionId] = {
        ...entry,
        toolId: tool.toolId ?? "",
        requiredCapability: tool.requiredCapability,
        remediation: tool.remediation,
      };
    } else {
      const knowledge = record.projection as { readonly domain: string; readonly missingKnowledgeRef: OpaqueId | null; readonly remediation: string };
      projections[projectionId] = {
        ...entry,
        domain: knowledge.domain,
        missingKnowledgeRef: knowledge.missingKnowledgeRef ?? "",
        remediation: knowledge.remediation,
      };
    }
  }

  return {
    solutionId: plane.solutionId,
    gaps,
    runs,
    escalations,
    authorizations,
    learningPermissions,
    projections,
  };
}

/**
 * Projects one authorization chain into flat entries, mirroring the
 * fold's supersession rules exactly: the LAST entry per authorization
 * id wins; a new grant id supersedes every earlier still-active grant
 * (supersededById = the successor id — the W6A append-only linkage).
 */
function projectChain(
  chain: readonly EscalationAuthorizationEntry[],
  authorizations: Record<string, ArenaLedgerAuthorizationEntry>,
): void {
  /** authorizationId -> flat entry (mutable during the walk, frozen by the caller's read). */
  const byId = new Map<string, ArenaLedgerAuthorizationEntry>();
  const flat = (entry: EscalationAuthorizationEntry): ArenaLedgerAuthorizationEntry => ({
    escalationId: entry.authorization.escalationId,
    authorizedBy: entry.authorization.authorizedBy,
    scope: entry.authorization.scope,
    grantedAt: entry.authorization.grantedAt,
    expiresAt: entry.authorization.expiresAt ?? "",
    learningPermission: entry.authorization.learningPermission,
    status: entry.status,
    reason: entry.reason,
    recordedAt: entry.recordedAt,
    supersededById: "",
    simulated: true,
  });

  for (const entry of chain) {
    const authorizationId = entry.authorization.id;
    if (!byId.has(authorizationId)) {
      // A new grant id appears: supersede every earlier still-active grant.
      for (const [previousId, previous] of byId) {
        if (previous.status === "active") {
          byId.set(previousId, { ...previous, status: "superseded", reason: "superseded-by-successor", supersededById: authorizationId });
        }
      }
    }
    byId.set(authorizationId, flat(entry));
  }
  for (const [authorizationId, entry] of byId) {
    authorizations[authorizationId] = entry;
  }
}
