// YOU learning preference machinery (W6A — docs/you/CONTRACTS.md
// "Wave-6 contract freeze (v6)", frozen LearningPreference).
//
// Preferences are PROJECTIONS, never authorities — the learning record
// remains the source of truth (docs/you/contract.ts). A derived
// preference carries derivedFromRecordId lineage back to the VALIDATED
// record it was derived from; an operator-seeded preference carries a
// null lineage. Projections never mutate the ledger: the learning
// service appends the preference-updated event and leaves the record
// store untouched.
//
// Scope discipline: preference scopes come from the v1 LearningScope
// union (reused verbatim by the v6 freeze). A DERIVED preference must
// keep the source record's scope — a user-scoped learning never
// silently becomes a universal rule (the phase-0 scoping law,
// learning.ts). A scope mismatch is a typed refusal the service maps to
// YOU_PREFERENCE_SCOPE_INVALID, exactly like an illegal scope literal.
//
// Validation is STATELESS (no clock, no store). Fixture laws
// (docs/you/FIXTURES.md) apply verbatim.

import type { LearningPreference, LearningRecord, LearningScope, OpaqueId } from "./contract.js";
import type { YouClock } from "./clock.js";
import type { YouIdFactory } from "./ids.js";
import { deepFreeze } from "./serialize.js";
import { isLearningScopeLiteral } from "./learningScope.js";

/** Typed preference scope refusal codes (mapped to YOU_PREFERENCE_SCOPE_INVALID by the service). */
export type LearningPreferenceScopeRefusalCode = "invalid-scope" | "scope-mismatch";

export type LearningPreferenceScopeRefusal = { readonly ok: false; readonly code: LearningPreferenceScopeRefusalCode; readonly detail: string };

/** Typed derivation refusal codes (record-state guards + scope + structural intake). */
export type PreferenceDerivationRefusalCode =
  | "record-not-validated"
  | LearningPreferenceScopeRefusalCode
  | LearningPreferenceIntakeRefusalCode;

export type PreferenceDerivationRefusal = { readonly ok: false; readonly code: PreferenceDerivationRefusalCode; readonly detail: string };

/** Returns a typed refusal for an illegal preference scope literal, or null when legal. */
export function validatePreferenceScopeLiteral(scope: string): LearningPreferenceScopeRefusal | null {
  if (!isLearningScopeLiteral(scope)) {
    return {
      ok: false,
      code: "invalid-scope",
      detail: `preference scope "${scope}" is not one of the eight frozen v1 LearningScope literals`,
    };
  }
  return null;
}

export interface LearningPreferenceIntake {
  readonly scope: LearningScope;
  readonly key: string;
  readonly value: string;
  readonly derivedFromRecordId: OpaqueId | null;
}

/** Typed preference-intake refusal codes (structural). */
export type LearningPreferenceIntakeRefusalCode = "invalid-scope" | "invalid-key" | "invalid-value";

export type LearningPreferenceIntakeRefusal = { readonly ok: false; readonly code: LearningPreferenceIntakeRefusalCode; readonly detail: string };

/**
 * Stateless structural validation of a preference intake: scope a frozen
 * v1 literal, key a non-empty trimmed string, value a non-empty string.
 */
export function validateLearningPreferenceIntake(intake: LearningPreferenceIntake): { readonly ok: true } | LearningPreferenceIntakeRefusal {
  const scopeRefusal = validatePreferenceScopeLiteral(intake.scope);
  if (scopeRefusal !== null) {
    return { ok: false, code: "invalid-scope", detail: scopeRefusal.detail };
  }
  if (typeof intake.key !== "string" || intake.key.length === 0 || intake.key !== intake.key.trim()) {
    return { ok: false, code: "invalid-key", detail: "a preference key must be a non-empty string without surrounding whitespace" };
  }
  if (typeof intake.value !== "string" || intake.value.length === 0) {
    return { ok: false, code: "invalid-value", detail: "a preference value must be a non-empty string" };
  }
  return { ok: true };
}

/**
 * Constructs the immutable, deep-frozen LearningPreference
 * (operator-seeded when derivedFromRecordId is null). `updatedAt` comes
 * from the injected clock.
 */
export function createLearningPreference(
  intake: LearningPreferenceIntake,
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly preference: LearningPreference } | LearningPreferenceIntakeRefusal {
  const validated = validateLearningPreferenceIntake(intake);
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    preference: deepFreeze({
      id: deps.ids.next("learning-preference"),
      scope: intake.scope,
      key: intake.key,
      value: intake.value,
      derivedFromRecordId: intake.derivedFromRecordId,
      updatedAt: deps.clock.now(),
    }),
  };
}

/**
 * Derives a preference projection from a learning record. Statelessly
 * refuses when:
 *   - the record is not VALIDATED (only validated learning projects —
 *     candidates, rejected and superseded records never do);
 *   - the requested scope is not the record's scope (the scoping law:
 *     a derived preference never widens or narrows its source scope);
 *   - the intake is structurally invalid.
 * Rights enforcement (usage "personalization" within the record's
 * LearningRights grant) is the SERVICE's authority — the service runs
 * the stateless rights evaluator before calling this derivation.
 */
export function deriveLearningPreferenceFromRecord(
  record: LearningRecord,
  intake: { readonly key: string; readonly value: string; readonly scope: LearningScope },
  deps: { readonly clock: YouClock; readonly ids: YouIdFactory },
): { readonly ok: true; readonly preference: LearningPreference } | PreferenceDerivationRefusal {
  if (record.status !== "validated") {
    return {
      ok: false,
      code: "record-not-validated",
      detail: `learning record ${record.id} is ${record.status}, not validated — only validated learning projects preferences`,
    };
  }
  if (intake.scope !== record.scope) {
    return {
      ok: false,
      code: "scope-mismatch",
      detail: `a derived preference must keep the source record's scope (${record.scope}), not "${String(intake.scope)}"`,
    };
  }
  const created = createLearningPreference(
    { scope: intake.scope, key: intake.key, value: intake.value, derivedFromRecordId: record.id },
    deps,
  );
  if (!created.ok) {
    // validateLearningPreferenceIntake refusals are structural; the two
    // overlap sets share the "invalid-scope" code.
    return created;
  }
  return created;
}

/** The projection key of a preference: `${scope}::${key}` (stable, sorted). */
export function preferenceProjectionKey(scope: LearningScope, key: string): string {
  return `${scope}::${key}`;
}
