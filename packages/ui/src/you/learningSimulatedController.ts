/* oxlint-disable eslint(max-lines) -- 模拟控制器按 LearningStudioController 端口逐方法实现（Phase-0 剧本状态机：signal 捕获校验 + 记录阶梯 + rights 八步评估 + 偏好派生/种子/清除投射意图 + trajectory 合成/重放 + learning 用途同意强制）；T6 换绑 Worker A 的 learning 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Learning Studio — 确定性模拟控制器（W6B，Phase 0）。
//
// 这是 `LearningStudioController` 端口的确定性剧本实现（W6A 的 learning 服务在并行
// wave 合入；本实现只到 T6 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - signal 捕获校验最先（YOU_LEARNING_SIGNAL_INVALID：stateless、无时钟——W6A 同语义）；
// - 记录阶梯 candidate → validated | rejected；validated → superseded（supersededById
//   append-only 链接，落在后继者的 learning-record-validated 事件载荷里；记录替换
//   不可变，superseded 记录保留自己的 validatedAt）；candidate 是 pre-validation
//   服务状态——不落事件（W4A/W5A/W6A 先例）；未知记录 id ⇒ YOU_LEARNING_RECORD_NOT_FOUND；
// - RIGHTS LAW：rights 签发即强制（learning 用途未授予 ⇒ YOU_LEARNING_RIGHTS_REQUIRED）；
//   useRecord/derivePreference 走八步固定序评估（惰性 / usage 未授予 / 授权不可解析 /
//   状态非 granted / 未许可学习复用 / 用途未覆盖 / 哈希不匹配 / 过期——fail closed）；
//   撤回授权后 LIVE 拒绝（状态检查先于哈希检查）；
// - 偏好：derivePreference 带记录 lineage 且范围不得扩缩（YOU_PREFERENCE_SCOPE_INVALID）；
//   setOperatorPreference 无 rights 门；clearOperatorPreference 是投射意图——派生偏好
//   是投影，不可手工清除（typed 拒绝）；清除以 preference-updated 事件（cleared 标记）
//   诚实落账；
// - trajectory：seed 派生内容寻址步骤引用；重放按引用序拼接字节（同 seed ⇒ 字节一致
//   + 同摘要）；注册面服务状态——不落事件；
// - 事件词汇（frozen additive wave-6）：learning-signal-captured /
//   learning-record-validated / learning-record-rejected / preference-updated +
//   consent-recorded / consent-withdrawn + solution-created。
import type {
  ConsentReference,
  ConsentState,
  LearningPreference,
  LearningRecord,
  LearningRights,
  LearningSignal,
  OpaqueId,
  SolutionEvent,
  SolutionEventType,
  TrajectoryReference,
  YouError,
} from "@zcode/shared";
import {
  LearningStudioError,
  type CaptureLearningSignalInput,
  type ClearOperatorPreferenceInput,
  type DeriveLearningPreferenceInput,
  type IssueLearningRightsInput,
  type LearningConsentDecisionInput,
  type LearningConsentProjection,
  type LearningStudioController,
  type LearningStudioLoadRequest,
  type LearningStudioSnapshot,
  type LearningWithdrawConsentInput,
  type OpenCandidateRecordInput,
  type RecordTrajectoryInput,
  type RejectLearningRecordInput,
  type SetOperatorPreferenceInput,
  type SynthesizeLearningContentInput,
  type SynthesizeTrajectoryStepsInput,
  type UseLearningRecordInput,
  type ValidateLearningRecordInput,
} from "./learningController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  evaluateStoryboardRights,
  isLegalStoryboardLearningRecordTransition,
  storyboardPreferenceKey,
  validateStoryboardPreferenceScope,
  validateStoryboardRights,
  validateStoryboardSignal,
  validateStoryboardTrajectoryStepRefs,
  STORYBOARD_INERT_RIGHTS,
} from "./learningStoryboardLaws.js";
import {
  LEARNING_STORYBOARD_CONSENT_POLICY,
  LEARNING_STORYBOARD_DISPLAY_NAME,
  LEARNING_STORYBOARD_EVIDENCE,
  LEARNING_STORYBOARD_KIND_REGISTRY,
  LEARNING_STORYBOARD_LEARNING_PURPOSE,
  LEARNING_STORYBOARD_RIGHT_USAGES,
  LEARNING_STORYBOARD_SCOPES,
  LEARNING_STORYBOARD_SIGNAL_KINDS,
  LEARNING_STORYBOARD_SOLUTION_ID,
  compareStoryboardId,
  storyboardContentBinding,
  storyboardGrantHash,
  storyboardReplayHash,
  storyboardTrajectoryStepBytes,
  storyboardTrajectoryStepRefs,
  type StoryboardContentBinding,
  type StoryboardGrantFacts,
} from "./learningStoryboard.js";

interface SimulatedLearningState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  signals: LearningSignal[];
  records: LearningRecord[];
  /** `${scope}::${key}` → 最新偏好投影（upsert 替换；previous 随调用返回）。 */
  preferences: Map<string, LearningPreference>;
  trajectories: TrajectoryReference[];
  /** stepRef → 字节（内容寻址；同字节 ⇒ 同引用的幂等 put）。 */
  contentStore: Map<string, Uint8Array>;
  readonly purposeStates: Map<string, ConsentState>;
  events: SolutionEvent[];
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): LearningStudioError {
  return new LearningStudioError({ code, message, details, simulated: true });
}

