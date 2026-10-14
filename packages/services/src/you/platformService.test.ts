import assert from "node:assert/strict";
import test from "node:test";
import type { OpaqueId } from "@zcode/shared";
import { createDeterministicClock, type DeterministicClock } from "../../../shared/src/you/clock.js";
import { createFixtureEvidenceContentStore, type EvidenceContentStore } from "../../../shared/src/you/evidenceStore.js";
import { stableStringify } from "../../../shared/src/you/serialize.js";
import { createPlatformService, PlatformService } from "./platformService.js";

const SOLUTION_ID: OpaqueId = "you_w10a_service_solution01";

interface Harness {
  readonly service: PlatformService;
  readonly clock: DeterministicClock;
  readonly store: EvidenceContentStore;
}

function harness(): Harness {
  const clock = createDeterministicClock();
  const store = createFixtureEvidenceContentStore();
  const service = createPlatformService({
    workspaceIdentity: "ws-w10a-service-test",
    seed: "you-w10a-platform-service-test",
    clock,
    contentStore: store,
  });
  return { service, clock, store };
}

const SCAN_POLICY = { scope: "import:scan", windowS: 60, burst: 2, action: "deny" as const };

const IMPORT_A = {
  artifactRef: "you_content_importA_service_01",
  scanClass: "artifact-bundle",
  findings: [{ signature: "signature:metadata-stale", severity: "low" as const }],
};

const IMPORT_B = {
  artifactRef: "you_content_importB_service_01",
  scanClass: "avatar-vrm",
  findings: [{ signature: "signature:embedded-script", severity: "medium" as const }],
};

const IMPORT_D = {
  artifactRef: "you_content_importD_service_01",
  scanClass: "avatar-vrm",
  findings: [{ signature: "signature:remote-execution", severity: "high" as const }],
};

// -- rate-limit policy machinery ---------------------------------------------

test("policy registration: the head becomes active; invalid intake is a typed YOU_INVALID_STATE refusal", () => {
  const { service } = harness();
  const registered = service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY });
  assert.ok(registered.ok);
  if (registered.ok) {
    assert.equal(registered.value.policy.scope, "import:scan");
    assert.equal(registered.value.policy.simulated, true);
    assert.ok(Object.isFrozen(registered.value.policy));
  }
  const head = service.activeRateLimitPolicyOf(SOLUTION_ID, "import:scan");
  assert.ok(head.ok);
  const missing = service.activeRateLimitPolicyOf(SOLUTION_ID, "retention:enforce");
  assert.ok(!missing.ok);
  if (!missing.ok) {
    assert.equal(missing.error.code, "YOU_INVALID_STATE");
    assert.equal(missing.error.details["reason"], "no-active-policy");
  }
  for (const [patch, reason] of [
    [{ scope: "Import Scan" }, "scope-invalid"],
    [{ windowS: 0 }, "window-below-minimum"],
    [{ burst: 0 }, "burst-below-minimum"],
    [{ action: "throttle" as never }, "action-invalid"],
  ] as const) {
    const refused = service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY, ...patch });
    assert.ok(!refused.ok, reason);
    if (!refused.ok) {
      assert.equal(refused.error.code, "YOU_INVALID_STATE", reason);
      assert.equal(refused.error.details["reason"], reason, reason);
    }
  }
});

test("the never-silent law: an exceeded budget returns typed YOU_RATE_LIMIT_EXCEEDED with the action and window facts", () => {
  const { service } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY });
  const subject = "you_content_importX_service_01";
  const first = service.checkRateLimit(SOLUTION_ID, "import:scan", subject);
  assert.ok(first.ok);
  const second = service.checkRateLimit(SOLUTION_ID, "import:scan", subject);
  assert.ok(second.ok);
  const third = service.checkRateLimit(SOLUTION_ID, "import:scan", subject);
  assert.ok(!third.ok);
  if (!third.ok) {
    assert.equal(third.error.code, "YOU_RATE_LIMIT_EXCEEDED");
    assert.equal(third.error.simulated, true);
    assert.equal(third.error.details["action"], "deny");
    assert.equal(third.error.details["scope"], "import:scan");
    assert.equal(third.error.details["used"], 2);
    assert.equal(third.error.details["burst"], 2);
    assert.equal(third.error.details["reason"], "burst-exhausted");
  }
});

