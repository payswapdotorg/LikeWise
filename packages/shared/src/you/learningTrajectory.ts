// YOU learning trajectory machinery (W6A — docs/you/CONTRACTS.md
// "Wave-6 contract freeze (v6)", frozen TrajectoryReference).
//
// A trajectory reference is the replay substrate for teach-me /
// learn-this flows: an ORDERED list of content-addressed step refs on
// the wave-2 content-store abstraction. Step content is NEVER inlined —
// stepRefs only. Replay resolves each ref in order, verifies the
// content addressing (the ref must equal the store's content-addressed
// ref for the stored bytes) and concatenates the step bytes: the same
// seed produces byte-identical replays on every run and platform
// (FIXTURES.md law 2).
//
// Validation is STATELESS (no clock, no store): at least one step ref,
// each a non-empty content-addressed ref without surrounding whitespace
// (duplicates are legal — an ordered trajectory may legitimately repeat
// a step). Replay failure is typed: a dangling ref and a content
// mismatch are DIFFERENT refusals, never silent repairs.
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: fixture step
// bytes are synthesized only from an injected DeterministicRng; the
// same seed produces byte-identical content.

import type { LearningScope, OpaqueId, TrajectoryReference } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { EvidenceContentStore } from "./evidenceStore.js";
import type { YouIdFactory } from "./ids.js";
import type { YouRng } from "./rng.js";
import { deepFreeze } from "./serialize.js";
import { isLearningScopeLiteral } from "./learningScope.js";
import { EVIDENCE_CONTENT_REF_PREFIX, sha256Hex } from "./evidenceStore.js";

/** Fixed synthetic trajectory-step size (fixture definition). */
export const FIXTURE_TRAJECTORY_STEP_BYTE_LENGTH = 256;

/**
 * Deterministic synthetic trajectory-step bytes (FIXTURES.md laws 1-2:
 * seed-derived only). The RNG consumption order (4 bytes per
 * nextUint32, little-endian — the wave-2 fixture convention) is part of
 * the frozen fixture definition.
 */
export function synthesizeFixtureTrajectoryStepBytes(rng: YouRng, length: number = FIXTURE_TRAJECTORY_STEP_BYTE_LENGTH): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += 4) {
    const word = rng.nextUint32();
    const remaining = Math.min(4, length - offset);
    for (let byteIndex = 0; byteIndex < remaining; byteIndex += 1) {
      bytes[offset + byteIndex] = (word >>> (byteIndex * 8)) & 0xff;
    }
  }
  return bytes;
}

/** Typed trajectory refusal codes. */
export type TrajectoryRefusalCode = "invalid-scope" | "empty-step-refs" | "invalid-step-ref";

