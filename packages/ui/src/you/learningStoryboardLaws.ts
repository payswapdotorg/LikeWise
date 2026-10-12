// YOU Learning Studio — W6B 剧本法则（无状态校验器 + RIGHTS LAW 评估器）。
//
// 从 `learningStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与 W4B/W5B 的
// demoSteps/InterchangeSection 拆分同款先例）：本文件承载 W6A shared 层语义的
// UI 侧镜像——signal intake / rights intake + 八步固定序评估 / 记录阶梯转移表 /
// 偏好范围法则 / trajectory 步骤引用校验。全部无状态、无时钟、无随机
// （FIXTURES 法则 1/2）；契约类型一律从 `@zcode/shared` 导入（frozen v6）。
import type {
  LearningRightUsage,
  LearningRights,
  LearningScope,
} from "@zcode/shared";
import {
  LEARNING_STORYBOARD_LEARNING_PURPOSE,
  LEARNING_STORYBOARD_RIGHT_USAGES,
  LEARNING_STORYBOARD_SCOPES,
  LEARNING_STORYBOARD_SIGNAL_KINDS,
  storyboardGrantHash,
  type StoryboardGrantFacts,
} from "./learningStoryboard.js";

// ---------------------------------------------------------------------------
// LearningRights：惰性常量 + intake 校验 + 8 步固定序评估（RIGHTS LAW）
// ---------------------------------------------------------------------------

/** 惰性 rights（W6A INERT_LEARNING_RIGHTS 同款：无 usage、无 consent 绑定）。 */
export const STORYBOARD_INERT_RIGHTS: LearningRights = Object.freeze({
  usage: Object.freeze([]),
  consentRef: "",
  consentHash: "",
  expiresAt: null,
});

export function isInertStoryboardRights(rights: LearningRights): boolean {
  return rights.consentRef === "" && rights.consentHash === "" && rights.usage.length === 0;
}

export type StoryboardRightsViolationReason =
  | "invalid-usage-list"
  | "invalid-consent-binding"
  | "invalid-expiry";

export interface StoryboardRightsViolation {
  readonly reason: StoryboardRightsViolationReason;
  readonly detail: string;
}

/**
 * frozen v6 rights 不变量（W6A validateLearningRightsIntake 同语义）：
 * - usage 列表：成员受 sanctioned 分类学约束、去重、非空（bound 授予 ≥1）；
 * - consentRef 与 consentHash 成对（both-empty = 惰性；both-non-empty = 绑定授予）；
 * - expiresAt：null 或非空字符串。
 */
export function validateStoryboardRights(
  input: Omit<LearningRights, "usage"> & { readonly usage: readonly string[] },
): StoryboardRightsViolation | null {
  const seen = new Set<string>();
  for (const usage of input.usage) {
    if (!(LEARNING_STORYBOARD_RIGHT_USAGES as readonly string[]).includes(usage)) {
      return {
        reason: "invalid-usage-list",
        detail: `usage class "${usage}" is not sanctioned`,
      };
    }
    if (seen.has(usage)) {
      return { reason: "invalid-usage-list", detail: `duplicate usage class "${usage}"` };
    }
    seen.add(usage);
  }
  const bound = input.consentRef !== "" && input.consentHash !== "";
  const emptyPair = input.consentRef === "" && input.consentHash === "";
  if (!bound && !emptyPair) {
    return {
      reason: "invalid-consent-binding",
      detail: "consentRef and consentHash must be paired (both empty or both bound)",
    };
  }
  if (bound && input.usage.length === 0) {
    return {
      reason: "invalid-usage-list",
      detail: "a bound grant needs at least one usage class",
    };
  }
  if (input.expiresAt !== null && input.expiresAt === "") {
    return { reason: "invalid-expiry", detail: "expiresAt must be null or a non-empty ISO string" };
  }
  return null;
}

export type StoryboardRightsDecision =
  | { readonly allowed: true; readonly reason: "rights-within-grant" }
  | { readonly allowed: false; readonly reason: string };

/**
 * 8 步固定序评估（W6A evaluateLearningRights 同语义；确定性拒绝原因）：
 * 惰性 ⇒ usage 未授予 ⇒ 授权不可解析 ⇒ 状态非 granted ⇒ 未许可学习复用 ⇒
 * 用途未覆盖 ⇒ 授权哈希不匹配 ⇒ rights 过期。fail closed。
 */
export function evaluateStoryboardRights(
  rights: LearningRights,
  usage: LearningRightUsage,
  liveGrant: StoryboardGrantFacts | null,
  now: string,
): StoryboardRightsDecision {
  if (isInertStoryboardRights(rights)) {
    return { allowed: false, reason: "rights-inert" };
  }
  if (!rights.usage.includes(usage)) {
    return { allowed: false, reason: "usage-not-granted" };
  }
  if (liveGrant === null) {
    return { allowed: false, reason: "consent-unresolvable" };
  }
  if (liveGrant.state !== "granted") {
    return { allowed: false, reason: `consent-${liveGrant.state}` };
  }
  if (!liveGrant.learningReuse) {
    return { allowed: false, reason: "learning-reuse-not-permitted" };
  }
  if (!liveGrant.purposes.includes(LEARNING_STORYBOARD_LEARNING_PURPOSE)) {
    return { allowed: false, reason: "purpose-not-covered" };
  }
  if (storyboardGrantHash(liveGrant) !== rights.consentHash) {
    return { allowed: false, reason: "consent-hash-mismatch" };
  }
  if (rights.expiresAt !== null && rights.expiresAt <= now) {
    return { allowed: false, reason: "rights-expired" };
  }
  return { allowed: true, reason: "rights-within-grant" };
}

