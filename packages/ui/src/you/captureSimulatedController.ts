/* oxlint-disable eslint(max-lines) -- 模拟控制器按 CaptureStudioController 端口逐方法实现（Phase-0 剧本会话：采集状态机 + 同意强制 + 评审 + 保留 + 完整性）；T2 换绑 Worker A 的 evidence 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Capture Studio — 确定性模拟控制器（W2B，Phase 0）。
//
// 这是 `CaptureStudioController` 端口的确定性剧本实现（W2A 的 evidence/capture/consent
// 服务尚在并行 wave；本实现只到 T2 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - EvidenceRecord / EvidenceReview / CaptureSession / SolutionEvent 一律不可变、append-only
//   （CONTRACTS.md versioning：re-review supersedes，绝不原地覆写）；
// - 服务端式强制（UI 之外的硬门）：敏感等级无有效同意 ⇒ YOU_CONSENT_REQUIRED；
//   学习复用无独立许可 ⇒ YOU_CONSENT_REQUIRED；withdraw ⇒ 阻断未来处理；
// - 内容寻址：contentRef + contentHash 绑定（fixture hash，simulated: true）；
//   损坏上传 ⇒ YOU_CONTENT_HASH_MISMATCH，绝不静默修复；
// - 保留：delete-after-review 在评审接受后过期内容（YOU_RETENTION_EXPIRED）；
//   清除后任何访问 ⇒ YOU_EVIDENCE_NOT_FOUND。
// 事件语汇（frozen）：terminal 状态（declined / expired）复用 capture-session-completed
// 并以 payload.outcome 标注——W2A 真实服务落定后在 T2 对齐（见交付报告 assumptions）。
import type {
  CaptureGuideStep,
  CaptureSession,
  ConsentReference,
  ConsentState,
  EvidenceRecord,
  EvidenceRequest,
  EvidenceReview,
  OpaqueId,
  ProvenanceRecord,
  SolutionEvent,
  SolutionEventType,
  SolutionRuntimeEvent,
  YouError,
} from "@zcode/shared";
import {
  CaptureStudioError,
  evidenceTypeForModality,
  type CaptureConsentProjection,
  type CaptureFixtureContent,
  type CaptureStudioController,
  type CaptureStudioLoadRequest,
  type CaptureStudioSnapshot,
  type CaptureStepInput,
  type ConsentDecisionInput,
  type EvidenceReviewInput,
  type LearningReuseInput,
  type TargetedEvidenceInput,
  type UploadFixtureInput,
  type UploadSlotInput,
  type WithdrawConsentInput,
} from "./captureController.js";
import {
  CAPTURE_STORYBOARD_CONSENT_POLICY,
  CAPTURE_STORYBOARD_DISPLAY_NAME,
  CAPTURE_STORYBOARD_GUIDE_STEPS,
  CAPTURE_STORYBOARD_PRIVACY_CLASS,
  CAPTURE_STORYBOARD_QUALITY_OBSERVATIONS,
  buildCaptureFixtureBytes,
  captureStoryboardEvidenceRequestTemplate,
  captureStoryboardProvenance,
  computeCaptureFixtureHash,
  StoryboardClock,
} from "./captureStoryboard.js";

interface StoredFixtureContent {
  readonly evidenceId: OpaqueId;
  readonly contentRef: OpaqueId;
  readonly bytes: string;
  readonly contentHash: string;
}

interface UploadSlot {
  readonly artifactId: OpaqueId;
  readonly evidenceRequestId: OpaqueId;
}

interface SimulatedCaptureState {
  displayName: string;
  evidenceRequests: EvidenceRequest[];
  captureSessions: CaptureSession[];
  evidenceRecords: EvidenceRecord[];
  reviews: EvidenceReview[];
  stepBindings: { evidenceId: OpaqueId; captureSessionId: OpaqueId; stepId: OpaqueId }[];
  purposeStates: Map<string, ConsentState>;
  learningReuse: boolean;
  events: SolutionEvent[];
  runtimeEvents: SolutionRuntimeEvent[];
  contentStore: Map<OpaqueId, StoredFixtureContent>;
  uploadSlots: UploadSlot[];
  expiredEvidenceIds: OpaqueId[];
  purgedEvidenceIds: OpaqueId[];
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): CaptureStudioError {
  return new CaptureStudioError({
    code,
    message,
    details,
    simulated: true,
  });
}

function invalidState(message: string): CaptureStudioError {
  return youError("YOU_INVALID_STATE", message);
}

function evidenceNotFound(message: string): CaptureStudioError {
  return youError("YOU_EVIDENCE_NOT_FOUND", message);
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 captureStudioRegistry）；
 * `load` 幂等：状态存在即复用（Solution 是持久 workspace 表面，ADR-002 同语义）。
 */
