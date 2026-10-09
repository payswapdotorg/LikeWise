// YOU twin-plane ledger replay (W3A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The twin application service appends twin-plane events
// (twin-version-published / twin-quality-assessed /
// reconstruction-job-submitted / reconstruction-job-completed, plus
// evidence-requested for deficiency remediation requests) into the W1A
// SolutionEventLedger machinery. Payload conventions follow the W1A/W2A
// precedent: per-record status facts ride along in event payloads
// because the frozen SolutionEventType set has no per-record status
// events:
//   twin-version-published        { kind: "publication" | "promotion",
//                                   twinVersionId, twinId, versionNumber,
//                                   statusAfter, supersededVersionId?,
//                                   domainBlockCount, evidenceBindingCount, ... }
//   twin-quality-assessed         { twinVersionId, twinId, assessedAt,
//                                   score.<domain>, deficiencyCount,
//                                   deficiency.<i>.class / .domain /
//                                   .severity / .remediationEvidenceRequestId, ... }
//   reconstruction-job-submitted  { jobId, twinVersionId, method,
//                                   targetDomains, targetDomainCount,
//                                   evidenceBindingCount, ... }
//   reconstruction-job-completed  { jobId, statusAfter, producedBlockCount,
//                                   failureReason?, ... }
//   evidence-requested            { evidenceRequestId, twinId,
//                                   twinVersionId, targetDeficiency, ... }
//
// replayTwinLedger folds those events into the authoritative twin-plane
// projection. Deterministic: same events => same projection (compare
// through stableStringify).

import type { SolutionEvent } from "./contract.js";

export interface TwinLedgerVersionEntry {
  readonly twinId: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly domainBlockCount: number;
  readonly evidenceBindingCount: number;
}

export interface TwinLedgerQualityEntry {
  readonly assessedAt: string;
  readonly domainScores: Readonly<Record<string, number>>;
  readonly deficiencies: readonly {
    readonly deficiencyClass: string;
    readonly domain: string;
    readonly severity: number;
    readonly remediationEvidenceRequestId: string;
  }[];
}

export interface TwinLedgerTwinEntry {
  readonly displayName: string;
  readonly versionIds: string[];
  readonly latestVersionNumber: number;
  readonly canonicalVersionId: string | null;
}

export interface TwinLedgerJobEntry {
  readonly status: string;
  readonly method: string;
  readonly twinVersionId: string;
  readonly targetDomains: string[];
  readonly producedBlockCount: number;
}

export interface TwinLedgerEvidenceRequestEntry {
  readonly targetDeficiency: string;
  readonly twinVersionId: string;
}

export interface TwinPlaneProjection {
  readonly solutionId: string;
  /** twinId -> authoritative twin summary. */
  readonly twins: Readonly<Record<string, TwinLedgerTwinEntry>>;
  /** twinVersionId -> version facts (status reflects the last transition). */
  readonly twinVersions: Readonly<Record<string, TwinLedgerVersionEntry>>;
  /** superseded versionId -> the version that superseded it. */
  readonly supersededBy: Readonly<Record<string, string>>;
  /** twinVersionId -> latest quality assessment facts. */
  readonly quality: Readonly<Record<string, TwinLedgerQualityEntry>>;
  /** jobId -> reconstruction job facts. */
  readonly reconstructionJobs: Readonly<Record<string, TwinLedgerJobEntry>>;
  /** evidenceRequestId -> remediation request facts. */
  readonly evidenceRequests: Readonly<Record<string, TwinLedgerEvidenceRequestEntry>>;
}

/** Mutable fold-accumulator twin entry (frozen into the projection at the end). */
interface MutableTwinEntry {
  displayName: string;
  versionIds: string[];
  latestVersionNumber: number;
  canonicalVersionId: string | null;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function recordOf<V>(source: Record<string, V>): Record<string, V> {
  return source;
}

/**
 * Folds twin-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 */
export function replayTwinLedger(events: readonly SolutionEvent[]): TwinPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayTwinLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const twins: Record<string, MutableTwinEntry> = {};
  const twinVersions: Record<string, TwinLedgerVersionEntry> = {};
  const supersededBy: Record<string, string> = {};
  const quality: Record<string, TwinLedgerQualityEntry> = {};
  const reconstructionJobs: Record<string, TwinLedgerJobEntry> = {};
  const evidenceRequests: Record<string, TwinLedgerEvidenceRequestEntry> = {};

  const ensureTwin = (twinId: string, displayName: string): MutableTwinEntry => {
    const existing = twins[twinId];
    if (existing === undefined) {
      const created: MutableTwinEntry = {
        displayName,
        versionIds: [],
        latestVersionNumber: 0,
        canonicalVersionId: null,
      };
      twins[twinId] = created;
      return created;
    }
    return existing;
  };

