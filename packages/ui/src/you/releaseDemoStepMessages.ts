// YOU Release Studio — demo 步骤文案表（W12B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/计数——与 W4B-W11B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.release.demo.step.load.title": "Load the release plane",
  "you.release.demo.step.load.description":
    "First step owns load: the launch-gate registries (gate journeys, release operators, evidence bundles, rollback evidence) all render from controller projections; no checklist, sign-off or declaration exists yet — the honest starting state.",
  "you.release.demo.step.checklist-partial.title": "Assemble a 16/20 checklist (the honest incomplete state)",
  "you.release.demo.step.checklist-partial.description":
    "The partial journey assembles 16 passing points (each with a journey-evidence link) and 4 points with no evidence — the LAUNCH GATE LAW never dresses a point as passed without evidence, so the checklist lands incomplete.",
  "you.release.demo.step.signoff-incomplete-checklist-refusal.title": "Honest error: sign off before the gate passes",
  "you.release.demo.step.signoff-incomplete-checklist-refusal.description":
    "Signing the incomplete checklist is a typed YOU_OPERATOR_SIGNOFF_INVALID refusal — a sign-off references a COMPLETE passing checklist, never a partial one.",
  "you.release.demo.step.declaration-before-signoff-refusal.title": "Honest error: declare before any sign-off",
  "you.release.demo.step.declaration-before-signoff-refusal.description":
    "Declaring without a sign-off on record is a typed YOU_RELEASE_DECLARATION_INVALID refusal — the declaration references a sign-off (fail closed).",
  "you.release.demo.step.checklist-golden.title": "Assemble the 20/20 golden checklist",
  "you.release.demo.step.checklist-golden.description":
    "The golden journey assembles all 20 points with journey-evidence links — the gate passes ONLY when all 20 points pass; the launch-gate-checked event journals the counts verbatim.",
  "you.release.demo.step.signoff-land.title": "The operator signs off",
  "you.release.demo.step.signoff-land.description":
    "Aria signs the passing checklist: an immutable OperatorSignoffRecord lands with signed-by, signed-at and the referenced checklist — the operator-signoff-recorded event is journaled.",
  "you.release.demo.step.signoff-unknown-operator-refusal.title": "Honest error: unknown operator",
  "you.release.demo.step.signoff-unknown-operator-refusal.description":
    "An unregistered operator fails closed with a typed YOU_OPERATOR_SIGNOFF_INVALID — every sign-off is signed by a registered release operator.",
  "you.release.demo.step.signoff-duplicate-refusal.title": "Honest error: sign the same checklist twice",
  "you.release.demo.step.signoff-duplicate-refusal.description":
    "Re-signing an already-signed checklist is a typed refusal — the sign-off is a final immutable decision taken exactly once.",
  "you.release.demo.step.declaration-empty-bundle-refusal.title": "Honest error: empty evidence bundle",
  "you.release.demo.step.declaration-empty-bundle-refusal.description":
    "Declaring with the empty bundle (0 journey records) is a typed YOU_RELEASE_DECLARATION_INVALID — the declaration carries the FULL evidence bundle, never an empty one.",
  "you.release.demo.step.declaration-missing-rollback-refusal.title": "Honest error: missing rollback evidence",
  "you.release.demo.step.declaration-missing-rollback-refusal.description":
    "Declaring with an unregistered rollback profile is a typed refusal — the declaration carries rollback evidence (the production-eligibility law carried to the release).",
  "you.release.demo.step.declaration-land.title": "The release is declared",
  "you.release.demo.step.declaration-land.description":
    "The full evidence bundle (21 journey records) plus the DR-verified rollback evidence land a ReleaseDeclarationRecord — sign-off link, bundle link, rollback link, declared-at; the release-declared event is journaled.",
  "you.release.demo.step.declaration-duplicate-refusal.title": "Honest error: one release declaration per sign-off",
  "you.release.demo.step.declaration-duplicate-refusal.description":
    "Declaring again on the already-declared sign-off is a typed refusal — one release declaration per sign-off, never two.",
  "you.release.demo.step.final-state.title": "Final state overview",
  "you.release.demo.step.final-state.description":
    "The closing step recounts the whole ledger: the incomplete and golden checklists with their counts, the single sign-off, the single declaration with its bundle and rollback links, and the journaled launch-gate events.",
};

