/* oxlint-disable eslint(max-lines) -- 模拟控制器按 SolutionSurfaceController 端口逐方法实现（Phase-0 剧本会话 + 外部编辑器存根）；T1 换绑 Worker A 的 solutionService 后本文件整体退役，拆分只会增加退役成本。 */
// YOU Solution Studio — 确定性模拟控制器（W1B，Phase 0）。
//
// 这是 `SolutionSurfaceController` 端口的确定性剧本实现：
// - 状态只在内存中按剧本推进；所有 id 来自固定前缀计数器，时间戳来自 StoryboardClock；
// - SolutionVersion / EditSession / ChangeSet / CapabilityGap / ArenaEscalationRef /
//   SolutionEvent 一律不可变、append-only（CONTRACTS.md versioning）；
// - Truth law：backing = "fixture-simulated"，每个快照 simulated: true；不伪造 provider 成功。
// TODO(T1): bind to solutionService（Worker A `you/w1a-core`）——本文件届时整体退役。
import type {
  ArenaEscalationRef,
  CapabilityGap,
  ChangeSet,
  ChangeSetVerification,
  ConsentReference,
  EditSession,
  EditorRecommendation,
  EvidenceRequest,
  FeedbackCategory,
  FeedbackRequest,
  OpaqueId,
  SolutionEntity,
  SolutionEvent,
  SolutionEventType,
  SolutionIdentity,
  SolutionPatchOperation,
  SolutionSelector,
  SolutionStatePatch,
  SolutionStateSnapshot,
  SolutionVersion,
  YouError,
} from "@zcode/shared";
import {
  SolutionSurfaceError,
  type EditSessionInput,
  type EvidenceRequestInput,
  type FeedbackSubmission,
  type ManualCorrectionInput,
  type RepeatIntentResult,
  type SolutionLearningCandidate,
  type SolutionSurfaceController,
  type SolutionSurfaceLoadRequest,
  type SolutionSurfaceSnapshot,
} from "./solutionController.js";
import {
  buildSolutionPackageManifest,
  diffSolutionVersionAgainst,
  parseSolutionPackageManifest,
  serializeSolutionPackageManifest,
  type SolutionPackageManifest,
} from "./solutionExportModel.js";
import { applySolutionStatePatch, deriveOperationsFromDiff } from "./solutionPatch.js";
import {
  ARENA_RESULT_DELTA,
  FEEDBACK_CATEGORY_TARGET,
  IMPROVEMENT_DELTA,
  STORYBOARD_ARENA_EXPERT_RESULTS,
  STORYBOARD_CAPABILITY_GAP,
  STORYBOARD_EDITOR_RECOMMENDATION,
  STORYBOARD_ESCALATION_MINIMUM_CONTEXT,
  STORYBOARD_INTENT,
  STORYBOARD_LEARNED_PREFERENCE,
  STORYBOARD_SOLUTION_IDENTITY,
  STORYBOARD_TAKEOVER_CORRECTION,
  StoryboardClock,
  buildStoryboardV1State,
  clampQualityScore,
  storyboardEvidenceRequestTemplate,
  storyboardProvenance,
} from "./solutionStoryboard.js";

const NATIVE_EDITOR = {
  editorRef: "you-native-editor",
  editorVersion: "phase0-1",
  platform: "zcode-workbench",
} as const;

const CONSENT_POLICY_ID = "fx-consent-policy-001";

function invalidState(message: string, simulated = true): SolutionSurfaceError {
  const youError: YouError = {
    code: "YOU_INVALID_STATE",
    message,
    details: {},
    simulated,
  };
  return new SolutionSurfaceError(youError);
}

function notFound(message: string): SolutionSurfaceError {
  return new SolutionSurfaceError({
    code: "YOU_VERSION_NOT_FOUND",
    message,
    details: {},
    simulated: true,
  });
}

function passedVerification(detail: string): ChangeSetVerification {
  return { checks: [{ name: "deterministic-fixture-check", passed: true, detail }], passed: true };
}

interface SimulatedSession {
  identity: SolutionIdentity;
  versions: SolutionVersion[];
  changeSets: ChangeSet[];
  feedback: FeedbackRequest[];
  evidenceRequests: EvidenceRequest[];
  editSessions: EditSession[];
  events: SolutionEvent[];
  learningPermission: ConsentReference;
  learningCandidate: SolutionLearningCandidate | null;
  capabilityGaps: CapabilityGap[];
  escalations: ArenaEscalationRef[];
  lastRepeatIntent: RepeatIntentResult | null;
}

