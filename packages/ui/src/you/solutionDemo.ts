// YOU Solution Studio — 确定性 operator demo 驱动器（W1B）。
//
// 覆盖 docs/you/FIXTURES.md「Phase-0 loop fixture」全链路：
// intent -> solution -> feedback -> evidence request -> deterministic improvement ->
// manual takeover -> EditSession -> export/editor -> re-import/diff ->
// learning (with permission) -> repeated intent -> CapabilityGap -> Arena mock。
//
// 法则：只用确定性 fixture 数据；每步产出的 outcome 是可断言的 golden 期望；
// UI 层处处标注 "Deterministic simulated demo"（truth law——不伪造 provider 成功）。
import type { SolutionSelector } from "@zcode/shared";
import type { SolutionSurfaceController } from "./solutionController.js";
import type { SolutionPanelId } from "./solutionStore.js";
import {
  STORYBOARD_INTENT,
  STORYBOARD_TAKEOVER_CORRECTION,
} from "./solutionStoryboard.js";
import {
  applyStoryboardExternalEditorEdits,
} from "./solutionSimulatedController.js";
import {
  diffSolutionVersionAgainst,
  serializeSolutionPackageManifest,
} from "./solutionExportModel.js";

export type SolutionDemoStepId =
  | "intent"
  | "feedback"
  | "evidence-request"
  | "evidence-provided"
  | "improvement-proposed"
  | "improvement-accepted"
  | "takeover-open"
  | "takeover-correction"
  | "takeover-accepted"
  | "learning-consent"
  | "export"
  | "re-import"
  | "re-import-accepted"
  | "repeated-intent"
  | "capability-gap"
  | "arena-escalate"
  | "arena-apply";

export interface SolutionDemoStep {
  readonly id: SolutionDemoStepId;
  readonly titleMessageId: string;
  readonly descriptionMessageId: string;
}

function step(id: SolutionDemoStepId): SolutionDemoStep {
  return {
    id,
    titleMessageId: `you.demo.step.${id}.title`,
    descriptionMessageId: `you.demo.step.${id}.description`,
  };
}

export const SOLUTION_DEMO_STEPS: readonly SolutionDemoStep[] = [
  step("intent"),
  step("feedback"),
  step("evidence-request"),
  step("evidence-provided"),
  step("improvement-proposed"),
  step("improvement-accepted"),
  step("takeover-open"),
  step("takeover-correction"),
  step("takeover-accepted"),
  step("learning-consent"),
  step("export"),
  step("re-import"),
  step("re-import-accepted"),
  step("repeated-intent"),
  step("capability-gap"),
  step("arena-escalate"),
  step("arena-apply"),
];

/** 步骤对视图状态的提示（由 useSolutionSurface 应用；驱动器不直接写 store）。 */
export interface SolutionDemoUiHint {
  readonly selection?: SolutionSelector | null;
  readonly panel?: SolutionPanelId;
  readonly mode?: "view" | "edit";
}

export interface SolutionDemoStepOutcome {
  readonly stepId: SolutionDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（版本 / ChangeSet / EditSession / gap 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: SolutionDemoUiHint;
  /** export 步骤的 manifest JSON（供演示面板展示）。 */
  readonly manifestJson?: string;
}

function outcome(
  stepId: SolutionDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: SolutionDemoUiHint = {},
  manifestJson?: string,
): SolutionDemoStepOutcome {
  return { stepId, summary, refs, uiHint, ...(manifestJson === undefined ? {} : { manifestJson }) };
}

/**
 * 执行一步剧本。控制器必须已 load（driver 的 intent 步骤负责 load）。
 * 每步只做确定性操作；任何非法状态都会抛出端口级 typed error。
 */
