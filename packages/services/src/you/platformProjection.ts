// YOU platform service — live plane projection builder.
//
// Builds the authoritative PlatformPlaneProjection from the service's
// live state in EXACTLY the shape replayPlatformLedger folds from the
// append-only event ledger (docs/you/FIXTURES.md law 10: replaying a
// ledger reproduces state exactly). The equivalence is asserted in
// tests via stableStringify; any drift between this builder and the
// fold is a bug.
//
// The builder reads the live records and applies the SAME projection
// rules as the fold:
//   - enforcement records: one entry per recorded evaluation; the
//     per-scope usage heads take the LATEST evaluation's window facts
//     (identical fold semantics);
//   - imports: quarantined and released artifacts only (clean and
//     rejected verdicts are pre-admission service state — the arena
//     provider precedent: they materialize in the ledger only through
//     their quarantine-class facts). An artifactRef is scanned exactly
//     once (re-scans are typed refusals), so the live verdict/status/
//     findings and the fold's event facts cannot diverge;
//   - retention passes: one entry per immutable pass record (the
//     consent state at decision time rides the event);
//   - DR restores: one entry per recorded attempt (verified and failed
//     alike); `activated` is the HISTORICAL event fact (a verified
//     restore activated the plane when it was recorded; a later
//     verified restore supersedes the head, but the earlier activation
//     fact stands — append-only history, never rewritten).
//
// Rate limit POLICIES are SERVICE STATE (the W6A/W8A candidate-record
// precedent — the frozen event set has no policy event) and therefore
// do not appear in the projection.

import type { OpaqueId, SolutionEvent } from "@zcode/shared";
import type {
  PlatformLedgerDrRestoreEntry,
  PlatformLedgerEnforcementEntry,
  PlatformLedgerImportEntry,
  PlatformLedgerRetentionEntry,
  PlatformPlaneProjection,
} from "../../../shared/src/you/platformLedger.js";
import type { PlatformPlaneRecord } from "./platformServiceTypes.js";
import { sortedMapKeys } from "./platformServiceTypes.js";

/** Builds the live platform-plane projection (equal to replayPlatformLedger output). */
export function buildPlatformPlaneProjection(plane: PlatformPlaneRecord): PlatformPlaneProjection {
  const enforcements: Record<string, PlatformLedgerEnforcementEntry> = {};
  const rateLimitUsage: Record<string, { windowStart: string; used: number; burst: number; windowS: number }> = {};
  const imports: Record<string, PlatformLedgerImportEntry> = {};
  const retentionPasses: Record<string, PlatformLedgerRetentionEntry> = {};
  const drRestores: Record<string, PlatformLedgerDrRestoreEntry> = {};

  const events = plane.ledger.events();

  // -- enforcement records + usage heads (the fold's latest-per-scope rule) -
  for (const event of events) {
    if (event.type !== "rate-limit-enforced") {
      continue;
    }
    const enforcementId = eventPayloadText(event, "enforcementId");
    if (enforcementId === "") {
      continue;
    }
    const scope = eventPayloadText(event, "scope");
    const windowStart = eventPayloadText(event, "windowStart");
    const used = eventPayloadNumber(event, "used");
    const burst = eventPayloadNumber(event, "burst");
    const windowS = eventPayloadNumber(event, "windowS");
    const outcomeText = eventPayloadText(event, "outcome");
    enforcements[enforcementId] = {
      policyId: eventPayloadText(event, "policyId"),
      scope,
      action: eventPayloadText(event, "action"),
      outcome: outcomeText === "exceeded" ? "exceeded" : "allowed",
      reason: eventPayloadText(event, "reason"),
      subject: eventPayloadText(event, "subject"),
      windowStart,
      used,
      burst,
      windowS,
      checkedAt: eventPayloadText(event, "checkedAt"),
      simulated: eventPayloadBoolean(event, "simulated"),
    };
    // The usage head: the LATEST evaluation per scope wins (fold rule).
    rateLimitUsage[scope] = { windowStart, used, burst, windowS };
  }

  // -- imports (quarantined/released only; the lifecycle heads) ------------
  for (const artifactRef of sortedMapKeys(plane.importStatuses)) {
    const status = plane.importStatuses.get(artifactRef);
    if (status === undefined || (status !== "quarantined" && status !== "released")) {
      continue;
    }
    const verdict = plane.importVerdicts.get(artifactRef);
    if (verdict === undefined) {
      continue;
    }
    const findings = (plane.importFindings.get(artifactRef) ?? []).map((finding) => ({
      signature: finding.signature,
      severity: finding.severity,
    }));
    const release = status === "released" ? latestReleaseFor(plane, artifactRef) : null;
    imports[artifactRef] = {
      verdictId: verdict.id,
      scanClass: verdict.scanClass,
      verdict: verdict.verdict,
      quarantinedAt: verdict.quarantinedAt ?? "",
      findingCount: findings.length,
      findings: Object.freeze(findings),
      status,
      releaseId: release?.id ?? "",
      releasedBy: release?.releasedBy ?? "",
      releaseReason: release?.reason ?? "",
      releasedAt: release?.releasedAt ?? "",
      simulated: true,
    };
  }

  // -- retention passes (immutable, auditable) ------------------------------
  for (const recordId of sortedMapKeys(plane.retentionPasses)) {
    const record = plane.retentionPasses.get(recordId);
    if (record === undefined) {
      continue;
    }
    retentionPasses[recordId] = {
      retentionClass: record.retentionClass,
      subjectRef: record.subjectRef,
      enforcedAt: record.enforcedAt,
      consentState: eventFactOf(plane, "retention-enforced", "recordId", recordId, "consentState"),
      simulated: true,
    };
  }

  // -- DR restores (verified and failed attempts; the event's facts) ---------
  for (const restoreId of sortedMapKeys(plane.drRestores)) {
    const record = plane.drRestores.get(restoreId);
    if (record === undefined) {
      continue;
    }
    const activated = eventFactBooleanOf(plane, "dr-restore-recorded", "restoreId", restoreId, "activated");
    drRestores[restoreId] = {
      snapshotRef: record.snapshotRef,
      restoredAt: record.restoredAt,
      verified: record.verified,
      activated,
      checkEvidencePresent: eventFactBooleanOf(plane, "dr-restore-recorded", "restoreId", restoreId, "checkEvidencePresent"),
      expectedHash: eventFactOf(plane, "dr-restore-recorded", "restoreId", restoreId, "expectedHash"),
      actualHash: eventFactOf(plane, "dr-restore-recorded", "restoreId", restoreId, "actualHash"),
      byteLength: eventFactNumberOf(plane, "dr-restore-recorded", "restoreId", restoreId, "byteLength"),
      refusalReason: eventFactOf(plane, "dr-restore-recorded", "restoreId", restoreId, "refusalReason"),
      simulated: true,
    };
  }

  return {
    solutionId: plane.solutionId,
    enforcements,
    rateLimitUsage,
    imports,
    retentionPasses,
    drRestores,
  };
}