test("defer and shed actions surface the same typed refusal (throttling is never silent for any action class)", () => {
  for (const action of ["defer", "shed"] as const) {
    const { service } = harness();
    service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY, burst: 1, action });
    const first = service.checkRateLimit(SOLUTION_ID, "import:scan", "subject-1");
    assert.ok(first.ok, action);
    const second = service.checkRateLimit(SOLUTION_ID, "import:scan", "subject-1");
    assert.ok(!second.ok, action);
    if (!second.ok) {
      assert.equal(second.error.code, "YOU_RATE_LIMIT_EXCEEDED", action);
      assert.equal(second.error.details["action"], action, action);
    }
  }
});

test("every gate evaluation appends an immutable enforcement record (the ledger is authoritative for usage)", () => {
  const { service } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY });
  service.checkRateLimit(SOLUTION_ID, "import:scan", "s1");
  service.checkRateLimit(SOLUTION_ID, "import:scan", "s2");
  service.checkRateLimit(SOLUTION_ID, "import:scan", "s3");
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const enforcements = events.value.filter((event) => event.type === "rate-limit-enforced");
    assert.equal(enforcements.length, 3);
    assert.equal(enforcements[0]?.payload["outcome"], "allowed");
    assert.equal(enforcements[1]?.payload["outcome"], "allowed");
    assert.equal(enforcements[2]?.payload["outcome"], "exceeded");
    for (const enforcement of enforcements) {
      assert.equal(enforcement.payload["simulated"], true);
    }
  }
  // The usage head readout matches the last evaluation.
  const usage = service.rateLimitUsageOf(SOLUTION_ID);
  assert.ok(usage.ok);
  if (usage.ok) {
    assert.equal(usage.value.usage["import:scan"]?.used, 2);
  }
});

test("an unlimited scope (no policy) is allowed and records nothing", () => {
  const { service } = harness();
  const unlimited = service.checkRateLimit(SOLUTION_ID, "retention:enforce", "s1");
  assert.ok(unlimited.ok);
  if (unlimited.ok) {
    assert.equal(unlimited.value.unlimited, true);
  }
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    assert.equal(events.value.length, 0);
  }
});

test("the window rolls at windowStart + windowS and the budget resets", () => {
  const { service, clock } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY, windowS: 10, burst: 1 });
  const first = service.checkRateLimit(SOLUTION_ID, "import:scan", "s1");
  assert.ok(first.ok);
  const exhausted = service.checkRateLimit(SOLUTION_ID, "import:scan", "s1");
  assert.ok(!exhausted.ok);
  // Burn 12 ticks: well past the 10s window.
  for (let tick = 0; tick < 12; tick += 1) {
    clock.now();
  }
  const rolled = service.checkRateLimit(SOLUTION_ID, "import:scan", "s1");
  assert.ok(rolled.ok);
  if (rolled.ok) {
    assert.equal(rolled.value.unlimited, false);
  }
  const usage = service.rateLimitUsageOf(SOLUTION_ID);
  assert.ok(usage.ok);
  if (usage.ok) {
    assert.equal(usage.value.usage["import:scan"]?.used, 1);
  }
});

// -- enforcement BEFORE effect (the RATE LIMIT LAW by construction) --------