export function createSimulatedCaptureStudioController(): CaptureStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let state: SimulatedCaptureState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean> = {},
  ): void => {
    if (!state) return;
    state.events = [
      ...state.events,
      {
        id: nextId("fx-cap-event"),
        solutionId: "fx-capture-studio",
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: captureStoryboardProvenance(clock),
      },
    ];
  };

  const pushRuntimeEvent = (event: SolutionRuntimeEvent): void => {
    if (!state) return;
    state.runtimeEvents = [...state.runtimeEvents, event];
  };

  const consentReference = (): ConsentReference => {
    if (!state) throw invalidState("capture studio is not loaded");
    const states = CAPTURE_STORYBOARD_CONSENT_POLICY.purposes.map(
      (purpose) => state!.purposeStates.get(purpose) ?? "unknown",
    );
    // 确定性聚合：withdrawn > denied > unknown > granted（取最保守态）。
    let aggregate: ConsentState = "granted";
    for (const candidate of states) {
      if (candidate === "withdrawn") {
        aggregate = "withdrawn";
        break;
      }
      if (candidate === "denied") {
        aggregate = "denied";
      } else if (candidate === "unknown" && aggregate === "granted") {
        aggregate = "unknown";
      }
    }
    return {
      policyId: CAPTURE_STORYBOARD_CONSENT_POLICY.id,
      state: aggregate,
      learningPermission: state.learningReuse,
    };
  };

  const consentProjection = (): CaptureConsentProjection => ({
    policy: { ...CAPTURE_STORYBOARD_CONSENT_POLICY },
    purposeStates: [...CAPTURE_STORYBOARD_CONSENT_POLICY.purposes]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((purpose) => ({
        purpose,
        state: state?.purposeStates.get(purpose) ?? "unknown",
      })),
    learningReuse: state?.learningReuse ?? false,
    reference: consentReference(),
  });

  const snapshot = (): CaptureStudioSnapshot => {
    if (!state) throw invalidState("capture studio is not loaded");
    return {
      displayName: state.displayName,
      evidenceRequests: state.evidenceRequests,
      captureSessions: state.captureSessions,
      evidenceRecords: state.evidenceRecords,
      reviews: state.reviews,
      consent: consentProjection(),
      retention: {
        expiredEvidenceIds: [...state.expiredEvidenceIds],
        purgedEvidenceIds: [...state.purgedEvidenceIds],
      },
      captureStepBindings: state.stepBindings.map((binding) => ({ ...binding })),
      pendingUploadSlots: state.uploadSlots.map((slot) => ({ ...slot })),
      events: state.events,
      runtimeEvents: state.runtimeEvents,
      simulated: true,
    };
  };

  const bootstrap = (request: CaptureStudioLoadRequest): void => {
    state = {
      displayName: CAPTURE_STORYBOARD_DISPLAY_NAME,
      evidenceRequests: [],
      captureSessions: [],
      evidenceRecords: [],
      reviews: [],
      stepBindings: [],
      purposeStates: new Map(
        CAPTURE_STORYBOARD_CONSENT_POLICY.purposes.map((purpose) => [purpose, "unknown" as ConsentState]),
      ),
      learningReuse: false,
      events: [],
      runtimeEvents: [],
      contentStore: new Map(),
      uploadSlots: [],
      expiredEvidenceIds: [],
      purgedEvidenceIds: [],
    };
    appendEvent("solution-created", "fx-capture-studio", {
      surface: "capture-studio",
      workspaceKey: request.workspaceKey,
    });
  };

  const findEvidenceRequest = (evidenceRequestId: OpaqueId): EvidenceRequest => {
    const request = state?.evidenceRequests.find(
      (candidate) => candidate.id === evidenceRequestId,
    );
    if (!request) {
      throw evidenceNotFound(`evidence request ${evidenceRequestId} not found`);
    }
    return request;
  };

  const findCaptureSession = (sessionId: OpaqueId): CaptureSession => {
    const session = state?.captureSessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      throw invalidState(`capture session ${sessionId} not found`);
    }
    return session;
  };

  const replaceCaptureSession = (next: CaptureSession): void => {
    if (!state) throw invalidState("capture studio is not loaded");
    state.captureSessions = state.captureSessions.map((candidate) =>
      candidate.id === next.id ? next : candidate,
    );
  };

  const replaceEvidenceRequest = (next: EvidenceRequest): void => {
    if (!state) throw invalidState("capture studio is not loaded");
    state.evidenceRequests = state.evidenceRequests.map((candidate) =>
      candidate.id === next.id ? next : candidate,
    );
  };

  /** 服务端式硬门：政策内全部用途必须显式 granted（无许可 ⇒ 不处理）。 */
  const assertOperationalConsent = (): void => {
    if (!state) throw invalidState("capture studio is not loaded");
    for (const purpose of CAPTURE_STORYBOARD_CONSENT_POLICY.purposes) {
      const consentState = state.purposeStates.get(purpose) ?? "unknown";
      if (consentState !== "granted") {
        throw youError("YOU_CONSENT_REQUIRED", `processing requires consent for purpose "${purpose}" (state: ${consentState})`, {
          purpose,
          consentState,
        });
      }
    }
  };

  const storeFixtureContent = (
    evidenceId: OpaqueId,
    scope: string,
  ): StoredFixtureContent => {
    if (!state) throw invalidState("capture studio is not loaded");
    const contentRef = nextId("fx-content");
    const bytes = buildCaptureFixtureBytes(scope);
    const stored: StoredFixtureContent = {
      evidenceId,
      contentRef,
      bytes,
      contentHash: computeCaptureFixtureHash(bytes),
    };
    state.contentStore.set(evidenceId, stored);
    return stored;
  };

  const recordEvidence = (input: {
    evidenceRequestId: OpaqueId | null;
    captureSessionId: OpaqueId | null;
    modality: string;
    scope: string;
    provenance: ProvenanceRecord;
  }): EvidenceRecord => {
    if (!state) throw invalidState("capture studio is not loaded");
    const evidenceId = nextId("fx-evd");
    const stored = storeFixtureContent(evidenceId, input.scope);
    const record: EvidenceRecord = {
      id: evidenceId,
      evidenceRequestId: input.evidenceRequestId,
      captureSessionId: input.captureSessionId,
      evidenceType: evidenceTypeForModality(input.modality),
      modality: input.modality,
      contentRef: stored.contentRef,
      contentHash: stored.contentHash,
      privacyClass: CAPTURE_STORYBOARD_PRIVACY_CLASS,
      retention: { ...CAPTURE_STORYBOARD_CONSENT_POLICY.retention },
      consent: consentReference(),
      capturedAt: clock.next(),
      provenance: input.provenance,
      simulated: true,
    };
    state.evidenceRecords = [...state.evidenceRecords, record];
    appendEvent("evidence-recorded", record.id, {
      simulated: true,
      privacyClass: record.privacyClass,
      evidenceRequestId: input.evidenceRequestId ?? "",
      captureSessionId: input.captureSessionId ?? "",
    });
    return record;
  };

  /** 同意授予后：consent-pending 会话按 id 稳定顺序激活。 */
  const activatePendingSessions = (): void => {
    if (!state) return;
    let operationalConsentSatisfied = true;
    for (const purpose of CAPTURE_STORYBOARD_CONSENT_POLICY.purposes) {
      if ((state.purposeStates.get(purpose) ?? "unknown") !== "granted") {
        operationalConsentSatisfied = false;
        break;
      }
    }
    if (!operationalConsentSatisfied) return;
    const pending = state.captureSessions
      .filter((session) => session.status === "consent-pending")
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const session of pending) {
      replaceCaptureSession({ ...session, status: "active" });
    }
  };

  /** 撤回后：active 会话转为 expired（阻断未来处理；记录与溯源保留）。 */
  const expireActiveSessionsOnWithdrawal = (): void => {
    if (!state) return;
    const active = state.captureSessions
      .filter((session) => session.status === "active")
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    for (const session of active) {
      const expired: CaptureSession = { ...session, status: "expired" };
      replaceCaptureSession(expired);
      appendEvent("capture-session-completed", expired.id, { outcome: "expired" });
    }
  };

  const terminateSession = (
    sessionId: OpaqueId,
    outcome: "completed" | "declined" | "expired",
    completedAt: string,
    requestStatus: EvidenceRequest["status"] | null,
  ): CaptureSession => {
    const session = findCaptureSession(sessionId);
    if (session.status === "completed" || session.status === "declined" || session.status === "expired") {
      throw invalidState(`capture session ${sessionId} is already ${session.status}`);
    }
    const next: CaptureSession = { ...session, status: outcome, completedAt };
    replaceCaptureSession(next);
    appendEvent("capture-session-completed", next.id, { outcome });
    if (requestStatus && session.evidenceRequestId) {
      const request = findEvidenceRequest(session.evidenceRequestId);
      replaceEvidenceRequest({ ...request, status: requestStatus });
    }
    return next;
  };

  const controller: CaptureStudioController = {
    backing: "fixture-simulated",

    async load(request) {
      if (!state) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh() {
      return snapshot();
    },

    async requestTargetedEvidence(input: TargetedEvidenceInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      const request: EvidenceRequest = {
        id: nextId("fx-evreq"),
        ...captureStoryboardEvidenceRequestTemplate(input.targetDeficiency, input.reason),
      };
      state.evidenceRequests = [...state.evidenceRequests, request];
      appendEvent("evidence-requested", request.id, {
        targetDeficiency: request.targetDeficiency,
      });
      pushRuntimeEvent({
        type: "evidence_requested",
        evidenceRequestId: request.id,
      });
      return request;
    },

    async openCaptureSession(input) {
      if (!state) throw invalidState("capture studio is not loaded");
      const request = findEvidenceRequest(input.evidenceRequestId);
      if (request.status !== "requested") {
        throw invalidState(
          `evidence request ${request.id} is ${request.status}, not requested`,
        );
      }
      const openForRequest = state.captureSessions.find(
        (session) =>
          session.evidenceRequestId === request.id &&
          (session.status === "consent-pending" || session.status === "active"),
      );
      if (openForRequest) {
        throw invalidState(
          `capture session ${openForRequest.id} is already open for evidence request ${request.id}`,
        );
      }
      const session: CaptureSession = {
        id: nextId("fx-capsess"),
        evidenceRequestId: request.id,
        scope: CAPTURE_STORYBOARD_CONSENT_POLICY.scope,
        guideSteps: CAPTURE_STORYBOARD_GUIDE_STEPS.map((step) => ({ ...step })),
        status: "consent-pending",
        consent: consentReference(),
        startedAt: clock.next(),
        completedAt: null,
        provenance: captureStoryboardProvenance(clock),
      };
      state.captureSessions = [...state.captureSessions, session];
      appendEvent("capture-session-opened", session.id, {
        evidenceRequestId: request.id,
        guideSteps: session.guideSteps.length,
      });
      return session;
    },

    async captureGuideStep(input: CaptureStepInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      const session = findCaptureSession(input.sessionId);
      // 服务端式强制最先：无有效同意 ⇒ 不处理（可见且可测的硬门；先于状态检查，
      // 使撤回后的拒绝原因保持「无许可」而非派生的终态）。
      assertOperationalConsent();
      if (
        session.status === "completed" ||
        session.status === "declined" ||
        session.status === "expired"
      ) {
        throw invalidState(`capture session ${input.sessionId} is ${session.status}`);
      }
      if (session.status !== "active") {
        throw invalidState(
          `capture session ${input.sessionId} is ${session.status}, not active`,
        );
      }
      const step: CaptureGuideStep | undefined = session.guideSteps.find(
        (candidate) => candidate.id === input.stepId,
      );
      if (!step) {
        throw invalidState(`guide step ${input.stepId} not found in session ${input.sessionId}`);
      }
      const record = recordEvidence({
        evidenceRequestId: session.evidenceRequestId,
        captureSessionId: session.id,
        modality: step.requiredModality ?? "image",
        scope: `${session.id}:${step.id}:${state.evidenceRecords.length + 1}`,
        provenance: captureStoryboardProvenance(clock),
      });
      state.stepBindings = [
        ...state.stepBindings,
        {
          evidenceId: record.id,
          captureSessionId: session.id,
          stepId: step.id,
        },
      ];
      return record;
    },

    async completeCaptureSession(sessionId) {
      if (!state) throw invalidState("capture studio is not loaded");
      const session = findCaptureSession(sessionId);
      if (session.status !== "active") {
        throw invalidState(`capture session ${sessionId} is ${session.status}, not active`);
      }
      const capturedStepIds = new Set(
        state.stepBindings
          .filter((binding) => binding.captureSessionId === sessionId)
          .map((binding) => binding.stepId),
      );
      const allCaptured = session.guideSteps.every((step) => capturedStepIds.has(step.id));
      if (!allCaptured) {
        throw invalidState(
          `capture session ${sessionId} has uncaptured guide steps; complete requires all steps captured`,
        );
      }
      return terminateSession(sessionId, "completed", clock.next(), "provided");
    },

    async declineCaptureSession(sessionId) {
      return terminateSession(sessionId, "declined", clock.next(), "declined");
    },

    async expireCaptureSession(sessionId) {
      return terminateSession(sessionId, "expired", clock.next(), null);
    },

    async decideConsent(input: ConsentDecisionInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      if (input.policyId !== CAPTURE_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      if (!CAPTURE_STORYBOARD_CONSENT_POLICY.purposes.includes(input.purpose)) {
        throw invalidState(
          `purpose ${input.purpose} is not part of policy ${input.policyId}`,
        );
      }
      state.purposeStates.set(input.purpose, input.decision === "grant" ? "granted" : "denied");
      appendEvent("consent-recorded", input.policyId, {
        purpose: input.purpose,
        decision: input.decision,
        kind: "operational",
      });
      activatePendingSessions();
      return consentProjection();
    },

    async setLearningReuse(input: LearningReuseInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      if (input.policyId !== CAPTURE_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      state.learningReuse = input.granted;
      appendEvent("consent-recorded", input.policyId, {
        decision: input.granted ? "grant" : "deny",
        kind: "learning-reuse",
      });
      return consentProjection();
    },

    async withdrawConsent(input: WithdrawConsentInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      if (input.policyId !== CAPTURE_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      for (const purpose of CAPTURE_STORYBOARD_CONSENT_POLICY.purposes) {
        state.purposeStates.set(purpose, "withdrawn");
      }
      state.learningReuse = false;
      appendEvent("consent-withdrawn", input.policyId, {
        purposes: CAPTURE_STORYBOARD_CONSENT_POLICY.purposes.join(","),
      });
      expireActiveSessionsOnWithdrawal();
      return consentProjection();
    },

    async reviewEvidence(input: EvidenceReviewInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      if (state.purgedEvidenceIds.includes(input.evidenceId)) {
        throw evidenceNotFound(`evidence ${input.evidenceId} not found (purged)`);
      }
      const record = state.evidenceRecords.find(
        (candidate) => candidate.id === input.evidenceId,
      );
      if (!record) {
        throw evidenceNotFound(`evidence ${input.evidenceId} not found`);
      }
      // 先前有效评审被取代（supersedes，绝不覆写）。
      const supersededIds = state.reviews
        .filter((review) => review.evidenceId === input.evidenceId && review.status !== "superseded")
        .map((review) => review.id);
      state.reviews = state.reviews.map((review) =>
        supersededIds.includes(review.id) ? { ...review, status: "superseded" } : review,
      );
      const request = record.evidenceRequestId
        ? state.evidenceRequests.find((candidate) => candidate.id === record.evidenceRequestId)
        : undefined;
      const observations =
        (request && CAPTURE_STORYBOARD_QUALITY_OBSERVATIONS[request.targetDeficiency]) ??
        {};
      const review: EvidenceReview = {
        id: nextId("fx-evrev"),
        evidenceId: record.id,
        reviewerType: "user",
        status: input.outcome,
        qualityObservations: { ...observations },
        notes: input.notes,
        reviewedAt: clock.next(),
      };
      state.reviews = [...state.reviews, review];
      appendEvent("evidence-reviewed", review.id, {
        evidenceId: record.id,
        outcome: input.outcome,
        superseded: supersededIds.join(","),
      });
      if (input.outcome === "accepted") {
        if (request && request.status === "provided") {
          replaceEvidenceRequest({ ...request, status: "fulfilled" });
        }
        // delete-after-review：接受后内容过期（记录不可变，溯源保留）。
        if (!state.expiredEvidenceIds.includes(record.id)) {
          state.expiredEvidenceIds = [...state.expiredEvidenceIds, record.id];
        }
      }
      return review;
    },

    async requestUploadSlot(input: UploadSlotInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      const request = findEvidenceRequest(input.evidenceRequestId);
      if (request.status !== "requested") {
        throw invalidState(
          `evidence request ${request.id} is ${request.status}, not requested`,
        );
      }
      const artifactId = nextId("fx-artifact");
      state.uploadSlots = [...state.uploadSlots, { artifactId, evidenceRequestId: request.id }];
      pushRuntimeEvent({
        type: "upload_requested",
        artifactId,
      });
      return artifactId;
    },

    async uploadFixtureContent(input: UploadFixtureInput) {
      if (!state) throw invalidState("capture studio is not loaded");
      const slot = state.uploadSlots.find((candidate) => candidate.artifactId === input.artifactId);
      if (!slot) {
        throw invalidState(`upload slot ${input.artifactId} not found`);
      }
      // 服务端式强制：上传同样是无许可不处理。
      assertOperationalConsent();
      const request = findEvidenceRequest(slot.evidenceRequestId);
      const evidenceId = nextId("fx-evd");
      const scope = `${slot.artifactId}:${state.evidenceRecords.length + 1}`;
      const bytes = buildCaptureFixtureBytes(scope);
      const contentHash = computeCaptureFixtureHash(bytes);
      if (input.corrupt) {
        // 确定性损坏：绑定 hash 与实际字节失配 ⇒ typed error，绝不静默修复，
        // 也不落任何存储（拒绝的 upload 不留内容）。
        throw youError(
          "YOU_CONTENT_HASH_MISMATCH",
          `uploaded content hash does not match the declared binding for artifact ${input.artifactId}; the upload was rejected (no silent repair)`,
          { artifactId: input.artifactId, declaredHash: contentHash },
        );
      }
      const contentRef = nextId("fx-content");
      state.contentStore.set(evidenceId, { evidenceId, contentRef, bytes, contentHash });
      const record: EvidenceRecord = {
        id: evidenceId,
        evidenceRequestId: request.id,
        captureSessionId: null,
        evidenceType: request.evidenceType,
        modality: "image",
        contentRef,
        contentHash,
        privacyClass: CAPTURE_STORYBOARD_PRIVACY_CLASS,
        retention: { ...CAPTURE_STORYBOARD_CONSENT_POLICY.retention },
        consent: consentReference(),
        capturedAt: clock.next(),
        provenance: captureStoryboardProvenance(clock),
        simulated: true,
      };
      state.evidenceRecords = [...state.evidenceRecords, record];
      // 上传槽位消费后移除（幂等消费语义）。
      state.uploadSlots = state.uploadSlots.filter((candidate) => candidate.artifactId !== input.artifactId);
      replaceEvidenceRequest({ ...request, status: "provided" });
      appendEvent("evidence-recorded", record.id, {
        simulated: true,
        privacyClass: record.privacyClass,
        evidenceRequestId: request.id,
        captureSessionId: "",
        via: "upload",
      });
      return record;
    },

    async readFixtureContent(evidenceId) {
      if (!state) throw invalidState("capture studio is not loaded");
      if (state.purgedEvidenceIds.includes(evidenceId)) {
        throw evidenceNotFound(`evidence ${evidenceId} not found (purged)`);
      }
      const stored = state.contentStore.get(evidenceId);
      if (!stored) {
        throw evidenceNotFound(`evidence ${evidenceId} not found`);
      }
      if (state.expiredEvidenceIds.includes(evidenceId)) {
        throw youError(
          "YOU_RETENTION_EXPIRED",
          `content for evidence ${evidenceId} expired under policy delete-after-review; the immutable record and its provenance are retained`,
          { evidenceId, policy: "delete-after-review" },
        );
      }
      const content: CaptureFixtureContent = {
        evidenceId,
        contentRef: stored.contentRef,
        byteLength: stored.bytes.length,
        preview: stored.bytes.slice(0, 48),
        contentHash: stored.contentHash,
        simulated: true,
      };
      return content;
    },

    async applyRetentionPurge() {
      if (!state) throw invalidState("capture studio is not loaded");
      const expired = [...state.expiredEvidenceIds].sort((a, b) => (a < b ? -1 : 1));
      for (const evidenceId of expired) {
        state.contentStore.delete(evidenceId);
        if (!state.purgedEvidenceIds.includes(evidenceId)) {
          state.purgedEvidenceIds = [...state.purgedEvidenceIds, evidenceId];
        }
      }
      state.expiredEvidenceIds = [];
      // 记录本体保留（不可变历史 + 溯源）；仅内容与可用性被清除。
      return snapshot();
    },
  };

  return controller;
}
