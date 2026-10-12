// YOU Learning Studio — W6B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W6B / docs/you/CONTRACTS.md wave-6 freeze）：
// - Worker A（W6A）拥有 learning 的 fixture 生成器与运行时权威；B **不新增 fixture
//   生成器**。本文件是「剧本」（storyboard）：契约形状的固定字面量记录 + 声明式表 +
//   无状态校验器（W6A shared 层语义的 UI 侧镜像），供
//   `learningSimulatedController.ts` 驱动确定性演示；所有记录 simulated: true。
// - 无状态校验器 + RIGHTS LAW 评估器按模块内聚拆分至 `learningStoryboardLaws.ts`。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v6 `you/contract.ts`），禁止本地重声明。
// - TODO(T6): Worker A 的 learning 服务合入后，由 TL 把 UI 端口换绑到真实服务；本剧本
//   届时随模拟控制器整体退役。
//
// 确定性法则（FIXTURES.md）：不调用 Date.now/Math.random/网络；一切输出排序稳定
// （按 id / 追加序）。内容寻址：learning evidence 与 validated content 一律
// evidenceRefs / contentRef+contentHash，绝不内联（RIGHTS LAW：记录只在其
// LearningRights 同意授予范围内可用；无 rights 的记录惰性）。
import type {
  ConsentPolicy,
  ConsentState,
  LearningRightUsage,
  LearningScope,
  LearningSignalKind,
} from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const LEARNING_STORYBOARD_SEED = "you-w6b-learning-studio-001";

export const LEARNING_STORYBOARD_DISPLAY_NAME = "Learning Studio — Aria";

export const LEARNING_STORYBOARD_SOLUTION_ID = "fx-learning-studio";

// ---------------------------------------------------------------------------
// 同意政策（RIGHTS LAW：learning 的使用授权走 wave-2 consent authority 形状——
// 同一 ConsentPolicy/ConsentReference 投影，purpose "learning"；绝不另立第二条
// 同意路径；「无许可 ⇒ 不处理」在学习车道同样真实可见）
// ---------------------------------------------------------------------------

/** learning 用途（frozen ConsentPurpose 开放联合成员；W6A 场景同款）。 */
export const LEARNING_STORYBOARD_LEARNING_PURPOSE = "learning" as const;

export const LEARNING_STORYBOARD_CONSENT_POLICY: ConsentPolicy = {
  id: "fx-learning-consent-001",
  purposes: [LEARNING_STORYBOARD_LEARNING_PURPOSE],
  scope: "USER",
  operationalUse: false,
  learningReuse: true,
  retention: {
    policy: "delete-after-review",
    deleteAfter: null,
    reason:
      "Fixture learning flows (teach-me/learn-this signals, validation ladder, replay) are gated on the learning purpose; validated content keeps content-addressed bindings only.",
  },
  revocable: true,
};

/** 同意用途的门投影所需的 live 授权事实（W6A LearningGrantFacts 同款形状）。 */
export interface StoryboardGrantFacts {
  readonly policyId: string;
  readonly state: ConsentState;
  readonly scope: string;
  readonly purposes: readonly string[];
  readonly learningReuse: boolean;
  readonly operationalUse: boolean;
}

/**
 * 确定性授权哈希（fixture；W6A learningGrantHash 为真实 sha256——UI 侧为浏览器环境，
 * 使用 FNV-1a fixture 哈希并全程标注 simulated。键序稳定（sorted keys 语义）。
 */
export function storyboardGrantHash(facts: StoryboardGrantFacts): string {
  const stable = [
    `learningReuse=${facts.learningReuse}`,
    `operationalUse=${facts.operationalUse}`,
    `policyId=${facts.policyId}`,
    `purposes=${[...facts.purposes].sort().join(",")}`,
    `scope=${facts.scope}`,
    `state=${facts.state}`,
  ].join("|");
  return `sha256-fixture-${computeCaptureFixtureHash(`${LEARNING_STORYBOARD_SEED}:grant:${stable}`)}`;
}

// ---------------------------------------------------------------------------
// 分类学（frozen v6：8 scope / 6 kind / 6 usage class / 4 status）
// ---------------------------------------------------------------------------

export const LEARNING_STORYBOARD_SCOPES: readonly LearningScope[] = [
  "GLOBAL",
  "TENANT",
  "APPLICATION",
  "PROJECT",
  "USER",
  "TWIN",
  "ASSET",
  "TASK",
];

export const LEARNING_STORYBOARD_SIGNAL_KINDS: readonly LearningSignalKind[] = [
  "feedback",
  "manual-takeover",
  "edit-session",
  "expert-intervention",
  "repeated-intent",
  "capability-gap",
];

export const LEARNING_STORYBOARD_RIGHT_USAGES: readonly LearningRightUsage[] = [
  "organization-improvement",
  "tool-selection",
  "editor-selection",
  "pipeline-improvement",
  "capability-gap-analysis",
  "personalization",
];

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（evidenceRefs / contentRef + contentHash；绝不内联）
// ---------------------------------------------------------------------------

export interface StoryboardContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据 scope 文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function storyboardContentBinding(scope: string): StoryboardContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${LEARNING_STORYBOARD_SEED}:${scope}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${LEARNING_STORYBOARD_SEED}:${scope}:content`)}`,
  };
}

