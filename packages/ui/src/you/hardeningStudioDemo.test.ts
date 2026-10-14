// W10B logic tests — 确定性 operator demo 驱动器（node:test，无 DOM）。
//
// 覆盖：golden 序列全步通过（24 步）、每个诚实 typed-error 步骤携带其预期 code
//（六个 v10 code 全覆盖）、demo 驱动 plane 状态（3 enforcement / 3 verdict +
// 1 release / 2 retention / 2 restore / 3 eligibility 含 1 reversal）、每步 uiHint
// 指向面板、两次独立运行的 summaries 字节一致（golden 期望）。
import assert from "node:assert/strict";
import test from "node:test";
import { createSimulatedHardeningStudioController } from "./hardeningSimulatedController.js";
import {
  HARDENING_DEMO_STEPS,
  runHardeningDemoStep,
  type HardeningDemoStepOutcome,
} from "./hardeningStudioDemo.js";
import type { HardeningStudioController } from "./hardeningController.js";

/** 步骤 id → 预期出现的 typed code（缺省 = 无 typed error 的成功步）。 */
const EXPECTED_TYPED_CODES: Record<string, string[]> = {
  "limit-deny-exceeded": ["YOU_RATE_LIMIT_EXCEEDED"],
  "limit-defer-exceeded": ["YOU_RATE_LIMIT_EXCEEDED"],
  "limit-shed-exceeded": ["YOU_RATE_LIMIT_EXCEEDED"],
  "import-unscanned-refusal": ["YOU_IMPORT_QUARANTINED"],
  "import-release-not-quarantined": ["YOU_IMPORT_QUARANTINED"],
  "import-release-again": ["YOU_IMPORT_QUARANTINED"],
  "retention-consent-protected": ["YOU_RETENTION_ENFORCEMENT_INVALID"],
  "dr-corrupted": ["YOU_DR_RESTORE_INVALID"],
  "eligibility-matrix-unknown": ["YOU_PROVIDER_MATRIX_INVALID"],
  "eligibility-no-rollback": ["YOU_PRODUCTION_ELIGIBILITY_INVALID"],
  "eligibility-reverse-again": ["YOU_PRODUCTION_ELIGIBILITY_INVALID"],
  "not-found-refusals": ["YOU_IMPORT_QUARANTINED", "YOU_RETENTION_ENFORCEMENT_INVALID"],
};

async function driveDemo(
  controller: HardeningStudioController,
): Promise<HardeningDemoStepOutcome[]> {
  await controller.load({ workspaceKey: "you-w10b-hardening-demo" });
  const outcomes: HardeningDemoStepOutcome[] = [];
  for (const demoStep of HARDENING_DEMO_STEPS) {
    outcomes.push(await runHardeningDemoStep(controller, demoStep));
  }
  return outcomes;
}

test("the golden demo walks all 24 steps and every honest typed-error step carries its expected code", async () => {
  assert.equal(HARDENING_DEMO_STEPS.length, 24);
  const controller = createSimulatedHardeningStudioController();
  const outcomes = await driveDemo(controller);
  assert.equal(outcomes.length, 24);
  for (const outcome of outcomes) {
    const expected = EXPECTED_TYPED_CODES[outcome.stepId] ?? [];
    for (const code of expected) {
      assert.ok(
        outcome.summary.includes(code),
        `${outcome.stepId} summary must carry ${code}: ${outcome.summary}`,
      );
    }
    if (expected.length === 0) {
      assert.ok(
        !outcome.summary.includes("YOU_"),
        `${outcome.stepId} is a success step but the summary carries a typed code`,
      );
    }
  }
  // 六个 v10 code 全覆盖（验收：typed error panels 的全部 code 有诚实路径）。
  const allSummaries = outcomes.map((outcome) => outcome.summary).join("\n");
  for (const code of [
    "YOU_RATE_LIMIT_EXCEEDED",
    "YOU_IMPORT_QUARANTINED",
    "YOU_RETENTION_ENFORCEMENT_INVALID",
    "YOU_DR_RESTORE_INVALID",
    "YOU_PROVIDER_MATRIX_INVALID",
    "YOU_PRODUCTION_ELIGIBILITY_INVALID",
  ]) {
    assert.ok(allSummaries.includes(code), `missing coverage for ${code}`);
  }
});

