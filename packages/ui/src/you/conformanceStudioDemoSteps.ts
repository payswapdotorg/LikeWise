// YOU Conformance Studio — demo 步骤定义（W11B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 conformanceStudioDemo.ts
// 按模块内聚拆分以保持仓库 400 行纪律——与 W4B-W10B 同款）。步骤序即 golden 演示序
//（加载 → review 记录 + acceptance 新记录 → 重复接受拒绝 → 零 findings 接受拒绝
// → 未知 scope 拒绝 → simulated 报告 → measured 拒绝 → invented 拒绝 → 未注册
// scenario 拒绝 → partial audit → full audit → 零检查拒绝 → 完整 20 点 journey
// → failure-injection 演练 → 越界失败步拒绝 → measured journey 拒绝 → 未知
// journey 拒绝 → 第二条 runbook 演练 → exercise-claim 拒绝 → 未知 class 拒绝 →
// 终态总览），由 runner 与 demo 面板共享。

export type ConformanceDemoStepId =
  | "load"
  | "review-record-findings"
  | "review-accept"
  | "review-accept-again"
  | "review-accept-zero-findings"
  | "review-unknown-scope"
  | "load-test-simulated"
  | "load-test-measured-refusal"
  | "load-test-invented-refusal"
  | "load-test-unregistered-refusal"
  | "audit-partial"
  | "audit-full"
  | "audit-zero-checks-refusal"
  | "journey-simulated-full"
  | "journey-failure-injection"
  | "journey-out-of-range-refusal"
  | "journey-measured-refusal"
  | "journey-unknown-refusal"
  | "runbook-exercise-recovery"
  | "runbook-claim-refusal"
  | "runbook-unknown-refusal"
  | "final-state";

export interface ConformanceDemoStep {
  readonly id: ConformanceDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: ConformanceDemoStepId): ConformanceDemoStep {
  return {
    id,
    titleMessageId: `you.conformance.demo.step.${id}.title`,
    descriptionMessageId: `you.conformance.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const CONFORMANCE_DEMO_STEPS: readonly ConformanceDemoStep[] = [
  step("load"),
  step("review-record-findings"),
  step("review-accept"),
  step("review-accept-again"),
  step("review-accept-zero-findings"),
  step("review-unknown-scope"),
  step("load-test-simulated"),
  step("load-test-measured-refusal"),
  step("load-test-invented-refusal"),
  step("load-test-unregistered-refusal"),
  step("audit-partial"),
  step("audit-full"),
  step("audit-zero-checks-refusal"),
  step("journey-simulated-full"),
  step("journey-failure-injection"),
  step("journey-out-of-range-refusal"),
  step("journey-measured-refusal"),
  step("journey-unknown-refusal"),
  step("runbook-exercise-recovery"),
  step("runbook-claim-refusal"),
  step("runbook-unknown-refusal"),
  step("final-state"),
];

export const CONFORMANCE_DEMO_TOTAL_STEPS = CONFORMANCE_DEMO_STEPS.length;
