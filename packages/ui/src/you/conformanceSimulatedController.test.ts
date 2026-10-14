// W11B logic tests — 确定性模拟控制器（node:test，无 DOM）。
//
// 覆盖 W11A/W11C 法则的 UI 侧镜像（W11B 验收核心）：
// - SECURITY REVIEW LAW：findings verbatim 落账；acceptance 是引用 finding set
//   的独立不可变新记录（supersedes 链接）；acceptance without findings / 重复
//   接受 / acceptance 记录本身 / 未知 scope ⇒ typed YOU_SECURITY_REVIEW_INVALID；
// - LOAD TEST LAW：simulated 报告 simulated-labeled + regressions verbatim；
//   invented ⇒ typed 拒绝；measured 在 fixture 支撑面 ⇒ typed 拒绝（绝不伪造）；
//   未注册 scenario ⇒ typed 拒绝；
// - CONFORMANCE LAW：两 counts verbatim 落账（full / partial）；零检查 standard
//   ⇒ typed YOU_CONFORMANCE_AUDIT_INVALID（bare pass 绝不落账）；
// - JOURNEY LAW：完整 20 点 run + 失败于真实步骤 + duration；越界 / 未注册 /
//   measured ⇒ typed YOU_E2E_JOURNEY_INVALID；
// - RUNBOOK LAW：bootstrap 全量 unexercised registration；failure-injection
//   演练 append exercised 新记录 + journey run；exercise-claim / 未注册 class ⇒
//   typed YOU_RUNBOOK_INVALID；
// - 事件词汇只使用 frozen v11 类型；字节级确定性（双控制器同剧本 ⇒ 同快照）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedConformanceStudioController } from "./conformanceSimulatedController.js";
import { ConformanceStudioError } from "./conformanceController.js";
import {
  CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
} from "./conformanceStoryboard.js";

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
  throw new Error("expected a typed ConformanceStudioError");
}

test("load is idempotent and bootstraps the runbook with explicitly-unexercised registrations", async () => {
  const controller = createSimulatedConformanceStudioController();
  const first = await controller.load({ workspaceKey: "ws-a" });
  const second = await controller.load({ workspaceKey: "ws-a" });
  assert.equal(second.studioId, first.studioId);
  assert.equal(controller.backing, "fixture-simulated");
  assert.equal(first.simulated, true);
  assert.deepEqual(first.metricsSources, ["measured", "simulated", "invented"]);
  assert.deepEqual(first.auditOutcomes, ["full", "partial"]);
  assert.deepEqual(first.runKinds, ["measured", "simulated"]);
  assert.equal(first.reviewScopes.length, 3);
  assert.equal(first.loadScenarios.length, 3);
  assert.equal(first.standards.length, 3);
  assert.equal(first.journeys.length, 2);
  assert.equal(first.incidentClasses.length, 4);
  // RUNBOOK LAW 显示面：bootstrap 落 4 条 unexercised registration 记录。
  assert.equal(first.runbook.length, 4);
  assert.ok(first.runbook.every((entry) => entry.kind === "registration"));
  assert.ok(first.runbook.every((entry) => entry.record.exercised === false));
  assert.ok(
    first.runbook.every((entry) => entry.record.simulated === true),
  );
  // solution-created + 4 条 runbook-entry-recorded。
  assert.equal(first.events.length, 5);
  assert.equal(first.events[0]!.type, "solution-created");
  assert.ok(
    first.events
      .slice(1)
      .every((event) => event.type === "runbook-entry-recorded"),
  );
  // 事件溯源标记 fixture（bootstrap 记录由剧本生成）。
  assert.ok(first.events.slice(1).every((event) => event.provenance.generator === "fixture"));
});

