// W2B logic tests — 确定性 capture demo 驱动器（node:test）。
//
// 覆盖：17 步剧本按序执行、学习门（独立学习复用许可在第 15 步才授予）、
// 预期 typed error 的诚实呈现（consent-gate / upload-corrupted / retention-expiry /
// retention-purge 步骤摘要携带 code）、事件账本覆盖 capture-session-* / evidence-* /
// consent-*、以及两条独立驱动的字节一致性重放（determinism）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedCaptureStudioController } from "./captureSimulatedController.js";
import type { CaptureStudioController } from "./captureController.js";
import {
  runCaptureDemoStep,
  CAPTURE_DEMO_STEPS,
  CAPTURE_DEMO_TOTAL_STEPS,
  type CaptureDemoStepOutcome,
} from "./captureStudioDemo.js";

async function runFullDemo(controller: CaptureStudioController): Promise<CaptureDemoStepOutcome[]> {
  const outcomes: CaptureDemoStepOutcome[] = [];
  for (const step of CAPTURE_DEMO_STEPS) {
    outcomes.push(await runCaptureDemoStep(controller, step));
  }
  return outcomes;
}

test("demo script covers the W2B capture/review/consent loop in order", () => {
  assert.equal(CAPTURE_DEMO_TOTAL_STEPS, 17);
  assert.deepEqual(
    CAPTURE_DEMO_STEPS.map((step) => step.id),
    [
      "evidence-request",
      "capture-open",
      "consent-gate",
      "consent-grant",
      "capture-step-front",
      "capture-step-quarter",
      "capture-step-motion",
      "capture-complete",
      "upload-request",
      "upload-corrupted",
      "upload-clean",
      "evidence-review",
      "review-supersede",
      "retention-expiry",
      "learning-consent",
      "consent-withdraw",
      "retention-purge",
    ],
  );
  // 每步都有标题与描述文案 id（you.capture.demo.step.*）。
  for (const step of CAPTURE_DEMO_STEPS) {
    assert.match(step.titleMessageId, /^you\.capture\.demo\.step\.[a-z-]+\.title$/);
    assert.match(step.descriptionMessageId, /^you\.capture\.demo\.step\.[a-z-]+\.description$/);
  }
});

test("full loop: sessions, evidence, reviews, consent and retention reach their golden states", async () => {
  const controller = createSimulatedCaptureStudioController();
  const outcomes = await runFullDemo(controller);
  assert.equal(outcomes.length, 17);

  const snapshot = await controller.refresh();

  // 会话：opened → gated → activated → completed（1 个引导会话）。
  const session = snapshot.captureSessions[0];
  assert.ok(session);
  assert.equal(session.status, "completed");
  assert.equal(session.guideSteps.length, 3);
  assert.equal(session.consent.policyId, snapshot.consent.policy.id);

  // 证据：3 条引导记录 + 1 条上传记录。
  assert.equal(snapshot.evidenceRecords.length, 4);
  assert.equal(snapshot.evidenceRecords.filter((record) => record.captureSessionId !== null).length, 3);
  assert.equal(snapshot.evidenceRecords.filter((record) => record.captureSessionId === null).length, 1);
  for (const record of snapshot.evidenceRecords) {
    assert.equal(record.simulated, true);
    assert.equal(record.privacyClass, "sensitive-media");
  }

  // 评审：2 条（接受 → 被取代），第一条 superseded。
  assert.equal(snapshot.reviews.length, 2);
  assert.equal(snapshot.reviews[0]?.status, "superseded");
  assert.equal(snapshot.reviews[1]?.status, "rejected");
  assert.deepEqual(snapshot.reviews[1]?.qualityObservations, {
    geometry: 0.74,
    identity: 0.63,
  });

  // 请求：第一个 fulfilled（评审接受），第二个 provided（上传）。
  assert.equal(snapshot.evidenceRequests[0]?.status, "fulfilled");
  assert.equal(snapshot.evidenceRequests[1]?.status, "provided");

  // 保留：接受后的内容已清除（purge 步骤），记录仍在。
  assert.equal(snapshot.retention.expiredEvidenceIds.length, 0);
  assert.deepEqual(snapshot.retention.purgedEvidenceIds, [snapshot.evidenceRecords[0]?.id]);
  assert.equal(snapshot.evidenceRecords.length, 4);

  // 撤回后：全部用途 withdrawn。
  for (const entry of snapshot.consent.purposeStates) {
    assert.equal(entry.state, "withdrawn");
  }

  // runtime 事件：2× evidence_requested + 1× upload_requested（损坏尝试被拒绝，
  // 槽位未消费，干净重试复用同一槽位）。
  const runtimeTypes = snapshot.runtimeEvents.map((event) => event.type);
  assert.deepEqual(runtimeTypes, [
    "evidence_requested",
    "evidence_requested",
    "upload_requested",
  ]);
  // 槽位已被干净重试消费：无遗留 pending 槽位。
  assert.equal(snapshot.pendingUploadSlots.length, 0);
});

