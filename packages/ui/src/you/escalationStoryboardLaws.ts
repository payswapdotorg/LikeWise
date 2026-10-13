// YOU Escalation Studio — W8B 剧本法则（无状态校验器 + 法则评估器）。
//
// 从 `escalationStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与 W4B-W7B
// 的 laws 拆分同款先例）：本文件承载 W8A arena 服务语义的 UI 侧镜像——
// authorization intake 校验 / live 授权门评估（ESCALATION AUTHORIZATION LAW）/
// escalation 阶梯转移表（v1 ArenaEscalationStatus） / ArenaRetryPolicy 校验 /
// gap 投影请求校验。全部无状态、无随机（FIXTURES 法则 1/2；expiry 语义比较由
// 调用方传入时钟事实——校验器自身无时钟）；契约类型一律从 `@zcode/shared`
// 导入（frozen v8）。
import type {
  ArenaEscalationStatus,
  CapabilityGap,
  CapabilityGapCategory,
} from "@zcode/shared";
import {
  ESCALATION_STORYBOARD_BACKOFF_CLASSES,
  ESCALATION_STORYBOARD_CATEGORIES,
  ESCALATION_STORYBOARD_LEARNING_PERMISSIONS,
} from "./escalationStoryboard.js";

// ---------------------------------------------------------------------------
// Escalation 阶梯转移表（v1 ArenaEscalationStatus：
// requested -> authorized -> in-progress -> delivered -> applied | rejected |
// cancelled；applied/rejected/cancelled 终态锁定）
// ---------------------------------------------------------------------------

const ESCALATION_TRANSITIONS: Readonly<Record<ArenaEscalationStatus, readonly ArenaEscalationStatus[]>> =
  {
    requested: ["authorized", "cancelled"],
    authorized: ["in-progress", "cancelled"],
    "in-progress": ["delivered", "cancelled"],
    delivered: ["applied", "rejected", "cancelled"],
    applied: [],
    rejected: [],
    cancelled: [],
  };

/** 终态集（append-only 语义：到达即锁定）。 */
export const ESCALATION_TERMINAL_STATUSES: readonly ArenaEscalationStatus[] = [
  "applied",
  "rejected",
  "cancelled",
];

export function isTerminalStoryboardEscalationStatus(
  status: ArenaEscalationStatus,
): boolean {
  return ESCALATION_TERMINAL_STATUSES.includes(status);
}

