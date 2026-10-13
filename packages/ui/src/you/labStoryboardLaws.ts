// YOU Lab Studio — W9B 剧本法则（无状态校验器 + 法则评估器）。
//
// 从 `labStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与 W4B-W8B 的
// laws 拆分同款先例）：本文件承载 W9A/W9C 服务语义的 UI 侧镜像——
// LabExperiment 声明 intake（三臂法则）/ LabWorldDescriptor 校验（LAB
// DETERMINISM LAW）/ 搜索预算校验（SEARCH BUDGET LAW）/ run 阶梯转移表 /
// manifest 内容哈希校验（LAB PERSISTENCE LAW）/ promotion gate 求值（LAB
// PROMOTION LAW——固定求值序，fail closed）。全部无状态、无随机（FIXTURES 法则
// 1/2；时间/预算比较由调用方传入事实——校验器自身无时钟）；契约类型一律从
// `@zcode/shared` 导入（frozen v9）。
import type { LabArmKind, LabRun, LabRunStatus } from "@zcode/shared";
import {
  LAB_STORYBOARD_ARM_KINDS,
  storyboardManifestContentHash,
} from "./labStoryboard.js";

// ---------------------------------------------------------------------------
// LabExperiment 声明 intake（LAB.md 三臂法则：每个严肃实验比较 generalist
// baseline / hand-designed / searched 三臂）
// ---------------------------------------------------------------------------

export type StoryboardExperimentIntakeViolationReason =
  | "invalid-intent-ref"
  | "invalid-objective"
  | "invalid-constraints-hash"
  | "arms-not-three-kind";

export interface StoryboardExperimentIntakeViolation {
  readonly reason: StoryboardExperimentIntakeViolationReason;
  readonly detail: string;
}

/**
 * 实验声明不变量（W9A 声明校验镜像）：
 * - intentRef / objective / constraintsHash 非空字符串；
 * - arms 恰为三臂全集（三臂法则——缺失任一臂的实验不是严肃比较）。
 */
