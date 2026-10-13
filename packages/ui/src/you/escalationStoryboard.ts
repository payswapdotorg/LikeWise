// YOU Escalation Studio — W8B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W8B / docs/you/CONTRACTS.md "Wave-8 contract
// freeze (v8)"）：
// - Worker A（W8A）拥有 arena 权威服务（CapabilityGap 持久化 + append-only run
//   阶梯 + ArenaRetryPolicy 校验 + EscalationAuthorization 生命周期 + provider
//   中立 Arena 客户端边界）；B **不新增 fixture 生成器**。本文件是「剧本」
//   （storyboard）：契约形状的固定字面量记录 + 声明式表 + 无状态校验器
//   （W8A 服务语义的 UI 侧镜像），供 `escalationSimulatedController.ts` 驱动
//   确定性演示；所有记录 simulated: true。
// - 无状态校验器 + 法则评估器按模块内聚拆分至 `escalationStoryboardLaws.ts`。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v8 `you/contract.ts`），禁止本地
//   重声明；`@zcode/shared` 公共面只导出 contract.js —— shared/src/you/gap.ts 的
//   v1 fixture 语义（分类→专家结果表、资格规则、最小上下文）在此做 UI 侧镜像。
// - TODO(T8): Worker A 的 arena 服务合入后，由 TL 把 UI 端口换绑到真实服务；本
//   剧本届时随模拟控制器整体退役。
//
// 确定性法则（docs/you/FIXTURES.md）：不调用 Date.now/Math.random/网络；一切输出
// 排序稳定（按 id / 追加序）。内容寻址：failure-evidence 与 artifact 标签一律
// contentRef/contentHash 风格标签，绝不内联（ARENA BOUNDARY LAW：结果以 typed
// payload 经 YOU 自身权威应用）。
import type {
  ArenaLearningPermission,
  ArenaProviderDescriptor,
  ArenaRetryPolicy,
  ArenaExpertResult,
  AttemptedStrategy,
  CapabilityGapCategory,
} from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const ESCALATION_STORYBOARD_SEED = "you-w8b-escalation-studio-001";

export const ESCALATION_STORYBOARD_DISPLAY_NAME = "Escalation Studio — Aria";

export const ESCALATION_STORYBOARD_SOLUTION_ID = "fx-escalation-studio";

// ---------------------------------------------------------------------------
// 分类学（frozen v8：7 gap category / 3 learning permission / 4 backoff class）
// ---------------------------------------------------------------------------

export const ESCALATION_STORYBOARD_CATEGORIES: readonly CapabilityGapCategory[] = [
  "TOOL_GAP",
  "EDITOR_GAP",
  "MODEL_GAP",
  "SKILL_GAP",
  "KNOWLEDGE_GAP",
  "DATA_GAP",
  "EXPERT_GAP",
];

export const ESCALATION_STORYBOARD_LEARNING_PERMISSIONS: readonly ArenaLearningPermission[] =
  ["none", "aggregate", "full"];

export const ESCALATION_STORYBOARD_BACKOFF_CLASSES: readonly string[] = [
  "constant",
  "linear",
  "exponential",
  "exponential-jitter",
];

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（failure-evidence / artifact / 变更集标签；绝不内联）
// ---------------------------------------------------------------------------

export interface StoryboardContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据键文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function storyboardContentBinding(key: string): StoryboardContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${ESCALATION_STORYBOARD_SEED}:${key}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${ESCALATION_STORYBOARD_SEED}:${key}:content`)}`,
  };
}

/** 依据键文本派生确定性 failure-evidence 引用列表（内容寻址标签；数量固定）。 */
export function storyboardFailureEvidenceRefs(key: string, count: number): string[] {
  const refs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    refs.push(
      `fx-content-${computeCaptureFixtureHash(`${ESCALATION_STORYBOARD_SEED}:evidence:${key}:${index}`)}`,
    );
  }
  return refs;
}

/** 确定性 applies-as-changeset id（应用专家结果时派生；同 escalation ⇒ 同 id）。 */
export function storyboardChangeSetId(escalationId: string): string {
  return `fx-changeset-${computeCaptureFixtureHash(`${ESCALATION_STORYBOARD_SEED}:changeset:${escalationId}`)}`;
}

