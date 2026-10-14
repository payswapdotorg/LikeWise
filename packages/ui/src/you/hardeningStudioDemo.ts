/* oxlint-disable eslint(max-lines) -- demo 驱动器是单 switch 的 golden 序列状态机（24 步 × 每步确定性 summary 即 golden 期望——拆分只会让 golden 序列跨模块碎片化、增加 T10 换绑时的对照成本）；T10 换绑 Worker A/C 的 hardening 服务后本文件整体退役。 */
// YOU Hardening Studio — 确定性 operator demo 驱动器（W10B）。
//
// 覆盖 W10B 验收的完整 hardening 箭头（W10A/W10C fixture 场景的 UI 侧镜像）：
// deny/defer/shed 三路限流耗尽（RATE LIMIT LAW：enforce BEFORE effect + 记录 +
// 从不静默）→ 未注册 scan class 的 fail-closed 拒绝（unscanned imports never
// enter evidence）→ clean / quarantined / rejected 三 verdict → 非 quarantined
// 放行拒绝 → 显式 release record → 重复放行拒绝（IMPORT SECURITY LAW）→
// consent-protected retention 拒绝 → withdrawn / expired 两路 enforcement
//（RETENTION LAW + wave-2 consent 法律）→ corrupted restore 的
// hash-mismatch-before-activation 拒绝 → verified restore（DR LAW）→
// unknown matrix ref 拒绝（ECOSYSTEM GATE LAW 声明侧镜像）→ 无回滚证据的
// eligible 拒绝 → blocked / eligible 决定 → reversal 新记录 → 重复反转拒绝
//（PRODUCTION ELIGIBILITY LAW）→ 未知 id 的 typed 拒绝。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  HardeningStudioError,
  type HardeningStudioController,
} from "./hardeningController.js";
import type {
  HardeningDemoStep,
  HardeningDemoStepId,
} from "./hardeningStudioDemoSteps.js";
export {
  HARDENING_DEMO_STEPS,
  HARDENING_DEMO_TOTAL_STEPS,
  type HardeningDemoStep,
  type HardeningDemoStepId,
} from "./hardeningStudioDemoSteps.js";
import type { HardeningPanelId } from "./hardeningStudioStore.js";
import type { ImportVerdictView } from "./hardeningController.js";

/** 步骤对视图状态的提示（由 useHardeningStudio 应用；驱动器不直接写 store）。 */
export interface HardeningDemoUiHint {
  readonly panel?: HardeningPanelId;
  readonly selectedEnforcementId?: string | null;
  readonly selectedImportVerdictId?: string | null;
  readonly selectedRetentionRecordId?: string | null;
  readonly selectedDrRestoreId?: string | null;
  readonly selectedEligibilityRecordId?: string | null;
}

export interface HardeningDemoStepOutcome {
  readonly stepId: HardeningDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（enforcement / verdict / release / record 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: HardeningDemoUiHint;
}

function outcome(
  stepId: HardeningDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: HardeningDemoUiHint = {},
): HardeningDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<HardeningStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof HardeningStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error(
    "demo: expected a typed HardeningStudioError, but the operation succeeded",
  );
}

/** 快照检视面（refresh + 决不容忍未加载态——demo 剧本的 load 步骤负责加载）。 */
async function view(controller: HardeningStudioController) {
  const snapshot = await controller.refresh();
  if (!snapshot) throw new Error("demo: hardening plane is not loaded");
  return snapshot;
}

/** verdict → 摘要里的人类可读短语（id + verdict + scan class）。 */
function describeVerdict(entry: ImportVerdictView): string {
  return `${entry.verdict.id} (${entry.verdict.verdict} under ${entry.verdict.scanClass})`;
}

/**
 * 把一个 policy 打到耗尽（确定性子程序：burst 次放行后第 burst+1 次 enforcement）
 * ——返回 enforcement 记录 id（从 typed error 的 details 取）。
 */