export type TrajectoryRefusal =
  | { readonly ok: false; readonly code: "invalid-scope"; readonly detail: string }
  | { readonly ok: false; readonly code: "empty-step-refs"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-step-ref"; readonly detail: string; readonly refIndex: number };

/** Typed replay refusal codes (resolution vs content addressing). */
export type TrajectoryReplayRefusalCode = "step-ref-unresolved" | "step-content-mismatch";

export type TrajectoryReplayRefusal =
  | { readonly ok: false; readonly code: "step-ref-unresolved"; readonly detail: string; readonly refIndex: number }
  | { readonly ok: false; readonly code: "step-content-mismatch"; readonly detail: string; readonly refIndex: number };

/**
 * Stateless structural validation of an ordered step-ref list (no clock,
 * no store, no ambient state). Duplicates are legal (ordered replay may
 * repeat a step); empty lists and malformed refs are typed refusals.
 */
export function validateTrajectoryStepRefs(stepRefs: readonly string[]): { readonly ok: true } | TrajectoryRefusal {
  if (stepRefs.length === 0) {
    return { ok: false, code: "empty-step-refs", detail: "a trajectory reference requires at least one ordered step ref" };
  }
  for (let index = 0; index < stepRefs.length; index += 1) {
    const ref = stepRefs[index];
    if (ref === undefined) {
      continue;
    }
    if (typeof ref !== "string" || ref.length === 0) {
      return { ok: false, code: "invalid-step-ref", detail: `step ref ${index}: must be a non-empty string`, refIndex: index };
    }
    if (ref !== ref.trim()) {
      return {
        ok: false,
        code: "invalid-step-ref",
        detail: `step ref ${index}: must not carry surrounding whitespace`,
        refIndex: index,
      };
    }
  }
  return { ok: true };
}

export interface TrajectoryReferenceIntake {
  readonly scope: LearningScope;
  readonly stepRefs: readonly string[];
  /** Truth law: fixture trajectories stay `simulated: true`. */
  readonly simulated: boolean;
}

/** Validates a full trajectory intake (scope + ordered step refs), statelessly. */
export function validateTrajectoryReferenceIntake(
  intake: TrajectoryReferenceIntake,
): { readonly ok: true } | TrajectoryRefusal {
  if (!isLearningScopeLiteral(intake.scope)) {
    return {
      ok: false,
      code: "invalid-scope",
      detail: `trajectory scope "${String(intake.scope)}" is not one of the eight frozen v1 LearningScope literals`,
    };
  }
  return validateTrajectoryStepRefs(intake.stepRefs);
}

/**
 * Constructs the immutable, deep-frozen TrajectoryReference. The
 * content-addressed step refs are stored content — this constructor
 * never stores bytes itself (the caller synthesizes/stores steps
 * through the wave-2 content store first).
 */
export function createTrajectoryReference(
  intake: TrajectoryReferenceIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly trajectory: TrajectoryReference } | TrajectoryRefusal {
  const validated = validateTrajectoryReferenceIntake(intake);
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    trajectory: deepFreeze({
      id: deps.ids.next("learning-trajectory"),
      scope: intake.scope,
      stepRefs: Object.freeze([...intake.stepRefs]),
      createdAt: deps.clock.now(),
      simulated: intake.simulated === true,
    }),
  };
}

export interface TrajectoryReplay {
  /** The concatenated step bytes, in trajectory order. */
  readonly bytes: Uint8Array;
  /** sha-256 over the replay bytes (the golden replay hash). */
  readonly replayHash: string;
  readonly stepCount: number;
}

/**
 * Replays a trajectory reference through the content store: resolves
 * each step ref IN ORDER, verifies the content addressing (the stored
 * bytes must hash to the ref's content address — a mismatch is a typed
 * refusal, never a silent repair) and concatenates the bytes.
 * Deterministic: same trajectory + same stored content => byte-identical
 * replay (FIXTURES.md law 2).
 */
export function replayTrajectoryReference(
  trajectory: TrajectoryReference,
  store: EvidenceContentStore,
): { readonly ok: true; readonly replay: TrajectoryReplay } | TrajectoryReplayRefusal {
  const stepBytes: Uint8Array[] = [];
  for (let index = 0; index < trajectory.stepRefs.length; index += 1) {
    const ref = trajectory.stepRefs[index];
    if (ref === undefined) {
      continue;
    }
    const stored = store.get(ref);
    if (stored === null) {
      return {
        ok: false,
        code: "step-ref-unresolved",
        detail: `trajectory step ref ${index} ("${ref}") does not resolve in the content store`,
        refIndex: index,
      };
    }
    if (contentAddressForHash(sha256Hex(stored)) !== ref) {
      return {
        ok: false,
        code: "step-content-mismatch",
        detail: `trajectory step ref ${index} ("${ref}") does not match the stored bytes' content address`,
        refIndex: index,
      };
    }
    stepBytes.push(stored);
  }
  const bytes = concatBytes(stepBytes);
  return {
    ok: true,
    replay: {
      bytes,
      replayHash: sha256Hex(bytes),
      stepCount: trajectory.stepRefs.length,
    },
  };
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return joined;
}

/** The wave-2 fixture content-ref format for a sha-256 hex hash. */
function contentAddressForHash(contentHash: string): string {
  return `${EVIDENCE_CONTENT_REF_PREFIX}_${contentHash.slice(0, 16)}`;
}

/** The content-addressed ref a trajectory step's bytes map to (store convention). */
export function trajectoryStepRefFor(bytes: Uint8Array): OpaqueId {
  return contentAddressForHash(sha256Hex(bytes));
}
