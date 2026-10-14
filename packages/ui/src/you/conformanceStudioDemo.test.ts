// W11B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：golden 序列全步通过（22 步）、每个诚实 typed-error 步骤携带其预期 code
//（五个 v11 code 全覆盖）、demo 驱动 plane 状态（3 review 记录含 1 acceptance /
// 1 load 报告 / 2 audit / 3 journey run 含 2 failure-injection / 6 runbook 条目含
// 2 exercise）、每步 uiHint 指向面板、两次独立运行的 summaries 字节一致（golden
// 期望）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedConformanceStudioController } from "./conformanceSimulatedController.js";
import {
  CONFORMANCE_DEMO_STEPS,
  runConformanceDemoStep,
  type ConformanceDemoStepOutcome,
} from "./conformanceStudioDemo.js";
import type { ConformanceStudioController } from "./conformanceController.js";

/** 步骤 id → 预期出现的 typed code（缺省 = 无 typed error 的成功步）。 */
const EXPECTED_TYPED_CODES: Record<string, string[]> = {
  "review-accept-again": ["YOU_SECURITY_REVIEW_INVALID"],
  "review-accept-zero-findings": ["YOU_SECURITY_REVIEW_INVALID"],
  "review-unknown-scope": ["YOU_SECURITY_REVIEW_INVALID"],
  "load-test-measured-refusal": ["YOU_LOAD_TEST_INVALID"],
  "load-test-invented-refusal": ["YOU_LOAD_TEST_INVALID"],
  "load-test-unregistered-refusal": ["YOU_LOAD_TEST_INVALID"],
  "audit-zero-checks-refusal": ["YOU_CONFORMANCE_AUDIT_INVALID"],
  "journey-out-of-range-refusal": ["YOU_E2E_JOURNEY_INVALID"],
  "journey-measured-refusal": ["YOU_E2E_JOURNEY_INVALID"],
  "journey-unknown-refusal": ["YOU_E2E_JOURNEY_INVALID"],
  "runbook-claim-refusal": ["YOU_RUNBOOK_INVALID"],
  "runbook-unknown-refusal": ["YOU_RUNBOOK_INVALID"],
};

async function driveDemo(
  controller: ConformanceStudioController,
): Promise<ConformanceDemoStepOutcome[]> {
  await controller.load({ workspaceKey: "you-w11b-conformance-demo" });
  const outcomes: ConformanceDemoStepOutcome[] = [];
  for (const demoStep of CONFORMANCE_DEMO_STEPS) {
    outcomes.push(await runConformanceDemoStep(controller, demoStep));
  }
  return outcomes;
}

test("the golden demo walks all 22 steps and every honest typed-error step carries its expected code", async () => {
  assert.equal(CONFORMANCE_DEMO_STEPS.length, 22);
  const controller = createSimulatedConformanceStudioController();
  const outcomes = await driveDemo(controller);
  assert.equal(outcomes.length, 22);
  for (const outcome of outcomes) {
    const expected = EXPECTED_TYPED_CODES[outcome.stepId] ?? [];
    for (const code of expected) {
      assert.ok(
        outcome.summary.includes(code),
        `step ${outcome.stepId} should mention ${code}: ${outcome.summary}`,
      );
    }
    // 五个 v11 code 全覆盖出现在 golden 序列里。
    assert.ok(
      outcome.summary.length > 0,
      `step ${outcome.stepId} produced an empty summary`,
    );
  }
  // 全部五个 v11 code 都被诚实演练。
  const allCodes = new Set(
    Object.values(EXPECTED_TYPED_CODES).flatMap((codes) => codes),
  );
  const seenCodes = new Set(
    outcomes
      .map((outcome) => outcome.summary.match(/YOU_[A-Z0-9_]+/g) ?? [])
      .flat(),
  );
  for (const code of allCodes) {
    assert.ok(seenCodes.has(code), `code ${code} never exercised by the demo`);
  }
});

