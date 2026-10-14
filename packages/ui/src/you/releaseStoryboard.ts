// YOU Release Studio — W12B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W12B / docs/you/CONTRACTS.md "Wave-12 contract
// freeze (v12)"）：
// - Worker A（W12A）拥有 launch-gate 权威（20 点 checklist 装配、operator
//   sign-off、release declaration 的持久化）；Worker C（W12C）拥有 gate
//   evidence 权威（evidence bundle builder、checklist derivation、golden gate
//   run）。B **不新增 fixture 生成器**。本文件是「剧本」（storyboard）：契约形状
//   的固定字面量记录 + 声明式表，供 `releaseSimulatedController.ts` 驱动确定性
//   演示；所有记录 simulated: true。W12A 的 launch-gate 服务接缝与 W12C 的
//   evidence 接缝在此以声明侧镜像呈现（与 W11B 注册面镜像 W11A/W11C 同款
//   先例；T12 换绑时逐方法对位）。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v12 `you/contract.ts`），禁止本地
//   重声明。
// - TODO(T12): W12A 的 launch-gate authority 服务与 W12C 的 gate-evidence 服务
//   合入后，由 TL 把 UI 端口换绑到真实服务；本剧本届时随模拟控制器整体退役。
//
// 确定性法则（docs/you/FIXTURES.md）：不调用 Date.now/Math.random/网络；一切输出
// 排序稳定（按 id / 追加序）。内容寻址：journey / operator / bundle / rollback
// 标签一律 contentRef/contentHash 风格标签，绝不内联。
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const RELEASE_STORYBOARD_SEED = "you-w12b-release-studio-001";

export const RELEASE_STORYBOARD_DISPLAY_NAME = "Release Studio — Aria";

export const RELEASE_STORYBOARD_SOLUTION_ID = "fx-release-studio";

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareReleaseStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（journey / operator / bundle / rollback 标签；绝不内联）
// ---------------------------------------------------------------------------

export interface ReleaseContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据键文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function releaseContentBinding(key: string): ReleaseContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${RELEASE_STORYBOARD_SEED}:${key}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${RELEASE_STORYBOARD_SEED}:${key}:content`)}`,
  };
}

// ---------------------------------------------------------------------------
// 20 点 launch-gate journey 预设（W11C 工单口径 verbatim；W12B 的声明侧镜像）
// ---------------------------------------------------------------------------

/**
 * 20 点 launch-gate journey 的固定步骤表（与 W11C/W11B 的
 * CONFORMANCE_STORYBOARD_LAUNCH_GATE_STEPS 同一工单口径，verbatim 逐字：
 * workspace creation -> intent -> Solution -> inspect -> feedback -> evidence ->
 * Twin -> improve -> Performance -> render -> edit -> import/export -> version
 * accept -> learn with permission -> repeat -> capability gap -> Arena
 * escalation -> expert result -> provenance/consent -> injected-failure
 * recovery）。
 */
export const RELEASE_STORYBOARD_LAUNCH_GATE_STEPS: readonly string[] = [
  "workspace-create",
  "intent-capture",
  "solution-open",
  "solution-inspect",
  "feedback-submit",
  "evidence-record",
  "twin-reconstruct",
  "twin-improve",
  "performance-bind",
  "render-submit",
  "edit-session",
  "import-export",
  "version-accept",
  "learn-with-permission",
  "repeat-loop",
  "capability-gap",
  "arena-escalation",
  "expert-result",
  "provenance-consent",
  "injected-failure-recovery",
];

export const RELEASE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS =
  RELEASE_STORYBOARD_LAUNCH_GATE_STEPS.length;

/**
 * 20 点 launch-gate checklist 的固定描述表（与步骤表一一对应：checklist point N
 * 的 description 即 journey 步骤 N 的验收描述——LAUNCH GATE LAW 的 point 粒度
 * 陈述）。
 */
