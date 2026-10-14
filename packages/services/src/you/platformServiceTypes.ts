// YOU platform application service — shared internal types and helpers.
//
// The application service (platformService.ts) is the single authority
// over platform-hardening truth (docs/you/CONTRACTS.md "Wave-10
// contract freeze (v10)"; WORK_ORDERS.md W10A): rate-limit policies +
// enforcement records, import security verdicts + quarantine, retention
// enforcement passes and DR restore verification. The plane separation
// holds by construction: the service NEVER mutates evidence/twin/
// editing state; a retention pass records its class becoming due (the
// content effect stays with the evidence authority), and the limiter
// gates every effect op BEFORE the effect runs (the RATE LIMIT LAW's
// enforcement-before-effect, by construction). The stateless validators
// stay the single refusal authority (shared/src/you/rateLimitPolicy.ts,
// importSecurity.ts, retentionEnforcement.ts, drRestore.ts); nothing
// here is a second validator.
//
// Error-code mapping (frozen W10A taxonomy):
//   YOU_RATE_LIMIT_EXCEEDED         — every exceeded gate decision
//                                      (deny/defer/shed alike; never
//                                      silent)
//   YOU_IMPORT_QUARANTINED          — admission gates (unscanned /
//                                      quarantined / rejected) and the
//                                      quarantine lifecycle violations
//                                      (release only via explicit
//                                      records, rejected is terminal)
//   YOU_RETENTION_ENFORCEMENT_INVALID — consent-protected passes, class/
//                                      shape gates, unknown pass lookups
//   YOU_DR_RESTORE_INVALID          — verification failures
//                                      (snapshot-missing / hash-mismatch
//                                      / verified-without-evidence) and
//                                      unknown restore lookups
//   YOU_INVALID_STATE               — rate-limit policy intake shape
//                                      (the v1 solution-flow precedent —
//                                      the frozen wave-10 code set has no
//                                      policy-intake code; the domain
//                                      code YOU_RATE_LIMIT_EXCEEDED
//                                      belongs to enforcement only)

import type {
  DrRestoreRecord,
  ImportSecurityVerdict,
  OpaqueId,
  RateLimitPolicy,
  RetentionEnforcementRecord,
  YouError,
} from "@zcode/shared";
import type { ImportQuarantineStatus, ImportReleaseRecord, ImportScanFinding } from "../../../shared/src/you/importSecurity.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type PlatformServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function platformFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

/** The deps every platform flow receives (injected clock/ids + the content store). */
export interface PlatformFlowDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
  readonly store: EvidenceContentStore;
}

/** The fixed-window limiter state per scope (service state; the usage heads also reconstruct from the ledger). */
export interface RateLimitUsageState {
  /** ISO-8601 window start (the clock reading at the window's first evaluation). */
  windowStart: string;
  /** Units consumed by allowed decisions in the current window. */
  used: number;
}

/**
 * One solution's platform plane: the append-only ledger, the per-scope
 * rate-limit policy registries + window counters, the import verdict
 * registry + quarantine lifecycle heads + explicit release records, the
 * retention enforcement passes and the DR restore records. The service
 * is the sole writer; records are immutable and every enforcement /
 * lifecycle change rides the ledger.
 */
export interface PlatformPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** scope -> policies in registration order (the HEAD is active; service state, the W6A/W8A candidate precedent). */
  readonly policies: Map<string, RateLimitPolicy[]>;
  /** scope -> the fixed-window usage head. */
  readonly rateLimitUsage: Map<string, RateLimitUsageState>;
  /** artifactRef -> immutable ImportSecurityVerdict head (the latest scan). */
  readonly importVerdicts: Map<OpaqueId, ImportSecurityVerdict>;
  /** artifactRef -> the scan findings of the latest scan (the fold facts ride the events). */
  readonly importFindings: Map<OpaqueId, readonly ImportScanFinding[]>;
  /** artifactRef -> quarantine lifecycle head (clean/quarantined/released/rejected). */
  readonly importStatuses: Map<OpaqueId, ImportQuarantineStatus>;
  /** releaseId -> immutable explicit release record. */
  readonly importReleases: Map<OpaqueId, ImportReleaseRecord>;
  /** recordId -> immutable retention enforcement pass. */
  readonly retentionPasses: Map<OpaqueId, RetentionEnforcementRecord>;
  /** restoreId -> immutable DR restore record (verified and failed attempts alike). */
  readonly drRestores: Map<OpaqueId, DrRestoreRecord>;
  /** The activated restore head (only a VERIFIED restore ever holds this; null until one exists). */
  activeRestoreId: OpaqueId | null;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The active (head) policy for a scope, or null when none is registered (no limit configured). */
export function activePolicyForScope(plane: PlatformPlaneRecord, scope: string): RateLimitPolicy | null {
  const chain = plane.policies.get(scope);
  const head = chain?.[chain.length - 1];
  return head ?? null;
}

/** The import lifecycle lookup: null means unscanned (fail-closed by the admission gate). */
export function readImportStatus(plane: PlatformPlaneRecord, artifactRef: OpaqueId): ImportQuarantineStatus | null {
  return plane.importStatuses.get(artifactRef) ?? null;
}

/** The import verdict lookup helper used by read paths. */
export function requireImportVerdict(
  plane: PlatformPlaneRecord,
  artifactRef: OpaqueId,
): { readonly verdict: ImportSecurityVerdict } | { readonly error: YouError } {
  const verdict = plane.importVerdicts.get(artifactRef);
  if (verdict === undefined) {
    return {
      error: {
        code: "YOU_IMPORT_QUARANTINED",
        message: "unknown import (unscanned)",
        details: { reason: "unscanned-import", artifactRef },
        simulated: true,
      },
    };
  }
  return { verdict };
}

/** The DR restore lookup helper: typed YOU_DR_RESTORE_INVALID. */
export function requireDrRestore(
  plane: PlatformPlaneRecord,
  restoreId: OpaqueId,
): { readonly record: DrRestoreRecord } | { readonly error: YouError } {
  const record = plane.drRestores.get(restoreId);
  if (record === undefined) {
    return {
      error: {
        code: "YOU_DR_RESTORE_INVALID",
        message: "unknown DR restore",
        details: { reason: "unknown-restore", restoreId },
        simulated: true,
      },
    };
  }
  return { record };
}