/** The latest release record for an artifact (append-only; the last wins). */
function latestReleaseFor(
  plane: PlatformPlaneRecord,
  artifactRef: OpaqueId,
): { readonly id: OpaqueId; readonly releasedBy: OpaqueId; readonly reason: string; readonly releasedAt: string } | null {
  let latest: { readonly id: OpaqueId; readonly releasedBy: OpaqueId; readonly reason: string; readonly releasedAt: string } | null = null;
  for (const releaseId of sortedMapKeys(plane.importReleases)) {
    const release = plane.importReleases.get(releaseId);
    if (release === undefined || release.artifactRef !== artifactRef) {
      continue;
    }
    if (latest === null || release.releasedAt >= latest.releasedAt) {
      latest = release;
    }
  }
  return latest;
}

function eventPayloadText(event: SolutionEvent, key: string): string {
  const value = event.payload[key];
  return typeof value === "string" ? value : "";
}

function eventPayloadNumber(event: SolutionEvent, key: string): number {
  const value = event.payload[key];
  return typeof value === "number" ? value : 0;
}

function eventPayloadBoolean(event: SolutionEvent, key: string): boolean {
  return event.payload[key] === true;
}

/** Reads a text fact from the (unique) event of `type` whose keyed id matches. */
function eventFactOf(plane: PlatformPlaneRecord, type: string, idKey: string, id: OpaqueId, factKey: string): string {
  const event = plane.ledger
    .events()
    .find((candidate) => candidate.type === type && candidate.payload[idKey] === id);
  const value = event?.payload[factKey];
  return typeof value === "string" ? value : "";
}

/** Reads a numeric fact from the (unique) event of `type` whose keyed id matches. */
function eventFactNumberOf(plane: PlatformPlaneRecord, type: string, idKey: string, id: OpaqueId, factKey: string): number {
  const event = plane.ledger
    .events()
    .find((candidate) => candidate.type === type && candidate.payload[idKey] === id);
  const value = event?.payload[factKey];
  return typeof value === "number" ? value : 0;
}

/** Reads a boolean fact from the (unique) event of `type` whose keyed id matches. */
function eventFactBooleanOf(plane: PlatformPlaneRecord, type: string, idKey: string, id: OpaqueId, factKey: string): boolean {
  const event = plane.ledger
    .events()
    .find((candidate) => candidate.type === type && candidate.payload[idKey] === id);
  return event?.payload[factKey] === true;
}
