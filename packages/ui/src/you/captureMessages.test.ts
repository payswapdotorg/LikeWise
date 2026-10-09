// W2B logic tests — Capture 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、
// 面板 id 文案存在、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCaptureMessage,
  resolveCaptureMessages,
} from "./captureMessages.js";
import { CAPTURE_DEMO_STEPS } from "./captureStudioDemo.js";

const PANEL_IDS = ["requests", "capture", "review", "consent", "upload", "demo"] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveCaptureMessages("en-US");
  const zh = resolveCaptureMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  // 键集非空且都带 you.capture. 前缀（you 子树文案表口径）。
  assert.ok(enKeys.length > 80);
  for (const key of enKeys) {
    assert.match(key, /^you\.capture\./);
  }
});

test("unknown locale falls back to en-US", () => {
  const en = resolveCaptureMessages("en-US");
  const fallback = resolveCaptureMessages("fr-FR");
  assert.deepEqual(fallback, en);
});

test("every demo step message id exists in both catalogs", () => {
  const en = resolveCaptureMessages("en-US");
  const zh = resolveCaptureMessages("zh-CN");
  for (const step of CAPTURE_DEMO_STEPS) {
    assert.ok(en[step.titleMessageId], `missing en title ${step.titleMessageId}`);
    assert.ok(en[step.descriptionMessageId], `missing en description ${step.descriptionMessageId}`);
    assert.ok(zh[step.titleMessageId], `missing zh title ${step.titleMessageId}`);
    assert.ok(zh[step.descriptionMessageId], `missing zh description ${step.descriptionMessageId}`);
  }
});

test("every panel id has a localized label", () => {
  const en = resolveCaptureMessages("en-US");
  const zh = resolveCaptureMessages("zh-CN");
  for (const panelId of PANEL_IDS) {
    const key = `you.capture.panel.${panelId}`;
    assert.ok(en[key], `missing en panel label ${key}`);
    assert.ok(zh[key], `missing zh panel label ${key}`);
  }
});

test("placeholder semantics: {key} substitution and id fallback", () => {
  const en = resolveCaptureMessages("en-US");
  assert.equal(
    formatCaptureMessage(en, "you.capture.capture.progress", { captured: 2, total: 3 }),
    "Step 2 / 3 captured",
  );
  assert.equal(
    formatCaptureMessage(en, "you.capture.review.contentBytes", { count: 64 }),
    "64 bytes (simulated)",
  );
  // 缺失 id 回退：en 缺失也回退到 id 本身。
  assert.equal(formatCaptureMessage(en, "you.capture.missing.key"), "you.capture.missing.key");
  // zh-CN 渲染。
  const zh = resolveCaptureMessages("zh-CN");
  assert.equal(
    formatCaptureMessage(zh, "you.capture.capture.progress", { captured: 2, total: 3 }),
    "已捕获步骤 2 / 3",
  );
});

test("truth-law labels exist: simulated badge and scripted note", () => {
  const en = resolveCaptureMessages("en-US");
  const zh = resolveCaptureMessages("zh-CN");
  for (const catalog of [en, zh]) {
    assert.ok(catalog["you.capture.simulatedBadge"]);
    assert.ok(catalog["you.capture.demo.scriptedNote"]);
    assert.ok(catalog["you.capture.simulatedNote"]);
    assert.ok(catalog["you.capture.consent.gateBlocked"]);
  }
});
