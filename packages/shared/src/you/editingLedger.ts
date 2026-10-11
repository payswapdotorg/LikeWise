// YOU editing-plane ledger replay (W5A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The editing application service appends the wave-5 events
// (change-set-applied / candidate-version-proposed /
// import-export-completed) plus the v1 editing-lifecycle events the freeze
// assigns to this lane (edit-session-opened / edit-session-closed /
// change-proposed / change-accepted / change-rejected) into the W1A
// SolutionEventLedger machinery. Payload conventions (folded here by
// replayEditingLedger):
//   edit-session-opened        { editingSessionId, subjectArtifactId,
//                               editorKind, statusAfter: "open", simulated }
//   edit-session-closed        { editingSessionId, statusAfter:
//                               committed | abandoned, simulated }
//   change-proposed            { editChangeSetId, editingSessionId,
//                               opCount, op.<i>.id / .kind / .payloadRef /
//                               .payloadHash, simulated }
//   change-set-applied         { editChangeSetId, editingSessionId,
//                               parentVersionId, opCount, simulated }
//   candidate-version-proposed { candidateId, editChangeSetId,
//                               parentVersionId, contentRef, contentHash,
//                               simulated }
//   change-accepted            { candidateId, editChangeSetId,
//                               editingSessionId, simulated }
//   change-rejected            { candidateId, editChangeSetId,
//                               editingSessionId, reason, simulated }
//   import-export-completed    { resultId, direction: export | import,
//                               format, editingSessionId ("" when null),
//                               status: succeeded | failed, contentRef (""
//                               when null), contentHash ("" when null),
//                               byteLength (0 when failed), simulated }
//
// The subject-artifact registry and the editor capability registry are
// service state, NOT ledger truth (the frozen wave-5 event set defines no
// subject/editor events — the same precedent as the W4A template library);
// they stay out of the replayable projection. replayEditingLedger folds
// the events into the authoritative editing-plane projection.
// Deterministic: same events => same projection (compare through
// stableStringify).

import type { SolutionEvent } from "./contract.js";

export interface EditingLedgerOpEntry {
  readonly id: string;
  readonly kind: string;
  readonly payloadRef: string;
  readonly payloadHash: string;
}

export interface EditingLedgerSessionEntry {
  readonly subjectArtifactId: string;
  readonly editorKind: string;
  readonly status: string;
}

export interface EditingLedgerChangeSetEntry {
  readonly sessionId: string;
  readonly opCount: number;
  readonly ops: readonly EditingLedgerOpEntry[];
}

export interface EditingLedgerCandidateEntry {
  readonly changeSetId: string;
  readonly parentVersionId: string;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly simulated: boolean;
}

export interface EditingLedgerImportExportEntry {
  /** "" when the result carries no session binding. */
  readonly sessionId: string;
  readonly direction: string;
  readonly format: string;
  readonly status: string;
  /** "" when the result failed (no content binding). */
  readonly contentRef: string;
  readonly contentHash: string;
  readonly simulated: boolean;
}

export interface EditingPlaneProjection {
  readonly solutionId: string;
  /** editingSessionId -> authoritative session facts. */
  readonly editingSessions: Readonly<Record<string, EditingLedgerSessionEntry>>;
  /** editChangeSetId -> change-set facts (ops fully reconstructable). */
  readonly changeSets: Readonly<Record<string, EditingLedgerChangeSetEntry>>;
  /** candidateId -> candidate facts (content-addressed; never inlined content). */
  readonly candidates: Readonly<Record<string, EditingLedgerCandidateEntry>>;
  /** parentVersionId -> candidate ids in proposal order (lineage). */
  readonly candidateIdsByParent: Readonly<Record<string, string[]>>;
  /** candidateId -> accepted | rejected (resolved candidates only). */
  readonly candidateResolutions: Readonly<Record<string, string>>;
  /** resultId -> import/export outcome facts. */
  readonly importExports: Readonly<Record<string, EditingLedgerImportExportEntry>>;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Folds editing-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 */
export function replayEditingLedger(events: readonly SolutionEvent[]): EditingPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayEditingLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const editingSessions: Record<string, EditingLedgerSessionEntry> = {};
  const changeSets: Record<string, EditingLedgerChangeSetEntry> = {};
  const candidates: Record<string, EditingLedgerCandidateEntry> = {};
  const candidateIdsByParent: Record<string, string[]> = {};
  const candidateResolutions: Record<string, string> = {};
  const importExports: Record<string, EditingLedgerImportExportEntry> = {};

