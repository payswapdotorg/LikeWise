// YOU Hardening Studio — demo 步骤文案表（W10B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/哈希——与 W4B-W9B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.hardening.demo.step.load.title": "Load the hardening plane",
  "you.hardening.demo.step.load.description":
    "First step owns load: the limit notices, import statuses, retention controls, DR status and release readiness all render from controller projections (frozen rate-limit actions + verdict kinds + consent states + policy/matrix registries).",
  "you.hardening.demo.step.limit-deny-exceeded.title": "Honest error: deny exceeded",
  "you.hardening.demo.step.limit-deny-exceeded.description":
    "Driving the render-submit policy past its burst fires the deny action BEFORE any effect, appends an immutable enforcement record and surfaces YOU_RATE_LIMIT_EXCEEDED with window and retry guidance — never silent.",
  "you.hardening.demo.step.limit-defer-exceeded.title": "Honest error: defer exceeded",
  "you.hardening.demo.step.limit-defer-exceeded.description":
    "The defer class is for queueable work only: the import-scan policy exhausts its window, the enforcement record is appended and the typed refusal carries the retry guidance for the queued retry.",
  "you.hardening.demo.step.limit-shed-exceeded.title": "Honest error: shed exceeded",
  "you.hardening.demo.step.limit-shed-exceeded.description":
    "The shed class drops the request under peak load: the export-peak policy (burst 1) exhausts on the second attempt; the notice is recorded exactly like deny and defer — throttling is never silent.",
  "you.hardening.demo.step.import-unscanned-refusal.title": "Honest error: unscanned import",
  "you.hardening.demo.step.import-unscanned-refusal.description":
    "Scanning under an unregistered scan class is a typed YOU_IMPORT_QUARANTINED refusal — unscanned imports never enter evidence and the scan class is never silently repaired.",
  "you.hardening.demo.step.import-clean.title": "Scan a clean import",
  "you.hardening.demo.step.import-clean.description":
    "The portrait artifact scans clean under media-upload and enters evidence as a durable verdict (no journaled event — the frozen v10 vocabulary carries only import-quarantined; disclosed).",
  "you.hardening.demo.step.import-quarantined.title": "Quarantine an import",
  "you.hardening.demo.step.import-quarantined.description":
    "The bundle artifact hits the signature finding: fail-closed quarantine with quarantinedAt set and the import-quarantined event journaled — reversible only through an explicit release record.",
  "you.hardening.demo.step.import-release-not-quarantined.title": "Honest error: release a clean verdict",
  "you.hardening.demo.step.import-release-not-quarantined.description":
    "Releasing the clean verdict is a typed refusal — only a quarantined verdict can be released; the release path stays fail closed for clean and rejected verdicts alike.",
  "you.hardening.demo.step.import-release.title": "Release the quarantined import",
  "you.hardening.demo.step.import-release.description":
    "An explicit release record reverses the quarantine (durable record; no journaled event for the release — the frozen v10 vocabulary has no import-released type; disclosed).",
  "you.hardening.demo.step.import-release-again.title": "Honest error: release twice",
  "you.hardening.demo.step.import-release-again.description":
    "A second release of the same verdict is a typed refusal — quarantine reverses exactly once through an explicit release record.",
  "you.hardening.demo.step.import-rejected.title": "Reject an import",
  "you.hardening.demo.step.import-rejected.description":
    "The model-weights artifact carries the license-forbidden finding: the rejected verdict is terminal — never enters evidence, never releasable.",
  "you.hardening.demo.step.retention-consent-protected.title": "Honest error: consent-protected retention",
  "you.hardening.demo.step.retention-consent-protected.description":
    "Enforcing the evidence-raw class on a consent-granted subject is refused with YOU_RETENTION_ENFORCEMENT_INVALID — a retention class never overrides an active consent (the wave-2 consent laws hold).",
  "you.hardening.demo.step.retention-enforced-withdrawn.title": "Enforce retention (withdrawn consent)",
  "you.hardening.demo.step.retention-enforced-withdrawn.description":
    "The consent was withdrawn, so no active consent protects the subject: the immutable enforcement record lands and retention-enforced is journaled.",
  "you.hardening.demo.step.retention-enforced-expired.title": "Enforce retention (expired consent)",
  "you.hardening.demo.step.retention-enforced-expired.description":
    "An expired consent is not an active consent — only the granted state protects a subject, so the pass proceeds on the expired-consent subject.",
  "you.hardening.demo.step.dr-corrupted.title": "Honest error: corrupted restore",
  "you.hardening.demo.step.dr-corrupted.description":
    "The corrupted preset records an honestly different observed hash: the restore is refused BEFORE activation with YOU_DR_RESTORE_INVALID and no record is created (fail closed).",
  "you.hardening.demo.step.dr-verified.title": "Verify a DR restore",
  "you.hardening.demo.step.dr-verified.description":
    "The honest restore matches the snapshot content hash before activation: DrRestoreRecord carries verified with the check-hash evidence journaled in dr-restore-recorded — the flag is never asserted without check evidence.",
  "you.hardening.demo.step.dr-secondary-verified.title": "Verify the secondary restore",
  "you.hardening.demo.step.dr-secondary-verified.description":
    "The secondary snapshot restores verified as well — every restore record displays its verification state derived from the event-stream check evidence.",
  "you.hardening.demo.step.eligibility-matrix-unknown.title": "Honest error: unknown matrix ref",
  "you.hardening.demo.step.eligibility-matrix-unknown.description":
    "Deciding for an unregistered matrix entry is YOU_PROVIDER_MATRIX_INVALID — every ecosystem addition enters through the ProviderMatrix behind fail-closed adapters (declaration-side mirror of the W10C gate).",
  "you.hardening.demo.step.eligibility-no-rollback.title": "Honest error: no rollback evidence",
  "you.hardening.demo.step.eligibility-no-rollback.description":
    "An eligible decision without a real rollback drill is a typed YOU_PRODUCTION_ELIGIBILITY_INVALID refusal — eligibility requires rollback evidence; blocked decisions need none.",
  "you.hardening.demo.step.eligibility-blocked.title": "Record a blocked decision",
  "you.hardening.demo.step.eligibility-blocked.description":
    "The audit-region render provider is decided blocked: an immutable ProductionEligibilityRecord lands and production-eligibility-decided is journaled.",
  "you.hardening.demo.step.eligibility-eligible.title": "Record an eligible decision",
  "you.hardening.demo.step.eligibility-eligible.description":
    "The eu-central render provider is decided eligible with a content-addressed rollback drill link — the rollback evidence is what the eligibility law requires.",
  "you.hardening.demo.step.eligibility-reverse.title": "Reverse the decision",
  "you.hardening.demo.step.eligibility-reverse.description":
    "The reversal is a NEW immutable ledger record that supersedes the eligible decision — never a mutation of the original.",
  "you.hardening.demo.step.eligibility-reverse-again.title": "Honest error: reverse twice",
  "you.hardening.demo.step.eligibility-reverse-again.description":
    "Reversing the already-reversed original decision is a typed refusal — the live record is the reversal; course changes are always new records.",
  "you.hardening.demo.step.not-found-refusals.title": "Honest error: unknown ids",
  "you.hardening.demo.step.not-found-refusals.description":
    "An unknown verdict id and an unknown retention subject are typed refusals across the hardening planes — the UI never guesses an id.",
};

