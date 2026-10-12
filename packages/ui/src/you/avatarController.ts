// YOU Avatar Studio — AvatarStudioController 端口（W7B）。
//
// 边界（docs/you/WORK_ORDERS.md W7B / docs/you/CONTRACTS.md wave-7 freeze）：
// - 本文件只定义 UI 消费的服务端口；embodiment 的 canonical truth 属于 W7A 的
//   EmbodimentService（origin/main PR #30——不在本 base）。UI 不实现领域逻辑。
// - 端口形状镜像 W7A 服务接缝（body registry / soul binding registry /
//   AvatarSession lifecycle + re-possession / 九级具身阶梯 / projection == replay），
//   T7 换绑时逐方法对位。
// - 契约类型一律从 `@zcode/shared` 导入（frozen v7 `you/contract.ts`），禁止本地重声明。
// - Phase 0 的实现是 `avatarSimulatedController.ts` 的确定性剧本；
//   TODO(T7): bind to Worker A 的 embodiment 服务（TL 在 T7 换绑本端口）。
// - BODY/SOUL SEPARATION LAW：附身与再附身只改 session 记录；Body 契约不变
//   （reassignSoul 返回的会话 bodyId 不变，Body 记录绝不因换 Soul 改写）。
import type {
  AgentBody,
  AvatarSession,
  EmbodimentState,
  OpaqueId,
  RealtimeChannelDescriptor,
  SolutionEvent,
  SoulBinding,
  SoulRoutingProfile,
  YouError,
} from "@zcode/shared";

// ---------------------------------------------------------------------------
// 端口请求 / 输入形状（服务端确定其余字段：id / 时间戳 / 状态 / 外观寻址）
// ---------------------------------------------------------------------------

export interface AvatarStudioLoadRequest {
  readonly workspaceKey: string;
}

/**
 * AgentBody 注册 intake（W7A registerBody 同形状；重外观内容绝不内联——
 * appearanceSpecText 由服务端内容寻址，null ⇒ 无外观 Body）。
 */
export interface RegisterAgentBodyInput {
  readonly role: string;
  readonly capabilities: readonly string[];
  readonly tools: readonly string[];
  readonly policyRefs: readonly string[];
  readonly memoryContractRef: string;
  readonly evaluatorContractRef: string;
  readonly appearanceSpecText: string | null;
}

/** SoulBinding 注册 intake（W7A registerSoulBinding 同形状）。 */
export interface RegisterSoulBindingInput {
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: string;
  readonly capabilities: readonly string[];
}

/** 打开 AvatarSession（Body 被 Soul 附身；initialState 缺省 idle）。 */
export interface OpenAvatarSessionInput {
  readonly bodyId: OpaqueId;
  readonly soulBindingId: OpaqueId;
  readonly initialState?: string | null;
}

/** 具身状态转移（append-only embodiment-state-changed 事件驱动）。 */
export interface EmbodimentStateTransitionInput {
  readonly sessionId: OpaqueId;
  readonly nextState: string;
}

export interface AvatarSessionControlInput {
  readonly sessionId: OpaqueId;
}

/** 再附身（soul-reassign）：换 Soul、不换 Body。 */
export interface ReassignSoulInput {
  readonly sessionId: OpaqueId;
  readonly toSoulBindingId: OpaqueId;
}

// ---------------------------------------------------------------------------
// 快照（服务端事实的只读投影；UI 不持有 canonical truth）
// ---------------------------------------------------------------------------

/** session ↔ realtime channel 的确定性绑定投影（信道描述符经 id 引用）。 */
export interface AvatarSessionChannelAssignment {
  readonly sessionId: OpaqueId;
  readonly channelId: OpaqueId;
}

export interface AvatarStudioSnapshot {
  readonly displayName: string;
  /** 表面身份（workspace 级；一个 workspace 一个 avatar 表面）。 */
  readonly studioId: OpaqueId;
  /** Body 注册面（id 升序——Body picker 的数据源）。 */
  readonly bodies: readonly AgentBody[];
  /** SoulBinding 注册面（id 升序——Soul picker 的数据源）。 */
  readonly soulBindings: readonly SoulBinding[];
  /** AvatarSession 头投影（id 升序——状态阶梯投影头）。 */
  readonly sessions: readonly AvatarSession[];
  /** Realtime 信道注册面（id 升序——内容寻址流标签）。 */
  readonly channels: readonly RealtimeChannelDescriptor[];
  /** session ↔ channel 绑定投影（确定性；open 时成对派生）。 */
  readonly sessionChannels: readonly AvatarSessionChannelAssignment[];
  /** 九级具身阶梯分类学（frozen v7 EmbodimentState 全集）。 */
  readonly embodimentStates: readonly EmbodimentState[];
  /** routing profile 分类学（frozen v7：system-one / system-two）。 */
  readonly routingProfiles: readonly SoulRoutingProfile[];
  /** append-only 事件账本投影（v7 四事件 + solution-created）。 */
  readonly events: readonly SolutionEvent[];
  /** Truth law：本快照由确定性模拟管线产生时为 true。 */
  readonly simulated: boolean;
}

// ---------------------------------------------------------------------------
// 端口级 typed error（UI 渲染 truthful 错误态）
// ---------------------------------------------------------------------------

export class AvatarStudioError extends Error {
  readonly youError: YouError;

  constructor(youError: YouError) {
    super(youError.message);
    this.name = "AvatarStudioError";
    this.youError = youError;
  }
}

// ---------------------------------------------------------------------------
// 端口
// ---------------------------------------------------------------------------

/**
 * Avatar Studio 的服务端口。Phase 0 由确定性模拟实现支撑；T7 换绑 W7A 的
 * embodiment 服务。方法走应用服务权威（UI/HTTP/SDK/MCP 同一权威——不存在
 * UI-only 改写路径）。
 */
