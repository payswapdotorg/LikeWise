// W3B logic tests — Twin 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：全步骤重放的确定性（两个 fresh 控制器跑同一剧本 → 字节一致的 outcome 序列）、
// 每步 uiHint 的面板路由（面板切换 = 可验收的视图状态转移）、诚实错误步骤
//（consent-gate / reconstruction-unsupported / consent-withdraw 以 code 前缀呈现）、
// 结束态语义（finished、步骤计数、outcome 摘要含关键 id）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedTwinStudioController } from "./twinSimulatedController.js";
import {
  runTwinDemoStep,
  TWIN_DEMO_STEPS,
  TWIN_DEMO_TOTAL_STEPS,
  type TwinDemoStepOutcome,
} from "./twinStudioDemo.js";

async function runFullDemo(): Promise<TwinDemoStepOutcome[]> {
  const controller = createSimulatedTwinStudioController();
  const outcomes: TwinDemoStepOutcome[] = [];
  for (const step of TWIN_DEMO_STEPS) {
    outcomes.push(await runTwinDemoStep(controller, step));
  }
  return outcomes;
}

test("the demo covers the full W3B loop and records every step", async () => {
  assert.equal(TWIN_DEMO_TOTAL_STEPS, 15);
  const outcomes = await runFullDemo();
  assert.equal(outcomes.length, TWIN_DEMO_TOTAL_STEPS);
  // 每步都有非空摘要与 uiHint（面板路由可验收）。
  for (const outcome of outcomes) {
    assert.ok(outcome.summary.length > 0);
    assert.ok(outcome.uiHint.panel);
  }
});

test("scripted flow: publish -> assess -> promote -> remediate -> consent -> reconstruct -> publish -> promote -> compare", async () => {
  const controller = createSimulatedTwinStudioController();
  // version-publish：加载 + v1 候选（证据自由：provenance-missing 诚实在场）。
  const publish = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[0]!);
  assert.equal(publish.stepId, "version-publish");
  assert.ok(publish.summary.includes("provenance-missing"));
  assert.ok(publish.uiHint.panel === "versions");
  assert.ok(publish.summary.includes("content-addressed"));

  // quality-assess：确定性缺陷投影。
  const assess = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[1]!);
  assert.ok(assess.summary.includes("Deficiencies: 3"));
  assert.ok(assess.uiHint.panel === "quality");

  // promote-first：接受 v1 → canonical（尚无前任可取代）。
  const promoteFirst = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[2]!);
  assert.ok(promoteFirst.summary.includes("canonical"));
  assert.ok(promoteFirst.summary.includes("no previous canonical"));

  // remediation-open：定向 EvidenceRequest（W2 字段平实可见 + 链入 capture）。
  const remediation = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[3]!);
  assert.ok(remediation.summary.includes("geometric-error:geometry-skeleton"));
  assert.ok(remediation.uiHint.panel === "remediation");

  // consent-gate：预期 typed error 诚实呈现（无许可 ⇒ 不处理）。
  const gate = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[4]!);
  assert.ok(gate.summary.startsWith("YOU_CONSENT_REQUIRED"));
  assert.ok(gate.summary.includes("no permission means no processing"));

  // consent-grant：按用途显式授予。
  const grant = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[5]!);
  assert.ok(grant.summary.includes("solution-generation, quality-improvement"));

  // 重建三步：提交（typed spec）→ 运行 → 完成（not-measured 诚实标记）。
  const submit = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[6]!);
  assert.ok(submit.summary.includes("method hybrid"));
  const run = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[7]!);
  assert.ok(run.summary.includes("running"));
  const complete = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[8]!);
  assert.ok(complete.summary.includes("not-measured"));

  // version-from-job：v2 候选（证据绑定 + 作业谱系）。
  const fromJob = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[9]!);
  assert.ok(fromJob.summary.includes("evidence bindings"));

  // promote：v2 → canonical；v1（前任 canonical）→ superseded（append-only 链接）。
  const promote = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[10]!);
  assert.ok(promote.summary.includes("canonical"));
  assert.ok(promote.summary.includes("superseded"));

  // compare：v1 vs v2（分数/缺陷/溯源 delta）。
  const compare = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[11]!);
  assert.ok(compare.uiHint.panel === "compare");
  assert.equal(compare.uiHint.compareMode, "delta");

  // 不支持组合的诚实错误。
  const unsupported = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[12]!);
  assert.ok(unsupported.summary.startsWith("YOU_RECONSTRUCTION_UNSUPPORTED"));
  assert.ok(unsupported.summary.includes("no silent fallback"));

  // 撤回阻断未来处理；已派生版本保留溯源。
  const withdraw = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[13]!);
  assert.ok(withdraw.summary.includes("YOU_CONSENT_REQUIRED"));
  assert.ok(withdraw.summary.includes("keep their provenance"));

  // 确定性重投影（已发布版本不变）。
  const reassess = await runTwinDemoStep(controller, TWIN_DEMO_STEPS[14]!);
  assert.ok(reassess.summary.includes("never changes"));
});

test("demo replay is byte-identical across fresh controllers (golden determinism)", async () => {
  const [first, second] = await Promise.all([runFullDemo(), runFullDemo()]);
  assert.deepEqual(first, second);
  // 关键步骤的 refs 稳定（可作 golden 断言）。
  assert.equal(first[0]!.refs.length, 1);
  assert.ok(first[0]!.refs[0]!.startsWith("fx-twver-"));
  // 诚实错误步骤的摘要以 code 开头（truth law）。
  assert.ok(first[4]!.summary.startsWith("YOU_CONSENT_REQUIRED"));
  assert.ok(first[12]!.summary.startsWith("YOU_RECONSTRUCTION_UNSUPPORTED"));
});

test("the demo leaves the twin plane in the expected end state", async () => {
  const controller = createSimulatedTwinStudioController();
  for (const step of TWIN_DEMO_STEPS) {
    await runTwinDemoStep(controller, step);
  }
  const snapshot = await controller.refresh();
  // 两版：v1 superseded、v2 canonical（append-only 链接在场——完整状态阶梯
  // candidate → canonical → superseded 已走完）。
  assert.equal(snapshot.versions.length, 2);
  assert.ok(snapshot.canonicalVersionId);
  assert.equal(Object.keys(snapshot.supersededBy).length, 1);
  assert.equal(
    snapshot.versions.find((version) => version.id === snapshot.canonicalVersionId)!.version,
    2,
  );
  assert.equal(
    snapshot.versions.find((version) => version.id !== snapshot.canonicalVersionId)!.status,
    "superseded",
  );
  // 一个补救请求 + 一个重建作业（hybrid 成功；unsupported 被拒不入列）。
  assert.equal(snapshot.evidenceRequests.length, 1);
  assert.equal(snapshot.jobs.length, 1);
  assert.equal(snapshot.jobs[0]!.status, "completed");
  // 撤回后同意门阻断（可见 + 服务端强制）。
  const purposes = snapshot.consent.purposeStates;
  assert.ok(purposes.every((entry) => entry.state === "withdrawn"));
  // 事件账本只用 frozen 词汇（wave-1/3 联合集合内）。
  const allowed = new Set([
    "solution-created",
    "evidence-requested",
    "consent-recorded",
    "consent-withdrawn",
    "twin-version-published",
    "twin-quality-assessed",
    "reconstruction-job-submitted",
    "reconstruction-job-completed",
  ]);
  assert.ok(snapshot.events.every((event) => allowed.has(event.type)));
});
