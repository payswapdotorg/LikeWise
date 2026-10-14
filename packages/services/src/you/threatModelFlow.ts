// YOU security service — threat-model entry flow (W11A). The ops live
// here; securityService.ts is the single authority that dispatches into
// them (the W1A/W8A/W10A flow precedent).
//
// The honesty law (docs/you/CONTRACTS.md wave-11): residual risk is
// stated honestly on every entry, never zeroed by assertion. The
// stateless authority is shared/src/you/threatModel.ts
// (validateThreatModelInput / constructThreatModelEntry); this flow
// maps its refusals to typed YOU_SECURITY_REVIEW_INVALID errors (the
// wave-11 code set routes threat-model refusals through the security
// review code — the frozen set has no threat-specific code).
//
// Threat-model entries are pre-review SERVICE STATE (the rate-limit
// policy precedent — the frozen wave-11 event set has no threat-model
// event): immutable once constructed, stored in the plane, read back
// through the service. They materialize in the ledger only through
// their review facts.

import type { ThreatModelEntry } from "@zcode/shared";
import { constructThreatModelEntry, type ThreatModelInput, type ThreatModelRefusal } from "../../../shared/src/you/threatModel.js";
import { securityFailure, type SecurityFlowDeps, type SecurityPlaneRecord, type SecurityServiceResult } from "./securityServiceTypes.js";

/** Maps a stateless threat-model refusal to the typed service error. */
function threatRefusal(refusal: ThreatModelRefusal): { readonly ok: false; readonly error: ReturnType<typeof securityFailure>["error"] } {
  return securityFailure("YOU_SECURITY_REVIEW_INVALID", `Threat-model entry refused: ${refusal.detail}`, {
    reason: refusal.reason,
  });
}

/**
 * Records one immutable threat-model entry (the honesty law: residual
 * stated on every entry, mitigationRef null recorded honestly when
 * unmitigated). Refusals: typed YOU_SECURITY_REVIEW_INVALID for intake
 * shape (threat-class-invalid / vector-empty / mitigation-ref-invalid /
 * residual-missing).
 */
export function recordThreatModelEntryOp(
  plane: SecurityPlaneRecord,
  deps: SecurityFlowDeps,
  input: ThreatModelInput,
): SecurityServiceResult<{ readonly entry: ThreatModelEntry }> {
  const constructed = constructThreatModelEntry({ ...input, id: deps.ids.next("threat-model") });
  if (!constructed.ok) {
    return threatRefusal(constructed.refusal);
  }
  plane.threatModel.set(constructed.entry.id, constructed.entry);
  return { ok: true, value: { entry: constructed.entry } };
}
