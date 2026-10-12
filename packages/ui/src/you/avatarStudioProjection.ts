// YOU Avatar Studio — 视图纯投影（W7B）。
//
// 只做确定性视图数学：九级具身阶梯（current + visited——visited 由
// embodiment-state-changed 事件流派生，投影、非 UI 猜测）、会话行、Body/Soul
// picker 选项行（内容寻址 appearance 标签——绝不内联内容）、realtime 信道面板行
//（内容寻址 stream 标签 ONLY）、区域 loading/empty 视图模型、键盘转移（与
// Solution/Capture/Twin/Performance/Editing/Learning 表面同级的键盘可用性）、
// 配置草稿与再附身草稿的禁用原因（确定性顺序）。
// 无 DOM、无随机、无计时器（FIXTURES 法则 1/2）。
import type {
  AgentBody,
  AvatarSession,
  AvatarSessionStatus,
  EmbodimentState,
  RealtimeChannelDescriptor,
  SoulBinding,
  SolutionEvent,
} from "@zcode/shared";
import {
  AVATAR_STORYBOARD_EMBODIMENT_STATES,
  AVATAR_STORYBOARD_INTERACTION_STATES,
  isStoryboardEmbodimentInteractionState,
  storyboardEmbodimentStateIndex,
} from "./avatarStoryboardLaws.js";

// ---------------------------------------------------------------------------
// 具身阶梯投影（九级；visited 派生自事件流——状态变化是投影事件，非 UI 本地状态）
// ---------------------------------------------------------------------------

export interface EmbodimentLadderStep {
  readonly state: EmbodimentState;
  /** 本会话事件流中已出现过的档位（含 open 的初始档）。 */
  readonly visited: boolean;
  readonly current: boolean;
}

/**
 * 九级阶梯投影：current 标记投影头；visited 由该会话的
 * embodiment-state-changed 事件 + 打开时刻的初始 state 派生（事实、非猜测）。
 */
export function projectEmbodimentLadder(
  session: AvatarSession | null,
  events: readonly SolutionEvent[] = [],
): readonly EmbodimentLadderStep[] {
  if (!session) {
    return AVATAR_STORYBOARD_EMBODIMENT_STATES.map((state) => ({
      state,
      visited: false,
      current: false,
    }));
  }
  const visited = new Set<EmbodimentState>([session.state]);
  // 会话打开事实：avatar-session-opened 的 stateAfter。
  for (const event of events) {
    if (event.subjectRef !== session.id) continue;
    if (event.type === "avatar-session-opened") {
      const opened = event.payload.stateAfter;
      if (typeof opened === "string") {
        visited.add(opened as EmbodimentState);
      }
    }
    if (event.type === "embodiment-state-changed") {
      const before = event.payload.stateBefore;
      const after = event.payload.stateAfter;
      if (typeof before === "string") {
        visited.add(before as EmbodimentState);
      }
      if (typeof after === "string") {
        visited.add(after as EmbodimentState);
      }
    }
  }
  return AVATAR_STORYBOARD_EMBODIMENT_STATES.map((state) => ({
    state,
    visited: visited.has(state),
    current: state === session.state,
  }));
}

/** 会话按事件流计数的已访问档位数（阶梯覆盖度显示）。 */
export function ladderVisitedCount(
  steps: readonly EmbodimentLadderStep[],
): number {
  return steps.filter((step) => step.visited).length;
}

// ---------------------------------------------------------------------------
// 会话行（lifecycle 显示：status 徽标 + state 档位）
// ---------------------------------------------------------------------------

export interface SessionRow {
  readonly sessionId: string;
  readonly bodyId: string;
  readonly soulBindingId: string;
  readonly status: AvatarSessionStatus;
  readonly state: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly accessibleLabel: string;
}

/** sessions → 展示行（id 升序——快照已排序；此处只做行形状派生）。 */
export function projectSessionRows(
  sessions: readonly AvatarSession[],
): readonly SessionRow[] {
  return sessions.map((session) => ({
    sessionId: session.id,
    bodyId: session.bodyId,
    soulBindingId: session.soulBindingId,
    status: session.status,
    state: session.state,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    accessibleLabel: `session ${session.id}: ${session.status} ${session.state}, body ${session.bodyId} possessed by soul ${session.soulBindingId}, opened ${session.openedAt}${session.closedAt !== null ? `, closed ${session.closedAt}` : ""}`,
  }));
}

/** lifecycle 控件的可用性投影（禁用是显示；服务端独立拒绝——fail closed）。 */
export interface SessionControlAvailability {
  readonly canSuspend: boolean;
  readonly canResume: boolean;
  readonly canClose: boolean;
  readonly canReassign: boolean;
}

