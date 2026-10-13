/* oxlint-disable eslint(max-lines) -- 模拟控制器按 EscalationStudioController 端口逐方法实现（Phase-0 剧本状态机：gap 记录 + v1 升级阶梯转移表 + 授权生命周期（不可变账本：grant/withdrawal 皆新记录）+ live 授权门固定序求值 + run 阶梯 append-only + provider fail-closed 调用 + ToolGap/Knowledge 投影）；T8 换绑 Worker A 的 arena 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Escalation Studio — 确定性模拟控制器（W8B，Phase 0）。
//
// 这是 `EscalationStudioController` 端口的确定性剧本实现（W8A 的 arena 服务在并行
// wave 合入；本实现只到 T8 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock
//   （统一经 tick() 包装——消费计数使 live 门的「now」锚定确定性，绝不 Date.now）；
// - GAP PERSISTENCE LAW：CapabilityGap 记录不可变（升级引用经不可变替换同步——
//   同 id 新记录，绝不原地覆写）；run 阶梯 append-only（每 run started → 终态锁定，
//   终态后再迁移是 typed 拒绝；完成记录含 completedAt + outcomeEvidenceRef）；未知
//   run ⇒ YOU_ARENA_RUN_NOT_FOUND；
// - ESCALATION AUTHORIZATION LAW：授权账本 append-only——grant 与 withdrawal 都
//   是新记录（frozen EscalationAuthorization 形状不动；kind/supersedes 链接是账本
//   语义）；过期是 live 门对不可变 grant 的求值（续期 = 新 grant 记录）；撤回后
//   live grant 失效，再走授权门即 YOU_ESCALATION_AUTHORIZATION_REQUIRED（fail
//   closed；求值固定序 missing → withdrawn → expired → scope-mismatch）；
// - ARENA LEARNING PERMISSION LAW：learning-permission-recorded 事件在每次
//   grant/withdrawal 时诚实落账（withdrawal 记 none + withdrawal 标记——升级派生
//   信号进入学习机前的显式许可面）；
// - ARENA BOUNDARY LAW：provider 调用返回 typed ArenaExpertResult（分类派生；
//   artifact 结果带内容寻址标签），经 applyExpertResult 由 YOU 自身权威应用
//   （arena-result-applied + 派生 appliesAsChangeSetId）；未知 provider fail
//   closed ⇒ YOU_ARENA_ADAPTER_UNSUPPORTED；
// - v1 阶梯（requested → authorized → in-progress → delivered → applied |
//   rejected | cancelled）按转移表强制；非法迁移 ⇒ YOU_ESCALATION_STATE_INVALID；
//   未知 escalation ⇒ YOU_ESCALATION_NOT_FOUND；delivered → rejected 是服务端
//   终态（frozen 事件词汇无 escalation-rejected 类型——与 W6B candidate 前置状态
//   同款披露，不伪造事件）；
// - 事件词汇（frozen additive wave-8）：capability-gap-detected /
//   arena-escalation-requested / escalation-authorized / escalation-cancelled /
//   learning-permission-recorded / gap-projection-published / arena-run-recorded
//   （run 完成同型落账）+ arena-result-applied + solution-created。
import type {
  ArenaEscalationRef,
  ArenaExpertResult,
  ArenaRun,
  CapabilityGap,
  CapabilityGapCategory,
  EscalationAuthorization,
  KnowledgeGapProjection,
  OpaqueId,
  SolutionEvent,
  SolutionEventType,
  ToolGapProjection,
  YouError,
} from "@zcode/shared";
import {
  EscalationStudioError,
  type ApplyExpertResultInput,
  type CancelEscalationInput,
  type CompleteArenaRunInput,
  type EscalationAuthorizationEntry,
  type EscalationAuthorizationLive,
  type EscalationGapSpecView,
  type EscalationStudioController,
  type EscalationStudioLoadRequest,
  type EscalationStudioSnapshot,
  type EscalationView,
  type GrantEscalationAuthorizationInput,
  type InvokeArenaProviderInput,
  type OpenCapabilityGapInput,
  type PublishGapProjectionInput,
  type RequestEscalationInput,
  type StartArenaRunInput,
  type ValidateRetryPolicyInput,
  type WithdrawEscalationAuthorizationInput,
} from "./escalationController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  evaluateStoryboardAuthorizationGate,
  isLegalStoryboardEscalationTransition,
  isTerminalStoryboardEscalationStatus,
  isWellFormedStoryboardGap,
  validateStoryboardAuthorizationIntake,
  validateStoryboardGapProjectionRequest,
  validateStoryboardGapRecord,
  validateStoryboardRetryPolicy,
} from "./escalationStoryboardLaws.js";
import {
  ESCALATION_STORYBOARD_BACKOFF_CLASSES,
  ESCALATION_STORYBOARD_CATEGORIES,
  ESCALATION_STORYBOARD_DISPLAY_NAME,
  ESCALATION_STORYBOARD_GAP_SPECS,
  ESCALATION_STORYBOARD_LEARNING_PERMISSIONS,
  ESCALATION_STORYBOARD_MINIMUM_CONTEXT,
  ESCALATION_STORYBOARD_PROVIDERS,
  ESCALATION_STORYBOARD_RETRY_POLICY,
  ESCALATION_STORYBOARD_SCOPE_PRESETS,
  ESCALATION_STORYBOARD_SOLUTION_ID,
  STORYBOARD_KNOWLEDGE_DOMAIN,
  STORYBOARD_TOOL_DOMAIN,
  compareStoryboardId,
  storyboardAttemptedStrategies,
  storyboardChangeSetId,
  storyboardContentBinding,
  storyboardExpertResult,
  storyboardGapFailureEvidence,
  storyboardGapSpecById,
} from "./escalationStoryboard.js";

interface SimulatedEscalationState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  gaps: CapabilityGap[];
  /** gapId → in-scope 授权范围（spec 落账时冻结；W8A 服务侧持久化的剧本镜像）。 */
  gapScopes: Map<string, string>;
  runs: ArenaRun[];
  escalations: EscalationView[];
  authorizationLedger: EscalationAuthorizationEntry[];
  toolProjections: ToolGapProjection[];
  knowledgeProjections: KnowledgeGapProjection[];
  events: SolutionEvent[];
}

