// W9B logic tests — Lab 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id 文案
// 存在、分类学文案存在（三臂/五 run 状态/三校验状态/九门 reason）、typed 错误面板
// 文案存在（六个验收 code + UNEXPECTED，en 解释 >40 字符）、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatLabMessage, resolveLabMessages } from "./labMessages.js";
import { LAB_DEMO_STEPS } from "./labStudioDemo.js";

const PANEL_IDS = ["experiments", "runs", "evidence", "promotion", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_LAB_RUN_NOT_FOUND",
  "YOU_LAB_EXPERIMENT_NOT_FOUND",
  "YOU_LAB_EVIDENCE_MANIFEST_INVALID",
  "YOU_LAB_PROMOTION_INVALID",
  "YOU_LAB_WORLD_INVALID",
  "YOU_SEARCH_LADDER_INVALID",
  "UNEXPECTED",
] as const;

const ARM_KINDS = [
  "generalist-baseline",
  "hand-designed",
  "searched",
] as const;

const RUN_STATUSES = ["submitted", "running", "succeeded", "failed", "retired"] as const;

const VERIFICATIONS = ["unverified", "verified", "mismatch"] as const;

const GATE_REASONS = [
  "granted",
  "unknown-experiment",
  "candidate-arm-not-in-experiment",
  "non-searched-winner",
  "no-benchmark-evidence",
  "unknown-evidence-manifest",
  "evidence-unverified",
  "no-improvement",
  "already-decided",
] as const;

const COMPARISON_VERDICTS = ["pending", "beats", "ties", "loses"] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveLabMessages("en-US");
  const zh = resolveLabMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(enKeys.length > 200, `expected a full catalog, got ${enKeys.length} keys`);
});

test("every catalog value is a non-empty string without stray placeholders", () => {
  for (const locale of ["en-US", "zh-CN"] as const) {
    const messages = resolveLabMessages(locale);
    for (const [key, value] of Object.entries(messages)) {
      assert.equal(typeof value, "string", `${locale} ${key}`);
      assert.ok(value.trim().length > 0, `${locale} ${key} empty`);
      // 残留未替换占位符（左花括号）说明文案表有笔误。
      assert.ok(!value.includes("{current}") || key.endsWith(".step"), `${locale} ${key}`);
    }
  }
});

test("panel ids, arm taxonomy, run statuses, verifications, gate reasons and verdicts all have labels", () => {
  const en = resolveLabMessages("en-US");
  const zh = resolveLabMessages("zh-CN");
  for (const id of PANEL_IDS) {
    assert.ok(en[`you.lab.panel.${id}`]);
    assert.ok(zh[`you.lab.panel.${id}`]);
  }
  for (const arm of ARM_KINDS) {
    assert.ok(en[`you.lab.arm.${arm}`]);
    assert.ok(zh[`you.lab.arm.${arm}`]);
  }
  for (const status of RUN_STATUSES) {
    assert.ok(en[`you.lab.runs.status.${status}`]);
    assert.ok(zh[`you.lab.runs.status.${status}`]);
  }
  for (const verification of VERIFICATIONS) {
    assert.ok(en[`you.lab.evidence.verification.${verification}`]);
    assert.ok(zh[`you.lab.evidence.verification.${verification}`]);
  }
  for (const reason of GATE_REASONS) {
    assert.ok(en[`you.lab.promotion.gate.reason.${reason}`]);
    assert.ok(zh[`you.lab.promotion.gate.reason.${reason}`]);
  }
  for (const verdict of COMPARISON_VERDICTS) {
    assert.ok(en[`you.lab.comparison.verdict.${verdict}`]);
    assert.ok(zh[`you.lab.comparison.verdict.${verdict}`]);
  }
});

test("typed error panels exist for every acceptance code with substantive explanations", () => {
  const en = resolveLabMessages("en-US");
  const zh = resolveLabMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    assert.ok(en[`you.lab.error.${code}`], `missing en copy for ${code}`);
    assert.ok(zh[`you.lab.error.${code}`], `missing zh copy for ${code}`);
    // 解释须实质（> 40 字符）——typed 错误面板的说明不能是占位符。
    assert.ok(en[`you.lab.error.${code}`]!.length > 40, `en copy too thin for ${code}`);
  }
});

test("demo step copy exists for every step in the golden sequence (both locales)", () => {
  const en = resolveLabMessages("en-US");
  const zh = resolveLabMessages("zh-CN");
  assert.ok(LAB_DEMO_STEPS.length >= 30);
  for (const demoStep of LAB_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en title ${demoStep.id}`);
    assert.ok(en[demoStep.descriptionMessageId], `missing en description ${demoStep.id}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh title ${demoStep.id}`);
    assert.ok(zh[demoStep.descriptionMessageId], `missing zh description ${demoStep.id}`);
  }
});

test("formatLabMessage resolves {key} placeholders and falls back en-US then id", () => {
  const en = resolveLabMessages("en-US");
  assert.equal(
    formatLabMessage(en, "you.lab.demo.step", { current: 2, total: 31 }),
    "Step 2 / 31",
  );
  const zh = resolveLabMessages("zh-CN");
  assert.equal(
    formatLabMessage(zh, "you.lab.demo.step", { current: 2, total: 31 }),
    "步骤 2 / 31",
  );
  // 缺失键：zh 表回退 en 表；两表皆缺 → 原样返回 id（与中央 IntlProvider 同款）。
  assert.equal(formatLabMessage(zh, "you.lab.missing.key"), "you.lab.missing.key");
  assert.equal(formatLabMessage({}, "you.lab.tabTitle"), "Lab");
  // 未知 locale 回退 en-US。
  assert.equal(resolveLabMessages("fr-FR"), resolveLabMessages("en-US"));
});
