// YOU Performance Studio — 确定性 operator demo 驱动器（W4B）。
//
// 覆盖 W4B 验收的完整 W4 箭头（W4A fixture 场景的 UI 侧镜像）：
// template-pick（模板挑选 + 参数确定性预览）-> performance-publish（模板实例化发布：
// timeline 逐字拷贝）-> timeline-inspect（轨道分类学/时长/内容寻址 payload 检视）->
// timeline-edit（确定性草稿编辑 -> 发布新不可变性能）-> timeline-invalid（重叠草稿 ⇒
// 诚实 YOU_TIMELINE_INVALID）-> render-consent-gate（evidence-bound render 无许可 ⇒
// 诚实 YOU_CONSENT_REQUIRED）-> consent-grant -> render-submit / render-run /
// render-complete（image-render：每 outputKind 一件内容寻址 artifact + 诚实
// not-measured effort 观察）-> render-submit-2 / render-complete-2（合成时间线上的
// 3d-render 双产物作业）-> artifact-accept（接受作业 1 静帧）-> artifact-reject
// （拒绝作业 2 mesh）-> artifact-supersede（先前已接受静帧被更优产物取代——
// append-only 链接，绝不覆写）-> render-fail（诚实失败终态 + failureReason）->
// render-unsupported（未注册组合 ⇒ YOU_RENDER_UNSUPPORTED）-> consent-withdraw
// （撤回阻断后续 evidence-bound render）。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed error
// 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  PerformanceStudioError,
  type PerformanceStudioController,
} from "./performanceController.js";
import type { PerformanceDemoStep, PerformanceDemoStepId } from "./performanceStudioDemoSteps.js";
export {
  PERFORMANCE_DEMO_STEPS,
  PERFORMANCE_DEMO_TOTAL_STEPS,
  type PerformanceDemoStep,
  type PerformanceDemoStepId,
} from "./performanceStudioDemoSteps.js";
import type { PerformancePanelId } from "./performanceStudioStore.js";
import type { Performance } from "@zcode/shared";
import {
  addDraftCue,
  createTimelineDraft,
  draftToTimeline,
  setDraftCueEnd,
} from "./performanceTimelineDraftModel.js";


/** 步骤对视图状态的提示（由 usePerformanceStudio 应用；驱动器不直接写 store）。 */
export interface PerformanceDemoUiHint {
  readonly panel?: PerformancePanelId;
  readonly selectedPerformanceId?: string | null;
  readonly selectedTemplateId?: string | null;
  readonly selectedJobId?: string | null;
  readonly selectedArtifactId?: string | null;
}

export interface PerformanceDemoStepOutcome {
  readonly stepId: PerformanceDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（性能 / 作业 / artifact 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: PerformanceDemoUiHint;
}

function outcome(
  stepId: PerformanceDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: PerformanceDemoUiHint = {},
): PerformanceDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<PerformanceStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof PerformanceStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed PerformanceStudioError, but the operation succeeded");
}

function latestPerformanceOf(snapshot: {
  readonly performances: readonly Performance[];
}): Performance {
  const performance = snapshot.performances.at(-1);
  if (!performance) throw new Error("demo: performance missing");
  return performance;
}