test("every step outcome carries a uiHint panel so the demo walks the five surfaces", async () => {
  const controller = createSimulatedConformanceStudioController();
  const outcomes = await driveDemo(controller);
  const panels = new Set<string>();
  for (const outcome of outcomes) {
    assert.ok(outcome.uiHint.panel, `step ${outcome.stepId} lacks a panel hint`);
    panels.add(outcome.uiHint.panel!);
  }
  // load 从 review 起，终态回到 runbook；五个面板 + demo 均被访问（demo 面板
  // 由 store 驱动，不在 uiHint 内——五个业务面板必须全部出现）。
  for (const panel of ["review", "load", "conformance", "journey", "runbook"]) {
    assert.ok(panels.has(panel), `panel ${panel} never visited by the demo`);
  }
});

test("the demo drives the conformance plane to the expected final state", async () => {
  const controller = createSimulatedConformanceStudioController();
  const outcomes = await driveDemo(controller);
  assert.equal(outcomes.length, 22);
  const snapshot = await controller.refresh();

  // review 账本：3 条记录（2 review + 1 acceptance）。
  assert.equal(snapshot.reviews.length, 3);
  const acceptances = snapshot.reviews.filter(
    (entry) => entry.kind === "acceptance",
  );
  assert.equal(acceptances.length, 1);
  assert.equal(acceptances[0]!.record.findingsCount, 1);
  assert.ok(acceptances[0]!.supersedesReviewId !== null);

  // load 报告：1 份（simulated-labeled）。
  assert.equal(snapshot.loadReports.length, 1);
  assert.equal(snapshot.loadReports[0]!.simulated, true);
  assert.equal(snapshot.loadReports[0]!.regressions.length, 2);

  // audit：2 次（27/30 + 12/12——counts verbatim）。
  assert.equal(snapshot.audits.length, 2);
  assert.deepEqual(
    snapshot.audits.map((audit) => [audit.checksPassed, audit.checksTotal]),
    [
      [27, 30],
      [12, 12],
    ],
  );

  // journey run：3 条（1 golden 全过 + 2 failure-injection）。
  assert.equal(snapshot.journeyRuns.length, 3);
  const golden = snapshot.journeyRuns.filter((run) => run.kind === "golden");
  assert.equal(golden.length, 1);
  assert.equal(golden[0]!.record.stepsCompleted, 20);
  const injections = snapshot.journeyRuns.filter(
    (run) => run.kind === "failure-injection",
  );
  assert.equal(injections.length, 2);
  assert.deepEqual(
    injections.map((run) => run.record.failedStep),
    ["render-submit", "injected-failure-recovery"],
  );

  // runbook：4 registration + 2 exercise；2 个 class exercised、2 个显式
  // unexercised（RUNBOOK LAW 的诚实分布）。
  assert.equal(snapshot.runbook.length, 6);
  const exercisedClasses = new Set(
    snapshot.runbook
      .filter((entry) => entry.record.exercised)
      .map((entry) => entry.record.incidentClass),
  );
  assert.equal(exercisedClasses.size, 2);
  assert.ok(exercisedClasses.has("render-provider-outage"));
  assert.ok(exercisedClasses.has("recovery-verification-failure"));
  const unexercised = snapshot.runbook.filter(
    (entry) => !entry.record.exercised,
  );
  assert.equal(unexercised.length, 4);
  assert.deepEqual(
    new Set(unexercised.map((entry) => entry.record.incidentClass)),
    new Set([
      "import-quarantine-backlog",
      "consent-revocation-lag",
      "render-provider-outage",
      "recovery-verification-failure",
    ]),
  );

  // 事件账本：solution-created + 4 runbook registration + review×3 +
  // load×1 + audit×2 + journey×3 + runbook exercise×2 = 16。
  assert.equal(snapshot.events.length, 16);
  const eventTypes = snapshot.events.map((event) => event.type);
  assert.equal(
    eventTypes.filter((type) => type === "security-review-recorded").length,
    3,
  );
  assert.equal(
    eventTypes.filter((type) => type === "load-test-recorded").length,
    1,
  );
  assert.equal(
    eventTypes.filter((type) => type === "conformance-audited").length,
    2,
  );
  assert.equal(
    eventTypes.filter((type) => type === "e2e-journey-recorded").length,
    3,
  );
  assert.equal(
    eventTypes.filter((type) => type === "runbook-entry-recorded").length,
    6,
  );
});

test("two independent demo runs produce byte-identical summaries (golden expectation)", async () => {
  const first = await driveDemo(createSimulatedConformanceStudioController());
  const second = await driveDemo(createSimulatedConformanceStudioController());
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
