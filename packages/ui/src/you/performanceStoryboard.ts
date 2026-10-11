// YOU Performance Studio — W4B 确定性剧本数据。
//
// 边界（docs/you/FIXTURES.md wave-4 ownership / docs/you/CONTRACTS.md v4 freeze）：
// - Worker A（W4A）拥有 performance/render 的 fixture 生成器（performance/template/
//   renderJob/artifact/review 的确定性 runtime）；B **不新增 fixture 生成器**。本文件是
//   「剧本」（storyboard）：契约形状的固定字面量记录 + 声明式表，供
//   `performanceSimulatedController.ts` 驱动确定性演示；所有记录 simulated: true。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v4 `you/contract.ts`），禁止本地重声明。
// - TODO(T4): Worker A 的 performance/render 服务合入后，由 TL 把 UI 端口换绑到真实
//   服务；本剧本届时随模拟控制器整体退役。
//
// 确定性法则（FIXTURES.md）：不调用 Date.now/Math.random/网络；时间戳来自
// StoryboardClock（复用 W1B 注入式剧本时钟）；一切输出排序稳定（按 id / 追加序）。
// 内容寻址：cue payload 与 render artifact 一律 payloadRef+payloadHash /
// contentRef+contentHash，绝不内联（CONTRACTS.md v4 laws）。
import type {
  ConsentPolicy,
  PerformanceCue,
  PerformanceTemplate,
  PerformanceTimeline,
  RenderArtifact,
  RenderJobResult,
  RenderOutputKind,
} from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const PERFORMANCE_STORYBOARD_SEED = "you-w4b-performance-studio-001";

export const PERFORMANCE_STORYBOARD_DISPLAY_NAME = "Performance Studio — Aria";

export const PERFORMANCE_STORYBOARD_SOLUTION_ID = "fx-performance-studio";

/**
 * 剧本 twin 版本锚点（Performance.twinVersionId 的固定绑定目标）。
 * TODO(T4): 换绑后由 twin 服务的 canonical 版本 id 提供真实锚点。
 */
export const PERFORMANCE_STORYBOARD_TWIN_VERSION_ID = "fx-twver-anchor-001";

// ---------------------------------------------------------------------------
// 同意政策（v4 law：evidence-bound render input 的同意委托 wave-2 consent authority；
// 本剧本保持同一 ConsentPolicy 形状，使「无许可 ⇒ 不处理」在 render 车道同样真实可见）
// ---------------------------------------------------------------------------

export const PERFORMANCE_STORYBOARD_CONSENT_POLICY: ConsentPolicy = {
  id: "fx-perf-consent-001",
  purposes: ["solution-generation", "export"],
  scope: "USER",
  operationalUse: false,
  learningReuse: false,
  retention: {
    policy: "delete-after-review",
    deleteAfter: null,
    reason:
      "Fixture render inputs derived from evidence content are gated on consent; immutable artifacts keep provenance only.",
  },
  revocable: true,
};

// ---------------------------------------------------------------------------
// Cue payload 内容寻址（payloadRef + payloadHash；evidence 派生 payload 有显式前缀）
// ---------------------------------------------------------------------------

/** payload 来源分类：twin 派生 / 场景资产 / 证据派生（evidence 派生触发同意门）。 */
export type StoryboardPayloadSource = "twin" | "environment" | "evidence";

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function storyboardPayloadAddress(
  source: StoryboardPayloadSource,
  scope: string,
): { readonly payloadRef: string; readonly payloadHash: string } {
  const refScope = `${PERFORMANCE_STORYBOARD_SEED}:${source}:${scope}`;
  return {
    payloadRef: source === "evidence"
      ? `fx-evidence-${computeCaptureFixtureHash(refScope)}`
      : `fx-content-${computeCaptureFixtureHash(refScope)}`,
    payloadHash: `sha256-fixture-${computeCaptureFixtureHash(`${refScope}:payload`)}`,
  };
}

/** evidence 派生 payload 判定（render 该类 payload = 处理证据内容 ⇒ 需要同意）。 */
export function isStoryboardEvidencePayload(payloadRef: string): boolean {
  return payloadRef.startsWith("fx-evidence-");
}

/** 时间线内 evidence 派生 cue 计数（同意门投影的确定性输入）。 */
export function storyboardEvidenceBoundCueCount(
  timeline: PerformanceTimeline,
): number {
  return timeline.cues.filter((cue) => isStoryboardEvidencePayload(cue.payloadRef)).length;
}

