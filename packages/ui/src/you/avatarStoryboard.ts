// YOU Avatar Studio — W7B 确定性剧本数据。
//
// 边界（docs/you/WORK_ORDERS.md W7B / docs/you/CONTRACTS.md wave-7 freeze）：
// - Worker A（W7A，已并入 origin/main 但**不在本 base**）拥有 embodiment 的运行时
//   权威；B 不新增 fixture 生成器。本文件是「剧本」（storyboard）：契约形状的固定
//   字面量记录 + 声明式表 + 无状态校验器（avatarStoryboardLaws.ts），供
//   `avatarSimulatedController.ts` 驱动确定性演示；所有记录 simulated: true。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v7 `you/contract.ts`），禁止本地重声明。
// - BODY/SOUL SEPARATION LAW：Body 可被另一 Soul 附身而不改 Body 契约（soul-reassigned
//   事件只改 session 记录）。
// - TODO(T7): W7A 的 embodiment 服务换绑后，本剧本随模拟控制器整体退役。
//
// 确定性法则（FIXTURES.md）：不调用 Date.now/Math.random/网络；时间戳来自
// StoryboardClock（复用 W1B 注入式剧本时钟）；输出排序稳定（id 升序）。外观与流
// 内容一律内容寻址（appearanceRef/appearanceHash、streamRef/streamHash），绝不内联。
import type {
  AgentBody,
  RealtimeChannelDescriptor,
  SoulBinding,
} from "@zcode/shared";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";
import {
  AVATAR_STORYBOARD_EMBODIMENT_STATES,
  AVATAR_STORYBOARD_ROUTING_PROFILES,
} from "./avatarStoryboardLaws.js";

// ---------------------------------------------------------------------------
// 身份 / 种子
// ---------------------------------------------------------------------------

/** 剧本种子（FIXTURES 法则 2：稳定 seed 常量；同 seed ⇒ 字节一致输出）。 */
export const AVATAR_STORYBOARD_SEED = "you-w7b-avatar-studio-001";

export const AVATAR_STORYBOARD_DISPLAY_NAME = "Avatar Studio — Aria";

export const AVATAR_STORYBOARD_SOLUTION_ID = "fx-avatar-studio";

/** 稳定排序键（FIXTURES 法则 4：输出排序显式稳定）。 */
export function compareStoryboardId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 内容寻址（appearance / stream——绝不内联）
// ---------------------------------------------------------------------------

/** 依据文本派生确定性内容绑定（fixture 哈希；simulated 全程标注）。 */
export function storyboardAppearanceBinding(appearanceText: string): {
  readonly appearanceRef: string;
  readonly appearanceHash: string;
} {
  return {
    appearanceRef: `fx-content-${computeCaptureFixtureHash(`${AVATAR_STORYBOARD_SEED}:appearance:${appearanceText}`)}`,
    appearanceHash: `sha256-fixture-${computeCaptureFixtureHash(`${AVATAR_STORYBOARD_SEED}:appearance:${appearanceText}:content`)}`,
  };
}

/** 依据会话/信道文本派生确定性流引用（内容寻址标签；同输入 ⇒ 同标签）。 */
export function storyboardStreamBinding(streamText: string): {
  readonly streamRef: string;
  readonly streamHash: string;
} {
  return {
    streamRef: `fx-stream-${computeCaptureFixtureHash(`${AVATAR_STORYBOARD_SEED}:stream:${streamText}`)}`,
    streamHash: `sha256-fixture-${computeCaptureFixtureHash(`${AVATAR_STORYBOARD_SEED}:stream:${streamText}:content`)}`,
  };
}

// ---------------------------------------------------------------------------
// Body 注册面（配置表面的 Body picker 数据源——注册面数据，非运行时权威）
// ---------------------------------------------------------------------------

function storyboardBody(
  id: string,
  role: string,
  capabilities: readonly string[],
  tools: readonly string[],
  appearanceText: string | null,
): AgentBody {
  const appearance =
    appearanceText === null
      ? { appearanceRef: null, appearanceHash: null }
      : storyboardAppearanceBinding(appearanceText);
  return {
    id,
    role,
    ...appearance,
    capabilities,
    tools,
    policyRefs: [`policy:fixtures/${id}`],
    memoryContractRef: `contract:fixtures/memory-${id}`,
    evaluatorContractRef: `contract:fixtures/evaluator-${id}`,
  };
}

