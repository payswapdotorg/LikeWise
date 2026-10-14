// YOU Conformance Studio — W11B 剧本法则（无状态校验器 + 法则评估器）。
//
// 从 `conformanceStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与
// W4B-W10B 的 laws 拆分同款先例）：本文件承载 W11A/W11C 服务语义的 UI 侧镜像
// —— security review 接受门（SECURITY REVIEW LAW）/ load-test 指标来源法则
//（LOAD TEST LAW）/ conformance counts 法则（CONFORMANCE LAW）/ journey 失败
// 步法则（JOURNEY LAW）/ runbook 演练法则（RUNBOOK LAW）。全部无状态、无随机
//（FIXTURES 法则 1/2；时间比较由调用方传入事实——校验器自身无时钟）；契约类型
// 一律从 `@zcode/shared` 导入（frozen v11）。
import type {
  ConformanceAuditRecord,
  LoadTestReport,
} from "@zcode/shared";
import {
  CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
  CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
} from "./conformanceStoryboard.js";

// ---------------------------------------------------------------------------
// Security review 法则（SECURITY REVIEW LAW：findings recorded verbatim；
// acceptance 是引用 finding set 的独立不可变决定——acceptance without findings
// 是 typed 拒绝路径）
// ---------------------------------------------------------------------------

/** finding set 是否非空（acceptance 的前置：acceptance 引用一个非空 finding set）。 */
export function storyboardAcceptanceRequiresFindings(
  findingsCount: number,
): boolean {
  return findingsCount > 0;
}

/** 接受门 reason 分类（固定求值序，fail closed）。 */
export type StoryboardAcceptanceGateReason =
  | "granted"
  | "acceptance-without-findings"
  | "review-not-selected"
  | "unknown-review"
  | "already-accepted"
  | "acceptance-not-acceptable";

export interface StoryboardAcceptanceGate {
  readonly allowed: boolean;
  readonly reason: StoryboardAcceptanceGateReason;
}

/**
 * 接受门固定求值序（W11A 服务强制面的 UI 侧镜像）：未选择 -> 未知 review ->
 * 非 review 记录（acceptance 不可再接受）-> 已接受 -> 零 findings（acceptance
 * without findings——typed 拒绝）-> granted。
 */
export function evaluateStoryboardAcceptanceGate(input: {
  readonly reviewSelected: boolean;
  readonly reviewKnown: boolean;
  readonly isReviewRecord: boolean;
  readonly alreadyAccepted: boolean;
  readonly findingsCount: number;
}): StoryboardAcceptanceGate {
  if (!input.reviewSelected) {
    return { allowed: false, reason: "review-not-selected" };
  }
  if (!input.reviewKnown) {
    return { allowed: false, reason: "unknown-review" };
  }
  if (!input.isReviewRecord) {
    return { allowed: false, reason: "acceptance-not-acceptable" };
  }
  if (input.alreadyAccepted) {
    return { allowed: false, reason: "already-accepted" };
  }
  if (!storyboardAcceptanceRequiresFindings(input.findingsCount)) {
    return { allowed: false, reason: "acceptance-without-findings" };
  }
  return { allowed: true, reason: "granted" };
}

// ---------------------------------------------------------------------------
// Load test 法则（LOAD TEST LAW：peak/p99 measured 或 simulated-labeled ——
// 绝不 invented；regressions listed verbatim）
// ---------------------------------------------------------------------------

/**
 * 指标来源是否可以落账（invented = typed 拒绝路径——绝不落账；measured 在
 * fixture 支撑面上同样是拒绝路径：模拟控制器绝不伪造 measured 数值）。
 */
export function storyboardMetricsSourceLandsReport(
  source: "measured" | "simulated" | "invented",
  backingIsFixture: boolean,
): boolean {
  if (source === "invented") return false;
  if (source === "measured" && backingIsFixture) return false;
  return true;
}

