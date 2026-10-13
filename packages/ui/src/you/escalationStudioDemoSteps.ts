// YOU Escalation Studio — demo 步骤定义（W8B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 escalationStudioDemo.ts 按
// 模块内聚拆分以保持仓库 400 行纪律——与 W4B-W7B 同款）。步骤序即 golden 演示序
//（加载 → gap 记录（七类全覆盖 + 不可升级）→ 投影发布与非法投影拒绝 →
// policy 校验拒绝 → 升级请求 → 无授权拒绝 → 非法授权拒绝 → 授权（aggregate）→
// run 启动/失败/重试 → 未知 provider 拒绝 → typed payload 交付 → 应用 →
// 第二升级（过期授权拒绝 → 续期新记录 → artifact 交付 → 拒绝终态）→ 第三升级
//（none 许可 → 撤回 → 撤回后拒绝 → 取消）→ 未知升级/run → 终态拒绝），
// 由 runner 与 demo 面板共享。

export type EscalationDemoStepId =
  | "load"
  | "gap-open"
  | "gap-sweep"
  | "gap-ineligible"
  | "projection-tool"
  | "projection-knowledge"
  | "projection-invalid"
  | "policy-invalid"
  | "escalation-request"
  | "unauthorized-run"
  | "grant-invalid"
  | "grant-aggregate"
  | "run-start"
  | "run-fail"
  | "run-retry"
  | "provider-unknown"
  | "deliver-typed-payload"
  | "apply-result"
  | "escalation-request-expert"
  | "grant-expired"
  | "expired-run"
  | "regrant-full"
  | "deliver-artifact"
  | "reject-result"
  | "escalation-request-knowledge"
  | "grant-none"
  | "run-start-knowledge"
  | "permission-withdraw"
  | "post-withdrawal-refusal"
  | "cancel-escalation"
  | "not-found-refusals"
  | "terminal-refusal";

export interface EscalationDemoStep {
  readonly id: EscalationDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: EscalationDemoStepId): EscalationDemoStep {
  return {
    id,
    titleMessageId: `you.escalation.demo.step.${id}.title`,
    descriptionMessageId: `you.escalation.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const ESCALATION_DEMO_STEPS: readonly EscalationDemoStep[] = [
  step("load"),
  step("gap-open"),
  step("gap-sweep"),
  step("gap-ineligible"),
  step("projection-tool"),
  step("projection-knowledge"),
  step("projection-invalid"),
  step("policy-invalid"),
  step("escalation-request"),
  step("unauthorized-run"),
  step("grant-invalid"),
  step("grant-aggregate"),
  step("run-start"),
  step("run-fail"),
  step("run-retry"),
  step("provider-unknown"),
  step("deliver-typed-payload"),
  step("apply-result"),
  step("escalation-request-expert"),
  step("grant-expired"),
  step("expired-run"),
  step("regrant-full"),
  step("deliver-artifact"),
  step("reject-result"),
  step("escalation-request-knowledge"),
  step("grant-none"),
  step("run-start-knowledge"),
  step("permission-withdraw"),
  step("post-withdrawal-refusal"),
  step("cancel-escalation"),
  step("not-found-refusals"),
  step("terminal-refusal"),
];

export const ESCALATION_DEMO_TOTAL_STEPS = ESCALATION_DEMO_STEPS.length;
