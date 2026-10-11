// YOU Twin Studio — TwinStudioController port (W3B)。
//
// 边界（docs/you/WORK_ORDERS.md W3B / docs/you/CONTRACTS.md wave-3 freeze）：
// - 本文件只定义 UI 消费的服务端口；twin/reconstruction 的 canonical truth 属于
//   twin 应用服务（Worker A，W3A）。UI 不实现领域逻辑。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v3 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `twinSimulatedController.ts` 的确定性剧本；
//   TODO(T3): bind to Worker A 的 twin/reconstruction 服务（TL 在 T3 换绑本端口）。
// - 质量改进经 W2 evidence 捕获机制（定向 EvidenceRequest），不存在 UI-only 变更路径
//   （CONTRACTS.md "API/MCP/UI parity"）。
import type {
  ConsentPolicy,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  EvidenceRequest,
  HtirDomainKind,
  OpaqueId,
  ReconstructionJobResult,
  ReconstructionJobSpec,
  ReconstructionJobStatus,
  ReconstructionMethod,
  SolutionEvent,
  TwinVersion,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 政策）
// ---------------------------------------------------------------------------

export interface TwinStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 从剧本域块发布下一版候选（确定性；evidenceBound 触发 binding-time 同意强制）。 */
export interface PublishTwinVersionInput {
  readonly evidenceBound?: boolean;
}

export interface PromoteTwinVersionInput {
  readonly versionId: OpaqueId;
}

export interface AssessTwinQualityInput {
  readonly versionId: OpaqueId;
}

export interface OpenRemediationInput {
  readonly versionId: OpaqueId;
  readonly deficiencyId: OpaqueId;
}

export interface SubmitReconstructionInput {
  readonly method: ReconstructionMethod;
  readonly targetDomains: readonly HtirDomainKind[];
  readonly evidenceBound?: boolean;
}

export interface ReconstructionJobInput {
  readonly jobId: OpaqueId;
}

export interface FailReconstructionInput extends ReconstructionJobInput {
  readonly reason: string;
}

/** 从已完成作业发布下一版候选（作业 spec 自带 twinVersionId 锚点；W3A 同语义）。 */
export interface PublishVersionFromJobInput extends ReconstructionJobInput {}

/** 显式按用途 grant/deny（binding-time 强制；SECURITY.md：purpose-specific consent）。 */
export interface TwinConsentDecisionInput {
  readonly policyId: OpaqueId;
  readonly purpose: ConsentPurpose;
  readonly decision: "grant" | "deny";
}

export interface TwinWithdrawConsentInput {
  readonly policyId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** 按用途的同意状态（append-only consent 事件的投影；稳定按 purpose 排序）。 */
export interface TwinPurposeConsentState {
  readonly purpose: ConsentPurpose;
  readonly state: ConsentState;
}

/**
 * 同意状态的只读投影：政策 + 每用途状态 + 当前绑定引用。
 * 「无许可 ⇒ 不处理」由 projectTwinBindingGate 纯投影，且由服务端在
 * binding-time 强制（withdrawal 阻断新绑定与新处理）。
 */
export interface TwinConsentProjection {
  readonly policy: ConsentPolicy;
  readonly purposeStates: readonly TwinPurposeConsentState[];
  /** 新证据绑定使用的当前 ConsentReference（不可变快照）。 */
  readonly reference: ConsentReference;
}

/** 重建作业的只读视图：spec（不可变）+ 运行状态 + 终态结果。 */
export interface TwinReconstructionJobView {
  readonly spec: ReconstructionJobSpec;
  readonly status: ReconstructionJobStatus;
  readonly result: ReconstructionJobResult | null;
}

export interface TwinStudioSnapshot {
  readonly displayName: string;
  readonly twinId: OpaqueId;
  /** 版本链（最旧在前；版本号单调；记录不可变——状态迁移是记录替换）。 */
  readonly versions: readonly TwinVersion[];
  /** 当前 canonical 版本 id（无晋升时 null）。 */
  readonly canonicalVersionId: OpaqueId | null;
  /** superseded 版本 id -> 取代它的版本 id（append-only 链接）。 */
  readonly supersededBy: Readonly<Record<string, string>>;
  /** 定向补救 EvidenceRequest（W2 seam；quality 改进入口）。 */
  readonly evidenceRequests: readonly EvidenceRequest[];
  readonly consent: TwinConsentProjection;
  /** 重建作业（追加序；effortObservations 诚实标注 not-measured）。 */
  readonly jobs: readonly TwinReconstructionJobView[];
  /** append-only 事件账本投影（twin-version-* / twin-quality-assessed / reconstruction-*）。 */
  readonly events: readonly SolutionEvent[];
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class TwinStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "TwinStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Twin Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T3 换绑 Worker A 的
 * twin/reconstruction 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface TwinStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实 provider。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：twin 已存在时返回当前快照，不重建。 */
  load(request: TwinStudioLoadRequest): Promise<TwinStudioSnapshot>;
  refresh(): Promise<TwinStudioSnapshot>;

  // -- twin 版本（不可变、版本号单调；candidate -> canonical -> superseded） --
  publishFixtureVersion(input: PublishTwinVersionInput): Promise<TwinVersion>;
  promoteVersion(input: PromoteTwinVersionInput): Promise<TwinVersion>;
  /** 确定性质量重投影（journaling twin-quality-assessed；不改变已发布版本）。 */
  assessQuality(input: AssessTwinQualityInput): Promise<TwinStudioSnapshot>;

  // -- 缺陷补救（W2 seam：定向 EvidenceRequest；幂等 per deficiency key） --
  openRemediation(input: OpenRemediationInput): Promise<EvidenceRequest>;

  // -- 重建作业（provider-neutral；支持矩阵校验；诚实 effort 观察） --
  submitReconstructionJob(input: SubmitReconstructionInput): Promise<ReconstructionJobSpec>;
  startReconstructionJob(input: ReconstructionJobInput): Promise<TwinStudioSnapshot>;
  completeReconstructionJob(input: ReconstructionJobInput): Promise<ReconstructionJobResult>;
  failReconstructionJob(input: FailReconstructionInput): Promise<ReconstructionJobResult>;
  /** 从已完成作业的产出块发布下一版候选（consent re-enforced）。 */
  publishVersionFromJob(input: PublishVersionFromJobInput): Promise<TwinVersion>;

  // -- 同意（explicit / scoped / revocable / purpose-specific / binding-time 强制） --
  decideConsent(input: TwinConsentDecisionInput): Promise<TwinConsentProjection>;
  withdrawConsent(input: TwinWithdrawConsentInput): Promise<TwinConsentProjection>;
}

// ---------------------------------------------------------------------------
// 同意状态纯投影（「无许可 ⇒ 不处理」必须可见且可测）
// ---------------------------------------------------------------------------

export interface TwinBindingGate {
  readonly purpose: "twin-evidence-binding";
  readonly allowed: boolean;
  readonly state: ConsentState;
  /** 稳定原因码（UI 文案表按 reason/state 渲染；测试断言）。 */
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
 * 绑定门：仅当政策内全部用途被显式 granted 时 allowed=true。
 * withdrawn/denied/expired/unknown ⇒ allowed=false（no permission ⇒ no processing）。
 * 这是 UI 的按钮禁用投影；服务端 binding-time 强制独立存在
 * （publishFixtureVersion / publishVersionFromJob 抛 YOU_CONSENT_REQUIRED）。
 */
export function projectTwinBindingGate(consent: TwinConsentProjection): TwinBindingGate {
  const states = consent.policy.purposes.map(
    (purpose) => consent.purposeStates.find((entry) => entry.purpose === purpose)?.state ?? "unknown",
  );
  const aggregate = aggregateConsentState(states);
  return {
    purpose: "twin-evidence-binding",
    allowed: aggregate === "granted",
    state: aggregate,
    reason: aggregate,
  };
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B/W2B currentSolutionVersion / currentCaptureSession 同款模式）
// ---------------------------------------------------------------------------

/** 按版本号稳定排序的版本链（快照本身保持追加序；此处显式排序满足 FIXTURES 法则 4）。 */
export function orderedTwinVersions(
  snapshot: TwinStudioSnapshot | null,
): readonly TwinVersion[] {
  if (!snapshot) return [];
  return [...snapshot.versions].sort((a, b) =>
    a.version === b.version
      ? a.id < b.id
        ? -1
        : 1
      : a.version - b.version,
  );
}

/** 当前 canonical 版本（无晋升时 null）。 */
export function canonicalVersionOf(
  snapshot: TwinStudioSnapshot | null,
): TwinVersion | null {
  if (!snapshot) return null;
  return snapshot.versions.find((version) => version.id === snapshot.canonicalVersionId) ?? null;
}

/** 按 id 解析版本（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function twinVersionById(
  snapshot: TwinStudioSnapshot | null,
  versionId: string | null,
): TwinVersion | null {
  if (!snapshot || versionId === null) return null;
  return snapshot.versions.find((version) => version.id === versionId) ?? null;
}

/** 按提交序返回重建作业（追加序即稳定序）。 */
export function orderedReconstructionJobs(
  snapshot: TwinStudioSnapshot | null,
): readonly TwinReconstructionJobView[] {
  if (!snapshot) return [];
  return snapshot.jobs;
}