test("honest error steps: typed errors are recorded as step outcomes, never swallowed", async () => {
  const controller = createSimulatedCaptureStudioController();
  const outcomes = await runFullDemo(controller);
  const byId = new Map(outcomes.map((outcome) => [outcome.stepId, outcome]));

  const consentGate = byId.get("consent-gate");
  assert.ok(consentGate?.summary.startsWith("YOU_CONSENT_REQUIRED: "));
  const corrupted = byId.get("upload-corrupted");
  assert.ok(corrupted?.summary.startsWith("YOU_CONTENT_HASH_MISMATCH: "));
  // 损坏被拒绝后，同槽位的干净重试成功（诚实可恢复，非静默修复）。
  const clean = byId.get("upload-clean");
  assert.ok(clean?.summary.includes("Retry of the previously corrupted slot"));
  const expiry = byId.get("retention-expiry");
  assert.ok(expiry?.summary.startsWith("YOU_RETENTION_EXPIRED: "));
  const purge = byId.get("retention-purge");
  assert.ok(purge?.summary.includes("YOU_EVIDENCE_NOT_FOUND: "));
});

test("learning gate: learning reuse stays closed until the explicit learning-consent step", async () => {
  const controller = createSimulatedCaptureStudioController();
  // 走到 retention-expiry（学习许可尚未授予）。
  for (const stepId of [
    "evidence-request",
    "capture-open",
    "consent-gate",
    "consent-grant",
    "capture-step-front",
    "capture-step-quarter",
    "capture-step-motion",
    "capture-complete",
    "upload-request",
    "upload-corrupted",
    "upload-clean",
    "evidence-review",
    "review-supersede",
    "retention-expiry",
  ]) {
    await runCaptureDemoStep(
      controller,
      CAPTURE_DEMO_STEPS.find((step) => step.id === stepId)!,
    );
  }
  const before = await controller.refresh();
  assert.equal(before.consent.learningReuse, false);
  // operational 已授予，但学习复用仍关闭（独立性）。
  assert.equal(
    before.consent.purposeStates.every((entry) => entry.state === "granted"),
    true,
  );

  await runCaptureDemoStep(
    controller,
    CAPTURE_DEMO_STEPS.find((step) => step.id === "learning-consent")!,
  );
  const after = await controller.refresh();
  assert.equal(after.consent.learningReuse, true);
});

test("demo determinism: two fresh controllers replay the loop byte-identically", async () => {
  const first = createSimulatedCaptureStudioController();
  const second = createSimulatedCaptureStudioController();
  const outcomesA = await runFullDemo(first);
  const outcomesB = await runFullDemo(second);
  // 步骤结果字节一致（golden）。
  assert.equal(JSON.stringify(outcomesA), JSON.stringify(outcomesB));
  // 快照字节一致。
  const a = await first.refresh();
  const b = await second.refresh();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
