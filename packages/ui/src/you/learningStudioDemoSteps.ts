// YOU Learning Studio — demo 步骤定义（W6B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 learningStudioDemo.ts 按
// 模块内聚拆分以保持仓库 400 行纪律——与 W4B/W5B 同款）。步骤序即 golden 演示序
//（scope/kind 挑选 → 信号捕获（六种 kind 全覆盖）→ 内容/权利 → 候选/验证/使用 →
// 偏好派生 → 惰性/拒绝/顶替/范围错误路径 → trajectory 记录/重放 → 未知记录 →
// 同意撤回与撤回后拒绝），由 runner 与 demo 面板共享。

export type LearningDemoStepId =
  | "scope-pick"
  | "kind-pick"
  | "signal-invalid"
  | "signal-feedback"
  | "signal-sweep"
  | "content-synthesize"
  | "rights-gate"
  | "consent-grant"
  | "rights-issue"
  | "record-candidates"
  | "record-validate"
  | "record-use"
  | "preference-derive"
  | "inert-validate"
  | "inert-refusal"
  | "record-reject"
  | "rejected-unusable"
  | "record-supersede"
  | "superseded-unusable"
  | "usage-outside-grant"
  | "operator-preference"
  | "preference-clear"
  | "derived-clear-refused"
  | "preference-scope-invalid"
  | "trajectory-record"
  | "trajectory-replay"
  | "record-not-found"
  | "consent-withdraw"
  | "post-withdrawal-refusal";

export interface LearningDemoStep {
  readonly id: LearningDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: LearningDemoStepId): LearningDemoStep {
  return {
    id,
    titleMessageId: `you.learning.demo.step.${id}.title`,
    descriptionMessageId: `you.learning.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const LEARNING_DEMO_STEPS: readonly LearningDemoStep[] = [
  step("scope-pick"),
  step("kind-pick"),
  step("signal-invalid"),
  step("signal-feedback"),
  step("signal-sweep"),
  step("content-synthesize"),
  step("rights-gate"),
  step("consent-grant"),
  step("rights-issue"),
  step("record-candidates"),
  step("record-validate"),
  step("record-use"),
  step("preference-derive"),
  step("inert-validate"),
  step("inert-refusal"),
  step("record-reject"),
  step("rejected-unusable"),
  step("record-supersede"),
  step("superseded-unusable"),
  step("usage-outside-grant"),
  step("operator-preference"),
  step("preference-clear"),
  step("derived-clear-refused"),
  step("preference-scope-invalid"),
  step("trajectory-record"),
  step("trajectory-replay"),
  step("record-not-found"),
  step("consent-withdraw"),
  step("post-withdrawal-refusal"),
];

export const LEARNING_DEMO_TOTAL_STEPS = LEARNING_DEMO_STEPS.length;
