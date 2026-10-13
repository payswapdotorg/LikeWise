// W9B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：golden 序列全 31 步执行（每步产出确定性 summary + refs + uiHint）、诚实
// typed 错误步骤（code 前缀呈现——六个 v9 code 全覆盖 + generic 终态锁定披露）、
// 终态断言（三实验 / promotion + reversal 账本 / 耗尽终态 / 退役 run / 事件账本）、
// uiHint 的面板路由、以及序列级确定性（两份控制器跑同剧本 → 字节一致 outcomes）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedLabStudioController } from "./labSimulatedController.js";
import {
  LAB_DEMO_STEPS,
  LAB_DEMO_TOTAL_STEPS,
  runLabDemoStep,
  type LabDemoStepOutcome,
} from "./labStudioDemo.js";

/** 诚实错误步骤 → 期望出现的 typed code（truth law：不伪装成功）。 */
const EXPECTED_ERROR_CODES: Readonly<Record<string, readonly string[]>> = {
  "world-invalid": ["YOU_LAB_WORLD_INVALID"],
  "budget-invalid": ["YOU_SEARCH_LADDER_INVALID"],
  "promotion-unverified": ["YOU_LAB_PROMOTION_INVALID"],
  "promotion-baseline-winner": ["YOU_LAB_PROMOTION_INVALID"],
  "promotion-already-decided": ["YOU_LAB_PROMOTION_INVALID"],
  "manifest-mismatch": ["YOU_LAB_EVIDENCE_MANIFEST_INVALID", "YOU_LAB_EVIDENCE_MANIFEST_INVALID"],
  "promotion-losing": ["YOU_LAB_PROMOTION_INVALID"],
  "promotion-tie": ["YOU_LAB_PROMOTION_INVALID"],
  "search-exhaustion": ["YOU_SEARCH_LADDER_INVALID"],
  "not-found-refusals": ["YOU_LAB_RUN_NOT_FOUND", "YOU_LAB_EXPERIMENT_NOT_FOUND"],
  "terminal-refusal": ["YOU_INVALID_STATE"],
};

async function runAllSteps(controller: ReturnType<typeof createSimulatedLabStudioController>) {
  await controller.load({ workspaceKey: "you-w9b-lab-demo-test" });
  const outcomes: LabDemoStepOutcome[] = [];
  for (const demoStep of LAB_DEMO_STEPS) {
    const outcome = await runLabDemoStep(controller, demoStep);
    outcomes.push(outcome);
  }
  return outcomes;
}

test("the golden demo walks all 31 steps and every honest typed-error step carries its expected code", async () => {
  assert.equal(LAB_DEMO_TOTAL_STEPS, 31);
  const controller = createSimulatedLabStudioController();
  const outcomes = await runAllSteps(controller);
  assert.equal(outcomes.length, LAB_DEMO_TOTAL_STEPS);

  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 40, `thin summary at ${outcome.stepId}`);
  }
  for (const [stepId, codes] of Object.entries(EXPECTED_ERROR_CODES)) {
    const outcome = outcomes.find((entry) => entry.stepId === stepId);
    assert.ok(outcome !== undefined, `missing outcome for ${stepId}`);
    for (const code of codes) {
      assert.ok(
        outcome!.summary.includes(code),
        `${stepId} summary must carry ${code}: ${outcome!.summary.slice(0, 120)}`,
      );
    }
  }
  // 六个 v9 验收 code 全部在诚实错误步骤中出现。
  for (const code of [
    "YOU_LAB_RUN_NOT_FOUND",
    "YOU_LAB_EXPERIMENT_NOT_FOUND",
    "YOU_LAB_EVIDENCE_MANIFEST_INVALID",
    "YOU_LAB_PROMOTION_INVALID",
    "YOU_LAB_WORLD_INVALID",
    "YOU_SEARCH_LADDER_INVALID",
  ] as const) {
    assert.ok(
      outcomes.some((outcome) => outcome.summary.includes(code)),
      `no honest step carries ${code}`,
    );
  }
});

