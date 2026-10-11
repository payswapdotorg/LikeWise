// YOU Editing Studio — W5B 确定性剧本数据。
//
// 边界（docs/you/FIXTURES.md wave-5 ownership / docs/you/CONTRACTS.md v5 freeze）：
// - Worker A（W5A）拥有 editing/interchange 的 fixture 生成器（EditingSession/
//   EditChangeSet/CandidateVersion/ImportExport 的确定性 runtime）；B **不新增 fixture
//   生成器**。本文件是「剧本」（storyboard）：契约形状的固定字面量记录 + 声明式表，
//   供 `editingSimulatedController.ts` 驱动确定性演示；所有记录 simulated: true。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v5 `you/contract.ts`），禁止本地重声明。
// - TODO(T5): Worker A 的 editing 服务合入后，由 TL 把 UI 端口换绑到真实服务；本剧本
//   届时随模拟控制器整体退役。
//
// 确定性法则（FIXTURES.md）：不调用 Date.now/Math.random/网络；时间戳来自
// StoryboardClock（复用 W1B 注入式剧本时钟）；一切输出排序稳定（按 id / 追加序）。
// 内容寻址：edit op payload 与 candidate 内容一律 payloadRef+payloadHash /
// contentRef+contentHash，绝不内联（CONTRACTS.md v5 laws；EDITING_INTERCHANGE.md
// Tier 4 纪律）。tier 分类学（native / embedded / external）为 binding（同
// EDITING_INTERCHANGE.md Integration tiers）。
import type {
  ConsentPolicy,
  EditChangeSet,
  EditChangeSetOp,
  EditorCapabilityProfile,
  ImportExportFormat,
} from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const EDITING_STORYBOARD_SEED = "you-w5b-editing-studio-001";

export const EDITING_STORYBOARD_DISPLAY_NAME = "Editing Studio — Aria";

export const EDITING_STORYBOARD_SOLUTION_ID = "fx-editing-studio";

// ---------------------------------------------------------------------------
// 同意政策（v5 law：external editor launch 与 manual takeover 的确认走 wave-2
// consent authority 形状——同一 ConsentPolicy/ConsentReference 投影，绝不另立第二条
// 同意路径；「无许可 ⇒ 不处理」在编辑车道同样真实可见）
// ---------------------------------------------------------------------------

/**
 * external editor launch 所需的操作用途（Tier 3 外部编辑器会把 subject 内容交出
 * 进程边界 ⇒ 等价于 export 用途：EDITING_INTERCHANGE.md Tier 3/4）。
 */
export const EDITING_STORYBOARD_LAUNCH_PURPOSE = "export" as const;

/** manual takeover 确认用途（用户显式接管编辑——wave-2 用途联合的开放扩展成员）。 */
export const EDITING_STORYBOARD_TAKEOVER_PURPOSE = "manual-takeover" as const;

export const EDITING_STORYBOARD_CONSENT_POLICY: ConsentPolicy = {
  id: "fx-editing-consent-001",
  purposes: [EDITING_STORYBOARD_LAUNCH_PURPOSE, EDITING_STORYBOARD_TAKEOVER_PURPOSE],
  scope: "USER",
  operationalUse: false,
  learningReuse: false,
  retention: {
    policy: "delete-after-review",
    deleteAfter: null,
    reason:
      "Fixture editing flows (external editor launch, manual takeover) are gated on consent; immutable candidates keep provenance only.",
  },
  revocable: true,
};

// ---------------------------------------------------------------------------
// 内容寻址（payloadRef + payloadHash / contentRef + contentHash；绝不内联）
// ---------------------------------------------------------------------------

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 剧本内容绑定（与 W5A fixture store 同语义：确定性哈希绑定）。 */
export interface StoryboardContentBinding {
  readonly contentRef: string;
  readonly contentHash: string;
}

/** 依据 scope 文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function storyboardContentBinding(scope: string): StoryboardContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${EDITING_STORYBOARD_SEED}:${scope}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${EDITING_STORYBOARD_SEED}:${scope}:content`)}`,
  };
}

/** 依据 scope 文本派生确定性 op payload 绑定。 */
export function storyboardPayloadBinding(scope: string): StoryboardContentBinding {
  return {
    contentRef: `fx-content-${computeCaptureFixtureHash(`${EDITING_STORYBOARD_SEED}:op:${scope}`)}`,
    contentHash: `sha256-fixture-${computeCaptureFixtureHash(`${EDITING_STORYBOARD_SEED}:op:${scope}:payload`)}`,
  };
}

