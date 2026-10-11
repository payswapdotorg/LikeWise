// YOU editing service — change-set proposal/validation/application and
// candidate-version lineage flow (W5A).
//
// Proposal: the session must exist (typed YOU_EDIT_SESSION_NOT_FOUND) and
// be OPEN; the ordered ops pass the stateless validator (typed
// YOU_CHANGESET_INVALID); the immutable EditChangeSet is journaled through
// change-proposed.
//
// Application ("applying a validated EditChangeSet to a parent version
// produces an immutable CandidateVersion"): the change set is revalidated
// (stateless), every op payload binding is VERIFIED against the wave-2
// content store (payloadRef resolves + sha-256 payloadHash matches — a
// mismatch is a typed YOU_CHANGESET_INVALID refusal, never a silent
// repair), the parent version resolves (the subject root or an earlier
// candidate; typed YOU_INVALID_STATE when unknown), and the deterministic
// fixture application produces the content-addressed immutable
// CandidateVersion (parent -> candidate lineage registered append-only).
// Events: change-set-applied + candidate-version-proposed.
//
// Candidate resolution (the Tier-4 accept/reject tail): a candidate
// resolves exactly once (change-accepted / change-rejected — the v1
// events, where the flow calls for them) while its session is open.
// Lineage queries: candidatesOfParent (proposal order) and
// ancestryOfCandidate (root subject -> leaf chain).

import type { CandidateVersion, EditChangeSetOp, OpaqueId } from "@zcode/shared";
import { createEditChangeSet, validateEditChangeSet } from "../../../shared/src/you/editChangeSet.js";
import { fixtureApplyEditChangeSet } from "../../../shared/src/you/candidateVersion.js";
import { sha256Hex } from "../../../shared/src/you/evidenceStore.js";
import type { EditingContentDeps, EditingPlaneRecord, EditingServiceResult, EditingSubjectRecord } from "./editingServiceTypes.js";
import { editingFailure, requireEditingSession, sessionNotOpen } from "./editingServiceTypes.js";
import { appendCandidateResolved, appendCandidateVersionProposed, appendChangeProposed, appendChangeSetApplied } from "./editingLedgerOps.js";

export interface ProposeEditChangeSetInput {
  readonly sessionId: OpaqueId;
  readonly ops: readonly EditChangeSetOp[];
}

function changesetInvalid(detail: string, reason: string): { readonly ok: false; readonly error: import("@zcode/shared").YouError } {
  return editingFailure("YOU_CHANGESET_INVALID", `invalid edit change set: ${detail}`, { reason, detail });
}

