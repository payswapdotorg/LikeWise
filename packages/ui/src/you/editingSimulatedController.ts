/* oxlint-disable eslint(max-lines) -- 模拟控制器按 EditingStudioController 端口逐方法实现（Phase-0 剧本状态机：subject 注册表 + session 生命周期 + change-set 校验/提议/应用 + 候选谱系 + v1 change-accepted/change-rejected 解决 + Tier-4 interchange + external launch / takeover 的同意强制）；T5 换绑 Worker A 的 editing 服务后本文件整体退役，拆分只会增加退役成本。 */
// YOU Editing Studio — 确定性模拟控制器（W5B，Phase 0）。
//
// 这是 `EditingStudioController` 端口的确定性剧本实现（W5A 的 editing 服务在并行
// wave 合入；本实现只到 T5 换绑为止，明确标注 fixture-simulated）：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - EditingSession 不可变（终态经记录替换：open → committed | abandoned；非法迁移
//   typed 拒绝；未知会话 ⇒ YOU_EDIT_SESSION_NOT_FOUND）；
// - change-set 校验最先（YOU_CHANGESET_INVALID：stateless、无时钟——W5A 同语义）；
// - editor 注册面校验（未注册 kind ⇒ YOU_EDITOR_UNSUPPORTED，绝不静默回退）；
// - 候选应用产出内容寻址不可变 CandidateVersion（parent → candidate 谱系 append-only）；
//   候选解决恰一次（v1 change-accepted / change-rejected 事件纪律；无第二条权威路径）；
// - Tier-4 interchange：确定性导出组装（内容寻址结果）；导入验证（invalid ⇒ failed
//   结果记录诚实入账 + YOU_IMPORT_EXPORT_FAILED）；round-trip 经包内容哈希恒等校验；
// - external editor launch / manual takeover：同意门（export / manual-takeover 用途）
//   服务端式强制（无许可 ⇒ YOU_CONSENT_REQUIRED）；launch 只投射意图（无进程控制）；
// - 事件词汇（frozen additive wave-5）：edit-session-opened / edit-session-closed /
//   change-proposed / change-accepted / change-rejected / change-set-applied /
//   candidate-version-proposed / import-export-completed + consent-recorded/withdrawn。
import type {
  CandidateVersion,
  ConsentReference,
  ConsentState,
  EditChangeSet,
  EditChangeSetOp,
  EditingSession,
  ImportExportResult,
  OpaqueId,
  SolutionEvent,
  SolutionEventType,
  YouError,
} from "@zcode/shared";
import {
  EditingStudioError,
  projectEditingConsentGate,
  type ApplyChangeSetInput,
  type CandidatePreview,
  type CandidateResolutionView,
  type EditingConsentDecisionInput,
  type EditingConsentProjection,
  type EditingExportOutcome,
  type EditingImportOutcome,
  type EditingSessionInput,
  type EditingStudioController,
  type EditingStudioLoadRequest,
  type EditingStudioSnapshot,
  type EditingWithdrawConsentInput,
  type ExportFromSessionInput,
  type ExternalLaunchIntentView,
  type ImportEditPackageInput,
  type InterchangeFactView,
  type OpenEditingSessionInput,
  type ProposeChangeSetInput,
  type RequestExternalEditorLaunchInput,
  type ResolveCandidateInput,
  type TakeoverConfirmationView,
} from "./editingController.js";
import { StoryboardClock } from "./solutionStoryboard.js";
import {
  EDITING_STORYBOARD_CONSENT_POLICY,
  EDITING_STORYBOARD_DISPLAY_NAME,
  EDITING_STORYBOARD_EDITOR_PROFILES,
  EDITING_STORYBOARD_FORMATS,
  EDITING_STORYBOARD_LAUNCH_PURPOSE,
  EDITING_STORYBOARD_SOLUTION_ID,
  EDITING_STORYBOARD_SUBJECTS,
  EDITING_STORYBOARD_TAKEOVER_PURPOSE,
  isLegalStoryboardEditingSessionTransition,
  isStoryboardSupportedFormat,
  storyboardCandidatePreviewDigest,
  storyboardContentBinding,
  storyboardEditorProfile,
  storyboardSubjectById,
  validateStoryboardChangeSet,
} from "./editingStoryboard.js";
import { computeCaptureFixtureHash } from "./captureStoryboard.js";

interface SimulatedCandidateResolution {
  readonly candidateId: OpaqueId;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string;
}

