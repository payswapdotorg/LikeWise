/* oxlint-disable eslint(max-lines) -- demo 驱动器是单 switch 的 golden 序列状态机（32 步 × 每步确定性 summary 即 golden 期望——拆分只会让 golden 序列跨模块碎片化、增加 T8 换绑时的对照成本）；T8 换绑 Worker A 的 arena 服务后本文件整体退役。 */
// YOU Escalation Studio — 确定性 operator demo 驱动器（W8B）。
//
// 覆盖 W8B 验收的完整 W8 箭头（W8A fixture 场景的 UI 侧镜像）：gap 记录（七类
// 全覆盖 + 不可升级的诚实路径）→ ToolGap/Knowledge 投影发布 + 非法投影 typed
// 拒绝（YOU_GAP_PROJECTION_INVALID）→ policy 校验拒绝（YOU_RETRY_POLICY_INVALID）→
// 升级请求 → 无授权运行拒绝（YOU_ESCALATION_AUTHORIZATION_REQUIRED）→ 非法授权
// 形状拒绝（YOU_ESCALATION_STATE_INVALID）→ 授权（scope/expiry/learning
// permission aggregate）→ run 启动/失败/重试（append-only 阶梯）→ 未知 provider
// fail-closed 拒绝（YOU_ARENA_ADAPTER_UNSUPPORTED）→ typed payload 交付 →
// applies-as-changeset 应用 → 第二升级（过期授权拒绝 → 续期新记录 → artifact
// 内容寻址标签交付 → 拒绝终态）→ 第三升级（none 许可 → 撤回记录 → 撤回后
// fail-closed 拒绝 → 取消 + run aborted）→ 未知升级/run typed 拒绝
//（YOU_ESCALATION_NOT_FOUND / YOU_ARENA_RUN_NOT_FOUND）→ 终态拒绝。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  EscalationStudioError,
  escalationOfGap,
  type EscalationStudioController,
} from "./escalationController.js";
import type {
  EscalationDemoStep,
  EscalationDemoStepId,
} from "./escalationStudioDemoSteps.js";
export {
  ESCALATION_DEMO_STEPS,
  ESCALATION_DEMO_TOTAL_STEPS,
  type EscalationDemoStep,
  type EscalationDemoStepId,
} from "./escalationStudioDemoSteps.js";
import type { EscalationPanelId } from "./escalationStudioStore.js";
import type { CapabilityGap } from "@zcode/shared";
import {
  ESCALATION_STORYBOARD_EXPIRY_PRESETS,
  ESCALATION_STORYBOARD_GAP_SPECS,
  ESCALATION_STORYBOARD_PROVIDERS,
  storyboardGapSpecById,
  type StoryboardGapSpec,
} from "./escalationStoryboard.js";

/** 步骤对视图状态的提示（由 useEscalationStudio 应用；驱动器不直接写 store）。 */
export interface EscalationDemoUiHint {
  readonly panel?: EscalationPanelId;
  readonly selectedGapId?: string | null;
  readonly selectedEscalationId?: string | null;
  readonly selectedRunId?: string | null;
}

export interface EscalationDemoStepOutcome {
  readonly stepId: EscalationDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（gap / 升级 / run / 授权 / 投影等）。 */
  readonly refs: readonly string[];
  readonly uiHint: EscalationDemoUiHint;
}

function outcome(
  stepId: EscalationDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: EscalationDemoUiHint = {},
): EscalationDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<EscalationStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof EscalationStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error("demo: expected a typed EscalationStudioError, but the operation succeeded");
}

/** 规格 → 已落账 gap（category + confidence 唯一定位；确定性）。 */
function gapOfSpec(
  snapshot: { readonly gaps: readonly CapabilityGap[] },
  spec: StoryboardGapSpec,
): CapabilityGap {
  const gap = snapshot.gaps.find(
    (candidate) =>
      candidate.category === spec.category && candidate.confidence === spec.confidence,
  );
  if (!gap) throw new Error(`demo: gap of spec ${spec.id} missing`);
  return gap;
}

