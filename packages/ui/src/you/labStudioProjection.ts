// YOU Lab Studio — 视图纯投影（W9B）。
//
// 只做确定性视图数学：run 状态阶梯（submitted → running → succeeded | failed |
// retired——current 来自服务端投影记录，visited 由该 run 的 lab-run-recorded 事件流
// 派生——绝非 UI 本地状态）、实验声明行（intent/objective/constraints/arms +
// 世界/预算上下文——内容寻址标签，绝不内联）、三臂比较视图（LAB.md 三臂法则的
// 显示面：baseline/hand-designed/searched 分数 + 判定）、run 行、manifest 行
//（内容寻址 artifact 标签 + 校验状态）、promotion 账本行（promotion/reversal 不可
// 变记录 + supersedes 链接）、搜索阶梯行（预算用量与耗尽终态——SEARCH BUDGET
// LAW 的可见面）、声明草稿与晋升草稿视图模型、区域 loading/empty 视图模型、键盘
// 转移（与兄弟表面同级的键盘可用性）。无 DOM、无随机、无计时器（FIXTURES 法则
// 1/2）。
import type { LabArmKind, LabRun, LabRunStatus, SolutionEvent } from "@zcode/shared";
import type {
  LabArmScoreView,
  LabExperimentContextView,
  LabManifestView,
  LabPromotionEntry,
  LabPromotionGateView,
} from "./labController.js";

// ---------------------------------------------------------------------------
// Run 状态阶梯（v9 LabRunStatus；visited 派生自事件流——非 UI 本地状态）
// ---------------------------------------------------------------------------

export interface LabRunLadderStep {
  readonly status: LabRunStatus;
  readonly reached: boolean;
  readonly current: boolean;
  /** 终态档（succeeded / failed / retired 互斥替代；到达即锁定）。 */
  readonly terminal: boolean;
  /** 标记该档位的事件时刻（事件携带时）；未到达为 null。 */
  readonly at: string | null;
}

const LAB_RUN_LADDER_ORDER: readonly LabRunStatus[] = [
  "submitted",
  "running",
  "succeeded",
  "failed",
  "retired",
];

const LAB_RUN_LADDER_TERMINALS: readonly LabRunStatus[] = [
  "succeeded",
  "failed",
  "retired",
];

/**
 * 状态阶梯投影：current 标记投影记录（服务端事实）；visited 由该 run 的事件流
 * 派生（lab-run-recorded 的 statusAfter 标记档位，时刻以事件 occurredAt 为准）。
 * 三终态互斥：仅记录实际到达的那个终态。
 */
export function projectLabRunLadder(
  run: {
    readonly status: LabRunStatus;
  },
  events: readonly SolutionEvent[],
  runId: string,
): readonly LabRunLadderStep[] {
  const visited = new Map<LabRunStatus, string>();
  for (const event of events) {
    if (event.type !== "lab-run-recorded") continue;
    if (event.payload.runId !== runId) continue;
    const statusAfter = event.payload.statusAfter;
    if (typeof statusAfter === "string") {
      const rung = LAB_RUN_LADDER_ORDER.find((candidate) => candidate === statusAfter);
      if (rung && !visited.has(rung)) {
        visited.set(rung, event.occurredAt);
      }
    }
  }
  // 当前档兜底（事件缺失时以投影头标记——防御，不猜时间；当前档恒已过）。
  if (!visited.has(run.status)) {
    visited.set(run.status, "");
  }
  return LAB_RUN_LADDER_ORDER.map((status) => ({
    status,
    reached: visited.has(status),
    current: status === run.status,
    terminal: LAB_RUN_LADDER_TERMINALS.includes(status),
    at: visited.get(status) ?? null,
  }));
}

/** 已到达的档数（visited 计数——阶梯进度的确定性度量）。 */
export function labLadderVisitedCount(steps: readonly LabRunLadderStep[]): number {
  return steps.filter((step) => step.reached).length;
}

// ---------------------------------------------------------------------------
// 实验显示行（声明 + 三臂法则 + 世界/预算上下文投影）
// ---------------------------------------------------------------------------

export interface ExperimentRow {
  readonly experimentId: string;
  readonly intentRef: string;
  readonly objective: string;
  readonly constraintsHash: string;
  readonly armCount: number;
  readonly promotionRef: string | null;
  readonly worldSeed: string;
  readonly worldActorCount: number;
  readonly searchBudget: number;
  readonly searchExhausted: boolean;
  readonly runCount: number;
  readonly accessibleLabel: string;
}