/** 固定 Body 注册表（追加序稳定；内容寻址 appearance；fx-avatar-body-003 无外观）。 */
export const AVATAR_STORYBOARD_BODIES: readonly AgentBody[] = [
  storyboardBody(
    "fx-avatar-body-001",
    "research-companion",
    ["web-research", "summarize", "cite"],
    ["tool-web-search", "tool-fetch"],
    "portrait-neutral-researcher",
  ),
  storyboardBody(
    "fx-avatar-body-002",
    "pair-programmer",
    ["code-editing", "test-run", "review"],
    ["tool-editor", "tool-terminal"],
    "portrait-neutral-engineer",
  ),
  storyboardBody(
    "fx-avatar-body-003",
    "media-director",
    ["capture-planning", "shot-review"],
    ["tool-camera"],
    null,
  ),
];

export function storyboardBodyById(bodyId: string): AgentBody | null {
  return AVATAR_STORYBOARD_BODIES.find((entry) => entry.id === bodyId) ?? null;
}

// ---------------------------------------------------------------------------
// SoulBinding 注册面（Soul picker 数据源：providerKind/modelRef/routingProfile）
// ---------------------------------------------------------------------------

function storyboardSoul(
  id: string,
  providerKind: string,
  modelRef: string,
  routingProfile: string,
  capabilities: readonly string[],
): SoulBinding {
  return {
    id,
    providerKind,
    modelRef,
    routingProfile: routingProfile as SoulBinding["routingProfile"],
    capabilities,
  };
}

/**
 * 固定 SoulBinding 注册表（追加序稳定；routingProfile 是 ROUTING PROFILES
 * 而非固定模型身份——system-one 快/反应式、system-two 深/审慎式）。
 */
export const AVATAR_STORYBOARD_SOUL_BINDINGS: readonly SoulBinding[] = [
  storyboardSoul(
    "fx-avatar-soul-001",
    "open-weights-llm",
    "fixture/glm-8b-embodied",
    "system-one",
    ["chat", "tool-use"],
  ),
  storyboardSoul(
    "fx-avatar-soul-002",
    "open-weights-llm",
    "fixture/glm-32b-embodied",
    "system-two",
    ["chat", "reasoning", "tool-use"],
  ),
  storyboardSoul(
    "fx-avatar-soul-003",
    "vision-language-model",
    "fixture/vlm-embodied",
    "system-two",
    ["chat", "vision"],
  ),
  storyboardSoul(
    "fx-avatar-soul-004",
    "speculative-runtime",
    "fixture/spec-decode-embodied",
    "system-one",
    ["chat", "fast-path"],
  ),
];

export function storyboardSoulBindingById(soulBindingId: string): SoulBinding | null {
  return (
    AVATAR_STORYBOARD_SOUL_BINDINGS.find((entry) => entry.id === soulBindingId) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Realtime 信道（RealtimeChannelDescriptor 面板数据源；W7C 车道拥有真实构造）
// ---------------------------------------------------------------------------

/** 每个打开的 session 确定性获得两条信道（音频/视频，provider 中立 kind）。 */
export const AVATAR_STORYBOARD_CHANNEL_KINDS: readonly string[] = [
  "avatar-audio",
  "avatar-video",
];

/** Latency class（fixture 字面量；真实分类学归 W7C 车道注册面）。 */
export const AVATAR_STORYBOARD_LATENCY_CLASSES: readonly string[] = [
  "realtime",
  "near-realtime",
];

/** routing profile → 缺省 latency class 的确定性映射（显示投影用）。 */
export function storyboardLatencyClassOfRoutingProfile(
  routingProfile: string,
): string {
  return routingProfile === "system-two"
    ? AVATAR_STORYBOARD_LATENCY_CLASSES[1]!
    : AVATAR_STORYBOARD_LATENCY_CLASSES[0]!;
}

/** 依据 session + kind 派生确定性信道描述符（内容寻址流标签；绝不内联）。 */
export function storyboardRealtimeChannel(
  id: string,
  sessionId: string,
  kind: string,
  latencyClass: string,
): RealtimeChannelDescriptor {
  const stream = storyboardStreamBinding(`${sessionId}:${kind}`);
  return {
    id,
    kind,
    streamRef: stream.streamRef,
    streamHash: stream.streamHash,
    latencyClass,
  };
}

// ---------------------------------------------------------------------------
// 分类学（快照投影的 taxonomy 数据源——不 UI 硬编码）
// ---------------------------------------------------------------------------

/** 九级阶梯分类学（快照 embodimentStates 数据源）。 */
export const AVATAR_STORYBOARD_EMBODIMENT_TAXONOMY: readonly string[] = [
  ...AVATAR_STORYBOARD_EMBODIMENT_STATES,
];

/** 两种 routing profile 分类学（快照 routingProfiles 数据源）。 */
export const AVATAR_STORYBOARD_ROUTING_TAXONOMY: readonly string[] = [
  ...AVATAR_STORYBOARD_ROUTING_PROFILES,
];
