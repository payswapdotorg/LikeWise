// YOU Editing Studio — EditingStudioController 端口（W5B）。
//
// 边界（docs/you/WORK_ORDERS.md W5B / docs/you/CONTRACTS.md wave-5 freeze）：
// - 本文件只定义 UI 消费的服务端口；editing/interchange 的 canonical truth 属于
//   editing 应用服务（Worker A，W5A）。UI 不实现领域逻辑。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v5 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `editingSimulatedController.ts` 的确定性剧本；
//   TODO(T5): bind to Worker A 的 editing 服务（TL 在 T5 换绑本端口）。
// - session 生命周期（YOU_EDIT_SESSION_NOT_FOUND / 终态锁定）、change-set 校验
//   （YOU_CHANGESET_INVALID）、editor 注册面（YOU_EDITOR_UNSUPPORTED）、interchange
//   支持（YOU_IMPORT_EXPORT_FAILED）与 external launch / manual takeover 的同意强制
//   全部在服务端语义内；UI 只渲染投影（CONTRACTS.md "API/MCP/UI parity"——无 UI 专属
//   mutation 路径）。
import type {
  CandidateVersion,
  ConsentPolicy,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  EditChangeSet,
  EditChangeSetOp,
  EditorCapabilityProfile,
  EditorKind,
  EditingSession,
  ImportExportFormat,
  ImportExportResult,
  OpaqueId,
  SolutionEvent,
  YouError,
} from "@zcode/shared";
import type { EditingSubjectView } from "./editingStoryboard.js";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 政策）
// ---------------------------------------------------------------------------

export interface EditingStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 打开编辑会话（未注册 editor kind ⇒ YOU_EDITOR_UNSUPPORTED，绝不静默回退）。 */
export interface OpenEditingSessionInput {
  readonly subjectArtifactId: OpaqueId;
  readonly editorKind: EditorKind;
}

export interface EditingSessionInput {
  readonly sessionId: OpaqueId;
}

/** 变更集提议（ops 校验最先：stateless ⇒ YOU_CHANGESET_INVALID）。 */
export interface ProposeChangeSetInput {
  readonly sessionId: OpaqueId;
  readonly ops: readonly EditChangeSetOp[];
}

/** 应用变更集到 parent 版本（subject 根或先前 candidate）产出不可变候选版本。 */
export interface ApplyChangeSetInput {
  readonly changeSetId: OpaqueId;
  readonly parentVersionId: OpaqueId;
}

/** 候选版本解决（v1 change-accepted / change-rejected 事件纪律；恰一次）。 */
export interface ResolveCandidateInput {
  readonly candidateId: OpaqueId;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string;
}

/** Tier-4 导出（format 支持校验 ⇒ YOU_IMPORT_EXPORT_FAILED；确定性组装）。 */
export interface ExportFromSessionInput {
  readonly sessionId: OpaqueId;
  readonly format: ImportExportFormat;
}

/** 导出结果的操作性值（包字节与摘要随调用返回；记录/事件保持内容寻址引用）。 */
export interface EditingExportOutcome {
  readonly result: ImportExportResult;
  /** 导出包字节（操作性值——绝不内联进记录/事件）。 */
  readonly packageBytes: Uint8Array;
  /** 包字节确定性摘要（round-trip 恒等校验的基准）。 */
  readonly packageDigest: string;
}

/** 导入结果的操作性值（包字节摘要随调用返回；非法导入抛 typed 错误）。 */
export interface EditingImportOutcome {
  readonly result: ImportExportResult;
  /** 导入包字节确定性摘要（与导出摘要比对即 round-trip 恒等校验）。 */
  readonly packageDigest: string;
}

/**
 * Tier-4 导入（导入内容在验证前不受信 ⇒ YOU_IMPORT_EXPORT_FAILED + failed 结果
 * 记录诚实入账；session 绑定时 manifest 须指向该 session 的 subject）。
 */
