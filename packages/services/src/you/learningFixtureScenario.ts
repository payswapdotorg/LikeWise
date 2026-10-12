// YOU W6A learning fixture scenario — scripted, deterministic orchestration
// of the full wave-6 ladder (docs/you/WORK_ORDERS.md W6A; FIXTURES.md).
//
//   (wiring: learningFixtureWiring.ts — the real wave-2 evidence service
//   is the consent authority; invalid signals refused) -> six signal
//   captures (one per frozen kind) -> rights issuance -> candidates ->
//   validated -> usage-within-grant -> preference derivation + operator
//   seed -> outside-grant / inert / rejected / superseded / unknown /
//   scope refusals -> trajectory byte-identical replay -> consent
//   withdrawal -> post-withdrawal refusal (fail closed) -> ledger
//   readout (projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same seeds produces byte-identical traces
// (golden expectation). Fixture records stay `simulated: true` (truth
// law).

import type { OpaqueId } from "@zcode/shared";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { LearningService } from "./learningService.js";
import { wireLearningConsentAuthority } from "./learningFixtureWiring.js";
import {
  LEARNING_SCENARIO_SOLUTION_ID,
  outcomeCode as outcome,
  refusalReason,
  SCENARIO_OPERATOR_PREFERENCE_KEY,
  SCENARIO_OPERATOR_PREFERENCE_SCOPE,
  SCENARIO_OPERATOR_PREFERENCE_VALUE,
  SCENARIO_PREFERENCE_KEY,
  SCENARIO_PREFERENCE_VALUE,
  SCENARIO_SIGNAL_SPECS,
  SCENARIO_TRAJECTORY_STEP_COUNT,
  scenarioMust as must,
  scenarioStep as step,
  shortHash,
  type LearningScenarioOptions,
  type LearningScenarioStep,
  type LearningScenarioTrace,
} from "./learningFixtureScenarioTypes.js";

/**
 * Runs the full scripted learning scenario against freshly created
 * services (the wave-2 evidence service as the consent authority; the
 * learning service on the scenario seed). Deterministic: same seeds +
 * same options => identical trace.
 */