// ---------------------------------------------------------------------------
// Gap 规格（注册面数据源——record-gap fixture 动作经此挑选；7 分类全覆盖 + 一条
// 不可升级规格（低置信度）——覆盖「gap 记录合法但不可升级」的诚实路径）
// ---------------------------------------------------------------------------

export interface StoryboardAttemptedStrategySpec {
  readonly strategy: string;
  readonly outcome: AttemptedStrategy["outcome"];
  readonly evidenceKey: string | null;
}

export interface StoryboardGapSpec {
  readonly id: string;
  readonly category: CapabilityGapCategory;
  readonly confidence: number;
  readonly suggestedNextAction: string;
  readonly intentRef: string | null;
  readonly requiredScope: string;
  readonly attemptedStrategies: readonly StoryboardAttemptedStrategySpec[];
  readonly failureEvidenceCount: number;
}

function gapSpec(
  id: string,
  category: CapabilityGapCategory,
  confidence: number,
  suggestedNextAction: string,
  requiredScope: string,
  strategies: readonly StoryboardAttemptedStrategySpec[],
): StoryboardGapSpec {
  return {
    id,
    category,
    confidence,
    suggestedNextAction,
    intentRef: "fx-intent-portrait-001",
    requiredScope,
    attemptedStrategies: strategies,
    failureEvidenceCount: strategies.filter((entry) => entry.evidenceKey !== null).length + 1,
  };
}

export const ESCALATION_STORYBOARD_GAP_SPECS: readonly StoryboardGapSpec[] = [
  gapSpec(
    "fx-gapspec-001",
    "TOOL_GAP",
    0.82,
    "Substitute a gltf-transform toolchain before the next reconstruction pass.",
    "solution:fx-portrait-001",
    [
      { strategy: "native-toolchain", outcome: "failed", evidenceKey: "toolchain-attempt-1" },
      { strategy: "editor-roundtrip", outcome: "partial", evidenceKey: "toolchain-attempt-2" },
    ],
  ),
  gapSpec(
    "fx-gapspec-002",
    "EDITOR_GAP",
    0.71,
    "Route the appearance pass through an external threejs-editor adapter.",
    "workspace:aria-studio",
    [
      { strategy: "native-editor", outcome: "partial", evidenceKey: "editor-attempt-1" },
      { strategy: "interchange-export", outcome: "rejected", evidenceKey: null },
    ],
  ),
  gapSpec(
    "fx-gapspec-003",
    "MODEL_GAP",
    0.64,
    "Raise the reconstruction fidelity profile for identity binding.",
    "workspace:aria-studio",
    [{ strategy: "profile-sweep", outcome: "failed", evidenceKey: "model-attempt-1" }],
  ),
  gapSpec(
    "fx-gapspec-004",
    "SKILL_GAP",
    0.77,
    "Acquire a humanoid-retargeting skill capsule for motion naturalness.",
    "task:retarget-001",
    [
      { strategy: "automated-retarget", outcome: "failed", evidenceKey: "skill-attempt-1" },
      { strategy: "manual-takeover", outcome: "partial", evidenceKey: "skill-attempt-2" },
    ],
  ),
  gapSpec(
    "fx-gapspec-005",
    "KNOWLEDGE_GAP",
    0.74,
    "Patch human-proportion rules into the composition planner.",
    "task:retarget-001",
    [{ strategy: "planner-reprompt", outcome: "failed", evidenceKey: "knowledge-attempt-1" }],
  ),
  gapSpec(
    "fx-gapspec-006",
    "DATA_GAP",
    0.58,
    "Recall an additional reference evidence set for geometry.",
    "solution:fx-portrait-001",
    [{ strategy: "evidence-recall", outcome: "partial", evidenceKey: "data-attempt-1" }],
  ),
  gapSpec(
    "fx-gapspec-007",
    "EXPERT_GAP",
    0.9,
    "Request an expert correction artifact for identity-critical geometry.",
    "workspace:aria-studio",
    [
      { strategy: "automated-correction", outcome: "failed", evidenceKey: "expert-attempt-1" },
      { strategy: "editor-roundtrip", outcome: "failed", evidenceKey: "expert-attempt-2" },
    ],
  ),
  gapSpec(
    "fx-gapspec-008",
    "TOOL_GAP",
    0.3,
    "Confidence below the escalation threshold — keep retrying locally first.",
    "solution:fx-portrait-001",
    [{ strategy: "native-toolchain", outcome: "partial", evidenceKey: "low-confidence-attempt-1" }],
  ),
];

