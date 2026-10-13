// YOU arena service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W7A precedent
// (solutionLedgerOps.ts / embodimentLedgerOps.ts): per-record status
// facts ride along in event payloads because the frozen
// SolutionEventType set has no per-record status events — the v1
// arena-escalation-requested event is the escalation status carrier
// (request / in-progress start / delivery; the v1 solutionEscalationFlow
// emitted it with escalationStatusAfter "delivered"), authorization
// lifecycle facts ride on escalation-authorized / escalation-cancelled
// / learning-permission-recorded, and run-ladder heads ride on
// arena-run-recorded. Payload conventions are folded by
// shared/src/you/arenaLedger.ts replayArenaLedger.
//
// Truth law: every payload carries simulated: true in fixture mode.

import type {
  ArenaLearningPermission,
  ArenaRun,
  CapabilityGap,
  EscalationAuthorization,
  KnowledgeGapProjection,
  OpaqueId,
  ToolGapProjection,
} from "@zcode/shared";
import type { ArenaPlaneRecord, ArenaProjectionRecord } from "./arenaServiceTypes.js";

/** Appends capability-gap-detected with the full v1 linkage facts. */
export function appendCapabilityGapDetected(plane: ArenaPlaneRecord, gap: CapabilityGap): void {
  const payload: Record<string, string | number | boolean> = {
    capabilityGapId: gap.id,
    category: gap.category,
    confidence: gap.confidence,
    escalationEligibility: gap.escalationEligibility,
    intentRef: gap.intentRef ?? "",
    suggestedNextAction: gap.suggestedNextAction,
    strategyCount: gap.attemptedStrategies.length,
    failureEvidenceCount: gap.failureEvidence.length,
    simulated: true,
  };
  gap.attemptedStrategies.forEach((strategy, index) => {
    payload[`strategy.${index}`] = strategy.strategy;
    payload[`strategyOutcome.${index}`] = strategy.outcome;
  });
  gap.failureEvidence.forEach((evidenceRef, index) => {
    payload[`failureEvidenceRef.${index}`] = evidenceRef;
  });
  plane.ledger.append({
    type: "capability-gap-detected",
    subjectRef: gap.id,
    generator: "agent",
    payload,
  });
}

/** Appends arena-run-recorded for a run-ladder head (initial or terminal). */
export function appendArenaRunRecorded(
  plane: ArenaPlaneRecord,
  run: ArenaRun,
  statusBefore: string,
): void {
  plane.ledger.append({
    type: "arena-run-recorded",
    subjectRef: run.id,
    generator: "agent",
    payload: {
      runId: run.id,
      gapId: run.gapId,
      strategy: run.strategy,
      attempt: run.attempt,
      statusBefore,
      statusAfter: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? "",
      outcomeEvidenceRef: run.outcomeEvidenceRef ?? "",
      simulated: true,
    },
  });
}

/** The escalation status carrier (v1 event, W1A ride-along precedent). */
export function appendEscalationStatus(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  gapId: OpaqueId,
  escalationStatusBefore: string,
  escalationStatusAfter: string,
  extra: Record<string, string | number | boolean> = {},
): void {
  plane.ledger.append({
    type: "arena-escalation-requested",
    subjectRef: escalationId,
    generator: "agent",
    payload: {
      escalationId,
      capabilityGapId: gapId,
      escalationStatusBefore,
      escalationStatusAfter,
      authorizationId: "",
      reason: "",
      providerId: "",
      resultType: "",
      contentRef: "",
      contentHash: "",
      deliveredAt: "",
      simulated: true,
      ...extra,
    },
  });
}

/** Appends escalation-authorized for a granted authorization (the chain root). */
export function appendEscalationAuthorized(
  plane: ArenaPlaneRecord,
  gap: CapabilityGap,
  authorization: EscalationAuthorization,
  escalationStatusAfter: string,
): void {
  plane.ledger.append({
    type: "escalation-authorized",
    subjectRef: authorization.id,
    generator: "user",
    payload: {
      authorizationId: authorization.id,
      escalationId: authorization.escalationId,
      capabilityGapId: gap.id,
      authorizedBy: authorization.authorizedBy,
      scope: authorization.scope,
      grantedAt: authorization.grantedAt,
      expiresAt: authorization.expiresAt ?? "",
      learningPermission: authorization.learningPermission,
      authorizationStatusAfter: "active",
      escalationStatusAfter,
      simulated: true,
    },
  });
}

/** Appends learning-permission-recorded (grant-time recording or a permission change). */
export function appendLearningPermissionRecorded(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  authorizationId: OpaqueId,
  permission: ArenaLearningPermission,
  recordedAt: string,
  supersededAuthorizationId: OpaqueId | null,
): void {
  plane.ledger.append({
    type: "learning-permission-recorded",
    subjectRef: authorizationId,
    generator: "user",
    payload: {
      authorizationId,
      escalationId,
      learningPermission: permission,
      supersededAuthorizationId: supersededAuthorizationId ?? "",
      recordedAt,
      simulated: true,
    },
  });
}

/** Appends escalation-cancelled for authorization withdrawal or expiry materialization. */
export function appendEscalationCancelled(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  gapId: OpaqueId,
  authorizationId: OpaqueId | null,
  authorizationStatusAfter: "withdrawn" | "expired",
  escalationStatusAfter: string,
  reason: string,
  cancelledAt: string,
): void {
  plane.ledger.append({
    type: "escalation-cancelled",
    subjectRef: escalationId,
    generator: "user",
    payload: {
      escalationId,
      capabilityGapId: gapId,
      authorizationId: authorizationId ?? "",
      authorizationStatusAfter,
      escalationStatusAfter,
      reason,
      cancelledAt,
      simulated: true,
    },
  });
}

/** Appends arena-result-applied for application or rejection of a delivered result. */
export function appendArenaResultProcessed(
  plane: ArenaPlaneRecord,
  escalationId: OpaqueId,
  gapId: OpaqueId,
  escalationStatusAfter: "applied" | "rejected",
  changeSetId: OpaqueId | null,
  reason: string,
): void {
  plane.ledger.append({
    type: "arena-result-applied",
    subjectRef: escalationId,
    generator: "user",
    payload: {
      escalationId,
      capabilityGapId: gapId,
      changeSetId: changeSetId ?? "",
      escalationStatusAfter,
      reason,
      simulated: true,
    },
  });
}

/** Appends gap-projection-published for a published ToolGap/KnowledgeGap projection. */
export function appendGapProjectionPublished(plane: ArenaPlaneRecord, record: ArenaProjectionRecord): void {
  const payload: Record<string, string | number | boolean> = {
    projectionId: record.id,
    gapId: record.projection.gapId,
    projectionKind: record.kind,
    simulated: true,
  };
  const projection = record.projection;
  if (record.kind === "tool-gap") {
    const tool = projection as ToolGapProjection;
    payload["toolId"] = tool.toolId ?? "";
    payload["requiredCapability"] = tool.requiredCapability;
    payload["remediation"] = tool.remediation;
  } else {
    const knowledge = projection as KnowledgeGapProjection;
    payload["domain"] = knowledge.domain;
    payload["missingKnowledgeRef"] = knowledge.missingKnowledgeRef ?? "";
    payload["remediation"] = knowledge.remediation;
  }
  plane.ledger.append({
    type: "gap-projection-published",
    subjectRef: record.id,
    generator: "agent",
    payload,
  });
}
