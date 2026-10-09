// YOU evidence application service — the single authority over
// evidence/capture/consent truth (docs/you/CONTRACTS.md "State
// ownership"; WORK_ORDERS.md W2A).
//
// UI/HTTP/SDK/MCP all call this same authority; there is no UI-only
// mutation path. The service owns one evidence plane per solution
// (append-only SolutionEventLedger + consent registry + capture session /
// evidence record / review stores) and the content store. Phase 0 is
// fully deterministic: injected clock + seeded RNG; synthetic evidence
// stays labeled `simulated: true` (truth law); a hash mismatch is a
// typed error, never a repair.

import type {
  CaptureSession,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  EvidenceRecord,
  EvidenceReview,
  OpaqueId,
  SolutionEvent,
} from "@zcode/shared";
import type { ConsentPolicy } from "@zcode/shared";
import { createDeterministicClock, type YouClock } from "../../../shared/src/you/clock.js";
import type { ConsentDecisionOutcome } from "../../../shared/src/you/evidenceConsent.js";
import { ConsentRegistry } from "../../../shared/src/you/evidenceConsent.js";
import { replayEvidenceLedger, type EvidencePlaneProjection } from "../../../shared/src/you/evidenceLedger.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { SolutionEventLedger } from "../../../shared/src/you/events.js";
import { createRngIdFactory } from "../../../shared/src/you/ids.js";
import { createDeterministicRng, seedFromString, type YouRng } from "../../../shared/src/you/rng.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";
import { stableContentHash } from "../../../shared/src/you/serialize.js";
import {
  decideConsentOp,
  checkLearningOp,
  checkProcessingOp,
  expireConsentOp,
  registerConsentPolicyOp,
  withdrawConsentOp,
  type RegisterConsentPolicyInput,
} from "./evidenceConsentFlow.js";
import {
  completeCaptureSessionOp,
  declineCaptureSessionOp,
  expireCaptureSessionOp,
  openCaptureSessionOp,
  type OpenCaptureSessionInput,
} from "./evidenceCaptureFlow.js";
import {
  readEvidenceContentOp,
  recordEvidenceOp,
  sweepRetentionOp,
  verifyEvidenceIntegrityOp,
  type EvidenceContentRead,
  type RecordEvidenceInput,
} from "./evidenceRecordFlow.js";
import {
  resolveEvidenceReviewOp,
  reviewEvidenceOp,
  type ReviewEvidenceInput,
} from "./evidenceReviewFlow.js";
import type {
  EvidencePlaneRecord,
  EvidenceServiceDeps,
  EvidenceServiceResult,
} from "./evidenceServiceTypes.js";
import { sortedKeys } from "./evidenceServiceTypes.js";

export interface EvidenceServiceConfig {
  readonly workspaceIdentity: string;
  readonly seed?: number | string;
  readonly clock?: YouClock;
  readonly contentStore?: EvidenceContentStore;
}

/** The application-service authority over evidence truth. */
export class EvidenceService {
  private readonly planes = new Map<OpaqueId, EvidencePlaneRecord>();
  private readonly deps: EvidenceServiceDeps;
  private readonly contentStore: EvidenceContentStore;
  private readonly contentRng: YouRng;

  private constructor(
    readonly workspaceIdentity: string,
    clock: YouClock,
    ids: YouIdFactory,
    contentStore: EvidenceContentStore,
    contentRng: YouRng,
  ) {
    this.deps = { clock, ids };
    this.contentStore = contentStore;
    this.contentRng = contentRng;
  }

  /** Creates a deterministic service (injected clock + seeded ids/content). */
  static create(config: EvidenceServiceConfig): EvidenceService {
    const seed = config.seed ?? "you-w2a-evidence-service";
    const numericSeed = typeof seed === "number" ? seed >>> 0 : seedFromString(seed);
    return new EvidenceService(
      config.workspaceIdentity,
      config.clock ?? createDeterministicClock(),
      createRngIdFactory(createDeterministicRng(numericSeed)),
      config.contentStore ?? createFixtureEvidenceContentStore(),
      createDeterministicRng(numericSeed ^ 0x5eed_0000),
    );
  }

  // -- consent -----------------------------------------------------------

  registerConsentPolicy(solutionId: OpaqueId, input: RegisterConsentPolicyInput): EvidenceServiceResult<{ readonly policy: ConsentPolicy }> {
    return registerConsentPolicyOp(this.planeFor(solutionId), this.deps, input);
  }

  grantConsent(solutionId: OpaqueId, policyId: OpaqueId): EvidenceServiceResult<{ readonly reference: ConsentReference; readonly sessionBound: boolean }> {
    return decideConsentOp(this.planeFor(solutionId), this.deps, policyId, "granted");
  }

  denyConsent(solutionId: OpaqueId, policyId: OpaqueId): EvidenceServiceResult<{ readonly reference: ConsentReference; readonly sessionBound: boolean }> {
    return decideConsentOp(this.planeFor(solutionId), this.deps, policyId, "denied");
  }

