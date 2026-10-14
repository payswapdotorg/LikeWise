// YOU platform service — retention enforcement pass flow (W10A). The
// ops live here; platformService.ts is the single authority that
// dispatches into them (the W1A/W8A flow precedent).
//
// THE RETENTION LAW (docs/you/CONTRACTS.md wave-10): enforcement
// records are immutable and auditable; a retention class NEVER
// overrides an active consent (the wave-2 consent laws hold;
// YOU_RETENTION_ENFORCEMENT_INVALID).
//
// The op gates through the rate limiter first
// (enforcement-before-effect), validates the pass intake through the
// shared stateless validator, then applies the consent gate: the
// subject's effective ConsentState is resolved by the CALLER through
// the wave-2 consent authority (there is no second consent path) and
// passed in; a `granted` consent refuses the pass (consent-protected —
// the retention class never overrides it). An allowed pass constructs
// the immutable RetentionEnforcementRecord and appends the
// `retention-enforced` event (the auditable pass; the consent state at
// decision time rides the payload so the audit trail shows WHY the
// pass was legal).
//
// Plane separation: the pass records the retention class becoming due
// for a subject; the content effect itself stays with the evidence
// authority — this service never mutates evidence-plane state.

import type { ConsentState, RetentionEnforcementRecord } from "@zcode/shared";
import {
  constructRetentionEnforcementRecord,
  retentionConsentDecision,
  validateRetentionEnforcementInput,
  type RetentionEnforcementInput,
} from "../../../shared/src/you/retentionEnforcement.js";
import { appendRetentionEnforced } from "./platformLedgerOps.js";
import { gateRateLimitOp } from "./rateLimitFlow.js";
import {
  platformFailure,
  type PlatformFlowDeps,
  type PlatformPlaneRecord,
  type PlatformServiceResult,
} from "./platformServiceTypes.js";

/** The canonical gate scope for retention passes (enforcement-before-effect). */
export const RETENTION_ENFORCE_GATE_SCOPE = "retention:enforce";

/**
 * Records one retention enforcement pass (immutable, auditable). Gates
 * through the rate limiter first; then the intake validator; then the
 * consent gate — a granted consent refuses the pass with the typed
 * YOU_RETENTION_ENFORCEMENT_INVALID (consent-protected: a retention
 * class NEVER overrides an active consent). Emits retention-enforced.
 */
export function enforceRetentionOp(
  plane: PlatformPlaneRecord,
  deps: PlatformFlowDeps,
  input: RetentionEnforcementInput,
  consentState: ConsentState,
): PlatformServiceResult<{ readonly record: RetentionEnforcementRecord; readonly consentState: ConsentState }> {
  const gate = gateRateLimitOp(plane, deps, RETENTION_ENFORCE_GATE_SCOPE, input.subjectRef);
  if (!gate.ok) {
    return gate;
  }
  const refusal = validateRetentionEnforcementInput(input);
  if (refusal !== null) {
    return platformFailure("YOU_RETENTION_ENFORCEMENT_INVALID", `retention pass refused: ${refusal.detail}`, {
      reason: refusal.reason,
      subjectRef: input.subjectRef,
    });
  }
  const consent = retentionConsentDecision(consentState);
  if (!consent.allowed) {
    return platformFailure(
      "YOU_RETENTION_ENFORCEMENT_INVALID",
      "retention pass refused: the subject's consent is active (a retention class never overrides an active consent)",
      {
        reason: consent.reason,
        retentionClass: input.retentionClass,
        subjectRef: input.subjectRef,
        consentState,
      },
    );
  }
  const enforcedAt = deps.clock.now();
  const constructed = constructRetentionEnforcementRecord({
    id: deps.ids.next("retention-pass"),
    retentionClass: input.retentionClass,
    subjectRef: input.subjectRef,
    enforcedAt,
  });
  if (!constructed.ok) {
    return platformFailure("YOU_RETENTION_ENFORCEMENT_INVALID", `retention pass refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      subjectRef: input.subjectRef,
    });
  }
  plane.retentionPasses.set(constructed.record.id, constructed.record);
  appendRetentionEnforced(plane, constructed.record, consentState);
  return { ok: true, value: { record: constructed.record, consentState } };
}
