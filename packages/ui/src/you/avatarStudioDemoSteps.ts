// YOU Avatar Studio — demo 步骤定义（W7B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 avatarStudioDemo.ts 按
// 模块内聚拆分以保持仓库 400 行纪律——与 W4B/W5B/W6B 同款）。步骤序即 golden
// 演示序（Body/Soul 挑选 → 诚实 intake 拒绝 → 未知 Body → 会话打开 → 阶梯行走 →
// 阶梯法则拒绝（自环/unavailable/未知档位）→ 挂起 → 挂起拒绝 → 恢复 → 再附身
//（Body 契约不变）→ realtime 信道 → 关闭 → 终态拒绝 → 未知会话 → 第二会话 →
// 注册面扩展（body/soul intake）），由 runner 与 demo 面板共享。

export type AvatarDemoStepId =
  | "load"
  | "body-pick"
  | "soul-pick"
  | "soul-intake-invalid"
  | "body-intake-invalid"
  | "body-not-found"
  | "session-open"
  | "ladder-walk"
  | "self-loop-refused"
  | "unavailable-refused"
  | "unknown-state-refused"
  | "session-suspend"
  | "suspended-refused"
  | "session-resume"
  | "soul-reassign"
  | "realtime-channels"
  | "session-close"
  | "closed-terminal"
  | "session-not-found"
  | "second-session"
  | "body-register"
  | "soul-register";

export interface AvatarDemoStep {
  readonly id: AvatarDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: AvatarDemoStepId): AvatarDemoStep {
  return {
    id,
    titleMessageId: `you.avatar.demo.step.${id}.title`,
    descriptionMessageId: `you.avatar.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const AVATAR_DEMO_STEPS: readonly AvatarDemoStep[] = [
  step("load"),
  step("body-pick"),
  step("soul-pick"),
  step("soul-intake-invalid"),
  step("body-intake-invalid"),
  step("body-not-found"),
  step("session-open"),
  step("ladder-walk"),
  step("self-loop-refused"),
  step("unavailable-refused"),
  step("unknown-state-refused"),
  step("session-suspend"),
  step("suspended-refused"),
  step("session-resume"),
  step("soul-reassign"),
  step("realtime-channels"),
  step("session-close"),
  step("closed-terminal"),
  step("session-not-found"),
  step("second-session"),
  step("body-register"),
  step("soul-register"),
];

export const AVATAR_DEMO_TOTAL_STEPS = AVATAR_DEMO_STEPS.length;
