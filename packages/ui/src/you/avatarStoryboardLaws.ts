// YOU Avatar Studio — W7B 剧本法则（无状态校验器 + 具身阶梯机器）。
//
// 从 `avatarStoryboard.ts` 按模块内聚拆分（保持仓库 400 行纪律——与 W4B/W5B/W6B 的
// laws 拆分同款先例）：本文件承载 W7A shared 层语义的 UI 侧镜像——九级具身阶梯
//（interaction rungs 全连通 + unavailable 归 lifecycle 所有 + 自环拒绝）、SoulBinding
// intake 校验（providerKind/modelRef/routingProfile/capabilities）、AgentBody intake
// 校验（role/capabilities/tools/policyRefs/memoryContractRef/evaluatorContractRef）、
// RealtimeChannelDescriptor 完整性校验。全部无状态、无时钟、无随机
//（FIXTURES 法则 1/2）；契约类型一律从 `@zcode/shared` 导入（frozen v7）。
// 拒绝 reason 字符串与 W7A 服务权威逐字对齐（embodimentLadder.ts / soulBinding.ts /
// bodyRegistry.ts），T7 换绑时逐方法对位。
import type {
  EmbodimentState,
  RealtimeChannelDescriptor,
  SoulRoutingProfile,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 具身阶梯（frozen v7：九级 listening…unavailable 阶梯；投影、绝非权威）
// ---------------------------------------------------------------------------

/** The nine ladder rungs in frozen canonical order. */
export const AVATAR_STORYBOARD_EMBODIMENT_STATES: readonly EmbodimentState[] = [
  "listening",
  "reading",
  "typing",
  "thinking",
  "tool_use",
  "speaking",
  "interrupted",
  "idle",
  "unavailable",
];

/** The eight interaction rungs (every rung except lifecycle-owned "unavailable"). */
export const AVATAR_STORYBOARD_INTERACTION_STATES: readonly EmbodimentState[] = [
  "listening",
  "reading",
  "typing",
  "thinking",
  "tool_use",
  "speaking",
  "interrupted",
  "idle",
];

const STATE_SET: ReadonlySet<string> = new Set(AVATAR_STORYBOARD_EMBODIMENT_STATES);
const INTERACTION_SET: ReadonlySet<string> = new Set(
  AVATAR_STORYBOARD_INTERACTION_STATES,
);

/** True when the value is one of the nine frozen ladder rungs. */
export function isStoryboardEmbodimentState(
  value: unknown,
): value is EmbodimentState {
  return typeof value === "string" && STATE_SET.has(value);
}

/** True when the value is one of the eight interaction rungs. */
export function isStoryboardEmbodimentInteractionState(
  value: unknown,
): value is EmbodimentState {
  return typeof value === "string" && INTERACTION_SET.has(value);
}

/** Canonical ladder index of a rung (0-8), or -1 when off-ladder. */
export function storyboardEmbodimentStateIndex(state: string): number {
  return AVATAR_STORYBOARD_EMBODIMENT_STATES.indexOf(state as EmbodimentState);
}

/**
 * Why a generic activity transition is refused, or null when it is legal
 * （W7A embodimentTransitionRefusal 同语义）：自环拒绝；unavailable 归
 * suspend/resume/close lifecycle 所有——通用 state 转移绝不进入或离开它。
 */
export function storyboardEmbodimentTransitionRefusal(
  from: EmbodimentState,
  to: EmbodimentState,
): "no-op-transition" | "unavailable-is-lifecycle-owned" | null {
  if (from === to) {
    return "no-op-transition";
  }
  if (to === "unavailable") {
    return "unavailable-is-lifecycle-owned";
  }
  if (from === "unavailable") {
    return "unavailable-is-lifecycle-owned";
  }
  return null;
}

/** True when the generic transition is legal (the table is fully connected). */
export function isLegalStoryboardEmbodimentTransition(
  from: EmbodimentState,
  to: EmbodimentState,
): boolean {
  return storyboardEmbodimentTransitionRefusal(from, to) === null;
}

/** The state a suspended session projects (lifecycle-owned rung). */
export const AVATAR_STORYBOARD_SUSPENDED_STATE: EmbodimentState = "unavailable";

/** The state a resumed session projects (return to rest). */
export const AVATAR_STORYBOARD_RESUMED_STATE: EmbodimentState = "idle";

/** The default opening state of a freshly possessed Body. */
export const AVATAR_STORYBOARD_DEFAULT_OPEN_STATE: EmbodimentState = "idle";

// ---------------------------------------------------------------------------
// SoulBinding intake（frozen v7：provider 中立；ref reason 与 W7A 逐字对齐）
// ---------------------------------------------------------------------------

export const AVATAR_STORYBOARD_ROUTING_PROFILES: readonly SoulRoutingProfile[] = [
  "system-one",
  "system-two",
];

const ROUTING_PROFILE_SET: ReadonlySet<string> = new Set(
  AVATAR_STORYBOARD_ROUTING_PROFILES,
);

/** True when the value is one of the two frozen routing profiles. */
export function isStoryboardRoutingProfile(
  value: unknown,
): value is SoulRoutingProfile {
  return typeof value === "string" && ROUTING_PROFILE_SET.has(value);
}

export interface StoryboardSoulBindingRefusal {
  /** Stable reason string (rides along in typed error details). */
  readonly reason: string;
  readonly detail: string;
}

/**
 * The stateless soul-binding validator（W7A validateSoulBindingInput 同语义：
 * 单一 intake 权威——注册期复用，session-open / soul-reassign 期同表）。
 */
export function validateStoryboardSoulBindingInput(input: {
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: string;
  readonly capabilities?: readonly string[];
}): StoryboardSoulBindingRefusal | null {
  if (typeof input.providerKind !== "string" || input.providerKind.trim().length === 0) {
    return { reason: "provider-kind-empty", detail: "providerKind must be a non-empty string" };
  }
  if (typeof input.modelRef !== "string" || input.modelRef.trim().length === 0) {
    return { reason: "model-ref-empty", detail: "modelRef must be a non-empty string" };
  }
  if (!isStoryboardRoutingProfile(input.routingProfile)) {
    return {
      reason: "routing-profile-invalid",
      detail: `routingProfile must be one of: ${AVATAR_STORYBOARD_ROUTING_PROFILES.join(", ")}`,
    };
  }
  for (const capability of input.capabilities ?? []) {
    if (typeof capability !== "string" || capability.trim().length === 0) {
      return { reason: "capability-invalid", detail: "capabilities must be non-empty strings" };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// AgentBody intake（frozen v7：BODY/SOUL SEPARATION LAW——本模块不知道 soul/session）
// ---------------------------------------------------------------------------

export interface StoryboardAgentBodyRefusal {
  readonly reason: string;
  readonly detail: string;
}

/**
 * The stateless AgentBody validator（W7A validateAgentBodyInput 同语义：单一
 * intake 权威；appearance 内容解析只在构造期发生，此处只查形状）。
 */
export function validateStoryboardAgentBodyInput(input: {
  readonly role: string;
  readonly capabilities?: readonly string[];
  readonly tools?: readonly string[];
  readonly policyRefs?: readonly string[];
  readonly memoryContractRef: string;
  readonly evaluatorContractRef: string;
  readonly appearanceSpecText?: string | null;
}): StoryboardAgentBodyRefusal | null {
  if (typeof input.role !== "string" || input.role.trim().length === 0) {
    return { reason: "role-empty", detail: "role must be a non-empty string" };
  }
  if (
    typeof input.memoryContractRef !== "string" ||
    input.memoryContractRef.trim().length === 0
  ) {
    return {
      reason: "memory-contract-ref-empty",
      detail: "memoryContractRef must be a non-empty string",
    };
  }
  if (
    typeof input.evaluatorContractRef !== "string" ||
    input.evaluatorContractRef.trim().length === 0
  ) {
    return {
      reason: "evaluator-contract-ref-empty",
      detail: "evaluatorContractRef must be a non-empty string",
    };
  }
  for (const capability of input.capabilities ?? []) {
    if (typeof capability !== "string" || capability.trim().length === 0) {
      return { reason: "capability-invalid", detail: "capabilities must be non-empty strings" };
    }
  }
  for (const tool of input.tools ?? []) {
    if (typeof tool !== "string" || tool.trim().length === 0) {
      return { reason: "tool-invalid", detail: "tools must be non-empty opaque ids" };
    }
  }
  for (const policyRef of input.policyRefs ?? []) {
    if (typeof policyRef !== "string" || policyRef.trim().length === 0) {
      return { reason: "policy-ref-invalid", detail: "policyRefs must be non-empty strings" };
    }
  }
  if (input.appearanceSpecText !== null && input.appearanceSpecText !== undefined) {
    if (typeof input.appearanceSpecText !== "string" || input.appearanceSpecText.trim().length === 0) {
      return {
        reason: "appearance-spec-empty",
        detail: "a non-null appearance spec must be a non-empty text (content-addressed at construction)",
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// RealtimeChannelDescriptor 完整性（内容寻址 stream 标签；W7C 车道拥有真实构造）
// ---------------------------------------------------------------------------

/** Returns the integrity refusal reason, or null when the descriptor is sound. */
export function verifyStoryboardRealtimeChannel(
  channel: RealtimeChannelDescriptor,
): string | null {
  if (typeof channel.id !== "string" || channel.id.length === 0) {
    return "channel-id-malformed";
  }
  if (typeof channel.kind !== "string" || channel.kind.trim().length === 0) {
    return "channel-kind-empty";
  }
  if (typeof channel.streamRef !== "string" || channel.streamRef.trim().length === 0) {
    return "stream-ref-empty";
  }
  if (typeof channel.streamHash !== "string" || channel.streamHash.trim().length === 0) {
    return "stream-hash-empty";
  }
  if (typeof channel.latencyClass !== "string" || channel.latencyClass.trim().length === 0) {
    return "latency-class-empty";
  }
  return null;
}
