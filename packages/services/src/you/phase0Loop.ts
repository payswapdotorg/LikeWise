// YOU Phase-0 loop scenario — scripted, deterministic orchestration of the
// full operator gate (docs/you/FIXTURES.md "The Phase-0 loop fixture",
// OPERATOR_ACCEPTANCE.md):
//
// intent -> Solution -> feedback -> evidence request -> deterministic
// improvement -> manual takeover -> EditSession -> export/editor ->
// re-import/diff -> learning (with permission) -> repeated intent ->
// CapabilityGap -> Arena mock.
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation).

import type { OpaqueId, SolutionPatchOperation } from "@zcode/shared";
import { createConsentReference } from "../../../shared/src/you/feedback.js";
import { seedFromString, uint32ToHex8 } from "../../../shared/src/you/rng.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import type { SolutionService } from "./solutionService.js";

export const PHASE0_LOOP_INTENT_TEXT = "YOU phase-0 operator loop: simulate a human twin for deterministic review";

export interface Phase0LoopStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface Phase0LoopTrace {
  readonly intentText: string;
  readonly intentFingerprint: string;
  readonly solutionId: OpaqueId;
  readonly finalVersionId: OpaqueId;
  readonly finalVersionNumber: number;
  readonly finalQuality: Readonly<Record<string, number>>;
  readonly learningAppliedOnRepeat: boolean;
  readonly escalationStatus: string;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly steps: readonly Phase0LoopStep[];
}

export interface Phase0LoopOptions {
  readonly intentText?: string;
}

function step(index: number, name: string, facts: Record<string, string | number | boolean>): Phase0LoopStep {
  return { step: index, name, facts };
}

/** The user's Phase-0 correction (deterministic, seed-free operations). */
export const PHASE0_TAKEOVER_OPERATIONS: readonly SolutionPatchOperation[] = [
  { op: "adjust_quality", deficiencyClass: "appearance", delta: 0.08 },
  { op: "update_environment", environment: { ambientIntensity: 0.05 } },
];

/** The simulated external editor's edit (deterministic). */
export const PHASE0_EXTERNAL_EDIT_OPERATIONS: readonly SolutionPatchOperation[] = [
  { op: "adjust_quality", deficiencyClass: "composition", delta: 0.05 },
];

/**
 * Runs the full scripted Phase-0 loop against a service instance.
 * Deterministic: same service seed + same options => identical trace.
 */