export const RELEASE_STORYBOARD_LAUNCH_GATE_POINT_DESCRIPTIONS: readonly string[] =
  [
    "a workspace is created and the journey begins",
    "the user intent is captured with constraints and acceptance criteria",
    "a Solution opens as a first-class workspace surface",
    "the Solution is inspected (semantic state, not pixels only)",
    "feedback is submitted against live targets",
    "evidence is recorded with consent references",
    "the Twin is reconstructed from immutable evidence",
    "the Twin improves through a validated remediation loop",
    "performance is bound (pose, gaze, voice, timing) independently of identity",
    "a render job is submitted and its artifact reviewed",
    "an edit session lands as a first-class manual intervention",
    "import/export completes round-trip with content hashes intact",
    "a version is accepted as a new immutable canonical version",
    "learning lands only with recorded permission",
    "the loop repeats with the learned state applied",
    "a capability gap is detected with evidence before escalation",
    "Arena escalation is authorized through the provider-neutral boundary",
    "the expert result is validated and applied",
    "provenance and consent hold across the whole chain",
    "an injected failure is recovered (the failure-injection drill)",
  ];

/**
 * journey 步骤名解析（1-based → 20 点表的 verbatim 步骤名；越界 → null）。
 * UI 绝不猜测步骤名。
 */
