// YOU Lab Studio — W9B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W9B / docs/you/CONTRACTS.md "Wave-9 contract
// freeze (v9)"）：
// - Worker A（W9A）拥有 lab 持久化权威（LabExperiment/LabRun 不可变记录 +
//   append-only run 阶梯 + content-addressed evidence manifests + promotion
//   gate）；Worker C（W9C）拥有 research 组织机器（deterministic worlds、
//   search/RL ladder、Failure Atlas、Pipeline Genome）。B **不新增 fixture
//   生成器**。本文件是「剧本」（storyboard）：契约形状的固定字面量记录 +
//   声明式表 + 无状态校验器（W9A/W9C 服务语义的 UI 侧镜像），供
//   `labSimulatedController.ts` 驱动确定性演示；所有记录 simulated: true。
// - 无状态校验器 + 法则评估器按模块内聚拆分至 `labStoryboardLaws.ts`。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v9 `you/contract.ts`），禁止本地
//   重声明。
// - TODO(T9): Worker A 的 lab 持久化服务合入后，由 TL 把 UI 端口换绑到真实服务；
//   本剧本届时随模拟控制器整体退役。
//
// 确定性法则（docs/you/FIXTURES.md）：不调用 Date.now/Math.random/网络；一切输出
// 排序稳定（按 id / 追加序）。内容寻址：artifact / ground-truth 标签一律
// contentRef/contentHash 风格标签，绝不内联（LAB PERSISTENCE LAW：manifest 是
// durability 单元，工件内容哈希让 run 可重放可审计）。
import type { LabArmKind, LabWorldDescriptor } from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const LAB_STORYBOARD_SEED = "you-w9b-lab-studio-001";

export const LAB_STORYBOARD_DISPLAY_NAME = "Lab Studio — Aria";

export const LAB_STORYBOARD_SOLUTION_ID = "fx-lab-studio";

// ---------------------------------------------------------------------------
// 分类学（frozen v9：3 arm / 5 run status —— LAB.md 三臂比较法则 + run 阶梯）
// ---------------------------------------------------------------------------

export const LAB_STORYBOARD_ARM_KINDS: readonly LabArmKind[] = [
  "generalist-baseline",
  "hand-designed",
  "searched",
];

export const LAB_STORYBOARD_RUN_STATUSES: readonly string[] = [
  "submitted",
  "running",
  "succeeded",
  "failed",
  "retired",
];

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（plan hash / artifact / ground-truth 标签；绝不内联）
// ---------------------------------------------------------------------------

export interface StoryboardContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据键文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function storyboardContentBinding(key: string): StoryboardContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${LAB_STORYBOARD_SEED}:${key}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${LAB_STORYBOARD_SEED}:${key}:content`)}`,
  };
}

/** 实验臂的确定性 plan hash（同 experiment + arm + attempt ⇒ 同 hash）。 */
export function storyboardPlanHash(
  experimentId: string,
  arm: LabArmKind,
  attempt: number,
): string {
  return `sha256-fixture-${computeCaptureFixtureHash(
    `${LAB_STORYBOARD_SEED}:plan:${experimentId}:${arm}:${attempt}`,
  )}`;
}

/**
 * Manifest 的确定性内容哈希（runId + artifactRefs 的有序折叠——W9A content-addressed
 * 语义镜像：同 run 同 artifacts ⇒ 同 contentHash；verify 按此重算并比对）。
 */
export function storyboardManifestContentHash(
  runId: string,
  artifactRefs: readonly string[],
): string {
  return `sha256-fixture-${computeCaptureFixtureHash(
    `${LAB_STORYBOARD_SEED}:manifest:${runId}:${artifactRefs.join(",")}`,
  )}`;
}

/** 剧本搜索策略轮换（searched 臂每次提交的确定性探索策略标签）。 */
const SEARCH_STRATEGIES: readonly string[] = [
  "beam-search",
  "random-restart",
  "mutation-sweep",
];

export function storyboardSearchStrategy(step: number): string {
  return SEARCH_STRATEGIES[(Math.max(1, step) - 1) % SEARCH_STRATEGIES.length]!;
}

// ---------------------------------------------------------------------------
// 实验规格（注册面数据源——declare-experiment fixture 动作经此挑选；三臂全覆盖，
// 附两条诚实拒绝路径：searched 落败与持平——LAB PROMOTION LAW 的可测面）
// ---------------------------------------------------------------------------

export interface StoryboardArmScore {
  readonly arm: LabArmKind;
  /** 确定性 fixture 基准分（[0,1]；模拟测量，非科学结论——truth law）。 */
  readonly score: number;
}

export interface StoryboardExperimentSpec {
  readonly id: string;
  readonly intentRef: string;
  readonly objective: string;
  readonly constraintsHash: string;
  readonly arms: readonly LabArmKind[];
  readonly armScores: readonly StoryboardArmScore[];
}

function experimentSpec(
  id: string,
  intentRef: string,
  objective: string,
  baseline: number,
  handDesigned: number,
  searched: number,
): StoryboardExperimentSpec {
  return {
    id,
    intentRef,
    objective,
    constraintsHash: `sha256-fixture-${computeCaptureFixtureHash(
      `${LAB_STORYBOARD_SEED}:constraints:${id}`,
    )}`,
    arms: [...LAB_STORYBOARD_ARM_KINDS],
    armScores: [
      { arm: "generalist-baseline", score: baseline },
      { arm: "hand-designed", score: handDesigned },
      { arm: "searched", score: searched },
    ],
  };
}