/** 剧本 cue 字面量（tag 保证 id / payload 寻址唯一；内容寻址、绝不内联）。 */
function storyboardCue(
  input: {
    readonly tag: string;
    readonly track: PerformanceCue["track"];
    readonly startMs: number;
    readonly endMs: number;
    readonly source: StoryboardPayloadSource;
  },
  timelineTag: string,
): PerformanceCue {
  const address = storyboardPayloadAddress(input.source, `${timelineTag}:${input.tag}`);
  return {
    id: `fx-cue-${timelineTag}-${input.tag}`,
    track: input.track,
    startMs: input.startMs,
    endMs: input.endMs,
    ...address,
  };
}

// ---------------------------------------------------------------------------
// 模板库（template authority = W4A；剧本按同一语义重建固定两条模板）
// ---------------------------------------------------------------------------

/** 模板时间线由字面量 cue 表组装（durationMs = 最大 endMs，精确一致）。 */
function storyboardTimeline(
  timelineTag: string,
  cues: readonly PerformanceCue[],
): PerformanceTimeline {
  return {
    id: `fx-timeline-${timelineTag}`,
    cues: [...cues],
    durationMs: cues.reduce((max, cue) => Math.max(max, cue.endMs), 0),
  };
}

/** 模板 1：工作室挥手问候（cue 轨 payload 为 evidence 派生 ⇒ render 走同意门）。
 * cue 字面量按 startMs 升序（契约：Ordered timeline——cues sorted by startMs）。 */
function buildWaveGreetingTemplate(): PerformanceTemplate {
  const timelineTag = "wave-greeting";
  const cues: PerformanceCue[] = [
    storyboardCue({ tag: "studio-backdrop", track: "layer", startMs: 0, endMs: 6000, source: "environment" }, timelineTag),
    storyboardCue({ tag: "wave-right-arm", track: "motion", startMs: 0, endMs: 2400, source: "twin" }, timelineTag),
    storyboardCue({ tag: "greeting-line", track: "cue", startMs: 200, endMs: 2600, source: "evidence" }, timelineTag),
    storyboardCue({ tag: "head-nod", track: "motion", startMs: 2400, endMs: 3200, source: "twin" }, timelineTag),
  ];
  return {
    id: "fx-template-001",
    name: "Studio Wave Greeting",
    timeline: storyboardTimeline(timelineTag, cues),
    parameters: {
      intensity: 0.8,
      greetingText: "Hello from the studio!",
      includeHeadNod: true,
    },
  };
}

/** 模板 2：讲者转身（cue 轨 payload 为合成脚本 ⇒ render 不触发同意门；
 * camera 轨展示开放 track 分类学——canonical 三成员之外的扩展轨道）。
 * cue 字面量按 startMs 升序（契约：Ordered timeline）。 */
function buildPresenterTurnTemplate(): PerformanceTemplate {
  const timelineTag = "presenter-turn";
  const cues: PerformanceCue[] = [
    storyboardCue({ tag: "body-turn", track: "motion", startMs: 0, endMs: 3000, source: "twin" }, timelineTag),
    storyboardCue({ tag: "dolly-in", track: "camera", startMs: 0, endMs: 3000, source: "twin" }, timelineTag),
    storyboardCue({ tag: "presentation-deck", track: "layer", startMs: 0, endMs: 8000, source: "environment" }, timelineTag),
    storyboardCue({ tag: "presenter-script", track: "cue", startMs: 500, endMs: 7500, source: "environment" }, timelineTag),
    storyboardCue({ tag: "settle-pose", track: "motion", startMs: 3000, endMs: 4600, source: "twin" }, timelineTag),
  ];
  return {
    id: "fx-template-002",
    name: "Presenter Turn",
    timeline: storyboardTimeline(timelineTag, cues),
    parameters: {
      turnDegrees: 90,
      holdSeconds: 2,
      caption: "Next topic",
    },
  };
}

/** 固定模板库（追加序稳定；name 唯一性由测试断言——W4A 同语义）。 */
export const PERFORMANCE_STORYBOARD_TEMPLATES: readonly PerformanceTemplate[] = [
  buildWaveGreetingTemplate(),
  buildPresenterTurnTemplate(),
];

