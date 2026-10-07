// YOU Solution Studio — Phase-0 确定性剧本数据（W1B）。
//
// 边界（docs/you/FIXTURES.md wave-1 ownership）：
// - Worker A 拥有 fixture 生成器（DeterministicClock/RNG、synthetic-human 生成器、
//   quality-delta 模型、事件账本服务）。B **不新增 fixture 生成器**。
// - 本文件是「剧本」（storyboard）：一组字面量、契约形状的固定记录 + 声明式 delta 表，
//   供 `solutionSimulatedController.ts` 驱动 Phase-0 operator demo；所有记录
//   simulated: true、provenance.generator: "fixture"。
// - TODO(T1): A 的 fixture runtime 合入后，由 solutionService 提供同一场景的
//   规范生成版本，替换本剧本。
//
// 确定性法则：不调用 Date.now/Math.random/网络；时间戳来自固定纪元 + tick 计数器；
// 一切输出排序稳定（按 id）。
import type {
  AttemptedStrategy,
  ArenaExpertResult,
  CapabilityGap,
  EditorRecommendation,
  EvidenceRequest,
  ProvenanceRecord,
  SolutionEntity,
  SolutionEnvironmentState,
  SolutionIdentity,
  SolutionQualityMap,
  SolutionStateSnapshot,
  SolutionTransform,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 固定时钟（FIXTURES 法则 3：注入式时钟，固定纪元 + 1s tick）
// ---------------------------------------------------------------------------

const STORYBOARD_EPOCH_MS = Date.UTC(2025, 5, 2, 9, 0, 0, 0);

/**
 * 剧本时钟：每次调用前进 1 秒。这是「剧本数据」的一部分（顺序记录的创建时间），
 * 不是通用 DeterministicClock 工具（那属于 Worker A 的 fixture runtime）。
 */
export class StoryboardClock {
  private tick = 0;

  next(): string {
    const iso = new Date(STORYBOARD_EPOCH_MS + this.tick * 1000).toISOString();
    this.tick += 1;
    return iso;
  }
}

export function storyboardProvenance(
  clock: StoryboardClock,
  lineage: readonly string[] = [],
): ProvenanceRecord {
  return {
    source: "you-phase0-storyboard",
    generator: "fixture",
    createdAt: clock.next(),
    lineage,
  };
}

// ---------------------------------------------------------------------------
// 身份与意图
// ---------------------------------------------------------------------------

export const STORYBOARD_SOLUTION_IDENTITY: SolutionIdentity = {
  id: "fx-solution-001",
  workspaceIdentity: "",
  displayName: "Studio Human — Aria",
};

export const STORYBOARD_INTENT = {
  id: "fx-intent-001",
  text: "Create a friendly synthetic human who can wave naturally in a studio scene.",
} as const;

/** Phase-0 意图集（repeatIntent 依赖固定 intent id）。 */
export const STORYBOARD_INTENTS = [STORYBOARD_INTENT] as const;

// ---------------------------------------------------------------------------
// 合成人实体（seed 参数字面量生成，无 PII / 无生物特征数据）
// ---------------------------------------------------------------------------

function transform(
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
): SolutionTransform {
  return { position, rotation, scale };
}

export const STORYBOARD_ENTITIES: readonly SolutionEntity[] = [
  {
    id: "fx-human-root",
    kind: "synthetic-human",
    label: "Aria (root)",
    transform: transform([0, 0, 0]),
    attributes: { rig: "fx-rig-v1", meshes: 12 },
  },
  {
    id: "fx-human-head",
    kind: "synthetic-human",
    label: "Head",
    transform: transform([0, 1.62, 0]),
    attributes: { meshDetail: "medium", symmetry: 0.61, materials: "matte-skin-v1" },
  },
  {
    id: "fx-human-torso",
    kind: "synthetic-human",
    label: "Torso",
    transform: transform([0, 1.05, 0]),
    attributes: { meshDetail: "medium", materials: "studio-cloth-v1" },
  },
  {
    id: "fx-human-arm-left",
    kind: "synthetic-human",
    label: "Left arm",
    transform: transform([-0.3, 1.28, 0], [0, 0, 0.18]),
    attributes: { joints: 3, pose: "rest" },
  },
  {
    id: "fx-human-arm-right",
    kind: "synthetic-human",
    label: "Right arm",
    transform: transform([0.3, 1.28, 0], [0, 0, -0.18]),
    attributes: { joints: 3, pose: "rest" },
  },
  {
    id: "fx-human-hand-left",
    kind: "synthetic-human",
    label: "Left hand",
    transform: transform([-0.38, 0.98, 0.02]),
    attributes: { fingers: 5, articulation: "coarse" },
  },
  {
    id: "fx-human-hand-right",
    kind: "synthetic-human",
    label: "Right hand",
    transform: transform([0.38, 0.98, 0.02]),
    attributes: { fingers: 5, articulation: "coarse" },
  },
  {
    id: "fx-human-legs",
    kind: "synthetic-human",
    label: "Legs",
    transform: transform([0, 0.42, 0]),
    attributes: { joints: 6, pose: "standing" },
  },
  {
    id: "fx-env-ground",
    kind: "environment",
    label: "Studio ground",
    transform: transform([0, 0, 0], [0, 0, 0], [4, 1, 4]),
    attributes: { material: "matte-floor" },
  },
  {
    id: "fx-env-backdrop",
    kind: "environment",
    label: "Studio backdrop",
    transform: transform([0, 1.2, -1.4], [0, 0, 0], [4, 2.6, 0.1]),
    attributes: { material: "seamless-paper" },
  },
  {
    id: "fx-light-key",
    kind: "light",
    label: "Key light",
    transform: transform([1.6, 2.4, 1.2]),
    attributes: { intensity: 0.85, temperature: "4800K" },
  },
  {
    id: "fx-camera-main",
    kind: "camera-marker",
    label: "Camera A",
    transform: transform([2.2, 1.5, 2.6], [0, 0.72, 0]),
    attributes: { lens: "50mm", framing: "medium-shot" },
  },
];

export const STORYBOARD_ENVIRONMENT: SolutionEnvironmentState = {
  keyLightDirection: [0.55, 0.7, 0.45],
  ambientIntensity: 0.62,
  background: "studio-warm-gray",
};

/** v1 基线质量（deficiency class → [0,1] fixture 分数；不构成科学度量）。 */
export const STORYBOARD_BASE_QUALITY: SolutionQualityMap = {
  appearance: 0.61,
  composition: 0.83,
  geometry: 0.52,
  identity: 0.58,
  motion_naturalness: 0.47,
};

export function buildStoryboardV1State(): SolutionStateSnapshot {
  return {
    entities: STORYBOARD_ENTITIES.map((entity) => ({ ...entity })),
    environment: { ...STORYBOARD_ENVIRONMENT },
    quality: { ...STORYBOARD_BASE_QUALITY },
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// 区域（region selector 的固定投影键；展示元数据，非 canonical 契约）
// ---------------------------------------------------------------------------

export interface StoryboardRegion {
  readonly id: string;
  readonly label: string;
  readonly entityIds: readonly string[];
}

export const STORYBOARD_REGIONS: readonly StoryboardRegion[] = [
  {
    id: "region.face",
    label: "Face",
    entityIds: ["fx-human-head"],
  },
  {
    id: "region.hands",
    label: "Hands & arms",
    entityIds: [
      "fx-human-arm-left",
      "fx-human-arm-right",
      "fx-human-hand-left",
      "fx-human-hand-right",
    ],
  },
  {
    id: "region.full-body",
    label: "Full body",
    entityIds: [
      "fx-human-root",
      "fx-human-head",
      "fx-human-torso",
      "fx-human-arm-left",
      "fx-human-arm-right",
      "fx-human-hand-left",
      "fx-human-hand-right",
      "fx-human-legs",
    ],
  },
];

// ---------------------------------------------------------------------------
// 声明式 delta 表（剧本数据，不是通用 quality-delta 模型）
// ---------------------------------------------------------------------------

/** 反馈类别 → 目标 deficiency class（CONTRACTS.md FeedbackRequest categories）。 */
export const FEEDBACK_CATEGORY_TARGET: Record<string, string> = {
  appearance: "appearance",
  behavior: "motion_naturalness",
  composition: "composition",
  geometry: "geometry",
  identity_mismatch: "identity",
  motion_naturalness: "motion_naturalness",
  style: "appearance",
};

/** 确定性改进步长（按 deficiency class；两轮改进后自然封顶 1.0）。 */
export const IMPROVEMENT_DELTA: Record<string, number> = {
  appearance: 0.18,
  composition: 0,
  geometry: 0.24,
  identity: 0.12,
  motion_naturalness: 0.22,
};

/** Arena 专家结果应用时的补充步长（TOOL_GAP → motion_naturalness）。 */
export const ARENA_RESULT_DELTA: Record<string, number> = {
  motion_naturalness: 0.15,
};

/** 分数统一保留 2 位小数（确定性输出）。 */
export function clampQualityScore(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// 手动接管 / 学习
// ---------------------------------------------------------------------------

export const TAKEOVER_TARGET_ENTITY_ID = "fx-human-arm-right";

/** 用户手动纠正：右臂从 rest 旋到挥手位（observed transform）。 */
export const STORYBOARD_TAKEOVER_CORRECTION: SolutionTransform = transform(
  [0.3, 1.28, 0],
  [0, 0, -2.2],
);

/** 已学习偏好（scope USER）：repeatIntent 应用同一纠正。 */
export const STORYBOARD_LEARNED_PREFERENCE = {
  summary: "Prefer right-arm rotation z = -2.20 rad for waving intents (scope: USER)",
  scope: "USER",
} as const;

/** 外部编辑器回传的编辑（re-import 演示真 diff，不重放原样字节）。 */
export const STORYBOARD_EXTERNAL_EDITOR_EDITS = {
  entityId: "fx-human-arm-right",
  rotationZ: -2.05,
  qualityOverride: { appearance: 0.83 },
  ambientIntensity: 0.68,
} as const;

// ---------------------------------------------------------------------------
// 能力缺口 / Arena mock（FIXTURES 法则 9：按类别查表的 fixture 结果）
// ---------------------------------------------------------------------------

export const STORYBOARD_CAPABILITY_GAP: CapabilityGap = {
  id: "fx-gap-001",
  intentRef: STORYBOARD_INTENT.id,
  attemptedStrategies: [
    { strategy: "native-pose-solver", outcome: "failed", evidenceRef: "fx-ev-101" },
    { strategy: "editor-roundtrip-blender", outcome: "partial", evidenceRef: null },
    { strategy: "fallback-static-pose", outcome: "rejected", evidenceRef: null },
  ] as AttemptedStrategy[],
  failureEvidence: ["fx-ev-101", "fx-ev-102"],
  category: "TOOL_GAP",
  confidence: 0.82,
  suggestedNextAction:
    "Escalate to Arena for expert hand-pose authoring; automated attempts are exhausted.",
  escalationEligibility: "eligible",
  arenaEscalationRef: null,
};

export const STORYBOARD_ARENA_EXPERT_RESULTS: Readonly<Record<string, ArenaExpertResult>> = {
  TOOL_GAP: {
    deliveredAt: "2025-06-02T09:00:42.000Z",
    resultType: "typed-payload",
    payload: { jointPoseLibrary: "arena-hand-poses-v3", maxDeviationDeg: 4.5 },
    appliesAsChangeSetId: null,
  },
};

export const STORYBOARD_ESCALATION_MINIMUM_CONTEXT: readonly string[] = [
  "capability-gap:fx-gap-001",
  "intent:fx-intent-001",
  "solution:fx-solution-001",
];

// ---------------------------------------------------------------------------
// 编辑器推荐（外部编辑器是 adapter，不是权威）
// ---------------------------------------------------------------------------

export const STORYBOARD_EDITOR_RECOMMENDATION: EditorRecommendation = {
  editorId: "blender-adapter",
  editorName: "Blender (external adapter)",
  rationale:
    "Mesh-level sculpting and armature editing exceed the native editor; Blender integrates through the YOU editor adapter so you stay in control of versioning.",
  exportFormat: "you-solution-package/1 (JSON manifest + scene state)",
};

// ---------------------------------------------------------------------------
// 证据请求剧本（定向证据；fixture 证据是合成的）
// ---------------------------------------------------------------------------

export function storyboardEvidenceRequestTemplate(targetDeficiency: string): Omit<
  EvidenceRequest,
  "id"
> {
  return {
    targetDeficiency,
    evidenceType: "fixture",
    preferredFraming: "front-facing reference framing, 3s hold",
    reason: `Deterministic fixture evidence resolves "${targetDeficiency}" without collecting real biometric data.`,
    privacyRequirements: "synthetic fixture only; no personal data captured",
    retention: "session-only fixture buffer",
    status: "requested",
  };
}
