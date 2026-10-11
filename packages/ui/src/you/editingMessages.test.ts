// W5B logic tests — Editing 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id 文案
// 存在、typed 错误面板文案存在、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatEditingMessage, resolveEditingMessages } from "./editingMessages.js";
import { EDITING_DEMO_STEPS } from "./editingStudioDemo.js";

const PANEL_IDS = ["sessions", "changesets", "compare", "editors", "takeover", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_EDIT_SESSION_NOT_FOUND",
  "YOU_CHANGESET_INVALID",
  "YOU_EDITOR_UNSUPPORTED",
  "YOU_IMPORT_EXPORT_FAILED",
  "UNEXPECTED",
] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveEditingMessages("en-US");
  const zh = resolveEditingMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.editing. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 150);
  for (const key of enKeys) {
    assert.match(key, /^you\.editing\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolveEditingMessages("en-US");
  const fallback = resolveEditingMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolveEditingMessages("en-US");
  const zh = resolveEditingMessages("zh-CN");
  for (const demoStep of EDITING_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en title ${demoStep.titleMessageId}`);
    assert.ok(en[demoStep.descriptionMessageId], `missing en description ${demoStep.descriptionMessageId}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh title ${demoStep.titleMessageId}`);
    assert.ok(zh[demoStep.descriptionMessageId], `missing zh description ${demoStep.descriptionMessageId}`);
  }
});

test("every panel id has a localized label", () => {
  const en = resolveEditingMessages("en-US");
  const zh = resolveEditingMessages("zh-CN");
  for (const panelId of PANEL_IDS) {
    const key = `you.editing.panel.${panelId}`;
    assert.ok(en[key], `missing en panel label ${key}`);
    assert.ok(zh[key], `missing zh panel label ${key}`);
  }
});

test("every session ladder status has a localized label", () => {
  const en = resolveEditingMessages("en-US");
  const zh = resolveEditingMessages("zh-CN");
  for (const status of ["open", "committed", "abandoned"] as const) {
    const key = `you.editing.sessions.status.${status}`;
    assert.ok(en[key], `missing en session status ${key}`);
    assert.ok(zh[key], `missing zh session status ${key}`);
  }
});

test("typed error panel codes have localized explanations", () => {
  const en = resolveEditingMessages("en-US");
  const zh = resolveEditingMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const key = `you.editing.error.${code}`;
    assert.ok(en[key], `missing en typed error explanation ${key}`);
    assert.ok(zh[key], `missing zh typed error explanation ${key}`);
    assert.ok(en[key]!.length > 40, `en typed error explanation too thin: ${key}`);
  }
});

test("placeholder semantics: {key} substitution and id fallback", () => {
  const en = resolveEditingMessages("en-US");
  assert.equal(
    formatEditingMessage(en, "you.editing.demo.step", { current: 4, total: 24 }),
    "Step 4 / 24",
  );
  // zh-CN 同款占位符语义。
  const zh = resolveEditingMessages("zh-CN");
  assert.equal(
    formatEditingMessage(zh, "you.editing.demo.step", { current: 2, total: 24 }),
    "步骤 2 / 24",
  );
  // 未知 id 回退：先 en-US 键，再 id 本身。
  assert.equal(
    formatEditingMessage(en, "you.editing.unknown.key"),
    "you.editing.unknown.key",
  );
  assert.equal(
    formatEditingMessage({ "you.editing.only.zh": "值" }, "you.editing.only.zh"),
    "值",
  );
});