test("SECURITY REVIEW LAW: findings verbatim; acceptance is a new immutable record with a supersedes link", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const review = await controller.recordSecurityReview({
    scopeId: "review-scope-render-pipeline",
  });
  assert.equal(review.record.findingsCount, 1);
  assert.equal(review.record.accepted, false);
  assert.equal(review.kind, "review");
  assert.equal(review.supersedesReviewId, null);
  assert.equal(review.record.simulated, true);

  const acceptance = await controller.acceptSecurityReview({
    reviewId: review.record.id,
  });
  assert.equal(acceptance.kind, "acceptance");
  assert.equal(acceptance.record.accepted, true);
  assert.equal(acceptance.record.findingsCount, review.record.findingsCount);
  assert.equal(acceptance.record.scopeRef, review.record.scopeRef);
  assert.equal(acceptance.supersedesReviewId, review.record.id);
  // 两条独立记录（id 不同）——acceptance 绝不改写原 review。
  assert.notEqual(acceptance.record.id, review.record.id);
  // 事件词汇：security-review-recorded ×2。
  const snapshot = await controller.refresh();
  const reviewEvents = snapshot.events.filter(
    (event) => event.type === "security-review-recorded",
  );
  assert.equal(reviewEvents.length, 2);
  assert.equal(reviewEvents[0]!.payload.findingsCount, 1);
  assert.equal(reviewEvents[0]!.payload.kind, "review");
  assert.equal(reviewEvents[1]!.payload.kind, "acceptance");
  assert.equal(reviewEvents[1]!.payload.supersedes, review.record.id);
});

test("SECURITY REVIEW LAW refusal paths: already-accepted, acceptance-without-findings, acceptance-not-acceptable, unknown scope", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const review = await controller.recordSecurityReview({
    scopeId: "review-scope-evidence-plane",
  });
  await controller.acceptSecurityReview({ reviewId: review.record.id });

  const alreadyAccepted = await expectTypedError(() =>
    controller.acceptSecurityReview({ reviewId: review.record.id }),
  );
  assert.equal(alreadyAccepted.youError.code, "YOU_SECURITY_REVIEW_INVALID");
  assert.equal(alreadyAccepted.youError.details.reason, "already-accepted");

  const zeroFindings = await controller.recordSecurityReview({
    scopeId: "review-scope-zero-findings",
  });
  assert.equal(zeroFindings.record.findingsCount, 0);
  const acceptanceWithoutFindings = await expectTypedError(() =>
    controller.acceptSecurityReview({ reviewId: zeroFindings.record.id }),
  );
  assert.equal(acceptanceWithoutFindings.youError.code, "YOU_SECURITY_REVIEW_INVALID");
  assert.equal(
    acceptanceWithoutFindings.youError.details.reason,
    "acceptance-without-findings",
  );

  const unknownScope = await expectTypedError(() =>
    controller.recordSecurityReview({ scopeId: "review-scope-missing" }),
  );
  assert.equal(unknownScope.youError.code, "YOU_SECURITY_REVIEW_INVALID");
  assert.equal(unknownScope.youError.details.reason, "unknown-scope");

  const unknownReview = await expectTypedError(() =>
    controller.acceptSecurityReview({ reviewId: "fx-c-review-999" }),
  );
  assert.equal(unknownReview.youError.code, "YOU_SECURITY_REVIEW_INVALID");
  assert.equal(unknownReview.youError.details.reason, "unknown-review");

  // acceptance 记录本身不可再接受。
  const snapshot = await controller.refresh();
  const acceptanceRecord = snapshot.reviews.find(
    (entry) => entry.kind === "acceptance",
  );
  assert.ok(acceptanceRecord);
  const acceptanceNotAcceptable = await expectTypedError(() =>
    controller.acceptSecurityReview({ reviewId: acceptanceRecord.record.id }),
  );
  assert.equal(acceptanceNotAcceptable.youError.code, "YOU_SECURITY_REVIEW_INVALID");
  assert.equal(
    acceptanceNotAcceptable.youError.details.reason,
    "acceptance-not-acceptable",
  );
});

