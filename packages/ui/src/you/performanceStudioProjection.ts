// YOU Performance Studio — 视图纯投影（W4B）。
//
// 只做确定性视图数学：时间线轨道投影（motion/cue/layer 分类学 + 内容寻址 payload
// 标签 + 时长显示）、渲染作业状态阶梯、artifact lineage 行、评审状态投影、
// 模板参数行、渲染提交草稿转移、键盘转移（与 Solution/Capture/Twin 表面同级的
// 键盘可用性）。时间线草稿编辑模型在 performanceTimelineDraftModel.ts（同类纯
// 视图数学，按模块内聚拆分）。无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type {
  PerformanceTimeline,
  RenderArtifact,
  RenderArtifactReviewStatus,
  RenderJobStatus,
  RenderOutputKind,
} from "@zcode/shared";
import type {
  PerformanceStudioSnapshot,
  RenderJobView,
  TemplateInstantiationPreview,
} from "./performanceController.js";
import { effectiveReviewForArtifact } from "./performanceController.js";

// ---------------------------------------------------------------------------
// 时间线轨道投影（cue track taxonomy：motion / cue / layer + 开放扩展）
// ---------------------------------------------------------------------------

/** 固定轨道展示序（taxonomy 前三成员；其余按字典序稳定追加）。 */
const TRACK_ORDER: readonly string[] = ["motion", "cue", "layer"];

export interface TimelineCueRow {
  readonly id: string;
  readonly track: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
  readonly payloadRef: string;
  readonly payloadHash: string;
  /** evidence 派生 payload（render 该 cue ⇒ 同意门投影会阻断）。 */
  readonly evidenceBound: boolean;
  /** 时长条形占比（0–100，相对时间线总时长；确定性视图数学）。 */
  readonly startPercent: number;
  readonly widthPercent: number;
  /** 供 aria / 纯文本消费的确定性描述（非仅颜色）。 */
  readonly accessibleLabel: string;
}

export interface TimelineTrackRow {
  readonly track: string;
  readonly cueRows: readonly TimelineCueRow[];
  readonly cueCount: number;
}

