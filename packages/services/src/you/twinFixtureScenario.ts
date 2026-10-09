// YOU W3A twin fixture scenario — scripted, deterministic orchestration
// of the full twin arrow (docs/you/WORK_ORDERS.md W3A; FIXTURES.md):
//
//   capture -> evidence -> binding -> reconstruction -> quality
//   assessment -> remediation request -> remediation capture -> round-2
//   reconstruction -> improved version -> promotion/supersession ->
//   consent withdrawal (blocks NEW bindings) -> unsupported method ->
//   ledger readout (projection == replay).
//
// Every arrow is a deterministic step with a recorded fact set; running
// the scenario twice with the same service seeds produces byte-identical
// traces (golden expectation). Fixture twins/reconstructions stay
// `simulated: true` (truth law).

import type { EvidenceRequest, OpaqueId } from "@zcode/shared";
import { projectRetention } from "../../../shared/src/you/evidenceRetention.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createEvidenceService, type EvidenceService } from "./evidenceService.js";
import { createEvidenceServicePort } from "./twinServiceTypes.js";
import { TwinService, createTwinService } from "./twinService.js";
import {
  EVIDENCE_SCENARIO_SEED,
  faceHandsScoreOf,
  outcomeCode,
  retainedBlocks,
  TWIN_SCENARIO_RECON_TARGETS,
  TWIN_SCENARIO_SOLUTION_ID,
  TWIN_SCENARIO_SEED,
  TWIN_SCENARIO_V1_DOMAINS,
  type TwinScenarioOptions,
  type TwinScenarioStep,
  type TwinScenarioTrace,
  versionSummariesOf,
} from "./twinFixtureScenarioTypes.js";

export {
  EVIDENCE_SCENARIO_SEED,
  TWIN_SCENARIO_RECON_TARGETS,
  TWIN_SCENARIO_SOLUTION_ID,
  TWIN_SCENARIO_SEED,
  TWIN_SCENARIO_V1_DOMAINS,
} from "./twinFixtureScenarioTypes.js";
export type { TwinScenarioOptions, TwinScenarioStep, TwinScenarioTrace } from "./twinFixtureScenarioTypes.js";

function step(index: number, name: string, facts: Record<string, string | number | boolean>): TwinScenarioStep {
  return { step: index, name, facts };
}

function must<T>(
  result: { readonly ok: boolean; readonly value?: T; readonly error?: { readonly code: string; readonly message: string } },
  where: string,
): T {
  if (!result.ok || result.value === undefined) {
    throw new Error(`scenario failed at ${where}: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`);
  }
  return result.value;
}

/**
 * Runs the full scripted twin scenario against freshly created services.
 * Deterministic: same seeds + same options => identical trace.
 */