async function exhaustPolicy(
  controller: HardeningStudioController,
  policyId: string,
): Promise<{ error: HardeningStudioError; allowedRemaining: number[] }> {
  const snapshot = await view(controller);
  const policy = snapshot.policies.find((entry) => entry.id === policyId);
  if (!policy) throw new Error(`demo: policy ${policyId} missing`);
  const allowedRemaining: number[] = [];
  for (let index = 0; index < policy.burst; index += 1) {
    const attempt = await controller.enforceRateLimit({ policyId });
    if (!attempt.allowed) {
      throw new Error("demo: expected the attempt to be allowed within burst");
    }
    allowedRemaining.push(attempt.remaining);
  }
  const error = await expectTypedError(() =>
    controller.enforceRateLimit({ policyId }),
  );
  return { error, allowedRemaining };
}

/**
 * 执行一步剧本。控制器必须已 load（load 步骤负责加载）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runHardeningDemoStep(
  controller: HardeningStudioController,
  demoStep: HardeningDemoStep,
): Promise<HardeningDemoStepOutcome> {
  switch (demoStep.id) {
    case "load": {
      const snapshot = await controller.load({
        workspaceKey: "you-w10b-hardening-demo",
      });
      return outcome(
        "load",
        `Hardening plane loaded (${snapshot.studioId}, ${snapshot.rateLimitActions.length} frozen rate-limit actions ${snapshot.rateLimitActions.join(" / ")}, ${snapshot.importVerdicts.length} import verdict kinds, ${snapshot.consentStates.length} consent states, ${snapshot.policies.length} policies, ${snapshot.matrixEntries.length} matrix entries). The limit notices, import statuses, retention controls, DR status and release readiness all render from these controller projections — zero business logic in the UI.`,
        [snapshot.studioId],
        { panel: "limits" },
      );
    }
    case "limit-deny-exceeded": {
      const { error, allowedRemaining } = await exhaustPolicy(
        controller,
        "policy-render-submit",
      );
      const enforcementId = String(error.youError.details.enforcementId ?? "");
      return outcome(
        "limit-deny-exceeded",
        `${error.youError.code}: ${error.youError.message} — the RATE LIMIT LAW: limits enforce BEFORE the effect; the burst budget (${allowedRemaining.length} allowed attempts, remaining ${allowedRemaining.join(" -> ")}) exhausted, so the deny action fired before any effect and appended enforcement record ${enforcementId}. Throttling is never silent.`,
        [enforcementId],
        { panel: "limits", selectedEnforcementId: enforcementId },
      );
    }
    case "limit-defer-exceeded": {
      const { error, allowedRemaining } = await exhaustPolicy(
        controller,
        "policy-import-scan",
      );
      const enforcementId = String(error.youError.details.enforcementId ?? "");
      return outcome(
        "limit-defer-exceeded",
        `${error.youError.code}: ${error.youError.message} — the defer class is for queueable work only: ${allowedRemaining.length} allowed attempts then the window exhausted, enforcement record ${enforcementId} appended (deny/defer/shed all journal — never silent) with window and retry guidance for the queued retry.`,
        [enforcementId],
        { panel: "limits", selectedEnforcementId: enforcementId },
      );
    }
    case "limit-shed-exceeded": {
      const { error, allowedRemaining } = await exhaustPolicy(
        controller,
        "policy-export-peak",
      );
      const enforcementId = String(error.youError.details.enforcementId ?? "");
      return outcome(
        "limit-shed-exceeded",
        `${error.youError.code}: ${error.youError.message} — the shed class drops the request under peak load: ${allowedRemaining.length} allowed attempt then the burst-1 window exhausted; enforcement record ${enforcementId} appended with retry guidance. All three frozen actions (deny / defer / shed) now have recorded notices.`,
        [enforcementId],
        { panel: "limits", selectedEnforcementId: enforcementId },
      );
    }
    case "import-unscanned-refusal": {
      const error = await expectTypedError(() =>
        controller.scanImport({
          artifactId: "import-artifact-portrait",
          scanClassId: "scan-class-unregistered",
        }),
      );
      return outcome(
        "import-unscanned-refusal",
        `${error.youError.code}: ${error.youError.message} — the IMPORT SECURITY LAW: unscanned imports never enter evidence; an unregistered scan class fails closed with a typed refusal, never a silently repaired scan.`,
        [],
        { panel: "imports" },
      );
    }
    case "import-clean": {
      const scanned = await controller.scanImport({
        artifactId: "import-artifact-portrait",
        scanClassId: "scan-class-media-upload",
      });
      return outcome(
        "import-clean",
        `Import scanned clean: ${describeVerdict(scanned)} — the artifact enters evidence (durable record; the frozen v10 event vocabulary carries no import-clean type, so a clean verdict journals no event — disclosed).`,
        [scanned.verdict.id],
        { panel: "imports", selectedImportVerdictId: scanned.verdict.id },
      );
    }
    case "import-quarantined": {
      const scanned = await controller.scanImport({
        artifactId: "import-artifact-bundle-sig",
        scanClassId: "scan-class-package-bundle",
      });
      return outcome(
        "import-quarantined",
        `Import quarantined: ${describeVerdict(scanned)} at ${scanned.verdict.quarantinedAt} — fail-closed quarantine with the import-quarantined event journaled; reversible only through an explicit release record.`,
        [scanned.verdict.id],
        { panel: "imports", selectedImportVerdictId: scanned.verdict.id },
      );
    }
    case "import-release-not-quarantined": {
      const snapshot = await view(controller);
      const clean = snapshot.importVerdictRecords.find(
        (entry) => entry.verdict.verdict === "clean",
      );
      if (!clean) throw new Error("demo: clean verdict missing");
      const error = await expectTypedError(() =>
        controller.releaseQuarantinedImport({ verdictId: clean.verdict.id }),
      );
      return outcome(
        "import-release-not-quarantined",
        `${error.youError.code}: ${error.youError.message} — only a quarantined verdict can be released; the release path refuses clean and rejected verdicts alike (fail closed).`,
        [],
        { panel: "imports", selectedImportVerdictId: clean.verdict.id },
      );
    }
    case "import-release": {
      const snapshot = await view(controller);
      const quarantined = snapshot.importVerdictRecords.find(
        (entry) =>
          entry.verdict.verdict === "quarantined" && entry.releaseRecordId === null,
      );
      if (!quarantined) throw new Error("demo: unreleased quarantined verdict missing");
      const released = await controller.releaseQuarantinedImport({
        verdictId: quarantined.verdict.id,
      });
      return outcome(
        "import-release",
        `Quarantined import released: ${released.releaseRecordId} reverses verdict ${quarantined.verdict.id} at ${released.releasedAt} through an explicit release record (the only reversible path out of quarantine — the frozen v10 event vocabulary carries no import-released type, so the release is a durable record without a journaled event; disclosed).`,
        [released.releaseRecordId ?? ""],
        { panel: "imports", selectedImportVerdictId: quarantined.verdict.id },
      );
    }
    case "import-release-again": {
      const snapshot = await view(controller);
      const released = snapshot.importVerdictRecords.find(
        (entry) => entry.releaseRecordId !== null,
      );
      if (!released) throw new Error("demo: released verdict missing");
      const error = await expectTypedError(() =>
        controller.releaseQuarantinedImport({ verdictId: released.verdict.id }),
      );
      return outcome(
        "import-release-again",
        `${error.youError.code}: ${error.youError.message} — quarantine reverses exactly once through an explicit release record; a second release is a typed refusal.`,
        [],
        { panel: "imports", selectedImportVerdictId: released.verdict.id },
      );
    }
    case "import-rejected": {
      const scanned = await controller.scanImport({
        artifactId: "import-artifact-model-license",
        scanClassId: "scan-class-model-weights",
      });
      return outcome(
        "import-rejected",
        `Import rejected: ${describeVerdict(scanned)} — the license-forbidden finding is terminal: rejected imports never enter evidence and are never releasable (durable record; no journaled event for the rejected verdict — disclosed, same vocabulary rule as clean).`,
        [scanned.verdict.id],
        { panel: "imports", selectedImportVerdictId: scanned.verdict.id },
      );
    }
    case "retention-consent-protected": {
      const error = await expectTypedError(() =>
        controller.enforceRetention({
          subjectId: "subject-evidence-granted",
          retentionClassId: "retention-class-evidence-raw",
        }),
      );
      return outcome(
        "retention-consent-protected",
        `${error.youError.code}: ${error.youError.message} — the RETENTION LAW: enforcement records are immutable and auditable, but a retention class never overrides an active consent (the wave-2 consent laws hold); the granted subject stays protected.`,
        [],
        { panel: "retention" },
      );
    }
    case "retention-enforced-withdrawn": {
      const record = await controller.enforceRetention({
        subjectId: "subject-evidence-withdrawn",
        retentionClassId: "retention-class-evidence-raw",
      });
      return outcome(
        "retention-enforced-withdrawn",
        `Retention enforced: record ${record.id} applies class ${record.retentionClass} to subject ${record.subjectRef} at ${record.enforcedAt} — the consent was withdrawn (no active consent to protect), so the pass proceeds and journals retention-enforced.`,
        [record.id],
        { panel: "retention", selectedRetentionRecordId: record.id },
      );
    }
    case "retention-enforced-expired": {
      const record = await controller.enforceRetention({
        subjectId: "subject-evidence-expired",
        retentionClassId: "retention-class-telemetry",
      });
      return outcome(
        "retention-enforced-expired",
        `Retention enforced: record ${record.id} applies class ${record.retentionClass} to subject ${record.subjectRef} at ${record.enforcedAt} — an expired consent is not an active consent; only the granted state protects a subject.`,
        [record.id],
        { panel: "retention", selectedRetentionRecordId: record.id },
      );
    }
    case "dr-corrupted": {
      const error = await expectTypedError(() =>
        controller.runDrRestore({
          snapshotId: "dr-snapshot-primary",
          integrity: "corrupted",
        }),
      );
      return outcome(
        "dr-corrupted",
        `${error.youError.code}: ${error.youError.message} — the DR LAW: a restore verifies content hashes BEFORE activation; the corrupted preset records an honestly different observed hash, so activation is refused with no restore record (fail closed).`,
        [],
        { panel: "dr" },
      );
    }
    case "dr-verified": {
      const restored = await controller.runDrRestore({
        snapshotId: "dr-snapshot-primary",
        integrity: "honest",
      });
      return outcome(
        "dr-verified",
        `DR restore verified: ${restored.record.id} of ${restored.record.snapshotRef} at ${restored.record.restoredAt} — the content hash matched before activation, so DrRestoreRecord carries verified with the check-hash evidence (${restored.checkHash}) journaled in dr-restore-recorded; the flag is never asserted without check evidence.`,
        [restored.record.id],
        { panel: "dr", selectedDrRestoreId: restored.record.id },
      );
    }
    case "dr-secondary-verified": {
      const restored = await controller.runDrRestore({
        snapshotId: "dr-snapshot-secondary",
        integrity: "honest",
      });
      return outcome(
        "dr-secondary-verified",
        `DR restore verified: ${restored.record.id} of ${restored.record.snapshotRef} at ${restored.record.restoredAt} (check hash ${restored.checkHash}) — every restore record displays its verification state derived from the event-stream check evidence.`,
        [restored.record.id],
        { panel: "dr", selectedDrRestoreId: restored.record.id },
      );
    }
    case "eligibility-matrix-unknown": {
      const error = await expectTypedError(() =>
        controller.decideEligibility({
          matrixEntryId: "matrix-unknown-legacy",
          rollbackEvidenceId: "rollback-drill-render-eu",
          eligible: true,
        }),
      );
      return outcome(
        "eligibility-matrix-unknown",
        `${error.youError.code}: ${error.youError.message} — the ECOSYSTEM GATE LAW (declaration-side mirror): every ecosystem addition enters through the ProviderMatrix behind fail-closed adapters; an unknown matrix ref is a typed error, never an ad-hoc subject.`,
        [],
        { panel: "release" },
      );
    }
    case "eligibility-no-rollback": {
      const error = await expectTypedError(() =>
        controller.decideEligibility({
          matrixEntryId: "matrix-render-eu",
          rollbackEvidenceId: "rollback-evidence-none",
          eligible: true,
        }),
      );
      return outcome(
        "eligibility-no-rollback",
        `${error.youError.code}: ${error.youError.message} — the PRODUCTION ELIGIBILITY LAW: eligibility requires rollback evidence; an eligible decision without a real drill is a typed refusal (a blocked decision needs none — there is nothing to roll back).`,
        [],
        { panel: "release" },
      );
    }
    case "eligibility-blocked": {
      const entry = await controller.decideEligibility({
        matrixEntryId: "matrix-render-audit",
        rollbackEvidenceId: "rollback-evidence-none",
        eligible: false,
      });
      return outcome(
        "eligibility-blocked",
        `Blocked decision recorded: ${entry.record.id} marks subject ${entry.record.subjectRef} blocked at ${entry.record.decidedAt} — decisions are immutable and journaled as production-eligibility-decided; the release-readiness panel renders it as a blocked panel.`,
        [entry.record.id],
        { panel: "release", selectedEligibilityRecordId: entry.record.id },
      );
    }
    case "eligibility-eligible": {
      const entry = await controller.decideEligibility({
        matrixEntryId: "matrix-render-eu",
        rollbackEvidenceId: "rollback-drill-render-eu",
        eligible: true,
      });
      return outcome(
        "eligibility-eligible",
        `Eligible decision recorded: ${entry.record.id} marks subject ${entry.record.subjectRef} eligible at ${entry.record.decidedAt} with rollback evidence link ${entry.record.rollbackEvidenceRef} (content-addressed drill label) — eligibility requires the rollback evidence, and the decision is immutable.`,
        [entry.record.id],
        { panel: "release", selectedEligibilityRecordId: entry.record.id },
      );
    }
    case "eligibility-reverse": {
      const snapshot = await view(controller);
      const eligibleEntry = snapshot.eligibilityLedger.find(
        (candidate) =>
          candidate.record.eligible && candidate.kind === "decision",
      );
      if (!eligibleEntry) throw new Error("demo: eligible decision missing");
      const reversal = await controller.reverseEligibility({
        recordId: eligibleEntry.record.id,
      });
      return outcome(
        "eligibility-reverse",
        `Reversal recorded: ${reversal.record.id} supersedes ${eligibleEntry.record.id} for subject ${reversal.record.subjectRef} (eligible -> ${reversal.record.eligible ? "eligible" : "blocked"}) at ${reversal.record.decidedAt} — a reversal is a new immutable ledger record, never a mutation of the original decision.`,
        [reversal.record.id],
        { panel: "release", selectedEligibilityRecordId: reversal.record.id },
      );
    }
    case "eligibility-reverse-again": {
      const snapshot = await view(controller);
      const reversed = snapshot.eligibilityLedger.find(
        (candidate) => candidate.kind === "decision" && candidate.record.eligible,
      );
      if (!reversed) throw new Error("demo: original eligible decision missing");
      const error = await expectTypedError(() =>
        controller.reverseEligibility({ recordId: reversed.record.id }),
      );
      return outcome(
        "eligibility-reverse-again",
        `${error.youError.code}: ${error.youError.message} — the original decision is already reversed; the live record is the reversal. To change course again, decide anew (or reverse the reversal) — always as new records.`,
        [],
        { panel: "release", selectedEligibilityRecordId: reversed.record.id },
      );
    }
    case "not-found-refusals": {
      // 两个未知 id 的诚实 typed 拒绝（同一步——W9B not-found 先例同款）。
      const releaseError = await expectTypedError(() =>
        controller.releaseQuarantinedImport({ verdictId: "fx-h-verdict-999" }),
      );
      const retentionError = await expectTypedError(() =>
        controller.enforceRetention({
          subjectId: "subject-unknown",
          retentionClassId: "retention-class-evidence-raw",
        }),
      );
      return outcome(
        "not-found-refusals",
        `${releaseError.youError.code}: ${releaseError.youError.message} / ${retentionError.youError.code}: ${retentionError.youError.message} — unknown ids are typed refusals across the hardening planes; the UI never guesses an id.`,
        [],
        { panel: "imports" },
      );
    }
  }
}
