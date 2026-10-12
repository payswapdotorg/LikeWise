// YOU learning signal machinery (W6A — docs/you/CONTRACTS.md "Wave-6
// contract freeze (v6)", frozen LearningSignalKind / LearningSignal).
//
// A learning signal is the raw, append-only input to the learning ladder
// (the learning plane: feedback, manual takeovers, edit sessions, expert
// interventions, repeated intent, capability gaps). Evidence is
// content-addressed on the wave-2 content-store abstraction — evidence
// refs are NEVER inlined content, and never evidence bytes.
//
// Validation is STATELESS (docs/you/WORK_ORDERS.md W6A: "stateless
// validators, no clock") and covers:
//   - kind must be one of the six frozen LearningSignalKind literals;
//   - scope must be one of the eight frozen v1 LearningScope literals
//     (UPPERCASE — the v6 taxonomy reuses the v1 union verbatim);
//   - subjectRef is null or a non-empty opaque id;
//   - evidenceRefs: at least one, each a non-empty content-addressed ref
//     on the wave-2 store abstraction (no surrounding whitespace, no
//     duplicates).
// Every refusal is a typed LearningSignalRefusal; the learning
// application service maps it to the frozen YOU_LEARNING_SIGNAL_INVALID
// error code.
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: timestamps come
// from the injected clock; ids are opaque and RNG-derived in fixture
// mode; fixture signals stay `simulated: true` (truth law).

import type { LearningSignal, LearningSignalKind, LearningScope, OpaqueId } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";
import { isLearningScopeLiteral, LEARNING_SCOPES } from "./learningScope.js";

/** The six frozen learning-signal kinds (runtime mirror of the contract union). */
export const LEARNING_SIGNAL_KINDS: readonly LearningSignalKind[] = [
  "feedback",
  "manual-takeover",
  "edit-session",
  "expert-intervention",
  "repeated-intent",
  "capability-gap",
];

/** True when the value is one of the six frozen signal kinds. */
export function isLearningSignalKind(value: string): value is LearningSignalKind {
  return (LEARNING_SIGNAL_KINDS as readonly string[]).includes(value);
}

/** Typed signal-intake refusal codes (mapped to YOU_LEARNING_SIGNAL_INVALID by the service). */
export type LearningSignalRefusalCode =
  | "invalid-kind"
  | "invalid-scope"
  | "invalid-subject-ref"
  | "empty-evidence-refs"
  | "invalid-evidence-ref";

export type LearningSignalRefusal =
  | { readonly ok: false; readonly code: "invalid-kind"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-scope"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-subject-ref"; readonly detail: string }
  | { readonly ok: false; readonly code: "empty-evidence-refs"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-evidence-ref"; readonly detail: string; readonly refIndex: number };

/**
 * Stateless structural validation of a signal intake (no clock, no
 * store, no ambient state). Returns ok, or the FIRST typed refusal in a
 * deterministic single pass: kind -> scope -> subjectRef -> evidence
 * refs (shape, then duplicates).
 */
export function validateLearningSignalIntake(input: {
  readonly kind: string;
  readonly scope: string;
  readonly subjectRef: OpaqueId | null;
  readonly evidenceRefs: readonly string[];
}): { readonly ok: true } | LearningSignalRefusal {
  if (!isLearningSignalKind(input.kind)) {
    return {
      ok: false,
      code: "invalid-kind",
      detail: `learning signal kind "${input.kind}" is not one of the six frozen kinds (${LEARNING_SIGNAL_KINDS.join(", ")})`,
    };
  }
  if (!isLearningScopeLiteral(input.scope)) {
    return {
      ok: false,
      code: "invalid-scope",
      detail: `learning signal scope "${input.scope}" is not one of the eight frozen v1 LearningScope literals (${LEARNING_SCOPES.join("/")})`,
    };
  }
  if (input.subjectRef !== null && (typeof input.subjectRef !== "string" || input.subjectRef.length === 0)) {
    return {
      ok: false,
      code: "invalid-subject-ref",
      detail: "a learning signal subjectRef must be null or a non-empty opaque id",
    };
  }
  if (input.evidenceRefs.length === 0) {
    return {
      ok: false,
      code: "empty-evidence-refs",
      detail: "a learning signal requires at least one content-addressed evidence ref",
    };
  }
  const seenRefs = new Set<string>();
  for (let index = 0; index < input.evidenceRefs.length; index += 1) {
    const ref = input.evidenceRefs[index];
    if (ref === undefined) {
      continue;
    }
    if (typeof ref !== "string" || ref.length === 0) {
      return { ok: false, code: "invalid-evidence-ref", detail: `evidence ref ${index}: must be a non-empty string`, refIndex: index };
    }
    if (ref !== ref.trim()) {
      return {
        ok: false,
        code: "invalid-evidence-ref",
        detail: `evidence ref ${index}: must not carry surrounding whitespace`,
        refIndex: index,
      };
    }
    if (seenRefs.has(ref)) {
      return { ok: false, code: "invalid-evidence-ref", detail: `evidence ref ${index}: duplicate evidence ref "${ref}"`, refIndex: index };
    }
    seenRefs.add(ref);
  }
  return { ok: true };
}

export interface LearningSignalIntake {
  readonly kind: LearningSignalKind;
  readonly scope: LearningScope;
  readonly subjectRef: OpaqueId | null;
  readonly evidenceRefs: readonly string[];
  /** Truth law: fixture signals stay `simulated: true`. */
  readonly simulated: boolean;
}

/**
 * Constructs the immutable, deep-frozen LearningSignal (append-only; the
 * raw input to the learning ladder). Structural validation is stateless
 * (no clock); the capturedAt timestamp comes from the injected clock.
 */
export function createLearningSignal(
  intake: LearningSignalIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly signal: LearningSignal } | LearningSignalRefusal {
  const validated = validateLearningSignalIntake(intake);
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    signal: deepFreeze({
      id: deps.ids.next("learning-signal"),
      kind: intake.kind,
      scope: intake.scope,
      subjectRef: intake.subjectRef,
      evidenceRefs: Object.freeze([...intake.evidenceRefs]),
      capturedAt: deps.clock.now(),
      simulated: intake.simulated === true,
    }),
  };
}
