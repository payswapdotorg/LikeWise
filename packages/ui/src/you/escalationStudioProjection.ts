/* eslint-disable max-lines -- 升级工作室视图纯投影（W8B）：v1 状态阶梯 + 授权门 + gap/run 派生视图的确定性数学集中一处（同一投影不变式跨表面复用）；拆分会复制派生规则并破坏投影单一来源。 */
// YOU Escalation Studio — 视图纯投影（W8B）。
//
// 只做确定性视图数学：v1 升级状态阶梯（requested → authorized → in-progress →
// delivered → applied | rejected | cancelled——current 来自服务端投影头，visited 由
// 该升级的事件流派生：arena-escalation-requested / escalation-authorized /
// arena-run-recorded / arena-result-applied / escalation-cancelled 标记档位；
// delivered/rejected 无 frozen 事件类型——以投影事实（专家结果已交付/终态）标记，
// 与 W7B 具身阶梯同款「投影 + 事件流」语义，绝非 UI 本地状态）、gap 显示行
//（分类/置信度/尝试策略/失败证据链接——内容寻址标签，绝不内联）、专家结果审阅行
//（typed-payload/artifact/guidance；artifact 内容寻址标签；applies-as-changeset）、
// run 阶梯行、授权账本行（grant/withdrawal 不可变记录）、learning-permission 显示行
//（wave-6 权利法显示模式的 arena 边界延伸）、ToolGap/Knowledge 投影行、授权草稿与
// policy 草稿视图模型、区域 loading/empty 视图模型、键盘转移（与兄弟表面同级的
// 键盘可用性）。无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type {
  ArenaEscalationStatus,
  ArenaExpertResult,
  ArenaRun,
  ArenaLearningPermission,
  AttemptedStrategy,
  CapabilityGap,
  SolutionEvent,
} from "@zcode/shared";
import type {
  EscalationAuthorizationEntry,
  EscalationAuthorizationLive,
  EscalationGapSpecView,
  EscalationView,
} from "./escalationController.js";

// ---------------------------------------------------------------------------
// 升级状态阶梯（v1 ArenaEscalationStatus；visited 派生自事件流——非 UI 本地状态）
// ---------------------------------------------------------------------------

export interface EscalationLadderStep {
  readonly status: ArenaEscalationStatus;
  readonly reached: boolean;
  readonly current: boolean;
  /** 终态档（applied / rejected / cancelled 互斥；到达即锁定）。 */
  readonly terminal: boolean;
  /** 标记该档位的事件时刻（事件携带时）；仅由投影事实标记的档位为 null。 */
  readonly at: string | null;
}

const ESCALATION_LADDER_ORDER: readonly ArenaEscalationStatus[] = [
  "requested",
  "authorized",
  "in-progress",
  "delivered",
  "applied",
  "rejected",
  "cancelled",
];

const ESCALATION_LADDER_TERMINALS: readonly ArenaEscalationStatus[] = [
  "applied",
  "rejected",
  "cancelled",
];

/**
 * 状态阶梯投影：current 标记投影头（服务端事实）；visited 由该升级的事件流派生
 * （每档首个标记事件的时刻）。delivered/rejected 无 frozen 事件类型——以投影事实
 * 标记：专家结果已交付（expertResult ≠ null ⇒ delivered 已过）、当前终态 rejected
 * ⇒ rejected 已过（服务端终态披露——与 W6B candidate 前置状态同款，不伪造事件）。
 */
