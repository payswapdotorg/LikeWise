// W2B logic tests — 视图纯投影（node:test，无 DOM）。
//
// 覆盖验收项：同意状态投影（「无许可 ⇒ 不处理」可见：unknown/denied/withdrawn 均
// 阻断；学习复用独立；operational 门聚合）、采集进度投影、键盘转移表
// （与 Solution 视口同级的键盘可用性）、夹紧与保留显示态。
import assert from "node:assert/strict";
import test from "node:test";
import type { CaptureSession } from "@zcode/shared";
import {
  projectConsentProcessingGate,
  projectLearningReuseGate,
  projectOperationalProcessingGate,
  type CaptureConsentProjection,
  type CaptureStepBinding,
} from "./captureController.js";
import {
  clampGuideStepIndex,
  projectCaptureProgress,
  projectEvidenceAvailability,
  resolveCaptureGuideKeyboardTransition,
} from "./captureStudioProjection.js";
import { CAPTURE_STORYBOARD_GUIDE_STEPS, CAPTURE_STORYBOARD_CONSENT_POLICY } from "./captureStoryboard.js";

function consentFixture(options: {
  purposes?: Record<string, "unknown" | "granted" | "denied" | "withdrawn">;
  learningReuse?: boolean;
}): CaptureConsentProjection {
  const purposes = options.purposes ?? {};
  return {
    policy: { ...CAPTURE_STORYBOARD_CONSENT_POLICY },
    purposeStates: CAPTURE_STORYBOARD_CONSENT_POLICY.purposes.map((purpose) => ({
      purpose,
      state: purposes[purpose] ?? "unknown",
    })),
    learningReuse: options.learningReuse ?? false,
    reference: {
      policyId: CAPTURE_STORYBOARD_CONSENT_POLICY.id,
      state: "unknown",
      learningPermission: options.learningReuse ?? false,
    },
  };
}

test("consent gate: no permission means no processing (unknown state blocks)", () => {
  const consent = consentFixture({});
  for (const purpose of CAPTURE_STORYBOARD_CONSENT_POLICY.purposes) {
    const gate = projectConsentProcessingGate(consent, purpose);
    assert.equal(gate.allowed, false, `${purpose} should be blocked`);
    assert.equal(gate.state, "unknown");
    assert.equal(gate.reason, "unknown");
  }
  const operational = projectOperationalProcessingGate(consent);
  assert.equal(operational.allowed, false);
  assert.equal(operational.reason, "unknown");
});

test("consent gate: explicit grant per purpose enables only that purpose", () => {
  const consent = consentFixture({ purposes: { "solution-generation": "granted" } });
  const granted = projectConsentProcessingGate(consent, "solution-generation");
  assert.equal(granted.allowed, true);
  assert.equal(granted.reason, "granted");
  // 另一用途仍未授予 ⇒ operational 聚合门保持关闭。
  const other = projectConsentProcessingGate(consent, "quality-improvement");
  assert.equal(other.allowed, false);
  assert.equal(projectOperationalProcessingGate(consent).allowed, false);
});

test("consent gate: denied and withdrawn block processing with truthful reasons", () => {
  const denied = consentFixture({ purposes: { "solution-generation": "denied" } });
  const deniedGate = projectConsentProcessingGate(denied, "solution-generation");
  assert.equal(deniedGate.allowed, false);
  assert.equal(deniedGate.reason, "denied");

  const withdrawn = consentFixture({ purposes: { "solution-generation": "withdrawn" } });
  const withdrawnGate = projectConsentProcessingGate(withdrawn, "solution-generation");
  assert.equal(withdrawnGate.allowed, false);
  assert.equal(withdrawnGate.reason, "withdrawn");
});

test("consent gate: all purposes granted opens the operational gate", () => {
  const consent = consentFixture({
    purposes: {
      "solution-generation": "granted",
      "quality-improvement": "granted",
    },
  });
  const gate = projectOperationalProcessingGate(consent);
  assert.equal(gate.allowed, true);
  assert.equal(gate.reason, "granted");
});

test("learning reuse gate is separate and never implied by operational grants", () => {
  const operationalOnly = consentFixture({
    purposes: {
      "solution-generation": "granted",
      "quality-improvement": "granted",
    },
    learningReuse: false,
  });
  const blocked = projectLearningReuseGate(operationalOnly);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.purpose, "learning-reuse");
  // operational 门开 ≠ 学习复用门开。
  assert.equal(projectOperationalProcessingGate(operationalOnly).allowed, true);

  const withLearning = consentFixture({
    purposes: {
      "solution-generation": "granted",
      "quality-improvement": "granted",
    },
    learningReuse: true,
  });
  assert.equal(projectLearningReuseGate(withLearning).allowed, true);

  // 学习复用单独授予，operational 仍关闭（独立性双向成立）。
  const learningOnly = consentFixture({ learningReuse: true });
  assert.equal(projectLearningReuseGate(learningOnly).allowed, true);
  assert.equal(projectOperationalProcessingGate(learningOnly).allowed, false);
});

