/* oxlint-disable eslint(max-lines) -- demo 驱动器是单 switch 的 golden 序列状态机（22 步 × 每步确定性 summary 即 golden 期望——拆分只会让 golden 序列跨模块碎片化、增加 T7 换绑时的对照成本，W6B 同款先例）；T7 换绑 W7A 的 embodiment 服务后本文件整体退役。 */
// YOU Avatar Studio — 确定性 operator demo 驱动器（W7B）。
//
// 覆盖 W7B 验收的完整 v7 箭头（W7A fixture 场景的 UI 侧镜像）：Body/Soul 挑选 →
// 诚实 YOU_SOUL_BINDING_INVALID / YOU_INVALID_STATE intake 拒绝 → 未知 Body
// YOU_BODY_NOT_FOUND → 会话打开（active/idle + 信道派生）→ 阶梯行走（活动事件）→
// 阶梯法则拒绝（自环 / unavailable lifecycle 所有 / 越界档位）→ 挂起（status 随账）→
// 挂起期间拒绝 → 恢复 → 再附身（Body 契约不变断言）→ realtime 信道显示 →
// 关闭（终态）→ 终态拒绝 → 未知会话 YOU_AVATAR_SESSION_NOT_FOUND → 第二会话 →
// 注册面扩展（body/soul intake 投射意图）。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  AvatarStudioError,
  type AvatarStudioController,
  type AvatarStudioSnapshot,
} from "./avatarController.js";
import type { AvatarDemoStep, AvatarDemoStepId } from "./avatarStudioDemoSteps.js";
export {
  AVATAR_DEMO_STEPS,
  AVATAR_DEMO_TOTAL_STEPS,
  type AvatarDemoStep,
  type AvatarDemoStepId,
} from "./avatarStudioDemoSteps.js";
import type { AvatarPanelId } from "./avatarStudioStore.js";
import { avatarChannelsOfSession } from "./avatarController.js";
import {
  AVATAR_STORYBOARD_BODIES,
  AVATAR_STORYBOARD_SOUL_BINDINGS,
} from "./avatarStoryboard.js";

/** 步骤对视图状态的提示（由 useAvatarStudio 应用；驱动器不直接写 store）。 */
export interface AvatarDemoUiHint {
  readonly panel?: AvatarPanelId;
  readonly selectedBodyId?: string | null;
  readonly selectedSoulBindingId?: string | null;
  readonly selectedSessionId?: string | null;
}

export interface AvatarDemoStepOutcome {
  readonly stepId: AvatarDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（会话 / 信道 / body / soul 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: AvatarDemoUiHint;
}

function outcome(
  stepId: AvatarDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: AvatarDemoUiHint = {},
): AvatarDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<AvatarStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof AvatarStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed AvatarStudioError, but the operation succeeded");
}

function requireSessionOf(
  snapshot: AvatarStudioSnapshot,
  index: number,
): string {
  const session = snapshot.sessions[index];
  if (!session) throw new Error(`demo: session at index ${index} missing`);
  return session.id;
}

/**
 * 执行一步剧本。控制器必须已 load（load 步骤负责）。每步只做确定性操作；
 * 非预期错误直接上抛（预期 typed error 由 expectTypedError 诚实记录）。
 */