export function validateStoryboardExperimentIntake(input: {
  readonly intentRef: string;
  readonly objective: string;
  readonly constraintsHash: string;
  readonly arms: readonly string[];
}): StoryboardExperimentIntakeViolation | null {
  if (typeof input.intentRef !== "string" || input.intentRef.trim() === "") {
    return { reason: "invalid-intent-ref", detail: "experiment intentRef must be a non-empty string" };
  }
  if (typeof input.objective !== "string" || input.objective.trim() === "") {
    return { reason: "invalid-objective", detail: "experiment objective must be a non-empty string" };
  }
  if (typeof input.constraintsHash !== "string" || input.constraintsHash.trim() === "") {
    return {
      reason: "invalid-constraints-hash",
      detail: "experiment constraintsHash must be a non-empty string",
    };
  }
  if (
    input.arms.length !== LAB_STORYBOARD_ARM_KINDS.length ||
    !LAB_STORYBOARD_ARM_KINDS.every((arm) => input.arms.includes(arm))
  ) {
    return {
      reason: "arms-not-three-kind",
      detail: `the LAB.md three-arm law requires exactly ${LAB_STORYBOARD_ARM_KINDS.join(" / ")}`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// LabWorldDescriptor 校验（LAB DETERMINISM LAW：seed-deterministic 世界；
// malformed world ⇒ YOU_LAB_WORLD_INVALID typed 拒绝，绝不猜测补全）
// ---------------------------------------------------------------------------

export type StoryboardWorldViolationReason = "empty-seed" | "invalid-actor-count";

export interface StoryboardWorldViolation {
  readonly reason: StoryboardWorldViolationReason;
  readonly detail: string;
}

/**
 * 世界描述子不变量（W9C intake 镜像）：seed 非空字符串（同 seed ⇒ 字节一致
 * 世界）；actorCount 为 [1, 64] 内整数。
 */
export function validateStoryboardWorldDescriptor(input: {
  readonly seed: string;
  readonly actorCount: number;
}): StoryboardWorldViolation | null {
  if (typeof input.seed !== "string" || input.seed.trim() === "") {
    return { reason: "empty-seed", detail: "world seed must be a non-empty string (same seed, byte-identical world)" };
  }
  if (
    !Number.isInteger(input.actorCount) ||
    input.actorCount < 1 ||
    input.actorCount > 64
  ) {
    return {
      reason: "invalid-actor-count",
      detail: `world actorCount ${input.actorCount} must be an integer in [1, 64]`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 搜索预算校验（SEARCH BUDGET LAW：显式累计预算；malformed budget ⇒
// YOU_SEARCH_LADDER_INVALID typed 拒绝）
// ---------------------------------------------------------------------------

export type StoryboardSearchBudgetViolationReason = "invalid-cumulative-budget";

export interface StoryboardSearchBudgetViolation {
  readonly reason: StoryboardSearchBudgetViolationReason;
  readonly detail: string;
}

/** 预算 intake：正整数（0 / 负数 / 非整数皆非法——预算必须显式且可用）。 */
export function validateStoryboardSearchBudget(
  cumulativeBudget: number,
): StoryboardSearchBudgetViolation | null {
  if (!Number.isInteger(cumulativeBudget) || cumulativeBudget < 1) {
    return {
      reason: "invalid-cumulative-budget",
      detail: `cumulative search budget ${cumulativeBudget} must be an integer >= 1 (explicit budget required)`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// LabRun 阶梯转移表（submitted -> running -> succeeded | failed | retired；
// 终态锁定——append-only 语义）
// ---------------------------------------------------------------------------

const LAB_RUN_TRANSITIONS: Readonly<Record<LabRunStatus, readonly LabRunStatus[]>> = {
  submitted: ["running", "retired"],
  running: ["succeeded", "failed", "retired"],
  succeeded: [],
  failed: [],
  retired: [],
};

export const LAB_RUN_TERMINAL_STATUSES: readonly LabRunStatus[] = [
  "succeeded",
  "failed",
  "retired",
];

export function isTerminalStoryboardLabRunStatus(status: LabRunStatus): boolean {
  return LAB_RUN_TERMINAL_STATUSES.includes(status);
}

/** 阶梯转移合法性（W9A 转移表镜像；非法迁移 ⇒ YOU_INVALID_STATE typed 拒绝）。 */
export function isLegalStoryboardLabRunTransition(
  from: LabRunStatus,
  to: LabRunStatus,
): boolean {
  return LAB_RUN_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Manifest 内容哈希校验（LAB PERSISTENCE LAW：content-addressed——artifact
// 内容哈希让 run 可重放可审计；mismatch fail closed）
// ---------------------------------------------------------------------------

/**
 * 重算 manifest 的内容哈希并与记录值比对（W9A verification 语义镜像：
 * runId + artifactRefs 折叠哈希；比对失败 ⇒ YOU_LAB_EVIDENCE_MANIFEST_INVALID）。
 */
export function storyboardManifestHashMatches(
  runId: string,
  artifactRefs: readonly string[],
  recordedContentHash: string,
): boolean {
  return storyboardManifestContentHash(runId, artifactRefs) === recordedContentHash;
}

// ---------------------------------------------------------------------------
// Promotion gate 求值（LAB PROMOTION LAW：searched 臂仅在记录 objective 与
// constraints 下胜过 generalist baseline 才可晋升——固定求值序，fail closed）
// ---------------------------------------------------------------------------

export type StoryboardPromotionGateReason =
  | "granted"
  | "unknown-experiment"
  | "candidate-arm-not-in-experiment"
  | "non-searched-winner"
  | "no-benchmark-evidence"
  | "unknown-evidence-manifest"
  | "evidence-unverified"
  | "no-improvement"
  | "already-decided";

export interface StoryboardPromotionGate {
  readonly allowed: boolean;
  readonly reason: StoryboardPromotionGateReason;
}

/**
 * Promotion gate 固定求值序（服务端强制面；UI 门显示与之同源——独立强制）：
 * unknown-experiment -> candidate-arm-not-in-experiment -> non-searched-winner
 * -> no-benchmark-evidence -> unknown-evidence-manifest -> evidence-unverified
 * -> no-improvement -> already-decided -> granted。
 * searched 分数必须严格大于 baseline 分数（持平不晋升——严格不等式）。
 */
export function evaluateStoryboardPromotionGate(input: {
  readonly experimentKnown: boolean;
  readonly experimentArms: readonly LabArmKind[];
  readonly livePromotionExists: boolean;
  readonly candidateArm: string;
  readonly searchedScore: number | null;
  readonly baselineScore: number | null;
  readonly evidenceManifestKnown: boolean;
  readonly evidenceVerified: boolean;
}): StoryboardPromotionGate {
  if (!input.experimentKnown) {
    return { allowed: false, reason: "unknown-experiment" };
  }
  if (!input.experimentArms.includes(input.candidateArm as LabArmKind)) {
    return { allowed: false, reason: "candidate-arm-not-in-experiment" };
  }
  if (input.candidateArm !== "searched") {
    return { allowed: false, reason: "non-searched-winner" };
  }
  if (input.searchedScore === null || input.baselineScore === null) {
    return { allowed: false, reason: "no-benchmark-evidence" };
  }
  if (!input.evidenceManifestKnown) {
    return { allowed: false, reason: "unknown-evidence-manifest" };
  }
  if (!input.evidenceVerified) {
    return { allowed: false, reason: "evidence-unverified" };
  }
  if (input.searchedScore <= input.baselineScore) {
    return { allowed: false, reason: "no-improvement" };
  }
  if (input.livePromotionExists) {
    return { allowed: false, reason: "already-decided" };
  }
  return { allowed: true, reason: "granted" };
}

/** 三臂比较法则的显示判定（投影侧纯数学；门求值独立强制）。 */
export type StoryboardArmComparisonVerdict = "pending" | "beats" | "ties" | "loses";

export function storyboardArmComparisonVerdict(
  searchedScore: number | null,
  baselineScore: number | null,
): StoryboardArmComparisonVerdict {
  if (searchedScore === null || baselineScore === null) return "pending";
  if (searchedScore > baselineScore) return "beats";
  if (searchedScore === baselineScore) return "ties";
  return "loses";
}

// ---------------------------------------------------------------------------
// 搜索阶梯法则（SEARCH BUDGET LAW：预算耗尽是 recorded terminal，绝非静默停止）
// ---------------------------------------------------------------------------

/**
 * 下一步是否仍在预算内（step 序 1-based；超出 ⇒ 调用方记录 exhaustion terminal
 * 并以 YOU_SEARCH_LADDER_INVALID typed 拒绝）。
 */
export function storyboardSearchStepWithinBudget(
  nextStep: number,
  cumulativeBudget: number,
): boolean {
  return nextStep <= cumulativeBudget;
}

/** run 是否携带内容寻址证据回链（投影显示用）。 */
export function labRunHasEvidence(run: LabRun): boolean {
  return run.evidenceManifestRef !== null;
}