export interface ImportEditPackageInput {
  /** 导入的字节（fixture：剧本派生；不透明——UI 绝不解析内部结构）。 */
  readonly bytes: Uint8Array;
  /** 声明的 interchange format。 */
  readonly format: ImportExportFormat;
  /** 可选 session 绑定（绑定则 manifest 校验指向该 session 的 subject）。 */
  readonly sessionId?: OpaqueId;
}

/** External editor launch 的投射意图（Tier 3：无 UI 进程控制——意图经端口投射）。 */
export interface RequestExternalEditorLaunchInput {
  readonly sessionId: OpaqueId;
}

/** 显式按用途 grant/deny（external launch / takeover 的确认走同一权威）。 */
export interface EditingConsentDecisionInput {
  readonly policyId: OpaqueId;
  readonly purpose: ConsentPurpose;
  readonly decision: "grant" | "deny";
}

export interface EditingWithdrawConsentInput {
  readonly policyId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** 按用途的同意状态（append-only consent 事件的投影；稳定按 purpose 排序）。 */
export interface EditingPurposeConsentState {
  readonly purpose: ConsentPurpose;
  readonly state: ConsentState;
}

/**
 * 同意状态的只读投影（与 W2B/W3B/W4B 同款形状；v5 law：external editor launch 与
 * manual takeover 的确认委托 wave-2 consent authority——T5 换绑后此处即该权威的
 * 状态投影；不存在第二条同意路径）。
 */
export interface EditingConsentProjection {
  readonly policy: ConsentPolicy;
  readonly purposeStates: readonly EditingPurposeConsentState[];
  /** 当前绑定引用（不可变快照）。 */
  readonly reference: ConsentReference;
}

/** 候选版本解决状态投影（恰一次：accepted / rejected / proposed）。 */
export interface CandidateResolutionView {
  readonly candidateId: OpaqueId;
  readonly outcome: "accepted" | "rejected" | null;
  readonly reason: string | null;
}

/**
 * External editor launch 的投射意图记录（append-only；**不是**进程控制——桌面层
 * 拥有真实进程交接，UI 只消费此投影）。
 */
export interface ExternalLaunchIntentView {
  readonly launchId: OpaqueId;
  readonly sessionId: OpaqueId;
  readonly editorKind: EditorKind;
  readonly format: ImportExportFormat;
  /** launch 携带的 Tier-4 导出结果（内容寻址）。 */
  readonly packageResultId: OpaqueId;
  readonly requestedAt: string;
  readonly simulated: boolean;
}

/** Manual takeover 的投射确认记录（append-only；同意门后才有记录）。 */
export interface TakeoverConfirmationView {
  readonly takeoverId: OpaqueId;
  readonly sessionId: OpaqueId;
  readonly subjectArtifactId: OpaqueId;
  readonly confirmedAt: string;
  readonly simulated: boolean;
}

/** import/export 结果的账本事实投影（方向 + 包摘要；round-trip 恒等校验数据源）。 */
export interface InterchangeFactView {
  readonly resultId: OpaqueId;
  readonly direction: "export" | "import";
  readonly format: string;
  readonly status: "succeeded" | "failed";
  /** 包字节摘要（succeeded 时非空）。 */
  readonly packageDigest: string | null;
}

export interface EditingStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 editing 表面）。 */
  readonly studioId: OpaqueId;
  /** subject 注册表（append-only；来源平面保有各自真相）。 */
  readonly subjects: readonly EditingSubjectView[];
  /** editor capability 注册面投影（W5C lane 的注册数据，非运行时权威）。 */
  readonly editorProfiles: readonly EditorCapabilityProfile[];
  /** 引擎支持的 interchange format 全集。 */
  readonly supportedFormats: readonly ImportExportFormat[];
  /** 编辑会话（追加序；记录不可变，终态经记录替换）。 */
  readonly sessions: readonly EditingSession[];
  /** 变更集（追加序；按提议序）。 */
  readonly changeSets: readonly EditChangeSet[];
  /** 候选版本谱系节点（追加序；不可变、内容寻址）。 */
  readonly candidates: readonly CandidateVersion[];
  /** 候选解决状态投影（proposed / accepted / rejected）。 */
  readonly candidateResolutions: readonly CandidateResolutionView[];
  /** import/export 结果（追加序）。 */
  readonly importExports: readonly ImportExportResult[];
  /** external editor launch 投射意图（append-only）。 */
  readonly externalLaunches: readonly ExternalLaunchIntentView[];
  /** manual takeover 投射确认（append-only）。 */
  readonly takeovers: readonly TakeoverConfirmationView[];
  /** resultId → 方向（export/import）与包摘要的账本镜像投影（round-trip 恒等校验数据源）。 */
  readonly interchangeFacts: readonly InterchangeFactView[];
  readonly consent: EditingConsentProjection;
  /** append-only 事件账本投影（editing-lifecycle / change-* / import-export / consent-*）。 */
  readonly events: readonly SolutionEvent[];
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class EditingStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "EditingStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 候选版本确定性预览（纯投影：不分配 id、不推进时钟、不落账）
// ---------------------------------------------------------------------------

/** 候选预览的 op 行（内容寻址标签——**绝不**内联 payload 内容）。 */
export interface CandidatePreviewOpRow {
  readonly opId: string;
  readonly kind: string;
  readonly payloadRef: string;
  readonly payloadHash: string;
}

export interface CandidatePreview {
  /** 被应用的 ops（原样顺序——顺序是提议者的权威）。 */
  readonly opRows: readonly CandidatePreviewOpRow[];
  readonly parentVersionId: string;
  /** parent 版本的内容哈希（subject 根或候选；unknown → null）。 */
  readonly parentContentHash: string | null;
  /** 确定性摘要（同 parent + 同 ops ⇒ 同 digest）。 */
  readonly previewDigest: string;
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Editing Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T5 换绑 Worker A 的
 * editing 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface EditingStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实 editor。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：editing 平面已存在时返回当前快照，不重建。 */
  load(request: EditingStudioLoadRequest): Promise<EditingStudioSnapshot>;
  refresh(): Promise<EditingStudioSnapshot>;

