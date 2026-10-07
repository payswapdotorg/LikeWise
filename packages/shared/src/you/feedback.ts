// YOU FeedbackRequest / EvidenceRequest flow (docs/you/CONTRACTS.md).
//
// Feedback is a canonical record targeting a selector over a specific
// Solution version, carrying its own consent/learning policy. When the
// agent needs targeted evidence it derives an EvidenceRequest for the
// deficiency class mapped from the feedback category.

import type {
  ConsentReference,
  ConsentState,
  EvidenceRequest,
  EvidenceRequestStatus,
  FeedbackCategory,
  FeedbackRequest,
  FeedbackStatus,
  LearningScope,
  OpaqueId,
  SolutionSelector,
  SolutionStateSnapshot,
} from "./contract.js";
import type { YouClock } from "./clock.js";
import { listFixtureRegions } from "./fixture.js";
import type { YouIdFactory } from "./ids.js";
import { deficiencyClassForCategory } from "./quality.js";
import { deepFreeze } from "./serialize.js";

export interface FeedbackDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

export interface FeedbackIntake {
  readonly scope: LearningScope;
  readonly targetRef: SolutionSelector;
  readonly category: FeedbackCategory;
  readonly userComment: string;
  readonly sourceSolutionVersionId: OpaqueId;
  readonly requestedAction: string;
  readonly consent: ConsentReference;
}

/** Phase-0 default consent policy id (fixture demo policy). */
export const PHASE0_CONSENT_POLICY_ID = "you-phase0-consent-policy";

export function createConsentReference(
  state: ConsentState,
  learningPermission: boolean,
  policyId: string = PHASE0_CONSENT_POLICY_ID,
): ConsentReference {
  return deepFreeze({ policyId, state, learningPermission });
}

/** Validates that a selector resolves against the given snapshot. */
export function validateSelectorTarget(selector: SolutionSelector, snapshot: SolutionStateSnapshot): boolean {
  switch (selector.kind) {
    case "entity":
      return snapshot.entities.some((entity) => entity.id === selector.entityId);
    case "region":
      return listFixtureRegions(snapshot).some((region) => region.regionId === selector.regionId);
    case "quality":
      return Object.prototype.hasOwnProperty.call(snapshot.quality, selector.deficiencyClass);
    default:
      return false;
  }
}

/** Creates a canonical, immutable FeedbackRequest (status "open"). */
export function createFeedbackRequest(intake: FeedbackIntake, deps: FeedbackDeps): FeedbackRequest {
  if (intake.userComment.length === 0) {
    throw new Error("FeedbackRequest requires a non-empty userComment");
  }
  return deepFreeze({
    id: deps.ids.next("feedback"),
    scope: intake.scope,
    targetRef: intake.targetRef,
    category: intake.category,
    userComment: intake.userComment,
    sourceSolutionVersionId: intake.sourceSolutionVersionId,
    requestedAction: intake.requestedAction,
    status: "open",
    createdAt: deps.clock.now(),
    consent: intake.consent,
  });
}

const FEEDBACK_TRANSITIONS: Readonly<Record<FeedbackStatus, readonly FeedbackStatus[]>> = {
  open: ["addressed", "superseded", "rejected"],
  addressed: [],
  superseded: [],
  rejected: [],
};

/** Returns a NEW FeedbackRequest with the status transitioned. */
export function transitionFeedback(feedback: FeedbackRequest, status: FeedbackStatus): FeedbackRequest {
  const allowed = FEEDBACK_TRANSITIONS[feedback.status];
  if (!allowed.includes(status)) {
    throw new Error(`illegal feedback transition ${feedback.status} -> ${status}`);
  }
  return deepFreeze({ ...feedback, status });
}

const EVIDENCE_TRANSITIONS: Readonly<Record<EvidenceRequestStatus, readonly EvidenceRequestStatus[]>> = {
  requested: ["provided", "declined", "cancelled"],
  provided: ["fulfilled", "cancelled"],
  declined: [],
  fulfilled: [],
  cancelled: [],
};

/** Returns a NEW EvidenceRequest with the status transitioned. */
export function transitionEvidence(request: EvidenceRequest, status: EvidenceRequestStatus): EvidenceRequest {
  const allowed = EVIDENCE_TRANSITIONS[request.status];
  if (!allowed.includes(status)) {
    throw new Error(`illegal evidence transition ${request.status} -> ${status}`);
  }
  return deepFreeze({ ...request, status });
}

export interface EvidenceRequestOptions {
  /** Overrides the derived deficiency class. */
  readonly targetDeficiency?: string;
  readonly preferredFraming?: string | null;
  readonly privacyRequirements?: string;
  readonly retention?: string;
}

/**
 * Derives a targeted EvidenceRequest for the deficiency behind a
 * FeedbackRequest. Phase 0 requests fixture evidence only.
 */
export function createEvidenceRequestForFeedback(
  feedback: FeedbackRequest,
  deps: FeedbackDeps,
  options: EvidenceRequestOptions = {},
): EvidenceRequest {
  return deepFreeze({
    id: deps.ids.next("evidence"),
    targetDeficiency: options.targetDeficiency ?? deficiencyClassForCategory(feedback.category),
    evidenceType: "fixture",
    preferredFraming:
      options.preferredFraming ?? "synthetic reference framing, deterministic seed, medium quality",
    reason: `resolve deficiency "${deficiencyClassForCategory(feedback.category)}" for feedback ${feedback.id}`,
    privacyRequirements: options.privacyRequirements ?? "fixture-only; no biometric data; no retention beyond session",
    retention: options.retention ?? "session-only",
    status: "requested",
  });
}
