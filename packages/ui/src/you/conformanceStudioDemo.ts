// YOU Conformance Studio — 确定性 operator demo 驱动器（W11B）。
//
// 覆盖 W11B 验收的完整 hardening-verification 箭头（W11A/W11C fixture 场景的
// UI 侧镜像）：review 记录（findings verbatim）→ acceptance 独立不可变新记录
//（SECURITY REVIEW LAW）→ 重复接受 / 零 findings 接受 / 未知 scope 的 typed
// 拒绝 → simulated-labeled 报告（peak/p99 + regressions verbatim）→ measured
// 拒绝 / invented 拒绝 / 未注册 scenario 拒绝（LOAD TEST LAW）→ partial /
// full audit（counts verbatim）→ 零检查拒绝（CONFORMANCE LAW）→ 完整 20 点
// journey + failure-injection 演练 → 越界失败步 / measured / 未知 journey 拒绝
//（JOURNEY LAW）→ 第二条 runbook 演练 → exercise-claim 拒绝 / 未知 class 拒绝
//（RUNBOOK LAW）→ 终态总览。
//
// 法则：只用确定性 fixture 数据；每步产出可断言的 golden 期望；预期中的 typed
// error 被诚实记录为步骤结果（truth law——不伪装成功，不吞错误）。
import {
  ConformanceStudioError,
  conformanceReviewIsAccepted,
  type ConformanceStudioController,
} from "./conformanceController.js";
import type {
  ConformanceDemoStep,
  ConformanceDemoStepId,
} from "./conformanceStudioDemoSteps.js";
export {
  CONFORMANCE_DEMO_STEPS,
  CONFORMANCE_DEMO_TOTAL_STEPS,
  type ConformanceDemoStep,
  type ConformanceDemoStepId,
} from "./conformanceStudioDemoSteps.js";
import type { ConformancePanelId } from "./conformanceStudioStore.js";

/** 步骤对视图状态的提示（由 useConformanceStudio 应用；驱动器不直接写 store）。 */
export interface ConformanceDemoUiHint {
  readonly panel?: ConformancePanelId;
  readonly selectedReviewId?: string | null;
  readonly selectedLoadReportId?: string | null;
  readonly selectedAuditId?: string | null;
  readonly selectedJourneyRunId?: string | null;
  readonly selectedRunbookEntryId?: string | null;
}

export interface ConformanceDemoStepOutcome {
  readonly stepId: ConformanceDemoStepId;
  /** 确定性结果摘要（展示 + golden 断言）。预期 typed error 以 code 前缀诚实呈现。 */
  readonly summary: string;
  /** 本步骤产生的关键记录 id（review / report / audit / run / runbook entry 等）。 */
  readonly refs: readonly string[];
  readonly uiHint: ConformanceDemoUiHint;
}

function outcome(
  stepId: ConformanceDemoStepId,
  summary: string,
  refs: readonly string[] = [],
  uiHint: ConformanceDemoUiHint = {},
): ConformanceDemoStepOutcome {
  return { stepId, summary, refs, uiHint };
}

/** 诚实呈现预期中的 typed error（code + message；truth law）。 */
async function expectTypedError(
  operation: () => Promise<unknown>,
): Promise<ConformanceStudioError> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof ConformanceStudioError) {
      return error;
    }
    throw error;
  }
  throw new Error(
    "demo: expected a typed ConformanceStudioError, but the operation succeeded",
  );
}

/**
 * 执行一步剧本。控制器必须已 load（load 步骤负责加载）。
 * 每步只做确定性操作；非法状态会抛出端口级 typed error（非预期错误直接上抛）。
 */