  // -- session 生命周期（open → committed | abandoned；终态锁定） --
  /** 打开会话（注册面校验 ⇒ YOU_EDITOR_UNSUPPORTED；subject 未知 ⇒ typed 拒绝）。 */
  openSession(input: OpenEditingSessionInput): Promise<EditingSession>;
  /** 提交会话（open → committed 终态）。 */
  commitSession(input: EditingSessionInput): Promise<EditingSession>;
  /** 放弃会话（open → abandoned 终态）。 */
  abandonSession(input: EditingSessionInput): Promise<EditingSession>;

  // -- 变更集（校验最先；候选谱系） --
  /** 纯确定性预览（无状态副作用；UI 的预览区）。 */
  previewCandidate(input: {
    readonly parentVersionId: OpaqueId;
    readonly ops: readonly EditChangeSetOp[];
  }): Promise<CandidatePreview>;
  /** 提议变更集（校验最先 ⇒ YOU_CHANGESET_INVALID；journaling change-proposed）。 */
  proposeChangeSet(input: ProposeChangeSetInput): Promise<EditChangeSet>;
  /** 应用变更集 ⇒ 不可变 CandidateVersion（change-set-applied + candidate-version-proposed）。 */
  applyChangeSet(input: ApplyChangeSetInput): Promise<CandidateVersion>;
  /** 解决候选恰一次（v1 change-accepted / change-rejected；append-only）。 */
  resolveCandidate(input: ResolveCandidateInput): Promise<{ readonly candidate: CandidateVersion; readonly outcome: "accepted" | "rejected" }>;

