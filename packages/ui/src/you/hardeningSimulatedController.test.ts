// W10B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖 W10A/W10C 法则的 UI 侧镜像（W10B 验收核心）：
// - RATE LIMIT LAW：enforce BEFORE effect；append-only enforcement 记录；
//   deny/defer/shed 皆落账（绝不静默）；typed YOU_RATE_LIMIT_EXCEEDED 携 window
//   与 retry 指引；窗口滚动后重开；
// - IMPORT SECURITY LAW：未注册 intake ⇒ typed 拒绝（fail closed）；clean /
//   quarantined / rejected 三 verdict；quarantined 事件落账（clean/rejected 是
//   durable 记录——frozen 词汇披露）；仅 quarantined 可放行一次（显式 release
//   record）；
// - RETENTION LAW：granted（active consent）subject ⇒ typed 拒绝；withdrawn /
//   expired / denied ⇒ 不可变记录 + retention-enforced 事件；
// - DR LAW：corrupted ⇒ activation 前拒绝（无记录）；honest ⇒ verified 记录 +
//   dr-restore-recorded 携 checkHash；未知 snapshot ⇒ typed 拒绝；
// - ECOSYSTEM GATE（声明侧镜像）+ PRODUCTION ELIGIBILITY LAW：unknown matrix
//   ref ⇒ YOU_PROVIDER_MATRIX_INVALID；eligible 无证据 ⇒ typed 拒绝；blocked
//   免证据；reversal 是新记录（supersedes）；重复反转 ⇒ typed 拒绝；
// - 事件词汇只使用 frozen v10 类型；字节级确定性（双控制器同剧本 ⇒ 同快照）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedHardeningStudioController } from "./hardeningSimulatedController.js";
import { HardeningStudioError } from "./hardeningController.js";

async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<HardeningStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof HardeningStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a typed HardeningStudioError");
}

/** 把 policy 打到耗尽（返回 enforcement 记录 id）。 */
async function exhaust(
  controller: ReturnType<typeof createSimulatedHardeningStudioController>,
  policyId: string,
  burst: number,
): Promise<string> {
  for (let index = 0; index < burst; index += 1) {
    const attempt = await controller.enforceRateLimit({ policyId });
    assert.equal(attempt.allowed, true);
  }
  const error = await expectTypedError(() => controller.enforceRateLimit({ policyId }));
  assert.equal(error.youError.code, "YOU_RATE_LIMIT_EXCEEDED");
  return String(error.youError.details.enforcementId);
}

test("load is idempotent and the snapshot exposes the frozen taxonomies and registries", async () => {
  const controller = createSimulatedHardeningStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  const second = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(second.studioId, first.studioId);
  assert.equal(controller.backing, "fixture-simulated");
  assert.deepEqual(first.rateLimitActions, ["deny", "defer", "shed"]);
  assert.deepEqual(first.importVerdicts, ["clean", "quarantined", "rejected"]);
  assert.deepEqual(first.consentStates, [
    "unknown",
    "granted",
    "denied",
    "expired",
    "withdrawn",
  ]);
  assert.equal(first.policies.length, 3);
  assert.equal(first.scanClasses.length, 4);
  assert.equal(first.importArtifacts.length, 3);
  assert.equal(first.retentionClasses.length, 3);
  assert.equal(first.retentionSubjects.length, 4);
  assert.equal(first.drSnapshots.length, 2);
  assert.equal(first.drIntegrities.length, 2);
  assert.equal(first.matrixEntries.length, 4);
  assert.equal(first.rollbackEvidence.length, 3);
  assert.equal(first.simulated, true);
  // 注册面 eligible/consentProtected 投影。
  const granted = first.retentionSubjects.find(
    (subject) => subject.id === "subject-evidence-granted",
  )!;
  assert.equal(granted.consentProtected, true);
  const withdrawn = first.retentionSubjects.find(
    (subject) => subject.id === "subject-evidence-withdrawn",
  )!;
  assert.equal(withdrawn.consentProtected, false);
  // bootstrap 事件落账（solution-created）。
  assert.equal(first.events[0]!.type, "solution-created");
});

