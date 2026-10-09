// YOU W2A evidence fixture scenario — scripted, deterministic orchestration
// of the evidence plane (docs/you/FIXTURES.md: seeded synthetic evidence
// payloads, golden expectations, byte-identical replay on re-run):
//
//   consent-policy-registered -> capture-session-opened ->
//   capture-consent-granted -> evidence-recorded (image / video / depth /
//   measurement modalities) -> capture-session-completed (session-only
//   content removed) -> evidence-reviewed (delete-after-review content
//   removed) -> evidence-review-superseded -> learning consent granted ->
//   learning check -> capture consent withdrawn -> processing check
//   (withdrawal blocks future use) -> retention read outcomes.
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seed produces byte-identical
// traces (golden expectation).

import type { EvidenceRequest, OpaqueId } from "@zcode/shared";
import { deleteAfterReviewRetention, projectRetention, sessionOnlyRetention, tenantRetention } from "../../../shared/src/you/evidenceRetention.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createEvidenceService, type EvidenceService } from "./evidenceService.js";

export const EVIDENCE_SCENARIO_SOLUTION_ID = "you_w2a_scenario_solution01";
export const EVIDENCE_SCENARIO_REQUEST_ID = "you_w2a_scenario_request01";
export const EVIDENCE_SCENARIO_SEED = "you-w2a-evidence-scenario";

/** Fixed far-future deleteAfter so the depth record never expires mid-scenario. */
const SCENARIO_FAR_FUTURE_DELETE_AFTER = "2099-01-01T00:00:00.000Z";

const scenarioRequest: EvidenceRequest = Object.freeze({
  id: EVIDENCE_SCENARIO_REQUEST_ID,
  targetDeficiency: "identity",
  evidenceType: "reference-image",
  preferredFraming: "synthetic reference framing, deterministic seed, medium quality",
  reason: 'resolve deficiency "identity" for the W2A scenario',
  privacyRequirements: "fixture-only; no biometric data; no retention beyond session",
  retention: "session-only",
  status: "requested",
});

export const SCENARIO_CAPTURE_MODALITIES = ["image", "video", "depth", "measurement"] as const;

export interface EvidenceScenarioStep {
  readonly step: number;
  readonly name: string;
  readonly facts: Readonly<Record<string, string | number | boolean>>;
}

export interface EvidenceScenarioTrace {
  readonly solutionId: OpaqueId;
  readonly sessionId: OpaqueId;
  readonly captureConsentPolicyId: OpaqueId;
  readonly learningConsentPolicyId: OpaqueId;
  readonly records: Readonly<Record<string, { readonly id: OpaqueId; readonly contentHash: string }>>;
  readonly finalSessionStatus: string;
  readonly finalCaptureConsentState: string;
  readonly finalLearningConsentState: string;
  readonly storeSize: number;
  readonly eventCount: number;
  readonly ledgerHash: string;
  readonly steps: readonly EvidenceScenarioStep[];
}

export interface EvidenceScenarioOptions {
  readonly solutionId?: OpaqueId;
}

function step(index: number, name: string, facts: Record<string, string | number | boolean>): EvidenceScenarioStep {
  return { step: index, name, facts };
}

function expectSessionStatus(service: EvidenceService, solutionId: OpaqueId, sessionId: OpaqueId): string {
  const session = service.captureSessionOf(solutionId, sessionId);
  if (!session.ok) {
    throw new Error(`scenario failed to read capture session: ${session.error.code}`);
  }
  return session.value.status;
}

function outcomeCode(result: { readonly ok: boolean; readonly error?: { readonly code: string } }): string {
  return result.ok ? "OK" : (result.error?.code ?? "ERROR");
}

/**
 * Runs the full scripted evidence scenario against a service instance.
 * Deterministic: same service seed + same options => identical trace.
 */