/** 依据 scope 文本派生确定性 evidence 引用列表（内容寻址标签；数量固定）。 */
export function storyboardEvidenceRefs(scope: string, count: number): string[] {
  const refs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    refs.push(
      `fx-content-${computeCaptureFixtureHash(`${LEARNING_STORYBOARD_SEED}:evidence:${scope}:${index}`)}`,
    );
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Kind 注册面（teach-me/learn-this 的 kind picker 数据源——注册面数据，非运行时权威）
// ---------------------------------------------------------------------------

export interface LearningKindView {
  readonly kind: LearningSignalKind;
  readonly displayName: string;
  readonly hint: string;
}

export const LEARNING_STORYBOARD_KIND_REGISTRY: readonly LearningKindView[] = [
  {
    kind: "feedback",
    displayName: "Feedback",
    hint: "Explicit user feedback on an outcome (fixture profile; simulated).",
  },
  {
    kind: "manual-takeover",
    displayName: "Manual takeover",
    hint: "The user took the wheel instead of the agent (fixture profile; simulated).",
  },
  {
    kind: "edit-session",
    displayName: "Edit session",
    hint: "A whole editing session as learning evidence (fixture profile; simulated).",
  },
  {
    kind: "expert-intervention",
    displayName: "Expert intervention",
    hint: "A human expert corrected the agent (fixture profile; simulated).",
  },
  {
    kind: "repeated-intent",
    displayName: "Repeated intent",
    hint: "The same intent recurred across sessions (fixture profile; simulated).",
  },
  {
    kind: "capability-gap",
    displayName: "Capability gap",
    hint: "The agent lacked a capability the work needed (fixture profile; simulated).",
  },
];

export function storyboardKindView(kind: string): LearningKindView | null {
  return (
    LEARNING_STORYBOARD_KIND_REGISTRY.find((entry) => entry.kind === kind) ?? null
  );
}

// ---------------------------------------------------------------------------
// Evidence 注册面（teach-me 确认流的证据来源——内容寻址记录，来源平面保有真相）
// ---------------------------------------------------------------------------

export interface LearningEvidenceView {
  readonly id: string;
  readonly displayName: string;
  readonly contentRef: string;
  readonly contentHash: string;
  /** 来源平面标识（「学习平面不拥有 evidence 真相」的可见标注）。 */
  readonly originPlane: string;
  readonly simulated: boolean;
}

function storyboardEvidence(
  id: string,
  displayName: string,
  originPlane: string,
  scope: string,
): LearningEvidenceView {
  return {
    id,
    displayName,
    originPlane,
    ...storyboardContentBinding(scope),
    simulated: true,
  };
}

/** 固定 evidence 注册表（追加序稳定；内容寻址；来自 capture/editing 平面）。 */
export const LEARNING_STORYBOARD_EVIDENCE: readonly LearningEvidenceView[] = [
  storyboardEvidence(
    "fx-learnevidence-001",
    "Feedback note — studio portrait direction",
    "capture/evidence",
    "evidence:feedback-note",
  ),
  storyboardEvidence(
    "fx-learnevidence-002",
    "Edit session package — native corrections",
    "editing/interchange",
    "evidence:edit-session-package",
  ),
  storyboardEvidence(
    "fx-learnevidence-003",
    "Takeover transcript — geometry revert",
    "editing/takeover",
    "evidence:takeover-transcript",
  ),
];

export function storyboardEvidenceById(evidenceId: string): LearningEvidenceView | null {
  return (
    LEARNING_STORYBOARD_EVIDENCE.find((entry) => entry.id === evidenceId) ?? null
  );
}

// ---------------------------------------------------------------------------
// 场景信号规格（六种 kind 全覆盖——W6A SCENARIO_SIGNAL_SPECS 同款形状）
// ---------------------------------------------------------------------------

export interface StoryboardSignalSpec {
  readonly kind: LearningSignalKind;
  readonly scope: LearningScope;
  readonly evidenceCount: number;
}

/** 每种 frozen kind 一条规格（demo 与测试共享的确定性剧本）。 */
export const LEARNING_STORYBOARD_SIGNAL_SPECS: readonly StoryboardSignalSpec[] = [
  { kind: "feedback", scope: "USER", evidenceCount: 2 },
  { kind: "manual-takeover", scope: "USER", evidenceCount: 1 },
  { kind: "edit-session", scope: "PROJECT", evidenceCount: 2 },
  { kind: "expert-intervention", scope: "USER", evidenceCount: 1 },
  { kind: "repeated-intent", scope: "TENANT", evidenceCount: 2 },
  { kind: "capability-gap", scope: "TENANT", evidenceCount: 1 },
];

// ---------------------------------------------------------------------------
// Trajectory 确定性合成/重放字节（校验器在 learningStoryboardLaws.ts）
// ---------------------------------------------------------------------------

/** 确定性合成一条 trajectory 步骤的字节（seed 派生；同 seed ⇒ 同字节）。 */
export function storyboardTrajectoryStepBytes(seedText: string, index: number): Uint8Array {
  return new TextEncoder().encode(
    `${LEARNING_STORYBOARD_SOLUTION_ID}:trajectory-step:${seedText}:${index}`,
  );
}

/** 确定性步骤引用列表（每步一条内容寻址标签；顺序 = 重放序）。 */
export function storyboardTrajectoryStepRefs(seedText: string, stepCount: number): string[] {
  const refs: string[] = [];
  for (let index = 0; index < stepCount; index += 1) {
    refs.push(
      `fx-content-${computeCaptureFixtureHash(`${LEARNING_STORYBOARD_SEED}:trajectory:${seedText}:${index}`)}`,
    );
  }
  return refs;
}

/** 确定性重放摘要（fixture 哈希；同步骤字节 ⇒ 同摘要）。 */
export function storyboardReplayHash(replayText: string): string {
  return `sha256-fixture-${computeCaptureFixtureHash(`${LEARNING_STORYBOARD_SEED}:replay:${replayText}`)}`;
}
