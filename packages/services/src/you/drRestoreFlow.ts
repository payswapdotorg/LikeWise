// YOU platform service — DR restore verification flow (W10A). The ops
// live here; platformService.ts is the single authority that dispatches
// into them (the W1A/W8A flow precedent).
//
// THE DR LAW (docs/you/CONTRACTS.md wave-10): a restore verifies
// content hashes BEFORE activation; the verified flag is never asserted
// without check evidence (YOU_DR_RESTORE_INVALID).
//
// The op gates through the rate limiter first
// (enforcement-before-effect), then verifies: the snapshot bytes are
// read from the injected content store (the wave-2 evidence content
// abstraction — DR snapshots are content-addressed exactly like
// evidence) and their sha-256 is compared against the manifest's
// expected hash BEFORE anything activates. A verified restore appends
// the `dr-restore-recorded` event (activated) and becomes the plane's
// active restore head. A hash mismatch is RECORDED as a failed restore
// (verified: false, refusalReason "hash-mismatch", activated false) AND
// refused with the typed YOU_DR_RESTORE_INVALID — never silent, never
// activated. A missing snapshot ref is refused without a record (a
// lookup miss — the arena unknown-provider precedent: nothing exists
// to audit). The constructDrRestoreRecord law check (verified flag
// requires check evidence) is the shared authority; this flow passes
// evidence only from the single verification gate.

import type { DrRestoreRecord } from "@zcode/shared";
import {
  constructDrRestoreRecord,
  verifyDrSnapshotContent,
  type DrRestoreCheckEvidence,
  type DrRestoreInput,
} from "../../../shared/src/you/drRestore.js";
import { appendDrRestoreRecorded } from "./platformLedgerOps.js";
import { gateRateLimitOp } from "./rateLimitFlow.js";
import {
  platformFailure,
  type PlatformFlowDeps,
  type PlatformPlaneRecord,
  type PlatformServiceResult,
} from "./platformServiceTypes.js";

/** The canonical gate scope for DR restores (enforcement-before-effect). */
export const DR_RESTORE_GATE_SCOPE = "dr:restore";

/**
 * Restores a DR snapshot: verification BEFORE activation (the DR LAW).
 * On success the immutable DrRestoreRecord (verified: true) is recorded,
 * the `dr-restore-recorded` event (activated) is appended and the
 * record becomes the active restore head. On hash mismatch the failed
 * attempt is recorded (verified: false, never activated) and refused
 * with the typed YOU_DR_RESTORE_INVALID. On a missing snapshot ref the
 * attempt is refused without a record (nothing exists to audit).
 */
export function restoreSnapshotOp(
  plane: PlatformPlaneRecord,
  deps: PlatformFlowDeps,
  input: DrRestoreInput,
): PlatformServiceResult<{ readonly record: DrRestoreRecord; readonly evidence: DrRestoreCheckEvidence }> {
  const gate = gateRateLimitOp(plane, deps, DR_RESTORE_GATE_SCOPE, input.snapshotRef);
  if (!gate.ok) {
    return gate;
  }
  const verifiedAt = deps.clock.now();
  const verification = verifyDrSnapshotContent(deps.store, input, verifiedAt);
  if (!verification.ok) {
    if (verification.refusal.reason === "snapshot-missing") {
      // A lookup miss: nothing exists to audit — the typed refusal alone.
      return platformFailure("YOU_DR_RESTORE_INVALID", `DR restore refused: ${verification.refusal.detail}`, {
        reason: verification.refusal.reason,
        snapshotRef: input.snapshotRef,
      });
    }
    // A hash mismatch: record the failed attempt (never activated) and refuse.
    const restoredAt = deps.clock.now();
    const failed = constructDrRestoreRecord(
      {
        id: deps.ids.next("dr-restore"),
        snapshotRef: input.snapshotRef,
        restoredAt,
        verified: false,
      },
      null,
    );
    if (!failed.ok) {
      return platformFailure("YOU_DR_RESTORE_INVALID", `DR restore refused: ${failed.refusal.detail}`, {
        reason: failed.refusal.reason,
        snapshotRef: input.snapshotRef,
      });
    }
    plane.drRestores.set(failed.record.id, failed.record);
    appendDrRestoreRecorded(plane, failed.record, {
      activated: false,
      checkEvidencePresent: false,
      expectedHash: input.expectedContentHash,
      actualHash: "",
      byteLength: 0,
      refusalReason: verification.refusal.reason,
    });
    return platformFailure("YOU_DR_RESTORE_INVALID", `DR restore refused: ${verification.refusal.detail}`, {
      reason: verification.refusal.reason,
      snapshotRef: input.snapshotRef,
      expectedContentHash: input.expectedContentHash,
      restoreId: failed.record.id,
    });
  }
  const restoredAt = deps.clock.now();
  const constructed = constructDrRestoreRecord(
    {
      id: deps.ids.next("dr-restore"),
      snapshotRef: input.snapshotRef,
      restoredAt,
      verified: true,
    },
    verification.evidence,
  );
  if (!constructed.ok) {
    return platformFailure("YOU_DR_RESTORE_INVALID", `DR restore refused: ${constructed.refusal.detail}`, {
      reason: constructed.refusal.reason,
      snapshotRef: input.snapshotRef,
    });
  }
  plane.drRestores.set(constructed.record.id, constructed.record);
  plane.activeRestoreId = constructed.record.id;
  appendDrRestoreRecorded(plane, constructed.record, {
    activated: true,
    checkEvidencePresent: true,
    expectedHash: verification.evidence.expectedContentHash,
    actualHash: verification.evidence.actualContentHash,
    byteLength: verification.evidence.byteLength,
    refusalReason: "",
  });
  return { ok: true, value: { record: constructed.record, evidence: verification.evidence } };
}