// ---------------------------------------------------------------------------
// Subject artifacts（编辑对象注册表：render artifact 或其它内容寻址记录）
// ---------------------------------------------------------------------------

/**
 * 一个已注册的编辑对象（服务端状态投影；与 W5A EditingSubjectRecord 同语义——
 * 内容寻址绑定 append-only，来源平面保持自己的权威）。
 */
export interface EditingSubjectView {
  readonly id: string;
  /** 展示标签（来源平面语义：render 静帧 / scene 包）。 */
  readonly displayName: string;
  readonly contentRef: string;
  readonly contentHash: string;
  /** 来源平面标识（「编辑平面不拥有 subject 真相」的可见标注）。 */
  readonly originPlane: string;
  readonly simulated: boolean;
}

function storyboardSubject(
  id: string,
  displayName: string,
  originPlane: string,
  scope: string,
): EditingSubjectView {
  return {
    id,
    displayName,
    originPlane,
    ...storyboardContentBinding(scope),
    simulated: true,
  };
}

/** 固定 subject 注册表（追加序稳定；内容寻址；来自 render/interchange 平面）。 */
export const EDITING_STORYBOARD_SUBJECTS: readonly EditingSubjectView[] = [
  storyboardSubject(
    "fx-editsubject-001",
    "Rendered still — studio portrait",
    "performance/render",
    "subject:rendered-still",
  ),
  storyboardSubject(
    "fx-editsubject-002",
    "Scene package — studio layout",
    "performance/render",
    "subject:scene-package",
  ),
];

export function storyboardSubjectById(subjectId: string): EditingSubjectView | null {
  return EDITING_STORYBOARD_SUBJECTS.find((subject) => subject.id === subjectId) ?? null;
}

// ---------------------------------------------------------------------------
// Editor 分类学（EDITING_INTERCHANGE.md Integration tiers：native / embedded /
// external——binding；profile = 注册面数据（W5C lane），绝非运行时权威）
// ---------------------------------------------------------------------------

/**
 * 固定 editor capability 注册面（与 W5A fixture 矩阵同语义：三个 EditorKind 分类
 * 成员各一条 profile；未注册 kind ⇒ YOU_EDITOR_UNSUPPORTED，绝不静默回退）。
 */
export const EDITING_STORYBOARD_EDITOR_PROFILES: readonly EditorCapabilityProfile[] = [
  {
    id: "fx-editor-native",
    editorKind: "native",
    displayName: "Native controls (tier 1)",
    supportsFormats: ["edit-interchange", "json", "scene-package"],
    roundTripSafe: true,
    notes: "fixture profile (simulated); tier-1 runtime-native selection/transform controls",
  },
  {
    id: "fx-editor-embedded",
    editorKind: "embedded",
    displayName: "Embedded surface (tier 2)",
    supportsFormats: ["edit-interchange", "json"],
    roundTripSafe: true,
    notes: "fixture profile (simulated); tier-2 embedded open-source editor surface",
  },
  {
    id: "fx-editor-external",
    editorKind: "external",
    displayName: "External application (tier 3)",
    supportsFormats: ["edit-interchange", "scene-package"],
    roundTripSafe: true,
    notes: "fixture profile (simulated); tier-3 external professional application (Blender-class)",
  },
];

