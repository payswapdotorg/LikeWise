// YOU Editing Studio — 确定性 operator demo 驱动器（W5B）。
//
// 覆盖 W5B 验收的完整 W5 箭头（W5A fixture 场景的 UI 侧镜像）：subject 挑选 →
// 会话开启 → op 组合 → 候选确定性预览 → 变更集提议/应用 → 接受/拒绝（v1 事件
// 纪律）→ 诚实 typed 错误路径（YOU_CHANGESET_INVALID / YOU_EDITOR_UNSUPPORTED /
// YOU_EDIT_SESSION_NOT_FOUND / YOU_IMPORT_EXPORT_FAILED / 终态锁定 / 同意门）→
// external 投射启动 → Tier-4 导出/导入 round-trip → 手动接管确认 → 终态收束。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed error
// 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  EditingStudioError,
  type EditingStudioController,
} from "./editingController.js";
import type { EditingDemoStep, EditingDemoStepId } from "./editingStudioDemoSteps.js";
export {
  EDITING_DEMO_STEPS,
  EDITING_DEMO_TOTAL_STEPS,
  type EditingDemoStep,
  type EditingDemoStepId,
} from "./editingStudioDemoSteps.js";
import type { EditingPanelId } from "./editingStudioStore.js";
import type { EditingSession } from "@zcode/shared";
import {
  buildStoryboardChangeSetOpsA,
  buildStoryboardChangeSetOpsB,
} from "./editingStoryboard.js";

/** 步骤对视图状态的提示（由 useEditingStudio 应用；驱动器不直接写 store）。 */
export interface EditingDemoUiHint {
  readonly panel?: EditingPanelId;
  readonly selectedSessionId?: string | null;
  readonly selectedSubjectId?: string | null;
  readonly selectedCandidateId?: string | null;
  readonly selectedChangeSetId?: string | null;
}

export interface EditingDemoStepOutcome {
  readonly stepId: EditingDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（会话 / 变更集 / 候选 / 结果等）。 */
  readonly refs: readonly string[];
  readonly uiHint: EditingDemoUiHint;
}

function outcome(
  stepId: EditingDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: EditingDemoUiHint = {},
): EditingDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<EditingStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof EditingStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed EditingStudioError, but the operation succeeded");
}

function latestSessionOf(snapshot: {
  readonly sessions: readonly EditingSession[];
}): EditingSession {
  const session = snapshot.sessions.at(-1);
  if (!session) throw new Error("demo: editing session missing");
  return session;
}

