// YOU Capture Studio — 确定性 operator demo 驱动器（W2B）。
//
// 覆盖 W2B 验收的采集/评审/同意/上传闭环：
// evidence-request -> capture-open -> consent gate（诚实 typed error）-> consent-grant ->
// 引导采集（3 步，含 preferred framing）-> capture-complete -> upload-request ->
// upload（干净 + 确定性损坏的 typed error）-> evidence-review（接受）-> review-supersede ->
// retention-expiry（诚实 typed error）-> learning-consent（独立许可）-> consent-withdraw
// （阻断未来处理，溯源保留）-> retention-purge（YOU_EVIDENCE_NOT_FOUND）。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed error
// 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import { CaptureStudioError, type CaptureStudioController } from "./captureController.js";
import type { CapturePanelId } from "./captureStudioStore.js";
import {
  CAPTURE_STORYBOARD_APPEARANCE_REASON,
  CAPTURE_STORYBOARD_DEFAULT_REASON,
} from "./captureStoryboard.js";

export type CaptureDemoStepId =
  | "evidence-request"
  | "capture-open"
  | "consent-gate"
  | "consent-grant"
  | "capture-step-front"
  | "capture-step-quarter"
  | "capture-step-motion"
  | "capture-complete"
  | "upload-request"
  | "upload-clean"
  | "upload-corrupted"
  | "evidence-review"
  | "review-supersede"
  | "retention-expiry"
  | "learning-consent"
  | "consent-withdraw"
  | "retention-purge";

export interface CaptureDemoStep {
  readonly id: CaptureDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: CaptureDemoStepId): CaptureDemoStep {
  return {
    id,
    titleMessageId: `you.capture.demo.step.${id}.title`,
    descriptionMessageId: `you.capture.demo.step.${id}.description`,
  };
}

export const CAPTURE_DEMO_STEPS: readonly CaptureDemoStep[] = [
  step("evidence-request"),
  step("capture-open"),
  step("consent-gate"),
  step("consent-grant"),
  step("capture-step-front"),
  step("capture-step-quarter"),
  step("capture-step-motion"),
  step("capture-complete"),
  step("upload-request"),
  step("upload-corrupted"),
  step("upload-clean"),
  step("evidence-review"),
  step("review-supersede"),
  step("retention-expiry"),
  step("learning-consent"),
  step("consent-withdraw"),
  step("retention-purge"),
];

/** 步骤对视图状态的提示（由 useCaptureStudio 应用；驱动器不直接写 store）。 */
export interface CaptureDemoUiHint {
  readonly panel?: CapturePanelId;
  readonly activeCaptureSessionId?: string | null;
  readonly guideStepIndex?: number;
  readonly selectedEvidenceRecordId?: string | null;
}

export interface CaptureDemoStepOutcome {
  readonly stepId: CaptureDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（会话 / 证据 / 评审 / artifact 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: CaptureDemoUiHint;
}

function outcome(
  stepId: CaptureDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: CaptureDemoUiHint = {},
): CaptureDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<CaptureStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof CaptureStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed CaptureStudioError, but the operation succeeded");
}

