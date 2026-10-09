// W2B logic tests — 确定性模拟控制器（node:test）。
//
// 覆盖：加载幂等、采集状态机（consent-pending→active→completed / declined / expired）、
// 同意强制矩阵（无许可 ⇒ YOU_CONSENT_REQUIRED；deny；withdraw 阻断 + 过期 active 会话；
// 学习复用独立）、评审接受/拒绝/取代、保留过期与清除（YOU_RETENTION_EXPIRED /
// YOU_EVIDENCE_NOT_FOUND）、哈希绑定（YOU_CONTENT_HASH_MISMATCH）、事件账本 append-only、
// 记录不可变与 simulated 标注、两条独立驱动的字节一致性重放（determinism）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedCaptureStudioController } from "./captureSimulatedController.js";
import { CaptureStudioError, type CaptureStudioController } from "./captureController.js";
import {
  CAPTURE_STORYBOARD_CONSENT_POLICY,
  CAPTURE_STORYBOARD_GUIDE_STEPS,
} from "./captureStoryboard.js";

const POLICY_ID = CAPTURE_STORYBOARD_CONSENT_POLICY.id;

async function loadedController(): Promise<CaptureStudioController> {
  const controller = createSimulatedCaptureStudioController();
  await controller.load({ workspaceKey: "test-workspace" });
  return controller;
}

async function openSessionWithRequest(
  controller: CaptureStudioController,
): Promise<{ requestId: string; sessionId: string }> {
  const request = await controller.requestTargetedEvidence({
    targetDeficiency: "geometry",
    reason: "test reason",
  });
  const session = await controller.openCaptureSession({ evidenceRequestId: request.id });
  return { requestId: request.id, sessionId: session.id };
}

async function grantOperationalConsent(controller: CaptureStudioController): Promise<void> {
  for (const purpose of CAPTURE_STORYBOARD_CONSENT_POLICY.purposes) {
    await controller.decideConsent({ policyId: POLICY_ID, purpose, decision: "grant" });
  }
}

function expectCaptureStudioError(error: unknown): CaptureStudioError {
  assert.ok(error instanceof CaptureStudioError, `expected CaptureStudioError, got ${String(error)}`);
  return error;
}

test("load is idempotent and bootstraps a simulated studio", async () => {
  const controller = createSimulatedCaptureStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  const second = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(second.displayName, first.displayName);
  assert.equal(first.simulated, true);
  assert.equal(first.consent.policy.id, POLICY_ID);
  // 未授予时全部用途 unknown（无许可 ⇒ 不处理）。
  for (const entry of first.consent.purposeStates) {
    assert.equal(entry.state, "unknown");
  }
  assert.equal(first.consent.learningReuse, false);
});

test("capture state machine: consent-pending -> (grant) active -> steps -> completed", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);

  let snapshot = await controller.refresh();
  let session = snapshot.captureSessions.find((candidate) => candidate.id === sessionId);
  assert.equal(session?.status, "consent-pending");

  await grantOperationalConsent(controller);
  snapshot = await controller.refresh();
  session = snapshot.captureSessions.find((candidate) => candidate.id === sessionId);
  assert.equal(session?.status, "active");

  // 逐步捕获（顺序无关；记录追加）。
  for (const guideStep of session!.guideSteps) {
    const record = await controller.captureGuideStep({ sessionId, stepId: guideStep.id });
    assert.equal(record.captureSessionId, sessionId);
    assert.equal(record.simulated, true);
    assert.equal(record.privacyClass, "sensitive-media");
    assert.ok(record.contentHash.length > 0);
  }
  const completed = await controller.completeCaptureSession(sessionId);
  assert.equal(completed.status, "completed");
  assert.notEqual(completed.completedAt, null);

  snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRecords.length, 3);
  assert.equal(snapshot.evidenceRequests[0]?.status, "provided");
  assert.equal(snapshot.captureStepBindings.length, 3);
});

test("consent enforcement: capture without consent raises YOU_CONSENT_REQUIRED", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);
  const snapshot = await controller.refresh();
  const guideStep = snapshot.captureSessions[0]!.guideSteps[0]!;

  await assert.rejects(
    () => controller.captureGuideStep({ sessionId, stepId: guideStep.id }),
    (error: unknown) => {
      const studioError = expectCaptureStudioError(error);
      assert.equal(studioError.youError.code, "YOU_CONSENT_REQUIRED");
      assert.equal(studioError.youError.simulated, true);
      return true;
    },
  );
});

