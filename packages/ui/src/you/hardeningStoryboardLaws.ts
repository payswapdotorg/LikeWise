// YOU Hardening Studio — W10B 剧本法则（无状态校验器 + 法则评估器）。
//
// 从 `hardeningStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与
// W4B-W9B 的 laws 拆分同款先例）：本文件承载 W10A/W10C 服务语义的 UI 侧镜像——
// rate-limit 窗口配额法则（RATE LIMIT LAW）/ import 扫描 intake 与放行法则
//（IMPORT SECURITY LAW）/ retention-vs-consent 法则（RETENTION LAW + wave-2
// consent 法律）/ DR restore 哈希校验法则（DR LAW）/ production eligibility
// 决定门（PRODUCTION ELIGIBILITY LAW）。全部无状态、无随机（FIXTURES 法则
// 1/2；时间比较由调用方传入事实——校验器自身无时钟）；契约类型一律从
// `@zcode/shared` 导入（frozen v10）。
import type { ConsentState, RateLimitAction } from "@zcode/shared";
import { storyboardDrSnapshotHash } from "./hardeningStoryboard.js";

// ---------------------------------------------------------------------------
// Rate limit 法则（RATE LIMIT LAW：limits enforce BEFORE the effect；每次
// enforcement append 不可变记录；throttling 绝不静默——deny/defer/shed）
// ---------------------------------------------------------------------------

/** 窗口是否已过期（依注入的 tick 事实比较——校验器自身无时钟）。 */
export function storyboardRateWindowExpired(
  windowOpenedAtTick: number,
  windowS: number,
  currentTick: number,
): boolean {
  return currentTick - windowOpenedAtTick >= windowS;
}

/**
 * 本次请求是否超出窗口配额（enforcement 决策的纯数学：窗口未滚动且
 * consumed >= burst ⇒ exceeded）。窗口滚动逻辑由调用方（模拟控制器）在调用前
// 处理；本函数只做 fail-closed 判定。
 */
export function storyboardRateLimitExceeded(
  consumedInWindow: number,
  burst: number,
): boolean {
  return consumedInWindow >= burst;
}

/**
 * enforcement 的 retry 指引（确定性显示面）：窗口剩余秒数。窗口已滚动时为 0
 *（可立即重试）；否则为窗口剩余时长（向上取整——绝不低估等待）。
 */
export function storyboardRetryAfterS(
  windowOpenedAtTick: number,
  windowS: number,
  currentTick: number,
): number {
  if (storyboardRateWindowExpired(windowOpenedAtTick, windowS, currentTick)) {
    return 0;
  }
  const elapsed = currentTick - windowOpenedAtTick;
  return Math.max(0, Math.ceil(windowS - elapsed));
}

/** retry 指引文案键（deny/defer/shed 各有专属指引——绝不静默）。 */
export function storyboardRateActionMessageKey(action: RateLimitAction): string {
  return `you.hardening.limits.action.${action}`;
}

// ---------------------------------------------------------------------------
// Import security 法则（IMPORT SECURITY LAW：unscanned imports never enter
// evidence；quarantine fail-closed 且仅经显式 release record 可逆）
// ---------------------------------------------------------------------------

/** 放行的前置条件：artifact 与 scan class 都已注册（未注册 ⇒ fail closed）。 */
export function storyboardImportIntakeValid(input: {
  readonly artifactKnown: boolean;
  readonly scanClassKnown: boolean;
  readonly scanClassValid: boolean;
}): boolean {
  return input.artifactKnown && input.scanClassKnown && input.scanClassValid;
}

/** verdict 是否可放行（只有 quarantined verdict 需要 release 决定）。 */
export function storyboardVerdictIsQuarantined(
  verdict: "clean" | "quarantined" | "rejected",
): boolean {
  return verdict === "quarantined";
}

// ---------------------------------------------------------------------------
// Retention 法则（RETENTION LAW：enforcement 记录不可变可审计；retention
// class 绝不覆盖 active consent——consent 法律优先）
// ---------------------------------------------------------------------------

/**
 * subject 是否被 active consent 保护（wave-2 consent 法律：granted 是唯一
 * active 状态；被保护的 subject 的 enforcement 是 typed 拒绝——删除绝不越过
 * consent）。
 */
export function storyboardSubjectConsentProtected(
  consentState: ConsentState,
): boolean {
  return consentState === "granted";
}

// ---------------------------------------------------------------------------
// DR 法则（DR LAW：restore 在 activation 前校验 content hash；verified flag
// 绝不在无 check evidence 时断言）
// ---------------------------------------------------------------------------

/**
 * snapshot 内容哈希是否匹配（restore 的 activation 前置门）：期望哈希由
 * snapshotKey 确定性派生；observed 由 integrity 决定（corrupted = 记录一个
 * 故意不同的哈希——诚实 mismatch 路径，与 W8B/W9B 污染预设同款）。
 */
export function storyboardDrHashMatches(
  snapshotKey: string,
  observedHash: string,
): boolean {
  return storyboardDrSnapshotHash(snapshotKey) === observedHash;
}

/** corrupted 路径的确定性「观察哈希」（与期望值必然不同——绝不伪装匹配）。 */
export function storyboardDrCorruptedHash(snapshotKey: string): string {
  return `sha256-fixture-corrupted-${snapshotKey}`;
}

// ---------------------------------------------------------------------------
// Production eligibility 法则（PRODUCTION ELIGIBILITY LAW：eligibility
// requires rollback evidence；决定不可变；reversal 是新记录）
// ---------------------------------------------------------------------------

/**
 * eligibility 决定门（固定求值序，fail closed）：unknown matrix ref ⇒
 * YOU_PROVIDER_MATRIX_INVALID；eligible 决定无 rollback evidence ⇒
 * YOU_PRODUCTION_ELIGIBILITY_INVALID。
 */
export type StoryboardEligibilityGateReason =
  | "granted"
  | "unknown-provider-matrix-ref"
  | "missing-rollback-evidence"
  | "unknown-rollback-evidence";

export interface StoryboardEligibilityGate {
  readonly allowed: boolean;
  readonly reason: StoryboardEligibilityGateReason;
}

/**
 * 决定门固定求值序（W10C 服务强制面的 UI 侧镜像）：unknown matrix ref ->
 * missing/unknown rollback evidence (eligible 决定) -> granted。blocked 决定
 * 不要求 rollback evidence（无可回滚之物）；eligible 决定必须携带真实证据。
 */
export function evaluateStoryboardEligibilityGate(input: {
  readonly matrixKnown: boolean;
  readonly matrixValid: boolean;
  readonly eligible: boolean;
  readonly rollbackEvidenceKnown: boolean;
  readonly rollbackEvidencePresent: boolean;
}): StoryboardEligibilityGate {
  if (!input.matrixKnown || !input.matrixValid) {
    return { allowed: false, reason: "unknown-provider-matrix-ref" };
  }
  if (input.eligible) {
    if (!input.rollbackEvidenceKnown) {
      return { allowed: false, reason: "unknown-rollback-evidence" };
    }
    if (!input.rollbackEvidencePresent) {
      return { allowed: false, reason: "missing-rollback-evidence" };
    }
  }
  return { allowed: true, reason: "granted" };
}