/** Proposes an edit change set for an OPEN session (stateless validation; append-only). */
export function proposeEditChangeSetOp(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  input: ProposeEditChangeSetInput,
): EditingServiceResult<{ readonly changeSet: import("@zcode/shared").EditChangeSet }> {
  const found = requireEditingSession(plane, input.sessionId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (found.session.status !== "open") {
    return sessionNotOpen(input.sessionId, found.session.status);
  }
  const created = createEditChangeSet({ sessionId: input.sessionId, ops: input.ops }, { clock: deps.clock, ids: deps.ids });
  if (!created.ok) {
    return changesetInvalid(created.detail, created.code);
  }
  plane.changeSets.set(created.changeSet.id, created.changeSet);
  const existing = plane.changeSetIdsBySession.get(input.sessionId) ?? [];
  plane.changeSetIdsBySession.set(input.sessionId, [...existing, created.changeSet.id]);
  appendChangeProposed(plane, created.changeSet);
  return { ok: true, value: { changeSet: created.changeSet } };
}

export interface ApplyEditChangeSetInput {
  readonly changeSetId: OpaqueId;
  readonly parentVersionId: OpaqueId;
}

function requireChangeSet(plane: EditingPlaneRecord, changeSetId: OpaqueId) {
  const changeSet = plane.changeSets.get(changeSetId);
  return changeSet === undefined
    ? editingFailure("YOU_INVALID_STATE", "unknown edit change set", { reason: "unknown-change-set", editChangeSetId: changeSetId })
    : { ok: true as const, changeSet };
}

/** Resolves a parent version node (subject root or candidate) to its content hash. */
function parentContentHashOf(plane: EditingPlaneRecord, parentVersionId: OpaqueId): string | null {
  const subject = plane.subjects.get(parentVersionId);
  if (subject !== undefined) {
    return subject.contentHash;
  }
  return plane.candidates.get(parentVersionId)?.contentHash ?? null;
}

/**
 * Verifies every op payload binding against the content store (the
 * content-addressed discipline: payloadRef resolves AND the sha-256
 * payloadHash matches the stored bytes).
 */
function verifyOpPayloadBindings(
  deps: EditingContentDeps,
  ops: readonly EditChangeSetOp[],
): { readonly ok: true } | { readonly ok: false; readonly error: import("@zcode/shared").YouError } {
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    if (op === undefined) {
      continue;
    }
    const stored = deps.store.get(op.payloadRef);
    if (stored === null) {
      return changesetInvalid(`op ${index}: payloadRef "${op.payloadRef}" does not resolve in the content store`, "payload-unresolved");
    }
    if (sha256Hex(stored) !== op.payloadHash) {
      return changesetInvalid(`op ${index}: payloadHash does not match the stored payload bytes`, "payload-hash-mismatch");
    }
  }
  return { ok: true };
}

/**
 * Applies a validated change set to a parent version: revalidates
 * (stateless), verifies the payload bindings, resolves the parent, runs
 * the deterministic fixture application, registers the immutable
 * CandidateVersion + parent -> candidate lineage and appends
 * change-set-applied + candidate-version-proposed.
 */
export function applyEditChangeSetOp(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  input: ApplyEditChangeSetInput,
): EditingServiceResult<{ readonly candidate: CandidateVersion }> {
  const found = requireChangeSet(plane, input.changeSetId);
  if (!found.ok) {
    return { ok: false, error: found.error };
  }
  const changeSet = found.changeSet;
  const validated = validateEditChangeSet(changeSet);
  if (!validated.ok) {
    return changesetInvalid(validated.detail, validated.code);
  }
  const session = plane.sessions.get(changeSet.sessionId);
  if (session === undefined) {
    return editingFailure("YOU_EDIT_SESSION_NOT_FOUND", "unknown editing session", {
      reason: "unknown-editing-session",
      editingSessionId: changeSet.sessionId,
    });
  }
  if (session.status !== "open") {
    return sessionNotOpen(changeSet.sessionId, session.status);
  }
  const bindings = verifyOpPayloadBindings(deps, changeSet.ops);
  if (!bindings.ok) {
    return bindings;
  }
  const parentContentHash = parentContentHashOf(plane, input.parentVersionId);
  if (parentContentHash === null) {
    return editingFailure("YOU_INVALID_STATE", "unknown parent version (neither a registered subject nor a proposed candidate)", {
      reason: "unknown-parent-version",
      parentVersionId: input.parentVersionId,
    });
  }
  const candidate = fixtureApplyEditChangeSet(
    { changeSet, parentVersionId: input.parentVersionId, parentContentHash },
    { clock: deps.clock, ids: deps.ids, store: deps.store },
  );
  plane.candidates.set(candidate.id, candidate);
  const lineage = plane.candidateIdsByParent.get(input.parentVersionId) ?? [];
  plane.candidateIdsByParent.set(input.parentVersionId, [...lineage, candidate.id]);
  appendChangeSetApplied(plane, changeSet, input.parentVersionId);
  appendCandidateVersionProposed(plane, candidate);
  return { ok: true, value: { candidate } };
}

export interface ResolveCandidateInput {
  readonly candidateId: OpaqueId;
  readonly outcome: "accepted" | "rejected";
  readonly reason?: string;
}

