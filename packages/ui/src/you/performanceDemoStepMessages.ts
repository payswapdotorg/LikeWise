// YOU Performance Studio — demo 步骤文案表（W4B）。
//
// 纯数据模块（performanceMessages.ts 的 demo 步骤子表，按模块内聚拆分以保持仓库
// 400 行纪律；resolvePerformanceMessages 合并两表——键集一致性测试覆盖合并结果）。
// 文案 id 形如 you.performance.demo.step.<stepId>.title / .description，由
// performanceStudioDemo.ts 的步骤表派生。
const enUSDemoSteps: Record<string, string> = {
  "you.performance.demo.step.template-pick.title": "Template picked",
  "you.performance.demo.step.template-pick.description":
    "The template picker previews a deterministic instantiation — the timeline is the template timeline verbatim, with a content-derived digest.",
  "you.performance.demo.step.performance-publish.title": "Performance published",
  "you.performance.demo.step.performance-publish.description":
    "Instantiation publishes an immutable Performance bound to a twin version; the record is append-only and never edited in place.",
  "you.performance.demo.step.timeline-inspect.title": "Timeline inspected",
  "you.performance.demo.step.timeline-inspect.description":
    "The timeline surface renders the motion/cue/layer track taxonomy with duration and content-addressed payload labels — never inlined content.",
  "you.performance.demo.step.timeline-edit.title": "Timeline edited",
  "you.performance.demo.step.timeline-edit.description":
    "A deterministic draft edit (cue stretch + layer append) publishes a NEW immutable performance; the source record stays untouched.",
  "you.performance.demo.step.timeline-invalid.title": "Invalid timeline (honest error)",
  "you.performance.demo.step.timeline-invalid.description":
    "An overlapping draft is refused with YOU_TIMELINE_INVALID — stateless validation, no silent repair.",
  "you.performance.demo.step.render-consent-gate.title": "Consent gate (honest error)",
  "you.performance.demo.step.render-consent-gate.description":
    "An evidence-bound render is attempted without consent. The service rejects it with YOU_CONSENT_REQUIRED — no permission means no processing.",
  "you.performance.demo.step.consent-grant.title": "Consent granted",
  "you.performance.demo.step.consent-grant.description":
    "Operational consent is granted explicitly per purpose, rendered from the wave-2 consent-authority shapes. Evidence-bound render is possible only from this point.",
  "you.performance.demo.step.render-submit.title": "Job submitted",
  "you.performance.demo.step.render-submit.description":
    "A typed RenderJobSpec enters the queue — method, output kinds and plain typed parameters; provider-neutral, never a silent fallback.",
  "you.performance.demo.step.render-run.title": "Job running",
  "you.performance.demo.step.render-run.description":
    "The job transitions queued → running on the frozen transition table — the same machinery a real render provider would use.",
  "you.performance.demo.step.render-complete.title": "Job completed",
  "you.performance.demo.step.render-complete.description":
    "The result carries content-addressed artifacts (one per output kind) and honest effort observations — every unmeasured field stays explicitly not-measured.",
  "you.performance.demo.step.render-submit-2.title": "Second job submitted",
  "you.performance.demo.step.render-submit-2.description":
    "A synthetic timeline (no evidence-derived payloads) skips the consent gate — a second job with two output kinds.",
  "you.performance.demo.step.render-complete-2.title": "Second job completed",
  "you.performance.demo.step.render-complete-2.description":
    "Two more content-addressed artifacts join the lineage — fresh candidates for the review state machine.",
  "you.performance.demo.step.artifact-accept.title": "Artifact accepted",
  "you.performance.demo.step.artifact-accept.description":
    "Acceptance appends a review record: the artifact's status ladder moves pending → accepted (append-only, never overwritten).",
  "you.performance.demo.step.artifact-reject.title": "Artifact rejected",
  "you.performance.demo.step.artifact-reject.description":
    "Rejection appends another review record with the operator notes — pending → rejected on the same append-only discipline.",
  "you.performance.demo.step.artifact-supersede.title": "Artifact superseded",
  "you.performance.demo.step.artifact-supersede.description":
    "The earlier accepted still is superseded by the sharper one through append-only linkage — record replacement, never an in-place overwrite.",
  "you.performance.demo.step.render-fail.title": "Honest failure path",
  "you.performance.demo.step.render-fail.description":
    "A job fails terminally (running → failed) with the failure reason recorded; no artifacts are produced.",
  "you.performance.demo.step.render-unsupported.title": "Unsupported (honest error)",
  "you.performance.demo.step.render-unsupported.description":
    "An unregistered method/output combination is rejected with YOU_RENDER_UNSUPPORTED — no silent re-routing to another method.",
  "you.performance.demo.step.consent-withdraw.title": "Consent withdrawn",
  "you.performance.demo.step.consent-withdraw.description":
    "Withdrawal blocks future evidence-bound renders; already-published immutable performances and artifacts keep their provenance.",
};