export function runTwinFixtureScenario(options: TwinScenarioOptions = {}): TwinScenarioTrace {
  const solutionId = options.solutionId ?? TWIN_SCENARIO_SOLUTION_ID;
  const evidence: EvidenceService = createEvidenceService({
    workspaceIdentity: "ws-w3a-scenario-evidence",
    seed: options.evidenceSeed ?? EVIDENCE_SCENARIO_SEED,
  });
  const twin: TwinService = createTwinService({
    workspaceIdentity: "ws-w3a-scenario-twin",
    seed: options.twinSeed ?? TWIN_SCENARIO_SEED,
    evidencePort: createEvidenceServicePort(evidence, solutionId),
  });

  const steps: TwinScenarioStep[] = [];
  let stepIndex = 0;

  // -- capture -> evidence -------------------------------------------------

  const created = must(twin.createTwin(solutionId, { displayName: "Scenario Twin 01" }), "createTwin");
  const twinId = created.twin.id;
  steps.push(step((stepIndex += 1), "twin-created", { twinId, displayName: created.twin.displayName, versionCount: 0 }));

  const opened = must(
    evidence.openCaptureSession(solutionId, {
      evidenceRequest: null,
      scope: "USER",
      consent: {
        purposes: ["solution-generation", "quality-improvement"],
        operationalUse: true,
        learningReuse: false,
        retention: projectRetention("2099-01-01T00:00:00.000Z", "scenario twin capture consent"),
        revocable: true,
      },
      guideSpec: { targetDeficiency: "twin-seed-capture", preferredFraming: "synthetic seed capture framing", requiredModalities: ["image", "depth"] },
    }),
    "openCaptureSession",
  );
  const sessionId = opened.session.id;
  const capturePolicyId = opened.consentPolicyId;
  steps.push(
    step((stepIndex += 1), "capture-session-opened", {
      sessionId,
      policyId: capturePolicyId,
      status: opened.session.status,
      stepCount: opened.session.guideSteps.length,
    }),
  );

  const granted = must(evidence.grantConsent(solutionId, capturePolicyId), "grantConsent");
  steps.push(step((stepIndex += 1), "capture-consent-granted", { policyId: capturePolicyId, state: granted.reference.state }));

  const evidenceIds: OpaqueId[] = [];
  const evidenceHashes: string[] = [];
  for (const spec of [
    { key: "image", modality: "image" as const, privacyClass: "sensitive-media" as const },
    { key: "depth", modality: "depth" as const, privacyClass: "project-artifact" as const },
  ]) {
    const recorded = must(
      evidence.recordEvidence(solutionId, {
        evidenceRequestId: null,
        captureSessionId: sessionId,
        evidenceType: "fixture",
        modality: spec.modality,
        privacyClass: spec.privacyClass,
        retention: projectRetention("2099-01-01T00:00:00.000Z", `scenario twin ${spec.key} evidence`),
        consentPolicyId: capturePolicyId,
      }),
      `recordEvidence-${spec.key}`,
    );
    evidenceIds.push(recorded.record.id);
    evidenceHashes.push(recorded.record.contentHash);
    steps.push(
      step((stepIndex += 1), `evidence-recorded-${spec.key}`, {
        evidenceId: recorded.record.id,
        modality: spec.modality,
        privacyClass: spec.privacyClass,
        contentHash: recorded.record.contentHash,
        simulated: recorded.record.simulated,
      }),
    );
  }

  // -- binding -> v1 -> promotion ------------------------------------------

  const v1Blocks = must(
    twin.synthesizeDomainBlocks(solutionId, {
      domains: [...TWIN_SCENARIO_V1_DOMAINS],
      seedText: `scenario-v1:${evidenceHashes.join(":")}`,
      provenanceSource: "fixture:scenario-v1",
    }),
    "synthesizeDomainBlocks-v1",
  );
  const v1 = must(
    twin.publishTwinVersion(solutionId, twinId, {
      domainBlocks: v1Blocks.blocks,
      evidence: { evidenceIds },
      provenanceSource: "fixture:scenario-v1",
    }),
    "publishTwinVersion-v1",
  ).version;
  const v1FaceHandsScore = faceHandsScoreOf(v1);
  steps.push(
    step((stepIndex += 1), "twin-version-published-v1", {
      twinVersionId: v1.id,
      versionNumber: v1.version,
      status: v1.status,
      domainBlockCount: v1.domainBlocks.length,
      evidenceBindingCount: v1.evidenceBindings.length,
      faceHandsScore: v1FaceHandsScore,
      deficiencyCount: v1.quality.deficiencies.length,
    }),
  );

  const promotedV1 = must(twin.promoteTwinVersion(solutionId, twinId, v1.id), "promoteTwinVersion-v1");
  steps.push(
    step((stepIndex += 1), "twin-version-promoted-v1", {
      twinVersionId: v1.id,
      status: promotedV1.version.status,
      supersededVersionId: promotedV1.superseded?.id ?? "",
    }),
  );

  // -- reconstruction round 1 -> v2 ------------------------------------------

  const submitted = must(
    twin.submitReconstructionJob(solutionId, {
      twinVersionId: v1.id,
      method: "hybrid",
      targetDomains: [...TWIN_SCENARIO_RECON_TARGETS],
      evidence: { bindings: v1.evidenceBindings },
    }),
    "submitReconstructionJob-1",
  ).spec;
  steps.push(
    step((stepIndex += 1), "reconstruction-job-submitted", {
      jobId: submitted.id,
      method: submitted.method,
      targetDomains: submitted.targetDomains.join(","),
      evidenceBindingCount: submitted.evidenceBindings.length,
    }),
  );

  must(twin.startReconstructionJob(solutionId, submitted.id), "startReconstructionJob-1");
  steps.push(step((stepIndex += 1), "reconstruction-job-started", { jobId: submitted.id, status: "running" }));

  const completed = must(twin.completeReconstructionJob(solutionId, submitted.id), "completeReconstructionJob-1").result;
  steps.push(
    step((stepIndex += 1), "reconstruction-job-completed", {
      jobId: completed.jobId,
      status: completed.status,
      producedBlockCount: completed.producedDomainBlocks.length,
      latencyNotMeasured: completed.effortObservations["latencyMs.measured"] === false,
      latencyMarker: String(completed.effortObservations["latencyMs"]),
      simulated: completed.simulated,
    }),
  );

  const v2 = must(
    twin.publishTwinVersion(solutionId, twinId, {
      domainBlocks: [...retainedBlocks(v1.domainBlocks, completed.producedDomainBlocks), ...completed.producedDomainBlocks],
      evidence: { bindings: v1.evidenceBindings },
      provenanceSource: `fixture:scenario-v2:${submitted.id}`,
    }),
    "publishTwinVersion-v2",
  ).version;
  steps.push(
    step((stepIndex += 1), "twin-version-published-v2", {
      twinVersionId: v2.id,
      versionNumber: v2.version,
      status: v2.status,
      domainBlockCount: v2.domainBlocks.length,
      evidenceBindingCount: v2.evidenceBindings.length,
      faceHandsScore: faceHandsScoreOf(v2),
      deficiencyCount: v2.quality.deficiencies.length,
    }),
  );

  const reassessed = must(twin.assessTwinQualityOf(solutionId, twinId, v2.id), "assessTwinQualityOf-v2");
  steps.push(
    step((stepIndex += 1), "twin-quality-assessed-v2", {
      twinVersionId: v2.id,
      assessedAt: reassessed.quality.assessedAt,
      deficiencyCount: reassessed.quality.deficiencies.length,
      scores: stableStringify(reassessed.quality.domainScores),
    }),
  );

  const promotedV2 = must(twin.promoteTwinVersion(solutionId, twinId, v2.id), "promoteTwinVersion-v2");
  steps.push(
    step((stepIndex += 1), "twin-version-promoted-v2", {
      twinVersionId: v2.id,
      status: promotedV2.version.status,
      supersededVersionId: promotedV2.superseded?.id ?? "",
      v1StatusAfter: must(twin.twinVersionOf(solutionId, twinId, v1.id), "readV1After").version.status,
    }),
  );

  // -- deficiency -> targeted remediation EvidenceRequest ---------------------

  const v2Deficiency = v2.quality.deficiencies.find((deficiency) => deficiency.domain === "face-hands") ?? v2.quality.deficiencies[0];
  if (v2Deficiency === undefined) {
    throw new Error("scenario expected v2 to carry at least one deficiency for the remediation flow");
  }
  const remediation = must(
    twin.openRemediationEvidenceRequest(solutionId, twinId, v2.id, v2Deficiency.id),
    "openRemediationEvidenceRequest",
  );
  const remediationRequest: EvidenceRequest = remediation.request;
  steps.push(
    step((stepIndex += 1), "deficiency-remediation-requested", {
      deficiencyId: v2Deficiency.id,
      deficiencyClass: v2Deficiency.deficiencyClass,
      domain: v2Deficiency.domain,
      severity: v2Deficiency.severity,
      evidenceRequestId: remediationRequest.id,
      targetDeficiency: remediationRequest.targetDeficiency,
      alreadyLinked: remediation.alreadyLinked,
    }),
  );

  // -- remediation capture -> new evidence ------------------------------------

  const remediationOpened = must(
    evidence.openCaptureSession(solutionId, {
      evidenceRequest: remediationRequest,
      scope: "USER",
      consent: {
        purposes: ["solution-generation", "quality-improvement"],
        operationalUse: true,
        learningReuse: false,
        retention: projectRetention("2099-01-01T00:00:00.000Z", "scenario remediation capture consent"),
        revocable: true,
      },
    }),
    "openRemediationCaptureSession",
  );
  const remediationSessionId = remediationOpened.session.id;
  const remediationPolicyId = remediationOpened.consentPolicyId;
  must(evidence.grantConsent(solutionId, remediationPolicyId), "grantRemediationConsent");
  steps.push(
    step((stepIndex += 1), "remediation-capture-opened", {
      sessionId: remediationSessionId,
      evidenceRequestId: remediationOpened.session.evidenceRequestId ?? "",
      status: remediationOpened.session.status,
    }),
  );

  const remediationRecorded = must(
    evidence.recordEvidence(solutionId, {
      evidenceRequestId: remediationRequest.id,
      captureSessionId: remediationSessionId,
      evidenceType: "fixture",
      modality: "depth",
      privacyClass: "sensitive-media",
      retention: projectRetention("2099-01-01T00:00:00.000Z", "scenario remediation evidence"),
      consentPolicyId: remediationPolicyId,
    }),
    "recordRemediationEvidence",
  ).record;
  const remediationEvidenceId = remediationRecorded.id;
  steps.push(
    step((stepIndex += 1), "remediation-evidence-recorded", {
      evidenceId: remediationEvidenceId,
      evidenceRequestId: remediationRecorded.evidenceRequestId ?? "",
      contentHash: remediationRecorded.contentHash,
      simulated: remediationRecorded.simulated,
    }),
  );

  // -- reconstruction round 2 (with the remediation evidence) -> v3 -------------

  const submitted2 = must(
    twin.submitReconstructionJob(solutionId, {
      twinVersionId: v2.id,
      method: "hybrid",
      targetDomains: [...TWIN_SCENARIO_RECON_TARGETS],
      evidence: { evidenceIds: [...evidenceIds, remediationEvidenceId] },
    }),
    "submitReconstructionJob-2",
  ).spec;
  must(twin.startReconstructionJob(solutionId, submitted2.id), "startReconstructionJob-2");
  const completed2 = must(twin.completeReconstructionJob(solutionId, submitted2.id), "completeReconstructionJob-2").result;
  steps.push(
    step((stepIndex += 1), "reconstruction-round2-completed", {
      jobId: submitted2.id,
      status: completed2.status,
      producedBlockCount: completed2.producedDomainBlocks.length,
      evidenceBindingCount: submitted2.evidenceBindings.length,
    }),
  );

  const v3 = must(
    twin.publishTwinVersion(solutionId, twinId, {
      domainBlocks: [...retainedBlocks(v2.domainBlocks, completed2.producedDomainBlocks), ...completed2.producedDomainBlocks],
      evidence: { evidenceIds: [...evidenceIds, remediationEvidenceId] },
      provenanceSource: `fixture:scenario-v3:${submitted2.id}`,
    }),
    "publishTwinVersion-v3",
  ).version;
  const v3FaceHandsScore = faceHandsScoreOf(v3);
  const v3FaceHandsRemediated = v3.quality.deficiencies.find((deficiency) => deficiency.domain === "face-hands");
  steps.push(
    step((stepIndex += 1), "twin-version-published-v3", {
      twinVersionId: v3.id,
      versionNumber: v3.version,
      status: v3.status,
      faceHandsScore: v3FaceHandsScore,
      faceHandsScoreImproved: v3FaceHandsScore > v2.quality.domainScores["face-hands"]!,
      deficiencyCount: v3.quality.deficiencies.length,
      faceHandsRemediationRequestId: v3FaceHandsRemediated?.remediationEvidenceRequestId ?? "",
    }),
  );

  const promotedV3 = must(twin.promoteTwinVersion(solutionId, twinId, v3.id), "promoteTwinVersion-v3");
  steps.push(
    step((stepIndex += 1), "twin-version-promoted-v3", {
      twinVersionId: v3.id,
      status: promotedV3.version.status,
      supersededVersionId: promotedV3.superseded?.id ?? "",
    }),
  );

  // -- consent withdrawal blocks NEW bindings; published versions keep provenance -

  const withdrawn = must(evidence.withdrawConsent(solutionId, capturePolicyId), "withdrawConsent");
  const blockedPublish = twin.publishTwinVersion(solutionId, twinId, {
    domainBlocks: v1Blocks.blocks,
    evidence: { evidenceIds },
    provenanceSource: "fixture:scenario-v4-blocked",
  });
  steps.push(
    step((stepIndex += 1), "capture-consent-withdrawn", {
      policyId: capturePolicyId,
      state: withdrawn.reference.state,
      bindingAfterWithdrawal: outcomeCode(blockedPublish),
      blockedReason: blockedPublish.ok ? "" : (blockedPublish.error.details["reason"] ?? ""),
    }),
  );

  // -- unsupported method/domain combination -----------------------------------

  const unsupported = twin.submitReconstructionJob(solutionId, {
    twinVersionId: v3.id,
    method: "explicit-geometry",
    targetDomains: ["voice"],
    evidence: { bindings: v3.evidenceBindings },
  });
  steps.push(
    step((stepIndex += 1), "reconstruction-unsupported", {
      method: "explicit-geometry",
      targetDomain: "voice",
      outcome: outcomeCode(unsupported),
      unsupportedDomains: unsupported.ok ? "" : (unsupported.error.details["unsupportedDomains"] ?? ""),
    }),
  );

  // -- ledger readout: projection == replay --------------------------------------

  const events = must(twin.ledgerEventsOf(solutionId), "ledgerEventsOf");
  const ledgerHash = must(twin.ledgerHashOf(solutionId), "ledgerHashOf");
  const projection = must(twin.projectionOf(solutionId), "projectionOf");
  const replayed = TwinService.replay(events);
  const projectionMatchesReplay = stableStringify(projection) === stableStringify(replayed);
  steps.push(
    step((stepIndex += 1), "ledger-readout", {
      eventCount: events.length,
      ledgerHash,
      projectionMatchesReplay,
      canonicalVersionId: projection.twins[twinId]?.canonicalVersionId ?? "",
      supersededCount: Object.keys(projection.supersededBy).length,
      twinStoreSize: twin.contentStoreSize(),
    }),
  );

  const versions = versionSummariesOf(must(twin.twinVersionsOf(solutionId, twinId), "twinVersionsOf").versions);

  return {
    solutionId,
    twinId,
    sessionId,
    remediationSessionId,
    remediationRequestId: remediationRequest.id,
    evidenceIds,
    remediationEvidenceId,
    versions,
    jobId: submitted.id,
    remediationJobId: submitted2.id,
    finalCanonicalVersionId: projection.twins[twinId]?.canonicalVersionId ?? null,
    finalSupersededBy: projection.supersededBy,
    v1FaceHandsScore,
    v3FaceHandsScore,
    faceHandsRemediationLinkedOnV3: v3FaceHandsRemediated?.remediationEvidenceRequestId === remediationRequest.id,
    eventCount: events.length,
    ledgerHash,
    twinStoreSize: twin.contentStoreSize(),
    projectionMatchesReplay,
    steps,
  };
}

/** Canonical serialization of a trace (golden comparisons). */
export function serializeTwinScenarioTrace(trace: TwinScenarioTrace): string {
  return stableStringify(trace);
}
