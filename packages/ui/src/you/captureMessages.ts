// YOU Capture Studio — Capture 表面本地文案表（W2B）。
//
// 纯数据模块（无 `@/` 别名、无 React 依赖），保持 you/ 子树可被仓库根目录的
// `pnpm exec tsx --test` 直接加载；hook（useCaptureMessages.ts）单独放置。
// 遵循中央文案表同款 `{key}` 占位符语义（与 W1B youMessages 一致），
// 随 useZCodeIntl 的 locale 解析（zh-CN / en-US）。
// 例外：tab 标题 "you.capture.tabTitle" 同时存在于中央表（SidePaneTabTrigger /
// launcher 消费中央 intl）——两处文案保持同步。
const enUS: Record<string, string> = {
  "you.capture.tabTitle": "Capture",
  "you.capture.simulatedBadge": "Deterministic simulated capture",
  "you.capture.loading": "Loading capture studio…",
  "you.capture.errorTitle": "Capture studio failed to load",
  "you.capture.retry": "Retry",
  "you.capture.actionErrorTitle": "Last action failed (truthful error)",
  "you.capture.actionErrorDismiss": "Dismiss",
  "you.capture.panel.requests": "Requests",
  "you.capture.panel.capture": "Capture",
  "you.capture.panel.review": "Review",
  "you.capture.panel.consent": "Consent",
  "you.capture.panel.upload": "Upload",
  "you.capture.panel.demo": "Demo",
  // -- requests panel --
  "you.capture.requests.title": "Evidence requests",
  "you.capture.requests.empty": "No evidence requests yet.",
  "you.capture.requests.emptyHint":
    "Requests appear here when a deficiency needs targeted evidence. Each request states what is asked and why.",
  "you.capture.requests.newDeficiency": "Deficiency class",
  "you.capture.requests.newReason": "Reason",
  "you.capture.requests.newReasonPlaceholder": "Why this evidence is needed…",
  "you.capture.requests.create": "Request targeted evidence (fixture)",
  "you.capture.requests.deficiency": "Deficiency",
  "you.capture.requests.type": "Evidence type",
  "you.capture.requests.framing": "Preferred framing",
  "you.capture.requests.reasonTitle": "Why this is asked",
  "you.capture.requests.privacyTitle": "Privacy requirements",
  "you.capture.requests.retentionTitle": "Retention policy",
  "you.capture.requests.consentState": "Consent",
  "you.capture.requests.startCapture": "Start guided capture",
  "you.capture.requests.sessionBound": "Capture session",
  "you.capture.requests.uploadSlot": "Request upload slot",
  // -- capture panel --
  "you.capture.capture.title": "Guided capture",
  "you.capture.capture.noSession": "No capture session",
  "you.capture.capture.noSessionHint":
    "Open an evidence request and start a guided capture session, or request an upload slot.",
  "you.capture.capture.sessionStatus": "Session status",
  "you.capture.capture.progress": "Step {captured} / {total} captured",
  "you.capture.capture.guideSteps": "Guide steps",
  "you.capture.capture.step": "Step {index}",
  "you.capture.capture.stepInstruction": "Instruction",
  "you.capture.capture.stepFraming": "Preferred framing",
  "you.capture.capture.stepModality": "Modality",
  "you.capture.capture.capturedEvidence": "Captured evidence",
  "you.capture.capture.captureCurrent": "Capture current step",
  "you.capture.capture.captureCurrentBlocked":
    "Consent required — grant operational consent to enable capture.",
  "you.capture.capture.complete": "Complete session",
  "you.capture.capture.decline": "Decline session",
  "you.capture.capture.keyboardHint":
    "Keyboard: ↑/← previous · ↓/→ next · Home/End first/last · Enter captures the current step",
  "you.capture.capture.consentRef": "Consent reference",
  "you.capture.capture.simulatedNote":
    "Synthetic fixture capture — no camera, no microphone, no real media. Every record is labeled simulated.",
  // -- review panel --
  "you.capture.review.title": "Evidence review",
  "you.capture.review.empty": "No evidence records yet.",
  "you.capture.review.emptyHint":
    "Records appear here after guided capture or an upload binds fixture content.",
  "you.capture.review.record": "Evidence record",
  "you.capture.review.selectRecord": "Select a record to review it.",
  "you.capture.review.records": "Records",
  "you.capture.review.privacyClass": "Privacy class",
  "you.capture.review.capturedAt": "Captured",
  "you.capture.review.retentionState": "Content",
  "you.capture.review.retention.available": "available",
  "you.capture.review.retention.expired": "expired (delete-after-review)",
  "you.capture.review.retention.purged": "purged",
  "you.capture.review.observations": "Deterministic quality observations",
  "you.capture.review.observationsNone": "Not reviewed yet.",
  "you.capture.review.observationsCaption":
    "Fixture-defined scores — simulated, not a scientific measurement.",
  "you.capture.review.reviewHistory": "Review history",
  "you.capture.review.notes": "Review notes",
  "you.capture.review.notesPlaceholder": "Notes for this review…",
  "you.capture.review.accept": "Accept evidence",
  "you.capture.review.reject": "Reject evidence",
  "you.capture.review.readContent": "Read fixture content",
  "you.capture.review.contentPreview": "Fixture content",
  "you.capture.review.contentHash": "Fixture hash",
  "you.capture.review.contentBytes": "{count} bytes (simulated)",
  "you.capture.review.superseded": "superseded",
  // -- consent panel --
  "you.capture.consent.title": "Consent",
  "you.capture.consent.policy": "Consent policy",
  "you.capture.consent.purposes": "Purposes",
  "you.capture.consent.purpose.grant": "Grant",
  "you.capture.consent.purpose.deny": "Deny",
  "you.capture.consent.state.granted": "granted",
  "you.capture.consent.state.unknown": "not granted",
  "you.capture.consent.state.denied": "denied",
  "you.capture.consent.state.expired": "expired",
  "you.capture.consent.state.withdrawn": "withdrawn",
  "you.capture.consent.scope": "Scope",
  "you.capture.consent.retention": "Retention",
  "you.capture.consent.revocable": "Revocable",
  "you.capture.consent.yes": "yes",
  "you.capture.consent.no": "no",
  "you.capture.consent.learningTitle": "Learning reuse (separate permission)",
  "you.capture.consent.learningGrant": "Allow learning reuse",
  "you.capture.consent.learningHint":
    "Learning reuse is never implied by operational grants. Without this separate permission, captured evidence is never reused for learning.",
  "you.capture.consent.withdraw": "Withdraw consent",
  "you.capture.consent.withdrawHint":
    "Withdrawal blocks all future processing; immutable records keep their provenance and are not re-used for new purposes.",
  "you.capture.consent.gateTitle": "Processing gates",
  "you.capture.consent.gateAllowed": "processing allowed",
  "you.capture.consent.gateBlocked": "no permission ⇒ no processing",
  "you.capture.consent.gateLearning": "learning reuse",
  "you.capture.consent.gateCaption":
    "Gates mirror the server-side enforcement: the UI only disables buttons; the service independently rejects processing without consent.",
  "you.capture.consent.reference": "Current reference",
  // -- upload panel --
  "you.capture.upload.title": "Upload",
  "you.capture.upload.empty": "No upload slots.",
  "you.capture.upload.emptyHint":
    "Request an upload slot from an open evidence request; the surface emits an upload_requested runtime event.",
  "you.capture.upload.slots": "Upload slots (upload_requested)",
  "you.capture.upload.boundRequest": "Bound request",
  "you.capture.upload.attach": "Attach fixture content (simulated)",
  "you.capture.upload.corrupt": "Simulate corrupted transfer",
  "you.capture.upload.corruptHint":
    "Deterministically corrupts the fixture bytes so the hash binding fails — the upload is rejected with YOU_CONTENT_HASH_MISMATCH, never silently repaired.",
  "you.capture.upload.events": "Runtime events",
  "you.capture.upload.eventsCaption":
    "v1 Solution protocol events surfaced to the host (evidence_requested / upload_requested).",
  // -- demo panel --
  "you.capture.demo.title": "Capture demo",
  "you.capture.demo.badge": "Deterministic simulated demo",
  "you.capture.demo.start": "Start demo",
  "you.capture.demo.next": "Run step",
  "you.capture.demo.reset": "Reset",
  "you.capture.demo.step": "Step {current} / {total}",
  "you.capture.demo.finished":
    "Demo finished — every arrow of the W2B capture/review/consent loop executed.",
  "you.capture.demo.noOutcomes": "Run steps to walk the capture/review/consent loop.",
  "you.capture.demo.scriptedNote":
    "Scripted fixture data only. No camera, no network, no real capture device, no biometric data.",
  "you.capture.simulatedNote": "simulated",
  "you.capture.demo.step.evidence-request.title": "Evidence request",
  "you.capture.demo.step.evidence-request.description":
    "A targeted EvidenceRequest appears with its reason, privacy requirements and retention policy in plain language.",
  "you.capture.demo.step.capture-open.title": "Guided session opens",
  "you.capture.demo.step.capture-open.description":
    "A guided CaptureSession opens bound to the request — three guide steps with preferred framing; status: consent-pending.",
  "you.capture.demo.step.consent-gate.title": "Consent gate (honest error)",
  "you.capture.demo.step.consent-gate.description":
    "Capture is attempted without consent. The service rejects it with YOU_CONSENT_REQUIRED — no permission means no processing.",
  "you.capture.demo.step.consent-grant.title": "Consent granted",
  "you.capture.demo.step.consent-grant.description":
    "Operational consent is granted explicitly per purpose. The session activates only now.",
  "you.capture.demo.step.capture-step-front.title": "Capture: front reference",
  "you.capture.demo.step.capture-step-front.description":
    "Guide step 1 (front-facing framing) records a synthetic EvidenceRecord — content-addressed, simulated.",
  "you.capture.demo.step.capture-step-quarter.title": "Capture: three-quarter",
  "you.capture.demo.step.capture-step-quarter.description":
    "Guide step 2 (three-quarter view) records the second synthetic record.",
  "you.capture.demo.step.capture-step-motion.title": "Capture: motion clip",
  "you.capture.demo.step.capture-step-motion.description":
    "Guide step 3 (5-second motion clip, video modality) records the third synthetic record.",
  "you.capture.demo.step.capture-complete.title": "Session completed",
  "you.capture.demo.step.capture-complete.description":
    "All guide steps captured; the session completes and the bound request becomes provided.",
  "you.capture.demo.step.upload-request.title": "Upload requested",
  "you.capture.demo.step.upload-request.description":
    "A second targeted request appears; the surface emits an upload_requested runtime event with an upload slot.",
  "you.capture.demo.step.upload-clean.title": "Fixture upload",
  "you.capture.demo.step.upload-clean.description":
    "The previously corrupted slot is retried clean; the content hash verifies and an immutable record is stored.",
  "you.capture.demo.step.upload-corrupted.title": "Corrupted upload (honest error)",
  "you.capture.demo.step.upload-corrupted.description":
    "A deterministically corrupted transfer fails the hash binding — YOU_CONTENT_HASH_MISMATCH, no silent repair; the slot stays open for a retry.",
  "you.capture.demo.step.evidence-review.title": "Evidence review",
  "you.capture.demo.step.evidence-review.description":
    "The record is reviewed: deterministic quality observations, notes, accept. delete-after-review arms content expiry.",
  "you.capture.demo.step.review-supersede.title": "Re-review supersedes",
  "you.capture.demo.step.review-supersede.description":
    "A re-review supersedes the prior outcome — reviews are immutable and never overwritten.",
  "you.capture.demo.step.retention-expiry.title": "Retention expiry (honest error)",
  "you.capture.demo.step.retention-expiry.description":
    "Reading the accepted record's content fails with YOU_RETENTION_EXPIRED; provenance is retained.",
  "you.capture.demo.step.learning-consent.title": "Learning permission",
  "you.capture.demo.step.learning-consent.description":
    "A separate learning-reuse permission is granted — it was never implied by the operational grants.",
  "you.capture.demo.step.consent-withdraw.title": "Consent withdrawn",
  "you.capture.demo.step.consent-withdraw.description":
    "Withdrawal blocks future processing; active sessions expire; immutable records keep their provenance.",
  "you.capture.demo.step.retention-purge.title": "Retention purge",
  "you.capture.demo.step.retention-purge.description":
    "Expired content is purged; any further access fails with YOU_EVIDENCE_NOT_FOUND — the ledger stays append-only.",
};