const zhCN: Record<string, string> = {
  "you.hardening.demo.step.load.title": "加载加固平面",
  "you.hardening.demo.step.load.description":
    "首步负责加载：限流通知、导入状态、留存控制、DR 状态与发布就绪全部来自 controller 投影（frozen 限流 action + verdict 分类 + consent 分类 + policy/matrix 注册面）。",
  "you.hardening.demo.step.limit-deny-exceeded.title": "诚实错误：deny 超限",
  "you.hardening.demo.step.limit-deny-exceeded.description":
    "把 render-submit 策略打到 burst 耗尽：deny 在任何效果发生前触发，append 不可变 enforcement 记录并以 YOU_RATE_LIMIT_EXCEEDED 携 window 与 retry 指引呈现——绝不静默。",
  "you.hardening.demo.step.limit-defer-exceeded.title": "诚实错误：defer 超限",
  "you.hardening.demo.step.limit-defer-exceeded.description":
    "defer 类别仅用于可排队工作：import-scan 策略窗口耗尽，enforcement 记录落账，typed 拒绝携带排队重试的 retry 指引。",
  "you.hardening.demo.step.limit-shed-exceeded.title": "诚实错误：shed 超限",
  "you.hardening.demo.step.limit-shed-exceeded.description":
    "shed 类别在峰值下丢弃请求：export-peak 策略（burst 1）第二次尝试即耗尽；通知与 deny/defer 同样落账——throttling 绝不静默。",
  "you.hardening.demo.step.import-unscanned-refusal.title": "诚实错误：未扫描导入",
  "you.hardening.demo.step.import-unscanned-refusal.description":
    "以未注册 scan class 扫描是 typed YOU_IMPORT_QUARANTINED 拒绝——未扫描导入绝不进入证据，scan class 绝不静默修复。",
  "you.hardening.demo.step.import-clean.title": "扫描 clean 导入",
  "you.hardening.demo.step.import-clean.description":
    "portrait 工件在 media-upload 下扫描 clean 并以 durable verdict 进入证据（无落账事件——frozen v10 词汇仅携带 import-quarantined；披露）。",
  "you.hardening.demo.step.import-quarantined.title": "隔离一个导入",
  "you.hardening.demo.step.import-quarantined.description":
    "bundle 工件命中签名 finding：fail-closed 隔离（记录 quarantinedAt + import-quarantined 事件落账）——仅可经显式 release record 可逆。",
  "you.hardening.demo.step.import-release-not-quarantined.title": "诚实错误：放行 clean verdict",
  "you.hardening.demo.step.import-release-not-quarantined.description":
    "放行 clean verdict 是 typed 拒绝——只有 quarantined verdict 可被放行；放行路径对 clean 与 rejected 一致 fail closed。",
  "you.hardening.demo.step.import-release.title": "放行被隔离的导入",
  "you.hardening.demo.step.import-release.description":
    "显式 release record 反转隔离（durable 记录；release 无落账事件——frozen v10 词汇无 import-released 类型；披露）。",
  "you.hardening.demo.step.import-release-again.title": "诚实错误：重复放行",
  "you.hardening.demo.step.import-release-again.description":
    "同一 verdict 的第二次放行是 typed 拒绝——隔离仅可经显式 release record 反转一次。",
  "you.hardening.demo.step.import-rejected.title": "拒绝一个导入",
  "you.hardening.demo.step.import-rejected.description":
    "model-weights 工件携带 license-forbidden finding：rejected verdict 是终态——绝不进入证据，绝不可放行。",
  "you.hardening.demo.step.retention-consent-protected.title": "诚实错误：consent 保护的留存",
  "you.hardening.demo.step.retention-consent-protected.description":
    "对 consent-granted subject 执行 evidence-raw class 是 YOU_RETENTION_ENFORCEMENT_INVALID 拒绝——retention class 绝不覆盖 active consent（wave-2 consent 法律保持）。",
  "you.hardening.demo.step.retention-enforced-withdrawn.title": "执行留存（已撤回同意）",
  "you.hardening.demo.step.retention-enforced-withdrawn.description":
    "同意已撤回——无 active consent 保护该 subject：不可变 enforcement 记录落账并 journal retention-enforced。",
  "you.hardening.demo.step.retention-enforced-expired.title": "执行留存（过期同意）",
  "you.hardening.demo.step.retention-enforced-expired.description":
    "过期同意不是 active consent——仅 granted 状态保护 subject，因此该次 pass 在过期同意 subject 上照常执行。",
  "you.hardening.demo.step.dr-corrupted.title": "诚实错误：损坏的 restore",
  "you.hardening.demo.step.dr-corrupted.description":
    "corrupted 预设记录一个诚实的不同观察哈希：restore 在 activation 前以 YOU_DR_RESTORE_INVALID 拒绝，不创建任何记录（fail closed）。",
  "you.hardening.demo.step.dr-verified.title": "校验一次 DR restore",
  "you.hardening.demo.step.dr-verified.description":
    "honest restore 在 activation 前匹配 snapshot 内容哈希：DrRestoreRecord 携带 verified 并把 check-hash 证据 journal 进 dr-restore-recorded——flag 绝不在无 check evidence 时断言。",
  "you.hardening.demo.step.dr-secondary-verified.title": "校验备用 snapshot 的 restore",
  "you.hardening.demo.step.dr-secondary-verified.description":
    "备用 snapshot 同样 verified——每条 restore 记录的 verification 状态都从事件流 check evidence 派生显示。",
  "you.hardening.demo.step.eligibility-matrix-unknown.title": "诚实错误：未知 matrix ref",
  "you.hardening.demo.step.eligibility-matrix-unknown.description":
    "为未注册 matrix entry 做决定是 YOU_PROVIDER_MATRIX_INVALID——一切生态新增经 ProviderMatrix 走 fail-closed adapter（W10C 门的声明侧镜像）。",
  "you.hardening.demo.step.eligibility-no-rollback.title": "诚实错误：无回滚证据",
  "you.hardening.demo.step.eligibility-no-rollback.description":
    "无真实回滚演练的 eligible 决定是 typed YOU_PRODUCTION_ELIGIBILITY_INVALID 拒绝——eligibility requires rollback evidence；blocked 决定无需。",
  "you.hardening.demo.step.eligibility-blocked.title": "落账 blocked 决定",
  "you.hardening.demo.step.eligibility-blocked.description":
    "审计区域的 render provider 被决定为 blocked：不可变 ProductionEligibilityRecord 落账并 journal production-eligibility-decided。",
  "you.hardening.demo.step.eligibility-eligible.title": "落账 eligible 决定",
  "you.hardening.demo.step.eligibility-eligible.description":
    "eu-central render provider 携内容寻址回滚演练链接被决定为 eligible——回滚证据正是 eligibility 法则所要求。",
  "you.hardening.demo.step.eligibility-reverse.title": "反转该决定",
  "you.hardening.demo.step.eligibility-reverse.description":
    "reversal 是一条新的不可变账本记录，顶替 eligible 决定——绝非对原决定的改写。",
  "you.hardening.demo.step.eligibility-reverse-again.title": "诚实错误：重复反转",
  "you.hardening.demo.step.eligibility-reverse-again.description":
    "再次反转已被反转的原决定是 typed 拒绝——live 记录是 reversal 本身；改道永远是新记录。",
  "you.hardening.demo.step.not-found-refusals.title": "诚实错误：未知 id",
  "you.hardening.demo.step.not-found-refusals.description":
    "未知 verdict id 与未知 retention subject 在各加固平面皆是 typed 拒绝——UI 绝不猜测 id。",
};

export const HARDENING_DEMO_STEP_MESSAGES_EN_US = enUS;
export const HARDENING_DEMO_STEP_MESSAGES_ZH_CN = zhCN;
