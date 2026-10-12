// YOU Learning Studio — demo 步骤文案表（W6B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/哈希——与 W4B/W5B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.learning.demo.step.scope-pick.title": "Pick the scope (load the plane)",
  "you.learning.demo.step.scope-pick.description":
    "First step owns load; the scope ladder renders from the controller's frozen scope taxonomy (GLOBAL→TASK), never hardcoded in the UI.",
  "you.learning.demo.step.kind-pick.title": "Pick the signal kind",
  "you.learning.demo.step.kind-pick.description":
    "The teach-me kind picker renders the six frozen kinds from the registry projection; an unknown kind is a typed refusal.",
  "you.learning.demo.step.signal-invalid.title": "Honest error: YOU_LEARNING_SIGNAL_INVALID",
  "you.learning.demo.step.signal-invalid.description":
    "Unknown kind \"telepathy\" refused statelessly; nothing captured, nothing silently repaired.",
  "you.learning.demo.step.signal-feedback.title": "Capture the feedback signal",
  "you.learning.demo.step.signal-feedback.description":
    "teach-me confirmation captured with content-addressed evidence labels; the learning-signal-captured event is appended.",
  "you.learning.demo.step.signal-sweep.title": "Capture the remaining five kinds",
  "you.learning.demo.step.signal-sweep.description":
    "manual-takeover, edit-session, expert-intervention, repeated-intent and capability-gap — all six frozen kinds on the plane.",
  "you.learning.demo.step.content-synthesize.title": "Synthesize validated content",
  "you.learning.demo.step.content-synthesize.description":
    "Same seed ⇒ same contentRef/contentHash; the content itself is never inlined in any record or event.",
  "you.learning.demo.step.rights-gate.title": "Honest error: rights gate (issuance)",
  "you.learning.demo.step.rights-gate.description":
    "Issuance is enforcement: without a granted learning consent, no LearningRights and records stay inert.",
  "you.learning.demo.step.consent-grant.title": "Grant learning consent",
  "you.learning.demo.step.consent-grant.description":
    "Purpose \"learning\" through the wave-2 authority shapes — no second consent path.",
  "you.learning.demo.step.rights-issue.title": "Issue LearningRights",
  "you.learning.demo.step.rights-issue.description":
    "Usage classes bound to consentRef + consentHash, traceable to the wave-2 consent authority.",
  "you.learning.demo.step.record-candidates.title": "Open candidate records",
  "you.learning.demo.step.record-candidates.description":
    "One bound-rights candidate + one inert candidate (no rights); candidates are pre-validation service state — no ledger event yet.",
  "you.learning.demo.step.record-validate.title": "Validate the record",
  "you.learning.demo.step.record-validate.description":
    "learning-record-validated appended with the usage classes and consent linkage in its payload.",
  "you.learning.demo.step.record-use.title": "Use the record (within grant)",
  "you.learning.demo.step.record-use.description":
    "Eight-step rights evaluation passes: the usage is inside the grant and the live consent still matches.",
  "you.learning.demo.step.preference-derive.title": "Derive a preference",
  "you.learning.demo.step.preference-derive.description":
    "derivedFromRecordId lineage; the record stays the source of truth — preferences are projections.",
  "you.learning.demo.step.inert-validate.title": "Validate the inert record",
  "you.learning.demo.step.inert-validate.description":
    "Records without rights exist and climb the ladder — but stay inert for every use.",
  "you.learning.demo.step.inert-refusal.title": "Honest error: rights-inert",
  "you.learning.demo.step.inert-refusal.description":
    "The validated-but-inert record refuses every use typed; transparency over silent skipping.",
  "you.learning.demo.step.record-reject.title": "Reject a record (terminal)",
  "you.learning.demo.step.record-reject.description":
    "learning-record-rejected appended; rejected is terminal on the frozen ladder and the record is replaced immutably.",
  "you.learning.demo.step.rejected-unusable.title": "Honest error: rejected record unusable",
  "you.learning.demo.step.rejected-unusable.description":
    "Only validated learning is usable; the typed refusal is honest about it.",
  "you.learning.demo.step.record-supersede.title": "Supersede via linkage",
  "you.learning.demo.step.record-supersede.description":
    "The successor validates with supersedesRecordId; the superseded record keeps its id and validation moment.",
  "you.learning.demo.step.superseded-unusable.title": "Honest error: superseded record unusable",
  "you.learning.demo.step.superseded-unusable.description":
    "The successor carries the validated truth; the ledger view shows the supersededById linkage.",
  "you.learning.demo.step.usage-outside-grant.title": "Honest error: usage outside grant",
  "you.learning.demo.step.usage-outside-grant.description":
    "pipeline-improvement is outside the [personalization, tool-selection] grant — a typed YOU_LEARNING_RIGHTS_REQUIRED refusal.",
  "you.learning.demo.step.operator-preference.title": "Seed an operator preference",
  "you.learning.demo.step.operator-preference.description":
    "An operator seed (derivedFromRecordId null) — a projected intent through the controller port, no rights gate.",
  "you.learning.demo.step.preference-clear.title": "Clear the operator seed",
  "you.learning.demo.step.preference-clear.description":
    "The clear is a projected intent journaled as preference-updated with the cleared marker; the append-only ledger keeps the fact.",
  "you.learning.demo.step.derived-clear-refused.title": "Honest error: derived preference is a projection",
  "you.learning.demo.step.derived-clear-refused.description":
    "Derived preferences follow the record ladder; only the operator seed is directly clearable.",
  "you.learning.demo.step.preference-scope-invalid.title": "Honest error: YOU_PREFERENCE_SCOPE_INVALID",
  "you.learning.demo.step.preference-scope-invalid.description":
    "A TENANT derivation of a USER-scoped record would widen the scope — derived preferences never widen or narrow.",
  "you.learning.demo.step.trajectory-record.title": "Record a trajectory",
  "you.learning.demo.step.trajectory-record.description":
    "Seed-derived content-addressed step refs; the step list renders labels only — never inlined content.",
  "you.learning.demo.step.trajectory-replay.title": "Replay deterministically",
  "you.learning.demo.step.trajectory-replay.description":
    "Same seed ⇒ byte-identical replay and the same replay hash; the identity is checkable, never asserted.",
  "you.learning.demo.step.record-not-found.title": "Honest error: YOU_LEARNING_RECORD_NOT_FOUND",
  "you.learning.demo.step.record-not-found.description":
    "Unknown record ids are typed refusals rendered as a typed error panel, never a guess.",
  "you.learning.demo.step.consent-withdraw.title": "Withdraw learning consent",
  "you.learning.demo.step.consent-withdraw.description":
    "The withdrawal routes through the wave-2 consent authority port; there is no second consent path to forget.",
  "you.learning.demo.step.post-withdrawal-refusal.title": "Honest error: fail closed after withdrawal",
  "you.learning.demo.step.post-withdrawal-refusal.description":
    "The live grant state check fires before the hash check — the previously-usable record now refuses every use.",
};

