// YOU Lab Studio — LabStudioController 端口（W9B）。
//
// 边界（docs/you/WORK_ORDERS.md W9B / docs/you/CONTRACTS.md "Wave-9 contract
// freeze (v9)"）：
// - 本文件只定义 UI 消费的服务端口；lab 的 canonical truth 属于 Worker A 的
//   lab 持久化服务（W9A：LabExperiment/LabRun 不可变记录 + append-only run
//   阶梯 + content-addressed evidence manifests + promotion gate）。UI 不实现
//   领域逻辑。
// - 端口形状镜像 W9A 服务接缝 1:1（实验声明/run 阶梯/manifest 发布与校验/
//   promotion gate；世界与搜索预算 intake 为 W9C 接缝的声明侧镜像——T9 换绑
//   时逐方法对位，W8B 先例同款）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v9 `you/contract.ts`），禁止本地
//   重声明。
// - Phase 0 的实现是 `labSimulatedController.ts` 的确定性剧本；
//   TODO(T9): bind to Worker A 的 lab 服务（TL 在 T9 换绑本端口）。
// - LAB PERSISTENCE LAW：LabExperiment、LabRun、LabEvidenceManifest 与
//   LabPromotionRecord 记录不可变；run 阶梯 append-only；manifest 是
//   content-addressed 的 durability 单元。
// - LAB PROMOTION LAW：searched 组织仅在实验记录的 objective 与 constraints 下
//   胜过 generalist baseline 才可晋升；promotion 记录不可变，reversal 是新记录。
// - LAB DETERMINISM LAW：世界与基准 run seed-deterministic；一切 simulated 内容
//   保持 `simulated: true`（truth law）。
// - SEARCH BUDGET LAW：search/RL 阶梯在显式累计预算下探索；每步是 append 的
//   SearchLadderStep；预算耗尽是 recorded terminal，绝非静默停止。
// - 事件词汇（frozen additive wave-9）：lab-run-recorded /
//   lab-evidence-published / lab-promotion-decided + solution-created。frozen
//   词汇无 lab-experiment-declared 类型——实验声明是 durable 记录（不伪造事件，
//   与 W8B delivered/rejected 无事件类型同款披露）。
import type {
  LabArmKind,
  LabExperiment,
  LabPromotionRecord,
  LabRun,
  LabRunStatus,
  LabWorldDescriptor,
  OpaqueId,
  SearchLadderStep,
  SolutionEvent,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 哈希）
// ---------------------------------------------------------------------------

export interface LabStudioLoadRequest {
  readonly workspaceKey: string;
}

/** 声明实验（三臂法则 + 世界 intake + 搜索预算 intake；LAB PERSISTENCE LAW）。 */
export interface DeclareExperimentInput {
  /** 剧本注册面的实验规格 id（objective/constraintsHash/intentRef 来源）。 */
  readonly specId: string;
  /** 世界预设 id（LAB DETERMINISM LAW：seed-deterministic 世界）。 */
  readonly worldPresetId: string;
  /** 搜索预算预设 id（SEARCH BUDGET LAW：显式累计预算）。 */
  readonly budgetPresetId: string;
}

/** 提交 run（阶梯开启：submitted；searched 臂追加 SearchLadderStep）。 */
export interface SubmitLabRunInput {
  readonly experimentId: OpaqueId;
  readonly arm: LabArmKind;
}

/** 启动 run（submitted -> running；事件 lab-run-recorded）。 */
export interface StartLabRunInput {
  readonly runId: OpaqueId;
}

/** 完成 run（running -> succeeded | failed 终态锁定）。 */
export interface CompleteLabRunInput {
  readonly runId: OpaqueId;
  readonly outcome: Exclude<LabRunStatus, "submitted" | "running" | "retired">;
}

/** 退役 run（submitted | running -> retired；superseded run 的优雅终态）。 */
export interface RetireLabRunInput {
  readonly runId: OpaqueId;
}

/** 发布 evidence manifest（content-addressed bundle；事件 lab-evidence-published）。 */
export interface PublishEvidenceManifestInput {
  readonly runId: OpaqueId;
  /**
   * 完整性预设（与 W8B 过期预设同款）：honest = 记录真实派生 contentHash；
   * tampered = 合法落账但记录故意错误的 contentHash 字面量——verification 以
   * hash mismatch fail closed 的诚实拒绝路径。
   */
  readonly integrity: "honest" | "tampered";
}

/** 校验 manifest（重算 contentHash；mismatch/未知 ⇒ fail closed）。 */
export interface VerifyEvidenceManifestInput {
  readonly manifestId: OpaqueId;
}

/** 决定晋升（promotion gate；事件 lab-promotion-decided）。 */
export interface DecidePromotionInput {
  readonly experimentId: OpaqueId;
  readonly candidateArm: LabArmKind;
  readonly evidenceManifestRef: OpaqueId;
}

/** 反转晋升（reversal = 新记录，绝不原地改写——LAB PROMOTION LAW）。 */
export interface ReversePromotionInput {
  readonly promotionId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** manifest 校验状态（服务端事实；verification 账本 append-only）。 */
export type LabEvidenceVerificationStatus = "unverified" | "verified" | "mismatch";

/** manifest + 校验状态的投影视图（LabEvidenceManifest frozen 形状不动）。 */
export interface LabManifestView {
  readonly manifest: import("@zcode/shared").LabEvidenceManifest;
  readonly verification: LabEvidenceVerificationStatus;
  /** 最近一次校验时刻（未校验为 null）。 */
  readonly verifiedAt: string | null;
}

/** 实验臂基准分投影（三臂比较显示的数据源；derived，never authoritative）。 */
export interface LabArmScoreView {
  readonly experimentId: OpaqueId;
  readonly arm: LabArmKind;
  /** 确定性基准分；该臂尚无 succeeded run 时为 null。 */
  readonly score: number | null;
  readonly runCount: number;
  readonly succeededCount: number;
  /** 该臂最新 succeeded run 的 id（无 → null）。 */
  readonly bestRunId: OpaqueId | null;
  /** 该臂最新已发布 manifest 的 id（无 → null）。 */
  readonly evidenceManifestId: OpaqueId | null;
  readonly simulated: boolean;
}

/** 实验声明的世界/预算上下文投影（服务端事实；frozen 实验记录不含世界字段）。 */
export interface LabExperimentContextView {
  readonly experimentId: OpaqueId;
  readonly specId: string;
  readonly world: LabWorldDescriptor;
  readonly searchBudget: number;
  /** 搜索阶梯是否已达 recorded exhaustion terminal。 */
  readonly searchExhausted: boolean;
}

/** 注册面实验规格视图（declare-experiment 挑选数据源）。 */
export interface LabExperimentSpecView {
  readonly id: string;
  readonly intentRef: string;
  readonly objective: string;
  readonly constraintsHash: string;
  readonly armScores: readonly { readonly arm: LabArmKind; readonly score: number }[];
}

/** 注册面世界预设视图（declare-experiment 挑选数据源）。 */
export interface LabWorldPresetView {
  readonly id: string;
  readonly seed: string;
  readonly actorCount: number;
  /** 形状合法（非法预设 = 诚实 typed 拒绝路径）。 */
  readonly valid: boolean;
}

/** 注册面搜索预算预设视图。 */
export interface LabBudgetPresetView {
  readonly id: string;
  readonly cumulativeBudget: number;
  readonly valid: boolean;
}

/**
 * Promotion 账本条目（append-only：promotion 与 reversal 都是新记录——LAB
 * PROMOTION LAW「reversal 是新记录，绝非 mutation」的端口级呈现。frozen
 * LabPromotionRecord 形状保持不动；kind/supersedes 链接是账本语义（W8B
 * authorization ledger 同款先例）。
 */
export interface LabPromotionEntry {
  readonly record: LabPromotionRecord;
  readonly kind: "promotion" | "reversal";
  /** reversal → 被反转的 promotion 记录 id；promotion → null。 */
  readonly supersedesRecordId: string | null;
}

export interface LabStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 lab 表面）。 */
  readonly studioId: OpaqueId;
  /** 三臂分类学（frozen v9 全集）。 */
  readonly armKinds: readonly LabArmKind[];
  /** run 阶梯分类学（frozen v9 全集）。 */
  readonly runStatuses: readonly LabRunStatus[];
  /** 实验规格注册面（声明动作的数据源）。 */
  readonly experimentSpecs: readonly LabExperimentSpecView[];
  /** 世界预设注册面。 */
  readonly worldPresets: readonly LabWorldPresetView[];
  /** 搜索预算预设注册面。 */
  readonly budgetPresets: readonly LabBudgetPresetView[];
  /** manifest 完整性预设（honest / tampered）。 */
  readonly manifestIntegrities: readonly ("honest" | "tampered")[];
  /** 实验记录（不可变；id 升序）。 */
  readonly experiments: readonly LabExperiment[];
  /** 实验上下文投影（世界/预算/搜索耗尽；服务端事实）。 */
  readonly experimentContexts: readonly LabExperimentContextView[];
  /** run 阶梯（append-only；id 升序）。 */
  readonly runs: readonly LabRun[];
  /** evidence manifests + 校验状态（id 升序）。 */
  readonly manifests: readonly LabManifestView[];
  /** promotion 账本（append-only；追加序）。 */
  readonly promotionLedger: readonly LabPromotionEntry[];
  /** 三臂基准分投影（derived，never authoritative）。 */
  readonly armScores: readonly LabArmScoreView[];
  /** 注册的确定性世界（seed-deterministic；simulated: true）。 */
  readonly worlds: readonly LabWorldDescriptor[];
  /** 搜索阶梯（append-only SearchLadderStep；耗尽为 recorded terminal）。 */
  readonly searchLadder: readonly SearchLadderStep[];
  /** append-only 事件账本投影（v9 lab-* 事件）。 */
  readonly events: readonly SolutionEvent[];
  /** 服务端投影时刻（确定性——非 UI 本地时钟）。 */
  readonly projectedAt: string;
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class LabStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "LabStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Lab Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T9 换绑 Worker A 的
 * lab 持久化服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威）。
 */
export interface LabStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实 lab。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：lab 平面已存在时返回当前快照，不重建。 */
  load(request: LabStudioLoadRequest): Promise<LabStudioSnapshot>;
  refresh(): Promise<LabStudioSnapshot>;

  // -- 实验平面（LAB PERSISTENCE LAW：记录不可变；三臂法则 intake） --
  /** 声明实验（世界 intake ⇒ YOU_LAB_WORLD_INVALID；预算 intake ⇒
   *  YOU_SEARCH_LADDER_INVALID；三臂法则 ⇒ 防御性拒绝——剧本规格恒三臂）。 */
  declareExperiment(input: DeclareExperimentInput): Promise<LabExperiment>;

  // -- run 阶梯（append-only：submitted -> running ->
  //    succeeded | failed | retired；终态锁定） --
  /** 提交 run（searched 臂追加 SearchLadderStep；预算耗尽 ⇒ 记录 terminal +
   *  YOU_SEARCH_LADDER_INVALID；事件 lab-run-recorded）。 */
  submitLabRun(input: SubmitLabRunInput): Promise<LabRun>;
  /** 启动 run（submitted -> running；事件 lab-run-recorded）。 */
  startLabRun(input: StartLabRunInput): Promise<LabRun>;
  /** 完成 run（running -> succeeded | failed；事件 lab-run-recorded）。 */
  completeLabRun(input: CompleteLabRunInput): Promise<LabRun>;
  /** 退役 run（submitted | running -> retired；事件 lab-run-recorded）。 */
  retireLabRun(input: RetireLabRunInput): Promise<LabRun>;

  // -- evidence 平面（content-addressed；verification fail closed） --
  /** 发布 manifest（succeeded run；事件 lab-evidence-published）。 */
  publishEvidenceManifest(input: PublishEvidenceManifestInput): Promise<LabManifestView>;
  /** 校验 manifest（重算 contentHash；mismatch/未知 ⇒ YOU_LAB_EVIDENCE_MANIFEST_INVALID）。 */
  verifyEvidenceManifest(input: VerifyEvidenceManifestInput): Promise<LabManifestView>;

  // -- promotion 平面（LAB PROMOTION LAW：searched-only + beats-baseline） --
  /** 决定晋升（门求值固定序；事件 lab-promotion-decided）。 */
  decidePromotion(input: DecidePromotionInput): Promise<LabPromotionEntry>;
  /** 反转晋升（reversal = 新账本记录；事件 lab-promotion-decided + reversal 标记）。 */
  reversePromotion(input: ReversePromotionInput): Promise<LabPromotionEntry>;
}

// ---------------------------------------------------------------------------
// Promotion 门纯投影（「searched-only + beats-baseline」必须可见且可测；UI 显示
// 面——服务端独立强制）
// ---------------------------------------------------------------------------

export interface LabPromotionGateView {
  readonly allowed: boolean;
  readonly reason:
    | "granted"
    | "unknown-experiment"
    | "candidate-arm-not-in-experiment"
    | "non-searched-winner"
    | "no-benchmark-evidence"
    | "unknown-evidence-manifest"
    | "evidence-unverified"
    | "no-improvement"
    | "already-decided";
}

/** 快照事实 + 候选 → 门视图（求值固定序；fail closed；投影只显示，服务端独立强制）。 */
export function projectLabPromotionGate(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
  candidateArm: LabArmKind | null,
  evidenceManifestId: string | null,
): LabPromotionGateView {
  const experiment = snapshot?.experiments.find(
    (candidate) => candidate.id === experimentId,
  );
  if (!snapshot || experimentId === null || !experiment) {
    return { allowed: false, reason: "unknown-experiment" };
  }
  if (candidateArm === null || !experiment.arms.includes(candidateArm)) {
    return { allowed: false, reason: "candidate-arm-not-in-experiment" };
  }
  if (candidateArm !== "searched") {
    return { allowed: false, reason: "non-searched-winner" };
  }
  const searched = snapshot.armScores.find(
    (entry) => entry.experimentId === experimentId && entry.arm === "searched",
  );
  const baseline = snapshot.armScores.find(
    (entry) => entry.experimentId === experimentId && entry.arm === "generalist-baseline",
  );
  if (searched?.score == null || baseline?.score == null) {
    return { allowed: false, reason: "no-benchmark-evidence" };
  }
  const manifest = snapshot.manifests.find(
    (entry) => entry.manifest.id === evidenceManifestId,
  );
  if (evidenceManifestId === null || !manifest) {
    return { allowed: false, reason: "unknown-evidence-manifest" };
  }
  if (manifest.verification !== "verified") {
    return { allowed: false, reason: "evidence-unverified" };
  }
  if (searched.score <= baseline.score) {
    return { allowed: false, reason: "no-improvement" };
  }
  // live 判定：promotionRef 指向 promotion 类账本条目且未被 reversal 顶替（指向
  // reversal 记录 = 门重新打开——reversal 是新记录而非 mutation）。
  const promotionEntry =
    experiment.promotionRef !== null
      ? snapshot.promotionLedger.find(
          (entry) => entry.record.id === experiment.promotionRef,
        )
      : undefined;
  if (
    promotionEntry !== undefined &&
    promotionEntry.kind === "promotion" &&
    !promotionIsReversed(snapshot, promotionEntry.record.id)
  ) {
    return { allowed: false, reason: "already-decided" };
  }
  return { allowed: true, reason: "granted" };
}

/** 实验的 live promotion 是否已被 reversal 顶替（账本事实；被反转 ⇒ 可再决定）。 */
export function promotionIsReversed(
  snapshot: LabStudioSnapshot,
  promotionId: string,
): boolean {
  return snapshot.promotionLedger.some(
    (entry) =>
      entry.kind === "reversal" && entry.supersedesRecordId === promotionId,
  );
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B–W8B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** 实验列表（id 升序；ledger read 语义）。 */
export function orderedLabExperiments(
  snapshot: LabStudioSnapshot | null,
): readonly LabExperiment[] {
  if (!snapshot) return [];
  return snapshot.experiments;
}

/** 按 id 解析实验（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function labExperimentById(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): LabExperiment | null {
  if (!snapshot || experimentId === null) return null;
  return snapshot.experiments.find((experiment) => experiment.id === experimentId) ?? null;
}

/** 实验的世界/预算上下文（无 → null）。 */
export function labExperimentContextOf(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): LabExperimentContextView | null {
  if (!snapshot || experimentId === null) return null;
  return (
    snapshot.experimentContexts.find((entry) => entry.experimentId === experimentId) ??
    null
  );
}

/** 某实验的 run 阶梯（追加序）。 */
export function labRunsOfExperiment(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): readonly LabRun[] {
  if (!snapshot || experimentId === null) return [];
  return snapshot.runs.filter((run) => run.experimentId === experimentId);
}

/** 按 id 解析 run（未知 id → null）。 */
export function labRunById(
  snapshot: LabStudioSnapshot | null,
  runId: string | null,
): LabRun | null {
  if (!snapshot || runId === null) return null;
  return snapshot.runs.find((run) => run.id === runId) ?? null;
}

/** 某实验的三臂基准分投影（臂序 = 三臂法则序）。 */
export function labArmScoresOfExperiment(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): readonly LabArmScoreView[] {
  if (!snapshot || experimentId === null) return [];
  const order: readonly LabArmKind[] = ["generalist-baseline", "hand-designed", "searched"];
  return order.map((arm) => {
    const entry = snapshot.armScores.find(
      (candidate) => candidate.experimentId === experimentId && candidate.arm === arm,
    );
    return (
      entry ?? {
        experimentId,
        arm,
        score: null,
        runCount: 0,
        succeededCount: 0,
        bestRunId: null,
        evidenceManifestId: null,
        simulated: true,
      }
    );
  });
}

/** 某实验的搜索阶梯（追加序）。 */
export function labSearchLadderOfExperiment(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): readonly SearchLadderStep[] {
  if (!snapshot || experimentId === null) return [];
  return snapshot.searchLadder.filter((step) => step.experimentId === experimentId);
}

/** 按 id 解析 manifest 视图（未知 id → null）。 */
export function labManifestById(
  snapshot: LabStudioSnapshot | null,
  manifestId: string | null,
): LabManifestView | null {
  if (!snapshot || manifestId === null) return null;
  return snapshot.manifests.find((entry) => entry.manifest.id === manifestId) ?? null;
}

/** 某实验的 promotion 账本（追加序）。 */
export function labPromotionLedgerOfExperiment(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): readonly LabPromotionEntry[] {
  if (!snapshot || experimentId === null) return [];
  return snapshot.promotionLedger.filter(
    (entry) => entry.record.experimentId === experimentId,
  );
}

/** 某实验的 live promotion 记录（无/被反转 → null）。 */
export function liveLabPromotionOfExperiment(
  snapshot: LabStudioSnapshot | null,
  experimentId: string | null,
): LabPromotionRecord | null {
  const experiment = labExperimentById(snapshot, experimentId);
  if (!snapshot || !experiment || experiment.promotionRef === null) return null;
  const entry = snapshot.promotionLedger.find(
    (candidate) => candidate.record.id === experiment.promotionRef,
  );
  if (!entry || entry.kind !== "promotion") return null;
  if (promotionIsReversed(snapshot, entry.record.id)) return null;
  return entry.record;
}