test("enforcement-before-effect: an exceeded scan NEVER runs (no verdict, no import event)", () => {
  const { service } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY });
  const scanA = service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  assert.ok(scanA.ok);
  const scanB = service.scanImport(SOLUTION_ID, { ...IMPORT_B });
  assert.ok(scanB.ok);
  const refused = service.scanImport(SOLUTION_ID, { ...IMPORT_D });
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.error.code, "YOU_RATE_LIMIT_EXCEEDED");
    assert.equal(refused.error.details["scope"], "import:scan");
  }
  // The scan never ran: no verdict, no status, no event for import D.
  assert.equal(service.importStatusOf(SOLUTION_ID, IMPORT_D.artifactRef), null);
  const verdict = service.importVerdictOf(SOLUTION_ID, IMPORT_D.artifactRef);
  assert.ok(!verdict.ok);
  if (!verdict.ok) {
    assert.equal(verdict.error.code, "YOU_IMPORT_QUARANTINED");
    assert.equal(verdict.error.details["reason"], "unscanned-import");
  }
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const importEvents = events.value.filter(
      (event) => event.type === "import-quarantined" && event.payload["artifactRef"] === IMPORT_D.artifactRef,
    );
    assert.equal(importEvents.length, 0);
  }
});

// -- the quarantine lifecycle (the IMPORT SECURITY LAW) ---------------------

test("the quarantine lifecycle: birth -> fail-closed admission -> explicit release -> admission", () => {
  const { service } = harness();
  const scanned = service.scanImport(SOLUTION_ID, { ...IMPORT_B });
  assert.ok(scanned.ok);
  if (scanned.ok) {
    assert.equal(scanned.value.verdict.verdict, "quarantined");
    assert.ok(scanned.value.verdict.quarantinedAt !== null);
  }
  assert.equal(service.importStatusOf(SOLUTION_ID, IMPORT_B.artifactRef), "quarantined");
  // Admission while quarantined: typed refusal.
  const quarantinedAdmission = service.admitImport(SOLUTION_ID, IMPORT_B.artifactRef);
  assert.ok(!quarantinedAdmission.ok);
  if (!quarantinedAdmission.ok) {
    assert.equal(quarantinedAdmission.error.code, "YOU_IMPORT_QUARANTINED");
    assert.equal(quarantinedAdmission.error.details["reason"], "import-quarantined");
  }
  // The release: an explicit immutable record.
  const release = service.releaseQuarantinedImport(SOLUTION_ID, IMPORT_B.artifactRef, {
    releasedBy: "you_user_0000000000000001",
    reason: "operator-reviewed",
  });
  assert.ok(release.ok);
  if (release.ok) {
    assert.ok(Object.isFrozen(release.value.release));
    assert.equal(release.value.release.simulated, true);
  }
  assert.equal(service.importStatusOf(SOLUTION_ID, IMPORT_B.artifactRef), "released");
  // Admission after release: the import enters evidence.
  const admitted = service.admitImport(SOLUTION_ID, IMPORT_B.artifactRef);
  assert.ok(admitted.ok);
  if (admitted.ok) {
    assert.equal(admitted.value.admissionReason, "released");
  }
  // Both lifecycle transitions ride the import-quarantined event.
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const importEvents = events.value.filter((event) => event.type === "import-quarantined");
    assert.equal(importEvents.length, 2);
    assert.equal(importEvents[0]?.payload["phase"], "quarantined");
    assert.equal(importEvents[1]?.payload["phase"], "released");
    assert.equal(importEvents[1]?.payload["releaseId"], release.ok ? release.value.release.id : "");
  }
});

test("unscanned imports never enter evidence (the admission gate is fail-closed)", () => {
  const { service } = harness();
  const unscanned = service.admitImport(SOLUTION_ID, "you_content_never_scanned_1");
  assert.ok(!unscanned.ok);
  if (!unscanned.ok) {
    assert.equal(unscanned.error.code, "YOU_IMPORT_QUARANTINED");
    assert.equal(unscanned.error.details["reason"], "unscanned-import");
  }
});

