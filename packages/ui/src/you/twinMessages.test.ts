// W3B logic tests — Twin 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、
// 面板 id 文案存在、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatTwinMessage, resolveTwinMessages } from "./twinMessages.js";
import { TWIN_DEMO_STEPS } from "./twinStudioDemo.js";

const PANEL_IDS = ["versions", "quality", "compare", "remediation", "reconstruction", "demo"] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveTwinMessages("en-US");
  const zh = resolveTwinMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.twin. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 100);
  for (const key of enKeys) {
    assert.match(key, /^you\.twin\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolveTwinMessages("en-US");
  const fallback = resolveTwinMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolveTwinMessages("en-US");
  const zh = resolveTwinMessages("zh-CN");
  for (const step of TWIN_DEMO_STEPS) {
    assert.ok(en[step.titleMessageId], `missing en title ${step.titleMessageId}`);
    assert.ok(en[step.descriptionMessageId], `missing en description ${step.descriptionMessageId}`);
    assert.ok(zh[step.titleMessageId], `missing zh title ${step.titleMessageId}`);
    assert.ok(zh[step.descriptionMessageId], `missing zh description ${step.descriptionMessageId}`);
  }
});

test("every panel id has a localized label", () => {
  const en = resolveTwinMessages("en-US");
  const zh = resolveTwinMessages("zh-CN");
  for (const panelId of PANEL_IDS) {
    const key = `you.twin.panel.${panelId}`;
    assert.ok(en[key], `missing en panel label ${key}`);
    assert.ok(zh[key], `missing zh panel label ${key}`);
  }
});

test("placeholder semantics: {key} substitution and id fallback", () => {
  const en = resolveTwinMessages("en-US");
  assert.equal(
    formatTwinMessage(en, "you.twin.demo.step", { current: 4, total: 14 }),
    "Step 4 / 14",
  );
  // zh-CN 同款占位符语义。
  const zh = resolveTwinMessages("zh-CN");
  assert.equal(
    formatTwinMessage(zh, "you.twin.demo.step", { current: 2, total: 14 }),
    "步骤 2 / 14",
  );
  // 未知 id 回退：先 en-US 键，再 id 本身。
  assert.equal(formatTwinMessage(en, "you.twin.unknown.key"), "you.twin.unknown.key");
  assert.equal(
    formatTwinMessage({ "you.twin.only.zh": "值" }, "you.twin.only.zh"),
    "值",
  );
});