export interface AvatarStudioController {
  /** Truth law：Phase 0 唯一合法值是 "fixture-simulated"；绝不伪装真实附身。 */
  readonly backing: "fixture-simulated";

  /** 幂等加载：avatar 平面已存在时返回当前快照，不重建。 */
  load(request: AvatarStudioLoadRequest): Promise<AvatarStudioSnapshot>;
  refresh(): Promise<AvatarStudioSnapshot>;

  // -- Body registry（BODY/SOUL SEPARATION LAW：Body 记录不可变） --
  /** 注册 AgentBody（intake 校验 ⇒ YOU_INVALID_STATE；外观内容寻址）。 */
  registerBody(input: RegisterAgentBodyInput): Promise<AgentBody>;

  // -- SoulBinding registry --
  /** 注册 SoulBinding（intake 校验 ⇒ YOU_SOUL_BINDING_INVALID，绝不静默修复）。 */
  registerSoulBinding(input: RegisterSoulBindingInput): Promise<SoulBinding>;

  // -- AvatarSession lifecycle（projected intents） --
  /** 打开会话（未知 Body ⇒ YOU_BODY_NOT_FOUND；未知/非法 Soul ⇒ YOU_SOUL_BINDING_INVALID）。 */
  openSession(input: OpenAvatarSessionInput): Promise<AvatarSession>;
  /** 具身状态转移（阶梯法则 ⇒ YOU_EMBODIMENT_STATE_INVALID；事件驱动投影）。 */
  transitionEmbodimentState(
    input: EmbodimentStateTransitionInput,
  ): Promise<AvatarSession>;
  /** 挂起（active → suspended；state → unavailable——lifecycle 所有）。 */
  suspendSession(input: AvatarSessionControlInput): Promise<AvatarSession>;
  /** 恢复（suspended → active；state → idle）。 */
  resumeSession(input: AvatarSessionControlInput): Promise<AvatarSession>;
  /** 关闭（terminal；state → unavailable；closedAt 落账）。 */
  closeSession(input: AvatarSessionControlInput): Promise<AvatarSession>;
  /** 再附身（soul-reassign；Body 契约不变——session 仅换 soulBindingId）。 */
  reassignSoul(input: ReassignSoulInput): Promise<AvatarSession>;
}

// ---------------------------------------------------------------------------
// 快照选择器（W1B–W6B currentSolutionVersion 等同款模式）
// ---------------------------------------------------------------------------

/** 会话列表（id 升序；ledger read 语义）。 */
export function orderedAvatarSessions(
  snapshot: AvatarStudioSnapshot | null,
): readonly AvatarSession[] {
  if (!snapshot) return [];
  return snapshot.sessions;
}

/** 按 id 解析会话（未知 id → null；UI 显式呈现未知态，不猜测）。 */
export function avatarSessionById(
  snapshot: AvatarStudioSnapshot | null,
  sessionId: string | null,
): AvatarSession | null {
  if (!snapshot || sessionId === null) return null;
  return snapshot.sessions.find((session) => session.id === sessionId) ?? null;
}

/** Body 注册面列表（id 升序）。 */
export function orderedAvatarBodies(
  snapshot: AvatarStudioSnapshot | null,
): readonly AgentBody[] {
  if (!snapshot) return [];
  return snapshot.bodies;
}

/** 按 id 解析 Body（未知 id → null）。 */
export function avatarBodyById(
  snapshot: AvatarStudioSnapshot | null,
  bodyId: string | null,
): AgentBody | null {
  if (!snapshot || bodyId === null) return null;
  return snapshot.bodies.find((body) => body.id === bodyId) ?? null;
}

/** SoulBinding 注册面列表（id 升序）。 */
export function orderedAvatarSoulBindings(
  snapshot: AvatarStudioSnapshot | null,
): readonly SoulBinding[] {
  if (!snapshot) return [];
  return snapshot.soulBindings;
}

/** 按 id 解析 SoulBinding（未知 id → null）。 */
export function avatarSoulBindingById(
  snapshot: AvatarStudioSnapshot | null,
  soulBindingId: string | null,
): SoulBinding | null {
  if (!snapshot || soulBindingId === null) return null;
  return (
    snapshot.soulBindings.find((binding) => binding.id === soulBindingId) ?? null
  );
}

/** 会话被附身中的 SoulBinding（再附身后即新 Soul；未知 → null）。 */
export function soulBindingOfSession(
  snapshot: AvatarStudioSnapshot | null,
  session: AvatarSession | null,
): SoulBinding | null {
  if (!snapshot || !session) return null;
  return avatarSoulBindingById(snapshot, session.soulBindingId);
}

/** 会话被附身中的 Body（BODY/SOUL SEPARATION LAW：再附身后仍是同一 Body）。 */
export function bodyOfSession(
  snapshot: AvatarStudioSnapshot | null,
  session: AvatarSession | null,
): AgentBody | null {
  if (!snapshot || !session) return null;
  return avatarBodyById(snapshot, session.bodyId);
}

/** 某会话的全部 realtime 信道描述符（确定性成对；id 升序）。 */
export function avatarChannelsOfSession(
  snapshot: AvatarStudioSnapshot | null,
  sessionId: string | null,
): readonly RealtimeChannelDescriptor[] {
  if (!snapshot || sessionId === null) return [];
  const channelIds = snapshot.sessionChannels
    .filter((assignment) => assignment.sessionId === sessionId)
    .map((assignment) => assignment.channelId);
  return snapshot.channels
    .filter((channel) => channelIds.includes(channel.id))
    .sort((a, b) => compareOpaqueId(a.id, b.id));
}

function compareOpaqueId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
