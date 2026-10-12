// YOU learning record machinery (W6A — docs/you/CONTRACTS.md "Wave-6
// contract freeze (v6)", frozen LearningRecord / LearningRecordStatus).
//
// The validation ladder:
//   candidate -> validated | rejected
//   validated -> superseded (via supersededById linkage)
//   rejected / superseded are terminal.
// Supersession is append-only LINKAGE, never in-place mutation: the
// superseded record is replaced by a NEW deep-frozen record under the
// SAME id (content identical, only the status + supersededById moved) —
// the W4A artifact-review / W5A editing-session immutable-replacement
// discipline, journaled append-only in the event ledger by the service.
//
// `validatedAt` carries the record's ladder timestamp: the candidate
// creation moment while "candidate", the validation moment once
// "validated", the rejection moment once "rejected". Supersession
// moves ONLY the status + supersededById linkage — a superseded record
// keeps its validation moment (deterministic, injected clock; the
// ledger fold reconstructs it from the record's own validation event).
//
// Structural validation is STATELESS (no clock): signal id non-empty,
// scope a frozen v1 literal, content binding paired (contentRef +
// sha-256 contentHash on the wave-2 content-store abstraction), rights
// structurally valid (learningRights.ts). Every refusal is typed; the
// learning application service maps them to the frozen error codes.
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: fixture records
// stay `simulated: true` (truth law).

import type { LearningRecord, LearningRecordStatus, LearningScope, OpaqueId } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";
import { isLearningScopeLiteral } from "./learningScope.js";
import { isSha256Hex } from "./performanceTimeline.js";
import { validateLearningRightsIntake } from "./learningRights.js";

/** Legal learning-record status transitions (the validation ladder). */
export const LEARNING_RECORD_TRANSITIONS: Readonly<Record<LearningRecordStatus, readonly LearningRecordStatus[]>> = {
  candidate: ["validated", "rejected"],
  validated: ["superseded"],
  rejected: [],
  superseded: [],
};

export function isLegalLearningRecordTransition(from: LearningRecordStatus, to: LearningRecordStatus): boolean {
  return LEARNING_RECORD_TRANSITIONS[from].includes(to);
}

export function isTerminalLearningRecordStatus(status: LearningRecordStatus): boolean {
  return LEARNING_RECORD_TRANSITIONS[status].length === 0;
}

/** Typed record-intake refusal codes (mapped by the service). */
export type LearningRecordRefusalCode =
  | "invalid-signal-id"
  | "invalid-scope"
  | "invalid-content-binding"
  | "invalid-rights";

export type LearningRecordRefusal =
  | { readonly ok: false; readonly code: "invalid-signal-id"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-scope"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-content-binding"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-rights"; readonly detail: string };

export interface LearningRecordIntake {
  readonly signalId: OpaqueId;
  readonly scope: LearningScope;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly rights: LearningRecord["rights"];
  /** Truth law: fixture records stay `simulated: true`. */
  readonly simulated: boolean;
}

/**
 * Stateless structural validation of a candidate intake (no clock, no
 * store, no ambient state): signal id -> scope -> content binding ->
 * rights shape.
 */
export function validateLearningRecordIntake(intake: LearningRecordIntake): { readonly ok: true } | LearningRecordRefusal {
  if (typeof intake.signalId !== "string" || intake.signalId.length === 0) {
    return { ok: false, code: "invalid-signal-id", detail: "a learning record requires a non-empty signalId" };
  }
  if (!isLearningScopeLiteral(intake.scope)) {
    return {
      ok: false,
      code: "invalid-scope",
      detail: `learning record scope "${String(intake.scope)}" is not one of the eight frozen v1 LearningScope literals`,
    };
  }
  if (typeof intake.contentRef !== "string" || intake.contentRef.length === 0) {
    return { ok: false, code: "invalid-content-binding", detail: "a learning record requires a non-empty contentRef" };
  }
  if (!isSha256Hex(intake.contentHash)) {
    return {
      ok: false,
      code: "invalid-content-binding",
      detail: "a learning record requires a sha-256 hex contentHash bound to the stored content",
    };
  }
  const rightsReason = validateLearningRightsIntake(intake.rights);
  if (!rightsReason.ok) {
    return { ok: false, code: "invalid-rights", detail: `invalid learning rights: ${rightsReason.detail}` };
  }
  return { ok: true };
}

/**
 * Constructs the immutable, deep-frozen candidate record (status
 * "candidate"; supersededById null). The validatedAt field carries the
 * creation timestamp until the record climbs the ladder.
 */
export function createLearningCandidateRecord(
  intake: LearningRecordIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly record: LearningRecord } | LearningRecordRefusal {
  const validated = validateLearningRecordIntake(intake);
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    record: deepFreeze({
      id: deps.ids.next("learning-record"),
      signalId: intake.signalId,
      status: "candidate",
      scope: intake.scope,
      contentRef: intake.contentRef,
      contentHash: intake.contentHash,
      rights: intake.rights,
      validatedAt: deps.clock.now(),
      supersededById: null,
      simulated: intake.simulated === true,
    }),
  };
}

export interface LearningRecordTransitionInput {
  readonly to: LearningRecordStatus;
  /** Required when transitioning to "superseded" (the successor linkage). */
  readonly supersededById?: OpaqueId;
  /** The ladder timestamp (injected clock reading at the service seam). */
  readonly at: string;
}

/**
 * Returns a NEW deep-frozen record with the ladder transition applied
 * (immutable record replacement; same id, same content, only the status
 * + linkage + ladder timestamp moved). Supersession keeps the record's
 * validation moment (only status + supersededById move). Throws on an
 * illegal transition — the service checks the transition table first
 * and maps it to a typed refusal.
 */
export function transitionLearningRecord(record: LearningRecord, input: LearningRecordTransitionInput): LearningRecord {
  const to = input.to;
  if (!isLegalLearningRecordTransition(record.status, to)) {
    throw new Error(`illegal learning record transition ${record.status} -> ${to}`);
  }
  if (to === "superseded" && (input.supersededById === undefined || input.supersededById.length === 0)) {
    throw new Error("supersession requires the successor record id (supersededById linkage)");
  }
  if (to !== "superseded" && input.supersededById !== undefined) {
    throw new Error("supersededById linkage is only legal on supersession");
  }
  return deepFreeze({
    ...record,
    status: to,
    ...(to === "superseded" ? { supersededById: input.supersededById } : {}),
    ...(to === "superseded" ? {} : { validatedAt: input.at }),
  });
}
