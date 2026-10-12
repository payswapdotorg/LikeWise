// YOU Learning Studio — LearningStudioController 端口（W6B）。
//
// 边界（docs/you/WORK_ORDERS.md W6B / docs/you/CONTRACTS.md wave-6 freeze）：
// - 本文件只定义 UI 消费的服务端口；learning 的 canonical truth 属于 learning
//   应用服务（Worker A，W6A）。UI 不实现领域逻辑。
// - 端口形状镜像 W6A 服务接缝（signal capture / ledger reads / 记录阶梯 / rights /
//   preferences / trajectories / consent），T6 换绑时逐方法对位。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v6 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `learningSimulatedController.ts` 的确定性剧本；
//   TODO(T6): bind to Worker A 的 learning 服务（TL 在 T6 换绑本端口）。
// - RIGHTS LAW：记录只在其 LearningRights 同意授予范围内可用（consentRef +
//   consentHash 可溯源至 wave-2 consent authority）；无 rights 的记录惰性；
//   授予外的使用是 typed YOU_LEARNING_RIGHTS_REQUIRED 拒绝。
import type {
  ConsentPolicy,
  ConsentPurpose,
  ConsentReference,
  ConsentState,
  LearningPreference,
  LearningRecord,
  LearningRecordStatus,
  LearningRightUsage,
  LearningRights,
  LearningScope,
  LearningSignal,
  LearningSignalKind,
  OpaqueId,
  SolutionEvent,
  TrajectoryReference,
  YouError,
} from "@zcode/shared";
import type {
  LearningEvidenceView,
  LearningKindView,
  StoryboardContentBinding,
} from "./learningStoryboard.js";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 政策）
// ---------------------------------------------------------------------------

export interface LearningStudioLoadRequest {
  readonly workspaceKey: string;
}

/** teach-me/learn-this 确认（kind/scope/evidence 校验最先 ⇒ YOU_LEARNING_SIGNAL_INVALID）。 */
export interface CaptureLearningSignalInput {
  readonly kind: LearningSignalKind;
  readonly scope: LearningScope;
  readonly subjectRef?: OpaqueId | null;
  readonly evidenceRefs: readonly string[];
}

/** 确定性合成 validated content 绑定（内容寻址；空 seedText ⇒ typed 拒绝）。 */
export interface SynthesizeLearningContentInput {
  readonly seedText: string;
}

/** 签发 rights（issuance-as-enforcement：learning 用途未授予 ⇒ YOU_LEARNING_RIGHTS_REQUIRED）。 */
export interface IssueLearningRightsInput {
  readonly usage: readonly LearningRightUsage[];
  readonly expiresAt?: string | null;
}

/** 打开候选记录（scope 继承自 signal；rights 省略 ⇒ 惰性记录）。 */
export interface OpenCandidateRecordInput {
  readonly signalId: OpaqueId;
  readonly contentRef: string;
  readonly contentHash: string;
  readonly rights?: LearningRights | null;
}

/** 验证记录（可选 supersededBy 链接：目标必须已 validated；append-only）。 */
export interface ValidateLearningRecordInput {
  readonly recordId: OpaqueId;
  readonly supersedesRecordId?: OpaqueId | null;
}

export interface RejectLearningRecordInput {
  readonly recordId: OpaqueId;
  readonly reason: string;
}

/** 使用记录（仅 validated；rights 评估 8 步固定序 ⇒ 授予外 typed 拒绝）。 */
export interface UseLearningRecordInput {
  readonly recordId: OpaqueId;
  readonly usage: LearningRightUsage;
}

/** 派生偏好（记录须 validated；rights 须覆盖 personalization；范围不得扩缩）。 */
export interface DeriveLearningPreferenceInput {
  readonly recordId: OpaqueId;
  readonly key: string;
  readonly value: string;
  /** 缺省取记录的 scope；必须与之相等（scoping law）。 */
  readonly scope?: LearningScope;
}

/** 操作员种子偏好（无 rights 门——operator seed，无记录参与）。 */
export interface SetOperatorPreferenceInput {
  readonly scope: LearningScope;
  readonly key: string;
  readonly value: string;
}

/** 清除操作员种子（投射意图；派生偏好是投影——不可手工清除）。 */
export interface ClearOperatorPreferenceInput {
  readonly scope: LearningScope;
  readonly key: string;
}

/** 确定性合成 trajectory 步骤引用（seed 派生；stepCount ≥ 1）。 */
export interface SynthesizeTrajectoryStepsInput {
  readonly seedText: string;
  readonly stepCount: number;
}

export interface RecordTrajectoryInput {
  readonly scope: LearningScope;
  readonly stepRefs: readonly string[];
}

/** 显式按用途 grant/deny（learning 用途；同一 wave-2 权威——无第二条同意路径）。 */
export interface LearningConsentDecisionInput {
  readonly policyId: OpaqueId;
  readonly purpose: ConsentPurpose;
  readonly decision: "grant" | "deny";
}

