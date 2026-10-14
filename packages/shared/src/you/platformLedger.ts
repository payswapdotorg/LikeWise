// YOU platform-plane ledger replay (W10A — docs/you/FIXTURES.md law 10:
// append-only history; replaying a ledger reproduces state exactly).
//
// The platform application service appends the four wave-10 platform
// events (rate-limit-enforced / import-quarantined / retention-enforced
// / dr-restore-recorded) into the W1A SolutionEventLedger machinery.
// Payload conventions follow the W1A/W7A ride-along precedent
// ("per-record status facts ride along in event payloads because the
// frozen SolutionEventType set has no per-record status events"):
//
//   rate-limit-enforced  { enforcementId, policyId, scope, action,
//                          outcome: "allowed" | "exceeded", reason,
//                          subject, windowStart, used, burst, windowS,
//                          checkedAt, simulated }
//                          — THE enforcement record (the RATE LIMIT LAW:
//                          every gate evaluation appends one; the fold
//                          reconstructs the per-scope window usage heads,
//                          making the ledger authoritative for the
//                          limiter state).
//   import-quarantined   { verdictId, artifactRef, scanClass, verdict,
//                          quarantinedAt ("" when null), findingCount,
//                          finding.<i>, findingSeverity.<i>,
//                          phase: "quarantined" | "released",
//                          releaseId ("" unless phase released),
//                          releasedBy ("" unless phase released),
//                          releaseReason ("" unless phase released),
//                          releasedAt ("" unless phase released),
//                          simulated }
//                          — the quarantine lifecycle carrier (the only
//                          frozen import event): quarantine birth rides
//                          phase "quarantined"; the explicit release
//                          record rides phase "released" (the W7A
//                          status-carrier precedent). Clean and rejected
//                          verdicts are pre-admission SERVICE STATE (the
//                          arena provider precedent: descriptors
//                          materialize in the ledger only through
//                          delivery facts) and therefore do not appear
//                          in the fold.
//   retention-enforced   { recordId, retentionClass, subjectRef,
//                          enforcedAt, consentState, simulated }
//                          — one immutable auditable pass.
//   dr-restore-recorded  { restoreId, snapshotRef, restoredAt,
//                          verified, activated, checkEvidencePresent,
//                          expectedHash, actualHash ("" when unchecked),
//                          byteLength (0 when unchecked),
//                          refusalReason ("" on a verified restore),
//                          simulated }
//                          — the DR LAW carrier: verification evidence
//                          rides the event; activated marks the restore
//                          head (only a verified restore ever activates).
//
// Rate limit POLICIES are pre-validation SERVICE STATE (the W6A/W8A
// candidate-record precedent — the frozen event set has no policy
// event) and therefore do not appear in the fold; the usage heads DO
// (every evaluation appends its used count).
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

/** Enforcement-record facts as reconstructable from ledger payloads. */
export interface PlatformLedgerEnforcementEntry {
  readonly policyId: string;
  readonly scope: string;
  readonly action: string;
  readonly outcome: "allowed" | "exceeded";
  readonly reason: string;
  readonly subject: string;
  readonly windowStart: string;
  readonly used: number;
  readonly burst: number;
  readonly windowS: number;
  readonly checkedAt: string;
  readonly simulated: boolean;
}

/** Import lifecycle facts as reconstructable from ledger payloads (quarantined or released imports only). */
export interface PlatformLedgerImportEntry {
  readonly verdictId: string;
  readonly scanClass: string;
  readonly verdict: string;
  readonly quarantinedAt: string;
  readonly findingCount: number;
  readonly findings: readonly { readonly signature: string; readonly severity: string }[];
  /** quarantined | released (the lifecycle head). */
  readonly status: string;
  /** The explicit release record id ("" while quarantined). */
  readonly releaseId: string;
  readonly releasedBy: string;
  readonly releaseReason: string;
  readonly releasedAt: string;
  readonly simulated: boolean;
}

/** Retention-pass facts as reconstructable from ledger payloads. */
export interface PlatformLedgerRetentionEntry {
  readonly retentionClass: string;
  readonly subjectRef: string;
  readonly enforcedAt: string;
  readonly consentState: string;
  readonly simulated: boolean;
}

/** DR-restore facts as reconstructable from ledger payloads. */
export interface PlatformLedgerDrRestoreEntry {
  readonly snapshotRef: string;
  readonly restoredAt: string;
  readonly verified: boolean;
  readonly activated: boolean;
  readonly checkEvidencePresent: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly byteLength: number;
  readonly refusalReason: string;
  readonly simulated: boolean;
}

export interface PlatformPlaneProjection {
  readonly solutionId: string;
  /** enforcementId -> enforcement record facts. */
  readonly enforcements: Readonly<Record<string, PlatformLedgerEnforcementEntry>>;
  /** The per-scope limiter usage heads reconstructed from enforcement records. */
  readonly rateLimitUsage: Readonly<Record<string, { readonly windowStart: string; readonly used: number; readonly burst: number; readonly windowS: number }>>;
  /** artifactRef -> import lifecycle facts (quarantined/released only). */
  readonly imports: Readonly<Record<string, PlatformLedgerImportEntry>>;
  /** recordId -> retention pass facts. */
  readonly retentionPasses: Readonly<Record<string, PlatformLedgerRetentionEntry>>;
  /** restoreId -> DR restore facts. */
  readonly drRestores: Readonly<Record<string, PlatformLedgerDrRestoreEntry>>;
}