const zhCN: Record<string, string> = {
  "you.learning.demo.step.scope-pick.title": "挑选范围（加载平面）",
  "you.learning.demo.step.scope-pick.description":
    "首步负责加载；scope 阶梯由控制器的 frozen scope 分类学投影渲染（GLOBAL→TASK），绝非 UI 硬编码。",
  "you.learning.demo.step.kind-pick.title": "挑选信号类型",
  "you.learning.demo.step.kind-pick.description":
    "teach-me 类型选择器按注册面投影渲染六种 frozen 类型；未知类型是 typed 拒绝。",
  "you.learning.demo.step.signal-invalid.title": "诚实错误：YOU_LEARNING_SIGNAL_INVALID",
  "you.learning.demo.step.signal-invalid.description":
    "未知类型 \"telepathy\" 被无状态拒绝；不捕获、不静默修复。",
  "you.learning.demo.step.signal-feedback.title": "捕获反馈信号",
  "you.learning.demo.step.signal-feedback.description":
    "teach-me 确认以内容寻址证据标签捕获；追加 learning-signal-captured 事件。",
  "you.learning.demo.step.signal-sweep.title": "捕获其余五种类型",
  "you.learning.demo.step.signal-sweep.description":
    "manual-takeover、edit-session、expert-intervention、repeated-intent 与 capability-gap——六种 frozen 类型全部上平面。",
  "you.learning.demo.step.content-synthesize.title": "合成 validated content",
  "you.learning.demo.step.content-synthesize.description":
    "同 seed ⇒ 同 contentRef/contentHash；内容本身绝不内联进任何记录或事件。",
  "you.learning.demo.step.rights-gate.title": "诚实错误：同意门（签发）",
  "you.learning.demo.step.rights-gate.description":
    "签发即强制：learning 用途未授予即无 LearningRights，记录保持惰性。",
  "you.learning.demo.step.consent-grant.title": "授予 learning 同意",
  "you.learning.demo.step.consent-grant.description":
    "按用途 \"learning\" 走 wave-2 权威形状——不存在第二条同意路径。",
  "you.learning.demo.step.rights-issue.title": "签发 LearningRights",
  "you.learning.demo.step.rights-issue.description":
    "usage 类别绑定 consentRef + consentHash，可溯源至 wave-2 同意权威。",
  "you.learning.demo.step.record-candidates.title": "打开候选记录",
  "you.learning.demo.step.record-candidates.description":
    "一条绑定 rights 的候选 + 一条惰性候选（无 rights）；candidate 是 pre-validation 服务状态——尚不落事件。",
  "you.learning.demo.step.record-validate.title": "验证记录",
  "you.learning.demo.step.record-validate.description":
    "追加 learning-record-validated，载荷携带 usage 类别与同意链接。",
  "you.learning.demo.step.record-use.title": "使用记录（授予内）",
  "you.learning.demo.step.record-use.description":
    "八步 rights 评估通过：usage 在授予内且 live 同意仍匹配。",
  "you.learning.demo.step.preference-derive.title": "派生偏好",
  "you.learning.demo.step.preference-derive.description":
    "derivedFromRecordId lineage；记录保持真相源——偏好只是投影。",
  "you.learning.demo.step.inert-validate.title": "验证惰性记录",
  "you.learning.demo.step.inert-validate.description":
    "无 rights 的记录存在且可爬阶梯——但一切使用保持被拒。",
  "you.learning.demo.step.inert-refusal.title": "诚实错误：rights-inert",
  "you.learning.demo.step.inert-refusal.description":
    "validated 但惰性的记录 typed 拒绝一切使用；透明优先于静默跳过。",
  "you.learning.demo.step.record-reject.title": "拒绝记录（终态）",
  "you.learning.demo.step.record-reject.description":
    "追加 learning-record-rejected；rejected 是 frozen 阶梯终态，记录经不可变替换落账。",
  "you.learning.demo.step.rejected-unusable.title": "诚实错误：rejected 记录不可用",
  "you.learning.demo.step.rejected-unusable.description":
    "只有 validated 学习可用；typed 拒绝对此保持诚实。",
  "you.learning.demo.step.record-supersede.title": "经链接顶替",
  "you.learning.demo.step.record-supersede.description":
    "后继者携带 supersedesRecordId 验证；被顶替记录保留自己的 id 与验证时刻。",
  "you.learning.demo.step.superseded-unusable.title": "诚实错误：superseded 记录不可用",
  "you.learning.demo.step.superseded-unusable.description":
    "后继者承载 validated 真相；账本视图展示 supersededById 链接。",
  "you.learning.demo.step.usage-outside-grant.title": "诚实错误：授予外使用",
  "you.learning.demo.step.usage-outside-grant.description":
    "pipeline-improvement 在 [personalization, tool-selection] 授予之外——typed YOU_LEARNING_RIGHTS_REQUIRED 拒绝。",
  "you.learning.demo.step.operator-preference.title": "种子一条操作员偏好",
  "you.learning.demo.step.operator-preference.description":
    "操作员种子（derivedFromRecordId null）——经 controller 端口的投射意图，无 rights 门。",
  "you.learning.demo.step.preference-clear.title": "清除操作员种子",
  "you.learning.demo.step.preference-clear.description":
    "清除是投射意图，以带 cleared 标记的 preference-updated 事件落账；append-only 账本保留事实。",
  "you.learning.demo.step.derived-clear-refused.title": "诚实错误：派生偏好是投影",
  "you.learning.demo.step.derived-clear-refused.description":
    "派生偏好跟随记录阶梯；只有操作员种子可直接清除。",
  "you.learning.demo.step.preference-scope-invalid.title": "诚实错误：YOU_PREFERENCE_SCOPE_INVALID",
  "you.learning.demo.step.preference-scope-invalid.description":
    "对 USER 范围记录做 TENANT 派生会扩宽范围——派生偏好绝不扩缩。",
  "you.learning.demo.step.trajectory-record.title": "记录 trajectory",
  "you.learning.demo.step.trajectory-record.description":
    "seed 派生的内容寻址步骤引用；步骤列表只渲染标签——绝不内联内容。",
  "you.learning.demo.step.trajectory-replay.title": "确定性重放",
  "you.learning.demo.step.trajectory-replay.description":
    "同 seed ⇒ 字节一致重放与同一重放摘要；恒等可校验，绝不凭空断言。",
  "you.learning.demo.step.record-not-found.title": "诚实错误：YOU_LEARNING_RECORD_NOT_FOUND",
  "you.learning.demo.step.record-not-found.description":
    "未知记录 id 是 typed 拒绝，以 typed 错误面板呈现，绝不猜测。",
  "you.learning.demo.step.consent-withdraw.title": "撤回 learning 同意",
  "you.learning.demo.step.consent-withdraw.description":
    "撤回经 wave-2 同意权威端口；不存在会被遗忘的第二条同意路径。",
  "you.learning.demo.step.post-withdrawal-refusal.title": "诚实错误：撤回后 fail closed",
  "you.learning.demo.step.post-withdrawal-refusal.description":
    "live 授权状态检查先于哈希检查——先前可用的记录现在拒绝一切使用。",
};

export const LEARNING_DEMO_STEP_MESSAGES_EN_US: Record<string, string> = enUS;
export const LEARNING_DEMO_STEP_MESSAGES_ZH_CN: Record<string, string> = zhCN;
