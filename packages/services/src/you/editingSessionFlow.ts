// YOU editing service — subject registration + editing-session lifecycle
// flow (W5A — docs/you/WORK_ORDERS.md W5A: "open sessions over subject
// artifacts (render artifacts or other content-addressed records);
// append-only session lifecycle open → committed | abandoned (terminals
// locked; illegal transitions typed refusals)").
//
// Legal transitions (shared/src/you/editingSession.ts):
//   open -> committed | abandoned
//   committed / abandoned are terminal.
// Illegal transitions are typed YOU_INVALID_STATE refusals (no state
// change). An unregistered editor kind is a typed YOU_EDITOR_UNSUPPORTED
// refusal through the registry seam (never a silent fallback); an unknown
// subject artifact is a typed YOU_INVALID_STATE refusal. Terminal
// transitions use immutable record replacement + the append-only
// edit-session-closed event (the W4A artifact-review discipline).
//
// Subject registration is service state (the frozen wave-5 event set has
// no subject event — the W4A template-library precedent): subjects are
// content-addressed bindings on the wave-2 store abstraction, registered
// from explicit bytes or an existing content binding (verified — a
// dangling ref or hash mismatch is a typed refusal, never a silent
// repair).

import type { EditingSession, OpaqueId, YouError } from "@zcode/shared";
import { createEditingSession, isLegalEditingSessionTransition, transitionEditingSession } from "../../../shared/src/you/editingSession.js";
import { sha256Hex } from "../../../shared/src/you/evidenceStore.js";
import { deepFreeze } from "../../../shared/src/you/serialize.js";
import type { EditingContentDeps, EditingPlaneRecord, EditingServiceResult, EditingSubjectRecord, EditorCapabilityRegistry } from "./editingServiceTypes.js";
import { editingFailure, requireEditingSession } from "./editingServiceTypes.js";
import { appendEditingSessionClosed, appendEditingSessionOpened } from "./editingLedgerOps.js";

export type SubjectRegistrationInput =
  | { readonly bytes: Uint8Array }
  | { readonly contentRef: string; readonly contentHash: string };

/**
 * Registers a subject artifact: explicit bytes are stored through the
 * wave-2 content store; an explicit binding must RESOLVE in the store
 * (typed refusal on a dangling ref or a hash mismatch — never a silent
 * repair). The record is immutable; the registry is append-only.
 */
export function registerSubjectOp(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  input: SubjectRegistrationInput,
): EditingServiceResult<{ readonly subject: EditingSubjectRecord }> {
  let contentRef: string;
  let contentHash: string;
  if ("bytes" in input) {
    const binding = deps.store.put(input.bytes);
    contentRef = binding.contentRef;
    contentHash = binding.contentHash;
  } else {
    const stored = deps.store.get(input.contentRef);
    if (stored === null) {
      return editingFailure("YOU_INVALID_STATE", "the subject content binding does not resolve in the content store", {
        reason: "unresolved-content-ref",
        contentRef: input.contentRef,
      });
    }
    if (sha256Hex(stored) !== input.contentHash) {
      return editingFailure("YOU_CONTENT_HASH_MISMATCH", "the subject content binding does not match the stored bytes", {
        reason: "subject-hash-mismatch",
        contentRef: input.contentRef,
      });
    }
    contentRef = input.contentRef;
    contentHash = input.contentHash;
  }
  const subject: EditingSubjectRecord = deepFreeze({
    id: deps.ids.next("editing-subject"),
    contentRef,
    contentHash,
    simulated: true,
  });
  plane.subjects.set(subject.id, subject);
  plane.subjectIds.push(subject.id);
  return { ok: true, value: { subject } };
}

export interface OpenEditingSessionInput {
  readonly subjectArtifactId: OpaqueId;
  readonly editorKind: string;
}

/**
 * Opens an editing session over one registered subject artifact: resolves
 * the subject (typed YOU_INVALID_STATE), resolves the editor kind through
 * the registry seam (typed YOU_EDITOR_UNSUPPORTED), constructs the
 * immutable session (status "open") and appends edit-session-opened.
 */
export function openEditingSessionOp(
  plane: EditingPlaneRecord,
  deps: EditingContentDeps,
  editorRegistry: EditorCapabilityRegistry,
  input: OpenEditingSessionInput,
): EditingServiceResult<{ readonly session: EditingSession }> {
  if (!plane.subjects.has(input.subjectArtifactId)) {
    return editingFailure("YOU_INVALID_STATE", "unknown subject artifact", {
      reason: "unknown-subject-artifact",
      subjectArtifactId: input.subjectArtifactId,
    });
  }
  if (editorRegistry.resolve(input.editorKind) === null) {
    return editingFailure("YOU_EDITOR_UNSUPPORTED", `editor kind "${input.editorKind}" is not registered`, {
      reason: "unregistered-editor-kind",
      editorKind: input.editorKind,
    });
  }
  const created = createEditingSession(
    { subjectArtifactId: input.subjectArtifactId, editorKind: input.editorKind },
    { clock: deps.clock, ids: deps.ids },
  );
  if (!created.ok) {
    return editingFailure("YOU_INVALID_STATE", created.detail, {
      reason: created.code,
      subjectArtifactId: input.subjectArtifactId,
    });
  }
  plane.sessions.set(created.session.id, created.session);
  appendEditingSessionOpened(plane, created.session);
  return { ok: true, value: { session: created.session } };
}

function closeEditingSession(
  plane: EditingPlaneRecord,
  sessionId: OpaqueId,
  to: "committed" | "abandoned",
): EditingServiceResult<{ readonly session: EditingSession }> {
  const found: { readonly session: EditingSession } | { readonly error: YouError } = requireEditingSession(plane, sessionId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (!isLegalEditingSessionTransition(found.session.status, to)) {
    return editingFailure("YOU_INVALID_STATE", `illegal editing session transition ${found.session.status} -> ${to}`, {
      reason: "illegal-editing-session-transition",
      editingSessionId: sessionId,
      fromStatus: found.session.status,
      toStatus: to,
    });
  }
  const closed = transitionEditingSession(found.session, to);
  plane.sessions.set(closed.id, closed);
  appendEditingSessionClosed(plane, closed);
  return { ok: true, value: { session: closed } };
}

/** Commits an open session (open -> committed; terminal, append-only). */
export function commitEditingSessionOp(
  plane: EditingPlaneRecord,
  sessionId: OpaqueId,
): EditingServiceResult<{ readonly session: EditingSession }> {
  return closeEditingSession(plane, sessionId, "committed");
}

/** Abandons an open session (open -> abandoned; terminal, append-only). */
export function abandonEditingSessionOp(
  plane: EditingPlaneRecord,
  sessionId: OpaqueId,
): EditingServiceResult<{ readonly session: EditingSession }> {
  return closeEditingSession(plane, sessionId, "abandoned");
}