  for (const event of events) {
    switch (event.type) {
      case "edit-session-opened": {
        const id = textPayload(event, "editingSessionId");
        if (id !== undefined) {
          editingSessions[id] = {
            subjectArtifactId: textPayload(event, "subjectArtifactId") ?? "",
            editorKind: textPayload(event, "editorKind") ?? "",
            status: textPayload(event, "statusAfter") ?? "open",
          };
        }
        break;
      }
      case "edit-session-closed": {
        const id = textPayload(event, "editingSessionId");
        if (id !== undefined) {
          const existing = editingSessions[id];
          editingSessions[id] = {
            subjectArtifactId: existing?.subjectArtifactId ?? "",
            editorKind: existing?.editorKind ?? "",
            status: textPayload(event, "statusAfter") ?? existing?.status ?? "open",
          };
        }
        break;
      }
      case "change-proposed": {
        const id = textPayload(event, "editChangeSetId");
        if (id !== undefined) {
          const opCount = numberPayload(event, "opCount") ?? 0;
          const ops: EditingLedgerOpEntry[] = [];
          for (let index = 0; index < opCount; index += 1) {
            const opId = textPayload(event, `op.${index}.id`);
            const kind = textPayload(event, `op.${index}.kind`);
            const payloadRef = textPayload(event, `op.${index}.payloadRef`);
            const payloadHash = textPayload(event, `op.${index}.payloadHash`);
            if (opId === undefined || kind === undefined || payloadRef === undefined || payloadHash === undefined) {
              continue;
            }
            ops.push({ id: opId, kind, payloadRef, payloadHash });
          }
          changeSets[id] = { sessionId: textPayload(event, "editingSessionId") ?? "", opCount, ops };
        }
        break;
      }
      case "candidate-version-proposed": {
        const id = textPayload(event, "candidateId");
        if (id !== undefined) {
          const parentVersionId = textPayload(event, "parentVersionId") ?? "";
          candidates[id] = {
            changeSetId: textPayload(event, "editChangeSetId") ?? "",
            parentVersionId,
            contentRef: textPayload(event, "contentRef") ?? "",
            contentHash: textPayload(event, "contentHash") ?? "",
            simulated: true,
          };
          const lineage = candidateIdsByParent[parentVersionId] ?? [];
          lineage.push(id);
          candidateIdsByParent[parentVersionId] = lineage;
        }
        break;
      }
      case "change-accepted":
      case "change-rejected": {
        const candidateId = textPayload(event, "candidateId");
        if (candidateId !== undefined) {
          candidateResolutions[candidateId] = event.type === "change-accepted" ? "accepted" : "rejected";
        }
        break;
      }
      case "import-export-completed": {
        const id = textPayload(event, "resultId");
        if (id !== undefined) {
          importExports[id] = {
            sessionId: textPayload(event, "editingSessionId") ?? "",
            direction: textPayload(event, "direction") ?? "",
            format: textPayload(event, "format") ?? "",
            status: textPayload(event, "status") ?? "",
            contentRef: textPayload(event, "contentRef") ?? "",
            contentHash: textPayload(event, "contentHash") ?? "",
            simulated: true,
          };
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    editingSessions,
    changeSets,
    candidates,
    candidateIdsByParent,
    candidateResolutions,
    importExports,
  };
}