export interface TimelineProjection {
  readonly timelineId: string;
  readonly durationMs: number;
  /** 时长显示（秒，两位小数；确定性格式）。 */
  readonly durationLabel: string;
  readonly totalCues: number;
  /** evidence 派生 cue 计数（同意门可见性）。 */
  readonly evidenceBoundCueCount: number;
  /** 轨道行（固定序 motion/cue/layer + 扩展轨道字典序）。 */
  readonly tracks: readonly TimelineTrackRow[];
  /** 全部 cue（按 startMs 再按 id 稳定排序）。 */
  readonly cueRows: readonly TimelineCueRow[];
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function formatDurationLabel(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

/** 时间线 → 轨道投影（含内容寻址 payload 标签；绝不内联内容）。 */
export function projectTimeline(
  timeline: PerformanceTimeline | null,
): TimelineProjection {
  if (!timeline) {
    return {
      timelineId: "",
      durationMs: 0,
      durationLabel: formatDurationLabel(0),
      totalCues: 0,
      evidenceBoundCueCount: 0,
      tracks: [],
      cueRows: [],
    };
  }
  const total = Math.max(1, timeline.durationMs);
  const cueRows: TimelineCueRow[] = timeline.cues
    .slice()
    .sort((a, b) => (a.startMs !== b.startMs ? a.startMs - b.startMs : compareId(a.id, b.id)))
    .map((cue) => {
      const evidenceBound = cue.payloadRef.startsWith("fx-evidence-");
      return {
        id: cue.id,
        track: cue.track,
        startMs: cue.startMs,
        endMs: cue.endMs,
        durationMs: cue.endMs - cue.startMs,
        payloadRef: cue.payloadRef,
        payloadHash: cue.payloadHash,
        evidenceBound,
        startPercent: Math.round((cue.startMs / total) * 1000) / 10,
        widthPercent: Math.round(((cue.endMs - cue.startMs) / total) * 1000) / 10,
        accessibleLabel: `${cue.track} cue ${cue.id}, ${cue.startMs}-${cue.endMs} ms, payload ${cue.payloadRef} (${cue.payloadHash})${evidenceBound ? ", evidence-derived" : ""}`,
      };
    });
  const trackNames = [
    ...new Set(cueRows.map((row) => row.track)),
  ].sort((a, b) => {
    const indexA = TRACK_ORDER.indexOf(a);
    const indexB = TRACK_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return compareId(a, b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  return {
    timelineId: timeline.id,
    durationMs: timeline.durationMs,
    durationLabel: formatDurationLabel(timeline.durationMs),
    totalCues: cueRows.length,
    evidenceBoundCueCount: cueRows.filter((row) => row.evidenceBound).length,
    tracks: trackNames.map((track) => {
      const rows = cueRows.filter((row) => row.track === track);
      return { track, cueRows: rows, cueCount: rows.length };
    }),
    cueRows,
  };
}

// ---------------------------------------------------------------------------
// 渲染作业状态阶梯（queued → running → completed | failed；终态锁定）
// ---------------------------------------------------------------------------

export interface RenderJobLadderStep {
  readonly status: RenderJobStatus;
  readonly reached: boolean;
  readonly current: boolean;
}

/** 状态阶梯投影：queued/running 为过程步；completed/failed 为互斥终态步。 */
export function projectRenderJobLadder(
  status: RenderJobStatus,
): readonly RenderJobLadderStep[] {
  const order: readonly RenderJobStatus[] = ["queued", "running", "completed", "failed"];
  // 已走过的状态（queued 恒为已过；running 在 running/completed/failed 时已过；
  // completed 与 failed 是互斥终态——只有当前态算 reached）。
  const reached = new Set<RenderJobStatus>(["queued", status]);
  if (status === "completed" || status === "failed") {
    reached.add("running");
  }
  return order.map((step) => ({
    status: step,
    reached: reached.has(step),
    current: step === status,
  }));
}

export interface RenderJobSpecRow {
  readonly jobId: string;
  readonly status: RenderJobStatus;
  readonly method: string;
  readonly performanceId: string;
  readonly outputKinds: readonly string[];
  readonly parameterEntries: readonly { readonly key: string; readonly value: string }[];
  readonly artifactCount: number;
  readonly completedAt: string | null;
  readonly failureReason: string | null;
}

/** 作业 spec/result → 只读行（参数按 key 稳定排序）。 */
export function projectRenderJobSpecRow(
  job: RenderJobView,
): RenderJobSpecRow {
  const result = job.result;
  return {
    jobId: job.spec.id,
    status: job.status,
    method: job.spec.method,
    performanceId: job.spec.performanceId,
    outputKinds: [...job.spec.outputKinds],
    parameterEntries: Object.entries(job.spec.parameters)
      .sort(([a], [b]) => compareId(a, b))
      .map(([key, value]) => ({ key, value: String(value) })),
    artifactCount: result?.artifacts.length ?? 0,
    completedAt: result?.completedAt ?? null,
    failureReason:
      result && typeof result.effortObservations["failureReason"] === "string"
        ? result.effortObservations["failureReason"]
        : null,
  };
}

// ---------------------------------------------------------------------------
// effort 观察（truth law：not-measured 标记原样呈现，绝不编造数字）
// ---------------------------------------------------------------------------

export interface RenderEffortObservationRow {
  readonly key: string;
  readonly value: string;
  /** 显式 not-measured 标记（`*.measured: false` 或 "not-measured" 字面）。 */
  readonly notMeasured: boolean;
  readonly accessibleLabel: string;
}

/** effortObservations 的确定性渲染行（按 key 稳定排序）。 */
export function projectRenderEffortRows(
  job: RenderJobView | null,
): readonly RenderEffortObservationRow[] {
  if (!job?.result) return [];
  return Object.entries(job.result.effortObservations)
    .sort(([a], [b]) => compareId(a, b))
    .map(([key, raw]) => {
      const value = String(raw);
      const notMeasured =
        key.endsWith(".measured") ? raw === false : value.includes("not-measured");
      return {
        key,
        value,
        notMeasured,
        accessibleLabel: notMeasured
          ? `${key}: ${value} (unmeasured — no number invented)`
          : `${key}: ${value}`,
      };
    });
}

// ---------------------------------------------------------------------------
// Artifact lineage / 评审状态投影（job → artifacts；有效评审 = 最新非 superseded）
// ---------------------------------------------------------------------------

export interface ArtifactReviewProjection {
  /** 无评审记录 ⇒ pending（状态机的隐式起点）。 */
  readonly status: RenderArtifactReviewStatus;
  readonly reviewId: string | null;
  readonly reviewedAt: string | null;
  readonly reviewCount: number;
}

export interface ArtifactLineageRow {
  readonly artifact: RenderArtifact;
  readonly jobId: string;
  readonly jobStatus: RenderJobStatus;
  readonly review: ArtifactReviewProjection;
  readonly accessibleLabel: string;
}

/** artifact 评审状态投影（append-only 账本的确定性视图）。 */
export function projectArtifactReview(
  snapshot: PerformanceStudioSnapshot | null,
  artifactId: string | null,
): ArtifactReviewProjection {
  if (!snapshot || artifactId === null) {
    return { status: "pending", reviewId: null, reviewedAt: null, reviewCount: 0 };
  }
  const all = snapshot.reviews.filter((review) => review.artifactId === artifactId);
  const effective = effectiveReviewForArtifact(snapshot, artifactId);
  return {
    status: effective?.status ?? "pending",
    reviewId: effective?.id ?? null,
    reviewedAt: effective?.reviewedAt ?? null,
    reviewCount: all.length,
  };
}

/** artifact lineage 行（按 job 提交序分组展开；artifact 卡片的数据源）。 */
export function projectArtifactLineageRows(
  snapshot: PerformanceStudioSnapshot | null,
): readonly ArtifactLineageRow[] {
  if (!snapshot) return [];
  const rows: ArtifactLineageRow[] = [];
  for (const job of snapshot.jobs) {
    if (!job.result) continue;
    for (const artifact of [...job.result.artifacts].sort((a, b) => compareId(a.id, b.id))) {
      const review = projectArtifactReview(snapshot, artifact.id);
      rows.push({
        artifact,
        jobId: job.spec.id,
        jobStatus: job.status,
        review,
        accessibleLabel: `${artifact.kind} artifact ${artifact.id} from job ${artifact.jobId}, content ${artifact.contentRef} (${artifact.contentHash}), review ${review.status}`,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 模板参数行（plain typed record 的确定性编辑视图）
// ---------------------------------------------------------------------------

export type TemplateParameterKind = "string" | "number" | "boolean";

export interface TemplateParameterRow {
  readonly key: string;
  readonly kind: TemplateParameterKind;
  readonly value: string | number | boolean;
}

/** 参数 record → 编辑行（按 key 稳定排序；kind 由值类型决定）。 */
export function projectTemplateParameterRows(
  parameters: Readonly<Record<string, string | number | boolean>>,
): readonly TemplateParameterRow[] {
  return Object.entries(parameters)
    .sort(([a], [b]) => compareId(a, b))
    .map(([key, value]) => ({
      key,
      kind: typeof value as TemplateParameterKind,
      value,
    }));
}

/** 参数 record 的确定性摘要行（key=value；按 key 排序）。 */
export function projectParameterSummaryEntries(
  parameters: Readonly<Record<string, string | number | boolean>>,
): readonly { readonly key: string; readonly value: string }[] {
  return Object.entries(parameters)
    .sort(([a], [b]) => compareId(a, b))
    .map(([key, value]) => ({ key, value: String(value) }));
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/Twin 表面一致的键盘导航可用性；纯函数可测）
// ---------------------------------------------------------------------------

export type PerformanceListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * 性能列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前性能（检视时间线）；
 * - 其余键 no-op。
 */
export function resolvePerformanceKeyboardTransition(
  key: string,
  state: {
    readonly totalPerformances: number;
  },
): PerformanceListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalPerformances };
    case "End":
      return { kind: "move", delta: state.totalPerformances };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** 性能光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampPerformanceIndex(index: number, totalPerformances: number): number {
  if (totalPerformances <= 0) return 0;
  return Math.min(totalPerformances - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 渲染提交草稿（method + outputKinds + params 的视图草稿；纯转移）
// ---------------------------------------------------------------------------

export interface RenderSubmitDraft {
  readonly method: string | null;
  readonly outputKinds: readonly RenderOutputKind[];
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
}

export const RENDER_SUBMIT_DRAFT_EMPTY: RenderSubmitDraft = {
  method: null,
  outputKinds: [],
  parameters: {},
};

/** 选中方法（缺省带入该方法的默认参数与首个支持 outputKind）。 */
export function selectRenderMethod(
  draft: RenderSubmitDraft,
  method: string,
  profile: {
    readonly supportedOutputKinds: readonly RenderOutputKind[];
    readonly defaultParameters: Readonly<Record<string, string | number | boolean>>;
  } | null,
): RenderSubmitDraft {
  if (!profile) {
    return { ...draft, method };
  }
  return {
    method,
    outputKinds: [...profile.supportedOutputKinds],
    parameters: { ...profile.defaultParameters },
  };
}

/** 切换 outputKind 勾选（确定性集合转移）。 */
export function toggleRenderOutputKind(
  draft: RenderSubmitDraft,
  kind: RenderOutputKind,
): RenderSubmitDraft {
  const selected = draft.outputKinds.includes(kind);
  return {
    ...draft,
    outputKinds: selected
      ? draft.outputKinds.filter((candidate) => candidate !== kind)
      : [...draft.outputKinds, kind].sort(compareId),
  };
}

/** 渲染参数编辑（plain typed record 写入；kind 与原值一致）。 */
export function setRenderDraftParameter(
  draft: RenderSubmitDraft,
  key: string,
  value: string | number | boolean,
): RenderSubmitDraft {
  return { ...draft, parameters: { ...draft.parameters, [key]: value } };
}

/** 模板预览摘要行（确定性 digest 展示）。 */
export function projectPreviewSummary(
  preview: TemplateInstantiationPreview | null,
): { readonly digest: string; readonly evidenceBoundCueCount: number } | null {
  if (!preview) return null;
  return {
    digest: preview.previewDigest,
    evidenceBoundCueCount: preview.evidenceBoundCueCount,
  };
}
