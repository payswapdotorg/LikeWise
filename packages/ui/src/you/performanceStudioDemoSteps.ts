// YOU Performance Studio — demo 步骤表（W4B）。
//
// 纯数据模块（步骤 id 联合 + 步骤表 + 文案 id 派生；从 performanceStudioDemo.ts 按
// 模块内聚拆分以保持仓库 400 行纪律）。步骤序即 golden 演示序（模板 → 演出 →
// 时间线 → 渲染 → 评审 → 诚实错误路径 → 同意撤回），由 runner 与 demo 面板共享。
export type PerformanceDemoStepId =
  | "template-pick"
  | "performance-publish"
  | "timeline-inspect"
  | "timeline-edit"
  | "timeline-invalid"
  | "render-consent-gate"
  | "consent-grant"
  | "render-submit"
  | "render-run"
  | "render-complete"
  | "render-submit-2"
  | "render-complete-2"
  | "artifact-accept"
  | "artifact-reject"
  | "artifact-supersede"
  | "render-fail"
  | "render-unsupported"
  | "consent-withdraw";

export interface PerformanceDemoStep {
  readonly id: PerformanceDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: PerformanceDemoStepId): PerformanceDemoStep {
  return {
    id,
    titleMessageId: `you.performance.demo.step.${id}.title`,
    descriptionMessageId: `you.performance.demo.step.${id}.description`,
  };
}

export const PERFORMANCE_DEMO_STEPS: readonly PerformanceDemoStep[] = [
  step("template-pick"),
  step("performance-publish"),
  step("timeline-inspect"),
  step("timeline-edit"),
  step("timeline-invalid"),
  step("render-consent-gate"),
  step("consent-grant"),
  step("render-submit"),
  step("render-run"),
  step("render-complete"),
  step("render-submit-2"),
  step("render-complete-2"),
  step("artifact-accept"),
  step("artifact-reject"),
  step("artifact-supersede"),
  step("render-fail"),
  step("render-unsupported"),
  step("consent-withdraw"),
];

/** 步骤总数（驱动器与 UI 共享）。 */
export const PERFORMANCE_DEMO_TOTAL_STEPS = PERFORMANCE_DEMO_STEPS.length;