export function runLearningFixtureScenario(options: LearningScenarioOptions = {}): LearningScenarioTrace {
  const solutionId = options.solutionId ?? LEARNING_SCENARIO_SOLUTION_ID;
  const wiring = wireLearningConsentAuthority(options, solutionId);
  const learning = wiring.learning;
  const port = wiring.port;
  const learningPolicyId = wiring.learningConsentPolicyId;

  const steps: LearningScenarioStep[] = [...wiring.steps];
  let stepIndex = steps.length;

  // -- six signal captures (one per frozen kind; content-addressed evidence) --

  const signalIds: OpaqueId[] = [];
  for (const spec of SCENARIO_SIGNAL_SPECS) {
    const captured = must(
      learning.captureSignal(solutionId, {
        kind: spec.kind,
        scope: spec.scope,
        subjectRef: spec.kind === "feedback" ? wiring.evidenceRecordId : null,
        evidenceRefs: [wiring.evidenceContentRef],
      }),
      `captureSignal:${spec.kind}`,
    ).signal;
    signalIds.push(captured.id);
    steps.push(
      step((stepIndex += 1), "signal-captured", {
        signalId: captured.id,
        kind: captured.kind,
        scope: captured.scope,
        subjectRef: captured.subjectRef ?? "",
        evidenceCount: captured.evidenceRefs.length,
        capturedAt: captured.capturedAt,
        simulated: captured.simulated,
      }),
    );
  }

  // -- rights issuance through the consent port (no second consent path) --

  const personalizationRights = must(
    learning.issueRights(port, { consentRef: learningPolicyId, usage: ["personalization", "tool-selection"] }),
    "issueRights:personalization",
  ).rights;
  const pipelineRights = must(learning.issueRights(port, { consentRef: learningPolicyId, usage: ["tool-selection"] }), "issueRights:pipeline").rights;
  const supersedeRights = must(
    learning.issueRights(port, { consentRef: learningPolicyId, usage: ["pipeline-improvement"] }),
    "issueRights:supersede",
  ).rights;
  steps.push(
    step((stepIndex += 1), "rights-issued", {
      consentRef: learningPolicyId,
      personalizationHash: shortHash(personalizationRights.consentHash),
      pipelineUsageCount: pipelineRights.usage.length,
      supersedeUsage: supersedeRights.usage[0] ?? "",
    }),
  );

  // -- open candidates over the six signals --

  const contents = signalIds.map((_, index) =>
    must(learning.synthesizeLearningContent(solutionId, { seedText: `w6a-scenario-content-${index}` }), `synthesizeContent:${index}`),
  );
  const rightsPerRecord = [personalizationRights, pipelineRights, null, null, supersedeRights, supersedeRights];
  const recordIds: OpaqueId[] = [];
  for (let index = 0; index < signalIds.length; index += 1) {
    const signalId = signalIds[index];
    const content = contents[index];
    if (signalId === undefined || content === undefined) {
      throw new Error(`scenario wiring incomplete at record ${index}`);
    }
    const opened = must(
      learning.openCandidateRecord(solutionId, {
        signalId,
        contentRef: content.contentRef,
        contentHash: content.contentHash,
        rights: rightsPerRecord[index] ?? null,
      }),
      `openCandidateRecord:${index}`,
    ).record;
    recordIds.push(opened.id);
  }
  steps.push(
    step((stepIndex += 1), "candidates-opened", {
      recordCount: recordIds.length,
      candidateStatus: "candidate",
      inertCount: rightsPerRecord.filter((rights) => rights === null).length,
    }),
  );

  const [feedbackRecordId, takeoverRecordId, editRecordId, expertRecordId, intentRecordId, gapRecordId] = recordIds;
  if (
    feedbackRecordId === undefined || takeoverRecordId === undefined || editRecordId === undefined ||
    expertRecordId === undefined || intentRecordId === undefined || gapRecordId === undefined
  ) {
    throw new Error("scenario expected six candidate records");
  }

  // -- signal capture -> candidate -> validated (the ladder happy path) + usage within grant --

  const validated = must(learning.validateRecord(solutionId, { recordId: feedbackRecordId }), "validateRecord:feedback");
  steps.push(
    step((stepIndex += 1), "record-validated", {
      recordId: validated.record.id,
      signalId: validated.record.signalId,
      statusAfter: validated.record.status,
      contentHash: shortHash(validated.record.contentHash),
      validatedAt: validated.record.validatedAt,
      usageCount: validated.record.rights.usage.length,
      simulated: validated.record.simulated,
    }),
  );
  const used = must(learning.useRecord(solutionId, port, { recordId: feedbackRecordId, usage: "personalization" }), "useRecord:personalization");
  steps.push(
    step((stepIndex += 1), "record-used-within-grant", { recordId: used.record.id, usage: used.usage, withinGrant: true }),
  );

  // -- preference derivation (lineage) + operator-seeded preference (null lineage) --

  const derivedPreference = must(
    learning.derivePreference(solutionId, port, { recordId: feedbackRecordId, key: SCENARIO_PREFERENCE_KEY, value: SCENARIO_PREFERENCE_VALUE }),
    "derivePreference",
  ).preference;
  steps.push(
    step((stepIndex += 1), "preference-derived", {
      preferenceId: derivedPreference.id,
      scope: derivedPreference.scope,
      key: derivedPreference.key,
      value: derivedPreference.value,
      derivedFromRecordId: derivedPreference.derivedFromRecordId ?? "",
      updatedAt: derivedPreference.updatedAt,
    }),
  );
  const operatorPreference = must(
    learning.setOperatorPreference(solutionId, {
      scope: SCENARIO_OPERATOR_PREFERENCE_SCOPE,
      key: SCENARIO_OPERATOR_PREFERENCE_KEY,
      value: SCENARIO_OPERATOR_PREFERENCE_VALUE,
    }),
    "setOperatorPreference",
  ).preference;
  steps.push(
    step((stepIndex += 1), "operator-preference-seeded", {
      preferenceId: operatorPreference.id,
      scope: operatorPreference.scope,
      key: operatorPreference.key,
      derivedFromRecordId: operatorPreference.derivedFromRecordId ?? "",
    }),
  );

  // -- usage-outside-grant refusal (manual-takeover record: tool-selection only) --

  must(learning.validateRecord(solutionId, { recordId: takeoverRecordId }), "validateRecord:takeover");
  const usageOutsideGrant = learning.useRecord(solutionId, port, { recordId: takeoverRecordId, usage: "personalization" });
  steps.push(
    step((stepIndex += 1), "usage-outside-grant-refused", {
      recordId: takeoverRecordId,
      usage: "personalization",
      outcome: outcome(usageOutsideGrant),
      reason: refusalReason(usageOutsideGrant),
    }),
  );
  const derivationOutsideGrant = learning.derivePreference(solutionId, port, { recordId: takeoverRecordId, key: SCENARIO_PREFERENCE_KEY, value: "should-not-project" });
  steps.push(
    step((stepIndex += 1), "derivation-outside-grant-refused", {
      recordId: takeoverRecordId,
      outcome: outcome(derivationOutsideGrant),
      reason: refusalReason(derivationOutsideGrant),
    }),
  );

  // -- rights-inert refusal (edit-session record opened WITHOUT rights) --

  const editValidated = must(learning.validateRecord(solutionId, { recordId: editRecordId }), "validateRecord:edit");
  const inertUse = learning.useRecord(solutionId, port, { recordId: editRecordId, usage: "tool-selection" });
  steps.push(
    step((stepIndex += 1), "inert-record-refused", {
      recordId: editRecordId,
      statusAfter: editValidated.record.status,
      outcome: outcome(inertUse),
      reason: refusalReason(inertUse),
    }),
  );

  // -- rejected path (expert-intervention candidate -> learning-record-rejected) --

  const rejected = must(learning.rejectRecord(solutionId, { recordId: expertRecordId, reason: "fixture-rejected-learning" }), "rejectRecord:expert");
  steps.push(
    step((stepIndex += 1), "record-rejected", {
      recordId: rejected.record.id,
      signalId: rejected.record.signalId,
      statusAfter: rejected.record.status,
      reason: "fixture-rejected-learning",
      validatedAt: rejected.record.validatedAt,
    }),
  );
  const rejectedUse = learning.useRecord(solutionId, port, { recordId: expertRecordId, usage: "personalization" });
  steps.push(
    step((stepIndex += 1), "rejected-record-unusable", {
      recordId: expertRecordId,
      outcome: outcome(rejectedUse),
      reason: refusalReason(rejectedUse),
    }),
  );

  // -- superseded path (repeated-intent validated, then superseded by the capability-gap validation) --

  const supersededFirst = must(learning.validateRecord(solutionId, { recordId: intentRecordId }), "validateRecord:intent");
  const successor = must(learning.validateRecord(solutionId, { recordId: gapRecordId, supersedesRecordId: intentRecordId }), "validateRecord:gap");
  steps.push(
    step((stepIndex += 1), "record-superseded", {
      supersededRecordId: intentRecordId,
      successorRecordId: gapRecordId,
      supersededStatusAfter: successor.superseded?.status ?? "",
      supersededById: successor.superseded?.supersededById ?? "",
      supersededValidatedAt: supersededFirst.record.validatedAt,
      successorStatusAfter: successor.record.status,
    }),
  );
  const successorUse = learning.useRecord(solutionId, port, { recordId: gapRecordId, usage: "pipeline-improvement" });
  const supersededUse = learning.useRecord(solutionId, port, { recordId: intentRecordId, usage: "pipeline-improvement" });
  steps.push(
    step((stepIndex += 1), "superseded-records-unusable", {
      successorOutcome: outcome(successorUse),
      successorUsage: "pipeline-improvement",
      supersededOutcome: outcome(supersededUse),
      supersededReason: refusalReason(supersededUse),
    }),
  );

  // -- unknown-record refusal (typed YOU_LEARNING_RECORD_NOT_FOUND) --

  const unknownRecord = learning.useRecord(solutionId, port, { recordId: "you_learning-record_missing00000", usage: "personalization" });
  const unknownRead = learning.recordOf(solutionId, "you_learning-record_missing00000");
  steps.push(
    step((stepIndex += 1), "unknown-record-refused", {
      useOutcome: outcome(unknownRecord),
      useReason: refusalReason(unknownRecord),
      readOutcome: outcome(unknownRead),
    }),
  );

  // -- preference-scope refusals (bad literal + scope mismatch) --

  const badLiteral = learning.setOperatorPreference(solutionId, { scope: "org" as unknown as "GLOBAL", key: "k", value: "v" });
  const scopeMismatch = learning.derivePreference(solutionId, port, {
    recordId: feedbackRecordId,
    key: SCENARIO_PREFERENCE_KEY,
    value: "should-not-project",
    scope: "TENANT",
  });
  steps.push(
    step((stepIndex += 1), "preference-scope-refused", {
      literalOutcome: outcome(badLiteral),
      literalReason: refusalReason(badLiteral),
      mismatchOutcome: outcome(scopeMismatch),
      mismatchReason: refusalReason(scopeMismatch),
    }),
  );

  // -- trajectory synthesis + record + byte-identical replay --

  const trajectorySteps = must(
    learning.synthesizeTrajectorySteps(solutionId, { seedText: "w6a-scenario-trajectory", stepCount: SCENARIO_TRAJECTORY_STEP_COUNT }),
    "synthesizeTrajectorySteps",
  ).stepRefs;
  const trajectory = must(learning.recordTrajectory(solutionId, { scope: "USER", stepRefs: trajectorySteps }), "recordTrajectory").trajectory;
  const firstReplay = must(learning.replayTrajectory(solutionId, trajectory.id), "replayTrajectory:first");
  const secondReplay = must(learning.replayTrajectory(solutionId, trajectory.id), "replayTrajectory:second");
  const replayByteIdentical =
    firstReplay.replayHash === secondReplay.replayHash && Buffer.compare(Buffer.from(firstReplay.bytes), Buffer.from(secondReplay.bytes)) === 0;
  steps.push(
    step((stepIndex += 1), "trajectory-replayed", {
      trajectoryId: trajectory.id,
      stepCount: firstReplay.stepCount,
      byteLength: firstReplay.bytes.byteLength,
      replayHash: shortHash(firstReplay.replayHash),
      replayByteIdentical,
      simulated: trajectory.simulated,
    }),
  );

  // -- consent withdrawal -> post-withdrawal usage refusal (fail closed) --

  must(wiring.evidence.withdrawConsent(solutionId, learningPolicyId), "withdrawConsent");
  steps.push(
    step((stepIndex += 1), "learning-consent-withdrawn", {
      policyId: learningPolicyId,
      state: wiring.evidence.consentStateOf(solutionId, learningPolicyId),
    }),
  );
  const postWithdrawalUse = learning.useRecord(solutionId, port, { recordId: feedbackRecordId, usage: "personalization" });
  const postWithdrawalDerivation = learning.derivePreference(solutionId, port, {
    recordId: feedbackRecordId,
    key: SCENARIO_PREFERENCE_KEY,
    value: "should-not-project",
  });
  steps.push(
    step((stepIndex += 1), "post-withdrawal-usage-refused", {
      useOutcome: outcome(postWithdrawalUse),
      useReason: refusalReason(postWithdrawalUse),
      derivationOutcome: outcome(postWithdrawalDerivation),
      derivationReason: refusalReason(postWithdrawalDerivation),
    }),
  );

  // -- ledger readout: projection == replay --

  const events = must(learning.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const ledgerHash = must(learning.ledgerHashOf(solutionId), "ledgerHashOf");
  const projection = must(learning.projectionOf(solutionId), "projectionOf");
  const replayed = LearningService.replay(events);
  const projectionMatchesReplay = stableStringify(projection) === stableStringify(replayed);
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      signalCount: Object.keys(projection.signals).length,
      recordCount: Object.keys(projection.records).length,
      validatedCount: Object.values(projection.records).filter((record) => record.status === "validated").length,
      rejectedCount: Object.values(projection.records).filter((record) => record.status === "rejected").length,
      supersededCount: Object.values(projection.records).filter((record) => record.status === "superseded").length,
      preferenceCount: Object.keys(projection.preferences).length,
      learningStoreSize: learning.contentStoreSize(),
    }),
  );

  return {
    solutionId,
    learningConsentPolicyId: learningPolicyId,
    evidenceRecordId: wiring.evidenceRecordId,
    signalIds,
    recordIds,
    validatedRecordIds: [feedbackRecordId, takeoverRecordId, editRecordId, gapRecordId],
    rejectedRecordId: expertRecordId,
    supersededRecordId: intentRecordId,
    successorRecordId: gapRecordId,
    inertRecordId: editRecordId,
    preferenceIds: [derivedPreference.id, operatorPreference.id],
    trajectoryId: trajectory.id,
    trajectoryReplayHash: firstReplay.replayHash,
    eventCount: events.length,
    ledgerHash,
    learningStoreSize: learning.contentStoreSize(),
    projectionMatchesReplay,
    steps,
  };
}

/** Canonical serialization of a trace (golden comparisons). */
export function serializeLearningScenarioTrace(trace: LearningScenarioTrace): string {
  return stableStringify(trace);
}