/** 实验 + 上下文投影 → 显示行（id 升序输入）。 */
export function projectExperimentRows(
  experiments: readonly {
    readonly id: string;
    readonly intentRef: string;
    readonly objective: string;
    readonly constraintsHash: string;
    readonly arms: readonly LabArmKind[];
    readonly promotionRef: string | null;
  }[],
  contexts: readonly LabExperimentContextView[],
  runs: readonly LabRun[],
): readonly ExperimentRow[] {
  return experiments.map((experiment) => {
    const context = contexts.find((entry) => entry.experimentId === experiment.id);
    const experimentRuns = runs.filter((run) => run.experimentId === experiment.id);
    return {
      experimentId: experiment.id,
      intentRef: experiment.intentRef,
      objective: experiment.objective,
      constraintsHash: experiment.constraintsHash,
      armCount: experiment.arms.length,
      promotionRef: experiment.promotionRef,
      worldSeed: context?.world.seed ?? "",
      worldActorCount: context?.world.actorCount ?? 0,
      searchBudget: context?.searchBudget ?? 0,
      searchExhausted: context?.searchExhausted ?? false,
      runCount: experimentRuns.length,
      accessibleLabel: `experiment ${experiment.id}: ${experiment.arms.join(" / ")}, objective "${experiment.objective}", constraints ${experiment.constraintsHash}${context ? `, world seed ${context.world.seed} (${context.world.actorCount} actors), search budget ${context.searchBudget}` : ""}, ${experimentRuns.length} runs${experiment.promotionRef !== null ? `, promotion ${experiment.promotionRef}` : ""}`,
    };
  });
}

// ---------------------------------------------------------------------------
// 三臂比较视图（LAB.md 三臂法则的显示面；投影派生，非权威）
// ---------------------------------------------------------------------------

export interface ThreeArmComparisonArmRow {
  readonly arm: LabArmKind;
  readonly score: number | null;
  readonly runCount: number;
  readonly succeededCount: number;
  readonly bestRunId: string | null;
  readonly evidenceManifestId: string | null;
  readonly accessibleLabel: string;
}

export interface ThreeArmComparisonView {
  readonly experimentId: string;
  readonly arms: readonly ThreeArmComparisonArmRow[];
  /** searched vs baseline 判定（pending / beats / ties / loses）。 */
  readonly verdict: "pending" | "beats" | "ties" | "loses";
  readonly baselineScore: number | null;
  readonly searchedScore: number | null;
  readonly accessibleLabel: string;
}

const ARM_ORDER: readonly LabArmKind[] = [
  "generalist-baseline",
  "hand-designed",
  "searched",
];

/** 三臂基准分投影 → 比较视图（臂序 = 三臂法则序；判定 = 严格不等式）。 */
export function projectThreeArmComparison(
  armScores: readonly LabArmScoreView[],
): ThreeArmComparisonView {
  const experimentId = armScores[0]?.experimentId ?? "";
  const arms: ThreeArmComparisonArmRow[] = ARM_ORDER.map((arm) => {
    const entry = armScores.find((candidate) => candidate.arm === arm);
    return {
      arm,
      score: entry?.score ?? null,
      runCount: entry?.runCount ?? 0,
      succeededCount: entry?.succeededCount ?? 0,
      bestRunId: entry?.bestRunId ?? null,
      evidenceManifestId: entry?.evidenceManifestId ?? null,
      accessibleLabel: `${arm}: ${entry?.score ?? "no benchmark score yet"} (${entry?.succeededCount ?? 0}/${entry?.runCount ?? 0} runs succeeded)${entry?.bestRunId != null ? `, best run ${entry.bestRunId}` : ""}${entry?.evidenceManifestId != null ? `, evidence ${entry.evidenceManifestId}` : ""}`,
    };
  });
  const baselineScore = armScores.find(
    (entry) => entry.arm === "generalist-baseline",
  )?.score ?? null;
  const searchedScore =
    armScores.find((entry) => entry.arm === "searched")?.score ?? null;
  let verdict: ThreeArmComparisonView["verdict"] = "pending";
  if (searchedScore !== null && baselineScore !== null) {
    if (searchedScore > baselineScore) verdict = "beats";
    else if (searchedScore === baselineScore) verdict = "ties";
    else verdict = "loses";
  }
  const handDesignedScore =
    armScores.find((entry) => entry.arm === "hand-designed")?.score ?? null;
  return {
    experimentId,
    arms,
    verdict,
    baselineScore,
    searchedScore,
    accessibleLabel: `three-arm comparison for ${experimentId}: baseline ${baselineScore ?? "pending"}, hand-designed ${handDesignedScore ?? "pending"}, searched ${searchedScore ?? "pending"} — searched ${verdict} the baseline`,
  };
}

// ---------------------------------------------------------------------------
// Run 显示行（append-only 阶梯；plan hash 内容寻址标签）
// ---------------------------------------------------------------------------

