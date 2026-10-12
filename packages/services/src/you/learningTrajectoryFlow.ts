// YOU learning service — trajectory flow (W6A — docs/you/
// WORK_ORDERS.md W6A: "trajectory references: content-addressed
// ordered stepRefs, byte-identical replay from seed").
//
// Steps are synthesized deterministically from seed text (FIXTURES.md
// laws 1-2: injected rng only, no ambient nondeterminism), stored
// through the wave-2 content store and referenced by their
// content-addressed refs — step content is never inlined. The
// trajectory registry is append-only SERVICE STATE (the frozen wave-6
// event set defines no trajectory event — the W4A template-library /
// W5A subject-registry precedent; they stay out of the replayable
// projection). Replay resolves each ref in order, verifies the content
// addressing and concatenates — byte-identical for a fixed seed.

import type { OpaqueId, TrajectoryReference, YouError } from "@zcode/shared";
import { createTrajectoryReference, replayTrajectoryReference, synthesizeFixtureTrajectoryStepBytes } from "../../../shared/src/you/learningTrajectory.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import type { LearningPlaneRecord, LearningServiceDeps, LearningServiceResult } from "./learningServiceTypes.js";
import { learningFailure } from "./learningServiceTypes.js";

/** Content deps bundle for flows that synthesize content-addressed steps. */
export interface TrajectoryContentDeps extends LearningServiceDeps {
  readonly store: EvidenceContentStore;
}

/**
 * Deterministically synthesizes ordered trajectory steps (fixture
 * mode): one step per index in the GIVEN order, bytes derived from the
 * seed text, stored through the content store (content-addressed
 * stepRefs).
 */
export function synthesizeTrajectoryStepsOp(
  deps: TrajectoryContentDeps,
  input: { readonly seedText: string; readonly stepCount: number },
): LearningServiceResult<{ readonly stepRefs: readonly string[] }> {
  if (input.seedText.length === 0) {
    return learningFailure("YOU_INVALID_STATE", "trajectory step synthesis requires a non-empty seedText", {
      reason: "empty-seed-text",
    });
  }
  if (!Number.isInteger(input.stepCount) || input.stepCount < 1) {
    return learningFailure("YOU_INVALID_STATE", "trajectory step synthesis requires a positive integer stepCount", {
      reason: "invalid-step-count",
      stepCount: input.stepCount,
    });
  }
  const stepRefs: string[] = [];
  for (let index = 0; index < input.stepCount; index += 1) {
    const bytes = synthesizeFixtureTrajectoryStepBytes(createDeterministicRng(seedFromString(`${input.seedText}:${index}`)));
    stepRefs.push(deps.store.put(bytes).contentRef);
  }
  return { ok: true, value: { stepRefs: Object.freeze(stepRefs) } };
}

/** Records a trajectory reference over content-addressed ordered step refs (append-only registry). */
export function recordTrajectoryOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  input: { readonly scope: TrajectoryReference["scope"]; readonly stepRefs: readonly string[]; readonly simulated?: boolean },
): LearningServiceResult<{ readonly trajectory: TrajectoryReference }> {
  const created = createTrajectoryReference(
    { scope: input.scope, stepRefs: [...input.stepRefs], simulated: input.simulated ?? true },
    deps,
  );
  if (!created.ok) {
    return learningFailure("YOU_INVALID_STATE", `invalid trajectory reference: ${created.detail}`, {
      reason: created.code,
      detail: created.detail,
      ...(created.code === "invalid-step-ref" ? { refIndex: created.refIndex } : {}),
    });
  }
  plane.trajectories.set(created.trajectory.id, created.trajectory);
  plane.trajectoryIds.push(created.trajectory.id);
  return { ok: true, value: { trajectory: created.trajectory } };
}

/** The trajectory lookup helper (typed YOU_INVALID_STATE on unknown ids). */
export function requireTrajectory(
  plane: LearningPlaneRecord,
  trajectoryId: OpaqueId,
): { readonly trajectory: TrajectoryReference } | { readonly error: YouError } {
  const trajectory = plane.trajectories.get(trajectoryId);
  if (trajectory === undefined) {
    return {
      error: {
        code: "YOU_INVALID_STATE",
        message: "unknown trajectory reference",
        details: { reason: "unknown-trajectory", trajectoryId },
        simulated: true,
      },
    };
  }
  return { trajectory };
}

/**
 * Replays a recorded trajectory: resolves each ordered step ref through
 * the content store, verifies the content addressing (typed refusals —
 * never a silent repair) and concatenates the bytes. Byte-identical
 * for a fixed seed (FIXTURES.md law 2).
 */
export function replayTrajectoryOp(
  plane: LearningPlaneRecord,
  store: EvidenceContentStore,
  trajectoryId: OpaqueId,
): LearningServiceResult<{ readonly trajectory: TrajectoryReference; readonly bytes: Uint8Array; readonly replayHash: string; readonly stepCount: number }> {
  const found = requireTrajectory(plane, trajectoryId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const replayed = replayTrajectoryReference(found.trajectory, store);
  if (!replayed.ok) {
    return learningFailure(
      replayed.code === "step-content-mismatch" ? "YOU_CONTENT_HASH_MISMATCH" : "YOU_INVALID_STATE",
      `trajectory replay failed: ${replayed.detail}`,
      {
        reason: replayed.code,
        detail: replayed.detail,
        trajectoryId,
        refIndex: replayed.refIndex,
      },
    );
  }
  return {
    ok: true,
    value: {
      trajectory: found.trajectory,
      bytes: replayed.replay.bytes,
      replayHash: replayed.replay.replayHash,
      stepCount: replayed.replay.stepCount,
    },
  };
}
