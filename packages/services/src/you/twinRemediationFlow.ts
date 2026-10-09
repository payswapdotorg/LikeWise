// YOU twin service — deficiency remediation flow (W3A — docs/you/
// CONTRACTS.md "A deficiency may reference a targeted EvidenceRequest
// (the wave-2 capture machinery) — quality improvement flows through
// evidence capture, never through silent mutation").
//
// Opening a remediation request NEVER mutates a published version: the
// frozen deficiency record keeps its publication-time
// remediationEvidenceRequestId; the linkage lives in the plane's
// append-only remediation registry (deficiencyKey -> requestId) and is
// journaled through the evidence-requested event (W1A event type, same
// semantics). The NEXT publication consults the registry, so its frozen
// quality state carries the request id for still-deficient facets.

import type { EvidenceRequest, OpaqueId, TwinDeficiency } from "@zcode/shared";
import { createRemediationEvidenceRequest, twinDeficiencyKey, type RemediationEvidenceRequestInput } from "../../../shared/src/you/twinQuality.js";
import { appendRemediationEvidenceRequested } from "./twinLedgerOps.js";
import type { TwinPlaneRecord, TwinServiceDeps, TwinServiceResult } from "./twinServiceTypes.js";
import { requireTwinVersion } from "./twinServiceTypes.js";

/** Resolves a published deficiency by id inside its version. */
function requireDeficiency(
  plane: TwinPlaneRecord,
  twinId: OpaqueId,
  versionId: OpaqueId,
  deficiencyId: OpaqueId,
): { readonly deficiency: TwinDeficiency } | { readonly error: import("@zcode/shared").YouError } {
  const found = requireTwinVersion(plane, twinId, versionId);
  if ("error" in found) {
    return { error: found.error };
  }
  const deficiency = found.version.quality.deficiencies.find((entry) => entry.id === deficiencyId);
  if (deficiency === undefined) {
    return {
      error: {
        code: "YOU_INVALID_STATE",
        message: "unknown twin deficiency",
        details: { reason: "unknown-twin-deficiency", twinId, versionId, deficiencyId },
        simulated: true,
      },
    };
  }
  return { deficiency };
}

/**
 * Opens the targeted EvidenceRequest remediating one published
 * deficiency. Idempotent per deficiency key (class:domain): a second
 * open returns the existing request with alreadyLinked: true — never a
 * duplicate request, never a mutation of the published version.
 */
export function openRemediationEvidenceRequestOp(
  plane: TwinPlaneRecord,
  deps: TwinServiceDeps,
  twinId: OpaqueId,
  versionId: OpaqueId,
  deficiencyId: OpaqueId,
  input: RemediationEvidenceRequestInput,
): TwinServiceResult<{ readonly request: EvidenceRequest; readonly alreadyLinked: boolean }> {
  const resolved = requireDeficiency(plane, twinId, versionId, deficiencyId);
  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }
  const key = twinDeficiencyKey(resolved.deficiency.deficiencyClass, resolved.deficiency.domain);
  const existingId = plane.remediationByDeficiencyKey.get(key);
  if (existingId !== undefined) {
    const existing = plane.remediationRequests.get(existingId);
    if (existing !== undefined) {
      return { ok: true, value: { request: existing.request, alreadyLinked: true } };
    }
  }
  const request = createRemediationEvidenceRequest(resolved.deficiency, versionId, deps, input);
  plane.remediationRequests.set(request.id, { request, twinVersionId: versionId });
  plane.remediationByDeficiencyKey.set(key, request.id);
  appendRemediationEvidenceRequested(plane, request, versionId);
  return { ok: true, value: { request, alreadyLinked: false } };
}

/** The remediation request serving one published deficiency (registry lookup), or null. */
export function remediationRequestOfDeficiencyOp(
  plane: TwinPlaneRecord,
  twinId: OpaqueId,
  versionId: OpaqueId,
  deficiencyId: OpaqueId,
): TwinServiceResult<{ readonly request: EvidenceRequest | null }> {
  const resolved = requireDeficiency(plane, twinId, versionId, deficiencyId);
  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }
  const requestId = plane.remediationByDeficiencyKey.get(
    twinDeficiencyKey(resolved.deficiency.deficiencyClass, resolved.deficiency.domain),
  );
  const entry = requestId === undefined ? undefined : plane.remediationRequests.get(requestId);
  return { ok: true, value: { request: entry?.request ?? null } };
}