test("consent enforcement: partial grant still blocks; deny blocks; upload gated too", async () => {
  const controller = await loadedController();
  const { requestId, sessionId } = await openSessionWithRequest(controller);
  await controller.decideConsent({
    policyId: POLICY_ID,
    purpose: "solution-generation",
    decision: "grant",
  });
  const snapshot = await controller.refresh();
  const guideStep = snapshot.captureSessions[0]!.guideSteps[0]!;
  await assert.rejects(
    () => controller.captureGuideStep({ sessionId, stepId: guideStep.id }),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );

  // deny 也阻断。
  await controller.decideConsent({
    policyId: POLICY_ID,
    purpose: "quality-improvement",
    decision: "deny",
  });
  await assert.rejects(
    () => controller.captureGuideStep({ sessionId, stepId: guideStep.id }),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );

  // 上传槽位同样被同意门约束。
  const artifactId = await controller.requestUploadSlot({ evidenceRequestId: requestId });
  await assert.rejects(
    () => controller.uploadFixtureContent({ artifactId }),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );
});

test("withdrawal blocks future processing and expires active sessions; provenance kept", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);
  await grantOperationalConsent(controller);
  await controller.captureGuideStep({ sessionId, stepId: "fx-guide-front" });

  await controller.withdrawConsent({ policyId: POLICY_ID });
  const snapshot = await controller.refresh();
  // active 会话被过期（阻断未来处理）。
  const session = snapshot.captureSessions.find((candidate) => candidate.id === sessionId);
  assert.equal(session?.status, "expired");
  // 全部用途 withdrawn；学习复用关闭。
  for (const entry of snapshot.consent.purposeStates) {
    assert.equal(entry.state, "withdrawn");
  }
  assert.equal(snapshot.consent.learningReuse, false);
  // 已记录证据保留（不可变历史 + 溯源）。
  assert.equal(snapshot.evidenceRecords.length, 1);
  assert.notEqual(snapshot.evidenceRecords[0]?.provenance.source, undefined);
  // 撤回后继续采集 → 拒绝（无许可 ⇒ 不处理）。
  await assert.rejects(
    () => controller.captureGuideStep({ sessionId, stepId: "fx-guide-quarter" }),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_CONSENT_REQUIRED");
      return true;
    },
  );
});

test("learning reuse is a separate permission recorded independently", async () => {
  const controller = await loadedController();
  await grantOperationalConsent(controller);
  let snapshot = await controller.refresh();
  // operational 全授予 ≠ 学习复用。
  assert.equal(snapshot.consent.learningReuse, false);
  assert.equal(snapshot.consent.reference.learningPermission, false);

  const projection = await controller.setLearningReuse({ policyId: POLICY_ID, granted: true });
  assert.equal(projection.learningReuse, true);
  snapshot = await controller.refresh();
  assert.equal(snapshot.consent.learningReuse, true);
  assert.equal(snapshot.consent.reference.learningPermission, true);

  // consent-recorded 事件按 kind=learning-reuse 单独记录。
  const learningEvents = snapshot.events.filter(
    (event) => event.type === "consent-recorded" && event.payload.kind === "learning-reuse",
  );
  assert.equal(learningEvents.length, 1);
});

test("decline path: session declined, bound request declined, terminal protected", async () => {
  const controller = await loadedController();
  const { sessionId, requestId } = await openSessionWithRequest(controller);
  const declined = await controller.declineCaptureSession(sessionId);
  assert.equal(declined.status, "declined");
  const snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRequests.find((r) => r.id === requestId)?.status, "declined");
  // terminal 状态受保护。
  await assert.rejects(
    () => controller.declineCaptureSession(sessionId),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
});

test("expire path: session expired without touching the request status", async () => {
  const controller = await loadedController();
  const { sessionId, requestId } = await openSessionWithRequest(controller);
  const expired = await controller.expireCaptureSession(sessionId);
  assert.equal(expired.status, "expired");
  const snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRequests.find((r) => r.id === requestId)?.status, "requested");
});