test("LOAD TEST LAW: simulated reports land simulated-labeled with regressions verbatim; the report stays immutable in the ledger", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const report = await controller.runLoadTest({
    scenarioId: "load-scenario-render-peak",
    metricsSource: "simulated",
  });
  assert.equal(report.simulated, true);
  assert.equal(report.peakRps, 240);
  assert.equal(report.p99Ms, 420);
  assert.deepEqual(report.regressions, [
    "export.render p99 +80ms vs baseline",
    "render.queue depth 2.1x baseline",
  ]);
  const snapshot = await controller.refresh();
  assert.equal(snapshot.loadReports.length, 1);
  assert.deepEqual(snapshot.loadReports[0]!.regressions, report.regressions);
  const events = snapshot.events.filter(
    (event) => event.type === "load-test-recorded",
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.payload.peakRps, 240);
  assert.equal(events[0]!.payload.p99Ms, 420);
  assert.equal(events[0]!.payload.regressionCount, 2);

  // 无回归场景 verbatim 空清单。
  const clean = await controller.runLoadTest({
    scenarioId: "load-scenario-import-burst",
    metricsSource: "simulated",
  });
  assert.deepEqual(clean.regressions, []);
});

test("LOAD TEST LAW refusal paths: invented, measured-on-fixture, unknown scenario", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const invented = await expectTypedError(() =>
    controller.runLoadTest({
      scenarioId: "load-scenario-render-peak",
      metricsSource: "invented",
    }),
  );
  assert.equal(invented.youError.code, "YOU_LOAD_TEST_INVALID");
  assert.equal(invented.youError.details.reason, "invented-metrics");
  assert.ok(invented.youError.message.includes("never invented"));

  const measured = await expectTypedError(() =>
    controller.runLoadTest({
      scenarioId: "load-scenario-render-peak",
      metricsSource: "measured",
    }),
  );
  assert.equal(measured.youError.code, "YOU_LOAD_TEST_INVALID");
  assert.equal(measured.youError.details.reason, "fixture-backing-cannot-measure");

  const unknownScenario = await expectTypedError(() =>
    controller.runLoadTest({
      scenarioId: "load-scenario-unregistered",
      metricsSource: "simulated",
    }),
  );
  assert.equal(unknownScenario.youError.code, "YOU_LOAD_TEST_INVALID");
  assert.equal(unknownScenario.youError.details.reason, "unknown-scenario");

  // 拒绝路径绝不落账报告。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.loadReports.length, 0);
});

test("CONFORMANCE LAW: counts verbatim (full and partial); zero-checks standard is a typed refusal", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const partial = await controller.runConformanceAudit({
    standardId: "standard-wcag-aa",
    outcome: "partial",
  });
  assert.equal(partial.checksTotal, 30);
  assert.equal(partial.checksPassed, 27);
  assert.equal(partial.simulated, true);

  const full = await controller.runConformanceAudit({
    standardId: "standard-viewport-320",
    outcome: "full",
  });
  assert.equal(full.checksTotal, 12);
  assert.equal(full.checksPassed, 12);

  const zeroChecks = await expectTypedError(() =>
    controller.runConformanceAudit({
      standardId: "standard-zero-checks",
      outcome: "full",
    }),
  );
  assert.equal(zeroChecks.youError.code, "YOU_CONFORMANCE_AUDIT_INVALID");
  assert.equal(zeroChecks.youError.details.reason, "zero-checks-standard");
  assert.ok(zeroChecks.youError.message.includes("pass without checks"));

  const unknownStandard = await expectTypedError(() =>
    controller.runConformanceAudit({
      standardId: "standard-missing",
      outcome: "partial",
    }),
  );
  assert.equal(unknownStandard.youError.code, "YOU_CONFORMANCE_AUDIT_INVALID");
  assert.equal(unknownStandard.youError.details.reason, "unknown-standard");

  const snapshot = await controller.refresh();
  assert.equal(snapshot.audits.length, 2);
  const events = snapshot.events.filter((event) => event.type === "conformance-audited");
  assert.equal(events.length, 2);
  assert.equal(events[0]!.payload.checksTotal, 30);
  assert.equal(events[0]!.payload.checksPassed, 27);
});