test("the RATE LIMIT LAW: allowed within burst leaves no record; exhaustion appends an immutable notice and never throttles silently", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  const burst = 3;
  for (let index = 0; index < burst; index += 1) {
    const attempt = await controller.enforceRateLimit({
      policyId: "policy-render-submit",
    });
    assert.equal(attempt.allowed, true);
    assert.equal(attempt.enforcementId, null);
  }
  // 放行尝试不产生 enforcement 记录/事件（放行不是 throttling）。
  let snapshot = await controller.refresh();
  assert.equal(snapshot.enforcements.length, 0);
  assert.equal(
    snapshot.events.filter((event) => event.type === "rate-limit-enforced").length,
    0,
  );
  // 第 burst+1 次：enforce BEFORE effect —— enforcement 记录 + 事件 + typed 拒绝。
  const error = await expectTypedError(() =>
    controller.enforceRateLimit({ policyId: "policy-render-submit" }),
  );
  assert.equal(error.youError.code, "YOU_RATE_LIMIT_EXCEEDED");
  assert.equal(error.youError.details.action, "deny");
  assert.equal(error.youError.details.windowS, 60);
  assert.equal(error.youError.details.retryAfterS, 60);
  assert.equal(error.youError.simulated, true);
  snapshot = await controller.refresh();
  assert.equal(snapshot.enforcements.length, 1);
  const enforcement = snapshot.enforcements[0]!;
  assert.equal(enforcement.action, "deny");
  assert.equal(enforcement.windowS, 60);
  assert.equal(enforcement.retryAfterS, 60);
  const event = snapshot.events.find((entry) => entry.type === "rate-limit-enforced")!;
  assert.equal(event.payload.enforcementId, enforcement.id);
  assert.equal(event.payload.action, "deny");
});

test("deny / defer / shed all append notices (the frozen v10 action taxonomy is fully exercised)", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  const denyId = await exhaust(controller, "policy-render-submit", 3);
  const deferId = await exhaust(controller, "policy-import-scan", 2);
  const shedId = await exhaust(controller, "policy-export-peak", 1);
  const snapshot = await controller.refresh();
  const actions = snapshot.enforcements.map((entry) => entry.action);
  assert.deepEqual(actions, ["deny", "defer", "shed"]);
  assert.equal(snapshot.enforcements.length, 3);
  assert.ok(denyId.startsWith("fx-h-enf-"));
  assert.ok(deferId.startsWith("fx-h-enf-"));
  assert.ok(shedId.startsWith("fx-h-enf-"));
  // 每条 notice 携 window 与 retry 指引（> 0——窗口内）。
  for (const enforcement of snapshot.enforcements) {
    assert.ok(enforcement.retryAfterS >= 0);
    assert.ok(enforcement.windowS > 0);
    assert.equal(enforcement.simulated, true);
  }
});

test("the rate window rolls over after windowS storyboard seconds and reopens the budget", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  // burst 1 / window 30s：第一次放行、第二次拒绝。
  const first = await controller.enforceRateLimit({ policyId: "policy-export-peak" });
  assert.equal(first.allowed, true);
  await expectTypedError(() => controller.enforceRateLimit({ policyId: "policy-export-peak" }));
  // 用其它操作推进剧本时钟（每次 quarantined scan 消耗 2 tick）。
  for (let index = 0; index < 15; index += 1) {
    await controller.scanImport({
      artifactId: "import-artifact-bundle-sig",
      scanClassId: "scan-class-package-bundle",
    });
  }
  // 窗口已滚动（≥30 tick）：预算重开。
  const reopened = await controller.enforceRateLimit({ policyId: "policy-export-peak" });
  assert.equal(reopened.allowed, true);
  // 且窗口内再次耗尽。
  const error = await expectTypedError(() =>
    controller.enforceRateLimit({ policyId: "policy-export-peak" }),
  );
  assert.equal(error.youError.code, "YOU_RATE_LIMIT_EXCEEDED");
});

