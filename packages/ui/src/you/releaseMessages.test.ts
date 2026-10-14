// W12B logic tests — Release 文案表（node:test，无 DOM、无 `@/` 别名导入）。
//
// 覆盖：en-US 与 zh-CN 键集一致（i18n 完整性）、demo 步骤文案 id 存在、面板 id
// 文案存在、分类学文案存在（三 gateState / 两 point 态）、两门全部 reason 文案
// 存在（五 signoff reason / 六 declaration reason）、typed 错误面板文案存在（三个
// 验收 code + UNEXPECTED，en 解释 > 40 字符）、占位符语义与回退行为。
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReleaseMessage,
  resolveReleaseMessages,
} from "./releaseMessages.js";
import { RELEASE_DEMO_STEPS } from "./releaseStudioDemo.js";

const PANEL_IDS = [
  "checklist",
  "signoff",
  "declaration",
  "demo",
] as const;

const TYPED_ERROR_CODES = [
  "YOU_LAUNCH_GATE_INVALID",
  "YOU_OPERATOR_SIGNOFF_INVALID",
  "YOU_RELEASE_DECLARATION_INVALID",
  "UNEXPECTED",
] as const;

const GATE_STATES = [
  "all-points-passed",
  "incomplete",
  "empty",
] as const;

const POINT_STATES = ["passed", "notPassed"] as const;

const SIGNOFF_GATE_REASONS = [
  "granted",
  "no-checklist",
  "gate-not-passing",
  "checklist-already-signed",
  "unknown-operator",
] as const;

const DECLARATION_GATE_REASONS = [
  "granted",
  "no-signoff",
  "signoff-already-declared",
  "unknown-evidence-bundle",
  "empty-evidence-bundle",
  "missing-rollback-evidence",
] as const;

test("en-US and zh-CN catalogs share the exact same key set", () => {
  const en = resolveReleaseMessages("en-US");
  const zh = resolveReleaseMessages("zh-CN");
  const enKeys = Object.keys(en).sort();
  const zhKeys = Object.keys(zh).sort();
  assert.deepEqual(enKeys, zhKeys);
  assert.ok(enKeys.length > 140, `expected a full catalog, got ${enKeys.length} keys`);
  // 未知 locale 回退 en-US（与中央 IntlProvider 语义一致）。
  assert.deepEqual(
    Object.keys(resolveReleaseMessages("fr-FR")).sort(),
    enKeys,
  );
});

test("every panel id, taxonomy value and both gate reason sets have a label in both locales", () => {
  const en = resolveReleaseMessages("en-US");
  const zh = resolveReleaseMessages("zh-CN");
  for (const id of PANEL_IDS) {
    assert.ok(en[`you.release.panel.${id}`], `missing en panel label ${id}`);
    assert.ok(zh[`you.release.panel.${id}`], `missing zh panel label ${id}`);
  }
  for (const state of GATE_STATES) {
    assert.ok(en[`you.release.checklist.gateState.${state}`]);
    assert.ok(zh[`you.release.checklist.gateState.${state}`]);
  }
  for (const state of POINT_STATES) {
    assert.ok(en[`you.release.point.${state}`]);
    assert.ok(zh[`you.release.point.${state}`]);
  }
  for (const reason of SIGNOFF_GATE_REASONS) {
    assert.ok(en[`you.release.signoff.gate.reason.${reason}`]);
    assert.ok(zh[`you.release.signoff.gate.reason.${reason}`]);
  }
  for (const reason of DECLARATION_GATE_REASONS) {
    assert.ok(en[`you.release.declaration.gate.reason.${reason}`]);
    assert.ok(zh[`you.release.declaration.gate.reason.${reason}`]);
  }
});

test("every demo step message id exists in both locales (titles + descriptions)", () => {
  const en = resolveReleaseMessages("en-US");
  const zh = resolveReleaseMessages("zh-CN");
  for (const demoStep of RELEASE_DEMO_STEPS) {
    assert.ok(en[demoStep.titleMessageId], `missing en ${demoStep.titleMessageId}`);
    assert.ok(zh[demoStep.titleMessageId], `missing zh ${demoStep.titleMessageId}`);
    assert.ok(
      en[demoStep.descriptionMessageId],
      `missing en ${demoStep.descriptionMessageId}`,
    );
    assert.ok(
      zh[demoStep.descriptionMessageId],
      `missing zh ${demoStep.descriptionMessageId}`,
    );
  }
});

test("typed error panels exist for all three v12 codes plus UNEXPECTED with substantive explanations", () => {
  const en = resolveReleaseMessages("en-US");
  const zh = resolveReleaseMessages("zh-CN");
  for (const code of TYPED_ERROR_CODES) {
    const enText = en[`you.release.error.${code}`];
    const zhText = zh[`you.release.error.${code}`];
    assert.ok(enText, `missing en typed error panel ${code}`);
    assert.ok(zhText, `missing zh typed error panel ${code}`);
    assert.ok(
      enText.length > 40,
      `en typed error panel ${code} too short (${enText.length})`,
    );
    assert.ok(zhText.length > 20, `zh typed error panel ${code} too short`);
  }
  assert.ok(en["you.release.error.caption"]);
  assert.ok(zh["you.release.error.caption"]);
});

test("placeholder semantics and fallback behavior match the central catalog", () => {
  const en = resolveReleaseMessages("en-US");
  const zh = resolveReleaseMessages("zh-CN");
  assert.equal(
    formatReleaseMessage(en, "you.release.checklist.run.projected", {
      evidence: 20,
      total: 20,
    }),
    "projected coverage: 20/20 points with evidence",
  );
  assert.equal(
    formatReleaseMessage(zh, "you.release.demo.step", { current: 3, total: 13 }),
    "步骤 3 / 13",
  );
  // 缺失键：回退 en-US，再回退 id。
  assert.equal(formatReleaseMessage({}, "you.release.tabTitle"), "Release");
  assert.equal(formatReleaseMessage({}, "missing.key.id"), "missing.key.id");
  // 无占位符值时原文返回。
  assert.equal(
    formatReleaseMessage(en, "you.release.simulatedNote"),
    en["you.release.simulatedNote"],
  );
});
