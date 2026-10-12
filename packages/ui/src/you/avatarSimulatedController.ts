/* oxlint-disable eslint(max-lines) -- 模拟控制器按 AvatarStudioController 端口逐方法实现（Phase-0 剧本状态机：body/soul 注册 intake 校验 + AvatarSession lifecycle 挂起/恢复/关闭/再附身 + 九级具身阶梯冻结转移表 + realtime 信道确定性派生）；T7 换绑 W7A 的 embodiment 服务后本文件整体退役，拆分只会增加退役成本（W6B learningSimulatedController 同款先例）。 */
// YOU Avatar Studio — 确定性模拟控制器（W7B，Phase 0）。
//
// 这是 `AvatarStudioController` 端口的确定性剧本实现（W7A 的 embodiment 服务在
// origin/main 并行合入；本实现只到 T7 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - 语义逐条镜像 W7A EmbodimentService（dd01f0f）：intake 校验最先、lifecycle
//   转移表、append-only 事件、BODY/SOUL SEPARATION LAW（再附身只改 session 记录，
//   Body 记录绝不改写）、projection == replay；
// - 事件载荷约定镜像 W7A embodimentLedgerOps：suspend/resume 的 status 随
//   embodiment-state-changed 落账（frozen SolutionEventType 无 per-record 状态事件）、
//   close 是终态事件；一切载荷带 simulated: true（truth law）；
// - typed 拒绝（绝不静默修复）：YOU_BODY_NOT_FOUND（unknown-body）、
//   YOU_SOUL_BINDING_INVALID（intake/unknown-soul-binding）、
//   YOU_AVATAR_SESSION_NOT_FOUND（unknown-avatar-session）、
//   YOU_EMBODIMENT_STATE_INVALID（阶梯法则与 lifecycle 终态）、
//   YOU_INVALID_STATE（body intake 形状）；
// - 事件词汇（frozen additive v7）：avatar-session-opened /
//   embodiment-state-changed / soul-reassigned / avatar-session-closed +
//   solution-created。
import type {
  AgentBody,
  AvatarSession,
  OpaqueId,
  RealtimeChannelDescriptor,
  SolutionEvent,
  SolutionEventType,
  SoulBinding,
  YouError,
} from "@zcode/shared";
import {
  AvatarStudioError,
  type AvatarSessionChannelAssignment,
  type AvatarSessionControlInput,
  type AvatarStudioController,
  type AvatarStudioLoadRequest,
  type AvatarStudioSnapshot,
  type EmbodimentStateTransitionInput,
  type OpenAvatarSessionInput,
  type ReassignSoulInput,
  type RegisterAgentBodyInput,
  type RegisterSoulBindingInput,
} from "./avatarController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  AVATAR_STORYBOARD_DEFAULT_OPEN_STATE,
  AVATAR_STORYBOARD_EMBODIMENT_STATES,
  AVATAR_STORYBOARD_RESUMED_STATE,
  AVATAR_STORYBOARD_ROUTING_PROFILES,
  AVATAR_STORYBOARD_SUSPENDED_STATE,
  isStoryboardEmbodimentInteractionState,
  isStoryboardEmbodimentState,
  storyboardEmbodimentTransitionRefusal,
  validateStoryboardAgentBodyInput,
  validateStoryboardSoulBindingInput,
} from "./avatarStoryboardLaws.js";
import {
  AVATAR_STORYBOARD_BODIES,
  AVATAR_STORYBOARD_CHANNEL_KINDS,
  AVATAR_STORYBOARD_DISPLAY_NAME,
  AVATAR_STORYBOARD_SOUL_BINDINGS,
  AVATAR_STORYBOARD_SOLUTION_ID,
  compareStoryboardId,
  storyboardAppearanceBinding,
  storyboardLatencyClassOfRoutingProfile,
  storyboardRealtimeChannel,
} from "./avatarStoryboard.js";