/**
 * 执行一步剧本。控制器必须已 load（evidence-request 步骤负责 load）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runCaptureDemoStep(
  controller: CaptureStudioController,
  step: CaptureDemoStep,
): Promise<CaptureDemoStepOutcome> {
  switch (step.id) {
    case "evidence-request": {
      // 首步负责加载（与 W1B intent 步骤同款职责）。
      await controller.load({ workspaceKey: "you-w2b-capture-demo" });
      const request = await controller.requestTargetedEvidence({
        targetDeficiency: "geometry",
        reason: CAPTURE_STORYBOARD_DEFAULT_REASON,
      });
      return outcome(
        "evidence-request",
        `Targeted EvidenceRequest ${request.id} recorded (deficiency: geometry). Privacy: ${request.privacyRequirements}`,
        [request.id],
        { panel: "requests" },
      );
    }
    case "capture-open": {
      const snapshot = await controller.refresh();
      const request = snapshot.evidenceRequests.find(
        (candidate) => candidate.status === "requested",
      );
      if (!request) throw new Error("demo: requested evidence request missing");
      const session = await controller.openCaptureSession({ evidenceRequestId: request.id });
      return outcome(
        "capture-open",
        `Guided CaptureSession ${session.id} opened (status: ${session.status}; ${session.guideSteps.length} guide steps). Capture is gated on explicit consent.`,
        [session.id],
        { panel: "capture", activeCaptureSessionId: session.id, guideStepIndex: 0 },
      );
    }
    case "consent-gate": {
      const snapshot = await controller.refresh();
      const session = snapshot.captureSessions.find(
        (candidate) => candidate.status === "consent-pending",
      );
      if (!session) throw new Error("demo: consent-pending session missing");
      const guideStep = session.guideSteps[0];
      if (!guideStep) throw new Error("demo: guide step missing");
      // 预期中的 typed error：无许可 ⇒ 不处理（服务端强制，非 UI 禁用）。
      const error = await expectTypedError(() =>
        controller.captureGuideStep({ sessionId: session.id, stepId: guideStep.id }),
      );
      return outcome(
        "consent-gate",
        `${error.youError.code}: ${error.youError.message} — no permission means no processing.`,
        [session.id],
        { panel: "consent" },
      );
    }
    case "consent-grant": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      for (const purpose of policy.purposes) {
        await controller.decideConsent({
          policyId: policy.id,
          purpose,
          decision: "grant",
        });
      }
      const after = await controller.refresh();
      const active = after.captureSessions.find((candidate) => candidate.status === "active");
      return outcome(
        "consent-grant",
        `Operational consent granted per purpose (${policy.purposes.join(", ")}). CaptureSession ${active?.id ?? "none"} is now active — processing is possible only from this point.`,
        [policy.id, active?.id ?? ""],
        { panel: "capture" },
      );
    }
    case "capture-step-front": {
      return captureDemoStep(controller, "capture-step-front", "fx-guide-front");
    }
    case "capture-step-quarter": {
      return captureDemoStep(controller, "capture-step-quarter", "fx-guide-quarter");
    }
    case "capture-step-motion": {
      return captureDemoStep(controller, "capture-step-motion", "fx-guide-motion");
    }
    case "capture-complete": {
      const snapshot = await controller.refresh();
      const session = snapshot.captureSessions.find((candidate) => candidate.status === "active");
      if (!session) throw new Error("demo: active capture session missing");
      const completed = await controller.completeCaptureSession(session.id);
      return outcome(
        "capture-complete",
        `CaptureSession ${completed.id} completed at ${completed.completedAt}; the bound evidence request is now "provided".`,
        [completed.id],
        { panel: "capture" },
      );
    }
    case "upload-request": {
      const request = await controller.requestTargetedEvidence({
        targetDeficiency: "appearance",
        reason: CAPTURE_STORYBOARD_APPEARANCE_REASON,
      });
      const artifactId = await controller.requestUploadSlot({ evidenceRequestId: request.id });
      return outcome(
        "upload-request",
        `Targeted EvidenceRequest ${request.id} (deficiency: appearance) + upload slot ${artifactId}: the surface emitted an upload_requested runtime event.`,
        [request.id, artifactId],
        { panel: "upload" },
      );
    }
    case "upload-clean": {
      const snapshot = await controller.refresh();
      const artifactId = snapshot.runtimeEvents
        .filter((event) => event.type === "upload_requested")
        .map((event) => (event.type === "upload_requested" ? event.artifactId : ""))
        .at(-1);
      if (!artifactId) throw new Error("demo: upload slot missing");
      const record = await controller.uploadFixtureContent({ artifactId });
      return outcome(
        "upload-clean",
        `Retry of the previously corrupted slot ${artifactId} succeeded: EvidenceRecord ${record.id} (hash ${record.contentHash}, simulated). Hash verification passed.`,
        [record.id, artifactId],
        { panel: "upload", selectedEvidenceRecordId: record.id },
      );
    }
    case "upload-corrupted": {
      const snapshot = await controller.refresh();
      const artifactId = snapshot.runtimeEvents
        .filter((event) => event.type === "upload_requested")
        .map((event) => (event.type === "upload_requested" ? event.artifactId : ""))
        .at(-1);
      if (!artifactId) throw new Error("demo: upload slot missing");
      const error = await expectTypedError(() =>
        controller.uploadFixtureContent({ artifactId, corrupt: true }),
      );
      return outcome(
        "upload-corrupted",
        `${error.youError.code}: ${error.youError.message} The slot stays open for an honest retry.`,
        [artifactId],
        { panel: "upload" },
      );
    }
    case "evidence-review": {
      const snapshot = await controller.refresh();
      const record = snapshot.evidenceRecords[0];
      if (!record) throw new Error("demo: evidence record missing");
      const review = await controller.reviewEvidence({
        evidenceId: record.id,
        outcome: "accepted",
        notes: "Fixture framing matches the preferred guidance; observations look deterministic.",
      });
      const observations = Object.entries(review.qualityObservations)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([cls, score]) => `${cls}=${score}`)
        .join(", ");
      return outcome(
        "evidence-review",
        `EvidenceReview ${review.id}: accepted. Deterministic quality observations: ${observations}. delete-after-review armed — content expires now.`,
        [review.id, record.id],
        { panel: "review", selectedEvidenceRecordId: record.id },
      );
    }
    case "review-supersede": {
      const snapshot = await controller.refresh();
      const record = snapshot.evidenceRecords[0];
      if (!record) throw new Error("demo: evidence record missing");
      const review = await controller.reviewEvidence({
        evidenceId: record.id,
        outcome: "rejected",
        notes: "Re-review supersedes the earlier outcome; the prior review stays on the ledger as superseded.",
      });
      const after = await controller.refresh();
      const superseded = after.reviews.find(
        (candidate) => candidate.evidenceId === record.id && candidate.status === "superseded",
      );
      return outcome(
        "review-supersede",
        `Re-review ${review.id} supersedes ${superseded?.id ?? "prior"} (never overwritten); latest outcome: rejected.`,
        [review.id, superseded?.id ?? ""],
        { panel: "review" },
      );
    }
    case "retention-expiry": {
      const snapshot = await controller.refresh();
      const expiredId = snapshot.retention.expiredEvidenceIds[0];
      if (!expiredId) throw new Error("demo: expired evidence missing");
      const error = await expectTypedError(() => controller.readFixtureContent(expiredId));
      return outcome(
        "retention-expiry",
        `${error.youError.code}: ${error.youError.message}`,
        [expiredId],
        { panel: "review" },
      );
    }
    case "learning-consent": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.setLearningReuse({
        policyId: policy.id,
        granted: true,
      });
      return outcome(
        "learning-consent",
        `Separate learning-reuse permission granted (${policy.id}); it was never implied by the operational grants.`,
        [policy.id],
        { panel: "consent" },
      );
    }
    case "consent-withdraw": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.withdrawConsent({ policyId: policy.id });
      return outcome(
        "consent-withdraw",
        `Consent withdrawn (${policy.id}): future processing is blocked (any capture would raise YOU_CONSENT_REQUIRED); immutable records keep their provenance.`,
        [policy.id],
        { panel: "consent" },
      );
    }
    case "retention-purge": {
      const snapshot = await controller.refresh();
      const purgedIds = [...snapshot.retention.expiredEvidenceIds];
      await controller.applyRetentionPurge();
      const error = await expectTypedError(() =>
        controller.readFixtureContent(purgedIds[0] ?? ""),
      );
      return outcome(
        "retention-purge",
        `Retention purge removed content for ${purgedIds.length} expired record(s). ${error.youError.code}: ${error.youError.message}`,
        purgedIds,
        { panel: "review" },
      );
    }
  }
}

async function captureDemoStep(
  controller: CaptureStudioController,
  stepId: CaptureDemoStepId,
  guideStepId: string,
): Promise<CaptureDemoStepOutcome> {
  const snapshot = await controller.refresh();
  const session = snapshot.captureSessions.find((candidate) => candidate.status === "active");
  if (!session) throw new Error("demo: active capture session missing");
  const guideStep = session.guideSteps.find((candidate) => candidate.id === guideStepId);
  if (!guideStep) throw new Error(`demo: guide step ${guideStepId} missing`);
  const record = await controller.captureGuideStep({
    sessionId: session.id,
    stepId: guideStep.id,
  });
  const stepIndex = session.guideSteps.findIndex(
    (candidate) => candidate.id === guideStepId,
  );
  return outcome(
    stepId,
    `Guide step "${guideStep.id}" captured (framing: ${guideStep.preferredFraming}) → synthetic EvidenceRecord ${record.id} (hash ${record.contentHash}). No real capture device is involved.`,
    [record.id, session.id],
    {
      panel: "capture",
      activeCaptureSessionId: session.id,
      guideStepIndex: Math.max(0, stepIndex),
      selectedEvidenceRecordId: record.id,
    },
  );
}

/** 步骤总数（驱动器与 UI 共享）。 */
export const CAPTURE_DEMO_TOTAL_STEPS = CAPTURE_DEMO_STEPS.length;