/**
 * 三条规格：spec-001 searched 胜出（晋升路径）；spec-002 searched 落败（诚实
 * 拒绝——did-not-beat-baseline）；spec-003 searched 持平（严格不等式拒绝——ties
 * never promote）。
 */
export const LAB_STORYBOARD_EXPERIMENT_SPECS: readonly StoryboardExperimentSpec[] = [
  experimentSpec(
    "fx-labspec-001",
    "fx-intent-portrait-001",
    "Maximize the human-realism benchmark score under the recorded cost and latency constraints.",
    0.62,
    0.71,
    0.78,
  ),
  experimentSpec(
    "fx-labspec-002",
    "fx-intent-motion-001",
    "Maximize motion-naturalness under the recorded latency budget.",
    0.8,
    0.75,
    0.74,
  ),
  experimentSpec(
    "fx-labspec-003",
    "fx-intent-identity-001",
    "Maximize identity-binding fidelity under the recorded privacy constraints.",
    0.66,
    0.72,
    0.66,
  ),
];

export function storyboardExperimentSpecById(
  specId: string,
): StoryboardExperimentSpec | null {
  return LAB_STORYBOARD_EXPERIMENT_SPECS.find((spec) => spec.id === specId) ?? null;
}

/** 规格 → 实验臂分数表（LabArmKind → 确定性分数；缺省 0）。 */
export function storyboardArmScoresOfSpec(
  spec: StoryboardExperimentSpec,
): Readonly<Record<LabArmKind, number>> {
  const table: Record<LabArmKind, number> = {
    "generalist-baseline": 0,
    "hand-designed": 0,
    searched: 0,
  };
  for (const entry of spec.armScores) {
    table[entry.arm] = entry.score;
  }
  return table;
}

// ---------------------------------------------------------------------------
// 世界预设（declare-experiment 的挑选数据源；LAB DETERMINISM LAW：同 seed ⇒
// 字节一致世界；两条非法预设诚实覆盖 YOU_LAB_WORLD_INVALID 拒绝路径——与 W8B
// 「过去时刻过期预设」同款：可挑选、可落账意图、typed 拒绝）
// ---------------------------------------------------------------------------

export interface StoryboardWorldPreset {
  readonly id: string;
  readonly seed: string;
  readonly actorCount: number;
  /** 形状是否合法（非法预设 = 诚实 typed 拒绝路径，绝不静默修复）。 */
  readonly valid: boolean;
}

export const LAB_STORYBOARD_WORLD_PRESETS: readonly StoryboardWorldPreset[] = [
  { id: "world-alpha", seed: "you-w9b-world-alpha", actorCount: 4, valid: true },
  { id: "world-beta", seed: "you-w9b-world-beta", actorCount: 12, valid: true },
  { id: "world-empty-seed", seed: "", actorCount: 4, valid: false },
  { id: "world-overcrowded", seed: "you-w9b-world-overcrowded", actorCount: 512, valid: false },
];

export function storyboardWorldPresetById(id: string): StoryboardWorldPreset | null {
  return LAB_STORYBOARD_WORLD_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** 预设 → 确定性 LabWorldDescriptor（ground truth 内容寻址标签，绝不内联）。 */
export function storyboardWorldOfPreset(preset: StoryboardWorldPreset): LabWorldDescriptor {
  const binding = storyboardContentBinding(`ground-truth:${preset.seed}`);
  return {
    id: `fx-world-${computeCaptureFixtureHash(`${LAB_STORYBOARD_SEED}:${preset.seed}`)}`,
    seed: preset.seed,
    actorCount: preset.actorCount,
    groundTruthRef: binding.contentRef,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// 搜索预算预设（SEARCH BUDGET LAW：显式累计预算；budget-zero 为诚实拒绝路径——
// YOU_SEARCH_LADDER_INVALID 的 declaration intake 面）
// ---------------------------------------------------------------------------

export interface StoryboardBudgetPreset {
  readonly id: string;
  readonly cumulativeBudget: number;
  readonly valid: boolean;
}

export const LAB_STORYBOARD_BUDGET_PRESETS: readonly StoryboardBudgetPreset[] = [
  { id: "budget-standard", cumulativeBudget: 6, valid: true },
  { id: "budget-tight", cumulativeBudget: 1, valid: true },
  { id: "budget-zero", cumulativeBudget: 0, valid: false },
];

export function storyboardBudgetPresetById(id: string): StoryboardBudgetPreset | null {
  return LAB_STORYBOARD_BUDGET_PRESETS.find((preset) => preset.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Manifest 完整性预设（「诚实发布」vs「故意污染」——与 W8B 过期预设同款：污染
// manifest 是合法落账记录，但其 verification 以 hash mismatch fail closed——
// YOU_LAB_EVIDENCE_MANIFEST_INVALID 的诚实覆盖路径）
// ---------------------------------------------------------------------------

export type StoryboardManifestIntegrity = "honest" | "tampered";

export const LAB_STORYBOARD_MANIFEST_INTEGRITIES: readonly StoryboardManifestIntegrity[] = [
  "honest",
  "tampered",
];

/** run 的确定性 artifact 引用（内容寻址标签——数量固定 per run）。 */
export function storyboardArtifactRefs(runId: string, count: number): string[] {
  const refs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    refs.push(
      `fx-content-${computeCaptureFixtureHash(`${LAB_STORYBOARD_SEED}:artifact:${runId}:${index}`)}`,
    );
  }
  return refs;
}
