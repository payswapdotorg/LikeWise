// YOU Performance Studio — Performance 表面本地文案表（W4B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖），保持 you/ 子树可被仓库根目录的
// `pnpm exec tsx --test` 直接加载；hook（usePerformanceMessages.ts）单独放置。
// 遵循中央文案表同款 `{key}` 占位符语义（与 W1B/W2B/W3B 一致），随 useZCodeIntl
// 的 locale 解析（zh-CN / en-US）。
// 例外：tab 标题 "you.performance.tabTitle" 同时存在于中央表（SidePaneTabTrigger /
// launcher 消费中央 intl）——两处文案保持同步。
import {
  PERFORMANCE_DEMO_STEP_MESSAGES_EN_US,
  PERFORMANCE_DEMO_STEP_MESSAGES_ZH_CN,
} from "./performanceDemoStepMessages.js";

const enUS: Record<string, string> = {
  "you.performance.tabTitle": "Performance",
  "you.performance.simulatedBadge": "Deterministic simulated studio",
  "you.performance.loading": "Loading performance studio…",
  "you.performance.errorTitle": "Performance studio failed to load",
  "you.performance.retry": "Retry",
  "you.performance.actionErrorTitle": "Last action failed (truthful error)",
  "you.performance.actionErrorDismiss": "Dismiss",
  "you.performance.panel.timeline": "Timeline",
  "you.performance.panel.templates": "Templates",
  "you.performance.panel.jobs": "Render",
  "you.performance.panel.review": "Review",
  "you.performance.panel.demo": "Demo",
  // -- timeline panel --
  "you.performance.timeline.title": "Performances",
  "you.performance.timeline.empty": "No performances yet.",
  "you.performance.timeline.emptyHint":
    "Instantiate a template or run the demo — every performance is an immutable timeline of content-addressed cues bound to a twin version.",
  "you.performance.timeline.count": "performances",
  "you.performance.timeline.duration": "Duration",
  "you.performance.timeline.cues": "cues",
  "you.performance.timeline.track": "Track",
  "you.performance.timeline.tracks": "Tracks",
  "you.performance.timeline.taxonomyHint":
    "Track taxonomy: motion / cue / layer (open union — extension tracks sort after the canonical three).",
  "you.performance.timeline.payloadRef": "payload",
  "you.performance.timeline.payloadHash": "hash",
  "you.performance.timeline.payloadHint":
    "Cue payloads are content-addressed (payloadRef + payloadHash) — content is never inlined in the record.",
  "you.performance.timeline.evidenceBound": "evidence-derived",
  "you.performance.timeline.evidenceHint":
    "Evidence-derived payloads gate render submission on consent (delegated to the wave-2 consent authority — no second consent path).",
  "you.performance.timeline.basedOnTemplate": "from template",
  "you.performance.timeline.handEdited": "hand-edited timeline",
  "you.performance.timeline.keyboardHint":
    "Keyboard: ↑/← previous · ↓/→ next · Home/End first/last · Enter selects the current performance",
  "you.performance.timeline.editor.title": "Timeline editor",
  "you.performance.timeline.editor.start": "Start draft",
  "you.performance.timeline.editor.discard": "Discard draft",
  "you.performance.timeline.editor.shiftEarlier": "−100 ms",
  "you.performance.timeline.editor.shiftLater": "+100 ms",
  "you.performance.timeline.editor.endEarlier": "end −100 ms",
  "you.performance.timeline.editor.endLater": "end +100 ms",
  "you.performance.timeline.editor.remove": "Remove",
  "you.performance.timeline.editor.addMotion": "Add motion cue",
  "you.performance.timeline.editor.addCue": "Add cue",
  "you.performance.timeline.editor.addLayer": "Add layer cue",
  "you.performance.timeline.editor.publish": "Publish as new performance",
  "you.performance.timeline.editor.caption":
    "Draft edits are plain record transformations; validation stays server-side — an invalid draft is refused with a typed YOU_TIMELINE_INVALID panel, never silently repaired.",
  "you.performance.timeline.editor.draftBadge": "draft",
  // -- templates panel --
  "you.performance.templates.title": "Template library",
  "you.performance.templates.empty": "No templates registered.",
  "you.performance.templates.templateCount": "templates",
  "you.performance.templates.parameters": "Parameters",
  "you.performance.templates.parametersHint":
    "Parameter editing is a plain typed record (string / number / boolean) — no hidden schema magic.",
  "you.performance.templates.param.string": "text",
  "you.performance.templates.param.number": "number",
  "you.performance.templates.param.boolean": "toggle",
  "you.performance.templates.param.decrement": "Decrement",
  "you.performance.templates.param.increment": "Increment",
  "you.performance.templates.param.on": "on",
  "you.performance.templates.param.off": "off",
  "you.performance.templates.preview.title": "Instantiation preview",
  "you.performance.templates.preview.digest": "digest",
  "you.performance.templates.preview.caption":
    "Deterministic preview: the same template and the same parameters always produce the same digest and the same timeline. The instantiated timeline is the template timeline verbatim.",
  "you.performance.templates.preview.evidenceCues": "evidence-derived cues",
  "you.performance.templates.instantiate": "Instantiate & publish",
  "you.performance.templates.timelineOfTemplate": "Template timeline",
  // -- render jobs panel --
  "you.performance.jobs.title": "Render jobs",
  "you.performance.jobs.empty": "No render jobs yet.",
  "you.performance.jobs.emptyHint":
    "Submit a job for the inspected performance — methods are provider-neutral and plural; unsupported combinations are rejected, never silently re-routed.",
  "you.performance.jobs.submit.title": "Submit render job",
  "you.performance.jobs.submit.method": "Method",
  "you.performance.jobs.submit.outputKinds": "Output kinds",
  "you.performance.jobs.submit.parameters": "Job parameters",
  "you.performance.jobs.submit.parametersHint":
    "Render parameters are a plain typed record attached to the job spec.",
  "you.performance.jobs.submit.performance": "Performance",
  "you.performance.jobs.submit": "Submit job",
  "you.performance.jobs.submitDisabledNoMethod": "Pick a method first.",
  "you.performance.jobs.submitDisabledNoKinds": "Pick at least one output kind.",
  "you.performance.jobs.ladder": "Status ladder",
  "you.performance.jobs.status.queued": "queued",
  "you.performance.jobs.status.running": "running",
  "you.performance.jobs.status.completed": "completed",
  "you.performance.jobs.status.failed": "failed",
  "you.performance.jobs.start": "Start",
  "you.performance.jobs.complete": "Complete (fixture)",
  "you.performance.jobs.fail": "fail (honest path)",
  "you.performance.jobs.effortTitle": "Effort observations",
  "you.performance.jobs.effortNotMeasured": "not-measured",
  "you.performance.jobs.effortCaption":
    "Effort/latency/cost fields carry explicit not-measured markers when unmeasured — never invented numbers.",
  "you.performance.jobs.artifacts": "Artifacts",
  "you.performance.jobs.completedAt": "Completed",
  "you.performance.jobs.failureReason": "Failure reason",
  "you.performance.jobs.spec": "Spec",
  "you.performance.jobs.outputKinds": "Outputs",
  // -- review panel --
  "you.performance.review.title": "Artifact review",
  "you.performance.review.empty": "No artifacts yet — complete a render job to produce reviewable outputs.",
  "you.performance.review.emptyHint":
    "Artifacts are content-addressed (contentRef + contentHash) and lineage-linked to the job that produced them.",
  "you.performance.review.artifactCount": "artifacts",
  "you.performance.review.lineage": "lineage",
  "you.performance.review.contentRef": "content",
  "you.performance.review.contentHash": "hash",
  "you.performance.review.simulated": "simulated",
  "you.performance.review.reviewStatus": "Review",
  "you.performance.review.reviewCount": "reviews",
  "you.performance.review.status.pending": "pending",
  "you.performance.review.status.accepted": "accepted",
  "you.performance.review.status.rejected": "rejected",
  "you.performance.review.status.superseded": "superseded",
  "you.performance.review.accept": "Accept",
  "you.performance.review.reject": "Reject",
  "you.performance.review.supersede": "Supersede",
  "you.performance.review.reviewCaption":
    "Reviews are append-only: a later review supersedes the earlier one through record replacement — never an in-place overwrite.",
  "you.performance.review.consentTitle": "Consent gate",
  "you.performance.review.gateAllowed": "evidence-bound render allowed",
  "you.performance.review.gateBlocked": "no permission ⇒ no processing",
  "you.performance.review.gateCaption":
    "The gate mirrors server-side enforcement and renders from consent-state projections (wave-2 authority shapes); the UI only disables actions — the render service independently rejects evidence-bound jobs without consent.",
  "you.performance.review.grantConsent": "Grant operational consent (fixture)",
  "you.performance.review.withdrawConsent": "Withdraw consent",
  // -- typed error panels --
  "you.performance.error.YOU_TIMELINE_INVALID":
    "The performance service refused the timeline: cues must be ordered by start, non-overlapping per track, with positive durations, content-addressed payloads and an exactly consistent duration.",
  "you.performance.error.YOU_RENDER_UNSUPPORTED":
    "The render registry lane has not registered this method/output combination — there is no silent fallback to another method.",
  "you.performance.error.YOU_RENDER_ARTIFACT_NOT_FOUND":
    "The referenced render artifact does not exist — review actions bind to artifacts produced by completed jobs only.",
  "you.performance.error.UNEXPECTED":
    "The operation failed without a typed YOU error code — the full service message is shown verbatim.",
  "you.performance.error.caption": "Typed error panel",
  // -- demo panel --
  "you.performance.demo.title": "Performance demo",
  "you.performance.demo.badge": "Deterministic simulated demo",
  "you.performance.demo.start": "Start demo",
  "you.performance.demo.next": "Run step",
  "you.performance.demo.reset": "Reset",
  "you.performance.demo.step": "Step {current} / {total}",
  "you.performance.demo.finished":
    "Demo finished — every arrow of the W4B template/timeline/render/review loop executed, including the honest typed-error paths.",
  "you.performance.demo.noOutcomes": "Run steps to walk the template → performance → render → review loop.",
  "you.performance.demo.scriptedNote":
    "Scripted fixture data only. No camera, no network, no real render provider, no biometric data.",
  "you.performance.simulatedNote": "simulated",
};