interface SimulatedEditingState {
  readonly studioId: OpaqueId;
  readonly displayName: string;
  sessions: EditingSession[];
  changeSets: EditChangeSet[];
  candidates: CandidateVersion[];
  resolutions: SimulatedCandidateResolution[];
  importExports: ImportExportResult[];
  externalLaunches: ExternalLaunchIntentView[];
  takeovers: TakeoverConfirmationView[];
  interchangeFacts: InterchangeFactView[];
  readonly purposeStates: Map<string, ConsentState>;
  events: SolutionEvent[];
}

function youError(
  code: YouError["code"],
  message: string,
  details: Record<string, string | number | boolean> = {},
): EditingStudioError {
  return new EditingStudioError({ code, message, details, simulated: true });
}

function invalidState(message: string): EditingStudioError {
  return youError("YOU_INVALID_STATE", message);
}

/** 确定性 Tier-4 包字节（fixture：剧本 scope 派生；round-trip 恒等校验的基础）。 */
function storyboardPackageBytes(
  subjectContentRef: string,
  sessionId: string,
  format: string,
): Uint8Array {
  const scope = `package:${format}:${sessionId}:${subjectContentRef}`;
  const text = `${EDITING_STORYBOARD_SOLUTION_ID}:${scope}:${computeCaptureFixtureHash(scope)}`;
  return new TextEncoder().encode(text);
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 editingStudioRegistry）；
 * `load` 幂等：状态存在即复用（editing 平面是持久 workspace 表面）。
 */
export function createSimulatedEditingStudioController(): EditingStudioController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let state: SimulatedEditingState | null = null;

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
        id: nextId("fx-edit-event"),
        solutionId: EDITING_STORYBOARD_SOLUTION_ID,
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: {
          source: "you-phase0-editing-storyboard",
          generator,
          createdAt: clock.next(),
          lineage: [],
        },
      },
    ];
  };

  const consentReference = (): ConsentReference => {
    const states = EDITING_STORYBOARD_CONSENT_POLICY.purposes.map(
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
      policyId: EDITING_STORYBOARD_CONSENT_POLICY.id,
      state: aggregate,
      learningPermission: false,
    };
  };

  const consentProjection = (): EditingConsentProjection => ({
    policy: { ...EDITING_STORYBOARD_CONSENT_POLICY },
    purposeStates: [...EDITING_STORYBOARD_CONSENT_POLICY.purposes]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((purpose) => ({
        purpose,
        state: state?.purposeStates.get(purpose) ?? "unknown",
      })),
    reference: consentReference(),
  });

  const resolutionsView = (): readonly CandidateResolutionView[] =>
    state
      ? state.resolutions.map((resolution) => ({
          candidateId: resolution.candidateId,
          outcome: resolution.outcome,
          reason: resolution.reason,
        }))
      : [];

  const snapshot = (): EditingStudioSnapshot => {
    if (!state) throw invalidState("editing studio is not loaded");
    return {
      displayName: state.displayName,
      studioId: state.studioId,
      subjects: EDITING_STORYBOARD_SUBJECTS.map((subject) => ({ ...subject })),
      editorProfiles: EDITING_STORYBOARD_EDITOR_PROFILES.map((profile) => ({
        ...profile,
        supportsFormats: [...profile.supportsFormats],
      })),
      supportedFormats: [...EDITING_STORYBOARD_FORMATS],
      sessions: state.sessions,
      changeSets: state.changeSets,
      candidates: state.candidates,
      candidateResolutions: resolutionsView(),
      importExports: state.importExports,
      externalLaunches: state.externalLaunches,
      takeovers: state.takeovers,
      interchangeFacts: state.interchangeFacts,
      consent: consentProjection(),
      events: state.events,
      simulated: true,
    };
  };

  const bootstrap = (request: EditingStudioLoadRequest): void => {
    state = {
      studioId: "fx-editing-studio-001",
      displayName: EDITING_STORYBOARD_DISPLAY_NAME,
      sessions: [],
      changeSets: [],
      candidates: [],
      resolutions: [],
      importExports: [],
      externalLaunches: [],
      takeovers: [],
      interchangeFacts: [],
      purposeStates: new Map(
        EDITING_STORYBOARD_CONSENT_POLICY.purposes.map((purpose) => [
          purpose,
          "unknown" as ConsentState,
        ]),
      ),
      events: [],
    };
    appendEvent("solution-created", state.studioId, {
      surface: "editing-studio",
      workspaceKey: request.workspaceKey,
      studioId: state.studioId,
      subjectCount: EDITING_STORYBOARD_SUBJECTS.length,
    });
  };

  /** 会话解析（未知 id ⇒ YOU_EDIT_SESSION_NOT_FOUND——typed，绝不猜测）。 */
  const requireSession = (sessionId: OpaqueId): EditingSession => {
    if (!state) throw invalidState("editing studio is not loaded");
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      throw youError(
        "YOU_EDIT_SESSION_NOT_FOUND",
        `editing session ${sessionId} not found`,
        { reason: "unknown-editing-session", editingSessionId: sessionId },
      );
    }
    return session;
  };

  /** 服务端式硬门：指定用途必须显式 granted（无许可 ⇒ 不处理）。 */
  const assertPurposeConsent = (purpose: string): void => {
    const consent = consentProjection();
    const gate = projectEditingConsentGate(consent, purpose);
    if (!gate.allowed) {
      throw youError(
        "YOU_CONSENT_REQUIRED",
        `the action requires consent for purpose "${purpose}" (state: ${gate.state})`,
        { purpose, consentState: gate.state },
      );
    }
  };

  /** 终态迁移（open → committed | abandoned；记录替换，绝不原地覆写）。 */
  const closeSession = (
    input: EditingSessionInput,
    to: "committed" | "abandoned",
  ): EditingSession => {
    if (!state) throw invalidState("editing studio is not loaded");
    const session = requireSession(input.sessionId);
    if (!isLegalStoryboardEditingSessionTransition(session.status, to)) {
      throw invalidState(
        `editing session ${session.id} is ${session.status}, cannot transition to ${to} (terminal statuses stay locked)`,
      );
    }
    const closed: EditingSession = { ...session, status: to };
    state.sessions = state.sessions.map((candidate) =>
      candidate.id === closed.id ? closed : candidate,
    );
    appendEvent(
      "edit-session-closed",
      closed.id,
      {
        editingSessionId: closed.id,
        statusAfter: closed.status,
        simulated: true,
      },
      "user",
    );
    return closed;
  };

  /** 变更集解析（未知 id ⇒ typed 拒绝）。 */
  const requireChangeSet = (changeSetId: OpaqueId): EditChangeSet => {
    if (!state) throw invalidState("editing studio is not loaded");
    const changeSet = state.changeSets.find((candidate) => candidate.id === changeSetId);
    if (!changeSet) {
      throw invalidState(`edit change set ${changeSetId} not found`);
    }
    return changeSet;
  };

  /** parent 版本解析（subject 根或先前候选；否则 typed 拒绝）。 */
  const parentContentHashOf = (parentVersionId: OpaqueId): string | null => {
    if (!state) throw invalidState("editing studio is not loaded");
    const subject = storyboardSubjectById(parentVersionId);
    if (subject) return subject.contentHash;
    return (
      state.candidates.find((candidate) => candidate.id === parentVersionId)?.contentHash ?? null
    );
  };

  const controller: EditingStudioController = {
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

    async openSession(input: OpenEditingSessionInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      const subject = storyboardSubjectById(input.subjectArtifactId);
      if (!subject) {
        throw invalidState(`subject artifact ${input.subjectArtifactId} not found`);
      }
      // 注册面校验最先：未注册 editor kind ⇒ typed error，绝不静默回退（W5A/W5C 同语义）。
      if (storyboardEditorProfile(input.editorKind) === null) {
        throw youError(
          "YOU_EDITOR_UNSUPPORTED",
          `editor kind "${String(input.editorKind)}" is not registered`,
          {
            reason: "unregistered-editor-kind",
            editorKind: String(input.editorKind),
          },
        );
      }
      const session: EditingSession = {
        id: nextId("fx-editsession"),
        subjectArtifactId: subject.id,
        editorKind: input.editorKind,
        openedAt: clock.next(),
        status: "open",
      };
      state.sessions = [...state.sessions, session];
      appendEvent(
        "edit-session-opened",
        session.id,
        {
          editingSessionId: session.id,
          subjectArtifactId: session.subjectArtifactId,
          editorKind: session.editorKind,
          statusAfter: session.status,
          simulated: true,
        },
        "user",
      );
      return session;
    },

    async commitSession(input: EditingSessionInput) {
      return closeSession(input, "committed");
    },

    async abandonSession(input: EditingSessionInput) {
      return closeSession(input, "abandoned");
    },

    async previewCandidate(input: {
      readonly parentVersionId: OpaqueId;
      readonly ops: readonly EditChangeSetOp[];
    }) {
      if (!state) throw invalidState("editing studio is not loaded");
      // 纯确定性预览：不分配 id、不推进时钟、不落账（digest 内容派生）。
      const preview: CandidatePreview = {
        opRows: input.ops.map((op) => ({
          opId: op.id,
          kind: op.kind,
          payloadRef: op.payloadRef,
          payloadHash: op.payloadHash,
        })),
        parentVersionId: input.parentVersionId,
        parentContentHash: parentContentHashOf(input.parentVersionId),
        previewDigest: storyboardCandidatePreviewDigest(input.parentVersionId, input.ops),
      };
      return preview;
    },

    async proposeChangeSet(input: ProposeChangeSetInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      // 会话必须存在且 open（W5A 同语义）。
      const session = requireSession(input.sessionId);
      if (session.status !== "open") {
        throw invalidState(`editing session ${session.id} is ${session.status}, not open`);
      }
      // 校验最先（stateless、无时钟；违例 ⇒ YOU_CHANGESET_INVALID，绝不静默修复）。
      const violation = validateStoryboardChangeSet({ ops: input.ops });
      if (violation) {
        throw youError(
          "YOU_CHANGESET_INVALID",
          `invalid edit change set: ${violation.reason}${violation.opIndex !== null ? ` (op ${violation.opIndex}${violation.opId ? ` ${violation.opId}` : ""})` : ""}`,
          {
            reason: violation.reason,
            ...(violation.opIndex !== null ? { opIndex: violation.opIndex } : {}),
          },
        );
      }
      const changeSet: EditChangeSet = {
        id: nextId("fx-editchangeset"),
        sessionId: session.id,
        ops: input.ops.map((op) => ({ ...op })),
        createdAt: clock.next(),
      };
      state.changeSets = [...state.changeSets, changeSet];
      const opFacts: Record<string, string | number | boolean> = {
        opCount: changeSet.ops.length,
      };
      for (let index = 0; index < changeSet.ops.length; index += 1) {
        const op = changeSet.ops[index];
        if (op === undefined) continue;
        opFacts[`op.${index}.id`] = op.id;
        opFacts[`op.${index}.kind`] = op.kind;
        opFacts[`op.${index}.payloadRef`] = op.payloadRef;
        opFacts[`op.${index}.payloadHash`] = op.payloadHash;
      }
      appendEvent(
        "change-proposed",
        changeSet.id,
        {
          editChangeSetId: changeSet.id,
          editingSessionId: changeSet.sessionId,
          ...opFacts,
          simulated: true,
        },
        "user",
      );
      return changeSet;
    },

    async applyChangeSet(input: ApplyChangeSetInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      const changeSet = requireChangeSet(input.changeSetId);
      // 再校验（stateless；复用同一不变量）。
      const violation = validateStoryboardChangeSet(changeSet);
      if (violation) {
        throw youError("YOU_CHANGESET_INVALID", `invalid edit change set: ${violation.reason}`, {
          reason: violation.reason,
        });
      }
      const session = requireSession(changeSet.sessionId);
      if (session.status !== "open") {
        throw invalidState(`editing session ${session.id} is ${session.status}, not open`);
      }
      const parentContentHash = parentContentHashOf(input.parentVersionId);
      if (parentContentHash === null) {
        throw invalidState(
          `unknown parent version ${input.parentVersionId} (neither a registered subject nor a proposed candidate)`,
        );
      }
      // 确定性 fixture 应用：候选内容 = parent 内容与 op 寻址的哈希派生（内容寻址，
      // 绝不内联）；parent → candidate 谱系 append-only。
      const candidateScope = `candidate:${changeSet.id}:${input.parentVersionId}`;
      const binding = storyboardContentBinding(candidateScope);
      const candidate: CandidateVersion = {
        id: nextId("fx-editcandidate"),
        changeSetId: changeSet.id,
        parentVersionId: input.parentVersionId,
        contentRef: binding.contentRef,
        contentHash: binding.contentHash,
        proposedAt: clock.next(),
        simulated: true,
      };
      state.candidates = [...state.candidates, candidate];
      appendEvent(
        "change-set-applied",
        changeSet.id,
        {
          editChangeSetId: changeSet.id,
          editingSessionId: changeSet.sessionId,
          parentVersionId: input.parentVersionId,
          opCount: changeSet.ops.length,
          simulated: true,
        },
      );
      appendEvent(
        "candidate-version-proposed",
        candidate.id,
        {
          candidateId: candidate.id,
          editChangeSetId: candidate.changeSetId,
          parentVersionId: candidate.parentVersionId,
          contentRef: candidate.contentRef,
          contentHash: candidate.contentHash,
          simulated: candidate.simulated,
        },
      );
      return candidate;
    },

    async resolveCandidate(input: ResolveCandidateInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      const candidate = state.candidates.find((entry) => entry.id === input.candidateId);
      if (!candidate) {
        throw invalidState(`candidate version ${input.candidateId} not found`);
      }
      if (state.resolutions.some((resolution) => resolution.candidateId === candidate.id)) {
        throw invalidState(
          `candidate version ${candidate.id} is already resolved (append-only; resolves exactly once)`,
        );
      }
      const changeSet = state.changeSets.find((entry) => entry.id === candidate.changeSetId);
      const session = changeSet ? requireSession(changeSet.sessionId) : null;
      if (!session || session.status !== "open") {
        throw invalidState(
          "the candidate's editing session is not open (resolution requires an open session)",
        );
      }
      const resolution: SimulatedCandidateResolution = {
        candidateId: candidate.id,
        outcome: input.outcome,
        reason: input.reason,
      };
      state.resolutions = [...state.resolutions, resolution];
      // v1 事件纪律：change-accepted / change-rejected（append-only；无第二条权威路径）。
      appendEvent(
        input.outcome === "accepted" ? "change-accepted" : "change-rejected",
        candidate.id,
        {
          candidateId: candidate.id,
          editChangeSetId: candidate.changeSetId,
          editingSessionId: session.id,
          outcome: input.outcome,
          reason: input.reason,
          simulated: true,
        },
        "user",
      );
      return { candidate, outcome: input.outcome };
    },

    async exportFromSession(input: ExportFromSessionInput): Promise<EditingExportOutcome> {
      if (!state) throw invalidState("editing studio is not loaded");
      const session = requireSession(input.sessionId);
      if (session.status !== "open") {
        throw invalidState(`editing session ${session.id} is ${session.status}, not open`);
      }
      // format 支持校验：引擎 + editor profile 双面（不支持 ⇒ YOU_IMPORT_EXPORT_FAILED，
      // 绝不静默改道到其它 format）。
      if (!isStoryboardSupportedFormat(input.format)) {
        throw youError(
          "YOU_IMPORT_EXPORT_FAILED",
          `import/export failed: interchange format "${String(input.format)}" is not supported by the interchange engine`,
          { reason: "unsupported-format", format: String(input.format) },
        );
      }
      const profile = storyboardEditorProfile(session.editorKind);
      if (profile === null) {
        throw youError(
          "YOU_EDITOR_UNSUPPORTED",
          `editor kind "${String(session.editorKind)}" is not registered`,
          {
            reason: "unregistered-editor-kind",
            editorKind: String(session.editorKind),
          },
        );
      }
      if (!profile.supportsFormats.includes(input.format)) {
        throw youError(
          "YOU_IMPORT_EXPORT_FAILED",
          `import/export failed: editor kind "${String(session.editorKind)}" does not support interchange format "${String(input.format)}"`,
          {
            reason: "editor-format-unsupported",
            editorKind: String(session.editorKind),
            format: String(input.format),
          },
        );
      }
      const subject = storyboardSubjectById(session.subjectArtifactId);
      if (!subject) {
        throw invalidState(`subject artifact ${session.subjectArtifactId} not found`);
      }
      // 确定性导出组装：包内容 = scope 派生字节（同 state ⇒ 同包）；结果内容寻址。
      const packageBytes = storyboardPackageBytes(
        subject.contentRef,
        session.id,
        String(input.format),
      );
      const packageDigest = computeCaptureFixtureHash(
        new TextDecoder().decode(packageBytes),
      );
      const packageBinding = storyboardContentBinding(
        `export:${session.id}:${String(input.format)}`,
      );
      const result: ImportExportResult = {
        id: nextId("fx-importexport"),
        sessionId: session.id,
        format: input.format,
        status: "succeeded",
        contentRef: packageBinding.contentRef,
        contentHash: packageBinding.contentHash,
        completedAt: clock.next(),
        simulated: true,
      };
      state.importExports = [...state.importExports, result];
      state.interchangeFacts = [
        ...state.interchangeFacts,
        {
          resultId: result.id,
          direction: "export" as const,
          format: String(result.format),
          status: "succeeded" as const,
          packageDigest,
        },
      ];
      appendEvent(
        "import-export-completed",
        result.id,
        {
          importExportResultId: result.id,
          direction: "export",
          editingSessionId: session.id,
          format: String(result.format),
          status: result.status,
          contentRef: result.contentRef ?? "none",
          packageDigest,
          simulated: true,
        },
      );
      return { result, packageBytes, packageDigest };
    },

    async importEditPackage(input: ImportEditPackageInput): Promise<EditingImportOutcome> {
      if (!state) throw invalidState("editing studio is not loaded");
      // 引擎 format 校验最先。
      if (!isStoryboardSupportedFormat(input.format)) {
        throw youError(
          "YOU_IMPORT_EXPORT_FAILED",
          `import/export failed: interchange format "${String(input.format)}" is not supported by the interchange engine`,
          { reason: "unsupported-format", format: String(input.format) },
        );
      }
      // session 绑定解析（绑定则包 manifest 须指向该 session 的 subject）。
      let boundSessionId: OpaqueId | null = null;
      if (input.sessionId !== undefined) {
        const session = requireSession(input.sessionId);
        if (session.status !== "open") {
          throw invalidState(`editing session ${session.id} is ${session.status}, not open`);
        }
        boundSessionId = session.id;
      }
      // 包体确定性解析（fixture：前缀 + manifest 校验；导入内容在验证前不受信）。
      const decoded = new TextDecoder().decode(input.bytes);
      let packageValid =
        input.bytes.length > 0 &&
        decoded.startsWith(`${EDITING_STORYBOARD_SOLUTION_ID}:package:`);
      if (packageValid && boundSessionId !== null) {
        const session = state.sessions.find((candidate) => candidate.id === boundSessionId);
        const subject = session ? storyboardSubjectById(session.subjectArtifactId) : null;
        if (subject && !decoded.includes(subject.contentRef)) {
          // session 绑定的 manifest 不指向该 subject ⇒ invalid（typed，绝不静默修复）。
          packageValid = false;
        }
      }
      if (!packageValid) {
        // failed 结果记录诚实入账（truth law：失败也是事实）+ typed 拒绝。
        const failed: ImportExportResult = {
          id: nextId("fx-importexport"),
          sessionId: boundSessionId,
          format: input.format,
          status: "failed",
          contentRef: null,
          contentHash: null,
          completedAt: clock.next(),
          simulated: true,
        };
        state.importExports = [...state.importExports, failed];
        state.interchangeFacts = [
          ...state.interchangeFacts,
          {
            resultId: failed.id,
            direction: "import" as const,
            format: String(failed.format),
            status: "failed" as const,
            packageDigest: null,
          },
        ];
        appendEvent(
          "import-export-completed",
          failed.id,
          {
            importExportResultId: failed.id,
            direction: "import",
            editingSessionId: boundSessionId ?? "none",
            format: String(failed.format),
            status: failed.status,
            reason: "invalid-package",
            simulated: true,
          },
        );
        throw youError(
          "YOU_IMPORT_EXPORT_FAILED",
          "import/export failed: the imported package is invalid (untrusted until validated; the failure is journaled as a failed result)",
          {
            reason: "invalid-package",
            format: String(input.format),
            recordedResultId: failed.id,
          },
        );
      }
      const importBinding = storyboardContentBinding(
        `import:${computeCaptureFixtureHash(decoded)}`,
      );
      const result: ImportExportResult = {
        id: nextId("fx-importexport"),
        sessionId: boundSessionId,
        format: input.format,
        status: "succeeded",
        contentRef: importBinding.contentRef,
        contentHash: importBinding.contentHash,
        completedAt: clock.next(),
        simulated: true,
      };
      state.importExports = [...state.importExports, result];
      const packageDigest = computeCaptureFixtureHash(decoded);
      state.interchangeFacts = [
        ...state.interchangeFacts,
        {
          resultId: result.id,
          direction: "import" as const,
          format: String(result.format),
          status: "succeeded" as const,
          packageDigest,
        },
      ];
      appendEvent(
        "import-export-completed",
        result.id,
        {
          importExportResultId: result.id,
          direction: "import",
          editingSessionId: boundSessionId ?? "none",
          format: String(result.format),
          status: result.status,
          contentRef: result.contentRef ?? "none",
          packageDigest,
          simulated: true,
        },
      );
      return { result, packageDigest };
    },

    async requestExternalEditorLaunch(input: RequestExternalEditorLaunchInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      const session = requireSession(input.sessionId);
      if (session.status !== "open") {
        throw invalidState(`editing session ${session.id} is ${session.status}, not open`);
      }
      // 同意门（export 用途）最先：无许可 ⇒ 不处理（服务端式强制）。
      assertPurposeConsent(EDITING_STORYBOARD_LAUNCH_PURPOSE);
      // 投射意图携带 Tier-4 导出包（external 编辑器交接的 interchange 载体）。
      const profile = storyboardEditorProfile(session.editorKind);
      if (profile === null) {
        throw youError(
          "YOU_EDITOR_UNSUPPORTED",
          `editor kind "${String(session.editorKind)}" is not registered`,
          {
            reason: "unregistered-editor-kind",
            editorKind: String(session.editorKind),
          },
        );
      }
      const launchFormat = profile.supportsFormats[0] ?? "edit-interchange";
      const exportOutcome = await controller.exportFromSession({
        sessionId: session.id,
        format: launchFormat,
      });
      const packageResult = exportOutcome.result;
      const launch: ExternalLaunchIntentView = {
        launchId: nextId("fx-editlaunch"),
        sessionId: session.id,
        editorKind: session.editorKind,
        format: launchFormat,
        packageResultId: packageResult.id,
        requestedAt: clock.next(),
        simulated: true,
      };
      state.externalLaunches = [...state.externalLaunches, launch];
      appendEvent(
        "consent-recorded",
        launch.launchId,
        {
          kind: "external-editor-launch-intent",
          launchId: launch.launchId,
          editingSessionId: launch.sessionId,
          editorKind: String(launch.editorKind),
          format: String(launch.format),
          packageResultId: launch.packageResultId,
          projectedIntent: true,
          processControl: "none",
          simulated: true,
        },
        "user",
      );
      return launch;
    },

    async requestTakeoverConfirmation(input: EditingSessionInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      const session = requireSession(input.sessionId);
      if (session.status !== "open") {
        throw invalidState(`editing session ${session.id} is ${session.status}, not open`);
      }
      // 同意门（manual-takeover 用途）：确认必须由同意状态投影放行（wave-2 权威）。
      assertPurposeConsent(EDITING_STORYBOARD_TAKEOVER_PURPOSE);
      const takeover: TakeoverConfirmationView = {
        takeoverId: nextId("fx-edittakeover"),
        sessionId: session.id,
        subjectArtifactId: session.subjectArtifactId,
        confirmedAt: clock.next(),
        simulated: true,
      };
      state.takeovers = [...state.takeovers, takeover];
      appendEvent(
        "consent-recorded",
        takeover.takeoverId,
        {
          kind: "manual-takeover-confirmed",
          takeoverId: takeover.takeoverId,
          editingSessionId: takeover.sessionId,
          subjectArtifactId: takeover.subjectArtifactId,
          simulated: true,
        },
        "user",
      );
      return takeover;
    },

    async decideConsent(input: EditingConsentDecisionInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      if (input.policyId !== EDITING_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      if (!EDITING_STORYBOARD_CONSENT_POLICY.purposes.includes(input.purpose)) {
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
          kind: "operational",
          simulated: true,
        },
        "user",
      );
      return consentProjection();
    },

    async withdrawConsent(input: EditingWithdrawConsentInput) {
      if (!state) throw invalidState("editing studio is not loaded");
      if (input.policyId !== EDITING_STORYBOARD_CONSENT_POLICY.id) {
        throw invalidState(`consent policy ${input.policyId} not found`);
      }
      for (const purpose of EDITING_STORYBOARD_CONSENT_POLICY.purposes) {
        state.purposeStates.set(purpose, "withdrawn");
      }
      appendEvent(
        "consent-withdrawn",
        input.policyId,
        {
          purposes: EDITING_STORYBOARD_CONSENT_POLICY.purposes.join(","),
          simulated: true,
        },
        "user",
      );
      return consentProjection();
    },
  };

  return controller;
}
