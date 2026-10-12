/* oxlint-disable eslint(max-lines) -- demo 驱动器是单 switch 的 golden 序列状态机（29 步 × 每步确定性 summary 即 golden 期望——拆分只会让 golden 序列跨模块碎片化、增加 T6 换绑时的对照成本）；T6 换绑 Worker A 的 learning 服务后本文件整体退役。 */
// YOU Learning Studio — 确定性 operator demo 驱动器（W6B）。
//
// 覆盖 W6B 验收的完整 W6 箭头（W6A fixture 场景的 UI 侧镜像）：scope/kind 挑选 →
// 信号捕获（六种 frozen kind 全覆盖，内容寻址 evidence 标签）→ 诚实
// YOU_LEARNING_SIGNAL_INVALID → 内容合成与 rights 签发（issuance-as-enforcement：
// 未授予 ⇒ YOU_LEARNING_RIGHTS_REQUIRED）→ 同意授予（wave-2 权威形状）→
// 候选/验证/使用（RIGHTS LAW 八步评估）→ 偏好派生（derived-from lineage）→
// 惰性记录（验证可爬梯、使用被拒 rights-inert）→ 拒绝路径 → 顶替路径
//（supersededById append-only 链接）→ 授予外使用拒绝 → operator 偏好种子/清除
//（投射意图）→ 派生清除 typed 拒绝 → YOU_PREFERENCE_SCOPE_INVALID →
// trajectory 记录/确定性重放（字节一致）→ 未知记录 typed 拒绝 → 同意撤回与
// 撤回后的 fail-closed 拒绝。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  LearningStudioError,
  type LearningStudioController,
} from "./learningController.js";
import type { LearningDemoStep, LearningDemoStepId } from "./learningStudioDemoSteps.js";
export {
  LEARNING_DEMO_STEPS,
  LEARNING_DEMO_TOTAL_STEPS,
  type LearningDemoStep,
  type LearningDemoStepId,
} from "./learningStudioDemoSteps.js";
import type { LearningPanelId } from "./learningStudioStore.js";
import type {
  LearningRecord,
  LearningSignal,
  LearningSignalKind,
} from "@zcode/shared";
import { LEARNING_STORYBOARD_SIGNAL_SPECS } from "./learningStoryboard.js";

/** 步骤对视图状态的提示（由 useLearningStudio 应用；驱动器不直接写 store）。 */
export interface LearningDemoUiHint {
  readonly panel?: LearningPanelId;
  readonly selectedSignalId?: string | null;
  readonly selectedRecordId?: string | null;
  readonly selectedTrajectoryId?: string | null;
  readonly selectedPreferenceKey?: string | null;
}

export interface LearningDemoStepOutcome {
  readonly stepId: LearningDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（信号 / 记录 / 偏好 / trajectory 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: LearningDemoUiHint;
}

function outcome(
  stepId: LearningDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: LearningDemoUiHint = {},
): LearningDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<LearningStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof LearningStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed LearningStudioError, but the operation succeeded");
}

/** 按_KIND 解析最新信号（确定性：注册面 spec 顺序捕获）。 */
function signalOfKind(
  snapshot: { readonly signals: readonly LearningSignal[] },
  kind: LearningSignalKind,
): LearningSignal {
  const signal = [...snapshot.signals].reverse().find((entry) => entry.kind === kind);
  if (!signal) throw new Error(`demo: ${kind} signal missing`);
  return signal;
}

/** 某信号的首条记录（确定性：id 升序首条）。 */
function recordOfSignal(
  snapshot: { readonly records: readonly LearningRecord[] },
  signalId: string,
): LearningRecord {
  const record = snapshot.records.find((entry) => entry.signalId === signalId);
  if (!record) throw new Error(`demo: record of signal ${signalId} missing`);
  return record;
}

/** 演示证据引用（内容寻址标签——来自注册面前 N 条 evidence，绝不内联）。 */
function demoEvidenceRefs(
  snapshot: { readonly evidence: readonly { readonly id: string; readonly contentRef: string }[] },
  count: number,
): string[] {
  return snapshot.evidence.slice(0, count).map((entry) => entry.contentRef);
}

