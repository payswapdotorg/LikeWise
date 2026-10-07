// YOU Solution Studio — SolutionSurfaceController port (W1B).
//
// 边界（docs/you/WORK_ORDERS.md W1B / docs/you/ARCHITECTURE.md §6）：
// - 本文件只定义 UI 消费的服务端口；canonical Solution truth 属于 Solution 应用服务
//   （Worker A，`you/w1a-core`）。UI 不实现领域逻辑。
// - 契约类型一律从 `@zcode/shared` 导入（frozen wave-1 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `solutionSimulatedController.ts` 的确定性剧本；
//   TODO(T1): bind to solutionService（Worker A 的 Solution 应用服务经
//   `packages/services/src/you/**` 提供后，由 TL 在 T1 替换本端口的绑定）。
import type {
  ArenaEscalationRef,
  CapabilityGap,
  ChangeSet,
  ConsentReference,
  EditMode,
  EditorRecommendation,
  EditSession,
  EvidenceRequest,
  EvidenceType,
  FeedbackCategory,
  FeedbackRequest,
  LearningScope,
  OpaqueId,
  SolutionEntity,
  SolutionEvent,
  SolutionIdentity,
  SolutionSelector,
  SolutionTransform,
  SolutionVersion,
  YouError,
} from "@zcode/shared";
import type { SolutionPackageManifest } from "./solutionExportModel.js";

/** 端口加载请求：workspaceIdentity 优先，回退 workspacePath（Workspace Identity 统一口径）。 */
export interface SolutionSurfaceLoadRequest {
  readonly workspaceKey: string;
}

/** 反馈提交输入；FeedbackRequest 的其余字段由服务端确定（id/时间戳/consent/状态）。 */
export interface FeedbackSubmission {
  readonly targetRef: SolutionSelector;
  readonly category: FeedbackCategory;
  readonly userComment: string;
  readonly requestedAction: string;
  readonly scope: LearningScope;
}

/** 定向证据请求输入；privacy/retention/framing 由服务端按策略确定。 */
export interface EvidenceRequestInput {
  readonly feedbackRequestId: OpaqueId;
  readonly targetDeficiency: string;
  readonly evidenceType: EvidenceType;
  readonly reason: string;
}

/** 手动接管（EditSession）会话输入。 */
export interface EditSessionInput {
  readonly mode: EditMode;
}

/** 手动纠正输入：直接给出纠正后的完整 transform（observed 证据）。 */
export interface ManualCorrectionInput {
  readonly editSessionId: OpaqueId;
  readonly entityId: OpaqueId;
  readonly transform: SolutionTransform;
  readonly note: string;
}

/** 重复意图结果：学习是否生效必须可判定、可解释（OPERATOR_ACCEPTANCE Learning）。 */
export interface RepeatIntentResult {
  readonly changeSet: ChangeSet;
  /** 仅当学习许可已授予时为 true；否则新结果不携带任何已学习偏好。 */
  readonly learningApplied: boolean;
  /** 生效偏好的作用域（当前剧本固定 USER，绝不静默升级为 GLOBAL）。 */
  readonly learningScope: LearningScope;
  readonly summary: string;
}

/**
 * UI 消费的 Solution 会话快照。所有记录都是 frozen contract 形状的只读投影；
 * SolutionVersion / EditSession / ChangeSet / SolutionEvent 均为不可变记录。
 */
export interface SolutionSurfaceSnapshot {
  readonly identity: SolutionIdentity;
  /** 版本链，最旧在前；末位是当前 canonical 版本。 */
  readonly versions: readonly SolutionVersion[];
  /** 待接受/拒绝的候选 ChangeSet（含 Agent 改进、手动接管、导入、Arena 应用）。 */
  readonly pendingChangeSets: readonly ChangeSet[];
  readonly feedback: readonly FeedbackRequest[];
  readonly evidenceRequests: readonly EvidenceRequest[];
  readonly editSessions: readonly EditSession[];
  /** append-only 事件账本投影（replay 可复现）。 */
  readonly events: readonly SolutionEvent[];
  readonly learningPermission: ConsentReference;
  readonly capabilityGaps: readonly CapabilityGap[];
  readonly escalations: readonly ArenaEscalationRef[];
  /** 意图文案（Phase 0 剧本固定；Intent 契约在后续 wave 冻结）。 */
  readonly intentSummary: string;
  /** 上次 repeatIntent 的解释性结果；未运行过为 null。 */
  readonly lastRepeatIntent: RepeatIntentResult | null;
  /** 学习候选（手动接管产生）；仅展示用途，学习须显式许可。 */
  readonly learningCandidate: SolutionLearningCandidate | null;
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

/** 学习候选展示模型（LearningCandidate 契约在后续 wave 冻结；此处仅为诚实展示）。 */
export interface SolutionLearningCandidate {
  readonly summary: string;
  readonly scope: LearningScope;
  readonly sourceEditSessionId: OpaqueId;
}

/** 端口级 typed error：UI 用它渲染 truthful 错误态。 */
export class SolutionSurfaceError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "SolutionSurfaceError";
    this.youError = youError;
  }
}