export interface LearningWithdrawConsentInput {
  readonly policyId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** 按用途的同意状态（append-only consent 事件的投影；稳定按 purpose 排序）。 */
export interface LearningPurposeConsentState {
  readonly purpose: ConsentPurpose;
  readonly state: ConsentState;
}

/**
 * 同意状态的只读投影（与 W2B/W3B/W4B/W5B 同款形状）。learning 的授权走
 * purpose "learning"（RIGHTS LAW：consentRef + consentHash 溯源至 wave-2 权威）。
 */
export interface LearningConsentProjection {
  readonly policy: ConsentPolicy;
  readonly purposeStates: readonly LearningPurposeConsentState[];
  readonly reference: ConsentReference;
}

export interface LearningStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 learning 表面）。 */
  readonly studioId: OpaqueId;
  /** kind 注册面（teach-me kind picker 的数据源；W6C 生态车道注册数据）。 */
  readonly kindRegistry: readonly LearningKindView[];
  /** scope 分类学（scope ladder 的数据源；frozen v1 LearningScope 全集）。 */
  readonly scopes: readonly LearningScope[];
  /** usage 分类学（rights 显示的 usage classes 数据源）。 */
  readonly rightUsages: readonly LearningRightUsage[];
  /** evidence 注册面（teach-me 证据挑选的数据源；来源平面保有真相）。 */
  readonly evidence: readonly LearningEvidenceView[];
  /** 已捕获信号（id 升序——ledger read 语义）。 */
  readonly signals: readonly LearningSignal[];
  /** 记录（含 candidate；id 升序——账本视图按状态分组呈现）。 */
  readonly records: readonly LearningRecord[];
  /** 偏好（`${scope}::${key}` 投影键升序）。 */
  readonly preferences: readonly LearningPreference[];
  /** trajectory 注册（id 升序；内容寻址 stepRefs——绝不内联）。 */
  readonly trajectories: readonly TrajectoryReference[];
  readonly consent: LearningConsentProjection;
  /** append-only 事件账本投影（learning 四事件 + consent-*）。 */
  readonly events: readonly SolutionEvent[];
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class LearningStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "LearningStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Learning Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T6 换绑 Worker A 的
 * learning 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface LearningStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实学习。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：learning 平面已存在时返回当前快照，不重建。 */
  load(request: LearningStudioLoadRequest): Promise<LearningStudioSnapshot>;
  refresh(): Promise<LearningStudioSnapshot>;

  // -- teach-me / learn-this（signal capture） --
  /** 捕获学习信号（校验最先 ⇒ YOU_LEARNING_SIGNAL_INVALID；事件 learning-signal-captured）。 */
  captureSignal(input: CaptureLearningSignalInput): Promise<LearningSignal>;

  // -- validated content + rights（RIGHTS LAW） --
  /** 确定性内容绑定（contentRef + contentHash；内容绝不内联）。 */
  synthesizeLearningContent(
    input: SynthesizeLearningContentInput,
  ): Promise<StoryboardContentBinding>;
  /** 签发 rights（learning 用途门最先 ⇒ 无许可 YOU_LEARNING_RIGHTS_REQUIRED）。 */
  issueRights(input: IssueLearningRightsInput): Promise<LearningRights>;

  // -- 记录阶梯（candidate → validated | rejected；validated → superseded） --
  /** 打开候选记录（scope 继承 signal；rights 省略 ⇒ 惰性记录）。 */
  openCandidateRecord(input: OpenCandidateRecordInput): Promise<LearningRecord>;
  /** 验证记录（合法 supersession 以 successor 的事件落账；记录替换不可变）。 */
  validateRecord(
    input: ValidateLearningRecordInput,
  ): Promise<{ readonly record: LearningRecord; readonly superseded: LearningRecord | null }>;
  /** 拒绝记录（candidate only；事件 learning-record-rejected）。 */
  rejectRecord(input: RejectLearningRecordInput): Promise<LearningRecord>;
  /** 使用记录（仅 validated；rights 8 步评估 ⇒ YOU_LEARNING_RIGHTS_REQUIRED）。 */
  useRecord(
    input: UseLearningRecordInput,
  ): Promise<{ readonly record: LearningRecord; readonly usage: LearningRightUsage }>;

  // -- 偏好（projection；派生带 lineage） --
  /** 派生偏好（记录须 validated；范围不得扩缩 ⇒ YOU_PREFERENCE_SCOPE_INVALID）。 */
  derivePreference(
    input: DeriveLearningPreferenceInput,
  ): Promise<{ readonly preference: LearningPreference; readonly previous: LearningPreference | null }>;
  /** 操作员种子偏好（投射意图；无 rights 门）。 */
  setOperatorPreference(
    input: SetOperatorPreferenceInput,
  ): Promise<{ readonly preference: LearningPreference; readonly previous: LearningPreference | null }>;
  /** 清除操作员种子偏好（投射意图；派生偏好是投影 ⇒ typed 拒绝）。返回被清除的种子。 */
  clearOperatorPreference(input: ClearOperatorPreferenceInput): Promise<LearningPreference>;

