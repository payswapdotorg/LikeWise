// YOU learning service — preference projection flow (W6A —
// docs/you/WORK_ORDERS.md W6A: "preference projections:
// LearningPreference records scoped by the v1 LearningScope union,
// derived from validated records (derivedFromRecordId lineage), typed
// YOU_PREFERENCE_SCOPE_INVALID refusals; projections never mutate the
// ledger").
//
// Deriving a preference is a USE of the learning record for the
// "personalization" usage class: the rights gate runs FIRST (the RIGHTS
// LAW — typed YOU_LEARNING_RIGHTS_REQUIRED refusals), then the
// stateless derivation machinery (shared/src/you/learningPreference.ts)
// guards the record status + the scoping law (a derived preference
// keeps the source record's scope). The projection layer never touches
// record state: it upserts the `${scope}::${key}` projection and
// appends the preference-updated event — the record store and every
// earlier ledger entry stay untouched (append-only prefix property).

import type { LearningPreference, LearningRecord, LearningScope, OpaqueId, YouError } from "@zcode/shared";
import { deriveLearningPreferenceFromRecord, createLearningPreference, preferenceProjectionKey } from "../../../shared/src/you/learningPreference.js";
import { evaluateLearningRights } from "../../../shared/src/you/learningRights.js";
import type { LearningConsentPort, LearningPlaneRecord, LearningServiceDeps, LearningServiceResult } from "./learningServiceTypes.js";
import { learningFailure, requireLearningRecord } from "./learningServiceTypes.js";
import { appendPreferenceUpdated } from "./learningLedgerOps.js";

export interface DerivePreferenceInput {
  readonly recordId: OpaqueId;
  readonly key: string;
  readonly value: string;
  /** Defaults to the record's scope; must EQUAL it (the scoping law). */
  readonly scope?: LearningScope;
}

function rightsRefusal(record: LearningRecord, reason: string): { readonly ok: false; readonly error: YouError } {
  return learningFailure(
    "YOU_LEARNING_RIGHTS_REQUIRED",
    `preference derivation from learning record ${record.id} is outside its rights grant (${reason})`,
    {
      reason,
      recordId: record.id,
      usage: "personalization",
      consentRef: record.rights.consentRef,
    },
  );
}

/**
 * Derives a preference projection from a VALIDATED learning record.
 * Gate order (deterministic): record exists (YOU_LEARNING_RECORD_NOT_
 * FOUND) -> record validated (YOU_INVALID_STATE) -> rights cover the
 * "personalization" usage under the live grant
 * (YOU_LEARNING_RIGHTS_REQUIRED) -> scope + shape
 * (YOU_PREFERENCE_SCOPE_INVALID / YOU_INVALID_STATE).
 */
export function derivePreferenceOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  port: LearningConsentPort,
  now: string,
  input: DerivePreferenceInput,
): LearningServiceResult<{ readonly preference: LearningPreference; readonly previous: LearningPreference | null }> {
  const found: { readonly record: LearningRecord } | { readonly error: YouError } = requireLearningRecord(plane, input.recordId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  const record = found.record;
  if (record.status !== "validated") {
    return learningFailure("YOU_INVALID_STATE", `learning record ${record.id} is ${record.status}, not validated — only validated learning projects preferences`, {
      reason: "record-not-validated",
      recordId: record.id,
      status: record.status,
    });
  }
  const liveGrant = record.rights.consentRef.length > 0 ? port.resolveLearningGrant(record.rights.consentRef) : null;
  const decision = evaluateLearningRights(record.rights, "personalization", liveGrant, now);
  if (!decision.allowed) {
    return rightsRefusal(record, decision.reason);
  }
  const derived = deriveLearningPreferenceFromRecord(record, { key: input.key, value: input.value, scope: input.scope ?? record.scope }, deps);
  if (!derived.ok) {
    if (derived.code === "invalid-scope" || derived.code === "scope-mismatch") {
      return learningFailure("YOU_PREFERENCE_SCOPE_INVALID", `invalid preference projection: ${derived.detail}`, {
        reason: derived.code,
        detail: derived.detail,
        recordId: record.id,
      });
    }
    return learningFailure("YOU_INVALID_STATE", `invalid preference projection: ${derived.detail}`, {
      reason: derived.code,
      detail: derived.detail,
      recordId: record.id,
    });
  }
  const key = preferenceProjectionKey(derived.preference.scope, derived.preference.key);
  const previous = plane.preferences.get(key) ?? null;
  plane.preferences.set(key, derived.preference);
  appendPreferenceUpdated(plane, derived.preference);
  return { ok: true, value: { preference: derived.preference, previous } };
}

export interface SetOperatorPreferenceInput {
  readonly scope: LearningScope;
  readonly key: string;
  readonly value: string;
}

/** Upserts an operator-seeded preference (null lineage; no record involved, no rights gate). */
export function setOperatorPreferenceOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  input: SetOperatorPreferenceInput,
): LearningServiceResult<{ readonly preference: LearningPreference; readonly previous: LearningPreference | null }> {
  const created = createLearningPreference(
    { scope: input.scope, key: input.key, value: input.value, derivedFromRecordId: null },
    deps,
  );
  if (!created.ok) {
    if (created.code === "invalid-scope") {
      return learningFailure("YOU_PREFERENCE_SCOPE_INVALID", `invalid preference projection: ${created.detail}`, {
        reason: created.code,
        detail: created.detail,
      });
    }
    return learningFailure("YOU_INVALID_STATE", `invalid preference projection: ${created.detail}`, {
      reason: created.code,
      detail: created.detail,
    });
  }
  const key = preferenceProjectionKey(created.preference.scope, created.preference.key);
  const previous = plane.preferences.get(key) ?? null;
  plane.preferences.set(key, created.preference);
  appendPreferenceUpdated(plane, created.preference);
  return { ok: true, value: { preference: created.preference, previous } };
}
