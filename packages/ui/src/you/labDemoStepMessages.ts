// YOU Lab Studio — demo 步骤文案表（W9B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖）。步骤 id → 标题/描述文案 id（demo 面板
// 与驱动器共享）；summary 文案由驱动器产出（含确定性 id/哈希——与 W4B-W8B 同款：
// 驱动器 summary 即 golden 期望，不经文案表）。en-US / zh-CN 双语。

const enUS: Record<string, string> = {
  "you.lab.demo.step.load.title": "Load the lab plane",
  "you.lab.demo.step.load.description":
    "First step owns load: the experiment declaration, run ladder, evidence manifests and promotion gate all render from controller projections (frozen three-arm taxonomy + run-status ladder + spec/world/budget registries).",
  "you.lab.demo.step.world-invalid.title": "Honest error: YOU_LAB_WORLD_INVALID",
  "you.lab.demo.step.world-invalid.description":
    "Declaring with the empty-seed world preset is a typed refusal — lab worlds are seed-deterministic (same seed, byte-identical world); malformed descriptors are never silently repaired.",
  "you.lab.demo.step.budget-invalid.title": "Honest error: YOU_SEARCH_LADDER_INVALID",
  "you.lab.demo.step.budget-invalid.description":
    "The zero budget preset refuses the declaration: the search/RL ladder explores under an explicit cumulative budget (integer >= 1) — never an implicit or empty one.",
  "you.lab.demo.step.experiment-declare.title": "Declare the first experiment",
  "you.lab.demo.step.experiment-declare.description":
    "An immutable LabExperiment from spec 001 (intent + objective + constraintsHash + the three arms per the LAB.md comparison law) with world-alpha and the standard budget as declaration context.",
  "you.lab.demo.step.run-submit-baseline.title": "Submit the generalist baseline run",
  "you.lab.demo.step.run-submit-baseline.description":
    "The append-only run ladder opens at submitted with a deterministic content-addressed plan hash; lab-run-recorded is journaled.",
  "you.lab.demo.step.run-start-baseline.title": "Start the baseline run",
  "you.lab.demo.step.run-start-baseline.description":
    "submitted -> running on the ladder; every transition journals lab-run-recorded with statusBefore and statusAfter.",
  "you.lab.demo.step.run-succeed-baseline.title": "Succeed the baseline run",
  "you.lab.demo.step.run-succeed-baseline.description":
    "running -> succeeded is a locked terminal; the baseline benchmark score (0.62) becomes visible in the three-arm comparison projection.",
  "you.lab.demo.step.run-fail-handdesigned.title": "Fail the hand-designed run (honest path)",
  "you.lab.demo.step.run-fail-handdesigned.description":
    "The hand-designed arm's first run walks submitted -> running -> failed — a locked terminal; retrying appends a NEW run, never a reset.",
  "you.lab.demo.step.run-retry-handdesigned.title": "Retry the hand-designed arm",
  "you.lab.demo.step.run-retry-handdesigned.description":
    "A fresh run (attempt 2) walks the ladder again and succeeds — the run ladder stays append-only and every attempt is addressable.",
  "you.lab.demo.step.run-submit-searched.title": "Submit the searched run",
  "you.lab.demo.step.run-submit-searched.description":
    "Submitting a searched arm appends SearchLadderStep 1 (beam-search, explicit cumulative budget) — the SEARCH BUDGET LAW made visible before any result exists.",
  "you.lab.demo.step.run-start-searched.title": "Start the searched run",
  "you.lab.demo.step.run-start-searched.description":
    "The searched candidate organization executes inside the deterministic world (same seed, byte-identical replay).",
  "you.lab.demo.step.run-succeed-searched.title": "Succeed the searched run",
  "you.lab.demo.step.run-succeed-searched.description":
    "The searched benchmark score (0.78) lands above the baseline (0.62) — the three-arm comparison verdict turns to beats.",
  "you.lab.demo.step.evidence-publish.title": "Publish the evidence manifest",
  "you.lab.demo.step.evidence-publish.description":
    "A content-addressed LabEvidenceManifest bundles the searched run's artifacts (3 content-addressed refs + derived contentHash); lab-evidence-published is journaled and verification starts unverified.",
  "you.lab.demo.step.promotion-unverified.title": "Honest error: unverified evidence",
  "you.lab.demo.step.promotion-unverified.description":
    "The promotion gate refuses an unverified manifest with YOU_LAB_PROMOTION_INVALID — promotion evidence must pass hash verification first (fail closed).",
  "you.lab.demo.step.manifest-verify.title": "Verify the manifest",
  "you.lab.demo.step.manifest-verify.description":
    "Verification recomputes the content hash from the artifact refs and matches the recorded hash — the manifest's verification status becomes verified.",
  "you.lab.demo.step.promotion-baseline-winner.title": "Honest error: baseline winner",
  "you.lab.demo.step.promotion-baseline-winner.description":
    "Nominating the generalist baseline as winner is YOU_LAB_PROMOTION_INVALID — only a searched organization may promote (the LAB PROMOTION LAW).",
  "you.lab.demo.step.promotion-decide.title": "Decide the promotion",
  "you.lab.demo.step.promotion-decide.description":
    "The searched arm (0.78) beats the baseline (0.62) under the recorded objective and constraints: the immutable LabPromotionRecord lands, the experiment's promotionRef is immutably replaced, and lab-promotion-decided is journaled.",
  "you.lab.demo.step.promotion-already-decided.title": "Honest error: already decided",
  "you.lab.demo.step.promotion-already-decided.description":
    "A live promotion blocks re-deciding with YOU_LAB_PROMOTION_INVALID — a change of mind must go through a reversal record, never an in-place mutation.",
  "you.lab.demo.step.promotion-reversal.title": "Reverse the promotion (new record)",
  "you.lab.demo.step.promotion-reversal.description":
    "The reversal appends a new ledger record (kind reversal, supersedes the promotion) and immutably replaces the experiment's promotionRef — nothing is mutated in place.",
  "you.lab.demo.step.manifest-tampered.title": "Publish a tampered manifest",
  "you.lab.demo.step.manifest-tampered.description":
    "The tampered integrity preset records a deliberately wrong contentHash on the baseline run's bundle — a legal, honestly-labeled record that exercises the fail-closed verification path.",
  "you.lab.demo.step.manifest-mismatch.title": "Honest error: hash mismatch + unknown manifest",
  "you.lab.demo.step.manifest-mismatch.description":
    "Verifying the tampered manifest recomputes a different hash and fails closed with YOU_LAB_EVIDENCE_MANIFEST_INVALID (the mismatch is recorded as an observation); an unknown manifest id is the same typed refusal.",
  "you.lab.demo.step.experiment-declare-losing.title": "Declare the losing experiment",
  "you.lab.demo.step.experiment-declare-losing.description":
    "Spec 002 in world-beta: the searched organization scores 0.74 against the baseline's 0.80 — the honest losing arm.",
  "you.lab.demo.step.losing-sweep.title": "Sweep the losing experiment's three arms",
  "you.lab.demo.step.losing-sweep.description":
    "All three arms run to succeeded (with a published, verified evidence manifest for the searched arm) — the comparison verdict stays loses.",
  "you.lab.demo.step.promotion-losing.title": "Honest error: searched did not beat the baseline",
  "you.lab.demo.step.promotion-losing.description":
    "The gate refuses with YOU_LAB_PROMOTION_INVALID (no-improvement) — a searched organization promotes ONLY when it beats the generalist baseline (the LAB PROMOTION LAW core).",
  "you.lab.demo.step.experiment-declare-tie.title": "Declare the tie experiment (tight budget)",
  "you.lab.demo.step.experiment-declare-tie.description":
    "Spec 003 with the tight budget preset (cumulativeBudget 1): the searched arm scores exactly the baseline (0.66) and exploration is deliberately bounded.",
  "you.lab.demo.step.tie-sweep.title": "Sweep the tie experiment's three arms",
  "you.lab.demo.step.tie-sweep.description":
    "The three arms run to succeeded within the tight budget (one searched exploration step) — the comparison verdict is ties.",
  "you.lab.demo.step.promotion-tie.title": "Honest error: a tie never promotes",
  "you.lab.demo.step.promotion-tie.description":
    "The gate refuses a tie with YOU_LAB_PROMOTION_INVALID (no-improvement) — the improvement must be strict; equality is not a promotion.",
  "you.lab.demo.step.search-exhaustion.title": "Honest error: search budget exhausted",
  "you.lab.demo.step.search-exhaustion.description":
    "Submitting a second searched run exceeds cumulativeBudget 1: the exhaustion is RECORDED as a terminal SearchLadderStep and the submission is refused with YOU_SEARCH_LADDER_INVALID — never a silent stop.",
  "you.lab.demo.step.run-retire.title": "Retire a run",
  "you.lab.demo.step.run-retire.description":
    "A freshly submitted baseline run retires before starting (submitted -> retired) — the ladder's graceful-removal terminal, locked on arrival.",
  "you.lab.demo.step.not-found-refusals.title": "Honest error: unknown run and experiment",
  "you.lab.demo.step.not-found-refusals.description":
    "Unknown run ids are typed YOU_LAB_RUN_NOT_FOUND refusals and unknown experiment ids YOU_LAB_EXPERIMENT_NOT_FOUND — records are addressed by immutable ids, never guessed.",
  "you.lab.demo.step.terminal-refusal.title": "Honest error: terminal run locked",
  "you.lab.demo.step.terminal-refusal.description":
    "Completing an already-succeeded run is refused — run terminals are locked (the generic invalid-state code carries the reason; frozen v9 defines no lab-run-state-specific code).",
};