test("review flow: accept fulfills the request and arms delete-after-review expiry", async () => {
  const controller = await loadedController();
  const { sessionId, requestId } = await openSessionWithRequest(controller);
  await grantOperationalConsent(controller);
  // 捕获全部引导步骤后完成会话。
  for (const guideStep of CAPTURE_STORYBOARD_GUIDE_STEPS) {
    await controller.captureGuideStep({ sessionId, stepId: guideStep.id });
  }
  const record = await controller.refresh().then((snapshot) => snapshot.evidenceRecords[0]!);
  await controller.completeCaptureSession(sessionId);

  const review = await controller.reviewEvidence({
    evidenceId: record.id,
    outcome: "accepted",
    notes: "ok",
  });
  assert.equal(review.status, "accepted");
  assert.equal(review.reviewerType, "user");
  // 确定性质量观察（按缺陷类别查表）。
  assert.deepEqual(review.qualityObservations, { geometry: 0.74, identity: 0.63 });

  const snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRequests.find((r) => r.id === requestId)?.status, "fulfilled");
  assert.deepEqual(snapshot.retention.expiredEvidenceIds, [record.id]);
});

test("review supersession: re-review supersedes, never overwrites", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);
  await grantOperationalConsent(controller);
  const record = await controller.captureGuideStep({ sessionId, stepId: "fx-guide-front" });

  const first = await controller.reviewEvidence({
    evidenceId: record.id,
    outcome: "accepted",
    notes: "first",
  });
  const second = await controller.reviewEvidence({
    evidenceId: record.id,
    outcome: "rejected",
    notes: "second",
  });
  assert.notEqual(first.id, second.id);
  const snapshot = await controller.refresh();
  const firstReview = snapshot.reviews.find((review) => review.id === first.id);
  assert.equal(firstReview?.status, "superseded");
  assert.equal(second.status, "rejected");
  // 历史记录均保留（append-only，不覆写）。
  assert.equal(snapshot.reviews.length, 2);
});

test("retention: expired content raises YOU_RETENTION_EXPIRED; purge raises YOU_EVIDENCE_NOT_FOUND", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);
  await grantOperationalConsent(controller);
  const record = await controller.captureGuideStep({ sessionId, stepId: "fx-guide-front" });

  // 未评审 → 可读。
  const content = await controller.readFixtureContent(record.id);
  assert.equal(content.evidenceId, record.id);
  assert.equal(content.simulated, true);
  assert.equal(content.contentHash, record.contentHash);
  assert.equal(content.byteLength > 0, true);

  await controller.reviewEvidence({ evidenceId: record.id, outcome: "accepted", notes: "" });
  await assert.rejects(
    () => controller.readFixtureContent(record.id),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_RETENTION_EXPIRED");
      return true;
    },
  );

  await controller.applyRetentionPurge();
  await assert.rejects(
    () => controller.readFixtureContent(record.id),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_EVIDENCE_NOT_FOUND");
      return true;
    },
  );
  // 记录本体保留（不可变历史 + 溯源），仅内容不可用。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRecords.some((candidate) => candidate.id === record.id), true);
  assert.deepEqual(snapshot.retention.purgedEvidenceIds, [record.id]);
});

test("hash binding: corrupted upload is rejected with YOU_CONTENT_HASH_MISMATCH, no repair", async () => {
  const controller = await loadedController();
  const request = await controller.requestTargetedEvidence({
    targetDeficiency: "appearance",
    reason: "test",
  });
  await grantOperationalConsent(controller);
  const artifactId = await controller.requestUploadSlot({ evidenceRequestId: request.id });

  await assert.rejects(
    () => controller.uploadFixtureContent({ artifactId, corrupt: true }),
    (error: unknown) => {
      const studioError = expectCaptureStudioError(error);
      assert.equal(studioError.youError.code, "YOU_CONTENT_HASH_MISMATCH");
      assert.equal(studioError.youError.simulated, true);
      return true;
    },
  );
  // 拒绝后不留记录；槽位未消费可重试（诚实状态，非静默修复）。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.evidenceRecords.length, 0);
  assert.equal(snapshot.pendingUploadSlots.length, 1);

  const record = await controller.uploadFixtureContent({ artifactId });
  assert.equal(record.evidenceRequestId, request.id);
  assert.equal(record.captureSessionId, null);
  const after = await controller.refresh();
  assert.equal(after.pendingUploadSlots.length, 0);
  assert.equal(after.evidenceRequests[0]?.status, "provided");
});