export function projectEscalationLadder(
  escalation: {
    readonly status: ArenaEscalationStatus;
    readonly expertResult: ArenaExpertResult | null;
  },
  events: readonly SolutionEvent[],
  escalationId: string,
): readonly EscalationLadderStep[] {
  const visited = new Map<ArenaEscalationStatus, string>();
  const mark = (status: ArenaEscalationStatus, at: string): void => {
    if (!visited.has(status)) visited.set(status, at);
  };
  for (const event of events) {
    if (event.payload.escalationId !== escalationId) continue;
    switch (event.type) {
      case "arena-escalation-requested":
        mark("requested", event.occurredAt);
        break;
      case "escalation-authorized":
        mark("authorized", event.occurredAt);
        break;
      case "arena-run-recorded":
        // run 启动即 in-progress 档的标记事件（授权后首次 run 转入 in-progress）。
        mark("in-progress", event.occurredAt);
        break;
      case "arena-result-applied":
        mark("applied", event.occurredAt);
        break;
      case "escalation-cancelled":
        mark("cancelled", event.occurredAt);
        break;
      default:
        break;
    }
  }
  // 投影事实标记（无事件类型的档位；事件已标记的档位不覆盖——时刻以事件为准）。
  if (escalation.expertResult !== null) {
    mark("delivered", escalation.expertResult.deliveredAt);
  }
  if (escalation.status === "delivered") {
    mark("delivered", "");
  }
  if (escalation.status === "rejected") {
    mark("rejected", "");
  }
  // 创建档兜底（请求事件缺失时以投影头标记——防御，不猜时间）；当前档恒已过。
  mark("requested", "");
  mark(escalation.status, "");
  return ESCALATION_LADDER_ORDER.map((status) => ({
    status,
    reached: visited.has(status),
    current: status === escalation.status,
    terminal: ESCALATION_LADDER_TERMINALS.includes(status),
    at: visited.get(status) ?? null,
  }));
}

/** 已到达的过程档数（visited 计数——阶梯进度的确定性度量）。 */
export function ladderVisitedCount(steps: readonly EscalationLadderStep[]): number {
  return steps.filter((step) => step.reached).length;
}

// ---------------------------------------------------------------------------
// Gap 显示行（category / confidence / attempted strategies / failure-evidence
// 链接——内容寻址标签，绝不内联内容）
// ---------------------------------------------------------------------------

export interface GapRow {
  readonly gapId: string;
  readonly category: string;
  readonly confidence: number;
  readonly strategyCount: number;
  readonly evidenceCount: number;
  readonly eligibility: string;
  readonly escalationId: string | null;
  readonly escalationStatus: ArenaEscalationStatus | null;
  readonly suggestedNextAction: string;
  readonly accessibleLabel: string;
}

/** gaps → 显示行（id 升序；升级引用来自 gap 记录内嵌的 v1 ArenaEscalationRef）。 */
export function projectGapRows(gaps: readonly CapabilityGap[]): readonly GapRow[] {
  return gaps.map((gap) => ({
    gapId: gap.id,
    category: gap.category,
    confidence: gap.confidence,
    strategyCount: gap.attemptedStrategies.length,
    evidenceCount: gap.failureEvidence.length,
    eligibility: gap.escalationEligibility,
    escalationId: gap.arenaEscalationRef?.escalationId ?? null,
    escalationStatus: gap.arenaEscalationRef?.status ?? null,
    suggestedNextAction: gap.suggestedNextAction,
    accessibleLabel: `gap ${gap.id}: ${gap.category} at confidence ${gap.confidence}, ${gap.attemptedStrategies.length} attempted strategies, ${gap.failureEvidence.length} content-addressed failure-evidence refs${gap.arenaEscalationRef !== null ? `, escalated ${gap.arenaEscalationRef.escalationId} (${gap.arenaEscalationRef.status})` : ""}`,
  }));
}

export interface GapStrategyRow {
  readonly index: number;
  readonly strategy: string;
  readonly outcome: string;
  readonly evidenceRef: string | null;
  readonly accessibleLabel: string;
}

/** 尝试策略行（v1 语义：升级前记录尝试过的方法与证据）。 */
export function projectGapStrategyRows(
  strategies: readonly AttemptedStrategy[],
): readonly GapStrategyRow[] {
  return strategies.map((entry, index) => ({
    index,
    strategy: entry.strategy,
    outcome: entry.outcome,
    evidenceRef: entry.evidenceRef,
    accessibleLabel: `strategy ${index + 1}: ${entry.strategy} (${entry.outcome})${entry.evidenceRef !== null ? `, evidence ${entry.evidenceRef}` : ""}`,
  }));
}

export interface GapEvidenceRow {
  readonly index: number;
  readonly evidenceRef: string;
  readonly accessibleLabel: string;
}

/** 失败证据链接行（内容寻址标签——证据真相在来源平面）。 */
export function projectGapEvidenceRows(
  evidenceRefs: readonly string[],
): readonly GapEvidenceRow[] {
  return evidenceRefs.map((evidenceRef, index) => ({
    index,
    evidenceRef,
    accessibleLabel: `failure evidence ${index + 1}: ${evidenceRef}`,
  }));
}

