// YOU OperatorSignoffRecord machinery (W12A — docs/you/CONTRACTS.md
// "Wave-12 contract freeze (v12)": "OperatorSignoffRecord"; the OPERATOR
// SIGNOFF LAW: the signoff references a COMPLETE passing checklist; it
// is immutable; one release declaration per signoff
// (YOU_OPERATOR_SIGNOFF_INVALID)).
//
// This module owns the STATELESS signoff-intake validator and the
// immutable signoff constructor. Validation is pure: no clock, no rng,
// no store — the service maps refusals to typed
// YOU_OPERATOR_SIGNOFF_INVALID errors at its seam.
//
// THE OPERATOR SIGNOFF LAW's construct-time teeth (the W11A
// acceptance-decision precedent — the separate immutable decision
// referencing what it decides):
//   - the signoff requires the checklist it references, present and
//     identical (refusal "checklist-ref-mismatch" — the reference is
//     correct by construction, never free-floating);
//   - the referenced checklist must be COMPLETE (exactly the canonical
//     20 points — refusal "checklist-incomplete") AND PASSING (all 20
//     points passed — refusal "checklist-not-passing"; a signoff
//     without a passing gate is refused, never recorded);
//   - the record is immutable by construction (deep-frozen; the
//     service's one-signoff-per-checklist head — "already-signed" —
//     is the lifecycle teeth: a re-sign is refused, never a rewrite);
//   - "one release declaration per signoff" is enforced at the release
//     declaration seam (releaseDeclaration.ts + the service's
//     "already-declared" refusal), keyed by the signoff this record's
//     id pins.
//
// Phase 0: every constructed record stays `simulated: true` (the truth
// law).

import type { LaunchGateChecklistRecord, OpaqueId, OperatorSignoffRecord } from "./contract.js";
import { deepFreeze } from "./serialize.js";
import { isCompleteLaunchGateChecklist, launchGatePasses } from "./launchGate.js";

/** A refusal returned by the stateless validators (never an exception). */
export interface OperatorSignoffRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** Signoff intake (the operator's identity — the decision facts). */
export interface OperatorSignoffInput {
  /** The operator signing off (an opaque operator id). */
  readonly signedBy: OpaqueId;
}

/** The stateless signoff-intake validator. */
export function validateOperatorSignoffInput(input: OperatorSignoffInput): OperatorSignoffRefusal | null {
  if (input === null || typeof input !== "object") {
    return { reason: "signed-by-empty", detail: "the signoff intake must carry the operator's identity" };
  }
  if (typeof input.signedBy !== "string" || input.signedBy.trim().length === 0) {
    return { reason: "signed-by-empty", detail: "signedBy must be a non-empty opaque operator id" };
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen operator signoff — THE OPERATOR
 * SIGNOFF LAW's teeth: the signoff references a COMPLETE passing
 * checklist. The checklist must be present (refusal
 * "signoff-without-checklist"), identical to the referenced id (refusal
 * "checklist-ref-mismatch"), complete over the canonical 20 points
 * (refusal "checklist-incomplete") and passing on all 20 (refusal
 * "checklist-not-passing" — a signoff without a passing gate is never
 * recorded).
 */
export function constructOperatorSignoffRecord(
  input: {
    readonly id: OpaqueId;
    readonly checklistRef: OpaqueId;
    readonly signedBy: OpaqueId;
    readonly signedAt: string;
  },
  checklist: LaunchGateChecklistRecord | null,
): { readonly ok: true; readonly record: OperatorSignoffRecord } | { readonly ok: false; readonly refusal: OperatorSignoffRefusal } {
  if (typeof input.checklistRef !== "string" || input.checklistRef.length === 0) {
    return { ok: false, refusal: { reason: "checklist-ref-empty", detail: "checklistRef must be a non-empty opaque id" } };
  }
  const intake = validateOperatorSignoffInput({ signedBy: input.signedBy });
  if (intake !== null) {
    return { ok: false, refusal: intake };
  }
  if (typeof input.signedAt !== "string" || input.signedAt.length === 0) {
    return { ok: false, refusal: { reason: "signed-at-missing", detail: "signedAt must be a non-empty ISO-8601 string" } };
  }
  if (checklist === null || typeof checklist !== "object") {
    return {
      ok: false,
      refusal: {
        reason: "signoff-without-checklist",
        detail: "the signoff requires the checklist it references (the OPERATOR SIGNOFF LAW: never a signoff without its gate)",
      },
    };
  }
  if (checklist.id !== input.checklistRef) {
    return {
      ok: false,
      refusal: { reason: "checklist-ref-mismatch", detail: "the signoff must reference the checklist it was constructed with (correct by construction)" },
    };
  }
  if (!isCompleteLaunchGateChecklist(checklist)) {
    return {
      ok: false,
      refusal: {
        reason: "checklist-incomplete",
        detail: "the signoff references a COMPLETE checklist (exactly the canonical 20 launch-gate points)",
      },
    };
  }
  if (!launchGatePasses(checklist)) {
    return {
      ok: false,
      refusal: {
        reason: "checklist-not-passing",
        detail: "the signoff requires a passing gate (all 20 points passed with successful journey evidence — the OPERATOR SIGNOFF LAW)",
      },
    };
  }
  return {
    ok: true,
    record: deepFreeze({
      id: input.id,
      checklistRef: input.checklistRef,
      signedBy: input.signedBy,
      signedAt: input.signedAt,
      simulated: true,
    }),
  };
}
