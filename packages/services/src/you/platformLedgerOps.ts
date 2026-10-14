// YOU platform service — ledger event emission helpers.
//
// Append-only event helpers following the W1A/W7A/W8A precedent
// (solutionLedgerOps.ts / embodimentLedgerOps.ts / arenaLedgerOps.ts):
// per-record status facts ride along in event payloads because the
// frozen SolutionEventType set has no per-record status events — the
// frozen `import-quarantined` event is the import lifecycle carrier
// (phase "quarantined" for the quarantine birth, phase "released" for
// the explicit release record — the W7A status-carrier precedent), the
// `rate-limit-enforced` event IS the enforcement record, and the DR
// verification evidence rides `dr-restore-recorded`. Payload
// conventions are folded by shared/src/you/platformLedger.ts
// replayPlatformLedger. Every record id mints from the injected id
// factory at the flow seam (opaque ids, deterministic in fixture mode).
//
// Truth law: every payload carries simulated: true in fixture mode.

import type { DrRestoreRecord, ImportSecurityVerdict, OpaqueId, RetentionEnforcementRecord } from "@zcode/shared";
import type { ImportReleaseRecord, ImportScanFinding } from "../../../shared/src/you/importSecurity.js";
import type { PlatformPlaneRecord } from "./platformServiceTypes.js";
import type { RateLimitGateFacts } from "./rateLimitFlow.js";

/** Appends rate-limit-enforced — the immutable enforcement record (every gate evaluation). */
export function appendRateLimitEnforced(
  plane: PlatformPlaneRecord,
  enforcementId: OpaqueId,
  facts: RateLimitGateFacts & { readonly checkedAt: string },
): void {
  plane.ledger.append({
    type: "rate-limit-enforced",
    subjectRef: enforcementId,
    generator: "agent",
    payload: {
      enforcementId,
      policyId: facts.policyId,
      scope: facts.scope,
      action: facts.action,
      outcome: facts.outcome,
      reason: facts.reason,
      subject: facts.subject,
      windowStart: facts.windowStart,
      used: facts.used,
      burst: facts.burst,
      windowS: facts.windowS,
      checkedAt: facts.checkedAt,
      simulated: true,
    },
  });
}

/** Appends import-quarantined (phase "quarantined" — the fail-closed quarantine birth). */
export function appendImportQuarantined(
  plane: PlatformPlaneRecord,
  input: {
    readonly phase: "quarantined";
    readonly verdict: ImportSecurityVerdict;
    readonly findings: readonly ImportScanFinding[];
  },
): void;

/** Appends import-quarantined (phase "released" — the explicit release record, the only path out). */
export function appendImportQuarantined(
  plane: PlatformPlaneRecord,
  input: {
    readonly phase: "released";
    readonly verdict: ImportSecurityVerdict;
    readonly findings: readonly ImportScanFinding[];
    readonly release: ImportReleaseRecord;
  },
): void;

export function appendImportQuarantined(
  plane: PlatformPlaneRecord,
  input: {
    readonly phase: "quarantined" | "released";
    readonly verdict: ImportSecurityVerdict;
    readonly findings: readonly ImportScanFinding[];
    readonly release?: ImportReleaseRecord;
  },
): void {
  const payload: Record<string, string | number | boolean> = {
    verdictId: input.verdict.id,
    artifactRef: input.verdict.artifactRef,
    scanClass: input.verdict.scanClass,
    verdict: input.verdict.verdict,
    quarantinedAt: input.verdict.quarantinedAt ?? "",
    findingCount: input.findings.length,
    phase: input.phase,
    releaseId: "",
    releasedBy: "",
    releaseReason: "",
    releasedAt: "",
    simulated: true,
  };
  input.findings.forEach((finding, index) => {
    payload[`finding.${index}`] = finding.signature;
    payload[`findingSeverity.${index}`] = finding.severity;
  });
  if (input.phase === "released" && input.release !== undefined) {
    payload["releaseId"] = input.release.id;
    payload["releasedBy"] = input.release.releasedBy;
    payload["releaseReason"] = input.release.reason;
    payload["releasedAt"] = input.release.releasedAt;
  }
  plane.ledger.append({
    type: "import-quarantined",
    subjectRef: input.verdict.artifactRef,
    generator: "user",
    payload,
  });
}

/** Appends retention-enforced — one immutable auditable pass. */
export function appendRetentionEnforced(
  plane: PlatformPlaneRecord,
  record: RetentionEnforcementRecord,
  consentState: string,
): void {
  plane.ledger.append({
    type: "retention-enforced",
    subjectRef: record.id,
    generator: "agent",
    payload: {
      recordId: record.id,
      retentionClass: record.retentionClass,
      subjectRef: record.subjectRef,
      enforcedAt: record.enforcedAt,
      consentState,
      simulated: true,
    },
  });
}

/** The extra fold facts a DR restore event carries (the check evidence + activation). */
export interface DrRestoreEventFacts {
  readonly activated: boolean;
  readonly checkEvidencePresent: boolean;
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly byteLength: number;
  readonly refusalReason: string;
}

/** Appends dr-restore-recorded (verification evidence rides the event; activated marks the head). */
export function appendDrRestoreRecorded(plane: PlatformPlaneRecord, record: DrRestoreRecord, facts: DrRestoreEventFacts): void {
  plane.ledger.append({
    type: "dr-restore-recorded",
    subjectRef: record.id,
    generator: "agent",
    payload: {
      restoreId: record.id,
      snapshotRef: record.snapshotRef,
      restoredAt: record.restoredAt,
      verified: record.verified,
      activated: facts.activated,
      checkEvidencePresent: facts.checkEvidencePresent,
      expectedHash: facts.expectedHash,
      actualHash: facts.actualHash,
      byteLength: facts.byteLength,
      refusalReason: facts.refusalReason,
      simulated: true,
    },
  });
}
