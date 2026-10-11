// YOU editing-session machinery (W5A — docs/you/CONTRACTS.md "Wave-5
// contract freeze (v5)", frozen EditingSession / EditingSessionStatus).
//
// The namespaced EditingSession is the artifact-editing record (the v1
// EditSession solution-patch flow keeps its own name and stays untouched).
// State truth = the editing application service (Worker A lane); this
// module owns the pure machinery: the legal status transition table,
// session construction and the immutable record-replacement transition.
//
// Session lifecycle (docs/you/WORK_ORDERS.md W5A: "append-only session
// lifecycle open → committed | abandoned (terminals locked; illegal
// transitions typed refusals)"):
//   open      -> committed | abandoned
//   committed / abandoned are terminal.
// Discipline (the W4A artifact-review precedent, verbatim): the session is
// an immutable record; a terminal transition produces a NEW deep-frozen
// record under the SAME id (content identical, only the status moved) —
// never an in-place mutation — and every transition is journaled
// append-only in the event ledger by the service.
//
// Fixture laws (docs/you/FIXTURES.md) apply verbatim: timestamps come from
// the injected clock; ids are opaque and RNG-derived in fixture mode.

import type { EditingSession, EditingSessionStatus, EditorKind, OpaqueId } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";

/** Legal editing-session status transitions (terminals locked). */
export const EDITING_SESSION_TRANSITIONS: Readonly<Record<EditingSessionStatus, readonly EditingSessionStatus[]>> = {
  open: ["committed", "abandoned"],
  committed: [],
  abandoned: [],
};

export function isLegalEditingSessionTransition(from: EditingSessionStatus, to: EditingSessionStatus): boolean {
  return EDITING_SESSION_TRANSITIONS[from].includes(to);
}

export function isTerminalEditingSessionStatus(status: EditingSessionStatus): boolean {
  return EDITING_SESSION_TRANSITIONS[status].length === 0;
}

export interface EditingSessionIntake {
  readonly subjectArtifactId: OpaqueId;
  readonly editorKind: EditorKind;
}

export type EditingSessionRefusalCode = "invalid-subject-artifact" | "invalid-editor-kind";

export type EditingSessionRefusal =
  | { readonly ok: false; readonly code: "invalid-subject-artifact"; readonly detail: string }
  | { readonly ok: false; readonly code: "invalid-editor-kind"; readonly detail: string };

/** Returns a validation reason for an illegal editor kind, or null when legal. */
export function validateEditorKind(editorKind: EditorKind): string | null {
  if (typeof editorKind !== "string" || editorKind.length === 0) {
    return "editor kind must be a non-empty string";
  }
  if (editorKind !== editorKind.trim()) {
    return "editor kind must not carry surrounding whitespace";
  }
  return null;
}

/**
 * Creates the immutable, deep-frozen EditingSession (status "open") over
 * one subject artifact. The subject artifact and the editor kind are
 * validated structurally; subject/editor REGISTRATION is the service's
 * authority (typed YOU_INVALID_STATE / YOU_EDITOR_UNSUPPORTED there).
 */
export function createEditingSession(
  intake: EditingSessionIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly session: EditingSession } | EditingSessionRefusal {
  if (typeof intake.subjectArtifactId !== "string" || intake.subjectArtifactId.length === 0) {
    return { ok: false, code: "invalid-subject-artifact", detail: "an editing session requires a non-empty subjectArtifactId" };
  }
  const kindReason = validateEditorKind(intake.editorKind);
  if (kindReason !== null) {
    return { ok: false, code: "invalid-editor-kind", detail: `invalid editor kind: ${kindReason}` };
  }
  return {
    ok: true,
    session: deepFreeze({
      id: deps.ids.next("editing-session"),
      subjectArtifactId: intake.subjectArtifactId,
      editorKind: intake.editorKind,
      openedAt: deps.clock.now(),
      status: "open",
    }),
  };
}

/**
 * Returns a NEW deep-frozen session with the status transitioned (immutable
 * record replacement; same id, same content, only the status moved).
 * Throws on an illegal transition — the service checks the transition table
 * first and maps it to the typed YOU_INVALID_STATE refusal.
 */
export function transitionEditingSession(session: EditingSession, status: EditingSessionStatus): EditingSession {
  if (!isLegalEditingSessionTransition(session.status, status)) {
    throw new Error(`illegal editing session transition ${session.status} -> ${status}`);
  }
  return deepFreeze({ ...session, status });
}