/**
 * Resolves a proposed candidate exactly once (change-accepted /
 * change-rejected — the v1 events where the Tier-4 flow calls for them).
 * The candidate's session must still be open; a resolved candidate never
 * resolves again (append-only).
 */
export function resolveCandidateVersionOp(
  plane: EditingPlaneRecord,
  input: ResolveCandidateInput,
): EditingServiceResult<{ readonly candidate: CandidateVersion; readonly resolution: "accepted" | "rejected" }> {
  const candidate = plane.candidates.get(input.candidateId);
  if (candidate === undefined) {
    return editingFailure("YOU_INVALID_STATE", "unknown candidate version", {
      reason: "unknown-candidate-version",
      candidateId: input.candidateId,
    });
  }
  if (plane.candidateResolutions.has(input.candidateId)) {
    return editingFailure("YOU_INVALID_STATE", `candidate version ${input.candidateId} is already resolved`, {
      reason: "candidate-already-resolved",
      candidateId: input.candidateId,
      resolution: plane.candidateResolutions.get(input.candidateId) ?? "",
    });
  }
  const changeSet = plane.changeSets.get(candidate.changeSetId);
  const sessionId = changeSet?.sessionId ?? "";
  const session = plane.sessions.get(sessionId);
  if (session === undefined) {
    return editingFailure("YOU_EDIT_SESSION_NOT_FOUND", "unknown editing session", {
      reason: "unknown-editing-session",
      editingSessionId: sessionId,
    });
  }
  if (session.status !== "open") {
    return sessionNotOpen(sessionId, session.status);
  }
  plane.candidateResolutions.set(input.candidateId, input.outcome);
  appendCandidateResolved(plane, candidate, sessionId, input.outcome, input.reason ?? "fixture-rejected");
  return { ok: true, value: { candidate, resolution: input.outcome } };
}

/** The candidates proposed for one parent version, in proposal order (lineage). */
export function candidatesOfParentOp(plane: EditingPlaneRecord, parentVersionId: OpaqueId): readonly CandidateVersion[] {
  const ids = plane.candidateIdsByParent.get(parentVersionId) ?? [];
  return ids.map((candidateId) => plane.candidates.get(candidateId)).filter((candidate): candidate is CandidateVersion => candidate !== undefined);
}

/** The root-to-leaf lineage view of a candidate (subject root first). */
export interface EditingLineageView {
  readonly subject: EditingSubjectRecord;
  readonly candidates: readonly CandidateVersion[];
}

/**
 * Walks the candidate's parent chain up to the registered subject root:
 * [subject, candidate1, ..., candidateN]. A broken link is a typed
 * YOU_INVALID_STATE refusal (plane invariant violation, never a guess).
 */
export function ancestryOfCandidateOp(
  plane: EditingPlaneRecord,
  candidateId: OpaqueId,
): EditingServiceResult<EditingLineageView> {
  const candidate = plane.candidates.get(candidateId);
  if (candidate === undefined) {
    return editingFailure("YOU_INVALID_STATE", "unknown candidate version", {
      reason: "unknown-candidate-version",
      candidateId,
    });
  }
  const chain: CandidateVersion[] = [candidate];
  let parentId = candidate.parentVersionId;
  let root: EditingSubjectRecord | null = null;
  while (root === null) {
    const parentCandidate = plane.candidates.get(parentId);
    if (parentCandidate === undefined) {
      const subject = plane.subjects.get(parentId);
      if (subject === undefined) {
        return editingFailure("YOU_INVALID_STATE", "the candidate lineage does not reach a registered subject root", {
          reason: "broken-lineage",
          candidateId,
          parentVersionId: parentId,
        });
      }
      root = subject;
    } else {
      chain.push(parentCandidate);
      parentId = parentCandidate.parentVersionId;
    }
  }
  chain.reverse();
  return { ok: true, value: { subject: root, candidates: chain } };
}