// ---------------------------------------------------------------------------
// LearningRecord 阶梯（W6A 冻结转移表的剧本镜像）
// ---------------------------------------------------------------------------

export const STORYBOARD_LEARNING_RECORD_TRANSITIONS: Readonly<
  Record<string, readonly string[]>
> = {
  candidate: ["validated", "rejected"],
  validated: ["superseded"],
  rejected: [],
  superseded: [],
};

export function isLegalStoryboardLearningRecordTransition(from: string, to: string): boolean {
  return STORYBOARD_LEARNING_RECORD_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// LearningSignal intake 校验（stateless、无时钟——W6A YOU_LEARNING_SIGNAL_INVALID 镜像）
// ---------------------------------------------------------------------------

export type StoryboardSignalViolationReason =
  | "invalid-kind"
  | "invalid-scope"
  | "invalid-subject-ref"
  | "empty-evidence-refs"
  | "invalid-evidence-ref";

export interface StoryboardSignalViolation {
  readonly reason: StoryboardSignalViolationReason;
  readonly refIndex: number | null;
  readonly detail: string;
}

/**
 * frozen v6 signal 不变量（W6A validateLearningSignalIntake 同语义）：
 * kind ∈ 六种；scope ∈ 八种；subjectRef null 或非空；evidenceRefs 非空且逐条
 * 非空、无首尾空白、无重复（内容寻址标签，绝不内联）。返回首个违例；null = 合法。
 */
export function validateStoryboardSignal(
  input: {
    readonly kind: string;
    readonly scope: string;
    readonly subjectRef: string | null;
    readonly evidenceRefs: readonly string[];
  },
): StoryboardSignalViolation | null {
  if (!(LEARNING_STORYBOARD_SIGNAL_KINDS as readonly string[]).includes(input.kind)) {
    return { reason: "invalid-kind", refIndex: null, detail: `unknown signal kind "${input.kind}"` };
  }
  if (!(LEARNING_STORYBOARD_SCOPES as readonly string[]).includes(input.scope)) {
    return { reason: "invalid-scope", refIndex: null, detail: `unknown learning scope "${input.scope}"` };
  }
  if (input.subjectRef !== null && input.subjectRef.trim() === "") {
    return { reason: "invalid-subject-ref", refIndex: null, detail: "subjectRef must be null or non-empty" };
  }
  if (input.evidenceRefs.length === 0) {
    return { reason: "empty-evidence-refs", refIndex: null, detail: "at least one content-addressed evidence ref is required" };
  }
  const seen = new Set<string>();
  for (let index = 0; index < input.evidenceRefs.length; index += 1) {
    const ref = input.evidenceRefs[index] ?? "";
    if (ref === "" || ref.trim() !== ref) {
      return {
        reason: "invalid-evidence-ref",
        refIndex: index,
        detail: "evidence refs must be non-empty without surrounding whitespace",
      };
    }
    if (seen.has(ref)) {
      return { reason: "invalid-evidence-ref", refIndex: index, detail: `duplicate evidence ref "${ref}"` };
    }
    seen.add(ref);
  }
  return null;
}

// ---------------------------------------------------------------------------
// LearningPreference 范围校验（W6A YOU_PREFERENCE_SCOPE_INVALID 镜像）
// ---------------------------------------------------------------------------

export type StoryboardPreferenceScopeViolationReason = "invalid-scope" | "scope-mismatch";

export interface StoryboardPreferenceScopeViolation {
  readonly reason: StoryboardPreferenceScopeViolationReason;
  readonly detail: string;
}

export function isStoryboardLearningScopeLiteral(value: string): value is LearningScope {
  return (LEARNING_STORYBOARD_SCOPES as readonly string[]).includes(value);
}

/**
 * 偏好范围不变量：scope 必须是 frozen 字面量；派生偏好不得扩缩范围
 * （intake.scope 必须等于 record.scope——derived preference never widens/narrows）。
 */
export function validateStoryboardPreferenceScope(
  input: { readonly scope: string },
  recordScope: string | null,
): StoryboardPreferenceScopeViolation | null {
  if (!isStoryboardLearningScopeLiteral(input.scope)) {
    return { reason: "invalid-scope", detail: `unknown learning scope "${input.scope}"` };
  }
  if (recordScope !== null && recordScope !== input.scope) {
    return {
      reason: "scope-mismatch",
      detail: `a derived preference never widens or narrows the record scope (${recordScope} → ${input.scope})`,
    };
  }
  return null;
}

/** 偏好投影键（W6A preferenceProjectionKey 同款）。 */
export function storyboardPreferenceKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

// ---------------------------------------------------------------------------
// Trajectory 步骤引用校验
// ---------------------------------------------------------------------------

export type StoryboardTrajectoryViolationReason =
  | "invalid-scope"
  | "empty-step-refs"
  | "invalid-step-ref";

export interface StoryboardTrajectoryViolation {
  readonly reason: StoryboardTrajectoryViolationReason;
  readonly refIndex: number | null;
  readonly detail: string;
}

export function validateStoryboardTrajectoryStepRefs(
  stepRefs: readonly string[],
): StoryboardTrajectoryViolation | null {
  if (stepRefs.length === 0) {
    return { reason: "empty-step-refs", refIndex: null, detail: "at least one step ref is required" };
  }
  for (let index = 0; index < stepRefs.length; index += 1) {
    const ref = stepRefs[index] ?? "";
    if (ref === "" || ref.trim() !== ref) {
      return {
        reason: "invalid-step-ref",
        refIndex: index,
        detail: "step refs must be non-empty without surrounding whitespace",
      };
    }
  }
  return null;
}