test("release exists ONLY for quarantined imports: clean, released and rejected all refuse; rejected is terminal", () => {
  const { service } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY, burst: 10 });
  service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  service.scanImport(SOLUTION_ID, { ...IMPORT_B });
  service.scanImport(SOLUTION_ID, { ...IMPORT_D });
  const releaseClean = service.releaseQuarantinedImport(SOLUTION_ID, IMPORT_A.artifactRef, {
    releasedBy: "u1",
    reason: "r",
  });
  assert.ok(!releaseClean.ok);
  if (!releaseClean.ok) {
    assert.equal(releaseClean.error.code, "YOU_IMPORT_QUARANTINED");
    assert.equal(releaseClean.error.details["reason"], "not-quarantined");
  }
  const releaseRejected = service.releaseQuarantinedImport(SOLUTION_ID, IMPORT_D.artifactRef, {
    releasedBy: "u1",
    reason: "r",
  });
  assert.ok(!releaseRejected.ok);
  if (!releaseRejected.ok) {
    assert.equal(releaseRejected.error.details["reason"], "rejected-terminal");
  }
  const admissionRejected = service.admitImport(SOLUTION_ID, IMPORT_D.artifactRef);
  assert.ok(!admissionRejected.ok);
  if (!admissionRejected.ok) {
    assert.equal(admissionRejected.error.details["reason"], "import-rejected");
  }
  const releaseUnscanned = service.releaseQuarantinedImport(SOLUTION_ID, "you_content_never_scanned_1", {
    releasedBy: "u1",
    reason: "r",
  });
  assert.ok(!releaseUnscanned.ok);
  if (!releaseUnscanned.ok) {
    assert.equal(releaseUnscanned.error.details["reason"], "unscanned-import");
  }
});

test("an artifactRef is scanned exactly once (re-scans are typed refusals)", () => {
  const { service } = harness();
  service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  const rescan = service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  assert.ok(!rescan.ok);
  if (!rescan.ok) {
    assert.equal(rescan.error.code, "YOU_INVALID_STATE");
    assert.equal(rescan.error.details["reason"], "already-scanned");
  }
});

test("clean imports admit on their scan verdict", () => {
  const { service } = harness();
  service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  const admitted = service.admitImport(SOLUTION_ID, IMPORT_A.artifactRef);
  assert.ok(admitted.ok);
  if (admitted.ok) {
    assert.equal(admitted.value.admissionReason, "scanned-clean");
    assert.equal(admitted.value.verdict.verdict, "clean");
  }
});

// -- retention enforcement (the RETENTION LAW) ------------------------------

test("retention: an active granted consent outranks the class (typed refusal); a withdrawn consent lets the pass record", () => {
  const { service } = harness();
  const protectedPass = service.enforceRetention(
    SOLUTION_ID,
    { retentionClass: "project-retention", subjectRef: "you_retention-subject_s1" },
    "granted",
  );
  assert.ok(!protectedPass.ok);
  if (!protectedPass.ok) {
    assert.equal(protectedPass.error.code, "YOU_RETENTION_ENFORCEMENT_INVALID");
    assert.equal(protectedPass.error.details["reason"], "consent-protected");
    assert.equal(protectedPass.error.details["consentState"], "granted");
  }
  const pass = service.enforceRetention(
    SOLUTION_ID,
    { retentionClass: "project-retention", subjectRef: "you_retention-subject_s2" },
    "withdrawn",
  );
  assert.ok(pass.ok);
  if (pass.ok) {
    assert.ok(Object.isFrozen(pass.value.record));
    assert.equal(pass.value.record.simulated, true);
  }
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const retentionEvents = events.value.filter((event) => event.type === "retention-enforced");
    assert.equal(retentionEvents.length, 1);
    assert.equal(retentionEvents[0]?.payload["consentState"], "withdrawn");
  }
  const passes = service.retentionPassesOf(SOLUTION_ID);
  assert.ok(passes.ok);
  if (passes.ok) {
    assert.equal(passes.value.passes.length, 1);
  }
});

