// YOU learning application service — shared internal types and helpers
// (W6A).
//
// The application service (learningService.ts) is the single authority
// over learning truth (docs/you/CONTRACTS.md "State ownership":
// learning candidates = learning service — the wave-6 learning plane).
// The flow modules (learningSignalFlow.ts, learningRecordFlow.ts,
// learningPreferenceFlow.ts, learningTrajectoryFlow.ts) operate on the
// per-solution learning-plane records the service owns, mutating only
// through immutable record replacement + append-only ledger events
// (learningLedgerOps.ts). Nothing here is a second authority.
//
// RIGHTS LAW (wave-6 core): a learning record is usable only within its
// LearningRights consent grant (consentRef + consentHash traceable to
// the wave-2 consent authority — there is no second consent path). The
// learning lane reaches the wave-2 consent authority ONLY through the
// injected LearningConsentPort seam: the port resolves the live grant
// facts (policy + live state) for a consent ref, and the stateless
// evaluator in shared/src/you/learningRights.ts owns the decision.
//
// Candidate records are PRE-VALIDATION SERVICE STATE (the frozen wave-6
// event set defines no candidate event — the W4A template-library /
// W5A subject-registry precedent); they materialize in the replayable
// projection at validation/rejection time. The trajectory registry is
// service state for the same reason.

import type {
  ConsentPolicy,
  ConsentState,
  LearningPreference,
  LearningRecord,
  LearningSignal,
  OpaqueId,
  TrajectoryReference,
  YouError,
} from "@zcode/shared";
import type { LearningGrantFacts } from "../../../shared/src/you/learningRights.js";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type LearningServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function learningFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

export interface LearningServiceDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/**
 * Consent-authority seam for learning-rights enforcement (the RIGHTS
 * LAW). The learning lane never reads the wave-2 evidence/consent plane
 * directly; the injected port resolves the live grant facts for a
 * consent ref (the wave-2 ConsentPolicy facts + the LIVE state), or
 * null when the consent authority does not know the ref. The frozen
 * shared evaluator (evaluateLearningRights) stays the single
 * enforcement authority — there is no second consent path.
 */
export interface LearningConsentPort {
  resolveLearningGrant(consentRef: string): LearningGrantFacts | null;
}

/** A port over the public EvidenceService API (the wave-2 authority). */
export function createEvidenceServicePort(
  evidence: {
    consentStateOf(solutionId: OpaqueId, policyId: OpaqueId): ConsentState;
  },
  solutionId: OpaqueId,
  /** Policies as issued (returned) by the wave-2 authority; live state is re-resolved per call. */
  policies: Iterable<ConsentPolicy>,
): LearningConsentPort {
  const known = new Map<string, ConsentPolicy>();
  for (const policy of policies) {
    known.set(policy.id, policy);
  }
  return {
    resolveLearningGrant(consentRef: string): LearningGrantFacts | null {
      const policy = known.get(consentRef);
      if (policy === undefined) {
        return null;
      }
      return {
        policyId: policy.id,
        state: evidence.consentStateOf(solutionId, policy.id),
        scope: policy.scope,
        purposes: [...policy.purposes],
        learningReuse: policy.learningReuse,
        operationalUse: policy.operationalUse,
      };
    },
  };
}

/**
 * A consent port over an in-memory consent registry (fixture/lab
 * wiring): grants are resolved from the registered policies with their
 * live states. The wave-2 ConsentRegistry semantics stay the authority.
 */
export function createRegistryBackedConsentPort(
  registry: {
    policyOf(policyId: OpaqueId): ConsentPolicy | null;
    stateOf(policyId: OpaqueId): ConsentState;
  },
): LearningConsentPort {
  return {
    resolveLearningGrant(consentRef: string): LearningGrantFacts | null {
      const policy = registry.policyOf(consentRef);
      if (policy === null) {
        return null;
      }
      return {
        policyId: policy.id,
        state: registry.stateOf(policy.id),
        scope: policy.scope,
        purposes: [...policy.purposes],
        learningReuse: policy.learningReuse,
        operationalUse: policy.operationalUse,
      };
    },
  };
}

/**
 * One solution's learning plane: ledger, signals, records (candidates +
 * resolved), the preference projection and the trajectory registry.
 * The service is the sole writer; flows receive the record and return
 * new immutable values.
 */
export interface LearningPlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** signalId -> immutable LearningSignal (append-only). */
  readonly signals: Map<OpaqueId, LearningSignal>;
  /** signal ids in capture order (listing). */
  readonly signalIds: OpaqueId[];
  /** recordId -> immutable LearningRecord (immutable replacement on ladder transitions). */
  readonly records: Map<OpaqueId, LearningRecord>;
  /** record ids in opening order (listing). */
  readonly recordIds: OpaqueId[];
  /** `${scope}::${key}` -> the latest immutable preference projection. */
  readonly preferences: Map<string, LearningPreference>;
  /** trajectoryId -> immutable TrajectoryReference (append-only registry; service state). */
  readonly trajectories: Map<OpaqueId, TrajectoryReference>;
  /** trajectory ids in registration order (listing). */
  readonly trajectoryIds: OpaqueId[];
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedLearningIds<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The learning-record lookup helper (typed YOU_LEARNING_RECORD_NOT_FOUND). */
export function requireLearningRecord(
  plane: LearningPlaneRecord,
  recordId: OpaqueId,
): { readonly record: LearningRecord } | { readonly error: YouError } {
  const record = plane.records.get(recordId);
  if (record === undefined) {
    return {
      error: {
        code: "YOU_LEARNING_RECORD_NOT_FOUND",
        message: "unknown learning record",
        details: { reason: "unknown-learning-record", recordId },
        simulated: true,
      },
    };
  }
  return { record };
}

/** Refusal for ladder operations on records outside the expected status (typed YOU_INVALID_STATE). */
export function recordNotInStatus(recordId: OpaqueId, expected: string, actual: string): { readonly ok: false; readonly error: YouError } {
  return learningFailure("YOU_INVALID_STATE", `learning record ${recordId} is ${actual}, not ${expected}`, {
    reason: `record-not-${expected}`,
    recordId,
    status: actual,
  });
}
