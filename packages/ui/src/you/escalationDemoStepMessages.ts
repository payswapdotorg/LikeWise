// YOU Escalation Studio — demo 步骤文案表（W8B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/哈希——与 W4B-W7B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.escalation.demo.step.load.title": "Load the escalation plane",
  "you.escalation.demo.step.load.description":
    "First step owns load; the authorization gate, status ladder and expert-result review all render from controller projections (frozen taxonomies + retry policy + provider registry).",
  "you.escalation.demo.step.gap-open.title": "Record the first capability gap",
  "you.escalation.demo.step.gap-open.description":
    "A TOOL_GAP record with attempted strategies and content-addressed failure evidence; capability-gap-detected is journaled.",
  "you.escalation.demo.step.gap-sweep.title": "Record the remaining gap classes",
  "you.escalation.demo.step.gap-sweep.description":
    "All seven frozen categories plus one low-confidence (not-eligible) record — gap persistence never refuses records.",
  "you.escalation.demo.step.gap-ineligible.title": "Honest error: not-escalation-eligible",
  "you.escalation.demo.step.gap-ineligible.description":
    "The v1 eligibility rule (>= 1 strategy, confidence >= 0.5) refuses the escalation request with YOU_ESCALATION_STATE_INVALID.",
  "you.escalation.demo.step.projection-tool.title": "Publish a ToolGap projection",
  "you.escalation.demo.step.projection-tool.description":
    "Derived tool-domain remediation view (gap-projection-published); projections are never authorities.",
  "you.escalation.demo.step.projection-knowledge.title": "Publish a KnowledgeGap projection",
  "you.escalation.demo.step.projection-knowledge.description":
    "Derived knowledge-domain remediation view with a content-addressed missing-knowledge label.",
  "you.escalation.demo.step.projection-invalid.title": "Honest error: YOU_GAP_PROJECTION_INVALID",
  "you.escalation.demo.step.projection-invalid.description":
    "Unknown projection kind \"process\" is a typed refusal — the projection builder never guesses.",
  "you.escalation.demo.step.policy-invalid.title": "Honest error: YOU_RETRY_POLICY_INVALID",
  "you.escalation.demo.step.policy-invalid.description":
    "maxAttempts 0 violates the [1,10] attempt bounds; the stateless validator refuses without configuring anything.",
  "you.escalation.demo.step.escalation-request.title": "Request the first escalation",
  "you.escalation.demo.step.escalation-request.description":
    "The v1 ladder opens at requested with the minimum context capsule and the gap's required scope.",
  "you.escalation.demo.step.unauthorized-run.title": "Honest error: unauthorized run",
  "you.escalation.demo.step.unauthorized-run.description":
    "Starting a run without a grant is YOU_ESCALATION_AUTHORIZATION_REQUIRED — an escalation NEVER runs unauthorized.",
  "you.escalation.demo.step.grant-invalid.title": "Honest error: invalid grant shape",
  "you.escalation.demo.step.grant-invalid.description":
    "A blank scope is YOU_ESCALATION_STATE_INVALID; grant shape is validated before anything is recorded.",
  "you.escalation.demo.step.grant-aggregate.title": "Grant authorization (aggregate)",
  "you.escalation.demo.step.grant-aggregate.description":
    "Scope + no expiry + learning permission \"aggregate\": the immutable record moves the ladder to authorized and journals both grant events.",
  "you.escalation.demo.step.run-start.title": "Start the first arena run",
  "you.escalation.demo.step.run-start.description":
    "The append-only run ladder opens (attempt 1) and the escalation moves to in-progress.",
  "you.escalation.demo.step.run-fail.title": "Fail the run (honest retry path)",
  "you.escalation.demo.step.run-fail.description":
    "started -> failed is a locked terminal; the retry policy is the only re-entry.",
  "you.escalation.demo.step.run-retry.title": "Retry within policy bounds",
  "you.escalation.demo.step.run-retry.description":
    "Attempt 2 appends to the run ladder — a retry never resets it.",
  "you.escalation.demo.step.provider-unknown.title": "Honest error: YOU_ARENA_ADAPTER_UNSUPPORTED",
  "you.escalation.demo.step.provider-unknown.description":
    "Unknown provider ids fail closed at the provider-neutral seam — never a silent fallback.",
  "you.escalation.demo.step.deliver-typed-payload.title": "Deliver the typed-payload result",
  "you.escalation.demo.step.deliver-typed-payload.description":
    "The ARENA BOUNDARY LAW: the result returns as a typed payload; the active run completes with content-addressed evidence.",
  "you.escalation.demo.step.apply-result.title": "Apply the expert result",
  "you.escalation.demo.step.apply-result.description":
    "applies-as-changeset is a projected intent through YOU's own authority (arena-result-applied).",
  "you.escalation.demo.step.escalation-request-expert.title": "Request the expert-gap escalation",
  "you.escalation.demo.step.escalation-request-expert.description":
    "The second escalation walks the artifact-result path.",
  "you.escalation.demo.step.grant-expired.title": "Grant with a past expiry",
  "you.escalation.demo.step.grant-expired.description":
    "Shape-valid and honestly recorded — an expired-at-issuance grant simply never authorizes.",
  "you.escalation.demo.step.expired-run.title": "Honest error: expired authorization",
  "you.escalation.demo.step.expired-run.description":
    "The live gate compares the immutable grant against the projection clock and fails closed.",
  "you.escalation.demo.step.regrant-full.title": "Renew as a new record (full)",
  "you.escalation.demo.step.regrant-full.description":
    "Renewal appends a fresh grant to the ledger — nothing is mutated, the ladder never rewinds.",
  "you.escalation.demo.step.deliver-artifact.title": "Deliver the artifact result",
  "you.escalation.demo.step.deliver-artifact.description":
    "Artifact results carry content-addressed labels only; bytes are never inlined.",
  "you.escalation.demo.step.reject-result.title": "Reject the expert result",
  "you.escalation.demo.step.reject-result.description":
    "delivered -> rejected is a locked terminal with an explicit reason (no frozen event type — disclosed).",
  "you.escalation.demo.step.escalation-request-knowledge.title": "Request the knowledge-gap escalation",
  "you.escalation.demo.step.escalation-request-knowledge.description":
    "The third escalation walks the permission-withdrawal path.",
  "you.escalation.demo.step.grant-none.title": "Grant with learning permission none",
  "you.escalation.demo.step.grant-none.description":
    "Authorized to run, forbidden to teach — the permission is an explicit user decision.",
  "you.escalation.demo.step.run-start-knowledge.title": "Start the knowledge-gap run",
  "you.escalation.demo.step.run-start-knowledge.description":
    "In-progress under a live none-permission grant.",
  "you.escalation.demo.step.permission-withdraw.title": "Withdraw the authorization",
  "you.escalation.demo.step.permission-withdraw.description":
    "Withdrawal is a new ledger record (learningPermission none) — the wave-6 rights-law pattern at the arena boundary.",
  "you.escalation.demo.step.post-withdrawal-refusal.title": "Honest error: withdrawn authorization",
  "you.escalation.demo.step.post-withdrawal-refusal.description":
    "After withdrawal the gate fails closed live; the started run stays untouched on the ladder.",
  "you.escalation.demo.step.cancel-escalation.title": "Cancel the escalation",
  "you.escalation.demo.step.cancel-escalation.description":
    "escalation-cancelled is journaled and the started run closes as aborted; terminals never reopen.",
  "you.escalation.demo.step.not-found-refusals.title": "Honest errors: unknown ids",
  "you.escalation.demo.step.not-found-refusals.description":
    "YOU_ESCALATION_NOT_FOUND and YOU_ARENA_RUN_NOT_FOUND — records are addressed by immutable ids, never guessed.",
  "you.escalation.demo.step.terminal-refusal.title": "Honest error: locked terminal",
  "you.escalation.demo.step.terminal-refusal.description":
    "Re-applying an applied escalation is YOU_ESCALATION_STATE_INVALID — the transition table refuses every illegal edge.",
};

