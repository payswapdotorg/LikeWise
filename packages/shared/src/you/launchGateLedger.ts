// YOU launch-gate-plane ledger replay (W12A — docs/you/FIXTURES.md law
// 10: append-only history; replaying a ledger reproduces state exactly).
//
// The launch-gate application service appends the three wave-12 launch
// events into the W1A SolutionEventLedger machinery. Payload
// conventions follow the W1A/W7A/W10A/W11A ride-along precedent
// ("per-record status facts ride along in event payloads because the
// frozen SolutionEventType set has no per-record status events"):
//
//   launch-gate-checked:
//     { checklistId, checkedAt, pointCount, passedCount, gatePassed,
//       pointDescription.<i>, pointJourneyRef.<i> ("" for null),
//       pointPassed.<i>, simulated }
//     — THE LAUNCH GATE LAW carrier: the 20 canonical points ride the
//       event verbatim with their journey-evidence references and their
//       authority-DERIVED pass states (a point passes ONLY with a
//       successful journey reference — the derivation happened at
//       construction inside the single authority; the payload carries
//       its result, never a bare assertion).
//   operator-signoff-recorded:
//     { signoffId, checklistRef, signedBy, signedAt, simulated }
//     — THE OPERATOR SIGNOFF LAW carrier: the signoff references its
//       COMPLETE passing checklist.
//   release-declared:
//     { declarationId, signoffRef, evidenceBundleRef,
//       rollbackEvidenceRef, declaredAt, simulated }
//     — THE RELEASE DECLARATION LAW carrier: the evidence bundle AND
//       the rollback evidence ride the event verbatim.
//
// The fold takes the LATEST event per record id (the platformLedger
// imports rule) and projects the two lifecycle heads as maps:
// signedChecklists (checklistId -> the signoff that signed it — the
// one-signoff-per-checklist head) and declaredSignoffs (signoffId ->
// the declaration that declared it — the one-release-per-signoff
// head). Deterministic: same events => same projection (compare
// through stableStringify).
//
// E2eJourneyRecord evidence is pre-checklist INPUT (the W11C harness
// domain — journeys arrive as record values at assembly time; their
// refs ride the launch-gate-checked payload) and therefore has no fold
// case of its own here.

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

/** One checklist point as reconstructable from ledger payloads. */
export interface LaunchGateLedgerPointEntry {
  /** 1-based canonical point number. */
  readonly point: number;
  readonly description: string;
  /** The journey-evidence ref ("" for the honest null — no evidence). */
  readonly journeyEvidenceRef: string;
  /** The authority-derived pass state (passed ONLY with successful journey evidence). */
  readonly passed: boolean;
}

/** Checklist facts as reconstructable from ledger payloads. */
export interface LaunchGateLedgerChecklistEntry {
  readonly checkedAt: string;
  readonly points: readonly LaunchGateLedgerPointEntry[];
  readonly passedCount: number;
  /** True when all 20 points passed (the gate-pass projection). */
  readonly gatePassed: boolean;
  readonly simulated: boolean;
}

/** Signoff facts as reconstructable from ledger payloads. */
export interface LaunchGateLedgerSignoffEntry {
  readonly checklistRef: string;
  readonly signedBy: string;
  readonly signedAt: string;
  readonly simulated: boolean;
}

/** Declaration facts as reconstructable from ledger payloads. */
export interface LaunchGateLedgerDeclarationEntry {
  readonly signoffRef: string;
  readonly evidenceBundleRef: string;
  readonly rollbackEvidenceRef: string;
  readonly declaredAt: string;
  readonly simulated: boolean;
}

export interface LaunchGatePlaneProjection {
  readonly solutionId: string;
  /** checklistId -> checklist facts (the latest event per checklist wins). */
  readonly checklists: Readonly<Record<string, LaunchGateLedgerChecklistEntry>>;
  /** signoffId -> signoff facts. */
  readonly signoffs: Readonly<Record<string, LaunchGateLedgerSignoffEntry>>;
  /** declarationId -> declaration facts. */
  readonly declarations: Readonly<Record<string, LaunchGateLedgerDeclarationEntry>>;
  /** checklistId -> the signoffId that signed it (the one-signoff-per-checklist head). */
  readonly signedChecklists: Readonly<Record<string, string>>;
  /** signoffId -> the declarationId that declared it (the one-release-per-signoff head). */
  readonly declaredSignoffs: Readonly<Record<string, string>>;
}

/**
 * Folds launch-gate-plane ledger events into the authoritative
 * projection. Same events => same projection (byte-identical under
 * stableStringify). Events referencing unknown records fold defensively
 * (ignored), mirroring the W1A/W3A/W7A/W8A/W10A/W11A total-fold
 * precedent.
 */
export function replayLaunchGateLedger(events: readonly SolutionEvent[]): LaunchGatePlaneProjection {
  if (events.length === 0) {
    throw new Error("replayLaunchGateLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const checklists: Record<string, LaunchGateLedgerChecklistEntry> = {};
  const signoffs: Record<string, LaunchGateLedgerSignoffEntry> = {};
  const declarations: Record<string, LaunchGateLedgerDeclarationEntry> = {};
  const signedChecklists: Record<string, string> = {};
  const declaredSignoffs: Record<string, string> = {};

  for (const event of events) {
    switch (event.type) {
      case "launch-gate-checked": {
        const checklistId = textPayload(event, "checklistId");
        if (checklistId === undefined) {
          break;
        }
        const pointCount = numberPayload(event, "pointCount") ?? 0;
        const points: LaunchGateLedgerPointEntry[] = [];
        for (let index = 0; index < pointCount; index += 1) {
          points.push({
            point: index + 1,
            description: textPayload(event, `pointDescription.${index}`) ?? "",
            journeyEvidenceRef: textPayload(event, `pointJourneyRef.${index}`) ?? "",
            passed: booleanPayload(event, `pointPassed.${index}`),
          });
        }
        const passedCount = numberPayload(event, "passedCount") ?? points.filter((point) => point.passed).length;
        checklists[checklistId] = {
          checkedAt: textPayload(event, "checkedAt") ?? "",
          points: Object.freeze(points),
          passedCount,
          gatePassed: booleanPayload(event, "gatePassed"),
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "operator-signoff-recorded": {
        const signoffId = textPayload(event, "signoffId");
        if (signoffId === undefined) {
          break;
        }
        signoffs[signoffId] = {
          checklistRef: textPayload(event, "checklistRef") ?? "",
          signedBy: textPayload(event, "signedBy") ?? "",
          signedAt: textPayload(event, "signedAt") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        const checklistRef = textPayload(event, "checklistRef");
        if (checklistRef !== undefined && checklistRef.length > 0) {
          signedChecklists[checklistRef] = signoffId;
        }
        break;
      }
      case "release-declared": {
        const declarationId = textPayload(event, "declarationId");
        if (declarationId === undefined) {
          break;
        }
        declarations[declarationId] = {
          signoffRef: textPayload(event, "signoffRef") ?? "",
          evidenceBundleRef: textPayload(event, "evidenceBundleRef") ?? "",
          rollbackEvidenceRef: textPayload(event, "rollbackEvidenceRef") ?? "",
          declaredAt: textPayload(event, "declaredAt") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        const signoffRef = textPayload(event, "signoffRef");
        if (signoffRef !== undefined && signoffRef.length > 0) {
          declaredSignoffs[signoffRef] = declarationId;
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    solutionId,
    checklists,
    signoffs,
    declarations,
    signedChecklists,
    declaredSignoffs,
  };
}
