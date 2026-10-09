// YOU evidence-plane ledger replay (W2A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The evidence application service appends evidence-plane events
// (consent-recorded / consent-withdrawn / capture-session-opened /
// capture-session-completed / evidence-recorded / evidence-reviewed) into
// the W1A SolutionEventLedger machinery. Payload conventions follow the
// W1A precedent: per-record status facts ride along in event payloads
// (`sessionStatusAfter`, `consentState`, `supersedesReviewId`, flattened
// `quality.<class>` keys) because the frozen SolutionEventType set has no
// per-record status events.
//
// replayEvidenceLedger folds those events into the authoritative
// evidence-plane projection. Deterministic: same events => same
// projection (compare through stableStringify).

import type { SolutionEvent } from "./contract.js";

export interface EvidencePlaneProjection {
  readonly solutionId: string;
  /** policyId -> authoritative consent state. */
  readonly consents: Readonly<Record<string, string>>;
  /** captureSessionId -> status. */
  readonly captureSessions: Readonly<Record<string, string>>;
  /** evidenceId -> "recorded". */
  readonly evidence: Readonly<Record<string, string>>;
  /** evidenceId -> retention policy name. */
  readonly evidenceRetention: Readonly<Record<string, string>>;
  /** evidenceId -> simulated flag (truth law). */
  readonly evidenceSimulated: Readonly<Record<string, boolean>>;
  /** reviewId -> review status. */
  readonly reviews: Readonly<Record<string, string>>;
  /** evidenceId -> latest reviewId (supersession-aware). */
  readonly currentReviewOfEvidence: Readonly<Record<string, string>>;
  /** superseded reviewId -> replacing reviewId (linkage, never an overwrite). */
  readonly supersededBy: Readonly<Record<string, string>>;
}

function textPayload(event: SolutionEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function optionalTextPayload(event: SolutionEvent, key: string): string | undefined {
  const value = textPayload(event, key);
  return value === undefined || value === "" ? undefined : value;
}

function boolPayload(event: SolutionEvent, key: string): boolean | undefined {
  const value = event.payload[key];
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Folds evidence-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 */
export function replayEvidenceLedger(events: readonly SolutionEvent[]): EvidencePlaneProjection {
  if (events.length === 0) {
    throw new Error("replayEvidenceLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const consents: Record<string, string> = {};
  const captureSessions: Record<string, string> = {};
  const evidence: Record<string, string> = {};
  const evidenceRetention: Record<string, string> = {};
  const evidenceSimulated: Record<string, boolean> = {};
  const reviews: Record<string, string> = {};
  const currentReviewOfEvidence: Record<string, string> = {};
  const supersededBy: Record<string, string> = {};

  for (const event of events) {
    switch (event.type) {
      case "consent-recorded": {
        const policyId = textPayload(event, "policyId");
        const consentState = textPayload(event, "consentState");
        if (policyId !== undefined && consentState !== undefined) {
          consents[policyId] = consentState;
        }
        const sessionId = optionalTextPayload(event, "captureSessionId");
        const sessionStatusAfter = textPayload(event, "sessionStatusAfter");
        if (sessionId !== undefined && sessionStatusAfter !== undefined) {
          captureSessions[sessionId] = sessionStatusAfter;
        }
        break;
      }
      case "consent-withdrawn": {
        const policyId = textPayload(event, "policyId");
        const consentState = textPayload(event, "consentState");
        if (policyId !== undefined && consentState !== undefined) {
          consents[policyId] = consentState;
        }
        break;
      }
      case "capture-session-opened": {
        const sessionId = textPayload(event, "captureSessionId");
        const statusAfter = textPayload(event, "sessionStatusAfter");
        if (sessionId !== undefined && statusAfter !== undefined) {
          captureSessions[sessionId] = statusAfter;
        }
        break;
      }
      case "capture-session-completed": {
        const sessionId = textPayload(event, "captureSessionId");
        const statusAfter = textPayload(event, "sessionStatusAfter");
        if (sessionId !== undefined && statusAfter !== undefined) {
          captureSessions[sessionId] = statusAfter;
        }
        break;
      }
      case "evidence-recorded": {
        const evidenceId = textPayload(event, "evidenceId");
        if (evidenceId !== undefined) {
          evidence[evidenceId] = "recorded";
          evidenceRetention[evidenceId] = textPayload(event, "retentionPolicy") ?? "";
          evidenceSimulated[evidenceId] = boolPayload(event, "simulated") ?? true;
        }
        break;
      }
      case "evidence-reviewed": {
        const reviewId = textPayload(event, "reviewId");
        const evidenceId = textPayload(event, "evidenceId");
        const reviewStatus = textPayload(event, "reviewStatus");
        if (reviewId !== undefined && reviewStatus !== undefined) {
          reviews[reviewId] = reviewStatus;
        }
        if (reviewId !== undefined && evidenceId !== undefined) {
          currentReviewOfEvidence[evidenceId] = reviewId;
        }
        const superseded = optionalTextPayload(event, "supersedesReviewId");
        if (superseded !== undefined && reviewId !== undefined) {
          supersededBy[superseded] = reviewId;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    consents,
    captureSessions,
    evidence,
    evidenceRetention,
    evidenceSimulated,
    reviews,
    currentReviewOfEvidence,
    supersededBy,
  };
}