export function projectSessionControlAvailability(
  session: AvatarSession | null,
): SessionControlAvailability {
  if (!session) {
    return { canSuspend: false, canResume: false, canClose: false, canReassign: false };
  }
  const active = session.status === "active";
  const suspended = session.status === "suspended";
  return {
    canSuspend: active,
    canResume: suspended,
    canClose: active || suspended,
    canReassign: active || suspended,
  };
}

// ---------------------------------------------------------------------------
// Body / Soul picker 行（内容寻址 appearance 标签；绝不内联内容）
// ---------------------------------------------------------------------------

export interface BodyOptionRow {
  readonly bodyId: string;
  readonly role: string;
  readonly capabilities: readonly string[];
  readonly tools: readonly string[];
  readonly policyRefs: readonly string[];
  readonly memoryContractRef: string;
  readonly evaluatorContractRef: string;
  readonly appearanceRef: string | null;
  readonly appearanceHash: string | null;
  readonly accessibleLabel: string;
}

/** bodies → picker 行（role/capabilities/tools 显示——Body 契约字段）。 */
export function projectBodyOptionRows(
  bodies: readonly AgentBody[],
): readonly BodyOptionRow[] {
  return bodies.map((body) => ({
    bodyId: body.id,
    role: body.role,
    capabilities: [...body.capabilities],
    tools: [...body.tools],
    policyRefs: [...body.policyRefs],
    memoryContractRef: body.memoryContractRef,
    evaluatorContractRef: body.evaluatorContractRef,
    appearanceRef: body.appearanceRef,
    appearanceHash: body.appearanceHash,
    accessibleLabel: `body ${body.id}: role ${body.role}, capabilities ${body.capabilities.join(", ")}, tools ${body.tools.join(", ")}${body.appearanceRef !== null ? `, appearance ${body.appearanceRef} (${body.appearanceHash})` : ", no stored appearance"}`,
  }));
}

export interface SoulOptionRow {
  readonly soulBindingId: string;
  readonly providerKind: string;
  readonly modelRef: string;
  readonly routingProfile: string;
  readonly capabilities: readonly string[];
  readonly accessibleLabel: string;
}

/** soulBindings → picker 行（providerKind/modelRef/routingProfile 显示）。 */
export function projectSoulOptionRows(
  soulBindings: readonly SoulBinding[],
): readonly SoulOptionRow[] {
  return soulBindings.map((soul) => ({
    soulBindingId: soul.id,
    providerKind: soul.providerKind,
    modelRef: soul.modelRef,
    routingProfile: soul.routingProfile,
    capabilities: [...soul.capabilities],
    accessibleLabel: `soul ${soul.id}: ${soul.providerKind} ${soul.modelRef}, routing ${soul.routingProfile}, capabilities ${soul.capabilities.join(", ")}`,
  }));
}

// ---------------------------------------------------------------------------
// Realtime 信道面板行（内容寻址流标签 ONLY——绝不内联流内容）
// ---------------------------------------------------------------------------

export interface ChannelPanelRow {
  readonly channelId: string;
  readonly kind: string;
  readonly streamRef: string;
  readonly streamHash: string;
  readonly latencyClass: string;
  readonly accessibleLabel: string;
}

/** channels → 面板行（content-addressed stream 标签 + latency class）。 */
export function projectChannelPanelRows(
  channels: readonly RealtimeChannelDescriptor[],
): readonly ChannelPanelRow[] {
  return channels.map((channel) => ({
    channelId: channel.id,
    kind: channel.kind,
    streamRef: channel.streamRef,
    streamHash: channel.streamHash,
    latencyClass: channel.latencyClass,
    accessibleLabel: `channel ${channel.id}: ${channel.kind} stream ${channel.streamRef} (${channel.streamHash}), latency class ${channel.latencyClass}`,
  }));
}

// ---------------------------------------------------------------------------
// 区域视图模型（每个面板区域的 loading / empty / ready）
// ---------------------------------------------------------------------------

export type AvatarRegionView = "loading" | "empty" | "ready";