export function storyboardReleaseStepName(
  stepIndex: number,
  steps: readonly string[] = RELEASE_STORYBOARD_LAUNCH_GATE_STEPS,
): string | null {
  if (stepIndex < 1 || stepIndex > steps.length) return null;
  return steps[stepIndex - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Gate journey 预设（LAUNCH GATE LAW：point N passes ONLY with point-N journey
// evidence —— never a bare assertion）
// ---------------------------------------------------------------------------

export interface StoryboardReleaseJourney {
  readonly id: string;
  readonly journeyId: string;
  /** 步骤表（20 点 launch gate）。 */
  readonly steps: readonly string[];
  /**
   * 已有成功 E2eJourneyRecord 证据的步骤数（1..20；LAUNCH GATE LAW 的声明侧
   * 镜像：前 evidenceSteps 点携带 journey evidence，其余点 evidenceRef 为
   * null 且 passed=false——绝不 bare assertion）。
   */
  readonly evidenceSteps: number;
  /** 形状是否合法（未注册 journey = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

/**
 * 三条 journey 覆盖 LAUNCH GATE LAW 的关键分支：golden（20/20 证据齐——gate
 * 可过的主路径）、partial（16/20——诚实 incomplete 显示，signoff 门关）、未注册
 * legacy（typed 拒绝路径）。
 */
export const RELEASE_STORYBOARD_JOURNEYS: readonly StoryboardReleaseJourney[] = [
  {
    id: "journey-gate-golden",
    journeyId: "launch-gate-001",
    steps: RELEASE_STORYBOARD_LAUNCH_GATE_STEPS,
    evidenceSteps: RELEASE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
    valid: true,
  },
  {
    id: "journey-gate-partial",
    journeyId: "launch-gate-partial-016",
    steps: RELEASE_STORYBOARD_LAUNCH_GATE_STEPS,
    evidenceSteps: 16,
    valid: true,
  },
  {
    id: "journey-unknown-legacy",
    journeyId: "legacy-journey-000",
    steps: [],
    evidenceSteps: 0,
    valid: false,
  },
];

export function storyboardReleaseJourneyById(
  id: string,
): StoryboardReleaseJourney | null {
  return RELEASE_STORYBOARD_JOURNEYS.find((entry) => entry.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Release operator 预设（OPERATOR SIGNOFF LAW：signoff 引用 COMPLETE passing
// checklist；不可变；one release declaration per signoff）
// ---------------------------------------------------------------------------

export interface StoryboardReleaseOperator {
  readonly id: string;
  readonly operatorKey: string;
  /** 操作者显示名（fixture 剧本人物）。 */
  readonly displayName: string;
  /** 形状是否合法（未注册 operator = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

/**
 * 两条 operator 覆盖 OPERATOR SIGNOFF LAW 的关键分支：Aria（在册 release
 * operator——合法 sign-off 路径）、legacy（未注册——typed 拒绝路径）。
 */
export const RELEASE_STORYBOARD_OPERATORS: readonly StoryboardReleaseOperator[] =
  [
    {
      id: "operator-aria",
      operatorKey: "aria-release-operator",
      displayName: "Aria (release operator)",
      valid: true,
    },
    {
      id: "operator-unknown-legacy",
      operatorKey: "legacy-operator-000",
      displayName: "legacy-operator-000",
      valid: false,
    },
  ];

export function storyboardReleaseOperatorById(
  id: string,
): StoryboardReleaseOperator | null {
  return (
    RELEASE_STORYBOARD_OPERATORS.find((entry) => entry.id === id) ?? null
  );
}

// ---------------------------------------------------------------------------
// Evidence bundle 预设（RELEASE DECLARATION LAW：declaration carries the full
// evidence bundle AND rollback evidence）
// ---------------------------------------------------------------------------

export interface StoryboardReleaseEvidenceBundle {
  readonly id: string;
  readonly bundleKey: string;
  /** bundle 内的 E2eJourneyRecord 数（W12C evidence bundle builder 的声明侧镜像）。 */
  readonly journeyCount: number;
  /** 形状是否合法（未注册 bundle = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

/**
 * 三条 bundle 覆盖 RELEASE DECLARATION LAW 的关键分支：golden set（20 点
 * golden journey + failure-injection recovery runs 的完整 bundle——合法声明
 * 路径）、空 bundle（0 条 journey——「full evidence bundle」的 typed 拒绝路径）、
 * 未注册（fail-closed）。
 */
export const RELEASE_STORYBOARD_EVIDENCE_BUNDLES: readonly StoryboardReleaseEvidenceBundle[] =
  [
    {
      id: "bundle-golden-journey-set",
      bundleKey: "golden-journey-set-001",
      journeyCount: 21,
      valid: true,
    },
    {
      id: "bundle-empty",
      bundleKey: "empty-bundle-000",
      journeyCount: 0,
      valid: true,
    },
    {
      id: "bundle-unregistered",
      bundleKey: "unregistered-bundle-profile",
      journeyCount: 0,
      valid: false,
    },
  ];

export function storyboardReleaseEvidenceBundleById(
  id: string,
): StoryboardReleaseEvidenceBundle | null {
  return (
    RELEASE_STORYBOARD_EVIDENCE_BUNDLES.find((entry) => entry.id === id) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Rollback evidence 预设（RELEASE DECLARATION LAW：rollback evidence 在场——
// W10C production-eligibility/rollback 机制的声明侧镜像）
// ---------------------------------------------------------------------------

export interface StoryboardReleaseRollbackEvidence {
  readonly id: string;
  readonly rollbackKey: string;
  /** 演练描述（W10C production eligibility 的 rollback drill 声明侧镜像）。 */
  readonly drill: string;
  /** 形状是否合法（未注册 rollback = fail-closed typed 拒绝路径）。 */
  readonly valid: boolean;
}

/**
 * 两条 rollback evidence 覆盖 RELEASE DECLARATION LAW 的关键分支：DR 已验证
 * rollback（合法声明路径）、未注册（missing rollback evidence 的 typed 拒绝
 * 路径）。
 */
export const RELEASE_STORYBOARD_ROLLBACK_EVIDENCE: readonly StoryboardReleaseRollbackEvidence[] =
  [
    {
      id: "rollback-dr-verified",
      rollbackKey: "dr-restore-verified-001",
      drill: "DR restore verified from the secondary snapshot; content hash re-verified before activation; reversible within the declared window",
      valid: true,
    },
    {
      id: "rollback-unregistered",
      rollbackKey: "unregistered-rollback-profile",
      drill: "",
      valid: false,
    },
  ];

export function storyboardReleaseRollbackEvidenceById(
  id: string,
): StoryboardReleaseRollbackEvidence | null {
  return (
    RELEASE_STORYBOARD_ROLLBACK_EVIDENCE.find((entry) => entry.id === id) ??
    null
  );
}