/** record-gap fixture 动作的规格挑选选项（数据源：快照 gapSpecs 注册面投影）。 */
export interface GapSpecOption {
  readonly specId: string;
  readonly category: string;
  readonly confidence: number;
  readonly eligible: boolean;
  readonly label: string;
}

export function projectGapSpecOptions(
  gapSpecs: readonly EscalationGapSpecView[],
): readonly GapSpecOption[] {
  return gapSpecs.map((spec) => ({
    specId: spec.id,
    category: spec.category,
    confidence: spec.confidence,
    eligible: spec.eligible,
    label: `${spec.category} · ${spec.confidence}`,
  }));
}

// ---------------------------------------------------------------------------
// 专家结果审阅行（typed-payload / artifact / guidance；内容寻址 artifact 标签；
// applies-as-changeset 投射意图）
// ---------------------------------------------------------------------------

export interface ExpertResultPayloadRow {
  readonly key: string;
  readonly value: string;
  readonly accessibleLabel: string;
}

export interface ExpertResultView {
  readonly escalationId: string;
  readonly resultType: ArenaExpertResult["resultType"];
  readonly deliveredAt: string;
  /** payload 条目（键升序——稳定显示序）。 */
  readonly payloadRows: readonly ExpertResultPayloadRow[];
  /** artifact 结果的内容寻址标签（ref + hash）；非 artifact 结果为 null。 */
  readonly artifactRef: string | null;
  readonly artifactHash: string | null;
  /** delivered → applied 时派生的 applies-as-changeset id；未应用为 null。 */
  readonly appliesAsChangeSetId: string | null;
  readonly accessibleLabel: string;
}

