// YOU Capture Studio — W2B 确定性剧本数据。
//
// 边界（docs/you/FIXTURES.md wave-2 ownership）：
// - Worker A（you/w2a-core）拥有 evidence/capture/consent 的 fixture 生成器；
//   B **不新增 fixture 生成器**。本文件是「剧本」（storyboard）：契约形状的固定
//   字面量记录 + 声明式表，供 `captureSimulatedController.ts` 驱动确定性演示；
//   所有记录 simulated: true、provenance.generator: "fixture"。
// - TODO(T2): Worker A 的 evidence/capture/consent 服务合入后，由 TL 把 UI 端口
//   换绑到真实服务；本剧本届时随模拟控制器整体退役。
//
// 确定性法则（FIXTURES.md）：不调用 Date.now/Math.random/网络；时间戳来自
// StoryboardClock（复用 W1B 注入式剧本时钟）；一切输出排序稳定（按 id / 追加序）。
import type {
  CaptureGuideStep,
  ConsentPolicy,
  EvidenceRequest,
  ProvenanceRecord,
  SolutionQualityMap,
} from "@zcode/shared";
import { StoryboardClock, storyboardProvenance } from "./solutionStoryboard.js";

export { StoryboardClock, storyboardProvenance };

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const CAPTURE_STORYBOARD_SEED = "you-w2b-capture-studio-001";

export const CAPTURE_STORYBOARD_DISPLAY_NAME = "Capture Studio — Aria evidence";

/** 证据隐私等级（docs/you/SECURITY.md data classes）：演示走 sensitive-media，
 * 使同意门（operational consent）与学习复用门真实可见；内容始终为合成 fixture。 */
export const CAPTURE_STORYBOARD_PRIVACY_CLASS = "sensitive-media" as const;

// ---------------------------------------------------------------------------
// 同意政策（frozen ConsentPolicy 形状的固定记录）
// ---------------------------------------------------------------------------

export const CAPTURE_STORYBOARD_CONSENT_POLICY: ConsentPolicy = {
  id: "fx-capture-consent-001",
  purposes: ["solution-generation", "quality-improvement"],
  scope: "USER",
  operationalUse: false,
  learningReuse: false,
  retention: {
    policy: "delete-after-review",
    deleteAfter: null,
    reason:
      "Fixture evidence content is deleted once a review outcome is accepted; immutable records keep provenance only.",
  },
  revocable: true,
};

// ---------------------------------------------------------------------------
// 引导采集步骤（frozen CaptureGuideStep 形状的固定记录）
// ---------------------------------------------------------------------------

export const CAPTURE_STORYBOARD_GUIDE_STEPS: readonly CaptureGuideStep[] = [
  {
    id: "fx-guide-front",
    instruction:
      "Face the camera straight on and hold still for a three-count. Keep the expression neutral.",
    targetDeficiency: "geometry",
    preferredFraming: "front-facing, head centered, neutral expression, even lighting",
    requiredModality: "image",
  },
  {
    id: "fx-guide-quarter",
    instruction: "Slowly turn 45 degrees to your left and hold for a three-count.",
    targetDeficiency: "geometry",
    preferredFraming: "three-quarter view, shoulders relaxed, even lighting",
    requiredModality: "image",
  },
  {
    id: "fx-guide-motion",
    instruction: "Turn your head slowly from left to right over about five seconds.",
    targetDeficiency: "motion_naturalness",
    preferredFraming: "5-second clip, slow head turn left to right, fixed camera",
    requiredModality: "video",
  },
];

// ---------------------------------------------------------------------------
// 定向证据请求剧本（operator 必须能看懂「要什么、为什么、隐私与保留」）
// ---------------------------------------------------------------------------

export const CAPTURE_STORYBOARD_DEFAULT_REASON =
  "Head geometry quality is 0.52 (below the 0.55 review threshold). A front-facing reference plus a short motion clip lets the deterministic fixture pipeline compute an improved geometry delta — no real biometric data is collected.";

export const CAPTURE_STORYBOARD_APPEARANCE_REASON =
  "Appearance quality is 0.61. An additional reference image lets the fixture pipeline validate the appearance delta after the geometry improvement — synthetic content only.";

export function captureStoryboardEvidenceRequestTemplate(
  targetDeficiency: string,
  reason: string,
): Omit<EvidenceRequest, "id"> {
  return {
    targetDeficiency,
    evidenceType: "reference-image",
    preferredFraming: "front-facing reference framing, 3s hold",
    reason,
    privacyRequirements:
      "Class: sensitive-media. Synthetic fixture content only — no real photos, no biometric data. Processing requires your explicit operational consent; learning reuse requires a separate permission.",
    retention:
      "delete-after-review — content is deleted once a review outcome is accepted; immutable records keep provenance only.",
    status: "requested",
  };
}

// ---------------------------------------------------------------------------
// 确定性质量观察（按缺陷类别查表；fixture 定义，不构成科学度量）
// ---------------------------------------------------------------------------

/** EvidenceReview.qualityObservations 的确定性来源（按 targetDeficiency 查表）。 */
export const CAPTURE_STORYBOARD_QUALITY_OBSERVATIONS: Readonly<
  Record<string, SolutionQualityMap>
> = {
  geometry: { geometry: 0.74, identity: 0.63 },
  appearance: { appearance: 0.72 },
  motion_naturalness: { motion_naturalness: 0.66 },
};

// ---------------------------------------------------------------------------
// 合成 fixture 内容（seed 派生字符串；无 PII / 无生物特征数据）
// ---------------------------------------------------------------------------

/**
 * 由 seed 派生的合成证据「字节」（字符串形式）。同一 seed + scope 恒等输出。
 * 这是剧本字面量派生，不是通用 RNG（那属于 Worker A 的 fixture runtime）。
 */
export function buildCaptureFixtureBytes(scope: string): string {
  return `synthetic-evidence:${CAPTURE_STORYBOARD_SEED}:${scope}`;
}

/**
 * 确定性 fixture 内容哈希（FNV-1a 64 → 16 位 hex）。
 * 契约允许：fixture 模式下使用确定性 fixture hash（contract.ts EvidenceRecord 注释）；
 * 真实 sha-256 绑定属于 Worker A 的内容存储（node:crypto）。UI 侧为浏览器环境，
 * 因此模拟控制器使用本纯函数哈希并全程标注 simulated。
 */
export function computeCaptureFixtureHash(input: string): string {
  // FNV-1a 64-bit 参数。
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

/** 剧本溯源（与 W1B 同源，source 区分 capture studio）。 */
export function captureStoryboardProvenance(
  clock: StoryboardClock,
  lineage: readonly string[] = [],
): ProvenanceRecord {
  return {
    source: "you-phase0-capture-storyboard",
    generator: "fixture",
    createdAt: clock.next(),
    lineage,
  };
}
