/* oxlint-disable eslint(max-lines) -- 模拟控制器按 PerformanceStudioController 端口逐方法实现（Phase-0 剧本状态机：不可变性能链 + 模板实例化 + 渲染作业生命周期 + append-only artifact 评审 + evidence-bound render 的 binding-time 同意强制）；T4 换绑 Worker A 的 performance/render 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Performance Studio — 确定性模拟控制器（W4B，Phase 0）。
//
// 这是 `PerformanceStudioController` 端口的确定性剧本实现（W4A 的 performance/render
// 服务在并行 wave 合入；本实现只到 T4 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - Performance 一律不可变（append-only 追加；发布序即稳定序）；
// - 时间线校验最先（YOU_TIMELINE_INVALID：stateless、无时钟——W4A 同语义）；
// - 渲染方法注册面校验（不支持 ⇒ YOU_RENDER_UNSUPPORTED，绝不静默回退）；
// - 作业生命周期走冻结转移表 queued → running → completed | failed（终态锁定；
//   非法迁移 typed 拒绝）；完成产出内容寻址 artifacts（每 outputKind 一件）；
// - artifact 评审 append-only（accept/reject/supersede；先前有效评审被取代——记录
//   替换，绝不原地覆写；未知 artifact ⇒ YOU_RENDER_ARTIFACT_NOT_FOUND）；
// - 服务端式强制（UI 之外的硬门）：evidence-bound render（时间线含 evidence 派生
//   payload）无有效同意 ⇒ YOU_CONSENT_REQUIRED；withdrawal 阻断后续提交；
// - 事件词汇（frozen additive wave-4）：performance-published / render-job-submitted /
//   render-job-completed / render-artifact-reviewed。
import type {
  ConsentReference,
  ConsentState,
  OpaqueId,
  Performance,
  RenderArtifact,
  RenderArtifactReview,
  RenderArtifactReviewStatus,
  RenderJobResult,
  RenderJobSpec,
  SolutionEvent,
  SolutionEventType,
  YouError,
} from "@zcode/shared";
import {
  PerformanceStudioError,
  aggregateConsentState,
  type FailRenderJobInput,
  type InstantiateTemplateInput,
  type PerformanceConsentDecisionInput,
  type PerformanceConsentProjection,
  type PerformanceStudioController,
  type PerformanceStudioLoadRequest,
  type PerformanceStudioSnapshot,
  type PerformanceWithdrawConsentInput,
  type PublishPerformanceInput,
  type RenderJobInput,
  type ReviewArtifactInput,
  type SubmitRenderJobInput,
  type TemplateInstantiationPreview,
} from "./performanceController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  PERFORMANCE_STORYBOARD_CONSENT_POLICY,
  PERFORMANCE_STORYBOARD_DISPLAY_NAME,
  PERFORMANCE_STORYBOARD_RENDER_METHODS,
  PERFORMANCE_STORYBOARD_SOLUTION_ID,
  PERFORMANCE_STORYBOARD_TEMPLATES,
  PERFORMANCE_STORYBOARD_TWIN_VERSION_ID,
  buildStoryboardRenderArtifact,
  buildStoryboardRenderResult,
  isLegalStoryboardRenderJobTransition,
  storyboardEvidenceBoundCueCount,
  storyboardPreviewDigest,
  storyboardTemplateById,
  unsupportedStoryboardRenderOutputKinds,
  validateStoryboardTimeline,
} from "./performanceStoryboard.js";

interface SimulatedJobState {
  readonly spec: RenderJobSpec;
  status: "queued" | "running" | "completed" | "failed";
  result: RenderJobResult | null;
}

interface SimulatedPerformanceState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  readonly twinVersionAnchorId: OpaqueId;
  performances: Performance[];
  jobs: SimulatedJobState[];
  reviews: RenderArtifactReview[];
  readonly purposeStates: Map<string, ConsentState>;
  events: SolutionEvent[];
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): PerformanceStudioError {
  return new PerformanceStudioError({ code, message, details, simulated: true });
}

function invalidState(message: string): PerformanceStudioError {
  return youError("YOU_INVALID_STATE", message);
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 performanceStudioRegistry）；
 * `load` 幂等：状态存在即复用（performance 平面是持久 workspace 表面）。
 */