export function storyboardEditorProfile(editorKind: string): EditorCapabilityProfile | null {
  return (
    EDITING_STORYBOARD_EDITOR_PROFILES.find((profile) => profile.editorKind === editorKind) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Interchange format 支持（frozen fixture 语义；不支持的 format ⇒ 拒绝）
// ---------------------------------------------------------------------------

/** 引擎支持的 interchange format 全集（与 W5A fixture 支持面同语义）。 */
export const EDITING_STORYBOARD_FORMATS: readonly ImportExportFormat[] = [
  "edit-interchange",
  "json",
  "scene-package",
];

export function isStoryboardSupportedFormat(format: string): boolean {
  return EDITING_STORYBOARD_FORMATS.includes(format as ImportExportFormat);
}

// ---------------------------------------------------------------------------
// EditingSession 生命周期（W5A 冻结转移表：open → committed | abandoned；终态锁定）
// ---------------------------------------------------------------------------

export const STORYBOARD_EDITING_SESSION_TRANSITIONS: Readonly<
  Record<string, readonly string[]>
> = {
  open: ["committed", "abandoned"],
  committed: [],
  abandoned: [],
};

export function isLegalStoryboardEditingSessionTransition(from: string, to: string): boolean {
  return STORYBOARD_EDITING_SESSION_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// EditChangeSet 校验（stateless、无时钟——W5A YOU_CHANGESET_INVALID 的剧本镜像）
// ---------------------------------------------------------------------------

export type StoryboardChangeSetViolationReason =
  | "empty-op-list"
  | "empty-op-kind"
  | "missing-payload-addressing"
  | "unknown-session";

export interface StoryboardChangeSetViolation {
  readonly reason: StoryboardChangeSetViolationReason;
  readonly opIndex: number | null;
  readonly opId: string | null;
}

/**
 * 冻结 v5 change-set 不变量（W5A 同语义）：
 * - ops 非空（无空 op 列表）；
 * - 每 op：kind 非空字符串、payloadRef/payloadHash 非空（内容寻址，绝不内联）；
 * - ops 有序（顺序是提议者的权威；列表顺序原样保留）。
 * 返回首个违例（确定性：按检查顺序）；null = 合法。
 */
export function validateStoryboardChangeSet(
  changeSet: Pick<EditChangeSet, "ops">,
): StoryboardChangeSetViolation | null {
  if (changeSet.ops.length === 0) {
    return { reason: "empty-op-list", opIndex: null, opId: null };
  }
  for (let index = 0; index < changeSet.ops.length; index += 1) {
    const op = changeSet.ops[index];
    if (op === undefined) continue;
    if (typeof op.kind !== "string" || op.kind.trim() === "") {
      return { reason: "empty-op-kind", opIndex: index, opId: op.id };
    }
    if (!op.payloadRef || !op.payloadHash) {
      return { reason: "missing-payload-addressing", opIndex: index, opId: op.id };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 编辑 op 合成（确定性字面量表：op kind 分类学 + 种子派生 payload）
// ---------------------------------------------------------------------------

/**
 * 剧本 op kind 分类学（fixture 开放集合；顺序展示用）。native 控件语义：
 * transform / material / geometry / annotation。
 */
export const EDITING_STORYBOARD_OP_KINDS: readonly string[] = [
  "transform",
  "material",
  "geometry",
  "annotation",
];

/** 确定性合成一条内容寻址 op（tag 保证 id / payload 寻址唯一；内容绝不内联）。 */
export function buildStoryboardEditOp(
  kind: string,
  tag: string,
): EditChangeSetOp {
  const binding = storyboardPayloadBinding(`op:${kind}:${tag}`);
  return {
    id: `fx-editop-${kind}-${tag}`,
    kind,
    payloadRef: binding.contentRef,
    payloadHash: binding.contentHash,
  };
}

/** 剧本变更集 A（transform 微调 + material 标注——「小幅手动纠正」形状）。 */
export function buildStoryboardChangeSetOpsA(): readonly EditChangeSetOp[] {
  return [
    buildStoryboardEditOp("transform", "a-001"),
    buildStoryboardEditOp("material", "a-002"),
    buildStoryboardEditOp("annotation", "a-003"),
  ];
}

/** 剧本变更集 B（geometry 单 op——第二条 candidate 谱系分支）。 */
export function buildStoryboardChangeSetOpsB(): readonly EditChangeSetOp[] {
  return [buildStoryboardEditOp("geometry", "b-001")];
}

// ---------------------------------------------------------------------------
// 确定性 candidate 预览摘要（同 ops + 同 parent ⇒ 同 digest；无时钟无状态）
// ---------------------------------------------------------------------------

/** 确定性候选预览摘要（纯内容派生：parent + op 寻址拼接后哈希）。 */
export function storyboardCandidatePreviewDigest(
  parentVersionId: string,
  ops: readonly EditChangeSetOp[],
): string {
  const opScope = ops
    .map((op) => `${op.kind}:${op.payloadRef}:${op.payloadHash}`)
    .join("|");
  return computeCaptureFixtureHash(
    `${EDITING_STORYBOARD_SEED}:candidate-preview:${parentVersionId}:${opScope}`,
  );
}