/**
 * 执行一步剧本。控制器必须已 load（subject-pick 步骤负责 load）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runEditingDemoStep(
  controller: EditingStudioController,
  demoStep: EditingDemoStep,
): Promise<EditingDemoStepOutcome> {
  switch (demoStep.id) {
    case "subject-pick": {
      // 首步负责加载（与 W1B/W2B/W3B/W4B demo 首步同款职责）。
      const snapshot = await controller.load({ workspaceKey: "you-w5b-editing-demo" });
      const subject = snapshot.subjects[0];
      if (!subject) throw new Error("demo: subject missing");
      return outcome(
        "subject-pick",
        `Subject "${subject.displayName}" picked (${subject.id}, origin ${subject.originPlane}): content-addressed ${subject.contentRef} (${subject.contentHash}). The editing plane registers subjects; the originating plane stays the owner of its truth.`,
        [subject.id], { panel: "sessions", selectedSubjectId: subject.id });

    }
    case "session-open": {
      const snapshot = await controller.refresh();
      const subject = snapshot.subjects[0];
      if (!subject) throw new Error("demo: subject missing");
      const session = await controller.openSession({
        subjectArtifactId: subject.id,
        editorKind: "native",
      });
      return outcome(
        "session-open",
        `Editing session ${session.id} opened over subject ${session.subjectArtifactId} with editor kind "${String(session.editorKind)}" (tier 1 native controls). Status: open — the lifecycle runs open → committed | abandoned with terminals locked.`,
        [session.id, subject.id],         { panel: "sessions", selectedSessionId: session.id } );
    }
    case "ops-compose": {
      // 确定性 op 组合：变更集 A 的三条 op（transform / material / annotation）。
      const ops = buildStoryboardChangeSetOpsA();
      return outcome(
        "ops-compose",
        `Composed ${ops.length} ordered ops (${ops.map((op) => op.kind).join(", ")}) — every op payload is content-addressed (payloadRef + payloadHash); content is never inlined in the draft, the proposal or the record.`,
        ops.map((op) => op.id),
        { panel: "changesets" },
      );
    }
    case "changeset-preview": {
      const snapshot = await controller.refresh();
      const subject = snapshot.subjects[0];
      if (!subject) throw new Error("demo: subject missing");
      const ops = buildStoryboardChangeSetOpsA();
      const preview = await controller.previewCandidate({
        parentVersionId: subject.id,
        ops,
      });
      return outcome(
        "changeset-preview",
        `Deterministic candidate preview against parent ${preview.parentVersionId} (parent hash ${preview.parentContentHash}): ${preview.opRows.length} ops, preview digest ${preview.previewDigest}. The preview is a pure projection — no ids allocated, no clock advanced, nothing journaled.`,
        [subject.id],         { panel: "changesets" } );
    }
    case "changeset-propose": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      const ops = buildStoryboardChangeSetOpsA();
      const changeSet = await controller.proposeChangeSet({
        sessionId: session.id,
        ops,
      });
      return outcome(
        "changeset-propose",
        `Change set ${changeSet.id} proposed for session ${changeSet.sessionId}: ${changeSet.ops.length} ordered ops journaled through change-proposed (validation passed statelessly — an invalid set is refused typed, never silently repaired).`,
        [changeSet.id, session.id],         { panel: "changesets", selectedChangeSetId: changeSet.id } );
    }
    case "changeset-apply": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      const subject = snapshot.subjects[0];
      if (!subject) throw new Error("demo: subject missing");
      const changeSet = snapshot.changeSets.at(-1);
      if (!changeSet) throw new Error("demo: change set missing");
      const candidate = await controller.applyChangeSet({
        changeSetId: changeSet.id,
        parentVersionId: subject.id,
      });
      return outcome(
        "changeset-apply",
        `Change set ${changeSet.id} applied to parent ${subject.id} → immutable CandidateVersion ${candidate.id} (content ${candidate.contentRef}, ${candidate.contentHash}). Events change-set-applied + candidate-version-proposed appended; the parent → candidate lineage is registered append-only.`,
        [candidate.id, changeSet.id, subject.id],         { panel: "compare", selectedCandidateId: candidate.id, selectedSessionId: session.id } );
    }
    case "candidate-accept": {
      const snapshot = await controller.refresh();
      const candidate = snapshot.candidates.at(-1);
      if (!candidate) throw new Error("demo: candidate missing");
      const resolved = await controller.resolveCandidate({
        candidateId: candidate.id,
        outcome: "accepted",
        reason: "fixture: operator accepted the native correction",
      });
      return outcome(
        "candidate-accept",
        `Candidate ${resolved.candidate.id} accepted — the v1 change-accepted event is appended (exactly once, append-only; no second authority path). The candidate joins the canonical lineage.`,
        [resolved.candidate.id],         { panel: "compare", selectedCandidateId: resolved.candidate.id } );
    }
    case "changeset-2": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      const parentCandidate = snapshot.candidates.at(-1);
      if (!parentCandidate) throw new Error("demo: parent candidate missing");
      // 嵌套谱系：第二条变更集应用到候选 1（parent = candidate）。
      const ops = buildStoryboardChangeSetOpsB();
      const changeSet = await controller.proposeChangeSet({
        sessionId: session.id,
        ops,
      });
      const candidate = await controller.applyChangeSet({
        changeSetId: changeSet.id,
        parentVersionId: parentCandidate.id,
      });
      return outcome(
        "changeset-2",
        `Second change set ${changeSet.id} applied onto candidate ${parentCandidate.id} (a candidate can parent further candidates) → CandidateVersion ${candidate.id}. The lineage chain deepens: subject root → candidate → candidate.`,
        [changeSet.id, candidate.id, parentCandidate.id],         { panel: "compare", selectedCandidateId: candidate.id } );
    }
    case "candidate-reject": {
      const snapshot = await controller.refresh();
      const candidate = snapshot.candidates.at(-1);
      if (!candidate) throw new Error("demo: candidate missing");
      const resolved = await controller.resolveCandidate({
        candidateId: candidate.id,
        outcome: "rejected",
        reason: "fixture: operator rejected the geometry tweak (revert — parent stays canonical)",
      });
      return outcome(
        "candidate-reject",
        `Candidate ${resolved.candidate.id} rejected — the v1 change-rejected event is appended; the parent ${resolved.candidate.parentVersionId} stays canonical (revert semantics: rejecting a candidate never mutates the parent).`,
        [resolved.candidate.id],         { panel: "compare", selectedCandidateId: resolved.candidate.id } );
    }
    case "changeset-invalid": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      // 预期中的 typed error：空 op 列表 ⇒ YOU_CHANGESET_INVALID。
      const error = await expectTypedError(() =>
        controller.proposeChangeSet({ sessionId: session.id, ops: [] }),
      );
      return outcome(
        "changeset-invalid",
        `${error.youError.code}: ${error.youError.message} — the stateless validator refuses empty op lists; nothing is journaled and nothing is silently repaired.`,
        [session.id],         { panel: "changesets" } );
    }
    case "editor-unsupported": {
      const snapshot = await controller.refresh();
      const subject = snapshot.subjects[0];
      if (!subject) throw new Error("demo: subject missing");
      // 预期中的 typed error：未注册 editor kind ⇒ YOU_EDITOR_UNSUPPORTED。
      const error = await expectTypedError(() =>
        controller.openSession({
          subjectArtifactId: subject.id,
          editorKind: "hologram-suite" as never,
        }),
      );
      return outcome(
        "editor-unsupported",
        `${error.youError.code}: ${error.youError.message} — unregistered editor kinds are refused; there is no silent fallback to another editor.`,
        [subject.id],         { panel: "editors" } );
    }
    case "session-not-found": {
      // 预期中的 typed error：未知会话 id ⇒ YOU_EDIT_SESSION_NOT_FOUND。
      const error = await expectTypedError(() =>
        controller.commitSession({ sessionId: "fx-editsession-999" }),
      );
      return outcome(
        "session-not-found",
        `${error.youError.code}: ${error.youError.message} — unknown session ids are typed refusals; the surface renders the typed error panel, never a guess.`,
        [],         { panel: "sessions" } );
    }
    case "external-session": {
      const snapshot = await controller.refresh();
      const subject = snapshot.subjects[0];
      if (!subject) throw new Error("demo: subject missing");
      const session = await controller.openSession({
        subjectArtifactId: subject.id,
        editorKind: "external",
      });
      return outcome(
        "external-session",
        `External editing session ${session.id} opened (tier 3 — external professional application). External launches are consent-gated projected flows: the UI never holds ambient process control.`,
        [session.id, subject.id],         { panel: "editors", selectedSessionId: session.id } );
    }
    case "launch-gate": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      // 预期中的 typed error：external launch 无许可 ⇒ 不处理（服务端强制）。
      const error = await expectTypedError(() =>
        controller.requestExternalEditorLaunch({ sessionId: session.id }),
      );
      return outcome(
        "launch-gate",
        `${error.youError.code}: ${error.youError.message} — launching an external editor hands subject content across the process boundary; no permission means no launch.`,
        [session.id],         { panel: "editors" } );
    }
    case "consent-grant": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.decideConsent({
        policyId: policy.id,
        purpose: "export",
        decision: "grant",
      });
      return outcome(
        "consent-grant",
        `Operational consent granted for purpose "export" (${policy.id}) — rendered from the consent-state projection of the wave-2 authority shapes; external launch is possible only from this point.`,
        [policy.id],         { panel: "editors" } );
    }
    case "external-launch": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      const launch = await controller.requestExternalEditorLaunch({
        sessionId: session.id,
      });
      return outcome(
        "external-launch",
        `External editor launch ${launch.launchId} projected for session ${launch.sessionId} (editor kind "${String(launch.editorKind)}", format ${String(launch.format)}, tier-4 package ${launch.packageResultId}). The launch is a projected intent through the controller seam — the desktop layer owns the actual process handoff; the UI performs no process control.`,
        [launch.launchId, launch.packageResultId, session.id],         { panel: "editors", selectedSessionId: session.id } );
    }
    case "export": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      const exportOutcome = await controller.exportFromSession({
        sessionId: session.id,
        format: "edit-interchange",
      });
      return outcome(
        "export",
        `Session ${session.id} exported as ${String(exportOutcome.result.format)}: content-addressed result ${exportOutcome.result.id} (${exportOutcome.result.contentRef}). The package is assembled deterministically — the same session state always produces the same package digest ${exportOutcome.packageDigest}.`,
        [exportOutcome.result.id, session.id],         { panel: "editors", selectedSessionId: session.id } );
    }
    case "import-roundtrip": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      // 重放导出（确定性 ⇒ 与上一步字节一致的包），导入做 round-trip 恒等校验。
      const exportOutcome = await controller.exportFromSession({
        sessionId: session.id,
        format: "edit-interchange",
      });
      const imported = await controller.importEditPackage({
        bytes: exportOutcome.packageBytes,
        format: exportOutcome.result.format,
        sessionId: session.id,
      });
      const identical = imported.packageDigest === exportOutcome.packageDigest;
      return outcome(
        "import-roundtrip",
        `Round-trip identity check: the exported package (digest ${exportOutcome.packageDigest}) imported back as result ${imported.result.id} with digest ${imported.packageDigest} — ${identical ? "identical" : "DIFFERENT"}. The identity is checkable from the digests, never asserted.`,
        [imported.result.id, exportOutcome.result.id],         { panel: "editors", selectedSessionId: session.id } );
    }
    case "import-invalid": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      // 预期中的 typed error：损坏字节 ⇒ YOU_IMPORT_EXPORT_FAILED（failed 结果诚实入账）。
      const error = await expectTypedError(() =>
        controller.importEditPackage({
          bytes: new TextEncoder().encode("not-a-you-interchange-package"),
          format: "edit-interchange",
          sessionId: session.id,
        }),
      );
      const recordedResultId = error.youError.details["recordedResultId"];
      return outcome(
        "import-invalid",
        `${error.youError.code}: ${error.youError.message} — imported content is untrusted until validated; the failure is journaled as a failed ImportExportResult${typeof recordedResultId === "string" ? ` (${recordedResultId})` : ""} and surfaced as a typed panel.`,
        [session.id],         { panel: "editors" } );
    }
    case "takeover-gate": {
      const snapshot = await controller.refresh();
      const session = snapshot.sessions[0];
      if (!session) throw new Error("demo: native session missing");
      // 预期中的 typed error：manual takeover 无许可 ⇒ 不处理（wave-2 同意权威）。
      const error = await expectTypedError(() =>
        controller.requestTakeoverConfirmation({ sessionId: session.id }),
      );
      return outcome(
        "takeover-gate",
        `${error.youError.code}: ${error.youError.message} — takeover confirmation renders from consent-state projections (the wave-2 authority); without permission the confirmation is refused, not hidden.`,
        [session.id],         { panel: "takeover", selectedSessionId: session.id } );
    }
    case "takeover-confirm": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.decideConsent({
        policyId: policy.id,
        purpose: "manual-takeover",
        decision: "grant",
      });
      const session = snapshot.sessions[0];
      if (!session) throw new Error("demo: native session missing");
      const takeover = await controller.requestTakeoverConfirmation({
        sessionId: session.id,
      });
      return outcome(
        "takeover-confirm",
        `Manual takeover confirmed for session ${takeover.sessionId} over subject ${takeover.subjectArtifactId} (confirmation ${takeover.takeoverId}) — the user takes the editing wheel; the record is append-only and rendered from consent-state projections of the wave-2 authority (no second consent path).`,
        [takeover.takeoverId, session.id],         { panel: "takeover", selectedSessionId: session.id } );
    }
    case "session-commit": {
      const snapshot = await controller.refresh();
      const session = snapshot.sessions[0];
      if (!session) throw new Error("demo: native session missing");
      const committed = await controller.commitSession({ sessionId: session.id });
      return outcome(
        "session-commit",
        `Editing session ${committed.id} committed — open → committed is a terminal transition on the frozen ladder; the record is replaced immutably and the edit-session-closed event is appended.`,
        [committed.id],         { panel: "sessions", selectedSessionId: committed.id } );
    }
    case "session-terminal-locked": {
      const snapshot = await controller.refresh();
      const session = snapshot.sessions[0];
      if (!session) throw new Error("demo: native session missing");
      // 预期中的 typed error：终态再迁移 ⇒ YOU_INVALID_STATE（终态锁定）。
      const error = await expectTypedError(() =>
        controller.abandonSession({ sessionId: session.id }),
      );
      return outcome(
        "session-terminal-locked",
        `${error.youError.code}: ${error.youError.message} — committed is a terminal status; illegal transitions are typed refusals, never silent no-ops.`,
        [session.id],         { panel: "sessions", selectedSessionId: session.id } );
    }
    case "session-abandon": {
      const snapshot = await controller.refresh();
      const session = latestSessionOf(snapshot);
      const abandoned = await controller.abandonSession({ sessionId: session.id });
      return outcome(
        "session-abandon",
        `External editing session ${abandoned.id} abandoned — open → abandoned is the second terminal on the ladder. The demo plane ends with one committed and one abandoned session; every immutable record keeps its provenance.`,
        [abandoned.id],         { panel: "sessions", selectedSessionId: abandoned.id } );
    }
  }
}
