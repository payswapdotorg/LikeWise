// YOU Lab Studio — demo 步骤定义（W9B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 labStudioDemo.ts 按
// 模块内聚拆分以保持仓库 400 行纪律——与 W4B-W8B 同款）。步骤序即 golden 演示序
//（加载 → 世界/预算 intake 拒绝 → 实验声明（三臂法则）→ 基线 run 成功 →
// 手工设计 run 失败/重试 → searched run（搜索阶梯步）→ 证据发布/未校验晋升拒绝/
// 校验 → 非 searched 晋升拒绝 → 晋升 → 再晋升拒绝 → 反转新记录 → 污染 manifest
// 与 hash mismatch 拒绝 → 落败实验（三臂扫 + no-improvement 拒绝）→ 持平实验
//（紧预算 + ties 拒绝）→ 搜索预算耗尽（recorded terminal）→ run 退役 →
// 未知 run/实验拒绝 → 终态锁定拒绝），由 runner 与 demo 面板共享。

export type LabDemoStepId =
  | "load"
  | "world-invalid"
  | "budget-invalid"
  | "experiment-declare"
  | "run-submit-baseline"
  | "run-start-baseline"
  | "run-succeed-baseline"
  | "run-fail-handdesigned"
  | "run-retry-handdesigned"
  | "run-submit-searched"
  | "run-start-searched"
  | "run-succeed-searched"
  | "evidence-publish"
  | "promotion-unverified"
  | "manifest-verify"
  | "promotion-baseline-winner"
  | "promotion-decide"
  | "promotion-already-decided"
  | "promotion-reversal"
  | "manifest-tampered"
  | "manifest-mismatch"
  | "experiment-declare-losing"
  | "losing-sweep"
  | "promotion-losing"
  | "experiment-declare-tie"
  | "tie-sweep"
  | "promotion-tie"
  | "search-exhaustion"
  | "run-retire"
  | "not-found-refusals"
  | "terminal-refusal";

export interface LabDemoStep {
  readonly id: LabDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: LabDemoStepId): LabDemoStep {
  return {
    id,
    titleMessageId: `you.lab.demo.step.${id}.title`,
    descriptionMessageId: `you.lab.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const LAB_DEMO_STEPS: readonly LabDemoStep[] = [
  step("load"),
  step("world-invalid"),
  step("budget-invalid"),
  step("experiment-declare"),
  step("run-submit-baseline"),
  step("run-start-baseline"),
  step("run-succeed-baseline"),
  step("run-fail-handdesigned"),
  step("run-retry-handdesigned"),
  step("run-submit-searched"),
  step("run-start-searched"),
  step("run-succeed-searched"),
  step("evidence-publish"),
  step("promotion-unverified"),
  step("manifest-verify"),
  step("promotion-baseline-winner"),
  step("promotion-decide"),
  step("promotion-already-decided"),
  step("promotion-reversal"),
  step("manifest-tampered"),
  step("manifest-mismatch"),
  step("experiment-declare-losing"),
  step("losing-sweep"),
  step("promotion-losing"),
  step("experiment-declare-tie"),
  step("tie-sweep"),
  step("promotion-tie"),
  step("search-exhaustion"),
  step("run-retire"),
  step("not-found-refusals"),
  step("terminal-refusal"),
];

export const LAB_DEMO_TOTAL_STEPS = LAB_DEMO_STEPS.length;