test("the demo drives the full plane state: enforcements, verdicts + release, retention, restores, eligibility + reversal", async () => {
  const controller = createSimulatedHardeningStudioController();
  const outcomes = await driveDemo(controller);
  const snapshot = await controller.refresh();
  // 3 enforcement（deny/defer/shed 各一）。
  assert.equal(snapshot.enforcements.length, 3);
  assert.deepEqual(
    snapshot.enforcements.map((entry) => entry.action),
    ["deny", "defer", "shed"],
  );
  // 3 verdict（clean/quarantined/rejected）+ 1 release（quarantined 恰好放行一次）。
  assert.equal(snapshot.importVerdictRecords.length, 3);
  const quarantinedRow = snapshot.importVerdictRecords.find(
    (entry) => entry.verdict.verdict === "quarantined",
  )!;
  assert.ok(quarantinedRow.releaseRecordId !== null);
  assert.equal(snapshot.importReleases.length, 1);
  // 2 retention（withdrawn + expired；granted 被拒——不落账）。
  assert.equal(snapshot.retentionRecords.length, 2);
  // 2 DR restore（corrupted 不落账）。
  assert.equal(snapshot.drRestores.length, 2);
  assert.ok(snapshot.drRestores.every((entry) => entry.verification === "verified"));
  // 3 eligibility（blocked + eligible + reversal；原 eligible 被顶替）。
  assert.equal(snapshot.eligibilityLedger.length, 3);
  const reversals = snapshot.eligibilityLedger.filter(
    (entry) => entry.kind === "reversal",
  );
  assert.equal(reversals.length, 1);
  assert.equal(reversals[0]!.supersedesRecordId !== null, true);
  // 事件账本：bootstrap + 3 rate-limit-enforced + 1 import-quarantined +
  // 2 retention-enforced + 2 dr-restore-recorded + 3 production-eligibility-decided。
  const byType = new Map<string, number>();
  for (const event of snapshot.events) {
    byType.set(event.type, (byType.get(event.type) ?? 0) + 1);
  }
  assert.equal(byType.get("rate-limit-enforced"), 3);
  assert.equal(byType.get("import-quarantined"), 1);
  assert.equal(byType.get("retention-enforced"), 2);
  assert.equal(byType.get("dr-restore-recorded"), 2);
  assert.equal(byType.get("production-eligibility-decided"), 3);
  // 每个成功步都产生了 refs（记录 id 可寻址）。
  assert.ok(outcomes.every((outcome) => Array.isArray(outcome.refs)));
});

test("every step routes the UI hint to a panel and golden summaries are byte-identical across runs", async () => {
  const first = await driveDemo(createSimulatedHardeningStudioController());
  const second = await driveDemo(createSimulatedHardeningStudioController());
  // golden：两次运行的 summary 逐字节一致。
  assert.deepEqual(
    first.map((outcome) => outcome.summary),
    second.map((outcome) => outcome.summary),
  );
  // 每步都带面板路由提示。
  for (const outcome of first) {
    assert.ok(outcome.uiHint.panel, `${outcome.stepId} must route to a panel`);
  }
  // 关键路由抽查：load → limits；import 步 → imports；release 步 → release。
  assert.equal(first[0]!.uiHint.panel, "limits");
  assert.equal(first[4]!.uiHint.panel, "imports");
  assert.equal(first[14]!.uiHint.panel, "dr");
  assert.equal(first[17]!.uiHint.panel, "release");
  assert.equal(first[23]!.uiHint.panel, "imports");
});