interface SimulatedAvatarState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  bodies: AgentBody[];
  soulBindings: SoulBinding[];
  /** session 头（不可变记录；转移时同 id 替换，绝不原地改写）。 */
  sessions: AvatarSession[];
  channels: RealtimeChannelDescriptor[];
  sessionChannels: AvatarSessionChannelAssignment[];
  events: SolutionEvent[];
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): AvatarStudioError {
  return new AvatarStudioError({ code, message, details, simulated: true });
}

function invalidState(message: string): AvatarStudioError {
  return youError("YOU_INVALID_STATE", message);
}

function invalidStateReason(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): AvatarStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

/** unknown body id ⇒ typed YOU_BODY_NOT_FOUND（绝不猜测）。 */
function unknownBody(bodyId: OpaqueId): AvatarStudioError {
  return youError("YOU_BODY_NOT_FOUND", "unknown agent body", {
    reason: "unknown-body",
    bodyId,
  });
}

/** unknown soul binding id ⇒ typed YOU_SOUL_BINDING_INVALID。 */
function unknownSoulBinding(soulBindingId: OpaqueId): AvatarStudioError {
  return youError("YOU_SOUL_BINDING_INVALID", "unknown soul binding", {
    reason: "unknown-soul-binding",
    soulBindingId,
  });
}

/** 未知会话 id ⇒ typed YOU_AVATAR_SESSION_NOT_FOUND。 */
function unknownAvatarSession(sessionId: OpaqueId): AvatarStudioError {
  return youError("YOU_AVATAR_SESSION_NOT_FOUND", "unknown avatar session", {
    reason: "unknown-avatar-session",
    sessionId,
  });
}