const zhCN: Record<string, string> = {
  "you.capture.tabTitle": "采集",
  "you.capture.simulatedBadge": "确定性模拟采集",
  "you.capture.loading": "正在加载采集工作室…",
  "you.capture.errorTitle": "采集工作室加载失败",
  "you.capture.retry": "重试",
  "you.capture.actionErrorTitle": "上次操作失败（真实错误）",
  "you.capture.actionErrorDismiss": "关闭",
  "you.capture.panel.requests": "请求",
  "you.capture.panel.capture": "采集",
  "you.capture.panel.review": "评审",
  "you.capture.panel.consent": "同意",
  "you.capture.panel.upload": "上传",
  "you.capture.panel.demo": "演示",
  // -- requests panel --
  "you.capture.requests.title": "证据请求",
  "you.capture.requests.empty": "暂无证据请求。",
  "you.capture.requests.emptyHint":
    "当缺陷需要定向证据时，请求会出现在这里。每个请求都说明「要什么、为什么」。",
  "you.capture.requests.newDeficiency": "缺陷类别",
  "you.capture.requests.newReason": "原因",
  "you.capture.requests.newReasonPlaceholder": "为什么需要这份证据…",
  "you.capture.requests.create": "请求定向证据（fixture）",
  "you.capture.requests.deficiency": "缺陷",
  "you.capture.requests.type": "证据类型",
  "you.capture.requests.framing": "首选取景",
  "you.capture.requests.reasonTitle": "为什么要提供",
  "you.capture.requests.privacyTitle": "隐私要求",
  "you.capture.requests.retentionTitle": "保留政策",
  "you.capture.requests.consentState": "同意状态",
  "you.capture.requests.startCapture": "开始引导采集",
  "you.capture.requests.sessionBound": "采集会话",
  "you.capture.requests.uploadSlot": "请求上传槽位",
  // -- capture panel --
  "you.capture.capture.title": "引导采集",
  "you.capture.capture.noSession": "暂无采集会话",
  "you.capture.capture.noSessionHint": "先打开证据请求并开始引导采集会话，或请求一个上传槽位。",
  "you.capture.capture.sessionStatus": "会话状态",
  "you.capture.capture.progress": "已捕获步骤 {captured} / {total}",
  "you.capture.capture.guideSteps": "引导步骤",
  "you.capture.capture.step": "步骤 {index}",
  "you.capture.capture.stepInstruction": "指令",
  "you.capture.capture.stepFraming": "首选取景",
  "you.capture.capture.stepModality": "模态",
  "you.capture.capture.capturedEvidence": "已捕获证据",
  "you.capture.capture.captureCurrent": "捕获当前步骤",
  "you.capture.capture.captureCurrentBlocked": "需要同意——授予操作许可后才能采集。",
  "you.capture.capture.complete": "完成会话",
  "you.capture.capture.decline": "拒绝会话",
  "you.capture.capture.keyboardHint": "键盘：↑/← 上一步 · ↓/→ 下一步 · Home/End 首/末 · Enter 捕获当前步骤",
  "you.capture.capture.consentRef": "同意引用",
  "you.capture.capture.simulatedNote":
    "合成 fixture 采集——无摄像头、无麦克风、无真实媒体。每条记录均标注 simulated。",
  // -- review panel --
  "you.capture.review.title": "证据评审",
  "you.capture.review.empty": "暂无证据记录。",
  "you.capture.review.emptyHint": "引导采集或上传绑定 fixture 内容后，记录会出现在这里。",
  "you.capture.review.record": "证据记录",
  "you.capture.review.selectRecord": "选择一条记录进行评审。",
  "you.capture.review.records": "记录",
  "you.capture.review.privacyClass": "隐私等级",
  "you.capture.review.capturedAt": "捕获时间",
  "you.capture.review.retentionState": "内容",
  "you.capture.review.retention.available": "可用",
  "you.capture.review.retention.expired": "已过期（delete-after-review）",
  "you.capture.review.retention.purged": "已清除",
  "you.capture.review.observations": "确定性质量观察",
  "you.capture.review.observationsNone": "尚未评审。",
  "you.capture.review.observationsCaption": "fixture 定义分数——模拟值，不构成科学度量。",
  "you.capture.review.reviewHistory": "评审历史",
  "you.capture.review.notes": "评审备注",
  "you.capture.review.notesPlaceholder": "本次评审的备注…",
  "you.capture.review.accept": "接受证据",
  "you.capture.review.reject": "拒绝证据",
  "you.capture.review.readContent": "读取 fixture 内容",
  "you.capture.review.contentPreview": "fixture 内容",
  "you.capture.review.contentHash": "fixture 哈希",
  "you.capture.review.contentBytes": "{count} 字节（模拟）",
  "you.capture.review.superseded": "已被取代",
  // -- consent panel --
  "you.capture.consent.title": "同意",
  "you.capture.consent.policy": "同意政策",
  "you.capture.consent.purposes": "用途",
  "you.capture.consent.purpose.grant": "授予",
  "you.capture.consent.purpose.deny": "拒绝",
  "you.capture.consent.state.granted": "已授予",
  "you.capture.consent.state.unknown": "未授予",
  "you.capture.consent.state.denied": "已拒绝",
  "you.capture.consent.state.expired": "已过期",
  "you.capture.consent.state.withdrawn": "已撤回",
  "you.capture.consent.scope": "作用域",
  "you.capture.consent.retention": "保留",
  "you.capture.consent.revocable": "可撤回",
  "you.capture.consent.yes": "是",
  "you.capture.consent.no": "否",
  "you.capture.consent.learningTitle": "学习复用（独立许可）",
  "you.capture.consent.learningGrant": "允许学习复用",
  "you.capture.consent.learningHint":
    "学习复用绝不随操作许可隐式获得。没有这份独立许可，采集的证据绝不会用于学习。",
  "you.capture.consent.withdraw": "撤回同意",
  "you.capture.consent.withdrawHint":
    "撤回将阻断一切未来处理；不可变记录保留溯源，且不再用于新用途。",
  "you.capture.consent.gateTitle": "处理门",
  "you.capture.consent.gateAllowed": "允许处理",
  "you.capture.consent.gateBlocked": "无许可 ⇒ 不处理",
  "you.capture.consent.gateLearning": "学习复用",
  "you.capture.consent.gateCaption":
    "门状态镜像服务端强制：UI 只是禁用按钮；服务端会独立拒绝无同意的处理。",
  "you.capture.consent.reference": "当前引用",
  // -- upload panel --
  "you.capture.upload.title": "上传",
  "you.capture.upload.empty": "暂无上传槽位。",
  "you.capture.upload.emptyHint":
    "从待处理的证据请求申请上传槽位；表面会发出 upload_requested 运行时事件。",
  "you.capture.upload.slots": "上传槽位（upload_requested）",
  "you.capture.upload.boundRequest": "绑定请求",
  "you.capture.upload.attach": "附加 fixture 内容（模拟）",
  "you.capture.upload.corrupt": "模拟损坏传输",
  "you.capture.upload.corruptHint":
    "确定性破坏 fixture 字节使哈希绑定失败——上传以 YOU_CONTENT_HASH_MISMATCH 拒绝，绝不静默修复。",
  "you.capture.upload.events": "运行时事件",
  "you.capture.upload.eventsCaption": "呈现给宿主的 v1 Solution protocol 事件（evidence_requested / upload_requested）。",
  // -- demo panel --
  "you.capture.demo.title": "采集演示",
  "you.capture.demo.badge": "确定性模拟演示",
  "you.capture.demo.start": "开始演示",
  "you.capture.demo.next": "执行步骤",
  "you.capture.demo.reset": "重置",
  "you.capture.demo.step": "步骤 {current} / {total}",
  "you.capture.demo.finished": "演示完成——W2B 采集/评审/同意闭环的每一环均已执行。",
  "you.capture.demo.noOutcomes": "执行步骤以走完采集/评审/同意闭环。",
  "you.capture.demo.scriptedNote": "仅使用剧本 fixture 数据。无摄像头、无网络、无真实采集设备、无生物特征数据。",
  "you.capture.simulatedNote": "模拟",
  "you.capture.demo.step.evidence-request.title": "证据请求",
  "you.capture.demo.step.evidence-request.description":
    "定向 EvidenceRequest 出现，原因、隐私要求与保留政策以平实语言呈现。",
  "you.capture.demo.step.capture-open.title": "打开引导会话",
  "you.capture.demo.step.capture-open.description":
    "绑定该请求的引导 CaptureSession 打开——三个带首选取景的引导步骤；状态：consent-pending。",
  "you.capture.demo.step.consent-gate.title": "同意门（诚实错误）",
  "you.capture.demo.step.consent-gate.description":
    "在未同意时尝试采集。服务端以 YOU_CONSENT_REQUIRED 拒绝——无许可即不处理。",
  "you.capture.demo.step.consent-grant.title": "授予同意",
  "you.capture.demo.step.consent-grant.description": "按用途显式授予操作许可。会话仅在此刻激活。",
  "you.capture.demo.step.capture-step-front.title": "采集：正面参考",
  "you.capture.demo.step.capture-step-front.description":
    "引导步骤 1（正面取景）记录一条合成 EvidenceRecord——内容寻址、模拟。",
  "you.capture.demo.step.capture-step-quarter.title": "采集：四分之三侧",
  "you.capture.demo.step.capture-step-quarter.description": "引导步骤 2（四分之三视角）记录第二条合成记录。",
  "you.capture.demo.step.capture-step-motion.title": "采集：动作片段",
  "you.capture.demo.step.capture-step-motion.description": "引导步骤 3（5 秒动作片段，视频模态）记录第三条合成记录。",
  "you.capture.demo.step.capture-complete.title": "会话完成",
  "you.capture.demo.step.capture-complete.description":
    "全部引导步骤已捕获；会话完成，绑定请求转为 provided。",
  "you.capture.demo.step.upload-request.title": "请求上传",
  "you.capture.demo.step.upload-request.description":
    "出现第二个定向请求；表面发出带上传槽位的 upload_requested 运行时事件。",
  "you.capture.demo.step.upload-clean.title": "fixture 上传",
  "you.capture.demo.step.upload-clean.description":
    "对先前损坏的槽位干净重试；内容哈希校验通过并存储不可变记录。",
  "you.capture.demo.step.upload-corrupted.title": "损坏上传（诚实错误）",
  "you.capture.demo.step.upload-corrupted.description":
    "确定性损坏的传输未通过哈希绑定——YOU_CONTENT_HASH_MISMATCH，绝不静默修复；槽位保留以供重试。",
  "you.capture.demo.step.evidence-review.title": "证据评审",
  "you.capture.demo.step.evidence-review.description":
    "记录被评审：确定性质量观察、备注、接受。delete-after-review 开始计过期。",
  "you.capture.demo.step.review-supersede.title": "重评审取代",
  "you.capture.demo.step.review-supersede.description": "重评审取代先前结论——评审不可变，绝不覆写。",
  "you.capture.demo.step.retention-expiry.title": "保留过期（诚实错误）",
  "you.capture.demo.step.retention-expiry.description":
    "读取已接受记录的内容以 YOU_RETENTION_EXPIRED 失败；溯源保留。",
  "you.capture.demo.step.learning-consent.title": "学习许可",
  "you.capture.demo.step.learning-consent.description": "授予独立的学习复用许可——它绝不随操作许可隐式获得。",
  "you.capture.demo.step.consent-withdraw.title": "撤回同意",
  "you.capture.demo.step.consent-withdraw.description":
    "撤回阻断未来处理；active 会话过期；不可变记录保留溯源。",
  "you.capture.demo.step.retention-purge.title": "保留清除",
  "you.capture.demo.step.retention-purge.description":
    "过期内容被清除；后续访问以 YOU_EVIDENCE_NOT_FOUND 失败——账本保持 append-only。",
};

const FALLBACK_MESSAGES = enUS;

export function resolveCaptureMessages(locale: string): Record<string, string> {
  if (locale === "zh-CN") {
    return zhCN;
  }
  return enUS;
}

/** 与中央 IntlProvider 同款 `{key}` 占位符语义；缺失回退 en-US，再回退 id。 */
export function formatCaptureMessage(
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