/** 快照检视面（refresh + 决不容忍未加载态——demo 剧本的 load 步骤负责加载）。 */
async function view(controller: EscalationStudioController) {
  const snapshot = await controller.refresh();
  if (!snapshot) throw new Error("demo: escalation plane is not loaded");
  return snapshot;
}

/**
 * 执行一步剧本。控制器必须已 load（load 步骤负责加载）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runEscalationDemoStep(
  controller: EscalationStudioController,
  demoStep: EscalationDemoStep,
): Promise<EscalationDemoStepOutcome> {
  switch (demoStep.id) {
    case "load": {
      const snapshot = await controller.load({ workspaceKey: "you-w8b-escalation-demo" });
      return outcome(
        "load",
        `Escalation plane loaded (${snapshot.studioId}, ${snapshot.categories.length} frozen gap categories, ${snapshot.learningPermissions.length} learning permissions none/aggregate/full, ${snapshot.providers.length} registered arena providers, retry policy maxAttempts=${snapshot.retryPolicy.maxAttempts}/${snapshot.retryPolicy.backoffClass}). The authorization gate, status ladder and expert-result review all render from these controller projections — zero business logic in the UI.`,
        [snapshot.studioId],
        { panel: "gaps" },
      );
    }
    case "gap-open": {
      const gap = await controller.openCapabilityGap({ gapSpecId: "fx-gapspec-001" });
      return outcome(
        "gap-open",
        `CapabilityGap ${gap.id} recorded: ${gap.category} at confidence ${gap.confidence} with ${gap.attemptedStrategies.length} attempted strategies and ${gap.failureEvidence.length} content-addressed failure-evidence refs. The gap-opened linkage (intent/strategies/evidence) is journaled as capability-gap-detected; eligibility computes to "${gap.escalationEligibility}".`,
        [gap.id],
        { panel: "gaps", selectedGapId: gap.id },
      );
    }
    case "gap-sweep": {
      const refs: string[] = [];
      const categories: string[] = [];
      for (const spec of ESCALATION_STORYBOARD_GAP_SPECS.slice(1)) {
        const gap = await controller.openCapabilityGap({ gapSpecId: spec.id });
        refs.push(gap.id);
        categories.push(gap.category);
      }
      return outcome(
        "gap-sweep",
        `Seven more gaps recorded (${categories.join(", ")}) — all seven frozen CapabilityGapCategory classes are now on the plane, each immutable with content-addressed failure-evidence labels and simulated: true. The low-confidence spec lands as a legal "not-eligible" record (gap persistence never refuses records — only escalation eligibility gates).`,
        refs,
        { panel: "gaps" },
      );
    }
    case "gap-ineligible": {
      // 预期中的 typed error：不可升级 gap ⇒ YOU_ESCALATION_STATE_INVALID。
      const spec = storyboardGapSpecById("fx-gapspec-008")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const error = await expectTypedError(() =>
        controller.requestEscalation({ gapId: gap.id }),
      );
      return outcome(
        "gap-ineligible",
        `${error.youError.code}: ${error.youError.message} — the v1 eligibility rule (>= 1 attempted strategy AND confidence >= 0.5) is enforced before an escalation exists; the gap record itself stays legal and immutable.`,
        [gap.id],
        { panel: "gaps", selectedGapId: gap.id },
      );
    }
    case "projection-tool": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const published = await controller.publishGapProjection({ gapId: gap.id, kind: "tool" });
      return outcome(
        "projection-tool",
        `ToolGapProjection published for ${published.tool?.gapId}: tool ${published.tool?.toolId} (content-addressed label), required capability "${published.tool?.requiredCapability}", remediation "${published.tool?.remediation}". Projections are derived, never authoritative — journaled as gap-projection-published.`,
        [published.tool?.gapId ?? "", published.tool?.toolId ?? ""],
        { panel: "gaps", selectedGapId: gap.id },
      );
    }
    case "projection-knowledge": {
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const published = await controller.publishGapProjection({
        gapId: gap.id,
        kind: "knowledge",
      });
      return outcome(
        "projection-knowledge",
        `KnowledgeGapProjection published for ${published.knowledge?.gapId}: domain "${published.knowledge?.domain}", missing knowledge ${published.knowledge?.missingKnowledgeRef} (content-addressed label), remediation "${published.knowledge?.remediation}". Same law: derived views for display and remediation planning, never a second authority.`,
        [published.knowledge?.gapId ?? "", published.knowledge?.missingKnowledgeRef ?? ""],
        { panel: "gaps", selectedGapId: gap.id },
      );
    }
    case "projection-invalid": {
      // 预期中的 typed error：未知投影 kind ⇒ YOU_GAP_PROJECTION_INVALID。
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const error = await expectTypedError(() =>
        controller.publishGapProjection({ gapId: gap.id, kind: "process" as never }),
      );
      return outcome(
        "projection-invalid",
        `${error.youError.code}: ${error.youError.message} — the projection builder is fail-closed: an unknown projection kind (or a malformed gap record) is a typed refusal, never a guessed or silently-repaired projection.`,
        [gap.id],
        { panel: "gaps", selectedGapId: gap.id },
      );
    }
    case "policy-invalid": {
      // 预期中的 typed error：非法 policy 草稿 ⇒ YOU_RETRY_POLICY_INVALID。
      const error = await expectTypedError(() =>
        controller.validateRetryPolicy({
          maxAttempts: 0,
          backoffClass: "exponential-jitter",
          eligibilityCategories: ["TOOL_GAP"],
          requiresAuthorization: true,
        }),
      );
      return outcome(
        "policy-invalid",
        `${error.youError.code}: ${error.youError.message} — the stateless validator (attempt bounds [1,10], backoff class format, eligibility category gates, requires-authorization flag) refuses invalid drafts; nothing is configured and nothing is silently clamped.`,
        [],
        { panel: "gate" },
      );
    }
    case "escalation-request": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const requested = await controller.requestEscalation({ gapId: gap.id });
      return outcome(
        "escalation-request",
        `Escalation ${requested.escalation.escalationId} requested on ${gap.id} — the v1 ladder opens at "requested" with the minimum context capsule (${requested.escalation.minimumContext.join(", ")}) and required scope "${requested.escalation.requiredScope}". The gap record is immutably replaced to escalationEligibility "escalated" carrying the ArenaEscalationRef.`,
        [requested.escalation.escalationId, gap.id],
        { panel: "progress", selectedEscalationId: requested.escalation.escalationId },
      );
    }
    case "unauthorized-run": {
      // 预期中的 typed error：无授权运行 ⇒ YOU_ESCALATION_AUTHORIZATION_REQUIRED。
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const error = await expectTypedError(() =>
        controller.startArenaRun({ escalationId: escalation.escalationId }),
      );
      return outcome(
        "unauthorized-run",
        `${error.youError.code}: ${error.youError.message} — the ESCALATION AUTHORIZATION LAW: an escalation NEVER runs without an explicit, in-scope, unexpired grant; the gate evaluation order is missing -> withdrawn -> expired -> scope-mismatch (fail closed).`,
        [escalation.escalationId],
        { panel: "gate", selectedEscalationId: escalation.escalationId },
      );
    }
    case "grant-invalid": {
      // 预期中的 typed error：非法授权形状 ⇒ YOU_ESCALATION_STATE_INVALID。
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const error = await expectTypedError(() =>
        controller.grantAuthorization({
          escalationId: escalation.escalationId,
          scope: "  ",
          expiresAt: null,
          learningPermission: "aggregate",
        }),
      );
      return outcome(
        "grant-invalid",
        `${error.youError.code}: ${error.youError.message} — grant shape first (non-empty scope, frozen learning permission literal, null-or-ISO expiry); the live gate then evaluates scope/expiry at use time. Nothing partial is recorded.`,
        [escalation.escalationId],
        { panel: "gate", selectedEscalationId: escalation.escalationId },
      );
    }
    case "grant-aggregate": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const granted = await controller.grantAuthorization({
        escalationId: escalation.escalationId,
        scope: escalation.requiredScope,
        expiresAt: null,
        learningPermission: "aggregate",
      });
      return outcome(
        "grant-aggregate",
        `EscalationAuthorization ${granted.entry.record.id} granted: scope "${granted.entry.record.scope}" (in-scope), no expiry, learning permission "aggregate". The immutable record moves the ladder to "${granted.escalation.status}" and journals escalation-authorized + learning-permission-recorded — the ARENA LEARNING PERMISSION LAW made visible before any run.`,
        [granted.entry.record.id],
        { panel: "permissions", selectedEscalationId: escalation.escalationId },
      );
    }
    case "run-start": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const started = await controller.startArenaRun({ escalationId: escalation.escalationId });
      return outcome(
        "run-start",
        `ArenaRun ${started.run.id} recorded (attempt ${started.run.attempt}, strategy "${started.run.strategy}") — the append-only run ladder opens and the escalation moves to "${started.escalation.status}" (arena-run-recorded carries the ladder transition).`,
        [started.run.id],
        { panel: "progress", selectedEscalationId: escalation.escalationId, selectedRunId: started.run.id },
      );
    }
    case "run-fail": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const activeRun = snapshot.runs.find(
        (run) => run.gapId === escalation.gapId && run.status === "started",
      );
      if (!activeRun) throw new Error("demo: started run missing");
      const failed = await controller.completeArenaRun({
        runId: activeRun.id,
        outcome: "failed",
      });
      return outcome(
        "run-fail",
        `ArenaRun ${failed.id} reached the "failed" terminal at ${failed.completedAt} — terminals are locked and the ladder stays append-only; the deterministic retry policy (maxAttempts=${snapshot.retryPolicy.maxAttempts}) is the only re-entry, never an in-place mutation.`,
        [failed.id],
        { panel: "progress", selectedEscalationId: escalation.escalationId, selectedRunId: failed.id },
      );
    }
    case "run-retry": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const retried = await controller.startArenaRun({ escalationId: escalation.escalationId });
      return outcome(
        "run-retry",
        `ArenaRun ${retried.run.id} appended as attempt ${retried.run.attempt} (bounded by the retry policy: attempts 1..${snapshot.retryPolicy.maxAttempts}). The escalation stays "${retried.escalation.status}" — a retry appends to the run ladder, it never resets it.`,
        [retried.run.id],
        { panel: "progress", selectedEscalationId: escalation.escalationId, selectedRunId: retried.run.id },
      );
    }
    case "provider-unknown": {
      // 预期中的 typed error：未知 provider ⇒ YOU_ARENA_ADAPTER_UNSUPPORTED。
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const error = await expectTypedError(() =>
        controller.invokeArenaProvider({
          escalationId: escalation.escalationId,
          providerId: "fx-arena-provider-999",
        }),
      );
      return outcome(
        "provider-unknown",
        `${error.youError.code}: ${error.youError.message} — provider neutrality: arena providers are opaque descriptors behind a fail-closed seam; unknown ids never fall back to another provider (${snapshot.providers.length} registered).`,
        [escalation.escalationId],
        { panel: "progress", selectedEscalationId: escalation.escalationId },
      );
    }
    case "deliver-typed-payload": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const provider = ESCALATION_STORYBOARD_PROVIDERS[0]!;
      const delivered = await controller.invokeArenaProvider({
        escalationId: escalation.escalationId,
        providerId: provider.id,
      });
      return outcome(
        "deliver-typed-payload",
        `Arena provider ${provider.id} delivered a ${delivered.result.resultType} expert result for ${escalation.escalationId} (payload keys: ${Object.keys(delivered.result.payload).sort().join(", ")}) — the ARENA BOUNDARY LAW: results return as typed payloads, and the active run ${delivered.run.id} completes with content-addressed outcome evidence. The escalation moves to "${delivered.escalation.status}".`,
        [delivered.run.id],
        { panel: "results", selectedEscalationId: escalation.escalationId },
      );
    }
    case "apply-result": {
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const applied = await controller.applyExpertResult({
        escalationId: escalation.escalationId,
      });
      const changeSetId = applied.escalation.expertResult?.appliesAsChangeSetId ?? "";
      return outcome(
        "apply-result",
        `Expert result applied through YOU's own authority: appliesAsChangeSetId ${changeSetId} (deterministically derived, content-addressed) — journaled as arena-result-applied. The ladder reaches the "${applied.escalation.status}" terminal and the gap's ArenaEscalationRef is immutably replaced.`,
        [changeSetId],
        { panel: "results", selectedEscalationId: escalation.escalationId },
      );
    }
    case "escalation-request-expert": {
      const spec = storyboardGapSpecById("fx-gapspec-007")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const requested = await controller.requestEscalation({ gapId: gap.id });
      return outcome(
        "escalation-request-expert",
        `Second escalation ${requested.escalation.escalationId} requested on the EXPERT_GAP ${gap.id} (confidence ${gap.confidence}) — the artifact-result path: required scope "${requested.escalation.requiredScope}".`,
        [requested.escalation.escalationId, gap.id],
        { panel: "progress", selectedEscalationId: requested.escalation.escalationId },
      );
    }
    case "grant-expired": {
      const spec = storyboardGapSpecById("fx-gapspec-007")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: expert-gap escalation missing");
      const pastPreset = ESCALATION_STORYBOARD_EXPIRY_PRESETS[2]!;
      const granted = await controller.grantAuthorization({
        escalationId: escalation.escalationId,
        scope: escalation.requiredScope,
        expiresAt: pastPreset.expiresAt,
        learningPermission: "aggregate",
      });
      return outcome(
        "grant-expired",
        `EscalationAuthorization ${granted.entry.record.id} recorded with expiresAt ${granted.entry.record.expiresAt} (the past fixture preset): the grant is shape-valid and honestly recorded — an immutable record with a past expiry simply never authorizes; liveness is evaluated by the live gate, and renewal means a NEW record (never an in-place mutation).`,
        [granted.entry.record.id],
        { panel: "gate", selectedEscalationId: escalation.escalationId },
      );
    }
    case "expired-run": {
      // 预期中的 typed error：过期授权 ⇒ YOU_ESCALATION_AUTHORIZATION_REQUIRED。
      const spec = storyboardGapSpecById("fx-gapspec-007")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: expert-gap escalation missing");
      const error = await expectTypedError(() =>
        controller.startArenaRun({ escalationId: escalation.escalationId }),
      );
      return outcome(
        "expired-run",
        `${error.youError.code}: ${error.youError.message} — the live gate compares the immutable grant's expiresAt against the deterministic projection clock; expired grants fail closed exactly like missing ones.`,
        [escalation.escalationId],
        { panel: "gate", selectedEscalationId: escalation.escalationId },
      );
    }
    case "regrant-full": {
      const spec = storyboardGapSpecById("fx-gapspec-007")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: expert-gap escalation missing");
      const granted = await controller.grantAuthorization({
        escalationId: escalation.escalationId,
        scope: escalation.requiredScope,
        expiresAt: null,
        learningPermission: "full",
      });
      return outcome(
        "regrant-full",
        `Renewal as a new record: EscalationAuthorization ${granted.entry.record.id} (no expiry, learning permission "full") joins the append-only ledger after the expired grant — nothing was mutated. The escalation ladder stays "${granted.escalation.status}" (re-grants never rewind status).`,
        [granted.entry.record.id],
        { panel: "permissions", selectedEscalationId: escalation.escalationId },
      );
    }
    case "deliver-artifact": {
      const spec = storyboardGapSpecById("fx-gapspec-007")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: expert-gap escalation missing");
      const provider = ESCALATION_STORYBOARD_PROVIDERS[0]!;
      const started = await controller.startArenaRun({ escalationId: escalation.escalationId });
      const delivered = await controller.invokeArenaProvider({
        escalationId: escalation.escalationId,
        providerId: provider.id,
      });
      const artifactRef = delivered.result.payload.artifactRef;
      return outcome(
        "deliver-artifact",
        `Provider ${provider.id} delivered an ${delivered.result.resultType} expert result (run ${started.run.id} attempt ${started.run.attempt}): artifact label ${artifactRef} with content hash ${delivered.result.payload.artifactHash} — content-addressed labels only, the artifact bytes are never inlined into records or events. The escalation moves to "${delivered.escalation.status}" for review.`,
        [String(artifactRef)],
        { panel: "results", selectedEscalationId: escalation.escalationId },
      );
    }
    case "reject-result": {
      const spec = storyboardGapSpecById("fx-gapspec-007")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: expert-gap escalation missing");
      const rejected = await controller.rejectExpertResult({
        escalationId: escalation.escalationId,
        reason: "expert correction artifact declined after review",
      });
      return outcome(
        "reject-result",
        `Expert result rejected with an explicit reason ("${rejected.rejectionReason}") — delivered -> rejected is a locked terminal on the v1 ladder. Honest disclosure: the frozen event vocabulary carries no escalation-rejected type, so this terminal is service-side state (journaled nowhere), exactly like the W6B pre-validation candidate states.`,
        [escalation.escalationId],
        { panel: "results", selectedEscalationId: escalation.escalationId },
      );
    }
    case "escalation-request-knowledge": {
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const gap = gapOfSpec(snapshot, spec);
      const requested = await controller.requestEscalation({ gapId: gap.id });
      return outcome(
        "escalation-request-knowledge",
        `Third escalation ${requested.escalation.escalationId} requested on the KNOWLEDGE_GAP ${gap.id} (required scope "${requested.escalation.requiredScope}") — the withdrawal path: authorize, run, then withdraw the learning permission mid-flight.`,
        [requested.escalation.escalationId, gap.id],
        { panel: "progress", selectedEscalationId: requested.escalation.escalationId },
      );
    }
    case "grant-none": {
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: knowledge-gap escalation missing");
      const granted = await controller.grantAuthorization({
        escalationId: escalation.escalationId,
        scope: escalation.requiredScope,
        expiresAt: null,
        learningPermission: "none",
      });
      return outcome(
        "grant-none",
        `EscalationAuthorization ${granted.entry.record.id} granted with learning permission "none" — the run is authorized, but the learning machine may derive NOTHING from it (the ARENA LEARNING PERMISSION LAW: none/aggregate/full is an explicit user decision recorded on the grant, never a default).`,
        [granted.entry.record.id],
        { panel: "permissions", selectedEscalationId: escalation.escalationId },
      );
    }
    case "run-start-knowledge": {
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: knowledge-gap escalation missing");
      const started = await controller.startArenaRun({ escalationId: escalation.escalationId });
      return outcome(
        "run-start-knowledge",
        `ArenaRun ${started.run.id} started on the knowledge-gap escalation (attempt ${started.run.attempt}) — in-progress with a live "none"-permission grant: authorized to run, forbidden to teach.`,
        [started.run.id],
        { panel: "progress", selectedEscalationId: escalation.escalationId, selectedRunId: started.run.id },
      );
    }
    case "permission-withdraw": {
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: knowledge-gap escalation missing");
      const live = snapshot.liveAuthorizations.find(
        (entry) => entry.escalationId === escalation.escalationId,
      );
      if (!live || live.record === null) throw new Error("demo: live grant missing");
      const withdrawn = await controller.withdrawAuthorization({
        authorizationId: live.record.id,
      });
      return outcome(
        "permission-withdraw",
        `Withdrawal is a new record: ${withdrawn.record.id} (learningPermission "none", supersedes ${withdrawn.supersedesRecordId}) — journaled as learning-permission-recorded with the withdrawal marker. The wave-6 rights-law display pattern at the arena boundary: withdrawal projects instantly, nothing is mutated in place.`,
        [withdrawn.record.id, withdrawn.supersedesRecordId ?? ""],
        { panel: "permissions", selectedEscalationId: escalation.escalationId },
      );
    }
    case "post-withdrawal-refusal": {
      // 预期中的 typed error：撤回后运行 ⇒ YOU_ESCALATION_AUTHORIZATION_REQUIRED。
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: knowledge-gap escalation missing");
      const provider = ESCALATION_STORYBOARD_PROVIDERS[0]!;
      const error = await expectTypedError(() =>
        controller.invokeArenaProvider({
          escalationId: escalation.escalationId,
          providerId: provider.id,
        }),
      );
      return outcome(
        "post-withdrawal-refusal",
        `${error.youError.code}: ${error.youError.message} — withdrawal fails the gate closed LIVE (evaluation order: missing -> withdrawn -> expired -> scope); the started run stays on the ladder untouched.`,
        [escalation.escalationId],
        { panel: "permissions", selectedEscalationId: escalation.escalationId },
      );
    }
    case "cancel-escalation": {
      const spec = storyboardGapSpecById("fx-gapspec-005")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: knowledge-gap escalation missing");
      const cancelled = await controller.cancelEscalation({
        escalationId: escalation.escalationId,
      });
      return outcome(
        "cancel-escalation",
        `Escalation ${escalation.escalationId} cancelled (escalation-cancelled journaled; statusAfter "${cancelled.escalation.status}") and its started run was closed as "aborted" — every long-running operation is cancellable, and terminals never reopen.`,
        [escalation.escalationId],
        { panel: "progress", selectedEscalationId: escalation.escalationId },
      );
    }
    case "not-found-refusals": {
      // 预期中的 typed error ×2：未知升级 / 未知 run。
      const escalationError = await expectTypedError(() =>
        controller.applyExpertResult({ escalationId: "fx-escalation-999" }),
      );
      const runError = await expectTypedError(() =>
        controller.completeArenaRun({ runId: "fx-run-999", outcome: "failed" }),
      );
      return outcome(
        "not-found-refusals",
        `${escalationError.youError.code}: ${escalationError.youError.message} — and ${runError.youError.code}: ${runError.youError.message} — unknown escalation and run ids are typed refusals; records are addressed by their immutable ids, never guessed.`,
        [],
        { panel: "progress" },
      );
    }
    case "terminal-refusal": {
      // 预期中的 typed error：终态升级上再应用 ⇒ YOU_ESCALATION_STATE_INVALID。
      const spec = storyboardGapSpecById("fx-gapspec-001")!;
      const snapshot = await view(controller);
      const escalation = escalationOfGap(snapshot, gapOfSpec(snapshot, spec).id);
      if (!escalation) throw new Error("demo: tool-gap escalation missing");
      const error = await expectTypedError(() =>
        controller.applyExpertResult({ escalationId: escalation.escalationId }),
      );
      return outcome(
        "terminal-refusal",
        `${error.youError.code}: ${error.youError.message} — the applied terminal is locked; the transition table (requested -> authorized -> in-progress -> delivered -> applied | rejected | cancelled) refuses every illegal edge with a typed error panel.`,
        [escalation.escalationId],
        { panel: "progress", selectedEscalationId: escalation.escalationId },
      );
    }
  }
}