function sessionFixture(): CaptureSession {
  return {
    id: "fx-capsess-001",
    evidenceRequestId: "fx-evreq-001",
    scope: "USER",
    guideSteps: CAPTURE_STORYBOARD_GUIDE_STEPS.map((step) => ({ ...step })),
    status: "active",
    consent: {
      policyId: CAPTURE_STORYBOARD_CONSENT_POLICY.id,
      state: "granted",
      learningPermission: false,
    },
    startedAt: "2025-06-02T09:00:10.000Z",
    completedAt: null,
    provenance: {
      source: "you-phase0-capture-storyboard",
      generator: "fixture",
      createdAt: "2025-06-02T09:00:10.000Z",
      lineage: [],
    },
  };
}

test("capture progress: empty bindings mean zero progress and not complete", () => {
  const session = sessionFixture();
  const progress = projectCaptureProgress(session, []);
  assert.equal(progress.totalSteps, 3);
  assert.equal(progress.capturedSteps, 0);
  assert.deepEqual(progress.capturedStepIds, []);
  assert.equal(progress.complete, false);
});

test("capture progress: per-step bindings accumulate; complete only when all steps captured", () => {
  const session = sessionFixture();
  const bindings: CaptureStepBinding[] = [
    { evidenceId: "fx-evd-001", captureSessionId: session.id, stepId: "fx-guide-front" },
    { evidenceId: "fx-evd-002", captureSessionId: session.id, stepId: "fx-guide-motion" },
    // 其它会话的绑定不计数。
    { evidenceId: "fx-evd-003", captureSessionId: "fx-capsess-999", stepId: "fx-guide-quarter" },
  ];
  const progress = projectCaptureProgress(session, bindings);
  assert.equal(progress.capturedSteps, 2);
  assert.deepEqual(progress.capturedStepIds, ["fx-guide-front", "fx-guide-motion"]);
  assert.equal(progress.complete, false);

  const all: CaptureStepBinding[] = [
    ...bindings,
    { evidenceId: "fx-evd-004", captureSessionId: session.id, stepId: "fx-guide-quarter" },
  ];
  const complete = projectCaptureProgress(session, all);
  assert.equal(complete.capturedSteps, 3);
  assert.equal(complete.complete, true);
});

test("guide keyboard transitions: arrows/home/end move, enter captures only when active", () => {
  const active = { sessionActive: true, totalSteps: 3 };
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("ArrowUp", active), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("ArrowLeft", active), {
    kind: "move",
    delta: -1,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("ArrowDown", active), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("ArrowRight", active), {
    kind: "move",
    delta: 1,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("Home", active), {
    kind: "move",
    delta: -3,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("End", active), {
    kind: "move",
    delta: 3,
  });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("Enter", active), {
    kind: "capture",
  });

  // 非激活会话（consent-pending/completed…）：Enter 是 no-op（诚实禁用）。
  const inactive = { sessionActive: false, totalSteps: 3 };
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("Enter", inactive), {
    kind: "none",
  });
  // 无关按键 no-op。
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("a", active), { kind: "none" });
  assert.deepEqual(resolveCaptureGuideKeyboardTransition("Escape", active), { kind: "none" });
});

test("guide step index clamps to [0, total-1] and degrades to 0 for empty sessions", () => {
  assert.equal(clampGuideStepIndex(2, 3), 2);
  assert.equal(clampGuideStepIndex(7, 3), 2);
  assert.equal(clampGuideStepIndex(-4, 3), 0);
  assert.equal(clampGuideStepIndex(0, 0), 0);
  assert.equal(clampGuideStepIndex(5, 0), 0);
});

test("evidence availability projection: available -> expired -> purged precedence", () => {
  const retention = {
    expiredEvidenceIds: ["fx-evd-001"],
    purgedEvidenceIds: ["fx-evd-002", "fx-evd-001"],
  };
  // purged 优先于 expired（清除即彻底不可用）。
  assert.equal(projectEvidenceAvailability("fx-evd-001", retention), "purged");
  assert.equal(projectEvidenceAvailability("fx-evd-002", retention), "purged");
  assert.equal(projectEvidenceAvailability("fx-evd-003", retention), "available");
  const expiredOnly = {
    expiredEvidenceIds: ["fx-evd-001"],
    purgedEvidenceIds: [] as string[],
  };
  assert.equal(projectEvidenceAvailability("fx-evd-001", expiredOnly), "expired");
});
