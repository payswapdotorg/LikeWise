// YOU Editing Studio — demo 步骤定义（W5B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 editingStudioDemo.ts 按
// 模块内聚拆分以保持仓库 400 行纪律——与 W4B performanceStudioDemoSteps 同款）。
// 步骤序即 golden 演示序（subject → 会话 → 变更集 → 候选 → 接受/拒绝 → 诚实错误
// 路径 → external 启动 → Tier-4 交换 → 接管 → 终态收束），由 runner 与 demo 面板
// 共享。

export type EditingDemoStepId =
  | "subject-pick"
  | "session-open"
  | "ops-compose"
  | "changeset-preview"
  | "changeset-propose"
  | "changeset-apply"
  | "candidate-accept"
  | "changeset-2"
  | "candidate-reject"
  | "changeset-invalid"
  | "editor-unsupported"
  | "session-not-found"
  | "external-session"
  | "launch-gate"
  | "consent-grant"
  | "external-launch"
  | "export"
  | "import-roundtrip"
  | "import-invalid"
  | "takeover-gate"
  | "takeover-confirm"
  | "session-commit"
  | "session-terminal-locked"
  | "session-abandon";

export interface EditingDemoStep {
  readonly id: EditingDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: EditingDemoStepId): EditingDemoStep {
  return {
    id,
    titleMessageId: `you.editing.demo.step.${id}.title`,
    descriptionMessageId: `you.editing.demo.step.${id}.description`,
  };
}

/** 固定步骤序列（确定性：顺序即剧本；golden 断言覆盖）。 */
export const EDITING_DEMO_STEPS: readonly EditingDemoStep[] = [
  step("subject-pick"),
  step("session-open"),
  step("ops-compose"),
  step("changeset-preview"),
  step("changeset-propose"),
  step("changeset-apply"),
  step("candidate-accept"),
  step("changeset-2"),
  step("candidate-reject"),
  step("changeset-invalid"),
  step("editor-unsupported"),
  step("session-not-found"),
  step("external-session"),
  step("launch-gate"),
  step("consent-grant"),
  step("external-launch"),
  step("export"),
  step("import-roundtrip"),
  step("import-invalid"),
  step("takeover-gate"),
  step("takeover-confirm"),
  step("session-commit"),
  step("session-terminal-locked"),
  step("session-abandon"),
];

export const EDITING_DEMO_TOTAL_STEPS = EDITING_DEMO_STEPS.length;