export async function runSolutionDemoStep(
  controller: SolutionSurfaceController,
  step: SolutionDemoStep,
): Promise<SolutionDemoStepOutcome> {
  switch (step.id) {
    case "intent": {
      const snapshot = await controller.load({ workspaceKey: "you-phase0-demo" });
      const version = snapshot.versions.at(-1);
      return outcome(
        "intent",
        `Intent accepted. Solution "${snapshot.identity.displayName}" published v${version?.version ?? 1} (deterministic fixture).`,
        [STORYBOARD_INTENT.id, version?.id ?? ""],
        { panel: "viewport", selection: null },
      );
    }
    case "feedback": {
      const selection: SolutionSelector = { kind: "region", regionId: "region.face" };
      const feedback = await controller.submitFeedback({
        targetRef: selection,
        category: "geometry",
        userComment: "The head geometry looks too coarse around the cheeks.",
        requestedAction: "Refine head geometry",
        scope: "USER",
      });
      return outcome(
        "feedback",
        `FeedbackRequest ${feedback.id} recorded (category: geometry, scope: USER).`,
        [feedback.id],
        { selection, panel: "feedback" },
      );
    }
    case "evidence-request": {
      const snapshot = await controller.refresh();
      const feedback = snapshot.feedback.at(-1);
      if (!feedback) throw new Error("demo: feedback missing");
      const evidence = await controller.requestEvidence({
        feedbackRequestId: feedback.id,
        targetDeficiency: "geometry",
        evidenceType: "fixture",
        reason: "Fixture reference framing resolves the geometry deficiency without real capture.",
      });
      return outcome(
        "evidence-request",
        `Agent requested targeted fixture evidence (${evidence.id}); privacy: ${evidence.privacyRequirements}.`,
        [evidence.id],
        {},
      );
    }
    case "evidence-provided": {
      const snapshot = await controller.refresh();
      const evidence = snapshot.evidenceRequests.find(
        (candidate) => candidate.status === "requested",
      );
      if (!evidence) throw new Error("demo: pending evidence request missing");
      const provided = await controller.attachFixtureEvidence(evidence.id);
      return outcome(
        "evidence-provided",
        `Synthetic fixture evidence attached (${provided.id} -> ${provided.status}). No real biometric data was collected.`,
        [provided.id],
        {},
      );
    }
    case "improvement-proposed": {
      const snapshot = await controller.refresh();
      const feedback = snapshot.feedback.at(-1);
      if (!feedback) throw new Error("demo: feedback missing");
      const changeSet = await controller.proposeDeterministicImprovement(feedback.id);
      return outcome(
        "improvement-proposed",
        `Agent proposed ChangeSet ${changeSet.id}: geometry +0.24, head symmetry +0.24 (deterministic delta).`,
        [changeSet.id],
        { panel: "feedback" },
      );
    }
    case "improvement-accepted": {
      const snapshot = await controller.refresh();
      const changeSet = snapshot.pendingChangeSets.at(-1);
      if (!changeSet) throw new Error("demo: proposed improvement missing");
      const version = await controller.acceptChangeSet(changeSet.id);
      return outcome(
        "improvement-accepted",
        `ChangeSet accepted -> canonical v${version.version} (id ${version.id}).`,
        [version.id, changeSet.id],
        {},
      );
    }
    case "takeover-open": {
      const editSession = await controller.openEditSession({ mode: "correct" });
      return outcome(
        "takeover-open",
        `EditSession ${editSession.id} opened (mode: correct, evidence: observed, editor: you-native-editor).`,
        [editSession.id],
        { panel: "takeover", mode: "edit", selection: { kind: "entity", entityId: "fx-human-arm-right" } },
      );
    }
    case "takeover-correction": {
      const snapshot = await controller.refresh();
      const editSession = snapshot.editSessions.find((candidate) => candidate.endedAt === null);
      if (!editSession) throw new Error("demo: open edit session missing");
      const changeSet = await controller.submitManualCorrection({
        editSessionId: editSession.id,
        entityId: "fx-human-arm-right",
        transform: STORYBOARD_TAKEOVER_CORRECTION,
        note: "Rotate right arm into a natural wave pose.",
      });
      return outcome(
        "takeover-correction",
        `Manual correction captured -> ChangeSet ${changeSet.id} (authorType: user).`,
        [changeSet.id, editSession.id],
        {},
      );
    }
    case "takeover-accepted": {
      const snapshot = await controller.refresh();
      const changeSet = snapshot.pendingChangeSets.find(
        (candidate) => candidate.authorType === "user",
      );
      if (!changeSet) throw new Error("demo: user change set missing");
      const version = await controller.acceptChangeSet(changeSet.id);
      const editSession = snapshot.editSessions.find((candidate) => candidate.endedAt === null);
      if (editSession) {
        await controller.closeEditSession(editSession.id);
      }
      return outcome(
        "takeover-accepted",
        `Correction accepted -> v${version.version}; EditSession closed. Learning candidate captured — permission still NOT granted.`,
        [version.id, editSession?.id ?? ""],
        { mode: "view" },
      );
    }
    case "learning-consent": {
      const consent = await controller.setLearningPermission(true);
      return outcome(
        "learning-consent",
        `Learning permission granted (${consent.policyId}, scope USER). Prior corrections may now inform future results — and only now.`,
        [consent.policyId],
        {},
      );
    }
    case "export": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: version missing");
      await controller.recommendEditor();
      const manifest = await controller.exportPackage(version.id);
      return outcome(
        "export",
        `Editable package exported (v${manifest.version.version}) via ${manifest.editor.editorName}; manifest records lineage + provenance.`,
        [manifest.version.id, manifest.editor.editorId],
        { panel: "export" },
        serializeSolutionPackageManifest(manifest),
      );
    }
    case "re-import": {
      const snapshot = await controller.refresh();
      const version = snapshot.versions.at(-1);
      if (!version) throw new Error("demo: version missing");
      const exported = await controller.exportPackage(version.id);
      // 外部编辑器 adapter 存根：确定性「编辑」后回传，演示 truthful diff。
      const edited = applyStoryboardExternalEditorEdits(exported);
      const changeSet = await controller.importPackage(edited);
      const truthful = diffSolutionVersionAgainst(edited.version, version);
      return outcome(
        "re-import",
        `Re-import produced importer ChangeSet ${changeSet.id}; truthful diff: ${truthful.entityChanges.length} entity change(s), ${truthful.qualityChanges.length} quality change(s), environment ${truthful.environmentChanged ? "changed" : "unchanged"}.`,
        [changeSet.id],
        {},
      );
    }
    case "re-import-accepted": {
      const snapshot = await controller.refresh();
      const changeSet = snapshot.pendingChangeSets.find(
        (candidate) => candidate.authorType === "importer",
      );
      if (!changeSet) throw new Error("demo: importer change set missing");
      const version = await controller.acceptChangeSet(changeSet.id);
      return outcome(
        "re-import-accepted",
        `Imported edits accepted -> v${version.version} (authorType: importer).`,
        [version.id, changeSet.id],
        {},
      );
    }
    case "repeated-intent": {
      const repeat = await controller.repeatIntent(STORYBOARD_INTENT.id);
      const version = await controller.acceptChangeSet(repeat.changeSet.id);
      return outcome(
        "repeated-intent",
        repeat.learningApplied
          ? `Same intent repeated -> v${version.version} with the learned wave pose applied (prior learning, scope USER).`
          : `Same intent repeated -> v${version.version}. No prior learning applied (permission not granted).`,
        [version.id, repeat.changeSet.id],
        { panel: "viewport" },
      );
    }
    case "capability-gap": {
      const gap = await controller.triggerCapabilityGapFixture();
      return outcome(
        "capability-gap",
        `Fixture capability gap detected (${gap.category}, confidence ${gap.confidence}); ${gap.attemptedStrategies.length} attempted strategies recorded.`,
        [gap.id],
        { panel: "demo" },
      );
    }
    case "arena-escalate": {
      const snapshot = await controller.refresh();
      const gap = snapshot.capabilityGaps.at(-1);
      if (!gap) throw new Error("demo: capability gap missing");
      const escalation = await controller.escalateToArena(gap.id);
      return outcome(
        "arena-escalate",
        `Escalation ${escalation.escalationId} authorized by user; mock Arena delivered a typed expert result (${escalation.expertResult?.resultType ?? "none"}).`,
        [escalation.escalationId, gap.id],
        {},
      );
    }
    case "arena-apply": {
      const snapshot = await controller.refresh();
      const escalation = snapshot.escalations.at(-1);
      if (!escalation) throw new Error("demo: escalation missing");
      const changeSet = await controller.applyArenaResult(escalation.escalationId);
      const version = await controller.acceptChangeSet(changeSet.id);
      return outcome(
        "arena-apply",
        `Arena result applied through YOU's own authority -> v${version.version} (authorType: expert). Arena never mutates YOU state directly.`,
        [version.id, changeSet.id, escalation.escalationId],
        {},
      );
    }
  }
}

/** 步骤总数（驱动器与 UI 共享）。 */
export const SOLUTION_DEMO_TOTAL_STEPS = SOLUTION_DEMO_STEPS.length;