/** 来源的显示分类键（simulated-labeled 指示器的数据源）。 */
export function storyboardMetricsSourceKind(
  source: "measured" | "simulated" | "invented",
): "measured" | "simulated-labeled" | "invented-refused" {
  if (source === "measured") return "measured";
  if (source === "simulated") return "simulated-labeled";
  return "invented-refused";
}

/** 报告是否携带 simulated-labeled 指示（LOAD TEST LAW 显示面）。 */
export function storyboardReportIsSimulatedLabeled(
  report: LoadTestReport,
): boolean {
  return report.simulated;
}

// ---------------------------------------------------------------------------
// Conformance audit 法则（CONFORMANCE LAW：checks-total / checks-passed stated
// verbatim —— 绝不 bare pass；counts 即 conformance 陈述本身）
// ---------------------------------------------------------------------------

/** 零检查标准的任何结果都是 typed 拒绝路径（pass without checks 绝不落账）。 */
export function storyboardAuditChecksSupportOutcome(
  checksTotal: number,
): boolean {
  return checksTotal > 0;
}

/** audit 的 counts 是否 verbatim 呈现（显示法则：两 counts 必须同时在场）。 */
export function storyboardAuditCountsAreVerbatim(
  audit: ConformanceAuditRecord,
): boolean {
  return (
    Number.isFinite(audit.checksTotal) &&
    Number.isFinite(audit.checksPassed) &&
    audit.checksPassed >= 0 &&
    audit.checksTotal >= 0 &&
    audit.checksPassed <= audit.checksTotal
  );
}

/** counts 的派生通过态（次要显示——counts 本身才是 conformance 陈述）。 */
export function storyboardAuditPassState(
  checksTotal: number,
  checksPassed: number,
): "all-passed" | "partial" | "none-passed" {
  if (checksTotal <= 0) return "none-passed";
  if (checksPassed >= checksTotal) return "all-passed";
  if (checksPassed <= 0) return "none-passed";
  return "partial";
}

// ---------------------------------------------------------------------------
// Journey 法则（JOURNEY LAW：20 点 launch-gate journey 记录每一步 completed
// 或 failed-at + measured duration；simulated runs stay labeled）
// ---------------------------------------------------------------------------

/** 失败步序是否在 20 点 launch gate 范围内（1..total；null = 完整跑）。 */
export function storyboardJourneyFailStepInRange(
  failAtStep: number | null,
  totalSteps: number = CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
): boolean {
  if (failAtStep === null) return true;
  return (
    Number.isInteger(failAtStep) && failAtStep >= 1 && failAtStep <= totalSteps
  );
}

/**
 * journey 步骤名解析（1-based → 20 点表的 verbatim 步骤名；越界 → null）。
 * UI 绝不猜测步骤名。
 */
export function storyboardJourneyStepName(
  stepIndex: number,
  steps: readonly string[] = CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS,
): string | null {
  if (stepIndex < 1 || stepIndex > steps.length) return null;
  return steps[stepIndex - 1] ?? null;
}

/**
 * run 的种类是否可落账（measured 在 fixture 支撑面上是拒绝路径——模拟控制器
 * 绝不伪造 measured duration；JOURNEY LAW「simulated runs stay labeled」的
// fail-closed 面）。
 */
export function storyboardRunKindLandsRecord(
  runKind: "measured" | "simulated",
  backingIsFixture: boolean,
): boolean {
  if (runKind === "measured" && backingIsFixture) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Runbook 法则（RUNBOOK LAW：每个 entry 被 ≥1 条 failure-injection journey
// 演练，或显式标注 unexercised）
// ---------------------------------------------------------------------------

/** 演练路径是否合法（exercise-claim = typed 拒绝路径——无 journey 的演练断言）。 */
export function storyboardExerciseViaIsLawful(
  via: "failure-injection" | "exercise-claim",
): boolean {
  return via === "failure-injection";
}

/** runbook 条目链是否处于 exercised 状态（追加序末位条目 = live 状态口径）。 */
export function storyboardRunbookChainIsExercised(
  entries: readonly { readonly exercised: boolean }[],
): boolean {
  const latest = entries.at(-1);
  return latest?.exercised ?? false;
}
