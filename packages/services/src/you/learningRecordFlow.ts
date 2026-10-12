// YOU learning service — learning-record flow: content synthesis,
// rights issuance, the validation ladder and the usage gate (W6A —
// docs/you/WORK_ORDERS.md W6A).
//
//   - synthesizeLearningContentOp: deterministic fixture synthesis of
//     the validated-learning content bytes (seed-derived; stored
//     through the wave-2 content store — contentRef + sha-256
//     contentHash, never inlined).
//   - issueLearningRightsOp: binds usage classes to a LIVE wave-2
//     consent grant through the injected LearningConsentPort (consentRef
//     + consentHash; no second consent path). Unresolvable, non-granted,
//     non-learning grants are typed YOU_LEARNING_RIGHTS_REQUIRED
//     refusals — issuance is enforcement, not paperwork.
//   - openCandidateRecordOp: candidate construction over a captured
//     signal (rights optional — records without rights are inert).
//   - validateLearningRecordOp: candidate -> validated (append-only
//     event; optional supersession of an already-validated record via
//     supersededById linkage — never in-place mutation).
//   - rejectLearningRecordOp: candidate -> rejected (append-only event).
//   - useLearningRecordOp: the rights-enforcement surface — a record is
//     usable only within its LearningRights grant; every out-of-grant
//     use is a typed YOU_LEARNING_RIGHTS_REQUIRED refusal.
//
// Ladder discipline (the W4A/W5A immutable-replacement precedent): a
// transition produces a NEW deep-frozen record under the SAME id; the
// plane store replaces the instance; the ledger only ever appends.

import type { LearningRecord, LearningRightUsage, LearningRights, OpaqueId, YouError } from "@zcode/shared";
import { createLearningCandidateRecord, transitionLearningRecord } from "../../../shared/src/you/learningRecord.js";
import {
  createLearningRights,
  evaluateLearningRights,
  INERT_LEARNING_RIGHTS,
  learningGrantHash,
} from "../../../shared/src/you/learningRights.js";
import type { EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { createDeterministicRng, seedFromString } from "../../../shared/src/you/rng.js";
import type { LearningConsentPort, LearningPlaneRecord, LearningServiceDeps, LearningServiceResult } from "./learningServiceTypes.js";
import { learningFailure, recordNotInStatus, requireLearningRecord } from "./learningServiceTypes.js";
import { appendLearningRecordRejected, appendLearningRecordValidated } from "./learningLedgerOps.js";

/** Fixed synthetic learning-content size (fixture definition). */
export const FIXTURE_LEARNING_CONTENT_BYTE_LENGTH = 512;

/** Deterministic fixture learning-content bytes (seed-derived only; FIXTURES.md laws 1-2). */
export function synthesizeFixtureLearningContentBytes(seedText: string): Uint8Array {
  const rng = createDeterministicRng(seedFromString(`learning-content:${seedText}`));
  const bytes = new Uint8Array(FIXTURE_LEARNING_CONTENT_BYTE_LENGTH);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const word = rng.nextUint32();
    const remaining = Math.min(4, bytes.length - offset);
    for (let byteIndex = 0; byteIndex < remaining; byteIndex += 1) {
      bytes[offset + byteIndex] = (word >>> (byteIndex * 8)) & 0xff;
    }
  }
  return bytes;
}

/** Content deps bundle for flows that construct content-addressed records. */
export interface LearningContentDeps extends LearningServiceDeps {
  readonly store: EvidenceContentStore;
}

/** Synthesizes + stores the validated-learning content (contentRef + sha-256 contentHash). */
export function synthesizeLearningContentOp(
  deps: LearningContentDeps,
  input: { readonly seedText: string },
): LearningServiceResult<{ readonly contentRef: string; readonly contentHash: string }> {
  if (input.seedText.length === 0) {
    return learningFailure("YOU_INVALID_STATE", "learning content synthesis requires a non-empty seedText", {
      reason: "empty-seed-text",
    });
  }
  const binding = deps.store.put(synthesizeFixtureLearningContentBytes(input.seedText));
  return { ok: true, value: { contentRef: binding.contentRef, contentHash: binding.contentHash } };
}

export interface IssueLearningRightsInput {
  /** The wave-2 consent instrument (consent policy id) the grant binds to. */
  readonly consentRef: string;
  readonly usage: readonly LearningRightUsage[];
  readonly expiresAt?: string | null;
}