test("JOURNEY LAW: full 20-point run records every step with duration; simulated runs stay labeled", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const run = await controller.recordJourneyRun({
    journeyId: "journey-launch-gate",
    failAtStep: null,
    runKind: "simulated",
  });
  assert.equal(
    run.record.stepsCompleted,
    CONFORMANCE_STORYBOARD_LAUNCH_GATE_TOTAL_STEPS,
  );
  assert.equal(run.record.failedStep, null);
  assert.equal(run.record.simulated, true);
  assert.equal(run.kind, "golden");
  assert.ok(run.record.durationMs > 0);
  // 20 步 × 850ms + 1200 起步开销。
  assert.equal(run.record.durationMs, 1200 + 20 * 850);

  const failed = await controller.recordJourneyRun({
    journeyId: "journey-launch-gate",
    failAtStep: 10,
    runKind: "simulated",
  });
  assert.equal(failed.record.stepsCompleted, 9);
  assert.equal(failed.record.failedStep, "render-submit");
  assert.equal(failed.record.durationMs, 1200 + 9 * 850 + 400);

  const snapshot = await controller.refresh();
  const events = snapshot.events.filter(
    (event) => event.type === "e2e-journey-recorded",
  );
  assert.equal(events.length, 2);
  assert.equal(events[0]!.payload.failureInjection, false);
  assert.equal(events[1]!.payload.failedStep, "render-submit");
});

test("JOURNEY LAW refusal paths: out-of-range step, measured-on-fixture, unknown journey", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const outOfRange = await expectTypedError(() =>
    controller.recordJourneyRun({
      journeyId: "journey-launch-gate",
      failAtStep: 21,
      runKind: "simulated",
    }),
  );
  assert.equal(outOfRange.youError.code, "YOU_E2E_JOURNEY_INVALID");
  assert.equal(outOfRange.youError.details.reason, "fail-step-out-of-range");

  const zeroStep = await expectTypedError(() =>
    controller.recordJourneyRun({
      journeyId: "journey-launch-gate",
      failAtStep: 0,
      runKind: "simulated",
    }),
  );
  assert.equal(zeroStep.youError.code, "YOU_E2E_JOURNEY_INVALID");

  const measured = await expectTypedError(() =>
    controller.recordJourneyRun({
      journeyId: "journey-launch-gate",
      failAtStep: null,
      runKind: "measured",
    }),
  );
  assert.equal(measured.youError.code, "YOU_E2E_JOURNEY_INVALID");
  assert.equal(measured.youError.details.reason, "fixture-backing-cannot-measure");

  const unknownJourney = await expectTypedError(() =>
    controller.recordJourneyRun({
      journeyId: "journey-unknown-legacy",
      failAtStep: null,
      runKind: "simulated",
    }),
  );
  assert.equal(unknownJourney.youError.code, "YOU_E2E_JOURNEY_INVALID");
  assert.equal(unknownJourney.youError.details.reason, "unknown-journey");

  const snapshot = await controller.refresh();
  assert.equal(snapshot.journeyRuns.length, 0);
});

test("RUNBOOK LAW: failure-injection exercises the entry (journey + exercised record); the ledger keeps history", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const exercise = await controller.exerciseRunbook({
    incidentClassId: "incident-render-provider-outage",
    via: "failure-injection",
  });
  assert.equal(exercise.kind, "exercise");
  assert.equal(exercise.record.exercised, true);
  assert.equal(exercise.record.incidentClass, "render-provider-outage");
  assert.equal(
    exercise.record.detection,
    "render job heartbeat loss beyond 2 windows on the primary provider",
  );

  const snapshot = await controller.refresh();
  // 4 条 registration + 1 条 exercise。
  assert.equal(snapshot.runbook.length, 5);
  const chain = snapshot.runbook.filter(
    (entry) => entry.record.incidentClass === "render-provider-outage",
  );
  assert.equal(chain.length, 2);
  assert.equal(chain[0]!.kind, "registration");
  assert.equal(chain[0]!.record.exercised, false);
  assert.equal(chain[1]!.kind, "exercise");
  assert.equal(chain[1]!.record.exercised, true);
  assert.equal(chain[1]!.supersedesEntryId, chain[0]!.record.id);
  // 演练先落一条 failure-injection journey（失败于绑定步 render-submit = 第 10 步）。
  const run = snapshot.journeyRuns[0]!;
  assert.equal(run.kind, "failure-injection");
  assert.equal(run.incidentClassRef, "render-provider-outage");
  assert.equal(run.record.stepsCompleted, 9);
  assert.equal(run.record.failedStep, "render-submit");
  // runbook-entry-recorded 事件：4 bootstrap + 1 exercise。
  const runbookEvents = snapshot.events.filter(
    (event) => event.type === "runbook-entry-recorded",
  );
  assert.equal(runbookEvents.length, 5);
  assert.equal(runbookEvents[4]!.payload.exercised, true);
  assert.equal(runbookEvents[4]!.payload.journeyRunId, run.record.id);
});

