// YOU Solution service — CapabilityGap recording and mock Arena escalation
// flow (docs/you/ARCHITECTURE.md §10/§15, ARENA.md). Arena never silently
// mutates YOU state: the typed expert result returns as ChangeSet
// operations applied through YOU's own versioning authority.

import type { OpaqueId } from "@zcode/shared";
import {
  arenaResultToOperations,
  deliverFixtureExpertResult,
  markArenaResultApplied,
  recordCapabilityGap,
  requestArenaEscalation,
} from "../../../shared/src/you/gap.js";
import { proposeAndAccept } from "./solutionLedgerOps.js";
import type {
  ArenaOutcome,
  GapIntakeInput,
  SolutionRecord,
  SolutionServiceDeps,
  SolutionServiceResult,
} from "./solutionServiceTypes.js";
import { failure } from "./solutionServiceTypes.js";

/** Records a deliberate fixture CapabilityGap (explicitly simulated). */
export function recordFixtureCapabilityGapOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  input: GapIntakeInput,
): SolutionServiceResult<{ readonly gap: import("@zcode/shared").CapabilityGap }> {
  const gap = recordCapabilityGap(
    {
      intentRef: record.intent.id,
      attemptedStrategies: input.attemptedStrategies,
      failureEvidence: input.failureEvidence,
      category: input.category,
      confidence: input.confidence,
      suggestedNextAction: input.suggestedNextAction ?? "escalate-to-arena",
    },
    deps,
  );
  record.gaps.set(gap.id, gap);
  record.ledger.append({
    type: "capability-gap-detected",
    subjectRef: gap.id,
    generator: "fixture",
    payload: {
      capabilityGapId: gap.id,
      category: gap.category,
      confidence: gap.confidence,
      escalationEligibility: gap.escalationEligibility,
      simulated: true,
    },
  });
  record.runtime.notify({ type: "capability_gap_detected", capabilityGapId: gap.id });
  return { ok: true, value: { gap } };
}

/** Requests escalation and delivers the deterministic Arena mock result. */
export function escalateGapToArenaMockOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  gapId: OpaqueId,
): SolutionServiceResult<{ readonly gap: import("@zcode/shared").CapabilityGap }> {
  const gap = record.gaps.get(gapId);
  if (gap === undefined) {
    return failure("YOU_INVALID_STATE", "unknown capability gap", { reason: "unknown-gap", gapId });
  }
  if (gap.escalationEligibility !== "eligible") {
    return failure("YOU_CAPABILITY_GAP", "gap is not escalation-eligible", { reason: "not-eligible", gapId });
  }
  const requested = requestArenaEscalation(gap, deps);
  const delivered = deliverFixtureExpertResult(requested.gap);
  record.gaps.set(gapId, delivered.gap);
  record.ledger.append({
    type: "arena-escalation-requested",
    subjectRef: requested.escalation.escalationId,
    generator: "fixture",
    payload: {
      escalationId: requested.escalation.escalationId,
      capabilityGapId: gapId,
      escalationStatusAfter: "delivered",
      resultType: delivered.result.resultType,
      simulated: true,
    },
  });
  return { ok: true, value: { gap: delivered.gap } };
}

/** Applies the Arena result through YOU's own versioning authority. */
export function applyArenaResultOp(
  record: SolutionRecord,
  gapId: OpaqueId,
): SolutionServiceResult<ArenaOutcome> {
  const gap = record.gaps.get(gapId);
  if (gap === undefined) {
    return failure("YOU_INVALID_STATE", "unknown capability gap", { reason: "unknown-gap", gapId });
  }
  const escalation = gap.arenaEscalationRef;
  if (escalation === null || escalation.expertResult === null) {
    return failure("YOU_CAPABILITY_GAP", "gap has no delivered expert result", { reason: "no-expert-result", gapId });
  }
  const applied = proposeAndAccept(record, {
    baseVersionId: record.chain.current().id,
    operations: arenaResultToOperations(gap, escalation.expertResult),
    intentRef: record.intent.id,
    authorType: "expert",
    changePayload: { actor: "expert", escalationId: escalation.escalationId, simulated: true },
    versionPayload: { actor: "expert", escalationId: escalation.escalationId },
  });
  if (applied === null) {
    return failure("YOU_INVALID_STATE", "arena result changeset was rejected", { reason: "arena-apply-failed", gapId });
  }
  const appliedGap = markArenaResultApplied(gap, applied.changeSet.id);
  record.gaps.set(gapId, appliedGap);
  record.ledger.append({
    type: "arena-result-applied",
    subjectRef: escalation.escalationId,
    generator: "fixture",
    payload: {
      escalationId: escalation.escalationId,
      capabilityGapId: gapId,
      changeSetId: applied.changeSet.id,
      resultingVersionId: applied.version.id,
      simulated: true,
    },
  });
  return { ok: true, value: { gap: appliedGap, version: applied.version, changeSet: applied.changeSet } };
}