  // -- trajectory（learning replay 的重放基底） --
  /** 确定性合成步骤引用（seed 派生；同 seed ⇒ 字节一致）。 */
  synthesizeTrajectorySteps(
    input: SynthesizeTrajectoryStepsInput,
  ): Promise<{ readonly stepRefs: readonly string[] }>;
  /** 记录 trajectory（内容寻址 stepRefs；注册面服务状态——不落事件）。 */
  recordTrajectory(input: RecordTrajectoryInput): Promise<TrajectoryReference>;
  /** 确定性重放（按 stepRefs 顺序拼接字节；同 seed ⇒ 字节一致 + 同摘要）。 */
  replayTrajectory(input: {
    readonly trajectoryId: OpaqueId;
  }): Promise<{
    readonly trajectory: TrajectoryReference;
    readonly bytes: Uint8Array;
    readonly replayHash: string;
    readonly stepCount: number;
  }>;

  // -- 同意（learning 用途授权的 binding-time 强制；委托 wave-2 权威） --
  decideConsent(input: LearningConsentDecisionInput): Promise<LearningConsentProjection>;
  withdrawConsent(input: LearningWithdrawConsentInput): Promise<LearningConsentProjection>;
}

// ---------------------------------------------------------------------------
// 同意状态纯投影（「无许可 ⇒ 不处理」必须可见且可测）
// ---------------------------------------------------------------------------

export interface LearningConsentGate {
  readonly purpose: ConsentPurpose;
  readonly allowed: boolean;
  readonly state: ConsentState;
  /** 稳定原因码（UI 文案表按 state 渲染；测试断言）。 */
  readonly reason: "granted" | "unknown" | "denied" | "expired" | "withdrawn";
}

/** 用途门：仅当该用途被显式 granted 时 allowed=true（no permission ⇒ no processing）。 */
export function projectLearningConsentGate(
  consent: LearningConsentProjection,
  purpose: ConsentPurpose,
): LearningConsentGate {
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
// 快照选择器（W1B–W5B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** 信号列表（id 升序；ledger read 语义）。 */
export function orderedLearningSignals(
  snapshot: LearningStudioSnapshot | null,
): readonly LearningSignal[] {
  if (!snapshot) return [];
  return snapshot.signals;
}

/** 按 id 解析信号（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function learningSignalById(
  snapshot: LearningStudioSnapshot | null,
  signalId: string | null,
): LearningSignal | null {
  if (!snapshot || signalId === null) return null;
  return snapshot.signals.find((signal) => signal.id === signalId) ?? null;
}

/** 记录列表（id 升序；含 candidate）。 */
export function orderedLearningRecords(
  snapshot: LearningStudioSnapshot | null,
): readonly LearningRecord[] {
  if (!snapshot) return [];
  return snapshot.records;
}

/** 按 id 解析记录（未知 id → null）。 */
export function learningRecordById(
  snapshot: LearningStudioSnapshot | null,
  recordId: string | null,
): LearningRecord | null {
  if (!snapshot || recordId === null) return null;
  return snapshot.records.find((record) => record.id === recordId) ?? null;
}

/** 某信号的全部记录（追加序）。 */
export function recordsOfSignal(
  snapshot: LearningStudioSnapshot | null,
  signalId: string | null,
): readonly LearningRecord[] {
  if (!snapshot || signalId === null) return [];
  return snapshot.records.filter((record) => record.signalId === signalId);
}

/** 验证记录的状态（含 candidate）。 */
export function learningRecordStatus(
  record: LearningRecord | null,
): LearningRecordStatus | null {
  return record?.status ?? null;
}

/** 记录的后继者（supersededById 指向本记录的 validated 记录；无 → null）。 */
export function successorOfRecord(
  snapshot: LearningStudioSnapshot | null,
  recordId: string | null,
): LearningRecord | null {
  if (!snapshot || recordId === null) return null;
  return (
    snapshot.records.find((record) => record.supersededById === recordId) ?? null
  );
}

/** 偏好列表（`${scope}::${key}` 投影键升序）。 */
export function orderedLearningPreferences(
  snapshot: LearningStudioSnapshot | null,
): readonly LearningPreference[] {
  if (!snapshot) return [];
  return snapshot.preferences;
}

/** 按投影键解析偏好（未知键 → null）。 */
export function learningPreferenceOfKey(
  snapshot: LearningStudioSnapshot | null,
  scope: string | null,
  key: string | null,
): LearningPreference | null {
  if (!snapshot || scope === null || key === null) return null;
  return (
    snapshot.preferences.find(
      (preference) => preference.scope === scope && preference.key === key,
    ) ?? null
  );
}

/** trajectory 列表（id 升序）。 */
export function orderedLearningTrajectories(
  snapshot: LearningStudioSnapshot | null,
): readonly TrajectoryReference[] {
  if (!snapshot) return [];
  return snapshot.trajectories;
}

/** 按 id 解析 trajectory（未知 id → null）。 */
export function learningTrajectoryById(
  snapshot: LearningStudioSnapshot | null,
  trajectoryId: string | null,
): TrajectoryReference | null {
  if (!snapshot || trajectoryId === null) return null;
  return snapshot.trajectories.find((entry) => entry.id === trajectoryId) ?? null;
}