export function createSimulatedPerformanceStudioController(): PerformanceStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let state: SimulatedPerformanceState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean>,
    generator: "agent" | "user" | "fixture" = "agent",
  ): void => {
    if (!state) return;
    state.events = [
      ...state.events,
      {
        id: nextId("fx-perf-event"),
        solutionId: PERFORMANCE_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-performance-storyboard",
          generator,
          createdAt: clock.next(),
          lineage: [],
        },
      },
    ];
  };

  const consentReference = (): ConsentReference => {
    const states = PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes.map(
      (purpose) => state?.purposeStates.get(purpose) ?? "unknown",
    );
    // 确定性保守聚合（withdrawn > denied > expired > unknown > granted）。
    return {
      policyId: PERFORMANCE_STORYBOARD_CONSENT_POLICY.id,
      state: aggregateConsentState(states),
      learningPermission: false,
    };
  };

  const consentProjection = (): PerformanceConsentProjection => ({
    policy: { ...PERFORMANCE_STORYBOARD_CONSENT_POLICY },
    purposeStates: [...PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((purpose) => ({
        purpose,
        state: state?.purposeStates.get(purpose) ?? "unknown",
      })),
    reference: consentReference(),
  });

  const snapshot = (): PerformanceStudioSnapshot => {
    if (!state) throw invalidState("performance studio is not loaded");
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      twinVersionAnchorId: state.twinVersionAnchorId,
      templates: PERFORMANCE_STORYBOARD_TEMPLATES.map((template) => ({
        ...template,
        timeline: { ...template.timeline, cues: [...template.timeline.cues] },
      })),
      performances: state.performances,
      jobs: state.jobs.map((job) => ({
        spec: job.spec,
        status: job.status,
        result: job.result,
      })),
      reviews: state.reviews,
      renderMethods: PERFORMANCE_STORYBOARD_RENDER_METHODS.map((profile) => ({
        method: profile.method,
        supportedOutputKinds: [...profile.supportedOutputKinds],
        defaultParameters: { ...profile.defaultParameters },
      })),
      consent: consentProjection(),
      events: state.events,
      simulated: true,
    };
  };

  const bootstrap = (request: PerformanceStudioLoadRequest): void => {
    state = {
      studioId: "fx-perf-studio-001",
      displayName: PERFORMANCE_STORYBOARD_DISPLAY_NAME,
      twinVersionAnchorId: PERFORMANCE_STORYBOARD_TWIN_VERSION_ID,
      performances: [],
      jobs: [],
      reviews: [],
      purposeStates: new Map(
        PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes.map((purpose) => [
          purpose,
          "unknown" as ConsentState,
        ]),
      ),
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "performance-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      twinVersionAnchorId: state.twinVersionAnchorId,
    });
  };

  /** 服务端式硬门：政策内全部用途必须显式 granted（无许可 ⇒ 不处理）。 */
  const assertRenderConsent = (): void => {
    if (!state) throw invalidState("performance studio is not loaded");
    for (const purpose of PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes) {
      const consentState = state.purposeStates.get(purpose) ?? "unknown";
      if (consentState !== "granted") {
        throw youError(
          "YOU_CONSENT_REQUIRED",
          `evidence-bound render requires consent for purpose "${purpose}" (state: ${consentState})`,
          { purpose, consentState },
        );
      }
    }
  };

  /** 时间线校验最先（stateless；违例 ⇒ YOU_TIMELINE_INVALID，绝不静默修复）。 */
  const assertTimelineValid = (
    timeline: PublishPerformanceInput["timeline"],
  ): void => {
    const violation = validateStoryboardTimeline(timeline);
    if (violation) {
      throw youError(
        "YOU_TIMELINE_INVALID",
        `invalid performance timeline: ${violation.reason}${violation.cueId ? ` (cue ${violation.cueId}${violation.track ? `, track ${violation.track}` : ""})` : ""}`,
        {
          reason: violation.reason,
          ...(violation.cueId ? { cueId: violation.cueId } : {}),
          ...(violation.track ? { track: violation.track } : {}),
        },
      );
    }
  };

  const requirePerformance = (performanceId: OpaqueId): Performance => {
    if (!state) throw invalidState("performance studio is not loaded");
    const performance = state.performances.find(
      (candidate) => candidate.id === performanceId,
    );
    if (!performance) {
      throw youError(
        "YOU_PERFORMANCE_NOT_FOUND",
        `performance ${performanceId} not found`,
        { reason: "unknown-performance", performanceId },
      );
    }
    return performance;
  };

  function requireJob(jobId: OpaqueId): SimulatedJobState {
    if (!state) throw invalidState("performance studio is not loaded");
    const job = state.jobs.find((candidate) => candidate.spec.id === jobId);
    if (!job) {
      throw invalidState(`render job ${jobId} not found`);
    }
    return job;
  }

  /** 发布不可变 Performance（append-only；journaling performance-published）。 */
  const publish = (input: {
    readonly timeline: PublishPerformanceInput["timeline"];
    readonly twinVersionId: OpaqueId;
    readonly basedOnTemplateId: OpaqueId | null;
    readonly provenanceSource: string;
  }): Performance => {
    if (!state) throw invalidState("performance studio is not loaded");
    assertTimelineValid(input.timeline);
    const performance: Performance = {
      id: nextId("fx-perf"),
      twinVersionId: input.twinVersionId,
      timeline: {
        ...input.timeline,
        cues: [...input.timeline.cues],
      },
      basedOnTemplateId: input.basedOnTemplateId,
      createdAt: clock.next(),
    };
    state.performances = [...state.performances, performance];
    appendEvent("performance-published", performance.id, {
      performanceId: performance.id,
      twinVersionId: performance.twinVersionId,
      basedOnTemplateId: performance.basedOnTemplateId ?? "none",
      cueCount: performance.timeline.cues.length,
      durationMs: performance.timeline.durationMs,
      evidenceBoundCueCount: storyboardEvidenceBoundCueCount(performance.timeline),
      provenanceSource: input.provenanceSource,
      simulated: true,
    });
    return performance;
  };

  const controller: PerformanceStudioController = {
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

    async previewTemplateInstantiation(input: InstantiateTemplateInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      const template = storyboardTemplateById(input.templateId);
      if (!template) {
        throw youError("YOU_PERFORMANCE_NOT_FOUND", `performance template ${input.templateId} not found`, {
          reason: "unknown-template",
          templateId: input.templateId,
        });
      }
      // 纯确定性预览：不分配 id、不推进时钟、不落账（digest 内容派生）。
      const preview: TemplateInstantiationPreview = {
        templateId: template.id,
        templateName: template.name,
        parameters: { ...input.parameters },
        timeline: {
          ...template.timeline,
          cues: [...template.timeline.cues],
        },
        twinVersionId: state.twinVersionAnchorId,
        previewDigest: storyboardPreviewDigest(template.id, input.parameters),
        evidenceBoundCueCount: storyboardEvidenceBoundCueCount(template.timeline),
      };
      return preview;
    },

    async publishPerformanceFromTemplate(input: InstantiateTemplateInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      const template = storyboardTemplateById(input.templateId);
      if (!template) {
        throw youError("YOU_PERFORMANCE_NOT_FOUND", `performance template ${input.templateId} not found`, {
          reason: "unknown-template",
          templateId: input.templateId,
        });
      }
      // W4A 语义：实例化时间线 = 模板时间线逐字拷贝（verbatim）。
      return publish({
        timeline: template.timeline,
        twinVersionId: state.twinVersionAnchorId,
        basedOnTemplateId: template.id,
        provenanceSource: `fixture:template:${template.id}`,
      });
    },

    async publishPerformance(input: PublishPerformanceInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      return publish({
        timeline: input.timeline,
        twinVersionId: input.twinVersionId ?? state.twinVersionAnchorId,
        basedOnTemplateId: null,
        provenanceSource: "fixture:timeline-editor",
      });
    },

    async submitRenderJob(input: SubmitRenderJobInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      const performance = requirePerformance(input.performanceId);
      if (input.outputKinds.length === 0) {
        throw youError("YOU_RENDER_UNSUPPORTED", "a render job requires at least one output kind", {
          reason: "empty-output-kinds",
        });
      }
      // 注册面校验最先：不支持 ⇒ typed error，绝不静默回退（W4A/W4C 同语义）。
      const unsupported = unsupportedStoryboardRenderOutputKinds(
        input.method,
        input.outputKinds,
      );
      if (unsupported.length > 0) {
        throw youError(
          "YOU_RENDER_UNSUPPORTED",
          `unsupported render method/output combination: method "${input.method}" does not support output kind(s): ${unsupported.join(", ")}`,
          {
            reason: "unsupported-method-output-combination",
            method: input.method,
            unsupportedKinds: unsupported.join(","),
          },
        );
      }
      // evidence-bound render 的 binding-time 同意强制（无许可 ⇒ 不处理）。
      const evidenceBoundCueCount = storyboardEvidenceBoundCueCount(
        performance.timeline,
      );
      if (evidenceBoundCueCount > 0) {
        assertRenderConsent();
      }
      const spec: RenderJobSpec = {
        id: nextId("fx-renderjob"),
        performanceId: performance.id,
        method: input.method,
        outputKinds: [...input.outputKinds].sort(),
        parameters: { ...input.parameters },
        createdAt: clock.next(),
      };
      state.jobs = [...state.jobs, { spec, status: "queued", result: null }];
      appendEvent("render-job-submitted", spec.id, {
        jobId: spec.id,
        performanceId: spec.performanceId,
        method: spec.method,
        outputKinds: [...spec.outputKinds].join(","),
        outputKindCount: spec.outputKinds.length,
        evidenceBoundCueCount,
        simulated: true,
      });
      return spec;
    },

    async startRenderJob(input: RenderJobInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      const job = requireJob(input.jobId);
      if (!isLegalStoryboardRenderJobTransition(job.status, "running")) {
        throw invalidState(`render job ${job.spec.id} is ${job.status}, not queued`);
      }
      job.status = "running";
      return snapshot();
    },

    async completeRenderJob(input: RenderJobInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      const job = requireJob(input.jobId);
      if (!isLegalStoryboardRenderJobTransition(job.status, "completed")) {
        throw invalidState(`render job ${job.spec.id} is ${job.status}, not running`);
      }
      const performance = requirePerformance(job.spec.performanceId);
      const evidenceBoundCueCount = storyboardEvidenceBoundCueCount(
        performance.timeline,
      );
      // 每个 outputKind 一件内容寻址 artifact（按 spec.outputKinds 排序序产出）。
      const artifacts: RenderArtifact[] = job.spec.outputKinds.map((kind) =>
        buildStoryboardRenderArtifact({
          id: nextId("fx-rart"),
          jobId: job.spec.id,
          kind,
          tag: `${job.spec.outputKinds.indexOf(kind) + 1}`,
          createdAt: clock.next(),
        }),
      );
      const result = buildStoryboardRenderResult({
        jobId: job.spec.id,
        status: "completed",
        artifacts,
        outputKindCount: job.spec.outputKinds.length,
        evidenceBoundCueCount,
        completedAt: clock.next(),
      });
      job.status = "completed";
      job.result = result;
      appendEvent("render-job-completed", result.jobId, {
        jobId: result.jobId,
        statusAfter: result.status,
        artifactCount: result.artifacts.length,
        evidenceBoundCueCount,
        simulated: true,
      });
      return result;
    },

    async failRenderJob(input: FailRenderJobInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      const job = requireJob(input.jobId);
      if (!isLegalStoryboardRenderJobTransition(job.status, "failed")) {
        throw invalidState(`render job ${job.spec.id} is ${job.status}, not running`);
      }
      const performance = requirePerformance(job.spec.performanceId);
      const result = buildStoryboardRenderResult({
        jobId: job.spec.id,
        status: "failed",
        artifacts: [],
        outputKindCount: job.spec.outputKinds.length,
        evidenceBoundCueCount: storyboardEvidenceBoundCueCount(
          performance.timeline,
        ),
        failureReason: input.reason,
        completedAt: clock.next(),
      });
      job.status = "failed";
      job.result = result;
      appendEvent("render-job-completed", result.jobId, {
        jobId: result.jobId,
        statusAfter: result.status,
        artifactCount: 0,
        failureReason: input.reason,
        simulated: true,
      });
      return result;
    },

    async reviewArtifact(input: ReviewArtifactInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      // lineage 查询：artifact 全集来自终态作业 result（job → artifacts）。
      const artifact = state.jobs
        .flatMap((job) => (job.result ? job.result.artifacts : []))
        .find((candidate) => candidate.id === input.artifactId);
      if (!artifact) {
        throw youError(
          "YOU_RENDER_ARTIFACT_NOT_FOUND",
          `render artifact ${input.artifactId} not found`,
          { reason: "unknown-render-artifact", artifactId: input.artifactId },
        );
      }
      // append-only：先前有效评审被取代（记录替换，绝不覆写——W2 同款纪律）。
      const supersededIds = state.reviews
        .filter(
          (review) =>
            review.artifactId === input.artifactId && review.status !== "superseded",
        )
        .map((review) => review.id);
      state.reviews = state.reviews.map((review) =>
        supersededIds.includes(review.id)
          ? { ...review, status: "superseded" }
          : review,
      );
      const status: RenderArtifactReviewStatus =
        input.decision === "accept" ? "accepted" : input.decision === "reject" ? "rejected" : "superseded";
      const review: RenderArtifactReview = {
        id: nextId("fx-rrev"),
        artifactId: artifact.id,
        status,
        reviewedAt: clock.next(),
      };
      state.reviews = [...state.reviews, review];
      appendEvent(
        "render-artifact-reviewed",
        review.id,
        {
          artifactId: artifact.id,
          jobId: artifact.jobId,
          outcome: input.decision,
          statusAfter: status,
          superseded: supersededIds.join(","),
          notes: input.notes,
          simulated: true,
        },
        "user",
      );
      return review;
    },

    async decideConsent(input: PerformanceConsentDecisionInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      if (input.policyId !== PERFORMANCE_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      if (!PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes.includes(input.purpose)) {
        throw invalidState(`purpose ${input.purpose} is not part of policy ${input.policyId}`);
      }
      state.purposeStates.set(
        input.purpose,
        input.decision === "grant" ? "granted" : "denied",
      );
      appendEvent("consent-recorded", input.policyId, {
        purpose: input.purpose,
        decision: input.decision,
        kind: "operational",
        simulated: true,
      });
      return consentProjection();
    },

    async withdrawConsent(input: PerformanceWithdrawConsentInput) {
      if (!state) throw invalidState("performance studio is not loaded");
      if (input.policyId !== PERFORMANCE_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      for (const purpose of PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes) {
        state.purposeStates.set(purpose, "withdrawn");
      }
      appendEvent("consent-withdrawn", input.policyId, {
        purposes: PERFORMANCE_STORYBOARD_CONSENT_POLICY.purposes.join(","),
        simulated: true,
      });
      return consentProjection();
    },
  };

  return controller;
}