test("retention intake refusals are typed YOU_RETENTION_ENFORCEMENT_INVALID", () => {
  const { service } = harness();
  const invalidClass = service.enforceRetention(
    SOLUTION_ID,
    { retentionClass: "forever", subjectRef: "s1" },
    "withdrawn",
  );
  assert.ok(!invalidClass.ok);
  if (!invalidClass.ok) {
    assert.equal(invalidClass.error.code, "YOU_RETENTION_ENFORCEMENT_INVALID");
    assert.equal(invalidClass.error.details["reason"], "retention-class-invalid");
  }
  const emptySubject = service.enforceRetention(SOLUTION_ID, { retentionClass: "tenant-retention", subjectRef: "" }, "withdrawn");
  assert.ok(!emptySubject.ok);
  if (!emptySubject.ok) {
    assert.equal(emptySubject.error.details["reason"], "subject-ref-empty");
  }
});

// -- DR restore (the DR LAW) ------------------------------------------------

test("a verified restore: content-hash check BEFORE activation, evidence rides the event", () => {
  const { service, store } = harness();
  const binding = store.put(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
  const restore = service.restoreSnapshot(SOLUTION_ID, {
    snapshotRef: binding.contentRef,
    expectedContentHash: binding.contentHash,
  });
  assert.ok(restore.ok);
  if (restore.ok) {
    assert.equal(restore.value.record.verified, true);
    assert.equal(restore.value.evidence.actualContentHash, binding.contentHash);
    assert.equal(restore.value.evidence.byteLength, 8);
  }
  const active = service.activeDrRestoreOf(SOLUTION_ID);
  assert.ok(active.ok);
  if (active.ok && restore.ok) {
    assert.equal(active.value.record?.id, restore.value.record.id);
  }
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const drEvents = events.value.filter((event) => event.type === "dr-restore-recorded");
    assert.equal(drEvents.length, 1);
    assert.equal(drEvents[0]?.payload["verified"], true);
    assert.equal(drEvents[0]?.payload["activated"], true);
    assert.equal(drEvents[0]?.payload["checkEvidencePresent"], true);
  }
});

test("an unverifiable restore (hash mismatch): recorded, refused, NEVER activated", () => {
  const { service, store } = harness();
  const binding = store.put(Uint8Array.from([9, 9, 9]));
  const tampered = binding.contentHash.startsWith("0") ? `1${binding.contentHash.slice(1)}` : `0${binding.contentHash.slice(1)}`;
  const refused = service.restoreSnapshot(SOLUTION_ID, { snapshotRef: binding.contentRef, expectedContentHash: tampered });
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.error.code, "YOU_DR_RESTORE_INVALID");
    assert.equal(refused.error.details["reason"], "hash-mismatch");
  }
  // The failed attempt IS recorded (verified: false, activated: false).
  const restores = service.drRestoresOf(SOLUTION_ID);
  assert.ok(restores.ok);
  if (restores.ok) {
    assert.equal(restores.value.restores.length, 1);
    assert.equal(restores.value.restores[0]?.verified, false);
  }
  const active = service.activeDrRestoreOf(SOLUTION_ID);
  assert.ok(active.ok);
  if (active.ok) {
    assert.equal(active.value.record, null);
  }
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    const drEvents = events.value.filter((event) => event.type === "dr-restore-recorded");
    assert.equal(drEvents.length, 1);
    assert.equal(drEvents[0]?.payload["verified"], false);
    assert.equal(drEvents[0]?.payload["activated"], false);
    assert.equal(drEvents[0]?.payload["refusalReason"], "hash-mismatch");
  }
  // A verified restore afterwards still activates (the failed attempt left no head).
  const verified = service.restoreSnapshot(SOLUTION_ID, {
    snapshotRef: binding.contentRef,
    expectedContentHash: binding.contentHash,
  });
  assert.ok(verified.ok);
  const activeAfter = service.activeDrRestoreOf(SOLUTION_ID);
  assert.ok(activeAfter.ok);
  if (activeAfter.ok && verified.ok) {
    assert.equal(activeAfter.value.record?.id, verified.value.record.id);
  }
});