const zhCN: Record<string, string> = {
  "you.release.demo.step.load.title": "加载 release 平面",
  "you.release.demo.step.load.description":
    "第一步负责加载：launch-gate 注册面（gate journey、release operator、evidence bundle、rollback evidence）全部来自 controller 投影；尚无 checklist / signoff / declaration——诚实的起始态。",
  "you.release.demo.step.checklist-partial.title": "装配 16/20 checklist（诚实 incomplete 态）",
  "you.release.demo.step.checklist-partial.description":
    "partial journey 装配出 16 个通过点（每点携带 journey-evidence 链接）与 4 个无证据点——LAUNCH GATE LAW 绝不把无证据的点装扮为通过，checklist 以 incomplete 落账。",
  "you.release.demo.step.signoff-incomplete-checklist-refusal.title": "诚实错误：门未过即签署",
  "you.release.demo.step.signoff-incomplete-checklist-refusal.description":
    "签署 incomplete checklist 是 typed YOU_OPERATOR_SIGNOFF_INVALID 拒绝——signoff 引用 COMPLETE passing checklist，绝不引用 partial。",
  "you.release.demo.step.declaration-before-signoff-refusal.title": "诚实错误：无 signoff 即声明",
  "you.release.demo.step.declaration-before-signoff-refusal.description":
    "在无 signoff 落账时声明 release 是 typed YOU_RELEASE_DECLARATION_INVALID 拒绝——declaration 引用 signoff（fail closed）。",
  "you.release.demo.step.checklist-golden.title": "装配 20/20 golden checklist",
  "you.release.demo.step.checklist-golden.description":
    "golden journey 装配全部 20 点，每点携带 journey-evidence 链接——门仅在全部 20 点通过时通过；launch-gate-checked 事件 verbatim 落账 counts。",
  "you.release.demo.step.signoff-land.title": "操作者签署",
  "you.release.demo.step.signoff-land.description":
    "Aria 签署过门 checklist：不可变 OperatorSignoffRecord 落账（signed-by、signed-at、被引用 checklist）——operator-signoff-recorded 事件落账。",
  "you.release.demo.step.signoff-unknown-operator-refusal.title": "诚实错误：未知操作者",
  "you.release.demo.step.signoff-unknown-operator-refusal.description":
    "未注册操作者 fail closed，得到 typed YOU_OPERATOR_SIGNOFF_INVALID——每个 signoff 由在册 release operator 签署。",
  "you.release.demo.step.signoff-duplicate-refusal.title": "诚实错误：同一 checklist 签署两次",
  "you.release.demo.step.signoff-duplicate-refusal.description":
    "重复签署已签署的 checklist 是 typed 拒绝——signoff 是恰好执行一次的最终不可变决定。",
  "you.release.demo.step.declaration-empty-bundle-refusal.title": "诚实错误：空 evidence bundle",
  "you.release.demo.step.declaration-empty-bundle-refusal.description":
    "以空 bundle（0 条 journey 记录）声明是 typed YOU_RELEASE_DECLARATION_INVALID——declaration 携带 FULL evidence bundle，绝不携带空 bundle。",
  "you.release.demo.step.declaration-missing-rollback-refusal.title": "诚实错误：缺失 rollback 证据",
  "you.release.demo.step.declaration-missing-rollback-refusal.description":
    "以未注册 rollback 档案声明是 typed 拒绝——declaration 携带 rollback 证据（production-eligibility 法则延伸到 release）。",
  "you.release.demo.step.declaration-land.title": "声明 release",
  "you.release.demo.step.declaration-land.description":
    "完整 evidence bundle（21 条 journey 记录）+ DR 已验证 rollback 证据落账 ReleaseDeclarationRecord——signoff 链接、bundle 链接、rollback 链接、declared-at；release-declared 事件落账。",
  "you.release.demo.step.declaration-duplicate-refusal.title": "诚实错误：每个 signoff 仅一次声明",
  "you.release.demo.step.declaration-duplicate-refusal.description":
    "对已声明的 signoff 再次声明是 typed 拒绝——one release declaration per signoff，绝无第二次。",
  "you.release.demo.step.final-state.title": "终态总览",
  "you.release.demo.step.final-state.description":
    "收尾步骤复盘整个账本：incomplete 与 golden checklist 及其 counts、唯一 signoff、唯一 declaration 及其 bundle 与 rollback 链接、已落账的 launch-gate 事件。",
};

export const RELEASE_DEMO_STEP_MESSAGES_EN_US: Record<string, string> = enUS;
export const RELEASE_DEMO_STEP_MESSAGES_ZH_CN: Record<string, string> = zhCN;