/**
 * 执行一步剧本。控制器必须已 load（template-pick 步骤负责 load）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runPerformanceDemoStep(
  controller: PerformanceStudioController,
  step: PerformanceDemoStep,
): Promise<PerformanceDemoStepOutcome> {
  switch (step.id) {
    case "template-pick": {
      // 首步负责加载（与 W1B/W2B/W3B demo 首步同款职责）。
      await controller.load({ workspaceKey: "you-w4b-performance-demo" });
      const preview = await controller.previewTemplateInstantiation({
        templateId: "fx-template-001",
        parameters: {
          intensity: 0.8,
          greetingText: "Hello from the studio!",
          includeHeadNod: true,
        },
      });
      return outcome(
        "template-pick",
        `Template "${preview.templateName}" picked. Deterministic preview digest ${preview.previewDigest} — the instantiated timeline is the template timeline verbatim (${preview.timeline.cues.length} cues, ${preview.timeline.durationMs} ms, ${preview.evidenceBoundCueCount} evidence-derived cue).`,
        [preview.templateId],
        { panel: "templates", selectedTemplateId: preview.templateId },
      );
    }
    case "performance-publish": {
      const performance = await controller.publishPerformanceFromTemplate({
        templateId: "fx-template-001",
        parameters: {
          intensity: 0.9,
          greetingText: "Hello from the demo!",
          includeHeadNod: true,
        },
      });
      return outcome(
        "performance-publish",
        `Performance ${performance.id} published from the template (bound to twin version ${performance.twinVersionId}; ${performance.timeline.cues.length} cues, duration ${performance.timeline.durationMs} ms; basedOnTemplateId ${performance.basedOnTemplateId}). The timeline is a verbatim copy — records are immutable and append-only.`,
        [performance.id],
        { panel: "timeline", selectedPerformanceId: performance.id },
      );
    }
    case "timeline-inspect": {
      const snapshot = await controller.refresh();
      const performance = latestPerformanceOf(snapshot);
      const tracks = [...new Set(performance.timeline.cues.map((cue) => cue.track))].sort();
      return outcome(
        "timeline-inspect",
        `Timeline inspection of ${performance.id}: tracks [${tracks.join(", ")}] (motion/cue/layer taxonomy), duration ${performance.timeline.durationMs} ms, every cue payload content-addressed (payloadRef + payloadHash) — never inlined.`,
        [performance.id],
        { panel: "timeline", selectedPerformanceId: performance.id },
      );
    }
    case "timeline-edit": {
      const snapshot = await controller.refresh();
      const source = latestPerformanceOf(snapshot);
      // 确定性编辑：拉伸 cue 轨（唯一 cue）末端 +400ms，再追加一条 layer cue；
      // 发布为新性能（同轨不重叠、时长精确一致——编辑后仍合法）。
      const stretchTarget = source.timeline.cues.find((cue) => cue.track === "cue");
      if (!stretchTarget) throw new Error("demo: cue-track cue missing");
      const draft = setDraftCueEnd(
        createTimelineDraft(source),
        stretchTarget.id,
        stretchTarget.endMs + 400,
      );
      const withAdded = addDraftCue(draft, "layer");
      const edited = await controller.publishPerformance({
        timeline: draftToTimeline(withAdded, `fx-timeline-edited-${source.id}`),
      });
      return outcome(
        "timeline-edit",
        `Timeline edited deterministically (the cue-track line stretched by 400 ms, one layer cue appended) and published as new immutable Performance ${edited.id} (${edited.timeline.cues.length} cues, duration ${edited.timeline.durationMs} ms). The source record is untouched.`,
        [edited.id, source.id],
        { panel: "timeline", selectedPerformanceId: edited.id },
      );
    }
    case "timeline-invalid": {
      const snapshot = await controller.refresh();
      const source = latestPerformanceOf(snapshot);
      // 预期中的 typed error：同轨重叠（track-overlap）⇒ YOU_TIMELINE_INVALID。
      // 重复 cue 紧随原 cue 插入（保持 startMs 有序——触发的是轨重叠而非乱序）。
      const draft = createTimelineDraft(source);
      const firstCue = draft.cues[0]!;
      const invalidTimeline = {
        id: `fx-timeline-invalid-${source.id}`,
        cues: [
          ...draft.cues.slice(0, 1),
          {
            ...firstCue,
            id: `${firstCue.id}-overlap`,
            startMs: firstCue.startMs,
            endMs: firstCue.endMs,
          },
          ...draft.cues.slice(1),
        ],
        durationMs: source.timeline.durationMs,
      };
      const error = await expectTypedError(() =>
        controller.publishPerformance({ timeline: invalidTimeline }),
      );
      return outcome(
        "timeline-invalid",
        `${error.youError.code}: ${error.youError.message} — the service validates statelessly and never silently repairs a timeline.`,
        [source.id],
        { panel: "timeline", selectedPerformanceId: source.id },
      );
    }
    case "render-consent-gate": {
      const snapshot = await controller.refresh();
      const performance = latestPerformanceOf(snapshot);
      // 预期中的 typed error：evidence-bound render 无许可 ⇒ 不处理（服务端强制）。
      const error = await expectTypedError(() =>
        controller.submitRenderJob({
          performanceId: performance.id,
          method: "video-render",
          outputKinds: ["video"],
          parameters: { resolution: "1080p", fps: 30 },
        }),
      );
      return outcome(
        "render-consent-gate",
        `${error.youError.code}: ${error.youError.message} — the timeline carries evidence-derived cue payloads; no permission means no processing.`,
        [performance.id],
        { panel: "review" },
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
      return outcome(
        "consent-grant",
        `Operational consent granted per purpose (${policy.purposes.join(", ")}) — rendered from the consent-state projection of the wave-2 authority shapes; evidence-bound render is possible only from this point.`,
        [policy.id],
        { panel: "review" },
      );
    }
    case "render-submit": {
      const snapshot = await controller.refresh();
      const performance = latestPerformanceOf(snapshot);
      const spec = await controller.submitRenderJob({
        performanceId: performance.id,
        method: "image-render",
        outputKinds: ["image"],
        parameters: { resolution: "1080p", quality: 0.9 },
      });
      return outcome(
        "render-submit",
        `RenderJobSpec ${spec.id} submitted (method ${spec.method}; output kinds ${spec.outputKinds.join(", ")}; params resolution=${String(spec.parameters["resolution"])}). Status: queued — the method registry lane validates, never silently re-routes.`,
        [spec.id, performance.id],
        { panel: "jobs", selectedJobId: spec.id, selectedPerformanceId: performance.id },
      );
    }
    case "render-run": {
      const snapshot = await controller.refresh();
      const job = snapshot.jobs.at(-1);
      if (!job) throw new Error("demo: render job missing");
      await controller.startRenderJob({ jobId: job.spec.id });
      return outcome(
        "render-run",
        `Render job ${job.spec.id} is running (queued -> running on the frozen transition table; terminals stay locked).`,
        [job.spec.id],
        { panel: "jobs", selectedJobId: job.spec.id },
      );
    }
    case "render-complete": {
      const snapshot = await controller.refresh();
      const job = snapshot.jobs.at(-1);
      if (!job) throw new Error("demo: render job missing");
      const result = await controller.completeRenderJob({ jobId: job.spec.id });
      return outcome(
        "render-complete",
        `Render job ${result.jobId} completed: ${result.artifacts.length} content-addressed artifact(s) (${result.artifacts.map((artifact) => artifact.kind).join(", ")}). Effort/latency/cost carry explicit not-measured markers — never invented numbers. Artifacts stay simulated.`,
        [result.jobId, ...result.artifacts.map((artifact) => artifact.id)],
        { panel: "jobs", selectedJobId: result.jobId },
      );
    }
    case "render-submit-2": {
      // 合成时间线（无 evidence 派生 payload）⇒ 不触发同意门的第二作业。
      const performance = await controller.publishPerformanceFromTemplate({
        templateId: "fx-template-002",
        parameters: { turnDegrees: 120, holdSeconds: 2, caption: "Demo topic" },
      });
      const spec = await controller.submitRenderJob({
        performanceId: performance.id,
        method: "3d-render",
        outputKinds: ["image", "mesh"],
        parameters: { resolution: "1080p", samples: 128 },
      });
      return outcome(
        "render-submit-2",
        `Second job ${spec.id} submitted on synthetic Performance ${performance.id} (method ${spec.method}; output kinds ${spec.outputKinds.join(", ")}) — its cue payloads are synthetic, so the consent gate stays open. Status: queued.`,
        [spec.id, performance.id],
        { panel: "jobs", selectedJobId: spec.id, selectedPerformanceId: performance.id },
      );
    }
    case "render-complete-2": {
      const snapshot = await controller.refresh();
      const job = snapshot.jobs.at(-1);
      if (!job) throw new Error("demo: render job missing");
      await controller.startRenderJob({ jobId: job.spec.id });
      const result = await controller.completeRenderJob({ jobId: job.spec.id });
      return outcome(
        "render-complete-2",
        `Render job ${result.jobId} completed: ${result.artifacts.length} artifacts (${result.artifacts.map((artifact) => artifact.kind).join(", ")}) — a sharper still plus a mesh candidate for the review flow.`,
        [result.jobId, ...result.artifacts.map((artifact) => artifact.id)],
        { panel: "jobs", selectedJobId: result.jobId },
      );
    }
    case "artifact-accept": {
      const snapshot = await controller.refresh();
      // 作业 1 的静帧（image）——lineage：job → artifacts。
      const artifact = snapshot.jobs[0]?.result?.artifacts[0];
      if (!artifact) throw new Error("demo: render artifact missing");
      const review = await controller.reviewArtifact({
        artifactId: artifact.id,
        decision: "accept",
        notes: "fixture: operator accepted the rendered still",
      });
      return outcome(
        "artifact-accept",
        `Artifact ${artifact.id} (job ${artifact.jobId}) accepted — review ${review.id} appended; the status ladder moves pending -> accepted (append-only, never overwritten).`,
        [review.id, artifact.id],
        { panel: "review", selectedArtifactId: artifact.id, selectedJobId: artifact.jobId },
      );
    }
    case "artifact-reject": {
      const snapshot = await controller.refresh();
      // 作业 2 的 mesh 产物——拒绝路径。
      const meshArtifact = snapshot.jobs[1]?.result?.artifacts.find(
        (artifact) => artifact.kind === "mesh",
      );
      if (!meshArtifact) throw new Error("demo: mesh artifact missing");
      const review = await controller.reviewArtifact({
        artifactId: meshArtifact.id,
        decision: "reject",
        notes: "fixture: mesh not watertight",
      });
      return outcome(
        "artifact-reject",
        `Artifact ${meshArtifact.id} (job ${meshArtifact.jobId}) rejected — review ${review.id} appended; the ladder records pending -> rejected with the operator notes.`,
        [review.id, meshArtifact.id],
        { panel: "review", selectedArtifactId: meshArtifact.id, selectedJobId: meshArtifact.jobId },
      );
    }
    case "artifact-supersede": {
      const snapshot = await controller.refresh();
      // 先前已接受的静帧：由作业 2 更清晰的静帧取代（append-only 取代链接）。
      const acceptedArtifact = snapshot.jobs[0]?.result?.artifacts[0];
      if (!acceptedArtifact) throw new Error("demo: accepted artifact missing");
      const review = await controller.reviewArtifact({
        artifactId: acceptedArtifact.id,
        decision: "supersede",
        notes: "fixture: superseded by the sharper 3d-render still",
      });
      return outcome(
        "artifact-supersede",
        `Artifact ${acceptedArtifact.id} superseded — review ${review.id} appended; the earlier accepted review is superseded through append-only linkage (record replacement, never in-place overwrite).`,
        [review.id, acceptedArtifact.id],
        {
          panel: "review",
          selectedArtifactId: acceptedArtifact.id,
          selectedJobId: acceptedArtifact.jobId,
        },
      );
    }
    case "render-fail": {
      const snapshot = await controller.refresh();
      const performance = latestPerformanceOf(snapshot);
      const spec = await controller.submitRenderJob({
        performanceId: performance.id,
        method: "motion-extraction",
        outputKinds: ["animation"],
        parameters: { format: "bvh", rootMotion: true },
      });
      await controller.startRenderJob({ jobId: spec.id });
      const failed = await controller.failRenderJob({
        jobId: spec.id,
        reason: "fixture: operator invoked the honest failure path",
      });
      return outcome(
        "render-fail",
        `Render job ${failed.jobId} failed honestly (running -> failed is a legal terminal): ${String(failed.effortObservations["failureReason"])}. No artifacts are produced; the failure reason is part of the record.`,
        [failed.jobId],
        { panel: "jobs", selectedJobId: failed.jobId },
      );
    }
    case "render-unsupported": {
      // 预期中的 typed error：注册面不支持的方法/输出组合（绝不静默改道）。
      const snapshot = await controller.refresh();
      const performance = latestPerformanceOf(snapshot);
      const error = await expectTypedError(() =>
        controller.submitRenderJob({
          performanceId: performance.id,
          method: "hologram-magic" as never,
          outputKinds: ["holo" as never],
          parameters: {},
        }),
      );
      return outcome(
        "render-unsupported",
        `${error.youError.code}: ${error.youError.message} — unregistered method/output combinations are rejected; no silent fallback to another method.`,
        [performance.id],
        { panel: "jobs" },
      );
    }
    case "consent-withdraw": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.withdrawConsent({ policyId: policy.id });
      // 撤回后的阻断演示须使用 evidence-bound 性能（模板 1 实例含 evidence 派生 cue）。
      const evidenceBoundPerformance = snapshot.performances[0];
      if (!evidenceBoundPerformance) throw new Error("demo: evidence-bound performance missing");
      const error = await expectTypedError(() =>
        controller.submitRenderJob({
          performanceId: evidenceBoundPerformance.id,
          method: "video-render",
          outputKinds: ["video"],
          parameters: { resolution: "1080p", fps: 30 },
        }),
      );
      return outcome(
        "consent-withdraw",
        `Consent withdrawn (${policy.id}): ${error.youError.code} on the next evidence-bound render — future processing is blocked; already-published immutable performances and artifacts keep their provenance.`,
        [policy.id, evidenceBoundPerformance.id],
        { panel: "review" },
      );
    }
  }
}