export interface LabRunRow {
  readonly runId: string;
  readonly experimentId: string;
  readonly arm: LabArmKind;
  readonly planHash: string;
  readonly status: LabRunStatus;
  readonly submittedAt: string;
  readonly completedAt: string | null;
  readonly evidenceManifestRef: string | null;
  readonly accessibleLabel: string;
}

export function projectLabRunRows(runs: readonly LabRun[]): readonly LabRunRow[] {
  return runs.map((run) => ({
    runId: run.id,
    experimentId: run.experimentId,
    arm: run.arm,
    planHash: run.planHash,
    status: run.status,
    submittedAt: run.submittedAt,
    completedAt: run.completedAt,
    evidenceManifestRef: run.evidenceManifestRef,
    accessibleLabel: `run ${run.id}: ${run.arm} arm of ${run.experimentId}, ${run.status}${run.completedAt !== null ? ` at ${run.completedAt}` : ""}, plan ${run.planHash}${run.evidenceManifestRef !== null ? `, evidence ${run.evidenceManifestRef}` : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// Manifest 显示行（内容寻址 artifact 标签 + 校验状态）
// ---------------------------------------------------------------------------

export interface ManifestArtifactRow {
  readonly index: number;
  readonly artifactRef: string;
  readonly accessibleLabel: string;
}

export interface ManifestRow {
  readonly manifestId: string;
  readonly runId: string;
  readonly contentHash: string;
  readonly artifactRows: readonly ManifestArtifactRow[];
  readonly publishedAt: string;
  readonly verification: LabManifestView["verification"];
  readonly verifiedAt: string | null;
  readonly accessibleLabel: string;
}

/** manifest 视图 → 显示行（artifact 标签升序稳定——追加序）。 */
export function projectManifestRows(
  manifests: readonly LabManifestView[],
): readonly ManifestRow[] {
  return manifests.map((entry) => ({
    manifestId: entry.manifest.id,
    runId: entry.manifest.runId,
    contentHash: entry.manifest.contentHash,
    artifactRows: entry.manifest.artifactRefs.map((artifactRef, index) => ({
      index,
      artifactRef,
      accessibleLabel: `artifact ${index + 1}: ${artifactRef} (content-addressed label)`,
    })),
    publishedAt: entry.manifest.publishedAt,
    verification: entry.verification,
    verifiedAt: entry.verifiedAt,
    accessibleLabel: `manifest ${entry.manifest.id} for run ${entry.manifest.runId}: content hash ${entry.manifest.contentHash}, ${entry.manifest.artifactRefs.length} content-addressed artifact refs, ${entry.verification}${entry.verifiedAt !== null ? ` at ${entry.verifiedAt}` : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// Promotion 账本显示行（promotion / reversal 不可变记录 + supersedes 链接）
// ---------------------------------------------------------------------------

export interface PromotionRow {
  readonly promotionId: string;
  readonly experimentId: string;
  readonly kind: "promotion" | "reversal";
  readonly winnerArm: LabArmKind;
  readonly objectiveScore: number;
  readonly baselineScore: number;
  readonly evidenceManifestRef: string;
  readonly decidedAt: string;
  readonly supersedesRecordId: string | null;
  readonly accessibleLabel: string;
}

export function projectPromotionRows(
  ledger: readonly LabPromotionEntry[],
): readonly PromotionRow[] {
  return ledger.map((entry) => ({
    promotionId: entry.record.id,
    experimentId: entry.record.experimentId,
    kind: entry.kind,
    winnerArm: entry.record.winnerArm,
    objectiveScore: entry.record.objectiveScore,
    baselineScore: entry.record.baselineScore,
    evidenceManifestRef: entry.record.evidenceManifestRef,
    decidedAt: entry.record.decidedAt,
    supersedesRecordId: entry.supersedesRecordId,
    accessibleLabel: `${entry.kind} ${entry.record.id} on ${entry.record.experimentId}: winner ${entry.record.winnerArm}, objective ${entry.record.objectiveScore} vs baseline ${entry.record.baselineScore}, evidence ${entry.record.evidenceManifestRef}, decided ${entry.record.decidedAt}${entry.supersedesRecordId !== null ? `, supersedes ${entry.supersedesRecordId}` : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// 搜索阶梯显示行（SEARCH BUDGET LAW 的可见面：预算用量 + 耗尽终态）
// ---------------------------------------------------------------------------

export interface SearchLadderRow {
  readonly stepId: string;
  readonly step: number;
  readonly strategy: string;
  readonly exploredNodes: number;
  readonly bestScore: number;
  readonly cumulativeBudget: number;
  readonly exhaustedTerminal: boolean;
  readonly accessibleLabel: string;
}

export function projectSearchLadderRows(
  steps: readonly {
    readonly id: string;
    readonly step: number;
    readonly strategy: string;
    readonly exploredNodes: number;
    readonly bestScore: number;
    readonly cumulativeBudget: number;
  }[],
): readonly SearchLadderRow[] {
  return steps.map((entry) => ({
    stepId: entry.id,
    step: entry.step,
    strategy: entry.strategy,
    exploredNodes: entry.exploredNodes,
    bestScore: entry.bestScore,
    cumulativeBudget: entry.cumulativeBudget,
    exhaustedTerminal: entry.strategy === "budget-exhausted",
    accessibleLabel: `search step ${entry.step}/${entry.cumulativeBudget}: ${entry.strategy}, explored ${entry.exploredNodes} nodes, best score ${entry.bestScore}${entry.strategy === "budget-exhausted" ? " (recorded exhaustion terminal — never a silent stop)" : ""}`,
  }));
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type LabRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectLabListRegionView(
  hasSnapshot: boolean,
  count: number,
): LabRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与 Solution/Capture/Twin/Performance/Editing/Learning/Avatar/
// Escalation 表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type LabListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * 实验列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前实验（检视详情）；
 * - 其余键 no-op。
 */
export function resolveLabKeyboardTransition(
  key: string,
  state: { readonly totalExperiments: number },
): LabListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalExperiments };
    case "End":
      return { kind: "move", delta: state.totalExperiments };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** 实验光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampLabIndex(index: number, totalExperiments: number): number {
  if (totalExperiments <= 0) return 0;
  return Math.min(totalExperiments - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 声明草稿视图（spec + 世界预设 + 预算预设挑选的纯视图模型）
// ---------------------------------------------------------------------------

export interface ExperimentDraftView {
  readonly specId: string | null;
  readonly worldPresetId: string;
  readonly budgetPresetId: string;
  /** 声明按钮禁用原因（null = 可声明）。 */
  readonly disabledReason: "no-spec" | "invalid-world" | "invalid-budget" | null;
  readonly worldValid: boolean;
  readonly budgetValid: boolean;
}

/** 草稿 + 注册面 → 确认区视图模型（禁用原因确定性固定序）。 */
export function projectExperimentDraftView(
  draft: {
    readonly specId: string | null;
    readonly worldPresetId: string;
    readonly budgetPresetId: string;
  },
  registry: {
    readonly worldPresets: readonly { readonly id: string; readonly valid: boolean }[];
    readonly budgetPresets: readonly { readonly id: string; readonly valid: boolean }[];
  },
): ExperimentDraftView {
  const worldPreset = registry.worldPresets.find(
    (preset) => preset.id === draft.worldPresetId,
  );
  const budgetPreset = registry.budgetPresets.find(
    (preset) => preset.id === draft.budgetPresetId,
  );
  const worldValid = worldPreset?.valid ?? false;
  const budgetValid = budgetPreset?.valid ?? false;
  let disabledReason: ExperimentDraftView["disabledReason"] = null;
  if (draft.specId === null) {
    disabledReason = "no-spec";
  } else if (!worldValid) {
    disabledReason = "invalid-world";
  } else if (!budgetValid) {
    disabledReason = "invalid-budget";
  }
  return { ...draft, disabledReason, worldValid, budgetValid };
}

// ---------------------------------------------------------------------------
// Run 提交草稿视图（臂挑选的纯视图模型）
// ---------------------------------------------------------------------------

export interface RunDraftView {
  readonly arm: LabArmKind;
  /** run 提交按钮禁用原因（null = 可提交）。 */
  readonly disabledReason: "no-experiment" | "arm-not-in-experiment" | null;
}

export function projectRunDraftView(
  arm: LabArmKind,
  experiment: { readonly arms: readonly LabArmKind[] } | null,
): RunDraftView {
  let disabledReason: RunDraftView["disabledReason"] = null;
  if (experiment === null) {
    disabledReason = "no-experiment";
  } else if (!experiment.arms.includes(arm)) {
    disabledReason = "arm-not-in-experiment";
  }
  return { arm, disabledReason };
}

// ---------------------------------------------------------------------------
// 晋升草稿视图（候选臂 + 证据 manifest 挑选 + 门显示的纯视图模型）
// ---------------------------------------------------------------------------

export interface PromotionDraftView {
  readonly candidateArm: LabArmKind | null;
  readonly evidenceManifestId: string | null;
  /** 门显示（projectLabPromotionGate 的投影面——服务端独立强制）。 */
  readonly gate: LabPromotionGateView;
}

export function projectPromotionDraftView(
  candidateArm: LabArmKind | null,
  evidenceManifestId: string | null,
  gate: LabPromotionGateView,
): PromotionDraftView {
  return { candidateArm, evidenceManifestId, gate };
}
