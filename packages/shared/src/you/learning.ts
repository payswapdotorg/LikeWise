// YOU learning candidate derivation (docs/you/ARCHITECTURE.md §12,
// OPERATOR_ACCEPTANCE.md "Learning").
//
// Learning is consent-gated: a LearningCandidate can only be derived
// from a closed EditSession whose learning permission is explicitly
// granted. Without permission nothing is captured — there is no silent
// fallback. Candidates are scoped; a user preference never silently
// becomes a universal rule.
//
// NOTE: LearningCandidate is NOT part of the frozen wave-1 contract set
// (contract.ts). This is the minimal Phase-0 domain type; the TL may
// freeze a richer shape in a later wave (W6A owns the learning ledger).

import type {
  ChangeSet,
  EditSession,
  LearningScope,
  OpaqueId,
  ProvenanceRecord,
  SolutionPatchOperation,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";

/** A user-authorized learning signal derived from an accepted correction. */
export interface LearningCandidate {
  readonly id: OpaqueId;
  readonly scope: LearningScope;
  readonly intentRef: OpaqueId | null;
  /** Stable fingerprint of the intent text (repeated-intent matching). */
  readonly intentFingerprint: string;
  readonly sourceEditSessionId: OpaqueId;
  readonly sourceChangeSetId: OpaqueId;
  readonly operations: readonly SolutionPatchOperation[];
  readonly summary: string;
  readonly createdAt: string;
  readonly provenance: ProvenanceRecord;
}

export type LearningDerivationOutcome =
  | { readonly ok: true; readonly candidate: LearningCandidate }
  | {
      readonly ok: false;
      readonly code: "learning-not-permitted" | "consent-not-granted" | "session-open" | "changeset-not-accepted";
      readonly detail: string;
    };

export interface LearningDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface DeriveLearningInput {
  readonly session: EditSession;
  readonly changeSet: ChangeSet;
  readonly intentFingerprint: string;
  readonly intentRef?: OpaqueId | null;
  readonly scope?: LearningScope;
  readonly summary?: string;
}

/**
 * Consent gate + derivation. The gates are checked in a fixed order so
 * the denial reason is deterministic:
 *   1. session must be closed;
 *   2. changeset must be the accepted result of that session;
 *   3. learningPermission.learningPermission must be true;
 *   4. consent state must be "granted".
 */
export function deriveLearningCandidate(input: DeriveLearningInput, deps: LearningDeps): LearningDerivationOutcome {
  const { session, changeSet } = input;
  if (session.endedAt === null) {
    return {
      ok: false,
      code: "session-open",
      detail: `EditSession ${session.id} is still open; close it before deriving learning`,
    };
  }
  if (changeSet.status !== "accepted" || changeSet.resultingVersionId === null) {
    return {
      ok: false,
      code: "changeset-not-accepted",
      detail: `ChangeSet ${changeSet.id} is not an accepted correction`,
    };
  }
  if (!session.learningPermission.learningPermission) {
    return {
      ok: false,
      code: "learning-not-permitted",
      detail: `EditSession ${session.id} carries no learning permission`,
    };
  }
  if (session.learningPermission.state !== "granted") {
    return {
      ok: false,
      code: "consent-not-granted",
      detail: `consent state is "${session.learningPermission.state}", not "granted"`,
    };
  }
  const createdAt = deps.clock.now();
  const provenance: ProvenanceRecord = deepFreeze({
    source: `edit-session:${session.id}`,
    generator: "user",
    createdAt,
    lineage: [session.id, changeSet.id],
  });
  const candidate: LearningCandidate = deepFreeze({
    id: deps.ids.next("learning-candidate"),
    scope: input.scope ?? "USER",
    intentRef: input.intentRef ?? null,
    intentFingerprint: input.intentFingerprint,
    sourceEditSessionId: session.id,
    sourceChangeSetId: changeSet.id,
    operations: Object.freeze([...changeSet.proposedOperations]),
    summary:
      input.summary ??
      `user correction of ${changeSet.proposedOperations.length} operation(s) from session ${session.id}`,
    createdAt,
    provenance,
  });
  return { ok: true, candidate };
}
