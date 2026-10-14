// YOU Conformance Studio — demo 步骤文案表（W11B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/计数——与 W4B-W10B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.conformance.demo.step.load.title": "Load the conformance plane",
  "you.conformance.demo.step.load.description":
    "First step owns load: the review status, load-test reports, conformance audits, journey records and runbook entries all render from controller projections (frozen registries: review scopes, load scenarios, standards, journeys, incident classes; the runbook starts explicitly marked unexercised).",
  "you.conformance.demo.step.review-record-findings.title": "Record a security review",
  "you.conformance.demo.step.review-record-findings.description":
    "The render-pipeline scope records its finding set verbatim (findingsCount is never summarized); the review lands accepted: false with the security-review-recorded event journaled.",
  "you.conformance.demo.step.review-accept.title": "Land the acceptance decision",
  "you.conformance.demo.step.review-accept.description":
    "The acceptance is a separate immutable decision: a NEW SecurityReviewRecord referencing the same finding set (supersedes link) — never a mutation of the review.",
  "you.conformance.demo.step.review-accept-again.title": "Honest error: accept twice",
  "you.conformance.demo.step.review-accept-again.description":
    "Re-accepting an already-accepted review is a typed YOU_SECURITY_REVIEW_INVALID refusal — an acceptance is taken exactly once; the ledger is append-only history.",
  "you.conformance.demo.step.review-accept-zero-findings.title": "Honest error: acceptance without findings",
  "you.conformance.demo.step.review-accept-zero-findings.description":
    "The empty-sweep scope records 0 findings verbatim, and accepting it is a typed refusal — acceptance references a non-empty finding set (the SECURITY REVIEW LAW's refusal path).",
  "you.conformance.demo.step.review-unknown-scope.title": "Honest error: unknown scope",
  "you.conformance.demo.step.review-unknown-scope.description":
    "Recording a review on an unregistered scope fails closed with a typed YOU_SECURITY_REVIEW_INVALID — the UI never guesses a scope.",
  "you.conformance.demo.step.load-test-simulated.title": "Record a simulated-labeled report",
  "you.conformance.demo.step.load-test-simulated.description":
    "The render-peak scenario lands peak 240 rps / p99 420ms simulated-labeled with both regressions listed verbatim — the LOAD TEST LAW's honest reporting surface.",
  "you.conformance.demo.step.load-test-measured-refusal.title": "Honest error: measured on a fixture backing",
  "you.conformance.demo.step.load-test-measured-refusal.description":
    "A measured run is refused on the fixture-simulated backing — peak/p99 are measured or simulated-labeled, and a fixture never fabricates the former (measured reports arrive with the T11 service binding).",
  "you.conformance.demo.step.load-test-invented-refusal.title": "Honest error: invented metrics",
  "you.conformance.demo.step.load-test-invented-refusal.description":
    "Invented numbers never land: the typed YOU_LOAD_TEST_INVALID refusal is the LOAD TEST LAW speaking — never silent, never summarized away.",
  "you.conformance.demo.step.load-test-unregistered-refusal.title": "Honest error: unregistered scenario",
  "you.conformance.demo.step.load-test-unregistered-refusal.description":
    "The unregistered scenario profile fails closed with a typed refusal — every report references a registered scenario.",
  "you.conformance.demo.step.audit-partial.title": "Audit partial: 27/30 verbatim",
  "you.conformance.demo.step.audit-partial.description":
    "The WCAG 2.2 AA audit lands 27/30 — the CONFORMANCE LAW states checks-total and checks-passed verbatim; a partial pass is never dressed as a pass.",
  "you.conformance.demo.step.audit-full.title": "Audit full: 12/12 verbatim",
  "you.conformance.demo.step.audit-full.description":
    "The responsive-320px audit passes 12/12 and still displays with the counts — even a full pass is never a bare pass.",
  "you.conformance.demo.step.audit-zero-checks-refusal.title": "Honest error: zero-checks standard",
  "you.conformance.demo.step.audit-zero-checks-refusal.description":
    "The empty-checklist baseline is refused — the counts ARE the conformance statement, so a pass without checks never lands.",
  "you.conformance.demo.step.journey-simulated-full.title": "Run the full 20-point journey",
  "you.conformance.demo.step.journey-simulated-full.description":
    "The launch-gate journey completes all 20 steps with a measured duration, simulated-labeled — every step is recorded completed (the JOURNEY LAW display).",
  "you.conformance.demo.step.journey-failure-injection.title": "Inject a failure at render-submit",
  "you.conformance.demo.step.journey-failure-injection.description":
    "A failure-injection journey fails at step 10 (render-submit) and exercises the render-provider-outage runbook — detection / containment / recovery stay displayed verbatim.",
  "you.conformance.demo.step.journey-out-of-range-refusal.title": "Honest error: fail-at step 21",
  "you.conformance.demo.step.journey-out-of-range-refusal.description":
    "The failed step must be a real step of the 20-point journey (1..20 or null) — step 21 is a typed YOU_E2E_JOURNEY_INVALID refusal, never invented.",
  "you.conformance.demo.step.journey-measured-refusal.title": "Honest error: measured run on a fixture backing",
  "you.conformance.demo.step.journey-measured-refusal.description":
    "A measured run kind is refused on the fixture-simulated harness — simulated runs stay labeled; measured durations arrive with the T11 service binding.",
  "you.conformance.demo.step.journey-unknown-refusal.title": "Honest error: unregistered journey",
  "you.conformance.demo.step.journey-unknown-refusal.description":
    "The legacy journey profile fails closed with a typed refusal — every run references a registered journey.",
  "you.conformance.demo.step.runbook-exercise-recovery.title": "Drill the recovery-verification class",
  "you.conformance.demo.step.runbook-exercise-recovery.description":
    "A second failure injection (at injected-failure-recovery, step 20) flips recovery-verification-failure to exercised as a NEW immutable ledger record — the unexercised registration stays as history.",
  "you.conformance.demo.step.runbook-claim-refusal.title": "Honest error: exercise claim without a journey",
  "you.conformance.demo.step.runbook-claim-refusal.description":
    "Claiming consent-revocation-lag exercised without a failure-injection journey is a typed YOU_RUNBOOK_INVALID refusal — the honest state is explicitly marked unexercised.",
  "you.conformance.demo.step.runbook-unknown-refusal.title": "Honest error: unknown incident class",
  "you.conformance.demo.step.runbook-unknown-refusal.description":
    "Exercising an unregistered incident class fails closed with a typed refusal — every runbook entry references a registered class.",
  "you.conformance.demo.step.final-state.title": "Final state overview",
  "you.conformance.demo.step.final-state.description":
    "The closing step recounts the whole ledger: reviews with acceptance links, simulated-labeled reports, verbatim audit counts, 20-point journey runs and the exercised/unexercised runbook split.",
};