export async function runConformanceDemoStep(
  controller: ConformanceStudioController,
  demoStep: ConformanceDemoStep,
): Promise<ConformanceDemoStepOutcome> {
  switch (demoStep.id) {
    case "load": {
      const snapshot = await controller.load({
        workspaceKey: "you-w11b-conformance-demo",
      });
      return outcome(
        "load",
        `Conformance plane loaded (${snapshot.studioId}, ${snapshot.reviewScopes.length} review scopes, ${snapshot.loadScenarios.length} load scenarios, ${snapshot.standards.length} standards, ${snapshot.journeys.length} journeys, ${snapshot.incidentClasses.length} incident classes). The review status, load-test reports, conformance audits, journey records and runbook entries all render from these controller projections — zero business logic in the UI. The ${snapshot.runbook.length} runbook registrations start explicitly marked unexercised (the RUNBOOK LAW's honest default).`,
        [snapshot.studioId],
        { panel: "review" },
      );
    }
    case "review-record-findings": {
      const entry = await controller.recordSecurityReview({
        scopeId: "review-scope-render-pipeline",
      });
      return outcome(
        "review-record-findings",
        `Review recorded: ${entry.record.id} on ${entry.record.scopeRef} with ${entry.record.findingsCount} findings verbatim (accepted: false) — findings are recorded exactly as the scope's finding set states, never summarized; the security-review-recorded event is journaled.`,
        [entry.record.id],
        { panel: "review", selectedReviewId: entry.record.id },
      );
    }
    case "review-accept": {
      const snapshot = await controller.refresh();
      const pending = snapshot.reviews.find(
        (candidate) =>
          candidate.kind === "review" &&
          !conformanceReviewIsAccepted(snapshot, candidate.record.id),
      );
      if (!pending) throw new Error("demo: pending review missing");
      const acceptance = await controller.acceptSecurityReview({
        reviewId: pending.record.id,
      });
      return outcome(
        "review-accept",
        `Acceptance landed: ${acceptance.record.id} (accepted: true, ${acceptance.record.findingsCount} findings verbatim) referencing the finding set of ${acceptance.supersedesReviewId} — the acceptance is a separate immutable decision (a NEW SecurityReviewRecord), never a mutation of the review.`,
        [acceptance.record.id],
        { panel: "review", selectedReviewId: acceptance.record.id },
      );
    }
    case "review-accept-again": {
      const snapshot = await controller.refresh();
      const accepted = snapshot.reviews.find(
        (candidate) =>
          candidate.kind === "review" &&
          conformanceReviewIsAccepted(snapshot, candidate.record.id),
      );
      if (!accepted) throw new Error("demo: accepted review missing");
      const error = await expectTypedError(() =>
        controller.acceptSecurityReview({ reviewId: accepted.record.id }),
      );
      return outcome(
        "review-accept-again",
        `${error.youError.code}: ${error.youError.message} — an acceptance is a separate immutable decision taken exactly once; repeating it is a typed refusal (the ledger is append-only history).`,
        [],
        { panel: "review", selectedReviewId: accepted.record.id },
      );
    }
    case "review-accept-zero-findings": {
      const recorded = await controller.recordSecurityReview({
        scopeId: "review-scope-zero-findings",
      });
      const error = await expectTypedError(() =>
        controller.acceptSecurityReview({ reviewId: recorded.record.id }),
      );
      return outcome(
        "review-accept-zero-findings",
        `Review ${recorded.record.id} recorded with ${recorded.record.findingsCount} findings verbatim, then ${error.youError.code}: ${error.youError.message} — acceptance references a non-empty finding set; an empty finding set is accepted only by staying unaccepted (the SECURITY REVIEW LAW's refusal path).`,
        [recorded.record.id],
        { panel: "review", selectedReviewId: recorded.record.id },
      );
    }
    case "review-unknown-scope": {
      const error = await expectTypedError(() =>
        controller.recordSecurityReview({ scopeId: "review-scope-missing" }),
      );
      return outcome(
        "review-unknown-scope",
        `${error.youError.code}: ${error.youError.message} — every review references a registered scope (fail closed); the UI never guesses a scope.`,
        [],
        { panel: "review" },
      );
    }
    case "load-test-simulated": {
      const report = await controller.runLoadTest({
        scenarioId: "load-scenario-render-peak",
        metricsSource: "simulated",
      });
      return outcome(
        "load-test-simulated",
        `Report ${report.id}: peak ${report.peakRps} rps / p99 ${report.p99Ms}ms on ${report.scenarioRef}, simulated-labeled (simulated: true) with ${report.regressions.length} regressions listed verbatim${report.regressions.length > 0 ? ` (${report.regressions.join("; ")})` : ""} — the load-test-recorded event is journaled and nothing is summarized away.`,
        [report.id],
        { panel: "load", selectedLoadReportId: report.id },
      );
    }
    case "load-test-measured-refusal": {
      const error = await expectTypedError(() =>
        controller.runLoadTest({
          scenarioId: "load-scenario-import-burst",
          metricsSource: "measured",
        }),
      );
      return outcome(
        "load-test-measured-refusal",
        `${error.youError.code}: ${error.youError.message} — the LOAD TEST LAW allows measured or simulated-labeled numbers; a fixture-simulated backing never fabricates the former (measured reports arrive with the T11 service binding).`,
        [],
        { panel: "load" },
      );
    }
    case "load-test-invented-refusal": {
      const error = await expectTypedError(() =>
        controller.runLoadTest({
          scenarioId: "load-scenario-render-peak",
          metricsSource: "invented",
        }),
      );
      return outcome(
        "load-test-invented-refusal",
        `${error.youError.code}: ${error.youError.message} — invented numbers never land: peak/p99 are measured or simulated-labeled, and the refusal is typed, never silent.`,
        [],
        { panel: "load" },
      );
    }
    case "load-test-unregistered-refusal": {
      const error = await expectTypedError(() =>
        controller.runLoadTest({
          scenarioId: "load-scenario-unregistered",
          metricsSource: "simulated",
        }),
      );
      return outcome(
        "load-test-unregistered-refusal",
        `${error.youError.code}: ${error.youError.message} — every report references a registered scenario (fail closed).`,
        [],
        { panel: "load" },
      );
    }
    case "audit-partial": {
      const audit = await controller.runConformanceAudit({
        standardId: "standard-wcag-aa",
        outcome: "partial",
      });
      return outcome(
        "audit-partial",
        `Audit ${audit.id} on ${audit.standard}: ${audit.checksPassed}/${audit.checksTotal} checks passed — the CONFORMANCE LAW states both counts verbatim; the conformance-audited event journals them and a partial pass is never dressed as a pass.`,
        [audit.id],
        { panel: "conformance", selectedAuditId: audit.id },
      );
    }
    case "audit-full": {
      const audit = await controller.runConformanceAudit({
        standardId: "standard-viewport-320",
        outcome: "full",
      });
      return outcome(
        "audit-full",
        `Audit ${audit.id} on ${audit.standard}: ${audit.checksPassed}/${audit.checksTotal} checks passed — even a full pass displays with the counts (never a bare pass).`,
        [audit.id],
        { panel: "conformance", selectedAuditId: audit.id },
      );
    }
    case "audit-zero-checks-refusal": {
      const error = await expectTypedError(() =>
        controller.runConformanceAudit({
          standardId: "standard-zero-checks",
          outcome: "full",
        }),
      );
      return outcome(
        "audit-zero-checks-refusal",
        `${error.youError.code}: ${error.youError.message} — the counts ARE the conformance statement: a pass without checks never lands.`,
        [],
        { panel: "conformance" },
      );
    }
    case "journey-simulated-full": {
      const run = await controller.recordJourneyRun({
        journeyId: "journey-launch-gate",
        failAtStep: null,
        runKind: "simulated",
      });
      return outcome(
        "journey-simulated-full",
        `Journey run ${run.record.id} (${run.record.journeyId}): ${run.record.stepsCompleted}/20 steps completed, no failed step, ${run.record.durationMs}ms duration, simulated-labeled — the 20-point launch-gate journey records every step and the e2e-journey-recorded event is journaled.`,
        [run.record.id],
        { panel: "journey", selectedJourneyRunId: run.record.id },
      );
    }
    case "journey-failure-injection": {
      const entry = await controller.exerciseRunbook({
        incidentClassId: "incident-render-provider-outage",
        via: "failure-injection",
      });
      const snapshot = await controller.refresh();
      const run = snapshot.journeyRuns.find(
        (candidate) =>
          candidate.kind === "failure-injection" &&
          candidate.incidentClassRef === "render-provider-outage",
      );
      if (!run) throw new Error("demo: failure-injection run missing");
      return outcome(
        "journey-failure-injection",
        `Failure injection: run ${run.record.id} completed ${run.record.stepsCompleted} steps and failed at ${run.record.failedStep} (${run.record.durationMs}ms) — the RUNBOOK LAW exercise: runbook ${entry.record.id} for render-provider-outage is now exercised by this journey (detection / containment / recovery stay displayed verbatim).`,
        [run.record.id, entry.record.id],
        {
          panel: "journey",
          selectedJourneyRunId: run.record.id,
          selectedRunbookEntryId: entry.record.id,
        },
      );
    }
    case "journey-out-of-range-refusal": {
      const error = await expectTypedError(() =>
        controller.recordJourneyRun({
          journeyId: "journey-launch-gate",
          failAtStep: 21,
          runKind: "simulated",
        }),
      );
      return outcome(
        "journey-out-of-range-refusal",
        `${error.youError.code}: ${error.youError.message} — the failed step is a real step of the 20-point journey (1..20 or null for the full run); the UI never invents step 21.`,
        [],
        { panel: "journey" },
      );
    }
    case "journey-measured-refusal": {
      const error = await expectTypedError(() =>
        controller.recordJourneyRun({
          journeyId: "journey-launch-gate",
          failAtStep: null,
          runKind: "measured",
        }),
      );
      return outcome(
        "journey-measured-refusal",
        `${error.youError.code}: ${error.youError.message} — the JOURNEY LAW: simulated runs stay labeled; a fixture-simulated harness never fabricates measured durations (measured runs arrive with the T11 service binding).`,
        [],
        { panel: "journey" },
      );
    }
    case "journey-unknown-refusal": {
      const error = await expectTypedError(() =>
        controller.recordJourneyRun({
          journeyId: "journey-unknown-legacy",
          failAtStep: null,
          runKind: "simulated",
        }),
      );
      return outcome(
        "journey-unknown-refusal",
        `${error.youError.code}: ${error.youError.message} — every run references a registered journey (fail closed).`,
        [],
        { panel: "journey" },
      );
    }
    case "runbook-exercise-recovery": {
      const entry = await controller.exerciseRunbook({
        incidentClassId: "incident-recovery-verification-failure",
        via: "failure-injection",
      });
      const snapshot = await controller.refresh();
      const run = snapshot.journeyRuns.find(
        (candidate) =>
          candidate.kind === "failure-injection" &&
          candidate.incidentClassRef === "recovery-verification-failure",
      );
      if (!run) throw new Error("demo: recovery injection run missing");
      return outcome(
        "runbook-exercise-recovery",
        `Second drill: run ${run.record.id} failed at ${run.record.failedStep} (step ${run.record.stepsCompleted + 1} of 20) and runbook ${entry.record.id} for recovery-verification-failure flips to exercised as a NEW immutable ledger record — the unexercised registration stays in the ledger as history.`,
        [run.record.id, entry.record.id],
        {
          panel: "runbook",
          selectedJourneyRunId: run.record.id,
          selectedRunbookEntryId: entry.record.id,
        },
      );
    }
    case "runbook-claim-refusal": {
      const error = await expectTypedError(() =>
        controller.exerciseRunbook({
          incidentClassId: "incident-consent-revocation-lag",
          via: "exercise-claim",
        }),
      );
      return outcome(
        "runbook-claim-refusal",
        `${error.youError.code}: ${error.youError.message} — consent-revocation-lag stays explicitly marked unexercised (the honest state), never claimed exercised without a journey.`,
        [],
        { panel: "runbook" },
      );
    }
    case "runbook-unknown-refusal": {
      const error = await expectTypedError(() =>
        controller.exerciseRunbook({
          incidentClassId: "incident-unknown-class",
          via: "failure-injection",
        }),
      );
      return outcome(
        "runbook-unknown-refusal",
        `${error.youError.code}: ${error.youError.message} — every runbook entry references a registered incident class (fail closed).`,
        [],
        { panel: "runbook" },
      );
    }
    case "final-state": {
      const snapshot = await controller.refresh();
      const acceptedCount = snapshot.reviews.filter(
        (entry) => entry.kind === "acceptance",
      ).length;
      const exercisedClasses = snapshot.incidentClasses.filter(
        (entry) =>
          snapshot.runbook.some(
            (candidate) =>
              candidate.record.incidentClass === entry.incidentClass &&
              candidate.record.exercised,
          ),
      ).length;
      return outcome(
        "final-state",
        `Final state: ${snapshot.reviews.length} review records (${acceptedCount} acceptance${acceptedCount === 1 ? "" : "s"}), ${snapshot.loadReports.length} load-test report(s) all simulated-labeled, ${snapshot.audits.length} audit(s) with counts verbatim, ${snapshot.journeyRuns.length} journey runs (20-point display), ${snapshot.runbook.length} runbook records with ${exercisedClasses}/${snapshot.incidentClasses.length} incident classes exercised and the rest explicitly marked unexercised; ${snapshot.events.length} events journaled (security-review-recorded / load-test-recorded / conformance-audited / e2e-journey-recorded / runbook-entry-recorded).`,
        [],
        { panel: "runbook" },
      );
    }
  }
}
