// W12B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：golden 演示全步骤（13 步）+ 每个诚实 typed-error 步骤携带预期 code、
// 每步 uiHint 走遍三个表面、终态断言（checklist / signoff / declaration 计数与
// 链接）、两次独立运行的字节一致性（golden 期望）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  runReleaseDemoStep,
  RELEASE_DEMO_STEPS,
  RELEASE_DEMO_TOTAL_STEPS,
} from "./releaseStudioDemo.js";
import { createSimulatedReleaseStudioController } from "./releaseSimulatedController.js";
import { releaseChecklistGatePasses } from "./releaseController.js";

interface StepExpectation {
  readonly id: string;
  readonly typedError: string | null;
}

const EXPECTED_STEPS: readonly StepExpectation[] = [
  { id: "load", typedError: null },
  { id: "checklist-partial", typedError: null },
  { id: "signoff-incomplete-checklist-refusal", typedError: "YOU_OPERATOR_SIGNOFF_INVALID" },
  { id: "declaration-before-signoff-refusal", typedError: "YOU_RELEASE_DECLARATION_INVALID" },
  { id: "checklist-golden", typedError: null },
  { id: "signoff-land", typedError: null },
  { id: "signoff-unknown-operator-refusal", typedError: "YOU_OPERATOR_SIGNOFF_INVALID" },
  { id: "signoff-duplicate-refusal", typedError: "YOU_OPERATOR_SIGNOFF_INVALID" },
  { id: "declaration-empty-bundle-refusal", typedError: "YOU_RELEASE_DECLARATION_INVALID" },
  { id: "declaration-missing-rollback-refusal", typedError: "YOU_RELEASE_DECLARATION_INVALID" },
  { id: "declaration-land", typedError: null },
  { id: "declaration-duplicate-refusal", typedError: "YOU_RELEASE_DECLARATION_INVALID" },
  { id: "final-state", typedError: null },
];

async function runGoldenDemo() {
  const controller = createSimulatedReleaseStudioController();
  const outcomes = [];
  for (const demoStep of RELEASE_DEMO_STEPS) {
    outcomes.push(await runReleaseDemoStep(controller, demoStep));
  }
  return { controller, outcomes };
}

test("the golden demo walks all 13 steps and every honest typed-error step carries its expected code", async () => {
  assert.equal(RELEASE_DEMO_TOTAL_STEPS, 13);
  const { outcomes } = await runGoldenDemo();
  assert.equal(outcomes.length, 13);
  for (let index = 0; index < EXPECTED_STEPS.length; index += 1) {
    const expected = EXPECTED_STEPS[index]!;
    const outcome = outcomes[index]!;
    assert.equal(outcome.stepId, expected.id, `step ${index} id mismatch`);
    if (expected.typedError === null) {
      assert.ok(
        !outcome.summary.includes("YOU_"),
        `step ${expected.id} unexpectedly carries a typed error: ${outcome.summary}`,
      );
    } else {
      assert.ok(
        outcome.summary.includes(expected.typedError),
        `step ${expected.id} missing typed error ${expected.typedError}`,
      );
    }
  }
});

test("every step outcome carries a uiHint panel so the demo walks the three surfaces", async () => {
  const { outcomes } = await runGoldenDemo();
  for (const outcome of outcomes) {
    assert.ok(outcome.uiHint.panel, `step ${outcome.stepId} lacks a panel hint`);
  }
  const panels = new Set(outcomes.map((outcome) => outcome.uiHint.panel));
  assert.deepEqual([...panels].sort(), ["checklist", "declaration", "signoff"]);
});

test("the demo drives the release plane to the expected final state", async () => {
  const { controller, outcomes } = await runGoldenDemo();
  const snapshot = await controller.refresh();
  // 两份 checklist（16/20 诚实 incomplete + 20/20 golden）。
  assert.equal(snapshot.checklists.length, 2);
  const golden = snapshot.checklists.filter((checklist) =>
    releaseChecklistGatePasses(checklist),
  );
  assert.equal(golden.length, 1);
  assert.equal(golden[0]!.points.filter((p) => p.passed).length, 20);
  // 唯一 signoff（引用 golden checklist）+ 唯一 declaration（bundle + rollback）。
  assert.equal(snapshot.signoffs.length, 1);
  assert.equal(snapshot.signoffs[0]!.checklistRef, golden[0]!.id);
  assert.equal(snapshot.declarations.length, 1);
  assert.equal(
    snapshot.declarations[0]!.signoffRef,
    snapshot.signoffs[0]!.id,
  );
  // bundle / rollback 引用是内容寻址标签（从注册面解析，绝不硬编码哈希）。
  const goldenBundle = snapshot.evidenceBundles.find(
    (entry) => entry.id === "bundle-golden-journey-set",
  );
  assert.ok(goldenBundle);
  const drRollback = snapshot.rollbackEvidence.find(
    (entry) => entry.id === "rollback-dr-verified",
  );
  assert.ok(drRollback);
  assert.equal(
    snapshot.declarations[0]!.evidenceBundleRef,
    goldenBundle.bundleRef,
  );
  assert.equal(
    snapshot.declarations[0]!.rollbackEvidenceRef,
    drRollback.rollbackRef,
  );
  // 事件账本：solution-created + 2×launch-gate-checked + 1×operator-signoff-recorded
  // + 1×release-declared = 5。
  assert.equal(snapshot.events.length, 5);
  const eventTypes = snapshot.events.map((event) => event.type);
  assert.deepEqual(eventTypes, [
    "solution-created",
    "launch-gate-checked",
    "launch-gate-checked",
    "operator-signoff-recorded",
    "release-declared",
  ]);

  // 关键步骤的 refs 落账（checklist / signoff / declaration）。
  const goldenOutcome = outcomes[4]!;
  assert.deepEqual(goldenOutcome.refs, [golden[0]!.id]);
  const signoffOutcome = outcomes[5]!;
  assert.deepEqual(signoffOutcome.refs, [snapshot.signoffs[0]!.id]);
  const declarationOutcome = outcomes[10]!;
  assert.deepEqual(declarationOutcome.refs, [snapshot.declarations[0]!.id]);
});

test("two independent demo runs produce byte-identical summaries (golden expectation)", async () => {
  const first = await runGoldenDemo();
  const second = await runGoldenDemo();
  assert.deepEqual(
    first.outcomes.map((outcome) => outcome.summary),
    second.outcomes.map((outcome) => outcome.summary),
  );
  assert.deepEqual(
    first.outcomes.map((outcome) => outcome.refs),
    second.outcomes.map((outcome) => outcome.refs),
  );
  // 每次运行的 summary 都非空；除 load 步（其 ref 是 studioId）外，关键记录 id
  // 均为 fx-r-* 前缀（checklist / signoff / declaration）。
  for (const outcome of first.outcomes) {
    assert.ok(outcome.summary.length > 0);
  }
  const withRefs = first.outcomes.filter(
    (outcome) => outcome.refs.length > 0 && outcome.stepId !== "load",
  );
  for (const outcome of withRefs) {
    assert.ok(outcome.refs.every((ref) => ref.startsWith("fx-r-")));
  }
  // load 步的唯一 ref 是 studioId（确定性平面身份）。
  const loadOutcome = first.outcomes[0]!;
  assert.equal(loadOutcome.stepId, "load");
  assert.deepEqual(loadOutcome.refs, ["fx-release-studio-001"]);
});