export function storyboardGapSpecById(specId: string): StoryboardGapSpec | null {
  return ESCALATION_STORYBOARD_GAP_SPECS.find((spec) => spec.id === specId) ?? null;
}

/** 规格的尝试策略展开（contentRef 标签派生自 evidenceKey；无证据 → null）。 */
export function storyboardAttemptedStrategies(
  spec: StoryboardGapSpec,
): readonly AttemptedStrategy[] {
  return spec.attemptedStrategies.map((entry) => ({
    strategy: entry.strategy,
    outcome: entry.outcome,
    evidenceRef:
      entry.evidenceKey === null
        ? null
        : `fx-content-${computeCaptureFixtureHash(`${ESCALATION_STORYBOARD_SEED}:${entry.evidenceKey}`)}`,
  }));
}

/** 规格的 failure-evidence 引用（内容寻址标签——绝不内联内容）。 */
export function storyboardGapFailureEvidence(spec: StoryboardGapSpec): readonly string[] {
  return storyboardFailureEvidenceRefs(`gap:${spec.id}`, spec.failureEvidenceCount);
}

// ---------------------------------------------------------------------------
// 授权范围与过期预设（escalation gate 的挑选数据源；确定性 fixture 字面量）
// ---------------------------------------------------------------------------

export interface StoryboardExpiryPreset {
  readonly id: "no-expiry" | "future" | "past";
  /** null = 无过期；ISO 字面量来自注入时钟纪元（2025-06-02）± 语义窗口。 */
  readonly expiresAt: string | null;
}

/**
 * 过期预设：no-expiry / future（2031 —— demo 时钟推进内恒未过期）/ past（2024 ——
 * 落账合法但 live 门判过期，覆盖 expired 拒绝路径）。
 */
export const ESCALATION_STORYBOARD_EXPIRY_PRESETS: readonly StoryboardExpiryPreset[] = [
  { id: "no-expiry", expiresAt: null },
  { id: "future", expiresAt: "2031-01-01T00:00:00.000Z" },
  { id: "past", expiresAt: "2024-01-01T00:00:00.000Z" },
];

/** 授权范围预设（in-scope 校验：与 escalation 的 requiredScope 精确匹配）。 */
export const ESCALATION_STORYBOARD_SCOPE_PRESETS: readonly string[] = [
  "solution:fx-portrait-001",
  "workspace:aria-studio",
  "task:retarget-001",
  "workspace:wrong-scope",
];

// ---------------------------------------------------------------------------
// Arena 重试策略（W8A 校验器的剧本镜像；数据源 = 快照投影，非 UI 硬编码）
// ---------------------------------------------------------------------------

export const ESCALATION_STORYBOARD_RETRY_POLICY: ArenaRetryPolicy = {
  maxAttempts: 3,
  backoffClass: "exponential-jitter",
  eligibilityCategories: [...ESCALATION_STORYBOARD_CATEGORIES],
  requiresAuthorization: true,
};

// ---------------------------------------------------------------------------
// Provider 注册面（provider 中立；引用不透明——endpointRef null；真实运行时集成
// 是 W9+ compute-plane 工作；未知 provider ⇒ fail closed typed 拒绝）
// ---------------------------------------------------------------------------

export const ESCALATION_STORYBOARD_PROVIDERS: readonly ArenaProviderDescriptor[] = [
  {
    id: "fx-arena-provider-001",
    providerKind: "human-expert-panel",
    capabilityClasses: ["EXPERT_GAP", "TOOL_GAP", "KNOWLEDGE_GAP"],
    endpointRef: null,
  },
  {
    id: "fx-arena-provider-002",
    providerKind: "expert-marketplace",
    capabilityClasses: ["EDITOR_GAP", "MODEL_GAP", "SKILL_GAP", "DATA_GAP"],
    endpointRef: null,
  },
];

export function storyboardProviderById(providerId: string): ArenaProviderDescriptor | null {
  return ESCALATION_STORYBOARD_PROVIDERS.find((entry) => entry.id === providerId) ?? null;
}

// ---------------------------------------------------------------------------
// 确定性专家结果（ARENA BOUNDARY LAW：typed payload —— 分类派生；artifact 结果
// 的 payload 携带内容寻址 artifactRef/artifactHash 标签，绝不内联内容）
// ---------------------------------------------------------------------------