  // -- Tier-4 interchange（export → 用户编辑 → import → diff → 验证 → 候选） --
  /** 确定性导出（format 支持 ⇒ YOU_IMPORT_EXPORT_FAILED；内容寻址结果 + 包字节操作性值）。 */
  exportFromSession(input: ExportFromSessionInput): Promise<EditingExportOutcome>;
  /** 验证 + 导入（invalid ⇒ failed 结果记录 + YOU_IMPORT_EXPORT_FAILED）。 */
  importEditPackage(input: ImportEditPackageInput): Promise<EditingImportOutcome>;
  /**
   * 请求 external editor launch（Tier 3 投射意图）：同意门（export 用途）最先 ⇒
   * 无许可抛 YOU_CONSENT_REQUIRED；有许可则投射 launch 意图 + 携带 Tier-4 导出包。
   * **无进程控制**——桌面层拥有真实交接；本端口只投射意图。
   */
  requestExternalEditorLaunch(
    input: RequestExternalEditorLaunchInput,
  ): Promise<ExternalLaunchIntentView>;

  // -- manual takeover（同意门 + 投射确认记录） --
  /** 请求接管确认（takeover 用途同意门 ⇒ 无许可抛 YOU_CONSENT_REQUIRED）。 */
  requestTakeoverConfirmation(
    input: EditingSessionInput,
  ): Promise<TakeoverConfirmationView>;