/**
 * Issues a LearningRights grant bound to a LIVE wave-2 consent grant
 * (consentRef + the content-addressed consentHash of the grant facts).
 * Issuance enforces the grant: an unresolvable ref, a non-granted
 * state, a grant without learning reuse or without the "learning"
 * purpose is a typed YOU_LEARNING_RIGHTS_REQUIRED refusal — the
 * learning plane never invents consent (no second consent path).
 */
export function issueLearningRightsOp(
  port: LearningConsentPort,
  input: IssueLearningRightsInput,
): LearningServiceResult<{ readonly rights: LearningRights }> {
  const liveGrant = port.resolveLearningGrant(input.consentRef);
  if (liveGrant === null) {
    return learningFailure("YOU_LEARNING_RIGHTS_REQUIRED", "the consent instrument does not resolve in the wave-2 consent authority", {
      reason: "consent-unresolvable",
      consentRef: input.consentRef,
    });
  }
  if (liveGrant.state !== "granted") {
    return learningFailure("YOU_LEARNING_RIGHTS_REQUIRED", `the consent instrument state is "${liveGrant.state}", not granted`, {
      reason: `consent-${liveGrant.state}`,
      consentRef: input.consentRef,
    });
  }
  if (!liveGrant.learningReuse) {
    return learningFailure("YOU_LEARNING_RIGHTS_REQUIRED", "the consent instrument does not permit learning reuse", {
      reason: "learning-reuse-not-permitted",
      consentRef: input.consentRef,
    });
  }
  if (!liveGrant.purposes.includes("learning")) {
    return learningFailure("YOU_LEARNING_RIGHTS_REQUIRED", 'the consent instrument does not cover the "learning" purpose', {
      reason: "purpose-not-covered",
      consentRef: input.consentRef,
    });
  }
  const created = createLearningRights({
    usage: [...input.usage],
    consentRef: input.consentRef,
    consentHash: learningGrantHash(liveGrant),
    expiresAt: input.expiresAt ?? null,
  });
  if (!created.ok) {
    return learningFailure("YOU_INVALID_STATE", `invalid learning rights: ${created.detail}`, {
      reason: created.code,
      detail: created.detail,
    });
  }
  return { ok: true, value: { rights: created.rights } };
}

export interface OpenCandidateRecordInput {
  readonly signalId: OpaqueId;
  readonly contentRef: string;
  readonly contentHash: string;
  /** Null = the inert grant (records without rights are inert). */
  readonly rights?: LearningRights | null;
  /** Truth law: fixture records stay `simulated: true` (default in the fixture-only phase 0). */
  readonly simulated?: boolean;
}

/** Opens a candidate learning record over a captured signal (status "candidate"). */
export function openCandidateRecordOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  input: OpenCandidateRecordInput,
): LearningServiceResult<{ readonly record: LearningRecord }> {
  const signal = plane.signals.get(input.signalId);
  if (signal === undefined) {
    return learningFailure("YOU_INVALID_STATE", "unknown learning signal", {
      reason: "unknown-signal",
      signalId: input.signalId,
    });
  }
  const created = createLearningCandidateRecord(
    {
      signalId: signal.id,
      scope: signal.scope,
      contentRef: input.contentRef,
      contentHash: input.contentHash,
      rights: input.rights ?? INERT_LEARNING_RIGHTS,
      simulated: input.simulated ?? true,
    },
    deps,
  );
  if (!created.ok) {
    return learningFailure("YOU_INVALID_STATE", `invalid learning record: ${created.detail}`, {
      reason: created.code,
      detail: created.detail,
    });
  }
  plane.records.set(created.record.id, created.record);
  plane.recordIds.push(created.record.id);
  return { ok: true, value: { record: created.record } };
}

export interface ValidateLearningRecordInput {
  readonly recordId: OpaqueId;
  /** When set, this validation SUPERSEDES the referenced (validated) record via append-only linkage. */
  readonly supersedesRecordId?: OpaqueId | null;
  /** Truth law: fixture records stay `simulated: true`. */
  readonly simulated?: boolean;
}

/**
 * Validates a candidate (candidate -> validated). When supersedesRecordId
 * is set, the referenced record must be VALIDATED and is superseded via
 * the append-only supersededById linkage (immutable replacement + the
 * linkage riding in this validation event's payload — never an
 * in-place mutation, never a second event type).
 */
