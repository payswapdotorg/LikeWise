// YOU Editing Studio — demo 步骤文案表（W5B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/哈希——保持与 W4B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.editing.demo.step.subject-pick.title": "Pick subject artifact",
  "you.editing.demo.step.subject-pick.description":
    "Content-addressed subject registered into the editing plane (origin plane keeps its truth).",
  "you.editing.demo.step.session-open.title": "Open native session",
  "you.editing.demo.step.session-open.description":
    "open → committed | abandoned ladder with terminals locked; editor kind native (tier 1).",
  "you.editing.demo.step.ops-compose.title": "Compose ordered ops",
  "you.editing.demo.step.ops-compose.description":
    "Three ops (transform/material/annotation) with content-addressed payloads — never inlined.",
  "you.editing.demo.step.changeset-preview.title": "Deterministic candidate preview",
  "you.editing.demo.step.changeset-preview.description":
    "Pure projection: same parent + same ops ⇒ same digest; no ids, no clock, no journal.",
  "you.editing.demo.step.changeset-propose.title": "Propose change set",
  "you.editing.demo.step.changeset-propose.description":
    "Stateless validation first; change-proposed journaled append-only.",
  "you.editing.demo.step.changeset-apply.title": "Apply → candidate version",
  "you.editing.demo.step.changeset-apply.description":
    "Immutable content-addressed CandidateVersion; parent → candidate lineage registered.",
  "you.editing.demo.step.candidate-accept.title": "Accept candidate",
  "you.editing.demo.step.candidate-accept.description":
    "v1 change-accepted event — append-only, exactly once, no second authority path.",
  "you.editing.demo.step.changeset-2.title": "Nested lineage",
  "you.editing.demo.step.changeset-2.description":
    "Second change set applied onto the earlier candidate (candidate as parent).",
  "you.editing.demo.step.candidate-reject.title": "Reject candidate (revert)",
  "you.editing.demo.step.candidate-reject.description":
    "v1 change-rejected event; the parent stays canonical — rejecting never mutates the parent.",
  "you.editing.demo.step.changeset-invalid.title": "Honest error: YOU_CHANGESET_INVALID",
  "you.editing.demo.step.changeset-invalid.description":
    "Empty op list refused typed; nothing journaled, nothing silently repaired.",
  "you.editing.demo.step.editor-unsupported.title": "Honest error: YOU_EDITOR_UNSUPPORTED",
  "you.editing.demo.step.editor-unsupported.description":
    "Unregistered editor kind refused; no silent fallback to another editor.",
  "you.editing.demo.step.session-not-found.title": "Honest error: YOU_EDIT_SESSION_NOT_FOUND",
  "you.editing.demo.step.session-not-found.description":
    "Unknown session ids are typed refusals rendered as a typed error panel.",
  "you.editing.demo.step.external-session.title": "Open external session (tier 3)",
  "you.editing.demo.step.external-session.description":
    "External sessions launch through consent-gated projected flows, never ambient process control.",
  "you.editing.demo.step.launch-gate.title": "Honest error: consent gate (launch)",
  "you.editing.demo.step.launch-gate.description":
    "No permission ⇒ no launch — the service independently refuses (YOU_CONSENT_REQUIRED).",
  "you.editing.demo.step.consent-grant.title": "Grant external-launch consent",
  "you.editing.demo.step.consent-grant.description":
    "Operational consent per purpose (export) — wave-2 authority shapes, no second consent path.",
  "you.editing.demo.step.external-launch.title": "Project launch intent + package",
  "you.editing.demo.step.external-launch.description":
    "Projected intent through the controller seam carrying a tier-4 interchange package.",
  "you.editing.demo.step.export.title": "Tier-4 export (deterministic)",
  "you.editing.demo.step.export.description":
    "Deterministic assembly: same session state ⇒ same content-addressed package.",
  "you.editing.demo.step.import-roundtrip.title": "Import round-trip identity check",
  "you.editing.demo.step.import-roundtrip.description":
    "Export bytes imported back; digests compared — the identity is checkable, never asserted.",
  "you.editing.demo.step.import-invalid.title": "Honest error: YOU_IMPORT_EXPORT_FAILED",
  "you.editing.demo.step.import-invalid.description":
    "Corrupt bytes: failed ImportExportResult journaled honestly + typed refusal.",
  "you.editing.demo.step.takeover-gate.title": "Honest error: consent gate (takeover)",
  "you.editing.demo.step.takeover-gate.description":
    "Takeover confirmation renders from consent-state projections; without permission it is refused.",
  "you.editing.demo.step.takeover-confirm.title": "Confirm manual takeover",
  "you.editing.demo.step.takeover-confirm.description":
    "Append-only confirmation: the user takes the editing wheel; the agent stops editing.",
  "you.editing.demo.step.session-commit.title": "Commit session (terminal)",
  "you.editing.demo.step.session-commit.description":
    "open → committed terminal; the record is replaced immutably, never edited in place.",
  "you.editing.demo.step.session-terminal-locked.title": "Honest error: terminal locked",
  "you.editing.demo.step.session-terminal-locked.description":
    "Illegal transition from a terminal status is a typed refusal, never a silent no-op.",
  "you.editing.demo.step.session-abandon.title": "Abandon session (terminal)",
  "you.editing.demo.step.session-abandon.description":
    "open → abandoned terminal; the plane ends with one committed and one abandoned session.",
};