/**
 * 执行一步剧本。控制器必须已 load（scope-pick 步骤负责 load）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runLearningDemoStep(
  controller: LearningStudioController,
  demoStep: LearningDemoStep,
): Promise<LearningDemoStepOutcome> {
  switch (demoStep.id) {
    case "scope-pick": {
      // 首步负责加载（与 W1B–W5B demo 首步同款职责）。
      const snapshot = await controller.load({ workspaceKey: "you-w6b-learning-demo" });
      return outcome(
        "scope-pick",
        `Learning plane loaded (${snapshot.studioId}, ${snapshot.scopes.length} frozen scopes GLOBAL→TASK). The teach-me draft starts at USER scope — the scope ladder renders from the controller's scope taxonomy projection, never hardcoded in the UI.`,
        [snapshot.studioId],
        { panel: "signals" },
      );
    }
    case "kind-pick": {
      const snapshot = await controller.refresh();
      const kind = snapshot.kindRegistry[0];
      if (!kind) throw new Error("demo: kind registry missing");
      return outcome(
        "kind-pick",
        `Kind "${kind.kind}" picked from the registry projection (${snapshot.kindRegistry.length} frozen kinds: feedback, manual-takeover, edit-session, expert-intervention, repeated-intent, capability-gap). An unknown kind would be a typed signal-invalid refusal — never a silent fallback.`,
        [],
        { panel: "signals" },
      );
    }
    case "signal-invalid": {
      // 预期中的 typed error：未知 kind ⇒ YOU_LEARNING_SIGNAL_INVALID（stateless）。
      const snapshot = await controller.refresh();
      const error = await expectTypedError(() =>
        controller.captureSignal({
          kind: "telepathy" as never,
          scope: "USER",
          evidenceRefs: demoEvidenceRefs(snapshot, 1),
        }),
      );
      return outcome(
        "signal-invalid",
        `${error.youError.code}: ${error.youError.message} — the stateless validator refuses unknown kinds before anything is captured; nothing is journaled and nothing is silently repaired.`,
        [],
        { panel: "signals" },
      );
    }
    case "signal-feedback": {
      const snapshot = await controller.refresh();
      const spec = LEARNING_STORYBOARD_SIGNAL_SPECS[0]!;
      const signal = await controller.captureSignal({
        kind: spec.kind,
        scope: spec.scope,
        subjectRef: snapshot.evidence[0]?.id ?? null,
        evidenceRefs: demoEvidenceRefs(snapshot, spec.evidenceCount),
      });
      return outcome(
        "signal-feedback",
        `Learning signal ${signal.id} captured: kind "${signal.kind}" at ${signal.scope} scope with ${signal.evidenceRefs.length} content-addressed evidence refs (labels only — evidence content is never inlined). The learning-signal-captured event is appended append-only.`,
        [signal.id],
        { panel: "signals", selectedSignalId: signal.id },
      );
    }
    case "signal-sweep": {
      // 六种 frozen kind 全覆盖：其余五种各捕获一条（scope 来自注册面 spec）。
      const snapshot = await controller.refresh();
      const refs: string[] = [];
      const kinds: string[] = [];
      for (const spec of LEARNING_STORYBOARD_SIGNAL_SPECS.slice(1)) {
        const signal = await controller.captureSignal({
          kind: spec.kind,
          scope: spec.scope,
          subjectRef: null,
          evidenceRefs: demoEvidenceRefs(snapshot, spec.evidenceCount),
        });
        refs.push(signal.id);
        kinds.push(signal.kind);
      }
      return outcome(
        "signal-sweep",
        `Five more signals captured (${kinds.join(", ")}) — all six frozen learning signal kinds are now on the plane, each with content-addressed evidence labels and simulated: true.`,
        refs,
        { panel: "signals" },
      );
    }
    case "content-synthesize": {
      const binding = await controller.synthesizeLearningContent({
        seedText: "w6b-demo-content-feedback",
      });
      return outcome(
        "content-synthesize",
        `Validated content binding synthesized deterministically: contentRef ${binding.contentRef} (${binding.contentHash}). The same seed always produces the same content-addressed binding; the content itself is never inlined in any record or event.`,
        [binding.contentRef],
        { panel: "ledger" },
      );
    }
    case "rights-gate": {
      // 预期中的 typed error：learning 用途未授予 ⇒ 签发即强制（fail closed）。
      const error = await expectTypedError(() =>
        controller.issueRights({ usage: ["personalization", "tool-selection"] }),
      );
      return outcome(
        "rights-gate",
        `${error.youError.code}: ${error.youError.message} — rights issuance is enforcement: without a granted learning consent there is no LearningRights and records stay inert.`,
        [],
        { panel: "rights" },
      );
    }
    case "consent-grant": {
      const snapshot = await controller.refresh();
      const policy = snapshot.consent.policy;
      await controller.decideConsent({
        policyId: policy.id,
        purpose: "learning",
        decision: "grant",
      });
      return outcome(
        "consent-grant",
        `Operational consent granted for purpose "learning" (${policy.id}) — rendered from the consent-state projection of the wave-2 authority shapes; there is no second consent path, and rights issuance is possible only from this point.`,
        [policy.id],
        { panel: "rights" },
      );
    }
    case "rights-issue": {
      const rights = await controller.issueRights({
        usage: ["personalization", "tool-selection"],
      });
      return outcome(
        "rights-issue",
        `LearningRights issued: usage [${rights.usage.join(", ")}] bound to consent ${rights.consentRef} (hash ${rights.consentHash}). The consentRef + consentHash pair is traceable to the wave-2 consent authority — usage outside this grant is a typed rights-required refusal.`,
        [rights.consentRef],
        { panel: "rights" },
      );
    }
    case "record-candidates": {
      const snapshot = await controller.refresh();
      const feedbackSignal = signalOfKind(snapshot, "feedback");
      const editSignal = signalOfKind(snapshot, "edit-session");
      const feedbackContent = await controller.synthesizeLearningContent({
        seedText: "w6b-demo-content-feedback",
      });
      const editContent = await controller.synthesizeLearningContent({
        seedText: "w6b-demo-content-edit",
      });
      const rights = await controller.issueRights({
        usage: ["personalization", "tool-selection"],
      });
      const bound = await controller.openCandidateRecord({
        signalId: feedbackSignal.id,
        contentRef: feedbackContent.contentRef,
        contentHash: feedbackContent.contentHash,
        rights,
      });
      const inert = await controller.openCandidateRecord({
        signalId: editSignal.id,
        contentRef: editContent.contentRef,
        contentHash: editContent.contentHash,
      });
      return outcome(
        "record-candidates",
        `Two candidate records opened: ${bound.id} (scope inherited ${bound.scope} from its signal, rights bound) and ${inert.id} (no rights ⇒ inert record — it exists and may climb the ladder, but every use is refused). Candidates are pre-validation service state: no ledger event yet.`,
        [bound.id, inert.id],
        { panel: "ledger", selectedRecordId: bound.id },
      );
    }
    case "record-validate": {
      const snapshot = await controller.refresh();
      const feedbackSignal = signalOfKind(snapshot, "feedback");
      const candidate = recordOfSignal(snapshot, feedbackSignal.id);
      const validated = await controller.validateRecord({ recordId: candidate.id });
      return outcome(
        "record-validate",
        `Record ${validated.record.id} validated (${validated.record.scope} scope, ladder timestamp ${validated.record.validatedAt}) — the learning-record-validated event is appended with the rights usage classes and consent linkage in its payload; supersession linkage is null here.`,
        [validated.record.id],
        { panel: "ledger", selectedRecordId: validated.record.id },
      );
    }
    case "record-use": {
      const snapshot = await controller.refresh();
      const feedbackSignal = signalOfKind(snapshot, "feedback");
      const record = recordOfSignal(snapshot, feedbackSignal.id);
      const used = await controller.useRecord({
        recordId: record.id,
        usage: "personalization",
      });
      return outcome(
        "record-use",
        `Record ${used.record.id} used under usage class "${used.usage}" — the eight-step rights evaluation passed (rights-within-grant): the usage is in the grant, the live consent is granted, learning reuse is permitted, the purpose covers learning and the consent hash still matches.`,
        [used.record.id],
        { panel: "rights", selectedRecordId: used.record.id },
      );
    }
    case "preference-derive": {
      const snapshot = await controller.refresh();
      const feedbackSignal = signalOfKind(snapshot, "feedback");
      const record = recordOfSignal(snapshot, feedbackSignal.id);
      const derived = await controller.derivePreference({
        recordId: record.id,
        key: "preferred-editor",
        value: "fixture-external-editor",
      });
      return outcome(
        "preference-derive",
        `Preference ${derived.preference.scope}::${derived.preference.key} = "${derived.preference.value}" derived from record ${record.id} (derivedFromRecordId lineage; the record stays the source of truth — preferences are projections). The preference-updated event is appended; the derivation required the personalization usage inside the rights grant.`,
        [derived.preference.id, record.id],
        {
          panel: "preferences",
          selectedPreferenceKey: `${derived.preference.scope}::${derived.preference.key}`,
        },
      );
    }
    case "inert-validate": {
      const snapshot = await controller.refresh();
      const editSignal = signalOfKind(snapshot, "edit-session");
      const candidate = recordOfSignal(snapshot, editSignal.id);
      const validated = await controller.validateRecord({ recordId: candidate.id });
      return outcome(
        "inert-validate",
        `Inert record ${validated.record.id} validated — records without rights exist in the ledger and may climb the ladder (candidate → validated), but they stay inert for every use: the rights law refuses them typed (rights-inert).`,
        [validated.record.id],
        { panel: "ledger", selectedRecordId: validated.record.id },
      );
    }
    case "inert-refusal": {
      const snapshot = await controller.refresh();
      const editSignal = signalOfKind(snapshot, "edit-session");
      const record = recordOfSignal(snapshot, editSignal.id);
      // 预期中的 typed error：惰性记录 ⇒ rights-inert（八步评估第一步）。
      const error = await expectTypedError(() =>
        controller.useRecord({ recordId: record.id, usage: "personalization" }),
      );
      return outcome(
        "inert-refusal",
        `${error.youError.code}: ${error.youError.message} — records without rights are inert: the refusal reason is "${String(error.youError.details["reason"])}" and the ledger keeps the validated-but-inert record visible (transparency over silent skipping).`,
        [record.id],
        { panel: "rights", selectedRecordId: record.id },
      );
    }
    case "record-reject": {
      const snapshot = await controller.refresh();
      const expertSignal = signalOfKind(snapshot, "expert-intervention");
      const content = await controller.synthesizeLearningContent({
        seedText: "w6b-demo-content-expert",
      });
      const rights = await controller.issueRights({
        usage: ["personalization", "tool-selection"],
      });
      const candidate = await controller.openCandidateRecord({
        signalId: expertSignal.id,
        contentRef: content.contentRef,
        contentHash: content.contentHash,
        rights,
      });
      const rejected = await controller.rejectRecord({
        recordId: candidate.id,
        reason: "fixture-rejected-learning",
      });
      return outcome(
        "record-reject",
        `Record ${rejected.id} rejected (reason "fixture-rejected-learning") — the learning-record-rejected event is appended; rejected is a terminal status on the frozen ladder, and the immutable record is replaced, never edited in place.`,
        [rejected.id],
        { panel: "ledger", selectedRecordId: rejected.id },
      );
    }
    case "rejected-unusable": {
      const snapshot = await controller.refresh();
      const expertSignal = signalOfKind(snapshot, "expert-intervention");
      const record = recordOfSignal(snapshot, expertSignal.id);
      // 预期中的 typed error：rejected 记录不可使用（只有 validated 可用）。
      const error = await expectTypedError(() =>
        controller.useRecord({ recordId: record.id, usage: "personalization" }),
      );
      return outcome(
        "rejected-unusable",
        `${error.youError.code}: ${error.youError.message} — only validated learning is usable; rejected is terminal, and the typed refusal is honest about it (the UI renders the typed panel instead of hiding the button only).`,
        [record.id],
        { panel: "ledger", selectedRecordId: record.id },
      );
    }
    case "record-supersede": {
      const snapshot = await controller.refresh();
      const intentSignal = signalOfKind(snapshot, "repeated-intent");
      const gapSignal = signalOfKind(snapshot, "capability-gap");
      const intentContent = await controller.synthesizeLearningContent({
        seedText: "w6b-demo-content-intent",
      });
      const gapContent = await controller.synthesizeLearningContent({
        seedText: "w6b-demo-content-gap",
      });
      const rights = await controller.issueRights({
        usage: ["personalization", "tool-selection"],
      });
      const intentCandidate = await controller.openCandidateRecord({
        signalId: intentSignal.id,
        contentRef: intentContent.contentRef,
        contentHash: intentContent.contentHash,
        rights,
      });
      const gapCandidate = await controller.openCandidateRecord({
        signalId: gapSignal.id,
        contentRef: gapContent.contentRef,
        contentHash: gapContent.contentHash,
        rights,
      });
      const intentValidated = await controller.validateRecord({
        recordId: intentCandidate.id,
      });
      void intentValidated;
      const supersession = await controller.validateRecord({
        recordId: gapCandidate.id,
        supersedesRecordId: intentCandidate.id,
      });
      return outcome(
        "record-supersede",
        `Record ${supersession.record.id} validated superseding ${supersession.superseded!.id} — supersession is append-only linkage: the superseded record keeps its id and its own validation moment, only status + supersededById move; the linkage fact rides in the successor's learning-record-validated event payload.`,
        [supersession.record.id, supersession.superseded!.id],
        { panel: "ledger", selectedRecordId: supersession.superseded!.id },
      );
    }
    case "superseded-unusable": {
      const snapshot = await controller.refresh();
      const intentSignal = signalOfKind(snapshot, "repeated-intent");
      const record = recordOfSignal(snapshot, intentSignal.id);
      // 预期中的 typed error：superseded 记录不再可用（仅后继者 validated）。
      const error = await expectTypedError(() =>
        controller.useRecord({ recordId: record.id, usage: "personalization" }),
      );
      return outcome(
        "superseded-unusable",
        `${error.youError.code}: ${error.youError.message} — a superseded record is no longer usable; its successor ${record.supersededById} carries the validated truth. The ledger view shows the supersededById linkage instead of mutating history.`,
        [record.id],
        { panel: "ledger", selectedRecordId: record.id },
      );
    }
    case "usage-outside-grant": {
      const snapshot = await controller.refresh();
      const gapSignal = signalOfKind(snapshot, "capability-gap");
      const record = recordOfSignal(snapshot, gapSignal.id);
      // 预期中的 typed error：授予外的 usage ⇒ usage-not-granted（RIGHTS LAW）。
      const error = await expectTypedError(() =>
        controller.useRecord({ recordId: record.id, usage: "pipeline-improvement" }),
      );
      return outcome(
        "usage-outside-grant",
        `${error.youError.code}: ${error.youError.message} — the grant covers [personalization, tool-selection]; pipeline-improvement is outside it, and usage outside the grant is a typed refusal (the rights display shows exactly which usage classes the consent linkage covers).`,
        [record.id],
        { panel: "rights", selectedRecordId: record.id },
      );
    }
    case "operator-preference": {
      const seeded = await controller.setOperatorPreference({
        scope: "GLOBAL",
        key: "organization-baseline",
        value: "fixture-baseline",
      });
      return outcome(
        "operator-preference",
        `Operator preference seeded: ${seeded.preference.scope}::${seeded.preference.key} = "${seeded.preference.value}" (derivedFromRecordId null — an operator seed, no record involved, no rights gate). The preference-updated event is appended; the user control is a projected intent through the controller port.`,
        [seeded.preference.id],
        {
          panel: "preferences",
          selectedPreferenceKey: `${seeded.preference.scope}::${seeded.preference.key}`,
        },
      );
    }
    case "preference-clear": {
      const cleared = await controller.clearOperatorPreference({
        scope: "GLOBAL",
        key: "organization-baseline",
      });
      return outcome(
        "preference-clear",
        `Operator seed cleared: ${cleared.scope}::${cleared.key} removed from the live preference projection (event preference-updated with the cleared marker — the append-only ledger keeps the fact). Derived preferences cannot be cleared this way; they are projections of validated learning.`,
        [cleared.id],
        { panel: "preferences" },
      );
    }
    case "derived-clear-refused": {
      // 预期中的 typed error：派生偏好是投影 ⇒ 手工清除被 typed 拒绝。
      const error = await expectTypedError(() =>
        controller.clearOperatorPreference({ scope: "USER", key: "preferred-editor" }),
      );
      return outcome(
        "derived-clear-refused",
        `${error.youError.code}: ${error.youError.message} — derived preferences follow the record ladder (derive again, or let the record be superseded); only the operator seed is directly clearable.`,
        [],
        { panel: "preferences" },
      );
    }
    case "preference-scope-invalid": {
      const snapshot = await controller.refresh();
      const feedbackSignal = signalOfKind(snapshot, "feedback");
      const record = recordOfSignal(snapshot, feedbackSignal.id);
      // 预期中的 typed error：派生范围不得扩缩 ⇒ scope-mismatch。
      const error = await expectTypedError(() =>
        controller.derivePreference({
          recordId: record.id,
          key: "preferred-editor",
          value: "fixture-external-editor",
          scope: "TENANT",
        }),
      );
      return outcome(
        "preference-scope-invalid",
        `${error.youError.code}: ${error.youError.message} — the record lives at ${record.scope} scope, so a TENANT derivation would widen it; derived preferences never widen or narrow their record's scope.`,
        [record.id],
        { panel: "preferences" },
      );
    }
    case "trajectory-record": {
      const steps = await controller.synthesizeTrajectorySteps({
        seedText: "w6b-demo-trajectory",
        stepCount: 4,
      });
      const trajectory = await controller.recordTrajectory({
        scope: "USER",
        stepRefs: [...steps.stepRefs],
      });
      return outcome(
        "trajectory-record",
        `Trajectory ${trajectory.id} recorded at ${trajectory.scope} scope with ${trajectory.stepRefs.length} content-addressed step refs (seed "w6b-demo-trajectory" — same seed always synthesizes the same steps). Step content is never inlined; the step list renders labels only.`,
        [trajectory.id, ...trajectory.stepRefs],
        { panel: "replay", selectedTrajectoryId: trajectory.id },
      );
    }
    case "trajectory-replay": {
      const snapshot = await controller.refresh();
      const trajectory = snapshot.trajectories.at(-1);
      if (!trajectory) throw new Error("demo: trajectory missing");
      const first = await controller.replayTrajectory({ trajectoryId: trajectory.id });
      const second = await controller.replayTrajectory({ trajectoryId: trajectory.id });
      const byteIdentical =
        first.bytes.length === second.bytes.length &&
        first.bytes.every((byte, index) => byte === second.bytes[index]);
      return outcome(
        "trajectory-replay",
        `Trajectory ${trajectory.id} replayed deterministically: ${first.stepCount} steps, ${first.bytes.length} bytes, replay hash ${first.replayHash}. A second replay of the same seed is byte-identical (${byteIdentical ? "true" : "FALSE"}) — the replay projection is checkable, never asserted.`,
        [trajectory.id, first.replayHash],
        { panel: "replay", selectedTrajectoryId: trajectory.id },
      );
    }
    case "record-not-found": {
      // 预期中的 typed error：未知记录 id ⇒ YOU_LEARNING_RECORD_NOT_FOUND。
      const error = await expectTypedError(() =>
        controller.validateRecord({ recordId: "fx-learnrecord-999" }),
      );
      return outcome(
        "record-not-found",
        `${error.youError.code}: ${error.youError.message} — unknown record ids are typed refusals; the ledger stays honest and the surface renders the typed error panel, never a guess.`,
        [],
        { panel: "ledger" },
      );
    }
    case "consent-withdraw": {
      const snapshot = await controller.refresh();
      const projection = await controller.withdrawConsent({
        policyId: snapshot.consent.policy.id,
      });
      return outcome(
        "consent-withdraw",
        `Consent withdrawn for policy ${projection.policy.id} (purpose states now ${projection.purposeStates.map((entry) => `${String(entry.purpose)}:${entry.state}`).join(", ")}) — the withdrawal routes through the wave-2 consent authority port; there is no second consent path to forget.`,
        [projection.policy.id],
        { panel: "rights" },
      );
    }
    case "post-withdrawal-refusal": {
      const snapshot = await controller.refresh();
      const feedbackSignal = signalOfKind(snapshot, "feedback");
      const record = recordOfSignal(snapshot, feedbackSignal.id);
      // 预期中的 typed error：撤回后 LIVE fail-closed（状态检查先于哈希检查）。
      const error = await expectTypedError(() =>
        controller.useRecord({ recordId: record.id, usage: "personalization" }),
      );
      return outcome(
        "post-withdrawal-refusal",
        `${error.youError.code}: ${error.youError.message} — after withdrawal the recorded consentHash still matches, but the live grant state check fires first: the previously-usable record now refuses every use (fail closed). Records without a live grant are inert in practice.`,
        [record.id],
        { panel: "rights", selectedRecordId: record.id },
      );
    }
  }
}
