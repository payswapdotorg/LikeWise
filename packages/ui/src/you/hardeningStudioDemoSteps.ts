// YOU Hardening Studio — demo 步骤定义（W10B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 hardeningStudioDemo.ts
// 按模块内聚拆分以保持仓库 400 行纪律——与 W4B-W9B 同款）。步骤序即 golden 演示序
//（加载 → deny/defer/shed 三路限流耗尽 → 未注册 scan class 拒绝 → clean/
// quarantined/rejected 三 verdict → 非 quarantined 放行拒绝 → 显式 release →
// 重复放行拒绝 → consent-protected retention 拒绝 → withdrawn/expired 两路
// enforcement → corrupted restore 拒绝 → 两次 verified restore → unknown matrix
// ref 拒绝 → 无回滚证据拒绝 → blocked 决定 → eligible 决定 → reversal 新记录 →
// 重复反转拒绝 → 未知 id 拒绝），由 runner 与 demo 面板共享。

export type HardeningDemoStepId =
  | "load"
  | "limit-deny-exceeded"
  | "limit-defer-exceeded"
  | "limit-shed-exceeded"
  | "import-unscanned-refusal"
  | "import-clean"
  | "import-quarantined"
  | "import-release-not-quarantined"
  | "import-release"
  | "import-release-again"
  | "import-rejected"
  | "retention-consent-protected"
  | "retention-enforced-withdrawn"
  | "retention-enforced-expired"
  | "dr-corrupted"
  | "dr-verified"
  | "dr-secondary-verified"
  | "eligibility-matrix-unknown"
  | "eligibility-no-rollback"
  | "eligibility-blocked"
  | "eligibility-eligible"
  | "eligibility-reverse"
  | "eligibility-reverse-again"
  | "not-found-refusals";

export interface HardeningDemoStep {
  readonly id: HardeningDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: HardeningDemoStepId): HardeningDemoStep {
  return {
    id,
    titleMessageId: `you.hardening.demo.step.${id}.title`,
    descriptionMessageId: `you.hardening.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const HARDENING_DEMO_STEPS: readonly HardeningDemoStep[] = [
  step("load"),
  step("limit-deny-exceeded"),
  step("limit-defer-exceeded"),
  step("limit-shed-exceeded"),
  step("import-unscanned-refusal"),
  step("import-clean"),
  step("import-quarantined"),
  step("import-release-not-quarantined"),
  step("import-release"),
  step("import-release-again"),
  step("import-rejected"),
  step("retention-consent-protected"),
  step("retention-enforced-withdrawn"),
  step("retention-enforced-expired"),
  step("dr-corrupted"),
  step("dr-verified"),
  step("dr-secondary-verified"),
  step("eligibility-matrix-unknown"),
  step("eligibility-no-rollback"),
  step("eligibility-blocked"),
  step("eligibility-eligible"),
  step("eligibility-reverse"),
  step("eligibility-reverse-again"),
  step("not-found-refusals"),
];

export const HARDENING_DEMO_TOTAL_STEPS = HARDENING_DEMO_STEPS.length;