export function storyboardTemplateById(templateId: string): PerformanceTemplate | null {
  return PERFORMANCE_STORYBOARD_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

/** 模板参数编辑的数值步长（视图元数据；纯数据表，非契约）。 */
export const PERFORMANCE_STORYBOARD_PARAMETER_STEPS: Readonly<
  Record<string, Readonly<Record<string, number>>>
> = {
  "fx-template-001": { intensity: 0.1 },
  "fx-template-002": { turnDegrees: 15, holdSeconds: 0.5 },
};

/** 确定性模板实例化预览摘要（同 template + 同参数 ⇒ 同 digest）。 */
export function storyboardPreviewDigest(
  templateId: string,
  parameters: Readonly<Record<string, string | number | boolean>>,
): string {
  const entries = Object.entries(parameters)
    .sort(([a], [b]) => compareId(a, b))
    .map(([key, value]) => `${key}=${typeof value}:${String(value)}`)
    .join("|");
  return computeCaptureFixtureHash(`${PERFORMANCE_STORYBOARD_SEED}:preview:${templateId}:${entries}`);
}

// ---------------------------------------------------------------------------
// 时间线校验（stateless、无时钟；W4A YOU_TIMELINE_INVALID 的剧本镜像）
// ---------------------------------------------------------------------------

export type TimelineViolationReason =
  | "cues-out-of-order"
  | "track-overlap"
  | "non-positive-duration"
  | "duration-inconsistent"
  | "missing-payload-addressing";

export interface TimelineViolation {
  readonly reason: TimelineViolationReason;
  readonly cueId: string | null;
  readonly track: string | null;
}

/**
 * 冻结 v4 时间线不变量（W4A 同语义）：
 * - 每 cue：startMs >= 0、endMs > startMs、track 非空、payloadRef/payloadHash 非空
 *   （内容寻址，绝不内联）；
 * - cues 按 startMs 非降序（有序性）；
 * - 同 track 不重叠（cue.startMs >= 该轨上一 cue 的 endMs——按轨末端水位判定，
 *   异轨 cue 可并行）；
 * - durationMs 与 cue 末端精确一致（有 cue ⇒ 等于最大 endMs；无 cue ⇒ 0）。
 * 返回首个违例（确定性：按检查顺序）；null = 合法。
 */
export function validateStoryboardTimeline(
  timeline: PerformanceTimeline,
): TimelineViolation | null {
  let previous: PerformanceCue | null = null;
  // 每轨末端水位（overlap 判定按轨进行——同轨 cue 不重叠，异轨可并行）。
  const lastEndByTrack = new Map<string, number>();
  for (const cue of timeline.cues) {
    if (cue.endMs <= cue.startMs || cue.startMs < 0) {
      return { reason: "non-positive-duration", cueId: cue.id, track: cue.track };
    }
    if (!cue.track || !cue.payloadRef || !cue.payloadHash) {
      return { reason: "missing-payload-addressing", cueId: cue.id, track: cue.track };
    }
    if (previous && cue.startMs < previous.startMs) {
      return { reason: "cues-out-of-order", cueId: cue.id, track: cue.track };
    }
    const trackLastEnd = lastEndByTrack.get(cue.track);
    if (trackLastEnd !== undefined && cue.startMs < trackLastEnd) {
      return {
        reason: "track-overlap",
        cueId: cue.id,
        track: cue.track,
      };
    }
    lastEndByTrack.set(cue.track, Math.max(trackLastEnd ?? 0, cue.endMs));
    previous = cue;
  }
  const expectedDurationMs = timeline.cues.reduce(
    (max, cue) => Math.max(max, cue.endMs),
    0,
  );
  if (timeline.durationMs !== expectedDurationMs) {
    return { reason: "duration-inconsistent", cueId: null, track: null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 渲染方法支持矩阵（registry lane = W4C；剧本按同一语义镜像注册面）
// ---------------------------------------------------------------------------

export interface StoryboardRenderMethodProfile {
  readonly method: string;
  readonly supportedOutputKinds: readonly RenderOutputKind[];
  /** 方法默认参数（plain typed record；渲染参数编辑的初始值）。 */
  readonly defaultParameters: Readonly<Record<string, string | number | boolean>>;
}

/** 固定注册面（method-plural、provider-neutral；未注册 method ⇒ 全部不支持）。 */
export const PERFORMANCE_STORYBOARD_RENDER_METHODS: readonly StoryboardRenderMethodProfile[] = [
  {
    method: "motion-extraction",
    supportedOutputKinds: ["animation"],
    defaultParameters: { format: "bvh", rootMotion: true },
  },
  {
    method: "retargeting",
    supportedOutputKinds: ["animation", "mesh"],
    defaultParameters: { targetRig: "fx-rig-v1", preserveFingers: true },
  },
  {
    method: "image-render",
    supportedOutputKinds: ["image"],
    defaultParameters: { resolution: "1080p", quality: 0.9 },
  },
  {
    method: "video-render",
    supportedOutputKinds: ["video"],
    defaultParameters: { resolution: "1080p", fps: 30 },
  },
  {
    method: "3d-render",
    supportedOutputKinds: ["image", "video", "mesh", "animation"],
    defaultParameters: { resolution: "1080p", samples: 128 },
  },
];

export function storyboardRenderMethodProfile(method: string): StoryboardRenderMethodProfile | null {
  return (
    PERFORMANCE_STORYBOARD_RENDER_METHODS.find((profile) => profile.method === method) ?? null
  );
}

/** 返回不支持的 outputKind（[] = 支持；未知 method ⇒ 全部不支持）。 */
export function unsupportedStoryboardRenderOutputKinds(
  method: string,
  outputKinds: readonly RenderOutputKind[],
): RenderOutputKind[] {
  const profile = storyboardRenderMethodProfile(method);
  if (profile === null) {
    return [...outputKinds].sort(compareId);
  }
  return outputKinds
    .filter((kind) => !profile.supportedOutputKinds.includes(kind))
    .sort(compareId);
}

// ---------------------------------------------------------------------------
// 渲染作业 / 产物剧本（内容寻址 artifact；诚实 not-measured effort 观察）
// ---------------------------------------------------------------------------

/** 组装内容寻址 RenderArtifact（contentRef + contentHash；simulated: true）。 */
export function buildStoryboardRenderArtifact(
  input: {
    readonly id: string;
    readonly jobId: string;
    readonly kind: RenderOutputKind;
    readonly tag: string;
    readonly createdAt: string;
  },
): RenderArtifact {
  const scope = `${PERFORMANCE_STORYBOARD_SEED}:artifact:${input.jobId}:${input.tag}:${input.kind}`;
  return {
    id: input.id,
    jobId: input.jobId,
    kind: input.kind,
    contentRef: `fx-content-${computeCaptureFixtureHash(scope)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${scope}:content`)}`,
    createdAt: input.createdAt,
    simulated: true,
  };
}

/**
 * 诚实的 effort 观察（truth law）：每个 effort/latency/cost 字段都带显式
 * not-measured 标记；只有产物/outputKind 计数是真实观察（与 W3B 同形状）。
 */
export function notMeasuredStoryboardRenderEffortObservations(
  artifactCount: number,
  outputKindCount: number,
  evidenceBoundCueCount: number,
): Readonly<Record<string, string | number | boolean>> {
  return {
    "computeEffort.measured": false,
    computeEffort: "not-measured (simulated)",
    "latencyMs.measured": false,
    latencyMs: "not-measured (simulated)",
    "costUnits.measured": false,
    costUnits: "not-measured (simulated)",
    artifactsProduced: artifactCount,
    outputKindsRequested: outputKindCount,
    evidenceBoundCuesProcessed: evidenceBoundCueCount,
    simulated: true,
  };
}

/** 组装终态 RenderJobResult（completed/failed；诚实观察字段）。 */
export function buildStoryboardRenderResult(
  input: {
    readonly jobId: string;
    readonly status: "completed" | "failed";
    readonly artifacts: readonly RenderArtifact[];
    readonly outputKindCount: number;
    readonly evidenceBoundCueCount: number;
    readonly failureReason?: string;
    readonly completedAt: string;
  },
): RenderJobResult {
  const observations: Record<string, string | number | boolean> = {
    ...notMeasuredStoryboardRenderEffortObservations(
      input.artifacts.length,
      input.outputKindCount,
      input.evidenceBoundCueCount,
    ),
  };
  if (input.status === "failed") {
    observations["failureReason"] = input.failureReason ?? "unspecified";
  }
  return {
    jobId: input.jobId,
    status: input.status,
    artifacts: [...input.artifacts],
    effortObservations: observations,
    completedAt: input.completedAt,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// 渲染作业生命周期（W4A 冻结转移表：queued → running → completed | failed；终态锁定）
// ---------------------------------------------------------------------------

export const STORYBOARD_RENDER_JOB_TRANSITIONS: Readonly<
  Record<string, readonly string[]>
> = {
  queued: ["running"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function isLegalStoryboardRenderJobTransition(from: string, to: string): boolean {
  return STORYBOARD_RENDER_JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// 评审状态机（v4 law：append-only；re-review supersedes，绝不覆写——与 W2 证据评审
// 同一纪律：有效评审 = 最新非 superseded 记录）
// ---------------------------------------------------------------------------

export const STORYBOARD_REVIEW_TERMINAL_STATUSES: readonly string[] = [
  "accepted",
  "rejected",
  "superseded",
];

/** 时间线草稿新 cue 的内容寻址 payload（视图草稿用；确定性派生自序号）。 */
export function storyboardDraftPayloadAddress(
  track: string,
  ordinal: number,
): { readonly payloadRef: string; readonly payloadHash: string } {
  return storyboardPayloadAddress("environment", `draft:${track}:${ordinal}`);
}
