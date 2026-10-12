// W6B logic tests — Learning 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id 文案
// 存在、kind picker 文案存在、状态阶梯文案存在、typed 错误面板文案存在（四个
// 验收 code + UNEXPECTED，en 解释 >40 字符）、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatLearningMessage, resolveLearningMessages } from "./learningMessages.js";
import { LEARNING_DEMO_STEPS } from "./learningStudioDemo.js";

const PANEL_IDS = ["signals", "ledger", "rights", "preferences", "replay", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_LEARNING_SIGNAL_INVALID",
  "YOU_LEARNING_RECORD_NOT_FOUND",
  "YOU_LEARNING_RIGHTS_REQUIRED",
  "YOU_PREFERENCE_SCOPE_INVALID",
  "UNEXPECTED",
] as const;

const SIGNAL_KINDS = [
  "feedback",
  "manual-takeover",
  "edit-session",
  "expert-intervention",
  "repeated-intent",
  "capability-gap",
] as const;

const RECORD_STATUSES = ["candidate", "validated", "rejected", "superseded"] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveLearningMessages("en-US");
  const zh = resolveLearningMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.learning. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 150);
  for (const key of enKeys) {
    assert.match(key, /^you\.learning\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolveLearningMessages("en-US");
  const fallback = resolveLearningMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolveLearningMessages("en-US");
  const zh = resolveLearningMessages("zh-CN");
  for (const demoStep of LEARNING_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en title ${demoStep.titleMessageId}`);
    assert.ok(en[demoStep.descriptionMessageId], `missing en description ${demoStep.descriptionMessageId}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh title ${demoStep.titleMessageId}`);
    assert.ok(zh[demoStep.descriptionMessageId], `missing zh description ${demoStep.descriptionMessageId}`);
  }
});

test("every panel id has a localized label", () => {
  const en = resolveLearningMessages("en-US");
  const zh = resolveLearningMessages("zh-CN");
  for (const panelId of PANEL_IDS) {
    const key = `you.learning.panel.${panelId}`;
    assert.ok(en[key], `missing en panel label ${key}`);
    assert.ok(zh[key], `missing zh panel label ${key}`);
  }
});

test("every signal kind has a localized picker label", () => {
  const en = resolveLearningMessages("en-US");
  const zh = resolveLearningMessages("zh-CN");
  for (const kind of SIGNAL_KINDS) {
    const key = `you.learning.signals.kind.${kind}`;
    assert.ok(en[key], `missing en kind label ${key}`);
    assert.ok(zh[key], `missing zh kind label ${key}`);
  }
});

test("every record ladder status has a localized label", () => {
  const en = resolveLearningMessages("en-US");
  const zh = resolveLearningMessages("zh-CN");
  for (const status of RECORD_STATUSES) {
    const key = `you.learning.status.${status}`;
    assert.ok(en[key], `missing en record status ${key}`);
    assert.ok(zh[key], `missing zh record status ${key}`);
  }
});

test("typed error panel codes have localized explanations", () => {
  const en = resolveLearningMessages("en-US");
  const zh = resolveLearningMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const key = `you.learning.error.${code}`;
    assert.ok(en[key], `missing en typed error explanation ${key}`);
    assert.ok(zh[key], `missing zh typed error explanation ${key}`);
    assert.ok(en[key]!.length > 40, `en typed error explanation too thin: ${key}`);
  }
});

test("placeholder semantics: {key} substitution and id fallback", () => {
  const en = resolveLearningMessages("en-US");
  assert.equal(
    formatLearningMessage(en, "you.learning.demo.step", { current: 4, total: 29 }),
    "Step 4 / 29",
  );
  // zh-CN 同款占位符语义。
  const zh = resolveLearningMessages("zh-CN");
  assert.equal(
    formatLearningMessage(zh, "you.learning.demo.step", { current: 2, total: 29 }),
    "步骤 2 / 29",
  );
  // 未知 id 回退：先 en-US 键，再 id 本身。
  assert.equal(
    formatLearningMessage(en, "you.learning.unknown.key"),
    "you.learning.unknown.key",
  );
  assert.equal(
    formatLearningMessage({ "you.learning.only.zh": "值" }, "you.learning.only.zh"),
    "值",
  );
});
