// YOU launch-gate application service — shared internal types and helpers.
//
// The application service (launchGateService.ts) is the single authority
// over launch-gate truth (docs/you/CONTRACTS.md "Wave-12 contract freeze
// (v12)"; WORK_ORDERS.md W12A): the 20-point checklists assembled from
// E2eJourneyRecord evidence, the operator signoffs, and the release
// declarations. The plane separation holds by construction: the service
// NEVER mutates evidence/twin/editing/platform/security state; it
// records launch-gate facts only. The stateless validators stay the
// single refusal authority (shared/src/you/launchGate.ts,
// operatorSignoff.ts, releaseDeclaration.ts); nothing here is a second
// validator.
//
// Error-code mapping (frozen W12A taxonomy):
//   YOU_LAUNCH_GATE_INVALID        — checklist intake (checklist-
//                                    incomplete / journeys-malformed /
//                                    journey-evidence shape) and
//                                    unknown checklist lookups
//   YOU_OPERATOR_SIGNOFF_INVALID   — signoff intake (signed-by-empty),
//                                    the signoff law (unknown-checklist /
//                                    checklist-incomplete /
//                                    checklist-not-passing /
//                                    already-signed), unknown-signoff and
//                                    no-signoff lookups
//   YOU_RELEASE_DECLARATION_INVALID — declaration intake
//                                    (evidence-bundle-ref-empty /
//                                    rollback-evidence-ref-empty), the
//                                    declaration law (unknown-signoff /
//                                    signoff-ref-mismatch / chain
//                                    verification / already-declared),
//                                    unknown-declaration and
//                                    no-declaration lookups

import type {
  LaunchGateChecklistRecord,
  OpaqueId,
  OperatorSignoffRecord,
  ReleaseDeclarationRecord,
  YouError,
} from "@zcode/shared";
import type { SolutionEventLedger } from "../../../shared/src/you/events.js";
import type { YouClock } from "../../../shared/src/you/clock.js";
import type { YouIdFactory } from "../../../shared/src/you/ids.js";

/** Typed service result: every operation succeeds or fails with a YouError. */
export type LaunchGateServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: YouError };

export function launchGateFailure(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean>,
): { readonly ok: false; readonly error: YouError } {
  return { ok: false, error: { code, message, details, simulated: true } };
}

/** The deps every launch-gate flow receives (injected clock/ids). */
export interface LaunchGateFlowDeps {
  readonly clock: YouClock;
  readonly ids: YouIdFactory;
}

/**
 * The checklist lifecycle head (a projection over the append-only
 * facts, never stored on the frozen record shape): checked -> signed ->
 * released (the signoff's declaration). A failing gate stays "checked"
 * forever — it can never be signed.
 */
export type LaunchGateChecklistStatus = "checked" | "signed" | "released";

/**
 * One solution's launch-gate plane: the append-only ledger, the
 * immutable checklists, the immutable operator signoffs and the
 * immutable release declarations, plus the two lifecycle heads that
 * enforce the OPERATOR SIGNOFF LAW's immutability clauses (one signoff
 * per checklist — a re-sign is refused, never a rewrite; one release
 * declaration per signoff — a re-declaration is refused, never a
 * rewrite). The service is the sole writer; every assembly / signoff /
 * declaration rides the ledger.
 */
export interface LaunchGatePlaneRecord {
  readonly solutionId: OpaqueId;
  readonly ledger: SolutionEventLedger;
  /** checklistId -> immutable LaunchGateChecklistRecord. */
  readonly checklists: Map<OpaqueId, LaunchGateChecklistRecord>;
  /** signoffId -> immutable OperatorSignoffRecord. */
  readonly signoffs: Map<OpaqueId, OperatorSignoffRecord>;
  /** declarationId -> immutable ReleaseDeclarationRecord. */
  readonly declarations: Map<OpaqueId, ReleaseDeclarationRecord>;
  /** checklistId -> the signoffId that signed it (the one-signoff-per-checklist head). */
  readonly signedChecklists: Map<OpaqueId, OpaqueId>;
  /** signoffId -> the declarationId that declared it (the one-release-per-signoff head). */
  readonly declaredSignoffs: Map<OpaqueId, OpaqueId>;
}

/** Sorted ids of a Map's keys (FIXTURES.md law 4: stable ordering). */
export function sortedLaunchGateMapKeys<T>(store: Map<OpaqueId, T>): OpaqueId[] {
  return [...store.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The checklist lookup helper: typed YOU_LAUNCH_GATE_INVALID. */
export function requireLaunchGateChecklist(
  plane: LaunchGatePlaneRecord,
  checklistId: OpaqueId,
): { readonly record: LaunchGateChecklistRecord } | { readonly error: YouError } {
  const record = plane.checklists.get(checklistId);
  if (record === undefined) {
    return {
      error: {
        code: "YOU_LAUNCH_GATE_INVALID",
        message: "unknown launch-gate checklist",
        details: { reason: "unknown-checklist", checklistId },
        simulated: true,
      },
    };
  }
  return { record };
}

/** The signoff lookup helper: typed YOU_OPERATOR_SIGNOFF_INVALID. */
export function requireOperatorSignoff(
  plane: LaunchGatePlaneRecord,
  signoffId: OpaqueId,
): { readonly signoff: OperatorSignoffRecord } | { readonly error: YouError } {
  const signoff = plane.signoffs.get(signoffId);
  if (signoff === undefined) {
    return {
      error: {
        code: "YOU_OPERATOR_SIGNOFF_INVALID",
        message: "unknown operator signoff",
        details: { reason: "unknown-signoff", signoffId },
        simulated: true,
      },
    };
  }
  return { signoff };
}

/** The declaration lookup helper: typed YOU_RELEASE_DECLARATION_INVALID. */
export function requireReleaseDeclaration(
  plane: LaunchGatePlaneRecord,
  declarationId: OpaqueId,
): { readonly declaration: ReleaseDeclarationRecord } | { readonly error: YouError } {
  const declaration = plane.declarations.get(declarationId);
  if (declaration === undefined) {
    return {
      error: {
        code: "YOU_RELEASE_DECLARATION_INVALID",
        message: "unknown release declaration",
        details: { reason: "unknown-declaration", declarationId },
        simulated: true,
      },
    };
  }
  return { declaration };
}
