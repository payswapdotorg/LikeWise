// YOU editing service — live plane projection builder (W5A).
//
// Builds the authoritative EditingPlaneProjection from the service's live
// state in EXACTLY the shape replayEditingLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in tests
// via stableStringify; any drift between this builder and the fold is a
// bug.
//
// The subject registry and the editor capability registry are service
// state, NOT ledger truth (the frozen wave-5 event set defines no
// subject/editor events — the W4A template-library precedent); they stay
// out of the replayable projection. Session status, change sets (with
// fully reconstructable ordered ops), candidate lineage edges, candidate
// resolutions and import/export outcomes ARE ledger truth.

import type {
  EditingLedgerCandidateEntry,
  EditingLedgerChangeSetEntry,
  EditingLedgerImportExportEntry,
  EditingLedgerOpEntry,
  EditingLedgerSessionEntry,
  EditingPlaneProjection,
} from "../../../shared/src/you/editingLedger.js";
import type { EditingPlaneRecord } from "./editingServiceTypes.js";
import { sortedIds } from "./editingServiceTypes.js";

/** Builds the live editing-plane projection (equal to replayEditingLedger output). */
export function buildEditingPlaneProjection(plane: EditingPlaneRecord): EditingPlaneProjection {
  const editingSessions: Record<string, EditingLedgerSessionEntry> = {};
  for (const sessionId of sortedIds(plane.sessions)) {
    const session = plane.sessions.get(sessionId);
    if (session === undefined) {
      continue;
    }
    editingSessions[sessionId] = {
      subjectArtifactId: session.subjectArtifactId,
      editorKind: session.editorKind,
      status: session.status,
    };
  }

  const changeSets: Record<string, EditingLedgerChangeSetEntry> = {};
  for (const changeSetId of sortedIds(plane.changeSets)) {
    const changeSet = plane.changeSets.get(changeSetId);
    if (changeSet === undefined) {
      continue;
    }
    const ops: EditingLedgerOpEntry[] = changeSet.ops.map((op) => ({
      id: op.id,
      kind: op.kind,
      payloadRef: op.payloadRef,
      payloadHash: op.payloadHash,
    }));
    changeSets[changeSetId] = { sessionId: changeSet.sessionId, opCount: changeSet.ops.length, ops };
  }

  const candidates: Record<string, EditingLedgerCandidateEntry> = {};
  const candidateIdsByParent: Record<string, string[]> = {};
  for (const candidateId of sortedIds(plane.candidates)) {
    const candidate = plane.candidates.get(candidateId);
    if (candidate === undefined) {
      continue;
    }
    candidates[candidateId] = {
      changeSetId: candidate.changeSetId,
      parentVersionId: candidate.parentVersionId,
      contentRef: candidate.contentRef,
      contentHash: candidate.contentHash,
      simulated: candidate.simulated,
    };
  }
  for (const parentVersionId of sortedIds(plane.candidateIdsByParent)) {
    candidateIdsByParent[parentVersionId] = [...(plane.candidateIdsByParent.get(parentVersionId) ?? [])];
  }

  const candidateResolutions: Record<string, string> = {};
  for (const candidateId of sortedIds(plane.candidateResolutions)) {
    const resolution = plane.candidateResolutions.get(candidateId);
    if (resolution !== undefined) {
      candidateResolutions[candidateId] = resolution;
    }
  }

  const importExports: Record<string, EditingLedgerImportExportEntry> = {};
  for (const resultId of sortedIds(plane.importExports)) {
    const result = plane.importExports.get(resultId);
    if (result === undefined) {
      continue;
    }
    importExports[resultId] = {
      sessionId: result.sessionId ?? "",
      direction: plane.importExportDirections.get(resultId) ?? "",
      format: result.format,
      status: result.status,
      contentRef: result.contentRef ?? "",
      contentHash: result.contentHash ?? "",
      simulated: result.simulated,
    };
  }

  return {
    solutionId: plane.solutionId,
    editingSessions,
    changeSets,
    candidates,
    candidateIdsByParent,
    candidateResolutions,
    importExports,
  };
}
