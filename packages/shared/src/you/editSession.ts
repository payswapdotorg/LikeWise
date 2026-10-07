// YOU EditSession lifecycle (docs/you/ARCHITECTURE.md §9, CONTRACTS.md).
//
// A manual takeover is a first-class record: open on an input version,
// close with the resulting artifact and diff reference. EditSessions are
// immutable records — closing produces a NEW object, never a mutation.

import type {
  ConsentReference,
  EditEvidenceMode,
  EditMode,
  EditSession,
  OpaqueId,
  ProvenanceRecord,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";

export interface EditSessionDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface EditSessionOpenInput {
  readonly solutionId: OpaqueId;
  readonly inputVersionId: OpaqueId;
  readonly editorRef: string;
  readonly editorVersion: string;
  readonly platform: string;
  readonly mode: EditMode;
  readonly evidenceMode: EditEvidenceMode;
  readonly learningPermission: ConsentReference;
  readonly sourceArtifactId?: OpaqueId | null;
}

/** Opens an EditSession (endedAt null, no result yet). */
export function openEditSession(input: EditSessionOpenInput, deps: EditSessionDeps): EditSession {
  if (input.editorRef.length === 0) {
    throw new Error("EditSession requires a non-empty editorRef");
  }
  const createdAt = deps.clock.now();
  const provenance: ProvenanceRecord = deepFreeze({
    source: "manual-takeover",
    generator: "user",
    createdAt,
    lineage: [],
  });
  return deepFreeze({
    id: deps.ids.next("edit-session"),
    solutionId: input.solutionId,
    inputVersionId: input.inputVersionId,
    editorRef: input.editorRef,
    editorVersion: input.editorVersion,
    platform: input.platform,
    mode: input.mode,
    evidenceMode: input.evidenceMode,
    startedAt: createdAt,
    endedAt: null,
    sourceArtifactId: input.sourceArtifactId ?? null,
    resultingArtifactId: null,
    diffRef: null,
    learningPermission: input.learningPermission,
    provenance,
  });
}

export interface EditSessionCloseInput {
  readonly resultingArtifactId?: OpaqueId | null;
  readonly diffRef?: OpaqueId | null;
}

/**
 * Closes an open EditSession: returns a NEW immutable record with
 * endedAt, resultingArtifactId and diffRef filled in. Throws when the
 * session is already closed (updates must never rewrite history).
 */
export function closeEditSession(session: EditSession, deps: EditSessionDeps, close: EditSessionCloseInput): EditSession {
  if (session.endedAt !== null) {
    throw new Error(`EditSession ${session.id} is already closed`);
  }
  return deepFreeze({
    ...session,
    endedAt: deps.clock.now(),
    resultingArtifactId: close.resultingArtifactId ?? null,
    diffRef: close.diffRef ?? null,
  });
}

/** True while the session has not been closed yet. */
export function isEditSessionOpen(session: EditSession): boolean {
  return session.endedAt === null;
}