/** 阶梯转移合法性（W8A 转移表镜像；非法迁移 ⇒ YOU_ESCALATION_STATE_INVALID）。 */
export function isLegalStoryboardEscalationTransition(
  from: ArenaEscalationStatus,
  to: ArenaEscalationStatus,
): boolean {
  return ESCALATION_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Authorization intake（授权记录形状；ESCALATION AUTHORIZATION LAW：授权是显式、
// in-scope、未过期的不可变记录——过期与撤回生成新记录，绝不原地改写）
// ---------------------------------------------------------------------------

export type StoryboardAuthorizationViolationReason =
  | "empty-scope"
  | "invalid-learning-permission"
  | "invalid-expiry";

export interface StoryboardAuthorizationViolation {
  readonly reason: StoryboardAuthorizationViolationReason;
  readonly detail: string;
}

/**
 * 授权记录形状不变量（W8A grant 校验镜像）：
 * - scope 非空字符串（in-scope 匹配由 live 门评估，非形状校验）；
 * - learningPermission ∈ frozen {none, aggregate, full}；
 * - expiresAt：null 或可解析的 ISO-8601 字符串（过去时刻合法落账——liveness 由
 *   live 门判过期：形状与 liveness 分离，撤回/续期皆为新记录）。
 */
export function validateStoryboardAuthorizationIntake(input: {
  readonly scope: string;
  readonly learningPermission: string;
  readonly expiresAt: string | null;
}): StoryboardAuthorizationViolation | null {
  if (typeof input.scope !== "string" || input.scope.trim() === "") {
    return { reason: "empty-scope", detail: "authorization scope must be a non-empty string" };
  }
  if (
    !(ESCALATION_STORYBOARD_LEARNING_PERMISSIONS as readonly string[]).includes(
      input.learningPermission,
    )
  ) {
    return {
      reason: "invalid-learning-permission",
      detail: `learning permission "${input.learningPermission}" is not one of none/aggregate/full`,
    };
  }
  if (input.expiresAt !== null) {
    if (typeof input.expiresAt !== "string" || input.expiresAt.trim() === "") {
      return { reason: "invalid-expiry", detail: "expiresAt must be null or an ISO-8601 string" };
    }
    if (Number.isNaN(Date.parse(input.expiresAt))) {
      return {
        reason: "invalid-expiry",
        detail: `expiresAt "${input.expiresAt}" is not a parseable ISO-8601 timestamp`,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live 授权门（ESCALATION AUTHORIZATION LAW 的求值面：escalation 绝不在无显式、
// in-scope、未过期授权下运行——fail closed；UI 只做显示，服务端独立拒绝）
// ---------------------------------------------------------------------------

export type StoryboardAuthorizationGateReason =
  | "granted"
  | "missing"
  | "withdrawn"
  | "expired"
  | "scope-mismatch";

export interface StoryboardAuthorizationGate {
  readonly allowed: boolean;
  readonly reason: StoryboardAuthorizationGateReason;
}

/** 求值顺序固定（确定性 + 可测试）：missing → withdrawn → expired → scope。 */
export function evaluateStoryboardAuthorizationGate(input: {
  /** live 授权记录（最新未被撤回的 grant）；无 ⇒ null。 */
  readonly liveAuthorization: {
    readonly scope: string;
    readonly expiresAt: string | null;
  } | null;
  /** 该授权是否已被撤回（撤回记录在账——live grant 失效）。 */
  readonly withdrawn: boolean;
  /** escalation 要求的 scope（精确匹配才 in-scope）。 */
  readonly requiredScope: string;
  /** 时钟事实（服务端投影时刻；比较由调用方注入——校验器无时钟）。 */
  readonly now: string;
}): StoryboardAuthorizationGate {
  if (input.liveAuthorization === null) {
    return { allowed: false, reason: "missing" };
  }
  if (input.withdrawn) {
    return { allowed: false, reason: "withdrawn" };
  }
  if (
    input.liveAuthorization.expiresAt !== null &&
    Date.parse(input.liveAuthorization.expiresAt) <= Date.parse(input.now)
  ) {
    return { allowed: false, reason: "expired" };
  }
  if (input.liveAuthorization.scope !== input.requiredScope) {
    return { allowed: false, reason: "scope-mismatch" };
  }
  return { allowed: true, reason: "granted" };
}

// ---------------------------------------------------------------------------
// ArenaRetryPolicy 校验（W8A stateless validator 镜像：attempt 界 /
// backoff class 格式 / eligibility 分类门 / requires-authorization 标志）
// ---------------------------------------------------------------------------

export type StoryboardRetryPolicyViolationReason =
  | "invalid-max-attempts"
  | "invalid-backoff-class"
  | "invalid-eligibility-categories";

export interface StoryboardRetryPolicyViolation {
  readonly reason: StoryboardRetryPolicyViolationReason;
  readonly detail: string;
}

export function validateStoryboardRetryPolicy(input: {
  readonly maxAttempts: number;
  readonly backoffClass: string;
  readonly eligibilityCategories: readonly string[];
  readonly requiresAuthorization: boolean;
}): StoryboardRetryPolicyViolation | null {
  if (
    !Number.isInteger(input.maxAttempts) ||
    input.maxAttempts < 1 ||
    input.maxAttempts > 10
  ) {
    return {
      reason: "invalid-max-attempts",
      detail: `maxAttempts ${input.maxAttempts} must be an integer in [1, 10]`,
    };
  }
  if (
    typeof input.backoffClass !== "string" ||
    !(ESCALATION_STORYBOARD_BACKOFF_CLASSES as readonly string[]).includes(input.backoffClass)
  ) {
    return {
      reason: "invalid-backoff-class",
      detail: `backoff class "${input.backoffClass}" is not one of ${ESCALATION_STORYBOARD_BACKOFF_CLASSES.join("/")}`,
    };
  }
  if (!Array.isArray(input.eligibilityCategories) || input.eligibilityCategories.length === 0) {
    return {
      reason: "invalid-eligibility-categories",
      detail: "eligibility categories must be a non-empty list",
    };
  }
  const seen = new Set<string>();
  for (const category of input.eligibilityCategories) {
    if (!(ESCALATION_STORYBOARD_CATEGORIES as readonly string[]).includes(category)) {
      return {
        reason: "invalid-eligibility-categories",
        detail: `eligibility category "${category}" is not a frozen CapabilityGapCategory`,
      };
    }
    if (seen.has(category)) {
      return {
        reason: "invalid-eligibility-categories",
        detail: `duplicate eligibility category "${category}"`,
      };
    }
    seen.add(category);
  }
  if (typeof input.requiresAuthorization !== "boolean") {
    return {
      reason: "invalid-backoff-class",
      detail: "requiresAuthorization must be a boolean flag",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Gap 记录 + 投影请求校验（GAP PERSISTENCE LAW：gap 记录不可变；投影派生非权威）
// ---------------------------------------------------------------------------

export type StoryboardGapRecordViolationReason =
  | "no-attempted-strategy"
  | "invalid-confidence"
  | "invalid-category";

export interface StoryboardGapRecordViolation {
  readonly reason: StoryboardGapRecordViolationReason;
  readonly detail: string;
}

/** gap 记录形状不变量（v1 语义镜像：≥1 尝试策略；置信度 ∈ [0,1]；frozen 分类）。 */
export function validateStoryboardGapRecord(input: {
  readonly category: string;
  readonly confidence: number;
  readonly attemptedStrategies: readonly unknown[];
}): StoryboardGapRecordViolation | null {
  if (!(ESCALATION_STORYBOARD_CATEGORIES as readonly string[]).includes(input.category)) {
    return {
      reason: "invalid-category",
      detail: `gap category "${input.category}" is not one of the frozen seven`,
    };
  }
  if (
    !Number.isFinite(input.confidence) ||
    input.confidence < 0 ||
    input.confidence > 1
  ) {
    return {
      reason: "invalid-confidence",
      detail: `confidence ${input.confidence} must be a finite number in [0, 1]`,
    };
  }
  if (input.attemptedStrategies.length < 1) {
    return {
      reason: "no-attempted-strategy",
      detail: "a capability gap records at least one attempted strategy before escalation",
    };
  }
  return null;
}

export type StoryboardGapProjectionViolationReason =
  | "unknown-projection-kind"
  | "unknown-gap-record";

export interface StoryboardGapProjectionViolation {
  readonly reason: StoryboardGapProjectionViolationReason;
  readonly detail: string;
}

/** 投影请求校验（kind ∈ {tool, knowledge}；gap 必须已知——否则 typed 拒绝）。 */
export function validateStoryboardGapProjectionRequest(input: {
  readonly gapId: string;
  readonly kind: string;
  readonly knownGapIds: readonly string[];
}): StoryboardGapProjectionViolation | null {
  if (input.kind !== "tool" && input.kind !== "knowledge") {
    return {
      reason: "unknown-projection-kind",
      detail: `projection kind "${input.kind}" is not tool or knowledge`,
    };
  }
  if (!input.knownGapIds.includes(input.gapId)) {
    return {
      reason: "unknown-gap-record",
      detail: `gap record ${input.gapId} is not on the escalation plane`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Gap 投影派生检查（malformed gap 记录 ⇒ YOU_GAP_PROJECTION_INVALID——投影构建器
// fail closed，绝不猜测补全）
// ---------------------------------------------------------------------------

export function isWellFormedStoryboardGap(gap: CapabilityGap): boolean {
  return (
    validateStoryboardGapRecord({
      category: gap.category,
      confidence: gap.confidence,
      attemptedStrategies: gap.attemptedStrategies,
    }) === null
  );
}

/** 分类 ∈ frozen 七类（gap 显示行的分类标签来源）。 */
export function isStoryboardGapCategory(category: string): category is CapabilityGapCategory {
  return (ESCALATION_STORYBOARD_CATEGORIES as readonly string[]).includes(category);
}