test("the IMPORT SECURITY LAW: unregistered intake fails closed; clean / quarantined / rejected land as immutable verdicts", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  // 未注册 artifact ⇒ typed 拒绝（fail closed——unscanned imports never enter evidence）。
  const unknownArtifact = await expectTypedError(() =>
    controller.scanImport({
      artifactId: "import-artifact-unknown",
      scanClassId: "scan-class-media-upload",
    }),
  );
  assert.equal(unknownArtifact.youError.code, "YOU_IMPORT_QUARANTINED");
  assert.equal(unknownArtifact.youError.details.reason, "unknown-artifact");
  // 未注册 scan class ⇒ typed 拒绝。
  const unregisteredClass = await expectTypedError(() =>
    controller.scanImport({
      artifactId: "import-artifact-portrait",
      scanClassId: "scan-class-unregistered",
    }),
  );
  assert.equal(unregisteredClass.youError.code, "YOU_IMPORT_QUARANTINED");
  assert.equal(unregisteredClass.youError.details.reason, "unregistered-scan-class");
  let snapshot = await controller.refresh();
  assert.equal(snapshot.importVerdictRecords.length, 0);
  // 三 verdict 全覆盖。
  const clean = await controller.scanImport({
    artifactId: "import-artifact-portrait",
    scanClassId: "scan-class-media-upload",
  });
  const quarantined = await controller.scanImport({
    artifactId: "import-artifact-bundle-sig",
    scanClassId: "scan-class-package-bundle",
  });
  const rejected = await controller.scanImport({
    artifactId: "import-artifact-model-license",
    scanClassId: "scan-class-model-weights",
  });
  assert.equal(clean.verdict.verdict, "clean");
  assert.equal(clean.verdict.quarantinedAt, null);
  assert.equal(quarantined.verdict.verdict, "quarantined");
  assert.ok(quarantined.verdict.quarantinedAt !== null);
  assert.equal(rejected.verdict.verdict, "rejected");
  // quarantined 落 import-quarantined 事件；clean/rejected 是 durable 记录（披露）。
  snapshot = await controller.refresh();
  const importEvents = snapshot.events.filter(
    (event) => event.type === "import-quarantined",
  );
  assert.equal(importEvents.length, 1);
  assert.equal(importEvents[0]!.payload.verdictId, quarantined.verdict.id);
  assert.equal(snapshot.importVerdictRecords.length, 3);
});

test("quarantine reverses exactly once through an explicit release record", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  const clean = await controller.scanImport({
    artifactId: "import-artifact-portrait",
    scanClassId: "scan-class-media-upload",
  });
  const quarantined = await controller.scanImport({
    artifactId: "import-artifact-bundle-sig",
    scanClassId: "scan-class-package-bundle",
  });
  // 非 quarantined verdict ⇒ 放行拒绝。
  const notQuarantined = await expectTypedError(() =>
    controller.releaseQuarantinedImport({ verdictId: clean.verdict.id }),
  );
  assert.equal(notQuarantined.youError.code, "YOU_IMPORT_QUARANTINED");
  assert.equal(notQuarantined.youError.details.reason, "verdict-not-quarantined");
  // 放行 quarantined ⇒ 显式 release record（无 import-released 事件——披露）。
  const released = await controller.releaseQuarantinedImport({
    verdictId: quarantined.verdict.id,
  });
  assert.ok(released.releaseRecordId !== null);
  assert.ok(released.releasedAt !== null);
  let snapshot = await controller.refresh();
  assert.equal(snapshot.importReleases.length, 1);
  assert.equal(
    snapshot.events.filter((event) => event.type === "import-quarantined").length,
    1,
  );
  assert.equal(snapshot.importVerdictRecords.length, 2);
  // 重复放行 ⇒ typed 拒绝。
  const again = await expectTypedError(() =>
    controller.releaseQuarantinedImport({ verdictId: quarantined.verdict.id }),
  );
  assert.equal(again.youError.details.reason, "already-released");
  // 未知 verdict id ⇒ typed 拒绝。
  const unknown = await expectTypedError(() =>
    controller.releaseQuarantinedImport({ verdictId: "fx-h-verdict-999" }),
  );
  assert.equal(unknown.youError.details.reason, "unknown-verdict");
});