test("RUNBOOK LAW refusal paths: exercise-claim-without-journey and unknown incident class", async () => {
  const controller = createSimulatedConformanceStudioController();
  await controller.load({ workspaceKey: "ws-a" });

  const claim = await expectTypedError(() =>
    controller.exerciseRunbook({
      incidentClassId: "incident-consent-revocation-lag",
      via: "exercise-claim",
    }),
  );
  assert.equal(claim.youError.code, "YOU_RUNBOOK_INVALID");
  assert.equal(claim.youError.details.reason, "exercise-claim-without-journey");
  assert.ok(claim.youError.message.includes("explicitly marked unexercised"));

  const unknownClass = await expectTypedError(() =>
    controller.exerciseRunbook({
      incidentClassId: "incident-unknown-class",
      via: "failure-injection",
    }),
  );
  assert.equal(unknownClass.youError.code, "YOU_RUNBOOK_INVALID");
  assert.equal(unknownClass.youError.details.reason, "unknown-incident-class");

  // 拒绝路径不改变 runbook 与 journey 状态。
  const snapshot = await controller.refresh();
  assert.equal(snapshot.runbook.length, 4);
  assert.equal(snapshot.journeyRuns.length, 0);
  // consent-revocation-lag 链保持显式 unexercised。
  const consentChain = snapshot.runbook.filter(
    (entry) => entry.record.incidentClass === "consent-revocation-lag",
  );
  assert.equal(consentChain.length, 1);
  assert.equal(consentChain[0]!.record.exercised, false);
});

test("byte-level determinism: two controllers driven by the same script produce identical snapshots", async () => {
  async function driveScript(): Promise<string> {
    const controller = createSimulatedConformanceStudioController();
    await controller.load({ workspaceKey: "ws-determinism" });
    const review = await controller.recordSecurityReview({
      scopeId: "review-scope-evidence-plane",
    });
    await controller.acceptSecurityReview({ reviewId: review.record.id });
    await controller.runLoadTest({
      scenarioId: "load-scenario-render-peak",
      metricsSource: "simulated",
    });
    await controller.runConformanceAudit({
      standardId: "standard-wcag-aa",
      outcome: "partial",
    });
    await controller.recordJourneyRun({
      journeyId: "journey-launch-gate",
      failAtStep: null,
      runKind: "simulated",
    });
    await controller.exerciseRunbook({
      incidentClassId: "incident-import-quarantine-backlog",
      via: "failure-injection",
    });
    const final = await controller.refresh();
    return JSON.stringify({
      ...final,
      events: final.events.map((event) => ({
        ...event,
        provenance: { ...event.provenance },
      })),
    });
  }

  const first = await driveScript();
  const second = await driveScript();
  assert.equal(first, second);
});

test("operations before load fail closed with a truthful invalid-state error", async () => {
  const controller = createSimulatedConformanceStudioController();
  const error = await expectTypedError(() =>
    controller.recordSecurityReview({ scopeId: "review-scope-evidence-plane" }),
  );
  assert.equal(error.youError.code, "YOU_INVALID_STATE");
  assert.equal(error.youError.details.reason, "conformance-not-loaded");
  const refreshError = await expectTypedError(() => controller.refresh());
  assert.equal(refreshError.youError.details.reason, "conformance-not-loaded");
});
