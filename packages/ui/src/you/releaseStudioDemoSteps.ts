// YOU Release Studio — demo 步骤定义（W12B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 releaseStudioDemo.ts
// 按模块内聚拆分以保持仓库 400 行纪律——与 W4B-W11B 同款）。步骤序即 golden 演示序
//（加载 → 16/20 诚实 incomplete checklist → 未过门 signoff 拒绝 → 无 signoff
// declaration 拒绝 → 20/20 golden checklist → signoff 落账 → 未知 operator 拒绝
// → 重复签署拒绝 → 空 bundle 拒绝 → 缺 rollback 拒绝 → declaration 落账 →
// 重复声明拒绝 → 终态总览），由 runner 与 demo 面板共享。

export type ReleaseDemoStepId =
  | "load"
  | "checklist-partial"
  | "signoff-incomplete-checklist-refusal"
  | "declaration-before-signoff-refusal"
  | "checklist-golden"
  | "signoff-land"
  | "signoff-unknown-operator-refusal"
  | "signoff-duplicate-refusal"
  | "declaration-empty-bundle-refusal"
  | "declaration-missing-rollback-refusal"
  | "declaration-land"
  | "declaration-duplicate-refusal"
  | "final-state";

export interface ReleaseDemoStep {
  readonly id: ReleaseDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: ReleaseDemoStepId): ReleaseDemoStep {
  return {
    id,
    titleMessageId: `you.release.demo.step.${id}.title`,
    descriptionMessageId: `you.release.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const RELEASE_DEMO_STEPS: readonly ReleaseDemoStep[] = [
  step("load"),
  step("checklist-partial"),
  step("signoff-incomplete-checklist-refusal"),
  step("declaration-before-signoff-refusal"),
  step("checklist-golden"),
  step("signoff-land"),
  step("signoff-unknown-operator-refusal"),
  step("signoff-duplicate-refusal"),
  step("declaration-empty-bundle-refusal"),
  step("declaration-missing-rollback-refusal"),
  step("declaration-land"),
  step("declaration-duplicate-refusal"),
  step("final-state"),
];

export const RELEASE_DEMO_TOTAL_STEPS = RELEASE_DEMO_STEPS.length;