function expertPayload(key: string): Record<string, string | number | boolean> {
  return {
    remediation: key,
    qualityBoost: Number(
      `0.${computeCaptureFixtureHash(`${ESCALATION_STORYBOARD_SEED}:boost:${key}`).slice(0, 2)}`,
    ),
  };
}

function artifactPayload(key: string): Record<string, string | number | boolean> {
  const binding = storyboardContentBinding(`artifact:${key}`);
  return {
    remediation: `${key}-artifact`,
    artifactRef: binding.contentRef,
    artifactHash: binding.contentHash,
    artifactKind: "corrected-geometry",
  };
}

/** 分类 → 确定性 ArenaExpertResult（v1 shared fixture 表的 UI 侧镜像形状）。 */
export function storyboardExpertResult(
  category: CapabilityGapCategory,
): ArenaExpertResult {
  const key = category.toLowerCase();
  switch (category) {
    case "TOOL_GAP":
      return {
        deliveredAt: "",
        resultType: "typed-payload",
        payload: { ...expertPayload(key), replacementTool: "gltf-transform" },
        appliesAsChangeSetId: null,
      };
    case "EDITOR_GAP":
      return {
        deliveredAt: "",
        resultType: "typed-payload",
        payload: { ...expertPayload(key), replacementEditor: "threejs-editor" },
        appliesAsChangeSetId: null,
      };
    case "MODEL_GAP":
      return {
        deliveredAt: "",
        resultType: "guidance",
        payload: { ...expertPayload(key), suggestedProfile: "higher-fidelity-reconstruction" },
        appliesAsChangeSetId: null,
      };
    case "SKILL_GAP":
      return {
        deliveredAt: "",
        resultType: "typed-payload",
        payload: { ...expertPayload(key), skill: "humanoid-retargeting" },
        appliesAsChangeSetId: null,
      };
    case "KNOWLEDGE_GAP":
      return {
        deliveredAt: "",
        resultType: "typed-payload",
        payload: { ...expertPayload(key), knowledge: "human-proportion-rules" },
        appliesAsChangeSetId: null,
      };
    case "DATA_GAP":
      return {
        deliveredAt: "",
        resultType: "guidance",
        payload: { ...expertPayload(key), evidence: "additional-reference-set" },
        appliesAsChangeSetId: null,
      };
    case "EXPERT_GAP":
      return {
        deliveredAt: "",
        resultType: "artifact",
        payload: artifactPayload(key),
        appliesAsChangeSetId: null,
      };
  }
}

// ---------------------------------------------------------------------------
// 最小上下文胶囊（ARENA.md：升级请求携带的最小充分上下文）
// ---------------------------------------------------------------------------

export const ESCALATION_STORYBOARD_MINIMUM_CONTEXT: readonly string[] = [
  "intent-reference",
  "capability-gap-record",
  "relevant-solution-version",
  "privacy-policy",
];

// ---------------------------------------------------------------------------
// Gap → 投影域派生（ToolGap/KnowledgeGap 投影的确定性域映射；投影非权威）
// ---------------------------------------------------------------------------

/** 分类 → ToolGap 投影的工具域标签（派生 remediation 文案的确定性来源）。 */
export const STORYBOARD_TOOL_DOMAIN: Readonly<Record<CapabilityGapCategory, string>> = {
  TOOL_GAP: "toolchain",
  EDITOR_GAP: "editor-adapter",
  MODEL_GAP: "model-profile",
  SKILL_GAP: "skill-capsule",
  KNOWLEDGE_GAP: "knowledge-patch",
  DATA_GAP: "evidence-recall",
  EXPERT_GAP: "expert-panel",
};

/** 分类 → KnowledgeGap 投影的知识域标签。 */
export const STORYBOARD_KNOWLEDGE_DOMAIN: Readonly<Record<CapabilityGapCategory, string>> = {
  TOOL_GAP: "tool-operations",
  EDITOR_GAP: "editing-conventions",
  MODEL_GAP: "fidelity-profiles",
  SKILL_GAP: "retargeting-practice",
  KNOWLEDGE_GAP: "human-proportions",
  DATA_GAP: "reference-sets",
  EXPERT_GAP: "expert-corrections",
};
