// YOU W6A learning fixture scenario — consent-authority wiring prologue.
//
// The deterministic wiring that provides the learning plane's consent
// authority (the W5A precedent: the scenario wires the REAL wave-2
// EvidenceService and shares nothing but typed seams with the learning
// service):
//
//   learning consent policy registered + granted (purposes cover
//   "learning"; learning reuse permitted) -> one learning-evidence
//   record captured under the granted instrument (its content-addressed
//   contentRef becomes the scenario's signal evidence) -> the consent
//   port over the public evidence API (no second consent path) ->
//   invalid-signal refusals (unknown kind; lowercase scope — typed
//   YOU_LEARNING_SIGNAL_INVALID, stateless, no state change).
//
// Every step is deterministic with recorded facts (FIXTURES.md laws);
// fixture evidence stays `simulated: true` (truth law). The learning
// service is created here because the wiring steps drive it; the
// scenario runner continues from the returned services.

import type { OpaqueId } from "@zcode/shared";
import { projectRetention } from "../../../shared/src/you/evidenceRetention.js";
import { createEvidenceService, type EvidenceService } from "./evidenceService.js";
import { createLearningService, type LearningService } from "./learningService.js";
import { createEvidenceServicePort, type LearningConsentPort } from "./learningServiceTypes.js";
import {
  EVIDENCE_WIRING_SEED,
  LEARNING_SCENARIO_SEED,
  outcomeCode as outcome,
  refusalReason,
  scenarioMust as must,
  scenarioStep as step,
  type LearningScenarioOptions,
  type LearningScenarioStep,
} from "./learningFixtureScenarioTypes.js";

/** The wiring result consumed by the scenario runner. */
export interface LearningConsentWiring {
  readonly learning: LearningService;
  readonly evidence: EvidenceService;
  readonly port: LearningConsentPort;
  readonly learningConsentPolicyId: OpaqueId;
  readonly evidenceRecordId: OpaqueId;
  readonly evidenceContentRef: string;
  /** The wiring steps (the scenario trace continues after them). */
  readonly steps: readonly LearningScenarioStep[];
}

/** Wires the real wave-2 consent authority + the learning service and runs the gate refusals. */
export function wireLearningConsentAuthority(options: LearningScenarioOptions, solutionId: OpaqueId): LearningConsentWiring {
  const evidence: EvidenceService = createEvidenceService({
    workspaceIdentity: "ws-w6a-scenario-evidence",
    seed: options.evidenceSeed ?? EVIDENCE_WIRING_SEED,
  });
  const learning: LearningService = createLearningService({
    workspaceIdentity: "ws-w6a-scenario-learning",
    seed: options.learningSeed ?? LEARNING_SCENARIO_SEED,
  });

  const steps: LearningScenarioStep[] = [];

  const consentPolicy = must(
    evidence.registerConsentPolicy(solutionId, {
      purposes: ["solution-generation", "learning"],
      scope: "USER",
      operationalUse: true,
      learningReuse: true,
      retention: projectRetention(null, "scenario learning-policy retention"),
      revocable: true,
    }),
    "registerConsentPolicy",
  ).policy;
  steps.push(
    step(1, "consent-policy-registered", {
      policyId: consentPolicy.id,
      scope: consentPolicy.scope,
      learningReuse: consentPolicy.learningReuse,
      state: evidence.consentStateOf(solutionId, consentPolicy.id),
    }),
  );

  must(evidence.grantConsent(solutionId, consentPolicy.id), "grantConsent");
  steps.push(
    step(2, "learning-consent-granted", {
      policyId: consentPolicy.id,
      state: evidence.consentStateOf(solutionId, consentPolicy.id),
    }),
  );

  const evidenceRecord = must(
    evidence.recordEvidence(solutionId, {
      evidenceRequestId: null,
      captureSessionId: null,
      evidenceType: "document",
      modality: "document",
      privacyClass: "learning-artifact",
      retention: projectRetention(null, "scenario learning-evidence retention"),
      consentPolicyId: consentPolicy.id,
    }),
    "recordEvidence",
  ).record;
  steps.push(
    step(3, "learning-evidence-recorded", {
      evidenceId: evidenceRecord.id,
      contentRef: evidenceRecord.contentRef,
      simulated: evidenceRecord.simulated,
    }),
  );

  const port = createEvidenceServicePort(evidence, solutionId, [consentPolicy]);

  // -- invalid-signal refusals (stateless validators; no state change) --

  const invalidKind = learning.captureSignal(solutionId, {
    kind: "telepathy" as unknown as "feedback",
    scope: "USER",
    evidenceRefs: [evidenceRecord.contentRef],
  });
  const invalidScope = learning.captureSignal(solutionId, {
    kind: "feedback",
    scope: "user" as unknown as "USER",
    evidenceRefs: [evidenceRecord.contentRef],
  });
  steps.push(
    step(4, "invalid-signals-refused", {
      kindOutcome: outcome(invalidKind),
      kindReason: refusalReason(invalidKind),
      scopeOutcome: outcome(invalidScope),
      scopeReason: refusalReason(invalidScope),
      signalCount: learning.signalsOf(solutionId).length,
    }),
  );

  return {
    learning,
    evidence,
    port,
    learningConsentPolicyId: consentPolicy.id,
    evidenceRecordId: evidenceRecord.id,
    evidenceContentRef: evidenceRecord.contentRef,
    steps,
  };
}
