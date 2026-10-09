// YOU twin application service — shared internal types and helpers.
//
// The application service (twinService.ts) is the single authority over
// twin/reconstruction truth (docs/you/CONTRACTS.md "State ownership":
// TwinVersion = twin service). The flow modules (twinBindingFlow.ts,
// twinReconstructionFlow.ts) operate on the per-solution twin-plane
// records it owns, mutating only through immutable record replacement +
// append-only ledger events (twinLedgerOps.ts). The evidence authority
// stays the wave-2 evidence service; the twin lane reaches it ONLY
// through the injected TwinEvidencePort seam — no second consent or
// evidence authority exists here.

import type {
  ConsentState,
  EvidenceRecord,
  EvidenceRequest,
  OpaqueId,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  ReconstructionJobStatus,
  TwinVersion,
  YouError,
} from "@zcode/shared";
import type { ConsentDecisionOutcome } from "../../../shared/src/you/evidenceConsent.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import type { TwinRecord, TwinVersionChain } from "../../../shared/src/you/twinVersioning.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type TwinServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function twinFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface TwinServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/** Runtime state of one reconstruction job (the spec is immutable). */
export interface ReconstructionJobState {
  readonly spec: ReconstructionJobSpec;
  status: ReconstructionJobStatus;
  result: ReconstructionJobResult | null;
}

/** One twin inside a plane: its immutable record + append-only version chain. */
export interface TwinState {
  readonly record: TwinRecord;
  readonly chain: TwinVersionChain;
}

/**
 * One solution's twin plane: ledger, twins, reconstruction jobs and the
 * deficiency-remediation registry. The service is the sole writer; flows
 * receive the record and return new immutable values.
 */
export interface TwinPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  readonly twins: Map<OpaqueId, TwinState>;
  /** jobId -> job runtime state. */
  readonly jobs: Map<OpaqueId, ReconstructionJobState>;
  /** evidenceRequestId -> remediation request + the version whose deficiency triggered it. */
  readonly remediationRequests: Map<OpaqueId, RemediationRequestEntry>;
  /** deficiencyKey (class:domain) -> serving evidenceRequestId. */
  readonly remediationByDeficiencyKey: Map<string, OpaqueId>;
}

/** One registered remediation request and the version that triggered it. */
export interface RemediationRequestEntry {
  readonly request: EvidenceRequest;
  readonly twinVersionId: OpaqueId;
}

/**
 * Evidence-authority seam for binding-time enforcement. The twin lane
 * never reads the evidence plane directly; the injected port resolves a
 * record plus its live consent decision (the frozen wave-2 `canProcess`
// predicate stays the single enforcement authority).
 */
export interface TwinEvidencePort {
  /**
   * Resolves an evidence record and its live processing decision for
   * twin binding; returns null when the evidence authority does not know
   * the record.
   */
  resolveEvidenceForBinding(
    evidenceId: OpaqueId,
    purpose: import("@zcode/shared").ConsentPurpose,
  ): {
    readonly record: EvidenceRecord;
    readonly liveConsentState: ConsentState;
    readonly processing: ConsentDecisionOutcome;
  } | null;
}

/**
 * A port over the public EvidenceService API (the wave-2 authority).
 * Binding resolution + live consent state + the frozen enforcement
 * decision, with zero evidence-plane knowledge leaking into the twin lane.
 */
export function createEvidenceServicePort(
  evidence: {
    evidenceRecordOf(solutionId: OpaqueId, evidenceId: OpaqueId): TwinServiceResult<EvidenceRecord>;
    consentStateOf(solutionId: OpaqueId, policyId: OpaqueId): ConsentState;
    checkProcessing(
      solutionId: OpaqueId,
      evidenceId: OpaqueId,
      purpose: import("@zcode/shared").ConsentPurpose,
    ): TwinServiceResult<{ readonly outcome: ConsentDecisionOutcome; readonly privacyClass: string }>;
  },
  solutionId: OpaqueId,
): TwinEvidencePort {
  return {
    resolveEvidenceForBinding(evidenceId, purpose) {
      const record = evidence.evidenceRecordOf(solutionId, evidenceId);
      if (!record.ok) {
        return null;
      }
      const liveConsentState = evidence.consentStateOf(solutionId, record.value.consent.policyId);
      const check = evidence.checkProcessing(solutionId, evidenceId, purpose);
      const processing: ConsentDecisionOutcome = check.ok
        ? check.value.outcome
        : { allowed: false, reason: "evidence-check-failed" };
      return { record: record.value, liveConsentState, processing };
    },
  };
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The twin version lookup helper used by every flow. */
export function requireTwinVersion(
  plane: TwinPlaneRecord,
  twinId: OpaqueId,
  versionId: OpaqueId,
): { readonly state: TwinState; readonly version: TwinVersion } | { readonly error: YouError } {
  const state = plane.twins.get(twinId);
  if (state === undefined) {
    return {
      error: {
        code: "YOU_TWIN_NOT_FOUND",
        message: "unknown twin",
        details: { reason: "unknown-twin", twinId },
        simulated: true,
      },
    };
  }
  const version = state.chain.get(versionId);
  if (version === null) {
    return {
      error: {
        code: "YOU_VERSION_NOT_FOUND",
        message: "unknown twin version",
        details: { reason: "unknown-twin-version", twinId, versionId },
        simulated: true,
      },
    };
  }
  return { state, version };
}

/** Shared deps bundle for flows that construct domain blocks. */
export interface TwinContentDeps extends TwinServiceDeps {
  readonly store: EvidenceContentStore;
}