/**
 * Folds platform-plane ledger events into the authoritative projection.
 * Same events => same projection (byte-identical under stableStringify).
 * Events referencing unknown records fold defensively (ignored),
 * mirroring the W1A/W3A/W7A/W8A total-fold precedent.
 */
export function replayPlatformLedger(events: readonly SolutionEvent[]): PlatformPlaneProjection {
  if (events.length === 0) {
    throw new Error("replayPlatformLedger requires at least one event");
  }
  const solutionId = events[0]?.solutionId ?? "";
  const enforcements: Record<string, PlatformLedgerEnforcementEntry> = {};
  const rateLimitUsage: Record<string, { windowStart: string; used: number; burst: number; windowS: number }> = {};
  const imports: Record<string, PlatformLedgerImportEntry> = {};
  const retentionPasses: Record<string, PlatformLedgerRetentionEntry> = {};
  const drRestores: Record<string, PlatformLedgerDrRestoreEntry> = {};

  for (const event of events) {
    switch (event.type) {
      case "rate-limit-enforced": {
        const enforcementId = textPayload(event, "enforcementId");
        if (enforcementId === undefined) {
          break;
        }
        const scope = textPayload(event, "scope") ?? "";
        const outcomeText = textPayload(event, "outcome") ?? "allowed";
        const outcome: "allowed" | "exceeded" = outcomeText === "exceeded" ? "exceeded" : "allowed";
        const used = numberPayload(event, "used") ?? 0;
        const windowStart = textPayload(event, "windowStart") ?? "";
        const burst = numberPayload(event, "burst") ?? 0;
        const windowS = numberPayload(event, "windowS") ?? 0;
        enforcements[enforcementId] = {
          policyId: textPayload(event, "policyId") ?? "",
          scope,
          action: textPayload(event, "action") ?? "deny",
          outcome,
          reason: textPayload(event, "reason") ?? "",
          subject: textPayload(event, "subject") ?? "",
          windowStart,
          used,
          burst,
          windowS,
          checkedAt: textPayload(event, "checkedAt") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        // The usage head: the LATEST evaluation per scope wins.
        rateLimitUsage[scope] = { windowStart, used, burst, windowS };
        break;
      }
      case "import-quarantined": {
        const artifactRef = textPayload(event, "artifactRef");
        if (artifactRef === undefined) {
          break;
        }
        const findingCount = numberPayload(event, "findingCount") ?? 0;
        const findings: { signature: string; severity: string }[] = [];
        for (let index = 0; index < findingCount; index += 1) {
          const signature = textPayload(event, `finding.${index}`);
          const severity = textPayload(event, `findingSeverity.${index}`);
          if (signature !== undefined) {
            findings.push({ signature, severity: severity ?? "" });
          }
        }
        const phase = textPayload(event, "phase") === "released" ? "released" : "quarantined";
        const releaseId = textPayload(event, "releaseId") ?? "";
        const quarantinedAt = textPayload(event, "quarantinedAt") ?? "";
        imports[artifactRef] = {
          verdictId: textPayload(event, "verdictId") ?? "",
          scanClass: textPayload(event, "scanClass") ?? "",
          verdict: textPayload(event, "verdict") ?? "quarantined",
          quarantinedAt,
          findingCount,
          findings: Object.freeze(findings),
          status: phase,
          releaseId: phase === "released" ? releaseId : "",
          releasedBy: phase === "released" ? textPayload(event, "releasedBy") ?? "" : "",
          releaseReason: phase === "released" ? textPayload(event, "releaseReason") ?? "" : "",
          releasedAt: phase === "released" ? textPayload(event, "releasedAt") ?? "" : "",
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "retention-enforced": {
        const recordId = textPayload(event, "recordId");
        if (recordId === undefined) {
          break;
        }
        retentionPasses[recordId] = {
          retentionClass: textPayload(event, "retentionClass") ?? "",
          subjectRef: textPayload(event, "subjectRef") ?? "",
          enforcedAt: textPayload(event, "enforcedAt") ?? "",
          consentState: textPayload(event, "consentState") ?? "",
          simulated: booleanPayload(event, "simulated"),
        };
        break;
      }
      case "dr-restore-recorded": {
        const restoreId = textPayload(event, "restoreId");
        if (restoreId === undefined) {
          break;
        }
        drRestores[restoreId] = {
          snapshotRef: textPayload(event, "snapshotRef") ?? "",
          restoredAt: textPayload(event, "restoredAt") ?? "",
          verified: booleanPayload(event, "verified"),
          activated: booleanPayload(event, "activated"),
          checkEvidencePresent: booleanPayload(event, "checkEvidencePresent"),
          expectedHash: textPayload(event, "expectedHash") ?? "",
          actualHash: textPayload(event, "actualHash") ?? "",
          byteLength: numberPayload(event, "byteLength") ?? 0,
          refusalReason: textPayload(event, "refusalReason") ?? "",
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
    enforcements,
    rateLimitUsage,
    imports,
    retentionPasses,
    drRestores,
  };
}