/**
 * 创建确定性模拟控制器。每个 workspace 一个实例（见 solutionSurfaceRegistry）；
 * `load` 幂等：会话存在即复用（ADR-002：Solution 是持久 workspace 表面）。
 */
export function createSimulatedSolutionSurfaceController(): SolutionSurfaceController {
  const clock = new StoryboardClock();
  let idSeq = 0;
  let session: SimulatedSession | null = null;

  const nextId = (prefix: string): string => {
    idSeq += 1;
    return `${prefix}-${String(idSeq).padStart(3, "0")}`;
  };

  const appendEvent = (
    type: SolutionEventType,
    subjectRef: OpaqueId | null,
    payload: Record<string, string | number | boolean> = {},
  ): void => {
    if (!session) return;
    session.events = [
      ...session.events,
      {
        id: nextId("fx-event"),
        solutionId: session.identity.id,
        type,
        occurredAt: clock.next(),
        subjectRef,
        payload,
        provenance: storyboardProvenance(clock),
      },
    ];
  };

  const currentVersion = (): SolutionVersion => {
    const latest = session?.versions.at(-1);
    if (!latest) {
      throw invalidState("solution session is not loaded");
    }
    return latest;
  };

  const currentState = (): SolutionStateSnapshot => currentVersion().state;

  const snapshot = (): SolutionSurfaceSnapshot => {
    if (!session) {
      throw invalidState("solution session is not loaded");
    }
    return {
      identity: session.identity,
      versions: session.versions,
      pendingChangeSets: session.changeSets.filter((changeSet) => changeSet.status === "proposed"),
      feedback: session.feedback,
      evidenceRequests: session.evidenceRequests,
      editSessions: session.editSessions,
      events: session.events,
      learningPermission: session.learningPermission,
      capabilityGaps: session.capabilityGaps,
      escalations: session.escalations,
      intentSummary: STORYBOARD_INTENT.text,
      lastRepeatIntent: session.lastRepeatIntent,
      learningCandidate: session.learningCandidate,
      simulated: true,
    };
  };

  const bootstrap = (request: SolutionSurfaceLoadRequest): void => {
    const identity: SolutionIdentity = {
      id: STORYBOARD_SOLUTION_IDENTITY.id,
      workspaceIdentity: request.workspaceKey,
      displayName: STORYBOARD_SOLUTION_IDENTITY.displayName,
    };
    const v1: SolutionVersion = {
      id: nextId("fx-version"),
      solutionId: identity.id,
      version: 1,
      parentVersionId: null,
      state: buildStoryboardV1State(),
      provenance: storyboardProvenance(clock),
    };
    session = {
      identity,
      versions: [v1],
      changeSets: [],
      feedback: [],
      evidenceRequests: [],
      editSessions: [],
      events: [],
      learningPermission: {
        policyId: CONSENT_POLICY_ID,
        state: "unknown",
        learningPermission: false,
      },
      learningCandidate: null,
      capabilityGaps: [],
      escalations: [],
      lastRepeatIntent: null,
    };
    appendEvent("solution-created", identity.id, { intent: STORYBOARD_INTENT.id });
    appendEvent("version-published", v1.id, { version: 1, authorType: "fixture" });
  };

  const publishVersion = (
    inputVersion: SolutionVersion,
    patch: SolutionStatePatch,
    generator: SolutionVersion["provenance"]["generator"],
  ): SolutionVersion => {
    if (!session) throw invalidState("solution session is not loaded");
    const next: SolutionVersion = {
      id: nextId("fx-version"),
      solutionId: inputVersion.solutionId,
      version: inputVersion.version + 1,
      parentVersionId: inputVersion.id,
      state: applySolutionStatePatch(inputVersion.state, patch),
      provenance: {
        source: "you-phase0-storyboard",
        generator,
        createdAt: clock.next(),
        lineage: [...inputVersion.provenance.lineage, inputVersion.id],
      },
    };
    session.versions = [...session.versions, next];
    appendEvent("version-published", next.id, { version: next.version, authorType: generator });
    return next;
  };

  const findChangeSet = (changeSetId: OpaqueId): ChangeSet => {
    const changeSet = session?.changeSets.find((candidate) => candidate.id === changeSetId);
    if (!changeSet) throw notFound(`change set ${changeSetId} not found`);
    return changeSet;
  };

  const replaceChangeSet = (next: ChangeSet): void => {
    if (!session) throw invalidState("solution session is not loaded");
    session.changeSets = session.changeSets.map((candidate) =>
      candidate.id === next.id ? next : candidate,
    );
  };

  const proposeChangeSet = (input: {
    intentRef: OpaqueId | null;
    targetRef: SolutionSelector | null;
    operations: readonly SolutionPatchOperation[];
    evidenceRefs: readonly OpaqueId[];
    authorType: ChangeSet["authorType"];
    verificationDetail: string;
  }): ChangeSet => {
    if (!session) throw invalidState("solution session is not loaded");
    const changeSet: ChangeSet = {
      id: nextId("fx-cs"),
      intentRef: input.intentRef,
      targetRef: input.targetRef,
      inputVersionId: currentVersion().id,
      proposedOperations: input.operations,
      evidenceRefs: input.evidenceRefs,
      executionRef: null,
      verification: passedVerification(input.verificationDetail),
      resultingVersionId: null,
      status: "proposed",
      authorType: input.authorType,
    };
    session.changeSets = [...session.changeSets, changeSet];
    appendEvent("change-proposed", changeSet.id, { authorType: input.authorType });
    return changeSet;
  };

  const improvementPatchFor = (category: FeedbackCategory): SolutionStatePatch => {
    const deficiencyClass = FEEDBACK_CATEGORY_TARGET[category] ?? "other";
    const delta = IMPROVEMENT_DELTA[deficiencyClass] ?? 0;
    const operations: SolutionPatchOperation[] = [
      { op: "adjust_quality", deficiencyClass, delta },
    ];
    const state = currentState();
    if (category === "geometry" || category === "appearance") {
      const head = state.entities.find(
        (entity): entity is SolutionEntity => entity.id === "fx-human-head",
      );
      if (head) {
        const symmetry = head.attributes.symmetry;
        operations.push({
          op: "upsert_entity",
          entity: {
            ...head,
            attributes: {
              ...head.attributes,
              symmetry: clampQualityScore((typeof symmetry === "number" ? symmetry : 0.6) + delta),
              meshDetail: "high",
            },
          },
        });
      }
    }
    return { baseVersionId: currentVersion().id, operations };
  };

  const controller: SolutionSurfaceController = {
    backing: "fixture-simulated",

    async load(request) {
      if (!session) {
        bootstrap(request);
      }
      return snapshot();
    },

    async refresh() {
      return snapshot();
    },

    async submitFeedback(submission: FeedbackSubmission) {
      if (!session) throw invalidState("solution session is not loaded");
      const request: FeedbackRequest = {
        id: nextId("fx-fb"),
        scope: submission.scope,
        targetRef: submission.targetRef,
        category: submission.category,
        userComment: submission.userComment,
        sourceSolutionVersionId: currentVersion().id,
        requestedAction: submission.requestedAction,
        status: "open",
        createdAt: clock.next(),
        consent: session.learningPermission,
      };
      session.feedback = [...session.feedback, request];
      appendEvent("feedback-submitted", request.id, { category: submission.category });
      return request;
    },

    async requestEvidence(input: EvidenceRequestInput) {
      if (!session) throw invalidState("solution session is not loaded");
      const evidence: EvidenceRequest = {
        id: nextId("fx-evreq"),
        ...storyboardEvidenceRequestTemplate(input.targetDeficiency),
      };
      session.evidenceRequests = [...session.evidenceRequests, evidence];
      appendEvent("evidence-requested", evidence.id, {
        evidenceType: evidence.evidenceType,
        feedback: input.feedbackRequestId,
      });
      return evidence;
    },

    async attachFixtureEvidence(evidenceRequestId) {
      const existing = session?.evidenceRequests.find(
        (candidate) => candidate.id === evidenceRequestId,
      );
      if (!existing) throw notFound(`evidence request ${evidenceRequestId} not found`);
      const next: EvidenceRequest = { ...existing, status: "fulfilled" };
      if (!session) throw invalidState("solution session is not loaded");
      session.evidenceRequests = session.evidenceRequests.map((candidate) =>
        candidate.id === evidenceRequestId ? next : candidate,
      );
      appendEvent("evidence-provided", next.id, { simulated: true });
      return next;
    },

    async proposeDeterministicImprovement(feedbackRequestId) {
      if (!session) throw invalidState("solution session is not loaded");
      const feedback = session.feedback.find(
        (candidate) => candidate.id === feedbackRequestId,
      );
      if (!feedback) throw notFound(`feedback ${feedbackRequestId} not found`);
      const evidenceRefs = session.evidenceRequests
        .filter((candidate) => candidate.status === "fulfilled")
        .map((candidate) => candidate.id);
      return proposeChangeSet({
        intentRef: STORYBOARD_INTENT.id,
        targetRef: feedback.targetRef,
        operations: improvementPatchFor(feedback.category).operations,
        evidenceRefs,
        authorType: "agent",
        verificationDetail: `deterministic delta for ${feedback.category}`,
      });
    },

    async acceptChangeSet(changeSetId) {
      const changeSet = findChangeSet(changeSetId);
      if (changeSet.status !== "proposed") {
        throw invalidState(`change set ${changeSetId} is ${changeSet.status}, not proposed`);
      }
      if (!session) throw invalidState("solution session is not loaded");
      const inputVersion =
        session.versions.find((version) => version.id === changeSet.inputVersionId) ??
        currentVersion();
      const patch: SolutionStatePatch = {
        baseVersionId: inputVersion.id,
        operations: changeSet.proposedOperations,
      };
      const nextVersion = publishVersion(
        inputVersion,
        patch,
        changeSet.authorType === "fixture" ? "fixture" : changeSet.authorType,
      );
      replaceChangeSet({
        ...changeSet,
        status: "accepted",
        resultingVersionId: nextVersion.id,
      });
      appendEvent("change-accepted", changeSet.id, { version: nextVersion.version });
      if (changeSet.authorType === "expert") {
        appendEvent("arena-result-applied", changeSet.id, {});
      }
      for (const feedback of session.feedback) {
        if (
          feedback.status === "open" &&
          changeSet.targetRef &&
          feedback.targetRef === changeSet.targetRef
        ) {
          session.feedback = session.feedback.map((candidate) =>
            candidate.id === feedback.id ? { ...candidate, status: "addressed" } : candidate,
          );
        }
      }
      // 手动接管被接受 → 记录学习候选（仅候选；学习须显式许可）。
      if (changeSet.authorType === "user" && !session.learningCandidate) {
        session.learningCandidate = {
          summary: STORYBOARD_LEARNED_PREFERENCE.summary,
          scope: "USER",
          sourceEditSessionId: changeSet.evidenceRefs[0] ?? "",
        };
      }
      return nextVersion;
    },

    async rejectChangeSet(changeSetId) {
      const changeSet = findChangeSet(changeSetId);
      if (changeSet.status !== "proposed") {
        throw invalidState(`change set ${changeSetId} is ${changeSet.status}, not proposed`);
      }
      replaceChangeSet({ ...changeSet, status: "rejected" });
      appendEvent("change-rejected", changeSet.id, { kind: "rejected" });
      return { ...changeSet, status: "rejected" };
    },

    async revertChangeSet(changeSetId) {
      const changeSet = findChangeSet(changeSetId);
      if (changeSet.status !== "proposed") {
        throw invalidState(`change set ${changeSetId} is ${changeSet.status}, not proposed`);
      }
      replaceChangeSet({ ...changeSet, status: "reverted" });
      appendEvent("change-rejected", changeSet.id, { kind: "reverted" });
      return { ...changeSet, status: "reverted" };
    },

    async openEditSession(input: EditSessionInput) {
      if (!session) throw invalidState("solution session is not loaded");
      const openSession = session.editSessions.find((candidate) => candidate.endedAt === null);
      if (openSession) {
        throw invalidState(`edit session ${openSession.id} is already open`);
      }
      const editSession: EditSession = {
        id: nextId("fx-es"),
        solutionId: session.identity.id,
        inputVersionId: currentVersion().id,
        editorRef: NATIVE_EDITOR.editorRef,
        editorVersion: NATIVE_EDITOR.editorVersion,
        platform: NATIVE_EDITOR.platform,
        mode: input.mode,
        evidenceMode: "observed",
        startedAt: clock.next(),
        endedAt: null,
        sourceArtifactId: null,
        resultingArtifactId: null,
        diffRef: null,
        learningPermission: session.learningPermission,
        provenance: storyboardProvenance(clock),
      };
      session.editSessions = [...session.editSessions, editSession];
      appendEvent("edit-session-opened", editSession.id, { mode: input.mode });
      return editSession;
    },

    async submitManualCorrection(input: ManualCorrectionInput) {
      if (!session) throw invalidState("solution session is not loaded");
      const editSession = session.editSessions.find((candidate) => candidate.id === input.editSessionId);
      if (!editSession) throw notFound(`edit session ${input.editSessionId} not found`);
      if (editSession.endedAt !== null) {
        throw invalidState(`edit session ${input.editSessionId} is closed`);
      }
      const entity = currentState().entities.find(
        (candidate) => candidate.id === input.entityId,
      );
      if (!entity) throw notFound(`entity ${input.entityId} not found`);
      return proposeChangeSet({
        intentRef: null,
        targetRef: { kind: "entity", entityId: entity.id },
        operations: [
          { op: "upsert_entity", entity: { ...entity, transform: input.transform } },
        ],
        evidenceRefs: [editSession.id],
        authorType: "user",
        verificationDetail: `observed transform correction: ${input.note}`,
      });
    },

    async closeEditSession(editSessionId) {
      if (!session) throw invalidState("solution session is not loaded");
      const editSession = session.editSessions.find(
        (candidate) => candidate.id === editSessionId,
      );
      if (!editSession) throw notFound(`edit session ${editSessionId} not found`);
      if (editSession.endedAt !== null) return editSession;
      const closed: EditSession = { ...editSession, endedAt: clock.next() };
      session.editSessions = session.editSessions.map((candidate) =>
        candidate.id === editSessionId ? closed : candidate,
      );
      appendEvent("edit-session-closed", closed.id, {});
      return closed;
    },

    async setLearningPermission(granted) {
      if (!session) throw invalidState("solution session is not loaded");
      session.learningPermission = {
        policyId: CONSENT_POLICY_ID,
        state: granted ? "granted" : "denied",
        learningPermission: granted,
      };
      return session.learningPermission;
    },

    async recommendEditor(): Promise<EditorRecommendation> {
      return { ...STORYBOARD_EDITOR_RECOMMENDATION };
    },

    async exportPackage(versionId) {
      if (!session) throw invalidState("solution session is not loaded");
      const version =
        session.versions.find((candidate) => candidate.id === versionId) ?? currentVersion();
      const lineage = session.versions
        .filter((candidate) => candidate.version < version.version)
        .map((candidate) => candidate.id);
      return buildSolutionPackageManifest({
        version,
        lineage,
        editor: { ...STORYBOARD_EDITOR_RECOMMENDATION },
        consent: session.learningPermission,
        exportedAt: clock.next(),
        intent: { id: STORYBOARD_INTENT.id, text: STORYBOARD_INTENT.text },
        workspaceIdentity: session.identity.workspaceIdentity,
        displayName: session.identity.displayName,
      });
    },

    async importPackage(manifest) {
      if (!session) throw invalidState("solution session is not loaded");
      const current = currentVersion();
      const diff = diffSolutionVersionAgainst(manifest.version, current);
      const operations = deriveOperationsFromDiff(
        diff,
        (id) => manifest.version.state.entities.find((entity) => entity.id === id),
        manifest.version.state.environment,
      );
      return proposeChangeSet({
        intentRef: manifest.intent?.id ?? null,
        targetRef: null,
        operations,
        evidenceRefs: [],
        authorType: "importer",
        verificationDetail: diff.identical
          ? "import is byte-identical to the current canonical version"
          : `truthful diff: ${diff.entityChanges.length} entity change(s), ${diff.qualityChanges.length} quality change(s)`,
      });
    },

    async repeatIntent(intentId) {
      if (!session) throw invalidState("solution session is not loaded");
      if (intentId !== STORYBOARD_INTENT.id) {
        throw notFound(`intent ${intentId} not found`);
      }
      const learningApplied =
        session.learningPermission.learningPermission && session.learningCandidate !== null;
      const state = currentState();
      const operations: SolutionPatchOperation[] = [];
      if (learningApplied) {
        const arm = state.entities.find(
          (candidate) => candidate.id === "fx-human-arm-right",
        );
        if (arm) {
          operations.push({
            op: "upsert_entity",
            entity: { ...arm, transform: STORYBOARD_TAKEOVER_CORRECTION },
          });
        }
      }
      const changeSet = proposeChangeSet({
        intentRef: STORYBOARD_INTENT.id,
        targetRef: null,
        operations,
        evidenceRefs: [],
        authorType: "agent",
        verificationDetail: learningApplied
          ? "prior user correction (wave pose) applied"
          : "baseline regeneration; no prior learning applied",
      });
      const result: RepeatIntentResult = {
        changeSet,
        learningApplied,
        learningScope: "USER",
        summary: learningApplied
          ? STORYBOARD_LEARNED_PREFERENCE.summary
          : "No prior learning applied — learning permission has not been granted.",
      };
      session.lastRepeatIntent = result;
      return result;
    },

    async triggerCapabilityGapFixture() {
      if (!session) throw invalidState("solution session is not loaded");
      const gap: CapabilityGap = { ...STORYBOARD_CAPABILITY_GAP };
      session.capabilityGaps = [...session.capabilityGaps, gap];
      appendEvent("capability-gap-detected", gap.id, { category: gap.category });
      return gap;
    },

    async escalateToArena(capabilityGapId) {
      if (!session) throw invalidState("solution session is not loaded");
      const gapIndex = session.capabilityGaps.findIndex(
        (candidate) => candidate.id === capabilityGapId,
      );
      const gap = session.capabilityGaps[gapIndex];
      if (!gap) throw notFound(`capability gap ${capabilityGapId} not found`);
      if (gap.escalationEligibility === "not-eligible") {
        throw invalidState(`capability gap ${capabilityGapId} is not eligible for escalation`);
      }
      const expertResult =
        STORYBOARD_ARENA_EXPERT_RESULTS[gap.category] ?? STORYBOARD_ARENA_EXPERT_RESULTS.TOOL_GAP!;
      const escalation: ArenaEscalationRef = {
        escalationId: nextId("fx-esc"),
        status: "delivered",
        minimumContext: [...STORYBOARD_ESCALATION_MINIMUM_CONTEXT],
        expertResult: { ...expertResult },
      };
      session.escalations = [...session.escalations, escalation];
      session.capabilityGaps = session.capabilityGaps.map((candidate, index) =>
        index === gapIndex
          ? { ...candidate, escalationEligibility: "escalated", arenaEscalationRef: escalation }
          : candidate,
      );
      appendEvent("arena-escalation-requested", escalation.escalationId, {
        status: escalation.status,
      });
      return escalation;
    },

    async applyArenaResult(escalationId) {
      if (!session) throw invalidState("solution session is not loaded");
      const escalation = session.escalations.find(
        (candidate) => candidate.escalationId === escalationId,
      );
      if (!escalation) throw notFound(`escalation ${escalationId} not found`);
      if (!escalation.expertResult) {
        throw invalidState(`escalation ${escalationId} has no expert result yet`);
      }
      const state = currentState();
      const hand = state.entities.find((candidate) => candidate.id === "fx-human-hand-right");
      const operations: SolutionPatchOperation[] = [
        {
          op: "adjust_quality",
          deficiencyClass: "motion_naturalness",
          delta: ARENA_RESULT_DELTA.motion_naturalness ?? 0,
        },
      ];
      if (hand) {
        operations.push({
          op: "upsert_entity",
          entity: { ...hand, attributes: { ...hand.attributes, articulation: "fine" } },
        });
      }
      return proposeChangeSet({
        intentRef: STORYBOARD_INTENT.id,
        targetRef: null,
        operations,
        evidenceRefs: [escalation.escalationId],
        authorType: "expert",
        verificationDetail: "arena typed-payload applied through YOU authority",
      });
    },
  };

  return controller;
}

