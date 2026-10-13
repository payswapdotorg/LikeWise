// YOU arena service — the ArenaRun ladder flow (W8A): policy-gated run
// starts (attempt bounds + eligibility category gates, typed
// YOU_RETRY_POLICY_INVALID) and immutable terminal transitions
// (started -> completed | failed | aborted, terminals locked). Every
// transition appends arena-run-recorded; the run record is replaced
// immutably, never mutated (the W7A AvatarSession replacement
// precedent); the per-gap run list is append-only.

import type { ArenaRun, ArenaRunStatus, OpaqueId } from "@zcode/shared";
import {
  applyArenaRunTerminal,
  arenaRunTransitionRefusal,
  constructArenaRun,
  validateArenaRunInput,
} from "../../../shared/src/you/arenaRunLadder.js";
import { evaluateArenaRetryGate } from "../../../shared/src/you/arenaRetryPolicy.js";
import { appendArenaRunRecorded } from "./arenaLedgerOps.js";
import {
  activePolicyOf,
  arenaFailure,
  requireGap,
  requireRun,
  type ArenaFlowDeps,
  type ArenaPlaneRecord,
  type ArenaServiceResult,
} from "./arenaServiceTypes.js";

/**
 * Starts the next automation attempt for a gap (attempt = existing runs
 * + 1). Gates: the active policy's eligibility category and attempt
 * bounds (typed YOU_RETRY_POLICY_INVALID with the gate's reason —
 * including "no-active-policy" when no policy is registered); intake
 * shape (typed YOU_INVALID_STATE). Emits arena-run-recorded
 * (statusAfter "started").
 */
export function startArenaRunOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  gapId: OpaqueId,
  input: { readonly strategy: string },
): ArenaServiceResult<{ readonly run: ArenaRun }> {
  const foundGap = requireGap(plane, gapId);
  if ("error" in foundGap) {
    return { ok: false, error: foundGap.error };
  }
  const policy = activePolicyOf(plane);
  if (policy === null) {
    return arenaFailure("YOU_RETRY_POLICY_INVALID", "no active retry policy registered", {
      reason: "no-active-policy",
    });
  }
  const attempt = (plane.runsByGap.get(gapId) ?? []).length + 1;
  const gate = evaluateArenaRetryGate(policy, attempt, foundGap.gap.category);
  if (!gate.allowed) {
    return arenaFailure("YOU_RETRY_POLICY_INVALID", `arena run refused by the retry policy: ${gate.reason}`, {
      reason: gate.reason,
      gapId,
      attempt,
    });
  }
  const intake = { gapId, strategy: input.strategy, attempt };
  const refusal = validateArenaRunInput(intake);
  if (refusal !== null) {
    return arenaFailure("YOU_INVALID_STATE", `arena run intake refused: ${refusal.detail}`, {
      reason: "invalid-run-intake",
      refusal: refusal.reason,
    });
  }
  const run = constructArenaRun(intake, { now: () => deps.clock.now(), nextId: deps.ids.next });
  plane.runs.set(run.id, run);
  const ladder = plane.runsByGap.get(gapId) ?? [];
  ladder.push(run.id);
  plane.runsByGap.set(gapId, ladder);
  appendArenaRunRecorded(plane, run, "");
  return { ok: true, value: { run } };
}

/**
 * Applies a terminal transition to a started run (immutable record
 * replacement). Emits arena-run-recorded. Refusals: typed
 * YOU_ARENA_RUN_NOT_FOUND for unknown runs; typed YOU_INVALID_STATE
 * with the ladder's stable reason for locked terminals and no-ops.
 */
export function terminalArenaRunOp(
  plane: ArenaPlaneRecord,
  deps: ArenaFlowDeps,
  runId: OpaqueId,
  to: ArenaRunStatus,
  outcomeEvidenceRef: OpaqueId | null,
): ArenaServiceResult<{ readonly run: ArenaRun }> {
  const found = requireRun(plane, runId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const current = found.run;
  const refusal = arenaRunTransitionRefusal(current.status, to);
  if (refusal !== null) {
    return arenaFailure("YOU_INVALID_STATE", `arena run transition ${current.status} -> ${to} refused: ${refusal}`, {
      reason: refusal,
      runId,
      status: current.status,
    });
  }
  const after = applyArenaRunTerminal(current, to, outcomeEvidenceRef, deps.clock.now());
  plane.runs.set(runId, after);
  appendArenaRunRecorded(plane, after, current.status);
  return { ok: true, value: { run: after } };
}