  withdrawConsent(solutionId: OpaqueId, policyId: OpaqueId): EvidenceServiceResult<{ readonly reference: ConsentReference }> {
    return withdrawConsentOp(this.planeFor(solutionId), policyId);
  }

  expireConsent(solutionId: OpaqueId, policyId: OpaqueId): EvidenceServiceResult<{ readonly reference: ConsentReference }> {
    return expireConsentOp(this.planeFor(solutionId), policyId);
  }

  consentStateOf(solutionId: OpaqueId, policyId: OpaqueId): ConsentState {
    return this.planeFor(solutionId).consents.stateOf(policyId);
  }

  checkProcessing(solutionId: OpaqueId, evidenceId: OpaqueId, purpose: ConsentPurpose): EvidenceServiceResult<{ readonly outcome: ConsentDecisionOutcome; readonly privacyClass: string }> {
    return checkProcessingOp(this.planeFor(solutionId), evidenceId, purpose);
  }

  checkLearning(solutionId: OpaqueId, evidenceId: OpaqueId): EvidenceServiceResult<ConsentDecisionOutcome> {
    return checkLearningOp(this.planeFor(solutionId), evidenceId);
  }

  // -- capture -----------------------------------------------------------

  openCaptureSession(solutionId: OpaqueId, input: OpenCaptureSessionInput): EvidenceServiceResult<{ readonly session: CaptureSession; readonly consentPolicyId: OpaqueId }> {
    return openCaptureSessionOp(this.planeFor(solutionId), this.deps, input);
  }

