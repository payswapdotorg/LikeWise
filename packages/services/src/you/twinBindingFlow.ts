// YOU twin service — evidence binding flow (binding-time consent
// enforcement; docs/you/CONTRACTS.md "Twin / reconstruction":
// "Evidence bindings reference immutable EvidenceRecords by id +
// contentHash with their consent references. Derived representations must
// not outlive their consent scope: binding-time consent state is recorded
// and enforced by the service (withdrawal blocks new bindings and new
// processing; already-derived immutable versions keep provenance)").
//
// The evidence authority stays the wave-2 evidence service: every
// resolution flows through the injected TwinEvidencePort, whose decision
// is the frozen `canProcess` predicate applied by the evidence authority
// over the LIVE consent state (the port adapter maps EvidenceService
// .checkProcessing — there is no second consent authority in the twin
// lane). The binding records the binding-time live state. Withdrawn /
// denied / expired consent blocks NEW bindings with the typed
// YOU_CONSENT_REQUIRED error — never a silent skip. Already-published
// versions are immutable and keep their recorded provenance by
// construction (nothing here can reach them).

import type { OpaqueId, TwinEvidenceBinding } from "@zcode/shared";
import {
  constructTwinEvidenceBinding,
  sortTwinEvidenceBindings,
  TWIN_BINDING_PURPOSE,
  verifyTwinEvidenceBinding,
} from "../../../shared/src/you/twinBinding.js";
import type { TwinEvidencePort, TwinServiceResult } from "./twinServiceTypes.js";
import { twinFailure } from "./twinServiceTypes.js";

/** Binding input: either evidence ids to resolve+enforce, or pre-built bindings to verify. */
export interface EvidenceBindingInput {
  /** Evidence ids resolved through the port (consent enforced, binding-time state recorded). */
  readonly evidenceIds?: readonly OpaqueId[];
  /**
   * Pre-built bindings (e.g. replaying a reconstruction spec's bindings):
   * each is verified against the resolved record AND consent-enforced
   * before use.
   */
  readonly bindings?: readonly TwinEvidenceBinding[];
}

/** Result of enforcing+constructing bindings for one publication/job. */
export interface BindingsOutcome {
  readonly bindings: readonly TwinEvidenceBinding[];
}

/**
 * Resolves, consent-enforces and constructs the evidence bindings for a
 * twin version / reconstruction job. For every referenced evidence id
 * (sorted, de-duplicated — stable ordering):
 *   1. unknown record -> typed YOU_EVIDENCE_NOT_FOUND;
 *   2. the frozen wave-2 `canProcess` decision (live consent, purpose
 *      TWIN_BINDING_PURPOSE) must allow processing — withdrawn / denied /
 *      expired consent blocks the NEW binding with YOU_CONSENT_REQUIRED
//      (fail-closed, the reason carried in details);
 *   3. a pre-built binding must match the record id + contentHash
 *      exactly (typed YOU_CONTENT_HASH_MISMATCH — never a silent repair).
 * The constructed binding records the binding-time live consent state.
 */
export function resolveEvidenceBindingsOp(
  port: TwinEvidencePort,
  input: EvidenceBindingInput,
): TwinServiceResult<BindingsOutcome> {
  const evidenceIds = input.evidenceIds ?? input.bindings?.map((binding) => binding.evidenceId) ?? [];
  if (evidenceIds.length === 0) {
    return { ok: true, value: { bindings: [] } };
  }
  const prebuilt = new Map<OpaqueId, TwinEvidenceBinding>();
  for (const binding of input.bindings ?? []) {
    prebuilt.set(binding.evidenceId, binding);
  }
  const bindings: TwinEvidenceBinding[] = [];
  const resolvedIds = new Set<OpaqueId>();
  for (const evidenceId of [...evidenceIds].sort()) {
    if (resolvedIds.has(evidenceId)) {
      continue;
    }
    resolvedIds.add(evidenceId);
    const resolution = port.resolveEvidenceForBinding(evidenceId, TWIN_BINDING_PURPOSE);
    if (resolution === null) {
      return twinFailure("YOU_EVIDENCE_NOT_FOUND", "unknown evidence record for twin binding", {
        reason: "unknown-evidence",
        evidenceId,
      });
    }
    if (!resolution.processing.allowed) {
      return twinFailure("YOU_CONSENT_REQUIRED", `twin evidence binding denied: ${resolution.processing.reason}`, {
        reason: resolution.processing.reason,
        evidenceId,
        privacyClass: resolution.record.privacyClass,
        policyId: resolution.record.consent.policyId,
        liveConsentState: resolution.liveConsentState,
        purpose: TWIN_BINDING_PURPOSE,
      });
    }
    const prebuiltBinding = prebuilt.get(evidenceId);
    if (prebuiltBinding !== undefined) {
      const mismatch = verifyTwinEvidenceBinding(prebuiltBinding, resolution.record);
      if (mismatch !== null) {
        return twinFailure("YOU_CONTENT_HASH_MISMATCH", "pre-built twin evidence binding does not match the record", {
          reason: "binding-record-mismatch",
          evidenceId,
          detail: mismatch,
        });
      }
    }
    bindings.push(constructTwinEvidenceBinding(resolution));
  }
  return { ok: true, value: { bindings: sortTwinEvidenceBindings(bindings) } };
}

export { TWIN_BINDING_PURPOSE };