  // -- 同意（external launch / takeover 确认的 binding-time 强制；委托 wave-2 权威） --
  decideConsent(input: EditingConsentDecisionInput): Promise<EditingConsentProjection>;
  withdrawConsent(input: EditingWithdrawConsentInput): Promise<EditingConsentProjection>;
}

// ---------------------------------------------------------------------------
// 同意状态纯投影（「无许可 ⇒ 不处理」必须可见且可测）
// ---------------------------------------------------------------------------

export interface EditingConsentGate {
  readonly purpose: ConsentPurpose;
  readonly allowed: boolean;
  readonly state: ConsentState;
  /** 稳定原因码（UI 文案表按 state 渲染；测试断言）。 */
  readonly reason: "granted" | "unknown" | "denied" | "expired" | "withdrawn";
}

/** 用途门：仅当该用途被显式 granted 时 allowed=true（no permission ⇒ no processing）。 */
export function projectEditingConsentGate(
  consent: EditingConsentProjection,
  purpose: ConsentPurpose,
): EditingConsentGate {
  const entry = consent.purposeStates.find((candidate) => candidate.purpose === purpose);
  const state = entry?.state ?? "unknown";
  return {
    purpose,
    allowed: state === "granted",
    state,
    reason: state,
  };
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B/W2B/W3B/W4B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** 按追加序返回会话（追加序即稳定序）。 */
export function orderedEditingSessions(
  snapshot: EditingStudioSnapshot | null,
): readonly EditingSession[] {
  if (!snapshot) return [];
  return snapshot.sessions;
}

/** 按 id 解析会话（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function editingSessionById(
  snapshot: EditingStudioSnapshot | null,
  sessionId: string | null,
): EditingSession | null {
  if (!snapshot || sessionId === null) return null;
  return snapshot.sessions.find((session) => session.id === sessionId) ?? null;
}

/** 当前检视会话的谱系根（会话的 subject 根 id；无会话 → null）。 */
export function sessionSubjectRootId(
  snapshot: EditingStudioSnapshot | null,
  sessionId: string | null,
): string | null {
  const session = editingSessionById(snapshot, sessionId);
  if (!session) return null;
  return session.subjectArtifactId;
}

/** 候选 id → parent 版本 id（谱系查询；未知候选 → null）。 */
export function candidateParentOf(
  snapshot: EditingStudioSnapshot | null,
  candidateId: string | null,
): string | null {
  if (!snapshot || candidateId === null) return null;
  return snapshot.candidates.find((candidate) => candidate.id === candidateId)?.parentVersionId ?? null;
}

/** 按 id 解析候选版本（未知 id → null）。 */
export function candidateById(
  snapshot: EditingStudioSnapshot | null,
  candidateId: string | null,
): CandidateVersion | null {
  if (!snapshot || candidateId === null) return null;
  return snapshot.candidates.find((candidate) => candidate.id === candidateId) ?? null;
}

/** 某 parent 版本的直接子候选（提议序；lineage 查询）。 */
export function candidatesOfParent(
  snapshot: EditingStudioSnapshot | null,
  parentVersionId: string | null,
): readonly CandidateVersion[] {
  if (!snapshot || parentVersionId === null) return [];
  return snapshot.candidates.filter((candidate) => candidate.parentVersionId === parentVersionId);
}

/**
 * root → leaf 谱系链（候选沿 parent 链回溯到 subject 根；确定性：从目标候选向上
 * 回溯再反转——谱系链每一环来自 append-only 账本事实）。
 */
export function lineageChainOfCandidate(
  snapshot: EditingStudioSnapshot | null,
  candidateId: string | null,
): readonly string[] {
  if (!snapshot || candidateId === null) return [];
  const subjectIds = new Set(snapshot.subjects.map((subject) => subject.id));
  const parents = new Map(
    snapshot.candidates.map((candidate) => [candidate.id, candidate.parentVersionId]),
  );
  // 未知版本（既非 subject 根也非候选）→ []（显式未知态，不猜测）。
  if (!subjectIds.has(candidateId) && !parents.has(candidateId)) return [];
  const chain: string[] = [];
  let current: string | null = candidateId;
  while (current !== null && !subjectIds.has(current)) {
    chain.push(current);
    current = parents.get(current) ?? null;
  }
  if (current !== null) {
    chain.push(current);
  }
  return chain.reverse();
}

/** 某会话的变更集（提议序；未知会话 → []）。 */
export function changeSetsOfSession(
  snapshot: EditingStudioSnapshot | null,
  sessionId: string | null,
): readonly EditChangeSet[] {
  if (!snapshot || sessionId === null) return [];
  return snapshot.changeSets.filter((changeSet) => changeSet.sessionId === sessionId);
}

/** 某结果 id 的 interchange 账本事实（未知 → null）。 */
export function interchangeFactOf(
  snapshot: EditingStudioSnapshot | null,
  resultId: string | null,
): InterchangeFactView | null {
  if (!snapshot || resultId === null) return null;
  return snapshot.interchangeFacts.find((fact) => fact.resultId === resultId) ?? null;
}

/** 最近一次 succeeded 导出的包摘要（round-trip 恒等校验的基准；无 → null）。 */
export function lastExportDigest(
  snapshot: EditingStudioSnapshot | null,
): string | null {
  if (!snapshot) return null;
  const facts = snapshot.interchangeFacts.filter(
    (fact) => fact.direction === "export" && fact.status === "succeeded" && fact.packageDigest !== null,
  );
  return facts.at(-1)?.packageDigest ?? null;
}

/** 最近一次 succeeded 导入的包摘要（无 → null）。 */
export function lastImportDigest(
  snapshot: EditingStudioSnapshot | null,
): string | null {
  if (!snapshot) return null;
  const facts = snapshot.interchangeFacts.filter(
    (fact) => fact.direction === "import" && fact.status === "succeeded" && fact.packageDigest !== null,
  );
  return facts.at(-1)?.packageDigest ?? null;
}

/** 候选解决状态（proposed / accepted / rejected；未知候选 → null）。 */
export function candidateResolutionOf(
  snapshot: EditingStudioSnapshot | null,
  candidateId: string | null,
): CandidateResolutionView | null {
  if (!snapshot || candidateId === null) return null;
  return snapshot.candidateResolutions.find((view) => view.candidateId === candidateId) ?? null;
}