/**
 * 剧本外部编辑器存根：对导出包做确定性「编辑」（演示 truthful re-import diff）。
 * 这是 adapter 存根，不是 Blender 集成——结果明确标注 simulated。
 */
export function applyStoryboardExternalEditorEdits(
  manifest: SolutionPackageManifest,
): SolutionPackageManifest {
  const serialized = serializeSolutionPackageManifest(manifest);
  const parsed = parseSolutionPackageManifest(serialized);
  const edits = parsed.version.state.entities.map((entity) => {
    if (entity.id !== "fx-human-arm-right") return entity;
    return {
      ...entity,
      transform: {
        ...entity.transform,
        rotation: [
          entity.transform.rotation[0],
          entity.transform.rotation[1],
          -2.05,
        ] as SolutionEntity["transform"]["rotation"],
      },
    };
  });
  return {
    ...parsed,
    exportedAt: parsed.exportedAt,
    version: {
      ...parsed.version,
      state: {
        ...parsed.version.state,
        entities: edits,
        quality: {
          ...parsed.version.state.quality,
          appearance: clampQualityScore(
            (parsed.version.state.quality.appearance ?? 0.61) + 0.04,
          ),
        },
        environment: {
          ...parsed.version.state.environment,
          ambientIntensity: 0.68,
        },
      },
    },
  };
}