export function runPhase0LoopScenario(service: SolutionService, options: Phase0LoopOptions = {}): Phase0LoopTrace {
  const intentText = options.intentText ?? PHASE0_LOOP_INTENT_TEXT;
  const steps: Phase0LoopStep[] = [];
  let stepIndex = 0;

  const intake = service.intakeIntent({ text: intentText, displayName: "Phase-0 Operator Loop" });
  if (!intake.ok) {
    throw new Error(`phase0 loop failed at intake: ${intake.error.code}`);
  }
  const solutionId = intake.value.solution.id;
  steps.push(
    step((stepIndex += 1), "intent-intake", {
      solutionId,
      versionNumber: intake.value.version.version,
      seedFingerprint: intake.value.intent.fingerprint,
      learningApplied: intake.value.learningApplied,
    }),
  );

  const feedback = service.submitFeedback(solutionId, {
    targetRef: { kind: "quality", deficiencyClass: "geometry" },
    category: "geometry",
    userComment: "The proportions of the synthetic human look slightly off.",
    requestedAction: "improve geometry fidelity",
    consent: createConsentReference("unknown", false),
  });
  if (!feedback.ok) {
    throw new Error(`phase0 loop failed at feedback: ${feedback.error.code}`);
  }
  steps.push(step((stepIndex += 1), "feedback-submitted", { feedbackId: feedback.value.feedback.id, category: feedback.value.feedback.category }));

  const evidence = service.requestEvidence(solutionId, feedback.value.feedback.id);
  if (!evidence.ok) {
    throw new Error(`phase0 loop failed at evidence request: ${evidence.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "evidence-requested", {
      evidenceId: evidence.value.evidence.id,
      targetDeficiency: evidence.value.evidence.targetDeficiency,
      evidenceType: evidence.value.evidence.evidenceType,
    }),
  );

  const provided = service.provideFixtureEvidence(solutionId, evidence.value.evidence.id);
  if (!provided.ok) {
    throw new Error(`phase0 loop failed at evidence provision: ${provided.error.code}`);
  }
  steps.push(step((stepIndex += 1), "evidence-provided", { evidenceId: provided.value.evidence.id, status: provided.value.evidence.status }));

  const improvement = service.improveFromEvidence(solutionId, feedback.value.feedback.id);
  if (!improvement.ok) {
    throw new Error(`phase0 loop failed at improvement: ${improvement.error.code}`);
  }
  const geometryDelta = improvement.value.deltas.geometry ?? 0;
  steps.push(
    step((stepIndex += 1), "deterministic-improvement", {
      versionNumber: improvement.value.version.version,
      deficiencyClass: "geometry",
      before: improvement.value.before.geometry ?? 0,
      after: improvement.value.after.geometry ?? 0,
      delta: geometryDelta,
      feedbackStatus: improvement.value.feedback.status,
      evidenceStatus: improvement.value.evidence.status,
    }),
  );

  const takeover = service.beginTakeover(solutionId, {
    mode: "correct",
    evidenceMode: "observed",
    consent: createConsentReference("granted", true),
  });
  if (!takeover.ok) {
    throw new Error(`phase0 loop failed at takeover: ${takeover.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "takeover-opened", {
      editSessionId: takeover.value.session.id,
      mode: takeover.value.session.mode,
      evidenceMode: takeover.value.session.evidenceMode,
      learningPermission: takeover.value.session.learningPermission.learningPermission,
    }),
  );

  const correction = service.closeTakeoverWithCorrection(solutionId, takeover.value.session.id, {
    operations: PHASE0_TAKEOVER_OPERATIONS,
  });
  if (!correction.ok) {
    throw new Error(`phase0 loop failed at correction: ${correction.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "takeover-correction-accepted", {
      versionNumber: correction.value.version.version,
      changeSetId: correction.value.changeSet.id,
      qualityFieldsChanged: Object.keys(correction.value.diff.qualityDeltas).length,
      environmentFieldsChanged: correction.value.diff.environmentChanged.length,
      artifactId: correction.value.artifact.id,
    }),
  );

  const learning = service.deriveLearningFromTakeover(solutionId, takeover.value.session.id);
  if (!learning.ok) {
    throw new Error(`phase0 loop failed at learning derivation: ${learning.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "learning-derived", {
      stored: learning.value.stored,
      outcome: learning.value.outcome.ok ? "candidate" : learning.value.outcome.code,
      scope: learning.value.outcome.ok ? learning.value.outcome.candidate.scope : "",
    }),
  );

  const editor = service.recommendEditor(solutionId);
  if (!editor.ok) {
    throw new Error(`phase0 loop failed at editor recommendation: ${editor.error.code}`);
  }
  steps.push(step((stepIndex += 1), "editor-recommended", { editorId: editor.value.editorId, exportFormat: editor.value.exportFormat }));

  const exported = service.exportSolution(solutionId);
  if (!exported.ok) {
    throw new Error(`phase0 loop failed at export: ${exported.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "artifact-exported", {
      artifactId: exported.value.artifact.id,
      contentHash: exported.value.artifact.contentHash,
      format: exported.value.artifact.format,
      simulated: exported.value.artifact.manifest.simulated,
    }),
  );

  const reImported = service.simulateExternalEditAndReImport(solutionId, exported.value.artifact.id, {
    operations: PHASE0_EXTERNAL_EDIT_OPERATIONS,
  });
  if (!reImported.ok) {
    throw new Error(`phase0 loop failed at re-import: ${reImported.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "external-edit-reimported", {
      editedArtifactId: reImported.value.editedArtifact.id,
      versionNumber: reImported.value.version.version,
      qualityFieldsChanged: Object.keys(reImported.value.diff.qualityDeltas).length,
      environmentFieldsChanged: reImported.value.diff.environmentChanged.length,
      authorType: reImported.value.changeSet.authorType,
    }),
  );

  const repeated = service.intakeIntent({ text: intentText, displayName: "Phase-0 Operator Loop" });
  if (!repeated.ok) {
    throw new Error(`phase0 loop failed at repeated intent: ${repeated.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "repeated-intent", {
      solutionId: repeated.value.solution.id,
      versionNumber: repeated.value.version.version,
      learningApplied: repeated.value.learningApplied,
    }),
  );

  const gap = service.recordFixtureCapabilityGap(solutionId, {
    category: "TOOL_GAP",
    confidence: 0.9,
    attemptedStrategies: [
      { strategy: "fixture-tool-attempt", outcome: "failed", evidenceRef: null },
      { strategy: "quality-delta-fallback", outcome: "partial", evidenceRef: null },
    ],
  });
  if (!gap.ok) {
    throw new Error(`phase0 loop failed at gap recording: ${gap.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "capability-gap-recorded", {
      capabilityGapId: gap.value.gap.id,
      category: gap.value.gap.category,
      confidence: gap.value.gap.confidence,
      escalationEligibility: gap.value.gap.escalationEligibility,
      simulated: true,
    }),
  );

  const escalation = service.escalateGapToArenaMock(solutionId, gap.value.gap.id);
  if (!escalation.ok) {
    throw new Error(`phase0 loop failed at escalation: ${escalation.error.code}`);
  }
  const escalationRef = escalation.value.gap.arenaEscalationRef;
  steps.push(
    step((stepIndex += 1), "arena-escalation-delivered", {
      escalationId: escalationRef?.escalationId ?? "",
      status: escalationRef?.status ?? "",
      resultType: escalationRef?.expertResult?.resultType ?? "",
      simulated: true,
    }),
  );

  const applied = service.applyArenaResult(solutionId, gap.value.gap.id);
  if (!applied.ok) {
    throw new Error(`phase0 loop failed at arena application: ${applied.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "arena-result-applied", {
      versionNumber: applied.value.version.version,
      changeSetId: applied.value.changeSet.id,
      authorType: applied.value.changeSet.authorType,
      escalationStatus: applied.value.gap.arenaEscalationRef?.status ?? "",
    }),
  );

  const events = service.ledgerEventsOf(solutionId);
  if (!events.ok) {
    throw new Error(`phase0 loop failed at ledger read: ${events.error.code}`);
  }
  const projection = service.projectionOf(solutionId);
  if (!projection.ok) {
    throw new Error(`phase0 loop failed at projection: ${projection.error.code}`);
  }

  return {
    intentText,
    intentFingerprint: uint32ToHex8(seedFromString(intentText)),
    solutionId,
    finalVersionId: applied.value.version.id,
    finalVersionNumber: applied.value.version.version,
    finalQuality: applied.value.version.state.quality,
    learningAppliedOnRepeat: repeated.value.learningApplied,
    escalationStatus: applied.value.gap.arenaEscalationRef?.status ?? "",
    eventCount: events.value.length,
    ledgerHash: stableContentHash(events.value),
    steps,
  };
}