test("the RETENTION LAW: an active consent is never overridden by a retention class", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  const protectedRefusal = await expectTypedError(() =>
    controller.enforceRetention({
      subjectId: "subject-evidence-granted",
      retentionClassId: "retention-class-evidence-raw",
    }),
  );
  assert.equal(protectedRefusal.youError.code, "YOU_RETENTION_ENFORCEMENT_INVALID");
  assert.equal(protectedRefusal.youError.details.reason, "consent-protected-subject");
  // withdrawn / expired / denied consent ⇒ 放行（非 active）。
  const withdrawn = await controller.enforceRetention({
    subjectId: "subject-evidence-withdrawn",
    retentionClassId: "retention-class-evidence-raw",
  });
  const expired = await controller.enforceRetention({
    subjectId: "subject-evidence-expired",
    retentionClassId: "retention-class-telemetry",
  });
  const denied = await controller.enforceRetention({
    subjectId: "subject-telemetry-denied",
    retentionClassId: "retention-class-render-cache",
  });
  const snapshot = await controller.refresh();
  assert.equal(snapshot.retentionRecords.length, 3);
  assert.deepEqual(
    snapshot.retentionRecords.map((record) => record.id),
    [withdrawn.id, expired.id, denied.id].sort(),
  );
  // retention-enforced 事件落账（每条携 consentState）。
  const events = snapshot.events.filter((event) => event.type === "retention-enforced");
  assert.equal(events.length, 3);
  assert.ok(events.some((event) => event.payload.consentState === "withdrawn"));
  // 未知 subject / class ⇒ typed 拒绝。
  const unknownSubject = await expectTypedError(() =>
    controller.enforceRetention({
      subjectId: "subject-unknown",
      retentionClassId: "retention-class-evidence-raw",
    }),
  );
  assert.equal(unknownSubject.youError.details.reason, "unknown-subject");
  const unknownClass = await expectTypedError(() =>
    controller.enforceRetention({
      subjectId: "subject-evidence-withdrawn",
      retentionClassId: "retention-class-unknown",
    }),
  );
  assert.equal(unknownClass.youError.details.reason, "unknown-retention-class");
});

test("the DR LAW: hashes verify BEFORE activation; the verified flag never lacks check evidence", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  // corrupted ⇒ activation 前拒绝，无记录落账。
  const corrupted = await expectTypedError(() =>
    controller.runDrRestore({ snapshotId: "dr-snapshot-primary", integrity: "corrupted" }),
  );
  assert.equal(corrupted.youError.code, "YOU_DR_RESTORE_INVALID");
  assert.equal(corrupted.youError.details.reason, "hash-mismatch-before-activation");
  let snapshot = await controller.refresh();
  assert.equal(snapshot.drRestores.length, 0);
  assert.equal(
    snapshot.events.filter((event) => event.type === "dr-restore-recorded").length,
    0,
  );
  // honest ⇒ verified 记录 + checkHash 证据。
  const restored = await controller.runDrRestore({
    snapshotId: "dr-snapshot-primary",
    integrity: "honest",
  });
  assert.equal(restored.record.verified, true);
  assert.ok(restored.checkHash !== null);
  assert.equal(restored.verification, "verified");
  snapshot = await controller.refresh();
  assert.equal(snapshot.drRestores.length, 1);
  const event = snapshot.events.find((entry) => entry.type === "dr-restore-recorded")!;
  assert.equal(event.payload.checkHash, restored.checkHash);
  assert.equal(event.payload.verified, true);
  // 未知 snapshot ⇒ typed 拒绝。
  const unknown = await expectTypedError(() =>
    controller.runDrRestore({ snapshotId: "dr-snapshot-unknown", integrity: "honest" }),
  );
  assert.equal(unknown.youError.details.reason, "unknown-snapshot");
});