/** 终态锁定：closed 会话的一切后续改写是 typed 拒绝。 */
function terminalRefusal(session: AvatarSession): AvatarStudioError {
  return youError(
    "YOU_EMBODIMENT_STATE_INVALID",
    `avatar session is closed (terminal): ${session.id}`,
    { reason: "session-closed", sessionId: session.id, status: session.status },
  );
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 avatarStudioRegistry）；
 * `load` 幂等：状态存在即复用（avatar 平面是持久 workspace 表面）。
 */
export function createSimulatedAvatarStudioController(): AvatarStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let state: SimulatedAvatarState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean>,
    generator: "agent" | "user" | "fixture" = "agent",
  ): void => {
    if (!state) return;
    state.events = [
      ...state.events,
      {
        id: nextId("fx-avatar-event"),
        solutionId: AVATAR_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-avatar-storyboard",
          generator,
          createdAt: clock.next(),
          lineage: [],
        },
      },
    ];
  };

  const snapshot = (): AvatarStudioSnapshot => {
    if (!state) throw invalidState("avatar studio is not loaded");
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      bodies: [...state.bodies].sort((a, b) => compareStoryboardId(a.id, b.id)),
      soulBindings: [...state.soulBindings].sort((a, b) =>
        compareStoryboardId(a.id, b.id),
      ),
      sessions: [...state.sessions].sort((a, b) => compareStoryboardId(a.id, b.id)),
      channels: [...state.channels].sort((a, b) => compareStoryboardId(a.id, b.id)),
      sessionChannels: [...state.sessionChannels].sort((a, b) =>
        compareStoryboardId(a.sessionId, b.sessionId) !== 0
          ? compareStoryboardId(a.sessionId, b.sessionId)
          : compareStoryboardId(a.channelId, b.channelId),
      ),
      embodimentStates: [...AVATAR_STORYBOARD_EMBODIMENT_STATES],
      routingProfiles: [...AVATAR_STORYBOARD_ROUTING_PROFILES],
      events: state.events,
      simulated: true,
    };
  };

  const bootstrap = (request: AvatarStudioLoadRequest): void => {
    state = {
      studioId: "fx-avatar-studio-001",
      displayName: AVATAR_STORYBOARD_DISPLAY_NAME,
      bodies: AVATAR_STORYBOARD_BODIES.map((body) => ({ ...body })),
      soulBindings: AVATAR_STORYBOARD_SOUL_BINDINGS.map((soul) => ({ ...soul })),
      sessions: [],
      channels: [],
      sessionChannels: [],
      events: [],
    };
    appendEvent(
      "solution-created",
      state.studioId,
      {
        surface: "avatar-studio",
        workspaceKey: request.workspaceKey,
        studioId: state.studioId,
        bodyCount: AVATAR_STORYBOARD_BODIES.length,
        soulBindingCount: AVATAR_STORYBOARD_SOUL_BINDINGS.length,
      },
      "fixture",
    );
  };

  /** 会话解析（未知 id ⇒ YOU_AVATAR_SESSION_NOT_FOUND——typed，绝不猜测）。 */
  const requireSession = (sessionId: OpaqueId): AvatarSession => {
    if (!state) throw invalidState("avatar studio is not loaded");
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      throw unknownAvatarSession(sessionId);
    }
    return session;
  };

  /** 会话头不可变替换（同 id 新记录；绝不原地覆写）。 */
  const replaceSession = (session: AvatarSession): void => {
    if (!state) return;
    state.sessions = state.sessions.map((candidate) =>
      candidate.id === session.id ? session : candidate,
    );
  };

  /** open 时确定性派生该会话的 realtime 信道对（内容寻址流标签）。 */
  const assignSessionChannels = (session: AvatarSession, soul: SoulBinding): void => {
    if (!state) return;
    for (const kind of AVATAR_STORYBOARD_CHANNEL_KINDS) {
      const channel = storyboardRealtimeChannel(
        nextId("fx-avatar-channel"),
        session.id,
        kind,
        storyboardLatencyClassOfRoutingProfile(soul.routingProfile),
      );
      state.channels = [...state.channels, channel];
      state.sessionChannels = [
        ...state.sessionChannels,
        { sessionId: session.id, channelId: channel.id },
      ];
    }
  };

  const controller: AvatarStudioController = {
    backing: "fixture-simulated",

    async load(request) {
      if (!state) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh() {
      return snapshot();
    },

    async registerBody(input: RegisterAgentBodyInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      // intake 校验最先（W7A validateAgentBodyInput 同语义；stateless、无时钟）。
      const refusal = validateStoryboardAgentBodyInput(input);
      if (refusal) {
        throw invalidStateReason(
          "invalid-body-intake",
          `invalid agent body intake: ${refusal.detail}`,
          { refusal: refusal.reason, role: input.role },
        );
      }
      const appearance =
        input.appearanceSpecText === null
          ? { appearanceRef: null, appearanceHash: null }
          : storyboardAppearanceBinding(input.appearanceSpecText);
      const body: AgentBody = {
        id: nextId("fx-avatar-body"),
        role: input.role,
        ...appearance,
        capabilities: [...input.capabilities],
        tools: [...input.tools],
        policyRefs: [...input.policyRefs],
        memoryContractRef: input.memoryContractRef,
        evaluatorContractRef: input.evaluatorContractRef,
      };
      state.bodies = [...state.bodies, body];
      return body;
    },

    async registerSoulBinding(input: RegisterSoulBindingInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      // intake 校验最先（W7A validateSoulBindingInput 同语义；绝不静默修复）。
      const refusal = validateStoryboardSoulBindingInput(input);
      if (refusal) {
        throw youError(
          "YOU_SOUL_BINDING_INVALID",
          `soul binding refused: ${refusal.detail}`,
          { reason: refusal.reason },
        );
      }
      const soulBinding: SoulBinding = {
        id: nextId("fx-avatar-soul"),
        providerKind: input.providerKind,
        modelRef: input.modelRef,
        routingProfile: input.routingProfile as SoulBinding["routingProfile"],
        capabilities: [...new Set(input.capabilities)].sort((a, b) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      };
      state.soulBindings = [...state.soulBindings, soulBinding];
      return soulBinding;
    },

    async openSession(input: OpenAvatarSessionInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      const body = state.bodies.find((candidate) => candidate.id === input.bodyId);
      if (!body) {
        throw unknownBody(input.bodyId);
      }
      const soul = state.soulBindings.find(
        (candidate) => candidate.id === input.soulBindingId,
      );
      if (!soul) {
        throw unknownSoulBinding(input.soulBindingId);
      }
      const initialState = (input.initialState ?? AVATAR_STORYBOARD_DEFAULT_OPEN_STATE) as string;
      if (!isStoryboardEmbodimentState(initialState)) {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          `unknown embodiment state: ${initialState}`,
          { reason: "state-not-on-ladder", state: initialState },
        );
      }
      if (!isStoryboardEmbodimentInteractionState(initialState)) {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          "a session cannot open on the lifecycle-owned unavailable rung",
          { reason: "unavailable-is-lifecycle-owned", state: initialState },
        );
      }
      const session: AvatarSession = {
        id: nextId("fx-avatar-session"),
        bodyId: body.id,
        soulBindingId: soul.id,
        status: "active",
        state: initialState,
        openedAt: clock.next(),
        closedAt: null,
        simulated: true,
      };
      state.sessions = [...state.sessions, session];
      assignSessionChannels(session, soul);
      appendEvent(
        "avatar-session-opened",
        session.id,
        {
          sessionId: session.id,
          bodyId: body.id,
          bodyRole: body.role,
          ...(body.appearanceRef === null ? {} : { bodyAppearanceRef: body.appearanceRef }),
          ...(body.appearanceHash === null ? {} : { bodyAppearanceHash: body.appearanceHash }),
          bodyCapabilityCount: body.capabilities.length,
          bodyToolCount: body.tools.length,
          bodyPolicyRefCount: body.policyRefs.length,
          soulBindingId: soul.id,
          soulProviderKind: soul.providerKind,
          soulModelRef: soul.modelRef,
          soulRoutingProfile: soul.routingProfile,
          soulCapabilityCount: soul.capabilities.length,
          statusAfter: session.status,
          stateAfter: session.state,
          openedAt: session.openedAt,
          simulated: true,
        },
        "user",
      );
      return session;
    },

    async transitionEmbodimentState(input: EmbodimentStateTransitionInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      const current = requireSession(input.sessionId);
      if (current.status === "closed") {
        throw terminalRefusal(current);
      }
      if (current.status === "suspended") {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          "a suspended avatar session refuses activity transitions",
          { reason: "session-suspended", sessionId: current.id, state: current.state },
        );
      }
      if (!isStoryboardEmbodimentState(input.nextState)) {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          `unknown embodiment state: ${input.nextState}`,
          { reason: "state-not-on-ladder", sessionId: current.id, state: input.nextState },
        );
      }
      const refusal = storyboardEmbodimentTransitionRefusal(current.state, input.nextState);
      if (refusal) {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          `refused embodiment transition ${current.state} -> ${input.nextState}: ${refusal}`,
          {
            reason: refusal,
            sessionId: current.id,
            stateBefore: current.state,
            stateAfter: input.nextState,
          },
        );
      }
      const sessionAfter: AvatarSession = { ...current, state: input.nextState };
      replaceSession(sessionAfter);
      appendEvent(
        "embodiment-state-changed",
        sessionAfter.id,
        {
          sessionId: sessionAfter.id,
          stateBefore: current.state,
          stateAfter: sessionAfter.state,
          reason: "activity",
          simulated: true,
        },
        "user",
      );
      return sessionAfter;
    },

    async suspendSession(input: AvatarSessionControlInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      const current = requireSession(input.sessionId);
      if (current.status === "closed") {
        throw terminalRefusal(current);
      }
      if (current.status === "suspended") {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          "avatar session is already suspended",
          { reason: "already-suspended", sessionId: current.id, state: current.state },
        );
      }
      const sessionAfter: AvatarSession = {
        ...current,
        status: "suspended",
        state: AVATAR_STORYBOARD_SUSPENDED_STATE,
      };
      replaceSession(sessionAfter);
      appendEvent(
        "embodiment-state-changed",
        sessionAfter.id,
        {
          sessionId: sessionAfter.id,
          stateBefore: current.state,
          stateAfter: sessionAfter.state,
          statusAfter: sessionAfter.status,
          reason: "suspend",
          simulated: true,
        },
        "user",
      );
      return sessionAfter;
    },

    async resumeSession(input: AvatarSessionControlInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      const current = requireSession(input.sessionId);
      if (current.status === "closed") {
        throw terminalRefusal(current);
      }
      if (current.status === "active") {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          "avatar session is not suspended",
          { reason: "not-suspended", sessionId: current.id, state: current.state },
        );
      }
      const sessionAfter: AvatarSession = {
        ...current,
        status: "active",
        state: AVATAR_STORYBOARD_RESUMED_STATE,
      };
      replaceSession(sessionAfter);
      appendEvent(
        "embodiment-state-changed",
        sessionAfter.id,
        {
          sessionId: sessionAfter.id,
          stateBefore: current.state,
          stateAfter: sessionAfter.state,
          statusAfter: sessionAfter.status,
          reason: "resume",
          simulated: true,
        },
        "user",
      );
      return sessionAfter;
    },

    async reassignSoul(input: ReassignSoulInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      const current = requireSession(input.sessionId);
      if (current.status === "closed") {
        throw terminalRefusal(current);
      }
      const toSoul = state.soulBindings.find(
        (candidate) => candidate.id === input.toSoulBindingId,
      );
      if (!toSoul) {
        throw unknownSoulBinding(input.toSoulBindingId);
      }
      // BODY/SOUL SEPARATION LAW：只换 soulBindingId；bodyId 与 Body 记录不变。
      const fromSoulBindingId = current.soulBindingId;
      const sessionAfter: AvatarSession = { ...current, soulBindingId: toSoul.id };
      replaceSession(sessionAfter);
      appendEvent(
        "soul-reassigned",
        sessionAfter.id,
        {
          sessionId: sessionAfter.id,
          bodyId: sessionAfter.bodyId,
          fromSoulBindingId,
          toSoulBindingId: toSoul.id,
          toSoulProviderKind: toSoul.providerKind,
          toSoulModelRef: toSoul.modelRef,
          toSoulRoutingProfile: toSoul.routingProfile,
          toSoulCapabilityCount: toSoul.capabilities.length,
          statusAfter: sessionAfter.status,
          stateAfter: sessionAfter.state,
          simulated: true,
        },
        "user",
      );
      return sessionAfter;
    },

    async closeSession(input: AvatarSessionControlInput) {
      if (!state) throw invalidState("avatar studio is not loaded");
      const current = requireSession(input.sessionId);
      if (current.status === "closed") {
        throw youError(
          "YOU_EMBODIMENT_STATE_INVALID",
          "avatar session is already closed (terminal)",
          { reason: "already-closed", sessionId: current.id, state: current.state },
        );
      }
      const sessionAfter: AvatarSession = {
        ...current,
        status: "closed",
        state: AVATAR_STORYBOARD_SUSPENDED_STATE,
        closedAt: clock.next(),
      };
      replaceSession(sessionAfter);
      appendEvent(
        "avatar-session-closed",
        sessionAfter.id,
        {
          sessionId: sessionAfter.id,
          statusAfter: sessionAfter.status,
          stateAfter: sessionAfter.state,
          closedAt: sessionAfter.closedAt ?? "",
          simulated: true,
        },
        "user",
      );
      return sessionAfter;
    },
  };

  return controller;
}
