// YOU ReleaseDeclarationRecord machinery (W12A — docs/you/CONTRACTS.md
// "Wave-12 contract freeze (v12)": "ReleaseDeclarationRecord"; the
// RELEASE DECLARATION LAW: the declaration carries the full evidence
// bundle reference AND rollback evidence — the production-eligibility
// law carried to the release (YOU_RELEASE_DECLARATION_INVALID)).
//
// This module owns the STATELESS declaration-intake validator and the
// immutable declaration constructor. Validation is pure: no clock, no
// rng, no store — the service maps refusals to typed
// YOU_RELEASE_DECLARATION_INVALID errors at its seam.
//
// THE RELEASE DECLARATION LAW's construct-time teeth (the W10C
// rollback-evidence-required precedent, carried to the release):
//   - the evidence bundle reference is REQUIRED (refusal
//     "evidence-bundle-ref-empty" — a release never free-floats
//     without its evidence bundle);
//   - the rollback evidence reference is REQUIRED (refusal
//     "rollback-evidence-ref-empty" — the PRODUCTION ELIGIBILITY LAW's
//     never-an-unbacked-release clause: an eligible release must be
//     reversible, and the reversibility proof is referenced, not
//     asserted);
//   - the full chain is verified by construction: the declaration
//     references its signoff (present + identical — refusals
//     "declaration-without-signoff" / "signoff-ref-mismatch"), and the
//     signoff's checklist is re-verified COMPLETE and PASSING (refusals
//     "signoff-without-checklist" / "checklist-ref-mismatch" /
//     "checklist-incomplete" / "checklist-not-passing") — a release
//     can never be declared over a gate that does not pass;
//   - "one release declaration per signoff" is the service-level
//     lifecycle teeth ("already-declared" — the declaration is
//     immutable; a re-declaration is refused, never a rewrite).
//
// Phase 0: every constructed record stays `simulated: true` (the truth
// law).

import type { LaunchGateChecklistRecord, OpaqueId, OperatorSignoffRecord, ReleaseDeclarationRecord } from "./contract.js";
import { deepFreeze } from "./serialize.js";
import { isCompleteLaunchGateChecklist, launchGatePasses } from "./launchGate.js";

/** A refusal returned by the stateless validators (never an exception). */
export interface ReleaseDeclarationRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  /** Human-readable detail for diagnostics. */
  readonly detail: string;
}

/** Declaration intake (the release facts the law requires). */
export interface ReleaseDeclarationInput {
  /** The full evidence bundle the release references (an opaque bundle ref). */
  readonly evidenceBundleRef: OpaqueId;
  /** The rollback evidence the release references (an opaque rollback-artifact ref — REQUIRED). */
  readonly rollbackEvidenceRef: OpaqueId;
}

/**
 * The stateless declaration-intake validator (the RELEASE DECLARATION
 * LAW's requirement teeth): both references non-empty.
 */
export function validateReleaseDeclarationInput(input: ReleaseDeclarationInput): ReleaseDeclarationRefusal | null {
  if (input === null || typeof input !== "object") {
    return { reason: "evidence-bundle-ref-empty", detail: "the declaration intake must carry its evidence bundle and rollback references" };
  }
  if (typeof input.evidenceBundleRef !== "string" || input.evidenceBundleRef.trim().length === 0) {
    return { reason: "evidence-bundle-ref-empty", detail: "evidenceBundleRef must be a non-empty opaque id (the full evidence bundle)" };
  }
  if (typeof input.rollbackEvidenceRef !== "string" || input.rollbackEvidenceRef.trim().length === 0) {
    return {
      reason: "rollback-evidence-ref-empty",
      detail: "rollbackEvidenceRef must be a non-empty opaque id (the RELEASE DECLARATION LAW: never a release without rollback evidence)",
    };
  }
  return null;
}

/**
 * Constructs the immutable, deep-frozen release declaration — THE
 * RELEASE DECLARATION LAW's teeth: the evidence bundle reference AND
 * the rollback evidence reference are required, and the full
 * gate->signoff chain is verified by construction (the signoff present
 * and identical; its checklist re-verified COMPLETE and PASSING). A
 * declaration without rollback evidence, without an evidence bundle,
 * or over a non-passing gate is refused, never recorded.
 */
export function constructReleaseDeclarationRecord(
  input: {
    readonly id: OpaqueId;
    readonly signoffRef: OpaqueId;
    readonly evidenceBundleRef: OpaqueId;
    readonly rollbackEvidenceRef: OpaqueId;
    readonly declaredAt: string;
  },
  signoff: OperatorSignoffRecord | null,
  checklist: LaunchGateChecklistRecord | null,
): { readonly ok: true; readonly record: ReleaseDeclarationRecord } | { readonly ok: false; readonly refusal: ReleaseDeclarationRefusal } {
  if (typeof input.signoffRef !== "string" || input.signoffRef.length === 0) {
    return { ok: false, refusal: { reason: "signoff-ref-empty", detail: "signoffRef must be a non-empty opaque id" } };
  }
  const intake = validateReleaseDeclarationInput({
    evidenceBundleRef: input.evidenceBundleRef,
    rollbackEvidenceRef: input.rollbackEvidenceRef,
  });
  if (intake !== null) {
    return { ok: false, refusal: intake };
  }
  if (typeof input.declaredAt !== "string" || input.declaredAt.length === 0) {
    return { ok: false, refusal: { reason: "declared-at-missing", detail: "declaredAt must be a non-empty ISO-8601 string" } };
  }
  if (signoff === null || typeof signoff !== "object") {
    return {
      ok: false,
      refusal: {
        reason: "declaration-without-signoff",
        detail: "the release declaration requires the operator signoff it references (never a release without the operator's gate approval)",
      },
    };
  }
  if (signoff.id !== input.signoffRef) {
    return {
      ok: false,
      refusal: { reason: "signoff-ref-mismatch", detail: "the declaration must reference the signoff it was constructed with (correct by construction)" },
    };
  }
  if (checklist === null || typeof checklist !== "object") {
    return {
      ok: false,
      refusal: {
        reason: "signoff-without-checklist",
        detail: "the signoff's checklist must be present for the chain verification (gate -> signoff -> release)",
      },
    };
  }
  if (checklist.id !== signoff.checklistRef) {
    return {
      ok: false,
      refusal: { reason: "checklist-ref-mismatch", detail: "the signoff's checklist reference must resolve to the checklist it signed (chain integrity)" },
    };
  }
  if (!isCompleteLaunchGateChecklist(checklist)) {
    return {
      ok: false,
      refusal: {
        reason: "checklist-incomplete",
        detail: "the release chain requires a COMPLETE checklist (exactly the canonical 20 launch-gate points)",
      },
    };
  }
  if (!launchGatePasses(checklist)) {
    return {
      ok: false,
      refusal: {
        reason: "checklist-not-passing",
        detail: "the release chain requires a passing gate (all 20 points passed — the RELEASE DECLARATION LAW's chain verification)",
      },
    };
  }
  return {
    ok: true,
    record: deepFreeze({
      id: input.id,
      signoffRef: input.signoffRef,
      evidenceBundleRef: input.evidenceBundleRef,
      rollbackEvidenceRef: input.rollbackEvidenceRef,
      declaredAt: input.declaredAt,
      simulated: true,
    }),
  };
}
