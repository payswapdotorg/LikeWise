// YOU twin evidence bindings (W3A — docs/you/CONTRACTS.md "Twin /
// reconstruction": "Evidence bindings reference immutable EvidenceRecords
// by id + contentHash with their consent references. Derived
// representations must not outlive their consent scope: binding-time
// consent state is recorded and enforced by the service (withdrawal
// blocks new bindings and new processing; already-derived immutable
// versions keep provenance)").
//
// This module owns the pure binding machinery: construction from a wave-2
// EvidenceRecord, binding-time consent-reference recording, and integrity
// verification of pre-built bindings. The enforcement decision itself is
// the frozen wave-2 predicate `canProcess` (evidenceConsent.ts) — the
// twin service applies it at binding time through an evidence-authority
// seam; nothing here is a second consent authority.

import type { ConsentPurpose, ConsentReference, ConsentState, EvidenceRecord, OpaqueId, TwinEvidenceBinding } from "./contract.js";
import { deepFreeze } from "./serialize.js";

/**
 * Purpose under which twin construction / reconstruction processing is
 * consent-checked at binding time (twin generation is solution
 * generation).
 */
export const TWIN_BINDING_PURPOSE: ConsentPurpose = "solution-generation";

/** Binding-time evidence resolution supplied by the evidence authority seam. */
export interface TwinEvidenceResolution {
  readonly record: EvidenceRecord;
  /** Live consent state of the record's policy, as the evidence authority sees it. */
  readonly liveConsentState: ConsentState;
}

/**
 * Constructs the immutable evidence binding for one EvidenceRecord. The
 * recorded consent reference captures the BINDING-TIME live state (not
 * the capture-time snapshot) so a binding never silently outlives its
 * consent scope; the policy's learningPermission is an immutable policy
 * property and is carried from the record's snapshot.
 */
export function constructTwinEvidenceBinding(resolution: TwinEvidenceResolution): TwinEvidenceBinding {
  return deepFreeze({
    evidenceId: resolution.record.id,
    evidenceContentHash: resolution.record.contentHash,
    consent: deepFreeze({
      policyId: resolution.record.consent.policyId,
      state: resolution.liveConsentState,
      learningPermission: resolution.record.consent.learningPermission,
    }),
  });
}

/**
 * Integrity check for a pre-built binding against the resolved record:
 * the binding must reference the record's id and its exact content hash.
 * Returns a reason when the binding does not match, or null when sound.
 */
export function verifyTwinEvidenceBinding(
  binding: TwinEvidenceBinding,
  record: EvidenceRecord,
): string | null {
  if (binding.evidenceId !== record.id) {
    return `binding references evidence ${binding.evidenceId} but the record is ${record.id}`;
  }
  if (binding.evidenceContentHash !== record.contentHash) {
    return `binding content hash ${binding.evidenceContentHash} does not match record ${record.contentHash}`;
  }
  return null;
}

/** Sorts bindings by evidence id (FIXTURES.md law 4: stable ordering). */
export function sortTwinEvidenceBindings(bindings: readonly TwinEvidenceBinding[]): TwinEvidenceBinding[] {
  return [...bindings].sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0));
}

/** Unique evidence ids of a binding list, sorted. */
export function evidenceIdsOfBindings(bindings: readonly TwinEvidenceBinding[]): OpaqueId[] {
  return [...new Set(bindings.map((binding) => binding.evidenceId))].sort();
}

/** Sorted content hashes of a binding list (deterministic reconstruction seeds). */
export function evidenceHashesOfBindings(bindings: readonly TwinEvidenceBinding[]): string[] {
  return sortTwinEvidenceBindings([...bindings]).map((binding) => binding.evidenceContentHash);
}

/**
 * The consent reference a binding would record, given the live state —
 * exposed for enforcement diagnostics without constructing a binding.
 */
export function bindingTimeConsentReference(
  record: EvidenceRecord,
  liveConsentState: ConsentState,
): ConsentReference {
  return deepFreeze({
    policyId: record.consent.policyId,
    state: liveConsentState,
    learningPermission: record.consent.learningPermission,
  });
}