const zhCN: Record<string, string> = {
  "you.lab.demo.step.load.title": "加载 lab 平面",
  "you.lab.demo.step.load.description":
    "首步负责加载：实验声明、run 阶梯、evidence manifest 与 promotion gate 全部由 controller 投影渲染（frozen 三臂分类学 + run 状态阶梯 + 规格/世界/预算注册面）。",
  "you.lab.demo.step.world-invalid.title": "诚实错误：YOU_LAB_WORLD_INVALID",
  "you.lab.demo.step.world-invalid.description":
    "以空 seed 世界预设声明是 typed 拒绝——lab 世界 seed 确定（同 seed ⇒ 字节一致世界）；malformed 描述子绝不静默修复。",
  "you.lab.demo.step.budget-invalid.title": "诚实错误：YOU_SEARCH_LADDER_INVALID",
  "you.lab.demo.step.budget-invalid.description":
    "零预算预设拒绝声明：search/RL 阶梯在显式累计预算（整数 ≥ 1）下探索——绝不接受隐式或空预算。",
  "you.lab.demo.step.experiment-declare.title": "声明首个实验",
  "you.lab.demo.step.experiment-declare.description":
    "来自规格 001 的不可变 LabExperiment（intent + objective + constraintsHash + LAB.md 三臂法则），以 world-alpha 与标准预算为声明上下文。",
  "you.lab.demo.step.run-submit-baseline.title": "提交 generalist baseline run",
  "you.lab.demo.step.run-submit-baseline.description":
    "append-only run 阶梯以 submitted 开启并携带确定性内容寻址 plan hash；lab-run-recorded 落账。",
  "you.lab.demo.step.run-start-baseline.title": "启动 baseline run",
  "you.lab.demo.step.run-start-baseline.description":
    "阶梯上 submitted -> running；每次迁移以带 statusBefore/statusAfter 的 lab-run-recorded 落账。",
  "you.lab.demo.step.run-succeed-baseline.title": "baseline run 成功",
  "you.lab.demo.step.run-succeed-baseline.description":
    "running -> succeeded 是锁定终态；baseline 基准分（0.62）随即出现在三臂比较投影中。",
  "you.lab.demo.step.run-fail-handdesigned.title": "手工设计 run 失败（诚实路径）",
  "you.lab.demo.step.run-fail-handdesigned.description":
    "手工设计臂首个 run 走 submitted -> running -> failed——锁定终态；重试追加新 run，绝不重置。",
  "you.lab.demo.step.run-retry-handdesigned.title": "重试手工设计臂",
  "you.lab.demo.step.run-retry-handdesigned.description":
    "新 run（第 2 次尝试）重走阶梯并成功——run 阶梯保持 append-only 且每次尝试可寻址。",
  "you.lab.demo.step.run-submit-searched.title": "提交 searched run",
  "you.lab.demo.step.run-submit-searched.description":
    "提交 searched 臂即追加 SearchLadderStep 1（beam-search、显式累计预算）——SEARCH BUDGET LAW 在任何结果出现前的可见面。",
  "you.lab.demo.step.run-start-searched.title": "启动 searched run",
  "you.lab.demo.step.run-start-searched.description":
    "searched 候选组织在确定性世界内执行（同 seed ⇒ 字节一致重放）。",
  "you.lab.demo.step.run-succeed-searched.title": "searched run 成功",
  "you.lab.demo.step.run-succeed-searched.description":
    "searched 基准分（0.78）高于 baseline（0.62）——三臂比较判定转为胜出。",
  "you.lab.demo.step.evidence-publish.title": "发布 evidence manifest",
  "you.lab.demo.step.evidence-publish.description":
    "content-addressed LabEvidenceManifest 打包 searched run 的工件（3 个内容寻址引用 + 派生 contentHash）；lab-evidence-published 落账，校验初始为 unverified。",
  "you.lab.demo.step.promotion-unverified.title": "诚实错误：证据未校验",
  "you.lab.demo.step.promotion-unverified.description":
    "promotion gate 以 YOU_LAB_PROMOTION_INVALID 拒绝未校验 manifest——晋升证据必须先通过哈希校验（fail closed）。",
  "you.lab.demo.step.manifest-verify.title": "校验 manifest",
  "you.lab.demo.step.manifest-verify.description":
    "校验按 artifact 引用重算内容哈希并与记录值匹配——manifest 校验状态转为 verified。",
  "you.lab.demo.step.promotion-baseline-winner.title": "诚实错误：baseline 获胜提名",
  "you.lab.demo.step.promotion-baseline-winner.description":
    "提名 generalist baseline 为 winner 是 YOU_LAB_PROMOTION_INVALID——只有 searched 组织可晋升（LAB PROMOTION LAW）。",
  "you.lab.demo.step.promotion-decide.title": "决定晋升",
  "you.lab.demo.step.promotion-decide.description":
    "searched 臂（0.78）在记录的 objective 与 constraints 下胜过 baseline（0.62）：不可变 LabPromotionRecord 落账、实验的 promotionRef 不可变替换、lab-promotion-decided 落账。",
  "you.lab.demo.step.promotion-already-decided.title": "诚实错误：已有决定",
  "you.lab.demo.step.promotion-already-decided.description":
    "live promotion 阻止再次决定（YOU_LAB_PROMOTION_INVALID）——改变主意必须走 reversal 记录，绝不原地改写。",
  "you.lab.demo.step.promotion-reversal.title": "反转晋升（新记录）",
  "you.lab.demo.step.promotion-reversal.description":
    "reversal 向账本追加新记录（kind reversal、顶替原 promotion）并不可变替换实验的 promotionRef——没有任何原地改写。",
  "you.lab.demo.step.manifest-tampered.title": "发布污染 manifest",
  "you.lab.demo.step.manifest-tampered.description":
    "tampered 完整性预设在 baseline run 的 bundle 上记录故意错误的 contentHash——合法且诚实标注的记录，用于演练 fail-closed 校验路径。",
  "you.lab.demo.step.manifest-mismatch.title": "诚实错误：哈希不匹配 + 未知 manifest",
  "you.lab.demo.step.manifest-mismatch.description":
    "校验污染 manifest 重算出不同哈希并以 YOU_LAB_EVIDENCE_MANIFEST_INVALID fail closed（mismatch 作为观察落账）；未知 manifest id 是同型 typed 拒绝。",
  "you.lab.demo.step.experiment-declare-losing.title": "声明落败实验",
  "you.lab.demo.step.experiment-declare-losing.description":
    "world-beta 中的规格 002：searched 组织得分 0.74 对 baseline 的 0.80——诚实的落败臂。",
  "you.lab.demo.step.losing-sweep.title": "扫落败实验的三臂",
  "you.lab.demo.step.losing-sweep.description":
    "三臂全部 run 至 succeeded（searched 臂附已发布并校验的 evidence manifest）——比较判定保持落败。",
  "you.lab.demo.step.promotion-losing.title": "诚实错误：searched 未胜过 baseline",
  "you.lab.demo.step.promotion-losing.description":
    "gate 以 YOU_LAB_PROMOTION_INVALID（no-improvement）拒绝——searched 组织仅在胜过 generalist baseline 时晋升（LAB PROMOTION LAW 核心）。",
  "you.lab.demo.step.experiment-declare-tie.title": "声明持平实验（紧预算）",
  "you.lab.demo.step.experiment-declare-tie.description":
    "规格 003 配紧预算预设（cumulativeBudget 1）：searched 臂得分恰等于 baseline（0.66）且探索被刻意限界。",
  "you.lab.demo.step.tie-sweep.title": "扫持平实验的三臂",
  "you.lab.demo.step.tie-sweep.description":
    "三臂在紧预算内 run 至 succeeded（一次 searched 探索步）——比较判定为持平。",
  "you.lab.demo.step.promotion-tie.title": "诚实错误：持平绝不晋升",
  "you.lab.demo.step.promotion-tie.description":
    "gate 以 YOU_LAB_PROMOTION_INVALID（no-improvement）拒绝持平——改进必须是严格的；相等不是晋升。",
  "you.lab.demo.step.search-exhaustion.title": "诚实错误：搜索预算耗尽",
  "you.lab.demo.step.search-exhaustion.description":
    "提交第二个 searched run 超出 cumulativeBudget 1：耗尽被作为终态 SearchLadderStep 落账，提交以 YOU_SEARCH_LADDER_INVALID 拒绝——绝不静默停止。",
  "you.lab.demo.step.run-retire.title": "退役一个 run",
  "you.lab.demo.step.run-retire.description":
    "新提交的 baseline run 在启动前退役（submitted -> retired）——阶梯的优雅移除终态，到达即锁定。",
  "you.lab.demo.step.not-found-refusals.title": "诚实错误：未知 run 与实验",
  "you.lab.demo.step.not-found-refusals.description":
    "未知 run id 是 typed YOU_LAB_RUN_NOT_FOUND 拒绝、未知实验 id 是 YOU_LAB_EXPERIMENT_NOT_FOUND——记录以不可变 id 寻址，绝不猜测。",
  "you.lab.demo.step.terminal-refusal.title": "诚实错误：终态 run 锁定",
  "you.lab.demo.step.terminal-refusal.description":
    "完成已 succeeded 的 run 被拒绝——run 终态锁定（generic invalid-state code 携带 reason；frozen v9 未定义 lab-run-state 专属 code）。",
};

export const LAB_DEMO_STEP_MESSAGES_EN_US: Record<string, string> = enUS;
export const LAB_DEMO_STEP_MESSAGES_ZH_CN: Record<string, string> = zhCN;
