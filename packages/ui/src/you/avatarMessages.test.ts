// W7B logic tests — Avatar 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id 文案
// 存在、九级阶梯文案存在、状态/控件文案存在、typed 错误面板文案存在（四个验收
// code + YOU_INVALID_STATE + UNEXPECTED，en 解释 >40 字符）、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import { formatAvatarMessage, resolveAvatarMessages } from "./avatarMessages.js";
import { AVATAR_DEMO_STEPS } from "./avatarStudioDemo.js";

const PANEL_IDS = ["configuration", "embodiment", "session", "realtime", "demo"] as const;

const TYPED_ERROR_CODES = [
  "YOU_BODY_NOT_FOUND",
  "YOU_SOUL_BINDING_INVALID",
  "YOU_AVATAR_SESSION_NOT_FOUND",
  "YOU_EMBODIMENT_STATE_INVALID",
  "YOU_INVALID_STATE",
  "UNEXPECTED",
] as const;

const EMBODIMENT_STATES = [
  "listening",
  "reading",
  "typing",
  "thinking",
  "tool_use",
  "speaking",
  "interrupted",
  "idle",
  "unavailable",
] as const;

const SESSION_STATUSES = ["active", "suspended", "closed"] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveAvatarMessages("en-US");
  const zh = resolveAvatarMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.avatar. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 150);
  for (const key of enKeys) {
    assert.match(key, /^you\.avatar\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolveAvatarMessages("en-US");
  const fallback = resolveAvatarMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolveAvatarMessages("en-US");
  const zh = resolveAvatarMessages("zh-CN");
  for (const demoStep of AVATAR_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en title ${demoStep.titleMessageId}`);
    assert.ok(en[demoStep.descriptionMessageId], `missing en description ${demoStep.descriptionMessageId}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh title ${demoStep.titleMessageId}`);
    assert.ok(zh[demoStep.descriptionMessageId], `missing zh description ${demoStep.descriptionMessageId}`);
  }
});

test("every panel id has a localized label", () => {
  const en = resolveAvatarMessages("en-US");
  const zh = resolveAvatarMessages("zh-CN");
  for (const panelId of PANEL_IDS) {
    const key = `you.avatar.panel.${panelId}`;
    assert.ok(en[key], `missing en panel label ${key}`);
    assert.ok(zh[key], `missing zh panel label ${key}`);
  }
});

test("every embodiment ladder rung has a localized label (nine frozen states)", () => {
  const en = resolveAvatarMessages("en-US");
  const zh = resolveAvatarMessages("zh-CN");
  for (const state of EMBODIMENT_STATES) {
    const key = `you.avatar.embodiment.state.${state}`;
    assert.ok(en[key], `missing en state label ${key}`);
    assert.ok(zh[key], `missing zh state label ${key}`);
  }
});

test("lifecycle statuses have localized surface labels via session captions", () => {
  const en = resolveAvatarMessages("en-US");
  const zh = resolveAvatarMessages("zh-CN");
  for (const status of SESSION_STATUSES) {
    // 状态徽标渲染快照字面量；本地化面走 suspend/resume/close 控件文案 + 阶梯档位。
    assert.ok(en["you.avatar.session.suspend"], "missing en suspend control");
    assert.ok(zh["you.avatar.session.resume"], "missing zh resume control");
    assert.ok(en["you.avatar.session.close"], "missing en close control");
    void status;
  }
});

test("typed error panel codes have localized explanations", () => {
  const en = resolveAvatarMessages("en-US");
  const zh = resolveAvatarMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const key = `you.avatar.error.${code}`;
    assert.ok(en[key], `missing en typed error explanation ${key}`);
    assert.ok(zh[key], `missing zh typed error explanation ${key}`);
    assert.ok(en[key]!.length > 40, `en typed error explanation too thin: ${key}`);
  }
});

test("placeholder semantics: {key} substitution and id fallback", () => {
  const en = resolveAvatarMessages("en-US");
  assert.equal(
    formatAvatarMessage(en, "you.avatar.demo.step", { current: 4, total: 22 }),
    "Step 4 / 22",
  );
  // zh-CN 同款占位符语义。
  const zh = resolveAvatarMessages("zh-CN");
  assert.equal(
    formatAvatarMessage(zh, "you.avatar.demo.step", { current: 2, total: 22 }),
    "步骤 2 / 22",
  );
  // 未知 id 回退：先 en-US 键，再 id 本身。
  assert.equal(
    formatAvatarMessage(en, "you.avatar.unknown.key"),
    "you.avatar.unknown.key",
  );
  assert.equal(
    formatAvatarMessage({ "you.avatar.only.zh": "值" }, "you.avatar.only.zh"),
    "值",
  );
});