export async function runAvatarDemoStep(
  controller: AvatarStudioController,
  demoStep: AvatarDemoStep,
): Promise<AvatarDemoStepOutcome> {
  switch (demoStep.id) {
    case "load": {
      // 首步负责加载（与 W1B–W6B demo 首步同款职责）。
      const snapshot = await controller.load({ workspaceKey: "you-w7b-avatar-demo" });
      return outcome(
        "load",
        `Avatar plane loaded (${snapshot.studioId}, ${snapshot.bodies.length} bodies, ${snapshot.soulBindings.length} soul bindings, ${snapshot.embodimentStates.length} frozen rungs). The registries render from the controller projection — the UI owns none of them.`,
        [snapshot.studioId],
        { panel: "configuration" },
      );
    }
    case "body-pick": {
      const snapshot = await controller.refresh();
      const body = snapshot.bodies[0] ?? AVATAR_STORYBOARD_BODIES[0]!;
      return outcome(
        "body-pick",
        `Body ${body.id} picked: role "${body.role}", capabilities ${body.capabilities.join("/")}, tools ${body.tools.join("/")}${body.appearanceRef !== null ? `, appearance ${body.appearanceRef} (${body.appearanceHash})` : ", no stored appearance"}. Content-addressed labels only — appearance content is never inlined.`,
        [body.id],
        { panel: "configuration", selectedBodyId: body.id },
      );
    }
    case "soul-pick": {
      const snapshot = await controller.refresh();
      const soul = snapshot.soulBindings[0] ?? AVATAR_STORYBOARD_SOUL_BINDINGS[0]!;
      return outcome(
        "soul-pick",
        `Soul ${soul.id} picked: ${soul.providerKind} ${soul.modelRef}, routing profile ${soul.routingProfile} (system-one is fast/reactive, system-two is deep/deliberate — profiles, not fixed model identities).`,
        [soul.id],
        { panel: "configuration", selectedSoulBindingId: soul.id },
      );
    }
    case "soul-intake-invalid": {
      // 预期 typed error：越界 routing profile ⇒ YOU_SOUL_BINDING_INVALID（stateless）。
      const error = await expectTypedError(() =>
        controller.registerSoulBinding({
          providerKind: "open-weights-llm",
          modelRef: "fixture/invalid-intake",
          routingProfile: "system-three",
          capabilities: ["chat"],
        }),
      );
      return outcome(
        "soul-intake-invalid",
        `${error.youError.code}: ${error.youError.message} — the stateless validator refuses off-ladder routing profiles before anything is journaled; nothing is silently repaired.`,
        [],
        { panel: "configuration" },
      );
    }
    case "body-intake-invalid": {
      // 预期 typed error：空 role ⇒ YOU_INVALID_STATE（role-empty）。
      const error = await expectTypedError(() =>
        controller.registerBody({
          role: "   ",
          capabilities: ["chat"],
          tools: ["tool-x"],
          policyRefs: ["policy:demo"],
          memoryContractRef: "contract:demo/memory",
          evaluatorContractRef: "contract:demo/evaluator",
          appearanceSpecText: null,
        }),
      );
      return outcome(
        "body-intake-invalid",
        `${error.youError.code}: ${error.youError.message} — the body registry refuses an empty role intake; the UI shows the typed panel instead of repairing the draft.`,
        [],
        { panel: "configuration" },
      );
    }
    case "body-not-found": {
      // 预期 typed error：未知 body id ⇒ YOU_BODY_NOT_FOUND。
      const error = await expectTypedError(() =>
        controller.openSession({
          bodyId: "fx-avatar-body-999",
          soulBindingId: "fx-avatar-soul-001",
          initialState: null,
        }),
      );
      return outcome(
        "body-not-found",
        `${error.youError.code}: ${error.youError.message} — bodies are addressed by immutable registry ids; an unknown id is a typed refusal, never a guess.`,
        [],
        { panel: "configuration" },
      );
    }
    case "session-open": {
      const session = await controller.openSession({
        bodyId: "fx-avatar-body-001",
        soulBindingId: "fx-avatar-soul-001",
        initialState: null,
      });
      return outcome(
        "session-open",
        `Session ${session.id} opened: body ${session.bodyId} possessed by soul ${session.soulBindingId}, status ${session.status}, state ${session.state} (default open rung idle). avatar-session-opened appended; two realtime channels derived deterministically.`,
        [session.id],
        { panel: "embodiment", selectedSessionId: session.id },
      );
    }
    case "ladder-walk": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      await controller.transitionEmbodimentState({
        sessionId,
        nextState: "listening",
      });
      await controller.transitionEmbodimentState({
        sessionId,
        nextState: "typing",
      });
      const toolUse = await controller.transitionEmbodimentState({
        sessionId,
        nextState: "tool_use",
      });
      return outcome(
        "ladder-walk",
        `Ladder walked idle → listening → typing → tool_use (session ${sessionId}, now ${toolUse.state}). Each step appended an embodiment-state-changed event — the visited rungs render from those events, never from UI-local state.`,
        [sessionId],
        { panel: "embodiment", selectedSessionId: sessionId },
      );
    }
    case "self-loop-refused": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const current = snapshot.sessions[0]!;
      const error = await expectTypedError(() =>
        controller.transitionEmbodimentState({
          sessionId,
          nextState: current.state,
        }),
      );
      return outcome(
        "self-loop-refused",
        `${error.youError.code}: ${error.youError.message} — a state change must change the state; the self-loop is a typed no-op-transition refusal.`,
        [],
        { panel: "embodiment", selectedSessionId: sessionId },
      );
    }
    case "unavailable-refused": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const error = await expectTypedError(() =>
        controller.transitionEmbodimentState({
          sessionId,
          nextState: "unavailable",
        }),
      );
      return outcome(
        "unavailable-refused",
        `${error.youError.code}: ${error.youError.message} — the unavailable rung is lifecycle-owned (suspend/close enter it, resume leaves it); activity transitions can never reach it.`,
        [],
        { panel: "embodiment", selectedSessionId: sessionId },
      );
    }
    case "unknown-state-refused": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const error = await expectTypedError(() =>
        controller.transitionEmbodimentState({
          sessionId,
          nextState: "levitating",
        }),
      );
      return outcome(
        "unknown-state-refused",
        `${error.youError.code}: ${error.youError.message} — off-ladder states are refused typed; the nine-state taxonomy is frozen v7.`,
        [],
        { panel: "embodiment", selectedSessionId: sessionId },
      );
    }
    case "session-suspend": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const session = await controller.suspendSession({ sessionId });
      return outcome(
        "session-suspend",
        `Session ${sessionId} suspended: status ${session.status}, state ${session.state} (lifecycle-owned rung). The embodiment-state-changed event carries statusAfter so the projection stays replayable.`,
        [sessionId],
        { panel: "session", selectedSessionId: sessionId },
      );
    }
    case "suspended-refused": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const error = await expectTypedError(() =>
        controller.transitionEmbodimentState({
          sessionId,
          nextState: "speaking",
        }),
      );
      return outcome(
        "suspended-refused",
        `${error.youError.code}: ${error.youError.message} — a suspended session refuses activity transitions; resume first.`,
        [],
        { panel: "embodiment", selectedSessionId: sessionId },
      );
    }
    case "session-resume": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const session = await controller.resumeSession({ sessionId });
      return outcome(
        "session-resume",
        `Session ${sessionId} resumed: status ${session.status}, state ${session.state} (return to rest). Resume is a projected intent — the event log records the round trip.`,
        [sessionId],
        { panel: "session", selectedSessionId: sessionId },
      );
    }
    case "soul-reassign": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const before = snapshot.sessions[0]!;
      const bodyBefore = snapshot.bodies.find((body) => body.id === before.bodyId)!;
      const session = await controller.reassignSoul({
        sessionId,
        toSoulBindingId: "fx-avatar-soul-002",
      });
      const after = await controller.refresh();
      const bodyAfter = after.bodies.find((body) => body.id === session.bodyId)!;
      if (JSON.stringify(bodyBefore) !== JSON.stringify(bodyAfter)) {
        throw new Error("demo: body record changed across soul reassignment");
      }
      return outcome(
        "soul-reassign",
        `Session ${sessionId} re-possessed: soul ${before.soulBindingId} → ${session.soulBindingId}; the Body contract display stays byte-identical (${session.bodyId}, role "${bodyAfter.role}") — the body/soul separation law holds by construction.`,
        [sessionId, session.soulBindingId],
        { panel: "session", selectedSessionId: sessionId },
      );
    }
    case "realtime-channels": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const channels = avatarChannelsOfSession(snapshot, sessionId);
      const labels = channels
        .map((channel) => `${channel.kind}@${channel.latencyClass} ${channel.streamRef}`)
        .join(" · ");
      return outcome(
        "realtime-channels",
        `${channels.length} realtime channels for session ${sessionId}: ${labels}. Stream references are content-addressed (streamRef + streamHash labels only); the W7C lane owns the real channel construction.`,
        [sessionId, ...channels.map((channel) => channel.id)],
        { panel: "realtime", selectedSessionId: sessionId },
      );
    }
    case "session-close": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const session = await controller.closeSession({ sessionId });
      return outcome(
        "session-close",
        `Session ${sessionId} closed: status ${session.status}, state ${session.state}, closedAt ${session.closedAt ?? "n/a"}. avatar-session-closed appended — the terminal is stamped.`,
        [sessionId],
        { panel: "session", selectedSessionId: sessionId },
      );
    }
    case "closed-terminal": {
      const snapshot = await controller.refresh();
      const sessionId = requireSessionOf(snapshot, 0);
      const error = await expectTypedError(() =>
        controller.transitionEmbodimentState({
          sessionId,
          nextState: "idle",
        }),
      );
      return outcome(
        "closed-terminal",
        `${error.youError.code}: ${error.youError.message} — closed sessions are terminal; every further mutation is a typed refusal (no zombie path).`,
        [],
        { panel: "session", selectedSessionId: sessionId },
      );
    }
    case "session-not-found": {
      const error = await expectTypedError(() =>
        controller.transitionEmbodimentState({
          sessionId: "fx-avatar-session-999",
          nextState: "idle",
        }),
      );
      return outcome(
        "session-not-found",
        `${error.youError.code}: ${error.youError.message} — unknown session ids are typed refusals; the UI renders the typed error panel instead of guessing.`,
        [],
        { panel: "session" },
      );
    }
    case "second-session": {
      const session = await controller.openSession({
        bodyId: "fx-avatar-body-002",
        soulBindingId: "fx-avatar-soul-003",
        initialState: "listening",
      });
      return outcome(
        "second-session",
        `Session ${session.id} opened on body ${session.bodyId} with soul ${session.soulBindingId} at the listening rung (initialState intake). Each session owns its own ladder head and channel pair.`,
        [session.id],
        { panel: "embodiment", selectedSessionId: session.id },
      );
    }
    case "body-register": {
      const body = await controller.registerBody({
        role: "notebook-curator",
        capabilities: ["index", "retrieve"],
        tools: ["tool-notebook"],
        policyRefs: ["policy:demo/curator"],
        memoryContractRef: "contract:demo/memory",
        evaluatorContractRef: "contract:demo/evaluator",
        appearanceSpecText: "portrait-neutral-curator",
      });
      return outcome(
        "body-register",
        `Body ${body.id} registered (role "${body.role}"): an immutable record joined the registry; the appearance is content-addressed (${body.appearanceRef}) and never inlined.`,
        [body.id],
        { panel: "configuration", selectedBodyId: body.id },
      );
    }
    case "soul-register": {
      const soul = await controller.registerSoulBinding({
        providerKind: "open-weights-llm",
        modelRef: "fixture/registered-soul",
        routingProfile: "system-one",
        capabilities: ["chat", "tool-use", "vision"],
      });
      return outcome(
        "soul-register",
        `Soul ${soul.id} registered (${soul.providerKind} ${soul.modelRef}, routing ${soul.routingProfile}): validated intake joins the binding registry — the pickers render it like any fixture binding.`,
        [soul.id],
        { panel: "configuration", selectedSoulBindingId: soul.id },
      );
    }
  }
}