function invalidState(message: string): LearningStudioError {
  return youError("YOU_INVALID_STATE", message);
}

function invalidStateReason(
  reason: string,
  message: string,
  details: Record<string, string | number | boolean> = {},
): LearningStudioError {
  return youError("YOU_INVALID_STATE", message, { reason, ...details });
}

function copyRights(rights: LearningRights): LearningRights {
  return {
    usage: [...rights.usage],
    consentRef: rights.consentRef,
    consentHash: rights.consentHash,
    expiresAt: rights.expiresAt,
  };
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 learningStudioRegistry）；
 * `load` 幂等：状态存在即复用（learning 平面是持久 workspace 表面）。
 */
export function createSimulatedLearningStudioController(): LearningStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let state: SimulatedLearningState | null = null;

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
        id: nextId("fx-learn-event"),
        solutionId: LEARNING_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-learning-storyboard",
          generator,
          createdAt: clock.next(),
          lineage: [],
        },
      },
    ];
  };

  /** live 授权事实（W6A LearningConsentPort.resolveLearningGrant 的剧本镜像）。 */
  const liveGrantFacts = (consentRef: string): StoryboardGrantFacts | null => {
    if (consentRef !== LEARNING_STORYBOARD_CONSENT_POLICY.id) return null;
    const policy = LEARNING_STORYBOARD_CONSENT_POLICY;
    return {
      policyId: policy.id,
      state:
        state?.purposeStates.get(LEARNING_STORYBOARD_LEARNING_PURPOSE) ?? "unknown",
      scope: policy.scope,
      purposes: [...policy.purposes],
      learningReuse: policy.learningReuse,
      operationalUse: policy.operationalUse,
    };
  };

  const consentReference = (): ConsentReference => {
    const states = LEARNING_STORYBOARD_CONSENT_POLICY.purposes.map(
      (purpose) => state?.purposeStates.get(purpose) ?? "unknown",
    );
    // 保守聚合：任何非 granted 用途都视为整体未许可（no permission ⇒ no processing）。
    const aggregate = states.every((candidate) => candidate === "granted")
      ? "granted"
      : states.find((candidate) => candidate === "withdrawn")
        ? "withdrawn"
        : states.find((candidate) => candidate === "denied")
          ? "denied"
          : "unknown";
    return {
      policyId: LEARNING_STORYBOARD_CONSENT_POLICY.id,
      state: aggregate,
      learningPermission: aggregate === "granted",
    };
  };

  const consentProjection = (): LearningConsentProjection => ({
    policy: { ...LEARNING_STORYBOARD_CONSENT_POLICY },
    purposeStates: [...LEARNING_STORYBOARD_CONSENT_POLICY.purposes]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((purpose) => ({
        purpose,
        state: state?.purposeStates.get(purpose) ?? "unknown",
      })),
    reference: consentReference(),
  });

  const snapshot = (): LearningStudioSnapshot => {
    if (!state) throw invalidState("learning studio is not loaded");
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      kindRegistry: LEARNING_STORYBOARD_KIND_REGISTRY.map((entry) => ({ ...entry })),
      scopes: [...LEARNING_STORYBOARD_SCOPES],
      rightUsages: [...LEARNING_STORYBOARD_RIGHT_USAGES],
      evidence: LEARNING_STORYBOARD_EVIDENCE.map((entry) => ({ ...entry })),
      signals: [...state.signals].sort((a, b) => compareStoryboardId(a.id, b.id)),
      records: [...state.records].sort((a, b) => compareStoryboardId(a.id, b.id)),
      preferences: [...state.preferences.values()].sort((a, b) =>
        compareStoryboardId(
          storyboardPreferenceKey(a.scope, a.key),
          storyboardPreferenceKey(b.scope, b.key),
        ),
      ),
      trajectories: [...state.trajectories].sort((a, b) =>
        compareStoryboardId(a.id, b.id),
      ),
      consent: consentProjection(),
      events: state.events,
      simulated: true,
    };
  };

  const bootstrap = (request: LearningStudioLoadRequest): void => {
    state = {
      studioId: "fx-learning-studio-001",
      displayName: LEARNING_STORYBOARD_DISPLAY_NAME,
      signals: [],
      records: [],
      preferences: new Map(),
      trajectories: [],
      contentStore: new Map(),
      purposeStates: new Map(
        LEARNING_STORYBOARD_CONSENT_POLICY.purposes.map((purpose) => [
          purpose,
          "unknown" as ConsentState,
        ]),
      ),
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "learning-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      kindCount: LEARNING_STORYBOARD_SIGNAL_KINDS.length,
      scopeCount: LEARNING_STORYBOARD_SCOPES.length,
    });
  };

  /** 记录解析（未知 id ⇒ YOU_LEARNING_RECORD_NOT_FOUND——typed，绝不猜测）。 */
  const requireRecord = (recordId: OpaqueId): LearningRecord => {
    if (!state) throw invalidState("learning studio is not loaded");
    const record = state.records.find((candidate) => candidate.id === recordId);
    if (!record) {
      throw youError("YOU_LEARNING_RECORD_NOT_FOUND", `learning record ${recordId} not found`, {
        reason: "unknown-learning-record",
        recordId,
      });
    }
    return record;
  };

  /** 记录替换（不可变：同 id 新记录；绝不原地覆写）。 */
  const replaceRecord = (record: LearningRecord): void => {
    if (!state) return;
    state.records = state.records.map((candidate) =>
      candidate.id === record.id ? record : candidate,
    );
  };

  const controller: LearningStudioController = {
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

    async captureSignal(input: CaptureLearningSignalInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      // 校验最先（stateless、无时钟；违例 ⇒ YOU_LEARNING_SIGNAL_INVALID，绝不静默修复）。
      const violation = validateStoryboardSignal({
        kind: String(input.kind),
        scope: String(input.scope),
        subjectRef: input.subjectRef ?? null,
        evidenceRefs: [...input.evidenceRefs],
      });
      if (violation) {
        throw youError(
          "YOU_LEARNING_SIGNAL_INVALID",
          `invalid learning signal: ${violation.reason}${violation.refIndex !== null ? ` (evidence ref ${violation.refIndex})` : ""} — ${violation.detail}`,
          {
            reason: violation.reason,
            detail: violation.detail,
            ...(violation.refIndex !== null ? { refIndex: violation.refIndex } : {}),
          },
        );
      }
      const signal: LearningSignal = {
        id: nextId("fx-learnsignal"),
        kind: input.kind,
        scope: input.scope,
        subjectRef: input.subjectRef ?? null,
        evidenceRefs: [...input.evidenceRefs],
        capturedAt: clock.next(),
        simulated: true,
      };
      state.signals = [...state.signals, signal];
      const evidenceFacts: Record<string, string | number | boolean> = {
        evidenceCount: signal.evidenceRefs.length,
      };
      for (let index = 0; index < signal.evidenceRefs.length; index += 1) {
        evidenceFacts[`evidenceRef.${index}`] = signal.evidenceRefs[index] ?? "";
      }
      appendEvent(
        "learning-signal-captured",
        signal.id,
        {
          signalId: signal.id,
          kind: signal.kind,
          scope: signal.scope,
          subjectRef: signal.subjectRef ?? "",
          ...evidenceFacts,
          capturedAt: signal.capturedAt,
          simulated: true,
        },
        "user",
      );
      return signal;
    },

    async synthesizeLearningContent(
      input: SynthesizeLearningContentInput,
    ): Promise<StoryboardContentBinding> {
      if (!state) throw invalidState("learning studio is not loaded");
      if (input.seedText.trim() === "") {
        throw invalidStateReason(
          "empty-seed-text",
          "learning content synthesis requires a non-empty seed text",
        );
      }
      // 确定性内容绑定（同 seed ⇒ 同 contentRef/contentHash；内容绝不内联）。
      return storyboardContentBinding(`content:${input.seedText}`);
    },

    async issueRights(input: IssueLearningRightsInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      // issuance-as-enforcement：learning 用途门最先（fail closed）。
      const facts = liveGrantFacts(LEARNING_STORYBOARD_CONSENT_POLICY.id);
      if (facts === null) {
        throw youError(
          "YOU_LEARNING_RIGHTS_REQUIRED",
          "issuing learning rights requires a resolvable learning consent grant",
          { reason: "consent-unresolvable", purpose: "learning" },
        );
      }
      if (facts.state !== "granted") {
        throw youError(
          "YOU_LEARNING_RIGHTS_REQUIRED",
          `issuing learning rights requires consent for purpose "learning" (state: ${facts.state})`,
          { reason: `consent-${facts.state}`, purpose: "learning", consentState: facts.state },
        );
      }
      if (!facts.learningReuse) {
        throw youError(
          "YOU_LEARNING_RIGHTS_REQUIRED",
          "the learning consent grant does not permit learning reuse",
          { reason: "learning-reuse-not-permitted", purpose: "learning" },
        );
      }
      if (!facts.purposes.includes(LEARNING_STORYBOARD_LEARNING_PURPOSE)) {
        throw youError(
          "YOU_LEARNING_RIGHTS_REQUIRED",
          'the learning consent grant does not cover purpose "learning"',
          { reason: "purpose-not-covered", purpose: "learning" },
        );
      }
      // 结构校验（usage 分类学 + 去重 + expiresAt）。
      const consentHash = storyboardGrantHash(facts);
      const violation = validateStoryboardRights({
        usage: [...input.usage],
        consentRef: LEARNING_STORYBOARD_CONSENT_POLICY.id,
        consentHash,
        expiresAt: input.expiresAt ?? null,
      });
      if (violation) {
        throw invalidStateReason(
          violation.reason,
          `invalid learning rights intake: ${violation.reason} — ${violation.detail}`,
          { purpose: "learning" },
        );
      }
      return {
        usage: [...input.usage],
        consentRef: LEARNING_STORYBOARD_CONSENT_POLICY.id,
        consentHash,
        expiresAt: input.expiresAt ?? null,
      };
    },

    async openCandidateRecord(input: OpenCandidateRecordInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const signal = state.signals.find((candidate) => candidate.id === input.signalId);
      if (!signal) {
        throw invalidStateReason(
          "unknown-signal",
          `learning signal ${input.signalId} not found`,
          { signalId: input.signalId },
        );
      }
      if (input.contentRef === "" || !input.contentHash.startsWith("sha256-fixture-")) {
        throw invalidStateReason(
          "invalid-content-binding",
          "learning records require a content-addressed binding (contentRef + sha256-fixture contentHash)",
          { signalId: signal.id },
        );
      }
      let rights: LearningRights;
      if (input.rights === null || input.rights === undefined) {
        // 无 rights ⇒ 惰性记录（存在、可爬阶梯，但一切使用被拒——RIGHTS LAW）。
        rights = copyRights(STORYBOARD_INERT_RIGHTS);
      } else {
        const violation = validateStoryboardRights({
          usage: [...input.rights.usage],
          consentRef: input.rights.consentRef,
          consentHash: input.rights.consentHash,
          expiresAt: input.rights.expiresAt,
        });
        if (violation) {
          throw invalidStateReason(
            violation.reason,
            `invalid learning rights intake: ${violation.reason} — ${violation.detail}`,
            { signalId: signal.id },
          );
        }
        rights = copyRights(input.rights);
      }
      const record: LearningRecord = {
        id: nextId("fx-learnrecord"),
        signalId: signal.id,
        status: "candidate",
        scope: signal.scope,
        contentRef: input.contentRef,
        contentHash: input.contentHash,
        rights,
        validatedAt: clock.next(),
        supersededById: null,
        simulated: true,
      };
      state.records = [...state.records, record];
      // candidate 是 pre-validation 服务状态——不落事件（W6A 先例：阶梯在
      // validation/rejection 时才物化进可重放投影）。
      return record;
    },

    async validateRecord(input: ValidateLearningRecordInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const record = requireRecord(input.recordId);
      if (!isLegalStoryboardLearningRecordTransition(record.status, "validated")) {
        throw invalidStateReason(
          "record-not-candidate",
          `learning record ${record.id} is ${record.status}, not candidate`,
          { recordId: record.id, status: record.status },
        );
      }
      let supersededTarget: LearningRecord | null = null;
      if (input.supersedesRecordId !== null && input.supersedesRecordId !== undefined) {
        if (input.supersedesRecordId === record.id) {
          throw invalidStateReason(
            "self-supersession",
            "a learning record cannot supersede itself",
            { recordId: record.id },
          );
        }
        supersededTarget = requireRecord(input.supersedesRecordId);
        if (supersededTarget.status !== "validated") {
          throw invalidStateReason(
            "record-not-validated",
            `learning record ${supersededTarget.id} is ${supersededTarget.status}, only validated records can be superseded`,
            { recordId: supersededTarget.id, status: supersededTarget.status },
          );
        }
      }
      const validated: LearningRecord = {
        ...record,
        status: "validated",
        validatedAt: clock.next(),
      };
      replaceRecord(validated);
      let superseded: LearningRecord | null = null;
      if (supersededTarget) {
        // append-only 链接：superseded 记录只移动 status + supersededById，保留自己的
        // validatedAt；链接事实落在后继者的 learning-record-validated 事件载荷里。
        superseded = {
          ...supersededTarget,
          status: "superseded",
          supersededById: validated.id,
        };
        replaceRecord(superseded);
      }
      const usageFacts: Record<string, string | number | boolean> = {
        usageCount: validated.rights.usage.length,
      };
      for (let index = 0; index < validated.rights.usage.length; index += 1) {
        usageFacts[`usage.${index}`] = validated.rights.usage[index] ?? "";
      }
      appendEvent(
        "learning-record-validated",
        validated.id,
        {
          recordId: validated.id,
          signalId: validated.signalId,
          scope: validated.scope,
          statusAfter: "validated",
          contentRef: validated.contentRef,
          contentHash: validated.contentHash,
          ...usageFacts,
          consentRef: validated.rights.consentRef,
          consentHash: validated.rights.consentHash,
          rightsExpiresAt: validated.rights.expiresAt ?? "",
          supersedesRecordId: input.supersedesRecordId ?? "",
          validatedAt: validated.validatedAt,
          simulated: true,
        },
        "agent",
      );
      return { record: validated, superseded };
    },

    async rejectRecord(input: RejectLearningRecordInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const record = requireRecord(input.recordId);
      if (!isLegalStoryboardLearningRecordTransition(record.status, "rejected")) {
        throw invalidStateReason(
          "record-not-candidate",
          `learning record ${record.id} is ${record.status}, not candidate`,
          { recordId: record.id, status: record.status },
        );
      }
      const reason = input.reason === "" ? "unspecified" : input.reason;
      const rejected: LearningRecord = {
        ...record,
        status: "rejected",
        validatedAt: clock.next(),
      };
      replaceRecord(rejected);
      appendEvent(
        "learning-record-rejected",
        rejected.id,
        {
          recordId: rejected.id,
          signalId: rejected.signalId,
          scope: rejected.scope,
          statusAfter: "rejected",
          contentRef: rejected.contentRef,
          contentHash: rejected.contentHash,
          consentRef: rejected.rights.consentRef,
          consentHash: rejected.rights.consentHash,
          rightsExpiresAt: rejected.rights.expiresAt ?? "",
          reason,
          validatedAt: rejected.validatedAt,
          simulated: true,
        },
        "agent",
      );
      return rejected;
    },

    async useRecord(input: UseLearningRecordInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const record = requireRecord(input.recordId);
      if (record.status !== "validated") {
        throw invalidStateReason(
          "record-not-validated",
          `learning record ${record.id} is ${record.status}, only validated learning is usable`,
          { recordId: record.id, status: record.status },
        );
      }
      // RIGHTS LAW：八步固定序评估（惰性记录在此被拒——rights-inert）。
      const liveGrant =
        record.rights.consentRef !== "" ? liveGrantFacts(record.rights.consentRef) : null;
      const now =
        record.rights.expiresAt !== null ? clock.next() : "";
      const decision = evaluateStoryboardRights(record.rights, input.usage, liveGrant, now);
      if (!decision.allowed) {
        throw youError(
          "YOU_LEARNING_RIGHTS_REQUIRED",
          `usage "${input.usage}" of learning record ${record.id} is outside its rights grant (${decision.reason})`,
          {
            reason: decision.reason,
            recordId: record.id,
            usage: input.usage,
            consentRef: record.rights.consentRef,
          },
        );
      }
      return { record, usage: input.usage };
    },

    async derivePreference(input: DeriveLearningPreferenceInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const record = requireRecord(input.recordId);
      if (record.status !== "validated") {
        throw invalidStateReason(
          "record-not-validated",
          `learning record ${record.id} is ${record.status}, preferences derive only from validated learning`,
          { recordId: record.id, status: record.status },
        );
      }
      // rights 门：派生偏好要求 personalization 用途在授予范围内。
      const liveGrant =
        record.rights.consentRef !== "" ? liveGrantFacts(record.rights.consentRef) : null;
      const now =
        record.rights.expiresAt !== null ? clock.next() : "";
      const decision = evaluateStoryboardRights(
        record.rights,
        "personalization",
        liveGrant,
        now,
      );
      if (!decision.allowed) {
        throw youError(
          "YOU_LEARNING_RIGHTS_REQUIRED",
          `preference derivation from learning record ${record.id} is outside its rights grant (${decision.reason})`,
          {
            reason: decision.reason,
            recordId: record.id,
            usage: "personalization",
            consentRef: record.rights.consentRef,
          },
        );
      }
      // 范围法则：派生偏好不得扩缩记录范围（scope 字面量 + scope-mismatch）。
      const scope = input.scope ?? record.scope;
      const violation = validateStoryboardPreferenceScope({ scope: String(scope) }, record.scope);
      if (violation) {
        throw youError(
          "YOU_PREFERENCE_SCOPE_INVALID",
          `invalid preference scope: ${violation.reason} — ${violation.detail}`,
          { reason: violation.reason, scope: String(scope), recordScope: record.scope },
        );
      }
      if (input.key === "" || input.key.trim() !== input.key) {
        throw invalidStateReason("invalid-key", "preference key must be non-empty without surrounding whitespace");
      }
      if (input.value === "") {
        throw invalidStateReason("invalid-value", "preference value must be non-empty");
      }
      const projectionKey = storyboardPreferenceKey(scope, input.key);
      const previous = state.preferences.get(projectionKey) ?? null;
      const preference: LearningPreference = {
        id: nextId("fx-learnpref"),
        scope,
        key: input.key,
        value: input.value,
        derivedFromRecordId: record.id,
        updatedAt: clock.next(),
      };
      state.preferences.set(projectionKey, preference);
      appendEvent(
        "preference-updated",
        preference.id,
        {
          preferenceId: preference.id,
          scope: preference.scope,
          key: preference.key,
          value: preference.value,
          derivedFromRecordId: preference.derivedFromRecordId ?? "",
          updatedAt: preference.updatedAt,
          simulated: true,
        },
        "agent",
      );
      return { preference, previous };
    },

    async setOperatorPreference(input: SetOperatorPreferenceInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      // operator seed：无记录参与、无 rights 门（用户直接控制偏好值）。
      const violation = validateStoryboardPreferenceScope({ scope: String(input.scope) }, null);
      if (violation) {
        throw youError(
          "YOU_PREFERENCE_SCOPE_INVALID",
          `invalid preference scope: ${violation.reason} — ${violation.detail}`,
          { reason: violation.reason, scope: String(input.scope) },
        );
      }
      if (input.key === "" || input.key.trim() !== input.key) {
        throw invalidStateReason("invalid-key", "preference key must be non-empty without surrounding whitespace");
      }
      if (input.value === "") {
        throw invalidStateReason("invalid-value", "preference value must be non-empty");
      }
      const projectionKey = storyboardPreferenceKey(input.scope, input.key);
      const previous = state.preferences.get(projectionKey) ?? null;
      const preference: LearningPreference = {
        id: nextId("fx-learnpref"),
        scope: input.scope,
        key: input.key,
        value: input.value,
        derivedFromRecordId: null,
        updatedAt: clock.next(),
      };
      state.preferences.set(projectionKey, preference);
      appendEvent(
        "preference-updated",
        preference.id,
        {
          preferenceId: preference.id,
          scope: preference.scope,
          key: preference.key,
          value: preference.value,
          derivedFromRecordId: "",
          updatedAt: preference.updatedAt,
          simulated: true,
        },
        "user",
      );
      return { preference, previous };
    },

    async clearOperatorPreference(input: ClearOperatorPreferenceInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const violation = validateStoryboardPreferenceScope({ scope: String(input.scope) }, null);
      if (violation) {
        throw youError(
          "YOU_PREFERENCE_SCOPE_INVALID",
          `invalid preference scope: ${violation.reason} — ${violation.detail}`,
          { reason: violation.reason, scope: String(input.scope) },
        );
      }
      if (input.key === "" || input.key.trim() !== input.key) {
        throw invalidStateReason("invalid-key", "preference key must be non-empty without surrounding whitespace");
      }
      const projectionKey = storyboardPreferenceKey(input.scope, input.key);
      const existing = state.preferences.get(projectionKey);
      if (!existing) {
        throw invalidStateReason(
          "unknown-preference",
          `no learning preference for ${projectionKey}`,
          { scope: input.scope, preferenceKey: input.key },
        );
      }
      if (existing.derivedFromRecordId !== null) {
        // 派生偏好是投影：手工清除被 typed 拒绝（只有 operator seed 可清除）。
        throw invalidStateReason(
          "derived-preference-projection",
          "derived preferences are projections of validated learning — only the operator seed can be cleared",
          { scope: input.scope, preferenceKey: input.key, recordId: existing.derivedFromRecordId },
        );
      }
      state.preferences.delete(projectionKey);
      appendEvent(
        "preference-updated",
        existing.id,
        {
          preferenceId: existing.id,
          scope: existing.scope,
          key: existing.key,
          value: "",
          derivedFromRecordId: "",
          cleared: true,
          updatedAt: clock.next(),
          simulated: true,
        },
        "user",
      );
      return existing;
    },

    async synthesizeTrajectorySteps(input: SynthesizeTrajectoryStepsInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      if (input.stepCount < 1) {
        throw invalidStateReason(
          "invalid-step-count",
          "trajectory synthesis requires at least one step",
        );
      }
      if (input.seedText.trim() === "") {
        throw invalidStateReason(
          "empty-seed-text",
          "trajectory synthesis requires a non-empty seed text",
        );
      }
      const stepRefs = storyboardTrajectoryStepRefs(input.seedText, input.stepCount);
      for (let index = 0; index < stepRefs.length; index += 1) {
        const ref = stepRefs[index];
        if (ref === undefined) continue;
        // 内容寻址幂等 put：同字节 ⇒ 同引用（不重复占位）。
        if (!state.contentStore.has(ref)) {
          state.contentStore.set(ref, storyboardTrajectoryStepBytes(input.seedText, index));
        }
      }
      return { stepRefs };
    },

    async recordTrajectory(input: RecordTrajectoryInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      const scopeViolation = validateStoryboardPreferenceScope(
        { scope: String(input.scope) },
        null,
      );
      if (scopeViolation) {
        throw invalidStateReason(
          "invalid-scope",
          `unknown learning scope "${String(input.scope)}"`,
          { scope: String(input.scope) },
        );
      }
      const violation = validateStoryboardTrajectoryStepRefs([...input.stepRefs]);
      if (violation) {
        throw invalidStateReason(
          violation.reason,
          `invalid trajectory: ${violation.reason} — ${violation.detail}`,
          violation.refIndex !== null ? { refIndex: violation.refIndex } : {},
        );
      }
      const trajectory: TrajectoryReference = {
        id: nextId("fx-traj"),
        scope: input.scope,
        stepRefs: [...input.stepRefs],
        createdAt: clock.next(),
        simulated: true,
      };
      state.trajectories = [...state.trajectories, trajectory];
      // trajectory 是注册面服务状态（无 trajectory 事件类型——W6A 先例），不落账。
      return trajectory;
    },

    async replayTrajectory(input: { readonly trajectoryId: OpaqueId }) {
      if (!state) throw invalidState("learning studio is not loaded");
      const trajectory = state.trajectories.find(
        (candidate) => candidate.id === input.trajectoryId,
      );
      if (!trajectory) {
        throw invalidStateReason(
          "unknown-trajectory",
          `learning trajectory ${input.trajectoryId} not found`,
          { trajectoryId: input.trajectoryId },
        );
      }
      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      for (let index = 0; index < trajectory.stepRefs.length; index += 1) {
        const ref = trajectory.stepRefs[index] ?? "";
        const bytes = state.contentStore.get(ref);
        if (bytes === undefined) {
          throw invalidStateReason(
            "step-ref-unresolved",
            `trajectory step ref ${ref} (index ${index}) is not resolvable in the content store`,
            { refIndex: index },
          );
        }
        chunks.push(bytes);
        byteLength += bytes.length;
      }
      const replayBytes = new Uint8Array(byteLength);
      let offset = 0;
      for (const chunk of chunks) {
        replayBytes.set(chunk, offset);
        offset += chunk.length;
      }
      const replayText = new TextDecoder().decode(replayBytes);
      return {
        trajectory,
        bytes: replayBytes,
        replayHash: storyboardReplayHash(replayText),
        stepCount: trajectory.stepRefs.length,
      };
    },

    async decideConsent(input: LearningConsentDecisionInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      if (input.policyId !== LEARNING_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      if (!LEARNING_STORYBOARD_CONSENT_POLICY.purposes.includes(input.purpose)) {
        throw invalidState(
          `purpose ${String(input.purpose)} is not part of policy ${input.policyId}`,
        );
      }
      state.purposeStates.set(
        input.purpose,
        input.decision === "grant" ? "granted" : "denied",
      );
      appendEvent(
        "consent-recorded",
        input.policyId,
        {
          purpose: String(input.purpose),
          decision: input.decision,
          kind: "learning-consent",
          simulated: true,
        },
        "user",
      );
      return consentProjection();
    },

    async withdrawConsent(input: LearningWithdrawConsentInput) {
      if (!state) throw invalidState("learning studio is not loaded");
      if (input.policyId !== LEARNING_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      for (const purpose of LEARNING_STORYBOARD_CONSENT_POLICY.purposes) {
        state.purposeStates.set(purpose, "withdrawn");
      }
      appendEvent(
        "consent-withdrawn",
        input.policyId,
        {
          purposes: LEARNING_STORYBOARD_CONSENT_POLICY.purposes.join(","),
          simulated: true,
        },
        "user",
      );
      // 撤回后 LIVE fail-closed：既有 rights 的后续使用在下一次评估被拒（状态检查
      // 先于哈希检查）——「无许可 ⇒ 不处理」在撤回后依然真实可见。
      return consentProjection();
    },
  };

  return controller;
}
