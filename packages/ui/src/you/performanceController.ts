// YOU Performance Studio — PerformanceStudioController port (W4B)。
//
// 边界（docs/you/WORK_ORDERS.md W4B / docs/you/CONTRACTS.md wave-4 freeze）：
// - 本文件只定义 UI 消费的服务端口；performance/render 的 canonical truth 属于
//   performance/render 应用服务（Worker A，W4A）。UI 不实现领域逻辑。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v4 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `performanceSimulatedController.ts` 的确定性剧本；
//   TODO(T4): bind to Worker A 的 performance/render 服务（TL 在 T4 换绑本端口）。
// - 时间线/模板编辑的校验（YOU_TIMELINE_INVALID）、渲染方法支持矩阵
//   （YOU_RENDER_UNSUPPORTED）、artifact 评审状态机与 evidence-bound render 的
//   同意强制全部在服务端语义内；UI 只渲染投影（CONTRACTS.md "API/MCP/UI parity"）。
import type {
  ConsentPolicy,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  OpaqueId,
  Performance,
  PerformanceTemplate,
  PerformanceTimeline,
  RenderArtifact,
  RenderArtifactReview,
  RenderJobResult,
  RenderJobSpec,
  RenderJobStatus,
  RenderMethod,
  RenderOutputKind,
  SolutionEvent,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 政策）
// ---------------------------------------------------------------------------

export interface PerformanceStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 模板实例化（参数为 plain typed record；W4A 语义：timeline 为模板时间线逐字拷贝）。 */
export interface InstantiateTemplateInput {
  readonly templateId: OpaqueId;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
}

/** 发布手编时间线性能（timeline 校验 ⇒ YOU_TIMELINE_INVALID；不可变追加）。 */
export interface PublishPerformanceInput {
  readonly timeline: PerformanceTimeline;
  /** 缺省锚定剧本 twin 版本（T4 换绑后为 twin 服务 canonical 版本）。 */
  readonly twinVersionId?: OpaqueId;
}

export interface SubmitRenderJobInput {
  readonly performanceId: OpaqueId;
  readonly method: RenderMethod;
  readonly outputKinds: readonly RenderOutputKind[];
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
}

export interface RenderJobInput {
  readonly jobId: OpaqueId;
}

export interface FailRenderJobInput extends RenderJobInput {
  readonly reason: string;
}

/** Artifact 评审动作（append-only；先前有效评审被取代，绝不覆写）。 */
export interface ReviewArtifactInput {
  readonly artifactId: OpaqueId;
  readonly decision: "accept" | "reject" | "supersede";
  readonly notes: string;
}

/** 显式按用途 grant/deny（evidence-bound render 的 binding-time 强制）。 */
export interface PerformanceConsentDecisionInput {
  readonly policyId: OpaqueId;
  readonly purpose: ConsentPurpose;
  readonly decision: "grant" | "deny";
}

export interface PerformanceWithdrawConsentInput {
  readonly policyId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** 按用途的同意状态（append-only consent 事件的投影；稳定按 purpose 排序）。 */
export interface PerformancePurposeConsentState {
  readonly purpose: ConsentPurpose;
  readonly state: ConsentState;
}

/**
 * 同意状态的只读投影（与 W2B/W3B 同款形状；v4 law：evidence-bound render 的同意
 * 委托 wave-2 consent authority——T4 换绑后此处即该权威的状态投影）。
 */
export interface PerformanceConsentProjection {
  readonly policy: ConsentPolicy;
  readonly purposeStates: readonly PerformancePurposeConsentState[];
  /** evidence-bound render 使用的当前 ConsentReference（不可变快照）。 */
  readonly reference: ConsentReference;
}

/** 渲染方法注册面投影（registry lane = W4C；UI 的方法/输出选项来源，非硬编码）。 */
export interface RenderMethodProfileView {
  readonly method: RenderMethod;
  readonly supportedOutputKinds: readonly RenderOutputKind[];
  readonly defaultParameters: Readonly<Record<string, string | number | boolean>>;
}

/** 渲染作业的只读视图：spec（不可变）+ 运行状态 + 终态结果（含 artifacts）。 */
export interface RenderJobView {
  readonly spec: RenderJobSpec;
  readonly status: RenderJobStatus;
  readonly result: RenderJobResult | null;
}

/** 模板实例化的确定性预览（纯投影：不分配 id、不推进时钟、不落账）。 */
export interface TemplateInstantiationPreview {
  readonly templateId: OpaqueId;
  readonly templateName: string;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  /** 实例化时间线 = 模板时间线逐字拷贝（W4A 语义）。 */
  readonly timeline: PerformanceTimeline;
  readonly twinVersionId: OpaqueId;
  /** 确定性摘要（同 template + 同参数 ⇒ 同 digest）。 */
  readonly previewDigest: string;
  /** evidence 派生 cue 计数（同意门投影的输入）。 */
  readonly evidenceBoundCueCount: number;
}

export interface PerformanceStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 performance 表面）。 */
  readonly studioId: OpaqueId;
  /** 当前 twin 版本锚点（Performance 绑定目标；T4 换绑后来自 twin 服务）。 */
  readonly twinVersionAnchorId: OpaqueId;
  /** 模板库（W4A authority 的只读投影）。 */
  readonly templates: readonly PerformanceTemplate[];
  /** 已发布性能（追加序 = 发布序；记录不可变）。 */
  readonly performances: readonly Performance[];
  /** 渲染作业（追加序；effortObservations 诚实标注 not-measured）。 */
  readonly jobs: readonly RenderJobView[];
  /** append-only 评审账本（re-review supersede，绝不覆写）。 */
  readonly reviews: readonly RenderArtifactReview[];
  /** 渲染方法注册面（方法/输出选项 + 默认参数）。 */
  readonly renderMethods: readonly RenderMethodProfileView[];
  readonly consent: PerformanceConsentProjection;
  /** append-only 事件账本投影（performance-* / render-* / consent-*）。 */
  readonly events: readonly SolutionEvent[];
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class PerformanceStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "PerformanceStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Performance Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T4 换绑 Worker A 的
 * performance/render 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface PerformanceStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实 provider。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：performance 平面已存在时返回当前快照，不重建。 */
  load(request: PerformanceStudioLoadRequest): Promise<PerformanceStudioSnapshot>;
  refresh(): Promise<PerformanceStudioSnapshot>;

  // -- 模板（确定性实例化：timeline 逐字拷贝 + 参数记录） --
  /** 纯确定性预览（无状态副作用；UI 的预览区）。 */
  previewTemplateInstantiation(
    input: InstantiateTemplateInput,
  ): Promise<TemplateInstantiationPreview>;
  /** 实例化并发布 Performance（basedOnTemplateId 链接；journaling performance-published）。 */
  publishPerformanceFromTemplate(input: InstantiateTemplateInput): Promise<Performance>;

  // -- 性能发布（手编时间线；stateless 校验 ⇒ YOU_TIMELINE_INVALID） --
  publishPerformance(input: PublishPerformanceInput): Promise<Performance>;

  // -- 渲染作业（provider-neutral；注册面校验；诚实 effort 观察） --
  submitRenderJob(input: SubmitRenderJobInput): Promise<RenderJobSpec>;
  startRenderJob(input: RenderJobInput): Promise<PerformanceStudioSnapshot>;
  completeRenderJob(input: RenderJobInput): Promise<RenderJobResult>;
  failRenderJob(input: FailRenderJobInput): Promise<RenderJobResult>;

  // -- artifact 评审（append-only 状态机；typed YOU_RENDER_ARTIFACT_NOT_FOUND） --
  reviewArtifact(input: ReviewArtifactInput): Promise<RenderArtifactReview>;

  // -- 同意（evidence-bound render 的 binding-time 强制；委托 wave-2 authority） --
  decideConsent(input: PerformanceConsentDecisionInput): Promise<PerformanceConsentProjection>;
  withdrawConsent(input: PerformanceWithdrawConsentInput): Promise<PerformanceConsentProjection>;
}

// ---------------------------------------------------------------------------
// 同意状态纯投影（「无许可 ⇒ 不处理」必须可见且可测）
// ---------------------------------------------------------------------------

export interface RenderConsentGate {
  readonly purpose: "evidence-bound-render";
  readonly allowed: boolean;
  readonly state: ConsentState;
  /** 稳定原因码（UI 文案表按 state 渲染；测试断言）。 */
  readonly reason: "granted" | "unknown" | "denied" | "expired" | "withdrawn";
}

/** 同意状态保守度排序（severity 降序：withdrawn > denied > expired > unknown > granted）。 */
const CONSENT_STATE_SEVERITY: Readonly<Record<ConsentState, number>> = {
  granted: 0,
  unknown: 1,
  expired: 2,
  denied: 3,
  withdrawn: 4,
};

/**
 * 确定性保守聚合：取多用途状态中最严重者。任何非 granted 状态都阻断——
 * expired 绝不回退成 granted（truth law：无许可 ⇒ 不处理）。
 */
export function aggregateConsentState(states: readonly ConsentState[]): ConsentState {
  let worst: ConsentState = "granted";
  for (const candidate of states) {
    if (CONSENT_STATE_SEVERITY[candidate] > CONSENT_STATE_SEVERITY[worst]) {
      worst = candidate;
    }
  }
  return worst;
}

/**
 * evidence-bound render 门：仅当政策内全部用途被显式 granted 时 allowed=true。
 * 这是 UI 的按钮禁用投影；服务端 binding-time 强制独立存在
 * （submitRenderJob 抛 YOU_CONSENT_REQUIRED）。
 */
export function projectRenderConsentGate(
  consent: PerformanceConsentProjection,
): RenderConsentGate {
  const states = consent.policy.purposes.map(
    (purpose) =>
      consent.purposeStates.find((entry) => entry.purpose === purpose)?.state ?? "unknown",
  );
  const aggregate = aggregateConsentState(states);
  return {
    purpose: "evidence-bound-render",
    allowed: aggregate === "granted",
    state: aggregate,
    reason: aggregate,
  };
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B/W2B/W3B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** 按发布序返回性能（追加序即稳定序）。 */
export function orderedPerformances(
  snapshot: PerformanceStudioSnapshot | null,
): readonly Performance[] {
  if (!snapshot) return [];
  return snapshot.performances;
}

/** 按 id 解析性能（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function performanceById(
  snapshot: PerformanceStudioSnapshot | null,
  performanceId: string | null,
): Performance | null {
  if (!snapshot || performanceId === null) return null;
  return snapshot.performances.find((performance) => performance.id === performanceId) ?? null;
}

/** 按提交序返回渲染作业（追加序即稳定序）。 */
export function orderedRenderJobs(
  snapshot: PerformanceStudioSnapshot | null,
): readonly RenderJobView[] {
  if (!snapshot) return [];
  return snapshot.jobs;
}

/**
 * Artifact 全集（job → artifacts lineage 展开镜像；按作业提交序再按 artifact id
 * 稳定排序——FIXTURES 法则 4）。只有终态作业的 result 携带 artifacts。
 */
export function orderedRenderArtifacts(
  snapshot: PerformanceStudioSnapshot | null,
): readonly RenderArtifact[] {
  if (!snapshot) return [];
  const artifacts: RenderArtifact[] = [];
  for (const job of snapshot.jobs) {
    if (job.result) {
      artifacts.push(...job.result.artifacts);
    }
  }
  return artifacts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 某作业的 artifacts（lineage 查询；未知作业 → []）。 */
export function artifactsForJob(
  snapshot: PerformanceStudioSnapshot | null,
  jobId: string | null,
): readonly RenderArtifact[] {
  if (!snapshot || jobId === null) return [];
  return orderedRenderArtifacts(snapshot).filter((artifact) => artifact.jobId === jobId);
}

/**
 * 某 artifact 的有效（最新 append-only）评审；无则 null（状态机投影为 pending）。
 *
 * 语义：有效评审 = 该 artifact 最新一条评审记录（按 reviewedAt 再按 id 稳定降序；
 * reviewedAt 来自 StoryboardClock 单调递增）。与 wave-2 不同，W4B 的 supersede 是
 * 一等终态动作——其评审记录本身就带 status "superseded"（且它就是当前有效记录），
 * 因此不能用 status !== "superseded" 过滤（那会把 supersede 动作自己的记录一并
 * 滤掉）。被后续评审取代的旧记录经记录替换改为 superseded（append-only，绝不
 * 原地覆写——与 wave-2 证据评审同一纪律）。
 */
export function effectiveReviewForArtifact(
  snapshot: PerformanceStudioSnapshot | null,
  artifactId: string | null,
): RenderArtifactReview | null {
  if (!snapshot || artifactId === null) return null;
  const reviews = snapshot.reviews
    .filter((review) => review.artifactId === artifactId)
    .sort((a, b) => {
      if (a.reviewedAt !== b.reviewedAt) {
        return a.reviewedAt < b.reviewedAt ? 1 : -1;
      }
      return a.id < b.id ? 1 : -1;
    });
  return reviews[0] ?? null;
}
