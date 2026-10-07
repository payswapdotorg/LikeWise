// YOU Solution service — manual takeover, EditSession close and consent-
// gated learning derivation (docs/you/ARCHITECTURE.md §9, §12).

import type { OpaqueId, SolutionPatchOperation } from "@zcode/shared";
import { createConsentReference } from "../../../shared/src/you/feedback.js";
import { deriveLearningCandidate } from "../../../shared/src/you/learning.js";
import { closeEditSession, openEditSession } from "../../../shared/src/you/editSession.js";
import { buildArtifactPackage, diffSolutionStates, recommendEditorForSnapshot } from "../../../shared/src/you/artifact.js";
import { applyPatchOperations } from "../../../shared/src/you/versioning.js";
import { proposeAndAccept } from "./solutionLedgerOps.js";
import type {
  LearningOutcome,
  SolutionRecord,
  SolutionServiceDeps,
  SolutionServiceResult,
  TakeoverInput,
  TakeoverOutcome,
} from "./solutionServiceTypes.js";
import { failure } from "./solutionServiceTypes.js";

/** Manual takeover: opens a consent-carrying EditSession. */
export function beginTakeoverOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  input: TakeoverInput,
): SolutionServiceResult<{ readonly session: import("@zcode/shared").EditSession }> {
  const session = openEditSession(
    {
      solutionId: record.identity.id,
      inputVersionId: record.chain.current().id,
      editorRef: input.editorRef ?? "you-native-editor",
      editorVersion: input.editorVersion ?? "phase0",
      platform: input.platform ?? "zcode-workspace",
      mode: input.mode,
      evidenceMode: input.evidenceMode,
      learningPermission: input.consent ?? createConsentReference("unknown", false),
    },
    deps,
  );
  record.editSessions.set(session.id, session);
  record.ledger.append({
    type: "edit-session-opened",
    subjectRef: session.id,
    generator: "user",
    payload: {
      editSessionId: session.id,
      mode: session.mode,
      evidenceMode: session.evidenceMode,
      inputVersionId: session.inputVersionId,
      learningPermission: session.learningPermission.learningPermission,
      actor: "user",
    },
  });
  return { ok: true, value: { session } };
}

/** Closes the takeover with the user's correction as a new version. */
export function closeTakeoverWithCorrectionOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  sessionId: OpaqueId,
  input: { readonly operations: readonly SolutionPatchOperation[] },
): SolutionServiceResult<TakeoverOutcome> {
  const session = record.editSessions.get(sessionId);
  if (session === undefined) {
    return failure("YOU_INVALID_STATE", "unknown edit session", { reason: "unknown-edit-session", sessionId });
  }
  if (session.endedAt !== null) {
    return failure("YOU_INVALID_STATE", "edit session already closed", { reason: "session-closed", sessionId });
  }
  const current = record.chain.current();
  if (session.inputVersionId !== current.id) {
    return failure("YOU_INVALID_STATE", "takeover base is stale", { reason: "stale-takeover-base", sessionId });
  }
  const diff = diffSolutionStates(current.state, applyPatchOperations(current.state, input.operations));
  const diffRef = deps.ids.next("diff");
  const applied = proposeAndAccept(record, {
    baseVersionId: current.id,
    operations: input.operations,
    intentRef: record.intent.id,
    authorType: "user",
    changePayload: { actor: "user", editSessionId: sessionId, diffRef },
    versionPayload: { actor: "user", editSessionId: sessionId },
  });
  if (applied === null) {
    return failure("YOU_INVALID_STATE", "takeover correction was rejected", { reason: "takeover-failed", sessionId });
  }
  const artifact = buildArtifactPackage(applied.version, recommendEditorForSnapshot(applied.version.state), deps);
  record.artifacts.set(artifact.id, artifact);
  const closed = closeEditSession(session, deps, { resultingArtifactId: artifact.id, diffRef });
  record.editSessions.set(sessionId, closed);
  record.sessionChanges.set(sessionId, applied.changeSet.id);
  record.ledger.append({
    type: "edit-session-closed",
    subjectRef: sessionId,
    generator: "user",
    payload: {
      editSessionId: sessionId,
      resultingArtifactId: artifact.id,
      diffRef,
      changeSetId: applied.changeSet.id,
      resultingVersionId: applied.version.id,
      actor: "user",
    },
  });
  return { ok: true, value: { session: closed, diff, version: applied.version, changeSet: applied.changeSet, artifact } };
}

/**
 * Consent-gated learning derivation. Returns the outcome; the service
 * decides whether the candidate is stored (single authority).
 */
export function deriveLearningOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  sessionId: OpaqueId,
): SolutionServiceResult<LearningOutcome> {
  const session = record.editSessions.get(sessionId);
  if (session === undefined) {
    return failure("YOU_INVALID_STATE", "unknown edit session", { reason: "unknown-edit-session", sessionId });
  }
  const changeSetId = record.sessionChanges.get(sessionId);
  const changeSet = changeSetId === undefined ? undefined : record.changeSets.get(changeSetId);
  if (changeSet === undefined) {
    return failure("YOU_INVALID_STATE", "no accepted user correction for this session", { reason: "no-user-changeset", sessionId });
  }
  const outcome = deriveLearningCandidate(
    { session, changeSet, intentFingerprint: record.intent.fingerprint, intentRef: record.intent.id },
    deps,
  );
  return { ok: true, value: { stored: false, outcome } };
}