test("runtime events: evidence_requested and upload_requested surface to the host", async () => {
  const controller = await loadedController();
  const request = await controller.requestTargetedEvidence({
    targetDeficiency: "geometry",
    reason: "test",
  });
  const artifactId = await controller.requestUploadSlot({ evidenceRequestId: request.id });
  const snapshot = await controller.refresh();
  const types = snapshot.runtimeEvents.map((event) => event.type);
  assert.deepEqual(types, ["evidence_requested", "upload_requested"]);
  const uploadEvent = snapshot.runtimeEvents.find((event) => event.type === "upload_requested");
  assert.ok(uploadEvent && uploadEvent.type === "upload_requested");
  assert.equal(uploadEvent.artifactId, artifactId);
});

test("event ledger is append-only with unique monotonic ids", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);
  await grantOperationalConsent(controller);
  for (const guideStep of CAPTURE_STORYBOARD_GUIDE_STEPS) {
    await controller.captureGuideStep({ sessionId, stepId: guideStep.id });
  }
  await controller.completeCaptureSession(sessionId);
  await controller.setLearningReuse({ policyId: POLICY_ID, granted: true });
  await controller.withdrawConsent({ policyId: POLICY_ID });

  const snapshot = await controller.refresh();
  const types = snapshot.events.map((event) => event.type);
  for (const expected of [
    "evidence-requested",
    "capture-session-opened",
    "consent-recorded",
    "evidence-recorded",
    "capture-session-completed",
    "consent-withdrawn",
  ]) {
    assert.ok(types.includes(expected as (typeof types)[number]), `missing event ${expected}`);
  }
  const ids = snapshot.events.map((event) => event.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("immutable records: simulated labels and content addressing on every record", async () => {
  const controller = await loadedController();
  const { sessionId } = await openSessionWithRequest(controller);
  await grantOperationalConsent(controller);
  const record = await controller.captureGuideStep({ sessionId, stepId: "fx-guide-front" });

  assert.equal(record.simulated, true);
  assert.equal(record.provenance.generator, "fixture");
  assert.notEqual(record.contentRef, record.id);
  assert.match(record.contentHash, /^[0-9a-f]{16}$/);
  assert.equal(record.retention.policy, "delete-after-review");
  assert.equal(record.consent.policyId, POLICY_ID);
  // 同一 (session, step, seq) 的 fixture 字节与哈希确定一致。
  const content = await controller.readFixtureContent(record.id);
  assert.equal(content.contentHash, record.contentHash);
});

test("determinism: two fresh controllers replay the same script byte-identically", async () => {
  async function scripted(): Promise<string> {
    const controller = createSimulatedCaptureStudioController();
    await controller.load({ workspaceKey: "replay" });
    const request = await controller.requestTargetedEvidence({
      targetDeficiency: "geometry",
      reason: "determinism probe",
    });
    const session = await controller.openCaptureSession({ evidenceRequestId: request.id });
    await grantOperationalConsent(controller);
    for (const guideStep of (await controller.refresh()).captureSessions[0]!.guideSteps) {
      await controller.captureGuideStep({ sessionId: session.id, stepId: guideStep.id });
    }
    await controller.completeCaptureSession(session.id);
    const record = (await controller.refresh()).evidenceRecords[0]!;
    await controller.reviewEvidence({ evidenceId: record.id, outcome: "accepted", notes: "n" });
    await controller.setLearningReuse({ policyId: POLICY_ID, granted: true });
    await controller.withdrawConsent({ policyId: POLICY_ID });
    return JSON.stringify(await controller.refresh());
  }
  const first = await scripted();
  const second = await scripted();
  assert.equal(first, second);
});

test("typed not-found errors: unknown evidence and invalid policy are truthful", async () => {
  const controller = await loadedController();
  await assert.rejects(
    () => controller.readFixtureContent("missing"),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_EVIDENCE_NOT_FOUND");
      return true;
    },
  );
  await assert.rejects(
    () => controller.decideConsent({ policyId: "nope", purpose: "learning", decision: "grant" }),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
  // 不在政策内的用途被拒绝（purpose-specific）。
  await assert.rejects(
    () => controller.decideConsent({ policyId: POLICY_ID, purpose: "arena-escalation", decision: "grant" }),
    (error: unknown) => {
      assert.equal(expectCaptureStudioError(error).youError.code, "YOU_INVALID_STATE");
      return true;
    },
  );
});
