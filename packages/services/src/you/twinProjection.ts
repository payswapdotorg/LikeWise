// YOU twin service — live plane projection builder.
//
// Builds the authoritative TwinPlaneProjection from the service's live
// state in EXACTLY the shape replayTwinLedger folds from the append-only
// event ledger (docs/you/FIXTURES.md law 10: replaying a ledger
// reproduces state exactly). The equivalence is asserted in tests via
// stableStringify; any drift between this builder and the fold is a bug.
//
// Pre-publication twins (no versions yet) are intentionally NOT part of
// the replayable projection: a twin enters the ledger at its first
// version publication, mirroring the W1A rule that only accepted
// ChangeSets reach canonical truth.

import type { OpaqueId, TwinQualityState } from "@zcode/shared";
import type {
  TwinLedgerEvidenceRequestEntry,
  TwinLedgerJobEntry,
  TwinLedgerQualityEntry,
  TwinLedgerTwinEntry,
  TwinLedgerVersionEntry,
  TwinPlaneProjection,
} from "../../../shared/src/you/twinLedger.js";
import type { TwinPlaneRecord, RemediationRequestEntry } from "./twinServiceTypes.js";
import { sortedMapKeys } from "./twinServiceTypes.js";

/** Latest emitted quality assessment per version id (publication-time + re-assessments). */
export type QualityAssessmentStore = Map<OpaqueId, TwinQualityState>;

/** Builds the live twin-plane projection (equal to replayTwinLedger output). */
export function buildTwinPlaneProjection(plane: TwinPlaneRecord, qualityAssessments: QualityAssessmentStore): TwinPlaneProjection {
  const twins: Record<string, TwinLedgerTwinEntry> = {};
  const twinVersions: Record<string, TwinLedgerVersionEntry> = {};
  const supersededBy: Record<string, string> = {};
  const quality: Record<string, TwinLedgerQualityEntry> = {};
  for (const twinId of sortedMapKeys(plane.twins)) {
    const state = plane.twins.get(twinId);
    if (state === undefined) {
      continue;
    }
    const versions = state.chain.versions();
    if (versions.length === 0) {
      continue;
    }
    twins[twinId] = {
      displayName: state.record.displayName,
      versionIds: versions.map((version) => version.id),
      latestVersionNumber: state.chain.latestVersionNumber,
      canonicalVersionId: state.chain.currentCanonical()?.id ?? null,
    };
    for (const version of versions) {
      twinVersions[version.id] = {
        twinId,
        versionNumber: version.version,
        status: version.status,
        domainBlockCount: version.domainBlocks.length,
        evidenceBindingCount: version.evidenceBindings.length,
      };
    }
    Object.assign(supersededBy, state.chain.supersessionLinks());
    for (const version of versions) {
      const assessed = qualityAssessments.get(version.id);
      if (assessed !== undefined) {
        quality[version.id] = qualityEntryOf(assessed);
      }
    }
  }
  const reconstructionJobs: Record<string, TwinLedgerJobEntry> = {};
  for (const jobId of sortedMapKeys(plane.jobs)) {
    const job = plane.jobs.get(jobId);
    if (job === undefined) {
      continue;
    }
    reconstructionJobs[jobId] = {
      status: job.status,
      method: job.spec.method,
      twinVersionId: job.spec.twinVersionId,
      targetDomains: [...job.spec.targetDomains],
      producedBlockCount: job.result?.producedDomainBlocks.length ?? 0,
    };
  }
  const evidenceRequests: Record<string, TwinLedgerEvidenceRequestEntry> = {};
  for (const requestId of sortedMapKeys(plane.remediationRequests)) {
    const entry: RemediationRequestEntry | undefined = plane.remediationRequests.get(requestId);
    if (entry !== undefined) {
      evidenceRequests[requestId] = {
        targetDeficiency: entry.request.targetDeficiency,
        twinVersionId: entry.twinVersionId,
      };
    }
  }
  return { solutionId: plane.solutionId, twins, twinVersions, supersededBy, quality, reconstructionJobs, evidenceRequests };
}

function qualityEntryOf(assessed: TwinQualityState): TwinLedgerQualityEntry {
  return {
    assessedAt: assessed.assessedAt,
    domainScores: assessed.domainScores,
    deficiencies: assessed.deficiencies.map((deficiency) => ({
      deficiencyClass: deficiency.deficiencyClass,
      domain: deficiency.domain,
      severity: deficiency.severity,
      remediationEvidenceRequestId: deficiency.remediationEvidenceRequestId ?? "",
    })),
  };
}
