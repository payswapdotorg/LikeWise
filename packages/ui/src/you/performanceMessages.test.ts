// W4B logic tests — Performance 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id 文案
// 存在、typed 错误面板文案存在、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatPerformanceMessage, resolvePerformanceMessages } from "./performanceMessages.js";
import { PERFORMANCE_DEMO_STEPS } from "./performanceStudioDemo.js";

const PANEL_IDS = ["timeline", "templates", "jobs", "review", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_TIMELINE_INVALID",
  "YOU_RENDER_UNSUPPORTED",
  "YOU_RENDER_ARTIFACT_NOT_FOUND",
  "UNEXPECTED",
] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolvePerformanceMessages("en-US");
  const zh = resolvePerformanceMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.performance. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 150);
  for (const key of enKeys) {
    assert.match(key, /^you\.performance\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolvePerformanceMessages("en-US");
  const fallback = resolvePerformanceMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolvePerformanceMessages("en-US");
  const zh = resolvePerformanceMessages("zh-CN");
  for (const step of PERFORMANCE_DEMO_STEPS) {
    assert.ok(en[step.titleMessageId], `missing en title ${step.titleMessageId}`);
    assert.ok(en[step.descriptionMessageId], `missing en description ${step.descriptionMessageId}`);
    assert.ok(zh[step.titleMessageId], `missing zh title ${step.titleMessageId}`);
    assert.ok(zh[step.descriptionMessageId], `missing zh description ${step.descriptionMessageId}`);
  }
});

test("every panel id has a localized label", () => {
  const en = resolvePerformanceMessages("en-US");
  const zh = resolvePerformanceMessages("zh-CN");
  for (const panelId of PANEL_IDS) {
    const key = `you.performance.panel.${panelId}`;
    assert.ok(en[key], `missing en panel label ${key}`);
    assert.ok(zh[key], `missing zh panel label ${key}`);
  }
});

test("typed error panel codes have localized explanations", () => {
  const en = resolvePerformanceMessages("en-US");
  const zh = resolvePerformanceMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const key = `you.performance.error.${code}`;
    assert.ok(en[key], `missing en typed error explanation ${key}`);
    assert.ok(zh[key], `missing zh typed error explanation ${key}`);
    assert.ok(en[key]!.length > 40, `en typed error explanation too thin: ${key}`);
  }
});

test("placeholder semantics: {key} substitution and id fallback", () => {
  const en = resolvePerformanceMessages("en-US");
  assert.equal(
    formatPerformanceMessage(en, "you.performance.demo.step", { current: 4, total: 18 }),
    "Step 4 / 18",
  );
  // zh-CN 同款占位符语义。
  const zh = resolvePerformanceMessages("zh-CN");
  assert.equal(
    formatPerformanceMessage(zh, "you.performance.demo.step", { current: 2, total: 18 }),
    "步骤 2 / 18",
  );
  // 未知 id 回退：先 en-US 键，再 id 本身。
  assert.equal(
    formatPerformanceMessage(en, "you.performance.unknown.key"),
    "you.performance.unknown.key",
  );
  assert.equal(
    formatPerformanceMessage({ "you.performance.only.zh": "值" }, "you.performance.only.zh"),
    "值",
  );
});