test("the demo drives the full plane state: three experiments, promotion + reversal, exhaustion terminal, retired run", async () => {
  const controller = createSimulatedLabStudioController();
  await runAllSteps(controller);
  const snapshot = await controller.refresh();

  // 三实验（胜出 / 落败 / 持平）。
  assert.equal(snapshot.experiments.length, 3);
  // 晋升 + 反转都在实验 1 的账本上（reversal 顶替 promotion）。
  const ledger = snapshot.promotionLedger;
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0]!.kind, "promotion");
  assert.equal(ledger[1]!.kind, "reversal");
  assert.equal(ledger[1]!.supersedesRecordId, ledger[0]!.record.id);
  const winner = snapshot.experiments[0]!;
  assert.equal(winner.promotionRef, ledger[1]!.record.id);
  assert.equal(ledger[0]!.record.objectiveScore, 0.78);
  assert.equal(ledger[0]!.record.baselineScore, 0.62);
  assert.equal(ledger[0]!.record.winnerArm, "searched");

  // 耗尽终态步在实验 3（紧预算）上。
  const exhausted = snapshot.searchLadder.filter(
    (step) => step.strategy === "budget-exhausted",
  );
  assert.equal(exhausted.length, 1);
  const exhaustedContext = snapshot.experimentContexts.find(
    (entry) => entry.experimentId === snapshot.experiments[2]!.id,
  )!;
  assert.equal(exhaustedContext.searchExhausted, true);

  // 退役 run 存在且锁定。
  assert.ok(
    snapshot.runs.some((run) => run.status === "retired"),
    "no retired run on the ladder",
  );
  // hand-designed 失败 + 重试（失败路径的 append-only 语义）。
  assert.ok(snapshot.runs.some((run) => run.status === "failed"));
  assert.ok(
    snapshot.runs.filter((run) => run.status === "failed").length >= 1,
  );

  // manifest：honest 已校验 / tampered mismatch / losing+tie 已校验。
  const manifests = snapshot.manifests;
  assert.equal(manifests.length, 4);
  assert.equal(manifests.filter((entry) => entry.verification === "verified").length, 3);
  assert.equal(manifests.filter((entry) => entry.verification === "mismatch").length, 1);

  // 三臂比较投影：实验 1 beats / 实验 2 loses / 实验 3 ties。
  const verdictOf = (experimentId: string) => {
    const searched = snapshot.armScores.find(
      (entry) => entry.experimentId === experimentId && entry.arm === "searched",
    )!;
    const baseline = snapshot.armScores.find(
      (entry) => entry.experimentId === experimentId && entry.arm === "generalist-baseline",
    )!;
    if (searched.score! > baseline.score!) return "beats";
    if (searched.score! === baseline.score!) return "ties";
    return "loses";
  };
  assert.equal(verdictOf(snapshot.experiments[0]!.id), "beats");
  assert.equal(verdictOf(snapshot.experiments[1]!.id), "loses");
  assert.equal(verdictOf(snapshot.experiments[2]!.id), "ties");

  // 事件账本：lab-* 三类事件齐备（无伪造的 lab-experiment-declared）。
  assert.ok(
    snapshot.events.filter((event) => event.type === "lab-run-recorded").length >= 20,
  );
  assert.equal(
    snapshot.events.filter((event) => event.type === "lab-evidence-published").length,
    4,
  );
  assert.equal(
    snapshot.events.filter((event) => event.type === "lab-promotion-decided").length,
    2,
  );
  assert.equal(
    snapshot.events.filter((event) => (event.type as string) === "lab-experiment-declared")
      .length,
    0,
  );
  // 全程 simulated: true（truth law）。
  assert.equal(snapshot.simulated, true);
  assert.ok(snapshot.runs.every((run) => run.simulated));
  assert.ok(snapshot.manifests.every((entry) => entry.manifest.simulated));
  assert.ok(snapshot.promotionLedger.every((entry) => entry.record.simulated));
});

test("every step routes the UI hint to a panel and golden summaries are byte-identical across runs", async () => {
  const first = await runAllSteps(createSimulatedLabStudioController());
  for (const outcome of first) {
    assert.ok(outcome.uiHint.panel !== undefined, `${outcome.stepId} missing panel hint`);
  }
  // 步骤面板路由覆盖全部四个验收表面 + demo 自身。
  const panels = new Set(first.map((outcome) => outcome.uiHint.panel));
  for (const panel of ["experiments", "runs", "evidence", "promotion"] as const) {
    assert.ok(panels.has(panel), `no step routes to ${panel}`);
  }
  // 序列级确定性：两份控制器跑同剧本 → 字节一致 outcomes（golden 期望）。
  const second = await runAllSteps(createSimulatedLabStudioController());
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  // refs 稳定：关键记录 id 在两轮之间一致（id 计数器确定性）。
  assert.deepEqual(
    first.map((outcome) => outcome.refs.join(",")),
    second.map((outcome) => outcome.refs.join(",")),
  );
  // golden 抽样：晋升步引用实验 1 的 promotion 记录（id 前缀 + reversal 的顶替链接）。
  const decide = first.find((entry) => entry.stepId === "promotion-decide")!;
  assert.equal(decide.refs.length, 1);
  assert.ok(decide.refs[0]!.startsWith("fx-promotion-"));
  const reversal = first.find((entry) => entry.stepId === "promotion-reversal")!;
  assert.equal(reversal.refs.length, 2);
  assert.ok(reversal.refs[0]!.startsWith("fx-promotion-"));
  // reversal 的 refs = [新 reversal 记录 id, 被顶替的 promotion 记录 id]。
  assert.equal(reversal.refs[1], decide.refs[0]);
  assert.notEqual(reversal.refs[0], reversal.refs[1]);
});