const zhCNDemoSteps: Record<string, string> = {
  "you.performance.demo.step.template-pick.title": "选定模板",
  "you.performance.demo.step.template-pick.description":
    "模板选择器预览确定性实例化——时间线为模板时间线逐字拷贝，并带内容派生摘要。",
  "you.performance.demo.step.performance-publish.title": "演出发布",
  "you.performance.demo.step.performance-publish.description":
    "实例化发布绑定 twin 版本的不可变 Performance；记录 append-only，绝不原地修改。",
  "you.performance.demo.step.timeline-inspect.title": "时间线检视",
  "you.performance.demo.step.timeline-inspect.description":
    "时间线表面渲染 motion/cue/layer 轨道分类学，含时长与内容寻址载荷标签——绝不内联内容。",
  "you.performance.demo.step.timeline-edit.title": "时间线编辑",
  "you.performance.demo.step.timeline-edit.description":
    "确定性草稿编辑（拉伸 cue + 追加 layer）发布新的不可变演出；源记录保持原样。",
  "you.performance.demo.step.timeline-invalid.title": "非法时间线（诚实错误）",
  "you.performance.demo.step.timeline-invalid.description":
    "重叠草稿以 YOU_TIMELINE_INVALID 拒绝——无状态校验，绝不静默修复。",
  "you.performance.demo.step.render-consent-gate.title": "同意门（诚实错误）",
  "you.performance.demo.step.render-consent-gate.description":
    "在未同意时尝试 evidence-bound 渲染。服务端以 YOU_CONSENT_REQUIRED 拒绝——无许可即不处理。",
  "you.performance.demo.step.consent-grant.title": "授予同意",
  "you.performance.demo.step.consent-grant.description":
    "按用途显式授予操作同意，由 wave-2 同意权威形状渲染。只有从此刻起 evidence-bound 渲染才可能。",
  "you.performance.demo.step.render-submit.title": "作业提交",
  "you.performance.demo.step.render-submit.description":
    "类型化 RenderJobSpec 进入队列——方法、输出类型与 plain typed 参数；provider 中立，绝不静默回退。",
  "you.performance.demo.step.render-run.title": "作业运行",
  "you.performance.demo.step.render-run.description":
    "作业在冻结转移表上从 queued 转为 running——与真实渲染 provider 同款机制。",
  "you.performance.demo.step.render-complete.title": "作业完成",
  "you.performance.demo.step.render-complete.description":
    "结果携带内容寻址产物（每输出类型一件）与诚实的 effort 观察——每个未测量字段都保持显式 not-measured。",
  "you.performance.demo.step.render-submit-2.title": "第二作业提交",
  "you.performance.demo.step.render-submit-2.description":
    "合成时间线（无证据派生载荷）不经过同意门——一个带两种输出类型的第二作业。",
  "you.performance.demo.step.render-complete-2.title": "第二作业完成",
  "you.performance.demo.step.render-complete-2.description":
    "又两件内容寻址产物加入谱系——评审状态机的新候选。",
  "you.performance.demo.step.artifact-accept.title": "产物接受",
  "you.performance.demo.step.artifact-accept.description":
    "接受追加一条评审记录：产物的状态阶梯从 pending 到 accepted（append-only，绝不覆写）。",
  "you.performance.demo.step.artifact-reject.title": "产物拒绝",
  "you.performance.demo.step.artifact-reject.description":
    "拒绝以同一 append-only 纪律追加带操作者备注的评审记录——pending 到 rejected。",
  "you.performance.demo.step.artifact-supersede.title": "产物取代",
  "you.performance.demo.step.artifact-supersede.description":
    "先前接受的静帧经 append-only 链接被更清晰的产物取代——记录替换，绝不原地覆写。",
  "you.performance.demo.step.render-fail.title": "诚实失败路径",
  "you.performance.demo.step.render-fail.description":
    "作业以终态失败（running → failed），失败原因入账；不产出任何产物。",
  "you.performance.demo.step.render-unsupported.title": "不支持（诚实错误）",
  "you.performance.demo.step.render-unsupported.description":
    "未注册的方法/输出组合以 YOU_RENDER_UNSUPPORTED 拒绝——绝不静默改道到别的方法。",
  "you.performance.demo.step.consent-withdraw.title": "撤回同意",
  "you.performance.demo.step.consent-withdraw.description":
    "撤回阻断未来的 evidence-bound 渲染；已发布的不可变演出与产物保留溯源。",
};

export const PERFORMANCE_DEMO_STEP_MESSAGES_EN_US = enUSDemoSteps;
export const PERFORMANCE_DEMO_STEP_MESSAGES_ZH_CN = zhCNDemoSteps;
