// YOU evidence service — consent / policy flow (docs/you/SECURITY.md
// "Consent": explicit, scoped, revocable, purpose-specific,
// server-enforced; operational use and learning reuse consented
// separately).

import type { ConsentPolicy, ConsentPurpose, ConsentReference, LearningScope, OpaqueId } from "@zcode/shared";
import type { ConsentDecisionOutcome } from "../../../shared/src/you/evidenceConsent.js";
import { canLearn, canProcess, createConsentPolicy, type ConsentPolicyIntake } from "../../../shared/src/you/evidenceConsent.js";
import type { CaptureSession, EvidenceRetention } from "@zcode/shared";
import { transitionCaptureSession } from "../../../shared/src/you/evidenceCapture.js";
import { appendConsentRecorded, appendConsentWithdrawn } from "./evidenceLedgerOps.js";
import type { EvidencePlaneRecord, EvidenceServiceDeps, EvidenceServiceResult } from "./evidenceServiceTypes.js";
import { evidenceFailure, NO_CONSENT_POLICY_ID } from "./evidenceServiceTypes.js";

export interface RegisterConsentPolicyInput {
  readonly purposes: readonly ConsentPurpose[];
  readonly scope: LearningScope;
  readonly operationalUse: boolean;
  readonly learningReuse: boolean;
  readonly retention: EvidenceRetention;
  readonly revocable: boolean;
}

/** Registers a ConsentPolicy (state stays undecided until grant/deny). */
export function registerConsentPolicyOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  input: RegisterConsentPolicyInput,
): EvidenceServiceResult<{ readonly policy: ConsentPolicy }> {
  const policyId = deps.ids.next("consent-policy");
  let policy: ConsentPolicy;
  try {
    policy = createConsentPolicy(policyId, input satisfies ConsentPolicyIntake);
  } catch (error) {
    return evidenceFailure("YOU_INVALID_STATE", "invalid consent policy", {
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
  appendConsentRecorded(plane, { policy, consentState: "unknown" });
  return { ok: true, value: { policy } };
}

/** Finds the consent-pending session bound to a policy (guided capture). */
function pendingSessionFor(plane: EvidencePlaneRecord, policyId: OpaqueId) {
  for (const session of plane.captureSessions.values()) {
    if (session.consent.policyId === policyId && session.status === "consent-pending") {
      return session;
    }
  }
  return null;
}

/**
 * Records the user's grant/deny decision. When a guided capture session
 * is awaiting this consent, its status transition rides along on the
 * consent event (granted -> active, denied -> declined).
 */
export function decideConsentOp(
  plane: EvidencePlaneRecord,
  deps: EvidenceServiceDeps,
  policyId: OpaqueId,
  decision: "granted" | "denied",
): EvidenceServiceResult<{ readonly reference: ConsentReference; readonly sessionBound: boolean }> {
  const policy = plane.consents.policyOf(policyId);
  if (policy === null) {
    return evidenceFailure("YOU_INVALID_STATE", "unknown consent policy", {
      reason: "unknown-policy",
      policyId,
    });
  }
  const pending = pendingSessionFor(plane, policyId);
  let reference: ConsentReference;
  try {
    reference = plane.consents.recordDecision(policyId, decision);
  } catch (error) {
    return evidenceFailure("YOU_INVALID_STATE", `illegal consent decision ${decision}`, {
      reason: "illegal-consent-transition",
      policyId,
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  let sessionAfter: CaptureSession | undefined;
  if (pending !== null) {
    const targetStatus = decision === "granted" ? "active" : "declined";
    sessionAfter = transitionCaptureSession(pending, targetStatus, deps.clock);
    plane.captureSessions.set(pending.id, sessionAfter);
  }
  appendConsentRecorded(plane, {
    policy,
    consentState: decision,
    ...(sessionAfter === undefined ? {} : { session: sessionAfter }),
  });
  return { ok: true, value: { reference, sessionBound: pending !== null } };
}

/** Withdraws an active grant; terminal for the policy id (append-only). */
export function withdrawConsentOp(
  plane: EvidencePlaneRecord,
  policyId: OpaqueId,
): EvidenceServiceResult<{ readonly reference: ConsentReference }> {
  if (!plane.consents.hasPolicy(policyId)) {
    return evidenceFailure("YOU_INVALID_STATE", "unknown consent policy", {
      reason: "unknown-policy",
      policyId,
    });
  }
  let reference: ConsentReference;
  try {
    reference = plane.consents.withdraw(policyId);
  } catch (error) {
    return evidenceFailure("YOU_INVALID_STATE", "illegal consent withdrawal", {
      reason: "illegal-withdrawal",
      policyId,
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  appendConsentWithdrawn(plane, policyId, "withdrawn", "user-revocation");
  return { ok: true, value: { reference } };
}

/** Expires an active grant (retention-driven); terminal for the policy id. */
export function expireConsentOp(
  plane: EvidencePlaneRecord,
  policyId: OpaqueId,
): EvidenceServiceResult<{ readonly reference: ConsentReference }> {
  if (!plane.consents.hasPolicy(policyId)) {
    return evidenceFailure("YOU_INVALID_STATE", "unknown consent policy", {
      reason: "unknown-policy",
      policyId,
    });
  }
  let reference: ConsentReference;
  try {
    reference = plane.consents.expire(policyId);
  } catch (error) {
    return evidenceFailure("YOU_INVALID_STATE", "illegal consent expiry", {
      reason: "illegal-expiry",
      policyId,
      detail: String(error instanceof Error ? error.message : error),
    });
  }
  appendConsentWithdrawn(plane, policyId, "expired", "retention-expiry");
  return { ok: true, value: { reference } };
}

/** Server-enforced processing check for one evidence record. */
export function checkProcessingOp(
  plane: EvidencePlaneRecord,
  evidenceId: OpaqueId,
  purpose: ConsentPurpose,
): EvidenceServiceResult<{ readonly outcome: ConsentDecisionOutcome; readonly privacyClass: string }> {
  const record = plane.evidenceRecords.get(evidenceId);
  if (record === undefined) {
    return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown evidence record", {
      reason: "unknown-evidence",
      evidenceId,
    });
  }
  const outcome =
    record.consent.policyId === NO_CONSENT_POLICY_ID
      ? canProcess({ privacyClass: record.privacyClass, purpose, consent: null })
      : canProcess({ privacyClass: record.privacyClass, purpose, consent: plane.consents.active(record.consent.policyId) });
  return { ok: true, value: { outcome, privacyClass: record.privacyClass } };
}

/** Server-enforced learning-reuse check for one evidence record. */
export function checkLearningOp(
  plane: EvidencePlaneRecord,
  evidenceId: OpaqueId,
): EvidenceServiceResult<ConsentDecisionOutcome> {
  const record = plane.evidenceRecords.get(evidenceId);
  if (record === undefined) {
    return evidenceFailure("YOU_EVIDENCE_NOT_FOUND", "unknown evidence record", {
      reason: "unknown-evidence",
      evidenceId,
    });
  }
  const consent =
    record.consent.policyId === NO_CONSENT_POLICY_ID
      ? null
      : plane.consents.active(record.consent.policyId);
  return { ok: true, value: canLearn(consent) };
}
