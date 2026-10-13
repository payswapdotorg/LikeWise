// YOU Escalation Studio — EscalationStudioController 端口（W8B）。
//
// 边界（docs/you/WORK_ORDERS.md W8B / docs/you/CONTRACTS.md "Wave-8 contract
// freeze (v8)"）：
// - 本文件只定义 UI 消费的服务端口；arena 的 canonical truth 属于 Worker A 的
//   arena 权威服务（W8A：CapabilityGap 持久化 + append-only run 阶梯 +
//   ArenaRetryPolicy 校验 + EscalationAuthorization 生命周期 + provider 中立
//   Arena 客户端边界）。UI 不实现领域逻辑。
// - 端口形状镜像 W8A 服务接缝 1:1（minus 服务侧持久化/重放可观测性——T8 换绑
//   时逐方法对位，W7B 先例同款）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v8 `you/contract.ts`），禁止本地
//   重声明。
// - Phase 0 的实现是 `escalationSimulatedController.ts` 的确定性剧本；
//   TODO(T8): bind to Worker A 的 arena 服务（TL 在 T8 换绑本端口）。
// - ESCALATION AUTHORIZATION LAW：escalation 绝不在无显式、in-scope、未过期授权
//   下运行——授权记录不可变，过期/撤回生成新记录；无授权路径 typed 拒绝
//   （YOU_ESCALATION_AUTHORIZATION_REQUIRED）。
// - ARENA LEARNING PERMISSION LAW：升级派生信号进入学习机前必须有显式
//   ArenaLearningPermission（none/aggregate/full）记录在授权上（wave-6 权利法
//   延伸到 arena 边界）。
// - ARENA BOUNDARY LAW：Arena 绝不静默改写 YOU 状态——结果以 typed payload
//   （ArenaExpertResult）经 YOU 自身权威应用。
import type {
  ArenaExpertResult,
  ArenaLearningPermission,
  ArenaProviderDescriptor,
  ArenaRetryPolicy,
  ArenaRun,
  ArenaRunStatus,
  ArenaEscalationRef,
  ArenaEscalationStatus,
  CapabilityGap,
  EscalationAuthorization,
  KnowledgeGapProjection,
  OpaqueId,
  SolutionEvent,
  ToolGapProjection,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 政策）
// ---------------------------------------------------------------------------

export interface EscalationStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 记录 CapabilityGap（fixture 注册面规格挑选；gap-opened 链接到意图/策略/证据）。 */
export interface OpenCapabilityGapInput {
  readonly gapSpecId: string;
}

/** 请求 Arena 升级（gap 须 escalation-eligible；事件 arena-escalation-requested）。 */
export interface RequestEscalationInput {
  readonly gapId: OpaqueId;
}

/** 授予授权（scope/expiry/learning permission；不可变记录；撤回后可再授予）。 */
export interface GrantEscalationAuthorizationInput {
  readonly escalationId: OpaqueId;
  readonly scope: string;
  /** null = 无过期；ISO-8601 字面量（fixture 预设）。 */
  readonly expiresAt: string | null;
  readonly learningPermission: ArenaLearningPermission;
}

/** 撤回授权（新账本记录——supersedes 撤回项；live 门随之 fail closed）。 */
export interface WithdrawEscalationAuthorizationInput {
  readonly authorizationId: OpaqueId;
}

/** 启动 arena run（授权门最先；policy.requiresAuthorization 强制；run 阶梯追加）。 */
export interface StartArenaRunInput {
  readonly escalationId: OpaqueId;
  /** 尝试策略标签（fixture 注册面；缺省取剧本策略）。 */
  readonly strategy?: string;
}

/** 完成 arena run（started → completed | failed | aborted 终态锁定）。 */
export interface CompleteArenaRunInput {
  readonly runId: OpaqueId;
  readonly outcome: Exclude<ArenaRunStatus, "started">;
}

/** 经 provider 中立客户端边界调用 Arena（fail closed：未知 provider typed 拒绝）。 */
export interface InvokeArenaProviderInput {
  readonly escalationId: OpaqueId;
  readonly providerId: string;
}

/** 应用专家结果（delivered → applied；applies-as-changeset 投射意图）。 */
export interface ApplyExpertResultInput {
  readonly escalationId: OpaqueId;
}

/** 拒绝专家结果（delivered → rejected 终态）。 */
export interface RejectExpertResultInput {
  readonly escalationId: OpaqueId;
  readonly reason: string;
}

/** 取消升级（非终态 → cancelled；活跃 run 以 aborted 落账）。 */
export interface CancelEscalationInput {
  readonly escalationId: OpaqueId;
}

/** ArenaRetryPolicy 校验（W8A stateless validator 接缝的端口形状）。 */
export interface ValidateRetryPolicyInput {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly eligibilityCategories: readonly string[];
  readonly requiresAuthorization: boolean;
}

/** 发布 gap 投影（ToolGap / KnowledgeGap；投影派生非权威）。 */
export interface PublishGapProjectionInput {
  readonly gapId: OpaqueId;
  readonly kind: "tool" | "knowledge";
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** 升级的服务端投影（v1 ArenaEscalationRef 语义的展开视图 + requiredScope）。 */
export interface EscalationView {
  readonly escalationId: OpaqueId;
  readonly gapId: OpaqueId;
  readonly status: ArenaEscalationStatus;
  readonly minimumContext: readonly string[];
  readonly expertResult: ArenaExpertResult | null;
  /** in-scope 判定的授权范围（来自 gap 记录；不可变）。 */
  readonly requiredScope: string;
  readonly createdAt: string;
  /** delivered → rejected 时的拒绝原因；其余 null。 */
  readonly rejectionReason: string | null;
}

/**
 * 授权账本条目（append-only：grant 与 withdrawal 都是新记录——ESCALATION
 * AUTHORIZATION LAW「过期与撤回生成新记录，绝不原地改写」的端口级呈现。frozen
 * EscalationAuthorization 形状保持不动；kind/supersedes 链接是账本语义（W6B
 * supersededById 链接同款先例）。
 */
export interface EscalationAuthorizationEntry {
  readonly record: EscalationAuthorization;
  readonly kind: "grant" | "withdrawal";
  /** withdrawal → 被撤回的 grant 记录 id；grant → null。 */
  readonly supersedesRecordId: string | null;
}

/** live 授权事实（服务端投影；UI 门显示的数据源——服务端独立强制）。 */
export interface EscalationAuthorizationLive {
  readonly escalationId: OpaqueId;
  /** 最新未被撤回的 grant；无任何 grant ⇒ null。 */
  readonly record: EscalationAuthorization | null;
  /** live grant 是否已被撤回记录 supersede。 */
  readonly withdrawn: boolean;
  readonly learningPermission: ArenaLearningPermission;
}

/** record-gap fixture 动作的注册面规格视图。 */
export interface EscalationGapSpecView {
  readonly id: string;
  readonly category: string;
  readonly confidence: number;
  readonly suggestedNextAction: string;
  readonly strategyCount: number;
  readonly eligible: boolean;
}

export interface EscalationStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 escalation 表面）。 */
  readonly studioId: OpaqueId;
  /** gap 分类学（frozen 七类全集）。 */
  readonly categories: readonly string[];
  /** learning permission 分类学（frozen none/aggregate/full）。 */
  readonly learningPermissions: readonly ArenaLearningPermission[];
  /** 授权范围预设（in-scope 精确匹配的挑选面）。 */
  readonly scopePresets: readonly string[];
  /** backoff class 分类学（policy 校验的数据源）。 */
  readonly backoffClasses: readonly string[];
  /** live 重试策略（run 阶梯的边界权威）。 */
  readonly retryPolicy: ArenaRetryPolicy;
  /** provider 注册面（引用不透明；fail closed）。 */
  readonly providers: readonly ArenaProviderDescriptor[];
  /** gap 规格注册面（record-gap fixture 动作的数据源）。 */
  readonly gapSpecs: readonly EscalationGapSpecView[];
  /** gap 账本（不可变记录；id 升序）。 */
  readonly gaps: readonly CapabilityGap[];
  /** run 阶梯（append-only；gapId+attempt 升序）。 */
  readonly runs: readonly ArenaRun[];
  /** 升级投影（id 升序）。 */
  readonly escalations: readonly EscalationView[];
  /** 授权账本（append-only；追加序）。 */
  readonly authorizationLedger: readonly EscalationAuthorizationEntry[];
  /** live 授权投影（每 escalation 一条；无授权亦在列——显示面完整）。 */
  readonly liveAuthorizations: readonly EscalationAuthorizationLive[];
  /** ToolGap 投影（派生非权威；发布序）。 */
  readonly toolProjections: readonly ToolGapProjection[];
  /** KnowledgeGap 投影（派生非权威；发布序）。 */
  readonly knowledgeProjections: readonly KnowledgeGapProjection[];
  /** append-only 事件账本投影（v1 arena-* + wave-8 五事件）。 */
  readonly events: readonly SolutionEvent[];
  /** 服务端投影时刻（live 门过期比较的时钟事实；确定性——非 UI 本地时钟）。 */
  readonly projectedAt: string;
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class EscalationStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "EscalationStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Escalation Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T8 换绑 Worker A
 * 的 arena 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface EscalationStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实 arena。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：escalation 平面已存在时返回当前快照，不重建。 */
  load(request: EscalationStudioLoadRequest): Promise<EscalationStudioSnapshot>;
  refresh(): Promise<EscalationStudioSnapshot>;

  // -- gap 平面（GAP PERSISTENCE LAW：记录不可变；run 阶梯 append-only） --
  /** 记录 gap（事件 capability-gap-detected；规格形状校验最先）。 */
  openCapabilityGap(input: OpenCapabilityGapInput): Promise<CapabilityGap>;

  // -- 升级生命周期（v1 阶梯：requested -> authorized -> in-progress ->
  //    delivered -> applied | rejected | cancelled） --
  /** 请求升级（事件 arena-escalation-requested；未达资格 ⇒ typed 拒绝）。 */
  requestEscalation(
    input: RequestEscalationInput,
  ): Promise<{ readonly escalation: EscalationView; readonly gap: CapabilityGap }>;
  /** 授予授权（事件 escalation-authorized + learning-permission-recorded）。 */
  grantAuthorization(
    input: GrantEscalationAuthorizationInput,
  ): Promise<{ readonly entry: EscalationAuthorizationEntry; readonly escalation: EscalationView }>;
  /** 撤回授权（新 withdrawal 记录；事件 learning-permission-recorded）。 */
  withdrawAuthorization(
    input: WithdrawEscalationAuthorizationInput,
  ): Promise<EscalationAuthorizationEntry>;

  // -- arena run 阶梯（append-only；终态锁定） --
  /** 启动 run（授权门最先 ⇒ YOU_ESCALATION_AUTHORIZATION_REQUIRED；事件
   *  arena-run-recorded；attempt 超界 ⇒ YOU_RETRY_POLICY_INVALID）。 */
  startArenaRun(
    input: StartArenaRunInput,
  ): Promise<{ readonly run: ArenaRun; readonly escalation: EscalationView }>;
  /** 完成 run（事件 arena-run-recorded；未知 run ⇒ YOU_ARENA_RUN_NOT_FOUND）。 */
  completeArenaRun(input: CompleteArenaRunInput): Promise<ArenaRun>;

  // -- provider 中立客户端边界（fail closed；ARENA BOUNDARY LAW） --
  /** 调用 Arena provider（未知 provider ⇒ YOU_ARENA_ADAPTER_UNSUPPORTED；返回
   *  typed ArenaExpertResult——in-progress → delivered；活跃 run completed）。 */
  invokeArenaProvider(
    input: InvokeArenaProviderInput,
  ): Promise<{
    readonly result: ArenaExpertResult;
    readonly escalation: EscalationView;
    readonly run: ArenaRun;
  }>;

  // -- 专家结果审阅（applies-as-changeset 投射意图） --
  /** 应用结果（事件 arena-result-applied；appliesAsChangeSetId 派生确定）。 */
  applyExpertResult(
    input: ApplyExpertResultInput,
  ): Promise<{ readonly escalation: EscalationView; readonly gap: CapabilityGap }>;
  /** 拒绝结果（delivered → rejected 终态；服务端状态——frozen 事件词汇无
   *  escalation-rejected 类型，与 W6B candidate 前置状态同款披露）。 */
  rejectExpertResult(input: RejectExpertResultInput): Promise<EscalationView>;
  /** 取消升级（事件 escalation-cancelled；活跃 run 以 aborted 落账）。 */
  cancelEscalation(
    input: CancelEscalationInput,
  ): Promise<{ readonly escalation: EscalationView; readonly gap: CapabilityGap }>;

  // -- 重试策略校验（W8A stateless validator 接缝镜像） --
  /** 校验 policy 草稿（违例 ⇒ YOU_RETRY_POLICY_INVALID；不落账——纯校验）。 */
  validateRetryPolicy(input: ValidateRetryPolicyInput): Promise<ArenaRetryPolicy>;

  // -- gap 投影（派生非权威；事件 gap-projection-published） --
  /** 发布投影（malformed 请求 ⇒ YOU_GAP_PROJECTION_INVALID；绝不猜测补全）。 */
  publishGapProjection(
    input: PublishGapProjectionInput,
  ): Promise<{
    readonly kind: "tool" | "knowledge";
    readonly tool: ToolGapProjection | null;
    readonly knowledge: KnowledgeGapProjection | null;
  }>;
}

// ---------------------------------------------------------------------------
// 授权门纯投影（「无授权 ⇒ 不运行」必须可见且可测；UI 显示面——服务端独立强制）
// ---------------------------------------------------------------------------

export interface EscalationAuthorizationGateView {
  readonly allowed: boolean;
  readonly reason: "granted" | "missing" | "withdrawn" | "expired" | "scope-mismatch";
}

/** live 授权投影 + escalation 要求 → 门视图（求值固定序；fail closed）。 */
export function projectEscalationAuthorizationGate(
  live: EscalationAuthorizationLive | null,
  requiredScope: string,
  now: string,
): EscalationAuthorizationGateView {
  if (!live || live.record === null) return { allowed: false, reason: "missing" };
  if (live.withdrawn) return { allowed: false, reason: "withdrawn" };
  if (
    live.record.expiresAt !== null &&
    Date.parse(live.record.expiresAt) <= Date.parse(now)
  ) {
    return { allowed: false, reason: "expired" };
  }
  if (live.record.scope !== requiredScope) return { allowed: false, reason: "scope-mismatch" };
  return { allowed: true, reason: "granted" };
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B–W7B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** gap 列表（id 升序；ledger read 语义）。 */
export function orderedEscalationGaps(
  snapshot: EscalationStudioSnapshot | null,
): readonly CapabilityGap[] {
  if (!snapshot) return [];
  return snapshot.gaps;
}

/** 按 id 解析 gap（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function escalationGapById(
  snapshot: EscalationStudioSnapshot | null,
  gapId: string | null,
): CapabilityGap | null {
  if (!snapshot || gapId === null) return null;
  return snapshot.gaps.find((gap) => gap.id === gapId) ?? null;
}

/** 升级列表（id 升序）。 */
export function orderedEscalations(
  snapshot: EscalationStudioSnapshot | null,
): readonly EscalationView[] {
  if (!snapshot) return [];
  return snapshot.escalations;
}

/** 按 id 解析升级（未知 id → null）。 */
export function escalationById(
  snapshot: EscalationStudioSnapshot | null,
  escalationId: string | null,
): EscalationView | null {
  if (!snapshot || escalationId === null) return null;
  return snapshot.escalations.find((entry) => entry.escalationId === escalationId) ?? null;
}

/** 某 gap 的升级（未升级 → null）。 */
export function escalationOfGap(
  snapshot: EscalationStudioSnapshot | null,
  gapId: string | null,
): EscalationView | null {
  if (!snapshot || gapId === null) return null;
  return snapshot.escalations.find((entry) => entry.gapId === gapId) ?? null;
}

/** 某 gap 的 run 阶梯（追加序）。 */
export function runsOfGap(
  snapshot: EscalationStudioSnapshot | null,
  gapId: string | null,
): readonly ArenaRun[] {
  if (!snapshot || gapId === null) return [];
  return snapshot.runs.filter((run) => run.gapId === gapId);
}

/** 按 id 解析 run（未知 id → null）。 */
export function arenaRunById(
  snapshot: EscalationStudioSnapshot | null,
  runId: string | null,
): ArenaRun | null {
  if (!snapshot || runId === null) return null;
  return snapshot.runs.find((run) => run.id === runId) ?? null;
}

/** 某 escalation 的授权账本（追加序）。 */
export function authorizationLedgerOfEscalation(
  snapshot: EscalationStudioSnapshot | null,
  escalationId: string | null,
): readonly EscalationAuthorizationEntry[] {
  if (!snapshot || escalationId === null) return [];
  return snapshot.authorizationLedger.filter(
    (entry) => entry.record.escalationId === escalationId,
  );
}

/** 某 escalation 的 live 授权投影（无 → null）。 */
export function liveAuthorizationOfEscalation(
  snapshot: EscalationStudioSnapshot | null,
  escalationId: string | null,
): EscalationAuthorizationLive | null {
  if (!snapshot || escalationId === null) return null;
  return (
    snapshot.liveAuthorizations.find((entry) => entry.escalationId === escalationId) ?? null
  );
}

/** gap 的 v1 ArenaEscalationRef（gap 记录内嵌的升级引用；未升级 → null）。 */
export function arenaEscalationRefOfGap(
  gap: CapabilityGap | null,
): ArenaEscalationRef | null {
  return gap?.arenaEscalationRef ?? null;
}