/**
 * Solution Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T1 换绑 Worker A 的
 * solutionService。方法与 Solution protocol（host↔runtime）同构，但走应用服务权威
 * （UI/HTTP/SDK/MCP 同一权威——docs/you/CONTRACTS.md）。
 */
export interface SolutionSurfaceController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不允许伪装真实 provider。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：会话已存在时返回当前快照，不重建（ADR-002 持久表面语义）。 */
  load(request: SolutionSurfaceLoadRequest): Promise<SolutionSurfaceSnapshot>;
  refresh(): Promise<SolutionSurfaceSnapshot>;

  submitFeedback(submission: FeedbackSubmission): Promise<FeedbackRequest>;
  requestEvidence(input: EvidenceRequestInput): Promise<EvidenceRequest>;
  /** 附加 fixture 证据（模拟，明确标注；不收集真实生物特征数据）。 */
  attachFixtureEvidence(evidenceRequestId: OpaqueId): Promise<EvidenceRequest>;

  /** Agent 提出确定性改进（对应 feedback），产生 proposed ChangeSet。 */
  proposeDeterministicImprovement(feedbackRequestId: OpaqueId): Promise<ChangeSet>;
  acceptChangeSet(changeSetId: OpaqueId): Promise<SolutionVersion>;
  rejectChangeSet(changeSetId: OpaqueId): Promise<ChangeSet>;
  /** 丢弃候选提案（accept/revert 的另一半），状态置 reverted，不产生新版本。 */
  revertChangeSet(changeSetId: OpaqueId): Promise<ChangeSet>;

  openEditSession(input: EditSessionInput): Promise<EditSession>;
  /** 手动纠正 → proposed ChangeSet（authorType: user）。 */
  submitManualCorrection(input: ManualCorrectionInput): Promise<ChangeSet>;
  closeEditSession(editSessionId: OpaqueId): Promise<EditSession>;

  /** 显式学习许可控制；默认未授予（no learning without permission）。 */
  setLearningPermission(granted: boolean): Promise<ConsentReference>;

  recommendEditor(): Promise<EditorRecommendation>;
  exportPackage(versionId: OpaqueId): Promise<SolutionPackageManifest>;
  /** 校验并解析外部编辑器回传的包，产生 importer ChangeSet（不直接成为 canonical）。 */
  importPackage(manifest: SolutionPackageManifest): Promise<ChangeSet>;

  /** 重复意图：结果必须反映「是否应用了已学习纠正」的真相。 */
  repeatIntent(intentId: OpaqueId): Promise<RepeatIntentResult>;

  /** 触发已知能力缺口 fixture（确定性；OPERATOR_ACCEPTANCE Capability gap）。 */
  triggerCapabilityGapFixture(): Promise<CapabilityGap>;
  /** 用户授权后升级到 Arena；Arena 不静默改 YOU 状态。 */
  escalateToArena(capabilityGapId: OpaqueId): Promise<ArenaEscalationRef>;
  /** 通过 YOU 自身权威把 Arena 结果应用为 ChangeSet（authorType: expert）。 */
  applyArenaResult(escalationId: OpaqueId): Promise<ChangeSet>;
}

/** 快照里的当前 canonical 版本（版本链末位）。 */
export function currentSolutionVersion(
  snapshot: SolutionSurfaceSnapshot | null,
): SolutionVersion | null {
  return snapshot?.versions.at(-1) ?? null;
}

/** 从快照按 id 查实体（基于当前版本状态）。 */
export function findSolutionEntity(
  snapshot: SolutionSurfaceSnapshot | null,
  entityId: OpaqueId,
): SolutionEntity | null {
  const version = currentSolutionVersion(snapshot);
  return version?.state.entities.find((entity) => entity.id === entityId) ?? null;
}
