// YOU editing service — ledger event emission helpers (W5A).
//
// Append-only event helpers following the W1A/W2A/W3A/W4A precedent
// (solutionLedgerOps.ts / evidenceLedgerOps.ts / twinLedgerOps.ts /
// performanceLedgerOps.ts): the editing plane appends the wave-5 events
// (change-set-applied / candidate-version-proposed /
// import-export-completed) plus the v1 editing-lifecycle events the
// wave-5 freeze assigns to this lane (edit-session-opened /
// edit-session-closed / change-proposed / change-accepted /
// change-rejected) through the existing SolutionEventLedger machinery.
// Payload conventions are folded by shared/src/you/editingLedger.ts
// replayEditingLedger (the namespaced keys mirror the frozen wave-5 type
// names; the v1 fold keys stay owned by the v1 solution plane).

import type { CandidateVersion, EditingSession, EditChangeSet, ImportExportResult, OpaqueId } from "@zcode/shared";
import type { EditingPlaneRecord } from "./editingServiceTypes.js";

/** Appends edit-session-opened (session facts; status starts "open"). */
export function appendEditingSessionOpened(plane: EditingPlaneRecord, session: EditingSession): void {
  plane.ledger.append({
    type: "edit-session-opened",
    subjectRef: session.id,
    generator: "user",
    payload: {
      editingSessionId: session.id,
      subjectArtifactId: session.subjectArtifactId,
      editorKind: session.editorKind,
      statusAfter: session.status,
      simulated: true,
    },
  });
}

/** Appends edit-session-closed (terminal status: committed | abandoned). */
export function appendEditingSessionClosed(plane: EditingPlaneRecord, session: EditingSession): void {
  plane.ledger.append({
    type: "edit-session-closed",
    subjectRef: session.id,
    generator: "user",
    payload: {
      editingSessionId: session.id,
      statusAfter: session.status,
      simulated: true,
    },
  });
}

/** Appends change-proposed (flattened ordered op facts; content-addressed payloads only). */
export function appendChangeProposed(plane: EditingPlaneRecord, changeSet: EditChangeSet): void {
  const opFacts: Record<string, string | number | boolean> = {};
  for (let index = 0; index < changeSet.ops.length; index += 1) {
    const op = changeSet.ops[index];
    if (op === undefined) {
      continue;
    }
    opFacts[`op.${index}.id`] = op.id;
    opFacts[`op.${index}.kind`] = op.kind;
    opFacts[`op.${index}.payloadRef`] = op.payloadRef;
    opFacts[`op.${index}.payloadHash`] = op.payloadHash;
  }
  plane.ledger.append({
    type: "change-proposed",
    subjectRef: changeSet.id,
    generator: "user",
    payload: {
      editChangeSetId: changeSet.id,
      editingSessionId: changeSet.sessionId,
      opCount: changeSet.ops.length,
      ...opFacts,
      simulated: true,
    },
  });
}

/** Appends change-set-applied (the application of a change set to a parent version). */
export function appendChangeSetApplied(
  plane: EditingPlaneRecord,
  changeSet: EditChangeSet,
  parentVersionId: OpaqueId,
): void {
  plane.ledger.append({
    type: "change-set-applied",
    subjectRef: changeSet.id,
    generator: "agent",
    payload: {
      editChangeSetId: changeSet.id,
      editingSessionId: changeSet.sessionId,
      parentVersionId,
      opCount: changeSet.ops.length,
      simulated: true,
    },
  });
}

/** Appends candidate-version-proposed (the immutable lineage node). */
export function appendCandidateVersionProposed(plane: EditingPlaneRecord, candidate: CandidateVersion): void {
  plane.ledger.append({
    type: "candidate-version-proposed",
    subjectRef: candidate.id,
    generator: "agent",
    payload: {
      candidateId: candidate.id,
      editChangeSetId: candidate.changeSetId,
      parentVersionId: candidate.parentVersionId,
      contentRef: candidate.contentRef,
      contentHash: candidate.contentHash,
      simulated: candidate.simulated,
    },
  });
}

/** Appends change-accepted / change-rejected (v1 events; candidate resolution). */
export function appendCandidateResolved(
  plane: EditingPlaneRecord,
  candidate: CandidateVersion,
  sessionId: OpaqueId,
  outcome: "accepted" | "rejected",
  reason: string,
): void {
  plane.ledger.append({
    type: outcome === "accepted" ? "change-accepted" : "change-rejected",
    subjectRef: candidate.id,
    generator: "user",
    payload: {
      candidateId: candidate.id,
      editChangeSetId: candidate.changeSetId,
      editingSessionId: sessionId,
      ...(outcome === "rejected" ? { reason } : {}),
      simulated: true,
    },
  });
}

/** Appends import-export-completed (direction, format, status + content binding when succeeded). */
export function appendImportExportCompleted(
  plane: EditingPlaneRecord,
  result: ImportExportResult,
  direction: "export" | "import",
  byteLength: number,
): void {
  plane.ledger.append({
    type: "import-export-completed",
    subjectRef: result.id,
    generator: direction === "import" ? "importer" : "agent",
    payload: {
      resultId: result.id,
      direction,
      format: result.format,
      editingSessionId: result.sessionId ?? "",
      status: result.status,
      contentRef: result.contentRef ?? "",
      contentHash: result.contentHash ?? "",
      byteLength,
      simulated: result.simulated,
    },
  });
}