export function runEvidenceFixtureScenario(
  service: EvidenceService,
  options: EvidenceScenarioOptions = {},
): EvidenceScenarioTrace {
  const solutionId = options.solutionId ?? EVIDENCE_SCENARIO_SOLUTION_ID;
  const steps: EvidenceScenarioStep[] = [];
  let stepIndex = 0;

  const learning = service.registerConsentPolicy(solutionId, {
    purposes: ["solution-generation", "learning"],
    scope: "USER",
    operationalUse: true,
    learningReuse: true,
    retention: projectRetention(null, "scenario learning-policy retention"),
    revocable: true,
  });
  if (!learning.ok) {
    throw new Error(`scenario failed at learning policy: ${learning.error.code}`);
  }
  const learningPolicyId = learning.value.policy.id;
  steps.push(
    step((stepIndex += 1), "consent-policy-registered", {
      policyId: learningPolicyId,
      learningReuse: true,
      state: service.consentStateOf(solutionId, learningPolicyId),
    }),
  );

  const opened = service.openCaptureSession(solutionId, {
    evidenceRequest: scenarioRequest,
    scope: "USER",
    consent: {
      purposes: ["solution-generation", "quality-improvement"],
      operationalUse: true,
      learningReuse: false,
      retention: sessionOnlyRetention("scenario capture-session consent"),
      revocable: true,
    },
    guideSpec: {
      targetDeficiency: scenarioRequest.targetDeficiency,
      preferredFraming: scenarioRequest.preferredFraming,
      requiredModalities: [...SCENARIO_CAPTURE_MODALITIES],
    },
  });
  if (!opened.ok) {
    throw new Error(`scenario failed at capture session: ${opened.error.code}`);
  }
  const sessionId = opened.value.session.id;
  const capturePolicyId = opened.value.consentPolicyId;
  steps.push(
    step((stepIndex += 1), "capture-session-opened", {
      sessionId,
      policyId: capturePolicyId,
      status: opened.value.session.status,
      stepCount: opened.value.session.guideSteps.length,
      evidenceRequestId: opened.value.session.evidenceRequestId ?? "",
    }),
  );

  const granted = service.grantConsent(solutionId, capturePolicyId);
  if (!granted.ok) {
    throw new Error(`scenario failed at consent grant: ${granted.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "capture-consent-granted", {
      policyId: capturePolicyId,
      state: granted.value.reference.state,
      sessionStatus: expectSessionStatus(service, solutionId, sessionId),
    }),
  );

  const recordSpecs = [
    {
      key: "image",
      modality: "image" as const,
      privacyClass: "sensitive-media" as const,
      retention: sessionOnlyRetention("scenario session-only image"),
      policyId: capturePolicyId,
      sessionBound: true,
    },
    {
      key: "video",
      modality: "video" as const,
      privacyClass: "sensitive-media" as const,
      retention: deleteAfterReviewRetention("scenario delete-after-review video"),
      policyId: capturePolicyId,
      sessionBound: true,
    },
    {
      key: "depth",
      modality: "depth" as const,
      privacyClass: "project-artifact" as const,
      retention: projectRetention(SCENARIO_FAR_FUTURE_DELETE_AFTER, "scenario project-retention depth"),
      policyId: capturePolicyId,
      sessionBound: true,
    },
    {
      key: "measurement",
      modality: "measurement" as const,
      privacyClass: "project-artifact" as const,
      retention: tenantRetention(null, "scenario tenant-retention measurement"),
      policyId: learningPolicyId,
      sessionBound: false,
    },
  ];
  const records: Record<string, { id: OpaqueId; contentHash: string }> = {};
  for (const spec of recordSpecs) {
    const recorded = service.recordEvidence(solutionId, {
      evidenceRequestId: spec.sessionBound ? EVIDENCE_SCENARIO_REQUEST_ID : null,
      captureSessionId: spec.sessionBound ? sessionId : null,
      evidenceType: "fixture",
      modality: spec.modality,
      privacyClass: spec.privacyClass,
      retention: spec.retention,
      consentPolicyId: spec.policyId,
    });
    if (!recorded.ok) {
      throw new Error(`scenario failed at record ${spec.key}: ${recorded.error.code}`);
    }
    records[spec.key] = { id: recorded.value.record.id, contentHash: recorded.value.record.contentHash };
    steps.push(
      step((stepIndex += 1), `evidence-recorded-${spec.key}`, {
        evidenceId: recorded.value.record.id,
        modality: spec.modality,
        privacyClass: spec.privacyClass,
        retentionPolicy: spec.retention.policy,
        contentHash: recorded.value.record.contentHash,
        simulated: recorded.value.record.simulated,
      }),
    );
  }

  const completed = service.completeCaptureSession(solutionId, sessionId);
  if (!completed.ok) {
    throw new Error(`scenario failed at session completion: ${completed.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "capture-session-completed", {
      sessionId,
      status: completed.value.session.status,
      sessionOnlyEvidenceExpired: completed.value.expiredEvidenceIds.length,
      imageReadAfterCompletion: outcomeCode(service.readEvidenceContent(solutionId, records.image?.id ?? "")),
    }),
  );

  const videoId = records.video?.id ?? "";
  const reviewed = service.reviewEvidence(solutionId, videoId, {
    reviewerType: "user",
    outcome: "accepted",
    notes: "scenario first review: deterministic observations accepted",
  });
  if (!reviewed.ok) {
    throw new Error(`scenario failed at review: ${reviewed.error.code}`);
  }
  const firstReviewId = reviewed.value.review.id;
  steps.push(
    step((stepIndex += 1), "evidence-reviewed", {
      reviewId: firstReviewId,
      evidenceId: videoId,
      status: reviewed.value.review.status,
      contentRemovedAfterReview: reviewed.value.contentRemovedAfterReview,
      videoReadAfterReview: outcomeCode(service.readEvidenceContent(solutionId, videoId)),
    }),
  );

  const superseded = service.reviewEvidence(solutionId, videoId, {
    reviewerType: "user",
    outcome: "rejected",
    notes: "scenario re-review: superseded outcome rejected",
    supersedesReviewId: firstReviewId,
  });
  if (!superseded.ok) {
    throw new Error(`scenario failed at supersession: ${superseded.error.code}`);
  }
  steps.push(
    step((stepIndex += 1), "evidence-review-superseded", {
      reviewId: superseded.value.review.id,
      supersedesReviewId: firstReviewId,
      oldReviewStatus: service.reviewsOfEvidence(solutionId, videoId)[0]?.status ?? "",
      status: superseded.value.review.status,
    }),
  );

  const learningGranted = service.grantConsent(solutionId, learningPolicyId);
  if (!learningGranted.ok) {
    throw new Error(`scenario failed at learning grant: ${learningGranted.error.code}`);
  }
  const measurementId = records.measurement?.id ?? "";
  const learningCheck = service.checkLearning(solutionId, measurementId);
  steps.push(
    step((stepIndex += 1), "learning-consent-granted", {
      policyId: learningPolicyId,
      state: learningGranted.value.reference.state,
      learningAllowed: learningCheck.ok ? learningCheck.value.allowed : false,
      learningReason: learningCheck.ok ? learningCheck.value.reason : "unknown-evidence",
    }),
  );

  const withdrawn = service.withdrawConsent(solutionId, capturePolicyId);
  if (!withdrawn.ok) {
    throw new Error(`scenario failed at withdrawal: ${withdrawn.error.code}`);
  }
  const processingCheck = service.checkProcessing(solutionId, videoId, "solution-generation");
  steps.push(
    step((stepIndex += 1), "capture-consent-withdrawn", {
      policyId: capturePolicyId,
      state: withdrawn.value.reference.state,
      processingAllowed: processingCheck.ok ? processingCheck.value.outcome.allowed : false,
      processingReason: processingCheck.ok ? processingCheck.value.outcome.reason : "unknown-evidence",
    }),
  );

  const depthId = records.depth?.id ?? "";
  const depthRead = service.readEvidenceContent(solutionId, depthId);
  const measurementRead = service.readEvidenceContent(solutionId, measurementId);
  steps.push(
    step((stepIndex += 1), "retention-read-outcomes", {
      videoRead: outcomeCode(service.readEvidenceContent(solutionId, videoId)),
      imageRead: outcomeCode(service.readEvidenceContent(solutionId, records.image?.id ?? "")),
      depthRead: depthRead.ok ? "OK" : depthRead.error.code,
      depthHashVerified: depthRead.ok ? depthRead.value.contentHash === (records.depth?.contentHash ?? "") : false,
      measurementRead: measurementRead.ok ? "OK" : measurementRead.error.code,
      measurementHashVerified: measurementRead.ok
        ? measurementRead.value.contentHash === (records.measurement?.contentHash ?? "")
        : false,
    }),
  );

  const events = service.ledgerEventsOf(solutionId);
  const ledgerHash = service.ledgerHashOf(solutionId);
  if (!events.ok || !ledgerHash.ok) {
    throw new Error("scenario failed at ledger readout");
  }
  return {
    solutionId,
    sessionId,
    captureConsentPolicyId: capturePolicyId,
    learningConsentPolicyId: learningPolicyId,
    records,
    finalSessionStatus: expectSessionStatus(service, solutionId, sessionId),
    finalCaptureConsentState: service.consentStateOf(solutionId, capturePolicyId),
    finalLearningConsentState: service.consentStateOf(solutionId, learningPolicyId),
    storeSize: service.contentStoreSize(),
    eventCount: events.value.length,
    ledgerHash: ledgerHash.value,
    steps,
  };
}

/** Convenience: builds a scenario-configured service. */
export function createScenarioEvidenceService(seed: string | number = EVIDENCE_SCENARIO_SEED): EvidenceService {
  return createEvidenceService({ workspaceIdentity: "ws-w2a-scenario", seed });
}

/** Canonical serialization of a trace (golden comparisons). */
export function serializeScenarioTrace(trace: EvidenceScenarioTrace): string {
  return stableStringify(trace);
}