test("the ECOSYSTEM GATE mirror + PRODUCTION ELIGIBILITY LAW: matrix-gated subjects, rollback evidence, reversal as a new record", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  // unknown matrix ref ⇒ YOU_PROVIDER_MATRIX_INVALID（ECOSYSTEM GATE LAW）。
  const unknownMatrix = await expectTypedError(() =>
    controller.decideEligibility({
      matrixEntryId: "matrix-unknown-legacy",
      rollbackEvidenceId: "rollback-drill-render-eu",
      eligible: true,
    }),
  );
  assert.equal(unknownMatrix.youError.code, "YOU_PROVIDER_MATRIX_INVALID");
  assert.equal(unknownMatrix.youError.details.reason, "unknown-provider-matrix-ref");
  // eligible 无真实证据 ⇒ typed 拒绝。
  const noRollback = await expectTypedError(() =>
    controller.decideEligibility({
      matrixEntryId: "matrix-render-eu",
      rollbackEvidenceId: "rollback-evidence-none",
      eligible: true,
    }),
  );
  assert.equal(noRollback.youError.code, "YOU_PRODUCTION_ELIGIBILITY_INVALID");
  assert.equal(noRollback.youError.details.reason, "missing-rollback-evidence");
  // 未知证据预设 ⇒ typed 拒绝。
  const unknownEvidence = await expectTypedError(() =>
    controller.decideEligibility({
      matrixEntryId: "matrix-render-eu",
      rollbackEvidenceId: "rollback-unknown",
      eligible: true,
    }),
  );
  assert.equal(unknownEvidence.youError.details.reason, "unknown-rollback-evidence");
  // blocked 免证据（无可回滚之物）。
  const blocked = await controller.decideEligibility({
    matrixEntryId: "matrix-render-audit",
    rollbackEvidenceId: "rollback-evidence-none",
    eligible: false,
  });
  assert.equal(blocked.record.eligible, false);
  // eligible 携真实证据 ⇒ 落账。
  const eligible = await controller.decideEligibility({
    matrixEntryId: "matrix-render-eu",
    rollbackEvidenceId: "rollback-drill-render-eu",
    eligible: true,
  });
  assert.equal(eligible.record.eligible, true);
  assert.ok(eligible.record.rollbackEvidenceRef.startsWith("fx-content-"));
  // reversal 是新记录（supersedes 链接；原记录不可变）。
  const reversal = await controller.reverseEligibility({
    recordId: eligible.record.id,
  });
  assert.equal(reversal.kind, "reversal");
  assert.equal(reversal.supersedesRecordId, eligible.record.id);
  assert.equal(reversal.record.eligible, false);
  assert.notEqual(reversal.record.id, eligible.record.id);
  const snapshot = await controller.refresh();
  assert.equal(snapshot.eligibilityLedger.length, 3);
  const events = snapshot.events.filter(
    (event) => event.type === "production-eligibility-decided",
  );
  assert.equal(events.length, 3);
  assert.equal(events[2]!.payload.kind, "reversal");
  assert.equal(events[2]!.payload.supersedes, eligible.record.id);
  // 重复反转 ⇒ typed 拒绝；未知记录 ⇒ typed 拒绝。
  const reversedAgain = await expectTypedError(() =>
    controller.reverseEligibility({ recordId: eligible.record.id }),
  );
  assert.equal(reversedAgain.youError.details.reason, "already-reversed");
  const unknownRecord = await expectTypedError(() =>
    controller.reverseEligibility({ recordId: "fx-h-eligibility-999" }),
  );
  assert.equal(unknownRecord.youError.details.reason, "unknown-eligibility-record");
});

test("the event vocabulary stays within the frozen v10 hardening types", async () => {
  const controller = createSimulatedHardeningStudioController();
  await controller.load({ workspaceKey: "ws-a" });
  await exhaust(controller, "policy-render-submit", 3);
  await controller.scanImport({
    artifactId: "import-artifact-bundle-sig",
    scanClassId: "scan-class-package-bundle",
  });
  await controller.enforceRetention({
    subjectId: "subject-evidence-withdrawn",
    retentionClassId: "retention-class-telemetry",
  });
  await controller.runDrRestore({ snapshotId: "dr-snapshot-primary", integrity: "honest" });
  await controller.decideEligibility({
    matrixEntryId: "matrix-render-eu",
    rollbackEvidenceId: "rollback-drill-render-eu",
    eligible: true,
  });
  const snapshot = await controller.refresh();
  const used = new Set(snapshot.events.map((event) => event.type));
  const allowed = new Set([
    "solution-created",
    "rate-limit-enforced",
    "import-quarantined",
    "retention-enforced",
    "dr-restore-recorded",
    "production-eligibility-decided",
  ]);
  for (const type of used) {
    assert.ok(allowed.has(type), `unexpected event type ${type}`);
  }
});

test("byte-identical determinism: two controllers driven by the same script yield identical snapshots", async () => {
  async function drive(): Promise<string> {
    const controller = createSimulatedHardeningStudioController();
    await controller.load({ workspaceKey: "ws-determinism" });
    await controller.enforceRateLimit({ policyId: "policy-render-submit" });
    await controller.enforceRateLimit({ policyId: "policy-render-submit" });
    await controller.enforceRateLimit({ policyId: "policy-export-peak" });
    await expectTypedError(() =>
      controller.enforceRateLimit({ policyId: "policy-export-peak" }),
    );
    await controller.scanImport({
      artifactId: "import-artifact-bundle-sig",
      scanClassId: "scan-class-package-bundle",
    });
    await controller.enforceRetention({
      subjectId: "subject-evidence-withdrawn",
      retentionClassId: "retention-class-evidence-raw",
    });
    await controller.runDrRestore({
      snapshotId: "dr-snapshot-secondary",
      integrity: "honest",
    });
    await controller.decideEligibility({
      matrixEntryId: "matrix-telepresence-us",
      rollbackEvidenceId: "rollback-drill-telepresence",
      eligible: true,
    });
    const snapshot = await controller.refresh();
    return JSON.stringify(snapshot);
  }
  const first = await drive();
  const second = await drive();
  assert.equal(first, second);
});