/** 列表区域的确定性视图模型（无快照 → loading；有快照无数据 → empty）。 */
export function projectListRegionView(
  hasSnapshot: boolean,
  count: number,
): AvatarRegionView {
  if (!hasSnapshot) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

// ---------------------------------------------------------------------------
// 键盘转移（与兄弟表面一致的键盘导航可用性）
// ---------------------------------------------------------------------------

export type AvatarListKeyboardAction =
  | { readonly kind: "move"; readonly delta: number }
  | { readonly kind: "select" }
  | { readonly kind: "none" };

/**
 * 会话列表的键盘转移表：
 * - ArrowUp / ArrowLeft：上移；ArrowDown / ArrowRight：下移；
 * - Home / End：首/末项；Enter：选中当前会话（检视详情）；
 * - 其余键 no-op。
 */
export function resolveAvatarKeyboardTransition(
  key: string,
  state: { readonly totalSessions: number },
): AvatarListKeyboardAction {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { kind: "move", delta: -1 };
    case "ArrowDown":
    case "ArrowRight":
      return { kind: "move", delta: 1 };
    case "Home":
      return { kind: "move", delta: -state.totalSessions };
    case "End":
      return { kind: "move", delta: state.totalSessions };
    case "Enter":
      return { kind: "select" };
    default:
      return { kind: "none" };
  }
}

/** 会话光标夹紧（0..total-1；total 为 0 时归 0）。 */
export function clampSessionIndex(index: number, totalSessions: number): number {
  if (totalSessions <= 0) return 0;
  return Math.min(totalSessions - 1, Math.max(0, index));
}

// ---------------------------------------------------------------------------
// 配置草稿（Body/Soul 挑选 + 打开意图的纯视图模型）
// ---------------------------------------------------------------------------

export interface ConfigurationDraftView {
  readonly bodyId: string | null;
  readonly soulBindingId: string | null;
  /** 打开按钮禁用原因（null = 可打开）。 */
  readonly disabledReason: "no-body" | "no-soul" | null;
}

/** 草稿 → 打开区视图模型（禁用原因确定性：body → soul 顺序）。 */
export function projectConfigurationDraftView(draft: {
  readonly bodyId: string | null;
  readonly soulBindingId: string | null;
}): ConfigurationDraftView {
  let disabledReason: ConfigurationDraftView["disabledReason"] = null;
  if (draft.bodyId === null) {
    disabledReason = "no-body";
  } else if (draft.soulBindingId === null) {
    disabledReason = "no-soul";
  }
  return { ...draft, disabledReason };
}

// ---------------------------------------------------------------------------
// 再附身草稿（re-possession 流的纯视图模型）
// ---------------------------------------------------------------------------

export interface ReassignmentDraftView {
  readonly sessionId: string | null;
  readonly toSoulBindingId: string | null;
  /** 再附身按钮禁用原因（null = 可执行）。 */
  readonly disabledReason: "no-session" | "no-soul" | "same-soul" | null;
}

/** 再附身草稿 → 视图模型（确定性顺序：session → soul → 自身相同拒绝）。 */
export function projectReassignmentDraftView(
  draft: {
    readonly sessionId: string | null;
    readonly toSoulBindingId: string | null;
  },
  currentSoulBindingId: string | null,
): ReassignmentDraftView {
  let disabledReason: ReassignmentDraftView["disabledReason"] = null;
  if (draft.sessionId === null) {
    disabledReason = "no-session";
  } else if (draft.toSoulBindingId === null) {
    disabledReason = "no-soul";
  } else if (
    currentSoulBindingId !== null &&
    currentSoulBindingId === draft.toSoulBindingId
  ) {
    disabledReason = "same-soul";
  }
  return { ...draft, disabledReason };
}

// ---------------------------------------------------------------------------
// 阶梯转移可用性（interaction rungs；纯投影——服务端独立拒绝）
// ---------------------------------------------------------------------------

export interface LadderTransitionAvailability {
  readonly state: EmbodimentState;
  /** 点击即投射转移意图；unavailable 归 lifecycle 所有（不提供点击）。 */
  readonly offered: boolean;
  readonly disabled: boolean;
}

/**
 * 阶梯转移按钮可用性：仅 interaction rungs 提供；当前档禁用（自环 =
 * no-op-transition typed 拒绝）；会话非 active 时全部禁用（suspended/closed 拒绝）。
 */
export function projectLadderTransitionAvailability(
  session: AvatarSession | null,
): readonly LadderTransitionAvailability[] {
  return AVATAR_STORYBOARD_INTERACTION_STATES.map((state) => ({
    state,
    offered: isStoryboardEmbodimentInteractionState(state),
    disabled:
      session === null ||
      session.status !== "active" ||
      session.state === state,
  }));
}

/** 会话事件流尾部（确定性：最近 N 条，倒序时间显示）。 */
export function projectSessionEventTail(
  events: readonly SolutionEvent[],
  sessionId: string | null,
  limit: number,
): readonly SolutionEvent[] {
  if (sessionId === null) return [];
  return events
    .filter((event) => event.subjectRef === sessionId)
    .slice(-limit)
    .reverse();
}

/** 阶梯档位的规范序排序键（显示稳定）。 */
export function embodimentOrderKey(state: string): number {
  return storyboardEmbodimentStateIndex(state);
}
