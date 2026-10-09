// YOU Capture Studio — CaptureStudioController port (W2B)。
//
// 边界（docs/you/WORK_ORDERS.md W2B / docs/you/CONTRACTS.md wave-2 freeze）：
// - 本文件只定义 UI 消费的服务端口；evidence/capture/consent 的 canonical truth
//   属于 evidence 应用服务（Worker A，`you/w2a-core`）。UI 不实现领域逻辑。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v2 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `captureSimulatedController.ts` 的确定性剧本；
//   TODO(T2): bind to Worker A 的 evidence 服务（TL 在 T2 换绑本端口的绑定）。
// - upload UX 绑定既有 v1 Solution protocol 事件（upload_requested / evidence_requested），
//   不发明 UI-only 变更路径（CONTRACTS.md "API/MCP/UI parity"）。
import type {
  CaptureModality,
  CaptureSession,
  ConsentPolicy,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  EvidenceRecord,
  EvidenceRequest,
  EvidenceReview,
  OpaqueId,
  SolutionEvent,
  SolutionRuntimeEvent,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 政策）
// ---------------------------------------------------------------------------

export interface CaptureStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 定向证据请求输入；privacy/retention/framing 由服务端按政策确定。 */
export interface TargetedEvidenceInput {
  readonly targetDeficiency: string;
  readonly reason: string;
}

export interface CaptureSessionOpenInput {
  readonly evidenceRequestId: OpaqueId;
}

export interface CaptureStepInput {
  readonly sessionId: OpaqueId;
  readonly stepId: OpaqueId;
}

/** 显式按用途 grant/deny（SECURITY.md：purpose-specific consent）。 */
export interface ConsentDecisionInput {
  readonly policyId: OpaqueId;
  readonly purpose: ConsentPurpose;
  readonly decision: "grant" | "deny";
}

/** 学习复用是独立许可，绝不随 operational 授权隐式获得。 */
export interface LearningReuseInput {
  readonly policyId: OpaqueId;
  readonly granted: boolean;
}

export interface WithdrawConsentInput {
  readonly policyId: OpaqueId;
}

export interface EvidenceReviewInput {
  readonly evidenceId: OpaqueId;
  readonly outcome: "accepted" | "rejected";
  readonly notes: string;
}

/** 请求一个上传槽位（宿主收到 upload_requested runtime 事件）。 */
export interface UploadSlotInput {
  readonly evidenceRequestId: OpaqueId;
}

export interface UploadFixtureInput {
  readonly artifactId: OpaqueId;
  /** 确定性「传输损坏」模拟 → typed YOU_CONTENT_HASH_MISMATCH（绝不静默修复）。 */
  readonly corrupt?: boolean;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** 按用途的同意状态（append-only consent 事件的投影；稳定按 purpose 排序）。 */
export interface CapturePurposeConsentState {
  readonly purpose: ConsentPurpose;
  readonly state: ConsentState;
}

/**
 * 同意状态的只读投影：政策 + 每用途状态 + 独立学习复用许可 + 当前绑定引用。
 * 「无许可 ⇒ 不处理」由 projectConsentProcessingGate 纯投影，且由服务端强制。
 */
export interface CaptureConsentProjection {
  readonly policy: ConsentPolicy;
  readonly purposeStates: readonly CapturePurposeConsentState[];
  /** 学习复用许可（独立开关；SECURITY.md：no learning without separate permission）。 */
  readonly learningReuse: boolean;
  /** 新采集证据绑定的当前 ConsentReference（不可变快照）。 */
  readonly reference: ConsentReference;
}

/** 保留状态投影（记录不可变；内容按政策过期 / 清除）。 */
export interface CaptureRetentionProjection {
  /** 内容已按 delete-after-review 过期的 evidence id（记录与溯源保留）。 */
  readonly expiredEvidenceIds: readonly OpaqueId[];
  /** 已整体清除的 evidence id（任何访问 → YOU_EVIDENCE_NOT_FOUND）。 */
  readonly purgedEvidenceIds: readonly OpaqueId[];
}

/**
 * 引导步骤 ↔ 证据记录绑定的只读投影。frozen EvidenceRecord 不携带 stepId
 *（内容寻址、只引用 contentRef），绑定关系由服务端事实投影到快照供 UI 显示进度。
 */
export interface CaptureStepBinding {
  readonly evidenceId: OpaqueId;
  readonly captureSessionId: OpaqueId;
  readonly stepId: OpaqueId;
}

export interface CaptureStudioSnapshot {
  readonly displayName: string;
  readonly evidenceRequests: readonly EvidenceRequest[];
  readonly captureSessions: readonly CaptureSession[];
  readonly evidenceRecords: readonly EvidenceRecord[];
  readonly reviews: readonly EvidenceReview[];
  readonly consent: CaptureConsentProjection;
  readonly retention: CaptureRetentionProjection;
  /** 引导步骤 ↔ 证据记录绑定（进度投影所需的服务端事实）。 */
  readonly captureStepBindings: readonly CaptureStepBinding[];
  /** 待处理上传槽位（upload_requested 已发出、内容未绑定）。 */
  readonly pendingUploadSlots: readonly CaptureUploadSlotProjection[];
  /** append-only 事件账本投影（capture-session-* / evidence-* / consent-*）。 */
  readonly events: readonly SolutionEvent[];
  /** 面向宿主呈现的 Solution protocol runtime 事件（evidence_requested / upload_requested）。 */
  readonly runtimeEvents: readonly SolutionRuntimeEvent[];
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

/** 上传槽位投影：artifact ↔ 绑定的证据请求。 */
export interface CaptureUploadSlotProjection {
  readonly artifactId: OpaqueId;
  readonly evidenceRequestId: OpaqueId;
}

/** 上传/读取成功时返回的合成 fixture 内容（seed 派生；明确标注 simulated）。 */
export interface CaptureFixtureContent {
  readonly evidenceId: OpaqueId;
  readonly contentRef: OpaqueId;
  readonly byteLength: number;
  readonly preview: string;
  readonly contentHash: string;
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class CaptureStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "CaptureStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Capture Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T2 换绑 Worker A 的
 * evidence/capture/consent 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface CaptureStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实 provider。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：会话已存在时返回当前快照，不重建。 */
  load(request: CaptureStudioLoadRequest): Promise<CaptureStudioSnapshot>;
  refresh(): Promise<CaptureStudioSnapshot>;

  // -- 定向证据请求（EvidenceRequest UX：reason / privacy / retention 显著呈现） --
  requestTargetedEvidence(input: TargetedEvidenceInput): Promise<EvidenceRequest>;

  // -- 引导采集会话（CaptureSession 状态机：consent-pending → active → completed/declined/expired） --
  openCaptureSession(input: CaptureSessionOpenInput): Promise<CaptureSession>;
  captureGuideStep(input: CaptureStepInput): Promise<EvidenceRecord>;
  completeCaptureSession(sessionId: OpaqueId): Promise<CaptureSession>;
  declineCaptureSession(sessionId: OpaqueId): Promise<CaptureSession>;
  /** 服务端超时语义的确定性模拟（无 UI 触发路径；测试覆盖）。 */
  expireCaptureSession(sessionId: OpaqueId): Promise<CaptureSession>;

  // -- 同意（explicit / scoped / revocable / purpose-specific / 学习复用独立） --
  decideConsent(input: ConsentDecisionInput): Promise<CaptureConsentProjection>;
  setLearningReuse(input: LearningReuseInput): Promise<CaptureConsentProjection>;
  withdrawConsent(input: WithdrawConsentInput): Promise<CaptureConsentProjection>;

  // -- 证据评审（deterministic qualityObservations + accept/reject；re-review supersedes） --
  reviewEvidence(input: EvidenceReviewInput): Promise<EvidenceReview>;

  // -- 上传 / 完整性 / 保留（绑定 upload_requested / evidence 流） --
  requestUploadSlot(input: UploadSlotInput): Promise<OpaqueId>;
  uploadFixtureContent(input: UploadFixtureInput): Promise<EvidenceRecord>;
  /** 读取合成内容：过期 → YOU_RETENTION_EXPIRED；清除 → YOU_EVIDENCE_NOT_FOUND。 */
  readFixtureContent(evidenceId: OpaqueId): Promise<CaptureFixtureContent>;
  /** 应用 delete-after-review 清除（演示确定性保留语义；记录账本保持 append-only）。 */
  applyRetentionPurge(): Promise<CaptureStudioSnapshot>;
}

// ---------------------------------------------------------------------------
// 同意状态纯投影（「无许可 ⇒ 不处理」必须可见且可测）
// ---------------------------------------------------------------------------

export interface CaptureProcessingGate {
  readonly purpose: ConsentPurpose | "learning-reuse";
  readonly allowed: boolean;
  readonly state: ConsentState;
  /** 稳定原因码（UI 文案表按 reason/state 渲染；测试断言）。 */
  readonly reason: "granted" | "unknown" | "denied" | "expired" | "withdrawn";
}

/**
 * 用途处理门：仅当该用途被显式 granted 时 allowed=true。
 * withdrawn/denied/unknown ⇒ allowed=false（no permission ⇒ no processing）。
 */
export function projectConsentProcessingGate(
  consent: CaptureConsentProjection,
  purpose: ConsentPurpose,
): CaptureProcessingGate {
  const entry = consent.purposeStates.find((candidate) => candidate.purpose === purpose);
  const state = entry?.state ?? "unknown";
  return {
    purpose,
    allowed: state === "granted",
    state,
    reason: state === "granted" ? "granted" : state,
  };
}

/** 学习复用门：与 operational 用途相互独立，绝不隐式允许。 */
export function projectLearningReuseGate(
  consent: CaptureConsentProjection,
): CaptureProcessingGate {
  const state: ConsentState = consent.learningReuse ? "granted" : "unknown";
  return {
    purpose: "learning-reuse",
    allowed: consent.learningReuse,
    state,
    reason: state,
  };
}
/**
 * 操作性处理门（引导采集 / 上传的统一门）：政策内全部用途均 granted 才允许。
 * 这是 UI 的按钮禁用投影；服务端强制独立存在（captureGuideStep 抛 YOU_CONSENT_REQUIRED）。
 */
export function projectOperationalProcessingGate(
  consent: CaptureConsentProjection,
): CaptureProcessingGate {
  const states = consent.policy.purposes.map((purpose) =>
    projectConsentProcessingGate(consent, purpose),
  );
  const blocking = states.find((gate) => !gate.allowed) ?? null;
  if (!blocking) {
    return {
      purpose: "quality-improvement",
      allowed: true,
      state: "granted",
      reason: "granted",
    };
  }
  return {
    purpose: "quality-improvement",
    allowed: false,
    state: blocking.state,
    reason: blocking.reason,
  };
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B currentSolutionVersion 同款模式）
// ---------------------------------------------------------------------------

/** 当前引导采集会话：优先 active；其次 consent-pending；无则 null。 */
export function currentCaptureSession(
  snapshot: CaptureStudioSnapshot | null,
): CaptureSession | null {
  if (!snapshot) return null;
  const active = snapshot.captureSessions.find(
    (session) => session.status === "active",
  );
  if (active) return active;
  const pending = snapshot.captureSessions.find(
    (session) => session.status === "consent-pending",
  );
  return pending ?? null;
}

/** 证据记录按捕获时间稳定排序（追加序即稳定序；显式排序满足 FIXTURES 法则 4）。 */
export function orderedEvidenceRecords(
  snapshot: CaptureStudioSnapshot | null,
): readonly EvidenceRecord[] {
  if (!snapshot) return [];
  return [...snapshot.evidenceRecords].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 某证据的有效（非 superseded）评审；无则 null。 */
export function effectiveReviewForEvidence(
  snapshot: CaptureStudioSnapshot | null,
  evidenceId: OpaqueId,
): EvidenceReview | null {
  if (!snapshot) return null;
  const reviews = snapshot.reviews
    .filter((review) => review.evidenceId === evidenceId && review.status !== "superseded")
    .sort((a, b) => (a.id < b.id ? 1 : -1));
  return reviews[0] ?? null;
}

/** 引导步骤 → modality 对应的 EvidenceType（确定性映射；开放联合允许扩展值）。 */
export function evidenceTypeForModality(modality: CaptureModality): string {
  switch (modality) {
    case "image":
      return "reference-image";
    case "video":
      return "reference-video";
    case "depth":
      return "measurement";
    case "audio":
      return "reference-audio";
    case "measurement":
      return "measurement";
    case "document":
      return "document";
    default:
      return "fixture";
  }
}