const zhCN: Record<string, string> = {
  "you.conformance.demo.step.load.title": "加载一致性平面",
  "you.conformance.demo.step.load.description":
    "第一步负责加载：安全审查状态 / 负载测试报告 / 一致性审计 / journey 记录与 runbook 条目全部来自 controller 投影（固定注册面：审查 scope、负载 scenario、standard、journey、incident class；runbook 初始显式标注 unexercised）。",
  "you.conformance.demo.step.review-record-findings.title": "记录一次安全审查",
  "you.conformance.demo.step.review-record-findings.description":
    "render-pipeline scope 的 finding set verbatim 落账（findingsCount 绝不 summarize）；review 以 accepted: false 落账并 journal security-review-recorded 事件。",
  "you.conformance.demo.step.review-accept.title": "落账接受决定",
  "you.conformance.demo.step.review-accept.description":
    "acceptance 是独立不可变决定：一条引用同一 finding set 的新 SecurityReviewRecord（supersedes 链接）——绝非对 review 的原地改写。",
  "you.conformance.demo.step.review-accept-again.title": "诚实错误：重复接受",
  "you.conformance.demo.step.review-accept-again.description":
    "再次接受已接受的 review 是 typed YOU_SECURITY_REVIEW_INVALID 拒绝——acceptance 恰好发生一次；账本是 append-only 历史。",
  "you.conformance.demo.step.review-accept-zero-findings.title": "诚实错误：无 findings 的接受",
  "you.conformance.demo.step.review-accept-zero-findings.description":
    "empty-sweep scope verbatim 落账 0 findings，接受它是 typed 拒绝——acceptance 引用非空 finding set（SECURITY REVIEW LAW 的拒绝路径）。",
  "you.conformance.demo.step.review-unknown-scope.title": "诚实错误：未知 scope",
  "you.conformance.demo.step.review-unknown-scope.description":
    "在未注册 scope 上记录审查 fail-closed 为 typed YOU_SECURITY_REVIEW_INVALID——UI 绝不猜测 scope。",
  "you.conformance.demo.step.load-test-simulated.title": "记录 simulated-labeled 报告",
  "you.conformance.demo.step.load-test-simulated.description":
    "render-peak scenario 落账 peak 240 rps / p99 420ms（simulated-labeled）且两条回归 verbatim 列出——LOAD TEST LAW 的诚实报告面。",
  "you.conformance.demo.step.load-test-measured-refusal.title": "诚实错误：fixture 支撑面上的 measured",
  "you.conformance.demo.step.load-test-measured-refusal.description":
    "measured 运行在 fixture-simulated 支撑面上被拒绝——peak/p99 是 measured 或 simulated-labeled，fixture 绝不伪造前者（measured 报告随 T11 服务换绑而来）。",
  "you.conformance.demo.step.load-test-invented-refusal.title": "诚实错误：invented 指标",
  "you.conformance.demo.step.load-test-invented-refusal.description":
    "invented 数值绝不落账：typed YOU_LOAD_TEST_INVALID 拒绝即 LOAD TEST LAW 的发声——绝不静默、绝不 summarize away。",
  "you.conformance.demo.step.load-test-unregistered-refusal.title": "诚实错误：未注册 scenario",
  "you.conformance.demo.step.load-test-unregistered-refusal.description":
    "未注册的 scenario profile fail-closed 为 typed 拒绝——每份报告都引用已注册 scenario。",
  "you.conformance.demo.step.audit-partial.title": "partial 审计：27/30 verbatim",
  "you.conformance.demo.step.audit-partial.description":
    "WCAG 2.2 AA 审计落账 27/30——CONFORMANCE LAW verbatim 呈现两 counts；partial 绝不伪装成 pass。",
  "you.conformance.demo.step.audit-full.title": "full 审计：12/12 verbatim",
  "you.conformance.demo.step.audit-full.description":
    "responsive-320px 审计 12/12 全过，仍以 counts 显示——全过也绝不 bare pass。",
  "you.conformance.demo.step.audit-zero-checks-refusal.title": "诚实错误：零检查 standard",
  "you.conformance.demo.step.audit-zero-checks-refusal.description":
    "empty-checklist baseline 被拒绝——counts 即 conformance 陈述本身：无检查的 pass 绝不落账。",
  "you.conformance.demo.step.journey-simulated-full.title": "跑完整 20 点 journey",
  "you.conformance.demo.step.journey-simulated-full.description":
    "20 点 launch-gate journey 全部完成，携确定性 duration 且 simulated-labeled——每一步都以 completed 落账（JOURNEY LAW 显示面）。",
  "you.conformance.demo.step.journey-failure-injection.title": "在 render-submit 注入失败",
  "you.conformance.demo.step.journey-failure-injection.description":
    "failure-injection journey 在第 10 步（render-submit）失败并演练 render-provider-outage runbook——detection / containment / recovery 保持 verbatim 显示。",
  "you.conformance.demo.step.journey-out-of-range-refusal.title": "诚实错误：失败于第 21 步",
  "you.conformance.demo.step.journey-out-of-range-refusal.description":
    "失败步必须是 20 点 journey 的真实步骤（1..20 或 null）——第 21 步是 typed YOU_E2E_JOURNEY_INVALID 拒绝，绝不虚构。",
  "you.conformance.demo.step.journey-measured-refusal.title": "诚实错误：fixture 支撑面上的 measured run",
  "you.conformance.demo.step.journey-measured-refusal.description":
    "measured run 种类在 fixture-simulated harness 上被拒绝——simulated runs stay labeled；measured duration 随 T11 服务换绑而来。",
  "you.conformance.demo.step.journey-unknown-refusal.title": "诚实错误：未注册 journey",
  "you.conformance.demo.step.journey-unknown-refusal.description":
    "legacy journey profile fail-closed 为 typed 拒绝——每次 run 都引用已注册 journey。",
  "you.conformance.demo.step.runbook-exercise-recovery.title": "演练 recovery-verification class",
  "you.conformance.demo.step.runbook-exercise-recovery.description":
    "第二次失败注入（于第 20 步 injected-failure-recovery）把 recovery-verification-failure 翻转为 exercised——一条新的不可变账本记录；unexercised registration 保留为历史。",
  "you.conformance.demo.step.runbook-claim-refusal.title": "诚实错误：无 journey 的演练断言",
  "you.conformance.demo.step.runbook-claim-refusal.description":
    "无 failure-injection journey 却断言 consent-revocation-lag 已演练是 typed YOU_RUNBOOK_INVALID 拒绝——诚实态是显式标注 unexercised。",
  "you.conformance.demo.step.runbook-unknown-refusal.title": "诚实错误：未知 incident class",
  "you.conformance.demo.step.runbook-unknown-refusal.description":
    "演练未注册的 incident class fail-closed 为 typed 拒绝——每条 runbook 条目都引用已注册 class。",
  "you.conformance.demo.step.final-state.title": "终态总览",
  "you.conformance.demo.step.final-state.description":
    "收尾步骤复述整个账本：带 acceptance 链接的 review、simulated-labeled 报告、verbatim 审计 counts、20 点 journey run 与 exercised / unexercised 的 runbook 分布。",
};

export const CONFORMANCE_DEMO_STEP_MESSAGES_EN_US: Record<string, string> = enUS;

export const CONFORMANCE_DEMO_STEP_MESSAGES_ZH_CN: Record<string, string> = zhCN;
