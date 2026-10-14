import assert from "node:assert/strict";
import test from "node:test";
import {
  constructDrRestoreRecord,
  verifyDrSnapshotContent,
  type DrRestoreCheckEvidence,
} from "./drRestore.js";
import { createFixtureEvidenceContentStore } from "./evidenceStore.js";

const VERIFIED_AT = "2026-01-01T00:00:01.000Z";

function tamperHash(contentHash: string): string {
  const first = contentHash.slice(0, 1);
  const flipped = first === "0" ? "1" : "0";
  return `${flipped}${contentHash.slice(1)}`;
}

function fixtureStore(): { store: ReturnType<typeof createFixtureEvidenceContentStore>; hash: string; ref: string } {
  const store = createFixtureEvidenceContentStore();
  const bytes = Uint8Array.from([0x79, 0x6f, 0x75, 0x2d, 0x77, 0x31, 0x30, 0x61]);
  const binding = store.put(bytes);
  return { store, hash: binding.contentHash, ref: binding.contentRef };
}

test("verifyDrSnapshotContent: a matching hash produces check evidence (BEFORE any activation)", () => {
  const { store, hash, ref } = fixtureStore();
  const verification = verifyDrSnapshotContent(store, { snapshotRef: ref, expectedContentHash: hash }, VERIFIED_AT);
  assert.ok(verification.ok);
  if (!verification.ok) {
    return;
  }
  assert.equal(verification.evidence.snapshotRef, ref);
  assert.equal(verification.evidence.expectedContentHash, hash);
  assert.equal(verification.evidence.actualContentHash, hash);
  assert.equal(verification.evidence.byteLength, 8);
  assert.equal(verification.evidence.verifiedAt, VERIFIED_AT);
  assert.equal(verification.evidence.simulated, true);
  assert.ok(Object.isFrozen(verification.evidence));
});

test("verifyDrSnapshotContent refuses a hash mismatch fail-closed (corrupted or stale content)", () => {
  const { store, hash, ref } = fixtureStore();
  const verification = verifyDrSnapshotContent(store, { snapshotRef: ref, expectedContentHash: tamperHash(hash) }, VERIFIED_AT);
  assert.ok(!verification.ok);
  if (verification.ok) {
    return;
  }
  assert.equal(verification.refusal.reason, "hash-mismatch");
});

test("verifyDrSnapshotContent refuses a missing snapshot ref (unverifiable: nothing resolves)", () => {
  const { store } = fixtureStore();
  const verification = verifyDrSnapshotContent(
    store,
    { snapshotRef: "you_content_missing00000000000", expectedContentHash: "0".repeat(64) },
    VERIFIED_AT,
  );
  assert.ok(!verification.ok);
  if (verification.ok) {
    return;
  }
  assert.equal(verification.refusal.reason, "snapshot-missing");
});

test("verifyDrSnapshotContent refuses malformed intake", () => {
  const { store, hash, ref } = fixtureStore();
  assert.equal(verifyDrSnapshotContent(store, { snapshotRef: "", expectedContentHash: hash }, VERIFIED_AT).ok, false);
  assert.equal(verifyDrSnapshotContent(store, { snapshotRef: ref, expectedContentHash: "" }, VERIFIED_AT).ok, false);
});

test("THE DR LAW: the verified flag is never asserted without check evidence", () => {
  const { hash, ref } = fixtureStore();
  const evidence: DrRestoreCheckEvidence = {
    snapshotRef: ref,
    expectedContentHash: hash,
    actualContentHash: hash,
    byteLength: 8,
    verifiedAt: VERIFIED_AT,
    simulated: true,
  };
  // verified true + no evidence => refusal.
  const noEvidence = constructDrRestoreRecord(
    { id: "you_dr-restore_0001", snapshotRef: ref, restoredAt: VERIFIED_AT, verified: true },
    null,
  );
  assert.ok(!noEvidence.ok);
  if (!noEvidence.ok) {
    assert.equal(noEvidence.refusal.reason, "verified-without-evidence");
  }
  // verified true + mismatched evidence => refusal (the evidence cannot support the flag).
  const mismatched = constructDrRestoreRecord(
    { id: "you_dr-restore_0002", snapshotRef: ref, restoredAt: VERIFIED_AT, verified: true },
    { ...evidence, actualContentHash: tamperHash(hash) },
  );
  assert.ok(!mismatched.ok);
  if (!mismatched.ok) {
    assert.equal(mismatched.refusal.reason, "verified-without-evidence");
  }
  // verified true + evidence for a DIFFERENT snapshot => refusal.
  const wrongRef = constructDrRestoreRecord(
    { id: "you_dr-restore_0003", snapshotRef: "you_content_other00000000000", restoredAt: VERIFIED_AT, verified: true },
    evidence,
  );
  assert.ok(!wrongRef.ok);
  if (!wrongRef.ok) {
    assert.equal(wrongRef.refusal.reason, "evidence-ref-mismatch");
  }
});

test("constructDrRestoreRecord: verified false records the failed attempt; verified true freezes with evidence", () => {
  const { hash, ref } = fixtureStore();
  const failed = constructDrRestoreRecord(
    { id: "you_dr-restore_0004", snapshotRef: ref, restoredAt: VERIFIED_AT, verified: false },
    null,
  );
  assert.ok(failed.ok);
  if (failed.ok) {
    assert.equal(failed.record.verified, false);
    assert.equal(failed.record.simulated, true);
    assert.ok(Object.isFrozen(failed.record));
  }
  const evidence: DrRestoreCheckEvidence = {
    snapshotRef: ref,
    expectedContentHash: hash,
    actualContentHash: hash,
    byteLength: 8,
    verifiedAt: VERIFIED_AT,
    simulated: true,
  };
  const verified = constructDrRestoreRecord(
    { id: "you_dr-restore_0005", snapshotRef: ref, restoredAt: VERIFIED_AT, verified: true },
    evidence,
  );
  assert.ok(verified.ok);
  if (verified.ok) {
    assert.equal(verified.record.verified, true);
    assert.ok(Object.isFrozen(verified.record));
  }
});

test("constructDrRestoreRecord refuses malformed intake", () => {
  assert.equal(constructDrRestoreRecord({ id: "x", snapshotRef: "", restoredAt: "t", verified: false }, null).ok, false);
  assert.equal(constructDrRestoreRecord({ id: "x", snapshotRef: "s", restoredAt: "", verified: false }, null).ok, false);
});