test("a missing snapshot ref is a typed refusal without a record (nothing exists to audit)", () => {
  const { service } = harness();
  const refused = service.restoreSnapshot(SOLUTION_ID, {
    snapshotRef: "you_content_missing00000000000",
    expectedContentHash: "0".repeat(64),
  });
  assert.ok(!refused.ok);
  if (!refused.ok) {
    assert.equal(refused.error.code, "YOU_DR_RESTORE_INVALID");
    assert.equal(refused.error.details["reason"], "snapshot-missing");
  }
  const restores = service.drRestoresOf(SOLUTION_ID);
  assert.ok(restores.ok);
  if (restores.ok) {
    assert.equal(restores.value.restores.length, 0);
  }
  const events = service.ledgerEventsOf(SOLUTION_ID);
  assert.ok(events.ok);
  if (events.ok) {
    assert.equal(events.value.length, 0);
  }
});

test("DR lookup refusals are typed YOU_DR_RESTORE_INVALID", () => {
  const { service } = harness();
  const unknown = service.restoreOf(SOLUTION_ID, "you_dr-restore_missing0000000");
  assert.ok(!unknown.ok);
  if (!unknown.ok) {
    assert.equal(unknown.error.code, "YOU_DR_RESTORE_INVALID");
    assert.equal(unknown.error.details["reason"], "unknown-restore");
  }
});

// -- the ledger replay law ---------------------------------------------------

test("the live projection equals the ledger replay exactly (append-only state reproduction)", () => {
  const { service, store } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY });
  service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  service.scanImport(SOLUTION_ID, { ...IMPORT_B });
  service.admitImport(SOLUTION_ID, IMPORT_A.artifactRef);
  service.releaseQuarantinedImport(SOLUTION_ID, IMPORT_B.artifactRef, { releasedBy: "u1", reason: "r" });
  service.admitImport(SOLUTION_ID, IMPORT_B.artifactRef);
  service.enforceRetention(SOLUTION_ID, { retentionClass: "session-only", subjectRef: "s1" }, "expired");
  const binding = store.put(Uint8Array.from([4, 4, 4]));
  service.restoreSnapshot(SOLUTION_ID, { snapshotRef: binding.contentRef, expectedContentHash: binding.contentHash });
  const events = service.ledgerEventsOf(SOLUTION_ID);
  const live = service.projectionOf(SOLUTION_ID);
  assert.ok(events.ok);
  assert.ok(live.ok);
  if (events.ok && live.ok) {
    const replay = PlatformService.replay(events.value);
    assert.equal(stableStringify(live.value), stableStringify(replay));
    // The four wave-10 events all ride the ledger.
    const types = new Set(events.value.map((event) => event.type));
    assert.ok(types.has("rate-limit-enforced"));
    assert.ok(types.has("import-quarantined"));
    assert.ok(types.has("retention-enforced"));
    assert.ok(types.has("dr-restore-recorded"));
  }
});

test("the ledger only appends: serialized output never rewrites; the hash is stable for the same event set", () => {
  const { service } = harness();
  service.registerRateLimitPolicy(SOLUTION_ID, { ...SCAN_POLICY });
  service.scanImport(SOLUTION_ID, { ...IMPORT_A });
  const afterOne = service.serializeLedgerOf(SOLUTION_ID);
  const hashOne = service.ledgerHashOf(SOLUTION_ID);
  service.scanImport(SOLUTION_ID, { ...IMPORT_B });
  const afterTwo = service.serializeLedgerOf(SOLUTION_ID);
  const hashTwo = service.ledgerHashOf(SOLUTION_ID);
  assert.ok(afterOne.ok && afterTwo.ok && hashOne.ok && hashTwo.ok);
  if (afterOne.ok && afterTwo.ok && hashOne.ok && hashTwo.ok) {
    assert.ok(afterTwo.value.startsWith(afterOne.value.slice(0, Math.max(0, afterOne.value.length - 2))));
    assert.notEqual(hashOne.value, hashTwo.value);
    // Re-reading without appends is byte-identical.
    assert.equal(service.ledgerHashOf(SOLUTION_ID).ok && true, true);
    const hashAgain = service.ledgerHashOf(SOLUTION_ID);
    assert.ok(hashAgain.ok);
    if (hashAgain.ok) {
      assert.equal(hashAgain.value, hashTwo.value);
    }
  }
});