/** 剧本用户（授权人——ESCALATION AUTHORIZATION LAW 的显式授予主体）。 */
const STORYBOARD_USER_ID = "fx-user-aria-001";

/** 与 solutionStoryboard.ts 私有纪元一致的镜像字面量（时钟锚）。 */
const STORYBOARD_EPOCH_MS = Date.UTC(2025, 5, 2, 9, 0, 0, 0);

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): EscalationStudioError {
  return new EscalationStudioError({ code, message, details, simulated: true });
}

function invalidState(message: string): EscalationStudioError {
  return youError("YOU_INVALID_STATE", message);
}

function invalidStateReason(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): EscalationStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 escalationStudioRegistry）；
 * `load` 幂等：状态存在即复用（escalation 平面是持久 workspace 表面）。
 */
export function createSimulatedEscalationStudioController(): EscalationStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let consumedTicks = 0;
  let state: SimulatedEscalationState | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  /** 全部时间戳统一入口（消费计数 → live 门的「now」锚定确定性）。 */
  const tick = (): string => {
    consumedTicks += 1;
    return clock.next();
  };

  /** 确定性「当前时刻」＝下一次 tick 的值（纪元 + 已消费 tick 秒；非 Date.now）。 */
  const clockNow = (): string =>
    new Date(STORYBOARD_EPOCH_MS + consumedTicks * 1000).toISOString();

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
        id: nextId("fx-escalation-event"),
        solutionId: ESCALATION_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: tick(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-escalation-storyboard",
          generator,
          createdAt: tick(),
          lineage: [],
        },
      },
    ];
  };

  // -------------------------------------------------------------------------
  // 账本解析 / 不可变替换（W6B replaceRecord 同款：同 id 新记录，绝不覆写）
  // -------------------------------------------------------------------------

  const requireGap = (gapId: OpaqueId): CapabilityGap => {
    if (!state) throw invalidState("escalation studio is not loaded");
    const gap = state.gaps.find((candidate) => candidate.id === gapId);
    if (!gap) {
      throw invalidStateReason("unknown-gap-record", `capability gap ${gapId} not found`, {
        gapId,
      });
    }
    return gap;
  };

  const requireEscalation = (escalationId: OpaqueId): EscalationView => {
    if (!state) throw invalidState("escalation studio is not loaded");
    const escalation = state.escalations.find(
      (candidate) => candidate.escalationId === escalationId,
    );
    if (!escalation) {
      throw youError(
        "YOU_ESCALATION_NOT_FOUND",
        `arena escalation ${escalationId} not found`,
        { reason: "unknown-escalation", escalationId },
      );
    }
    return escalation;
  };

  const replaceEscalation = (next: EscalationView): void => {
    if (!state) return;
    state.escalations = state.escalations.map((candidate) =>
      candidate.escalationId === next.escalationId ? next : candidate,
    );
  };

  /** gap 记录的升级引用同步（不可变替换：阶梯/专家结果变化 → 新 gap 记录）。 */
  const replaceGapEscalationRef = (
    gapId: OpaqueId,
    ref: ArenaEscalationRef,
    eligibility?: CapabilityGap["escalationEligibility"],
  ): CapabilityGap => {
    if (!state) throw invalidState("escalation studio is not loaded");
    const gap = requireGap(gapId);
    const next: CapabilityGap = {
      ...gap,
      escalationEligibility: eligibility ?? gap.escalationEligibility,
      arenaEscalationRef: ref,
    };
    state.gaps = state.gaps.map((candidate) => (candidate.id === gapId ? next : candidate));
    return next;
  };

  const replaceRun = (run: ArenaRun): void => {
    if (!state) return;
    state.runs = state.runs.map((candidate) => (candidate.id === run.id ? run : candidate));
  };

  /** escalation 的活跃（started 未终态）run；无 → null。 */
  const activeRunOfEscalation = (escalation: EscalationView): ArenaRun | null =>
    state?.runs.find((run) => run.gapId === escalation.gapId && run.status === "started") ??
    null;

  // -------------------------------------------------------------------------
  // live 授权投影 + 授权门强制（服务端事实；UI 门显示与之同源——独立强制）
  // -------------------------------------------------------------------------

  const liveAuthorizationOf = (escalationId: OpaqueId): EscalationAuthorizationLive => {
    if (!state) throw invalidState("escalation studio is not loaded");
    const entries = state.authorizationLedger.filter(
      (entry) => entry.record.escalationId === escalationId,
    );
    const grants = entries.filter((entry) => entry.kind === "grant");
    const superseded = new Set(
      entries
        .filter((entry) => entry.kind === "withdrawal")
        .map((entry) => entry.supersedesRecordId),
    );
    const liveGrant = grants.at(-1) ?? null;
    const withdrawn = liveGrant !== null && superseded.has(liveGrant.record.id);
    return {
      escalationId,
      record: liveGrant === null ? null : { ...liveGrant.record },
      withdrawn,
      learningPermission: withdrawn
        ? "none"
        : (liveGrant?.record.learningPermission ?? "none"),
    };
  };

  /**
   * 授权门求值（服务端强制面；固定序 missing → withdrawn → expired → scope）。
   * policy.requiresAuthorization=false 时放行（W8A 语义：仅 requires 标志为 true
   * 的 policy 拒绝无授权路径——剧本 policy 恒 true，law 求值保留完整）。
   */
  const enforceAuthorizationGate = (escalation: EscalationView): void => {
    if (!ESCALATION_STORYBOARD_RETRY_POLICY.requiresAuthorization) return;
    const live = liveAuthorizationOf(escalation.escalationId);
    const requiredScope = state?.gapScopes.get(escalation.gapId) ?? "";
    const gate = evaluateStoryboardAuthorizationGate({
      liveAuthorization:
        live.record === null
          ? null
          : { scope: live.record.scope, expiresAt: live.record.expiresAt },
      withdrawn: live.withdrawn,
      requiredScope,
      now: clockNow(),
    });
    if (!gate.allowed) {
      throw youError(
        "YOU_ESCALATION_AUTHORIZATION_REQUIRED",
        `escalation ${escalation.escalationId} refuses to run: authorization gate ${gate.reason}`,
        { reason: `authorization-${gate.reason}`, escalationId: escalation.escalationId },
      );
    }
  };

  // -------------------------------------------------------------------------
  // 快照
  // -------------------------------------------------------------------------

  const snapshot = (): EscalationStudioSnapshot => {
    if (!state) throw invalidState("escalation studio is not loaded");
    const gapSpecs: readonly EscalationGapSpecView[] = ESCALATION_STORYBOARD_GAP_SPECS.map(
      (spec) => ({
        id: spec.id,
        category: spec.category,
        confidence: spec.confidence,
        suggestedNextAction: spec.suggestedNextAction,
        strategyCount: spec.attemptedStrategies.length,
        eligible: spec.attemptedStrategies.length >= 1 && spec.confidence >= 0.5,
      }),
    );
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      categories: [...ESCALATION_STORYBOARD_CATEGORIES],
      learningPermissions: [...ESCALATION_STORYBOARD_LEARNING_PERMISSIONS],
      scopePresets: [...ESCALATION_STORYBOARD_SCOPE_PRESETS],
      backoffClasses: [...ESCALATION_STORYBOARD_BACKOFF_CLASSES],
      retryPolicy: { ...ESCALATION_STORYBOARD_RETRY_POLICY },
      providers: ESCALATION_STORYBOARD_PROVIDERS.map((entry) => ({ ...entry })),
      gapSpecs,
      gaps: [...state.gaps].sort((a, b) => compareStoryboardId(a.id, b.id)),
      runs: [...state.runs].sort((a, b) => compareStoryboardId(a.id, b.id)),
      escalations: [...state.escalations].sort((a, b) =>
        compareStoryboardId(a.escalationId, b.escalationId),
      ),
      authorizationLedger: state.authorizationLedger.map((entry) => ({
        record: { ...entry.record },
        kind: entry.kind,
        supersedesRecordId: entry.supersedesRecordId,
      })),
      liveAuthorizations: [...state.escalations]
        .sort((a, b) => compareStoryboardId(a.escalationId, b.escalationId))
        .map((escalation) => liveAuthorizationOf(escalation.escalationId)),
      toolProjections: state.toolProjections.map((entry) => ({ ...entry })),
      knowledgeProjections: state.knowledgeProjections.map((entry) => ({ ...entry })),
      events: state.events,
      projectedAt: clockNow(),
      simulated: true,
    };
  };

  const bootstrap = (request: EscalationStudioLoadRequest): void => {
    state = {
      studioId: "fx-escalation-studio-001",
      displayName: ESCALATION_STORYBOARD_DISPLAY_NAME,
      gaps: [],
      gapScopes: new Map(),
      runs: [],
      escalations: [],
      authorizationLedger: [],
      toolProjections: [],
      knowledgeProjections: [],
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "escalation-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      categoryCount: ESCALATION_STORYBOARD_CATEGORIES.length,
      learningPermissionCount: ESCALATION_STORYBOARD_LEARNING_PERMISSIONS.length,
      providerCount: ESCALATION_STORYBOARD_PROVIDERS.length,
      simulated: true,
    });
  };

  // -------------------------------------------------------------------------
  // 升级阶梯迁移（转移表强制 + gap 引用同步；合法迁移的单一入口）
  // -------------------------------------------------------------------------

  const transitionEscalation = (
    escalation: EscalationView,
    to: EscalationView["status"],
    patch: Partial<EscalationView> = {},
  ): EscalationView => {
    if (!isLegalStoryboardEscalationTransition(escalation.status, to)) {
      throw youError(
        "YOU_ESCALATION_STATE_INVALID",
        `illegal escalation transition ${escalation.status} -> ${to} on ${escalation.escalationId}`,
        {
          reason: "illegal-escalation-transition",
          escalationId: escalation.escalationId,
          from: escalation.status,
          to,
        },
      );
    }
    const next: EscalationView = { ...escalation, ...patch, status: to };
    replaceEscalation(next);
    const ref: ArenaEscalationRef = {
      escalationId: next.escalationId,
      status: to,
      minimumContext: [...next.minimumContext],
      expertResult: next.expertResult,
    };
    replaceGapEscalationRef(next.gapId, ref);
    return next;
  };

  const controller: EscalationStudioController = {
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

    // -- gap 平面（GAP PERSISTENCE LAW：记录不可变；gap-opened 链接意图/策略/证据） --

    async openCapabilityGap(input: OpenCapabilityGapInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const spec = storyboardGapSpecById(input.gapSpecId);
      if (!spec) {
        throw invalidStateReason(
          "unknown-gap-spec",
          `gap spec ${input.gapSpecId} is not on the fixture registry`,
          { gapSpecId: input.gapSpecId },
        );
      }
      const strategies = storyboardAttemptedStrategies(spec);
      const violation = validateStoryboardGapRecord({
        category: spec.category,
        confidence: spec.confidence,
        attemptedStrategies: strategies,
      });
      if (violation) {
        // 剧本规格恒良构；防御分支（服务语义镜像：malformed gap ⇒ typed 拒绝）。
        throw youError("YOU_GAP_PROJECTION_INVALID", `invalid gap record: ${violation.detail}`, {
          reason: violation.reason,
        });
      }
      const failureEvidence = storyboardGapFailureEvidence(spec);
      const eligible =
        strategies.length >= 1 && spec.confidence >= 0.5 ? "eligible" : "not-eligible";
      const gap: CapabilityGap = {
        id: nextId("fx-gap"),
        intentRef: spec.intentRef,
        attemptedStrategies: strategies,
        failureEvidence,
        category: spec.category,
        confidence: spec.confidence,
        suggestedNextAction: spec.suggestedNextAction,
        escalationEligibility: eligible,
        arenaEscalationRef: null,
      };
      state.gaps = [...state.gaps, gap];
      state.gapScopes.set(gap.id, spec.requiredScope);
      appendEvent("capability-gap-detected", gap.id, {
        gapId: gap.id,
        category: gap.category,
        confidence: gap.confidence,
        intentRef: gap.intentRef ?? "",
        strategyCount: gap.attemptedStrategies.length,
        evidenceCount: gap.failureEvidence.length,
        eligibility: gap.escalationEligibility,
        requiredScope: spec.requiredScope,
        simulated: true,
      });
      return gap;
    },

    // -- 升级生命周期（v1 阶梯） --

    async requestEscalation(input: RequestEscalationInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const gap = requireGap(input.gapId);
      if (gap.escalationEligibility !== "eligible") {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `gap ${gap.id} is not escalation-eligible (confidence ${gap.confidence}, ${gap.attemptedStrategies.length} attempted strategies)`,
          { reason: "not-escalation-eligible", gapId: gap.id },
        );
      }
      if (gap.arenaEscalationRef !== null) {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `gap ${gap.id} already carries escalation ${gap.arenaEscalationRef.escalationId}`,
          { reason: "already-escalated", gapId: gap.id },
        );
      }
      const escalationId = nextId("fx-escalation");
      const escalation: EscalationView = {
        escalationId,
        gapId: gap.id,
        status: "requested",
        minimumContext: [...ESCALATION_STORYBOARD_MINIMUM_CONTEXT],
        expertResult: null,
        requiredScope: state.gapScopes.get(gap.id) ?? "",
        createdAt: tick(),
        rejectionReason: null,
      };
      state.escalations = [...state.escalations, escalation];
      replaceGapEscalationRef(
        gap.id,
        {
          escalationId,
          status: "requested",
          minimumContext: [...ESCALATION_STORYBOARD_MINIMUM_CONTEXT],
          expertResult: null,
        },
        "escalated",
      );
      appendEvent("arena-escalation-requested", escalationId, {
        escalationId,
        gapId: gap.id,
        category: gap.category,
        minimumContext: ESCALATION_STORYBOARD_MINIMUM_CONTEXT.join(","),
        requiredScope: escalation.requiredScope,
        statusAfter: "requested",
        simulated: true,
      });
      return { escalation, gap: requireGap(gap.id) };
    },

    async grantAuthorization(input: GrantEscalationAuthorizationInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const escalation = requireEscalation(input.escalationId);
      if (
        escalation.status !== "requested" &&
        escalation.status !== "authorized" &&
        escalation.status !== "in-progress"
      ) {
        // 终态/取消的升级无需授权；delivered 起结果已在 YOU 权威内。
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} is ${escalation.status} — no authorization grant applies`,
          { reason: "grant-on-closed-escalation", escalationId: escalation.escalationId },
        );
      }
      const violation = validateStoryboardAuthorizationIntake({
        scope: input.scope,
        learningPermission: input.learningPermission,
        expiresAt: input.expiresAt,
      });
      if (violation) {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `invalid authorization grant: ${violation.detail}`,
          { reason: violation.reason, escalationId: escalation.escalationId },
        );
      }
      const record: EscalationAuthorization = {
        id: nextId("fx-auth"),
        escalationId: escalation.escalationId,
        authorizedBy: STORYBOARD_USER_ID,
        scope: input.scope,
        grantedAt: tick(),
        expiresAt: input.expiresAt,
        learningPermission: input.learningPermission,
      };
      const entry: EscalationAuthorizationEntry = {
        record,
        kind: "grant",
        supersedesRecordId: null,
      };
      state.authorizationLedger = [...state.authorizationLedger, entry];
      let next = escalation;
      if (escalation.status === "requested") {
        next = transitionEscalation(escalation, "authorized");
      }
      appendEvent(
        "escalation-authorized",
        record.id,
        {
          authorizationId: record.id,
          escalationId: record.escalationId,
          scope: record.scope,
          learningPermission: record.learningPermission,
          expiresAt: record.expiresAt ?? "",
          statusAfter: next.status,
          simulated: true,
        },
        "user",
      );
      appendEvent(
        "learning-permission-recorded",
        record.id,
        {
          authorizationId: record.id,
          escalationId: record.escalationId,
          permission: record.learningPermission,
          withdrawal: false,
          simulated: true,
        },
        "user",
      );
      return { entry, escalation: next };
    },

    async withdrawAuthorization(input: WithdrawEscalationAuthorizationInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const target = state.authorizationLedger.find(
        (entry) => entry.record.id === input.authorizationId,
      );
      if (!target) {
        throw youError(
          "YOU_ESCALATION_NOT_FOUND",
          `authorization ${input.authorizationId} not found on the ledger`,
          { reason: "unknown-authorization", authorizationId: input.authorizationId },
        );
      }
      if (target.kind !== "grant") {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `authorization ${input.authorizationId} is already a withdrawal record`,
          { reason: "withdrawal-of-withdrawal", authorizationId: input.authorizationId },
        );
      }
      const superseded = state.authorizationLedger.some(
        (entry) => entry.supersedesRecordId === input.authorizationId,
      );
      if (superseded) {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `authorization ${input.authorizationId} is already withdrawn`,
          { reason: "already-withdrawn", authorizationId: input.authorizationId },
        );
      }
      // 撤回 = 新记录（ESCALATION AUTHORIZATION LAW：绝不原地改写）。frozen 形状
      // 不动；withdrawal 记录以 learningPermission "none" 落账（ARENA LEARNING
      // PERMISSION LAW：撤回后学习机无许可）。
      const record: EscalationAuthorization = {
        id: nextId("fx-auth"),
        escalationId: target.record.escalationId,
        authorizedBy: STORYBOARD_USER_ID,
        scope: target.record.scope,
        grantedAt: tick(),
        expiresAt: null,
        learningPermission: "none",
      };
      const entry: EscalationAuthorizationEntry = {
        record,
        kind: "withdrawal",
        supersedesRecordId: target.record.id,
      };
      state.authorizationLedger = [...state.authorizationLedger, entry];
      appendEvent(
        "learning-permission-recorded",
        record.id,
        {
          authorizationId: record.id,
          supersedesAuthorizationId: target.record.id,
          escalationId: record.escalationId,
          permission: "none",
          withdrawal: true,
          simulated: true,
        },
        "user",
      );
      return entry;
    },

    // -- arena run 阶梯（append-only；终态锁定） --

    async startArenaRun(input: StartArenaRunInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const escalation = requireEscalation(input.escalationId);
      // 授权门最先（ESCALATION AUTHORIZATION LAW——先于状态与策略边界）。
      enforceAuthorizationGate(escalation);
      if (escalation.status !== "authorized" && escalation.status !== "in-progress") {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} is ${escalation.status} — a run starts from authorized (or retries in-progress)`,
          { reason: "run-start-illegal-status", escalationId: escalation.escalationId },
        );
      }
      const gap = requireGap(escalation.gapId);
      const priorAttempts = state.runs.filter((run) => run.gapId === gap.id).length;
      const attempt = priorAttempts + 1;
      if (attempt > ESCALATION_STORYBOARD_RETRY_POLICY.maxAttempts) {
        throw youError(
          "YOU_RETRY_POLICY_INVALID",
          `retry ladder exhausted for gap ${gap.id}: attempt ${attempt} exceeds maxAttempts ${ESCALATION_STORYBOARD_RETRY_POLICY.maxAttempts}`,
          { reason: "retry-ladder-exhausted", gapId: gap.id, attempt },
        );
      }
      const strategy =
        input.strategy ??
        gap.attemptedStrategies.at(-1)?.strategy ??
        "storyboard-retry";
      const run: ArenaRun = {
        id: nextId("fx-run"),
        gapId: gap.id,
        strategy,
        attempt,
        status: "started",
        startedAt: tick(),
        completedAt: null,
        outcomeEvidenceRef: null,
        simulated: true,
      };
      state.runs = [...state.runs, run];
      let next = escalation;
      if (escalation.status === "authorized") {
        next = transitionEscalation(escalation, "in-progress");
      }
      appendEvent("arena-run-recorded", run.id, {
        runId: run.id,
        gapId: run.gapId,
        escalationId: escalation.escalationId,
        strategy: run.strategy,
        attempt: run.attempt,
        statusBefore: "started",
        statusAfter: "started",
        escalationStatusAfter: next.status,
        simulated: true,
      });
      return { run, escalation: next };
    },

    async completeArenaRun(input: CompleteArenaRunInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const run = state.runs.find((candidate) => candidate.id === input.runId);
      if (!run) {
        throw youError("YOU_ARENA_RUN_NOT_FOUND", `arena run ${input.runId} not found`, {
          reason: "unknown-arena-run",
          runId: input.runId,
        });
      }
      if (run.status !== "started") {
        // 终态锁定（append-only：完成记录不可再迁移）。
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `arena run ${run.id} is ${run.status} — run terminals are locked`,
          { reason: "run-terminal-locked", runId: run.id },
        );
      }
      const outcomeEvidence =
        input.outcome === "completed"
          ? storyboardContentBinding(`run-outcome:${run.id}`).contentRef
          : null;
      const next: ArenaRun = {
        ...run,
        status: input.outcome,
        completedAt: tick(),
        outcomeEvidenceRef: outcomeEvidence,
      };
      replaceRun(next);
      appendEvent("arena-run-recorded", run.id, {
        runId: run.id,
        gapId: run.gapId,
        attempt: run.attempt,
        statusBefore: "started",
        statusAfter: input.outcome,
        completedAt: next.completedAt ?? "",
        simulated: true,
      });
      return next;
    },

    // -- provider 中立客户端边界（fail closed；ARENA BOUNDARY LAW） --

    async invokeArenaProvider(input: InvokeArenaProviderInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const escalation = requireEscalation(input.escalationId);
      // 授权门最先（in-progress 的升级仍须 live 授权——过期/撤回立即 fail closed）。
      enforceAuthorizationGate(escalation);
      if (escalation.status !== "in-progress") {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} is ${escalation.status} — the arena answers only in-progress escalations`,
          { reason: "invoke-illegal-status", escalationId: escalation.escalationId },
        );
      }
      const provider = ESCALATION_STORYBOARD_PROVIDERS.find(
        (entry) => entry.id === input.providerId,
      );
      if (!provider) {
        // fail closed：未知 provider 绝不回退（PROVIDER NEUTRALITY）。
        throw youError(
          "YOU_ARENA_ADAPTER_UNSUPPORTED",
          `arena provider ${input.providerId} is not registered (fail closed)`,
          { reason: "unknown-arena-provider", providerId: input.providerId },
        );
      }
      const activeRun = activeRunOfEscalation(escalation);
      if (!activeRun) {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} has no started run — start a run before invoking the arena`,
          { reason: "no-active-run", escalationId: escalation.escalationId },
        );
      }
      const gap = requireGap(escalation.gapId);
      const result: ArenaExpertResult = {
        ...storyboardExpertResult(gap.category),
        deliveredAt: tick(),
      };
      // 活跃 run 完成（outcome evidence = 结果的内容寻址标签）。
      const completedRun: ArenaRun = {
        ...activeRun,
        status: "completed",
        completedAt: tick(),
        outcomeEvidenceRef: storyboardContentBinding(
          `expert-result:${escalation.escalationId}`,
        ).contentRef,
      };
      replaceRun(completedRun);
      appendEvent("arena-run-recorded", completedRun.id, {
        runId: completedRun.id,
        gapId: completedRun.gapId,
        attempt: completedRun.attempt,
        statusBefore: "started",
        statusAfter: "completed",
        completedAt: completedRun.completedAt ?? "",
        simulated: true,
      });
      // typed payload 返回（ARENA BOUNDARY LAW）：in-progress → delivered。
      const next = transitionEscalation(escalation, "delivered", { expertResult: result });
      return { result, escalation: next, run: completedRun };
    },

    // -- 专家结果审阅（applies-as-changeset 投射意图） --

    async applyExpertResult(input: ApplyExpertResultInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const escalation = requireEscalation(input.escalationId);
      if (escalation.status !== "delivered" || escalation.expertResult === null) {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} is ${escalation.status} — only a delivered expert result applies`,
          { reason: "apply-illegal-status", escalationId: escalation.escalationId },
        );
      }
      const changeSetId = storyboardChangeSetId(escalation.escalationId);
      const appliedResult: ArenaExpertResult = {
        ...escalation.expertResult,
        appliesAsChangeSetId: changeSetId,
      };
      // delivered → applied 经转移表（非法路径 typed 拒绝）。
      const next = transitionEscalation(escalation, "applied", {
        expertResult: appliedResult,
      });
      appendEvent(
        "arena-result-applied",
        escalation.escalationId,
        {
          escalationId: escalation.escalationId,
          gapId: escalation.gapId,
          changeSetId,
          resultType: appliedResult.resultType,
          statusAfter: "applied",
          simulated: true,
        },
        "user",
      );
      return { escalation: next, gap: requireGap(escalation.gapId) };
    },

    async rejectExpertResult(input) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const escalation = requireEscalation(input.escalationId);
      if (escalation.status !== "delivered") {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} is ${escalation.status} — only a delivered expert result can be rejected`,
          { reason: "reject-illegal-status", escalationId: escalation.escalationId },
        );
      }
      const reason = input.reason.trim();
      if (reason === "") {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          "a rejection carries an explicit reason (never a silent drop)",
          { reason: "empty-rejection-reason", escalationId: escalation.escalationId },
        );
      }
      // delivered → rejected：服务端终态——frozen 事件词汇无 escalation-rejected
      // 类型（与 W6B candidate 前置状态同款披露：不伪造事件，投影携带终态）。
      const next = transitionEscalation(escalation, "rejected", {
        rejectionReason: reason,
      });
      return next;
    },

    async cancelEscalation(input: CancelEscalationInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const escalation = requireEscalation(input.escalationId);
      if (isTerminalStoryboardEscalationStatus(escalation.status)) {
        throw youError(
          "YOU_ESCALATION_STATE_INVALID",
          `escalation ${escalation.escalationId} is ${escalation.status} — terminals never reopen`,
          { reason: "cancel-on-terminal", escalationId: escalation.escalationId },
        );
      }
      // 活跃 run 以 aborted 落账（run 阶梯的取消语义——每长操作可取消）。
      const activeRun = activeRunOfEscalation(escalation);
      if (activeRun) {
        const aborted: ArenaRun = {
          ...activeRun,
          status: "aborted",
          completedAt: tick(),
          outcomeEvidenceRef: null,
        };
        replaceRun(aborted);
        appendEvent("arena-run-recorded", aborted.id, {
          runId: aborted.id,
          gapId: aborted.gapId,
          attempt: aborted.attempt,
          statusBefore: "started",
          statusAfter: "aborted",
          completedAt: aborted.completedAt ?? "",
          simulated: true,
        });
      }
      const next = transitionEscalation(escalation, "cancelled");
      appendEvent(
        "escalation-cancelled",
        escalation.escalationId,
        {
          escalationId: escalation.escalationId,
          gapId: escalation.gapId,
          statusAfter: "cancelled",
          simulated: true,
        },
        "user",
      );
      return { escalation: next, gap: requireGap(escalation.gapId) };
    },

    // -- 重试策略校验（W8A stateless validator 接缝镜像；纯校验不落账） --

    async validateRetryPolicy(input: ValidateRetryPolicyInput) {
      const violation = validateStoryboardRetryPolicy(input);
      if (violation) {
        throw youError(
          "YOU_RETRY_POLICY_INVALID",
          `invalid retry policy: ${violation.detail}`,
          { reason: violation.reason },
        );
      }
      return {
        maxAttempts: input.maxAttempts,
        backoffClass: input.backoffClass,
        eligibilityCategories: [...input.eligibilityCategories] as CapabilityGapCategory[],
        requiresAuthorization: input.requiresAuthorization,
      };
    },

    // -- gap 投影（派生非权威；事件 gap-projection-published） --

    async publishGapProjection(input: PublishGapProjectionInput) {
      if (!state) throw invalidState("escalation studio is not loaded");
      const knownGapIds = state.gaps.map((gap) => gap.id);
      const requestViolation = validateStoryboardGapProjectionRequest({
        gapId: input.gapId,
        kind: input.kind,
        knownGapIds,
      });
      if (requestViolation) {
        throw youError(
          "YOU_GAP_PROJECTION_INVALID",
          `invalid gap projection request: ${requestViolation.detail}`,
          { reason: requestViolation.reason, gapId: input.gapId },
        );
      }
      const gap = requireGap(input.gapId);
      if (!isWellFormedStoryboardGap(gap)) {
        // 投影构建器 fail closed：malformed gap 记录绝不猜测补全。
        throw youError(
          "YOU_GAP_PROJECTION_INVALID",
          `gap ${gap.id} is malformed — the projection builder refuses to guess`,
          { reason: "malformed-gap-record", gapId: gap.id },
        );
      }
      if (input.kind === "tool") {
        const binding = storyboardContentBinding(`tool:${gap.id}`);
        const projection: ToolGapProjection = {
          gapId: gap.id,
          toolId: binding.contentRef,
          requiredCapability: gap.suggestedNextAction,
          remediation: `${STORYBOARD_TOOL_DOMAIN[gap.category]}: ${gap.suggestedNextAction}`,
        };
        state.toolProjections = [...state.toolProjections, projection];
        appendEvent("gap-projection-published", gap.id, {
          gapId: gap.id,
          kind: "tool",
          toolId: projection.toolId ?? "",
          requiredCapability: projection.requiredCapability,
          simulated: true,
        });
        return { kind: "tool", tool: projection, knowledge: null };
      }
      const binding = storyboardContentBinding(`knowledge:${gap.id}`);
      const projection: KnowledgeGapProjection = {
        gapId: gap.id,
        domain: STORYBOARD_KNOWLEDGE_DOMAIN[gap.category],
        missingKnowledgeRef: binding.contentRef,
        remediation: `${STORYBOARD_KNOWLEDGE_DOMAIN[gap.category]}: ${gap.suggestedNextAction}`,
      };
      state.knowledgeProjections = [...state.knowledgeProjections, projection];
      appendEvent("gap-projection-published", gap.id, {
        gapId: gap.id,
        kind: "knowledge",
        domain: projection.domain,
        missingKnowledgeRef: projection.missingKnowledgeRef ?? "",
        simulated: true,
      });
      return { kind: "knowledge", tool: null, knowledge: projection };
    },
  };

  return controller;
}