  completeCaptureSession(solutionId: OpaqueId, sessionId: OpaqueId): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
    return completeCaptureSessionOp(this.planeFor(solutionId), this.deps, this.contentStore, sessionId);
  }

  declineCaptureSession(solutionId: OpaqueId, sessionId: OpaqueId): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
    return declineCaptureSessionOp(this.planeFor(solutionId), this.deps, this.contentStore, sessionId);
  }

  expireCaptureSession(solutionId: OpaqueId, sessionId: OpaqueId): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
    return expireCaptureSessionOp(this.planeFor(solutionId), this.deps, this.contentStore, sessionId);
  }

  captureSessionOf(solutionId: OpaqueId, sessionId: OpaqueId): EvidenceServiceResult<CaptureSession> {
    const session = this.planeFor(solutionId).captureSessions.get(sessionId);
    return session === undefined
      ? { ok: false, error: { code: "YOU_INVALID_STATE", message: "unknown capture session", details: { reason: "unknown-capture-session", sessionId }, simulated: true } }
      : { ok: true, value: session };
  }

  // -- evidence records --------------------------------------------------

  recordEvidence(solutionId: OpaqueId, input: RecordEvidenceInput): EvidenceServiceResult<{ readonly record: EvidenceRecord }> {
    return recordEvidenceOp(this.planeFor(solutionId), this.deps, this.contentStore, this.contentRng, input);
  }

  readEvidenceContent(solutionId: OpaqueId, evidenceId: OpaqueId): EvidenceServiceResult<EvidenceContentRead> {
    return readEvidenceContentOp(this.planeFor(solutionId), this.deps, this.contentStore, evidenceId);
  }

  verifyEvidenceIntegrity(solutionId: OpaqueId, evidenceId: OpaqueId): EvidenceServiceResult<{ readonly verified: true; readonly contentHash: string }> {
    return verifyEvidenceIntegrityOp(this.planeFor(solutionId), this.deps, this.contentStore, evidenceId);
  }

  sweepRetention(solutionId: OpaqueId): EvidenceServiceResult<{ readonly expiredEvidenceIds: readonly OpaqueId[] }> {
    return sweepRetentionOp(this.planeFor(solutionId), this.deps, this.contentStore);
  }

  evidenceRecordOf(solutionId: OpaqueId, evidenceId: OpaqueId): EvidenceServiceResult<EvidenceRecord> {
    const record = this.planeFor(solutionId).evidenceRecords.get(evidenceId);
    return record === undefined
      ? { ok: false, error: { code: "YOU_EVIDENCE_NOT_FOUND", message: "unknown evidence record", details: { reason: "unknown-evidence", evidenceId }, simulated: true } }
      : { ok: true, value: record };
  }

  // -- reviews -----------------------------------------------------------

  reviewEvidence(solutionId: OpaqueId, evidenceId: OpaqueId, input: ReviewEvidenceInput): EvidenceServiceResult<{ readonly review: EvidenceReview; readonly contentRemovedAfterReview: boolean }> {
    return reviewEvidenceOp(this.planeFor(solutionId), this.deps, this.contentStore, evidenceId, input);
  }

  resolveEvidenceReview(solutionId: OpaqueId, evidenceId: OpaqueId, reviewId: OpaqueId, outcome: "accepted" | "rejected"): EvidenceServiceResult<{ readonly review: EvidenceReview; readonly contentRemovedAfterReview: boolean }> {
    return resolveEvidenceReviewOp(this.planeFor(solutionId), this.deps, this.contentStore, evidenceId, reviewId, outcome);
  }

  reviewsOfEvidence(solutionId: OpaqueId, evidenceId: OpaqueId): readonly EvidenceReview[] {
    const plane = this.planeFor(solutionId);
    return (plane.reviewsByEvidence.get(evidenceId) ?? []).map((reviewId) => plane.reviews.get(reviewId)).filter((review): review is EvidenceReview => review !== undefined);
  }

  // -- projection / persistence -----------------------------------------

  /** Live authoritative projection (same shape as replayEvidenceLedger output). */
  projectionOf(solutionId: OpaqueId): EvidenceServiceResult<EvidencePlaneProjection> {
    const plane = this.planeFor(solutionId);
    const evidence: Record<string, string> = {};
    const evidenceRetention: Record<string, string> = {};
    const evidenceSimulated: Record<string, boolean> = {};
    for (const evidenceId of sortedKeys(plane.evidenceRecords)) {
      const record = plane.evidenceRecords.get(evidenceId);
      if (record === undefined) {
        continue;
      }
      evidence[evidenceId] = "recorded";
      evidenceRetention[evidenceId] = record.retention.policy;
      evidenceSimulated[evidenceId] = record.simulated;
    }
    const consents: Record<string, string> = {};
    for (const policy of plane.consents.policiesSorted()) {
      consents[policy.id] = plane.consents.stateOf(policy.id);
    }
    const captureSessions: Record<string, string> = {};
    for (const sessionId of sortedKeys(plane.captureSessions)) {
      const session = plane.captureSessions.get(sessionId);
      if (session !== undefined) {
        captureSessions[sessionId] = session.status;
      }
    }
    const reviews: Record<string, string> = {};
    for (const reviewId of sortedKeys(plane.reviews)) {
      const review = plane.reviews.get(reviewId);
      if (review !== undefined) {
        reviews[reviewId] = review.status;
      }
    }
    const currentReviewOfEvidence: Record<string, string> = {};
    for (const evidenceId of sortedKeys(plane.reviewsByEvidence)) {
      const reviewIds = plane.reviewsByEvidence.get(evidenceId) ?? [];
      const latest = reviewIds[reviewIds.length - 1];
      if (latest !== undefined) {
        currentReviewOfEvidence[evidenceId] = latest;
      }
    }
    const supersededBy: Record<string, string> = {};
    for (const oldReviewId of sortedKeys(plane.supersessionLinks)) {
      const replacement = plane.supersessionLinks.get(oldReviewId);
      if (replacement !== undefined) {
        supersededBy[oldReviewId] = replacement;
      }
    }
    return {
      ok: true,
      value: {
        solutionId,
        consents,
        captureSessions,
        evidence,
        evidenceRetention,
        evidenceSimulated,
        reviews,
        currentReviewOfEvidence,
        supersededBy,
      },
    };
  }

  ledgerEventsOf(solutionId: OpaqueId): EvidenceServiceResult<readonly SolutionEvent[]> {
    return { ok: true, value: this.planeFor(solutionId).ledger.events() };
  }

  serializeLedgerOf(solutionId: OpaqueId): EvidenceServiceResult<string> {
    return { ok: true, value: this.planeFor(solutionId).ledger.serialize() };
  }

  ledgerHashOf(solutionId: OpaqueId): EvidenceServiceResult<string> {
    return { ok: true, value: stableContentHash(this.planeFor(solutionId).ledger.events()) };
  }

  /** Number of stored content refs (fixture observability; shared across planes). */
  contentStoreSize(): number {
    return this.contentStore.size;
  }

  /** Replays a persisted ledger through the shared evidence-plane fold. */
  static replay(events: readonly SolutionEvent[]): EvidencePlaneProjection {
    return replayEvidenceLedger(events);
  }

  /** Lazily opens (and caches) the evidence plane for one solution. */
  private planeFor(solutionId: OpaqueId): EvidencePlaneRecord {
    const existing = this.planes.get(solutionId);
    if (existing !== undefined) {
      return existing;
    }
    const plane: EvidencePlaneRecord = {
      solutionId,
      ledger: new SolutionEventLedger(solutionId, this.deps),
      consents: new ConsentRegistry(),
      captureSessions: new Map(),
      evidenceRecords: new Map(),
      reviews: new Map(),
      reviewsByEvidence: new Map(),
      supersessionLinks: new Map(),
    };
    this.planes.set(solutionId, plane);
    return plane;
  }
}

/** Creates the deterministic evidence application service. */
export function createEvidenceService(config: EvidenceServiceConfig): EvidenceService {
  return EvidenceService.create(config);
}
