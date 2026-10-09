// YOU twin service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W2A precedent
// (solutionLedgerOps.ts / evidenceLedgerOps.ts): per-record status facts
// ride along in event payloads because the frozen SolutionEventType set
// has no per-record status events. Payload conventions (folded by
// shared/src/you/twinLedger.ts replayTwinLedger):
//   twin-version-published        kind=publication | promotion (+ facts)
//   twin-quality-assessed         score.<domain> + deficiency.<i>.* facts
//   reconstruction-job-submitted  job facts (status starts "queued")
//   reconstruction-job-completed  statusAfter + producedBlockCount
//   evidence-requested            remediation request facts (W1A event
//                                 type reused for the same semantics)

import type {
  EvidenceRequest,
  HtirDomainBlock,
  OpaqueId,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  TwinDeficiency,
  TwinQualityState,
  TwinVersion,
} from "@zcode/shared";
import type { TwinPlaneRecord } from "./twinServiceTypes.js";

/** Appends twin-version-published for a candidate publication. */
export function appendTwinVersionPublished(
  plane: TwinPlaneRecord,
  version: TwinVersion,
  twinDisplayName: string,
): void {
  plane.ledger.append({
    type: "twin-version-published",
    subjectRef: version.id,
    generator: version.provenance.generator,
    payload: {
      kind: "publication",
      twinVersionId: version.id,
      twinId: version.twinId,
      twinDisplayName,
      versionNumber: version.version,
      statusAfter: version.status,
      domainBlockCount: version.domainBlocks.length,
      evidenceBindingCount: version.evidenceBindings.length,
      provenanceSource: version.provenance.source,
      simulated: true,
    },
  });
}

/** Appends twin-version-published for a promotion (candidate -> canonical). */
export function appendTwinVersionPromotion(
  plane: TwinPlaneRecord,
  promoted: TwinVersion,
  superseded: TwinVersion | null,
): void {
  plane.ledger.append({
    type: "twin-version-published",
    subjectRef: promoted.id,
    generator: "user",
    payload: {
      kind: "promotion",
      twinVersionId: promoted.id,
      twinId: promoted.twinId,
      versionNumber: promoted.version,
      statusAfter: promoted.status,
      ...(superseded === null
        ? {}
        : { supersededVersionId: superseded.id, supersededStatusAfter: superseded.status }),
      simulated: true,
    },
  });
}

/** Flattens a quality state into payload facts (score.<domain>, deficiency.<i>.*). */
export function qualityPayloadFacts(quality: TwinQualityState): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {
    assessedAt: quality.assessedAt,
    deficiencyCount: quality.deficiencies.length,
  };
  for (const [domain, score] of Object.entries(quality.domainScores).sort(([a], [b]) => (a < b ? -1 : 1))) {
    payload[`score.${domain}`] = score;
  }
  for (let index = 0; index < quality.deficiencies.length; index += 1) {
    const deficiency = quality.deficiencies[index];
    if (deficiency === undefined) {
      continue;
    }
    payload[`deficiency.${index}.class`] = deficiency.deficiencyClass;
    payload[`deficiency.${index}.domain`] = deficiency.domain;
    payload[`deficiency.${index}.severity`] = deficiency.severity;
    payload[`deficiency.${index}.remediationEvidenceRequestId`] = deficiency.remediationEvidenceRequestId ?? "";
  }
  return payload;
}

/** Appends twin-quality-assessed for one twin version's quality projection. */
export function appendTwinQualityAssessed(
  plane: TwinPlaneRecord,
  twinVersionId: OpaqueId,
  quality: TwinQualityState,
): void {
  plane.ledger.append({
    type: "twin-quality-assessed",
    subjectRef: twinVersionId,
    generator: "agent",
    payload: {
      twinVersionId,
      ...qualityPayloadFacts(quality),
      simulated: true,
    },
  });
}

/** Appends reconstruction-job-submitted (job facts; status starts "queued"). */
export function appendReconstructionJobSubmitted(plane: TwinPlaneRecord, spec: ReconstructionJobSpec): void {
  plane.ledger.append({
    type: "reconstruction-job-submitted",
    subjectRef: spec.id,
    generator: "agent",
    payload: {
      jobId: spec.id,
      twinVersionId: spec.twinVersionId,
      method: spec.method,
      targetDomains: [...spec.targetDomains].sort().join(","),
      targetDomainCount: spec.targetDomains.length,
      evidenceBindingCount: spec.evidenceBindings.length,
      simulated: true,
    },
  });
}

/** Appends reconstruction-job-completed (terminal status facts). */
export function appendReconstructionJobCompleted(
  plane: TwinPlaneRecord,
  result: ReconstructionJobResult,
): void {
  plane.ledger.append({
    type: "reconstruction-job-completed",
    subjectRef: result.jobId,
    generator: "agent",
    payload: {
      jobId: result.jobId,
      statusAfter: result.status,
      producedBlockCount: result.producedDomainBlocks.length,
      ...(result.status === "failed" && typeof result.effortObservations["failureReason"] === "string"
        ? { failureReason: result.effortObservations["failureReason"] as string }
        : {}),
      simulated: true,
    },
  });
}

/** Appends evidence-requested for a deficiency remediation request (W2 seam). */
export function appendRemediationEvidenceRequested(
  plane: TwinPlaneRecord,
  request: EvidenceRequest,
  twinVersionId: OpaqueId,
): void {
  plane.ledger.append({
    type: "evidence-requested",
    subjectRef: request.id,
    generator: "agent",
    payload: {
      evidenceRequestId: request.id,
      twinVersionId,
      targetDeficiency: request.targetDeficiency,
      reason: request.reason,
      retention: request.retention,
      statusAfter: request.status,
      simulated: true,
    },
  });
}

/** Convenience: sorted domain list of produced blocks (payload facts). */
export function producedDomainList(blocks: readonly HtirDomainBlock[]): string {
  return [...new Set(blocks.map((block) => block.domain))].sort().join(",");
}

/** Deficiency summary for logs/tests (never a mutation path). */
export function deficiencySummary(deficiency: TwinDeficiency): string {
  return `${deficiency.deficiencyClass}@${deficiency.domain}:${deficiency.severity}`;
}