const zhCN: Record<string, string> = {
  "you.escalation.demo.step.load.title": "加载升级平面",
  "you.escalation.demo.step.load.description":
    "首步负责加载；授权门、状态阶梯与专家结果审阅全部由 controller 投影渲染（frozen 分类学 + 重试策略 + provider 注册面）。",
  "you.escalation.demo.step.gap-open.title": "记录首个能力缺口",
  "you.escalation.demo.step.gap-open.description":
    "一条 TOOL_GAP 记录：尝试策略 + 内容寻址失败证据；capability-gap-detected 落账。",
  "you.escalation.demo.step.gap-sweep.title": "记录其余缺口分类",
  "you.escalation.demo.step.gap-sweep.description":
    "七种 frozen 分类全覆盖 + 一条低置信度（不可升级）记录——gap 持久化从不拒绝记录。",
  "you.escalation.demo.step.gap-ineligible.title": "诚实错误：不可升级",
  "you.escalation.demo.step.gap-ineligible.description":
    "v1 资格规则（≥1 策略、置信度 ≥ 0.5）以 YOU_ESCALATION_STATE_INVALID 拒绝升级请求。",
  "you.escalation.demo.step.projection-tool.title": "发布 ToolGap 投影",
  "you.escalation.demo.step.projection-tool.description":
    "派生的工具域 remediation 视图（gap-projection-published 落账）；投影绝非权威。",
  "you.escalation.demo.step.projection-knowledge.title": "发布 KnowledgeGap 投影",
  "you.escalation.demo.step.projection-knowledge.description":
    "派生的知识域 remediation 视图，携带内容寻址的缺失知识标签。",
  "you.escalation.demo.step.projection-invalid.title": "诚实错误：YOU_GAP_PROJECTION_INVALID",
  "you.escalation.demo.step.projection-invalid.description":
    "未知投影类型 \"process\" 是 typed 拒绝——投影构建器绝不猜测。",
  "you.escalation.demo.step.policy-invalid.title": "诚实错误：YOU_RETRY_POLICY_INVALID",
  "you.escalation.demo.step.policy-invalid.description":
    "maxAttempts 0 违反 [1,10] 尝试界；无状态校验器拒绝且不配置任何内容。",
  "you.escalation.demo.step.escalation-request.title": "请求首个升级",
  "you.escalation.demo.step.escalation-request.description":
    "v1 阶梯自 requested 开档：最小上下文胶囊 + gap 的要求范围。",
  "you.escalation.demo.step.unauthorized-run.title": "诚实错误：无授权运行",
  "you.escalation.demo.step.unauthorized-run.description":
    "无授权启动 run 即 YOU_ESCALATION_AUTHORIZATION_REQUIRED——升级绝不在无授权下运行。",
  "you.escalation.demo.step.grant-invalid.title": "诚实错误：非法授权形状",
  "you.escalation.demo.step.grant-invalid.description":
    "空白 scope 是 YOU_ESCALATION_STATE_INVALID；落账前先做形状校验。",
  "you.escalation.demo.step.grant-aggregate.title": "授予授权（aggregate）",
  "you.escalation.demo.step.grant-aggregate.description":
    "范围 + 无过期 + learning permission \"aggregate\"：不可变记录把阶梯推进到 authorized 并落账双事件。",
  "you.escalation.demo.step.run-start.title": "启动首个 arena run",
  "you.escalation.demo.step.run-start.description":
    "append-only run 阶梯开档（attempt 1），升级转入 in-progress。",
  "you.escalation.demo.step.run-fail.title": "run 失败（诚实重试路径）",
  "you.escalation.demo.step.run-fail.description":
    "started -> failed 是锁定终态；重试策略是唯一再入口。",
  "you.escalation.demo.step.run-retry.title": "在策略界内重试",
  "you.escalation.demo.step.run-retry.description":
    "attempt 2 追加到 run 阶梯——重试绝不重置阶梯。",
  "you.escalation.demo.step.provider-unknown.title": "诚实错误：YOU_ARENA_ADAPTER_UNSUPPORTED",
  "you.escalation.demo.step.provider-unknown.description":
    "未知 provider 在 provider 中立接缝处 fail closed——绝不静默回退。",
  "you.escalation.demo.step.deliver-typed-payload.title": "交付 typed-payload 结果",
  "you.escalation.demo.step.deliver-typed-payload.description":
    "ARENA BOUNDARY LAW：结果以 typed payload 返回；活跃 run 以内容寻址证据完成。",
  "you.escalation.demo.step.apply-result.title": "应用专家结果",
  "you.escalation.demo.step.apply-result.description":
    "applies-as-changeset 是经 YOU 自身权威的投射意图（arena-result-applied 落账）。",
  "you.escalation.demo.step.escalation-request-expert.title": "请求专家缺口升级",
  "you.escalation.demo.step.escalation-request-expert.description":
    "第二个升级走 artifact 结果路径。",
  "you.escalation.demo.step.grant-expired.title": "以过去时刻为过期授予",
  "you.escalation.demo.step.grant-expired.description":
    "形状合法、诚实落账——签发即过期的授权只是永不生效。",
  "you.escalation.demo.step.expired-run.title": "诚实错误：授权已过期",
  "you.escalation.demo.step.expired-run.description":
    "live 门以投影时钟比对不可变授权并 fail closed。",
  "you.escalation.demo.step.regrant-full.title": "续期即新记录（full）",
  "you.escalation.demo.step.regrant-full.description":
    "续期向账本追加新授权——绝不改写，阶梯绝不回退。",
  "you.escalation.demo.step.deliver-artifact.title": "交付 artifact 结果",
  "you.escalation.demo.step.deliver-artifact.description":
    "artifact 结果仅携带内容寻址标签；字节绝不内联。",
  "you.escalation.demo.step.reject-result.title": "拒绝专家结果",
  "you.escalation.demo.step.reject-result.description":
    "delivered -> rejected 是带显式理由的锁定终态（无 frozen 事件类型——如实披露）。",
  "you.escalation.demo.step.escalation-request-knowledge.title": "请求知识缺口升级",
  "you.escalation.demo.step.escalation-request-knowledge.description":
    "第三个升级走许可撤回路径。",
  "you.escalation.demo.step.grant-none.title": "以 learning permission none 授予",
  "you.escalation.demo.step.grant-none.description":
    "可运行、不可教学——许可是显式用户决定。",
  "you.escalation.demo.step.run-start-knowledge.title": "启动知识缺口 run",
  "you.escalation.demo.step.run-start-knowledge.description":
    "在 live 的 none-permission 授权下进入 in-progress。",
  "you.escalation.demo.step.permission-withdraw.title": "撤回授权",
  "you.escalation.demo.step.permission-withdraw.description":
    "撤回是账本新记录（learningPermission none）——wave-6 权利法模式延伸到 arena 边界。",
  "you.escalation.demo.step.post-withdrawal-refusal.title": "诚实错误：授权已撤回",
  "you.escalation.demo.step.post-withdrawal-refusal.description":
    "撤回后 live 门 fail closed；已启动的 run 原样留在阶梯上。",
  "you.escalation.demo.step.cancel-escalation.title": "取消升级",
  "you.escalation.demo.step.cancel-escalation.description":
    "escalation-cancelled 落账，已启动 run 以 aborted 收口；终态绝不重开。",
  "you.escalation.demo.step.not-found-refusals.title": "诚实错误：未知 id",
  "you.escalation.demo.step.not-found-refusals.description":
    "YOU_ESCALATION_NOT_FOUND 与 YOU_ARENA_RUN_NOT_FOUND——记录以不可变 id 寻址，绝不猜测。",
  "you.escalation.demo.step.terminal-refusal.title": "诚实错误：终态锁定",
  "you.escalation.demo.step.terminal-refusal.description":
    "对已 applied 的升级再应用即 YOU_ESCALATION_STATE_INVALID——转移表拒绝一切非法边。",
};

export const ESCALATION_DEMO_STEP_MESSAGES_EN_US: Readonly<Record<string, string>> = enUS;
export const ESCALATION_DEMO_STEP_MESSAGES_ZH_CN: Readonly<Record<string, string>> = zhCN;