  for (const event of events) {
    switch (event.type) {
      case "twin-version-published": {
        const twinId = textPayload(event, "twinId") ?? "";
        const versionId = textPayload(event, "twinVersionId") ?? "";
        const kind = textPayload(event, "kind") ?? "publication";
        const displayName = textPayload(event, "twinDisplayName") ?? "";
        const twin = ensureTwin(twinId, displayName);
        if (kind === "publication") {
          const versionNumber = numberPayload(event, "versionNumber") ?? twin.latestVersionNumber + 1;
          twin.versionIds.push(versionId);
          twin.latestVersionNumber = Math.max(twin.latestVersionNumber, versionNumber);
          twinVersions[versionId] = {
            twinId,
            versionNumber,
            status: textPayload(event, "statusAfter") ?? "candidate",
            domainBlockCount: numberPayload(event, "domainBlockCount") ?? 0,
            evidenceBindingCount: numberPayload(event, "evidenceBindingCount") ?? 0,
          };
        } else {
          const existing = twinVersions[versionId];
          if (existing !== undefined) {
            twinVersions[versionId] = {
              ...existing,
              status: textPayload(event, "statusAfter") ?? existing.status,
            };
          }
          const canonicalId = textPayload(event, "statusAfter") === "canonical" ? versionId : null;
          if (canonicalId !== null) {
            twin.canonicalVersionId = canonicalId;
          }
          const superseded = textPayload(event, "supersededVersionId");
          if (superseded !== undefined && superseded !== "") {
            supersededBy[superseded] = versionId;
            const supersededEntry = twinVersions[superseded];
            if (supersededEntry !== undefined) {
              twinVersions[superseded] = { ...supersededEntry, status: "superseded" };
            }
          }
        }
        break;
      }
      case "twin-quality-assessed": {
        const versionId = textPayload(event, "twinVersionId") ?? "";
        const domainScores: Record<string, number> = {};
        for (const [key, value] of Object.entries(event.payload)) {
          if (key.startsWith("score.") && typeof value === "number") {
            domainScores[key.slice("score.".length)] = value;
          }
        }
        const deficiencyCount = numberPayload(event, "deficiencyCount") ?? 0;
        const deficiencies: {
          deficiencyClass: string;
          domain: string;
          severity: number;
          remediationEvidenceRequestId: string;
        }[] = [];
        for (let index = 0; index < deficiencyCount; index += 1) {
          const deficiencyClass = textPayload(event, `deficiency.${index}.class`);
          const domain = textPayload(event, `deficiency.${index}.domain`);
          if (deficiencyClass === undefined || domain === undefined) {
            continue;
          }
          deficiencies.push({
            deficiencyClass,
            domain,
            severity: numberPayload(event, `deficiency.${index}.severity`) ?? 0,
            remediationEvidenceRequestId: textPayload(event, `deficiency.${index}.remediationEvidenceRequestId`) ?? "",
          });
        }
        quality[versionId] = { assessedAt: textPayload(event, "assessedAt") ?? "", domainScores, deficiencies };
        break;
      }
      case "reconstruction-job-submitted": {
        const jobId = textPayload(event, "jobId");
        if (jobId !== undefined) {
          reconstructionJobs[jobId] = {
            status: "queued",
            method: textPayload(event, "method") ?? "",
            twinVersionId: textPayload(event, "twinVersionId") ?? "",
            targetDomains: (textPayload(event, "targetDomains") ?? "").split(",").filter((domain) => domain !== ""),
            producedBlockCount: 0,
          };
        }
        break;
      }
      case "reconstruction-job-completed": {
        const jobId = textPayload(event, "jobId");
        if (jobId !== undefined) {
          const existing = reconstructionJobs[jobId];
          reconstructionJobs[jobId] = {
            method: existing?.method ?? "",
            twinVersionId: existing?.twinVersionId ?? "",
            targetDomains: existing?.targetDomains ?? [],
            status: textPayload(event, "statusAfter") ?? existing?.status ?? "failed",
            producedBlockCount: numberPayload(event, "producedBlockCount") ?? existing?.producedBlockCount ?? 0,
          };
        }
        break;
      }
      case "evidence-requested": {
        const requestId = textPayload(event, "evidenceRequestId");
        if (requestId !== undefined) {
          evidenceRequests[requestId] = {
            targetDeficiency: textPayload(event, "targetDeficiency") ?? "",
            twinVersionId: textPayload(event, "twinVersionId") ?? "",
          };
        }
        break;
      }
      default:
        break;
    }
  }

  const frozenTwins: Record<string, TwinLedgerTwinEntry> = {};
  for (const twinId of Object.keys(twins).sort()) {
    const twin = twins[twinId];
    if (twin !== undefined) {
      frozenTwins[twinId] = {
        displayName: twin.displayName,
        versionIds: [...twin.versionIds],
        latestVersionNumber: twin.latestVersionNumber,
        canonicalVersionId: twin.canonicalVersionId,
      };
    }
  }

  return {
    solutionId,
    twins: recordOf(frozenTwins),
    twinVersions: recordOf(twinVersions),
    supersededBy: recordOf(supersededBy),
    quality: recordOf(quality),
    reconstructionJobs: recordOf(reconstructionJobs),
    evidenceRequests: recordOf(evidenceRequests),
  };
}
