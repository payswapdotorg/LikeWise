// YOU security-plane ledger replay (W11A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The security application service appends the two wave-11 security
// events into the W1A SolutionEventLedger machinery. Payload conventions
// follow the W1A/W7A/W10A ride-along precedent ("per-record status
// facts ride along in event payloads because the frozen
// SolutionEventType set has no per-record status events"):
//
//   security-review-recorded
//     (phase "recorded" — the review birth; findings verbatim):
//       { reviewId, scopeRef, reviewedAt, phase: "recorded",
//         findingCount, finding.<i>, findingSeverity.<i>,
//         findingDescription.<i>,
//         acceptanceId: "", acceptedBy: "", acceptanceReason: "",
//         acceptedAt: "", findingSetDigest: "", simulated }
//     (phase "accepted" — the separate immutable acceptance decision,
//       referencing the finding set; the W7A status-carrier precedent,
//       exactly like import-quarantined carried "released"):
//       { reviewId, scopeRef, reviewedAt, phase: "accepted",
//         findingCount, finding.<i>, findingSeverity.<i>,
//         findingDescription.<i>,
//         acceptanceId, acceptedBy, acceptanceReason, acceptedAt,
//         findingSetDigest, simulated }
//     — THE SECURITY REVIEW LAW carrier: the findings ride both phases
//       verbatim; the acceptance rides its own phase and carries the
//       finding-set digest. The fold takes the LATEST event per reviewId
//       (the platformLedger imports rule).
//   load-test-recorded:
//     { reportId, scenarioRef, peakRps, p99Ms, source, measuredAt,
//       regressionCount, regression.<i>, simulated }
//     — the LOAD TEST LAW carrier: the metrics truth facts (source +
//       measuredAt provenance) and the regressions list ride the event
//       verbatim.
//
// ThreatModelEntry records are pre-review SERVICE STATE (the rate-limit
// policy precedent — the frozen wave-11 event set has no threat-model
// event; entries materialize in the ledger only through their review
// facts) and therefore do not appear in the fold.
//
// Deterministic: same events => same projection (compare through
// stableStringify).

import type { SolutionEvent } from "./contract.js";

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function numberPayload(event: SolutionEvent, key: string): number | undefined {
  const value = event.payload[key];
  return typeof value === "number" ? value : undefined;
}

function booleanPayload(event: SolutionEvent, key: string): boolean {
  const value = event.payload[key];
  return typeof value === "boolean" ? value : true;
}

/** Review facts as reconstructable from ledger payloads. */
export interface SecurityLedgerReviewEntry {
  readonly scopeRef: string;
  readonly reviewedAt: string;
  readonly findingCount: number;
  readonly findings: readonly { readonly signature: string; readonly severity: string; readonly description: string }[];
  /** recorded | accepted (the lifecycle head). */
  readonly status: string;
  /** The separate immutable acceptance decision's id ("" while recorded). */
  readonly acceptanceId: string;
  readonly acceptedBy: string;
  readonly acceptanceReason: string;
  readonly acceptedAt: string;
  /** The finding-set digest the acceptance references ("" while recorded). */
  readonly findingSetDigest: string;
  readonly simulated: boolean;
}

/** Load-test facts as reconstructable from ledger payloads. */
export interface SecurityLedgerLoadTestEntry {
  readonly scenarioRef: string;
  readonly peakRps: number;
  readonly p99Ms: number;
  /** measured | simulated (the labeling law). */
  readonly source: string;
  readonly measuredAt: string;
  readonly regressionCount: number;
  readonly regressions: readonly string[];
  readonly simulated: boolean;
}

export interface SecurityPlaneProjection {
  readonly solutionId: string;
  /** reviewId -> review facts (both phases; the latest event per review wins). */
  readonly securityReviews: Readonly<Record<string, SecurityLedgerReviewEntry>>;
  /** reportId -> load-test facts. */
  readonly loadTests: Readonly<Record<string, SecurityLedgerLoadTestEntry>>;
}

/**
 * Folds security-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 * Events referencing unknown records fold defensively (ignored),
 * mirroring the W1A/W3A/W7A/W8A/W10A total-fold precedent.
 */
export function replaySecurityLedger(events: readonly SolutionEvent[]): SecurityPlaneProjection {
  if (events.length === 0) {
    throw new Error("replaySecurityLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const securityReviews: Record<string, SecurityLedgerReviewEntry> = {};
  const loadTests: Record<string, SecurityLedgerLoadTestEntry> = {};

  for (const event of events) {
    switch (event.type) {
      case "security-review-recorded": {
        const reviewId = textPayload(event, "reviewId");
        if (reviewId === undefined) {
          break;
        }
        const findingCount = numberPayload(event, "findingCount") ?? 0;
        const findings: { signature: string; severity: string; description: string }[] = [];
        for (let index = 0; index < findingCount; index += 1) {
          const signature = textPayload(event, `finding.${index}`);
          const severity = textPayload(event, `findingSeverity.${index}`);
          const description = textPayload(event, `findingDescription.${index}`);
          if (signature !== undefined) {
            findings.push({ signature, severity: severity ?? "", description: description ?? "" });
          }
        }
        const phase = textPayload(event, "phase") === "accepted" ? "accepted" : "recorded";
        const accepted = phase === "accepted";
        securityReviews[reviewId] = {
          scopeRef: textPayload(event, "scopeRef") ?? "",
          reviewedAt: textPayload(event, "reviewedAt") ?? "",
          findingCount,
          findings: Object.freeze(findings),
          status: phase,
          acceptanceId: accepted ? textPayload(event, "acceptanceId") ?? "" : "",
          acceptedBy: accepted ? textPayload(event, "acceptedBy") ?? "" : "",
          acceptanceReason: accepted ? textPayload(event, "acceptanceReason") ?? "" : "",
          acceptedAt: accepted ? textPayload(event, "acceptedAt") ?? "" : "",
          findingSetDigest: accepted ? textPayload(event, "findingSetDigest") ?? "" : "",
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "load-test-recorded": {
        const reportId = textPayload(event, "reportId");
        if (reportId === undefined) {
          break;
        }
        const regressionCount = numberPayload(event, "regressionCount") ?? 0;
        const regressions: string[] = [];
        for (let index = 0; index < regressionCount; index += 1) {
          const regression = textPayload(event, `regression.${index}`);
          if (regression !== undefined) {
            regressions.push(regression);
          }
        }
        loadTests[reportId] = {
          scenarioRef: textPayload(event, "scenarioRef") ?? "",
          peakRps: numberPayload(event, "peakRps") ?? 0,
          p99Ms: numberPayload(event, "p99Ms") ?? 0,
          source: textPayload(event, "source") ?? "simulated",
          measuredAt: textPayload(event, "measuredAt") ?? "",
          regressionCount,
          regressions: Object.freeze(regressions),
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    securityReviews,
    loadTests,
  };
}
