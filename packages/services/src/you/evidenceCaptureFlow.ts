// YOU evidence service — guided capture session flow (docs/you/CONTRACTS.md
// "Evidence / capture / consent": capture UX flows through the
// application-service authority; state truth = evidence service).
//
// Open flow (event sequence is part of the fixture definition):
//   1. capture-session-opened   { sessionStatusAfter: "requested" }
//   2. consent-recorded         { consentState: "unknown",
//                                  captureSessionId, sessionStatusAfter:
//                                  "consent-pending" }
// The session's consent instrument is registered with the session and
// stays undecided until grant/deny (evidenceConsentFlow.decideConsentOp),
// which rides the session transition along on the consent event.
// Terminal transitions (completed / declined / expired) all emit
// capture-session-completed with the truthful terminal status in
// sessionStatusAfter (W1A payload-riding precedent) and remove the
// content of session-only retention records bound to the session.

import type { CaptureSession, EvidenceRequest, LearningScope, OpaqueId } from "@zcode/shared";
import {
  buildCaptureGuideSteps,
  createCaptureSession,
  guideSpecForEvidenceRequest,
  isLegalCaptureSessionTransition,
  transitionCaptureSession,
  type CaptureGuideSpec,
} from "../../../shared/src/you/evidenceCapture.js";
import { consentReferenceFor, createConsentPolicy } from "../../../shared/src/you/evidenceConsent.js";
import { expiresWithCaptureSession } from "../../../shared/src/you/evidenceRetention.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { appendCaptureSessionCompleted, appendCaptureSessionOpened, appendConsentRecorded } from "./evidenceLedgerOps.js";
import type { EvidencePlaneRecord, EvidenceServiceDeps, EvidenceServiceResult } from "./evidenceServiceTypes.js";
import { evidenceFailure, sortedKeys } from "./evidenceServiceTypes.js";
import type { RegisterConsentPolicyInput } from "./evidenceConsentFlow.js";

export interface OpenCaptureSessionInput {
  readonly evidenceRequest: EvidenceRequest | null;
  readonly scope: LearningScope;
  readonly consent: Omit<RegisterConsentPolicyInput, "scope">;
  readonly guideSpec?: CaptureGuideSpec;
  readonly provenanceSource?: string;
}

/**
 * Opens a guided capture session: registers its consent instrument,
 * creates the session (requested), then immediately moves it to
 * consent-pending (opening a guided session asks for consent). Both
 * facts are evented so ledger replay reproduces the session status.
 */
export function openCaptureSessionOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  input: OpenCaptureSessionInput,
): EvidenceServiceResult<{ readonly session: CaptureSession; readonly consentPolicyId: OpaqueId }> {
  const policyId = deps.ids.next("consent-policy");
  let policy: ReturnType<typeof createConsentPolicy>;
  try {
    policy = createConsentPolicy(policyId, { ...input.consent, scope: input.scope });
  } catch (error) {
    return evidenceFailure("YOU_INVALID_STATE", "invalid capture consent policy", {
      reason: "invalid-policy",
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  try {
    plane.consents.registerPolicy(policy);
  } catch {
    return evidenceFailure("YOU_INVALID_STATE", "consent policy id collision", {
      reason: "duplicate-policy",
      policyId,
    });
  }
  const spec = input.guideSpec ?? (input.evidenceRequest === null ? {} : guideSpecForEvidenceRequest(input.evidenceRequest));
  const evidenceType = input.evidenceRequest?.evidenceType ?? "fixture";
  const guideSteps = buildCaptureGuideSteps(spec, evidenceType, deps.ids);
  const created = createCaptureSession(
    {
      evidenceRequestId: input.evidenceRequest?.id ?? null,
      scope: input.scope,
      guideSteps,
      consent: consentReferenceFor(policy, "unknown"),
      provenanceSource: input.provenanceSource ?? "fixture:evidence-capture",
      generator: "user",
    },
    deps,
  );
  plane.captureSessions.set(created.id, created);
  appendCaptureSessionOpened(plane, created);

  const pending = transitionCaptureSession(created, "consent-pending", deps.clock);
  plane.captureSessions.set(pending.id, pending);
  appendConsentRecorded(plane, { policy, consentState: "unknown", session: pending });
  return { ok: true, value: { session: pending, consentPolicyId: policyId } };
}

/** Removes session-only content bound to a terminal session (retention law). */
function sweepSessionOnlyContent(
  plane: EvidencePlaneRecord,
  store: EvidenceContentStore,
  sessionId: OpaqueId,
): OpaqueId[] {
  const expired: OpaqueId[] = [];
  for (const evidenceId of sortedKeys(plane.evidenceRecords)) {
    const record = plane.evidenceRecords.get(evidenceId);
    if (record === undefined) {
      continue;
    }
    if (record.captureSessionId === sessionId && expiresWithCaptureSession(record) && store.has(record.contentRef)) {
      store.delete(record.contentRef);
      expired.push(evidenceId);
    }
  }
  return expired;
}

/** Applies a terminal session transition, sweeping session-only content. */
function terminateSessionOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  sessionId: OpaqueId,
  target: "completed" | "declined" | "expired",
): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
  const session = plane.captureSessions.get(sessionId);
  if (session === undefined) {
    return evidenceFailure("YOU_INVALID_STATE", "unknown capture session", {
      reason: "unknown-capture-session",
      sessionId,
    });
  }
  if (!isLegalCaptureSessionTransition(session.status, target)) {
    return evidenceFailure("YOU_INVALID_STATE", `illegal capture session transition ${session.status} -> ${target}`, {
      reason: "illegal-session-transition",
      sessionId,
      fromStatus: session.status,
      toStatus: target,
    });
  }
  const terminated = transitionCaptureSession(session, target, deps.clock);
  plane.captureSessions.set(sessionId, terminated);
  const expiredEvidenceIds = sweepSessionOnlyContent(plane, store, sessionId);
  appendCaptureSessionCompleted(plane, { session: terminated, expiredEvidenceIds });
  return { ok: true, value: { session: terminated, expiredEvidenceIds } };
}

/** Completes an active capture session. */
export function completeCaptureSessionOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  sessionId: OpaqueId,
): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
  return terminateSessionOp(plane, deps, store, sessionId, "completed");
}

/** Declines an active capture session (user aborts mid-capture). */
export function declineCaptureSessionOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  sessionId: OpaqueId,
): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
  return terminateSessionOp(plane, deps, store, sessionId, "declined");
}

/** Expires a capture session (consent-pending or active timeout). */
export function expireCaptureSessionOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  store: EvidenceContentStore,
  sessionId: OpaqueId,
): EvidenceServiceResult<{ readonly session: CaptureSession; readonly expiredEvidenceIds: readonly OpaqueId[] }> {
  return terminateSessionOp(plane, deps, store, sessionId, "expired");
}