const zhCN: Record<string, string> = {
  "you.performance.tabTitle": "演出工作室",
  "you.performance.simulatedBadge": "确定性模拟工作室",
  "you.performance.loading": "正在加载演出工作室…",
  "you.performance.errorTitle": "演出工作室加载失败",
  "you.performance.retry": "重试",
  "you.performance.actionErrorTitle": "上次操作失败（真实错误）",
  "you.performance.actionErrorDismiss": "关闭",
  "you.performance.panel.timeline": "时间线",
  "you.performance.panel.templates": "模板",
  "you.performance.panel.jobs": "渲染",
  "you.performance.panel.review": "评审",
  "you.performance.panel.demo": "演示",
  // -- timeline panel --
  "you.performance.timeline.title": "已发布演出",
  "you.performance.timeline.empty": "暂无已发布演出。",
  "you.performance.timeline.emptyHint":
    "实例化一个模板或运行演示——每个演出都是绑定 twin 版本的、由内容寻址 cue 组成的不可变时间线。",
  "you.performance.timeline.count": "个演出",
  "you.performance.timeline.duration": "时长",
  "you.performance.timeline.cues": "条 cue",
  "you.performance.timeline.track": "轨道",
  "you.performance.timeline.tracks": "轨道",
  "you.performance.timeline.taxonomyHint":
    "轨道分类学：motion / cue / layer（开放联合——扩展轨道按字典序排在三个 canonical 成员之后）。",
  "you.performance.timeline.payloadRef": "载荷",
  "you.performance.timeline.payloadHash": "哈希",
  "you.performance.timeline.payloadHint":
    "cue 载荷内容寻址（payloadRef + payloadHash）——内容绝不内联进记录。",
  "you.performance.timeline.evidenceBound": "证据派生",
  "you.performance.timeline.evidenceHint":
    "证据派生载荷的渲染提交受同意门约束（委托 wave-2 同意权威——不存在第二条同意路径）。",
  "you.performance.timeline.basedOnTemplate": "来自模板",
  "you.performance.timeline.handEdited": "手工编辑时间线",
  "you.performance.timeline.keyboardHint":
    "键盘：↑/← 上一个 · ↓/→ 下一个 · Home/End 首/末 · Enter 选中当前演出",
  "you.performance.timeline.editor.title": "时间线编辑器",
  "you.performance.timeline.editor.start": "开始草稿",
  "you.performance.timeline.editor.discard": "放弃草稿",
  "you.performance.timeline.editor.shiftEarlier": "−100 ms",
  "you.performance.timeline.editor.shiftLater": "+100 ms",
  "you.performance.timeline.editor.endEarlier": "末端 −100 ms",
  "you.performance.timeline.editor.endLater": "末端 +100 ms",
  "you.performance.timeline.editor.remove": "移除",
  "you.performance.timeline.editor.addMotion": "添加 motion cue",
  "you.performance.timeline.editor.addCue": "添加 cue",
  "you.performance.timeline.editor.addLayer": "添加 layer cue",
  "you.performance.timeline.editor.publish": "发布为新演出",
  "you.performance.timeline.editor.caption":
    "草稿编辑是纯记录变换；校验留在服务端——非法草稿以 YOU_TIMELINE_INVALID typed 面板拒绝，绝不静默修复。",
  "you.performance.timeline.editor.draftBadge": "草稿",
  // -- templates panel --
  "you.performance.templates.title": "模板库",
  "you.performance.templates.empty": "暂无已注册模板。",
  "you.performance.templates.templateCount": "个模板",
  "you.performance.templates.parameters": "参数",
  "you.performance.templates.parametersHint":
    "参数编辑是 plain typed record（string / number / boolean）——没有任何隐藏 schema 魔法。",
  "you.performance.templates.param.string": "文本",
  "you.performance.templates.param.number": "数值",
  "you.performance.templates.param.boolean": "开关",
  "you.performance.templates.param.decrement": "减小",
  "you.performance.templates.param.increment": "增大",
  "you.performance.templates.param.on": "开",
  "you.performance.templates.param.off": "关",
  "you.performance.templates.preview.title": "实例化预览",
  "you.performance.templates.preview.digest": "摘要",
  "you.performance.templates.preview.caption":
    "确定性预览：同模板同参数恒产出同摘要与同时间线。实例化时间线 = 模板时间线逐字拷贝。",
  "you.performance.templates.preview.evidenceCues": "条证据派生 cue",
  "you.performance.templates.instantiate": "实例化并发布",
  "you.performance.templates.timelineOfTemplate": "模板时间线",
  // -- render jobs panel --
  "you.performance.jobs.title": "渲染作业",
  "you.performance.jobs.empty": "暂无渲染作业。",
  "you.performance.jobs.emptyHint":
    "为检视中的演出提交作业——方法 provider 中立且多元；不支持的组合会被拒绝，绝不静默改道。",
  "you.performance.jobs.submit.title": "提交渲染作业",
  "you.performance.jobs.submit.method": "方法",
  "you.performance.jobs.submit.outputKinds": "输出类型",
  "you.performance.jobs.submit.parameters": "作业参数",
  "you.performance.jobs.submit.parametersHint": "渲染参数是附着在作业 spec 上的 plain typed record。",
  "you.performance.jobs.submit.performance": "演出",
  "you.performance.jobs.submit": "提交作业",
  "you.performance.jobs.submitDisabledNoMethod": "请先选择方法。",
  "you.performance.jobs.submitDisabledNoKinds": "请至少选择一种输出类型。",
  "you.performance.jobs.ladder": "状态阶梯",
  "you.performance.jobs.status.queued": "排队中",
  "you.performance.jobs.status.running": "运行中",
  "you.performance.jobs.status.completed": "已完成",
  "you.performance.jobs.status.failed": "已失败",
  "you.performance.jobs.start": "启动",
  "you.performance.jobs.complete": "完成（fixture）",
  "you.performance.jobs.fail": "失败（诚实路径）",
  "you.performance.jobs.effortTitle": "effort 观察",
  "you.performance.jobs.effortNotMeasured": "未测量",
  "you.performance.jobs.effortCaption": "未测量的 effort/延迟/成本字段带显式 not-measured 标记——绝不编造数字。",
  "you.performance.jobs.artifacts": "产物",
  "you.performance.jobs.completedAt": "完成时间",
  "you.performance.jobs.failureReason": "失败原因",
  "you.performance.jobs.spec": "规格",
  "you.performance.jobs.outputKinds": "输出",
  // -- review panel --
  "you.performance.review.title": "产物评审",
  "you.performance.review.empty": "暂无产物——完成一个渲染作业即可产出可评审输出。",
  "you.performance.review.emptyHint":
    "产物内容寻址（contentRef + contentHash），并与产出它的作业保持 lineage 链接。",
  "you.performance.review.artifactCount": "件产物",
  "you.performance.review.lineage": "谱系",
  "you.performance.review.contentRef": "内容",
  "you.performance.review.contentHash": "哈希",
  "you.performance.review.simulated": "模拟",
  "you.performance.review.reviewStatus": "评审",
  "you.performance.review.reviewCount": "条评审",
  "you.performance.review.status.pending": "待评审",
  "you.performance.review.status.accepted": "已接受",
  "you.performance.review.status.rejected": "已拒绝",
  "you.performance.review.status.superseded": "已取代",
  "you.performance.review.accept": "接受",
  "you.performance.review.reject": "拒绝",
  "you.performance.review.supersede": "取代",
  "you.performance.review.reviewCaption":
    "评审 append-only：后续评审经记录替换取代先前评审——绝不原地覆写。",
  "you.performance.review.consentTitle": "同意门",
  "you.performance.review.gateAllowed": "允许证据绑定渲染",
  "you.performance.review.gateBlocked": "无许可 ⇒ 不处理",
  "you.performance.review.gateCaption":
    "门状态镜像服务端强制，由 consent-state 投影渲染（wave-2 权威形状）；UI 只是禁用操作——render 服务会独立拒绝无同意的 evidence-bound 作业。",
  "you.performance.review.grantConsent": "授予操作同意（fixture）",
  "you.performance.review.withdrawConsent": "撤回同意",
  // -- typed error panels --
  "you.performance.error.YOU_TIMELINE_INVALID":
    "performance 服务拒绝了该时间线：cue 须按 start 排序、同轨不重叠、时长为正、载荷内容寻址，且 durationMs 精确一致。",
  "you.performance.error.YOU_RENDER_UNSUPPORTED":
    "render 注册面尚未注册该 方法/输出 组合——不存在到其他方法的静默回退。",
  "you.performance.error.YOU_RENDER_ARTIFACT_NOT_FOUND":
    "引用的渲染产物不存在——评审动作只绑定已完成作业产出的 artifact。",
  "you.performance.error.UNEXPECTED": "操作失败且无 typed YOU 错误码——服务端消息原样呈现。",
  "you.performance.error.caption": "typed 错误面板",
  // -- demo panel --
  "you.performance.demo.title": "演出演示",
  "you.performance.demo.badge": "确定性模拟演示",
  "you.performance.demo.start": "开始演示",
  "you.performance.demo.next": "执行步骤",
  "you.performance.demo.reset": "重置",
  "you.performance.demo.step": "步骤 {current} / {total}",
  "you.performance.demo.finished":
    "演示完成——W4B 模板/时间线/渲染/评审闭环的每一环均已执行，包括诚实的 typed 错误路径。",
  "you.performance.demo.noOutcomes": "执行步骤以走完 模板 → 演出 → 渲染 → 评审 闭环。",
  "you.performance.demo.scriptedNote":
    "仅使用剧本 fixture 数据。无摄像头、无网络、无真实渲染 provider、无生物特征数据。",
  "you.performance.simulatedNote": "模拟",
};

const enUSMessages: Record<string, string> = {
  ...enUS,
  ...PERFORMANCE_DEMO_STEP_MESSAGES_EN_US,
};

const zhCNMessages: Record<string, string> = {
  ...zhCN,
  ...PERFORMANCE_DEMO_STEP_MESSAGES_ZH_CN,
};

const FALLBACK_MESSAGES = enUSMessages;

export function resolvePerformanceMessages(locale: string): Record<string, string> {
  if (locale === "zh-CN") {
    return zhCNMessages;
  }
  return enUSMessages;
}

/** 与中央 IntlProvider 同款 `{key}` 占位符语义；缺失回退 en-US，再回退 id。 */
export function formatPerformanceMessage(
  messages: Record<string, string>,
  id: string,
  values?: Record<string, string | number>,
): string {
  let text = messages[id] ?? FALLBACK_MESSAGES[id] ?? id;
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      text = text.replaceAll(`{${key}}`, String(value));
    }
  }
  return text;
}
