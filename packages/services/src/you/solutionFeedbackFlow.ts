// YOU Solution service — feedback / evidence / deterministic improvement
// flow (docs/you/OPERATOR_ACCEPTANCE.md "Feedback loop").

import type { OpaqueId } from "@zcode/shared";
import {
  createConsentReference,
  createEvidenceRequestForFeedback,
  createFeedbackRequest,
  transitionEvidence,
  transitionFeedback,
  validateSelectorTarget,
} from "../../../shared/src/you/feedback.js";
import { computeQualityDeltas, deficiencyClassForCategory, FIXTURE_EVIDENCE_WEIGHT, proposeImprovementOperations } from "../../../shared/src/you/quality.js";
import { proposeAndAccept } from "./solutionLedgerOps.js";
import type {
  FeedbackIntakeInput,
  ImprovementOutcome,
  SolutionRecord,
  SolutionServiceDeps,
  SolutionServiceResult,
} from "./solutionServiceTypes.js";
import { failure } from "./solutionServiceTypes.js";

/** Submits canonical feedback targeting a selector of the current version. */
export function submitFeedbackOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  input: FeedbackIntakeInput,
): SolutionServiceResult<{ readonly feedback: import("@zcode/shared").FeedbackRequest }> {
  const current = record.chain.current();
  if (!validateSelectorTarget(input.targetRef, current.state)) {
    return failure("YOU_INVALID_STATE", "feedback target does not resolve in the current version", {
      reason: "unknown-selector-target",
      selectorKind: input.targetRef.kind,
    });
  }
  const feedback = createFeedbackRequest(
    {
      scope: input.scope ?? "USER",
      targetRef: input.targetRef,
      category: input.category,
      userComment: input.userComment,
      sourceSolutionVersionId: current.id,
      requestedAction: input.requestedAction,
      consent: input.consent ?? createConsentReference("unknown", false),
    },
    deps,
  );
  record.feedback.set(feedback.id, feedback);
  record.ledger.append({
    type: "feedback-submitted",
    subjectRef: feedback.id,
    generator: "user",
    payload: { feedbackRequestId: feedback.id, category: feedback.category, scope: feedback.scope, actor: "user" },
  });
  record.runtime.notify({ type: "feedback_submitted", feedbackRequestId: feedback.id });
  return { ok: true, value: { feedback } };
}

/** Derives a targeted EvidenceRequest for the feedback deficiency. */
export function requestEvidenceOp(
  record: SolutionRecord,
  deps: SolutionServiceDeps,
  feedbackId: OpaqueId,
): SolutionServiceResult<{ readonly evidence: import("@zcode/shared").EvidenceRequest }> {
  const feedback = record.feedback.get(feedbackId);
  if (feedback === undefined) {
    return failure("YOU_INVALID_STATE", "unknown feedback request", { reason: "unknown-feedback", feedbackId });
  }
  const evidence = createEvidenceRequestForFeedback(feedback, deps);
  record.evidence.set(evidence.id, evidence);
  record.evidenceToFeedback.set(evidence.id, feedbackId);
  record.ledger.append({
    type: "evidence-requested",
    subjectRef: evidence.id,
    payload: {
      evidenceRequestId: evidence.id,
      feedbackRequestId: feedbackId,
      targetDeficiency: evidence.targetDeficiency,
      evidenceType: evidence.evidenceType,
    },
  });
  record.runtime.notify({ type: "evidence_requested", evidenceRequestId: evidence.id });
  return { ok: true, value: { evidence } };
}

/** Attaches deterministic fixture evidence (Phase-0 capture stand-in). */
export function provideFixtureEvidenceOp(
  record: SolutionRecord,
  evidenceId: OpaqueId,
): SolutionServiceResult<{ readonly evidence: import("@zcode/shared").EvidenceRequest }> {
  const evidence = record.evidence.get(evidenceId);
  if (evidence === undefined) {
    return failure("YOU_INVALID_STATE", "unknown evidence request", { reason: "unknown-evidence", evidenceId });
  }
  const provided = transitionEvidence(evidence, "provided");
  record.evidence.set(evidenceId, provided);
  record.ledger.append({
    type: "evidence-provided",
    subjectRef: evidenceId,
    generator: "fixture",
    payload: { evidenceRequestId: evidenceId, evidenceType: "fixture", simulated: true },
  });
  return { ok: true, value: { evidence: provided } };
}

/** Deterministic improvement: exact quality delta, new immutable version. */
export function improveFromEvidenceOp(
  record: SolutionRecord,
  feedbackId: OpaqueId,
): SolutionServiceResult<ImprovementOutcome> {
  const feedback = record.feedback.get(feedbackId);
  if (feedback === undefined) {
    return failure("YOU_INVALID_STATE", "unknown feedback request", { reason: "unknown-feedback", feedbackId });
  }
  const evidenceId = [...record.evidenceToFeedback.entries()]
    .filter(([id, owner]) => owner === feedbackId && record.evidence.get(id)?.status === "provided")
    .map(([id]) => id)
    .sort()[0];
  if (evidenceId === undefined) {
    return failure("YOU_INVALID_STATE", "no provided evidence for feedback", { reason: "missing-evidence", feedbackId });
  }
  const evidence = record.evidence.get(evidenceId);
  if (evidence === undefined) {
    return failure("YOU_INVALID_STATE", "evidence record missing", { reason: "missing-evidence-record", evidenceId });
  }
  const current = record.chain.current();
  const deficiencyClass = deficiencyClassForCategory(feedback.category);
  const operations = proposeImprovementOperations(current.state.quality, deficiencyClass, {
    evidenceWeight: FIXTURE_EVIDENCE_WEIGHT,
  });
  if (operations.length === 0) {
    return failure("YOU_INVALID_STATE", "deficiency already at quality ceiling", { reason: "quality-ceiling", deficiencyClass });
  }
  const applied = proposeAndAccept(record, {
    baseVersionId: current.id,
    operations,
    intentRef: record.intent.id,
    authorType: "fixture",
    targetRef: feedback.targetRef,
    evidenceRefs: [evidenceId],
    changePayload: { simulated: true, authorType: "fixture", addressesFeedbackId: feedbackId },
    versionPayload: { simulated: true },
    acceptPayload: {
      addressesFeedbackId: feedbackId,
      feedbackStatusAfter: "addressed",
      addressesEvidenceId: evidenceId,
      evidenceStatusAfter: "fulfilled",
    },
  });
  if (applied === null) {
    return failure("YOU_INVALID_STATE", "improvement changeset was rejected", { reason: "improvement-failed", feedbackId });
  }
  const addressed = transitionFeedback(feedback, "addressed");
  record.feedback.set(feedbackId, addressed);
  const fulfilled = transitionEvidence(evidence, "fulfilled");
  record.evidence.set(evidenceId, fulfilled);
  return {
    ok: true,
    value: {
      before: current.state.quality,
      after: applied.version.state.quality,
      deltas: computeQualityDeltas(current.state.quality, applied.version.state.quality),
      version: applied.version,
      changeSet: applied.changeSet,
      feedback: addressed,
      evidence: fulfilled,
    },
  };
}