export function validateLearningRecordOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  input: ValidateLearningRecordInput,
): LearningServiceResult<{ readonly record: LearningRecord; readonly superseded: LearningRecord | null }> {
  const found: { readonly record: LearningRecord } | { readonly error: YouError } = requireLearningRecord(plane, input.recordId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (found.record.status !== "candidate") {
    return recordNotInStatus(input.recordId, "candidate", found.record.status);
  }

  let superseded: LearningRecord | null = null;
  const supersedesRecordId = input.supersedesRecordId ?? null;
  if (supersedesRecordId !== null) {
    if (supersedesRecordId === input.recordId) {
      return learningFailure("YOU_INVALID_STATE", "a learning record cannot supersede itself", {
        reason: "self-supersession",
        recordId: input.recordId,
      });
    }
    const target: { readonly record: LearningRecord } | { readonly error: YouError } = requireLearningRecord(plane, supersedesRecordId);
    if ("error" in target) {
      return { ok: false, error: target.error };
    }
    if (target.record.status !== "validated") {
      return recordNotInStatus(supersedesRecordId, "validated", target.record.status);
    }
    superseded = transitionLearningRecord(target.record, {
      to: "superseded",
      supersededById: input.recordId,
      at: deps.clock.now(),
    });
    plane.records.set(superseded.id, superseded);
  }

  const validated = transitionLearningRecord(found.record, { to: "validated", at: deps.clock.now() });
  plane.records.set(validated.id, validated);
  appendLearningRecordValidated(plane, { record: validated, supersedesRecordId });
  return { ok: true, value: { record: validated, superseded } };
}

/** Rejects a candidate (candidate -> rejected; terminal, append-only). */
export function rejectLearningRecordOp(
  plane: LearningPlaneRecord,
  deps: LearningServiceDeps,
  input: { readonly recordId: OpaqueId; readonly reason: string },
): LearningServiceResult<{ readonly record: LearningRecord }> {
  const found: { readonly record: LearningRecord } | { readonly error: YouError } = requireLearningRecord(plane, input.recordId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (found.record.status !== "candidate") {
    return recordNotInStatus(input.recordId, "candidate", found.record.status);
  }
  const reason = input.reason.length > 0 ? input.reason : "unspecified";
  const rejected = transitionLearningRecord(found.record, { to: "rejected", at: deps.clock.now() });
  plane.records.set(rejected.id, rejected);
  appendLearningRecordRejected(plane, rejected, reason);
  return { ok: true, value: { record: rejected } };
}

/**
 * The usage gate (the RIGHTS LAW): a learning record is usable only
 * within its LearningRights grant. Only VALIDATED records are usable;
 * the usage class must be inside the grant; the live wave-2 consent
 * grant must still resolve, be granted, permit learning reuse, cover
 * the "learning" purpose and hash to the recorded consentHash; a due
 * expiresAt refuses. Every violation is a typed
 * YOU_LEARNING_RIGHTS_REQUIRED refusal (records without rights are
 * inert).
 */
export function useLearningRecordOp(
  plane: LearningPlaneRecord,
  port: LearningConsentPort,
  now: string,
  input: { readonly recordId: OpaqueId; readonly usage: LearningRightUsage },
): LearningServiceResult<{ readonly record: LearningRecord; readonly usage: LearningRightUsage }> {
  const found: { readonly record: LearningRecord } | { readonly error: YouError } = requireLearningRecord(plane, input.recordId);
  if ("error" in found) {
    return { ok: false, error: found.error };
  }
  if (found.record.status !== "validated") {
    return learningFailure("YOU_INVALID_STATE", `learning record ${found.record.id} is ${found.record.status}, not validated — only validated learning is usable`, {
      reason: "record-not-validated",
      recordId: found.record.id,
      status: found.record.status,
    });
  }
  const liveGrant = found.record.rights.consentRef.length > 0 ? port.resolveLearningGrant(found.record.rights.consentRef) : null;
  const decision = evaluateLearningRights(found.record.rights, input.usage, liveGrant, now);
  if (!decision.allowed) {
    return learningFailure(
      "YOU_LEARNING_RIGHTS_REQUIRED",
      `usage "${input.usage}" of learning record ${found.record.id} is outside its rights grant (${decision.reason})`,
      {
        reason: decision.reason,
        recordId: found.record.id,
        usage: input.usage,
        consentRef: found.record.rights.consentRef,
      },
    );
  }
  return { ok: true, value: { record: found.record, usage: input.usage } };
}