const zhCN: Record<string, string> = {
  "you.editing.demo.step.subject-pick.title": "挑选编辑对象",
  "you.editing.demo.step.subject-pick.description":
    "内容寻址 subject 注册进编辑平面（来源平面保有真相）。",
  "you.editing.demo.step.session-open.title": "打开 native 会话",
  "you.editing.demo.step.session-open.description":
    "open → committed | abandoned 阶梯，终态锁定；editor kind native（tier 1）。",
  "you.editing.demo.step.ops-compose.title": "组合有序 op",
  "you.editing.demo.step.ops-compose.description":
    "三条 op（transform/material/annotation），载荷内容寻址——绝不内联。",
  "you.editing.demo.step.changeset-preview.title": "候选确定性预览",
  "you.editing.demo.step.changeset-preview.description":
    "纯投影：同 parent + 同 ops ⇒ 同摘要；不分配 id、不推进时钟、不落账。",
  "you.editing.demo.step.changeset-propose.title": "提议变更集",
  "you.editing.demo.step.changeset-propose.description":
    "无状态校验最先；change-proposed 以 append-only 入账。",
  "you.editing.demo.step.changeset-apply.title": "应用 → 候选版本",
  "you.editing.demo.step.changeset-apply.description":
    "不可变内容寻址 CandidateVersion；parent → candidate 谱系注册。",
  "you.editing.demo.step.candidate-accept.title": "接受候选",
  "you.editing.demo.step.candidate-accept.description":
    "v1 change-accepted 事件——append-only、恰一次、无第二条权威路径。",
  "you.editing.demo.step.changeset-2.title": "嵌套谱系",
  "you.editing.demo.step.changeset-2.description":
    "第二条变更集应用到先前候选（候选作 parent）。",
  "you.editing.demo.step.candidate-reject.title": "拒绝候选（回退）",
  "you.editing.demo.step.candidate-reject.description":
    "v1 change-rejected 事件；parent 保持 canonical——拒绝绝不改动 parent。",
  "you.editing.demo.step.changeset-invalid.title": "诚实错误：YOU_CHANGESET_INVALID",
  "you.editing.demo.step.changeset-invalid.description":
    "空 op 列表 typed 拒绝；不落账、不静默修复。",
  "you.editing.demo.step.editor-unsupported.title": "诚实错误：YOU_EDITOR_UNSUPPORTED",
  "you.editing.demo.step.editor-unsupported.description":
    "未注册 editor kind 拒绝；绝不静默回退到其他编辑器。",
  "you.editing.demo.step.session-not-found.title": "诚实错误：YOU_EDIT_SESSION_NOT_FOUND",
  "you.editing.demo.step.session-not-found.description":
    "未知会话 id 是 typed 拒绝，以 typed 错误面板呈现。",
  "you.editing.demo.step.external-session.title": "打开 external 会话（tier 3）",
  "you.editing.demo.step.external-session.description":
    "external 会话经同意门投射流程启动，绝无环境进程控制。",
  "you.editing.demo.step.launch-gate.title": "诚实错误：同意门（启动）",
  "you.editing.demo.step.launch-gate.description":
    "无许可 ⇒ 不启动——服务端独立拒绝（YOU_CONSENT_REQUIRED）。",
  "you.editing.demo.step.consent-grant.title": "授予外部启动同意",
  "you.editing.demo.step.consent-grant.description":
    "按用途（export）授予操作同意——wave-2 权威形状，无第二条同意路径。",
  "you.editing.demo.step.external-launch.title": "投射启动意图 + 交换包",
  "you.editing.demo.step.external-launch.description":
    "经 controller 接口投射的意图，携带 tier-4 交换包。",
  "you.editing.demo.step.export.title": "Tier-4 导出（确定性）",
  "you.editing.demo.step.export.description":
    "确定性组装：同会话状态 ⇒ 同内容寻址交换包。",
  "you.editing.demo.step.import-roundtrip.title": "导入 round-trip 恒等校验",
  "you.editing.demo.step.import-roundtrip.description":
    "导出字节导入回来；摘要对比——恒等可校验，绝不凭空断言。",
  "you.editing.demo.step.import-invalid.title": "诚实错误：YOU_IMPORT_EXPORT_FAILED",
  "you.editing.demo.step.import-invalid.description":
    "损坏字节：failed ImportExportResult 诚实入账 + typed 拒绝。",
  "you.editing.demo.step.takeover-gate.title": "诚实错误：同意门（接管）",
  "you.editing.demo.step.takeover-gate.description":
    "接管确认由同意状态投影渲染；无许可即拒绝。",
  "you.editing.demo.step.takeover-confirm.title": "确认手动接管",
  "you.editing.demo.step.takeover-confirm.description":
    "append-only 确认：用户接过编辑权；agent 停止编辑。",
  "you.editing.demo.step.session-commit.title": "提交会话（终态）",
  "you.editing.demo.step.session-commit.description":
    "open → committed 终态；记录经不可变替换落账，绝不原地改写。",
  "you.editing.demo.step.session-terminal-locked.title": "诚实错误：终态锁定",
  "you.editing.demo.step.session-terminal-locked.description":
    "自终态的非法迁移是 typed 拒绝，绝非静默 no-op。",
  "you.editing.demo.step.session-abandon.title": "放弃会话（终态）",
  "you.editing.demo.step.session-abandon.description":
    "open → abandoned 终态；平面收束为一个 committed 一个 abandoned 会话。",
};

export const EDITING_DEMO_STEP_MESSAGES_EN_US: Record<string, string> = enUS;
export const EDITING_DEMO_STEP_MESSAGES_ZH_CN: Record<string, string> = zhCN;