/** ArenaExpertResult → 审阅视图（ARENA BOUNDARY LAW 的可见面：typed payload）。 */
export function projectExpertResultView(
  escalation: EscalationView,
): ExpertResultView | null {
  const result = escalation.expertResult;
  if (result === null) return null;
  const payloadRows = Object.entries(result.payload)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => ({
      key,
      value: String(value),
      accessibleLabel: `${key}: ${String(value)}`,
    }));
  const artifactRef =
    typeof result.payload.artifactRef === "string" ? result.payload.artifactRef : null;
  const artifactHash =
    typeof result.payload.artifactHash === "string" ? result.payload.artifactHash : null;
  return {
    escalationId: escalation.escalationId,
    resultType: result.resultType,
    deliveredAt: result.deliveredAt,
    payloadRows,
    artifactRef,
    artifactHash,
    appliesAsChangeSetId: result.appliesAsChangeSetId,
    accessibleLabel: `expert result for ${escalation.escalationId}: ${result.resultType} delivered ${result.deliveredAt}${artifactRef !== null ? `, artifact ${artifactRef} (${artifactHash})` : ""}${result.appliesAsChangeSetId !== null ? `, applies as changeset ${result.appliesAsChangeSetId}` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Run 阶梯行（append-only；started → completed | failed | aborted 终态锁定）
// ---------------------------------------------------------------------------

export interface ArenaRunRow {
  readonly runId: string;
  readonly gapId: string;
  readonly strategy: string;
  readonly attempt: number;
  readonly status: ArenaRun["status"];
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly outcomeEvidenceRef: string | null;
  readonly accessibleLabel: string;
}

export function projectArenaRunRows(runs: readonly ArenaRun[]): readonly ArenaRunRow[] {
  return runs.map((run) => ({
    runId: run.id,
    gapId: run.gapId,
    strategy: run.strategy,
    attempt: run.attempt,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    outcomeEvidenceRef: run.outcomeEvidenceRef,
    accessibleLabel: `run ${run.id}: attempt ${run.attempt} (${run.strategy}) on gap ${run.gapId}, ${run.status}${run.completedAt !== null ? ` at ${run.completedAt}` : ""}${run.outcomeEvidenceRef !== null ? `, outcome evidence ${run.outcomeEvidenceRef}` : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// 授权账本行（grant/withdrawal 不可变记录；live 标记 + 撤回链接）
// ---------------------------------------------------------------------------

export interface AuthorizationRow {
  readonly authorizationId: string;
  readonly escalationId: string;
  readonly kind: "grant" | "withdrawal";
  readonly scope: string;
  readonly grantedAt: string;
  readonly expiresAt: string | null;
  readonly learningPermission: ArenaLearningPermission;
  readonly supersedesRecordId: string | null;
  /** 该 grant 是当前 live 授权（未被撤回）。 */
  readonly live: boolean;
  /** 该 grant 已被 withdrawal 记录撤回。 */
  readonly withdrawn: boolean;
  readonly accessibleLabel: string;
}

/** 账本 → 显示行（追加序；live/withdrawn 由 live 投影标记——服务端事实）。 */
export function projectAuthorizationRows(
  ledger: readonly EscalationAuthorizationEntry[],
  live: EscalationAuthorizationLive | null,
): readonly AuthorizationRow[] {
  const supersededIds = new Set(
    ledger
      .filter((entry) => entry.kind === "withdrawal")
      .map((entry) => entry.supersedesRecordId),
  );
  return ledger.map((entry) => {
    const isLive =
      entry.kind === "grant" &&
      live !== null &&
      live.record !== null &&
      live.record.id === entry.record.id &&
      !live.withdrawn;
    const isWithdrawn =
      entry.kind === "grant" && supersededIds.has(entry.record.id);
    return {
      authorizationId: entry.record.id,
      escalationId: entry.record.escalationId,
      kind: entry.kind,
      scope: entry.record.scope,
      grantedAt: entry.record.grantedAt,
      expiresAt: entry.record.expiresAt,
      learningPermission: entry.record.learningPermission,
      supersedesRecordId: entry.supersedesRecordId,
      live: isLive,
      withdrawn: isWithdrawn,
      accessibleLabel: `${entry.kind} ${entry.record.id} on ${entry.record.escalationId}: scope ${entry.record.scope}, learning permission ${entry.record.learningPermission}, granted ${entry.record.grantedAt}${entry.record.expiresAt !== null ? `, expires ${entry.record.expiresAt}` : " (no expiry)"}${isLive ? ", live" : ""}${isWithdrawn ? ", withdrawn" : ""}${entry.supersedesRecordId !== null ? `, supersedes ${entry.supersedesRecordId}` : ""}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Learning-permission 显示行（wave-6 权利法显示模式的 arena 边界延伸：
// 「无许可 ⇒ 不派生」必须可见且可测）
// ---------------------------------------------------------------------------

export interface LearningPermissionRow {
  readonly escalationId: string;
  readonly livePermission: ArenaLearningPermission;
  readonly withdrawn: boolean;
  readonly scope: string;
  readonly expiresAt: string | null;
  readonly grantedAt: string | null;
  readonly recordId: string | null;
  readonly accessibleLabel: string;
}

/** live 授权投影 → learning-permission 显示行（每升级一行；无授权亦在列）。 */
export function projectLearningPermissionRows(
  escalations: readonly EscalationView[],
  liveAuthorizations: readonly EscalationAuthorizationLive[],
): readonly LearningPermissionRow[] {
  return escalations.map((escalation) => {
    const live =
      liveAuthorizations.find((entry) => entry.escalationId === escalation.escalationId) ??
      null;
    return {
      escalationId: escalation.escalationId,
      livePermission: live?.learningPermission ?? "none",
      withdrawn: live?.withdrawn ?? false,
      scope: live?.record?.scope ?? "",
      expiresAt: live?.record?.expiresAt ?? null,
      grantedAt: live?.record?.grantedAt ?? null,
      recordId: live?.record?.id ?? null,
      accessibleLabel: `escalation ${escalation.escalationId}: learning permission ${live?.learningPermission ?? "none"}${live?.withdrawn ?? false ? " (withdrawn)" : ""}${live?.record != null ? ` under ${live.record.id} (scope ${live.record.scope})` : " (no authorization)"}`,
    };
  });
}

// ---------------------------------------------------------------------------
// ToolGap / KnowledgeGap 投影行（派生非权威；内容寻址标签）
// ---------------------------------------------------------------------------

export interface ToolProjectionRow {
  readonly gapId: string;
  readonly toolId: string;
  readonly requiredCapability: string;
  readonly remediation: string;
  readonly accessibleLabel: string;
}

export function projectToolProjectionRows(
  projections: readonly {
    readonly gapId: string;
    readonly toolId: string | null;
    readonly requiredCapability: string;
    readonly remediation: string;
  }[],
): readonly ToolProjectionRow[] {
  return projections.map((projection) => ({
    gapId: projection.gapId,
    toolId: projection.toolId ?? "",
    requiredCapability: projection.requiredCapability,
    remediation: projection.remediation,
    accessibleLabel: `tool gap projection for ${projection.gapId}: tool ${projection.toolId ?? "none"}, requires ${projection.requiredCapability}, remediation ${projection.remediation}`,
  }));
}

export interface KnowledgeProjectionRow {
  readonly gapId: string;
  readonly domain: string;
  readonly missingKnowledgeRef: string | null;
  readonly remediation: string;
  readonly accessibleLabel: string;
}

export function projectKnowledgeProjectionRows(
  projections: readonly {
    readonly gapId: string;
    readonly domain: string;
    readonly missingKnowledgeRef: string | null;
    readonly remediation: string;
  }[],
): readonly KnowledgeProjectionRow[] {
  return projections.map((projection) => ({
    gapId: projection.gapId,
    domain: projection.domain,
    missingKnowledgeRef: projection.missingKnowledgeRef,
    remediation: projection.remediation,
    accessibleLabel: `knowledge gap projection for ${projection.gapId}: domain ${projection.domain}${projection.missingKnowledgeRef !== null ? `, missing ${projection.missingKnowledgeRef}` : ""}, remediation ${projection.remediation}`,
  }));
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type EscalationRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectListRegionView(
  hasSnapshot: boolean,
  count: number,
): EscalationRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/Twin/Performance/Editing/Learning/Avatar 表面
// 一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type EscalationListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * 升级列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前升级（检视详情）；
 * - 其余键 no-op。
 */
export function resolveEscalationKeyboardTransition(
  key: string,
  state: { readonly totalEscalations: number },
): EscalationListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalEscalations };
    case "End":
      return { kind: "move", delta: state.totalEscalations };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** 升级光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampEscalationIndex(index: number, totalEscalations: number): number {
  if (totalEscalations <= 0) return 0;
  return Math.min(totalEscalations - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 授权草稿视图（scope / expiry 预设 / learning permission 挑选的纯视图模型）
// ---------------------------------------------------------------------------

export type AuthorizationExpiryPresetId = "no-expiry" | "future" | "past";

export interface AuthorizationDraftView {
  readonly scope: string | null;
  readonly expiryPresetId: AuthorizationExpiryPresetId;
  readonly learningPermission: ArenaLearningPermission | null;
  /** 授权按钮禁用原因（null = 可授予）。 */
  readonly disabledReason:
    | "no-escalation"
    | "escalation-closed"
    | "no-scope"
    | "no-permission"
    | null;
}

/** 草稿 + 升级状态 → 确认区视图模型（禁用原因确定性固定序）。 */
export function projectAuthorizationDraftView(
  draft: {
    readonly scope: string | null;
    readonly expiryPresetId: AuthorizationExpiryPresetId;
    readonly learningPermission: ArenaLearningPermission | null;
  },
  escalation: { readonly status: ArenaEscalationStatus } | null,
): AuthorizationDraftView {
  let disabledReason: AuthorizationDraftView["disabledReason"] = null;
  if (escalation === null) {
    disabledReason = "no-escalation";
  } else if (
    escalation.status === "delivered" ||
    escalation.status === "applied" ||
    escalation.status === "rejected" ||
    escalation.status === "cancelled"
  ) {
    disabledReason = "escalation-closed";
  } else if (draft.scope === null) {
    disabledReason = "no-scope";
  } else if (draft.learningPermission === null) {
    disabledReason = "no-permission";
  }
  return { ...draft, disabledReason };
}

// ---------------------------------------------------------------------------
// Policy 草稿视图（W8A stateless validator 的 UI 挑选面）
// ---------------------------------------------------------------------------

export interface RetryPolicyDraftView {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly requiresAuthorization: boolean;
}

export function projectRetryPolicyDraftView(draft: {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly requiresAuthorization: boolean;
}): RetryPolicyDraftView {
  return {
    maxAttempts: Number.isFinite(draft.maxAttempts) ? draft.maxAttempts : 0,
    backoffClass: draft.backoffClass,
    requiresAuthorization: draft.requiresAuthorization,
  };
}
