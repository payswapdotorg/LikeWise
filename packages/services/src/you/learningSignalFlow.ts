// YOU learning service — signal capture flow (W6A — docs/you/
// WORK_ORDERS.md W6A: "learning signal capture: append-only
// LearningSignal records across all six kinds with content-addressed
// evidenceRefs, typed YOU_LEARNING_SIGNAL_INVALID refusals (stateless
// validators, no clock)").
//
// The stateless validator (shared/src/you/learningSignal.ts) owns every
// structural refusal; this flow maps refusals to the frozen
// YOU_LEARNING_SIGNAL_INVALID error code, constructs the immutable
// signal through the shared machinery and appends the
// learning-signal-captured event. Evidence refs are content-addressed
// references into the wave-2 evidence plane — never inlined content.

import type { LearningSignal, LearningSignalKind, LearningScope, OpaqueId } from "@zcode/shared";
import { createLearningSignal } from "../../../shared/src/you/learningSignal.js";
import type { LearningPlaneRecord, LearningServiceDeps, LearningServiceResult } from "./learningServiceTypes.js";
import { learningFailure } from "./learningServiceTypes.js";
import { appendLearningSignalCaptured } from "./learningLedgerOps.js";

export interface CaptureLearningSignalInput {
  readonly kind: LearningSignalKind;
  readonly scope: LearningScope;
  readonly subjectRef?: OpaqueId | null;
  readonly evidenceRefs: readonly string[];
  /** Truth law: fixture signals stay `simulated: true` (default true in the fixture-only phase 0). */
  readonly simulated?: boolean;
}

/** Captures one learning signal (append-only; typed refusals, no state changes on refusal). */
export function captureLearningSignalOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  input: CaptureLearningSignalInput,
): LearningServiceResult<{ readonly signal: LearningSignal }> {
  const created = createLearningSignal(
    {
      kind: input.kind,
      scope: input.scope,
      subjectRef: input.subjectRef ?? null,
      evidenceRefs: [...input.evidenceRefs],
      simulated: input.simulated ?? true,
    },
    deps,
  );
  if (!created.ok) {
    return learningFailure("YOU_LEARNING_SIGNAL_INVALID", `invalid learning signal: ${created.detail}`, {
      reason: created.code,
      detail: created.detail,
      ...(created.code === "invalid-evidence-ref" ? { refIndex: created.refIndex } : {}),
    });
  }
  plane.signals.set(created.signal.id, created.signal);
  plane.signalIds.push(created.signal.id);
  appendLearningSignalCaptured(plane, created.signal);
  return { ok: true, value: { signal: created.signal } };
}
